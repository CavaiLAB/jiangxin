# AGENTS.md：给编码代理的入口说明

这个仓库是**匠心智能体平台**的主页与总览：理念、总体架构、插件模型、Agent 协同、仓库归属、路线、协作约定、三种形态、平台级裁定。目前只有文档和文档站的工具（`website/`），没有产品代码。

## 先读什么

1. [README.md](README.md)：平台是什么，三个框架各管什么。
2. [docs/glossary.md](docs/glossary.md)：新旧名字各指什么。「Qian」换了所指，不读这张表会误解旧文档。
3. [docs/decisions/2026-11-17-platform.md](docs/decisions/2026-11-17-platform.md)：产品负责人定了什么。没列在里面的都不是已定。
4. [docs/07-governance.md](docs/07-governance.md)：协作约定。

## 规则

- 文档用中文。
- 不写参考平台和对标项目的名字。
- 分清「已定」「提议」「待定」。产品负责人没有裁定的事，不写成已定；需要拍板的问题登记出来，不自行决定。
- 说现状的时候写清是「已有」（在来源仓库里已经实现）还是「规划」，不把规划写成已经实现。
- 不放密钥和内部地址，不放还没修复的安全问题的细节，不放私有仓库的内部实现细节。
- 代码还在原仓库：后端在 `idadawn/kun` 与 `idadawn/qian`，前端在 `idadawn/qian`，Agent 引擎在 iClaw 仓库。要改代码去原仓库，按那边的 `AGENTS.md` 办。原仓库的 `AGENTS.md` 里，合并后的仓库与总名还是修订之前的写法，这两项以本仓库的[平台级裁定](docs/decisions/2026-11-17-platform.md)为准。
- 改了一处口径，把引用它的其他文档一起改掉：三个框架仓库的 README 都引用这里的名称与分工。
- 改动走分支和 PR，不直接推 `main`。建仓期间的初始文档除外，见[协作约定](docs/07-governance.md)第 2 节。

## 文档站

`website/` 是用 Rspress 搭的文档站，把本仓库与三个框架仓库的文档聚到一起。用法与约束见 [website/README.md](website/README.md)。

- `docs/index.md` 与 `docs/frameworks/` 是生成物，不进 git，不要手改。首页改根目录的 `README.md`，框架的文档去各框架仓库改。
- 改了 `README.md` 或 `docs/` 下的文档，在 `website/` 下跑 `pnpm build`：死链和失效的锚点会让构建失败。PR 上 CI 跑的是同样的检查。
- 图用 Mermaid 语法写在 `` ```mermaid `` 代码块里。站点在构建时把它渲染成静态图，画不出来构建会失败；站点上的排版和 GitHub 上不一样。
- 合并到 `main` 后 CI 把站点发布到 `docs-site` 分支。那个分支是发布产物，不要在上面提交。
- `docs/` 顶层新增页面，在 `docs/_meta.json` 里登记。
- 改了 `website/scripts/`，跑 `pnpm test` 与 `pnpm typecheck`。
