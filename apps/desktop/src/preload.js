'use strict';

/**
 * 主窗口的预加载脚本（沙箱里跑，只能用 electron 的一小部分）。
 *
 * 只暴露几项只读信息，给品牌包（packages/brand-theme）显示版本用。
 * 客户端版本来自主进程的 app.getVersion()，经启动参数交过来；
 * 不拿 Electron 自己的版本号冒充客户端版本。
 *
 * 注意：这里有意不去模仿上游桌面壳的预加载对象（dshDesktop 等）。那是上游内部接口，
 * 半套模仿会让 Web 客户端误以为自己在上游桌面壳里。
 */

const { contextBridge } = require('electron');

/**
 * @param {string} prefix
 * @returns {string | undefined}
 */
function readArg(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

contextBridge.exposeInMainWorld('jiangxinDesktop', Object.freeze({
  /** 壳的种类：thin 表示薄壳（窗口里装的是 DSH 的 Web 界面）。 */
  shell: 'thin',
  platform: process.platform,
  /** app.getVersion() 的原值。没注入产品版本号时是包自己的内部版本号。 */
  appVersion: readArg('--jx-app-version='),
  /** 给人看的版本：合规的产品版本号，或者「本地开发」。 */
  displayVersion: readArg('--jx-display-version='),
  /** 里面跑的 DSH 版本。 */
  dshVersion: readArg('--jx-dsh-version='),
}));
