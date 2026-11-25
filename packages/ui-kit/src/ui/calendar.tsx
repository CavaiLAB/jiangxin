import * as React from "react"
import { cn } from "cn"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type Locale,
} from "react-day-picker"

import { Button, buttonVariants } from "./button.tsx"
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"
import "../styles/jx.tailwind.css"

/*
 * 内部件：日期选择里的日历。shadcn 4.23.0（base-nova）生成，适配脚本处理过（forwardRef）。不从包里导出。
 * 手调：格子 32px、圆角 sm；选中用主色（DSH 的主按钮色）；键盘焦点框 2px。
 * 修了生成代码的一处毛病：CalendarDayButton 建了自己的 ref 想在方向键移动时把焦点挪过来，却没把它交给按钮，
 * 方向键挪的只是高亮、焦点不动。现在和转发进来的 ref 合并以后交给按钮。
 */

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "jx:group/calendar jx:bg-background jx:p-2 jx:[--cell-radius:var(--dsw-radius-sm)] jx:[--cell-size:--spacing(8)] jx:in-data-[slot=card-content]:bg-transparent jx:in-data-[slot=popover-content]:bg-transparent",
        String.raw`jx:rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`jx:rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("jx:w-fit", defaultClassNames.root),
        months: cn(
          "jx:relative jx:flex jx:flex-col jx:gap-4 jx:md:flex-row",
          defaultClassNames.months
        ),
        month: cn("jx:flex jx:w-full jx:flex-col jx:gap-4", defaultClassNames.month),
        nav: cn(
          "jx:absolute jx:inset-x-0 jx:top-0 jx:flex jx:w-full jx:items-center jx:justify-between jx:gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "jx:size-(--cell-size) jx:p-0 jx:select-none jx:aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "jx:size-(--cell-size) jx:p-0 jx:select-none jx:aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "jx:flex jx:h-(--cell-size) jx:w-full jx:items-center jx:justify-center jx:px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "jx:flex jx:h-(--cell-size) jx:w-full jx:items-center jx:justify-center jx:gap-1.5 jx:text-sm jx:font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "jx:relative jx:rounded-(--cell-radius)",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "jx:absolute jx:inset-0 jx:bg-popover jx:opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "jx:font-medium jx:select-none",
          captionLayout === "label"
            ? "jx:text-sm"
            : "jx:flex jx:items-center jx:gap-1 jx:rounded-(--cell-radius) jx:text-sm jx:[&>svg]:size-3.5 jx:[&>svg]:text-muted-foreground",
          defaultClassNames.caption_label
        ),
        month_grid: cn("jx:w-full jx:border-collapse", defaultClassNames.month_grid),
        weekdays: cn("jx:flex", defaultClassNames.weekdays),
        weekday: cn(
          "jx:flex-1 jx:rounded-(--cell-radius) jx:text-xs jx:font-normal jx:text-muted-foreground jx:select-none",
          defaultClassNames.weekday
        ),
        week: cn("jx:mt-2 jx:flex jx:w-full", defaultClassNames.week),
        week_number_header: cn(
          "jx:w-(--cell-size) jx:select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "jx:text-[0.8rem] jx:text-muted-foreground jx:select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "jx:group/day jx:relative jx:aspect-square jx:h-full jx:w-full jx:rounded-(--cell-radius) jx:p-0 jx:text-center jx:select-none jx:[&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
          props.showWeekNumber
            ? "jx:[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
            : "jx:[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
          defaultClassNames.day
        ),
        range_start: cn(
          "jx:relative jx:isolate jx:z-0 jx:rounded-l-(--cell-radius) jx:bg-muted jx:after:absolute jx:after:inset-y-0 jx:after:right-0 jx:after:w-4 jx:after:bg-muted",
          defaultClassNames.range_start
        ),
        range_middle: cn("jx:rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "jx:relative jx:isolate jx:z-0 jx:rounded-r-(--cell-radius) jx:bg-muted jx:after:absolute jx:after:inset-y-0 jx:after:left-0 jx:after:w-4 jx:after:bg-muted",
          defaultClassNames.range_end
        ),
        today: cn(
          "jx:rounded-(--cell-radius) jx:bg-muted jx:text-foreground jx:data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "jx:text-muted-foreground jx:aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "jx:text-muted-foreground jx:opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("jx:invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("jx:size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon className={cn("jx:size-4", className)} {...props} />
            )
          }

          return (
            <ChevronDownIcon className={cn("jx:size-4", className)} {...props} />
          )
        },
        DayButton: ({ ...props }) => (
          <CalendarDayButton locale={locale} {...props} />
        ),
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="jx:flex jx:size-(--cell-size) jx:items-center jx:justify-center jx:text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

const CalendarDayButton = React.forwardRef(function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }, forwardedRef: React.ForwardedRef<HTMLButtonElement>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement | null>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])
  // 自己的 ref（挪焦点用）和转发进来的 ref 合并以后交给按钮。
  const mergedRef = React.useCallback((node: HTMLButtonElement | null) => {
    ref.current = node
    if (typeof forwardedRef === "function") forwardedRef(node)
    else if (forwardedRef !== null) forwardedRef.current = node
  }, [forwardedRef])

  return (
    <Button ref={mergedRef}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "jx:relative jx:isolate jx:z-10 jx:flex jx:aspect-square jx:size-auto jx:w-full jx:min-w-(--cell-size) jx:flex-col jx:gap-1 jx:border-0 jx:leading-none jx:font-normal jx:group-data-[focused=true]/day:relative jx:group-data-[focused=true]/day:z-10 jx:group-data-[focused=true]/day:ring-2 jx:group-data-[focused=true]/day:ring-ring jx:data-[range-end=true]:rounded-(--cell-radius) jx:data-[range-end=true]:rounded-r-(--cell-radius) jx:data-[range-end=true]:bg-primary jx:data-[range-end=true]:text-primary-foreground jx:data-[range-middle=true]:rounded-none jx:data-[range-middle=true]:bg-muted jx:data-[range-middle=true]:text-foreground jx:data-[range-start=true]:rounded-(--cell-radius) jx:data-[range-start=true]:rounded-l-(--cell-radius) jx:data-[range-start=true]:bg-primary jx:data-[range-start=true]:text-primary-foreground jx:data-[selected-single=true]:bg-primary jx:data-[selected-single=true]:text-primary-foreground jx:dark:hover:text-foreground jx:[&>span]:text-xs jx:[&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
})

export { Calendar, CalendarDayButton }
