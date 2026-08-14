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

// 变体调色: 同一份活动数据 → 两种皮肤取不同色
export const PALETTES = {
  // B 暖·编辑+拓质: 暖色分类(沿用方向②)
  'editorial-rubbing': {
    design: '#e3d3c4', writing: '#e8dcc0', research: '#dce6e2', build: '#dde3d2', publish: '#9e3b32',
  },
  // A 全拓: 单色墨(类型不着色, 只用墨深浅), 出版=朱砂
  'tuogu-ink': {
    design: '#211b14', writing: '#211b14', research: '#211b14', build: '#211b14', publish: '#9e3b32',
  },
};

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

// 按天聚合
export function aggregateByDay(activities) {
  const by = {};
  for (const a of activities) {
    const g = (by[a.date] ||= { weight: 0, types: {}, titles: [], milestone: null });
    g.weight += a.weight;
    g.types[a.type] = (g.types[a.type] || 0) + a.weight;
    g.titles.push(a.title);
    if (a.milestone) g.milestone = a.title;
  }
  for (const k in by) {
    const g = by[k];
    g.dominant = Object.entries(g.types).sort((x, y) => y[1] - x[1])[0][0];
  }
  return by;
}

// 活动 → 渲染视图模型(供 renderRecord / exportPdf 共用)
export function toRecordModel(activities, year = 2026, variant = 'editorial-rubbing') {
  const by = aggregateByDay(activities);
  const pal = PALETTES[variant] || PALETTES['editorial-rubbing'];
  const maxW = Math.max(1, ...Object.values(by).map((g) => g.weight));
  const categories = ACTIVITY_TYPES.map((t) => ({ id: t.id, name: t.name, color: pal[t.id], render: 'fill' }));
  const days = {};
  const milestones = [];
  for (const [date, g] of Object.entries(by)) {
    days[date] = { categoryId: g.dominant, intensity: g.weight / maxW, note: g.titles[0] };
    if (g.milestone) milestones.push({ date, label: g.milestone });
  }
  return { year, variant, categories, days, milestones, maxWeight: maxW };
}
