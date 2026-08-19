// 手工质感样品册 —— 四预设 × (整年长条 / 单月卡) 对照, 双击即看。
// 用法: node scripts/build-texture-gallery.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRecord, TEXTURE_PRESETS } from '../src/record/index.js';
import { sampleActivities } from '../src/data/activity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'design', '2026-08-19-texture-module');
mkdirSync(outDir, { recursive: true });

const rec = createRecord(sampleActivities(2026), { year: 2026 });
const NOTE = {
  rubbing: '斑驳正片叠底 + 剥蚀白飞点。本项目原味(此前飞白因黑色叠 screen 恒不可见, 本轮修成白色)。',
  tiedye: '靛/茜/苍绿三处染心晕开, 再被湍流揉皱 + 折痕同心环 —— 手工皱染。',
  handdrawn: '细颗粒铅笔底 + 方向性排线, 都走正片叠底 —— 像画在速写本上。',
  topographic: '噪声阈值化切成等高线, 同心纹如地形图。',
};

const cards = TEXTURE_PRESETS.map((p) => `
<section class="s">
  <div class="h"><b>${p.label}</b><code>${p.name}</code><span>${NOTE[p.name] || ''}</span></div>
  <div class="row">
    <div class="year">${rec.yearSVG({ texture: p.name })}</div>
    <div class="month">${rec.monthSVG(2, { texture: p.name })}</div>
  </div>
</section>`).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>手工质感模块 · 四预设样品册</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{background:#e6ddcb;color:#241a0c;font-family:"Helvetica Neue",Arial,"Microsoft YaHei",sans-serif;padding:5vh 4vw;line-height:1.6}
h1{font-size:28px}.sub{color:#6c5a3a;font-size:14px;margin:6px 0 4px}
.s{margin-top:34px}.h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:10px;border-bottom:1px solid #cbb992;padding-bottom:7px}
.h b{font-size:19px}.h code{font:12px/1 ui-monospace,Menlo,monospace;color:#9e3b32}
.h span{font-size:13px;color:#6c5a3a}
.row{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr);gap:16px;align-items:start}
.year,.month{background:#fff;box-shadow:0 10px 26px rgba(40,26,8,.2);overflow:hidden}
.year svg,.month svg{display:block;width:100%;height:auto}
.note{margin-top:30px;font-size:13px;color:#6c5a3a;border-top:1px solid #cbb992;padding-top:12px}
@media(max-width:900px){.row{grid-template-columns:1fr}}</style></head><body>
<h1>手工质感模块 · 四预设样品册</h1>
<div class="sub">同一份活动数据 + 同一套版面, 只换质感预设。左=整年长条(A1) · 右=单月卡(210×280mm)。</div>
<div class="sub">质感定义在 <code>src/texture/index.js</code>, 每个参数都可改; 屏幕预览与印刷栅格化共用同一份定义。</div>
${cards}
<div class="note">用法: <code>rec.yearSVG({ texture: 'tiedye' })</code> 或 <code>rec.yearSVG({ texture: { name:'tiedye', warp: 24, opacity: .35 } })</code> —— 预设名直接换皮, 对象形式可逐参微调。</div>
</body></html>`;

const file = join(outDir, '00-质感样品册.html');
writeFileSync(file, html, 'utf8');
console.log('WROTE', file);
