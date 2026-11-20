/**
 * 这个插件界面上的文字。DSH 的规矩：界面文字都放在词典里，按命名空间注册，
 * 每个命名空间同时给出中文和英文；组件里不写死任何字。
 */

/** 文案命名空间，归这个插件所有。 */
export const NS = 'jx.workbench'

/** 中文。 */
export const zh = {
  'panel': '设备台账',
  'title': '设备台账',
  'description': '企业界面插件样板：台账数据由插件的宿主一半提供，表格是 @jx/ui-kit 的数据表格。',
  'refresh': '刷新',
  'export': '导出 CSV',
  'filter.label': '按状态筛选',
  'filter.all': '全部',
  'status.running': '运行中',
  'status.standby': '待机',
  'status.maintenance': '检修中',
  'status.fault': '故障',
  'status.retired': '停用',
  'column.id': '设备编号',
  'column.name': '设备名称',
  'column.category': '类别',
  'column.workshop': '车间',
  'column.status': '状态',
  'column.lastMaintainedOn': '上次保养',
  'column.runtimeHours': '累计运行（小时）',
  'neverMaintained': '未保养',
  'table.label': '设备台账',
  'table.loading': '正在加载设备台账…',
  'table.empty': '没有符合条件的设备',
  'table.selectAll': '选择全部设备',
  'table.selectRow': '选择第 {index} 行',
  'table.sortAsc': '按{title}升序排列',
  'table.sortDesc': '按{title}降序排列',
  'table.sortClear': '取消按{title}排序',
  'footer.count': '共 {total} 台，当前显示 {shown} 台',
  'footer.selected': '已选 {count} 台',
  'footer.source': '数据来自宿主接口 {endpoint}，生成于 {time}',
  'error.title': '设备台账加载失败',
  'error.retry': '重试',
} as const

/** 这个命名空间的键。 */
export type WorkbenchKey = keyof typeof zh

/** 英文。 */
export const en: Record<WorkbenchKey, string> = {
  'panel': 'Equipment',
  'title': 'Equipment ledger',
  'description': 'Sample enterprise UI plugin: the ledger comes from the plugin’s host half, and the table is the @jx/ui-kit data table.',
  'refresh': 'Refresh',
  'export': 'Export CSV',
  'filter.label': 'Filter by status',
  'filter.all': 'All',
  'status.running': 'Running',
  'status.standby': 'Standby',
  'status.maintenance': 'In maintenance',
  'status.fault': 'Fault',
  'status.retired': 'Retired',
  'column.id': 'Equipment ID',
  'column.name': 'Name',
  'column.category': 'Category',
  'column.workshop': 'Workshop',
  'column.status': 'Status',
  'column.lastMaintainedOn': 'Last maintained',
  'column.runtimeHours': 'Runtime (hours)',
  'neverMaintained': 'Never',
  'table.label': 'Equipment ledger',
  'table.loading': 'Loading the equipment ledger…',
  'table.empty': 'No equipment matches the filter',
  'table.selectAll': 'Select all equipment',
  'table.selectRow': 'Select row {index}',
  'table.sortAsc': 'Sort by {title}, ascending',
  'table.sortDesc': 'Sort by {title}, descending',
  'table.sortClear': 'Clear sorting by {title}',
  'footer.count': '{total} in total, {shown} shown',
  'footer.selected': '{count} selected',
  'footer.source': 'Data from host endpoint {endpoint}, generated at {time}',
  'error.title': 'Could not load the equipment ledger',
  'error.retry': 'Retry',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 匠心企业界面插件样板的文字。 */
    'jx.workbench': WorkbenchKey
  }
}
