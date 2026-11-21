/**
 * 品牌包自己界面上的文字（关于行、语言行）。
 * 命名空间归这个包所有；DSH 要求每个命名空间同时给出中文和英文。
 */
import { BRAND, LOCAL_BUILD_LABEL, UPSTREAM } from '../brand.ts'

/** 品牌包的文案命名空间。 */
export const NS = 'jx.brand'

/** 中文。 */
export const zh = {
  'about.version': '{product} {version}',
  'about.localBuild': `{product}（${LOCAL_BUILD_LABEL.zh}）`,
  'about.commit': '构建提交 {commit}',
  'about.builtOn': `基于 ${UPSTREAM.name} {version} 构建`,
  'about.license': '开源许可',
  'about.license.title': '开源许可',
  'about.license.description': `${BRAND.productName}基于开源项目 ${UPSTREAM.name} 构建。${UPSTREAM.name} 按 ${UPSTREAM.license} 许可发布，许可全文如下。`,
  'about.license.close': '关闭',
  'language.title': '语言',
  'language.locked': '语言由部署方统一设定，这里不能更改。',
} as const

/** 英文。产品的英文全称还没定，句子里先用拼音名。 */
export const en: Record<keyof typeof zh, string> = {
  'about.version': '{product} {version}',
  'about.localBuild': `{product} (${LOCAL_BUILD_LABEL.en})`,
  'about.commit': 'Build commit {commit}',
  'about.builtOn': `Built on ${UPSTREAM.name} {version}`,
  'about.license': 'Open-source license',
  'about.license.title': 'Open-source license',
  'about.license.description': `${BRAND.latinName} is built on the open-source project ${UPSTREAM.name}, which is released under the ${UPSTREAM.license} license. The full license text follows.`,
  'about.license.close': 'Close',
  'language.title': 'Language',
  'language.locked': 'The language is set by your deployment and cannot be changed here.',
}

/** 这个命名空间的键。 */
export type BrandKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 匠心品牌包自己的文字。 */
    'jx.brand': BrandKey
  }
}
