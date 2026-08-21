// 皮肤可换性验收 —— 「换一套配色/质感参数就能出另一副样子, 不改代码」这句话必须为真。
// 设计方给的是一份**值**, 不是一个 PR。用法: node scripts/test-skin.mjs
import { createRecord, renderRecord, renderMonth, renderStrip, renderStatCard, renderGroupBars,
  resolveVariant, RECORD_VARIANTS, buildRecordPdfBytes, buildMonthPdfBytes } from '../src/record/index.js';
import { sampleCOActivities } from '../src/data/sample-co.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };

const acts = sampleCOActivities(2026);

// 一份"假装是设计方给的"皮肤:冷灰底 + 蓝墨 + 一组新的分类色 + 手绘质感
const SKIN = {
  paper: '#eef1f4', paper2: '#e3e8ee', ink: '#1d2733', inkSoft: '#6b7885', line: '#cfd8e0',
  seal: '#c2452f', mono: false, weekendTint: false,
  texFreq: 0.09, texOp: 0.1, speckle: false, speckleOp: 0,
  era: '2026', title: '活动留痕', sub1: 'CO 界面版', sub2: 'Screen Edition',
  palette: { 收灵感: '#3f6f9c', 分析: '#8a6a4f', 整理: '#4f8a72' },
};

console.log('\n[1] 传一份皮肤对象就能换样子(不必是预置的两个名字之一)');
{
  const base = createRecord(acts, { year: 2026 });
  const skinned = createRecord(acts, { year: 2026, variant: SKIN });
  const a = base.yearSVG(), b = skinned.yearSVG();
  ok('两张图不一样', a !== b);
  ok('新纸色用上了', b.includes('#eef1f4') && !b.includes('fill="#f4efe3"'), '应为冷灰底');
  ok('新分类色用上了', ['#3f6f9c', '#8a6a4f', '#4f8a72'].every((x) => b.includes(x)));
  ok('旧分类色不再出现', !['#6f8ea0', '#b5794f', '#86a07e'].some((x) => b.includes(x)));
  ok('新朱砂色用上了', b.includes('#c2452f'));
  ok('没有 NaN/undefined', !/NaN|undefined/.test(b));
  ok('只写要改的项也行(浅合并)', (() => {
    const partial = resolveVariant({ paper: '#ffffff' });
    return partial.paper === '#ffffff' && partial.ink === RECORD_VARIANTS['editorial-rubbing'].ink;
  })());
  ok('预置名照常', resolveVariant('tuogu-ink').mono === true && resolveVariant('editorial-rubbing').mono === false);
  ok('乱名回退默认', resolveVariant('没这皮肤').paper === RECORD_VARIANTS['editorial-rubbing'].paper);
  ok('undefined 回退默认', resolveVariant().paper === RECORD_VARIANTS['editorial-rubbing'].paper);
}

console.log('\n[2] 所有出口都认这份皮肤(不是只有整年图)');
{
  const rec = createRecord(acts, { year: 2026, variant: SKIN });
  const outs = {
    整年图: rec.yearSVG(),
    单月卡: rec.monthSVG(2),
    活动带: rec.stripSVG(),
    统计卡: rec.statCardSVG(),
    分组横条: rec.groupBarsSVG(),
  };
  for (const [name, svg] of Object.entries(outs)) {
    ok(`${name}用上了新纸色`, svg.includes('#eef1f4'), name);
    ok(`${name}无 NaN`, !/NaN|undefined/.test(svg));
  }
  ok('整年图/单月卡/活动带都用上了新分类色', ['整年图', '单月卡', '活动带'].every((k) => outs[k].includes('#3f6f9c')));
  ok('统计卡的占比条也跟着换色', outs.统计卡.includes('#3f6f9c'));
  ok('分组横条也跟着换色', outs.分组横条.includes('#3f6f9c'));
}

console.log('\n[3] 印刷 PDF 也认(印刷那套留给原皮肤, 但机制得通)');
{
  const model = createRecord(acts, { year: 2026, variant: SKIN }).model;
  const y = await buildRecordPdfBytes(model, {});
  const m = await buildMonthPdfBytes(model, 2, {});
  ok('整年 PDF 出得来', y.length > 8000);
  ok('单月 PDF 出得来', m.length > 3000);
}

console.log('\n[4] 质感参数也能换(不改代码)');
{
  const rec = createRecord(acts, { year: 2026, variant: SKIN });
  ok('皮肤里的 texFreq 生效', rec.yearSVG().includes('baseFrequency="0.09"'), '应为 0.09');
  ok('皮肤里关掉飞点就没有飞点滤镜', !/-sp"/.test(rec.yearSVG()));
  ok('还能再单独换质感预设', createRecord(acts, { year: 2026, variant: SKIN, texture: 'topographic' }).yearSVG().includes('feComponentTransfer'));
  ok('质感参数可逐项微调', createRecord(acts, { year: 2026, texture: { name: 'topographic', lineOp: 0.44 } }).yearSVG().includes('opacity="0.44"'));
}

console.log('\n[5] 换皮肤不改数据:同一份数据, 数字必须一模一样');
{
  const a = createRecord(acts, { year: 2026 }), b = createRecord(acts, { year: 2026, variant: SKIN });
  const sa = a.stats(), sb = b.stats();
  ok('有痕天数一样', sa.days.active === sb.days.active);
  ok('总投入一样', sa.weight.sum === sb.weight.sum);
  ok('分类占比一样', JSON.stringify(sa.byType.map((t) => [t.id, t.share])) === JSON.stringify(sb.byType.map((t) => [t.id, t.share])));
  ok('落格天数一样', Object.keys(a.model.days).length === Object.keys(b.model.days).length);
  ok('简报文字一样(皮肤只管好看, 不管说什么)', a.report() === b.report());
}

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
