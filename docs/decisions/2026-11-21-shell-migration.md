# 2026-11-21 旧应用外壳迁移裁定

本次裁定接续 [2026-11-20 产品裁定](2026-11-20-product.md)的编号，回答 Kun 仓库中现有应用外壳在本次迁移中如何验收。

## P42 本次迁移如何验收

本次迁移保留现网运行的旧应用外壳，按冻结的 Qian `0.2.1` 归档验收。保留现有数据库及其中的数据，不清库。

业务预发继续运行原有外壳和远程模块。归档时核对冻结版本的包、标签与源码；验收范围见 [Kun 的外壳迁移决策](https://github.com/CavaiLAB/kun/blob/7bc0f343c74598c26489c541c0722773483b286f/pm/tasks/S1-DEC-039.md)，版本与来源见 [Qian 的维护记录](https://github.com/CavaiLAB/qian/blob/main/docs/migration.md)。

匠心工业智能体平台的 Web 与桌面端继续按 [P38](2026-11-20-product.md#1-已定) 使用 DSH 客户端。旧外壳代码以后的用途、Qian 是否再发新版，以及产品的登录、租户、策略和审计由哪个后端提供，仍待后续裁定。（11 月 25 日补：登录的部分已定，用 Kun 的身份服务，见 [2026-11-25 平台级裁定](2026-11-25-platform.md) P57、P64；其余仍待定。）

## P43 旧 npm 包如何处理

GitHub Packages 已撤下 `@idadawn/yue-sdk`、`@idadawn/yue-contracts`、`@idadawn/yue-tokens`。三个包原来各只有 `0.1.0`，现在包元数据和原安装文件均返回 404。

旧运行时 `@idadawn/qian-runtime` 的 `0.1.0`、`0.1.1` 和旧插件 SDK `@idadawn/qian-plugin-sdk` 的 `0.1.0` 已决定弃用，三个版本仍可下载。截至 2026-11-21，包源的原生弃用标记仍待写入，安装时不会显示弃用提示。

旧插件 SDK 依赖已撤下的层包，从空缓存重新安装会失败，使用原锁文件恢复也会失败。旧运行时的两个版本仍能独立安装。使用方可将运行时和插件 SDK 分别换为 `@cavailab/qian-runtime@0.2.1` 和 `@cavailab/qian-plugin-sdk@0.2.1`，更新依赖和锁文件。[包名对照与安装说明](https://github.com/CavaiLAB/qian/blob/main/docs/migrating-from-yue.md#旧依赖还能否从包源安装)

2026-11-23 的[后继裁定 P44](2026-11-23-legacy-npm.md)记录了注册表的最终结果，以及这三个保留版本各自的替代包。
