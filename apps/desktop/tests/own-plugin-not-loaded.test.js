'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { OWN_PLUGIN_NOT_LOADED } = require('../src/host');

// 三行都是实测时 DSH 打在标准错误里的原文（截到够用的长度）。
const VERSION_GATE_ROW = 'dsh: disabling profile plugin row "jx-brand-theme": Plugin @jx/brand-theme@0.1.0 is incompatible with dsh 0.2.2-rc.5: requirements {"engines.dsh":"0.2.2-rc.4"}.';
const VERSION_GATE_BUNDLE = 'dsh: skipping profile bundle "@jx/brand-theme": Error: Plugin @jx/brand-theme@0.1.0 is incompatible with dsh 0.2.2-rc.5';
const IMPORT_FAILED = "jx-brand-theme (@jx/brand-theme): failed to import: Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@jx/brand-theme' imported from /state/home/profiles/web/";

test('认出 DSH 没加载我们自己插件的三种告警', () => {
  assert.equal(OWN_PLUGIN_NOT_LOADED.exec(VERSION_GATE_ROW)?.[1], 'jx-brand-theme');
  assert.equal(OWN_PLUGIN_NOT_LOADED.exec(VERSION_GATE_BUNDLE)?.[1], '@jx/brand-theme');
  assert.equal(OWN_PLUGIN_NOT_LOADED.exec(IMPORT_FAILED)?.[2], 'jx-brand-theme');
});

test('DSH 自己的插件被停用不算', () => {
  assert.doesNotMatch('dsh: disabling profile plugin row "ui-brand-official": Plugin x is incompatible with dsh 0.2.2-rc.5', OWN_PLUGIN_NOT_LOADED);
  assert.doesNotMatch('web-search (@deepseek-ai/dsh-web-search): failed to import: Error', OWN_PLUGIN_NOT_LOADED);
  assert.doesNotMatch('dsh web: http://127.0.0.1:3182/?token=abc', OWN_PLUGIN_NOT_LOADED);
});
