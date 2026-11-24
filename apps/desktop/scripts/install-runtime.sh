#!/usr/bin/env bash
# 把随包的发行目录（apps/desktop/runtime/）准备好。
#
# runtime/ 不单独维护：每次从 Web 端也在用的发行目录 distribution/ 同步
# 清单、锁文件、npm 配置、补丁（patches/）、插件包 tarball（vendor/）和启动前检查（bin/），
# 再严格按锁文件装依赖。这样两端跑的是同一份 DSH、同一组补丁、同一个品牌包。
# runtime/ 下除 node_modules 以外都是同步来的，不要手改；要改就改 distribution/。
#
# 用法：bash scripts/install-runtime.sh [目标目录]     默认 apps/desktop/runtime
#   JX_RUNTIME_SOURCE=<发行目录>                       同步的来源，默认 <仓库>/distribution
# 缓存放在 .dev/cache/npm，不往 ~/.npm 写（见 env.sh）。
set -euo pipefail
source "$(dirname "$0")/env.sh"

RUNTIME_DIR="${1:-$JX_DESKTOP_DIR/runtime}"
SOURCE_DIR="${JX_RUNTIME_SOURCE:-$JX_DESKTOP_DIR/../../distribution}"
SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
mkdir -p "$RUNTIME_DIR"
RUNTIME_DIR="$(cd "$RUNTIME_DIR" && pwd)"
if [ "$SOURCE_DIR" = "$RUNTIME_DIR" ]; then
  echo "install-runtime: 来源和目标是同一个目录：$RUNTIME_DIR" >&2
  exit 1
fi
for f in package.json package-lock.json .npmrc bin/jx-preflight.mjs; do
  if [ ! -f "$SOURCE_DIR/$f" ]; then
    echo "install-runtime: 发行目录里没有 ${f}：$SOURCE_DIR" >&2
    exit 1
  fi
done

# 同步。目录整个替换，免得来源里删掉的补丁在这里留下来。
cp "$SOURCE_DIR/package.json" "$SOURCE_DIR/package-lock.json" "$SOURCE_DIR/.npmrc" "$RUNTIME_DIR/"
for d in patches vendor bin; do
  rm -rf "${RUNTIME_DIR:?}/$d"
  if [ -d "$SOURCE_DIR/$d" ]; then cp -R "$SOURCE_DIR/$d" "$RUNTIME_DIR/$d"; fi
done

cd "$RUNTIME_DIR"
npm ci --ignore-scripts --no-audit --no-fund

# 自检：装出来的 DSH 必须正好是钉死的那一版。插件包、补丁、品牌包这一行的检查在打包前由
# bin/jx-preflight.mjs 做（scripts/pack-mac.sh）。
EXPECTED="$(node -p "require('./package.json').dependencies['@deepseek-ai/dsh']")"
ACTUAL="$(node -p "require('./node_modules/@deepseek-ai/dsh/package.json').version")"
if [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "install-runtime: 装出来的 DSH 是 ${ACTUAL}，清单里钉的是 $EXPECTED" >&2
  exit 1
fi
echo "install-runtime: 已从 $SOURCE_DIR 同步，DSH $ACTUAL 和插件包装到了 $RUNTIME_DIR"
