#!/usr/bin/env node
// 启动前检查：发行目录装得对不对。查不过就不该启动。
//
// 为什么要有：DSH 遇到版本对不上的插件不报错，只把那一行停用、在标准错误里打一行字，照常启动
// （实测）。品牌包被停用时，产品会带着 DSH 自己的品牌起来，没人会发现。
//
// 查四样：
//   1. 装的 DSH 就是 package.json 里钉的那个精确版本；
//   2. package.json 里其余的依赖都装在 node_modules 里、是真实目录（不是符号链接），
//      版本和 tarball 文件名里的版本一致，engines.dsh 认这个 DSH；
//      （这一条是防版本不匹配的主要防线：实测 rc.5 的 --dump-config 不跑版本门禁，
//       版本不对的插件在合成配置里照样出现、也不告警，要到真正启动时才被停用。）
//   3. 用一个临时的空状态目录，经启动器（bin/jx-dsh）跑一次 dsh --dump-config，叠同样的补丁：
//      退出码为 0（补丁能解析、插件包能找到），标准错误里没有停用插件的告警；
//   4. 补丁里用 insert 加的每个 jx- 开头的行，都在合成配置里，并且没有被停用；
//      它的 name 必须是相对补丁文件的路径，并且指向一个存在的文件。
//      （实测：按包名写的行，DSH 从 $DSH_HOME/profiles/<名>/ 往上找包，状态目录不在发行目录里面时
//       导入失败、插件不加载，而 --dump-config 看不出来。）
//
// 用法：node jx-preflight.mjs [--dist <发行目录>] [--profile <名字>] [--quiet]
//   默认发行目录是本脚本的上一级目录，profile 是 web。JX_EXTRA_PATCHES 照样生效。
//   Web 端的启动器每次启动前自动跑（JX_SKIP_PREFLIGHT=1 跳过）；桌面壳在打包前跑。
// 退出码：0 通过；1 没通过；2 用法错误。
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DSH = '@deepseek-ai/dsh'
const here = dirname(fileURLToPath(import.meta.url))

let dist = resolve(here, '..')
let profile = 'web'
let quiet = false
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (arg === '--dist') dist = resolve(argv[++i] ?? '')
  else if (arg === '--profile') profile = argv[++i] ?? ''
  else if (arg === '--quiet') quiet = true
  else {
    console.error(`jx-preflight: 不认识的参数 ${arg}`)
    process.exit(2)
  }
}
if (profile === '') {
  console.error('jx-preflight: --profile 后面要跟名字')
  process.exit(2)
}

const problems = []
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const finish = (summary) => {
  if (problems.length > 0) {
    console.error(`jx-preflight: 发行目录 ${dist} 没通过启动前检查：`)
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  if (!quiet) console.error(`jx-preflight: 通过。${summary}`)
  process.exit(0)
}

// --- 1、2：清单和装出来的东西 ---------------------------------------------------------------
const manifestPath = join(dist, 'package.json')
if (!existsSync(manifestPath)) {
  problems.push(`发行目录里没有 package.json：${dist}`)
  finish('')
}
const dependencies = readJson(manifestPath).dependencies ?? {}
const pinned = dependencies[DSH]
if (typeof pinned !== 'string' || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pinned)) {
  problems.push(`package.json 里的 ${DSH} 必须写精确版本，现在是 ${JSON.stringify(pinned)}`)
}

const packageDir = (name) => join(dist, 'node_modules', ...name.split('/'))
const dshDir = packageDir(DSH)
if (!existsSync(join(dshDir, 'package.json'))) {
  problems.push(`DSH 还没装（找不到 ${dshDir}）。先在发行目录里执行 npm ci --ignore-scripts`)
  finish('')
}
const dshVersion = readJson(join(dshDir, 'package.json')).version
if (dshVersion !== pinned) problems.push(`装的 DSH 是 ${dshVersion}，package.json 里钉的是 ${pinned}`)

// engines.dsh 用 DSH 自己依赖的 semver 判断；DSH 算的是「包含预发布版本」（实测 0.2.x 也认 rc 版）。
let satisfies
try {
  const semver = createRequire(join(dshDir, 'package.json'))('semver')
  satisfies = (version, range) => semver.satisfies(version, range, { includePrerelease: true })
} catch {
  // 取不到 semver 时退一步：只认精确版本。我们自己的插件包本来就写精确版本。
  satisfies = (version, range) => version === range.trim()
}

const plugins = []
for (const [name, spec] of Object.entries(dependencies)) {
  if (name === DSH) continue
  const dir = packageDir(name)
  if (!existsSync(join(dir, 'package.json'))) {
    problems.push(`${name} 没装（找不到 ${dir}）`)
    continue
  }
  if (lstatSync(dir).isSymbolicLink()) {
    problems.push(`${name} 在 node_modules 里是符号链接。插件包必须是真实目录，用 tarball 装（见 scripts/vendor-packages.sh）`)
  }
  const installed = readJson(join(dir, 'package.json'))
  const fromTarball = /-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.tgz$/.exec(String(spec))
  if (fromTarball !== null && fromTarball[1] !== installed.version) {
    problems.push(`${name} 装的是 ${installed.version}，package.json 指向的 tarball 是 ${fromTarball[1]}。重新执行 npm ci --ignore-scripts`)
  }
  const range = installed.engines?.dsh
  if (typeof range === 'string' && !satisfies(dshVersion, range)) {
    problems.push(`${name}@${installed.version} 要求 DSH ${range}，装的是 ${dshVersion}。DSH 会停用它，界面上会露出 DSH 自己的东西`)
  }
  plugins.push(`${name} ${installed.version}`)
}

// --- 3、4：照真的启动那样合成一次配置 --------------------------------------------------------
const patchesDir = join(dist, 'patches')
const patchFiles = existsSync(patchesDir)
  ? readdirSync(patchesDir).filter((f) => f.endsWith('.yml')).sort().map((f) => join(patchesDir, f))
  : []
for (const extra of (process.env.JX_EXTRA_PATCHES ?? '').split(':')) {
  if (extra !== '' && existsSync(extra)) patchFiles.push(resolve(extra))
}
// 补丁里 insert 加的行：顶格的 `- insert:` 下面，第一层列表项的 id 和 name。
// 不能简单地搜所有 `- id: jx-…`：配置里嵌套的列表（比如补丁 10 的模型列表）也用 `- id:`。
// 只认这一种写法：`    - id: <id>` 后面跟同一层的 `      name: <name>`（我们的补丁都是这样写的）。
const insertedRows = (text) => {
  const rows = []
  let inInsert = false
  let itemIndent
  let current
  const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2')
  for (const line of text.split('\n')) {
    if (/^\s*(#.*)?$/.test(line)) continue
    if (/^\S/.test(line)) {
      inInsert = /^-\s+insert:\s*$/.test(line)
      itemIndent = undefined
      current = undefined
      continue
    }
    if (!inInsert) continue
    const item = /^(\s+)-\s+(.*)$/.exec(line)
    if (item !== null && (itemIndent === undefined || item[1].length === itemIndent)) {
      itemIndent = item[1].length
      current = {}
      rows.push(current)
      const field = /^(id|name):\s+(.+)$/.exec(item[2])
      if (field !== null) current[field[1]] = unquote(field[2])
      continue
    }
    if (current === undefined || itemIndent === undefined) continue
    const field = new RegExp(`^ {${String(itemIndent + 2)}}(id|name):\\s+(.+)$`).exec(line)
    if (field !== null) current[field[1]] = unquote(field[2])
  }
  return rows
}
const expectedRows = new Set()
for (const file of patchFiles) {
  for (const row of insertedRows(readFileSync(file, 'utf8'))) {
    if (typeof row.id !== 'string' || !row.id.startsWith('jx-')) continue
    expectedRows.add(row.id)
    const name = row.name ?? ''
    if (!name.startsWith('./') && !name.startsWith('../')) {
      problems.push(
        `${file} 里的 ${row.id} 写的是 name: '${name}'。按包名写，DSH 会从 $DSH_HOME/profiles/<名>/ 往上找包，`
        + '状态目录不在发行目录里面时找不到。改成相对补丁文件的入口文件路径（scripts/vendor-packages.sh 会自动改写）',
      )
    } else if (!existsSync(resolve(dirname(file), name))) {
      problems.push(`${file} 里的 ${row.id} 指向的文件不存在：${resolve(dirname(file), name)}`)
    }
  }
}

const launcher = join(dist, 'bin', 'jx-dsh')
const scratch = mkdtempSync(join(tmpdir(), 'jx-preflight-'))
try {
  const result = spawnSync('bash', [launcher, '--profile', profile, '--dump-config'], {
    cwd: scratch,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      JX_SKIP_PREFLIGHT: '1',
      JX_DSH_DRY_RUN: '',
      JX_DISTRIBUTION_DIR: dist,
      // 临时的空状态目录：不碰任何真正在用的状态。
      DSH_HOME: join(scratch, 'home'),
      DSH_AGENTS_HOME: join(scratch, 'agents-home'),
      JX_DOCUMENTS_DIR: join(scratch, 'documents'),
    },
  })
  const stderr = result.stderr ?? ''
  if (result.status !== 0) {
    const tail = stderr.split('\n').filter((line) => line !== '' && !line.startsWith('jx-dsh:')).slice(-8).join('\n    ')
    problems.push(`dsh --dump-config 失败（退出码 ${String(result.status)}）：\n    ${tail}`)
  }
  for (const line of stderr.split('\n')) {
    if (/disabling profile plugin row|skipping profile bundle|is incompatible with dsh/.test(line)) {
      problems.push(`DSH 停用了插件：${line.trim()}`)
    }
  }
  if (result.status === 0) {
    const rows = new Map()
    let current
    for (const line of (result.stdout ?? '').split('\n')) {
      const row = /^- id: (\S+)\s*$/.exec(line)
      if (row !== null) {
        current = { disabled: false }
        rows.set(row[1], current)
      } else if (/^\S/.test(line)) {
        current = undefined
      } else if (current !== undefined && /^  disabled: true\s*$/.test(line)) {
        current.disabled = true
      }
    }
    for (const id of expectedRows) {
      if (!rows.has(id)) problems.push(`合成配置里没有 ${id} 这一行`)
      else if (rows.get(id).disabled) problems.push(`${id} 这一行被停用了`)
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

finish(
  `DSH ${dshVersion}；插件 ${plugins.length > 0 ? plugins.join('、') : '无'}；`
  + `加载的行 ${expectedRows.size > 0 ? [...expectedRows].join('、') : '无'}；补丁 ${String(patchFiles.length)} 个`,
)
