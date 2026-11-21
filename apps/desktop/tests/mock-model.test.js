'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { MOCK_API_KEY, decideMockModel, locateMockModel, startMockModel } = require('../src/mock-model');

const APP_DIR = path.join(__dirname, '..');
const SCRIPT = locateMockModel({ isPackaged: false, resourcesPath: '', appDir: APP_DIR });

/** @param {number} pid */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM';
  }
}

/**
 * @param {() => boolean} predicate
 * @param {number} timeoutMs
 */
async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return predicate();
}

test('要不要起自带的假模型', () => {
  const decide = (/** @type {string | undefined} */ option, /** @type {unknown} */ baked, /** @type {string | undefined} */ modelBaseUrl) =>
    decideMockModel({ option, baked, modelBaseUrl }).enabled;
  assert.equal(decide(undefined, undefined, undefined), false, '默认不起');
  assert.equal(decide(undefined, true, undefined), true, '打包时写入就起');
  assert.equal(decide(undefined, 'true', undefined), true, '写入的值是字符串也认');
  assert.equal(decide('0', true, undefined), false, '开关关闭优先于打包时写入');
  assert.equal(decide('1', undefined, undefined), true, '开关打开就起');
  assert.equal(decide('1', true, 'https://gateway.example.test/v1'), false, '接了别的模型网关时一律不起');
  assert.equal(decide('', true, '  '), true, '空的开关和空的地址等于没给');
  assert.throws(() => decideMockModel({ option: 'yes', baked: undefined, modelBaseUrl: undefined }), /只能是 0 或 1/);
});

test('打好的包和开发时各从哪里找假模型', () => {
  assert.equal(
    locateMockModel({ isPackaged: true, resourcesPath: '/Applications/X.app/Contents/Resources', appDir: '/ignored' }),
    '/Applications/X.app/Contents/Resources/mock-model/server.mjs',
  );
  assert.equal(locateMockModel({ isPackaged: false, resourcesPath: '/ignored', appDir: '/repo/apps/desktop' }), '/repo/tools/mock-model/server.mjs');
  assert.ok(fs.existsSync(SCRIPT), `仓库里应当有假模型：${SCRIPT}`);
});

test('起一次仓库里的假模型：能回话，日志写在给的目录里，能停掉', { timeout: 20000 }, async () => {
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jx-mock-model-'));
  const mock = await startMockModel({ nodeBinary: process.execPath, electronAsNode: false, script: SCRIPT, logsDir });
  try {
    assert.match(mock.baseURL, /^http:\/\/127\.0\.0\.1:\d+\/v1$/);
    assert.equal(mock.apiKey, MOCK_API_KEY);
    const res = await fetch(`${mock.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${mock.apiKey}` },
      body: JSON.stringify({ model: 'jx-mock-1', messages: [{ role: 'user', content: '你好' }] }),
    });
    assert.equal(res.status, 200);
    const body = /** @type {{ choices?: unknown[] }} */ (await res.json());
    assert.ok(Array.isArray(body.choices) && body.choices.length > 0, '回了一条消息');
    assert.ok(fs.existsSync(path.join(logsDir, 'mock-model-requests.jsonl')), '请求日志在给的目录里');
  } finally {
    await mock.stop();
  }
  assert.equal(await waitFor(() => mock.pid === undefined || !alive(mock.pid), 3000), true, '停掉以后进程不在了');
  fs.rmSync(logsDir, { recursive: true, force: true });
});

test('带起它的进程被强制结束时，假模型跟着退出', { timeout: 20000 }, async () => {
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jx-mock-model-'));
  const parentCode = [
    `const { startMockModel } = require(${JSON.stringify(path.join(APP_DIR, 'src', 'mock-model.js'))});`,
    `startMockModel({ nodeBinary: process.execPath, electronAsNode: false, script: ${JSON.stringify(SCRIPT)}, logsDir: ${JSON.stringify(logsDir)} })`,
    "  .then((m) => { process.stdout.write(JSON.stringify({ pid: m.pid }) + '\\n'); setInterval(() => {}, 1000); });",
  ].join('\n');
  const parent = spawn(process.execPath, ['-e', parentCode], { stdio: ['ignore', 'pipe', 'inherit'] });
  const line = await new Promise((resolve, reject) => {
    let buffer = '';
    parent.stdout.setEncoding('utf8');
    parent.stdout.on('data', (chunk) => {
      buffer += chunk;
      if (buffer.includes('\n')) resolve(buffer.split('\n')[0]);
    });
    parent.once('exit', (code) => reject(new Error(`带起假模型的进程提前退出了：${String(code)}`)));
  });
  const { pid } = JSON.parse(/** @type {string} */ (line));
  assert.equal(alive(pid), true, '假模型起来了');
  parent.kill('SIGKILL');
  assert.equal(await waitFor(() => !alive(pid), 5000), true, '父进程没了，假模型也退出了');
  fs.rmSync(logsDir, { recursive: true, force: true });
});
