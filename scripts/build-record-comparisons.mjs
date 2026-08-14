// 生成「活动留痕」两版对照(A 全拓替换 / B 暖编辑+拓质升级)+ 入口页。
// 用法: node scripts/build-record-comparisons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleActivities, toRecordModel } from '../src/data/activity.js';
import { renderRecord } from '../src/poster/renderRecord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'design', '2026-08-12-record-pivot');
mkdirSync(outDir, { recursive: true });

const acts = sampleActivities(2026);

function shell(title, capTag, cap, stage, svg) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
body{background:${stage};min-height:100%;display:flex;flex-direction:column;align-items:center;gap:1.4vh;padding:3vh 2vw;font-family:Georgia,"Microsoft YaHei",serif}
.cap{font-size:12px;letter-spacing:.1em;color:#4a3f2a}.cap b{color:#241a0c}
.poster{width:min(1580px,96vw);aspect-ratio:841/594;box-shadow:0 3vh 6vh rgba(40,26,8,.34);overflow:hidden}
.poster svg{display:block;width:100%;height:100%}
@media print{@page{size:A1 landscape;margin:0}body{background:#fff;padding:0}.cap{display:none}.poster{width:100%;height:100%;box-shadow:none;aspect-ratio:auto}}
</style></head><body>
<div class="cap">${capTag} · <b>${cap}</b> · CO 活动留痕 · A1 841×594mm 横向 · Ctrl+P 看印刷预览</div>
<div class="poster">${svg}</div></body></html>`;
}

const A = renderRecord(toRecordModel(acts, 2026, 'tuogu-ink'), { variant: 'tuogu-ink' });
writeFileSync(join(outDir, 'A-tuogu-full.html'), shell('A 全拓 · 活动留痕', '方向 A(替换)', '非遗拓古 · 全拓', '#b7a680', A), 'utf8');

const B = renderRecord(toRecordModel(acts, 2026, 'editorial-rubbing'), { variant: 'editorial-rubbing' });
writeFileSync(join(outDir, 'B-editorial-rubbing.html'), shell('B 暖编辑+拓质 · 活动留痕', '方向 B(升级)', '暖·编辑 + 拓印材质', '#cabfa6', B), 'utf8');

const index = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CO 活动留痕 · 拓古岔路两版对照</title>
<style>:root{--ink:#241a0c;--soft:#6c5a3a;--paper:#ece0c8;--line:#cbb992;--seal:#9e3b32}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--paper);color:var(--ink);font-family:"Helvetica Neue",Arial,"Microsoft YaHei",sans-serif;padding:6vh 6vw;line-height:1.6}
h1{font-size:32px;margin-bottom:6px}.sub{color:var(--soft);font-size:15px;margin-bottom:3px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;margin-top:30px}
a.card{display:block;text-decoration:none;color:inherit;background:#fbf6ea;border:1px solid var(--line);padding:22px;transition:.12s}
a.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(40,26,8,.18)}
.tag{font-size:12px;letter-spacing:.16em;color:var(--seal)}.ct{font-size:22px;margin:8px 0 10px}
.dl{font-size:13.5px;color:var(--soft)}.dl b{color:var(--ink)}
.q{margin-top:28px;background:#fbf6ea;border:1px solid var(--line);border-left:3px solid var(--seal);padding:16px 20px;font-size:14px}
.note{margin-top:22px;font-size:13px;color:var(--soft);border-top:1px solid var(--line);padding-top:14px}</style></head><body>
<h1>CO 活动留痕 · 拓古岔路</h1>
<div class="sub">同一份 CO 活动数据(占位) → 两种皮肤。骨架都是 12 月行×31 日列的 A1 线性长条。</div>
<div class="sub">2026-08-12 · 挑方向用</div>
<div class="grid">
<a class="card" href="A-tuogu-full.html"><div class="tag">方向 A · 替换</div><div class="ct">非遗拓古 · 全拓</div>
<div class="dl">活动<b>拓成墨</b>:当天做得越多墨越浓,没做=素纸留白。仿古宣纸、暖墨、朱砂印、剥蚀质感。一眼就是「一年的痕迹被拓下来」。<b>departure 大、最有辨识度</b>,但离方向②较远。</div></a>
<a class="card" href="B-editorial-rubbing.html"><div class="tag">方向 B · 升级</div><div class="ct">暖·编辑 + 拓印材质</div>
<div class="dl">方向②暖·编辑骨架<b>不动</b>:楷体月份、暖纸、分类色照旧;叠上拓印剥蚀质感 + 用<b>朱砂印</b>替换赭黄星标做里程碑。<b>风险低、保住已投入</b>,顾问倾向这条。</div></a>
</div>
<div class="q"><b>要你定的:</b> 拓古是<b>替换</b>方向②(选 A),还是给方向②做<b>材质升级</b>(选 B)?顾问倾向 B(风险低、不推翻已投入),但你拍板。也可以说「A 的墨痕概念 + B 的暖底」这种混搭。</div>
<div class="note">数据是占位的 CO 活动(真结构等 CO 侧定);中文字用系统楷体(导出 PDF 再换 OFL 嵌入款)。「墨深=当日投入、朱砂印=出版/里程碑、八月中旬那截留白=远行」都是数据算出来的,演示「CO 活动进 → 留痕出」。</div>
</body></html>`;
writeFileSync(join(outDir, '00-index.html'), index, 'utf8');
console.log('WROTE', outDir);
