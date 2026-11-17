// 把 Mermaid 语法的图渲染成静态 SVG。构建时在 Node 里做，页面不带图表脚本。
//
// 文档里的图仍然写在 ```mermaid 代码块里：在 GitHub 上由 GitHub 渲染，在站点上由这里渲染。
// 渲染器是 Pele。它的排版是自己的，和 GitHub 上排出来的不一样。
// 它只输出 CSS 变量，颜色与字体由 styles/diagrams.css 接到站点的主题上，这里不写任何颜色。

import { createHash } from 'node:crypto';
import { PeleError, render } from 'pele';

/**
 * 图按这个宽度排版。正文一栏的宽度随窗口变（实测：窗口 1280 时 517，1440 时 677，1920 时 825），
 * 这里取一个偏窄的值：排不进这个宽度的图（节点多的流程图、参与者多的时序图）会略宽一些，
 * 现有的图最宽 689，窗口 1440 时几乎不缩，窗口 1280 时正好缩到 DIAGRAM_MIN_SCALE。
 * 一栏再窄（手机）就不再缩小，改成横向滚动，见 styles/diagrams.css。
 */
export const DIAGRAM_MAX_WIDTH = 640;

/** 图最多缩到原大小的这个比例 */
export const DIAGRAM_MIN_SCALE = 0.75;

/** 流程图里一个节点的文字超过这个宽度就折行。Pele 缺省是 200，中文断得太碎；再宽，节点多的图就排不进版心 */
const WRAPPING_WIDTH = 260;

export interface RenderedDiagram {
  svg: string;
  width: number;
  height: number;
  /** 图的种类，例如 flowchart、sequence、state */
  type: string;
}

export class DiagramError extends Error {
  /** 出错的位置在图的源码里是第几行，从 1 起；定位不到时是 0 */
  readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'DiagramError';
    this.line = line;
  }
}

/**
 * idPrefix 加在 SVG 内部的 id 前面。一个页面上有几张图，id 不能重复。
 */
export function renderDiagram(source: string, idPrefix: string): RenderedDiagram {
  try {
    const result = render(source, {
      fontSize: 14,
      maxWidth: DIAGRAM_MAX_WIDTH,
      // 横排的图比版心宽、改成竖排又更窄的时候，改成竖排。
      // 断点要比 maxWidth 大：Pele 只在 maxWidth 小于断点时才改方向，缺省的断点是 640。
      autoDirection: true,
      directionBreakpoint: DIAGRAM_MAX_WIDTH + 1,
      config: { flowchart: { wrappingWidth: WRAPPING_WIDTH } },
      idPrefix,
      // 文档里的图不需要链接和外部图片，关掉省得多一个入口
      links: false,
      images: false,
    });
    return { svg: result.svg, width: result.width, height: result.height, type: result.type };
  } catch (error) {
    if (error instanceof PeleError) throw new DiagramError(error.message, error.line);
    throw error;
  }
}

/** 由「文件 + 第几张图」得出稳定的 id 前缀：同样的输入在哪台机器上构建都一样 */
export function diagramId(file: string, index: number): string {
  const digest = createHash('sha256').update(`${file}#${index}`).digest('hex');
  return `d${digest.slice(0, 8)}`;
}
