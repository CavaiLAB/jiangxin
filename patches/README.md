# patches：对 DSH 源码的改动

DSH 的源码不改（[AGENTS.md](../AGENTS.md)「产品的代码」）。实在绕不过去的改动写成这里的补丁文件，一处改动一个文件，文件头写明原因和什么时候可以撤掉。

## 现在有什么

| 文件 | 改哪里（DSH 源码，标签 `dsh-v0.2.2-rc.5`） | 状态 |
|---|---|---|
| `desktop-0001-about-panel-product-name.patch` | `apps/desktop/src/main.ts:1161`，「关于」面板里写死的应用名 | 样例，没有用于任何构建 |
| `desktop-0002-no-dsh-protocol-registration.patch` | `apps/desktop/src/main.ts:1488`，启动时把自己登记成 `dsh://` 的默认处理程序 | 样例，没有用于任何构建 |

这两个是评估桌面客户端的路线乙（从钉死的源码构建上游桌面壳）时写的样例，各代表一类改动：写死的品牌文字，和会跟用户自己装的上游桌面版冲突的行为。路线乙一共要改多少，见 [apps/desktop/README.md](../apps/desktop/README.md) 的「两条路线」和[换品牌的改动面](../apps/desktop/docs/upstream-rebrand-surface.md)。

桌面端走路线甲（薄壳，`apps/desktop/`），2026-11-27 定了；这个目录里一个启用的补丁都不需要。

## 写法约定

- **文件名**：`<改的是哪一块>-<四位序号>-<改了什么>.patch`，比如 `desktop-0001-about-panel-product-name.patch`。
- **一处一个**：一个文件只改一处。几处必须一起改才有意义时，各写各的，在文件头的「连带」里互相点名。
- **文件头**（差异正文之前的文字，`git apply` 和 `patch` 都会跳过）必须有：
  - 针对哪个上游版本（版本号、标签、提交）、哪个文件哪一行；
  - 原因：为什么配置和构建参数都改不了、非改源码不可；
  - 撤销条件：出现什么情况就该删掉这个补丁；
  - 连带：必须一起打的其他补丁；
  - 验证：打完以后怎么确认它起作用了，以及这个补丁实际验证到了哪一步。
- **文件头里不要出现**以 `--- `、`+++ `、`diff `、`@@` 开头的行，会被当成差异的一部分。
- **路径**：差异里的路径相对上游源码的根目录，带 `a/`、`b/` 前缀，在上游根目录用 `git apply <补丁>` 打。

## 怎么检查

先把 DSH 的源码按钉死的标签检出到仓库根下的 `upstream/dsh-ref`（不入库），然后：

```bash
bash apps/desktop/scripts/check-patches.sh
```

升级 DSH 前，把新版源码目录作为参数传进去，看哪些补丁要重新对：

```bash
bash apps/desktop/scripts/check-patches.sh <新版源码目录>
```

脚本只读上游源码：把补丁要改的文件拷到 `apps/desktop/.dev/patch-check/` 下试打，不会改源码目录。

升级 DSH 时每个补丁都要过一遍：先看撤销条件是不是已经满足（满足就删），再跑上面的检查，打不上的对着新源码重写。
