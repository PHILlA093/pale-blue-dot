/* ============================================================================
 * 穷观 · 物理实验台 · 组 5 · 热学与分子（js/pslab/therm.js）
 * Build ID: QG-20260920-5e5d5a          （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向实验台注册表登记两个热学/分子动理论实验
 *     oil-film     用油膜法估测油酸分子的大小   单分子油膜；d = V/S
 *     isothermal   探究气体等温变化的规律       玻意耳定律 pV = C；p–1/V 图线
 * 纯 ES5、零外部依赖、不用 eval / new Function（守观澜的严格 CSP）；
 * 画面全部用调用方给的 Canvas 2D 上下文画，不建任何 DOM 节点。
 *
 * 契约：window.QG_PSLAB.register(id, spec)，spec 字段见 docs/物理实验台设计.md §4。
 *
 * ----------------------------------------------------------------------------
 * 【原理 / 器材 / 步骤 / 数据处理 的权威来源核对】（不凭记忆编造）
 *
 * · 油膜法：三点理想化假设（油酸分子视为球形、油膜看成单分子层、分子紧挨在一起）、
 *   器材还缺"痱子粉"、"把油酸和酒精按一定比例配制好"、每滴溶液体积由滴数换算、
 *   "不足半格舍去、多于半格算一格"数格子求面积、d = V/S、
 *   "水面上痱子粉撒得太多，油膜没有充分展开"会使 d 明显偏大、
 *   "将滴入的油酸酒精溶液体积作为油酸体积进行计算"（漏乘浓度）也会使 d 偏大：
 *     http://www.jyeoo.com/shiti/6733110d-8c15-4715-5a90-9b5f325c0785   （菁优网·器材与数量级 6.3×10⁻¹⁰ m）
 *     http://www.jyeoo.com/shiti/5be1051b-715f-4a15-b55e-925cacd3da9d   （菁优网·步骤顺序 B D C E F A G H）
 *     http://www.jyeoo.com/shiti/1087cf7c-a15f-4415-b5e2-8472538a2ca1   （菁优网·d 偏大的原因）
 *     http://www.chuanjiaoshe.com/upload/2025-02-17/f8998d05-380a-47b0-903e-07503051d622.pdf （数格子法求油膜面积）
 *
 * · 等温变化：①在注射器内用活塞封闭一定质量的气体，把注射器、压强传感器、数据采集器、
 *   计算机依次连接；②缓慢移动活塞至某位置，待示数稳定后记录 V 和 p；③重复多次；
 *   ④作图分析。需要保持不变的量是气体的"质量"和"温度"；推拉活塞时手不可以握住注射器
 *   气体部分；以 p 为纵轴、1/V 为横轴作图；图线弯曲的原因（漏气、温度升高、外界气体进入）；
 *   V–1/p 图线不过原点是"注射器前端与橡皮帽连接处的气体（死体积）"造成：
 *     https://www.jyeoo.com/shiti/cd51087e-7158-159d-95f5-6fb258f1af72/  （菁优网·步骤与守恒量）
 *     https://www.jyeoo.com/shiti/c0210ae8-15c3-15a1-8b55-6a9252efa9f5   （菁优网·死体积）
 *     https://www.jyeoo.com/shiti/fed10eab-415d-415c-95d1-c22557531589   （菁优网·胶管内气体）
 *     https://www.sste.com/kj/resource/WULIXUANXIU3-3.pdf                （教材·选修3-3 实验原文）
 *
 * · 2017 版课程标准"学生必做实验"清单（含上述两个实验）：
 *     http://i.yanxiu.com/xb/front/viewHomework.tc?hwid=17965450&projectid=4088
 * ========================================================================== */
(function () {
  'use strict';

  var BUILD = 'QG-20260920-5e5d5a';
  var TAU = Math.PI * 2;

  /* ====================================================================== *
   * 0. 通用小工具（纯函数，不碰 DOM）                                       *
   * ====================================================================== */

  function isfin(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
  function num(v, d) {
    var x = (typeof v === 'string') ? parseFloat(v) : v;
    return isfin(x) ? x : d;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fx(x, n) { return isfin(x) ? x.toFixed(n) : '—'; }
  function sq(x) { return x > 0 ? Math.sqrt(x) : 0; }

  /* 标准正态扰动：优先用核心给的 ctx.noise(sigma)，缺了用 Box–Muller 兜底；
     NaN / Infinity 一律退回 0 —— measure 绝不吐 NaN 进数据表。 */
  function nrm(ctx, sigma) {
    if (!isfin(sigma) || sigma <= 0) return 0;
    if (ctx && typeof ctx.noise === 'function') {
      var v = null;
      try { v = ctx.noise(sigma); } catch (e) { v = null; }
      if (isfin(v)) return v;
    }
    var r = (ctx && typeof ctx.rnd === 'function') ? ctx.rnd : Math.random;
    var u1 = 0.5, u2 = 0.5;
    try { u1 = r(); u2 = r(); } catch (e2) { u1 = Math.random(); u2 = Math.random(); }
    if (!isfin(u1) || u1 <= 1e-12) u1 = 1e-12;
    if (!isfin(u2)) u2 = 0.5;
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
  }

  function slope0(xs, ys) {
    var sxy = 0, sxx = 0, i;
    for (i = 0; i < xs.length; i++) { sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; }
    return sxx > 1e-18 ? sxy / sxx : 0;
  }
  function mean(a) {
    var s = 0, i;
    if (!a || !a.length) return 0;
    for (i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }
  function sdev(a) {
    var m, s = 0, i, n = a ? a.length : 0;
    if (n < 2) return 0;
    m = mean(a);
    for (i = 0; i < n; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (n - 1));
  }
  function r2of(xs, ys) {
    var n = xs.length, i, mx, my, sxy = 0, sxx = 0, syy = 0;
    if (n < 3) return 1;
    mx = mean(xs); my = mean(ys);
    for (i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) * (xs[i] - mx);
      syy += (ys[i] - my) * (ys[i] - my);
    }
    if (sxx < 1e-18 || syy < 1e-18) return 1;
    return clamp((sxy * sxy) / (sxx * syy), 0, 1);
  }

  /* ====================================================================== *
   * 1. 画图通用件                                                          *
   * ====================================================================== */

  function ctxOf(g) { return (g && g.c) ? g.c : null; }
  function paperOf(g) { return (g && typeof g.paper === 'string' && g.paper) ? g.paper : '#F4F1EA'; }
  function inkOf(g) { return (g && typeof g.ink === 'string' && g.ink) ? g.ink : '#26221C'; }

  /* 字体：实验台统一的纸面观感是 Georgia **斜体**（契约 §5，与沙盒、其它 16 个实验
     同一调子）。核心的宽容签名 g.font(size) 默认就返回斜体，g.font(size,true,true)
     是斜体+粗 —— 所以这里一律走**布尔形式**，不要再传 'normal' 把它掰直。
     upright=true 只留给"真实器物上本来就直立的字"，本文件里只有两处：
       ① 压强传感器的液晶数字读数（fx(pTrue,1) 与单位 'kPa'）；
       ② 注射器筒身上的体积刻度数字（0、2、…、20）。
     理由：这两处是**仪表/器具本身的字符**，真实器物上就是直立的，画成斜体反而不像仪器；
     图里的标注、物理量、数值面板、结论文字一律斜体（物理量本来就该斜体）。 */
  function setFont(g, px, bold, upright) {
    var c = g.c, s = null, p = Math.max(6, Math.round(px));
    if (typeof g.font === 'function') {
      try { s = g.font(p, !upright, !!bold); } catch (e) { s = null; }
      if (typeof s !== 'string' || !s) { try { s = g.font(p); } catch (e2) { s = null; } }
    }
    if (typeof s !== 'string' || !s) {
      /* 核心没给 font 时的兜底：CSS font 简写顺序是 style weight size family */
      s = (upright ? '' : 'italic ') + (bold ? 'bold ' : '') + p + 'px Georgia,"Times New Roman",serif';
    }
    c.font = s;
  }

  function txt(g, s, x, y, px, bold, align, color, upright) {
    var c = g.c;
    c.save();
    setFont(g, px, !!bold, !!upright);
    c.fillStyle = color || inkOf(g);
    c.textAlign = align || 'left';
    c.textBaseline = 'middle';
    c.fillText(s, x, y);
    c.restore();
  }

  function seg(g, x1, y1, x2, y2, color, w, dash) {
    var c = g.c;
    c.save();
    c.strokeStyle = color || inkOf(g);
    c.lineWidth = isfin(w) ? w : 1;
    if (dash && c.setLineDash) { try { c.setLineDash(dash); } catch (e) { } }
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.restore();
  }

  function head(g, x, y, ang, size, color) {
    var c = g.c;
    c.save();
    c.fillStyle = color || inkOf(g);
    c.translate(x, y);
    c.rotate(ang);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-size, size * 0.42);
    c.lineTo(-size, -size * 0.42);
    c.closePath();
    c.fill();
    c.restore();
  }

  function box(g, x, y, w, h, fill, stroke, lw) {
    var c = g.c;
    c.save();
    if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = isfin(lw) ? lw : 1;
      c.strokeRect(x, y, w, h);
    }
    c.restore();
  }

  function panel(g, x, y, w, lines, size) {
    var c = g.c, pad = 7, lh = size + 5, h = pad * 2 + lh * lines.length, i;
    c.save();
    c.globalAlpha = 0.90;
    c.fillStyle = paperOf(g);
    c.fillRect(x, y, w, h);
    c.globalAlpha = 1;
    c.strokeStyle = inkOf(g);
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.restore();
    for (i = 0; i < lines.length; i++) {
      txt(g, lines[i][0], x + pad, y + pad + lh * i + lh / 2, size, !!lines[i][1], 'left');
    }
    return h;
  }

  /* 确定性伪随机（画图绝不能用 Math.random，否则每帧都在抖） */
  function prand(i) {
    var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  /* 椭圆路径：优先用原生 ellipse（WebView2/Chromium 都有），老内核退化成
     translate+scale+arc —— draw 必须永不抛异常。注意 finish 由调用方 fill/stroke。 */
  function ellipsePath(g, x, y, rx, ry) {
    var c = g.c;
    if (typeof c.ellipse === 'function') {
      try { c.ellipse(x, y, rx, ry, 0, 0, TAU); return; } catch (e) { }
    }
    c.save();
    c.translate(x, y);
    c.scale(1, rx > 0 ? (ry / rx) : 1);
    c.arc(0, 0, Math.max(0.02, rx), 0, TAU);
    c.restore();
  }

  /* ====================================================================== *
   * 2. 实验一：oil-film —— 用油膜法估测油酸分子的大小                       *
   * ====================================================================== *
   *
   * 【模型】油酸分子看成球形、油膜看成单分子层、分子紧挨在一起，则分子直径
   *     d = V / S        （V 为一滴油酸酒精溶液中纯油酸的体积，S 为油膜面积）
   *   一滴溶液的体积  V滴 = 1 mL / (每毫升滴数)
   *   一滴中纯油酸体积 V  = η · V滴      （η 为溶液体积分数／浓度）
   *   实测面积 S 由坐标纸数格子得到：S = S真 ·(1 + 相对误差)
   *   S真 = V/d0 · κ ，其中 κ 是"成膜完整度"：溶液越浓、一滴里的油酸越多，
   *   酒精挥发后越容易留下没有充分展开的油酸团块（多分子层），使能读出的
   *   单分子膜面积相对偏小 —— 这正是真题里"油膜没有充分展开会使 d 明显偏大"
   *   那一条误差来源（外加水面上痱子粉撒得太多也会阻碍展开）。
   *   所以量出来的不是 d0 本身，而是 d = d0/κ ·(1/成膜受阻因子)。
   * 【数格子误差】σ格 = 0.5·√(周长/格边长)·(格边长)²（周长上每个格子按
   *   "不足半格舍去、多于半格算一格"取舍带来的量化误差），方格越大误差越大。
   * 【数据处理】改变浓度或滴数得到多组 (V, S)，作 S–V 图线，是过原点的直线，
   *   斜率 k = 1/d。
   * ====================================================================== */

  var oilAnim = { t: 0 };

  var OIL_FILM = {
    id: 'oil-film',
    name: '用油膜法估测油酸分子的大小',
    group: '热学与分子',
    aim: '用油膜法测出油酸分子的直径，估测分子大小的数量级，并分析误差来源',

    principle: '把油酸分子看成球形、把水面上散开的油酸膜看成单分子层、并认为分子是紧挨在一起的，' +
      '则油膜的厚度就等于油酸分子的直径 d = V/S：V 是一滴油酸酒精溶液中纯油酸的体积，S 是油膜的面积。' +
      '油酸不能直接滴在水面上（太厚，展不成单分子层），要先配成油酸酒精溶液：η = 油酸体积/溶液体积。' +
      '用注射器把溶液一滴滴滴入量筒，量出每毫升的滴数 N，则一滴溶液的体积 V滴 = 1 mL/N，' +
      '其中纯油酸的体积 V = η·V滴。把一滴溶液滴在撒了痱子粉的水面上，酒精溶于水并挥发，油酸在水面展开成单分子油膜，' +
      '用玻璃板描下轮廓、放到坐标纸上数格子（不足半格舍去、多于半格算一格）求出面积 S，即可由 d = V/S 估测分子直径。' +
      '改变浓度或滴数得到多组数据，作 S–V 图线，图线是过原点的直线，斜率的倒数就是 d。',

    apparatus: [
      '油酸酒精溶液（体积比约 0.06%，即油酸与酒精按一定比例配制的稀溶液）',
      '注射器（或滴管）、量筒（量 1 mL 的滴数）',
      '浅盘（培养皿，盘要足够大）、清水',
      '痱子粉（或石膏粉、滑石粉）',
      '玻璃板、彩笔（描油膜轮廓）',
      '坐标纸（方格纸）、刻度尺'
    ],

    steps: [
      '配制油酸酒精溶液：把油酸溶于酒精，配成体积比浓度 η 的稀溶液（如 6 mL 油酸加酒精配成 10⁴ mL 溶液，η = 0.06%）。',
      '用注射器把溶液一滴滴滴入量筒，记下每增加 1 mL 的滴数 N，算出一滴溶液的体积 V滴 = 1 mL/N。',
      '向浅盘中倒入约 2 cm 深的水，待水面平静后，在水面上均匀地撒上一层薄薄的痱子粉（撒得太多会阻碍油膜展开）。',
      '用注射器（滴管）在水面中央滴入一滴油酸酒精溶液，让油膜尽可能散开，等油膜形状稳定下来。',
      '把玻璃板平放在浅盘上，用彩笔把油膜的轮廓描在玻璃板上。',
      '把玻璃板放在坐标纸上，数出轮廓内所占的方格数（不足半格舍去、多于半格算一格），算出油膜面积 S。',
      '由 V = η·V滴 算出一滴溶液中纯油酸的体积，由 d = V/S 估测出油酸分子的直径。',
      '改变溶液的浓度（或每毫升的滴数）重复实验，得到多组 (V, S)，作 S–V 图线，用图线斜率求出 d。'
    ],

    params: [
      { key: 'conc', label: '溶液体积分数 η', unit: '%', min: 0.03, max: 0.15, step: 0.01, value: 0.06 },
      { key: 'drops', label: '每毫升滴数 N', unit: '滴/mL', min: 40, max: 120, step: 1, value: 75 },
      { key: 'powder', label: '痱子粉用量（适量=1）', unit: '', min: 0.30, max: 1.60, step: 0.10, value: 1.00 },
      { key: 'grid', label: '坐标纸方格边长', unit: 'cm', min: 0.5, max: 2.0, step: 0.5, value: 1.0 }
    ],

    measure: function (p, ctx) {
      var eta = clamp(num(p.conc, 0.06), 0.001, 5) / 100;      /* 体积分数 */
      var drops = clamp(num(p.drops, 75), 5, 500);              /* 滴/mL */
      var powder = clamp(num(p.powder, 1.0), 0.05, 3);
      var grid = clamp(num(p.grid, 1.0), 0.2, 5) * 1e-2;        /* m */

      var d0 = 5.5e-10;         /* m 油酸分子的真实大小（单分子层厚度） */
      var Vh = 9.0e-11;         /* m³ 成膜完整度的半饱和体积 */

      /* 一滴溶液中纯油酸的体积：V = η·(1 mL/N)。
         这里 V 是**算出来的**（浓度是配制时的标称值、滴数是整数计数），它的
         不确定度属于"整批数据一起偏"的**系统误差**，不是逐次读数的随机误差，
         所以 V 在同一组参数下每次测量都相同 —— 这也是作图法把横轴取为准确值
         的常规做法。所有的随机误差都记在被测量 S（数格子得来的油膜面积）上。 */
      var V = eta * (1e-6 / drops);
      if (!(V > 0)) V = 8e-12;

      var kappa = 1 / (1 + V / Vh);                             /* 成膜完整度 */
      var powderBlock = powder > 1 ? 1 / (1 + 0.35 * (powder - 1)) : 1;
      var S_true = (V / d0) * kappa * powderBlock;              /* m² 实际成膜面积 */

      /* 数格子误差：轮廓描线误差 + 半格取舍的量化误差 */
      var perimeter = 2 * Math.sqrt(Math.PI * Math.max(S_true, 1e-8));
      var sQuant = 0.5 * Math.sqrt(perimeter / grid) * grid * grid;
      var relLine = 0.020 * (powder < 1 ? (1 + 0.6 * (1 - powder)) : 1);
      var relQ = sQuant / Math.max(S_true, 1e-9);
      var relS = sq(relLine * relLine + relQ * relQ);
      var S = S_true * (1 + nrm(ctx, relS));
      if (!(S > 0)) S = S_true;

      var N = Math.max(1, Math.round(S / (grid * grid)));
      var d = V / S;                                            /* m */

      return {
        eta: eta * 100,
        drops: drops,
        V: V * 1e12,          /* 10⁻¹² m³ */
        N: N,                 /* 格 */
        S: S * 1e4,           /* cm² */
        d: d * 1e10           /* 10⁻¹⁰ m */
      };
    },

    columns: [
      { key: 'eta', label: '体积分数 η', unit: '%' },
      { key: 'drops', label: '每毫升滴数 N', unit: '滴/mL' },
      { key: 'V', label: '纯油酸体积 V', unit: '10⁻¹² m³' },
      { key: 'N', label: '方格数', unit: '格' },
      { key: 'S', label: '油膜面积 S', unit: 'cm²' },
      { key: 'd', label: '分子直径 d', unit: '10⁻¹⁰ m' }
    ],

    graph: {
      /* fit 用 'linear'：V 是算出来的准确值，同一组参数下每次测量都一样，
         核心 fitLinear 对这种"x 全相同"的退化情形直接返回 fit=null
         （契约 §7.3 只要求"有拟合时" r2>0.9）。 */
      x: 'V', y: 'S', fit: 'linear',
      title: 'S–V 图线',
      note: '理论上过原点（S = V/d），斜率 k = S/V = 1/d ⇒ d = 10⁻⁸/k（V 用 10⁻¹² m³、S 用 cm² 时）'
    },

    conclude: function (rows, p, ctx) {
      var i, ds = [], xs = [], ys = [], k, dm, sd, rel;
      if (!rows || !rows.length) {
        return {
          value: null, unit: 'm',
          text: '还没有数据：请先点「📏 测量一次」，并改变溶液浓度或每毫升滴数多测几组。',
          errors: ['油膜没有充分展开（浓度过高、痱子粉撒得太多）会使 S 偏小、d 偏大',
            '按"不足半格舍去、多于半格算一格"数格子带来面积误差，方格越大误差越大',
            '一滴溶液的体积由滴数换算而来，滴数与浓度的误差会直接传给 V']
        };
      }
      for (i = 0; i < rows.length; i++) {
        if (isfin(rows[i].d)) ds.push(rows[i].d);
        if (isfin(rows[i].V) && isfin(rows[i].S)) { xs.push(rows[i].V); ys.push(rows[i].S); }
      }
      k = slope0(xs, ys);                       /* S/V，显示单位 cm²/(10⁻¹² m³) */
      var dFit = (k > 1e-9) ? (1e-8 / k) : 0;   /* m */
      dm = ds.length ? mean(ds) : dFit * 1e10;  /* 10⁻¹⁰ m */
      sd = sdev(ds);
      rel = dm > 0 ? sd / dm * 100 : 0;
      return {
        value: dm * 1e-10, unit: 'm',
        text: '测得油酸分子的直径 d = ' + (dm * 1e-10).toExponential(2) + ' m（即 ' + fx(dm, 1) + '×10⁻¹⁰ m，' +
          '数量级 10⁻¹⁰ m）；由 S–V 图线斜率得 d = ' + (dFit > 0 ? (dFit).toExponential(2) : '—') + ' m。' +
          ds.length + ' 组数据的相对标准差 ' + fx(rel, 1) + '%，与油酸分子大小的公认数量级 10⁻¹⁰ m 相符。',
        errors: [
          '油膜没有充分展开（溶液浓度过高、一滴里油酸太多，或水面痱子粉撒得太多）会使读出的面积 S 偏小、算出的 d 偏大',
          '数格子求面积：按"不足半格舍去、多于半格算一格"取舍，方格越大、油膜轮廓越不规则，误差越大',
          '一滴溶液的体积由"每毫升多少滴"换算，滴数计数与浓度配制的误差属于整批数据一起偏的系统误差，会按比例传给 V',
          '把一滴溶液的体积当作纯油酸体积代入计算（漏乘体积分数 η）会使 d 偏大很多；浅盘太小、油膜碰到盘边无法充分展开也会使 d 偏大'
        ]
      };
    },

    /* ---------------- 画面：浅盘 + 油膜轮廓 + 坐标纸数格子 + 滴管 ---------------- */
    draw: function (g, p, state) {
      var c = ctxOf(g);
      if (!c) return;
      var w = Math.max(160, num(g.w, 700)), h = Math.max(110, num(g.h, 440));
      var INK = inkOf(g), PAP = paperOf(g);
      var i, j;

      state = state || {};
      var eta = clamp(num(p.conc, 0.06), 0.001, 5) / 100;
      var drops = clamp(num(p.drops, 75), 5, 500);
      var powder = clamp(num(p.powder, 1.0), 0.05, 3);
      var gridCm = clamp(num(p.grid, 1.0), 0.2, 5);
      var tt = oilAnim.t;

      /* 画面上用"理想成膜"面积（不含随机误差），避免每帧抖动 */
      var V = eta * (1e-6 / drops);
      var kappa = 1 / (1 + V / 9.0e-11);
      var powderBlock = powder > 1 ? 1 / (1 + 0.35 * (powder - 1)) : 1;
      var S = (V / 5.5e-10) * kappa * powderBlock;      /* m² */
      var N = Math.max(1, Math.round(S / Math.pow(gridCm * 0.01, 2)));
      var d = V / Math.max(S, 1e-9);

      c.save();
      c.fillStyle = PAP;
      c.fillRect(0, 0, w, h);

      /* ---- 坐标纸（方格纸） ---- */
      var cx = w * 0.46, cyc = h * 0.60;
      var pxPerCm = Math.min(w * 0.175, h * 0.42) / 13.0;   /* 13 cm 半径刚好铺满画面 */
      var stepPx = Math.max(4, gridCm * pxPerCm);
      c.save();
      c.globalAlpha = 0.30;
      c.strokeStyle = '#7C8FA6';
      c.lineWidth = 0.6;
      c.beginPath();
      var x0 = cx - Math.ceil(cx / stepPx) * stepPx;
      for (i = 0; x0 + i * stepPx < w; i++) {
        var gx = x0 + i * stepPx;
        if (gx < 0 || gx > w) continue;
        c.moveTo(gx, 0); c.lineTo(gx, h);
      }
      var y0 = cyc - Math.ceil(cyc / stepPx) * stepPx;
      for (i = 0; y0 + i * stepPx < h; i++) {
        var gy = y0 + i * stepPx;
        if (gy < 0 || gy > h) continue;
        c.moveTo(0, gy); c.lineTo(w, gy);
      }
      c.stroke();
      c.restore();
      txt(g, '坐标纸（方格边长 ' + fx(gridCm, 1) + ' cm）', 10, h - 14, 11, false, 'left');

      /* ---- 浅盘（水面） ---- */
      var rx = Math.min(w * 0.34, h * 0.80), ry = rx * 0.42;
      c.save();
      c.globalAlpha = 0.55;
      c.fillStyle = '#CFE3EC';
      c.beginPath(); ellipsePath(g, cx, cyc, rx, ry); c.fill();
      c.restore();
      c.save();
      c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath(); ellipsePath(g, cx, cyc, rx, ry); c.stroke();
      c.restore();

      /* ---- 油膜轮廓（确定的、非圆的不规则闭合曲线；半径按 sqrt(S/π) 缩放） ---- */
      var RF = Math.sqrt(Math.max(S, 1e-8) / Math.PI) * 100 * pxPerCm;  /* px */
      var squash = ry / rx;
      function blobR(a) {
        return RF * (1 + 0.055 * Math.cos(3 * a + 1.1) + 0.040 * Math.cos(5 * a + 2.3) + 0.028 * Math.cos(7 * a + 0.7));
      }
      function blobPt(a) {
        var r = blobR(a);
        return { x: cx + r * Math.cos(a), y: cyc + r * Math.sin(a) * squash };
      }
      /* 油膜内的方格（亮起来，表示"数过的格子"） */
      var cells = 0, ax, ay, pt, inside;
      c.save();
      c.globalAlpha = 0.42;
      c.fillStyle = '#E8B84B';
      for (ax = cx - RF; ax <= cx + RF && cells < 1600; ax += stepPx) {
        for (ay = cyc - RF * squash; ay <= cyc + RF * squash && cells < 1600; ay += stepPx) {
          /* 用"椭圆坐标"判断格子中心是否在轮廓内 */
          var dx = (ax + stepPx / 2 - cx), dy = (ay + stepPx / 2 - cyc) / squash;
          var rr = Math.sqrt(dx * dx + dy * dy);
          var ang = Math.atan2(dy, dx);
          if (rr <= blobR(ang)) {
            c.fillRect(ax, ay, stepPx, stepPx);
            cells++;
          }
        }
      }
      c.restore();

      /* 油膜轮廓线 */
      c.save();
      c.strokeStyle = '#B8860B'; c.lineWidth = 2;
      c.beginPath();
      pt = blobPt(0);
      c.moveTo(pt.x, pt.y);
      for (i = 1; i <= 72; i++) { pt = blobPt(i * TAU / 72); c.lineTo(pt.x, pt.y); }
      c.closePath();
      c.stroke();
      c.globalAlpha = 0.18;
      c.fillStyle = '#E8B84B';
      c.fill();
      c.restore();

      /* ---- 痱子粉（只在油膜外，油膜把它推开了） ---- */
      for (i = 0; i < 220; i++) {
        var aa = prand(i * 3.1) * TAU;
        var rr2 = rx * (0.42 + 0.56 * prand(i * 7.7));
        var px2 = cx + rr2 * Math.cos(aa), py2 = cyc + rr2 * Math.sin(aa) * squash;
        var ddx = px2 - cx, ddy = (py2 - cyc) / squash;
        if (Math.sqrt(ddx * ddx + ddy * ddy) < blobR(Math.atan2(ddy, ddx)) + 4) continue;
        c.save();
        c.globalAlpha = 0.50 * clamp(0.45 + powder * 0.65, 0, 1);
        c.fillStyle = '#FFFFFF';
        c.beginPath(); c.arc(px2, py2, 1.4 + 1.1 * prand(i * 11.3), 0, TAU); c.fill();
        c.restore();
      }
      txt(g, '痱子粉', cx + rx * 0.72, cyc - ry * 0.62, 11, false, 'center');

      /* ---- 水面波纹（step 推进） ---- */
      for (i = 0; i < 3; i++) {
        var rw = ((tt * 26 + i * 34) % (rx * 1.25));
        c.save();
        c.globalAlpha = clamp(0.16 - i * 0.04, 0, 0.16);
        c.strokeStyle = '#5B8CA8'; c.lineWidth = 1.2;
        c.beginPath(); ellipsePath(g, cx, cyc, rw, rw * squash); c.stroke();
        c.restore();
      }

      /* ---- 滴管与悬着的一滴溶液（step 推进：周期性落下一滴） ---- */
      var dropX = cx - rx * 0.30, dropY0 = h * 0.10;
      c.save();
      c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(dropX - 7, dropY0 - 26); c.lineTo(dropX - 7, dropY0 + 6);
      c.lineTo(dropX - 2, dropY0 + 16); c.lineTo(dropX + 2, dropY0 + 16);
      c.lineTo(dropX + 7, dropY0 + 6); c.lineTo(dropX + 7, dropY0 - 26);
      c.closePath(); c.stroke();
      c.globalAlpha = 0.30; c.fillStyle = '#8FB6C8'; c.fill();
      c.restore();
      txt(g, '滴管', dropX, dropY0 - 36, 11, false, 'center');
      var fallT = (tt % 3.2) / 3.2;
      var dyF = dropY0 + 18 + (cyc - ry * 0.25 - dropY0 - 18) * clamp(fallT * 1.6, 0, 1);
      if (fallT < 0.72) {
        c.save();
        c.globalAlpha = 0.85;
        c.fillStyle = '#D9A93B';
        c.beginPath();
        ellipsePath(g, dropX, dyF, 3.6, 5.0);
        c.fill();
        c.restore();
      }

      /* ---- 轮廓标注与"数格子"提示 ---- */
      var lab = blobPt(-0.85);
      seg(g, lab.x, lab.y, lab.x - 40, lab.y - 26, '#B8860B', 1, [3, 3]);
      txt(g, '油膜轮廓（单分子层）', lab.x - 44, lab.y - 30, 11, true, 'right', '#8A6508');

      /* ---- 浅盘标注 ---- */
      seg(g, cx - rx, cyc + ry, cx - rx - 18, cyc + ry + 16, INK, 1, [3, 3]);
      txt(g, '浅盘（水）', cx - rx - 22, cyc + ry + 20, 11, false, 'right');

      /* ---- 数据面板 ---- */
      var lines = [
        ['η = ' + fx(eta * 100, 2) + '%    N = ' + fx(drops, 0) + ' 滴/mL', true],
        ['V = ' + fx(V * 1e12, 2) + ' ×10⁻¹² m³', false],
        ['S ≈ ' + fx(N * gridCm * gridCm, 1) + ' cm²（' + N + ' 格）', false],
        ['d = V/S = ' + fx(d * 1e10, 2) + ' ×10⁻¹⁰ m', true]
      ];
      if (state.rows && state.rows.length) {
        var rr3 = state.rows[state.rows.length - 1];
        if (isfin(rr3.d)) lines.push(['最近测得 d = ' + fx(rr3.d, 2) + ' ×10⁻¹⁰ m', false]);
      }
      panel(g, w - 210, 12, 198, lines, 11.5);

      txt(g, 'd = V/S：把油酸分子看成球形、油膜看成单分子层', 10, h - 30, 11, false, 'left');
      c.restore();
    },

    step: function (p, state, dt) {
      oilAnim.t += (isfin(dt) ? dt : 0);
      if (oilAnim.t > 1e6) oilAnim.t = 0;
    }
  };

  /* ====================================================================== *
   * 3. 实验二：isothermal —— 探究气体等温变化的规律                         *
   * ====================================================================== *
   *
   * 【模型】玻意耳定律：一定质量的气体在温度不变时 pV = C（常量）。
   *   活塞是"看着刻度"推到位的，所以气体真正占据的体积就是刻度读数 V读（刻度准确），
   *   再加上连接软管里的死体积 V死，于是压强计读数
   *        p = nRT / (V读 + V死)
   *   本模型取 nR = 3.3557×10⁻³ J/K，使 V = 10 mL、T = 25 ℃ 时 p ≈ 100 kPa（≈1 atm）。
   * 【误差】① 体积刻度估读 σV = 0.40 mL × 读数误差水平（20 mL 注射器刻度分度 1 mL，
   *   活塞边缘对准与视差）；
   *   ② 压强计读数相对误差 0.2% × 读数误差水平（数字压强传感器）；
   *   ③ 温度波动：每次读数时气体温度在 T ± fluc/2 内随机起伏 → p 随之起伏。
   *   因为 p 与 1/V读 严格成正比，所以同一参数下重复测量得到的点仍落在同一条
   *   过原点的直线上（pV = nRT·V读/(V读+V死)，V死 = 0 时 pV 严格是常量）。
   * 【数据处理】以 1/V 为横轴、p 为纵轴作图，图线是过原点的直线，斜率 = pV = C。
   *   若把软管死体积考虑进去（V死 ≠ 0），pV 不再严格是常量、图线会偏离原点——
   *   这就是"图线不过原点"的经典原因。
   * ====================================================================== */

  var isoAnim = { t: 0, dispV: null };

  var ISOTHERMAL = {
    id: 'isothermal',
    name: '探究气体等温变化的规律',
    group: '热学与分子',
    aim: '探究一定质量的气体在温度不变时压强与体积的关系，验证玻意耳定律 pV = 常量，并作出 p–1/V 图线',

    principle: '一定质量的气体在温度不变时，压强与体积成反比，即 pV = C（常量），这就是玻意耳定律。' +
      '用活塞在注射器内封闭一定质量的气体，把注射器与压强传感器（或压力表）连接，缓慢推拉活塞改变气体体积 V，' +
      '待示数稳定后同时记录 V 与 p。由玻意耳定律，p 与 V 的乘积应保持不变；' +
      '以 1/V 为横轴、p 为纵轴作图，若图线是一条过原点的直线，就说明 p ∝ 1/V，即 pV 为常量。' +
      '实验必须保证气体的"质量"和"温度"不变：推拉活塞要缓慢、手不能握住注射器封闭气体的部分，' +
      '否则气体温度变化会使图线弯曲；注射器与传感器之间连接软管里的气体（死体积）没有计入 V，' +
      '会使图线不过原点。',

    apparatus: [
      '注射器（20 mL，筒壁标有体积刻度）',
      '橡胶塞（橡皮帽，用来封住注射器前端小孔）',
      '压强传感器（或压力表）、数据采集器与计算机',
      '连接软管（尽量短粗，减小死体积）',
      '铁架台（固定注射器用）、温度计',
      '润滑油（涂在活塞上，兼顾密封与润滑）'
    ],

    steps: [
      '用橡胶塞（橡皮帽）把注射器前端的小孔封住，在注射器内封闭一定质量的气体（活塞上略涂一点润滑油以保证密封）。',
      '把注射器的前端通过软管与压强传感器紧密连接，用铁架台把注射器竖直固定好，再与数据采集器、计算机依次连好。',
      '缓慢移动活塞到某一位置，手不要握住注射器封闭气体的部分，待示数稳定后记录气体的体积 V 和压强 p。',
      '重复步骤 3，从体积较大开始逐步减小体积（再反向取几组），取得 6 组以上 (V, p) 数据。',
      '计算各组数据的 pV 值，比较它们是否近似相等。',
      '以 1/V 为横轴、p 为纵轴作图，图线是过原点的直线即验证了 pV = 常量（也可作 V–1/p 图线，图线与坐标轴的交点反映死体积）。',
      '分析误差：连接软管与注射器前端的死体积、气体温度变化、活塞漏气都会使图线弯曲或不过原点。'
    ],

    params: [
      { key: 'V', label: '气体体积读数 V', unit: 'mL', min: 2.0, max: 20.0, step: 0.5, value: 10.0 },
      { key: 'T', label: '环境温度 T', unit: '℃', min: 15, max: 35, step: 0.5, value: 25 },
      { key: 'dead', label: '软管死体积 V死', unit: 'mL', min: 0, max: 0.8, step: 0.1, value: 0 },
      { key: 'fluc', label: '温度波动幅度', unit: '℃', min: 0, max: 1.5, step: 0.1, value: 0.3 },
      { key: 'readErr', label: '读数误差水平（倍）', unit: '', min: 0.5, max: 2.0, step: 0.1, value: 1.0 }
    ],

    measure: function (p, ctx) {
      var Vs = clamp(num(p.V, 10), 0.2, 100);        /* mL 活塞所处刻度 */
      var Tc = clamp(num(p.T, 25), -20, 80);          /* ℃ */
      var dead = clamp(num(p.dead, 0), 0, 20);        /* mL 连接软管死体积 */
      var fluc = clamp(num(p.fluc, 0.3), 0, 5);       /* ℃ 波动幅度 */
      var re = clamp(num(p.readErr, 1.0), 0.05, 5);   /* 读数误差水平 */

      var nR = 3.3557e-3;                             /* J/K，使 10 mL / 25℃ 时 p ≈ 100 kPa */
      var Tk = 273.15 + Tc + nrm(ctx, fluc / 2);      /* K 本次读数时的气体温度 */
      var dV = 0.40 * re;                             /* mL 体积刻度估读不确定度 */
      var Vread = Vs + nrm(ctx, dV);                  /* mL 记录下来的体积读数 */
      if (!(Vread > 0.05)) Vread = Math.max(0.05, Vs);

      /* 活塞是"看着刻度"推到位再读数的：气体真正占据的体积就是刻度读数 V读
         （刻度本身准确），再外加连接软管里的死体积 V死。所以
             p = nRT /(V读 + V死)
         写成 pV读 = nRT·V读/(V读+V死)：V死 = 0 时 pV 严格为常量，
         而 p 与 1/V读 严格成正比 —— 这正是 p–1/V 图线是过原点直线的原因。 */
      var pTrue = nR * Tk / ((Vread + dead) * 1e-6) / 1000;   /* kPa */
      var pRead = pTrue * (1 + nrm(ctx, 0.002 * re));         /* kPa 压强计读数 */

      return {
        V: Vread,
        p: pRead,
        pV: Vread * pRead,
        invV: 1 / Vread,
        T: Tc
      };
    },

    columns: [
      { key: 'V', label: '体积 V', unit: 'mL' },
      { key: 'p', label: '压强 p', unit: 'kPa' },
      { key: 'pV', label: 'pV', unit: 'kPa·mL' },
      { key: 'invV', label: '1/V', unit: 'mL⁻¹' },
      { key: 'T', label: '温度 T', unit: '℃' }
    ],

    graph: {
      x: 'invV', y: 'p', fit: 'origin',
      title: 'p–1/V 图线',
      note: '过原点的直线，斜率 k = pV = 常量；改变体积 V 多测几组再作图'
    },

    conclude: function (rows, p, ctx) {
      var i, pvs = [], xs = [], ys = [], k, mv, sd, rel, dead, Vs0;
      dead = clamp(num(p && p.dead, 0), 0, 20);
      Vs0 = clamp(num(p && p.V, 10), 0.2, 100);
      if (!rows || !rows.length) {
        return {
          value: null, unit: 'kPa·mL',
          text: '还没有数据：请先点「📏 测量一次」，并改变注射器内气体的体积 V 多测几组。',
          errors: ['注射器与压强传感器之间连接软管中的气体（死体积）没有计入体积，使图线不过原点',
            '推拉活塞太快或用手握住注射器气体部分，使气体温度变化、pV 不再为常量',
            '活塞与筒壁之间漏气（或外界气体进入），气体质量变化使 p–1/V 图线弯曲']
        };
      }
      for (i = 0; i < rows.length; i++) {
        if (isfin(rows[i].pV)) pvs.push(rows[i].pV);
        if (isfin(rows[i].invV) && isfin(rows[i].p)) { xs.push(rows[i].invV); ys.push(rows[i].p); }
      }
      k = slope0(xs, ys);                    /* kPa·mL = pV */
      mv = pvs.length ? mean(pvs) : k;
      sd = sdev(pvs);
      rel = mv > 0 ? sd / mv * 100 : 0;
      return {
        value: mv, unit: 'kPa·mL',
        text: '各组数据的 pV 平均为 ' + fx(mv, 1) + ' kPa·mL（相对标准差 ' + fx(rel, 2) + '%），' +
          'p–1/V 图线的斜率 k = ' + fx(k, 1) + ' kPa·mL，图线是过原点的直线，' +
          '说明一定质量的气体在温度不变时 p 与 1/V 成正比、pV 近似为常量，玻意耳定律成立。' +
          (dead > 0.05 ? ('注意：本次软管死体积取 ' + fx(dead, 1) + ' mL，未计入读数体积，图线已偏离过原点。') : ''),
        errors: [
          '注射器前端与压强传感器之间连接软管中的气体（死体积）没有计入 V，使 p 偏大、图线不过原点或发生弯曲',
          '推拉活塞太快、用手握住注射器封闭气体的部分，使气体温度升高，pV 偏大、p–1/V 图线向上弯曲',
          '活塞与筒壁间漏气或外界气体进入，封闭气体的质量发生变化，图线不再是直线',
          '体积刻度只能估读到 ±' + fx(0.40 * clamp(num(p && p.readErr, 1), 0.05, 5), 2) + ' mL（体积越小时相对误差越大），压强计也有约 ' +
            fx(0.2 * clamp(num(p && p.readErr, 1), 0.05, 5), 2) + '% 的读数误差'
        ]
      };
    },

    /* ---------------- 画面：注射器 + 压强传感器 + 压强计表盘 + 温度计 ---------------- */
    draw: function (g, p, state) {
      var c = ctxOf(g);
      if (!c) return;
      var w = Math.max(180, num(g.w, 720)), h = Math.max(110, num(g.h, 420));
      var INK = inkOf(g), PAP = paperOf(g);
      var i;

      state = state || {};
      var Vt = clamp(num(p.V, 10), 2, 20);
      var Tc = clamp(num(p.T, 25), 15, 35);
      var dead = clamp(num(p.dead, 0), 0, 0.8);
      var fluc = clamp(num(p.fluc, 0.3), 0, 1.5);
      var re = clamp(num(p.readErr, 1.0), 0.5, 2.0);
      var nR = 3.3557e-3;
      var Tk = 273.15 + Tc;

      /* 活塞位置：每帧朝目标体积靠（step 里按 dt 推进；draw 里再补一点，保证"动"） */
      if (!isfin(isoAnim.dispV)) isoAnim.dispV = Vt;
      if (Math.abs(Vt - isoAnim.dispV) < 0.02) isoAnim.dispV = Vt;
      else isoAnim.dispV += (Vt - isoAnim.dispV) * 0.10;
      var Vd = clamp(isoAnim.dispV, 0, 20.5);
      var tt = isoAnim.t;
      /* 压强按"画面上活塞所对应的体积"算，读数与活塞位置始终自洽 */
      var pTrue = nR * Tk / ((Vd + dead) * 1e-6) / 1000;     /* kPa */

      c.save();
      c.fillStyle = PAP;
      c.fillRect(0, 0, w, h);

      /* ---- 布局 ---- */
      var cy = h * 0.50;
      var bh = Math.min(h * 0.20, 70);                 /* 针筒直径 */
      var xb0 = w * 0.34, xb1 = w * 0.80;              /* 针筒内腔（0～20 mL） */
      var yT = cy - bh / 2, yB = cy + bh / 2;
      var xp = xb0 + (xb1 - xb0) * clamp(Vd / 20, 0, 1);

      /* ---- 铁架台 ---- */
      seg(g, w * 0.06, cy - bh * 1.5, w * 0.06, h * 0.90, INK, 3);
      seg(g, w * 0.03, h * 0.90, w * 0.16, h * 0.90, INK, 3.5);
      seg(g, w * 0.06, cy + bh * 0.9, xb0 + 8, cy + bh * 0.9, INK, 2, [5, 3]);

      /* ---- 软管 + 压强传感器 ---- */
      var sx0 = w * 0.09, sw = w * 0.15, sh = h * 0.30, sy0 = cy - sh / 2;
      c.save();
      c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(xb0 - w * 0.055, cy);
      c.quadraticCurveTo(xb0 - w * 0.085, cy + (dead > 0.05 ? 10 : 1), sx0 + sw, cy);
      c.stroke();
      c.restore();
      if (dead > 0.05) {
        c.save();
        c.globalAlpha = clamp(0.25 + dead, 0, 0.75);
        c.strokeStyle = '#C8452F'; c.lineWidth = 7;
        c.beginPath();
        c.moveTo(xb0 - w * 0.055, cy);
        c.quadraticCurveTo(xb0 - w * 0.085, cy + 10, sx0 + sw, cy);
        c.stroke();
        c.restore();
        txt(g, '死体积 ' + fx(dead, 1) + ' mL', xb0 - w * 0.10, cy + 26, 10.5, true, 'center', '#C8452F');
      } else {
        txt(g, '软管', xb0 - w * 0.085, cy + 24, 10.5, false, 'center');
      }
      box(g, sx0, sy0, sw, sh, '#E7E2D4', INK, 1.6);
      txt(g, '压强传感器', sx0 + sw / 2, sy0 - 12, 11, false, 'center');
      /* 数字显示：液晶读数与单位是"仪表本身的字"，保持直立（见 setFont 的说明） */
      box(g, sx0 + 6, sy0 + 8, sw - 12, h * 0.09, '#243024', INK, 1);
      txt(g, fx(pTrue, 1), sx0 + sw / 2, sy0 + 8 + h * 0.045, Math.min(19, h * 0.052), true, 'center', '#8CE8A8', true);
      txt(g, 'kPa', sx0 + sw / 2, sy0 + 8 + h * 0.09 + 11, 10.5, false, 'center', null, true);

      /* 指针表盘 */
      var gx = sx0 + sw / 2, gy = sy0 + sh - Math.min(38, sh * 0.34), gr = Math.min(30, sw * 0.36, h * 0.10);
      c.save();
      c.strokeStyle = INK; c.lineWidth = 1.4;
      c.beginPath(); c.arc(gx, gy, gr, Math.PI * 0.82, Math.PI * 2.18); c.stroke();
      for (i = 0; i <= 8; i++) {
        var aa = Math.PI * 0.82 + (Math.PI * 1.36) * i / 8;
        c.beginPath();
        c.moveTo(gx + Math.cos(aa) * gr, gy + Math.sin(aa) * gr);
        c.lineTo(gx + Math.cos(aa) * (gr - 5), gy + Math.sin(aa) * (gr - 5));
        c.stroke();
      }
      var na = Math.PI * 0.82 + (Math.PI * 1.36) * clamp(pTrue / 200, 0, 1) +
        (fluc > 0 ? 0.012 * Math.sin(tt * 5.0) : 0);
      c.strokeStyle = '#C8452F'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(na) * (gr - 6), gy + Math.sin(na) * (gr - 6)); c.stroke();
      c.fillStyle = INK;
      c.beginPath(); c.arc(gx, gy, 2.6, 0, TAU); c.fill();
      c.restore();
      txt(g, '0～200 kPa', gx, gy + gr * 0.55, 9.5, false, 'center');

      /* ---- 注射器针筒 ---- */
      c.save();
      c.globalAlpha = 0.28;
      c.fillStyle = '#9FC6D8';
      c.fillRect(xb0, yT, xp - xb0, yB - yT);          /* 气体 */
      c.restore();
      box(g, xb0, yT, xb1 - xb0, yB - yT, null, INK, 2);
      /* 气体分子（数量固定，密度随体积变化；抖动由 step 推进） */
      var nMol = 34;
      for (i = 0; i < nMol; i++) {
        var mx = xb0 + 6 + ((xb1 - xb0) - 12) * prand(i * 1.7) * clamp(Vd / 20, 0, 1);
        var my = yT + 7 + (yB - yT - 14) * prand(i * 3.3);
        mx += 2.2 * Math.sin(tt * 2.1 + i);
        my += 2.2 * Math.cos(tt * 1.7 + i * 1.3);
        c.save();
        c.globalAlpha = 0.75;
        c.fillStyle = '#2F6FA8';
        c.beginPath(); c.arc(mx, my, 2.1, 0, TAU); c.fill();
        c.restore();
      }
      /* 体积刻度：每 1 mL 一条刻度线、每 5 mL 标一个数字（与真实 20 mL 注射器一致）。
         筒身上的数字是"器具本身的字符"，保持直立。 */
      for (i = 0; i <= 20; i++) {
        var xt = xb0 + (xb1 - xb0) * i / 20;
        seg(g, xt, yB, xt, yB + (i % 5 === 0 ? 9 : 4), INK, 1);
        if (i % 5 === 0) txt(g, '' + i, xt, yB + 18, 9.5, false, 'center', null, true);
      }
      txt(g, '注射器（mL）', (xb0 + xb1) / 2, yB + 31, 11, false, 'center');

      /* 活塞与推杆 */
      c.save();
      c.fillStyle = INK;
      c.globalAlpha = 0.85;
      c.fillRect(xp - 5, yT - 3, 10, (yB - yT) + 6);
      c.globalAlpha = 0.55;
      c.fillRect(xp + 5, cy - 4, w * 0.97 - (xp + 5), 8);
      c.restore();
      box(g, xp - 5, yT - 3, 10, (yB - yT) + 6, null, INK, 1.6);
      txt(g, '活塞', xp, yT - 13, 10.5, true, 'center');
      head(g, Math.min(w * 0.96, xp + w * 0.10), cy, Vt > isoAnim.dispV ? Math.PI : 0, 9, INK);

      /* ---- 温度计 ---- */
      var thx = w * 0.90, thy0 = cy - h * 0.22, thh = h * 0.40;
      c.save();
      c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.rect(thx, thy0, 9, thh); c.stroke();
      c.fillStyle = '#C8452F';
      var lv = clamp((Tc - 10) / 30, 0, 1);
      c.fillRect(thx + 2, thy0 + thh - 2 - (thh - 6) * lv, 5, (thh - 6) * lv + 2);
      c.beginPath(); c.arc(thx + 4.5, thy0 + thh + 5, 6, 0, TAU); c.fill();
      c.restore();
      txt(g, fx(Tc, 1) + '℃', thx + 4.5, thy0 - 10, 11, true, 'center');

      /* ---- 数据面板 ---- */
      var lines = [
        ['V = ' + fx(Vd, 1) + ' mL    T = ' + fx(Tc, 1) + '℃', true],
        ['p = ' + fx(pTrue, 1) + ' kPa', true],
        ['pV = ' + fx(pTrue * Vd, 1) + ' kPa·mL', false],
        ['1/V = ' + fx(1 / Math.max(0.05, Vd), 4) + ' mL⁻¹', false],
        ['读数误差：±' + fx(0.40 * re, 2) + ' mL / ' + fx(0.2 * re, 2) + '%', false]
      ];
      if (state.rows && state.rows.length) {
        var rl = state.rows[state.rows.length - 1];
        if (isfin(rl.p) && isfin(rl.pV)) lines.push(['最近读数 p=' + fx(rl.p, 1) + '  pV=' + fx(rl.pV, 1), false]);
      }
      panel(g, w - 206, 12, 194, lines, 11.5);

      txt(g, '玻意耳定律 pV = C：温度与质量不变时，p 与 1/V 成正比', 10, h - 14, 11, false, 'left');
      c.restore();
    },

    step: function (p, state, dt) {
      var d = isfin(dt) ? dt : 0;
      isoAnim.t += d;
      if (isoAnim.t > 1e6) isoAnim.t = 0;
      var Vt = clamp(num(p && p.V, 10), 2, 20);
      if (!isfin(isoAnim.dispV)) isoAnim.dispV = Vt;
      /* 活塞缓慢移动（"缓慢推拉活塞"） */
      isoAnim.dispV += (Vt - isoAnim.dispV) * clamp(d * 2.6, 0, 1);
      if (Math.abs(Vt - isoAnim.dispV) < 0.01) isoAnim.dispV = Vt;
    }
  };

  /* ====================================================================== *
   * 4. 登记                                                                *
   * ====================================================================== */

  function reg(spec) {
    var P = (typeof window !== 'undefined') ? window.QG_PSLAB : null;
    if (P && typeof P.register === 'function') {
      P.register(spec.id, spec);
      return true;
    }
    return false;
  }

  reg(OIL_FILM);
  reg(ISOTHERMAL);

  if (typeof window !== 'undefined') {
    if (!window.QG_PSLAB_THERM_ORIGIN) window.QG_PSLAB_THERM_ORIGIN = BUILD;
  }
})();
