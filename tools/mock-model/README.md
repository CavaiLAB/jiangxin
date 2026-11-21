# 本机假模型

本机试用和测试用的假模型服务，单个文件 `server.mjs`，只用 Node 自带模块，不需要 `npm install`，也不需要任何密钥。

```bash
node tools/mock-model/server.mjs
```

默认监听 `127.0.0.1:3190`。`curl http://127.0.0.1:3190/healthz` 返回 `{"ok":true,"service":"jiangxin-mock-model"}` 就是起来了。Web 端的 `apps/web/dev.sh` 会自动起它。

## 接口

| 路径 | 协议 | 谁在用 |
|---|---|---|
| `POST /v1/chat/completions`（也接受 `/chat/completions`） | OpenAI Chat Completions，流式（SSE，含 `tool_calls` 增量和 `stream_options.include_usage`）和非流式 | 发行配置里的 `llm-pi-ai` 路由（补丁 10） |
| `POST /v1/messages`、`/anthropic/v1/messages` | Anthropic Messages，流式和非流式 | 外联检查「关之前」那一遍冒充上游官方的模型接口 |
| `GET /v1/models`（也接受 `/models`） | OpenAI 模型列表 | 列出 `jx-mock-1`、`deepseek-flash`、`deepseek-v4-pro` |
| `GET /healthz` | — | 健康检查 |

不校验密钥：请求带什么都接受，日志里只记有没有、多长。

## 怎么回

- 用户最新说的话里（上一条模型回复之后的所有用户消息；DSH 会在用户的问题后面再追加一条运行时上下文）带「读文件」「读取文件」「read file」或「MOCK_TOOL」：回一次工具调用。优先用 DSH 的 `read` 工具读关键词后面写的文件名（没写就读 `jiangxin-demo.txt`）；请求里没有 `read` 工具时退到 `bash` 执行 `cat`。
- 上一条消息是工具结果：回一段文字，引用工具结果的开头（去掉行号和标签，最多 120 字）。
- DSH 生成会话标题的辅助请求（没有工具、系统提示里有 title、消息不超过 3 条）：回「假模型测试会话」。
- 其余：回一段固定文字，提示怎么触发工具调用。

注意关键词要连着写：「请读文件 jiangxin-demo.txt」会触发，「请再读一次文件」不会。

## 环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `MOCK_MODEL_HOST` | `127.0.0.1` | 监听地址（容器里用 `0.0.0.0`） |
| `MOCK_MODEL_PORT` | `3190` | 监听端口 |
| `MOCK_MODEL_LOG` | `tools/mock-model/.dev/requests.jsonl` | 请求日志，每个请求一行：方法、路径、请求头（密钥类已隐去）、模型、工具名、请求体里多出来的字段、怎么回的 |
| `MOCK_MODEL_DEFAULT_FILE` | `jiangxin-demo.txt` | 关键词后面没写文件名时读哪个文件 |
| `MOCK_MODEL_CHUNK_DELAY_MS` | `15` | 流式回复每块之间停多久 |
| `MOCK_MODEL_EXIT_WITH_PARENT` | 不设 | 设成 `1`：标准输入读到结尾就退出。被别的进程带起来时用（桌面壳自带假模型时就这样起），父进程没了它跟着退 |

外联检查用请求日志判断模型请求里有没有夹带别的东西（`extraBodyKeys`，以及请求头里的匿名用户标识）。
