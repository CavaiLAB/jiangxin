#!/usr/bin/env bash
# 检查 patches/ 下的桌面壳补丁还能不能干净地打到钉死的上游源码上。
#
# 只读：不改上游源码。做法是把每个补丁要改的文件拷到 .dev/patch-check/<补丁名>/ 下，
# 在那里用 git apply --check 试打（上下文要原样对上，行号可以偏移）。
#
# 用法：bash scripts/check-patches.sh [上游源码目录]
#       上游源码目录默认是仓库根下的 upstream/dsh-ref：把 DSH 的源码按钉死的标签（dsh-v0.2.2-rc.5）检出到那里，
#       这个目录不进 git。升级 DSH 时指向新版本的源码，就能看出哪些补丁要重新对。
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

REPO_ROOT="$(cd "$JX_DESKTOP_DIR/../.." && pwd)"
UPSTREAM="${1:-$REPO_ROOT/upstream/dsh-ref}"
PATCH_DIR="$REPO_ROOT/patches"
WORK="$JX_DESKTOP_DEV_DIR/patch-check"

if [ ! -d "$UPSTREAM/apps/desktop" ]; then
  echo "check-patches: $UPSTREAM 不像是 DSH 的源码目录（没有 apps/desktop）" >&2
  exit 1
fi

failed=0
count=0
for patch in "$PATCH_DIR"/desktop-*.patch; do
  [ -e "$patch" ] || continue
  count=$((count + 1))
  name="$(basename "$patch" .patch)"
  tree="$WORK/$name"
  missing=0
  # 补丁里 "+++ b/<路径>" 的那些文件就是它要改的文件。
  while IFS= read -r target; do
    if [ ! -f "$UPSTREAM/$target" ]; then
      echo "打不上  ${name}：上游里没有 $target"
      missing=1
      continue
    fi
    mkdir -p "$(dirname "$tree/$target")"
    cp -f "$UPSTREAM/$target" "$tree/$target"
  done < <(sed -n 's|^+++ b/||p' "$patch")
  if [ "$missing" -eq 1 ]; then
    failed=$((failed + 1))
    continue
  fi
  if (cd "$tree" && git apply --check "$patch" 2>/dev/null); then
    echo "能打上  $name"
  else
    echo "打不上  ${name}：上下文对不上，要对着新源码重写这个补丁"
    failed=$((failed + 1))
  fi
done

echo "check-patches: 共 $count 个补丁，$failed 个打不上（对照 ${UPSTREAM}）"
[ "$failed" -eq 0 ]
