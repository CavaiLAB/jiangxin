/**
 * 匠心的配色，全部集中在这个文件里。
 *
 * 这是初稿，最后要产品负责人定。色值从 logo（brand/source/icon-1024.png）取样得到：
 * 龙虾身体的红色中位数约 #C74934，安全帽的黄色中位数约 #E1C650。
 * 下面的色阶是围绕这两个颜色调出来的，目的是让文字对比度过关（见 tests/contrast.test.ts）。
 *
 * 做法：不新增主题，只在 DSH 的深浅两套主题上各叠一层变量覆盖（ctx.theme.overrideTokens）。
 * 所以用户在「设置 → 外观」里选浅色、深色、跟随系统，匠心的颜色都跟着走。
 * 每个变量必须同时给出浅色和深色两个值，这是 DSH 接口的硬性要求。
 */

/** 匠心红：取自龙虾。数字越大越深。 */
export const RED = {
  50: '#FBEAE5',
  300: '#F4A08B',
  350: '#F29480',
  400: '#F0806A',
  450: '#EC6D55',
  500: '#C74934', // logo 取样的中位数
  600: '#BD3F2B',
  650: '#B23A26',
  700: '#A63522',
  800: '#7F2A1B',
  900: '#3A1F1A',
} as const

/** 安全帽黄：取自安全帽。 */
export const YELLOW = {
  400: '#E1C650', // logo 取样的中位数
  600: '#B8860B',
} as const

/** 一个变量在浅色、深色两套主题下的值。 */
export interface TokenModes {
  readonly light: string
  readonly dark: string
}

/**
 * 叠在 DSH 主题上的变量覆盖。键是 DSH 的语义变量名。
 *
 * DSH 原来的强调色是蓝色（--dsw-static-deepseek-*），主按钮是黑白。
 * 这里把强调色换成匠心红，主按钮也用匠心红，选中边框用安全帽黄；中性色（背景、文字、边框）不动。
 * DSH 的语义变量里引用蓝色的都在这里换了，只留了一个：--dsw-alias-chart-messages
 *（用量图表里「消息」这一组数据的颜色）。那是数据系列的配色，跟别的系列要分得开，不算品牌色。
 */
export const BRAND_TOKENS: Readonly<Record<string, TokenModes>> = {
  // 主按钮、开关的开启态、复选框的勾选色。
  // 浅色主题上面是白字（对比 5.4），深色主题上面是墨色字（对比 7.2）。
  '--dsw-alias-brand-primary': { light: RED[600], dark: RED[400] },
  '--dsw-alias-button-primary-fill': { light: RED[600], dark: RED[400] },
  '--dsw-alias-button-primary-hover': { light: RED[700], dark: RED[300] },

  // 强调色：发送按钮、焦点环、选中的页签、输入光标、标签。既当文字用也当底色用。
  '--dsw-alias-state-business-primary': { light: RED[600], dark: RED[450] },
  // 强调色的浅底：选中行、提及的底色、首页的「预览版」徽标。
  '--dsw-alias-state-business-tertiary': { light: RED[50], dark: RED[900] },
  '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: RED[600], dark: RED[450] },
  // 首页「预览版」徽标上的字（底色是上面那个强调色浅底）。DSH 浅色主题下是深蓝，换成深红；
  // 深色主题下本来就是近白的中性色，原样写回。
  '--dsw-alias-label-primary-bluish': { light: RED[800], dark: 'var(--dsw-static-neutral-bluish-50)' },

  // 链接。
  '--dsw-alias-link': { light: RED[650], dark: RED[350] },

  // 信息按钮（白字）。深色主题下特意用更深的红，保证白字对比度不低于 4.5。
  '--dsw-alias-button-info-fill': { light: RED[600], dark: RED[500] },
  '--dsw-alias-button-info-hover': { light: RED[700], dark: RED[600] },
  // 提示条里的操作文字（提示条在两套主题下都是深色底）。
  '--dsw-alias-toast-action': { light: RED[300], dark: RED[300] },

  // 「深度思考中」这类进行中的文字和它的流光。
  '--dsw-alias-label-deep-diving': { light: RED[700], dark: RED[400] },
  '--dsw-alias-label-deep-diving-shimmer': { light: RED[450], dark: '#F8C4B6' },
  // 轨迹视图里当前轮次的高亮。
  '--dsw-alias-trajectory-accent': { light: RED[600], dark: RED[450] },

  // 选中的选项卡片的边框：安全帽黄。
  '--dsw-alias-border-selected': { light: YELLOW[600], dark: YELLOW[400] },

  // 用户消息气泡、左侧栏当前项：DSH 浅色主题下是淡蓝，换成很淡的暖色；
  // 深色主题下 DSH 本来就是中性灰，原样保留（接口要求两个值都给，所以把它的原值写回去）。
  '--dsw-specific-bubble': { light: '#FBF1ED', dark: 'var(--dsw-static-neutral-bluish-850)' },
  '--dsw-specific-bubble-highlight': { light: '#F7D9D0', dark: 'var(--dsw-static-neutral-bluish-750)' },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: '#F9E4DD', dark: 'var(--dsw-static-neutral-bluish-800)' },
}

/**
 * 要检查对比度的「文字色 / 底色」组合，tests/contrast.test.ts 逐条验证。
 * min 是 WCAG 2 的门槛：正文 4.5，图标和大字 3。
 */
export const CONTRAST_PAIRS: readonly {
  readonly name: string
  readonly mode: 'light' | 'dark'
  readonly text: string
  readonly background: string
  readonly min: number
}[] = [
  // DSH 的中性色（出处：ui-theme/src/styles/design-platform.css）：
  // 浅色页面底 #FFFFFF，深色页面底 rgb(21,21,23)，深色浮层 rgb(35,35,36)，墨色 rgb(15,17,21)。
  { name: '主按钮：白字 / 匠心红', mode: 'light', text: '#FFFFFF', background: RED[600], min: 4.5 },
  { name: '主按钮悬停：白字 / 深红', mode: 'light', text: '#FFFFFF', background: RED[700], min: 4.5 },
  { name: '主按钮：墨色字 / 浅红', mode: 'dark', text: '#0F1115', background: RED[400], min: 4.5 },
  { name: '主按钮悬停：墨色字 / 更浅的红', mode: 'dark', text: '#0F1115', background: RED[300], min: 4.5 },
  { name: '强调色文字 / 白底', mode: 'light', text: RED[600], background: '#FFFFFF', min: 4.5 },
  { name: '强调色文字 / 强调色浅底', mode: 'light', text: RED[600], background: RED[50], min: 4.5 },
  { name: '强调色文字 / 深色页面底', mode: 'dark', text: RED[450], background: '#151517', min: 4.5 },
  { name: '强调色文字 / 深色浮层', mode: 'dark', text: RED[450], background: '#232324', min: 4.5 },
  { name: '强调色文字 / 强调色深底', mode: 'dark', text: RED[450], background: RED[900], min: 4.5 },
  { name: '发送按钮：白色图标 / 匠心红', mode: 'light', text: '#FFFFFF', background: RED[600], min: 3 },
  { name: '发送按钮：白色图标 / 深色主题的强调色', mode: 'dark', text: '#FFFFFF', background: RED[450], min: 3 },
  { name: '链接 / 白底', mode: 'light', text: RED[650], background: '#FFFFFF', min: 4.5 },
  { name: '链接 / 深色页面底', mode: 'dark', text: RED[350], background: '#151517', min: 4.5 },
  { name: '信息按钮：白字 / 匠心红', mode: 'light', text: '#FFFFFF', background: RED[600], min: 4.5 },
  { name: '信息按钮：白字 / logo 红', mode: 'dark', text: '#FFFFFF', background: RED[500], min: 4.5 },
  { name: '进行中文字 / 白底', mode: 'light', text: RED[700], background: '#FFFFFF', min: 4.5 },
  { name: '进行中文字 / 深色页面底', mode: 'dark', text: RED[400], background: '#151517', min: 4.5 },
  { name: '选中边框 / 白底', mode: 'light', text: YELLOW[600], background: '#FFFFFF', min: 3 },
  { name: '选中边框 / 深色页面底', mode: 'dark', text: YELLOW[400], background: '#151517', min: 3 },
  { name: '正文墨色 / 用户气泡浅底', mode: 'light', text: '#0F1115', background: '#FBF1ED', min: 4.5 },
  { name: '「预览版」徽标：深红字 / 强调色浅底', mode: 'light', text: RED[800], background: RED[50], min: 4.5 },
  // DSH 深色主题里 neutral-bluish-50 是 rgb(249,250,251)。
  { name: '「预览版」徽标：近白字 / 强调色深底', mode: 'dark', text: '#F9FAFB', background: RED[900], min: 4.5 },
]
