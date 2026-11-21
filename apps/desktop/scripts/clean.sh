#!/usr/bin/env bash
# 清理。默认只说明有哪些可清的；要清什么用参数点名。
#
#   bash scripts/clean.sh --state     清本机状态：DSH 的状态目录、Electron 的用户数据、默认工作区、日志、截图
#   bash scripts/clean.sh --build     清构建产物：release/、开发用的应用包
#   bash scripts/clean.sh --cache     清下载缓存：npm、Electron、electron-builder
#   bash scripts/clean.sh --system    清系统替这个 bundle id 自动建的条目（在 ~/Library 下），并从启动服务里注销
#   bash scripts/clean.sh --all       以上全部
#
# 只会动 apps/desktop 自己的目录，和 ~/Library 下以 cn.jiangxin.agent.desktop.dev 命名的条目。
# 不碰 ~/.dsh、~/.agents、~/Documents/deepseek-harness、/Applications/DeepSeek Harness.app。
set -euo pipefail
DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIR="$DESKTOP_DIR/.dev"
BUNDLE_ID="cn.jiangxin.agent.desktop.dev"

if [ ! -f "$DESKTOP_DIR/scripts/clean.sh" ]; then
  echo "clean: 没能定位到 apps/desktop，停止" >&2
  exit 1
fi

# 系统替这个 bundle id 自动建的条目。只列以我们自己的 bundle id 命名的。
SYSTEM_ENTRIES=(
  "$HOME/Library/Preferences/$BUNDLE_ID.plist"
  "$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"
  "$HOME/Library/Caches/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID.binarycookies"
  "$HOME/Library/WebKit/$BUNDLE_ID"
)

running() {
  # 还在跑的话不清，免得删掉正在用的目录。
  pgrep -f "$DESKTOP_DIR/(release|\.dev/dev-app)/" >/dev/null 2>&1
}

DO_STATE=0; DO_BUILD=0; DO_CACHE=0; DO_SYSTEM=0
for arg in "$@"; do
  case "$arg" in
    --state) DO_STATE=1 ;;
    --build) DO_BUILD=1 ;;
    --cache) DO_CACHE=1 ;;
    --system) DO_SYSTEM=1 ;;
    --all) DO_STATE=1; DO_BUILD=1; DO_CACHE=1; DO_SYSTEM=1 ;;
    *) echo "clean: 不认识的参数 $arg" >&2; exit 1 ;;
  esac
done

if [ "$#" -eq 0 ]; then
  echo "可以清理的东西（加参数才会真的清，见脚本开头的说明）："
  echo "  --state   $DEV_DIR 下的 dsh-home agents-home electron-user-data documents host-cwd generated run logs screenshots"
  echo "  --build   $DESKTOP_DIR/release  $DEV_DIR/dev-app"
  echo "  --cache   $DEV_DIR/cache"
  echo "  --system  系统自动建的条目，现在存在的有："
  found=0
  for entry in "${SYSTEM_ENTRIES[@]}"; do
    if [ -e "$entry" ]; then echo "            $entry"; found=1; fi
  done
  [ "$found" -eq 1 ] || echo "            （没有）"
  exit 0
fi

if running; then
  echo "clean: 应用还在运行，先退出再清理" >&2
  exit 1
fi

if [ "$DO_STATE" -eq 1 ]; then
  for name in dsh-home agents-home electron-user-data documents host-cwd generated run logs screenshots; do
    rm -rf "${DEV_DIR:?}/$name"
  done
  echo "clean: 已清本机状态"
fi
if [ "$DO_BUILD" -eq 1 ]; then
  rm -rf "${DESKTOP_DIR:?}/release" "${DEV_DIR:?}/dev-app"
  echo "clean: 已清构建产物"
fi
if [ "$DO_CACHE" -eq 1 ]; then
  rm -rf "${DEV_DIR:?}/cache"
  echo "clean: 已清下载缓存"
fi
if [ "$DO_SYSTEM" -eq 1 ]; then
  # 偏好设置有缓存进程（cfprefsd），先用 defaults 删，再删文件。
  defaults delete "$BUNDLE_ID" >/dev/null 2>&1 || true
  for entry in "${SYSTEM_ENTRIES[@]}"; do
    if [ -e "$entry" ]; then rm -rf "$entry"; echo "clean: 已删 $entry"; fi
  done
  # 从启动服务（Launch Services）里注销这两个应用包，免得「打开方式」等地方还留着它们。
  LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  for app in "$DESKTOP_DIR/release/mac-arm64/匠心工业智能体平台.app" "$DEV_DIR/dev-app/匠心工业智能体平台.app"; do
    "$LSREGISTER" -u "$app" >/dev/null 2>&1 || true
  done
  echo "clean: 已清系统条目"
fi
