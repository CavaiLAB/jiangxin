'use strict';

/**
 * 自检用的界面操作脚本：在窗口里发一条消息，等模型的回复出现在界面上。
 * 用来证明「窗口里是能用的 DSH 界面」：页面 → 壳附上凭据 → 本机 DSH → 模型 → 流式回到页面，这一整条链路是通的。
 * 顺带在输入框上点一次右键，检查壳补的右键菜单（见 src/context-menu.js）。
 *
 * 前提：发行目录里配了一条能用的模型路由，例如仓库的 distribution/ 加本机假模型（tools/mock-model）。
 * 假模型对普通问题回一段固定文字，里面有「本机假模型」几个字。
 *
 * 用法见 README.md 的「验证」一节。由 src/selftest.js 在主进程里调用。
 *
 * 这里按界面上的无障碍标签找元素（中文界面）。标签是上游的界面文案，升级 DSH 后可能要跟着改。
 */

const MESSAGE = '你好，请用一句话介绍你自己。';
const EXPECTED_IN_REPLY = '本机假模型';

/**
 * @param {object} ctx
 * @param {(js: string) => Promise<any>} ctx.exec
 * @param {(expression: string, timeoutMs: number) => Promise<boolean>} ctx.waitFor
 * @param {(name: string) => Promise<unknown>} ctx.capture
 * @param {(ms: number) => Promise<void>} ctx.sleep
 * @param {(method: string, params: object) => Promise<any>} ctx.cdp 调试协议命令
 * @param {(x: number, y: number) => Promise<{ isEditable: boolean, hasSelection: boolean, labels: string[] } | null>} ctx.rightClick
 *   在页面某处点右键，返回壳准备的菜单内容
 */
module.exports = async function chatRoundtrip({ exec, waitFor, capture, sleep, cdp, rightClick }) {
  /** @type {Record<string, unknown>} */
  const result = { message: MESSAGE, expectedInReply: EXPECTED_IN_REPLY };

  // 1. 首次启动会弹「预览版说明」，点「继续」关掉。
  result.dismissedNotice = await exec(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const button = [...dialog.querySelectorAll('button')].find((b) => ['继续', 'Continue'].includes(b.innerText.trim()));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await waitFor(`!document.querySelector('[role="dialog"]')`, 5000);

  // 2. 记下当前选的模型（界面上显示的名字）。
  result.model = await exec(`(() => {
    const button = [...document.querySelectorAll('button')].find((b) => /^(选择模型|Select model)/.test(b.getAttribute('aria-label') ?? ''));
    return button ? button.innerText.trim() : null;
  })()`);

  // 3. 在输入框里打字。输入框是富文本编辑器，直接改 DOM 它不认；
  //    先让输入框得到焦点，再经调试协议输入文字（和输入法上屏走同一条路径）。
  result.focused = await exec(`(() => {
    const box = document.querySelector('[role="textbox"][contenteditable="true"]');
    if (!box) return false;
    box.focus();
    return document.activeElement === box;
  })()`);
  await cdp('Input.insertText', { text: MESSAGE });
  result.typed = await waitFor(
    `document.querySelector('[role="textbox"][contenteditable="true"]')?.innerText.includes(${JSON.stringify(MESSAGE)})`,
    5000,
  );
  const sendSelector = `[...document.querySelectorAll('button')].find((b) => ['发送消息', 'Send message'].includes(b.getAttribute('aria-label') ?? ''))`;
  result.sendEnabled = await waitFor(`(${sendSelector}) && !(${sendSelector}).disabled`, 5000);

  // 3b. 在输入框上点右键：壳应该收到这次右键，并准备好一份编辑菜单（自检时不真的弹出来）。
  const boxCenter = await exec(`(() => {
    const rect = document.querySelector('[role="textbox"][contenteditable="true"]')?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  })()`);
  result.contextMenu = boxCenter === null ? null : await rightClick(boxCenter.x, boxCenter.y);
  const menu = /** @type {{ isEditable: boolean, labels: string[] } | null} */ (result.contextMenu);
  result.contextMenuOk = menu !== null && menu.isEditable === true
    && ['剪切', '拷贝', '粘贴', '全选'].every((label) => menu.labels.includes(label));

  // 4. 发送，等回复。
  result.sent = await exec(`(() => { const b = ${sendSelector}; if (!b || b.disabled) return false; b.click(); return true; })()`);
  result.replyFound = await waitFor(`document.body.innerText.includes(${JSON.stringify(EXPECTED_IN_REPLY)})`, 60_000);
  // 等流式输出收尾、界面稳定下来再截图。
  await sleep(2500);
  result.screenshot = await capture('chat-roundtrip.png');
  result.conversationText = await exec(`(() => {
    const text = document.body.innerText.replace(/\\s+/g, ' ');
    const at = text.indexOf(${JSON.stringify(EXPECTED_IN_REPLY)});
    return at < 0 ? null : text.slice(Math.max(0, at - 60), at + 80);
  })()`);
  result.ok = result.typed === true && result.sent === true && result.replyFound === true && result.contextMenuOk === true;
  return result;
};
