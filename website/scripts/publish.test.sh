#!/usr/bin/env bash
# publish.sh 的自测：在临时目录里用一个假的远端仓库跑，不碰真实的远端。
set -euo pipefail

publish="$(cd "$(dirname "$0")" && pwd)/publish.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

fail() { echo "✖ $1" >&2; exit 1; }
pass() { echo "✔ $1"; }

git init -q --bare -b main "$tmp/remote.git"
git clone -q "$tmp/remote.git" "$tmp/clone" 2>/dev/null
cd "$tmp/clone"
mkdir website
printf '{"frameworks":[{"repo":"kun","label":"Kun","commit":"%s"}]}\n' "$(printf 'a%.0s' {1..40})" > website/sources.json
git add . && git commit -q -m init && git push -q origin main

remote() { git --git-dir="$tmp/remote.git" "$@"; }
out="$tmp/out"
mkdir "$out"

# 产物目录里没有 index.html：拒绝
if bash "$publish" "$out" >/dev/null 2>&1; then fail "没有 index.html 也发布了"; fi
pass "产物目录里没有 index.html 时拒绝"

# 第一次发布：分支还不存在
echo home > "$out/index.html"
echo old > "$out/old.html"
bash "$publish" "$out" >/dev/null
[[ "$(remote rev-list --count docs-site)" == 1 ]] || fail "docs-site 应当只有一个提交"
[[ "$(remote show docs-site:index.html)" == home ]] || fail "首页内容不对"
info="$(remote show docs-site:build-info.json)"
[[ "$info" == *"\"commit\":\"$(git rev-parse HEAD)\""* ]] || fail "build-info.json 里的提交不对：$info"
[[ "$info" == *'"repo":"kun"'* ]] || fail "build-info.json 里没有框架仓库的版本：$info"
[[ -z "$(git status --porcelain)" ]] || fail "发布动了工作区"
pass "第一次发布：建出只有一个提交的 docs-site，带 build-info.json，不动工作区"

# 再次发布：整体替换，仍然只有一个提交
echo change >> website/sources.json.note
git add . && git commit -q -m second && git push -q origin main
rm "$out/old.html"
echo home2 > "$out/index.html"
bash "$publish" "$out" >/dev/null
[[ "$(remote rev-list --count docs-site)" == 1 ]] || fail "再次发布后 docs-site 应当仍然只有一个提交"
[[ "$(remote show docs-site:index.html)" == home2 ]] || fail "再次发布后首页没有更新"
if remote cat-file -e docs-site:old.html 2>/dev/null; then fail "上一次的文件还留在分支上"; fi
pass "再次发布：整体替换，分支仍然只有一个提交"

before="$(remote rev-parse docs-site)"

# 工作区有没提交的改动：拒绝
echo dirty > website/dirty.txt
if bash "$publish" "$out" >/dev/null 2>&1; then fail "工作区不干净也发布了"; fi
rm website/dirty.txt
[[ "$(remote rev-parse docs-site)" == "$before" ]] || fail "被拒绝的发布改了 docs-site"
pass "工作区有没提交的改动时拒绝"

# 当前提交不是主干的头提交：拒绝
git clone -q "$tmp/remote.git" "$tmp/other"
git -C "$tmp/other" commit -q --allow-empty -m third
git -C "$tmp/other" push -q origin main
if bash "$publish" "$out" >/dev/null 2>&1; then fail "落后于主干也发布了"; fi
[[ "$(remote rev-parse docs-site)" == "$before" ]] || fail "被拒绝的发布改了 docs-site"
pass "当前提交不是主干的头提交时拒绝"

echo "publish.sh 自测通过"
