// 方向② 暖·手作·编辑 —— 冻结的视觉基准 (见 docs/视觉方向-锁定.md)
// 屏幕预览用系统字;导出 PDF 必须换 OFL 嵌入款 (见 docs/字体授权与印刷规格.md)
export const theme = {
  paper:   '#f4efe3',  // 暖纸
  paper2:  '#eaded0',  // 周末格(加深一档, 让斜向条纹读得出来)
  ink:     '#20201b',  // 主墨
  inkSoft: '#8c8371',  // 次级文字/刻度
  line:    '#d9cfb9',  // 横向发丝分隔
  ochre:   '#c2902b',  // 强调一:里程碑/周日/强调数字
  teal:    '#2f5d57',  // 强调二:打卡/次分类

  // 锁死的「在品牌内」分类调色板 —— 分类只能从这里取色, 保证「导出必好看」
  palette: [
    { id:'sand', name:'砂', color:'#e8dcc0' },
    { id:'mist', name:'雾', color:'#dce6e2' },
    { id:'sage', name:'苔', color:'#dde3d2' },
    { id:'clay', name:'陶', color:'#e3d3c4' },
    { id:'dusk', name:'暮', color:'#dedce6' },
    { id:'ash',  name:'灰', color:'#e4dfd6' },
  ],

  fonts: {
    // 屏幕栈末尾预留 OFL 名, 装了嵌入款也能直接吃
    kai:   '"KaiTi","STKaiti","楷体","LXGW WenKai",serif',
    serif: 'Georgia,"Times New Roman","Songti SC","EB Garamond",serif',
  },
};
