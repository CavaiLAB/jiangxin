#!/usr/bin/env bash
# 本机试用：先起假模型（127.0.0.1:3190），再起 Web 端（127.0.0.1:3180）；退出时一起停掉。
# 参数原样交给 apps/web/start.sh。
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
mock_log_dir="$root/tools/mock-model/.dev"
mkdir -p "$mock_log_dir"

mock_pid=""
if curl -fsS --max-time 1 "http://127.0.0.1:${MOCK_MODEL_PORT:-3190}/healthz" >/dev/null 2>&1; then
  echo "dev.sh: 假模型已经在 ${MOCK_MODEL_PORT:-3190} 端口上运行，直接用它。" >&2
else
  node "$root/tools/mock-model/server.mjs" >>"$mock_log_dir/server.log" 2>&1 &
  mock_pid=$!
  for _ in $(seq 1 50); do
    curl -fsS --max-time 1 "http://127.0.0.1:${MOCK_MODEL_PORT:-3190}/healthz" >/dev/null 2>&1 && break
    sleep 0.1
  done
  echo "dev.sh: 假模型已启动（进程 $mock_pid），日志在 $mock_log_dir/" >&2
fi

cleanup() {
  if [ -n "$mock_pid" ]; then kill "$mock_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

# 演示用的文件：在问题里写「读文件 jiangxin-demo.txt」，假模型会让 DSH 读它。
# 放进默认工作区（见 distribution/patches/15-default-workspace.yml）。
dsh_home="${DSH_HOME:-$root/distribution/.dev/home}"
default_workspace="${JX_DOCUMENTS_DIR:-$dsh_home/documents}/deepseek-harness/default-workspace"
mkdir -p "$default_workspace"
if [ ! -f "$default_workspace/jiangxin-demo.txt" ]; then
  printf '%s\n' '匠心工业智能体平台演示：这是给假模型演示工具调用用的文件。' '第二行：如果你在对话里看到这行字的开头，说明读文件的工具调用走通了。' >"$default_workspace/jiangxin-demo.txt"
fi

"$here/start.sh" "$@"
