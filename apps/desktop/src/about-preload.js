'use strict';

/** 关于窗口的预加载脚本：只给页面两个调用，取信息、打开许可文件目录。 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jxAbout', Object.freeze({
  info: () => ipcRenderer.invoke('jx-about:info'),
  openLicenses: () => ipcRenderer.invoke('jx-about:open-licenses'),
}));
