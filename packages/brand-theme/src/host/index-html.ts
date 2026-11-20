/**
 * 首页 HTML 上的品牌替换，都是纯函数，方便单测。
 *
 * DSH 发布的 index.html 里有三处品牌：<title>、主屏幕标题、站点图标链接。
 * 另外有两处是页面跑起来以后才出现的：运行时设的浏览器标题、启动加载页上的「HARNESS」字样，
 * 分别用一段注入的脚本和一段注入的样式处理。
 */
import { BRAND, UPSTREAM_PRODUCT_TITLES } from '../brand.ts'

/** 我们自己的站点图标挂在这个路径前缀下（宿主一半注册的路由）。 */
export const BRAND_ROUTE_PREFIX = '/jx-brand'

/** 站点图标的尺寸；每个尺寸对应 assets/web/favicon-<尺寸>.png。 */
export const FAVICON_SIZES = [16, 32, 48] as const

/** 转义放进 HTML 文本或属性里的字符串。 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 把 DSH 的 index.html 换成我们的品牌：标题、主屏幕标题、站点图标。
 * 写法对上游改动留了余地：先删掉认得的旧标签，再把我们的插到 </head> 前，
 * 所以上游调整了这些标签的写法或顺序，我们的标题和图标仍然会在。
 * 清单文件和主屏幕图标的链接不动：那几个路径由宿主一半用同名路由顶掉了。
 * @param html DSH 的 index.html 原文（已经渲染过注入行）。
 * @returns 换过品牌的 HTML。
 */
export function brandIndexHtml(html: string): string {
  const iconLinks = FAVICON_SIZES
    .map(size => `<link rel="icon" type="image/png" sizes="${size}x${size}" href=".${BRAND_ROUTE_PREFIX}/favicon-${size}.png" />`)
    .join('\n    ')
  const ours = [
    `<title>${escapeHtml(BRAND.productName)}</title>`,
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(BRAND.shortName)}" />`,
    iconLinks,
  ].join('\n    ')
  const stripped = html
    .replace(/[ \t]*<title>[\s\S]*?<\/title>[ \t]*\r?\n?/i, '')
    .replace(/[ \t]*<meta\s+name="apple-mobile-web-app-title"[^>]*>[ \t]*\r?\n?/gi, '')
    .replace(/[ \t]*<link\s+rel="icon"[^>]*>[ \t]*\r?\n?/gi, '')
  if (!/<\/head>/i.test(stripped)) return stripped
  return stripped.replace(/[ \t]*<\/head>/i, tail => `    ${ours}\n${tail}`)
}

/**
 * 守住浏览器标题的脚本。
 *
 * 为什么需要：DSH 的界面跑起来以后会自己设 document.title，值是「会话名 — 产品标题」，
 * 其中产品标题在上游发布时已经烤进了客户端代码（ui-layout 的 DocumentTitle），没有配置项也没有插槽。
 * 只改 HTML 里的 <title> 管不住它。这段脚本在页面最开头接管 document.title 的写入，
 * 把上游的产品标题换成我们的。
 *
 * 这是不改源码时最不侵入的办法，但它依赖「上游用 document.title 赋值」这个实现细节。
 * 正路是给 @deepseek-ai/dsh-client-ui-layout 打补丁或者从源码重建时设 DSH_CLIENT_TITLE，
 * 详见本包 README.md 的「换不掉或靠取巧的位置」。
 */
export const TITLE_GUARD_SCRIPT = `(function(){
var product=${JSON.stringify(BRAND.productName)};
var upstream=${JSON.stringify(UPSTREAM_PRODUCT_TITLES)};
var desc=Object.getOwnPropertyDescriptor(Document.prototype,'title');
if(!desc||!desc.get||!desc.set)return;
function brand(value){
var text=String(value);
for(var i=0;i<upstream.length;i++)text=text.split(upstream[i]).join(product);
return text;
}
Object.defineProperty(document,'title',{
configurable:true,
enumerable:true,
get:function(){return desc.get.call(document);},
set:function(value){desc.set.call(document,brand(value));}
});
})();`

/**
 * 盖住启动加载页字样的样式。
 *
 * 界面插件加载完之前，DSH 显示一个不依赖任何框架的加载页，上面写着「HARNESS」（写死在
 * @deepseek-ai/dsh-client-web 的 boot-page.ts 里）。它的类名是哈希过的，只有根元素带
 * data-dsh-boot 属性可以当锚点，所以这里按结构选中「卡片里的第一个元素」，把原字隐藏、换成我们的名字。
 *
 * 依赖的内部结构：[data-dsh-boot] > 卡片 > 字样（第一个子元素）。上游改了结构这条规则就不生效，
 * 那时加载页会重新露出「HARNESS」，不会报错。
 */
export const BOOT_PAGE_STYLE = `[data-dsh-boot]>div>div:first-child{font-size:0;letter-spacing:0}
[data-dsh-boot]>div>div:first-child::after{content:${JSON.stringify(BRAND.productName)};font-size:16px;line-height:24px;letter-spacing:.04em}`

/** 我们的 Web 应用清单：安装到主屏幕或当作应用打开时显示的名字和图标。 */
export function brandManifest(): string {
  return `${JSON.stringify({
    name: BRAND.productName,
    short_name: BRAND.shortName,
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2)}\n`
}

/**
 * 把一张 PNG 包成 SVG。DSH 的站点图标路径是 /favicon.svg，我们的 logo 是位图，
 * 顶掉这个路径时要给出货真价实的 SVG，所以把位图嵌进去。
 * @param png PNG 文件内容。
 * @param size 图标边长。
 * @returns SVG 文本。
 */
export function pngAsSvg(png: Uint8Array, size: number): string {
  const data = Buffer.from(png).toString('base64')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<image width="${size}" height="${size}" href="data:image/png;base64,${data}"/></svg>\n`
}
