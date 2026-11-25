/** 检查本身的单测用：这些写法没有问题，检查不能报。 */
import * as React from 'react'

/** forwardRef，ref 交给收到 props 的元素。 */
export const GoodInput = React.forwardRef(function GoodInput({ className, ...props }: React.ComponentProps<'input'>, ref: React.ForwardedRef<HTMLInputElement>) {
  return <input ref={ref} className={className} {...props} />
})

/** 自己也要用 ref 时，合并以后再交出去也算。 */
export const Merged = React.forwardRef(function Merged(props: React.ComponentProps<'div'>, forwardedRef: React.ForwardedRef<HTMLDivElement>) {
  const own = React.useRef<HTMLDivElement | null>(null)
  const ref = React.useCallback((node: HTMLDivElement | null) => {
    own.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef !== null) forwardedRef.current = node
  }, [forwardedRef])
  return <div ref={ref} {...props} />
})

/** 不转交 props 的组件不用管。 */
export function Label({ text }: { text: string }) {
  return <span>{text}</span>
}

function Title(props: { title: string }) {
  return <h1>{props.title}</h1>
}

/** 交给属性里没有 ref 的组件，也不用管。 */
export function UsesTitle({ ...props }: { title: string }) {
  return <Title {...props} />
}

/** 嵌套在别的函数里的函数不算组件。 */
export function List({ items }: { items: string[] }) {
  const renderItem = ({ ...props }: React.ComponentProps<'li'>) => <li {...props} />
  return <ul>{items.map(item => renderItem({ children: item, key: item }))}</ul>
}
