# 在平台上做开发

> 状态：2026-11-26。本文是一张地图：能在哪几层做东西、各从哪开始、现在哪些能用。步骤写在代码旁边的说明和 Kun 的文档里，这里只指路，不抄。「已有」指现在就能照着做；「规划」指还没有实现；产品负责人没有裁定的做法标「提议」。

## 1 先认三样东西

- **匠心**是产品，代码在 [CavaiLAB/jiangxin](https://github.com/CavaiLAB/jiangxin)：Agent 工作区的 Web 端与桌面端、管理端、产品的插件、部署清单。
- **Kun** 是企业级框架，代码在 [CavaiLAB/kun](https://github.com/CavaiLAB/kun)，.NET 10：登录、权限、多租户、数据、事件、审计、模型服务的接口，以插件的形式装配。
- **DSH** 是上游的 Agent 运行时。版本钉死，不改它的源码；我们加的东西只有自己写的插件和叠在它配置上的补丁。

三者各管什么，见[总体架构](04-architecture.md)。

## 2 能在哪几层做东西

| 层 | 做出来的是什么 | 在哪里运行 | 现状 | 看哪一节 |
|---|---|---|---|---|
| DSH 的插件 | Agent 工作区里的入口和页面，可以带自己的后端接口 | 各人的 DSH 实例 | 已有 | 第 3 节 |
| 页面插件 | 只有浏览器一半的页面。管理端的页面是这一种（已定）；同一份装进工作区的右侧是提议，「待确认」这一页已定这样做 | 浏览器 | 没有实现 | 第 4 节 |
| Kun 的组件 | 平台上的一项能力，或一个业务应用的后端：数据、命令、事件、权限点 | Kun 的宿主，.NET | 运行时、开发包、命令行已有 | 第 5 节 |
| 用数据描述的应用 | 数据模型、表单、列表、流程、菜单、角色，没有界面代码 | Kun 存储与校验，平台的渲染器画界面 | 做法已定，没有实现 | 第 7 节 |
| 模型服务的适配 | 把一种模型服务接到平台的标准接口上 | Kun 的组件 | 规划 | 第 8 节 |

能力与权限怎么声明不是单独的一层：不管在哪一层做，权限都走 Kun 这一套，见第 6 节。

## 3 DSH 的插件（已有）

**是什么。** 装进 DSH 的一个包，分两半。宿主一半跑在 DSH 的 Node 进程里，可以开自己的后端接口。浏览器一半跑在 DSH 的客户端里，往侧栏加入口、在主区域开页面。两半都是 Cordis 插件。

**从哪开始。** 都在匠心的仓库里，按这个顺序读：

1. [Web 端的说明](https://github.com/CavaiLAB/jiangxin/blob/main/apps/web/README.md)里的「在本机起来」：先把工作区在本机跑起来，用的是假模型。
2. [packages 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/README.md)：有哪几个包，怎么装、怎么检查，写插件包的约定。
3. [企业插件样板的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/enterprise-workbench/README.md)里的「照着写一个新插件」。样板本身可以当模板：一个带后端接口和整页面板的插件，数据是假的。
4. [界面包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/ui-kit/README.md)：现成的界面组件，怎么加一个组件，放进 DSH 弹窗要守的两条规矩，以及构建脚本 `jx-dsh-plugin-build`。
5. [发行目录的说明](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md)里的「插件包怎么装进来」：做好的插件怎么进发行版。

**要知道的几条。**

- 界面上 DSH 自带的控件直接用 DSH 的。DSH 没有的基础组件用 shadcn 加 Tailwind 这一套（已定），放在界面包里，缺哪个补哪个。
- 插件对着发行目录里钉死的那个 DSH 版本写。升级 DSH 时插件要一起核对，见 [DSH 更新之后做什么](10-dsh-upgrade.md)。
- 插件除了加界面和接口，还能挂在 DSH 的别的接缝上：工具执行前后、人工确认、技能、子智能体、主题等。清单见[核对过的 DSH 事实](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/dsh-facts.md)的「可以挂东西的接缝」。
- 本机开发用假模型和自己的状态目录，启动一律经发行目录的启动器。这几条规矩写在匠心的 [AGENTS.md](https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md) 里。

**现状。** 品牌包和企业插件样板就是这样做出来的，装在发行目录里。宿主一半开后端接口，现在能用的只有精确路径的 HTTP 路由这一种写法。界面组件只在网页端核对过，桌面端没有单独试。

## 4 页面插件（没有实现）

**是什么。** 只有浏览器一半的页面，不带宿主一半。管理端的页面是这一种（已定）；同一份页面 DSH 的右侧和管理端都能装，是提议，「待确认」这一页已定这样做。它和第 3 节里插件的浏览器一半是同一类东西，都是浏览器里的 Cordis 插件。

**已定的**：

- 管理端也支持 Cordis，管理端的内容要能显示在 DSH 右侧的页签里。
- 管理端只要浏览器一侧：它的页面是只有浏览器一半的 Cordis 插件。带宿主一半的插件只在各人的 DSH 实例里跑。
- 「待确认」这一页做成页面插件，两边装同一份。

**提议的**（没有裁定）：DSH 的右侧和管理端各有一个很小的适配，把页面挂进去；页面的数据走平台的接口，不经过 DSH 实例。

**现状。** 没有实现。管理端还没有开始做，[`apps/console/`](https://github.com/CavaiLAB/jiangxin/blob/main/apps/console/README.md) 是占位；两边的适配都没有，所以还没有可以照着写的样板。试验里走通过两件事，用的都是假的平台接口：把现有的插件样板和品牌包原样装进一个不带对话的 Cordis 应用；在 DSH 的右侧登记自己的页签。

管理端在产品里的位置，见[产品形态](03-product.md)。

## 5 Kun 的组件

**是什么。** 组件是一个文件夹加一份清单（`.qian-plugin/plugin.json`）。里面是声明式的内容：权限点、角色、事件、工具描述、配置补丁等；可以带 .NET 代码，也可以一行代码都没有。它是分发与安装的单位。租户、身份、权限、数据、事件、审计这些平台能力，本身也是这样的组件。

Kun 里名字带 `qian` 的地方，比如组件 id 的前缀 `qian.`、清单目录 `.qian-plugin/`、命令行 `qian`，是保留下来的运行期字面，不表示产品名。

**谁的代码能进平台的进程。** 组件有信任等级。只有平台自己的和官方的组件，代码可以装进平台的共享进程；其余来源的代码只能隔离着跑，隔离运行的办法在规格里排在后面的阶段，是规划。没有代码的组件，各个等级都可以发布。规则见[组件模型规格](https://github.com/CavaiLAB/kun/blob/main/docs/prd/specs/component-model.md)的第 11 节。

**从哪开始。** 都在 Kun 的仓库里。Kun 自己的网站对外的地址还没有定，下面先链到 GitHub 上的文件。

| 要看什么 | 在哪里 |
|---|---|
| 文件夹怎么摆，清单的每个字段，各类声明式内容的文件格式，信任等级 | [组件模型规格](https://github.com/CavaiLAB/kun/blob/main/docs/prd/specs/component-model.md) |
| 一个完整的参考组件：清单、权限点、角色、工具描述、命令、事件、审计 | [客户参考应用](https://github.com/CavaiLAB/kun/blob/main/samples/Kun.Sample.Crm/README.md) |
| 用代码声明组件与能力，再派生清单里的字段 | [组件开发包](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Plugin.Sdk/README.md) |
| 安装、升级、移除、列出组件 | [`qian` 命令行](https://github.com/CavaiLAB/kun/blob/main/packages/qian-cli/README.md) |
| 各类声明式内容的 JSON Schema | [`schemas/v2`](https://github.com/CavaiLAB/kun/blob/main/schemas/v2/README.md) |
| 冻结的契约：错误、服务间令牌、事件信封、能力条目 | [`contracts/v0`](https://github.com/CavaiLAB/kun/blob/main/contracts/v0/README.md) |
| 接登录 | [身份客户端指南](https://github.com/CavaiLAB/kun/blob/main/docs/guides/identity-client.md) |
| 框架怎么上手（英文） | [Getting Started](https://github.com/CavaiLAB/kun/blob/main/docs/getting-started.md) |
| 构建、测试与代码约定 | Kun 的 [AGENTS.md](https://github.com/CavaiLAB/kun/blob/main/AGENTS.md) |

**现状。** 已有：组件的运行时，清单与声明式内容的校验，命令行的安装、升级、移除、列出；组件开发包，参考组件就是用它写的。规划：目录市场现在只有清单格式与校验，官方市场与目录网站没有做。成篇的上手文档还没有；Kun 要有自己的网站和使用文档（已定），网站对外的地址没有定。

## 6 能力与权限

**能力。** 平台上能被调用的一件事，登记成一项能力。一项能力写明：输入与输出的 Schema、副作用等级、需要的权限点、对不对 Agent 暴露、要不要人确认。字段以 Kun 的[能力条目契约](https://github.com/CavaiLAB/kun/blob/main/contracts/v0/README.md)为准。在 .NET 里把 `[Capability]` 标在请求上，工具描述（`tools/<名字>.json`）由代码派生，见[组件开发包](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Plugin.Sdk/README.md)。

- 能力目录已有。把目录里的能力交给 Agent 当工具用的那条路，是规划。
- 标了要人确认的能力，调用方是 Agent 或带着委托链时，平台自己不执行，先等人点头（已定）。还没有实现：这个标记现在只是登记，平台还不按它拦。

**权限点。** 权限点写成 `<组件 id>:<资源>:<动作>`，例如 `qian.sample.crm:customer:read`。组件在 `metadata/permissions.json` 里声明自己的权限点，在 `metadata/roles.json` 里写默认角色各拿到哪些；.NET 里可以用 `[Permission]` 声明，再派生出前一个文件。例子见[客户参考应用](https://github.com/CavaiLAB/kun/blob/main/samples/Kun.Sample.Crm/README.md)，规则见[权限组件的说明](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Authorization.Rbac/README.md)。

**判权限只问 Kun。** 平台上不论做什么系统，权限都走 Kun 这一套（已定）。整理时的读法：系统不自己判权限，只问 Kun，管理端、应用、插件、Agent 一侧的服务都一样。Kun 现行的做法是权限不进令牌，也不从令牌里的角色推导，每次都问权限引擎。界面可以按当前的人有哪些权限决定显示什么，但这不算判权限：判定在后端的入口上做。

怎么问，看代码跑在哪里：

| 代码跑在哪里 | 怎么接 | 现状 |
|---|---|---|
| Kun 的宿主里，.NET | HTTP 端点写 `.RequireKunPermission(…)`，命令实现 `IPermissionProtectedRequest`，gRPC 方法标 `[RequiresPermission(…)]`。三种入口都在业务代码之前判定，缺了权限引擎就拒绝 | 已有。见 [Kun.Authorization](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Authorization/README.md) 与 [Kun.Authorization.AspNetCore](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Authorization.AspNetCore/README.md) |
| Kun 的宿主以外：管理端、工作区服务、页面插件、DSH 插件的宿主一半 | 远程的授权接口，加客户端包 | 规划。HTTP 上现在只有两个只读的端点：一个列出当前已验证的主体自己持有的权限点；一个发布数据权限的元数据（有哪些数据范围、过滤条件、系统变量），不返回实际的授予。先做哪几种问法、令牌怎么带、多久生效已定，客户端包先出 TypeScript 与 .NET、.NET 的在前，见[总体架构](04-architecture.md)第 2.1 节 |

还没有的（规划）：

- 数据权限与字段权限，即按部门、按人过滤数据。端口已有，求值还没有，现在一律拒绝。
- Agent 主体与委托。还没有启用，带委托的请求现在被拒绝。

## 7 用数据描述的应用（做法已定，没有实现）

**是什么。** 一个应用整个用数据描述出来：数据模型、表单、列表、流程、菜单、角色。没有界面代码，界面由平台的渲染器用平台的组件画出来。它也是一个 Kun 的组件，里面全是声明式的内容。

**已定的。** Agent 生成的应用，界面只能是数据描述；生成的代码不当页面插件装。

Kun 现行规格里另有两条规则：Agent 生成的组件和人写的组件过同一个校验器；需要自己的逻辑时，只能写成沙箱里的函数。校验器已有，函数的沙箱还没有做。

**从哪开始。** 现在能读的是设计，还没有可以照着做的步骤：

- 格式放在哪：Kun 的[组件模型规格](https://github.com/CavaiLAB/kun/blob/main/docs/prd/specs/component-model.md)。组件文件夹里的 `forms/`、`lists/`、`flows/`、`pages/` 留给这几类内容，文件格式还没有定。
- 设计：Kun 需求文档的[第 8 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/08-s2-lowcode.md)，以及[第 10 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/10-s4-agent.md)的第 10.4 节。
- 已有的契约：字段类型与过滤条件，见[数据契约 v1](https://github.com/CavaiLAB/kun/blob/main/contracts/data/v1/README.md)。

**现状。** 规划。按数据描述读写业务记录的后端、表单与列表的渲染器、流程、发布的审批与记录，都没有实现。先后已定：先做确认卡的最小一圈，再做生成应用的最小一圈。

## 8 接模型服务（规划）

**已定的。** 模型服务由 Kun 提供。部署分两种形态，一种是带模型推理服务的集群，一种不带；要有标准的接口对接后面的模型推理服务，只提供一套；尽量用插件的形式实现（已定）。整理时的读法有两句：不带推理的那一种，通过 API 直接接第三方的模型服务；两种形态都接在这一套接口上。

**提议的**（没有裁定）：接口分三个面。

| 面 | 给谁用 | 是什么 |
|---|---|---|
| 调用面 | 应用、Agent、DSH 的实例 | OpenAI 兼容的接口。调用方只认平台的地址和平台发的凭据，用逻辑上的模型名，不知道后面是哪一种模型服务 |
| 接入面 | 要接一种模型服务的人 | 一个适配，做成 Kun 的组件：有哪些模型，各自能做什么，是否健康，怎么调。换一种推理服务，就是再写一个适配 |
| 管理面 | 管理端 | 模型目录、凭据、配额与限流、计量 |

照这个提议，做应用的人只面向调用面；要接一种新的模型服务的人只写接入面的适配；两种形态的差别落在装哪个适配上。

**现状。** 都没有实现。Kun 里的模型服务组件现在只有清单与配置的骨架，见 [`plugins/qian.model-gateway`](https://github.com/CavaiLAB/kun/blob/main/plugins/qian.model-gateway/README.md)；此前的设计在 Kun 的 [ADR-015](https://github.com/CavaiLAB/kun/blob/main/docs/adr/ADR-015-model-gateway.md) 与需求文档[第 7 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/07-s1-foundation.md)的第 7.16 节、[第 10 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/10-s4-agent.md)的第 10.5 节。匠心这边，DSH 的实例现在用一个环境变量指向一个 OpenAI 兼容的地址，本机默认指[假模型](https://github.com/CavaiLAB/jiangxin/blob/main/tools/mock-model/README.md)。以后怎么指到平台，见 [DSH 与企业级平台的对接](09-dsh-integration.md)。

## 9 动手之前

- 两个仓库各有一份入口说明，人和编码代理用同一份，先读：匠心的 [AGENTS.md](https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md)，Kun 的 [AGENTS.md](https://github.com/CavaiLAB/kun/blob/main/AGENTS.md)。
- 改动走分支和 PR，见[协作约定](14-governance.md)。
- 匠心的代码检查现在在本机跑，CI 只构建文档站；Kun 的检查在 CI 里。对着哪些标准、有哪些检查、还缺什么，见[遵循的标准](12-standards.md)。
- 名字与术语见[术语表](glossary.md)。

## 10 待定

| 事项 | 现在的情况 |
|---|---|
| 「待确认」以外的页面是不是也两边装同一份，两边的适配怎么写，页面的数据走哪条路 | 提议，见第 4 节 |
| 带业务的 Kun 组件放在哪个仓库 | 没有定。Kun 是通用的组件，不负责任何业务（已定） |
| 远程的授权接口与客户端包长什么样 | 先做哪几种问法等几条已定，见[总体架构](04-architecture.md)第 2.1 节；端点与字段的形状是提议，等 Kun 的契约定稿 |
| 模型服务的接口分哪几个面 | 提议，见第 8 节 |
| 匠心的包名前缀 `@jx/` | 提议，没有确认 |
| Kun 的网站对外的地址 | 已定：用产品负责人提供的域名，部署到 k3s。域名还没有给；给了以后，第 5 节的链接改指网站 |
