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

/** 合并函数：把几个 ref 合成一个回调 ref。 */
function mergeRefs<T>(...refs: React.Ref<T>[]): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node)
      else if (ref !== null) (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

/** 参数就叫 ref，用合并函数和自己的 ref 合成一个再交出去，也算。 */
export const MergedByHelper = React.forwardRef(function MergedByHelper({ ...props }: React.ComponentProps<'button'>, ref: React.ForwardedRef<HTMLButtonElement>) {
  const own = React.useRef<HTMLButtonElement | null>(null)
  return <button ref={mergeRefs(ref, own)} {...props} />
})

/** 参数就叫 ref，在元素上的回调 ref 里调用它，也算。 */
export const MergedInline = React.forwardRef(function MergedInline({ ...props }: React.ComponentProps<'input'>, ref: React.ForwardedRef<HTMLInputElement>) {
  const own = React.useRef<HTMLInputElement | null>(null)
  return (
    <input
      ref={(node) => {
        own.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref !== null) ref.current = node
      }}
      {...props}
    />
  )
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
