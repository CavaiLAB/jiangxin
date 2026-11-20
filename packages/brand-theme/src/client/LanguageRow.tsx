/**
 * 「设置 → 通用」里的语言行，顶替 DSH 自带的那一行。
 *
 * 为什么要顶替：DSH 的文案是按语言分的词典，里面有不少带 DSH 字样的句子。我们没法改它的词典
 * （一个命名空间只有一个主人），只能加自己的语言包（zh-CN、en-US）盖掉这些句子。
 * DSH 自带的语言行会把它原来的八种语言也列出来，用户一切过去，DSH 字样就回来了。
 * 所以这一行只列出换过品牌的语言。以后要支持更多语言，给那种语言加一份语言包再列进来。
 *
 * 画法照 DSH 原来的语言行：标题加一个下拉。
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { LocaleSnapshot } from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import css from './LanguageRow.module.css'

/** 注册时交给这一行的东西。 */
export interface LanguageRowInjected {
  /** 可订阅的数据源；到组件里变成 useLocale 这个选择器 Hook。 */
  hooks: {
    /** 当前语言和已注册的语言列表。 */
    locale: HostObservable<LocaleSnapshot>
    /** 语言设置是不是被部署方锁住了（补丁叠在界面改不动的那一层）。 */
    locked: HostObservable<boolean>
  }
  /** 切换语言（写入用户设置）。 */
  setLocale: (id: string) => void
  /** 允许选择的语言 id，按显示顺序。 */
  offered: readonly string[]
}

/** 语言行的全部属性。 */
export type LanguageRowProps =
  PropsRuntime<'settings.general.item'> & PropsLocale<'jx.brand'> & InjectFace<LanguageRowInjected>

/**
 * 画语言行。
 * @param props 翻译函数、语言数据源和切换语言的回调。
 * @returns 语言行。
 */
export function LanguageRow({ t, useLocale, useLocked, setLocale, offered }: LanguageRowProps): ReactNode {
  const active = useLocale(snapshot => snapshot.active)
  const locales = useLocale(snapshot => snapshot.locales)
  const locked = useLocked(value => value)
  const [open, setOpen] = useState(false)
  const options = offered.flatMap((id) => {
    const definition = locales.find(locale => locale.id === id)
    return definition === undefined ? [] : [{ id: definition.id, label: definition.label }]
  })
  // 当前语言不在可选列表里（比如早先存下的设置是日语）时，按钮上仍然如实显示它。
  const activeLabel = locales.find(locale => locale.id === active)?.label ?? active
  return (
    <div className={css.row} data-jx-brand-language data-locked={locked ? '' : undefined}>
      <div className={css.rowText}>
        <div className={css.title}>{t('language.title')}</div>
        {/* 锁住时说明原因：不说的话下拉点了没反应，用户会以为坏了。 */}
        {locked ? <div className={css.hint}>{t('language.locked')}</div> : null}
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={options}
        selectedId={active}
        onSelect={(id) => {
          setLocale(id)
          setOpen(false)
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={locked}
            onClick={() => { setOpen(value => !value) }}
          >
            {activeLabel}
            <IconChevronDownOutlineRegular className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}
