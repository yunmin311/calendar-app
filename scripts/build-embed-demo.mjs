// 可嵌入小件演示 —— 把活动带/统计卡塞进典型宿主(仪表盘、侧栏、行内),
// 同页放很多个, 验"无限次复用"不是口号。
// 用法: node scripts/build-embed-demo.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRecord, TEXTURE_PRESETS } from '../src/record/index.js';
import { sampleActivities } from '../src/data/activity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'design', '2026-08-19-texture-module');
mkdirSync(outDir, { recursive: true });

const acts = sampleActivities(2026);
const rec = createRecord(acts, { year: 2026 });
const s = rec.stats();

// 「多人」示意: 给同一批活动补上 actor 字段(占位契约不含此字段, 有就能按人分)
const NAMES = ['阿一', '阿二', '阿三'];
const team = acts.map((a, i) => ({ ...a, actor: NAMES[i % NAMES.length] }));
const teamRec = createRecord(team, { year: 2026 });
const groups = teamRec.stats({ groupBy: 'actor' }).groups;

const perPerson = groups.map((g) => {
  const sub = createRecord(team.filter((a) => a.actor === g.key), { year: 2026 });
  return `<div class="cell">
    <div class="who">${g.key} <b>${g.days} 天 · 投入 ${g.weight}</b></div>
    ${sub.stripSVG({ cell: 2.6, months: false })}
  </div>`;
}).join('');

const quarters = [[0, 2, '一季度'], [3, 5, '二季度'], [6, 8, '三季度'], [9, 11, '四季度']]
  .map(([a, b, n]) => `<div class="cell"><div class="who">${n}</div>${rec.stripSVG({ from: a, to: b, cell: 3.2, months: false })}</div>`).join('');

const texRow = TEXTURE_PRESETS.map((p) => `<div class="cell"><div class="who">${p.label} <code>${p.name}</code></div>${rec.statCardSVG({ texture: p.name, width: 105, metrics: ['activeDays', 'weight', 'streak'] })}</div>`).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>可嵌入小件 · 演示</title>
<style>:root{--ink:#241a0c;--soft:#6c5a3a;--line:#cbb992}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#e6ddcb;color:var(--ink);font-family:"Helvetica Neue",Arial,"Microsoft YaHei",sans-serif;padding:5vh 4vw;line-height:1.6}
h1{font-size:27px}h2{font-size:17px;margin:30px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.sub{color:var(--soft);font-size:13.5px;margin:6px 0 2px}
.grid{display:grid;gap:14px}.g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.cell{background:#fbf6ea;border:1px solid var(--line);padding:12px}
.who{font-size:12.5px;color:var(--soft);margin-bottom:7px}.who b{color:var(--ink)}.who code{color:#9e3b32;font-size:11px}
.side{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:16px;align-items:start}
.main{background:#fbf6ea;border:1px solid var(--line);padding:18px;min-height:210px}
.main p{font-size:13.5px;color:var(--soft);margin-top:8px}
.rail{display:grid;gap:12px}
.inline{font-size:14px;background:#fbf6ea;border:1px solid var(--line);padding:14px}
.inline .w{display:inline-block;width:210px;vertical-align:middle;margin:0 6px}
svg{display:block}
.note{margin-top:26px;font-size:12.5px;color:var(--soft);border-top:1px solid var(--line);padding-top:12px}
code{font-family:ui-monospace,Menlo,monospace}</style></head><body>
<h1>可嵌入小件 · 演示</h1>
<div class="sub">同一个组件, 塞进不同宿主、不同尺寸、不同质感。<b>本页一共放了 ${4 + groups.length + TEXTURE_PRESETS.length + 3} 个实例</b> —— 滤镜 id 按内容派生, 互不撞车。</div>
<div class="sub">全部 <code>width="100%"</code> + viewBox, 由容器定尺寸, 没写死像素。</div>

<h2>① 仪表盘:统计卡 + 整年活动带</h2>
<div class="grid g2">
  <div class="cell"><div class="who">统计卡(默认宽 120mm)</div>${rec.statCardSVG()}</div>
  <div class="cell"><div class="who">整年活动带</div>${rec.stripSVG({ weekdays: true })}</div>
</div>

<h2>② 侧栏:窄卡 + 竖排</h2>
<div class="side">
  <div class="main"><b>宿主页面内容</b><p>小件不假设自己占满一页 —— 它只吐一段 SVG, 放哪儿由宿主决定。右侧栏 260px 宽, 卡片自适应缩到位。</p>
  <p>${'活动带也能内联在正文里 ↓'}</p>
  <div style="max-width:420px;margin-top:10px">${rec.stripSVG({ from: 0, to: 5, cell: 2.8, months: false })}</div></div>
  <div class="rail">
    <div class="cell"><div class="who">窄统计卡 90mm</div>${rec.statCardSVG({ width: 90, metrics: ['activeDays', 'weight'], texture: 'handdrawn' })}</div>
    <div class="cell"><div class="who">近三月</div>${rec.stripSVG({ from: 9, to: 11, cell: 3, texture: 'tiedye' })}</div>
  </div>
</div>

<h2>③ 分季度:同组件不同区间</h2>
<div class="grid g4">${quarters}</div>

<h2>④「多人」:按 actor 分组各出一条(占位契约不含此字段, 有就能分)</h2>
<div class="sub">统计层的 <code>groupBy</code> 支持按活动上的任意字段分组; 这里给示例数据补了 <code>actor</code>。</div>
<div class="grid g2">${perPerson}</div>

<h2>⑤ 四质感 × 统计卡</h2>
<div class="grid g4">${texRow}</div>

<h2>⑥ 行内:一句话 + 一条带</h2>
<div class="inline">今年到目前为止<span class="w">${rec.stripSVG({ from: 0, to: 4, cell: 1.9, gap: 0.35, months: false, pad: 1.5 })}</span>这样, ${s.days.active} 天有痕。</div>

<div class="note">调用: <code>createRecord(acts, {year:2026}).stripSVG({from:0,to:2,cell:3})</code> · <code>.statCardSVG({width:90,texture:'handdrawn'})</code> · <code>.stats({groupBy:'actor'})</code></div>
</body></html>`;

const file = join(outDir, '01-可嵌入小件演示.html');
writeFileSync(file, html, 'utf8');
console.log('WROTE', file);
