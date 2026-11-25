// 生成站点首页：仓库根目录的 README.md → docs/index.md。
//
// 首页是生成物，不进 git。README 里的链接在生成时改写成站内的相对链接。
// 生成之后检查 docs/_meta.json 列全了 docs/ 顶层的页面。
//
// 用法：
//   node scripts/sync.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingFromMeta, rewriteLinks, rewriteReadmeUrl } from './site-map.ts';

const websiteDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(websiteDir);
const docsDir = path.join(repoRoot, 'docs');
const homePage = path.join(docsDir, 'index.md');

const MARKER = '由 website/scripts/sync.ts 生成，不要直接改';
const PAGE = /\.mdx?$/;

/** 预料之内的失败：只报一句话，不带调用栈。 */
class SyncError extends Error {}

/** docs/index.md 这个名字留给生成物。已经有、又不是生成出来的，就停下。 */
function assertHomePageFree(): void {
  if (fs.existsSync(homePage) && !fs.readFileSync(homePage, 'utf8').includes(MARKER)) {
    throw new SyncError('docs/index.md 不是生成物。站点首页由仓库根目录的 README.md 生成，docs/ 下不能另有 index.md');
  }
}

/**
 * 以前的同步还把别的仓库的文档生成到 docs/frameworks/，取来的原文缓存在 website/.cache/sources/。
 * 本机还留着的就删掉：不删，前一处会被构建进站点，两处都会被 git 当成新文件。
 */
function removeOldOutputs(): void {
  const frameworksDir = path.join(docsDir, 'frameworks');
  const marker = path.join(frameworksDir, '.generated');
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').includes(MARKER)) {
    fs.rmSync(frameworksDir, { recursive: true, force: true });
    console.log('删掉了以前生成的 docs/frameworks/');
  }
  const cacheDir = path.join(websiteDir, '.cache');
  const sourcesCache = path.join(cacheDir, 'sources');
  if (fs.existsSync(sourcesCache)) {
    fs.rmSync(sourcesCache, { recursive: true, force: true });
    if (fs.readdirSync(cacheDir).length === 0) fs.rmdirSync(cacheDir);
    console.log('删掉了以前的缓存 website/.cache/sources/');
  }
}

function generateHomePage(): void {
  // 改写链接时要知道目标在不在站点里。首页这时可能还没生成，但它一定会在
  const exists = (sitePath: string): boolean => sitePath === 'index.md' || fs.existsSync(path.join(docsDir, sitePath));
  let body: string;
  try {
    body = rewriteLinks(fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8'), (url, kind) => rewriteReadmeUrl(url, exists, kind));
  } catch (error) {
    throw new SyncError(`README.md：${(error as Error).message}`);
  }
  // 首页的一级标题就是站点名，浏览器标题里会重复，另给一个页面标题
  const head = body.startsWith('---') ? '' : '---\ntitle: 总览\n---\n\n';
  fs.writeFileSync(homePage, `${head}${body.trimEnd()}\n\n<!-- ${MARKER} -->\n`);
}

/** 一个目录下该出现在侧栏里的条目：页面（不带扩展名）与子目录。以 _ 或 . 开头的和 public 不算。 */
function sidebarEntries(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !/^[_.]/.test(entry.name) && entry.name !== 'public')
    .filter((entry) => entry.isDirectory() || PAGE.test(entry.name))
    .map((entry) => entry.name.replace(PAGE, ''));
}

/** docs/ 顶层的每个页面与目录都要列在 docs/_meta.json 里，没列的不会出现在侧栏。 */
function assertSidebarComplete(): void {
  const entries = sidebarEntries(docsDir);
  let missing: string[];
  try {
    missing = missingFromMeta(JSON.parse(fs.readFileSync(path.join(docsDir, '_meta.json'), 'utf8')), entries);
  } catch (error) {
    throw new SyncError(`docs/_meta.json 读不了：${(error as Error).message}`);
  }
  if (missing.length > 0) {
    throw new SyncError(`docs/_meta.json 里没有列出：${missing.join('、')}。没列出的页面不会出现在侧栏里`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length > 0) throw new SyncError(`不认识的参数：${args.join(' ')}\n用法：node scripts/sync.ts`);

  assertHomePageFree();
  removeOldOutputs();
  generateHomePage();
  assertSidebarComplete();
  console.log('已生成 docs/index.md');
}

try {
  main();
} catch (error) {
  if (!(error instanceof SyncError)) throw error;
  console.error(`同步失败：${error.message}`);
  process.exitCode = 1;
}
