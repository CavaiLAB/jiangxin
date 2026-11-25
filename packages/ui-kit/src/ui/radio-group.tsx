import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "cn"
import "../styles/jx.tailwind.css"

/*
 * 单选组。shadcn 4.23.0（base-nova）生成，适配脚本处理过（forwardRef）。
 * 手调：圆点 16px，和 DSH 的复选框一样大；选中用主色（DSH 的复选框用 brand-primary，和主按钮同色）；焦点框照 DSH 的
 * 复选框（2px、外扩 2px，颜色和鼠标点击时隐藏交给 DSH 全局的 :focus-visible）；去掉光晕和深色下的半透明底。
 * 文字标签由使用方自己写，见 README。
 */

const RadioGroup = React.forwardRef(function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <RadioGroupPrimitive ref={ref}
      data-slot="radio-group"
      className={cn("jx:grid jx:w-full jx:gap-2", className)}
      {...props}
    />
  )
})

const RadioGroupItem = React.forwardRef(function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props, ref: React.ForwardedRef<HTMLSpanElement>) {
  return (
    <RadioPrimitive.Root ref={ref}
      data-slot="radio-group-item"
      className={cn(
        "jx:group/radio-group-item jx:peer jx:relative jx:flex jx:aspect-square jx:size-4 jx:shrink-0 jx:rounded-full jx:border jx:border-input jx:group-has-[:focus-visible]/field-label:ring-0 jx:group-has-[:focus-visible]/field-label:not-data-checked:border-input jx:after:absolute jx:after:-inset-x-3 jx:after:-inset-y-2 jx:focus-visible:outline-2 jx:focus-visible:outline-offset-2 jx:disabled:cursor-not-allowed jx:disabled:opacity-50 jx:aria-invalid:border-destructive jx:aria-invalid:aria-checked:border-primary jx:data-checked:border-primary jx:data-checked:bg-primary jx:data-checked:text-primary-foreground jx:group-has-[:focus-visible]/field-label:data-checked:border-primary",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="jx:flex jx:size-4 jx:items-center jx:justify-center"
      >
        <span className="jx:absolute jx:top-1/2 jx:left-1/2 jx:size-2 jx:-translate-x-1/2 jx:-translate-y-1/2 jx:rounded-full jx:bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
})

export { RadioGroup, RadioGroupItem }
