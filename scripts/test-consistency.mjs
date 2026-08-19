// 一致性与静默丢数据 —— 本轮自审揪出来的问题, 每条都钉一个回归断言在这里。
// 组件的核心承诺只有一句:**统计说有的, 图上必须画得出来; 图上没有的, 统计也不该算。**
// 用法: node scripts/test-consistency.mjs
import { toRecordModel, toDailySeries, aggregateByDay, parseDate, weightOf, partitionActivities } from '../src/data/activity.js';
import { computeStats } from '../src/data/stats.js';
import { renderRecord } from '../src/poster/renderRecord.js';
import { renderMonth } from '../src/poster/renderMonth.js';
import { renderStrip } from '../src/embed/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };
const A = (date, type, weight, extra = {}) => ({ id: date + type + weight, date, type, title: 't', weight, ...extra });

// 核心不变式:统计的"有痕天数"必须等于模型里真正落格的天数
const invariant = (acts, year = 2026, tag = '') => {
  const s = computeStats(acts, { year });
  const m = toRecordModel(acts, year);
  const days = Object.keys(m.days).length;
  ok(`${tag} 有痕天数(${s.days.active}) = 落格天数(${days})`, s.days.active === days, [s.days.active, days]);
  ok(`${tag} 里程碑数一致`, s.milestones.length === m.milestones.length, [s.milestones.length, m.milestones.length]);
  const catIds = new Set(m.categories.map((c) => c.id));
  ok(`${tag} 每个落格天都查得到分类`, Object.values(m.days).every((d) => catIds.has(d.categoryId)));
  return { s, m };
};

console.log('\n[1] 跨年数据不许污染本年墨深(实测过: 掺一条别年大投入, 本年 1,2,3 会塌成 1,1,1)');
{
  const base = [A('2026-01-01', 'design', 1), A('2026-01-02', 'design', 2), A('2026-01-03', 'design', 3)];
  const lv = (acts) => Object.values(toRecordModel(acts, 2026).days).map((d) => d.level).join(',');
  ok('只有本年 → 1,2,3', lv(base) === '1,2,3', lv(base));
  ok('掺一条 2025 的 999 投入 → 仍是 1,2,3', lv([...base, A('2025-06-01', 'design', 999)]) === '1,2,3', lv([...base, A('2025-06-01', 'design', 999)]));
  ok('别年的天不会混进 days', Object.keys(toRecordModel([...base, A('2025-06-01', 'design', 9)], 2026).days).every((d) => d.startsWith('2026-')));
  ok('maxWeight 只按本年算', toRecordModel([...base, A('2027-06-01', 'design', 500)], 2026).maxWeight === 3);
  ok('别年活动被记进 dropped.otherYear', toRecordModel([...base, A('2025-06-01', 'design', 9)], 2026).dropped.otherYear === 1);
  invariant([...base, A('2025-06-01', 'design', 999)], 2026, '跨年:');
}

console.log('\n[2] 非法日期: 不许崩, 也不许"统计算了图上没有"(实测过 2026-13-45 直接抛 TypeError)');
{
  const bad = [A('2026-13-45', 'design', 5), A('2026-02-30', 'design', 7), A('202X-01-01', 'design', 9),
               A('2026-1-1', 'design', 11), A('', 'design', 3), A(null, 'design', 3), A('2026-03-05', 'design', 2)];
  let threw = false, s = null;
  try { s = computeStats(bad, { year: 2026 }); } catch { threw = true; }
  ok('不抛', !threw);
  ok('只认合法日期(总投入 2)', s.weight.sum === 2, s.weight.sum);
  ok('非法日期计入 dropped.invalidDate', s.dropped.invalidDate === 6, s.dropped);
  invariant(bad, 2026, '非法日期:');
  ok('parseDate 认 2026-02-28 / 拒 2026-02-29(非闰年)', !!parseDate('2026-02-28') && !parseDate('2026-02-29'));
  ok('parseDate 认闰年 2024-02-29', !!parseDate('2024-02-29'));
  ok('parseDate 拒非字符串', !parseDate(20260101) && !parseDate(null) && !parseDate({}));
}

console.log('\n[3] 「出版」活动不许在图上凭空消失(实测过: 统计算 1 天 3 投入, 图上一片空白)');
{
  const acts = [A('2026-03-03', 'publish', 3, { title: '上线' })];
  const { m } = invariant(acts, 2026, '出版:');
  const svg = renderRecord(m, {});
  const cell = m.days['2026-03-03'];
  ok('出版那天进了 days', !!cell && cell.categoryId === 'publish');
  ok('整年图真画了那格', svg.includes(`fill="#9e3b32"`) && svg.split('#9e3b32').length > 2);
  ok('单月图也画了', renderMonth(m, 2, {}).includes('#9e3b32'));
  ok('活动带也画了', renderStrip(m, {}).includes('#9e3b32'));
  ok('没打 milestone 标就不该有朱砂印', m.milestones.length === 0);
}

console.log('\n[4] 里程碑没写标题也不许丢(原来靠标题真假判断, 空标题整个消失)');
{
  const acts = [A('2026-05-05', 'publish', 3, { milestone: true, title: '' }), A('2026-06-06', 'design', 2, { milestone: true, title: '有名字' })];
  const { s, m } = invariant(acts, 2026, '空标题里程碑:');
  ok('两个里程碑都在', m.milestones.length === 2, m.milestones);
  ok('空标题的那个 label 为空串而不是消失', m.milestones.some((x) => x.date === '2026-05-05' && x.label === ''), m.milestones);
  ok('统计侧同样是 2 个', s.milestones.length === 2);
  ok('渲染不崩', renderRecord(m, {}).includes('</svg>') && renderMonth(m, 4, {}).includes('</svg>'));
}

console.log('\n[5] 平手要定得下来(同一份数据换个数组顺序不许换颜色)');
{
  const tie = [A('2026-07-07', 'design', 2), A('2026-07-07', 'writing', 2)];
  const a = toRecordModel(tie, 2026).days['2026-07-07'].categoryId;
  const b = toRecordModel([...tie].reverse(), 2026).days['2026-07-07'].categoryId;
  ok('正序=逆序', a === b, [a, b]);
  ok('整张图逐字节一致', renderRecord(toRecordModel(tie, 2026), {}) === renderRecord(toRecordModel([...tie].reverse(), 2026), {}));
  const three = [A('2026-08-08', 'build', 1), A('2026-08-08', 'research', 1), A('2026-08-08', 'writing', 1)];
  ok('三方平手也稳定', toRecordModel(three, 2026).days['2026-08-08'].categoryId === toRecordModel([...three].reverse(), 2026).days['2026-08-08'].categoryId);
}

console.log('\n[6] 投入量口径唯一(负数/非数字, 统计与画面必须同一套)');
{
  const w = [A('2026-01-01', 'design', -5), A('2026-01-02', 'design', 2.6), A('2026-01-03', 'design', '3'), A('2026-01-04', 'design', null)];
  const { s } = invariant(w, 2026, '怪投入量:');
  ok('weightOf: 负→0 / 非数字→0 / 字符串数字可用', weightOf({ weight: -5 }) === 0 && weightOf({ weight: null }) === 0 && weightOf({ weight: '3' }) === 3);
  ok('总投入 = 分类合计(原来 5.6 vs 0.6 打架)', Math.abs(s.weight.sum - s.byType.reduce((n, t) => n + t.weight, 0)) < 0.01, [s.weight.sum, s.byType.map((t) => t.weight)]);
  ok('总投入 = 按月合计', Math.abs(s.weight.sum - s.byMonth.reduce((n, mm) => n + mm.weight, 0)) < 0.01, [s.weight.sum, s.byMonth.reduce((n, mm) => n + mm.weight, 0)]);
  ok('没有浮点尾巴', !/\.\d{3,}/.test(String(s.weight.sum) + s.byType.map((t) => t.weight).join('')), [s.weight.sum, s.byType.map((t) => t.weight)]);
}

console.log('\n[7] 极端数据下版面不崩');
{
  const many = Array.from({ length: 60 }, (_, i) => A(`2026-06-${String((i % 30) + 1).padStart(2, '0')}`, `很长的业务类型名${i}`, 1));
  const m = toRecordModel(many, 2026);
  for (const [name, svg] of [['整年', renderRecord(m, {})], ['单月', renderMonth(m, 5, {})], ['活动带', renderStrip(m, {})]]) {
    ok(`${name}: 60 类不崩且无 NaN`, svg.includes('</svg>') && !/NaN|undefined/.test(svg));
  }
  const heavy = [A('2026-04-04', 'design', 1, { title: '标' .repeat(400) }), A('2026-04-05', 'x<>&"y', 1, { title: '<script>bad</script>' })];
  const hm = toRecordModel(heavy, 2026);
  const hsvg = renderRecord(hm, {});
  ok('超长标题 + 特殊字符: 已转义, 不崩', hsvg.includes('</svg>') && !hsvg.includes('<script>'));
  ok('单月页超长标题被截断', renderMonth(hm, 3, {}).includes('…'));
  const sameDay = Array.from({ length: 200 }, () => A('2026-09-09', 'design', 1));
  ok('同一天 200 条 → level 封顶 4', toRecordModel(sameDay, 2026).days['2026-09-09'].level === 4);
}

console.log('\n[8] 分拣入口是唯一的(统计与渲染不可能各走各的)');
{
  const acts = [A('2026-01-01', 'design', 2), A('2025-01-01', 'design', 2), A('bad', 'design', 2), null, 'x'];
  const p = partitionActivities(acts, 2026);
  ok('partitionActivities 分得清', p.kept.length === 1 && p.otherYear === 1 && p.invalidDate === 1 && p.malformed === 2, p);
  const ds = toDailySeries(acts, 2026);
  ok('toDailySeries 用的就是它', ds.kept.length === 1 && ds.dropped.otherYear === 1);
  ok('computeStats 报同一份 dropped', JSON.stringify(computeStats(acts, { year: 2026 }).dropped) === JSON.stringify(ds.dropped));
  ok('aggregateByDay 单独调用也跳非法日期', Object.keys(aggregateByDay(acts)).length === 2); // 2026 与 2025 各一天, 非法的被跳过
}

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
