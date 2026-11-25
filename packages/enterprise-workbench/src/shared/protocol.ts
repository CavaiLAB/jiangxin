/**
 * 宿主一半和浏览器一半之间的约定：接口地址、请求和响应的样子。
 * 两边都从这里取，所以这个文件里只能有类型和常量，不能引用 DSH 的任何包。
 *
 * 走的是 DSH 的「精确路径 HTTP 路由」（宿主用 ctx.connection.fetch.register 注册）：
 * 地址必须在 /api 下面，自带登录校验，只有实例的主人能访问。
 * 浏览器这边用相对于当前页面的地址去请求（去掉开头的斜杠），网页端和桌面端都是这个写法。
 */

/** 接口地址。 */
export const API = {
  /** 查设备台账：POST，请求体是 JSON（EquipmentQuery），返回 JSON（EquipmentPage）。 */
  listEquipment: '/api/jx-workbench/equipment/list',
  /** 导出 CSV：GET，返回一个 CSV 文件。查询参数见 EXPORT_PARAM，和查台账用同一套条件。 */
  exportCsv: '/api/jx-workbench/equipment.csv',
} as const

/** 设备状态。 */
export const EQUIPMENT_STATUSES = ['running', 'standby', 'maintenance', 'fault', 'retired'] as const

/** 设备状态。 */
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

/** 台账里的一台设备。 */
export interface Equipment {
  /** 设备编号，唯一。 */
  id: string
  /** 设备名称。 */
  name: string
  /** 设备类别。 */
  category: string
  /** 所在车间。 */
  workshop: string
  /** 当前状态。 */
  status: EquipmentStatus
  /** 上次保养日期，YYYY-MM-DD；从没保养过为 null。 */
  lastMaintainedOn: string | null
  /** 累计运行小时。 */
  runtimeHours: number
}

/** 可以排序的列。 */
export const SORTABLE_COLUMNS = ['id', 'name', 'category', 'workshop', 'status', 'lastMaintainedOn', 'runtimeHours'] as const

/** 可以排序的列。 */
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number]

/** 查询条件。条件之间是「并且」。 */
export interface EquipmentQuery {
  /** 按哪一列排序；不给就按编号。 */
  sort?: { columnId: SortableColumn; direction: 'asc' | 'desc' }
  /** 只看某个状态；不给就是全部。 */
  status?: EquipmentStatus
  /** 只看某个车间。 */
  workshop?: string
  /** 只看某个类别。 */
  category?: string
  /** 只看上次保养在这一天或更早的，YYYY-MM-DD；从没保养过的也算在内。 */
  maintainedBefore?: string
  /** 只看累计运行不少于这么多小时的。 */
  minRuntimeHours?: number
  /** 只看这些编号的设备，不区分大小写。 */
  ids?: string[]
}

/** 查询条件的上限：文字条件的长度、一次最多查多少个编号。 */
export const QUERY_LIMIT = { textLength: 64, ids: 200 } as const

/**
 * 导出 CSV 的查询参数名。条件和 EquipmentQuery 一一对应：sort 写成「列:方向」，ids 用逗号隔开；
 * 另外 bom=0 表示不带 BOM（缺省带，Excel 才认得出是 UTF-8）。
 */
export const EXPORT_PARAM = {
  sort: 'sort',
  status: 'status',
  workshop: 'workshop',
  category: 'category',
  maintainedBefore: 'maintainedBefore',
  minRuntimeHours: 'minRuntimeHours',
  ids: 'ids',
  bom: 'bom',
} as const

/** 查询结果。 */
export interface EquipmentPage {
  /** 符合条件的设备，已经按要求排好序。 */
  rows: Equipment[]
  /** 台账里一共有多少台（不受筛选影响）。 */
  total: number
  /** 各状态的台数（不受筛选影响）。 */
  countByStatus: Record<EquipmentStatus, number>
  /** 台账里有哪些车间、哪些类别（不受筛选影响），给筛选项用。 */
  options: { workshops: string[]; categories: string[] }
  /** 宿主生成这份结果的时间，ISO 格式。界面上显示它，方便看出数据确实来自宿主。 */
  generatedAt: string
}

/** 接口报错时返回的 JSON（HTTP 状态码 400）。 */
export interface ApiError {
  error: {
    /** 错误码，见 ERROR_CODE。 */
    code: string
    /** 能给用户看的说明。 */
    message: string
  }
}

/** 接口报错时的错误码。 */
export const ERROR_CODE = {
  /** 查询条件不合法。 */
  invalidQuery: 'jx-workbench/invalid-query',
} as const
