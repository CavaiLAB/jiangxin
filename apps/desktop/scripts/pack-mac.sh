#!/usr/bin/env bash
# 打一个 macOS arm64 的未签名本机构建（只出应用包，不出安装镜像；不签名、不公证、不发布）。
#
# 用法：
#   bash scripts/pack-mac.sh 2026.11.20-beta.1     注入产品版本号（不带 v）
#   bash scripts/pack-mac.sh v2026.11.20-beta.1    带 v 也收，会去掉
#   bash scripts/pack-mac.sh                       不注入：应用里显示「本地开发」
#
# 可选的环境变量：
#   JX_PACK_DISTRIBUTION_DIR   打进包里的发行目录，默认是 apps/desktop/runtime
#
# 产物：release/mac-arm64/匠心工业智能体平台.app
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
cd "$JX_DESKTOP_DIR"

VERSION="${1:-}"
VERSION="${VERSION#v}"

if [ -n "$VERSION" ]; then
  # 版本号不合规就不打。校验式在 src/version.js，和测试共用一份。
  if ! node -e "process.exit(require('./src/version').isProductVersion(process.argv[1]) ? 0 : 1)" "$VERSION"; then
    echo "pack-mac: 版本号必须是 YYYY.M.D、YYYY.M.D-N 或 YYYY.M.D-beta.N（月日不补零），现在是 $VERSION" >&2
    exit 1
  fi
fi

if [ ! -d node_modules/electron/dist ]; then
  node node_modules/electron/install.js
fi
# 打进包里的发行目录。默认是 runtime/：每次打包前从 distribution/ 同步并按锁文件重装，
# 保证和 Web 端是同一份。JX_PACK_SKIP_RUNTIME_SYNC=1 跳过同步（只在反复试打包、确认 distribution/ 没改过时用）。
PACK_DIST="${JX_PACK_DISTRIBUTION_DIR:-runtime}"
if [ -z "${JX_PACK_DISTRIBUTION_DIR:-}" ] && [ "${JX_PACK_SKIP_RUNTIME_SYNC:-}" != "1" ]; then
  bash scripts/install-runtime.sh
fi
if [ ! -d "$PACK_DIST/node_modules/@deepseek-ai/dsh" ]; then
  echo "pack-mac: $PACK_DIST 还没装好依赖" >&2
  exit 1
fi
# 启动前检查：DSH 版本、插件包、补丁、品牌包这一行。DSH 遇到版本对不上或找不到的插件只停用、不报错，
# 打进应用包以后就改不了了，所以打包前查，查不过不打。
if [ ! -f "$PACK_DIST/bin/jx-preflight.mjs" ]; then
  echo "pack-mac: $PACK_DIST 里没有 bin/jx-preflight.mjs，不是完整的发行目录（先跑 scripts/install-runtime.sh）" >&2
  exit 1
fi
node "$PACK_DIST/bin/jx-preflight.mjs" --dist "$PACK_DIST" --profile web
bash scripts/make-icons.sh

# 这是本机构建：把状态根目录（apps/desktop/.dev）写进包里。
# 这样从访达双击启动时状态也落在 .dev 下，而不是系统默认位置。正式构建不会带这一项。
EXTRA=(
  "--config.extraMetadata.jiangxin.channel=dev"
  "--config.extraMetadata.jiangxin.stateRoot=$JX_DESKTOP_DEV_DIR"
)
if [ -n "$VERSION" ]; then
  # 产品版本号在打包时注入，界面上显示的版本取 app.getVersion()。
  EXTRA+=(--config.extraMetadata.version="$VERSION")
fi

rm -rf release/mac-arm64
node_modules/.bin/electron-builder --mac --arm64 --dir --publish never "${EXTRA[@]}"

APP="release/mac-arm64/匠心工业智能体平台.app"
echo "pack-mac: 完成 $JX_DESKTOP_DIR/$APP"
echo "pack-mac: 版本 $(plutil -extract CFBundleShortVersionString raw "$APP/Contents/Info.plist")，bundle id $(plutil -extract CFBundleIdentifier raw "$APP/Contents/Info.plist")"
