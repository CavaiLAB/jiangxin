# DSH 事实清单

写产品的代码时要查的 DSH 事实，每条带出处。出处里的路径相对 DSH 源码的根目录（标签 `dsh-v0.2.2-rc.5`）。

「核对」一栏的意思：

- **标签**：对着 `dsh-v0.2.2-rc.5` 的源码核的。
- **主干**：对着当时（2026-11-20）DSH 的主干核的。主干比标签新，目录有过调整，用之前先在标签的源码里确认，有出入以标签为准。
- **实测**：在 `0.2.2-rc.5` 上实际跑出来的。

清单没写到的，去源码里查，别猜。要动手试的话，把源码按标签检出到仓库根下的 `upstream/dsh-ref`（不入库）。

## 1 版本与获取

| 事实 | 出处 | 核对 |
|---|---|---|
| 钉死的版本是 `0.2.2-rc.5`，标签 `dsh-v0.2.2-rc.5`，提交 `9c2670d3`，2026-11-18 | 源码的 `git log -1` | 标签 |
| 要求 Node ≥ 24.9.0；上游自己构建用 pnpm 11.28.5 | 根目录 `package.json` | 标签 |
| npm 上有这一版的：`@deepseek-ai/dsh`（命令行与运行时）、`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-theme` | `npm view <包>@0.2.2-rc.5 version` | 标签 |
| npm 上没有桌面壳：`@deepseek-ai/dsh-desktop`、`@deepseek-ai/dsh-desktop-host` 是源码仓库里的私有包 | 同上；`apps/desktop/package.json` 的 `private: true` | 标签 |
| 许可是 MIT，版权方 DeepSeek。分发要带版权声明和许可全文 | `LICENSE` | 标签 |
| 上游的全称是注册商标，别的项目名里不能用全称，可以写「DSH」，可以说明是基于它构建的 | `BRAND_GUIDELINES.md` | 标签 |
| 上游自己说明：没有经过安全审计，不能当作安全的、可用于生产的软件 | `SAFETY.md` | 主干 |

## 2 启动与配置

| 事实 | 出处 | 核对 |
|---|---|---|
| `dsh --profile <名字>` 启动 `$DSH_HOME/profiles/<名字>`；`DSH_HOME` 默认是 `~/.dsh` | `docs/cli-help.md` | 标签 |
| 自带的应用模板（组合包）：`base`、`web-app`、`headless`、`sdk-app`、`sdk-minimal`、`acp-app` | `packages/bundle/` | 标签 |
| `dsh --profile <名字> --from-default-profile <模板>` 从自带模板建或重置一个 profile | `docs/user/develop/basic/publish.md` | 标签 |
| `--patch <文件>` 在其他层之后再叠一层；`--dump-config` 打印合成后的配置；`--dump-config-schema` 打印配置的 JSON Schema | `docs/cli-help.md` | 标签 |
| Web 的参数：`--host`、`--port`（默认 `127.0.0.1:3080`）、`--no-open`、`--public-url`、`--trusted-host`、`--tls-cert`、`--tls-key`。`--host` 只接受一个具体的 IP，`0.0.0.0` 会被拒绝 | `docs/cli-help.md`；源码 | 标签 |
| 配置的叠加顺序：profile 引用的各组合包的补丁（`@deepseek-ai/dsh-base` 最先）→ profile 自己的 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → `--patch` 的文件（按命令行顺序） | `docs/user/develop/basic/publish.md` 的「The loading order」 | 标签 |
| 后面的层按行覆盖前面的。补丁写了 `config` 就把这一行的整个 `config` 换掉，不是按键合并；只写 `disabled: true` 时原来的 `config` 保留 | 同上 | 标签、实测 |
| 界面上的开关能通过 profile 层覆盖组合包的默认值；家目录层和命令行层优先，和它们冲突的界面写入会被拒绝 | `packages/session/session-log-deepseek/README.md` | 标签、实测 |
| 要锁住的设置只能放家目录层或 `--patch` 层；放组合包层、profile 层，界面照样能改 | `distribution/tests/settings-lock.mjs` | 实测 |
| 放在反向代理后面的部署有官方说明 | `docs/user/guide/public-deployments.md` | 标签 |
| 配置键的总表 | `docs/config-catalog.md` | 标签 |
| 补丁里可以写 `!!js process.env.X`、`dshHomePath('…')`；相对路径按补丁文件的位置解析 | `packages/bundle/web-app/cordis.patch.yml`；`publish.md` | 标签、实测 |

## 3 身份与隔离

| 事实 | 出处 | 核对 |
|---|---|---|
| 调用方身份只有 `owner` 一种 | `packages/typert/protocol/src/types.ts:457` | 标签 |
| 通过认证的调用方一律是 `owner` | `packages/api/remote-access/src/index.ts`（主干挪到了 `packages/host/authentication-token/`） | 标签（位置），主干（行为） |
| 会话记录里没有用户和租户字段；设置、插件、凭据整个实例共用 | `docs/subsystems/session.md`、`settings.md`、`credentials.md` | 主干 |
| 只设 `DSH_HOME` 隔离不了。默认工作区是 `<系统文稿目录>/deepseek-harness/default-workspace`（macOS 上就是 `~/Documents/deepseek-harness/default-workspace`），和 `DSH_HOME` 无关；共享的智能体配置根目录 `DSH_AGENTS_HOME` 默认是 `~/.agents`。要同时设 `DSH_AGENTS_HOME`，并用补丁改 `workspace-controller.documentsDirectory`。默认工作区一旦登记就不会再挪 | `packages/api/workspace-controller/src/default-directory.ts`；`packages/workspace/workspace/src/index.ts`；`packages/util/home-paths/src/index.ts` | 标签、实测 |
| 默认工作区路径中间那一段 `deepseek-harness` 写死在 `@deepseek-ai/dsh-api-workspace-controller` 里，配置只能换它的上一级 | 发布包的 `lib/index.js` | 实测 |
| `desktop` 这个 profile 名被命令行拒绝，留给上游的桌面壳 | `apps/cli/src/args.ts` 的 `rejectElectronProfile` | 标签、实测 |

## 4 默认往外发数据的地方

发行目录的补丁逐条关掉了它们，见 [../README.md](../README.md)。

| 事实 | 出处 | 核对 |
|---|---|---|
| 会话日志上传默认开（`enabled: z.boolean().default(true)`）。不是单独的上传接口：发往官方模型路由的每个请求体里夹带 `dsh_session_log`（会话 ID、工作目录、到这一刻的全部事件）和 `dsh_plugin_packages`（已装插件清单） | `packages/session/session-log-deepseek/src/index.ts:60` | 实测 |
| 发往官方路由的请求头里带匿名用户标识 `x-deepseek-harness-user-id` 和 `x-deepseek-harness-session-id`；走 `llm-pi-ai` 的自定义路由时不带 | `packages/identity/anonymous-user-id/` | 实测 |
| 会话遥测默认是 `FEEDBACK_ONLY`：用户提交反馈后约 8 秒，把整段会话日志发往上游的收集端。`DSH_TELEMETRY_MODE=DISABLED` 或补丁 `session-telemetry-otel.mode: DISABLED` 关掉；关掉以后反馈对话框仍然说会上传 | `docs/subsystems/otel.md` | 实测 |
| 产品分析（`desktop-product-telemetry`、`product-analytics`）在 rc.5 里只在 `desktop` profile 下打开，Web 端默认不开；上游桌面壳里默认开、界面上关不了 | `packages/bundle/web-app/cordis.patch.yml` | 实测（Web）、标签（桌面） |
| 默认模型路由是 `deepseek-official`；接别家或自己的 OpenAI 兼容接口用 `llm-pi-ai` | `packages/llm/llm-pi-ai/`、`docs/user/guide/providers.md` | 主干 |
| 联网搜索的提供方是上游的接口；网页抓取在实例上直接访问模型给的网址 | `docs/tool-catalog.md` | 主干 |
| 插件管理器有备用的公共镜像源；模型可以调 `plugin_manager` 工具装插件（要用户批准） | `packages/boot/plugin-manager/` | 主干 |
| 打开插件页会向公共 npm 源测速（`ui-plugin-manager.registryProbeEnabled` 可关） | — | 实测 |
| 点开未安装的官方插件详情，会向三个公共 CDN 读说明文档。地址写死在 `@deepseek-ai/dsh-plugin-detail`，`plugin-manager.detailNpmFileSources` 至少要留一家，配置关不掉 | — | 实测 |
| Linux 上 `@deepseek-ai/node-addon-system` 调 `process.report.getReport()`，会对每个已连接的对端做同步 DNS 反查；Node 参数 `--report-exclude-network` 关掉 | — | 实测 |
| 发给模型的请求一律带 `User-Agent: deepseek-harness/<版本> (+GitHub 地址) dsh-profile/<profile>`，配置改不了；`DSH_USER_AGENT_SUFFIX` 会被 `dsh` 启动器改写成 `dsh-profile/<profile>`，借不上 | — | 实测 |
| 桌面端会向上游查询更新策略 | `apps/desktop/README.md` 的「Updates」「Mandatory update policy」 | 标签 |

## 5 插件怎么打包、怎么装

| 事实 | 出处 | 核对 |
|---|---|---|
| 组合包（bundle）是一个 npm 包，`package.json` 里写 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`；`patch` 可以是一个有序的文件列表 | `docs/user/develop/basic/publish.md` | 标签 |
| 没写 `dsh.bundle` 的包也能装，但只算普通依赖，不启用任何东西 | 同上 | 标签 |
| `"engines": { "dsh": "<范围>" }` 声明支持的 DSH 版本。安装时不满足会拒绝；启动时不拒绝，只跳过（profile 里的组合包）或停用（补丁插入的行）那个包，DSH 照常起来，只在标准错误里打一行告警 | 同上 | 标签（文档）、实测（启动） |
| 版本范围按「包含预发布版本」算：`0.2.x`、`>=0.2.0 <0.3.0` 也认 `0.2.2-rc.5`；`^0.2.2`、`0.2.2` 不认 | — | 实测 |
| `dsh plugin --profile <名字> <pnpm 参数>` 在 profile 目录里跑 pnpm，本地路径、链接都能装 | `docs/cli-help.md`、`publish.md` | 标签 |
| 用 `dsh plugin add` 装的包出现在插件页、用户能关掉，它的补丁在组合包层、设置界面改得动；装进发行目录再用 `--patch` 挂上的，不出现在插件页、用户关不掉 | — | 实测 |
| 本地插件包装进发行目录时，包的真实目录必须在发行目录的 `node_modules` 里（用 tarball 装）；`file:` 指向目录的依赖是符号链接，包里对 DSH 模块的引用会解析失败 | — | 实测 |
| 按包名写的插件行，DSH 从 `$DSH_HOME/profiles/<名>/` 往上找包，不从 DSH 的安装目录找；状态目录不在发行目录里面时报 `ERR_MODULE_NOT_FOUND`。`--patch` 补丁里要写相对补丁文件的入口文件路径；写包目录报 `ERR_UNSUPPORTED_DIR_IMPORT` | — | 实测 |
| `--dump-config` 不导入插件，也不跑版本门禁：插件找不到、`engines.dsh` 对不上，合成配置里照样列出那一行、不告警 | — | 实测 |
| 插件自己的配置字段要标 `.volatile()` 才能在设置界面改；挂在 `--patch` 层的行标了也改不动 | — | 实测 |
| 插件的浏览器一半用 `dsh.client` 声明，要用到 DSH 客户端自己的服务（界面布局、会话、设置、侧栏等） | `docs/subsystems/client-modules.md`、`web-client.md` | 主干 |
| 插件开发的入门文档 | `docs/user/develop/basic/`（`index`、`config`、`tool`、`publish`）、`framework/`（`service`、`events`）、`practice/` | 标签 |
| 做法手册 | `docs/cookbook/`：`extension-cookbook`、`adding-a-settings-card`、`adding-a-remote-api`、`adding-a-tool`、`adding-an-llm-adapter`、`adding-a-plugin-preview` | 标签 |
| 插件市场是实验性的，DSH 不自带索引源 | `docs/user/guide/plugin-market.md`、`apps/plugin-market-generator/` | 主干 |

## 6 可以挂东西的接缝

出处主要是 `docs/capability-seams.md`、`docs/tool-execution-pipeline.md`、`docs/subsystems/`，对着主干核的。

- 模型：`ctx.llm`，适配器在 `packages/llm/`。
- 工具执行前后：`tools/pre-execute`（放行、拒绝、取消、转人工确认；不能改参数）、`tools/post-execute`。
- 人工确认：`ctx.approval`，结果有 `allowed-once`、`rejected`、`cancelled`、`unavailable`；异步，没有超时，默认拒绝。见 `docs/subsystems/approval.md`。
- 存储与会话持久化：`ctx.storage`、`ctx.sessionPersistence`。
- 凭据：`ctx.credentials`。
- 连接认证：`ctx.connection.authentication` 只在主干有，rc.5 没有能单独替换的认证接缝。
- 插件自己的后端接口：rc.5 里精确路径的 HTTP 路由 `ctx.connection.fetch.register` 能用；通用 RPC 通道 `ctx.connection.rpc.handle` 一调用就报错（实测，原因见 `packages/enterprise-workbench/README.md`）。
- 文件、子进程、命令行、沙箱：`ctx.fs`、`ctx.subprocess`、`ctx.shell`、`ctx.sandbox`。
- 子智能体：`ctx.subagents`。
- 主题：`ctx.theme`，可以注册主题（改别名变量、换图标）。
- 技能：`ctx.skills`（`SKILL.md`）。
- MCP 客户端：支持 stdio 和 Streamable HTTP，请求头里可以写 `${credential:引用名}`。见 `docs/subsystems/mcp.md`。
- 智能体工厂：每个进程只有一个槽位，已经注册了再注册会报错。

## 7 界面

| 事实 | 出处 | 核对 |
|---|---|---|
| 前端是 React 18，没有用第三方组件库；自己的基础组件包是 `@deepseek-ai/dsh-client-ui-primitives` | `packages/client/ui-primitives/` | 标签、主干 |
| 样式用 CSS Modules 加 `clsx`，变量是 `--dsw-*` 和 `--dsw-alias-*`；规矩是不加组件库、不用 Tailwind | `docs/web-styling.md`、`packages/client/ui-theme/` | 主干 |
| 没有的组件：数据表格、日期选择、树、上传、分页、通用表单 | `packages/client/ui-primitives/src/` | 主干 |
| 三栏的外框在 `ui-layout`；`ui-dockkit` 是内部的停靠引擎 | `packages/client/ui-layout/`、`ui-dockkit/` | 标签 |
| 官方品牌由 `@deepseek-ai/dsh-client-ui-brand-official` 提供：构建变量 `DSH_CLIENT_BUILD_PROFILE` 是 `official` 时注册侧栏的官方标志和名称，否则用外壳自带的小鱼标志和「本地构建」字样 | `packages/client/ui-brand-official/README.md` | 标签 |
| 第三方能占的品牌插槽：`sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark`（首页标志）；关掉 `ui-brand-official` 这一行就没有官方的鲸鱼动画和字标 | `docs/subsystems/slots.md` | 实测 |
| 浏览器标签页的标题写死在 `@deepseek-ai/dsh-client-ui-layout` 的构建产物里（`productTitle`），没有配置项也没有插槽 | 发布包的 `lib/client.js` | 实测 |
| 界面扩展的参考：对话行的自定义渲染、设置卡片、右侧栏、插槽 | `docs/subsystems/conversation.md`、`settings.md`、`sidebar-right.md`、`slots.md` | 标签 |

## 8 桌面壳

对着标签的源码核的。

- 目录：`apps/desktop/`（Electron 壳）、`apps/desktop-host/`（宿主一侧）。发布相关的在 `apps/desktop/publishing/`。
- 构建与打包的说明：`apps/desktop/README.md`、`apps/desktop/packaging/README.md`、`apps/desktop/publishing/README.md`。
- 上游的开发启动是在仓库根目录跑 `pnpm run dev:desktop`；开发时的状态默认放在 `apps/desktop/.desktop-build/development/` 下，显式设 `DSH_HOME` 只替换其中的 DSH 状态目录。
- 调试端口默认是 9229、9222、9230，可以用 `DSH_DESKTOP_MAIN_INSPECT_PORT`、`DSH_DESKTOP_RENDERER_DEBUG_PORT`、`DSH_DESKTOP_HOST_INSPECT_PORT` 改。
- 打包脚本在 `apps/desktop/package.json`：`package:mac:arm64:unsigned`、`package:mac:arm64:dir` 等。后者不是未签名构建，它走签名加公证的分支。
- 写死的产品名：`apps/desktop/src/locale.ts` 里 88 处，`apps/desktop/src/main.ts` 1 处。
- 启动时有欢迎窗口：检查有没有配置模型的密钥，没有就引导登录上游账号或填密钥。见 `apps/desktop/README.md` 的「Startup onboarding」。
- 桌面端管理插件用的 profile 是 `$DSH_HOME/profiles/desktop`。
- 协议：`dsh://`（如 `dsh://open`）。我们的薄壳不登记这个协议，登记了会和用户自己装的桌面版抢。
- 用 Electron 自带的 Node 跑 `dsh`（`ELECTRON_RUN_AS_NODE=1`）要加 `--expose-internals`：DSH 的加载器要用 Node 内部的模块加载器，在 Electron 里只有加这个参数才拿得到。上游桌面壳也是这么跑的。

更细的盘点在 `apps/desktop/docs/`。

## 9 版本节奏

对着主干核的。

- 发布全是预发布版：2026-08-17 到 2026-11-18 共 41 个，平均一周三个。
- 仓库里近 400 个包统一版本号，一起发。
- 升级指南在 `docs/upgrade-guide/<版本>/<条目>/guide.md`，每条有「Change」和「Migration」两节。标签的源码里有 15 个版本的目录。
- 不收外部的合并请求。
- 它内部带了一份改过的 Cordis（`vendor/`，对外叫 `@deepseek-ai/cordis`）。
