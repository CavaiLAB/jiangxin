# 发行目录

匠心工业智能体平台的发行目录。Web 端（`apps/web/`）和客户端（`apps/desktop/`）都从这里启动 DSH，所以两端跑的是同一份 DSH、同一组补丁、同一个品牌包。

| 路径 | 是什么 |
|---|---|
| `package.json`、`package-lock.json` | 精确依赖 `@deepseek-ai/dsh@0.2.2-rc.5`，加上要装的插件包（`file:vendor/*.tgz`） |
| `.npmrc` | 依赖写精确版本；关掉 npm 的资助提示、审计与更新提示 |
| `vendor/` | 品牌包和插件样板的 tarball，由 `scripts/vendor-packages.sh` 从 `packages/` 生成，入库 |
| `patches/` | 配置补丁，按文件名顺序叠在 DSH 配置的最上层 |
| `bin/jx-dsh` | 启动器 |
| `bin/jx-preflight.mjs` | 启动前检查 |
| `scripts/vendor-packages.sh` | 把 `packages/` 下的插件包构建、打包、装进来，再把它们的补丁抄进 `patches/` |
| `tests/settings-lock.mjs` | 设置锁定验证：补丁放在 DSH 配置的哪一层，界面上才改不动 |
| [`docs/dsh-facts.md`](docs/dsh-facts.md) | 核对过的 DSH 事实，带出处 |
| [`docs/touchpoints.md`](docs/touchpoints.md) | 接触面：我们的代码碰到的 DSH 接口、配置行、环境变量和文件 |

做法上守三条：DSH 的源码不改，我们的东西只有自己写的插件包和配置补丁；DSH 的版本钉死，不写范围；要锁住的设置一律放 `patches/`。

## 安装

前提：Node ≥ 24.9。

```bash
npm ci --ignore-scripts
```

```bash
node bin/jx-preflight.mjs
```

`--ignore-scripts` 是有意的：npm 11 默认也不跑依赖的安装脚本。DSH 依赖里的原生模块（`node-pty`、`koffi`）在 macOS arm64 和 Linux arm64 上自带预编译产物，不跑脚本也能加载；换平台（Linux x64、Windows）要重新核，尤其是 `node-pty` 的 `spawn-helper` 有没有可执行位。装完的 `node_modules` 约 1.3 GB。

## 启动器

一般不直接用：Web 端用 `apps/web/start.sh`，客户端用桌面壳。直接用时：

```bash
bin/jx-dsh --profile web --host 127.0.0.1 --port 3180 --no-open
```

第一个参数必须是 `--profile <名字>`，其余原样交给 `dsh`。它做的事：

- 用本目录的 `node_modules/.bin/dsh`。
- 显式设 `DSH_HOME`（默认 `.dev/home`）和 `DSH_AGENTS_HOME`（默认 `.dev/agents-home`），拒绝指向 `~/.dsh`、`~/.agents`：那是这台机器上用户自己那份 DSH 的状态。
- 把 `patches/*.yml` 按文件名排序，逐个作为 `--patch` 叠在最上层；`JX_EXTRA_PATCHES`（冒号分隔）里的文件再叠在后面。
- 设外联相关的环境变量：`DSH_TELEMETRY_MODE=DISABLED`、`JX_NPM_REGISTRY`、`npm_config_registry`、`npm_config_update_notifier=false`、`NO_UPDATE_NOTIFIER=1`，在 `NODE_OPTIONS` 里加 `--report-exclude-network`（原因见「外联」）。
- 校验并导出产品版本号，见「版本号」。
- 每次启动前先跑启动前检查（`--dump-config` 时不跑）。
- 启动前把发行目录、两个状态目录、工作目录和完整命令打到标准错误。

看合成后的配置，每一行注明来自哪一层：

```bash
bin/jx-dsh --profile web --dump-config
```

用的是 DSH 自带的 `web` profile（建在我们自己的 `DSH_HOME` 下），差异全在 `--patch` 层。profile 名会出现在发给模型网关的 User-Agent 里（`dsh-profile/web`）。`desktop` 这个名字被 DSH 的命令行拒绝，它留给 DSH 自己的桌面壳。

| 环境变量 | 默认 | 作用 |
|---|---|---|
| `JX_DISTRIBUTION_DIR` | 启动器所在的发行目录 | 指向别的发行目录 |
| `DSH_HOME`、`DSH_AGENTS_HOME` | `.dev/home`、`.dev/agents-home` | 状态目录 |
| `JX_DOCUMENTS_DIR` | `$DSH_HOME/documents` | 默认工作区的上级目录（补丁 15） |
| `JX_MODEL_BASE_URL` | `http://127.0.0.1:3190/v1`，即本机假模型 | 模型网关地址（补丁 10） |
| `JX_MODEL_API_KEY` | 不设 | 模型网关的密钥（补丁 10）。本机假模型不校验，脚本给一个假值 |
| `JX_NPM_REGISTRY` | `http://127.0.0.1:9/` | 插件管理器和 pnpm 用的 npm 源。默认指向本机不监听的端口：装插件会失败，但不会外联（补丁 60） |
| `JX_PRODUCT_VERSION`、`JX_PRODUCT_COMMIT` | 不设，显示「本地开发」 | 产品版本号与构建的提交 |
| `JX_EXTRA_PATCHES` | 不设 | 额外的补丁文件，冒号分隔，叠在 `patches/` 之后 |
| `JX_SKIP_PREFLIGHT` | 不设 | `1`：跳过启动前检查 |
| `JX_DSH_DRY_RUN` | 不设 | `1`：只打印最终命令，不启动 |
| `JX_WORKBENCH_LATENCY_MS` | `0` | 插件样板每次查台账故意等多少毫秒，只为演示「加载中」（补丁 80） |

## 配置补丁

DSH 的配置是一层层叠出来的，后面的层按行覆盖前面的：

1. profile 引用的各组合包的补丁；
2. profile 自己的 `cordis.patch.yml`；
3. `$DSH_HOME/cordis.patch.yml`（家目录层）；
4. 命令行 `--patch` 的文件，按命令行上的顺序。

写补丁的规则（都实测过）：

- 一行补丁写了 `config`，就把这一行原来的 `config` 整个换掉，不是按键合并。要保留的默认值也得照抄一遍。
- 只写 `disabled: true` 时，这一行原来的 `config` 保留。
- 可以写 `!!js`：`process.env.X`、`dshHomePath('…')` 都能用。变量没设时表达式的值是 `undefined`，所以要写上默认值。
- 补丁里的相对路径按补丁文件所在的位置解析。

**为什么放在 `--patch` 这一层。** 界面上改设置，写的是 profile 层。家目录层和命令行层排在它后面、优先级更高，和它们冲突的界面写入会被拒绝（`settings/rejected`），界面上弹「无法保存设置」；放在组合包层或 profile 层的设置，界面照样改得动。所以要锁住的设置一律放 `patches/`。家目录层也锁得住，但它在实例的状态目录里，随实例走，不适合放发行版的东西。`tests/settings-lock.mjs` 把同一组补丁分别放进四层，用界面同样的写入接口去改，打印一张表（要占用 3180 端口，先停掉 Web 端）。

**我们自己插件的配置。** 字段要用 `.volatile()` 标过，设置界面才能改；挂在 `--patch` 层的行，整行都改不动，标了也没用。所以别在补丁里写用户该能改的默认值：品牌包曾经在补丁里设了默认语言，结果用户切换语言完全没反应。

### 每个补丁

每个文件的开头写着更细的原因，和什么时候可以去掉。

| 文件 | 改哪几行 | 做什么、为什么 |
|---|---|---|
| `10-model-route.yml` | `llm-pi-ai`、`agent-default-model`；关掉 `llm-deepseek`、`llm-deepseek-account` | 模型只走我们指定的 OpenAI 兼容地址：加一个提供方 `jiangxin`，地址取 `JX_MODEL_BASE_URL`，密钥取 `JX_MODEL_API_KEY`，新会话默认用它。关掉 DSH 自带的两条官方模型路由：它们默认连上游的模型接口（推理，外加定时拉模型列表），请求里还带匿名用户标识、会话日志和插件清单 |
| `15-default-workspace.yml` | `workspace-controller` | 默认工作区放进实例自己的目录。DSH 第一次用时会在系统「文稿」目录下建 `deepseek-harness/default-workspace` 并登记，这个位置不跟 `DSH_HOME` 走；在装了 DSH 桌面版的机器上，那正是用户自己那份 DSH 的工作区。这里把上级目录换成 `JX_DOCUMENTS_DIR`（默认 `$DSH_HOME/documents`）。路径里 `deepseek-harness` 那一段是上游写死的，改不了。默认工作区一旦登记就不再挪，改了这个补丁要清掉状态目录才生效 |
| `20-no-deepseek-upload.yml` | `session-log-deepseek`；关掉 `plugin-package-inventory-deepseek` | 不往上游传会话日志和插件清单。上游默认把会话日志（会话 ID、工作目录、到这一刻的全部事件）和已装插件清单，作为字段夹在发往官方模型路由的每个请求里。补丁 10 已经关了官方路由，这里再钉一次，防止以后有人重新打开路由时默认上传 |
| `30-no-telemetry.yml` | `session-telemetry-otel`；关掉 `desktop-product-telemetry`、`product-analytics` | 会话遥测钉成 `DISABLED`（上游默认在用户提交反馈后，把整段会话日志发往上游的收集端），导出地址改成本机不监听的端口；启动器另设 `DSH_TELEMETRY_MODE=DISABLED`。产品分析那两行上游只在 `desktop` profile 下打开，这里无条件关掉 |
| `40-no-deepseek-account.yml` | 关掉 `deepseek-account`、`ui-settings-account`、`ui-account-notifications` | 没有上游账号的登录和通知；侧栏底部直接是「设置」 |
| `50-no-web-tools.yml` | 关掉 `web-search-deepseek`、`web-deepseek-api`、`web-fetch-http`；`web` 清空 | 联网搜索默认走上游的接口，请求里带搜索词和用户最近一句提问的开头；网页抓取会在实例上直接访问模型给的任意网址。关掉以后这两个工具还在模型的工具列表里，调用返回 `WEB_PROVIDER_UNAVAILABLE`；要彻底去掉得重写各预设行，还没做 |
| `60-plugin-registry.yml` | `plugin-manager`、`ui-plugin-manager` | 插件管理器只用 `JX_NPM_REGISTRY`，清空后备的公共镜像；关掉插件页对公共 npm 源的测速。插件详情页读说明文档用的三个 CDN 地址写死在上游包里，配置只能缩成一家、不能清空，所以这一处关不掉 |
| `70-jx-brand-theme.yml` | 关掉 `ui-brand-official`；改写 `system-prompt`；插入 `jx-brand-theme` | 品牌包。由 `scripts/vendor-packages.sh` 从 `packages/brand-theme/cordis.patch.yml` 生成，不要手改 |
| `72-no-dsh-dev-context.yml` | 关掉 `harness-dev-context` | 这一行会把上游的产品名和 DSH 的安装目录写进模型的上下文。DSH 的说明里写明，不想让模型知道这些时关掉它 |
| `74-no-session-log-setting.yml` | 关掉 `ui-settings-session-log` | 去掉设置里已经没有意义的「上传会话日志」开关（补丁 10、20 之后它只显示成锁定） |
| `80-sample-jx-enterprise-workbench.yml` | 插入 `jx-enterprise-workbench` | 企业插件的样板，台账数据是假的。由 `scripts/vendor-packages.sh` 生成。正式发行前删掉这个文件，并从 `package.json` 里去掉 `@jx/enterprise-workbench` |

## 外联

关掉上面这些以后，在不通外网的容器网络里做外联检查（`tests/egress/`）：DSH 实例在那组操作里只连我们指定的模型网关，外加一处，就是用户在插件页点开一个还没装的官方插件的详情时，去 CDN 读说明文档（请求里只有包名和版本）。浏览器一侧不连 DSH 以外的地址。

配置管不住全部外联：插件管理器的一部分操作、智能体执行的命令、用户自己接的 MCP 服务器都会出网，这些本来就是功能。所以部署时每个实例都要有网络层的出站策略，只放行模型网关（允许装插件的话，再加企业内部的 npm 源），DNS 也指向内部。

另外几条：

- Linux 上 DSH 的一个原生模块会调 Node 的诊断报告，诊断报告会对每个已连接的对端做同步的 DNS 反查，把客户端的 IP 交给 DNS 服务器，DNS 不通时还会卡住事件循环。启动器在 `NODE_OPTIONS` 里加的 `--report-exclude-network` 就是关这个的。
- 发往模型网关的请求带着 DSH 的 User-Agent（`deepseek-harness/<版本> (+…) dsh-profile/web`）和 OpenAI SDK 的 `x-stainless-*` 头（操作系统、CPU 架构、Node 版本），配置改不了。
- 关掉会话遥测以后，「提交反馈」的对话框仍然说提交内容会包括对话日志，提交后也显示感谢，其实没有发出去。要么去掉反馈入口，要么把遥测指向我们自己的收集端，还没定。

## 插件包怎么装进来

`scripts/vendor-packages.sh` 做四件事（要 pnpm 和 npm，会联网）：

1. 对 `packages/ui-kit` 做类型检查和单测；对品牌包、插件样板做类型检查、单测、构建。
2. `pnpm pack` 成 tarball，放进 `vendor/`。
3. 改 `package.json` 的依赖指向这些 tarball；先把这几个包从 `node_modules` 和锁文件里拿掉，再 `npm install`。tarball 内容变了而版本号没变时，npm 会认为已经装好，既不重装也不刷新锁文件里的校验值（实测），所以要先拿掉。
4. 核对装出来的是真实目录、版本对得上，再把包里的 `cordis.patch.yml` 抄成 `patches/70-…`、`80-…`，插件行的 `name` 改成相对补丁文件的入口路径。

两条要紧的规则，都是实测踩出来的：

- **插件包的真实目录必须在发行目录的 `node_modules` 里。** `file:` 指向目录的依赖装出来是符号链接，包里的 `import '@deepseek-ai/…'` 会按真实路径往上找，报 `ERR_MODULE_NOT_FOUND`。所以用 tarball 装。
- **补丁里的插件行写相对补丁文件的入口路径，不写包名。** 按包名写的行（`name: '@jx/brand-theme'`），DSH 从 `$DSH_HOME/profiles/<名>/` 往上按 Node 的规则找包，不从 DSH 的安装目录找。状态目录不在发行目录里面时（桌面壳、容器、正式部署都是这样）就报 `ERR_MODULE_NOT_FOUND`，插件不加载，DSH 照常启动。写成包目录也不行：DSH 按 ES 模块导入，报 `ERR_UNSUPPORTED_DIR_IMPORT`。所以写 `'../node_modules/@jx/brand-theme/lib/index.js'`。

这样装的插件不出现在插件页里，用户关不掉，它的配置在设置界面上也改不动。另一种装法是 `dsh plugin --profile <名字> add <目录>`：装进的是某一个实例的状态目录，插件出现在插件页、用户能关，它的补丁在组合包层、界面改得动，只适合开发时试。

### tarball 为什么入库

`vendor/` 下的 tarball 和锁文件一起提交，`npm ci` 直接可用。锁文件给每个 tarball 记了完整性校验值（sha512），`npm ci` 会逐个核对。要是改成构建时现生成，打出来的 tarball 只要和锁文件里记的差一个字节，`npm ci` 就报完整性校验失败；每次都得先刷新锁文件，`npm ci` 也就不再是「按锁文件原样装」了。外联检查的镜像构建和桌面壳的 `runtime/` 同步，也都直接用这两样。

代价是 tarball 是 `packages/` 源码的构建产物，两边可能对不上。所以改了 `packages/` 下的插件包（包括它的 README，README 也打进 tarball），一定要重跑 `scripts/vendor-packages.sh`，把 tarball、`package.json`、锁文件和生成的补丁一起提交。源码不变时，不管在哪个目录重跑，打出来的 tarball 都逐字节相同（CSS 模块的类名哈希按包内的相对路径算，见 `packages/ui-kit/tools/build-plugin.mjs`）；换了机器或工具版本是不是也相同，没有核对过。

## 启动前检查

`bin/jx-preflight.mjs`，大约半秒。

为什么要有：DSH 遇到版本对不上或找不到的插件，不报错，只把那一行停用、在标准错误里打一行告警，照常启动。品牌包被停用时，产品会带着 DSH 自己的品牌起来。而 `--dump-config` 既不导入插件、也不跑版本门禁，插件找不到或 `engines.dsh` 对不上时，合成配置里照样列出那一行，看不出问题。

查四样：

1. 装的 DSH 正好是 `package.json` 里钉的精确版本。
2. 其余依赖都装在 `node_modules` 里、是真实目录，版本和 tarball 文件名里的一致，`engines.dsh` 认这个 DSH。范围按「包含预发布版本」算，和 DSH 自己的算法一样（`0.2.x` 也认 `0.2.2-rc.5`），用的是 DSH 自己依赖的 `semver`。
3. 用一个临时的空状态目录，经启动器跑一次 `--dump-config`：退出码为 0，标准错误里没有停用插件的告警。
4. 补丁里用 `insert` 加的每个 `jx-` 开头的行，都在合成配置里、没有被停用；它的 `name` 是相对补丁文件的路径，指向的文件存在。

```bash
node bin/jx-preflight.mjs [--dist <发行目录>] [--profile <名字>] [--quiet]
```

退出码：0 通过，1 没通过，2 用法错误。启动器每次启动前自动跑，桌面壳打包前也跑；`JX_SKIP_PREFLIGHT=1` 跳过。

## 版本号

产品版本号的规则见[协作约定](../docs/14-governance.md)第 7 节：`vYYYY.M.D`、`vYYYY.M.D-N`、`vYYYY.M.D-beta.N`，月和日不补零。在启动时注入：

```bash
JX_PRODUCT_VERSION=v2026.11.20 JX_PRODUCT_COMMIT=abc1234 apps/web/start.sh
```

启动器用 `^v[0-9]{4}\.([1-9]|1[0-2])\.([1-9]|[12][0-9]|3[01])(-([1-9][0-9]*|beta\.[1-9][0-9]*))?$` 校验，不合格就拒绝启动；没设时 `JX_PRODUCT_VERSION_LABEL` 是「本地开发」。导出给 DSH 进程的有 `JX_PRODUCT_VERSION`、`JX_PRODUCT_VERSION_LABEL`、`JX_PRODUCT_COMMIT`、`JX_DSH_VERSION`，补丁和我们的插件用 `!!js process.env.…` 读。变量名没用 `VITE_APP_VERSION` 这一类：DSH 的界面是预先构建好的，不在我们这里构建。

DSH 界面里原来的版本行（「设置 → 通用」底部的「当前版本：0.2.2-rc.5」）是构建时写死的字面量，配置改不了；品牌包按插槽 id（`settings.general.item` 里的 `current-version`）把这一行换成「匠心工业智能体平台 v…」和「基于 DSH 0.2.2-rc.5 构建」。

## 升级 DSH

DSH 现在发的全是预发布版，节奏很快（2026-08 到 2026-11 三个月发了 41 个版本），近 400 个包统一版本号一起发。一次只升到一条小版本线的最后一个 rc；升之前先读它的升级指南（DSH 源码的 `docs/upgrade-guide/<版本>/`）。

1. 改 `package.json` 里 `@deepseek-ai/dsh` 的精确版本，`npm install --ignore-scripts` 刷新锁文件。`packages/` 下各包的 `engines.dsh` 和 DSH 开发依赖一起改，重跑 `scripts/vendor-packages.sh`。
2. `node bin/jx-preflight.mjs`。
3. 对比升级前后 `bin/jx-dsh --profile web --dump-config` 里补丁碰到的那些行。补丁按行 id 命中，上游改了行 id 或默认值不会报错，只能靠对比发现。整行替换的那几行（`session-telemetry-otel`、`ui-plugin-manager`、`system-prompt`、`workspace-controller`）要看上游有没有多出键来。
4. `node tests/settings-lock.mjs`：锁定的结果和升级前一样。
5. `tests/egress/run.sh`：外联的结论和升级前一样（要 Docker）。
6. 照 [docs/touchpoints.md](docs/touchpoints.md) 逐项核对，尤其是品牌包靠内部结构的那几处（见 `packages/brand-theme/README.md`）。
7. 桌面壳：`apps/desktop/` 下 `npm test`、`npm run smoke`，再重新打包。

## 本机状态

都在 `.dev/` 下，不入库：`.dev/home`（`DSH_HOME`）、`.dev/agents-home`（`DSH_AGENTS_HOME`）、`.dev/workspace`（Web 端 DSH 进程的工作目录）、`.dev/settings-lock/`（设置锁定验证的状态与结果）。重来一遍：停掉服务，删掉 `.dev/home`。
