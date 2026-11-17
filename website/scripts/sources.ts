// website/sources.json：聚合进站点的框架仓库，以及各自钉住的提交。

import fs from 'node:fs';

export interface Framework {
  /** 仓库名，也是站点里的目录名：docs/frameworks/<repo>/ */
  repo: string;
  /** 侧栏里显示的名字 */
  label: string;
  /** 钉住的提交，40 位 */
  commit: string;
}

export function readSources(file: string): Framework[] {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { frameworks?: unknown };
  if (!Array.isArray(data.frameworks)) throw new Error(`${file}：缺 frameworks 数组`);
  return data.frameworks.map((item: unknown, index) => {
    const { repo, label, commit } = (item ?? {}) as Record<string, unknown>;
    if (typeof repo !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(repo)) {
      throw new Error(`${file}：第 ${index + 1} 项的 repo 要是小写字母、数字与连字符组成的仓库名`);
    }
    if (typeof label !== 'string' || label === '') throw new Error(`${file}：${repo} 缺 label`);
    if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) {
      throw new Error(`${file}：${repo} 的 commit 要写完整的 40 位提交号`);
    }
    return { repo, label, commit };
  });
}

export function writeSources(file: string, frameworks: Framework[]): void {
  fs.writeFileSync(file, `${JSON.stringify({ frameworks }, null, 2)}\n`);
}
