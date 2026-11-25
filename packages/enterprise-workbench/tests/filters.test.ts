/** 台账面板筛选条件的纯函数（浏览器一半）。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activeFilterCount, fromDateString, parseIds, toDateString, toQuery } from '../src/client/filters.ts'
import { QUERY_LIMIT } from '../src/shared/protocol.ts'

test('拼查询条件：没设的不出现，运行小时 0 当作不限', () => {
  assert.deepEqual(toQuery(null, undefined, {}), {})
  assert.deepEqual(toQuery({ columnId: 'name', direction: 'desc' }, 'fault', {
    workshop: '焊装车间', category: '工业机器人', maintainedBefore: '2026-11-01', minRuntimeHours: 0, ids: [],
  }), {
    sort: { columnId: 'name', direction: 'desc' }, status: 'fault', workshop: '焊装车间', category: '工业机器人', maintainedBefore: '2026-11-01',
  })
  assert.deepEqual(toQuery(null, undefined, { minRuntimeHours: 1000, ids: ['EQ-0001'] }), { minRuntimeHours: 1000, ids: ['EQ-0001'] })
})

test('数一数设了几个条件', () => {
  assert.equal(activeFilterCount({}), 0)
  assert.equal(activeFilterCount({ minRuntimeHours: 0, ids: [] }), 0)
  assert.equal(activeFilterCount({ workshop: 'a', category: 'b', maintainedBefore: '2026-01-01', minRuntimeHours: 1000, ids: ['x'] }), 5)
})

test('多行输入里的编号：换行、逗号、空白都能隔开，去重不分大小写', () => {
  assert.equal(parseIds(''), undefined)
  assert.equal(parseIds(' \n , '), undefined)
  assert.deepEqual(parseIds('EQ-0001\nEQ-0002, eq-0001，EQ-0003  EQ-0004、EQ-0005'), ['EQ-0001', 'EQ-0002', 'EQ-0003', 'EQ-0004', 'EQ-0005'])
  const many = Array.from({ length: QUERY_LIMIT.ids + 10 }, (_, i) => `EQ-${i}`).join('\n')
  assert.equal(parseIds(many)?.length, QUERY_LIMIT.ids)
})

test('日期和 YYYY-MM-DD 互转，按本地日期', () => {
  assert.equal(toDateString(new Date(2026, 0, 5)), '2026-01-05')
  const date = fromDateString('2026-11-25')
  assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()], [2026, 10, 25, 0])
  assert.equal(toDateString(fromDateString('2026-02-28')), '2026-02-28')
})
