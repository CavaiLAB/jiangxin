'use strict';

/**
 * 隔离相关的测试：状态目录、发行目录、DSH 进程的环境变量与日志。
 * 都是纯逻辑，不启动 Electron，也不启动 DSH。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { mergeCookie } = require('../src/auth');
const { listPatches, locateDistribution, readDistribution } = require('../src/distribution');
const { READY_LINE, buildHostEnv, redact } = require('../src/host');
const { parsePort } = require('../src/launch');
const { renderShellOverlay } = require('../src/overlay');
const { assertIsolated, resolveStateRoot } = require('../src/state');

const HOME = '/home/tester';

test('状态目录：不能落在用户自己的 DSH 目录里，也不能是主目录', () => {
  for (const bad of [
    `${HOME}/.dsh`,
    `${HOME}/.dsh/profiles`,
    `${HOME}/.agents`,
    `${HOME}/Library/Application Support/@deepseek-ai/dsh-desktop`,
    `${HOME}/Documents/deepseek-harness/default-workspace`,
    HOME, // 主目录本身
    `${HOME}/Library/Application Support`, // 里面包着用户那份 DSH 的应用数据
    '/',
  ]) {
    assert.throws(() => assertIsolated(bad, '测试目录', HOME), Error, bad);
  }
  assert.throws(() => assertIsolated('relative/dir', '测试目录', HOME), /绝对路径/);
  assert.doesNotThrow(() => assertIsolated(`${HOME}/work/jiangxin/apps/desktop/.dev`, '测试目录', HOME));
  assert.doesNotThrow(() => assertIsolated(`${HOME}/.dsh-jiangxin`, '测试目录', HOME));
});

test('状态根目录：环境变量优先；开发时用 .dev；打包后没配置就拒绝，不退回系统默认位置', () => {
  const base = { envName: 'JX_DESKTOP_STATE_DIR', appDir: '/work/apps/desktop' };
  assert.deepEqual(
    resolveStateRoot({ ...base, env: { JX_DESKTOP_STATE_DIR: '/tmp/state' }, isPackaged: true, bakedStateRoot: '/baked' }),
    { root: '/tmp/state', source: 'env' },
  );
  assert.deepEqual(
    resolveStateRoot({ ...base, env: {}, isPackaged: false, bakedStateRoot: undefined }),
    { root: '/work/apps/desktop/.dev', source: 'dev' },
  );
  assert.deepEqual(
    resolveStateRoot({ ...base, env: {}, isPackaged: true, bakedStateRoot: '/baked' }),
    { root: '/baked', source: 'baked' },
  );
  assert.throws(() => resolveStateRoot({ ...base, env: {}, isPackaged: true, bakedStateRoot: undefined }), /没有配置本机状态目录/);
  assert.throws(() => resolveStateRoot({ ...base, env: { JX_DESKTOP_STATE_DIR: 'relative' }, isPackaged: false, bakedStateRoot: undefined }), /绝对路径/);
});

test('发行目录：环境变量 > 随包的 Resources/runtime > 开发时的 runtime', () => {
  const base = { envName: 'JX_DISTRIBUTION_DIR', resourcesPath: '/App.app/Contents/Resources', appDir: '/work/apps/desktop' };
  assert.deepEqual(locateDistribution({ ...base, env: { JX_DISTRIBUTION_DIR: '/other/dist' }, isPackaged: true }), { dir: '/other/dist', source: 'env' });
  assert.deepEqual(locateDistribution({ ...base, env: {}, isPackaged: true }), { dir: '/App.app/Contents/Resources/runtime', source: 'bundled' });
  assert.deepEqual(locateDistribution({ ...base, env: {}, isPackaged: false }), { dir: '/work/apps/desktop/runtime', source: 'dev' });
  assert.throws(() => locateDistribution({ ...base, env: { JX_DISTRIBUTION_DIR: 'relative' }, isPackaged: false }), /绝对路径/);
});

test('发行目录：补丁按文件名排序；DSH 必须是精确版本且和装出来的一致', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jx-dist-'));
  try {
    const write = (/** @type {string} */ file, /** @type {string} */ content) => {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
    };
    write('patches/20-b.yml', '[]');
    write('patches/10-a.yaml', '[]');
    write('patches/9-z.yml', '[]');
    write('patches/README.md', '不是补丁');
    write('patches/.hidden.yml', '[]');
    // 码点顺序：'1' < '2' < '9'，所以 10、20、9。
    assert.deepEqual(listPatches(dir).map((file) => path.basename(file)), ['10-a.yaml', '20-b.yml', '9-z.yml']);

    write('package.json', JSON.stringify({ name: 'dist', dependencies: { '@deepseek-ai/dsh': '^0.2.2' } }));
    assert.throws(() => readDistribution(dir), /精确版本/);

    write('package.json', JSON.stringify({ name: 'dist', dependencies: { '@deepseek-ai/dsh': '0.2.2-rc.5' } }));
    assert.throws(() => readDistribution(dir), /还没有安装依赖/);

    write('node_modules/@deepseek-ai/dsh/package.json', JSON.stringify({ version: '0.2.2-rc.4', bin: { dsh: 'lib/bin.js' } }));
    write('node_modules/@deepseek-ai/dsh/lib/bin.js', '');
    assert.throws(() => readDistribution(dir), /清单里钉的是 0\.2\.2-rc\.5/);

    write('node_modules/@deepseek-ai/dsh/package.json', JSON.stringify({ version: '0.2.2-rc.5', bin: { dsh: 'lib/bin.js' } }));
    const distribution = readDistribution(dir);
    assert.equal(distribution.dshVersion, '0.2.2-rc.5');
    assert.equal(distribution.binJs, path.join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
    assert.equal(distribution.patches.length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('发行目录钉死的是 DSH 0.2.2-rc.5；随包的 runtime/ 同步自它', () => {
  // runtime/ 由 scripts/install-runtime.sh 从仓库的 distribution/ 同步生成，不进 git；以 distribution/ 为准。
  const read = (/** @type {string[]} */ ...parts) => JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', ...parts), 'utf8'));
  const pinned = read('..', '..', 'distribution', 'package.json').dependencies['@deepseek-ai/dsh'];
  assert.equal(pinned, '0.2.2-rc.5');
  if (fs.existsSync(path.resolve(__dirname, '..', 'runtime', 'package.json'))) {
    assert.equal(read('runtime', 'package.json').dependencies['@deepseek-ai/dsh'], pinned, 'runtime/ 和 distribution/ 不一致：重跑 npm run runtime:install');
  }
});

test('DSH 进程的环境变量：只传白名单，密钥和代理不传，状态目录由壳写死', () => {
  const env = buildHostEnv({
    parentEnv: {
      HOME: '/home/tester',
      PATH: '/usr/bin:/bin',
      LANG: 'zh_CN.UTF-8',
      DEEPSEEK_API_KEY: 'sk-real',
      ANTHROPIC_BASE_URL: 'https://example.invalid',
      HTTPS_PROXY: 'http://proxy.invalid:8080',
      DSH_HOME: '/home/tester/.dsh',
      MOCK_MODEL_URL: 'http://127.0.0.1:3192',
    },
    passNames: ['MOCK_MODEL_URL'],
    fixed: { DSH_HOME: '/state/dsh-home', DSH_AGENTS_HOME: '/state/agents-home' },
  });
  assert.equal(env.DSH_HOME, '/state/dsh-home', '继承来的 DSH_HOME 必须被壳的值盖掉');
  assert.equal(env.DSH_AGENTS_HOME, '/state/agents-home');
  assert.equal(env.MOCK_MODEL_URL, 'http://127.0.0.1:3192', '显式点名的变量可以透传');
  for (const name of ['DEEPSEEK_API_KEY', 'ANTHROPIC_BASE_URL', 'HTTPS_PROXY']) assert.equal(name in env, false, name);
  assert.ok(env.PATH.split(':').includes('/opt/homebrew/bin'), '从访达启动时 PATH 很短，要补上常见目录');
  assert.ok(env.PATH.startsWith('/usr/bin:/bin'), '原有的顺序不变');
});

test('就绪行：只认带地址的那一行', () => {
  assert.equal(READY_LINE.exec('dsh web: http://127.0.0.1:3182/?token=abc')?.[1], 'http://127.0.0.1:3182/?token=abc');
  assert.equal(READY_LINE.exec('dsh web: opening the default browser; pass --no-open to disable'), null);
  assert.equal(READY_LINE.exec('  dsh web: http://127.0.0.1:3182/?token=abc'), null);
});

test('写日志前隐去凭据：地址里的令牌和认证 Cookie', () => {
  const line = 'dsh web: http://127.0.0.1:3182/?token=AbC-123_xyz and cookie dsh-auth-Zm9v=v1.eyJ2IjoxfQ.c2ln; Path=/';
  const safe = redact(line);
  assert.equal(safe.includes('AbC-123_xyz'), false);
  assert.equal(safe.includes('v1.eyJ2IjoxfQ.c2ln'), false);
  assert.match(safe, /\?token=<已隐去>/);
  assert.match(safe, /dsh-auth-Zm9v=<已隐去>/);
  assert.equal(redact('http://x/?a=1&token=secret&b=2'), 'http://x/?a=1&token=<已隐去>&b=2');
  assert.equal(redact('没有凭据的一行'), '没有凭据的一行');
});

test('Cookie 合并：保留页面原有的 Cookie，同名的换掉', () => {
  assert.equal(mergeCookie(undefined, 'dsh-auth-x=v1.a.b'), 'dsh-auth-x=v1.a.b');
  assert.equal(mergeCookie('theme=dark', 'dsh-auth-x=v1.a.b'), 'theme=dark; dsh-auth-x=v1.a.b');
  assert.equal(mergeCookie('dsh-auth-x=old; theme=dark', 'dsh-auth-x=v1.a.b'), 'theme=dark; dsh-auth-x=v1.a.b');
});

test('端口：默认 3182，只接受合法端口', () => {
  assert.equal(parsePort(undefined), 3182);
  assert.equal(parsePort(''), 3182);
  assert.equal(parsePort('3192'), 3192);
  for (const bad of ['80', '0', '70000', 'abc', '3182.5']) assert.throws(() => parsePort(bad), /JX_DESKTOP_PORT/, bad);
});

test('壳的补丁：把系统「文稿」目录换成自己管的目录', () => {
  const yaml = renderShellOverlay({ documentsDir: '/state dir/文稿' });
  assert.match(yaml, /^- id: workspace-controller$/m);
  assert.match(yaml, /^ {4}documentsDirectory: "\/state dir\/文稿"$/m);
  assert.throws(() => renderShellOverlay({ documentsDir: 'relative' }), /绝对路径/);
});

test('壳里没有注册协议、开机启动、自动更新的调用', () => {
  const dir = path.resolve(__dirname, '..', 'src');
  const sources = fs.readdirSync(dir).filter((name) => name.endsWith('.js')).map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  // 只查真正的调用，注释里说明「不做什么」时会提到这些词。
  const code = sources.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['setAsDefaultProtocolClient', 'setLoginItemSettings', 'autoUpdater', 'electron-updater', 'registerSchemesAsPrivileged']) {
    assert.equal(code.includes(forbidden), false, `不应该调用 ${forbidden}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal('electron-updater' in { ...manifest.dependencies, ...manifest.devDependencies }, false);
});
