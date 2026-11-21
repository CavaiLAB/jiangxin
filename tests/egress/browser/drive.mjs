#!/usr/bin/env node
// 外联检查里驱动 Web 界面的脚本（在 jx-egress/browser 容器里跑，挂载到 /opt/jx/browser/drive.mjs）。
// 「关之前」和「关之后」两遍跑的是同一份脚本、同样的操作：
//   1. 用带令牌的地址打开界面，关掉「预览版说明」
//   2. 发一条带「读文件」的问题，等到模型根据工具结果回复（一轮带工具调用的完整对话）
//   3. 给回答点「好的回答」，在弹出的「提交反馈」里写一句话并提交（DSH 默认的遥测由这个动作触发）
//   4. 打开设置，依次切到「通用设置」「模型」「内置插件」「Agent 预设」
//   5. 打开插件页，点「更多」，再点一个未安装的官方插件（Codex 子智能体）看详情
//   6. 静置一段时间，留给后台的定时请求
// 每一步写一行到 <out>/drive.jsonl，并截图；页面向 DSH 以外的地址发的请求单独记下来。
//
// 用法：node drive.mjs --url http://10.250.73.10:3180/?token=… --out /out [--idle 20]

import { chromium } from 'playwright-core'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : fallback
}
const url = arg('url')
const out = arg('out', '/out')
const idleSeconds = Number(arg('idle', '20'))
if (!url) throw new Error('缺 --url')
const origin = new URL(url).origin
mkdirSync(out, { recursive: true })

const log = (step, extra = {}) => appendFileSync(join(out, 'drive.jsonl'), JSON.stringify({ t: new Date().toISOString(), step, ...extra }) + '\n')
let shot = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 860 },
})
const page = await context.newPage()
page.on('request', (request) => {
  const u = request.url()
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) log('page-request-outside-dsh', { url: u, method: request.method() })
})
page.on('console', (msg) => {
  if (msg.type() === 'error') log('page-console-error', { text: msg.text().slice(0, 300) })
})

async function step(name, fn) {
  const started = Date.now()
  try {
    await fn()
    log(name, { ok: true, ms: Date.now() - started })
  } catch (error) {
    log(name, { ok: false, ms: Date.now() - started, error: String(error?.message ?? error).slice(0, 500) })
  }
  try {
    await page.screenshot({ path: join(out, `${String(++shot).padStart(2, '0')}-${name}.png`) })
  } catch {
    /* 截图失败不影响后续步骤 */
  }
}

await step('open', async () => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
})

await step('dismiss-notice', async () => {
  const button = page.getByRole('button', { name: '继续', exact: true })
  await button.waitFor({ state: 'visible', timeout: 15000 })
  await button.click()
  await sleep(1000)
})

/** 点第一个可见的匹配元素。 */
async function clickFirstVisible(locator, what) {
  const count = await locator.count()
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i)
    if (await item.isVisible().catch(() => false)) {
      await item.click()
      return
    }
  }
  throw new Error(`找不到可见的「${what}」`)
}

/** 打开设置：我们的发行版侧栏底部直接是「设置」；DSH 默认配置下那里是账号菜单「更多」，设置在菜单里。 */
async function openSettings() {
  const direct = page.getByRole('button', { name: '设置', exact: true })
  if (await direct.first().isVisible().catch(() => false)) {
    await direct.first().click()
    return 'direct'
  }
  // 侧栏顶部也有一个「更多」（插件菜单），这里要的是最靠下的那个（账号菜单入口）。
  const candidates = page.getByText('更多', { exact: true })
  let bottom = null
  let bottomY = -1
  for (let i = 0; i < (await candidates.count()); i++) {
    const box = await candidates.nth(i).boundingBox().catch(() => null)
    if (box && box.y > bottomY) {
      bottomY = box.y
      bottom = candidates.nth(i)
    }
  }
  if (!bottom) throw new Error('找不到侧栏底部的「更多」')
  await bottom.click()
  await sleep(1000)
  await clickFirstVisible(page.getByText('设置', { exact: true }), '设置')
  return 'account-menu'
}

await step('chat-with-tool-call', async () => {
  // 输入框是带无障碍名称的可编辑区域，不是带 placeholder 属性的原生输入框。
  const box = page.getByRole('textbox', { name: /描述你想要构建的内容|发消息或创建任务/ }).first()
  await box.waitFor({ state: 'visible', timeout: 30000 })
  await box.click()
  await box.fill('请读文件 jiangxin-demo.txt，然后告诉我里面写了什么')
  await page.keyboard.press('Enter')
  await page.getByText('工具调用已完成').first().waitFor({ timeout: 120000 })
  await sleep(1500)
  writeFileSync(join(out, 'chat.txt'), await page.locator('body').innerText())
})

await step('feedback-good-answer', async () => {
  await page.getByRole('button', { name: '好的回答' }).last().click()
  const note = page.getByPlaceholder(/填写详情/)
  await note.waitFor({ state: 'visible', timeout: 10000 })
  await note.fill('外联检查：测试反馈')
  await page.getByRole('button', { name: '提交', exact: true }).click()
  await sleep(2000)
})

await step('settings', async () => {
  const how = await openSettings()
  log('settings-opened-via', { how })
  await sleep(1500)
  const seen = []
  for (const tab of ['通用设置', '模型', '内置插件', 'Agent 预设', '账号']) {
    const target = page.getByText(tab, { exact: true })
    if (!(await target.first().isVisible().catch(() => false))) continue
    await clickFirstVisible(target, tab)
    seen.push(tab)
    await sleep(2500)
    await page.screenshot({ path: join(out, `${String(shot).padStart(2, '0')}-settings-${tab.replace(/\s+/g, '')}.png`) })
  }
  log('settings-tabs', { seen })
  if (seen.length === 0) throw new Error('设置里一个标签也没点到')
  await page.keyboard.press('Escape')
  await sleep(1000)
})

await step('plugins', async () => {
  await page.getByRole('button', { name: '插件', exact: true }).first().click()
  await sleep(3000)
  await page.screenshot({ path: join(out, `${String(shot).padStart(2, '0')}-plugins-page.png`) })
  await page.getByRole('button', { name: '更多', exact: true }).last().click()
  await sleep(2500)
  await page.screenshot({ path: join(out, `${String(shot).padStart(2, '0')}-plugins-more.png`) })
  await page.getByText('Codex 子智能体', { exact: true }).first().click()
  await sleep(6000)
})

await step('idle', async () => {
  await sleep(idleSeconds * 1000)
})

await browser.close()
log('done')
