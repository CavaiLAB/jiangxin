// Rspress 的 remark 插件：把指向本组织仓库文档的 GitHub 地址改成站内地址。
//
// docs/ 里的文档引用别的仓库时写的是完整的 GitHub 地址，这样在 GitHub 上也点得开。
// 被引用的文档如果已经聚进站点，就改指站内那一份；没有聚进来的保持原样。
//
// Rspress 自带的链接处理排在用户插件之前，所以这里直接给出它会给出的最终形式：
// 以 / 开头、带 .html 的站内路径。部署子路径（base）由主题在运行时补上。

import fs from 'node:fs';
import path from 'node:path';
import { parseRepoFileUrl, sitePathOf } from './site-map.ts';

interface MarkdownNode {
  type: string;
  url?: string;
  children?: MarkdownNode[];
}

export interface RepoLinksOptions {
  /** 站点的文档根目录 */
  docsDir: string;
  /** 聚合进站点的框架仓库名 */
  frameworks: readonly string[];
}

export function remarkRepoLinks(options: RepoLinksOptions): (tree: MarkdownNode) => void {
  const { docsDir, frameworks } = options;

  const visit = (node: MarkdownNode): void => {
    if ((node.type === 'link' || node.type === 'definition') && node.url !== undefined) {
      const target = parseRepoFileUrl(node.url);
      const site = target === null ? null : sitePathOf(target, frameworks);
      if (target !== null && site !== null && /\.mdx?$/.test(site) && fs.existsSync(path.join(docsDir, site))) {
        node.url = `/${site.replace(/\.mdx?$/, '.html')}${target.hash}`;
      }
    }
    node.children?.forEach(visit);
  };

  return (tree) => visit(tree);
}
