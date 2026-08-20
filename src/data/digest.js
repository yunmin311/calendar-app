// ============================================================================
// 简报层 —— 把统计说成人话, 而且是**能直接粘贴进对话的纯文本**。
//
// 为什么单独一层:秘书交差交的是一段文字, 不是一张 SVG。SVG 贴不进聊天窗口,
// 也进不了邮件正文。这一层让"多人对话的秘书"这个定位真的能落地。
//
// 两件事:
//   compare(cur, prev)  —— 与上一期对比(涨了还是掉了、哪类变化最大)
//   digest(stats, opts) —— 多行简报(纯文本 / Markdown), 含对比与"值得注意的"
//
// 纯函数、无存储、不看时钟(上一期区间由 previousRange 从当期算, 不用今天是几号)。
// 不发明 schema:只吃 computeStats 的产物。
// ============================================================================
import { parseDate } from './activity.js';
import { computeStats } from './stats.js';   // 单向依赖: stats 不认识 digest, 不会成环

const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const dayMs = 86400000;
const toMs = (s) => { const p = parseDate(s); return p ? Date.UTC(p.y, p.m, p.d) : null; };
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * 紧邻在前、同样长度的上一期。
 * 「这周 vs 上周」不需要知道今天是几号 —— 由当期区间推出来即可(保持组件不看时钟)。
 */
export function previousRange({ from, to } = {}) {
  const a = toMs(from), b = toMs(to);
  if (a == null || b == null || b < a) return { from: null, to: null };
  const len = (b - a) / dayMs + 1;
  return { from: iso(a - len * dayMs), to: iso(a - dayMs) };
}

// 涨跌:绝对值 + 百分比(上期为 0 时百分比给 null, 别报 Infinity)
function delta(cur = 0, prev = 0) {
  const diff = round1(cur - prev);
  const pct = prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
  return { cur, prev, diff, pct, up: diff > 0, down: diff < 0, flat: diff === 0 };
}

/**
 * 两期统计对比。
 * @param {object} cur   本期 computeStats 结果
 * @param {object} prev  上期 computeStats 结果(没有就传 null / 省略)
 * @returns {{ has:boolean, activities, weight, activeDays, milestones, byType }}
 *   byType: [{ id, name, cur, prev, diff, pct }] 按变化幅度降序 —— 秘书关心的是"什么变了"
 */
export function compare(cur, prev) {
  if (!cur || !cur.days) return { has: false };
  if (!prev || !prev.days) return { has: false };
  const curT = Object.fromEntries((cur.byType || []).map((t) => [t.id, t]));
  const prevT = Object.fromEntries((prev.byType || []).map((t) => [t.id, t]));
  const ids = [...new Set([...Object.keys(curT), ...Object.keys(prevT)])];
  const byType = ids.map((id) => {
    const c = curT[id], p = prevT[id];
    const d = delta(c ? c.weight : 0, p ? p.weight : 0);
    return { id, name: (c || p).name, ...d };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return {
    has: true,
    range: prev.range,
    activities: delta(cur.activities, prev.activities),
    weight: delta(cur.weight.sum, prev.weight.sum),
    activeDays: delta(cur.days.active, prev.days.active),
    milestones: delta((cur.milestones || []).length, (prev.milestones || []).length),
    byType,
  };
}

const sign = (n) => (n > 0 ? `+${n}` : String(n));
const pctText = (d) => (d.pct == null ? (d.cur ? '(上期为 0)' : '') : `(${sign(d.pct)}%)`);

/**
 * 「值得注意的」—— 秘书的价值在于指出, 不在于罗列。
 * 只挑真的值得说的:断更、猛涨猛跌、某类骤变、里程碑、留白最长的一段。
 */
export function highlights(stats, cmp) {
  const out = [];
  if (!stats || !stats.days) return out;
  const r = stats.range || {};

  if (stats.days.active === 0) { out.push('这段完全没有记录。'); return out; }
  if (stats.days.blank === 0 && r.days > 1) out.push(`这段每天都有痕(连着 ${r.days} 天)。`);
  else if (stats.streak.longest >= 5) out.push(`最长连着做了 ${stats.streak.longest} 天(${stats.streak.longestFrom} 起)。`);

  if (cmp && cmp.has) {
    const w = cmp.weight;
    if (w.pct != null && Math.abs(w.pct) >= 30) out.push(`总投入比上期${w.up ? '涨' : '掉'}了 ${Math.abs(w.pct)}%。`);
    const big = cmp.byType[0];
    if (big && Math.abs(big.diff) >= 3) out.push(`变化最大的是「${big.name}」:${sign(big.diff)}${pctText(big)}。`);
    const gone = cmp.byType.filter((t) => t.cur === 0 && t.prev > 0).map((t) => t.name);
    if (gone.length) out.push(`上期有、这期没动的:${gone.join('、')}。`);
    const fresh = cmp.byType.filter((t) => t.prev === 0 && t.cur > 0).map((t) => t.name);
    if (fresh.length) out.push(`这期新开的:${fresh.join('、')}。`);
  }

  const ms = stats.milestones || [];
  if (ms.length) out.push(`里程碑 ${ms.length} 个:${ms.map((m) => `${m.date.slice(5)}${m.label ? ' ' + m.label : ''}`).join('、')}。`);
  else if (r.days && r.days <= 62) out.push('这段没有里程碑。');

  if (stats.busiest) out.push(`最忙是 ${stats.busiest.date}(投入 ${stats.busiest.count}${stats.busiest.note ? ',' + stats.busiest.note : ''})。`);
  return out;
}

const headLine = (s) => {
  const r = s.range;
  return !r || r.whole ? `${s.year} 年` : `${r.from} 至 ${r.to}(${r.days} 天)`;
};

/**
 * 多行简报 —— 直接粘贴进对话/邮件的那种。
 * @param {object} stats  computeStats 结果
 * @param {object} opts
 *   compare  上一期的 computeStats 结果(给了就带涨跌)
 *   format   'text'(默认) | 'markdown'
 *   title    抬头(默认「活动简报」)
 *   groupLabel  分组维度的人话名(如 '成员'), 有 stats.groups 时用
 *   maxTypes / maxGroups  各列几条(默认 5)
 */
export function digest(stats, opts = {}) {
  if (!stats || !stats.days) return '';
  const md = opts.format === 'markdown';
  const cmp = opts.compare ? compare(stats, opts.compare) : null;
  const maxTypes = opts.maxTypes ?? 5, maxGroups = opts.maxGroups ?? 5;
  const L = [];
  const bullet = (s) => L.push(md ? `- ${s}` : `· ${s}`);
  const B = (s) => (md ? `**${s}**` : s);

  L.push(md ? `## ${opts.title || '活动简报'} · ${headLine(stats)}` : `${opts.title || '活动简报'} · ${headLine(stats)}`);
  L.push('');

  bullet(`记下 ${B(stats.activities)} 条活动,${B(stats.days.active)} 天有痕`
    + (stats.range && !stats.range.whole ? `(占这段 ${Math.round(stats.days.rate * 100)}%)` : `(占全年 ${Math.round(stats.days.rate * 100)}%)`)
    + `,总投入 ${B(stats.weight.sum)}。`);

  if (cmp && cmp.has) {
    bullet(`比上一期(${cmp.range.from} 至 ${cmp.range.to}):`
      + `投入 ${B(sign(cmp.weight.diff))} ${pctText(cmp.weight)}`
      + `,有痕天数 ${sign(cmp.activeDays.diff)}`
      + `,活动条数 ${sign(cmp.activities.diff)}。`);
  }

  const types = (stats.byType || []).slice(0, maxTypes);
  if (types.length) {
    bullet('分类:' + types.map((t) => {
      const d = cmp && cmp.has ? cmp.byType.find((x) => x.id === t.id) : null;
      return `${t.name} ${Math.round(t.share * 100)}%(${t.weight}${d && d.diff ? ' ' + sign(d.diff) : ''})`;
    }).join(' · '));
  }

  if (stats.groups && stats.groups.length) {
    const label = opts.groupLabel || stats.groupBy || '分组';
    bullet(`${label}:` + stats.groups.slice(0, maxGroups)
      .map((g) => `${g.key} ${g.weight}(${g.days} 天${g.milestones ? `,里程碑 ${g.milestones}` : ''})`).join(' · '));
  }

  const hl = highlights(stats, cmp);
  if (hl.length) {
    L.push('');
    L.push(md ? '**值得注意**' : '值得注意:');
    for (const h of hl) bullet(h);
  }

  const d = stats.dropped;
  if (d && (d.invalidDate || d.otherYear || d.malformed)) {
    L.push('');
    const bits = [];
    if (d.invalidDate) bits.push(`${d.invalidDate} 条日期不合法`);
    if (d.otherYear) bits.push(`${d.otherYear} 条不在本年`);
    if (d.malformed) bits.push(`${d.malformed} 条不是活动对象`);
    bullet(`另有 ${bits.join('、')},没有计入(既没画也没算)。`);
  }
  return L.join('\n');
}

/**
 * 一步到位:活动数组 + 区间 → 简报(自动跟紧邻的上一期比)。
 * 上一期若跨出本年就不比 —— 本组件一次只吃一年的数据, 硬比会拿"上期为 0"骗人。
 */
export function reportFor(activities, { year = 2026, from, to, groupBy, ...opts } = {}) {
  const cur = computeStats(activities, { year, from, to, groupBy });
  let prev = null;
  if (from || to) {
    const pr = previousRange({ from: cur.range.from, to: cur.range.to });
    if (pr.from && pr.from.slice(0, 4) === String(year)) {
      prev = computeStats(activities, { year, ...pr, groupBy });
    }
  }
  return digest(cur, { ...opts, compare: prev });
}
