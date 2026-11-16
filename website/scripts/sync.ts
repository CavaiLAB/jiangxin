// 生成站点里不在 docs/ 下跟踪的那部分内容：
//
//   仓库根目录的 README.md                → docs/index.md              站点首页
//   各框架仓库钉住版本的 README 与 docs/    → docs/frameworks/<仓库>/
//
// 两处都是生成物，不进 git。链接在生成时改写成站内的相对链接。
//
// 用法：
//   node scripts/sync.ts            按 sources.json 钉住的提交生成
//   node scripts/sync.ts --update   先把钉住的提交挪到各仓库 main 的最新提交，再生成

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_REPO, ORG, rewriteLinks, rewriteUrl, sitePathOf } from './site-map.ts';
import type { RepoFile, RewriteContext } from './site-map.ts';
import { readSources, writeSources } from './sources.ts';
import type { Framework } from './sources.ts';

const websiteDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(websiteDir);
const docsDir = path.join(repoRoot, 'docs');
const homePage = path.join(docsDir, 'index.md');
const frameworksDir = path.join(docsDir, 'frameworks');
const frameworksMarker = path.join(frameworksDir, '.generated');
const cacheDir = path.join(websiteDir, '.cache', 'sources');
const sourcesFile = path.join(websiteDir, 'sources.json');

const MARKER = '由 website/scripts/sync.ts 生成，不要直接改';
const PAGE = /\.mdx?$/;

/** 预料之内的失败：只报一句话，不带调用栈。 */
class SyncError extends Error {}

function git(args: string[]): Buffer {
  try {
    return execFileSync('git', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new SyncError(`git ${args.join(' ')} 失败${stderr ? `：${stderr}` : ''}`);
  }
}

/** 各框架仓库的地址前缀。缺省跟着本仓库的 origin 走，克隆本仓库用的是哪种方式，取它们也用哪种。 */
function gitBase(): string {
  const fromEnv = process.env.SOURCES_GIT_BASE;
  if (fromEnv) return /[/:]$/.test(fromEnv) ? fromEnv : `${fromEnv}/`;
  let origin = '';
  try {
    origin = git(['-C', repoRoot, 'remote', 'get-url', 'origin']).toString().trim();
  } catch {
    // 没有 origin 就用缺省地址
  }
  return /^(.*[/:])[^/:]+?(?:\.git)?\/?$/.exec(origin)?.[1] ?? `https://github.com/${ORG}/`;
}

function repoUrl(base: string, repo: string): string {
  return `${base}${repo}.git`;
}

function latestCommit(url: string): string {
  const commit = git(['ls-remote', url, 'refs/heads/main']).toString().split(/\s+/)[0] ?? '';
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new SyncError(`${url} 上没有 main 分支`);
  return commit;
}

/**
 * 取回一个框架仓库在钉住的提交上的 README.md 与 docs/，放进本机缓存，返回缓存目录。
 * 缓存按提交号存放，内容不会变，已经有了就不再联网。
 */
function fetchSource(fw: Framework, base: string): string {
  const repoCache = path.join(cacheDir, fw.repo);
  const dir = path.join(repoCache, fw.commit);
  if (!fs.existsSync(dir)) {
    const url = repoUrl(base, fw.repo);
    fs.mkdirSync(repoCache, { recursive: true });
    const work = fs.mkdtempSync(path.join(repoCache, '.fetch-'));
    try {
      git(['init', '-q', work]);
      try {
        git(['-C', work, 'fetch', '-q', '--depth', '1', url, fw.commit]);
      } catch (error) {
        throw new SyncError(
          `取不到 ${url} 的 ${fw.commit.slice(0, 7)}。确认你对这个仓库有读权限；地址前缀可以用环境变量 SOURCES_GIT_BASE 指定。\n${(error as Error).message}`,
        );
      }
      // 每一项：<模式> <类型> <对象>\t<路径>。只要普通文件，符号链接与子模块不取
      const files = git(['-C', work, 'ls-tree', '-r', '-z', 'FETCH_HEAD', '--', 'README.md', 'docs'])
        .toString()
        .split('\0')
        .filter((entry) => entry.startsWith('100'))
        .map((entry) => entry.slice(entry.indexOf('\t') + 1));
      if (!files.includes('README.md')) throw new SyncError(`${fw.repo} 在 ${fw.commit.slice(0, 7)} 上没有 README.md`);
      const staging = path.join(work, 'tree');
      for (const file of files) {
        const out = path.join(staging, file);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, git(['-C', work, 'show', `FETCH_HEAD:${file}`]));
      }
      fs.renameSync(staging, dir);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
  // 只留当前钉住的那一份。别的同步进程正在取的临时目录不碰
  for (const name of fs.readdirSync(repoCache)) {
    if (/^[0-9a-f]{40}$/.test(name) && name !== fw.commit) fs.rmSync(path.join(repoCache, name), { recursive: true, force: true });
  }
  return dir;
}

function listFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

/** docs/index.md 与 docs/frameworks/ 这两个名字留给生成物。已经有、又不是生成出来的，就停下。 */
function assertReservedNamesFree(): void {
  if (fs.existsSync(homePage) && !fs.readFileSync(homePage, 'utf8').includes(MARKER)) {
    throw new SyncError('docs/index.md 不是生成物。站点首页由仓库根目录的 README.md 生成，docs/ 下不能另有 index.md');
  }
  if (fs.existsSync(frameworksDir) && !fs.existsSync(frameworksMarker)) {
    throw new SyncError('docs/frameworks/ 不是生成物。这个目录名留给从各框架仓库取来的文档');
  }
}

interface Output {
  /** 取自哪个仓库的哪个文件 */
  from: RepoFile;
  /** 本机上的来源文件 */
  source: string;
  /** 写到站点文档根目录下的哪个相对路径 */
  target: string;
}

function generate(frameworks: Framework[], trees: Map<string, string>): void {
  const names = frameworks.map((fw) => fw.repo);
  const commits = new Map(frameworks.map((fw) => [fw.repo, fw.commit]));

  // 先定下会生成哪些文件：改写链接时要知道目标在不在站点里
  const outputs: Output[] = [
    { from: { repo: HOME_REPO, path: 'README.md' }, source: path.join(repoRoot, 'README.md'), target: 'index.md' },
  ];
  for (const fw of frameworks) {
    const tree = trees.get(fw.repo);
    if (tree === undefined) throw new Error(`没有取到 ${fw.repo}`);
    for (const file of listFiles(tree)) {
      const from = { repo: fw.repo, path: file };
      const target = sitePathOf(from, names);
      if (target === null) continue;
      if (outputs.some((other) => other.target === target)) {
        throw new SyncError(`${fw.repo} 的 ${file} 与它的 README.md 在站点里是同一个页面（${target}），给其中一个改名`);
      }
      outputs.push({ from, source: path.join(tree, file), target });
    }
  }
  const generated = new Set(outputs.map((output) => output.target));

  fs.rmSync(homePage, { force: true });
  fs.rmSync(frameworksDir, { recursive: true, force: true });

  const ctx: RewriteContext = {
    frameworks: names,
    exists: (sitePath) => generated.has(sitePath) || fs.existsSync(path.join(docsDir, sitePath)),
    refOf: (repo) => commits.get(repo) ?? 'main',
  };

  for (const output of outputs) {
    const out = path.join(docsDir, output.target);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (!PAGE.test(output.target)) {
      fs.copyFileSync(output.source, out);
      continue;
    }
    let body: string;
    try {
      body = rewriteLinks(fs.readFileSync(output.source, 'utf8'), (url, kind) => rewriteUrl(url, output.from, ctx, kind));
    } catch (error) {
      throw new SyncError(`${output.from.repo} 的 ${output.from.path}：${(error as Error).message}`);
    }
    // 首页的一级标题就是站点名，浏览器标题里会重复，另给一个页面标题
    const head = output.target === 'index.md' && !body.startsWith('---') ? '---\ntitle: 总览\n---\n\n' : '';
    fs.writeFileSync(out, `${head}${body.trimEnd()}\n\n${footer(output, commits.get(output.from.repo))}\n`);
  }

  fs.writeFileSync(
    path.join(frameworksDir, '_meta.json'),
    `${JSON.stringify(frameworks.map((fw) => ({ type: 'dir', name: fw.repo, label: fw.label })), null, 2)}\n`,
  );
  fs.writeFileSync(frameworksMarker, `${MARKER}。\n`);
}

/** 生成的页面末尾：来源与生成标记。.mdx 里不能写 HTML 注释。 */
function footer(output: Output, commit: string | undefined): string {
  const comment = output.target.endsWith('.mdx') ? `{/* ${MARKER} */}` : `<!-- ${MARKER} -->`;
  if (commit === undefined) return comment;
  const { repo, path: file } = output.from;
  const url = `https://github.com/${ORG}/${repo}/blob/${commit}/${encodeURI(file)}`;
  return `---\n\n*本页取自 [${ORG}/${repo} 的 ${file}](${url})，版本 \`${commit.slice(0, 7)}\`。要改内容，去那个仓库改。*\n\n${comment}`;
}

/** docs/ 顶层的每个页面与目录都要列在 docs/_meta.json 里，没列的不会出现在侧栏。 */
function assertSidebarComplete(): void {
  const meta = JSON.parse(fs.readFileSync(path.join(docsDir, '_meta.json'), 'utf8')) as unknown[];
  const listed = new Set(
    meta
      .map((item) => (typeof item === 'string' ? item : (item as { name?: unknown }).name))
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.replace(PAGE, '')),
  );
  const missing = fs
    .readdirSync(docsDir, { withFileTypes: true })
    .filter((entry) => !/^[_.]/.test(entry.name) && entry.name !== 'public')
    .filter((entry) => entry.isDirectory() || PAGE.test(entry.name))
    .map((entry) => entry.name.replace(PAGE, ''))
    .filter((name) => !listed.has(name));
  if (missing.length > 0) {
    throw new SyncError(`docs/_meta.json 里没有列出：${missing.join('、')}。没列出的页面不会出现在侧栏里`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--update');
  if (unknown.length > 0) throw new SyncError(`不认识的参数：${unknown.join(' ')}\n用法：node scripts/sync.ts [--update]`);

  let frameworks: Framework[];
  try {
    frameworks = readSources(sourcesFile);
  } catch (error) {
    throw new SyncError((error as Error).message);
  }
  assertReservedNamesFree();

  const base = gitBase();
  const update = args.includes('--update');
  if (update) {
    frameworks = frameworks.map((fw) => {
      const commit = latestCommit(repoUrl(base, fw.repo));
      console.log(commit === fw.commit ? `${fw.repo}：已是最新（${commit.slice(0, 7)}）` : `${fw.repo}：${fw.commit.slice(0, 7)} → ${commit.slice(0, 7)}`);
      return { ...fw, commit };
    });
  }

  const trees = new Map(frameworks.map((fw) => [fw.repo, fetchSource(fw, base)]));
  // 新版本都取到了再改 sources.json
  if (update) writeSources(sourcesFile, frameworks);
  generate(frameworks, trees);
  assertSidebarComplete();
  console.log(`已生成 docs/index.md 与 docs/frameworks/（${frameworks.map((fw) => `${fw.repo}@${fw.commit.slice(0, 7)}`).join('、')}）`);
}

try {
  main();
} catch (error) {
  if (!(error instanceof SyncError)) throw error;
  console.error(`同步失败：${error.message}`);
  process.exitCode = 1;
}
