/**
 * 设备台账的假数据和查询。样板用的：真实场景里这一层换成查企业自己的设备管理系统。
 * 这里都是纯函数，不依赖 DSH，方便单测。
 */
import {
  EQUIPMENT_STATUSES, SORTABLE_COLUMNS,
  type Equipment, type EquipmentPage, type EquipmentQuery, type EquipmentStatus, type SortableColumn,
} from '../shared/protocol.ts'

/** 假数据：18 台设备。特意没有「停用」的，用来演示表格的空状态。 */
export const LEDGER: readonly Equipment[] = [
  { id: 'EQ-0001', name: '1 号数控车床', category: '数控机床', workshop: '机加一车间', status: 'running', lastMaintainedOn: '2026-10-28', runtimeHours: 12840 },
  { id: 'EQ-0002', name: '2 号数控车床', category: '数控机床', workshop: '机加一车间', status: 'running', lastMaintainedOn: '2026-11-03', runtimeHours: 11962 },
  { id: 'EQ-0003', name: '五轴加工中心', category: '数控机床', workshop: '机加一车间', status: 'maintenance', lastMaintainedOn: '2026-11-18', runtimeHours: 8415 },
  { id: 'EQ-0004', name: '立式加工中心', category: '数控机床', workshop: '机加二车间', status: 'running', lastMaintainedOn: '2026-09-30', runtimeHours: 15230 },
  { id: 'EQ-0005', name: '龙门铣床', category: '数控机床', workshop: '机加二车间', status: 'standby', lastMaintainedOn: '2026-10-12', runtimeHours: 9876 },
  { id: 'EQ-0006', name: '1 号焊接机器人', category: '工业机器人', workshop: '焊装车间', status: 'running', lastMaintainedOn: '2026-11-06', runtimeHours: 20417 },
  { id: 'EQ-0007', name: '2 号焊接机器人', category: '工业机器人', workshop: '焊装车间', status: 'fault', lastMaintainedOn: '2026-08-21', runtimeHours: 19880 },
  { id: 'EQ-0008', name: '搬运机器人', category: '工业机器人', workshop: '焊装车间', status: 'running', lastMaintainedOn: '2026-10-19', runtimeHours: 7302 },
  { id: 'EQ-0009', name: '码垛机器人', category: '工业机器人', workshop: '总装车间', status: 'running', lastMaintainedOn: '2026-11-11', runtimeHours: 5120 },
  { id: 'EQ-0010', name: '1 号空压机', category: '动力设备', workshop: '动力站', status: 'running', lastMaintainedOn: '2026-10-05', runtimeHours: 31045 },
  { id: 'EQ-0011', name: '2 号空压机', category: '动力设备', workshop: '动力站', status: 'standby', lastMaintainedOn: '2026-10-05', runtimeHours: 28770 },
  { id: 'EQ-0012', name: '冷却水循环泵', category: '动力设备', workshop: '动力站', status: 'running', lastMaintainedOn: '2026-09-14', runtimeHours: 26390 },
  { id: 'EQ-0013', name: '三坐标测量机', category: '检测设备', workshop: '质检中心', status: 'running', lastMaintainedOn: '2026-11-01', runtimeHours: 4208 },
  { id: 'EQ-0014', name: '光谱分析仪', category: '检测设备', workshop: '质检中心', status: 'standby', lastMaintainedOn: null, runtimeHours: 96 },
  { id: 'EQ-0015', name: '总装输送线', category: '输送设备', workshop: '总装车间', status: 'running', lastMaintainedOn: '2026-10-24', runtimeHours: 17655 },
  { id: 'EQ-0016', name: '立体仓库堆垛机', category: '输送设备', workshop: '物流中心', status: 'maintenance', lastMaintainedOn: '2026-11-17', runtimeHours: 13090 },
  { id: 'EQ-0017', name: '自动导引车 A', category: '输送设备', workshop: '物流中心', status: 'running', lastMaintainedOn: '2026-11-09', runtimeHours: 6731 },
  { id: 'EQ-0018', name: '自动导引车 B', category: '输送设备', workshop: '物流中心', status: 'running', lastMaintainedOn: '2026-11-09', runtimeHours: 6504 },
]

/** 查询条件不合法时抛这个错，接口那一层把它转成错误结果。 */
export class InvalidQueryError extends Error {
  override name = 'InvalidQueryError'
}

/**
 * 校验浏览器传过来的查询条件。
 * 请求是从网络上来的，不能相信类型声明，所以这里逐项检查。
 * @param payload 请求体。
 * @returns 合法的查询条件。
 * @throws InvalidQueryError 条件不合法时。
 */
export function parseQuery(payload: unknown): EquipmentQuery {
  if (payload === undefined || payload === null) return {}
  if (typeof payload !== 'object' || Array.isArray(payload)) throw new InvalidQueryError('查询条件必须是一个对象')
  const { sort, status } = payload as { sort?: unknown; status?: unknown }
  const query: EquipmentQuery = {}
  if (status !== undefined) {
    if (!EQUIPMENT_STATUSES.includes(status as EquipmentStatus)) {
      throw new InvalidQueryError(`不认识的设备状态：${JSON.stringify(status)}`)
    }
    query.status = status as EquipmentStatus
  }
  if (sort !== undefined) {
    if (typeof sort !== 'object' || sort === null) throw new InvalidQueryError('排序条件必须是一个对象')
    const { columnId, direction } = sort as { columnId?: unknown; direction?: unknown }
    if (!SORTABLE_COLUMNS.includes(columnId as SortableColumn)) {
      throw new InvalidQueryError(`这一列不能排序：${JSON.stringify(columnId)}`)
    }
    if (direction !== 'asc' && direction !== 'desc') {
      throw new InvalidQueryError(`排序方向只能是 asc 或 desc：${JSON.stringify(direction)}`)
    }
    query.sort = { columnId: columnId as SortableColumn, direction }
  }
  return query
}

/** 比较两个单元格的值：数字按大小，文字按中文排序规则（数字段按数值比）。 */
function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'zh-CN', { numeric: true })
}

/**
 * 查台账：筛选、排序、统计。
 * @param query 查询条件（已经校验过）。
 * @param ledger 台账数据，默认用假数据。
 * @param now 生成时间，测试时可以固定。
 * @returns 一页结果。
 */
export function queryLedger(
  query: EquipmentQuery, ledger: readonly Equipment[] = LEDGER, now: Date = new Date(),
): EquipmentPage {
  const countByStatus = Object.fromEntries(EQUIPMENT_STATUSES.map(status => [status, 0])) as Record<EquipmentStatus, number>
  for (const item of ledger) countByStatus[item.status]++
  const rows = ledger.filter(item => query.status === undefined || item.status === query.status)
  const { columnId, direction } = query.sort ?? { columnId: 'id', direction: 'asc' as const }
  rows.sort((a, b) => {
    const left = a[columnId]
    const right = b[columnId]
    // 空值（从没保养过）不论升降都排在最后。
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    const order = compare(left, right)
    // 值相同就按编号排，结果才稳定。
    return (direction === 'asc' ? order : -order) || a.id.localeCompare(b.id)
  })
  return { rows, total: ledger.length, countByStatus, generatedAt: now.toISOString() }
}

/** CSV 里的一个字段：有逗号、引号、换行就用引号包起来。 */
function csvField(value: string | number | null): string {
  const text = value === null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * 把台账导出成 CSV。开头带 BOM，Excel 才能认出是 UTF-8。
 * @param rows 要导出的设备。
 * @returns CSV 文本。
 */
export function toCsv(rows: readonly Equipment[]): string {
  const header = ['设备编号', '设备名称', '类别', '车间', '状态', '上次保养', '累计运行小时']
  const lines = rows.map(item => [
    item.id, item.name, item.category, item.workshop, item.status, item.lastMaintainedOn, item.runtimeHours,
  ].map(csvField).join(','))
  return `﻿${[header.join(','), ...lines].join('\r\n')}\r\n`
}
