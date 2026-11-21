'use strict';

/**
 * 匠心工业智能体平台客户端的主进程（薄壳）。
 *
 * 做的事：从发行目录启动已发布的 DSH（Web 模式、只听本机），等它就绪，
 * 用它给的一次性令牌换一个认证 Cookie，然后开窗口装载它的 Web 界面。
 *
 * 有意不做的事：不注册 dsh:// 协议，不设开机启动，不做自动更新，
 * 不把命令行装到系统路径，不登录任何账号，不发产品分析。
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, nativeTheme, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const { PRODUCT_NAME, ENV } = require('./config');
const { exchangeLaunchUrl, mergeCookie } = require('./auth');
const { contextMenuTemplate } = require('./context-menu');
const { DshHost, redact } = require('./host');
const { planLaunch } = require('./launch');
const { buildMenu } = require('./menu');
const { decideMockModel, locateMockModel, startMockModel } = require('./mock-model');
const { runSelftest } = require('./selftest');
const { describeVersion, displayVersion } = require('./version');

/** 开发时是 apps/desktop；打包后这个值不用。 */
const APP_DIR = path.resolve(__dirname, '..');

/**
 * 读一个开关：环境变量优先，其次是命令行上的 --jx-xxx=值。
 * 后者是给 `open App.app --args ...` 这种不方便带环境变量的启动方式用的。
 * @param {string} envName
 * @returns {string | undefined}
 */
function option(envName) {
  const fromEnv = process.env[envName];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const switchName = envName.toLowerCase().replace(/^jx_desktop_/, 'jx-').replace(/^jx_/, 'jx-').replaceAll('_', '-');
  const value = app.commandLine.getSwitchValue(switchName);
  return value === '' ? undefined : value;
}

/** 自检的输出目录；没给就不是自检。 */
const selftestDir = option(ENV.selftest);
/** 设成 0 时窗口一直不显示（自检截图不需要窗口可见）。 */
const showWindows = option(ENV.show) !== '0';
/** 设成 inactive 时窗口显示但不抢焦点。 */
const showInactive = option(ENV.show) === 'inactive';
if (!showWindows && process.platform === 'darwin') {
  // 不显示窗口的运行（验证用）也不要在程序坞里冒图标、不要抢前台。
  app.setActivationPolicy('accessory');
}

/** 壳自己的开关，合并成一份环境变量表交给 planLaunch。 */
function shellEnv() {
  const env = { ...process.env };
  for (const name of Object.values(ENV)) {
    const value = option(name);
    if (value !== undefined) env[name] = value;
  }
  return env;
}

/** 打包时用 --config.extraMetadata 写进 package.json 的信息。 */
function buildMetadata() {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
    return typeof manifest.jiangxin === 'object' && manifest.jiangxin !== null ? manifest.jiangxin : {};
  } catch {
    return {};
  }
}

// ── 启动前：定目录、做隔离。这一段必须在 ready 之前、在任何会用到用户数据目录的调用之前跑完。──

/** @type {ReturnType<typeof planLaunch>} */
let plan;
try {
  plan = planLaunch({
    env: shellEnv(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appDir: APP_DIR,
    bakedStateRoot: buildMetadata().stateRoot,
    // 用 Electron 自己的可执行文件以 Node 模式跑 DSH，应用不依赖系统里装没装 Node。
    electronBinary: process.execPath,
    productVersion: app.getVersion(),
  });
} catch (error) {
  dialog.showErrorBox(`${PRODUCT_NAME} 无法启动`, error instanceof Error ? error.message : String(error));
  app.exit(1);
}

if (plan !== undefined) {
  app.setName(PRODUCT_NAME);
  // 用户数据、日志、崩溃转储都显式指到状态目录下，不用系统默认的 ~/Library/Application Support/<应用名>。
  app.setPath('userData', plan.dirs.userData);
  app.setPath('sessionData', plan.dirs.userData);
  app.setPath('crashDumps', path.join(plan.dirs.userData, 'Crashpad'));
  app.setAppLogsPath(plan.dirs.logs);

  const debugPort = option(ENV.remoteDebugPort);
  if (debugPort !== undefined) {
    if (['9222', '9229', '9230'].includes(debugPort)) {
      dialog.showErrorBox(`${PRODUCT_NAME} 无法启动`, `调试端口 ${debugPort} 留给用户自己的 DSH，请换一个（比如 9322）。`);
      app.exit(1);
    }
    app.commandLine.appendSwitch('remote-debugging-port', debugPort);
    app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  }

  // 单实例锁跟着用户数据目录走，和别的应用（包括用户自己的 DSH）互不影响。
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    app.on('second-instance', () => showMainWindow());
    app.whenReady().then(main).catch((error) => {
      shellLog(`启动失败：${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      dialog.showErrorBox(`${PRODUCT_NAME} 无法启动`, error instanceof Error ? error.message : String(error));
      void quitApp(1);
    });
  }
}

// ── 状态 ──

/** @type {BrowserWindow | undefined} */
let mainWindow;
/** @type {BrowserWindow | undefined} */
let aboutWindow;
/** @type {DshHost | undefined} */
let host;
/** 自带的假模型（只有本机试用构建或打开开关时才有）。 */
/** @type {Awaited<ReturnType<typeof startMockModel>> | undefined} */
let mockModel;
/** 认证 Cookie（`名字=值`）。只在主进程内存里，不进浏览器的 Cookie 存储，不写日志。 */
/** @type {string | undefined} */
let authCookie;
let quitting = false;
/** 最近一次右键菜单的内容。只给自检看：自检时菜单不真的弹出来（弹出的原生菜单会卡住没人操作的窗口）。 */
/** @type {{ isEditable: boolean, hasSelection: boolean, labels: string[] } | undefined} */
let lastContextMenu;

/**
 * 写壳自己的日志。凭据先隐去。
 * @param {string} line
 */
function shellLog(line) {
  if (plan === undefined) return;
  try {
    fs.appendFileSync(path.join(plan.dirs.logs, 'desktop-shell.log'), `${new Date().toISOString()} ${redact(line)}\n`);
  } catch {
    // 日志写不了不影响运行。
  }
}

/** 关于窗口和自检要用的一份事实。 */
function appFacts() {
  const version = describeVersion(app.getVersion());
  return {
    productName: PRODUCT_NAME,
    // 界面上显示的版本取 app.getVersion()；没注入时显示「本地开发」。
    version: version.label,
    versionChannel: version.channel,
    versionInjected: version.injected,
    dshVersion: plan.distribution.dshVersion,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform}-${process.arch}`,
  };
}

/** DSH 的许可全文：读发行目录里那份（和实际装的版本一致），读不到就用壳里带的副本。 */
function dshLicenseText() {
  for (const file of [plan.distribution.licensePath, path.join(APP_DIR, 'assets', 'licenses', 'DSH-LICENSE.txt')]) {
    if (file === undefined) continue;
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      // 换下一个。
    }
  }
  return 'MIT License\n\nCopyright (c) 2026 DeepSeek\n\n（许可全文缺失，请联系发行方。）';
}

/** 随应用分发的许可文件目录（打包时由 scripts/after-pack.js 放进去）。开发时没有。 */
function licensesDir() {
  const dir = path.join(process.resourcesPath, 'licenses');
  return app.isPackaged && fs.existsSync(dir) ? dir : undefined;
}

// ── 窗口 ──

/** 主窗口专用的会话分区：本地存储等落在状态目录下，认证 Cookie 只对这个分区里发往本机 DSH 的请求附上。 */
function mainSession() {
  return session.fromPartition('persist:jx-main');
}

/**
 * 给主窗口的会话装两个钩子：
 *   1. 发往本机 DSH 的请求（HTTP 和 WebSocket）附上认证 Cookie；
 *   2. 记录窗口发往本机 DSH 以外的请求（可选拦截），作为外联检查的证据。
 */
function installRequestHooks() {
  const ses = mainSession();
  const hostAuthority = `${plan.host}:${String(plan.port)}`;
  const blockExternal = option(ENV.blockExternal) === '1';
  const egressLog = path.join(plan.dirs.logs, 'window-egress.log');
  const seen = new Set();

  ses.webRequest.onBeforeRequest((details, callback) => {
    let url;
    try {
      url = new URL(details.url);
    } catch {
      callback({});
      return;
    }
    const local = ['file:', 'data:', 'blob:', 'devtools:', 'about:', 'chrome:'].includes(url.protocol)
      || (['http:', 'ws:'].includes(url.protocol) && url.host === hostAuthority);
    if (local) {
      callback({});
      return;
    }
    // 只记协议、主机和路径，不记查询串（里面可能有敏感内容）。
    const record = `${url.protocol}//${url.host}${url.pathname}`;
    if (!seen.has(record)) {
      seen.add(record);
      try {
        fs.appendFileSync(egressLog, `${new Date().toISOString()} ${blockExternal ? '已拦截' : '已放行'} ${details.resourceType} ${record}\n`);
      } catch {
        // 记不了不影响运行。
      }
    }
    callback({ cancel: blockExternal });
  });

  // 过滤式不带端口（老版本的匹配式不认端口），进回调后再精确比对主机和端口。
  ses.webRequest.onBeforeSendHeaders({ urls: [`http://${plan.host}/*`, `ws://${plan.host}/*`] }, (details, callback) => {
    if (authCookie === undefined || new URL(details.url).host !== hostAuthority) {
      callback({});
      return;
    }
    const headers = { ...details.requestHeaders };
    const key = Object.keys(headers).find((name) => name.toLowerCase() === 'cookie');
    headers[key ?? 'Cookie'] = mergeCookie(key === undefined ? undefined : headers[key], authCookie);
    callback({ requestHeaders: headers });
  });

  // 权限一律按最小给：只放行本机界面的剪贴板，其余拒绝并记一笔。
  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    let fromHost = false;
    try {
      fromHost = new URL(details.requestingUrl).host === hostAuthority;
    } catch {
      fromHost = false;
    }
    const allowed = fromHost && ['clipboard-read', 'clipboard-sanitized-write'].includes(permission);
    if (!allowed) shellLog(`拒绝了权限请求：${permission}`);
    callback(allowed);
  });
}

function createMainWindow() {
  const hiddenInset = option(ENV.titlebar) === 'hiddenInset';
  const facts = appFacts();
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 520,
    minHeight: 600,
    show: false,
    title: PRODUCT_NAME,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1b1c' : '#ffffff',
    ...(hiddenInset && process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 18 } } : {}),
    webPreferences: {
      session: mainSession(),
      preload: path.join(__dirname, 'preload.js'),
      // 给预加载脚本的只读信息：版本取 app.getVersion()，经参数交给预加载脚本。
      additionalArguments: [
        `--jx-app-version=${app.getVersion()}`,
        `--jx-display-version=${facts.version}`,
        `--jx-dsh-version=${facts.dshVersion}`,
      ],
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });

  // 页面自己的标题由品牌包换（packages/brand-theme）。壳这一层的窗口标题固定用产品全称。
  window.on('page-title-updated', (event) => event.preventDefault());

  // 关窗只隐藏：DSH 和页面继续跑，任务不中断；点程序坞图标再显示。退出走菜单或 ⌘Q。
  window.on('close', (event) => {
    if (quitting || process.platform !== 'darwin') return;
    event.preventDefault();
    window.hide();
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined;
  });

  // 新窗口一律不开；外部链接交给系统浏览器。
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  // 页面内的跳转只允许留在本机 DSH 上。
  window.webContents.on('will-navigate', (event, url) => {
    if (host !== undefined && new URL(url).origin === host.origin) return;
    event.preventDefault();
    openExternal(url);
  });
  // 右键菜单：Electron 默认不弹，输入框里的剪切、拷贝、粘贴要壳来补。
  window.webContents.on('context-menu', (_event, params) => {
    const template = contextMenuTemplate(params);
    lastContextMenu = {
      isEditable: params.isEditable,
      hasSelection: params.selectionText.length > 0,
      labels: template.flatMap((item) => (item.label === undefined ? [] : [item.label])),
    };
    if (template.length === 0 || selftestDir !== undefined) return;
    Menu.buildFromTemplate(/** @type {Electron.MenuItemConstructorOptions[]} */ (template)).popup({ window });
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    shellLog(`渲染进程退出：${details.reason}`);
  });
  return window;
}

/**
 * 外部链接用系统浏览器打开。只放行 http 和 https；自检时不打开。
 * @param {string} url
 */
function openExternal(url) {
  try {
    if (selftestDir === undefined && ['http:', 'https:'].includes(new URL(url).protocol)) void shell.openExternal(url);
  } catch {
    // 不是合法地址，忽略。
  }
}

/**
 * 按显示方式把一个窗口亮出来。
 * @param {BrowserWindow} window
 */
function reveal(window) {
  if (!showWindows || window.isDestroyed()) return;
  if (showInactive) {
    window.showInactive();
    return;
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function showMainWindow() {
  if (mainWindow !== undefined) reveal(mainWindow);
}

function showAbout() {
  if (aboutWindow !== undefined && !aboutWindow.isDestroyed()) {
    reveal(aboutWindow);
    return aboutWindow;
  }
  const window = new BrowserWindow({
    width: 520,
    height: 660,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: `关于${PRODUCT_NAME}`,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1b1c' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'about-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  aboutWindow = window;
  window.setMenuBarVisibility(false);
  window.on('closed', () => {
    if (aboutWindow === window) aboutWindow = undefined;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => reveal(window));
  void window.loadFile(path.join(__dirname, 'about.html'));
  return window;
}

// ── 启动与退出 ──

/**
 * 启动页：DSH 还没起来时窗口里显示这个。
 * @param {'starting' | 'failed'} state
 * @param {string} [message]
 */
async function loadShellPage(state, message) {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return;
  await mainWindow.loadFile(path.join(__dirname, 'loading.html'), {
    query: { state, name: PRODUCT_NAME, ...(message === undefined ? {} : { message: redact(message).slice(0, 2000) }) },
  });
}

/**
 * 本机试用构建：DSH 启动前起自带的假模型，把它的地址和假密钥交给 DSH。
 * 起不来只记一笔、照样启动 DSH（界面能开，只是发消息会失败）。
 */
async function startBundledMockModel() {
  let decision;
  try {
    decision = decideMockModel({
      option: option(ENV.mockModel),
      baked: buildMetadata().mockModel,
      modelBaseUrl: plan.hostOptions.env.JX_MODEL_BASE_URL,
    });
  } catch (error) {
    shellLog(`不起自带的假模型：${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!decision.enabled) {
    if (decision.reason !== '没有打开') shellLog(`不起自带的假模型：${decision.reason}`);
    return;
  }
  try {
    mockModel = await startMockModel({
      nodeBinary: plan.hostOptions.nodeBinary,
      electronAsNode: plan.hostOptions.electronAsNode,
      script: locateMockModel({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appDir: APP_DIR }),
      logsDir: plan.dirs.logs,
    });
    plan.hostOptions.env.JX_MODEL_BASE_URL = mockModel.baseURL;
    plan.hostOptions.env.JX_MODEL_API_KEY = mockModel.apiKey;
    shellLog(`自带的假模型已就绪：${mockModel.baseURL}（进程 ${String(mockModel.pid)}，${decision.reason}）`);
  } catch (error) {
    shellLog(`自带的假模型没起来，照样启动 DSH：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function startHost() {
  await startBundledMockModel();
  host = new DshHost(plan.hostOptions);
  host.on('exit', (/** @type {{ code: number | null, signal: string | null, tail: string }} */ info) => {
    authCookie = undefined;
    shellLog(`DSH 意外退出：code=${String(info.code)} signal=${String(info.signal)}`);
    if (quitting) return;
    void loadShellPage('failed', `DSH 意外停止了（code=${String(info.code)}）。日志在 ${plan.hostOptions.logFile}`);
    if (selftestDir !== undefined) void quitApp(1);
  });
  const { origin, launchUrl } = await host.start();
  // 主进程自己用令牌换 Cookie；令牌不进页面，也不出现在窗口的地址里。
  authCookie = await exchangeLaunchUrl(launchUrl);
  shellLog(`DSH 已就绪：${origin}（进程 ${String(host.pid)}）`);
  return origin;
}

async function main() {
  shellLog(
    `启动 ${PRODUCT_NAME}：版本 ${displayVersion(app.getVersion())}，打包=${String(app.isPackaged)}，`
    + `发行目录 ${plan.distribution.dir}（${plan.distributionSource}），DSH ${plan.distribution.dshVersion}，`
    + `状态目录 ${plan.dirs.root}（${plan.stateSource}）`,
  );

  // 系统自带的关于面板也填上（菜单走的是自己的关于窗口，这里是兜底）。
  app.setAboutPanelOptions({
    applicationName: PRODUCT_NAME,
    applicationVersion: displayVersion(app.getVersion()),
    version: '',
    credits: `基于 DSH ${plan.distribution.dshVersion} 构建`,
    copyright: 'DSH 部分：Copyright (c) 2026 DeepSeek，按 MIT 许可使用',
  });
  if (!app.isPackaged && process.platform === 'darwin') {
    // 没打包时系统显示的是 Electron 的图标和名字；程序坞图标可以临时换成我们的。
    app.dock?.setIcon(nativeImage.createFromPath(path.join(APP_DIR, 'assets', 'icon-512.png')));
  }

  ipcMain.handle('jx-about:info', () => ({
    ...appFacts(),
    dshLicense: dshLicenseText(),
    hasLicensesDir: licensesDir() !== undefined,
  }));
  ipcMain.handle('jx-about:open-licenses', () => {
    const dir = licensesDir();
    if (dir !== undefined && selftestDir === undefined) void shell.openPath(dir);
  });

  Menu.setApplicationMenu(buildMenu({
    productName: PRODUCT_NAME,
    showAbout: () => { showAbout(); },
    openLogs: () => { void shell.openPath(plan.dirs.logs); },
    quit: () => { void quitApp(0); },
  }));

  installRequestHooks();
  mainWindow = createMainWindow();
  mainWindow.once('ready-to-show', () => showMainWindow());
  await loadShellPage('starting');

  let origin;
  try {
    origin = await startHost();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    shellLog(`DSH 启动失败：${message}`);
    await loadShellPage('failed', message);
    if (selftestDir !== undefined) await quitApp(1);
    return;
  }

  // 装载的是不带令牌的干净地址。
  await mainWindow.loadURL(`${origin}/`);
  mainWindow.setTitle(PRODUCT_NAME);

  if (selftestDir !== undefined) {
    // 界面操作脚本会在主进程里执行，所以只在开发启动和本机构建里认。
    const stepsFile = !app.isPackaged || buildMetadata().channel === 'dev' ? option(ENV.selftestSteps) : undefined;
    const ok = await runSelftest({
      outDir: selftestDir,
      mainWindow,
      openAbout: showAbout,
      stepsFile,
      takeContextMenu: () => {
        const menu = lastContextMenu;
        lastContextMenu = undefined;
        return menu;
      },
      facts: {
        ...appFacts(),
        appName: app.getName(),
        appVersion: app.getVersion(),
        isPackaged: app.isPackaged,
        exePath: app.getPath('exe'),
        userData: app.getPath('userData'),
        logs: app.getPath('logs'),
        distributionDir: plan.distribution.dir,
        distributionSource: plan.distributionSource,
        stateRoot: plan.dirs.root,
        stateSource: plan.stateSource,
        dshHome: plan.dirs.dshHome,
        origin,
        hostPid: host?.pid,
        hostRunner: plan.hostOptions.electronAsNode ? 'electron-as-node' : 'external-node',
        patches: plan.hostOptions.patches,
      },
      log: shellLog,
    }).catch((error) => {
      shellLog(`自检出错：${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      return false;
    });
    await quitApp(ok ? 0 : 1);
  }
}

app.on('activate', () => showMainWindow());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') void quitApp(0);
});
// ⌘Q、程序坞菜单的退出都会到这里：先把 DSH 停干净再真正退出。
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  void quitApp(0);
});

/**
 * 退出：停掉 DSH，再退出应用。
 * @param {number} code
 */
async function quitApp(code) {
  if (quitting) return;
  quitting = true;
  authCookie = undefined;
  try {
    await host?.stop();
  } catch (error) {
    shellLog(`停 DSH 时出错：${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    await mockModel?.stop();
  } catch (error) {
    shellLog(`停假模型时出错：${error instanceof Error ? error.message : String(error)}`);
  }
  shellLog(`退出，code=${String(code)}`);
  app.exit(code);
}
