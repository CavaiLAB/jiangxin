import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"
import { usePortalContainer } from "../lib/portal-container.tsx"
import { popupCard } from "../lib/field.ts"
import "../styles/jx.tailwind.css"

/*
 * 内部件：日期选择的浮层。shadcn 4.23.0（base-nova）生成，适配脚本处理过（forwardRef、弹层层级 1100、弹层落在 DSH
 * 弹窗里）。不从包里导出。
 * 手调：卡片照 DSH 的菜单卡片（lib/field.ts 的 popupCard），内边距 4px。
 */

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

const PopoverTrigger = React.forwardRef(function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props, ref: React.ForwardedRef<HTMLButtonElement>) {
  return <PopoverPrimitive.Trigger ref={ref} data-slot="popover-trigger" {...props} />
})

const PopoverContent = React.forwardRef(function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >, ref: React.ForwardedRef<HTMLDivElement>) {
  const portalContainer = usePortalContainer()
  return (
    <PopoverPrimitive.Portal container={portalContainer}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="jx:isolate jx:z-[1100]"
      >
        <PopoverPrimitive.Popup ref={ref}
          data-slot="popover-content"
          className={cn(
            popupCard,
            "jx:z-[1100] jx:flex jx:w-72 jx:origin-(--transform-origin) jx:flex-col jx:gap-2.5 jx:p-1 jx:text-sm jx:outline-hidden jx:duration-100 jx:data-[side=bottom]:slide-in-from-top-2 jx:data-[side=inline-end]:slide-in-from-left-2 jx:data-[side=inline-start]:slide-in-from-right-2 jx:data-[side=left]:slide-in-from-right-2 jx:data-[side=right]:slide-in-from-left-2 jx:data-[side=top]:slide-in-from-bottom-2 jx:data-open:animate-in jx:data-open:fade-in-0 jx:data-open:zoom-in-95 jx:data-closed:animate-out jx:data-closed:fade-out-0 jx:data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
})

const PopoverHeader = React.forwardRef(function PopoverHeader({ className, ...props }: React.ComponentProps<"div">, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref}
      data-slot="popover-header"
      className={cn("jx:flex jx:flex-col jx:gap-0.5 jx:text-sm", className)}
      {...props}
    />
  )
})

const PopoverTitle = React.forwardRef(function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props, ref: React.ForwardedRef<HTMLHeadingElement>) {
  return (
    <PopoverPrimitive.Title ref={ref}
      data-slot="popover-title"
      className={cn("jx:font-medium", className)}
      {...props}
    />
  )
})

const PopoverDescription = React.forwardRef(function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props, ref: React.ForwardedRef<HTMLParagraphElement>) {
  return (
    <PopoverPrimitive.Description ref={ref}
      data-slot="popover-description"
      className={cn("jx:text-muted-foreground", className)}
      {...props}
    />
  )
})

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
