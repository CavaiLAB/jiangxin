/**
 * 数据表格的最小版本：列定义、排序、加载中与空状态、行选择。
 *
 * 从 Qian 的 `@cavailab/qian-data` DataTable 迁来，按 DSH 的写法重写：
 * React 18、CSS Modules 加 clsx、只用 --dsw-* 变量；图标和加载标记用 DSH 的基础组件，
 * 没有 Tailwind、Base UI、TanStack Table。差异见这个包的 README。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import clsx from 'clsx'
import {
  IconChevronDownOutlineRegular,
  IconChevronUpOutlineRegular,
  IconChevronsUpDownOutlineRegular,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { cellValue, nextDirection, nextSort, selectAllState, toggleAll, toggleRow } from './sort.ts'
import type { DataTableColumn, DataTableProps } from './types.ts'
import css from './DataTable.module.css'

/** 原始值转成单元格文字：空值显示为空。 */
function cellText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function columnStyle<T>(column: DataTableColumn<T>): CSSProperties | undefined {
  if (column.width === undefined) return undefined
  return { width: typeof column.width === 'number' ? `${column.width}px` : column.width }
}

/**
 * 全选框。DSH 的 Checkbox 总是显示文字标签，也没有「部分选中」，
 * 表格里要的是只朗读不显示的名称和三态，所以这里用原生 input，配色沿用它的写法。
 */
function SelectAllBox({ state, label, disabled, onToggle }: {
  state: 'none' | 'some' | 'all'
  label: string
  disabled: boolean
  onToggle: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  // indeterminate 只能通过 DOM 属性设置，没有对应的 HTML 属性。
  useEffect(() => {
    if (input.current !== null) input.current.indeterminate = state === 'some'
  }, [state])
  return (
    <input
      ref={input}
      type="checkbox"
      className={css.checkbox}
      aria-label={label}
      checked={state === 'all'}
      disabled={disabled}
      onChange={onToggle}
    />
  )
}

/**
 * 数据表格。给什么行显示什么行：排序、分页、筛选都由调用方决定怎么做。
 * @param props 见 {@link DataTableProps}。
 * @returns 表格元素。
 */
export function DataTable<T>({
  columns, rows, getRowId, label, labels, loading = false,
  sort, onSortChange, selectable = false, selectedIds, onSelectionChange, footer, className,
}: DataTableProps<T>) {
  const [ownSelection, setOwnSelection] = useState<readonly string[]>([])
  const selected = selectedIds ?? ownSelection
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const rowIds = useMemo(() => rows.map(getRowId), [rows, getRowId])

  const changeSelection = (next: string[]): void => {
    if (selectedIds === undefined) setOwnSelection(next)
    onSelectionChange?.(next)
  }

  const state = rows.length > 0 ? 'ready' : loading ? 'loading' : 'empty'
  const columnCount = Math.max(1, columns.length + (selectable ? 1 : 0))

  return (
    <section className={clsx(css.root, className)} aria-label={label} aria-busy={loading}>
      <div className={css.scroller}>
        <table className={css.table} aria-label={label}>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className={clsx(css.headCell, css.selectCell)}>
                  <SelectAllBox
                    state={selectAllState(rowIds, selectedSet)}
                    label={labels.selectAll}
                    disabled={rows.length === 0}
                    onToggle={() => { changeSelection(toggleAll(rowIds, selected)) }}
                  />
                </th>
              )}
              {columns.map((column) => {
                const direction = sort?.columnId === column.id ? sort.direction : undefined
                const sortable = column.sortable === true && onSortChange !== undefined
                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={columnStyle(column)}
                    className={clsx(css.headCell, column.align === 'end' && css.alignEnd)}
                    aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className={clsx(css.sortButton, direction !== undefined && css.sorted)}
                        title={labels.sortBy(column.title, nextDirection(sort, column.id))}
                        onClick={() => { onSortChange(nextSort(sort, column.id)) }}
                      >
                        <span>{column.title}</span>
                        {direction === 'asc' ? <IconChevronUpOutlineRegular size={14} className={css.sortIcon} />
                          : direction === 'desc' ? <IconChevronDownOutlineRegular size={14} className={css.sortIcon} />
                            : <IconChevronsUpDownOutlineRegular size={14} className={clsx(css.sortIcon, css.sortIdle)} />}
                      </button>
                    ) : column.title}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={clsx(loading && state === 'ready' && css.stale)}>
            {state === 'ready' ? rows.map((row, index) => {
              const id = rowIds[index] as string
              const isSelected = selectedSet.has(id)
              return (
                <tr key={id} className={clsx(css.row, isSelected && css.selected)} aria-selected={selectable ? isSelected : undefined}>
                  {selectable && (
                    <td className={clsx(css.cell, css.selectCell)}>
                      <input
                        type="checkbox"
                        className={css.checkbox}
                        aria-label={labels.selectRow(index)}
                        checked={isSelected}
                        onChange={(event) => { changeSelection(toggleRow(id, event.target.checked, selected)) }}
                      />
                    </td>
                  )}
                  {columns.map(column => (
                    <td key={column.id} className={clsx(css.cell, column.align === 'end' && css.alignEnd)}>
                      {column.render !== undefined ? column.render(row) : cellText(cellValue(column, row))}
                    </td>
                  ))}
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={columnCount} className={css.statusCell}>
                  <div role="status" className={css.status} data-state={state}>
                    {state === 'loading' && <StateDot state="ongoing" />}
                    <span>{state === 'loading' ? labels.loading : labels.empty}</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer !== undefined && <div className={css.footer}>{footer}</div>}
    </section>
  )
}
