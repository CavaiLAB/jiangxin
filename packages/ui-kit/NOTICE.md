# 第三方代码与许可

`@jx/ui-kit` 自己的代码不对外授权（`package.json` 的 `license` 是 `UNLICENSED`）。下面这些是别人的代码，各按各的许可。

## 源码里的

| 位置 | 来源 | 许可 |
|---|---|---|
| `src/ui/` 下除 `date-picker.tsx` 以外的文件 | shadcn 命令行 4.23.0 从 shadcn/ui 的组件清单（风格 `base-nova`）生成，再经 `tools/adapt-generated.mjs` 和手工改过 | MIT，Copyright (c) 2023 shadcn |
| `src/styles/jx.tailwind.css` 里的九条自定义变体 | shadcn 4.23.0 的 `dist/tailwind.css` | MIT，Copyright (c) 2023 shadcn |

## 构建时打进插件包的依赖

用到这些组件的插件，构建时会把下面的包打进自己的 `lib/client.js`（Tailwind 编出来的样式开头带着它自己的许可注释）。

| 包 | 版本 | 许可 | 版权 |
|---|---|---|---|
| `@base-ui/react`、`@base-ui/utils` | 1.9.0、0.5.0 | MIT | Copyright (c) 2019 Material-UI SAS |
| `@floating-ui/react-dom`、`@floating-ui/dom`、`@floating-ui/core`、`@floating-ui/utils` | 2.1.9、1.8.0、1.8.0、0.2.12 | MIT | Copyright (c) 2021-present Floating UI contributors |
| `use-sync-external-store` | 1.7.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| `reselect` | 5.3.0 | MIT | Copyright (c) 2015-2018 Reselect Contributors |
| `@babel/runtime` | 8.1.3 | MIT | Copyright (c) 2014-present Sebastian McKenzie and other contributors |
| `react-day-picker` | 10.0.2 | MIT | Copyright (c) 2014-2026 Giampaolo Bellavite and contributors |
| `date-fns`、`@date-fns/tz` | 4.4.0、1.5.0 | MIT | Copyright (c) 2021 Sasha Koss and Lesha Koss |
| `lucide-react` | 1.70.0 | ISC | Copyright (c) 2026 Lucide Icons and Contributors |
| `cn` | 0.5.2 | MIT | Copyright (c) 2026 shadcn |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | Copyright 2022 Joe Bell |
| `clsx` | 2.1.1 | MIT | Copyright (c) Luke Edwards |
| `tailwindcss`（编出来的样式）、`tw-animate-css` | 4.3.5、1.4.0 | MIT | Copyright (c) Tailwind Labs, Inc.；Copyright (c) 2025 Wombosvideo |

许可原文在各包的 `LICENSE` 文件里（装好依赖以后在 `node_modules/<包名>/` 下）。Apache-2.0 的全文另见 <https://www.apache.org/licenses/LICENSE-2.0>。

## MIT 许可

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## ISC 许可

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
