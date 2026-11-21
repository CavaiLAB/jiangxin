/**
 * 首页 HTML 的品牌替换。夹具是 DSH 0.2.2-rc.5 发布的 index.html 原文
 * （@deepseek-ai/dsh-web-frontend/dist/index.html）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AGENT_IDENTITY_PROMPT, PRODUCT_VERSION_PATTERN } from '../src/brand.ts'
import { BOOT_PAGE_STYLE, TITLE_GUARD_SCRIPT, brandIndexHtml, brandManifest, pngAsSvg } from '../src/host/index-html.ts'

const UPSTREAM_INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="DSH" />
    <link rel="icon" type="image/svg+xml" href="./favicon-dark.svg" media="(prefers-color-scheme: dark)" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" media="(prefers-color-scheme: light)" />
    <title>DeepSeek Harness</title>
    <script type="module" crossorigin src="./assets/index-Ciz7DZxv.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-CSAdOBx6.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

test('换掉标题、主屏幕标题和站点图标，别的标签原样保留', () => {
  const html = brandIndexHtml(UPSTREAM_INDEX)
  assert.match(html, /<title>匠心工业智能体平台<\/title>/)
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="匠心" \/>/)
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\.\/jx-brand\/favicon-32\.png" \/>/)
  assert.doesNotMatch(html, /DeepSeek|Harness|DSH|favicon\.svg|favicon-dark\.svg/)
  // 清单和主屏幕图标的链接不动（那两个路径由宿主一半的同名路由顶掉）。
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest" \/>/)
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/apple-touch-icon\.png" \/>/)
  assert.match(html, /<script type="module" crossorigin src="\.\/assets\/index-Ciz7DZxv\.js"><\/script>/)
  assert.equal(html.match(/<title>/g)?.length, 1)
})

test('上游改了这些标签的写法或删掉了，我们的标题和图标仍然在', () => {
  const html = brandIndexHtml('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  assert.match(html, /<title>匠心工业智能体平台<\/title>/)
  assert.match(html, /favicon-16\.png/)
})

test('注入的脚本和样式不会提前把标签关掉', () => {
  assert.doesNotMatch(TITLE_GUARD_SCRIPT, /<\/script/i)
  assert.doesNotMatch(BOOT_PAGE_STYLE, /<\/style/i)
  assert.match(BOOT_PAGE_STYLE, /匠心工业智能体平台/)
})

test('守标题的脚本：把上游的产品标题换成我们的，别的不动', () => {
  // 用一个假的 document 跑一遍脚本。
  let stored = ''
  class FakeDocument {
    get title(): string { return stored }
    set title(value: string) { stored = value }
  }
  const document = new FakeDocument()
  new Function('Document', 'document', TITLE_GUARD_SCRIPT)(FakeDocument, document)
  document.title = 'DeepSeek Harness'
  assert.equal(document.title, '匠心工业智能体平台')
  document.title = '排查产线告警 — DeepSeek Harness'
  assert.equal(document.title, '排查产线告警 — 匠心工业智能体平台')
  document.title = '别的标题'
  assert.equal(document.title, '别的标题')
})

test('清单里是我们的名字和图标', () => {
  const manifest = JSON.parse(brandManifest()) as { name: string; short_name: string; icons: { src: string }[] }
  assert.equal(manifest.name, '匠心工业智能体平台')
  assert.equal(manifest.short_name, '匠心')
  assert.deepEqual(manifest.icons.map(icon => icon.src), ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'])
})

test('位图包成的 SVG 里嵌着原图', () => {
  const svg = pngAsSvg(new Uint8Array([1, 2, 3]), 48)
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="48" height="48"/)
  assert.match(svg, /data:image\/png;base64,AQID/)
})

test('版本号格式不对时按没给处理，并留下一句告警', async () => {
  // 宿主一半的入口依赖 DSH 的包，这里只取它的纯函数。
  const { checkRuntimeInfo } = await import('../src/index.ts')
  assert.deepEqual(checkRuntimeInfo({}), { info: {} })
  assert.deepEqual(checkRuntimeInfo({ version: '', commit: '' }), { info: {} })
  assert.deepEqual(checkRuntimeInfo({ version: 'v2026.11.20', commit: 'abc1234' }), { info: { version: 'v2026.11.20', commit: 'abc1234' } })
  const bad = checkRuntimeInfo({ version: 'v2026.05.12', commit: 'abc1234' })
  assert.deepEqual(bad.info, { commit: 'abc1234' })
  assert.match(bad.problem ?? '', /v2026\.05\.12/)
})

test('模型的自我介绍：带我们的名字，不带上游的名字，也没有会被当成变量的花括号', () => {
  assert.match(AGENT_IDENTITY_PROMPT, /匠心工业智能体平台/)
  assert.doesNotMatch(AGENT_IDENTITY_PROMPT, /DeepSeek|Harness|DSH|深度求索/i)
  assert.doesNotMatch(AGENT_IDENTITY_PROMPT, /\{\{|\}\}/)
})

test('产品版本号的格式（vYYYY.M.D、vYYYY.M.D-N、vYYYY.M.D-beta.N）', () => {
  for (const ok of ['v2026.11.20', 'v2026.5.12', 'v2026.5.12-2', 'v2026.5.12-beta.1']) {
    assert.match(ok, PRODUCT_VERSION_PATTERN)
  }
  for (const bad of ['2026.11.20', 'v2026.05.12', 'v2026.13.1', 'v2026.5.32', 'v2026.5.12-0', 'v2026.5.12-beta', '0.1.0']) {
    assert.doesNotMatch(bad, PRODUCT_VERSION_PATTERN)
  }
})
