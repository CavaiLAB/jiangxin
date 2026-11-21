#!/usr/bin/env node
// 外联检查的接收器（只用 Node 自带模块，加上容器里的 openssl 命令）。
//
// 它在一个出不了外网的 Docker 网络里扮演「整个互联网」：
//   - 假 DNS（UDP/TCP 53）：除白名单里的名字外，所有 A 记录都指向接收器自己；AAAA/HTTPS 记录一律空，
//     让客户端走 IPv4。每次查询都记下来。
//   - HTTP（80）和 HTTPS（443）万能接收器：HTTPS 按客户端发来的 SNI 现场用自签 CA 签一张证书。
//     被测的 DSH 进程通过 NODE_EXTRA_CA_CERTS 信任这个 CA，所以能看到完整的路径、请求头和请求体；
//     不信任这个 CA 的客户端也会在握手时留下 SNI。请求体解压后存成文件，便于事后检查。
//   - 若干常见端口的原始 TCP 记录器（记下谁连了、发了什么开头的字节）。
//   - 转发规则：把指定主机和路径前缀的请求转给假模型（「关之前」那一遍让 DSH 默认的
//     DeepSeek 官方路由能完成对话，从而观察它在完整一轮对话里会发什么）。
//
// 环境变量：
//   SINK_IP              接收器自己的 IP（DNS 的默认答案）
//   SINK_OUT             输出目录（默认 /out）：sink-events.jsonl、bodies/、ca/
//   SINK_STATIC_HOSTS    白名单解析，例：model-gateway.jx.test=10.250.73.3
//   SINK_FORWARDS        转发规则，例：api.deepseek.com/anthropic/=http://10.250.73.3:3190
//   SINK_RAW_PORTS       原始 TCP 记录的端口，逗号分隔

import dgram from 'node:dgram'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import tls from 'node:tls'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.SINK_OUT || '/out'
const SELF_IP = process.env.SINK_IP
if (!SELF_IP || !net.isIPv4(SELF_IP)) throw new Error('SINK_IP 必须是接收器自己的 IPv4 地址')
const STATIC = Object.fromEntries(
  (process.env.SINK_STATIC_HOSTS || '').split(',').filter(Boolean).map((pair) => pair.split('=').map((s) => s.trim().toLowerCase())),
)
const FORWARDS = (process.env.SINK_FORWARDS || '')
  .split(',')
  .filter(Boolean)
  .map((rule) => {
    const [match, target] = rule.split('=')
    const slash = match.indexOf('/')
    return { host: match.slice(0, slash).toLowerCase(), prefix: match.slice(slash), target: new URL(target) }
  })
const RAW_PORTS = (process.env.SINK_RAW_PORTS || '').split(',').filter(Boolean).map(Number)
const EVENTS = join(OUT, 'sink-events.jsonl')
const BODIES = join(OUT, 'bodies')
const CA_DIR = join(OUT, 'ca')
mkdirSync(BODIES, { recursive: true })
mkdirSync(CA_DIR, { recursive: true })

let seq = 0
function record(kind, data) {
  appendFileSync(EVENTS, JSON.stringify({ t: new Date().toISOString(), seq: ++seq, kind, ...data }) + '\n')
}

// ---------------------------------------------------------------------------
// 自签 CA 与按 SNI 现签的证书

const openssl = (...args) => execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'pipe'] })
const caKey = join(CA_DIR, 'ca.key')
const caPem = join(CA_DIR, 'ca.pem')
const leafKey = join(CA_DIR, 'leaf.key')
if (!existsSync(caPem)) {
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', caKey, '-out', caPem, '-days', '3',
    '-subj', '/CN=jx-egress-sink-ca', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign')
  openssl('genrsa', '-out', leafKey, '2048')
}
const leafKeyPem = readFileSync(leafKey)
const caCertPem = readFileSync(caPem)

const contexts = new Map()
function certFor(name) {
  const safe = /^[A-Za-z0-9.-]{1,253}$/.test(name) ? name.toLowerCase() : 'sink.invalid'
  if (contexts.has(safe)) return contexts.get(safe)
  const base = join(CA_DIR, safe.replace(/[^a-z0-9.-]/g, '_'))
  writeFileSync(`${base}.ext`, `subjectAltName=DNS:${safe}\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n`)
  openssl('req', '-new', '-key', leafKey, '-subj', `/CN=${safe}`, '-out', `${base}.csr`)
  openssl('x509', '-req', '-in', `${base}.csr`, '-CA', caPem, '-CAkey', caKey, '-CAcreateserial', '-days', '2', '-out', `${base}.pem`, '-extfile', `${base}.ext`)
  const ctx = tls.createSecureContext({ key: leafKeyPem, cert: Buffer.concat([readFileSync(`${base}.pem`), caCertPem]) })
  contexts.set(safe, ctx)
  return ctx
}

// ---------------------------------------------------------------------------
// 假 DNS

const QTYPE = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 64: 'SVCB', 65: 'HTTPS', 255: 'ANY' }

function parseQuestion(msg) {
  let off = 12
  const labels = []
  while (off < msg.length && msg[off] !== 0) {
    const len = msg[off]
    if (len > 63) throw new Error('不支持压缩的查询名')
    labels.push(msg.subarray(off + 1, off + 1 + len).toString('latin1'))
    off += len + 1
  }
  off += 1
  const qtype = msg.readUInt16BE(off)
  const qclass = msg.readUInt16BE(off + 2)
  return { name: labels.join('.').toLowerCase(), qtype, qclass, end: off + 4 }
}

function answerFor(name, qtype) {
  if (qtype !== 1) return null
  if (STATIC[name]) return STATIC[name]
  if (name.endsWith('.in-addr.arpa') || name.endsWith('.ip6.arpa')) return null
  return SELF_IP
}

function dnsResponse(msg) {
  const id = msg.readUInt16BE(0)
  const flags = msg.readUInt16BE(2)
  const q = parseQuestion(msg)
  const ip = answerFor(q.name, q.qtype)
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id, 0)
  header.writeUInt16BE(0x8000 | (flags & 0x7800) | 0x0400 | (flags & 0x0100) | 0x0080, 2) // QR, opcode, AA, RD, RA
  header.writeUInt16BE(1, 4)
  header.writeUInt16BE(ip ? 1 : 0, 6)
  const question = msg.subarray(12, q.end)
  const parts = [header, question]
  if (ip) {
    const rr = Buffer.alloc(16)
    rr.writeUInt16BE(0xc00c, 0)
    rr.writeUInt16BE(1, 2)
    rr.writeUInt16BE(1, 4)
    rr.writeUInt32BE(5, 6)
    rr.writeUInt16BE(4, 10)
    ip.split('.').forEach((octet, i) => rr.writeUInt8(Number(octet), 12 + i))
    parts.push(rr)
  }
  return { response: Buffer.concat(parts), q, ip }
}

const udp = dgram.createSocket('udp4')
udp.on('message', (msg, rinfo) => {
  try {
    const { response, q, ip } = dnsResponse(msg)
    record('dns', { src: rinfo.address, transport: 'udp', qname: q.name, qtype: QTYPE[q.qtype] ?? q.qtype, answer: ip })
    udp.send(response, rinfo.port, rinfo.address)
  } catch (error) {
    record('dns-error', { src: rinfo.address, error: String(error.message) })
  }
})
udp.bind(53, '0.0.0.0')

net
  .createServer((socket) => {
    let buffer = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 2 && buffer.length >= 2 + buffer.readUInt16BE(0)) {
        const len = buffer.readUInt16BE(0)
        const msg = buffer.subarray(2, 2 + len)
        buffer = buffer.subarray(2 + len)
        try {
          const { response, q, ip } = dnsResponse(msg)
          record('dns', { src: socket.remoteAddress?.replace('::ffff:', ''), transport: 'tcp', qname: q.name, qtype: QTYPE[q.qtype] ?? q.qtype, answer: ip })
          const out = Buffer.alloc(2 + response.length)
          out.writeUInt16BE(response.length, 0)
          response.copy(out, 2)
          socket.write(out)
        } catch (error) {
          record('dns-error', { src: socket.remoteAddress, error: String(error.message) })
        }
      }
    })
    socket.on('error', () => {})
  })
  .listen(53, '0.0.0.0')

// ---------------------------------------------------------------------------
// HTTP / HTTPS 万能接收器

const SECRET_HEADERS = new Set(['authorization', 'x-api-key', 'cookie', 'x-dsh-auth-token', 'proxy-authorization'])
const MARKERS = ['dsh_session_log', 'dsh_plugin_packages', 'ori_question', 'session-log', 'user.id', 'jiangxin-demo.txt', 'anonymous']

function redactHeaders(headers) {
  const out = {}
  for (const [k, v] of Object.entries(headers)) out[k] = SECRET_HEADERS.has(k) ? `<已隐去，长度 ${String(v).length}>` : v
  return out
}

function decode(buffer, encoding) {
  try {
    if (encoding === 'gzip') return zlib.gunzipSync(buffer)
    if (encoding === 'deflate') return zlib.inflateSync(buffer)
    if (encoding === 'br') return zlib.brotliDecompressSync(buffer)
  } catch {
    return buffer
  }
  return buffer
}

let bodyCount = 0
function saveBody(host, path, decoded) {
  if (decoded.length === 0) return null
  const name = `${String(++bodyCount).padStart(4, '0')}-${host}-${path}`.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) + '.txt'
  writeFileSync(join(BODIES, name), decoded.subarray(0, 2 * 1024 * 1024))
  return name
}

function forwardFor(host, path) {
  return FORWARDS.find((rule) => rule.host === host && path.startsWith(rule.prefix))
}

async function handle(req, res, scheme) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks)
  const host = String(req.headers.host || req.socket.servername || '').toLowerCase().replace(/:\d+$/, '')
  const url = new URL(req.url, 'http://placeholder')
  const decoded = decode(raw, String(req.headers['content-encoding'] || '').toLowerCase())
  const text = decoded.toString('utf8')
  const markers = MARKERS.filter((m) => text.includes(m))
  const forward = forwardFor(host, url.pathname)
  const entry = {
    src: req.socket.remoteAddress?.replace('::ffff:', ''),
    scheme,
    sni: req.socket.servername || null,
    host,
    method: req.method,
    path: url.pathname,
    query: url.search ? url.search.slice(0, 200) : '',
    headers: redactHeaders(req.headers),
    bodyBytes: raw.length,
    decodedBytes: decoded.length,
    bodyFile: saveBody(host, url.pathname, decoded),
    markers,
    action: forward ? `forward:${forward.target.origin}` : 'answered-locally',
  }
  if (forward) {
    const headers = { ...req.headers, host: forward.target.host, 'content-length': String(decoded.length) }
    delete headers['content-encoding']
    delete headers['transfer-encoding']
    const upstream = http.request(
      { host: forward.target.hostname, port: forward.target.port, method: req.method, path: req.url, headers },
      (up) => {
        entry.status = up.statusCode
        record('http', entry)
        res.writeHead(up.statusCode, up.headers)
        up.pipe(res)
      },
    )
    upstream.on('error', (error) => {
      entry.status = 502
      entry.forwardError = String(error.message)
      record('http', entry)
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'sink forward failed' }))
    })
    upstream.end(decoded)
    return
  }
  if (/\/v1\/(logs|traces|metrics)$/.test(url.pathname) && req.method === 'POST') {
    entry.status = 200
    record('http', entry)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"partialSuccess":{}}')
    return
  }
  entry.status = 404
  record('http', entry)
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'jiangxin egress sink: this host is not emulated' }))
}

http.createServer((req, res) => handle(req, res, 'http').catch(() => res.end())).listen(80, '0.0.0.0')

const defaultCtx = certFor('sink.invalid')
const httpsServer = https.createServer(
  {
    SNICallback: (servername, cb) => {
      record('tls-hello', { sni: servername })
      try {
        cb(null, certFor(servername))
      } catch (error) {
        record('tls-cert-error', { sni: servername, error: String(error.message) })
        cb(null, defaultCtx)
      }
    },
    key: leafKeyPem,
    cert: Buffer.concat([readFileSync(join(CA_DIR, 'sink.invalid.pem')), caCertPem]),
    ALPNProtocols: ['http/1.1'],
  },
  (req, res) => handle(req, res, 'https').catch(() => res.end()),
)
httpsServer.on('tlsClientError', (error, socket) => {
  record('tls-error', { src: socket.remoteAddress?.replace('::ffff:', ''), sni: socket.servername || null, error: String(error.code || error.message) })
})
httpsServer.on('secureConnection', (socket) => {
  record('tls-ok', { src: socket.remoteAddress?.replace('::ffff:', ''), sni: socket.servername || null, alpn: socket.alpnProtocol || null })
})
httpsServer.listen(443, '0.0.0.0')

for (const port of RAW_PORTS) {
  net
    .createServer((socket) => {
      const src = socket.remoteAddress?.replace('::ffff:', '')
      let first = Buffer.alloc(0)
      const done = () => {
        record('tcp', { src, port, firstBytesHex: first.subarray(0, 48).toString('hex'), firstBytesText: first.subarray(0, 48).toString('latin1').replace(/[^\x20-\x7e]/g, '.') })
        socket.destroy()
      }
      socket.once('data', (chunk) => {
        first = chunk
        done()
      })
      socket.setTimeout(3000, done)
      socket.on('error', () => {})
    })
    .listen(port, '0.0.0.0')
}

record('sink-ready', { selfIp: SELF_IP, static: STATIC, forwards: FORWARDS.map((f) => `${f.host}${f.prefix} -> ${f.target.origin}`), rawPorts: RAW_PORTS })
console.log(`[sink] ready on ${SELF_IP}: dns/53 http/80 https/443 raw ${RAW_PORTS.join(',')}`)
