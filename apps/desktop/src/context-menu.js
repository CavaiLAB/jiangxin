'use strict';

/**
 * 右键菜单的内容（纯函数，不依赖 Electron，方便测试）。
 *
 * 为什么要有：浏览器自带右键菜单，Electron 的窗口默认什么都不弹。DSH 的界面是按浏览器设计的，
 * 会话、文件、图片上的菜单它自己画，但输入框里的「剪切、拷贝、粘贴」靠的是浏览器那一份，放进壳里就没了。
 *
 * 做法和上游桌面壳一致（apps/desktop/src/main.ts 的 context-menu 处理）：
 *   - 可编辑区域：撤销、重做、剪切、拷贝、粘贴、全选，按当时能不能做置灰；
 *   - 选中了只读文字：只给拷贝；
 *   - 其他地方：不弹（留给界面自己的菜单）。
 */

/**
 * @typedef {object} ContextMenuParams Electron 的 context-menu 事件参数里用到的几项
 * @property {boolean} isEditable
 * @property {string} selectionText
 * @property {{ canUndo?: boolean, canRedo?: boolean, canCut?: boolean, canCopy?: boolean, canPaste?: boolean, canSelectAll?: boolean }} [editFlags]
 */

/**
 * @param {ContextMenuParams} params
 * @returns {Array<{ role?: string, label?: string, enabled?: boolean, type?: 'separator' }>} 空数组表示不弹
 */
function contextMenuTemplate(params) {
  const flags = params.editFlags ?? {};
  if (params.isEditable) {
    return [
      { role: 'undo', label: '撤销', enabled: flags.canUndo === true },
      { role: 'redo', label: '重做', enabled: flags.canRedo === true },
      { type: 'separator' },
      { role: 'cut', label: '剪切', enabled: flags.canCut === true },
      { role: 'copy', label: '拷贝', enabled: flags.canCopy === true },
      { role: 'paste', label: '粘贴', enabled: flags.canPaste === true },
      { type: 'separator' },
      { role: 'selectAll', label: '全选', enabled: flags.canSelectAll === true },
    ];
  }
  if (typeof params.selectionText === 'string' && params.selectionText.length > 0) {
    return [{ role: 'copy', label: '拷贝', enabled: flags.canCopy !== false }];
  }
  return [];
}

module.exports = { contextMenuTemplate };
