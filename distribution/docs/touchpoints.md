# 接触面

我们的代码直接碰到的 DSH 接口、配置行、环境变量和文件。DSH 改了这些地方，我们的东西就可能悄悄失效，所以升级 DSH 时照这份清单逐项核对。

以后直接引用 DSH 内部接口的代码要收进一个包（提议名 `dsh-compat`），其余的包只引用它，这份清单就是收的依据。现在还分散在三处：发行目录、`packages/` 下的插件包、桌面壳。

「性质」一栏：**公开**＝DSH 的文档或 README 里写了；**摸出来的**＝文档里没有，从源码、类型声明或 `--dump-config` 看来的；**内部**＝依赖 DSH 的实现细节，上游改了会悄悄失效，不报错。

## 1 发行目录

### 配置行和键

改了的，都在 `distribution/patches/`：

| 行 | 键 |
|---|---|
| `llm-pi-ai` | `providers.jiangxin.{displayName, api: openai-completions, baseURL, apiKeyEnv, compat.supportsDeveloperRole, compat.maxTokensField, models[].{id, name, contextWindow, maxTokens, reasoningEfforts}}` |
| `agent-default-model` | `provider`、`model` |
| `workspace-controller` | `documentsDirectory` |
| `session-log-deepseek` | `enabled`、`maxBytes` |
| `session-telemetry-otel` | `mode`、`shutdownTimeoutMillis`、`maxRequestBytes`、`exporter.url` |
| `plugin-manager` | `registry`、`fallbackRegistries` |
| `ui-plugin-manager` | `registryProbeEnabled`、`registryProbeTimeoutMs`、`registryProbeCacheTtlMs` |
| `web` | 整个 `config` 清空 |
| `system-prompt`（品牌包） | `includeHarnessIdentity`、`personaPrefix`（照抄 DSH 的 `web` 组合里的原文） |
| 只关掉（`disabled: true`） | `llm-deepseek`、`llm-deepseek-account`、`plugin-package-inventory-deepseek`、`desktop-product-telemetry`、`product-analytics`、`deepseek-account`、`ui-settings-account`、`ui-account-notifications`、`web-search-deepseek`、`web-deepseek-api`、`web-fetch-http`、`harness-dev-context`、`ui-settings-session-log`、`ui-brand-official`（品牌包） |
| 插入（`insert`） | `jx-brand-theme`、`jx-enterprise-workbench` |

读过、没改的：`plugin-manager.detailNpmFileSources`（不能为空列表）；各预设行里嵌套的 `tool-web`（`web_search`、`web_fetch` 还在工具列表里的原因）；`locale.preference`（品牌包推断语言是否被锁住时用）。

### 环境变量

| 变量 | 谁设 | 作用 |
|---|---|---|
| `DSH_HOME`、`DSH_AGENTS_HOME` | 启动器 | 状态目录 |
| `DSH_TELEMETRY_MODE` | 启动器 | 会话遥测模式（补丁里也钉了） |
| `DSH_USER_AGENT_SUFFIX` | 没用 | 会被 `dsh` 启动器改写，借不上 |
| `DSH_WEB_URL` | DSH 设给会话 | 智能体看到的界面地址（`--public-url`） |
| `NODE_OPTIONS` | 启动器追加 | `--report-exclude-network` |
| `npm_config_registry`、`npm_config_update_notifier`、`NO_UPDATE_NOTIFIER` | 启动器 | npm、pnpm 的源和更新提示 |

### 命令行

`dsh --profile web`、`--patch <文件>`（可重复）、`--dump-config`、`--version`、`--host`、`--port`、`--no-open`、`--public-url`、`--trusted-host`（可重复）；`dsh plugin --profile <名字> add <目录>`（只在开发和设置锁定验证里用）。

### HTTP

| 接口 | 谁用 | 用途 |
|---|---|---|
| `GET /?token=…` | 设置锁定验证、桌面壳 | 用启动时打印的令牌换会话 cookie，回 `303` 到 `./` |
| `POST /api/settings/mutate` | 设置锁定验证 | 设置写入。请求体 `{"type":"client-request","rpcId":"…","method":"settings/mutate","payload":{"args":{"ns":"<行 id>","ops":[{"op":"set","path":["…"],"value":…}]}}}`；被拒时 `result.ok=false`、`error.code=settings/rejected` |
| `/api/remote.mux` | 反向代理配置 | 界面用的 WebSocket，代理要转发升级 |

### 文件

- `$DSH_HOME/cordis.patch.yml`（家目录层）。
- `$DSH_HOME/profiles/web/{cordis.yml, cordis.patch.yml, package.json, pnpm-workspace.yaml}`（profile 层，界面写这里）。
- `$DSH_HOME/storages/workspace.json`（登记的默认工作区，排查隔离问题时看）。
- `<documentsDirectory>/deepseek-harness/default-workspace`（DSH 建；中间那一段写死）。

## 2 插件包

`packages/brand-theme/` 与 `packages/enterprise-workbench/`。

### 宿主一半

| 包 | 接口、配置或文件 | 用在哪 | 性质 |
|---|---|---|---|
| `@deepseek-ai/dsh-host-webserver` | `ctx.webServer.register({ kind: 'exact', path, resource })` | 用同名路由顶掉站点图标与清单文件 | 公开；「精确路由先于静态文件匹配」是摸出来的 |
| 同上 | `ctx.webServer.tapIndex(fn)` | 改写首页 HTML | 公开 |
| 同上 | 事件 `webserver/index-inject`（`global`、`script`、`style` 三种项） | 版本信息、守标题的脚本、加载页样式 | 公开 |
| `@deepseek-ai/dsh-client-connection` | `ctx.connection.fetch.register({ path, methods, requestBody, fetch })` | 插件样板的台账接口 | 公开（参数从类型声明摸来） |
| 同上 | `ctx.connection.rpc.handle` | 试过，rc.5 里不可用 | 公开 |
| `@deepseek-ai/dsh-system-prompt` | `ctx.systemPrompt.section({ name, order, text, interpolate })` | 模型的自我介绍 | 公开 |
| `@deepseek-ai/schemastery` | `z.object(…)`、`.volatile()` | 两个包的配置结构 | 公开 |
| `package.json` 字段 | `engines.dsh`、`dsh.bundle.patch`、`dsh.client.platform`、`dsh.client.inject`、`exports["./client"]`、`exports["./assets/*"]` | 三个包 | 公开 |
| 同上 | `locale/zh.json`、`locale/en.json` 的 `meta.title`、`meta.description` | 插件页里显示的名称和说明 | 摸出来的 |

### 浏览器一半

| 包 | 接口 | 用在哪 | 性质 |
|---|---|---|---|
| `@deepseek-ai/dsh-client-ui-slots` | `ctx.slots.inject`、`ctx.slots.register({ name, id, order, priority, locale, inject })` | 所有插槽注册 | 公开 |
| 插槽名 | `sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark` | 侧栏、首页的标志和名称 | 公开 |
| 同上 | `settings.general.item`，id `language`（order 0）、`current-version`（order 100） | 设置里的语言行和版本行 | 插槽公开，id 摸出来的 |
| 同上 | `sidebar.panellist` 加 `main`（类型 `MainPanelId` 来自 `dsh-client-ui-layout`） | 插件样板的侧栏入口与整页面板 | 公开 |
| `@deepseek-ai/dsh-client-ui-theme` | `ctx.theme.overrideTokens(source, tokens)`；18 个变量名（`--dsw-alias-*`、`--dsw-specific-*`） | 主题色 | 方法公开，变量名摸出来的 |
| `@deepseek-ai/dsh-client-locale` | `addLanguage`、`register`、`setLocale`、`getSnapshot`、`subscribe`；被覆盖的 11 个命名空间、48 个键 | 文案、语言 | 接口公开，键名摸出来的 |
| 同上 | 私有字段 `dicts` | 文案审计（只在开发时用） | 内部 |
| `@deepseek-ai/dsh-client-ui-settings` | `ctx.configForms.get(ns)` 的 `getSnapshot`、`subscribe`、`set`；命名空间 `locale`、字段 `preference` | 默认语言、语言是否被锁住 | 接口公开，名字来自源码 |
| `@deepseek-ai/dsh-client-ui-primitives` | `Button`、`Pill`、`Tag`、`Menu`、`Modal`、`StateDot`、若干图标 | 界面 | 公开（共享模块） |
| 客户端模块格式 | `window.__ModuleLoader__.load({ id, factory })`、`require.asset(…)`、共享模块表 | 插件构建脚本 `packages/ui-kit/tools/build-plugin.mjs` | 公开（构建预设本身没发布） |
| 全局 | `__DSH_BOOT__.release.version` | 关于行里的 DSH 版本 | 公开 |
| 页面约定 | 接口地址相对 `document.baseURI` 拼 | 插件样板 | 摸出来的 |
| 内部结构 | 选择器 `[data-dsh-boot] > div > div:first-child`、`[data-chat-running] > span:last-child > span[aria-hidden]`；`document.title` 的写入；主题的 `corner-shape` 约定 | 加载页字样、对话进行中的图形、标签页标题、正圆 | 内部 |

## 3 桌面壳

`apps/desktop/`。只用公开的命令行、环境变量和启动协议，上游桌面壳的私有约定一个都没用。

### 进程和命令行

| 接触点 | 怎么用 | 从哪个版本起有 |
|---|---|---|
| 入口文件 | 发行目录 `node_modules/@deepseek-ai/dsh/package.json` 里 `bin.dsh` 指的文件（现在是 `lib/bin.js`） | 没有统计 |
| 运行方式 | Electron 的可执行文件，环境变量 `ELECTRON_RUN_AS_NODE=1`，Node 参数 `--expose-internals` | 上游桌面壳自己的做法 |
| `--profile web` | 用 `web` 这个 profile；`desktop` 被命令行拒绝 | 至少从 0.1.7-rc.2 |
| `--patch <文件>` | 叠发行目录的补丁和壳自己生成的补丁 | 至少从 0.1.7-rc.2 |
| `--host 127.0.0.1`、`--port 3182`、`--no-open` | 只听本机，固定端口，不自动开浏览器 | 至少从 0.1.7-rc.2 |
| 标准输出的就绪行 | `dsh web: http://127.0.0.1:<端口>/?token=<令牌>`，壳用 `^dsh web: (https?://\S+)\s*$` 匹配。上游把这一行定义成给上层程序看的就绪信号 | 至少从 0.1.7-rc.2 |
| 停止 | `SIGTERM`，10 秒没退再 `SIGKILL` | 没有统计 |
| 版本和许可 | 读 `node_modules/@deepseek-ai/dsh/package.json` 的 `version` 和同目录的 `LICENSE` | 包的固定内容 |
| 加载失败的告警 | 标准错误里的 `disabling profile plugin row "jx-…"`、`skipping profile bundle "@jx/…"`、`jx-… (…): failed to import`，壳当成启动失败 | 实测 |

### HTTP

| 接触点 | 怎么用 | 从哪个版本起有 |
|---|---|---|
| `GET /?token=<令牌>` | 回 `303` 和 `Set-Cookie`；cookie 名以 `dsh-auth-` 开头，带 `HttpOnly; SameSite=Strict` | 至少从 0.1.7-rc.2 |
| 带 cookie 的请求 | 之后的 HTTP 和 WebSocket 请求都由壳附上这个 cookie；不带的回 `401` | 至少从 0.1.7-rc.2 |
| `GET /` | 界面的首页 | 至少从 0.1.7-rc.2 |

### 环境变量（壳设给 DSH 的）

| 变量 | 值 | 从哪个版本起有 |
|---|---|---|
| `DSH_HOME` | `<状态目录>/dsh-home` | 至少从 0.1.7-rc.2 |
| `DSH_AGENTS_HOME` | `<状态目录>/agents-home` | 0.2.1-alpha.2 |
| `DSH_TELEMETRY_DISABLED` | `1` | 至少从 0.1.7-rc.2 |
| `DSH_TELEMETRY_MODE` | `DISABLED` | 没有统计 |
| `npm_config_registry` | 默认指向连不上的本机地址 | npm 的变量 |
| `npm_config_update_notifier`、`NO_UPDATE_NOTIFIER`、`NO_COLOR` | 关提示、关颜色 | 通用变量 |

另外从壳自己的环境里只传一份白名单：`HOME`、`USER`、`LOGNAME`、`SHELL`、`LANG`、`LC_ALL`、`LC_CTYPE`、`TMPDIR`、`TZ`、`__CF_USER_TEXT_ENCODING`、`PATH`（补上常见的系统路径），和发行目录约定的 `JX_` 变量。

### 配置键与文件

- `workspace-controller` 这一行的 `config.documentsDirectory`：壳生成 `zz-desktop-shell.yml`，作为最后一个 `--patch` 传进去，指到状态目录下。
- `$DSH_HOME`、`$DSH_AGENTS_HOME` 里的内容全由 DSH 自己管，壳只建目录，不读也不写里面的文件。

### 只在测试里依赖的

自检的界面操作脚本（`apps/desktop/tests/steps/chat-roundtrip.js`）按界面文案和无障碍标签找元素：对话框里的「继续」、「选择模型」、「发送消息」、`[role="textbox"][contenteditable="true"]`。上游改了这些，脚本要跟着改，不影响应用本身。外联检查和反向代理验证的浏览器脚本也一样（输入框的无障碍名称、「继续」按钮、插件页的入口）。

### 有意没碰的

上游桌面壳的私有约定：`dshDesktop` 预加载桥、`<html data-platform>` 标记、`__DSH_*` 页面全局、`desktop` profile、私有宿主包、壳和宿主之间的进程间协议、`dsh-app://` 自定义协议。

## 4 升级时怎么核对

1. 命令行、就绪行、换 cookie、不带凭据得 401：`apps/desktop/` 下 `npm run smoke` 直接查。
2. 配置行和键：对比升级前后的 `--dump-config`，见 [../README.md](../README.md) 的「升级 DSH」。
3. 插件包用到的接口和插槽：类型检查能抓到一部分；插槽 id、文案键、内部选择器只能起实例看，方法见 `packages/brand-theme/README.md` 的「升级 DSH 时」。
4. 默认工作区的位置、两个状态目录变量有没有生效：现在是跑完以后看目录确认的，还没有自动检查。
