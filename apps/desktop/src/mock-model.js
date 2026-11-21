'use strict';

/**
 * 本机试用构建自带的假模型。
 *
 * DSH 启动前，用跑 DSH 的同一个可执行文件（默认是 Electron 自己，以 Node 模式）起
 * tools/mock-model/server.mjs，挑一个本机空闲端口，等它的健康检查通过，再把地址和假密钥
 * 交给 DSH；退出时一起停掉。壳要是被强制结束，假模型读到标准输入关闭就自己退出，不留孤儿进程。
 *
 * 只给试用和测试：假模型按关键词回固定的话，不是真的模型。发行配置里模型路由的地址取
 * JX_MODEL_BASE_URL（distribution/patches/10-model-route.yml），这里只在没人给这个变量时替它填上。
 * 这个文件不依赖 Electron。
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

/** 交给 DSH 的假密钥。假模型只记有没有密钥、多长，不校验。 */
const MOCK_API_KEY = 'jx-local-mock-key-not-a-secret';

/**
 * 要不要起自带的假模型：
 *   - 已经设了 JX_MODEL_BASE_URL（接了别的模型网关）时一律不起，不去盖掉；
 *   - 开关 JX_DESKTOP_MOCK_MODEL 给了 1 就起，给了 0 就不起；
 *   - 没给开关时，看打包时写进包里的 mockModel。
 * @param {object} input
 * @param {string | undefined} input.option 开关的值
 * @param {unknown} input.baked 打包时写入的 mockModel
 * @param {string | undefined} input.modelBaseUrl 要交给 DSH 的 JX_MODEL_BASE_URL
 * @returns {{ enabled: boolean, reason: string }}
 * @throws {Error} 开关的值不是 0 或 1 时
 */
function decideMockModel({ option, baked, modelBaseUrl }) {
  if (option !== undefined && option !== '' && option !== '0' && option !== '1') {
    throw new Error(`JX_DESKTOP_MOCK_MODEL 只能是 0 或 1，现在是 ${JSON.stringify(option)}`);
  }
  if (modelBaseUrl !== undefined && modelBaseUrl.trim() !== '') return { enabled: false, reason: '已经设了 JX_MODEL_BASE_URL' };
  if (option === '1') return { enabled: true, reason: '开关打开' };
  if (option === '0') return { enabled: false, reason: '开关关闭' };
  // 打包时从命令行写入的值，electron-builder 可能存成布尔，也可能存成字符串。
  if (baked === true || baked === 'true') return { enabled: true, reason: '打包时写入' };
  return { enabled: false, reason: '没有打开' };
}

/**
 * 假模型脚本在哪：打好的包里在 Resources/mock-model/，开发时在仓库的 tools/mock-model/。
 * @param {object} input
 * @param {boolean} input.isPackaged
 * @param {string} input.resourcesPath
 * @param {string} input.appDir 开发时是 apps/desktop
 * @returns {string}
 */
function locateMockModel({ isPackaged, resourcesPath, appDir }) {
  return isPackaged
    ? path.join(resourcesPath, 'mock-model', 'server.mjs')
    : path.join(appDir, '..', '..', 'tools', 'mock-model', 'server.mjs');
}

/**
 * 问系统要一个本机的空闲端口。
 * @param {string} host
 * @returns {Promise<number>}
 */
function freePort(host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * GET /healthz，回 200 且 ok 为 true 才算起来了。
 * @param {string} host
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function healthy(host, port) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: '/healthz', timeout: 1000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 && JSON.parse(body).ok === true);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

/**
 * 起假模型，等到它能用。输出和请求日志都写到状态目录的 logs/ 里，不往应用包里写。
 * @param {object} input
 * @param {string} input.nodeBinary 跑脚本的可执行文件：Electron 自己，或者一个外部的 node
 * @param {boolean} input.electronAsNode nodeBinary 是不是 Electron（是的话要设 ELECTRON_RUN_AS_NODE）
 * @param {string} input.script server.mjs 的绝对路径
 * @param {string} input.logsDir 状态目录里的 logs/
 * @param {string} [input.host]
 * @param {number} [input.readyTimeoutMs]
 * @returns {Promise<{ baseURL: string, apiKey: string, port: number, pid: number | undefined, stop: () => Promise<void> }>}
 */
async function startMockModel({ nodeBinary, electronAsNode, script, logsDir, host = '127.0.0.1', readyTimeoutMs = 10000 }) {
  if (!fs.existsSync(script)) throw new Error(`找不到自带的假模型：${script}`);
  fs.mkdirSync(logsDir, { recursive: true });
  const port = await freePort(host);
  const outputFile = path.join(logsDir, 'mock-model.log');
  const out = fs.openSync(outputFile, 'a');
  // 只给它要的几样，不把壳的整个环境交出去。
  /** @type {Record<string, string>} */
  const env = {
    MOCK_MODEL_HOST: host,
    MOCK_MODEL_PORT: String(port),
    MOCK_MODEL_LOG: path.join(logsDir, 'mock-model-requests.jsonl'),
    MOCK_MODEL_EXIT_WITH_PARENT: '1',
  };
  if (electronAsNode) env.ELECTRON_RUN_AS_NODE = '1';
  if (process.env.TMPDIR !== undefined) env.TMPDIR = process.env.TMPDIR;
  let child;
  try {
    // 标准输入接一根管子、一直不关：壳没了，管子随之关闭，假模型读到结尾就退出。
    child = spawn(nodeBinary, [script], { cwd: logsDir, env, stdio: ['pipe', out, out] });
  } finally {
    fs.closeSync(out);
  }
  let exited = false;
  child.once('exit', () => { exited = true; });
  child.stdin?.on('error', () => {});

  const stop = () => new Promise((/** @type {(value?: void) => void} */ resolve) => {
    if (exited) {
      resolve();
      return;
    }
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });

  const deadline = Date.now() + readyTimeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`自带的假模型一启动就退出了，输出在 ${outputFile}`);
    if (await healthy(host, port)) {
      return { baseURL: `http://${host}:${String(port)}/v1`, apiKey: MOCK_API_KEY, port, pid: child.pid, stop };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stop();
  throw new Error(`自带的假模型 ${String(readyTimeoutMs)} 毫秒内没有就绪，输出在 ${outputFile}`);
}

module.exports = { MOCK_API_KEY, decideMockModel, locateMockModel, startMockModel };
