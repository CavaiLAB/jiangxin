'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { contextMenuTemplate } = require('../src/context-menu');

const labels = (/** @type {ReturnType<typeof contextMenuTemplate>} */ template) =>
  template.flatMap((item) => (item.label === undefined ? [] : [item.label]));

test('可编辑区域：给撤销、重做、剪切、拷贝、粘贴、全选，按当时能不能做置灰', () => {
  const template = contextMenuTemplate({
    isEditable: true,
    selectionText: '',
    editFlags: { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: true, canSelectAll: true },
  });
  assert.deepEqual(labels(template), ['撤销', '重做', '剪切', '拷贝', '粘贴', '全选']);
  const enabled = Object.fromEntries(template.filter((item) => item.role !== undefined).map((item) => [item.role, item.enabled]));
  assert.deepEqual(enabled, { undo: false, redo: false, cut: false, copy: false, paste: true, selectAll: true });
});

test('可编辑区域：菜单项都带 role，交给系统执行，不自己实现剪贴板', () => {
  const template = contextMenuTemplate({ isEditable: true, selectionText: '选中的字', editFlags: { canCut: true, canCopy: true } });
  for (const item of template) {
    assert.ok(item.type === 'separator' || typeof item.role === 'string');
  }
});

test('选中了只读文字：只给拷贝', () => {
  const template = contextMenuTemplate({ isEditable: false, selectionText: '回复里的一段话', editFlags: { canCopy: true } });
  assert.deepEqual(template, [{ role: 'copy', label: '拷贝', enabled: true }]);
});

test('没有选中文字、也不可编辑：不弹（留给界面自己的菜单）', () => {
  assert.deepEqual(contextMenuTemplate({ isEditable: false, selectionText: '', editFlags: {} }), []);
  assert.deepEqual(contextMenuTemplate({ isEditable: false, selectionText: '' }), []);
});
