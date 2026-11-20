#!/usr/bin/env bash
# 开发启动：不打包，直接用 .dev/dev-app/ 里那份换好身份的 Electron 跑 src/main.js。
# 状态都在 apps/desktop/.dev/ 下。壳认的环境变量见 README.md。
# 用法：npm run dev            （或 bash scripts/dev.sh）
#       npm run dev -- --jx-titlebar=hiddenInset
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
cd "$JX_DESKTOP_DIR"

if [ ! -d node_modules/electron ]; then
  echo "dev: 还没有装依赖，先跑 npm install（记得先 source scripts/env.sh）" >&2
  exit 1
fi
if [ ! -d node_modules/electron/dist ]; then
  node node_modules/electron/install.js
fi
if [ ! -d runtime/node_modules/@deepseek-ai/dsh ]; then
  bash scripts/install-runtime.sh
fi

ELECTRON_BIN="$(bash scripts/prepare-dev-app.sh | tail -1)"
exec "$ELECTRON_BIN" "$JX_DESKTOP_DIR" "$@"
