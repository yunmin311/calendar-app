// 海报渲染核心 —— 纯函数, 吃数据模型, 吐一段 SVG 字符串 (mm 坐标)。
// 无 DOM 依赖 → 浏览器(App/单文件稿)与 node(构建脚本)都能跑。
// 方向② 暖·手作·编辑, 值见 theme.js。
import { theme } from './theme.js';
import { geometry, cellRect, dayCenterX } from './layout.js';
import { MONTHS_ZH, MONTHS_NUM, daysInMonth, dow, isWeekend, iso } from '../data/model.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 字号(mm)
const FS = {
  year: 20, title: 8, meta: 2.9, axis: 3.2,
  mName: 6.2, mNum: 3.4, note: 2.7, msStar: 3.8, msLabel: 3.2, foot: 2.8,
};

function T(x, y, str, o = {}) {
  const a = [`x="${r(x)}"`, `y="${r(y)}"`, `font-size="${o.size || 3}"`, `fill="${o.fill || theme.ink}"`];
  if (o.font) a.push(`font-family='${o.font}'`);
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.spacing) a.push(`letter-spacing="${o.spacing}"`);
  if (o.style) a.push(`font-style="${o.style}"`);
  return `<text ${a.join(' ')}>${esc(str)}</text>`;
}
const R = (x, y, w, h, fill, extra = '') => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}" ${extra}/>`;
const L = (x1, y1, x2, y2, stroke, w) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-width="${w}"/>`;
const r = (n) => Math.round(n * 100) / 100;

export function posterSVG(model, opts = {}) {
  const g = geometry();
  const { year, categories = [], days = {}, milestones = [] } = model;
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const p = [];

  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.PAGE.w} ${g.PAGE.h}" width="100%" preserveAspectRatio="xMidYMid meet" font-family='${theme.fonts.serif}'>`);

  // 纸纹噪声滤镜
  p.push(`<defs><filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs>`);

  // 底: 暖纸
  p.push(R(0, 0, g.PAGE.w, g.PAGE.h, theme.paper));

  // ---- 报头 ----
  p.push(T(g.contentX, g.contentY + 20, String(year), { size: FS.year, fill: theme.ink, anchor: 'start' }));
  p.push(T(g.contentX + 52, g.contentY + 18, '线性年历', { size: FS.title, font: theme.fonts.kai, fill: theme.ink, spacing: 3 }));
  const mx = g.gridRight;
  p.push(T(mx, g.contentY + 7,  '年度叙事 · 一纸看尽', { size: FS.meta, fill: theme.inkSoft, anchor: 'end' }));
  p.push(T(mx, g.contentY + 13, 'Format A1 · 841×594 mm', { size: FS.meta, fill: theme.inkSoft, anchor: 'end' }));
  p.push(T(mx, g.contentY + 19, 'Almanac Edition', { size: FS.meta, fill: theme.inkSoft, anchor: 'end' }));
  // 报头强分隔线
  p.push(L(g.contentX, g.mastheadRuleY, g.gridRight, g.mastheadRuleY, theme.ink, 0.6));

  // ---- 顶部日刻度 1..31 ----
  for (let d = 1; d <= 31; d++) {
    p.push(T(dayCenterX(g, d), g.axisY + g.AXIS_H * 0.72, String(d), { size: FS.axis, fill: theme.inkSoft, anchor: 'middle' }));
  }
  // 刻度下强线(横跨月份栏+网格)
  p.push(L(g.contentX, g.cellsTop, g.gridRight, g.cellsTop, theme.ink, 0.5));

  // ---- 12 月行 ----
  for (let m = 0; m < 12; m++) {
    const rowY = g.cellsTop + m * g.rowH;
    const rowMid = rowY + g.rowH * 0.5;
    const dim = daysInMonth(year, m);

    // 单元格层
    for (let d = 1; d <= 31; d++) {
      const c = cellRect(g, m, d);
      if (d > dim) { // 无效日: 极淡斜纹
        p.push(`<line x1="${r(c.x + c.w * 0.34)}" y1="${r(c.y + c.h * 0.62)}" x2="${r(c.x + c.w * 0.66)}" y2="${r(c.y + c.h * 0.38)}" stroke="${theme.line}" stroke-width="0.3" opacity="0.6"/>`);
        continue;
      }
      const wknd = isWeekend(year, m, d);
      if (wknd) p.push(R(c.x, c.y, c.w, c.h, theme.paper2));

      const rec = days[iso(year, m, d)] || {};
      const cat = rec.categoryId ? catById[rec.categoryId] : null;
      if (cat) {
        if (cat.render === 'dot') {
          p.push(`<circle cx="${r(c.x + c.w * 0.5)}" cy="${r(c.y + c.h * 0.5)}" r="1.2" fill="${cat.color}" opacity="0.9"/>`);
        } else {
          p.push(R(c.x, c.y, c.w, c.h, cat.color));
        }
      }
      // 周日: 左缘赭黄细标
      if (dow(year, m, d) === 0) p.push(R(c.x, c.y + c.h * 0.22, 0.5, c.h * 0.56, theme.ochre));
      // 备注: 楷体小字(截断 4 字)
      if (rec.note) {
        const t = String(rec.note).slice(0, 4);
        p.push(T(c.x + c.w * 0.5, rowMid + 0.8, t, { size: FS.note, font: theme.fonts.kai, fill: theme.ink, anchor: 'middle' }));
      }
    }

    // 月份栏: 名(楷体, 左) + 号(赭黄, 栏右)
    p.push(T(g.contentX, rowMid + FS.mName * 0.35, MONTHS_ZH[m], { size: FS.mName, font: theme.fonts.kai, fill: theme.ink, anchor: 'start', spacing: 1 }));
    p.push(T(g.gridLeft - 3, rowMid + FS.mNum * 0.35, MONTHS_NUM[m], { size: FS.mNum, fill: theme.ochre, anchor: 'end' }));

    // 行底发丝分隔
    p.push(L(g.contentX, rowY + g.rowH, g.gridRight, rowY + g.rowH, theme.line, 0.3));
  }

  // ---- 里程碑(最上层): 赭黄星标 + 楷体斜标签 ----
  for (const ms of milestones) {
    const [y, mo, d] = ms.date.split('-').map(Number);
    if (y !== year) continue;
    const c = cellRect(g, mo - 1, d);
    p.push(T(c.x + 1.4, c.y + 4, '✳', { size: FS.msStar, fill: theme.ochre, anchor: 'start' }));
    // 标签淡纸底衬, 保证压在纹理上也读得清
    const lw = (ms.label || '').length * FS.msLabel + 2;
    p.push(R(c.x + 1.2, c.y + 5.4, Math.min(lw, g.cellW * 3), FS.msLabel + 1.4, theme.paper, 'opacity="0.72"'));
    p.push(T(c.x + 1.8, c.y + 5.4 + FS.msLabel, ms.label || '', { size: FS.msLabel, font: theme.fonts.kai, fill: theme.ink, anchor: 'start' }));
  }

  // ---- 页脚: 图例 + 印刷规格 ----
  const footBase = g.footerY + g.FOOTER_H * 0.5;
  p.push(L(g.contentX, g.footerY, g.gridRight, g.footerY, theme.line, 0.3));
  let lx = g.contentX;
  const legend = [{ color: theme.ochre, name: '里程碑', box: true }, ...categories.map((c) => ({ color: c.color, name: c.name, box: c.render !== 'dot', dot: c.render === 'dot' }))];
  for (const it of legend) {
    if (it.dot) p.push(`<circle cx="${r(lx + 1.4)}" cy="${r(footBase - 0.6)}" r="1.2" fill="${it.color}"/>`);
    else p.push(R(lx, footBase - 2, 2.8, 2.8, it.color, `stroke="${theme.line}" stroke-width="0.2"`));
    p.push(T(lx + 4, footBase, it.name, { size: FS.foot, fill: theme.inkSoft, anchor: 'start' }));
    lx += 4 + it.name.length * FS.foot + 6;
  }
  p.push(T(g.gridRight, footBase, '印刷级 · CMYK · 3mm 出血 · 嵌字', { size: FS.foot, fill: theme.inkSoft, anchor: 'end' }));

  // ---- 纸纹(最上层, 极低透明度, 正片叠底) ----
  p.push(`<rect x="0" y="0" width="${g.PAGE.w}" height="${g.PAGE.h}" filter="url(#paper)" opacity="0.045" style="mix-blend-mode:multiply"/>`);

  p.push('</svg>');
  return p.join('');
}
