/**
 * 品牌的名称都集中在这个文件里：宿主一半和浏览器一半都从这里取。
 * 改名只改这里。产品名和短名「匠心」都已定。
 */

/** 产品名称。 */
export const BRAND = {
  /** 全称。能放下的地方都用全称。 */
  productName: '匠心工业智能体平台',
  /** 短名。只用在放不下全称的地方（主屏幕图标下的名字、托盘、窄标题）。 */
  shortName: '匠心',
  /** 英文界面里用的名字。英文全称产品负责人还没定，先用标识符的首字母大写形式。 */
  latinName: 'Jiangxin',
  /** 英文与标识符。 */
  identifier: 'jiangxin',
} as const

/**
 * 我们基于哪个上游构建。「DeepSeek Harness」是注册商标，不能出现在产品名里；
 * 说明关系时写「基于 DSH 构建」（上游 BRAND_GUIDELINES.md 明确允许这种写法）。
 */
export const UPSTREAM = {
  /** 上游的简称。 */
  name: 'DSH',
  /** 钉死的上游版本；界面上优先显示运行中实例报告的版本，取不到才用这个。 */
  pinnedVersion: '0.2.2-rc.5',
  /** 上游的版权声明（MIT 许可要求随分发保留）。 */
  copyright: 'Copyright (c) 2026 DeepSeek',
  license: 'MIT',
} as const

/**
 * 上游烤进客户端里的产品标题。运行时 DSH 会把浏览器标题设成「会话名 — <这个标题>」，
 * 宿主一半注入的脚本把它换成我们的产品名（见 src/index.ts 的 TITLE_GUARD_SCRIPT）。
 * 这里出现上游的商标只是为了认出要替换的字样，不会显示给用户。
 */
export const UPSTREAM_PRODUCT_TITLES = ['DeepSeek Harness'] as const

/**
 * 写进系统提示词最前面的那句自我介绍，顶替上游的 "You are an AI agent powered by DeepSeek Harness."。
 * 用户问「你是谁」「这是什么产品」时，模型照着这句答。句式跟上游一致，只换名字；措辞是初稿。
 * 系统提示词是英文的，所以这句也用英文，产品名用中文全称加拉丁名。
 */
export const AGENT_IDENTITY_PROMPT = `You are an AI agent powered by ${BRAND.productName} (${BRAND.latinName}).`

/** 没注入产品版本号的本机构建显示的文字（不拿 package.json 的版本号顶替）。 */
export const LOCAL_BUILD_LABEL = { zh: '本地开发', en: 'Local development' } as const

/** 宿主一半通过首页注入交给浏览器一半的数据，挂在这个全局名下。 */
export const BRAND_GLOBAL = '__JX_BRAND__'

/** 浏览器一半读到的品牌运行信息。 */
export interface BrandRuntimeInfo {
  /** 产品版本号，形如 v2026.11.20；没注入时没有这个字段。 */
  readonly version?: string
  /** 构建对应的提交。 */
  readonly commit?: string
}

/**
 * 产品版本号的校验式（规则见 docs/14-governance.md 第 7 节，带 v 的标签形式）。
 * 月和日不补零：v2026.5.12 对，v2026.05.12 不对。
 */
export const PRODUCT_VERSION_PATTERN = /^v[0-9]{4}\.([1-9]|1[0-2])\.([1-9]|[12][0-9]|3[01])(-([1-9][0-9]*|beta\.[1-9][0-9]*))?$/

/** 上游 MIT 许可全文，关于页里原样显示。出处：npm 包 @deepseek-ai/dsh 里的 LICENSE（和 DSH 源码根目录的 LICENSE 相同）。 */
export const UPSTREAM_LICENSE_TEXT = `MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
