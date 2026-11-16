import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRepoFileUrl, rewriteLinks, rewriteUrl, sitePathOf } from './site-map.ts';
import type { RepoFile, RewriteContext } from './site-map.ts';

const frameworks = ['kun', 'qian', 'sanyuan-agent'];
const PIN = '0123456789abcdef0123456789abcdef01234567';

function context(existing: string[] = []): RewriteContext {
  return {
    frameworks,
    exists: (sitePath) => existing.includes(sitePath),
    refOf: (repo) => (repo === 'jiangxin' ? 'main' : PIN),
  };
}

test('仓库里的文件对应到站点里的路径', () => {
  assert.equal(sitePathOf({ repo: 'jiangxin', path: 'README.md' }, frameworks), 'index.md');
  assert.equal(sitePathOf({ repo: 'jiangxin', path: 'docs/02-architecture.md' }, frameworks), '02-architecture.md');
  assert.equal(sitePathOf({ repo: 'jiangxin', path: 'docs/decisions/2026-11-17-platform.md' }, frameworks), 'decisions/2026-11-17-platform.md');
  assert.equal(sitePathOf({ repo: 'kun', path: 'README.md' }, frameworks), 'frameworks/kun/index.md');
  assert.equal(sitePathOf({ repo: 'kun', path: 'docs/migration.md' }, frameworks), 'frameworks/kun/migration.md');
  assert.equal(sitePathOf({ repo: 'kun', path: 'docs/img/layers.png' }, frameworks), 'frameworks/kun/img/layers.png');
});

test('不进站点的文件没有站点路径', () => {
  assert.equal(sitePathOf({ repo: 'jiangxin', path: 'AGENTS.md' }, frameworks), null);
  assert.equal(sitePathOf({ repo: 'kun', path: 'src/Kun.Core/Foo.cs' }, frameworks), null);
  assert.equal(sitePathOf({ repo: 'kun', path: 'docs/' }, frameworks), null);
  assert.equal(sitePathOf({ repo: 'iclaw', path: 'README.md' }, frameworks), null);
});

test('认出指向本组织仓库主干上文件的 GitHub 地址', () => {
  assert.deepEqual(parseRepoFileUrl('https://github.com/CavaiLAB/kun/blob/main/docs/migration.md'), {
    repo: 'kun',
    path: 'docs/migration.md',
    hash: '',
  });
  assert.deepEqual(parseRepoFileUrl('https://github.com/CavaiLAB/jiangxin/blob/main/docs/02-architecture.md#7-契约'), {
    repo: 'jiangxin',
    path: 'docs/02-architecture.md',
    hash: '#7-契约',
  });
  assert.equal(
    parseRepoFileUrl(`https://github.com/CavaiLAB/kun/blob/${PIN}/docs/migration.md`),
    null,
    '写了提交号的地址指的是那个版本，不换成站内的',
  );
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/kun'), null);
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/kun/tree/main/docs'), null);
  assert.equal(parseRepoFileUrl('https://github.com/CavaiLAB/kun/blob/main/README.md?plain=1'), null);
  assert.equal(parseRepoFileUrl('https://github.com/idadawn/kun/blob/main/README.md'), null);
});

test('框架仓库的 README 里的链接', () => {
  const from: RepoFile = { repo: 'kun', path: 'README.md' };
  const ctx = context(['glossary.md']);
  assert.equal(rewriteUrl('docs/migration.md', from, ctx), 'migration.md');
  assert.equal(rewriteUrl('docs/architecture.md#3-分层', from, ctx), 'architecture.md#3-分层');
  assert.equal(rewriteUrl('AGENTS.md', from, ctx), `https://github.com/CavaiLAB/kun/blob/${PIN}/AGENTS.md`);
  assert.equal(rewriteUrl('https://github.com/CavaiLAB/jiangxin/blob/main/docs/glossary.md', from, ctx), '../../glossary.md');
});

test('框架仓库 docs/ 里的链接', () => {
  const from: RepoFile = { repo: 'kun', path: 'docs/architecture.md' };
  const ctx = context(['frameworks/qian/index.md']);
  assert.equal(rewriteUrl('migration.md', from, ctx), 'migration.md', '同目录的页面写法不变');
  assert.equal(rewriteUrl('../README.md', from, ctx), 'index.md');
  assert.equal(rewriteUrl('../AGENTS.md', from, ctx), `https://github.com/CavaiLAB/kun/blob/${PIN}/AGENTS.md`);
  assert.equal(rewriteUrl('/docs/migration.md', from, ctx), 'migration.md', '以 / 开头的相对仓库根目录');
  assert.equal(rewriteUrl('https://github.com/CavaiLAB/qian/blob/main/README.md', from, ctx), '../qian/index.md');
});

test('本仓库 README 里的链接', () => {
  const from: RepoFile = { repo: 'jiangxin', path: 'README.md' };
  const ctx = context(['frameworks/kun/migration.md']);
  assert.equal(rewriteUrl('docs/02-architecture.md#7-契约', from, ctx), '02-architecture.md#7-契约');
  assert.equal(rewriteUrl('docs/decisions/2026-11-17-platform.md', from, ctx), 'decisions/2026-11-17-platform.md');
  assert.equal(rewriteUrl('AGENTS.md', from, ctx), 'https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md');
  assert.equal(rewriteUrl('https://github.com/CavaiLAB/kun/blob/main/docs/migration.md', from, ctx), 'frameworks/kun/migration.md');
});

test('不动的链接', () => {
  const from: RepoFile = { repo: 'kun', path: 'README.md' };
  const ctx = context();
  assert.equal(rewriteUrl('#现状', from, ctx), null);
  assert.equal(rewriteUrl('https://github.com/CavaiLAB/jiangxin', from, ctx), null, '指向仓库本身的地址');
  assert.equal(rewriteUrl('https://github.com/idadawn/kun', from, ctx), null);
  assert.equal(rewriteUrl('mailto:someone@example.com', from, ctx), null);
  assert.equal(rewriteUrl('../elsewhere/x.md', from, ctx), null, '指到仓库外面');
  assert.equal(rewriteUrl('docs/migration.md?plain=1', from, ctx), null, '带查询串');
  assert.equal(
    rewriteUrl('https://github.com/CavaiLAB/qian/blob/main/docs/missing.md', from, ctx),
    null,
    '完整地址指向的文档不在站点里，仍然去 GitHub',
  );
  assert.equal(
    rewriteUrl('https://github.com/CavaiLAB/qian/blob/main/AGENTS.md', from, ctx),
    null,
    '完整地址指向不进站点的文件',
  );
});

test('相对链接指向不存在的页面时照样改写，让构建去报死链', () => {
  assert.equal(rewriteUrl('docs/missing.md', { repo: 'kun', path: 'README.md' }, context()), 'missing.md');
});

test('图片：docs/ 下的跟着走，别处的报错', () => {
  const from: RepoFile = { repo: 'kun', path: 'README.md' };
  assert.equal(rewriteUrl('docs/img/layers.png', from, context(), 'image'), 'img/layers.png');
  assert.equal(rewriteUrl('https://example.com/a.png', from, context(), 'image'), null);
  assert.throws(() => rewriteUrl('assets/logo.png', from, context(), 'image'), /带不进站点/);
});

test('不进站点的文件不该拿来改写', () => {
  assert.throws(() => rewriteUrl('README.md', { repo: 'kun', path: 'AGENTS.md' }, context()), /不进站点/);
});

test('只改链接地址，其余原样', () => {
  const source = [
    '# 标题',
    '',
    '见[迁移](docs/migration.md "迁移与归并")与 [架构](docs/architecture.md#3-分层)。',
    '',
    '| 文档 | 说明 |',
    '|---|---|',
    '| [迁移](docs/migration.md) | 表格里的链接 |',
    '',
    '行内代码 `[不是链接](docs/migration.md)` 不动。',
    '',
    '```text',
    '[代码块里的](docs/migration.md)',
    '```',
    '',
    '![分层](docs/img/layers.png)',
    '',
    '[![分层](docs/img/layers.png)](docs/architecture.md)',
    '',
    '直接写出来的地址不动：<https://github.com/CavaiLAB/kun/blob/main/docs/migration.md>',
    '',
    '[参考式][m]',
    '',
    '[m]: docs/migration.md',
    '',
  ].join('\n');

  const from: RepoFile = { repo: 'kun', path: 'README.md' };
  const result = rewriteLinks(source, (url, kind) => rewriteUrl(url, from, context(), kind));

  assert.equal(
    result,
    [
      '# 标题',
      '',
      '见[迁移](migration.md "迁移与归并")与 [架构](architecture.md#3-分层)。',
      '',
      '| 文档 | 说明 |',
      '|---|---|',
      '| [迁移](migration.md) | 表格里的链接 |',
      '',
      '行内代码 `[不是链接](docs/migration.md)` 不动。',
      '',
      '```text',
      '[代码块里的](docs/migration.md)',
      '```',
      '',
      '![分层](img/layers.png)',
      '',
      '[![分层](img/layers.png)](architecture.md)',
      '',
      '直接写出来的地址不动：<https://github.com/CavaiLAB/kun/blob/main/docs/migration.md>',
      '',
      '[参考式][m]',
      '',
      '[m]: migration.md',
      '',
    ].join('\n'),
  );
});

test('没有要改的链接时原文不变', () => {
  const source = '见 [总览](https://github.com/CavaiLAB/jiangxin) 与 [本页](#现状)。\n';
  assert.equal(rewriteLinks(source, () => null), source);
});
