/**
 * React 18 上收不到 ref 的组件：找出来（检查用），也给出怎么改（适配脚本用）。
 *
 * 为什么要有：shadcn 现在按 React 19 写组件，ref 当普通属性传，函数组件不包 forwardRef。DSH 给插件共享的是
 * React 18.3.1，这种组件收不到 ref，React 只在开发版里打一行警告。Base UI 用 render={<我们的组件 />} 把触发器、
 * 输入框换成我们的组件时，靠 ref 找到那个元素来定位弹层；收不到 ref，弹层就跑到别处（实测：日期的弹层跑到页面
 * 左上角，选择器的弹层贴在输入框右端、只有 52px 宽）。而类型检查查不出来：React 18 的类型里
 * React.ComponentProps<"input"> 本身就带着 ref，tsc 是 0 个错误。
 *
 * 判定规则：一个组件把自己的 props（剩余参数 ...props，或者整个 props 参数）展开交给某个元素，而那个元素按类型
 * 接受 ref（原生标签，或者属性里有 ref 的组件），那么这个组件必须
 *   1. 用 forwardRef 包起来，
 *   2. 在那个元素上写 ref（直接写 ref={ref}，或者合并以后再给），并且用到 forwardRef 给的 ref 参数
 *      （按符号认：参数叫 ref 时，元素上写的 ref={自己的 ref} 里那个属性名不算用到）；
 * 另外，任何组件都不能从 props 里解构 ref（React 19 的写法，在 18 上永远是 undefined）。
 *
 * 只看文件最外层定义的组件（名字大写开头的函数声明、箭头函数、forwardRef(…) 调用）。
 * 嵌套在别的函数、对象字面量里的函数不算，它们不会被当成组件拿 ref。
 */
import { existsSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

/**
 * 按 tsconfig 建一个 Program。
 * @param {string} tsconfigPath tsconfig.json 的路径。
 * @returns {ts.Program}
 */
export function programFromTsconfig(tsconfigPath) {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsconfigPath))
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'))
  }
  return ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options })
}

/**
 * 给一组文件建 Program（检查本身的单测用）。
 * @param {string[]} files 文件路径。
 * @param {ts.CompilerOptions} [options] 编译选项，缺省是 React 18 的 JSX 加严格模式。
 * @returns {ts.Program}
 */
export function programFromFiles(files, options = {}) {
  return ts.createProgram({
    rootNames: files,
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      types: [],
      ...options,
    },
  })
}

/** 名字大写开头才算组件。 */
function isComponentName(name) {
  return /^[A-Z]/.test(name)
}

/** forwardRef(…) 或 React.forwardRef(…)。 */
function isForwardRefCall(node) {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee)) return callee.text === 'forwardRef'
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 'forwardRef'
}

/** memo(…) 或 React.memo(…)。 */
function isMemoCall(node) {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee)) return callee.text === 'memo'
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 'memo'
}

function isFunctionLike(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)
}

/**
 * 文件最外层的组件。
 * @returns {{ name: string, fn: ts.FunctionLikeDeclaration, forwardRef: boolean, statement: ts.Statement, call?: ts.CallExpression }[]}
 */
function topLevelComponents(sourceFile) {
  const out = []
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && isComponentName(statement.name.text) && statement.body) {
      out.push({ name: statement.name.text, fn: statement, forwardRef: false, statement })
      continue
    }
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !isComponentName(declaration.name.text) || !declaration.initializer) continue
      let init = declaration.initializer
      // memo(forwardRef(fn)) 和 memo(fn)：往里剥一层。
      if (isMemoCall(init) && init.arguments.length > 0) init = init.arguments[0]
      if (isFunctionLike(init)) {
        out.push({ name: declaration.name.text, fn: init, forwardRef: false, statement })
      } else if (isForwardRefCall(init) && init.arguments.length > 0 && isFunctionLike(init.arguments[0])) {
        out.push({ name: declaration.name.text, fn: init.arguments[0], forwardRef: true, statement, call: init })
      }
    }
  }
  return out
}

/** 在函数体里找 JSX 元素，不进嵌套的函数。 */
function jsxElementsOf(fn) {
  const found = []
  const visit = (node) => {
    if (node !== fn && isFunctionLike(node)) return
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) found.push(node)
    ts.forEachChild(node, visit)
  }
  if (fn.body) visit(fn.body)
  return found
}

/** props 参数里剩余属性的名字（...props），整个参数是标识符时就是它；另外报告有没有解构出 ref。 */
function propsBinding(fn) {
  const param = fn.parameters[0]
  if (param === undefined) return { restName: undefined, refInProps: undefined }
  if (ts.isIdentifier(param.name)) return { restName: param.name.text, refInProps: undefined }
  if (!ts.isObjectBindingPattern(param.name)) return { restName: undefined, refInProps: undefined }
  let restName
  let refInProps
  for (const element of param.name.elements) {
    if (element.dotDotDotToken && ts.isIdentifier(element.name)) restName = element.name.text
    const key = element.propertyName ?? element.name
    if (!element.dotDotDotToken && ts.isIdentifier(key) && key.text === 'ref') refInProps = element
  }
  return { restName, refInProps }
}

/** 元素上有没有展开 restName。 */
function spreadsRest(element, restName) {
  return element.attributes.properties.some(p => ts.isJsxSpreadAttribute(p) && ts.isIdentifier(p.expression) && p.expression.text === restName)
}

/** 元素上的 ref 属性。 */
function refAttribute(element) {
  return element.attributes.properties.find(p => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === 'ref')
}

/** 原生标签（小写开头、不带点）。 */
function isIntrinsic(element) {
  return ts.isIdentifier(element.tagName) && /^[a-z]/.test(element.tagName.text)
}

/** 这个元素按类型接不接受 ref。 */
function acceptsRef(checker, element) {
  if (isIntrinsic(element)) return true
  const type = checker.getContextualType(element.attributes)
  if (type === undefined) return false
  const props = type.isUnion() ? type.types : [type]
  return props.some(t => checker.getPropertyOfType(checker.getApparentType(t), 'ref') !== undefined)
}

/**
 * 元素的 ref 能接什么元素类型，取最具体的那个（能赋给其余所有候选的）。
 * Base UI 有的组件把 ref 写成交叉类型（Ref<HTMLButtonElement> & Ref<HTMLElement>），这时要的是 HTMLButtonElement。
 * 取不到、或者取到的不是能直接写出来的全局类型时返回 undefined。
 */
function refInstanceType(checker, element) {
  const attributes = checker.getContextualType(element.attributes)
  if (attributes === undefined) return undefined
  const owners = attributes.isUnion() ? attributes.types : [attributes]
  let refSymbol
  for (const owner of owners) {
    refSymbol = checker.getPropertyOfType(checker.getApparentType(owner), 'ref')
    if (refSymbol !== undefined) break
  }
  if (refSymbol === undefined) return undefined
  const candidates = []
  const visit = (type) => {
    if (type.isUnion() || type.isIntersection()) { type.types.forEach(visit); return }
    if (type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined)) return
    const current = checker.getPropertyOfType(type, 'current')
    if (current !== undefined) {
      candidates.push(checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(current, element)))
      return
    }
    const parameter = type.getCallSignatures()[0]?.parameters[0]
    if (parameter !== undefined) candidates.push(checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(parameter, element)))
  }
  visit(checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(refSymbol, element)))
  const best = candidates.find(c => candidates.every(other => checker.isTypeAssignableTo(c, other)))
  if (best === undefined) return undefined
  const text = checker.typeToString(best)
  return /^[A-Z][A-Za-z0-9]*$/.test(text) ? text : undefined
}

/**
 * 函数体里有没有用到 declaration 声明的那个参数（含嵌套的回调里）。
 * 按类型检查器的符号认，不按名字认：参数恰好叫 ref 时，元素上的属性名 ref（ref={自己的 ref}）、对象的属性名 ref
 * 都不是这个参数，不能算用到。简写属性 { ref } 取的是参数的值，算用到。
 */
function usesParameter(checker, fn, declaration) {
  const target = checker.getSymbolAtLocation(declaration.name)
  if (target === undefined) return false
  let used = false
  const visit = (node) => {
    if (used) return
    if (ts.isIdentifier(node) && node !== declaration.name) {
      const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node)
      if (symbol === target) used = true
    }
    ts.forEachChild(node, visit)
  }
  if (fn.body) visit(fn.body)
  return used
}

/** 函数里有没有声明名为 name 的东西（参数、局部变量）。 */
function declaresIdentifier(fn, name) {
  let declared = false
  const visit = (node) => {
    if (declared) return
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && node.name.text === name) {
      declared = true
      return
    }
    ts.forEachChild(node, visit)
  }
  for (const p of fn.parameters) visit(p)
  if (fn.body) visit(fn.body)
  return declared
}

/**
 * @typedef {object} Finding
 * @property {string} file 文件的绝对路径。
 * @property {number} line 行号，从 1 开始。
 * @property {string} component 组件名。
 * @property {'not-forwarded' | 'ref-not-passed' | 'ref-in-props'} kind
 *   not-forwarded：普通函数组件，把 props 交给了能收 ref 的元素；
 *   ref-not-passed：已经是 forwardRef，但那个元素上没有 ref，或者没用到 ref 参数；
 *   ref-in-props：从 props 里解构 ref。
 * @property {string} [target] 收到 props 的元素（标签名）。
 * @property {string} message 给人看的说明。
 * @property {object} [fix] 适配脚本用的信息。
 */

/**
 * 找出 React 18 上收不到 ref 的组件。
 * @param {ts.Program} program
 * @param {{ include?: (fileName: string) => boolean }} [options] 只看哪些文件，缺省是除了 .d.ts 和 node_modules 以外的全部。
 * @returns {Finding[]}
 */
export function findMissingRefs(program, options = {}) {
  const include = options.include ?? (f => !f.endsWith('.d.ts') && !f.split(/[\\/]/).includes('node_modules'))
  const checker = program.getTypeChecker()
  /** @type {Finding[]} */
  const findings = []
  for (const sourceFile of program.getSourceFiles()) {
    if (!include(sourceFile.fileName) || !/\.[jt]sx$/.test(sourceFile.fileName)) continue
    const lineOf = node => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
    for (const component of topLevelComponents(sourceFile)) {
      const { fn, name } = component
      const { restName, refInProps } = propsBinding(fn)
      if (refInProps !== undefined) {
        findings.push({
          file: sourceFile.fileName, line: lineOf(refInProps), component: name, kind: 'ref-in-props',
          message: `${name} 从 props 里解构 ref：这是 React 19 的写法，在 React 18 上永远是 undefined。改用 forwardRef 的第二个参数。`,
        })
      }
      if (restName === undefined) continue
      const targets = jsxElementsOf(fn).filter(el => spreadsRest(el, restName) && acceptsRef(checker, el))
      for (const target of targets) {
        const targetName = target.tagName.getText(sourceFile)
        if (!component.forwardRef) {
          findings.push({
            file: sourceFile.fileName, line: lineOf(fn), component: name, kind: 'not-forwarded', target: targetName,
            message: `${name} 把 props 交给 <${targetName}>（它接受 ref），但自己是普通函数组件，在 React 18 上收不到 ref。要用 forwardRef 包起来，并把 ref 给 <${targetName}>。`,
            fix: { sourceFile, component, target, intrinsic: isIntrinsic(target), instanceType: refInstanceType(checker, target) },
          })
          continue
        }
        const refParam = fn.parameters[1]
        const passed = refAttribute(target) !== undefined && refParam !== undefined && ts.isIdentifier(refParam.name)
          && usesParameter(checker, fn, refParam)
        if (!passed) {
          findings.push({
            file: sourceFile.fileName, line: lineOf(target), component: name, kind: 'ref-not-passed', target: targetName,
            message: `${name} 用了 forwardRef，但没有把 ref 给收到 props 的 <${targetName}>。`,
          })
        }
      }
    }
  }
  return findings
}

/**
 * 一条发现的文字说明，带上相对路径和行号。
 * @param {Finding} finding
 * @param {string} [base] 相对路径的起点。
 */
export function formatFinding(finding, base = process.cwd()) {
  return `${relative(base, finding.file).split(sep).join('/')}:${finding.line}  ${finding.message}`
}

/**
 * 算出 not-forwarded 的改法：一组文本编辑（按位置从后往前应用）。
 * 改成 const X = React.forwardRef(function X(props, ref: React.ForwardedRef<…>) { … <Target ref={ref} …> })。
 * 改不了的（泛型组件、元素上已经有 ref）返回 undefined，留给人改。
 * @param {Finding} finding
 * @returns {{ edits: { start: number, end: number, text: string }[] } | undefined}
 */
export function planForwardRefFix(finding) {
  if (finding.kind !== 'not-forwarded' || finding.fix === undefined) return undefined
  const { sourceFile, component, target, intrinsic, instanceType } = finding.fix
  const { fn } = component
  if (fn.typeParameters !== undefined && fn.typeParameters.length > 0) return undefined
  if (refAttribute(target) !== undefined) return undefined
  if (fn.parameters.length !== 1) return undefined
  const refName = declaresIdentifier(fn, 'ref') ? 'forwardedRef' : 'ref'
  const tagText = target.tagName.getText(sourceFile)
  // 优先写具体的元素类型（HTMLButtonElement 这样）；取不到时退回 React.ComponentRef。
  const refType = instanceType ?? (intrinsic ? `React.ComponentRef<"${tagText}">` : `React.ComponentRef<typeof ${tagText}>`)
  const edits = []
  // 元素上加 ref。
  edits.push({ start: target.tagName.end, end: target.tagName.end, text: ` ref={${refName}}` })
  // 参数表里加 ref 参数。
  const lastParam = fn.parameters[fn.parameters.length - 1]
  edits.push({ start: lastParam.end, end: lastParam.end, text: `, ${refName}: React.ForwardedRef<${refType}>` })
  if (ts.isFunctionDeclaration(fn)) {
    // function X(…) { … }  →  const X = React.forwardRef(function X(…) { … })
    const exportKeyword = fn.modifiers?.find(m => m.kind === ts.SyntaxKind.ExportKeyword)
    const functionKeywordStart = fn.getStart(sourceFile) + (fn.modifiers ? fn.getText(sourceFile).indexOf('function') : 0)
    const prefix = `${exportKeyword ? 'export ' : ''}const ${component.name} = React.forwardRef(`
    edits.push({ start: fn.getStart(sourceFile), end: functionKeywordStart, text: prefix })
    edits.push({ start: fn.end, end: fn.end, text: ')' })
  } else {
    // const X = (…) => …  /  const X = function (…) { … }  →  const X = React.forwardRef(…)
    edits.push({ start: fn.getStart(sourceFile), end: fn.getStart(sourceFile), text: 'React.forwardRef(' })
    edits.push({ start: fn.end, end: fn.end, text: ')' })
  }
  return { edits }
}

/**
 * 按编辑改一段文本。编辑的位置都按原文算，不能重叠。
 * @param {string} text
 * @param {{ start: number, end: number, text: string }[]} edits
 */
export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end)
  let out = text
  for (const edit of sorted) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  return out
}

/**
 * 检查一个包：按 tsconfig 建 Program，只看 tsconfig 所在目录的 src/ 下的文件。
 * @param {string | URL} tsconfig tsconfig.json 的路径。
 * @returns {Finding[]}
 */
export function checkPackage(tsconfig) {
  const tsconfigPath = tsconfig instanceof URL ? tsconfig.pathname : resolve(tsconfig)
  if (!existsSync(tsconfigPath)) throw new Error(`找不到 ${tsconfigPath}`)
  const srcDir = resolve(dirname(tsconfigPath), 'src') + sep
  const program = programFromTsconfig(tsconfigPath)
  return findMissingRefs(program, { include: f => resolve(f).startsWith(srcDir) && !f.endsWith('.d.ts') })
}
