'use strict';

/**
 * 壳这一层的固定信息。产品名已定；短名「匠心」也已定。
 * 这个文件不依赖 Electron。
 */

/** 全称。能放下的地方都用它：应用名、菜单、窗口标题、关于。 */
const PRODUCT_NAME = '匠心工业智能体平台';

/** 短名。只用在放不下全称的地方。macOS 的壳这一层目前没有这样的位置，先留着给 Windows 托盘等。 */
const PRODUCT_SHORT_NAME = '匠心';

/** 英文与标识符。 */
const PRODUCT_ID = 'jiangxin';

/** 默认监听地址与端口。端口和 Web 端的默认端口（3180）错开。 */
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3182;

/** DSH 的包名、要启动的 profile、钉死的版本。钉死的版本同时写在发行目录的 package.json 里，以那里为准。 */
const DSH_PACKAGE = '@deepseek-ai/dsh';
const DSH_PROFILE = 'web';

/** 壳自己认的环境变量。 */
const ENV = Object.freeze({
  /** 指向别的发行目录（里面有 package.json、node_modules、patches/）。 */
  distributionDir: 'JX_DISTRIBUTION_DIR',
  /** 本机状态的根目录。DSH_HOME、Electron 的用户数据目录等都在它下面。 */
  stateDir: 'JX_DESKTOP_STATE_DIR',
  /** DSH 的监听端口。 */
  port: 'JX_DESKTOP_PORT',
  /** 用外部的 Node 跑 DSH（给一个 node 可执行文件的绝对路径）。默认用 Electron 自带的 Node。 */
  hostNode: 'JX_DESKTOP_HOST_NODE',
  /** 额外透传给 DSH 进程的环境变量名，逗号分隔。默认只透传一份很短的白名单。 */
  passEnv: 'JX_DESKTOP_PASS_ENV',
  /** 窗口怎么显示。0：全程不显示，也不在程序坞里出现（验证时用）；inactive：显示但不抢焦点；其他：正常显示。 */
  show: 'JX_DESKTOP_SHOW',
  /** 自检：给一个目录，壳启动后把主窗口和关于窗口截图到这个目录，写一份 selftest.json，然后退出。 */
  selftest: 'JX_DESKTOP_SELFTEST',
  /** 自检时额外跑的一段界面操作脚本（一个 CommonJS 模块的绝对路径）。只在本机构建和开发启动里生效。 */
  selftestSteps: 'JX_DESKTOP_SELFTEST_STEPS',
  /** 标题栏样式：default（系统标题栏）或 hiddenInset（隐藏标题栏、红绿灯嵌进内容区）。 */
  titlebar: 'JX_DESKTOP_TITLEBAR',
  /** 设成 1：窗口发往本机 DSH 以外的请求一律拦下（默认只记录不拦）。 */
  blockExternal: 'JX_DESKTOP_BLOCK_EXTERNAL',
  /** 渲染进程的远程调试端口。不要用 9222、9229、9230（用户自己的 DSH 可能在用）。 */
  remoteDebugPort: 'JX_DESKTOP_REMOTE_DEBUG_PORT',
  /** 自带的假模型：1 起，0 不起；不给时看打包时写进包里的 mockModel。已设 JX_MODEL_BASE_URL 时一律不起。 */
  mockModel: 'JX_DESKTOP_MOCK_MODEL',
});

module.exports = {
  PRODUCT_NAME,
  PRODUCT_SHORT_NAME,
  PRODUCT_ID,
  DEFAULT_HOST,
  DEFAULT_PORT,
  DSH_PACKAGE,
  DSH_PROFILE,
  ENV,
};
