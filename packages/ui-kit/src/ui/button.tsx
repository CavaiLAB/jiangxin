import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import "../styles/jx.tailwind.css"

/*
 * 内部件。shadcn 4.23.0（base-nova）生成，适配脚本处理过。只给组件库里别的组件用（选择器里的小按钮、日历上的按钮），
 * 不从包里导出：要按钮用 DSH 自己的 Button。
 * 手调：尺寸、圆角、配色照 DSH 的 Button.module.css（默认高 36px、圆角 md、左右 14px、14/22；sm 高 28px、圆角 sm、
 * 12/18；禁用时 0.4 的不透明度）；焦点框交给 DSH 全局的 :focus-visible；去掉按下时下沉一像素、出错时的光晕。
 */

const buttonVariants = cva(
  "jx:group/button jx:inline-flex jx:shrink-0 jx:cursor-pointer jx:items-center jx:justify-center jx:rounded-md jx:text-sm jx:leading-[22px] jx:whitespace-nowrap jx:text-foreground jx:transition-colors jx:select-none jx:disabled:cursor-not-allowed jx:disabled:opacity-40 jx:[&_svg]:pointer-events-none jx:[&_svg]:shrink-0 jx:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "jx:bg-primary jx:text-primary-foreground jx:hover:not-disabled:bg-(--dsw-alias-button-primary-hover)",
        outline:
          "jx:border-[0.5px] jx:border-transparent jx:shadow-[inset_0_0_0_0.5px_var(--dsw-alias-border-l3)] jx:hover:not-disabled:bg-accent jx:aria-expanded:bg-accent",
        secondary:
          "jx:bg-secondary jx:text-secondary-foreground jx:hover:not-disabled:bg-accent jx:aria-expanded:bg-accent",
        ghost:
          "jx:hover:not-disabled:bg-accent jx:active:not-disabled:bg-(--dsw-alias-interactive-bg-active) jx:aria-expanded:bg-accent",
        destructive:
          "jx:text-destructive jx:hover:not-disabled:bg-accent",
        link: "jx:text-primary jx:underline-offset-4 jx:hover:underline",
      },
      size: {
        default: "jx:h-9 jx:gap-1 jx:px-3.5",
        xs: "jx:h-6 jx:gap-1 jx:rounded-sm jx:px-2 jx:text-xs jx:leading-[18px] jx:[&_svg:not([class*=size-])]:size-3",
        sm: "jx:h-7 jx:gap-1 jx:rounded-sm jx:px-2.5 jx:text-xs jx:leading-[18px] jx:[&_svg:not([class*=size-])]:size-3.5",
        lg: "jx:h-10 jx:gap-1 jx:px-4",
        icon: "jx:size-9",
        "icon-xs": "jx:size-6 jx:rounded-sm jx:[&_svg:not([class*=size-])]:size-3.5",
        "icon-sm": "jx:size-7 jx:rounded-sm",
        "icon-lg": "jx:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>, ref: React.ForwardedRef<HTMLElement>) {
  return (
    <ButtonPrimitive ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

export { Button, buttonVariants }
