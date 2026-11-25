# @jx/ui-kit

匠心自己的界面组件包。DSH 没有的基础组件由 shadcn 的命令行生成进来（底下是 Base UI，样式是带 `jx:` 前缀的 Tailwind），再按 DSH 的规矩适配；另有手写的组件（数据表格、抽屉），和一个在 DSH 仓库之外构建插件包的脚本。

这是**源码库，不是 DSH 插件**。它不会被 DSH 加载；用它的插件包在构建时把用到的组件打进自己的 `lib/client.js`。所以发行目录里不需要装它，只有开发插件包的地方需要。

现在有：带搜索的选择器、下拉选择、日期选择、单选组、多行输入（这五个由 shadcn 生成），抽屉，数据表格的最小版本。DSH 自带的控件直接用 DSH 的，这里只补它没有的，缺哪个补哪个。基础组件用 shadcn 加 Tailwind 是 [2026-11-25 平台级裁定](../../docs/decisions/2026-11-25-platform.md) P76 定的；组件放在这个包、DSH 自带的优先、弹窗和抽屉的壳用 DSH 的、Tailwind 只在这个包里用并带前缀，是照在 DSH 里试过的结果定的做法，没有逐条裁定。

## 里面有什么

| 路径 | 内容 |
|---|---|
| `src/ui/` | shadcn 生成、适配过的基础组件。对外导出带搜索的选择器（`Combobox` 一组）、下拉选择（`Select` 一组）、日期选择（`DatePicker`，外壳是手写的，里面是生成的浮层和日历）、单选组（`RadioGroup`、`RadioGroupItem`）、多行输入（`Textarea`）。按钮、输入框、输入组、浮层、日历只给这几个组件内部用，不导出 |
| `src/drawer/` | 抽屉 `Drawer`：DSH 的 `Modal`（`headless`）加定位的样式 |
| `src/data-table/` | 数据表格（手写，CSS Modules） |
| `src/lib/` | 弹层的落脚容器 `PortalContainerProvider`、层级 `LAYER`、照 DSH 的输入框和菜单量出来的公共类名（`field.ts`） |
| `src/styles/jx.tailwind.css` | Tailwind 的入口，按 DSH 的规矩改过，见下面「样式入口」 |
| `src/css-modules.d.ts` | 样式和图片的类型声明，用它的插件包要引进自己的 `tsconfig` |
| `components.json` | shadcn 命令行的配置：风格 `base-nova`、类名前缀 `jx`、生成到 `src/ui/` |
| `tools/build-plugin.mjs` | 构建脚本，装上以后是命令 `jx-dsh-plugin-build` |
| `tools/shadcn-add.mjs`、`tools/adapt-generated.mjs` | 加组件：调 shadcn 命令行生成，再做机械的适配（`pnpm run ui:add`、`pnpm run ui:adapt`） |
| `tools/react18-refs.mjs` | 找出在 React 18 上收不到 ref 的组件，并给出改法 |
| `tests/` | 单测（`node --test`），见「检查」 |
| `NOTICE.md` | 生成的代码和打进插件包的依赖各自的许可 |

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

用链接装时，组件库的依赖装在 `ui-kit` 自己的目录里，所以先在 `packages/ui-kit` 里 `pnpm install`。用 tarball 装时，依赖装进插件包自己的目录，插件包的 `pnpm-workspace.yaml` 要写明两个依赖的安装脚本跑不跑（pnpm 11 起，没写明的会让安装报错）：

```yaml
allowBuilds:
  esbuild: true
  # Tailwind 命令行间接带的文件监听库。预编译的二进制是按平台的可选依赖，不用跑它的安装脚本。
  '@parcel/watcher': false
```

两种装法都试过：都能构建，样式和类名哈希一样，代码只差 esbuild 给几个 CommonJS 模块加的路径标签。

`tsconfig.json` 的 `include` 里加上类型声明（链接安装和 tarball 安装路径一样）：

```json
{ "include": ["src", "node_modules/@jx/ui-kit/src/css-modules.d.ts"] }
```

`package.json` 里把构建指到这个包的脚本：

```json
{ "scripts": { "build": "jx-dsh-plugin-build", "watch": "jx-dsh-plugin-build --watch" } }
```

插件包不用自己装 Tailwind，也不用另跑命令：组件引入了样式入口，构建脚本遇到它先用 Tailwind 编译，再打进包里（见「构建脚本」）。

### 基础组件

```tsx
import { DatePicker, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, zhCN } from '@jx/ui-kit'

const items = [{ value: 'all', label: '全部车间' }, { value: 'weld', label: '焊装车间' }]

<Select items={items} value={workshop} onValueChange={setWorkshop}>
  <SelectTrigger aria-label="车间" className="jx:w-36">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
  </SelectContent>
</Select>

<DatePicker value={date} onValueChange={setDate} locale={zhCN} placeholder="不限" aria-label="上次保养" />
```

要点：

- **用法和 shadcn 的文档一样**，属性就是 Base UI 对应组件的属性。`Select`、`Combobox` 给了 `items`，选中的值才会显示成对应的 `label`。`DatePicker` 是这里自己包的：`value` 是 `Date` 或 `null`；`locale` 决定日历的语言（本包导出 `zhCN`、`enUS`）；`formatDate` 决定按钮上怎么写日期。
- **日期选择的名字。** `aria-label` 给的是字段名，组件把按钮上显示的字接在后面，拼好放到按钮的 `aria-label` 上：上面的例子读屏听到的是「上次保养 2026/11/18」，没选时是「上次保养 不限」。所以占位文字要写成接在字段名后面读得通的样子。按钮上显示的字已经带着字段名时（比如页面上没有标签的筛选，按钮上写「上次保养：不限」），不用给 `aria-label`，名字就是按钮上的字。用 `<label htmlFor>` 关联的，也要把标签的文字传给 `aria-label`：只靠 label 关联，名字里只有标签、听不到日期。也可以给 `aria-labelledby`（写着字段名的元素的 id），组件同样把日期接在后面，但有的检查工具不认 `aria-labelledby`。
- **调宽度、间距，给组件传 `jx:` 开头的类名**（`className="jx:w-52"`）。组件内部用 `cn` 合并类名，传进去的会替换掉组件自己的同类类名。用 CSS Modules 的类名改同一个属性，谁赢要看两份样式表注入的先后，靠不住。插件自己的布局照旧用 CSS Modules，`jx:` 类名只写在传给本包组件的 `className` 上。
- **放进 DSH 的弹窗或抽屉时**，照下面「放进 DSH 弹窗的两条规矩」做。
- 文字都由调用方给：占位文字、读屏用的名字、空列表的提示。

完整用法见 `packages/enterprise-workbench/src/client/WorkbenchFilters.tsx`：页面上的快捷筛选、抽屉里的「更多筛选」、DSH 弹窗里的导出选项。

### 抽屉

```tsx
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Drawer } from '@jx/ui-kit'

<Drawer open={open} onClose={close} title="更多筛选" closeLabel="关闭" footer={<Button variant="primary" onClick={apply}>应用</Button>}>
  {/* 表单 */}
</Drawer>
```

壳是 DSH 的 `Modal`：遮罩、按 Esc 关闭、焦点留在里面、关掉以后焦点回到打开它的按钮，都是 DSH 的行为。正文已经包好了 `PortalContainerProvider`。缺省从右边出来、宽 420px（`side`、`width` 可改）。打开以后焦点先落在关闭按钮上；要换成正文里的某个控件，给它加 `data-modal-autofocus` 属性（DSH 的约定）。

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

## 放进 DSH 弹窗的两条规矩

DSH 的弹窗打开时在整个页面上听按键：Esc 没被别人处理掉，就关最上面那层；焦点跑到弹窗外面（菜单除外），就把 Tab 拦下来，把焦点拉回弹窗。本包的弹层缺省挂在页面最外层，会撞上这条。在 DSH 里实测，照下面两条做就不冲突：

1. **弹层落在弹窗里面。** 在 DSH 的 `Modal` 的正文外面包一层 `PortalContainerProvider`。它在弹窗里放一个不占位置的容器，里面的下拉、选择器、日期面板都挂进这个容器，DSH 就把它们当成弹窗的一部分：下拉里按 Tab，下拉关闭、焦点到下一个字段；日期面板里按 Tab，在月份按钮和日期格之间走；按 Esc 只关弹层，再按一次才关弹窗；弹层也不会被弹窗的卡片裁掉。不包的话，在下拉里按 Tab，焦点被拉到弹窗的关闭按钮上，下拉还开着。本包的 `Drawer` 已经包好了。容器还接住一种情况：弹层收起有约 150 毫秒的动画，很快地连按 Tab 时焦点会落进正在收起的弹层（日期面板里有按钮），弹层一卸载焦点就掉到 body、再被 DSH 拉回弹窗开头；容器把这种焦点接着交给它后面的元素（一般是页脚的按钮），Shift+Tab 时交给前面的。

   ```tsx
   <Modal open={open} onClose={close} title="导出" closeLabel="关闭">
     <PortalContainerProvider>
       {/* 用到下拉、选择器、日期的表单 */}
     </PortalContainerProvider>
   </Modal>
   ```

2. **壳用 DSH 的。** 对话框用 DSH 的 `Modal`，抽屉用本包的 `Drawer`（也是 DSH 的 `Modal` 改的）。shadcn 的对话框、抽屉、侧边面板、确认框不进这个包：第三方的对话框和 DSH 的菜单互不认识，在里面打开 DSH 的菜单，方向键不动，按 Esc 菜单和对话框一起关。

层级：弹层是 1100，和 DSH 的浮层菜单同一层；DSH 的弹窗是 1000。两个数在 `LAYER` 里。

## 加一个组件怎么做

1. **先看 DSH 有没有。** `@deepseek-ai/dsh-client-ui-primitives` 里有的（按钮、输入框、复选框、开关、标签、提示、菜单、弹窗、轻提示、分段切换、图标等），直接用 DSH 的，不进这个包。
2. **生成。** 在 `packages/ui-kit` 里：

   ```bash
   pnpm run ui:add <组件名…>
   ```

   它用固定版本的 shadcn 命令行（4.23.0），按 `components.json` 把组件写进 `src/ui/`，要联网读 shadcn 的组件清单。已有的文件不覆盖，要覆盖加 `--overwrite`。命令行想装的依赖不会真装（它装的时候不带版本，会把已有的依赖顶成 `^` 范围），只打印出来：哪些已经有，哪些缺了、生成的代码有没有用到。缺的按精确版本补：`pnpm add -E <名字>@<版本>`，挑发布两周以上的版本。
3. **适配。** `ui:add` 生成完自动跑一遍 `tools/adapt-generated.mjs`；单独跑是 `pnpm run ui:adapt [文件…]`，不给文件就过一遍整个 `src/ui/`，跑几遍结果都一样。它做机械的部分：去掉 `"use client"`；路径别名换成相对路径；层级换成 1100；圆角变量换成 DSH 的；补上漏掉的前缀；`*.Portal` 接上落脚容器；在 React 18 上收不到 ref 的组件改成 `forwardRef`（靠类型检查器判断，不用点名）；引入样式入口。改不了的打印出来、退出码 1，留给人改。
4. **手调到和 DSH 的控件一致。** 照下面「写组件的规矩」第 3、4 条。输入框一类的外框用 `lib/field.ts` 的 `fieldFrame`、`fieldPadding`、`fieldFocus`、`fieldPlaceholder`，弹层的卡片和选项用 `popupCard`、`popupItem`；尺寸、圆角、字号对照 DSH 的同类控件。在文件开头写一段注释：哪些是生成的，手调了什么。
5. **导出。** `src/index.ts` 里只导出给插件用的部分。生成时一起带进来的按钮、输入框这类，DSH 已经有，只给内部用。
6. **许可。** 新引进的、会打进插件包的依赖，补进 `NOTICE.md`。
7. **检查。** `pnpm run typecheck && pnpm run test`。
8. **在真的 DSH 里看一遍。** 放进一个插件（比如 `enterprise-workbench`），浅色、深色各看一次；放进 DSH 的弹窗和抽屉里按 Tab、Esc，结果要和上一节说的一样。

## 写组件的规矩

照 DSH 自己的组件和在 DSH 里实测的结果定的，生成的和手写的组件都照做：

1. **DSH 有的控件用 DSH 的**（`@deepseek-ai/dsh-client-ui-primitives`），这里只补它没有的，也不转手导出 DSH 的控件。
2. **样式。** 生成的组件用 Tailwind，类名都带 `jx:` 前缀，只用本包的样式入口，不另起一份 Tailwind 配置。手写的组件可以用 CSS Modules（`x.module.css`，类名在构建时加哈希，不会和 DSH 或别的插件撞）。全局样式（`x.global.css`）只在必须盖住别人的样式时用。
3. **颜色、圆角只用 DSH 的变量**，不写死色值。Tailwind 的语义色（`bg-primary`、`border-input`、`text-muted-foreground` 等）和圆角（`rounded-xs` 到 `rounded-xl`）在样式入口里都对到了 `--dsw-*`；对照表里没有的，直接写变量，如 `jx:bg-(--dsw-alias-bg-layer-1)`。这样深浅两种模式、品牌包换的主题色都自动跟着走。用哪个变量，照 DSH 同类组件的样式抄（DSH 源码里 `packages/client/ui-*/src/client/*.module.css`）；DSH 没有一份给第三方的变量清单。
4. **尺寸照 DSH 的同类控件。** 输入框一类和 DSH 的输入框一样：圆角 12px、0.5px 的边框、字号 14px、行高 22px，高度由上下 5px 的内边距加行高撑出来（100% 缩放下是 34px）。不写死高度，写死的在有的缩放比例下和 DSH 对不齐。小号圆角 8px、字号 13px。弹层的卡片圆角 16px、内边距 4px、用 DSH 的浮层阴影；选项最矮 34px、字号 13px。这些都在 `lib/field.ts` 里，直接用。
5. **正圆和胶囊形要 `corner-shape: round`。** DSH 的主题给所有元素设了超椭圆圆角，`border-radius: 50%` 的圆会被压成方圆角（实测）。样式入口里给 `jx:rounded-full` 统一加了；手写的 CSS 要自己写。
6. **只用 React 18 有的接口。** DSH 给插件共享的是 React 18.3.1，shadcn 生成的代码按 React 19 写（`ref` 当普通属性传）。把 props 交给 DOM 元素或别的收 ref 的组件时，要用 `forwardRef` 包起来、把 ref 交下去，不要从 props 里解构 `ref`。收不到 ref 时不报错，只是弹层找不到该对齐的元素。类型检查查不出来，`pnpm run test` 里有专门的检查。
7. **弹层要能落进 DSH 的弹窗**：`*.Portal` 的 `container` 用 `usePortalContainer()` 取，层级 1100。适配脚本会做；手写的弹层自己照做。
8. **文字不写死在组件里**，由调用方传进来。

## 样式入口

`src/styles/jx.tailwind.css` 和 shadcn 的标准写法相比改了这几处，都在 DSH 里实测过：

- **类名带 `jx:` 前缀**（`jx:flex`、`jx:hover:bg-accent`），只作用于自己的元素。
- **不引 Tailwind 的全局重置**：它重置整个页面，DSH 的界面也在这个页面里。换成一个小重置，只作用于带 `jx:` 类名的元素：盒模型、边框、内外边距，表单元素的字体和底色。
- **工具类不放进层**（`@layer`）。DSH 的样式都不分层，分层的规则遇上不分层的一定输，组件的圆角形状、焦点色会被 DSH 的全局规则盖掉。
- **深色跟着 DSH**：DSH 切到深色时 `body` 上有 `data-ds-dark-theme`，`jx:dark:` 认的是它。
- **语义色和圆角全部指到 DSH 的 `--dsw-*` 变量**，直接写在 `@theme inline` 里，不在页面上另挂 `--primary` 这类通用的变量名，免得和别的插件撞。
- **`jx:rounded-full` 带上 `corner-shape: round`**。

另外从 shadcn 抄了九条认 Base UI 状态属性的变体（`data-open:`、`data-checked:` 等），动画用 `tw-animate-css`。

## 迁组件时的难点

从 Qian 迁数据表格时碰到的，迁别的组件也会碰到：

1. **焦点管理、键盘操作、弹层定位这些行为**，Qian 的组件靠 Base UI 提供，DSH 没有 Base UI。现在本包也用 Base UI（随 shadcn 生成的组件带进来），带搜索的选择器、日期这类组件不用自己写这些行为，代价是 Base UI 打进了用它的插件包（体积见「还没做的」）。数据表格是手写的，用不到这些。
2. **TanStack Table 去掉了**，排序和选择自己写。分页、列筛选、列固定、列宽、显示列开关都要另外补。
3. **DSH 的 `Checkbox` 总是带文字标签，也没有「部分选中」**，全选框改用原生 `input`，配色照它的写法。
4. **DSH 没有给第三方的变量清单**，表格的边框、悬停、选中色是照 DSH 同类组件的样式抄的。
5. **React 19 → 18**（DSH 共享给插件的是 18.3.1）。
6. **文字**：Qian 用 `PlatformI18n`，这里改成调用方传 `labels`。
7. 显示上的小问题：表头有全角括号时排序按钮差 1.5px（改成 `vertical-align: middle`）；正圆要加 `corner-shape: round`（见上面「写组件的规矩」第 5 条）。

DSH 的基础组件（`@deepseek-ai/dsh-client-ui-primitives`）能直接用的有按钮、输入框、开关、复选框、菜单、弹窗、提示、气泡、标签、分段切换、图片预览，大约覆盖 Qian 基础组件的一半。DSH 没有的：带搜索的选择器、日期与时间选择、树与树选择、侧滑抽屉（有 `Modal`）；其中带搜索的选择器、日期选择、抽屉本包现在有了。按 JSON Schema 生成表单（Qian 的 SchemaForm）依赖 react-hook-form 和 ajv，可以作为私有副本打进插件包（DSH 允许），要看体积；DSH 自己的 `SettingsForm` 能不能脱离设置页用，没试过。

## 构建脚本

`jx-dsh-plugin-build` 在插件包目录里执行，按约定找两半：

| 源码 | 产物 | 说明 |
|---|---|---|
| `src/index.ts` | `lib/index.js` | 宿主一半，Node 里跑的 ESM。所有裸模块都外置，运行时从 DSH 的安装里解析 |
| `src/client/index.ts(x)` | `lib/client.js` | 浏览器一半，DSH 客户端模块要的「懒工厂」格式：`window.__ModuleLoader__.load({ id: '<包名>', factory: (require) => { … } })`。DSH 共享的模块外置，其余打进包里 |
| `src/client/**/*.module.css` | 打进 `lib/client.js` | lightningcss 编译成带哈希的类名表，工厂执行时注入 `<style data-plugin="<包名>">`；`x.global.css` 原样注入 |
| `*.tailwind.css`（插件自己的，或依赖里的，比如本包的样式入口） | 打进 `lib/client.js` | 先用本包带的 Tailwind 命令行编译，扫描插件自己的 `src/` 和样式表里 `@source` 指的目录；再交给 lightningcss，照 `x.global.css` 的方式注入 |
| `src/client/assets/*` | `lib/assets/<名字>-<内容摘要>.<扩展名>` | 浏览器一半里 `import` 的图片，代码里拿到的是 `require.asset('plugins/<包名>/assets/…')` |

注入的样式标签按「插件包名/样式文件的位置」编号，类名的哈希也按这个位置算。插件包自己的文件用包内的相对路径，依赖里的文件用「包名/包内路径」（如 `@jx/ui-kit/src/styles/jx.tailwind.css`），所以换个目录构建、换种装法，样式标签和类名都不变。

DSH 自己的构建预设没有发布到 npm，它的文档明说仓库外的包要自己复刻这套构建（DSH 源码的 `docs/cookbook/adding-a-settings-card.md`：预设在 `packages/client/tsdown.client.ts` 里，不在已发布的包里）。这个脚本复刻的是**产物格式**，用的是 esbuild 加 lightningcss（DSH 用 tsdown 加 lightningcss）。

升级 DSH 时要核对两处，都在脚本开头：

- `DSH_PLATFORM_MODULES`：DSH 给插件共享、不打进包里的模块表。出处是 DSH 源码的 `packages/client/web/src/platform.ts`。表里多写了一个 DSH 没共享的模块，插件运行时会报找不到模块。
- 产物的外壳格式（`window.__ModuleLoader__.load({ id, factory })`）。出处是 DSH 源码的 `packages/client/modules/README.md`。

## 检查

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm run typecheck && pnpm run test
```

`pnpm run test` 里有三组：

- 数据表格的排序与选择逻辑。
- `src/` 下的组件在 React 18 上都收得到 ref（`tools/react18-refs.mjs`）。有组件把 props 交给收 ref 的元素、自己却是普通函数组件，这一条就失败，并指出文件、行号和怎么改。这一条类型检查替代不了：按 React 19 写的组件在 React 18 的类型下 0 个错误。
- 样式入口经构建脚本编出来的结果：插件代码里的 `jx:` 类名编进来了，没有 Tailwind 的全局重置，工具类不在层里，小重置和正圆的规则都在。

## 还没做的

- **每个插件各打一份组件库。** 样板插件用了这几个组件，浏览器一半从 24 KB 涨到 769 KB（gzip 后从 7 KB 到 174 KB），其中 Base UI 约占六成，日期一组（react-day-picker、date-fns）近两成。组件库做成一个插件、各插件共用一份，在 DSH 里试过，可行：提供方 366 KB，两个使用方各 6.5 KB，模块在页面里只执行一次。还没做。
- 每个用组件的插件注入自己的一份 Tailwind 样式，规则相同，重复但不冲突。编出来的样式包含本包所有组件的类名，和插件用了几个组件无关。
- 多选的选择器（`ComboboxChips` 一组）生成了，没有导出，也没有在 DSH 里核对。
- 弹层的卡片用不透明的底色。DSH 自己的菜单是半透明加模糊，DSH 在 macOS 的桌面上还要多垫一层，没有照搬。
- 只在网页端核对过。桌面壳里、用输入法打中文时的带搜索的选择器，都没试。
- 时间选择、日期范围、树与树选择还没有。
- 没有组件的渲染测试。界面是在真的 DSH 里按浅色、深色截图核对的，截图不入库。
