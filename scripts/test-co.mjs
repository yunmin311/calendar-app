// CO 口径验收 —— 按 CO 2026-08-21 给的映射跑一遍, 确认版面与分档都成立。
//   weight = 当天条目数(小整数) · type = 收灵感/分析/整理 · milestone 一律 false · 单年
// 用法: node scripts/test-co.mjs
import { sampleCOActivities, CO_TYPES } from '../src/data/sample-co.js';
import { toRecordModel, PALETTES, ACTIVITY_TYPES } from '../src/data/activity.js';
import { computeStats, monthRange } from '../src/data/stats.js';
import { digest, reportFor } from '../src/data/digest.js';
import { legendItems } from '../src/poster/paint.js';
import { RECORD_VARIANTS, renderRecord } from '../src/poster/renderRecord.js';
import { renderMonth } from '../src/poster/renderMonth.js';
import { createRecord } from '../src/record/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };

const acts = sampleCOActivities(2026);
const rec = createRecord(acts, { year: 2026 });
const s = rec.stats();

console.log('\n[1] 全年零里程碑:朱砂印在 CO 场景永远不出现, 整页仍要成立');
{
  ok('样例数据确实一个里程碑都没有', acts.every((a) => a.milestone === false) && s.milestones.length === 0, s.milestones.length);
  ok('模型里里程碑通道为空', rec.model.milestones.length === 0);
  const y = rec.yearSVG(), m = rec.monthSVG(2);
  ok('整年图画得出来且无 NaN', y.includes('</svg>') && !/NaN|undefined/.test(y));
  ok('单月卡画得出来且无 NaN', m.includes('</svg>') && !/NaN|undefined/.test(m));
  const c = RECORD_VARIANTS['editorial-rubbing'];
  ok('图例里没有「里程碑」这一条(不列图上没有的东西)', !legendItems(rec.model, c).some((x) => x.name === '里程碑'), legendItems(rec.model, c).map((x) => x.name));
  ok('图例列的是 CO 三类', legendItems(rec.model, c).every((x) => CO_TYPES.includes(x.name)), legendItems(rec.model, c).map((x) => x.name));
  ok('统计卡不再杵一个恒为 0 的「个里程碑」', !rec.statCardSVG().includes('个里程碑'), '默认指标应换成条活动');
  ok('统计卡改显示「条活动」', rec.statCardSVG().includes('条活动'));
  ok('调用方显式要里程碑那格仍然给', rec.statCardSVG({ metrics: ['milestones'] }).includes('个里程碑'));
  const rep = rec.report(monthRange(2026, 2));
  ok('简报不再每期念「这段没有里程碑」', !rep.includes('没有里程碑'), rep);
  ok('简报仍说得出正事', rep.includes('天有痕') && rep.includes('总投入'));
  ok('有里程碑的数据仍然照常列', digest(computeStats([{ id: 'x', date: '2026-03-03', type: '整理', title: 't', weight: 1, milestone: true }], { year: 2026 })).includes('里程碑 1 个'));
}

console.log('\n[2] weight = 条目数:墨深不许全塌在最浅那档');
{
  const dist = (a) => { const lv = [0, 0, 0, 0, 0]; for (const d of Object.values(toRecordModel(a, 2026).days)) lv[d.level]++; return lv.slice(1); };
  const base = dist(acts);
  ok('四档都用得上', base.every((n) => n > 0), base);
  ok('没有哪一档吃掉八成以上的天', Math.max(...base) / base.reduce((x, y) => x + y, 0) < 0.6, base);
  // CO 数据里出现一个大高峰(某天猛收一批灵感)时, 其余天的分档不该被压平
  for (const peak of [4, 9, 20, 60]) {
    const d = dist(sampleCOActivities(2026, { peak }));
    ok(`高峰日 ${peak} 条时四档仍都用得上`, d.every((n) => n > 0), d);
  }
  ok('高峰大小不改变其余天的分档', JSON.stringify(dist(sampleCOActivities(2026, { peak: 20 }))) === JSON.stringify(dist(sampleCOActivities(2026, { peak: 60 }))));
  ok('全年只有 1、2 两种条目数时也分得开', (() => {
    const two = [1, 2, 1, 2].map((w, i) => ({ id: '' + i, date: `2026-05-0${i + 1}`, type: '收灵感', title: 't', weight: w }));
    return new Set(Object.values(toRecordModel(two, 2026).days).map((d) => d.level)).size === 2;
  })());
}

console.log('\n[3] CO 三类:定色而不是抽签');
{
  const cats = rec.model.categories.filter((c) => CO_TYPES.includes(c.id));
  ok('三类都在分类表里', cats.length === 3, cats.map((c) => c.id));
  ok('走的是定色, 不是哈希派生(extra 标记不应存在)', cats.every((c) => !c.extra), cats);
  ok('收灵感=花青', PALETTES['editorial-rubbing']['收灵感'] === '#6f8ea0');
  ok('分析=赭石', PALETTES['editorial-rubbing']['分析'] === '#b5794f');
  ok('整理=石绿', PALETTES['editorial-rubbing']['整理'] === '#86a07e');
  ok('三色互不相同', new Set(cats.map((c) => c.color)).size === 3);
  ok('没有紫色那种跳出暖色系的', !cats.some((c) => /^#6f5b8e$/i.test(c.color)), cats.map((c) => c.color));
  ok('已登记进 ACTIVITY_TYPES(所以才拿得到定色)', CO_TYPES.every((t) => ACTIVITY_TYPES.some((x) => x.id === t)));
  ok('全拓变体下三类都是墨色', CO_TYPES.every((t) => PALETTES['tuogu-ink'][t] === '#211b14'));
  const y = rec.yearSVG();
  ok('整年图真用上了这三色', ['#6f8ea0', '#b5794f', '#86a07e'].every((c) => y.includes(c)));
}

console.log('\n[4] CO 数据下其余出口照常');
{
  ok('活动带', rec.stripSVG().includes('</svg>'));
  ok('统计卡', rec.statCardSVG().includes('</svg>'));
  ok('分组横条(按类型)', rec.groupBarsSVG().includes('</svg>'));
  ok('十二个月都画得出', Array.from({ length: 12 }, (_, m) => renderMonth(rec.model, m, {})).every((x) => x.includes('</svg>') && !/NaN/.test(x)));
  ok('全拓变体', createRecord(acts, { year: 2026, variant: 'tuogu-ink' }).yearSVG().includes('</svg>'));
  ok('简报(整年)', reportFor(acts, { year: 2026 }).includes('2026 年'));
  ok('留白读得出(七月中旬空一截)', (() => {
    const jul = Object.keys(rec.model.days).filter((d) => d.startsWith('2026-07'));
    return !jul.some((d) => { const dd = Number(d.slice(8)); return dd >= 10 && dd <= 21; });
  })());
}

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
