# 匠心工业智能体平台 · 客户端（桌面壳）

一个薄的 Electron 壳的原型，用来验证「薄壳」这条路线，还没有发布过。桌面客户端最后走薄壳还是从源码构建上游的桌面壳，没有定（提议走薄壳，见下面「两条路线」和 [2026-11-20 产品裁定](../../docs/decisions/2026-11-20-product.md)第 3 节）。

## 这是什么

壳做四件事：

1. 从发行目录启动已发布的 DSH `0.2.2-rc.5`（Web 模式，只听 `127.0.0.1:3182`，不自动开浏览器）；
2. 等 DSH 打印就绪行，用里面的令牌换一个认证 cookie，cookie 只放在主进程的内存里；
3. 开一个窗口装载 DSH 的 Web 界面，窗口发往本机 DSH 的请求由壳附上这个 cookie；
4. 退出时把 DSH 停干净。

壳这一层管应用名、图标、窗口、菜单、右键菜单、关于、版本号。界面里面的名称和 logo（侧栏、首页、网页标题）由品牌包换（`packages/brand-theme/`），它装在发行目录里。

有意不做的事：不登记 `dsh://` 或任何协议，不设开机启动，不做自动更新，不往系统路径装命令行，不登录任何账号，不发产品分析。

## 目录

```
apps/desktop/
  src/                  壳的源码（主进程、预加载、关于窗口、启动页）
  scripts/              准备、启动、打包、清理、验证用的脚本
  tests/                单元测试（版本号规则、隔离规则、右键菜单、残留进程的识别）和自检用的界面操作脚本
  assets/ build/        图标，由 scripts/make-icons.sh 从 brand/source/icon-1024.png 生成，入库
  docs/                 对上游桌面壳的只读盘点（换品牌的改动面、独有功能、改动频率）
  electron-builder.yml  打包配置
  runtime/              随包的发行目录，由 scripts/install-runtime.sh 从 distribution/ 同步生成，不入库
  release/              构建产物，不入库
  .dev/                 本机状态、缓存、日志、截图，不入库
```

## 前提

- macOS，Apple 芯片。
- 本机有 Node 和 npm，只用来装依赖、跑脚本和测试。应用运行时不用它：DSH 是用 Electron 自带的 Node 跑的。
- 能访问 npm 源（装 Electron、electron-builder 和 DSH 时要下载）。

## 第一次准备

都在 `apps/desktop/` 下执行。先 `source scripts/env.sh`：它把 npm、Electron、electron-builder 的缓存都圈在 `.dev/cache/` 里，不往 `~/.npm` 和 `~/Library/Caches` 写（bash、zsh 都可以 source）。

```bash
source scripts/env.sh
```

```bash
npm ci
```

```bash
node node_modules/electron/install.js
```

```bash
npm run runtime:install
```

```bash
npm run icons
```

说明：

- `node node_modules/electron/install.js` 这一步不能省。npm 11 默认不跑依赖包的安装脚本，Electron 44 的 npm 包也不再自带安装脚本，不手动跑就没有 Electron 的可执行文件。
- `npm run runtime:install` 从 `distribution/` 同步清单、锁文件、补丁、插件包 tarball 和启动前检查到 `runtime/`，再按锁文件装钉死版本的 DSH（约 1.3 GB，要几分钟）。npm 会提示有几个包的安装脚本没跑，在 macOS arm64 上不影响使用，原因见 `distribution/README.md` 的「安装」。
- 图标已经生成好入库了，换了 logo 才要重跑 `npm run icons`。

## 开发启动

```bash
npm run dev
```

第一次会把 `node_modules` 里的 Electron.app 克隆一份到 `.dev/dev-app/匠心工业智能体平台.app`，换上自己的 bundle id（`cn.jiangxin.agent.desktop.dev`）、名称和图标，再用它跑 `src/main.js`。这样开发时的进程身份也是我们自己的，不和别的 Electron 开发共用 `com.github.Electron`。

没注入版本号时，关于里显示「本地开发」。

## 打包

只出 macOS arm64 的应用包：不签名、不公证、不出安装镜像、不发布、不拷进 `/Applications`。

```bash
npm run pack:mac -- 2026.11.20-beta.1
```

产物是 `release/mac-arm64/匠心工业智能体平台.app`（约 1.6 GB，其中发行目录占 1.3 GB）。从构建目录直接运行：

```bash
npm run start:built
```

脚本实际执行的是 `electron-builder --mac --arm64 --dir --publish never --config.extraMetadata.version=<版本号>`，再加两项只属于本机构建的元数据（见「状态目录与隔离」）。打包时：

- 先从 `distribution/` 同步并重装 `runtime/`（`JX_PACK_SKIP_RUNTIME_SYNC=1` 跳过），再跑 `runtime/bin/jx-preflight.mjs`，查不过不打；
- 用本地 `node_modules/electron/dist`，不另下 Electron；
- `scripts/after-pack.js` 把发行目录整个放进 `Contents/Resources/runtime`，把 DSH、Electron、Chromium 的许可文件放进 `Contents/Resources/licenses`，去掉 Electron 自带的示例应用和用不到的权限用途说明；
- 不写 `CFBundleURLTypes`（不声明任何协议），不带更新配置。

应用包里 1.3 GB 的发行目录里，有 LibreOffice 的原生引擎和 WASM 版各一份（加起来约 300 MB），还有别的平台用不到的东西，正式发布前要按平台裁剪。DSH 依赖的几百个 npm 包各自的许可还没有汇总，正式发布前要做。

## 版本号

规则见 [2026-11-20 产品裁定](../../docs/decisions/2026-11-20-product.md) P40。桌面端写不带 `v` 的形式：

| 形式 | 含义 | 例子 |
|---|---|---|
| `YYYY.M.D` | 正式版 | `2026.11.20` |
| `YYYY.M.D-N` | 当天正式版之后的补丁版 | `2026.11.20-1` |
| `YYYY.M.D-beta.N` | 测试版 | `2026.11.20-beta.1` |

- 月和日不补零。校验式（同时校验月日范围）：`^[0-9]{4}\.([1-9]|1[0-2])\.([1-9]|[12][0-9]|3[01])(-([1-9][0-9]*|beta\.[1-9][0-9]*))?$`。不合规的版本号 `pack-mac.sh` 直接拒绝；带 `v` 的会去掉 `v` 再校验。
- 打包时用 `--config.extraMetadata.version=<版本号>` 注入，界面上的版本取 `app.getVersion()`。
- `package.json` 里的 `0.0.0` 是包自己的内部版本号，永远过不了校验式，所以不带版本号打包时关于里显示「本地开发」，不会拿 `0.0.0` 顶替。
- 带 `-beta.` 的显示「测试版」标记。
- 比较新旧要按规则自己比：同一天里 `beta.N` 小于正式版，正式版小于 `-N`。按语义化版本的排序，`2026.11.20-1` 反而排在 `2026.11.20` 前面，所以不能用语义化版本的比较。以后做自动更新时用 `src/version.js` 里的比较函数。
- 关于窗口显示：产品版本、「基于 DSH 0.2.2-rc.5 构建」（读的是发行目录里实际装的版本）、DSH 的 MIT 许可全文、Electron、Chromium、Node 的版本。
- 产品版本号也作为 `JX_PRODUCT_VERSION`（带 `v`）交给 DSH，品牌包显示的是同一个版本；没注入时不设。

## 发行目录

「发行目录」是一个约定：一个目录，里面有 `package.json`（精确依赖 `@deepseek-ai/dsh`）、装好的 `node_modules`，和 `patches/`（要叠加的配置补丁，按文件名顺序）。壳只认这个约定，不关心里面配了什么。仓库里的那一份是 [`distribution/`](../../distribution/README.md)。

- 默认用 `runtime/`。它不单独维护：`scripts/install-runtime.sh` 每次从 `distribution/` 同步，再按锁文件装依赖，所以 Web 端和客户端是同一份 DSH、同一组补丁、同一个品牌包。`runtime/` 下除 `node_modules` 以外都是同步来的，不要手改。
- 运行时换一个：设 `JX_DISTRIBUTION_DIR=<绝对路径>`。
- 打包时换一个打进包里：设 `JX_PACK_DISTRIBUTION_DIR=<绝对路径>`（这时不同步，但照样要过启动前检查）。
- 壳会校验：`package.json` 里的 DSH 是精确版本，装的版本和钉的一致，不一致就不启动。
- DSH 在标准错误里报告没加载我们自己的插件（`jx-` 开头的行、`@jx/` 开头的包：版本对不上或找不到包）时，壳当成启动失败，停掉 DSH、显示失败页，不会带着 DSH 的品牌打开窗口（`src/host.js` 的 `OWN_PLUGIN_NOT_LOADED`）。

壳启动 DSH 时的补丁顺序：发行目录 `patches/` 下的文件按文件名排序，最后加一个壳自己生成的 `zz-desktop-shell.yml`。它只改一个键：`workspace-controller` 的 `documentsDirectory`，指到状态目录下。发行目录的补丁 15 改的是同一个键，壳的排在最后，以壳的为准。

发行目录的补丁要从环境变量取值时（比如模型网关地址 `JX_MODEL_BASE_URL`），名字以 `JX_` 开头的变量原样传给 DSH；壳自己的开关（`JX_DESKTOP_*`、`JX_DISTRIBUTION_DIR`、`JX_PACK_*`）不传。别的变量默认不传，要传就用 `JX_DESKTOP_PASS_ENV` 点名。

## 壳认的开关

环境变量，或者同名的命令行开关（`JX_DESKTOP_SHOW=0` 等于 `--jx-show=0`，`JX_DISTRIBUTION_DIR` 等于 `--jx-distribution-dir=`）。

| 环境变量 | 作用 |
|---|---|
| `JX_DISTRIBUTION_DIR` | 换一个发行目录 |
| `JX_DESKTOP_STATE_DIR` | 本机状态的根目录（见下） |
| `JX_DESKTOP_PORT` | DSH 的监听端口，默认 3182 |
| `JX_DESKTOP_HOST_NODE` | 用外部的 Node 跑 DSH（给 node 的绝对路径，要求 ≥ 24.9）。默认用 Electron 自带的 Node |
| `JX_DESKTOP_PASS_ENV` | 额外传给 DSH 进程的环境变量名，逗号分隔 |
| `JX_DESKTOP_SHOW` | `0`：窗口全程不显示，也不在程序坞里出现；`inactive`：显示但不抢焦点；其他：正常显示 |
| `JX_DESKTOP_SELFTEST` | 自检：给一个绝对路径的目录，壳启动后截图、写 `selftest.json`，然后退出 |
| `JX_DESKTOP_SELFTEST_STEPS` | 自检时额外跑的界面操作脚本（绝对路径）。只在开发启动和本机构建里生效 |
| `JX_DESKTOP_BLOCK_EXTERNAL` | `1`：窗口发往本机 DSH 以外的请求一律拦下（默认只记到 `logs/window-egress.log`，不拦） |
| `JX_DESKTOP_REMOTE_DEBUG_PORT` | 渲染进程的远程调试端口。9222、9229、9230 会被拒绝（留给用户自己的 DSH），可以用 9322 |
| `JX_DESKTOP_TITLEBAR` | `hiddenInset`：隐藏标题栏的实验开关。已知不能用：页面里没有可拖动区域，窗口拖不动，红绿灯会压住侧栏左上角 |

## 状态目录与隔离

壳的全部本机状态都在一个根目录下，默认是 `apps/desktop/.dev/`：

| 子目录 | 内容 |
|---|---|
| `dsh-home/` | DSH 的状态目录（启动时显式设成 `DSH_HOME`） |
| `agents-home/` | 显式设成 `DSH_AGENTS_HOME`（不设的话 DSH 用 `~/.agents`） |
| `electron-user-data/` | Electron 的用户数据、会话数据、崩溃转储；单实例锁也跟着它 |
| `documents/` | DSH 默认工作区的位置（不设的话 DSH 会建 `~/Documents/deepseek-harness/default-workspace`） |
| `host-cwd/` | DSH 进程的工作目录（DSH 会读工作目录下的 `.env`，所以给它一个自己管的空目录） |
| `generated/` | 壳生成的配置补丁 |
| `run/` | DSH 进程的记录文件（下次启动时用来清理上次没停干净的进程） |
| `logs/` | `desktop-shell.log`、`dsh-host.log`、`window-egress.log` |
| `screenshots/` | 自检的截图和结果 |

根目录怎么定：

1. 设了 `JX_DESKTOP_STATE_DIR` 就用它；
2. 开发启动用 `apps/desktop/.dev`；
3. 打好的包用打包时写进去的目录。`pack-mac.sh` 打的是本机构建，会把 `apps/desktop/.dev` 的绝对路径写进包里，所以在访达里双击也是用这个目录；
4. 打好的包里既没写、环境变量也没给时，**拒绝启动**并报错，不会退回系统默认位置。正式构建的状态放在哪里还没定，建议放在 `~/Library/Application Support/` 下以 bundle id 命名的目录里，不用 `~/.dsh`。

另外几条隔离规则（`src/state.js`、`src/launch.js`，测试在 `tests/isolation.test.js`）：

- 状态根目录如果落在 `~/.dsh`、`~/.agents`、`~/Documents/deepseek-harness`、上游桌面版的应用数据目录之内，拒绝启动；
- 传给 DSH 进程的环境变量走白名单，不把壳所在终端的整个环境交出去；
- 遥测关闭（`DSH_TELEMETRY_DISABLED=1`、`DSH_TELEMETRY_MODE=DISABLED`）；npm 源默认指向一个连不上的本机地址（`JX_NPM_REGISTRY` 可改），DSH 不会自己去装东西；
- 用自己的 bundle id（`cn.jiangxin.agent.desktop.dev`，开发启动也用它），不声明、不登记任何协议，不往系统路径装东西；
- 窗口里的外链交给系统浏览器，不开新的 Electron 窗口；页面跳转只留在本机。

`cn.jiangxin.agent.desktop.dev` 和写进包里的 `.dev` 路径只属于本机构建；正式的 bundle id、签名和公证都没定。

## 凭据交接

上游桌面壳的做法是：私有的宿主进程通过进程间通信把带令牌的地址报给主进程；主进程自己用它换 cookie、只留在内存里；界面从自定义协议装载，HTTP 由主进程带着 cookie 转发，WebSocket 由请求钩子附上 cookie。薄壳用不了私有宿主，对应的做法是：

1. 已发布的 `dsh` 启动后在标准输出打印 `dsh web: http://127.0.0.1:3182/?token=<令牌>`。上游把这一行定义成给上层程序看的就绪信号。标准输出是壳和子进程之间的私有管道，令牌只进壳的内存。
2. 主进程用这个地址请求一次，拿到 `303` 和 `Set-Cookie: dsh-auth-…`。
3. cookie 只放在主进程的变量里，不进浏览器的 cookie 存储。窗口发往 `127.0.0.1:3182` 的 HTTP 和 WebSocket 请求，由请求钩子附上它（先按主机过滤，进回调后再精确比对主机和端口）。
4. 窗口装载的是不带令牌的干净地址。

结果：页面的地址里没有令牌，页面脚本读不到 cookie，浏览器的 cookie 存储里没有它，磁盘上没有凭据。写日志之前先把令牌和 cookie 的值替换成「已隐去」（`src/host.js` 的 `redact`）。前三点每次自检都查。

壳被强杀时留下的 DSH 进程，下次启动时按记录认出来并清掉：要同时对上进程号、系统记的启动时间、命令行里入口文件路径的英文部分。注意 `ps` 在 C 语言环境下会把路径里的中文转义掉，所以不能拿带中文应用名的完整路径去比（`src/host.js` 的 `isOurHostProcess`，测试在 `tests/host-process.test.js`）。

## 用 Electron 自带的 Node 跑 DSH

`ELECTRON_RUN_AS_NODE=1` 加 `--expose-internals`。后者不能省：DSH 的加载器要用 Node 内部的模块加载器，在 Electron 里只有加这个参数才拿得到；上游桌面壳也是这么跑的。Electron 44.11.5 内置 Node 24.22.3，满足 DSH 要求的 ≥ 24.9。好处是应用不依赖用户机器上装没装 Node：从访达启动时没有终端的环境，找不到系统里的 Node。也可以用 `JX_DESKTOP_HOST_NODE` 换成外部的 Node。

从程序坞或访达启动时 `PATH` 很短，壳给 DSH 的子进程补上 Homebrew 和系统的常见路径，智能体的命令行工具才找得到系统里的程序。上游的完整做法是用登录 shell 跑一次 `env`，薄壳还没做。

## 验证

```bash
npm test
```

单元测试：版本号规则、隔离规则、右键菜单、残留进程的识别、没加载自己插件时的告警识别。不需要先装依赖，也不需要 `runtime/`。

```bash
npm run smoke
```

不开窗口的冒烟（要先准备好 `runtime/`）：启动 DSH、等就绪、换 cookie、不带 cookie 应得 401、带 cookie 应得 200、日志里没有令牌和 cookie、能停掉、端口释放；端口被占时报「端口 3182 已经被别的程序占用」，不去动占着端口的程序。

自检（窗口全程不显示，不打扰人）。开发启动：

```bash
JX_DESKTOP_SHOW=0 JX_DESKTOP_SELFTEST="$PWD/.dev/screenshots/dev" bash scripts/dev.sh
```

构建产物：

```bash
JX_DESKTOP_SHOW=0 JX_DESKTOP_SELFTEST="$PWD/.dev/screenshots/built-first-run" bash scripts/run-built.sh
```

自检会截主窗口和关于窗口的图，在 `selftest.json` 里记一份事实和检查结果（窗口标题、页面地址里没有令牌、页面读不到认证 cookie、浏览器的 cookie 存储里没有它、只装载了本机资源、关于里的名称、版本、「基于 DSH … 构建」、MIT 声明），全部通过时退出码为 0。

带模型的整条链路（在窗口里发一条消息、等回复，顺带检查输入框的右键菜单）要用仓库的发行目录和本机假模型。先起假模型（端口用 3192，和 Web 端的 3190 错开）：

```bash
MOCK_MODEL_PORT=3192 node ../../tools/mock-model/server.mjs
```

再另开一个终端跑自检：

```bash
JX_DISTRIBUTION_DIR="$(cd ../../distribution && pwd)" JX_MODEL_BASE_URL=http://127.0.0.1:3192/v1 JX_MODEL_API_KEY=jx-local-mock-key-not-a-secret JX_DESKTOP_SHOW=0 JX_DESKTOP_SELFTEST="$PWD/.dev/screenshots/built-chat" JX_DESKTOP_SELFTEST_STEPS="$PWD/tests/steps/chat-roundtrip.js" bash scripts/run-built.sh
```

`JX_MODEL_API_KEY` 的值是约定的假值，不是密钥。跑完把假模型停掉（Ctrl-C）。

还没试过的：电脑操作、Office 相关能力、「用别的应用打开」在薄壳里好不好用（它们都在 DSH 这一侧，`dsh web` 一样带着）；人工把应用完整走一遍；签名、公证，以及拷到别的机器上运行。

和上游源码有关的两个检查：

```bash
bash scripts/check-patches.sh
```

仓库根下 `patches/` 里的补丁还能不能干净地打到钉死的上游源码上。要先把 DSH 的源码按标签 `dsh-v0.2.2-rc.5` 检出到仓库根的 `upstream/dsh-ref`（不入库），或者把源码目录作为参数传进去；脚本只读，不改源码。

```bash
node scripts/upstream-churn.mjs
```

上游在我们关心的那些文件上改得多不多。它从 GitHub 按标签下载指定文件的各个版本来比对（只下载、不执行），结果在 `.dev/upstream-history/churn.md`。

## 两条路线

桌面客户端有两条路，选哪条没有定：

- **甲：薄壳。** 自己写一个薄的 Electron 壳，里面跑 npm 上已发布的 `dsh`，窗口里装它的 Web 界面。就是这个目录。
- **乙：从源码构建上游桌面壳。** 上游的桌面壳（`@deepseek-ai/dsh-desktop`、`@deepseek-ai/dsh-desktop-host`）没有发布到 npm，只在它的源码仓库里，要从钉死的源码自己构建，用补丁换品牌、关掉账号登录和外联。

| | 甲：薄壳 | 乙：从源码构建上游桌面壳 |
|---|---|---|
| 改上游源码 | 不改 | 最小的一组约 25 个补丁文件、125～130 行，落在 11 个代码文件和 3 个资源文件上；连 Windows、签名、发布链路一起约 60 个文件、265～290 行 |
| DSH 从哪来 | npm 上发布的包，和 Web 端同一份 | 自己从源码构建，要维护一条源码构建和打包的流水线 |
| 和发行目录的约定 | 直接对上 | 上游私有宿主启动 profile 时写死了 `patchFiles: []`，要补丁才能接 |
| 和用户自己装的上游桌面版共存 | 已经隔开 | `~/.dsh`、用户数据目录名、`dsh://`、`/usr/local/bin/dsh` 四处都要补丁才隔得开 |
| 版本号 | 直接用日历版本号 | 上游要求桌面版本号续写 DSH 的版本号，要补丁放开 |
| 外观 | 标准窗口装网页 | 原生外观（隐藏标题栏、毛玻璃） |
| 依赖的上游面 | 13 个点：公开的命令行参数、环境变量、就绪行、令牌换 cookie、一个配置键 | 整个私有的桌面壳，它的变化不进升级指南 |
| 升级时断的概率（按 2026-09-24 到 11-18 的 20 个版本） | 这 13 个点一个都没断过 | 按小版本线算的 3 次升级里，打包配置的补丁落点断了 2～3 次（应用名 2 次，麦克风说明 3 次）；`0.2.2` 这条线把界面语言从 2 种加到 8 种，文案补丁要整个重做 |
| 每次升级 DSH 的工夫（两边都是推断，不是实测） | 半天以内：改版本、重装、跑测试和自检、看升级指南里有没有碰 `dsh web` 的条目、重新打包 | 一到三天：换源码、逐个核对补丁、检查新增的文案和外联、全仓库构建与打包，另有一条构建流水线要长期维护 |

建议第一版走甲，三条理由：甲不改上游，依赖的面小而且稳；乙和我们的约定处处对不上，每一处都要补丁；乙多出来的功能里有 8 项第一版用不上或者本来就要关掉（欢迎窗口、上游账号登录、平台用量页、强制更新、产品分析、命令行安装、`dsh://`、设备信息）。

甲的代价：外观是「浏览器页面装在标准窗口里」；界面不知道自己在桌面壳里，目录选择、文件拖放、下载、快捷键走的是浏览器那一套；原生能力要自己补。界面认桌面环境，靠的是上游预加载脚本打的 `<html data-platform>` 标记和注入的 `dshDesktop` 对象，都是私有约定，而且互相牵连（只补 `data-platform`，快捷键服务会在启动时报错），所以薄壳不去冒充桌面环境。

乙里有价值而甲现在没有的，可以按需要在薄壳里一样一样补：

| 功能 | 薄壳现在 | 补的时候要注意 |
|---|---|---|
| 退出前问有没有任务在跑 | 没有，⌘Q 直接停 | 上游走的是私有的进程间通信，`dsh web` 没有对应的接口。可以先做成「退出前总是确认一次」 |
| 读登录 shell 的环境 | 只补了常见路径 | 上游用登录 shell 跑一次 `env` |
| 下载 | 没有专门处理 | 界面里的下载靠 `<a download>`，在壳里会走 Electron 的下载流程，要验证 |
| 目录选择框附着在窗口上、拖入文件夹、菜单跟随界面语言 | 走浏览器的行为 | 可以借用上游的页面全局 `__DSH_DIRECTORY_PICKER__`、`__DSH_HOST_PATHS__`、`__DSH_LOCALE__`，都是私有约定，升级时要自己盯 |
| 隐藏标题栏加毛玻璃的外观 | 系统标准标题栏 | 要 `data-platform` 标记，连带要键盘桥 |
| 随包的 Python 和常用库 | 用用户机器上的 Python | 做 Office 和数据处理的场景会需要；相关配置行还按 profile 名关着，要用补丁打开 |
| 插件管理用的 pnpm | 要求 `PATH` 上有 `pnpm` | 现在 npm 源指向连不上的地址，装插件本来就是关的；接自己的插件源时要随包带 pnpm |
| 端口 | 固定 3182，界面的本地设置按来源（含端口）存 | 要么被占时换端口（本地设置会丢），要么照上游用自定义协议装载界面、HTTP 由主进程转发、端口交给系统 |
| cookie 过期 | 过期以后要重新换，这段逻辑没写 | |
| DSH 运行中崩溃 | 只显示失败页 | 可以自动重启 |
| 自动更新 | 手动装新版 | 版本比较用 `src/version.js` 里的函数 |
| Windows | 只做了 macOS | 代码里留了平台分支，没有测过 |

什么时候回头看乙：上游把桌面壳发布成包，或者给它加了换品牌的配置（产品名抽成常量、协议名可配、配置补丁能传进去）；或者产品明确要求原生外观和几样桌面独有的功能，而且在薄壳里补的成本超过了维护补丁的成本。

更细的盘点在 `docs/`：[换品牌的改动面](docs/upstream-rebrand-surface.md)（118 条，带文件和行号）、[上游桌面壳独有的功能](docs/desktop-only-features.md)（38 项）、[上游改动频率](docs/upstream-churn.md)。仓库根的 `patches/` 里有两个乙用的样例补丁。

## 接触面

薄壳碰到的 DSH 的命令行、HTTP、环境变量、配置键和文件，列在 [`distribution/docs/touchpoints.md`](../../distribution/docs/touchpoints.md) 第 3 节。升级 DSH 时：

1. 改 `distribution/package.json` 里的精确版本（见 `distribution/README.md` 的「升级 DSH」），`npm run runtime:install`。
2. `npm test`、`npm run smoke`、自检（含对话那一条）。启动参数、就绪行、换 cookie 由冒烟和自检直接检查。
3. 看新版本的升级指南里有没有碰 `dsh web` 的参数、就绪行、认证、profile 和补丁叠加、`DSH_HOME` 的条目。
4. 重新打包。

自检里按界面文案找元素的那几行（「继续」「发送消息」）在上游改文案时要跟着改，它们只在测试里。

## 清理

```bash
npm run clean
```

不带参数只列出可清的东西。要清就点名：

```bash
npm run clean -- --state
```

```bash
npm run clean -- --build
```

```bash
npm run clean -- --cache
```

```bash
npm run clean -- --system
```

```bash
npm run clean -- --all
```

- `--state`：`.dev/` 下的状态、日志、截图；
- `--build`：`release/` 和开发用的应用包；
- `--cache`：下载缓存；
- `--system`：系统替这个 bundle id 自动建的条目，并从启动服务里注销两个应用包。

系统自动建的条目都以 `cn.jiangxin.agent.desktop.dev` 命名，`--system` 做的就是下面几条：

```bash
defaults delete cn.jiangxin.agent.desktop.dev
```

```bash
rm -rf ~/Library/Preferences/cn.jiangxin.agent.desktop.dev.plist ~/Library/"Saved Application State"/cn.jiangxin.agent.desktop.dev.savedState ~/Library/Caches/cn.jiangxin.agent.desktop.dev ~/Library/HTTPStorages/cn.jiangxin.agent.desktop.dev ~/Library/HTTPStorages/cn.jiangxin.agent.desktop.dev.binarycookies ~/Library/WebKit/cn.jiangxin.agent.desktop.dev
```

```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -u "$PWD/release/mac-arm64/匠心工业智能体平台.app"
```

清理脚本只认 `cn.jiangxin.agent.desktop.dev` 这一个名字，不碰机器上名字相近的别的条目。

要把这个原型从机器上彻底去掉：先 `npm run clean -- --all`，再删掉 `apps/desktop/node_modules` 和 `apps/desktop/runtime/`。它没有往别处装过东西。
