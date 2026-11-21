'use strict';

/**
 * 应用菜单。全部用中文标签；带 role 的项保留系统行为和快捷键。
 *
 * 和上游桌面壳的菜单相比，这里有意没有：检查更新、管理 dsh 命令（还不做自动更新，不往系统路径装命令行）。
 */

const { Menu } = require('electron');

/**
 * @param {object} input
 * @param {string} input.productName
 * @param {() => void} input.showAbout
 * @param {() => void} input.openLogs
 * @param {() => void} input.quit
 * @returns {Electron.Menu}
 */
function buildMenu({ productName, showAbout, openLogs, quit }) {
  const darwin = process.platform === 'darwin';

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const appMenu = [
    { label: `关于${productName}`, click: showAbout },
    { type: 'separator' },
    ...(darwin
      ? /** @type {Electron.MenuItemConstructorOptions[]} */ ([
        { role: 'hide', label: `隐藏${productName}` },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
      ])
      : []),
    // 不用 role: 'quit'：退出前要先把 DSH 停干净，所以走壳自己的退出流程。
    { label: darwin ? `退出${productName}` : '退出', accelerator: darwin ? 'Command+Q' : 'Ctrl+Q', click: quit },
  ];

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    // macOS 上第一个菜单的标题由系统取应用名（打包后是产品全称），这里的 label 只在其他平台生效。
    { label: productName, submenu: appMenu },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '拷贝' },
        { role: 'paste', label: '粘贴' },
        { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
        { role: 'delete', label: '删除' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '显示',
      submenu: [
        { role: 'reload', label: '重新载入' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '窗口',
      role: 'window',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(darwin
          ? /** @type {Electron.MenuItemConstructorOptions[]} */ ([{ type: 'separator' }, { role: 'front', label: '前置全部窗口' }])
          : []),
      ],
    },
    {
      label: '帮助',
      role: 'help',
      submenu: [
        { label: '打开日志目录', click: openLogs },
        ...(darwin ? [] : /** @type {Electron.MenuItemConstructorOptions[]} */ ([{ label: `关于${productName}`, click: showAbout }])),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
