/**
 * 设备台账面板。主区域里的一整页：标题、状态筛选、数据表格。
 *
 * 画法照 DSH 自己的整页面板（自动化任务、插件）：一列居中的内容，标题 20px，
 * 控件用 DSH 的基础组件，颜色和圆角只用 --dsw-* 变量。表格是 @jx/ui-kit 的 DataTable。
 *
 * 组件拿不到插件上下文：查数据的函数是注册时通过 inject 交进来的（见 index.tsx）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button, IconDownloadOutlineRegular, IconRefreshOutlineRegular, Pill, Tag, type TagTone,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { DataTable, type DataTableColumn, type DataTableLabels, type DataTableSort } from '@jx/ui-kit'
import {
  API, EQUIPMENT_STATUSES,
  type Equipment, type EquipmentPage, type EquipmentQuery, type EquipmentStatus, type SortableColumn,
} from '../shared/protocol.ts'
import css from './WorkbenchPage.module.css'

/** 查台账的结果：成功带数据，失败带一句能给用户看的说明。 */
export type LoadResult =
  | { ok: true; page: EquipmentPage }
  | { ok: false; message: string }

/** 注册时交给面板的东西。 */
export interface WorkbenchInjected {
  /** 向宿主一半查台账。 */
  listEquipment: (query: EquipmentQuery, signal: AbortSignal) => Promise<LoadResult>
  /** 导出 CSV 的地址。 */
  exportUrl: string
}

/** 面板的全部属性。 */
export type WorkbenchPageProps =
  PropsRuntime<'main'> & PropsLocale<'jx.workbench'> & InjectFace<WorkbenchInjected>

/**
 * 各状态用什么色调的标签。
 * 检修中用的是「警示」而不是「信息」：DSH 的「信息」色调跟着强调色走，匠心的强调色是红色，
 * 换完品牌以后「信息」标签就成了淡红色，跟「故障」的红色标签放在一起分不清。
 */
const STATUS_TONE: Record<EquipmentStatus, TagTone> = {
  running: 'success',
  standby: 'neutral',
  maintenance: 'warning',
  fault: 'danger',
  retired: 'quiet',
}

/** 面板的数据状态。 */
interface LoadState {
  /** 最近一次成功取到的数据；取数失败或重新取数时保留，表格不会闪空。 */
  page: EquipmentPage | undefined
  loading: boolean
  /** 最近一次取数失败的说明。 */
  error: string | undefined
}

/**
 * 画设备台账面板。
 * @param props 翻译函数和注册时注入的取数函数。
 * @returns 面板。
 */
export function WorkbenchPage({ t, listEquipment, exportUrl }: WorkbenchPageProps): ReactNode {
  const [sort, setSort] = useState<DataTableSort | null>(null)
  const [status, setStatus] = useState<EquipmentStatus | undefined>(undefined)
  const [selected, setSelected] = useState<string[]>([])
  const [state, setState] = useState<LoadState>({ page: undefined, loading: true, error: undefined })
  // 每点一次「刷新」加一，用来触发重新取数。
  const [reloadToken, setReloadToken] = useState(0)
  // 只认最后一次请求的结果：排序点得快的时候，先发的请求可能后回来。
  const latest = useRef(0)

  useEffect(() => {
    const request = ++latest.current
    const abort = new AbortController()
    setState(previous => ({ ...previous, loading: true, error: undefined }))
    const query: EquipmentQuery = {
      ...(sort === null ? {} : { sort: { columnId: sort.columnId as SortableColumn, direction: sort.direction } }),
      ...(status === undefined ? {} : { status }),
    }
    void listEquipment(query, abort.signal).then((result) => {
      if (request !== latest.current) return
      setState(previous => result.ok
        ? { page: result.page, loading: false, error: undefined }
        : { page: previous.page, loading: false, error: result.message })
    })
    return () => { abort.abort() }
  }, [listEquipment, sort, status, reloadToken])

  const reload = useCallback(() => { setReloadToken(token => token + 1) }, [])

  const columns = useMemo((): DataTableColumn<Equipment>[] => [
    { id: 'id', title: t('column.id'), sortable: true, width: 112 },
    { id: 'name', title: t('column.name'), sortable: true },
    { id: 'category', title: t('column.category'), sortable: true },
    { id: 'workshop', title: t('column.workshop'), sortable: true },
    {
      id: 'status', title: t('column.status'), sortable: true,
      render: row => <Tag tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</Tag>,
    },
    {
      id: 'lastMaintainedOn', title: t('column.lastMaintainedOn'), sortable: true,
      render: row => row.lastMaintainedOn ?? <span className={css.muted}>{t('neverMaintained')}</span>,
    },
    {
      id: 'runtimeHours', title: t('column.runtimeHours'), sortable: true, align: 'end',
      render: row => row.runtimeHours.toLocaleString(),
    },
  ], [t])

  const labels = useMemo((): DataTableLabels => ({
    loading: t('table.loading'),
    empty: t('table.empty'),
    selectAll: t('table.selectAll'),
    selectRow: index => t('table.selectRow', { index: index + 1 }),
    sortBy: (title, next) => t(next === 'asc' ? 'table.sortAsc' : next === 'desc' ? 'table.sortDesc' : 'table.sortClear', { title }),
  }), [t])

  const { page, loading, error } = state
  const rows = page?.rows ?? []
  // 筛选或刷新以后，已经不在当前结果里的行不再算作选中。
  const selectedShown = useMemo(() => {
    const shown = new Set(rows.map(row => row.id))
    return selected.filter(id => shown.has(id))
  }, [rows, selected])

  return (
    <div className={css.page} data-jx-workbench>
      <div className={css.scroll}>
        <div className={css.content}>
          <header className={css.heading}>
            <div className={css.headingText}>
              <h1>{t('title')}</h1>
              <p>{t('description')}</p>
            </div>
            <div className={css.actions}>
              <Button variant="outline" size="sm" icon={<IconRefreshOutlineRegular size={16} />} disabled={loading} onClick={reload}>
                {t('refresh')}
              </Button>
              <a className={css.exportLink} href={exportUrl} download>
                <IconDownloadOutlineRegular size={16} />
                <span>{t('export')}</span>
              </a>
            </div>
          </header>

          <div className={css.filters} role="group" aria-label={t('filter.label')}>
            <Pill active={status === undefined} aria-pressed={status === undefined} onClick={() => { setStatus(undefined) }}>
              {t('filter.all')}
              {page === undefined ? null : <span className={css.count}>{page.total}</span>}
            </Pill>
            {EQUIPMENT_STATUSES.map(item => (
              <Pill key={item} active={status === item} aria-pressed={status === item} onClick={() => { setStatus(item) }}>
                {t(`status.${item}`)}
                {page === undefined ? null : <span className={css.count}>{page.countByStatus[item]}</span>}
              </Pill>
            ))}
          </div>

          {error === undefined ? null : (
            <div className={css.error} role="alert">
              <div>
                <strong>{t('error.title')}</strong>
                <span>{error}</span>
              </div>
              <Button variant="outline" size="sm" onClick={reload}>{t('error.retry')}</Button>
            </div>
          )}

          <DataTable
            columns={columns}
            rows={rows}
            getRowId={getEquipmentId}
            label={t('table.label')}
            labels={labels}
            loading={loading}
            sort={sort}
            onSortChange={setSort}
            selectable
            selectedIds={selectedShown}
            onSelectionChange={setSelected}
            footer={page === undefined ? undefined : (
              <div className={css.footer}>
                <span>{t('footer.count', { total: page.total, shown: rows.length })}</span>
                {selectedShown.length === 0 ? null : <span className={css.selectedCount}>{t('footer.selected', { count: selectedShown.length })}</span>}
                <span className={css.source}>
                  {t('footer.source', {
                    endpoint: `POST ${API.listEquipment}`,
                    time: new Date(page.generatedAt).toLocaleTimeString(),
                  })}
                </span>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  )
}

/** 行的标识。写在组件外面，引用才稳定，表格不用每次重算。 */
function getEquipmentId(row: Equipment): string {
  return row.id
}
