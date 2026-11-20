#!/usr/bin/env bash
# 启动匠心工业智能体平台的 Web 端。
#
# 默认：127.0.0.1:3180，不自动打开浏览器，状态目录 distribution/.dev/home，
#       工作目录 distribution/.dev/workspace，模型走本机假模型（需另外启动 tools/mock-model）。
# 额外参数原样交给 DSH 的 Web 应用，例如：
#   apps/web/start.sh --public-url https://jx.example.com/ui/ --trusted-host jx.example.com
#
# 可调的环境变量：
#   JX_WEB_HOST / JX_WEB_PORT    监听地址与端口（默认 127.0.0.1 / 3180）
#   JX_WORKSPACE                 DSH 的工作目录（默认 distribution/.dev/workspace）
#   JX_MODEL_BASE_URL            模型网关地址（默认 http://127.0.0.1:3190/v1，即本机假模型）
#   JX_MODEL_API_KEY             模型网关密钥（默认一个假值，只给假模型用）
#   JX_PRODUCT_VERSION / JX_PRODUCT_COMMIT   产品版本号与提交，见 distribution/bin/jx-dsh
#   其余见 distribution/bin/jx-dsh 的说明。
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
dist_dir="${JX_DISTRIBUTION_DIR:-$root/distribution}"

workspace="${JX_WORKSPACE:-$dist_dir/.dev/workspace}"
mkdir -p "$workspace"
cd "$workspace"

# 假模型不校验密钥，但 pi-ai 的 OpenAI 兼容实现要求有一个；这个值不是秘密。
export JX_MODEL_API_KEY="${JX_MODEL_API_KEY:-jx-local-mock-key-not-a-secret}"

exec "$dist_dir/bin/jx-dsh" --profile web \
  --host "${JX_WEB_HOST:-127.0.0.1}" \
  --port "${JX_WEB_PORT:-3180}" \
  --no-open \
  "$@"
