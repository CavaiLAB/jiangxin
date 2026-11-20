# 上游改动频率

> 附件。2026-11-20 用 `node scripts/upstream-churn.mjs` 生成的结果快照（重跑的输出在 `.dev/upstream-history/churn.md`）。
> 数据来源：从 GitHub 按标签下载指定文件的各个版本，相邻版本之间比增删行；目录级的数字来自 GitHub 的目录树接口。
> 本地的源码副本是只有一个提交的浅克隆，看不到历史，所以另外取的。[../README.md](../README.md) 的「两条路线」一节引用了这里的数字。

统计范围：0.1.7-rc.2（2026-09-24）到 0.2.2-rc.5（2026-11-18），共 20 个版本、19 次相邻发布。

## 乙：相邻版本之间

| 文件 | 现有行数 | 有改动的发布次数 | 累计增 | 累计删 |
|---|---:|---:|---:|---:|
| `apps/desktop/src/main.ts` | 1619 | 7 / 19 | 401 | 75 |
| `apps/desktop/src/locale.ts` | 1606 | 5 / 19 | 1337 | 72 |
| `apps/desktop/package.json` | 95 | 19 / 19 | 53 | 38 |
| `apps/desktop/scripts/electron-builder-config.mjs` | 276 | 5 / 19 | 54 | 27 |
| `apps/desktop/src/welcome-window.ts` | 132 | 1 / 19 | 22 | 3 |
| `apps/desktop/src/welcome-backend.ts` | 159 | 2 / 19 | 41 | 18 |
| `apps/desktop/src/client/WelcomePage.tsx` | 225 | 1 / 19 | 9 | 5 |
| `apps/desktop/src/update-coordinator.ts` | 287 | 3 / 19 | 118 | 23 |
| `apps/desktop/src/mandatory-update-policy.ts` | 240 | 2 / 19 | 14 | 8 |
| `apps/desktop/src/command-management.ts` | 239 | 1 / 19 | 239 | 0 |
| `apps/desktop/src/command-installation.ts` | 268 | 1 / 19 | 268 | 0 |
| `apps/desktop/src/release.ts` | 35 | 0 / 19 | 0 | 0 |
| `apps/desktop/src/runtime-tree.ts` | 239 | 1 / 19 | 31 | 6 |
| `apps/desktop/src/client-metadata.ts` | 29 | 0 / 19 | 0 | 0 |
| `apps/desktop/src/tray.ts` | 48 | 0 / 19 | 0 | 0 |
| `apps/desktop/src/quit-confirmation.ts` | 96 | 0 / 19 | 0 | 0 |
| `apps/desktop/renderer/welcome.html` | 17 | 1 / 19 | 1 | 0 |
| `apps/desktop/installer/locales/zh_CN.json` | 41 | 2 / 19 | 41 | 0 |
| `apps/desktop/scripts/package-target.ts` | 570 | 3 / 19 | 122 | 55 |
| `apps/desktop/scripts/desktop-package-environment.mjs` | 158 | 4 / 19 | 114 | 69 |
| `apps/desktop/scripts/desktop-build-version.mjs` | 104 | 3 / 19 | 8 | 4 |
| `apps/desktop/scripts/smoke-packaged-runtime.ts` | 22 | 2 / 19 | 3 | 4 |
| `apps/desktop/src/welcome-api.ts` | 75 | 1 / 19 | 9 | 0 |
| `apps/desktop/cli/dsh` | 14 | 1 / 19 | 14 | 0 |
| `apps/desktop-host/src/index.ts` | 151 | 4 / 19 | 47 | 18 |

## 乙：按小版本线跳（0.1.7-rc.2 → 0.2.0-rc.2；0.2.0-rc.2 → 0.2.1-rc.5；0.2.1-rc.5 → 0.2.2-rc.5）

| 文件 | 0.1.7-rc.2 → 0.2.0-rc.2 | 0.2.0-rc.2 → 0.2.1-rc.5 | 0.2.1-rc.5 → 0.2.2-rc.5 |
|---|---:|---:|---:|
| `apps/desktop/src/main.ts` | +67 −11 | +14 −7 | +319 −56 |
| `apps/desktop/src/locale.ts` | +119 −65 | +0 −0 | +1218 −7 |
| `apps/desktop/package.json` | +8 −4 | +13 −13 | +14 −3 |
| `apps/desktop/scripts/electron-builder-config.mjs` | +2 −0 | +33 −18 | +17 −7 |
| `apps/desktop/src/welcome-window.ts` | +22 −3 | +0 −0 | +0 −0 |
| `apps/desktop/src/welcome-backend.ts` | +16 −2 | +0 −0 | +25 −16 |
| `apps/desktop/src/client/WelcomePage.tsx` | +9 −5 | +0 −0 | +0 −0 |
| `apps/desktop/src/update-coordinator.ts` | +4 −0 | +5 −2 | +109 −21 |
| `apps/desktop/src/mandatory-update-policy.ts` | +0 −0 | +2 −1 | +12 −7 |
| `apps/desktop/src/command-management.ts` | 新增 239 | +0 −0 | +0 −0 |
| `apps/desktop/src/command-installation.ts` | 新增 268 | +0 −0 | +0 −0 |
| `apps/desktop/src/release.ts` | +0 −0 | +0 −0 | +0 −0 |
| `apps/desktop/src/runtime-tree.ts` | +0 −0 | +0 −0 | +31 −6 |
| `apps/desktop/src/client-metadata.ts` | +0 −0 | +0 −0 | +0 −0 |
| `apps/desktop/src/tray.ts` | +0 −0 | +0 −0 | +0 −0 |
| `apps/desktop/src/quit-confirmation.ts` | +0 −0 | +0 −0 | +0 −0 |
| `apps/desktop/renderer/welcome.html` | +0 −0 | +0 −0 | +1 −0 |
| `apps/desktop/installer/locales/zh_CN.json` | 不存在 | 不存在 | 新增 41 |
| `apps/desktop/scripts/package-target.ts` | +0 −0 | +49 −20 | +67 −29 |
| `apps/desktop/scripts/desktop-package-environment.mjs` | +0 −0 | +86 −26 | +28 −43 |
| `apps/desktop/scripts/desktop-build-version.mjs` | +0 −0 | +6 −2 | +1 −1 |
| `apps/desktop/scripts/smoke-packaged-runtime.ts` | +0 −0 | +3 −4 | +0 −0 |
| `apps/desktop/src/welcome-api.ts` | +9 −0 | +0 −0 | +0 −0 |
| `apps/desktop/cli/dsh` | 新增 14 | +0 −0 | +0 −0 |
| `apps/desktop-host/src/index.ts` | +0 −0 | +2 −2 | +44 −15 |

## 甲：相邻版本之间

| 文件 | 现有行数 | 有改动的发布次数 | 累计增 | 累计删 |
|---|---:|---:|---:|---:|
| `packages/bundle/web-app/src/index.ts` | 261 | 3 / 19 | 121 | 161 |
| `packages/bundle/web-app/src/startup.ts` | 124 | 3 / 19 | 50 | 14 |
| `packages/bundle/web-app/cordis.patch.yml` | 620 | 9 / 19 | 151 | 93 |
| `packages/client/connection/src/browser-auth.ts` | 394 | 2 / 19 | 110 | 27 |
| `apps/cli/src/args.ts` | 216 | 3 / 19 | 13 | 8 |
| `apps/cli/src/profile-boot.ts` | 366 | 3 / 19 | 76 | 36 |
| `packages/api/workspace-controller/src/index.ts` | 268 | 1 / 19 | 72 | 4 |
| `packages/api/workspace-controller/src/default-directory.ts` | 78 | 1 / 19 | 3 | 3 |
| `packages/util/home-paths/src/index.ts` | 197 | 1 / 19 | 78 | 4 |
| `packages/boot/app-boot/src/profile-context.ts` | 85 | 1 / 19 | 12 | 2 |

## 甲：按小版本线跳（0.1.7-rc.2 → 0.2.0-rc.2；0.2.0-rc.2 → 0.2.1-rc.5；0.2.1-rc.5 → 0.2.2-rc.5）

| 文件 | 0.1.7-rc.2 → 0.2.0-rc.2 | 0.2.0-rc.2 → 0.2.1-rc.5 | 0.2.1-rc.5 → 0.2.2-rc.5 |
|---|---:|---:|---:|
| `packages/bundle/web-app/src/index.ts` | +0 −0 | +59 −99 | +0 −0 |
| `packages/bundle/web-app/src/startup.ts` | +0 −0 | +45 −9 | +0 −0 |
| `packages/bundle/web-app/cordis.patch.yml` | +22 −19 | +59 −30 | +58 −32 |
| `packages/client/connection/src/browser-auth.ts` | +0 −0 | +110 −27 | +0 −0 |
| `apps/cli/src/args.ts` | +4 −3 | +9 −5 | +0 −0 |
| `apps/cli/src/profile-boot.ts` | +0 −0 | +62 −35 | +14 −1 |
| `packages/api/workspace-controller/src/index.ts` | +0 −0 | +72 −4 | +0 −0 |
| `packages/api/workspace-controller/src/default-directory.ts` | +3 −3 | +0 −0 | +0 −0 |
| `packages/util/home-paths/src/index.ts` | +0 −0 | +78 −4 | +0 −0 |
| `packages/boot/app-boot/src/profile-context.ts` | +0 −0 | +12 −2 | +0 −0 |

## 乙：补丁落点在升级里保不保得住

「断」的意思：那次升级里，这个落点连同上下各 3 行没有原样保留（补丁打不上，要人重新对），或者多出了新的落点（要补新的改动）。

| 落点 | 文件 | 现有几处 | 19 次相邻升级里断了几次 | 累计重对几处 | 累计新增几处 | 按线跳 3 次里断了几次 |
|---|---|---:|---:|---:|---:|---:|
| 关于面板的应用名 | `apps/desktop/src/main.ts` | 1 | 0 | 0 | 0 | 0（保、保、保） |
| 登记 dsh:// 协议（运行时） | `apps/desktop/src/main.ts` | 1 | 0 | 0 | 0 | 0（保、保、保） |
| 处理 dsh://open | `apps/desktop/src/main.ts` | 1 | 0 | 0 | 0 | 0（保、保、保） |
| 应用名 productName | `apps/desktop/scripts/electron-builder-config.mjs` | 1 | 2 | 2 | 0 | 2（保、断、断） |
| 声明 dsh:// 协议（打包） | `apps/desktop/scripts/electron-builder-config.mjs` | 1 | 2 | 2 | 0 | 1（保、断、保） |
| 安装包文件名 | `apps/desktop/scripts/electron-builder-config.mjs` | 1 | 2 | 2 | 0 | 2（保、断、断） |
| 麦克风用途说明 | `apps/desktop/scripts/electron-builder-config.mjs` | 1 | 3 | 3 | 0 | 3（断、断、断） |
| 未签名构建写死的 appId | `apps/desktop/scripts/desktop-package-environment.mjs` | 1 | 1 | 0 | 1 | 1（无、断、保） |
| 构建版本号必须续写 DSH 版本 | `apps/desktop/scripts/desktop-build-version.mjs` | 1 | 0 | 0 | 0 | 0（保、保、保） |
| 欢迎窗口的出现条件 | `apps/desktop/src/welcome-api.ts` | 1 | 0 | 0 | 0 | 0（保、保、保） |
| 冒烟脚本里的应用包名 | `apps/desktop/scripts/smoke-packaged-runtime.ts` | 2 | 2 | 2 | 0 | 1（保、断、保） |
| 随包命令行里的可执行文件名 | `apps/desktop/cli/dsh` | 1 | 1 | 0 | 1 | 1（断、保、保） |
| 打印安装包路径 | `apps/desktop/scripts/package-target.ts` | 1 | 3 | 2 | 1 | 2（无、断、断） |
| 文案里的产品名 | `apps/desktop/src/locale.ts` | 88 | 3 | 32 | 66 | 2（断、保、断） |

## 乙：写好的样例补丁拿到历史版本上试打

补丁是照最新版本写的。能打上的版本越少，说明这个落点附近改得越勤。

- `desktop-0001-about-panel-product-name.patch`：20 个版本里能干净打上 20 个。打不上的：无
- `desktop-0002-no-dsh-protocol-registration.patch`：20 个版本里能干净打上 20 个。打不上的：无

## 甲：薄壳的依赖点从哪个版本起就有

统计的最早版本是 0.1.7-rc.2，「从它起就有」的意思是至少这么久，可能更早。

| 依赖点 | 文件 | 从哪个版本起有 | 此后消失过吗 |
|---|---|---|---|
| 就绪行 `dsh web: <地址>` | `packages/bundle/web-app/src/index.ts` | 0.1.7-rc.2 | 没有 |
| 令牌的查询参数名 token | `packages/client/connection/src/browser-auth.ts` | 0.1.7-rc.2 | 没有 |
| 认证 Cookie 名的前缀 dsh-auth- | `packages/client/connection/src/browser-auth.ts` | 0.1.7-rc.2 | 没有 |
| 换到 Cookie 后回 303 | `packages/client/connection/src/browser-auth.ts` | 0.1.7-rc.2 | 没有 |
| 参数 --no-open | `packages/bundle/web-app/src/startup.ts` | 0.1.7-rc.2 | 没有 |
| 参数 --host | `packages/bundle/web-app/src/startup.ts` | 0.1.7-rc.2 | 没有 |
| 参数 --port | `packages/bundle/web-app/src/startup.ts` | 0.1.7-rc.2 | 没有 |
| 参数 --patch（可重复） | `apps/cli/src/args.ts` | 0.1.7-rc.2 | 没有 |
| 命令行拒绝 desktop 这个 profile 名 | `apps/cli/src/args.ts` | 0.1.7-rc.2 | 没有 |
| 配置键 documentsDirectory | `packages/api/workspace-controller/src/index.ts` | 0.1.7-rc.2 | 没有 |
| 环境变量 DSH_HOME | `packages/util/home-paths/src/index.ts` | 0.1.7-rc.2 | 没有 |
| 环境变量 DSH_AGENTS_HOME | `packages/util/home-paths/src/index.ts` | 0.2.1-alpha.2 | 没有 |
| 环境变量 DSH_TELEMETRY_DISABLED | `packages/boot/app-boot/src/profile-context.ts` | 0.1.7-rc.2 | 没有 |

## 目录级：每次发布改了多少个文件

- `apps/desktop/`：现有 697 个文件；19 次发布里有 19 次动过它；累计改 516、增 260、删 4 个文件次。
- `apps/desktop/src/`：现有 85 个文件；19 次发布里有 8 次动过它；累计改 58、增 25、删 1 个文件次。
- `apps/desktop/scripts/`：现有 195 个文件；19 次发布里有 9 次动过它；累计改 127、增 69、删 2 个文件次。
- `apps/desktop-host/`：现有 17 个文件；19 次发布里有 19 次动过它；累计改 37、增 8、删 4 个文件次。
- `apps/cli/src/`：现有 10 个文件；19 次发布里有 5 次动过它；累计改 11、增 1、删 0 个文件次。
- `packages/bundle/web-app/`：现有 39 个文件；19 次发布里有 19 次动过它；累计改 85、增 20、删 1 个文件次。
- `packages/client/connection/src/`：现有 18 个文件；19 次发布里有 3 次动过它；累计改 12、增 3、删 1 个文件次。

按小版本线跳：

- 0.1.7-rc.2 → 0.2.0-rc.2：`apps/desktop/` 改 59 增 35 删 0；`apps/desktop/src/` 改 15 增 6 删 0；`apps/desktop/scripts/` 改 8 增 5 删 0；`apps/desktop-host/` 改 3 增 2 删 0；`apps/cli/src/` 改 3 增 0 删 0；`packages/bundle/web-app/` 改 5 增 1 删 0；`packages/client/connection/src/` 改 0 增 0 删 0
- 0.2.0-rc.2 → 0.2.1-rc.5：`apps/desktop/` 改 78 增 96 删 0；`apps/desktop/src/` 改 5 增 2 删 0；`apps/desktop/scripts/` 改 30 增 38 删 0；`apps/desktop-host/` 改 9 增 0 删 0；`apps/cli/src/` 改 4 增 0 删 0；`packages/bundle/web-app/` 改 16 增 6 删 1；`packages/client/connection/src/` 改 7 增 3 删 1
- 0.2.1-rc.5 → 0.2.2-rc.5：`apps/desktop/` 改 203 增 127 删 2；`apps/desktop/src/` 改 23 增 17 删 1；`apps/desktop/scripts/` 改 56 增 24 删 0；`apps/desktop-host/` 改 5 增 6 删 4；`apps/cli/src/` 改 2 增 1 删 0；`packages/bundle/web-app/` 改 10 增 13 删 0；`packages/client/connection/src/` 改 1 增 0 删 0
