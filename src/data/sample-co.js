// ============================================================================
// 按 CO 口径造的样例数据 —— 用来验版面、验分档,不是适配层。
//
// CO 2026-08-21 给的映射(用户转达):
//   weight    = 当天条目数(**不是工时**),恒为小整数
//   type      = CO 真有的三类:收灵感 / 分析 / 整理
//   title     = 当天第一条灵感的标题
//   milestone = **一律 false** —— CO 现在没有"里程碑"这个概念,编一个出来就是造假
//   时间范围  = 单年够用
//
// 真数据来了之后,由输入层的 `fromCreativeOS(coData)` 产出同样形状,本文件功成身退。
// 这里只是"长得像 CO 数据"的一份占位样例,组件内部一律不动。
// ============================================================================
import { daysInMonth, dow, iso } from './model.js';

// CO 真有的三类。名字直接用 CO 的中文名 —— 组件的类型是开放的,不需要先登记。
export const CO_TYPES = ['收灵感', '分析', '整理'];

const TITLES = {
  收灵感: ['一张老海报', '街角的招牌', '展签的字距', '雨天的灰', '旧书扉页', '瓷片的裂'],
  分析: ['拆了那版排布', '比对两种衬线', '数了留白比例', '拆解配色', '量了行距'],
  整理: ['归档到工具舱', '并了重复项', '补了来源', '重命名一批', '清了草稿'],
};

/**
 * 造一年 CO 口径的活动。
 * @param {number} year
 * @param {{peak?:number}} opts  peak = 全年最忙那天的条目数(默认 9)。
 *   这个参数是给"分档会不会全塌在最浅那档"做实验用的 —— 条目数一旦出现大离群值,
 *   线性缩放会把典型日全压到第 1 档(见 docs/数据契约-占位.md 的分档规则)。
 */
export function sampleCOActivities(year = 2026, opts = {}) {
  const peak = opts.peak ?? 9;
  const acts = [];
  let id = 0;
  // 一天可能同时有几类(收了灵感又顺手整理),每类一条,weight = 该类当天条目数
  for (let m = 0; m < 12; m++) {
    const dim = daysInMonth(year, m);
    for (let d = 1; d <= dim; d++) {
      const w = dow(year, m, d);
      const pseudo = ((d * 7 + m * 11) % 10) / 10;      // 确定性伪随机, 无 Math.random
      const busy = ((d * 3 + m * 5) % 7) / 7;
      if (m === 6 && d >= 10 && d <= 21) continue;       // 七月中旬空一截, 看留白
      if ((w === 0 || w === 6) && pseudo > 0.45) continue; // 周末通常没动静
      if (pseudo > 0.72) continue;                        // 平日也有不少空白天

      // 有些天只做整理(收尾归档), 有些天只分析 —— 否则占比小的类永远当不上"当天主类",
      // 整年图上就一格都看不到, 而统计里却有它的份额(出口之间会显得对不上)。
      const soloTidy = (d + m) % 11 === 0;
      const soloAnalyze = (d + m * 2) % 13 === 0;
      const n收 = soloTidy || soloAnalyze ? 0 : (pseudo < 0.5 ? 1 + Math.round(busy * 2) : 0);
      const n分 = soloTidy ? 0 : (soloAnalyze ? 2 + Math.round(busy) : (pseudo < 0.3 ? 1 + Math.round(busy) : 0));
      const n整 = soloTidy ? 1 + Math.round(busy * 2) : (pseudo < 0.18 ? 1 : 0);
      const bump = (m === 2 && d >= 8 && d <= 12) ? peak - 2 : 0; // 三月一小簇高峰
      for (const [type, n] of [['收灵感', n收 + bump], ['分析', n分], ['整理', n整]]) {
        if (n <= 0) continue;
        acts.push({
          id: `co${id++}`,
          date: iso(year, m, d),
          type,
          title: TITLES[type][(d + m) % TITLES[type].length],
          weight: n,          // = 当天该类的条目数
          milestone: false,   // CO 没有里程碑概念, 恒 false
        });
      }
    }
  }
  return acts;
}
