# @jx/brand-theme

匠心工业智能体平台的品牌包：把 DSH 界面里的名称、标志、吉祥物、主题色和带 DSH 字样的文案换成我们的。不改 DSH 的源码，在它的仓库之外开发。

对应 DSH 版本：`0.2.2-rc.5`（`engines.dsh` 钉死，版本对不上时 DSH 不加载这个包，见下面「升级 DSH 时」）。

## 换了什么

| 位置 | 换成什么 | 怎么换的 |
|---|---|---|
| 网页标题、主屏幕标题 | 匠心工业智能体平台 / 匠心 | 宿主一半改写首页 HTML |
| 站点图标、主屏幕图标、Web 应用清单 | 匠心的 logo | 宿主一半用同名路由顶掉 DSH 自带的文件 |
| 浏览器标签页上的标题（打开会话后） | 会话名 — 匠心工业智能体平台 | 首页里注入一段脚本接管标题 |
| 启动加载页的字样 | 匠心工业智能体平台 | 首页里注入一段样式 |
| 侧栏的标志和名称 | 匠心的 logo 和全称 | 占 DSH 的两个品牌插槽，并关掉 DSH 的官方品牌包 |
| 首页的标志、标题、鲸鱼动画 | 匠心的 logo 和全称；鲸鱼动画没有了 | 占首页的标志插槽；标题用语言包盖；鲸鱼随官方品牌包一起关掉 |
| 对话进行中的提示 | 「正在处理」加一个圆点（原来是「深度求索中」加鲸鱼尾巴） | 语言包盖文字，样式盖图形 |
| 主题色 | 匠心红加安全帽黄，深浅两种模式各一套 | 主题的变量覆盖层 |
| 文案里的 DSH 字样 | 48 条中文、48 条英文 | 加 `zh-CN`、`en-US` 两个语言包 |
| 设置 → 通用 → 语言 | 只列换过品牌的两种语言 | 顶替 DSH 原来那一行 |
| 默认语言 | 没人选过语言时落到我们的语言包上 | 浏览器一半读已保存的语言设置后决定（见下面「语言」） |
| 设置 → 通用 → 当前版本 | 产品名与版本号、「基于 DSH x 构建」、开源许可 | 顶替 DSH 原来那一行 |
| 模型的自我介绍 | powered by 匠心工业智能体平台 (Jiangxin) | 关掉系统提示词里上游的开场白，补上我们的一句 |

装上这个包，正常使用能走到的界面（首页、侧栏、设置的各个分区、插件页、自动化任务、对话和对话进行中，加上输入框的菜单、各个下拉和弹层、右侧栏、「轨迹」页签；浅色、深色、中文、英文）上看不到 DSH 的名称、标志和鲸鱼。还看得到的几处是有意保留的，见下面「换不掉或靠取巧的位置」的 C、D。

## 安装

先构建（产物在 `lib/`，不入库，每次都要构建）。这个包用 `../ui-kit` 里的构建脚本，先在 `packages/ui-kit` 里装好依赖（见 [packages/README.md](../README.md)）：

```bash
pnpm install
```

```bash
pnpm run build
```

### 装进发行目录（正式的装法）

发行目录是一个带 `package.json`（精确依赖 `@deepseek-ai/dsh@0.2.2-rc.5`）和 `patches/` 的目录，仓库里的那一份是 [`distribution/`](../../distribution/README.md)，这个包已经装在里面。改了这个包，在仓库根目录跑一次：

```bash
distribution/scripts/vendor-packages.sh
```

它做的事：类型检查、单测、构建；打成 tarball 放进 `distribution/vendor/`；按 tarball 装进发行目录（必须从 tarball 装，`file:` 指向目录的依赖是符号链接，包里对 DSH 模块的引用会解析失败）；把包里的 `cordis.patch.yml` 抄成 `distribution/patches/70-jx-brand-theme.yml`。跑完把 `vendor/` 里的 tarball、`package.json`、锁文件和重新生成的补丁一起提交。

抄的时候插件行的 `name` 会从包名 `'@jx/brand-theme'` 改成相对补丁文件的入口路径 `'../node_modules/@jx/brand-theme/lib/index.js'`。**不要直接用包里那份按包名写的补丁**：按包名写时，DSH 从 `$DSH_HOME/profiles/<名字>/` 往上找包，状态目录不在发行目录里面时（桌面壳、容器、正式部署）就找不到，品牌包不加载，界面露出 DSH 的品牌（实测）。状态目录恰好在发行目录里面时这个问题不出现，所以本机试不出来。

这样装，品牌包**不出现在插件页里，用户关不掉**，补丁里的设置界面上也改不动。启动器每次启动前跑 `distribution/bin/jx-preflight.mjs`，品牌包版本对不上、没装、或者补丁按包名写，都不启动。

### 装进一个配置档（开发时用）

```bash
dsh plugin --profile <名字> add <这个包的绝对路径>
```

DSH 把它记成链接，并自动套用包里的补丁。改了浏览器一半，重新构建后刷新页面就生效；改了宿主一半或补丁要重启 DSH。

这种装法下品牌包会出现在插件页的「已安装插件」里，**带一个开关，用户能把它关掉**。所以只用于开发。

开发用的实例要用自己的状态目录：同时设 `DSH_HOME`、`DSH_AGENTS_HOME`，并把 `workspace-controller.documentsDirectory` 指到自己的目录，不要用 `~/.dsh`（原因见 [AGENTS.md](../../AGENTS.md)「产品的代码」）。最省事的是直接用 `distribution/bin/jx-dsh`，它已经这样做了。

## 语言

DSH 自带八种语言的词典，里面有带 DSH 字样的句子。我们只给中文和英文各做了一份换过品牌的语言包（`zh-CN`、`en-US`），语言行也只列这两种。

**默认语言。** 没人选过语言时 DSH 按浏览器的语言挑。浏览器是 `zh-CN` 或 `en-US` 会直接挑中我们的语言包；别的会落到 DSH 自带的词典上。所以这种时候品牌包替用户选一个：自带的 `en`（如 `en-GB` 的浏览器）换成 `en-US`，自带的 `zh`（如 `zh-TW`）换成 `zh-CN`，其余语言用 `zh-CN`（`src/client/copy-overrides.ts` 的 `DEFAULT_LANGUAGE_PACK`）。选的结果会存进用户设置，之后用户可以自己改。已经有人定了语言（用户选过，或部署方在补丁里定了）就不动。

**不要在这个包的补丁里写默认语言。** 最初是这么做的，结果在发行目录的装法下用户切换语言完全没反应：补丁叠在命令行那一层，那一层的设置界面上改不动（实测）。

**部署方想锁死语言**，在发行目录自己的补丁里写：

```yaml
- id: locale
  config:
    preference: zh-CN
```

这时语言行显示成只读，并写明「语言由部署方统一设定」。DSH 的设置快照里没有「这一项被锁住」的标记，品牌包是推断的：生效的值既不是用户存的、也不是组合包层给的，就当作锁住。部署方锁的值碰巧跟用户以前存的一样时推断不出来，用户改一次被主机拒绝以后才变成只读，界面语言不会变（两种情况都实测过）。

## 版本号

关于行显示的产品版本号在启动时通过环境变量给：

| 变量 | 含义 |
|---|---|
| `JX_PRODUCT_VERSION` | 形如 `v2026.11.20`、`v2026.11.20-2`、`v2026.11.20-beta.1`，月和日不补零（规则见[协作约定](../../docs/14-governance.md)第 7 节） |
| `JX_PRODUCT_COMMIT` | 构建对应的提交，可选 |

不给版本号，界面显示「本地开发」。格式不对时按没给处理，并在标准错误里留一句告警；不会让 DSH 起不来。变量名和 `distribution/bin/jx-dsh`、桌面壳用的是同一对。

## 改东西改哪里

| 要改的 | 改这里 |
|---|---|
| 产品名、短名、英文名 | `src/brand.ts` |
| logo | 换仓库根下的 `brand/source/icon-1024.png`，然后 `pnpm run icons` 重新生成所有尺寸（logo 的使用见 [brand/README.md](../../brand/README.md)） |
| 配色 | `src/client/palette.ts`（全部色值都在这一个文件里；现在是初稿，从 logo 取样） |
| 界面文案 | `src/client/copy-overrides.ts`（盖 DSH 的句子）、`src/client/locales.ts`（这个包自己的句子） |
| 模型的自我介绍 | `src/brand.ts` 的 `AGENT_IDENTITY_PROMPT` |
| 组合上的改动（关哪一行、设什么默认值） | `cordis.patch.yml` |

改完配色跑测试：`tests/contrast.test.ts` 逐条核对 22 组「文字色 / 底色」的对比度够不够（正文 4.5，图标 3）。

## 检查

```bash
pnpm run check
```

等于类型检查、47 个单测、构建三步。单测不依赖运行中的 DSH。

要对着运行中的实例核对的两件事：

1. **文案审计。** 在浏览器控制台里执行 `__JX_BRAND_AUDIT__()`，它把界面词典里所有带上游字样的句子列出来，并标出哪些已经盖掉。`productLeft` 应该是 0。词典是各个界面打开时才注册的，所以先把要查的页面点开一遍。返回值里的 `localeSettings` 是语言设置的现状（生效的语言、存下来的选择、能不能改），排查语言问题时看它。
2. **看界面。** 文案审计查不到图形，也查不到不走语言包的文字（技能说明、插件元数据）。这部分要把界面走一遍：首页、侧栏、设置、插件页、对话进行中、输入框的「/」菜单、「轨迹」页签，浅色深色、中文英文各看一次。截图扫描的脚本还没有入库。

## 换不掉或靠取巧的位置

### A. 靠取巧换掉的：现在看不到，升级后可能悄悄失效

1. **浏览器标签页上的标题。** 上游在构建时把标题烤进了客户端：`@deepseek-ai/dsh-client-ui-layout/lib/client.js` 里的 `productTitle` 常量，没有配置项也没有插槽。现在靠首页注入的脚本接管 `document.title` 的写入（`src/host/index-html.ts` 的 `TITLE_GUARD_SCRIPT`）。根治要一个一行的补丁，把那个常量换成产品名（`pnpm patch @deepseek-ai/dsh-client-ui-layout@0.2.2-rc.5` 生成；或者从源码重建客户端时设 `DSH_CLIENT_TITLE`）。打了补丁就可以删掉守标题的脚本。这是最值得先改成补丁的一处：改动小，位置稳定。
2. **启动加载页的「HARNESS」。** 写死在 `@deepseek-ai/dsh-web-frontend/dist/assets/` 下一个带内容哈希的脚本里，旁边英文的「Loading plugins…」不含品牌，没换。现在用样式藏掉原字（`BOOT_PAGE_STYLE`）。根治的补丁是替换那段字面量；文件名带内容哈希，每次升级都要重做。另一条路是从源码重建前端。
3. **对话进行中的鲸鱼尾巴。** `@deepseek-ai/dsh-client-ui-chat` 的 `RunningWhaleTail` 组件，没有插槽。现在用全局样式藏掉（`src/client/overrides.global.css`）。根治：给这个包打补丁把组件换成空的，或者请上游给运行指示加一个插槽。
4. **语言被锁住时的只读显示。** 见上面「语言」：靠推断，有盲区。根治要上游在设置视图里给出字段级的锁定信息。

### B. 要补丁才能换的

5. **默认工作区目录名里的 `deepseek-harness`。** `@deepseek-ai/dsh-api-workspace-controller/lib/index.js` 里拼路径时写死了这一段，配置项 `documentsDirectory` 只能换上一级目录。界面上显示为「默认工作区」，但完整路径会出现在工作区详情和模型的上下文里。补丁就是把那一段换成 `jiangxin`；只影响新登记的工作区，已经登记的不会挪。
6. **发给模型的上下文里的上游名字。** 系统提示词的开场白已经换掉，还剩：
   - 「开发上下文」（`harness-dev-context` 行）：告诉模型它在上游的 Web 界面里，还给出 DSH 的安装目录。上游的说明写明不想让模型知道这些时关掉这一行，发行目录的补丁 72 已经关了。
   - 运行时上下文里的文件策略说明（「Current DSH file policy …」）：来自 `@deepseek-ai/dsh-sandbox-policy`，没有配置项。要换只能补丁改那几处字面量。
   - 技能 `dsh-doc` 的说明：标准模式的预设通过 `skill-filesystem` 挂进来（`@deepseek-ai/dsh-agent-preset/skills/dsh-doc/SKILL.md`）。**这一条界面上也看得到**：在输入框里打「/」，菜单里有。两种改法：给那个 `SKILL.md` 打补丁改说明；或者在补丁里把 `preset-standard` 整行重写、去掉 `customSkillDirs`，但整行替换要照抄上游约 170 行配置，升级时容易漏。这个技能是教智能体扩展 DSH 本身的，留不留没有定。
   - 工具说明里的 DSH 字样（`bash`、`plugin_manager` 两个工具）：是给模型看的技术说明，建议不改。
   - 「轨迹」页签会把上面这些上下文原样显示出来。要让界面上彻底看不到，关掉 `ui-trajectory` 这一行：试过页签消失，对话不受影响。轨迹对排查问题有用，关不关没有定。
7. **发往模型网关的请求头 `User-Agent`。** 不在界面上，见 [distribution/README.md](../../distribution/README.md) 的「外联」。

### C. 有意保留的

- 关于行的「基于 DSH 0.2.2-rc.5 构建」，开源许可里上游的版权行和 MIT 许可全文（MIT 要求保留）。
- 首页标题旁的「预览版」徽标：是 DSH 自己的预览状态，不含品牌。语言包能改它的文字（`conversation / hero.preview`），但它是一个带底色的元素，换成空串会剩一个空框，没试过。

### D. 上游厂商的名字：随功能关闭，不改名

那些功能确实是对接上游厂商的，改了名就是在瞒用户。文案审计里中文共 14 条带厂商名：

- 账号（6 条）：发行目录的补丁 40 关掉了账号相关的行，界面上看不到。
- 联网搜索（8 条）：补丁 50 关掉了联网工具，界面上不出现。
- 「上传会话日志」开关：补丁 74 关掉了这一行。

### E. 没有覆盖的

- 客户端的窗口标题和图标归桌面壳（`apps/desktop/`）。薄壳里跑的是 `dsh web`，品牌包和 Web 端一样生效。如果改走「从源码构建上游桌面壳」，品牌包宿主一半的 Web 部分在那里不生效（没有 `webServer` 服务），要另外处理。
- DSH 自带的可选组合包带进来的界面和文案：没有逐个看。
- 命令行 `dsh` 的输出：给运维看的，没处理。

## 升级 DSH 时

这个包有几处依赖 DSH 的内部细节，升级后逐条核对：

1. **`package.json` 的 `engines.dsh` 要跟着改。** 不改的话 DSH 启动时会**跳过这个包，只在标准错误里打一行 `skipping profile bundle`（装在发行目录里时是 `disabling profile plugin row`），其余照常启动**，也就是产品带着 DSH 的品牌起来了（实测）。启动器的启动前检查和桌面壳都会拦这种情况。
2. **文案的键名。** `copy-overrides.ts` 里的键是 DSH 内部的。升级后跑一遍文案审计：`productLeft` 不为 0 说明上游新增了带品牌的句子；覆盖表里有、词典里没有的键是上游删掉或改名的。
3. **补丁里照抄的那句 `personaPrefix`。** 补丁对一行的配置是整行替换，所以关掉上游开场白时要把原有的 `personaPrefix` 一起写上。上游改了这句的话这里要跟着改：`dsh --dump-config` 看 `system-prompt` 那一行。
4. **三处靠内部结构的样式和脚本。** 启动加载页的字样（`src/host/index-html.ts` 的 `BOOT_PAGE_STYLE`）、对话进行中的图形（`src/client/overrides.global.css`）、浏览器标题（`TITLE_GUARD_SCRIPT`）。上游改了结构它们会悄悄失效，DSH 的字样或鲸鱼重新露出来，不会报错。升级后看一眼启动加载页、对话进行中的样子、打开会话后的标签页标题。
5. **读语言设置的那个服务。** 默认语言和语言行的只读态用的是 `ctx.configForms.get('locale')`（`@deepseek-ai/dsh-client-ui-settings` 的 README 里写了的接口），命名空间 `locale` 和字段 `preference` 是 DSH 语言插件自己的。上游改了这两个名字，默认语言会不生效（日语浏览器落回 DSH 的日语词典），不会报错。
6. **上面 A、B 两节的位置逐个再看一遍**，再按「检查」把界面走一遍。

## 文件

```
cordis.patch.yml     装上这个包以后 DSH 的组合要改的地方
NOTICE.md            上游的 MIT 许可全文与商标声明（随包分发）
assets/web/          宿主一半提供的图标（由 scripts/gen-icons.mjs 生成）
locale/              这个包在插件页里的名称与说明
src/brand.ts         名称都在这里
src/index.ts         宿主一半：网页标题、图标、首页注入、模型的自我介绍
src/host/            首页 HTML 的替换（纯函数）
src/client/          浏览器一半：侧栏、首页、主题色、文案、默认语言、设置里的两行、文案审计
tests/               对比度、文案覆盖表、默认语言、首页替换
```

## 许可与商标

上游项目的名字是它的商标（见 `NOTICE.md`），不出现在我们的产品名里。说明关系时写「基于 DSH 构建」。DSH 按 MIT 许可发布，许可全文在 `NOTICE.md`，界面上「设置 → 通用 → 开源许可」显示的是同一份。

这个包自己的代码用 MIT 许可，全文见仓库根目录的 `LICENSE`。`assets/web/` 下的图标，和 `lib/assets/` 下的两张标志图（源文件在 `src/client/assets/`），都是从匠心的 logo 生成的，和 logo 一样不在代码许可之内，见 [brand 的说明](../../brand/README.md)。
