// ============================================================================
// 画法口径 —— 屏幕渲染与印刷 PDF 共用的那几条规则,只此一份。
//
// 为什么单独一层:同一条规则写两遍(一遍给屏幕、一遍给 PDF)是本项目反复栽跟头的
// 根因 —— 改了一边,印刷就悄悄跟屏幕漂,而"预览=成品"是这个组件的立身之本。
// 凡是"屏幕和印刷都要用同一个数"的东西,都收到这里。
//
// 收进来的:墨深透明度公式 · 图例条目 · 月度合计 · 当月里程碑 · 文字截断长度。
// 不收的:几何(在 layout.js / renderMonth 的 monthGeometry)、色值(在 activity.js
// 的 PALETTES 与 renderRecord 的 RECORD_VARIANTS)、质感(在 texture/)。
// ============================================================================
import { daysInMonth, iso } from '../data/model.js';

// 墨深:强度 → 透明度。三种载体的下限/跨度不同(格子越小、底噪越重,起点要高一点),
// 但同一载体的屏幕与印刷必须同一个数, 所以摆成一张表而不是散在各处的魔法数字。
const INK = {
  year:  { color: [0.45, 0.55], mono: [0.2, 0.78] },   // 整年长条 A1
  month: { color: [0.4, 0.55],  mono: [0.14, 0.7] },   // 单月卡 210×280
  strip: { color: [0.42, 0.58], mono: [0.18, 0.76] },  // 可嵌入活动带
};
const clamp01 = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {number} intensity 0..1(= level / maxLevel)
 * @param {{mono?:boolean, carrier?:'year'|'month'|'strip'}} o
 */
export function inkOpacity(intensity, { mono = false, carrier = 'year' } = {}) {
  const [base, span] = (INK[carrier] || INK.year)[mono ? 'mono' : 'color'];
  return r2(base + span * clamp01(intensity));
}

// 活动标题 / 里程碑签在格子里最多显示几个字(超出加省略号)
export const NOTE_CHARS = 6;
export const clipText = (s, n = NOTE_CHARS) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + '…' : s; };

/** 当月里程碑: { 日 → 标签 }。年份取自 model。 */
export function milestonesByDay(model, monthIndex) {
  const out = {};
  const year = model?.year;
  for (const ms of model?.milestones || []) {
    const [yy, mo, d] = String(ms.date).split('-').map(Number);
    if (yy === year && mo - 1 === monthIndex) out[d] = ms.label || '';
  }
  return out;
}

/** 当月合计(报头那两个数)。与统计层同源:数的都是 model.days,不会各算各的。 */
export function monthTotals(model, monthIndex) {
  const year = model?.year, days = model?.days || {};
  let activeDays = 0, sumWeight = 0;
  const dim = daysInMonth(year, monthIndex);
  for (let d = 1; d <= dim; d++) {
    const rec = days[iso(year, monthIndex, d)];
    if (rec) { activeDays++; sumWeight += rec.count || 0; }
  }
  return { activeDays, sumWeight: Math.round(sumWeight * 100) / 100 };
}

/**
 * 图例条目 —— **只列这张图上真的出现过的分类**,外加里程碑(有才列)。
 *
 * 两个此前的毛病都在这儿修掉:
 *   ① 图例写死列全部五类,哪怕某类一天都没有 —— 说了图上没有的东西。
 *   ② 「出版」改成正常落墨后,图例却还在把它过滤掉(月卡图例干脆只写「里程碑」),
 *      于是图上一片朱砂色块、图例不认账 —— 图例在说谎。
 *
 * @param {object} model    toRecordModel 产物
 * @param {object} c        变体配置(RECORD_VARIANTS[variant])
 * @param {{month?:number, compact?:boolean}} o  month 给了就只看那个月;compact = 月卡/小件用短措辞
 * @returns {Array<{color?:string, ink?:boolean, name:string}>}
 */
export function legendItems(model, c, { month = null, compact = false } = {}) {
  const year = model?.year, days = model?.days || {};
  const inScope = (date) => {
    if (month == null) return true;
    const [yy, mo] = String(date).split('-').map(Number);
    return yy === year && mo - 1 === month;
  };
  const used = new Set();
  for (const [date, rec] of Object.entries(days)) if (inScope(date)) used.add(rec.categoryId);
  const hasMilestone = (model?.milestones || []).some((m) => inScope(m.date));

  const items = [];
  if (hasMilestone) items.push({ color: c.seal, name: '里程碑' });
  if (c.mono) {
    if (used.size) items.push({ ink: true, name: compact ? '墨深=投入' : '墨深 = 当日投入' });
  } else {
    for (const cat of model?.categories || []) {
      if (used.has(cat.id)) items.push({ color: cat.color, name: cat.name });
    }
  }
  return items;
}
