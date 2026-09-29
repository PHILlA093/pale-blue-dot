/* ============================================================================
   穷观 · 物理实验台 · 组 2「电学基础」            js/pslab/elec.js
   指纹 QG-20260920-5e5d5a
   © 2026 PHILlA093 · 原创作品 · 保留所有权利
   ----------------------------------------------------------------------------
   本文件只做一件事：向 window.QG_PSLAB 登记 4 个电学实验（惰性：不自建 DOM、
   不起循环、不联网、零依赖、纯 ES5）。id 逐字取自《穷观 · 物理实验台设计契约》§2 组 2：
     resistivity     导体电阻率的测量
     multimeter      练习使用多用电表
     emf-internal    测量电池的电动势和内阻
     va-characteristic 描绘小灯泡的伏安特性曲线

   ============================ 一、物理模型与量纲 ============================
   [器材常数]（取自现行教材/高考真题给出的实验器材规格）
     电流表 0~0.6 A：最小分度 0.02 A，估读到 0.01 A，内阻 Ra ≈ 0.10 Ω
     电压表 0~3 V  ：最小分度 0.1 V ，估读到 0.01 V，内阻 Rv ≈ 3 kΩ
     螺旋测微器：分度 0.01 mm，估读到 0.001 mm（千分尺）
     毫米刻度尺：分度 1 mm，估读到 0.1 mm
     ——依据：2021 年北京卷“测量金属丝的电阻率”给出“电压表（0~3 V，内阻约 3 kΩ）、
       电流表（0~0.6 A，内阻约 0.1 Ω）”；2021 年福建卷给出螺旋测微器读数 1.414 mm
       （即 0.001 mm 位），欧姆挡“表盘中央刻度在 15~20 左右”。来源见文件末注释。

   1) resistivity  导体电阻率的测量
      R = ρL/S,  S = πd²/4   ⇒   ρ = R·S/L = π d² U / (4 L I)
      量纲：[ρ] = Ω·m²/m = Ω·m
      · 逐点法：每改变一次接入长度 L，读一组 (U, I) → R = U/I → ρ = πd²R/(4L)
      · 图线法：作 R–L 图线，斜率 k = 4ρ/(πd²) ⇒ ρ = kπd̄²/4（d̄ 为三次测量平均值）
      · 接法系统误差：电流表外接 R测 = R·Rv/(R+Rv)（偏小）；内接 R测 = R+Ra（偏大）
        图线法只取斜率，恒定附加电阻（内接的 Ra、接触电阻）只抬高截距，不影响斜率。
      · 发热：ΔT = K_h·I²R，ρ(T) = ρ₂₀[1+α(T−20℃)]，K_h = 80 K/W
        （按细丝自然对流 h ≈ 10 W/(m²·K)、表面积 A = πdl ≈ 1.1×10⁻³ m² 估算
         K = 1/(hA) ≈ 88 K/W，取 80 K/W 以计入引线导热；这是量级估计，不是实测值。
         它只让 ρ 偏大千分之几，方向永远不变——与教材“电流不宜过大、通电时间不宜过长”一致）
      材料常数（20℃）：铜 1.72×10⁻⁸ Ω·m（α=4.3×10⁻³/K）、铝 2.75×10⁻⁸（α=4.2×10⁻³/K）、
        镍铬合金 1.09×10⁻⁶（α=1.0×10⁻⁴/K）、康铜 5.0×10⁻⁷（α≈2×10⁻⁵/K）

   2) multimeter   练习使用多用电表（欧姆挡）
      欧姆挡 = 表内电池 E + 调零电阻 R0 + 表头串联：I = E/(RΩ + Rx)，RΩ 为欧姆表内阻。
      指针满偏（I = Ig）对应 0 Ω（表盘右端），I = 0 对应 ∞（左端）；
      指针指到中央时 I = Ig/2 ⇒ Rx = RΩ，故“表盘中央刻度值 × 倍率 = 该挡中值电阻 = RΩ”。
      本模块取表盘中央刻度 15 Ω（教材/真题通用值），倍率 1/10/100/1000。
      设表盘刻度值为 D，则指针偏转比例 f = 15/(15+D) ⇒ D = 15(1/f − 1)。
      调零后表内总电阻 Rin = 15·倍率·(E/E₀)，E₀ = 1.5 V 为表盘标定电动势：
        · 电池用旧（E < E₀）仍能调零，但读数 = Rx·E₀/E（偏大）
        · 未调零（表内等效电阻偏大 10%，短接时指针停在 0 Ω 右侧约 1.5 格）：
          读数 = Rx·E₀/E + 1.5×倍率（换挡后不重新调零 → 偏差随倍率放大）
      读数不确定度：把指针位置判读到满偏弧长的 δ = 0.4%，则
        |ΔR/R| = δ/(f(1−f))，在 f = 0.5（中值附近）最小 ⇒ “指针指在中值附近读数最准”。
      量纲：R、RΩ、Rx 均为 Ω；D 为表盘刻度值（Ω），测量值 = D × 倍率。

   3) emf-internal 测量电池的电动势和内阻
      闭合电路欧姆定律：U = E − I r，作 U–I 图线：纵轴截距 = E，斜率绝对值 = r。
      甲（电压表直接并在电池两端，电流表串在外电路，本实验应采用）：
        U = E − r(I + U/Rv) ⇒ U = E/(1+r/Rv) − I·r/(1+r/Rv)
        即 E测 = E/(1+r/Rv)、r测 = r/(1+r/Rv)，两者都略偏小（r/Rv ≈ 0.02%）
      乙（电流表串在电源一侧，电压表并在滑动变阻器两端）：
        U = E − I(r+Ra) ⇒ E测 = E（无误差）、r测 = r + Ra（偏大 Ra/r ≈ 20%）
        正因为干电池 r 很小而 Ra 与之可比、Rv ≫ r，实验才选甲图。
      量纲：[E] = V，[r] = V/A = Ω

   4) va-characteristic 描绘小灯泡的伏安特性曲线
      灯丝（钨）电阻随温度升高而增大：R(T) = R₀(T/T₀)^1.2（钨线性温度系数 α≈4.5×10⁻³/K，
      从 293 K 升到 2800 K 约 12 倍，与“冷电阻约为正常工作电阻的 1/10~1/15”相符）。
      热平衡：电功率 = 辐射散热，I²R(T) = A(T⁴ − T₀⁴)。
      由额定值反解灯丝常数：R₀ = R额/(T额/T₀)^1.2，A = U额I额/(T额⁴ − T₀⁴)。
      给定电压 U 时解 R₀(T/T₀)^1.2 · A(T⁴−T₀⁴) = U²（对 T 单调，二分法求解），
      再取 I = U/R(T)。结果：I–U 是一条过原点、斜率逐渐减小的曲线（电阻随 U 增大）。
      分压接法（滑动变阻器三端接线）才能让电压从 0 连续可调；灯泡电阻小，电流表外接。
      量纲：[U] = V，[I] = A，[R] = Ω，[P] = W

   ============================== 二、误差来源 ==============================
   每个实验的 conclude().errors 都由当前参数与数据现算（见各 conclude）；
   共同来源：电表估读（分度值的 1/10，按最小分度是否为 1、2、5 结尾决定估读位）、
   接线柱与导线电阻、接触电阻、读数时通电时间过长导致的温度漂移。
   ========================================================================== */
(function (window) {
  'use strict';

  /* ======================= 0. 器材常数（量纲见文件头） ======================= */
  var PI = Math.PI;

  var V_RANGE = 3.0,   /* 电压表量程 V */
      V_RES = 0.01,    /* 电压表估读位 V（0~3 V 挡最小分度 0.1 V） */
      V_RV = 3000;     /* 电压表内阻 Ω（约 3 kΩ） */

  var A_RANGE = 0.6,   /* 电流表量程 A */
      A_RES = 0.01,    /* 电流表估读位 A（0~0.6 A 挡最小分度 0.02 A → 估读到 0.01 A） */
      A_RA = 0.10;     /* 电流表内阻 Ω（约 0.1 Ω） */

  var MIC_RES = 0.001, /* 螺旋测微器估读位 mm */
      RULER_RES = 1e-4;/* 毫米刻度尺估读位 m（0.1 mm） */

  var READ_SIG = 0.30; /* 估读噪声 σ = 0.30 × 最小估读位（读数误差 ≤ 半个分度） */

  var K_HEAT = 80;     /* 电阻丝发热系数 K/W（1/(hA) 量级估计，见文件头） */
  var T0K = 293,       /* 室温 K */
      GAMMA = 1.2;     /* 钨丝电阻—温度幂律指数 */

  var OHM_MID = 15;    /* 欧姆挡表盘中央刻度（Ω） */
  var OHM_E0 = 1.5;    /* 表盘标定电动势 V */
  var OHM_DF = 0.004;  /* 指针位置判读误差（满偏弧长的比例） */
  var OHM_EPS = 0.10;  /* 未调零时表内等效电阻偏大的比例（短接指针停在 1.5 Ω 刻度） */

  /* 20℃ 电阻率与温度系数（来源见文件末注释） */
  var MATERIALS = [
    { name: '铜',      rho: 1.72e-8, alpha: 4.3e-3 },
    { name: '铝',      rho: 2.75e-8, alpha: 4.2e-3 },
    { name: '镍铬合金', rho: 1.09e-6, alpha: 1.0e-4 },
    { name: '康铜',    rho: 5.00e-7, alpha: 2.0e-5 }
  ];

  var OHM_RANGES = [1, 10, 100, 1000];
  var OHM_RANGE_TXT = ['×1', '×10', '×100', '×1k'];
  /* 欧姆挡表盘刻度线（示意，中值 15 Ω）：[刻度值, 该处最小可辨间隔] */
  var OHM_STEPS = [[0, 0.2], [2, 0.2], [5, 0.2], [10, 0.5], [15, 1], [20, 1],
                   [30, 2], [50, 5], [100, 10], [200, 20], [500, 50], [1000, 100]];
  var OHM_TICKS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 70,
                   100, 150, 200, 300, 500, 1000];

  /* 小灯泡规格：由额定值反解灯丝模型常数 */
  function mkBulb(name, Ur, Ir, Tr) {
    var Rr = Ur / Ir;
    var R0 = Rr / Math.pow(Tr / T0K, GAMMA);
    var A = (Ur * Ir) / (Math.pow(Tr, 4) - Math.pow(T0K, 4));
    return { name: name, Ur: Ur, Ir: Ir, Tr: Tr, Rr: Rr, R0: R0, A: A };
  }
  var BULBS = [
    mkBulb('2.5 V 0.3 A', 2.5, 0.30, 2800),
    mkBulb('3.8 V 0.3 A', 3.8, 0.30, 2800),
    mkBulb('2.5 V 0.75 A', 2.5, 0.75, 2900)
  ];

  /* 配色（与沙盒同一观感：米白纸 + 墨色） */
  var INK = '#26221C', RED = '#A6392A', BLUE = '#2B4C7E', GREEN = '#3F6B4B',
      GRAY = '#8C8578', GOLD = '#A8791F', PAPER = '#F4F1EA';

  /* ============================ 1. 通用工具 ============================ */
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function par(p, k, d) { return p ? num(p[k], d) : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pidx(p, k, d, hi) { return Math.round(clamp(par(p, k, d), 0, hi)); }
  function quant(v, step) { return step > 0 ? Math.round(v / step) * step : v; }

  function rndOf(ctx) {
    if (ctx && typeof ctx.rnd === 'function') {
      var v = ctx.rnd();
      if (typeof v === 'number' && isFinite(v) && v >= 0 && v < 1) return v;
    }
    return Math.random();
  }
  /* 标准正态扰动：优先用核心的 ctx.noise(σ)，缺失时用 Box–Muller 兜底 */
  function noiseOf(ctx, sigma) {
    if (!(sigma > 0)) return 0;
    if (ctx && typeof ctx.noise === 'function') {
      var n = ctx.noise(sigma);
      if (typeof n === 'number' && isFinite(n)) return n;
    }
    var u1 = rndOf(ctx), u2 = rndOf(ctx);
    if (!(u1 > 1e-12)) u1 = 1e-12;
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * PI * u2);
  }
  /* 一次量具读数：真值 + 估读噪声 → 量化到最小估读位 */
  function readOf(v, step, ctx) {
    return quant(v + noiseOf(ctx, step * READ_SIG), step);
  }

  var SUP = { '-': '\u207B', '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3',
              '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079' };
  function supDigits(n) {
    var s = String(n), out = '', i;
    for (i = 0; i < s.length; i++) out += (SUP[s.charAt(i)] || s.charAt(i));
    return out;
  }
  function fx(v, n) {
    if (!isFinite(v)) return '—';
    var s = v.toFixed(n === undefined ? 2 : n);
    if (/^-0(\.0*)?$/.test(s)) s = s.replace('-', '');
    return s;
  }
  function sci(v, n) {
    if (!isFinite(v)) return '—';
    if (v === 0) return '0';
    var e = Math.floor(Math.log(Math.abs(v)) / Math.LN10);
    var m = v / Math.pow(10, e);
    if (Math.abs(m) >= 10) { m /= 10; e += 1; }
    if (Math.abs(m) < 1) { m *= 10; e -= 1; }
    return m.toFixed(n === undefined ? 2 : n) + '×10' + supDigits(e);
  }
  function pct(v, n) { return (v >= 0 ? '+' : '') + fx(v, n === undefined ? 1 : n) + '%'; }

  /* 最小二乘 y = a + b·x，返回 {a,b,r2,n}；x 无方差时返回 null（r² 无定义） */
  function fitLine(pts) {
    var i, n = pts ? pts.length : 0, x, y;
    if (n < 2) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (i = 0; i < n; i++) {
      x = num(pts[i].x, 0); y = num(pts[i].y, 0);
      sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
    }
    var dx = n * sxx - sx * sx;
    if (Math.abs(dx) < 1e-14) return null;
    var b = (n * sxy - sx * sy) / dx;
    var a = (sy - b * sx) / n;
    var dy = n * syy - sy * sy;
    var r2 = (dy > 1e-15) ? (n * sxy - sx * sy) * (n * sxy - sx * sy) / (dx * dy) : null;
    return { a: a, b: b, r2: r2, n: n };
  }
  function meanOf(a) {
    var i, s = 0, n = a ? a.length : 0;
    if (!n) return 0;
    for (i = 0; i < n; i++) s += num(a[i], 0);
    return s / n;
  }
  function lastRow(rows) { return (rows && rows.length) ? rows[rows.length - 1] : null; }

  /* ============================ 2. 绘图工具 ============================ */
  /* 只用 g.c 画；虚拟坐标系固定 900×600，按画布大小等比缩放居中 */
  function makePen(g) {
    var w = num(g && g.w, 900), h = num(g && g.h, 600);
    var s = Math.min(w / 900, h / 600);
    if (!(s > 0)) s = 1;
    var P = {
      c: g.c, g: g, w: w, h: h, s: s,
      ox: (w - 900 * s) / 2, oy: (h - 600 * s) / 2,
      stroke: INK, lw: 1.8, dash: null, fill: null
    };
    P.X = function (u) { return P.ox + u * s; };
    P.Y = function (v) { return P.oy + v * s; };
    P.L = function (u) { return u * s; };
    return P;
  }
  function setPen(P, color, lw, dash, fill) {
    P.stroke = color || null;
    P.lw = lw || 1.8;
    P.dash = dash || null;
    P.fill = fill || null;
  }
  function stamp(P) {
    if (P.stroke) {
      P.c.strokeStyle = P.stroke;
      P.c.lineWidth = Math.max(0.7, P.lw * P.s);
      P.c.lineCap = 'round';
      P.c.lineJoin = 'round';
      if (P.dash) P.c.setLineDash([P.dash[0] * P.s, P.dash[1] * P.s]);
      else P.c.setLineDash([]);
    } else {
      P.c.setLineDash([]);
    }
  }
  function seg(P, x1, y1, x2, y2) {
    stamp(P);
    P.c.beginPath();
    P.c.moveTo(P.X(x1), P.Y(y1));
    P.c.lineTo(P.X(x2), P.Y(y2));
    if (P.fill) { P.c.fillStyle = P.fill; P.c.fill(); }
    if (P.stroke) P.c.stroke();
  }
  function poly(P, pts, close) {
    var i;
    if (!pts || pts.length < 2) return;
    stamp(P);
    P.c.beginPath();
    P.c.moveTo(P.X(pts[0][0]), P.Y(pts[0][1]));
    for (i = 1; i < pts.length; i++) P.c.lineTo(P.X(pts[i][0]), P.Y(pts[i][1]));
    if (close) P.c.closePath();
    if (P.fill) { P.c.fillStyle = P.fill; P.c.fill(); }
    if (P.stroke) P.c.stroke();
  }
  function disc(P, x, y, r, color) {
    P.c.setLineDash([]);
    P.c.beginPath();
    P.c.arc(P.X(x), P.Y(y), Math.max(0.4, P.L(r)), 0, 2 * PI, false);
    P.c.fillStyle = color || INK;
    P.c.fill();
  }
  function ring(P, x, y, r) {
    stamp(P);
    P.c.beginPath();
    P.c.arc(P.X(x), P.Y(y), Math.max(0.4, P.L(r)), 0, 2 * PI, false);
    if (P.fill) { P.c.fillStyle = P.fill; P.c.fill(); }
    if (P.stroke) P.c.stroke();
  }
  function box(P, x, y, w, h, r) {
    var c = P.c, rr;
    stamp(P);
    c.beginPath();
    if (!(r > 0)) {
      c.rect(P.X(x), P.Y(y), P.L(w), P.L(h));
    } else {
      rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2) * P.s;
      var x0 = P.X(x), y0 = P.Y(y), x1 = P.X(x + w), y1 = P.Y(y + h);
      c.moveTo(x0 + rr, y0);
      c.lineTo(x1 - rr, y0); c.quadraticCurveTo(x1, y0, x1, y0 + rr);
      c.lineTo(x1, y1 - rr); c.quadraticCurveTo(x1, y1, x1 - rr, y1);
      c.lineTo(x0 + rr, y1); c.quadraticCurveTo(x0, y1, x0, y1 - rr);
      c.lineTo(x0, y0 + rr); c.quadraticCurveTo(x0, y0, x0 + rr, y0);
      c.closePath();
    }
    if (P.fill) { c.fillStyle = P.fill; c.fill(); }
    if (P.stroke) c.stroke();
  }
  function txt(P, x, y, str, size, color, align, italic) {
    P.c.setLineDash([]);
    var f = size || 14, css = '';
    /* 优先用核心给的 g.font(size, style)（与其它组同一套字体），取不到就自己拼一个 */
    if (P.g && typeof P.g.font === 'function') {
      try { css = P.g.font(f * P.s, italic ? 'italic' : null); } catch (e) { css = ''; }
    }
    if (typeof css !== 'string' || css.indexOf('px') < 0) {
      css = (italic ? 'italic ' : '') + Math.max(6, f * P.s) +
        'px Georgia, "Times New Roman", "Songti SC", "SimSun", serif';
    }
    P.c.font = css;
    P.c.fillStyle = color || INK;
    P.c.textAlign = align || 'left';
    P.c.textBaseline = 'middle';
    P.c.fillText(str, P.X(x), P.Y(y));
  }
  function arrow(P, x1, y1, x2, y2, size) {
    var k = size || 7, ang = Math.atan2(y2 - y1, x2 - x1);
    seg(P, x1, y1, x2, y2);
    poly(P, [[x2, y2],
             [x2 - k * Math.cos(ang - 0.42), y2 - k * Math.sin(ang - 0.42)],
             [x2 - k * Math.cos(ang + 0.42), y2 - k * Math.sin(ang + 0.42)]], true);
  }
  /* 沿折线走：u∈[0,1) → 点坐标（用于电流小球动画） */
  function pathAt(pts, u) {
    var i, total = 0, want, acc = 0, dx, dy, d, t;
    for (i = 1; i < pts.length; i++) {
      total += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    }
    if (!(total > 0)) return [pts[0][0], pts[0][1]];
    want = clamp(u, 0, 0.999999) * total;
    for (i = 1; i < pts.length; i++) {
      dx = pts[i][0] - pts[i - 1][0];
      dy = pts[i][1] - pts[i - 1][1];
      d = Math.abs(dx) + Math.abs(dy);
      if (acc + d >= want) {
        t = d > 0 ? (want - acc) / d : 0;
        return [pts[i - 1][0] + dx * t, pts[i - 1][1] + dy * t];
      }
      acc += d;
    }
    return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  }
  function flow(P, pts, t, n, color) {
    var i, q;
    for (i = 0; i < n; i++) {
      q = pathAt(pts, ((t * 0.08) + i / n) % 1);
      disc(P, q[0], q[1], 3.2, color);
    }
  }

  /* --------------------------- 器材图形 --------------------------- */
  /* 电池组：长线 = 正极，短粗线 = 负极（沿 x 方向） */
  function batterySym(P, x, y, cells) {
    var i, long = 17, sh = 9;
    for (i = 0; i < cells; i++) {
      var cx = x + i * 26;
      seg(P, cx, y - long, cx, y + long);
      P.lw = 3.4; seg(P, cx + 9, y - sh, cx + 9, y + sh); P.lw = 1.8;
      if (i < cells - 1) seg(P, cx + 9, y, cx + 26, y);
    }
    seg(P, x - 14, y, x, y);
    seg(P, x + (cells - 1) * 26 + 9, y, x + (cells - 1) * 26 + 23, y);
  }
  /* 开关：两个接线柱 + 刀闸 */
  function switchSym(P, x, y, w, closed) {
    var i;
    seg(P, x - 12, y, x, y);
    seg(P, x + w, y, x + w + 12, y);
    for (i = 0; i < 2; i++) disc(P, x + i * w, y, 3.4, INK);
    if (closed) seg(P, x, y, x + w, y);
    else seg(P, x, y, x + w * 0.92, y - w * 0.62);
  }
  /* 表头：圆 + 刻度弧 + 指针 + 字母 + 读数 */
  function meterSym(P, x, y, r, letter, frac, valText, hot) {
    var a, i, tip;
    setPen(P, INK, 1.8, null, PAPER);
    ring(P, x, y, r);
    setPen(P, GRAY, 1.2, null, null);
    for (i = 0; i <= 10; i++) {
      a = (-140 + 10 * i) * PI / 180;
      seg(P, x + (r - 6) * Math.cos(a) * 0.78, y + (r - 6) * Math.sin(a) * 0.78,
          x + r * 0.90 * Math.cos(a), y + r * 0.90 * Math.sin(a));
    }
    a = (-140 + 100 * clamp(frac, 0, 1)) * PI / 180;
    tip = [x + r * 0.86 * Math.cos(a), y + r * 0.86 * Math.sin(a)];
    setPen(P, hot ? RED : INK, 2.2, null, null);
    seg(P, x, y, tip[0], tip[1]);
    disc(P, x, y, 2.6, hot ? RED : INK);
    txt(P, x, y + r * 0.42, letter, r * 0.95, BLUE, 'center', true);
    if (valText) txt(P, x, y + r + 15, valText, 13, INK, 'center');
  }
  /* 滑动变阻器（水平，限流接法：两个接线柱） */
  function rheostatH(P, x, y, w, h, frac, tag) {
    var sx = x + w * clamp(frac, 0, 1);
    setPen(P, INK, 1.8, null, PAPER);
    box(P, x, y - h / 2, w, h, 3);
    setPen(P, GRAY, 1.1, null, null);
    var i;
    for (i = 1; i < 10; i++) seg(P, x + w * i / 10, y - h / 2, x + w * i / 10, y + h / 2);
    setPen(P, INK, 1.8, null, null);
    disc(P, x, y, 3, INK);
    disc(P, x + w, y, 3, INK);
    arrow(P, sx, y - h / 2 - 26, sx, y - h / 2 - 3, 7);
    seg(P, sx - 12, y - h / 2 - 26, sx + 12, y - h / 2 - 26);
    txt(P, sx, y - h / 2 - 40, tag || 'P', 13, RED, 'center');
  }
  /* 滑动变阻器（竖直，分压接法：A、B 接电源两端，滑片 P 与 B 输出可调电压） */
  function rheostatV(P, x, yTop, yBot, w, frac) {
    var h = yBot - yTop, sy = yBot - h * clamp(frac, 0, 1), i;
    var xl = x - w / 2, xr = x + w / 2;
    setPen(P, INK, 1.8, null, PAPER);
    box(P, xl, yTop, w, h, 3);
    setPen(P, GRAY, 1.1, null, null);
    for (i = 1; i < 12; i++) seg(P, xl, yTop + h * i / 12, xr, yTop + h * i / 12);
    setPen(P, INK, 1.8, null, null);
    disc(P, xl, yTop, 3.4, INK);      /* 上端 A */
    disc(P, xl, yBot, 3.4, INK);      /* 下端 B */
    arrow(P, xr + 30, sy, xr + 3, sy, 7);
    disc(P, xr, sy, 4, RED);          /* 滑片 P 与电阻丝接触处 */
    txt(P, xl - 14, yTop - 12, 'A', 13, INK, 'center');
    txt(P, xl - 14, yBot + 14, 'B', 13, INK, 'center');
    txt(P, xr + 40, sy - 12, 'P', 13, RED, 'center');
  }
  /* 小灯泡（圆圈内一个 ×，中国教材符号）+ 发光光晕 */
  function lampSym(P, x, y, r, glow) {
    var k = r * 0.62, i;
    if (glow > 0.01) {
      var gd = P.c.createRadialGradient(P.X(x), P.Y(y), P.L(r * 0.4),
                                        P.X(x), P.Y(y), P.L(r * (1.9 + 2.2 * glow)));
      gd.addColorStop(0, 'rgba(255,214,120,' + fx(0.55 * Math.min(glow, 1), 2) + ')');
      gd.addColorStop(0.55, 'rgba(255,196,80,' + fx(0.22 * Math.min(glow, 1), 2) + ')');
      gd.addColorStop(1, 'rgba(255,196,80,0)');
      P.c.setLineDash([]);
      P.c.fillStyle = gd;
      P.c.beginPath();
      P.c.arc(P.X(x), P.Y(y), P.L(r * (1.9 + 2.2 * glow)), 0, 2 * PI, false);
      P.c.fill();
    }
    setPen(P, INK, 1.9, null, PAPER);
    ring(P, x, y, r);
    setPen(P, glow > 0.35 ? GOLD : INK, 1.6, null, null);
    seg(P, x - k, y - k, x + k, y + k);
    seg(P, x - k, y + k, x + k, y - k);
    for (i = 0; i < 8; i++) {
      var a = i * PI / 4;
      if (glow > 0.05) {
        setPen(P, 'rgba(168,121,31,' + fx(0.25 + 0.6 * Math.min(glow, 1), 2) + ')', 1.5, null, null);
        seg(P, x + r * 1.18 * Math.cos(a), y + r * 1.18 * Math.sin(a),
            x + r * (1.45 + 0.2 * glow) * Math.cos(a), y + r * (1.45 + 0.2 * glow) * Math.sin(a));
      }
    }
    setPen(P, INK, 1.8, null, null);
  }
  /* 毫米刻度尺（横放） */
  function ruler(P, x, y, w, cmSpan, label) {
    var i, n = cmSpan * 10;
    setPen(P, INK, 1.6, null, PAPER);
    box(P, x, y, w, 34, 2);
    setPen(P, GRAY, 1.1, null, null);
    for (i = 0; i <= n; i++) {
      var xx = x + w * i / n, big = (i % 10 === 0), mid = (i % 5 === 0);
      seg(P, xx, y, xx, y + (big ? 20 : (mid ? 14 : 9)));
      if (big && i > 0 && i < n) txt(P, xx, y + 27, String(i / 10), 10, GRAY, 'center');
    }
    if (label) txt(P, x + w / 2, y + 46, label, 13, INK, 'center', true);
  }
  /* 螺旋测微器（固定套筒 + 微分筒圆刻度） */
  function micrometerSym(P, x, y, dmm) {
    var pxmm = 60, whole = Math.floor(dmm * 2) / 2, frac = dmm - whole;
    var edge = x + dmm * pxmm, i, a;
    /* 尺架（C 形示意） */
    setPen(P, INK, 2, null, PAPER);
    box(P, x - 46, y - 44, 34, 88, 4);
    box(P, x - 12, y - 12, 26, 24, 3);
    /* 固定套筒 */
    setPen(P, INK, 1.6, null, PAPER);
    box(P, x, y - 15, 140, 30, 2);
    setPen(P, GRAY, 1.1, null, null);
    for (i = 0; i <= 4; i++) {                 /* 每 0.5 mm 一条刻线 */
      var xx = x + i * 0.5 * pxmm;
      seg(P, xx, y - 15, xx, y - 15 + (i % 2 === 0 ? 16 : 10));
    }
    for (i = 1; i <= 2; i++) txt(P, x + i * pxmm, y + 7, String(i), 10, GRAY, 'center');
    txt(P, x + 70, y + 30, '固定套筒 (mm)', 11, GRAY, 'center');
    /* 微分筒（左边缘对着读数位置） */
    setPen(P, INK, 1.6, null, PAPER);
    box(P, edge, y - 19, 92, 38, 8);
    setPen(P, GRAY, 1.1, null, null);
    for (i = 0; i < 10; i++) seg(P, edge + 8 + i * 8, y - 19, edge + 8 + i * 8, y - 11);
    txt(P, edge + 46, y + 33, '微分筒 (50 格)', 11, GRAY, 'center');
    /* 微分筒圆刻度 */
    var ccx = x + 250, ccy = y + 4, cr = 40;
    setPen(P, INK, 1.6, null, PAPER);
    ring(P, ccx, ccy, cr);
    for (i = 0; i < 50; i++) {
      a = (-90 + i * 360 / 50) * PI / 180;
      var len = (i % 5 === 0) ? 9 : 5;
      seg(P, ccx + (cr - len) * Math.cos(a), ccy + (cr - len) * Math.sin(a),
          ccx + cr * Math.cos(a), ccy + cr * Math.sin(a));
    }
    for (i = 0; i < 5; i++) {
      a = (-90 + i * 72) * PI / 180;
      txt(P, ccx + (cr - 20) * Math.cos(a), ccy + (cr - 20) * Math.sin(a),
          String(i * 10), 10, GRAY, 'center');
    }
    a = (-90 + (frac / 0.01) * 360 / 50) * PI / 180;   /* frac/0.01 = 微分格数 */
    setPen(P, RED, 2, null, null);
    seg(P, ccx, ccy, ccx + cr * Math.cos(a), ccy + cr * Math.sin(a));
    disc(P, ccx, ccy, 2.4, RED);
    txt(P, ccx, ccy + cr + 18, '微分读数 ' + fx(frac / 0.01, 1) + ' 格',
        12, RED, 'center', true);
  }
  /* 红色/黑色表笔 */
  function probeSym(P, x, y, ang, color, label) {
    var dx = Math.cos(ang), dy = Math.sin(ang), len = 62;
    setPen(P, color, 5, null, null);
    seg(P, x, y, x + dx * len * 0.72, y + dy * len * 0.72);
    setPen(P, GRAY, 3.4, null, null);
    seg(P, x + dx * len * 0.72, y + dy * len * 0.72, x + dx * len, y + dy * len);
    txt(P, x - dx * 16, y - dy * 16 - 12, label, 12, color, 'center');
  }

  /* ========================= 3. 阻值—参数解算 ========================= */
  /* 导体电阻率：由参数解出真值（不含读数误差）；measure 与 draw 共用同一模型 */
  function resSolve(p) {
    var mi = pidx(p, 'mat', 2, MATERIALS.length - 1);
    var m = MATERIALS[mi];
    var L = clamp(par(p, 'L', 0.600), 0.05, 1.5);
    var dmm = clamp(par(p, 'd', 0.600), 0.05, 3);
    var I = clamp(par(p, 'I', 0.30), 0.02, A_RANGE);
    var conn = pidx(p, 'conn', 0, 1);
    var zoff = clamp(par(p, 'zoff', 0), -0.05, 0.05);
    var dt = dmm * 1e-3, S = PI * dt * dt / 4;
    var R20 = m.rho * L / S;                       /* 20℃ 时的电阻 */
    var dT = K_HEAT * I * I * R20;                 /* 发热温升 K（量级估计） */
    var Rwire = R20 * (1 + m.alpha * dT);          /* 发热后的真电阻 Ω */
    var Rmeas = (conn === 0) ? (Rwire * V_RV / (Rwire + V_RV)) : (Rwire + A_RA);
    return { mi: mi, m: m, L: L, dmm: dmm, I: I, conn: conn, zoff: zoff,
             S: S, R20: R20, dT: dT, Rwire: Rwire, Rmeas: Rmeas,
             Utrue: I * Rmeas };
  }

  function drawResistivity(g, p, state) {
    if (!g || !g.c) return;
    var P = makePen(g);
    p = p || {}; state = state || {};
    var S = resSolve(p), rows = state.rows || [], lr = lastRow(rows);
    var t = num(state.t, 0), run = !!state.running;
    var U = lr ? lr.U : S.Utrue, I = lr ? lr.I : S.I;
    var R = lr ? lr.R : S.Rmeas, d = lr ? lr.d : S.dmm;
    var rho = lr ? lr.rho : S.m.rho;
    var i, x0 = 340, x1 = 620, wpx = x1 - x0, scale = wpx / 1.0;   /* 1 m 对应 280 px */
    var tlm = num(state.t, 0);

    txt(P, 30, 30, '导体电阻率的测量', 20, INK, 'left', true);
    txt(P, 30, 54, 'ρ = R·S/L = πd²U/(4LI)   材料：' + S.m.name +
        '   接法：' + (S.conn === 0 ? '电流表外接' : '电流表内接'), 13, GRAY);

    /* ---- 主回路 ---- */
    setPen(P, INK, 2.2, null, null);
    seg(P, 90, 150, 90, 380);          /* 左轨 */
    seg(P, 810, 150, 810, 380);        /* 右轨 */
    seg(P, 90, 150, 166, 150);         /* 上轨左段 */
    seg(P, 234, 150, x0, 150);
    seg(P, x1, 150, 660, 150);
    seg(P, 800, 150, 810, 150);
    seg(P, 90, 380, 236, 380);         /* 下轨 */
    seg(P, 285, 380, 520, 380);
    seg(P, 574, 380, 810, 380);

    /* 电池组 + 开关 */
    batterySym(P, 250, 380, 2);
    txt(P, 250, 340, '学生电源 E', 12, GRAY, 'center');
    switchSym(P, 520, 380, 54, true);
    txt(P, 547, 352, 'S', 13, INK, 'center');

    /* 电流表 */
    meterSym(P, 200, 150, 34, 'A', clamp(I / A_RANGE, 0, 1), fx(I, 2) + ' A', run);

    /* 电阻丝（方框 + 斜纹）+ 刻度尺 */
    setPen(P, INK, 2, null, PAPER);
    box(P, x0, 138, wpx, 24, 3);
    setPen(P, GRAY, 1.1, null, null);
    for (i = 0; i < 26; i++) seg(P, x0 + 6 + i * 10, 160, x0 + 16 + i * 10, 140);
    setPen(P, INK, 1.8, null, null);
    disc(P, x0, 150, 3, INK); disc(P, x1, 150, 3, INK);
    txt(P, 480, 118, '电阻丝 R（' + S.m.name + '，d = ' + fx(S.dmm, 3) + ' mm）', 13, INK, 'center');
    ruler(P, x0 + 20, 172, wpx - 40, 10, null);
    /* 接入长度标注 */
    var lx = x0 + 20 + S.L * (wpx - 40) / 1.0;
    setPen(P, RED, 2, null, null);
    seg(P, x0 + 20, 189, lx, 189);
    disc(P, x0 + 20, 189, 2.6, RED); disc(P, lx, 189, 2.6, RED);
    txt(P, (x0 + 20 + lx) / 2, 224, '接入长度 L = ' + fx(S.L, 3) + ' m', 12, RED, 'center');

    /* 电压表：外接并在电阻丝两端；内接把左端引到电流表左侧 */
    var vLeft = (S.conn === 0) ? x0 : 140;
    setPen(P, BLUE, 1.6, [6, 5], null);
    seg(P, vLeft, 150, vLeft, 265);
    seg(P, vLeft, 265, 448, 265);
    seg(P, 512, 265, x1, 265);
    seg(P, x1, 265, x1, 150);
    meterSym(P, 480, 265, 32, 'V', clamp(U / V_RANGE, 0, 1), fx(U, 2) + ' V', run);
    txt(P, vLeft, 240, S.conn === 0 ? '并在电阻丝两端' : '含电流表（内接）', 11, BLUE,
        S.conn === 0 ? 'center' : 'left');
    txt(P, x1 + 6, 290, '电压表 Rv ≈ 3 kΩ', 11, BLUE, 'left');

    /* 滑动变阻器 */
    rheostatH(P, 660, 150, 140, 30, clamp(I / 0.6, 0.05, 1), 'P');
    txt(P, 730, 106, '滑动变阻器（限流）', 12, INK, 'center');

    /* 电流小球动画：开关闭合即通电，所以一直在动（「开始」后走得更快）。
       暂停时也让小球随时间挪动，这样 run(1) 之后画面签名一定有变化。 */
    var tt = run ? tlm : tlm * 0.4;
    flow(P, [[90, 380], [90, 150], [166, 150]], tt, 4, 'rgba(166,57,42,0.85)');
    flow(P, [[234, 150], [x0, 150]], tt, 2, 'rgba(166,57,42,0.85)');
    flow(P, [[x1, 150], [660, 150], [800, 150], [810, 150], [810, 380], [574, 380]],
         tt, 6, 'rgba(166,57,42,0.85)');

    /* ---- 螺旋测微器 ---- */
    txt(P, 30, 434, '螺旋测微器测直径（三个不同位置各测一次，取平均）', 13, INK, 'left');
    micrometerSym(P, 96, 480, d);

    /* ---- 读数卡 ---- */
    setPen(P, GRAY, 1.2, null, 'rgba(255,255,255,0.45)');
    box(P, 430, 420, 440, 160, 6);
    setPen(P, INK, 1.8, null, null);
    txt(P, 446, 444, lr ? '最近一组记录' : '表头指示（尚未记录）', 13, GRAY);
    txt(P, 446, 470, '电流表读数 I = ' + fx(I, 2) + ' A', 14, INK);
    txt(P, 446, 494, '电压表读数 U = ' + fx(U, 2) + ' V', 14, INK);
    txt(P, 446, 518, 'R = U/I = ' + fx(R, 3) + ' Ω', 14, RED);
    txt(P, 446, 542, 'd̄ = ' + fx(d, 3) + ' mm   S = ' + sci(PI * Math.pow(d * 1e-3, 2) / 4, 2) + ' m²', 13, INK);
    txt(P, 446, 566, 'ρ = RS/L = ' + sci(rho, 3) + ' Ω·m', 14, GREEN);
    txt(P, 700, 444, 'ΔT ≈ ' + fx(S.dT, 1) + ' K', 12, GRAY);
  }

  /* ========================= 4. 多用电表（欧姆挡） ========================= */
  /* 指针偏转比例 f = I/Ig = Rin/(RinA + Rx) */
  function ohmSolve(p) {
    var ri = pidx(p, 'range', 0, OHM_RANGES.length - 1);
    var mult = OHM_RANGES[ri];
    var Rx = clamp(par(p, 'Rx', 30), 0.5, 20000);
    var E = clamp(par(p, 'E', 1.50), 0.9, 1.7);
    var zero = pidx(p, 'zero', 1, 1);
    var Rmid = OHM_MID * mult;                        /* 该挡中值电阻 Ω */
    var Rin = Rmid * (E / OHM_E0);                    /* 正确调零后的表内总电阻 Ω */
    var eps = (zero === 1) ? 0 : OHM_EPS;             /* 未调零：表内等效电阻偏大 */
    var RinA = Rin * (1 + eps);
    var f = clamp(Rin / (RinA + Rx), 1e-6, 1 - 1e-9);
    var D = OHM_MID * (1 / f - 1);                    /* 表盘刻度读数（Ω@刻度） */
    var relU = clamp(OHM_DF / (f * (1 - f)), 0, 0.5);
    return { ri: ri, mult: mult, Rx: Rx, E: E, zero: zero, Rmid: Rmid,
             Rin: Rin, eps: eps, f: f, D: D, relU: relU };
  }
  function dialStep(D) {
    var i;
    if (D <= OHM_STEPS[0][0]) return OHM_STEPS[0][1];
    for (i = 1; i < OHM_STEPS.length; i++) {
      if (D < OHM_STEPS[i][0]) return OHM_STEPS[i - 1][1];
    }
    return OHM_STEPS[OHM_STEPS.length - 1][1];
  }
  /* 表盘刻度值 → 指针角度（度，数学习惯，逆时针为正）：D = 15 ⇒ 90°）
     f = 15/(15+D) ⇒ A = 10 + 160(1−f) */
  function dialAngle(D) { return 10 + 160 * (1 - OHM_MID / (OHM_MID + D)); }

  function drawMultimeter(g, p, state) {
    if (!g || !g.c) return;
    var P = makePen(g);
    p = p || {}; state = state || {};
    var S = ohmSolve(p), rows = state.rows || [], lr = lastRow(rows);
    var t = num(state.t, 0), run = !!state.running;
    var i, f = S.f, cx = 430, cy = 372, r = 186;
    var A, px, py;
    txt(P, 30, 30, '练习使用多用电表（欧姆挡）', 20, INK, 'left', true);
    txt(P, 30, 54, '指针满偏（I = Ig）为 0 Ω（右端），I = 0 为 ∞（左端）；' +
        '指针指中央时 Rx = RΩ（中值电阻）', 13, GRAY);

    /* 表盘弧 + 刻度 */
    setPen(P, INK, 2, null, null);
    for (i = 0; i <= 72; i++) {
      A = (10 + 160 * i / 72) * PI / 180;
      px = cx + r * Math.cos(A); py = cy - r * Math.sin(A);
      if (i === 0) { P.c.beginPath(); P.c.moveTo(P.X(px), P.Y(py)); }
      else P.c.lineTo(P.X(px), P.Y(py));
    }
    P.c.stroke();
    setPen(P, INK, 1.4, null, null);
    for (i = 0; i < OHM_TICKS.length; i++) {
      var D0 = OHM_TICKS[i], a0 = dialAngle(D0) * PI / 180;
      var long = (D0 === 15 || D0 === 0 || D0 % 100 === 0);
      seg(P, cx + r * Math.cos(a0), cy - r * Math.sin(a0),
          cx + (r - (long ? 15 : 9)) * Math.cos(a0), cy - (r - (long ? 15 : 9)) * Math.sin(a0));
      if (i % 2 === 0 || D0 === 15) {
        txt(P, cx + (r - 30) * Math.cos(a0), cy - (r - 30) * Math.sin(a0),
            D0 >= 1000 ? (D0 / 1000) + 'k' : String(D0),
            D0 === 15 ? 13 : 11, D0 === 15 ? RED : GRAY, 'center');
      }
    }
    /* 两端标注 */
    txt(P, cx + r * 0.72, cy + 34, '0 Ω（欧姆零点）', 12, GREEN, 'center');
    txt(P, cx - r * 0.78, cy + 34, '∞', 14, INK, 'center');
    txt(P, cx, cy + 60, '机械零点在左端（∞ 处）', 11, GRAY, 'center');
    /* 中值刻度高亮 */
    var am = dialAngle(OHM_MID) * PI / 180;
    setPen(P, RED, 1.6, [5, 4], null);
    seg(P, cx, cy, cx + (r - 6) * Math.cos(am), cy - (r - 6) * Math.sin(am));
    txt(P, cx - 30, 172, '中值刻度 15 Ω ⇒ R中 = 15 Ω × 倍率 = ' + fx(S.Rmid, 0) +
        ' Ω（= 表内阻）', 13, RED, 'center');

    /* 指针 */
    A = dialAngle(S.D) * PI / 180;
    setPen(P, RED, 2.4, null, null);
    seg(P, cx - 16 * Math.cos(A), cy + 16 * Math.sin(A),
        cx + (r - 20) * Math.cos(A), cy - (r - 20) * Math.sin(A));
    setPen(P, INK, 1.6, null, PAPER);
    ring(P, cx, cy, 12);
    disc(P, cx, cy, 3, INK);

    /* 选择开关（倍率挡） */
    var kx = 130, ky = 500;
    setPen(P, INK, 1.8, null, PAPER);
    ring(P, kx, ky, 34);
    for (i = 0; i < OHM_RANGES.length; i++) {
      A = (140 - i * 52) * PI / 180;
      seg(P, kx, ky, kx + 30 * Math.cos(A), ky - 30 * Math.sin(A));
      txt(P, kx + 52 * Math.cos(A), ky - 52 * Math.sin(A), OHM_RANGE_TXT[i], 12,
          i === S.ri ? RED : GRAY, 'center');
    }
    setPen(P, RED, 2.6, null, null);
    A = (140 - S.ri * 52) * PI / 180;
    seg(P, kx, ky, kx + 56 * Math.cos(A), ky - 56 * Math.sin(A));
    txt(P, kx, ky + 58, '选择开关', 12, GRAY, 'center');

    /* 表笔与待测电阻 */
    setPen(P, INK, 1.8, null, PAPER);
    box(P, 800, 452, 60, 74, 4);
    txt(P, 830, 440, '被测电阻', 12, INK, 'center');
    txt(P, 830, 489, fx(S.Rx, 0) + ' Ω', 14, RED, 'center');
    probeSym(P, 660, 468, 0, RED, '红');
    probeSym(P, 660, 510, 0, INK, '黑');
    seg(P, 722, 468, 800, 468);
    seg(P, 722, 510, 800, 510);
    txt(P, 655, 540, '红表笔接表内电池负极（电流红进黑出）', 11, GRAY, 'left');

    /* 读数说明 */
    setPen(P, GRAY, 1.2, null, 'rgba(255,255,255,0.5)');
    box(P, 590, 60, 282, 150, 6);
    setPen(P, INK, 1.6, null, null);
    txt(P, 604, 84, '表盘刻度读数 D = ' + fx(S.D, 1), 14, INK);
    txt(P, 604, 110, 'R = D × 倍率 = ' + fx(S.D, 1) + ' × ' + S.mult + ' = ' +
        fx(lr ? lr.R : S.D * S.mult, 1) + ' Ω', 14, RED);
    txt(P, 604, 136, '指针偏转 f = ' + fx(S.f, 3) + '（中值 0.5）', 13, INK);
    txt(P, 604, 160, '读数相对不确定度 ≈ ' + fx(S.relU * 100, 1) + '%', 13,
        S.relU < 0.05 ? GREEN : RED);
    txt(P, 604, 184, '调零：' + (S.zero === 1 ? '已调准' : '未调准（短接停在 1.5 Ω 刻度）') +
        '；电池 E = ' + fx(S.E, 2) + ' V', 12,
        S.zero === 1 && Math.abs(S.E - OHM_E0) < 0.005 ? GREEN : RED);
    if (run) flow(P, [[660, 468], [722, 468], [722, 510], [660, 510]], t, 5, 'rgba(166,57,42,0.8)');
    else flow(P, [[660, 468], [722, 468], [722, 510], [660, 510]], t * 0.4, 5, 'rgba(166,57,42,0.45)');
  }

  /* ===================== 5. 电池电动势与内阻 ===================== */
  /* 参数 I = 学生调节滑动变阻器使电流表指到的读数（目标值取 0.05 A 的整数倍，落在分度 0.02 A 的格线上）。
     甲（电压表接电池两端）：U = (E − r·I)/(1 + r/Rv)，由 U = I(Rext+Ra) 反解 Rext = U/I − Ra；
     乙（电流表串电源侧）：Rp = E/I − r − Ra，Rext = Rp·Rv/(Rv − Rp)，U = I·Rp。 */
  function emfSolve(p) {
    var E = clamp(par(p, 'E', 1.50), 1.0, 2.0);
    var r = clamp(par(p, 'r', 0.50), 0.05, 3.0);
    var It = clamp(par(p, 'I', 0.25), 0.05, A_RANGE);
    var conn = pidx(p, 'conn', 0, 1);
    var U, R, Rp;
    if (conn === 0) {
      U = (E - r * It) / (1 + r / V_RV);
      R = clamp(U / It - A_RA, 0.02, 500);
    } else {
      Rp = clamp(E / It - r - A_RA, 0.02, V_RV * 0.9);
      R = clamp(Rp * V_RV / (V_RV - Rp), 0.02, 5000);
      U = It * Rp;
    }
    return { E: E, r: r, It: It, R: R, conn: conn, U: U, I: It };
  }
  /* 迷你坐标图：数据点 + 可选拟合线 */
  function miniPlot(P, x, y, w, h, pts, opt) {
    opt = opt || {};
    var i, n = pts ? pts.length : 0;
    var xmax = num(opt.xMax, 0), ymax = num(opt.yMax, 0);
    for (i = 0; i < n; i++) {
      xmax = Math.max(xmax, pts[i].x * 1.12);
      ymax = Math.max(ymax, pts[i].y * 1.12);
    }
    if (!(xmax > 0)) xmax = 1;
    if (!(ymax > 0)) ymax = 1;
    var SX = function (v) { return x + w * clamp(v / xmax, 0, 1); };
    var SY = function (v) { return y + h - h * clamp(v / ymax, 0, 1); };
    setPen(P, GRAY, 1.2, null, 'rgba(255,255,255,0.55)');
    box(P, x, y, w, h, 3);
    setPen(P, GRAY, 1, [4, 4], null);
    for (i = 1; i < 4; i++) seg(P, x + w * i / 4, y, x + w * i / 4, y + h);
    for (i = 1; i < 4; i++) seg(P, x, y + h * i / 4, x + w, y + h * i / 4);
    if (opt.fit && n >= 2) {
      var fit = fitLine(pts);
      if (fit) {
        setPen(P, BLUE, 1.8, null, null);
        seg(P, SX(0), SY(clamp(fit.a, 0, ymax)), SX(xmax), SY(clamp(fit.a + fit.b * xmax, 0, ymax)));
      }
    }
    setPen(P, RED, 1.6, null, null);
    for (i = 0; i < n; i++) disc(P, SX(pts[i].x), SY(pts[i].y), 3.4, RED);
    setPen(P, INK, 1.4, null, null);
    seg(P, x, y + h, x + w, y + h);
    seg(P, x, y, x, y + h);
    txt(P, x + w / 2, y + h + 16, num(opt.xLab, 'x'), 11, GRAY, 'center');
    txt(P, x - 8, y + 8, num(opt.yLab, 'y'), 11, GRAY, 'right');
    txt(P, x + w, y + h + 16, fx(xmax, 2), 10, GRAY, 'right');
    txt(P, x - 6, y - 8, fx(ymax, 2), 10, GRAY, 'right');
  }

  function drawEmf(g, p, state) {
    if (!g || !g.c) return;
    var P = makePen(g);
    p = p || {}; state = state || {};
    var S = emfSolve(p), rows = state.rows || [], lr = lastRow(rows);
    var U = lr ? lr.U : S.U, I = lr ? lr.I : S.I, t = num(state.t, 0), run = !!state.running;
    var i, pts = [];
    for (i = 0; i < rows.length; i++) pts.push({ x: rows[i].I, y: rows[i].U });
    txt(P, 30, 30, '测量电池的电动势和内阻', 20, INK, 'left', true);
    txt(P, 30, 54, 'U = E − I r    U–I 图线：纵轴截距 = E，斜率绝对值 = r', 13, GRAY);

    /* 主回路 */
    setPen(P, INK, 2.2, null, null);
    seg(P, 130, 400, 130, 140);
    seg(P, 130, 140, 236, 140);
    seg(P, 304, 140, 620, 140);
    seg(P, 740, 140, 800, 140);
    seg(P, 800, 140, 800, 400);
    seg(P, 800, 400, 586, 400);
    seg(P, 508, 400, 343, 400);
    seg(P, 306, 400, 130, 400);

    /* 电池（干电池，虚线框标出内阻 r） */
    batterySym(P, 320, 400, 1);
    setPen(P, BLUE, 1.4, [5, 4], null);
    box(P, 296, 366, 92, 68, 5);
    txt(P, 342, 444, '干电池 E = ' + fx(S.E, 2) + ' V, r = ' + fx(S.r, 2) + ' Ω',
        12, BLUE, 'center');
    switchSym(P, 520, 400, 54, true);
    txt(P, 547, 372, 'S', 13, INK, 'center');

    /* 电流表 */
    meterSym(P, 270, 140, 34, 'A', clamp(I / A_RANGE, 0, 1), fx(I, 2) + ' A', run);

    /* 滑动变阻器 */
    rheostatH(P, 620, 140, 120, 30, clamp(S.R / 20, 0.05, 1), 'P');
    txt(P, 680, 96, '滑动变阻器 R', 12, INK, 'center');

    /* 电压表：甲接电池两端，乙接变阻器两端 */
    if (S.conn === 0) {
      setPen(P, BLUE, 1.6, [6, 5], null);
      seg(P, 306, 400, 306, 300);
      seg(P, 369, 400, 369, 300);
      setPen(P, INK, 1.6, null, null);
      disc(P, 306, 400, 3, INK); disc(P, 369, 400, 3, INK);
      meterSym(P, 337, 300, 31, 'V', clamp(U / V_RANGE, 0, 1), fx(U, 2) + ' V', run);
      txt(P, 337, 348, '甲：电压表直接并在电池两端', 12, BLUE, 'center');
    } else {
      setPen(P, BLUE, 1.6, [6, 5], null);
      seg(P, 600, 140, 600, 250);
      seg(P, 600, 250, 648, 250);
      seg(P, 712, 250, 760, 250);
      seg(P, 760, 250, 760, 140);
      setPen(P, INK, 1.6, null, null);
      disc(P, 600, 140, 3, INK); disc(P, 760, 140, 3, INK);
      meterSym(P, 680, 250, 32, 'V', clamp(U / V_RANGE, 0, 1), fx(U, 2) + ' V', run);
      txt(P, 680, 298, '乙：电压表并在变阻器两端', 12, BLUE, 'center');
    }

    var te = run ? t : t * 0.4;
    flow(P, [[130, 400], [130, 140], [236, 140]], te, 3, 'rgba(166,57,42,0.85)');
    flow(P, [[304, 140], [620, 140], [740, 140], [800, 140], [800, 400], [586, 400]],
         te, 6, 'rgba(166,57,42,0.85)');

    /* 读数 + 数据点图 */
    setPen(P, GRAY, 1.2, null, 'rgba(255,255,255,0.5)');
    box(P, 130, 462, 400, 122, 6);
    setPen(P, INK, 1.6, null, null);
    txt(P, 146, 480, lr ? ('最近一组：I = ' + fx(I, 2) + ' A, U = ' + fx(U, 2) + ' V')
                        : '尚未记录数据（点「📏 测量一次」）', 13, INK);
    var f = fitLine(pts);
    if (f && f.r2 !== null) {
      txt(P, 146, 501, 'E测 = ' + fx(f.a, 3) + ' V（真值 ' + fx(S.E, 2) + ' V，' +
          pct((f.a - S.E) / S.E * 100, 2) + '）', 13, RED);
      txt(P, 146, 522, 'r测 = ' + fx(-f.b, 3) + ' Ω（真值 ' + fx(S.r, 2) + ' Ω，' +
          pct((-f.b - S.r) / S.r * 100, 1) + '）', 13, RED);
      txt(P, 146, 543, '相关系数 r² = ' + fx(f.r2, 4) + '（' + pts.length + ' 组数据）', 12, GREEN);
    } else {
      txt(P, 146, 501, '至少记录 2 组不同电流的数据才能作图求 E、r', 12, GRAY);
    }
    txt(P, 146, 566, '甲图误差 ≈ r/Rv = ' + fx(S.r / V_RV * 100, 3) +
        '%，乙图误差 ≈ Ra/r = ' + fx(A_RA / S.r * 100, 1) + '%', 12, GRAY);
    miniPlot(P, 570, 430, 300, 150, pts,
             { xLab: 'I / A', yLab: 'U / V', fit: true, xMax: 0.6, yMax: 1.6 });
  }

  /* ===================== 6. 小灯泡的伏安特性曲线 ===================== */
  /* 解 I²R(T) = A(T⁴−T₀⁴)（对 T 单调，二分法），R(T) = R₀(T/T₀)^1.2 */
  function filamentT(bulb, U) {
    var lo = T0K, hi = 3200, i, mid = T0K, F;
    if (!(U > 0)) return { T: T0K, R: bulb.R0, I: 0 };
    for (i = 0; i < 60; i++) {
      mid = (lo + hi) / 2;
      F = bulb.R0 * Math.pow(mid / T0K, GAMMA) * bulb.A * (Math.pow(mid, 4) - Math.pow(T0K, 4));
      if (F < U * U) lo = mid; else hi = mid;
    }
    var R = bulb.R0 * Math.pow(mid / T0K, GAMMA);
    return { T: mid, R: R, I: U / R };
  }
  function vaSolve(p) {
    var bi = pidx(p, 'bulb', 0, BULBS.length - 1);
    var bulb = BULBS[bi];
    var Ut = clamp(par(p, 'U', 1.00), 0, V_RANGE);
    var conn = pidx(p, 'conn', 0, 1);
    var i, Ul = Ut, st = filamentT(bulb, Ul);
    if (conn === 1) {                       /* 内接：电压表读数含电流表分压 → 反解灯泡电压 */
      for (i = 0; i < 8; i++) {
        st = filamentT(bulb, Ul);
        Ul = clamp(Ut - st.I * A_RA, 0, V_RANGE);
      }
    }
    st = filamentT(bulb, Ul);
    var Umeas = (conn === 1) ? (Ul + st.I * A_RA) : Ul;
    var Imeas = (conn === 0) ? (st.I + Ul / V_RV) : st.I;   /* 外接：电流表含电压表分流 */
    return { bi: bi, bulb: bulb, Ut: Ut, conn: conn, Ul: Ul, T: st.T,
             Rlamp: st.R, Ilamp: st.I, Umeas: Umeas, Imeas: Imeas,
             P: Ul * st.I, glow: clamp(Ul * st.I / (bulb.Ur * bulb.Ir), 0, 1.6) };
  }

  function drawVA(g, p, state) {
    if (!g || !g.c) return;
    var P = makePen(g);
    p = p || {}; state = state || {};
    var S = vaSolve(p), rows = state.rows || [], lr = lastRow(rows);
    var U = lr ? lr.U : S.Umeas, I = lr ? lr.I : S.Imeas;
    var t = num(state.t, 0), run = !!state.running, i;
    var yP = 430 - 300 * clamp(S.Ut / V_RANGE, 0, 1);
    var pts = [];
    for (i = 0; i < rows.length; i++) pts.push({ x: rows[i].U, y: rows[i].I });

    txt(P, 30, 30, '描绘小灯泡的伏安特性曲线', 20, INK, 'left', true);
    txt(P, 30, 54, '分压接法（电压从 0 起连续可调）；灯丝电阻随温度升高而增大 → I–U 为非线性曲线',
        13, GRAY);

    /* 电源 + 开关（下轨） */
    setPen(P, INK, 2.2, null, null);
    seg(P, 170, 480, 386, 480);
    seg(P, 449, 480, 690, 480);
    seg(P, 170, 480, 170, 130); seg(P, 170, 130, 232, 130);
    seg(P, 232, 430, 232, 480);
    batterySym(P, 400, 480, 2);
    txt(P, 425, 514, '学生电源 E', 12, GRAY, 'center');
    switchSym(P, 600, 480, 54, true);
    txt(P, 627, 514, 'S', 13, INK, 'center');
    txt(P, 170, 556, '分压接法：A、B 接电源两端，滑片 P 与 B 之间输出 0~E 连续可调的电压',
        12, BLUE, 'left');

    /* 滑动变阻器（竖直，分压接法：全部电阻并在电源两端） */
    rheostatV(P, 250, 130, 430, 36, clamp(S.Ut / V_RANGE, 0, 1));
    txt(P, 250, 102, '滑动变阻器（分压接法）', 12, INK, 'center');

    /* 负载支路：滑片 P → 电流表 → 小灯泡 → 回到下端 B */
    setPen(P, INK, 2.2, null, null);
    seg(P, 268, yP, 330, yP);
    seg(P, 330, yP, 330, 200);
    seg(P, 330, 200, 418, 200);
    seg(P, 482, 200, 576, 200);
    seg(P, 644, 200, 690, 200);
    seg(P, 690, 200, 690, 480);
    meterSym(P, 450, 200, 32, 'A', clamp(I / A_RANGE, 0, 1), fx(I, 2) + ' A', run);
    lampSym(P, 610, 200, 34, run ? S.glow : S.glow * 0.5);
    txt(P, 610, 156, S.bulb.name, 12, INK, 'center');

    /* 电压表并在灯泡两端 */
    setPen(P, BLUE, 1.6, [6, 5], null);
    seg(P, 560, 200, 560, 300); seg(P, 560, 300, 582, 300);
    seg(P, 638, 300, 660, 300); seg(P, 660, 300, 660, 200);
    meterSym(P, 610, 300, 30, 'V', clamp(U / V_RANGE, 0, 1), fx(U, 2) + ' V', run);

    var tv = run ? t : t * 0.4;
    flow(P, [[250, 480], [170, 480], [170, 130], [232, 130]], tv, 4, 'rgba(166,57,42,0.85)');
    flow(P, [[268, yP], [330, yP], [330, 200], [418, 200]], tv, 4, 'rgba(166,57,42,0.85)');
    flow(P, [[482, 200], [576, 200]], tv, 2, 'rgba(166,57,42,0.85)');
    flow(P, [[644, 200], [690, 200], [690, 480], [449, 480]], tv, 5, 'rgba(166,57,42,0.85)');

    /* 读数与数据 */
    setPen(P, GRAY, 1.2, null, 'rgba(255,255,255,0.5)');
    box(P, 340, 350, 330, 122, 6);
    setPen(P, INK, 1.6, null, null);
    txt(P, 356, 368, lr ? ('最近一组：U = ' + fx(U, 2) + ' V, I = ' + fx(I, 2) + ' A')
                        : '尚未记录数据（点「📏 测量一次」）', 13, INK);
    txt(P, 356, 390, '灯丝温度 T ≈ ' + fx(S.T, 0) + ' K（' + fx(S.T - 273, 0) + ' ℃）',
        13, GRAY);
    txt(P, 356, 412, '灯丝电阻 R = ' + fx(S.Rlamp, 2) + ' Ω（冷态约 ' + fx(S.bulb.R0, 2) + ' Ω）',
        13, INK);
    txt(P, 356, 434, 'R记录 = U/I = ' + fx(lr ? lr.R : S.Umeas / Math.max(S.Imeas, 1e-6), 2) +
        ' Ω    P = UI = ' + fx(lr ? lr.P : S.P, 2) + ' W', 13, RED);
    txt(P, 356, 456, '接法：' + (S.conn === 0 ? '电流表外接（灯泡电阻小，采用外接）'
        : '电流表内接（电压表读数含电流表分压）'), 12, GRAY);
    miniPlot(P, 700, 40, 190, 150, pts, { xLab: 'U / V', yLab: 'I / A', fit: false,
             xMax: V_RANGE, yMax: A_RANGE });
  }

  function stepT(p, state, dt) { state.t = num(state.t, 0) + num(dt, 0); }

  /* ============================== 7. 四个实验 ============================== */
  var SPEC_RES = {
    id: 'resistivity',
    name: '导体电阻率的测量',
    group: '电学基础',
    aim: '用伏安法测出金属丝的电阻，再由 ρ = RS/L 求出金属的电阻率，并分析接法与量具带来的系统误差',
    principle: 'R = ρL/S 且 S = πd²/4 ⇒ ρ = RS/L = πd²U/(4LI)，量纲 [ρ] = Ω·m²/m = Ω·m。' +
      '用毫米刻度尺测两接线夹之间的接入长度 L（分度 1 mm，估读到 0.1 mm）；' +
      '用螺旋测微器在电阻丝三个不同位置各测一次直径取平均（分度 0.01 mm，估读到 0.001 mm）；' +
      '用伏安法测 U、I 得 R = U/I。改变 L 测 6 组以上数据，作 R–L 图线：' +
      '斜率 k = 4ρ/(πd²)，所以 ρ = kπd̄²/4；图线的纵轴截距就是接线柱与接触电阻（恒定附加电阻）。' +
      '接法影响：电流表外接时 R测 = R·Rv/(R+Rv) < R（电压表分流，电流表读数偏大）；' +
      '内接时 R测 = R + Ra > R（电流表分压）。本实验电阻丝只有几欧，Rv ≫ R 而 Ra 与 R 可比，故用外接。',
    apparatus: ['学生电源（或 3 V 电池组）', '电流表（0~0.6 A，内阻约 0.1 Ω）',
      '电压表（0~3 V，内阻约 3 kΩ）', '滑动变阻器（0~10 Ω，2 A）',
      '待测金属丝（镍铬合金丝，长约 1 m，直径约 0.6 mm）', '毫米刻度尺',
      '螺旋测微器（分度 0.01 mm）', '两个金属接线夹', '开关、导线若干'],
    steps: ['把金属丝拉直固定，两端用接线夹接出，量出两夹之间的接入长度 L。',
      '用螺旋测微器在金属丝的三个不同位置各测一次直径，取平均值 d̄（先检查零点误差）。',
      '按“电流表外接”连好电路：电源、开关、滑动变阻器、电流表与金属丝串联，电压表并联在金属丝两端。',
      '闭合开关，调节滑动变阻器使电流表读数约为 0.3 A，同时读出电压表读数 U 和电流表读数 I。',
      '改变金属丝的接入长度 L（每次改变约 5 cm），重复测量 6 组以上 (L, U, I) 数据。',
      '算出每组的 R = U/I，作 R–L 图线，用斜率 k 求 ρ = kπd̄²/4，并与该材料的标准值比较。'],
    params: [
      { key: 'L', label: '接入长度 L', unit: 'm', min: 0.200, max: 1.000, step: 0.010, value: 0.600 },
      { key: 'd', label: '电阻丝直径 d（真值）', unit: 'mm', min: 0.200, max: 1.200, step: 0.010, value: 0.600 },
      { key: 'I', label: '电流（调节变阻器）', unit: 'A', min: 0.10, max: 0.60, step: 0.05, value: 0.30 },
      { key: 'mat', label: '材料（0 铜 / 1 铝 / 2 镍铬 / 3 康铜）', unit: '', min: 0, max: 3, step: 1, value: 2 },
      { key: 'conn', label: '电流表接法（0 外接 / 1 内接）', unit: '', min: 0, max: 1, step: 1, value: 0 },
      { key: 'zoff', label: '螺旋测微器零误差', unit: 'mm', min: -0.010, max: 0.010, step: 0.001, value: 0 }
    ],
    measure: function (p, ctx) {
      var S = resSolve(p);
      var I = readOf(S.I, A_RES, ctx);
      if (!(I > 0)) I = A_RES;
      var U = readOf(S.Utrue, V_RES, ctx);
      /* 接线夹夹好后两个夹子之间的距离不再变化：刻度尺读数只有 0.1 mm 的量化（估读位）误差，
         不随每次测量随机抖动（否则同一装置会读出不同的 L） */
      var L = quant(S.L, RULER_RES);
      var d1 = readOf(S.dmm + S.zoff, MIC_RES, ctx);
      var d2 = readOf(S.dmm + S.zoff, MIC_RES, ctx);
      var d3 = readOf(S.dmm + S.zoff, MIC_RES, ctx);
      var d = (d1 + d2 + d3) / 3;
      var R = U / I;
      var rho = R * (PI * Math.pow(d * 1e-3, 2) / 4) / L;
      return { mat: S.mi, L: L, d: d, U: U, I: I, R: R, rho: rho };
    },
    columns: [
      { key: 'mat', label: '材料(0铜1铝2镍铬3康铜)', unit: '' },
      { key: 'L', label: '接入长度 L', unit: 'm' },
      { key: 'd', label: '直径 d̄', unit: 'mm' },
      { key: 'U', label: '电压 U', unit: 'V' },
      { key: 'I', label: '电流 I', unit: 'A' },
      { key: 'R', label: '电阻 R = U/I', unit: 'Ω' },
      { key: 'rho', label: '电阻率 ρ', unit: 'Ω·m' }
    ],
    graph: { x: 'L', y: 'R', fit: 'linear', title: 'R–L 图线（斜率 k = 4ρ/πd²）',
      note: '每改变一次接入长度 L 记一点；斜率 k = 4ρ/(πd̄²) ⇒ ρ = kπd̄²/4，截距即接触电阻' },
    conclude: function (rows, p, ctx) {
      var S = resSolve(p), m = S.m, n = rows ? rows.length : 0, i;
      var errs = [];
      if (S.conn === 0) {
        errs.push('电流表外接：电压表分流使电流表读数偏大，R = U/I 偏小——理论上偏小 R/Rv ≈ ' +
          fx(S.Rwire / V_RV * 100, 3) + '%，远小于内接时的 Ra/R，所以电阻丝只有几欧时必须用外接');
      } else {
        errs.push('电流表内接：电流表分压被计入电压，单点算出的 R 偏大 Ra/R ≈ ' +
          fx(A_RA / Math.max(S.Rwire, 1e-9) * 100, 1) + '%（改为外接更好）；' +
          '但图线法只取斜率，Ra 这类恒定附加电阻只抬高截距，不影响 ρ 的结果');
      }
      errs.push('螺旋测微器的估读与零点误差：ρ 与 d² 成正比，d 的相对误差被放大一倍（零误差 0.010 mm 就使 ρ 偏 ' +
        fx((Math.pow(S.dmm + 0.01, 2) / Math.pow(S.dmm, 2) - 1) * 100, 1) + '%）');
      errs.push('刻度尺测 L 时没有量准两个接线夹之间的实际接入长度（夹子位置、导线弯曲）');
      errs.push('通电电流偏大或时间过长使电阻丝发热：本次 ΔT ≈ ' + fx(S.dT, 1) +
        ' K，ρ 已系统性偏大 ' + pct(m.alpha * S.dT * 100, 2) + '（铜、铝的 α 大，尤其明显）');
      errs.push('接线柱与金属夹的接触电阻、导线电阻被一并计入 R（在图线上表现为截距不为零）');
      errs.push('U、I 的估读误差：电流表 0.01 A、电压表 0.01 V，电流偏小或电压偏大都会同向影响 R');
      if (!n) {
        return { value: 0, unit: 'Ω·m', text: '还没有数据：请改变接入长度 L 记录至少 2 组（建议 6 组）数据后再作图求 ρ。',
                 errors: errs };
      }
      var pts = [], dsum = 0, rsum = 0, devs = [];
      for (i = 0; i < n; i++) {
        pts.push({ x: rows[i].L, y: rows[i].R });
        dsum += rows[i].d; rsum += rows[i].rho;
      }
      var dbar = dsum / n, rhoAvg = rsum / n;
      var f = fitLine(pts);
      var Sd = PI * Math.pow(dbar * 1e-3, 2) / 4;
      var rho = f ? f.b * Sd : rhoAvg;
      var rel = (rho - m.rho) / m.rho * 100;
      var txt1;
      if (f) {
        txt1 = '图线法：R–L 图线斜率 k = ' + fx(f.b, 3) + ' Ω/m，d̄ = ' + fx(dbar, 3) +
          ' mm ⇒ ρ = kπd̄²/4 = ' + sci(rho, 3) + ' Ω·m；' + m.name + ' 的 20℃ 标准值 ' +
          sci(m.rho, 2) + ' Ω·m，相差 ' + pct(rel, 1) + '。';
        if (f.r2 !== null) txt1 += ' 图线线性相关系数 r² = ' + fx(f.r2, 4) + '。';
        txt1 += ' 图线截距 ' + fx(f.a, 3) + ' Ω 来自接线柱与接触电阻。';
      } else {
        txt1 = '各组的接入长度 L 都是 ' + fx(rows[0].L, 3) +
          ' m（横轴没有分布），作不出 R–L 图线取斜率，改按逐点法 ρ = RS/L：' + n +
          ' 组平均 ρ̄ = ' + sci(rhoAvg, 3) + ' Ω·m；' + m.name + ' 的 20℃ 标准值 ' +
          sci(m.rho, 2) + ' Ω·m，相差 ' + pct((rhoAvg - m.rho) / m.rho * 100, 1) +
          '。请把接入长度 L 改成几个不同的值（例如 0.20~1.00 m 取 6 组以上）分别测量，才能用图线的斜率求 ρ。';
      }
      if (f) txt1 += ' 逐点平均法 ρ̄ = ' + sci(rhoAvg, 3) + ' Ω·m（相差 ' +
        pct((rhoAvg - m.rho) / m.rho * 100, 1) + '）。';
      return { value: rho, unit: 'Ω·m', text: txt1, errors: errs };
    },
    draw: drawResistivity,
    step: stepT
  };

  var SPEC_MULTI = {
    id: 'multimeter',
    name: '练习使用多用电表',
    group: '电学基础',
    aim: '练习使用多用电表的欧姆挡，理解欧姆表的中值刻度（中值电阻 = 表内阻）与欧姆调零，并分析倍率选择、调零与电池老化带来的误差',
    principle: '欧姆挡由表内电池 E、调零电阻 R0 与表头串联而成，流过表头的电流 I = E/(RΩ + Rx)，' +
      '其中 RΩ 是欧姆表内阻。指针满偏（I = Ig）时 Rx = 0，对应表盘右端的 0 Ω；I = 0 时 Rx = ∞，对应左端。' +
      '当指针指到表盘中央时 I = Ig/2 ⇒ Rx = RΩ，所以“表盘中央的刻度值 × 倍率 = 该挡的中值电阻 = 欧姆表内阻”。' +
      '表盘刻度不均匀（I 与 Rx 不是线性关系）：指针越靠近中值区，读数的相对误差越小，' +
      '|ΔR/R| = δ/(f(1−f))（f 为偏转比例，δ 为指针判读误差），在 f = 0.5 处最小。' +
      '测量步骤：机械调零（指针停在左端“0”）→ 选倍率 → 短接表笔做欧姆调零 → 接被测电阻 → 读数 = 表盘刻度 × 倍率 → 用毕置 OFF。' +
      '每换一次倍率都必须重新欧姆调零（表内电路与中值电阻都变了）。',
    apparatus: ['多用电表（欧姆挡 ×1、×10、×100、×1k）', '待测定值电阻若干',
      '导线、开关', '小螺丝刀（机械调零用）'],
    steps: ['观察表盘：看清欧姆挡刻度不均匀、右端是 0 Ω、左端是 ∞、中央刻度值约 15。',
      '机械调零：用小螺丝刀调节指针定位螺丝，让指针停在左端“0”位置。',
      '估测待测电阻的阻值，把选择开关旋到合适的倍率挡（使指针能指在中央刻度附近）。',
      '将红、黑表笔短接，调节欧姆调零旋钮，使指针指到右端的 0 Ω（欧姆零点）。',
      '把两表笔分别接在待测电阻两端（手不要接触表笔金属杆），读出表盘刻度值 × 倍率。',
      '换用另一倍率再测一次：必须先重新欧姆调零；比较两次读数，体会“指针指在中值附近最准”。',
      '测完把选择开关旋到 OFF 挡；长期不用应取出表内电池。'],
    params: [
      { key: 'Rx', label: '被测电阻 Rx（标称）', unit: 'Ω', min: 5, max: 500, step: 5, value: 30 },
      { key: 'range', label: '倍率挡（0 ×1 / 1 ×10 / 2 ×100 / 3 ×1k）', unit: '', min: 0, max: 3, step: 1, value: 0 },
      { key: 'zero', label: '欧姆调零（0 未调准 / 1 已调准）', unit: '', min: 0, max: 1, step: 1, value: 1 },
      { key: 'E', label: '表内电池电动势 E', unit: 'V', min: 1.20, max: 1.60, step: 0.01, value: 1.50 }
    ],
    measure: function (p, ctx) {
      var S = ohmSolve(p);
      var Dread = quant(S.D * Math.exp(noiseOf(ctx, S.relU) - S.relU * S.relU / 2), dialStep(S.D));
      if (!(Dread > 0)) Dread = dialStep(S.D);
      return { mult: S.mult, Rx: S.Rx, dial: Dread, R: Dread * S.mult, u: S.relU * 100 };
    },
    columns: [
      { key: 'mult', label: '倍率', unit: '×' },
      { key: 'Rx', label: '标称电阻 Rx', unit: 'Ω' },
      { key: 'dial', label: '表盘刻度 D', unit: 'Ω' },
      { key: 'R', label: '测量值 D×倍率', unit: 'Ω' },
      { key: 'u', label: '相对不确定度', unit: '%' }
    ],
    graph: { x: 'Rx', y: 'R', fit: 'linear', title: '测量值–标称值 图线',
      note: '指针在中值附近时读数最准；斜率应为 1，截距不为 0 说明未调零或表内电池不是标称值' },
    conclude: function (rows, p, ctx) {
      var S = ohmSolve(p), i, n = rows ? rows.length : 0;
      var errs = [];
      errs.push('换挡后未重新欧姆调零：表内等效电阻改变，读数 = Rx·E₀/E + 1.5×倍率，' +
        '偏差随倍率放大（×10 挡就相当于多读 15 Ω）');
      errs.push('表内电池用旧：即使重新调零，中值电阻也变成 R中 = 15×倍率×(E/E₀)，' +
        '读数变为 Rx·E₀/E，即 E 越低读数越大（本次 E = ' + fx(S.E, 2) + ' V，' +
        (Math.abs(S.E - OHM_E0) < 0.005 ? '为标称值' : '读数已偏大 ' + fx((OHM_E0 / S.E - 1) * 100, 1) + '%') + '）');
      errs.push('指针偏离中值区：欧姆挡刻度不均匀，|ΔR/R| = δ/(f(1−f))，指针靠近两端时相对误差迅速增大' +
        '（本次 f = ' + fx(S.f, 3) + '，相对不确定度约 ' + fx(S.relU * 100, 1) + '%）');
      errs.push('机械零点未校准：指针初始不在左端“0”位置，所有读数都带同一个固定偏差');
      errs.push('测量时手接触表笔金属杆：人体电阻并联在被测电阻上，读数偏小');
      errs.push('被测电阻没有与电路、电源断开（或与其他元件并联），测得的是等效电阻，读数偏小');
      if (!n) {
        return { value: 0, unit: 'Ω', text: '还没有数据：选好倍率并欧姆调零后，改变被测电阻记录至少 2 组数据。',
                 errors: errs };
      }
      var sum = 0, dev = 0, u = 0;
      for (i = 0; i < n; i++) {
        sum += rows[i].R;
        if (rows[i].Rx > 0) dev += (rows[i].R - rows[i].Rx) / rows[i].Rx;
        u += rows[i].u;
      }
      var Rm = sum / n, devPct = dev / n * 100, uPct = u / n;
      /* 各倍率挡的理论相对不确定度，用来说明“要选中值附近的倍率” */
      var best = -1, bestU = 1e9, worstU = -1, worstTxt = '', k, fk, uk;
      for (k = 0; k < OHM_RANGES.length; k++) {
        fk = clamp((OHM_MID * OHM_RANGES[k] * (S.E / OHM_E0)) /
                   (OHM_MID * OHM_RANGES[k] * (S.E / OHM_E0) * (1 + S.eps) + S.Rx), 1e-6, 1 - 1e-9);
        uk = clamp(OHM_DF / (fk * (1 - fk)), 0, 0.5);
        if (uk < bestU) { bestU = uk; best = k; }
        if (uk > worstU) { worstU = uk; worstTxt = OHM_RANGE_TXT[k]; }
      }
      var txt1 = '用 ' + OHM_RANGE_TXT[S.ri] + ' 挡（中值电阻 R中 = ' + fx(S.Rmid, 0) +
        ' Ω = 表内阻）测 ' + n + ' 组：平均测量值 ' + fx(Rm, 1) + ' Ω，相对标称值的平均偏差 ' +
        pct(devPct, 1) + '，平均读数相对不确定度 ' + fx(uPct, 1) + '%。' +
        '本次 Rx = ' + fx(S.Rx, 0) + ' Ω 时最合适的倍率是 ' + OHM_RANGE_TXT[best] +
        '（相对不确定度 ' + fx(bestU * 100, 1) + '%），而 ' + worstTxt + ' 挡高达 ' +
        fx(worstU * 100, 1) + '%——这就是“要选使指针指在中值附近的倍率”的原因。';
      if (S.zero === 0) txt1 += ' 本次未做欧姆调零，读数系统性偏大 ' +
        fx(OHM_MID * OHM_EPS * S.mult, 1) + ' Ω。';
      if (Math.abs(S.E - OHM_E0) >= 0.005) txt1 += ' 表内电池不是标称 1.5 V，' +
        '即使调零读数也会按 E₀/E 偏离。';
      return { value: Rm, unit: 'Ω', text: txt1, errors: errs };
    },
    draw: drawMultimeter,
    step: stepT
  };

  var SPEC_EMF = {
    id: 'emf-internal',
    name: '测量电池的电动势和内阻',
    group: '电学基础',
    aim: '用伏安法测定干电池的电动势和内阻，由 U–I 图线的截距与斜率求 E 和 r，并分析电流表内接/电压表接法带来的系统误差',
    principle: '闭合电路欧姆定律：U = E − I r。改变滑动变阻器的接入电阻，读出多组 (I, U)，' +
      '作 U–I 图线，图线与纵轴的交点（I = 0）就是电动势 E，斜率绝对值就是内阻 r。' +
      '量纲：[E] = V，[r] = V/A = Ω。系统误差来自电表内阻：' +
      '甲（电压表直接并在电池两端、电流表串在外电路，本实验应采用）：' +
      'U = E − r(I + U/Rv) ⇒ U = E/(1+r/Rv) − I·r/(1+r/Rv)，' +
      '即 E测 = E/(1+r/Rv)、r测 = r/(1+r/Rv)，两者都略偏小（r/Rv ≈ 0.02%）；' +
      '乙（电流表串在电源一侧、电压表并在滑动变阻器两端）：U = E − I(r+Ra)，' +
      'E测 无误差而 r测 = r + Ra，偏大 Ra/r ≈ 20%。' +
      '因为干电池内阻很小（0.5 Ω 量级）而 Ra 与它可比、Rv 却远大于 r，所以必须选甲图。',
    apparatus: ['干电池 1 节（E ≈ 1.5 V，r ≈ 0.5 Ω）', '电压表（0~3 V，内阻约 3 kΩ）',
      '电流表（0~0.6 A，内阻约 0.1 Ω）', '滑动变阻器（0~20 Ω，1 A）', '开关、导线若干'],
    steps: ['按甲图连好电路：电池、开关、电流表、滑动变阻器串联成回路，电压表直接并在电池两端。',
      '把滑动变阻器的阻值调到最大，闭合开关。',
      '逐渐减小滑动变阻器的接入电阻，使电流表读数依次约为 0.10、0.15 … 0.50 A，逐组读取电流 I 和对应的电压 U（6~8 组）。',
      '断开开关（电池不要长时间放电，否则 E 会略降、r 会变大）。',
      '以 I 为横轴、U 为纵轴描点，用直线拟合：纵轴截距就是 E，斜率绝对值就是 r。',
      '换用乙图再测一次，比较两种接法测得的 r，体会“电流表分压”与“电压表分流”哪个误差更大。'],
    params: [
      { key: 'I', label: '电流表读数 I（调变阻器得到）', unit: 'A', min: 0.10, max: 0.50, step: 0.05, value: 0.25 },
      { key: 'E', label: '电池电动势（真值）', unit: 'V', min: 1.30, max: 1.60, step: 0.01, value: 1.50 },
      { key: 'r', label: '电池内阻（真值）', unit: 'Ω', min: 0.20, max: 2.00, step: 0.01, value: 0.50 },
      { key: 'conn', label: '接法（0 甲：V 接电源两端 / 1 乙：A 串电源侧）', unit: '', min: 0, max: 1, step: 1, value: 0 }
    ],
    measure: function (p, ctx) {
      var S = emfSolve(p);
      /* 学生只能把电流调到电流表分度（0.02 A）的一半以内，读数即为目标值 */
      var adj = clamp(noiseOf(ctx, A_RES * 0.25), -A_RES / 2, A_RES / 2);
      var Itrue = S.It + adj;
      var Utrue = (S.conn === 0) ? (S.E - S.r * Itrue) / (1 + S.r / V_RV)
                                 : (S.E - Itrue * (S.r + A_RA));
      var I = quant(Itrue, A_RES);
      if (!(I > 0)) I = A_RES;
      var U = readOf(Utrue, V_RES, ctx);
      return { Rext: S.R, I: I, U: U, conn: S.conn };
    },
    columns: [
      { key: 'Rext', label: '变阻器接入电阻(算得)', unit: 'Ω' },
      { key: 'I', label: '电流 I', unit: 'A' },
      { key: 'U', label: '路端电压 U', unit: 'V' },
      { key: 'conn', label: '接法(0甲1乙)', unit: '' }
    ],
    graph: { x: 'I', y: 'U', fit: 'linear', title: 'U–I 图线（截距 = E，斜率 = −r）',
      note: '每把电流调到另一个值（调节滑动变阻器）记一点；换接法前请先清空数据，否则两种接法的点会混在一起' },
    conclude: function (rows, p, ctx) {
      var S = emfSolve(p), n = rows ? rows.length : 0, i, pts = [];
      var errs = [];
      if (S.conn === 0) {
        errs.push('电压表分流（甲图）：电压表与电池并联，分流使电流表读数偏小，' +
          '理论上 E测 = E/(1+r/Rv)、r测 = r/(1+r/Rv) 都略偏小——本次偏小约 ' +
          fx(S.r / V_RV * 100, 3) + '%（r/Rv），远小于乙图 Ra/r = ' +
          fx(A_RA / S.r * 100, 1) + '% 的偏差，所以本实验采用甲图');
      } else {
        errs.push('电流表分压（乙图）：电流表串在电源一侧，U–I 图线的斜率绝对值变成 r + Ra，' +
          'r 测量值偏大 Ra = ' + fx(A_RA, 2) + ' Ω（本次相对偏大 ' + fx(A_RA / S.r * 100, 1) +
          '%）；E 不受影响。干电池 r 很小，这个误差不能忽略，故实验应改用甲图');
      }
      errs.push('电池放电时间过长、温度升高：E 略降、r 增大（应在 1~2 min 内测完，测完立即断开开关）');
      errs.push('U、I 的估读误差（电压表 0.01 V、电流表 0.01 A）；电流变化范围太小会使斜率误差被放大' +
        '（应让电流从 0.1 A 左右一直读到接近满量程）');
      errs.push('接线柱、导线与接触电阻被计入内阻，使 r 测量值偏大');
      errs.push('用作图法处理数据时描点、画线的人为误差（应让直线尽量通过多数点，不在线上的点均匀分布在两侧）');
      if (!n) {
        return { value: 0, unit: 'V', text: '还没有数据：改变滑动变阻器记录至少 2 组（建议 6 组以上）U、I 数据。',
                 errors: errs };
      }
      for (i = 0; i < n; i++) pts.push({ x: rows[i].I, y: rows[i].U });
      var f = fitLine(pts);
      if (!f) {
        var uSum = 0, iSum = 0;
        for (i = 0; i < n; i++) { uSum += rows[i].U; iSum += rows[i].I; }
        return { value: uSum / n, unit: 'V',
          text: '已记录的 ' + n + ' 组数据里电流读数都是 ' + fx(iSum / n, 2) +
            ' A（横轴没有分布），作不出 U–I 图线，只能得到路端电压平均 ' + fx(uSum / n, 3) +
            ' V；请改变滑动变阻器的接入电阻，让电流在 0.10~0.50 A 之间取几个不同的值各测一组，' +
            '再由图线的截距和斜率求 E 与 r。',
          errors: errs };
      }
      var E = f.a, r = -f.b;
      var txt1 = 'U–I 图线：纵轴截距 E测 = ' + fx(E, 3) + ' V（真值 ' + fx(S.E, 2) + ' V，' +
        pct((E - S.E) / S.E * 100, 2) + '），斜率绝对值 r测 = ' + fx(r, 3) + ' Ω（真值 ' +
        fx(S.r, 2) + ' Ω，' + pct((r - S.r) / S.r * 100, 1) + '）；' +
        (f.r2 !== null ? '相关系数 r² = ' + fx(f.r2, 4) + '（' + n + ' 组数据）。' : '') +
        ' R = U/I 随电流增大而减小，说明电源内部有内阻。';
      if (S.conn === 0) {
        txt1 += ' 甲图的理论偏差只有 r/Rv ≈ ' + fx(S.r / V_RV * 100, 3) + '%，若误用乙图，' +
          'r 会偏大 Ra = ' + fx(A_RA, 2) + ' Ω（约 ' + fx(A_RA / S.r * 100, 1) + '%）。';
      } else {
        txt1 += ' 乙图测得的 r 实际是 r + Ra（偏大 ' + fx(A_RA, 2) + ' Ω，约 ' +
          fx(A_RA / S.r * 100, 1) + '%），这正是实验要选甲图的原因。';
      }
      return { value: E, unit: 'V', text: txt1, errors: errs };
    },
    draw: drawEmf,
    step: stepT
  };

  var SPEC_VA = {
    id: 'va-characteristic',
    name: '描绘小灯泡的伏安特性曲线',
    group: '电学基础',
    aim: '用分压接法描绘小灯泡的伏安特性曲线，研究灯丝电阻随温度升高而增大的规律',
    principle: '灯丝是金属钨，电阻随温度升高而增大：R(T) = R₀(T/T₀)^1.2（等价于线性温度系数 α ≈ 4.5×10⁻³/K，' +
      '从室温升到 2800 K 电阻增大约 12 倍，冷态电阻只有正常工作电阻的 1/10 左右）。' +
      '通电后灯丝温度由电功率与散热（辐射为主）的平衡决定：I²R(T) = A(T⁴ − T₀⁴)，' +
      '电压越高 → 灯丝越热 → 电阻越大 → 电流增长比电压慢。' +
      '所以 I–U 图线是一条过原点、斜率（电导）逐渐减小的曲线，不是直线，不能用直线拟合。' +
      '正因为灯丝电阻会变，正常发光时的电阻 R = U²/P 与用欧姆表在常温下测得的电阻相差很大。' +
      '电路要求电压从 0 起连续可调，所以滑动变阻器必须用分压接法（三端接线）；' +
      '灯泡电阻小，电流表用外接法（电压表并联在灯泡两端）。系统误差：外接时电流表读数含电压表的分流电流（I 偏大、R 偏小），' +
      '内接时电压表读数含电流表的分压（U 偏大、R 偏大），低压段相对误差更明显。',
    apparatus: ['小灯泡（2.5 V 0.3 A 或 3.8 V 0.3 A）', '学生电源（或 4 V 电池组）',
      '电压表（0~3 V，内阻约 3 kΩ）', '电流表（0~0.6 A，内阻约 0.1 Ω）',
      '滑动变阻器（0~20 Ω，1 A，分压接法）', '开关、导线若干', '坐标纸（描点作图）'],
    steps: ['按分压接法连电路：滑动变阻器的全部电阻接在电源两端（A、B 两端），滑片 P 与 B 端之间输出可调电压。',
      '把灯泡、电流表串联后接在滑片 P 与 B 端之间，电压表并联在灯泡两端（电流表外接）。',
      '闭合开关前把滑片 P 移到 B 端，使灯泡两端电压为 0。',
      '缓慢移动滑片，使电压表读数依次为 0.05、0.10、0.20 … 直到额定电压（或 3 V），逐点读出对应的电流。',
      '在坐标纸上以 U 为横轴、I 为纵轴描点，用平滑曲线连接（不能连成折线，更不能连成直线）。',
      '由每点算出 R = U/I，比较低压段与额定电压下的电阻，说明灯丝电阻随温度升高而增大。'],
    params: [
      { key: 'U', label: '灯泡两端电压（电压表读数）', unit: 'V', min: 0, max: 3.00, step: 0.05, value: 1.00 },
      { key: 'bulb', label: '灯泡规格（0:2.5V0.3A / 1:3.8V0.3A / 2:2.5V0.75A）', unit: '', min: 0, max: 2, step: 1, value: 0 },
      { key: 'conn', label: '电流表接法（0 外接 / 1 内接）', unit: '', min: 0, max: 1, step: 1, value: 0 }
    ],
    measure: function (p, ctx) {
      var S = vaSolve(p);
      var U = readOf(S.Umeas, V_RES, ctx);
      var I = readOf(S.Imeas, A_RES, ctx);
      if (!(I > 0)) I = 0;
      if (U < 0) U = 0;
      var R = (I > 1e-6) ? U / I : 0;
      return { U: U, I: I, R: R, P: U * I };
    },
    columns: [
      { key: 'U', label: '电压 U', unit: 'V' },
      { key: 'I', label: '电流 I', unit: 'A' },
      { key: 'R', label: '电阻 R = U/I', unit: 'Ω' },
      { key: 'P', label: '功率 P = UI', unit: 'W' }
    ],
    graph: { x: 'U', y: 'I', fit: 'none', title: '小灯泡的 I–U 特性曲线（不作直线拟合）',
      note: '灯丝电阻随温度升高而增大 ⇒ I 随 U 增长越来越慢，曲线过原点且斜率递减；' +
        '所以本实验不做直线拟合（直线拟合无物理意义），而是逐点算 R = U/I 后描成平滑曲线' },
    conclude: function (rows, p, ctx) {
      var S = vaSolve(p), n = rows ? rows.length : 0, i;
      var errs = [];
      if (S.conn === 0) {
        errs.push('电流表外接：电流表读数里含电压表的分流电流 U/Rv，使 I 偏大、R = U/I 偏小' +
          '（本次在 U = ' + fx(S.Ut, 2) + ' V 处偏小约 ' + fx(S.Ul / V_RV / Math.max(S.Imeas, 1e-9) * 100, 3) +
          '%；0.3 A 量级的小灯泡 R ≈ 2~10 Ω，远小于 Rv = 3 kΩ，所以外接是正确选择）');
      } else {
        errs.push('电流表内接：电压表读数里含电流表的电压 I·Ra，使 U 偏大、R = U/I 偏大' +
          '（本次在 U = ' + fx(S.Ut, 2) + ' V 处偏大约 ' + fx(S.Ilamp * A_RA / Math.max(S.Umeas, 1e-9) * 100, 2) +
          '%，低压段灯丝电阻小、偏大更明显；不过对 0.3 A 的灯泡，高压段这点差异已小于电流表最小估读位 0.01 A，' +
          '记录的数据几乎重合，只有低压段才看得出来）');
      }
      errs.push('灯丝温度随通电时间变化：读数应在通电后尽快读出，否则灯丝继续升温、电阻变大、电流漂移');
      errs.push('低压段电压表读数相对误差大（0.01 V 的估读误差在 0.1 V 处就是 10%），应多测几个点');
      errs.push('滑动变阻器分压接法接线错误（未接成三端）会使电压不能从 0 调起，低压段数据缺失');
      errs.push('导线、接线柱的接触电阻与灯泡座电阻被计入，低压段影响相对更大');
      errs.push('描点作图时用人眼画平滑曲线的人为误差（应使曲线两侧点数大致相等，不能连成折线）');
      if (!n) {
        return { value: 0, unit: 'Ω', text: '还没有数据：从 0.05 V 起逐步升高电压，记录至少 6 组 U、I 数据。',
                 errors: errs };
      }
      var sorted = rows.slice(0);
      sorted.sort(function (a, b) { return a.U - b.U; });
      var lo = sorted[0], hi = sorted[sorted.length - 1], mid = sorted[Math.floor(n / 2)];
      var klow = lo.U > 1e-6 ? lo.I / lo.U : 0, khigh = hi.U > 1e-6 ? hi.I / hi.U : 0;
      var ratio = (khigh > 1e-9) ? klow / khigh : 0;
      var rratio = (lo.R > 1e-9) ? hi.R / lo.R : 0;
      var flat = fitLine(rows.map ? rows.map(function (r0) { return { x: r0.U, y: r0.I }; }) : []);
      var txt1 = '灯丝电阻从 U = ' + fx(lo.U, 2) + ' V 时的 ' + fx(lo.R, 2) + ' Ω 增大到 U = ' +
        fx(hi.U, 2) + ' V 时的 ' + fx(hi.R, 2) + ' Ω（约 ' + fx(rratio, 1) + ' 倍）；' +
        '低电压段的平均电导 I/U = ' + fx(klow, 3) + ' A/V，是高电压段 ' + fx(khigh, 3) +
        ' A/V 的 ' + fx(ratio, 1) + ' 倍——曲线过原点且斜率（电导）越来越小，说明灯丝电阻随温度升高而增大。';
      if (flat && flat.r2 !== null) {
        txt1 += ' 若硬作直线拟合，r² 只有 ' + fx(flat.r2, 3) + '，残差呈明显的系统弯曲，' +
          '而且直线会把 0 点漏掉，所以在物理上没有意义：本实验的图线必须画成平滑曲线。';
      }
      txt1 += ' 中间点 U = ' + fx(mid.U, 2) + ' V 时 R = ' + fx(mid.R, 2) + ' Ω，P = ' +
        fx(mid.P, 2) + ' W。';
      return { value: hi.R, unit: 'Ω', text: txt1, errors: errs };
    },
    draw: drawVA,
    step: stepT
  };

  var SPECS = [SPEC_RES, SPEC_MULTI, SPEC_EMF, SPEC_VA];

  /* ============================ 9. 登记 ============================ */
  var api = window.QG_PSLAB, i;
  if (api && typeof api.register === 'function') {
    for (i = 0; i < SPECS.length; i++) api.register(SPECS[i].id, SPECS[i]);
  } else {
    /* 加载顺序异常（核心尚未就绪）时只把登记表挂在一个明确命名的队列上，
       绝不自建 DOM、不起定时器；核心就绪后可自行取用。 */
    if (!api) api = window.QG_PSLAB = {};
    api.__pendingModules = api.__pendingModules || [];
    for (i = 0; i < SPECS.length; i++) {
      api.__pendingModules.push({ id: SPECS[i].id, spec: SPECS[i] });
    }
  }
})(window);
