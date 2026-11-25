/** 检查本身的单测用：这些写法在 React 18 上都收不到 ref，检查必须报出来。 */
import * as React from 'react'

/** 普通函数组件把 props 交给原生元素。 */
export function PlainInput({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={className} {...props} />
}

/** React 19 的写法：从 props 里解构 ref。 */
export function Destructured({ ref, ...props }: React.ComponentProps<'div'>) {
  return <div ref={ref} {...props} />
}

/** 用了 forwardRef，但没有把 ref 交给收到 props 的元素。 */
export const Forgot = React.forwardRef(function Forgot({ ...props }: React.ComponentProps<'span'>, ref: React.ForwardedRef<HTMLSpanElement>) {
  void ref
  return <span {...props} />
})

/**
 * 用了 forwardRef，元素上挂的是自己的 ref，转发进来的没交出去。参数恰好叫 ref（适配脚本起的就是这个名字），
 * 元素上的属性名 ref 不能当成用到了这个参数。
 */
export const OwnRef = React.forwardRef(function OwnRef({ className, ...props }: React.ComponentProps<'button'>, ref: React.ForwardedRef<HTMLButtonElement>) {
  const own = React.useRef<HTMLButtonElement>(null)
  return <button ref={own} className={className} {...props} />
})

/** 把 props 交给另一个属性里带 ref 的组件：这一层也要报。 */
export function Wrapper(props: React.ComponentProps<typeof PlainInput>) {
  return <PlainInput {...props} />
}

/** 箭头函数也算。 */
export const ArrowButton = ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>
