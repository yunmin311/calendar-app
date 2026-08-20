// 活动留痕渲染核心 —— 吃「活动视图模型」(activity.toRecordModel), 吐 SVG 字符串。
// 复用 layout.js 几何(12 月行×31 日列 A1 线性)。两个变体:
//   'editorial-rubbing'  B 升级: 方向②暖·编辑骨架 + 拓印剥蚀质感 + 朱砂印
//   'tuogu-ink'          A 替换: 活动"拓成墨", 当天做得越多墨越浓(破边+剥蚀), 素纸留白, 朱砂印
import { geometry, cellRect, dayCenterX } from './layout.js';
import { MONTHS_ZH, MONTHS_NUM, daysInMonth, dow, isWeekend, iso } from '../data/model.js';
import { resolveTexture } from '../texture/index.js';
import { inkOpacity, legendItems } from './paint.js';

const KAI = '"KaiTi","STKaiti","楷体","LXGW WenKai",serif';
const SER = 'Georgia,"Times New Roman","Songti SC",serif';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r = (n) => Math.round(n * 100) / 100;
const T = (x, y, str, o = {}) => {
  const a = [`x="${r(x)}"`, `y="${r(y)}"`, `font-size="${o.size || 3}"`, `fill="${o.fill || '#000'}"`, `font-family='${o.font || SER}'`];
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.spacing) a.push(`letter-spacing="${o.spacing}"`);
  return `<text ${a.join(' ')}>${esc(str)}</text>`;
};
const R = (x, y, w, h, fill, extra = '') => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}" ${extra}/>`;
const L = (x1, y1, x2, y2, stroke, w) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-width="${w}"/>`;

const V = {
  'editorial-rubbing': {
    paper: '#f4efe3', paper2: '#eaded0', ink: '#20201b', inkSoft: '#8c8371', line: '#d9cfb9',
    seal: '#9e3b32', mono: false, weekendTint: true, texOp: 0.15, texFreq: 0.06, speckle: true, speckleOp: 0.22,
    era: '2026', title: '活动留痕', sub1: 'CO · 一纸看尽', sub2: 'Record Edition',
  },
  'tuogu-ink': {
    paper: '#e6d9bf', paper2: '#e0d2b4', ink: '#1c160d', inkSoft: '#8a7a5c', line: '#c9b892',
    seal: '#9e3b32', mono: true, weekendTint: false, texOp: 0.16, texFreq: 0.05, speckle: true, speckleOp: 0.34,
    era: '丙午', title: '活动留痕', sub1: '金石 · 一纸留痕', sub2: '拓本',
  },
};

// 导出变体配置, 供 exportPdf 复用同一套色值/纹理参数(单一真源, 屏幕=印刷同参)
export const RECORD_VARIANTS = V;

// 纸色晕同 renderMonth: 「出版」类的格底也是朱砂, 不套晕印章会糊在自己那类格子上
function seal(x, y, label, c) {
  const s = 4.2;
  return R(x - 0.5, y - 0.5, s + 1, s + 1, c.paper, 'opacity="0.9"')
    + R(x, y, s, s, c.seal)
    + `<rect x="${r(x + 0.5)}" y="${r(y + 0.5)}" width="${r(s - 1)}" height="${r(s - 1)}" fill="none" stroke="#f4efe3" stroke-width="0.25"/>`
    + T(x + s + 1.2, y + s - 0.9, label || '', { size: 3.0, font: KAI, fill: c.ink, anchor: 'start' });
}

export function renderRecord(model, opts = {}) {
  const variant = opts.variant || model.variant || 'editorial-rubbing';
  const c = V[variant] || V['editorial-rubbing'];
  const g = geometry();
  const { year, categories = [], days = {}, milestones = [] } = model;
  const catById = Object.fromEntries(categories.map((x) => [x.id, x]));
  const p = [];

  // 手工质感: 由 texture 模块统一供给(可换预设/可编辑参数, 见 src/texture/index.js)
  const tex = resolveTexture(opts.texture, c);
  const texture = tex.build(g.PAGE.w, g.PAGE.h, 'yt');

  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.PAGE.w} ${g.PAGE.h}" width="100%" preserveAspectRatio="xMidYMid meet" font-family='${SER}'>`);
  p.push(`<defs>`);
  p.push(texture.defs);
  // 拓痕破边: 墨层用 turbulence 位移, 边缘不再是死板矩形(保住密度=墨深)
  p.push(`<filter id="rub" x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.09 0.13" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>`);
  p.push(`</defs>`);

  // 底: 仿古纸
  p.push(R(0, 0, g.PAGE.w, g.PAGE.h, c.paper));

  // 报头
  p.push(T(g.contentX, g.contentY + 20, c.era, { size: 20, font: c.mono ? KAI : SER, fill: c.ink }));
  p.push(T(g.contentX + (c.mono ? 30 : 52), g.contentY + 18, c.title, { size: 8, font: KAI, fill: c.ink, spacing: 3 }));
  const mx = g.gridRight;
  p.push(T(mx, g.contentY + 7, c.sub1, { size: 2.9, font: KAI, fill: c.inkSoft, anchor: 'end' }));
  p.push(T(mx, g.contentY + 13, 'Format A1 · 841×594 mm', { size: 2.9, fill: c.inkSoft, anchor: 'end' }));
  p.push(T(mx, g.contentY + 19, c.sub2, { size: 2.9, font: KAI, fill: c.inkSoft, anchor: 'end' }));
  p.push(L(g.contentX, g.mastheadRuleY, g.gridRight, g.mastheadRuleY, c.ink, 0.6));

  // 顶部日刻度
  for (let d = 1; d <= 31; d++) p.push(T(dayCenterX(g, d), g.axisY + g.AXIS_H * 0.72, String(d), { size: 3.2, fill: c.inkSoft, anchor: 'middle' }));
  p.push(L(g.contentX, g.cellsTop, g.gridRight, g.cellsTop, c.ink, 0.5));

  // 单元层(墨/色块) 与 标注层(月名/号/行线) 分开, 便于给墨层整体套破边+剥蚀
  const cells = [];
  const labels = [];
  for (let m = 0; m < 12; m++) {
    const rowY = g.cellsTop + m * g.rowH;
    const rowMid = rowY + g.rowH * 0.5;
    const dim = daysInMonth(year, m);
    for (let d = 1; d <= 31; d++) {
      const cell = cellRect(g, m, d);
      if (d > dim) continue;
      const rec = days[iso(year, m, d)];
      // 注: 「出版」这一类以前被排除在墨格外(留给朱砂印), 结果是没打里程碑标的出版活动
      // 在图上完全消失、统计里却算着 —— 静默丢数据。现在照常落墨, 朱砂印只认 milestone 标。
      if (c.mono) {
        if (rec) cells.push(R(cell.x, cell.y, cell.w, cell.h, c.ink, `opacity="${inkOpacity(rec.intensity, { mono: true, carrier: 'year' })}"`));
      } else {
        if (c.weekendTint && isWeekend(year, m, d)) cells.push(R(cell.x, cell.y, cell.w, cell.h, c.paper2));
        if (rec) { const cat = catById[rec.categoryId]; if (cat) cells.push(R(cell.x, cell.y, cell.w, cell.h, cat.color, `opacity="${inkOpacity(rec.intensity, { carrier: 'year' })}"`)); }
        if (dow(year, m, d) === 0) cells.push(R(cell.x, cell.y + cell.h * 0.22, 0.5, cell.h * 0.56, c.seal));
      }
    }
    labels.push(T(g.contentX, rowMid + 2.2, MONTHS_ZH[m], { size: 6.2, font: KAI, fill: c.ink, spacing: 1 }));
    labels.push(T(g.gridLeft - 3, rowMid + 1.2, MONTHS_NUM[m], { size: 3.4, fill: c.mono ? c.inkSoft : c.seal, anchor: 'end' }));
    labels.push(L(g.contentX, rowY + g.rowH, g.gridRight, rowY + g.rowH, c.line, c.mono ? 0.22 : 0.3));
  }
  // 墨层: A 全拓套破边滤镜 → 拓痕质感, 密度(墨深)保留
  if (c.mono) p.push(`<g filter="url(#rub)">${cells.join('')}</g>`);
  else p.push(cells.join(''));
  p.push(labels.join(''));

  // 里程碑 = 朱砂印
  for (const ms of milestones) {
    const [y, mo, d] = String(ms.date).split('-').map(Number);
    if (y !== Number(year)) continue;   // 年份可能是字符串, 硬比会把所有印全滤掉(实测过)
    const cell = cellRect(g, mo - 1, d);
    p.push(R(cell.x + 6, cell.y + 0.6, Math.min((ms.label || '').length * 3.0 + 1.5, g.cellW * 3), 4.4, c.paper, 'opacity="0.72"'));
    p.push(seal(cell.x + 1, cell.y + 1, ms.label, c));
  }

  // 页脚
  const fb = g.footerY + g.FOOTER_H * 0.5;
  p.push(L(g.contentX, g.footerY, g.gridRight, g.footerY, c.line, 0.3));
  let lx = g.contentX;
  const legend = legendItems(model, c);   // 只列图上真出现过的分类 + 里程碑(见 paint.js)
  const legendLimit = g.gridRight - 92; // 右侧留给印刷标注; 分类多时图例排到这儿为止
  for (const it of legend) {
    if (lx + 4 + it.name.length * 2.8 > legendLimit) { p.push(T(lx, fb, '…', { size: 2.8, fill: c.inkSoft })); break; }
    if (it.ink) p.push(R(lx, fb - 2, 2.8, 2.8, c.ink, 'opacity="0.8"'));
    else p.push(R(lx, fb - 2, 2.8, 2.8, it.color, `stroke="${c.line}" stroke-width="0.2"`));
    p.push(T(lx + 4, fb, it.name, { size: 2.8, font: KAI, fill: c.inkSoft, anchor: 'start' }));
    lx += 4 + it.name.length * 2.8 + 6;
  }
  p.push(T(g.gridRight, fb, '印刷级 · CMYK · 3mm 出血 · 嵌字', { size: 2.8, font: KAI, fill: c.inkSoft, anchor: 'end' }));

  // 纸面手工质感(最上层)
  p.push(texture.body);

  p.push('</svg>');
  return p.join('');
}
