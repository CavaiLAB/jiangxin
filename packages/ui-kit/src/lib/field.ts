/**
 * 输入类控件（下拉的触发器、选择器的输入框、日期的触发器、多行输入）共用的外框和弹层样式，照 DSH 自己的控件调：
 *
 * 外框照 DSH 的输入框（@deepseek-ai/dsh-client-ui-primitives 的 Input.module.css）：0.5px 的 border-l4 边框、
 * 圆角 --dsw-radius-md（12px）、底色 bg-layer-1、左右内边距 8px、字号 14px 行高 22px，聚焦时边框换成
 * state-business-primary，不加光晕。高度不写死：上下内边距 5px 加一行 22px，内容区 32px、边框算在外面，
 * 和 DSH 的「height: 32px 加 0.5px 边框」一样，在任何像素密度下都和 DSH 的输入框一样高（1 倍屏上 34px）。
 *
 * 弹层照 DSH 的菜单卡片（Menu.module.css、MenuSurface.module.css）：圆角 --dsw-radius-lg（16px）、内边距 4px、
 * 阴影 --dsw-elevation-prominent；行高至少 34px、内边距 6px 8px、圆角 md、字号 13px 行高 20px，指到的那一行
 * 用菜单行悬停的底色。底色用不透明的 bg-layer-2，没有照抄 DSH 菜单的半透明加模糊（那个在 macOS 桌面版上要另垫
 * 一层不透明的底，我们没有验证）。
 *
 * Tailwind 按字符串扫描类名，所以这里只能放写死的类名串。
 */

/** 外框：边框、圆角、底色、字号、聚焦和出错时的边框色、禁用。 */
export const fieldFrame = [
  'jx:rounded-md jx:border-[0.5px] jx:border-input jx:bg-(--dsw-alias-bg-layer-1) jx:text-foreground',
  'jx:text-sm jx:leading-[22px] jx:transition-colors jx:outline-none',
  'jx:aria-invalid:border-destructive jx:disabled:cursor-not-allowed jx:disabled:opacity-50',
].join(' ')

/** 外框里的内边距：撑出 32px 的内容区。 */
export const fieldPadding = 'jx:px-2 jx:py-[5px]'

/** 可聚焦的外框（按钮、输入框自己就是外框时用）：聚焦时换边框色。 */
export const fieldFocus = 'jx:focus-visible:border-ring'

/** 占位文字的颜色，照 DSH 输入框的 label-dimmed。 */
export const fieldPlaceholder = 'jx:placeholder:text-(color:--dsw-alias-label-dimmed)'

/** 弹层卡片。 */
export const popupCard = [
  'jx:rounded-lg jx:bg-popover jx:text-popover-foreground',
  'jx:shadow-(--dsw-elevation-prominent) jx:[--dsw-elevation-stroke-color:var(--dsw-alias-border-l1)]',
].join(' ')

/** 弹层里的一行。 */
export const popupItem = [
  'jx:relative jx:flex jx:min-h-[34px] jx:w-full jx:cursor-default jx:items-center jx:gap-1.5 jx:rounded-md',
  'jx:py-1.5 jx:pr-8 jx:pl-2 jx:text-[13px] jx:leading-5 jx:outline-hidden jx:select-none',
].join(' ')
