// 可嵌入小件自测 —— node 直跑。重点验"同页无限次复用"这条:多实例 id 不撞、
// 同参数输出确定、尺寸自适应、空数据不崩。
// 用法: node scripts/test-embed.mjs
import { renderStrip, renderStatCard, renderGroupBars } from '../src/embed/index.js';
import { createRecord, TEXTURE_PRESETS } from '../src/record/index.js';
import { sampleActivities } from '../src/data/activity.js';
import { computeStats } from '../src/data/stats.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };
const idsIn = (svg) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const vb = (svg) => (svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []).slice(1).map(Number);

const acts = sampleActivities(2026);
const rec = createRecord(acts, { year: 2026 });
const stats = rec.stats();

console.log('\n[1] 基本产出');
const strip = rec.stripSVG();
const card = rec.statCardSVG();
ok('活动带是完整 SVG', strip.startsWith('<svg') && strip.endsWith('</svg>'));
ok('统计卡是完整 SVG', card.startsWith('<svg') && card.endsWith('</svg>'));
ok('都无 NaN/undefined', !/NaN|undefined/.test(strip + card));
ok('都是 width="100%"(由容器定尺寸, 不写死像素)', strip.includes('width="100%"') && card.includes('width="100%"'));
ok('活动带画满一年(365 格 + 底格)', (strip.match(/<rect /g) || []).length > 365, (strip.match(/<rect /g) || []).length);
ok('统计卡带出关键数字', card.includes(String(stats.days.active)) && card.includes(String(stats.weight.sum)));
ok('统计卡自带人话摘要(不必调用方喂)', card.includes('天有痕') || /占全年/.test(card), card.slice(0, 0));

console.log('\n[2] 同页无限次复用 —— id 不撞、输出确定');
const s1 = renderStrip(rec.model, { texture: 'rubbing' });
const s2 = renderStrip(rec.model, { texture: 'tiedye' });
const s3 = renderStrip(rec.model, { texture: 'handdrawn' });
const c1 = renderStatCard(stats, { texture: 'topographic' });
const all = [s1, s2, s3, c1].map(idsIn);
ok('四个实例的 id 集合两两无交集', all.every((a, i) => all.every((b, j) => i === j || a.every((x) => !b.includes(x)))), all.map((a) => a.length));
ok('同参数两次调用完全一致(确定性)', renderStrip(rec.model, { texture: 'tiedye' }) === s2);
ok('不同参数 → 不同 id 前缀', idsIn(s1)[0] !== idsIn(s2)[0], [idsIn(s1)[0], idsIn(s2)[0]]);
ok('显式 id 可覆盖', renderStrip(rec.model, { id: 'mine' }).includes('id="mine-'), idsIn(renderStrip(rec.model, { id: 'mine' })));
ok('引用的滤镜 id 都在自己 defs 里', (() => {
  const used = [...s2.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  return used.length > 0 && used.every((id) => s2.includes(`id="${id}"`));
})());

console.log('\n[3] 尺寸自适应(不写死成某一张页面)');
const small = renderStrip(rec.model, { cell: 2, gap: 0.4 });
const big = renderStrip(rec.model, { cell: 5, gap: 1 });
ok('格子变大 → viewBox 变大', vb(big)[0] > vb(small)[0] && vb(big)[1] > vb(small)[1], [vb(small), vb(big)]);
const q = renderStrip(rec.model, { from: 0, to: 2 });
ok('只画一季度 → 明显更窄', vb(q)[0] < vb(strip)[0] * 0.4, [vb(q)[0], vb(strip)[0]]);
ok('单月段也成立', vb(renderStrip(rec.model, { from: 7, to: 7 }))[0] > 0);
ok('关掉月标尺 → 变矮', vb(renderStrip(rec.model, { months: false }))[1] < vb(strip)[1]);
ok('开周标 → 变宽', vb(renderStrip(rec.model, { weekdays: true }))[0] > vb(strip)[0]);
const narrow = renderStatCard(stats, { width: 70 });
ok('统计卡可窄到 70mm 且不溢出', vb(narrow)[0] === 70 && !/NaN/.test(narrow));
ok('指标可选', renderStatCard(stats, { metrics: ['activities'] }).includes('条活动'));
ok('指标少 → 卡片不变矮才怪(高度随内容)', vb(renderStatCard(stats, { metrics: [], summary: false }))[1] < vb(card)[1], [vb(card)[1]]);

console.log('\n[4] 四质感都能上小件');
for (const p of TEXTURE_PRESETS) {
  const a = rec.stripSVG({ texture: p.name }), b = rec.statCardSVG({ texture: p.name });
  ok(`活动带 + ${p.name}`, a.includes('<svg') && !/NaN|undefined/.test(a));
  ok(`统计卡 + ${p.name}`, b.includes('<svg') && !/NaN|undefined/.test(b));
}
ok('A 全拓变体也成立', createRecord(acts, { variant: 'tuogu-ink' }).stripSVG().includes('<svg'));

console.log('\n[5] 空 / 乱数据不崩');
const empty = createRecord([], { year: 2026 });
ok('空数据活动带仍画出素纸格', empty.stripSVG().includes('<rect'));
ok('空数据统计卡不崩', (() => { const x = empty.statCardSVG(); return x.includes('<svg') && !/NaN|undefined/.test(x); })());
ok('闰年 2024 活动带多一格列位不越界', renderStrip(createRecord([], { year: 2024 }).model, {}).includes('<svg'));
ok('renderStrip 吃 null model 不抛', (() => { try { return renderStrip(null, {}).includes('<svg'); } catch { return false; } })());
ok('renderStatCard 吃 null 不抛', (() => { try { return renderStatCard(null, {}).includes('<svg'); } catch { return false; } })());
ok('from/to 反了也不抛', renderStrip(rec.model, { from: 9, to: 2 }).includes('<svg'));
ok('越界 from/to 被夹住', renderStrip(rec.model, { from: -5, to: 99 }).includes('<svg'));
ok('统计卡吃只有部分字段的 stats', renderStatCard({ year: 2026 }, {}).includes('<svg'));

console.log('\n[6] 里程碑与留白在小件里仍读得出');
const msDates = rec.model.milestones.map((m) => m.date);
ok('有里程碑数据', msDates.length > 0, msDates.length);
const sealCount = (rec.stripSVG().match(new RegExp(computeStats(acts, { year: 2026 }).milestones.length ? '#9e3b32' : 'zzz', 'g')) || []).length;
ok('活动带画出朱砂里程碑', sealCount >= msDates.length, sealCount);

console.log('\n[7] 分组横条(多人场景的主力件)');
{
  const team = acts.map((a, i) => ({ ...a, actor: ['阿一', '阿二', '阿三'][i % 3] }));
  const tr = createRecord(team, { year: 2026 });
  const bars = tr.groupBarsSVG({ groupBy: 'actor' });
  ok('是完整 SVG 且无 NaN', bars.startsWith('<svg') && bars.endsWith('</svg>') && !/NaN|undefined/.test(bars));
  ok('三个人都画出来了', ['阿一', '阿二', '阿三'].every((n) => bars.includes(n)), bars.length);
  ok('抬头写明按什么分', bars.includes('按actor') || bars.includes('按分组'), bars.slice(0, 300));
  ok('groupLabel 可给人话名', tr.groupBarsSVG({ groupBy: 'actor', groupLabel: '成员' }).includes('按成员'));
  ok('title 优先级最高', tr.groupBarsSVG({ groupBy: 'actor', groupLabel: '成员', title: '谁在干活' }).includes('谁在干活'));
  ok('全拓变体只用墨色, 不冒彩色', (() => {
    const m = createRecord(team, { year: 2026, variant: 'tuogu-ink' }).groupBarsSVG({ groupBy: 'actor' });
    return !/#4a6b8a|#9a5c6b|#c08a3e|#5f7f66|#6f5b8e|#8a7a52/.test(m);
  })());
  ok('不给 groupBy 也不空着(退回按分类)', (() => { const b = tr.groupBarsSVG(); return b.includes('设计') && b.includes('按分类'); })());
  ok('by=days 可切', renderGroupBars(tr.stats({ groupBy: 'actor' }), { by: 'days' }).includes('天'));
  ok('by 非法回退 weight', renderGroupBars(tr.stats({ groupBy: 'actor' }), { by: '乱写' }).includes('投入'));
  ok('max 限行数', (() => {
    const one = renderGroupBars(tr.stats({ groupBy: 'actor' }), { max: 1 });
    return one.includes('阿一') + one.includes('阿二') + one.includes('阿三') === 1;
  })());
  ok('同名永远同色(与顺序无关)', renderGroupBars(tr.stats({ groupBy: 'actor' }), {}) === renderGroupBars(createRecord([...team].reverse(), { year: 2026 }).stats({ groupBy: 'actor' }), {}));
  ok('区间可用', tr.groupBarsSVG({ groupBy: 'actor', from: '2026-03-01', to: '2026-03-31' }).includes('<svg'));
  ok('里程碑标朱砂点', (() => {
    const ms = createRecord([{ id: 'a', date: '2026-01-01', type: 'publish', title: 'x', weight: 3, milestone: true, actor: '阿一' }], { year: 2026 });
    return ms.groupBarsSVG({ groupBy: 'actor' }).includes('#9e3b32');
  })());
  ok('空数据不崩', renderGroupBars(createRecord([], { year: 2026 }).stats({ groupBy: 'actor' }), {}).includes('</svg>'));
  ok('null 不崩', renderGroupBars(null, {}).includes('</svg>'));
  ok('同页与其它小件 id 不撞', (() => {
    const a = idsIn(bars), b = idsIn(tr.statCardSVG());
    return a.every((x) => !b.includes(x));
  })());
  ok('宽度自适应', vb(renderGroupBars(tr.stats({ groupBy: 'actor' }), { width: 80 }))[0] === 80);
  ok('行数越多越高', vb(renderGroupBars(tr.stats({ groupBy: 'actor' }), { max: 3 }))[1] > vb(renderGroupBars(tr.stats({ groupBy: 'actor' }), { max: 1 }))[1]);
}

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
