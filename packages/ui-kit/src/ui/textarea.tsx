import * as React from "react"
import { cn } from "cn"
import { fieldFocus, fieldFrame, fieldPadding, fieldPlaceholder } from "../lib/field.ts"
import "../styles/jx.tailwind.css"

/*
 * 多行输入。shadcn 4.23.0（base-nova）生成，适配脚本处理过。
 * 手调：外框换成 lib/field.ts 的 fieldFrame（照 DSH 的输入框：0.5px 边框、圆角 md、底色 layer-1、14/22），一行的高度
 * 和输入框一样；去掉光晕和深色下的半透明底。高度随内容长（field-sizing: content），最少约两行半。
 */

const Textarea = React.forwardRef(function Textarea({ className, ...props }: React.ComponentProps<"textarea">, ref: React.ForwardedRef<HTMLTextAreaElement>) {
  return (
    <textarea ref={ref}
      data-slot="textarea"
      className={cn(
        fieldFrame,
        fieldPadding,
        fieldFocus,
        fieldPlaceholder,
        "jx:flex jx:field-sizing-content jx:min-h-16 jx:w-full",
        className
      )}
      {...props}
    />
  )
})

export { Textarea }
