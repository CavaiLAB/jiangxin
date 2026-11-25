#!/usr/bin/env bash
# 把文档站的构建产物发布到 docs-site 分支。部署环境从这个分支取站点内容，见 website/README.md 的「部署」。
#
# 用法（在仓库检出目录里运行，需要对 origin 有推送权限）：
#   website/scripts/publish.sh <产物目录>
#
# 只发布主干：检出要是干净的，并且就是 origin/main 的头提交，不满足就拒绝。
# 分支只有一个提交：每次把产物作为无父提交强推，构建产物不在仓库里累积历史，上一次有、这次没有的文件也不会留下。
set -euo pipefail

BRANCH="${DOCS_BRANCH:-docs-site}"
REMOTE="${DOCS_REMOTE:-origin}"

if [[ $# -ne 1 ]]; then
  sed -n '4,8p' "$0" >&2
  exit 2
fi
src="$1"
if [[ ! -f "$src/index.html" ]]; then
  echo "产物目录 $src 里没有 index.html，先在 website/ 下运行 pnpm build" >&2
  exit 1
fi

git_dir="$(git rev-parse --absolute-git-dir)"
source_sha="$(git rev-parse HEAD)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "工作区有没提交的改动，构建产物对不上任何一个提交。提交或还原之后重新构建再发布" >&2
  exit 1
fi
git fetch --quiet "$REMOTE" main
main_sha="$(git rev-parse FETCH_HEAD)"
if [[ "$source_sha" != "$main_sha" ]]; then
  echo "当前提交 ${source_sha:0:7} 不是 $REMOTE/main 的头提交 ${main_sha:0:7}。站点只发布主干：切到最新的 main，重新构建再发布" >&2
  exit 1
fi

work="$(mktemp -d)"
index="$(mktemp)"
trap 'rm -rf "$work" "$index"' EXIT

cp -R "$src"/. "$work"/

# 站点上留一份记录：取自哪个提交，什么时候发布的
node -e '
  const fs = require("node:fs");
  const [out, commit] = process.argv.slice(1);
  fs.writeFileSync(out, JSON.stringify({ commit, publishedAt: new Date().toISOString() }) + "\n");
' "$work/build-info.json" "$source_sha"

# 分支当前的头提交。分支还不存在时，推送要求它仍然不存在
if git fetch --quiet "$REMOTE" "+refs/heads/$BRANCH:refs/remotes/$REMOTE/$BRANCH" 2>/dev/null; then
  lease="$(git rev-parse "refs/remotes/$REMOTE/$BRANCH")"
else
  lease=""
fi

# 用临时索引在临时目录上建树，不碰当前检出的索引与工作区
rm -f "$index"
GIT_INDEX_FILE="$index" git -C "$work" --git-dir="$git_dir" add --all --force .
tree="$(GIT_INDEX_FILE="$index" git --git-dir="$git_dir" write-tree)"
commit="$(git commit-tree "$tree" -m "docs-site: 发布 ${source_sha:0:12}")"

if ! git push --quiet --force-with-lease="refs/heads/$BRANCH:$lease" "$REMOTE" "$commit:refs/heads/$BRANCH"; then
  echo "推送被拒：$BRANCH 分支在这期间被别的发布更新了。确认主干没有再前进之后重跑" >&2
  exit 1
fi
echo "已发布到 $BRANCH 分支：提交 ${commit:0:12}，取自 main 的 ${source_sha:0:12}"
