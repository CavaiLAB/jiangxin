'use strict';

/**
 * 壳自己的补丁：每次启动时生成，排在发行目录的补丁之后（最后叠，所以壳说了算）。
 * 里面只放「不管用哪个发行目录，桌面壳都必须保证」的设置。不依赖 Electron。
 *
 * 现在只有一条：默认工作区的位置。
 * DSH 首次使用时会在系统「文稿」目录下建 deepseek-harness/default-workspace 并登记成默认工作区
 * （packages/api/workspace-controller/src/default-directory.ts）。这个位置不跟着 DSH_HOME 走，
 * 不改的话，壳起的实例会用到用户自己那份 DSH 的默认工作区。所以壳把「文稿」目录换成自己管的目录。
 *
 * 补丁的规矩：后面的层按行覆盖前面的，而且是把这一行的整个 config 换掉，不是按键合并。
 * workspace-controller 这一行在 0.2.2-rc.5 里没有别的默认配置，所以只写这一个键是安全的；
 * 升级 DSH 时要重新核对这一行多了哪些键。
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {object} input
 * @param {string} input.documentsDir 代替系统「文稿」目录的绝对路径
 * @returns {string} 补丁文件的内容
 */
function renderShellOverlay({ documentsDir }) {
  if (!path.isAbsolute(documentsDir)) throw new Error(`documentsDir 必须是绝对路径：${documentsDir}`);
  return [
    '# 这个文件由桌面壳在每次启动时生成，手改会被覆盖。来源：apps/desktop/src/overlay.js',
    '- id: workspace-controller',
    '  config:',
    // JSON 字符串同时也是合法的 YAML 双引号字符串，路径里有空格或中文也不会出错。
    `    documentsDirectory: ${JSON.stringify(documentsDir)}`,
    '',
  ].join('\n');
}

/**
 * 把壳的补丁写到状态目录里，返回文件路径。
 * @param {object} input
 * @param {string} input.generatedDir
 * @param {string} input.documentsDir
 * @returns {string}
 */
function writeShellOverlay({ generatedDir, documentsDir }) {
  fs.mkdirSync(generatedDir, { recursive: true });
  const file = path.join(generatedDir, 'zz-desktop-shell.yml');
  fs.writeFileSync(file, renderShellOverlay({ documentsDir }));
  return file;
}

module.exports = { renderShellOverlay, writeShellOverlay };
