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
// —— 统计:活动 → 派生统计(总量/活跃天/连续天/分类分布/按月/最忙/可选按人分组)——
export { computeStats, monthStats, summarize, monthRange, daysBack } from '../data/stats.js';
// —— 渲染:整年长条 / 单月详情(印刷大件)——
export { renderRecord, RECORD_VARIANTS } from '../poster/renderRecord.js';
export { renderMonth } from '../poster/renderMonth.js';
// —— 可嵌入小件:活动带 / 统计卡(同页可放无限个, id 自动隔离)——
export { renderStrip, renderStatCard } from '../embed/index.js';
// —— 导出:印刷 PDF(整年长条 / 单月卡;浏览器下载 / 纯字节)+ 拓质栅格化 ——
export { exportRecordPDF, buildRecordPdfBytes, exportMonthPDF, buildMonthPdfBytes, rasterizeRecordTexture } from '../poster/exportPdf.js';
// —— 手工质感:可编辑、可复用的程序化纹理(拓质/扎染/手绘/拓扑)——
export { texture, resolveTexture, TEXTURE_PRESETS, TEXTURE_DEFAULTS, isTexturePreset } from '../texture/index.js';

import { toRecordModel } from '../data/activity.js';
import { computeStats } from '../data/stats.js';
import { renderRecord } from '../poster/renderRecord.js';
import { renderMonth } from '../poster/renderMonth.js';
import { renderStrip, renderStatCard } from '../embed/index.js';

export const VARIANTS = ['editorial-rubbing', 'tuogu-ink']; // B 暖·拓质(默认) / A 全拓·墨

/**
 * 便捷句柄:一次建模,按需吐整年 / 单月 SVG。
 * @param {Array} activities  CO 活动数组(占位形状见 docs/数据契约-占位.md)
 * @param {{year?:number, variant?:string, texture?:string|object}} opts
 *   texture —— 手工质感:预设名('rubbing'|'tiedye'|'handdrawn'|'topographic')
 *              或 { name, ...要改的参数 }(见 src/texture/index.js 的 TEXTURE_DEFAULTS)
 * @returns {{ model, variant, year, texture, yearSVG:()=>string, monthSVG:(m:number)=>string }}
 */
export function createRecord(activities = [], opts = {}) {
  const year = opts.year || 2026;
  const variant = VARIANTS.includes(opts.variant) ? opts.variant : 'editorial-rubbing';
  const tex = opts.texture;
  const acts = Array.isArray(activities) ? activities : [];
  const model = toRecordModel(acts, year, variant);
  return {
    model,
    variant,
    year,
    texture: tex,
    yearSVG: (o = {}) => renderRecord(model, { variant, texture: tex, ...o }),
    monthSVG: (m = 0, o = {}) => renderMonth(model, m, { variant, texture: tex, ...o }),
    // 秘书那一半:统计按需算(o.groupBy 可按任意字段分组, 如将来的 actor)
    stats: (o = {}) => computeStats(acts, { year, ...o }),
    // 可嵌入小件:塞进侧栏/卡片/仪表盘, 同页放几个都行
    stripSVG: (o = {}) => renderStrip(model, { variant, texture: tex, ...o }),
    // o 里可给 from/to(只算这段, 卡片右上角会标出区间)与 groupBy
    statCardSVG: (o = {}) => renderStatCard(computeStats(acts, { year, from: o.from, to: o.to }), { variant, texture: tex, ...o }),
  };
}
