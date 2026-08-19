// 类型开放性自测 —— 组件号称"任何需要统计的地方都能复用", 那就必须能吃自带 5 个
// CO 类型以外的活动类型(会议/复盘/客服…), 且**图与统计数字不许打架**。
// 用法: node scripts/test-open-types.mjs
import { toRecordModel, ACTIVITY_TYPES } from '../src/data/activity.js';
import { computeStats } from '../src/data/stats.js';
import { createRecord } from '../src/record/index.js';
import { renderRecord } from '../src/poster/renderRecord.js';
import { renderMonth } from '../src/poster/renderMonth.js';
import { renderStrip } from '../src/embed/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };
const A = (date, type, weight = 1, extra = {}) => ({ id: date + type, date, type, title: type, weight, ...extra });

// 一份"多人对话秘书"味的数据: 类型全是 CO 5 类之外的
const foreign = [
  A('2026-01-05', 'meeting', 2), A('2026-01-06', 'design', 2),
  A('2026-01-07', '复盘', 3), A('2026-02-10', 'support', 1),
  A('2026-02-11', 'meeting', 1), A('2026-03-01', '客服', 2, { milestone: true }),
];

console.log('\n[1] 核心不变式:凡统计算作"有痕"的天, 图上必须有对应分类(不许静默留白)');
const rec = createRecord(foreign, { year: 2026 });
const st = rec.stats();
const catIds = new Set(rec.model.categories.map((c) => c.id));
const missing = Object.entries(rec.model.days).filter(([, d]) => !catIds.has(d.categoryId)).map(([k]) => k);
ok('没有一天的分类查不到', missing.length === 0, missing);
ok('统计有痕天数 = 渲染落格天数', st.days.active === Object.keys(rec.model.days).length, [st.days.active, Object.keys(rec.model.days).length]);
ok('统计里的类型都在分类表里', st.byType.every((t) => catIds.has(t.id)), st.byType.map((t) => t.id));

console.log('\n[2] 未登记类型自动补进分类表');
const extras = rec.model.categories.filter((c) => c.extra);
ok('补出 4 个未登记类型', extras.length === 4, extras.map((c) => c.id));
ok('自带 5 类原样保留', ACTIVITY_TYPES.every((t) => rec.model.categories.some((c) => c.id === t.id && !c.extra)));
ok('每个补出来的都有颜色', extras.every((c) => /^#[0-9a-f]{6}$/i.test(c.color)), extras.map((c) => c.color));
ok('中文类型名也能补(不是只认 ascii)', extras.some((c) => c.id === '复盘'));

console.log('\n[3] 配色: 同一批类型名 → 同一套颜色, 且这批里互不重复');
// 按类型名排序后比对(键的插入顺序无所谓, 颜色映射一致才是要保的)
const mapOf = (acts) => createRecord(acts, { year: 2026 }).model.categories
  .filter((c) => c.extra).map((c) => `${c.id}=${c.color}`).sort().join('|');
ok('与出现顺序无关', mapOf(foreign) === mapOf([...foreign].reverse()), [mapOf(foreign), mapOf([...foreign].reverse())]);
ok('与同一类型出现几次无关', mapOf(foreign) === mapOf([...foreign, A('2026-04-01', 'meeting', 1), A('2026-04-02', '复盘', 1)]));
ok('这批里颜色互不重复', new Set(extras.map((c) => c.color)).size === extras.length, extras.map((c) => `${c.id}=${c.color}`));
ok('不与自带 5 类的矿物色撞', (() => {
  const base = new Set(rec.model.categories.filter((c) => !c.extra).map((c) => c.color));
  return extras.every((c) => !base.has(c.color));
})(), extras.map((c) => c.color));

console.log('\n[4] 四种渲染都真把这些天画出来了');
const y = renderRecord(rec.model, {});
const m = renderMonth(rec.model, 0, {});
const strip = renderStrip(rec.model, {});
for (const [name, svg] of [['整年长条', y], ['单月卡', m], ['活动带', strip]]) {
  const used = extras.filter((c) => svg.includes(c.color)).length;
  ok(`${name} 用上了补出来的分类色`, used > 0, used);
  ok(`${name} 无 NaN/undefined`, !/NaN|undefined/.test(svg));
}
ok('一月 3 天有痕都落格(1/5 meeting、1/6 design、1/7 复盘)', (() => {
  const janDays = Object.keys(rec.model.days).filter((d) => d.startsWith('2026-01'));
  return janDays.length === 3 && janDays.every((d) => catIds.has(rec.model.days[d].categoryId));
})(), Object.keys(rec.model.days).filter((d) => d.startsWith('2026-01')));

console.log('\n[5] A 全拓变体: 未登记类型也走墨色, 不冒出彩色');
const monoRec = createRecord(foreign, { year: 2026, variant: 'tuogu-ink' });
const monoExtras = monoRec.model.categories.filter((c) => c.extra);
ok('全拓下补出来的都是墨色', monoExtras.every((c) => c.color === '#211b14'), monoExtras.map((c) => c.color));

console.log('\n[6] 分类很多时图例不冲出版面');
const many = Array.from({ length: 60 }, (_, i) => A(`2026-06-${String((i % 30) + 1).padStart(2, '0')}`, `业务类型${i}`, 1));
const manyModel = toRecordModel(many, 2026);
const wide = renderRecord(manyModel, {});
ok('确实喂进了 60 个类型', manyModel.categories.filter((c) => c.extra).length === 60, manyModel.categories.filter((c) => c.extra).length);
ok('图例被截断而不是画到版面外', wide.includes('…'));
ok('60 类也无 NaN/undefined', !/NaN|undefined/.test(wide));
ok('单月卡同样有截断保护', renderMonth(manyModel, 5, {}).includes('…'));

console.log('\n[7] 脏数据: 没写 type 的活动归「(未分类)」, 照样落格照样进统计');
const dirty = [A('2026-01-01', '', 1), A('2026-01-02', null, 1), { id: 'x', date: '2026-01-03', weight: 1 }, A('2026-01-04', 'meeting', 1)];
const dm = toRecordModel(dirty, 2026);
const ds = computeStats(dirty, { year: 2026 });
ok('不会补出空串/null 分类', dm.categories.every((c) => c.id != null && c.id !== ''), dm.categories.map((c) => c.id));
ok('补出「(未分类)」这一类', dm.categories.some((c) => c.id === '(未分类)'));
ok('三条无 type 的活动都落了格', Object.keys(dm.days).length === 4, Object.keys(dm.days));
ok('统计里的类型都能在分类表查到(图与数字不打架)', ds.byType.every((t) => dm.categories.some((c) => c.id === t.id)), ds.byType.map((t) => t.id));
ok('统计有痕天数 = 落格天数', ds.days.active === Object.keys(dm.days).length, [ds.days.active, Object.keys(dm.days).length]);
ok('正常类型仍补进来', dm.categories.some((c) => c.id === 'meeting'));
ok('脏数据下渲染不崩', renderRecord(dm, {}).includes('<svg') && !/NaN|undefined/.test(renderRecord(dm, {})));

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
