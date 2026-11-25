/**
 * @jx/ui-kit：匠心自己的界面组件，只补 DSH 没有的。按钮、输入框、复选框、开关、标签、提示、菜单、弹窗、轻提示、
 * 分段切换这些直接用 DSH 的（@deepseek-ai/dsh-client-ui-primitives），这里不重复导出。
 *
 * - 数据表格：手写，CSS Modules 加 --dsw-* 变量。
 * - 带搜索的选择器、下拉选择、日期选择、单选组、多行输入：shadcn 命令行生成（底下是 Base UI），样式是带 jx: 前缀的
 *   Tailwind，按 DSH 的规矩适配过。样式在插件构建时由 jx-dsh-plugin-build 编进去，插件不用多写一步。
 * - 抽屉：DSH 的 Modal 改的。
 * - 放进 DSH 弹窗的弹层：PortalContainerProvider。
 */
export { DataTable } from './data-table/DataTable.tsx'
export { nextSort, sortRows } from './data-table/sort.ts'
export type {
  DataTableColumn,
  DataTableLabels,
  DataTableProps,
  DataTableSort,
  SortDirection,
} from './data-table/types.ts'

export {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from './ui/combobox.tsx'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select.tsx'
export { DatePicker, enUS, zhCN, type DateLocale, type DatePickerProps } from './ui/date-picker.tsx'
export { RadioGroup, RadioGroupItem } from './ui/radio-group.tsx'
export { Textarea } from './ui/textarea.tsx'

export { Drawer, type DrawerProps } from './drawer/Drawer.tsx'

export { PortalContainerProvider, usePortalContainer } from './lib/portal-container.tsx'
export { LAYER } from './lib/layers.ts'
export { cn } from 'cn'
