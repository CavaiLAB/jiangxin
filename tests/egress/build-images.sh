#!/usr/bin/env bash
# 构建外联检查用的三个镜像（只在构建时联网：apt 装 tcpdump、npm 装 DSH 的 Linux 依赖和 playwright-core）。
#   jx-egress/base:1              Playwright 镜像 + tcpdump + xdg-user-dirs
#   jx-egress/dsh:0.2.2-rc.5      上面 + 按 distribution/package-lock.json 装好的 DSH
#   jx-egress/browser:1.64.0      上面 + playwright-core
# 已有的镜像会走缓存；加 --no-cache 强制重建。
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
stage="$here/.dev/build"
extra=("$@")

rm -rf "$stage" && mkdir -p "$stage/base" "$stage/dsh" "$stage/browser"
cp "$here/docker/base.Dockerfile" "$stage/base/Dockerfile"
cp "$here/docker/dsh.Dockerfile" "$stage/dsh/Dockerfile"
cp "$root/distribution/package.json" "$root/distribution/package-lock.json" "$root/distribution/.npmrc" "$stage/dsh/"
# 发行目录还依赖 vendor/ 里的插件包 tarball（品牌包、样板插件），一起放进构建上下文。
mkdir -p "$stage/dsh/vendor"
if [ -d "$root/distribution/vendor" ]; then cp "$root/distribution/vendor/"*.tgz "$stage/dsh/vendor/"; fi
cp "$here/docker/browser.Dockerfile" "$stage/browser/Dockerfile"

docker build ${extra[@]+"${extra[@]}"} -t jx-egress/base:1 "$stage/base"
docker build ${extra[@]+"${extra[@]}"} -t jx-egress/dsh:0.2.2-rc.5 "$stage/dsh"
docker build ${extra[@]+"${extra[@]}"} -t jx-egress/browser:1.64.0 "$stage/browser"
docker images --filter label=jx.owner=jiangxin-web-egress --format '{{.Repository}}:{{.Tag}} {{.Size}}'
