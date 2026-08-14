// 生成印刷 PDF 样张并回读校验。用法: node scripts/test-pdf.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleModel } from '../src/data/model.js';
import { buildPosterPdfBytes } from '../src/poster/exportPdf.js';
import { PDFDocument } from '../src/vendor/pdf-lib.esm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'design', '2026-08-11-production-v1');
const fdir = join(root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const rd = (p) => (existsSync(p) ? new Uint8Array(readFileSync(p)) : null);
const fonts = {
  latin:     rd(join(fdir, 'EBGaramond_400Regular.ttf')),
  latinBold: rd(join(fdir, 'EBGaramond_700Bold.ttf')),
  cjk:       rd(join(fdir, 'LXGWWenKai-Regular.ttf')),
};
console.log('fonts present -> latin:', !!fonts.latin, ' latinBold:', !!fonts.latinBold, ' cjk:', !!fonts.cjk);

const bytes = await buildPosterPdfBytes(sampleModel(2026), { fonts });
const outFile = join(outDir, 'poster-print-proof.pdf');
writeFileSync(outFile, bytes);
console.log('WROTE', outFile, `(${bytes.length} bytes)`);

const doc = await PDFDocument.load(bytes);
const { width, height } = doc.getPage(0).getSize();
const MM = 2.834645669;
console.log('page mm :', (width / MM).toFixed(1), 'x', (height / MM).toFixed(1), '  (期望 847.0 x 600.0)');
console.log('拉丁字:', fonts.latin ? 'EB Garamond 子集嵌入' : 'Helvetica 内置(回退)', ' | 中文字:', fonts.cjk ? '霞鹜文楷 子集嵌入' : '缺口(待放置 ttf)');
