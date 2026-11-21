#!/usr/bin/env node
// 设置锁定验证：把发行补丁放在 DSH 配置的不同层里，分别用 Web 界面同样的写入接口去改钉住的设置，
// 看哪一层能锁住。只用 Node 自带模块。
//
// 用法：node distribution/tests/settings-lock.mjs [层名...]
//   层名：bundle profile home cli（默认全跑）。每一层用一个全新的状态目录：
//   distribution/.dev/settings-lock/<层名>/home。端口用 3180（跑之前要先停掉占用 3180 的 Web 端）。
//
// 每一层做两次写入，都是界面上能点出来的：
//   1. 「设置 → 通用 → 使用官方模型 API 时上传 Session Log」：session-log-deepseek.enabled = true
//   2. 「设置 → 模型 → 编辑 → API 地址」：llm-pi-ai.providers.jiangxin.baseURL = http://127.0.0.1:3999/v1
// 结果写到 distribution/.dev/settings-lock/results.json，并在终端打印一张表。

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from 'node:http'
import { randomUUID } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = join(HERE, '..')
const DSH = join(DIST, 'node_modules', '.bin', 'dsh')
const PATCH_DIR = join(DIST, 'patches')
const OUT = join(DIST, '.dev', 'settings-lock')
const PORT = 3180
const LAYERS = ['bundle', 'profile', 'home', 'cli']

const WRITES = [
  {
    id: 'session-log-upload',
    ui: '设置 → 通用 → 使用官方模型 API 时上传 Session Log',
    ns: 'session-log-deepseek',
    ops: [{ op: 'set', path: ['enabled'], value: true }],
  },
  {
    id: 'model-route-baseurl',
    ui: '设置 → 模型 → 编辑 → API 地址',
    ns: 'llm-pi-ai',
    ops: [{ op: 'set', path: ['providers', 'jiangxin', 'baseURL'], value: 'http://127.0.0.1:3999/v1' }],
  },
]

const patchFiles = readdirSync(PATCH_DIR).filter((f) => f.endsWith('.yml')).sort().map((f) => join(PATCH_DIR, f))
const combinedPatch = patchFiles.map((f) => readFileSync(f, 'utf8')).join('\n')

function baseEnv(home) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DSH_HOME: home,
    DSH_AGENTS_HOME: join(home, '..', 'agents-home'),
    DSH_TELEMETRY_MODE: 'DISABLED',
    JX_MODEL_API_KEY: 'jx-local-mock-key-not-a-secret',
    JX_NPM_REGISTRY: 'http://127.0.0.1:9/',
    npm_config_registry: 'http://127.0.0.1:9/',
    npm_config_update_notifier: 'false',
  }
}

function cliPatchArgs(layer) {
  return layer === 'cli' ? patchFiles.flatMap((f) => ['--patch', f]) : []
}

/** 准备一层：建全新状态目录，把发行补丁放进对应的层。 */
function prepare(layer) {
  const root = join(OUT, layer)
  rmSync(root, { recursive: true, force: true })
  const home = join(root, 'home')
  const workspace = join(root, 'workspace')
  mkdirSync(home, { recursive: true })
  mkdirSync(workspace, { recursive: true })
  mkdirSync(join(root, 'agents-home'), { recursive: true })
  const env = baseEnv(home)
  // 先 dump 一次，让 DSH 从模板建好 web 这个 profile。
  const init = spawnSync(DSH, ['--profile', 'web', '--dump-config'], { cwd: workspace, env, encoding: 'utf8' })
  if (init.status !== 0) throw new Error(`[${layer}] 初始化 profile 失败：${init.stderr}`)
  const profileDir = join(home, 'profiles', 'web')
  if (layer === 'profile') {
    writeFileSync(join(profileDir, 'cordis.patch.yml'), combinedPatch)
  } else if (layer === 'home') {
    writeFileSync(join(home, 'cordis.patch.yml'), combinedPatch)
  } else if (layer === 'bundle') {
    // 一个本地路径的组合包：package.json 声明 dsh.bundle，补丁就是发行补丁的合集。
    const bundleDir = join(root, 'jx-lock-test-bundle')
    mkdirSync(bundleDir, { recursive: true })
    writeFileSync(
      join(bundleDir, 'package.json'),
      JSON.stringify(
        {
          name: '@jx/lock-test-bundle',
          version: '0.0.0',
          private: true,
          type: 'module',
          files: ['cordis.patch.yml'],
          engines: { dsh: '>=0.2.2-rc.5 <0.3.0' },
          dsh: { bundle: { patch: './cordis.patch.yml' } },
        },
        null,
        2,
      ) + '\n',
    )
    writeFileSync(join(bundleDir, 'cordis.patch.yml'), combinedPatch)
    const add = spawnSync(DSH, ['plugin', '--profile', 'web', 'add', bundleDir], { cwd: workspace, env, encoding: 'utf8' })
    if (add.status !== 0) throw new Error(`[${layer}] dsh plugin add 失败：\n${add.stdout}\n${add.stderr}`)
  }
  return { root, home, workspace, env, profileDir }
}

function httpRequest({ method, path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, method, path, headers: { host: `127.0.0.1:${PORT}`, ...headers } }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function waitForUrl(child, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error(`等待启动超时，输出：\n${buffer}`)), timeoutMs)
    const onData = (chunk) => {
      buffer += chunk.toString()
      const match = buffer.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/)
      if (match) {
        clearTimeout(timer)
        resolve({ url: match[1], output: () => buffer })
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`DSH 提前退出（${code}），输出：\n${buffer}`))
    })
  })
}

async function stop(child) {
  if (child.exitCode !== null) return
  await new Promise((resolve) => {
    child.once('exit', resolve)
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 8000)
  })
}

async function runLayer(layer) {
  const { root, workspace, env, home, profileDir } = prepare(layer)
  const args = ['--profile', 'web', ...cliPatchArgs(layer), '--host', '127.0.0.1', '--port', String(PORT), '--no-open']
  const child = spawn(DSH, args, { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const result = { layer, writes: [], startupWarnings: [] }
  try {
    const { url, output } = await waitForUrl(child)
    const token = new URL(url).searchParams.get('token')
    // 和浏览器一样：GET /?token=… 换一个签名 cookie。
    const login = await httpRequest({ method: 'GET', path: `/?token=${encodeURIComponent(token)}` })
    const setCookie = [].concat(login.headers['set-cookie'] ?? [])
    const cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
    result.login = { status: login.status, location: login.headers.location, cookieAttributes: setCookie.map((c) => c.split(';').slice(1).map((s) => s.trim()).join('; ')) }
    for (const write of WRITES) {
      const response = await httpRequest({
        method: 'POST',
        path: '/api/settings/mutate',
        headers: { 'content-type': 'application/json', cookie, origin: `http://127.0.0.1:${PORT}` },
        body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method: 'settings/mutate', payload: { args: { ns: write.ns, ops: write.ops } } }),
      })
      let parsed
      try {
        parsed = JSON.parse(response.body)
      } catch {
        parsed = { raw: response.body.slice(0, 300) }
      }
      const ok = parsed?.result?.ok === true
      result.writes.push({
        id: write.id,
        ui: write.ui,
        httpStatus: response.status,
        accepted: ok,
        errorCode: ok ? null : parsed?.result?.error?.code ?? null,
        errorMessage: ok ? null : parsed?.result?.error?.message ?? parsed?.raw ?? null,
      })
    }
    result.startupWarnings = output().split('\n').filter((l) => /warning|did not activate/i.test(l))
  } finally {
    await stop(child)
  }
  // 写入之后，用同样的层再 dump 一次，看最终生效的值。
  const dump = spawnSync(DSH, ['--profile', 'web', ...cliPatchArgs(layer), '--dump-config'], { cwd: workspace, env, encoding: 'utf8' })
  const effective = {}
  for (const [key, re] of [
    ['session-log-deepseek.enabled', /- id: session-log-deepseek\n(?:.*\n)*?\s+enabled: (\S+)/],
    ['llm-pi-ai.jiangxin.baseURL', /- id: llm-pi-ai\n(?:.*\n)*?\s+baseURL: (.+)/],
  ]) {
    const m = dump.stdout.match(re)
    effective[key] = m ? m[1].trim() : null
  }
  result.effectiveAfterWrites = effective
  result.profilePatchAfter = existsSync(join(profileDir, 'cordis.patch.yml')) ? readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8').split('\n').filter((l) => /enabled: (true|false)|baseURL:|3999/.test(l)).map((l) => l.trim()) : []
  result.stateDir = home
  void root
  return result
}

const wanted = process.argv.slice(2).length > 0 ? process.argv.slice(2) : LAYERS
mkdirSync(OUT, { recursive: true })
const results = []
for (const layer of wanted) {
  if (!LAYERS.includes(layer)) throw new Error(`不认识的层：${layer}`)
  process.stderr.write(`== ${layer} 层 ...\n`)
  results.push(await runLayer(layer))
}
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ time: new Date().toISOString(), results }, null, 2) + '\n')

const label = { bundle: '组合包层（profile 的 bundles）', profile: 'profile 层（profiles/web/cordis.patch.yml）', home: '家目录层（$DSH_HOME/cordis.patch.yml）', cli: '命令行层（--patch）' }
console.log('| 补丁放在哪一层 | 写入 | 结果 | 写入后生效的值 |')
console.log('|---|---|---|---|')
for (const r of results) {
  for (const w of r.writes) {
    const key = w.id === 'session-log-upload' ? 'session-log-deepseek.enabled' : 'llm-pi-ai.jiangxin.baseURL'
    const verdict = w.accepted ? '写入成功（没锁住）' : `被拒绝：${w.errorCode}`
    console.log(`| ${label[r.layer]} | ${w.ui} | ${verdict} | ${key} = ${r.effectiveAfterWrites[key]} |`)
  }
}
