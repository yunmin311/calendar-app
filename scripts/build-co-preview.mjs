// CO 口径预览 —— 用 CO 真给的映射(weight=当天条目数 · 三类收灵感/分析/整理 · 里程碑恒 false)
// 把六个出口一次摆出来, 眼看三色搭不搭、零里程碑的版面成不成立、墨深有没有塌成一档。
// 用法: node scripts/build-co-preview.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRecord } from '../src/record/index.js';
import { sampleCOActivities, CO_TYPES } from '../src/data/sample-co.js';
import { PALETTES } from '../src/data/activity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'design', '2026-08-21-co-semantics');
mkdirSync(outDir, { recursive: true });

const acts = sampleCOActivities(2026);
const rec = createRecord(acts, { year: 2026 });
// 备选:同一份数据、同一套纸色, 只把 mono 打开(分类色全撤, 只剩墨深)
const mono = createRecord(acts, { year: 2026, variant: { mono: true } });
const s = rec.stats();
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pal = PALETTES['editorial-rubbing'];
const chips = CO_TYPES.map((t) => `<span class="chip"><i style="background:${pal[t]}"></i>${t} <code>${pal[t]}</code></span>`).join('');
const buckets = s.levels ? s.levels.map((n, i) => `L${i}:${n}`).join(' · ') : '';

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>CO 口径预览 · 六个出口</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{background:#cabfa6;color:#20201b;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;padding:4vh 3vw 10vh;line-height:1.7}
.wrap{max-width:1180px;margin:0 auto}
h1{font-size:24px;font-weight:normal;letter-spacing:.06em}
.sub{font-size:13px;color:#4a4030;margin-top:6px}
.meta{margin:16px 0 26px;padding:14px 16px;background:#f4efe3;font-size:13px}
.meta b{font-weight:normal;color:#9e3b32}
.chip{display:inline-block;margin-right:14px;font-size:13px}
.chip i{display:inline-block;width:11px;height:11px;margin-right:5px;vertical-align:-1px}
.chip code{color:#8c8371;font-size:11px}
h2{font-size:15px;font-weight:normal;letter-spacing:.08em;margin:30px 0 10px;color:#3a2f1a}
.paper{background:#f4efe3;padding:14px;box-shadow:0 1.6vh 3vh rgba(40,26,8,.26)}
.paper svg{display:block;width:100%;height:auto}
.row{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}
.month{width:min(340px,40vw)}
.small{width:280px}
pre{background:#f4efe3;padding:16px 18px;font-family:Consolas,Menlo,"Microsoft YaHei",monospace;font-size:12.5px;line-height:1.9;white-space:pre-wrap}
</style></head><body><div class="wrap">
<h1>CO 口径预览 · 同一份数据走完六个出口</h1>
<p class="sub">weight = 当天条目数(不是工时) · type = 收灵感 / 分析 / 整理 · milestone 恒 false · 单年</p>
<div class="meta">
  <p>三类定色(矿物色, 手挑;派生色抽到的紫在暖麦纸上发塑料):&nbsp; ${chips}</p>
  <p style="margin-top:8px">有痕 <b>${s.days.active}</b> 天 / 留白 ${s.days.blank} 天 · 总条目 <b>${s.weight.sum}</b> ·
  最忙一天 ${s.busiest ? s.busiest.date + ' ' + s.busiest.count + ' 条' : '—'} · 里程碑 <b>${s.milestones.length}</b> 个(CO 场景恒为 0)
  ${buckets ? ' · 墨深分档 ' + buckets : ''}</p>
</div>

<h2>① 整年长条(A1)</h2>
<div class="paper">${rec.yearSVG()}</div>

<h2>② 单月卡 · 三月 &nbsp;/&nbsp; ③ 可嵌小件(活动带 / 统计卡 / 分组横条)</h2>
<div class="row">
  <div class="paper month">${rec.monthSVG(2)}</div>
  <div class="row" style="flex:1;min-width:300px">
    <div class="paper small">${rec.stripSVG({ from: 0, to: 2 })}</div>
    <div class="paper small">${rec.statCardSVG()}</div>
    <div class="paper small">${rec.groupBarsSVG()}</div>
  </div>
</div>

<h2>④ 文字简报(可直接粘进对话)</h2>
<pre>${esc(rec.report())}</pre>

<h2>⑤ 同一份数据的单色墨版 —— 给设计方的备选</h2>
<p class="sub" style="margin-bottom:10px">CO 场景下有痕天数占全年一半, 三色铺开整页偏花。
若 CO 主视觉更冷静, 换 <code>mono</code> 这一个参数就成下面这样:分类色全撤, 只剩墨深说话。不改代码。</p>
<div class="paper">${mono.yearSVG()}</div>
</div></body></html>`;

// 自检: 页面里不许出现 undefined/NaN —— 取错字段名就是这么漏出去的(本页第一版把
// busiest.count 写成了 busiest.weight, 页上白纸黑字印着"undefined 条")
for (const bad of ['undefined', 'NaN', '[object Object]']) {
  if (html.includes(bad)) { console.log('页面里出现了', bad); process.exit(1); }
}

const out = join(outDir, 'co-preview.html');
writeFileSync(out, html, 'utf8');
console.log('WROTE', out);
console.log('三类色:', CO_TYPES.map((t) => `${t}=${pal[t]}`).join(' '), '· 里程碑', s.milestones.length, '· 有痕', s.days.active);
