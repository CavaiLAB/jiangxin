/**
 * 日期选择：浮层加日历。手写的组合（shadcn 没有现成的日期选择组件，它的文档里给的是 Popover 加 Calendar 的拼法）。
 *
 * 触发器和下拉选择用同一个外框（lib/field.ts，照 DSH 的输入框），浮层是组件库的 Popover（弹层层级 1100、放进 DSH
 * 弹窗时落在弹窗里面），里面是组件库的 Calendar（react-day-picker）。选中一天就关闭；再点一次选中的那天是清空。
 *
 * 文字都由调用方给：placeholder、aria-label；日历的月份、星期、按钮的读屏文字跟 locale 走（zhCN、enUS 从这里导出）。
 *
 * 读屏听到的按钮名字是「字段名 + 按钮上显示的字」（显示的字是选中的日期，没选时是占位文字）：调用方给的 aria-label 是
 * 字段名，组件把显示的字接在后面，拼好放到按钮的 aria-label 上。只把字段名放到按钮上会顶替按钮上的字，选中的日期就读
 * 不出来。按钮上显示的字已经带着字段名时（比如页面上没有标签的筛选），不用给 aria-label，组件把显示的字放到 aria-label
 * 上，和按钮上的字一样（只认 aria-label、不从里层文字取名字的检查工具也读得到）。
 * 用 <label htmlFor> 关联的字段，也把标签的文字传给 aria-label：aria-label 比 label 关联优先，只靠 label 关联，名字里
 * 只有标签。给 aria-labelledby（写着字段名的元素的 id）时，组件把显示日期的那段接在后面、按钮上不放 aria-label；
 * 有的检查工具不认 aria-labelledby。
 */
import * as React from "react"
import type { DayPickerLocale, Matcher } from "react-day-picker"
import { enUS, zhCN } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"
import { fieldFocus, fieldFrame, fieldPadding } from "../lib/field.ts"
import { Calendar } from "./calendar.tsx"
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx"
import "../styles/jx.tailwind.css"

/** 日历用的语言包（react-day-picker 的，含月份、星期和按钮的读屏文字）。 */
export type DateLocale = DayPickerLocale

export { enUS, zhCN }

export interface DatePickerProps {
  /** 选中的日期。给了就是受控的：null 表示没选。不给就由组件自己记，初值是 defaultValue。 */
  value?: Date | null
  /** 不受控时的初值。 */
  defaultValue?: Date | null
  /** 选了或者清空了（再点一次选中的那天）。 */
  onValueChange?: (value: Date | null) => void
  /** 没选时显示的文字。 */
  placeholder?: string
  /** 选中以后怎么显示，缺省是 toLocaleDateString（按 locale 的语言）。 */
  formatDate?: (value: Date) => string
  /** 日历的语言，缺省英文。中文传 zhCN。 */
  locale?: DateLocale
  /** 不能选的日子，写法见 react-day-picker 的 Matcher：{ before: 某天 }、{ after: 某天 }、函数等。 */
  disabledDates?: Matcher | Matcher[]
  disabled?: boolean
  /** 浮层和触发器怎么对齐，缺省左对齐。 */
  align?: "start" | "center" | "end"
  className?: string
  id?: string
  /** 字段名（不显示）。按钮的名字是它加上按钮上显示的字，见文件开头。 */
  "aria-label"?: string
  /** 写着字段名的元素的 id（可以是几个，空格隔开）。按钮上显示的字同样接在后面，见文件开头。 */
  "aria-labelledby"?: string
  "aria-invalid"?: boolean
}

/**
 * 日期选择。ref 交给触发器按钮。
 */
const DatePicker = React.forwardRef(function DatePicker({
  value,
  defaultValue = null,
  onValueChange,
  placeholder,
  formatDate,
  locale,
  disabledDates,
  disabled = false,
  align = "start",
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: DatePickerProps, ref: React.ForwardedRef<HTMLButtonElement>) {
  const [own, setOwn] = React.useState<Date | null>(defaultValue)
  const [open, setOpen] = React.useState(false)
  const selected = value === undefined ? own : value
  const format = formatDate ?? ((date: Date) => date.toLocaleDateString(locale?.code))
  const shown = selected === null ? placeholder : format(selected)
  // 按钮的名字 = 字段名 + 按钮上显示的字（见文件开头）。
  const valueId = React.useId()
  const naming = ariaLabelledBy === undefined
    ? { "aria-label": [ariaLabel, shown].filter((part): part is string => part !== undefined && part !== "").join(" ") || undefined }
    : { "aria-labelledby": `${ariaLabelledBy} ${valueId}` }

  const select = (next: Date | undefined): void => {
    const date = next ?? null
    if (value === undefined) setOwn(date)
    onValueChange?.(date)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={ref}
        type="button"
        disabled={disabled}
        data-slot="date-picker-trigger"
        data-placeholder={selected === null ? "" : undefined}
        className={cn(
          fieldFrame,
          fieldPadding,
          fieldFocus,
          "jx:inline-flex jx:w-fit jx:min-w-36 jx:cursor-default jx:items-center jx:gap-1.5 jx:text-left jx:whitespace-nowrap jx:select-none jx:data-popup-open:border-ring jx:data-placeholder:text-(color:--dsw-alias-label-dimmed)",
          className
        )}
        {...naming}
        {...rest}
      >
        <span id={valueId} className="jx:flex-1 jx:truncate">{shown}</span>
        <CalendarIcon className="jx:pointer-events-none jx:size-4 jx:shrink-0 jx:text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="jx:w-auto" align={align}>
        <Calendar
          mode="single"
          selected={selected ?? undefined}
          defaultMonth={selected ?? undefined}
          onSelect={select}
          {...(locale === undefined ? {} : { locale })}
          {...(disabledDates === undefined ? {} : { disabled: disabledDates })}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
})

export { DatePicker }
