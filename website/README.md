# 文档站

用 [Rspress](https://rspress.rs) 把四个仓库的框架级文档聚成一个站点：本仓库的 README 与 `docs/`，加上 `kun`、`qian`、`sanyuan-agent` 三个仓库各自的 README 与 `docs/`。

文档只有一份，以 Markdown 放在各自的仓库里，在 GitHub 上直接能读。站点不另存副本，也不要求文档换写法。

## 怎么跑

需要 Node 22.18 以上、pnpm，以及对三个框架仓库的读权限。在本目录下：

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
| 首页 | 本仓库根目录的 `README.md` | 生成到 `docs/index.md`，不进 git |
| 平台文档、决策记录 | 本仓库的 `docs/` | 就是原文件 |
| 三个框架 | 各框架仓库的 `README.md` 与 `docs/`，取 `sources.json` 里钉住的提交 | 生成到 `docs/frameworks/`，不进 git |

`pnpm dev` 与 `pnpm build` 开头都会先同步一次，生成上面两处。单独同步用 `pnpm sync`。取回的内容缓存在 `.cache/` 里，钉住的提交不变就不再联网。

改了根目录的 `README.md`，要重新同步才看得到；`docs/` 下的文件不用。

## 升级框架文档的版本

站点显示的是钉住的那个版本。各框架仓库后来的改动，要升了版本才进站点。每个框架页面的末尾写着它取自哪个提交。

```bash
pnpm sync:update
```

这条命令把 `sources.json` 里钉住的提交挪到各仓库 `main` 的最新提交。之后跑一次 `pnpm build` 确认没有死链，再把 `sources.json` 的改动提交上来。

## 链接

文档里的链接照 GitHub 上点得开的写法写，站点在生成时改写：

| 文档里的写法 | 在站点里 |
|---|---|
| 同一个仓库里的相对路径，如 `docs/migration.md` | 站内对应的页面 |
| 别的仓库主干上的文档，如 `https://github.com/CavaiLAB/kun/blob/main/docs/migration.md` | 站内那一份；站点里没有这一页就仍去 GitHub |
| 仓库里不进站点的文件，如 `AGENTS.md` | GitHub 上的地址 |
| 指向仓库本身的地址，或写了提交号的地址 | 不动 |

死链和失效的锚点会让 `pnpm build` 失败。

几条约束：

- 每个仓库进站点的只有 `README.md` 和 `docs/`。图片要放在 `docs/` 下。
- 链接用 Markdown 的写法。直接写的 HTML `<a>` 标签不会被改写。
- 本仓库的 `docs/index.md` 与 `docs/frameworks/` 这两个名字留给生成物。框架仓库的 `docs/` 下也不要有 `index.md`，它会和 README 在站点里撞成同一页。
- 本仓库 `docs/` 里的文档要指向根目录的 `README.md` 时，写完整的 GitHub 地址。

## 导航与侧栏

- 顶部导航在 `docs/_nav.json`，侧栏在 `docs/_meta.json`。
- `docs/` 顶层新增页面或目录，要在 `docs/_meta.json` 里登记，没登记的同步时会报错。`decisions/` 下新增的文件自动出现在侧栏里。
- 新增一个框架仓库：在 `sources.json` 里加一项，在 `docs/_nav.json` 里加一个导航项。

## 取仓库用的地址

缺省跟着本仓库的 `origin` 走：本仓库是用 SSH 克隆的，取另外三个也用 SSH。要换，设环境变量 `SOURCES_GIT_BASE`，例如 `https://github.com/CavaiLAB/`。

## 还没做的

- 部署。站点还没有部署到任何地方。部署在子路径下时用 `DOCS_BASE` 指定，例如 `DOCS_BASE=/jiangxin/ pnpm build`。
- CI。还没有在 CI 里构建。构建要读三个私有仓库，得先配一个有读权限的凭据。
- 原仓库 `idadawn/qian` 那个文档站里的组件页、API 参考与示例没有并进来，怎么并待定。

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
| `sync.ts` | 同步：取回各框架仓库钉住的版本，生成首页与 `docs/frameworks/` |
| `site-map.ts` | 仓库里的文件对应站点里的哪个页面，链接怎么改写 |
| `remark-repo-links.ts` | 构建时把 `docs/` 里指向别的仓库文档的地址改成站内的 |
| `sources.ts` | 读写 `sources.json` |
