'use strict';

/**
 * 发行目录：一个目录里有 package.json（精确依赖 @deepseek-ai/dsh，加上要装的插件包）、
 * 装好的 node_modules，和 patches/（要叠加的补丁文件，按文件名排序依次叠）。
 * 约定见 distribution/README.md。Web 端的启动脚本和桌面壳都从这样一个目录启动 DSH。
 *
 * 这个文件不依赖 Electron。
 */

const fs = require('node:fs');
const path = require('node:path');

const { DSH_PACKAGE } = require('./config');

/**
 * 定出用哪个发行目录。优先级：
 *   1. 环境变量指定的目录；
 *   2. 打包后：应用里的 Resources/runtime；
 *   3. 开发时：apps/desktop/runtime。
 * @param {object} input
 * @param {Record<string, string | undefined>} input.env
 * @param {string} input.envName
 * @param {boolean} input.isPackaged
 * @param {string} input.resourcesPath 打包后是 process.resourcesPath
 * @param {string} input.appDir 开发时是 apps/desktop
 * @returns {{ dir: string, source: 'env' | 'bundled' | 'dev' }}
 */
function locateDistribution({ env, envName, isPackaged, resourcesPath, appDir }) {
  const fromEnv = env[envName];
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    if (!path.isAbsolute(fromEnv)) throw new Error(`${envName} 必须是绝对路径：${fromEnv}`);
    return { dir: path.resolve(fromEnv), source: 'env' };
  }
  if (isPackaged) return { dir: path.join(resourcesPath, 'runtime'), source: 'bundled' };
  return { dir: path.join(appDir, 'runtime'), source: 'dev' };
}

/**
 * 列出发行目录里要叠加的补丁文件，按文件名排序。
 * 排序用码点顺序而不是本地化排序，保证每台机器上顺序一样。
 * @param {string} distributionDir
 * @returns {string[]} 绝对路径
 */
function listPatches(distributionDir) {
  const patchesDir = path.join(distributionDir, 'patches');
  let entries;
  try {
    entries = fs.readdirSync(patchesDir, { withFileTypes: true });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && /\.ya?ml$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => path.join(patchesDir, name));
}

/**
 * 读发行目录，核对里面的 DSH 是不是清单里钉死的那一版。
 * @param {string} distributionDir
 * @returns {{
 *   dir: string,
 *   binJs: string,
 *   dshVersion: string,
 *   pinnedVersion: string,
 *   patches: string[],
 *   licensePath: string | undefined,
 *   name: string,
 * }}
 * @throws {Error} 目录不完整，或装出来的版本和钉死的不一致
 */
function readDistribution(distributionDir) {
  const manifestPath = path.join(distributionDir, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`发行目录里没有 package.json：${distributionDir}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pinnedVersion = manifest?.dependencies?.[DSH_PACKAGE];
  if (typeof pinnedVersion !== 'string') {
    throw new Error(`发行目录的 package.json 没有依赖 ${DSH_PACKAGE}：${manifestPath}`);
  }
  // 版本钉死：只接受精确版本，不接受范围。
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(pinnedVersion)) {
    throw new Error(`${DSH_PACKAGE} 必须写精确版本，现在是 ${JSON.stringify(pinnedVersion)}：${manifestPath}`);
  }

  const packageDir = path.join(distributionDir, 'node_modules', ...DSH_PACKAGE.split('/'));
  const packageManifestPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageManifestPath)) {
    throw new Error(`发行目录还没有安装依赖（找不到 ${packageManifestPath}）。先在这个目录里装好依赖。`);
  }
  const packageManifest = JSON.parse(fs.readFileSync(packageManifestPath, 'utf8'));
  const dshVersion = packageManifest.version;
  if (dshVersion !== pinnedVersion) {
    throw new Error(`发行目录里装的 DSH 是 ${dshVersion}，清单里钉的是 ${pinnedVersion}。`);
  }

  const bin = typeof packageManifest.bin === 'string' ? packageManifest.bin : packageManifest.bin?.dsh;
  if (typeof bin !== 'string') throw new Error(`${DSH_PACKAGE} 的 package.json 里没有 dsh 命令入口`);
  const binJs = path.join(packageDir, bin);
  if (!fs.existsSync(binJs)) throw new Error(`找不到 dsh 的入口文件：${binJs}`);

  const licensePath = path.join(packageDir, 'LICENSE');
  return {
    dir: distributionDir,
    binJs,
    dshVersion,
    pinnedVersion,
    patches: listPatches(distributionDir),
    licensePath: fs.existsSync(licensePath) ? licensePath : undefined,
    name: typeof manifest.name === 'string' ? manifest.name : path.basename(distributionDir),
  };
}

module.exports = { locateDistribution, listPatches, readDistribution };
