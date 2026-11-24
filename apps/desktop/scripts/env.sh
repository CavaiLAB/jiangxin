# 被其他脚本 source。作用：把所有工具的缓存和本机状态都圈在 apps/desktop/.dev/ 里，
# 不往 ~/.npm、~/Library/Caches/electron、~/Library/Caches/electron-builder 里写。
# 用法：source scripts/env.sh （bash 和 zsh 都可以）

# 找到这个文件自己的位置。bash 用 BASH_SOURCE；zsh 里 BASH_SOURCE 是空的，要用 %x。
# 踩过这个坑：在 zsh 里 source 时路径算到了上一层，缓存被建在 apps/.dev/。
if [ -n "${ZSH_VERSION:-}" ]; then
  eval '_jx_env_self="${(%):-%x}"'
else
  _jx_env_self="${BASH_SOURCE[0]}"
fi
JX_DESKTOP_DIR="$(cd "$(dirname "$_jx_env_self")/.." && pwd)"
unset _jx_env_self

# 自检：算出来的目录必须是桌面壳自己的目录，否则宁可停下也不乱建目录。
if [ ! -f "$JX_DESKTOP_DIR/scripts/env.sh" ] || [ ! -f "$JX_DESKTOP_DIR/package.json" ]; then
  echo "env.sh: 没能定位到 apps/desktop（算出来的是 ${JX_DESKTOP_DIR}），停止" >&2
  return 1 2>/dev/null || exit 1
fi

JX_DESKTOP_DEV_DIR="$JX_DESKTOP_DIR/.dev"

mkdir -p "$JX_DESKTOP_DEV_DIR/cache" "$JX_DESKTOP_DEV_DIR/logs" "$JX_DESKTOP_DEV_DIR/screenshots"

# npm 的下载缓存
export npm_config_cache="$JX_DESKTOP_DEV_DIR/cache/npm"
# Electron 二进制的下载缓存（node_modules/electron/install.js 认这个变量）
export electron_config_cache="$JX_DESKTOP_DEV_DIR/cache/electron"
# electron-builder 的工具缓存
export ELECTRON_BUILDER_CACHE="$JX_DESKTOP_DEV_DIR/cache/electron-builder"
# 不要自动找签名证书：现在只做未签名的本机构建
export CSC_IDENTITY_AUTO_DISCOVERY=false
# 不上报、不弹提示
export npm_config_fund=false
export npm_config_audit=false
export npm_config_update_notifier=false
export DISABLE_OPENCOLLECTIVE=1
export ADBLOCK=1

export JX_DESKTOP_DIR JX_DESKTOP_DEV_DIR
