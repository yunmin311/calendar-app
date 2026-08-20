// 简报层自测 —— 秘书交出去的是文字, 数字错了比图错了更要命(没人会去核对)。
// 用法: node scripts/test-digest.mjs
import { digest, compare, highlights, previousRange, reportFor } from '../src/data/digest.js';
import { computeStats, monthRange, daysBack } from '../src/data/stats.js';
import { sampleActivities } from '../src/data/activity.js';
import { createRecord } from '../src/record/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };
const A = (date, type, weight, extra = {}) => ({ id: date + type + weight, date, type, title: 't', weight, ...extra });

console.log('\n[1] previousRange: 紧邻在前、同样长度(不看今天是几号)');
ok('7 天 → 前 7 天', JSON.stringify(previousRange({ from: '2026-03-14', to: '2026-03-20' })) === JSON.stringify({ from: '2026-03-07', to: '2026-03-13' }), previousRange({ from: '2026-03-14', to: '2026-03-20' }));
ok('整月 → 前 31 天(不是"上个自然月")', JSON.stringify(previousRange({ from: '2026-03-01', to: '2026-03-31' })) === JSON.stringify({ from: '2026-01-29', to: '2026-02-28' }));
ok('单日 → 前一日', previousRange({ from: '2026-03-02', to: '2026-03-02' }).from === '2026-03-01');
ok('跨月边界正确', previousRange({ from: '2026-03-01', to: '2026-03-07' }).from === '2026-02-22');
ok('非法输入不崩', previousRange({ from: '乱写', to: '2026-01-01' }).from === null && previousRange().from === null);
ok('倒置区间不崩', previousRange({ from: '2026-05-01', to: '2026-04-01' }).from === null);

console.log('\n[2] compare: 涨跌算得对, 上期为 0 时不报 Infinity');
{
  const cur = computeStats([A('2026-03-01', 'design', 6), A('2026-03-02', 'writing', 4)], { year: 2026, from: '2026-03-01', to: '2026-03-07' });
  const prev = computeStats([A('2026-02-22', 'design', 4)], { year: 2026, from: '2026-02-22', to: '2026-02-28' });
  const c = compare(cur, prev);
  ok('has=true', c.has === true);
  ok('投入 10 vs 4 → +6 (+150%)', c.weight.diff === 6 && c.weight.pct === 150, c.weight);
  ok('有痕天数 2 vs 1 → +1', c.activeDays.diff === 1);
  ok('活动条数 +1', c.activities.diff === 1);
  // 变化最大的是新开的「写作」(+4), 不是「设计」(+2) —— 秘书关心的就是"什么变了"
  ok('分类按变化幅度降序', c.byType[0].id === 'writing' && c.byType[0].diff === 4 && c.byType[1].diff === 2, c.byType);
  const fresh = c.byType.find((t) => t.id === 'writing');
  ok('上期为 0 的类: pct 给 null 不给 Infinity', fresh.prev === 0 && fresh.pct === null && fresh.diff === 4, fresh);
  ok('缺一边则 has=false', compare(cur, null).has === false && compare(null, prev).has === false);
  const same = compare(cur, cur);
  ok('自己跟自己比全是 0', same.weight.diff === 0 && same.weight.flat === true);
}

console.log('\n[3] digest: 关键数字都在, 没有 NaN/undefined');
{
  const acts = sampleActivities(2026);
  const cur = computeStats(acts, { year: 2026, ...monthRange(2026, 2) });
  const txt = digest(cur);
  ok('抬头写明区间', txt.includes('2026-03-01 至 2026-03-31(31 天)'), txt.split('\n')[0]);
  ok('活动条数在', txt.includes(String(cur.activities)));
  ok('有痕天数在', txt.includes(`${cur.days.active} 天有痕`));
  ok('总投入在', txt.includes(`总投入 ${cur.weight.sum}`));
  ok('无 NaN/undefined/[object', !/NaN|undefined|\[object/.test(txt), txt.slice(0, 200));
  ok('多行', txt.split('\n').length >= 4);
  ok('markdown 版有 ## 与 -', digest(cur, { format: 'markdown' }).includes('## ') && digest(cur, { format: 'markdown' }).includes('- '));
  ok('纯文本版不带 markdown 记号', !/\*\*|^## /m.test(txt));
  ok('自定义抬头', digest(cur, { title: '本月留痕' }).startsWith('本月留痕 ·'));
  ok('整年不写区间只写年份', digest(computeStats(acts, { year: 2026 })).includes('2026 年'));
}

console.log('\n[4] digest 带对比 / 分组');
{
  const acts = sampleActivities(2026);
  const cur = computeStats(acts, { year: 2026, ...daysBack('2026-03-20', 7) });
  const prev = computeStats(acts, { year: 2026, ...previousRange(cur.range) });
  const txt = digest(cur, { compare: prev });
  ok('写出上一期区间', txt.includes(`比上一期(${prev.range.from} 至 ${prev.range.to})`), txt);
  ok('带正负号', /投入 [+-]/.test(txt));
  const team = acts.map((a, i) => ({ ...a, actor: ['阿一', '阿二', '阿三'][i % 3] }));
  const g = computeStats(team, { year: 2026, ...monthRange(2026, 2), groupBy: 'actor' });
  const gt = digest(g, { groupLabel: '成员' });
  ok('分组那行在', gt.includes('成员:') && gt.includes('阿一'), gt);
  ok('不给 groupLabel 用字段名', digest(g).includes('actor:'));
  // 行首那个「·」是项目符号, 要去掉再数分隔符
  const groupLine = (t) => t.split('\n').find((l) => l.includes('actor:')).replace(/^·\s*/, '');
  ok('分组条数可限', groupLine(digest(g, { maxGroups: 1 })).split('·').length === 1, groupLine(digest(g, { maxGroups: 1 })));
  ok('默认列多条', groupLine(digest(g)).split('·').length === 3);
}

console.log('\n[5] highlights: 只说值得说的');
{
  const dense = computeStats(Array.from({ length: 7 }, (_, i) => A(`2026-03-0${i + 1}`, 'design', 2)), { year: 2026, from: '2026-03-01', to: '2026-03-07' });
  ok('天天有痕会被点出来', highlights(dense, null).some((h) => h.includes('每天都有痕')), highlights(dense, null));
  const empty = computeStats([], { year: 2026, from: '2026-03-01', to: '2026-03-07' });
  ok('完全没记录只说一句', highlights(empty, null).length === 1 && highlights(empty, null)[0].includes('完全没有记录'));
  const cur = computeStats([A('2026-03-01', 'design', 10)], { year: 2026, from: '2026-03-01', to: '2026-03-07' });
  const prev = computeStats([A('2026-02-22', 'design', 2)], { year: 2026, from: '2026-02-22', to: '2026-02-28' });
  const h = highlights(cur, compare(cur, prev));
  ok('猛涨会被点出来', h.some((x) => x.includes('涨了')), h);
  const cur2 = computeStats([A('2026-03-01', 'writing', 5)], { year: 2026, from: '2026-03-01', to: '2026-03-07' });
  const h2 = highlights(cur2, compare(cur2, prev));
  ok('停掉的类被点出来', h2.some((x) => x.includes('上期有、这期没动的')), h2);
  ok('新开的类被点出来', h2.some((x) => x.includes('这期新开的')), h2);
  const ms = computeStats([A('2026-03-03', 'publish', 3, { milestone: true, title: '上线' })], { year: 2026, from: '2026-03-01', to: '2026-03-07' });
  ok('里程碑列出来', highlights(ms, null).some((x) => x.includes('里程碑 1 个') && x.includes('上线')), highlights(ms, null));
  ok('整年不会硬说"这段没有里程碑"', !highlights(computeStats([A('2026-03-01', 'design', 1)], { year: 2026 }), null).some((x) => x === '这段没有里程碑。'));
}

console.log('\n[6] 被挡下的数据要在简报里说明(不静默)');
{
  const dirty = [A('2026-03-01', 'design', 2), A('2026-13-45', 'design', 9), A('2025-03-01', 'design', 9), null];
  const txt = digest(computeStats(dirty, { year: 2026 }));
  ok('提示日期不合法的条数', txt.includes('1 条日期不合法'), txt);
  ok('提示不在本年的条数', txt.includes('1 条不在本年'));
  ok('提示不是活动对象的条数', txt.includes('1 条不是活动对象'));
  ok('干净数据不提这句', !digest(computeStats([A('2026-03-01', 'design', 2)], { year: 2026 })).includes('没有计入'));
}

console.log('\n[7] reportFor: 一步到位, 且不拿跨年的上一期骗人');
{
  const acts = sampleActivities(2026);
  const r = reportFor(acts, { year: 2026, ...daysBack('2026-03-20', 7) });
  ok('自动带上了对比', r.includes('比上一期'), r.split('\n')[3]);
  const jan = reportFor(acts, { year: 2026, from: '2026-01-01', to: '2026-01-07' });
  ok('上一期跨到去年 → 不比(而不是拿 0 当上期)', !jan.includes('比上一期'), jan);
  ok('不给区间 → 整年、不比', !reportFor(acts, { year: 2026 }).includes('比上一期'));
  ok('createRecord 上也有 report()', createRecord(acts, { year: 2026 }).report(daysBack('2026-03-20', 7)).includes('活动简报'));
}

console.log('\n[8] 空 / 乱输入不崩');
for (const [name, s] of [['null', null], ['空对象', {}], ['只有 year', { year: 2026 }]]) {
  let threw = false, out = '';
  try { out = digest(s); } catch { threw = true; }
  ok(`${name} 不抛`, !threw && typeof out === 'string', threw ? 'threw' : out.slice(0, 30));
}
ok('空数据整年简报仍成句', (() => { const t = digest(computeStats([], { year: 2026 })); return t.includes('0 条活动') && !/NaN/.test(t); })(), digest(computeStats([], { year: 2026 })));
ok('compare 吃垃圾不崩', compare({}, {}).has === false && compare(undefined, undefined).has === false);
ok('highlights 吃垃圾不崩', Array.isArray(highlights(null, null)) && highlights(null, null).length === 0);

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
