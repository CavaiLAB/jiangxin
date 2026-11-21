'use strict';

/**
 * 把「从哪个发行目录启动、状态放哪里、用哪个端口、给 DSH 什么环境变量」这些决定集中在一处，
 * Electron 主进程和冒烟脚本共用。不依赖 Electron。
 */

const path = require('node:path');

const { DEFAULT_HOST, DEFAULT_PORT, DSH_PROFILE, ENV } = require('./config');
const { locateDistribution, readDistribution } = require('./distribution');
const { buildHostEnv } = require('./host');
const { writeShellOverlay } = require('./overlay');
const { resolveStateRoot, prepareStateDirs } = require('./state');
const { describeVersion } = require('./version');

/**
 * @param {string | undefined} raw
 * @returns {number}
 */
function parsePort(raw) {
  if (raw === undefined || raw.trim() === '') return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${ENV.port} 必须是 1024 到 65535 之间的整数，现在是 ${JSON.stringify(raw)}`);
  }
  return port;
}

/**
 * @param {object} input
 * @param {Record<string, string | undefined>} input.env 壳自己的环境变量
 * @param {boolean} input.isPackaged
 * @param {string} input.resourcesPath
 * @param {string} input.appDir 开发时是 apps/desktop
 * @param {string | undefined} input.bakedStateRoot
 * @param {string} input.electronBinary Electron 可执行文件（用它自带的 Node 跑 DSH）
 * @param {string} [input.productVersion] app.getVersion() 的原值；不是合规的产品版本号时按「本地开发」处理
 * @returns {{
 *   dirs: ReturnType<typeof prepareStateDirs>,
 *   stateSource: 'env' | 'dev' | 'baked',
 *   distribution: ReturnType<typeof readDistribution>,
 *   distributionSource: 'env' | 'bundled' | 'dev',
 *   host: string,
 *   port: number,
 *   overlayFile: string,
 *   hostOptions: import('./host').DshHostOptions,
 * }}
 */
function planLaunch({ env, isPackaged, resourcesPath, appDir, bakedStateRoot, electronBinary, productVersion }) {
  const state = resolveStateRoot({ env, envName: ENV.stateDir, isPackaged, appDir, bakedStateRoot });
  const dirs = prepareStateDirs(state.root);

  const located = locateDistribution({ env, envName: ENV.distributionDir, isPackaged, resourcesPath, appDir });
  const distribution = readDistribution(located.dir);

  const host = DEFAULT_HOST;
  const port = parsePort(env[ENV.port]);

  // 壳的补丁排在发行目录的补丁之后。
  const overlayFile = writeShellOverlay({ generatedDir: dirs.generated, documentsDir: dirs.documents });
  const patches = [...distribution.patches, overlayFile];

  const externalNode = env[ENV.hostNode];
  const useExternalNode = externalNode !== undefined && externalNode.trim() !== '';
  if (useExternalNode && !path.isAbsolute(externalNode)) {
    throw new Error(`${ENV.hostNode} 必须是绝对路径：${externalNode}`);
  }

  // 透传给 DSH 的变量：
  //   - 发行目录的补丁通过 JX_ 开头的环境变量取值（比如模型网关地址 JX_MODEL_BASE_URL），这些原样传；
  //     壳自己的开关（JX_DESKTOP_*、JX_DISTRIBUTION_DIR、JX_PACK_*）不传。
  //   - 另外用 JX_DESKTOP_PASS_ENV 点名的变量。
  const shellOwn = new Set(Object.values(ENV));
  const distributionNames = Object.keys(env).filter(
    (name) => name.startsWith('JX_') && !name.startsWith('JX_DESKTOP_') && !name.startsWith('JX_PACK_') && !shellOwn.has(name),
  );
  const namedPass = (env[ENV.passEnv] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
  const passNames = [...new Set([...distributionNames, ...namedPass])];

  // 产品版本号也交给 DSH 一份，品牌包可以显示同一个版本（一个版本号同时进壳和界面）。
  // 变量名与 Web 端的启动器（distribution/bin/jx-dsh）一致：带 v 的 JX_PRODUCT_VERSION，没注入时不设。
  const product = describeVersion(productVersion);
  // 插件管理器和 pnpm 用的 npm 源：没指定就指向本机一个不监听的端口，装插件会失败但不会外联。
  const npmRegistry = env.JX_NPM_REGISTRY !== undefined && env.JX_NPM_REGISTRY !== '' ? env.JX_NPM_REGISTRY : 'http://127.0.0.1:9/';

  const hostEnv = buildHostEnv({
    parentEnv: env,
    passNames,
    fixed: {
      // 状态目录一律显式给出，绝不让 DSH 用默认的 ~/.dsh 和 ~/.agents。
      DSH_HOME: dirs.dshHome,
      DSH_AGENTS_HOME: dirs.agentsHome,
      // 会话遥测两道都关：任何非空的 DSH_TELEMETRY_DISABLED 会把遥测那一行整行停掉
      // （packages/boot/app-boot/src/profile-context.ts）；DSH_TELEMETRY_MODE 是那一行自己读的模式。
      DSH_TELEMETRY_DISABLED: '1',
      DSH_TELEMETRY_MODE: 'DISABLED',
      // 发行目录的补丁会读这几个变量。默认工作区的位置壳还会在自己的补丁里再钉一次。
      JX_DOCUMENTS_DIR: dirs.documents,
      JX_DSH_VERSION: distribution.dshVersion,
      JX_PRODUCT_VERSION_LABEL: product.injected ? `v${product.label}` : product.label,
      ...(product.injected ? { JX_PRODUCT_VERSION: `v${product.label}` } : {}),
      JX_NPM_REGISTRY: npmRegistry,
      npm_config_registry: npmRegistry,
      npm_config_update_notifier: 'false',
      NO_UPDATE_NOTIFIER: '1',
      // 日志里不要颜色控制符。
      NO_COLOR: '1',
    },
  });

  return {
    dirs,
    stateSource: state.source,
    distribution,
    distributionSource: located.source,
    host,
    port,
    overlayFile,
    hostOptions: {
      nodeBinary: useExternalNode ? /** @type {string} */ (externalNode) : electronBinary,
      electronAsNode: !useExternalNode,
      binJs: distribution.binJs,
      profile: DSH_PROFILE,
      patches,
      host,
      port,
      cwd: dirs.hostCwd,
      env: hostEnv,
      logFile: path.join(dirs.logs, 'dsh-host.log'),
      pidFile: path.join(dirs.run, 'dsh-host.json'),
    },
  };
}

module.exports = { planLaunch, parsePort };
