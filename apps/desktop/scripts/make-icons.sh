#!/usr/bin/env bash
# 从 brand/source/icon-1024.png 生成桌面壳要用的全部图标。只用 macOS 自带的 sips 和 iconutil。
# 所有尺寸都从这一张原图缩出来，不另画（见 brand/README.md）。
#
# 产物：
#   build/icon.icns         打包用的应用图标（electron-builder 的 mac.icon）
#   build/icon.png          1024 像素，Windows/Linux 打包时由 electron-builder 自己转
#   assets/icon-256.png     关于窗口、启动页里显示的 logo
#   assets/icon-512.png     开发时设程序坞图标用
set -euo pipefail

DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-$DESKTOP_DIR/../../brand/source/icon-1024.png}"

if [ ! -f "$SOURCE" ]; then
  echo "make-icons: 找不到原图 $SOURCE" >&2
  exit 1
fi

WIDTH="$(sips -g pixelWidth "$SOURCE" | awk '/pixelWidth/ {print $2}')"
HEIGHT="$(sips -g pixelHeight "$SOURCE" | awk '/pixelHeight/ {print $2}')"
if [ "$WIDTH" != "1024" ] || [ "$HEIGHT" != "1024" ]; then
  echo "make-icons: 原图应当是 1024×1024，现在是 ${WIDTH}×${HEIGHT}" >&2
  exit 1
fi

mkdir -p "$DESKTOP_DIR/build" "$DESKTOP_DIR/assets"
WORK="$(mktemp -d "$DESKTOP_DIR/build/iconset.XXXXXX")"
ICONSET="$WORK/icon.iconset"
mkdir -p "$ICONSET"
trap 'rm -rf "$WORK"' EXIT

# iconutil 要的十个文件：五种点尺寸，各有 1x 和 2x。
resize() { sips -z "$1" "$1" "$SOURCE" --out "$2" >/dev/null; }
resize 16   "$ICONSET/icon_16x16.png"
resize 32   "$ICONSET/icon_16x16@2x.png"
resize 32   "$ICONSET/icon_32x32.png"
resize 64   "$ICONSET/icon_32x32@2x.png"
resize 128  "$ICONSET/icon_128x128.png"
resize 256  "$ICONSET/icon_128x128@2x.png"
resize 256  "$ICONSET/icon_256x256.png"
resize 512  "$ICONSET/icon_256x256@2x.png"
resize 512  "$ICONSET/icon_512x512.png"
cp "$SOURCE" "$ICONSET/icon_512x512@2x.png"

iconutil --convert icns --output "$DESKTOP_DIR/build/icon.icns" "$ICONSET"
cp "$SOURCE" "$DESKTOP_DIR/build/icon.png"
resize 256 "$DESKTOP_DIR/assets/icon-256.png"
resize 512 "$DESKTOP_DIR/assets/icon-512.png"

echo "make-icons: 已生成"
ls -l "$DESKTOP_DIR/build/icon.icns" "$DESKTOP_DIR/build/icon.png" "$DESKTOP_DIR/assets/icon-256.png" "$DESKTOP_DIR/assets/icon-512.png"
