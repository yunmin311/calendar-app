// 一致性与静默丢数据 —— 本轮自审揪出来的问题, 每条都钉一个回归断言在这里。
// 组件的核心承诺只有一句:**统计说有的, 图上必须画得出来; 图上没有的, 统计也不该算。**
// 用法: node scripts/test-consistency.mjs
import { toRecordModel, toDailySeries, aggregateByDay, parseDate, weightOf, partitionActivities, levelThresholds } from '../src/data/activity.js';
import { computeStats } from '../src/data/stats.js';
import { renderRecord } from '../src/poster/renderRecord.js';
import { renderMonth } from '../src/poster/renderMonth.js';
import { renderStrip } from '../src/embed/index.js';
import { RECORD_VARIANTS } from '../src/poster/renderRecord.js';
import { legendItems, inkOpacity } from '../src/poster/paint.js';

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
  // 分档是按分布切的(见 levelThresholds), 所以"只有一种忙碌程度"时没有深浅可言 —— 全部同档。
  // 绝对量该由统计与简报去说(count / weight.sum), 那才是说数字的地方。
  const sameDay = Array.from({ length: 200 }, () => A('2026-09-09', 'design', 1));
  ok('全年只有一天有痕 → 不崩且落在合法档', [1, 2, 3, 4].includes(toRecordModel(sameDay, 2026).days['2026-09-09'].level));
  const flat = Array.from({ length: 5 }, (_, i) => A(`2026-09-0${i + 1}`, 'design', 3));
  ok('取值只有一种 → 所有天同档', new Set(Object.values(toRecordModel(flat, 2026).days).map((d) => d.level)).size === 1);
  const spread = [1, 2, 4, 8, 16, 32].map((w, i) => A(`2026-10-0${i + 1}`, 'design', w));
  const sl = Object.values(toRecordModel(spread, 2026).days).map((d) => d.level);
  ok('有多种取值时最忙那天落 L4', sl[sl.length - 1] === 4, sl);
  ok('level 随 count 单调不降', sl.every((v, i) => i === 0 || v >= sl[i - 1]), sl);
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

console.log('\n[7b] 分档按分布切:一个离群日不许把所有典型日压到最浅那档(CO 口径 weight=条目数)');
{
  const build = (peak) => {
    const acts = [];
    for (let d = 1; d <= 28; d++) acts.push(A(`2026-02-${String(d).padStart(2, '0')}`, 'x', (d % 4) + 1));
    acts.push(A('2026-02-15', 'x', peak));   // 一个大离群日
    return acts;
  };
  const dist = (acts) => { const lv = [0, 0, 0, 0, 0]; for (const d of Object.values(toRecordModel(acts, 2026).days)) lv[d.level]++; return lv.slice(1); };
  for (const peak of [8, 30, 200]) {
    const l = dist(build(peak));
    ok(`离群日 ${peak} 条:四档都用得上(不塌成一档)`, l.filter((n) => n > 0).length >= 3 && Math.max(...l) < 25, l);
  }
  ok('离群值大小不改变其余天的分档', JSON.stringify(dist(build(30))) === JSON.stringify(dist(build(200))), [dist(build(30)), dist(build(200))]);
  ok('相同 count 永远同档', (() => {
    const acts = [1, 2, 2, 2, 3, 3, 9].map((w, i) => A(`2026-04-0${i + 1}`, 'x', w));
    const byCount = {};
    for (const d of Object.values(toRecordModel(acts, 2026).days)) (byCount[d.count] ||= new Set()).add(d.level);
    return Object.values(byCount).every((s) => s.size === 1);
  })());
  ok('levelThresholds 递增且长度 3', (() => { const t = levelThresholds([1, 2, 3, 4, 5, 6, 7, 8]); return t.length === 3 && t[0] <= t[1] && t[1] <= t[2]; })(), levelThresholds([1, 2, 3, 4, 5, 6, 7, 8]));
  ok('空输入不崩', JSON.stringify(levelThresholds([])) === JSON.stringify([0, 0, 0]));
}

console.log('\n[8b] 年份传字符串不许丢东西(实测过: 整年图上所有朱砂印会全部消失)');
{
  const acts = [A('2026-01-05', 'design', 2), A('2026-03-03', 'publish', 3, { milestone: true, title: '上线' })];
  const mNum = toRecordModel(acts, 2026), mStr = toRecordModel(acts, '2026');
  ok('model.year 规整成数字', typeof mStr.year === 'number' && mStr.year === 2026, typeof mStr.year);
  ok('里程碑没丢', mStr.milestones.length === 1 && mNum.milestones.length === 1);
  ok('整年图逐字节一致', renderRecord(mNum, {}) === renderRecord(mStr, {}));
  ok('单月图逐字节一致', renderMonth(mNum, 2, {}) === renderMonth(mStr, 2, {}));
  ok('活动带逐字节一致', renderStrip(mNum, {}) === renderStrip(mStr, {}));
  ok('图上真有朱砂印(不是两边都没有)', renderRecord(mStr, {}).split('#9e3b32').length > 2);
  ok('统计侧也认字符串年', computeStats(acts, { year: '2026' }).milestones.length === 1);
  // 手搓 model(年份是字符串)也不该整片丢印 —— 下游比较都加了 Number()
  const hand = { ...mNum, year: '2026' };
  ok('手搓字符串年的 model 仍画得出印', renderRecord(hand, {}).split('#9e3b32').length > 2);
  ok('手搓字符串年的月卡仍画得出印', renderMonth(hand, 2, {}).split('#9e3b32').length > 2);
}

console.log('\n[9] 图例不许说谎:只列图上真出现过的分类, 出现了的必须列');
{
  const c = RECORD_VARIANTS['editorial-rubbing'];
  // 只有两类活动 → 图例不该把五类全摆出来
  const two = toRecordModel([A('2026-01-05', 'design', 2), A('2026-02-06', 'writing', 1)], 2026);
  const li = legendItems(two, c);
  ok('只列出现过的两类', li.length === 2 && li.map((x) => x.name).sort().join() === '写作,设计', li);
  ok('没有里程碑就不列「里程碑」', !li.some((x) => x.name === '里程碑'));

  // 出版有色块 → 图例必须认账(上轮把出版改成正常落墨, 图例却还在过滤它)
  const pub = toRecordModel([A('2026-03-03', 'publish', 3)], 2026);
  const pl = legendItems(pub, c);
  ok('出版落墨了, 图例就得列「出版」', pl.some((x) => x.name === '出版'), pl);
  const svg = renderRecord(pub, {});
  ok('图上有出版色块、图例也有该色', svg.split('#9e3b32').length > 2);

  // 有里程碑 → 列;且与出版分开列
  const ms = toRecordModel([A('2026-03-03', 'publish', 3, { milestone: true })], 2026);
  const ml = legendItems(ms, c);
  ok('有里程碑就列', ml.some((x) => x.name === '里程碑'));
  ok('里程碑与出版是两条', ml.length === 2 && ml.some((x) => x.name === '出版'), ml);

  // 月卡图例只看当月
  const yr = toRecordModel([A('2026-01-05', 'design', 2), A('2026-06-06', 'build', 1)], 2026);
  ok('一月只列设计', legendItems(yr, c, { month: 0 }).map((x) => x.name).join() === '设计', legendItems(yr, c, { month: 0 }));
  ok('六月只列构建', legendItems(yr, c, { month: 5 }).map((x) => x.name).join() === '构建');
  ok('空月份图例为空', legendItems(yr, c, { month: 8 }).length === 0);
  ok('渲染出来的月卡图例条数与之一致', (() => {
    const m0 = renderMonth(yr, 0, {});
    return m0.includes('设计') && !m0.includes('构建');
  })());

  // A 全拓
  const monoC = RECORD_VARIANTS['tuogu-ink'];
  const monoModel = toRecordModel([A('2026-01-05', 'design', 2)], 2026, 'tuogu-ink');
  ok('全拓图例是「墨深」而不是分类色', legendItems(monoModel, monoC).some((x) => x.ink && x.name.includes('墨深')), legendItems(monoModel, monoC));
  ok('全拓无数据时图例为空', legendItems(toRecordModel([], 2026, 'tuogu-ink'), monoC).length === 0);
}

console.log('\n[10] 墨深公式只有一份(屏幕与印刷不可能漂)');
{
  ok('强度 0 → 底值', inkOpacity(0, { carrier: 'year' }) === 0.45 && inkOpacity(0, { carrier: 'month' }) === 0.4);
  ok('强度 1 → 满值', inkOpacity(1, { carrier: 'year' }) === 1 && inkOpacity(1, { carrier: 'strip' }) === 1);
  ok('mono 另一套', inkOpacity(1, { mono: true, carrier: 'year' }) === 0.98);
  ok('越界被夹住', inkOpacity(5, { carrier: 'year' }) === 1 && inkOpacity(-3, { carrier: 'year' }) === 0.45);
  ok('非数字不产生 NaN', inkOpacity(undefined, { carrier: 'year' }) === 0.45 && !Number.isNaN(inkOpacity('x', { carrier: 'year' })));
  ok('未知载体退回整年', inkOpacity(0.5, { carrier: '乱写' }) === inkOpacity(0.5, { carrier: 'year' }));
  // 屏幕 SVG 里的透明度必须能在 PDF 内容流里找到同样的值(同一函数, 这里做形式核对)
  const model = toRecordModel([A('2026-01-05', 'design', 2), A('2026-01-06', 'design', 8)], 2026);
  const svg = renderRecord(model, {});
  const wanted = Object.values(model.days).map((d) => inkOpacity(d.intensity, { carrier: 'year' }));
  ok('整年图里出现的正是这几个透明度', wanted.every((v) => svg.includes(`opacity="${v}"`)), wanted);
}

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
