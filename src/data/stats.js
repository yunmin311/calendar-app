// ============================================================================
// 统计层 —— 把活动数组算成一组可复用的派生统计。纯函数、无存储、无副作用。
//
// 定位:这是「秘书」那一半——不光把活动画出来, 还能回答"这段时间干了多少、
// 谁干的、哪类最多、连着做了几天、哪天最忙"。任何需要统计的地方都能调,
// 不绑任何页面。
//
// 护栏:**不发明新 schema**。只吃现有占位契约(见 docs/数据契约-占位.md),
// 且内部复用 toDailySeries —— 统计口径与渲染口径同源, 不会出现两套数字打架。
// groupBy 支持按活动上的任意字段分组(如将来 CO 给了 actor/author 就能按人分),
// 字段不存在就落到 '(未标注)', 绝不强加字段。
// ============================================================================
import { toDailySeries, ACTIVITY_TYPES, MAX_LEVEL, typeOf } from './activity.js';
import { MONTHS_ZH } from './model.js';

const TYPE_NAME = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.id, t.name]));
const UNSET = '(未标注)';
const round2 = (n) => Math.round(n * 100) / 100;

// 'YYYY-MM-DD' → 天序号(用于判连续, 避开时区/闰年手算)
function dayNum(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}

// 最长连续有痕天数 + 最近一段连续(收尾那段)
function streaks(dates) {
  if (!dates.length) return { longest: 0, longestFrom: null, longestTo: null, latest: 0, latestFrom: null, latestTo: null };
  const nums = dates.map(dayNum);
  let best = 1, bestEnd = 0, cur = 1;
  for (let i = 1; i < nums.length; i++) {
    cur = nums[i] === nums[i - 1] + 1 ? cur + 1 : 1;
    if (cur > best) { best = cur; bestEnd = i; }
  }
  // 收尾那段("最近连着做了几天")
  let tail = 1;
  for (let i = nums.length - 1; i > 0; i--) { if (nums[i] === nums[i - 1] + 1) tail++; else break; }
  return {
    longest: best, longestFrom: dates[bestEnd - best + 1], longestTo: dates[bestEnd],
    latest: tail, latestFrom: dates[dates.length - tail], latestTo: dates[dates.length - 1],
  };
}

/**
 * 算统计。
 * @param {Array} activities  活动数组(占位契约形状)
 * @param {{year?:number, groupBy?:string}} opts
 *   groupBy —— 按活动上的任意字段再分一组(如 'actor' 按人、'project' 按项目);
 *              留空则不分组。字段缺失的活动归到 '(未标注)'。
 * @returns 统计对象(见下面各字段;数量为 0 时全部安全归零, 不抛)
 */
export function computeStats(activities, opts = {}) {
  const acts = Array.isArray(activities) ? activities : [];
  const year = opts.year || 2026;
  const inYear = acts.filter((a) => a && typeof a.date === 'string' && a.date.slice(0, 4) === String(year));
  const { series, maxWeight } = toDailySeries(inYear, year);

  const activeDates = series.filter((s) => s.count > 0).map((s) => s.date).sort();
  const yearDays = dayNum(`${year}-12-31`) - dayNum(`${year}-01-01`) + 1; // 365/366 自动对(含闰年)
  const sumWeight = series.reduce((n, s) => n + s.count, 0);

  // 按活动类型
  const byTypeMap = {};
  for (const a of inYear) {
    const t = typeOf(a); // 与渲染同口径: 没写 type 的归 (未分类), 不能一边算一边不画
    const g = (byTypeMap[t] ||= { id: t, name: TYPE_NAME[t] || t, count: 0, weight: 0, dates: new Set() });
    g.count++; g.weight += a.weight || 0; g.dates.add(a.date);
  }
  const byType = Object.values(byTypeMap)
    .map((g) => ({ id: g.id, name: g.name, count: g.count, weight: g.weight, days: g.dates.size, share: sumWeight ? round2(g.weight / sumWeight) : 0 }))
    .sort((a, b) => b.weight - a.weight);

  // 按月
  const byMonth = Array.from({ length: 12 }, (_, m) => ({ m, name: MONTHS_ZH[m], days: 0, weight: 0, count: 0, types: {} }));
  for (const s of series) {
    const m = Number(s.date.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    byMonth[m].days++; byMonth[m].weight += s.count;
  }
  for (const a of inYear) {
    const m = Number(a.date.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    const t = typeOf(a);
    byMonth[m].count++;
    byMonth[m].types[t] = (byMonth[m].types[t] || 0) + (a.weight || 0);
  }
  for (const mm of byMonth) {
    const e = Object.entries(mm.types).sort((x, y) => y[1] - x[1])[0];
    mm.dominant = e ? e[0] : null;
    delete mm.types;
  }

  // 强度分档分布(L1..L4), 用来看"典型日 vs 重日"是否健康
  const levels = Array.from({ length: MAX_LEVEL + 1 }, () => 0);
  for (const s of series) levels[s.level] = (levels[s.level] || 0) + 1;
  levels[0] = Math.max(0, yearDays - activeDates.length);

  // 最忙的一天 / 里程碑
  const busiest = series.reduce((best, s) => (!best || s.count > best.count ? s : best), null);
  const milestones = series.filter((s) => s.milestone).map((s) => ({ date: s.date, label: s.milestone }));

  const out = {
    year,
    activities: inYear.length,
    days: { total: yearDays, active: activeDates.length, blank: Math.max(0, yearDays - activeDates.length),
            rate: yearDays ? round2(activeDates.length / yearDays) : 0 },
    weight: { sum: sumWeight, max: activeDates.length ? maxWeight : 0,
              avgPerActiveDay: activeDates.length ? round2(sumWeight / activeDates.length) : 0 },
    streak: streaks(activeDates),
    byType, byMonth, levels,
    busiest: busiest && busiest.count > 0 ? { date: busiest.date, count: busiest.count, level: busiest.level, note: busiest.note } : null,
    milestones,
    firstDate: activeDates[0] || null,
    lastDate: activeDates[activeDates.length - 1] || null,
  };

  // 可选:按任意字段分组(为将来"多人"留口, 不强加字段)
  if (opts.groupBy) {
    const key = opts.groupBy;
    const gm = {};
    for (const a of inYear) {
      const k = a[key] == null || a[key] === '' ? UNSET : String(a[key]);
      const g = (gm[k] ||= { key: k, count: 0, weight: 0, dates: new Set(), milestones: 0 });
      g.count++; g.weight += a.weight || 0; g.dates.add(a.date);
      if (a.milestone) g.milestones++;
    }
    out.groupBy = key;
    out.groups = Object.values(gm)
      .map((g) => ({ key: g.key, count: g.count, weight: g.weight, days: g.dates.size, milestones: g.milestones,
                     share: sumWeight ? round2(g.weight / sumWeight) : 0 }))
      .sort((a, b) => b.weight - a.weight);
  }
  return out;
}

/** 单月统计(渲染月卡的报头数字走这里, 与整年口径同源)。 */
export function monthStats(activities, year = 2026, monthIndex = 0) {
  const s = computeStats(activities, { year });
  const m = Math.max(0, Math.min(11, monthIndex));
  return s.byMonth[m];
}

/** 一行人话摘要 —— 秘书交差用(无中文字体依赖, 纯文本)。 */
export function summarize(stats) {
  if (!stats || !stats.days) return '';
  const top = stats.byType[0];
  const bits = [
    `${stats.year} 年记下 ${stats.activities} 条活动`,
    `${stats.days.active} 天有痕(占全年 ${Math.round(stats.days.rate * 100)}%)`,
    `总投入 ${stats.weight.sum}`,
  ];
  if (top) bits.push(`最多的是「${top.name}」(占 ${Math.round(top.share * 100)}%)`);
  if (stats.streak.longest > 1) bits.push(`最长连着做了 ${stats.streak.longest} 天(${stats.streak.longestFrom} 起)`);
  if (stats.busiest) bits.push(`最忙是 ${stats.busiest.date}`);
  if (stats.milestones.length) bits.push(`里程碑 ${stats.milestones.length} 个`);
  return bits.join(' · ') + '。';
}
