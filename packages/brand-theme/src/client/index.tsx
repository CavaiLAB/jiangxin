/**
 * @jx/brand-theme 的浏览器一半：界面里的品牌。
 *
 *   1. 侧栏的标志和名称        —— 占 sidebar.brand.mark / sidebar.brand.name 两个槽
 *   2. 首页的标志              —— 占 conversation.hero.brand.mark 槽
 *   3. 主题色                  —— 在 DSH 的深浅两套主题上各叠一层变量覆盖
 *   4. 文案里的 DSH 字样       —— 加 zh-CN、en-US 两个语言包，只盖带品牌的句子；
 *                                 没人选过语言时替用户选一个我们的语言包（default-language.ts）
 *   5. 「设置 → 通用」的两行   —— 关于行顶替「当前版本」，语言行只列换过品牌的语言
 *   6. 对话进行中的鲸鱼尾巴    —— 没有插槽，用一段样式盖掉（overrides.global.css）
 *
 * 前五项走的是 DSH 给第三方留的接口（插槽、主题覆盖层、语言包）；第六项是样式覆盖，依赖内部结构。
 * 都不碰它的源码。
 * 首页的鲸鱼动画和官方字标不在这里处理：它们来自 @deepseek-ai/dsh-client-ui-brand-official，
 * 由 cordis.patch.yml 把那一行关掉。即使那一行没关，这里的注册也会盖住官方的标志和名称
 * （见 SHADOW 的说明），只是鲸鱼还在。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { BRAND_GLOBAL, UPSTREAM, type BrandRuntimeInfo } from '../brand.ts'
import { AboutRow, type AboutRowInjected } from './AboutRow.tsx'
import { auditCopy, type AuditReport } from './audit.ts'
import { BrandMark, BrandName, HeroMark } from './Brand.tsx'
import { COPY_OVERRIDES, DEFAULT_LANGUAGE_PACK, LANGUAGE_PACKS } from './copy-overrides.ts'
import { defaultLanguageTarget, languageLockedBy } from './default-language.ts'
import { LanguageRow, type LanguageRowInjected } from './LanguageRow.tsx'
import { NS, en, zh } from './locales.ts'
import { BRAND_TOKENS } from './palette.ts'
// 只有副作用：往页面里放一段样式，盖掉没有插槽可换的品牌图形（见文件里的说明）。
import './overrides.global.css'

/** Cordis 插件名。 */
export const name = 'jx-brand-theme'

/** 用到的服务：插槽登记表、主题、文案。 */
export const inject = ['slots', 'theme', 'locale']

/** 主题覆盖层的来源标识，按 DSH 的约定用包名。 */
const SOURCE = '@jx/brand-theme'

/**
 * 我们的注册在「同一个位置」上的遮蔽等级。DSH 的规则：数值小的显示，同等级重复注册会报错。
 * 官方品牌包和 DSH 自带的设置行都注册在默认的 0 上，所以用负数盖住它们；
 * 用 -5 而不是更小，是为了让「会话分享」的观看页（它用 -10 显示分享者的信息）仍然能盖过我们。
 */
const SHADOW = -5

/** 审计函数挂在这个全局名下，只给开发时在控制台里调。 */
const AUDIT_GLOBAL = '__JX_BRAND_AUDIT__'

/** DSH 存语言偏好的设置命名空间和字段（出处：@deepseek-ai/dsh-client-locale 的 locale-settings.ts）。 */
const LOCALE_SETTINGS = { namespace: 'locale', field: 'preference' } as const

/** 语言设置里我们关心的那一个字段。 */
interface LocaleSection {
  readonly preference?: string
}

/**
 * 一个最小的可订阅值，交给组件当数据源用（到组件里变成选择器 Hook）。
 * @param initial 初始值。
 * @returns 数据源本身，外加一个改值的函数。
 */
function observableValue<T>(initial: T): { source: { getSnapshot: () => T, subscribe: (listener: () => void) => () => void }, set: (next: T) => void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    source: {
      getSnapshot: () => value,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    set: (next) => {
      if (Object.is(next, value)) return
      value = next
      for (const listener of listeners) listener()
    },
  }
}

/** 宿主一半交过来的版本信息；桌面端或没装宿主一半时没有。 */
function runtimeInfo(): BrandRuntimeInfo {
  const info = (globalThis as Record<string, unknown>)[BRAND_GLOBAL]
  return typeof info === 'object' && info !== null ? info as BrandRuntimeInfo : {}
}

/**
 * 正在运行的上游版本。DSH 把它放在启动信息里（文档 client-modules.md 的 WebBootGraph.release）；
 * 读不到就用我们钉死的那个版本。加号后面的构建信息不显示。
 */
function upstreamVersion(): string {
  const boot = (globalThis as { __DSH_BOOT__?: { release?: { version?: unknown } } }).__DSH_BOOT__
  const version = boot?.release?.version
  return typeof version === 'string' && version !== '' ? version.replace(/\+.*$/u, '') : UPSTREAM.pinnedVersion
}

/**
 * 挂上界面里的品牌。
 * @param ctx 浏览器端的插件上下文。
 */
export function apply(ctx: ClientContext): void {
  // 1. 侧栏：标志和名称是一对，要么都换要么都不换，所以放在一个生成器里一起装。
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark', priority: SHADOW }, BrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name', priority: SHADOW }, BrandName)
    }))

  // 2. 首页标题前的标志。
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({
    name: 'conversation.hero.brand.mark', priority: SHADOW,
  }, HeroMark))

  // 3. 主题色。覆盖层叠在当前主题上，用户切换深浅色时两套值各自生效。
  ctx.effect(() => ctx.theme.overrideTokens(SOURCE, BRAND_TOKENS), 'jx-brand-theme: theme tokens')

  // 4. 文案。先是这个包自己的词典，再是两个语言包和它们的覆盖表。
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'jx-brand-theme: dictionaries')
  for (const pack of LANGUAGE_PACKS) {
    ctx.effect(() => ctx.locale.addLanguage({ ...pack }), `jx-brand-theme: language ${pack.id}`)
    for (const [ns, dict] of Object.entries(COPY_OVERRIDES[pack.id])) {
      ctx.effect(() => ctx.locale.register(ns, pack.id, { ...dict }), `jx-brand-theme: ${pack.id} copy for ${ns}`)
    }
  }

  // 4b. 默认语言，以及语言是不是被部署方锁住了。两件事都要读已保存的设置（ctx.configForms），
  //     单独等这个服务：它不在的话只是没有这两样，别的品牌照常生效。
  const languageLocked = observableValue(false)
  const localeSettings = observableValue<Record<string, unknown>>({ status: 'unknown' })
  // 切换语言。设置服务在的时候直接写设置：这样拿得到「写没写进去」，被锁住时主机拒绝，语言行据此变成只读。
  // 写进去以后 DSH 的语言服务从同一份设置里读到新值，界面跟着切换。设置服务不在时退回语言服务自己的写法。
  const writeThroughLocale = (id: string): void => { ctx.locale.setLocale(id) }
  let writeLanguage = writeThroughLocale
  ctx.inject(['configForms'], (settings) => {
    const form = settings.configForms.get<LocaleSection>(LOCALE_SETTINGS.namespace)
    // 同一种「现在生效的语言」只替用户选一次：万一写不进去，不反复重试。
    const tried = new Set<string>()
    // 写入被主机拒过：推断不出的锁（上面那层的值碰巧跟用户存的一样）靠这个发现。
    let refused = false
    const settle = (): void => {
      const snapshot = form.getSnapshot()
      const ready = snapshot.status === 'ready'
      const locked = ready && (refused || languageLockedBy({
        ready, writable: snapshot.writable, value: snapshot.value, base: snapshot.base, user: snapshot.user,
      }))
      languageLocked.set(locked)
      localeSettings.set({
        status: snapshot.status, writable: snapshot.writable, locked, refused,
        preference: snapshot.value?.preference, base: snapshot.base, user: snapshot.user,
      })
      if (locked) return
      const active = ctx.locale.getSnapshot().active
      const target = defaultLanguageTarget({ ready, preference: snapshot.value?.preference, active }, LANGUAGE_PACKS, DEFAULT_LANGUAGE_PACK)
      if (target === undefined || tried.has(active)) return
      tried.add(active)
      writeLanguage(target)
    }
    writeLanguage = (id) => {
      form.set(LOCALE_SETTINGS.field, id).then((accepted) => {
        if (accepted) return
        refused = true
        settle()
      }, (error: unknown) => {
        // 传输失败（连接断了）：设置没变，界面也没变，留一句告警就行。
        console.warn('@jx/brand-theme：切换语言没有写进设置', error)
      })
    }
    settings.effect(() => () => { writeLanguage = writeThroughLocale }, 'jx-brand-theme: language writes')
    settings.effect(() => form.subscribe(settle), 'jx-brand-theme: locale settings')
    settings.effect(() => ctx.locale.subscribe(settle), 'jx-brand-theme: default language')
    settle()
  })

  // 5. 「设置 → 通用」。两行都用 DSH 原来那一行的 id，靠遮蔽等级顶替，位置不变。
  const info = runtimeInfo()
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'current-version', order: 100, priority: SHADOW, locale: NS,
    inject: (): AboutRowInjected => ({
      version: info.version,
      commit: info.commit,
      upstreamVersion: upstreamVersion(),
    }),
  }, AboutRow))
  const offered = LANGUAGE_PACKS.map(pack => pack.id)
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'language', order: 0, priority: SHADOW, locale: NS,
    inject: (): LanguageRowInjected => ({
      hooks: { locale: ctx.locale, locked: languageLocked.source },
      setLocale: (id) => { writeLanguage(id) },
      offered,
    }),
  }, LanguageRow))

  // 开发用的文案审计，见 audit.ts。
  ctx.effect(() => {
    const scope = globalThis as Record<string, unknown>
    const audit = (): AuditReport & { localeSettings: Record<string, unknown> } => ({
      ...auditCopy(ctx.locale, Object.fromEntries(LANGUAGE_PACKS.map(pack => [pack.fallback, pack.id]))),
      // 语言设置的现状：排查「语言切不动」「默认语言不对」时看这个。
      localeSettings: { active: ctx.locale.getSnapshot().active, ...localeSettings.source.getSnapshot() },
    })
    scope[AUDIT_GLOBAL] = audit
    return () => { if (scope[AUDIT_GLOBAL] === audit) delete scope[AUDIT_GLOBAL] }
  }, 'jx-brand-theme: copy audit')
}
