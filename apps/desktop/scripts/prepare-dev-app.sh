#!/usr/bin/env bash
# 准备开发用的应用包：把 node_modules 里的 Electron.app 克隆一份到 .dev/dev-app/，
# 换上我们自己的 bundle id、名称和图标。最后一行输出里面的可执行文件路径。
#
# 为什么不直接 `electron .`：那样进程的身份是 com.github.Electron，系统会把窗口状态、
# 偏好设置记到这个通用的标识下，和这台电脑上别的 Electron 开发共用。用自己的 bundle id
# 才算和别的应用隔离干净（上游的开发启动也是另做一个 Harness Dev.app）。
#
# Electron 官方构建的签名是 linker-signed 的临时签名，不绑定 Info.plist，也不封存资源，
# 所以改 Info.plist、换图标之后不需要重新签名。
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

BUNDLE_ID="cn.jiangxin.agent.desktop.dev"
PRODUCT_NAME="匠心工业智能体平台"
SOURCE_APP="$JX_DESKTOP_DIR/node_modules/electron/dist/Electron.app"
DEV_APP="$JX_DESKTOP_DEV_DIR/dev-app/$PRODUCT_NAME.app"
ICON="$JX_DESKTOP_DIR/build/icon.icns"
STAMP="$DEV_APP/Contents/Resources/jx-dev-app.stamp"

if [ ! -d "$SOURCE_APP" ]; then
  echo "prepare-dev-app: 还没有 Electron 的二进制，先跑：node node_modules/electron/install.js（记得先 source scripts/env.sh）" >&2
  exit 1
fi
if [ ! -f "$ICON" ]; then
  bash "$JX_DESKTOP_DIR/scripts/make-icons.sh" >&2
fi

WANT="$(cat "$JX_DESKTOP_DIR/node_modules/electron/dist/version") $(shasum "$ICON" | cut -c1-16) $BUNDLE_ID"
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$WANT" ]; then
  rm -rf "$JX_DESKTOP_DEV_DIR/dev-app"
  mkdir -p "$JX_DESKTOP_DEV_DIR/dev-app"
  # -c：在 APFS 上做写时复制的克隆，几乎不占额外空间。
  cp -Rc "$SOURCE_APP" "$DEV_APP"
  PLIST="$DEV_APP/Contents/Info.plist"
  plutil -replace CFBundleIdentifier -string "$BUNDLE_ID" "$PLIST"
  plutil -replace CFBundleName -string "$PRODUCT_NAME" "$PLIST"
  plutil -replace CFBundleDisplayName -string "$PRODUCT_NAME" "$PLIST"
  plutil -replace CFBundleIconFile -string "icon.icns" "$PLIST"
  plutil -replace LSApplicationCategoryType -string "public.app-category.productivity" "$PLIST"
  # 用不到的权限用途说明去掉，免得系统弹出误导人的授权框。
  for key in NSCameraUsageDescription NSBluetoothAlwaysUsageDescription NSBluetoothPeripheralUsageDescription NSAudioCaptureUsageDescription NSMicrophoneUsageDescription; do
    plutil -remove "$key" "$PLIST" 2>/dev/null || true
  done
  cp "$ICON" "$DEV_APP/Contents/Resources/icon.icns"
  echo "$WANT" > "$STAMP"
  echo "prepare-dev-app: 已准备 $DEV_APP" >&2
fi

echo "$DEV_APP/Contents/MacOS/Electron"
