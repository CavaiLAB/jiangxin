/**
 * 弹层的落脚容器。
 *
 * 冲突（实测）：Base UI 的弹层默认挂到 body 上，在 DSH 弹窗的元素外面。DSH 的模态层在整个页面上听 Tab，焦点一旦不在
 * 弹窗元素里面（菜单除外），就把焦点拉回弹窗的第一个控件。结果是：在下拉里按 Tab，焦点跳到弹窗右上角的关闭按钮，
 * 下拉还开着；再按 Esc，整个弹窗直接关掉。
 *
 * 办法：在 DSH 弹窗的正文里放一个容器，弹层挂到它里面。这样弹层在页面结构上属于弹窗，DSH 把它当成弹窗的一部分：
 * 下拉里按 Tab，下拉关闭、焦点到下一个字段；Esc 只关弹层。容器是 position: fixed、零尺寸：不占位置，也不会被弹窗
 * 卡片的 overflow: hidden 裁掉。
 *
 * 组件库里带弹层的组件都从这里取容器（适配脚本给 *.Portal 加上 container），业务代码只需要在 DSH 弹窗的内容外面包一层
 * PortalContainerProvider。组件库的 Drawer 已经自己包了。
 */
import * as React from 'react'
import type { ReactNode } from 'react'

const PortalContainerContext = React.createContext<HTMLElement | null>(null)

/**
 * 包住 DSH 弹窗里的内容，让里面的弹层挂进弹窗。在弹窗外面不用包，弹层照常挂到 body。
 * @param props.children 弹窗的正文。
 */
export function PortalContainerProvider({ children }: { children?: ReactNode }): ReactNode {
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
      <div
        ref={setContainer}
        data-jx-portal-container=""
        style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0 }}
      />
    </PortalContainerContext.Provider>
  )
}

/**
 * 弹层组件用：外面包了 PortalContainerProvider 就返回那个容器，没有就返回 undefined（Base UI 照常挂到 body）。
 * @returns 弹层该挂进去的元素。
 */
export function usePortalContainer(): HTMLElement | undefined {
  return React.useContext(PortalContainerContext) ?? undefined
}
