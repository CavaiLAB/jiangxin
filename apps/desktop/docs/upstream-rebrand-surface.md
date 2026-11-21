# 上游桌面壳换品牌改动面盘点（DSH 0.2.2-rc.5）

> 附件。评估「从源码构建上游桌面壳」这条路线（路线乙）时，对上游源码做的只读盘点，逐条带文件和行号。
> 摘要见 [../README.md](../README.md) 的「两条路线」一节。三种改法类别的叫法和那里一致：
> **配置** = 配置能改，**构建** = 构建参数能改，**源码** = 只能改源码。

- 盘点对象：DSH 的源码，git tag `dsh-v0.2.2-rc.5`，commit `9c2670d3bce5275e0d1610272958121af87787bb`（浅克隆）。下文的「副本」指这份源码检出。
- 盘点日期：2026-11-20。只读：没有安装依赖、构建、运行或联网，副本里什么都没改。
- 评估路线：从钉死的源码构建上游桌面壳，用补丁（一处改动一个补丁）换成「匠心工业智能体平台」（短名「匠心」，标识符 `jiangxin`），关掉 DeepSeek 账号登录和一切外联。

## 约定

- 路径前缀：`D:` 指 `apps/desktop/`，`H:` 指 `apps/desktop-host/`，不带前缀的路径相对副本根。`文件:行` 里的行号都在副本里用 `grep -n` 或 `nl` 核实过。
- 改法类别：
  - **配置**：运行时靠配置文件或环境变量就能改；
  - **构建**：构建时靠参数、环境变量或构建配置就能改；
  - **源码**：只能改源码（包括替换仓库里的资源文件）；
  - **—**：不用改（已经满足，或者只是事实说明）。
- 「未核实」：结论依赖 Electron、electron-builder、@electron/get 的内部默认行为。副本里没有 `node_modules`，这些行为没法在副本里逐行核实，表里会单独标出来。
- 改动量按补丁口径估：要动的文件数、处数和行数，不含测试与快照。
- 没特别说明时，都按 `package:mac:arm64:unsigned`（本机未签名 DMG）评估。只影响 Windows 或签名发布链路的条目会单独注明。
- **运行时环境变量开关的共同限制**：Electron 主进程启动 Host 时，用的环境是「主进程自己的环境 + 登录 shell 读到的变量」，但登录 shell 里 `DSH_*`、`ELECTRON_*` 开头的变量会被丢掉（`D:src/login-shell-environment.ts:16-17`、`:96-103`；传给 Host 见 `D:src/main.ts:536-537`）。所以从 Finder 或 Dock 启动时，写在 `~/.zshrc` 里的 `DSH_HOME`、`DSH_TELEMETRY_DISABLED`、`DSH_PRODUCT_ANALYTICS_OTLP_URL` 都不生效，只有进程本身带着的变量才生效（比如用 `launchctl setenv`，或者从终端启动）。下文凡是标「配置（环境变量）」的，都受这条限制。

---

## 1. 应用名

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:scripts/electron-builder-config.mjs:119` | `productName: 'DeepSeek Harness'`。它决定 `.app` 名、Dock 和菜单栏上的应用名（CFBundleName）、可执行文件 `Contents/MacOS/DeepSeek Harness`、Windows 卸载显示名（`:262` 的 `${productName}`），以及版权模板（`:121`）。DMG 卷名默认也取它（electron-builder 默认 `${productName} ${version}`，未核实）。 | 源码 | 1 文件 1 行。必须连带改本节最后一行的两处，否则打包失败。 |
| `D:package.json:2` | `"name": "@deepseek-ai/dsh-desktop"`。打包后的 package.json 里没有 productName，所以 Electron 的 `app.name` 就是这个 name。用户数据目录和日志目录都按它命名，实际是 `~/Library/Application Support/@deepseek-ai/dsh-desktop`（`D:README.md:297`；`D:src/main.ts:95` 调 `setAppLogsPath`；`D:src/main.ts:1170` 注释写明 userData 由 `app.name` 派生）。单实例锁也在 userData 里（`D:src/single-instance.ts:20`；锁文件位置属 Electron 行为，未核实）。不改的话，会和已装的 DeepSeek Harness 共用设置、快捷键和单实例锁。根 package.json 里很多脚本用 `--filter @deepseek-ai/dsh-desktop` 指向它（`package.json:27`、`:33-44`）。 | 源码 | 别改 name 本身（会牵连上面那些 filter）。改在 `D:scripts/electron-builder-config.mjs:112-118` 的 `extraMetadata` 里加一行 `name` 或 `productName`：1 文件 1 行。 |
| `D:scripts/electron-builder-config.mjs:120-121` | `copyright: 'Copyright © <年份> ${productName}'`，自动跟随 productName。 | — | 想改成公司名再加 1 行。 |
| `D:scripts/electron-builder-config.mjs:123` | `artifactName: 'deepseek-harness-${version}-${os}-${arch}<后缀>.${ext}'`，决定安装包文件名。另有两处写死了这个前缀：`D:scripts/package-target.ts:405` 打印 DMG 路径（不改的话打印的路径是错的）；`D:scripts/desktop-build-version-discovery.ts:34`（只有 `--build-version auto` 编号时才用到）。发布链路另外还有 6 处，见第 8 节。 | 源码 | 本机构建：1 文件 1 行，加打印 1 行；auto 编号再加 1 行。 |
| `D:src/main.ts:1158-1167` | macOS 关于面板（菜单 role `about`）：`applicationName: 'DeepSeek Harness'`（`:1161`）写死；版本取 `app.getVersion()`（`:1162`）；图标取 `Resources/icon.png`（`D:src/main.ts:1158-1159`），它是由 `icon-windows.png` 拷过去的，见第 2 节。 | 源码 | 1 文件 1 行。 |
| `D:src/main.ts:474-478` | Windows 的「关于」对话框，用 locale 里的 `aboutMenu`、`aboutProduct`、`aboutVersion`。 | 源码 | 计入 locale 行。 |
| `D:src/main.ts:1199-1201`、`:1206-1209`、`:1226-1227`、`:1237` | 菜单。macOS 应用菜单的 label 写的是 `app.name`（`:1237`），但系统实际显示 CFBundleName，也就是 productName（macOS 行为，未核实）。菜单项「隐藏、关于、退出」（Windows 上是「退出」）取 locale 的 `hideApplication`、`aboutMenu`、`quitApplication`、`exitApplication`。 | 源码 | 计入 locale 行。 |
| `D:src/tray.ts:34`、`:36`、`:38`；`D:src/main.ts:1243-1250` | 托盘只有 Windows 有：提示文字取 `aboutProduct`，右键菜单取 `openApplication`、`quitApplication`。macOS 没有托盘（`D:scripts/electron-builder-config.mjs:163-164` 的注释）。 | 源码 | 计入 locale 行。 |
| `D:src/quit-confirmation.ts:84-85`；`D:src/background-notice.ts:44` | 退出确认框的标题取 `aboutProduct`，正文取 `quitTitle`。Windows 首次隐藏窗口时的提示标题也取 `aboutProduct`。 | 源码 | 计入 locale 行。 |
| `D:src/welcome-window.ts:26`；`D:src/client/WelcomePage.tsx:55` | 欢迎窗口标题取 `welcomeTitle`。 | 源码 | 计入 locale 行。 |
| `D:src/main.ts:264-297`；`apps/web/vite.config.ts:15`、`:24`、`:28`；`scripts/client-build-environment.ts:20-23`、`:204-211` | 主窗口创建时不设 title，显示的是 Web 前端页面的 `<title>`。这个标题在构建时取 `DSH_CLIENT_TITLE`，没有就用 `'DSH Local Build'`。未签名构建走 `build --profile local`（`D:scripts/package-target.ts:481`），而 local profile 会丢掉继承来的 `DSH_CLIENT_TITLE`（`client-build-environment.ts:204-211`）。所以未签名包的主窗口标题固定是 `DSH Local Build`，靠环境变量改不了。official profile 则写死成 `'DeepSeek Harness'`（`:22`）。 | 源码 | 1 文件 1～2 行：让 local profile 接受标题，或改 `vite.config.ts:15` 的默认值。这些文件不在 apps/desktop 下。 |
| `D:src/fatal-recovery.ts:86`；`D:src/main.ts:718` | 启动失败对话框的标题取 `startupFailed`；更新确认框的标题取 `updateTitle`。 | 源码 | 计入 locale 行。 |
| `D:src/locale.ts`（1606 行） | **结构**：8 种语言，分别是 en `:3-193`、zh `:198-388`、ja `:391-581`、es `:584-774`、fr `:777-967`、de `:970-1160`、ru `:1163-1353`、pt `:1356-1546`，在 `:1548` 汇总。每种 189 条，共 1512 条。类型 `DesktopMessages` 由 en 的键派生（`:196`），其他语言用 `satisfies` 对齐。**产品名没有抽成常量**，每条文案各写一遍：「DeepSeek Harness」每种语言出现在 11 个键里，共 **88 处、88 行**。en 是 `:34,35,37,42,43,46,61,76,77,79,155`，zh 是 `:229,230,232,237,238,241,256,271,272,274,350`。这 11 个键是 aboutMenu、aboutProduct、hideApplication、quitApplication、openApplication、quitTitle、startupFailed、welcomeTitle、welcomeBrand、welcomeTaglineBrand、updateTitle。**面向用户的「dsh」**：每种语言 9 行（8 个 cliCommand* 键，en 是 `:4,5,7,9,10,21,23,28`；再加 startupAddressInUse，en `:63`），共 72 行。其中小写 `dsh` 每种语言 9 处、共 72 处；大写 `DSH` 每种语言 2 处、共 16 处，都在 startupAddressInUse 那一行（en `:63`，zh `:258`）。另外 welcomeKeyDescription 在 8 种语言里都写了「DeepSeek」，在 7 种语言里写了单独的「Harness」（en `:97`、zh `:292`、ja `:485`、es `:678`、fr `:871`、de `:1064`、ru `:1257`、pt `:1450`）。 | 源码 | 1 文件。只换产品名：88 行，加 welcomeKeyDescription 8 行、startupAddressInUse 8 行，共 104 行。如果连命令名 `dsh` 也改，再加 64 行，共 168 行。8 个语言块分开写，适合一个语言一个补丁。 |
| `D:installer/locales/*.json`（8 个，每个 41 行）；`D:installer/restart-status.h:125`、`D:installer/restart-banner.h:116`、`D:installer/extract-report.h:117` | 只用于 Windows 安装器。每个 JSON 在第 15 行（INSTALLER_LAUNCH_FAILED）、第 19 行（INSTALLER_RUNNING）、第 24 行（INSTALLER_PATH_OWNERSHIP）各写一次「DeepSeek Harness」，共 24 处，由 `D:scripts/installer-locales.mjs` 渲染进 NSIS（`D:scripts/electron-builder-config.mjs:135`）。三个 C++ 头文件里各有一处写死的窗口标题或报告标题。 | 源码 | Windows 才需要：11 文件 27 行。mac 不用改。 |
| `D:cli/dsh:14`；`D:scripts/smoke-packaged-runtime.ts:16`、`:18`（另有 `D:cli/dsh.cmd:4`；签名链路的 `D:scripts/package-target.ts:548`、`:554`、`D:scripts/package-macos.ts:81`、`D:scripts/verify-retained-desktop.ts:42`） | 这些地方写死了 `.app` 名或可执行文件名：`"$resources/../MacOS/DeepSeek Harness"`、`'DeepSeek Harness.app'`、`'DeepSeek Harness.exe'`。未签名打包在 electron-builder 之后会跑 `smoke-packaged-runtime.ts`（`D:scripts/package-target.ts:561-562`）。只改 productName 而不改这里，打包会在冒烟这一步失败；不改 `cli/dsh`，装出来的命令行跑不起来。前提是 `.app` 名和可执行文件名随 productName 走：这是 electron-builder 的默认行为，配置里没有设 `executableName`，仓库脚本也按这个假设写（`D:scripts/prepare-installed-update-network.ts:33`）。mac 上未运行核实。 | 源码 | mac 本机：2 文件 3 行。Windows 再加 1 行，签名链路再加 3 文件 4 行。 |

## 2. 图标

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:resources/icon-macos.png`（1024×1024）及其源文件 `icon-macos.svg` | 应用图标，被 `D:scripts/electron-builder-config.mjs:167`（`mac.icon`）引用；icns 由 electron-builder 生成（未核实）。**没有生成脚本**：README 要求把各平台 SVG 手工导出成 1024 透明 PNG（`D:README.md:90`）。 | 源码 | 替换 1 张图（SVG 源文件可选再换 1 个），0 行代码。 |
| `D:resources/icon-windows.png`（1024×1024）及其源文件 `icon-windows.svg` | 被 `D:scripts/electron-builder-config.mjs:248`（`win.icon`）引用，同时由 `D:scripts/electron-builder-config.mjs:162` 拷成所有平台的 `Resources/icon.png`。这个 `icon.png` 就是 macOS 关于面板显示的图标（`D:src/main.ts:1158-1159`），所以 mac 也得换。 | 源码 | 替换 1 张图（源文件可选），0 行代码。 |
| `D:resources/tray-windows.ico` | 只用于 Windows 托盘（`D:scripts/electron-builder-config.mjs:164`；`D:src/main.ts:1243`），也是 Windows 退出确认框的图标（`D:src/main.ts:1265`）。**有生成脚本**：`pnpm run render:tray-icon`（`D:package.json:21`），即 `D:scripts/render-tray-icon.ts:20-23`，从 `icon-windows.svg` 渲染，需要 devDependency sharp。 | 源码 | Windows 才需要，用脚本重新生成 1 个文件。 |
| `D:resources/icon.png`（1104×1104）、`icon.svg` | 设计原稿（`D:README.md:90`），桌面打包不引用。`icon.svg` 是 Web 安装图标的源文件（`apps/web/scripts/render-app-icons.ts:10`、`:29`）。 | 源码 | 可选，换 2 个文件；想让 Web 图标一致时再换。 |
| `D:installer/assets/{brand,brand-2x,brand-dark,brand-dark-2x,uninstaller-sidebar}.png` | 只用于 Windows 安装器。`D:scripts/prepare-windows-installer.ps1:71-80` 把它们转成 BMP，使用处在 `D:scripts/installer.nsh:66-68`、`D:installer/lifecycle.nsh:60-63`、`D:installer/pages.nsh:80`、`D:scripts/electron-builder-config.mjs:263-264`。没有生成脚本。 | 源码 | Windows 才需要，替换 5 张图。 |
| `D:renderer/assets/welcome-brand.svg`（472×40） | 欢迎页顶部的品牌字标，是矢量路径，用 CSS 变量适配深浅色。引用处是 `D:src/client/WelcomePage.tsx:178`。没有生成脚本。 | 源码 | 保留欢迎窗口就得换 1 个文件；改成不显示欢迎窗口（见第 3 节）就不用换。 |
| `D:renderer/update-close.svg`、`D:renderer/assets/window-material.css` | 通用的关闭图标和窗口材质，不带品牌。 | — | 0 |

## 3. 欢迎窗口与 DeepSeek 账号登录、填密钥引导

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:src/welcome-api.ts`（75 行） | 定义 IPC 通道（`:8-18`）和 **`needsWelcome`**（`:73-75`）：`return !authentication.loggedIn && !authentication.hasApiKey`，也就是「没登录 DeepSeek 账号，**并且**任何可配置 provider 都没配密钥」时才显示欢迎窗口。 | — | 0（判定依据） |
| `D:src/main.ts:1455-1471`、`:1394-1454`、`:573-594` | 在 `openInitialWindow` 里，Host 就绪后读状态，用 `needsWelcome` 决定弹欢迎窗口还是直接进工作区（`:1464-1470`）。`showWelcome` 打开窗口并接上各项操作（`:1403-1434`）。账号退出或会话过期时会再次弹出（`:573-594`）。**没有任何配置开关能整体跳过。** | — | 0 |
| 间接跳过（`D:src/welcome-backend.ts:98-131`） | `hasApiKey` 取「`llm-deepseek` 的引用 + `llm/listConfigurableProviders` 列出的所有 provider 引用」中任意一个已配置（`:103-126`）。只要给自有 provider 配上密钥，就不会弹欢迎窗口。密钥可以来自 `$DSH_HOME/.credentials.yaml`、启动环境（登录 shell 里非 `DSH_` 开头的变量会被合并）、项目 `.env` 或 home `.env`（`packages/credentials/credentials-local/README.md:12`）。 | 配置 | 0 行代码，只需预置配置。 |
| 关登录：方案 A，`D:src/welcome-api.ts:74` | 让 `needsWelcome` 恒为 false，永远不显示欢迎窗口（包括退出和过期时）。 | 源码 | 1 文件 1 行。 |
| 关登录：方案 B，`D:src/client/WelcomePage.tsx:205`、`:212`、`:211-214` 等；`D:src/welcome-backend.ts:75`、`:149-151` | 保留欢迎窗口但只留「填密钥」：去掉登录按钮和入口页，并把保存目标从 `llm-deepseek` 改成自有 provider。 | 源码 | 2～3 文件，约 10～20 行（locale 另算）。 |
| 关登录：方案 C，`packages/bundle/base/cordis.patch.yml:120-123` | 在 bundle 里停掉 `deepseek-account` 插件。但桌面壳读欢迎状态时会直接 `await account.state()`，没有兜底（`D:src/welcome-backend.ts:125`；RPC 命名空间 `account` 在 `D:src/account-backend.ts:88`，流在 `:105-107`）。按代码推断这会让 `openInitialWindow` 抛错、启动失败（未运行核实）。Host 一侧能容忍插件缺席（`H:src/platform-session.ts:11` 用的是 `ctx.inject`）。 | 源码 | 单独用不可行，必须配合方案 A 或 B 一起改壳。 |
| `D:src/welcome-window.ts`（132 行） | 窗口 600×700，标题 `welcomeTitle`（`:16-48`）；IPC 处理（`:81-115`）；第 120 行加载 `renderer/welcome.html`；第 129 行上报 `auth_page_view`。 | — | 方案 A 下不用改。 |
| `D:src/welcome-backend.ts`（159 行） | 通过 Host 的 RPC 读 settings、credentials、llm、productAnalytics，带 cookie 访问 `/api/<ns>/<method>`（`:52-70`）。 | — | 方案 A 下不用改。 |
| `D:src/account-backend.ts`（138 行） | 账号状态校验，要求 `usageUrl`、`topUpUrl`、`authorizeUrl` 只能是 https 或 loopback http（`:16-33`、`:48-54`），通过 WebSocket 订阅账号流。 | — | 0 |
| `D:src/client/WelcomePage.tsx`（225 行）、`welcome.tsx`（19 行）、`styles.d.ts`（2 行）；`D:renderer/welcome.html`（17 行）、`welcome.css`（343 行）、`assets/*` | 欢迎页 UI 由 `D:tsdown.config.ts:59-89` 用 vite 打进 `lib/welcome`。页面里有品牌图（`D:src/client/WelcomePage.tsx:178`）、标语（`:180`）、登录按钮（`:205`、`:212`）、密钥表单（`:183-192`）和「稍后设置」（`:217`）。 | — | 方案 A 下不用改；方案 B 见上一行。 |
| `D:src/preload-welcome.ts`（29 行） | 向页面暴露 `window.dshWelcome`（`:29`）；上报分析事件前会先查开关（`:13-16`）。 | — | 0 |
| `D:src/main.ts:564-567`、`:258-262`、`:1411-1414` | 发起登录后，会自动用系统浏览器打开 DeepSeek 授权地址（URL 上附加 `theme` 参数）。发起时会把客户端元数据（`desktopClientMetadata`）一并送给平台。 | — | 方案 A 或 B 下走不到这里。 |
| `D:src/platform-view.ts`（273 行）、`platform-ipc.ts`（12 行）、`preload-platform-account.ts`（45 行）；`D:src/main.ts:531-533`、`:866-879` | 登录后在窗口里内嵌 DeepSeek 平台的用量页和充值页：`new URL('/usage' 或 '/top_up', account.origin)`（`D:src/platform-view.ts:174-176`），会话分区名 `persist:dsh-platform-<hash>`（`D:src/platform-view.ts:106`）。只在有平台会话时才可用。 | — | 0（不登录就不触发） |
| `D:src/preload-platform.ts`（33 行） | 和账号无关：只给 `preload-app` 的文档打平台和全屏标记（`D:src/preload-app.ts:9`）。 | — | 0 |
| `D:renderer/policy-login-loading.html`（48 行） | 和 DeepSeek 账号无关：这是强制更新策略「飞书测试登录」窗口的占位页（`D:src/policy-test-auth.ts:7`、`:10`），只在策略认证方式为 `feishu-test` 时用到（`D:src/main.ts:1556-1560`）。mac 未签名包没有策略，用不到。 | — | 0 |
| 填的密钥存到哪里 | 欢迎页把密钥写进 settings 命名空间 **`llm-deepseek`** 的 `apiKeyEnv` 引用（`D:src/welcome-backend.ts:75-80`），调用 `credentials/set`（`:151`）。`llm-deepseek` 在 bundle 里对应插件 `@deepseek-ai/dsh-llm-deepseek-api-key`（`packages/bundle/base/cordis.patch.yml:549-550`），provider 路由是 `deepseek-official`（`packages/llm/llm-deepseek-api-key/src/index.ts:20`）。引用名默认是 **`DEEPSEEK_API_KEY`**（`packages/llm/llm-deepseek-api-key/src/config.ts:25`）。实际存储位置是 `$DSH_HOME/.credentials.yaml` 的 `refs` 段（`packages/credentials/credentials-local/src/index.ts:61`、`:90`）。 | — | 0。想改成存到自有 provider，见方案 B。 |
| DeepSeek 平台地址：`packages/credentials/deepseek-account/src/index.ts:73-87` | `platformOrigin` 默认 `https://platform.deepseek.com`（`:74`），用于登录、资料、余额、退出和内嵌页。`harnessOrigin` 默认 `https://harness.deepseek.com`（`:75`），只用于账号通知，并且只在已登录时请求（`:263`、`:290`、`:318`）。`inferenceOrigin` 默认 `https://api.deepseek.com`（`:78`）。用量页和充值页是 `platformOrigin` 下的 `/usage`、`/top_up`（`:216`）。授权路径固定为 `/dsh/authorize`、`/dsh/authorized`（`:727`、`:749`），OAuth 回调挂在 Host 的 `/oauth/callback`（`:721`）。bundle 只给这个插件配了 `desktopPlatform`（`packages/bundle/base/cordis.patch.yml:120-123`）。 | 配置 | 0 行代码，通过 profile patch 改插件配置；README 给了私有 patch 的示例（`packages/credentials/deepseek-account/README.md:57-66`）。桌面 profile 下的 patch 具体写法未核实。 |

## 4. 更新通道与强制更新策略

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:scripts/electron-builder-config.mjs:102`、`:274` | `update = unsigned ? undefined : resolveDesktopAutoUpdateConfig(...)`；`publish` 在 update 为空时是 `null`，否则是 `[{ provider: 'generic', url: update.publicUrl, channel }]`。 | 构建 | 0（由构建参数 `--unsigned` 决定） |
| `D:scripts/desktop-auto-update-environment.mjs:163-192` | 更新源地址是 `${origin}/dsh-desk[/<releaseId>]/feeds/<target>/`（`:174-182`、`:190`）。production 的 origin **写死为 `https://download.deepseek.com`**（`:29`）。test 的 origin 取 `DOWNLOAD_TEST_ORIGIN`（`:21`、`:169-173`），并且必须给 32 位十六进制的 `DOWNLOAD_TEST_RELEASE_ID`（`:176-180`）。部署环境取 `DSH_DESKTOP_AUTO_UPDATE_ENV`，默认 `test`（`:63-69`）。 | 构建 | 0（只有签名构建用得到）。想用自有的 production 源，要改 `:29`：源码 1 行。 |
| `D:scripts/desktop-auto-update-environment.mjs:13-17`；`D:scripts/electron-builder-config.mjs:114`；`D:src/update-channel.ts:12-18` | 通道取 `DSH_DESKTOP_UPDATE_CHANNEL`，**默认 `nightly`**。打包时以 `dshDesktopUpdateChannel` 写进 package.json，**未签名包也会写**（`?? 'nightly'`）。运行时读它，用户在设置里的选择优先（`D:src/main.ts:697-704`；保存在 userData 的 `desktop/settings.json`，见 `D:README.md:297`）。 | 构建 | 0 |
| `D:scripts/electron-builder-config.mjs:207-210`、`:229-232`；`D:scripts/macos-app-update-config.mjs:29-38`、`:62-65`、`:74-91` | `app-update.yml` 只在 darwin 且 update 不为空时，于 afterPack 写进 `Resources`，并在 afterSign 时校验。 | — | 0（未签名包里没有） |
| `D:.env.macos.example:1`、`:4-9`、`:25-31`；`D:config/macos-packaging/production.env.example:2-4`；`D:config/macos-packaging/test.env.example:2-8` | 发布配置模板，含 appId、更新环境、test origin、release id 和强制更新策略的 origin。第 1 行明说「local --unsigned builds ignore this file」。 | 构建 | 0（只用于签名构建） |
| `D:scripts/desktop-policy-environment.mjs:18-44` | 强制更新策略：必须给 `DSH_DESKTOP_MANDATORY_UPDATE_{TEST,PROD}_ORIGIN`（HTTPS origin，`:19-21`）。test 环境用 `feishu-test` 认证，并要求非空的 `allowedAuthOrigins`（`:34-36`、`:43`）；production 用 `anonymous`（`:37-39`）。打包时以 `dshMandatoryUpdatePolicy` 写入（`D:scripts/electron-builder-config.mjs:115`）。**`D:scripts/electron-builder-config.mjs:69` 规定只有「macOS 且未签名」才跳过策略**，Windows 未签名包仍然必须配策略（`D:packaging/README.md:162`）。 | 构建 | 0 |
| 核实「本机未签名构建不带更新源和强制更新策略」 | **属实（macOS）**。`localMacOSPackageEnvironment` 会剥掉环境里的 `DSH_DESKTOP_AUTO_UPDATE_ENV`、`DSH_DESKTOP_MANDATORY_UPDATE_*`、`DOWNLOAD_*`（`D:scripts/desktop-package-environment.mjs:21`、`:28-34`）。校验时未签名的 darwin 跳过策略和更新源（`:124`、`:127`）。electron-builder 配置里（`D:scripts/electron-builder-config.mjs`）：policy 为空（`:69`）、update 为空（`:102`）、不写策略字段（`:115`）、只出 dmg 不出 zip（`:183`）、不写 `app-update.yml`（`:207`）、`publish: null`（`:274`）。 | — | 0 |
| 运行时没有更新源：`D:src/update-coordinator.ts:64`、`:272` | 判断条件是 `enabled = app.isPackaged && existsSync(Resources/app-update.yml)`。不满足时，在调用 electron-updater **之前**就抛出 `this application has no packaged update source`，**不会连网**。启动时的自动检查（`D:src/main.ts:1593` 到 `:1147-1150`）和定时检查（`D:src/update-schedule.ts:93-104`，默认 600000 ms，失败后逐次退避，最长 1 小时，见 `:20-21`）都只在本地静默失败；非手动检查失败不会发布状态（`D:src/update-coordinator.ts:163`）。 | — | 0 |
| 「检查更新…」菜单：`D:src/main.ts:1211` | **一直都在**，macOS 应用菜单和 Windows 应用弹出菜单里都有，没有条件判断。点了之后弹出「检查更新失败，请稍后重试。」（`D:src/main.ts:1058` 调 `:617-628`；文案在 `D:src/locale.ts:120` en、`:315` zh）。Web 设置页里的更新通道选择器不在壳里，不在本清单范围。 | 源码 | 想隐藏的话 1 文件 1 行。 |
| 强制更新策略运行时：`D:src/main.ts:1550-1592`；`D:src/mandatory-update-policy.ts:57-58`、`:193` | 打包后的应用读 `manifest.dshMandatoryUpdatePolicy`；没有这个字段时 `resolveDesktopPolicyConfig` 返回 undefined，**不发任何策略请求**。有的话会访问策略 origin 的 `/api/v0/check_client_update`，并带上平台客户端头（`D:src/main.ts:1576`；`D:src/mandatory-update-policy.ts:5`）。 | — | 0（未签名 mac 包没有） |

## 5. 产品分析

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:src/main.ts:496-502`（`track`） | 只有 `analyticsEnabled` 为真时才调 `welcomeBackend.report(event)`，失败一律吞掉。壳里发的事件有：`desktop_app_launch`（`:557`）、`desktop_upgrade_install_restart_click`（`:731`）、`desktop_upgrade_download_result`（`:761`）、`desktop_upgrade_click`（`:778`）、`auth_page_view`（`:1397`）。欢迎页另有 `auth_page_view`、`auth_page_click`、`api_key_save_click`（`D:src/welcome-window.ts:85-94`、`:129`；`D:src/client/WelcomePage.tsx:73`、`:91`、`:205-206`、`:212-213`）。事件表定义在 `packages/client/product-analytics/src/events.ts:7-21` 等处。 | — | 0 |
| `D:src/welcome-backend.ts:135-140`（`report`） | 壳本身不直连外网，而是走 Host 的 RPC：`productAnalytics/enabled`、`productAnalytics/report`，超时 1 秒。开关状态通过流 `productAnalytics/watchPolicy` 实时同步（`D:src/account-backend.ts:105`；`D:src/main.ts:556`、`:595`）。 | — | 0 |
| Host 端：`packages/client/product-analytics/src/index.ts:35-38`、`:67`；`packages/host/product-telemetry-otel/src/index.ts:46-57`、`:84-90` | `product-analytics` 的 `enabled` **默认 `true`**，可以热改（`packages/client/product-analytics/src/index.ts:36`）。事件交给 `productTelemetry`，用 OTLP/HTTP 发到 `endpoint`，**默认是 `https://dsh-otel-collector.deepseeksvc.com/v1/logs`**（`packages/host/product-telemetry-otel/src/index.ts:47`），请求头 `x-channel: dsh_otel_report`（同文件 `:48`、`:87`）。Web 前端（窗口内容）的事件也走这条路（`docs/subsystems/product-telemetry.md:5`；`packages/client/product-analytics/README.md:26`）。 | — | 0 |
| `packages/bundle/web-app/cordis.patch.yml:37-47`、`:49-54` | 桌面挂载两行配置，都只在 profile 名为 `desktop` 时启用（`:39`、`:51`）：`desktop-product-telemetry` 的 `serviceName: deepseek-harness-desktop`（`:45`）、`serviceVersion` 取 `DSH_CLIENT_VERSION`（`:46`）、`endpoint` 取 `process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL`（`:47`，没设就用上面的默认值）；`product-analytics` 写明 `enabled: true`（`:53`）。**桌面默认开启。** | — | 0 |
| 改上报地址：环境变量 `DSH_PRODUCT_ANALYTICS_OTLP_URL` | 用来指向隔离的收集端（`packages/client/product-analytics/README.md:26`）。受「约定」里那条共同限制，写在登录 shell 里不生效。 | 配置 | 0 行，环境变量。 |
| 运行时关闭：settings 命名空间 `product-analytics` 的 `enabled` | 通过 Cordis Config 或 settings 机制配置，**界面上没有开关**（`packages/client/product-analytics/README.md:24`）。可以写进用户 patch 文件 `$DSH_HOME/cordis.patch.yml` 或 `$DSH_HOME/profiles/desktop/cordis.patch.yml`（文件名见 `packages/boot/app-boot/src/profile.ts:42`、`:213`；两个都会被监视，见 `packages/boot/hmr/src/index.ts:385`）。关掉后壳也会停止上报（`D:src/main.ts:556`、`:595`）。 | 配置 | 0 行，配置文件。具体 YAML 写法未核实。 |
| 打进包里关闭：`packages/bundle/web-app/cordis.patch.yml:53` | 把 `enabled: true` 改成 false；也可以给 `:39`、`:51` 两行直接设 disabled，或改默认地址（`packages/host/product-telemetry-otel/src/index.ts:47`）。 | 源码 | 1 文件 1～2 行（不在 apps/desktop 下）。 |
| 第二条上报通道（不经过壳）：`packages/bundle/base/cordis.patch.yml:205-232` | 会话遥测 `session-telemetry-otel`：模式取 `DSH_TELEMETRY_MODE`，默认 `FEEDBACK_ONLY`（`:221`），即用户显式点反馈后才上传会话日志前缀（`packages/session/session-telemetry-otel/README.md:14`）。地址是 `DSH_TELEMETRY_OTLP_URL ?? 'https://dsh-otel-collector.deepseeksvc.com/v1/logs'`（`packages/bundle/base/cordis.patch.yml:225`）。上报时附带 `$DSH_HOME/.anonymous-user-id`（`packages/bundle/base/cordis.patch.yml:210-211`）。设置 `DSH_TELEMETRY_DISABLED` 为任意非空值即可退出（`packages/bundle/base/cordis.patch.yml:207-209`；实现在 `packages/boot/app-boot/src/profile-context.ts:52-55`，Host 启动时在 `apps/cli/src/profile-boot.ts:334` 读取）。 | 配置 | 0 行，环境变量（受共同限制）。 |
| 打进包里关闭第二条通道 | 在 `D:src/main.ts` 里、Host 启动前设置 `process.env.DSH_TELEMETRY_DISABLED = '1'`（Host 的环境取自 `process.env`，见 `:536-537`）；或者把 `packages/bundle/base/cordis.patch.yml:221` 的模式改成 `DISABLED`。 | 源码 | 1 文件 1 行。 |

## 6. `dsh://` 协议

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:scripts/electron-builder-config.mjs:111` | `protocols: [{ name: 'DeepSeek Harness', schemes: ['dsh'] }]`，由 electron-builder 生成 Info.plist 的 CFBundleURLTypes，Windows 上写注册表（electron-builder 行为，未核实）。 | 源码 | 1 文件 1 行。 |
| `D:src/main.ts:1488` | 打包后的应用（或设置了 `DSH_DESKTOP_DEV_APP=1` 时）调用 `app.setAsDefaultProtocolClient('dsh')`。**同一台机器上如果装着 DeepSeek Harness，会抢走它的 dsh:// 处理权。** | 源码 | 1 行。 |
| `D:src/main.ts:1489-1492` | `open-url` 只处理 `dsh://open` 和 `dsh://open/`，作用是把窗口拉到前台。副本里没找到发出 `dsh://open` 的地方（全仓库 grep 只有这一处；`packages/experimental/inspector` 里的 `dsh://host` 是 CDP 的地址标签，没关系）。 | 源码 | 1 行。 |
| Info.plist | 仓库里**没有静态 Info.plist**，只有 entitlements：`D:scripts/macos-entitlements.plist`、`jit-entitlements.plist`、`node-x64-entitlements.plist`。开发包的 plist 写在 `D:scripts/development-app.ts:39-43`（`com.deepseek.harness.dev.*`、`Harness Dev`、`dsh`），只有 `pnpm dev` 用。 | 源码 | 开发用，可选，1 文件 3～4 行。 |
| 内部协议 `dsh-app` | `D:src/ipc.ts:114`；`D:src/main.ts:189-199` 注册为特权协议；另见 `D:renderer/mandatory-update-frame.js:25`、`packages/client/ui-primitives/src/markdown/render.tsx:86`。不向操作系统注册，用户看不到。 | — | 0（建议保留） |

## 7. bundle id / appId

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:scripts/desktop-release-environment.mjs:4`、`:63-69` | 必须通过环境变量 `DSH_DESKTOP_APP_ID` 提供，没有默认值，并会校验是否为反向域名格式（`:65`）。被 electron-builder 的 `appId`（`D:scripts/electron-builder-config.mjs:54`、`:110`）和 `extraMetadata.dshDesktopAppId`（`:113`）使用。示例值是 `com.deepseek.dsh`（`D:.env.macos.example:4`、`D:config/macos-packaging/production.env.example:2`、`test.env.example:2`、`D:.env.windows.example:3`、`D:config/windows-packaging/*.env.example`）。 | 构建 | 0（只用于签名构建，写进 .env 或 preset） |
| `D:scripts/desktop-package-environment.mjs:31`（以及 `:21`、`:30`） | **mac 未签名构建写死 `DSH_DESKTOP_APP_ID: 'com.deepseek.harness'`**，而且会先把环境里的 `DSH_DESKTOP_APP_ID` 剥掉（AMBIENT 正则 `:21`），所以没法用环境变量覆盖（`D:packaging/README.md:179` 也这么写）。上游本身就有两个 id：发布用 `com.deepseek.dsh`，本机用 `com.deepseek.harness`。 | 源码 | 1 文件 1 行。 |
| 跟着 appId 走的东西 | CFBundleIdentifier；macOS 的 TCC 权限记录（麦克风）和 LaunchServices 登记；Windows 的 AppUserModelID 和 NSIS 卸载项 GUID（以上都是 electron-builder 或系统行为，未核实）；签名 mac 包里 runtime 签名的 identifier（`D:scripts/prepare-dsh.ts:168-169`）。`dshDesktopAppId` 只有安装后升级验证会读（`D:scripts/installed-update-package-content.ts:42`、`D:scripts/installed-update-identity.mjs:15`）。 | — | 0（随上一行一起变） |
| **不跟** appId 走：userData、日志、单实例锁 | 跟 `app.name`（package.json 的 name）走，见第 1 节第 2 行。 | 源码 | 计入第 1 节（1 行）。 |
| **不跟** appId 走：DSH 数据目录 | 默认是 `~/.dsh`（`packages/util/home-paths/src/index.ts:12`、`:71`），可以用 `DSH_HOME` 覆盖（`:18`、`:127-136`）。下面这些都在里面：desktop profile `$DSH_HOME/profiles/desktop`（`D:src/paths.ts:17-21`）、凭据 `.credentials.yaml`、匿名用户 id、用户 patch。它和 CLI 以及任何已装的 DeepSeek Harness **共用**。README 写明桌面壳是在单实例锁下独占 `profiles/desktop` 的（`D:README.md:123`）：如果只换了 userData 而没换 `DSH_HOME`，两个应用就能同时跑在同一个 profile 上。`DSH_HOME` 又没法从登录 shell 传进来（受共同限制）。 | 源码 | 在 `D:src/main.ts` 最早处设置 `process.env.DSH_HOME`，要早于 `resolveDesktopPaths` 的两处调用（`D:src/main.ts:110`、`:387`）：1 文件 2～3 行。Host 的环境以 `process.env` 为底（`D:src/main.ts:398`、`:404`、`:537`），应该能继承，未运行核实。也可以改 `packages/util/home-paths/src/index.ts:12`，但会连带影响 CLI。 |
| 其他带品牌的标识 | Electron 会话分区 `persist:dsh-platform-*`（`D:src/platform-view.ts:106`，登录后才有）；Windows 命令行的注册表键 `Software\DeepSeekHarness\Command` 和互斥量 `Global\DeepSeekHarness.Command.<sid>`（`D:scripts/command-path.ps1:140`）；`/usr/local/bin` 下的归属回执 `.dsh-desktop-command.json`（`D:src/command-installation.ts:56`）和备份前缀 `.dsh-command-backup-`（`:99`）。 | 源码 | 可选：Windows 1 行；mac 回执 2 行。 |
| 更新缓存目录名 | 由 electron-builder 按包名派生（`D:packaging/README.md:269`）。没有更新源时用不到。 | — | 0 |

## 8. 写死的文案（`src/locale.ts` 以外）

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:src/main.ts:1161` | `applicationName: 'DeepSeek Harness'`（关于面板）。这是壳的 TS 源码里除 locale 以外**唯一**一处写死的产品名；另外 `D:src/welcome-backend.ts:78` 有一条内部错误信息提到 DeepSeek。 | 源码 | 1 行（已计入第 1 节） |
| `D:scripts/electron-builder-config.mjs:172` | `NSMicrophoneUsageDescription: 'DeepSeek Harness uses your microphone…'`，**只有英文**。仓库里没有 InfoPlist.strings，所以虽然 `:171` 声明了 8 种 `CFBundleLocalizations`，麦克风授权提示永远显示英文。 | 源码 | 1 行。要本地化，得额外加 InfoPlist.strings（未估）。 |
| `D:renderer/*.html`、`*.js` | `D:renderer/welcome.html:7`、`D:renderer/policy-login-loading.html:12`、`D:renderer/update-dialog.html:7`、`D:renderer/mandatory-update.html:7` 的 `<title>` 都是空的，文字都由主进程从 locale 传入（`D:renderer/policy-login-loading.html:39-45`）。JS 里只有内部标识（`dsh-mandatory-*`、`dsh-app://app`）。 | — | 0 |
| `D:installer/locales/*.json`、`D:installer/*.h` | 见第 1 节：Windows 共 27 行。 | 源码 | 计入第 1 节 |
| 脚本里写死的产品名（不是界面文字，但必须和 productName 一致） | 本机构建链路：`D:scripts/smoke-packaged-runtime.ts:16`、`:18`（必改）、`D:scripts/package-target.ts:405`、`D:scripts/desktop-build-version-discovery.ts:34`、`:110`。签名或发布链路：`D:scripts/package-target.ts:548`、`:554`、`D:scripts/package-macos.ts:81`、`:113`、`D:scripts/verify-retained-desktop.ts:42`、`D:scripts/desktop-upload-plan.ts:244`、`D:scripts/desktop-website-installer.ts:44`、`D:scripts/retain-desktop-ci.ts:80`、`D:scripts/installed-update-distribution.ts:55`、`D:scripts/desktop-rollout.ts:57`。 | 源码 | 本机：2～3 文件 3～4 行；签名或发布：8 文件 10 行。 |
| 崩溃报告 `D:src/crash-report.ts:131-132` | 有两句固定英文，不带品牌；文件名 `crash-<时间>-<来源>.log`（`:49`、`:97`）也不带品牌。 | — | 0 |
| 窗口内容（Web 前端），不在壳里 | 未签名包里，侧栏和标题显示「DSH 本地构建」或「DSH Local Build」：`packages/client/locale/src/locales/en.ts:36`、`packages/client/locale/src/locales/zh.ts:34`，其余 6 种语言（ja、es、fr、de、ru、pt）在同一目录各自文件的第 37 行。标题的兜底值在 `packages/client/ui-layout/src/client/AppFrame.tsx:261`；侧栏的版本角标在 `packages/client/ui-sidebar/src/client/SidebarRoot.tsx:49-56`、`:350-353`；HTML 标题在 `apps/web/vite.config.ts:15`。 | 源码 | 约 9～10 文件，各 1 行。侧栏的标志图要另做品牌插件，未估（见第 10 节）。 |
| Web 前端里的 DeepSeek 文档链接（不在本清单范围，只给出处） | `packages/client/ui-settings-web-search/src/client/locales.ts:45`、`:93` 等 8 处（`api-docs.deepseek.com`）；`packages/client/ui-settings-models/src/client/locales.ts:61`、`:241` 等 8 处（`api.deepseek.com/anthropic`）。 | 源码 | 2 文件 16 行。是否对用户可见未逐项核实。 |

## 9. 随包的命令行

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:cli/dsh`（14 行）、`D:cli/dsh.cmd`（5 行）、`D:cli/link-entry.c`（18 行） | 启动器 `dsh` 以 `ELECTRON_RUN_AS_NODE=1` 运行 `"$resources/../MacOS/DeepSeek Harness"`（`D:cli/dsh:14`），执行 `app.asar/dsh/.../dsh-desktop-host/lib/cli.js`，也就是完整的 dsh CLI（`H:src/cli.ts:21-34`，`manageDesktopProfile: true`）。`dsh.cmd:4` 对应 `DeepSeek Harness.exe`。`link-entry.c` 是 macOS 上用来建符号链接的小程序。 | 源码 | 换了 productName 就必须改 `D:cli/dsh:14`，1 行；Windows 另加 1 行。 |
| `D:scripts/prepare-runtime.ts:36-49`、`:70`；`D:scripts/prepare-cli.ts:11-17`；`D:scripts/prepare-command-link.ts:13-21` | **总是随包**：把启动器拷进 `runtime/cli/bin`；在 mac 上用 `clang` 编译 `link-entry`；拷入 `command-manager.js` 和 `command-path.ps1`。整个目录随 `extraResources` 的 `runtime` 一起进包（`D:scripts/electron-builder-config.mjs:161`）。**没有开关。** | 源码 | 想彻底不带：2～3 文件约 5～10 行，未细估。 |
| 安装位置：`D:src/command-manager-entry.ts:17-19` | macOS 上建符号链接 **`/usr/local/bin/dsh`**，指向 `<App>/Contents/Resources/runtime/cli/bin/dsh`。旁边写归属回执 `.dsh-desktop-command.json`（`D:src/command-installation.ts:56`），原有命令备份成 `.dsh-command-backup-<uuid>`（`:99`）。遇到 EACCES 或 EPERM 时，用 osascript 弹管理员授权框（`D:src/command-management.ts:143-146`、`:164-165`）。通过登录 shell 执行 `command -v dsh` 探测当前生效的是哪个 dsh（`:112-121`）。Windows 上把 `resources/runtime/cli/bin` 加进用户 PATH（`D:src/command-manager-entry.ts:23-35`，调 `D:scripts/command-path.ps1`）。**只在用户主动操作时才装。** | — | 0 |
| 菜单入口：`D:src/main.ts:1212-1213` | 在 macOS 和 Windows 的应用菜单里显示「管理 dsh 命令…」（`D:src/main.ts:479-487` 创建管理器；对话框在 `D:src/command-management.ts:183-238`，文案用 locale 的 cliCommand* 键）。**没有配置开关能去掉。** | 源码 | 去掉菜单：1 文件 2 行。 |
| 和用户自己装的上游桌面版冲突 | 命令名和路径完全相同：从我们的应用里点「安装」，会把上游桌面版的 `/usr/local/bin/dsh` 换掉（会备份，删除时可以恢复）。改名要动：`D:src/command-manager-entry.ts:18`、`D:scripts/prepare-cli.ts:12`、`D:src/command-management.ts:58`、`:115`，`cli/dsh` 文件改名，`D:scripts/command-path.ps1:61`、`:99`、`:140`（Windows），再加 locale 64 行。 | 源码 | mac：4 文件约 5 行，另加 locale 64 行。Windows 再加 2 文件约 4 行。 |

## 10. 其他带身份的东西

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| `D:package.json:7-9` | `author.name: "Hangzhou DeepSeek Artificial Intelligence Co., Ltd."`。在 Windows 上作为安装器的发布者和 exe 的 CompanyName（`D:packaging/README.md:301`）。mac 侧没找到使用处。 | 源码 | 1 行；也可以放进 `extraMetadata`，同样 1 行。 |
| 版权：`D:scripts/electron-builder-config.mjs:121`；`D:src/main.ts:1165` | 版权模板跟随 productName；关于面板的 `copyright` 设成了空串。 | — | 0 |
| `CFBundleLocalizations`：`D:scripts/electron-builder-config.mjs:171` | `['en','zh_CN','ja','es','fr','de','ru','pt']`，和 locale.ts 的 8 种语言一致。 | — | 0（删语言时再改） |
| 权限用途说明：`D:scripts/electron-builder-config.mjs:172`；`D:scripts/macos-entitlements.plist` | 只有一条麦克风说明（英文，见第 8 节）。entitlements 里是 JIT、禁用库校验、audio-input，不带品牌。 | 源码 | 1 行（已计入第 8 节） |
| `D:src/client-metadata.ts:9-15`、`:22-29` → `packages/credentials/deepseek-account/src/client-metadata.ts:26-29`、`:37-46` | 发给 DeepSeek 平台的客户端头：`x-client-bundle-id: ''`、`x-client-platform: desktop-mac` 或 `desktop-win`、`x-client-version`、`x-client-locale`、`x-client-timezone-offset`。缺 `DSH_CLIENT_VERSION` 时直接抛错（`D:src/client-metadata.ts:11-13`）。使用处：登录（`D:src/main.ts:1413`）、内嵌平台页（`D:src/platform-view.ts:6-7`）、强制更新策略（`D:src/main.ts:1576`、`D:src/mandatory-update-policy.ts:5`）。关掉登录、又没有策略时，这些头不会发出去。 | — | 0 |
| `DSH_CLIENT_VERSION` | 由 `D:tsdown.config.ts:26-33` 内联进 `main.js`，值来自 `scripts/client-build-environment.ts`，等于根 package.json 的 version（`:71-85`、`:119-134`）。本机构建会用仓库版本覆盖继承来的同名变量（`:123-133`）。主进程把它传给 Host（`D:src/main.ts:537`），用作遥测的 serviceVersion 和 appVersion（`packages/bundle/web-app/cordis.patch.yml:46`、`:54`），也显示在侧栏的本地构建角标上（`packages/client/ui-sidebar/src/client/SidebarRoot.tsx:49-56`）。 | — | 0（建议保持 dsh 版本号，见第 11 节） |
| `DSH_CLIENT_BUILD_PROFILE`：`scripts/client-build-environment.ts:20-23`、`:204-211`；`D:scripts/package-target.ts:481` | 未签名构建走 `pnpm run build --profile local`，得到 `local`；签名构建走 `build:official`（`package.json:25`），得到 `official` 并带上 `DSH_CLIENT_TITLE: 'DeepSeek Harness'`。`official` 会显示 DeepSeek 侧栏美术（`packages/client/ui-brand-official/src/client/index.ts:21`；`packages/client/ui-brand-official/README.md:32`）；`local` 显示小鱼标志加「DSH 本地构建」和版本角标。**两种都不是我们的品牌**。官方 README 说换品牌的正路是不装这个包，另做一个包占用侧栏的 slot（`packages/client/ui-brand-official/README.md:44`）。 | 源码 | 标题和文案 1～2 行（见第 1、8 节）。侧栏和首页的标志要新写一个品牌插件，未估。 |
| 指向 DeepSeek 的链接 | 壳里写死的 DeepSeek 地址只有发布源 `https://download.deepseek.com`（`D:scripts/desktop-auto-update-environment.mjs:29`；`D:config/publishing/*/production.json.example:3`）和 npm 默认源（`D:scripts/desktop-release-environment.mjs:15`）。平台地址见第 3 节，Web 前端的链接见第 8 节。 | — | 0 |
| 模型请求的 User-Agent（不在本清单范围，但影响「身份外露」） | 每个 provider 请求都会带 `deepseek-harness/<version> (+https://github.com/deepseek-ai/deepseek-harness)`，再加后缀 `dsh-profile/desktop`（`packages/llm/llm/src/attribution.ts:60-65`、`:74-77`、`:89`；后缀在 `apps/cli/src/profile-boot.ts:284` 设置）。源码注释明写「nothing can suppress attribution entirely」（`packages/llm/llm/src/attribution.ts:57-58`）。这个头会发到我们自己的模型服务。 | 源码 | 1 文件约 3 行，未细估。 |
| 遥测服务名：`packages/bundle/web-app/cordis.patch.yml:45` | `deepseek-harness-desktop`。关掉遥测后就无所谓了。 | — | 0 |
| 许可与商标：`LICENSE:3`；`BRAND_GUIDELINES.md:9-10` | MIT 许可，「Copyright (c) 2026 DeepSeek」，分发时必须保留这段声明。品牌指南写明「DeepSeek Harness」是注册商标，并要求不要使用官方品牌素材。所以名称、鲸鱼图标、字标都得换掉，不只是为了好看。 | — | 0（合规前提） |

## 11. 版本号耦合（重点）

README 的说法在 `D:README.md:120`：「Electron and `@deepseek-ai/dsh` always have the same exact version」。启动时只检查共享包的记录，发布版本的比对都在打包阶段（`D:README.md:170`）。

目标是让桌面应用的版本号 `app.getVersion()` 变成 `2026.11.20-beta.1`，而内置 dsh 仍是 `0.2.2-rc.5`。可以走两条路，各自会撞上的检查点如下。

- **路线 A**：不改 `D:package.json:4`，打包时加 `--build-version 2026.11.20-beta.1`。
- **路线 B**：把 `D:package.json:4` 改成 `2026.11.20-beta.1`。

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| ① `D:scripts/desktop-build-version.mjs:65-81`（`validateDesktopBuildVersion`） | 要求构建版本和产品版本的主、次、补丁号相同（`:69-71`），并且在产品版本的 prerelease 字段后面续写（`:72-79`），也就是只接受 `0.2.2-rc.5.<日期>.<序号>` 这类形式。调用处有两个：`D:scripts/package-target.ts:330`（构建开始前，很快就失败）和 `D:scripts/electron-builder-config.mjs:107`（经由 `D:scripts/desktop-build-version.mjs:89-93`）。**路线 A 在这里直接被拒**，报错「must extend product version」。这一处放开以后，`extraMetadata.version` 会变成构建版本（`D:scripts/electron-builder-config.mjs:104-105`、`:116`），于是 `app.getVersion()`、安装包名和关于面板都会显示日历版本。 | 源码 | 1 文件约 3～5 行。**这是路线 A 唯一的拦截点。** |
| ② 直接设环境变量 `DSH_DESKTOP_BUILD_VERSION` | 没用：`D:scripts/package-target.ts:355-356` 会用解析出来的版本（默认就是产品版本）覆盖它。 | — | 0 |
| ③ `D:scripts/prepare-dsh.ts:56-61` | `desktop package.json version !== 根 package.json version` 时抛出「Electron X must bind the same version of @deepseek-ai/dsh」。**路线 B 在这里被拒**，而且发生在 build、pack、prepare:runtime 之后，比较晚。路线 A 能通过。 | 源码 | 路线 B：1 文件约 2～3 行，把 release 版本改成取根版本。 |
| ④ `D:src/core-package-set.ts:86-91` | 要求包集合里 `@deepseek-ai/dsh` 和 `@deepseek-ai/dsh-desktop-host` 的 tarball 版本都等于 release 版本。经由 `D:scripts/prepare-dsh.ts:129`（`createRuntimeProjectMetadata` 调 `D:src/project-manager.ts:135`）、`D:scripts/prepare-dsh.ts:136-139`、`:141` 触发。路线 B 如果只绕过 ③、release 仍取桌面版本，会在这里被拒。路线 A 能通过。 | — | 0（③ 改成取根版本后自然通过） |
| ⑤ `D:src/runtime-tree.ts:197-201`（`readDesktopRuntime`） | 要求描述文件里共享的 dsh 和 desktop-host 版本等于描述文件自己的 `release.version`，只做内部一致性检查。启动时由 `D:src/project-manager.ts:85` 调用，`D:src/main.ts:1566` 也会读。**运行时不和 `app.getVersion()` 比较。** | — | 0 |
| ⑥ `D:src/runtime-tree.ts:224`（`verifyDesktopRuntime`） | 要求 `release.version === expectedVersion`。调用处：`D:scripts/prepare-dsh.ts:177`、`:180`（自己比自己）；**`D:scripts/electron-builder-config.mjs:213-214` 的 afterPack，期望值是 `preparedRuntimeVersion ?? productVersion`，也就是桌面 package.json 的版本**；`D:scripts/smoke-packaged-runtime.ts:19`（自己比自己）。**路线 B 即使改了 ③，也会在 afterPack 被拒。** 路线 A 能通过。 | 源码 | 路线 B：1 文件 1～2 行，期望值改成取 dsh 版本。 |
| ⑦ `D:scripts/package-target.ts:142-146`（`writeReleaseRecord`） | 比较桌面版本和根版本，只在签名、非 dir 构建时执行（`:564-566`）。路线 B 走签名构建时会被拒；未签名不执行。 | — | 0（本机未签名用不到） |
| ⑧ 开发启动：`D:scripts/dev.ts:105-109`；`D:scripts/development-project.ts:127-141` | release 版本取桌面版本，并要求 `apps/cli` 和 `apps/desktop-host` 的版本与它一致。**路线 B 下 `pnpm dev` 会被拒。** | — | 路线 B 用 dev 的话需要改：1～2 文件约 2 行。 |
| ⑨ 发布：`D:scripts/desktop-upload-plan.ts:198-200` | 只在上传时检查。 | — | 0 |
| ⑩ 仓库门禁：`scripts/verify-version-sync.ts`（由 `scripts/pre-merge-check.ts:35` 调用） | 要求 `apps/*` 下所有 manifest 的版本都等于根版本（`scripts/verify-version-sync.ts:118-136`）。路线 B 过不了 CI，但这不是打包步骤。 | — | 0（只影响 CI） |
| ⑪ primary runtime：`scripts/primary-runtime/prepare.ts:229`；`D:scripts/prepare-primary-runtime.ts:17` | 把桌面版本写进 `runtime.json` 的 `desktopVersion`，只检查非空（`packages/skill/tool-workspace-dependencies/src/index.ts:92`）。 | — | 0 |
| ⑫ 版本号格式 | `parse(version, { loose: false })`（`D:scripts/desktop-build-version.mjs:41`）。semver 不允许数字段有前导零，所以 `2026.01.05-beta.1` 不合法，要写成 `2026.1.5-beta.1`。也不允许 `+构建元数据`（`:43-46`）。macOS 的 `CFBundleShortVersionString` 会写成带 prerelease 的字符串（electron-builder 行为，未核实）。 | — | 0 |
| ⑬ 版本显示不一致 | `DSH_CLIENT_VERSION` 永远等于根版本 `0.2.2-rc.5`（第 10 节）。路线 A 下，关于面板显示日历版本，侧栏的本地构建角标显示 `0.2.2-rc.5-<commit>`。 | — | 0（知悉即可） |

**结论**：路线 A 只需改 ① 一处（1 文件约 3～5 行），之后每次打包都带上 `--build-version`。路线 B 要改 ③ 和 ⑥（2 文件约 4～6 行）；用 dev 时还要改 ⑧；而且过不了仓库门禁 ⑩。

## 12. 本机构建的前提

两个脚本的映射：`D:package.json:34` 的 `package:mac:arm64:unsigned` 执行 `tsx scripts/package-target.ts mac-arm64 --unsigned`；`D:package.json:35` 的 `package:mac:arm64:dir` 执行 `tsx scripts/package-target.ts mac-arm64 --dir`，**注意没有 `--unsigned`**。根目录的别名在 `package.json:37-38`。

**`package:mac:arm64:unsigned` 的实际步骤**（主流程在 `D:scripts/package-target.ts`，下面的引用都写全路径）：

1. 检查宿主：`mac-arm64` 要求 Apple Silicon（`D:scripts/package-target.ts:184-189`）。
2. 构造环境：用 `localMacOSPackageEnvironment()`（调用在 `D:scripts/package-target.ts:347-348`，定义在 `D:scripts/desktop-package-environment.mjs:28-34`），不读 `.env.macos`，appId 固定为 `com.deepseek.harness`。
3. 解析版本（`D:scripts/package-target.ts:352-356`）。读 git 的 commit 和 dirty 状态（调用在 `D:scripts/package-target.ts:364`，定义在 `D:scripts/desktop-build-commit.mjs:23-29`），所以**必须是 git 检出**。在 `.desktop-build/packaging-runs/` 下建运行记录（`D:scripts/package-target.ts:367-374`）。
4. 校验配置（调用在 `D:scripts/package-target.ts:379`，定义在 `D:scripts/desktop-package-environment.mjs:120-127`，未签名构建到 `D:scripts/desktop-package-environment.mjs:127` 就返回）。探测工具链，mac 上只探测 `tar`（调用在 `D:scripts/package-target.ts:380`，定义在 `D:scripts/desktop-toolchain-preflight.ts:77-86`）。
5. `pnpm run build --profile local`（`D:scripts/package-target.ts:481`）：在仓库根做完整构建。默认 scope 是 complete，包含 host 和 client 的聚合类型检查（`scripts/build.ts:65`），**所以补丁必须能通过 tsc**。
6. 打包本地 tarball：
   - `pack-local-packages.ts`（调用在 `D:scripts/package-target.ts:489-494`，脚本见 `D:scripts/pack-local-packages.ts:13-26`）；
   - `pnpm --dir apps/desktop-host pack`（`D:scripts/package-target.ts:495-501`）；
   - `release:pack --family vendor`（`D:scripts/package-target.ts:502`）；
   - `native/system` 的 `build:ts` 和 `entry pack`（`D:scripts/package-target.ts:503-512`）。
7. `pnpm run prepare:runtime`（`D:scripts/package-target.ts:514-515`、`:520-521`），入口是 `D:scripts/prepare-runtime.ts:51-76`：
   - 用 @electron/get 下载 Electron（`D:scripts/prepare-runtime.ts:23-34`，**联网**）；
   - 准备 primary runtime（`D:scripts/prepare-runtime.ts:56-67`）：Node（`scripts/primary-runtime/prepare.ts:94`，**联网**）、Python（`scripts/primary-runtime/prepare.ts:112`，**联网**）、wheel（`scripts/primary-runtime/prepare.ts:238-240`，**联网**）。pnpm 不下载，拷的是仓库依赖里的 `pnpm` 包（`scripts/primary-runtime/prepare.ts:221-223`；版本 11.28.5，见 `D:package.json:76`）；
   - 准备 CLI（`D:scripts/prepare-runtime.ts:36-49`）：先用 PlistBuddy 读最低系统版本（`D:scripts/prepare-runtime.ts:42-44`），再用 `clang` 编译命令链接（`D:scripts/prepare-command-link.ts:18`）；
   - 写 `versions.json`（`D:scripts/prepare-runtime.ts:71-75`）。
8. `pnpm run prepare:packages`（`D:scripts/package-target.ts:524`），入口是 `D:scripts/prepare-package-set.ts:151-198`。
9. `pnpm run prepare:dsh`（`D:scripts/package-target.ts:525`），入口是 `D:scripts/prepare-dsh.ts:117-181`：
   - 绑定版本（`D:scripts/prepare-dsh.ts:56-61`）；
   - 对 npm registry 执行 `pnpm install --lockfile-only` 和 `--prod --frozen-lockfile`（`D:scripts/prepare-dsh.ts:132`、`:140`，**联网**）；
   - 检查 LibreOffice 引擎（`D:scripts/prepare-dsh.ts:145-146`、`:163-165`）；
   - 未签名不签原生文件（`D:scripts/prepare-dsh.ts:166`）；
   - 对 primary runtime 做冒烟（`D:scripts/prepare-dsh.ts:172`），写描述文件（`D:scripts/prepare-dsh.ts:173-176`），再校验并冒烟（`D:scripts/prepare-dsh.ts:177-181`）。
10. electron-builder `--config electron-builder.config.mjs --mac --arm64 --publish never`（调用在 `D:scripts/package-target.ts:559`，参数拼装在 `D:scripts/package-target.ts:267-289`）：ad-hoc 签名（`D:scripts/electron-builder-config.mjs:175`），只出 dmg（`D:scripts/electron-builder-config.mjs:183`），afterPack 校验 runtime（`D:scripts/electron-builder-config.mjs:213-214`）。
11. 运行 `smoke-packaged-runtime.ts --unsigned`（`D:scripts/package-target.ts:561-562`）。
12. 不写发布记录（`D:scripts/package-target.ts:564`）。打印 DMG 路径（`D:scripts/package-target.ts:402-407`）：`.desktop-build/targets/mac-arm64/unsigned-artifacts/deepseek-harness-<ver>-mac-arm64-unsigned.dmg`（`D:scripts/desktop-build-paths.mjs:124-127`；`D:packaging/README.md:177`）。

**`package:mac:arm64:dir` 与上面的不同**：它走的是签名分支。

1. 用 `loadDesktopPackageEnvironment` 读 `D:.env.macos`，文件不存在就报错（`D:scripts/desktop-package-environment.mjs:61`；`D:scripts/desktop-file-settings.mjs:17-21`）。
2. 校验时必须提供以下全部配置（`D:scripts/desktop-package-environment.mjs:124-157`）：
   - 强制更新策略的 HTTPS origin，以及 `allowedAuthOrigins`；
   - test 更新源的 origin 和 release id；
   - Developer ID 的签名身份和 Team ID；
   - 一种公证凭据；
   - `CSC_LINK` 和 `CSC_KEY_PASSWORD`。
3. 会建临时钥匙串（`D:scripts/package-target.ts:386-388`）。
4. 走 `build:official`（`D:scripts/package-target.ts:481`），窗口内容会带上 DeepSeek 官方品牌。
5. `release:pack --family dsh`（`D:scripts/package-target.ts:492`），要求 official 的客户端构建记录（`scripts/release/families.ts:356-358`）。
6. prepare-dsh 会签原生文件（`D:scripts/prepare-dsh.ts:166-170`）。
7. 最后执行 electron-builder `--dir`，跑冒烟，然后**向 Apple 提交公证**（`D:scripts/package-target.ts:545-550`）。

未签名的目录构建应该用 `package:mac:arm64:unsigned -- --dir`（`D:packaging/README.md:177`）。参数解析会先去掉 `--`（`D:scripts/package-target.ts:228`），只拒绝 `--unsigned` 和 `--prepare-only` 同用（`D:scripts/package-target.ts:241`），所以能组合。最终走到 `D:scripts/package-target.ts:559`，并带上 `--dir`。

| 位置 | 现状 | 改法类别 | 改动量估计 |
|---|---|---|---|
| 宿主工具 | Apple Silicon（`D:scripts/package-target.ts:187-189`）；Node ≥24.9.0（`package.json:8-9`）；pnpm 11.28.5（`package.json:7`）；git 检出（`D:scripts/desktop-build-commit.mjs:24-28`；`scripts/client-build-environment.ts:55-59`）；`clang`（`D:scripts/prepare-command-link.ts:18`）；`tar`（`D:scripts/desktop-toolchain-preflight.ts:25-44`）；`/usr/libexec/PlistBuddy`（`D:scripts/prepare-runtime.ts:42-44`）。 | — | 0 |
| 凭据和配置文件：未签名 | **不需要** `.env.macos`，也不需要任何证书、Apple 账号或更新服务（`D:scripts/desktop-package-environment.mjs:28-34`；`D:.env.macos.example:1`；`D:packaging/README.md:170`、`:179`）。 | — | 0 |
| 凭据和配置文件：`:dir` | 需要 `D:.env.macos` 加全套签名和公证凭据（见上）。 | 构建 | 0 行（改用 `unsigned -- --dir` 就能避开） |
| 联网：仓库依赖 | 前提是先 `pnpm install`（`D:packaging/README.md:170`），它不在打包脚本里。 | — | 0 |
| 联网：Electron | `downloadArtifact`（`D:scripts/prepare-runtime.ts:23-34`），版本取 `node_modules/electron`（devDependency `^44.7.0`，见 `D:package.json:71`）。缓存在 `downloads` 目录。默认来源和 `ELECTRON_MIRROR` 属 @electron/get 行为，未核实。 | 构建 | 0 |
| 联网：primary runtime（`scripts/primary-runtime/lock.json`） | Node 24.21.0 来自 `nodejs.org`（`scripts/primary-runtime/prepare.ts:94`）；Python 3.12.14 是 GitHub `astral-sh/python-build-standalone` 的 release 20260901（`:112`）；wheel 来自 `files.pythonhosted.org`，mac-arm64 专用 4 个（numpy、pandas、pillow、lxml），加上通用的 9 个；`pythonPackages` 共 13 个包（numpy、pandas、python-docx、python-pptx、openpyxl、XlsxWriter、Pillow、lxml 等）。**地址写死，没有镜像开关。** 下载结果按 sha256 缓存（`scripts/primary-runtime/prepare.ts:26-53`），可以预置。缓存根目录可用 `DSH_DESKTOP_PACKAGE_CACHE_DIR` 指定（`D:scripts/desktop-build-paths.mjs:46`、`:65`）。超时用 `DSH_RESOURCE_DOWNLOAD_TIMEOUT_MS`，默认 300 秒（`scripts/primary-runtime/prepare.ts:34-35`）。pnpm 不下载。 | 构建 | 0（换镜像要改地址：源码，1 文件 2 行加 lock.json） |
| 联网：dsh 运行时依赖 | `prepare:dsh` 对 npm registry 先 `install --lockfile-only` 再 `install --prod --frozen-lockfile`（`D:scripts/prepare-dsh.ts:76`、`:84`、`:132`、`:140`），其中包括 `@deepseek-ai/libreoffice-kit@0.2.3` 和 `libreoffice-kit-darwin-arm64` 原生引擎（`packages/bundle/web-app/package.json:232`；`scripts/libreoffice-packages.mjs:13-15`）。**每次构建都会重新解析 lockfile**（`D:packaging/README.md:283`），所以每次都要能访问 registry。registry 可以用 `DSH_DESKTOP_NPM_REGISTRY` 换（`D:scripts/desktop-release-environment.mjs:13-15`、`:45-56`），未签名构建也会透传。 | 构建 | 0 |
| 联网：代理 | 标准的 `HTTP(S)_PROXY` 会透传（`D:packaging/README.md:179`）。`DSH_DESKTOP_MACOS_DOWNLOAD_PROXY` 在未签名构建里会被剥掉（`D:scripts/desktop-package-environment.mjs:21`）。 | 构建 | 0 |
| 联网：electron-builder | 用的是本地 `electronDist`（`D:scripts/electron-builder-config.mjs:126`），不会再下载 Electron。生成 DMG 时是否还会下载工具，未核实。 | — | 0 |
| 耗时和体积 | **文档里没写具体数字。** 间接线索有三条：CI 打包任务的超时是 180 分钟（`.github/workflows/macos-package.yml:68`）；工具链探测的注释说「第一个归档步骤要几分钟后才到」（`D:scripts/desktop-toolchain-preflight.ts:4-5`）；README 只说安装包大小和磁盘占用由发布验证测量，没给数（`D:packaging/README.md:295`）。 | — | 0 |
| 未签名包的功能缺口 | 不带 Computer Use helper（`D:packaging/README.md:179`）。打开未公证的应用，可能需要到「隐私与安全性」里放行。 | — | 0 |

---

## 汇总

### 按类别统计条目数（按上面 12 个表格的数据行计）

| 类别 | 条目数 | 说明 |
|---|---|---|
| 配置（运行时配置或环境变量） | 5 | 预置任一 provider 的密钥以跳过欢迎窗口（第 3 节）；用 profile patch 改 DeepSeek 平台地址（第 3 节）；用 `DSH_PRODUCT_ANALYTICS_OTLP_URL` 改上报地址、用 settings 关闭产品分析、用 `DSH_TELEMETRY_DISABLED` 或 `DSH_TELEMETRY_MODE` 关闭会话遥测（第 5 节）。环境变量类都受「登录 shell 里的 `DSH_*` 不合并」限制；配置文件类会写进 `$DSH_HOME`，只对本机生效，打不进安装包。 |
| 构建（构建参数、环境变量或构建配置） | 11 | 第 4 节 5 条：publish、更新源、通道、env 模板、强制更新策略；第 7 节 1 条：`DSH_DESKTOP_APP_ID`；第 12 节 5 条：`:dir` 所需凭据、Electron 下载、primary runtime 缓存、npm registry、代理。**大多只在签名发布链路生效，对 mac 未签名构建没有作用。** |
| 源码（只能改源码或替换资源） | 51 | 其中 10 条只是指向别处的引用行（标「计入 locale 行」或「已计入第 N 节」）：第 1 节 6 条、第 7 节 1 条、第 8 节 2 条、第 10 节 1 条。去掉后实际是 41 个独立改动点。具体文件和行数见下面的清单。 |
| —（不用改或事实说明） | 51 | |
| **合计** | **118** | 第 1 到 12 节的表格共 118 个数据行。 |

### 源码类改动清单与工作量

**A. 最小可用集合**：mac arm64 本机未签名；换名、换图、不显示上游账号登录、与用户自己装的上游桌面版数据隔离、日历版本号。只动 `apps/desktop`。

| 文件 | 处 | 行 |
|---|---|---|
| `D:scripts/electron-builder-config.mjs`（`:111`、`:119`、`:123`、`:172`，加 `extraMetadata` 一行） | 5 | 5 |
| `D:scripts/desktop-package-environment.mjs:31` | 1 | 1 |
| `D:src/main.ts`（`:1161`、`:1488`、`:1491`，加设置 `DSH_HOME`、`DSH_TELEMETRY_DISABLED`） | 5 | 6～7 |
| `D:src/locale.ts`（13 个键 × 8 种语言） | 104 | 104 |
| `D:scripts/smoke-packaged-runtime.ts:16`、`:18` | 2 | 2 |
| `D:cli/dsh:14` | 1 | 1 |
| `D:scripts/package-target.ts:405` | 1 | 1 |
| `D:scripts/desktop-build-version.mjs:65-81` | 1 | 3～5 |
| `D:src/welcome-api.ts:74`（方案 A） | 1 | 1 |
| 资源：`D:resources/icon-macos.png`、`D:resources/icon-windows.png`、`D:renderer/assets/welcome-brand.svg` | 3 | 0 |
| **合计** | **12 个文件**（9 个代码文件、3 个资源文件），约 124 处 | **约 124～127 行**（其中 locale 占 104 行） |

**B. 把「关外联」打进包里**：动 apps/desktop 以外，但都在同一副本里。

- `packages/bundle/web-app/cordis.patch.yml:53`：关产品分析，1 行。
- 会话遥测：已由 A 里 `main.ts` 的 `DSH_TELEMETRY_DISABLED` 覆盖；或者改 `packages/bundle/base/cordis.patch.yml:221`，1 行。
- 合计 **1～2 个文件，1～2 行**。

**C. 窗口内容（Web 前端）去掉 DSH 和 DeepSeek 字样**：不在本清单范围，粗估。

- `scripts/client-build-environment.ts:204-211` 或 `apps/web/vite.config.ts:15`：1～2 行。
- `packages/client/locale/src/locales/*.ts` 的 `brand.localBuild`：8 个文件各 1 行。
- 可选：`packages/llm/llm/src/attribution.ts:60-65`（User-Agent），约 3 行。
- 合计约 **10～11 个文件，12～14 行**。侧栏和首页的标志需要新写品牌插件，**未估**。

**D. 可选项**：

- CLI 改名，避免和用户自己装的上游桌面版抢 `/usr/local/bin/dsh`：4 个文件约 5 行，另加 locale 64 行。
- 隐藏「检查更新…」（`D:src/main.ts:1211`）和「管理 dsh 命令…」（`:1212-1213`）：3 行。
- 欢迎页改成只填自有密钥（方案 B）：2～3 个文件，约 10～20 行。
- 图标的 SVG 源文件和原稿：4 个资源文件。
- auto 编号（`D:scripts/desktop-build-version-discovery.ts:34`）：1 行。
- 开发包的 Info.plist（`D:scripts/development-app.ts:39-43`）：3～4 行。

**E. Windows 额外**（mac 不需要）：

- 安装器文案：11 个文件 27 行。
- `D:cli/dsh.cmd:4`：1 行。
- `D:scripts/command-path.ps1`：1～3 行。
- 资源：`tray-windows.ico` 加 5 张安装器图片，共 6 个文件。
- 另外注意：Windows 未签名包也必须配置强制更新策略（第 4 节）。

**F. 签名和发布链路额外**（本机未签名不需要）：

- 第 8 节列出的 8 个文件约 10 行；
- `D:scripts/desktop-auto-update-environment.mjs:29`、`:46`、`:174`：3 行。
- 合计约 9 个文件 13 行。

**总估**（文件数按新增计，前面范围已算过的文件不重复计）：

| 范围 | 文件 | 行 |
|---|---|---|
| A（最小集，mac 本机） | 12（9 代码 + 3 资源） | 约 124～127 |
| A + B（再把外联关闭打进包里） | 13～14 | 约 125～129 |
| A + B + C（再加窗口内容的文案） | 23～25 | 约 137～143（不含侧栏标志插件） |
| A 到 F 全部 | 约 60～63（含 13 个资源） | 约 265～290 |

不论哪个范围，`locale.ts` 都是大头：104 行，CLI 也改名的话是 168 行。

以下没有计入总估：

- 彻底不带 CLI：2～3 个文件，5～10 行；
- Web 设置页里的 DeepSeek 文档链接：2 个文件，16 行；
- 麦克风说明的本地化：InfoPlist.strings；
- 侧栏和首页的品牌插件。

### 统计方法

用脚本逐行读取本文件第 1 到 12 节里所有 4 列表格的数据行，取第 3 列（改法类别）的首字计数，共 118 行。汇总区的表格没有计入。
