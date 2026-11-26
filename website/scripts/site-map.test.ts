import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { remarkRepoLinks } from './remark-repo-links.ts';
import { missingFromMeta, parseRepoFileUrl, rewriteLinks, rewriteReadmeUrl, sitePathOf } from './site-map.ts';

const PIN = '0123456789abcdef0123456789abcdef01234567';

/** 站点文档根目录下有这些文件 */
function existing(files: string[] = []): (sitePath: string) => boolean {
  return (sitePath) => files.includes(sitePath);
}

test('仓库里的文件对应到站点里的路径', () => {
  assert.equal(sitePathOf('README.md'), 'index.md');
  assert.equal(sitePathOf('docs/04-architecture.md'), '04-architecture.md');
  assert.equal(sitePathOf('docs/decisions/2026-11-17-platform.md'), 'decisions/2026-11-17-platform.md');
  assert.equal(sitePathOf('docs/_images/office.png'), '_images/office.png');
});

test('不进站点的文件没有站点路径', () => {
  assert.equal(sitePathOf('AGENTS.md'), null);
  assert.equal(sitePathOf('distribution/README.md'), null);
  assert.equal(sitePathOf('docs/'), null);
});

test('认出指向本仓库主干上文件的 GitHub 地址', () => {
  assert.deepEqual(parseRepoFileUrl('https://github.com/CavaiLAB/jiangxin/blob/main/README.md'), { path: 'README.md', hash: '' });
  assert.deepEqual(parseRepoFileUrl('https://github.com/CavaiLAB/jiangxin/blob/main/docs/04-architecture.md#7-契约'), {
    path: 'docs/04-architecture.md',
    hash: '#7-契约',
  });
  assert.deepEqual(parseRepoFileUrl('https://github.com/CavaiLAB/jiangxin/blob/main/docs/%E6%9C%AF%E8%AF%AD.md'), {
    path: 'docs/术语.md',
    hash: '',
  });
  assert.equal(
    parseRepoFileUrl(`https://github.com/CavaiLAB/jiangxin/blob/${PIN}/README.md`),
    null,
    '写了提交号的地址指的是那个版本，不换成站内的',
  );
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/jiangxin'), null);
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/jiangxin/tree/main/docs'), null);
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/jiangxin/blob/main/README.md?plain=1'), null);
  assert.equal(parseRepoFileUrl('https://githubxcom/CavaiLAB/jiangxin/blob/main/README.md'), null, '地址里的点只认点');
});

test('别的仓库的地址认不出，照常去 GitHub', () => {
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/kun/blob/main/README.md'), null);
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/kun/blob/main/docs/migration.md'), null);
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/qian/blob/main/docs/migration.md'), null);
  assert.equal(parseRepoFileUrl('https://github.com/example/jiangxin/blob/main/README.md'), null);
});

test('README 里的链接', () => {
  const exists = existing();
  assert.equal(rewriteReadmeUrl('docs/04-architecture.md#7-契约', exists), '04-architecture.md#7-契约');
  assert.equal(rewriteReadmeUrl('docs/decisions/2026-11-17-platform.md', exists), 'decisions/2026-11-17-platform.md');
  assert.equal(rewriteReadmeUrl('./docs/glossary.md', exists), 'glossary.md');
  assert.equal(rewriteReadmeUrl('/docs/glossary.md', exists), 'glossary.md', '以 / 开头的相对仓库根目录');
  assert.equal(rewriteReadmeUrl('AGENTS.md', exists), 'https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md');
  assert.equal(
    rewriteReadmeUrl('distribution/README.md#升级-dsh', exists),
    'https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md#升级-dsh',
  );
  assert.equal(
    rewriteReadmeUrl('docs/_meta.json', exists),
    'https://github.com/CavaiLAB/jiangxin/blob/main/docs/_meta.json',
    'docs/ 下不是页面的文件去 GitHub',
  );
});

test('README 里指向本仓库的完整地址：站点里有这一页才改成站内的', () => {
  const exists = existing(['glossary.md', 'index.md']);
  assert.equal(rewriteReadmeUrl('https://github.com/CavaiLAB/jiangxin/blob/main/docs/glossary.md#d', exists), 'glossary.md#d');
  assert.equal(rewriteReadmeUrl('https://github.com/CavaiLAB/jiangxin/blob/main/README.md', exists), 'index.md');
  assert.equal(rewriteReadmeUrl('https://github.com/CavaiLAB/jiangxin/blob/main/docs/missing.md', exists), null);
  assert.equal(rewriteReadmeUrl('https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md', exists), null);
});

test('不动的链接', () => {
  const exists = existing(['index.md', 'migration.md', 'frameworks/kun/migration.md']);
  assert.equal(rewriteReadmeUrl('#现状', exists), null);
  assert.equal(rewriteReadmeUrl('', exists), null);
  assert.equal(rewriteReadmeUrl('https://github.com/CavaiLAB/jiangxin', exists), null, '指向仓库本身的地址');
  assert.equal(rewriteReadmeUrl('https://github.com/CavaiLAB/kun/blob/main/README.md', exists), null, '别的仓库的 README');
  assert.equal(
    rewriteReadmeUrl('https://github.com/CavaiLAB/kun/blob/main/docs/migration.md', exists),
    null,
    '别的仓库的文档，站点里有同名的页面也不改',
  );
  assert.equal(rewriteReadmeUrl('https://example.com/a', exists), null);
  assert.equal(rewriteReadmeUrl('mailto:someone@example.com', exists), null);
  assert.equal(rewriteReadmeUrl('//example.com/a', exists), null);
  assert.equal(rewriteReadmeUrl('../elsewhere/x.md', exists), null, '指到仓库外面');
  assert.equal(rewriteReadmeUrl('docs/glossary.md?plain=1', exists), null, '带查询串');
});

test('相对链接指向不存在的页面时照样改写，让构建去报死链', () => {
  assert.equal(rewriteReadmeUrl('docs/missing.md', existing()), 'missing.md');
});

test('图片：docs/ 下的跟着走，别处的报错', () => {
  assert.equal(rewriteReadmeUrl('docs/_images/office.png', existing(), 'image'), './_images/office.png', '带上 ./，不然打包器当成包名');
  assert.equal(rewriteReadmeUrl('https://example.com/a.png', existing(), 'image'), null);
  assert.equal(rewriteReadmeUrl('https://github.com/CavaiLAB/jiangxin/blob/main/docs/_images/office.png', existing(), 'image'), null);
  assert.throws(() => rewriteReadmeUrl('brand/logo.png', existing(), 'image'), /带不进站点/);
});

test('只改链接地址，其余原样', () => {
  const source = [
    '# 标题',
    '',
    '见[术语](docs/glossary.md "名字与术语")与 [架构](docs/04-architecture.md#7-契约)。',
    '',
    '| 文档 | 说明 |',
    '|---|---|',
    '| [术语](docs/glossary.md) | 表格里的链接 |',
    '',
    '行内代码 `[不是链接](docs/glossary.md)` 不动。',
    '',
    '```text',
    '[代码块里的](docs/glossary.md)',
    '```',
    '',
    '![办公](docs/_images/office.png)',
    '',
    '[![办公](docs/_images/office.png)](docs/04-architecture.md)',
    '',
    '直接写出来的地址不动：<https://github.com/CavaiLAB/jiangxin/blob/main/docs/glossary.md>',
    '',
    '别的仓库：[Kun](https://github.com/CavaiLAB/kun/blob/main/README.md)',
    '',
    '[参考式][g]',
    '',
    '[g]: docs/glossary.md',
    '',
  ].join('\n');

  const result = rewriteLinks(source, (url, kind) => rewriteReadmeUrl(url, existing(), kind));

  assert.equal(
    result,
    [
      '# 标题',
      '',
      '见[术语](glossary.md "名字与术语")与 [架构](04-architecture.md#7-契约)。',
      '',
      '| 文档 | 说明 |',
      '|---|---|',
      '| [术语](glossary.md) | 表格里的链接 |',
      '',
      '行内代码 `[不是链接](docs/glossary.md)` 不动。',
      '',
      '```text',
      '[代码块里的](docs/glossary.md)',
      '```',
      '',
      '![办公](./_images/office.png)',
      '',
      '[![办公](./_images/office.png)](04-architecture.md)',
      '',
      '直接写出来的地址不动：<https://github.com/CavaiLAB/jiangxin/blob/main/docs/glossary.md>',
      '',
      '别的仓库：[Kun](https://github.com/CavaiLAB/kun/blob/main/README.md)',
      '',
      '[参考式][g]',
      '',
      '[g]: glossary.md',
      '',
    ].join('\n'),
  );
});

test('没有要改的链接时原文不变', () => {
  const source = '见 [总览](https://github.com/CavaiLAB/jiangxin) 与 [本页](#现状)。\n';
  assert.equal(rewriteLinks(source, () => null), source);
});

// ---------- 构建时改写 docs/ 里的完整地址 ----------

test('docs/ 里指向本仓库文档的完整地址改成站内的，别的仓库的地址不动', () => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-links-'));
  try {
    for (const file of ['index.md', '04-architecture.md', 'frameworks/kun/index.md', 'frameworks/kun/migration.md']) {
      fs.mkdirSync(path.dirname(path.join(docsDir, file)), { recursive: true });
      fs.writeFileSync(path.join(docsDir, file), '# 标题\n');
    }
    const cases: [string, string][] = [
      ['https://github.com/CavaiLAB/jiangxin/blob/main/README.md', '/index.html'],
      ['https://github.com/CavaiLAB/jiangxin/blob/main/docs/04-architecture.md#2-分工', '/04-architecture.html#2-分工'],
      ['https://github.com/CavaiLAB/jiangxin/blob/main/docs/99-missing.md', 'https://github.com/CavaiLAB/jiangxin/blob/main/docs/99-missing.md'],
      ['https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md', 'https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md'],
      [`https://github.com/CavaiLAB/jiangxin/blob/${PIN}/README.md`, `https://github.com/CavaiLAB/jiangxin/blob/${PIN}/README.md`],
      // 站点里就算有同名的文件，别的仓库的地址也不改
      ['https://github.com/CavaiLAB/kun/blob/main/README.md', 'https://github.com/CavaiLAB/kun/blob/main/README.md'],
      ['https://github.com/CavaiLAB/kun/blob/main/docs/migration.md', 'https://github.com/CavaiLAB/kun/blob/main/docs/migration.md'],
      ['https://github.com/CavaiLAB/sanyuan-agent/blob/main/docs/sdk.md', 'https://github.com/CavaiLAB/sanyuan-agent/blob/main/docs/sdk.md'],
    ];
    interface Node {
      type: string;
      url?: string;
      children?: Node[];
    }
    const paragraphs: Node[] = cases.map(([url]) => ({ type: 'paragraph', children: [{ type: 'link', url, children: [] }] }));
    const definition: Node = { type: 'definition', url: 'https://github.com/CavaiLAB/jiangxin/blob/main/README.md' };
    remarkRepoLinks({ docsDir })({ type: 'root', children: [...paragraphs, definition] });
    assert.deepEqual(
      paragraphs.map((node) => node.children?.[0]?.url),
      cases.map(([, expected]) => expected),
    );
    assert.equal(definition.url, '/index.html', '参考式链接的定义也改');
  } finally {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
});

// ---------- 侧栏 ----------

test('_meta.json 里漏列的条目', () => {
  const meta = [
    { type: 'file', name: 'index', label: '总览' },
    { type: 'section-header', label: '平台' },
    '01-vision',
    'glossary.md',
    { type: 'dir-section-header', name: 'decisions', label: '决策记录' },
  ];
  assert.deepEqual(missingFromMeta(meta, ['index', '01-vision', 'glossary', 'decisions']), []);
  assert.deepEqual(missingFromMeta(meta, ['index', '01-vision', '04-architecture', 'decisions', 'frameworks']), ['04-architecture', 'frameworks']);
  assert.deepEqual(missingFromMeta([], ['01-vision']), ['01-vision']);
});

test('_meta.json 不是数组时报错', () => {
  assert.throws(() => missingFromMeta({ items: [] }, ['01-vision']), /要是一个数组/);
  assert.throws(() => missingFromMeta(null, []), /要是一个数组/);
});
