# 活动记录生成器（Activity Record）

把 **Creative OS 的活动数据**渲成**一张月历留痕**——暖拓质纸 + 朱砂里程碑印，墨深即当日投入、留白即没做——
并导出**印刷级 PDF**（真 A1、3mm 出血、裁切标、CMYK、嵌字）。定位:将来作 CO 的「活动记录」渲染+导出组件。

> 产品几经转向:早期是「A1 年历规划海报」,现锁定为 **CO 活动记录生成器**;视觉走**方向②暖·编辑**的**拓古材质升级版(B)**。
> 详见 `docs/视觉方向-锁定.md`、`docs/数据契约-占位.md`、`PROGRESS.md`(进度台账)。

## 它是什么

一个**纯 render+export 组件**:

```
活动数组  ──►  统计（总量/连续天/分类分布/按月/任意区间/可按人分组）
          ├─►  简报文字（可粘贴进对话的周报月报，含与上一期的涨跌）
          ├─►  月历留痕 SVG（整年长条 / 单月详情）
          ├─►  可嵌入小件 SVG（活动带 / 统计卡，同页可放无限个）
          └─►  印刷级 PDF（整年 A1 / 单月卡，出血 + 裁切标 + CMYK + 子集嵌字 + 拓质位图）
```

- **不自建活动存储、无副作用**;数据由调用方喂入。
- 两种皮肤:`editorial-rubbing`(**B** 暖·编辑+拓质,默认)/ `tuogu-ink`(**A** 全拓·单色墨)。
- 四种**可编辑手工质感**:拓质 / 扎染 / 手绘 / 拓扑(见下)。
- 墨深=当日投入(4 档)· 朱砂印=出版/里程碑 · 素纸留白=没活动。

## 调用（组件 API）

单一入口 `src/record/index.js`:

```js
import { createRecord, exportRecordPDF } from './src/record/index.js';

const rec = createRecord(activities, { year: 2026, variant: 'editorial-rubbing' });

// 印刷大件
el.innerHTML = rec.yearSVG();               // 整年长条（12 月行 × 31 日列 A1）
el.innerHTML = rec.monthSVG(2);             // 单月详情（三月,7 列周历大图）

// 可嵌入小件（塞进侧栏/卡片/仪表盘,同页放几个都行）
el.innerHTML = rec.stripSVG({ from: 0, to: 2, cell: 3 });   // 活动带（只画一季度）
el.innerHTML = rec.statCardSVG({ width: 90 });              // 统计卡

// 统计（秘书那一半）
rec.stats();                       // 总投入/有痕天/最长连续/分类分布/按月/最忙…
rec.stats({ groupBy: 'actor' });   // 按活动上的任意字段分组（如按人）
rec.stats(monthRange(2026, 2));    // 只算三月
rec.stats(daysBack('2026-03-20', 7));          // 只算最近七天（基准日由你给，组件不看时钟）
rec.statCardSVG(daysBack('2026-03-20', 7));    // 周报卡：右上角自动标出区间

// 简报：直接粘贴进对话的一段文字（给了区间就自动跟上一期比）
rec.report(daysBack('2026-03-20', 7));                       // 纯文本周报
rec.report({ ...monthRange(2026, 2), groupBy: 'actor',
             groupLabel: '成员', format: 'markdown' });        // 月报 + 按人分组

await exportRecordPDF(activities, 2026, 'editorial-rubbing');  // 浏览器:下载印刷 PDF
```

**接进 CO** = 写一个 `fromCreativeOS(coData): Activity[]` 适配器,把 CO 数据映射成占位契约形状,塞在输入层,组件内部不动。

### 手工质感（可编辑）

质感定义在 `src/texture/index.js`,四个预设 `rubbing` 拓质 / `tiedye` 扎染 / `handdrawn` 手绘 / `topographic` 拓扑。
每个参数都可改,屏幕预览与印刷栅格化**共用同一份定义**(印刷不会跟屏幕漂):

```js
rec.yearSVG({ texture: 'tiedye' });                              // 换皮
rec.yearSVG({ texture: { name: 'tiedye', warp: 24, opacity: .3 } }); // 逐参微调
createRecord(acts, { year: 2026, texture: 'handdrawn' });        // 整体锁定
```

参数规则只有一条:**按 A1 长条为基准写,载体只换算噪声频率,别的一律照搬** —— 所以同一份配置到哪个载体都是同一个样子。
滤镜 id 按内容派生前缀,同页多实例互不撞车。另有 `'none'` 预设 = 干净的纸。

**调参台**(给设计师的):`design/2026-08-19-texture-module/02-质感调参台.html` —— **双击就开**,
不用 npm、不起服务;拖滑块实时看,调顺眼了一键复制配置贴回代码。
同目录还有样品册(四质感对照)和小件演示(同页 14 个实例)。

### 统计（`src/data/stats.js`）

`computeStats(activities, {year, from, to, groupBy})` 吐总投入 / 有痕天与留白 / 活跃日均 / 最长与最近连续天数 /
分类分布与占比 / 按月 / 强度分档 / 最忙一天 / 里程碑;`summarize(stats)` 出一行人话摘要。
`from`/`to` 只算那一段(秘书交的是「这周/这个月」的账),配 `monthRange()` / `daysBack()` 两个纯函数助手用 —— **组件不看时钟**,基准日由调用方给。

内部复用 `toDailySeries`,**统计口径与渲染口径同源**,不会出现两套数字:凡统计算作「有痕」的天,图上一定画得出来。
日期不合法 / 不在本年 / 投入量为负的活动不会被悄悄吞掉,`stats.dropped` 里有计数。

### 活动数据(占位契约,真结构等 CO 定)

```ts
type Activity = {
  id: string; date: 'YYYY-MM-DD';
  type: 'design'|'writing'|'research'|'build'|'publish';
  title: string; weight: number; milestone?: boolean;
};
```

借 react-activity-calendar 的 `{date, count, level}` 形状建模(只借形状不引库):`level 0=留白 / 1..4=墨深`。完整说明与 5 个待 CO 对齐点见 `docs/数据契约-占位.md`。

## 开发

```bash
npm install
npm run dev            # 起 Vite 开发服(app 是组件的预览台)
```

自测脚本(无需浏览器,node 直跑):

```bash
npm test                                # 一把跑下面全部(scripts/test-all.mjs)

node scripts/test-texture.mjs           # 手工质感模块
node scripts/test-stats.mjs             # 统计层(手算样本逐个对数 + 区间)
node scripts/test-digest.mjs            # 简报层(涨跌/值得注意/不静默少算)
node scripts/test-embed.mjs             # 可嵌入小件(含同页多实例 id 不撞)
node scripts/test-open-types.mjs        # 类型开放(图与统计数字不许打架)
node scripts/test-consistency.mjs       # 一致性/不丢数据/图例不说谎
node scripts/test-record-pdf.mjs        # 印刷 PDF 样张(整年 847×600 / 单月 216×286)
node scripts/test-print-geometry.mjs    # 印刷坐标 = 屏幕几何(解 PDF 内容流逐格比对)

node scripts/build-texture-studio.mjs       # 质感调参台 HTML(给设计师拖滑块用)
node scripts/build-texture-gallery.mjs      # 四质感样品册 HTML
node scripts/build-embed-demo.mjs           # 可嵌入小件演示 HTML
node scripts/build-record-comparisons.mjs   # 整年 A/B 对照 HTML
node scripts/build-month-preview.mjs        # 单月详情预览 HTML
```

## 印刷字体(合规)

屏幕预览用系统字;**导出必须换开源可嵌入款**:拉丁=**EB Garamond (OFL)**、中文=**霞鹜文楷 LXGW WenKai (OFL)**。
楷体(KaiTi)与 Georgia 是专有字体,**不得**嵌入要卖/分发的 PDF。详见 `docs/字体授权与印刷规格.md`。

- EB Garamond 已随仓(`public/fonts/`,含 OFL 许可)。
- 霞鹜文楷 25MB **本机外网拉不动 → 做成 drop-in**:把 `LXGWWenKai-Regular.ttf` 丢进 `public/fonts/` 即自动子集嵌入。

## 当前状态 / 待办

见 `PROGRESS.md`。两个物理卡点(降级默认继续中):
1. **缺霞鹜文楷 ttf** → 印刷 PDF 中文暂留缺口;完整验收(中文+拓质位图)待字体就位。
2. **本机无 npm 工具链** → Vite/真交互未整跑;渲染经截图验、PDF 经 node 验、拓质栅格化经无头浏览器实测。

## 许可

代码 MIT。字体各自 OFL(见 `public/fonts/LICENSES/`)。
