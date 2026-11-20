'use strict';

/**
 * 产品版本号的规则测试（规则见 apps/desktop/README.md「版本号」）。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DESKTOP_VERSION_PATTERN,
  TAG_PATTERN,
  LOCAL_DEV_LABEL,
  isProductVersion,
  parseProductVersion,
  displayVersion,
  describeVersion,
  isBeta,
  compareProductVersions,
} = require('../src/version');

const root = path.resolve(__dirname, '..');

test('桌面端的校验式：接受三种形式，月日不补零，校验月日范围', () => {
  for (const valid of ['2026.7.29', '2026.7.29-1', '2026.7.29-beta.1', '2026.11.20', '2026.11.20-beta.1', '2026.12.31-12', '2026.1.1-beta.10']) {
    assert.match(valid, DESKTOP_VERSION_PATTERN);
    assert.equal(isProductVersion(valid), true, valid);
  }
  for (const invalid of [
    '2026.07.29', // 月补了零
    '2026.7.09', // 日补了零
    '2026.13.1', // 没有 13 月
    '2026.1.32', // 没有 32 日
    '2026.0.1',
    '2026.1.0',
    'v2026.11.20', // 桌面端的形式不带 v
    '2026.11.20-0', // 补丁号从 1 起
    '2026.11.20-01',
    '2026.11.20-beta.0',
    '2026.11.20-beta',
    '2026.11.20-rc.1', // 没有 rc 这种后缀
    '2026.11.20-beta.1-1',
    '2026.11',
    '26.11.20',
    '0.0.0', // 包自己的内部版本号
    '0.2.2-rc.5', // DSH 的版本号是另一回事
    '',
  ]) {
    assert.doesNotMatch(invalid, DESKTOP_VERSION_PATTERN);
    assert.equal(isProductVersion(invalid), false, invalid);
  }
  assert.equal(isProductVersion(undefined), false);
  assert.equal(isProductVersion(20261120), false);
});

test('标签的校验式：带 v', () => {
  for (const valid of ['v2026.11.20', 'v2026.11.20-1', 'v2026.11.20-beta.1', 'v2026.5.12']) assert.match(valid, TAG_PATTERN);
  for (const invalid of ['2026.11.20', 'v2026.11.20-beta.0', 'v2026.11.20-rc.1', 'V2026.11.20']) assert.doesNotMatch(invalid, TAG_PATTERN);
});

test('拆分：正式版、补丁版、测试版', () => {
  assert.deepEqual(parseProductVersion('2026.11.20'), { year: 2026, month: 11, day: 20, kind: 'release', n: 0 });
  assert.deepEqual(parseProductVersion('2026.11.20-3'), { year: 2026, month: 11, day: 20, kind: 'patch', n: 3 });
  assert.deepEqual(parseProductVersion('2026.11.20-beta.1'), { year: 2026, month: 11, day: 20, kind: 'beta', n: 1 });
  assert.equal(parseProductVersion('0.0.0'), null);
});

test('显示：注入了合规版本号就原样显示，否则显示「本地开发」', () => {
  assert.equal(displayVersion('2026.11.20-beta.1'), '2026.11.20-beta.1');
  assert.equal(displayVersion('2026.11.20'), '2026.11.20');
  // 没注入时 app.getVersion() 返回 package.json 的内部版本号，不能拿它顶替。
  assert.equal(displayVersion('0.0.0'), LOCAL_DEV_LABEL);
  assert.equal(displayVersion('44.11.5'), LOCAL_DEV_LABEL);
  assert.equal(displayVersion(undefined), LOCAL_DEV_LABEL);
  assert.equal(LOCAL_DEV_LABEL, '本地开发');
});

test('带 -beta. 的是测试版', () => {
  assert.equal(isBeta('2026.11.20-beta.1'), true);
  assert.equal(isBeta('2026.11.20'), false);
  assert.equal(isBeta('2026.11.20-1'), false);
  assert.equal(isBeta('0.0.0'), false);
  assert.deepEqual(describeVersion('2026.11.20-beta.1'), { injected: true, label: '2026.11.20-beta.1', channel: '测试版' });
  assert.deepEqual(describeVersion('2026.11.20-2'), { injected: true, label: '2026.11.20-2', channel: '补丁版' });
  assert.deepEqual(describeVersion('2026.11.20'), { injected: true, label: '2026.11.20', channel: '正式版' });
  assert.deepEqual(describeVersion('0.0.0'), { injected: false, label: '本地开发', channel: '本地开发' });
});

test('比较新旧：按规则自己比，不能用语义化版本的比较', () => {
  const ordered = [
    '2026.11.19-2',
    '2026.11.20-beta.1',
    '2026.11.20-beta.2',
    '2026.11.20-beta.10',
    '2026.11.20',
    '2026.11.20-1', // 语义化版本会把它排在 2026.11.20 前面；规则里它是之后的补丁版
    '2026.11.20-2',
    '2026.11.20-10',
    '2026.11.21-beta.1',
    '2026.12.1',
    '2027.1.1',
  ];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = 0; j < ordered.length; j++) {
      assert.equal(compareProductVersions(ordered[i], ordered[j]), Math.sign(i - j), `${ordered[i]} 对 ${ordered[j]}`);
    }
  }
  assert.throws(() => compareProductVersions('2026.11.20', '0.2.2-rc.5'), TypeError);
});

test('包自己的内部版本号永远不会被当成产品版本', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(isProductVersion(manifest.version), false, 'package.json 里不写产品版本号，产品版本号在打包时注入');
});

test('界面上的版本取自 app.getVersion()，打包时用 extraMetadata 注入', () => {
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8');
  const pack = fs.readFileSync(path.join(root, 'scripts', 'pack-mac.sh'), 'utf8');

  assert.match(main, /describeVersion\(app\.getVersion\(\)\)/, '关于窗口的版本必须来自 app.getVersion()');
  assert.match(main, /`--jx-app-version=\$\{app\.getVersion\(\)\}`/, '交给预加载脚本的版本必须来自 app.getVersion()');
  assert.match(preload, /appVersion:\s*readArg\('--jx-app-version='\)/, '预加载脚本要把客户端版本暴露出去');
  assert.doesNotMatch(preload, /appVersion:\s*process\.versions\.electron/, 'Electron 自己的版本号不能冒充客户端版本');
  assert.match(pack, /--config\.extraMetadata\.version="\$VERSION"/, '打包时必须用 extraMetadata 注入版本号');
  assert.match(pack, /--publish never/, '本机构建不发布');
});
