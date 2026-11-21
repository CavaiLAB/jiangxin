#!/usr/bin/env node
// 本机假模型服务：不带第三方依赖，只用 Node 自带模块。
//
// 两种协议：
//   - OpenAI Chat Completions：POST /v1/chat/completions（也接受 /chat/completions），
//     给发行配置里的 llm-pi-ai 路由用。
//   - Anthropic Messages：POST /v1/messages、/anthropic/v1/messages，
//     给外联检查「关之前」那一遍冒充 DeepSeek 官方接口用（DSH 的官方适配器说的是 Messages 协议）。
// 两种都支持流式（SSE）和非流式。
//
// 行为：
//   - 普通问题：回一段固定文字。
//   - 问题里带约定关键词（见 TOOL_KEYWORDS）：回一次工具调用（优先用 DSH 的 read 工具读文件，
//     没有 read 时退到 bash 的 cat）；拿到工具结果后再回一段文字，里面引用读到的内容开头。
//   - DSH 生成会话标题的辅助请求：回一个短标题。
//
// 环境变量：
//   MOCK_MODEL_HOST（默认 127.0.0.1）、MOCK_MODEL_PORT（默认 3190）
//   MOCK_MODEL_LOG（默认 <本目录>/.dev/requests.jsonl，每个请求一行；密钥只记有没有、多长）
//   MOCK_MODEL_DEFAULT_FILE（关键词后面没写文件名时读哪个文件，默认 jiangxin-demo.txt）
//   MOCK_MODEL_CHUNK_DELAY_MS（流式每块之间停多久，默认 15）

import { createServer } from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOST = process.env.MOCK_MODEL_HOST || '127.0.0.1'
const PORT = Number(process.env.MOCK_MODEL_PORT || 3190)
const LOG_PATH = process.env.MOCK_MODEL_LOG || join(HERE, '.dev', 'requests.jsonl')
const DEFAULT_FILE = process.env.MOCK_MODEL_DEFAULT_FILE || 'jiangxin-demo.txt'
const CHUNK_DELAY_MS = Number(process.env.MOCK_MODEL_CHUNK_DELAY_MS ?? 15)

const MODELS = [
  { id: 'jx-mock-1', name: '匠心假模型 1（本机测试）' },
  // 「关之前」那一遍里 DSH 默认选的是 DeepSeek 官方路由的模型 id，照单全收。
  { id: 'deepseek-flash', name: 'deepseek-flash（假）' },
  { id: 'deepseek-v4-pro', name: 'deepseek-v4-pro（假）' },
]

const TOOL_KEYWORDS = ['读文件', '读取文件', 'read file', 'MOCK_TOOL']
const PLAIN_REPLY =
  '你好，我是匠心工业智能体平台演示用的本机假模型。这段回复是固定的，只用来验证对话链路走得通。' +
  '如果想看工具调用，请在问题里写「读文件」加文件名，例如：读文件 jiangxin-demo.txt。'
const TITLE_REPLY = '假模型测试会话'

// ---------------------------------------------------------------------------
// 日志

function logRequest(entry) {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true })
    appendFileSync(LOG_PATH, JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n')
  } catch (error) {
    console.error(`[mock-model] 写日志失败：${error.message}`)
  }
}

const SECRET_HEADERS = new Set(['authorization', 'x-api-key', 'cookie', 'x-dsh-auth-token', 'api-key'])

function summarizeHeaders(headers) {
  const out = {}
  for (const [name, value] of Object.entries(headers)) {
    if (SECRET_HEADERS.has(name)) {
      out[name] = `<已隐去，长度 ${String(value).length}>`
    } else {
      out[name] = value
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 请求内容的解析（两种协议共用）

function textOfContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part?.type === 'text' || part?.type === 'input_text') return part.text ?? ''
      if (part?.type === 'tool_result') return textOfContent(part.content)
      return ''
    })
    .join('')
}

/** 把两种协议的消息统一成 { role, text, toolResult } 的列表。 */
function normalizeMessages(protocol, body) {
  const out = []
  if (protocol === 'anthropic') {
    const system = typeof body.system === 'string' ? body.system : textOfContent(body.system)
    if (system) out.push({ role: 'system', text: system })
    for (const message of body.messages ?? []) {
      const blocks = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }]
      const toolResults = blocks.filter((block) => block?.type === 'tool_result')
      if (message.role === 'user' && toolResults.length > 0) {
        out.push({ role: 'tool', text: toolResults.map((block) => textOfContent(block.content)).join('\n') })
      } else {
        out.push({ role: message.role, text: textOfContent(message.content) })
      }
    }
    return out
  }
  for (const message of body.messages ?? []) {
    out.push({ role: message.role, text: textOfContent(message.content) })
  }
  return out
}

function toolNamesOf(protocol, body) {
  const tools = body.tools ?? []
  return tools
    .map((tool) => (protocol === 'anthropic' ? tool?.name : tool?.function?.name ?? tool?.name))
    .filter(Boolean)
}

function pickFilePath(text) {
  for (const keyword of TOOL_KEYWORDS) {
    const index = text.indexOf(keyword)
    if (index === -1) continue
    const rest = text.slice(index + keyword.length).trim()
    const match = rest.match(/^[「"'“]?([^\s「」"'“”，。,]+)/)
    if (match && /[./\\]/.test(match[1])) return match[1]
  }
  return DEFAULT_FILE
}

/** 决定这一轮回什么：普通文字、工具调用，还是工具结果之后的总结。 */
function decide(protocol, body) {
  const messages = normalizeMessages(protocol, body)
  const systemText = messages.filter((m) => m.role === 'system' || m.role === 'developer').map((m) => m.text).join('\n')
  const last = messages[messages.length - 1]
  const toolNames = toolNamesOf(protocol, body)
  // DSH 会在用户的提问后面再追加一条「运行时上下文」的 user 消息（时间、时区等），
  // 所以要看本轮（最后一条 assistant 之后）的全部 user 消息，而不是只看最后一条。
  let turnStart = messages.length
  while (turnStart > 0 && messages[turnStart - 1].role !== 'assistant') turnStart -= 1
  const turnUserText = messages.slice(turnStart).filter((m) => m.role === 'user').map((m) => m.text).join('\n')

  if (last?.role === 'tool') {
    // DSH 的 read 工具结果形如「<path>…</path>」加带行号的正文；摘要时去掉标签、路径和行号。
    const preview = last.text
      .replace(/<path>[\s\S]*?<\/path>/g, ' ')
      .replace(/<\/?[A-Za-z_][\w-]*>/g, ' ')
      .replace(/^\s*\d+[\t│|:]\s?/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
    return {
      kind: 'text',
      text:
        '工具调用已完成，下面是根据工具结果给出的回复。' +
        `读到的内容开头是：「${preview || '（空）'}」。` +
        '以上来自本机假模型，不代表真实模型的能力。',
      reason: 'after-tool-result',
    }
  }

  // DSH 的会话标题插件发的辅助请求：系统提示里会要求给会话起标题，而且不带工具。
  if (toolNames.length === 0 && /title/i.test(systemText) && messages.length <= 3) {
    return { kind: 'text', text: TITLE_REPLY, reason: 'session-title' }
  }

  const userText = turnUserText
  if (TOOL_KEYWORDS.some((keyword) => userText.includes(keyword))) {
    const filePath = pickFilePath(userText)
    if (toolNames.includes('read')) {
      return { kind: 'tool', name: 'read', input: { file_path: filePath }, reason: 'keyword->read' }
    }
    if (toolNames.includes('bash')) {
      return { kind: 'tool', name: 'bash', input: { command: `cat ${JSON.stringify(filePath)}` }, reason: 'keyword->bash' }
    }
    return {
      kind: 'text',
      text: `请求里没有可用的读文件工具（收到的工具：${toolNames.join('、') || '无'}），所以只能回文字。`,
      reason: 'keyword-but-no-tool',
    }
  }
  return { kind: 'text', text: PLAIN_REPLY, reason: 'plain' }
}

// ---------------------------------------------------------------------------
// 输出

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function chunksOf(text, size = 12) {
  const chars = [...text]
  const out = []
  for (let i = 0; i < chars.length; i += size) out.push(chars.slice(i, i + size).join(''))
  return out
}

function roughTokens(text) {
  return Math.max(1, Math.ceil([...String(text)].length / 2))
}

function sendJson(res, status, value) {
  const payload = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

function startSse(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
}

async function respondOpenAI(res, body, decision, inputTokens) {
  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const model = body.model || MODELS[0].id
  const outputText = decision.kind === 'text' ? decision.text : JSON.stringify(decision.input)
  const usage = {
    prompt_tokens: inputTokens,
    completion_tokens: roughTokens(outputText),
    total_tokens: inputTokens + roughTokens(outputText),
  }

  if (!body.stream) {
    const message =
      decision.kind === 'text'
        ? { role: 'assistant', content: decision.text }
        : {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: `call_${randomUUID().slice(0, 8)}`, type: 'function', function: { name: decision.name, arguments: JSON.stringify(decision.input) } },
            ],
          }
    sendJson(res, 200, {
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [{ index: 0, message, finish_reason: decision.kind === 'text' ? 'stop' : 'tool_calls' }],
      usage,
    })
    return
  }

  startSse(res)
  const write = (choices, extra = {}) =>
    res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model, choices, ...extra })}\n\n`)

  if (decision.kind === 'text') {
    write([{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }])
    for (const piece of chunksOf(decision.text)) {
      await sleep(CHUNK_DELAY_MS)
      write([{ index: 0, delta: { content: piece }, finish_reason: null }])
    }
    write([{ index: 0, delta: {}, finish_reason: 'stop' }])
  } else {
    const callId = `call_${randomUUID().slice(0, 8)}`
    write([
      {
        index: 0,
        delta: { role: 'assistant', content: null, tool_calls: [{ index: 0, id: callId, type: 'function', function: { name: decision.name, arguments: '' } }] },
        finish_reason: null,
      },
    ])
    for (const piece of chunksOf(JSON.stringify(decision.input), 8)) {
      await sleep(CHUNK_DELAY_MS)
      write([{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: piece } }] }, finish_reason: null }])
    }
    write([{ index: 0, delta: {}, finish_reason: 'tool_calls' }])
  }
  if (body.stream_options?.include_usage) write([], { usage })
  res.write('data: [DONE]\n\n')
  res.end()
}

async function respondAnthropic(res, body, decision, inputTokens) {
  const id = `msg_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const model = body.model || MODELS[0].id
  const outputText = decision.kind === 'text' ? decision.text : JSON.stringify(decision.input)
  const outputTokens = roughTokens(outputText)
  const stopReason = decision.kind === 'text' ? 'end_turn' : 'tool_use'
  const toolId = `toolu_${randomUUID().replace(/-/g, '').slice(0, 24)}`

  if (!body.stream) {
    const content =
      decision.kind === 'text'
        ? [{ type: 'text', text: decision.text }]
        : [{ type: 'tool_use', id: toolId, name: decision.name, input: decision.input }]
    sendJson(res, 200, {
      id,
      type: 'message',
      role: 'assistant',
      model,
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    })
    return
  }

  startSse(res)
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`)
  send('message_start', {
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: 1 },
    },
  })
  if (decision.kind === 'text') {
    send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    send('ping', {})
    for (const piece of chunksOf(decision.text)) {
      await sleep(CHUNK_DELAY_MS)
      send('content_block_delta', { index: 0, delta: { type: 'text_delta', text: piece } })
    }
  } else {
    send('content_block_start', { index: 0, content_block: { type: 'tool_use', id: toolId, name: decision.name, input: {} } })
    for (const piece of chunksOf(JSON.stringify(decision.input), 8)) {
      await sleep(CHUNK_DELAY_MS)
      send('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: piece } })
    }
  }
  send('content_block_stop', { index: 0 })
  send('message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: outputTokens } })
  send('message_stop', {})
  res.end()
}

// ---------------------------------------------------------------------------
// 路由

const KNOWN_BODY_KEYS = new Set([
  'model', 'messages', 'system', 'stream', 'stream_options', 'tools', 'tool_choice', 'max_tokens',
  'max_completion_tokens', 'temperature', 'top_p', 'top_k', 'stop', 'stop_sequences', 'metadata',
  'reasoning_effort', 'thinking', 'parallel_tool_calls', 'n', 'store', 'user', 'response_format',
  'seed', 'frequency_penalty', 'presence_penalty', 'logprobs', 'top_logprobs', 'service_tier',
  'prompt_cache_key', 'output_config',
])

function protocolOf(method, path) {
  if (method !== 'POST') return null
  if (/^\/(v1\/)?chat\/completions$/.test(path)) return 'openai'
  if (/^\/(anthropic\/)?v1\/messages$/.test(path)) return 'anthropic'
  return null
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  try {
    if (req.method === 'GET' && (path === '/healthz' || path === '/')) {
      sendJson(res, 200, { ok: true, service: 'jiangxin-mock-model' })
      return
    }
    if (req.method === 'GET' && /^\/(v1\/)?models$/.test(path)) {
      logRequest({ method: req.method, path, headers: summarizeHeaders(req.headers), kind: 'models-list' })
      sendJson(res, 200, {
        object: 'list',
        data: MODELS.map((model) => ({ id: model.id, object: 'model', created: 0, owned_by: 'jiangxin-mock', display_name: model.name })),
      })
      return
    }

    const protocol = protocolOf(req.method, path)
    const raw = await readBody(req)
    if (!protocol) {
      logRequest({ method: req.method, path, headers: summarizeHeaders(req.headers), kind: 'unknown-route', bodyBytes: raw.length })
      sendJson(res, 404, { error: { message: `假模型不认识这个路径：${req.method} ${path}`, type: 'not_found' } })
      return
    }

    let body
    try {
      body = JSON.parse(raw.toString('utf8') || '{}')
    } catch {
      sendJson(res, 400, { error: { message: '请求体不是合法的 JSON', type: 'invalid_request_error' } })
      return
    }

    const decision = decide(protocol, body)
    const messages = normalizeMessages(protocol, body)
    const lastUser = [...messages].reverse().find((m) => m.role === 'user' && !m.text.startsWith('Time sampled while preparing'))
    const inputTokens = roughTokens(JSON.stringify(body.messages ?? []))
    logRequest({
      method: req.method,
      path,
      protocol,
      headers: summarizeHeaders(req.headers),
      model: body.model,
      stream: Boolean(body.stream),
      messageCount: messages.length,
      lastRole: messages[messages.length - 1]?.role,
      lastUserText: (lastUser?.text ?? '').slice(0, 200),
      lastToolText: messages[messages.length - 1]?.role === 'tool' ? messages[messages.length - 1].text.slice(0, 300) : undefined,
      tools: toolNamesOf(protocol, body),
      extraBodyKeys: Object.keys(body).filter((key) => !KNOWN_BODY_KEYS.has(key)),
      bodyBytes: raw.length,
      decision: { kind: decision.kind, reason: decision.reason, tool: decision.name ?? null },
    })

    if (protocol === 'openai') await respondOpenAI(res, body, decision, inputTokens)
    else await respondAnthropic(res, body, decision, inputTokens)
  } catch (error) {
    console.error('[mock-model] 处理请求出错：', error)
    if (!res.headersSent) sendJson(res, 500, { error: { message: String(error?.message ?? error), type: 'server_error' } })
    else res.end()
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[mock-model] 在 http://${HOST}:${PORT} 上监听（OpenAI: /v1/chat/completions，Anthropic: /v1/messages），日志：${LOG_PATH}`)
})

const stop = () => server.close(() => process.exit(0))
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
