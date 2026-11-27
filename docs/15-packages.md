# 包与应用的去向

> 状态：2026-11-27 新写。产品负责人同一天给了产品页面的新方向（已定）：Kun 保持现有基础框架和接口，继续负责认证、会话和权限；登录、工作区和管理端等产品页面统一放到匠心重新设计，旧布局和样式可以淘汰；次序是先列清各个包的去向，再修订文档，再用登录页跑通前后端流程。这一篇是第一步里匠心这一半的清单。
>
> 「到了哪一步」一列是事实，按目录里的文件与构建脚本核对过，依据写在同一行。「去向」一列里标「已定」的出自产品负责人的裁定，其余是整理时的提议，没有拍板。Kun 那边的包、已发布的包、文档、示例和站点导航，在 Kun 的仓库里整理，这里只列匠心要接替的几样，见第 2.3 节。

## 1 怎么读

「到了哪一步」分四档：

| 档 | 指什么 |
|---|---|
| 有代码能跑 | 有源码和能执行的脚本或检查，照它的说明能在本机跑起来 |
| 只有骨架 | 有目录与配置，没有能用的功能 |
| 只有文档 | 目录里只有说明 |
| 还没有 | 目录还没有建 |

「去向」分五种：照旧；重新设计（留着这个位置，内容按新的方向重做）；新建；归并（并进别的包或目录）；归档（不再改，留作参考或退掉）。

## 2 清单

### 2.1 应用与服务

| 项 | 是什么 | 到了哪一步 | 依据 | 去向 |
|---|---|---|---|---|
| [`apps/web/`](https://github.com/CavaiLAB/jiangxin/blob/main/apps/web/README.md) | Web 端在本机的启动脚本，和放在反向代理后面的验证 | 有代码能跑：本机起一个单人的实例，用假模型 | `start.sh`、`dev.sh` 调发行目录的启动器 `distribution/bin/jx-dsh`；`proxy-test/run.sh` 在 Docker 里做实际转发的验证 | 照旧，留作本机试用与反向代理的验证。按人托管的那部分放进新建的工作区服务（工作区服务归匠心，已定） |
| [`apps/desktop/`](https://github.com/CavaiLAB/jiangxin/blob/main/apps/desktop/README.md) | 桌面端：薄的 Electron 壳，里面跑发行目录里的 DSH | 有代码能跑，原型，没有发布过 | `src/` 下是壳的主进程与页面；`package.json` 里有 `dev`、`test`、`smoke`、`pack:mac`；`tests/` 下有单测 | 照旧。桌面端走薄壳（已定） |
| [`apps/console/`](https://github.com/CavaiLAB/jiangxin/blob/main/apps/console/README.md) | 管理端 | 只有文档 | 目录里只有 `README.md` | 新建。放本仓库、随生成应用的最小一圈开始做（已定）；照匠心的设计规范重新设计，Kun 里现有的租户与成员页、平台控制台、旧的应用外壳在这里重做（已定） |
| 认证页 | 登录、选择租户（界面上叫「选择工作空间」）、强制改密、找回密码这一族页面 | 还没有 | 本仓库里没有。现在用的是 Kun 里现有的那一套 | 新建。页面放匠心重新设计（已定）；放在哪个目录、怎么托管是提议，见第 3 节 |
| 工作区服务 | 接工作区的域名，用 Kun 的登录组件认人，把登录的人送进他自己的 DSH 实例 | 还没有 | 本仓库里没有 | 新建。归匠心，用 C# 写，基于 Kun 的包（已定）；放在哪个目录是提议，见第 3 节 |

### 2.2 包、插件与样板

| 项 | 是什么 | 到了哪一步 | 依据 | 去向 |
|---|---|---|---|---|
| [`packages/brand-theme/`](https://github.com/CavaiLAB/jiangxin/blob/main/packages/brand-theme/README.md)（`@jx/brand-theme`） | 品牌包：把 DSH 界面上的名称、标志、主题色和文案换成匠心的 | 有代码能跑，装在发行目录里 | `src/` 下有宿主与浏览器两半；`pnpm run check` 跑类型检查、单测、构建；发行目录里有它的打包件和生成的补丁 `70-jx-brand-theme.yml` | 照旧。配色现在是从 logo 取样的初稿，设计规范定稿以后跟着改（提议） |
| [`packages/enterprise-workbench/`](https://github.com/CavaiLAB/jiangxin/blob/main/packages/enterprise-workbench/README.md)（`@jx/enterprise-workbench`） | 企业插件的样板：自己的后端接口加一个整页面板，设备台账的数据是假的 | 有代码能跑，作为样板装在发行目录里 | `src/` 下有宿主、浏览器两半和共用的协议；`tests/` 下两组单测；发行目录里有打包件和补丁 `80-sample-jx-enterprise-workbench.yml` | 照旧，当写插件的模板。包的说明写着正式发行前从发行目录拿掉 |
| [`packages/ui-kit/`](https://github.com/CavaiLAB/jiangxin/blob/main/packages/ui-kit/README.md)（`@jx/ui-kit`） | 界面组件包：shadcn 生成的基础组件、手写的数据表格和抽屉，和插件的构建脚本 `jx-dsh-plugin-build`。源码库，不是插件 | 有代码能跑 | `src/` 下的组件；`tests/` 下三组单测；`tools/build-plugin.mjs` 是构建脚本 | 照旧，是匠心各处页面共用的组件层。基础组件用 shadcn 加 Tailwind，放这个包（已定）；做成一个插件、各插件共用一份（已定，工作线 9）。认证页和管理端不在 DSH 里跑，要用它得先把依赖 DSH 的部分分开，见第 3 节（提议） |
| 以后可能加的四个包：`dsh-compat`、`enterprise-auth`、`enterprise-policy`、`enterprise-audit` | DSH 实例一侧的兼容层、登录对接、工具护栏、审计 | 只有文档 | 只写在 [packages 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/README.md)里，名字和分工是提议 | 照旧作提议。`enterprise-auth` 管的是 DSH 实例一侧，认证页不放进它（提议） |

### 2.3 Kun 里由匠心接替的页面

Kun 的仓库里有几样产品页面，都是 Kun 的 pnpm 工作区里不发布的私有包，装的是已归档的 Qian 发布的包。新方向以后由匠心接替；它们在 Kun 里留不留、什么时候退，由 Kun 的仓库列，退掉的时点到时再问产品负责人。

| Kun 里的 | 是什么 | 匠心这边接替的 |
|---|---|---|
| `packages/qian-identity-ui` | 认证页族：登录、多租户选择、强制改密、连接器落点。构建产物由身份服务在 `/login` 下同源托管 | 匠心的认证页（已定放匠心重新设计）。新页面跑通以前登录照它用，这是整理时的读法 |
| `packages/qian-tenancy-signup-ui` | 租户自助开通的申请人公开页与平台运营的申请页 | 申请人公开页也是给人看的产品页面，提议随认证页一起在匠心重做；运营的申请页并进管理端（提议） |
| `apps/qian-shell`、`packages/qian-shell-kit`、`packages/qian-tenancy-ui` | 旧的应用外壳、外壳的接线、租户与成员页 | 管理端。旧外壳、租户与成员页在匠心的管理端里重做（已定） |

### 2.4 发行、工具与站点

| 项 | 是什么 | 到了哪一步 | 依据 | 去向 |
|---|---|---|---|---|
| [`distribution/`](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md) | 发行目录：钉死版本的 DSH、以打包件装入的插件包、配置补丁、启动器与启动前检查。Web 端和桌面端共用 | 有代码能跑 | `npm ci --ignore-scripts` 以后 `node bin/jx-preflight.mjs` 能过；`vendor/` 下两个打包件；`patches/` 下 11 个配置补丁；`scripts/vendor-packages.sh` 重打插件包 | 照旧。检查接进 CI（已定），还没有做 |
| [`patches/`](https://github.com/CavaiLAB/jiangxin/blob/main/patches/README.md) | 对 DSH 源码的补丁 | 只有骨架：两个样例，没有用于任何构建 | 两个 `.patch` 文件；`apps/desktop/scripts/check-patches.sh` 只检查它们能不能打上 | 照旧。原则上不改 DSH 的源码 |
| [`contracts/`](https://github.com/CavaiLAB/jiangxin/blob/main/contracts/README.md) | 以后从 Kun 的契约生成的类型 | 只有文档 | 目录里只有 `README.md` | 照旧占位。认证页要调的账号接口进了 Kun 的公开契约以后，类型从那里生成到这里（提议） |
| [`brand/`](https://github.com/CavaiLAB/jiangxin/blob/main/brand/README.md) | 匠心 logo 的原图，不在任何代码许可之内 | 有原图 | `source/` 下五张图 | 照旧。认证页、管理端和品牌包用同一份原图（提议） |
| [`tools/mock-model/`](https://github.com/CavaiLAB/jiangxin/blob/main/tools/mock-model/README.md) | 本机的假模型服务 | 有代码能跑 | `server.mjs`，只用 Node 自带模块 | 照旧 |
| `tools/check-shell-vars.mjs` | 查 shell 脚本里变量后面紧跟中文的写法 | 有代码能跑 | 单个脚本，`AGENTS.md` 里写了什么时候跑 | 照旧 |
| [`tests/egress/`](https://github.com/CavaiLAB/jiangxin/blob/main/tests/egress/README.md) | 外联检查：在不通外网的容器网络里看实例想连哪些地址 | 有代码能跑，要 Docker | `run.sh`、`build-images.sh` 与三份镜像定义 | 照旧 |
| [`website/`](https://github.com/CavaiLAB/jiangxin/blob/main/website/README.md) | 文档站，只放本仓库的文档 | 有代码能跑，CI 在构建 | `pnpm build`；`.github/workflows/docs-site.yml` 在每个 PR 上构建、合并后发布 | 照旧。加上给大模型的入口，见[在平台上做开发](11-development.md)第 10 节（提议） |
| `.github/workflows/` | CI | 有，只有文档站一个工作流 | `docs-site.yml` | 照旧。产品代码的检查接进 CI（已定），还没有做 |
| `deploy/` | 产品的部署清单 | 还没有 | 目录没有建 | 新建。放这里、只有一套、企业版与单机版共用（已定） |
| `docs/` | 平台的文档 | 有 | 本站 | 照旧 |

本仓库里没有 Qian 的包要归档：匠心的代码不装 `@cavailab/qian-*`。

## 3 认证页、管理端与工作区各在哪

| | 放在哪 | 状态 |
|---|---|---|
| 认证页 | 提议新建 `apps/auth/`：构建成静态页面，由 Kun 的身份服务在自己的域名下同源托管 | 页面放匠心重新设计、认证与会话由 Kun 负责，已定；目录与托管方式是提议 |
| 管理端 | `apps/console/` | 放本仓库已定，目录已建；还没有代码 |
| Agent 工作区 | 界面是 DSH 自己的客户端（已定），从 `distribution/` 启动；Web 端前面是工作区服务 | 工作区服务归匠心、用 C# 写已定；提议放 `services/workspace/`，和 Node 的几个应用分开 |

认证页为什么提议单独一个应用、交给身份服务托管：

- **凭据只在身份服务的域名里。** Kun 的认证页规格（草案）写的原则是：密码、验证码、选择租户用的票据只在身份服务同源的页面与 HttpOnly 的 cookie 里流转，不经过别的应用的脚本。所以认证页要和身份服务同源。
- **Kun 现在就能托管别人构建的认证页。** 身份服务有一个配置项指向认证页的构建产物目录，在 `/login` 下同源托管，现有的那一套就是这样装上去的。照现在的代码看，换成匠心构建的产物，不用为此改 Kun 的代码；新页面要守它的托管约定：产物以 `/login/` 为基路径，根上要有 `index.html`，`/login`、`/login/select-tenant`、`/login/connector/{connectorId}` 这些页面路由都回到这个入口。见 Kun [身份服务的说明](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Identity.Server/README.md)。
- **不放进管理端。** 管理端在自己的域名上、过 Kun 的网关，认证页在身份服务的域名上；普通用户登录以后直接进工作区，不经过管理端。管理端随生成应用的最小一圈才开始做，登录页要先跑通，分开以后互不等。

三者共用什么（提议，除标了已定的）：

| 共用的 | 怎么用 |
|---|---|
| 基础组件 | `@jx/ui-kit`，shadcn 加 Tailwind（已定）。它现在按 DSH 插件写：抽屉的壳是 DSH 的弹窗，数据表格用了 DSH 的控件，几处样式照 DSH 量出来，构建脚本产出的是 DSH 插件。认证页和管理端不在 DSH 里跑，要先把不依赖 DSH 的基础组件和依赖 DSH 的部分分开，再各自打包 |
| 设计规范 | 同一份，见[设计规范](16-design.md)。规范还是底稿 |
| 品牌 | 同一份 logo 原图与产品名（已定用匠心的名称与 logo）。品牌包是 DSH 插件，认证页和管理端不装它，从 `brand/` 取原图，配色取设计规范里的那一套 |
| 登录状态 | 照 Kun 现有的做法，各自做依赖方：浏览器在身份服务那里登录一次，身份服务的域名上留下单点登录的会话；管理端经 Kun 的网关、工作区服务用 Kun 的登录组件，各自走授权码流程换自己的会话，已经登录过就不用再输一遍。令牌不进浏览器的脚本。哪个页面都不另存一套用户 |

## 4 用登录页跑通前后端：匠心这一侧先要有什么

用登录页跑通前后端流程（已定）。下面是匠心这一侧要先有的东西，是提议；最后一列写明哪几样要等 Kun。

| 要先有的 | 是什么 | 等不等 Kun |
|---|---|---|
| 登录页的设计 | 设计规范里登录页的模板：版式、状态、错误态、深浅色、中英文 | 不等 |
| 认证页的应用 | `apps/auth/`：构建、本机预览、单测，产物能被身份服务托管 | 不等 |
| 能在 DSH 以外用的基础组件 | 见第 3 节「基础组件」一行 | 不等 |
| 调哪些接口 | 身份服务的账号接口（在 `/api/identity` 下：取防伪令牌、登录、选择租户、改密、列连接器等）与 OpenID Connect 的协议端点。接口已有，写在身份服务的说明里 | 要等：账号接口还没有进 Kun 的公开契约。进了以后从契约生成类型放 `contracts/` |
| 错误怎么显示 | 结构化错误按 Kun 冻结的契约；页面按错误码分支 | 部分要等：认证相关的错误码在 Kun 的认证页规格里还是提案，要先登记 |
| 本机怎么起 | 构建认证页，起 Kun 的身份服务或本机联调的宿主，让它托管这份产物，再起一个最小的依赖方 | 要等：托管目录怎么配、本机联调的宿主怎么起，要写进 Kun 的使用文档 |
| 登录以后到哪 | 已定的是普通用户进工作区、管理员进管理端、入口页兜底。跑通这一步时工作区服务和管理端都还没有，用一个最小的依赖方页面显示当前的人与租户、能登出 | 不等 |
| 品牌 | 新页面直接用匠心的名称与 logo | 不等 |
| 验收 | 浏览器打开依赖方，跳到匠心的登录页（在身份服务的域名下），账号密码登录；有几个租户时选择租户；回到依赖方，显示当前的人与租户；登出。密码错、限流这些错误态照 Kun 的规则显示；页面里没有 Qian 的包；过一遍自动的无障碍检查 | 不等 |

认证页的其余几页排在登录页跑通以后：2026-11-27 的答复里定了先做找回密码与验证码登录，其余随后；和新方向合起来，登录页先跑通，再做这两样，这是整理时的读法，见[路线](13-roadmap.md)第 2.4 节。

## 5 在哪里

| 主题 | 在哪里 |
|---|---|
| 各端是什么、登录以后到哪 | [产品形态](03-product.md) |
| 匠心、Kun、DSH 各管什么 | [总体架构](04-architecture.md)第 2 节 |
| 登录怎么接、认证页现在怎么托管 | [DSH 与企业级平台的对接](09-dsh-integration.md)第 4 节 |
| 三步的次序 | [路线](13-roadmap.md)第 2.4 节 |
| 界面怎么设计 | [设计规范](16-design.md) |
| 开发者和 Agent 从哪里找组件、接口与示例 | [在平台上做开发](11-development.md)第 10 节 |
