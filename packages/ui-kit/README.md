# @jx/ui-kit

匠心自己的界面组件，按 DSH 的写法写：React 18、CSS Modules、只用 `--dsw-*` 变量，不用 Tailwind，不引第三方组件库。另外带一个在 DSH 仓库之外构建插件包的脚本。

这是**源码库，不是 DSH 插件**。它不会被 DSH 加载；用它的插件包在构建时把用到的组件打进自己的 `lib/client.js`。所以发行目录里不需要装它，只有开发插件包的地方需要。

现在只有一个组件：数据表格的最小版本。原则是「缺哪个迁哪个」，不成批搬 Qian（组件按 DSH 的写法迁，见 [2026-11-20 产品裁定](../../docs/decisions/2026-11-20-product.md) P38）。

## 里面有什么

| 路径 | 内容 |
|---|---|
| `src/data-table/` | 数据表格：列定义、排序、加载中与空状态、行选择 |
| `src/css-modules.d.ts` | 样式和图片的类型声明，用它的插件包要引进自己的 `tsconfig` |
| `tools/build-plugin.mjs` | 构建脚本，装上以后是命令 `jx-dsh-plugin-build` |
| `tests/` | 排序与选择逻辑的单测（`node --test`） |

## 在一个插件包里用

装（开发依赖）。同一个上级目录下开发时用链接；别处用 tarball：

```bash
pnpm add -D link:../ui-kit
```

```bash
cd packages/ui-kit && pnpm pack --pack-destination <放 tarball 的目录>
```

```bash
pnpm add -D <放 tarball 的目录>/jx-ui-kit-0.1.0.tgz
```

`tsconfig.json` 的 `include` 里加上类型声明（链接安装和 tarball 安装路径一样）：

```json
{ "include": ["src", "node_modules/@jx/ui-kit/src/css-modules.d.ts"] }
```

`package.json` 里把构建指到这个包的脚本：

```json
{ "scripts": { "build": "jx-dsh-plugin-build", "watch": "jx-dsh-plugin-build --watch" } }
```

从 tarball 安装再构建这条路也试过。

### 数据表格

```tsx
import { DataTable, type DataTableColumn, type DataTableSort } from '@jx/ui-kit'

const columns: DataTableColumn<Equipment>[] = [
  { id: 'code', title: '设备编号', value: row => row.code, sortable: true, width: 120 },
  { id: 'status', title: '状态', render: row => <Tag tone="success">{row.status}</Tag> },
  { id: 'hours', title: '累计运行（小时）', value: row => row.hours, sortable: true, align: 'end' },
]

<DataTable
  label="设备台账"
  columns={columns}
  rows={rows}
  getRowId={row => row.id}
  labels={{
    loading: '正在加载…',
    empty: '没有符合条件的设备',
    selectAll: '全选',
    selectRow: index => `选择第 ${index + 1} 行`,
    sortBy: (title, next) => `按${title}排序`,
  }}
  loading={loading}
  sort={sort}
  onSortChange={setSort}
  selectable
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}
  footer={<span>共 {rows.length} 台</span>}
/>
```

要点：

- **给什么行显示什么行。** 排序是受控的：用户点表头，组件只通知 `onSortChange`，由调用方决定重新取数（服务端排序）还是在本地排（`sortRows` 是现成的本地排序函数）。分页、筛选同理，组件不管。
- **文字全部由调用方给**（`labels`）。组件不碰 DSH 的语言服务，也不碰 Qian 的，所以两边都能用。
- **加载中有两种样子**：没有行时显示加载状态；已有行时保留旧行并置灰，避免表格闪一下变空。
- 表头的排序按钮带 `aria-sort`；全选框有「部分选中」这一态。

完整的属性说明在 `src/data-table/types.ts` 的注释里。实际用法见 `packages/enterprise-workbench/src/client/WorkbenchPage.tsx`。

### 和 Qian 原件的差别

原件是 Qian 仓库里的 `packages/qian/data/src/components/data-table.tsx`（`@cavailab/qian-data`）。

| | Qian 原件 | 这里 |
|---|---|---|
| 行为从哪来 | TanStack Table 的七个功能模块 | 自己写的排序与选择逻辑（`sort.ts`，94 行） |
| 控件 | Qian 的 `Button`、`Checkbox`、`Select`、`Pagination`、`Popover` 等 12 个 | DSH 的图标和 `StateDot`；全选框是原生 `input` |
| 样式 | Tailwind 类名 | CSS Modules 加 `--dsw-*` 变量（167 行） |
| React | 19 | 18（DSH 给插件共享的是 18.3.1） |
| 文字 | `PlatformI18n` | 调用方传 `labels` |
| 有的功能 | 排序、行选择、分页、列筛选、列固定、列宽拖动、显示列开关、工具行、出错重试 | 排序、行选择、加载中、空状态、页脚 |

没迁的功能（分页、列筛选、列固定、列宽、显示列、工具行、出错重试、从右到左排版）不是做不了，是现在只做了最小版本。要哪个补哪个。

## 迁组件时的难点

从 Qian 迁数据表格时碰到的，迁别的组件也会碰到：

1. **Qian 的组件是 Base UI 的薄包装，DSH 没有 Base UI。** 焦点管理、键盘操作、弹层定位这些行为原来由 Base UI 提供，迁过来要自己写。数据表格用不到这些，所以快；带搜索的选择器（Qian 靠 Base UI 的 Combobox）、日期这类组件的工夫主要花在这里。
2. **TanStack Table 去掉了**，排序和选择自己写。分页、列筛选、列固定、列宽、显示列开关都要另外补。
3. **DSH 的 `Checkbox` 总是带文字标签，也没有「部分选中」**，全选框改用原生 `input`，配色照它的写法。
4. **DSH 没有给第三方的变量清单**，表格的边框、悬停、选中色是照 DSH 同类组件的样式抄的。
5. **React 19 → 18**（DSH 共享给插件的是 18.3.1）。
6. **文字**：Qian 用 `PlatformI18n`，这里改成调用方传 `labels`。
7. 显示上的小问题：表头有全角括号时排序按钮差 1.5px（改成 `vertical-align: middle`）；正圆要加 `corner-shape: round`（见下面「写组件的规矩」第 3 条）。

DSH 的基础组件（`@deepseek-ai/dsh-client-ui-primitives`）能直接用的有按钮、输入框、开关、复选框、菜单、弹窗、提示、气泡、标签、分段切换、图片预览，大约覆盖 Qian 基础组件的一半。DSH 没有的：带搜索的选择器、日期与时间选择、树与树选择、侧滑抽屉（有 `Modal`）。按 JSON Schema 生成表单（Qian 的 SchemaForm）依赖 react-hook-form 和 ajv，可以作为私有副本打进插件包（DSH 允许），要看体积；DSH 自己的 `SettingsForm` 能不能脱离设置页用，没试过。

## 写组件的规矩

这些是照 DSH 自己的组件摸出来的，写新组件时照做：

1. **样式用 CSS Modules**（`x.module.css`），类名在构建时加哈希，不会和 DSH 或别的插件撞。
2. **颜色、圆角、字号只用 `--dsw-*` 变量**，不写死色值。这样深浅两种模式、品牌包换的主题色都自动跟着走。用哪个变量，照 DSH 同类组件的样式抄（DSH 源码里 `packages/client/ui-*/src/client/*.module.css`）；DSH 没有一份给第三方的变量清单。
3. **正圆和胶囊形要同时写 `corner-shape: round`。** DSH 的主题给所有元素设了超椭圆圆角，`border-radius: 50%` 的圆会被压成方圆角（实测）。
4. **图标、按钮、输入框、开关、菜单、弹窗、标签用 DSH 的**（`@deepseek-ai/dsh-client-ui-primitives`）。它没有的再自己写。
5. **只用 React 18 有的接口。** Qian 是 React 19，迁过来时留意 `use`、把 `ref` 当普通属性传这类写法。
6. **文字不写死在组件里**，由调用方传进来。
7. **全局样式（`x.global.css`）只在必须盖住别人的样式时用**，组件自己的样式一律用 CSS Modules。

## 构建脚本

`jx-dsh-plugin-build` 在插件包目录里执行，按约定找两半：

| 源码 | 产物 | 说明 |
|---|---|---|
| `src/index.ts` | `lib/index.js` | 宿主一半，Node 里跑的 ESM。所有裸模块都外置，运行时从 DSH 的安装里解析 |
| `src/client/index.ts(x)` | `lib/client.js` | 浏览器一半，DSH 客户端模块要的「懒工厂」格式：`window.__ModuleLoader__.load({ id: '<包名>', factory: (require) => { … } })`。DSH 共享的模块外置，其余打进包里 |
| `src/client/**/*.module.css` | 打进 `lib/client.js` | lightningcss 编译成带哈希的类名表，工厂执行时注入 `<style data-plugin="<包名>">`；`x.global.css` 原样注入 |
| `src/client/assets/*` | `lib/assets/<名字>-<内容摘要>.<扩展名>` | 浏览器一半里 `import` 的图片，代码里拿到的是 `require.asset('plugins/<包名>/assets/…')` |

DSH 自己的构建预设没有发布到 npm，它的文档明说仓库外的包要自己复刻这套构建（DSH 源码的 `docs/cookbook/adding-a-settings-card.md`：预设在 `packages/client/tsdown.client.ts` 里，不在已发布的包里）。这个脚本复刻的是**产物格式**，用的是 esbuild 加 lightningcss（DSH 用 tsdown 加 lightningcss）。

升级 DSH 时要核对两处，都在脚本开头：

- `DSH_PLATFORM_MODULES`：DSH 给插件共享、不打进包里的模块表。出处是 DSH 源码的 `packages/client/web/src/platform.ts`。表里多写了一个 DSH 没共享的模块，插件运行时会报找不到模块。
- 产物的外壳格式（`window.__ModuleLoader__.load({ id, factory })`）。出处是 DSH 源码的 `packages/client/modules/README.md`。

## 检查

```bash
pnpm install
```

```bash
pnpm run typecheck && pnpm run test
```

## 还没做的

- 只有一个组件。
- 没有组件的渲染测试，只测了排序与选择的纯逻辑。界面是在浅色、深色两种模式下截图核对的，截图脚本没有入库。
- 现在每个插件各打一份组件代码进自己的包。插件多了以后要不要改成一个共享的客户端模块，没有试过。
