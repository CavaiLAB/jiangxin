#!/usr/bin/env node
// 外联检查的分析：读每一遍的抓包文本（tcpdump -r 的输出）、接收器日志、假模型日志和浏览器步骤日志，
// 生成 <运行目录>/summary.json 和 summary.md。只用 Node 自带模块。
//
// 用法：node tests/egress/analyze.mjs <运行目录>

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const runDir = process.argv[2]
if (!runDir) throw new Error('用法：node analyze.mjs <运行目录>')

const IPS = { sink: '10.250.73.2', model: '10.250.73.3', dsh: '10.250.73.10', browser: '10.250.73.20' }
const DESCRIBE_IP = {
  [IPS.sink]: '接收器（假 DNS 把外部域名都指到这里）',
  [IPS.model]: '假模型网关（我们指定的模型地址）',
}
const ALLOWED_HOSTS = new Set(['model-gateway.jx.test'])

const readLines = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : [])
const readJsonl = (file) => readLines(file).map((line) => JSON.parse(line))

function splitAddr(addr) {
  const i = addr.lastIndexOf('.')
  return { ip: addr.slice(0, i), port: Number(addr.slice(i + 1)) }
}

/** 解析 tcpdump 文本，只看从 selfIp 发出的包。 */
function parsePcapText(file, selfIp) {
  const dns = new Map()
  const syn = new Map()
  const udp = new Map()
  let packets = 0
  for (const line of readLines(file)) {
    const m = line.match(/\b(IP6?) (\S+) > (\S+): (.*)$/)
    if (!m) continue
    const src = splitAddr(m[2])
    const dst = splitAddr(m[3].replace(/:$/, ''))
    const payload = m[4]
    if (src.ip !== selfIp) continue
    if (dst.ip.startsWith('127.') || dst.ip === '::1' || dst.ip === selfIp) continue
    packets++
    if (dst.port === 53) {
      const q = payload.match(/\b([A-Z0-9]+)\? (\S+?)\.? \(/)
      if (q) {
        const key = `${q[2]}|${q[1]}`
        dns.set(key, (dns.get(key) ?? 0) + 1)
      }
      continue
    }
    if (/^Flags \[S\],/.test(payload)) {
      const key = `${dst.ip}|${dst.port}`
      syn.set(key, (syn.get(key) ?? 0) + 1)
      continue
    }
    if (/\bUDP\b/.test(payload) || /^UDP,/.test(payload)) {
      const key = `${dst.ip}|${dst.port}`
      udp.set(key, (udp.get(key) ?? 0) + 1)
    }
  }
  const toRows = (map, cols) => [...map.entries()].map(([k, n]) => ({ ...Object.fromEntries(k.split('|').map((v, i) => [cols[i], v])), count: n }))
  return {
    available: existsSync(file),
    outboundPackets: packets,
    dnsQueries: toRows(dns, ['name', 'type']).sort((a, b) => a.name.localeCompare(b.name)),
    tcpConnects: toRows(syn, ['ip', 'port']).map((r) => ({ ...r, note: DESCRIBE_IP[r.ip] ?? '其他地址' })),
    udpFlows: toRows(udp, ['ip', 'port']).map((r) => ({ ...r, note: DESCRIBE_IP[r.ip] ?? '其他地址' })),
  }
}

function sinkView(events, srcIp) {
  const mine = events.filter((e) => e.src === srcIp)
  const dns = new Map()
  for (const e of mine.filter((e) => e.kind === 'dns')) {
    const key = `${e.qname}|${e.qtype}|${e.answer ?? '(空)'}`
    dns.set(key, (dns.get(key) ?? 0) + 1)
  }
  const http = new Map()
  for (const e of mine.filter((e) => e.kind === 'http')) {
    const key = `${e.scheme}://${e.host}|${e.method}|${e.path}|${e.status}`
    const prev = http.get(key) ?? { count: 0, markers: new Set(), notable: new Set(), bodyFiles: [] }
    prev.count++
    for (const m of e.markers ?? []) prev.markers.add(m)
    if (e.headers?.['x-deepseek-harness-user-id']) prev.notable.add('请求头带 x-deepseek-harness-user-id')
    if (e.headers?.['user-agent']) prev.notable.add(`UA: ${String(e.headers['user-agent']).slice(0, 80)}`)
    if (e.action?.startsWith('forward')) prev.notable.add('转给假模型作答')
    if (e.bodyFile && prev.bodyFiles.length < 3) prev.bodyFiles.push(e.bodyFile)
    http.set(key, prev)
  }
  const tls = new Map()
  for (const e of mine.filter((e) => e.kind === 'tls-ok' || e.kind === 'tls-error')) {
    const key = `${e.sni ?? '(无 SNI)'}|${e.kind === 'tls-ok' ? '握手成功' : `握手失败：${e.error}`}`
    tls.set(key, (tls.get(key) ?? 0) + 1)
  }
  const tcp = mine.filter((e) => e.kind === 'tcp').map((e) => ({ port: e.port, firstBytes: e.firstBytesText }))
  return {
    dns: [...dns.entries()].map(([k, n]) => {
      const [name, type, answer] = k.split('|')
      return { name, type, answer, count: n }
    }).sort((a, b) => a.name.localeCompare(b.name)),
    http: [...http.entries()].map(([k, v]) => {
      const [origin, method, path, status] = k.split('|')
      return { origin, method, path, status: Number(status), count: v.count, markers: [...v.markers], notable: [...v.notable], bodyFiles: v.bodyFiles }
    }),
    tls: [...tls.entries()].map(([k, n]) => {
      const [sni, result] = k.split('|')
      return { sni, result, count: n }
    }),
    rawTcp: tcp,
  }
}

function externalHosts(view, pcap) {
  const hosts = new Set()
  for (const d of view.dns) if (d.type === 'A' || d.type === 'AAAA' || d.type === 'HTTPS') hosts.add(d.name)
  for (const h of view.http) hosts.add(h.origin.replace(/^https?:\/\//, ''))
  for (const t of view.tls) if (t.sni !== '(无 SNI)') hosts.add(t.sni)
  for (const q of pcap.dnsQueries) if (q.type === 'A' || q.type === 'AAAA' || q.type === 'HTTPS') hosts.add(q.name)
  // 反向解析（PTR）问的是内网地址的名字，发给的是本网段的 DNS，不算外部域名，单独列。
  return [...hosts].filter((h) => h && !ALLOWED_HOSTS.has(h) && !h.endsWith('.in-addr.arpa') && !h.endsWith('.ip6.arpa')).sort()
}

function analyzePass(pass) {
  const d = join(runDir, pass)
  if (!existsSync(d)) return null
  const events = readJsonl(join(d, 'out', 'sink-events.jsonl'))
  const model = readJsonl(join(d, 'out', 'model-requests.jsonl'))
  const steps = readJsonl(join(d, 'browser', 'drive.jsonl'))
  const dshPcap = parsePcapText(join(d, 'out', 'dsh.pcap.txt'), IPS.dsh)
  const browserPcap = parsePcapText(join(d, 'out', 'browser.pcap.txt'), IPS.browser)
  const dshSink = sinkView(events, IPS.dsh)
  const browserSink = sinkView(events, IPS.browser)
  return {
    pass,
    steps: steps.filter((s) => !['page-request-outside-dsh', 'page-console-error'].includes(s.step)).map((s) => ({ step: s.step, ok: s.ok ?? null, error: s.error ?? null })),
    pageRequestsOutsideDsh: steps.filter((s) => s.step === 'page-request-outside-dsh').map((s) => s.url),
    modelGateway: {
      requests: model.length,
      paths: [...new Set(model.map((m) => `${m.method} ${m.path}`))],
      decisions: model.map((m) => m.decision?.reason).filter(Boolean),
      carriesAnonymousIdHeader: model.some((m) => m.headers?.['x-deepseek-harness-user-id']),
      extraBodyKeys: [...new Set(model.flatMap((m) => m.extraBodyKeys ?? []))],
    },
    dsh: { pcap: dshPcap, sink: dshSink, externalHosts: externalHosts(dshSink, dshPcap) },
    browser: { pcap: browserPcap, sink: browserSink, externalHosts: externalHosts(browserSink, browserPcap) },
  }
}

const passes = ['before', 'after'].map(analyzePass).filter(Boolean)
writeFileSync(join(runDir, 'summary.json'), JSON.stringify({ runDir, passes }, null, 2) + '\n')

// ---------------------------------------------------------------------------
// Markdown

const md = []
const title = { before: '关之前（DSH 默认配置 + 假 DeepSeek 密钥）', after: '关之后（发行补丁，模型指向 model-gateway.jx.test）' }
const table = (headers, rows) => {
  if (rows.length === 0) return ['（无）', '']
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`), '']
}
md.push(`# 外联检查摘要`, '', `运行目录：\`${runDir}\``, '')
for (const p of passes) {
  md.push(`## ${title[p.pass]}`, '')
  md.push('操作步骤：' + p.steps.map((s) => `${s.step}${s.ok === false ? '（失败）' : s.ok ? '（成功）' : ''}`).join('，'), '')
  const failed = p.steps.filter((s) => s.ok === false)
  if (failed.length) md.push(...failed.map((s) => `- 失败的步骤 ${s.step}：${s.error}`), '')
  md.push(`假模型网关收到 ${p.modelGateway.requests} 个请求（${p.modelGateway.paths.join('、') || '无'}）；其中带匿名用户标识头：${p.modelGateway.carriesAnonymousIdHeader ? '有' : '没有'}；请求体里的非标准字段：${p.modelGateway.extraBodyKeys.join('、') || '无'}。`, '')
  for (const who of ['dsh', 'browser']) {
    const v = p[who]
    md.push(`### ${who === 'dsh' ? 'DSH 实例' : '浏览器'}（${who === 'dsh' ? IPS.dsh : IPS.browser}）`, '')
    md.push(`想连的外部域名：${v.externalHosts.length ? v.externalHosts.map((h) => `\`${h}\``).join('、') : '**无**'}`, '')
    md.push('网络层：DNS 查询（tcpdump）', '')
    md.push(...table(['域名', '类型', '次数'], v.pcap.dnsQueries.map((q) => [q.name, q.type, q.count])))
    md.push('网络层：发起的 TCP 连接（tcpdump，SYN）', '')
    md.push(...table(['目的地址', '端口', '次数', '说明'], v.pcap.tcpConnects.map((c) => [c.ip, c.port, c.count, c.note])))
    if (v.pcap.udpFlows.length) {
      md.push('网络层：非 DNS 的 UDP', '')
      md.push(...table(['目的地址', '端口', '包数', '说明'], v.pcap.udpFlows.map((c) => [c.ip, c.port, c.count, c.note])))
    }
    md.push('接收器记录的 HTTP(S) 请求', '')
    md.push(...table(['地址', '方法', '路径', '状态', '次数', '请求里值得注意的'], v.sink.http.map((h) => [h.origin, h.method, h.path, h.status, h.count, [...h.markers.map((m) => `含 \`${m}\``), ...h.notable].join('；')])))
    if (v.sink.tls.length) {
      md.push('接收器记录的 TLS 握手', '')
      md.push(...table(['SNI', '结果', '次数'], v.sink.tls.map((t) => [t.sni, t.result, t.count])))
    }
    if (v.sink.rawTcp.length) {
      md.push('接收器的原始 TCP 记录', '')
      md.push(...table(['端口', '开头的字节'], v.sink.rawTcp.map((t) => [t.port, `\`${t.firstBytes}\``])))
    }
  }
  if (p.pageRequestsOutsideDsh.length) {
    md.push('页面向 DSH 以外发出的请求（Playwright 记录）', '')
    md.push(...p.pageRequestsOutsideDsh.map((u) => `- ${u}`), '')
  }
}
if (passes.length === 2) {
  const [before, after] = passes
  md.push('## 对比：DSH 实例想连的外部域名', '')
  const all = [...new Set([...before.dsh.externalHosts, ...after.dsh.externalHosts])].sort()
  md.push(...table(['域名', '关之前', '关之后'], all.map((h) => [h, before.dsh.externalHosts.includes(h) ? '有' : '—', after.dsh.externalHosts.includes(h) ? '**有**' : '—'])))
  md.push('## 对比：浏览器想连的外部域名', '')
  const allB = [...new Set([...before.browser.externalHosts, ...after.browser.externalHosts])].sort()
  md.push(...table(['域名', '关之前', '关之后'], allB.map((h) => [h, before.browser.externalHosts.includes(h) ? '有' : '—', after.browser.externalHosts.includes(h) ? '**有**' : '—'])))
}
writeFileSync(join(runDir, 'summary.md'), md.join('\n') + '\n')
console.log(md.join('\n'))
