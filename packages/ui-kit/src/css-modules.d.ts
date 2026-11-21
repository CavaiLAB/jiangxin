/** CSS Modules 的类型声明：导入得到「本地类名 → 带哈希的类名」。 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}

/**
 * 全局样式表（不是 CSS Modules）：只为副作用导入，构建时原样注入页面，类名和选择器都不改。
 * 文件名约定 x.global.css——跟 x.module.css 区分开，免得两条通配声明对同一个文件都算数。
 * 只在「必须盖住别人的样式」时用（例如品牌包盖掉 DSH 里没有插槽的图形），组件自己的样式一律用 CSS Modules。
 */
declare module '*.global.css'

/** 浏览器一半里引用的图片：导入得到宿主 /plugins 路由下的地址。 */
declare module '*.png' {
  const url: string
  export default url
}

declare module '*.svg' {
  const url: string
  export default url
}

declare module '*.webp' {
  const url: string
  export default url
}
