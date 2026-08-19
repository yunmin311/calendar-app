// ============================================================================
// 可嵌入小件 —— 尺寸小、自适应、同页可放无限个。
//
// poster/ 里那两个是印刷大件(A1 长条 841×594mm、月卡 210×280mm), 塞不进网页侧栏
// 或仪表盘。这里是同一套视觉语言(暖纸 + 手工质感 + 墨深=投入 + 朱砂=里程碑)的
// 紧凑版, 专供"任何需要统计的地方"内联复用:
//   renderStrip(model, opts)      活动带 —— 7 行(周日..周六) × N 列(周)的留痕方格
//   renderStatCard(stats, opts)   统计卡 —— 关键数字 + 分类占比条 + 一行人话摘要
//
// 无限复用的两个前提:
//   ① 所有 SVG id(滤镜/渐变)按内容派生前缀 → 同页多实例互不撞车, 且同参数同输出
//      (确定性, 便于自测与快照对比)。
//   ② 输出 width="100%" + viewBox, 由容器定尺寸, 不写死像素。
// ============================================================================
import { MONTHS_NUM, daysInMonth, dow, iso } from '../data/model.js';
import { PALETTES } from '../data/activity.js';
import { summarize } from '../data/stats.js';
import { RECORD_VARIANTS } from '../poster/renderRecord.js';
import { clampMonth } from '../poster/renderMonth.js';
import { resolveTexture } from '../texture/index.js';

const KAI = '"KaiTi","STKaiti","楷体","LXGW WenKai",serif';
const SER = 'Georgia,"Times New Roman","Songti SC",serif';
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
const clip = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };

// 内容派生的确定性 id 前缀(djb2):同页多实例不撞, 同参数仍同输出
function idFor(seed, explicit) {
  if (explicit) return String(explicit);
  let h = 5381;
  const s = JSON.stringify(seed);
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 'e' + h.toString(36);
}

function svgOpen(w, h, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="100%" preserveAspectRatio="xMidYMid meet" font-family='${SER}' ${extra}>`;
}

/**
 * 活动带 —— 紧凑留痕方格(7 行 × 周列)。嵌进侧栏/卡片/仪表盘的主力件。
 * @param {object} model  toRecordModel 的产物
 * @param {object} opts
 *   variant  皮肤(默认跟 model)· texture 手工质感(同 poster)· id  显式 id 前缀
 *   cell     格边长(默认 3)· gap 格间距(默认 0.6)· pad 内边距(默认 3)
 *   months   月号标尺(默认 true)· weekdays 左侧周标(默认 false)
 *   from/to  只画某段月份 [0..11](默认整年)
 */
export function renderStrip(model, opts = {}) {
  const variant = opts.variant || model?.variant || 'editorial-rubbing';
  const c = RECORD_VARIANTS[variant] || RECORD_VARIANTS['editorial-rubbing'];
  const mono = !!c.mono;
  const { year = 2026, categories = [], days = {}, milestones = [] } = model || {};
  const catById = Object.fromEntries(categories.map((x) => [x.id, x]));

  const cell = opts.cell ?? 3, gap = opts.gap ?? 0.6, pad = opts.pad ?? 3;
  const step = cell + gap;
  const showMonths = opts.months !== false;
  const showWeekdays = !!opts.weekdays;
  const from = clampMonth(opts.from ?? 0);
  const to = Math.max(from, clampMonth(opts.to ?? 11));

  // 收集要画的日子, 换算成 (列=第几周, 行=周几)
  const first = { m: from, d: 1 };
  const firstDow = dow(year, first.m, first.d);
  const items = [];
  let idx = 0, maxCol = 0;
  const monthMarks = [];
  for (let m = from; m <= to; m++) {
    const dim = daysInMonth(year, m);
    for (let d = 1; d <= dim; d++) {
      const pos = idx + firstDow;
      const col = Math.floor(pos / 7), row = pos % 7;
      if (d === 1) monthMarks.push({ m, col });
      items.push({ m, d, col, row });
      if (col > maxCol) maxCol = col;
      idx++;
    }
  }

  const gridX = pad + (showWeekdays ? 7 : 0);
  const gridY = pad + (showMonths ? 4.6 : 0);
  const W = gridX + (maxCol + 1) * step - gap + pad;
  const H = gridY + 7 * step - gap + pad;

  const tex = resolveTexture(opts.texture, c, { freqMul: 3.4 });
  const pfx = idFor({ k: 'strip', variant, t: tex.name, p: tex.params, W: r(W), H: r(H) }, opts.id);
  const t = tex.build(W, H, pfx);

  const p = [svgOpen(W, H)];
  p.push(`<defs>${t.defs}</defs>`);
  p.push(R(0, 0, W, H, c.paper));

  if (showMonths) for (const mk of monthMarks) {
    p.push(T(gridX + mk.col * step, pad + 3.2, MONTHS_NUM[mk.m].slice(0, 3), { size: 2.6, fill: c.inkSoft }));
  }
  if (showWeekdays) for (const [i, ch] of [[1, '一'], [3, '三'], [5, '五']]) {
    p.push(T(pad + 5.4, gridY + i * step + cell * 0.8, ch, { size: 2.4, font: KAI, fill: c.inkSoft, anchor: 'end' }));
  }

  const msSet = new Set(milestones.filter((x) => String(x.date).slice(0, 4) === String(year)).map((x) => x.date));
  for (const it of items) {
    const x = gridX + it.col * step, y = gridY + it.row * step;
    const key = iso(year, it.m, it.d);
    const rec = days[key];
    // 底格: 素纸(留白)
    p.push(R(x, y, cell, cell, c.paper2, `stroke="${c.line}" stroke-width="0.12"`));
    if (rec) {   // 「出版」也照常落墨(见 renderRecord 同处注释)
      const inten = rec.intensity || 0.4;
      const fill = mono ? c.ink : (catById[rec.categoryId]?.color || c.ink);
      p.push(R(x, y, cell, cell, fill, `opacity="${r(mono ? 0.18 + 0.76 * inten : 0.42 + 0.58 * inten)}"`));
    }
    if (msSet.has(key)) {
      // 里程碑: 朱砂小印(留个白边, 一眼跳出来)
      p.push(R(x, y, cell, cell, c.seal));
      p.push(`<rect x="${r(x + cell * 0.28)}" y="${r(y + cell * 0.28)}" width="${r(cell * 0.44)}" height="${r(cell * 0.44)}" fill="none" stroke="${c.paper}" stroke-width="${r(cell * 0.12)}"/>`);
    }
  }

  p.push(t.body);
  p.push('</svg>');
  return p.join('');
}

/**
 * 统计卡 —— 关键数字 + 分类占比条 + 一行人话摘要。秘书交差的可嵌入件。
 * @param {object} stats  computeStats 的产物
 * @param {object} opts   variant / texture / id / width(默认 120mm)
 *   metrics  要显示的指标(默认 ['activeDays','weight','streak','milestones'])
 *   summary  是否附一行摘要(默认 true, 自己用 summarize 算)· summaryText 自定义摘要
 *   palette  分类色(缺省按 variant 取矿物色板)· title 标题(默认「活动留痕」)
 */
export function renderStatCard(stats, opts = {}) {
  const variant = opts.variant || 'editorial-rubbing';
  const c = RECORD_VARIANTS[variant] || RECORD_VARIANTS['editorial-rubbing'];
  const s = stats || {};
  const W = opts.width ?? 120;
  const pad = 6;
  const palette = opts.palette || PALETTES[variant] || PALETTES['editorial-rubbing'];

  const METRICS = {
    activeDays: { v: s.days?.active ?? 0, label: '天有痕' },
    blankDays: { v: s.days?.blank ?? 0, label: '天留白' },
    weight: { v: s.weight?.sum ?? 0, label: '总投入' },
    streak: { v: s.streak?.longest ?? 0, label: '天最长连续' },
    milestones: { v: (s.milestones || []).length, label: '个里程碑' },
    activities: { v: s.activities ?? 0, label: '条活动' },
    avg: { v: s.weight?.avgPerActiveDay ?? 0, label: '活跃日均' },
  };
  const keys = (opts.metrics || ['activeDays', 'weight', 'streak', 'milestones']).filter((k) => METRICS[k]);
  const byType = (s.byType || []).filter((t) => t.weight > 0);
  const summaryText = opts.summaryText ?? (s.days ? summarize(s) : '');
  const withSummary = opts.summary !== false && !!summaryText;

  // 高度按内容算
  const headH = 13, metricH = keys.length ? 15 : 0, barH = byType.length ? 12.5 : 0, sumH = withSummary ? 8 : 0;
  const H = pad + headH + metricH + barH + sumH + pad * 0.4;

  const tex = resolveTexture(opts.texture, c, { freqMul: 4.2 });
  const pfx = idFor({ k: 'card', variant, t: tex.name, p: tex.params, W: r(W), H: r(H) }, opts.id);
  const t = tex.build(W, H, pfx);

  const p = [svgOpen(W, H)];
  p.push(`<defs>${t.defs}</defs>`);
  p.push(R(0, 0, W, H, c.paper));

  // 报头
  let y = pad + 5.5;
  p.push(T(pad, y, opts.title || '活动留痕', { size: 5.4, font: KAI, fill: c.ink, spacing: 1 }));
  p.push(T(W - pad, y, String(s.year ?? ''), { size: 5, font: SER, fill: c.inkSoft, anchor: 'end' }));
  y += 3.2;
  p.push(`<line x1="${pad}" y1="${r(y)}" x2="${r(W - pad)}" y2="${r(y)}" stroke="${c.ink}" stroke-width="0.35"/>`);

  // 关键数字
  if (keys.length) {
    y += 8.5;
    const colW = (W - pad * 2) / keys.length;
    keys.forEach((k, i) => {
      const x = pad + i * colW;
      p.push(T(x, y, String(METRICS[k].v), { size: 8, font: SER, fill: k === 'milestones' ? c.seal : c.ink }));
      p.push(T(x, y + 4.2, METRICS[k].label, { size: 2.6, font: KAI, fill: c.inkSoft }));
    });
    y += 6.5;
  }

  // 分类占比条(堆叠) + 图例
  if (byType.length) {
    y += 3;
    const barW = W - pad * 2, bh = 3.4;
    let cx = pad;
    for (const ty of byType) {
      const w = barW * ty.share;
      p.push(R(cx, y, w, bh, palette[ty.id] || c.ink, `opacity="${palette[ty.id] ? 0.9 : r(0.25 + 0.6 * ty.share)}"`));
      cx += w;
    }
    p.push(R(pad, y, barW, bh, 'none', `stroke="${c.line}" stroke-width="0.2"`));
    y += bh + 4;
    // 图例(挤不下就截断)
    let lx = pad;
    for (const ty of byType) {
      const label = `${ty.name} ${Math.round(ty.share * 100)}%`;
      const wNeed = 3.4 + label.length * 2.4;
      if (lx + wNeed > W - pad) break;
      p.push(R(lx, y - 2.2, 2.4, 2.4, palette[ty.id] || c.ink, palette[ty.id] ? '' : `opacity="0.55"`));
      p.push(T(lx + 3.4, y, label, { size: 2.6, font: KAI, fill: c.inkSoft }));
      lx += wNeed + 2.4;
    }
    y += 3;
  }

  // 一行人话摘要
  if (withSummary) {
    y += 3.4;
    p.push(T(pad, y, clip(summaryText, Math.floor((W - pad * 2) / 2.35)), { size: 2.5, font: KAI, fill: c.inkSoft, opacity: 0.92 }));
  }

  p.push(t.body);
  p.push('</svg>');
  return p.join('');
}
