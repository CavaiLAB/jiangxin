#!/usr/bin/env bash
# 从构建目录直接运行打好的应用（不拷进 /Applications）。
# 用法：bash scripts/run-built.sh [传给应用的参数…]
#   例：JX_DESKTOP_SHOW=0 JX_DESKTOP_SELFTEST="$PWD/.dev/screenshots/built" bash scripts/run-built.sh
# 也可以在访达里双击 release/mac-arm64/ 下的应用，效果一样（状态目录是打包时写进去的 .dev）。
set -euo pipefail
DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$DESKTOP_DIR/release/mac-arm64/匠心工业智能体平台.app"
if [ ! -d "$APP" ]; then
  echo "run-built: 还没有构建，先跑 npm run pack:mac -- <版本号>" >&2
  exit 1
fi
exec "$APP/Contents/MacOS/匠心工业智能体平台" "$@"
