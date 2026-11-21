/** 排序与选择纯函数的测试。运行：node --test tests/（Node 自带的类型擦除直接跑 .ts）。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextSort, selectAllState, sortRows, toggleAll, toggleRow } from '../src/data-table/sort.ts'
import type { DataTableColumn } from '../src/data-table/types.ts'

interface Row { id: string; name: string; power: number | null }
const columns: DataTableColumn<Row>[] = [
  { id: 'name', title: '名称', sortable: true },
  { id: 'power', title: '功率', sortable: true },
  { id: 'label', title: '标签', value: row => `${row.name}-${row.id}` },
]
const rows: Row[] = [
  { id: 'a', name: '设备 10', power: 7.5 },
  { id: 'b', name: '设备 9', power: null },
  { id: 'c', name: '设备 2', power: 22 },
  { id: 'd', name: '设备 2', power: 3 },
]

test('点击表头依次是升序、降序、不排序；换一列从升序开始', () => {
  assert.deepEqual(nextSort(null, 'name'), { columnId: 'name', direction: 'asc' })
  assert.deepEqual(nextSort({ columnId: 'name', direction: 'asc' }, 'name'), { columnId: 'name', direction: 'desc' })
  assert.equal(nextSort({ columnId: 'name', direction: 'desc' }, 'name'), null)
  assert.deepEqual(nextSort({ columnId: 'name', direction: 'desc' }, 'power'), { columnId: 'power', direction: 'asc' })
})

test('文字里的数字按数值比较，值相等时保持原顺序', () => {
  const sorted = sortRows(rows, columns, { columnId: 'name', direction: 'asc' })
  assert.deepEqual(sorted.map(row => row.id), ['c', 'd', 'b', 'a'])
})

test('数字列按大小排，空值不论升降都在最后', () => {
  assert.deepEqual(sortRows(rows, columns, { columnId: 'power', direction: 'asc' }).map(r => r.id), ['d', 'a', 'c', 'b'])
  assert.deepEqual(sortRows(rows, columns, { columnId: 'power', direction: 'desc' }).map(r => r.id), ['c', 'a', 'd', 'b'])
})

test('用 value 取值的列也能排；不排序或列不存在时返回原顺序的新数组', () => {
  assert.deepEqual(sortRows(rows, columns, { columnId: 'label', direction: 'desc' }).map(r => r.id), ['a', 'b', 'd', 'c'])
  const same = sortRows(rows, columns, null)
  assert.deepEqual(same, rows)
  assert.notEqual(same, rows)
  assert.deepEqual(sortRows(rows, columns, { columnId: 'missing', direction: 'asc' }), rows)
})

test('全选框三态，全选只动当前页的行', () => {
  assert.equal(selectAllState([], new Set(['x'])), 'none')
  assert.equal(selectAllState(['a', 'b'], new Set()), 'none')
  assert.equal(selectAllState(['a', 'b'], new Set(['a'])), 'some')
  assert.equal(selectAllState(['a', 'b'], new Set(['a', 'b', 'x'])), 'all')
  assert.deepEqual(toggleAll(['a', 'b'], ['x', 'a']), ['x', 'a', 'b'])
  assert.deepEqual(toggleAll(['a', 'b'], ['x', 'a', 'b']), ['x'])
})

test('勾选和取消单行', () => {
  assert.deepEqual(toggleRow('b', true, ['a']), ['a', 'b'])
  assert.deepEqual(toggleRow('b', true, ['a', 'b']), ['a', 'b'])
  assert.deepEqual(toggleRow('a', false, ['a', 'b']), ['b'])
})
