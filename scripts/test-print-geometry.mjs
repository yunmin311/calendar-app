// 印刷坐标 vs 屏幕几何 —— 逐格比对, 给「预览=成品」这句话上一道硬保险。
//
// 做法: 解开 PDF 的内容流, 把里面画的矩形抠出来(pdf-lib 把矩形写成 m/l/l/l/h/f 路径),
// 再拿屏幕渲染用的那套几何(layout.js 的 cellRect / renderMonth 的 monthGeometry)
// 算出每个日格该在的位置, 一格一格对。坐标对不上就说明印出来的和屏幕上看的不是一回事。
// 用法: node scripts/test-print-geometry.mjs
import zlib from 'node:zlib';
import { sampleActivities, toRecordModel } from '../src/data/activity.js';
import { buildRecordPdfBytes, buildMonthPdfBytes } from '../src/poster/exportPdf.js';
import { geometry, cellRect } from '../src/poster/layout.js';
import { MONTH_PAGE, monthGeometry, weeksInMonth } from '../src/poster/renderMonth.js';
import { daysInMonth, dow, iso } from '../src/data/model.js';

const MM = 2.834645669;
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };

// —— 从 PDF 里抠出所有填充矩形(单位 pt)——
function rectsOf(bytes) {
  const s = Buffer.from(bytes).toString('latin1');
  const re = /<<([^>]*?)>>\s*stream\r?\n/g;
  let m, content = '';
  while ((m = re.exec(s))) {
    const dict = m[1];
    if (!dict.includes('FlateDecode') || dict.includes('ObjStm') || dict.includes('XRef')) continue;
    const start = m.index + m[0].length;
    const raw = Buffer.from(s.slice(start, s.indexOf('endstream', start)), 'latin1');
    let out; try { out = zlib.inflateSync(raw).toString('latin1'); } catch { continue; }
    if (out.includes(' m\n') && out.includes(' l\n')) { content = out; break; } // 页面内容流
  }
  // pdf-lib 把矩形画在原点、再用 cm 平移矩阵挪到位, 所以必须跟着 q/Q/cm 维护当前变换,
  // 否则抠出来的矩形会全挤在原点(第一版就栽在这)。
  const out = [], segs = [];
  const stack = [];
  let tx = 0, ty = 0, pts = [];
  for (const raw of content.split('\n')) {
    const ln = raw.trim();
    if (ln === 'q') { stack.push([tx, ty]); continue; }
    if (ln === 'Q') { const s = stack.pop(); if (s) { tx = s[0]; ty = s[1]; } continue; }
    let mm2 = ln.match(/^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm$/);
    if (mm2) { // 只处理纯平移(本项目不用旋转/缩放)
      if (+mm2[1] === 1 && +mm2[2] === 0 && +mm2[3] === 0 && +mm2[4] === 1) { tx += +mm2[5]; ty += +mm2[6]; }
      continue;
    }
    mm2 = ln.match(/^([-\d.]+) ([-\d.]+) (m|l)$/);
    if (mm2) { if (mm2[3] === 'm') pts = []; pts.push([+mm2[1] + tx, +mm2[2] + ty]); continue; }
    if (/^(f|S|B)$/.test(ln) && pts.length >= 2) {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), op: ln };
      if (pts.length === 4) out.push(box); else if (pts.length === 2) segs.push({ ...box, a: pts[0], b: pts[1] });
      pts = [];
    }
  }
  return { rects: out, segs, hasContent: content.length > 0 };
}

// 期望的矩形(mm, 屏幕坐标系: y 向下) → PDF 坐标(pt, y 向上, 含出血偏移)
const toPt = (xmm, ymm, wmm, hmm, mediaHmm, bleed) => ({
  x: (xmm + bleed) * MM, y: (mediaHmm - (ymm + hmm + bleed)) * MM, w: wmm * MM, h: hmm * MM,
});
const near = (a, b, tol = 0.4) => Math.abs(a - b) <= tol;
const findRect = (rects, want, tol = 0.4) => rects.find((r) => near(r.x, want.x, tol) && near(r.y, want.y, tol) && near(r.w, want.w, tol) && near(r.h, want.h, tol));

const acts = sampleActivities(2026);

console.log('\n[1] 整年长条: 日格坐标 = layout.cellRect 算出来的位置');
{
  const model = toRecordModel(acts, 2026, 'editorial-rubbing');
  const bytes = await buildRecordPdfBytes(model, {});
  const { rects, hasContent } = rectsOf(bytes);
  ok('内容流解得开', hasContent && rects.length > 100, rects.length);

  const g = geometry();
  const mediaHmm = g.PAGE.h + 2 * g.BLEED;
  // 挑 12 个有活动的日子(每月一个)逐格核对
  let checked = 0, missed = [];
  for (let m = 0; m < 12; m++) {
    const dim = daysInMonth(2026, m);
    for (let d = 1; d <= dim; d++) {
      const rec = model.days[iso(2026, m, d)];
      if (!rec || rec.categoryId === 'publish') continue;
      const cell = cellRect(g, m, d);
      const want = toPt(cell.x, cell.y, cell.w, cell.h, mediaHmm, g.BLEED);
      if (!findRect(rects, want)) missed.push(`${m + 1}/${d}`);
      checked++;
      break; // 每月一个够了
    }
  }
  ok(`抽查 ${checked} 个日格坐标全对得上`, missed.length === 0, missed);

  // 出血: 纸底必须铺满含出血的整页(847×600mm), 不能只铺到成品边
  const full = rects.find((r) => near(r.w, (g.PAGE.w + 2 * g.BLEED) * MM, 1) && near(r.h, mediaHmm * MM, 1));
  ok('纸底铺满含出血整页(不会印出白边)', !!full, full && [Math.round(full.w / MM), Math.round(full.h / MM)]);
}

console.log('\n[2] 单月卡: 日格坐标 = monthGeometry 算出来的位置(与屏幕同一函数)');
for (const [m, label] of [[0, '一月'], [7, '八月(有留白断口)'], [1, '二月']]) {
  const model = toRecordModel(acts, 2026, 'editorial-rubbing');
  const bytes = await buildMonthPdfBytes(model, m, {});
  const { rects } = rectsOf(bytes);
  const g = monthGeometry(weeksInMonth(2026, m));
  const mediaHmm = MONTH_PAGE.h + 2 * MONTH_PAGE.BLEED;
  const dim = daysInMonth(2026, m), firstDow = dow(2026, m, 1);

  let want = 0, missed = [];
  for (let d = 1; d <= dim; d++) {
    const rec = model.days[iso(2026, m, d)];
    if (!rec || rec.categoryId === 'publish') continue;
    const idx = firstDow + d - 1;
    const x = g.gridLeft + (idx % 7) * g.colW, y = g.gridTop + Math.floor(idx / 7) * g.rowH;
    const w = toPt(x + 0.6, y + 0.6, g.colW - 1.2, g.rowH - 1.2, mediaHmm, MONTH_PAGE.BLEED);
    if (!findRect(rects, w)) missed.push(d);
    want++;
  }
  ok(`${label}: ${want} 个墨底格坐标全对得上`, want > 0 && missed.length === 0, missed);

  // 格线(描边矩形)应有 dim 个, 每天一个
  const gridStrokes = rects.filter((r) => r.op === 'S' && near(r.w, g.colW * MM, 0.6) && near(r.h, g.rowH * MM, 0.6));
  ok(`${label}: 格线 ${gridStrokes.length} 个 = 当月 ${dim} 天`, gridStrokes.length === dim, [gridStrokes.length, dim]);
}

console.log('\n[3] 单月卡: 里程碑朱砂印落在正确的日子上(示例数据的里程碑在 2/5/8/11 月)');
{
  const model = toRecordModel(acts, 2026, 'editorial-rubbing');
  let checked = 0, missed = [];
  for (const mi of [1, 4, 7, 10]) {
    const bytes = await buildMonthPdfBytes(model, mi, {});
    const { rects } = rectsOf(bytes);
    const g = monthGeometry(weeksInMonth(2026, mi));
    const mediaHmm = MONTH_PAGE.h + 2 * MONTH_PAGE.BLEED;
    const tag = `2026-${String(mi + 1).padStart(2, '0')}`;
    for (const x of model.milestones.filter((v) => v.date.startsWith(tag))) {
      const d = Number(x.date.slice(8, 10));
      const idx = dow(2026, mi, 1) + d - 1;
      const cx = g.gridLeft + (idx % 7) * g.colW, cy = g.gridTop + Math.floor(idx / 7) * g.rowH;
      const want = toPt(cx + g.colW - 6, cy + 2, 3.8, 3.8, mediaHmm, MONTH_PAGE.BLEED);
      if (!findRect(rects, want, 0.5)) missed.push(x.date);
      checked++;
    }
  }
  ok('四个里程碑都被找到', checked === 4, checked);
  ok('朱砂印位置逐个对得上', missed.length === 0, missed);
}

console.log('\n[4] 单月卡出血与裁切标(裁切标真的解出线段来数, 不是嘴上说有)');
{
  const bytes = await buildMonthPdfBytes(toRecordModel(acts, 2026), 2, {});
  const { rects, segs } = rectsOf(bytes);
  const B = MONTH_PAGE.BLEED;
  const mediaWmm = MONTH_PAGE.w + 2 * B, mediaHmm = MONTH_PAGE.h + 2 * B;
  const full = rects.find((r) => near(r.w, mediaWmm * MM, 1) && near(r.h, mediaHmm * MM, 1));
  ok('纸底铺满 216×286mm 含出血', !!full);

  // 裁切标: 四角各两条, 共 8 条 2mm 短线, 画在出血区(成品框外 1mm 起)
  const L = B * MM, R = (B + MONTH_PAGE.w) * MM, Bo = B * MM, T = (B + MONTH_PAGE.h) * MM;
  const gap = 1 * MM, len = 2 * MM;
  const wantSegs = [
    [[L - gap - len, Bo], [L - gap, Bo]], [[L, Bo - gap - len], [L, Bo - gap]],
    [[R + gap, Bo], [R + gap + len, Bo]], [[R, Bo - gap - len], [R, Bo - gap]],
    [[L - gap - len, T], [L - gap, T]],   [[L, T + gap], [L, T + gap + len]],
    [[R + gap, T], [R + gap + len, T]],   [[R, T + gap], [R, T + gap + len]],
  ];
  const found = wantSegs.filter(([a, b]) => segs.some((s) =>
    (near(s.a[0], a[0], 0.5) && near(s.a[1], a[1], 0.5) && near(s.b[0], b[0], 0.5) && near(s.b[1], b[1], 0.5)) ||
    (near(s.a[0], b[0], 0.5) && near(s.a[1], b[1], 0.5) && near(s.b[0], a[0], 0.5) && near(s.b[1], a[1], 0.5))));
  ok('四角 8 条裁切标位置全对', found.length === 8, [found.length, segs.length]);
  ok('裁切标画在出血区外侧(不会印进成品)', segs.filter((s) => s.a[0] < L - 0.1 || s.a[0] > R + 0.1 || s.a[1] < Bo - 0.1 || s.a[1] > T + 0.1).length >= 8);
  ok('成品框四边各留 3mm 出血', B === 3 && mediaWmm - MONTH_PAGE.w === 6 && mediaHmm - MONTH_PAGE.h === 6);
}

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
