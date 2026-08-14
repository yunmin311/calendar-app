# 活动记录生成器（Activity Record）

把 **Creative OS 的活动数据**渲成**一张月历留痕**——暖拓质纸 + 朱砂里程碑印，墨深即当日投入、留白即没做——
并导出**印刷级 PDF**（真 A1、3mm 出血、裁切标、CMYK、嵌字）。定位:将来作 CO 的「活动记录」渲染+导出组件。

> 产品几经转向:早期是「A1 年历规划海报」,现锁定为 **CO 活动记录生成器**;视觉走**方向②暖·编辑**的**拓古材质升级版(B)**。
> 详见 `docs/视觉方向-锁定.md`、`docs/数据契约-占位.md`、`PROGRESS.md`(进度台账)。

## 它是什么

一个**纯 render+export 组件**:

```
CO 活动数组  ──►  月历留痕 SVG（整年长条 / 单月详情）
             └─►  印刷级 PDF（A1 + 出血 + 裁切标 + CMYK + 子集嵌字 + 拓质位图）
```

- **不自建活动存储、无副作用**;数据由 CO 喂入。
- 两种皮肤:`editorial-rubbing`(**B** 暖·编辑+拓质,默认)/ `tuogu-ink`(**A** 全拓·单色墨)。
- 墨深=当日投入(4 档)· 朱砂印=出版/里程碑 · 素纸留白=没活动。

## 调用（组件 API）

单一入口 `src/record/index.js`:

```js
import { createRecord, exportRecordPDF } from './src/record/index.js';

const rec = createRecord(activities, { year: 2026, variant: 'editorial-rubbing' });
el.innerHTML = rec.yearSVG();      // 整年长条（12 月行 × 31 日列 A1）
el.innerHTML = rec.monthSVG(2);    // 单月详情（三月,7 列周历大图）

await exportRecordPDF(activities, 2026, 'editorial-rubbing');  // 浏览器:下载印刷 PDF
```

**接进 CO** = 写一个 `fromCreativeOS(coData): Activity[]` 适配器,把 CO 数据映射成占位契约形状,塞在输入层,组件内部不动。

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
node scripts/test-record-pdf.mjs        # B/A 印刷 PDF 矢量校验样张(847×600mm)
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
