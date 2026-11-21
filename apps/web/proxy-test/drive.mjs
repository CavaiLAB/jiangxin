#!/usr/bin/env node
// 反向代理验证里驱动浏览器的脚本（在 jx-egress/browser 容器里跑）。
// 打开 DSH 打印出来的公开地址（https://jx.example.test/ui/?token=…），完成一轮带工具调用的对话，
// 并记下：令牌交换后的地址、cookie 的属性、WebSocket 是否经代理建立。结果写 <out>/proxy-drive.json。
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : fallback
}
const url = arg('url')
const out = arg('out', '/out')
const result = { url: url.replace(/token=[^&]+/, 'token=<已隐去>'), steps: [], websockets: [], apiStatuses: {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ locale: 'zh-CN', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 } })
const page = await context.newPage()
page.on('websocket', (ws) => result.websockets.push(ws.url()))
page.on('response', (response) => {
  const u = new URL(response.url())
  if (u.pathname.startsWith('/ui/api/')) {
    const key = `${response.status()}`
    result.apiStatuses[key] = (result.apiStatuses[key] ?? 0) + 1
  }
})

async function step(name, fn) {
  try {
    const detail = await fn()
    result.steps.push({ name, ok: true, ...(detail ? { detail } : {}) })
  } catch (error) {
    result.steps.push({ name, ok: false, error: String(error?.message ?? error).slice(0, 400) })
  }
  await page.screenshot({ path: join(out, `proxy-${result.steps.length}-${name}.png`) }).catch(() => {})
}

await step('open-public-url', async () => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  return { landedOn: page.url() }
})
await step('cookie-attributes', async () => {
  const cookies = await context.cookies()
  return cookies.map((c) => ({ name: c.name.replace(/[A-Za-z0-9_-]{12,}/, '<…>'), path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, domain: c.domain }))
})
await step('dismiss-notice', async () => {
  const button = page.getByRole('button', { name: '继续', exact: true })
  await button.waitFor({ state: 'visible', timeout: 15000 })
  await button.click()
})
await step('chat-with-tool-call', async () => {
  const box = page.getByRole('textbox', { name: /描述你想要构建的内容|发消息或创建任务/ }).first()
  await box.waitFor({ state: 'visible', timeout: 30000 })
  await box.click()
  await box.fill('请读文件 jiangxin-demo.txt')
  await page.keyboard.press('Enter')
  await page.getByText('工具调用已完成').first().waitFor({ timeout: 120000 })
  await sleep(1000)
  const text = await page.locator('body').innerText()
  return { replySnippet: (text.match(/工具调用已完成[^\n]{0,80}/) ?? [''])[0] }
})

await browser.close()
writeFileSync(join(out, 'proxy-drive.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
