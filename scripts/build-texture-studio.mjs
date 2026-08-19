// 质感调参台 —— 生成一个自足的单文件 HTML:双击就能开,拖滑块实时看质感,
// 调好了把配置抄走贴进代码。给设计师用的,不需要 npm、不需要起服务。
//
// 做法:把 src/texture/index.js 的源码内联进页面(它本身零依赖),
// 组件用 texture:'none' 预渲染成干净底图, 质感作为独立图层实时叠在上面 ——
// 与运行时的合成方式一致(同样是 multiply/screen 覆盖层), 所见即所得。
// 用法: node scripts/build-texture-studio.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRecord } from '../src/record/index.js';
import { sampleActivities } from '../src/data/activity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'design', '2026-08-19-texture-module');
mkdirSync(outDir, { recursive: true });

// 内联质感模块源码(零依赖, 去掉 export 关键字即可当普通脚本跑)
const texSrc = readFileSync(join(__dirname, '..', 'src', 'texture', 'index.js'), 'utf8')
  .replace(/^export (const|function) /gm, '$1 ');

const rec = createRecord(sampleActivities(2026), { year: 2026 });
// 三种载体, 都用 none 预渲染 → 干净底图, 质感由页面实时叠加
// freqMul 必须照抄各渲染函数里写的那个数(renderStatCard 4.2 / renderStrip 3.4 /
// renderMonth 2.2 / renderRecord 1), 不能在页面里另算一个 —— 否则预览和真组件对不上。
const stages = {
  card: { label: '统计卡', freqMul: 4.2, svg: rec.statCardSVG({ texture: 'none', width: 120 }) },
  strip: { label: '活动带', freqMul: 3.4, svg: rec.stripSVG({ texture: 'none', cell: 3, weekdays: true }) },
  year: { label: '整年长条 A1', freqMul: 1, svg: rec.yearSVG({ texture: 'none' }) },
  month: { label: '单月卡', freqMul: 2.2, svg: rec.monthSVG(2, { texture: 'none' }) },
};
// 构建期校验:上面抄的 freqMul 必须与渲染函数里真正写的一致, 否则调参台就成了骗人的
// (改了一边忘了另一边的话, 这里直接炸, 不让一张对不上的页面生成出去)。
const SRC = { card: 'src/embed/index.js', strip: 'src/embed/index.js', month: 'src/poster/renderMonth.js', year: 'src/poster/renderRecord.js' };
for (const [k, rel] of Object.entries(SRC)) {
  const src = readFileSync(join(__dirname, '..', rel), 'utf8');
  const want = stages[k].freqMul;
  const found = want === 1 ? !/freqMul/.test(src) : src.includes(`freqMul: ${want}`);
  if (!found) throw new Error(`freqMul 对不上: ${k} 期望 ${want}, 但 ${rel} 里没找到 —— 改了渲染函数就同步改这里`);
}

// 取每张底图的 viewBox, 质感层要按同一坐标系铺满
for (const k of Object.keys(stages)) {
  const m = stages[k].svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  stages[k].vw = Number(m[1]); stages[k].vh = Number(m[2]);
}

// 每个可调参数的类型与范围(滑块 / 取色 / 开关)
const SPEC = {
  rubbing: [
    ['mottleFreq', 'range', 0.005, 0.4, 0.005, '斑驳频率(越大越细碎)'],
    ['mottleOp', 'range', 0, 0.6, 0.01, '斑驳浓度'],
    ['speckle', 'bool', 0, 0, 0, '开剥蚀白飞点'],
    ['speckleFreq', 'range', 0.02, 1.2, 0.01, '飞点频率'],
    ['speckleOp', 'range', 0, 0.6, 0.01, '飞点浓度'],
  ],
  tiedye: [
    ['opacity', 'range', 0, 1, 0.01, '总浓度'],
    ['warp', 'range', 0, 60, 1, '揉皱强度'],
    ['warpFreq', 'range', 0.002, 0.12, 0.002, '揉皱频率'],
    ['warpOct', 'range', 1, 4, 1, '揉皱层数'],
    ['seed', 'range', 1, 40, 1, '随机种子(换个纹路)'],
    ['rings', 'bool', 0, 0, 0, '开折痕同心环'],
    ['ringOp', 'range', 0, 1, 0.05, '折痕浓度'],
  ],
  handdrawn: [
    ['grainOp', 'range', 0, 1, 0.02, '颗粒浓度'],
    ['grainK', 'range', 0.8, 3, 0.05, '颗粒阈值斜率'],
    ['grainOff', 'range', -4, -1, 0.05, '颗粒阈值(越负越疏)'],
    ['hatch', 'bool', 0, 0, 0, '开方向性排线'],
    ['hatchOp', 'range', 0, 1, 0.02, '排线浓度'],
    ['hatchK', 'range', 0.8, 3, 0.05, '排线阈值斜率'],
    ['hatchOff', 'range', -4, -1, 0.05, '排线阈值'],
    ['seed', 'range', 1, 40, 1, '随机种子'],
    ['tint', 'color', 0, 0, 0, '颗粒颜色'],
  ],
  topographic: [
    ['freq', 'range', 0.002, 0.12, 0.002, '等高线间距(越大越密)'],
    ['bandCount', 'range', 8, 96, 2, '档数(越多线越细)'],
    ['lineOp', 'range', 0, 1, 0.02, '线浓度'],
    ['oct', 'range', 1, 4, 1, '噪声层数'],
    ['seed', 'range', 1, 40, 1, '随机种子(换个地形)'],
    ['tint', 'color', 0, 0, 0, '线颜色'],
  ],
};

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>质感调参台</title>
<style>:root{--ink:#241a0c;--soft:#6c5a3a;--line:#cbb992;--seal:#9e3b32;--paper:#fbf6ea}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#e6ddcb;color:var(--ink);font-family:"Helvetica Neue",Arial,"Microsoft YaHei",sans-serif;line-height:1.55;padding:26px 3vw 40px}
h1{font-size:24px}.sub{color:var(--soft);font-size:13px;margin:5px 0 16px}
.wrap{display:grid;grid-template-columns:300px minmax(0,1fr);gap:20px;align-items:start}
.panel{background:var(--paper);border:1px solid var(--line);padding:14px;position:sticky;top:18px}
.seg{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
.seg button{font:12px/1 inherit;padding:7px 10px;background:#fff;border:1px solid var(--line);color:var(--soft);cursor:pointer}
.seg button.on{background:var(--ink);border-color:var(--ink);color:#f4efe3}
.row{margin:9px 0}.row label{display:flex;justify-content:space-between;font-size:12px;color:var(--soft);margin-bottom:3px}
.row label b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
input[type=range]{width:100%}input[type=color]{width:100%;height:26px;border:1px solid var(--line);background:none;cursor:pointer}
.chk{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--soft);cursor:pointer}
.stagebox{background:var(--paper);border:1px solid var(--line);padding:16px}
.stage{position:relative;line-height:0;box-shadow:0 8px 24px rgba(40,26,8,.16)}
.stage>svg{display:block;width:100%;height:auto}
.stage .tex{position:absolute;inset:0}.stage .tex svg{display:block;width:100%;height:100%}
.out{margin-top:14px;background:#fff;border:1px solid var(--line);padding:10px;font:12px/1.6 ui-monospace,Menlo,monospace;color:#3a2f1c;white-space:pre-wrap;word-break:break-all}
.hint{font-size:12px;color:var(--soft);margin-top:8px}
button.copy{margin-top:8px;font:12px inherit;padding:6px 12px;background:var(--ink);color:#f4efe3;border:0;cursor:pointer}
</style></head><body>
<h1>质感调参台</h1>
<div class="sub">拖滑块实时看效果 → 调顺眼了把下面那行配置抄走。<b>这个文件自足</b>,不用起服务、不用装东西,双击就能开。</div>
<div class="wrap">
  <div class="panel">
    <div class="seg" id="presets"></div>
    <div class="seg" id="stagesel"></div>
    <div id="params"></div>
    <div class="out" id="out"></div>
    <button class="copy" id="copy">复制配置</button>
    <div class="hint">贴进代码:<br><code>rec.yearSVG({ texture: 配置 })</code></div>
  </div>
  <div class="stagebox">
    <div class="stage" id="stage"></div>
    <div class="hint" id="stagehint"></div>
  </div>
</div>
<script>
${texSrc}
const STAGES = ${JSON.stringify(stages)};
const SPEC = ${JSON.stringify(SPEC)};
const PRESETS = ${JSON.stringify([{ name: 'rubbing', label: '拓质' }, { name: 'tiedye', label: '扎染' }, { name: 'handdrawn', label: '手绘' }, { name: 'topographic', label: '拓扑' }])};

let cur = 'rubbing';
let stageKey = 'card';
let params = { ...TEXTURE_DEFAULTS[cur] };

const el = (id) => document.getElementById(id);

function renderPresets() {
  el('presets').innerHTML = PRESETS.map(p => \`<button data-p="\${p.name}" class="\${p.name === cur ? 'on' : ''}">\${p.label}</button>\`).join('');
  el('presets').onclick = (e) => { const p = e.target.dataset.p; if (!p) return; cur = p; params = { ...TEXTURE_DEFAULTS[p] }; renderAll(); };
  el('stagesel').innerHTML = Object.entries(STAGES).map(([k, s]) => \`<button data-s="\${k}" class="\${k === stageKey ? 'on' : ''}">\${s.label}</button>\`).join('');
  el('stagesel').onclick = (e) => { const s = e.target.dataset.s; if (!s) return; stageKey = s; renderAll(); };
}

function renderParams() {
  el('params').innerHTML = (SPEC[cur] || []).map(([key, kind, min, max, step, label]) => {
    const v = params[key];
    if (kind === 'bool') return \`<div class="row"><label class="chk"><input type="checkbox" data-k="\${key}" \${v ? 'checked' : ''}> \${label}</label></div>\`;
    if (kind === 'color') return \`<div class="row"><label>\${label}<b>\${v}</b></label><input type="color" data-k="\${key}" value="\${v}"></div>\`;
    return \`<div class="row"><label>\${label}<b>\${v}</b></label><input type="range" data-k="\${key}" min="\${min}" max="\${max}" step="\${step}" value="\${v}"></div>\`;
  }).join('');
  el('params').oninput = (e) => {
    const k = e.target.dataset.k; if (!k) return;
    params[k] = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'color' ? e.target.value : Number(e.target.value));
    renderParams(); renderStage(); renderOut();
  };
}

function renderStage() {
  const s = STAGES[stageKey];
  // 用各渲染函数真正在用的那个 freqMul(见构建脚本注释), 保证预览=组件
  const t = resolveTexture({ name: cur, ...params }, {}, { freqMul: s.freqMul });
  const built = t.build(s.vw, s.vh, 'studio');
  el('stage').innerHTML = s.svg
    + \`<div class="tex"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${s.vw} \${s.vh}" preserveAspectRatio="none"><defs>\${built.defs}</defs>\${built.body}</svg></div>\`;
  el('stagehint').textContent = \`载体 \${s.label} · \${s.vw}×\${s.vh}mm · 频率换算 ×\${s.freqMul}(与组件里用的同一个数, 所以预览=成品)\`;
}

function configText() {
  const d = TEXTURE_DEFAULTS[cur];
  const diff = {};
  for (const k of Object.keys(params)) if (JSON.stringify(params[k]) !== JSON.stringify(d[k])) diff[k] = params[k];
  const body = Object.entries(diff).map(([k, v]) => \`\${k}: \${typeof v === 'string' ? \`'\${v}'\` : v}\`).join(', ');
  return Object.keys(diff).length ? \`{ name: '\${cur}', \${body} }\` : \`'\${cur}'\`;
}
function renderOut() { el('out').textContent = configText(); }

el('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(configText()); el('copy').textContent = '已复制'; }
  catch { el('copy').textContent = '复制失败, 手动选中'; }
  setTimeout(() => { el('copy').textContent = '复制配置'; }, 1400);
};

function renderAll() { renderPresets(); renderParams(); renderStage(); renderOut(); }
renderAll();
</script></body></html>`;

const file = join(outDir, '02-质感调参台.html');
writeFileSync(file, html, 'utf8');
console.log('WROTE', file, `(${Math.round(html.length / 1024)}KB)`);
