// 从共用模块生成「单文件复盘稿」(静态 SVG 内嵌, 双击即看、断网可看)。
// 用法: node scripts/build-standalone.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleModel } from '../src/data/model.js';
import { posterSVG } from '../src/poster/renderPoster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'design', '2026-08-11-production-v1');
mkdirSync(outDir, { recursive: true });

const svg = posterSVG(sampleModel(2026));

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>方向② 生产稿 v1 · 2026 线性年历 A1</title>
<style>
  :root{--stage:#cabfa6}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{background:var(--stage);min-height:100%;display:flex;flex-direction:column;align-items:center;
    gap:1.4vh;padding:3vh 2vw;font-family:Georgia,"Microsoft YaHei",serif}
  .caption{font-size:12px;letter-spacing:.1em;color:#5a5140}.caption b{color:#2a2419}
  .poster{width:min(1580px,96vw);aspect-ratio:841/594;background:#f4efe3;
    box-shadow:0 3vh 6vh rgba(60,45,20,.30);overflow:hidden}
  .poster svg{display:block;width:100%;height:100%}
  @media print{@page{size:A1 landscape;margin:0}body{background:#fff;padding:0}.caption{display:none}
    .poster{width:100%;height:100%;box-shadow:none;aspect-ratio:auto}}
</style>
</head>
<body>
  <div class="caption">方向② · <b>暖 · 手作 · 编辑 · 生产稿 v1</b> · 数据模型驱动 · A1 841×594mm 横向 · Ctrl+P 看印刷预览</div>
  <div class="poster">${svg}</div>
</body>
</html>
`;

const outFile = join(outDir, 'poster-v1.html');
writeFileSync(outFile, html, 'utf8');
console.log('WROTE', outFile);
