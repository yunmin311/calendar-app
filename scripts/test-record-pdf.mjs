// 印刷 PDF 自测(整年长条 + 单月卡)—— 生成样张并回读校验页面尺寸。
// 用法: node scripts/test-record-pdf.mjs
// node 无 canvas → 拓质栅格化跳过, 走纯矢量(纸=平涂); 拓质位图由浏览器 exportRecordPDF/exportMonthPDF 补。
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleActivities, toRecordModel } from '../src/data/activity.js';
import { buildRecordPdfBytes, buildMonthPdfBytes } from '../src/poster/exportPdf.js';
import { PDFDocument } from '../src/vendor/pdf-lib.esm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'design', '2026-08-12-record-pivot');
const fdir = join(root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const MM = 2.834645669;
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${got !== undefined ? JSON.stringify(got) : ''}`); } };
const sizeMM = async (bytes) => {
  const doc = await PDFDocument.load(bytes);
  const { width, height } = doc.getPage(0).getSize();
  return [Number((width / MM).toFixed(1)), Number((height / MM).toFixed(1))];
};

const rd = (p) => (existsSync(p) ? new Uint8Array(readFileSync(p)) : null);
const fonts = {
  latin:     rd(join(fdir, 'EBGaramond_400Regular.ttf')),
  latinBold: rd(join(fdir, 'EBGaramond_700Bold.ttf')),
  cjk:       rd(join(fdir, 'LXGWWenKai-Regular.ttf')),
};
console.log('fonts present -> latin:', !!fonts.latin, ' cjk:', !!fonts.cjk, fonts.cjk ? '' : '(中文走缺口, 见 PROGRESS 卡点①)');

const acts = sampleActivities(2026);

console.log('\n[1] 整年长条 A1(847×600mm 含 3mm 出血)');
for (const variant of ['editorial-rubbing', 'tuogu-ink']) {
  const model = toRecordModel(acts, 2026, variant);
  const bytes = await buildRecordPdfBytes(model, { fonts });
  const outFile = join(outDir, `record-${variant}-proof.pdf`);
  writeFileSync(outFile, bytes);
  const [w, h] = await sizeMM(bytes);
  ok(`${variant} 页面 847×600mm`, w === 847 && h === 600, [w, h]);
  ok(`${variant} 落格 ${Object.keys(model.days).length} 天 / 里程碑 ${model.milestones.length}`, Object.keys(model.days).length > 0 && model.milestones.length === 4);
  ok(`${variant} 样张字节数合理`, bytes.length > 8000, bytes.length);
}

console.log('\n[2] 单月卡(216×286mm 含 3mm 出血)· 12 个月 × 两变体全过');
let monthFail = 0;
for (const variant of ['editorial-rubbing', 'tuogu-ink']) {
  const model = toRecordModel(acts, 2026, variant);
  for (let m = 0; m < 12; m++) {
    try {
      const bytes = await buildMonthPdfBytes(model, m, { fonts });
      const [w, h] = await sizeMM(bytes);
      if (w !== 216 || h !== 286 || bytes.length < 3000) { monthFail++; console.log(`    ${variant} ${m + 1}月 异常`, [w, h, bytes.length]); }
    } catch (e) { monthFail++; console.log(`    ${variant} ${m + 1}月 抛错`, e.message); }
  }
}
ok('24 张单月卡全部 216×286mm 且不抛', monthFail === 0, monthFail);

// 留两张样张给人看(示例数据的里程碑在 2/5/8/11 月;八月还带远行留白断口)
for (const [m, tag] of [[1, '02-有里程碑'], [7, '08-留白断口与里程碑']]) {
  const bytes = await buildMonthPdfBytes(toRecordModel(acts, 2026, 'editorial-rubbing'), m, { fonts });
  const f = join(outDir, `month-${tag}-proof.pdf`);
  writeFileSync(f, bytes);
  console.log('  WROTE', f, `(${bytes.length} bytes)`);
}

// 确定性: 同一份数据必须出同一串字节。pdf-lib 默认往文件里盖当前时间戳,
// 那会让每跑一次自测校样 PDF 就在仓里假变更一次, 也让"同数据同输出"这条承诺当场破功。
{
  const m = toRecordModel(acts, 2026, 'editorial-rubbing');
  const a = await buildRecordPdfBytes(m, { fonts }), b = await buildRecordPdfBytes(m, { fonts });
  ok('整年 PDF 两次构建字节一致(不盖时间戳)', a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0);
  const c = await buildMonthPdfBytes(m, 1, { fonts }), d = await buildMonthPdfBytes(m, 1, { fonts });
  ok('单月 PDF 两次构建字节一致', c.length === d.length && Buffer.compare(Buffer.from(c), Buffer.from(d)) === 0);
}

console.log('\n[3] 边角料不崩');
const cases = [
  ['空活动', toRecordModel([], 2026), 5],
  ['闰年二月', toRecordModel(acts, 2024), 1],
  ['六周的月份(2026-08 起于周六)', toRecordModel(acts, 2026), 7],
];
for (const [name, model, m] of cases) {
  try { const [w, h] = await sizeMM(await buildMonthPdfBytes(model, m, { fonts })); ok(`${name} 仍 216×286mm`, w === 216 && h === 286, [w, h]); }
  catch (e) { ok(`${name} 不抛`, false, e.message); }
}
// 月份索引非法时不能"静默出一张空卡": 规整后必须真的画出某个月(以有日号为准)
const model2026 = toRecordModel(acts, 2026);
for (const [bad, wantMonth] of [[-3, 0], [99, 11], [1.7, 1], [NaN, 0], [undefined, 0], ['3', 3], ['乱写', 0]]) {
  try {
    const bytes = await buildMonthPdfBytes(model2026, bad, { fonts });
    const [w, h] = await sizeMM(bytes);
    const ref = await buildMonthPdfBytes(model2026, wantMonth, { fonts });
    ok(`月份 ${String(bad)} → 规整成 ${wantMonth + 1} 月且真画出内容`, w === 216 && h === 286 && Math.abs(bytes.length - ref.length) < 40, [w, h, bytes.length, ref.length]);
  } catch (e) { ok(`月份 ${String(bad)} 不抛`, false, e.message); }
}
try { const [w] = await sizeMM(await buildMonthPdfBytes(toRecordModel(acts, 2026), 3, {})); ok('完全无字体也能出(全走缺口)', w === 216); }
catch (e) { ok('完全无字体也能出', false, e.message); }

console.log(`\n结果: ${pass} 过 / ${fail} 挂`);
console.log('注: 拓质 300dpi 位图仅浏览器端嵌入; 此处为纯矢量校验样张。');
process.exit(fail ? 1 : 0);
