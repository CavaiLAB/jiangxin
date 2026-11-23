# 2026-11-23 旧 npm 版本迁移裁定

## P44 三个保留版本如何迁移

保留两个旧运行时版本和一个旧插件 SDK 版本的原包体，以 Qian 迁移指南和下表的逐版替代关系完成验收。[P43](2026-11-21-shell-migration.md#p43-旧-npm-包如何处理)记录了先前撤下的三个旧层包和当时的弃用计划。

| 保留的原版本 | 替代版本 |
|---|---|
| `@idadawn/qian-runtime@0.1.0` | `@cavailab/qian-runtime@0.2.1` |
| `@idadawn/qian-runtime@0.1.1` | `@cavailab/qian-runtime@0.2.1` |
| `@idadawn/qian-plugin-sdk@0.1.0` | `@cavailab/qian-plugin-sdk@0.2.1` |

GitHub Packages 拒绝了针对三个版本的原生弃用标记写入。复核时三个版本的 `deprecated` 字段均为空，npm 安装时不会针对它们给出原生弃用警告。

两个旧运行时版本仍可独立安装。旧插件 SDK 的包体仍可下载，但它依赖已撤下的旧层包：从空缓存安装或用原锁文件运行 `npm ci`，下载旧层包时会返回 404。使用方应更新依赖和锁文件，再从空缓存验证安装。已部署的静态页面继续加载已构建的资源。[Qian 包名对照与锁文件迁移](https://github.com/CavaiLAB/qian/blob/main/docs/migrating-from-yue.md#旧依赖还能否从包源安装)
