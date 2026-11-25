/**
 * 抽屉：从窗口一侧滑出的面板。壳用 DSH 自己的 Modal（headless），不另起一套模态层。
 *
 * 为什么不用 shadcn 的抽屉、侧边面板（实测）：第三方的对话框壳和 DSH 的菜单互不认识，在里面打开 DSH 的菜单，
 * 方向键不动、按 Esc 两层一起关。用 DSH 的 Modal 改出来的抽屉，里面放下拉和 DSH 的菜单都正常：Tab 正常，菜单的
 * 方向键正常，Esc 先关弹层再关抽屉，关了以后焦点回到打开它的按钮。
 *
 * 正文自动包一层 PortalContainerProvider：里面的下拉、日期这些弹层落在抽屉里面，DSH 的模态层把它们当成抽屉的一部分。
 *
 * 文字都由调用方给：title 同时是标题和读屏用的名字，closeLabel 是关闭按钮的读屏文字。
 * 打开以后焦点先落在关闭按钮上；要换成正文里的某个控件，给那个控件加 data-modal-autofocus 属性（DSH 的约定）。
 */
import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'
import { IconCloseOutlineRegular, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { PortalContainerProvider } from '../lib/portal-container.tsx'
import css from './Drawer.module.css'

export interface DrawerProps {
  open: boolean
  /** 点关闭按钮、点遮罩、按 Esc 时调用。 */
  onClose: () => void
  /** 标题，也是读屏用的名字。 */
  title: string
  /** 关闭按钮的读屏文字。 */
  closeLabel: string
  children?: ReactNode
  /** 底部的按钮行（取消、保存这类），靠右排。 */
  footer?: ReactNode
  /** 从哪一侧出来，缺省右边。 */
  side?: 'right' | 'left'
  /** 面板宽度，缺省 420px，最宽不超过窗口。 */
  width?: number | string
  /** 加在面板卡片上的类名。 */
  className?: string
}

/**
 * 画一个抽屉。关着时什么都不画。
 * @returns DSH 的 Modal。
 */
export function Drawer({
  open, onClose, title, closeLabel, children, footer, side = 'right', width, className,
}: DrawerProps): ReactNode {
  const panelStyle = width === undefined
    ? undefined
    : { '--jx-drawer-width': typeof width === 'number' ? `${width}px` : width } as CSSProperties
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      headless
      className={clsx(css.drawer, side === 'left' && css.left, className)}
    >
      <div className={css.panel} style={panelStyle} data-jx-drawer={side}>
        <div className={css.header}>
          <h2 className={css.title}>{title}</h2>
          <button type="button" className={css.close} aria-label={closeLabel} onClick={onClose}>
            <IconCloseOutlineRegular size={14} />
          </button>
        </div>
        <div className={css.body}>
          <PortalContainerProvider>{children}</PortalContainerProvider>
        </div>
        {footer === undefined ? null : <div className={css.footer}>{footer}</div>}
      </div>
    </Modal>
  )
}
