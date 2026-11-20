#!/usr/bin/env node
// 量一量上游在「我们要碰的那些文件」上改得多不多。
//
// 背景：本机的 DSH 源码检出（upstream/dsh-ref）一般是浅克隆，看不到历史。这个脚本不克隆仓库，只做两件只读的事：
//   1. 从 GitHub 按标签下载指定文件的原文（raw.githubusercontent.com），相邻两个版本之间用 diff 数增删行；
//   2. 用 GitHub 的目录树接口（每个标签一次请求）拿到全部文件的内容哈希，统计某个目录下每次发布改了多少个文件。
// 下载的文件只当文本比对，不执行。结果和缓存都放在 apps/desktop/.dev/upstream-history/。
//
// 用法：node scripts/upstream-churn.mjs            全部做
//       node scripts/upstream-churn.mjs --no-trees  不调目录树接口（未登录时每小时限 60 次请求）
//
// 输出：.dev/upstream-history/churn.json 和 churn.md

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', '.dev', 'upstream-history')
const REPO = 'deepseek-ai/deepseek-harness'

// 按发布时间排的版本（日期来自 npm 上 @deepseek-ai/dsh 的发布时间）。
const RELEASES = [
  ['0.1.7-rc.2', '2026-09-24'],
  ['0.2.0-rc.1', '2026-09-28'],
  ['0.2.0-rc.2', '2026-09-29'],
  ['0.2.1-alpha.1', '2026-10-03'],
  ['0.2.1-alpha.2', '2026-10-09'],
  ['0.2.1-alpha.3', '2026-10-14'],
  ['0.2.1-alpha.4', '2026-10-15'],
  ['0.2.1-alpha.5', '2026-10-16'],
  ['0.2.1-rc.1', '2026-10-17'],
  ['0.2.1-rc.2', '2026-10-17'],
  ['0.2.1-rc.3', '2026-10-23'],
  ['0.2.1-rc.4', '2026-10-26'],
  ['0.2.1-rc.5', '2026-10-29'],
  ['0.2.2-alpha.2', '2026-10-27'],
  ['0.2.2-alpha.3', '2026-11-03'],
  ['0.2.2-rc.1', '2026-11-04'],
  ['0.2.2-rc.2', '2026-11-12'],
  ['0.2.2-rc.3', '2026-11-13'],
  ['0.2.2-rc.4', '2026-11-17'],
  ['0.2.2-rc.5', '2026-11-18'],
]

// 按我们的升级办法（一次只升到一条小版本线的最后一个 rc），实际要过的是这几步。
const LINE_JUMPS = [
  ['0.1.7-rc.2', '0.2.0-rc.2'],
  ['0.2.0-rc.2', '0.2.1-rc.5'],
  ['0.2.1-rc.5', '0.2.2-rc.5'],
]

// 要看的文件。乙：从源码构建上游桌面壳时要打补丁的文件。甲：薄壳依赖的上游行为所在的文件。
const FILES = {
  乙: [
    'apps/desktop/src/main.ts',
    'apps/desktop/src/locale.ts',
    'apps/desktop/package.json',
    'apps/desktop/scripts/electron-builder-config.mjs',
    'apps/desktop/src/welcome-window.ts',
    'apps/desktop/src/welcome-backend.ts',
    'apps/desktop/src/client/WelcomePage.tsx',
    'apps/desktop/src/update-coordinator.ts',
    'apps/desktop/src/mandatory-update-policy.ts',
    'apps/desktop/src/command-management.ts',
    'apps/desktop/src/command-installation.ts',
    'apps/desktop/src/release.ts',
    'apps/desktop/src/runtime-tree.ts',
    'apps/desktop/src/client-metadata.ts',
    'apps/desktop/src/tray.ts',
    'apps/desktop/src/quit-confirmation.ts',
    'apps/desktop/renderer/welcome.html',
    'apps/desktop/installer/locales/zh_CN.json',
    'apps/desktop/scripts/package-target.ts',
    'apps/desktop/scripts/desktop-package-environment.mjs',
    'apps/desktop/scripts/desktop-build-version.mjs',
    'apps/desktop/scripts/smoke-packaged-runtime.ts',
    'apps/desktop/src/welcome-api.ts',
    'apps/desktop/cli/dsh',
    'apps/desktop-host/src/index.ts',
  ],
  甲: [
    'packages/bundle/web-app/src/index.ts',
    'packages/bundle/web-app/src/startup.ts',
    'packages/bundle/web-app/cordis.patch.yml',
    'packages/client/connection/src/browser-auth.ts',
    'apps/cli/src/args.ts',
    'apps/cli/src/profile-boot.ts',
    'packages/api/workspace-controller/src/index.ts',
    'packages/api/workspace-controller/src/default-directory.ts',
    'packages/util/home-paths/src/index.ts',
    'packages/boot/app-boot/src/profile-context.ts',
  ],
}

// 乙的最小补丁集要改的那些行（「落点」）。needle 是那一行里的特征文字。
// 对每个落点，看它连同上下各 3 行（补丁的上下文）在每次升级里有没有原样保留：
// 没保留，就是那次升级里这个补丁打不上、要人重新对一遍。
const ANCHORS = [
  ['关于面板的应用名', 'apps/desktop/src/main.ts', "applicationName: 'DeepSeek Harness'"],
  ['登记 dsh:// 协议（运行时）', 'apps/desktop/src/main.ts', "app.setAsDefaultProtocolClient('dsh')"],
  ['处理 dsh://open', 'apps/desktop/src/main.ts', 'dsh://open'],
  ['应用名 productName', 'apps/desktop/scripts/electron-builder-config.mjs', "productName: 'DeepSeek Harness'"],
  ['声明 dsh:// 协议（打包）', 'apps/desktop/scripts/electron-builder-config.mjs', "schemes: ['dsh']"],
  ['安装包文件名', 'apps/desktop/scripts/electron-builder-config.mjs', 'artifactName: `deepseek-harness-'],
  ['麦克风用途说明', 'apps/desktop/scripts/electron-builder-config.mjs', 'NSMicrophoneUsageDescription'],
  ['未签名构建写死的 appId', 'apps/desktop/scripts/desktop-package-environment.mjs', "DSH_DESKTOP_APP_ID: 'com.deepseek.harness'"],
  ['构建版本号必须续写 DSH 版本', 'apps/desktop/scripts/desktop-build-version.mjs', 'must extend product version'],
  ['欢迎窗口的出现条件', 'apps/desktop/src/welcome-api.ts', 'return !authentication.loggedIn && !authentication.hasApiKey'],
  ['冒烟脚本里的应用包名', 'apps/desktop/scripts/smoke-packaged-runtime.ts', 'DeepSeek Harness'],
  ['随包命令行里的可执行文件名', 'apps/desktop/cli/dsh', 'MacOS/DeepSeek Harness'],
  ['打印安装包路径', 'apps/desktop/scripts/package-target.ts', 'deepseek-harness-'],
  ['文案里的产品名', 'apps/desktop/src/locale.ts', 'DeepSeek Harness'],
]

// 甲（薄壳）依赖的上游行为所在的那几行。看的是：这个依赖点从哪个版本起有、此后有没有消失过。
const CONTRACTS = [
  ['就绪行 `dsh web: <地址>`', 'packages/bundle/web-app/src/index.ts', 'console.log(`dsh web: ${'],
  ['令牌的查询参数名 token', 'packages/client/connection/src/browser-auth.ts', "TOKEN_QUERY = 'token'"],
  ['认证 Cookie 名的前缀 dsh-auth-', 'packages/client/connection/src/browser-auth.ts', "COOKIE_PREFIX = 'dsh-auth-'"],
  ['换到 Cookie 后回 303', 'packages/client/connection/src/browser-auth.ts', 'res.writeHead(303'],
  ['参数 --no-open', 'packages/bundle/web-app/src/startup.ts', "'--no-open'"],
  ['参数 --host', 'packages/bundle/web-app/src/startup.ts', "'--host <host>'"],
  ['参数 --port', 'packages/bundle/web-app/src/startup.ts', "'--port <port>'"],
  ['参数 --patch（可重复）', 'apps/cli/src/args.ts', '--patch a.yml --patch b.yml'],
  ['命令行拒绝 desktop 这个 profile 名', 'apps/cli/src/args.ts', 'function rejectElectronProfile'],
  ['配置键 documentsDirectory', 'packages/api/workspace-controller/src/index.ts', 'documentsDirectory'],
  ['环境变量 DSH_HOME', 'packages/util/home-paths/src/index.ts', "'DSH_HOME'"],
  ['环境变量 DSH_AGENTS_HOME', 'packages/util/home-paths/src/index.ts', "'DSH_AGENTS_HOME'"],
  ['环境变量 DSH_TELEMETRY_DISABLED', 'packages/boot/app-boot/src/profile-context.ts', 'DSH_TELEMETRY_DISABLED'],
]

// 目录树接口统计这些目录下「每次发布改了多少个文件」。
const TREE_DIRS = ['apps/desktop/', 'apps/desktop/src/', 'apps/desktop/scripts/', 'apps/desktop-host/', 'apps/cli/src/', 'packages/bundle/web-app/', 'packages/client/connection/src/']

const tag = (version) => `dsh-v${version}`

function curl(url, file) {
  mkdirSync(dirname(file), { recursive: true })
  try {
    execFileSync('curl', ['-fsSL', '--retry', '2', '--max-time', '60', '-o', file, url], { stdio: ['ignore', 'ignore', 'pipe'] })
    return true
  } catch (error) {
    const message = String(error.stderr ?? error.message)
    if (/\b404\b/.test(message)) return false
    throw new Error(`下载失败 ${url}: ${message.trim()}`)
  }
}

/** 下载某个版本的一个文件；那个版本里没有这个文件时返回 undefined。 */
function fetchFile(version, path) {
  const file = join(OUT, 'files', tag(version), path)
  const missing = `${file}.missing`
  if (existsSync(file)) return file
  if (existsSync(missing)) return undefined
  if (curl(`https://raw.githubusercontent.com/${REPO}/${tag(version)}/${path}`, file)) return file
  writeFileSync(missing, '')
  return undefined
}

/** 两个文件之间增删了多少行。任一边不存在时按整文件增或删算。 */
function diffStat(a, b) {
  const lines = (file) => (file === undefined ? 0 : readFileSync(file, 'utf8').split('\n').length - 1)
  if (a === undefined && b === undefined) return { added: 0, removed: 0, existed: false }
  if (a === undefined) return { added: lines(b), removed: 0, existed: true, created: true }
  if (b === undefined) return { added: 0, removed: lines(a), existed: true, deleted: true }
  let out = ''
  try {
    out = execFileSync('git', ['diff', '--no-index', '--numstat', '--', a, b], { encoding: 'utf8' })
  } catch (error) {
    // 有差异时 git diff --no-index 的退出码是 1，输出在 stdout。
    out = String(error.stdout ?? '')
  }
  const match = /^(\d+)\t(\d+)\t/m.exec(out)
  return match === null ? { added: 0, removed: 0, existed: true } : { added: Number(match[1]), removed: Number(match[2]), existed: true }
}

function fileChurn(pairs) {
  const result = {}
  for (const [route, paths] of Object.entries(FILES)) {
    result[route] = {}
    for (const path of paths) {
      const steps = pairs.map(([from, to]) => ({ from, to, ...diffStat(fetchFile(from, path), fetchFile(to, path)) }))
      const lines = (() => {
        const file = fetchFile(RELEASES.at(-1)[0], path)
        return file === undefined ? 0 : readFileSync(file, 'utf8').split('\n').length - 1
      })()
      result[route][path] = {
        linesNow: lines,
        steps,
        changedSteps: steps.filter((step) => step.added + step.removed > 0).length,
        totalAdded: steps.reduce((sum, step) => sum + step.added, 0),
        totalRemoved: steps.reduce((sum, step) => sum + step.removed, 0),
      }
    }
  }
  return result
}

/** 一个文件里含特征文字的每一行，连同上下各 3 行。 */
function windowsOf(file, needle) {
  if (file === undefined) return { text: '', windows: [] }
  const lines = readFileSync(file, 'utf8').split('\n')
  const windows = []
  lines.forEach((line, index) => {
    if (line.includes(needle)) windows.push(lines.slice(Math.max(0, index - 3), index + 4).join('\n'))
  })
  return { text: `\n${lines.join('\n')}\n`, windows }
}

/** 每个落点在每次升级里：升级前有几处、升级后有几处、其中几处连上下文原样保留。 */
function anchorHistory(pairs) {
  return ANCHORS.map(([label, path, needle]) => {
    const steps = pairs.map(([from, to]) => {
      const before = windowsOf(fetchFile(from, path), needle)
      const after = windowsOf(fetchFile(to, path), needle)
      const survived = before.windows.filter((window) => after.text.includes(`\n${window}\n`)).length
      return { from, to, before: before.windows.length, after: after.windows.length, survived }
    })
    return {
      label,
      path,
      needle,
      now: windowsOf(fetchFile(RELEASES.at(-1)[0], path), needle).windows.length,
      steps,
      // 这次升级里要人动手：原有的落点上下文变了，或者多出了新的落点。
      brokenSteps: steps.filter((step) => step.survived < step.before || step.after > step.before).length,
      brokenHunks: steps.reduce((sum, step) => sum + (step.before - step.survived), 0),
      addedHunks: steps.reduce((sum, step) => sum + Math.max(0, step.after - step.before), 0),
    }
  })
}

/** 甲的每个依赖点在哪些版本里有。 */
function contractHistory() {
  return CONTRACTS.map(([label, path, needle]) => {
    const present = RELEASES.map(([version]) => {
      const file = fetchFile(version, path)
      return file !== undefined && readFileSync(file, 'utf8').includes(needle)
    })
    const first = present.indexOf(true)
    return {
      label,
      path,
      needle,
      since: first < 0 ? null : RELEASES[first][0],
      // 出现之后有没有哪个版本里又找不到了（找不到说明实现改过，薄壳要跟着看）。
      gaps: first < 0 ? [] : RELEASES.slice(first).filter((_, index) => !present[first + index]).map(([version]) => version),
      presentNow: present.at(-1),
    }
  })
}

/** patches/ 下写好的样例补丁，拿到每个历史版本上试打（git apply --check：上下文要原样对上，行号可以偏移）。 */
function samplePatchHistory() {
  const patchDir = join(HERE, '..', '..', '..', 'patches')
  if (!existsSync(patchDir)) return []
  return readdirSync(patchDir).filter((name) => /^desktop-.*\.patch$/.test(name)).sort().map((name) => {
    const patch = join(patchDir, name)
    const targets = [...readFileSync(patch, 'utf8').matchAll(/^\+\+\+ b\/(.+)$/gm)].map((match) => match[1])
    const versions = RELEASES.map(([version]) => {
      const tree = join(OUT, 'patch-try', name, tag(version))
      let missing = false
      for (const target of targets) {
        const source = fetchFile(version, target)
        if (source === undefined) { missing = true; continue }
        mkdirSync(dirname(join(tree, target)), { recursive: true })
        copyFileSync(source, join(tree, target))
      }
      if (missing) return { version, applies: false, reason: '文件不存在' }
      try {
        execFileSync('git', ['apply', '--check', patch], { cwd: tree, stdio: ['ignore', 'ignore', 'pipe'] })
        return { version, applies: true }
      } catch {
        return { version, applies: false, reason: '上下文对不上' }
      }
    })
    return { name, targets, versions, appliesTo: versions.filter((entry) => entry.applies).length }
  })
}

/** 某个标签的全部文件路径 → 内容哈希。 */
function fetchTree(version) {
  const file = join(OUT, 'trees', `${tag(version)}.json`)
  if (!existsSync(file)) {
    curl(`https://api.github.com/repos/${REPO}/git/trees/${tag(version)}?recursive=1`, file)
  }
  const data = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(data.tree)) throw new Error(`目录树接口没有返回文件列表：${JSON.stringify(data).slice(0, 200)}`)
  return { truncated: data.truncated === true, blobs: new Map(data.tree.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry.sha])) }
}

function treeChurn(pairs) {
  const trees = new Map()
  const get = (version) => {
    if (!trees.has(version)) trees.set(version, fetchTree(version))
    return trees.get(version)
  }
  return pairs.map(([from, to]) => {
    const a = get(from)
    const b = get(to)
    const dirs = {}
    for (const dir of TREE_DIRS) {
      let changed = 0, added = 0, removed = 0, total = 0
      for (const [path, sha] of b.blobs) {
        if (!path.startsWith(dir)) continue
        total++
        if (!a.blobs.has(path)) added++
        else if (a.blobs.get(path) !== sha) changed++
      }
      for (const path of a.blobs.keys()) if (path.startsWith(dir) && !b.blobs.has(path)) removed++
      dirs[dir] = { filesNow: total, changed, added, removed }
    }
    return { from, to, truncated: a.truncated || b.truncated, dirs }
  })
}

const consecutive = RELEASES.slice(1).map(([version], index) => [RELEASES[index][0], version])
const withTrees = !process.argv.includes('--no-trees')

const result = {
  generatedAt: new Date().toISOString(),
  repo: REPO,
  releases: RELEASES,
  consecutive: { files: fileChurn(consecutive), ...(withTrees ? { trees: treeChurn(consecutive) } : {}) },
  lineJumps: { files: fileChurn(LINE_JUMPS), ...(withTrees ? { trees: treeChurn(LINE_JUMPS) } : {}) },
  anchors: { consecutive: anchorHistory(consecutive), lineJumps: anchorHistory(LINE_JUMPS) },
  samplePatches: samplePatchHistory(),
  contracts: contractHistory(),
}
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'churn.json'), JSON.stringify(result, null, 2) + '\n')

// ── 一份给人看的摘要 ──
const md = []
md.push('# 上游改动频率（自动生成，见 scripts/upstream-churn.mjs）', '')
md.push(`统计范围：${RELEASES[0][0]}（${RELEASES[0][1]}）到 ${RELEASES.at(-1)[0]}（${RELEASES.at(-1)[1]}），共 ${RELEASES.length} 个版本、${consecutive.length} 次相邻发布。`, '')
for (const route of Object.keys(FILES)) {
  md.push(`## ${route}：相邻版本之间`, '', '| 文件 | 现有行数 | 有改动的发布次数 | 累计增 | 累计删 |', '|---|---:|---:|---:|---:|')
  for (const [path, stat] of Object.entries(result.consecutive.files[route])) {
    md.push(`| \`${path}\` | ${stat.linesNow} | ${stat.changedSteps} / ${consecutive.length} | ${stat.totalAdded} | ${stat.totalRemoved} |`)
  }
  md.push('')
  md.push(`## ${route}：按小版本线跳（${LINE_JUMPS.map(([a, b]) => `${a} → ${b}`).join('；')}）`, '', `| 文件 | ${LINE_JUMPS.map(([a, b]) => `${a} → ${b}`).join(' | ')} |`, `|---|${LINE_JUMPS.map(() => '---:').join('|')}|`)
  for (const [path, stat] of Object.entries(result.lineJumps.files[route])) {
    md.push(`| \`${path}\` | ${stat.steps.map((step) => (step.created ? `新增 ${step.added}` : step.existed ? `+${step.added} −${step.removed}` : '不存在')).join(' | ')} |`)
  }
  md.push('')
}
md.push('## 乙：补丁落点在升级里保不保得住', '')
md.push('「断」的意思：那次升级里，这个落点连同上下各 3 行没有原样保留（补丁打不上，要人重新对），或者多出了新的落点（要补新的改动）。', '')
md.push(`| 落点 | 文件 | 现有几处 | ${consecutive.length} 次相邻升级里断了几次 | 累计重对几处 | 累计新增几处 | 按线跳 ${LINE_JUMPS.length} 次里断了几次 |`, '|---|---|---:|---:|---:|---:|---:|')
result.anchors.consecutive.forEach((anchor, index) => {
  const jumps = result.anchors.lineJumps[index]
  md.push(`| ${anchor.label} | \`${anchor.path}\` | ${anchor.now} | ${anchor.brokenSteps} | ${anchor.brokenHunks} | ${anchor.addedHunks} | ${jumps.brokenSteps}（${jumps.steps.map((step) => (step.survived < step.before || step.after > step.before ? '断' : step.before === 0 ? '无' : '保')).join('、')}） |`)
})
md.push('')
if (result.samplePatches.length > 0) {
  md.push('## 乙：写好的样例补丁拿到历史版本上试打', '', '补丁是照最新版本写的。能打上的版本越少，说明这个落点附近改得越勤。', '')
  for (const sample of result.samplePatches) {
    md.push(`- \`${sample.name}\`：${RELEASES.length} 个版本里能干净打上 ${sample.appliesTo} 个。打不上的：${sample.versions.filter((entry) => !entry.applies).map((entry) => `${entry.version}（${entry.reason}）`).join('、') || '无'}`)
  }
  md.push('')
}
md.push('## 甲：薄壳的依赖点从哪个版本起就有', '', `统计的最早版本是 ${RELEASES[0][0]}，「从它起就有」的意思是至少这么久，可能更早。`, '', '| 依赖点 | 文件 | 从哪个版本起有 | 此后消失过吗 |', '|---|---|---|---|')
for (const contract of result.contracts) {
  md.push(`| ${contract.label} | \`${contract.path}\` | ${contract.since ?? '现在也没找到'} | ${contract.gaps.length === 0 ? '没有' : contract.gaps.join('、')} |`)
}
md.push('')
if (withTrees) {
  md.push('## 目录级：每次发布改了多少个文件', '')
  for (const dir of TREE_DIRS) {
    const rows = result.consecutive.trees.map((step) => step.dirs[dir])
    const touched = rows.filter((row) => row.changed + row.added + row.removed > 0).length
    const sum = (key) => rows.reduce((total, row) => total + row[key], 0)
    md.push(`- \`${dir}\`：现有 ${rows.at(-1).filesNow} 个文件；${consecutive.length} 次发布里有 ${touched} 次动过它；累计改 ${sum('changed')}、增 ${sum('added')}、删 ${sum('removed')} 个文件次。`)
  }
  md.push('', '按小版本线跳：', '')
  for (const step of result.lineJumps.trees) {
    md.push(`- ${step.from} → ${step.to}：` + TREE_DIRS.map((dir) => `\`${dir}\` 改 ${step.dirs[dir].changed} 增 ${step.dirs[dir].added} 删 ${step.dirs[dir].removed}`).join('；'))
  }
  if (result.consecutive.trees.some((step) => step.truncated)) md.push('', '注意：目录树接口的返回被截断过，目录级数字可能偏小。')
  md.push('')
}
writeFileSync(join(OUT, 'churn.md'), md.join('\n'))
console.log(md.join('\n'))
