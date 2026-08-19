// ============================================================================
// 手工质感模块 —— 可编辑、可复用的程序化 SVG 纹理。
//
// 一个纹理 = 若干程序化图层(feTurbulence 噪声 / 位移 / 晕染),铺在纸底之上。
// 每个预设是一份「可编辑参数对象」;texture(name, overrides) 浅合并 → 随手可调。
// 产物 = { defs, body } 两段 SVG 字符串:
//   · defs —— 进外层 <defs>(滤镜 / 渐变定义)
//   · body —— 叠在内容层之上、纸底之上的覆盖 <rect>/<g>
// id 前缀隔离滤镜 id,故同一页可放多个纹理互不撞车(建立「无限次复用」的前提)。
//
// 无外部依赖、纯字符串;屏幕预览与栅格化(印刷)共用同一份定义 = 单一真源
// (此前 renderRecord / renderMonth / exportPdf 各内联一套、且屏幕 speckle 因黑色
//  在 screen 混合下恒不可见——本模块统一为可见白飞点,一并修掉)。
//
// 四个手工预设(都可编辑):
//   rubbing      拓质/拓印  —— 斑驳正片叠底 + 剥蚀白飞点(本项目原味)
//   tiedye       扎染      —— 靛/茜晕染色潭 + 折痕环,湍流位移把圆晕揉成手工皱染
//   handdrawn    手绘      —— 细颗粒铅笔纹(可带方向性排线),正片叠底
//   topographic  拓扑/等高 —— 噪声阈值化出等高线,像地形图的同心纹
// ============================================================================

const num = (n) => Math.round(Number(n) * 1000) / 1000;

// —— 预设默认参数(overrides 覆盖它;数组类参数整体替换)——
export const TEXTURE_DEFAULTS = {
  // 拓质:斑驳(fractalNoise 去饱和 · 正片叠底)+ 剥蚀白飞点(阈值化白噪 · 滤色)
  rubbing: {
    mottleFreq: 0.06, mottleOp: 0.15, mottleBlend: 'multiply',
    speckle: true, speckleFreq: 0.14, speckleOp: 0.22, speckleBlend: 'screen',
  },
  // 扎染:多个染心的径向色潭,叠加后被湍流位移揉皱 → 手工皱染;可加折痕同心环
  // opacity 取真值 0.38:实测 0.5 会把数据格子压住、0.28 又淡到没手工味
  tiedye: {
    opacity: 0.38, blend: 'multiply', warp: 14, warpFreq: 0.012, warpOct: 2, seed: 7,
    rings: true, ringOp: 0.55,
    // cx/cy/r 为视口比例(0..1);色偏克制:靛(花青)/茜(赭)/苍绿,叠暖纸不俗
    centers: [
      { cx: 0.24, cy: 0.32, r: 0.42, color: '#3a5a74' },
      { cx: 0.72, cy: 0.58, r: 0.50, color: '#7a4a3a' },
      { cx: 0.50, cy: 0.86, r: 0.36, color: '#4a6a5a' },
    ],
  },
  // 手绘:细颗粒铅笔底纹 + 可选方向性排线(hatch),都走正片叠底
  // 阈值取真值(实测):噪声三通道均值≈0.5,故 k·(r+g+b)+off 必须让 off 压过 1.5k,
  // 否则整页恒过阈 = 一堵灰墙(这正是初版的毛病)。grainK/grainOff 只放行噪声高尾 → 疏落颗粒。
  handdrawn: {
    grainFreq: '0.9 0.9', grainOct: 2, grainOp: 0.6, grainK: 1.5, grainOff: -2.6,
    blend: 'multiply', seed: 3, tint: '#3a3229',   // 墨褐颗粒(死黑落暖纸发脏)
    hatch: true, hatchFreq: '0.02 0.7', hatchOp: 0.35, hatchK: 1.6, hatchOff: -2.4,
  },
  // 拓扑:噪声经 feFuncA 阶梯表切成细尖 → 等高线;flood 上色
  // 线宽 = 1/(档数-1):16 档肥成迷彩,48 档才是等高线(实测比选)
  topographic: {
    freq: 0.012, oct: 2, seed: 5, lineOp: 0.22, blend: 'multiply', tint: '#6d5a3a', bandCount: 48,
  },
};

// 等高线阶梯表:0/1 交替 n 档 → 线宽 1/(n-1)
const bandTable = (n) => Array.from({ length: Math.max(4, n | 0) }, (_, i) => (i % 2 ? 1 : 0)).join(' ');
// 颜色常数行:让 feColorMatrix 输出指定色(而非死黑)
const tintRows = (hex) => {
  const h = String(hex).replace('#', '');
  const v = (i) => num(parseInt(h.slice(i, i + 2), 16) / 255);
  return `0 0 0 0 ${v(0)} 0 0 0 0 ${v(2)} 0 0 0 0 ${v(4)}`;
};

// —— 各预设的 { defs, body } 生成器 ——

function buildRubbing(w, h, id, p) {
  const W = num(w), H = num(h);
  const defs = [
    `<filter id="${id}-mo" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${p.mottleFreq}" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`,
  ];
  const body = [
    `<rect width="${W}" height="${H}" filter="url(#${id}-mo)" opacity="${num(p.mottleOp)}" style="mix-blend-mode:${p.mottleBlend}"/>`,
  ];
  if (p.speckle) {
    // 白飞点:阈值化白噪(输出 RGB=白, alpha=1.5·亮度−1.3),滤色叠出剥蚀白点
    defs.push(`<filter id="${id}-sp"><feTurbulence type="fractalNoise" baseFrequency="${p.speckleFreq}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.5 1.5 1.5 0 -1.3"/></filter>`);
    body.push(`<rect width="${W}" height="${H}" filter="url(#${id}-sp)" opacity="${num(p.speckleOp)}" style="mix-blend-mode:${p.speckleBlend}"/>`);
  }
  return { defs: defs.join(''), body: body.join('') };
}

function buildTiedye(w, h, id, p) {
  const W = num(w), H = num(h);
  const centers = Array.isArray(p.centers) ? p.centers : [];
  const grads = centers.map((ct, i) =>
    `<radialGradient id="${id}-g${i}" cx="${ct.cx}" cy="${ct.cy}" r="${ct.r}">`
    + `<stop offset="0" stop-color="${ct.color}" stop-opacity="${ct.core ?? 0.85}"/>`
    + `<stop offset="${ct.mid ?? 0.55}" stop-color="${ct.color}" stop-opacity="${ct.midOp ?? 0.3}"/>`
    + `<stop offset="1" stop-color="${ct.color}" stop-opacity="0"/></radialGradient>`).join('');
  const defs = `<filter id="${id}-warp" x="-12%" y="-12%" width="124%" height="124%">`
    + `<feTurbulence type="turbulence" baseFrequency="${p.warpFreq}" numOctaves="${p.warpOct}" seed="${p.seed}" stitchTiles="stitch" result="n"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${p.warp}" xChannelSelector="R" yChannelSelector="G"/></filter>`
    + grads;
  const blooms = centers.map((_, i) => `<rect width="${W}" height="${H}" fill="url(#${id}-g${i})"/>`).join('');
  let rings = '';
  if (p.rings) {
    const sw = num(Math.min(w, h) * 0.0016);
    rings = centers.map((ct) => {
      const cx = num(ct.cx * w), cy = num(ct.cy * h), base = ct.r * Math.min(w, h);
      let s = '';
      for (let k = 1; k <= 5; k++) s += `<circle cx="${cx}" cy="${cy}" r="${num(base * k / 6)}" fill="none" stroke="${ct.color}" stroke-width="${sw}" stroke-opacity="${num(p.ringOp)}"/>`;
      return s;
    }).join('');
  }
  const body = `<g filter="url(#${id}-warp)" opacity="${num(p.opacity)}" style="mix-blend-mode:${p.blend}">${blooms}${rings}</g>`;
  return { defs, body };
}

function buildHanddrawn(w, h, id, p) {
  const W = num(w), H = num(h);
  const rows = tintRows(p.tint || '#3a3229');
  const defs = [
    `<filter id="${id}-gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${p.grainFreq}" numOctaves="${p.grainOct}" seed="${p.seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="${rows} ${p.grainK} ${p.grainK} ${p.grainK} 0 ${p.grainOff}"/></filter>`,
  ];
  const body = [
    `<rect width="${W}" height="${H}" filter="url(#${id}-gr)" opacity="${num(p.grainOp)}" style="mix-blend-mode:${p.blend}"/>`,
  ];
  if (p.hatch) {
    // 方向性排线:各向异性低频噪 → 细长笔触感
    defs.push(`<filter id="${id}-ht" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${p.hatchFreq}" numOctaves="1" seed="${(p.seed || 0) + 1}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="${rows} ${p.hatchK} ${p.hatchK} ${p.hatchK} 0 ${p.hatchOff}"/></filter>`);
    body.push(`<rect width="${W}" height="${H}" filter="url(#${id}-ht)" opacity="${num(p.hatchOp)}" style="mix-blend-mode:${p.blend}"/>`);
  }
  return { defs: defs.join(''), body: body.join('') };
}

function buildTopographic(w, h, id, p) {
  const W = num(w), H = num(h);
  const defs = `<filter id="${id}-topo" x="0" y="0" width="100%" height="100%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${p.freq}" numOctaves="${p.oct}" seed="${p.seed}" stitchTiles="stitch" result="n"/>`
    + `<feComponentTransfer in="n" result="c"><feFuncA type="table" tableValues="${p.bands || bandTable(p.bandCount)}"/></feComponentTransfer>`
    + `<feFlood flood-color="${p.tint}" result="f"/>`
    + `<feComposite in="f" in2="c" operator="in"/></filter>`;
  const body = `<rect width="${W}" height="${H}" filter="url(#${id}-topo)" opacity="${num(p.lineOp)}" style="mix-blend-mode:${p.blend}"/>`;
  return { defs, body };
}

const BUILDERS = {
  rubbing: buildRubbing, tiedye: buildTiedye, handdrawn: buildHanddrawn, topographic: buildTopographic,
};

// 预设清单(供 UI / 图例 / 遍历)
export const TEXTURE_PRESETS = [
  { name: 'rubbing', label: '拓质' },
  { name: 'tiedye', label: '扎染' },
  { name: 'handdrawn', label: '手绘' },
  { name: 'topographic', label: '拓扑' },
];

export function isTexturePreset(name) { return !!BUILDERS[name]; }

/**
 * 造一个可复用、可编辑的纹理句柄。
 * @param {string} name  预设名(rubbing|tiedye|handdrawn|topographic);未知名回退 rubbing
 * @param {object} overrides  覆盖预设默认参数(浅合并;数组类整体替换)
 * @returns {{ name:string, params:object, build:(w:number,h:number,id?:string)=>{defs:string,body:string} }}
 */
export function texture(name = 'rubbing', overrides = {}) {
  const key = BUILDERS[name] ? name : 'rubbing';
  const params = { ...TEXTURE_DEFAULTS[key], ...(overrides || {}) };
  return {
    name: key,
    params,
    build(w, h, id = 'tx') { return BUILDERS[key](w, h, String(id), params); },
  };
}

/**
 * 把渲染层传入的 texture 选项解析成纹理句柄。
 * opts.texture 可为:undefined(用变体默认拓质)/ 预设名字符串 / { name, ...overrides } 对象。
 * 拓质默认路径会吃变体调好的频率与透明度(A1 长条与小月卡各传各的 scale),故原味不变。
 * @param {*} texOpt  渲染 opts.texture
 * @param {object} c  变体配置(含 texFreq/texOp/speckle/speckleOp)
 * @param {object} scale  { freqMul, opMul, speckleFreq, speckleOpMul } 尺寸自适应
 */
export function resolveTexture(texOpt, c, scale = {}) {
  const { name: rawName, ...overrides } = (texOpt && typeof texOpt === 'object') ? texOpt : {};
  const name = typeof texOpt === 'string' ? texOpt : rawName;
  if (name && name !== 'rubbing') return texture(name, overrides);
  // 拓质(默认):吃变体调好的频率/透明度 + 尺寸自适应,再让调用方覆盖
  return texture('rubbing', {
    mottleFreq: (c.texFreq ?? 0.06) * (scale.freqMul || 1),
    mottleOp: (c.texOp ?? 0.15) * (scale.opMul || 1),
    speckle: c.speckle !== false,
    speckleFreq: scale.speckleFreq ?? 0.14,
    speckleOp: (c.speckleOp ?? 0.22) * (scale.speckleOpMul || 1),
    ...overrides,
  });
}
