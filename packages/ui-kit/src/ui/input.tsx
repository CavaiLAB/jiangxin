import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"
import { fieldFocus, fieldFrame, fieldPadding, fieldPlaceholder } from "../lib/field.ts"
import "../styles/jx.tailwind.css"

/*
 * 内部件。shadcn 4.23.0（base-nova）生成，适配脚本处理过。给选择器的输入框用，不从包里导出：要输入框用 DSH 自己的 Input。
 * 手调：外框换成 lib/field.ts 的 fieldFrame（照 DSH 的输入框），去掉光晕和深色下的半透明底。
 */

const Input = React.forwardRef(function Input({ className, type, ...props }: React.ComponentProps<"input">, ref: React.ForwardedRef<HTMLElement>) {
  return (
    <InputPrimitive ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        fieldFrame,
        fieldPadding,
        fieldFocus,
        fieldPlaceholder,
        "jx:w-full jx:min-w-0 jx:file:inline-flex jx:file:h-6 jx:file:border-0 jx:file:bg-transparent jx:file:text-sm jx:file:font-medium jx:file:text-foreground",
        className
      )}
      {...props}
    />
  )
})

export { Input }
