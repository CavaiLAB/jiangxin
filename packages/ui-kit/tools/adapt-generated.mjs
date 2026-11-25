#!/usr/bin/env node
/**
 * shadcn 命令行生成的组件，放进 DSH 之前要过的适配。机械的部分全在这里，可以反复跑，跑第二遍不会再改。
 *
 * 用法：node tools/adapt-generated.mjs [文件…]      不给文件就处理 src/ui/ 下全部 .tsx
 *       （pnpm run ui:add 加完组件会自动跑一遍）
 *
 * 做的事（原因都在 DSH 里实测过，见 README「加一个组件怎么做」）：
 *   1. 去掉 "use client"（不是服务端渲染的项目，components.json 里 rsc 是 false，命令行没去干净）。
 *   2. 别名改成相对路径：生成的代码写 @ui-kit/…（components.json 的 aliases），换成带扩展名的相对路径。
 *      这个包是源码库，使用方直接打包它的源码，用不了这个包自己 tsconfig 里的别名。
 *   3. 弹层的层级：z-50 → z-[1100]，和 DSH 的浮层菜单同一层（DSH 的弹窗是 1000，原来的 50 放进弹窗就看不见）。
 *   4. 圆角变量：类名里写的 var(--radius-md) 这类不带前缀的变量，换成 DSH 的 var(--dsw-radius-md)；var(--radius) 换成
 *      var(--dsw-radius-md)。加了 jx: 前缀以后 Tailwind 不定义这些不带前缀的名字，原样留着小按钮的圆角会变成 0。
 *   5. 去掉命令行加前缀时留下的空 jx:，给漏了前缀的 rtl: 补上 jx:。
 *   6. 弹层落在 DSH 弹窗里面：每个 *.Portal 加 container={portalContainer}，从 src/lib/portal-container.tsx 取。
 *   7. React 18 的 ref：把 props 交给能收 ref 的元素的函数组件，改成 forwardRef 并把 ref 交过去
 *      （规则见 tools/react18-refs.mjs，pnpm run test 里有同一条检查）。不用点名，全部自动找。
 *   8. 每个组件文件引入样式入口 src/styles/jx.tailwind.css。插件用到哪个组件，构建时就带上 Tailwind 编出来的样式；
 *      只用数据表格这类手写组件的插件不会被塞进 Tailwind 的样式。
 *
 * 改不了的地方打印出来，退出码 1，留给人改：比如泛型组件、元素上已经有 ref、类名里引用了不带前缀的语义色变量。
 * 尺寸、圆角、颜色调到和 DSH 一样不在这里，那是逐个组件的手工活（见 README）。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { applyEdits, findMissingRefs, formatFinding, planForwardRefFix, programFromTsconfig } from './react18-refs.mjs'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(packageDir, 'src')
const ALIAS = '@ui-kit/'
const PORTAL_CONTAINER = join(srcDir, 'lib', 'portal-container.tsx')
const TAILWIND_ENTRY = join(srcDir, 'styles', 'jx.tailwind.css')
/** shadcn 的语义色。类名里直接 var(--primary) 这样引用的，加前缀以后没人定义，要手工换成 DSH 的变量。 */
const SEMANTIC_VARS = /var\(--(background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring)(-foreground)?\)/g

const toPosix = p => p.split(sep).join('/')

/** 相对 from 所在目录、带扩展名的导入路径。 */
function importPath(fromFile, targetFile) {
  let rel = toPosix(relative(dirname(fromFile), targetFile))
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel
}

/** @ui-kit/x/y → src/x/y(.tsx|.ts|/index.tsx|/index.ts) 的真实文件。 */
function resolveAlias(spec) {
  const base = join(srcDir, spec.slice(ALIAS.length))
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * 第 1 至 5 步：文本替换。
 * @returns {{ text: string, problems: string[] }}
 */
function rewriteText(file, input) {
  const problems = []
  let text = input
  // 1. "use client"
  text = text.replace(/^(["'])use client\1;?[ \t]*\r?\n(?:[ \t]*\r?\n)?/, '')
  // 2. 别名 → 相对路径
  text = text.replace(/(from\s+|import\s+)(["'])(@ui-kit\/[^"']+)\2/g, (whole, keyword, quote, spec) => {
    const target = resolveAlias(spec)
    if (target === undefined) {
      problems.push(`${toPosix(relative(packageDir, file))}：${spec} 找不到对应的文件`)
      return whole
    }
    return `${keyword}${quote}${importPath(file, target)}${quote}`
  })
  // 3. 弹层的层级
  text = text.replace(/(?<=[\s"'`])jx:z-50(?=[\s"'`])/g, 'jx:z-[1100]')
  // 4. 圆角变量
  text = text.replace(/var\(--radius-(xs|sm|md|lg|xl)\)/g, 'var(--dsw-radius-$1)')
  text = text.replace(/var\(--radius\)/g, 'var(--dsw-radius-md)')
  // 5. 空的 jx:、漏了前缀的 rtl:
  text = text.replace(/(?<=["'`]|[ \t])jx:(?:[ \t]+|(?=["'`]))/g, '')
  text = text.replace(/(?<=[\s"'`])rtl:/g, 'jx:rtl:')
  // 留给人改：不带前缀的语义色变量
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(SEMANTIC_VARS)) {
      problems.push(`${toPosix(relative(packageDir, file))}:${index + 1}：类名里引用了 ${match[0]}，加前缀以后没人定义它，换成对应的 DSH 变量（见 src/styles/jx.tailwind.css 的 @theme inline）`)
    }
  })
  return { text, problems }
}

/** 最近的外层函数。 */
function enclosingFunction(node) {
  let current = node.parent
  while (current !== undefined) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current) || ts.isFunctionDeclaration(current)) return current
    current = current.parent
  }
  return undefined
}

/** 第 8 步：引入样式入口。 */
function importTailwindEntry(file, input) {
  const sourceFile = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imports = sourceFile.statements.filter(ts.isImportDeclaration)
  if (imports.some(s => ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text.endsWith('.tailwind.css'))) return input
  const at = imports.length > 0 ? imports[imports.length - 1].end : 0
  return applyEdits(input, [{ start: at, end: at, text: `\nimport "${importPath(file, TAILWIND_ENTRY)}"` }])
}

/** 第 6 步：弹层落脚容器。 */
function addPortalContainer(file, input) {
  const sourceFile = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const portals = []
  const visit = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sourceFile).endsWith('.Portal')) {
      const hasContainer = node.attributes.properties.some(p => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === 'container')
      if (!hasContainer) portals.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (portals.length === 0) return input

  const edits = []
  const functions = new Set()
  for (const portal of portals) {
    edits.push({ start: portal.tagName.end, end: portal.tagName.end, text: ' container={portalContainer}' })
    const fn = enclosingFunction(portal)
    if (fn === undefined || fn.body === undefined || !ts.isBlock(fn.body)) {
      throw new Error(`${toPosix(relative(packageDir, file))}：${portal.tagName.getText(sourceFile)} 不在一个带函数体的组件里，没法自动加落脚容器`)
    }
    functions.add(fn)
  }
  for (const fn of functions) {
    const body = fn.body
    const declared = body.statements.some(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === 'portalContainer'))
    if (declared) continue
    const first = body.statements[0]
    const indent = first === undefined ? '  ' : (input.slice(input.lastIndexOf('\n', first.getStart(sourceFile)) + 1, first.getStart(sourceFile)).match(/^[ \t]*/)?.[0] ?? '  ')
    edits.push({ start: body.getStart(sourceFile) + 1, end: body.getStart(sourceFile) + 1, text: `\n${indent}const portalContainer = usePortalContainer()` })
  }
  const imported = sourceFile.statements.some(s => ts.isImportDeclaration(s) && s.importClause?.namedBindings !== undefined
    && ts.isNamedImports(s.importClause.namedBindings) && s.importClause.namedBindings.elements.some(e => e.name.text === 'usePortalContainer'))
  if (!imported) {
    const imports = sourceFile.statements.filter(ts.isImportDeclaration)
    const at = imports.length > 0 ? imports[imports.length - 1].end : 0
    edits.push({ start: at, end: at, text: `\nimport { usePortalContainer } from "${importPath(file, PORTAL_CONTAINER)}"` })
  }
  return applyEdits(input, edits)
}

/** 第 7 步：forwardRef。反复找、反复改，直到没有能自动改的。 */
function fixForwardRefs(files) {
  const wanted = new Set(files.map(f => resolve(f)))
  const tsconfig = join(packageDir, 'tsconfig.json')
  for (let round = 0; round < 5; round++) {
    const program = programFromTsconfig(tsconfig)
    const findings = findMissingRefs(program, { include: f => wanted.has(resolve(f)) })
    const byFile = new Map()
    const unfixable = []
    for (const finding of findings) {
      const plan = planForwardRefFix(finding)
      if (plan === undefined) { unfixable.push(finding); continue }
      const list = byFile.get(finding.file) ?? []
      list.push({ finding, plan })
      byFile.set(finding.file, list)
    }
    if (byFile.size === 0) return unfixable
    for (const [file, items] of byFile) {
      // 同一个组件可能因为多个元素报了几次，只改第一次。
      const seen = new Set()
      const edits = []
      for (const { finding, plan } of items) {
        if (seen.has(finding.component)) continue
        seen.add(finding.component)
        edits.push(...plan.edits)
        console.log(`  ${toPosix(relative(packageDir, file))}：${finding.component} 改成 forwardRef，ref 交给 <${finding.target}>`)
      }
      let text = applyEdits(readFileSync(file, 'utf8'), edits)
      if (!/^import \* as React from ["']react["']/m.test(text)) text = `import * as React from "react"\n${text}`
      writeFileSync(file, text)
    }
  }
  throw new Error('改了五轮还有能改的，脚本可能有毛病')
}

function main() {
  const args = process.argv.slice(2)
  const uiDir = join(srcDir, 'ui')
  const files = args.length > 0
    ? args.map(a => resolve(a))
    : readdirSync(uiDir).filter(f => f.endsWith('.tsx')).map(f => join(uiDir, f))
  const problems = []
  for (const file of files) {
    const before = readFileSync(file, 'utf8')
    const step1 = rewriteText(file, before)
    problems.push(...step1.problems)
    const after = importTailwindEntry(file, addPortalContainer(file, step1.text))
    if (after !== before) {
      writeFileSync(file, after)
      console.log(`  ${toPosix(relative(packageDir, file))}：文本替换、弹层容器、样式入口`)
    }
  }
  const unfixable = fixForwardRefs(files)
  for (const finding of unfixable) problems.push(`${formatFinding(finding, packageDir)}（没法自动改）`)
  if (problems.length > 0) {
    console.error('\n要人改的地方：')
    for (const p of problems) console.error(`  ${p}`)
    process.exitCode = 1
    return
  }
  console.log('适配完成。')
}

main()
