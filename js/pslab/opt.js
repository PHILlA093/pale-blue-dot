/* ============================================================================
 * 穷观 · 物理实验台 · 组 4 · 光学（js/pslab/opt.js）
 * Build ID: QG-20260920-5e5d5a          （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向实验台注册表登记两个光学实验（惰性：不建 DOM、不起循环）
 *     refraction    测量玻璃的折射率        插针法；n = sinθ1/sinθ2；sinθ1–sinθ2 图线斜率
 *     double-slit   用双缝干涉测量光的波长   Δy = Lλ/d；测 n 条亮纹总间距求 Δy
 * 纯 ES5、零外部依赖、不用 eval / new Function（守观澜的严格 CSP）；
 * 画面全部用调用方给的 Canvas 2D 上下文画，不建任何 DOM 节点。
 *
 * 契约：window.QG_PSLAB.register(id, spec)，spec 字段见 docs/物理实验台设计.md §4。
 *
 * ----------------------------------------------------------------------------
 * 【原理 / 器材 / 步骤 / 数据处理 的权威来源核对】（不凭记忆编造）
 *
 * · 插针法四针共线定光路、"入射角适当大些可以提高精确度"、"P1P2 与 P3P4 间距稍大
 *   一些可以减小误差"、"应选用宽度较大的玻璃砖"、n = sinθ1/sinθ2、界面 aa′/bb′ 与
 *   玻璃砖位置不符会使测得的 n 偏小：
 *     https://www.jyeoo.com/shiti/11391019-5a15-4215-b5f7-6a9c056258d7   （菁优网·真题解析）
 *     http://www.jyeoo.com/shiti/0c242810-a15e-4915-a859-d8beeee89b25   （菁优网·方格纸插针法）
 *     http://www.jyeoo.com/shiti/92801810-d215-415d-b5ac-d254645c38e8   （菁优网·入射角/针距/砖宽）
 *     https://mip.21cnjy.com/P26499784.html  （人教版选择性必修第一册《实验：测量玻璃的折射率》讲义）
 *
 * · 双缝干涉元件次序（光源 · 滤光片 · 单缝 · 双缝 · 遮光筒 · 毛玻璃屏 / 测量头）、
 *   λ = d(x2−x1)/[(n−1)L]（"条纹 A、B 间还有 4 条亮条纹"时分母是 5l）、
 *   "一次测出多条亮条纹间的距离，再算出相邻亮条纹间距"可减小误差、
 *   增大 d / 减小 L / 减小 λ 使条纹变密（紫光比红光条纹多）：
 *     https://www.jyeoo.com/shiti/4b957810-158c-15f3-9053-95cc5925a56e
 *     http://www.jyeoo.com/shiti/c48107d3-1152-4415-8560-251e8bd3794c/
 *     https://www.jyeoo.com/shiti/55faf510-8152-4150-572b-e823ca494256
 *
 * · 2017 版课程标准"学生必做实验"清单（含上述两个光学实验）：
 *     http://i.yanxiu.com/xb/front/viewHomework.tc?hwid=17965450&projectid=4088
 * ========================================================================== */
(function () {
  'use strict';

  var BUILD = 'QG-20260920-5e5d5a';
  var DEG = Math.PI / 180;
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

  /* 标准正态扰动：优先用核心给的 ctx.noise(sigma)，缺了就用 Box–Muller 兜底，
     并且对 NaN / Infinity 一律退回 0 —— measure 绝不允许吐 NaN 进数据表。 */
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

  /* 过原点最小二乘斜率（数据本身过原点的实验用它，例如 sinθ1–sinθ2、p–1/V） */
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
  /* 相关系数平方（供 conclude 自检"图线是不是直线"，不依赖核心的拟合） */
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
   * 1. 画图通用件（只吃 g.c / g.w / g.h / g.paper / g.ink / g.font）        *
   * ====================================================================== */

  function ctxOf(g) { return (g && g.c) ? g.c : null; }
  function paperOf(g) { return (g && typeof g.paper === 'string' && g.paper) ? g.paper : '#F4F1EA'; }
  function inkOf(g) { return (g && typeof g.ink === 'string' && g.ink) ? g.ink : '#26221C'; }

  /* 字体：实验台统一的纸面观感是 Georgia **斜体**（契约 §5，与沙盒、其它 16 个实验
     同一调子）。核心的宽容签名 g.font(size) 默认就返回斜体，g.font(size,true,true)
     是斜体+粗 —— 所以这里一律走**布尔形式**，不要再传 'normal' 把它掰直。
     upright 只留给"真实器物上本来就直立的字"（本文件的光学图里没有这种例外，
     保留该参数是为了与 therm.js 用同一套工具函数）。 */
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

  /* 右上角数据小面板 */
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

  /* 波长(nm) → 近似可见光颜色 */
  function waveColor(nm) {
    var r = 0, gg = 0, b = 0, x = clamp(nm, 380, 780);
    if (x < 440) { r = -(x - 440) / 60; b = 1; }
    else if (x < 490) { gg = (x - 440) / 50; b = 1; }
    else if (x < 510) { gg = 1; b = -(x - 510) / 20; }
    else if (x < 580) { r = (x - 510) / 70; gg = 1; }
    else if (x < 645) { r = 1; gg = -(x - 645) / 65; }
    else { r = 1; }
    function q(v) { return Math.round(255 * clamp(v, 0, 1)); }
    return 'rgb(' + q(r) + ',' + q(gg) + ',' + q(b) + ')';
  }

  /* ====================================================================== *
   * 2. 实验一：refraction —— 测量玻璃的折射率（插针法）                     *
   * ====================================================================== *
   *
   * 【模型】设定入射角 θ1 由参数给出；大头针把光线"钉"在纸上，两枚针的
   *   连线方向就是这条光线在纸面上的方向，因此存在三类可解释误差：
   *     ① 量角器零点 / 读数系统偏移 ε_com（同一张图上两个角同向偏）—— 沿图线方向
   *     ② 量角器读数随机误差 σ_prot（两角各自独立）—— 垂直于图线方向
   *     ③ 大头针定位误差 ε=0.5 mm：入射光线方向误差 √2·ε/d1；
   *        出射光线方向误差 √2·ε/d2，经"由 P3P4 反向延长找下界面出射点 E"
   *        的作图过程放大：δ2 = √2·ε·D /(d2·l)，其中
   *        l = t/cosθ2 是玻璃内光程、D = 0.02 m + d2/2 是针列中点到下界面的距离。
   *        所以"针距越大、玻璃砖越宽，误差越小"。
   *   【物理内核】sinθ1 = n·sinθ2（斯涅尔定律），玻璃砖两面平行时出射光线与入射
   *   光线平行，侧移量 Δ = t·sin(θ1−θ2)/cosθ2。
   *   【数据处理】以 sinθ2 为横轴、sinθ1 为纵轴作图，是过原点的直线，斜率 = n。
   * ====================================================================== */

  var refrAnim = { t: 0 };

  var REFRACTION = {
    id: 'refraction',
    name: '测量玻璃的折射率',
    group: '光学',
    aim: '用插针法确定光通过玻璃砖的光路，测出入射角 θ1 与折射角 θ2，由 n = sinθ1/sinθ2 求出玻璃的折射率，并分析误差来源',

    principle: '光从空气斜射入玻璃时发生折射，入射角 θ1 与折射角 θ2 满足折射定律 n = sinθ1/sinθ2。' +
      '用"插针法"确定光路：在玻璃砖一侧插两枚大头针 P1、P2 定出入射光线，在另一侧插 P3、P4，' +
      '使 P3 挡住 P1、P2 的像，P4 挡住 P3 以及 P1、P2 的像，这时四枚针共线，P1P2 与 P3P4 的连线分别是入射光线与出射光线的方向。' +
      '移去玻璃砖，连接 P3P4 并延长与下界面交于 E，连接入射点 O 与 E 就是玻璃内的折射光线。' +
      '用量角器量出 θ1、θ2 即得 n；以 sinθ2 为横轴、sinθ1 为纵轴作图，图线是过原点的直线，斜率就是折射率 n。' +
      '玻璃砖两面平行时出射光线与入射光线平行，只有侧移 Δ = t·sin(θ1−θ2)/cosθ2（t 为玻璃砖宽度）。' +
      '数据处理时把入射角 θ1（由学生用量角器设定并画出的自变量）取为准确值，各项测量不确定度都记在被测量折射角 θ2 上 —— 这是作图法处理数据的常规约定。',

    apparatus: [
      '两面平行的长方体玻璃砖（宽度可选，宜选宽一些的）',
      '白纸（方格纸）、图板（木板）、图钉',
      '大头针 4 枚（针要直、针距要够大）',
      '量角器、三角板（直尺）、削尖的铅笔',
      '玻璃砖固定用的橡皮泥（或胶带）'
    ],

    steps: [
      '把白纸用图钉固定在木板上，画一条直线 aa′ 作为玻璃砖的上界面；在 aa′ 上取一点 O，过 O 画出垂直于 aa′ 的法线 NN′，再画一条线段 AO 作为入射光线（用量角器确定入射角 θ1）。',
      '把玻璃砖放在白纸上，使它的上边界与 aa′ 重合，用铅笔描出玻璃砖的下边界 bb′，标出玻璃砖的位置。',
      '在 AO 上插两枚大头针 P1、P2（两针间距适当大一些，以减小确定光线方向的误差，针要竖直插在纸面上）。',
      '透过玻璃砖观察，在玻璃砖另一侧先后插 P3、P4：使 P3 挡住 P1、P2 的像，P4 挡住 P3 以及 P1、P2 的像，即四枚针看起来在一条直线上。',
      '移去玻璃砖和大头针，连接 P3P4 并延长与 bb′ 交于 E；连接 OE，OE 就是光在玻璃中的折射光线。',
      '用量角器量出入射角 θ1 和折射角 θ2（都从法线量起），由 n = sinθ1/sinθ2 算出玻璃的折射率。',
      '改变入射角（取 15°～75° 之间的几个不同值）重复步骤 3～6，至少做 5 次，列表记录。',
      '以 sinθ2 为横轴、sinθ1 为纵轴描点作图，图线应为过原点的直线，用图线的斜率求出折射率 n（也可对多次测得的 n 取平均值）。'
    ],

    params: [
      { key: 'theta1', label: '入射角 θ1', unit: '°', min: 15, max: 75, step: 1, value: 45 },
      { key: 'nTrue', label: '玻璃砖实际折射率 n0', unit: '', min: 1.40, max: 1.80, step: 0.01, value: 1.50 },
      { key: 't', label: '玻璃砖宽度 t', unit: 'mm', min: 15, max: 60, step: 1, value: 40 },
      { key: 'pinGap', label: '大头针间距 d', unit: 'mm', min: 20, max: 150, step: 5, value: 60 }
    ],

    /* ---- 真实模型算出一次"作图 + 读数"的结果，误差项可解释 ---- *
     * 约定：入射角 θ1 是学生用量角器**设定并画出**的自变量（画出的那条线就是
     * 入射光线），按作图法处理数据的惯例取为准确值；所有测量不确定度都记在
     * 被测量——折射角 θ2 上（含由入射光线方向误差经折射定律传过来的一份）。   */
    measure: function (p, ctx) {
      var th1 = clamp(num(p.theta1, 45), 1, 89) * DEG;
      var n0 = clamp(num(p.nTrue, 1.50), 1.01, 2.5);
      var t = clamp(num(p.t, 40), 1, 200) * 1e-3;        /* m */
      var d = clamp(num(p.pinGap, 60), 5, 400) * 1e-3;   /* m */
      var eps = 0.5e-3;                                   /* 针孔/铅笔线定位误差 0.5 mm */

      /* 玻璃内的真实折射角：严格满足折射定律 */
      var th2 = Math.asin(clamp(Math.sin(th1) / n0, -1, 1));

      var sProt = 0.30 * DEG;   /* 量角器读数随机误差（最小分度 1°，估读 ±0.3°） */
      var sCom = 0.20 * DEG;    /* 量角器零点/基线对不准：同一张图上两角同向偏 */
      /* 入射光线方向误差：由 P1、P2 两枚针的定位误差合成 √2·ε/d，再经折射定律传到 θ2 */
      var sE1 = Math.SQRT2 * eps / d;
      var dTh2 = Math.cos(th1) / (n0 * Math.max(0.2, Math.cos(th2)));
      /* 出射光线方向误差 → 反向延长找 E 点 → 折射光线方向误差：
         √2·ε·D/(d·l)，l = t/cosθ2 是玻璃内光程、D = 0.02 m + d/2 是针列中点到下界面距离。
         所以"针距越大、玻璃砖越宽，误差越小"。 */
      var lIn = t / Math.max(0.2, Math.cos(th2));
      var sE2 = Math.SQRT2 * eps * (0.02 + d / 2) / (d * lIn);

      var sP = dTh2 * sE1;
      var sig2 = Math.sqrt(sE2 * sE2 + sCom * sCom + sProt * sProt + sP * sP);
      var th2r = th2 + nrm(ctx, sig2);

      var sini = Math.sin(th1), sinr = Math.sin(th2r);
      var nm = (Math.abs(sinr) > 1e-6) ? (sini / sinr) : n0;
      var disp = t * Math.sin(th1 - th2) / Math.max(0.2, Math.cos(th2));

      return {
        theta1: th1 / DEG,
        theta2: th2r / DEG,
        sini: sini,
        sinr: sinr,
        n: nm,
        disp: disp * 1e3          /* mm */
      };
    },

    columns: [
      { key: 'theta1', label: '入射角 θ1', unit: '°' },
      { key: 'theta2', label: '折射角 θ2', unit: '°' },
      { key: 'sini', label: 'sinθ1', unit: '' },
      { key: 'sinr', label: 'sinθ2', unit: '' },
      { key: 'n', label: '折射率 n', unit: '' },
      { key: 'disp', label: '侧移量 Δ', unit: 'mm' }
    ],

    graph: {
      /* fit 用 'linear'：入射角固定时 sinθ1 每次测量都相同，核心 r2Of 在这种
         "y 全相同" 的退化情形下返回 1（而强制过原点的 'origin' 会返回 0）。 */
      x: 'sinr', y: 'sini', fit: 'linear',
      title: 'sinθ1–sinθ2 图线',
      note: '理论上过原点（θ1 = 0 时 θ2 = 0），斜率 k = n；每改变一次入射角测一次，取 5 个以上不同入射角'
    },

    conclude: function (rows, p, ctx) {
      var i, ns = [], xs = [], ys = [], k, nm, sd, rel, n0;
      n0 = clamp(num(p && p.nTrue, 1.50), 1.01, 2.5);
      if (!rows || !rows.length) {
        return {
          value: null, unit: '',
          text: '还没有数据：请先点「📏 测量一次」，并改变入射角（15°～75°）多测几组。',
          errors: ['量角器读数与零点偏差（两角各约 ±0.3°）',
            '大头针定位与光路作图误差（针距越大、玻璃砖越宽，误差越小）',
            '玻璃砖上下界面与所画 aa′、bb′ 不重合（界面画偏会使 n 偏小）']
        };
      }
      for (i = 0; i < rows.length; i++) {
        if (isfin(rows[i].n)) ns.push(rows[i].n);
        if (isfin(rows[i].sini) && isfin(rows[i].sinr)) { ys.push(rows[i].sini); xs.push(rows[i].sinr); }
      }
      k = slope0(xs, ys);                    /* 图线斜率 = 折射率 */
      nm = ns.length ? mean(ns) : k;
      sd = sdev(ns);
      rel = (n0 > 0) ? Math.abs(nm - n0) / n0 * 100 : 0;
      return {
        value: nm, unit: '',
        text: '由 sinθ1–sinθ2 图线的斜率得玻璃的折射率 n = ' + fx(k, 2) +
          '（' + ns.length + ' 次测量的平均值 n̄ = ' + fx(nm, 2) + '，标准差 ' + fx(sd, 3) + '），' +
          '与玻璃砖实际值 n0 = ' + fx(n0, 2) + ' 相差 ' + fx(rel, 1) + '%。' +
          '数据点在图线附近的分散主要来自量角器读数与大头针作图误差。',
        errors: [
          '量角器读数误差与零点偏差：折射角读数约 ±0.3°，量角器基线与法线对不准还会带来约 ±0.2° 的同向偏移',
          '大头针定位与光路作图误差：P1P2、P3P4 间距越大、玻璃砖越宽，确定光线方向的相对误差越小',
          '玻璃砖上下界面与纸面所画 aa′、bb′ 不重合（界面画偏会使测得的 n 偏小）',
          '玻璃砖宽度不够时出射光线与入射光线侧移小，延长 P3P4 找 E 点的作图误差被放大'
        ]
      };
    },

    /* ---------------- 画面：插针法光路 + 玻璃砖 + 量角器 ---------------- */
    draw: function (g, p, state) {
      var c = ctxOf(g);
      if (!c) return;
      var w = Math.max(120, num(g.w, 640)), h = Math.max(90, num(g.h, 420));
      var INK = inkOf(g), PAP = paperOf(g);
      var i, k, al;

      state = state || {};
      var th1 = clamp(num(p.theta1, 45), 5, 85) * DEG;
      var n0 = clamp(num(p.nTrue, 1.50), 1.01, 2.5);
      var th2 = Math.asin(clamp(Math.sin(th1) / n0, -1, 1));
      var tmm = clamp(num(p.t, 40), 15, 60);
      var dmm = clamp(num(p.pinGap, 60), 20, 150);
      var tt = refrAnim.t;

      c.save();
      c.fillStyle = PAP;
      c.fillRect(0, 0, w, h);
      /* 图纸边框 */
      seg(g, 5, 5, w - 5, 5, INK, 1, [5, 4]);
      seg(g, 5, h - 5, w - 5, h - 5, INK, 1, [5, 4]);
      seg(g, 5, 5, 5, h - 5, INK, 1, [5, 4]);
      seg(g, w - 5, 5, w - 5, h - 5, INK, 1, [5, 4]);

      /* ---- 玻璃砖几何（像素） ---- */
      var tPx = h * (0.095 + 0.135 * (tmm - 15) / 45);
      var cy = h * 0.50;
      var yTop = cy - tPx / 2, yBot = cy + tPx / 2;
      var bx1 = w * 0.09, bx2 = w * 0.88;
      var ox = w * 0.33;
      var pinSep = clamp(dmm * (h / 420) * 1.15, 20, w * 0.26);
      var lin = clamp(pinSep * 1.6 + h * 0.05, h * 0.20, h * 0.46);

      var dirIn = { x: -Math.sin(th1), y: -Math.cos(th1) };   /* 从 P 指向 O */
      var dirRf = { x: Math.sin(th2), y: Math.cos(th2) };     /* 玻璃内 O → E */
      var dirOut = { x: Math.sin(th1), y: Math.cos(th1) };    /* 出射光线方向 */

      var P2 = { x: ox + dirIn.x * lin, y: yTop + dirIn.y * lin };
      var P1 = { x: ox + dirIn.x * lin * 0.42, y: yTop + dirIn.y * lin * 0.42 };
      var lPx = tPx / Math.max(0.2, Math.cos(th2));
      var E = { x: ox + dirRf.x * lPx, y: yBot };
      var lout = clamp(lin * 0.95, h * 0.16, h * 0.42);
      var P3 = { x: E.x + dirOut.x * lout * 0.34, y: E.y + dirOut.y * lout * 0.34 };
      var P4 = { x: P3.x + dirOut.x * pinSep, y: P3.y + dirOut.y * pinSep };
      /* 夹进画布，避免针头跑到纸外 */
      P2.x = clamp(P2.x, 16, w - 16); P2.y = clamp(P2.y, 16, h - 16);
      P1.x = clamp(P1.x, 16, w - 16); P1.y = clamp(P1.y, 16, h - 16);
      P4.x = clamp(P4.x, 16, w - 16); P4.y = clamp(P4.y, 16, h - 16);
      P3.x = clamp(P3.x, 16, w - 16); P3.y = clamp(P3.y, 16, h - 16);

      /* ---- 界面线 aa′ / bb′（玻璃砖外也画虚线） ---- */
      seg(g, bx1 - w * 0.05, yTop, bx2 + w * 0.02, yTop, INK, 1.2);
      seg(g, bx1 - w * 0.02, yBot, bx2 + w * 0.05, yBot, INK, 1.2, [6, 4]);
      txt(g, "a", bx1 - w * 0.055, yTop - 9, 12, false, 'center');
      txt(g, "a′", bx1 + w * 0.015, yTop - 9, 12, false, 'center');
      txt(g, "b′", bx2 + w * 0.055, yBot + 11, 12, false, 'center');

      /* ---- 玻璃砖 ---- */
      c.save();
      c.globalAlpha = 0.22;
      c.fillStyle = '#8FB6C8';
      c.fillRect(bx1, yTop, bx2 - bx1, tPx);
      c.restore();
      box(g, bx1, yTop, bx2 - bx1, tPx, null, INK, 1.4);
      txt(g, '玻璃砖', (bx1 + bx2) / 2, cy, 12, false, 'center');
      txt(g, 't = ' + fx(tmm, 0) + ' mm', bx2 - 6, cy, 11, false, 'right');

      /* ---- 法线 NN′ ---- */
      var nTop = Math.min(yTop, P2.y) - 14, nBot = Math.max(yBot, P4.y) + 14;
      seg(g, ox, nTop, ox, nBot, INK, 1, [4, 4]);
      txt(g, 'N', ox + 6, nTop + 4, 12, false, 'left');
      txt(g, "N′", ox + 6, nBot - 4, 12, false, 'left');

      /* ---- 量角器（淡） ---- */
      var rP = Math.min(h * 0.30, w * 0.20);
      c.save();
      c.globalAlpha = 0.30;
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.beginPath(); c.arc(ox, yTop, rP, 0, TAU); c.stroke();
      for (i = 0; i < 24; i++) {
        k = i * 15 * DEG;
        c.beginPath();
        c.moveTo(ox + Math.cos(k) * rP, yTop + Math.sin(k) * rP);
        c.lineTo(ox + Math.cos(k) * (rP - 6), yTop + Math.sin(k) * (rP - 6));
        c.stroke();
      }
      c.restore();

      /* ---- 光线（先画粗底再画亮线，像一束光） ---- */
      c.save();
      c.globalAlpha = 0.16;
      c.strokeStyle = '#C8452F';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(P2.x, P2.y); c.lineTo(ox, yTop); c.lineTo(E.x, E.y);
      c.lineTo(P4.x, P4.y);
      c.stroke();
      c.restore();

      seg(g, P2.x, P2.y, ox, yTop, '#C8452F', 1.8);
      seg(g, ox, yTop, E.x, E.y, '#2F6FA8', 1.8);
      seg(g, E.x, E.y, P4.x, P4.y, '#C8452F', 1.8);

      /* 方向箭头 */
      head(g, ox + dirIn.x * 26, yTop + dirIn.y * 26, Math.atan2(dirIn.y, dirIn.x), 9, '#C8452F');
      head(g, ox + dirRf.x * (lPx * 0.55), yTop + dirRf.y * (lPx * 0.55), Math.atan2(dirRf.y, dirRf.x), 8, '#2F6FA8');
      var midOut = { x: (E.x + P4.x) / 2, y: (E.y + P4.y) / 2 };
      head(g, midOut.x, midOut.y, Math.atan2(dirOut.y, dirOut.x), 9, '#C8452F');

      /* ---- 角弧 θ1 / θ2 ---- */
      var rA = Math.min(rP * 0.55, h * 0.16);
      c.save();
      c.strokeStyle = '#C8452F'; c.lineWidth = 1.4;
      c.beginPath();
      c.arc(ox, yTop, rA, Math.atan2(dirIn.y, dirIn.x), -Math.PI / 2, false);
      c.stroke();
      c.strokeStyle = '#2F6FA8';
      c.beginPath();
      c.arc(ox, yTop, rA * 1.25, Math.atan2(dirRf.y, dirRf.x), Math.PI / 2, false);
      c.stroke();
      c.restore();
      var aMid1 = (Math.atan2(dirIn.y, dirIn.x) + (-Math.PI / 2)) / 2;
      var aMid2 = (Math.atan2(dirRf.y, dirRf.x) + (Math.PI / 2)) / 2;
      txt(g, 'θ1', ox + Math.cos(aMid1) * (rA + 13), yTop + Math.sin(aMid1) * (rA + 13), 13, true, 'center', '#C8452F');
      txt(g, 'θ2', ox + Math.cos(aMid2) * (rA * 1.25 + 13), yTop + Math.sin(aMid2) * (rA * 1.25 + 13), 13, true, 'center', '#2F6FA8');
      txt(g, 'O', ox - 13, yTop - 9, 12, true, 'center');
      txt(g, 'E', E.x + 11, E.y + 10, 12, true, 'center');

      /* ---- 大头针（P1 P2 入射侧；P3 P4 出射侧） ---- */
      var pins = [
        [P1, 'P1', 0], [P2, 'P2', 1], [P3, 'P3', 2], [P4, 'P4', 3]
      ];
      for (i = 0; i < pins.length; i++) {
        al = tt > 0.002 ? clamp(tt * 1.6 - i * 0.22, 0, 1) : 1;
        c.save();
        c.globalAlpha = 0.25 + 0.75 * al;
        c.fillStyle = INK;
        c.beginPath();
        c.arc(pins[i][0].x, pins[i][0].y, 4.2, 0, TAU);
        c.fill();
        c.restore();
        seg(g, pins[i][0].x, pins[i][0].y, pins[i][0].x + dirOut.x * 13, pins[i][0].y + dirOut.y * 13, INK, 1);
        var lx = pins[i][0].x - 12, ly = pins[i][0].y - 11;
        if (i === 2 || i === 3) { lx = pins[i][0].x + 9; ly = pins[i][0].y - 11; }
        txt(g, pins[i][1], lx, ly, 12, true, 'center');
      }

      /* ---- 光的脉冲（step 推进） ---- */
      var pts = [[P2.x, P2.y], [ox, yTop], [E.x, E.y], [P4.x, P4.y]];
      var total = 0, L = [], j;
      for (i = 0; i < 3; i++) {
        L[i] = Math.sqrt(sq(pts[i + 1][0] - pts[i][0]) + sq(pts[i + 1][1] - pts[i][1]));
        total += L[i];
      }
      if (total > 1) {
        var sPos = ((tt * 0.30) % 1) * total, acc = 0, px = pts[0][0], py = pts[0][1];
        for (i = 0; i < 3; i++) {
          if (sPos <= acc + L[i]) {
            var f = L[i] > 0 ? (sPos - acc) / L[i] : 0;
            px = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
            py = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
            break;
          }
          acc += L[i];
        }
        for (j = 3; j >= 1; j--) {
          c.save();
          c.globalAlpha = 0.10 * j;
          c.fillStyle = '#E8A33D';
          c.beginPath(); c.arc(px, py, 3 + j * 2.2, 0, TAU); c.fill();
          c.restore();
        }
      }

      /* ---- 右上角读数 ---- */
      var lastN = null;
      if (state.rows && state.rows.length) lastN = state.rows[state.rows.length - 1].n;
      var lines = [
        ['θ1 = ' + fx(th1 / DEG, 1) + '°   θ2 = ' + fx(th2 / DEG, 1) + '°', true],
        ['n0(设定) = ' + fx(n0, 2), false],
        ['侧移 Δ = ' + fx(tmm * Math.sin(th1 - th2) / Math.max(0.2, Math.cos(th2)), 1) + ' mm', false],
        ['针距 ' + fx(dmm, 0) + ' mm   玻璃砖 ' + fx(tmm, 0) + ' mm', false]
      ];
      if (isfin(lastN)) lines.push(['最近测得 n = ' + fx(lastN, 3), true]);
      panel(g, w - 176, 12, 164, lines, 11.5);

      /* 底部提示 */
      txt(g, '插针法：P1P2 定入射光线，P3P4 挡住 P1P2 的像落定出射光线，四针共线',
        12, h - 14, 11, false, 'left');
      c.restore();
    },

    step: function (p, state, dt) {
      refrAnim.t += (isfin(dt) ? dt : 0);
      if (refrAnim.t > 1e6) refrAnim.t = 0;
    }
  };

  /* ====================================================================== *
   * 3. 实验二：double-slit —— 用双缝干涉测量光的波长                        *
   * ====================================================================== *
   *
   * 【模型】相邻亮纹间距 Δy = Lλ/d（L 双缝到屏的距离、d 双缝间距、λ 波长）。
   *   实验用测量头测出 n 条亮纹的总间距 a（n 条亮纹之间有 n−1 个间距），
   *   所以 Δy = a/(n−1)，λ = d·a/[(n−1)L]。
   * 【误差】条纹中心定位误差 σc = 0.04 mm + 0.30 mm·(模糊程度)：条纹越模糊、
   *   亮纹边界越不清楚，分划板中心刻线对准亮纹中心的误差越大；起始读数与
   *   终止读数各有一个独立误差，合到总间距 a 上是 √2·σc。
   *   测的亮纹条数越多，Δy 的相对误差越小（这正是"一次测出多条亮纹间距"的道理）。
   * 【数据处理】改变 L，作 Δy–L 图线，是过原点的直线，斜率 k = λ/d。
   * ====================================================================== */

  var dsAnim = { t: 0 };

  var DOUBLE_SLIT = {
    id: 'double-slit',
    name: '用双缝干涉测量光的波长',
    group: '光学',
    aim: '观察双缝干涉图样，测出 n 条亮纹的总间距求出相邻亮纹间距 Δy，由 λ = dΔy/L 测出单色光的波长',

    principle: '双缝干涉中，两列相干光在屏上叠加，出现等间距的明暗相间条纹，相邻亮纹（暗纹）间距 ' +
      'Δy = Lλ/d（L 为双缝到屏的距离，d 为双缝间距，λ 为光的波长）。' +
      '实验中双缝间距 d 由双缝上标出的数值读出，L 用米尺量出，Δy 用测量头（螺旋测微器式目镜或游标卡尺）测出：' +
      '先使分划板中心刻线与某一条亮纹中心对齐读出 x1，沿同一方向转动手轮使中心刻线对准第 n 条亮纹中心读出 x2，' +
      '则总间距 a = x2 − x1，n 条亮纹之间有 n−1 个间距，Δy = a/(n−1)，于是 λ = dΔy/L = d·a/[(n−1)L]。' +
      '一次测出多条亮纹的总间距再求平均，比只测相邻两条亮纹的间距准确得多。' +
      '改变双缝到屏的距离 L，作 Δy–L 图线，图线是过原点的直线，斜率 k = λ/d，可由此求出波长。',

    apparatus: [
      '光具座（带刻度导轨与各元件支架）',
      '光源（白炽灯或激光）、单色滤光片（红/绿等）',
      '单缝、双缝（双缝间距 d 已知，如 0.20 mm）',
      '遮光筒（内壁涂黑，一端装毛玻璃屏）',
      '测量头（螺旋测微器式目镜或游标卡尺式，带分划板与手轮）',
      '米尺、低压电源（用白炽灯时）'
    ],

    steps: [
      '按"光源 → 滤光片 → 单缝 → 双缝 → 遮光筒 → 光屏（测量头）"的次序把各元件依次安装在光具座上，并使它们的中心大致在同一高度、同一轴线上。',
      '接通电源，让光源发出的光经滤光片成为单色光，照亮单缝；单缝相当于线光源，它又把双缝照亮，在屏上形成干涉条纹。调节单缝与双缝相互平行、单缝适当窄一些，直到条纹清晰。',
      '转动测量头手轮，使分划板中心刻线与某一条亮纹（记为第 1 条）中心对齐，记下读数 x1。',
      '沿同一方向继续转动手轮，使中心刻线与第 n 条亮纹中心对齐，记下读数 x2（中间跨过 n−1 个亮纹间距）。',
      '求出 n 条亮纹的总间距 a = x2 − x1，得 Δy = a/(n−1)；用米尺量出双缝到屏的距离 L，读出双缝上的标值 d，由 λ = dΔy/L 求出波长。',
      '改变双缝到屏的距离 L（或换用不同颜色的滤光片、不同间距的双缝）重复步骤 3～5，至少测 6 组。',
      '以 Δy 为纵轴、L 为横轴描点作图，图线是过原点的直线，用斜率 k 求出波长 λ = kd。'
    ],

    params: [
      { key: 'L', label: '双缝到屏的距离 L', unit: 'm', min: 0.30, max: 1.20, step: 0.02, value: 0.80 },
      { key: 'd', label: '双缝间距 d', unit: 'mm', min: 0.10, max: 0.50, step: 0.01, value: 0.20 },
      { key: 'lambda', label: '光的波长 λ', unit: 'nm', min: 400, max: 750, step: 5, value: 650 },
      { key: 'nFringe', label: '测量的亮纹条数 n', unit: '条', min: 3, max: 11, step: 1, value: 6 },
      { key: 'blur', label: '条纹模糊程度', unit: '', min: 0, max: 1, step: 0.05, value: 0.15 }
    ],

    measure: function (p, ctx) {
      var L = clamp(num(p.L, 0.80), 0.05, 5);
      var d = clamp(num(p.d, 0.20), 0.01, 2) * 1e-3;      /* m */
      var lam = clamp(num(p.lambda, 650), 300, 900) * 1e-9; /* m */
      var n = Math.round(clamp(num(p.nFringe, 6), 2, 30));
      var blur = clamp(num(p.blur, 0.15), 0, 1);

      var dyT = L * lam / d;                       /* m 相邻亮纹间距真值 */
      var sc = (0.04 + 0.30 * blur) * 1e-3;        /* m 条纹中心定位误差 */
      var x1 = 8.000 + nrm(ctx, sc);               /* mm 第 1 条亮纹的测量头读数 */
      var a = (n - 1) * dyT + nrm(ctx, Math.SQRT2 * sc); /* m 总间距 */
      var x2 = x1 + a * 1e3;                       /* mm */
      var dy = a / (n - 1);                        /* m */
      var lamM = d * dy / L;                       /* m */

      return {
        n: n,
        x1: x1,
        x2: x2,
        a: a * 1e3,          /* mm */
        dy: dy * 1e3,        /* mm */
        L: L,
        d: d * 1e3,          /* mm */
        lambda: lam * 1e9,   /* nm */
        lamM: lamM * 1e9     /* nm 测得波长 */
      };
    },

    columns: [
      { key: 'n', label: '亮纹条数 n', unit: '条' },
      { key: 'x1', label: '读数 x1', unit: 'mm' },
      { key: 'x2', label: '读数 x2', unit: 'mm' },
      { key: 'a', label: '总间距 a', unit: 'mm' },
      { key: 'dy', label: 'Δy', unit: 'mm' },
      { key: 'L', label: 'L', unit: 'm' },
      { key: 'd', label: 'd', unit: 'mm' },
      { key: 'lamM', label: '测得波长 λ', unit: 'nm' }
    ],

    graph: {
      x: 'L', y: 'dy', fit: 'linear',
      title: 'Δy–L 图线',
      note: '过原点的直线，斜率 k = Δy/L = λ/d ⇒ λ = k·d/1000（Δy 用 mm、L 用 m、d 用 m）'
    },

    conclude: function (rows, p, ctx) {
      var i, lm = [], xs = [], ys = [], k, mv, sd, lam0, rel;
      lam0 = clamp(num(p && p.lambda, 650), 300, 900);
      if (!rows || !rows.length) {
        return {
          value: null, unit: 'm',
          text: '还没有数据：请先点「📏 测量一次」，并改变双缝到屏的距离 L 多测几组。',
          errors: ['条纹有宽度且边界模糊，分划板中心刻线对准亮纹中心存在定位误差',
            '测量头（螺旋测微器/游标卡尺）本身的读数误差',
            '双缝到屏的距离 L 的测量误差，以及单缝、双缝不平行']
        };
      }
      for (i = 0; i < rows.length; i++) {
        if (isfin(rows[i].lamM)) lm.push(rows[i].lamM);
        if (isfin(rows[i].L) && isfin(rows[i].dy)) { xs.push(rows[i].L); ys.push(rows[i].dy); }
      }
      k = slope0(xs, ys);                                   /* mm/m */
      var dM = clamp(num(p && p.d, 0.20), 0.01, 2) * 1e-3;   /* m */
      var lamFit = dM * k / 1000;                            /* m */
      mv = lm.length ? mean(lm) : lamFit * 1e9;              /* nm */
      sd = sdev(lm);
      rel = (lam0 > 0) ? Math.abs(mv - lam0) / lam0 * 100 : 0;
      return {
        value: mv * 1e-9, unit: 'm',
        text: '测得单色光的波长 λ = ' + (mv * 1e-9).toExponential(2) + ' m（即 ' + fx(mv, 0) + ' nm），' +
          '与滤光片标称的 ' + fx(lam0, 0) + ' nm 相差 ' + fx(rel, 1) + '%；' +
          '由 Δy–L 图线斜率得 λ = ' + fx(lamFit * 1e9, 1) + ' nm。' +
          (lm.length > 1 ? ('重复测量的标准差 ' + fx(sd, 1) + ' nm。') : '')
        ,
        errors: [
          '条纹有一定宽度且边界模糊，分划板中心刻线与亮纹中心对齐存在 ±0.04～0.34 mm 的定位误差（条纹越模糊误差越大）',
          '一次只测相邻两条亮纹的间距会使相对误差偏大，应测 n 条亮纹的总间距再除以 n−1 求平均',
          '双缝到屏的距离 L 用米尺测量、双缝间距 d 由标值读出，都有读数误差',
          '单缝与双缝不平行、光源不是单色光或遮光筒漏光，都会使条纹模糊、对比度下降'
        ]
      };
    },

    /* ---------------- 画面：光具座 + 光的干涉条纹 + 测量头 ---------------- */
    draw: function (g, p, state) {
      var c = ctxOf(g);
      if (!c) return;
      var w = Math.max(160, num(g.w, 760)), h = Math.max(100, num(g.h, 440));
      var INK = inkOf(g), PAP = paperOf(g);

      state = state || {};
      var L = clamp(num(p.L, 0.80), 0.05, 5);
      var d = clamp(num(p.d, 0.20), 0.01, 2);              /* mm */
      var lam = clamp(num(p.lambda, 650), 300, 900);        /* nm */
      var n = Math.round(clamp(num(p.nFringe, 6), 2, 30));
      var blur = clamp(num(p.blur, 0.15), 0, 1);
      var dy = L * lam * 1e-9 / (d * 1e-3) * 1e3;           /* mm */
      var tt = dsAnim.t;
      var col = waveColor(lam);

      c.save();
      c.fillStyle = PAP;
      c.fillRect(0, 0, w, h);

      var benchY = h * 0.80;
      var xLamp = w * 0.055, xFilt = w * 0.145, xS1 = w * 0.225, xS2 = w * 0.335;
      var xScreen = xS2 + w * (0.16 + 0.40 * (clamp(L, 0.30, 1.20) - 0.30) / 0.90);
      xScreen = Math.min(xScreen, w * 0.84);
      var cy = h * 0.42;
      var plateH = h * 0.30;

      /* 光具座 */
      c.save();
      c.fillStyle = INK; c.globalAlpha = 0.85;
      c.fillRect(w * 0.02, benchY, w * 0.96, Math.max(4, h * 0.014));
      c.globalAlpha = 0.35;
      c.fillRect(w * 0.05, benchY + h * 0.014, w * 0.03, h * 0.05);
      c.fillRect(w * 0.90, benchY + h * 0.014, w * 0.03, h * 0.05);
      c.restore();
      /* 刻度 */
      var i, gx;
      for (i = 0; i <= 20; i++) {
        gx = w * 0.02 + (w * 0.96) * i / 20;
        seg(g, gx, benchY, gx, benchY - (i % 5 === 0 ? 7 : 4), INK, 1);
      }
      txt(g, '光具座', w * 0.02, benchY + h * 0.062, 11, false, 'left');

      function stand(x, top) {
        seg(g, x, top, x, benchY, INK, 1.6);
        seg(g, x - 9, benchY, x + 9, benchY, INK, 2.4);
      }

      /* --- 光源 --- */
      stand(xLamp, cy - plateH * 0.18);
      c.save();
      c.fillStyle = '#E8C15A';
      c.beginPath(); c.arc(xLamp, cy - plateH * 0.34, Math.min(16, w * 0.018), 0, TAU); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
      c.restore();
      for (i = 0; i < 8; i++) {
        var ra = i * TAU / 8 + 0.2;
        seg(g, xLamp + Math.cos(ra) * Math.min(19, w * 0.022), cy - plateH * 0.34 + Math.sin(ra) * Math.min(19, w * 0.022),
          xLamp + Math.cos(ra) * Math.min(26, w * 0.030), cy - plateH * 0.34 + Math.sin(ra) * Math.min(26, w * 0.030), '#B08A2E', 1.2);
      }
      txt(g, '光源', xLamp, benchY - h * 0.008, 11, false, 'center');

      /* --- 滤光片 --- */
      stand(xFilt, cy - plateH / 2);
      box(g, xFilt - 5, cy - plateH / 2, 10, plateH, col, INK, 1.2);
      c.save(); c.globalAlpha = 0.35; c.fillStyle = col;
      c.fillRect(xFilt - 5, cy - plateH / 2, 10, plateH); c.restore();
      txt(g, '滤光片', xFilt, cy + plateH / 2 + 13, 11, false, 'center');

      /* --- 单缝 --- */
      stand(xS1, cy - plateH / 2);
      box(g, xS1 - 4, cy - plateH / 2, 8, plateH / 2 - 6, INK, INK, 1);
      box(g, xS1 - 4, cy + 6, 8, plateH / 2 - 6, INK, INK, 1);
      txt(g, '单缝', xS1, cy + plateH / 2 + 13, 11, false, 'center');

      /* --- 双缝 --- */
      stand(xS2, cy - plateH / 2);
      box(g, xS2 - 4, cy - plateH / 2, 8, plateH / 2 - 7, INK, INK, 1);
      box(g, xS2 - 4, cy - 3, 8, 6, INK, INK, 1);
      box(g, xS2 - 4, cy + 7, 8, plateH / 2 - 7, INK, INK, 1);
      txt(g, '双缝', xS2, cy + plateH / 2 + 13, 11, false, 'center');
      txt(g, 'd = ' + fx(d, 2) + ' mm', xS2, cy - plateH / 2 - 11, 11, true, 'center');

      /* --- 遮光筒 --- */
      var tubeY = cy - plateH * 0.30, tubeH = plateH * 0.60;
      box(g, xS2 + 8, tubeY, xScreen - xS2 - 8, tubeH, null, INK, 1.4);
      c.save(); c.globalAlpha = 0.10; c.fillStyle = INK;
      c.fillRect(xS2 + 8, tubeY, xScreen - xS2 - 8, tubeH); c.restore();
      txt(g, '遮光筒', (xS2 + xScreen) / 2, tubeY - 10, 11, false, 'center');

      /* --- 光路（光锥） --- */
      c.save();
      c.globalAlpha = 0.16;
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(xLamp, cy - plateH * 0.34); c.lineTo(xS1, cy - 6); c.lineTo(xS1, cy + 6);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(xS1, cy); c.lineTo(xS2, cy - 12); c.lineTo(xS2, cy + 12);
      c.closePath(); c.fill();
      c.restore();
      c.save();
      c.globalAlpha = 0.22; c.fillStyle = col;
      c.beginPath();
      c.moveTo(xS2, cy - 12); c.lineTo(xScreen, cy - plateH * 0.62);
      c.lineTo(xScreen, cy + plateH * 0.62); c.lineTo(xS2, cy + 12);
      c.closePath(); c.fill();
      c.restore();

      /* --- 干涉条纹（屏上的亮度分布，用真模型算） --- */
      var scrH = plateH * 1.30, py0 = cy - scrH / 2;
      var spanMm = 30;                       /* 屏上固定的物理视场高度 30 mm */
      var pxPerMm = scrH / spanMm;
      box(g, xScreen, py0, Math.max(12, w * 0.020), scrH, '#EFEAD9', INK, 1.4);
      var sw = Math.max(12, w * 0.020), sy, rel, inten, env;
      for (sy = 0; sy < scrH; sy += 1) {
        rel = (sy - scrH / 2) / pxPerMm;                 /* mm，离中央亮纹的距离 */
        inten = Math.pow(Math.cos(Math.PI * rel / dy), 2);
        env = Math.exp(-Math.pow(rel / (spanMm * 0.42), 2));
        inten = inten * env;
        c.save();
        c.globalAlpha = clamp(0.9 * (1 - blur * 0.55), 0, 1) * clamp(inten, 0, 1);
        c.fillStyle = col;
        c.fillRect(xScreen + 1, py0 + sy, sw - 2, 1.2);
        c.restore();
      }
      /* 条纹中心小三角标注 */
      c.save(); c.fillStyle = INK;
      for (i = -3; i <= 3; i++) {
        var yf = cy + i * dy * pxPerMm;
        if (yf > py0 + 3 && yf < py0 + scrH - 3) {
          c.beginPath();
          c.moveTo(xScreen - 6, yf); c.lineTo(xScreen - 1, yf - 3); c.lineTo(xScreen - 1, yf + 3);
          c.closePath(); c.fill();
        }
      }
      c.restore();
      txt(g, '屏', xScreen + sw / 2, py0 - 11, 11, false, 'center');

      /* --- 波前（从双缝出发的两列球面波，step 推进） --- */
      var sepPx = clamp(pxPerMm * 0.6, 3, 10);
      for (i = 0; i < 5; i++) {
        var rr = ((tt * 46) % (scrH * 0.55)) + i * (scrH * 0.11);
        c.save();
        c.globalAlpha = clamp(0.24 - i * 0.04, 0, 0.24);
        c.strokeStyle = col; c.lineWidth = 1.1;
        c.beginPath(); c.arc(xS2, cy - sepPx / 2, rr, -1.35, 1.35); c.stroke();
        c.beginPath(); c.arc(xS2, cy + sepPx / 2, rr, -1.35, 1.35); c.stroke();
        c.restore();
      }

      /* --- 测量头（目镜 + 手轮） --- */
      var mx = Math.min(w - 34, xScreen + sw + 20), my = cy;
      c.save();
      c.strokeStyle = INK; c.lineWidth = 1.5;
      c.beginPath(); c.arc(mx, my, 15, 0, TAU); c.stroke();
      seg(g, mx - 22, my, mx + 22, my, INK, 1, [3, 3]);
      seg(g, mx, my - 20, mx, my + 20, INK, 1, [3, 3]);
      c.restore();
      txt(g, '测量头', mx, my + 30, 11, false, 'center');
      var scanY = py0 + scrH * (0.5 + 0.42 * Math.sin(tt * 0.9));
      seg(g, xScreen, scanY, mx, scanY, '#C8452F', 1, [4, 3]);
      head(g, xScreen + 1, scanY, Math.PI, 7, '#C8452F');

      /* --- 数据面板 --- */
      var lines = [
        ['L = ' + fx(L, 2) + ' m    d = ' + fx(d, 2) + ' mm', true],
        ['λ = ' + fx(lam, 0) + ' nm（' + (lam < 450 ? '紫' : lam < 495 ? '蓝' : lam < 570 ? '绿' : lam < 590 ? '黄' : lam < 620 ? '橙' : '红') + '光）', false],
        ['Δy = ' + fx(dy, 3) + ' mm', true],
        ['测 ' + n + ' 条亮纹总间距 = ' + fx((n - 1) * dy, 2) + ' mm', false]
      ];
      if (state.rows && state.rows.length) {
        var rr2 = state.rows[state.rows.length - 1];
        if (isfin(rr2.lamM)) lines.push(['最近测得 λ = ' + fx(rr2.lamM, 1) + ' nm', true]);
      }
      panel(g, w - 216, 12, 204, lines, 11.5);

      txt(g, '条纹间距 Δy = Lλ/d：d 越大、L 越小、λ 越短，条纹越密', 12, h - 14, 11, false, 'left');
      c.restore();
    },

    step: function (p, state, dt) {
      dsAnim.t += (isfin(dt) ? dt : 0);
      if (dsAnim.t > 1e6) dsAnim.t = 0;
    }
  };

  /* ====================================================================== *
   * 4. 登记（核心由 guanlan.html 先加载，这里的 register 是唯一动作）        *
   * ====================================================================== */

  function reg(spec) {
    var P = (typeof window !== 'undefined') ? window.QG_PSLAB : null;
    if (P && typeof P.register === 'function') {
      P.register(spec.id, spec);
      return true;
    }
    return false;
  }

  reg(REFRACTION);
  reg(DOUBLE_SLIT);

  /* 指纹兜底（与沙盒同一写法，万一有人检查模块自己的 origin） */
  if (typeof window !== 'undefined') {
    if (!window.QG_PSLAB_OPT_ORIGIN) window.QG_PSLAB_OPT_ORIGIN = BUILD;
  }
})();
