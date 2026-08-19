// 统计层自测 —— node 直跑。用手算得出的小样本对数字, 不只看"没崩"。
// 用法: node scripts/test-stats.mjs
import { computeStats, monthStats, summarize, monthRange, daysBack } from '../src/data/stats.js';
import { sampleActivities } from '../src/data/activity.js';
import { createRecord } from '../src/record/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  实得: ${JSON.stringify(got)}`); } };
const A = (date, type, weight, extra = {}) => ({ id: date + type, date, type, title: 't', weight, ...extra });

console.log('\n[1] 手算小样本对数(2026 非闰年, 365 天)');
// 1/1 投入2 · 1/2 投入1 · 1/3 投入3(两条) · 1/10 投入1 · 3/5 投入1(里程碑)
const fx = [
  A('2026-01-01', 'design', 2), A('2026-01-02', 'writing', 1),
  A('2026-01-03', 'design', 1), A('2026-01-03', 'research', 2),
  A('2026-01-10', 'build', 1), A('2026-03-05', 'publish', 3, { milestone: true }),
];
const s = computeStats(fx, { year: 2026 });
ok('活动条数 6', s.activities === 6, s.activities);
ok('全年 365 天', s.days.total === 365, s.days.total);
ok('有痕 5 天', s.days.active === 5, s.days.active);
ok('留白 360 天', s.days.blank === 360, s.days.blank);
ok('总投入 10', s.weight.sum === 10, s.weight.sum);
ok('单日最高 3', s.weight.max === 3, s.weight.max);
ok('活跃日均 2', s.weight.avgPerActiveDay === 2, s.weight.avgPerActiveDay);
ok('最长连续 3 天(1/1–1/3)', s.streak.longest === 3 && s.streak.longestFrom === '2026-01-01' && s.streak.longestTo === '2026-01-03', s.streak);
ok('最近连续 1 天(3/5 孤立)', s.streak.latest === 1 && s.streak.latestTo === '2026-03-05', s.streak);
ok('最忙 1/3(投入 3)', s.busiest?.date === '2026-01-03' && s.busiest.count === 3, s.busiest);
ok('里程碑 1 个', s.milestones.length === 1 && s.milestones[0].date === '2026-03-05', s.milestones);
ok('首末日正确', s.firstDate === '2026-01-01' && s.lastDate === '2026-03-05', [s.firstDate, s.lastDate]);

console.log('\n[2] 分类与按月');
const design = s.byType.find((t) => t.id === 'design');
ok('design 投入 3、2 天、2 条', design.weight === 3 && design.days === 2 && design.count === 2, design);
ok('byType 按投入降序', s.byType.every((t, i) => i === 0 || s.byType[i - 1].weight >= t.weight), s.byType.map((t) => t.weight));
ok('占比合计 ≈1', Math.abs(s.byType.reduce((n, t) => n + t.share, 0) - 1) < 0.02, s.byType.map((t) => t.share));
ok('一月 4 天有痕、投入 7', s.byMonth[0].days === 4 && s.byMonth[0].weight === 7, s.byMonth[0]);
ok('二月空月不崩', s.byMonth[1].days === 0 && s.byMonth[1].weight === 0 && s.byMonth[1].dominant === null, s.byMonth[1]);
ok('三月 dominant=publish', s.byMonth[2].dominant === 'publish', s.byMonth[2]);
ok('monthStats 与 byMonth 同源', monthStats(fx, 2026, 0).weight === s.byMonth[0].weight, monthStats(fx, 2026, 0));

console.log('\n[3] 跨年过滤 + 闰年');
const cross = [...fx, A('2025-06-01', 'design', 9), A('2027-06-01', 'design', 9)];
ok('别年活动被过滤掉', computeStats(cross, { year: 2026 }).weight.sum === 10, computeStats(cross, { year: 2026 }).weight.sum);
ok('2024 闰年 366 天', computeStats([], { year: 2024 }).days.total === 366, computeStats([], { year: 2024 }).days.total);

console.log('\n[4] 空 / 乱输入不崩(可复用组件的底线)');
for (const [name, input] of [['空数组', []], ['null', null], ['undefined', undefined], ['非数组', 'x'], ['含 null 项', [null, A('2026-01-01', 'design', 1)]]]) {
  let r = null, threw = false;
  try { r = computeStats(input, { year: 2026 }); } catch { threw = true; }
  ok(`${name} 不抛且字段齐`, !threw && r && r.days && Array.isArray(r.byType) && Array.isArray(r.byMonth) && r.byMonth.length === 12, threw ? 'threw' : r && r.days);
}
const zero = computeStats([], { year: 2026 });
ok('全空时归零而非 NaN', zero.weight.sum === 0 && zero.weight.avgPerActiveDay === 0 && zero.days.rate === 0 && zero.streak.longest === 0 && zero.busiest === null, zero.weight);
ok('全空 summarize 不炸', typeof summarize(zero) === 'string' && summarize(zero).length > 0);

console.log('\n[5] groupBy: 为"多人"留口, 但不强加字段');
const team = [
  A('2026-01-01', 'design', 2, { actor: '阿一' }), A('2026-01-02', 'writing', 1, { actor: '阿一' }),
  A('2026-01-03', 'build', 3, { actor: '阿二' }), A('2026-01-04', 'research', 1),
];
const g = computeStats(team, { year: 2026, groupBy: 'actor' });
ok('分出 3 组(含未标注)', g.groups.length === 3, g.groups.map((x) => x.key));
ok('阿一 投入3 / 2天 / 2条', (() => { const x = g.groups.find((v) => v.key === '阿一'); return x.weight === 3 && x.days === 2 && x.count === 2; })(), g.groups);
ok('缺字段落到 (未标注)', g.groups.some((x) => x.key === '(未标注)' && x.weight === 1), g.groups);
ok('组按投入降序', g.groups[0].weight >= g.groups[1].weight, g.groups.map((x) => x.weight));
ok('不给 groupBy 就没有 groups 字段', computeStats(team, { year: 2026 }).groups === undefined);
ok('按不存在的字段分组 → 全落未标注', computeStats(team, { year: 2026, groupBy: '没这字段' }).groups.length === 1);

console.log('\n[6] 与渲染口径同源(不能出现两套数字)');
const acts = sampleActivities(2026);
const rec = createRecord(acts, { year: 2026 });
const rs = rec.stats();
const modelDays = Object.keys(rec.model.days).length;
ok('有痕天数 = 渲染落格天数', rs.days.active === modelDays, [rs.days.active, modelDays]);
ok('里程碑数 = 渲染朱砂印数', rs.milestones.length === rec.model.milestones.length, [rs.milestones.length, rec.model.milestones.length]);
ok('分档合计 = 全年天数', rs.levels.reduce((a, b) => a + b, 0) === rs.days.total, [rs.levels, rs.days.total]);
ok('单月投入合计 = 全年总投入', rs.byMonth.reduce((n, m) => n + m.weight, 0) === rs.weight.sum, rs.weight.sum);
ok('createRecord 可带 groupBy', rec.stats({ groupBy: 'type' }).groups.length > 0);

console.log('\n[7] 区间统计(秘书交的是「这周/这个月」的账)');
{
  const acts7 = [
    A('2026-03-01', 'design', 2), A('2026-03-05', 'writing', 1), A('2026-03-31', 'build', 3),
    A('2026-04-01', 'design', 5), A('2026-02-28', 'research', 4),
  ];
  const mar = computeStats(acts7, { year: 2026, from: '2026-03-01', to: '2026-03-31' });
  ok('只算三月: 3 条 / 3 天 / 投入 6', mar.activities === 3 && mar.days.active === 3 && mar.weight.sum === 6, [mar.activities, mar.days.active, mar.weight.sum]);
  ok('区间天数 = 31', mar.days.total === 31 && mar.range.days === 31, mar.range);
  ok('range.whole=false 且首尾正确', mar.range.whole === false && mar.range.from === '2026-03-01' && mar.range.to === '2026-03-31');
  ok('不给区间仍是整年 365 天', computeStats(acts7, { year: 2026 }).days.total === 365);
  ok('整年 range.whole=true', computeStats(acts7, { year: 2026 }).range.whole === true);
  ok('含首尾(3/1 与 3/31 都算进来)', mar.byType.some((t) => t.id === 'design') && mar.byType.some((t) => t.id === 'build'));
  const half = computeStats(acts7, { year: 2026, from: '2026-03-02' });
  ok('只给 from: 从那天到年底', half.activities === 3 && half.range.to === '2026-12-31', [half.activities, half.range]);
  ok('只给 to: 从年初到那天', computeStats(acts7, { year: 2026, to: '2026-03-01' }).activities === 2);
  ok('区间超出本年被夹住', computeStats(acts7, { year: 2026, from: '2020-01-01', to: '2030-01-01' }).days.total === 365);
  ok('非法区间退回整年', computeStats(acts7, { year: 2026, from: '乱写' }).days.total === 365);
  ok('空区间不崩(from 晚于 to)', (() => { const r = computeStats(acts7, { year: 2026, from: '2026-06-01', to: '2026-05-01' }); return r.days.active === 0 && r.days.total === 0; })());
  ok('区间内 groupBy 照常', computeStats(acts7.map((a) => ({ ...a, who: 'A' })), { year: 2026, from: '2026-03-01', to: '2026-03-31', groupBy: 'who' }).groups[0].count === 3);
  ok('摘要改口说区间、不再讲"占全年"', summarize(mar).includes('2026-03-01 至 2026-03-31') && !summarize(mar).includes('占全年'), summarize(mar));
  ok('monthRange helper', JSON.stringify(monthRange(2026, 1)) === JSON.stringify({ from: '2026-02-01', to: '2026-02-28' }), monthRange(2026, 1));
  ok('monthRange 闰年二月', monthRange(2024, 1).to === '2024-02-29');
  ok('daysBack 含当天', JSON.stringify(daysBack('2026-03-10', 7)) === JSON.stringify({ from: '2026-03-04', to: '2026-03-10' }), daysBack('2026-03-10', 7));
  ok('daysBack 跨月', daysBack('2026-03-03', 7).from === '2026-02-25', daysBack('2026-03-03', 7));
  ok('daysBack 吃非法日期不崩', daysBack('乱写', 7).from === null);
  const viaHelper = computeStats(acts7, { year: 2026, ...monthRange(2026, 2) });
  ok('helper 与手写区间等价', viaHelper.weight.sum === mar.weight.sum);
}

console.log('\n[8] 人话摘要');
const line = summarize(rs);
console.log('  →', line);
ok('摘要含关键数字', line.includes(String(rs.days.active)) && line.includes(String(rs.weight.sum)) && !/NaN|undefined/.test(line), line);

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
