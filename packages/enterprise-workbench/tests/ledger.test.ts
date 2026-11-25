/** 设备台账的查询逻辑（宿主一半的纯函数部分）。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InvalidQueryError, LEDGER, parseExportParams, parseQuery, queryLedger, toCsv } from '../src/host/ledger.ts'
import { API, EQUIPMENT_STATUSES, QUERY_LIMIT } from '../src/shared/protocol.ts'

const NOW = new Date('2026-11-20T00:00:00.000Z')

test('接口地址都在 /api 下面，每一段都符合 DSH 的命名规则', () => {
  // 出处：@deepseek-ai/dsh-client-connection 对精确路由路径的校验。
  for (const path of Object.values(API)) {
    assert.ok(path.startsWith('/api/'), path)
    for (const segment of path.slice('/api/'.length).split('/')) assert.match(segment, /^[A-Za-z0-9_$.-]+$/)
  }
})

test('不带条件：全部设备，按编号升序，带各状态的台数', () => {
  const page = queryLedger({}, LEDGER, NOW)
  assert.equal(page.rows.length, LEDGER.length)
  assert.equal(page.total, LEDGER.length)
  assert.deepEqual(page.rows.map(row => row.id), LEDGER.map(row => row.id).sort())
  assert.equal(Object.values(page.countByStatus).reduce((sum, count) => sum + count, 0), LEDGER.length)
  assert.equal(page.generatedAt, '2026-11-20T00:00:00.000Z')
})

test('按数字列排序是按大小，不是按字面', () => {
  const asc = queryLedger({ sort: { columnId: 'runtimeHours', direction: 'asc' } }).rows.map(row => row.runtimeHours)
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b))
  const desc = queryLedger({ sort: { columnId: 'runtimeHours', direction: 'desc' } }).rows.map(row => row.runtimeHours)
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a))
})

test('空值（从没保养过）不论升降都排在最后', () => {
  for (const direction of ['asc', 'desc'] as const) {
    const rows = queryLedger({ sort: { columnId: 'lastMaintainedOn', direction } }).rows
    assert.equal(rows.at(-1)?.lastMaintainedOn, null)
  }
})

test('值相同的行按编号排，结果稳定', () => {
  const rows = queryLedger({ sort: { columnId: 'workshop', direction: 'desc' } }).rows
  for (let index = 1; index < rows.length; index++) {
    const previous = rows[index - 1]!
    const current = rows[index]!
    if (previous.workshop === current.workshop) assert.ok(previous.id < current.id)
  }
})

test('按状态筛选只影响行，不影响总数和各状态的台数', () => {
  const page = queryLedger({ status: 'maintenance' })
  assert.ok(page.rows.length > 0)
  assert.ok(page.rows.every(row => row.status === 'maintenance'))
  assert.equal(page.total, LEDGER.length)
  assert.equal(page.countByStatus.maintenance, page.rows.length)
})

test('假数据里没有停用的设备（面板用它演示空状态）', () => {
  assert.equal(queryLedger({ status: 'retired' }).rows.length, 0)
  assert.deepEqual(Object.keys(queryLedger({}).countByStatus).sort(), [...EQUIPMENT_STATUSES].sort())
})

test('不合法的查询条件被拒绝，而不是被悄悄忽略', () => {
  assert.deepEqual(parseQuery(undefined), {})
  assert.deepEqual(parseQuery({}), {})
  assert.deepEqual(
    parseQuery({ status: 'fault', sort: { columnId: 'name', direction: 'desc' } }),
    { status: 'fault', sort: { columnId: 'name', direction: 'desc' } },
  )
  for (const bad of [
    'text', [], { status: 'broken' }, { sort: 'name' }, { sort: { columnId: 'password', direction: 'asc' } },
    { sort: { columnId: 'name', direction: 'up' } },
  ]) {
    assert.throws(() => parseQuery(bad), InvalidQueryError, JSON.stringify(bad))
  }
})

test('导出的 CSV：带 BOM、表头、每台设备一行，特殊字符加引号', () => {
  const csv = toCsv(LEDGER)
  assert.ok(csv.startsWith('﻿设备编号,设备名称,'))
  assert.equal(csv.trimEnd().split('\r\n').length, LEDGER.length + 1)
  const tricky = toCsv([{ ...LEDGER[0]!, name: '带,逗号和"引号"的名字', lastMaintainedOn: null }])
  assert.match(tricky, /"带,逗号和""引号""的名字"/)
  assert.match(tricky, /running,,12840/)
})

test('按车间、类别、运行小时、编号筛选，条件之间是「并且」', () => {
  const welding = queryLedger({ workshop: '焊装车间' }).rows
  assert.deepEqual(welding.map(row => row.id), ['EQ-0006', 'EQ-0007', 'EQ-0008'])
  assert.ok(queryLedger({ category: '动力设备' }).rows.every(row => row.category === '动力设备'))
  assert.ok(queryLedger({ minRuntimeHours: 20000 }).rows.every(row => row.runtimeHours >= 20000))
  assert.deepEqual(queryLedger({ ids: ['eq-0001', 'EQ-0013', 'EQ-9999'] }).rows.map(row => row.id), ['EQ-0001', 'EQ-0013'])
  assert.deepEqual(queryLedger({ workshop: '焊装车间', minRuntimeHours: 19000 }).rows.map(row => row.id), ['EQ-0006', 'EQ-0007'])
  // 筛选不影响总数和各状态的台数
  assert.equal(queryLedger({ workshop: '焊装车间' }).total, LEDGER.length)
})

test('上次保养不晚于某天：含当天，从没保养过的也算', () => {
  const rows = queryLedger({ maintainedBefore: '2026-10-05' }).rows
  assert.ok(rows.length > 0)
  assert.ok(rows.every(row => row.lastMaintainedOn === null || row.lastMaintainedOn <= '2026-10-05'))
  assert.ok(rows.some(row => row.lastMaintainedOn === '2026-10-05'))
  assert.ok(rows.some(row => row.lastMaintainedOn === null))
})

test('结果里带着车间和类别的全集（不受筛选影响），给筛选项用', () => {
  const { options } = queryLedger({ workshop: '焊装车间' })
  assert.equal(options.workshops.length, new Set(LEDGER.map(row => row.workshop)).size)
  assert.equal(options.categories.length, new Set(LEDGER.map(row => row.category)).size)
  assert.ok(options.workshops.includes('动力站'))
})

test('新加的条件也逐项校验', () => {
  assert.deepEqual(
    parseQuery({ workshop: ' 焊装车间 ', category: '动力设备', maintainedBefore: '2026-02-28', minRuntimeHours: 0, ids: ['EQ-0001'] }),
    { workshop: '焊装车间', category: '动力设备', maintainedBefore: '2026-02-28', minRuntimeHours: 0, ids: ['EQ-0001'] },
  )
  for (const bad of [
    { workshop: '' }, { workshop: 3 }, { category: 'x'.repeat(QUERY_LIMIT.textLength + 1) },
    { maintainedBefore: '2026-02-30' }, { maintainedBefore: '2026/11/01' }, { minRuntimeHours: -1 }, { minRuntimeHours: '100' },
    { ids: 'EQ-0001' }, { ids: [''] }, { ids: Array.from({ length: QUERY_LIMIT.ids + 1 }, (_, i) => `EQ-${i}`) },
  ]) {
    assert.throws(() => parseQuery(bad), InvalidQueryError, JSON.stringify(bad))
  }
})

test('导出的查询参数：和查台账同一套条件，缺省带 BOM', () => {
  const params = new URLSearchParams({
    sort: 'runtimeHours:desc', status: 'running', workshop: '焊装车间', maintainedBefore: '2026-11-30', minRuntimeHours: '1000', ids: 'EQ-0006,EQ-0008',
  })
  assert.deepEqual(parseExportParams(params), {
    query: {
      sort: { columnId: 'runtimeHours', direction: 'desc' }, status: 'running', workshop: '焊装车间',
      maintainedBefore: '2026-11-30', minRuntimeHours: 1000, ids: ['EQ-0006', 'EQ-0008'],
    },
    bom: true,
  })
  assert.deepEqual(parseExportParams(new URLSearchParams('bom=0')), { query: {}, bom: false })
  for (const bad of ['bom=2', 'sort=name', 'minRuntimeHours=abc', 'minRuntimeHours=', 'status=broken']) {
    assert.throws(() => parseExportParams(new URLSearchParams(bad)), InvalidQueryError, bad)
  }
})

test('导出时可以不带 BOM', () => {
  assert.ok(toCsv(LEDGER, { bom: false }).startsWith('设备编号,'))
})
