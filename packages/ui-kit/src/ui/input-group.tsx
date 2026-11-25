import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "./button.tsx"
import { Input } from "./input.tsx"
import { Textarea } from "./textarea.tsx"
import { fieldFrame } from "../lib/field.ts"
import "../styles/jx.tailwind.css"

/*
 * 内部件。shadcn 4.23.0（base-nova）生成，适配脚本处理过。给选择器的输入框用（输入框加右边的小按钮），不从包里导出。
 * 手调：外框换成 lib/field.ts 的 fieldFrame，高度由里面的输入框撑出来（和 DSH 的输入框一样高），旁边的小按钮不再
 * 把它撑高；小按钮圆角用 sm；去掉光晕和深色下的半透明底。
 */

const InputGroup = React.forwardRef(function InputGroup({ className, ...props }: React.ComponentProps<"div">, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref}
      data-slot="input-group"
      role="group"
      className={cn(
        fieldFrame,
        "jx:group/input-group jx:relative jx:flex jx:w-full jx:min-w-0 jx:items-center jx:in-data-[slot=combobox-content]:focus-within:border-inherit jx:has-disabled:opacity-50 jx:has-[[data-slot=input-group-control]:focus-visible]:border-ring jx:has-[[data-slot][aria-invalid=true]]:border-destructive jx:has-[>[data-align=block-end]]:flex-col jx:has-[>[data-align=block-start]]:flex-col jx:has-[>[data-align=block-end]]:[&>input]:pt-3 jx:has-[>[data-align=block-start]]:[&>input]:pb-3 jx:has-[>[data-align=inline-end]]:[&>input]:pr-1.5 jx:has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className
      )}
      {...props}
    />
  )
})

const inputGroupAddonVariants = cva(
  "jx:flex jx:h-auto jx:cursor-text jx:items-center jx:justify-center jx:gap-2 jx:text-sm jx:font-medium jx:text-muted-foreground jx:select-none jx:group-data-[disabled=true]/input-group:opacity-50 jx:[&>kbd]:rounded-[calc(var(--dsw-radius-md)-5px)] jx:[&>svg:not([class*=size-])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "jx:order-first jx:pl-2 jx:has-[>button]:ml-[-0.3rem] jx:has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "jx:order-last jx:pr-2 jx:has-[>button]:mr-[-0.3rem] jx:has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "jx:order-first jx:w-full jx:justify-start jx:px-2.5 jx:pt-2 jx:group-has-[>input]/input-group:pt-2 jx:[.border-b]:pb-2",
        "block-end":
          "jx:order-last jx:w-full jx:justify-start jx:px-2.5 jx:pb-2 jx:group-has-[>input]/input-group:pb-2 jx:[.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

const InputGroupAddon = React.forwardRef(function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref}
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
})

const inputGroupButtonVariants = cva(
  "jx:flex jx:items-center jx:gap-2 jx:text-sm jx:shadow-none",
  {
    variants: {
      size: {
        xs: "jx:h-6 jx:gap-1 jx:rounded-sm jx:px-1.5 jx:[&>svg:not([class*=size-])]:size-3.5",
        sm: "",
        "icon-xs":
          "jx:size-6 jx:rounded-sm jx:p-0 jx:has-[>svg]:p-0",
        "icon-sm": "jx:size-8 jx:p-0 jx:has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

const InputGroupButton = React.forwardRef(function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }, ref: React.ForwardedRef<HTMLButtonElement>) {
  return (
    <Button ref={ref}
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
})

const InputGroupText = React.forwardRef(function InputGroupText({ className, ...props }: React.ComponentProps<"span">, ref: React.ForwardedRef<HTMLSpanElement>) {
  return (
    <span ref={ref}
      className={cn(
        "jx:flex jx:items-center jx:gap-2 jx:text-sm jx:text-muted-foreground jx:[&_svg]:pointer-events-none jx:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    />
  )
})

const InputGroupInput = React.forwardRef(function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">, ref: React.ForwardedRef<HTMLInputElement>) {
  return (
    <Input ref={ref}
      data-slot="input-group-control"
      className={cn(
        "jx:flex-1 jx:rounded-none jx:border-0 jx:bg-transparent jx:shadow-none",
        className
      )}
      {...props}
    />
  )
})

const InputGroupTextarea = React.forwardRef(function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">, ref: React.ForwardedRef<HTMLTextAreaElement>) {
  return (
    <Textarea ref={ref}
      data-slot="input-group-control"
      className={cn(
        "jx:flex-1 jx:resize-none jx:rounded-none jx:border-0 jx:bg-transparent jx:shadow-none",
        className
      )}
      {...props}
    />
  )
})

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
