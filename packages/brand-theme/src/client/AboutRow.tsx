/**
 * 「设置 → 通用」里的关于行：产品名、产品版本、基于哪个上游构建、上游的开源许可。
 *
 * 它顶替 DSH 自带的「当前版本」行（那一行只显示 DSH 自己的版本号）。
 * 上游的 MIT 许可要求随分发保留版权声明和许可全文，所以许可全文能从这里打开。
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BRAND, UPSTREAM_LICENSE_TEXT } from '../brand.ts'
import mark96 from './assets/mark-96.png'
import css from './AboutRow.module.css'

/** 注册时交给这一行的数据（组件拿不到插件上下文，数据都从这里进）。 */
export interface AboutRowInjected {
  /** 产品版本号，形如 v2026.11.20；本机构建没有。 */
  version: string | undefined
  /** 构建对应的提交；没有就不显示。 */
  commit: string | undefined
  /** 正在运行的上游版本。 */
  upstreamVersion: string
}

/** 关于行的全部属性。 */
export type AboutRowProps =
  PropsRuntime<'settings.general.item'> & PropsLocale<'jx.brand'> & InjectFace<AboutRowInjected>

/**
 * 画关于行。
 * @param props 翻译函数和注册时注入的版本信息。
 * @returns 关于行。
 */
export function AboutRow({ t, version, commit, upstreamVersion }: AboutRowProps): ReactNode {
  const [licenseOpen, setLicenseOpen] = useState(false)
  const product = version === undefined
    ? t('about.localBuild', { product: BRAND.productName })
    : t('about.version', { product: BRAND.productName, version })
  return (
    <div className={css.row} data-jx-brand-about>
      <img className={css.mark} src={mark96} width={40} height={40} alt="" draggable={false} />
      <div className={css.text}>
        <div className={css.product}>{product}</div>
        <div className={css.meta}>
          <span>{t('about.builtOn', { version: upstreamVersion })}</span>
          {commit === undefined ? null : <span>{t('about.commit', { commit: commit.slice(0, 12) })}</span>}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => { setLicenseOpen(true) }}>
        {t('about.license')}
      </Button>
      <Modal
        open={licenseOpen}
        onClose={() => { setLicenseOpen(false) }}
        title={t('about.license.title')}
        closeLabel={t('about.license.close')}
        description={t('about.license.description')}
      >
        <pre className={css.license}>{UPSTREAM_LICENSE_TEXT}</pre>
      </Modal>
    </div>
  )
}
