import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"
import { usePortalContainer } from "../lib/portal-container.tsx"
import { fieldFocus, fieldFrame, fieldPadding, popupCard, popupItem } from "../lib/field.ts"
import "../styles/jx.tailwind.css"

/*
 * 下拉选择。shadcn 4.23.0（base-nova）生成，适配脚本处理过（forwardRef、弹层层级 1100、弹层落在 DSH 弹窗里）。
 * 手调：触发器换成 lib/field.ts 的外框（照 DSH 的输入框），打开时边框也换色；弹层和行照 DSH 的菜单卡片；默认在触发器
 * 下方左对齐弹出（alignItemWithTrigger 默认 false，shadcn 默认是让选中项盖在触发器上），和 DSH 的下拉一样。
 */

const Select = SelectPrimitive.Root

const SelectGroup = React.forwardRef(function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <SelectPrimitive.Group ref={ref}
      data-slot="select-group"
      className={cn("jx:scroll-my-1", className)}
      {...props}
    />
  )
})

const SelectValue = React.forwardRef(function SelectValue({ className, ...props }: SelectPrimitive.Value.Props, ref: React.ForwardedRef<HTMLSpanElement>) {
  return (
    <SelectPrimitive.Value ref={ref}
      data-slot="select-value"
      className={cn("jx:flex jx:flex-1 jx:text-left", className)}
      {...props}
    />
  )
})

const SelectTrigger = React.forwardRef(function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}, ref: React.ForwardedRef<HTMLButtonElement>) {
  return (
    <SelectPrimitive.Trigger ref={ref}
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        fieldFrame,
        fieldPadding,
        fieldFocus,
        "jx:flex jx:w-fit jx:items-center jx:justify-between jx:gap-1.5 jx:text-left jx:whitespace-nowrap jx:select-none jx:data-popup-open:border-ring jx:data-placeholder:text-(color:--dsw-alias-label-dimmed) jx:data-[size=sm]:rounded-sm jx:data-[size=sm]:py-[3px] jx:data-[size=sm]:text-[13px] jx:data-[size=sm]:leading-5 jx:*:data-[slot=select-value]:line-clamp-1 jx:*:data-[slot=select-value]:flex jx:*:data-[slot=select-value]:items-center jx:*:data-[slot=select-value]:gap-1.5 jx:[&_svg]:pointer-events-none jx:[&_svg]:shrink-0 jx:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="jx:pointer-events-none jx:size-4 jx:text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
})

const SelectContent = React.forwardRef(function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >, ref: React.ForwardedRef<HTMLDivElement>) {
  const portalContainer = usePortalContainer()
  return (
    <SelectPrimitive.Portal container={portalContainer}>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="jx:isolate jx:z-[1100]"
      >
        <SelectPrimitive.Popup ref={ref}
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(popupCard, "jx:relative jx:isolate jx:z-[1100] jx:max-h-(--available-height) jx:w-(--anchor-width) jx:min-w-36 jx:origin-(--transform-origin) jx:overflow-x-hidden jx:overflow-y-auto jx:duration-100 jx:data-[align-trigger=true]:animate-none jx:data-[side=bottom]:slide-in-from-top-2 jx:data-[side=inline-end]:slide-in-from-left-2 jx:data-[side=inline-start]:slide-in-from-right-2 jx:data-[side=left]:slide-in-from-right-2 jx:data-[side=right]:slide-in-from-left-2 jx:data-[side=top]:slide-in-from-bottom-2 jx:data-open:animate-in jx:data-open:fade-in-0 jx:data-open:zoom-in-95 jx:data-closed:animate-out jx:data-closed:fade-out-0 jx:data-closed:zoom-out-95", className)}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="jx:p-1">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
})

const SelectLabel = React.forwardRef(function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <SelectPrimitive.GroupLabel ref={ref}
      data-slot="select-label"
      className={cn("jx:px-2 jx:py-1 jx:text-xs jx:text-muted-foreground", className)}
      {...props}
    />
  )
})

const SelectItem = React.forwardRef(function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props, ref: React.ForwardedRef<HTMLElement>) {
  return (
    <SelectPrimitive.Item ref={ref}
      data-slot="select-item"
      className={cn(
        popupItem,
        "jx:focus:bg-accent jx:focus:text-accent-foreground jx:not-data-[variant=destructive]:focus:**:text-accent-foreground jx:data-disabled:pointer-events-none jx:data-disabled:opacity-40 jx:[&_svg]:pointer-events-none jx:[&_svg]:shrink-0 jx:[&_svg:not([class*=size-])]:size-3.5 jx:*:[span]:last:flex jx:*:[span]:last:items-center jx:*:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="jx:flex jx:flex-1 jx:shrink-0 jx:gap-2 jx:whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="jx:pointer-events-none jx:absolute jx:right-2 jx:flex jx:size-4 jx:items-center jx:justify-center" />
        }
      >
        <CheckIcon className="jx:pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
})

const SelectSeparator = React.forwardRef(function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <SelectPrimitive.Separator ref={ref}
      data-slot="select-separator"
      className={cn("jx:pointer-events-none jx:mx-2 jx:my-[3px] jx:h-[0.5px] jx:bg-border", className)}
      {...props}
    />
  )
})

const SelectScrollUpButton = React.forwardRef(function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <SelectPrimitive.ScrollUpArrow ref={ref}
      data-slot="select-scroll-up-button"
      className={cn(
        "jx:top-0 jx:z-10 jx:flex jx:w-full jx:cursor-default jx:items-center jx:justify-center jx:bg-popover jx:py-1 jx:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
})

const SelectScrollDownButton = React.forwardRef(function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <SelectPrimitive.ScrollDownArrow ref={ref}
      data-slot="select-scroll-down-button"
      className={cn(
        "jx:bottom-0 jx:z-10 jx:flex jx:w-full jx:cursor-default jx:items-center jx:justify-center jx:bg-popover jx:py-1 jx:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
})

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
