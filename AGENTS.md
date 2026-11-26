# AGENTS.md：给编码代理的入口说明

这个仓库是**匠心工业智能体平台**的产品仓库，也是平台的主页。平台只按这一句描述（已定，2026-11-26，P79）：企业级的 AI 原生平台。人用自然语言说清要什么，智能体把它落成可运行的系统；系统上线后在人的反馈里继续改进。

结构只这样说：匠心是产品，代码在本仓库（已定，P41），目录和约定见下面「产品的代码」；Kun 是企业级框架，代码在 `CavaiLAB/kun`；DSH 是上游的 Agent 运行时，版本钉死，不改它的源码。

`docs/` 里是平台的文档：平台做什么与设计理念、工业智能制造、产品形态、总体架构、插件模型、应用互通、历史系统接入、Agent 协同、DSH 的对接与升级、在平台上做开发、遵循的标准、路线、协作约定、平台级裁定。

## 先读什么

1. [README.md](README.md)：平台是什么，匠心、Kun、DSH 各管什么，仓库里现在有什么。
2. [docs/glossary.md](docs/glossary.md)：名字与术语各指什么。
3. 平台级裁定：[docs/decisions/2026-11-17-platform.md](docs/decisions/2026-11-17-platform.md)（P1 至 P21）与 [docs/decisions/2026-11-19-platform.md](docs/decisions/2026-11-19-platform.md)（P22 至 P33），以及 [2026-11-20 迁移与发布裁定](docs/decisions/2026-11-20-release.md)（P34 至 P36）和 [2026-11-20 产品裁定](docs/decisions/2026-11-20-product.md)（P37 至 P41）、[2026-11-21 旧应用外壳迁移裁定](docs/decisions/2026-11-21-shell-migration.md)（P42、P43）和 [2026-11-23 旧 npm 版本迁移裁定](docs/decisions/2026-11-23-legacy-npm.md)（P44）、[2026-11-24 平台级裁定](docs/decisions/2026-11-24-platform.md)（P45 至 P56）和 [2026-11-25 平台级裁定](docs/decisions/2026-11-25-platform.md)（P57 至 P77）、[2026-11-26 平台级裁定](docs/decisions/2026-11-26-platform.md)（P78 至 P87），记录产品负责人已定的事项。没列在里面的都不是已定。新的裁定接着编号。
4. [docs/14-governance.md](docs/14-governance.md)：协作约定。
5. 要改产品的代码，再读下面「产品的代码」和那个目录里的 README。

## 规则

- 文档用中文。
- 不写参考平台和对标项目的名字。DSH 是产品的依赖，文档里称呼它写「DSH」，不写它的全称；代码里躲不开的包名和配置行名，照引的上游原文（源码、提示词、界面上的文字），以及许可与商标声明，照写。
- 分清「已定」「提议」「待定」。产品负责人没有裁定的事，不写成已定；需要拍板的问题登记出来，不自行决定。
- 说现状的时候写清是「已有」（已经实现）还是「规划」，不把规划写成已经实现。
- 平台的定位只用开头那一句，一个字不改。2026-11-26 起不再用的几种说法，新写的文字里不要出现，见[协作约定](docs/14-governance.md)第 5 节。「形态」这个词只用来说部署的两种形态。
- 本仓库是公开的。不放密钥和内部地址，不放还没修复的安全问题的细节，不放私有仓库的内部实现细节；不放产品清单与建设状态；对私有的来源产品只写可以承接的能力类别，不写功能盘点与差距，也不写它的名字。见[协作约定](docs/14-governance.md)第 11 节。这些对代码、注释、测试数据和提交说明一样适用，另外不留本机路径和用户名。
- 只写现在的名字和位置：不写前端框架的旧名、旧仓库的地址，不用「原」加框架名指代来源，不讲改名的经过；讲位置写路径或现在的名字。决策记录与历史文档、给使用者的迁移指南、改名与导入工具除外。见[协作约定](docs/14-governance.md)第 11 节。
- 企业级框架的代码在 `CavaiLAB/kun`：.NET 项目在 `src/`，组件清单在 `plugins/`。要改它去那个仓库，按那边的 `AGENTS.md` 办。Kun 的历史文件与本仓库的平台级裁定（`docs/decisions/` 下）有出入时，以平台级裁定为准。产品的代码在本仓库，见下一节。
- 另外两个仓库不要去改：`CavaiLAB/qian` 已归档，只读（P77）；`CavaiLAB/sanyuan-agent` 保留，暂不维护（P78）。
- 改了一处口径，把引用它的其他文档一起改掉：Kun 的 README 与文档引用这里的名称与分工。
- 改动走分支和 PR，不直接推 `main`。建仓期间的初始文档除外，见[协作约定](docs/14-governance.md)第 2 节。

## 产品的代码

都在仓库根下。各目录怎么用，看它自己的 README。

| 目录 | 是什么 | 包管理与检查 |
|---|---|---|
| [`distribution/`](distribution/README.md) | 发行目录：钉死版本的 DSH、以 tarball 装入的插件包、按文件名叠加的配置补丁、启动器 `bin/jx-dsh` 与启动前检查 `bin/jx-preflight.mjs`。Web 端和桌面端共用 | npm。`npm ci --ignore-scripts`，然后 `node bin/jx-preflight.mjs` |
| [`apps/web/`](apps/web/README.md) | Web 端：启动脚本，反向代理的配置与验证 | 用 `distribution/` 装好的依赖；`apps/web/dev.sh` 在本机起假模型和 Web 端 |
| [`apps/desktop/`](apps/desktop/README.md) | 桌面端：薄的 Electron 壳 | npm。`npm test`（单测不需要先装依赖）；启动与打包的准备见它的 README |
| [`apps/console/`](apps/console/README.md) | 管理端，先不做，占位 | — |
| [`packages/`](packages/README.md) | `brand-theme`（品牌包）、`enterprise-workbench`（企业插件样板，假数据）、`ui-kit`（界面组件包与插件构建脚本） | 各包各用 pnpm，先装 `ui-kit`。每个包里 `pnpm install --frozen-lockfile`、`pnpm run typecheck`、`pnpm run test` |
| [`tests/egress/`](tests/egress/README.md) | 外联检查 | 要 Docker |
| [`tools/mock-model/`](tools/mock-model/README.md) | 本机假模型 | 只用 Node 自带模块 |
| [`patches/`](patches/README.md) | 对 DSH 源码的补丁，一处一个文件 | `apps/desktop/scripts/check-patches.sh` |
| [`contracts/`](contracts/README.md) | 以后从后端契约生成的类型，占位 | — |
| [`brand/`](brand/README.md) | 匠心 logo 的原图，不在任何代码许可之内 | — |

改代码时守这几条：

- 仓库根不放 `package.json` 和 `pnpm-workspace.yaml`。`website/` 是独立的 pnpm 项目，CI 在 `website/` 里跑 `pnpm install --frozen-lockfile`，根上多一个工作区会打乱它。各项目用自己的清单和锁文件，统一的工作区以后再建。
- DSH 的版本钉死在 `distribution/package.json`（现在是 `0.2.2-rc.5`），不写范围。各包的 `engines.dsh` 和 DSH 开发依赖跟它保持一致。升级照 [distribution/README.md](distribution/README.md) 的「升级 DSH」做。
- 不改 DSH 的源码。我们的东西只有自己写的插件包和叠在 DSH 配置上的补丁；绕不过去的改动一处一个补丁放进 `patches/`，文件头写原因和撤销条件。
- 改了 `packages/` 下的插件包，跑 `distribution/scripts/vendor-packages.sh`，把 `distribution/vendor/` 下的 tarball、`distribution/package.json`、`distribution/package-lock.json` 和它生成的 `distribution/patches/70-*.yml`、`80-*.yml` 一起提交。生成的补丁不要手改。
- 启动 DSH 一律经 `distribution/bin/jx-dsh` 或桌面壳。它们会显式设 `DSH_HOME`、`DSH_AGENTS_HOME`，并用补丁把默认工作区放进状态目录。直接跑 `dsh` 时这三样缺一不可，不然会读写这台机器上别人自己的 DSH 状态（`~/.dsh`、`~/.agents`、`~/Documents/deepseek-harness`）。
- 本机试用走假模型（`tools/mock-model/`），不用真的模型密钥，不登录任何上游账号。
- CI 现在只构建文档站，产品代码的检查在本机跑（上表最后一列）。
- 仓库里的 shell 脚本，变量后面紧跟中文或全角标点时写 `${名字}`，不写 `$名字`。macOS 上的 bash 在 UTF-8 的语言环境下会把后面那个字的第一个字节读进变量名，脚本报变量未定义就退出；没设语言的环境里看不出来。改了 shell 脚本跑 `node tools/check-shell-vars.mjs`，启动用的脚本再在 `LANG=zh_CN.UTF-8` 下跑一遍。
- 代码里的标识符用英文，注释和说明用中文。

## 文档站

`website/` 是用 Rspress 搭的文档站，只放本仓库的文档。用法与约束见 [website/README.md](website/README.md)。

- 进站点的只有根目录的 `README.md` 和 `docs/`。代码旁边的 README 不进站点；`docs/` 里要指向它们（或仓库里任何 `docs/` 以外的文件）时，写完整的 GitHub 地址（`https://github.com/CavaiLAB/jiangxin/blob/main/<路径>`），写相对路径会被当成死链。根目录的 `README.md` 里照常写相对路径。`docs/` 里只放平台层面的内容：裁定、产品里有什么、术语；工程上的说明写在代码旁边。
- `docs/index.md` 是生成物，不进 git，不要手改。首页改根目录的 `README.md`。Kun 的文档在 Kun 的仓库里，站点导航里的「Kun」链到那里。
- 改了 `README.md` 或 `docs/` 下的文档，在 `website/` 下跑 `pnpm build`：死链和失效的锚点会让构建失败。PR 上 CI 跑的是同样的检查。
- 图用 Mermaid 语法写在 `` ```mermaid `` 代码块里。站点在构建时把它渲染成静态图，画不出来构建会失败；站点上的排版和 GitHub 上不一样。
- 合并到 `main` 后 CI 把站点发布到 `docs-site` 分支。那个分支是发布产物，不要在上面提交。
- `docs/` 顶层新增页面，在 `docs/_meta.json` 里登记。
- 图片放在 `docs/_images/` 下，用相对路径引用；放在 `docs/` 之外的带不进站点。界面示意图要写明是示意，图里不出现真实的企业、人名与数据。
- 改了 `website/scripts/`，跑 `pnpm test` 与 `pnpm typecheck`。
