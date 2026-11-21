/**
 * 配色的对比度检查：palette.ts 里列出的每一组「文字色 / 底色」都要过 WCAG 2 的门槛。
 * 调色值之后跑一遍：node --test tests/
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BRAND_TOKENS, CONTRAST_PAIRS } from '../src/client/palette.ts'

/** 把 #RRGGBB 解析成 0–255 的三个分量。 */
function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (match === null) throw new Error(`不是 #RRGGBB 形式的色值：${hex}`)
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)]
}

/** WCAG 2 的相对亮度。 */
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 的对比度，1 到 21。 */
function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

test('对比度公式本身是对的（黑白 21，同色 1）', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF') * 100) / 100, 21)
  assert.equal(contrast('#BD3F2B', '#BD3F2B'), 1)
})

for (const pair of CONTRAST_PAIRS) {
  test(`${pair.mode === 'light' ? '浅色' : '深色'}｜${pair.name} ≥ ${pair.min}`, () => {
    const ratio = contrast(pair.text, pair.background)
    assert.ok(
      ratio >= pair.min,
      `${pair.text} 在 ${pair.background} 上的对比度是 ${ratio.toFixed(2)}，低于 ${pair.min}`,
    )
  })
}

test('每个覆盖的变量都同时给了浅色和深色的值（DSH 接口的硬性要求）', () => {
  for (const [name, modes] of Object.entries(BRAND_TOKENS)) {
    assert.match(name, /^--dsw-/, `${name} 不是 DSH 的变量名`)
    assert.ok(modes.light.trim().length > 0, `${name} 缺浅色值`)
    assert.ok(modes.dark.trim().length > 0, `${name} 缺深色值`)
  }
})
