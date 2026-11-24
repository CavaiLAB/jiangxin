#!/usr/bin/env node
// 检查 shell 脚本里「$名字 后面紧跟中文或全角标点」的写法，比如 echo "进程 $pid，日志在 $dir/"。
//
// 为什么要查：macOS 上的 bash 在 UTF-8 的语言环境下（macOS 的终端默认就是），会把紧跟在 $名字 后面那个字的
// 第一个字节读进变量名。开了 set -u 的脚本报「unbound variable」退出；没开的把变量当成空的，后面的字变成乱码。
// 没设语言的环境里不出现，所以在那种环境里跑通了不说明问题。写成 ${名字} 就没有这回事。
//
// 用法：node tools/check-shell-vars.mjs [文件...]
//   不给文件：查仓库里已跟踪的 shell 脚本，认扩展名 .sh，也认第一行 #! 指向 sh、bash、zsh 的文件。
//   给了文件：只查这些文件。
//   查到了逐处列出，以 1 退出；没有以 0 退出。
//
// 只用 Node 自带模块。整行注释和 \$ 不算。引号不解析：单引号里的也会报出来，把那句话改写一下就行。

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// 按字节匹配：名字后面第一个字节 ≥ 0x80，就是紧跟着一个非 ASCII 字符。
const PATTERN = /(?<!\\)\$([A-Za-z_][A-Za-z0-9_]*)(?=[\x80-\xff])/g
const SHEBANG = /^#!.*\b(?:ba|z|da|k)?sh\b/

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) {
    console.error('check-shell-vars: 列不出已跟踪的文件。要在 git 检出里跑，或者把要查的文件写在参数里。')
    process.exit(2)
  }
  return result.stdout.split('\0').filter(Boolean).map((file) => join(ROOT, file))
}

function isShellScript(path, bytes) {
  if (path.endsWith('.sh')) return true
  const firstLine = bytes.subarray(0, 200).toString('latin1').split('\n', 1)[0]
  return SHEBANG.test(firstLine)
}

const explicit = process.argv.slice(2)
const candidates = explicit.length > 0 ? explicit.map((file) => resolve(file)) : trackedFiles()

let checked = 0
const findings = []
for (const path of candidates) {
  let bytes
  try {
    bytes = readFileSync(path)
  } catch (error) {
    if (explicit.length > 0) {
      console.error(`check-shell-vars: 读不了 ${path}：${error.message}`)
      process.exit(2)
    }
    continue // 已跟踪但工作区里没有（删了还没提交），或者不是普通文件
  }
  if (explicit.length === 0 && !isShellScript(path, bytes)) continue
  checked += 1
  bytes.toString('latin1').split('\n').forEach((line, index) => {
    if (/^\s*#/.test(line)) return
    for (const match of line.matchAll(PATTERN)) {
      findings.push({ path, line: index + 1, name: match[1], text: Buffer.from(line, 'latin1').toString('utf8').trim() })
    }
  })
}

if (findings.length === 0) {
  console.log(`check-shell-vars: 查了 ${checked} 个 shell 脚本，没有「$名字 后面紧跟非 ASCII 字符」的写法。`)
  process.exit(0)
}
for (const finding of findings) {
  console.error(`${relative(process.cwd(), finding.path)}:${finding.line}: $${finding.name} 后面紧跟非 ASCII 字符，写成 \${${finding.name}}`)
  console.error(`    ${finding.text}`)
}
console.error(`check-shell-vars: ${findings.length} 处要改，原因见这个文件开头的说明。`)
process.exit(1)
