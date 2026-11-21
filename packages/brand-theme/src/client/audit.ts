/**
 * 文案审计：把界面词典里还带上游品牌字样的句子都找出来。
 *
 * 只给开发时用：在浏览器控制台里调 __JX_BRAND_AUDIT__()，得到一张表，
 * 用来补 copy-overrides.ts，以及核对「换完以后还剩多少」。
 * 词典是各个界面插件激活时才注册的，所以先把要查的页面点开一遍再调。
 *
 * 注意：这里读的是 DSH 文案服务的内部状态（LocaleRuntime 的私有字段 dicts），不是公开接口。
 * 品牌包正常工作不依赖它——读不到时审计返回空表并说明原因，别的功能不受影响。
 */
import type { LocaleDict } from '@deepseek-ai/dsh-client-locale/client'

/**
 * 上游产品的名字：DSH、Harness（含 DeepSeek Harness），以及「深度求索」——那是 DeepSeek 的中文名，
 * DSH 把它当动词用在「运行中」的提示里（「深度求索中」）。这些必须换掉。
 */
const PRODUCT_WORDS = /\bDSH\b|harness|深度求索/i

/**
 * 厂商的名字：DeepSeek（账号、模型、搜索服务）。这些不改名——功能确实是对接 DeepSeek 的，
 * 改了反而是错的；它们应该随功能关闭而消失。单独列出来，方便核对哪些功能还开着。
 */
const VENDOR_WORDS = /deep\s?seek/i

/** 不算品牌的技术字样：环境变量、目录、包名和存储键（dsh-xxx、dsh.xxx）、命令、网址。照着敲才对，不能改。 */
const TECHNICAL = /\$?DSH_[A-Z_]+|DEEPSEEK_[A-Z_]+|~\/\.dsh\b|\bdsh[-.][a-z0-9][a-z0-9.-]*|\bdsh (?:plugin|web|tui|headless)\b|https?:\/\/[^\s）)]+/gi

/** 一句话里带的是哪一类上游字样。 */
export type MentionKind = 'product' | 'vendor'

/** 审计结果里的一行。 */
export interface AuditRow {
  /** 词典的命名空间。 */
  ns: string
  /** 基础语言（zh / en）。 */
  locale: string
  /** 文案的键。 */
  key: string
  /** 原文带的是产品名还是厂商名。 */
  kind: MentionKind
  /** DSH 原来的文字。 */
  original: string
  /** 现在显示的文字（已经算上语言包的覆盖）。 */
  text: string
  /** 语言包盖过以后是不是已经不带这一类字样了。 */
  covered: boolean
}

/** 审计结果。 */
export interface AuditReport {
  /** 读不到内部词典时的原因；正常没有这个字段。 */
  error?: string
  /** 一共看了多少条文案（各基础语言合计）。 */
  scanned: number
  /** 带上游产品名、还没盖掉的条数。验收看这个数是不是 0。 */
  productLeft: number
  /** 带厂商名的条数（不改名，仅供核对）。 */
  vendor: number
  /** 明细。 */
  rows: AuditRow[]
}

/**
 * 判断一句话带的是哪一类上游字样。
 * @param text 文案。
 * @returns 产品名优先；都不带返回 undefined。
 */
export function mentionKind(text: string): MentionKind | undefined {
  const plain = text.replace(TECHNICAL, ' ')
  if (PRODUCT_WORDS.test(plain)) return 'product'
  if (VENDOR_WORDS.test(plain)) return 'vendor'
  return undefined
}

/**
 * 扫一遍词典。
 * @param locale DSH 的文案服务（ctx.locale）。
 * @param pairs 「基础语言 → 覆盖它的语言包」的对应，例如 { zh: 'zh-CN', en: 'en-US' }。
 * @param ownPrefix 我们自己的命名空间前缀；这些词典里出现 DSH 是有意的（「基于 DSH 构建」），不算。
 * @returns 带上游字样的文案清单。
 */
export function auditCopy(
  locale: unknown, pairs: Readonly<Record<string, string>>, ownPrefix = 'jx.',
): AuditReport {
  const dicts = (locale as { dicts?: unknown }).dicts
  if (!(dicts instanceof Map)) {
    return {
      error: '读不到文案服务的内部词典（上游可能改了实现），审计不可用',
      scanned: 0, productLeft: 0, vendor: 0, rows: [],
    }
  }
  const rows: AuditRow[] = []
  let scanned = 0
  for (const [ns, byLocale] of dicts as Map<string, Map<string, LocaleDict>>) {
    if (ns.startsWith(ownPrefix)) continue
    for (const [base, pack] of Object.entries(pairs)) {
      const baseDict = byLocale.get(base.toLowerCase())
      if (baseDict === undefined) continue
      const packDict = byLocale.get(pack.toLowerCase())
      for (const [key, original] of Object.entries(baseDict)) {
        scanned++
        const kind = mentionKind(original)
        if (kind === undefined) continue
        const override = packDict?.[key]
        const now = override === undefined ? kind : mentionKind(override)
        // 盖过以后产品名没了就算盖住；原来是厂商名的，盖过以后什么都不带才算盖住。
        const covered = override !== undefined && (kind === 'product' ? now !== 'product' : now === undefined)
        rows.push({ ns, locale: base, key, kind, original, text: override ?? original, covered })
      }
    }
  }
  rows.sort((a, b) => a.ns.localeCompare(b.ns) || a.key.localeCompare(b.key) || a.locale.localeCompare(b.locale))
  return {
    scanned,
    productLeft: rows.filter(row => row.kind === 'product' && !row.covered).length,
    vendor: rows.filter(row => row.kind === 'vendor').length,
    rows,
  }
}
