// 印刷级 PDF 导出 —— 产品主角。
// 精确 A1(841×594mm)+ 3mm 出血 + 四角裁切标 + CMYK 色值 + 全矢量。
// 与 renderPoster 共用 layout.js 几何, 所以「预览=成品」。
//
// 字体策略(见 docs/字体授权与印刷规格.md):
//   · 拉丁字 —— 传入 EB Garamond(OFL) 则子集嵌入; 否则回退 PDF 内置 Helvetica。
//   · 中文字 —— 传入 霞鹜文楷(OFL) 则子集嵌入并渲染月份名/标签/备注; 否则该批 CJK 文本留空缺口。
//   subset 由 @pdf-lib/fontkit 完成(只嵌用到的字形), 不需要外部 pyftsubset。
import { geometry, cellRect } from './layout.js';
import { theme } from './theme.js';
import { MONTHS_ZH, MONTHS_NUM, daysInMonth, dow, isWeekend, iso } from '../data/model.js';

const MM = 2.834645669; // 1mm = 2.834645669pt

export async function buildPosterPdfBytes(model, opts = {}) {
  const { PDFDocument, StandardFonts, cmyk } = await import('../vendor/pdf-lib.esm.js');
  const fonts = opts.fonts || {};
  const hexToCmyk = (hex) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255, g2 = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const k = 1 - Math.max(r, g2, b);
    if (k >= 1) return cmyk(0, 0, 0, 1);
    return cmyk((1 - r - k) / (1 - k), (1 - g2 - k) / (1 - k), (1 - b - k) / (1 - k), k);
  };

  const g = geometry();
  const { year, categories = [], days = {}, milestones = [] } = model;
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const mediaWmm = g.PAGE.w + 2 * g.BLEED, mediaHmm = g.PAGE.h + 2 * g.BLEED;

  const doc = await PDFDocument.create();
  const page = doc.addPage([mediaWmm * MM, mediaHmm * MM]);

  // 字体: 有自定义字就注册 fontkit 做子集嵌入
  let latin, latinB, cjk = null;
  if (fonts.latin || fonts.cjk) {
    const fk = await import('../vendor/fontkit.mjs');
    doc.registerFontkit(fk.default || fk);
  }
  latin  = fonts.latin     ? await doc.embedFont(fonts.latin,     { subset: true }) : await doc.embedFont(StandardFonts.Helvetica);
  latinB = fonts.latinBold ? await doc.embedFont(fonts.latinBold, { subset: true }) : (fonts.latin ? latin : await doc.embedFont(StandardFonts.HelveticaBold));
  if (fonts.cjk) cjk = await doc.embedFont(fonts.cjk, { subset: true });

  // 坐标: trim 顶端向下 mm → PDF 左下原点 pt(含 3mm 出血偏移 + y 翻转)
  const X = (xmm) => (xmm + g.BLEED) * MM;
  const Y = (ymm) => (mediaHmm - (ymm + g.BLEED)) * MM;
  const rect = (xmm, ymm, wmm, hmm, color) => page.drawRectangle({ x: X(xmm), y: Y(ymm + hmm), width: wmm * MM, height: hmm * MM, color });
  const line = (x1, y1, x2, y2, color, wmm) => page.drawLine({ start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) }, thickness: wmm * MM, color });
  const text = (xmm, ymm, str, sizeMM, color, f = latin, align = 'left') => {
    if (!str) return;
    const w = f.widthOfTextAtSize(str, sizeMM * MM);
    const x = align === 'end' ? X(xmm) - w : align === 'middle' ? X(xmm) - w / 2 : X(xmm);
    page.drawText(str, { x, y: Y(ymm), size: sizeMM * MM, font: f, color });
  };
  const inkC = hexToCmyk(theme.ink), softC = hexToCmyk(theme.inkSoft), lineC = hexToCmyk(theme.line), ochreC = hexToCmyk(theme.ochre);

  // 底: 暖纸铺满整个含出血页面
  page.drawRectangle({ x: 0, y: 0, width: mediaWmm * MM, height: mediaHmm * MM, color: hexToCmyk(theme.paper) });

  // 报头
  text(g.contentX, g.contentY + 20, String(year), 20, inkC, latinB);
  if (cjk) text(g.contentX + 52, g.contentY + 18, '线性年历', 8, inkC, cjk);
  else     text(g.contentX + 52, g.contentY + 18, 'LINEAR YEAR', 8, inkC, latin);
  line(g.contentX, g.mastheadRuleY, g.gridRight, g.mastheadRuleY, inkC, 0.6);

  // 顶部日刻度
  for (let d = 1; d <= 31; d++) text(g.gridLeft + (d - 0.5) * g.cellW, g.axisY + g.AXIS_H * 0.72, String(d), 3.0, softC, latin, 'middle');
  line(g.contentX, g.cellsTop, g.gridRight, g.cellsTop, inkC, 0.5);

  // 12 月行
  for (let m = 0; m < 12; m++) {
    const rowY = g.cellsTop + m * g.rowH, rowMid = rowY + g.rowH * 0.5, dim = daysInMonth(year, m);
    for (let d = 1; d <= 31; d++) {
      const c = cellRect(g, m, d);
      if (d > dim) continue;
      if (isWeekend(year, m, d)) rect(c.x, c.y, c.w, c.h, hexToCmyk(theme.paper2));
      const rec = days[iso(year, m, d)] || {};
      const cat = rec.categoryId ? catById[rec.categoryId] : null;
      if (cat) {
        if (cat.render === 'dot') page.drawCircle({ x: X(c.x + c.w * 0.5), y: Y(c.y + c.h * 0.5), size: 1.2 * MM, color: hexToCmyk(cat.color) });
        else rect(c.x, c.y, c.w, c.h, hexToCmyk(cat.color));
      }
      if (dow(year, m, d) === 0) rect(c.x, c.y + c.h * 0.22, 0.5, c.h * 0.56, ochreC);
      if (rec.note && cjk) text(c.x + c.w * 0.5, rowMid + 0.9, String(rec.note).slice(0, 4), 2.7, inkC, cjk, 'middle');
    }
    if (cjk) text(g.contentX, rowMid + 2.2, MONTHS_ZH[m], 6.2, inkC, cjk);
    text(g.gridLeft - 3, rowMid + 1.2, MONTHS_NUM[m], 3.4, ochreC, latin, 'end');
    line(g.contentX, rowY + g.rowH, g.gridRight, rowY + g.rowH, lineC, 0.3);
  }

  // 里程碑锚点: 赭黄星标 + 楷体标签(有中文字才画标签)
  for (const ms of milestones) {
    const [y, mo, d] = ms.date.split('-').map(Number);
    if (y !== year) continue;
    const c = cellRect(g, mo - 1, d);
    if (cjk) { text(c.x + 1.2, c.y + 4.4, '✳', 3.8, ochreC, cjk); text(c.x + 1.6, c.y + 8.6, ms.label || '', 3.2, inkC, cjk); }
    else rect(c.x + 1, c.y + 1.5, 2.4, 2.4, ochreC);
  }

  // 页脚
  line(g.contentX, g.footerY, g.gridRight, g.footerY, lineC, 0.3);
  text(g.gridRight, g.footerY + g.FOOTER_H * 0.5, 'A1 841x594mm  CMYK  BLEED 3mm  FONTS EMBEDDED', 2.8, softC, latin, 'end');

  // 四角裁切标
  drawCropMarks(page, g, inkC);
  return doc.save();
}

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
export async function exportPosterPDF(model) {
  const [latin, latinBold, cjk] = await Promise.all([
    fetchFont('/fonts/EBGaramond_400Regular.ttf'),
    fetchFont('/fonts/EBGaramond_700Bold.ttf'),
    fetchFont('/fonts/LXGWWenKai-Regular.ttf'), // 未放置则 null → CJK 走缺口
  ]);
  const bytes = await buildPosterPdfBytes(model, { fonts: { latin, latinBold, cjk } });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `线性年历-${model.year}-A1.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
