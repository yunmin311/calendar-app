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
  { id: 'publish',  name: '出版' },
  // —— CO 真有的三类(2026-08-21 CO 口径)——
  // 类型本来就是开放的(没登记也能画), 之所以还是登记进来, 只为**定色**:
  // 不登记就走哈希派生色, 实测三类抽到紫 + 苍绿 + 秋香, 紫在暖麦纸上发塑料、
  // 整张图变成紫绿相间, 跟「暖·手作·编辑」的气质对不上。手挑一组矿物色更稳。
  { id: '收灵感', name: '收灵感' },
  { id: '分析',   name: '分析' },
  { id: '整理',   name: '整理' },
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
    publish: SEAL,       // 朱砂
    // CO 三类定色 —— 取意也取真值:
    //   收灵感=花青(从外面收进来的东西, 冷一点)· 分析=赭石(案头拆解, 暖褐)
    //   整理=石绿(归置收束, 沉静)。三色同属矿物家族, 彼此拉得开, 落暖麦纸不跳。
    收灵感: '#6f8ea0', 分析: '#b5794f', 整理: '#86a07e',
  },
  // A 全拓: 单色墨(类型不着色, 只用墨深浅)
  'tuogu-ink': {
    design: '#211b14', writing: '#211b14', research: '#211b14', build: '#211b14', publish: SEAL,
    收灵感: '#211b14', 分析: '#211b14', 整理: '#211b14',
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
export function assignPigments(ids) {
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

// 投入量的唯一取值口径:非数字算 0, 负数算 0。
// 负数若原样带进统计, 会出现"总投入 5.6、分类合计 0.6"这种自相矛盾(第一版就这样),
// 而画面上它本来就画不出来(level 0)。渲染与统计都必须走这一个函数。
export const weightOf = (a) => { const n = Number(a && a.weight); return Number.isFinite(n) ? Math.max(0, n) : 0; };

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
//   · 墨深  —— count>0 → level 1..4, 墨色由浅到深 = 当日**相对**投入(见下)
//   · 里程碑 —— milestone 另走朱砂印通道, 不占 level; 里程碑当天仍可有普通活动着墨
//
// 分档按**分布**切, 不按最大值缩放。
// 原来是 count/maxWeight 线性缩放, 一个离群日就把所有典型日压到最浅那档 ——
// CO 口径实测(weight=当天条目数): 全年最忙那天 20 条时, 177 个有痕天里 174 天落在 L1,
// 整张图几乎一个色, "留痕"的深浅就没了。改成按有痕天的分位数切 4 档:
// 不管有没有离群值, 四档都用得上, 深浅始终读得出。
//
// 代价(要写进契约): 墨深表达的是"这天比别天忙不忙", 不是绝对量。
// 绝对量在统计与简报里说(count / weight.sum), 那才是该说数字的地方。
//
// @param {number[]} counts 有痕天的 count 列表(未排序)
// @returns {number[]} 三个阈值 [t1,t2,t3]: count<=t1→L1, <=t2→L2, <=t3→L3, 否则 L4
export function levelThresholds(counts) {
  const xs = counts.filter((n) => n > 0).sort((a, b) => a - b);
  if (!xs.length) return [0, 0, 0];
  const distinct = [...new Set(xs)];
  // 取值种类少于等于档数时, 直接按序位分档 —— 保住"1 条最浅、2 条深一点"的直觉,
  // 也避免分位数在只有两三种取值时把相同的数切到不同档去。
  if (distinct.length <= MAX_LEVEL) {
    const t = [...distinct];
    while (t.length < MAX_LEVEL) t.push(t[t.length - 1]);
    return [t[0], t[1], t[2]];
  }
  // 在"不同取值"的边界上找三刀, 让四档的**天数**尽量接近各占四分之一。
  // (直接取分位数会在取值集中时把两刀切到同一个值上, 白白空掉一档;
  //  直接按取值均匀切又不看天数分布, 可能一档吃掉 8 成的天。)
  // 相同的 count 永远同档 —— 切点只落在取值边界上, 这条不能破。
  const cum = [];
  let acc = 0;
  for (const v of distinct) { acc += xs.filter((n) => n === v).length; cum.push({ v, acc }); }
  const cuts = [];
  let start = 0;
  for (let i = 1; i <= MAX_LEVEL - 1; i++) {
    const target = (xs.length * i) / MAX_LEVEL;
    const last = cum.length - 2;               // 最后一个取值不能当切点, 否则 L4 空
    let best = Math.min(start, last), bestD = Infinity;
    for (let j = start; j <= last; j++) {
      const d = Math.abs(cum[j].acc - target);
      if (d < bestD) { bestD = d; best = j; }
    }
    cuts.push(cum[best].v);
    start = Math.min(best + 1, last);
  }
  return cuts;
}

function levelFor(count, thresholds) {
  if (count <= 0) return 0;                       // 留白
  const [t1, t2, t3] = thresholds;
  if (count <= t1) return 1;
  if (count <= t2) return 2;
  if (count <= t3) return 3;
  return MAX_LEVEL;
}

// 日期校验:必须是 'YYYY-MM-DD', 且是真实存在的一天(2026-02-30 不算)。
// 不校验的话, 非法日期会一路穿下去 —— 统计把它的投入算进总数, 图上却永远没有那一格
// (键对不上 iso()), 于是"图与数字打架"; 更糟的是 '2026-13-45' 会让按月统计的下标越界直接抛。
export function parseDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo - 1)) return null;
  return { y, m: mo - 1, d };
}

/**
 * 分拣活动:留下"这一年的、日期合法的", 其余分开计数。
 * 渲染与统计**共用这一个入口**, 它们才不可能对不上账(这是本组件的核心不变式)。
 * @returns {{ kept: Array, invalidDate: number, otherYear: number, malformed: number }}
 */
export function partitionActivities(activities, year = 2026) {
  const out = { kept: [], invalidDate: 0, otherYear: 0, malformed: 0 };
  const y = Number(year);
  for (const a of Array.isArray(activities) ? activities : []) {
    if (!a || typeof a !== 'object') { out.malformed++; continue; }
    const p = parseDate(a.date);
    if (!p) { out.invalidDate++; continue; }
    if (p.y !== y) { out.otherYear++; continue; }
    out.kept.push(a);
  }
  return out;
}

// 按天聚合(只吃已分拣过的活动;单独调用时也会跳过日期非法的)
export function aggregateByDay(activities) {
  const by = {};
  for (const a of Array.isArray(activities) ? activities : []) {
    if (!a || !parseDate(a.date)) continue;
    const t = typeOf(a), w = weightOf(a);
    const g = (by[a.date] ||= { weight: 0, types: {}, titles: [], milestone: null, hasMilestone: false });
    g.weight += w;
    g.types[t] = (g.types[t] || 0) + w;
    if (a.title) g.titles.push(a.title);
    // 有没有里程碑, 与它叫什么, 是两回事 —— 原来靠 title 真假判断, 标题为空的里程碑会整个消失。
    if (a.milestone) { g.hasMilestone = true; if (a.title && !g.milestone) g.milestone = a.title; }
  }
  for (const k in by) {
    const g = by[k];
    // 平手时按类型名排序定胜负 —— 否则同一份数据换个数组顺序就换个颜色, 组件的确定性就没了。
    g.dominant = Object.entries(g.types).sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))[0][0];
  }
  return by;
}

// 活动数组 → 每日契约序列 [{ date, count, level, dominant, note, milestone }]
// 这是「进 = CO 活动数据数组 → 出 = 每天强度」建模的落点(契约形状 = react-activity-calendar)
export function toDailySeries(activities, yearIn = 2026) {
  // 年份一律规整成数字:传字符串 '2026' 时, 下游那些 `y !== year` 的比较会全部落空 ——
  // 实测后果是整年图上**所有朱砂印消失**, 统计却照样说有 4 个(又一处图与数字打架)。
  const year = Number(yearIn) || 2026;
  // 先分拣再聚合:别年的数据既不该落格, 也**不该参与 maxWeight**——否则去年一条超大投入
  // 会把今年的墨深整体压平(实测 1,2,3 会塌成 1,1,1), 是一种看不见的数据损坏。
  const part = partitionActivities(activities, year);
  const by = aggregateByDay(part.kept);
  const counts = Object.values(by).map((g) => g.weight);
  const maxW = Math.max(1, ...counts);
  const th = levelThresholds(counts);   // 按分布切档, 不按最大值缩放(见 levelThresholds)
  const series = Object.entries(by).map(([date, g]) => ({
    date, count: g.weight, level: levelFor(g.weight, th),
    dominant: g.dominant, note: g.titles[0], milestone: g.milestone, hasMilestone: g.hasMilestone,
  }));
  series.sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    year, maxWeight: maxW, maxLevel: MAX_LEVEL, series,
    kept: part.kept,
    dropped: { invalidDate: part.invalidDate, otherYear: part.otherYear, malformed: part.malformed },
  };
}

// 活动 → 渲染视图模型(供 renderRecord / exportPdf 共用)
// level 是唯一的强度真源: level→墨深(intensity), level 0 不落格(留白), 里程碑=朱砂
export function toRecordModel(activities, yearIn = 2026, variant = 'editorial-rubbing') {
  const { maxWeight, series, kept: acts, dropped, year } = toDailySeries(activities, yearIn);
  // variant 可以是预置名, 也可以是设计方给的一份皮肤对象(自带 palette / mono)——
  // 这样换一副样子不用改代码, 见 poster/renderRecord.js 的 resolveVariant 与 docs/可换参数清单.md
  const skin = variant && typeof variant === 'object' ? variant : null;
  const pal = (skin && skin.palette) || PALETTES[variant] || PALETTES['editorial-rubbing'];
  const mono = skin ? !!skin.mono : variant === 'tuogu-ink';
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
    // 有里程碑就进朱砂通道, 哪怕没写标题(只画印、不写签)
    if (s.hasMilestone) milestones.push({ date: s.date, label: s.milestone || '' });
  }
  // dropped 带在模型上, 调用方(如 CO)想提示"有 N 条日期不合法/不在本年"时有据可查, 不做静默
  return { year, variant, categories, days, milestones, maxWeight, maxLevel: MAX_LEVEL, dropped };
}
