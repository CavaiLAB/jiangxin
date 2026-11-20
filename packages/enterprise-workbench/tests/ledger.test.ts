/** 设备台账的查询逻辑（宿主一半的纯函数部分）。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InvalidQueryError, LEDGER, parseQuery, queryLedger, toCsv } from '../src/host/ledger.ts'
import { API, EQUIPMENT_STATUSES } from '../src/shared/protocol.ts'

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
