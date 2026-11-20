#!/usr/bin/env bash
# 外联检查：在出不了外网的容器网络里，分别跑「关之前」（DSH 默认配置）和「关之后」（我们的发行补丁），
# 同样的操作，用网络层的抓包和接收器日志记下实例想连哪些地址。
#
# 用法：tests/egress/run.sh [before] [after]      （默认两遍都跑）
#   环境变量：KEEP_NETWORK=1 结束后保留 Docker 网络；IDLE_SECONDS=20 操作完静置多久。
#
# 拓扑（网络 jx-egress-net，--internal，没有通往宿主或外网的路由）：
#   10.250.73.2   jx-egress-sink     假 DNS + HTTP/HTTPS 万能接收器（所有外部域名都解析到这里）
#   10.250.73.3   jx-egress-model    假模型网关（model-gateway.jx.test，「关之后」那一遍允许的唯一地址）
#   10.250.73.10  jx-egress-dsh      被测的 DSH；旁边的 jx-egress-dsh-cap 共享它的网络命名空间抓包
#   10.250.73.20  jx-egress-browser  无头 Chromium 驱动界面；旁边的 jx-egress-browser-cap 抓浏览器的包
# 不在宿主机上用 sudo，不改宿主网络设置，不对宿主暴露任何端口。
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
NET=jx-egress-net
SUBNET=10.250.73.0/24
SINK_IP=10.250.73.2
MODEL_IP=10.250.73.3
DSH_IP=10.250.73.10
BROWSER_IP=10.250.73.20
LABEL=jx.owner=jiangxin-web-egress
IDLE_SECONDS="${IDLE_SECONDS:-20}"
FAKE_DEEPSEEK_KEY=sk-jx-egress-fake-key-not-a-secret
CONTAINERS=(jx-egress-sink jx-egress-model jx-egress-dsh jx-egress-dsh-cap jx-egress-browser jx-egress-browser-cap)

passes=("$@")
[ ${#passes[@]} -gt 0 ] || passes=(before after)
run_id="$(date +%Y%m%d-%H%M%S)"
run_dir="$here/.dev/runs/$run_id"
mkdir -p "$run_dir"
echo "egress: 结果目录 $run_dir" >&2

remove_containers() { docker rm -f "${CONTAINERS[@]}" >/dev/null 2>&1 || true; }
finish() {
  remove_containers
  if [ "${KEEP_NETWORK:-}" != "1" ]; then docker network rm "$NET" >/dev/null 2>&1 || true; fi
}
trap finish EXIT

wait_for() { # 文件 正则 超时秒数
  local file="$1" pattern="$2" timeout="$3" i
  for ((i = 0; i < timeout * 2; i++)); do
    if [ -f "$file" ] && grep -qE "$pattern" "$file"; then return 0; fi
    sleep 0.5
  done
  echo "egress: 等待 $file 里出现 /$pattern/ 超时" >&2
  return 1
}

# --- 镜像与网络 -----------------------------------------------------------------------------------
for image in jx-egress/base:1 jx-egress/dsh:0.2.2-rc.5 jx-egress/browser:1.64.0; do
  docker image inspect "$image" >/dev/null 2>&1 || { echo "egress: 缺镜像 $image，先构建" >&2; "$here/build-images.sh"; break; }
done
remove_containers
if ! docker network inspect "$NET" >/dev/null 2>&1; then
  docker network create --internal --subnet "$SUBNET" --label "$LABEL" "$NET" >/dev/null
fi
if [ "$(docker network inspect -f '{{.Internal}}' "$NET")" != "true" ]; then
  echo "egress: $NET 不是 --internal 网络，拒绝继续" >&2
  exit 1
fi
printf 'nameserver %s\noptions timeout:2 attempts:2\n' "$SINK_IP" >"$run_dir/resolv.conf"

run_pass() {
  local pass="$1" d="$run_dir/$1"
  mkdir -p "$d/out" "$d/state/home" "$d/state/agents" "$d/state/work" "$d/browser"
  echo "egress: === $pass ===" >&2

  # 接收器：每一遍重新起，日志各自独立；CA 也各自生成。
  docker run -d --name jx-egress-sink --label "$LABEL" --network "$NET" --ip "$SINK_IP" \
    -v "$here/sink:/opt/jx/sink:ro" -v "$d/out:/out" \
    -e SINK_IP="$SINK_IP" -e SINK_OUT=/out \
    -e SINK_STATIC_HOSTS="model-gateway.jx.test=$MODEL_IP" \
    -e SINK_FORWARDS="api.deepseek.com/anthropic/=http://$MODEL_IP:3190" \
    -e SINK_RAW_PORTS="22,853,4317,4318,5228,8080,8443,9418" \
    jx-egress/base:1 node /opt/jx/sink/sink.mjs >/dev/null
  wait_for "$d/out/sink-events.jsonl" '"sink-ready"' 60

  # 假模型网关
  docker run -d --name jx-egress-model --label "$LABEL" --network "$NET" --ip "$MODEL_IP" --user pwuser \
    -v "$root/tools/mock-model:/opt/jx/mock-model:ro" -v "$d/out:/out" \
    -e MOCK_MODEL_HOST=0.0.0.0 -e MOCK_MODEL_PORT=3190 -e MOCK_MODEL_LOG=/out/model-requests.jsonl \
    jx-egress/base:1 node /opt/jx/mock-model/server.mjs >/dev/null

  # DSH 容器先空转，等抓包起来再启动 DSH 进程，这样启动阶段的外联也能抓到。
  docker run -d --name jx-egress-dsh --label "$LABEL" --network "$NET" --ip "$DSH_IP" --user pwuser \
    -v "$run_dir/resolv.conf:/etc/resolv.conf:ro" \
    -v "$d/out/ca:/opt/jx/ca:ro" -v "$d/state:/state" -v "$d/out:/out" \
    -v "$root/distribution/bin:/opt/jx/distribution/bin:ro" \
    -v "$root/distribution/patches:/opt/jx/distribution/patches:ro" \
    -w /state/work jx-egress/dsh:0.2.2-rc.5 sleep infinity >/dev/null
  docker run -d --name jx-egress-dsh-cap --label "$LABEL" --network container:jx-egress-dsh \
    --cap-add NET_ADMIN --cap-add NET_RAW -v "$d/out:/out" \
    jx-egress/base:1 tcpdump -i any -nn -s 0 -U -w /out/dsh.pcap 'not tcp port 3180' >/dev/null
  sleep 2

  # 两个可能的默认工作区里都放好演示文件（关之前：~/Documents/…；关之后：$DSH_HOME/documents/…）。
  docker exec jx-egress-dsh bash -c '
    demo="匠心工业智能体平台演示：这是给假模型演示工具调用用的文件。"
    for dir in /home/pwuser/Documents/deepseek-harness/default-workspace /state/home/documents/deepseek-harness/default-workspace; do
      mkdir -p "$dir" && printf "%s\n%s\n" "$demo" "第二行：外联检查用。" > "$dir/jiangxin-demo.txt"
    done'

  local common_env=(-e HOME=/home/pwuser -e DSH_HOME=/state/home -e DSH_AGENTS_HOME=/state/agents
    -e DEEPSEEK_API_KEY="$FAKE_DEEPSEEK_KEY" -e NODE_EXTRA_CA_CERTS=/opt/jx/ca/ca.pem)
  if [ "$pass" = before ]; then
    # 关之前：DSH 默认配置，只给一个假的 DeepSeek 密钥（否则默认的官方路由连对话都发不出去）。
    docker exec -d "${common_env[@]}" jx-egress-dsh bash -c \
      'echo $$ > /out/dsh.pid; exec /opt/jx/distribution/node_modules/.bin/dsh --profile web --host '"$DSH_IP"' --port 3180 --no-open > /out/dsh.log 2>&1'
  else
    # 关之后：我们的发行启动器和补丁；模型地址指向假模型网关。
    docker exec -d "${common_env[@]}" -e JX_MODEL_BASE_URL="http://model-gateway.jx.test:3190/v1" \
      -e JX_MODEL_API_KEY=jx-egress-fake-model-key jx-egress-dsh bash -c \
      'echo $$ > /out/dsh.pid; exec /opt/jx/distribution/bin/jx-dsh --profile web --host '"$DSH_IP"' --port 3180 --no-open > /out/dsh.log 2>&1'
  fi
  wait_for "$d/out/dsh.log" 'dsh web: http' 240
  local url
  url="$(grep -oE 'http://[0-9.]+:3180/\?token=[A-Za-z0-9_-]+' "$d/out/dsh.log" | tail -1)"

  docker run -d --name jx-egress-browser --label "$LABEL" --network "$NET" --ip "$BROWSER_IP" --user pwuser \
    -v "$run_dir/resolv.conf:/etc/resolv.conf:ro" -v "$here/browser/drive.mjs:/opt/jx/browser/drive.mjs:ro" \
    -v "$d/browser:/out" jx-egress/browser:1.64.0 sleep infinity >/dev/null
  docker run -d --name jx-egress-browser-cap --label "$LABEL" --network container:jx-egress-browser \
    --cap-add NET_ADMIN --cap-add NET_RAW -v "$d/out:/out" \
    jx-egress/base:1 tcpdump -i any -nn -s 0 -U -w /out/browser.pcap 'not tcp port 3180' >/dev/null
  sleep 2
  docker exec jx-egress-browser node /opt/jx/browser/drive.mjs --url "$url" --out /out --idle "$IDLE_SECONDS" \
    >"$d/browser/drive.out" 2>&1 || echo "egress: 浏览器脚本非零退出，见 $d/browser/drive.out" >&2

  # 正常停 DSH（SIGTERM 会走正常的退出流程，遥测之类的排空也在这一步）。
  docker exec jx-egress-dsh bash -c 'kill -TERM "$(cat /out/dsh.pid)" 2>/dev/null; for i in $(seq 1 30); do kill -0 "$(cat /out/dsh.pid)" 2>/dev/null || exit 0; sleep 0.5; done; exit 1' \
    || echo "egress: DSH 没在 15 秒内退出" >&2
  sleep 2
  docker stop -t 5 jx-egress-dsh-cap jx-egress-browser-cap >/dev/null
  docker logs jx-egress-dsh-cap >"$d/out/dsh-cap.log" 2>&1 || true
  docker logs jx-egress-browser-cap >"$d/out/browser-cap.log" 2>&1 || true
  remove_containers

  # 把抓包转成文本，交给 analyze.mjs。
  for cap in dsh browser; do
    docker run --rm --network none -v "$d/out:/out" jx-egress/base:1 \
      tcpdump -nn -tttt -r "/out/$cap.pcap" >"$d/out/$cap.pcap.txt" 2>"$d/out/$cap.pcap.err" || true
  done
}

for pass in "${passes[@]}"; do
  case "$pass" in before | after) run_pass "$pass" ;; *) echo "egress: 不认识的一遍：$pass" >&2; exit 2 ;; esac
done

node "$here/analyze.mjs" "$run_dir"
echo "egress: 完成。摘要：$run_dir/summary.md" >&2
