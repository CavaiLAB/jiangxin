# 文档站

用 [Rspress](https://rspress.rs) 把本仓库的文档做成一个站点：根目录的 `README.md` 与 `docs/`。

文档只有一份，以 Markdown 放在仓库里，在 GitHub 上直接能读。站点不另存副本，也不要求文档换写法。

## 怎么跑

需要 Node 22.18 以上、pnpm。在本目录下：

```bash
pnpm install
```

```bash
pnpm dev
```

```bash
pnpm build
```

```bash
pnpm preview
```

`pnpm dev` 是本机预览，改 `docs/` 下的文件会即时刷新。`pnpm build` 的产物在 `doc_build/`，`pnpm preview` 用来看构建产物。

## 页面从哪来

| 站点里的页面 | 来源 | 在 git 里 |
|---|---|---|
| 首页 | 根目录的 `README.md` | 生成到 `docs/index.md`，不进 git |
| 平台文档 | `docs/` | 就是原文件 |

`pnpm dev` 与 `pnpm build` 开头都会先同步一次，生成首页。单独同步用 `pnpm sync`。

改了根目录的 `README.md`，要重新同步才看得到；`docs/` 下的文件不用。

## 链接

文档里的链接照 GitHub 上点得开的写法写，站点在生成时改写：

| 文档里的写法 | 在站点里 |
|---|---|
| 相对路径，如 `docs/04-architecture.md` | 站内对应的页面 |
| 本仓库主干上的文档的完整地址，如 `https://github.com/CavaiLAB/jiangxin/blob/main/README.md` | 站内那一份；站点里没有这一页就仍去 GitHub |
| 根目录的 `README.md` 里用相对路径指向不进站点的文件，如 `AGENTS.md` | GitHub 上的地址 |
| 别的仓库的地址、指向仓库本身的地址、写了提交号的地址 | 不动 |

死链和失效的锚点会让 `pnpm build` 失败。

几条约束：

- 进站点的只有根目录的 `README.md` 和 `docs/`。图片要放在 `docs/` 下。
- 链接用 Markdown 的写法。直接写的 HTML `<a>` 标签不会被改写。
- `docs/index.md` 这个名字留给生成物。
- `docs/` 里的文档要指向根目录的 `README.md` 时，写完整的 GitHub 地址。

## 图

图用 Mermaid 语法写在 `` ```mermaid `` 代码块里。同一份源码有两处渲染：

| 在哪里看 | 谁渲染 |
|---|---|
| GitHub 上 | GitHub 自己 |
| 站点上 | 构建时用 [Pele](https://github.com/obsidianmd/pele) 渲染成静态 SVG，页面不带图表脚本 |

两边排出来的样子不一样。写图的时候以意思清楚为准，不必为了某一边的排法去调节点的顺序。

- 颜色与字体跟着站点的主题走，亮色暗色自动切换。对应关系在 `styles/diagrams.css`。
- 图按正文一栏的宽度排版，横排的图太宽时会改成竖排。窗口窄的时候图先缩小，缩到原大小的四分之三为止，再窄就横向滚动。这几个数在 `scripts/diagrams.ts` 的开头。
- 图画不出来会让 `pnpm build` 失败，报出是哪个文件的第几行。Pele 对齐的是 Mermaid 12.1 的语法，GitHub 上能显示的写法它不一定都认。
- 改了图，跑一次 `pnpm dev` 或 `pnpm build`，看看站点上的样子。

## 导航与侧栏

- 顶部导航在 `docs/_nav.json`，侧栏在 `docs/_meta.json`。
- `docs/` 顶层新增页面或目录，要在 `docs/_meta.json` 里登记，没登记的同步时会报错。
- 导航里的「Kun」是站外链接，指向 Kun 的仓库。Kun 会有自己对外的文档站（已定），地址还没有定；定了以后把这一项换成那个地址。

## 部署

站点部署在内网。合并到 `main` 后，CI 把构建产物发布到本仓库的 `docs-site` 分支，部署环境从这个分支取内容。从合并到站点更新大约两三分钟。

- 部署清单不在本仓库。
- `docs-site` 分支是发布产物，只有一个提交，每次发布强推。分支的内容整个换成这次的构建产物，上一次有、这次没有的页面不会留下。不要在上面提交东西。
- 站点上的 `/build-info.json` 记录它取自 `main` 的哪个提交、什么时候发布的。
- 要部署在子路径下，构建时用 `DOCS_BASE` 指定，例如 `DOCS_BASE=/jiangxin/ pnpm build`。现在的部署用的是根路径。

CI 不可用时可以手动发布。检出要是干净的，并且就是 `main` 的头提交：

```bash
pnpm site:publish
```

## CI

`.github/workflows/docs-site.yml`：每个 PR 上跑类型检查、脚本自测和构建，死链与失效的锚点会让它失败；`main` 上再加发布。构建只用本仓库的内容，不用另配密钥。

## 还没做的

- PR 预览。现在 PR 上只构建和检查，不发布预览。

## 改这里的脚本

```bash
pnpm test
```

```bash
pnpm typecheck
```

脚本在 `scripts/` 下：

| 文件 | 做什么 |
|---|---|
| `sync.ts` | 同步：由根目录的 `README.md` 生成首页，检查 `docs/_meta.json` 列全了页面 |
| `site-map.ts` | 仓库里的文件对应站点里的哪个页面，首页里的链接怎么改写 |
| `remark-repo-links.ts` | 构建时把 `docs/` 里指向本仓库文档的完整 GitHub 地址改成站内的 |
| `diagrams.ts` | 把 Mermaid 语法的图渲染成静态 SVG；排版宽度这几个参数在这里 |
| `remark-diagrams.ts` | 构建时把 `` ```mermaid `` 代码块换成渲染好的图 |
| `publish.sh` | 把构建产物发布到 `docs-site` 分支；`publish.test.sh` 是它的自测，用一个临时的假远端跑 |

图表的样式在 `styles/diagrams.css`。
