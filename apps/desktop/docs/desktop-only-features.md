# 上游桌面壳独有功能与变动盘点（DSH 0.2.2-rc.5）

> 附件。对上游源码做的只读盘点：上游桌面壳比 Web 多了什么、客户端怎么识别桌面环境、
> 上游文档和笔记里能看到的变动。逐条带文件和行号。摘要和每项功能「薄壳要不要补」的判断
> 在 [../README.md](../README.md) 的「两条路线」一节，不在这份盘点里。

- 盘点对象：DSH 源码的只读检出（下文称「副本」），唯一提交 `9c2670d3`（2026-11-18，标签 `dsh-v0.2.2-rc.5`）。
- 盘点日期：2026-11-20。方法：`grep -n` 与逐文件阅读；文中行号都在副本里核实过。标「推断」的是根据代码推出、没有运行验证的结论；标「未核实」的是 Electron / 操作系统的默认行为，本仓库里没有对应代码可查。
- 路径简写（都相对副本根目录）：`ad/` = `apps/desktop/src/`；`adh/` = `apps/desktop-host/src/`；`pc/` = `packages/client/`；`bundle-web` = `packages/bundle/web-app/cordis.patch.yml`；`README-D` = `apps/desktop/README.md`。

## 结论摘要

1. **窗口外观完全靠预加载打的标记。** 拖动区域、红绿灯留白、毛玻璃透明背景、Windows 标题栏，都挂在 `<html data-platform="darwin">` 和 `<html data-windows-titlebar>` 上，只有上游预加载会设置它们。不带这些标记时，页面里没有任何 `-webkit-app-region: drag`。所以薄壳如果用无边框窗口或 `hiddenInset`，窗口拖不动，红绿灯会压住侧栏左上角。用系统标准标题栏就没有这个问题（见「问题 1」）。
2. **没有公开的“我是桌面”开关。** 客户端认桌面靠两个总开关：`data-platform` 和 `'dshDesktop' in globalThis`。两者都会连带要求别的桥：只注入 `data-platform` 会让快捷键服务在构造时直接抛错。不过有三个只管一件事的页面全局（目录选择、宿主路径、语言），自己写预加载提供它们，不会牵动其他桌面分支（见「问题 2」）。
3. **只有桌面壳有、Web 完全没有对应物的功能：** 托盘（只有 Windows 有）、自动更新与强制更新、退出前问 Host 有没有任务在跑、原生致命错误恢复对话框、单实例与 `dsh://open`、平台用量/充值内嵌页、原生文件拖出、另存为、登录 shell 环境读取、随包的 primary runtime（`load_workspace_dependencies`）、产品分析。
4. **在 Web 里能用、但会退化成“浏览器行为”的功能：** 目录选择改走 Host 子进程弹出的系统选择器，不附着窗口；账号登录改为 `window.open` 弹标签页；外链和用量页用 `target=_blank`；下载用 `<a download>`；剪贴板读跨源图片受 CORS 限制（推断）；文件夹不能拖入；快捷键受浏览器保留键限制，而且存在 `localStorage`，按来源隔离。在 Electron 里，这些都要薄壳自己接住：`setWindowOpenHandler`、`will-navigate`、`will-download`、右键菜单、Edit 菜单。
5. **不依赖桌面壳的能力：** 电脑操作（CUA）、LibreOffice/Office Kit、Office 技能、Open in、插件管理（但要求 PATH 上有 `pnpm`）都在 Host 侧，`dsh web` 一样能用。
6. **薄壳特有的门槛：** 首次加载必须用 `dsh web: <url>` 行里带 `token` 的地址；`dsh web` 由图形界面启动时，拿不到终端的 PATH，所以可能找不到 Node ≥24.9 和 `pnpm`；CLI 拒绝 `desktop` 这个 profile 名，所以所有按 profile 名区分的组合行都走 Web 默认值。
7. **变动：** 薄壳要依赖的公开面在 15 个升级指南版本里只有一次破坏性变更，即 v0.2.1-alpha.1 的 `web-listener-trust-config`。这里的公开面指 `dsh web` 参数、`dsh web:` 行、令牌换 Cookie、叠加顺序和 `--patch`；另有 7 条破坏性变更涉及周边：Node ≥24.9、凭据优先级、`DSH_HOME` 下的文件与家目录解析、`dsh plugin` 的参数位置、profile 模板重建、非页面客户端换 Cookie。桌面壳相关的决策笔记有 46 篇，其中 43 篇集中在 2026-09。桌面预加载桥是私有约定，它的变化不会写进升级指南。

---

## 第一部分：只有上游桌面壳才有的功能

下文用 `#N` 指本表第 N 条。表中“客户端怎么识别”一列列出预加载暴露的对象，或客户端读取的标记。“没有桥时”一列先用方括号标类别：

- **[退路]**：有替代实现。
- **[隐藏]**：入口不显示。
- **[不可用]**：功能没有。
- **[无客户端参与]**：纯主进程功能，Web 没有对应物。
- **[可用]**：不依赖桌面壳。
- **[差异]**：两边都有，行为不同。

| # | 功能 | 桌面壳里的实现位置 | 客户端怎么识别 | 没有桥时 Web 客户端的表现 | 出处（客户端 / 文档） |
|---|---|---|---|---|---|
| 1 | 托盘图标 | 只有 Windows 有：`ad/main.ts:1243-1250` 创建 `DesktopTray`（`ad/tray.ts:18-48`，单击打开窗口，菜单里是“打开 / 退出”）；打包时只给 Windows 放 `tray.ico` | 客户端不参与 | [无客户端参与] Web 没有托盘；薄壳要的话得自己做 | `apps/desktop/scripts/electron-builder-config.mjs:163-164`（注释写明 “macOS keeps the Dock and ships no menu bar icon”）；`README-D:76` |
| 2 | 全局快捷键 | 全仓库（apps/、packages/、docs/、.agents/）搜不到 `globalShortcut`，没有系统级全局快捷键。桌面只在窗口内拦截按键：主窗口和侧栏 webview 挂 `before-input-event`，命中已接受的绑定就经 IPC 转给页面（`ad/keyboard.ts:128-203,215-219`）；macOS File 菜单的“关闭页面”加速键在 `ad/keyboard.ts:242-249`；自定义绑定存 `userData/keybindings.json`（`ad/keybindings.ts:15-26`） | `dshDesktop.keyboard` 和 `dshDesktop.shortcuts`（`ad/preload-app.ts:37-67`）；客户端判断运行时看 `<html data-platform>`（`pc/shortcuts/src/client/dom.ts:13-21`） | [退路] 没有 `data-platform` 时运行时是 `web`：在 DOM 里监听按键，绑定存 `localStorage` 的 `dsh.keybindings.v1`，按来源隔离（`http://127.0.0.1:<端口>`，换端口就丢）。仍可自定义，但两键和弦一律判为 `unsupported-key`，不在浏览器白名单里的组合判为 `unsupported-browser`；桌面（macOS/Windows）不受这些限制。部分命令的默认键也不同，例如新建浏览器页：桌面 `Cmd/Ctrl+T`，Web `Cmd/Ctrl+Alt+T` | `pc/shortcuts/src/client/index.ts:43-61`；`pc/shortcuts/src/client/storage.ts:6,15-31`；`pc/shortcuts/src/configuration.ts:96-112`；`pc/ui-sidebar-browser/src/client/index.ts:47-55` |
| 3 | 字号快捷键 | 桌面运行时固定占用 `Cmd/Ctrl + =`、`Cmd/Ctrl + -` 调整文字、代码和终端字号 | `shortcuts.runtime === 'desktop'`，实质上看 `data-platform` | [隐藏] Web 运行时不注册这两个快捷键（源码里直接 return）。在 Electron 里这两个键会交给应用菜单处理（例如缩放角色）（Electron 行为，未核实） | `pc/ui-theme/src/client/index.ts:557-585`（return 在 `:560`）；升级指南 `v0.2.1-alpha.2/desktop-font-size-shortcuts` |
| 4 | 原生目录选择对话框 | `ad/directory-picker.ts:10-30`：调用 `dialog.showOpenDialog(window, ['openDirectory','createDirectory'])`，对话框附着主窗口；弹出前先恢复、显示并聚焦窗口；并发请求共用一个对话框。在 `ad/main.ts:815` 注册 | `window.__DSH_DIRECTORY_PICKER__.pick()`（`ad/preload-app.ts:104-106`）；客户端只在 native 目录流里读取它 | [退路] 没有这个全局时改调 `ctx.uiWorkspace.pickDirectory()`，由 Host 弹系统选择器。Web 组合挂的是 `directory-picker-auto`：满足回环绑定、非 SSH 启动、有显示会话这三个条件时选 native，否则选 browse（在应用内浏览 Host 目录）。macOS 的 native 由 Host 子进程执行 `osascript -l JavaScript` 弹出独立的 `NSOpenPanel`，用的是 accessory 激活策略，所以不附着 Electron 窗口；Windows 是独立子进程里的 IFileOpenDialog；Linux 用 zenity 或 kdialog。上游放弃在 Electron 里用 Host 选择器，理由是它“没有 Electron 父窗口，不能可靠地跟随应用焦点” | `pc/ui-directory-picker-native/src/client/index.ts:24-27`；`pc/ui-directory-picker-native/README.md:30`；`bundle-web:106-110`；`packages/host/directory-picker-auto/README.md:12`；`packages/host/directory-picker-native/src/native-picker.ts:21-60,100-139`；`.agents/notes/implemented/architecture/2026-09-10-desktop-web-wrapper.md:33` |
| 5 | 内置浏览器（侧栏，`<webview>`） | 只有主窗口开启 `webviewTag`（`ad/main.ts:294`）；租约、存储分区和附着校验在 `ad/browser-guests.ts:16-41,70-94`；IPC 在 `ad/main.ts:837-844`；webview 内的按键拦截在 `ad/keyboard.ts:37,251` | `dshDesktop.browser`（`ad/preload-app.ts:24`、`ad/preload-browser.ts:7-32`）；客户端要求 `protocolVersion === 1` | [隐藏（默认）/退路（手动开启后）] Web 组合默认禁用这个插件：`disabled: !!js "ctx.get('profileContext')?.name !== 'desktop'"`，而 profile 名 `desktop` 被 CLI 保留（见 #37），所以 `dsh web` 默认没有侧栏浏览器，聊天外链改为 `window.open(_blank)`。用补丁写 `- id: ui-sidebar-browser` / `disabled: false` 可以打开。没有桥时它用 iframe 实现：很多站点拒绝被 iframe 嵌入，页面导航后地址变成未知，失败提示也只是尽力而为 | `pc/ui-sidebar-browser/src/client/index.ts:69-101`、`pages.ts:11-19`；`bundle-web:318-321`；`apps/web/tests/sidebar-browser.overlay.yml:2-3`；`pc/ui-chat/src/client/apply.ts:283-288`；`pc/ui-sidebar-browser/README.md:12,28,63,104-110` |
| 6 | 电脑操作（Computer Use，CUA） | 桌面壳只负责打包：把已公证的 helper 放进安装包（`apps/desktop/packaging/README.md:130,185`）。依赖链如下：`@deepseek-ai/dsh` 的 `dependencies` 里有 `@deepseek-ai/dsh-cua-bundle`；该包把 macOS 原生 provider 列为 `optionalDependencies`；provider 包声明 `os: ["darwin"]`，发布文件里带 `native/bin` | 客户端不读任何桌面桥：`packages/experimental/cua*` 和 `packages/computer-use` 里搜不到 `dshDesktop` 或 `__DSH_*` | [可用，不依赖桌面壳] 这是 Host 侧能力。它默认关闭，在 Plugins → More 里打开，只注入到 PTC 会话。npm 包自带签名并公证过的 helper，原文是 “A browser on another operating system can connect to a supported Mac Host”。macOS 的辅助功能和录屏权限授给独立的 `DSH Computer Use.app`（经 LaunchServices 启动），不是授给终端或壳。如果薄壳把 dsh 打进自己的 `app.asar`，helper 要从 `app.asar.unpacked` 读取 | `apps/cli/package.json:30,117`；`packages/experimental/cua-bundle/package.json:60-62`；`packages/experimental/cua-macos/package.json:25-28,106-107`；`packages/experimental/cua-bundle/README.md:12,27,40`；`packages/experimental/cua-macos/README.md:25,36`；升级指南 `v0.2.1-rc.3/computer-use-helper-permissions` |
| 7 | 终端命令安装 | 应用菜单“管理 dsh 命令…”，只在 macOS 和 Windows 上有（`ad/main.ts:1212-1213`）。macOS 建 `/usr/local/bin/dsh`，必要时要管理员授权；Windows 写当前用户的 PATH。装上的命令用桌面自带的 Electron 以 Node 模式运行 CLI（`apps/desktop/cli/dsh:14`） | 客户端不参与 | [无客户端参与] Web 形态本来就是 npm 装的 `dsh` 命令。薄壳如果复用用户已装的 npm `dsh`，就不需要这一项 | `README-D:62-68` |
| 8 | 自动更新、更新渠道 | 用 `electron-updater`（`ad/update-coordinator.ts:6,15`）；启动后检查，以 10 分钟为基准轮询，失败退避；“检查更新”菜单在 `ad/main.ts:1211`；渠道（stable/nightly）存在 `userData/desktop/settings.json`；安装前锁住 Host 的新请求，并检查有没有任务在跑（`ad/main.ts:705-763`） | `dshDesktop.updates`（`ad/preload-app.ts:68-85`） | [隐藏] 没有桥时不注册“更新渠道”设置行和渠道提示；更新指示器没有状态就 `return null`。Web 形态没有自我更新，只有当页面重连到换了版本的 Host 时，才弹“重新加载”提示 | `pc/ui-settings-general/src/client/index.ts:105-127,274-282`；`pc/ui-settings-general/src/client/DesktopUpdateIndicator.tsx:70,100`；`pc/ui-settings-general/src/client/HostReleasePrompt.tsx:1`；`README-D:281,297,311` |
| 9 | 强制更新策略 | 策略在打包时嵌入，客户端查询 `/api/v0/check_client_update`；收到 `40005` 时弹壳自己的模态（`ad/mandatory-update-policy.ts:117,130,193`；`ad/main.ts:1549-1592`）；Windows 的覆盖层由预加载安装（`ad/preload-app.ts:103`） | 无（壳自己的窗口或覆盖层） | [无客户端参与] Web 形态没有 | `README-D:323-354` |
| 10 | 欢迎窗口、首次引导 | 独立的 600×700 原生窗口（`ad/welcome-window.ts:18-37,59-61`），登录或填好 API Key 后才进入工作区（`ad/main.ts:1394-1471`）。工作区里还有一层桌面 onboarding 覆盖层，它激活时把窗口最小宽度调到 960（`ad/main.ts:950-960`） | `'dshDesktop' in globalThis`，加上 `window.dshOnboarding`（`ad/preload-app.ts:89-93`） | [退路] Web 不注册桌面 onboarding 覆盖层，改在设置里显示 `WelcomeNotice` 和 DeepSeek 引导对话框，另有可选的凭据引导 | `pc/ui-settings-account/src/client/index.ts:48,259-293`；`pc/ui-settings-account/src/client/onboarding-credentials.ts:7-12`；`pc/ui-settings-models/src/client/index.ts:82,147-159`；`README-D:220` |
| 11 | DeepSeek 账号登录 | 主进程订阅账号状态，进入 `waiting-browser` 阶段时用系统浏览器打开授权页（`ad/main.ts:564-567`）；欢迎窗口可以复制登录链接（`ad/main.ts:1419-1425`）；授权完成页里的 `dsh://open` 链接把应用拉到前台 | `'dshDesktop' in globalThis` 时以 `'desktop'` 身份发起登录，由壳负责打开页面 | [退路] Web 以 `'web'` 身份发起：点击时先 `window.open('about:blank')` 预开一个标签页，拿到授权 URL 后再让它跳转；弹窗被拦截时提供“复制登录链接”。放在 Electron 里，这个 `window.open` 怎么处理由壳的 `setWindowOpenHandler` 决定 | `pc/ui-settings-account/src/client/index.ts:56-57,227-246`；`pc/ui-settings-account/src/client/browser-login.ts:30-35,50-67`；`pc/ui-settings-account/src/client/SignInDialog.tsx:56-74`；`README-D:391` |
| 12 | 平台内嵌页（用量、充值）与额度提示 | 用 `WebContentsView`，按账号分区存储（`ad/platform-view.ts:42-44,82,105-107,143`）；预加载给内嵌页注入 `window.dsh.getAuthToken()`（`ad/preload-platform-account.ts:29-44`）；IPC 在 `ad/main.ts:866-879` | `window.dshPlatform`（`ad/preload-app.ts:117-121`） | [退路] 没有桥时，用量和充值只是普通的 `<a target="_blank">`；额度不足只弹通用 Toast，没有带充值按钮的模态。在新标签页或系统浏览器里打开时不注入令牌，需要另外登录平台（推断） | `pc/ui-settings-account/src/client/index.ts:157,184,286,302,305-313`；`pc/ui-settings-account/src/client/AccountSection.tsx:121-123,209-212`；`pc/ui-settings-account/src/client/AccountQuotaNotice.tsx:62-65`；`README-D:50` |
| 13 | 文件拖出到系统 | `ad/file-drag.ts`、`ad/file-drag-files.ts`；Host 侧授权读取文件（`adh/file-drag.ts`）；在 `ad/main.ts:411-419` 注册 | `dshDesktop.fileDrag`（`ad/preload-app.ts:25-35`），要求 `protocolVersion === 1` | [退路（不可靠）] 走 Chromium 的 `DownloadURL`，内容放在 Blob URL 里。README 直说“没有验证过外部应用能收到”，接收方读得晚的话 URL 可能已被撤销 | `pc/ui-file-drag/src/client/index.ts:32-33`；`pc/ui-file-drag/README.md:31,56-57`；`README-D:150` |
| 14 | 原文件另存为、下载 | 接管 `will-download`：“下载”直接存到系统下载目录，重名自动编号；“另存为”弹原生保存框（`ad/file-actions.ts:46-98,100-135`） | `dshDesktop.fileActions.save`（`ad/preload-app.ts:19-23`） | [隐藏 + 退路] 没有桥时 `canSaveAs=false`，菜单里不出现“另存为”；“下载”通过点击 `<a download>` 实现。在 Electron 里这会触发会话的 `will-download`，壳不处理就按 Electron 默认弹保存框（Electron 默认行为，未核实） | `pc/ui-file-actions/src/client/index.ts:25-26`；`pc/ui-file-actions/src/client/files.ts:19-22,52-63`；`pc/ui-file-actions/src/client/context-menus.tsx:73-79,101-103`；升级指南 `v0.2.1-rc.3/web-file-downloads` |
| 15 | 图片复制到剪贴板 | 跨源图片由主进程抓取：不带凭据，校验每次重定向，限制大小和超时（`ad/file-actions.ts:136` 起） | `dshDesktop.fileActions.readClipboardImage`（`ad/preload-app.ts:21-22`） | [退路] 页面自己 `fetch` 图片，转成 PNG 后调 `navigator.clipboard.write`。跨源且没有 CORS 头的图片会读取失败（推断：浏览器的 `fetch` 受 CORS 限制） | `pc/ui-file-actions/src/client/files.ts:23-36,65-89`；`README-D:370` |
| 16 | 文件夹拖入、路径引用 | 预加载用 `webUtils.getPathForFile` 拿文件的真实路径 | `window.__DSH_HOST_PATHS__.pathFor(file)`（`ad/preload-app.ts:107-112`） | [退路 / 部分不可用] 没有桥时，非图片文件一律作为附件上传，不会变成 `@路径` 引用；拖入文件夹会直接报错：“只有桌面端支持添加文件夹，浏览器里请添加单个文件” | `pc/ui-conversation/src/client/apply.ts:102-115,504-525`；`pc/ui-conversation/src/client/locales.ts:40` |
| 17 | 麦克风权限 | 只放行来自主窗口主框架、`dsh-app://app` 来源的纯音频请求；macOS 上调 `systemPreferences.askForMediaAccess`（`ad/microphone-permissions.ts:16-30`，在 `ad/main.ts:816` 注册）；Info.plist 写了 `NSMicrophoneUsageDescription`，entitlement 里有 `com.apple.security.device.audio-input` | 无桥；语音输入插件直接调 `getUserMedia` | [退路] 浏览器自己弹权限请求，要求 HTTPS 或回环地址。薄壳在 macOS 上需要自己的 usage description 和 entitlement（Apple 平台要求，未在本仓库核实） | `apps/desktop/scripts/electron-builder-config.mjs:172`；`apps/desktop/scripts/macos-entitlements.plist:11-12`；`packages/experimental/client-ui-voice-input/src/client/audio.ts:63`；`packages/experimental/client-ui-voice-input/README.md:28`；`README-D:56` |
| 18 | 启动时读取登录 shell 的环境变量 | 用账户的登录 shell 执行 `-ilc` 读取 `env -0`，与 profile 准备并行；Windows 跳过；结果用作 Host 环境（`ad/login-shell-environment.ts:114,172-176`；`ad/main.ts:394-405`） | 客户端不参与 | [不涉及] `dsh web` 从终端启动，天然继承终端的环境。薄壳从 Dock 或 Finder 启动就拿不到，影响三件事：Host 找不找得到 `node`（`dsh` 的 shebang 是 `#!/usr/bin/env node`，且要求 Node ≥24.9）；插件管理找不找得到 `pnpm`（见 #30）；agent shell、终端和 PTC 看到的 PATH | `apps/cli/src/bin.ts:1`；`apps/cli/package.json:187-189`；`README-D:184` |
| 19 | 关窗只隐藏 | 拦截 `close` 事件改为 `hide()`，Host 和页面继续运行；macOS 全屏时先退出全屏再隐藏（`ad/main.ts:1313-1338`）；Windows 第一次隐藏前要用户确认（`ad/background-notice.ts:18-56`；`ad/main.ts:1251-1254`） | 客户端不参与 | [不涉及] 关掉浏览器标签页不影响终端里的 `dsh web`。薄壳要自己决定关窗行为 | `README-D:74` |
| 20 | 退出前询问是否有任务在跑 | 在 `before-quit` 时经 Node IPC 问 Host：有没有活动任务、有没有已布置的定时提醒（`ad/main.ts:1255-1266,1524-1546`；`ad/quit-confirmation.ts:15-21`；`ad/host-process.ts:289-293`；`adh/quit-inspection.ts:23-39`）；2 秒没回答就按“有任务”处理（`ad/host-process.ts:58-59`） | 客户端不参与 | [不可用] Web 形态没有这个 IPC。`dsh web` 收到信号后直接做优雅关闭，最多等 5 秒。没有找到能替代的公开 HTTP 或 Remote 查询接口（只查了 workspace-controller，没有查全） | `apps/cli/src/process-shutdown.ts:4,52-75`；`README-D:78` |
| 21 | 致命错误恢复对话框、诊断报告 | 原生对话框最多四个选项：退出、重启、禁用第三方插件（同时备份 profile 补丁）、取诊断报告；错误是端口被占（`EADDRINUSE`）时不给“禁用第三方插件”（`ad/fatal-recovery.ts:78-83`；`ad/main.ts:105-118,174-187`）；崩溃报告写到 `app.getPath('logs')`（`ad/main.ts:146-172`；`ad/crash-report.ts:152`）；页面加载失败、预加载出错、渲染进程退出都会触发（`ad/main.ts:1354-1367`） | 页面启动失败时调用 `dshDesktopBoot.failed()` 上报（`ad/preload-app.ts:113-116`） | [退路] Web 形态启动失败时在终端打印摘要，并把报告存到 `DSH_HOME/logs`；没有图形化的恢复入口，命令行里有 `dsh rescue --from-default-profile web` 这样的做法 | `apps/web/src/main.ts:11-15`；`apps/cli/src/startup-diagnostics.ts:26-34`；`apps/cli/src/args.ts:93-94`；`apps/desktop/docs/diagnostics/README.md:24,28,36` |
| 22 | 单实例、`dsh://open` | 用 `requestSingleInstanceLock`，第二次启动时聚焦已有窗口（`ad/single-instance.ts:16-26`；`ad/main.ts:1604`）；打包版注册 `dsh` 协议，只认 `dsh://open`（`ad/main.ts:1488-1492`） | 客户端不参与 | [不涉及] Web 没有。注意：上游 README 写明开发版和打包版谁后启动，谁就成为 `dsh://` 的默认处理者；薄壳如果也注册这个协议，会和官方桌面版互相抢（推断） | `README-D:391` |
| 23 | macOS 窗口外观（侧栏毛玻璃、隐藏标题栏、红绿灯位置） | 窗口用 `hiddenInset`，红绿灯在 `{x:16,y:18}`，`vibrancy:'sidebar'`，`visualEffectState:'active'`，背景透明（`ad/main.ts:277-287`）；最小化或隐藏时临时改为不透明（`ad/main.ts:320-341`）；全屏状态经 IPC 同步给页面（`ad/main.ts:302-312`） | `<html data-platform="darwin">`（`ad/preload-platform.ts:10-17`）；`<html data-fullscreen>`（`ad/preload-platform.ts:24-33`） | [退路（即浏览器布局）] 没有标记时：背景不透明，没有任何拖动区域，侧栏顶部没有 52px 的让位条，折叠时保留图标栏。细节见下文「问题 1」 | `pc/ui-primitives/src/darwin-desktop.ts:9-11`；`pc/ui-layout/src/client/AppFrame.tsx:187-188,286`；`pc/web/src/window-drag/recall.ts:63`；`pc/ui-layout/README.md:43` |
| 24 | Windows 标题栏 | 窗口用 `titleBarStyle:'hidden'`，`titleBarOverlay` 高 40px（`ad/main.ts:271-276`；`ad/windows-layout.ts:4`）；标题栏里的“应用 / 编辑”菜单由预加载注入（Shadow DOM，`ad/preload-menu.ts:10-113`），点开是原生菜单（`ad/main.ts:1268-1300`）；按页面配色更新标题栏覆盖层的颜色（`ad/preload-windows.ts:8-62`；`ad/main.ts:1301-1310`） | `<html data-windows-titlebar>` 和 CSS 变量 `--dsh-windows-titlebar-height`（`ad/preload-windows.ts:10-14`） | [退路（即浏览器布局）] 原文是 “Ordinary Web documents do not receive the marker” | `pc/ui-layout/src/client/AppFrame.tsx:171`；`pc/ui-sidebar/src/client/SidebarRoot.tsx:188`；`pc/ui-dockkit/src/components/FloatLayer.tsx:81`；`pc/ui-layout/src/client/AppFrame.module.css:26-51,105-109`；`pc/ui-layout/README.md:45`；`pc/ui-sidebar/README.md:56` |
| 25 | 原生主题同步 | 预加载观察 `html[data-ds-theme-source]` 属性，主进程据此设 `nativeTheme.themeSource`（`ad/preload-theme.ts:18-34`；`ad/main.ts:881-887`）；启动时先按 Host 里的设置预设一次（`ad/main.ts:1459`） | 客户端不读，预加载只是被动观察 | [不涉及 / 轻微] 页面主题照常生效，但原生窗口框和渲染进程里的 `prefers-color-scheme` 跟随系统外观，而不是应用里的主题设置（推断） | `ad/preload-theme.ts:9-17` 的注释 |
| 26 | 界面语言同步到壳 | `__DSH_LOCALE__.read()` 返回系统语言列表和已存的语言偏好；`onChange` 把页面语言回传，壳据此更新菜单和语言缓存（`ad/preload-app.ts:130-135`；`ad/main.ts:888-907`） | `window.__DSH_LOCALE__` | [退路] 没有桥时用浏览器语言；壳自己的菜单语言要自己处理 | `pc/locale/src/client/index.ts:567-590`；`pc/locale/src/client/bootstrap.ts:11-17`（原文 “ordinary browsers omit it”） |
| 27 | 设备信息（反馈问卷用） | `ad/device-info.ts:10-17`，字段有 platform、os、app_arch、cpu、memory_gib | `dshDesktop.deviceInfo()`（`ad/preload-app.ts:36`） | [退路] 用 `navigator.userAgent` 代替 | `pc/ui-settings-account/src/client/index.ts:198-213`；`pc/ui-settings-account/README.md:45` |
| 28 | 随包的 primary runtime、`load_workspace_dependencies`、Office 技能的 Python | 安装包自带独立的 Python（含 numpy、pandas、python-docx、python-pptx、openpyxl、Pillow、lxml、XlsxWriter）、Node 和 pnpm；Host 启动时设置环境变量 `DSH_PRIMARY_RUNTIME`（`adh/index.ts:25`；`ad/host-process.ts:185,218`） | 不经过客户端，由 profile 名和环境变量决定 | [不可用 / 退路] profile 名不是 `desktop`，或者没有 `DSH_PRIMARY_RUNTIME` 时，`workspace-dependencies` 行被禁用；Office 技能的 `pythonEnvironment` 退为 `user`，即让模型用用户自己 PATH 上的 Python，先检查库能不能导入，缺什么就告诉用户，不擅自全局安装。Office 技能本身在各种形态里都有 | `bundle-web:296-311`；`packages/skill/skill-office/README.md:12,41`；`packages/skill/tool-workspace-dependencies/README.md:12`；`README-D:106` |
| 29 | LibreOffice / Office Kit | 桌面只是在打包时把 Office 相关包目录加进 asarUnpack（`apps/desktop/scripts/electron-builder-config.mjs:190-194`） | 不经过客户端 | [可用，不依赖桌面壳] web-app 组合包直接依赖 `@deepseek-ai/libreoffice-kit` 0.2.3 和 `dsh-office-kit`；有原生引擎就用原生，没有就用 Node WASM，不去找系统里装的 LibreOffice | `packages/bundle/web-app/package.json:162,232`；`packages/document/office-kit/README.md:12,41,115` |
| 30 | 插件管理用的 pnpm | 桌面把随包的 pnpm 作为启动参数传给 Host（`adh/index.ts:35-45`；`ad/main.ts:211-214`），以 Electron 的 Node 模式运行（`ad/node-environment.ts:12-17`） | 不经过客户端 | [退路] Web 形态下，界面里的插件管理和 `dsh plugin` 命令都用 PATH 上的 `pnpm`，或插件管理器配置里的 `pnpmCommand`（默认值是 `'pnpm'`）；找不到时 CLI 提示 “install pnpm and make it available on PATH” | `packages/boot/plugin-manager/src/index.ts:326,608,895,1224`；`packages/boot/plugin-manager/README.md:10,33,89`；`apps/cli/src/plugin.ts:85-99` |
| 31 | Host 的 Node 运行时 | Host 和 pnpm 都用 Electron 自身来跑：`ELECTRON_RUN_AS_NODE=1` 加 `--expose-internals`（`ad/node-environment.ts:12-17`；`ad/host-process.ts:211-224`）。加 `--expose-internals` 是因为 Cordis 加载器用到 Node 内部的 ESM 加载器，在 Electron 44 里拿不到所需符号（`.agents/notes/archived/architecture/2026-09-11-desktop-electron-node-runtime.md:20`） | 不涉及 | [不涉及] npm 版 `dsh` 要求 Node ≥24.9。薄壳如果想用自己的 Electron 当 Node 来跑 npm 版 dsh，也要加 `--expose-internals`，而且 Electron 内置的 Node 版本必须满足 ≥24.9（推断，未验证） | `apps/cli/package.json:187-189`；升级指南 `v0.2.1-rc.2/node-24` |
| 32 | 开发者工具快捷键 | 菜单项 `toggleDevTools`，另有隐藏的 `F12` 别名（`ad/main.ts:1223,1229-1239`） | 不涉及 | [不涉及] 浏览器自带开发者工具。Electron 如果不设应用菜单，默认菜单里就有“切换开发者工具”（Electron 默认行为，未核实） | `README-D:58` |
| 33 | 右键菜单 | 可编辑区域给撤销、重做、剪切、复制、粘贴、全选；选中只读文本时只给复制（`ad/main.ts:342-368`） | 会话、文件、图片等应用内菜单由 `ui-context-menu` 自己处理 | [退路] 浏览器有原生右键菜单；Electron 默认不弹任何原生右键菜单（Electron 默认行为，未核实），薄壳要自己补上可编辑区域的菜单。在 macOS 上，Cmd+C、Cmd+V 还依赖应用菜单里的 Edit 角色：上游自己构建了 Edit 菜单（`ad/main.ts:1174-1197`） | `pc/ui-context-menu/src/client/trigger.ts:20-23,28-32` |
| 34 | 外链用系统浏览器打开 | `setWindowOpenHandler`：http/https 交给系统浏览器，一律拒绝新开窗口（`ad/main.ts:298-301`）；`will-navigate` 拦截离开应用来源的导航（`ad/main.ts:369-377`） | 不涉及 | [退路] Web 里很多地方用 `window.open(...,'_blank')` 或 `<a target=_blank>`：聊天外链、登录、反馈问卷、侧栏浏览器的“在系统浏览器打开”、Open in。薄壳必须设处理器，否则 Electron 默认会开一个新的 Electron 窗口（Electron 默认行为，未核实） | `pc/ui-chat/src/client/apply.ts:283-288`；`pc/ui-settings-account/src/client/browser-login.ts:33`；`pc/ui-settings-account/src/client/index.ts:196`；`pc/ui-sidebar-browser/src/client/view/BrowserBody.tsx:100`；`pc/ui-open-in-app/src/client/context-menus.tsx:195` |
| 35 | 产品分析、遥测（额外发现） | Host 侧的遥测和分析行只在 profile 名为 `desktop` 时启用（`bundle-web:37-54`） | 客户端只在 `'dshDesktop' in globalThis` 时订阅采集策略 | [隐藏] Web 不采集，原文 “Web usage is excluded” | `pc/product-analytics/src/client/index.ts:29`；`README-D:38` |
| 36 | “工作详情”默认视图（额外发现） | 不涉及 | `'dshDesktop' in globalThis ? 'standard' : 'detailed'` | [差异] Web 里没设置过时显示 Detailed，可以在设置里改 | `pc/ui-chat/src/client/apply.ts:172`；`pc/ui-chat/src/chat-settings.ts:56`；升级指南 `v0.1.7-rc.2/transcript-view-legacy-normal` |
| 37 | 保留的 profile 名与账号客户端身份（额外发现） | 桌面 Host 以 profile 名 `desktop` 启动，目录是 `$DSH_HOME/profiles/desktop`（`adh/index.ts:29-34`；`ad/paths.ts:17-21`） | 不涉及 | [差异] CLI 拒绝 `--profile desktop`，报 “managed exclusively by the Electron application”，所以薄壳跑的 `dsh web` 永远落在“非 desktop”分支：#5、#28、#35 都按 Web 默认值走。`deepseek-account.desktopPlatform` 只在 desktop profile 且系统是 darwin/win32 时取平台值，否则为 `null`，源码注释说 `null` “identifies the client as web”（服务端会不会因此区别对待，未核实）。另外，桌面 profile 里装的插件不会出现在 `web` profile，两者只共享 `$DSH_HOME` 里的会话、设置、凭据等数据 | `apps/cli/src/args.ts:83-87,183`；`packages/bundle/base/cordis.patch.yml:120-123`；`packages/credentials/deepseek-account/src/index.ts:45-46,76`；`README-D:123,146,386` |
| 38 | Host 认证 Cookie 与端口（额外发现） | 桌面 Host 用 `--port 0`，由操作系统分配端口（`adh/index.ts:34`）。壳拿 ready URL 换到 Cookie 后只存在内存里，转发 HTTP 和建立 WebSocket 时显式带上，不进 Electron 会话；还会清理旧版遗留的 `dsh-auth-*` Cookie（`ad/main.ts:546-552,846-857`；`ad/web-document.ts:43,65,97`） | 不涉及 | [差异] Web 认证流程：`dsh web: <url>` 打印的 URL 带进程级的 `token`；访问 `/` 时换成 `dsh-auth-` 开头的 Cookie（`HttpOnly; SameSite=Strict`），并 303 重定向到 `./`。所以薄壳直接加载不带 token 的 `http://127.0.0.1:<端口>/` 会得到 401，要先换 Cookie；薄壳的做法见 `apps/desktop/README.md` 的「凭据交接」 | `packages/bundle/web-app/src/index.ts:218-231`；`pc/connection/src/browser-auth.ts:116-118,131-140,182-199,244-248,263-289`；`pc/connection/src/index.ts:115`；`README-D:40` |

补充两点：

- **启动方式不同，但不算功能缺失。** 桌面在 Host 就绪前就从安装包里加载 `dsh-app://app/`，再经 IPC 拿到启动注入（`ad/main.ts:797-813`；`apps/web/src/main.ts:21-36`）。Web 是 Host 直接返回已经带好注入的 index.html。
- **受信任的设置面（`isLoopback`）薄壳照样可用。** 桌面页面设了 `ownsHost: true`（`apps/web/src/main.ts:25-26`），在薄壳里是 `127.0.0.1` 来源，本身就判定为回环（`pc/connection/src/client/index.ts:274`），所以受信任的设置面仍然可用。

### 问题 1：给浏览器标签页设计的界面，放进无边框桌面窗口会别扭在哪；桌面壳怎么处理拖动区域和红绿灯留白

**(a) 拖动区域。** 所有 macOS 拖动规则都限定在 `html[data-platform='darwin']` 之下（`pc/web/src/base.css`）：

- `:56-58` 先把全部元素重置为 `-webkit-app-region: initial`。
- `:67-69` 只有带 `[data-window-drag]` 的行才是 `drag`。
- `:79-81` 是一帧的 `data-window-drag-recall` 脉冲，用来让 Electron 重新收集拖动区域。
- `:83-85` body 下的 portal 层设为 `no-drag`。
- `:90-92` 带 `[data-window-drag-exclude]` 的元素不参与拖动。
- `:99-107` 拖动行里的按钮、输入框等控件自动 `no-drag`。
- `:112-115` `inert` 元素复位。

带 `data-window-drag` 标记的行有：

- 侧栏顶部条和品牌行：`pc/ui-sidebar/src/client/SidebarRoot.tsx:329-330`
- 会话标题栏：`pc/ui-conversation/src/client/skeleton/ConversationHeader.tsx:18`
- dock 标签条：`pc/ui-dockkit/src/components/TabPanel.tsx:298`
- 插件管理页头：`pc/ui-plugin-manager/src/client/PluginManagerPage.tsx:514,1685,1700`
- 平台页返回栏：`pc/ui-settings-account/src/client/PlatformOverlay.tsx:70`
- onboarding 的拖动带：`pc/ui-settings-account/src/client/OnboardingSurface.tsx:38-39`

拖动行的几何位置变化时，由刷新脉冲强制重收集；这个机制只在 darwin 下安装（`pc/web/src/window-drag/recall.ts:63`，启动入口 `pc/web/src/boot.ts:100`）。Windows 的 40px 拖动带是 `[data-windows-titlebar] .frame::before`（`pc/ui-layout/src/client/AppFrame.module.css:40-47`）。

**结论：没有这两个标记时，页面里没有任何 `drag` 区域，`hiddenInset` 或无边框窗口拖不动**，除非壳自己注入 CSS。拖动区域的契约说明在 `pc/ui-layout/README.md:43`；0.2.2-rc.1 又改过一次排除规则（升级指南 `v0.2.2-rc.1/window-drag-regions`）。

**(b) 红绿灯留白。** 窗口用 `hiddenInset`，红绿灯中心在 `(16,18)`（`ad/main.ts:280-281`）。有 darwin 标记时：

- 展开的侧栏顶部多一条 52px 的 `topStrip`。折叠按钮靠右；全屏时红绿灯隐藏，按钮挪到最左，占用红绿灯的位置（`pc/ui-sidebar/src/client/SidebarRoot.module.css:187-221`；`SidebarRoot.tsx:280,329`）。
- 折叠时整列隐藏，不留图标栏（`pc/ui-layout/src/client/AppFrame.tsx:187-188`）。改在左上角的 `shell.leading` 位置放“展开侧栏 / 新会话”两个按钮，位置是 `top: 11px; left: 88px`（`AppFrame.module.css:199-212`；`AppFrame.tsx:286`；`pc/ui-sidebar/src/client/HeaderLeadingControls.tsx:29`）。
- 同时发布 `--dsh-frame-leading-clearance`：普通状态 160px，全屏 84px（`AppFrame.module.css:169-190`）。主面板里的入口页和浮层顶部分别让出 `--dsh-frame-top-clearance: 48px` 和 `--dsh-frame-overlay-top`（`AppFrame.module.css:94-121`）。
- 说明文档：`pc/ui-layout/README.md:43`、`pc/ui-sidebar/README.md:60`。

没有标记时：

- 侧栏没有顶部让位条，品牌行就在最上面，品牌在左、折叠按钮在右（`SidebarRoot.module.css:223-226`；按钮在品牌行里渲染，见 `SidebarRoot.tsx:378`）。
- 折叠时保留图标栏（`AppFrame.tsx:188` 中的 `SIDEBAR_COLLAPSED`）。
- 页面顶部不留白。

所以红绿灯会压在品牌字标，或折叠图标栏顶部的图标上（推断：依据 CSS 几何，没有截图验证）。

**(c) 背景。** darwin 下 `html` 和 `body` 是透明的，好透出窗口的 vibrancy 材质（`pc/web/src/base.css:41-46`；`AppFrame.module.css:85-92,123-147`）。没有标记就是不透明背景。

**(d) 其他按浏览器设计的元素。** 放进桌面窗口后需要壳接住的有：

- 登录要靠 `window.open` 弹出（#11）。
- 用量、充值、外链用 `target=_blank`（#12、#34）。
- 下载用 `<a download>`（#14）。
- Web 运行时的快捷键沿用浏览器保留键的限制，而桌面窗口里并不需要这些限制（#2、#3）。
- 文件夹不能拖入（#16）。
- Host 选择器弹出的是独立面板，不附着窗口（#4）。
- 窄窗口时用浏览器式抽屉：`html:not([data-platform]) .frame[data-sidebar-drawer]`（`AppFrame.module.css:277`）。
- 页面带 PWA 清单（`display: standalone`，见 `apps/web/public/manifest.webmanifest`），这是为“在 Chrome 里安装成应用”准备的。

**(e) Windows。** 预加载给 `<html>` 打 `data-windows-titlebar`，并设 `--dsh-windows-titlebar-height: 40px`（`ad/preload-windows.ts:10-14`；`ad/windows-layout.ts:4`）：

- `.frame` 顶部留出这块高度，`::before` 伪元素作为拖动带（`AppFrame.module.css:26-51,105-109`）。
- 侧栏折叠按钮固定在标题栏左上角（`pc/ui-sidebar/README.md:56`）。
- 预加载注入的标题栏菜单按 `--dsh-windows-menu-start` 定位（`ad/preload-menu.ts:16`）。

**对薄壳的含义：** 用系统标准标题栏（不设 `titleBarStyle`）时，Web 布局和在浏览器里看到的一样，没有拖动或红绿灯的问题。想要无边框外观，就必须补 `data-platform`；而它会把快捷键服务切到桌面模式，并要求提供 `dshDesktop.keyboard`（见问题 2）。另一个办法是只用壳自己的 CSS 加拖动带，不碰上游的标记。

### 问题 2：有没有公开的、不靠上游预加载脚本的办法，让外部壳告诉 Web 客户端“我是桌面环境”

**结论：没有公开、受支持的开关。**

- 上游文档把这些标记定性为“只由桌面预加载设置”：`pc/ui-layout/README.md:43`（“set only by the desktop preload”）、`:45`；`pc/ui-sidebar/README.md:60`；`pc/ui-primitives/src/darwin-desktop.ts:3-8`。
- 仓库总则说 “Public APIs are pre-stable”（`AGENTS.md:7`）。
- 升级指南只记录“外部可感知的破坏性变更”（`AGENTS.md:11`），而预加载桥属于私有包 `@deepseek-ai/dsh-desktop`（`apps/desktop/package.json:5`，`"private": true`），桥的接口变化不会写进升级指南。

客户端认桌面靠两个“总开关”，它们都会连带要求其他桥：

1. **`<html data-platform>`。**
   - 快捷键服务据此进入 desktop 运行时（`pc/shortcuts/src/client/dom.ts:13-21`）；构造时如果拿不到 `window.dshDesktop.keyboard`，直接抛出 `Desktop keyboard bridge unavailable`（`pc/shortcuts/src/client/index.ts:43-46`）。
   - 它同时打开 darwin 布局和拖动 CSS、字号快捷键（`pc/ui-theme/src/client/index.ts:557-560`），并把文件菜单文案换成 Finder（`pc/ui-file-actions/src/client/context-menus.tsx:34`）。
   - 因此只注入这个标记，快捷键插件会加载失败，依赖 `shortcuts` 的界面跟着受影响（影响范围是推断，未运行验证）。
2. **`'dshDesktop' in globalThis`。**
   - 账号插件进入桌面分支，注册桌面 onboarding 覆盖层，并通过 `dshOnboarding.hasApiKey()` 读取凭据状态；缺这个桥时直接 reject（`pc/ui-settings-account/src/client/index.ts:48,259-293`；`onboarding-credentials.ts:7-12`）。
   - 登录以 `desktop` 身份发起，页面不再自己开标签页，而是等壳去打开授权页（`pc/ui-settings-account/src/client/index.ts:227-241`；壳侧实现在 `ad/main.ts:564-567`）。
   - 模型设置不再显示 Web 的欢迎提示和凭据引导（`pc/ui-settings-models/src/client/index.ts:82,147`）。
   - 产品分析开始订阅采集策略（`pc/product-analytics/src/client/index.ts:29`）。
   - “工作详情”默认改为 standard（`pc/ui-chat/src/client/apply.ts:172`）。
   - 文件操作、拖出、侧栏浏览器、更新这些分支都挂在同一个对象上（`ad/preload-app.ts:16-87`），类型定义在私有包里（`ad/ipc.ts:93-111`）。
3. **`<html data-windows-titlebar>`。** 只影响布局（`AppFrame.tsx:171`；`SidebarRoot.tsx:188`；`pc/ui-dockkit/src/components/FloatLayer.tsx:81`），不会触发快捷键检查。但它的语义是“Windows 自绘标题栏加桌面自有菜单”（`pc/ui-sidebar/README.md:56`），不是通用接口。

**有三个页面全局可以单独使用，不会牵动别的桌面分支。** 自己写预加载，用 `contextBridge` 照上游的形状暴露即可：

- `__DSH_DIRECTORY_PICKER__`，提供 `pick()`，返回所选路径或 null。全仓库只有 native 目录流读取它（`pc/ui-directory-picker-native/src/client/index.ts:24-27`）。Web 组合在回环绑定下挂的就是 native 目录流（`packages/host/directory-picker-auto/README.md:12`），所以薄壳可以借它改用 Electron 附着窗口的对话框。
- `__DSH_HOST_PATHS__`，提供 `pathFor(file)`，返回字符串。只有会话输入框读取它（`pc/ui-conversation/src/client/apply.ts:102-115`）。提供之后可以拖入文件夹，非图片文件变成 `@路径` 引用；预加载里可以用 `webUtils.getPathForFile` 实现（上游做法：`ad/preload-app.ts:107-112`）。
- `__DSH_LOCALE__`，提供 `read()` 和 `onChange(locale)`。只有 locale 插件读取它（`pc/locale/src/client/index.ts:567-590`），`bootstrap.ts:11` 的注释写明 “ordinary browsers omit it”。`read()` 的返回值要能通过 `parseLocaleBootstrap` 校验（`pc/locale/src/client/bootstrap.ts:11-31`）。

它们本质上仍是上游的私有约定：IPC 定义在私有的桌面包里，客户端按形状（鸭子类型）去读，没有兼容承诺。

**还有两个公开但不等于“桌面模式”的改页面办法：**

- 用 profile 补丁或 `--patch` 开关组合行，例如打开 `ui-sidebar-browser`（`apps/web/tests/sidebar-browser.overlay.yml:2-3`）。
- 写一个 Host 插件，通过 `ctx.webServer.tapIndex(...)` 或 `webserver/index-inject` 事件往 index.html 里注入内容（`packages/host/webserver/README.md:69`；`docs/subsystems/web-server.md:327-343`）。这个 API 在 v0.2.1-rc.2 改过签名（升级指南 `webserver-index-peer`）。

### 薄壳必须自己承担的事项（上游桌面壳已经处理）

- **认证。** 每次启动都要解析 `dsh web: <url>` 那一行，首次加载带 `token` 的 URL（#38）。这一行本身就是上游定义的就绪信号，原文是 “supervisors RPC as soon as they observe the line”（`packages/bundle/web-app/src/index.ts:220-224`）。
- **端口。** 固定端口会和别的 `dsh web` 冲突，默认端口是 3080（`bundle-web:187-188`）；端口被占时 webserver 初始化失败，报 EADDRINUSE（`packages/host/webserver/README.md:73`；`docs/subsystems/web-server.md:106`）。桌面用 OS 分配的端口，避开了这个问题（`README-D:40`）。
- **运行环境。** 需要 Node ≥24.9，PATH 上要有 `pnpm`，最好读取登录 shell 的环境（#18、#30、#31）。
- **窗口行为。** 要处理 `window.open`、`will-navigate`、`will-download`、右键菜单、macOS 的 Edit 菜单、麦克风的 entitlement（#14、#17、#33、#34）。
- **profile 与补丁的叠加。** 薄壳用 `web` 或自定义 profile，和用户在终端里跑的 `dsh web` 共用 `$DSH_HOME`。家目录级的 `$DSH_HOME/cordis.patch.yml` 对所有 profile 生效，叠加顺序是：组合包 → profile 补丁 → 家目录补丁 → `--patch`（`apps/cli/README.md:41-44`）。只查了 `apps/cli/src/profile-boot.ts` 和 app-boot 的 README，没有发现 `web` profile 有进程级的单实例锁，所以要避免两个 `dsh web` 同时跑同一个 profile。
- **`dsh://` 协议。** 注册它会和官方桌面版抢默认处理者（#22）。

---

## 第二部分：上游在这些地方变动得多不多

### 2.1 `docs/upgrade-guide/`

共 15 个版本目录、145 条条目。注意：没有 `v0.2.2-rc.5` 目录，说明 rc.4 → rc.5 没有记录破坏性变更。

标记含义：

- 【桌】：涉及桌面壳，或只影响桌面形态。
- 【桌·间接】：桌面相关但影响间接。
- 【薄】：涉及薄壳会依赖的东西（`dsh web` 参数与输出、认证、profile/补丁、`DSH_HOME`、web-app/webserver 配置、Node 运行时）。
- 【薄·弱】：只是组合包成员或 API 层面的间接影响。
- 【CUA】：电脑操作，Host 侧，Web 和桌面同样受影响。

条文里泛称 “Web and Desktop” 的条目，对两种形态影响相同，不单独标注（例如 `deepseek-model-discovery`、`new-session-*`、`forge-worktree-entry`、`terminal-bundle-sidebar-backend`、`office-operation-tools`）。

- **v0.1.7-rc.2**（2 条）：`schedule-optional-bundle`【薄·弱】、`transcript-view-legacy-normal`【桌】
- **v0.2.0-rc.2**（6 条）：`account-sign-in-errors`、`bundled-python-tests`【桌】、`primary-runtime-python-aliases`【桌】、`remove-runtime-invariants`、`schedule-bundle-retired`【薄·弱】、`subpath-plugin-display-manifest`
- **v0.2.1-alpha.1**（22 条）：`deepseek-model-discovery`、`desktop-test-auth-popup`【桌】、`experimental-package-composition`、`instruction-home-override`【薄】、`job-id-identity`、`jsonl-persistence-plugin`、`mock-messages-events`、`native-subagent-bundle-tools`、`new-session-generations`、`plugin-option-placement`【薄】、`python-optional-resources`、`python-ptc-sandbox`、`session-title-adapters`、`session-title-provider-strategy`、`ssh-helper-launch`、`subagent-activations`、`subagent-preset-composition`、`team-direct-inbox`、`terminal-command-labels`、`tool-presentation-mode`、`web-listener-trust-config`【薄】、`working-directory`
- **v0.2.1-alpha.2**（12 条）：`cordis-timer-wrappers`、`deepseek-account-identity-watch`、`deepseek-account-model-catalog`、`desktop-font-size-shortcuts`【桌】、`from-default-profile-replaces-target`【薄】、`operator-connect`【薄】、`pi-ai-azure-provider`、`pi-ai-model-discovery`、`plugin-install-over-installed`、`plugin-manager-view-fields`、`sdk-minimal-image-compaction`、`stored-credentials-precedence`【薄】
- **v0.2.1-alpha.3**（1 条）：`plugin-engines-dsh`
- **v0.2.1-alpha.4**（3 条）：`account-notification-fields`、`model-switch-compaction`、`session-model-selection`
- **v0.2.1-rc.1**（2 条）：`agent-instructions-chain-budgets`、`subagent-control-tools`
- **v0.2.1-rc.2**（33 条）：`agent-runtime-owner`、`agent-team-subagents`、`approval-projection-dependency`、`auto-review-shutdown`、`auto-review-user-sources`、`built-in-japanese`、`conditional-tools`、`context-menu-services`、`cua-consent-storage`【薄】【CUA】、`cua-preset-scope`【CUA】、`cua-relative-coordinates`【CUA】、`file-drag-callbacks`【桌·间接】、`headless-policy-composition`、`model-badge-package-removal`、`new-session-blank-reuse`、`node-24`【薄】、`official-bundle-lists`【薄·弱】、`persistent-terminal-controls`、`pi-ai-default-capacities`、`pi-ai-model-catalog`、`pi-ai-protocol-replay`、`ptc-script-format`、`sdk-desktop-context`、`sdk-minimal-checkpoints`、`session-projection-handles`、`session-store-writes`、`session-team-mode`、`subagent-activation-options`、`subagent-service-methods`、`subagent-user-controls`、`tool-executor-plugins`、`web-fetch-private-destinations`、`webserver-index-peer`【薄·弱】
- **v0.2.1-rc.3**（13 条）：`attachment-read-access`、`computer-use-helper-permissions`【CUA】、`cua-bundle-id-consent`【CUA】、`generated-worktree-names`、`inbox-only-agent-wait`、`independent-session-forks`、`ptc-caller-cancellation`、`session-follow-activation`、`subagent-runtime-ownership`、`team-mode-menu`、`team-projection`、`web-file-downloads`【桌】、`web-search-defaults`
- **v0.2.1-rc.4**（3 条）：`model-listing-refresh`、`reasoning-body-props`、`sandbox-unsupported-policy-error`
- **v0.2.2-alpha.2**（22 条）：`context-menu-target`、`cordis-loader-entry-trees`、`css-anchored-menus`、`cua-source-dev-helper`【CUA】、`desktop-stable-channel`【桌】、`forge-git-permissions`、`forge-worktree-entry`、`fs-observation-policy-default-off`、`llm-error-builtin-codes`、`llm-request-purpose-declarations`、`pi-ai-request-image-count`、`projection-event-frames`、`projection-released-checkpoint`、`projection-snapshot-scope`、`retained-ptc-timeout`、`schedule-agent-tools`、`schedule-remote-host-tasks`、`sdk-run-commands`、`session-header-menu`、`subagent-explicit-reasoning`、`web-search-credential-modes`、`web-search-default-provider`
- **v0.2.2-alpha.3**（5 条）：`chat-process-activity-context`、`office-kit-package`、`office-operation-tools`、`office-skill-resources`【桌】、`subagent-names`
- **v0.2.2-rc.1**（19 条）：`account-notification-fields`、`account-remote-provider`、`archive-worktrees`、`attachment-error-codes`、`cua-ax-read-limits`【CUA】、`cua-hover-ax-only`【CUA】、`cua-native-platform`【CUA】、`dsh-doc-skill`、`forge-change-request-overview`、`forge-pinned-diff`、`forge-review-reads`、`plugin-update-method`、`runtime-context-reminders`、`session-append-overloads`、`subagent-interrupt-default`、`terminal-backend-cleanup-error`、`terminal-bundle-sidebar-backend`、`web-search-billing`、`window-drag-regions`【桌】
- **v0.2.2-rc.3**（1 条）：`deepseek-refusal-code`
- **v0.2.2-rc.4**（1 条）：`web-search-deepseek-model-default`

下表每条用一句话说明改了什么。内容依据各条 `guide.md` 的 description 或 “## Change” 一节；路径是 `docs/upgrade-guide/<版本>/<条目>/guide.md`。

| 条目 | 标记 | 一句话 |
|---|---|---|
| v0.1.7-rc.2 / transcript-view-legacy-normal | 桌 | `ui-chat.transcriptView` 缺省或无效时，非桌面 Web（npm `dsh web`）显示 Detailed，桌面仍是 Standard；旧值 `normal` 两边都显示 Detailed |
| v0.2.0-rc.2 / bundled-python-tests | 桌 | 随包 Python 里的 NumPy、pandas 去掉了上游测试集（桌面和 SDK 的 primary runtime 都受影响） |
| v0.2.0-rc.2 / primary-runtime-python-aliases | 桌 | 自定义 primary-runtime 载荷里的 Python 别名，必须指向同目录下的解释器（可重定位） |
| v0.2.1-alpha.1 / desktop-test-auth-popup | 桌 | 测试版强制更新策略的飞书登录弹窗默认关闭，要在本地 settings 里显式打开 |
| v0.2.1-alpha.2 / desktop-font-size-shortcuts | 桌 | 桌面占用 `Cmd/Ctrl + =/-` 调字号，原先用这些组合的自定义绑定不再执行；Web 不变 |
| v0.2.1-rc.3 / web-file-downloads | 桌 | Web 文件操作不再提供“另存为”（`canSaveAs` 恒为 false）；只有桌面同时提供两种操作，另存为返回绝对路径 |
| v0.2.2-alpha.2 / desktop-stable-channel | 桌 | 桌面稳定渠道名从 `latest` 改为 `stable`，旧名直接拒绝，没有别名 |
| v0.2.2-alpha.3 / office-skill-resources | 桌 | 移除 `DSH_BUNDLED_OFFICE_SKILLS` 和桌面的 `resources/runtime/office-skills/`，Office 技能统一从 `skill-office` 包内的 assets 读取 |
| v0.2.2-rc.1 / window-drag-regions | 桌 | macOS 桌面只在 `data-window-drag` 行或 `data-window-drag-controls` 范围内自动排除控件；盖住拖动行的自定义覆盖层要自己声明区域。Web 和 Windows 不受影响 |
| v0.2.1-rc.2 / file-drag-callbacks | 桌·间接 | 图片组件工厂必须提供 `fileDrag` 回调；可选的 `resourceAddress` 供桌面复用源文件 |
| v0.2.1-alpha.1 / web-listener-trust-config | 薄 | 去掉 `webRuntime` 服务和 `web-runtime` 行的 `trustedHosts`，改由 `webStartup` 服务携带 `--trusted-host`；监听地址必须是具体的本机地址，`0.0.0.0` 和 `::` 在加载时被拒；迁移的验收标准是能打印 `dsh web:` 行并正常服务 |
| v0.2.1-alpha.1 / instruction-home-override | 薄 | `agent-instructions` 去掉 `dshHome` 字段，统一按 `$DSH_HOME` 或 `~/.dsh` 解析家目录 |
| v0.2.1-alpha.1 / plugin-option-placement | 薄 | `dsh plugin` 只在转发给 pnpm 的参数之前读取 `--profile`，并有了自己的帮助 |
| v0.2.1-alpha.2 / from-default-profile-replaces-target | 薄 | `--from-default-profile` 现在会删除已存在的目标 profile（连同依赖、`node_modules` 和补丁）再重建，以前是拒绝执行 |
| v0.2.1-alpha.2 / operator-connect | 薄 | 非页面客户端默认 `interactions: 'none'`，用 `GET /connect?token=<launch-token>&interactions=none` 换取 API Cookie；浏览器认证和已有 Cookie 不变 |
| v0.2.1-alpha.2 / stored-credentials-precedence | 薄 | `$DSH_HOME/.credentials.yaml` 里存的密钥优先于导出的环境变量（以前相反）；`headless` profile 改为不挂凭据存储 |
| v0.2.1-rc.2 / node-24 | 薄 | 要求 Node.js ≥ 24.9，影响 npm 安装和源码运行；打包的桌面应用自带运行时，不受影响 |
| v0.2.1-rc.2 / cua-consent-storage | 薄 / CUA | CUA 的应用授权改存到 `$DSH_HOME/storages/cua_permissions_<sha256>.json`，每个 profile 目录一份 |
| v0.1.7-rc.2 / schedule-optional-bundle | 薄·弱 | Web 组合不再自带 Schedule 行，改由可选组合包插入 |
| v0.2.0-rc.2 / schedule-bundle-retired | 薄·弱 | 上面那个可选组合包被删除，Web 组合重新自带 Schedule |
| v0.2.1-rc.2 / official-bundle-lists | 薄·弱 | 组合包列表和 profile 模板从 `dsh-app-boot` 移到新包 `dsh-official-bundles`，启动器行为不变 |
| v0.2.1-rc.2 / webserver-index-peer | 薄·弱 | `ctx.webServer.renderIndex`、`collectIndexInjections` 和 `webserver/index-inject` 事件都改为携带 Peer。这是 API 变化，不是配置键变化；桌面 Host 正是调用方之一（`adh/index.ts:136`） |
| v0.2.1-rc.2 / cua-preset-scope | CUA | CUA 默认只注册到 PTC 会话作用域，独立的原生组合要显式选择全局注册 |
| v0.2.1-rc.2 / cua-relative-coordinates | CUA | 相对坐标的取值范围改为 0–999 的整数 |
| v0.2.1-rc.3 / computer-use-helper-permissions | CUA | macOS 电脑操作以 `DSH Computer Use.app` 运行（经 LaunchServices 启动）；授给终端或桌面启动器的辅助功能、录屏权限，对这个 helper 不再生效 |
| v0.2.1-rc.3 / cua-bundle-id-consent | CUA | macOS 上的授权改按 bundle identifier 记录，旧的应用身份需要重新同意 |
| v0.2.2-alpha.2 / cua-source-dev-helper | CUA | 源码构建的 helper 改名为 `DSH Computer Use Dev.app` 并换了 bundle id，需要重新授权；桌面和 npm 安装不变 |
| v0.2.2-rc.1 / cua-native-platform | CUA | CUA 脚本和自定义原生 provider 要迁到按窗口输入、字符串元素 ID 和平台能力查询 |
| v0.2.2-rc.1 / cua-ax-read-limits | CUA | macOS 默认读取更多 AX 节点，并允许每次读取单独覆盖遍历预算 |
| v0.2.2-rc.1 / cua-hover-ax-only | CUA | macOS `mouseMove` 默认只走 AX 悬停，不移动用户光标，做不到时返回 `HOVER_UNAVAILABLE` |

逐项看薄壳依赖的几样东西：

- **`dsh web` 命令行参数：** 只有 `web-listener-trust-config` 一条。它拒绝通配监听地址，并把 `trustedHosts` 移到 `webStartup`。现有的参数集合见 `packages/bundle/web-app/src/startup.ts:64-70`：`--host`、`--no-open`、`--port`、`--public-url`、`--trusted-host`、`--tls-cert`、`--tls-key`。
- **启动时打印的 `dsh web: <地址>` 行：** 没有条目改过它。`web-listener-trust-config` 把它当作迁移验收标准；代码在 `packages/bundle/web-app/src/index.ts:231`。
- **令牌换 Cookie：** 浏览器侧没有变化。`operator-connect` 只是给非页面客户端加了 `/connect?...&interactions=none` 的换取方式，并写明浏览器不用重新认证。
- **profile 与补丁的叠加顺序、`--patch` 的语义：** 没有条目修改。很多条目只是把 `--patch` 当作迁移手段。`from-default-profile-replaces-target` 改的是模板重建的语义，不是叠加顺序。现行的顺序见 `apps/cli/README.md:41-44`。
- **`DSH_HOME` 目录结构：** 有新增或改动的条目是 `stored-credentials-precedence`（`.credentials.yaml` 的优先级）、`cua-consent-storage`（新增 `storages/cua_permissions_*.json`）、`instruction-home-override`（家目录解析统一）、`office-skill-resources`（运行时资源目录移除）。
- **web-app 组合包的配置键 `printUrl`、`openBrowser`、`publicUrl`：** 没有条目改过；`web-runtime` 行只在 `web-listener-trust-config` 里去掉了 `trustedHosts`。现行写法见 `bundle-web:201-208`。
- **webserver 的配置键：** 没有条目改过。`webserver-index-peer` 改的是 API；监听地址拒绝通配是在 `web-listener-trust-config` 里引入的（`bundle-web:182`，“This row rejects wildcard binds”）。

### 2.2 `.agents/notes/`

**选取方法。** 先选文件名含 `desktop` 或 `electron` 的笔记，共 32 篇。再加 14 篇正文的 “Problem / Decision” 一节明显在讲 Electron 应用的笔记，即窗口、安装包、签名、桌面窗口的拖动区域、桌面专属功能这几类。以下几篇有所提及但主旨不是桌面壳，没有计入：

- `2026-09-09-profile-resolution-generations`
- `2026-09-16-sidebar-browser`（Web 的 iframe 版）
- `2026-10-26-cross-deployment-office-kit`
- `2026-09-15-platform-office-engines`
- 两篇 Windows 子进程控制台窗口的 bug-fix（Host 侧修复，薄壳同样受益）

只统计英文版，`.zh.md` 不计。

**按月统计：**

| 月份 | 全部笔记 | 桌面壳相关 |
|---|---|---|
| 2026-06 | 78 | 0 |
| 2026-07 | 398 | 0 |
| 2026-08 | 383 | 1 |
| 2026-09 | 366 | 43 |
| 2026-10 | 118 | 2 |
| 2026-11 | 16 | 0 |

“全部笔记”一列含 `rejected/` 目录的 8 篇（2026-06、2026-07 各 4 篇，都与桌面无关）；只算 implemented/archived/proposed 时，2026-06 是 74 篇、2026-07 是 394 篇，合计 1,351 篇。

桌面壳相关的 46 篇按状态分：implemented 23 篇、archived 20 篇（其中 18 篇的归档日期是 2026-09-30，另两篇是 09-17、09-18）、proposed 3 篇。

**时间线**（目录相对 `.agents/notes/`）：

| 日期 | 状态 | 文件 | 主题 |
|---|---|---|---|
| 08-25 | implemented | architecture/2026-08-25-electron-desktop-packaging-and-updates.md | 打包、发版、更新的总决策（版本号与 dsh 绑定） |
| 09-08 | archived | feature/2026-09-08-desktop-uninstall-preserve-dsh-home.md | Windows 卸载时保留 Harness 家目录 |
| 09-08 | implemented | architecture/2026-09-08-desktop-bundled-runtime-and-external-plugins.md | 核心运行时随包，外部插件装在 profile 里 |
| 09-08 | implemented | architecture/2026-09-08-desktop-welcome-window-material.md | 欢迎窗口的材质 |
| 09-08 | proposed | feature/2026-09-08-desktop-mandatory-update-api.md | 强制更新 API |
| 09-08 | proposed | feature/2026-09-08-desktop-update-extensions.md | 延后的更新扩展 |
| 09-08 | proposed | feature/2026-09-08-desktop-update-policy-and-installation.md | 更新策略与安装（含 CDN 和容量待办） |
| 09-09 | archived | architecture/2026-09-09-desktop-build-release-validation.md | 打包时校验版本兼容 |
| 09-09 | archived | architecture/2026-09-09-desktop-immediate-window-and-direct-start.md | 先开窗口，再启动 Host；URL 换 Cookie，HTTP 转发 |
| 09-09 | archived | architecture/2026-09-09-desktop-in-place-profile.md | 原地修改桌面 profile（09-17 归档） |
| 09-09 | implemented | process/2026-09-09-parallel-macos-notarization.md | macOS 并行公证 |
| 09-10 | archived | architecture/2026-09-10-windows-native-installer-pages.md | Windows 原生安装页 |
| 09-10 | implemented | architecture/2026-09-10-desktop-web-wrapper.md | 改为“薄包装”：复用共享 Web 应用 |
| 09-10 | implemented | testing/2026-09-10-desktop-local-updater-qualification.md | 用本地服务器验证更新 |
| 09-11 | archived | architecture/2026-09-11-desktop-electron-node-runtime.md | 用 Electron 当 Node 运行时 |
| 09-11 | archived | architecture/2026-09-11-windows-directory-installation.md | Windows 先暂存再替换安装目录 |
| 09-11 | archived | feature/2026-09-11-desktop-mandatory-update-client.md | 强制更新客户端与阻塞窗口 |
| 09-13 | archived | feature/2026-09-13-macos-hidden-titlebar-vibrancy.md | macOS 隐藏标题栏加侧栏毛玻璃 |
| 09-14 | implemented | architecture/2026-09-14-deepseek-account-login.md | DeepSeek 账号浏览器登录 |
| 09-14 | implemented | feature/2026-09-14-desktop-primary-runtime.md | 随包的 primary runtime |
| 09-14 | implemented | testing/2026-09-14-desktop-installed-update-journal.md | 安装后更新的证据留存 |
| 09-14 | implemented | testing/2026-09-14-desktop-installed-update-materials.md | 更新测试材料与用户数据隔离 |
| 09-15 | implemented | architecture/2026-09-15-desktop-native-fatal-recovery.md | 原生致命错误恢复 |
| 09-16 | archived | architecture/2026-09-16-desktop-cos-upload-transport.md | 发版上传改用腾讯云 COS SDK |
| 09-16 | archived | bug-fix/2026-09-16-movable-mandatory-update-window.md | 强制更新窗口可以移动 |
| 09-16 | archived | feature/2026-09-16-desktop-onboarding.md | 设备本地的桌面 onboarding |
| 09-16 | archived | feature/2026-09-16-windows-desktop-titlebar.md | Windows 标题栏与标题栏菜单 |
| 09-16 | archived | process/2026-09-16-desktop-release-version-derivation.md | 测试版版本号的推导 |
| 09-17 | archived | architecture/2026-09-17-shared-office-runtime.md | 桌面与 SDK 共用 Office 运行时 |
| 09-17 | implemented | process/2026-09-17-windows-runtime-signature-cache.md | Windows 签名缓存 |
| 09-17 | implemented | process/2026-09-17-windows-signature-completion.md | 硬件签名与时间戳分开处理 |
| 09-19 | implemented | architecture/2026-09-19-window-drag-coverage-contract.md | 把窗口拖动覆盖范围定为契约 |
| 09-19 | implemented | simplification/2026-09-19-remove-desktop-profile-core-cleanup.md | 去掉 profile 核心包清理 |
| 09-20 | archived | bug-fix/2026-09-20-windows-embedded-mandatory-update.md | Windows 内嵌式强制更新 |
| 09-20 | implemented | architecture/2026-09-20-sidebar-retained-tab-layout.md | 侧栏标签页保持挂载（部分与 webview 相关） |
| 09-20 | implemented | feature/2026-09-20-desktop-browser-webview.md | 桌面侧栏浏览器改用 webview |
| 09-21 | archived | process/2026-09-21-desktop-build-version-as-input.md | 构建版本号改为作为参数传入 |
| 09-21 | implemented | architecture/2026-09-21-desktop-page-close-shortcuts.md | 关闭快捷键跟随页面焦点 |
| 09-22 | archived | process/2026-09-22-desktop-main-bundle-after-workspace-tsdown.md | 主进程打包顺序 |
| 09-22 | implemented | architecture/2026-09-22-fatal-diagnostics-and-crash-reports.md | 致命错误诊断与崩溃报告 |
| 09-22 | implemented | architecture/2026-09-22-platform-browser-storage.md | 平台内嵌页按账号分区存储 |
| 09-23 | implemented | architecture/2026-09-23-desktop-close-to-background-and-quit-confirmation.md | 关窗隐藏、退出确认、Windows 托盘 |
| 09-27 | archived | feature/2026-09-27-desktop-cli-runtime.md | 桌面自带的 CLI |
| 09-28 | archived | feature/2026-09-28-desktop-login-shell-environment.md | 读取登录 shell 的环境 |
| 10-06 | implemented | architecture/2026-10-06-web-desktop-plugin-identity-compatibility.md | 实验包合并时保持 Web 与桌面的插件身份 |
| 10-08 | implemented | architecture/2026-10-08-desktop-shell-configuration.md | 壳的配置独立于 Host（`settings.json`） |

**架构上改过的大方向：**

1. **传输方式：私有组合加无端口管道 → 复用 Web 的 HTTP。**
   - 最初的打包决策用私有组合，配无端口传输（帧化字节管道，以避免 Base64 膨胀）（`2026-08-25-...md:115` 的备选方案讨论）。
   - 09-09 改为先开窗口、加载随包的 Web 页面，再用 Host 的 URL 换 Cookie，并转发 HTTP（`2026-09-09-desktop-immediate-window-and-direct-start.md:20`）。
   - 09-10 正式确定“薄包装”：私有 Host 调用 CLI 共享的 profile runner，走 Web 的 HTTP 传输；该笔记写明 “partially supersedes the private composition and portless transport”（`2026-09-10-desktop-web-wrapper.md:27`）。
2. **运行时：单独打包的上游 Node → Electron 的 RunAsNode。** 见 `2026-09-11-desktop-electron-node-runtime.md:16`（“supersedes the separate-Node choice”）。注意：原先是安装包里另带一份上游 Node，并不是用系统 Node（`2026-08-25-...md:113` 把“用 Electron 的 Node”列为当时放弃的方案）。
3. **“`file://` 改成自定义协议”这个说法，笔记里找不到证据。**
   - 最早的桌面笔记（08-25）实现表里已经写着 “the custom protocol”（`:104`）；但这篇是 implemented 状态，后来改写过（引用了 09-10 的决定），从浅克隆看不出它最初的内容。
   - `docs/subsystems/web-server.md:5` 里“`file://` 加 IPC 桥”的说法，更像来自 2026-07-19 的 GUI 分层笔记。那篇笔记设想 “A future Electron application ... over an IPC fetch carrier”（`archived/architecture/2026-07-19-gui-layering-and-rpc-protocol.md:36`），并明确标注 “hypothetical example — no such shell exists”（`:222`）。
4. **窗口外观：** 09-13 定下 macOS 隐藏标题栏加毛玻璃，09-16 做了 Windows 自绘标题栏，09-19 把拖动区域定为契约，到 0.2.2-rc.1 又改了一次排除规则（升级指南 `window-drag-regions`）。
5. **随包运行时与账号：** 09-14 加入 primary runtime（Python/Node/pnpm）和浏览器账号登录；10-26 又把 Office 技能扩展到所有部署形态（`implemented/architecture/2026-10-26-cross-deployment-office-kit.md`，这篇不计入桌面）。
6. **生命周期与原生能力：** 09-15 和 09-22 做了致命错误恢复与崩溃报告；09-20 侧栏浏览器改用 webview；09-23 做了关窗隐藏、退出确认和托盘；09-27 做了自带 CLI；09-28 做了登录 shell 环境读取；10-08 把壳的配置从 Host 里独立出来。

**判断：**

- 决策层面的变动集中在 2026-09，10-08 之后没有新的桌面笔记。但两点要注意：一是 2026-10 和 2026-11 全仓库的笔记总量也大幅下降（118、16）；二是笔记只为“持久的决策理由”而写，机械性和局部的界面改动不写（`AGENTS.md:157`）。所以笔记数量会低估代码层面的变动。
- 另一个侧面证据：壳与 Host 之间的生命周期协议已经到第 4 代（`ad/host-protocol.ts:4`，`DESKTOP_HOST_PROTOCOL_VERSION = 4`）；预加载桥目前是 `protocolVersion: 1`（`ad/ipc.ts:95`）。

### 2.3 `apps/desktop/` 的规模

用 `find -type f` 计文件数，`cat | wc -l` 计行数。

| 目录 | 文件数 | 行数 | 备注 |
|---|---|---|---|
| `apps/desktop/src/` | 85 | 11,524 | 83 个 `.ts`（11,280 行），2 个 `.tsx`（244 行） |
| `apps/desktop/scripts/` | 195 | 15,609 | 78 个 `.ts`、49 个 `.mjs`、39 个 `.mts`、16 个 `.ps1`、3 个 `.nsh` 等 |
| `apps/desktop/tests/` | 327 | 36,008 | 其中 `*.spec.ts` 183 个，加上 `*.e2e.ts` 共 191 个 |
| `apps/desktop/src/locale.ts` | 1 | 1,606 | 壳自己的多语言文案 |
| `apps/desktop-host/src/`、`tests/` | 9、5 | 512、435 | 私有 Host 入口 |
| `apps/desktop/` 整体 | 697（含 9 个二进制） | 70,085（只计文本文件） | 另有 packaging/publishing/windows-signing 等文档 |

`src/` 里最大的两个文件是 `main.ts`（1,619 行）和 `locale.ts`（1,606 行）。

### 2.4 文档与源码不一致的地方

1. **`docs/subsystems/web-server.md:5`（中文版 `web-server.zh.md:5` 同样）** 说 “Electron loads the built files over `file://` and sends fetch requests through an IPC bridge instead of this server”。实际情况是：桌面经 `dsh-app://app/` 自定义协议提供随包页面，其余请求转发给 Host 的 HTTP 服务（`ad/main.ts:797-813`；`ad/web-document.ts:97`）；WebSocket 直连 Host（`ad/main.ts:846-857`）。`docs/architecture.md:53` 和 `README-D:40` 的描述是对的。
2. **`README-D:382`（`README.zh.md:382` 同样）** 说 “Account sign-in is not connected; the Sign in button is disabled”。但同一份 README 的 `:391` 写了完整的浏览器登录流程，代码里也已实现：`ad/main.ts:564-567,1411-1414`；`pc/ui-settings-account/src/client/index.ts:227-246`。
3. **`pc/connection/src/client/index.ts:107-115,122`** 对 `ownsHost` 的注释说，Host “runs inside a worker this page spawned”，并且 “served pages never carry the global at all”。但桌面页面用的就是这份 `apps/web` 产物，它在 `apps/web/src/main.ts:25-26` 设了 `ownsHost: true`，而桌面的 Host 是一个监听 127.0.0.1 的独立 RunAsNode 子进程（`adh/index.ts:34`）。注释的前提和桌面的实际用法对不上。
4. **轻微：** `.agents/notes/implemented/architecture/2026-09-10-desktop-web-wrapper.md:33` 把 Host 的 macOS 选择器称为 “AppleScript dialog”。现在的实现是 JXA 驱动的 `NSOpenPanel`，源码注释还特意说明不用 AppleScript 的 `choose folder`（`packages/host/directory-picker-native/src/native-picker.ts:20-34,101`）。不过笔记的结论（“没有 Electron 父窗口”）仍然成立。

---

## 附：未核实或有保留的事项

- 依赖 Electron 默认行为的结论都没有在本仓库核实：没有 `setWindowOpenHandler` 时 `window.open` 会开新的 Electron 窗口；默认不弹右键菜单；默认菜单里有开发者工具和 Edit 角色；`will-download` 不处理时弹保存框。
- macOS 的麦克风 usage description 和 entitlement 要求，属于 Apple 平台规则。
- 红绿灯具体压在哪个元素上，是按 CSS 几何推断的，没有截图验证。
- “只注入 `data-platform` 会让依赖 `shortcuts` 的界面受影响”：抛错的位置已经核实，影响范围没有运行验证。
- 在 Web 里从系统浏览器打开平台用量/充值页需要另行登录：这是根据“预加载只给内嵌页注入令牌”推出的，服务端行为未核实。
- `deepseek-account.desktopPlatform` 为 `null` 时，服务端会不会区别对待，未核实。
- “Web 形态没有等价的查询活动任务接口”：只查了 workspace-controller，不是穷尽搜索。
