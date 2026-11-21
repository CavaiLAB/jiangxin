/** 排序与选择的纯函数：不依赖 React，可以单独测试。 */
import type { DataTableColumn, DataTableSort, SortDirection } from './types.ts'

/**
 * 点击表头之后的排序：没排 → 升序 → 降序 → 不排。点另一列从升序开始。
 * @param current 当前排序。
 * @param columnId 被点击的列。
 * @returns 新的排序；null 表示不排序。
 */
export function nextSort(current: DataTableSort | null | undefined, columnId: string): DataTableSort | null {
  if (current == null || current.columnId !== columnId) return { columnId, direction: 'asc' }
  if (current.direction === 'asc') return { columnId, direction: 'desc' }
  return null
}

/** 点击这一列之后会变成的方向，给读屏说明用。 */
export function nextDirection(current: DataTableSort | null | undefined, columnId: string): SortDirection | null {
  return nextSort(current, columnId)?.direction ?? null
}

/** 取一列的原始值：有 value 用 value，否则读同名字段。 */
export function cellValue<T>(column: DataTableColumn<T>, row: T): unknown {
  if (column.value !== undefined) return column.value(row)
  return (row as Record<string, unknown>)[column.id]
}

/** 空值排在最后，数字按大小，其余按文字比较（数字段按数值，如「设备 9」在「设备 10」前）。 */
function compareValues(a: unknown, b: unknown): number {
  const emptyA = a === null || a === undefined || a === ''
  const emptyB = b === null || b === undefined || b === ''
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * 在本地给行排序，返回新数组，不改原数组。
 * 表格本身不排序；数据量小、不想回服务端时调用方可以用这个函数。
 * @param rows 原始行。
 * @param columns 列定义，用来找到取值方法。
 * @param sort 排序；null 或找不到列时按原顺序返回。
 */
export function sortRows<T>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  sort: DataTableSort | null | undefined,
): T[] {
  const column = sort == null ? undefined : columns.find(item => item.id === sort.columnId)
  if (sort == null || column === undefined) return [...rows]
  const sign = sort.direction === 'asc' ? 1 : -1
  // 带上原下标，值相等时保持原顺序；空值不随方向翻转，始终在最后。
  return rows
    .map((row, index) => ({ row, index, value: cellValue(column, row) }))
    .sort((a, b) => {
      const emptyA = a.value === null || a.value === undefined || a.value === ''
      const emptyB = b.value === null || b.value === undefined || b.value === ''
      if (emptyA !== emptyB) return emptyA ? 1 : -1
      return sign * compareValues(a.value, b.value) || a.index - b.index
    })
    .map(item => item.row)
}

/** 表头全选框的三种状态。 */
export type SelectAllState = 'none' | 'some' | 'all'

/**
 * 当前页的全选状态。
 * @param rowIds 当前显示的行。
 * @param selected 选中的行。
 */
export function selectAllState(rowIds: readonly string[], selected: ReadonlySet<string>): SelectAllState {
  if (rowIds.length === 0) return 'none'
  const count = rowIds.reduce((total, id) => total + (selected.has(id) ? 1 : 0), 0)
  return count === 0 ? 'none' : count === rowIds.length ? 'all' : 'some'
}

/**
 * 点全选框：当前页没全选就全选上，已经全选就全部取消。不在当前页的选中项保持不动。
 * @returns 新的选中列表，顺序是原有选中项在前、新选的在后。
 */
export function toggleAll(rowIds: readonly string[], selected: readonly string[]): string[] {
  const current = new Set(selected)
  if (selectAllState(rowIds, current) === 'all') {
    const page = new Set(rowIds)
    return selected.filter(id => !page.has(id))
  }
  return [...selected, ...rowIds.filter(id => !current.has(id))]
}

/** 勾选或取消一行。 */
export function toggleRow(rowId: string, checked: boolean, selected: readonly string[]): string[] {
  const without = selected.filter(id => id !== rowId)
  return checked ? [...without, rowId] : without
}
