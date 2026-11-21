'use strict';

/* 启动页的页面脚本：状态由地址里的参数给出（state=starting|failed、name、message）。 */

(() => {
  const params = new URLSearchParams(location.search);
  const name = params.get('name') ?? '';
  document.getElementById('name').textContent = name;
  if (params.get('state') === 'failed') {
    document.title = `${name} 无法启动`;
    document.getElementById('status').textContent = '没能启动。可以从菜单「帮助 → 打开日志目录」查看日志。';
    document.getElementById('bar').hidden = true;
    const detail = document.getElementById('detail');
    detail.textContent = params.get('message') ?? '';
    detail.hidden = detail.textContent === '';
  } else {
    document.title = `${name} 正在启动`;
  }
})();
