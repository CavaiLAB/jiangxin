// 仓库里的文件与站点页面怎么对应，Markdown 里的链接怎么改写。
//
// 文档是写给 GitHub 看的：根目录的 README.md 用相对路径，docs/ 里指向 docs/ 以外的文件写完整的 GitHub 地址。
// 站点只收本仓库根目录的 README.md 与 docs/，这里算出这些链接在站点里该指向哪里。

import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

/** 本仓库在 GitHub 上的地址。 */
export const REPO_URL = 'https://github.com/CavaiLAB/jiangxin';

const PAGE = /\.mdx?$/;

/**
 * 仓库里的文件在站点文档根目录下的相对路径；不进站点的返回 null。路径相对仓库根目录，用正斜杠。
 *
 * 进站点的只有根目录的 README.md 与 docs/ 下的文件：README.md → index.md，docs/x → x。
 */
export function sitePathOf(file: string): string | null {
  if (file === 'README.md') return 'index.md';
  if (file.startsWith('docs/') && !file.endsWith('/')) return file.slice('docs/'.length);
  return null;
}

const REPO_FILE_URL = new RegExp(`^${REPO_URL.replaceAll('.', '\\.')}/blob/main/([^?#]+)(#.*)?$`);

/**
 * 认出指向本仓库主干上某个文件的 GitHub 地址：.../blob/main/<路径>，给出路径与锚点。别的地址返回 null。
 *
 * 只认 main：写了提交号的地址指的是那个版本的原文，不能换成站点里的这一份。
 * 别的仓库的地址也返回 null，它们照常去 GitHub。
 */
export function parseRepoFileUrl(url: string): { path: string; hash: string } | null {
  const match = REPO_FILE_URL.exec(url);
  const rawPath = match?.[1];
  if (rawPath === undefined) return null;
  try {
    return { path: decodeURIComponent(rawPath), hash: match?.[2] ?? '' };
  } catch {
    return null;
  }
}

/**
 * 算出根目录的 README.md 里的一个链接在首页里该写成什么。返回 null 表示不动。
 *
 * exists 回答站点文档根目录下有没有某个文件。
 *
 * - 指向进了站点的页面：改成站内的相对路径，交给 Rspress 去规整和查死链。
 * - 相对路径指向仓库里不进站点的文件（比如 AGENTS.md）：改成 GitHub 上的完整地址。
 * - 完整的 GitHub 地址指向的文档不在站点里：不动，仍然去 GitHub。
 * - 图片只能放在 docs/ 下，放在别处的带不进站点，直接报错。
 */
export function rewriteReadmeUrl(
  url: string,
  exists: (sitePath: string) => boolean,
  kind: 'link' | 'image' = 'link',
): string | null {
  if (url === '' || url.startsWith('#')) return null;

  const absolute = parseRepoFileUrl(url);
  let target: string;
  let hash: string;
  if (absolute) {
    target = absolute.path;
    hash = absolute.hash;
  } else {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return null;
    const parts = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(url);
    const rawPath = parts?.[1] ?? '';
    if (rawPath === '' || parts?.[2] !== undefined) return null;
    hash = parts?.[3] ?? '';
    let decoded: string;
    try {
      decoded = decodeURI(rawPath);
    } catch {
      return null;
    }
    // README.md 在仓库根目录：相对路径和以 / 开头的路径都从根目录算起
    target = path.posix.normalize(decoded.startsWith('/') ? decoded.slice(1) : decoded);
    // 指到仓库外面去了，原样留着
    if (target === '..' || target.startsWith('../')) return null;
  }

  const site = sitePathOf(target);

  if (kind === 'image') {
    if (absolute) return null;
    if (site === null) throw new Error(`图片 ${url} 不在 docs/ 下，带不进站点`);
    // 图片是当模块引入的：不带 ./ 的路径会被打包器当成包名，到 node_modules 里去找
    return `./${site}${hash}`;
  }

  if (site !== null && PAGE.test(site) && (!absolute || exists(site))) return site + hash;
  if (absolute) return null;
  return `${REPO_URL}/blob/main/${encodeURI(target)}${hash}`;
}

/**
 * 一个目录的 _meta.json 漏列了哪些条目。漏列的页面不会出现在侧栏里。
 *
 * meta 是 _meta.json 的内容：每一项是文件名（可以带扩展名），或者是带 name 的对象；没有 name 的项（分节标题这类）不算。
 * entries 是这个目录下该出现在侧栏里的页面名（不带扩展名）与子目录名。
 */
export function missingFromMeta(meta: unknown, entries: readonly string[]): string[] {
  if (!Array.isArray(meta)) throw new Error('_meta.json 要是一个数组');
  const listed = new Set(
    meta
      .map((item: unknown) => (typeof item === 'string' ? item : (item as { name?: unknown } | null)?.name))
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.replace(PAGE, '')),
  );
  return entries.filter((name) => !listed.has(name));
}

interface MarkdownNode {
  type: string;
  url?: string;
  children?: MarkdownNode[];
  position?: { start: { line: number; offset?: number }; end: { offset?: number } };
}

/**
 * 改写一份 Markdown 里的链接与图片地址，其余内容一个字不动。
 *
 * 用解析器找出链接的位置，再在原文上按位置替换地址。代码块、行内代码里的内容不算链接；
 * 直接写出来的地址（`<https://…>` 或裸地址）显示的就是地址本身，也不改。
 */
export function rewriteLinks(source: string, mapUrl: (url: string, kind: 'link' | 'image') => string | null): string {
  const tree: MarkdownNode = fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const edits: { start: number; end: number; text: string }[] = [];

  const visit = (node: MarkdownNode): void => {
    if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && node.url !== undefined) {
      const next = mapUrl(node.url, node.type === 'image' ? 'image' : 'link');
      if (next !== null && next !== node.url) {
        const start = urlStart(source, node, node.url);
        if (start !== null) {
          if (/[\s<>()]/.test(next)) throw new Error(`第 ${node.position?.start.line} 行：改写后的地址 ${next} 里有空格或括号，写不进链接`);
          edits.push({ start, end: start + node.url.length, text: next });
        }
      }
    }
    node.children?.forEach(visit);
  };
  visit(tree);

  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

/** 链接地址在原文里的起始位置；直接写出来的地址返回 null。 */
function urlStart(source: string, node: MarkdownNode, url: string): number | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) throw new Error('解析结果里没有位置信息');
  const text = source.slice(start, end);

  if (node.type === 'link' && !text.startsWith('[')) return null;

  const opener = node.type === 'definition' ? text.indexOf(']:') : text.lastIndexOf('](');
  let at = opener < 0 ? -1 : opener + 2;
  while (at >= 0 && at < text.length && /\s/.test(text.charAt(at))) at += 1;
  if (at >= 0 && text.charAt(at) === '<') at += 1;
  if (at < 0 || !text.startsWith(url, at)) {
    throw new Error(`第 ${node.position?.start.line} 行的链接改写不了（地址里带转义？）：${text}`);
  }
  return start + at;
}
