// 印刷级 PDF 导出 —— 产品主角。
// 精确 A1(841×594mm)+ 3mm 出血 + 四角裁切标 + CMYK 色值 + 全矢量。
// 与 renderRecord 共用 layout.js 几何, 所以「预览=成品」。
//
// 字体策略(见 docs/字体授权与印刷规格.md):
//   · 拉丁字 —— 传入 EB Garamond(OFL) 则子集嵌入; 否则回退 PDF 内置 Helvetica。
//   · 中文字 —— 传入 霞鹜文楷(OFL) 则子集嵌入并渲染月份名/标签/备注; 否则该批 CJK 文本留空缺口。
//   subset 由 @pdf-lib/fontkit 完成(只嵌用到的字形), 不需要外部 pyftsubset。
import { geometry, cellRect, dayCenterX } from './layout.js';
import { MONTHS_ZH, MONTHS_NUM, daysInMonth, dow, isWeekend, iso } from '../data/model.js';
import { RECORD_VARIANTS } from './renderRecord.js';
import { MONTH_PAGE, monthGeometry, weeksInMonth, clampMonth, monthNumX } from './renderMonth.js';
import { toRecordModel } from '../data/activity.js';
import { resolveTexture } from '../texture/index.js';
import { inkOpacity, legendItems, monthTotals, milestonesByDay, clipText } from './paint.js';

const MM = 2.834645669; // 1mm = 2.834645669pt

// hex → CMYK。整年长条与单月卡共用一份(此前两处各写一遍, 正是"同一条规则两份实现"那类根因)
const makeHexToCmyk = (cmyk) => (hex) => {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return cmyk(0, 0, 0, 1);
  return cmyk((1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k);
};

// 四角裁切标(画在出血区): 整年长条与单月卡共用
function drawCropMarks(page, g, color) {
  const L = g.BLEED * MM, R = (g.BLEED + g.PAGE.w) * MM, B = g.BLEED * MM, T = (g.BLEED + g.PAGE.h) * MM;
  const gap = 1 * MM, len = 2 * MM, w = 0.3 * MM;
  const seg = (x1, y1, x2, y2) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w, color });
  seg(L - gap - len, B, L - gap, B); seg(L, B - gap - len, L, B - gap);           // 左下
  seg(R + gap, B, R + gap + len, B); seg(R, B - gap - len, R, B - gap);           // 右下
  seg(L - gap - len, T, L - gap, T); seg(L, T + gap, L, T + gap + len);           // 左上
  seg(R + gap, T, R + gap + len, T); seg(R, T + gap, R, T + gap + len);           // 右上
}

// ---- 浏览器: 取字体 → 生成 → 下载 ----
async function fetchFont(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); }
  catch { return null; }
}

// ============================================================================
// 活动留痕 · B 对齐的印刷 PDF —— 里程碑=朱砂印、活动分类色贯通、拓质栅格化嵌入。
// A1 几何 / 出血 / 裁切标 / CMYK / 子集嵌字 一套规格, 单月卡也走同一套(见文件末尾)。
// ============================================================================

// 拓质图层的印刷落地(正面解决那个真风险):
//   feTurbulence 滤镜进 PDF 不保持矢量 → 导出前把「纸+拓质」单独栅格化成 ≥300dpi 位图,
//   作背景嵌入; 文字/线/色块全部保持矢量画在其上(色块用 <1 透明度, 拓质从底下透上来)。
// 仅浏览器可栅格化(需 canvas); node 无 canvas → 返回 null, 退化为纯矢量(纸=平涂)。
// 生成「纸+拓质」背景 PNG 字节。注意: 输出是 RGB PNG(pdf-lib 只吃 RGB/灰度), 印刷时由 RIP 转 CMYK;
// 矢量层(文字/线/色块/裁切标)才是真 CMYK。做扎实: 任何失败都返回 null → 上层退化纯矢量, 绝不拖垮导出。
export function buildTextureSVG({ mediaWmm, mediaHmm, variant = 'editorial-rubbing', pxW, pxH, texture: texOpt, freqMul = 1 }) {
  const c = RECORD_VARIANTS[variant] || RECORD_VARIANTS['editorial-rubbing'];
  // mm 视口 → 与屏幕渲染同频同参: 走同一个 texture 模块(单一真源, 印刷不会跟屏幕漂)。
  // freqMul 必须与对应渲染函数一致(整年长条 1 / 单月卡 2.2), 否则印出来的质感比屏幕粗。
  const tex = resolveTexture(texOpt, c, { freqMul });
  const t = tex.build(mediaWmm, mediaHmm, 'px');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mediaWmm} ${mediaHmm}" width="${pxW}" height="${pxH}" preserveAspectRatio="none">`
    + `<defs>${t.defs}</defs>`
    + `<rect width="${mediaWmm}" height="${mediaHmm}" fill="${c.paper}"/>`
    + t.body
    + `</svg>`;
}

export async function rasterizeRecordTexture({ mediaWmm, mediaHmm, variant = 'editorial-rubbing', texture: texOpt, freqMul = 1, dpi = 300, timeoutMs = 15000 } = {}) {
  try {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null; // node: 跳过, 走矢量退化
    const MAXPX = 12000;          // canvas 长边上限(A1+出血 @300dpi≈10004px)
    const MAXAREA = 90 * 1e6;     // 面积上限 ~90MP(超则再压, 防个别浏览器 canvas 面积限)
    const scale0 = Math.max(1, dpi) / 25.4;
    let pxW = Math.round(mediaWmm * scale0), pxH = Math.round(mediaHmm * scale0);
    let effDpi = dpi;
    const longest = Math.max(pxW, pxH);
    if (longest > MAXPX) { const k = MAXPX / longest; pxW = Math.round(pxW * k); pxH = Math.round(pxH * k); effDpi = Math.round(effDpi * k); }
    if (pxW * pxH > MAXAREA) { const k = Math.sqrt(MAXAREA / (pxW * pxH)); pxW = Math.round(pxW * k); pxH = Math.round(pxH * k); effDpi = Math.round(effDpi * k); }
    if (effDpi < dpi) console.warn(`[拓质栅格化] ${dpi}dpi 超上限, 实际 ${effDpi}dpi (${pxW}x${pxH})`);

    const svg = buildTextureSVG({ mediaWmm, mediaHmm, variant, pxW, pxH, texture: texOpt, freqMul });
    const img = await new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const im = new Image();
      im.onload = () => finish(im);
      im.onerror = () => finish(null);
      setTimeout(() => finish(null), timeoutMs); // 超时守卫: 湍流巨图卡住就退化
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
    if (!img) return null;

    const canvas = document.createElement('canvas');
    canvas.width = pxW; canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, pxW, pxH);
    const blob = await new Promise((resolve) => { try { canvas.toBlob(resolve, 'image/png'); } catch { resolve(null); } });
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch (e) {
    console.warn('[拓质栅格化] 失败, 退化纯矢量:', e?.message || e);
    return null;
  }
}

export async function buildRecordPdfBytes(model, opts = {}) {
  const { PDFDocument, StandardFonts, cmyk } = await import('../vendor/pdf-lib.esm.js');
  const fonts = opts.fonts || {};
  const variant = model.variant || 'editorial-rubbing';
  const c = RECORD_VARIANTS[variant] || RECORD_VARIANTS['editorial-rubbing'];
  const mono = !!c.mono;

  const hexToCmyk = makeHexToCmyk(cmyk);

  const g = geometry();
  const { year, categories = [], days = {}, milestones = [] } = model;
  const catById = Object.fromEntries(categories.map((x) => [x.id, x]));
  const mediaWmm = g.PAGE.w + 2 * g.BLEED, mediaHmm = g.PAGE.h + 2 * g.BLEED;

  const doc = await PDFDocument.create();
  const page = doc.addPage([mediaWmm * MM, mediaHmm * MM]);

  let latin, latinB, cjk = null;
  if (fonts.latin || fonts.cjk) { const fk = await import('../vendor/fontkit.mjs'); doc.registerFontkit(fk.default || fk); }
  latin  = fonts.latin     ? await doc.embedFont(fonts.latin,     { subset: true }) : await doc.embedFont(StandardFonts.Helvetica);
  latinB = fonts.latinBold ? await doc.embedFont(fonts.latinBold, { subset: true }) : (fonts.latin ? latin : await doc.embedFont(StandardFonts.HelveticaBold));
  if (fonts.cjk) cjk = await doc.embedFont(fonts.cjk, { subset: true });
  const kai = cjk || latin; // 无中文字时 CJK 文本走缺口(见字体授权文档)

  const X = (xmm) => (xmm + g.BLEED) * MM;
  const Y = (ymm) => (mediaHmm - (ymm + g.BLEED)) * MM;
  const rect = (xmm, ymm, wmm, hmm, color, opacity = 1) => page.drawRectangle({ x: X(xmm), y: Y(ymm + hmm), width: wmm * MM, height: hmm * MM, color, opacity });
  const line = (x1, y1, x2, y2, color, wmm) => page.drawLine({ start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) }, thickness: wmm * MM, color });
  const text = (xmm, ymm, str, sizeMM, color, f = latin, align = 'left') => {
    if (!str) return;
    let w = 0; try { w = f.widthOfTextAtSize(str, sizeMM * MM); } catch { return; } // 缺字形则跳过
    const x = align === 'end' ? X(xmm) - w : align === 'middle' ? X(xmm) - w / 2 : X(xmm);
    page.drawText(str, { x, y: Y(ymm), size: sizeMM * MM, font: f, color });
  };

  const inkC = hexToCmyk(c.ink), softC = hexToCmyk(c.inkSoft), lineC = hexToCmyk(c.line), sealC = hexToCmyk(c.seal), paperC = hexToCmyk(c.paper), paper2C = hexToCmyk(c.paper2);

  // ① 背景: 有拓质位图就铺满(含出血), 否则平涂纸(node 退化)
  if (opts.textureImage) {
    const png = await doc.embedPng(opts.textureImage);
    page.drawImage(png, { x: 0, y: 0, width: mediaWmm * MM, height: mediaHmm * MM });
  } else {
    page.drawRectangle({ x: 0, y: 0, width: mediaWmm * MM, height: mediaHmm * MM, color: paperC });
  }

  // ② 报头(矢量)
  if (mono) text(g.contentX, g.contentY + 20, c.era, 20, inkC, kai);
  else      text(g.contentX, g.contentY + 20, String(year), 20, inkC, latinB);
  text(g.contentX + (mono ? 30 : 52), g.contentY + 18, c.title, 8, inkC, kai);
  const mx = g.gridRight;
  text(mx, g.contentY + 7,  c.sub1, 2.9, softC, kai, 'end');
  text(mx, g.contentY + 13, 'Format A1 · 841x594 mm', 2.9, softC, latin, 'end');
  text(mx, g.contentY + 19, c.sub2, 2.9, softC, kai, 'end');
  line(g.contentX, g.mastheadRuleY, g.gridRight, g.mastheadRuleY, inkC, 0.6);

  // ③ 顶部日刻度
  for (let d = 1; d <= 31; d++) text(dayCenterX(g, d), g.axisY + g.AXIS_H * 0.72, String(d), 3.2, softC, latin, 'middle');
  line(g.contentX, g.cellsTop, g.gridRight, g.cellsTop, inkC, 0.5);

  // ④ 12 月行: 色块=活动强度(透明度), 拓质从底透上来; 里程碑另走朱砂
  for (let m = 0; m < 12; m++) {
    const rowY = g.cellsTop + m * g.rowH, rowMid = rowY + g.rowH * 0.5, dim = daysInMonth(year, m);
    for (let d = 1; d <= 31; d++) {
      const cell = cellRect(g, m, d);
      if (d > dim) continue;
      const rec = days[iso(year, m, d)];
      if (mono) {
        if (rec) rect(cell.x, cell.y, cell.w, cell.h, inkC, inkOpacity(rec.intensity, { mono: true, carrier: 'year' }));
      } else {
        if (c.weekendTint && isWeekend(year, m, d)) rect(cell.x, cell.y, cell.w, cell.h, paper2C, 0.85);
        if (rec) { const cat = catById[rec.categoryId]; if (cat) rect(cell.x, cell.y, cell.w, cell.h, hexToCmyk(cat.color), inkOpacity(rec.intensity, { carrier: 'year' })); }
        if (dow(year, m, d) === 0) rect(cell.x, cell.y + cell.h * 0.22, 0.5, cell.h * 0.56, sealC);
      }
    }
    text(g.contentX, rowMid + 2.2, MONTHS_ZH[m], 6.2, inkC, kai);
    text(g.gridLeft - 3, rowMid + 1.2, MONTHS_NUM[m], 3.4, mono ? softC : sealC, latin, 'end');
    line(g.contentX, rowY + g.rowH, g.gridRight, rowY + g.rowH, lineC, mono ? 0.22 : 0.3);
  }

  // ⑤ 里程碑 = 朱砂印(红方块 + 内白框 + 楷体标签)
  for (const ms of milestones) {
    const [yy, mo, d] = String(ms.date).split('-').map(Number);
    if (yy !== Number(year)) continue;   // 同 renderRecord: 年份可能是字符串
    const cell = cellRect(g, mo - 1, d);
    const s = 4.2;
    if (cjk && ms.label) rect(cell.x + 6, cell.y + 0.6, Math.min(String(ms.label).length * 3.0 + 1.5, g.cellW * 3), 4.4, paperC, 0.72);
    rect(cell.x + 0.5, cell.y + 0.5, s + 1, s + 1, paperC, 0.9);   // 纸色晕(同屏幕)
    rect(cell.x + 1, cell.y + 1, s, s, sealC);
    page.drawRectangle({ x: X(cell.x + 1.5), y: Y(cell.y + 1 + s - 0.5), width: (s - 1) * MM, height: (s - 1) * MM, color: sealC, borderColor: paperC, borderWidth: 0.25 * MM });
    if (cjk) text(cell.x + 1 + s + 1.2, cell.y + 1 + s - 0.9, ms.label || '', 3.0, inkC, cjk);
  }

  // ⑥ 页脚: 图例 + 印刷标注
  const fb = g.footerY + g.FOOTER_H * 0.5;
  line(g.contentX, g.footerY, g.gridRight, g.footerY, lineC, 0.3);
  let lx = g.contentX;
  const legend = legendItems(model, c);   // 与屏幕同一个函数
  const legendLimit = g.gridRight - 92; // 右侧留给印刷标注; 分类多时图例排到这儿为止
  for (const it of legend) {
    if (lx + 4 + it.name.length * 2.8 > legendLimit) break;
    if (it.ink) rect(lx, fb - 2, 2.8, 2.8, inkC, 0.8);
    else rect(lx, fb - 2, 2.8, 2.8, hexToCmyk(it.color));
    text(lx + 4, fb, it.name, 2.8, softC, kai);
    lx += 4 + it.name.length * 2.8 + 6;
  }
  text(g.gridRight, fb, 'A1 841x594mm  CMYK  BLEED 3mm  FONTS EMBEDDED', 2.8, softC, latin, 'end');

  // ⑦ 四角裁切标(出血区)
  drawCropMarks(page, g, inkC);
  return doc.save();
}

// ---- 浏览器: 活动数组 → 取字体 + 栅格化拓质 → 生成 → 下载 ----
export async function exportRecordPDF(activities, year = 2026, variant = 'editorial-rubbing', opts = {}) {
  const model = toRecordModel(activities, year, variant);
  const g = geometry();
  const mediaWmm = g.PAGE.w + 2 * g.BLEED, mediaHmm = g.PAGE.h + 2 * g.BLEED;
  const [latin, latinBold, cjk, textureImage] = await Promise.all([
    fetchFont('/fonts/EBGaramond_400Regular.ttf'),
    fetchFont('/fonts/EBGaramond_700Bold.ttf'),
    fetchFont('/fonts/LXGWWenKai-Regular.ttf'), // 未放置则 null → CJK 走缺口
    rasterizeRecordTexture({ mediaWmm, mediaHmm, variant, texture: opts.texture, dpi: opts.dpi || 300 }),
  ]);
  const bytes = await buildRecordPdfBytes(model, { fonts: { latin, latinBold, cjk }, textureImage });
  downloadPdf(bytes, `活动留痕-${year}-A1.pdf`);
  return { hasTexture: !!textureImage, hasCjk: !!cjk };
}

// ============================================================================
// 单月卡 · 印刷 PDF —— 与整年长条同规格(出血 / 裁切标 / CMYK / 子集嵌字 / 拓质位图),
// 只是版面换成 renderMonth 那张竖版周历卡(210×280mm)。几何走 monthGeometry(),
// 与屏幕渲染同一真源, 所以「预览=成品」。
// ============================================================================
export async function buildMonthPdfBytes(model, monthIndex = 0, opts = {}) {
  const { PDFDocument, StandardFonts, cmyk } = await import('../vendor/pdf-lib.esm.js');
  const fonts = opts.fonts || {};
  const variant = model.variant || 'editorial-rubbing';
  const c = RECORD_VARIANTS[variant] || RECORD_VARIANTS['editorial-rubbing'];
  const mono = !!c.mono;

  const hexToCmyk = makeHexToCmyk(cmyk);

  const { year, categories = [], days = {}, milestones = [] } = model;
  const catById = Object.fromEntries(categories.map((x) => [x.id, x]));
  const m = clampMonth(monthIndex);
  const dim = daysInMonth(year, m);
  const firstDow = dow(year, m, 1);
  const g = monthGeometry(weeksInMonth(year, m));
  const mediaWmm = MONTH_PAGE.w + 2 * MONTH_PAGE.BLEED, mediaHmm = MONTH_PAGE.h + 2 * MONTH_PAGE.BLEED;

  const doc = await PDFDocument.create();
  const page = doc.addPage([mediaWmm * MM, mediaHmm * MM]);

  let latin, cjk = null;
  if (fonts.latin || fonts.cjk) { const fk = await import('../vendor/fontkit.mjs'); doc.registerFontkit(fk.default || fk); }
  latin = fonts.latin ? await doc.embedFont(fonts.latin, { subset: true }) : await doc.embedFont(StandardFonts.Helvetica);
  if (fonts.cjk) cjk = await doc.embedFont(fonts.cjk, { subset: true });
  const kai = cjk || latin; // 无中文字时 CJK 文本走缺口(见字体授权文档)

  const B = MONTH_PAGE.BLEED;
  const X = (xmm) => (xmm + B) * MM;
  const Y = (ymm) => (mediaHmm - (ymm + B)) * MM;
  const rect = (xmm, ymm, wmm, hmm, color, opacity = 1) => page.drawRectangle({ x: X(xmm), y: Y(ymm + hmm), width: wmm * MM, height: hmm * MM, color, opacity });
  const stroke = (xmm, ymm, wmm, hmm, color, wmmLine) => page.drawRectangle({ x: X(xmm), y: Y(ymm + hmm), width: wmm * MM, height: hmm * MM, borderColor: color, borderWidth: wmmLine * MM });
  const line = (x1, y1, x2, y2, color, wmm) => page.drawLine({ start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) }, thickness: wmm * MM, color });
  const text = (xmm, ymm, str, sizeMM, color, f = latin, align = 'left', opacity = 1) => {
    if (str == null || str === '') return;
    let w = 0; try { w = f.widthOfTextAtSize(String(str), sizeMM * MM); } catch { return; } // 缺字形则跳过
    const x = align === 'end' ? X(xmm) - w : align === 'middle' ? X(xmm) - w / 2 : X(xmm);
    page.drawText(String(str), { x, y: Y(ymm), size: sizeMM * MM, font: f, color, opacity });
  };
  const clip = clipText;   // 与屏幕同一个截断口径

  const inkC = hexToCmyk(c.ink), softC = hexToCmyk(c.inkSoft), lineC = hexToCmyk(c.line),
        sealC = hexToCmyk(c.seal), paperC = hexToCmyk(c.paper);

  // ① 背景: 拓质位图(浏览器)或平涂纸(node 退化)
  if (opts.textureImage) {
    const png = await doc.embedPng(opts.textureImage);
    page.drawImage(png, { x: 0, y: 0, width: mediaWmm * MM, height: mediaHmm * MM });
  } else {
    page.drawRectangle({ x: 0, y: 0, width: mediaWmm * MM, height: mediaHmm * MM, color: paperC });
  }

  // ② 报头: 月名 + 月号 + 年 + 当月统计(与屏幕**同一个函数**, 不再各数一遍)
  const { activeDays, sumWeight: sumW } = monthTotals(model, m);
  text(g.M.l, g.M.t + 14, MONTHS_ZH[m], 15, inkC, kai);
  text(monthNumX(m), g.M.t + 13, MONTHS_NUM[m], 4.4, softC, latin);   // 偏移按月名字数算, 与屏幕同函数
  text(g.gridRight, g.M.t + 6, String(year), 8, inkC, mono ? kai : latin, 'end');
  text(g.gridRight, g.M.t + 12.5, `${activeDays} 天有痕 · 投入 ${sumW}`, 3, softC, kai, 'end');
  line(g.M.l, g.ruleY, g.gridRight, g.ruleY, inkC, 0.5);

  // ③ 星期表头(周日走朱砂)
  const WK = ['日', '一', '二', '三', '四', '五', '六'];
  for (let i = 0; i < 7; i++) {
    text(g.gridLeft + (i + 0.5) * g.colW, g.M.t + g.HEAD_H + 4.5, WK[i], 3.4, i === 0 ? sealC : softC, kai, 'middle');
  }

  // ④ 日格: 墨底(强度)+ 格线 + 日号 + 朱砂里程碑 + 活动标题
  const msByDay = milestonesByDay(model, m);   // 与屏幕同一个函数
  for (let d = 1; d <= dim; d++) {
    const idx = firstDow + d - 1;
    const col = idx % 7, row = Math.floor(idx / 7);
    const x = g.gridLeft + col * g.colW, y = g.gridTop + row * g.rowH;
    const rec = days[iso(year, m, d)];
    if (rec) {   // 「出版」也照常落墨(见 renderRecord 同处注释)
      const inten = rec.intensity || 0.4;
      if (mono) rect(x + 0.6, y + 0.6, g.colW - 1.2, g.rowH - 1.2, inkC, inkOpacity(inten, { mono: true, carrier: 'month' }));
      else { const cat = catById[rec.categoryId]; if (cat) rect(x + 0.6, y + 0.6, g.colW - 1.2, g.rowH - 1.2, hexToCmyk(cat.color), inkOpacity(inten, { carrier: 'month' })); }
    }
    stroke(x, y, g.colW, g.rowH, lineC, 0.25);
    text(x + 2, y + 5, String(d), 4, col === 0 ? sealC : inkC, latin, 'left', rec ? 1 : 0.4);
    if (msByDay[d] != null) {
      const s = 3.8, sx = x + g.colW - 6, sy = y + 2;
      rect(sx - 0.6, sy - 0.6, s + 1.2, s + 1.2, paperC, 0.9);   // 纸色晕: 印章落在同色系格底上也跳得出来
      rect(sx, sy, s, s, sealC);
      page.drawRectangle({ x: X(sx + 0.6), y: Y(sy + s - 0.6), width: (s - 1.2) * MM, height: (s - 1.2) * MM, borderColor: paperC, borderWidth: 0.3 * MM });
      if (cjk) text(sx + s, sy + s + 3.2, clip(msByDay[d], 6), 2.7, sealC, cjk, 'end'); // 贴印章右缘往左排, 不冲出格子
    }
    if (rec && rec.note && cjk) text(x + 2, y + g.rowH - 2.4, clip(rec.note, 6), 2.9, inkC, cjk, 'left', 0.82);
  }

  // ⑤ 页脚图例(分类多时截断, 与屏幕同规则)
  line(g.M.l, g.footRuleY, g.gridRight, g.footRuleY, lineC, 0.3);
  let lx = g.M.l;
  const legend = legendItems(model, c, { month: m, compact: true });   // 与屏幕同一个函数
  for (const it of legend) {
    if (lx + 4.2 + it.name.length * 3 > g.gridRight) break;
    if (it.ink) rect(lx, g.footBaseline - 2.4, 3, 3, inkC, 0.8);
    else rect(lx, g.footBaseline - 2.4, 3, 3, hexToCmyk(it.color));
    text(lx + 4.2, g.footBaseline, it.name, 3, softC, kai);
    lx += 4.2 + it.name.length * 3 + 5;
  }

  // ⑥ 四角裁切标(出血区) —— 与整年长条共用同一个函数, 只是换页面尺寸
  drawCropMarks(page, { BLEED: B, PAGE: { w: MONTH_PAGE.w, h: MONTH_PAGE.h } }, inkC);
  return doc.save();
}

// ---- 浏览器: 活动数组 + 月份 → 取字体 + 栅格化拓质 → 生成 → 下载 ----
export async function exportMonthPDF(activities, year = 2026, monthIndex = 0, variant = 'editorial-rubbing', opts = {}) {
  const model = toRecordModel(activities, year, variant);
  const mediaWmm = MONTH_PAGE.w + 2 * MONTH_PAGE.BLEED, mediaHmm = MONTH_PAGE.h + 2 * MONTH_PAGE.BLEED;
  const [latin, cjk, textureImage] = await Promise.all([
    fetchFont('/fonts/EBGaramond_400Regular.ttf'),
    fetchFont('/fonts/LXGWWenKai-Regular.ttf'), // 未放置则 null → CJK 走缺口
    // 月卡视口比 A1 小 → 频率按同一条规则换算(与 renderMonth 用的 2.2 一致)
    rasterizeRecordTexture({ mediaWmm, mediaHmm, variant, texture: opts.texture, dpi: opts.dpi || 300, freqMul: 2.2 }),
  ]);
  const m = clampMonth(monthIndex);
  const bytes = await buildMonthPdfBytes(model, m, { fonts: { latin, cjk }, textureImage });
  downloadPdf(bytes, `活动留痕-${year}-${MONTHS_NUM[m]}月.pdf`);
  return { hasTexture: !!textureImage, hasCjk: !!cjk };
}

function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
