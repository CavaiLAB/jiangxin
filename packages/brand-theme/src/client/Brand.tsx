/**
 * 品牌的三个占位组件：侧栏标志、侧栏名称、首页标志。
 * 尺寸由宿主界面给（侧栏 24px，首页 34px），这里只负责画。
 */
import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { BRAND } from '../brand.ts'
import mark96 from './assets/mark-96.png'
import mark192 from './assets/mark-192.png'
import css from './Brand.module.css'

/**
 * 侧栏里的标志（展开时在名称左边，收起时是那一条窄栏顶上的图标）。
 * 图是装饰性的：名称就在旁边，读屏不用再念一遍。
 */
export function BrandMark({ size }: SidebarBrandMarkOwnerProps): ReactNode {
  return <img className={css.mark} src={mark96} width={size} height={size} alt="" draggable={false} />
}

/** 侧栏里的名称。放得下全称；侧栏被拖窄时省略。 */
export function BrandName(): ReactNode {
  return <span className={css.name}>{BRAND.productName}</span>
}

/** 首页（新会话空白页）标题前面的标志。 */
export function HeroMark({ size, className }: HeroBrandMarkOwnerProps): ReactNode {
  return (
    <img
      className={clsx(css.mark, className)}
      src={mark192}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  )
}
