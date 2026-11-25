/**
 * 构建脚本编 Tailwind：在临时目录里放一个最小的插件包，用组件库的一个组件，再写一个自己的 jx: 类名，
 * 构建以后 lib/client.js 里应当有两者的样式，有那段小重置，没有 Tailwind 的全局重置，工具类不分层。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const kitDir = fileURLToPath(new URL('..', import.meta.url))

/**
 * 产物里注入的全部样式。每段是 const css='…'（esbuild 挑转义最少的引号，空白压掉了），
 * 字面量是构建脚本自己生成的，直接求值还原成字符串。
 */
function injectedCss(bundle: string): string {
  const literals = [...bundle.matchAll(/\bcss\d*=('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g)].map(m => m[1] ?? "''")
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- 只求值上面这一个字符串字面量
  return literals.map(literal => new Function(`return ${literal}`)() as string).join('\n')
}

test('jx-dsh-plugin-build 把组件库和插件自己的 jx: 类名编进 lib/client.js', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jx-ui-kit-tailwind-'))
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: '@jx/fixture-tailwind', version: '0.0.0', private: true, type: 'module', dsh: { client: { platform: 'web' } },
    }))
    mkdirSync(join(dir, 'src', 'client'), { recursive: true })
    writeFileSync(join(dir, 'src', 'client', 'index.tsx'), [
      `import { Textarea } from ${JSON.stringify(join(kitDir, 'src', 'ui', 'textarea.tsx'))}`,
      `export const name = 'fixture-tailwind'`,
      `export function apply(): void {}`,
      `export function View() { return <div className="jx:w-[123px]"><Textarea /></div> }`,
    ].join('\n'))
    execFileSync(process.execPath, [join(kitDir, 'tools', 'build-plugin.mjs')], { cwd: dir, stdio: 'pipe' })
    const bundle = readFileSync(join(dir, 'lib', 'client.js'), 'utf8')
    const css = injectedCss(bundle)
    // 插件自己写的类名
    assert.match(css, /\.jx\\:w-\\\[123px\\\]\{width:123px\}/)
    // 组件库组件里的类名
    assert.match(css, /\.jx\\:field-sizing-content\{field-sizing:content\}/)
    // 语义色指到 DSH 的变量
    assert.match(css, /var\(--dsw-alias-border-l4\)/)
    // 小重置在，全局重置不在，工具类不分层
    assert.match(css, /:where\(\[class\*=(?:"jx:"|jx\\:)\]\)[^{]*\{box-sizing:border-box;border:0 solid;margin:0;padding:0\}/)
    // 正圆写回 corner-shape: round
    assert.match(css, /\[class\*=(?:"jx:"|jx\\:)\]\[class\*=(?:"rounded-full"|rounded-full)\]\{corner-shape:round\}/)
    assert.doesNotMatch(css, /html,:host\{/)
    assert.doesNotMatch(css, /@layer (base|utilities)\b/)
    // 样式标签的 id 用「包名/包内路径」，不带本机路径
    assert.match(bundle, /"@jx\/fixture-tailwind\/@jx\/ui-kit\/src\/styles\/jx\.tailwind\.css"/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
