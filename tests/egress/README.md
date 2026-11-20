# 外联检查

检查 Web 端实例在一组固定操作里想连哪些地址：先用 DSH 默认配置跑一遍（关之前），再用我们的发行补丁跑一遍（关之后），对比两边的列表。证据来自网络层：在实例容器的网络命名空间里抓包，再加上一个兜住所有外部请求的接收器的日志。跑完该看到什么，见下面「期望」。

## 怎么跑

前提：Docker（本机是 Docker Desktop）。宿主机上不需要 sudo，也不改宿主机的网络设置。

```bash
tests/egress/build-images.sh
```

```bash
tests/egress/run.sh
```

- `build-images.sh` 只需要跑一次，这一步要联网（apt 装 tcpdump，`npm ci` 按 `distribution/package-lock.json` 装 DSH 的 Linux 依赖，装 `playwright-core`）。镜像：`jx-egress/base:1`、`jx-egress/dsh:0.2.2-rc.5`、`jx-egress/browser:1.64.0`。改了 `distribution/package.json`、锁文件或 `distribution/vendor/` 之后要重建（镜像里装着发行目录的全部依赖，包括品牌包和样板插件）。
- `run.sh` 默认两遍都跑，`run.sh before` 或 `run.sh after` 只跑一遍。两遍大约 3～4 分钟。环境变量：`IDLE_SECONDS`（操作完静置多久，默认 20 秒）、`KEEP_NETWORK=1`（结束后保留 Docker 网络）。
- 跑完会删掉自己起的容器和网络。所有容器带标签 `jx.owner=jiangxin-web-egress`，名字以 `jx-egress-` 开头。
- 发行目录的 `bin/` 和 `patches/` 是挂载进容器的，改补丁不用重建镜像。

结果在 `tests/egress/.dev/runs/<时间>/`：

| 文件 | 内容 |
|---|---|
| `summary.md` / `summary.json` | 自动生成的摘要：每一遍的 DNS 查询、TCP 连接、接收器收到的请求，以及两遍的对比 |
| `<遍>/out/dsh.pcap`、`dsh.pcap.txt` | DSH 容器的完整抓包（不含浏览器访问 3180 端口的流量）及其文本 |
| `<遍>/out/browser.pcap`、`browser.pcap.txt` | 浏览器容器的抓包 |
| `<遍>/out/sink-events.jsonl` | 接收器日志：DNS 查询、TLS 握手（SNI）、HTTP 请求（方法、路径、请求头，密钥类的头已隐去） |
| `<遍>/out/bodies/` | 接收器收到的请求体（已解压） |
| `<遍>/out/model-requests.jsonl` | 假模型收到的请求 |
| `<遍>/out/dsh.log` | DSH 的输出 |
| `<遍>/browser/drive.jsonl`、`*.png` | 每一步的结果、截图、页面向 DSH 以外地址发出的请求 |
| `<遍>/state/` | 这一遍 DSH 的状态目录（每遍都从空目录开始） |

`.dev/` 下的东西都可以删。抓包和请求体里有测试对话的内容和假密钥（`sk-jx-egress-fake-key-not-a-secret`），没有真实数据。

## 怎么做的

网络 `jx-egress-net`（`10.250.73.0/24`）用 `docker network create --internal` 建，没有通往宿主机和外网的路由，所以「关之前」那一遍即使 DSH 想上传，数据也出不去。

| 地址 | 容器 | 作用 |
|---|---|---|
| `10.250.73.2` | `jx-egress-sink` | 假 DNS + 万能接收器（`sink/sink.mjs`）。所有 A 记录都答成自己（AAAA、HTTPS 记录答空），只有白名单里的 `model-gateway.jx.test` 答成假模型的地址。在 80、443 端口上接住任何 HTTP(S) 请求，记下主机名、路径、请求头和请求体。HTTPS 按 SNI 现签证书，签发证书的根由 DSH 用 `NODE_EXTRA_CA_CERTS` 信任，所以能看到明文 |
| `10.250.73.3` | `jx-egress-model` | 假模型（`tools/mock-model/server.mjs`），同时会 OpenAI 和 Anthropic 两种协议 |
| `10.250.73.10` | `jx-egress-dsh` | 被测的 DSH。旁边的 `jx-egress-dsh-cap` 用 `--network container:jx-egress-dsh` 共享它的网络命名空间跑 tcpdump（`-i any`），实例里任何进程发出的包都抓得到 |
| `10.250.73.20` | `jx-egress-browser` | 无头 Chromium（Playwright），按 `browser/drive.mjs` 操作界面；旁边的 `jx-egress-browser-cap` 抓浏览器的包 |

容器的 `/etc/resolv.conf` 指向接收器。抓包只排除了浏览器访问 DSH 3180 端口的流量，其余一律记下，包括不经 DNS、直接连写死 IP 的连接（在抓包里是一个发往非接收器地址的 SYN）、非 DNS 的 UDP（例如 QUIC）。

两遍的区别只在怎么启动 DSH：

| | 关之前 | 关之后 |
|---|---|---|
| 启动 | `dsh --profile web`，DSH 默认配置 | `distribution/bin/jx-dsh --profile web`，叠上 `distribution/patches/*.yml` |
| 模型 | 上游官方的模型路由，给一个假密钥 `DEEPSEEK_API_KEY`；接收器把 `api.deepseek.com/anthropic/*` 转给假模型，好让对话能完成 | 补丁指向 `http://model-gateway.jx.test:3190/v1` |
| 状态目录 | 空目录 | 空目录 |

两遍做同样的操作（`browser/drive.mjs`）：

1. 用带令牌的地址打开界面，关掉「预览版说明」。
2. 发「请读文件 jiangxin-demo.txt，然后告诉我里面写了什么」，等模型调 `read` 工具、再根据工具结果回复。
3. 给回答点「好的回答」，在「提交反馈」里写一句话并提交。DSH 默认的会话遥测是 `FEEDBACK_ONLY`，由这个动作触发上传。
4. 打开设置，依次切到「通用设置」「模型」「内置插件」「Agent 预设」。
5. 打开插件页，点「更多」，再点一个还没装的官方插件看详情（脚本里点的是 DSH 0.2.2-rc.5 插件页上的一个子智能体插件，换 DSH 版本时可能要改）。
6. 静置 20 秒，留给后台的定时请求。

`analyze.mjs` 把抓包文本、接收器日志、假模型日志和操作日志合成摘要。「外部域名」不含 `model-gateway.jx.test`（我们指定的模型地址），也不含反向解析用的 `in-addr.arpa` 名字（单独列在 DNS 表里）。

## 期望

「关之后」那一遍，`summary.md` 里应该是这样：

| 看什么 | 期望 |
|---|---|
| 模型请求 | 只发往 `model-gateway.jx.test:3190`。一轮带工具调用的对话是 3 个请求：工具调用、会话标题、工具结果之后的回复 |
| 模型请求里多带的东西 | 请求头里没有 `x-deepseek-harness-user-id`、`x-deepseek-harness-session-id`；请求体里没有 `dsh_session_log`、`dsh_plugin_packages` 这类多出来的字段（假模型日志的 `extraBodyKeys` 为空） |
| 别的外部域名 | 只有 `cdn.jsdelivr.net`，出现在第 5 步点开插件详情时，读的是插件的说明文档，请求里只有包名和版本。这一处配置关不掉，原因见 [distribution/README.md](../../distribution/README.md) 的「每个补丁」补丁 60 |
| DNS 反查（`in-addr.arpa`） | 没有 |
| 浏览器容器 | 不连 DSH 以外的任何地址 |

「关之前」那一遍是对照，DSH 默认配置在这组操作里会连：上游的模型接口（拉模型列表；模型请求里还夹带会话日志、已装插件清单和匿名用户标识）、上游的遥测收集端（提交反馈后上传整段会话日志）、两个公共 npm 源（插件页的源测速）、`cdn.jsdelivr.net`（插件详情），以及对已连接对端的 DNS 反查。每一项是哪个补丁或启动器的哪一步关掉的，见 `distribution/README.md` 的「每个补丁」和「外联」。

## 能证明什么，不能证明什么

能证明：在上面这组操作和静置时间里，实例（DSH 进程和它起的所有子进程）以及浏览器想连哪些地址、发了什么。

不能证明：

- 没做过的操作不在里面。特别是：模型让智能体执行命令（`bash` 里 `curl`、`git clone`、`npm install`）、接 MCP 服务器、装插件。这些本来就会联网，要靠实例外面的网络出站策略兜底，见 [distribution/README.md](../../distribution/README.md) 的「外联」。
- 只看了 20 秒的静置时间。补丁关掉的定时请求（模型列表刷新、插件源测速）在源码里都核过触发方式，但更长周期的定时任务没有实测。
- 网络只有 IPv4。DSH 想走 IPv6 的话，在这里表现为 AAAA 查询（会被记下），实际连接测不到。
- 被测的是 Linux 容器里的 Web 端。客户端（桌面壳）没有做过同样的网络层检查：薄壳本身不做自动更新、不发产品分析，窗口发往本机 DSH 以外的请求记在它自己的日志里（见 [apps/desktop/README.md](../../apps/desktop/README.md)）。

## 清理

镜像会留着，下次跑不用重建。不要了就删：

```bash
docker rmi jx-egress/browser:1.64.0 jx-egress/dsh:0.2.2-rc.5 jx-egress/base:1
```

万一中途被打断、有容器或网络残留：

```bash
docker rm -f $(docker ps -aq --filter label=jx.owner=jiangxin-web-egress)
```

```bash
docker network rm jx-egress-net
```
