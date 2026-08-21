// 总入口页 —— 一个地方进到所有「能看的东西」。用法: node scripts/build-index.mjs
//
// 为什么要这个:演示页散在 design/ 下五个日期目录里,过两周谁也想不起哪个是哪个。
// 这一页把它们收拢, 每个附一句"这是什么" + 一句"怎么重出"。
//
// 它自己带牙:清单里列的文件必须真存在(缺一个就非零退出),
// design/ 下多出来没被收录的可看文件会被点名 —— 免得新做的演示页又变成孤儿。
import { writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const designDir = join(root, 'design');

// —— 清单(相对 design/ 的路径)——
const SECTIONS = [
  {
    title: '一、先看这个',
    note: '第一次来的话,从上往下看三页就够了。',
    items: [
      {
        path: '2026-08-12-record-pivot/00-index.html',
        name: '整年留痕 · A/B 对照',
        what: '组件的主出口:12 月行 × 31 日列的整年长条。左右两套皮肤对照 —— B 暖·编辑(默认)与 A 全拓·墨。',
        how: 'node scripts/build-record-comparisons.mjs',
      },
      {
        path: '2026-08-14-month-detail/month-detail-preview.html',
        name: '单月卡 · 预览',
        what: '整年图放大到单月:7 列周历、日号、当月合计、图例。一月(有里程碑)/ 三月(最忙)/ 八月(留白断口)三张。',
        how: 'node scripts/build-month-preview.mjs',
      },
      {
        path: '2026-08-19-texture-module/01-可嵌入小件演示.html',
        name: '可嵌入小件 · 演示',
        what: '同一份数据塞进侧栏尺寸的小件:活动带 / 统计卡 / 分组横条。同页 14 个实例互不撞车(滤镜 id 按内容派生)。',
        how: 'node scripts/build-embed-demo.mjs',
      },
    ],
  },
  {
    title: '二、手工质感',
    note: '质感是可编辑的模块(src/texture/index.js),不是写死的背景图。',
    items: [
      {
        path: '2026-08-19-texture-module/02-质感调参台.html',
        name: '质感调参台(给设计师)',
        what: '拖滑块实时看四套质感,调顺眼了页面下方直接吐出可粘贴的配置。双击就开,不用 npm、不用起服务。',
        how: 'node scripts/build-texture-studio.mjs',
      },
      {
        path: '2026-08-19-texture-module/00-质感样品册.html',
        name: '四质感样品册',
        what: '拓质 / 扎染 / 手绘 / 拓扑 四套预设的对照样张 —— 换载体(整年图/单月卡/小件)花纹密度是否一致,看这页。',
        how: 'node scripts/build-texture-gallery.mjs',
      },
      {
        path: '2026-08-12-record-pivot/B-editorial-rubbing.html',
        name: 'B 暖·编辑(单开)',
        what: '默认皮肤单独一页,方便截图与逐格挑毛病。',
        how: 'node scripts/build-record-comparisons.mjs',
      },
      {
        path: '2026-08-12-record-pivot/A-tuogu-full.html',
        name: 'A 全拓·墨(单开)',
        what: '单色墨皮肤:不用分类色,只用墨深说话,墨层套破边滤镜。',
        how: 'node scripts/build-record-comparisons.mjs',
      },
    ],
  },
  {
    title: '三、印刷校样(PDF)',
    note: '真尺寸 · 3mm 出血 · 裁切标 · CMYK · 子集嵌字 · 拓质栅格化位图。浏览器里可能只下载不预览,下下来看。',
    items: [
      {
        path: '2026-08-12-record-pivot/record-editorial-rubbing-proof.pdf',
        name: '整年长条 · B 暖·编辑',
        what: 'A1 847×600mm(841×594 + 3mm 出血)。',
        how: 'node scripts/test-record-pdf.mjs',
      },
      {
        path: '2026-08-12-record-pivot/record-tuogu-ink-proof.pdf',
        name: '整年长条 · A 全拓·墨',
        what: '同规格,单色墨版。',
        how: 'node scripts/test-record-pdf.mjs',
      },
      {
        path: '2026-08-12-record-pivot/month-02-有里程碑-proof.pdf',
        name: '单月卡 · 二月(有里程碑)',
        what: '216×286mm(210×280 + 3mm 出血),朱砂印落在格子上的样子。',
        how: 'node scripts/test-record-pdf.mjs',
      },
      {
        path: '2026-08-12-record-pivot/month-08-留白断口与里程碑-proof.pdf',
        name: '单月卡 · 八月(留白断口)',
        what: '大段没做的月份长什么样 —— 留白是内容,不是缺页。',
        how: 'node scripts/test-record-pdf.mjs',
      },
    ],
  },
  {
    title: '四、历史留档(已不在活路径)',
    note: '早期是「A1 年历规划海报」,2026-08-12 转向为「活动记录生成器」。代码已清掉,页面留着做个记性。',
    stale: true,
    items: [
      {
        path: '2026-08-11-poster-directions/00-index.html',
        name: '三个海报方向(瑞士 / 编辑 / 粗野)',
        what: '转向前的三选一。方向②编辑是现在这套暖·手作气质的来处。三张概念稿从这页进。',
        how: '不再重出(生成脚本已随旧路径清掉)',
        covers: ['2026-08-11-poster-directions/concept-1-swiss.html',
                 '2026-08-11-poster-directions/concept-2-editorial.html',
                 '2026-08-11-poster-directions/concept-3-brutalist.html'],
      },
      {
        path: '2026-08-11-production-v1/poster-v1.html',
        name: '规划海报 v1',
        what: '旧定位的成品页:格子是"计划要做的事",不是"已经做过的事"。',
        how: '不再重出',
      },
      {
        path: '2026-08-11-production-v1/poster-print-proof.pdf',
        name: '规划海报 v1 · 印刷校样',
        what: '旧定位的 PDF 校样,印刷管线最早就是在它身上跑通的。',
        how: '不再重出',
      },
    ],
  },
];

// —— 自检:清单里的文件必须存在 ——
const listed = new Set();
let missing = 0;
for (const s of SECTIONS) {
  for (const it of s.items) {
    // covers = 从这一页里能点进去的子页(如三张概念稿), 不单列, 但也不算孤儿
    for (const p of [it.path, ...(it.covers || [])]) {
      listed.add(p.replace(/\\/g, '/'));
      if (!existsSync(join(designDir, p))) { console.log('MISSING', p); missing++; }
    }
  }
}

// —— 自检:design/ 下有没有没被收录的可看文件 ——
const VIEWABLE = /\.(html|pdf|svg|png|jpg)$/i;
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [relative(designDir, p).replace(/\\/g, '/')];
});
const orphans = walk(designDir).filter((p) => VIEWABLE.test(p) && p !== 'index.html' && !listed.has(p));
if (orphans.length) console.log('未收录(新做的演示页?记得加进 SECTIONS):\n  ' + orphans.join('\n  '));

// —— 出页 ——
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const isPdf = (p) => /\.pdf$/i.test(p);

const cards = SECTIONS.map((s) => `
<section${s.stale ? ' class="stale"' : ''}>
  <h2>${esc(s.title)}</h2>
  <p class="note">${esc(s.note)}</p>
  <ul>${s.items.map((it) => `
    <li>
      <a href="${enc(it.path)}"${isPdf(it.path) ? ' target="_blank"' : ''}>${esc(it.name)}${isPdf(it.path) ? ' <em>PDF</em>' : ''}</a>
      <p>${esc(it.what)}</p>
      <code>${esc(it.how)}</code>
    </li>`).join('')}
  </ul>
</section>`).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>活动记录生成器 · 全部能看的东西</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f4efe3;color:#20201b;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;
  padding:6vh max(4vw,24px) 12vh;line-height:1.7}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:30px;letter-spacing:.06em;font-weight:normal}
.sub{color:#8c8371;font-size:13px;letter-spacing:.06em;margin-top:8px}
.lead{margin:26px 0 0;padding:16px 18px;background:#eaded0;font-size:14px;color:#3a3529}
.lead b{color:#20201b}
hr{border:0;border-top:1px solid #d9cfb9;margin:34px 0 0}
section{margin-top:34px}
h2{font-size:17px;font-weight:normal;letter-spacing:.08em}
.note{color:#8c8371;font-size:13px;margin-top:6px}
ul{list-style:none;margin-top:16px}
li{padding:14px 0 14px 16px;border-left:2px solid #d9cfb9;margin-bottom:12px}
li:hover{border-left-color:#9e3b32}
li a{color:#20201b;font-size:16px;text-decoration:none;border-bottom:1px solid #c8bda6}
li a:hover{border-bottom-color:#9e3b32;color:#9e3b32}
li a em{font-style:normal;font-size:10px;letter-spacing:.1em;color:#9e3b32;border:1px solid #d9cfb9;padding:1px 4px;vertical-align:2px}
li p{font-size:13.5px;color:#4a4438;margin-top:5px}
li code{display:inline-block;margin-top:6px;font-family:Consolas,Menlo,monospace;font-size:11.5px;color:#8c8371}
.stale{opacity:.62}
footer{margin-top:44px;font-size:12.5px;color:#8c8371}
footer p{margin-top:6px}
footer b{color:#4a4438;font-weight:normal}
</style></head><body><div class="wrap">
<h1>活动记录生成器 · 全部能看的东西</h1>
<p class="sub">Activity Record · 纯 render+export 组件 · 双击任意一条即可打开,不用 npm、不用起服务</p>
<p class="lead">这一页由 <b>node scripts/build-index.mjs</b> 生成,清单缺文件会报错。
新做了演示页就往 <b>SECTIONS</b> 里加一条 —— 不加会被这个脚本点名。</p>
<hr>
${cards}
<footer>
  <p><b>组件怎么调</b> —— 单一入口 <code>src/record/index.js</code>,用法见仓根 <code>README.md</code>。</p>
  <p><b>换一副样子</b> —— 配色/质感参数整套可换,不改代码:<code>docs/可换参数清单.md</code>。</p>
  <p><b>接 CO</b> —— 占位数据契约与待对齐点:<code>docs/数据契约-占位.md</code>;进度台账 <code>PROGRESS.md</code>。</p>
</footer>
</div></body></html>`;

// —— 自检:页面里真写出来的 href 必须解得回一个存在的文件(中文名要转义, 转义错了链接就是死的)——
let deadLinks = 0;
for (const m of html.matchAll(/href="([^"]+)"/g)) {
  const p = decodeURIComponent(m[1]);
  if (!existsSync(join(designDir, p))) { console.log('DEAD LINK', m[1]); deadLinks++; }
}

const out = join(designDir, 'index.html');
writeFileSync(out, html, 'utf8');
console.log('WROTE', out);
const entries = SECTIONS.reduce((n, s) => n + s.items.length, 0);
console.log(`列出 ${entries} 条 · 覆盖 ${listed.size} 个文件 · 缺失 ${missing} · 死链 ${deadLinks} · 未收录 ${orphans.length}`);
process.exit(missing || deadLinks ? 1 : 0);
