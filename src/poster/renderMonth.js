// 单月详情页 —— 吃同一份「活动视图模型」(activity.toRecordModel), 吐单月 SVG(7 列周历大图)。
// 用途: CO 可能要"某个月的活动卡"; 也作整年图的下钻详情。留痕语言与整年图一致:
//   暖拓质纸 · 墨深=当日投入 · 朱砂印=里程碑 · 素纸留白=没活动。
// 自带一套「卡片」几何(竖版 210×280mm), 不复用 layout.js(那是整年长条)。
import { MONTHS_ZH, MONTHS_NUM, daysInMonth, dow, iso } from '../data/model.js';
import { RECORD_VARIANTS } from './renderRecord.js';
import { resolveTexture } from '../texture/index.js';

const KAI = '"KaiTi","STKaiti","楷体","LXGW WenKai",serif';
const SER = 'Georgia,"Times New Roman","Songti SC",serif';
const WK = ['日', '一', '二', '三', '四', '五', '六'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r = (n) => Math.round(n * 100) / 100;
const T = (x, y, str, o = {}) => {
  const a = [`x="${r(x)}"`, `y="${r(y)}"`, `font-size="${o.size || 3}"`, `fill="${o.fill || '#000'}"`, `font-family='${o.font || SER}'`];
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.spacing) a.push(`letter-spacing="${o.spacing}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<text ${a.join(' ')}>${esc(str)}</text>`;
};
const R = (x, y, w, h, fill, extra = '') => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}" ${extra}/>`;
const L = (x1, y1, x2, y2, stroke, w) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-width="${w}"/>`;
const clip = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };

const PAGE = { w: 210, h: 280 };
const M = { l: 16, r: 16, t: 18, b: 16 };
const HEAD_H = 34;      // 报头
const WKROW_H = 8;      // 星期表头
const FOOT_H = 12;      // 页脚图例

function seal(x, y, s, label, c, withLabel) {
  return R(x, y, s, s, c.seal)
    + `<rect x="${r(x + 0.6)}" y="${r(y + 0.6)}" width="${r(s - 1.2)}" height="${r(s - 1.2)}" fill="none" stroke="${c.paper}" stroke-width="0.3"/>`
    + (withLabel && label ? T(x - 0.5, y + s + 3.2, clip(label, 6), { size: 2.7, font: KAI, fill: c.seal, anchor: 'start' }) : '');
}

export function renderMonth(model, monthIndex = 0, opts = {}) {
  const variant = opts.variant || model.variant || 'editorial-rubbing';
  const c = RECORD_VARIANTS[variant] || RECORD_VARIANTS['editorial-rubbing'];
  const mono = !!c.mono;
  const { year, categories = [], days = {}, milestones = [] } = model;
  const catById = Object.fromEntries(categories.map((x) => [x.id, x]));
  const m = Math.max(0, Math.min(11, monthIndex));
  const dim = daysInMonth(year, m);
  const firstDow = dow(year, m, 1);           // 1 号是周几(0=日)
  const weeks = Math.ceil((firstDow + dim) / 7);

  // 几何
  const gridTop = M.t + HEAD_H + WKROW_H;
  const gridBottom = PAGE.h - M.b - FOOT_H;
  const gridLeft = M.l, gridRight = PAGE.w - M.r;
  const colW = (gridRight - gridLeft) / 7;
  const rowH = (gridBottom - gridTop) / weeks;

  // 当月里程碑(date→label)
  const msByDay = {};
  for (const ms of milestones) { const [yy, mo, d] = ms.date.split('-').map(Number); if (yy === year && mo - 1 === m) msByDay[d] = ms.label; }
  // 当月统计
  let activeDays = 0, sumW = 0;
  for (let d = 1; d <= dim; d++) { const rec = days[iso(year, m, d)]; if (rec) { activeDays++; sumW += rec.count || 0; } }

  const p = [];
  // 手工质感: 同一套 texture 模块; 小卡片视口小 → 噪声频率调高、透明度压轻(见 scale)
  const tex = resolveTexture(opts.texture, c, { freqMul: 2.2, opMul: 0.8, speckleFreq: 0.5, speckleOpMul: 0.7 });
  const texture = tex.build(PAGE.w, PAGE.h, 'mt');

  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="100%" preserveAspectRatio="xMidYMid meet" font-family='${SER}'>`);
  p.push(`<defs>${texture.defs}</defs>`);

  // 底: 暖纸
  p.push(R(0, 0, PAGE.w, PAGE.h, c.paper));

  // 报头
  p.push(T(M.l, M.t + 14, MONTHS_ZH[m], { size: 15, font: KAI, fill: c.ink, spacing: 2 }));
  p.push(T(M.l + (mono ? 34 : 40), M.t + 13, MONTHS_NUM[m].toUpperCase(), { size: 4.4, font: SER, fill: c.inkSoft, spacing: 2 }));
  p.push(T(gridRight, M.t + 6, String(year), { size: 8, font: mono ? KAI : SER, fill: c.ink, anchor: 'end' }));
  p.push(T(gridRight, M.t + 12.5, `${activeDays} 天有痕 · 投入 ${sumW}`, { size: 3, font: KAI, fill: c.inkSoft, anchor: 'end' }));
  p.push(L(M.l, M.t + HEAD_H - 6, gridRight, M.t + HEAD_H - 6, c.ink, 0.5));

  // 星期表头
  for (let i = 0; i < 7; i++) {
    const cx = gridLeft + (i + 0.5) * colW;
    p.push(T(cx, M.t + HEAD_H + 4.5, WK[i], { size: 3.4, font: KAI, fill: i === 0 ? c.seal : c.inkSoft, anchor: 'middle' }));
  }

  // 日格
  const cells = [];
  const labels = [];
  for (let d = 1; d <= dim; d++) {
    const idx = firstDow + d - 1;
    const col = idx % 7, row = Math.floor(idx / 7);
    const x = gridLeft + col * colW, y = gridTop + row * rowH;
    const rec = days[iso(year, m, d)];
    // 墨底(强度)
    if (rec && rec.categoryId !== 'publish') {
      const inten = rec.intensity || 0.4;
      if (mono) cells.push(R(x + 0.6, y + 0.6, colW - 1.2, rowH - 1.2, c.ink, `opacity="${r(0.14 + 0.7 * inten)}"`));
      else {
        const cat = catById[rec.categoryId];
        if (cat) cells.push(R(x + 0.6, y + 0.6, colW - 1.2, rowH - 1.2, cat.color, `opacity="${r(0.4 + 0.55 * inten)}"`));
      }
    }
    // 格线
    labels.push(R(x, y, colW, rowH, 'none', `stroke="${c.line}" stroke-width="0.25"`));
    // 日号(老式数字)
    labels.push(T(x + 2, y + 5, String(d), { size: 4, font: SER, fill: col === 0 ? c.seal : c.ink, opacity: rec ? 1 : 0.4 }));
    // 里程碑朱砂印
    if (msByDay[d] != null) labels.push(seal(x + colW - 6, y + 2, 3.8, msByDay[d], c, true));
    // 活动标题(有痕才写)
    if (rec && rec.note) labels.push(T(x + 2, y + rowH - 2.4, clip(rec.note, 6), { size: 2.9, font: KAI, fill: c.ink, opacity: 0.82 }));
  }
  if (mono) p.push(`<g>${cells.join('')}</g>`); else p.push(cells.join(''));
  p.push(labels.join(''));

  // 页脚图例
  const fy = PAGE.h - M.b - FOOT_H * 0.4;
  p.push(L(M.l, PAGE.h - M.b - FOOT_H, gridRight, PAGE.h - M.b - FOOT_H, c.line, 0.3));
  let lx = M.l;
  const legend = [{ color: c.seal, name: '里程碑' },
    ...(mono ? [{ ink: true, name: '墨深=投入' }] : categories.filter((x) => x.id !== 'publish').map((x) => ({ color: x.color, name: x.name })))];
  for (const it of legend) {
    if (lx + 4.2 + it.name.length * 3 > gridRight) { p.push(T(lx, fy, '…', { size: 3, fill: c.inkSoft })); break; }
    if (it.ink) p.push(R(lx, fy - 2.4, 3, 3, c.ink, 'opacity="0.8"'));
    else p.push(R(lx, fy - 2.4, 3, 3, it.color, `stroke="${c.line}" stroke-width="0.2"`));
    p.push(T(lx + 4.2, fy, it.name, { size: 3, font: KAI, fill: c.inkSoft, anchor: 'start' }));
    lx += 4.2 + it.name.length * 3 + 5;
  }

  // 手工质感(最上层, 轻)
  p.push(texture.body);

  p.push('</svg>');
  return p.join('');
}
