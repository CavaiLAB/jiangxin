import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

import { Button } from "./button.tsx"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group.tsx"
import { ChevronDownIcon, XIcon, CheckIcon } from "lucide-react"
import { usePortalContainer } from "../lib/portal-container.tsx"
import { fieldFrame, popupCard, popupItem } from "../lib/field.ts"
import "../styles/jx.tailwind.css"

/*
 * 带搜索的选择器。shadcn 4.23.0（base-nova）生成，适配脚本处理过（forwardRef、弹层层级 1100、弹层落在 DSH 弹窗里）。
 * 手调：输入框的外框照 DSH 的输入框（lib/field.ts），打开时边框也换色；弹层和行照 DSH 的菜单卡片，离输入框 4px；
 * 列表露出滚动条（shadcn 用 no-scrollbar 藏起来，DSH 的列表都露着，样式归 DSH 的主题管）。
 * 多选（Chips 那几个）跟着生成出来了，没有在 DSH 里试过，包里没有导出。
 */

const Combobox = ComboboxPrimitive.Root

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

const ComboboxTrigger = React.forwardRef(function ComboboxTrigger({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props, ref: React.ForwardedRef<HTMLButtonElement>) {
  return (
    <ComboboxPrimitive.Trigger ref={ref}
      data-slot="combobox-trigger"
      className={cn("jx:[&_svg:not([class*=size-])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon className="jx:pointer-events-none jx:size-4 jx:text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
})

const ComboboxClear = React.forwardRef(function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props, ref: React.ForwardedRef<HTMLButtonElement>) {
  return (
    <ComboboxPrimitive.Clear ref={ref}
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="jx:pointer-events-none" />
    </ComboboxPrimitive.Clear>
  )
})

const ComboboxInput = React.forwardRef(function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean
  showClear?: boolean
}, ref: React.ForwardedRef<HTMLInputElement>) {
  return (
    <InputGroup className={cn("jx:w-auto jx:has-data-popup-open:border-ring", className)}>
      <ComboboxPrimitive.Input ref={ref}
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="jx:group-has-data-[slot=combobox-clear]/input-group:hidden jx:data-pressed:bg-transparent"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
})

const ComboboxContent = React.forwardRef(function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >, ref: React.ForwardedRef<HTMLDivElement>) {
  const portalContainer = usePortalContainer()
  return (
    <ComboboxPrimitive.Portal container={portalContainer}>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="jx:isolate jx:z-[1100]"
      >
        <ComboboxPrimitive.Popup ref={ref}
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn(popupCard, "jx:group/combobox-content jx:relative jx:max-h-(--available-height) jx:w-(--anchor-width) jx:max-w-(--available-width) jx:min-w-[calc(var(--anchor-width)+--spacing(7))] jx:origin-(--transform-origin) jx:overflow-hidden jx:duration-100 jx:data-[chips=true]:min-w-(--anchor-width) jx:data-[side=bottom]:slide-in-from-top-2 jx:data-[side=inline-end]:slide-in-from-left-2 jx:data-[side=inline-start]:slide-in-from-right-2 jx:data-[side=left]:slide-in-from-right-2 jx:data-[side=right]:slide-in-from-left-2 jx:data-[side=top]:slide-in-from-bottom-2 jx:*:data-[slot=input-group]:m-1 jx:*:data-[slot=input-group]:mb-0 jx:*:data-[slot=input-group]:h-8 jx:*:data-[slot=input-group]:border-input/30 jx:*:data-[slot=input-group]:bg-input/30 jx:*:data-[slot=input-group]:shadow-none jx:data-open:animate-in jx:data-open:fade-in-0 jx:data-open:zoom-in-95 jx:data-closed:animate-out jx:data-closed:fade-out-0 jx:data-closed:zoom-out-95", className)}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
})

const ComboboxList = React.forwardRef(function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.List ref={ref}
      data-slot="combobox-list"
      className={cn(
        "jx:max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] jx:scroll-py-1 jx:overflow-y-auto jx:overscroll-contain jx:p-1 jx:data-empty:p-0",
        className
      )}
      {...props}
    />
  )
})

const ComboboxItem = React.forwardRef(function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.Item ref={ref}
      data-slot="combobox-item"
      className={cn(
        popupItem,
        "jx:data-highlighted:bg-accent jx:data-highlighted:text-accent-foreground jx:not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground jx:data-disabled:pointer-events-none jx:data-disabled:opacity-40 jx:[&_svg]:pointer-events-none jx:[&_svg]:shrink-0 jx:[&_svg:not([class*=size-])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="jx:pointer-events-none jx:absolute jx:right-2 jx:flex jx:size-4 jx:items-center jx:justify-center" />
        }
      >
        <CheckIcon className="jx:pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
})

const ComboboxGroup = React.forwardRef(function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.Group ref={ref}
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  )
})

const ComboboxLabel = React.forwardRef(function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.GroupLabel ref={ref}
      data-slot="combobox-label"
      className={cn("jx:px-2 jx:py-1 jx:text-xs jx:text-muted-foreground", className)}
      {...props}
    />
  )
})

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  )
}

const ComboboxEmpty = React.forwardRef(function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.Empty ref={ref}
      data-slot="combobox-empty"
      className={cn(
        "jx:hidden jx:w-full jx:justify-center jx:py-2 jx:text-center jx:text-[13px] jx:leading-5 jx:text-muted-foreground jx:group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  )
})

const ComboboxSeparator = React.forwardRef(function ComboboxSeparator({
  className,
  ...props
}: ComboboxPrimitive.Separator.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.Separator ref={ref}
      data-slot="combobox-separator"
      className={cn("jx:mx-2 jx:my-[3px] jx:h-[0.5px] jx:bg-border", className)}
      {...props}
    />
  )
})

const ComboboxChips = React.forwardRef(function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.Chips ref={ref}
      data-slot="combobox-chips"
      className={cn(
        fieldFrame,
        "jx:flex jx:min-h-8 jx:flex-wrap jx:items-center jx:gap-1 jx:bg-clip-padding jx:px-2 jx:py-[3px] jx:focus-within:border-ring jx:has-aria-invalid:border-destructive jx:has-data-[slot=combobox-chip]:px-1",
        className
      )}
      {...props}
    />
  )
})

const ComboboxChip = React.forwardRef(function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean
}, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <ComboboxPrimitive.Chip ref={ref}
      data-slot="combobox-chip"
      className={cn(
        "jx:flex jx:h-[calc(--spacing(5.25))] jx:w-fit jx:items-center jx:justify-center jx:gap-1 jx:rounded-sm jx:bg-muted jx:px-1.5 jx:text-xs jx:font-medium jx:whitespace-nowrap jx:text-foreground jx:has-disabled:pointer-events-none jx:has-disabled:cursor-not-allowed jx:has-disabled:opacity-50 jx:has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="jx:-ml-1 jx:opacity-50 jx:hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="jx:pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
})

const ComboboxChipsInput = React.forwardRef(function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props, ref: React.ForwardedRef<HTMLInputElement>) {
  return (
    <ComboboxPrimitive.Input ref={ref}
      data-slot="combobox-chip-input"
      className={cn("jx:min-w-16 jx:flex-1 jx:outline-none", className)}
      {...props}
    />
  )
})

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}
