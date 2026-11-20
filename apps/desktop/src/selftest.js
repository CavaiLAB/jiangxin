'use strict';

/**
 * 自检：壳起来之后把主窗口和关于窗口的内容截下来，写一份事实清单，然后退出。
 * 给验证用（JX_DESKTOP_SELFTEST=<目录>）。配合 JX_DESKTOP_SHOW=0 时窗口全程不显示，不打扰人。
 *
 * 截图用 webContents.capturePage()：截的是窗口里的页面内容，不含系统标题栏。
 */

const fs = require('node:fs');
const path = require('node:path');

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 在页面里反复求一个表达式，直到它为真或超时。
 * @param {Electron.WebContents} contents
 * @param {string} expression
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitFor(contents, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await contents.executeJavaScript(`Boolean(${expression})`, true)) return true;
    } catch {
      // 页面还在跳转，稍后再试。
    }
    await sleep(300);
  }
  return false;
}

/**
 * @param {Electron.WebContents} contents
 * @param {string} file
 * @returns {Promise<{ file: string, width: number, height: number, bytes: number }>}
 */
async function capture(contents, file) {
  // stayHidden：窗口没显示时也能截，而且不会因为截图把窗口变成可见。
  const image = await contents.capturePage(undefined, { stayHidden: true });
  const png = image.toPNG();
  fs.writeFileSync(file, png);
  const size = image.getSize();
  return { file, width: size.width, height: size.height, bytes: png.length };
}

/**
 * @param {object} input
 * @param {string} input.outDir
 * @param {Electron.BrowserWindow} input.mainWindow
 * @param {() => Electron.BrowserWindow} input.openAbout
 * @param {Record<string, unknown>} input.facts
 * @param {(line: string) => void} input.log
 * @param {string} [input.stepsFile] 额外的界面操作脚本：导出一个 async 函数，返回的对象里 ok 为 false 表示没过
 * @param {() => ({ isEditable: boolean, hasSelection: boolean, labels: string[] } | undefined)} [input.takeContextMenu]
 *   取走壳最近一次算出来的右键菜单内容（自检时菜单不真的弹出）
 * @returns {Promise<boolean>} 全部检查都过了返回 true
 */
async function runSelftest({ outDir, mainWindow, openAbout, facts, log, stepsFile, takeContextMenu }) {
  if (!path.isAbsolute(outDir)) throw new Error(`自检输出目录必须是绝对路径：${outDir}`);
  fs.mkdirSync(outDir, { recursive: true });
  /** @type {Record<string, unknown>} */
  const result = { startedAt: new Date().toISOString(), facts, checks: {} };
  const checks = /** @type {Record<string, boolean>} */ (result.checks);

  // 1. 主窗口：等 DSH 的界面真的画出来（页面有可见文字），再多等一会儿让首屏的请求走完。
  const contents = mainWindow.webContents;
  checks.mainPageRendered = await waitFor(
    contents,
    `document.readyState === 'complete' && document.body && document.body.innerText.trim().length > 20`,
    60_000,
  );
  await sleep(4000);
  result.mainWindow = await capture(contents, path.join(outDir, 'main-window.png'));
  result.windowTitle = mainWindow.getTitle();
  result.page = await contents.executeJavaScript(`(() => {
    const entries = performance.getEntriesByType('resource');
    const origins = [...new Set(entries.map((entry) => { try { return new URL(entry.name).origin } catch { return 'invalid' } }))];
    return {
      location: location.origin + location.pathname,
      hasTokenInUrl: location.search.includes('token='),
      documentTitle: document.title,
      cookieVisibleToPage: document.cookie.includes('dsh-auth-'),
      textHead: document.body.innerText.trim().replace(/\\s+/g, ' ').slice(0, 400),
      resourceCount: entries.length,
      resourceOrigins: origins,
      bridge: window.jiangxinDesktop ?? null,
      hasUpstreamDesktopBridge: typeof window.dshDesktop !== 'undefined',
    }
  })()`, true);
  const page = /** @type {any} */ (result.page);
  checks.pageIsLocalHost = page.location === `${String(facts.origin)}/`;
  checks.noTokenInUrl = page.hasTokenInUrl === false;
  checks.cookieHiddenFromPage = page.cookieVisibleToPage === false;
  checks.onlyLocalResources = page.resourceOrigins.every((/** @type {string} */ origin) => origin === facts.origin);
  // 认证 Cookie 是 HttpOnly 的，页面本来就读不到，上面那一项不足以说明它没进浏览器的 Cookie 存储。
  // 这里直接查主窗口会话的 Cookie 存储：里面不该有它（它只在主进程内存里，由请求钩子附上）。只记个数，不记名字和值。
  const jar = await contents.session.cookies.get({});
  result.cookieJar = { count: jar.length, authCookies: jar.filter((cookie) => cookie.name.startsWith('dsh-auth-')).length };
  checks.authCookieNotInJar = jar.every((cookie) => !cookie.name.startsWith('dsh-auth-'));
  checks.windowTitleIsProductName = result.windowTitle === facts.productName;
  checks.bridgeHasVersion = page.bridge?.displayVersion === facts.version;

  // 2. 界面和宿主之间的接口通不通：从页面里带着（由壳附上的）凭据取一次首页。
  result.apiProbe = await contents.executeJavaScript(`fetch('/', { credentials: 'same-origin' }).then((r) => r.status).catch((e) => String(e))`, true);
  checks.hostReachableFromPage = result.apiProbe === 200;

  // 2b. 额外的界面操作脚本（比如在窗口里发一条消息，等模型回复）。
  if (stepsFile !== undefined) {
    if (!path.isAbsolute(stepsFile)) throw new Error(`界面操作脚本必须是绝对路径：${stepsFile}`);
    const steps = require(stepsFile);
    // 窗口没显示时页面没有焦点，富文本输入框不收脚本打的字。
    // 用调试协议让页面「当作有焦点」，并由它来输入文字，和真人打字走的是同一条路径。
    contents.debugger.attach('1.3');
    try {
      await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
      const stepsResult = await steps({
        contents,
        mainWindow,
        facts,
        sleep,
        exec: (/** @type {string} */ js) => contents.executeJavaScript(js, true),
        waitFor: (/** @type {string} */ expression, /** @type {number} */ timeoutMs) => waitFor(contents, expression, timeoutMs),
        capture: (/** @type {string} */ name) => capture(contents, path.join(outDir, name)),
        cdp: (/** @type {string} */ method, /** @type {object} */ params) => contents.debugger.sendCommand(method, params),
        // 在页面的某个位置点一下右键，返回壳为这次右键准备的菜单内容；壳没收到右键事件时返回 null。
        rightClick: async (/** @type {number} */ x, /** @type {number} */ y) => {
          takeContextMenu?.();
          const point = { x: Math.round(x), y: Math.round(y), button: 'right', clickCount: 1 };
          await contents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', buttons: 2, ...point });
          await contents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', buttons: 0, ...point });
          for (let attempt = 0; attempt < 30; attempt++) {
            const menu = takeContextMenu?.();
            if (menu !== undefined) return menu;
            await sleep(100);
          }
          return null;
        },
      });
      result.steps = { file: stepsFile, ...stepsResult };
      checks.stepsPassed = stepsResult?.ok !== false;
    } catch (error) {
      result.steps = { file: stepsFile, error: error instanceof Error ? error.message : String(error) };
      checks.stepsPassed = false;
    } finally {
      contents.debugger.detach();
    }
  }

  // 3. 关于窗口。
  const about = openAbout();
  checks.aboutRendered = await waitFor(about.webContents, `document.documentElement.dataset.ready === 'true'`, 15_000);
  await sleep(600);
  result.aboutWindow = await capture(about.webContents, path.join(outDir, 'about-window.png'));
  result.about = await about.webContents.executeJavaScript(`({
    title: document.title,
    name: document.getElementById('name').textContent,
    version: document.getElementById('version').textContent,
    channel: document.getElementById('channel').hidden ? null : document.getElementById('channel').textContent,
    builtOn: document.getElementById('built-on').textContent,
    licenseHead: document.getElementById('license').textContent.slice(0, 60),
    licenseHasCopyright: document.getElementById('license').textContent.includes('Copyright (c) 2026 DeepSeek'),
    licenseHasPermissionNotice: document.getElementById('license').textContent.includes('Permission is hereby granted'),
  })`, true);
  const aboutFacts = /** @type {any} */ (result.about);
  checks.aboutShowsProductName = aboutFacts.name === facts.productName;
  checks.aboutShowsVersion = aboutFacts.version === facts.version;
  checks.aboutShowsBuiltOnDsh = aboutFacts.builtOn === `基于 DSH ${String(facts.dshVersion)} 构建`;
  checks.aboutShowsMitLicense = aboutFacts.licenseHasCopyright && aboutFacts.licenseHasPermissionNotice;

  result.finishedAt = new Date().toISOString();
  result.ok = Object.values(checks).every(Boolean);
  fs.writeFileSync(path.join(outDir, 'selftest.json'), JSON.stringify(result, null, 2) + '\n');
  log(`自检${result.ok ? '通过' : '未通过'}：${JSON.stringify(checks)}`);
  return result.ok === true;
}

module.exports = { runSelftest };
