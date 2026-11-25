// Rspress 的 remark 插件：把指向本仓库文档的完整 GitHub 地址改成站内地址。
//
// docs/ 里的文档有时要写完整的 GitHub 地址（比如指向根目录的 README.md），这样在 GitHub 上也点得开。
// 指向的文档在站点里，就改指站内那一份；不在的保持原样。别的仓库的地址不动。
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
}

export function remarkRepoLinks(options: RepoLinksOptions): (tree: MarkdownNode) => void {
  const { docsDir } = options;

  const visit = (node: MarkdownNode): void => {
    if ((node.type === 'link' || node.type === 'definition') && node.url !== undefined) {
      const target = parseRepoFileUrl(node.url);
      const site = target === null ? null : sitePathOf(target.path);
      if (target !== null && site !== null && /\.mdx?$/.test(site) && fs.existsSync(path.join(docsDir, site))) {
        node.url = `/${site.replace(/\.mdx?$/, '.html')}${target.hash}`;
      }
    }
    node.children?.forEach(visit);
  };

  return (tree) => visit(tree);
}
