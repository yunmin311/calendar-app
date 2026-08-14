// 生成「活动留痕 B」印刷 PDF 样张并回读校验。用法: node scripts/test-record-pdf.mjs
// node 无 canvas → 拓质栅格化跳过, 走纯矢量(纸=平涂); 拓质位图由浏览器 exportRecordPDF 补。
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleActivities, toRecordModel } from '../src/data/activity.js';
import { buildRecordPdfBytes } from '../src/poster/exportPdf.js';
import { PDFDocument } from '../src/vendor/pdf-lib.esm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'design', '2026-08-12-record-pivot');
const fdir = join(root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const rd = (p) => (existsSync(p) ? new Uint8Array(readFileSync(p)) : null);
const fonts = {
  latin:     rd(join(fdir, 'EBGaramond_400Regular.ttf')),
  latinBold: rd(join(fdir, 'EBGaramond_700Bold.ttf')),
  cjk:       rd(join(fdir, 'LXGWWenKai-Regular.ttf')),
};
console.log('fonts present -> latin:', !!fonts.latin, ' cjk:', !!fonts.cjk);

const acts = sampleActivities(2026);
console.log('活动条数:', acts.length);

for (const variant of ['editorial-rubbing', 'tuogu-ink']) {
  const model = toRecordModel(acts, 2026, variant);
  const dayCount = Object.keys(model.days).length;
  const bytes = await buildRecordPdfBytes(model, { fonts /*, textureImage: null → node 纯矢量*/ });
  const outFile = join(outDir, `record-${variant}-proof.pdf`);
  writeFileSync(outFile, bytes);
  const doc = await PDFDocument.load(bytes);
  const { width, height } = doc.getPage(0).getSize();
  const MM = 2.834645669;
  console.log(`\n[${variant}] 落格天数=${dayCount} 里程碑=${model.milestones.length} maxLevel=${model.maxLevel}`);
  console.log('  WROTE', outFile, `(${bytes.length} bytes)`);
  console.log('  page mm:', (width / MM).toFixed(1), 'x', (height / MM).toFixed(1), '(期望 847.0 x 600.0)');
}
console.log('\n注: 拓质 300dpi 位图仅浏览器端(exportRecordPDF)嵌入; 此处为纯矢量校验样张。');
