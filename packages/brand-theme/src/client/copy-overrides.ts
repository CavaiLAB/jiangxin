/**
 * 文案覆盖表：DSH 界面里带 DSH 字样的句子，换成我们的说法。
 *
 * 怎么生效：品牌包注册两种语言 zh-CN（回退到 zh）和 en-US（回退到 en），
 * 下面每个命名空间只写要改的键；没写的键沿回退链用 DSH 原来的文字。
 * 这是 DSH 的「语言包」做法（locale 服务的 addLanguage 加上单语言的 register），是公开接口。
 * 但键名是各个界面包自己的，上游改键名不会通知我们——升级 DSH 以后要重跑一次审计
 * （浏览器控制台里调 __JX_BRAND_AUDIT__()），看 productLeft 是不是还是 0。
 *
 * 改写的规矩：
 *   - 指代「这个产品」的 DSH / DeepSeek Harness / Harness：句子里用「本平台」（英文用 Jiangxin），
 *     要亮出名字的地方（首页标题、引导页）用全称。
 *   - 指代「运行时版本」的 DSH（插件兼容性那几句，后面跟着 0.2.2-rc.5 这样的版本号）：改成「运行时」。
 *     那个版本号是上游运行时的版本，不是我们的产品版本，写成「本平台 0.2.2-rc.5」会误导。
 *   - 指代厂商或它的服务的 DeepSeek（DeepSeek 账号、DeepSeek 的模型和搜索服务、上传会话日志）不改名：
 *     那些功能确实是对接 DeepSeek 的，改了名就是在瞒用户。它们应该随功能一起关掉，见本包 README.md 的「换不掉或靠取巧的位置」。
 *   - $DSH_HOME、dsh plugin add、dsh-doc、dsh-plugin-xxx 这类技术名称不改：照着敲才对。
 *
 * 这里的措辞是初稿，要产品负责人过一遍。带「待定稿」注释的是我们自己新写的句子。
 */
import { BRAND } from '../brand.ts'

const P = BRAND.productName
const L = BRAND.latinName

/** 语言包：id、显示名、回退到哪种基础语言。 */
export const LANGUAGE_PACKS = [
  { id: 'zh-CN', label: '简体中文', fallback: 'zh' },
  { id: 'en-US', label: 'English', fallback: 'en' },
] as const

/**
 * 浏览器的语言跟哪个语言包都对不上时（日语、法语……）用的语言包。
 * 产品面向国内企业，所以用中文；DSH 自己在这种情况下用英文。
 */
export const DEFAULT_LANGUAGE_PACK: (typeof LANGUAGE_PACKS)[number]['id'] = 'zh-CN'

/** 命名空间 → 键 → 文字。 */
type Overrides = Readonly<Record<string, Readonly<Record<string, string>>>>

/** 中文覆盖（语言 zh-CN）。 */
export const ZH_CN: Overrides = {
  // 没有品牌包占位时侧栏显示的名字；也是浏览器标题的兜底。
  common: {
    'brand.localBuild': P,
  },

  chat: {
    // 对话进行中的提示。DSH 原文是「深度求索中」——「深度求索」是 DeepSeek 的中文名。
    'chat.deepDiving': '正在处理',
    'chat.deepDivingFor': '正在处理，用时 {duration} ···',
    'message.failure.interrupted':
      '本平台的服务进程在本轮完成前退出（例如被强制结束、崩溃或关闭超时），重新启动后本轮已中止。未完成的工具调用结果未知。',
  },

  conversation: {
    // 首页标题。DSH 这里放的是它自己的口号「探索未至之境」；我们还没有口号，先放产品全称。
    'hero.headline': P,
    'error.sessionInUse':
      '当前会话已被占用，可能是另一个正在运行的本平台实例导致的（如另一个网页端服务或桌面端），请退出其他实例后重试。',
  },

  model: {
    'error.sessionInUse':
      '当前会话已被占用，可能是另一个正在运行的本平台实例导致的（如另一个网页端服务或桌面端），请退出其他实例后重试。',
  },

  // 「创造模式」里给用户的示例提示词。
  entryCustomization: {
    'createPrompt.conversation': '创建一个会话视图插件。',
    'createPrompt.rightbar': '创建一个带右侧栏入口的插件。',
    'createPrompt.sidebar': '创建一个带左侧栏入口的插件。',
  },

  pluginManager: {
    installBundledTitle: '插件已随本平台提供',
    installDoneRestart: '已安装，请重启本平台加载它。{reason}',
    installGuideSafety: '请确认插件来源可信。插件在本机以你的权限运行，来源不明的插件可能损坏本平台，或读取和泄露你的数据。',
    installProblemShipped: '该插件随本平台提供，升级本平台即可获得新版本',
    installUpgradeNotice: '按需安装的官方插件会在版本与运行时不一致时提供“更新”。其他插件请先卸载再安装新版。',
    reasonIncompatibleInstall: '请安装与当前运行时兼容的插件版本。',
    reasonIncompatibleInstalled: '请卸载后重新安装与当前运行时兼容的版本。',
    reasonIncompatibleVersion: '{plugin} 与当前运行时 {runtime} 不兼容（要求 {requirements}），运行它可能导致崩溃或数据丢失。',
    reasonIncompatibleVersionUnnamed: '这个插件与当前运行时版本不兼容，运行它可能导致崩溃或数据丢失。',
    reasonUnsupportedPlatform: '此插件不支持运行本平台的主机操作系统',
    restartNotice: '请重启本平台使更改生效。{reason}',
    restartReasonHostModule: '更改涉及本平台自身已加载的模块。',
    restartReasonModuleComparison: '本平台无法将已加载的插件与磁盘上的文件进行比较。',
    restartReasonPackageMoved: '已安装的插件包解析到了另一个目录，或者更改替换了本平台安装自带的包。从其他位置安装前请先卸载。',
    sourceTargetSpec: '当前运行时对应来源',
    sourceTargetVersion: '当前运行时对应版本',
    updateLostDetail: '与本平台服务的连接中断：{reason}。刷新插件列表可查看当前版本。',
    versionsBlocked: '新版本需要更新运行时',
    versionsBlockedDetail: '{version} 需要 {peers}，当前运行时为 {runtime}',
  },

  // DeepSeek 账号的登录与引导。「DeepSeek 账号」是厂商的账号，不改名；只换掉指代产品的地方。
  'settings.account': {
    backToHarness: `返回${P}`,
    onboardingBrand: P,
    onboardingCreditDescription:
      '本平台执行任务时，会根据模型与工具使用的 token 量扣除额度。请提前添加额度，避免任务在执行过程中被迫中断。你的余额只会在 Agent 实际执行任务时消耗。',
    onboardingIntroduction:
      `${P}会以本地文件夹作为工作区，通过调用各种工具，读写本机文件，完成搜索整理资料、制作文档表格、编写代码、排查问题等各种任务。`,
    onboardingNoCreditDescription: '没有可用额度时，本平台将无法开始新的任务。你可以稍后前往 设置 → 账号与余额 进行充值。',
    onboardingProcessDescription: '这只会影响工作过程的展示方式，不会影响本平台的工作能力。',
    quotaDescription: '没有可用额度时，本平台无法开始新的任务，是否前往充值？或者可以稍后前往 设置 → 账号与余额 进行充值。',
    settingsSignedOutDescription: '登录 DeepSeek 账号获取专属 API Key',
    settingsSignedOutTitle: '当前未登录 DeepSeek 账号',
  },

  'settings.agentPreset': {
    createPluginDescription: '进入创造模式，制作属于你的插件',
    guideCordisExplanation:
      '### 可以创造什么\n\n创造模式包含标准任务工具，并增加了运行时检查。标准模式和创造模式共用 dsh-doc 指引，用于插件和预设开发。Agent 可以创建插件来添加能力或界面，也可以创建预设，为特定工作组合工具和提示词。\n\n### 插件与模式的关系\n\n插件为本平台增加能力，例如工具、服务连接或界面入口。模式是一份 Agent 预设，用来选择任务可用的工具，并约定 Agent 的工作方式。自定义模式中也可以使用自己开发的插件。\n\n### 怎样让成果生效\n\n可以要求 Agent 完成安装并验证实际效果。插件可能即时加载，也可能需要重启，取决于修改内容；新建的模式在创建新任务时选择。',
    guideCordisUsage:
      '### 添加一个界面\n\n> 帮我写一个插件，在侧栏增加「项目笔记」入口，列出当前工作区的 Markdown 文件，点击后能预览内容。完成安装并验证页面能打开。\n\n预期产出：带侧栏入口和预览页的插件，以及仍需完成的生效步骤。\n\n### 添加一个工具\n\n> 写一个插件，提供读取项目测试报告、汇总失败用例的工具。注册工具，并用一份示例报告验证调用结果。\n\n预期产出：可调用的新工具，以及一次示例调用的验证结果。\n\n### 创建自己的模式\n\n> 基于标准模式创建「代码审查」模式，优先检查潜在错误和测试缺口，指出文件与行号，修改文件前先询问我。保存成可选择的预设。\n\n预期产出：可在新任务中选择的自定义模式。审查要求用于指导 Agent，实际可执行的操作仍由权限设置决定。',
    guideStandardExplanation:
      '### 工作方式\n\nAgent 直接调用工具来读写文件、检索资料和执行终端命令。包含 Skills、计划、目标、子 Agent、工作流、插件管理和上下文压缩等能力。\n\n对于本平台相关问题以及你要求的插件或预设工作，dsh-doc skill 引导 Agent 查阅已安装的文档和源码。其指令仅在被要求加载或与当前任务相关时加载；加载该 skill 不会改变文件、工具或 profile。\n\n### 什么时候选\n\n日常编程、文件处理和资料整理可以从这里开始。标准模式也能编写脚本、批量处理文件；PTC 改变的是工具调用方式，批量任务并不必须使用 PTC。',
    presetCordisDescription: '用对话定制本平台：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。',
    sectionIntro: '选择 Agent 的工具和工作方式。日常任务用「标准模式」，扩展本平台的能力用「创造模式」。',
  },

  'settings.models': {
    // 首次进入时的「预览版说明」。DSH 原文讲的是它自己的 0.2 版本和社区；这一段是我们新写的（待定稿）。
    welcomeBody: `${P}目前仍处于预览阶段，功能和界面还会持续调整和打磨，欢迎反馈使用中遇到的问题和建议。`,
  },

  shortcuts: {
    'desktop-reload': '重新启动应用',
    future: '{location} 的快捷键配置由更新版本创建。请升级本平台后重试。',
  },

  sidebarOffice: {
    unavailable: 'Office 预览不可用。请在运行本平台的主机上启用文档预览服务。',
  },
}

/** 英文覆盖（语言 en-US）。产品的英文全称还没定，句子里先用拼音名 Jiangxin。 */
export const EN_US: Overrides = {
  common: {
    'brand.localBuild': P,
  },

  chat: {
    // 英文原文是 Deep diving（鲸鱼下潜的双关），跟着中文一起换成中性的说法。
    'chat.deepDiving': 'Working',
    'chat.deepDivingFor': 'Working for {duration} ···',
    'message.failure.interrupted':
      `The ${L} process exited before this turn finished (for example, it was killed, crashed, or timed out while shutting down), so the turn was closed when ${L} restarted. Unfinished tool calls have unknown outcomes.`,
  },

  conversation: {
    'hero.headline': P,
    'error.sessionInUse':
      `This session is already in use, possibly by another running ${L} instance (such as another web server or the desktop app). Quit the other instances and try again.`,
  },

  model: {
    'error.sessionInUse':
      `This session is already in use, possibly by another running ${L} instance (such as another web server or the desktop app). Quit the other instances and try again.`,
  },

  entryCustomization: {
    'createPrompt.conversation': 'Create a conversation view plugin.',
    'createPrompt.rightbar': 'Create a plugin with a right sidebar entry.',
    'createPrompt.sidebar': 'Create a plugin with a left sidebar entry.',
  },

  pluginManager: {
    installBundledTitle: `This plugin ships with ${L}`,
    installDoneRestart: `Installed; restart ${L} to load it. {reason}`,
    installGuideSafety: `Install only plugins you trust: they run with your permissions and can damage ${L} or leak your data.`,
    installProblemShipped: `This plugin ships with ${L}; upgrading ${L} updates it`,
    installUpgradeNotice: 'On-demand official plugins offer Update when their version differs from the runtime. To update other plugins, uninstall and reinstall them.',
    reasonIncompatibleInstall: 'Install a plugin version compatible with this runtime.',
    reasonIncompatibleInstalled: 'Uninstall it and install a version compatible with this runtime.',
    reasonIncompatibleVersion: '{plugin} is incompatible with runtime {runtime} (requires {requirements}); running it may cause crashes or data loss.',
    reasonIncompatibleVersionUnnamed: 'This plugin is incompatible with the current runtime version; running it may cause crashes or data loss.',
    reasonUnsupportedPlatform: `This plugin does not support the operating system running ${L}.`,
    restartNotice: `Restart ${L} to apply the change. {reason}`,
    restartReasonHostModule: `The change reaches modules ${L} itself loaded.`,
    restartReasonModuleComparison: `${L} could not compare the loaded plugins with their files.`,
    restartReasonPackageMoved: `An installed package now resolves to another directory, or the change replaces a package the ${L} installation provides. Uninstall a package before installing it from another location.`,
    sourceTargetSpec: 'Source for this runtime',
    sourceTargetVersion: 'Version for this runtime',
    updateLostDetail: `The connection to the ${L} service was interrupted: {reason}. Refresh the plugin list to see the installed version.`,
    versionsBlocked: 'Newer versions need a runtime update',
    versionsBlockedDetail: '{version} needs {peers}; this runtime is {runtime}',
  },

  'settings.account': {
    backToHarness: `Back to ${L}`,
    onboardingBrand: P,
    onboardingCreditDescription:
      `${L} charges credits based on the tokens used by models and tools. Add credits in advance to keep your tasks running without interruption. Your balance is only used while the agent is working on a task.`,
    onboardingIntroduction:
      `${L} works in a local folder and uses tools to read and write files on your computer. It can help you research and organize information, create documents and spreadsheets, write code, troubleshoot issues, and more.`,
    onboardingNoCreditDescription: `${L} can’t start new tasks without credits. You can add them later in Settings → Account.`,
    onboardingProcessDescription: `This only changes how progress is shown, not what ${L} can do.`,
    quotaDescription: `${L} cannot start a new task with this account when no balance is available. Would you like to top up? You can also top up later in Settings → Account.`,
    settingsSignedOutDescription: 'Sign in to your DeepSeek account to get your dedicated API Key',
    settingsSignedOutTitle: 'You are not signed in to a DeepSeek account',
  },

  'settings.agentPreset': {
    createPluginDescription: 'Enter Creator mode and make your own plugin',
    guideCordisExplanation:
      `### What you can create\n\nCreator mode includes the standard task tools and adds runtime inspection. Standard and Creator share the dsh-doc guidance for plugin and preset development. The agent can create a plugin that adds a capability or UI, or a preset that combines tools and prompts for a particular job.\n\n### Plugins and modes\n\nA plugin adds capabilities to ${L}, such as a tool, a service connection, or a UI entry. A mode is an agent preset that selects tools and defines how the agent works in a task. A plugin can be included in a custom preset.\n\n### How the result takes effect\n\nAsk the agent to install and verify the result, not just generate source code. A plugin may load immediately or require a restart, depending on what it changes. A newly created preset is selected when starting a new task.`,
    guideCordisUsage:
      '### Add a UI\n\n> Create a plugin that adds a project notes entry to the sidebar. Let me browse the Markdown files in this workspace and preview a selected note. Install it and verify that the page opens.\n\nExpected output: an installed plugin with a working entry and preview page, plus any remaining activation steps.\n\n### Add a tool\n\n> Create a plugin with a tool that reads this project’s test report and summarizes the failed tests. Register it and verify it with a sample report.\n\nExpected output: a plugin with a callable tool and a verified sample call.\n\n### Create my own mode\n\n> Create a “Code review” mode based on Standard mode. Have it prioritize potential bugs and test gaps, cite file paths and lines, and ask before modifying files. Save it as a selectable preset.\n\nExpected output: a custom preset for new tasks. These review instructions guide the agent; permission settings determine which actions it can execute.',
    guideStandardExplanation:
      `### How it works\n\nThe agent calls tools directly to read and edit files, search, and run terminal commands. It includes Skills, planning, goals, subagents, workflows, plugin management, and context compaction.\n\nFor questions about ${L} and plugin or preset work you request, the dsh-doc skill guides the agent to the installed documentation and source. Its instructions load only when requested or relevant; loading it does not change files, tools, or the profile.\n\n### When to choose it\n\nStart here for everyday coding, file work, and research. Standard mode can also write scripts and process files in batches. PTC changes how tool calls are organized; it is not required for batch tasks.`,
    presetCordisDescription: `Customize ${L} through conversation. Let the agent write plugins that add features or UI, or combine tools and prompts to create your own mode.`,
    sectionIntro: `Choose the agent’s tools and how it works. Use Standard mode for everyday tasks, or Creator mode to add capabilities to ${L}.`,
  },

  'settings.models': {
    // 我们新写的（待定稿），对应中文那一段。
    welcomeBody: `${L} is still in preview. Features and the interface will keep changing as we refine them; feedback and suggestions are welcome.`,
  },

  shortcuts: {
    'desktop-reload': 'restart the app',
    future: `Shortcut configuration in {location} was created by a newer version. Upgrade ${L} and try again.`,
  },

  sidebarOffice: {
    unavailable: `Office previews are unavailable. Enable the document preview service on the computer running ${L}.`,
  },
}

/** 语言包 id → 覆盖表。 */
export const COPY_OVERRIDES: Readonly<Record<(typeof LANGUAGE_PACKS)[number]['id'], Overrides>> = {
  'zh-CN': ZH_CN,
  'en-US': EN_US,
}
