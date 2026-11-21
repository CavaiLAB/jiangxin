#!/usr/bin/env node
/**
 * 从 brand/source/icon-1024.png 生成这个包用到的所有尺寸的图标。
 * 规矩（见 brand/README.md）：所有尺寸从 1024 那张生成，不另画。
 *
 * 只做三件事：裁掉四周的透明留白、按需要垫底色、缩小。用 pngjs 读写，缩小用面积平均，
 * 没有系统工具依赖，哪台机器跑出来都一样。
 *
 * 用法：node scripts/gen-icons.mjs [源图路径]
 * 产物提交在包里，换 logo 时重跑一次。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.argv[2] ?? join(packageDir, '..', '..', 'brand', 'source', 'icon-1024.png'))

/** 读成预乘透明度的浮点像素，后面缩小时边缘不会发黑。 */
function load(file) {
  const png = PNG.sync.read(readFileSync(file))
  const { width, height, data } = png
  const pixels = new Float64Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255
    pixels[i * 4] = data[i * 4] * a
    pixels[i * 4 + 1] = data[i * 4 + 1] * a
    pixels[i * 4 + 2] = data[i * 4 + 2] * a
    pixels[i * 4 + 3] = a
  }
  return { width, height, pixels }
}

/** 找到不透明内容的外接矩形。 */
function contentBox({ width, height, pixels }) {
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0.02) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  return { left, top, right, bottom }
}

/**
 * 把源图里的一个矩形缩放到 size×size 画布中央，内容占画布的 fill 比例。
 * @param fill 内容的长边占画布边长的比例（0–1）。
 * @param background 垫的底色 [r,g,b]；不给就保留透明。
 */
function render(image, box, size, fill, background) {
  const boxW = box.right - box.left + 1
  const boxH = box.bottom - box.top + 1
  const scale = (size * fill) / Math.max(boxW, boxH)
  const outW = boxW * scale
  const outH = boxH * scale
  const offsetX = (size - outW) / 2
  const offsetY = (size - outH) / 2
  const out = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 目标像素对应源图里的一个小矩形，对它覆盖到的源像素按面积取平均。
      const sx0 = box.left + (x - offsetX) / scale
      const sx1 = box.left + (x + 1 - offsetX) / scale
      const sy0 = box.top + (y - offsetY) / scale
      const sy1 = box.top + (y + 1 - offsetY) / scale
      let r = 0, g = 0, b = 0, a = 0
      const area = (sx1 - sx0) * (sy1 - sy0)
      for (let sy = Math.max(box.top, Math.floor(sy0)); sy < Math.min(box.bottom + 1, Math.ceil(sy1)); sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0)
        if (wy <= 0) continue
        for (let sx = Math.max(box.left, Math.floor(sx0)); sx < Math.min(box.right + 1, Math.ceil(sx1)); sx++) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0)
          if (wx <= 0) continue
          const weight = (wx * wy) / area
          const i = (sy * image.width + sx) * 4
          r += image.pixels[i] * weight
          g += image.pixels[i + 1] * weight
          b += image.pixels[i + 2] * weight
          a += image.pixels[i + 3] * weight
        }
      }
      const o = (y * size + x) * 4
      if (background !== undefined) {
        out.data[o] = Math.round(r + background[0] * (1 - a))
        out.data[o + 1] = Math.round(g + background[1] * (1 - a))
        out.data[o + 2] = Math.round(b + background[2] * (1 - a))
        out.data[o + 3] = 255
      } else {
        out.data[o] = a > 0 ? Math.round(r / a) : 0
        out.data[o + 1] = a > 0 ? Math.round(g / a) : 0
        out.data[o + 2] = a > 0 ? Math.round(b / a) : 0
        out.data[o + 3] = Math.round(a * 255)
      }
    }
  }
  return PNG.sync.write(out, { colorType: background !== undefined ? 2 : 6 })
}

const image = load(source)
const box = contentBox(image)
const WHITE = [255, 255, 255]

/** [输出路径, 边长, 内容占比, 底色]。 */
const targets = [
  // 浏览器一半用的标志：侧栏 24px、首页 34px、关于页 56px，按 3 倍屏留够像素。
  ['src/client/assets/mark-96.png', 96, 1],
  ['src/client/assets/mark-192.png', 192, 1],
  // 宿主一半直接提供的站点图标。小尺寸让内容撑满，否则 16px 下看不清。
  ['assets/web/favicon-16.png', 16, 1],
  ['assets/web/favicon-32.png', 32, 1],
  ['assets/web/favicon-48.png', 48, 1],
  ['assets/web/icon-192.png', 192, 0.92],
  ['assets/web/icon-512.png', 512, 0.92],
  // iOS 主屏幕图标不支持透明，垫白底。
  ['assets/web/apple-touch-icon.png', 180, 0.84, WHITE],
  // 可遮罩图标：系统会裁成圆形或圆角，内容要落在中间 80% 的安全区里。
  ['assets/web/icon-maskable-512.png', 512, 0.68, WHITE],
]

for (const [file, size, fill, background] of targets) {
  const out = join(packageDir, file)
  mkdirSync(dirname(out), { recursive: true })
  const bytes = render(image, box, size, fill, background)
  writeFileSync(out, bytes)
  console.log(`${file}  ${size}×${size}  ${bytes.length} 字节`)
}
console.log(`源图 ${source}，内容区域 ${box.right - box.left + 1}×${box.bottom - box.top + 1}`)
