/** 默认语言的判断：什么时候替用户选语言、选哪个。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_LANGUAGE_PACK, LANGUAGE_PACKS } from '../src/client/copy-overrides.ts'
import { defaultLanguageTarget, languageLockedBy } from '../src/client/default-language.ts'

const pick = (state: { ready?: boolean, preference?: string, active: string }): string | undefined =>
  defaultLanguageTarget({ ready: state.ready ?? true, preference: state.preference, active: state.active }, LANGUAGE_PACKS, DEFAULT_LANGUAGE_PACK)

test('设置还没读到时不动：存下来的选择可能马上就到，不能抢着写', () => {
  assert.equal(pick({ ready: false, active: 'ja' }), undefined)
  assert.equal(pick({ ready: false, active: 'en' }), undefined)
})

test('已经有人定了语言就照他们的来，哪怕定的不是我们的语言包', () => {
  assert.equal(pick({ preference: 'en-US', active: 'en-US' }), undefined)
  assert.equal(pick({ preference: 'zh-CN', active: 'zh-CN' }), undefined)
  // 装品牌包之前存下的日语：不替用户改，语言行会如实显示它。
  assert.equal(pick({ preference: 'ja', active: 'ja' }), undefined)
})

test('没人选过、浏览器直接挑中了我们的语言包：不用动', () => {
  assert.equal(pick({ active: 'zh-CN' }), undefined)
  assert.equal(pick({ active: 'en-US' }), undefined)
  assert.equal(pick({ active: 'EN-us' }), undefined)
})

test('没人选过、落在 DSH 自带的语言上：换成对应的语言包', () => {
  // en-GB 的浏览器会落到自带的 en，zh-TW 会落到自带的 zh。
  assert.equal(pick({ active: 'en' }), 'en-US')
  assert.equal(pick({ active: 'zh' }), 'zh-CN')
})

test('没人选过、浏览器的语言我们没有对应的语言包：用默认的那个', () => {
  for (const active of ['ja', 'fr', 'de', 'ru', 'pt', 'es']) assert.equal(pick({ active }), DEFAULT_LANGUAGE_PACK)
  assert.equal(DEFAULT_LANGUAGE_PACK, 'zh-CN')
})

const locked = (layers: { ready?: boolean, writable?: boolean, value?: unknown, base?: unknown, user?: unknown }): boolean =>
  languageLockedBy({ ready: layers.ready ?? true, writable: layers.writable ?? true, value: layers.value ?? {}, base: layers.base ?? {}, user: layers.user ?? {} })

test('锁住的推断：生效的值是更上面的层给的', () => {
  // 部署方在命令行补丁里定了 zh-CN，用户没选过：生效值没人解释得了。
  assert.equal(locked({ value: { preference: 'zh-CN' } }), true)
  // 用户存过 zh-CN，部署方锁成 en-US。
  assert.equal(locked({ value: { preference: 'en-US' }, user: { preference: 'zh-CN' } }), true)
  // 整份设置都不能写。
  assert.equal(locked({ writable: false }), true)
})

test('锁住的推断：生效的值来自用户或组合包层时不算锁', () => {
  assert.equal(locked({}), false)
  assert.equal(locked({ value: { preference: 'en-US' }, user: { preference: 'en-US' } }), false)
  assert.equal(locked({ value: { preference: 'zh-CN' }, base: { preference: 'zh-CN' } }), false)
  // 用户存的优先于组合包层。
  assert.equal(locked({ value: { preference: 'en-US' }, base: { preference: 'zh-CN' }, user: { preference: 'en-US' } }), false)
  // 设置还没读到。
  assert.equal(locked({ ready: false, value: { preference: 'zh-CN' } }), false)
})

test('锁住的推断有盲区：上面那层的值跟用户存的一样时看不出来（要靠写入被拒发现）', () => {
  assert.equal(locked({ value: { preference: 'zh-CN' }, user: { preference: 'zh-CN' } }), false)
})
