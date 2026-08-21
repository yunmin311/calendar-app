// 全套自测一把跑 —— node scripts/test-all.mjs (或 npm test)。
// 任一套挂掉就整体非零退出, 便于一眼确认"改完没回归"。
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUITES = [
  ['质感模块', 'test-texture.mjs'],
  ['统计层', 'test-stats.mjs'],
  ['简报层', 'test-digest.mjs'],
  ['可嵌入小件', 'test-embed.mjs'],
  ['类型开放', 'test-open-types.mjs'],
  ['一致性/不丢数据', 'test-consistency.mjs'],
  ['印刷 PDF(整年+单月)', 'test-record-pdf.mjs'],
  ['印刷坐标=屏幕几何', 'test-print-geometry.mjs'],
  ['CO 口径验收', 'test-co.mjs'],
  ['端到端一致性', 'test-endtoend.mjs'],
];

let failed = 0;
const lines = [];
for (const [name, file] of SUITES) {
  const r = spawnSync(process.execPath, [join(__dirname, file)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const tail = out.split('\n').filter((l) => /结果:|✗|错误|Error/.test(l));
  const okRun = r.status === 0;
  if (!okRun) failed++;
  lines.push(`${okRun ? '✅' : '❌'} ${name.padEnd(20)} ${tail.filter((l) => l.includes('结果:')).join('') || (okRun ? '通过' : '失败')}`);
  if (!okRun) lines.push(...tail.filter((l) => !l.includes('结果:')).slice(0, 12).map((l) => '     ' + l.trim()));
}
console.log('\n' + lines.join('\n'));
console.log(failed ? `\n${failed} 套挂了` : '\n全套通过');
process.exit(failed ? 1 : 0);
