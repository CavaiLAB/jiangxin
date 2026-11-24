import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rspress/core';
import { remarkDiagrams } from './scripts/remark-diagrams.ts';
import { remarkRepoLinks } from './scripts/remark-repo-links.ts';
import { HOME_REPO, ORG } from './scripts/site-map.ts';
import { readSources } from './scripts/sources.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

// 文档只有一份，就是仓库根目录的 docs/。首页与 frameworks/ 由 scripts/sync.ts 生成进去。
const docsDir = path.join(here, '..', 'docs');
const frameworks = readSources(path.join(here, 'sources.json')).map((fw) => fw.repo);

// 部署在子路径下时用 DOCS_BASE 指定，例如 /jiangxin/
const base = process.env.DOCS_BASE ?? '/';

// 导航写在 docs/_nav.json，侧栏写在 docs/_meta.json：两个文件都在时，Rspress 给整站生成一张侧栏。
// 配置里一旦写 nav 或 sidebar，它就不再读这两个文件。
export default defineConfig({
  root: docsDir,
  base,
  lang: 'zh',
  title: '匠心工业智能体平台',
  description: '匠心工业智能体平台的框架级文档：平台总览，以及 Kun、Qian、SanYuanAgent 三个框架',
  logoText: '匠心工业智能体平台',
  // 产物里的链接带 .html，任何静态服务器都能直接打开
  route: { cleanUrls: false },
  markdown: {
    // 死链与失效的锚点在构建时报错
    link: { checkDeadLinks: true, checkAnchors: true },
    remarkPlugins: [
      [remarkRepoLinks, { docsDir, frameworks }],
      // ```mermaid 代码块在构建时渲染成静态 SVG，页面不带图表脚本
      [remarkDiagrams, { docsDir }],
    ],
  },
  // 图表的颜色与字体接到站点的主题上
  globalStyles: path.join(here, 'styles', 'diagrams.css'),
  // 不用持久的构建缓存：缓存命中的页面不会重新编译，指向它的失效锚点就查不出来。
  // 站点很小，每次全量构建只要一两秒。
  builderConfig: { performance: { buildCache: false } },
  themeConfig: {
    socialLinks: [{ icon: 'github', mode: 'link', content: `https://github.com/${ORG}/${HOME_REPO}` }],
    enableScrollToTop: true,
  },
});
