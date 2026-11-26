import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIAGRAM_MAX_WIDTH, DIAGRAM_MIN_SCALE, DiagramError, diagramId, renderDiagram } from './diagrams.ts';
import { remarkDiagrams } from './remark-diagrams.ts';

// ---------- 渲染 ----------

test('流程图渲染成 SVG，颜色只走 CSS 变量', () => {
  const diagram = renderDiagram('flowchart TB\n  A["人"] --> B["智能体"]\n', 'dtest');
  assert.match(diagram.svg, /^<svg [^>]*class="pele pele-flowchart"/);
  assert.equal(diagram.type, 'flowchart');
  assert.ok(diagram.svg.includes('>人<') && diagram.svg.includes('>智能体<'));
  // 根元素上是「变量，缺省值」；图元上不出现写死的颜色，这样亮色暗色只靠样式表切换
  assert.match(diagram.svg, /var\(--pele-bg,/);
  assert.doesNotMatch(diagram.svg, /(fill|stroke)="#/);
  assert.ok(diagram.width > 0 && diagram.width <= DIAGRAM_MAX_WIDTH);
});

test('比版心宽的横排图改成竖排', () => {
  const steps = ['一', '二', '三', '四', '五', '六', '七'];
  const source = [
    'flowchart LR',
    ...steps.map((step, index) => `  N${index}["第${step}步：把这一步要做的事情写清楚"]`),
    `  ${steps.map((_, index) => `N${index}`).join(' --> ')}`,
    '',
  ].join('\n');
  const diagram = renderDiagram(source, 'dtest');
  assert.ok(diagram.width <= DIAGRAM_MAX_WIDTH, `宽 ${diagram.width}`);
  assert.ok(diagram.height > diagram.width, `${diagram.width}×${diagram.height}`);
});

test('放得下的横排图保持横排', () => {
  const diagram = renderDiagram('flowchart LR\n  A["甲"] --> B["乙"] --> C["丙"]\n', 'dtest');
  assert.ok(diagram.width > diagram.height, `${diagram.width}×${diagram.height}`);
});

test('时序图保留自动编号', () => {
  const source = 'sequenceDiagram\n  autonumber\n  participant A as 甲\n  participant B as 乙\n  A->>B: 问\n  B-->>A: 答\n  A->>B: 谢\n';
  const diagram = renderDiagram(source, 'dtest');
  assert.equal(diagram.type, 'sequence');
  for (const number of [1, 2, 3]) assert.match(diagram.svg, new RegExp(`<text[^>]*>${number}</text>`));
});

test('状态图能画', () => {
  const diagram = renderDiagram('stateDiagram-v2\n  state "草稿" as draft\n  [*] --> draft\n  draft --> [*]: 完成\n', 'dtest');
  assert.equal(diagram.type, 'state');
  assert.ok(diagram.svg.includes('草稿'));
});

test('文字里的特殊字符被转义', () => {
  const diagram = renderDiagram('flowchart LR\n  A["a #lt; b #amp; c #quot;d#quot;"] --> B["乙"]\n', 'dtest');
  assert.ok(diagram.svg.includes('a &lt; b &amp; c &quot;d&quot;'));
});

test('语法错误报出是图里的第几行', () => {
  assert.throws(
    () => renderDiagram('flowchart LR\n  A[ --> B\n', 'dtest'),
    (error: unknown) => error instanceof DiagramError && error.line === 2,
  );
});

test('不是图的内容报错', () => {
  assert.throws(() => renderDiagram('这不是图', 'dtest'), DiagramError);
  assert.throws(() => renderDiagram('', 'dtest'), DiagramError);
});

test('id 前缀稳定，不同的图互不相同', () => {
  assert.match(diagramId('04-architecture.md', 1), /^d[0-9a-f]{8}$/);
  assert.equal(diagramId('04-architecture.md', 1), diagramId('04-architecture.md', 1));
  assert.notEqual(diagramId('04-architecture.md', 1), diagramId('04-architecture.md', 2));
  assert.notEqual(diagramId('04-architecture.md', 1), diagramId('05-plugin-model.md', 1));
});

// ---------- remark 插件 ----------

interface TestNode {
  type: string;
  [key: string]: unknown;
}

// 把插件写出的语法树还原成值。MDX 用的就是这棵树，所以断言对着它做
function valueOf(node: any): unknown {
  if (node.type === 'Literal') return node.value;
  assert.equal(node.type, 'ObjectExpression');
  return Object.fromEntries(node.properties.map((property: any) => [property.key.value, valueOf(property.value)]));
}

function propsOf(element: any): { className: unknown; style: Record<string, string>; html: string } {
  const [className, spread] = element.attributes;
  assert.equal(className.type, 'mdxJsxAttribute');
  assert.equal(className.name, 'className');
  assert.equal(spread.type, 'mdxJsxExpressionAttribute');
  const expression = spread.data.estree.body[0].expression;
  assert.equal(expression.type, 'ObjectExpression');
  assert.equal(expression.properties[0].type, 'SpreadElement');
  const props = valueOf(expression.properties[0].argument) as any;
  // value 是给人看的源码形式，要和语法树说的是同一件事
  assert.deepEqual(JSON.parse(spread.value.slice(3)), props);
  return { className: className.value, style: props.style, html: props.dangerouslySetInnerHTML.__html };
}

const code = (lang: string, value: string, line: number): TestNode => ({ type: 'code', lang, value, position: { start: { line } } });

test('mermaid 代码块换成带 SVG 的 div，别的代码块不动', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: '前文' }] },
      code('mermaid', 'flowchart TB\n  A["甲"] --> B["乙"]', 3),
      code('ts', 'const a = 1;', 9),
      { type: 'blockquote', children: [code('mermaid', 'flowchart TB\n  C["丙"] --> D["丁"]', 14)] },
    ],
  };
  remarkDiagrams({ docsDir: '/site/docs' })(tree, { path: '/site/docs/guide/a.md' });

  const [paragraph, first, other, quote] = tree.children as any[];
  assert.equal(paragraph.type, 'paragraph');
  assert.equal(other.type, 'code');

  assert.equal(first.type, 'mdxJsxFlowElement');
  assert.equal(first.name, 'div');
  assert.deepEqual(first.children, []);
  const props = propsOf(first);
  assert.equal(props.className, 'diagram');
  assert.match(props.html, /^<svg [^>]*class="pele pele-flowchart"/);
  assert.ok(props.html.includes('>甲<'));

  // 最小宽度是图的原宽乘以最小缩放比例
  const width = Number(/\bwidth="([\d.]+)"/.exec(props.html)?.[1]);
  assert.deepEqual(props.style, { '--diagram-min-width': `${Math.round(width * DIAGRAM_MIN_SCALE)}px` });

  // 嵌在引用块里的也换
  const nested = quote.children[0];
  assert.equal(nested.type, 'mdxJsxFlowElement');
  assert.ok(propsOf(nested).html.includes('>丙<'));
});

test('图画不出来时报出文件和它在文件里的行号', () => {
  const tree = { type: 'root', children: [code('mermaid', 'flowchart LR\n  A[ --> B', 10)] };
  // 围栏在第 10 行，图的第 2 行就是文件的第 12 行
  assert.throws(
    () => remarkDiagrams({ docsDir: '/site/docs' })(tree, { path: '/site/docs/guide/a.md' }),
    /^Error: guide\/a\.md:12 这张图渲染不出来：/,
  );
});
