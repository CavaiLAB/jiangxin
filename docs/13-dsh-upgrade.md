# DSH 更新之后做什么

> 状态：2026-11-26 新写。产品负责人要文档写清楚四件事（已定，2026-11-26，P85），本文答其中一件：DSH 更新之后要做哪些工作。
>
> 本文是总的清单和顺序。具体的命令写在代码旁边的说明里，本文只链过去，不抄一遍。
>
> 两种标注：**已有**是仓库里现在就有的做法、脚本和检查，对着文件核对过；**提议**没有裁定。引到已经裁定的事时写「已定」并带 P 编号。更新策略这一块，即跟哪条版本线、多久升一次、怎么送到用的人手里、怎么退、加急怎么办，整个是提议。
>
> 到现在为止还没有真的升过一次：DSH 从 2026-11-20 放进仓库起，钉的就是 `0.2.2-rc.5`。下面的步骤是照现有的说明和脚本排出来的，第一次升级时要边做边改这一篇。
>
> 文中 P 加数字是平台级裁定的编号：P40 在 [2026-11-20 产品裁定](decisions/2026-11-20-product.md)，P63 在 [2026-11-25 平台级裁定](decisions/2026-11-25-platform.md)，P85 是 2026-11-26 的裁定。

## 1 一页清单

DSH 出了新版本，不用马上做什么。版本是钉死的，上游发版不会自己进到产品里。要做的是定期看一眼上游；到了该升的时候，按下面的顺序做一次。

| 步 | 做什么 | 在哪一节 |
|---|---|---|
| 1 | 判断这次升不升、升到哪一版 | 第 3 节 |
| 2 | 读新版本的升级指南，对着接触面清单看碰到了哪几项 | 第 4 节 |
| 3 | 留好升级前的东西：合成配置导出一份；要演练的话，留一份用过的状态目录 | 第 6 节 |
| 4 | 改版本，改各插件包，重新打包插件包 | 第 5 节 |
| 5 | 过检查，按结果改配置补丁和品牌包 | 第 6 节 |
| 6 | 桌面端重新打包；托管实例换版本 | 第 7 节 |
| 7 | 改文档里的版本号，留一份升级记录 | 第 10 节 |
| 出了问题 | 把这次升级整个撤掉；状态从升级前的备份恢复 | 第 8 节 |

## 2 先知道的几件事

这一节说的都是已有的事实。

- **版本钉死在一处。** `distribution/package.json` 里写 DSH 的精确版本，不写范围。Web 端和桌面端共用这一个发行目录，改这一处，两端一起换。
- **不改 DSH 的源码。** 我们的东西只有自己写的插件包，和叠在 DSH 配置上的补丁。所以升级不用合并源码，要做的是让这两样跟上新版本。
- **上游的节奏。** DSH 现在发的全是预发布版，2026-08-17 到 2026-11-18 发了 41 个，近 400 个包统一版本号一起发，见[核对过的 DSH 事实](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/dsh-facts.md)第 9 节。上游在源码根目录的 `AGENTS.md` 里写明：公开的接口还没有稳定，改了由使用方自己跟；对外看得见的破坏性变更，逐条写进升级指南。
- **有三种失效不报错。** 升级要过的检查，多半是为它们设的：
  1. 插件包声明的 DSH 版本对不上时，DSH 不报错，只把这个插件停用，照常启动。品牌包被停用，产品就带着 DSH 自己的品牌起来。
  2. 配置补丁按行的 id 命中。上游改了行的 id 或者默认值，补丁落空，也不报错。
  3. 品牌包有几处靠 DSH 的内部结构换掉界面上的字样和图形。上游改了结构，它们悄悄失效，DSH 的字样重新露出来。
- **贴着 DSH 的地方记在一处。** 我们的代码直接碰到的 DSH 接口、配置行、环境变量和文件，列在[接触面清单](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/touchpoints.md)里。升级就是照这份清单逐项重验。

## 3 什么时候升

现有的说明里只有一句：一次只升到一条小版本线的最后一个 rc（已有）。下面几条是提议。

1. **只跟 rc，不跟 alpha。** npm 上 `latest` 标签指的就是 rc 这条线。写这一篇时（2026-11-26）它指的是 `0.2.2-rc.5`，和钉的版本一样，没有落后；`alpha` 标签指的是下一条线的 alpha。
2. **一条线升一次。** 上游下一条线出了第一个 rc，或者这条线超过 7 天没有新的 rc，就升到这条线的最后一个 rc。线的中途不追每一个 rc。
3. **最多落后一条线。** 隔得越久，一次要读的升级指南条目越多，要改的地方越多。
4. **产品发版不等 DSH。** 产品的版本号是日历版本号（已定，P40）。DSH 的版本不进产品的版本号，只在关于里显示「基于 DSH 某版构建」。一次产品发版可以不动 DSH。
5. **升级单独做成一个改动。** 不和功能混在一起，出了问题好退。
6. **每周看一眼上游。** 看有没有新版本，新的升级指南条目里哪些碰到了接触面清单。现在没有人定期做这件事，也没有脚本。

例外是加急，见第 9 节。

## 4 升之前读什么

1. **新版本的升级指南**（已有的做法）。在 DSH 源码的 `docs/upgrade-guide/v<版本>/<条目>/` 下，每个条目一份 `guide.md`，分「Change」和「Migration」两节；同目录的 `guide.zh.md` 是中文。从现在钉的版本之后到目标版本为止，每个版本目录都读。它也随 npm 包发，装好以后在 `node_modules/@deepseek-ai/dsh/docs/upgrade-guide/` 下。
2. **接触面清单**（已有）。拿升级指南的条目逐条对[接触面清单](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/touchpoints.md)，看碰到了哪几项。桌面壳特别看这几类：Web 模式的启动参数、就绪行、认证、profile 与补丁的叠加、状态目录。
3. **新版本的源码**（已有的做法）。按标签检出到仓库根下的 `upstream/dsh-ref`，这个目录不入库。接触面清单里标「摸出来的」「内部」的那几项，文档里没有，只能对着源码看；源码补丁的检查也要它。
4. **两份说明里讲升级的小节**（已有）：[品牌包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/brand-theme/README.md)的「升级 DSH 时」和「换不掉或靠取巧的位置」；[界面包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/ui-kit/README.md)的「构建脚本」末尾。
5. **上一次的升级记录**（提议，现在还没有）。

## 5 要改哪几处

下表逐行对着仓库核对过。怎么改、跑什么命令，在右边一栏指的说明里。

| 改哪里 | 改什么 | 说明在哪 |
|---|---|---|
| `distribution/package.json`、`distribution/package-lock.json` | DSH 的精确版本；刷新锁文件 | [发行目录的说明](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md)「升级 DSH」第 1 步 |
| `packages/brand-theme/package.json`、`packages/enterprise-workbench/package.json` | `engines.dsh`，和 DSH 各个包的开发依赖，都写新的精确版本；重新装依赖，刷新各自的 `pnpm-lock.yaml` | 同上；[packages 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/README.md)「怎么装、怎么检查」 |
| `packages/ui-kit/package.json` | DSH 基础组件包的版本，在对等依赖和开发依赖里各一处；刷新 `pnpm-lock.yaml`。另外两个包链接着它，先改它、先装它 | [packages 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/README.md) |
| `packages/ui-kit/tools/build-plugin.mjs` | 开头的共享模块表 `DSH_PLATFORM_MODULES`，和产物的外壳格式，对着新版本的源码核对 | [界面包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/ui-kit/README.md)「构建脚本」 |
| `packages/brand-theme/` 的源码 | 补丁里照抄的那句 `personaPrefix`；文案覆盖表的键；三处靠内部结构的样式和脚本；读语言设置用的两个名字。另有三处跟着版本走：`src/brand.ts` 里的 `pinnedVersion`，`NOTICE.md` 里的版本，单测里那份首页 HTML 的夹具（是这一版的原文） | [品牌包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/brand-theme/README.md)「升级 DSH 时」。跟着版本走的三处，说明里没有提 |
| `distribution/vendor/`，`distribution/patches/` 里 `70-`、`80-` 开头的两个补丁 | 不手改。插件包改完以后，跑打包脚本 `distribution/scripts/vendor-packages.sh` 重新生成 | [发行目录的说明](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md)「插件包怎么装进来」 |
| `distribution/patches/` 里其余的补丁 | 按合成配置的对比结果改：上游改了行的 id，改了默认值，或者给整行替换的那几行加了键 | 同上，「每个补丁」「升级 DSH」第 3 步 |
| `tests/egress/build-images.sh`、`tests/egress/run.sh`、`apps/web/proxy-test/run.sh` | 外联检查用的镜像，标签里写着 DSH 的版本，三个脚本里都有；`tests/egress/docker/dsh.Dockerfile` 的注释里也写着版本。改完重建镜像。浏览器脚本里有一步点的是这一版插件页上的一个插件，换版本时可能要改 | [外联检查的说明](https://github.com/CavaiLAB/jiangxin/blob/main/tests/egress/README.md)。标签要跟着改这一点，说明里没有提 |
| `apps/desktop/tests/isolation.test.js` | 有一条单测写死了钉的版本号，要跟着改，不然单测不过 | 说明里没有提 |
| `apps/desktop/tests/steps/` 下的界面操作脚本 | 按界面上的文字找元素的几行，上游改了文字要跟着改 | [桌面壳的说明](https://github.com/CavaiLAB/jiangxin/blob/main/apps/desktop/README.md)「接触面」 |
| `distribution/tests/settings-lock.mjs` | 脚本里临时建的测试用组合包，声明的 DSH 版本范围到 `0.3.0` 之前为止。升到 `0.3` 这条线或者更新的线时要改 | 说明里没有提 |
| `patches/` 下的源码补丁 | 每个补丁先看撤销条件是不是已经满足，满足就删；再对着新版本的源码检查，打不上的重写。现在只有两个样例，没有用于任何构建 | [patches 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/patches/README.md)「怎么检查」 |

改完的东西一起提交：版本、各处的锁文件、tarball、生成的补丁、手改的补丁。

另有一处不影响产品：`apps/desktop/scripts/upstream-churn.mjs` 里有一张版本表，用来统计上游在我们关心的文件上改得多不多。要接着统计，就把新版本加进去。

## 6 过哪些检查

改版本之前，先把升级前的合成配置导出一份留好，第 4 项要拿它来比。

按下面的顺序过。这些检查现在都在本机跑，不在 CI 里；接进 CI 没有定。

| 顺序 | 检查 | 查什么 | 说明在哪 | 现状 |
|---|---|---|---|---|
| 1 | 各插件包自己的检查 | 类型检查、单测、构建。DSH 改了接口，类型检查能抓到一部分 | [packages 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/README.md) | 已有 |
| 2 | 重新打包插件包 | 打包脚本先把上面的检查再跑一遍，然后生成 tarball 和两个补丁 | [发行目录的说明](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md)「插件包怎么装进来」 | 已有 |
| 3 | 启动前检查 | 装的 DSH 正好是钉的版本；插件包装着，声明的版本认这个 DSH；合成配置时没有插件被停用；我们插入的行都在 | 同上，「启动前检查」 | 已有。启动器每次启动、桌面壳打包之前也自动跑 |
| 4 | 合成配置的对比 | 升级前后各导出一次合成配置，对比补丁碰到的那些行：行还在不在，默认值变没变，整行替换的那几行上游有没有多出键 | 同上，「升级 DSH」第 3 步 | 已有，人工对比 |
| 5 | 设置锁定验证 | 该锁住的设置，界面上仍然改不动，结果和升级前一样 | 同上，「配置补丁」 | 已有。脚本只打印一张表，不判对错，要人对照 |
| 6 | 外联检查 | 实例往外连的地方和升级前一样：模型请求只发往指定的地址，没有多出别的外部地址 | [外联检查的说明](https://github.com/CavaiLAB/jiangxin/blob/main/tests/egress/README.md) | 已有，要 Docker。要人对照说明里的「期望」 |
| 7 | 反向代理的验证 | 用令牌换 cookie、cookie 的属性、WebSocket，以及没带凭据、主机名不对时的应答 | [apps/web 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/apps/web/README.md)第 3 节 | 已有，要 Docker。说明里的升级步骤没有列它，提议一起跑 |
| 8 | 接触面逐项核对，品牌回归 | 照接触面清单逐项看。品牌包：在浏览器里跑文案审计，没盖掉的、带上游字样的句子应当是 0；再把界面走一遍，看启动加载页、对话进行中的样子、打开会话以后标签页上的标题 | [接触面清单](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/touchpoints.md)第 4 节；[品牌包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/brand-theme/README.md)「检查」「升级 DSH 时」 | 已有，人工 |
| 9 | 桌面壳 | 重新同步随包的发行目录；单测；不开窗口的冒烟，查启动参数、就绪行、换 cookie、不带凭据得 401；自检，含在窗口里发一条消息的那一条 | [桌面壳的说明](https://github.com/CavaiLAB/jiangxin/blob/main/apps/desktop/README.md)「验证」「接触面」 | 已有，要 macOS |
| 10 | 源码补丁 | 补丁还能不能干净地打到新版本的源码上 | [patches 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/patches/README.md) | 已有。现在只有样例 |
| 11 | shell 脚本与文档站 | 改了 shell 脚本，跑变量写法的检查；改了 `docs/` 或根目录的说明，构建一次文档站 | [AGENTS.md](https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md) | 已有 |

第 4 项查出补丁落空，就改补丁，再从第 3 项重来。

现在没有的检查，提议补上：

| 缺什么 | 为什么要 |
|---|---|
| 带旧状态的升级演练 | 现有的检查没有一项是拿上一版用过的状态来启动新版本的。要拿一份用过的状态目录，里面有会话、改过设置，用新版本启动，看会话能不能开、设置在不在 |
| 回退演练 | 新版本写过以后，用旧版本再打开，看哪些读不了。回退时能不能不恢复备份，靠它来确认 |
| 合成配置的基线入库 | 升级时直接看差异，不用人工导出两份来比 |
| 检查接进 CI | 现在全靠人记得跑 |
| 工作区服务与实例的对接点、管理端的外壳 | 这两样还没有写。写了以后，它们贴着 DSH 的地方要进接触面清单，也要有检查 |

## 7 送到用的人手里

### 7.1 桌面端

已有的：

- DSH 随安装包带。壳有意不做自动更新。所以桌面端升级 DSH，就是重新打包，出一个新的安装包，由用的人自己装。
- 打包时先从发行目录同步、重装随包的那一份，再跑启动前检查，查不过不打。
- 现在只出 macOS、Apple 芯片的应用包，不签名，不公证，没有发布过。正式的应用标识、签名、公证、状态目录放在哪，都没有定。

见[桌面壳的说明](https://github.com/CavaiLAB/jiangxin/blob/main/apps/desktop/README.md)的「打包」「状态目录与隔离」。

提议分两步补：

1. 先做检查更新。壳向平台问四样：最新版本、最低可用版本、下载地址、校验值。有新版本就提示，由用的人自己下载安装；低于最低可用版本时只显示升级页，给安全修复用。这一步依赖桌面怎么连平台，那一件还没有定，见 [DSH 与企业级平台的对接](12-dsh-integration.md)。
2. 有了签名证书以后，再做自动下载、校验、安装。

版本怎么比：日历版本号不能按语义化版本的规则比，壳里已经有一个按日历版本号的规则比较的函数（已有）。

单机版以桌面为主（已定，P63），照桌面端的办法送（提议）。

### 7.2 托管实例

托管实例和工作区服务都还没有实现，也还没有托管实例的镜像。下面都是提议：

- 一个镜像对应一个产品版本，从发行目录装出来。
- 只在实例启动的时候换版本。实例空闲会被回收（已定，P63），下次打开就是新版本，正常升级不打断任何人。
- 一直不空闲的实例：界面上提示有新版本；过了期限，等到没有会话在跑、没有等着人确认的操作时再重启。
- 先小范围，再全部：自己人，一小部分人，全部。每一步看三样：实例启动的成功率，会话打开失败的次数，错误日志。
- 第一次用新版本打开某个人的状态之前，先备份他的状态目录。
- 新旧两个版本的实例会并存一段时间，工作区服务要同时认两个版本。
- 现行版本、先用新版本的名单、最低版本，这几个值在管理端里管。

### 7.3 现在的 Web 端

现在的 Web 端是在本机起的一个实例（已有）。升级以后重装发行目录的依赖，重新启动，就是新版本。见 [apps/web 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/apps/web/README.md)。

## 8 出了问题怎么退

### 8.1 代码

- 照第 3 节，升级是单独的一个改动；退就是把它整个撤掉：版本、各处的锁文件、各插件包声明的版本、tarball、生成的补丁一起回到上一版，重装依赖，再过一遍启动前检查。
- 不要只把 `distribution/package.json` 里的版本号改回去。插件包钉的是精确版本，只改一边，启动前检查过不了（已有）。
- 来不及退，或者不想整个退：用配置补丁把出问题的功能先关掉。补丁是现成的手段，改完重启实例就生效（提议）。
- 桌面端没有更新的通道。已经装出去的安装包，只能靠再出一个装着旧版 DSH 的包来换。

### 8.2 状态

上游的说法，出自 DSH 源码里的文档，对着钉的这一版核对过：

| 上游怎么说 | 出处（相对 DSH 源码的根目录） |
|---|---|
| 已经发布过的会话数据，新版本要读得了；alpha、rc 的发布也算发布 | `docs/session-format-status.md` |
| 不保证能降级 | `AGENTS.md` |
| 要回到旧版本，写新格式之前先留一份一致的备份：旧版本可能在第一次写入以后就不认新的格式标记 | `docs/subsystems/storage.md` |

所以，下面五条是提议：

1. 升级只往前走。回退等于旧版本加升级前的备份。
2. 用新版本打开一份状态之前，先备份。要备份的至少是 DSH 的状态目录和共享的智能体目录，即 `DSH_HOME` 与 `DSH_AGENTS_HOME` 指的两处。范围还没有逐项认过。
3. 已经被新版本打开过的状态，回退时默认从备份恢复，会丢掉升级以后的内容。只有那次升级的回退演练证明旧版本能直接读，才可以不恢复。
4. 每份状态记一个「上次是哪个版本的 DSH 打开的」，记在状态目录外面。发现要用更旧的版本打开时，不直接启动，走恢复。
5. 升级以后，用的人自己装的插件可能被停用：它声明的版本不认新的 DSH 时，DSH 只停用它、不报错（已有的行为）。要告诉他是哪些。发行版里用的人能不能自己装插件，本身还没有定。

本机开发用的状态不用备份：停掉服务，删掉状态目录重来就行（已有），见[发行目录的说明](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md)的「本机状态」。

没有测过的：备份有多大、要多久；托管实例的备份怎么做，这取决于集群用的存储。

## 9 加急

这一节是提议。

- **什么算加急。** 上游修了安全问题，或者修了挡住用的人的严重缺陷，而修复只在更新的版本里。
- **怎么做。** 直接升到带修复的那个版本，哪怕在一条线的中途，哪怕是下一条线。第 6 节的检查一项不省；人工核对只看升级指南里这一段的条目。小范围试用的时间压短。桌面端抬高最低可用版本，前提是第 7.1 节的第一步已经做了。
- **来不及升。** 先用配置补丁把出问题的功能关掉。
- **怎么知道上游修了什么。** 钉的这一版的源码根目录下没有变更日志，也没有专讲安全通告的文件，只能盯发版和升级指南。第 3 节的「每周看一眼上游」就是做这个的。

## 10 升完以后

- **改文档里写着版本号的地方。** `AGENTS.md` 和各目录的说明里都有。在仓库里把旧的版本号搜一遍，逐处看。现行的说明跟着改。带日期的记录不动：`docs/decisions/` 下的决策记录，和 `apps/desktop/docs/` 下对着这一版做的三份盘点与统计；后者还要用的话，对着新版本重做。
- **重核两份清单。** [核对过的 DSH 事实](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/dsh-facts.md)不只是改数字：里面每条事实是对着旧标签核的，标「实测」的要在新版本上重跑，出处的路径要对着新标签重看。[接触面清单](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/touchpoints.md)同理。
- **留一份升级记录**（提议）：从哪一版到哪一版，碰到升级指南的哪些条目，各项检查的结果，改了哪些补丁。放在哪没有定。
- **这一篇跟着改。**

## 11 让以后的升级省事一点

这一节是提议。

- **把贴着 DSH 的代码收进一个包。** 直接引用 DSH 内部接口的代码收进一个包（提议名 `dsh-compat`），其余的包只引用它，升级时要核对的东西就集中在这一处。现在分散在三处：发行目录、插件包、桌面壳。
- **把本该是数据的东西挪出去。** 名称与图标现在写在品牌包里，模型的清单现在写在配置补丁里；每次改都要重新打包，每次升级都要重新对。提议前者挪到管理端里维护，后者由平台下发，见 [DSH 与企业级平台的对接](12-dsh-integration.md)。
- **把靠取巧的地方逐个根治。** 品牌包的说明给每一处列了根治的办法：打一个很小的源码补丁，或者请上游给一个插槽。

## 12 在哪里

| 主题 | 在哪里 |
|---|---|
| 升级的步骤、配置补丁、启动前检查、外联 | [发行目录的说明](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md) |
| 我们碰到的 DSH 接口、配置行、环境变量和文件 | [接触面清单](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/touchpoints.md) |
| 核对过的 DSH 事实，带出处 | [dsh-facts](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/docs/dsh-facts.md) |
| 品牌包升级时逐条核对什么 | [品牌包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/brand-theme/README.md) |
| 插件包怎么装、怎么检查；界面包的构建脚本 | [packages 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/README.md)；[界面包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/ui-kit/README.md) |
| 桌面壳的验证、打包、接触面 | [桌面壳的说明](https://github.com/CavaiLAB/jiangxin/blob/main/apps/desktop/README.md) |
| 外联检查怎么跑、该看到什么 | [外联检查的说明](https://github.com/CavaiLAB/jiangxin/blob/main/tests/egress/README.md) |
| 源码补丁的写法与检查 | [patches 的说明](https://github.com/CavaiLAB/jiangxin/blob/main/patches/README.md) |
| 钉版本、不改源码的规矩 | [AGENTS.md](https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md) |
| DSH 与企业级平台各项对接的现状 | [DSH 与企业级平台的对接](12-dsh-integration.md) |
