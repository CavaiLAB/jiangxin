/**
 * @jx/enterprise-workbench 的宿主一半：提供设备台账接口。
 *
 * 演示仓库外的插件怎样给自己的界面提供后端接口。用的是 DSH 的「精确路径 HTTP 路由」
 * （ctx.connection.fetch.register）：
 *   - POST /api/jx-workbench/equipment/list  查台账，JSON 进 JSON 出；
 *   - GET  /api/jx-workbench/equipment.csv   导出 CSV，查询参数里带和查台账同样的条件。
 * 这类路由自带登录校验，只有实例的主人能访问，没登录的请求到不了这里。
 *
 * 另外两条路在 0.2.2-rc.5 上都走不通（详见本包 README.md）：
 *   - 通用 RPC 通道（ctx.connection.rpc.handle）：在 0.2.2-rc.5 的实际组合里一调用就报错；
 *   - @Remote 类型化接口（ctx.remote.xxx）：要在构建时跑代码生成器，生成器假定代码在 DSH 的仓库里。
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-connection'
import { InvalidQueryError, parseExportParams, parseQuery, queryLedger, toCsv } from './host/ledger.ts'
import { API, ERROR_CODE, type ApiError } from './shared/protocol.ts'

/** Cordis 插件名。 */
export const name = 'jx-enterprise-workbench'

/** 要等连接服务就绪才能注册接口。 */
export const inject = ['connection']

/** 这一行在 cordis.patch.yml 里能配的东西。 */
export interface Config {
  /** 模拟接口延迟的毫秒数，演示「加载中」状态用。 */
  latencyMs: number
}

export const Config: z<Config> = z.object({
  latencyMs: z.number().step(1).min(0).max(10_000).default(0),
})

/** 等一会儿；请求被取消就立刻结束。 */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** 返回一段 JSON。接口的结果不该被缓存。 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** 返回一个查询条件不合法的错误。 */
function invalidQuery(message: string): Response {
  const body: ApiError = { error: { code: ERROR_CODE.invalidQuery, message } }
  return json(body, 400)
}

/**
 * 挂上接口。
 * @param ctx 插件上下文，带 connection 服务。
 * @param config 这一行的配置。
 */
export function apply(ctx: Context, config: Config): void {
  // 1. 查台账。
  ctx.effect(() => ctx.connection.fetch.register({
    path: API.listEquipment,
    methods: ['POST'],
    // buffered：请求体先整个收下来再交给我们，大小受 DSH 的 JSON 上限约束。
    requestBody: 'buffered',
    fetch: async (request) => {
      let payload: unknown
      try {
        const text = await request.text()
        payload = text === '' ? undefined : JSON.parse(text)
      } catch {
        // 请求体不是 JSON：按不合法的查询条件回。
        return invalidQuery('请求体不是合法的 JSON')
      }
      let query
      try {
        query = parseQuery(payload)
      } catch (error) {
        if (!(error instanceof InvalidQueryError)) throw error
        return invalidQuery(error.message)
      }
      await delay(config.latencyMs, request.signal)
      return json(queryLedger(query))
    },
  }), 'jx-enterprise-workbench: equipment list')

  // 2. 导出 CSV。浏览器直接打开这个地址就能下载；条件写在查询参数里（参数名见 EXPORT_PARAM）。
  ctx.effect(() => ctx.connection.fetch.register({
    path: API.exportCsv,
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let parsed
      try {
        // request.url 按理是完整地址；给个基准地址，万一只给了路径也解析得了。
        parsed = parseExportParams(new URL(request.url, 'http://localhost').searchParams)
      } catch (error) {
        if (!(error instanceof InvalidQueryError)) throw error
        return invalidQuery(error.message)
      }
      const headers = {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="equipment-ledger.csv"',
        'cache-control': 'no-store',
      }
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
      return new Response(toCsv(queryLedger(parsed.query).rows, { bom: parsed.bom }), { status: 200, headers })
    },
  }), 'jx-enterprise-workbench: csv export')
}
