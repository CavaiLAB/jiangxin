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
 * 容器还管一件事：正在收起的弹层。弹层收起有一段动画（约 150 毫秒），这期间它还在容器里、里面的按钮还能聚焦（日期
 * 面板的翻月按钮和日期格；下拉和带搜索的选择器的选项不在 Tab 顺序里，碰不到）。容器在正文的最后、页脚按钮的前面，
 * 很快地连按 Tab 时焦点会落进去，弹层一卸载，焦点就掉到 body，下一下 Tab 被 DSH 拉回弹窗开头（实测）。所以焦点落进
 * 正在收起的弹层（Base UI 给它标了 data-closed）、还停在那里时，接着交给容器以外按 Tab 顺序的下一个元素：从前面来的
 * 往后交（一般是页脚的按钮），按 Shift+Tab 从后面来的往前交。没有用「收起期间设 inert」：用 Esc、回车关弹层时焦点
 * 还在弹层里，按 HTML 规范，焦点所在的元素变成 inert 时焦点会被丢回 body，那样又多出一个焦点掉到 body 的空档。
 *
 * 组件库里带弹层的组件都从这里取容器（适配脚本给 *.Portal 加上 container），业务代码只需要在 DSH 弹窗的内容外面包一层
 * PortalContainerProvider。组件库的 Drawer 已经自己包了。
 */
import * as React from 'react'
import type { ReactNode } from 'react'

const PortalContainerContext = React.createContext<HTMLElement | null>(null)

/** 可能用 Tab 走到的元素。 */
const FOCUSABLE = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])'

/** scope 里按 Tab 走得到的元素，按页面顺序：去掉 tabindex 为负的、禁用的、在 inert 里的、不显示的。 */
function tabbables(scope: ParentNode): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el =>
    el.tabIndex >= 0 && !el.matches(':disabled') && el.closest('[inert]') === null && el.getClientRects().length > 0)
}

/**
 * 焦点落进了容器里正在收起的弹层：交给容器以外的下一个（或上一个）能用 Tab 走到的元素。
 * 只在焦点还停在那里时动：Tab 走到弹层边上 Base UI 的焦点守卫时，Base UI 先处理同一个事件，关掉弹层、自己把焦点交给
 * 下一个字段；轮到这里时事件的目标已经在正在收起的弹层里、焦点却不在了，再挪就会跳过字段（实测）。
 * 方向看焦点从哪来：从容器后面来的（Shift+Tab）往前找，其余往后找；找不到就绕到另一头，和 Tab 在弹窗里绕圈一样。
 * 焦点来的那个元素可能已经随弹层卸载，不在页面上的不拿来判断方向（和它比前后，浏览器给的结果是随意的）。
 * 范围是容器所在的弹窗（role="dialog"），不在弹窗里就是整个页面。
 */
function moveOutOfClosingPopup(container: HTMLElement, event: FocusEvent): void {
  const target = event.target
  if (!(target instanceof Element) || document.activeElement !== target || target.closest('[data-closed]') === null) return
  const from = event.relatedTarget instanceof Node && event.relatedTarget.isConnected ? event.relatedTarget : null
  const backward = from !== null && !container.contains(from)
    && (container.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  const scope = container.closest<HTMLElement>('[role="dialog"]') ?? document.body
  const outside = tabbables(scope).filter(el => !container.contains(el))
  const after = outside.filter(el => (container.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
  const before = outside.filter(el => (container.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) !== 0)
  const next = backward ? (before[before.length - 1] ?? after[after.length - 1]) : (after[0] ?? before[0])
  next?.focus()
}

/**
 * 包住 DSH 弹窗里的内容，让里面的弹层挂进弹窗。在弹窗外面不用包，弹层照常挂到 body。
 * @param props.children 弹窗的正文。
 */
export function PortalContainerProvider({ children }: { children?: ReactNode }): ReactNode {
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => {
    if (container === null) return undefined
    const onFocusIn = (event: FocusEvent): void => { moveOutOfClosingPopup(container, event) }
    container.addEventListener('focusin', onFocusIn)
    return () => { container.removeEventListener('focusin', onFocusIn) }
  }, [container])
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
