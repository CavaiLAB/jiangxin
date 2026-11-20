/**
 * @jx/brand-theme 的宿主一半：管「不在界面代码里」的那几处品牌。
 *
 * Web 服务在的时候（dsh web；桌面端没有这个服务）：
 *   - 首页 HTML 里的标题、主屏幕标题、站点图标链接；
 *   - 站点图标、主屏幕图标、Web 应用清单这几个文件（用同名路由顶掉 DSH 自带的）；
 *   - 运行时浏览器标题、启动加载页上的字样（往首页注入一段脚本和一段样式）；
 *   - 把产品版本号交给浏览器一半（关于页要显示）。
 * 系统提示词服务在的时候（只要跑智能体就有）：
 *   - 模型的自我介绍：往系统提示词最前面放一句带我们名字的话。
 *     上游那句带 DeepSeek Harness 的开场白由 cordis.patch.yml 关掉。
 *
 * 用到的都是文档里写了的接口：
 *   @deepseek-ai/dsh-host-webserver —— ctx.webServer.register、ctx.webServer.tapIndex、事件 webserver/index-inject；
 *   @deepseek-ai/dsh-system-prompt  —— ctx.systemPrompt.section。
 * 侧栏、首页、主题色、文案这些界面里的品牌由浏览器一半（src/client）负责。
 *
 * 两块各等各的服务：桌面端没有 webServer，但自我介绍那一块照样生效；
 * 窗口标题和图标由桌面壳自己管。
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { AGENT_IDENTITY_PROMPT, BRAND_GLOBAL, PRODUCT_VERSION_PATTERN, type BrandRuntimeInfo } from './brand.ts'
import {
  BOOT_PAGE_STYLE, BRAND_ROUTE_PREFIX, FAVICON_SIZES, TITLE_GUARD_SCRIPT,
  brandIndexHtml, brandManifest, pngAsSvg,
} from './host/index-html.ts'

/** Cordis 插件名。 */
export const name = 'jx-brand-theme'

/**
 * 系统提示词里那句自我介绍的位置和名字。
 * 位置用 -1000：上游的开场白就在这个位置（它的 README 写明），排在所有别的段前面。
 * 名字带 jx: 前缀，不会跟 DSH 自己的段重名（重名注册会抛错）。
 */
const IDENTITY_SECTION = { name: 'jx:brand-identity', order: -1000 } as const

/** 这一行在 cordis.patch.yml 里能配的东西。 */
export interface Config {
  /** 产品版本号，形如 v2026.11.20。不给就是本机构建，界面显示「本地开发」。 */
  version?: string
  /** 构建对应的提交。 */
  commit?: string
}

export const Config: z<Config> = z.object({
  version: z.string(),
  commit: z.string(),
})

/** 随包分发的图标目录。源码运行（src/index.ts）和构建产物（lib/index.js）离它都是一层。 */
const ASSET_DIR = new URL('../assets/web/', import.meta.url)

/** 一个静态响应的内容。 */
interface StaticBody {
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly type: string
}

/** 把字符串编码成响应体。 */
function text(value: string, type: string): StaticBody {
  return { bytes: new TextEncoder().encode(value), type }
}

/** 读一张随包分发的 PNG。 */
async function png(file: string): Promise<StaticBody> {
  const bytes = await readFile(new URL(file, ASSET_DIR))
  return { bytes: new Uint8Array(bytes), type: 'image/png' }
}

/**
 * 路由表：路径 → 内容。
 * 上半是 DSH 自带的那几个品牌文件的路径，同名顶掉（精确路由先于静态文件匹配）；
 * 下半是我们自己加的位图站点图标。
 */
function brandRoutes(): Record<string, () => Promise<StaticBody>> {
  const favicon = async (): Promise<StaticBody> =>
    text(pngAsSvg((await png('favicon-48.png')).bytes, 48), 'image/svg+xml')
  const routes: Record<string, () => Promise<StaticBody>> = {
    '/manifest.webmanifest': async () => text(brandManifest(), 'application/manifest+json'),
    '/favicon.svg': favicon,
    '/favicon-dark.svg': favicon,
    '/apple-touch-icon.png': () => png('apple-touch-icon.png'),
    '/icon-192.png': () => png('icon-192.png'),
    '/icon-512.png': () => png('icon-512.png'),
    '/icon-maskable-512.png': () => png('icon-maskable-512.png'),
  }
  for (const size of FAVICON_SIZES) {
    routes[`${BRAND_ROUTE_PREFIX}/favicon-${size}.png`] = () => png(`favicon-${size}.png`)
  }
  return routes
}

/**
 * 回答一次静态请求。缓存策略跟 DSH 自己的静态文件一致：no-cache 加弱 ETag，
 * 换了 logo 以后浏览器下次请求就能拿到新的。
 */
function respond(request: Request, body: StaticBody): Response {
  const headers = {
    'content-type': body.type,
    'cache-control': 'no-cache',
    etag: `W/"${createHash('sha1').update(body.bytes).digest('base64url')}"`,
  }
  if (request.headers.get('if-none-match') === headers.etag) return new Response(null, { status: 304, headers })
  return new Response(request.method === 'HEAD' ? null : body.bytes, { status: 200, headers })
}

/** 整理好的版本信息，外加一句要记到日志里的问题说明（没问题就没有）。 */
interface CheckedInfo {
  readonly info: BrandRuntimeInfo
  readonly problem?: string
}

/**
 * 校验并整理要交给浏览器一半的版本信息。
 * 版本号给了但格式不对时，当成没给：界面显示「本地开发」，日志里记一条告警。
 * 不在这里抛错——抛了这一行就起不来，网页标题和站点图标会退回 DSH 自己的，比显示「本地开发」更糟。
 * 发行目录的启动器（distribution/bin/jx-dsh）在更前面就会拦住格式不对的版本号。
 */
export function checkRuntimeInfo(config: Config): CheckedInfo {
  const version = config.version?.trim()
  const commit = config.commit?.trim()
  const hasVersion = version !== undefined && version !== ''
  const valid = hasVersion && PRODUCT_VERSION_PATTERN.test(version)
  return {
    info: {
      ...(valid ? { version } : {}),
      ...(commit !== undefined && commit !== '' ? { commit } : {}),
    },
    ...(hasVersion && !valid
      ? {
          problem: `@jx/brand-theme：产品版本号 ${JSON.stringify(version)} 格式不对，已按「本地开发」显示。`
            + '应形如 v2026.11.20、v2026.11.20-2 或 v2026.11.20-beta.1（月和日不补零）',
        }
      : {}),
  }
}

/**
 * 挂上品牌。顶层不声明依赖：两块各自等自己要的服务，缺哪个服务哪一块就不生效，互不拖累。
 * @param ctx 插件上下文。
 * @param config 这一行的配置。
 */
export function apply(ctx: Context, config: Config): void {
  const { info, problem } = checkRuntimeInfo(config)
  // 直接写到标准错误：默认的插件组合里没有挂日志输出，ctx.logger.warn 写了也看不到（实测）。
  if (problem !== undefined) console.warn(problem)

  ctx.inject(['webServer'], (web) => { brandWebSurface(web, info) })
  ctx.inject(['systemPrompt'], (prompt) => {
    prompt.effect(() => prompt.systemPrompt.section({
      ...IDENTITY_SECTION,
      text: AGENT_IDENTITY_PROMPT,
      // 这句是写死的文字，不做变量替换。
      interpolate: false,
    }), 'jx-brand-theme: agent identity')
  })
}

/**
 * Web 端那几处：品牌文件的路由、首页 HTML、首页注入。
 * @param ctx 带 webServer 服务的上下文。
 * @param info 要交给浏览器一半的版本信息。
 */
function brandWebSurface(ctx: Context, info: BrandRuntimeInfo): void {
  // 每个文件只读一次：读盘的结果按路径记在这个插件实例上，插件卸载时随实例一起丢掉。
  const cache = new Map<string, Promise<StaticBody>>()
  for (const [path, load] of Object.entries(brandRoutes())) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path,
      resource: async (request) => {
        let body = cache.get(path)
        if (body === undefined) {
          body = load()
          cache.set(path, body)
          // 读失败不留在缓存里，下次请求重读。
          body.catch(() => { cache.delete(path) })
        }
        return respond(request, await body)
      },
    }), `jx-brand-theme: route ${path}`)
  }

  ctx.effect(() => ctx.webServer.tapIndex(brandIndexHtml), 'jx-brand-theme: index html')

  ctx.on('webserver/index-inject', (table) => {
    table.push(
      { kind: 'global', name: BRAND_GLOBAL, value: info },
      { kind: 'script', placement: 'head', text: TITLE_GUARD_SCRIPT },
      { kind: 'style', text: BOOT_PAGE_STYLE },
    )
  })
}
