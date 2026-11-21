#!/usr/bin/env bash
# 把仓库里的插件包打成 tarball 放进 vendor/，装进发行目录，再把各包自带的补丁抄进 patches/。
#
# 为什么用 tarball：发行目录里的插件包必须是 node_modules 里的真实目录。`file:` 指向目录的依赖
# 装出来是符号链接，包里对 DSH 模块的引用会按真实路径往上找，解析失败（实测）。
#
# 为什么把补丁抄进 patches/：发行目录的补丁一律叠在命令行那一层（--patch），用户在界面上关不掉、
# 改不动；Web 端的启动器和桌面壳都只认 patches/*.yml，不用各自再学一遍「去包里找补丁」。
# 抄过来的文件开头写着从哪个包、哪个版本生成，不要手改；要改就改包里的 cordis.patch.yml 再跑一次。
#
# 抄的时候把插件行的 `name: '@jx/…'`（包名）改成相对补丁文件的入口文件路径
# （`name: '../node_modules/@jx/…/lib/index.js'`）。原因（实测）：按包名写的插件行，DSH 从
# `$DSH_HOME/profiles/<名>/` 往上找包，不从 DSH 的安装目录找；状态目录不在发行目录里面时
# （桌面壳、容器、正式部署都是这样）就报 ERR_MODULE_NOT_FOUND，插件不加载，界面露出 DSH 的品牌。
# 补丁里的相对路径按补丁文件所在的位置解析（DSH 文档 docs/user/develop/basic/publish.md），
# 不受状态目录影响。不能写成包目录：DSH 按 ES 模块导入，目录导入会报 ERR_UNSUPPORTED_DIR_IMPORT。
#
# 用法：distribution/scripts/vendor-packages.sh
#   改了 packages/ 下的插件包以后跑一次。需要 pnpm（构建插件包）和 npm（发行目录用 npm 装）。
#   会联网：npm 要按锁文件核对依赖。
set -euo pipefail

dist="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(cd "$dist/.." && pwd)"
vendor="$dist/vendor"

# 包名 | 源码目录 | 抄进 patches/ 的文件名（数字决定叠加顺序）| 说明（写进生成的补丁开头）
packages=(
  "@jx/brand-theme|packages/brand-theme|70-jx-brand-theme.yml|品牌包：名称、标志、主题色、界面文案。"
  "@jx/enterprise-workbench|packages/enterprise-workbench|80-sample-jx-enterprise-workbench.yml|样板插件：演示企业插件怎么做，台账数据是假的。正式发行前删掉这个文件，并从 package.json 里去掉 @jx/enterprise-workbench。"
)

# 1. 检查并构建。ui-kit 是源码库，另外两个包用它的构建脚本（jx-dsh-plugin-build）。
echo "vendor: 检查 @jx/ui-kit" >&2
(cd "$root/packages/ui-kit" && pnpm run --silent typecheck && pnpm run --silent test >/dev/null)
for entry in "${packages[@]}"; do
  IFS='|' read -r name dir _ _ <<<"$entry"
  echo "vendor: 类型检查、单测、构建 $name" >&2
  (cd "$root/$dir" && pnpm run --silent typecheck && pnpm run --silent test >/dev/null && pnpm run --silent build)
done

# 2. 打成 tarball。
rm -rf "$vendor"
mkdir -p "$vendor"
for entry in "${packages[@]}"; do
  IFS='|' read -r name dir _ _ <<<"$entry"
  (cd "$root/$dir" && pnpm pack --pack-destination "$vendor" >/dev/null)
done

# 3. 改 package.json 的依赖，指向 vendor/ 里的 tarball。版本写在文件名里。
node - "$dist" "${packages[@]}" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const [dist, ...entries] = process.argv.slice(2)
const manifestPath = path.join(dist, 'package.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const tarballs = fs.readdirSync(path.join(dist, 'vendor')).filter((f) => f.endsWith('.tgz'))
for (const entry of entries) {
  const [name, dir] = entry.split('|')
  const version = JSON.parse(fs.readFileSync(path.join(dist, '..', dir, 'package.json'), 'utf8')).version
  const file = `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`
  if (!tarballs.includes(file)) throw new Error(`vendor/ 里没有 ${file}（有：${tarballs.join('、')}）`)
  manifest.dependencies[name] = `file:vendor/${file}`
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
NODE

# 4. 装。tarball 内容变了而版本号没变时，npm 认为已经装好，既不重装，也不改锁文件里的完整性校验值
#    （实测：只打一行 up to date），之后 npm ci 就会因为校验值对不上而失败。所以先把这几个包从
#    node_modules 和锁文件里拿掉，让 npm 按新的 tarball 重新装、重新算校验值。
node - "$dist" "${packages[@]}" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const [dist, ...entries] = process.argv.slice(2)
const lockPath = path.join(dist, 'package-lock.json')
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
for (const entry of entries) {
  const name = entry.split('|')[0]
  for (const key of Object.keys(lock.packages)) {
    if (key === `node_modules/${name}` || key.startsWith(`node_modules/${name}/`)) delete lock.packages[key]
  }
  fs.rmSync(path.join(dist, 'node_modules', name), { recursive: true, force: true })
}
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
NODE
(cd "$dist" && npm install --ignore-scripts --no-audit --no-fund)

# 5. 核对装出来的是真实目录、版本对得上，再把补丁抄进 patches/。
for entry in "${packages[@]}"; do
  IFS='|' read -r name dir patch_name note <<<"$entry"
  installed="$dist/node_modules/$name"
  if [ -L "$installed" ] || [ ! -f "$installed/package.json" ]; then
    echo "vendor: $name 没有作为真实目录装进 node_modules" >&2
    exit 1
  fi
  version="$(node -p "require('$installed/package.json').version")"
  main="$(node -p "require('$installed/package.json').main")"
  patch_src="$installed/$(node -p "require('$installed/package.json').dsh.bundle.patch")"
  entry="../node_modules/$name/${main#./}"
  if ! grep -q "name: '$name'" "$patch_src"; then
    echo "vendor: $patch_src 里找不到 name: '$name'，没法改成路径写法" >&2
    exit 1
  fi
  {
    echo "# 由 distribution/scripts/vendor-packages.sh 从 $name@$version 的补丁生成，不要手改。"
    echo "# 要改就改 $dir/cordis.patch.yml，再跑一次脚本。"
    echo "# $note"
    echo "# 和包里原件的唯一区别：插件行的 name 从包名 '$name' 改成了相对本文件的入口路径，"
    echo "# 这样不管状态目录（DSH_HOME）放在哪里都找得到包（原因见 scripts/vendor-packages.sh 开头）。"
    echo "#"
    sed "s#name: '$name'#name: '$entry'#" "$patch_src"
  } >"$dist/patches/$patch_name"
  if [ ! -f "$dist/patches/$entry" ]; then
    echo "vendor: 改写后的路径不存在：patches/$entry" >&2
    exit 1
  fi
  echo "vendor: $name@$version → vendor/、patches/$patch_name" >&2
done
