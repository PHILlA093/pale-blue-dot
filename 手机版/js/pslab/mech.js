/* ============================================================================
 * 穷观 · 物理实验台 · 组 1「力学」（8 个学生实验）
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件是**纯登记模块**：只调用 window.QG_PSLAB.register(id, spec) 把组 1 的 8 个
 * 实验交给实验台核心；自己**不建 DOM、不起循环、不读网络**（惰性，与沙盒一致）。
 * 加载顺序（见《物理实验台设计》§3）：js/pslab.js（核心）→ js/pslab/mech.js（本文件）。
 * 纯 ES5（无箭头函数 / let / const / 模板串 / class / eval / new Function）、零外部依赖。
 *
 * 实验清单（id 逐字取自设计契约 §2 组 1 表）：
 *   linear-motion      探究小车速度随时间变化的规律   v = v0 + at；纸带每 0.02 s 一个点；逐差法
 *   newton-second      探究加速度与力、质量的关系       a = (mg − f)/(M + m)；控制变量法
 *   force-composition  探究两个互成角度的力的合成规律   F = √(F1²+F2²+2F1F2cosθ)；等效替代法
 *   hooke-law          探究弹簧弹力与形变量的关系       F = kx；F–x 图线斜率求 k
 *   projectile         探究平抛运动的特点               x = v0t、y = ½gt²；y–x² 图线求 v0
 *   mech-energy        验证机械能守恒定律               mgh 与 ½mv²；v²–h 图线斜率 = 2a
 *   momentum           验证动量守恒定律                 m1v1 = m1v1′ + m2v2′；v = d/Δt
 *   simple-pendulum    用单摆测量重力加速度             T = 2π√(L/g)；T²–L 图线斜率 = 4π²/g
 *
 * 关于"测量值从哪来"（守设计契约 §1.3：不许伪造实验数据）：
 *   每个实验的 measure() 都由一个真实物理模型 model(p, i) 算出，误差项都能解释：
 *   纸带与毫米刻度尺的估读误差、光电门计时与遮光片宽度误差、秒表反应时间、摆角修正
 *   (1+θ0²/16)、斜槽末端不水平 β、频闪时间间隔、气垫导轨未调平、弹簧自重、砂和砂桶
 *   质量不满足 m ≪ M、纸带与限位孔摩擦与空气阻力等。
 *   噪声取**固定随机数流**（按"实验 id + 通道号"散列，同一条纸带/同一次测量的读数可复现），
 *   所以 measure() 可重复调用、结果稳定；连续测量按真实实验的做法推进"下一个数据点"
 *   （下一组条件 / 纸带上的下一个计数点），参数与噪声共同决定数值大小。
 *
 * 原理、器材、步骤、数据处理方法均按权威来源核对（人教版教材必修第一册/必修第二册/
 * 选择性必修第一册、2017 版《普通高中物理课程标准》"学生必做实验"、人教社《中小学数字化
 * 教学》"用单摆测重力加速度"、菁优网收录的教材原文实验题步骤），来源清单见交付回报。
 * ========================================================================= */

(function () {
  'use strict';

  var CORE = window.QG_PSLAB;
  /* 契约规定核心先加载；核心缺席时安静退出（不自建 DOM、不起轮询） */
  if (!CORE || typeof CORE.register !== 'function') { return; }

  var G_STD = 9.80;        /* 本机重力加速度标准值 (m/s²) —— 模型据此生成"真实"数据 */
  var DT_DOT = 0.02;       /* 打点计时器打点周期 (s)：50 Hz 交流电，每 0.02 s 打一个点 */
  var TC_CTRL = 0.10;      /* 每 5 个计时间隔取一个计数点 → T = 0.10 s */
  var PAPER = '#F4F1EA';   /* 纸色（与观澜物理沙盒同一观感） */
  var INK = '#26221C';     /* 墨色 */
  var SERIF = 'Georgia, "Times New Roman", "Songti SC", serif';

  /* ======================================================================
   * 一、基础数值工具
   * ==================================================================== */

  function num(v, d) { var x = parseFloat(v); return isFinite(x) ? x : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function round(v, n) {
    var m = Math.pow(10, n);
    return Math.round((isFinite(v) ? v : 0) * m) / m;
  }
  function fmt(v, n) { return (isFinite(v) ? v : 0).toFixed(n); }

  /* 可复现的散列随机数：同一个 (id, i, j) 永远得到同一个数 —— 保证 measure() 可重复 */
  function hashStr(s) {
    var h = 2166136261, i, k;
    s = String(s);
    for (i = 0; i < s.length; i++) {
      k = s.charCodeAt(i);
      h = (h ^ k) >>> 0;
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function hashMix(h, v) {
    var x = Math.round((isFinite(v) ? v : 0) * 1000) + 1048576;
    h = (h ^ (x & 65535)) >>> 0; h = (h * 16777619) >>> 0;
    h = (h ^ ((x >>> 16) & 65535)) >>> 0; h = (h * 16777619) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0; h = (h * 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return h >>> 0;
  }
  function rnd01(id, i, j) { return (hashMix(hashMix(hashStr(id), i), j) % 1000003) / 1000003; }
  /* 近似标准正态（三个均匀分布之和，Irwin–Hall），标准差 = sigma */
  function nz(id, i, j, sigma) {
    var u = rnd01(id, i, j) + rnd01(id, i, j + 137) + rnd01(id, i, j + 311);
    return (u - 1.5) * 2 * sigma;
  }

  /* "第几次测量"：连续测量推进数据系列的下一个点（真实实验：改一个条件再测一组） */
  var SEQ = {};
  function seqOf(id, K) { var k = SEQ[id] || 0; SEQ[id] = (k + 1) % K; return k; }

  /* 数据系列取值：把参数当前值当作系列起点，第 i 个点取系列里的第 i 个值。
     系列窗口按参数范围截取，且**随参数单调不减**，因此"参数↑ → 结果↑/↓"的方向可判。 */
  function sweep(p, key, i, K, lo, hi, frac) {
    var span = (hi - lo) * frac, step = span / (K - 1);
    var base = clamp(num(p && p[key], (lo + hi) / 2), lo, hi);
    var start = base;
    if (start + span > hi) { start = hi - span; }
    if (start < lo) { start = lo; }
    return clamp(start + step * i, lo, hi);
  }

  /* 最小二乘直线拟合：返回 {a: 斜率, b: 截距, r2} */
  function fitLine(pts) {
    var n = pts ? pts.length : 0, i, x, y, e;
    var sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    if (n < 2) { return null; }
    for (i = 0; i < n; i++) {
      x = num(pts[i] && pts[i].x, NaN); y = num(pts[i] && pts[i].y, NaN);
      if (!isFinite(x) || !isFinite(y)) { return null; }
      sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
    }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) { return null; }
    var a = (n * sxy - sx * sy) / den;
    var b = (sy - a * sx) / n;
    var sst = syy - sy * sy / n, ssr = 0;
    for (i = 0; i < n; i++) {
      e = num(pts[i].y, 0) - (a * num(pts[i].x, 0) + b);
      ssr += e * e;
    }
    return { a: a, b: b, r2: (sst > 1e-15 ? 1 - ssr / sst : 1) };
  }

  function ptsOf(rows, kx, ky) {
    var out = [], i, r;
    if (!rows) { return out; }
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (!r) { continue; }
      out.push({ x: num(r[kx], 0), y: num(r[ky], 0) });
    }
    return out;
  }
  function meanOf(rows, key) {
    var s = 0, n = 0, i, v;
    if (!rows) { return 0; }
    for (i = 0; i < rows.length; i++) {
      v = num(rows[i] && rows[i][key], NaN);
      if (isFinite(v)) { s += v; n++; }
    }
    return n ? s / n : 0;
  }

  /* 参数/列 的构造小工具 */
  function P(key, label, unit, min, max, step, value) {
    return { key: key, label: label, unit: unit, min: min, max: max, step: step, value: value };
  }
  function COL(key, label, unit) { return { key: key, label: label, unit: unit }; }

  /* ======================================================================
   * 二、画图工具（虚拟坐标系 560×340，随画布自适应缩放；纸色/墨色/Georgia 斜体）
   * ==================================================================== */

  var VIR_W = 560, VIR_H = 340;

  function C(g) { return (g && g.c) ? g.c : null; }
  function paperOf(g) { return (g && typeof g.paper === 'string' && g.paper) ? g.paper : PAPER; }
  function inkOf(g) { return (g && typeof g.ink === 'string' && g.ink) ? g.ink : INK; }

  function setF(vg, size, weight) {
    vg.c.font = (weight ? weight + ' ' : '') + 'italic ' + size + 'px ' + SERIF;
  }
  function T(vg, s, x, y, size, align, color, weight) {
    if (!vg || !vg.c) { return; }
    var c = vg.c;
    c.save();
    setF(vg, size || 13, weight || '');
    c.fillStyle = color || INK;
    c.textAlign = align || 'left';
    c.textBaseline = 'middle';
    c.fillText(String(s), x, y);
    c.restore();
  }
  function L(vg, x1, y1, x2, y2, w, color, dash) {
    if (!vg || !vg.c) { return; }
    var c = vg.c;
    c.save();
    c.strokeStyle = color || INK;
    c.lineWidth = (w === undefined ? 1.2 : w);
    c.lineCap = 'round';
    if (dash && c.setLineDash) { c.setLineDash(dash); }
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.restore();
  }
  function RC(vg, x, y, w, h, fill, stroke, lw) {
    if (!vg || !vg.c) { return; }
    var c = vg.c;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = (lw === undefined ? 1.2 : lw); c.stroke(); }
    c.restore();
  }
  function CI(vg, x, y, r, fill, stroke, lw, dash) {
    if (!vg || !vg.c) { return; }
    var c = vg.c;
    c.save();
    c.beginPath();
    c.arc(x, y, Math.max(r, 0.2), 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) {
      c.strokeStyle = stroke; c.lineWidth = (lw === undefined ? 1.2 : lw);
      if (dash && c.setLineDash) { c.setLineDash(dash); }
      c.stroke();
    }
    c.restore();
  }
  /* 力矢量箭头（带箭头头部） */
  function AR(vg, x1, y1, x2, y2, w, color) {
    if (!vg || !vg.c) { return; }
    var c = vg.c, dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), ux, uy, hl = 8;
    if (len < 0.5) { return; }
    ux = dx / len; uy = dy / len;
    c.save();
    c.strokeStyle = color || INK;
    c.fillStyle = color || INK;
    c.lineWidth = (w === undefined ? 1.6 : w);
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - ux * hl * 0.8, y2 - uy * hl * 0.8); c.stroke();
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - ux * hl - uy * hl * 0.42, y2 - uy * hl + ux * hl * 0.42);
    c.lineTo(x2 - ux * hl + uy * hl * 0.42, y2 - uy * hl - ux * hl * 0.42);
    c.closePath(); c.fill();
    c.restore();
  }
  /* 弹簧（锯齿） */
  function springZig(vg, x, y0, y1, coils, amp, color, lw) {
    if (!vg || !vg.c) { return; }
    var c = vg.c, n = Math.max(4, coils || 10), i, t, yy, xx, sign = 1;
    c.save();
    c.strokeStyle = color || INK;
    c.lineWidth = (lw === undefined ? 1.4 : lw);
    c.beginPath();
    c.moveTo(x, y0);
    for (i = 0; i <= n * 2; i++) {
      t = i / (n * 2);
      yy = y0 + (y1 - y0) * t;
      xx = x + ((i === 0 || i === n * 2) ? 0 : sign * amp);
      c.lineTo(xx, yy);
      sign = -sign;
    }
    c.stroke();
    c.restore();
  }
  /* 竖直刻度尺（毫米刻度，带 cm 数字） */
  function rulerV(vg, x, y0, y1, cmTotal, color) {
    var c = color || 'rgba(38,34,28,0.75)';
    RC(vg, x - 9, y0, 18, y1 - y0, 'rgba(255,255,255,0.55)', c, 1);
    var pxPerCm = (y1 - y0) / cmTotal, i, n = Math.round(cmTotal * 10), yy, long;
    for (i = 0; i <= n; i++) {
      yy = y0 + i * pxPerCm / 10;
      long = (i % 10 === 0);
      L(vg, x - 9, yy, x - 9 + (long ? 9 : (i % 5 === 0 ? 6 : 3.5)), yy, long ? 1 : 0.6, c);
      if (long && i % 20 === 0) {
        T(vg, String(i / 10), x + 13, yy, 9.5, 'left', 'rgba(38,34,28,0.7)');
      }
    }
  }
  /* 水平刻度尺 */
  function rulerH(vg, y, x0, x1, cmTotal, color) {
    var c = color || 'rgba(38,34,28,0.75)';
    RC(vg, x0, y - 9, x1 - x0, 18, 'rgba(255,255,255,0.5)', c, 1);
    var pxPerCm = (x1 - x0) / cmTotal, i, n = Math.round(cmTotal * 10), xx, long;
    for (i = 0; i <= n; i++) {
      xx = x0 + i * pxPerCm / 10;
      long = (i % 10 === 0);
      L(vg, xx, y - 9, xx, y - 9 + (long ? 9 : (i % 5 === 0 ? 6 : 3.5)), long ? 1 : 0.6, c);
      if (long && i % 20 === 0) { T(vg, String(i / 10), xx, y + 13, 9.5, 'center', 'rgba(38,34,28,0.7)'); }
    }
  }
  /* 画面里的数据小图（核心另有图像栏；这里只为让"已测数据点"出现在装置图上） */
  function insetPlot(vg, x0, y0, w, h, pts, ox, oy, labX, labY) {
    if (!vg || !vg.c) { return; }
    var i, n = pts ? pts.length : 0, v;
    var px = [], py = [];
    RC(vg, x0, y0, w, h, 'rgba(255,255,255,0.55)', 'rgba(38,34,28,0.35)', 0.8);
    for (i = 0; i < n; i++) {
      v = num(pts[i] && pts[i].x, NaN); if (isFinite(v)) { px.push(v); }
      v = num(pts[i] && pts[i].y, NaN); if (isFinite(v)) { py.push(v); }
    }
    if (!px.length || !py.length) {
      T(vg, '（暂无数据）', x0 + w / 2, y0 + h / 2, 11, 'center', 'rgba(38,34,28,0.45)');
      return;
    }
    if (isFinite(ox)) { px.push(ox); }
    if (isFinite(oy)) { py.push(oy); }
    var xmin = Math.min.apply(null, px), xmax = Math.max.apply(null, px);
    var ymin = Math.min.apply(null, py), ymax = Math.max.apply(null, py);
    var padx = (xmax - xmin) * 0.14 || 1, pady = (ymax - ymin) * 0.14 || 1;
    xmin -= padx; xmax += padx; ymin -= pady; ymax += pady;
    var X = function (v2) { return x0 + (v2 - xmin) / (xmax - xmin) * w; };
    var Y = function (v2) { return y0 + h - (v2 - ymin) / (ymax - ymin) * h; };
    L(vg, x0, y0 + h, x0 + w, y0 + h, 0.9, 'rgba(38,34,28,0.55)');
    L(vg, x0, y0, x0, y0 + h, 0.9, 'rgba(38,34,28,0.55)');
    if (isFinite(ox) && isFinite(oy) && ox >= xmin && ox <= xmax && oy >= ymin && oy <= ymax) {
      CI(vg, X(ox), Y(oy), 1.6, 'rgba(38,34,28,0.6)', null, 0);
    }
    var fit = fitLine(pts);
    if (fit && isFinite(fit.a)) {
      var xa = xmin, xb = xmax;
      L(vg, X(xa), Y(fit.a * xa + fit.b), X(xb), Y(fit.a * xb + fit.b), 1, 'rgba(38,34,28,0.5)', [4, 3]);
    }
    for (i = 0; i < n; i++) {
      CI(vg, X(num(pts[i] && pts[i].x, 0)), Y(num(pts[i] && pts[i].y, 0)), 2.4, INK, null, 0);
    }
    if (labX) { T(vg, labX, x0 + w, y0 + h + 10, 9.5, 'right', 'rgba(38,34,28,0.7)'); }
    if (labY) { T(vg, labY, x0 - 2, y0 - 8, 9.5, 'left', 'rgba(38,34,28,0.7)'); }
  }

  /* 场景：把虚拟 560×340 坐标系铺到画布中央（等比缩放） */
  function scene(g) {
    var c = C(g);
    if (!c) { return null; }
    var w = Math.max(140, num(g && g.w, VIR_W)), h = Math.max(120, num(g && g.h, VIR_H));
    var s = Math.min(w / VIR_W, h / VIR_H);
    var ox = (w - VIR_W * s) / 2, oy = (h - VIR_H * s) / 2;
    c.save();
    c.translate(ox, oy);
    c.scale(s, s);
    return { c: c, s: s, w: w, h: h };
  }
  function bgFill(g) {
    var c = C(g);
    if (!c) { return; }
    var w = Math.max(1, num(g && g.w, VIR_W)), h = Math.max(1, num(g && g.h, VIR_H));
    c.save();
    c.fillStyle = paperOf(g);
    c.fillRect(0, 0, w, h);
    c.restore();
  }
  /* 每帧的"最后一笔"：1×1 的确定性哨兵像素（位置固定，颜色由实验 id 散列决定）。
     它解决的问题是"中途抛错 → 画面只画了一半，却没人发现"：
     只要断言"每帧最后一条绘制指令是哨兵"，画一半就必然露馅。 */
  function sentinelColor(id) {
    var h = hashStr(id);
    return 'rgb(' + ((h >>> 16) & 255) + ',' + ((h >>> 8) & 255) + ',' + (h & 255) + ')';
  }
  function paintSentinel(vg, id) {
    /* 刻意不写成对 save/restore：万一 fillRect 抛错，也不会在画布状态栈上留下不平衡的 save。
       （其它绘图原语都各自设置 fillStyle/strokeStyle，所以即使 fillStyle 没还原也无副作用。） */
    var c = vg.c, old = c.fillStyle;
    c.fillStyle = sentinelColor(id);
    c.fillRect(VIR_W - 4, VIR_H - 4, 1, 1);
    c.fillStyle = old;
  }

  /* 异常上报：console.warn 只报一次（避免每帧 60 条把控制台刷爆），
     但 state.lastError **每帧都写**（成功时清成 null），所以"画一半"藏不住。
     注意：先到的错误不被后到的覆盖 —— 离根因最近的那条最有用。 */
  var WARNED = {};
  function reportError(where, id, state, e) {
    var msg = String((e && e.message) || e);
    if (state) {
      if (!state.lastError) { state.lastError = msg; }
      if (where === 'sentinel') { state.sentinelFailed = true; }
    }
    var key = id + '|' + where + '|' + msg;
    if (!WARNED[key]) {
      WARNED[key] = 1;
      if (typeof console !== 'undefined' && console && console.warn) {
        console.warn('[mech] ' + where + ' failed: ' + id + ' — ' + msg);
      }
    }
  }

  /* draw() 的护栏：任何异常都不许抛给核心（核心每帧调用，抛一次就是一屏 console 异常），
     但**不许静默**：state.lastError 记下原因，末尾照画哨兵像素。 */
  function safeDraw(id, body) {
    return function (g, p, state) {
      var c = C(g);
      if (!c) { return; }
      var st = state || {}, vg = null;
      c.save();
      try {
        bgFill(g);
        vg = scene(g);
        if (vg) { body(vg, p || {}, st); }
        st.lastError = null;
      } catch (e) {
        reportError('draw', id, st, e);
      }
      try {
        if (vg) { paintSentinel(vg, id); }
        st.sentinelFailed = false;
      } catch (e2) {
        /* 连"最后一笔"都画不出来：这道兜底**也必须出声**——它一旦静默，
           draw 里任何新异常就会再次变成"console 干净 + 画面缺一半"。 */
        reportError('sentinel', id, st, e2);
      }
      c.restore();
    };
  }
  function safeStep(id, body) {
    return function (p, state, dt) {
      var st = state || {};
      try { body(p || {}, st, num(dt, 0)); st.lastError = null; }
      catch (e) { reportError('step', id, st, e); }
    };
  }
  function safePointer(id, body) {
    return function (ev, p, state) {
      var st = state || {};
      try { body(ev || {}, p || {}, st); }
      catch (e) { reportError('pointer', id, st, e); }
    };
  }

  /* 装置图的统一抬头：实验名 + 当前关键读数 */
  function caption(vg, title, lines) {
    T(vg, title, 12, 14, 13.5, 'left', INK, 'bold');
    var i;
    for (i = 0; i < (lines ? lines.length : 0); i++) {
      T(vg, lines[i], 12, 30 + i * 13, 11, 'left', 'rgba(38,34,28,0.82)');
    }
  }

  /* 结论/图表兜底：数据表为空时用模型自己生成一小段系列（不改动测量序列） */
  function seriesOf(model, p, K) {
    var out = [], i;
    for (i = 0; i < K; i++) { out.push(model(p, i)); }
    return out;
  }

  /* ======================================================================
   * 实验 1 · linear-motion：探究小车速度随时间变化的规律
   * 模型：a = (F − f)/M，v = v0 + at，x = v0t + ½at²
   *   打点计时器 50 Hz → 每 0.02 s 一个点；每 5 个间隔取一个计数点（T = 0.10 s）
   *   vₙ = (xₙ₊₁ − xₙ₋₁)/(2T)；逐差法 a = [(d₄+d₅+d₆) − (d₁+d₂+d₃)]/(9T²)
   * 误差：毫米刻度尺估读 σ ≈ 0.2 mm、纸带与限位孔摩擦、电源频率偏差
   * ==================================================================== */
  var LMv = { M: [0.20, 1.00, 0.40], F: [0.05, 0.50, 0.20], f: [0.00, 0.10, 0.02], v0: [0.00, 0.30, 0.00] };
  var LM_K = 8;          /* 数据系列 = 纸带上第 1…8 个计数点 */
  var LM_TAPE = 0.60;    /* 纸带可用长度 (m) */

  function lmModel(p, i) {
    var id = 'linear-motion';
    var M = clamp(num(p && p.M, LMv.M[2]), LMv.M[0], LMv.M[1]);
    var F = clamp(num(p && p.F, LMv.F[2]), LMv.F[0], LMv.F[1]);
    var f = clamp(num(p && p.f, LMv.f[2]), LMv.f[0], LMv.f[1]);
    var v0 = clamp(num(p && p.v0, LMv.v0[2]), LMv.v0[0], LMv.v0[1]);
    var a = (F - f) / M;
    var kmax = clamp(Math.round(Math.floor(Math.sqrt(2 * LM_TAPE / Math.max(a, 0.05)) / TC_CTRL)), 4, LM_K);
    var n = (i % kmax) + 1;
    var xs = [0], k, tk;
    for (k = 1; k <= kmax + 1; k++) {
      tk = k * TC_CTRL;
      xs[k] = (v0 * tk + 0.5 * a * tk * tk) * 100 + nz(id, 0, k, 0.02);   /* cm（毫米刻度尺读数） */
    }
    var t = n * TC_CTRL, x = xs[n], dx = xs[n] - xs[n - 1];
    var v = (n + 1 <= kmax + 1)
      ? ((xs[n + 1] - xs[n - 1]) / 100) / (2 * TC_CTRL)
      : ((xs[n] - xs[n - 1]) / 100) / TC_CTRL;
    var aLd = a, d = [], q;
    if (kmax >= 5) {
      for (q = 1; q <= 6; q++) { d[q] = (xs[q] - xs[q - 1]) / 100; }
      aLd = ((d[4] + d[5] + d[6]) - (d[1] + d[2] + d[3])) / (9 * TC_CTRL * TC_CTRL);
    }
    var dots = [], m, td;
    for (m = 1; m <= 5; m++) {                       /* 本区间内的 5 个计时点（0.02 s 一个） */
      td = (n - 1) * TC_CTRL + m * DT_DOT;
      dots.push(round((v0 * td + 0.5 * a * td * td) * 100 + nz(id, 0, Math.round(td / DT_DOT), 0.02), 3));
    }
    return {
      n: n, t: round(t, 2), x: round(x, 2), dx: round(dx, 2),
      v: round(v, 3), a: round(aLd, 3), dots: dots, kmax: kmax
    };
  }

  function lmConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(lmModel, p, 6);
    var fit = fitLine(ptsOf(list, 't', 'v'));
    var aLd = meanOf(list, 'a');
    var a = (fit && isFinite(fit.a)) ? fit.a : aLd;
    var M = clamp(num(p && p.M, LMv.M[2]), LMv.M[0], LMv.M[1]);
    var F = clamp(num(p && p.F, LMv.F[2]), LMv.F[0], LMv.F[1]);
    var f = clamp(num(p && p.f, LMv.f[2]), LMv.f[0], LMv.f[1]);
    return {
      value: round(a, 3), unit: 'm/s²',
      text: '纸带上取了 ' + list.length + ' 个计数点：v–t 图线是一条倾斜的直线（r² = ' +
        fmt(fit ? fit.r2 : 1, 4) + '），斜率 k = ' + fmt(a, 3) + ' m/s²；逐差法求得 a = ' +
        fmt(aLd, 3) + ' m/s²，两者一致。可见小车在恒定牵引力作用下做匀变速直线运动，a ≈ ' +
        fmt(a, 2) + ' m/s²（理论值 (F−f)/M = ' + fmt((F - f) / M, 2) + ' m/s²）。',
      errors: [
        '纸带与限位孔、滑轮轴之间的摩擦使实测加速度略小于 (F−f)/M',
        '毫米刻度尺读数要估读到 0.1 mm，各计数点位置都带读数误差（本模型取 σ ≈ 0.2 mm）',
        '交流电源频率不严格等于 50 Hz 时打点周期不是 0.02 s，时间基准整体偏移',
        '先释放小车后接通电源会漏掉开始的点，起点位置不准'
      ]
    };
  }

  function lmDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var M = clamp(num(p.M, LMv.M[2]), LMv.M[0], LMv.M[1]);
    var F = clamp(num(p.F, LMv.F[2]), LMv.F[0], LMv.F[1]);
    var f = clamp(num(p.f, LMv.f[2]), LMv.f[0], LMv.f[1]);
    var v0 = clamp(num(p.v0, LMv.v0[2]), LMv.v0[0], LMv.v0[1]);
    var a = (F - f) / M;
    var cur = rows.length ? rows[rows.length - 1] : lmModel(p, 0);
    caption(vg, '探究小车速度随时间变化的规律', [
      'M = ' + fmt(M, 2) + ' kg    F = ' + fmt(F, 2) + ' N    f = ' + fmt(f, 3) + ' N    a = (F−f)/M = ' + fmt(a, 3) + ' m/s²',
      '打点计时器 50 Hz → 每隔 0.02 s 打一个点；每 5 个间隔取一个计数点，T = 0.10 s',
      '当前第 ' + cur.n + ' 个计数点：t = ' + fmt(cur.t, 1) + ' s    x = ' + fmt(cur.x, 2) + ' cm    v = ' + fmt(cur.v, 3) + ' m/s'
    ]);

    /* 桌面 + 长木板 + 打点计时器 + 小车 + 定滑轮 + 钩码 */
    L(vg, 22, 238, 538, 238, 1.6, 'rgba(38,34,28,0.5)');
    RC(vg, 58, 180, 342, 9, 'rgba(38,34,28,0.10)', INK, 1.2);
    RC(vg, 70, 148, 64, 32, 'rgba(38,34,28,0.14)', INK, 1.2);
    T(vg, '打点计时器', 102, 164, 9.5, 'center');
    L(vg, 70, 172, 34, 206, 1, 'rgba(38,34,28,0.45)', [3, 3]);
    T(vg, '4~6 V 交流', 34, 216, 9, 'left', 'rgba(38,34,28,0.6)');

    var ph = (num(state.t, 0) % 1.8) / 1.8;
    var carX = 178 + ph * 148;
    L(vg, 134, 162, carX, 162, 4, 'rgba(38,34,28,0.22)');          /* 纸带 */
    T(vg, '纸带', 150, 152, 9, 'left', 'rgba(38,34,28,0.6)');
    RC(vg, carX, 150, 58, 22, 'rgba(38,34,28,0.16)', INK, 1.2);
    CI(vg, carX + 13, 174, 6, 'rgba(38,34,28,0.2)', INK, 1);
    CI(vg, carX + 45, 174, 6, 'rgba(38,34,28,0.2)', INK, 1);
    T(vg, '小车', carX + 29, 161, 9.5, 'center');
    L(vg, carX + 58, 156, 418, 156, 1.1, 'rgba(38,34,28,0.7)');    /* 细线 */
    CI(vg, 424, 156, 12, 'rgba(255,255,255,0.75)', INK, 1.2);
    T(vg, '定滑轮', 424, 138, 9.5, 'center');
    L(vg, 436, 156, 436, 196, 1.1, 'rgba(38,34,28,0.7)');
    RC(vg, 426, 196, 20, 26, 'rgba(38,34,28,0.18)', INK, 1.2);
    T(vg, '钩码', 470, 210, 9.5, 'left');

    /* 放大后的纸带：0.02 s 一个点，加粗处为计数点 */
    var tmax = Math.max(0.1, cur.kmax * TC_CTRL);
    var xmax = Math.max(0.5, (v0 * tmax + 0.5 * a * tmax * tmax) * 100);
    var px0 = 62, pw = 436, i, j, xx, dotN = Math.round(tmax / DT_DOT);
    T(vg, '放大后的纸带（每 0.02 s 一个点）', px0, 252, 10.5, 'left', 'rgba(38,34,28,0.75)');
    RC(vg, px0, 262, pw, 15, 'rgba(255,255,255,0.75)', 'rgba(38,34,28,0.55)', 1);
    for (j = 0; j <= dotN; j++) {
      xx = px0 + ((v0 * j * DT_DOT + 0.5 * a * Math.pow(j * DT_DOT, 2)) * 100) / xmax * pw;
      if (j % 5 === 0) {
        L(vg, xx, 258, xx, 262, 1.2, INK);
        T(vg, String(j / 5), xx, 254, 8.5, 'center', 'rgba(38,34,28,0.7)');
      }
      CI(vg, xx, 269.5, 1.15, INK, null, 0);
    }
    for (i = 0; i < rows.length; i++) {                            /* 已测计数点在纸带上的位置 */
      xx = px0 + num(rows[i].x, 0) / xmax * pw;
      if (xx > px0 + pw) { continue; }
      L(vg, xx, 277, xx, 284, 1, 'rgba(38,34,28,0.5)');
      if (i === rows.length - 1) { CI(vg, xx, 288, 2.6, INK, null, 0); }
    }
    rulerH(vg, 300, px0, px0 + pw, xmax);
    T(vg, 'cm', px0 + pw + 6, 300, 9.5, 'left', 'rgba(38,34,28,0.7)');
  }

  /* ======================================================================
   * 实验 2 · newton-second：探究加速度与力、质量的关系
   * 模型（控制变量法）：对小车与砂桶组成的系统 mg − f = (M + m)a
   *   → a = (mg − f)/(M + m)；细线实际张力 T = Ma + f < mg
   *   学生把 F = mg 当作小车所受的拉力：只有 m ≪ M 时 a ≈ (F − f)/M 才是直线
   * 误差：阻力未完全补偿、m 不满足 ≪ M（F 大时图线向下弯曲）、纸带摩擦、天平与读数误差
   * ==================================================================== */
  var NSv = { M: [0.20, 1.00, 0.50], m: [0.005, 0.100, 0.010], f: [0.00, 0.15, 0.02] };
  var NS_K = 6;

  function nsModel(p, i) {
    var id = 'newton-second';
    var M = clamp(num(p && p.M, NSv.M[2]), NSv.M[0], NSv.M[1]);
    var m = sweep(p, 'm', i, NS_K, NSv.m[0], NSv.m[1], 0.10);
    var f = clamp(num(p && p.f, NSv.f[2]), NSv.f[0], NSv.f[1]);
    var F = m * G_STD;
    var a = (F - f) / (M + m);
    var Tm = M * a + f;
    var am = a + nz(id, i, 0, 0.012 * Math.max(a, 0.2));   /* 纸带逐差法测得（相对误差 ~1.2%） */
    return {
      M: round(M, 3), m: round(m, 4), F: round(F, 3),
      T: round(Tm, 3), a: round(am, 3), invM: round(1 / M, 3)
    };
  }

  function nsConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(nsModel, p, NS_K);
    var fit = fitLine(ptsOf(list, 'F', 'a'));
    var M = meanOf(list, 'M'), mAvg = meanOf(list, 'm');
    var slope = (fit && isFinite(fit.a)) ? fit.a : 0;
    var Mfit = slope > 1e-6 ? 1 / slope : 0;
    var dev = M > 0 ? Math.abs(Mfit - M) / M * 100 : 0;
    var f = clamp(num(p && p.f, NSv.f[2]), NSv.f[0], NSv.f[1]);
    var tail = dev > 8
      ? '偏差偏大是因为砂和砂桶的总质量不满足远小于小车质量：细线张力 T = Ma + f 明显小于 mg，a–F 图线在大 F 端向下弯曲。'
      : '此时 m 远小于 M，细线张力 T ≈ mg，所以 a ≈ F/M。';
    return {
      value: round(Mfit, 3), unit: 'kg',
      text: '保持小车质量 M = ' + fmt(M, 2) + ' kg 不变，改变砂和砂桶的总质量得到 ' + list.length +
        ' 组 (F, a) 数据：a–F 图线是一条直线（r² = ' + fmt(fit ? fit.r2 : 1, 4) + '），斜率 k = ' +
        fmt(slope, 3) + ' kg⁻¹，由 M = 1/k 得 M = ' + fmt(Mfit, 3) + ' kg，与天平测得值相差 ' +
        fmt(dev, 1) + '%；纵轴截距 ' + fmt(fit ? fit.b : 0, 3) + ' m/s²（由 a = (F−f)/M 可知截距为 −f/M = ' +
        fmt(-f / M, 3) + ' m/s²，说明阻力未完全补偿）。本组砂和砂桶质量平均 ' + fmt(mAvg * 1000, 1) + ' g。' + tail +
        ' 反过来说明：质量一定时加速度与合外力成正比。',
      errors: [
        '阻力未完全补偿：图线不过原点、在纵轴上有负截距（垫高木板时小车的匀速状态不易判断）',
        '砂和砂桶总质量 m 不够小：细线张力 T = Ma + f 小于 mg，F 较大时 a–F 图线向下弯曲',
        '纸带与限位孔摩擦、滑轮摩擦随速度变化，使各次测量的系统偏差不完全相同',
        '逐差法处理纸带时的读数误差与天平称量误差'
      ]
    };
  }

  function nsDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var M = clamp(num(p.M, NSv.M[2]), NSv.M[0], NSv.M[1]);
    var f = clamp(num(p.f, NSv.f[2]), NSv.f[0], NSv.f[1]);
    var mNow = rows.length ? num(rows[rows.length - 1].m, NSv.m[2]) : sweep(p, 'm', 0, NS_K, NSv.m[0], NSv.m[1], 0.35);
    var aNow = (mNow * G_STD - f) / (M + mNow);
    caption(vg, '探究加速度与力、质量的关系（控制变量法）', [
      'M = ' + fmt(M, 2) + ' kg    m = ' + fmt(mNow * 1000, 1) + ' g    f(未补偿) = ' + fmt(f, 3) + ' N',
      'a = (mg − f)/(M + m) = ' + fmt(aNow, 3) + ' m/s²    （m ≪ M 时 a ≈ (F − f)/M）',
      '垫高木板不带滑轮的一端，不挂砂桶时轻推小车，纸带上点距均匀即补偿好阻力'
    ]);

    /* 桌面 + 垫木 + 倾斜长木板 */
    L(vg, 22, 262, 400, 262, 1.6, 'rgba(38,34,28,0.5)');
    RC(vg, 52, 240, 26, 22, 'rgba(38,34,28,0.16)', INK, 1.2);
    T(vg, '垫木', 65, 234, 9, 'center', 'rgba(38,34,28,0.75)');
    var bx0 = 46, by0 = 240, bx1 = 386, by1 = 196;
    L(vg, bx0, by0, bx1, by1, 1.4, INK);
    L(vg, bx0, by0 + 9, bx1, by1 + 9, 1.4, INK);
    L(vg, bx0, by0, bx0, by0 + 9, 1.2, INK);
    L(vg, bx1, by1, bx1, by1 + 9, 1.2, INK);
    RC(vg, 48, 208, 60, 30, 'rgba(38,34,28,0.14)', INK, 1.2);
    T(vg, '打点计时器', 78, 223, 9.5, 'center');

    var ph = (num(state.t, 0) % 2.2) / 2.2;
    var cx = bx0 + 150 + ph * 130, cy = by0 + (cx - bx0) / (bx1 - bx0) * (by1 - by0);
    L(vg, 108, 218, cx, cy - 20, 3.4, 'rgba(38,34,28,0.22)');
    RC(vg, cx - 6, cy - 42, 58, 20, 'rgba(38,34,28,0.16)', INK, 1.2);
    CI(vg, cx + 6, cy - 18, 5.5, 'rgba(38,34,28,0.2)', INK, 1);
    CI(vg, cx + 38, cy - 18, 5.5, 'rgba(38,34,28,0.2)', INK, 1);
    T(vg, '小车', cx + 23, cy - 32, 9.5, 'center');
    L(vg, cx + 52, cy - 25, bx1 + 8, by1 - 8, 1.1, 'rgba(38,34,28,0.7)');
    CI(vg, bx1 + 14, by1 + 2, 11, 'rgba(255,255,255,0.75)', INK, 1.2);
    T(vg, '定滑轮', bx1 + 14, by1 - 16, 9.5, 'center');
    L(vg, bx1 + 25, by1 + 4, bx1 + 25, 214, 1.1, 'rgba(38,34,28,0.7)');
    RC(vg, bx1 + 15, 214, 21, 8, 'rgba(38,34,28,0.2)', INK, 1.1);
    RC(vg, bx1 + 13, 224, 25, 24, 'rgba(38,34,28,0.16)', INK, 1.2);
    T(vg, '砂桶', bx1 + 50, 236, 9.5, 'left');
    T(vg, 'F = mg = ' + fmt(mNow * G_STD, 2) + ' N', bx1 + 50, 250, 9.5, 'left', 'rgba(38,34,28,0.75)');

    insetPlot(vg, 408, 40, 140, 122, ptsOf(rows, 'F', 'a'), 0, 0, 'F / N', 'a / (m·s⁻²)');
    T(vg, 'a–F 图线', 408, 172, 10, 'left', 'rgba(38,34,28,0.75)');
    T(vg, '（保持 M 不变）', 408, 185, 9.5, 'left', 'rgba(38,34,28,0.6)');
    T(vg, '砂桶重力 F = mg', 408, 200, 9.5, 'left', 'rgba(38,34,28,0.6)');
    T(vg, '张力 T = Ma + f < mg', 408, 213, 9.5, 'left', 'rgba(38,34,28,0.6)');
  }

  /* ======================================================================
   * 实验 3 · force-composition：探究两个互成角度的力的合成规律
   * 模型：平行四边形定则 F = √(F1² + F2² + 2F1F2cosθ)（θ 为两分力夹角）
   *   合力与 F1 的夹角 φ = atan2(F2sinθ, F1 + F2cosθ)
   *   实验值 F′ 由"只用一只弹簧测力计把结点拉到同一位置 O"读出（等效替代）
   *   F 是作图得到的理论值，F′ 是实测值：F′ 一定沿 AO 方向，F 不一定
   * 误差：测力计读数与校零、两分力方向记录偏差、结点未拉到同一位置、作图与标度误差
   * ==================================================================== */
  var FCv = { F1: [1.0, 6.0, 3.0], F2: [1.0, 6.0, 2.5], th: [30, 150, 60], err: [0, 3, 1.0] };
  var FC_K = 6;

  function fcModel(p, i) {
    var id = 'force-composition';
    var F1 = clamp(num(p && p.F1, FCv.F1[2]), FCv.F1[0], FCv.F1[1]);
    var F2 = clamp(num(p && p.F2, FCv.F2[2]), FCv.F2[0], FCv.F2[1]);
    var th = sweep(p, 'th', i, FC_K, FCv.th[0], FCv.th[1], 0.35);
    var er = clamp(num(p && p.err, FCv.err[2]), FCv.err[0], FCv.err[1]);
    var rad = th * Math.PI / 180;
    var F = Math.sqrt(F1 * F1 + F2 * F2 + 2 * F1 * F2 * Math.cos(rad));
    var phi = Math.atan2(F2 * Math.sin(rad), F1 + F2 * Math.cos(rad)) * 180 / Math.PI;
    var Fexp = F + nz(id, i, 0, F * er / 100 * 0.55) + F * 0.003;
    return {
      F1: round(F1, 2), F2: round(F2, 2), th: round(th, 1),
      F: round(F, 3), phi: round(phi, 1), Fexp: round(Fexp, 3),
      dev: round((Fexp - F) / F * 100, 2)
    };
  }

  function fcConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(fcModel, p, FC_K);
    var fit = fitLine(ptsOf(list, 'F', 'Fexp'));
    var slope = (fit && isFinite(fit.a)) ? fit.a : 1;
    var devAvg = 0, i, mx = 0, v;
    for (i = 0; i < list.length; i++) {
      v = Math.abs(num(list[i].dev, 0));
      devAvg += v;
      if (v > mx) { mx = v; }
    }
    devAvg = list.length ? devAvg / list.length : 0;
    return {
      value: round(slope, 3), unit: '',
      text: '把两个分力的图示为邻边作平行四边形，对角线（理论合力 F）与用一只弹簧测力计实测的合力 F′ 相比：' +
        '以 F 为横轴、F′ 为纵轴作图得斜率 k = ' + fmt(slope, 3) + '（r² = ' + fmt(fit ? fit.r2 : 1, 4) +
        '），平均相对偏差 ' + fmt(devAvg, 2) + '%，最大 ' + fmt(mx, 2) +
        '%。在误差允许范围内 F′ 与 F 大小相等、方向相同（F′ 沿 AO 方向），说明两个互成角度的力的合成遵循平行四边形定则。',
      errors: [
        '弹簧测力计的读数误差与未校零（使用前要检查指针是否指零）',
        '记录两分力方向时描点不准，导致夹角 θ 与力方向的偏差',
        '只用一只测力计时结点没有拉到同一位置 O，等效替代不严格（O 点位置记录不准）',
        '力的图示标度选取与作图（连平行四边形）带来的误差'
      ]
    };
  }

  function fcDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var cur = rows.length ? rows[rows.length - 1] : fcModel(p, 0);
    var F1 = num(cur.F1, 3), F2 = num(cur.F2, 2.5), th = num(cur.th, 60);
    var rad = th * Math.PI / 180, half = rad / 2;
    var sF = 34;                                     /* 力矢量的作图标度：34 px / N */
    if (Math.max(F1, F2) * sF > 250) { sF = 250 / Math.max(F1, F2); }
    var Ox = 236, Oy = 178;
    var d1x = Math.cos(-half), d1y = Math.sin(-half), d2x = Math.cos(half), d2y = Math.sin(half);
    var t1x = Ox + F1 * d1x * sF, t1y = Oy + F1 * d1y * sF;
    var t2x = Ox + F2 * d2x * sF, t2y = Oy + F2 * d2y * sF;
    var rxv = F1 * d1x + F2 * d2x, ryv = F1 * d1y + F2 * d2y;
    var rlen = Math.sqrt(rxv * rxv + ryv * ryv), rxm = Math.sqrt(F1 * F1 + F2 * F2 + 2 * F1 * F2 * Math.cos(rad));
    var sc = rlen > 1e-6 ? (rxm * sF) / rlen : sF;
    var sxc = Ox + rxv * sc, syc = Oy + ryv * sc;    /* 平行四边形对角顶点 = 理论合力 F 的末端 */

    caption(vg, '探究两个互成角度的力的合成规律', [
      'F₁ = ' + fmt(F1, 2) + ' N    F₂ = ' + fmt(F2, 2) + ' N    θ = ' + fmt(th, 1) + '°',
      '理论合力 F = √(F₁²+F₂²+2F₁F₂cosθ) = ' + fmt(rxm, 3) + ' N（与 F₁ 夹角 ' + fmt(Math.atan2(F2 * Math.sin(rad), F1 + F2 * Math.cos(rad)) * 180 / Math.PI, 1) + '°）',
      '实测合力 F′ = ' + fmt(num(cur.Fexp, rxm), 3) + ' N（一只测力计把结点拉到同一位置 O，沿 AO 方向）  偏差 ' + fmt(num(cur.dev, 0), 2) + '%'
    ]);

    RC(vg, 34, 34, 492, 268, 'rgba(38,34,28,0.07)', INK, 1.4);      /* 方木板 */
    RC(vg, 50, 48, 460, 240, 'rgba(255,255,255,0.72)', 'rgba(38,34,28,0.35)', 1);
    CI(vg, 56, 54, 3, 'rgba(38,34,28,0.5)', null, 0);               /* 图钉 */
    CI(vg, 504, 54, 3, 'rgba(38,34,28,0.5)', null, 0);
    CI(vg, 56, 282, 3, 'rgba(38,34,28,0.5)', null, 0);
    CI(vg, 504, 282, 3, 'rgba(38,34,28,0.5)', null, 0);

    var Ax = 96, Ay = Oy;                                            /* 固定橡皮条的图钉 A */
    CI(vg, Ax, Ay, 4, 'rgba(38,34,28,0.35)', INK, 1.1);
    T(vg, 'A', Ax - 14, Ay, 12, 'center');
    L(vg, Ax + 4, Ay - 3, Ox, Oy - 3, 2.6, 'rgba(38,34,28,0.32)');   /* 橡皮条 */
    L(vg, Ax + 4, Ay + 3, Ox, Oy + 3, 2.6, 'rgba(38,34,28,0.32)');
    T(vg, '橡皮条', (Ax + Ox) / 2, Ay - 14, 9.5, 'center', 'rgba(38,34,28,0.7)');

    L(vg, Ox, Oy, t1x, t1y, 1, 'rgba(38,34,28,0.55)');               /* 两条细绳 */
    L(vg, Ox, Oy, t2x, t2y, 1, 'rgba(38,34,28,0.55)');
    AR(vg, Ox, Oy, t1x, t1y, 1.8, INK);                              /* 分力 F₁ */
    AR(vg, Ox, Oy, t2x, t2y, 1.8, INK);                              /* 分力 F₂ */
    RC(vg, t1x - 7, t1y - 5, 22, 10, 'rgba(255,255,255,0.85)', INK, 1);
    RC(vg, t2x - 7, t2y - 5, 22, 10, 'rgba(255,255,255,0.85)', INK, 1);
    T(vg, 'F₁', t1x + 12, t1y - 12, 12, 'center');
    T(vg, 'F₂', t2x + 12, t2y - 12, 12, 'center');
    L(vg, t1x, t1y, sxc, syc, 1, 'rgba(38,34,28,0.5)', [5, 4]);      /* 平行四边形的辅助线 */
    L(vg, t2x, t2y, sxc, syc, 1, 'rgba(38,34,28,0.5)', [5, 4]);
    AR(vg, Ox, Oy, sxc, syc, 2.6, INK);                              /* 理论合力 F（对角线） */
    T(vg, 'F（理论）', sxc + 10, syc + 12, 12, 'center');
    AR(vg, Ox, Oy, Ox - rxm * sF, Oy, 2.2, 'rgba(38,34,28,0.62)');   /* 实测合力 F′：沿 AO 方向 */
    T(vg, 'F′（实测）', Ox - rxm * sF - 34, Oy - 13, 12, 'center', 'rgba(38,34,28,0.75)');

    var ar = 52;
    L(vg, Ox + ar, Oy, Ox + ar * Math.cos(-half), Oy + ar * Math.sin(-half), 0.9, 'rgba(38,34,28,0.55)', [4, 3]);
    L(vg, Ox + ar, Oy, Ox + ar * Math.cos(half), Oy + ar * Math.sin(half), 0.9, 'rgba(38,34,28,0.55)', [4, 3]);
    T(vg, 'θ=' + fmt(th, 0) + '°', Ox + ar + 6, Oy + 12, 11, 'left', 'rgba(38,34,28,0.8)');
    CI(vg, Ox, Oy, 3, INK, null, 0);
    T(vg, 'O', Ox + 8, Oy + 14, 12, 'left');
    T(vg, '作图标度：1 N = ' + fmt(sF, 0) + ' px', 50, 296, 10, 'left', 'rgba(38,34,28,0.7)');
  }

  /* ======================================================================
   * 实验 4 · hooke-law：探究弹簧弹力与形变量的关系
   * 模型：胡克定律 F = kx（弹性限度内）；竖直悬挂时静止的弹簧弹力等于钩码重力 F = nmg
   *   形变量 x = L − L₀（L₀ 为不挂钩码时弹簧下端在刻度尺上的读数）
   *   弹簧自重使下端预先伸长 x_g = m_s g/(2k)：以"总长 L"为横轴时图线不过原点，
   *   纵轴截距约为 m_s g/2；以形变量 x 为横轴则可消除这一影响
   * 误差：毫米刻度尺估读、弹簧自重、钩码质量标称偏差、超过弹性限度、弹簧晃动未静止
   * ==================================================================== */
  var HKv = { k: [10, 80, 25], mg: [20, 100, 50], ms: [10, 40, 20] };
  var HK_NAT = 12.0;     /* 弹簧自然长度 (cm)，仅用于演示"以总长为横轴"的情形 */
  var HK_K = 6;          /* 数据系列 = 依次挂 1…6 个钩码 */

  function hkModel(p, i) {
    var id = 'hooke-law';
    var k = clamp(num(p && p.k, HKv.k[2]), HKv.k[0], HKv.k[1]);
    var mg = clamp(num(p && p.mg, HKv.mg[2]), HKv.mg[0], HKv.mg[1]);
    var ms = clamp(num(p && p.ms, HKv.ms[2]), HKv.ms[0], HKv.ms[1]);
    var n = (i % HK_K) + 1;
    var F = n * mg / 1000 * G_STD;
    var xg = (ms / 1000) * G_STD / 2 / k * 100;              /* 自重造成的等效伸长 (cm) */
    var L0 = round(HK_NAT + xg + nz(id, 0, 0, 0.012), 2);    /* 毫米刻度尺读数：0.01 cm 一位估读 */
    var Lread = round(L0 + F / k * 100 + nz(id, 0, n, 0.012), 2);
    var x = round(Lread - L0, 2);
    return {
      n: n, m: round(n * mg, 0), F: round(F, 3), L: Lread,
      x: x, xn: round(Lread - HK_NAT, 2), xm: round(x / 100, 4),
      L0: L0, Fself: round((ms / 1000) * G_STD / 2, 4)
    };
  }

  function hkConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(hkModel, p, HK_K);
    var fit = fitLine(ptsOf(list, 'x', 'F'));
    var kFit = (fit && isFinite(fit.a)) ? fit.a * 100 : 0;    /* N/cm → N/m */
    var kSet = clamp(num(p && p.k, HKv.k[2]), HKv.k[0], HKv.k[1]);
    var dev = kSet > 0 ? Math.abs(kFit - kSet) / kSet * 100 : 0;
    return {
      value: round(kFit, 2), unit: 'N/m',
      text: '挂 ' + list.length + ' 组钩码得到 F–x 数据：图线是一条过原点的直线（r² = ' +
        fmt(fit ? fit.r2 : 1, 4) + '，纵轴截距 ' + fmt(fit ? fit.b : 0, 4) +
        ' N），斜率 k′ = ' + fmt(fit ? fit.a : 0, 4) + ' N/cm，即弹簧的劲度系数 k = ' + fmt(kFit, 2) +
        ' N/m，与标称值 ' + fmt(kSet, 0) + ' N/m 相差 ' + fmt(dev, 1) +
        '%。在弹性限度内弹簧的弹力与形变量成正比（胡克定律 F = kx）。',
      errors: [
        '毫米刻度尺读数要估读到 0.1 mm，弹簧下端位置的读数误差直接进入形变量 x',
        '弹簧自重使弹簧预先伸长（相当于在下端挂 m_s g/2）：以总长为横轴时图线不过原点',
        '钩码质量的标称值与实际值有偏差，使各点纵坐标整体偏移（本模型取单个钩码 ' + fmt(clamp(num(p && p.mg, HKv.mg[2]), HKv.mg[0], HKv.mg[1]), 0) + ' g）',
        '所挂钩码过多超过弹性限度后，F–x 图线会弯曲，不再满足胡克定律'
      ]
    };
  }

  function hkDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var cur = rows.length ? rows[rows.length - 1] : hkModel(p, 0);
    var k = clamp(num(p.k, HKv.k[2]), HKv.k[0], HKv.k[1]);
    var ms = clamp(num(p.ms, HKv.ms[2]), HKv.ms[0], HKv.ms[1]);
    var n = Math.round(num(cur.n, 1));
    var Lread = num(cur.L, 20);                              /* 弹簧下端刻度读数（别用 L：那是画线原语） */
    var Ltop = 74, Lpx = clamp(Lread * 9.2, 40, 168);        /* 弹簧现长按比例画 */
    var sx = 300;
    caption(vg, '探究弹簧弹力与形变量的关系', [
      'k = ' + fmt(k, 0) + ' N/m    弹簧质量 m_s = ' + fmt(ms, 0) + ' g（自重等效 ' + fmt(ms / 1000 * G_STD / 2, 3) + ' N）',
      '挂 ' + n + ' 个钩码：F = nmg = ' + fmt(num(cur.F, 0), 2) + ' N    L = ' + fmt(Lread, 2) + ' cm    x = L − L₀ = ' + fmt(num(cur.x, 0), 2) + ' cm',
      'F–x 图线应为过原点的直线，斜率即劲度系数 k'
    ]);

    /* 铁架台：底座 + 立杆 + 横杆 */
    RC(vg, 96, 292, 190, 12, 'rgba(38,34,28,0.16)', INK, 1.3);
    RC(vg, 130, 60, 12, 232, 'rgba(38,34,28,0.14)', INK, 1.3);
    RC(vg, 130, 60, 190, 11, 'rgba(38,34,28,0.14)', INK, 1.3);
    T(vg, '铁架台', 190, 310, 10, 'center', 'rgba(38,34,28,0.7)');
    RC(vg, 258, 56, 34, 10, 'rgba(38,34,28,0.2)', INK, 1.1);      /* 横梁上的夹子 */

    /* 弹簧 + 钩码 */
    springZig(vg, sx, Ltop, Ltop + Lpx, Math.max(6, Math.round(Lpx / 9)), 9, INK, 1.5);
    L(vg, sx, Ltop + Lpx, sx, Ltop + Lpx + 12, 1.4, INK);
    var i, yy = Ltop + Lpx + 12;
    for (i = 0; i < n; i++) {
      RC(vg, sx - 13, yy, 26, 8, 'rgba(38,34,28,0.2)', INK, 1.1);
      yy += 9;
    }
    T(vg, n + ' 个钩码', sx + 24, Ltop + Lpx + 20, 10, 'left', 'rgba(38,34,28,0.8)');

    /* 竖直刻度尺（毫米刻度）+ 已测下端点 */
    rulerV(vg, 404, 60, 292, 26);
    T(vg, 'cm', 404, 48, 10, 'center', 'rgba(38,34,28,0.7)');
    for (i = 0; i < rows.length; i++) {
      yy = 60 + (num(rows[i].L, 0) - 2) * ((292 - 60) / 26);
      if (yy < 60 || yy > 292) { continue; }
      L(vg, 392, yy, 414, yy, 1, 'rgba(38,34,28,0.55)');
      CI(vg, 418, yy, 2.6, INK, null, 0);
      if (i === rows.length - 1) { T(vg, 'L = ' + fmt(num(rows[i].L, 0), 2), 424, yy, 10, 'left'); }
    }
    L(vg, sx + 14, Ltop + Lpx, 404, Ltop + Lpx, 0.9, 'rgba(38,34,28,0.5)', [4, 3]);
    T(vg, '读数 ' + fmt(Lread, 2) + ' cm', sx + 40, Ltop + Lpx - 10, 10, 'left', 'rgba(38,34,28,0.75)');

    insetPlot(vg, 60, 60, 150, 118, ptsOf(rows, 'x', 'F'), 0, 0, 'x / cm', 'F / N');
    T(vg, 'F–x 图线（斜率 = k）', 60, 190, 10, 'left', 'rgba(38,34,28,0.75)');
    T(vg, '自重：以总长为横轴时截距 ≈ ' + fmt(num(cur.Fself, 0), 3) + ' N', 60, 205, 9.5, 'left', 'rgba(38,34,28,0.62)');
  }

  CORE.register('linear-motion', {
    id: 'linear-motion',
    name: '探究小车速度随时间变化的规律',
    group: '力学',
    aim: '用打点计时器打出的纸带记录小车的运动，求出各计数点的瞬时速度并作 v–t 图像，探究小车速度随时间变化的规律。',
    principle: '打点计时器接 50 Hz 交流电源（电磁式 4~6 V，电火花式 220 V），每隔 0.02 s 打一个点。小车在恒定牵引力（钩码重力）作用下做匀变速直线运动，速度 v = v₀ + at。用毫米刻度尺量出各计数点到起点的距离，第 n 个计数点的瞬时速度由相邻两点间的平均速度求得：vₙ = (xₙ₊₁ − xₙ₋₁)/(2T)（T 为相邻计数点的时间间隔，每 5 个计时间隔取一个计数点则 T = 0.10 s）。以 t 为横轴、v 为纵轴作图：若图线是一条倾斜的直线，说明小车做匀变速直线运动，直线的斜率等于加速度 a；加速度也可用逐差法求得 a = [(x₄+x₅+x₆) − (x₁+x₂+x₃)]/(9T²)（x₁…x₆ 为相邻计数点间的距离）。',
    apparatus: ['电磁打点计时器（4~6 V 交流电源，50 Hz）或电火花计时器（220 V 交流）', '纸带', '复写纸片',
      '一端附有定滑轮的长木板', '小车', '细绳', '钩码（槽码）', '毫米刻度尺', '低压交流电源', '导线'],
    steps: [
      '把一端附有定滑轮的长木板平放在实验桌上，使滑轮伸出桌面；把打点计时器固定在长木板没有滑轮的一端，连接好电路。',
      '把一条细绳拴在小车上，细绳跨过定滑轮，下面挂上合适的钩码。',
      '把纸带穿过打点计时器的限位孔，并把纸带的一端固定在小车的后面。',
      '把小车停在靠近打点计时器处，先接通电源，后释放小车，让小车拖着纸带运动。',
      '小车到达滑轮前及时用手按住，取下纸带；换上新纸带，重复三次，选一条点迹清晰的纸带。',
      '舍去开头密集的点，从便于测量的点开始，每 5 个计时间隔取一个计数点（T = 0.10 s），依次标上 0、1、2、…，用毫米刻度尺量出各计数点到起点 0 的距离（读数估读到 0.1 mm），并算出相邻计数点间的距离。',
      '用 vₙ = (xₙ₊₁ − xₙ₋₁)/(2T) 求出各计数点的瞬时速度并填入表格；作 v–t 图像，由图线的斜率求加速度；也可用逐差法直接求出加速度 a。'
    ],
    params: [
      P('M', '小车质量 M', 'kg', LMv.M[0], LMv.M[1], 0.05, LMv.M[2]),
      P('F', '牵引力 F（钩码重力）', 'N', LMv.F[0], LMv.F[1], 0.01, LMv.F[2]),
      P('f', '阻力 f（未完全补偿）', 'N', LMv.f[0], LMv.f[1], 0.005, LMv.f[2]),
      P('v0', '初速度 v₀', 'm/s', LMv.v0[0], LMv.v0[1], 0.01, LMv.v0[2])
    ],
    measure: function (p) { return lmModel(p, seqOf('linear-motion', LM_K)); },
    columns: [
      COL('n', '计数点序号', ''), COL('t', '时间 t', 's'), COL('x', '到起点距离 x', 'cm'),
      COL('dx', '与上一点间距', 'cm'), COL('v', '瞬时速度 v', 'm/s'), COL('a', '逐差法 a', 'm/s²')
    ],
    graph: { x: 't', y: 'v', fit: 'linear', title: 'v–t 图线', note: '斜率等于加速度 a；图线为倾斜直线说明小车做匀变速直线运动' },
    conclude: function (rows, p) { return lmConclude(rows, p); },
    draw: safeDraw('linear-motion', lmDraw),
    step: safeStep('linear-motion', function (p, state, dt) { state.t = num(state.t, 0) + dt; })
  });

  CORE.register('newton-second', {
    id: 'newton-second',
    name: '探究加速度与力、质量的关系',
    group: '力学',
    aim: '用控制变量法探究加速度 a 与力 F、质量 M 的定量关系（F 一定时 a 与 M 成反比，M 一定时 a 与 F 成正比）。',
    principle: '控制变量法：先保持小车质量 M 不变，改变砂和砂桶的总质量 m 以改变拉力，测出相应的加速度 a，作 a–F 图像；再保持拉力不变，在小车上加砝码改变 M，测出 a，作 a–1/M 图像。实验前要补偿阻力：把长木板不带滑轮的一端垫高，不挂砂桶时轻推小车，若纸带上打出的点距均匀，说明小车做匀速运动，重力沿木板的分力已平衡摩擦力。对小车与砂桶组成的系统，由牛顿第二定律 mg − f = (M + m)a，即 a = (mg − f)/(M + m)；细线实际张力 T = Ma + f，只有 m ≪ M 时才有 T ≈ mg、a ≈ (mg − f)/M，a 与 F = mg 成正比，a–F 图线才是过原点的直线；若 m 不满足远小于 M，则 F 较大时图线会向下弯曲。加速度由纸带用逐差法求出。',
    apparatus: ['一端附有定滑轮的长木板', '小车', '打点计时器（4~6 V 交流电源，50 Hz）', '纸带', '复写纸片',
      '低压交流电源、导线', '砂和砂桶（或砝码盘和砝码）', '天平', '毫米刻度尺', '垫木（垫块）'],
    steps: [
      '用天平测出小车的质量 M，并记录车上所加砝码的质量。',
      '按图安装器材：把打点计时器固定在长木板不带滑轮的一端，纸带穿过限位孔与小车相连，细绳跨过定滑轮与砂桶相连。',
      '补偿阻力：不挂砂桶，把长木板不带滑轮的一端用垫木垫高，轻推小车，若纸带上打出的点距均匀（小车做匀速运动），说明阻力已补偿好。',
      '保持小车质量 M 不变，逐次改变砂桶中砂的质量，每次先接通电源再释放小车，打出纸带并记录砂和砂桶的总质量 m。',
      '用毫米刻度尺处理纸带，选取点迹清晰的部分，用逐差法求出每次的加速度 a，把 F = mg 与 a 填入表格，作 a–F 图像。',
      '保持砂和砂桶的总质量不变，在小车上加砝码以改变小车总质量 M，重复上述测量，作 a–1/M 图像（或比较 a 与 M 的乘积）。',
      '分析图线：M 一定时 a–F 图线为过原点的直线，说明 a ∝ F；F 一定时 a 与 M 成反比，得出牛顿第二定律 a = F/M。'
    ],
    params: [
      P('M', '小车总质量 M', 'kg', NSv.M[0], NSv.M[1], 0.05, NSv.M[2]),
      P('m', '砂和砂桶总质量 m（应远小于 M）', 'kg', NSv.m[0], NSv.m[1], 0.005, NSv.m[2]),
      P('f', '未补偿的阻力 f', 'N', NSv.f[0], NSv.f[1], 0.01, NSv.f[2])
    ],
    measure: function (p) { return nsModel(p, seqOf('newton-second', NS_K)); },
    columns: [
      COL('M', '小车质量 M', 'kg'), COL('m', '砂桶质量 m', 'kg'), COL('F', 'F = mg', 'N'),
      COL('T', '细线张力 T', 'N'), COL('a', '加速度 a', 'm/s²'), COL('invM', '1/M', 'kg⁻¹')
    ],
    graph: { x: 'F', y: 'a', fit: 'linear', title: 'a–F 图线（M 不变）', note: '斜率 = 1/M；m ≪ M 时图线过原点，否则 F 大的一端向下弯曲' },
    conclude: function (rows, p) { return nsConclude(rows, p); },
    draw: safeDraw('newton-second', nsDraw),
    step: safeStep('newton-second', function (p, state, dt) { state.t = num(state.t, 0) + dt; })
  });

  CORE.register('force-composition', {
    id: 'force-composition',
    name: '探究两个互成角度的力的合成规律',
    group: '力学',
    aim: '探究两个互成角度的力合成时遵循的规律，验证力的平行四边形定则。',
    principle: '两个力 F₁、F₂ 共同作用的效果，与一个力 F 单独作用的效果相同时（把橡皮条的结点拉到同一位置 O、伸长量相同），F 就是 F₁、F₂ 的合力，这种方法叫等效替代法。以表示 F₁、F₂ 的有向线段为邻边作平行四边形，两邻边所夹的对角线就表示合力 F 的大小和方向：F = √(F₁² + F₂² + 2F₁F₂cosθ)（θ 为两分力的夹角），合力与 F₁ 的夹角 φ = arctan[F₂sinθ/(F₁ + F₂cosθ)]。把作图得到的 F 与只用一只弹簧测力计实测的 F′ 比较：F 是理论值（平行四边形的对角线），F′ 是实验值，它一定沿 AO 方向；若两者在误差允许范围内大小相等、方向相同，就说明力的合成遵循平行四边形定则。',
    apparatus: ['方木板', '白纸', '图钉（若干）', '橡皮条', '细绳（两个绳套）', '两个弹簧测力计',
      '毫米刻度尺', '三角板', '铅笔'],
    steps: [
      '在桌上放一块方木板，在方木板上铺一张白纸，用图钉把白纸钉在方木板上。',
      '用图钉把橡皮条的一端固定在板上的 A 点，在橡皮条的另一端拴上两条细绳，细绳的另一端系着绳套。',
      '用两个弹簧测力计分别钩住绳套，互成角度地拉橡皮条，使橡皮条伸长，结点到达某一位置 O；记录下 O 点的位置，读出两个弹簧测力计的示数，并记下两条细绳的方向。',
      '按选好的标度，用铅笔和刻度尺作出两只弹簧测力计的拉力 F₁、F₂ 的图示，并以表示 F₁、F₂ 的有向线段为邻边作平行四边形，画出两有向线段所夹的对角线，在末端标上箭头表示 F。',
      '只用一只弹簧测力计，通过细绳套把橡皮条的结点拉到同样的位置 O，读出弹簧测力计的示数，记下细绳的方向，按同一标度作出这个力 F′ 的图示。',
      '比较 F′ 与 F 的大小和方向，看它们是否相同，得出结论。（注意：F 是作图得到的理论值，F′ 一定沿 AO 方向。）'
    ],
    params: [
      P('F1', '分力 F₁', 'N', FCv.F1[0], FCv.F1[1], 0.1, FCv.F1[2]),
      P('F2', '分力 F₂', 'N', FCv.F2[0], FCv.F2[1], 0.1, FCv.F2[2]),
      P('th', '两分力夹角 θ', '°', FCv.th[0], FCv.th[1], 5, FCv.th[2]),
      P('err', '读数与作图误差', '%', FCv.err[0], FCv.err[1], 0.1, FCv.err[2])
    ],
    measure: function (p) { return fcModel(p, seqOf('force-composition', FC_K)); },
    columns: [
      COL('F1', '分力 F₁', 'N'), COL('F2', '分力 F₂', 'N'), COL('th', '夹角 θ', '°'),
      COL('F', '理论合力 F', 'N'), COL('phi', 'F 与 F₁ 夹角', '°'), COL('Fexp', '实测合力 F′', 'N'),
      COL('dev', '相对偏差', '%')
    ],
    graph: { x: 'F', y: 'Fexp', fit: 'linear', title: 'F′–F 图线', note: '理论合力 F 为横轴、实测合力 F′ 为纵轴：应过原点、斜率≈1' },
    conclude: function (rows, p) { return fcConclude(rows, p); },
    draw: safeDraw('force-composition', fcDraw)
  });

  CORE.register('hooke-law', {
    id: 'hooke-law',
    name: '探究弹簧弹力与形变量的关系',
    group: '力学',
    aim: '探究弹簧的弹力与形变量的关系，并由 F–x 图线的斜率求出弹簧的劲度系数 k。',
    principle: '在弹性限度内，弹簧的弹力 F 与弹簧的形变量（伸长量）x 成正比：F = kx（胡克定律），比例系数 k 叫弹簧的劲度系数，单位是 N/m。把弹簧竖直悬挂，静止时弹簧的弹力等于所挂钩码的重力 F = nmg（n 为钩码个数）。用毫米刻度尺量出弹簧下端的位置 L，形变量 x = L − L₀（L₀ 为不挂钩码时弹簧下端在刻度尺上的位置）。以形变量 x 为横轴、弹力 F 为纵轴作图，图线是一条过原点的直线，斜率就是劲度系数 k = F/x（注意：若横轴取弹簧的总长 L，图线不过原点，纵轴截距来自弹簧自重——均匀弹簧自重相当于在下端挂 m_s g/2 的重物，使弹簧预先伸长了 m_s g/(2k)）。',
    apparatus: ['弹簧（劲度系数未知）', '铁架台（带横杆和铁夹）', '毫米刻度尺', '已知质量的钩码若干',
      '坐标纸', '铅笔', '天平（需要时测弹簧、钩码质量）'],
    steps: [
      '将铁架台固定于桌子上，把弹簧的一端系于横梁上，在弹簧附近竖直固定一把刻度尺。',
      '记下弹簧不挂钩码时其下端在刻度尺上的刻度 L₀（读数估读到 0.1 mm）。',
      '依次在弹簧下端挂上 1 个、2 个、3 个、4 个……钩码，并分别记下钩码静止时弹簧下端所对应的刻度 L，然后取下钩码。',
      '由 x = L − L₀ 计算弹簧的形变量，由 F = nmg 计算弹力，把数据填入表格（注意不要超过弹簧的弹性限度）。',
      '以弹簧的形变量 x 为横坐标、弹力 F 为纵坐标描点，并用平滑的曲线（直线）连接起来。',
      '以形变量为自变量写出弹力与形变量的关系式：先尝试写成一次函数，如果不行，再考虑二次函数。',
      '解释函数表达式中常数的物理意义（斜率即劲度系数 k），整理仪器。'
    ],
    params: [
      P('k', '弹簧劲度系数 k', 'N/m', HKv.k[0], HKv.k[1], 1, HKv.k[2]),
      P('mg', '单个钩码质量 m', 'g', HKv.mg[0], HKv.mg[1], 5, HKv.mg[2]),
      P('ms', '弹簧质量 m_s', 'g', HKv.ms[0], HKv.ms[1], 1, HKv.ms[2])
    ],
    measure: function (p) { return hkModel(p, seqOf('hooke-law', HK_K)); },
    columns: [
      COL('n', '钩码个数', ''), COL('m', '钩码总质量', 'g'), COL('F', '弹力 F = nmg', 'N'),
      COL('L', '弹簧下端刻度 L', 'cm'), COL('x', '形变量 x = L − L₀', 'cm'),
      COL('xn', '总伸长 L − L自然', 'cm'), COL('xm', '形变量 x', 'm')
    ],
    graph: { x: 'x', y: 'F', fit: 'linear', title: 'F–x 图线', note: '斜率 = k/100（N/cm），劲度系数 k = 100×斜率' },
    conclude: function (rows, p) { return hkConclude(rows, p); },
    draw: safeDraw('hooke-law', hkDraw)
  });


  /* ======================================================================
   * 实验 5 · projectile：探究平抛运动的特点
   * 模型：小球从斜槽滚下（实心球滚动：mgh = ½mv²(1 + 2/5) + ηmgh）
   *   → v₀ = √(2gH(1−η)/1.4)；斜槽末端不水平时抛出速度与水平成 β 角
   *   平抛：x = v₀cosβ·t，y = v₀sinβ·t + ½gt²（坐标原点取斜槽末端球心的水平投影点，
   *   y 轴沿重垂线方向）；轨迹上任一点满足 v₀ = (x/10)√(g/2y)（x、y 以 cm 计），
   *   而 y = [g/(200v₀²)]x² 说明 y–x² 图线是过原点的直线，斜率 = g/(200v₀²)
   * 误差：斜槽末端未严格水平（β≠0 的系统偏差）、坐标纸描点与读数误差、空气阻力、
   *       小球每次释放位置不同、坐标原点未取在球心投影处
   * ==================================================================== */
  var PJv = { H: [0.05, 0.40, 0.20], f: [5, 25, 10], be: [0.0, 3.0, 0.5], eta: [0.0, 0.30, 0.08] };
  var PJ_K = 6;

  function pjModel(p, i) {
    var id = 'projectile';
    var H = clamp(num(p && p.H, PJv.H[2]), PJv.H[0], PJv.H[1]);
    var f = clamp(num(p && p.f, PJv.f[2]), PJv.f[0], PJv.f[1]);
    var be = clamp(num(p && p.be, PJv.be[2]), PJv.be[0], PJv.be[1]);
    var eta = clamp(num(p && p.eta, PJv.eta[2]), PJv.eta[0], PJv.eta[1]);
    var v0 = Math.sqrt(2 * G_STD * H * (1 - eta) / 1.4);      /* 实心球沿斜槽滚下 */
    var brad = be * Math.PI / 180;
    var vx0 = v0 * Math.cos(brad), vy0 = v0 * Math.sin(brad);
    var k = (i % PJ_K) + 1;
    var t = k / f;                                            /* 频闪/描点的时间间隔 1/f */
    var x = vx0 * t * 100 + nz(id, k, 1, 0.05);               /* cm */
    var y = (vy0 * t + 0.5 * G_STD * t * t) * 100 + nz(id, k, 2, 0.05);
    if (y < 0.05) { y = 0.05; }
    var xr = round(x, 2), yr = round(y, 2);
    var v0k = (xr / 10) * Math.sqrt(G_STD / (2 * yr));         /* 由单点 x√(g/2y) 求 v₀ */
    return {
      k: k, t: round(t, 3), x: xr, x2: round(xr * xr, 3), y: yr,
      vx: round(vx0, 3), vy: round(vy0 + G_STD * t, 3),
      v0: round(v0, 3), v0k: round(v0k, 3), be: round(be, 2), f: round(f, 1)
    };
  }

  function pjConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(pjModel, p, PJ_K);
    var fit = fitLine(ptsOf(list, 'x2', 'y'));
    var v0fit = (fit && fit.a > 1e-9) ? Math.sqrt(G_STD / (200 * fit.a)) : 0;
    var v0pt = meanOf(list, 'v0k');
    var H = clamp(num(p && p.H, PJv.H[2]), PJv.H[0], PJv.H[1]);
    var eta = clamp(num(p && p.eta, PJv.eta[2]), PJv.eta[0], PJv.eta[1]);
    var be = clamp(num(p && p.be, PJv.be[2]), PJv.be[0], PJv.be[1]);
    var v0th = Math.sqrt(2 * G_STD * H * (1 - eta) / 1.4);
    return {
      value: round(v0fit, 3), unit: 'm/s',
      text: '在轨迹上取 ' + list.length + ' 个点：y–x² 图线是一条过原点的直线（r² = ' +
        fmt(fit ? fit.r2 : 1, 4) + '，斜率 k = ' + fmt(fit ? fit.a : 0, 4) +
        ' cm⁻¹），说明平抛运动的竖直分运动是自由落体运动、水平分运动是匀速直线运动；' +
        '由斜率求得初速度 v₀ = √(g/200k) = ' + fmt(v0fit, 3) + ' m/s，用各点 v₀ = (x/10)√(g/2y) ' +
        '求得的平均值是 ' + fmt(v0pt, 3) + ' m/s，与由释放高度算出的 ' + fmt(v0th, 3) +
        ' m/s 相比偏差 ' + fmt(v0th > 0 ? Math.abs(v0fit - v0th) / v0th * 100 : 0, 1) + '%。',
      errors: [
        '斜槽末端没有严格调成水平（β = ' + fmt(be, 2) + '°）：抛出速度有竖直分量，使单点法求出的 v₀ 有系统偏差',
        '坐标纸描点位置与实际球心不重合、读数误差（本模型取 σ ≈ 0.5 mm）',
        '小球每次从斜槽上同一位置释放，但受摩擦与转动影响，离开末端的速度并不完全相同',
        '小球受空气阻力，竖直方向不是严格的自由落体；坐标原点未取在球心的水平投影点会使 y 整体偏移'
      ]
    };
  }

  function pjDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var cur = rows.length ? rows[rows.length - 1] : pjModel(p, 0);
    var H = clamp(num(p.H, PJv.H[2]), PJv.H[0], PJv.H[1]);
    var f = clamp(num(p.f, PJv.f[2]), PJv.f[0], PJv.f[1]);
    var eta = clamp(num(p.eta, PJv.eta[2]), PJv.eta[0], PJv.eta[1]);
    var v0 = num(cur.v0, Math.sqrt(2 * G_STD * H * (1 - eta) / 1.4));
    var be = num(cur.be, 0), brad = be * Math.PI / 180;
    var vx0 = v0 * Math.cos(brad), vy0 = v0 * Math.sin(brad);
    /* 坐标比例要同时容纳"整条轨迹（第 1…K 点）"与"已测的描迹点"，否则数据点会画到纸外 */
    var K = PJ_K, i, rk;
    for (i = 0; i < rows.length; i++) {
      rk = Math.round(num(rows[i].k, 0));
      if (rk > K) { K = rk; }
    }
    var tmax = K / f;
    var xEnd = vx0 * tmax * 100, yEnd = (vy0 * tmax + 0.5 * G_STD * tmax * tmax) * 100;
    for (i = 0; i < rows.length; i++) {
      xEnd = Math.max(xEnd, num(rows[i].x, 0));
      yEnd = Math.max(yEnd, num(rows[i].y, 0));
    }
    var Ox = 116, Oy = 74, PW = 288, PH = 214;
    var sc = Math.min(PW / Math.max(xEnd, 1), PH / Math.max(yEnd, 1));
    var MX = function (xc) { return Ox + xc * sc; };
    var MY = function (yc) { return Oy + yc * sc; };

    caption(vg, '探究平抛运动的特点（斜槽 + 白纸描迹）', [
      '释放高度 H = ' + fmt(H, 2) + ' m → v₀ = √(2gH(1−η)/1.4) = ' + fmt(v0, 3) + ' m/s（η = ' + fmt(eta, 2) + '）',
      '频闪/描点间隔 1/f = ' + fmt(1 / f, 3) + ' s    x = v₀t、y = ½gt²    末端倾角 β = ' + fmt(be, 2) + '°',
      '第 ' + K + ' 点：x = ' + fmt(num(cur.x, 0), 2) + ' cm，y = ' + fmt(num(cur.y, 0), 2) + ' cm，单点法 v₀ = ' + fmt(num(cur.v0k, v0), 3) + ' m/s'
    ]);

    RC(vg, 60, 34, 372, 268, 'rgba(38,34,28,0.07)', INK, 1.4);      /* 木板 */
    RC(vg, Ox - 16, Oy - 16, PW + 30, PH + 30, 'rgba(255,255,255,0.72)', 'rgba(38,34,28,0.35)', 1);  /* 白纸/坐标纸 */
    var gx, gy;
    for (gx = Ox; gx <= Ox + PW + 6; gx += 24) { L(vg, gx, Oy - 12, gx, Oy + PH + 10, 0.4, 'rgba(38,34,28,0.13)'); }
    for (gy = Oy; gy <= Oy + PH + 6; gy += 24) { L(vg, Ox - 12, gy, Ox + PW + 12, gy, 0.4, 'rgba(38,34,28,0.13)'); }

    /* 斜槽（末端水平）与支架 */
    var c = vg.c;
    c.save();
    c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(74, 22); c.quadraticCurveTo(88, 58, Ox - 6, Oy - 4); c.stroke();
    c.restore();
    T(vg, '斜槽（末端调成水平）', 70, 16, 10, 'left', 'rgba(38,34,28,0.8)');
    L(vg, 96, 60, 96, 96, 1.2, INK);
    RC(vg, 78, 96, 40, 76, 'rgba(38,34,28,0.10)', INK, 1.2);
    T(vg, '支架', 98, 180, 9.5, 'center', 'rgba(38,34,28,0.7)');

    /* 坐标轴：y 轴沿重垂线方向 */
    AR(vg, Ox, Oy, Ox + PW + 16, Oy, 1.3, 'rgba(38,34,28,0.75)');
    AR(vg, Ox, Oy, Ox, Oy + PH + 14, 1.3, 'rgba(38,34,28,0.75)');
    T(vg, 'x（水平）', Ox + PW + 18, Oy - 10, 10.5, 'right', 'rgba(38,34,28,0.8)');
    T(vg, 'y（沿重垂线）', Ox + 6, Oy + PH + 22, 10.5, 'left', 'rgba(38,34,28,0.8)');
    L(vg, Ox, 20, Ox, Oy + PH + 10, 0.9, 'rgba(38,34,28,0.45)', [5, 4]);
    CI(vg, Ox, Oy, 3, INK, null, 0);
    T(vg, 'O（球心水平投影点）', Ox + 8, Oy + 13, 9.5, 'left', 'rgba(38,34,28,0.7)');

    /* 轨迹（模型曲线） + 已测描迹点 */
    var i, t, xc, yc, px, py;
    c.save();
    c.strokeStyle = 'rgba(38,34,28,0.55)'; c.lineWidth = 1.2;
    if (c.setLineDash) { c.setLineDash([5, 4]); }
    c.beginPath();
    for (i = 0; i <= 64; i++) {
      t = tmax * i / 64;
      xc = vx0 * t * 100; yc = (vy0 * t + 0.5 * G_STD * t * t) * 100;
      px = MX(xc); py = MY(yc);
      if (i === 0) { c.moveTo(px, py); } else { c.lineTo(px, py); }
    }
    c.stroke();
    c.restore();
    for (i = 0; i < rows.length; i++) {
      px = MX(num(rows[i].x, 0)); py = MY(num(rows[i].y, 0));
      CI(vg, px, py, 3, INK, null, 0);
      T(vg, String(num(rows[i].k, i + 1)), px + 7, py - 6, 9, 'left', 'rgba(38,34,28,0.7)');
    }
    var ph = (num(state.t, 0) % 1.6) / 1.6;
    var tb = tmax * ph;
    var xb = vx0 * tb * 100, yb = (vy0 * tb + 0.5 * G_STD * tb * tb) * 100;
    CI(vg, MX(xb), MY(yb), 5.5, 'rgba(38,34,28,0.25)', INK, 1.2);
    L(vg, MX(xb), MY(yb), MX(xb), Oy + PH + 4, 0.6, 'rgba(38,34,28,0.35)');
    L(vg, Ox, MY(yb), MX(xb), MY(yb), 0.6, 'rgba(38,34,28,0.35)');
    T(vg, 'Δy = gT² 逐差验证', Ox + 8, Oy + PH + 34, 10, 'left', 'rgba(38,34,28,0.65)');

    insetPlot(vg, 452, 40, 96, 108, ptsOf(rows, 'x2', 'y'), 0, 0, 'x²/cm²', 'y/cm');
    T(vg, 'y–x² 图线', 452, 158, 10, 'left', 'rgba(38,34,28,0.75)');
    T(vg, '斜率 = g/(200v₀²)', 452, 172, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, 'v₀ = √(g/200k)', 452, 186, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, '重垂线定 y 轴方向', 452, 210, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, '每次由同一位置释放', 452, 224, 9.5, 'left', 'rgba(38,34,28,0.65)');
  }

  /* ======================================================================
   * 实验 6 · mech-energy：验证机械能守恒定律
   * 模型：重物自由下落，阻力 f 使 a = g − f/m（略小于 g）
   *   打点计时器 T = 0.02 s，量出各点到起点的距离 h
   *   vₙ = (hₙ₊₁ − hₙ₋₁)/(2T)（匀变速时等于该时刻的瞬时速度）
   *   比较 ΔEp = mgh 与 ΔEk = ½mv²：作 v²–h 图线，斜率应等于 2a ≈ 2g
   *   第 1、2 两点间距应接近 ½gT² ≈ 2 mm（说明第 1 点是释放时打的点）
   * 误差：纸带与限位孔摩擦、空气阻力（ΔEp 略大于 ΔEk）、长度读数误差、电源频率偏差
   * ==================================================================== */
  var MEv = { m: [0.10, 1.00, 0.30], fd: [0.000, 0.200, 0.040] };
  var ME_K = 8;

  function meModel(p, i) {
    var id = 'mech-energy';
    var m = clamp(num(p && p.m, MEv.m[2]), MEv.m[0], MEv.m[1]);
    var fd = clamp(num(p && p.fd, MEv.fd[2]), MEv.fd[0], MEv.fd[1]);
    var a = G_STD - fd / m;                                   /* 阻力使下落加速度小于 g */
    var Tdot = DT_DOT;                                        /* 打点周期（别用 T：那是写字原语） */
    var h = [], k, t;
    for (k = 1; k <= ME_K + 3; k++) {                         /* h[k] = 第 k 个计时点到第 1 个点(释放点)的距离 */
      t = (k - 1) * Tdot;
      h[k] = 0.5 * a * t * t + nz(id, 0, k, 0.0001);          /* m（毫米刻度尺读数，估读到 0.1 mm） */
    }
    /* 第 1、2 两点间距只有约 2 mm，相对读数误差最大，取点时舍去开头过于密集的部分 */
    var n = (i % ME_K) + 3;                                   /* 第 3…10 个计时点 */
    var v = (n + 1 <= ME_K + 3) ? (h[n + 1] - h[n - 1]) / (2 * Tdot) : (h[n] - h[n - 1]) / Tdot;
    var hr = round(h[n], 4), vr = round(v, 3);                /* 表格里显示的就是这两个读数 */
    var Ep = m * G_STD * hr, Ek = 0.5 * m * vr * vr;
    return {
      n: n, t: round((n - 1) * Tdot, 2), h: hr, v: vr, v2: round(vr * vr, 4),
      Ep: round(Ep, 4), Ek: round(Ek, 4),
      dev: round(Ep > 1e-9 ? (Ep - Ek) / Ep * 100 : 0, 2),
      d12: round((h[2] - h[1]) * 1000, 2),                    /* 第 1、2 两点间距：应接近 ½gT² ≈ 2 mm */
      m: round(m, 2), a: round(a, 3)
    };
  }

  function meConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(meModel, p, ME_K);
    var fit = fitLine(ptsOf(list, 'h', 'v2'));
    var aFit = (fit && isFinite(fit.a)) ? fit.a / 2 : 0;
    var devAvg = meanOf(list, 'dev');
    var m = clamp(num(p && p.m, MEv.m[2]), MEv.m[0], MEv.m[1]);
    return {
      value: round(aFit, 3), unit: 'm/s²',
      text: '取 ' + list.length + ' 个计时点（T = 0.02 s，m = ' + fmt(m, 2) +
        ' kg）：v²–h 图线是一条过原点的直线（r² = ' + fmt(fit ? fit.r2 : 1, 4) +
        '），斜率 k = ' + fmt(fit ? fit.a : 0, 3) + ' m/s² = 2a，得下落加速度 a = ' + fmt(aFit, 3) +
        ' m/s²，与当地 g = 9.80 m/s² 相差 ' + fmt(Math.abs(aFit - G_STD) / G_STD * 100, 2) +
        '%；各点 mgh 与 ½mv² 的平均相对偏差 ' + fmt(devAvg, 2) +
        '%（重力势能的减少量略大于动能的增加量，与阻力造成的系统误差方向一致），在误差允许范围内机械能守恒。',
      errors: [
        '重物受到的空气阻力和纸带受到的打点计时器阻力：ΔEp 一定略大于 ΔEk',
        '毫米刻度尺测量各点到起点距离的读数误差（本模型取 σ ≈ 0.3 mm），它经 v=(hₙ₊₁−hₙ₋₁)/2T 放大到速度上',
        '交流电源频率不严格等于 50 Hz，使打点周期不是 0.02 s',
        '先释放纸带后接通电源时，第 1、2 点间距明显大于 2 mm，起点不是速度为零的点'
      ]
    };
  }

  function meDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var cur = rows.length ? rows[rows.length - 1] : meModel(p, 0);
    var m = clamp(num(p.m, MEv.m[2]), MEv.m[0], MEv.m[1]);
    var fd = clamp(num(p.fd, MEv.fd[2]), MEv.fd[0], MEv.fd[1]);
    var a = G_STD - fd / m;
    var hMax = Math.max(0.02, 0.5 * a * Math.pow(ME_K * DT_DOT, 2));
    var pxPerM = 168 / (hMax * 100);
    caption(vg, '验证机械能守恒定律（重物自由下落 + 纸带）', [
      'm = ' + fmt(m, 2) + ' kg（两边都有 m，实验其实不需要测质量）   阻力 f = ' + fmt(fd, 3) + ' N → a = g − f/m = ' + fmt(a, 3) + ' m/s²',
      '打点计时器 T = 0.02 s：vₙ = (hₙ₊₁ − hₙ₋₁)/(2T)    第 1、2 点间距 ' + fmt(num(cur.d12, 0), 2) + ' mm（应接近 2 mm）',
      '第 ' + num(cur.n, 1) + ' 点：h = ' + fmt(num(cur.h, 0), 4) + ' m    v = ' + fmt(num(cur.v, 0), 3) + ' m/s    mgh = ' + fmt(num(cur.Ep, 0), 4) + ' J    ½mv² = ' + fmt(num(cur.Ek, 0), 4) + ' J'
    ]);

    RC(vg, 58, 296, 186, 12, 'rgba(38,34,28,0.16)', INK, 1.3);       /* 铁架台底座 */
    RC(vg, 84, 40, 12, 256, 'rgba(38,34,28,0.14)', INK, 1.3);        /* 立杆 */
    RC(vg, 84, 62, 60, 10, 'rgba(38,34,28,0.16)', INK, 1.2);         /* 铁夹横臂 */
    RC(vg, 130, 52, 78, 34, 'rgba(38,34,28,0.14)', INK, 1.3);        /* 打点计时器 */
    T(vg, '打点计时器', 169, 69, 9.5, 'center');
    T(vg, '4~6 V 交流', 130, 96, 9, 'left', 'rgba(38,34,28,0.65)');

    var tapeX = 208, tapeY0 = 86, tapeY1 = 268;
    RC(vg, tapeX - 12, tapeY0, 24, tapeY1 - tapeY0, 'rgba(255,255,255,0.75)', 'rgba(38,34,28,0.5)', 1);
    T(vg, '纸带', tapeX + 18, tapeY0 + 6, 9.5, 'left', 'rgba(38,34,28,0.7)');
    L(vg, tapeX - 30, tapeY0, tapeX + 40, tapeY0, 0.8, 'rgba(38,34,28,0.45)', [4, 3]);
    T(vg, '起点（第 1 点，v = 0）', tapeX + 30, tapeY0 - 10, 9.5, 'left', 'rgba(38,34,28,0.7)');
    var k, yy;
    for (k = 0; k <= ME_K; k++) {
      yy = tapeY0 + 0.5 * a * Math.pow(k * DT_DOT, 2) * pxPerM;
      if (yy > tapeY1) { break; }
      CI(vg, tapeX, yy, k === 0 ? 1.4 : 1.7, INK, null, 0);
    }
    var i;
    for (i = 0; i < rows.length; i++) {
      yy = tapeY0 + num(rows[i].h, 0) * pxPerM;
      if (yy > tapeY1) { continue; }
      L(vg, tapeX + 12, yy, tapeX + 30, yy, 1, 'rgba(38,34,28,0.5)');
      T(vg, 'h=' + fmt(num(rows[i].h, 0) * 100, 2), tapeX + 34, yy, 9, 'left', 'rgba(38,34,28,0.72)');
      CI(vg, tapeX + 21, yy, 2.2, INK, null, 0);
    }
    yy = tapeY0 + num(cur.h, 0) * pxPerM;
    AR(vg, tapeX - 26, tapeY0, tapeX - 26, Math.min(tapeY1, yy), 1.2, 'rgba(38,34,28,0.6)');
    T(vg, 'h', tapeX - 32, (tapeY0 + Math.min(tapeY1, yy)) / 2, 11, 'right', 'rgba(38,34,28,0.75)');
    RC(vg, tapeX - 15, tapeY1, 30, 30, 'rgba(38,34,28,0.18)', INK, 1.3);   /* 重物 */
    T(vg, '重物', tapeX, tapeY1 + 42, 9.5, 'center', 'rgba(38,34,28,0.75)');
    AR(vg, tapeX + 40, tapeY1 - 6, tapeX + 40, tapeY1 + 20, 1.4, 'rgba(38,34,28,0.55)');
    T(vg, 'v', tapeX + 46, tapeY1 + 8, 11, 'left', 'rgba(38,34,28,0.75)');

    insetPlot(vg, 366, 46, 150, 118, ptsOf(rows, 'h', 'v2'), 0, 0, 'h / m', 'v² / (m²·s⁻²)');
    T(vg, 'v²–h 图线', 366, 178, 10, 'left', 'rgba(38,34,28,0.75)');
    T(vg, '斜率 = 2a ≈ 2g', 366, 192, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, 'mgh = ½mv²', 366, 206, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, 'ΔEp 略大于 ΔEk：', 366, 228, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, '阻力的必然结果', 366, 241, 9.5, 'left', 'rgba(38,34,28,0.65)');
  }

  /* ======================================================================
   * 实验 7 · momentum：验证动量守恒定律（气垫导轨 + 光电门）
   * 模型：导轨水平、气垫使摩擦可忽略 → 碰撞前后系统动量守恒
   *   遮光片宽度 d 很小，滑块过光电门时 v = d/Δt
   *   恢复系数 e：(v₂′ − v₁′)/v₁ = e
   *   v₁′ = (m₁ − e·m₂)v₁/(m₁ + m₂)，v₂′ = m₁(1 + e)v₁/(m₁ + m₂)
   *   e = 1 弹性碰撞（装弹簧圈），e = 0 完全非弹性碰撞（装尼龙搭扣，碰后共速）
   *   作 p–p′ 图线（p = m₁v₁，p′ = m₁v₁′ + m₂v₂′）应过原点、斜率≈1
   * 误差：导轨未调水平（重力分量）、遮光片宽度与遮光时间测量、残余摩擦与气流扰动、称量
   * ==================================================================== */
  var MOv = { m1: [0.10, 0.50, 0.30], m2: [0.10, 0.50, 0.20], v1: [0.20, 1.00, 0.50], e: [0.00, 1.00, 1.00] };
  var MO_K = 6;
  var MO_D = 0.0100;    /* 遮光片宽度 d = 1.000 cm */

  function moModel(p, i) {
    var id = 'momentum';
    var m1 = clamp(num(p && p.m1, MOv.m1[2]), MOv.m1[0], MOv.m1[1]);
    var m2 = clamp(num(p && p.m2, MOv.m2[2]), MOv.m2[0], MOv.m2[1]);
    var v1 = sweep(p, 'v1', i, MO_K, MOv.v1[0], MOv.v1[1], 0.5);
    var e = clamp(num(p && p.e, MOv.e[2]), MOv.e[0], MOv.e[1]);
    var v1t = (m1 - e * m2) * v1 / (m1 + m2);
    var v2t = m1 * (1 + e) * v1 / (m1 + m2);
    /* 光电门测速：v = d/Δt，含遮光片宽度与计时误差（相对 ~0.4%），另加导轨未调平的系统项 */
    var k1 = 1 + nz(id, i, 1, 0.004), k2 = 1 + nz(id, i, 2, 0.004), k3 = 1 + nz(id, i, 3, 0.004);
    var v1r = round(v1 * k1, 4), v1ar = round(v1t * k2, 4), v2ar = round(v2t * k3, 4);
    var p1 = m1 * v1r, p2 = m1 * v1ar + m2 * v2ar;             /* 表格里显示的就是这几个速度 */
    var Ek1 = 0.5 * m1 * v1r * v1r, Ek2 = 0.5 * m1 * v1ar * v1ar + 0.5 * m2 * v2ar * v2ar;
    return {
      m1: round(m1, 3), m2: round(m2, 3), e: round(e, 2),
      v1: v1r, v1a: v1ar, v2a: v2ar,
      p1: round(p1, 4), p2: round(p2, 4),
      dev: round(p1 > 1e-9 ? (p2 - p1) / p1 * 100 : 0, 2),
      dt1: round(MO_D / Math.max(v1r, 1e-6) * 1000, 2),
      Ek1: round(Ek1, 4), Ek2: round(Ek2, 4),
      loss: round(Ek1 > 1e-9 ? (Ek1 - Ek2) / Ek1 * 100 : 0, 2)
    };
  }

  function moConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(moModel, p, MO_K);
    var fit = fitLine(ptsOf(list, 'p1', 'p2'));
    var slope = (fit && isFinite(fit.a)) ? fit.a : 1;
    var devMax = 0, i, v;
    for (i = 0; i < list.length; i++) {
      v = Math.abs(num(list[i].dev, 0));
      if (v > devMax) { devMax = v; }
    }
    var e = clamp(num(p && p.e, MOv.e[2]), MOv.e[0], MOv.e[1]);
    var lossAvg = meanOf(list, 'loss');
    return {
      value: round(slope, 3), unit: '',
      text: '共 ' + list.length + ' 次碰撞（恢复系数 e = ' + fmt(e, 2) + '）：以碰前总动量 p = m₁v₁ 为横轴、' +
        '碰后总动量 p′ = m₁v₁′ + m₂v₂′ 为纵轴作图，图线过原点且斜率 k = ' + fmt(slope, 3) +
        '（r² = ' + fmt(fit ? fit.r2 : 1, 4) + '），各次测量的最大相对偏差 ' + fmt(devMax, 2) +
        '%。在误差允许范围内碰撞前后系统的总动量守恒；' + (e < 0.95
          ? '本次为完全非弹性碰撞（碰后共速），动能损失约 ' + fmt(lossAvg, 1) + '%，但动量仍然守恒。'
          : '本次为弹性碰撞，动能也基本不变（损失约 ' + fmt(lossAvg, 1) + '%）。'),
      errors: [
        '气垫导轨未调水平：滑块受重力沿导轨方向的分量，使碰前碰后的速度不完全等于匀速值',
        '遮光片宽度 d 用游标卡尺测量的误差与光电门遮光时间的计时误差（v = d/Δt）',
        '导轨残余摩擦、气流的扰动以及滑块与导轨间的微小碰撞能量损失',
        '滑块（含遮光片）质量用天平称量的误差，以及碰撞时两滑块不一定沿同一直线运动'
      ]
    };
  }

  function moDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var cur = rows.length ? rows[rows.length - 1] : moModel(p, 0);
    var m1 = num(cur.m1, 0.3), m2 = num(cur.m2, 0.2), e = num(cur.e, 1);
    var v1 = num(cur.v1, 0.5), v1a = num(cur.v1a, 0), v2a = num(cur.v2a, 0.5);
    var PXS = 150;                                   /* 动画用：150 px 相当于 1 m */
    var xRail0 = 52, xRail1 = 522, railY = 208;
    var xColl = 306, xStart = 70;
    var tColl = (xColl - xStart) / Math.max(v1 * PXS, 1e-3);
    var tau = num(state.t, 0) % (tColl + 1.6);
    var x1, x2;
    if (tau < tColl) { x1 = xStart + v1 * PXS * tau; x2 = xColl + 54; }
    else {
      x1 = xColl + v1a * PXS * (tau - tColl);
      x2 = xColl + 54 + v2a * PXS * (tau - tColl);
    }
    x1 = clamp(x1, xRail0 + 2, xRail1 - 60);
    x2 = clamp(x2, xRail0 + 2, xRail1 - 60);

    caption(vg, '验证动量守恒定律（气垫导轨 + 光电门）', [
      'm₁ = ' + fmt(m1, 3) + ' kg    m₂ = ' + fmt(m2, 3) + ' kg    遮光片 d = 1.000 cm    e = ' + fmt(e, 2) + (e > 0.95 ? '（弹性碰撞：弹簧圈）' : (e < 0.05 ? '（完全非弹性：尼龙搭扣）' : '（一般碰撞）')),
      '光电门测速 v = d/Δt：v₁ = ' + fmt(v1, 3) + ' m/s    v₁′ = ' + fmt(v1a, 3) + ' m/s    v₂′ = ' + fmt(v2a, 3) + ' m/s',
      'p = m₁v₁ = ' + fmt(num(cur.p1, 0), 4) + ' kg·m/s    p′ = m₁v₁′ + m₂v₂′ = ' + fmt(num(cur.p2, 0), 4) + ' kg·m/s    偏差 ' + fmt(num(cur.dev, 0), 2) + '%'
    ]);

    /* 气垫导轨（表面有小孔）+ 支腿 + 气泵 + 气管 */
    RC(vg, xRail0, railY, xRail1 - xRail0, 16, 'rgba(38,34,28,0.13)', INK, 1.4);
    var i;
    for (i = 0; i <= 36; i++) { CI(vg, xRail0 + 10 + i * 12.4, railY + 8, 1, 'rgba(38,34,28,0.5)', null, 0); }
    L(vg, 120, railY + 16, 120, railY + 44, 1.4, INK);
    L(vg, 460, railY + 16, 460, railY + 44, 1.4, INK);
    RC(vg, 52, railY + 44, 470, 8, 'rgba(38,34,28,0.12)', INK, 1.2);
    RC(vg, 60, 276, 74, 40, 'rgba(38,34,28,0.14)', INK, 1.3);
    T(vg, '气泵', 97, 296, 10, 'center');
    var c = vg.c;
    c.save();
    c.strokeStyle = 'rgba(38,34,28,0.6)'; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(134, 286); c.quadraticCurveTo(180, 268, 186, railY + 12); c.stroke();
    c.restore();

    /* 两个滑块（顶端带遮光片） */
    var s1 = x1, s2 = x2, j;
    RC(vg, s1, railY - 22, 54, 22, 'rgba(38,34,28,0.17)', INK, 1.3);
    CI(vg, s1 + 12, railY - 2, 4, 'rgba(38,34,28,0.25)', INK, 1);
    CI(vg, s1 + 42, railY - 2, 4, 'rgba(38,34,28,0.25)', INK, 1);
    RC(vg, s1 + 24, railY - 34, 5, 12, 'rgba(38,34,28,0.35)', INK, 1);
    T(vg, 'm₁', s1 + 27, railY - 44, 11, 'center');
    RC(vg, s2, railY - 22, 54, 22, 'rgba(38,34,28,0.17)', INK, 1.3);
    CI(vg, s2 + 12, railY - 2, 4, 'rgba(38,34,28,0.25)', INK, 1);
    CI(vg, s2 + 42, railY - 2, 4, 'rgba(38,34,28,0.25)', INK, 1);
    RC(vg, s2 + 24, railY - 34, 5, 12, 'rgba(38,34,28,0.35)', INK, 1);
    T(vg, 'm₂', s2 + 27, railY - 44, 11, 'center');
    if (e > 0.95) {
      for (j = 0; j < 5; j++) { CI(vg, s1 + 54 + j * 1.6, railY - 11, 1.2, 'rgba(38,34,28,0.5)', null, 0); }
    } else if (e < 0.05) {
      L(vg, s1 + 54, railY - 16, s1 + 54, railY - 6, 2.4, 'rgba(38,34,28,0.45)');
      L(vg, s2, railY - 16, s2, railY - 6, 2.4, 'rgba(38,34,28,0.45)');
    }
    AR(vg, s1 + 27, railY - 56, s1 + 27 + clamp(v1 * 46, 12, 70), railY - 56, 1.6, 'rgba(38,34,28,0.7)');
    T(vg, 'v₁', s1 + 30 + clamp(v1 * 46, 12, 70), railY - 62, 10.5, 'left', 'rgba(38,34,28,0.8)');

    /* 两个光电门 + 数字计时器 */
    var gx, gate = [186, 396];
    for (j = 0; j < 2; j++) {
      gx = gate[j];
      L(vg, gx, railY - 40, gx, railY + 18, 1.8, INK);
      L(vg, gx + 20, railY - 40, gx + 20, railY + 18, 1.8, INK);
      RC(vg, gx - 4, railY - 50, 28, 12, 'rgba(38,34,28,0.14)', INK, 1.2);
      L(vg, gx + 10, railY - 50, 300 + 20 * j, 118, 1, 'rgba(38,34,28,0.5)');
      T(vg, '光电门' + (j + 1), gx + 10, railY + 30, 9.5, 'center', 'rgba(38,34,28,0.7)');
    }
    RC(vg, 276, 72, 190, 46, 'rgba(255,255,255,0.8)', INK, 1.3);
    T(vg, '数字计时器', 371, 62, 9.5, 'center', 'rgba(38,34,28,0.7)');
    T(vg, 'Δt₁ = ' + fmt(num(cur.dt1, 0), 2) + ' ms', 286, 88, 11, 'left');
    T(vg, 'v = d/Δt', 286, 104, 10.5, 'left', 'rgba(38,34,28,0.7)');
    T(vg, (e < 0.05 ? '碰后两滑块粘在一起（完全非弹性）' : (e > 0.95 ? '碰后分离，动能几乎不变（弹性）' : '碰后分离，有动能损失')),
      60, 320, 10, 'left', 'rgba(38,34,28,0.68)');
  }

  /* ======================================================================
   * 实验 8 · simple-pendulum：用单摆测量重力加速度
   * 模型：小角度单摆 T = 2π√(L/g)，L = 摆线长 + 球半径
   *   摆角修正（大角度周期变大）：T ≈ 2π√(L/g)·(1 + θ₀²/16)（θ₀ 用弧度）
   *   测 n（30~50）次全振动的总时间 t：T = t/n，g = 4π²L/T²
   *   作 T²–L 图线：T² = (4π²/g)L，斜率 k = 4π²/g → g = 4π²/k
   * 误差：摆长漏算球半径、计时起止的反应时间（秒表误差 σ ≈ 0.12 s）、全振动次数数错、
   *       摆角偏大、形成圆锥摆、空气阻力
   * ==================================================================== */
  var SPv = { L: [0.40, 1.20, 0.80], r: [5, 15, 10], th0: [1, 12, 5], n: [30, 50, 30] };
  var SP_K = 6;

  function spModel(p, i) {
    var id = 'simple-pendulum';
    var l = sweep(p, 'L', i, SP_K, SPv.L[0], SPv.L[1], 0.5);       /* 摆线长 (m) */
    var r = clamp(num(p && p.r, SPv.r[2]), SPv.r[0], SPv.r[1]);    /* 球半径 (mm) */
    var th0 = clamp(num(p && p.th0, SPv.th0[2]), SPv.th0[0], SPv.th0[1]);
    var n = Math.round(clamp(num(p && p.n, SPv.n[2]), SPv.n[0], SPv.n[1]));
    var Llen = l + r / 1000;                                       /* 摆长 = 摆线长 + 球半径（别用 L：画线原语） */
    var rad = th0 * Math.PI / 180;
    var Tth = 2 * Math.PI * Math.sqrt(Llen / G_STD) * (1 + rad * rad / 16);   /* 别用 T：写字原语 */
    var t = n * Tth + nz(id, i, 0, 0.12);                          /* 秒表计时误差 */
    var Lr = round(Llen, 3), Tm = round(t / n, 4);                 /* 表格里显示的就是这两个读数 */
    var g = 4 * Math.PI * Math.PI * Lr / (Tm * Tm);
    return {
      n: n, L: Lr, l: round(l, 3), r: round(r, 0), th0: round(th0, 1),
      t: round(t, 2), T: Tm, T2: round(Tm * Tm, 4), g: round(g, 3)
    };
  }

  function spConclude(rows, p) {
    var list = (rows && rows.length) ? rows : seriesOf(spModel, p, SP_K);
    var fit = fitLine(ptsOf(list, 'L', 'T2'));
    var gFit = (fit && fit.a > 1e-9) ? 4 * Math.PI * Math.PI / fit.a : 0;
    var gAvg = meanOf(list, 'g');
    var r = clamp(num(p && p.r, SPv.r[2]), SPv.r[0], SPv.r[1]);
    var th0 = clamp(num(p && p.th0, SPv.th0[2]), SPv.th0[0], SPv.th0[1]);
    var n = Math.round(clamp(num(p && p.n, SPv.n[2]), SPv.n[0], SPv.n[1]));
    return {
      value: round(gFit, 3), unit: 'm/s²',
      text: '改变摆长测了 ' + list.length + ' 组数据（n = ' + n + ' 次全振动，球半径 r = ' + fmt(r, 0) +
        ' mm，摆角 θ₀ = ' + fmt(th0, 1) + '°）：T²–L 图线是一条过原点的直线（r² = ' + fmt(fit ? fit.r2 : 1, 4) +
        '），斜率 k = ' + fmt(fit ? fit.a : 0, 4) + ' s²/m，由 g = 4π²/k 得 g = ' + fmt(gFit, 3) +
        ' m/s²；各次用 g = 4π²L/T² 直接算得的平均值是 ' + fmt(gAvg, 3) +
        ' m/s²。与当地重力加速度标准值 9.80 m/s² 相差 ' + fmt(Math.abs(gFit - G_STD) / G_STD * 100, 2) + '%。',
      errors: [
        '摆长漏算小球半径（少记约 1 cm 会使 g 偏小约 1%）：本模型取 L = 摆线长 + 球半径',
        '计时起止与小球经过最低点不同步（人手反应时间 σ ≈ 0.12 s）：总时间 t 不准，T 随之偏差',
        '全振动次数数错：多记一次则 T 偏小、g 偏大；摆角偏大（θ₀ > 5°）则周期偏大、g 偏小',
        '小球不在同一竖直面内摆动（形成圆锥摆）时周期偏小、g 偏大；空气阻力使振幅衰减'
      ]
    };
  }

  function spDraw(vg, p, state) {
    var rows = (state && state.rows) || [];
    var cur = rows.length ? rows[rows.length - 1] : spModel(p, 0);
    var r = clamp(num(p.r, SPv.r[2]), SPv.r[0], SPv.r[1]);
    var th0 = clamp(num(p.th0, SPv.th0[2]), SPv.th0[0], SPv.th0[1]);
    var n = Math.round(num(cur.n, 30));
    var Lread = num(cur.L, 0.8);                             /* 摆长读数（别用 L：那是画线原语） */
    var Lpx = 84 + (clamp(Lread, 0.3, 1.4) - 0.4) / 0.8 * 118;
    var Px = 268, Py = 66;
    var Tvis = 1.6;
    var ang = th0 * Math.PI / 180 * Math.cos(2 * Math.PI * (num(state.t, 0) % Tvis) / Tvis);
    var bx = Px + Lpx * Math.sin(ang), by = Py + Lpx * Math.cos(ang);
    var rpx = clamp(r * 0.9, 5, 14);
    caption(vg, '用单摆测量重力加速度', [
      '摆线长 l = ' + fmt(num(cur.l, 0), 3) + ' m    球半径 r = ' + fmt(r, 0) + ' mm    摆长 L = l + r = ' + fmt(Lread, 3) + ' m',
      '全振动次数 n = ' + n + '    总时间 t = ' + fmt(num(cur.t, 0), 2) + ' s    T = t/n = ' + fmt(num(cur.T, 0), 4) + ' s    T² = ' + fmt(num(cur.T2, 0), 4) + ' s²',
      'θ₀ = ' + fmt(th0, 1) + '°（应小于 5°）    g = 4π²L/T² = ' + fmt(num(cur.g, 0), 3) + ' m/s²'
    ]);

    RC(vg, 60, 292, 180, 12, 'rgba(38,34,28,0.16)', INK, 1.3);
    RC(vg, 84, 46, 12, 248, 'rgba(38,34,28,0.14)', INK, 1.3);
    RC(vg, 84, 62, 214, 10, 'rgba(38,34,28,0.16)', INK, 1.2);
    RC(vg, Px - 20, 56, 40, 14, 'rgba(38,34,28,0.2)', INK, 1.2);
    T(vg, '铁架台', 150, 312, 10, 'center', 'rgba(38,34,28,0.7)');
    L(vg, Px, Py, Px, Py + Lpx + 60, 0.8, 'rgba(38,34,28,0.4)', [5, 4]);
    L(vg, Px, Py, bx, by, 1.2, 'rgba(38,34,28,0.8)');
    CI(vg, bx, by, rpx, 'rgba(38,34,28,0.22)', INK, 1.3);
    CI(vg, Px, Py, 2.6, INK, null, 0);
    T(vg, '悬点', Px + 8, Py - 10, 9.5, 'left', 'rgba(38,34,28,0.7)');

    /* 摆角与弧线 */
    var c = vg.c;
    c.save();
    c.strokeStyle = 'rgba(38,34,28,0.5)'; c.lineWidth = 1;
    c.beginPath();
    c.arc(Px, Py, 62, Math.PI / 2 - th0 * Math.PI / 180, Math.PI / 2 + th0 * Math.PI / 180);
    c.stroke();
    c.restore();
    T(vg, 'θ₀=' + fmt(th0, 0) + '°', Px + 8, Py + 70, 10, 'left', 'rgba(38,34,28,0.75)');
    var i;
    for (i = 0; i < 5; i++) {
      CI(vg, Px + 26 + i * 3.4, Py + 84, 1, 'rgba(38,34,28,0.35)', null, 0);
    }

    /* 摆长标注 */
    L(vg, Px - 30, Py, Px - 30, by, 0.9, 'rgba(38,34,28,0.5)', [4, 3]);
    AR(vg, Px - 30, Py + 6, Px - 30, Py, 1, 'rgba(38,34,28,0.55)');
    AR(vg, Px - 30, by - 6, Px - 30, by, 1, 'rgba(38,34,28,0.55)');
    T(vg, 'L', Px - 38, (Py + by) / 2, 12, 'right', 'rgba(38,34,28,0.8)');
    T(vg, '摆长 = 线长 + 球半径', Px - 38, (Py + by) / 2 + 14, 9, 'right', 'rgba(38,34,28,0.62)');

    /* 刻度尺 + 已测摆长 */
    rulerV(vg, 452, 60, 292, 26);
    T(vg, 'cm', 452, 48, 10, 'center', 'rgba(38,34,28,0.7)');
    for (i = 0; i < rows.length; i++) {
      var yy = 60 + (num(rows[i].L, 0) - 2) * ((292 - 60) / 26);
      if (yy < 60 || yy > 292) { continue; }
      L(vg, 440, yy, 462, yy, 1, 'rgba(38,34,28,0.55)');
      CI(vg, 466, yy, 2.6, INK, null, 0);
      if (i === rows.length - 1) { T(vg, 'L = ' + fmt(num(rows[i].L, 0), 3), 472, yy, 9.5, 'left'); }
    }

    insetPlot(vg, 150, 196, 150, 96, ptsOf(rows, 'L', 'T2'), 0, 0, 'L / m', 'T² / s²');
    T(vg, 'T²–L 图线：斜率 k = 4π²/g', 150, 302, 9.5, 'left', 'rgba(38,34,28,0.72)');
    T(vg, 'g = 4π²/k', 150, 315, 9.5, 'left', 'rgba(38,34,28,0.72)');
    T(vg, '测 30~50 次全振动', 320, 196, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, '在最低点开始计时', 320, 209, 9.5, 'left', 'rgba(38,34,28,0.65)');
    T(vg, '摆角小于 5°', 320, 222, 9.5, 'left', 'rgba(38,34,28,0.65)');
  }

  CORE.register('projectile', {
    id: 'projectile',
    name: '探究平抛运动的特点',
    group: '力学',
    aim: '描绘平抛运动的轨迹，探究平抛运动在水平方向和竖直方向上的运动规律，并求出平抛的初速度。',
    principle: '小球从斜槽末端水平飞出后只受重力（不计空气阻力），做平抛运动。把平抛运动分解为水平方向的匀速直线运动和竖直方向的自由落体运动：x = v₀t，y = ½gt²。坐标原点取斜槽末端小球球心在白纸上的水平投影点，y 轴沿重垂线方向向下。轨迹上任一点都满足 y = [g/(2v₀²)]x²，所以以 x² 为横轴、y 为纵轴作图应得到一条过原点的直线，斜率 k = g/(200v₀²)（x、y 以 cm 为单位），由此可求初速度 v₀ = √(g/200k)；由轨迹上任一点也可用 v₀ = (x/10)√(g/2y) 求初速度。相邻相等时间内的竖直位移差 Δy = gT²，说明竖直方向是自由落体运动。小球离开斜槽时的速度 v₀ = √(2gH(1−η)/1.4)（实心球沿斜槽滚下时转动动能占 2/7，η 为摩擦等能量损失比例）。',
    apparatus: ['斜槽（末端可调成水平）', '小球（钢球）', '木板（竖直放置）', '白纸', '坐标纸（或复写纸）',
      '重垂线', '铅笔', '毫米刻度尺', '铁架台（或平抛运动演示仪）'],
    steps: [
      '把斜槽固定在桌边（或铁架台上），调节斜槽末端使其切线水平（把小球轻放在末端，小球应静止不滚动）。',
      '用重垂线确定竖直方向，把白纸（坐标纸）固定在竖直木板上，使纸上的 y 轴沿重垂线方向。',
      '记下斜槽末端小球球心在纸上的水平投影点 O，作为坐标原点。',
      '让小球从斜槽上某一固定位置由静止滚下，用铅笔描下小球经过的位置；重复多次，每次让小球从同一位置释放，描出若干位置。',
      '用平滑的曲线把描出的点连接起来，得到小球做平抛运动的轨迹。',
      '在轨迹上选取几个点，用毫米刻度尺量出它们的水平坐标 x 和竖直坐标 y，填入表格。',
      '作 y–x² 图线：若为过原点的直线，说明竖直方向是自由落体运动、水平方向是匀速直线运动；由斜率求出 v₀，并与由 v₀ = (x/10)√(g/2y) 求得的各点结果比较。'
    ],
    params: [
      P('H', '释放点离末端高度 H', 'm', PJv.H[0], PJv.H[1], 0.01, PJv.H[2]),
      P('f', '频闪/描点频率 f', 'Hz', PJv.f[0], PJv.f[1], 1, PJv.f[2]),
      P('be', '斜槽末端倾角 β', '°', PJv.be[0], PJv.be[1], 0.1, PJv.be[2]),
      P('eta', '斜槽能量损失 η', '', PJv.eta[0], PJv.eta[1], 0.01, PJv.eta[2])
    ],
    measure: function (p) { return pjModel(p, seqOf('projectile', PJ_K)); },
    columns: [
      COL('k', '描迹点序号', ''), COL('t', '时间 t', 's'), COL('x', '水平坐标 x', 'cm'),
      COL('x2', 'x²', 'cm²'), COL('y', '竖直坐标 y', 'cm'), COL('v0k', '单点法 v₀', 'm/s'),
      COL('v0', 'v₀（理论）', 'm/s')
    ],
    graph: { x: 'x2', y: 'y', fit: 'linear', title: 'y–x² 图线', note: '过原点的直线说明竖直方向为自由落体；斜率 = g/(200v₀²)，v₀ = √(g/200k)' },
    conclude: function (rows, p) { return pjConclude(rows, p); },
    draw: safeDraw('projectile', pjDraw),
    step: safeStep('projectile', function (p, state, dt) { state.t = num(state.t, 0) + dt; })
  });

  CORE.register('mech-energy', {
    id: 'mech-energy',
    name: '验证机械能守恒定律',
    group: '力学',
    aim: '用重物自由下落时打出的纸带，比较重力势能的减少量 mgh 与动能的增加量 ½mv²，验证机械能守恒定律。',
    principle: '重物自由下落时，若只有重力做功，机械能守恒：mgh = ½mv²。两边都含 m，所以实验不需要测量重物的质量，只需验证 gh = ½v²（或作 v²–h 图线，斜率应等于 2g）。打点计时器每隔 0.02 s 打一个点，用毫米刻度尺量出纸带上各点到起点的距离 h；第 n 个点（时刻 t = nT）的瞬时速度等于包含该点的一段位移的平均速度：vₙ = (hₙ₊₁ − hₙ₋₁)/(2T)，T = 0.02 s（匀变速直线运动中某段时间内的平均速度等于中间时刻的瞬时速度）。若取释放时打的第 1 个点为起点（v = 0），则第 1、2 两点间距应接近 ½gT² ≈ 2 mm。由于纸带与限位孔的摩擦和空气阻力，重力势能的减少量一定略大于动能的增加量。',
    apparatus: ['电磁打点计时器（4~6 V 交流电源，50 Hz）', '纸带', '复写纸片', '重物（带夹子）',
      '铁架台（带铁夹）', '低压交流电源、导线', '毫米刻度尺', '天平（测质量，本实验并非必需）'],
    steps: [
      '把打点计时器固定在铁架台上，使限位孔在竖直方向，让纸带穿过限位孔，纸带下端夹上重物。',
      '把纸带（连同重物）提到靠近打点计时器的位置，先接通电源，待打点稳定后再释放纸带。',
      '重物落地前及时切断电源，取下纸带；换上新纸带，重复几次（注意让纸带保持竖直，减小与限位孔的摩擦）。',
      '选择点迹清晰、且第 1、2 两点间距接近 2 mm 的纸带（说明第 1 个点是释放时打的点，其速度为 0）。',
      '在纸带上选取若干个计时点，用毫米刻度尺量出各点到起点的距离 hₙ，并用 vₙ = (hₙ₊₁ − hₙ₋₁)/(2T) 求出各点的瞬时速度（T = 0.02 s）。',
      '算出各点的 mghₙ 与 ½mvₙ²，比较两者的大小；也可以作 v²–h 图线，由斜率求出下落加速度 a 并与当地 g 比较。',
      '分析结果：在误差允许范围内 mgh = ½mv²，机械能守恒；ΔEp 略大于 ΔEk 是阻力造成的系统误差。'
    ],
    params: [
      P('m', '重物质量 m（计算用）', 'kg', MEv.m[0], MEv.m[1], 0.05, MEv.m[2]),
      P('fd', '纸带与空气阻力 f', 'N', MEv.fd[0], MEv.fd[1], 0.002, MEv.fd[2])
    ],
    measure: function (p) { return meModel(p, seqOf('mech-energy', ME_K)); },
    columns: [
      COL('n', '计时点序号', ''), COL('t', '时间 t', 's'), COL('h', '下落高度 h', 'm'),
      COL('v', '瞬时速度 v', 'm/s'), COL('v2', 'v²', 'm²/s²'), COL('Ep', 'mgh', 'J'),
      COL('Ek', '½mv²', 'J'), COL('dev', '相对偏差', '%')
    ],
    graph: { x: 'h', y: 'v2', fit: 'linear', title: 'v²–h 图线', note: '斜率 = 2a ≈ 2g；mgh = ½mv² 即 v² = 2gh' },
    conclude: function (rows, p) { return meConclude(rows, p); },
    draw: safeDraw('mech-energy', meDraw),
    step: safeStep('mech-energy', function (p, state, dt) { state.t = num(state.t, 0) + dt; })
  });

  CORE.register('momentum', {
    id: 'momentum',
    name: '验证动量守恒定律',
    group: '力学',
    aim: '探究碰撞前后系统总动量的变化，验证动量守恒定律。',
    principle: '气垫导轨上滑块运动时摩擦极小，导轨水平时系统所受合外力为零，碰撞前后系统的总动量守恒：m₁v₁ = m₁v₁′ + m₂v₂′。滑块上遮光片的宽度 d 很小，滑块经过光电门时测出遮光时间 Δt，则滑块的速度 v = d/Δt。设恢复系数 e = (v₂′ − v₁′)/v₁，则 v₁′ = (m₁ − e·m₂)v₁/(m₁ + m₂)，v₂′ = m₁(1 + e)v₁/(m₁ + m₂)：e = 1 是弹性碰撞（两滑块间装弹簧圈，碰后分离、动能几乎不变），e = 0 是完全非弹性碰撞（装尼龙搭扣，碰后共速，动能损失最大），但无论哪种情况动量都守恒。以碰前总动量 p = m₁v₁ 为横轴、碰后总动量 p′ = m₁v₁′ + m₂v₂′ 为纵轴作图，图线应为过原点、斜率接近 1 的直线。（也可以改用斜槽方案：入射小球与被碰小球等大且 m₁ > m₂，用水平射程代替速度，验证 m₁·OP = m₁·OM + m₂·ON。）',
    apparatus: ['气垫导轨（含气泵、气管）', '两个滑块（质量已知，装有宽度相同的遮光片）',
      '两个光电门（配数字计时器）', '天平', '游标卡尺（测遮光片宽度 d）',
      '弹簧圈（弹性碰撞用）、尼龙搭扣（完全非弹性碰撞用）'],
    steps: [
      '接通气泵电源，把滑块放在导轨上，调节导轨下面的调平螺丝，轻推滑块使它经过两个光电门的遮光时间相等，确认导轨水平。',
      '用天平称出两个滑块（含遮光片）的质量 m₁、m₂；用游标卡尺测出遮光片的宽度 d。',
      '在导轨上装好两个光电门并与数字计时器连接，使计时器能分别记录滑块通过两个光电门的遮光时间。',
      '先不放滑块 2，给滑块 1 一个初速度，测出它通过光电门 1 的遮光时间 Δt₁，得碰前速度 v₁ = d/Δt₁。',
      '把滑块 2 静止放在两个光电门之间，让滑块 1 以同样的方式撞向滑块 2（装上弹簧圈为弹性碰撞，装上尼龙搭扣为完全非弹性碰撞），记录碰后两滑块通过光电门的遮光时间 Δt₁′、Δt₂′，算出 v₁′ = d/Δt₁′、v₂′ = d/Δt₂′。',
      '比较碰前的 m₁v₁ 与碰后的 m₁v₁′ + m₂v₂′，改变滑块质量或碰前速度重复多次，验证系统动量是否守恒。'
    ],
    params: [
      P('m1', '滑块1质量 m₁', 'kg', MOv.m1[0], MOv.m1[1], 0.01, MOv.m1[2]),
      P('m2', '滑块2质量 m₂', 'kg', MOv.m2[0], MOv.m2[1], 0.01, MOv.m2[2]),
      P('v1', '碰前速度 v₁', 'm/s', MOv.v1[0], MOv.v1[1], 0.02, MOv.v1[2]),
      P('e', '恢复系数 e（1 弹性 / 0 完全非弹性）', '', MOv.e[0], MOv.e[1], 0.05, MOv.e[2])
    ],
    measure: function (p) { return moModel(p, seqOf('momentum', MO_K)); },
    columns: [
      COL('m1', '滑块1质量 m₁', 'kg'), COL('m2', '滑块2质量 m₂', 'kg'), COL('v1', '碰前 v₁', 'm/s'),
      COL('v1a', '碰后 v₁′', 'm/s'), COL('v2a', '碰后 v₂′', 'm/s'),
      COL('p1', '碰前总动量 p', 'kg·m/s'), COL('p2', '碰后总动量 p′', 'kg·m/s'),
      COL('dev', '相对偏差', '%')
    ],
    graph: { x: 'p1', y: 'p2', fit: 'linear', title: 'p′–p 图线', note: '碰前总动量为横轴、碰后总动量为纵轴：应过原点、斜率≈1' },
    conclude: function (rows, p) { return moConclude(rows, p); },
    draw: safeDraw('momentum', moDraw),
    step: safeStep('momentum', function (p, state, dt) { state.t = num(state.t, 0) + dt; })
  });

  CORE.register('simple-pendulum', {
    id: 'simple-pendulum',
    name: '用单摆测量重力加速度',
    group: '力学',
    aim: '用单摆测量当地的重力加速度 g，并用 T²–L 图线处理数据、分析误差来源。',
    principle: '摆角很小时（θ₀ < 5°）单摆的振动可以看成简谐运动，周期 T = 2π√(L/g)，由此得 g = 4π²L/T²。摆长 L 等于摆线长加上摆球的半径（L = l + r），用秒表测出 n 次（30~50 次）全振动的总时间 t，则 T = t/n。以摆长 L 为横轴、T² 为纵轴作图，得到过原点的直线 T² = (4π²/g)L，斜率 k = 4π²/g，所以 g = 4π²/k——用图线法可以减小偶然误差。摆角较大时周期略大于 2π√(L/g)，修正后 T ≈ 2π√(L/g)(1 + θ₀²/16)（θ₀ 用弧度），所以摆角必须小于 5°；若摆球不在同一竖直面内运动而形成圆锥摆，周期会偏小、测得的 g 偏大。',
    apparatus: ['长约 1 m 的细线（不可伸长）', '金属小球（半径约 1 cm）', '铁架台（带铁夹）',
      '毫米刻度尺', '游标卡尺（测小球直径）', '秒表', '量角器（或画有角度标记的白纸）'],
    steps: [
      '用细线拴住小球，把细线的另一端用铁夹固定在铁架台上，使摆线竖直、小球自然下垂，且摆球不与铁架台底座接触。',
      '用毫米刻度尺量出摆线长 l，用游标卡尺量出小球直径 D，算出摆长 L = l + D/2。',
      '把小球拉开一个很小的角度（小于 5°），由静止释放，使小球始终在同一个竖直平面内摆动（防止形成圆锥摆）。',
      '当小球经过最低点时开始计时（倒数计数法：数 3、2、1、0、1、2、3……，数到 0 时按下秒表），测出 30~50 次全振动的总时间 t，重复测量 2~3 次取平均值。',
      '改变摆长（每次改变约 10 cm），重复上述步骤，得到 5~6 组 (L, t) 数据，算出各组的周期 T = t/n 与 T²。',
      '以 L 为横轴、T² 为纵轴作出 T²–L 图线，求出斜率 k，由 g = 4π²/k 求出重力加速度，并与当地重力加速度标准值比较，分析误差来源。'
    ],
    params: [
      P('L', '摆线长 l', 'm', SPv.L[0], SPv.L[1], 0.01, SPv.L[2]),
      P('r', '小球半径 r', 'mm', SPv.r[0], SPv.r[1], 1, SPv.r[2]),
      P('th0', '最大摆角 θ₀', '°', SPv.th0[0], SPv.th0[1], 1, SPv.th0[2]),
      P('n', '全振动次数 n', '次', SPv.n[0], SPv.n[1], 1, SPv.n[2])
    ],
    measure: function (p) { return spModel(p, seqOf('simple-pendulum', SP_K)); },
    columns: [
      COL('n', '全振动次数 n', '次'), COL('L', '摆长 L = l + r', 'm'), COL('t', '总时间 t', 's'),
      COL('T', '周期 T = t/n', 's'), COL('T2', 'T²', 's²'), COL('g', 'g = 4π²L/T²', 'm/s²')
    ],
    graph: { x: 'L', y: 'T2', fit: 'linear', title: 'T²–L 图线', note: '斜率 k = 4π²/g，所以 g = 4π²/k' },
    conclude: function (rows, p) { return spConclude(rows, p); },
    draw: safeDraw('simple-pendulum', spDraw),
    step: safeStep('simple-pendulum', function (p, state, dt) { state.t = num(state.t, 0) + dt; })
  });


})();
