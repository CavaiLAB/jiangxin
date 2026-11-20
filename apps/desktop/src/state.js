'use strict';

/**
 * 本机状态目录的解析与隔离检查。不依赖 Electron。
 *
 * 规则：用户的电脑上可能装着自己在用的 DSH（~/.dsh 和它的应用数据）。
 * 壳无论如何不能让 DSH 的状态目录落到默认位置，所以：
 *   - 状态根目录必须显式给出（环境变量、构建时写入的值，或者开发时的 apps/desktop/.dev）；
 *   - 给不出来就拒绝启动，而不是退回到 ~/.dsh 或 ~/Library/Application Support；
 *   - 解析出来的任何目录都不能落在用户那份 DSH 的目录里。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** 状态根目录下各个子目录的用途。 */
const SUBDIRS = Object.freeze({
  /** DSH 的状态目录（DSH_HOME）：profile、会话、设置、凭据。 */
  dshHome: 'dsh-home',
  /** DSH 的共享智能体配置根目录（DSH_AGENTS_HOME，默认是 ~/.agents）。 */
  agentsHome: 'agents-home',
  /** Electron 的用户数据目录：本地存储、缓存、单实例锁。 */
  userData: 'electron-user-data',
  /** 代替系统「文稿」目录：DSH 首次使用时在它下面建默认工作区。 */
  documents: 'documents',
  /** DSH 进程的工作目录。DSH 会读工作目录下的 .env，所以给它一个自己管的空目录。 */
  hostCwd: 'host-cwd',
  /** 壳的日志、DSH 的输出（令牌已隐去）、窗口外联记录。 */
  logs: 'logs',
  /** 壳每次启动时生成的补丁文件。 */
  generated: 'generated',
  /** 运行时文件：DSH 进程的 pid。 */
  run: 'run',
  /** 自检截图。 */
  screenshots: 'screenshots',
});

/**
 * 用户自己那份 DSH 可能用到的目录。只做字符串比较，不去读它们。
 * @param {string} home 用户主目录
 * @returns {string[]}
 */
function forbiddenRoots(home) {
  return [
    path.join(home, '.dsh'),
    path.join(home, '.agents'),
    path.join(home, 'Library', 'Application Support', '@deepseek-ai'),
    path.join(home, 'Library', 'Application Support', 'DeepSeek Harness'),
    path.join(home, 'Documents', 'deepseek-harness'),
  ];
}

/**
 * a 是否等于 b 或在 b 里面。
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isInside(a, b) {
  const relative = path.relative(b, a);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * 确认一个目录不在用户那份 DSH 的目录里，也不是主目录本身。
 * @param {string} dir 绝对路径
 * @param {string} label 报错时用的名字
 * @param {string} [home]
 * @throws {Error}
 */
function assertIsolated(dir, label, home = os.homedir()) {
  if (!path.isAbsolute(dir)) throw new Error(`${label} 必须是绝对路径：${dir}`);
  const resolved = path.resolve(dir);
  if (resolved === path.resolve(home) || resolved === path.parse(resolved).root) {
    throw new Error(`${label} 不能是主目录或根目录：${resolved}`);
  }
  for (const root of forbiddenRoots(home)) {
    if (isInside(resolved, root) || isInside(root, resolved)) {
      throw new Error(`${label} 不能与用户自己的 DSH 目录重叠：${resolved}（与 ${root} 冲突）`);
    }
  }
}

/**
 * 定出状态根目录。
 * @param {object} input
 * @param {Record<string, string | undefined>} input.env 环境变量
 * @param {string} input.envName 状态目录的环境变量名
 * @param {boolean} input.isPackaged 是不是打包后的应用
 * @param {string} input.appDir 开发时是 apps/desktop；打包后不用
 * @param {string | undefined} input.bakedStateRoot 打包时写进应用的状态根目录（只有本机构建才有）
 * @returns {{ root: string, source: 'env' | 'dev' | 'baked' }}
 * @throws {Error} 定不出来时。调用方应当报错退出，不要自己找默认位置。
 */
function resolveStateRoot({ env, envName, isPackaged, appDir, bakedStateRoot }) {
  const fromEnv = env[envName];
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    if (!path.isAbsolute(fromEnv)) throw new Error(`${envName} 必须是绝对路径：${fromEnv}`);
    return { root: path.resolve(fromEnv), source: 'env' };
  }
  if (!isPackaged) return { root: path.join(appDir, '.dev'), source: 'dev' };
  if (typeof bakedStateRoot === 'string' && bakedStateRoot !== '') {
    if (!path.isAbsolute(bakedStateRoot)) throw new Error(`构建时写入的状态目录不是绝对路径：${bakedStateRoot}`);
    return { root: path.resolve(bakedStateRoot), source: 'baked' };
  }
  throw new Error(
    `这个构建没有配置本机状态目录。正式构建的状态目录还没定，这个构建不使用系统默认位置，请设置环境变量 ${envName}（绝对路径）后再启动。`,
  );
}

/**
 * 由状态根目录得到全部子目录，逐个做隔离检查并建好。
 * @param {string} root
 * @param {string} [home]
 * @returns {Record<keyof typeof SUBDIRS, string> & { root: string }}
 */
function prepareStateDirs(root, home = os.homedir()) {
  assertIsolated(root, '状态根目录', home);
  /** @type {Record<string, string>} */
  const dirs = { root };
  for (const [key, name] of Object.entries(SUBDIRS)) {
    const dir = path.join(root, name);
    assertIsolated(dir, name, home);
    fs.mkdirSync(dir, { recursive: true });
    dirs[key] = dir;
  }
  return /** @type {any} */ (dirs);
}

module.exports = { SUBDIRS, forbiddenRoots, isInside, assertIsolated, resolveStateRoot, prepareStateDirs };
