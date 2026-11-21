'use strict';

/**
 * electron-builder 的 afterPack 钩子：应用包生成之后（签名之前）往里放三样东西。
 *
 *   1. 发行目录 → Contents/Resources/runtime
 *      默认是 apps/desktop/runtime；设了 JX_PACK_DISTRIBUTION_DIR 就打那个目录。
 *      不用 electron-builder 的 extraResources：它对 node_modules 有自己的一套默认排除规则
 *      （比如各包里的 test、example 目录），DSH 的依赖树有九万多个文件，按原样整目录放最稳。
 *   2. 许可文件 → Contents/Resources/licenses
 *      DSH 是 MIT 许可，分发时必须带版权声明和许可全文；Electron 和 Chromium 也各有声明。
 *   3. 自带的假模型 → Contents/Resources/mock-model/server.mjs
 *      只是一个文件，一律放进去；只有打包时写入 mockModel 或启动时打开 JX_DESKTOP_MOCK_MODEL 才会起，见 src/mock-model.js。
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * 整目录复制，保留符号链接和可执行位。
 * @param {string} from
 * @param {string} to
 */
function copyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (process.platform === 'darwin') {
    // -c：APFS 上做写时复制的克隆，九万多个文件几秒钟就好，也不多占空间；-R 保留符号链接。
    execFileSync('/bin/cp', ['-Rc', from, to], { stdio: 'inherit' });
  } else {
    fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true });
  }
}

/** @param {import('electron-builder').AfterPackContext} context */
exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const resourcesDir = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');

  // 1. 发行目录
  const distributionDir = path.resolve(process.env.JX_PACK_DISTRIBUTION_DIR || path.join(projectDir, 'runtime'));
  const dshManifest = path.join(distributionDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json');
  if (!fs.existsSync(dshManifest)) {
    throw new Error(`after-pack: 发行目录还没装好依赖（找不到 ${dshManifest}）。先跑 npm run runtime:install。`);
  }
  const pinned = JSON.parse(fs.readFileSync(path.join(distributionDir, 'package.json'), 'utf8')).dependencies?.['@deepseek-ai/dsh'];
  const installed = JSON.parse(fs.readFileSync(dshManifest, 'utf8')).version;
  if (pinned !== installed) {
    throw new Error(`after-pack: 发行目录里装的 DSH 是 ${installed}，清单里钉的是 ${String(pinned)}。`);
  }
  const started = Date.now();
  copyTree(distributionDir, path.join(resourcesDir, 'runtime'));
  // 发行目录里的本机状态（.dev/）不进包。
  fs.rmSync(path.join(resourcesDir, 'runtime', '.dev'), { recursive: true, force: true });
  console.log(`  • after-pack  已放入发行目录 ${distributionDir}（DSH ${installed}，${String(Date.now() - started)} ms）`);

  // 2. 许可文件
  const licensesDir = path.join(resourcesDir, 'licenses');
  fs.mkdirSync(licensesDir, { recursive: true });
  /** @type {Array<[string, string, boolean]>} 来源、目标文件名、是否必须有 */
  const licenses = [
    [path.join(distributionDir, 'node_modules', '@deepseek-ai', 'dsh', 'LICENSE'), 'DSH-LICENSE.txt', true],
    // DSH 仓库根目录的第三方声明不在 npm 包里，从 upstream/dsh-ref（DSH 源码的检出，不进 git）取；不在时跳过并提示。
    [path.join(projectDir, '..', '..', 'upstream', 'dsh-ref', 'THIRD_PARTY_NOTICES.md'), 'DSH-THIRD_PARTY_NOTICES.md', false],
    [path.join(projectDir, 'node_modules', 'electron', 'dist', 'LICENSE'), 'Electron-LICENSE.txt', true],
    [path.join(projectDir, 'node_modules', 'electron', 'dist', 'LICENSES.chromium.html'), 'Chromium-LICENSES.html', true],
  ];
  for (const [from, name, required] of licenses) {
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(licensesDir, name));
    } else if (required) {
      throw new Error(`after-pack: 缺少必须随包分发的许可文件 ${from}`);
    } else {
      console.warn(`  • after-pack  没找到 ${from}，这份声明没有放进包里`);
    }
  }
  fs.writeFileSync(
    path.join(licensesDir, '说明.txt'),
    [
      '这个目录里是随应用分发的开源许可声明。',
      '',
      'DSH-LICENSE.txt               DSH 的 MIT 许可全文（Copyright (c) 2026 DeepSeek）',
      'DSH-THIRD_PARTY_NOTICES.md    DSH 自带的第三方声明',
      'Electron-LICENSE.txt          Electron 的许可',
      'Chromium-LICENSES.html        Chromium 及其依赖的许可',
      '',
      'DSH 依赖的其他 npm 包各自的许可文件在 ../runtime/node_modules/<包名>/ 下。',
      '',
    ].join('\n'),
  );
  console.log(`  • after-pack  已放入许可文件 ${licensesDir}`);

  // 3. 自带的假模型
  const mockSource = path.join(projectDir, '..', '..', 'tools', 'mock-model', 'server.mjs');
  if (!fs.existsSync(mockSource)) {
    throw new Error(`after-pack: 找不到假模型 ${mockSource}`);
  }
  fs.mkdirSync(path.join(resourcesDir, 'mock-model'), { recursive: true });
  fs.copyFileSync(mockSource, path.join(resourcesDir, 'mock-model', 'server.mjs'));
  console.log('  • after-pack  已放入自带的假模型');

  // 4. Electron 自带的示例应用用不到，去掉（用 electronDist 时 electron-builder 不会替我们删）。
  fs.rmSync(path.join(resourcesDir, 'default_app.asar'), { force: true });

  // 5. Electron 默认带着摄像头、蓝牙、麦克风等的用途说明。壳用不到这些权限，去掉，免得系统弹出误导人的授权框。
  if (context.electronPlatformName === 'darwin') {
    const plist = path.join(resourcesDir, '..', 'Info.plist');
    for (const key of [
      'NSCameraUsageDescription',
      'NSBluetoothAlwaysUsageDescription',
      'NSBluetoothPeripheralUsageDescription',
      'NSMicrophoneUsageDescription',
      'NSAudioCaptureUsageDescription',
    ]) {
      try {
        execFileSync('/usr/bin/plutil', ['-remove', key, plist], { stdio: 'ignore' });
      } catch {
        // 这个键本来就没有。
      }
    }
  }
};
