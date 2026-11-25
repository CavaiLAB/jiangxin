# @jx/enterprise-workbench

企业界面插件的样板：一个在 DSH 仓库之外开发的插件，演示「自己的后端接口 + 自己的界面」怎么接进 DSH。数据是假的，正式发行前要从发行目录里拿掉（见下面「装进发行目录」）。

- **宿主一半**（`src/index.ts`）：提供两个接口，数据是 18 台设备的假台账。
- **浏览器一半**（`src/client/`）：侧栏里加一个「设备台账」入口，点开是一个整页面板，里面是状态筛选、车间／类别／上次保养的快捷筛选、「更多筛选」抽屉、刷新、导出和数据表格。按钮、状态药丸、标签、图标和导出的弹窗用 DSH 的基础组件（`Button`、`Pill`、`Tag`、`Modal`），颜色只用 `--dsw-*` 变量；表格、下拉选择、带搜索的选择器、日期选择、单选组、多行输入和抽屉用 `@jx/ui-kit` 的。导出的弹窗和筛选的抽屉是「`@jx/ui-kit` 的组件放进 DSH 弹窗」的样例。

入口和面板用的是 DSH 自己给「插件」「自动化任务」这类整页功能用的那一对插槽：`sidebar.panellist`（侧栏入口）和 `main`（主区域的页面），两处用同一个面板 id 对上。

对应 DSH 版本：`0.2.2-rc.5`（`engines.dsh` 钉死）。

## 接口

| 方法与路径 | 作用 |
|---|---|
| `POST /api/jx-workbench/equipment/list` | 查台账。请求体 `{ "sort"?: { "columnId", "direction" }, "status"?, "workshop"?, "category"?, "maintainedBefore"?, "minRuntimeHours"?, "ids"? }`，条件之间是「并且」；`maintainedBefore` 是 `YYYY-MM-DD`，上次保养在这天或更早的（没保养过的也算）。返回 `{ rows, total, countByStatus, options, generatedAt }`，`options` 是台账里有的车间和类别，给筛选项用。条件不合法回 400 `{ "error": { "code", "message" } }` |
| `GET /api/jx-workbench/equipment.csv` | 导出 CSV。查询参数和查台账的条件一一对应：`sort=列:方向`，`ids` 用逗号隔开，其余同名；不带参数就是全部。缺省带 BOM（Excel 直接能开），`bom=0` 不带。条件不合法回 400，和查台账一样 |

类型定义在 `src/shared/protocol.ts`，宿主一半和浏览器一半共用。

### 宿主接口的三条路

DSH 给插件开后端接口有三种写法，仓库外的插件现在只能用第一种：

| 做法 | 结果 |
|---|---|
| `ctx.connection.fetch.register({ path, methods, requestBody, fetch })`：精确路径的 HTTP 路由 | **可用**，样板用的就是它。路径必须在 `/api` 下、精确匹配；DSH 自带登录校验，只有实例的主人能访问，没带凭据的请求回 401（实测）。宿主一半只要 `inject = ['connection']` |
| `ctx.connection.rpc.handle('/通道', …)`：通用 RPC 通道 | **在 0.2.2-rc.5 的实际组合里不能用。** 一调用就抛 `cannot get property "webServer" without inject`，调用方在 `inject` 里加上 `webServer` 也没用 |
| `@Remote` 类型化接口（`ctx.remote.xxx`） | **没有试成。** 要在构建时跑 DSH 的代码生成器，生成器假定代码在 DSH 的仓库里 |

RPC 通道报错的原因（读源码得出）：`HostConnectionService.register` 里写的是 `owner.effect(() => owner.webServer.register(route))`。Cordis 解析服务内部 `this.ctx` 上的属性时，按服务的**定义处**（连接插件自己的作用域）判断依赖，而连接插件顶层的 `inject` 只有 `credentials`，`webServer` 只在它内层的 `ctx.inject(['webServer'], …)` 里。DSH 自己的单测能过，是因为测试里 `webServer` 由根上下文提供；DSH 的产品代码里也没有地方用自定义通道（只有 API 网关用 `intercept('/api', …)`，而 `/api` 只允许一个拦截器）。上游修了 `register` 里 `webServer` 的解析以后，可以重新考虑 RPC 通道。

所以现在走精确路径的 HTTP 路由。它没有类型化的客户端，请求和响应的类型要自己在两半之间共享（就是 `src/shared/protocol.ts`）。浏览器访问时，地址相对于 `document.baseURI` 拼（`src/client/index.tsx` 的 `apiUrl`），因为页面可能挂在反向代理的路径前缀下；DSH 自己访问 `api/file` 也是这么写的。

客户端（薄壳）里跑的也是 `dsh web`，接口地址的拼法一样，但没有单独试过这个面板。上游桌面壳的页面地址是 `dsh-app://app/…`，POST 和 CSV 下载都没试过。

## 安装

先构建（要先在 `packages/ui-kit` 里装好依赖，见 [packages/README.md](../README.md)）：

```bash
pnpm install
```

```bash
pnpm run build
```

构建要 `@jx/ui-kit`（开发依赖，链接到 `../ui-kit`）。它是源码库，组件代码在构建时打进 `lib/client.js`，所以**发行目录里不用装 `@jx/ui-kit`**。

### 两种装法

| | 装进配置档（`dsh plugin --profile <名字> add <路径>`） | 装进发行目录（tarball 依赖 + `--patch`） |
|---|---|---|
| 用途 | 开发 | 正式发行 |
| 插件页里 | 出现在「已安装插件」，带开关，**用户能关掉** | 不出现，**用户关不掉** |
| 补丁所在的层 | 组合包层，设置界面改得动 | 命令行层，设置界面改不动 |
| 安装时的版本检查 | 有：`engines.dsh` 不匹配直接拒绝，什么都不装 | 没有：npm、pnpm 不认 `engines.dsh` |
| 启动时的版本检查 | 有：跳过这个包，标准错误里打一行 `skipping profile bundle` | 有：停用这一行，标准错误里打一行 `disabling profile plugin row` |

### 装进发行目录（正式的装法）

这个包已经作为样板装在 [`distribution/`](../../distribution/README.md) 里（补丁文件 `distribution/patches/80-sample-jx-enterprise-workbench.yml`）。正式发行前删掉这个补丁文件，并从 `distribution/package.json` 里去掉 `@jx/enterprise-workbench`。改了这个包，在仓库根目录跑一次：

```bash
distribution/scripts/vendor-packages.sh
```

它负责构建、打 tarball、装进发行目录、把补丁抄进 `patches/`，并把插件行的 `name` 从包名改成相对补丁文件的入口路径。不要直接用包里按包名写的补丁：状态目录不在发行目录里面时，DSH 找不到按包名写的包（原因见 [`packages/brand-theme/README.md`](../brand-theme/README.md) 的「装进发行目录」）。

注意：

- 必须从 tarball 装。`file:` 指向目录的依赖装出来是符号链接，包里对 DSH 模块的引用会解析失败（实测）。
- 不要在包的补丁里写用户该能改的默认值，命令行层会把它锁死。
- tarball 内容变了而版本号没变时，pnpm 和 npm 都会认为没有变化、不重新装，npm 也不刷新锁文件里的完整性校验值（实测）。`vendor-packages.sh` 先把旧的拿掉再装，所以要用它，跑完把 tarball 和锁文件一起提交。

### 装进一个配置档（开发时用）

```bash
dsh plugin --profile <名字> add <这个包的绝对路径>
```

DSH 记成链接，自动套用包里的补丁。改了浏览器一半，重新构建后刷新页面就生效（DSH 按文件修改时间算版本）；改了宿主一半或补丁要重启 DSH。开发用的实例要用自己的状态目录，见 [AGENTS.md](../../AGENTS.md)「组合体的代码」。

### 版本门禁

`engines.dsh` 写的是 DSH 版本范围。在 DSH 0.2.2-rc.5 上实测：

| 情形 | 结果 |
|---|---|
| 装进配置档，`engines.dsh` 不匹配 | 拒绝，退出码 1，提示什么都没装，并给出授予豁免的命令 |
| 装好以后把 `engines.dsh` 改成不匹配，再 `--dump-config` | 退出码 0；标准错误打一行 `skipping profile bundle "<包名>": … incompatible …`；合成配置里没有它的行 |
| 同上，真的启动 | **照常启动**，只多一行告警 |
| `dsh plugin … allow-version … --accept-risk` 授予豁免 | 写进配置档的 `compatibility.json`，之后照常加载；`revoke-version` 撤销后告警回来 |
| 装进发行目录（从 tarball 装）、补丁插一行，`engines.dsh` 不匹配 | 装的时候没有检查；启动时打一行 `disabling profile plugin row "<行 id>": … incompatible …`，插件不加载，DSH 照常启动 |

范围写法：

| 接受 | 拒绝 |
|---|---|
| `0.2.2-rc.5`、`>=0.2.0 <0.3.0`、`>=0.2.2-rc.5 <0.3.0`、`^0.2.2-rc.5`、`~0.2.2-rc.5`、`0.2.x`、`*` | `^0.2.2`、`0.2.2`、`>=0.3.0` |

`0.2.x` 和 `>=0.2.0 <0.3.0` 也接受了 rc 版，说明 DSH 按「包含预发布版本」的规则算（照标准的语义化版本，这两个不匹配 rc）。我们的包都写精确版本。

**要紧的一条**：版本对不上时 DSH 照常启动，只是不加载这个包，只在标准错误里留一行字。所以启动器要自己检查：`distribution/bin/jx-preflight.mjs` 在启动前查合成配置，桌面壳在 DSH 的标准错误里认这两种告警。

### 配置

| 键 | 默认 | 作用 |
|---|---|---|
| `latencyMs` | `0` | 每次查台账故意等多少毫秒，只为演示「加载中」状态。补丁里写成读环境变量 `JX_WORKBENCH_LATENCY_MS` |

## 检查

```bash
pnpm run typecheck && pnpm run test && pnpm run build
```

类型检查分两份配置：`tsconfig.host.json`（宿主一半，Node 环境）和 `tsconfig.client.json`（浏览器一半，DOM 环境）。合成一份会出错：两边都声明了 `ctx.connection`，类型不一样。

单测 19 个，都不依赖 DSH：`tests/ledger.test.ts`（15 个）测台账的查询条件、筛选、排序、导出；`tests/filters.test.ts`（4 个）测浏览器一半怎么把界面上的筛选拼成查询条件。

## 照着写一个新插件

这个包可以当模板。要点：

1. `package.json`：`main` 指宿主一半，`exports["./client"]` 指浏览器一半；`dsh.bundle.patch` 指补丁；`dsh.client.inject` 只列**真正提供服务**的包（它是依赖边，不是说明：列出来的包的工厂要先加载，Cordis 也按这批边组合）；`engines.dsh` 写钉死的版本。
2. 插件页里的名称和说明放 `locale/zh.json`、`locale/en.json`（`{ "meta": { "title", "description" } }`），并在 `exports` 和 `files` 里带上。不放的话插件页显示包名和 `description`。
3. 两半都具名导出 `name`、`inject`、`apply`（宿主一半还有 `Config`），**不要默认导出**，DSH 不认。
4. 一个包两半时要两份 `tsconfig`（见上面「检查」）。浏览器一半拿连接服务要写 `ctx.get('connection')`，类型名 `ctx.connection` 留给了宿主一半。本包改用 `fetch` 访问自己的接口以后没有再用到它。
5. 浏览器访问自己的接口时，地址相对于 `document.baseURI` 拼。
6. `ctx.logger.warn` 在默认组合里没有输出，要让运维看到得写 `console.warn`。
7. 补丁对一行的 `config` 是整行替换，不是合并；只写 `disabled: true` 时原配置保留。
8. DSH 的包全是开发依赖，只为类型，版本钉死 `0.2.2-rc.5`。运行时依赖只有 `@deepseek-ai/schemastery`（写配置的结构），对等依赖 `@deepseek-ai/cordis`。
9. DSH 发布的类型声明引用了一批没写进它们 `dependencies` 的包（`dsh-client-store`、`dsh-typert-protocol`、`dsh-client-shortcuts`、`dsh-api-remotes`、`dsh-client-ui-layout`、`dsh-agent`、`dsh-session` 等二十多个）。开着 `skipLibCheck` 时，解析不到的类型会**悄悄变成 `any`**，不报错。例子：插槽里合成出来的 `useLocale` 选择器，回调参数成了隐式 `any`，补装 `@deepseek-ai/dsh-client-store@0.2.2-rc.5` 才恢复。最省事的办法是把整个 `@deepseek-ai/dsh` 装成开发依赖（约 800 MB）；我们是缺哪个补哪个。

构建用 `@jx/ui-kit` 带的 `jx-dsh-plugin-build`，产物格式和要注意的地方见 [`packages/ui-kit/README.md`](../ui-kit/README.md) 的「构建脚本」。
