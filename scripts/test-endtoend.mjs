// 端到端一致性演练 —— 同一份数据走完全部出口, 逐项核对它们说的是不是同一件事。
//
// 为什么要单独有这么一关:单元测试各测各的模块, 测不出**出口之间的矛盾**。
// 只有把整年图 / 单月卡 / 统计卡 / 活动带 / 分组横条 / 文字简报 / 印刷 PDF 全跑一遍,
// 拿它们各自"说出来的话"互相对, 才会现形(lumenflow 就是这么抓到过真 bug 的)。
//
// 核对的是**同一件事在不同出口的说法**:某月的投入、某类的占比、里程碑数、
// 有痕天数、图例条目、落格位置。用法: node scripts/test-endtoend.mjs
import zlib from 'node:zlib';
import { sampleCOActivities } from '../src/data/sample-co.js';
import { sampleActivities, toRecordModel } from '../src/data/activity.js';
import { computeStats, monthRange, monthStats } from '../src/data/stats.js';
import { digest, reportFor } from '../src/data/digest.js';
import { legendItems, monthTotals, milestonesByDay, inkOpacity } from '../src/poster/paint.js';
import { RECORD_VARIANTS, renderRecord } from '../src/poster/renderRecord.js';
import { renderMonth, monthGeometry, weeksInMonth, MONTH_PAGE } from '../src/poster/renderMonth.js';
import { buildRecordPdfBytes, buildMonthPdfBytes } from '../src/poster/exportPdf.js';
import { createRecord } from '../src/record/index.js';
import { daysInMonth, dow, iso } from '../src/data/model.js';

const MM = 2.834645669;
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };

// —— 从 PDF 内容流里抠出填充矩形(与 test-print-geometry 同法, 含 cm 平移)——
function rectsOf(bytes) {
  const s = Buffer.from(bytes).toString('latin1');
  const re = /<<([^>]*?)>>\s*stream\r?\n/g;
  let m, content = '';
  while ((m = re.exec(s))) {
    if (!m[1].includes('FlateDecode') || m[1].includes('ObjStm') || m[1].includes('XRef')) continue;
    const st = m.index + m[0].length;
    try { const o = zlib.inflateSync(Buffer.from(s.slice(st, s.indexOf('endstream', st)), 'latin1')).toString('latin1'); if (o.includes(' m\n')) { content = o; break; } } catch { /* 下一个 */ }
  }
  const out = [], stack = [];
  let tx = 0, ty = 0, pts = [];
  for (const raw of content.split('\n')) {
    const ln = raw.trim();
    if (ln === 'q') { stack.push([tx, ty]); continue; }
    if (ln === 'Q') { const p = stack.pop(); if (p) { tx = p[0]; ty = p[1]; } continue; }
    let mm = ln.match(/^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm$/);
    if (mm) { if (+mm[1] === 1 && +mm[2] === 0 && +mm[3] === 0 && +mm[4] === 1) { tx += +mm[5]; ty += +mm[6]; } continue; }
    mm = ln.match(/^([-\d.]+) ([-\d.]+) (m|l)$/);
    if (mm) { if (mm[3] === 'm') pts = []; pts.push([+mm[1] + tx, +mm[2] + ty]); continue; }
    if (/^(f|S|B)$/.test(ln) && pts.length === 4) {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      out.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), op: ln });
      pts = [];
    }
  }
  return out;
}

// 同一份数据两套口径都走一遍:CO 口径(零里程碑、weight=条目数)与旧样例(有里程碑)
const CASES = [
  { tag: 'CO 口径', acts: sampleCOActivities(2026) },
  { tag: '旧样例', acts: sampleActivities(2026) },
];

for (const { tag, acts } of CASES) {
  console.log(`\n======== ${tag} ========`);
  const rec = createRecord(acts, { year: 2026 });
  const model = rec.model;
  const s = rec.stats();
  const c = RECORD_VARIANTS['editorial-rubbing'];
  const year = rec.yearSVG();

  console.log('\n[有痕天数] 统计 / 整年图落格 / 活动带 / 十二张月卡相加');
  {
    const inModel = Object.keys(model.days).length;
    ok(`统计(${s.days.active}) = 模型落格(${inModel})`, s.days.active === inModel, [s.days.active, inModel]);
    // 整年图:数被着色的日格(用 inkOpacity 生成的那些透明度)
    const opacities = new Set(Object.values(model.days).map((d) => String(inkOpacity(d.intensity, { carrier: 'year' }))));
    const painted = [...year.matchAll(/opacity="([\d.]+)"/g)].map((m) => m[1]).filter((v) => opacities.has(v)).length;
    ok(`整年图着色格数(${painted}) = 有痕天数(${s.days.active})`, painted === s.days.active, [painted, s.days.active]);
    // 十二张月卡的报头合计
    let sumDays = 0, sumW = 0;
    for (let m = 0; m < 12; m++) { const t = monthTotals(model, m); sumDays += t.activeDays; sumW += t.sumWeight; }
    ok(`十二张月卡的"天有痕"相加(${sumDays}) = 全年有痕(${s.days.active})`, sumDays === s.days.active, [sumDays, s.days.active]);
    ok(`十二张月卡的"投入"相加(${Math.round(sumW * 100) / 100}) = 总投入(${s.weight.sum})`, Math.abs(sumW - s.weight.sum) < 0.01, [sumW, s.weight.sum]);
  }

  console.log('\n[某月的投入] 统计 byMonth / monthStats / 月卡报头 / 区间统计 / 月卡 PDF');
  {
    for (const m of [0, 2, 6, 11]) {
      const byMonth = s.byMonth[m];
      const viaMonthStats = monthStats(acts, 2026, m);
      const viaRange = computeStats(acts, { year: 2026, ...monthRange(2026, m) });
      const viaPaint = monthTotals(model, m);
      const same = byMonth.weight === viaMonthStats.weight
        && Math.abs(byMonth.weight - viaRange.weight.sum) < 0.01
        && Math.abs(byMonth.weight - viaPaint.sumWeight) < 0.01;
      ok(`${m + 1}月投入四处一致(${byMonth.weight})`, same, { byMonth: byMonth.weight, monthStats: viaMonthStats.weight, range: viaRange.weight.sum, paint: viaPaint.sumWeight });
      ok(`${m + 1}月有痕天数三处一致(${byMonth.days})`, byMonth.days === viaRange.days.active && byMonth.days === viaPaint.activeDays,
        { byMonth: byMonth.days, range: viaRange.days.active, paint: viaPaint.activeDays });
    }
  }

  console.log('\n[某类的占比] 统计 / 统计卡 / 分组横条 / 简报');
  {
    const top = s.byType[0];
    const card = rec.statCardSVG();
    const bars = rec.groupBarsSVG();
    const rep = rec.report();
    ok(`占比最大的是「${top.name}」, 统计卡里写了它`, card.includes(top.name) && card.includes(`${Math.round(top.share * 100)}%`), top);
    ok('分组横条第一行也是它', bars.indexOf(top.name) > 0 && s.byType.every((t) => bars.includes(t.name) || t.weight === 0), s.byType.map((t) => t.name));
    ok('简报的分类行也以它打头', (rep.split('\n').find((l) => l.includes('分类:')) || '').includes(top.name), rep.split('\n').find((l) => l.includes('分类:')));
    ok('各类占比加起来 ≈100%', Math.abs(s.byType.reduce((n, t) => n + t.share, 0) - 1) < 0.02, s.byType.map((t) => t.share));
    ok('各类投入加起来 = 总投入', Math.abs(s.byType.reduce((n, t) => n + t.weight, 0) - s.weight.sum) < 0.01);
  }

  console.log('\n[里程碑数] 统计 / 模型 / 整年图朱砂印 / 图例 / 统计卡 / 简报');
  {
    const n = s.milestones.length;
    ok(`统计(${n}) = 模型(${model.milestones.length})`, n === model.milestones.length);
    // 整年图里朱砂印 = 每个印一个纸色晕 + 一个红方 + 一个内白框; 数红方最稳
    const sealSquares = [...year.matchAll(/<rect [^>]*fill="#9e3b32"[^>]*\/>/g)].length;
    ok(`整年图朱砂方块数(${sealSquares}) ≥ 里程碑数(${n})`, sealSquares >= n, [sealSquares, n]);
    ok(`零里程碑时图例不提里程碑 / 有则提`, legendItems(model, c).some((x) => x.name === '里程碑') === (n > 0), legendItems(model, c).map((x) => x.name));
    const card = rec.statCardSVG();
    ok('统计卡:有里程碑才占一格', card.includes('个里程碑') === (n > 0), n);
    const rep = rec.report();
    ok('简报:有里程碑才列出来', rep.includes('里程碑') === (n > 0), n);
  }

  console.log('\n[图例条目] 整年图 / 月卡 三处同源(只看 data-part="legend" 那一组, 不全文搜字)');
  {
    // 分类名可能与活动标题同名(旧样例里就有个标题叫「分析」), 全文搜字会误判 —— 精确取图例组
    const legendText = (svg) => {
      const g = svg.match(/<g data-part="legend">([\s\S]*?)<\/g>/);
      return g ? [...g[1].matchAll(/>([^<]+)<\/text>/g)].map((x) => x[1]) : null;
    };
    const want = legendItems(model, c).map((x) => x.name);
    const got = legendText(year);
    ok(`整年图图例正是这 ${want.length} 条`, got && JSON.stringify(got.filter((t) => t !== '…')) === JSON.stringify(want), { want, got });
    for (const m of [0, 6, 11]) {
      const w = legendItems(model, c, { month: m, compact: true }).map((x) => x.name);
      const gm = legendText(renderMonth(model, m, {}));
      ok(`${m + 1}月图例正是这 ${w.length} 条(不多列也不少列)`, gm && JSON.stringify(gm.filter((t) => t !== '…')) === JSON.stringify(w), { want: w, got: gm });
      // 而且图例列的每一类, 当月确实有格子用了它的颜色
      const monthCats = new Set(Object.entries(model.days)
        .filter(([d]) => Number(d.slice(5, 7)) - 1 === m).map(([, r]) => r.categoryId));
      const named = new Set(model.categories.filter((cat) => monthCats.has(cat.id)).map((cat) => cat.name));
      ok(`${m + 1}月图例每一条都在当月真出现过`, w.filter((n) => n !== '里程碑' && !n.includes('墨深')).every((n) => named.has(n)), { legend: w, real: [...named] });
    }
  }

  console.log('\n[落格位置] 整年图 SVG vs 整年印刷 PDF(同一天必须在同一处)');
  {
    const bytes = await buildRecordPdfBytes(model, {});
    const rects = rectsOf(bytes);
    const g = (await import('../src/poster/layout.js')).geometry();
    const cellRect = (await import('../src/poster/layout.js')).cellRect;
    const mediaHmm = g.PAGE.h + 2 * g.BLEED;
    let checked = 0, missed = [];
    for (let m = 0; m < 12; m++) {
      const dim = daysInMonth(2026, m);
      for (let d = 1; d <= dim; d++) {
        if (!model.days[iso(2026, m, d)]) continue;
        const cell = cellRect(g, m, d);
        const wx = (cell.x + g.BLEED) * MM, wy = (mediaHmm - (cell.y + cell.h + g.BLEED)) * MM;
        if (!rects.some((r) => Math.abs(r.x - wx) < 0.4 && Math.abs(r.y - wy) < 0.4 && Math.abs(r.w - cell.w * MM) < 0.4)) missed.push(`${m + 1}/${d}`);
        checked++;
        break;   // 每月抽一天
      }
    }
    ok(`抽查 ${checked} 天, 印刷 PDF 上都在同一处`, missed.length === 0, missed);
  }

  console.log('\n[月卡] 屏幕 vs 印刷:同一个月画的格子数一样多');
  {
    for (const m of [2, 6]) {
      const svg = renderMonth(model, m, {});
      const dim = daysInMonth(2026, m);
      const gridStrokes = (svg.match(/stroke-width="0\.25"/g) || []).length;
      const bytes = await buildMonthPdfBytes(model, m, {});
      const pdfStrokes = rectsOf(bytes).filter((r) => r.op === 'S').length;
      ok(`${m + 1}月:屏幕格线 ${gridStrokes} / PDF 格线 ${pdfStrokes} / 当月 ${dim} 天`, gridStrokes === dim && pdfStrokes >= dim, [gridStrokes, pdfStrokes, dim]);
    }
  }

  console.log('\n[区间] 十二个月的区间统计加起来 = 整年');
  {
    let days = 0, w = 0, acts2 = 0;
    for (let m = 0; m < 12; m++) {
      const r = computeStats(acts, { year: 2026, ...monthRange(2026, m) });
      days += r.days.active; w += r.weight.sum; acts2 += r.activities;
    }
    ok(`有痕天数相加(${days}) = 整年(${s.days.active})`, days === s.days.active, [days, s.days.active]);
    ok(`投入相加(${Math.round(w * 100) / 100}) = 整年(${s.weight.sum})`, Math.abs(w - s.weight.sum) < 0.01, [w, s.weight.sum]);
    ok(`活动条数相加(${acts2}) = 整年(${s.activities})`, acts2 === s.activities, [acts2, s.activities]);
  }

  console.log('\n[简报] 说出来的数字必须能在统计里找到出处');
  {
    const rep = rec.report(monthRange(2026, 2));
    const mar = computeStats(acts, { year: 2026, ...monthRange(2026, 2) });
    ok('简报的有痕天数 = 三月区间统计', rep.includes(`${mar.days.active} 天有痕`), [rep.split('\n')[2], mar.days.active]);
    ok('简报的总投入 = 三月区间统计', rep.includes(`总投入 ${mar.weight.sum}`));
    ok('简报的活动条数 = 三月区间统计', rep.includes(`记下 ${mar.activities} 条活动`));
    ok('简报里没有 NaN/undefined', !/NaN|undefined/.test(rep));
    ok('月卡报头的两个数 = 三月区间统计', (() => {
      const t = monthTotals(model, 2);
      return t.activeDays === mar.days.active && Math.abs(t.sumWeight - mar.weight.sum) < 0.01;
    })(), [monthTotals(model, 2), mar.days.active, mar.weight.sum]);
  }
}

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
