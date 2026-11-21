#!/usr/bin/env bash
# 反向代理验证：nginx（HTTPS，去掉 /ui/ 前缀）→ DSH Web 端（我们的发行配置），在不通外网的容器网络里跑。
# 复用外联检查的镜像（tests/egress/build-images.sh）和接收器（当 DNS 用，顺带兜住意外外联）。
#
# 用法：apps/web/proxy-test/run.sh
# 结果：apps/web/proxy-test/.dev/<时间>/（proxy-drive.json、curl-checks.txt、nginx 日志、截图）
#
# 拓扑（网络 jx-webproxy-net，--internal）：
#   10.250.74.2  jx-webproxy-sink    假 DNS：jx.example.test → nginx，model-gateway.jx.test → 假模型
#   10.250.74.3  jx-webproxy-model   假模型网关
#   10.250.74.11 jx-webproxy-dsh     DSH，--public-url https://jx.example.test/ui/ --trusted-host jx.example.test
#   10.250.74.12 jx-webproxy-nginx   nginx:1.29-alpine
#   10.250.74.20 jx-webproxy-browser 无头 Chromium + curl
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
NET=jx-webproxy-net
LABEL=jx.owner=jiangxin-web-egress
SINK_IP=10.250.74.2 MODEL_IP=10.250.74.3 DSH_IP=10.250.74.11 NGINX_IP=10.250.74.12 BROWSER_IP=10.250.74.20
CONTAINERS=(jx-webproxy-sink jx-webproxy-model jx-webproxy-dsh jx-webproxy-nginx jx-webproxy-browser)
d="$here/.dev/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$d/out" "$d/certs" "$d/state/home" "$d/state/agents" "$d/state/work" "$d/browser"

cleanup() {
  docker rm -f "${CONTAINERS[@]}" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup
docker network create --internal --subnet 10.250.74.0/24 --label "$LABEL" "$NET" >/dev/null
printf 'nameserver %s\noptions timeout:2 attempts:2\n' "$SINK_IP" >"$d/resolv.conf"

docker run -d --name jx-webproxy-sink --label "$LABEL" --network "$NET" --ip "$SINK_IP" \
  -v "$root/tests/egress/sink:/opt/jx/sink:ro" -v "$d/out:/out" \
  -e SINK_IP="$SINK_IP" -e SINK_OUT=/out -e SINK_STATIC_HOSTS="jx.example.test=$NGINX_IP,model-gateway.jx.test=$MODEL_IP" \
  jx-egress/base:1 node /opt/jx/sink/sink.mjs >/dev/null
docker run -d --name jx-webproxy-model --label "$LABEL" --network "$NET" --ip "$MODEL_IP" --user pwuser \
  -v "$root/tools/mock-model:/opt/jx/mock-model:ro" -v "$d/out:/out" \
  -e MOCK_MODEL_HOST=0.0.0.0 -e MOCK_MODEL_LOG=/out/model-requests.jsonl \
  jx-egress/base:1 node /opt/jx/mock-model/server.mjs >/dev/null

# 代理这一段的自签证书（浏览器用 ignoreHTTPSErrors 接受它）。
docker run --rm --network none -v "$d/certs:/certs" jx-egress/base:1 openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout /certs/proxy.key -out /certs/proxy.pem -days 2 -subj /CN=jx.example.test \
  -addext subjectAltName=DNS:jx.example.test >/dev/null 2>&1

docker run -d --name jx-webproxy-dsh --label "$LABEL" --network "$NET" --ip "$DSH_IP" --user pwuser \
  -v "$d/resolv.conf:/etc/resolv.conf:ro" -v "$d/state:/state" -v "$d/out:/out" \
  -v "$root/distribution/bin:/opt/jx/distribution/bin:ro" -v "$root/distribution/patches:/opt/jx/distribution/patches:ro" \
  -w /state/work jx-egress/dsh:0.2.2-rc.5 sleep infinity >/dev/null
docker exec jx-webproxy-dsh bash -c 'dir=/state/home/documents/deepseek-harness/default-workspace; mkdir -p "$dir"; printf "%s\n" "经反向代理读到的演示文件。" > "$dir/jiangxin-demo.txt"'
docker exec -d -e HOME=/home/pwuser -e DSH_HOME=/state/home -e DSH_AGENTS_HOME=/state/agents \
  -e JX_MODEL_BASE_URL=http://model-gateway.jx.test:3190/v1 -e JX_MODEL_API_KEY=jx-proxy-test-fake-key \
  jx-webproxy-dsh bash -c 'exec /opt/jx/distribution/bin/jx-dsh --profile web --host '"$DSH_IP"' --port 3180 --no-open --public-url https://jx.example.test/ui/ --trusted-host jx.example.test > /out/dsh.log 2>&1'
for i in $(seq 1 240); do grep -q 'dsh web: https://jx.example.test/ui/' "$d/out/dsh.log" 2>/dev/null && break; sleep 0.5; done
url="$(grep -oE 'https://jx\.example\.test/ui/\?token=[A-Za-z0-9_-]+' "$d/out/dsh.log" | tail -1)"
[ -n "$url" ] || { echo "proxy-test: DSH 没打印公开地址，见 $d/out/dsh.log" >&2; exit 1; }

sed "s/__DSH_UPSTREAM__/$DSH_IP:3180/" "$here/nginx.conf.template" >"$d/nginx.conf"
docker run -d --name jx-webproxy-nginx --label "$LABEL" --network "$NET" --ip "$NGINX_IP" \
  -v "$d/nginx.conf:/etc/nginx/nginx.conf:ro" -v "$d/certs:/certs:ro" -v "$d/out:/out" nginx:1.29-alpine >/dev/null

docker run -d --name jx-webproxy-browser --label "$LABEL" --network "$NET" --ip "$BROWSER_IP" --user pwuser \
  -v "$d/resolv.conf:/etc/resolv.conf:ro" -v "$here/drive.mjs:/opt/jx/browser/drive-proxy.mjs:ro" -v "$d/browser:/out" \
  jx-egress/browser:1.64.0 sleep infinity >/dev/null
sleep 2

docker exec jx-webproxy-browser node /opt/jx/browser/drive-proxy.mjs --url "$url" --out /out >"$d/browser/drive.out" 2>&1 || true

# 几个用 curl 做的边界检查（都从浏览器容器发出）。
{
  echo "# 代理入口 /ui 应 301 到 /ui/"
  docker exec jx-webproxy-browser curl -sk -o /dev/null -w '%{http_code} -> %{redirect_url}\n' https://jx.example.test/ui
  echo "# 经代理、Host 可信、没带 cookie 的 API 请求：应 401（通过了 Host 检查，但没认证）"
  docker exec jx-webproxy-browser curl -sk -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' --data '{}' https://jx.example.test/ui/api/settings/describe
  echo "# 经代理、但 Host 被改成不在 --trusted-host 里的名字：应 403（Host 检查不过）"
  docker exec jx-webproxy-browser curl -sk -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -H 'Host: other.example.test' --data '{}' "https://$NGINX_IP/ui/api/settings/describe"
  echo "# 不经代理、直接访问 DSH 的端口，没带 cookie：应 401"
  docker exec jx-webproxy-browser curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' --data '{}' "http://$DSH_IP:3180/api/settings/describe"
  echo "# 令牌只能在 /ui/ 换 cookie；拿令牌访问别的路径：不应发 cookie"
  docker exec jx-webproxy-browser curl -sk -o /dev/null -D - "https://jx.example.test/ui/index.html?token=$(echo "$url" | sed 's/.*token=//')" | grep -iE '^(HTTP/|set-cookie)' | sed -E 's/=[A-Za-z0-9._~-]{16,}/=<已隐去>/g'
} >"$d/curl-checks.txt" 2>&1

docker stop -t 5 jx-webproxy-nginx >/dev/null 2>&1 || true
sed -E 's/token=[A-Za-z0-9_-]+/token=<已隐去>/g' "$d/out/nginx-access.log" >"$d/out/nginx-access.redacted.log" 2>/dev/null || true
rm -f "$d/out/nginx-access.log"
echo "proxy-test: 结果在 $d" >&2
cat "$d/curl-checks.txt"
cat "$d/browser/proxy-drive.json" 2>/dev/null || cat "$d/browser/drive.out"
