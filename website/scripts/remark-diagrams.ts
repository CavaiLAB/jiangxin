// Rspress 的 remark 插件：把 ```mermaid 代码块换成构建时渲染好的 SVG。
//
// 产物是一个 <div class="diagram">，SVG 作为它的 HTML 内容直接写进页面，不需要任何前端组件。
// 图画不出来（语法错、用了渲染器不支持的写法）就让构建失败，和死链一样对待。

import path from 'node:path';
import { DIAGRAM_MIN_SCALE, DiagramError, diagramId, renderDiagram } from './diagrams.ts';

interface MarkdownNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MarkdownNode[];
  position?: { start: { line: number } };
  [key: string]: unknown;
}

interface MarkdownFile {
  path?: string;
}

type Json = string | number | boolean | null | { [key: string]: Json };

export interface DiagramsOptions {
  /** 站点的文档根目录。报错与 id 里用的是相对它的路径 */
  docsDir: string;
}

export function remarkDiagrams(options: DiagramsOptions): (tree: MarkdownNode, file: MarkdownFile) => void {
  return (tree, file) => {
    const name = file.path === undefined ? '' : path.relative(options.docsDir, file.path).split(path.sep).join('/');
    let count = 0;

    const visit = (node: MarkdownNode): void => {
      node.children?.forEach((child, index, siblings) => {
        if (child.type === 'code' && child.lang === 'mermaid') {
          count += 1;
          siblings[index] = diagramNode(child, name, count);
        } else {
          visit(child);
        }
      });
    };
    visit(tree);
  };
}

function diagramNode(code: MarkdownNode, file: string, index: number): MarkdownNode {
  let rendered;
  try {
    rendered = renderDiagram(code.value ?? '', diagramId(file, index));
  } catch (error) {
    if (!(error instanceof DiagramError)) throw error;
    // 代码块的围栏占一行，图的第 1 行在围栏的下一行
    const line = (code.position?.start.line ?? 0) + error.line;
    throw new Error(`${file}:${line} 这张图渲染不出来：${error.message}`);
  }

  return {
    type: 'mdxJsxFlowElement',
    name: 'div',
    attributes: [
      { type: 'mdxJsxAttribute', name: 'className', value: 'diagram' },
      spreadAttribute({
        style: { '--diagram-min-width': `${Math.round(rendered.width * DIAGRAM_MIN_SCALE)}px` },
        dangerouslySetInnerHTML: { __html: rendered.svg },
      }),
    ],
    children: [],
  };
}

// JSX 里的 {...{ 键: 值 }}。MDX 不解析 value 里的文字，用的是 data.estree，所以这里直接给出语法树
function spreadAttribute(props: { [key: string]: Json }): MarkdownNode {
  return {
    type: 'mdxJsxExpressionAttribute',
    value: `...${JSON.stringify(props)}`,
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ExpressionStatement',
            expression: { type: 'ObjectExpression', properties: [{ type: 'SpreadElement', argument: toEstree(props) }] },
          },
        ],
      },
    },
  };
}

function toEstree(value: Json): unknown {
  if (value === null || typeof value !== 'object') {
    return { type: 'Literal', value, raw: JSON.stringify(value) };
  }
  return {
    type: 'ObjectExpression',
    properties: Object.entries(value).map(([key, item]) => ({
      type: 'Property',
      kind: 'init',
      method: false,
      shorthand: false,
      computed: false,
      key: { type: 'Literal', value: key, raw: JSON.stringify(key) },
      value: toEstree(item),
    })),
  };
}
