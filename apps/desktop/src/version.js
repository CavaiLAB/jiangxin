'use strict';

/**
 * 产品版本号的规则（见 docs/14-governance.md 第 7 节；细节见 apps/desktop/README.md「版本号」）。
 *
 *   YYYY.M.D          正式版
 *   YYYY.M.D-N        当天正式版之后的补丁版
 *   YYYY.M.D-beta.N   测试版
 *
 * 这个文件不依赖 Electron，方便直接用 node --test 测。
 */

/** 桌面端的校验式：不带 v，并校验月日范围。 */
const DESKTOP_VERSION_PATTERN =
  /^[0-9]{4}\.([1-9]|1[0-2])\.([1-9]|[12][0-9]|3[01])(-([1-9][0-9]*|beta\.[1-9][0-9]*))?$/;

/** 标签的校验式：带 v，不校验月日范围。 */
const TAG_PATTERN = /^v[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}(-([1-9][0-9]*|beta\.[1-9][0-9]*))?$/;

/** 没注入版本号的本机构建显示这个，不拿 package.json 的版本号顶替。 */
const LOCAL_DEV_LABEL = '本地开发';

/**
 * 是不是一个合规的产品版本号（桌面端形式，不带 v）。
 * @param {unknown} value
 * @returns {boolean}
 */
function isProductVersion(value) {
  return typeof value === 'string' && DESKTOP_VERSION_PATTERN.test(value);
}

/**
 * 拆开一个产品版本号。
 * @param {unknown} value
 * @returns {{ year: number, month: number, day: number, kind: 'release' | 'patch' | 'beta', n: number } | null}
 */
function parseProductVersion(value) {
  if (!isProductVersion(value)) return null;
  const [date, suffix] = /** @type {string} */ (value).split(/-(.*)/s);
  const [year, month, day] = date.split('.').map(Number);
  if (suffix === undefined) return { year, month, day, kind: 'release', n: 0 };
  if (suffix.startsWith('beta.')) return { year, month, day, kind: 'beta', n: Number(suffix.slice(5)) };
  return { year, month, day, kind: 'patch', n: Number(suffix) };
}

/**
 * 界面上显示的版本号：取 app.getVersion()，只有它是合规的产品版本号时才原样显示。
 * 包自己的内部版本号（0.0.0）永远过不了校验式，所以不会冒充产品版本。
 * @param {unknown} appVersion  app.getVersion() 的返回值
 * @returns {string}
 */
function displayVersion(appVersion) {
  return isProductVersion(appVersion) ? /** @type {string} */ (appVersion) : LOCAL_DEV_LABEL;
}

/**
 * 版本的种类，给关于窗口用。
 * @param {unknown} appVersion
 * @returns {{ injected: boolean, label: string, channel: '正式版' | '补丁版' | '测试版' | '本地开发' }}
 */
function describeVersion(appVersion) {
  const parsed = parseProductVersion(appVersion);
  if (parsed === null) return { injected: false, label: LOCAL_DEV_LABEL, channel: '本地开发' };
  const channel = parsed.kind === 'beta' ? '测试版' : parsed.kind === 'patch' ? '补丁版' : '正式版';
  return { injected: true, label: /** @type {string} */ (appVersion), channel };
}

/**
 * 带 -beta. 的是测试版。
 * @param {unknown} appVersion
 * @returns {boolean}
 */
function isBeta(appVersion) {
  return parseProductVersion(appVersion)?.kind === 'beta';
}

/**
 * 按产品版本号的规则比较新旧。不能用语义化版本的比较：
 * 语义化版本里带后缀的算预发布，2026.11.20-1 会排在 2026.11.20 前面，而规则里它是之后的补丁版。
 *
 * 同一天内的顺序：beta.1 < beta.2 < … < 正式版 < -1 < -2 < …
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 * @throws {TypeError} 任一参数不是合规的产品版本号
 */
function compareProductVersions(a, b) {
  const left = parseProductVersion(a);
  const right = parseProductVersion(b);
  if (left === null || right === null) {
    throw new TypeError(`不是合规的产品版本号：${JSON.stringify(left === null ? a : b)}`);
  }
  const rank = (/** @type {NonNullable<ReturnType<typeof parseProductVersion>>} */ v) =>
    v.kind === 'beta' ? 0 : v.kind === 'release' ? 1 : 2;
  const keys = [
    [left.year, right.year],
    [left.month, right.month],
    [left.day, right.day],
    [rank(left), rank(right)],
    [left.n, right.n],
  ];
  for (const [x, y] of keys) {
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

module.exports = {
  DESKTOP_VERSION_PATTERN,
  TAG_PATTERN,
  LOCAL_DEV_LABEL,
  isProductVersion,
  parseProductVersion,
  displayVersion,
  describeVersion,
  isBeta,
  compareProductVersions,
};
