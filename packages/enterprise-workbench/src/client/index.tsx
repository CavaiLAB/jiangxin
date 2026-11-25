/**
 * @jx/enterprise-workbench 的浏览器一半：在侧栏加一个入口，在主区域加一个整页面板。
 *
 * 位置选的是 DSH 自己给「全局功能页」用的那一对插槽（「插件」「自动化任务」用的就是它们）：
 *   - sidebar.panellist  侧栏上的入口（图标加名称）
 *   - main               点了入口以后主区域显示的那一页
 * 两处用同一个面板 id 对上。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { API, EXPORT_PARAM, type ApiError, type EquipmentPage, type EquipmentQuery } from '../shared/protocol.ts'
import { NS, en, zh } from './locales.ts'
import { WorkbenchIcon } from './WorkbenchIcon.tsx'
import { WorkbenchPage, type LoadResult, type WorkbenchInjected } from './WorkbenchPage.tsx'

/** Cordis 插件名。 */
export const name = 'jx-enterprise-workbench'

/** 用到的服务：插槽登记表、文案。 */
export const inject = ['slots', 'locale']

/** 面板 id：侧栏入口和主区域的那一页靠它对上。 */
const PANEL_ID = 'jx-workbench' as MainPanelId

/** 侧栏里的位置：DSH 自带的「插件」是 0、「自动化任务」是 10，我们排在它们后面。 */
const PANEL_ORDER = 20

/**
 * 接口的完整地址。接口路径相对于当前页面去拼：页面可能挂在某个路径前缀下，
 * 桌面端的页面地址也不是 http 开头的。DSH 自己访问 api/file 也是这个写法。
 */
function apiUrl(path: string): string {
  return new URL(path.slice(1), document.baseURI).href
}

/**
 * 导出 CSV 的地址：条件写进查询参数（参数名见 EXPORT_PARAM，宿主那边按同一套规则解析）。
 * @param query 要导出哪些设备、怎么排。
 * @param options.bom 要不要 BOM。
 */
function exportUrl(query: EquipmentQuery, options: { bom: boolean }): string {
  const params = new URLSearchParams()
  if (query.sort !== undefined) params.set(EXPORT_PARAM.sort, `${query.sort.columnId}:${query.sort.direction}`)
  if (query.status !== undefined) params.set(EXPORT_PARAM.status, query.status)
  if (query.workshop !== undefined) params.set(EXPORT_PARAM.workshop, query.workshop)
  if (query.category !== undefined) params.set(EXPORT_PARAM.category, query.category)
  if (query.maintainedBefore !== undefined) params.set(EXPORT_PARAM.maintainedBefore, query.maintainedBefore)
  if (query.minRuntimeHours !== undefined) params.set(EXPORT_PARAM.minRuntimeHours, String(query.minRuntimeHours))
  if (query.ids !== undefined) params.set(EXPORT_PARAM.ids, query.ids.join(','))
  if (!options.bom) params.set(EXPORT_PARAM.bom, '0')
  const search = params.toString()
  return search === '' ? apiUrl(API.exportCsv) : `${apiUrl(API.exportCsv)}?${search}`
}

/** 宿主返回的东西看起来像不像一页台账。接口是我们自己的，这里只防两边版本对不上。 */
function isEquipmentPage(value: unknown): value is EquipmentPage {
  return typeof value === 'object' && value !== null && Array.isArray((value as EquipmentPage).rows)
}

/** 宿主返回的是不是我们约定的错误格式。 */
function isApiError(value: unknown): value is ApiError {
  const error = (value as ApiError | null | undefined)?.error
  return typeof error === 'object' && error !== null && typeof error.message === 'string'
}

/**
 * 挂上入口和面板。
 * @param ctx 浏览器端的插件上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'jx-enterprise-workbench: dictionaries')
  const t = ctx.locale.bind(NS)

  // 向宿主一半查台账。失败不抛出去，转成一句能给用户看的说明。
  const listEquipment = async (query: EquipmentQuery, signal: AbortSignal): Promise<LoadResult> => {
    try {
      const response = await fetch(apiUrl(API.listEquipment), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
        // 登录凭据在同源的 Cookie 里，DSH 的接口靠它认人。
        credentials: 'same-origin',
        signal,
      })
      const body: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        return { ok: false, message: isApiError(body) ? `${body.error.message}（${body.error.code}）` : `HTTP ${response.status}` }
      }
      if (!isEquipmentPage(body)) return { ok: false, message: '宿主返回的数据格式不对，两半的版本可能不一致' }
      return { ok: true, page: body }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  const injected: WorkbenchInjected = { listEquipment, exportUrl }

  // 入口和面板是一对，放在一个生成器里一起装：其中一个装不上，另一个也不留。
  ctx.slots.inject('main', () => ctx.slots.inject('sidebar.panellist', function* () {
    yield ctx.slots.register({
      name: 'main', key: PANEL_ID, locale: NS,
      inject: (): WorkbenchInjected => injected,
    }, WorkbenchPage)
    yield ctx.slots.register({
      name: 'sidebar.panellist', id: PANEL_ID, order: PANEL_ORDER, locale: NS,
      label: () => t('panel'),
    }, WorkbenchIcon)
  }))
}
