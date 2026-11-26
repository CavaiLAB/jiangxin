# packages：插件包与组件包

| 包 | 是什么 | 在发行目录里 |
|---|---|---|
| [`brand-theme/`](brand-theme/README.md)（`@jx/brand-theme`） | 品牌包：名称、logo、主题色、界面文案、关于里的版本号与开源许可 | 装着，补丁是 `distribution/patches/70-jx-brand-theme.yml` |
| [`enterprise-workbench/`](enterprise-workbench/README.md)（`@jx/enterprise-workbench`） | 企业界面插件的样板：自己的后端接口加一个整页面板，台账数据是假的 | 作为样板装着，补丁是 `80-sample-jx-enterprise-workbench.yml`；正式发行前拿掉 |
| [`ui-kit/`](ui-kit/README.md)（`@jx/ui-kit`） | 界面组件（DSH 没有的基础组件由 shadcn 生成、样式是带 `jx:` 前缀的 Tailwind，另有手写的数据表格和抽屉）和插件构建脚本 `jx-dsh-plugin-build`。源码库，不是插件 | 不装，组件在构建时打进用它的插件包 |

都对着 DSH `0.2.2-rc.5`：`engines.dsh` 和 DSH 的开发依赖都写这个精确版本，和 `distribution/package.json` 保持一致。

## 怎么装、怎么检查

各包各用 pnpm，有自己的 `package.json`、`pnpm-lock.yaml` 和 `pnpm-workspace.yaml`（只用来写明依赖的安装脚本跑不跑），仓库根没有统一的工作区（原因见 [AGENTS.md](../AGENTS.md)「产品的代码」）。`brand-theme` 和 `enterprise-workbench` 用链接依赖 `link:../ui-kit` 引用 `ui-kit` 和它的构建脚本，所以先装 `ui-kit`：

```bash
cd packages/ui-kit && pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run test
```

```bash
cd packages/brand-theme && pnpm install --frozen-lockfile && pnpm run check
```

```bash
cd packages/enterprise-workbench && pnpm install --frozen-lockfile && pnpm run check
```

`check` 是类型检查、单测、构建三步。构建产物在各包的 `lib/`，不入库。

改完插件包，要让发行目录用上新版本，在仓库根跑 `distribution/scripts/vendor-packages.sh`，再把它改动的文件一起提交（见 [distribution/README.md](../distribution/README.md) 的「插件包怎么装进来」）。

## 写插件包的约定

- 不改 DSH 的源码，只用 DSH 公开的插件接口、插槽和配置。靠内部细节的地方在包的 README 里逐条写明（品牌包的「换不掉或靠取巧的位置」「升级 DSH 时」），升级 DSH 时核对。
- 包名用 `@jx/` 开头，插件行的 id 用 `jx-` 开头。启动前检查和桌面壳按这两个前缀认「我们自己的插件」，没加载就不启动。包名前缀是提议，没有确认（[2026-11-20 产品裁定](../docs/decisions/2026-11-20-product.md)第 3 节）。
- 一个插件包分宿主一半和浏览器一半，构建用 `jx-dsh-plugin-build`。写法照 [enterprise-workbench/README.md](enterprise-workbench/README.md) 的「照着写一个新插件」，构建产物的格式见 [ui-kit/README.md](ui-kit/README.md) 的「构建脚本」。
- 界面上 DSH 自带的控件直接用 DSH 的。DSH 没有的基础组件用 shadcn 生成进 `ui-kit`，缺哪个补哪个；怎么加、怎么写、放进 DSH 的弹窗里要注意什么，见 [ui-kit/README.md](ui-kit/README.md)。

## 以后可能加的包（提议）

都还没有建，名字和分工是提议：

| 包 | 放什么 |
|---|---|
| `dsh-compat` | 唯一允许直接引用 DSH 内部接口的包，其余的包只引用它。升级 DSH 时要核对的东西集中在这里 |
| `enterprise-auth` | 登录对接 |
| `enterprise-policy` | 工具护栏与设置的统一管控 |
| `enterprise-audit` | 审计 |

后三个各接什么：登录接 Kun 的身份服务（已定，[2026-11-25 平台级裁定](../docs/decisions/2026-11-25-platform.md) P57、P64）；工具护栏只是实例里的补充，不代替平台的权限判定，权限都走 Kun 这一套（已定，2026-11-26，P86）；审计接到哪里还没有记成裁定。DSH 的实例怎么和企业级平台对接，见 [DSH 与企业级平台的对接](../docs/09-dsh-integration.md)。
