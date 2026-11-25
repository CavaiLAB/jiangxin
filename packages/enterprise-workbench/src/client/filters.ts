/**
 * 台账面板的筛选条件：界面上的状态 → 发给宿主的查询条件。纯函数，不依赖 DOM 和 DSH，单测在 tests/filters.test.ts。
 */
import { QUERY_LIMIT, type EquipmentQuery, type EquipmentStatus, type SortableColumn } from '../shared/protocol.ts'

/** 状态药丸以外的筛选条件：页面上的快捷筛选和抽屉里的「更多筛选」改的都是它。 */
export interface Filters {
  workshop?: string
  category?: string
  /** 上次保养不晚于这一天，YYYY-MM-DD。 */
  maintainedBefore?: string
  minRuntimeHours?: number
  ids?: string[]
}

/** 「累计运行」能选的几档（小时）。0 是不限。 */
export const RUNTIME_STEPS = [0, 1000, 10000, 20000] as const

/** 表格的排序。 */
export interface TableSort {
  columnId: string
  direction: 'asc' | 'desc'
}

/**
 * 拼出发给宿主的查询条件。没设的条件不出现在结果里。
 * @param sort 表格的排序。
 * @param status 状态药丸选的状态。
 * @param filters 其余的筛选条件。
 */
export function toQuery(sort: TableSort | null, status: EquipmentStatus | undefined, filters: Filters): EquipmentQuery {
  return {
    ...(sort === null ? {} : { sort: { columnId: sort.columnId as SortableColumn, direction: sort.direction } }),
    ...(status === undefined ? {} : { status }),
    ...(filters.workshop === undefined ? {} : { workshop: filters.workshop }),
    ...(filters.category === undefined ? {} : { category: filters.category }),
    ...(filters.maintainedBefore === undefined ? {} : { maintainedBefore: filters.maintainedBefore }),
    ...(filters.minRuntimeHours === undefined || filters.minRuntimeHours === 0 ? {} : { minRuntimeHours: filters.minRuntimeHours }),
    ...(filters.ids === undefined || filters.ids.length === 0 ? {} : { ids: filters.ids }),
  }
}

/** 设了几个筛选条件。 */
export function activeFilterCount(filters: Filters): number {
  return [
    filters.workshop !== undefined,
    filters.category !== undefined,
    filters.maintainedBefore !== undefined,
    filters.minRuntimeHours !== undefined && filters.minRuntimeHours > 0,
    filters.ids !== undefined && filters.ids.length > 0,
  ].filter(Boolean).length
}

/**
 * 多行输入里的设备编号：按换行、逗号（含全角）、空白拆开，去掉空的和重复的（不区分大小写），最多 QUERY_LIMIT.ids 个。
 * @returns 编号；一个都没有时返回 undefined（不按编号筛）。
 */
export function parseIds(text: string): string[] | undefined {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const part of text.split(/[\s,，、]+/)) {
    const id = part.trim()
    if (id === '' || seen.has(id.toUpperCase())) continue
    seen.add(id.toUpperCase())
    ids.push(id)
    if (ids.length === QUERY_LIMIT.ids) break
  }
  return ids.length === 0 ? undefined : ids
}

/** 本地日期 → YYYY-MM-DD（日期选择给的是本地零点）。 */
export function toDateString(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** YYYY-MM-DD → 本地零点。 */
export function fromDateString(text: string): Date {
  const [year, month, day] = text.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}
