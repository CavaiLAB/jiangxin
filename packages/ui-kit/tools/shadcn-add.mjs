#!/usr/bin/env node
/**
 * 在这个包里用 shadcn 命令行加组件，加完自动做适配。
 *
 * 用法：pnpm run ui:add <组件名…> [--overwrite]      例：pnpm run ui:add tabs
 *
 * 做三件事：
 *   1. 在包的根目录跑 `pnpm dlx shadcn@<SHADCN_VERSION> add <组件名…> --yes`。components.json 在根目录：风格 base-nova、
 *      类名前缀 jx、文件生成到 src/ui/。命令行要联网读 shadcn 的组件清单。
 *      shadcn 加组件时会对它要的依赖跑一次 `pnpm add`，不带版本：已有的依赖会被顶到最新、写成 ^ 范围，和这个包
 *      「依赖写精确版本」的规矩冲突。所以这里在 PATH 前面放一组替身（pnpm、npm、yarn、bun），把安装这一步拦下来，
 *      只记下它要了什么；别的命令照常交给真的 pnpm。
 *   2. 跑 tools/adapt-generated.mjs，做生成以后的适配（不用点名，src/ui/ 下全部过一遍，跑多少遍都一样）。
 *   3. 打印它要了哪些依赖、其中哪些 package.json 里还没有、生成的代码有没有直接引用；样式入口有没有被它改过。
 *      缺的依赖由人按精确版本补：pnpm add -E <名字>@<版本>，版本挑发布两周以上的。
 *
 * 替身是 sh 脚本，只在 macOS 和 Linux 上能用。
 */
import { spawnSync } from 'node:child_process'
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 用哪个版本的 shadcn 命令行。升级时先在临时目录里试，对比生成结果和 src/ui/ 的差别。 */
const SHADCN_VERSION = '4.23.0'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** PATH 里找可执行文件。 */
function which(name) {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, name)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch { /* 找下一个 */ }
  }
  return undefined
}

/** 包名去掉版本：react-day-picker@latest → react-day-picker，@base-ui/react@1.9.0 → @base-ui/react。 */
function packageName(spec) {
  const at = spec.indexOf('@', spec.startsWith('@') ? 1 : 0)
  return at === -1 ? spec : spec.slice(0, at)
}

/** src/ 下所有源码里出现过的裸模块名。 */
function importedPackages() {
  const found = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(tsx?|mts)$/.test(entry.name)) {
        for (const m of readFileSync(path, 'utf8').matchAll(/\bfrom\s+["']([^"'.][^"']*)["']/g)) {
          const spec = m[1]
          found.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0])
        }
      }
    }
  }
  walk(join(packageDir, 'src'))
  return found
}

function main() {
  const args = process.argv.slice(2)
  const components = args.filter(a => !a.startsWith('-'))
  if (components.length === 0) {
    console.error('用法：pnpm run ui:add <组件名…> [--overwrite]')
    process.exitCode = 2
    return
  }
  const realPnpm = which('pnpm')
  if (realPnpm === undefined) throw new Error('PATH 里找不到 pnpm')

  const manifest = JSON.parse(readFileSync(join(packageDir, 'components.json'), 'utf8'))
  const cssEntry = join(packageDir, manifest.tailwind.css)
  const cssBefore = readFileSync(cssEntry, 'utf8')

  const shimDir = mkdtempSync(join(tmpdir(), 'jx-shadcn-add-'))
  const log = join(shimDir, 'requested.txt')
  try {
    for (const pm of ['pnpm', 'npm', 'yarn', 'bun']) {
      const real = pm === 'pnpm' ? realPnpm : which(pm)
      const passthrough = real === undefined ? `echo "shadcn-add：PATH 里没有 ${pm}" >&2; exit 127` : `exec "${real}" "$@"`
      writeFileSync(join(shimDir, pm), [
        '#!/bin/sh',
        '# shadcn-add 的替身：把依赖安装拦下来，只记下要了什么。',
        `case "$1" in add|install|i) echo "${pm} $*" >> "${log}"; exit 0;; esac`,
        passthrough,
        '',
      ].join('\n'), { mode: 0o755 })
    }
    const cliArgs = ['dlx', `shadcn@${SHADCN_VERSION}`, 'add', ...components, '--yes', ...args.filter(a => a === '--overwrite')]
    console.log(`shadcn-add：pnpm ${cliArgs.join(' ')}`)
    const cli = spawnSync(realPnpm, cliArgs, {
      cwd: packageDir,
      stdio: 'inherit',
      env: { ...process.env, PATH: `${shimDir}${delimiter}${process.env.PATH ?? ''}` },
    })
    if (cli.status !== 0) throw new Error(`shadcn 命令行退出码 ${cli.status}`)

    console.log('\nshadcn-add：适配')
    const adapt = spawnSync(process.execPath, [join(packageDir, 'tools', 'adapt-generated.mjs')], { cwd: packageDir, stdio: 'inherit' })

    const requested = existsSync(log)
      ? readFileSync(log, 'utf8').split('\n').flatMap(line => line.split(/\s+/).slice(2)).filter(s => s !== '' && s !== '--' && !s.startsWith('-'))
      : []
    const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
    const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
    const imported = importedPackages()
    console.log('\nshadcn-add：命令行要装的依赖（没有真装）')
    if (requested.length === 0) console.log('  （没有）')
    for (const spec of requested) {
      const name = packageName(spec)
      const state = declared.has(name) ? '已有' : imported.has(name) ? '缺，生成的代码直接引用了它：pnpm add -E <名字>@<版本>' : '缺，但生成的代码没有直接引用，可以不加'
      console.log(`  ${spec}：${state}`)
    }
    if (readFileSync(cssEntry, 'utf8') !== cssBefore) {
      console.log(`\nshadcn-add：命令行改了样式入口 ${manifest.tailwind.css}，用 git diff 看一下：它加的颜色变量要换成 DSH 的 --dsw-* 变量，用不到的删掉`)
    }
    if (adapt.status !== 0) process.exitCode = adapt.status ?? 1
  } finally {
    rmSync(shimDir, { recursive: true, force: true })
  }
}

main()
