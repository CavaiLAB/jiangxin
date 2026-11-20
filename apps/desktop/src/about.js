'use strict';

/* 关于窗口的页面脚本。信息全部来自主进程（window.jxAbout.info()）。 */

(async () => {
  const info = await window.jxAbout.info();
  document.title = `关于${info.productName}`;
  document.getElementById('name').textContent = info.productName;
  document.getElementById('version').textContent = info.version;

  const channel = document.getElementById('channel');
  channel.textContent = info.versionChannel;
  if (info.versionChannel === '测试版') channel.classList.add('beta');
  // 没注入版本号时，版本一栏本身就写着「本地开发」，不用再重复一个标签。
  channel.hidden = !info.versionInjected;

  document.getElementById('built-on').textContent = `基于 DSH ${info.dshVersion} 构建`;
  document.getElementById('runtime').textContent =
    `Electron ${info.electron} · Chromium ${info.chrome} · Node ${info.node} · ${info.platform}`;
  document.getElementById('license').textContent = info.dshLicense;

  const button = document.getElementById('open-licenses');
  button.hidden = !info.hasLicensesDir;
  button.addEventListener('click', () => { void window.jxAbout.openLicenses(); });

  // 给自检用：页面内容已经填好。
  document.documentElement.dataset.ready = 'true';
})();
