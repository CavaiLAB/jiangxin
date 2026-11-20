/**
 * 文案覆盖表的自检：不依赖运行中的 DSH，只查表本身有没有写错。
 * 「表里的键在上游还存不存在、上游有没有新冒出来的 DSH 字样」要对着运行中的实例查，
 * 见 README 的「文案审计」一节。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mentionKind } from '../src/client/audit.ts'
import { COPY_OVERRIDES, EN_US, LANGUAGE_PACKS, ZH_CN } from '../src/client/copy-overrides.ts'
import { en, zh } from '../src/client/locales.ts'

/** 取出一句话里的 {占位符}，排好序。 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]!).sort()
}

test('审计的分类：产品名、厂商名、技术字样分得开', () => {
  assert.equal(mentionKind('请重启 DSH 使更改生效。'), 'product')
  assert.equal(mentionKind('返回 DeepSeek Harness'), 'product')
  assert.equal(mentionKind('restart Harness'), 'product')
  assert.equal(mentionKind('深度求索中，用时 {duration} ···'), 'product')
  assert.equal(mentionKind('登录 DeepSeek 账号以开始使用'), 'vendor')
  // 技术字样不算：环境变量、包名、命令、存储键、网址。
  assert.equal(mentionKind('密钥保存在 $DSH_HOME 下'), undefined)
  assert.equal(mentionKind('例如 dsh-plugin-whale-pet'), undefined)
  assert.equal(mentionKind('README 安装命令中 dsh plugin add 之后的部分'), undefined)
  assert.equal(mentionKind('当前网站本地存储中的 dsh.keybindings.v1'), undefined)
  assert.equal(mentionKind('https://api-docs.deepseek.com/guides/search'), undefined)
  // spreadsheet 里有 dsh 三个字母，不能误判。
  assert.equal(mentionKind('This spreadsheet could not be opened.'), undefined)
})

test('每个语言包都有覆盖表，而且中英文盖的是同一批键', () => {
  assert.deepEqual(Object.keys(COPY_OVERRIDES).sort(), LANGUAGE_PACKS.map(pack => pack.id).sort())
  assert.deepEqual(Object.keys(EN_US).sort(), Object.keys(ZH_CN).sort())
  for (const ns of Object.keys(ZH_CN)) {
    assert.deepEqual(Object.keys(EN_US[ns]!).sort(), Object.keys(ZH_CN[ns]!).sort(), `命名空间 ${ns} 中英文的键不一致`)
  }
})

for (const [pack, table] of Object.entries(COPY_OVERRIDES)) {
  test(`${pack}：改写后的句子里不再有上游的产品名`, () => {
    for (const [ns, dict] of Object.entries(table)) {
      for (const [key, text] of Object.entries(dict)) {
        assert.notEqual(mentionKind(text), 'product', `${ns} / ${key} 还带着上游的产品名：${text}`)
        assert.ok(text.trim().length > 0, `${ns} / ${key} 是空的`)
      }
    }
  })
}

test('中英文覆盖里的占位符一致（漏了占位符界面上会少信息）', () => {
  for (const [ns, dict] of Object.entries(ZH_CN)) {
    for (const [key, text] of Object.entries(dict)) {
      assert.deepEqual(placeholders(EN_US[ns]![key]!), placeholders(text), `${ns} / ${key} 的占位符中英文不一致`)
    }
  }
})

test('品牌包自己的词典中英文键一致、占位符一致', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  for (const [key, text] of Object.entries(zh)) {
    assert.deepEqual(placeholders(en[key as keyof typeof zh]), placeholders(text), `${key} 的占位符中英文不一致`)
  }
})
