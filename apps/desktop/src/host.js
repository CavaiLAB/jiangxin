'use strict';

/**
 * 管理 DSH 进程：从发行目录启动已发布的 dsh（Web 模式），等它就绪，退出时把它停掉。
 * 这个文件不依赖 Electron，可以在普通 Node 下测（见 scripts/smoke-host.js）。
 *
 * 凭据的走向（对照上游桌面壳的做法定的，见 apps/desktop/README.md「凭据交接」）：
 *   - dsh 每次启动生成一个只在本次进程里有效的令牌，就绪时在标准输出打印一行
 *     `dsh web: http://127.0.0.1:<端口>/?token=<令牌>`。这一行是上游给监管进程用的就绪信号。
 *   - 标准输出是壳和 dsh 之间的私有管道，令牌只进壳的内存。
 *   - 写日志之前一律先把令牌和 Cookie 隐去（redact），日志里看不到凭据。
 */

const { spawn, execFileSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

/** 就绪行。同样以 `dsh web:` 开头的还有「正在打开浏览器」之类的提示，所以要求后面是一个地址。 */
const READY_LINE = /^dsh web: (https?:\/\/\S+)\s*$/;

/**
 * DSH 没加载我们自己的插件（jx- 开头的行、@jx/ 开头的包）时打的告警。DSH 不会因此停下，照常启动；
 * 品牌包没加载，界面就露出 DSH 自己的品牌。所以壳把它当成启动失败。三种写法都是实测抄下来的：
 *   dsh: disabling profile plugin row "jx-…": Plugin @jx/…@x is incompatible with dsh …   （版本门禁）
 *   dsh: skipping profile bundle "@jx/…": Error: Plugin @jx/…@x is incompatible with dsh …  （版本门禁）
 *   jx-… (…): failed to import: Error [ERR_MODULE_NOT_FOUND]: …                           （找不到包）
 */
const OWN_PLUGIN_NOT_LOADED = /(?:disabling profile plugin row|skipping profile bundle) "((?:jx-|@jx\/)[^"]*)"|^(jx-[\w-]+) \(.*\): failed to import/;

/** 地址里的令牌，以及 dsh 发的认证 Cookie。写日志前都要隐去。 */
const TOKEN_IN_URL = /([?&]token=)[^\s&#"'<>]+/g;
const AUTH_COOKIE = /(dsh-auth-[A-Za-z0-9_-]+=)[A-Za-z0-9_.-]+/g;

/**
 * 把一段文字里的凭据隐去。
 * @param {string} text
 * @returns {string}
 */
function redact(text) {
  return text.replace(TOKEN_IN_URL, '$1<已隐去>').replace(AUTH_COOKIE, '$1<已隐去>');
}

/** 透传给 DSH 进程的环境变量白名单。不在名单里的（各种密钥、代理、令牌）一律不传。 */
const BASE_ENV_NAMES = [
  'HOME', 'USER', 'LOGNAME', 'SHELL', 'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TZ', '__CF_USER_TEXT_ENCODING',
];

/** 从程序坞或访达启动时 PATH 很短，补上常见的几个目录。 */
const EXTRA_PATH_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];

/**
 * 组出 DSH 进程的环境变量。
 * @param {object} input
 * @param {Record<string, string | undefined>} input.parentEnv
 * @param {string[]} input.passNames 额外透传的变量名
 * @param {Record<string, string>} input.fixed 壳写死的变量（状态目录等），优先级最高
 * @returns {Record<string, string>}
 */
function buildHostEnv({ parentEnv, passNames, fixed }) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const name of [...BASE_ENV_NAMES, ...passNames]) {
    const value = parentEnv[name];
    if (value !== undefined) env[name] = value;
  }
  const dirs = (env.PATH ?? '').split(':').filter(Boolean);
  for (const dir of EXTRA_PATH_DIRS) if (!dirs.includes(dir)) dirs.push(dir);
  env.PATH = dirs.join(':');
  return { ...env, ...fixed };
}

/**
 * 端口上是不是已经有东西在听。
 * @param {string} host
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortBusy(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (/** @type {boolean} */ busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * 读一个进程的启动时间和命令行。读不到（进程不在了）返回 undefined。
 *
 * 一定用 C 语言环境跑 ps：
 *   - 启动时间的格式跟语言环境走，两次启动的环境可能不一样（终端里起、访达里起），固定成 C 才能直接比；
 *   - C 环境下 ps 会把命令行里的非 ASCII 字节转义掉。打好的应用包路径里有中文应用名，
 *     所以**不能拿带中文的完整路径去和 ps 的输出比**（踩过：比不上，认不出自己留下的进程）。
 * @param {number} pid
 * @returns {{ lstart: string, command: string } | undefined}
 */
function readProcessInfo(pid) {
  const run = (/** @type {string} */ field) => execFileSync('/bin/ps', ['-ww', '-p', String(pid), '-o', `${field}=`], {
    encoding: 'utf8',
    env: { LC_ALL: 'C', PATH: '/bin:/usr/bin' },
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  try {
    return { lstart: run('lstart'), command: run('command') };
  } catch {
    return undefined;
  }
}

/**
 * 记录文件里的那个进程，现在还是不是我们上次起的 DSH？
 * 进程号会被系统复用，所以要同时满足两条才认：
 *   1. 启动时间和记录的一样（旧版记录没有这一项时跳过这条）；
 *   2. 命令行里有 DSH 入口文件路径里从 /node_modules/ 开始的那一段（这一段是纯 ASCII，不受转义影响）。
 * @param {object} input
 * @param {{ pid?: unknown, lstart?: unknown } | undefined} input.record
 * @param {{ lstart: string, command: string } | undefined} input.info
 * @param {string} input.binJs
 * @returns {boolean}
 */
function isOurHostProcess({ record, info, binJs }) {
  if (record === undefined || record === null || info === undefined) return false;
  if (typeof record.lstart === 'string' && record.lstart !== '' && record.lstart !== info.lstart) return false;
  const at = binJs.lastIndexOf('/node_modules/');
  const marker = at < 0 ? '' : binJs.slice(at);
  // 没有这段标记，或者标记里有非 ASCII 字符（那就比不了），宁可不认。
  if (marker === '' || /[^\x20-\x7e]/.test(marker)) return false;
  return info.command.includes(marker);
}

/**
 * 等一个进程退出。
 * @param {number} pid
 * @param {number} timeoutMs
 * @returns {Promise<boolean>} 在时限内退出了返回 true
 */
async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

/**
 * @typedef {object} DshHostOptions
 * @property {string} nodeBinary 用来跑 dsh 的可执行文件：Electron 自己，或者一个外部的 node
 * @property {boolean} electronAsNode nodeBinary 是不是 Electron（是的话要设 ELECTRON_RUN_AS_NODE 并加 --expose-internals）
 * @property {string} binJs dsh 的入口文件
 * @property {string} profile 要启动的 profile
 * @property {string[]} patches 依次叠加的补丁文件（绝对路径）
 * @property {string} host
 * @property {number} port
 * @property {string} cwd DSH 进程的工作目录
 * @property {Record<string, string>} env DSH 进程的完整环境变量
 * @property {string} logFile DSH 输出写到哪里（凭据已隐去）
 * @property {string} pidFile 记录 DSH 进程 pid 的文件，用来清理上次没停掉的进程
 * @property {number} [readyTimeoutMs]
 */

/** 一个 DSH 进程。事件：'exit'（就绪之后意外退出）。 */
class DshHost extends EventEmitter {
  /** @param {DshHostOptions} options */
  constructor(options) {
    super();
    this.options = options;
    /** @type {import('node:child_process').ChildProcess | undefined} */
    this.child = undefined;
    this.stopping = false;
    this.ready = false;
    /** 最近的输出（已隐去凭据），出错时给用户看。 */
    this.tail = '';
    /** 只留在内存里的启动地址（带令牌）。不要打印，不要写文件。 */
    this.launchUrl = undefined;
    this.logStream = undefined;
    this.killOnExit = () => {
      if (this.child !== undefined && this.child.exitCode === null) this.child.kill('SIGTERM');
    };
  }

  /** DSH 的地址（不带令牌）。 */
  get origin() {
    return `http://${this.options.host}:${String(this.options.port)}`;
  }

  /** @returns {number | undefined} */
  get pid() {
    return this.child?.pid;
  }

  /**
   * 写一行日志。写之前隐去凭据。
   * @param {string} tag
   * @param {string} line
   */
  log(tag, line) {
    const safe = redact(line);
    this.tail = (this.tail + safe + '\n').slice(-8 * 1024);
    this.logStream?.write(`${new Date().toISOString()} [${tag}] ${safe}\n`);
  }

  /** 上次的 DSH 进程如果还活着（壳被强杀时会留下），先停掉它，免得占着端口。 */
  async cleanupStale() {
    const { pidFile, binJs } = this.options;
    let record;
    try {
      record = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    } catch {
      return;
    }
    const pid = Number(record?.pid);
    try {
      if (!Number.isSafeInteger(pid) || pid <= 1) return;
      process.kill(pid, 0);
      // 进程号可能已经被别的程序复用。只有确实是我们上次起的那个 DSH 才动它。
      if (!isOurHostProcess({ record, info: readProcessInfo(pid), binJs })) return;
      this.log('shell', `发现上次没停掉的 DSH 进程 ${String(pid)}，先停掉`);
      process.kill(pid, 'SIGTERM');
      if (!(await waitForExit(pid, 10_000))) {
        process.kill(pid, 'SIGKILL');
        await waitForExit(pid, 5_000);
      }
    } catch {
      // 进程已经不在了。
    } finally {
      fs.rmSync(pidFile, { force: true });
    }
  }

  /**
   * 启动 DSH 并等它就绪。
   * @returns {Promise<{ origin: string, launchUrl: string }>} launchUrl 带令牌，只能留在内存里
   */
  async start() {
    const { nodeBinary, electronAsNode, binJs, profile, patches, host, port, cwd, env, logFile, pidFile } = this.options;
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    try {
      // 日志超过 5 MB 就换一个文件，只留一份旧的。
      if (fs.statSync(logFile).size > 5 * 1024 * 1024) fs.renameSync(logFile, `${logFile}.1`);
    } catch {
      // 还没有日志文件。
    }
    this.logStream = fs.createWriteStream(logFile, { flags: 'a' });

    await this.cleanupStale();
    if (await isPortBusy(host, port)) {
      throw new Error(`端口 ${String(port)} 已经被别的程序占用，DSH 起不来。可以用环境变量换一个端口。`);
    }

    // 参数顺序有讲究：启动器自己的参数（--profile、--patch）在前，
    // 第一个它不认识的参数起算作 Web 应用的参数（--host、--port、--no-open）。
    const args = [
      // Electron 自带的 Node 里，Cordis 的加载器拿不到 Node 内部的 ESM 加载器，要显式打开。上游桌面壳也是这么做的。
      ...(electronAsNode ? ['--expose-internals'] : []),
      binJs,
      '--profile', profile,
      ...patches.flatMap((file) => ['--patch', file]),
      '--host', host,
      '--port', String(port),
      '--no-open',
    ];
    this.log('shell', `启动 DSH：${path.basename(nodeBinary)} ${args.join(' ')}`);
    this.log('shell', `工作目录 ${cwd}；DSH_HOME ${env.DSH_HOME ?? '（未设置）'}`);

    const child = spawn(nodeBinary, args, {
      cwd,
      env: electronAsNode ? { ...env, ELECTRON_RUN_AS_NODE: '1' } : env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child = child;
    process.once('exit', this.killOnExit);
    if (child.pid !== undefined) {
      fs.mkdirSync(path.dirname(pidFile), { recursive: true });
      // lstart 是系统记的进程启动时间，和进程号一起才能唯一认出这个进程。
      const lstart = child.pid === undefined ? undefined : readProcessInfo(child.pid)?.lstart;
      fs.writeFileSync(pidFile, JSON.stringify({ pid: child.pid, port, startedAt: new Date().toISOString(), lstart }) + '\n');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutMs = this.options.readyTimeoutMs ?? 120_000;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`DSH 在 ${String(timeoutMs / 1000)} 秒内没有就绪。最近的输出：\n${this.tail}`));
      }, timeoutMs);

      /** @param {'out' | 'err'} tag */
      const reader = (tag) => {
        let buffer = '';
        return (/** @type {Buffer} */ chunk) => {
          buffer += chunk.toString('utf8');
          let newline;
          while ((newline = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newline).replace(/\r$/, '');
            buffer = buffer.slice(newline + 1);
            const notLoaded = OWN_PLUGIN_NOT_LOADED.exec(line);
            if (notLoaded !== null) {
              this.log(tag, line);
              const which = notLoaded[1] ?? notLoaded[2];
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                // 主动停掉，不算「意外退出」。
                this.stopping = true;
                child.kill('SIGTERM');
                reject(new Error(
                  `DSH 没有加载我们的插件 ${which}（版本对不上或找不到包），不能带着 DSH 自己的品牌启动。`
                  + `最近的输出：\n${this.tail}`,
                ));
              } else {
                this.log('shell', `告警：DSH 就绪以后才报告没加载插件 ${which}`);
              }
              continue;
            }
            if (tag === 'out' && !settled) {
              const match = READY_LINE.exec(line);
              if (match !== null) {
                let url;
                try {
                  url = new URL(match[1]);
                } catch {
                  url = undefined;
                }
                // 只认本机这个地址，别的一概不信。
                if (url !== undefined && url.origin === this.origin && url.searchParams.has('token')) {
                  settled = true;
                  clearTimeout(timer);
                  this.ready = true;
                  this.launchUrl = url.href;
                  this.log(tag, line);
                  resolve({ origin: this.origin, launchUrl: url.href });
                  continue;
                }
              }
            }
            this.log(tag, line);
          }
        };
      };
      child.stdout?.on('data', reader('out'));
      child.stderr?.on('data', reader('err'));

      child.once('error', (error) => {
        this.log('shell', `DSH 进程启动失败：${error.message}`);
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code, signal) => {
        fs.rmSync(pidFile, { force: true });
        process.removeListener('exit', this.killOnExit);
        this.log('shell', `DSH 进程退出：code=${String(code)} signal=${String(signal)}`);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`DSH 还没就绪就退出了（code=${String(code)} signal=${String(signal)}）。最近的输出：\n${this.tail}`));
          return;
        }
        if (!this.stopping) this.emit('exit', { code, signal, tail: this.tail });
      });
    });
  }

  /**
   * 停掉 DSH。SIGTERM 是上游约定的正常停止信号（退出码 0）；十秒不退再强杀。
   * @returns {Promise<void>}
   */
  async stop() {
    const child = this.child;
    this.stopping = true;
    this.launchUrl = undefined;
    if (child === undefined || child.exitCode !== null || child.signalCode !== null) {
      this.logStream?.end();
      return;
    }
    const closed = new Promise((resolve) => child.once('close', resolve));
    const within = (/** @type {number} */ ms) =>
      Promise.race([closed.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), ms))]);
    child.kill('SIGTERM');
    if (!(await within(10_000))) {
      this.log('shell', 'DSH 十秒内没有退出，强制结束');
      child.kill('SIGKILL');
      await within(5_000);
    }
    this.logStream?.end();
  }
}

module.exports = { DshHost, buildHostEnv, redact, isPortBusy, isOurHostProcess, readProcessInfo, READY_LINE, OWN_PLUGIN_NOT_LOADED };
