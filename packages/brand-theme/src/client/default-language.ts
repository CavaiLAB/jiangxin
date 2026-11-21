/**
 * 默认语言：没人选过语言时，界面落到哪个语言包上。
 *
 * 为什么要管：DSH 自带八种语言的词典，里面有带 DSH 字样的句子；我们只给中文和英文各做了一份
 * 换过品牌的语言包（zh-CN、en-US）。没人选过语言时 DSH 按浏览器的语言挑：
 * 浏览器是 zh-CN 或 en-US 会直接挑中我们的语言包，别的（en-GB、zh-TW、日语……）会落到 DSH 自带的
 * 词典上，DSH 字样就露出来了。所以这种时候替用户选一个我们的语言包。
 *
 * 为什么不在补丁里写死默认语言（第一版是这么做的）：发行目录把补丁叠在命令行那一层，
 * 那一层的设置界面上改不动——用户在「设置 → 通用 → 语言」里切换语言会完全没反应（实测）。
 */

/** 一个语言包：自己的 id，以及它盖的是 DSH 的哪种语言。 */
export interface LanguagePack {
  readonly id: string
  readonly fallback: string
}

/** 判断要用到的现状。 */
export interface LanguageState {
  /** 已保存的设置读到了没有。没读到之前不知道有没有人选过语言，不能动。 */
  readonly ready: boolean
  /** 已经定下来的语言：用户选的，或者某一层补丁给的。都没有就是 undefined。 */
  readonly preference: string | undefined
  /** 现在实际生效的语言。 */
  readonly active: string
}

/**
 * 该不该替用户选语言，选哪个。
 * @param state 现状。
 * @param packs 换过品牌的语言包。
 * @param fallbackPack 浏览器的语言跟哪个语言包都对不上时用的那个。
 * @returns 要切到的语言包 id；不需要动时返回 undefined。
 */
export function defaultLanguageTarget(
  state: LanguageState,
  packs: readonly LanguagePack[],
  fallbackPack: string,
): string | undefined {
  // 设置还没读到：这时生效的语言只是按浏览器猜的，真正存下来的选择可能马上就到，不能抢着写。
  if (!state.ready) return undefined
  // 已经有人定了（用户自己选的，或者部署方在补丁里定的），照他们的来。
  if (state.preference !== undefined) return undefined
  const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
  if (packs.some(pack => same(pack.id, state.active))) return undefined
  // 现在生效的是 DSH 自带的某种语言：有对应语言包就用对应的（en → en-US，zh → zh-CN）。
  return packs.find(pack => same(pack.fallback, state.active))?.id ?? fallbackPack
}

/** 读一层设置里的 preference。 */
function preferenceOf(layer: unknown): string | undefined {
  if (typeof layer !== 'object' || layer === null) return undefined
  const value = (layer as Record<string, unknown>).preference
  return typeof value === 'string' ? value : undefined
}

/** DSH 设置快照里跟语言有关的几层。 */
export interface LocaleLayers {
  /** 已保存的设置读到了没有。 */
  readonly ready: boolean
  /** 整份设置能不能写（不是这一项）。 */
  readonly writable: boolean
  /** 生效的值：含家目录补丁和命令行补丁。 */
  readonly value: unknown
  /** 组合包层加配置档层的值：不含家目录补丁和命令行补丁。 */
  readonly base: unknown
  /** 用户自己存的值。 */
  readonly user: unknown
}

/**
 * 语言是不是被部署方锁住了。
 *
 * DSH 的设置快照里没有「这一项被锁住」的标记，只能推断：生效的值既不是用户存的、也不是组合包层给的，
 * 那就是更上面的层（家目录补丁、命令行补丁）定的。这种字段用户在界面上改了，主机会拒绝
 * （@deepseek-ai/dsh-config-editor：overridden by a home patch or command-line overlay）。
 *
 * 上面那层给的值碰巧跟用户存的一样时推断不出来，要等用户改一次被拒才知道（index.tsx 里处理）。
 */
export function languageLockedBy(layers: LocaleLayers): boolean {
  if (!layers.ready) return false
  if (!layers.writable) return true
  const effective = preferenceOf(layers.value)
  if (effective === undefined) return false
  return effective !== (preferenceOf(layers.user) ?? preferenceOf(layers.base))
}
