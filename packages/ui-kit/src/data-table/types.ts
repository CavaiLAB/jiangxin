/** 数据表格的类型。只有类型，没有运行时代码。 */
import type { ReactNode } from 'react'

/** 排序方向。 */
export type SortDirection = 'asc' | 'desc'

/** 当前的排序：哪一列、什么方向。没有排序用 null 表示。 */
export interface DataTableSort {
  readonly columnId: string
  readonly direction: SortDirection
}

/** 一列的定义。 */
export interface DataTableColumn<T> {
  /** 列的标识；默认也是取值用的字段名。 */
  readonly id: string
  /** 表头文字，调用方给的是已经本地化的文字。 */
  readonly title: string
  /** 取这一列的原始值，用于默认渲染和排序；不给就读 `row[id]`。 */
  readonly value?: (row: T) => unknown
  /** 自定义单元格内容；不给就把原始值转成文字。 */
  readonly render?: (row: T) => ReactNode
  /** 表头能不能点击排序。 */
  readonly sortable?: boolean
  /** 单元格和表头的水平对齐。数字列、操作列用 end。默认 start。 */
  readonly align?: 'start' | 'end'
  /** 列宽：数字按像素，字符串原样当 CSS 宽度。 */
  readonly width?: number | string
}

/**
 * 表格自己要显示或朗读的文字，全部由调用方给出。
 * DSH 的规矩是基础组件不带文案：组件里一个写死的字都没有。
 */
export interface DataTableLabels {
  /** 加载中的状态文字。 */
  readonly loading: string
  /** 没有数据时的状态文字。 */
  readonly empty: string
  /** 表头全选框的名称。 */
  readonly selectAll: string
  /** 某一行选择框的名称；index 从 0 开始。 */
  readonly selectRow: (index: number) => string
  /** 排序按钮的补充说明，给读屏软件用；direction 是点击之后会变成的方向。 */
  readonly sortBy: (title: string, next: SortDirection | null) => string
}

/** 数据表格的属性。 */
export interface DataTableProps<T> {
  readonly columns: readonly DataTableColumn<T>[]
  /** 当前要显示的行。表格不自己排序、不自己分页，给什么显示什么。 */
  readonly rows: readonly T[]
  readonly getRowId: (row: T) => string
  /** 表格的名称，给读屏软件用。 */
  readonly label: string
  readonly labels: DataTableLabels
  /** 正在取数。已有行时保留旧行并置灰，没有行时显示加载状态。 */
  readonly loading?: boolean
  /** 当前排序（受控）。 */
  readonly sort?: DataTableSort | null
  /** 用户点了可排序的表头。调用方据此重新取数或在本地排序。 */
  readonly onSortChange?: (sort: DataTableSort | null) => void
  /** 是否显示选择列。 */
  readonly selectable?: boolean
  /** 选中的行（受控）。不给就由表格自己记。 */
  readonly selectedIds?: readonly string[]
  readonly onSelectionChange?: (ids: string[]) => void
  /** 表格下方的内容，例如「共 N 条」。 */
  readonly footer?: ReactNode
  /** 追加在最外层元素上的类名，只用来摆放位置。 */
  readonly className?: string
}
