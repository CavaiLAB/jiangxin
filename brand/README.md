# brand：匠心的 logo

`source/` 里是匠心 logo 的原图：匠心的吉祥物，一只戴黄色安全帽的红色龙虾。

| 文件 | 尺寸（像素） |
|---|---|
| `source/icon-1024.png` | 1024 × 1024 |
| `source/icon-512.png` | 512 × 512 |
| `source/icon-192.png` | 192 × 192 |
| `source/apple-touch-icon.png` | 180 × 180 |
| `source/favicon-32.png` | 32 × 32 |

## 怎么用

- 代码里用到的各种尺寸都从 `icon-1024.png` 生成，不要另画：品牌包在 `packages/brand-theme/` 里跑 `pnpm run icons`（生成到 `assets/web/`），桌面壳在 `apps/desktop/` 里跑 `npm run icons`（生成到 `assets/` 和 `build/`）。生成的图标入库。
- 换 logo 就换这里的原图，再把上面两处重新生成一遍。
- 主题色是从这张图取样的初稿，在 `packages/brand-theme/src/client/palette.ts`。

## 许可

这些图片，以及仓库里从它们生成的图标，都不在任何代码许可之内：仓库里的代码不管以后用什么许可发布（[协作约定](../docs/07-governance.md)第 8 节），都不包括使用这个 logo 的权利。

logo 原图放进公开仓库，产品负责人 2026-11-20 确认过，见 [2026-11-20 产品裁定](../docs/decisions/2026-11-20-product.md)第 3 节。
