// 单月详情页预览。用法: node scripts/build-month-preview.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleActivities, toRecordModel } from '../src/data/activity.js';
import { renderMonth } from '../src/poster/renderMonth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'design', '2026-08-14-month-detail');
mkdirSync(outDir, { recursive: true });

const acts = sampleActivities(2026);
const model = toRecordModel(acts, 2026, 'editorial-rubbing');
const monoModel = toRecordModel(acts, 2026, 'tuogu-ink');
const months = [0, 2, 7]; // 一月(里程碑) / 三月(最忙) / 八月(留白断口)

const cards = months.map((m) => `<div class="card">${renderMonth(model, m, { variant: 'editorial-rubbing' })}</div>`).join('');
const monoCard = `<div class="card">${renderMonth(monoModel, 2, { variant: 'tuogu-ink' })}</div>`;

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>单月详情页 · 预览</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#cabfa6;font-family:Georgia,"Microsoft YaHei",serif;padding:3vh 2vw}
.cap{font-size:13px;letter-spacing:.08em;color:#3a2f1a;margin-bottom:2vh}.cap b{color:#241a0c}
.row{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start}
.card{width:min(360px,44vw);aspect-ratio:210/280;background:#f4efe3;box-shadow:0 2vh 4vh rgba(40,26,8,.30)}
.card svg{display:block;width:100%;height:100%}
h2{font-size:14px;color:#3a2f1a;margin:3vh 0 1.4vh}</style></head><body>
<div class="cap">单月详情页 · B 暖·拓质 · <b>一月(里程碑)/ 三月(最忙)/ 八月(留白断口)</b> · 竖版 210×280mm 卡</div>
<div class="row">${cards}</div>
<h2>同页 A 全拓·墨(三月)对照</h2>
<div class="row">${monoCard}</div>
</body></html>`;
writeFileSync(join(outDir, 'month-detail-preview.html'), html, 'utf8');
console.log('WROTE', join(outDir, 'month-detail-preview.html'));
console.log('months:', months.join(','), ' cells sanity: 三月 dim/firstDow ok if screenshot 正常');
