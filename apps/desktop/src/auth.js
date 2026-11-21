'use strict';

/**
 * 把 DSH 的启动地址（带一次性令牌）换成认证 Cookie。不依赖 Electron。
 *
 * 上游的做法（apps/desktop/src/web-document.ts 的 authenticateWebHost）：
 * 主进程自己去取带令牌的地址，不跟随跳转，从 303 响应里取出 Cookie，以后代页面附上。
 * 页面拿不到令牌，Cookie 也不进任何浏览器存储。薄壳照这个做。
 */

/**
 * @param {string} launchUrl 带令牌的启动地址。不要打印。
 * @returns {Promise<string>} `名字=值` 形式的 Cookie。不要打印。
 */
async function exchangeLaunchUrl(launchUrl) {
  const response = await fetch(launchUrl, { redirect: 'manual' });
  const setCookie = response.headers.get('set-cookie');
  await response.body?.cancel();
  if (response.status !== 303 || setCookie === null) {
    // 报错里只带状态码，不带地址（地址里有令牌）。
    throw new Error(`DSH 认证失败：期望 303 和一个 Cookie，实际是 ${String(response.status)}`);
  }
  const end = setCookie.indexOf(';');
  const pair = end < 0 ? setCookie : setCookie.slice(0, end);
  if (!/^dsh-auth-[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+$/.test(pair)) {
    throw new Error('DSH 认证失败：返回的 Cookie 不是预期的格式');
  }
  return pair;
}

/**
 * 把认证 Cookie 并进一个已有的 Cookie 请求头里（同名的换掉）。
 * @param {string | undefined} existing 现有的 Cookie 头
 * @param {string} pair `名字=值`
 * @returns {string}
 */
function mergeCookie(existing, pair) {
  const name = pair.slice(0, pair.indexOf('='));
  const others = (existing ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part.slice(0, part.indexOf('=')) !== name);
  return [...others, pair].join('; ');
}

module.exports = { exchangeLaunchUrl, mergeCookie };
