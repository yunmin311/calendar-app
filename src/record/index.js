// ============================================================================
// 活动记录生成器 —— 公开组件 API(单一可调用入口)
//
// 定位:纯 render+export 组件。进 = CO 活动数组,出 = 月历留痕(SVG)+ 印刷 PDF。
// 无存储、无副作用。接进 CO = 写一个 fromCreativeOS(coData) 适配器把 CO 数据映射成
// 下面的 Activity[](见 docs/数据契约-占位.md),组件内部一律不动。
//
// 典型用法:
//   import { createRecord, exportRecordPDF } from './record/index.js';
//   const rec = createRecord(activities, { year: 2026, variant: 'editorial-rubbing' });
//   el.innerHTML = rec.yearSVG();          // 整年长条
//   el.innerHTML = rec.monthSVG(2);        // 单月详情(三月)
//   await exportRecordPDF(activities, 2026, 'editorial-rubbing'); // 浏览器:下载印刷 PDF
// ============================================================================

// —— 数据契约 / 色板(占位,真 schema 等 CO 落地)——
export { ACTIVITY_TYPES, PALETTES, SEAL, MAX_LEVEL, sampleActivities } from '../data/activity.js';
// —— 建模:活动 → 每日契约序列 / 渲染视图模型 ——
export { toDailySeries, toRecordModel, aggregateByDay } from '../data/activity.js';
// —— 渲染:整年长条 / 单月详情 ——
export { renderRecord, RECORD_VARIANTS } from '../poster/renderRecord.js';
export { renderMonth } from '../poster/renderMonth.js';
// —— 导出:印刷 PDF(浏览器下载 / 纯字节)+ 拓质栅格化 ——
export { exportRecordPDF, buildRecordPdfBytes, rasterizeRecordTexture } from '../poster/exportPdf.js';

import { toRecordModel } from '../data/activity.js';
import { renderRecord } from '../poster/renderRecord.js';
import { renderMonth } from '../poster/renderMonth.js';

export const VARIANTS = ['editorial-rubbing', 'tuogu-ink']; // B 暖·拓质(默认) / A 全拓·墨

/**
 * 便捷句柄:一次建模,按需吐整年 / 单月 SVG。
 * @param {Array} activities  CO 活动数组(占位形状见 docs/数据契约-占位.md)
 * @param {{year?:number, variant?:string}} opts
 * @returns {{ model, variant, year, yearSVG:()=>string, monthSVG:(m:number)=>string }}
 */
export function createRecord(activities = [], opts = {}) {
  const year = opts.year || 2026;
  const variant = VARIANTS.includes(opts.variant) ? opts.variant : 'editorial-rubbing';
  const model = toRecordModel(Array.isArray(activities) ? activities : [], year, variant);
  return {
    model,
    variant,
    year,
    yearSVG: () => renderRecord(model, { variant }),
    monthSVG: (m = 0) => renderMonth(model, m, { variant }),
  };
}
