#!/usr/bin/env node
/**
 * 在 DSH 仓库之外构建一个 DSH 插件包。
 *
 * DSH 自己的构建预设（packages/client/tsdown.client.ts）没有发布到 npm，
 * 它的 cookbook 明说「仓库外的包要自己复刻这套构建」。这个脚本复刻的是产物格式，
 * 不是它的实现：DSH 用 tsdown + lightningcss，这里用 esbuild + lightningcss。
 *
 * 一个插件包最多两半：
 *   src/index.ts          宿主一半  → lib/index.js   （Node 里跑的 ESM）
 *   src/client/index.ts*  浏览器一半 → lib/client.js  （DSH 客户端模块表要的「懒 CJS 工厂」）
 *
 * 浏览器一半的产物格式（出处：packages/client/modules/README.md、tsdown.client.ts）：
 *   window.__ModuleLoader__.load({ id: '<包名>', factory: (require) => {
 *     var module = { exports: {} }; var exports = module.exports;
 *     ...打包后的 CJS...
 *     return module.exports; } });
 *   - 共享模块（PLATFORM_MODULES）不打进包里，运行时通过工厂的 require 取。
 *   - x.module.css 编译成带哈希的类名表，工厂执行时往 <head> 注入 <style data-plugin="<包名>">。
 *   - 别的 .css（约定叫 x.global.css）不改类名，原样注入；只在必须盖住别人的样式时用。
 *   - src/client/assets/ 下的图片发到 lib/assets/<名字>-<内容摘要>.<扩展名>，
 *     代码里拿到的是 require.asset('plugins/<包名>/assets/<文件>')，由宿主的 /plugins 路由提供。
 *
 * 用法：在插件包目录里执行 `jx-dsh-plugin-build`（加 --watch 持续构建）。
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import * as esbuild from 'esbuild'
import { transform } from 'lightningcss'

/**
 * DSH 0.2.2-rc.5 的共享模块表。出处：packages/client/web/src/platform.ts 的 PLATFORM_MODULES。
 * 升级 DSH 时要对着那个文件核一遍：表里少了的模块，我们的包运行时 require 会直接抛错。
 */
export const DSH_PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  'zod', '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** 宿主的 /plugins 资源路由认得的图片类型。出处：packages/client/modules/src/assets.ts。 */
const ASSET_EXTENSIONS = new Set(['.svg', '.png', '.webp', '.jpg', '.jpeg'])

const packageDir = process.cwd()
const watch = process.argv.includes('--watch')

async function readManifest() {
  const file = join(packageDir, 'package.json')
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  if (typeof manifest.name !== 'string') throw new Error(`${file} 没有 name`)
  return manifest
}

function firstExisting(candidates) {
  return candidates.map(c => join(packageDir, c)).find(existsSync)
}

/** 与 DSH 的资源引用写法一致：逐段 encodeURIComponent，再转义 ! ' ( ) *，这样也能直接放进 CSS 的 url()。 */
function encodeAssetSegment(segment) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * 浏览器一半用到的 esbuild 插件：纯度检查、CSS Modules、图片资源。
 * @param {{ name: string, exports?: Record<string, unknown>, dsh?: { client?: { external?: string[] } } }} manifest
 * @param {Set<string>} emittedAssets 这一轮构建发出去的资源文件名，用来清掉旧文件。
 */
function clientPlugins(manifest, externals, emittedAssets) {
  const id = manifest.name
  const assetsDir = join(packageDir, 'src', 'client', 'assets')

  /** @type {import('esbuild').Plugin} */
  const purity = {
    name: 'jx-dsh-bundle-purity',
    setup(build) {
      // 对应 DSH 的 dsh-client-bundle-purity：别的 @deepseek-ai 包只能 import type。
      // 值导入要么是共享模块表里的（不打包），要么就是错的：打进来会多出一份运行时实例，
      // 不打进来模块表又答不上。跨插件协作走 cordis 服务和插槽。
      build.onResolve({ filter: /^@deepseek-ai\// }, (args) => {
        if (externals.has(args.path)) return { path: args.path, external: true }
        return {
          errors: [{
            text: `不能把 "${args.path}" 的值打进 ${id} 的浏览器包：它不在 DSH 的共享模块表里。`
              + '只用类型就写 import type；要用它的功能就走 ctx 上的服务或插槽。',
          }],
        }
      })
    },
  }

  /** 把一段 CSS 包成「工厂执行时注入 <style>」的 JS 模块。 */
  function styleModule(file, css, classMap) {
    // DSH 用「包名/文件名」当标签 id；我们用到包目录的相对路径，免得两个同名样式表互相顶掉。
    const tagId = `${id}/${relative(packageDir, file).split(sep).join('/')}`
    return [
      `const css = ${JSON.stringify(css)};`,
      `const tagId = ${JSON.stringify(tagId)};`,
      "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
      "  const tag = document.createElement('style');",
      // data-plugin 是 DSH 卸载插件时清样式用的标记，必须是包名。
      `  tag.dataset.plugin = ${JSON.stringify(id)};`,
      '  tag.dataset.pluginCss = tagId;',
      '  tag.textContent = css;',
      '  document.head.appendChild(tag);',
      '}',
      classMap === undefined ? 'export {};' : `export default ${JSON.stringify(classMap)};`,
    ].join('\n')
  }

  /** @type {import('esbuild').Plugin} */
  const css = {
    name: 'jx-dsh-css',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const source = await readFile(args.path)
        const isModule = args.path.endsWith('.module.css')
        const result = transform({
          // 类名里的 [hash] 按这里给的文件名算。给包内的相对路径，换个目录构建，打出来的 tarball 也不变。
          filename: relative(packageDir, args.path).split(sep).join('/'),
          code: source,
          minify: true,
          ...(isModule ? { cssModules: { pattern: '[hash]_[local]' } } : {}),
        })
        let classMap
        if (isModule) {
          classMap = {}
          for (const [local, exported] of Object.entries(result.exports ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
            // composes 的类名要一起带上，否则组合出来的样式丢了。
            classMap[local] = [exported.name, ...exported.composes.map(c => c.name)].join(' ')
          }
        }
        return { contents: styleModule(args.path, result.code.toString(), classMap), loader: 'js', watchFiles: [args.path] }
      })
    },
  }

  /** @type {import('esbuild').Plugin} */
  const assets = {
    name: 'jx-dsh-package-asset',
    setup(build) {
      build.onLoad({ filter: /\.(svg|png|webp|jpe?g)$/ }, async (args) => {
        const rel = relative(assetsDir, args.path)
        if (rel.startsWith('..') || resolve(assetsDir, rel) !== args.path) {
          return { errors: [{ text: `${args.path} 不在 src/client/assets/ 下；浏览器一半只能引用那里的图片。` }] }
        }
        if (manifest.exports?.['./assets/*'] !== './lib/assets/*') {
          return { errors: [{ text: 'package.json 的 exports 里要有 "./assets/*": "./lib/assets/*"，宿主靠它找到图片。' }] }
        }
        const bytes = await readFile(args.path)
        // 与 DSH 一致：内容的 SHA-1 前 12 位插在扩展名前面，一个 URL 永远对应一份内容（宿主按不可变资源缓存）。
        const revision = createHash('sha1').update(bytes).digest('hex').slice(0, 12)
        const ext = extname(rel)
        const emitted = `${rel.slice(0, -ext.length)}-${revision}${ext}`.split(sep).join('/')
        const out = join(packageDir, 'lib', 'assets', emitted)
        await mkdir(dirname(out), { recursive: true })
        await writeFile(out, bytes)
        emittedAssets.add(emitted)
        const reference = `plugins/${id}/assets/${emitted.split('/').map(encodeAssetSegment).join('/')}`
        // require.asset 是模块表的同步资源解析：网页里原样返回这个相对地址。
        return { contents: `export default require.asset(${JSON.stringify(reference)});`, loader: 'js', watchFiles: [args.path] }
      })
    },
  }

  return [purity, css, assets]
}

async function listFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await listFiles(path))
    else out.push(path)
  }
  return out
}

/** 宿主一半：Node 里跑的 ESM。生产依赖和 peer 依赖不打包，其余全打进来。 */
function hostOptions(manifest, entry) {
  const runtimeDeps = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]
  return {
    entryPoints: { index: entry },
    outdir: join(packageDir, 'lib'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    sourcemap: true,
    logLevel: 'info',
    external: [
      ...runtimeDeps.flatMap(name => [name, `${name}/*`]),
      ...builtinModules.flatMap(name => [name, `node:${name}`]),
    ],
  }
}

/** 浏览器一半：懒 CJS 工厂。 */
function clientOptions(manifest, entry, emittedAssets) {
  const id = manifest.name
  const requested = manifest.dsh?.client?.external ?? []
  const externals = new Set([...DSH_PLATFORM_MODULES, ...requested])
  return {
    entryPoints: { client: entry },
    outdir: join(packageDir, 'lib'),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    sourcemap: true,
    // 与 DSH 一致：压缩空白，但不改标识符、不折叠语句，出问题时浏览器里还读得懂。
    minifyWhitespace: true,
    legalComments: 'none',
    logLevel: 'info',
    external: [...externals],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    plugins: clientPlugins(manifest, externals, emittedAssets),
    banner: {
      js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
    },
    footer: { js: 'return module.exports; } });' },
  }
}

/** 构建后的自检：产物里不能残留模块表答不上的 require。 */
async function verifyClientBundle(manifest) {
  const file = join(packageDir, 'lib', 'client.js')
  const code = await readFile(file, 'utf8')
  const allowed = new Set([...DSH_PLATFORM_MODULES, ...(manifest.dsh?.client?.external ?? [])])
  const unknown = new Set()
  for (const match of code.matchAll(/\brequire\((["'`])([^"'`]+)\1\)/g)) {
    if (!allowed.has(match[2])) unknown.add(match[2])
  }
  if (unknown.size > 0) {
    throw new Error(`lib/client.js 里有模块表答不上的 require：${[...unknown].join('、')}`)
  }
  if (!code.startsWith('window.__ModuleLoader__.load(')) {
    throw new Error('lib/client.js 不是以 window.__ModuleLoader__.load( 开头，宿主拼接脚本时会出错')
  }
}

async function main() {
  const manifest = await readManifest()
  const hostEntry = firstExisting(['src/index.ts', 'src/index.tsx'])
  const clientEntry = firstExisting(['src/client/index.ts', 'src/client/index.tsx'])
  if (hostEntry === undefined && clientEntry === undefined) {
    throw new Error('没找到 src/index.ts 或 src/client/index.ts(x)')
  }
  if (clientEntry !== undefined && manifest.dsh?.client?.platform !== 'web') {
    throw new Error('有浏览器一半，但 package.json 里没有 "dsh": { "client": { "platform": "web" } }，宿主不会加载它')
  }
  const emittedAssets = new Set()
  const configs = []
  if (hostEntry !== undefined) configs.push(hostOptions(manifest, hostEntry))
  if (clientEntry !== undefined) configs.push(clientOptions(manifest, clientEntry, emittedAssets))

  if (watch) {
    for (const config of configs) await (await esbuild.context(config)).watch()
    console.log(`[jx-dsh-plugin-build] 监听 ${manifest.name} …`)
    return
  }
  for (const config of configs) await esbuild.build(config)
  if (clientEntry !== undefined) {
    await verifyClientBundle(manifest)
    // 只留这一轮发出去的图片，旧摘要的文件删掉。
    const assetsOut = join(packageDir, 'lib', 'assets')
    for (const file of await listFiles(assetsOut)) {
      const rel = relative(assetsOut, file).split(sep).join('/')
      if (!emittedAssets.has(rel) && ASSET_EXTENSIONS.has(extname(file))) await rm(file)
    }
  }
  console.log(`[jx-dsh-plugin-build] ${manifest.name} 构建完成${clientEntry ? `（浏览器一半 ${basename(clientEntry)}）` : ''}`)
}

main().catch((error) => {
  console.error(`[jx-dsh-plugin-build] 失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
