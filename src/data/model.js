// 日历基础工具 —— 月份名、天数、星期、日期串。
// 只放"跟某年某月某日有关"的纯函数;活动数据与配色在 activity.js, 版面几何在 poster/layout.js。
// (旧「年度规划海报」那套 sampleModel/loadModel/saveModel 已随海报路径一起删除 ——
//  其中 load/save 走 localStorage, 与"纯 render+export、不自建存储"的定位相悖。)

export const MONTHS_ZH  = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
export const MONTHS_NUM = ['01','02','03','04','05','06','07','08','09','10','11','12'];

export function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
export function dow(y, m, d) { return new Date(y, m, d).getDay(); }          // 0=周日 … 6=周六
export function isWeekend(y, m, d) { const w = dow(y, m, d); return w === 0 || w === 6; }
export function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
