// ============================================================================
// CO 活动数据 —— 占位 schema(真结构由 Creative OS 侧定, 这里先跑通渲染)
// I/O 契约: 输入 = CO 活动数据 → 输出 = 渲好的月历留痕 + 印刷 PDF。
// 一条 CO 活动(占位):
//   { id, date:'YYYY-MM-DD', type, title, weight }
//     type   —— CO 活动类型(占位): design|writing|research|build|publish
//     weight —— 当天投入/产出量(1..3), 聚合后决定"着墨深浅"
// ============================================================================
import { daysInMonth, dow, iso } from './model.js';

export const ACTIVITY_TYPES = [
  { id: 'design',   name: '设计' },
  { id: 'writing',  name: '写作' },
  { id: 'research', name: '研究' },
  { id: 'build',    name: '构建' },
  { id: 'publish',  name: '出版' }, // 出版=里程碑级
];

// 分类色系统(取真值 · 国画矿物色):五类各据一个矿物色相, 拉开可辨,
// 但都压暗压浊, 叠在麦纸上 + 拓质正片叠底后自然柔和 —— 避开 AI 俗脸「奶油底+赤陶」。
// 真值来源(传统国画/矿物颜料):
//   设计=藤黄(gamboge, 矿物金黄) · 写作=赭石(hematite, 赤铁矿红褐)
//   研究=花青(indigo, 靛蓝压浊) · 构建=石绿(malachite, 孔雀石绿) · 出版=朱砂印泥
export const SEAL = '#9e3b32';        // 朱砂印泥红(里程碑/周日刻度), 印泥真值, 非荧光正红
export const PALETTES = {
  // B 暖·编辑+拓质: 矿物分类色(格子按强度取 0.4~1.0 透明度, 故 hex 偏实, 落纸即柔)
  'editorial-rubbing': {
    design: '#c9a15a',   // 藤黄
    writing: '#b5794f',  // 赭石
    research: '#6f8ea0', // 花青
    build: '#86a07e',    // 石绿
    publish: SEAL,       // 朱砂(不作格底, 走朱砂印通道)
  },
  // A 全拓: 单色墨(类型不着色, 只用墨深浅), 出版=朱砂
  'tuogu-ink': {
    design: '#211b14', writing: '#211b14', research: '#211b14', build: '#211b14', publish: SEAL,
  },
};

// 类型可扩展:占位契约的 5 个 CO 类型是"自带的", 但组件要能被任何需要统计的地方复用
// (会议/复盘/客服…), 喂进未登记的类型不能静默丢格 —— 那会让图和统计数字打架。
// 未登记类型自动补进分类表, 配一个从下面这组矿物色里按类型名派生的颜色:
//   同一个类型名永远拿到同一个颜色(与出现顺序、数据多少无关), 换机器/换数据也稳定。
// 仍是矿物真值一路: 石青 / 胭脂 / 雌黄 / 苍绿 / 紫毫 / 秋香, 都压暗压浊, 落麦纸不跳。
const EXTRA_PIGMENTS = ['#4a6b8a', '#9a5c6b', '#c08a3e', '#5f7f66', '#6f5b8e', '#8a7a52'];
const hash = (s) => { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; };
// 一批未登记类型 → 一批颜色。先按类型名哈希落座(同名尽量总在同一个坑),
// 坑被占了就顺延到下一个空坑 —— 同一批类型里颜色互不重复(超过色数才回绕)。
// 先排序再分配, 故与出现顺序、数据多少无关, 只由"这批类型名的集合"决定。
function assignPigments(ids) {
  const sorted = [...ids].sort();
  const taken = new Map();
  const used = new Set();
  for (const id of sorted) {
    let i = hash(id) % EXTRA_PIGMENTS.length;
    for (let k = 0; k < EXTRA_PIGMENTS.length && used.has(i); k++) i = (i + 1) % EXTRA_PIGMENTS.length;
    used.add(i);
    taken.set(id, EXTRA_PIGMENTS[i]);
    if (used.size === EXTRA_PIGMENTS.length) used.clear(); // 超过色数则回绕重用
  }
  return taken;
}

// 活动没写 type(缺失/空)时的归属:必须有一个落点, 否则统计算它有痕、图上却查不到分类,
// 那天会静默留白 —— 图与数字打架。统一归到这一类, 渲染与统计都认它。
export const UNTYPED = '(未分类)';
export const typeOf = (a) => { const t = a && a.type; return t == null || t === '' ? UNTYPED : t; };

const TITLES = {
  design:   ['封面稿', '排版', '组件', '海报', '配色'],
  writing:  ['随笔', '文案', '章节', '注释'],
  research: ['取样', '测色', '读碑', '分析'],
  build:    ['搭架', '管线', '导出', '修复'],
  publish:  ['发布', '上线', '出版', '展出'],
};

// 每月「密度 + 主类型」——编出一条有起伏的 CO 活动年
const MONTH_PLAN = [
  { dens: 0.50, type: 'research' }, { dens: 0.55, type: 'design' },  { dens: 0.90, type: 'design' },
  { dens: 0.62, type: 'writing' },  { dens: 0.70, type: 'writing' }, { dens: 0.35, type: 'research' },
  { dens: 0.60, type: 'build' },    { dens: 0.30, type: 'build' },   { dens: 0.66, type: 'design' },
  { dens: 0.70, type: 'research' }, { dens: 0.82, type: 'publish' }, { dens: 0.42, type: 'writing' },
];
// 固定里程碑(出版级)
const MILESTONES = [
  { m: 1, d: 14, title: '年度展出' },
  { m: 4, d: 1,  title: '新作发布' },
  { m: 7, d: 20, title: '远行随记' },
  { m: 10, d: 25, title: '年终出版' },
];

// 生成占位活动流(确定性, 无随机)
export function sampleActivities(year = 2026) {
  const acts = [];
  let id = 0;
  for (let m = 0; m < 12; m++) {
    const plan = MONTH_PLAN[m];
    const dim = daysInMonth(year, m);
    for (let d = 1; d <= dim; d++) {
      const w = dow(year, m, d);
      const weekend = w === 0 || w === 6;
      // 八月 8–16 远行 → 留白(几乎无 CO 活动), 让"墨迹断一截"讲出离开
      if (m === 7 && d >= 8 && d <= 16) continue;
      const pseudo = ((d * 7 + m * 11) % 10) / 10;
      let n = pseudo < plan.dens ? 1 : 0;
      if (plan.dens > 0.8 && pseudo < 0.7) n = 2; // 冲刺月加码
      if (weekend && plan.dens < 0.8 && pseudo > 0.3) n = 0; // 周末通常轻
      for (let k = 0; k < n; k++) {
        const type = k === 1 ? 'research' : plan.type;
        const weight = 1 + (pseudo < plan.dens * 0.5 ? 1 : 0);
        acts.push({ id: `a${id++}`, date: iso(year, m, d), type, title: TITLES[type][(d + k) % TITLES[type].length], weight });
      }
    }
  }
  // 里程碑活动(出版, 高权重)
  for (const ms of MILESTONES) acts.push({ id: `a${id++}`, date: iso(year, ms.m, ms.d), type: 'publish', title: ms.title, weight: 3, milestone: true });
  return acts;
}

// 借 react-activity-calendar 的数据契约「形状」: 每天 = { date, count, level }
//   · 只借形状, 不引那个库(它是一年一条 GitHub 方格带, 不是我们的 A1 版面)
//   · count —— 当日聚合投入量(∑weight)
//   · level —— 分档强度 ∈ [0, MAX_LEVEL]: 0=留白(没活动) / 1..4=着墨由浅到深
//   · 里程碑(出版)另走朱砂印, 不占 level 通道
export const MAX_LEVEL = 4;

// 三条硬规则(见 docs/数据契约-占位.md):
//   · 留白  —— 当天没活动(count=0) → level 0, 不落格(素纸留白, 讲"没做/远行")
//   · 墨深  —— count>0 → level 1..4, 墨色由浅到深 = 当日投入由少到多
//   · 里程碑 —— 出版(milestone)另走朱砂印通道, 不占 level; 里程碑当天仍可有普通活动着墨
// 分档抗离群值: 小整数投入量直接成档; 投入量跨度大时才线性缩放到 1..MAX_LEVEL。
function levelFor(count, maxW) {
  if (count <= 0) return 0;                                       // 留白
  if (maxW <= MAX_LEVEL) return Math.min(MAX_LEVEL, count);       // 小整数: 投入量即档(1→浅…4→深)
  return Math.max(1, Math.min(MAX_LEVEL, Math.round((count / maxW) * MAX_LEVEL))); // 大跨度: 线性缩放
}

// 按天聚合
export function aggregateByDay(activities) {
  const by = {};
  for (const a of Array.isArray(activities) ? activities : []) {
    if (!a || typeof a.date !== 'string') continue;
    const t = typeOf(a), w = Number(a.weight) || 0;
    const g = (by[a.date] ||= { weight: 0, types: {}, titles: [], milestone: null });
    g.weight += w;
    g.types[t] = (g.types[t] || 0) + w;
    g.titles.push(a.title);
    if (a.milestone) g.milestone = a.title;
  }
  for (const k in by) {
    const g = by[k];
    g.dominant = Object.entries(g.types).sort((x, y) => y[1] - x[1])[0][0];
  }
  return by;
}

// 活动数组 → 每日契约序列 [{ date, count, level, dominant, note, milestone }]
// 这是「进 = CO 活动数据数组 → 出 = 每天强度」建模的落点(契约形状 = react-activity-calendar)
export function toDailySeries(activities, year = 2026) {
  const by = aggregateByDay(activities);
  const maxW = Math.max(1, ...Object.values(by).map((g) => g.weight));
  const series = Object.entries(by).map(([date, g]) => ({
    date, count: g.weight, level: levelFor(g.weight, maxW),
    dominant: g.dominant, note: g.titles[0], milestone: g.milestone,
  }));
  series.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { year, maxWeight: maxW, maxLevel: MAX_LEVEL, series };
}

// 活动 → 渲染视图模型(供 renderRecord / exportPdf 共用)
// level 是唯一的强度真源: level→墨深(intensity), level 0 不落格(留白), 里程碑=朱砂
export function toRecordModel(activities, year = 2026, variant = 'editorial-rubbing') {
  const acts = Array.isArray(activities) ? activities : [];
  const { maxWeight, series } = toDailySeries(acts, year);
  const pal = PALETTES[variant] || PALETTES['editorial-rubbing'];
  const mono = variant === 'tuogu-ink';
  const categories = ACTIVITY_TYPES.map((t) => ({ id: t.id, name: t.name, color: pal[t.id], render: 'fill' }));
  // 数据里出现的未登记类型 → 自动补进分类表(否则渲染查不到分类, 那天会静默留白)
  const known = new Set(categories.map((c) => c.id));
  const unknown = [];
  for (const a of acts) {
    const id = typeOf(a);
    if (known.has(id)) continue;
    known.add(id);
    unknown.push(id);
  }
  const pigments = assignPigments(unknown);
  for (const id of unknown) {
    categories.push({ id, name: String(id), color: mono ? pal.design : pigments.get(id), render: 'fill', extra: true });
  }
  const days = {};
  const milestones = [];
  for (const s of series) {
    if (s.level > 0) days[s.date] = { categoryId: s.dominant, count: s.count, level: s.level, intensity: s.level / MAX_LEVEL, note: s.note };
    if (s.milestone) milestones.push({ date: s.date, label: s.milestone });
  }
  return { year, variant, categories, days, milestones, maxWeight, maxLevel: MAX_LEVEL };
}
