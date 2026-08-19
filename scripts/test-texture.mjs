// 手工质感模块自测 —— node 直跑, 无需浏览器。
// 验: 四预设可建 / 参数可编辑 / id 前缀隔离 / 三条渲染路径都吃到纹理 / 默认拓质不回归。
// 用法: node scripts/test-texture.mjs
import { texture, resolveTexture, TEXTURE_PRESETS, TEXTURE_DEFAULTS, isTexturePreset } from '../src/texture/index.js';
import { RECORD_VARIANTS, renderRecord } from '../src/poster/renderRecord.js';
import { renderMonth } from '../src/poster/renderMonth.js';
import { buildTextureSVG } from '../src/poster/exportPdf.js';
import { createRecord } from '../src/record/index.js';
import { sampleActivities } from '../src/data/activity.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

console.log('\n[1] 四预设都能建出 defs+body');
for (const p of TEXTURE_PRESETS) {
  const t = texture(p.name).build(841, 594, 'a');
  ok(`${p.name}(${p.label}) 有 defs`, typeof t.defs === 'string' && t.defs.includes('<filter') || t.defs.includes('<radialGradient'), t.defs.slice(0, 40));
  ok(`${p.name} 有 body`, typeof t.body === 'string' && t.body.length > 20);
  ok(`${p.name} 无 NaN/undefined`, !/NaN|undefined/.test(t.defs + t.body));
  ok(`${p.name} 引用的滤镜 id 都在 defs 里定义过`, (() => {
    const used = [...(t.body.matchAll(/url\(#([^)]+)\)/g))].map((m) => m[1]);
    return used.every((id) => t.defs.includes(`id="${id}"`));
  })());
}

console.log('\n[2] 未知预设回退拓质 / isTexturePreset');
ok('未知名回退 rubbing', texture('不存在的').name === 'rubbing');
ok('isTexturePreset 认得 tiedye', isTexturePreset('tiedye') === true);
ok('isTexturePreset 拒绝乱名', isTexturePreset('zzz') === false);

console.log('\n[3] 参数可编辑(这是"可编辑质感"的落点)');
const soft = texture('rubbing', { mottleOp: 0.4, speckle: false }).build(100, 100, 'b');
ok('改 mottleOp 生效', soft.body.includes('opacity="0.4"'));
ok('关 speckle 生效', !soft.body.includes('-sp'));
ok('默认值未被改坏(引用透明)', TEXTURE_DEFAULTS.rubbing.mottleOp === 0.15);
const dye = texture('tiedye', { centers: [{ cx: 0.5, cy: 0.5, r: 0.4, color: '#123456' }], rings: false }).build(200, 200, 'c');
ok('扎染染心可整体替换', (dye.defs.match(/<radialGradient/g) || []).length === 1 && dye.defs.includes('#123456'));
ok('扎染折痕可关', !dye.body.includes('<circle'));

console.log('\n[4] id 前缀隔离 —— 同页多个纹理不撞车(无限复用的前提)');
const t1 = texture('rubbing').build(100, 100, 'x1');
const t2 = texture('tiedye').build(100, 100, 'x2');
ok('两纹理 id 不重叠', !/id="x2/.test(t1.defs) && !/id="x1/.test(t2.defs));
const ids1 = [...t1.defs.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const ids2 = [...t2.defs.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
ok('id 集合无交集', ids1.every((i) => !ids2.includes(i)), `${ids1} vs ${ids2}`);

console.log('\n[5] resolveTexture: 默认拓质吃变体参数, 显式预设优先');
const c = RECORD_VARIANTS['editorial-rubbing'];
const def = resolveTexture(undefined, c);
ok('默认= rubbing', def.name === 'rubbing');
ok('吃变体 texFreq', def.params.mottleFreq === c.texFreq);
ok('吃变体 texOp', def.params.mottleOp === c.texOp);
ok('scale 缩放频率(小卡片)', resolveTexture(undefined, c, { freqMul: 2.2 }).params.mottleFreq === c.texFreq * 2.2);
ok('字符串选预设', resolveTexture('handdrawn', c).name === 'handdrawn');
ok('对象选预设 + 覆参', (() => { const t = resolveTexture({ name: 'topographic', lineOp: 0.9 }, c); return t.name === 'topographic' && t.params.lineOp === 0.9; })());
ok('name 不会漏进参数', resolveTexture({ name: 'tiedye' }, c).params.name === undefined);

console.log('\n[5b] 尺寸自适应: 元件越小, 非拓质预设也同步提频(否则花纹相对变巨)');
ok('拓扑频率随 freqMul 提高', resolveTexture('topographic', c, { freqMul: 4 }).params.freq === TEXTURE_DEFAULTS.topographic.freq * 4,
  resolveTexture('topographic', c, { freqMul: 4 }).params.freq);
ok('手绘两轴频率(字符串)也能缩放', resolveTexture('handdrawn', c, { freqMul: 2 }).params.grainFreq === '1.8 1.8',
  resolveTexture('handdrawn', c, { freqMul: 2 }).params.grainFreq);
ok('扎染揉皱频率随之', Math.abs(resolveTexture('tiedye', c, { freqMul: 3 }).params.warpFreq - TEXTURE_DEFAULTS.tiedye.warpFreq * 3) < 1e-6,
  resolveTexture('tiedye', c, { freqMul: 3 }).params.warpFreq);
ok('调用方显式给频率则以调用方为准', resolveTexture({ name: 'topographic', freq: 0.5 }, c, { freqMul: 4 }).params.freq === 0.5);
ok('freqMul=1 时原样', resolveTexture('topographic', c).params.freq === TEXTURE_DEFAULTS.topographic.freq);
ok('缩放不污染默认值', TEXTURE_DEFAULTS.topographic.freq === 0.012 && TEXTURE_DEFAULTS.handdrawn.grainFreq === '0.9 0.9');

console.log('\n[6] 三条渲染路径都吃到纹理');
const acts = sampleActivities(2026);
const rec = createRecord(acts, { year: 2026 });
for (const p of TEXTURE_PRESETS) {
  const y = rec.yearSVG({ texture: p.name });
  const m = rec.monthSVG(2, { texture: p.name });
  const px = buildTextureSVG({ mediaWmm: 847, mediaHmm: 600, variant: 'editorial-rubbing', pxW: 400, pxH: 283, texture: p.name });
  ok(`整年图带 ${p.name}`, y.includes('<svg') && y.length > 5000 && !/NaN|undefined/.test(y));
  ok(`单月图带 ${p.name}`, m.includes('<svg') && m.length > 2000 && !/NaN|undefined/.test(m));
  ok(`栅格化 SVG 带 ${p.name}`, px.includes('<svg') && !/NaN|undefined/.test(px));
}
ok('createRecord 可整体锁定质感', (() => {
  const r2 = createRecord(acts, { year: 2026, texture: 'tiedye' });
  return r2.yearSVG().includes('radialGradient') && r2.monthSVG(0).includes('radialGradient');
})());

console.log('\n[7] 默认路径不回归(拓质仍在, 且飞白修成可见白)');
const yDef = renderRecord(createRecord(acts).model, { variant: 'editorial-rubbing' });
ok('整年默认仍有斑驳滤镜', yDef.includes('feTurbulence') && yDef.includes('mix-blend-mode:multiply'));
ok('飞白改为白色(此前黑色叠 screen 恒不可见)', /values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1\.5/.test(yDef));
ok('墨层破边滤镜仍在(A 全拓)', renderRecord(createRecord(acts, { variant: 'tuogu-ink' }).model, { variant: 'tuogu-ink' }).includes('url(#rub)'));
const mDef = renderMonth(createRecord(acts).model, 7, {});
ok('单月默认仍有质感', mDef.includes('feTurbulence'));
ok('单月频率仍按小卡片放大', mDef.includes(`baseFrequency="${RECORD_VARIANTS['editorial-rubbing'].texFreq * 2.2}"`));

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
