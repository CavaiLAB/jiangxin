'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { isOurHostProcess, readProcessInfo } = require('../src/host');

// 打好的应用包路径里有中文应用名。C 语言环境下 ps 会把中文转义成下面这个样子（照真实输出的转义写的）。
const BIN_JS = '/Applications/匠心工业智能体平台.app/Contents/Resources/runtime/node_modules/@deepseek-ai/dsh/lib/bin.js';
const ESCAPED_COMMAND = '/Applications/M-eM^L\\240M-eM-?M^C.app/Contents/MacOS/M-eM^L\\240M-eM-?M^C --expose-internals '
  + '/Applications/M-eM^L\\240M-eM-?M^C.app/Contents/Resources/runtime/node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --host 127.0.0.1 --port 3182 --no-open';
const LSTART = 'Fri Nov 20 07:08:09 2026';

test('认得出自己上次起的 DSH：路径里的中文被 ps 转义了也认得出', () => {
  assert.equal(isOurHostProcess({ record: { pid: 4242, lstart: LSTART }, info: { lstart: LSTART, command: ESCAPED_COMMAND }, binJs: BIN_JS }), true);
});

test('进程号被别的程序复用了（启动时间对不上）：不认，不会去杀它', () => {
  assert.equal(
    isOurHostProcess({ record: { pid: 4242, lstart: LSTART }, info: { lstart: 'Fri Nov 20 09:30:00 2026', command: ESCAPED_COMMAND }, binJs: BIN_JS }),
    false,
  );
});

test('启动时间碰巧一样但命令行不是 DSH：不认', () => {
  assert.equal(
    isOurHostProcess({ record: { pid: 4242, lstart: LSTART }, info: { lstart: LSTART, command: '/usr/bin/some-other-program --port 3182' }, binJs: BIN_JS }),
    false,
  );
});

test('旧格式的记录没有启动时间：只凭命令行里的 DSH 入口认', () => {
  assert.equal(isOurHostProcess({ record: { pid: 4242 }, info: { lstart: LSTART, command: ESCAPED_COMMAND }, binJs: BIN_JS }), true);
});

test('进程已经不在了，或者记录读不出来：不认', () => {
  assert.equal(isOurHostProcess({ record: { pid: 4242, lstart: LSTART }, info: undefined, binJs: BIN_JS }), false);
  assert.equal(isOurHostProcess({ record: undefined, info: { lstart: LSTART, command: ESCAPED_COMMAND }, binJs: BIN_JS }), false);
});

test('入口文件不在 node_modules 下（认不出标记）：宁可不认', () => {
  assert.equal(isOurHostProcess({ record: { pid: 4242, lstart: LSTART }, info: { lstart: LSTART, command: '/opt/dsh/bin.js' }, binJs: '/opt/dsh/bin.js' }), false);
});

test('能读到当前进程的启动时间和命令行；不存在的进程读不到', () => {
  const info = readProcessInfo(process.pid);
  assert.ok(info !== undefined);
  assert.match(info.lstart, /^\w{3} \w{3} +\d+ \d\d:\d\d:\d\d \d{4}$/);
  assert.ok(info.command.length > 0);
  // 进程号上限远小于这个数。
  assert.equal(readProcessInfo(2 ** 30), undefined);
});
