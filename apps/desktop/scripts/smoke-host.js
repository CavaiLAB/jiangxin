#!/usr/bin/env node
'use strict';

/**
 * 冒烟：不开窗口，只验证「从发行目录启动 DSH、等就绪、用令牌换 Cookie、带 Cookie 能取到界面、停得掉」。
 * 用法（在 apps/desktop 下）：
 *   node scripts/smoke-host.js            用 Electron 自带的 Node 跑 DSH（和壳一样）
 *   node scripts/smoke-host.js --system-node   用当前这个 node 跑 DSH
 * 输出一份 JSON 结果，里面没有令牌和 Cookie。
 */

const fs = require('node:fs');
const path = require('node:path');

const { exchangeLaunchUrl } = require('../src/auth');
const { DshHost, isPortBusy } = require('../src/host');
const { planLaunch } = require('../src/launch');
const { ENV } = require('../src/config');

async function main() {
  const appDir = path.resolve(__dirname, '..');
  const electronBinary = path.join(appDir, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
  const env = { ...process.env };
  if (process.argv.includes('--system-node')) env[ENV.hostNode] = process.execPath;

  const plan = planLaunch({ env, isPackaged: false, resourcesPath: '', appDir, bakedStateRoot: undefined, electronBinary });
  const host = new DshHost(plan.hostOptions);
  const result = {
    distribution: { dir: plan.distribution.dir, source: plan.distributionSource, dsh: plan.distribution.dshVersion },
    patches: plan.hostOptions.patches,
    runner: plan.hostOptions.electronAsNode ? 'electron-as-node' : 'system-node',
    stateRoot: plan.dirs.root,
    origin: host.origin,
  };

  const started = Date.now();
  try {
    const { launchUrl } = await host.start();
    result.readyMs = Date.now() - started;
    result.pid = host.pid;

    // 不带凭据：应当被拒绝。
    const anonymous = await fetch(host.origin + '/', { redirect: 'manual' });
    await anonymous.body?.cancel();
    result.anonymousStatus = anonymous.status;

    const cookie = await exchangeLaunchUrl(launchUrl);
    result.cookieName = cookie.slice(0, cookie.indexOf('=')).replace(/^(dsh-auth-).*/, '$1…');

    // 带 Cookie：应当拿到界面的首页。
    const index = await fetch(host.origin + '/', { headers: { cookie }, redirect: 'manual' });
    const html = await index.text();
    result.indexStatus = index.status;
    result.indexBytes = html.length;
    result.indexTitle = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? null;

    // 日志里不能有令牌或 Cookie 的明文。
    const log = fs.readFileSync(plan.hostOptions.logFile, 'utf8');
    result.logHasReadyLine = /dsh web: http:\/\/127\.0\.0\.1:\d+\/\?token=<已隐去>/.test(log);
    result.logLeaksToken = /[?&]token=(?!<已隐去>)/.test(log);
    result.logLeaksCookie = /dsh-auth-[A-Za-z0-9_-]+=(?!<已隐去>)/.test(log);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    const stopStarted = Date.now();
    await host.stop();
    result.stopMs = Date.now() - stopStarted;
    result.portFreeAfterStop = !(await isPortBusy(plan.host, plan.port));
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.error !== undefined) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
