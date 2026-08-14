// 数据模型 —— 一份数据 → 驱动版面。
// 里程碑 = 排版锚点;分类密度 = 画面纹理;每日备注 = 安静的叙事底噪。
import { theme } from '../poster/theme.js';

export const MONTHS_ZH  = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
export const MONTHS_NUM  = ['01','02','03','04','05','06','07','08','09','10','11','12'];
export const MONTHS_EN   = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
export function dow(y, m, d) { return new Date(y, m, d).getDay(); }          // 0=周日 … 6=周六
export function isWeekend(y, m, d) { const w = dow(y, m, d); return w === 0 || w === 6; }
export function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; }

// 分类默认取自锁死调色板 (theme.palette), render: 'fill' 块底纹 | 'dot' 细点
export function defaultCategories() {
  return [
    { id: 'sprint', name: '冲刺', paletteId: 'sand', color: '#e8dcc0', render: 'fill' },
    { id: 'travel', name: '远行', paletteId: 'mist', color: '#dce6e2', render: 'fill' },
    { id: 'health', name: '打卡', paletteId: 'sage', color: theme.teal, render: 'dot' },
    { id: 'life',   name: '生活', paletteId: 'clay', color: '#e3d3c4', render: 'fill' },
  ];
}

export function emptyModel(year = 2026) {
  return { year, categories: defaultCategories(), days: {}, milestones: [] };
}

// 一份「有意」的演示数据(非随机噪声),让你看清数据怎么组织画面
export function sampleModel(year = 2026) {
  const m = emptyModel(year);
  const set = (mo, d, patch) => { m.days[iso(year, mo, d)] = { ...(m.days[iso(year, mo, d)] || {}), ...patch }; };

  // 里程碑 = 四个排版锚点
  m.milestones = [
    { date: iso(year, 1, 14),  label: '展览开幕' },
    { date: iso(year, 4, 1),   label: '新作发布' },
    { date: iso(year, 7, 20),  label: '远行' },
    { date: iso(year, 10, 25), label: '年终复盘' },
  ];

  // 冲刺(sprint):三月 2–20 一整块, 十二月 1–12 收尾块
  for (let d = 2; d <= 20; d++) set(2, d, { categoryId: 'sprint' });
  for (let d = 1; d <= 12; d++) set(11, d, { categoryId: 'sprint' });
  // 远行(travel):八月 8–16
  for (let d = 8; d <= 16; d++) set(7, d, { categoryId: 'travel' });
  // 打卡(health):一月每周一三五 + 六月同律 → 有节奏的细点, 不是乱撒
  for (let mo of [0, 5]) {
    const dim = daysInMonth(year, mo);
    for (let d = 1; d <= dim; d++) { const w = dow(year, mo, d); if (w === 1 || w === 3 || w === 5) set(mo, d, { categoryId: 'health' }); }
  }
  // 生活(life):零星几处
  [[3, 5], [3, 18], [9, 4], [9, 12], [1, 28]].forEach(([mo, d]) => set(mo, d, { categoryId: 'life' }));

  // 少量每日备注(安静底噪, 楷体小字)
  set(2, 10, { note: '评审' });
  set(4, 2,  { note: '庆功' });
  set(7, 12, { note: '京都' });
  set(10, 26, { note: '总结' });

  return m;
}

// ---- 持久化(浏览器 localStorage;node 构建时不调用) ----
const KEY = (year) => `linear-calendar:${year}`;
export function loadModel(year = 2026) {
  try {
    const raw = localStorage.getItem(KEY(year));
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return sampleModel(year);   // 首次进入给示例, 让空白期也有东西看
}
export function saveModel(model) {
  try { localStorage.setItem(KEY(model.year), JSON.stringify(model)); } catch (e) { /* ignore */ }
}
