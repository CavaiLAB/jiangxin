# 匠心工业智能体平台 · Web 端

用发行目录（[`distribution/`](../../distribution/README.md)）里钉死版本的 DSH（`@deepseek-ai/dsh@0.2.2-rc.5`）跑 Web 端。DSH 本身一行不改，我们的东西只有发行目录里的插件包、配置补丁和启动器，以及这里的启动脚本。

发行目录里装着品牌包和插件样板，所以界面是「匠心工业智能体平台」的名称、标志和主题色，侧栏多一个「设备台账」（样板，数据是假的）。桌面客户端用的也是同一个发行目录。

| 文件 | 作用 |
|---|---|
| `start.sh` | 启动 Web 端 |
| `dev.sh` | 本机试用：先起假模型，再起 Web 端 |
| `proxy-test/` | 放在反向代理后面的验证：nginx 配置模板、容器里的实际转发、浏览器脚本 |

## 1 在本机起来

前提：Node ≥ 24.9。只是起 Web 端不需要 pnpm，也不需要 Docker（外联检查和反向代理验证才需要 Docker）。在仓库根目录：

```bash
cd distribution && npm ci --ignore-scripts
```

```bash
apps/web/dev.sh
```

`dev.sh` 先起假模型（`127.0.0.1:3190`），再起 Web 端（`127.0.0.1:3180`），`Ctrl+C` 一起停。也可以分两个终端：`node tools/mock-model/server.mjs` 和 `apps/web/start.sh`。

然后：

1. 打开终端里打印的 `http://127.0.0.1:3180/?token=…`。令牌是这一个进程的访问凭据，不要外传；进程重启就换新的。打开以后，地址里的令牌会被换成会话 cookie，之后用不带令牌的地址。
2. 第一次打开会弹「预览版说明」，点「继续」。
3. 输入「请读文件 jiangxin-demo.txt」。假模型会回一次工具调用，DSH 用 `read` 工具读默认工作区里的演示文件，假模型再根据工具结果回一段文字（「工具调用已完成……读到的内容开头是……」）。普通问题会收到一段固定回复。

本机状态都在仓库目录里：

| 东西 | 位置 |
|---|---|
| DSH 状态目录（`DSH_HOME`） | `distribution/.dev/home` |
| 共享智能体目录（`DSH_AGENTS_HOME`） | `distribution/.dev/agents-home` |
| 默认工作区 | `distribution/.dev/home/documents/deepseek-harness/default-workspace` |
| DSH 进程的工作目录 | `distribution/.dev/workspace` |
| 假模型的请求日志 | `tools/mock-model/.dev/requests.jsonl` |

重来一遍：停掉服务，删掉 `distribution/.dev/home`。

## 2 启动脚本做了什么

`start.sh` 只做三件事：进工作目录、给假模型一个假密钥、调用发行目录的启动器：

```text
distribution/bin/jx-dsh --profile web --host 127.0.0.1 --port 3180 --no-open [你给的其余参数]
```

启动器管状态目录、补丁、外联相关的环境变量、产品版本号和启动前检查，见 [distribution/README.md](../../distribution/README.md)。这里常用的环境变量：

| 变量 | 默认 | 作用 |
|---|---|---|
| `JX_WEB_HOST`、`JX_WEB_PORT` | `127.0.0.1`、`3180` | 监听地址与端口（`start.sh`） |
| `JX_WORKSPACE` | `distribution/.dev/workspace` | DSH 进程的工作目录（`start.sh`） |
| `JX_MODEL_BASE_URL` | `http://127.0.0.1:3190/v1` | 模型网关地址 |
| `JX_MODEL_API_KEY` | 一个假值 | 模型网关密钥（`start.sh` 给假模型用） |
| `JX_PRODUCT_VERSION`、`JX_PRODUCT_COMMIT` | 不设，显示「本地开发」 | 产品版本号与提交 |
| `JX_DISTRIBUTION_DIR` | 仓库的 `distribution/` | 换一个发行目录 |
| `DSH_HOME`、`DSH_AGENTS_HOME` | `distribution/.dev/…` | 状态目录 |

带版本号启动：

```bash
JX_PRODUCT_VERSION=v2026.11.20 JX_PRODUCT_COMMIT=abc1234 apps/web/start.sh
```

## 3 放在反向代理后面

```bash
apps/web/start.sh --host <实例自己的 IP> --public-url https://jx.example.com/ui/ --trusted-host jx.example.com
```

| 参数 | 作用 | 注意 |
|---|---|---|
| `--host` | 监听地址 | 必须是本机一个具体的 IP，`0.0.0.0` 会被拒绝；非回环又是明文 HTTP 时，启动会打印警告 |
| `--public-url` | 打印和打开的地址、`DSH_WEB_URL`、给智能体的运行时上下文里的地址 | 只是告诉别人从哪里进，不授予任何信任 |
| `--trusted-host` | 请求的 `Host` 额外接受的名字（可重复；不带端口时匹配任意端口） | 不加的话，经代理过来的 API 请求都是 `403` |
| `--tls-cert`、`--tls-key` | 监听端自己上 HTTPS | 也可以在代理上终止 TLS |

代理必须做到这几条（对应 DSH 文档 `docs/user/guide/public-deployments.md`）：

1. 原样保留浏览器看到的 `Host`，不要改成上游地址。
2. 去掉挂载前缀：`/ui/api/...` 到 DSH 时要变成 `/api/...`。
3. 转发 WebSocket 升级（`/api/remote.mux`）。
4. 把 cookie 的 `Path=/` 改成挂载点，并在 HTTPS 这一段加上 `Secure`（DSH 监听明文 HTTP 时不会自己加）。
5. 把 `/ui` 重定向到 `/ui/`：只有挂载点本身能用令牌换 cookie。

nginx 的写法见 [`proxy-test/nginx.conf.template`](proxy-test/nginx.conf.template)。

### 实际转发验证

```bash
apps/web/proxy-test/run.sh
```

要 Docker，复用外联检查的镜像（先跑一次 `tests/egress/build-images.sh`）。在一个不通外网的 Docker 网络里起假 DNS、假模型、DSH（我们的发行配置，`--public-url https://jx.example.test/ui/ --trusted-host jx.example.test`）、nginx（HTTPS，自签证书）和无头浏览器，结果写在 `apps/web/proxy-test/.dev/<时间>/`。它检查：

| 检查 | 期望 |
|---|---|
| DSH 打印的地址 | 公开地址带令牌：`https://jx.example.test/ui/?token=…` |
| 浏览器打开这个地址 | 换到 cookie，落在不带令牌的 `https://jx.example.test/ui/` |
| cookie 属性 | `Path=/ui/`，带 `Secure`、`HttpOnly`、`SameSite=Strict` |
| WebSocket | 经代理建立：`wss://jx.example.test/ui/api/remote.mux` |
| 界面的 API 请求 | 全部 `200` |
| 一轮带工具调用的对话 | 假模型根据 `read` 工具读到的演示文件作答 |
| `GET /ui` | `301` 到 `/ui/` |
| 经代理、`Host` 可信、没带 cookie 的 API 请求 | `401` |
| 经代理、`Host` 改成不在 `--trusted-host` 里的名字 | `403` |
| 不经代理直接访问 DSH 的端口、没带 cookie | `401` |
| 带令牌访问 `/ui/index.html` | `401`，不发 cookie |

## 4 门户（提议，没有实现）

2026-11-25 补：这一节的方向定了几条（[2026-11-25 平台级裁定](../../docs/decisions/2026-11-25-platform.md) P62 至 P64），都还没有实现。

- Web 端分成管理系统与按需托管的 Agent 工作区两块，放在两个域名上。
- 托管的 DSH 实例每个正在用 Agent 的人一个，按需启动、空闲回收、有上限。
- 下面说的「门户的认证网关」就是匠心的工作区服务。它直接接工作区的域名，不经过 Kun 的网关，用 Kun 发布的登录组件认人。

下面关于令牌怎么换成 cookie、每个用户一个主机名的写法仍是提议。

DSH 的一个实例里没有多用户，所以提议每个用户一个实例，登录、租户、授权放在实例外面的门户里（见 [2026-11-20 产品裁定](../../docs/decisions/2026-11-20-product.md)第 3 节，没有确认）。门户怎么把登录过的用户送进他自己的实例，提议是：门户的认证网关负责用户登录；网关在服务端用实例的启动令牌换实例的会话 cookie，存在网关自己的会话里，之后转发给实例的每个请求（含 WebSocket 升级）都由网关带上；浏览器拿不到实例的令牌和 cookie。每个用户最好有自己的主机名。

DSH 0.2.2-rc.5 里没有能单独替换的认证接缝（主干上有），所以第一版只能这样从外面接，不改 DSH。
