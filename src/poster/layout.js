// A1 横向几何 —— 一切以毫米 (mm) 为单位, 与印刷 PDF 同坐标系。
// SVG 用 viewBox="0 0 841 594" 时, 1 用户单位 = 1mm; PDF 导出时 1mm = 2.834645pt。
// 屏幕预览与印刷成品共用本文件的几何, 保证「预览=成品」。

export const PAGE = { w: 841, h: 594 };   // A1 横向成品 (trim)
export const BLEED = 3;                     // 出血 3mm

// 版心边距 (mm)
const M = { l: 26, r: 22, t: 26, b: 20 };
// 各带高度 (mm)
const MASTHEAD_H = 44;   // 报头
const RULE_GAP   = 7;    // 报头分隔线到日刻度
const AXIS_H     = 12;   // 顶部 1..31 刻度
const FOOTER_H   = 15;   // 页脚
const FOOTER_GAP = 5;    // 网格到页脚
const GUTTER_W   = 48;   // 左侧月份栏宽

export function geometry() {
  const contentX = M.l;
  const contentW = PAGE.w - M.l - M.r;
  const contentY = M.t;
  const contentH = PAGE.h - M.t - M.b;

  const mastheadRuleY = contentY + MASTHEAD_H;
  const axisY   = mastheadRuleY + RULE_GAP;   // 刻度带顶
  const cellsTop = axisY + AXIS_H;            // 第一行月份格顶
  const footerY  = contentY + contentH - FOOTER_H;
  const cellsBottom = footerY - FOOTER_GAP;

  const gridLeft  = contentX + GUTTER_W;
  const gridRight = contentX + contentW;
  const gridW     = contentW - GUTTER_W;
  const cellW     = gridW / 31;
  const rowH      = (cellsBottom - cellsTop) / 12;

  return {
    PAGE, BLEED, M,
    contentX, contentW, contentY, contentH,
    mastheadRuleY, axisY, AXIS_H,
    cellsTop, cellsBottom, footerY, FOOTER_H, FOOTER_GAP,
    gridLeft, gridRight, gridW, cellW, rowH, GUTTER_W,
  };
}

// 第 m 月(0..11)、第 d 日(1..31) 单元格矩形 (mm)
export function cellRect(g, m, d) {
  return { x: g.gridLeft + (d - 1) * g.cellW, y: g.cellsTop + m * g.rowH, w: g.cellW, h: g.rowH };
}
// 第 m 月行顶部 y
export function monthRowY(g, m) { return g.cellsTop + m * g.rowH; }
// 第 d 日刻度中心 x
export function dayCenterX(g, d) { return g.gridLeft + (d - 0.5) * g.cellW; }
