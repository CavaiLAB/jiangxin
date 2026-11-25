/**
 * 组件收不到 ref 就失败。
 *
 * shadcn 生成的组件按 React 19 写（ref 是普通属性，不包 forwardRef），在 DSH 共享的 React 18.3.1 上收不到 ref，
 * 弹层会错位；而类型检查是 0 个错误（React 18 的 ComponentProps<"input"> 本身带着 ref）。所以另设这条检查，
 * 规则见 tools/react18-refs.mjs。修法：pnpm run ui:adapt（自动改成 forwardRef），或者照报错手工改。
 */
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  applyEdits, checkPackage, findMissingRefs, formatFinding, planForwardRefFix, programFromFiles,
} from '../tools/react18-refs.mjs'

const kitDir = fileURLToPath(new URL('..', import.meta.url))
const fixtures = join(kitDir, 'tests', 'fixtures', 'react18-refs')

/** 一组文件的发现，按「组件 种类」列出来。 */
function summarize(files: string[]): string[] {
  return findMissingRefs(programFromFiles(files)).map(f => `${f.component} ${f.kind}`).sort()
}

test('src/ 下的组件在 React 18 上都收得到 ref', () => {
  const findings = checkPackage(join(kitDir, 'tsconfig.json'))
  assert.deepEqual(findings.map(f => formatFinding(f, kitDir)), [], '有组件收不到 ref。跑 pnpm run ui:adapt 自动改，或者照上面的说明手工改')
})

test('检查本身：认得出收不到 ref 的几种写法', () => {
  assert.deepEqual(summarize([join(fixtures, 'bad.tsx')]), [
    'ArrowButton not-forwarded',
    'Destructured not-forwarded',
    'Destructured ref-in-props',
    'Forgot ref-not-passed',
    'PlainInput not-forwarded',
    'Wrapper not-forwarded',
  ])
})

test('检查本身：没问题的写法不报', () => {
  assert.deepEqual(summarize([join(fixtures, 'good.tsx')]), [])
})

test('适配脚本的改法：改完以后不再报，元素类型写得出来', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jx-react18-refs-'))
  try {
    // 临时目录里要解析得到 react 的类型，否则取不到元素类型。
    symlinkSync(join(kitDir, 'node_modules'), join(dir, 'node_modules'), 'dir')
    const file = join(dir, 'bad.tsx')
    copyFileSync(join(fixtures, 'bad.tsx'), file)
    const findings = findMissingRefs(programFromFiles([file]))
    const edits = findings.flatMap(f => planForwardRefFix(f)?.edits ?? [])
    writeFileSync(file, applyEdits(readFileSync(file, 'utf8'), edits))
    const fixed = readFileSync(file, 'utf8')
    assert.match(fixed, /export const PlainInput = React\.forwardRef\(function PlainInput\(\{ className, \.\.\.props \}: React\.ComponentProps<'input'>, ref: React\.ForwardedRef<HTMLInputElement>\)/)
    assert.match(fixed, /<input ref=\{ref\} className=\{className\} \{\.\.\.props\} \/>/)
    assert.match(fixed, /export const ArrowButton = React\.forwardRef\(\(\{ children, \.\.\.props \}: React\.ComponentProps<'button'>, ref: React\.ForwardedRef<HTMLButtonElement>\) =>/)
    // 解构了 ref 的、已经 forwardRef 但没交出去的，脚本不改，留给人。
    assert.deepEqual(summarize([file]), ['Destructured not-forwarded', 'Destructured ref-in-props', 'Forgot ref-not-passed'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
