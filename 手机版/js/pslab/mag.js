/* ============================================================================
 * 穷观 · 物理实验台 · 组 3：磁场与电磁感应（3 个实验）
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向实验台注册表登记本组的 3 个实验 ——
 *   window.QG_PSLAB.register('lenz-law',    ...)  探究影响感应电流方向的因素（楞次定律）
 *   window.QG_PSLAB.register('ampere-force',...)  探究影响通电导线受力的因素（F=BIL）
 *   window.QG_PSLAB.register('transformer', ...)  探究变压器电压与匝数的关系
 * 不建 DOM、不起循环、不读网络、不碰别人的文件（守设计契约 §3）。
 * 纯 ES5（无箭头函数 / let / const / 模板串 / class / eval / new Function）、零外部依赖。
 *
 * ── 量纲与量级基准（每个 measure 都只由这里的公式算出，绝不写死"数据"）──
 *
 * 【1】lenz-law —— 法拉第电磁感应定律 + 楞次定律 + 欧姆定律
 *   dΦ/dξ = −s · N · k               [Wb/m]  ξ 为磁铁位移（指向线圈内部为正），
 *                                            s = ±1 为下场方向，k 为"线圈有效截面 ×
 *                                            磁铁端面附近有效轴向磁场梯度"（见下）
 *   ε     = |dΦ/dt| = N · k · v²      [V]     v 为插入/拔出速度（正数）
 *   I     = ε / R                    [A]（R = 线圈电阻 + 电流计内阻 + 导线）
 *   方向：I = −(1/R)·dΦ/dt —— 感应电流的磁场**总要阻碍**原磁通量的变化：磁通量增大
 *         （插入）时与原磁场反向，减小（拔出）时与原磁场同向（"增反减同"）。
 *         于是磁极反向、插拔互换都会使电流与指针反向；|I| ∝ |dΦ/dt|（过原点直线）。
 *   方向：感应电流的磁场**总要阻碍**原磁通量的变化 —— 磁通量增大（插入）时与
 *         原磁场反向，减小（拔出）时与原磁场同向（"增反减同"）。
 *   量级核对：N=200 匝、k=2.0e-5 Wb/(m·匝)、v=1.0 m/s
 *             → dΦ/dξ = 4.0e-3 Wb/m；ε ≈ 4.0 mV；R=50 Ω → I ≈ 0.080 mA。
 *             灵敏电流计按 2000 格/A 标定（3 mA 满偏、读数到 0.1 格），
 *             于是 v=0.2~2 m/s 对应约 0.6~6 格 —— 插入/拔出时指针左右偏转可读。
 *   k 的来历（不是拟合出来的数）：k = 线圈有效截面 A × 磁铁端面附近的有效
 *   轴向磁场梯度。条形磁铁磁极附近的磁场在"线圈长度量级(≈4 cm)"上落差约
 *   0.1~0.2 T，折成轴向梯度 ≈ 2.5~5 T/m；再乘有效截面 A ≈ 5e-6 m²
 *   （= 磁通实际穿过、且梯度最大的那一小段截面；用偶极子远场公式
 *   B≈(μ₀/4π)2m/d³ 在紧贴磁极处会高估一个量级，A 取小正是把这一折减吸收掉），
 *   落在 1e-5 量级。12% 的相对不确定度已写进误差来源。
 *   ⚠ 见文件末"建模时写明的假设"：线圈绕向影响"指针偏左还是偏右"的绝对符号。
 *
 * 【2】ampere-force —— 安培力 F = B I L sinθ
 *   F = B·I·L·sinθ                   [N]     θ = 电流方向与磁场方向的夹角
 *   θ = 0°/180°（B ∥ I）→ F = 0（导线与磁感线平行时不受安培力）
 *   方向：左手定则；测力：把导线受到的竖直安培力与天平（或弹簧测力计）的
 *         示数变化挂钩，Δm = F/g，g 取 9.80 m/s²。
 *   量级核对：B=0.35 T、I=2 A、L=0.08 m、θ=90° → F=56 mN → Δm≈5.7 g
 *             （电子天平 0.01 g 分辨力 → 读数稳定，属于"可测"的量级）。
 *   ⚠ 见"建模时写明的假设"：测力方式取"天平示数变化"。教材里有的装置用的是
 *     "悬挂导线偏角 θ ∝ F"、有的是"天平示数变化"，两者测的是同一个 F。
 *
 * 【3】transformer —— 理想变压器 U₁/U₂ = n₁/n₂ + 漏磁、铜损偏离
 *   U₂ = U₁ · (n₂/n₁) · kcore − ( I₂·r₂ + I₂·r₁·(n₁/n₂) )     [V]
 *        └─ 理想项 ─┘└ 漏磁 ─┘   └── 铜损：副边压降 + 折算到副边的原边压降 ──┘
 *   r₁、r₂ 为原、副线圈的直流电阻 [Ω]（按每匝 0.0035 Ω/匝 × 匝数）
 *   量级核对：n₁=200、n₂=100、U₁=8 V、I₂=0.125 A、kcore=0.97
 *             → 理想项 8×0.5×0.97 = 3.88 V；铜损压降 0.125×(0.35+0.70) ≈ 0.13 V
 *             → U₂ ≈ 3.75 V，比理想值低约 3.4%（漏磁 3% + 铜损 ~0.4%）。
 *             若铁芯未闭合（kcore≈0.45）→ U₂ ≈ 1.72 V，比理想值低 55% —— 与真题里
 *             “12.0 V / 8:1 未闭合铁芯 → 读数只能到 0.65 V 一档”的结论同向（见来源）。
 *
 * ── 原理/器材/步骤/数据处理/误差来源的权威来源（逐条核对过原文，非凭记忆）──
 *   [L1] 21世纪教育网《第二章 第1节 楞次定律（课件 学案 练习）高中物理人教版（2019）
 *        选择性必修 第二册》——实验器材（条形磁体、螺线管、电流表、导线若干、干电池、
 *        滑动变阻器、开关、电池盒）、实验原理、四组探究记录表、"增反减同"结论、
 *        注意事项 5 条（试触法 / 零刻度在中间的灵敏电流计 / 先定绕向 / 控制变量 /
 *        每步等指针回零）。  https://zy.21cnjy.com/23518848
 *   [L2] 高途《探究楞次定律实验》试题解析 ——"试触法判断电流计指针偏转方向与电流方向
 *        的关系"、"N 极拔出 → 原磁通方向向下、磁通量减小 → 指针偏转方向"。
 *        https://gaotu.cn/topic/5@583679438919561216@1/484/399
 *   [L3] 菁优网 人教版（2019）选择性必修第二册《2.1 楞次定律》同步练习卷（31）——
 *        "竖直放置的线圈固定不动，将磁铁从线圈上方插入或拔出，线圈和电流表构成的
 *        闭合回路中就会产生感应电流"。  https://www.jyeoo.com/shiti/100970e8-1519-1565-be57-25271516eb2d
 *   [A1] 《物理通报》2018 年第 5 期《用自制实验装置全面探究安培力》——
 *        F = BIL、控制变量（分别改 I、L、B）。
 *        http://wltb.cnjournals.com/ch/reader/create_pdf.aspx?file_no=2017-05-015&flag=1&journal_id=wltb&year_id=2018
 *   [A2] 《物理通报》2020 年第 2 期《简易实验装置实现精确测定安培力与各变量关系》——
 *        "改变电流观察指针偏转角度随电流增大而增大""改变导线长度"。
 *        http://wltb.cnjournals.com/ch/reader/create_pdf.aspx?file_no=2020222&year_id=2020&quarter_id=2&falg=1
 *   [A3] 青夏教育《探究影响通电导线受力的因素》题解——"将一根直导线水平悬挂在三块
 *        蹄形磁铁间……改变实验条件得到实验结果（电流 I、接通位置、悬线偏角 θ）"。
 *        http://www.1010jiajiao.com/gzwl/shiti_id_a5031cc490a85c79505adab40d98737b
 *   [T1] 菁优网《探究变压器原、副线圈电压与匝数的关系》题解（可拆式变压器 / 器材取舍 /
 *        控制变量法 / 低压交流不超过 12 V / nₐ=400 匝、n_b=800 匝 实测 Uₐ、U_b 数据表）。
 *        https://www.jyeoo.com/shiti/68c20107-e15c-4c15-5f6e-41f47028c425
 *   [T2] 菁优网题解 ——"测得原、副线圈的匝数分别为 120 匝和 60 匝，原、副线圈两端的
 *        电压分别为 8.2 V 和 3.6 V，据此可知电压比与匝数比不相等，可能原因是
 *        漏磁、铁芯发热、导线发热等"。
 *        https://www.jyeoo.com/shiti/d1094a51-e158-1549-8554-9040625f335a
 *   [T3] 中国科学技术大学讲义《变压器 远距离输电》——理想变压器 U₁/U₂ = n₁/n₂。
 *        http://home.ustc.edu.cn/~wzq666/lec_zjt/变压器、远距离输电.pdf
 * ========================================================================== */
(function () {
  'use strict';

  // 挂载点：核心（js/pslab.js）按"核心 → 组"的顺序先加载，所以它一定已经在。
  // 万一被单独加载（例如只加载本文件做单测），就自己建一个最小注册表，
  // 绝不覆盖已经存在的核心 —— 这样"加载顺序错了"也不会把核心的接口冲掉。
  var host = window.QG_PSLAB;
  if (!host || typeof host.register !== 'function') {
    host = window.QG_PSLAB = window.QG_PSLAB || {};
    if (typeof host.register !== 'function') {
      host._specs = host._specs || {};
      host.register = function (id, spec) { host._specs[id] = spec; };
    }
  }

  // ───────────────────────── 通用小工具（纯 ES5）─────────────────────────
  var PI = Math.PI;
  var DEG = PI / 180;
  var G0 = 9.80;                      // 实验室当地重力加速度 g（m/s²），用于 F → Δm

  // lenz-law 的等效磁通梯度：k = 线圈有效截面 × 磁铁端面附近的有效轴向磁场梯度
  // 的合并值（磁铁强度已并入），单位 Wb/(m·匝)。取自"手插条形磁铁穿小螺线管"
  // 的典型量级（推导见文件头【1】与文件末假设 2）：
  //   N=200 匝、v=1 m/s、R=50 Ω → ε=4.0 mV、I=0.08 mA、指针约 0.8 格（可读且不饱和）
  var K_LENZ = 2.0e-5;                // [Wb/(m·匝)]
  var SENS_LENZ = 2000;               // [格/A] 灵敏电流计灵敏度（偏转 ±6 格）

  function num(v, d) {
    v = Number(v);
    return isFinite(v) ? v : d;
  }
  function pick(p, k, d) {
    return (p && p[k] !== undefined && p[k] !== null) ? p[k] : d;
  }
  // 文本 → 数字（核心若用 <select> 存字面量也能吃下）
  var TXT2NUM = { 'N': 1, 'S': -1, '+1': 1, '-1': -1, '向上': 1, '向下': -1,
                  '插入': 1, '拔出': -1, 'in': 1, 'out': -1 };
  function sgnOf(v, d) {
    if (typeof v === 'string') {
      var t = v.replace(/\s+/g, '');
      if (TXT2NUM[t] !== undefined) { return TXT2NUM[t]; }
    }
    v = Number(v);
    if (!isFinite(v)) { return d; }
    return v < 0 ? -1 : 1;
  }
  // 二元参数（磁极 N/S、插入/拔出…）在核心的滑块里必须写成 0/1：
  // 核心的 <input type=range> 遇到 step<=0 会退回 0.01，于是 min:-1,max:1,step:2 会变成
  // 一根"无极"滑块，能停在 0 或 ±0.3 这种没有物理意义的位置上。所以：
  //   params 用 min:0 / max:1 / step:1，语义在下面这个映射函数里。
  function binParam(v, d) {
    if (typeof v === 'string') {
      var t = v.replace(/\s+/g, '');
      if (TXT2NUM[t] !== undefined) { return TXT2NUM[t] > 0 ? 1 : 0; }
    }
    v = Number(v);
    if (!isFinite(v)) { return d; }
    return v >= 0.5 ? 1 : 0;
  }
  // 二元参数 → 物理符号：0 → +1（N 极 / 插入 / 正向），1 → −1（S 极 / 拔出 / 反向）
  function binSign(v, d) { return binParam(v, d) === 0 ? 1 : -1; }
  function binTxt(v, t0, t1, d) { return binParam(v, d) === 0 ? t0 : t1; }

  // 角度：θ 的旋钮只有 0~90°，但我们允许"180°"这类写法（sin 对称，物理上等价）
  function angOf(v, d) {
    if (typeof v === 'string') {
      var m = /(-?[0-9.]+)/.exec(v);
      v = m ? Number(m[1]) : NaN;
    }
    v = Number(v);
    return isFinite(v) ? v : d;
  }
  // 把 ctx 里的随机源包成"永远有值"的形式：
  //   核心给了 ctx.rnd() → 用它（每次测量都不同，符合"测量有随机性"）
  //   没给（单测/离线）→ 自己滚一个确定性序列（同一参数序列可复现，便于断言）
  function rngOf(ctx) {
    if (ctx && typeof ctx.rnd === 'function') {
      try { return Number(ctx.rnd()); } catch (e) { /* 落到下面的兜底 */ }
    }
    rngOf._s = ((rngOf._s * 1103515245 + 12345) % 2147483648 + 2147483648) % 2147483648;
    return rngOf._s / 2147483648;
  }
  rngOf._s = 987654321;

  // 有效数字取整：把"读数"落到仪器分辨力上，不假装自己是无穷精度的仿真。
  // signif(0.048369, 3) → 0.0484
  function signif(x, n) {
    x = Number(x);
    if (!isFinite(x) || x === 0) { return 0; }
    var r = Math.pow(10, n - 1 - Math.floor(Math.log(Math.abs(x)) / Math.LN10));
    return Math.round(x * r) / r;
  }

  // 感应电流 → 灵敏电流计指针偏转（格）。measure() 与 draw() 共用这一处口径，
  // 避免"数据表里的格数"和"画面上指针的位置"两套算法漂移：
  //   SENS_LENZ 格/A；读数落到 0.1 格；小于 0.02 mA 指针不动；表盘 ±6 格打满。
  function needleOf(currentMA) {
    var d = currentMA / 1000 * SENS_LENZ;
    if (Math.abs(currentMA) < 0.02) { d = 0; }
    d = Math.round(d * 10) / 10;
    if (d > 6) { d = 6; } else if (d < -6) { d = -6; }
    return d;
  }
  function fix(x, n) {
    x = Number(x);
    if (!isFinite(x)) { return '—'; }
    return x.toFixed(n);
  }
  // 均值；空数组返回 null
  function mean(a) {
    if (!a || !a.length) { return null; }
    var s = 0, i;
    for (i = 0; i < a.length; i++) { s += a[i]; }
    return s / a.length;
  }
  function col(rows, k) {
    var out = [], i, v;
    for (i = 0; i < rows.length; i++) {
      v = Number(rows[i] && rows[i][k]);
      if (isFinite(v)) { out.push(v); }
    }
    return out;
  }
  // 过原点最小二乘 y = a·x（物理上"磁通为零则电流为零""I 为零则力为零"，
  // 截距必须为 0，不能放自由截距把它拟合掉），R² = 1 − Σ(y−a x)² / Σy²
  function fitO(rows, kx, ky) {
    var sxy = 0, sxx = 0, syy = 0, n = 0, i, x, y, a, ss;
    for (i = 0; i < rows.length; i++) {
      x = Number(rows[i] && rows[i][kx]);
      y = Number(rows[i] && rows[i][ky]);
      if (!isFinite(x) || !isFinite(y)) { continue; }
      sxy += x * y; sxx += x * x; syy += y * y; n++;
    }
    if (n < 2 || sxx === 0) { return { a: null, b: 0, r2: 0, n: n }; }
    a = sxy / sxx;
    ss = 0;
    for (i = 0; i < rows.length; i++) {
      x = Number(rows[i] && rows[i][kx]);
      y = Number(rows[i] && rows[i][ky]);
      if (!isFinite(x) || !isFinite(y)) { continue; }
      ss += (y - a * x) * (y - a * x);
    }
    return { a: a, b: 0, r2: syy > 0 ? 1 - ss / syy : 0, n: n };
  }
  // 带截距最小二乘 y = a x + b（用于"读数 vs 自变量"的散点，r2 供契约 §7 判据用）
  function fitL(rows, kx, ky) {
    var n = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, i, x, y, d, a, b, ss = 0, syy = 0, my;
    var xs = [], ys = [], k;
    for (i = 0; i < rows.length; i++) {
      x = Number(rows[i] && rows[i][kx]);
      y = Number(rows[i] && rows[i][ky]);
      if (!isFinite(x) || !isFinite(y)) { continue; }
      xs.push(x); ys.push(y);
      sx += x; sy += y; sxy += x * y; sxx += x * x; n++;
    }
    if (n < 2) { return { a: null, b: null, r2: 0, n: n }; }
    d = n * sxx - sx * sx;
    if (d === 0) { return { a: null, b: null, r2: 0, n: n }; }
    a = (n * sxy - sx * sy) / d;
    b = (sy - a * sx) / n;
    my = sy / n;
    for (k = 0; k < n; k++) {
      syy += (ys[k] - my) * (ys[k] - my);
      ss += (ys[k] - (a * xs[k] + b)) * (ys[k] - (a * xs[k] + b));
    }
    return { a: a, b: b, r2: syy > 0 ? 1 - ss / syy : 0, n: n };
  }

  // ───────────────────── 画图工具：一个薄薄的手绘风画布封装 ─────────────────────
  // 约定：g = { c, w, h, paper, ink, font }（契约 §4）。所有坐标都用 w/h 归一化，
  // 舞台尺寸变了图形不会跑出画布。
  function wrap(g) {
    var c = g && g.c;
    var w = num(g && g.w, 900), h = num(g && g.h, 560);
    var paper = (g && g.paper) || '#F4F1EA';
    var ink = (g && g.ink) || '#26221C';
    var fontFn = (g && typeof g.font === 'function') ? g.font : null;
    var o = {
      c: c, w: w, h: h, paper: paper, ink: ink,
      S: Math.min(w / 900, h / 560),           // 统一缩放（基准 900×560）
      font: function (px, italic, bold) {
        // ⚠ 兼容性坑（实测）：核心的 g.font 签名是 font(size, style)，
        //   style 是**字符串**（'italic'/'bold'），不是布尔；把 true 当第二个参数传进去
        //   会拼出 "true 13px Georgia…" 这种非法字体串（浏览器会忽略整条 font 设置）。
        //   所以这里只传一个数值参数，样式由我们自己拼；万一宿主按别的签名实现，
        //   就检查返回串里有没有我们要求的 px 号，没有就用自己的兜底。
        var want = (italic ? 'italic ' : '') + (bold ? 'bold ' : '') + px.toFixed(1) + 'px Georgia, serif';
        if (!fontFn) { return want; }
        var s = null;
        try { s = fontFn(px); } catch (e) { s = null; }
        if (typeof s === 'string' && /px/.test(s) && s.indexOf(px.toFixed(1)) >= 0) { return s; }
        return want;
      },
      bg: function () { if (!c) { return; } c.fillStyle = paper; c.fillRect(0, 0, w, h); },
      // 墨色线条（可调透明度/线宽/虚线）
      inkLine: function (x1, y1, x2, y2, lw, alpha, dash) {
        if (!c) { return; }
        c.save();
        c.globalAlpha = (alpha === undefined || alpha === null) ? 1 : alpha;
        c.strokeStyle = ink;
        c.lineWidth = num(lw, 1);
        if (dash && c.setLineDash) { c.setLineDash(dash); }
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.restore();
      },
      colorLine: function (x1, y1, x2, y2, color, lw, alpha) {
        if (!c) { return; }
        c.save();
        c.globalAlpha = (alpha === undefined || alpha === null) ? 1 : alpha;
        c.strokeStyle = color; c.lineWidth = num(lw, 1);
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.restore();
      },
      rect: function (x, y, ww, hh, fill, stroke, lw) {
        if (!c) { return; }
        c.save();
        if (fill) { c.fillStyle = fill; c.fillRect(x, y, ww, hh); }
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = num(lw, 1); c.strokeRect(x, y, ww, hh); }
        c.restore();
      },
      circle: function (x, y, r, fill, stroke, lw) {
        if (!c) { return; }
        c.save();
        c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, PI * 2, false);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = num(lw, 1); c.stroke(); }
        c.restore();
      },
      // 文字：水平和垂直对齐都显式定，避免不同浏览器 maxWidth 行为差异
      text: function (s, x, y, px, align, color, italic, bold, alpha) {
        if (!c) { return; }
        c.save();
        c.globalAlpha = (alpha === undefined || alpha === null) ? 1 : alpha;
        c.fillStyle = color || ink;
        c.font = o.font(num(px, 13), italic, bold);
        c.textAlign = align || 'left';
        c.textBaseline = 'middle';
        c.fillText(String(s), x, y);
        c.restore();
      },
      arrow: function (x1, y1, x2, y2, color, lw, head) {
        if (!c) { return; }
        var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) { return; }
        var hs = num(head, 9), ux = dx / len, uy = dy / len;
        c.save();
        c.fillStyle = color || ink; c.strokeStyle = color || ink; c.lineWidth = num(lw, 1.6);
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - ux * hs * 0.7, y2 - uy * hs * 0.7); c.stroke();
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - ux * hs - uy * hs * 0.42, y2 - uy * hs + ux * hs * 0.42);
        c.lineTo(x2 - ux * hs + uy * hs * 0.42, y2 - uy * hs - ux * hs * 0.42);
        c.closePath(); c.fill();
        c.restore();
      },
      // 折线（可带箭头）：pts = [[x,y], ...]
      poly: function (pts, color, lw, alpha) {
        if (!c || !pts || pts.length < 2) { return; }
        var i;
        c.save();
        c.globalAlpha = (alpha === undefined || alpha === null) ? 1 : alpha;
        c.strokeStyle = color || ink; c.lineWidth = num(lw, 1);
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (i = 1; i < pts.length; i++) { c.lineTo(pts[i][0], pts[i][1]); }
        c.stroke(); c.restore();
      },
      // 线圈端面（俯视图里的一圈圈导线）
      ellipse: function (x, y, rx, ry, fill, stroke, lw) {
        if (!c || !c.ellipse) { o.circle(x, (y), rx, fill, stroke, lw); return; }
        c.save();
        c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, PI * 2, false);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = num(lw, 1); c.stroke(); }
        c.restore();
      },
      // 多行文字
      lines: function (arr, x, y, px, lh, align, color, italic, bold) {
        var i;
        for (i = 0; i < arr.length; i++) {
          o.text(arr[i], x, y + i * num(lh, px * 1.45), px, align, color, italic, bold);
        }
      }
    };
    return o;
  }

  // 小工具：正数返回 '+'，负数返回 '−'（真减号，排版好看）
  function sgnTxt(v) { return v > 0 ? '+' : (v < 0 ? '\u2212' : '0'); }

  /* ==========================================================================
   * 实验 1 / 3：lenz-law —— 探究影响感应电流方向的因素（楞次定律）
   * ======================================================================== */
  var LENZ = {
    id: 'lenz-law',
    name: '探究影响感应电流方向的因素',
    group: '磁场与电磁感应',
    aim: '把条形磁铁插入或拔出螺线管，观察灵敏电流计指针的偏转方向，找出感应电流方向与原磁场方向、磁通量变化之间的关系，归纳出楞次定律。',

    principle:
      '法拉第电磁感应定律：ε = N·ΔΦ/Δt，磁通量变化越快，感应电动势（因而感应电流）越大。' +
      '楞次定律：感应电流的磁场总要阻碍引起感应电流的磁通量的变化 —— “增反减同”：' +
      '磁铁插入（穿过线圈的磁通量增大）时，感应电流的磁场与原磁场方向相反；' +
      '磁铁拔出（磁通量减小）时，与原磁场方向相同。' +
      '闭合回路里 I = ε/R（R 为螺线管电阻 + 电流计内阻 + 导线电阻），' +
      '所以指针偏转角随插入速度、线圈匝数增大而增大，而偏转方向随磁极和插/拔同时反向。',

    apparatus: [
      '条形磁体（N、S 极已标注）',
      '螺线管（匝数可数，本模型 50~400 匝）',
      '灵敏电流计（零刻度在中央，左右各 6 格）',
      '导线若干',
      '干电池、电池盒、开关、滑动变阻器（用于试触法确定指针偏转方向与电流方向的关系）'
    ],

    steps: [
      '先用试触法确定电流计指针偏转方向与电流方向的关系：把干电池、开关、滑动变阻器与电流计接成回路，用导线试触，记下“电流从哪一侧接线柱流入、指针向哪一侧偏转”（本模型沿用“左进左偏、右进右偏”）。试触时串入滑动变阻器限流、点触即离，防止电流过大或通电时间过长损坏电流计。',
      '明确螺线管的绕线方向，并画出绕线草图（绕向决定了感应电流方向与指针偏转方向的对应关系）。',
      '按控制变量法设计记录表：分别做“N 极向下插入”“S 极向下插入”“N 极向上拔出”“S 极向上拔出”四种情况。',
      '把条形磁体缓慢插入螺线管，观察并记录指针偏转方向、线圈内原磁场方向与磁通量的变化（增大）。',
      '等电流计指针回零后，把条形磁体从螺线管中拔出，同样记录指针偏转方向与磁通量的变化（减小）。',
      '改变磁体插入/拔出的快慢（以及换用不同匝数的螺线管），重复上述操作，比较指针偏转角的大小。',
      '归纳四次记录：磁通量增大时感应电流的磁场与原磁场方向相反，减小时相同 —— 即感应电流的磁场总要阻碍原磁通量的变化（楞次定律）。'
    ],

    params: [
      // 二元量一律写成 0/1 滑块（核心不支持 step<=0 的"无极"滑块，见文件末假设 5）：
      //   0 = N 极朝下、1 = S 极朝下；0 = 插入、1 = 拔出
      { key: 'dir', label: '磁极（0=N 极朝下, 1=S 极朝下）', unit: '', min: 0, max: 1, step: 1, value: 0,
        labels: { '0': 'N 极朝下', '1': 'S 极朝下' } },
      { key: 'act', label: '动作（0=插入, 1=拔出）', unit: '', min: 0, max: 1, step: 1, value: 0,
        labels: { '0': '插入（磁通量增大）', '1': '拔出（磁通量减小）' } },
      { key: 'N', label: '螺线管匝数 N', unit: '匝', min: 50, max: 400, step: 50, value: 200 },
      { key: 'v', label: '插入/拔出速度 v', unit: 'm/s', min: 0.2, max: 2, step: 0.1, value: 1 },
      { key: 'R', label: '回路总电阻 R', unit: 'Ω', min: 20, max: 200, step: 5, value: 50 }
    ],

    // 真实模型：ε = N·k·v²（法拉第：变化越快电动势越大）→ I = ε/R（欧姆）→ 指针偏转；
    // 方向由楞次定律定：I = −(1/R)·dΦ/dt（"阻碍"）。
    // k = K_LENZ，来历见文件头【1】与文件末假设 2。
    // 误差来源（都是"可解释"的，不是随便加噪声）：
    //   ① 等效磁通梯度 k 本身就带不确定度（磁铁姿态、磁极到线圈端面的距离
    //      取 0.12 m 是人手操作的典型值，实际每次差几毫米）→ 用 (1 ± 12%) 表示；
    //   ② 回路电阻随温度/接触电阻变（+ 导线焊接点）→ (1 ± 3%)；
    //   ③ 灵敏电流计分辨力有限：读数落到 0.1 格；小于 0.02 mA 时指针不动。
    measure: function (p, ctx) {
      var s = binSign(pick(p, 'dir', 0), 0);           // +1 = N 极朝下（下场指向线圈内部）
      var actIdx = binParam(pick(p, 'act', 0), 0);     // 0 = 插入、1 = 拔出
      var act = actIdx === 0 ? 1 : -1;
      var dirPole = s > 0 ? 'N 极朝下' : 'S 极朝下';
      var actTxt = act > 0 ? '插入' : '拔出';
      var N = num(pick(p, 'N', 200), 200);
      var v = Math.abs(num(pick(p, 'v', 1), 1));
      var R0 = Math.max(1, num(pick(p, 'R', 50), 50));

      var u = rngOf(ctx);
      var kEff = K_LENZ * (1 + 0.12 * (2 * u - 1));        // ① 位置/姿态不确定度
      var REff = R0 * (1 + 0.03 * (2 * rngOf(ctx) - 1));   // ② 电阻温度/接触

      // 磁通量变化方向：+ 增大（插入）/ − 减小（拔出）
      var signChg = act;
      // 磁通量变化率（带符号）：Φ 沿"感应电流磁场正方向"（本模型按绕向取竖直向上）
      // 计量，则 Φ = −s·ξ（磁铁下场指向 −s），故
      //   dΦ/dt = −s·signChg·(N·k·v²)         … (1)
      // 而感应电流按同一正方向计量，代入法拉第定律得
      //   I = ε/R = −(1/R)·dΦ/dt              … (2)  ← 这就是"阻碍"（楞次定律）
      // 由 (1)(2)：I = −s·signChg·N·k·v²/R，于是数据表里"磁通量变化率"与
      // "感应电流"严格成**过原点、斜率为 −1/R 的下降直线** —— 楞次定律本身就是图形结论。
      var fluxRate = -s * signChg * (N * kEff * v * v);    // [Wb/s]，带符号
      var emf = N * kEff * v * v;                          // [V] ε = |dΦ/dt|
      var I = emf / REff;                                  // [A]

      // 感应电流符号与 dΦ/dt 反号（(2) 式），即 −sign(fluxRate)
      var iSense = -s * signChg;                   // + 表示感应电流磁场竖直向上
      if (fluxRate !== 0) { iSense = fluxRate > 0 ? -1 : 1; }
      var currentMA = iSense * I * 1000;           // [mA]，带方向

      // 电流计读数（与 measure() 同一个 needleOf 口径）
      var defl = needleOf(currentMA);
      var dirTxt = defl > 0 ? '向右偏' : (defl < 0 ? '向左偏' : '不偏');

      return {
        trial: 0,                                  // 行号由核心按数据表顺序给（0 = 未标注）
        dirPole: dirPole,                                 // 磁极（人读）
        actC: actTxt,                                     // 动作（人读）
        dir: s > 0 ? 'N 极朝下' : 'S 极朝下',
        act: actTxt,
        v: Math.round(v * 100) / 100,
        fluxRate: signif(fluxRate * 1000, 3),             // [mWb/s]，带方向（符号=变化方向）
        absRate: signif(Math.abs(fluxRate) * 1000, 3),    // [mWb/s]，大小（作图用）
        emf: signif(emf * 1000, 3),                       // [mV]
        I: signif(currentMA, 3),                          // [mA]，带方向
        absI: signif(Math.abs(currentMA), 3),             // [mA]，大小（作图用）
        needle: defl,                                     // [格]
        sense: dirTxt
      };
    },

    columns: [
      { key: 'trial', label: '第 n 次', unit: '' },
      { key: 'dirPole', label: '磁极', unit: '' },
      { key: 'actC', label: '动作', unit: '' },
      { key: 'v', label: '速度 v', unit: 'm/s' },
      { key: 'fluxRate', label: '磁通量变化率', unit: 'mWb/s' },
      { key: 'absRate', label: '|磁通量变化率|', unit: 'mWb/s' },
      { key: 'emf', label: '感应电动势 ε', unit: 'mV' },
      { key: 'I', label: '感应电流 I', unit: 'mA' },
      { key: 'absI', label: '|感应电流|', unit: 'mA' },
      { key: 'needle', label: '指针偏转', unit: '格' },
      { key: 'sense', label: '指针方向', unit: '' }
    ],

    // 作图取"大小"：法拉第定律给出 |I| = (1/R)·|dΦ/dt| —— 过原点、斜率为 1/R 的上升
    // 直线，插入与拔出两组数据因此落在同一条线上（学生实测描点就是这么描的）。
    // 方向信息（楞次定律"阻碍"）并没有丢：它落在 fluxRate / I 的**符号**、needle 的
    // 正负与 sense 列上 —— 若把带符号的两组硬画成一条线，反而会得到一个无意义的拟合。
    graph: {
      x: 'absRate', y: 'absI', fit: 'linear', through: true,
      title: '感应电流大小 |I| 与磁通量变化率大小 |ΔΦ/Δt| 的关系',
      note: '过原点直线的斜率 = 1/R；插入与拔出落在同一条线上，方向相反由 fluxRate 的符号体现'
    },

    conclude: function (rows, p, ctx) {
      var f = fitO(rows, 'absRate', 'absI');
      var R = Math.max(1, num(pick(p, 'R', 50), 50));
      var i, insSum = 0, outSum = 0, insN = 0, outN = 0;
      for (i = 0; i < rows.length; i++) {
        var cu = Number(rows[i].I);
        if (!isFinite(cu)) { continue; }
        // 按"动作"分组统计（不靠符号约定，免得插入/拔出被搞反）
        var isIn = String(rows[i].act || '').indexOf('插') >= 0;
        if (isIn) { insSum += cu; insN++; } else { outSum += cu; outN++; }
      }
      var mag = col(rows, 'absI');
      var imax = 0;
      for (i = 0; i < mag.length; i++) { if (mag[i] > imax) { imax = mag[i]; } }
      // 楞次定律的最硬判据：每一组里 fluxRate 与 I 的符号都相反（"阻碍"）
      var flip = 0, flipN = 0;
      for (i = 0; i < rows.length; i++) {
        var fr2 = Number(rows[i].fluxRate), cu2 = Number(rows[i].I);
        if (!isFinite(fr2) || !isFinite(cu2) || fr2 === 0 || cu2 === 0) { continue; }
        flipN++;
        if (fr2 * cu2 < 0) { flip++; }
      }
      var insMean = insN ? insSum / insN : 0, outMean = outN ? outSum / outN : 0;
      var n = f.n || rows.length;
      var slope = (f.a === null ? 1 / R : f.a);
      var text = '共记录 ' + n + ' 组数据：感应电流大小 |I| 与磁通量变化率大小 |ΔΦ/Δt| 成正比，' +
        '图线是一条过原点的直线，斜率 = ' + fix(slope, 4) + ' mA/(mWb/s)（理论值 1/R = ' + fix(1 / R, 4) +
        ' mA/(mWb/s)，R = ' + fix(R, 0) + ' Ω），r² = ' + fix(f.r2, 4) + '；最大感应电流 ' + fix(imax, 3) +
        ' mA。方向方面：插入（磁通量增大）时电流平均 ' + fix(insMean, 3) + ' mA、拔出（磁通量减小）时平均 ' +
        fix(outMean, 3) + ' mA，两者符号相反、指针反向偏转；' +
        (flipN > 0 ? ('全部 ' + flipN + ' 组里 fluxRate 与 I 的符号都相反（' + flip + '/' + flipN +
                      '，即电流方向总与磁通量变化方向相反）—— ') : '') +
        '即感应电流的磁场总要阻碍原磁通量的变化（楞次定律）：增反减同，且变化越快电流越大。';
      return {
        value: signif(slope, 4),
        unit: 'mA/(mWb/s)',
        text: text,
        errors: [
          '等效磁通梯度 k 按“磁极到线圈端面约 0.12 m”估算，磁铁姿态、偏心与每次插入深度的差异会使 k 变动约 ±12%',
          '回路电阻随导线温度、接线柱接触电阻变化约 ±3%（本模型 R 已按此扰动）',
          '灵敏电流计分辨力有限：偏转读数只到 0.1 格，电流小于 0.02 mA 时指针不动（测不出方向）',
          '插入/拔出的“瞬时速度”由手控制，实测中前后快慢不均，dΦ/dt 的峰值与平均值有差别'
        ]
      };
    },

    // 画面：条形磁铁 + 螺线管（侧视，内部按实际匝数画出导线层）+ 灵敏电流计
    draw: function (g, p, state) {
      var o = wrap(g), c = o.c;
      if (!c) { return; }
      state = state || {};
      var s = binSign(pick(p, 'dir', 0), 0);           // +1 = N 极朝下
      var act = binParam(pick(p, 'act', 0), 0) === 0 ? 1 : -1;   // +1 = 插入
      var N = num(pick(p, 'N', 200), 200);
      var v = Math.abs(num(pick(p, 'v', 1), 1));
      var Ract = Math.max(1, num(pick(p, 'R', 50), 50));
      var t = num(state.t, 0);

      var S = o.S, w = o.w, h = o.h;
      var cx = w * 0.40;                        // 螺线管轴
      var coilH = h * 0.30;                     // 螺线管高
      var coilW = w * 0.17;                     // 螺线管外径
      var cy = h * 0.40;                        // 螺线管中心
      var coilTop = cy - coilH / 2, coilBot = cy + coilH / 2;

      o.bg();
      o.text('条形磁铁 + 螺线管 + 灵敏电流计', w * 0.03, h * 0.045, 15 * S + 8, 'left', o.ink, true, true);
      o.text('楞次定律：感应电流的磁场总要阻碍原磁通量的变化（增反减同）',
             w * 0.03, h * 0.045 + (15 * S + 8) * 1.5, 12 * S + 7, 'left', o.ink, false, false, 0.75);

      // ── 磁铁位置：相位 ph 是唯一的"位置"状态（−0.35 = 管口上方，1 = 完全插入）
      //    ph 由 step()（自动往复）或 onPointer()（手拖）推进；draw() 只负责按 ph 落位。
      //    ⚠ 位置状态只影响画面，不影响任何测量值（物理量一律由参数经模型算出）。
      var ph;
      if (typeof state.magnetPhase === 'number' && isFinite(state.magnetPhase)) {
        ph = state.magnetPhase;
        if (ph < -0.6) { ph = -0.6; } else if (ph > 1.15) { ph = 1.15; }
      } else {
        ph = act > 0 ? -0.35 : 1.0;            // 首次落位：插入 → 从管口上方开始；拔出 → 从管内开始
      }
      var magH = 26 * S + 46, magW = 12 * S + 22;
      var entry = coilTop - 8 * S;             // ph = 0 时磁铁下端正好在管口
      var depthMax = coilH * 0.9;
      var my = entry + ph * depthMax;          // ph 增大 = 磁铁下端向下走（插入）
      var inside = ph > 0.05;                  // 磁极已经进入管内 → 磁通量在变
      // 记下管口位置，供 onPointer 把指针坐标换算成相位（与这里的口径完全一致）
      state._entryY = entry;

      // ── 螺线管：画 10 层导线，层数按实际匝数映射（50 匝→1 层，400 匝→10 层）
      var layers = Math.max(1, Math.min(10, Math.round(N / 40)));
      var gap = coilW / (layers + 1);
      var i, x;
      // 管腔（米白，露出磁铁）
      o.rect(cx - coilW / 2 + gap * 0.35, coilTop, coilW - gap * 0.7, coilH, null, null, 0);
      for (i = 1; i <= layers; i++) {
        x = cx - coilW / 2 + gap * i;
        var rx = Math.max(2.5, gap * 0.62);
        o.ellipse(x, coilTop, rx, rx * 0.42, null, o.ink, 1.3);
        o.ellipse(x, coilBot, rx, rx * 0.42, null, o.ink, 1.3);
        o.inkLine(x, coilTop, x, coilBot, 1.3, 0.9);
      }
      o.text('螺线管 N = ' + Math.round(N) + ' 匝', cx, coilBot + 22 * S + 14, 12 * S + 6, 'center', o.ink, true);
      // 绕向标注（决定了“指针偏左/偏右”的绝对符号，见文件末假设）
      o.text('绕向：从上往下看为顺时针', cx + coilW * 0.6, coilTop - 12 * S - 8, 10 * S + 5, 'left', o.ink, false, false, 0.6);

      // ── 磁铁（画在螺线管之后：插入时磁铁压在管腔之上，视觉上“进去了”）
      var mgTop = my - magH;
      // 磁极：s>0 表示 N 极朝下（指向线圈）
      var topPole = s > 0 ? 'S' : 'N', botPole = s > 0 ? 'N' : 'S';
      o.rect(cx - magW / 2, mgTop, magW, magH / 2, '#B9B3A6', o.ink, 1.6);
      o.rect(cx - magW / 2, mgTop + magH / 2, magW, magH / 2, '#6E675C', o.ink, 1.6);
      o.text(topPole, cx, mgTop + magH * 0.25, 12 * S + 5, 'center', o.ink, false, true);
      o.text(botPole, cx, mgTop + magH * 0.75, 12 * S + 5, 'center', '#F4F1EA', false, true);
      o.text('条形磁体', cx - magW / 2 - 10 * S - 4, mgTop + magH / 2, 11 * S + 5, 'right', o.ink, true);

      // 磁铁运动箭头（按参数方向 + 动画相位轻微呼吸，表示持续运动）
      var jit = 3 * S * Math.sin(t * 4);
      if (act > 0) {
        o.arrow(cx + magW / 2 + 12 * S + 6, mgTop + magH / 2 - 14 * S + jit,
                cx + magW / 2 + 12 * S + 6, mgTop + magH / 2 + 14 * S + jit, '#2F6F4F', 1.8 * S + 0.6, 9 * S + 4);
      } else {
        o.arrow(cx + magW / 2 + 12 * S + 6, mgTop + magH / 2 + 14 * S + jit,
                cx + magW / 2 + 12 * S + 6, mgTop + magH / 2 - 14 * S + jit, '#8C3B2E', 1.8 * S + 0.6, 9 * S + 4);
      }
      o.text(act > 0 ? 'v 插入' : 'v 拔出', cx + magW / 2 + 12 * S + 12, mgTop + magH / 2,
             11 * S + 5, 'left', act > 0 ? '#2F6F4F' : '#8C3B2E', true, true);

      // ── 磁通量变化提示（管内）：箭头方向表示 Φ 增大/减小
      if (inside) {
        var fx = cx, fy0 = coilBot - coilH * 0.18, fy1 = coilTop + coilH * 0.18;
        o.colorLine(fx - 0, fy0, fx, fy1, 'rgba(140,59,46,0.55)', 1.2 * S + 0.4, 0.9);
        o.text(act > 0 ? 'Φ 增大' : 'Φ 减小', cx + 6 * S + 4, (fy0 + fy1) / 2,
               10 * S + 5, 'left', 'rgba(140,59,46,0.8)', true);
      }

      // ── 感应电流 / 指针偏转：优先用 state 的“实时值”（动画），否则用一次测量
      var live = null, liveValid = false;
      if (state.live && isFinite(Number(state.live.I))) { live = Number(state.live.I); liveValid = true; }
      if (!liveValid && state.rows && state.rows.length) {
        var last = state.rows[state.rows.length - 1];
        if (last && isFinite(Number(last.I))) { live = Number(last.I); liveValid = true; }
      }
      if (!liveValid) {
        // 参数预览（把当前滑块值代进同一个模型，不写死常量）
        var sense0 = -act * s;
        live = sense0 * (N * K_LENZ * v * v) / Ract * 1000;
      }
      var curMA = live;
      var defl = needleOf(curMA);               // 与 measure() 同一个口径
      var iNeg = curMA < 0;                     // 感应电流磁场方向：正 = 竖直向上

      // 螺线管上的感应电流箭头：沿导线层循环（用相位驱动的“流动”表示方向）
      if (Math.abs(curMA) >= 0.02) {
        var phase = t * 6 * (curMA > 0 ? 1 : -1);
        for (i = 1; i <= layers; i++) {
          x = cx - coilW / 2 + gap * i;
          var tt = ((i / (layers + 1)) + (phase / (2 * PI))) % 1;
          if (tt < 0) { tt += 1; }
          // 沿这一层从一端到另一端循环的亮点（箭头只在节点画，保证是"方向"而不是装饰）
          var yA = coilTop + coilH * tt;
          var up = curMA > 0 ? (i % 2 === 1) : (i % 2 === 0);
          var y1p = up ? yA - 7 * S : yA + 7 * S;
          o.arrow(x, yA, x, y1p, '#25507A', 1.6 * S + 0.5, 7 * S + 3);
        }
      }

      // ── 灵敏电流计（零刻度在中央，左右各 6 格）
      var gx = w * 0.755, gy = h * 0.55, gr = Math.min(w, h) * 0.155;
      gy = Math.max(gy, coilBot + gr + 40 * S);
      o.rect(gx - gr * 1.25, gy - gr * 1.15, gr * 2.5, gr * 2.05, '#EFEADF', o.ink, 1.8);
      o.text('灵敏电流计', gx, gy - gr * 0.86, 11 * S + 6, 'center', o.ink, false, true);
      // 表盘弧
      var a0 = -PI * 0.82, a1 = -PI * 0.18, k, ang, wx, wy;
      if (c.beginPath) {
        c.save(); c.strokeStyle = o.ink; c.lineWidth = 1.2;
        c.beginPath(); c.arc(gx, gy + gr * 0.55, gr * 0.9, a0, a1, false); c.stroke(); c.restore();
      }
      for (k = -6; k <= 6; k++) {
        ang = a0 + (a1 - a0) * ((k + 6) / 12);
        wx = gx + Math.cos(ang) * gr * 0.9;
        wy = gy + gr * 0.55 + Math.sin(ang) * gr * 0.9;
        var big = (k % 2 === 0);
        var lx = gx + Math.cos(ang) * (gr * (big ? 0.79 : 0.84));
        var ly = gy + gr * 0.55 + Math.sin(ang) * (gr * (big ? 0.79 : 0.84));
        o.inkLine(lx, ly, wx, wy, big ? 1.3 : 0.9, big ? 0.9 : 0.55);
        if (big) {
          o.text(String(Math.abs(k)), gx + Math.cos(ang) * gr * 0.66,
                 gy + gr * 0.55 + Math.sin(ang) * gr * 0.66, 9 * S + 4, 'center', o.ink, false, false, 0.75);
        }
      }
      o.text('0', gx, gy + gr * 0.55 - gr * 0.95, 10 * S + 4, 'center', o.ink, false, true);
      // 指针（零刻度在中央：defl>0 向右偏）
      var angN = a0 + (a1 - a0) * ((defl + 6) / 12);
      o.arrow(gx, gy + gr * 0.55, gx + Math.cos(angN) * gr * 0.92, gy + gr * 0.55 + Math.sin(angN) * gr * 0.92,
              '#8C3B2E', 2.2 * S + 0.8, 8 * S + 3);
      o.circle(gx, gy + gr * 0.55, 3 * S + 1.6, o.ink, null, 0);
      var dirTxt = defl > 0 ? '向右偏' : (defl < 0 ? '向左偏' : '不偏');
      o.text('指针 ' + dirTxt + '（' + fix(defl, 1) + ' 格）', gx, gy + gr * 1.02,
             12 * S + 6, 'center', o.ink, true, true);

      // ── 读数面板（右侧留白会与表盘重叠，故放在左下）
      var bx = w * 0.03, by = h * 0.70;
      o.inkLine(bx, by - 16 * S, bx + w * 0.30, by - 16 * S, 1, 0.25);
      var info = [
        '感应电流 I = ' + fix(curMA, 3) + ' mA',
        '指针偏转 = ' + fix(defl, 1) + ' 格（' + dirTxt + '）',
        '感应电流磁场方向：' + (Math.abs(curMA) < 0.02 ? '无（指针不动）' : (iNeg ? '与原磁场相同（阻碍减小）' : '与原磁场相反（阻碍增大）')),
        '插入速度 v = ' + fix(v, 2) + ' m/s　回路 R = ' + fix(Ract, 0) + ' Ω'
      ];
      o.lines(info, bx, by, 12 * S + 6, (12 * S + 6) * 1.5, 'left', o.ink, false, false);

      // 提示：可以拖磁铁
      o.text('提示：按住画布拖动可用手“插入/拔出”磁铁（松手后自动往复运动）',
             w * 0.03, h - 14 * S, 11 * S + 5, 'left', o.ink, true, false, 0.6);
    },

    // 运行时推进：磁铁自动"插入 → 拔出 → 再插入"，并算出实时感应电流供画面用。
    // 只动画面状态（state.magnetPhase / state.live），**不碰参数、不碰数据表**。
    step: function (p, state, dt) {
      dt = num(dt, 0.016);
      if (dt > 0.05) { dt = 0.05; }             // 掉帧时不要一步跳太远
      state.t = num(state.t, 0) + dt;
      var N = num(pick(p, 'N', 200), 200);
      var s = binSign(pick(p, 'dir', 0), 0);           // +1 = N 极朝下
      var act = binParam(pick(p, 'act', 0), 0) === 0 ? 1 : -1;   // +1 = 插入
      var R = Math.max(1, num(pick(p, 'R', 50), 50));
      var v = Math.max(0.05, Math.abs(num(pick(p, 'v', 1), 1)));

      if (typeof state.magnetPhase !== 'number' || !isFinite(state.magnetPhase)) {
        state.magnetPhase = act > 0 ? -0.35 : 1.0;
      }
      var PH_MIN = -0.35, PH_MAX = 1.0;
      if (!state.dir || state.dir === 0) { state.dir = act; }
      // v 越大，一次插拔越快（0.2 m/s → 约 19 s 一个来回；3 m/s → 约 1.3 s）
      var rate = v * 0.18;
      var next = state.magnetPhase + state.dir * rate * dt;
      if (next >= PH_MAX) { next = PH_MAX; state.dir = -1; }         // 插到底就改为拔出
      else if (next <= PH_MIN) { next = PH_MIN; state.dir = 1; }     // 拔出来就改为插入
      state.magnetPhase = next;

      // 实时感应电流（与 measure 同一个模型：ε = N·k·v·s，I = ε/R，方向 = −sign(变化方向)·磁场方向）
      var chg = state.dir > 0 ? 1 : -1;         // 1 = 插入（磁通量增大）、−1 = 拔出（减小）
      var sense = -chg * s;                     // + 表示感应电流的磁场竖直向上
      state.live = { I: sense * (N * K_LENZ * v * v) / R * 1000, chg: chg };
    },

    // 交互：按下并拖动 = 用手插拔磁铁（只动画面相位；松手后 step 接着来回动）
    onPointer: function (ev, p, state) {
      if (!ev || !state) { return; }
      if (!state.dir || state.dir === 0) { state.dir = binParam(pick(p, 'act', 0), 0) === 0 ? 1 : -1; }
      state._drag = (ev.type === 'down') ? true : (ev.type === 'up' ? false : state._drag);
      if (typeof ev.y !== 'number' || !isFinite(ev.y)) { return; }
      var ph = state.magnetPhase;
      if (typeof ph !== 'number' || !isFinite(ph)) { ph = 0; }
      // 指针坐标 → 相位：优先用 draw() 记下的实际管口位置（state._entryY），
      // 其次按核心舞台的 760×470 基准估算（见文件末假设 5）
      var stgH = num(state._stageH, 470);
      var dPh = (ev.y - num(state._entryY, stgH * 0.40 - stgH * 0.30 / 2 - 8)) / (stgH * 0.30 * 0.9);
      var np = ph + dPh * 0.5;
      if (np < -0.35) { np = -0.35; } else if (np > 1.0) { np = 1.0; }
      // 变化方向：往里推 = 插入
      if (np > ph + 1e-4) { state.dir = 1; } else if (np < ph - 1e-4) { state.dir = -1; }
      state.magnetPhase = np;

      var N = num(pick(p, 'N', 200), 200);
      var s = binSign(pick(p, 'dir', 0), 0);
      var R = Math.max(1, num(pick(p, 'R', 50), 50));
      var v = Math.abs(num(pick(p, 'v', 1), 1));
      var chg = state.dir > 0 ? 1 : -1;
      state.live = { I: (-chg * s) * (N * K_LENZ * v * v) / R * 1000, chg: chg };
    }
  };

  /* ==========================================================================
   * 实验 2 / 3：ampere-force —— 探究影响通电导线受力的因素
   * ======================================================================== */
  var AMPERE = {
    id: 'ampere-force',
    name: '探究影响通电导线受力的因素',
    group: '磁场与电磁感应',
    aim: '用天平（或弹簧测力计）测出通电导线在磁场中受到的安培力，分别改变电流 I、导线在磁场中的长度 L 和磁场方向与电流方向的夹角 θ，找出安培力的大小规律并验证 F = BIL sinθ、方向用左手定则判断。',

    principle:
      '安培力大小：F = B·I·L·sinθ，θ 为电流方向与磁场方向的夹角；' +
      '当导线与磁感线平行（θ = 0° 或 180°）时 sinθ = 0，F = 0 —— 通电导线与磁场平行时不受安培力。' +
      '方向用左手定则：伸开左手，让磁感线穿过掌心，四指指向电流方向，拇指所指即安培力方向。' +
      '测量用“称重法”：让导线受到的竖直安培力作用在天平（或弹簧测力计）上，' +
      '天平示数的变化量 Δm = F/g（g 取 9.80 m/s²），于是 F = Δm·g。' +
      '控制变量：分别保持 L、θ、B 不变只改 I，保持 I、θ、B 不变只改 L，即可看出 F ∝ I、F ∝ L。',

    apparatus: [
      '蹄形磁铁（或磁场方向可调的匀强磁场装置，磁感应强度 B ≈ 0.35 T）',
      '通电导体棒（长度可换：2~12 cm 的一段位于磁场中）',
      '电子天平（0.01 g 分辨力）或弹簧测力计，用来测导线受到的安培力',
      '直流电源、滑动变阻器、电流表（0~3 A）、开关、导线若干',
      '刻度尺（测导线在磁场中的有效长度 L）、支架与夹具'
    ],

    steps: [
      '按控制变量法设计记录表：分别研究 F 与 I、F 与 L、F 与 θ 的关系（本模型 8 行数据即“只改 I”的主扫描）。',
      '把导体棒水平放入蹄形磁铁两极之间，先断开开关，记下此时天平的示数（这是扣除了导线重力的“零点”）。',
      '闭合开关，调节滑动变阻器改变电流 I，在电流表上读出 I，同时记下天平示数的变化量 Δm，由 F = Δm·g 算出安培力。',
      '保持 I 与 B 不变，换用不同长度的导体棒（或改变导线在磁场中的有效长度 L），重复测量，比较 F 与 L 的关系。',
      '保持 I、L 不变，转动磁铁（或转动导线）改变电流方向与磁场方向的夹角 θ，观察天平示数变化，特别注意 θ = 0°（导线与磁感线平行）时天平示数不变 —— 此时 F = 0。',
      '用左手定则判断每次导线受力的方向，并与天平示数的“增大/减小”对照验证。',
      '作 F–I 图线（或 F–IL 图线），由直线的斜率求出磁感应强度 B，并与磁场装置的标称值比较。'
    ],

    params: [
      { key: 'B', label: '磁感应强度 B', unit: 'T', min: 0.05, max: 0.5, step: 0.01, value: 0.35 },
      { key: 'I', label: '电流 I', unit: 'A', min: 0.5, max: 3, step: 0.1, value: 2 },
      { key: 'L', label: '磁场中导线长度 L', unit: 'm', min: 0.02, max: 0.12, step: 0.01, value: 0.08 },
      { key: 'theta', label: 'I 与 B 的夹角 θ', unit: '°', min: 0, max: 90, step: 5, value: 90 },
      { key: 'dir', label: '电流方向（0=正向左→右, 1=反向右→左）', unit: '', min: 0, max: 1, step: 1, value: 0 }
    ],

    // 真实模型：F = B·I·L·sinθ；F = Δm·g；误差来源：
    //   ① 导线在磁场中的“有效长度”L 用刻度尺量，两端各差半毫米 → ±3%（L 越短占比越大）；
    //   ② 蹄形磁铁两极间 B 并非处处相同，导线位置每偏一点 B 变 ±1.5%；
    //   ③ 天平分辨力 0.01 g，且气流/振动使示数在 ±0.005 g 内跳动 → 力小于约 1.5 mN 测不出；
    //   ④ 电流表读数与电流热效应引起的漂移 ±1%。
    measure: function (p, ctx) {
      var B0 = Math.max(0.001, num(pick(p, 'B', 0.35), 0.35));
      var I0 = Math.abs(num(pick(p, 'I', 2), 2));
      var L0 = Math.max(0.001, num(pick(p, 'L', 0.08), 0.08));
      var th = angOf(pick(p, 'theta', 90), 90);
      var sgnI = binSign(pick(p, 'dir', 0), 0);   // +1 = 电流正向（左→右）
      var sinT = Math.abs(Math.sin(th * DEG));
      if (sinT < 1e-9) { sinT = 0; }

      var u = rngOf(ctx);
      var Leff = L0 * (1 + 0.03 * (2 * u - 1));                       // ① 有效长度不确定
      var Beff = B0 * (1 + 0.015 * (2 * rngOf(ctx) - 1));             // ② 磁场不均匀
      var Ieff = I0 * (1 + 0.01 * (2 * rngOf(ctx) - 1));              // ④ 电流漂移

      var Ftrue = Beff * Ieff * Leff * sinT;                          // [N]
      var FmN = Ftrue * 1000;                                         // [mN]
      // ③ 天平分辨力下限：力小到示数不动就如实记 0
      var FLOOR = 1.5e-3;                                             // [N]，≈0.15 g 示数变化
      var detectable = (FmN >= FLOOR * 1000);
      if (!detectable) {
        return {
          trial: 0,
          dir: sgnI > 0 ? '正向' : '反向',
          I: Math.round(I0 * 100) / 100,
          L: Math.round(L0 * 1000) / 1000,
          theta: Math.round(th),
          B: signif(Beff, 3),
          IL: signif(I0 * L0 * sinT, 3),
          F: 0,
          dm: 0,
          Fx: 0,
          note: sinT === 0 ? 'B ∥ I，F = 0' : '力小于天平分辨力'
        };
      }
      var Fmeas = FmN * (1 + 0.02 * (2 * rngOf(ctx) - 1));            // 综合读数分散
      Fmeas = signif(Fmeas, 4);
      var dm = Fmeas / 1000 / G0 * 1000;                              // [g]
      dm = Math.round(dm * 100) / 100;
      return {
        trial: 0,
        dir: sgnI > 0 ? '正向' : '反向',
        I: Math.round(I0 * 100) / 100,
        L: Math.round(L0 * 1000) / 1000,
        theta: Math.round(th),
        B: signif(Beff, 3),
        IL: signif(I0 * L0 * sinT, 3),                                // [A·m]
        F: Fmeas,                                                     // [mN]
        dm: dm,                                                       // [g]
        Fx: sgnI > 0 ? '↑ 竖直向上' : '↓ 竖直向下',
        err: signif(Fmeas === 0 ? 0 : Math.abs(Fmeas - FmN) / FmN * 100, 3)
      };
    },

    columns: [
      { key: 'trial', label: '第 n 次', unit: '' },
      { key: 'dir', label: '电流方向', unit: '' },
      { key: 'I', label: '电流 I', unit: 'A' },
      { key: 'L', label: '长度 L', unit: 'm' },
      { key: 'theta', label: '夹角 θ', unit: '°' },
      { key: 'B', label: '磁感应强度 B', unit: 'T' },
      { key: 'IL', label: 'I·L·sinθ', unit: 'A·m' },
      { key: 'F', label: '安培力 F', unit: 'mN' },
      { key: 'dm', label: '天平示数变化 Δm', unit: 'g' },
      { key: 'Fx', label: '受力方向', unit: '' }
    ],

    // F = B·(I L sinθ)：过原点直线，斜率就是 B —— 这正是本实验要"测"的物理量
    graph: {
      x: 'IL', y: 'F', fit: 'linear', through: true,
      title: '安培力 F 与 I·L·sinθ 的关系',
      note: '过原点直线的斜率 = 磁感应强度 B（F = B·I·L·sinθ）；θ = 0° 时 F = 0'
    },

    conclude: function (rows, p, ctx) {
      var f = fitO(rows, 'IL', 'F');
      var B0 = Math.max(0.001, num(pick(p, 'B', 0.35), 0.35));
      var i, zeroRows = 0, maxF = 0, maxFx = '—';
      for (i = 0; i < rows.length; i++) {
        var fr = Number(rows[i].F);
        if (isFinite(fr) && fr === 0) { zeroRows++; }
        if (isFinite(fr) && Math.abs(fr) > Math.abs(maxF)) { maxF = fr; maxFx = rows[i].Fx || '—'; }
      }
      // ⚠ 量纲：列 F 的单位是 mN，而 B 的单位是 T = N/(A·m)，
      //   所以斜率（mN/(A·m)）必须先 /1000 换成 N/(A·m) 才是磁感应强度。
      var slopeMN = (f.a === null ? B0 * 1000 : f.a);
      var Bmeas = slopeMN / 1000;
      var dev = B0 > 0 ? Math.abs(Bmeas - B0) / B0 * 100 : 0;
      var text = '共记录 ' + (f.n || rows.length) + ' 组数据：安培力 F 与 I·L·sinθ 成正比，' +
        '图线是一条过原点的直线，斜率 = ' + fix(slopeMN, 2) + ' mN/(A·m)，' +
        '换算成磁感应强度 B = ' + fix(Bmeas, 4) + ' T（1 T = 1000 mN/(A·m)）；' +
        '与标称值 ' + fix(B0, 3) + ' T 相差 ' + fix(dev, 2) + '%，r² = ' + fix(f.r2, 4) + '。' +
        '最大安培力 ' + fix(maxF, 3) + ' mN（' + maxFx + '），相当于天平示数变化 ' +
        fix(maxF / 1000 / G0 * 1000, 2) + ' g。' +
        (zeroRows > 0 ? ('其中有 ' + zeroRows + ' 组 F = 0（导线与磁感线平行，θ = 0°，此时导线不受安培力）。') : '') +
        '结论：F = B·I·L·sinθ，F 随 I、L、B 增大而增大，方向由左手定则判断。';
      return {
        value: signif(Bmeas, 4),
        unit: 'T',
        text: text,
        errors: [
          '导线在磁场中的“有效长度”L 由刻度尺测量，两端各有约半毫米的估读误差，L 较小时相对误差可达 ±3%',
          '蹄形磁铁两极间磁场并不均匀（边缘处磁感线发散），导线位置偏离中心会使 B 变化约 ±1.5%',
          '天平分辨力 0.01 g 且受气流、振动影响示数在 ±0.005 g 内跳动，力小于约 1.5 mN 时测不出（本模型如实记 0）',
          '通电后导线发热使电阻与电流缓慢漂移，电流表读数有约 ±1% 的偏差；引线的安培力也会叠加进天平读数'
        ]
      };
    },

    // 画面：蹄形磁铁 + 通电导体棒 + 电源/滑动变阻器/电流表 + 天平（导轨+导线+磁极+天平）
    draw: function (g, p, state) {
      var o = wrap(g), c = o.c;
      if (!c) { return; }
      state = state || {};
      var B = Math.max(0.001, num(pick(p, 'B', 0.35), 0.35));
      var I = Math.abs(num(pick(p, 'I', 2), 2));
      var L = Math.max(0.001, num(pick(p, 'L', 0.08), 0.08));
      var th = angOf(pick(p, 'theta', 90), 90);
      var sgnI = binSign(pick(p, 'dir', 0), 0);   // +1 = 电流正向（左→右）
      var sinT = Math.abs(Math.sin(th * DEG));
      var t = num(state.t, 0);
      var S = o.S, w = o.w, h = o.h;
      var Ftrue = B * I * L * sinT;                 // [N]
      var FmN = Ftrue * 1000;

      o.bg();
      o.text('蹄形磁铁 + 通电导体棒 + 天平', w * 0.03, h * 0.045, 15 * S + 8, 'left', o.ink, true, true);
      o.text('安培力 F = B·I·L·sinθ　方向：左手定则',
             w * 0.03, h * 0.045 + (15 * S + 8) * 1.5, 12 * S + 7, 'left', o.ink, false, false, 0.75);

      // ── 磁场区域（蹄形磁铁两极之间）
      var mcx = w * 0.47, mcy = h * 0.40;
      var gapW = w * 0.135, gapH = h * 0.115;
      var poleW = w * 0.055, poleH = gapH * 1.5;
      // 磁轭（U 形背部）：把两个极连起来
      var backX = mcx - gapW / 2 - poleW - 16 * S, backY0 = mcy - poleH * 0.86, backY1 = mcy + poleH * 0.86;
      o.rect(backX, backY0, 18 * S + 12, backY1 - backY0, null, o.ink, 5 * S + 2.4);
      // 上下两个极（N/S）
      o.rect(mcx - gapW / 2 - poleW, mcy - gapH / 2 - poleH, poleW, poleH, '#B9B3A6', o.ink, 1.8);
      o.rect(mcx - gapW / 2 - poleW, mcy + gapH / 2, poleW, poleH, '#6E675C', o.ink, 1.8);
      o.text('N', mcx - gapW / 2 - poleW / 2, mcy - gapH / 2 - poleH / 2, 13 * S + 6, 'center', o.ink, false, true);
      o.text('S', mcx - gapW / 2 - poleW / 2, mcy + gapH / 2 + poleH / 2, 13 * S + 6, 'center', '#F4F1EA', false, true);
      o.text('蹄形磁铁', backX - 6 * S, (backY0 + backY1) / 2, 11 * S + 5, 'right', o.ink, true);

      // 磁场方向（竖直向下：N 在上、S 在下）——平行时用虚线圈提示"B ∥ I"
      var fx = mcx + gapW * 0.35;
      var k, yy;
      for (k = 0; k < 3; k++) {
        yy = mcy - gapH * 0.30 + k * gapH * 0.30;
        if (sinT < 0.03) {
          o.text('∥', fx - gapW * 0.42 + k * gapW * 0.42, yy, 15 * S + 6, 'center', 'rgba(140,59,46,0.85)', true, true);
        } else {
          o.arrow(fx - gapW * 0.42 + k * gapW * 0.42, yy - gapH * 0.16,
                  fx - gapW * 0.42 + k * gapW * 0.42, yy + gapH * 0.16, 'rgba(140,59,46,0.75)', 1.4 * S + 0.5, 7 * S + 3);
        }
      }
      o.text(sinT < 0.03 ? 'B ∥ I：安培力为零' : 'B（磁感线）', mcx + gapW * 0.5 + 8 * S,
             mcy - gapH * 0.5, 11 * S + 5, 'left', 'rgba(140,59,46,0.9)', true, true);

      // ── 通电导体棒（水平穿过磁极间隙）
      var rodY = mcy + (sinT < 0.03 ? gapH * 0.02 : 0);
      var rodX0 = mcx - w * 0.30, rodX1 = mcx + w * 0.30;
      o.colorLine(rodX0, rodY, rodX1, rodY, '#8A5A2B', 4.6 * S + 2, 1);
      o.colorLine(rodX0, rodY - 1.6 * S - 0.6, rodX1, rodY - 1.6 * S - 0.6, 'rgba(255,255,255,0.35)', 1.4 * S + 0.4, 1);
      // 在磁场里的那一段用高亮标出（对应 L）
      var half = w * 0.30 * (L / 0.12);
      if (half > w * 0.30) { half = w * 0.30; }
      o.colorLine(mcx - half, rodY, mcx + half, rodY, '#25507A', 5.4 * S + 2.2, 1);
      // 长度标注
      o.inkLine(mcx - half, rodY + 22 * S + 8, mcx + half, rodY + 22 * S + 8, 1, 0.5);
      o.inkLine(mcx - half, rodY + 16 * S + 6, mcx - half, rodY + 28 * S + 10, 1, 0.5);
      o.inkLine(mcx + half, rodY + 16 * S + 6, mcx + half, rodY + 28 * S + 10, 1, 0.5);
      o.text('L = ' + fix(L * 100, 1) + ' cm', mcx, rodY + 38 * S + 13, 11 * S + 5, 'center', o.ink, true);

      // 电流方向箭头（正向：左→右）
      var ar = 12 * S + 5;
      if (sgnI > 0) {
        o.arrow(rodX0 + w * 0.02, rodY - 26 * S - 10, rodX0 + w * 0.02 + ar, rodY - 26 * S - 10, '#25507A', 1.8 * S + 0.6, 8 * S + 3);
      } else {
        o.arrow(rodX0 + w * 0.02 + ar, rodY - 26 * S - 10, rodX0 + w * 0.02, rodY - 26 * S - 10, '#25507A', 1.8 * S + 0.6, 8 * S + 3);
      }
      o.text('I = ' + fix(I, 2) + ' A', rodX0 + w * 0.02, rodY - 40 * S - 15, 11 * S + 5, 'left', '#25507A', true, true);

      // 安培力箭头：左手定则 —— I 向右、B 向下 → F 指向纸面外；本装置把该力
      // 通过支架传成"竖直方向"作用在天平上，所以画面画竖直力（与天平读数一致）。
      var fLen = 26 * S + 10 + Math.min(30 * S + 14, FmN * 0.55 * S + 8);
      if (FmN >= 1.5) {
        if (sgnI > 0) {
          o.arrow(mcx, rodY - 12 * S - 5, mcx, rodY - 12 * S - 5 - fLen, '#2F6F4F', 2.4 * S + 0.8, 10 * S + 4);
          o.text('F = ' + fix(FmN, 3) + ' mN（向上）', mcx + 10 * S + 4, rodY - 12 * S - 5 - fLen * 0.6,
                 11 * S + 5, 'left', '#2F6F4F', true, true);
        } else {
          o.arrow(mcx, rodY + 12 * S + 5, mcx, rodY + 12 * S + 5 + fLen, '#8C3B2E', 2.4 * S + 0.8, 10 * S + 4);
          o.text('F = ' + fix(FmN, 3) + ' mN（向下）', mcx + 10 * S + 4, rodY + 12 * S + 5 + fLen * 0.6,
                 11 * S + 5, 'left', '#8C3B2E', true, true);
        }
      } else {
        o.text('F = 0（天平示数不变）', mcx, rodY - 30 * S - 12, 12 * S + 5, 'center', 'rgba(140,59,46,0.9)', true, true);
      }

      // ── 电路：电源 + 滑动变阻器 + 电流表（画在左下）
      var wy = h * 0.80, wx0 = w * 0.06, wx1 = w * 0.42;
      o.poly([[rodX0, rodY], [wx0, rodY], [wx0, wy], [wx1, wy]], o.ink, 1.6);
      o.poly([[rodX1, rodY], [wx1 + w * 0.02, rodY], [wx1 + w * 0.02, wy], [wx1, wy]], o.ink, 1.6);
      // 电源（电池符号）
      var bx = wx0 + (wx1 - wx0) * 0.18;
      o.inkLine(bx, wy - 12 * S - 6, bx, wy + 12 * S + 6, 2.4, 1);
      o.inkLine(bx + 9 * S + 4, wy - 6 * S - 3, bx + 9 * S + 4, wy + 6 * S + 3, 1.4, 1);
      o.text('直流电源', bx + 5 * S, wy + 30 * S + 12, 10 * S + 5, 'center', o.ink, true);
      // 滑动变阻器
      var rx = wx0 + (wx1 - wx0) * 0.55;
      o.rect(rx - 14 * S - 6, wy - 8 * S - 3, 28 * S + 12, 16 * S + 6, '#EFEADF', o.ink, 1.4);
      o.arrow(rx, wy - 8 * S - 3, rx + 8 * S + 3, wy - 20 * S - 10, o.ink, 1.4, 6 * S + 2);
      o.text('滑动变阻器', rx, wy + 30 * S + 12, 10 * S + 5, 'center', o.ink, true);
      // 电流表
      var ax = wx0 + (wx1 - wx0) * 0.85;
      o.circle(ax, wy, 14 * S + 6, '#EFEADF', o.ink, 1.6);
      o.text('A', ax, wy, 11 * S + 5, 'center', o.ink, false, true);
      o.text(fix(I, 2) + ' A', ax, wy + 30 * S + 12, 10 * S + 5, 'center', o.ink, true);

      // ── 天平（右下）：示数变化 Δm = F/g
      var tx = w * 0.76, ty = h * 0.66;
      o.rect(tx - w * 0.10, ty, w * 0.20, h * 0.20, '#EFEADF', o.ink, 1.8);
      // 托盘
      o.rect(tx - w * 0.055, ty - 8 * S - 3, w * 0.11, 8 * S + 3, '#B9B3A6', o.ink, 1.4);
      // 支架：把导体棒右端受到的力引到托盘上
      var panY = ty - 8 * S - 3;
      o.poly([[rodX1 - w * 0.02, rodY], [tx, rodY], [tx, panY]], o.ink, 1.6, 0.75);
      var dmShow = FmN / 1000 / G0 * 1000;
      if (sgnI < 0 && FmN >= 1.5) { dmShow = -dmShow; }        // 力向下 = 压托盘
      o.text('电子天平（0.01 g）', tx, ty + h * 0.145, 11 * S + 5, 'center', o.ink, false, true);
      o.text('Δm = ' + (dmShow >= 0 ? '+' : '\u2212') + fix(Math.abs(dmShow), 2) + ' g',
             tx, ty + h * 0.20, 12 * S + 6, 'center', o.ink, true, true);

      // 读数面板
      var bx2 = w * 0.03, by2 = h * 0.70;
      o.inkLine(bx2, by2 - 15 * S, bx2 + w * 0.26, by2 - 15 * S, 1, 0.25);
      o.lines([
        'B = ' + fix(B, 3) + ' T　I = ' + fix(I, 2) + ' A　L = ' + fix(L * 100, 1) + ' cm　θ = ' + fix(th, 0) + '°',
        'sinθ = ' + fix(sinT, 3) + '　I·L·sinθ = ' + fix(I * L * sinT, 4) + ' A·m',
        'F = B·I·L·sinθ = ' + fix(FmN, 3) + ' mN',
        '天平示数变化 Δm = F/g = ' + (FmN >= 1.5 ? fix(Math.abs(dmShow), 2) : '0.00') + ' g'
      ], bx2, by2, 11.5 * S + 6, (11.5 * S + 6) * 1.5, 'left', o.ink, false, false);

      var hintTxt = '提示：θ = 0°（导线与磁感线平行）时 sinθ = 0，天平示数不变 —— 这是“B ∥ I 时 F = 0”的直接证据';
      if (state._hintL) {
        hintTxt = '拖动提示：继续按住可把「磁场中导线长度 L」调到 ' + fix(state._hintL * 100, 0) + ' cm（请在右栏滑块上确认该值）';
      }
      o.text(hintTxt, w * 0.03, h - 14 * S, 11 * S + 5, 'left', o.ink, true, false, 0.6);
    },

    // 通电后电流缓慢漂移 + 电流表/天平示数轻微呼吸（视觉上"表是活的"，不改模型）
    step: function (p, state, dt) {
      dt = num(dt, 0.016);
      state.t = num(state.t, 0) + dt;
      state.Ilive = Math.abs(num(pick(p, 'I', 2), 2)) * (1 + 0.004 * Math.sin(state.t * 2.1));
    },

    // 交互：按住拖动只用于"抓住导线"的视觉反馈。
    // ⚠ 这里**故意不写参数、不改模型**：受力大小必须由右栏滑块（I、L、θ、B）决定，
    //    否则"读到的数"与"屏幕上的参数"会脱节。拖到哪一段、受力就按哪一段算，
    //    留给核心的滑块去改（本模块不越权写参数表）。
    onPointer: function (ev, p, state) {
      if (!ev || !state) { return; }
      state._drag = (ev.type === 'down') ? true : (ev.type === 'up' ? false : state._drag);
      if (ev.type !== 'move' || !state._drag) { return; }
      if (typeof ev.x !== 'number' || !isFinite(ev.x)) { return; }
      var px = num(state._stageW, 900);
      var frac = (ev.x - px * 0.47) / (px * 0.30);       // −1..1 ↔ L 从最小到最大
      if (frac < -1) { frac = -1; } else if (frac > 1) { frac = 1; }
      state._hintL = 0.02 + (frac + 1) / 2 * 0.10;       // 仅用于给出"该把 L 调到多少"的提示
    }
  };

  /* ==========================================================================
   * 实验 3 / 3：transformer —— 探究变压器电压与匝数的关系
   * ======================================================================== */
  var XFMR = {
    id: 'transformer',
    name: '探究变压器电压与匝数的关系',
    group: '磁场与电磁感应',
    aim: '用可拆变压器改变原、副线圈的匝数，测出对应的原、副线圈电压，找出电压比与匝数比的关系，并解释实测电压比不等于匝数比的原因。',

    principle:
      '理想变压器（无漏磁、无铜损、铁芯磁通全部穿过两组线圈）中，原、副线圈每匝的磁通量变化率相同，' +
      '故 U₁/n₁ = U₂/n₂，即 U₁/U₂ = n₁/n₂（只对交流电成立，直流电不产生感应电动势）。' +
      '只有一组副线圈时 I₁/I₂ = n₂/n₁（功率守恒 P₁ = P₂）。' +
      '实际变压器有漏磁（磁通没有全部沿铁芯闭合）和铜损（线圈有电阻，电流通过时产生电压降），' +
      '所以实测的 U₂ 总比理想值 U₁·n₂/n₁ 略小，比值与匝数比不完全相等。',

    apparatus: [
      '可拆变压器（闭合铁芯 + 两个已知匝数的线圈，接线柱按“×100 匝”标注）',
      '学生电源（低压交流，输出不超过 12 V）',
      '交流电压表（或多用电表的交流电压挡）',
      '开关、导线若干',
      '（不需要）条形磁铁、干电池等直流电源'
    ],

    steps: [
      '按控制变量法设计记录表：先保持原线圈匝数 n₁ 和原线圈电压 U₁ 不变，只改变副线圈匝数 n₂。',
      '把两个线圈套在同一闭合铁芯上（铁芯必须闭合，否则漏磁严重、副线圈电压会显著偏低）。',
      '把原线圈接到学生电源的交流输出端，副线圈接交流电压表；先选用最大量程挡试测，再换用合适挡位读数。',
      '接通电源，读出原线圈电压 U₁ 和副线圈电压 U₂，同时记下 n₁、n₂（接线柱标注的匝数）。',
      '依次改变副线圈的匝数 n₂（例如 100、200、300、400 匝），每次重测 U₁、U₂，重复 3 次取平均以减小读数误差。',
      '把副线圈改接到不同匝数，或对调原、副线圈（改接不同匝数做原线圈），得到多组匝数比，比较 U₁/U₂ 与 n₁/n₂。',
      '作 U₂–n₂ 图线（或 U₂–n₂/n₁ 图线），看是不是过原点的直线；再计算实测电压比与匝数比的偏差，分析漏磁与铜损的影响。'
    ],

    params: [
      { key: 'U1', label: '原线圈电压 U₁', unit: 'V', min: 2, max: 12, step: 0.5, value: 8 },
      { key: 'n1', label: '原线圈匝数 n₁', unit: '匝', min: 50, max: 400, step: 50, value: 200 },
      { key: 'n2', label: '副线圈匝数 n₂', unit: '匝', min: 50, max: 400, step: 50, value: 100 },
      { key: 'j', label: '负载轻重（副线圈电流）', unit: '%', min: 0, max: 100, step: 5, value: 50 },
      { key: 'core', label: '铁芯状态', unit: '', min: 0.45, max: 0.97, step: 0.01, value: 0.97,
        labels: { '0.97': '闭合硅钢片铁芯', '0.90': '含气隙的铁芯', '0.45': '铁芯未闭合（漏磁大）' } }
    ],

    // 真实模型：U₂ = U₁·(n₂/n₁)·kcore − I₂·(r₁·(n₁/n₂) + r₂)
    //   kcore < 1  ← 漏磁（铁芯未闭合/有气隙时更小）
    //   r₁、r₂ 为原、副线圈的直流电阻 ← 铜损（每匝电阻按 0.0035 Ω/匝，量级可核：
    //   用 0.5 mm 漆包线、每匝周长约 0.18 m 的线圈，100 匝约 0.35 Ω、200 匝约 0.7 Ω，
    //   与学生电源实验里"小变压器线圈直流电阻零点几欧"的实测相符）
    // 误差来源：① 漏磁（kcore 随铁芯装配状态变）② 铜损（线圈发热，电阻随温度上升）
    //           ③ 电压表读数（量程/分辨力，交流有效值）④ 学生电源输出本身随负载波动
    measure: function (p, ctx) {
      var U1set = Math.max(0.5, num(pick(p, 'U1', 8), 8));
      var n1 = Math.max(10, num(pick(p, 'n1', 200), 200));
      var n2 = Math.max(10, num(pick(p, 'n2', 100), 100));
      var j = Math.max(0, Math.min(1, num(pick(p, 'j', 50), 50) / 100));
      var kcore = Math.max(0.2, Math.min(1, num(pick(p, 'core', 0.97), 0.97)));
      var perTurn = 0.0035;                     // [Ω/匝] 每匝直流电阻
      var r1 = perTurn * n1, r2 = perTurn * n2; // [Ω] 原、副线圈直流电阻

      var u = rngOf(ctx);
      // ④ 学生电源输出本身有 ±0.5% 波动；③ 电压表读数有 ±0.5% 的读数误差
      var U1 = U1set * (1 + 0.005 * (2 * u - 1));
      var ratio = n2 / n1;
      var I2 = j * 0.25 * ratio;                                   // [A] 负载越重、升压越多则 I₂ 越大
      var I1 = I2 / Math.max(0.2, kcore) / Math.max(0.05, ratio);   // [A] 原线圈电流（P₁ ≈ P₂）
      var U2ideal = U1 * ratio * kcore;                            // 理想项 × 漏磁
      // 铜损：副线圈压降 I₂·r₂ + 折算到副边的原线圈压降 I₂·r₁·(n₁/n₂)
      var drop = I2 * r2 + I2 * r1 * (n1 / Math.max(1, n2));
      var U2 = U2ideal - drop;                                     // 扣掉铜损压降
      U2 = U2 * (1 + 0.005 * (2 * rngOf(ctx) - 1));                // 电压表读数误差

      if (U2 < 0) { U2 = 0; }
      var U2meas = signif(U2, 3);
      var U1meas = signif(U1, 3);
      var ratioU = U2meas / U1meas;                                // 实测电压比
      var ideal = U1meas * ratio;                                  // 同匝数比下的理想电压
      var leak = (1 - kcore) * 100;                                // 漏磁贡献（%）
      var cu = ideal > 0 ? drop / ideal * 100 : 0;                 // 铜损贡献（%）
      var dev = ideal > 0 ? (1 - U2meas / ideal) * 100 : 0;        // 合计比理想值低多少（%）

      return {
        trial: 0,
        n1: Math.round(n1),
        n2: Math.round(n2),
        U1: U1meas,                                                // [V]
        U2: U2meas,                                                // [V]
        k: signif(ratio, 4),                                       // 匝数比 n₂/n₁
        ratioU: signif(ratioU, 4),                                 // 实测电压比 U₂/U₁
        core: signif(kcore, 3),
        leak: signif(leak, 3),                                     // [%] 漏磁
        cu: signif(cu, 3),                                         // [%] 铜损
        dev: signif(dev, 3),                                       // [%] 合计偏低
        I2: signif(I2, 3),                                         // [A]
        I1: signif(I1, 3)                                          // [A]
      };
    },

    columns: [
      { key: 'trial', label: '第 n 次', unit: '' },
      { key: 'n1', label: '原线圈 n₁', unit: '匝' },
      { key: 'n2', label: '副线圈 n₂', unit: '匝' },
      { key: 'U1', label: '原线圈 U₁', unit: 'V' },
      { key: 'U2', label: '副线圈 U₂', unit: 'V' },
      { key: 'k', label: '匝数比 n₂/n₁', unit: '' },
      { key: 'ratioU', label: '电压比 U₂/U₁', unit: '' },
      { key: 'core', label: '铁芯系数 k', unit: '' },
      { key: 'leak', label: '漏磁偏低', unit: '%' },
      { key: 'cu', label: '铜损偏低', unit: '%' },
      { key: 'dev', label: '合计比理想值偏低', unit: '%' },
      { key: 'I2', label: '副线圈电流 I₂', unit: 'A' }
    ],

    // U₂ = U₁·(n₂/n₁)：过原点直线，斜率 = U₁ —— 这就是本实验要验证的关系
    graph: {
      x: 'k', y: 'U2', fit: 'linear', through: true,
      title: '副线圈电压 U₂ 与匝数比 n₂/n₁ 的关系',
      note: '过原点直线的斜率应等于原线圈电压 U₁；实测点略低于理想线 = 漏磁 + 铜损'
    },

    conclude: function (rows, p, ctx) {
      var f = fitO(rows, 'k', 'U2');
      var U1 = Math.max(0.5, num(pick(p, 'U1', 8), 8));
      var i, s1 = 0, s2 = 0, cnt = 0, worst = 0, leakA = 0, cuA = 0, devA = 0, nc = 0;
      for (i = 0; i < rows.length; i++) {
        var a = Number(rows[i].k), b = Number(rows[i].ratioU);
        if (isFinite(a) && isFinite(b) && a > 0) {
          s1 += a; s2 += b; cnt++;
          var d = Math.abs(a - b) / a * 100;
          if (d > worst) { worst = d; }
        }
        if (isFinite(Number(rows[i].leak))) { leakA += Number(rows[i].leak); }
        if (isFinite(Number(rows[i].cu))) { cuA += Number(rows[i].cu); }
        if (isFinite(Number(rows[i].dev))) { devA += Number(rows[i].dev); nc++; }
      }
      var slope = (f.a === null ? U1 : f.a);
      var devU = U1 > 0 ? Math.abs(slope - U1) / U1 * 100 : 0;
      var text = '共记录 ' + (f.n || rows.length) + ' 组数据：副线圈电压 U₂ 与匝数比 n₂/n₁ 成正比，' +
        '图线是一条过原点的直线，斜率 = ' + fix(slope, 3) + ' V，与所加原线圈电压 U₁ = ' + fix(U1, 2) +
        ' V 相差 ' + fix(devU, 2) + '%（r² = ' + fix(f.r2, 4) + '）。' +
        '平均匝数比 n₂/n₁ = ' + fix(cnt ? s1 / cnt : 0, 4) + '，平均实测电压比 U₂/U₁ = ' +
        fix(cnt ? s2 / cnt : 0, 4) + '，最大偏差 ' + fix(worst, 2) + '%。' +
        '平均而言 U₂ 比理想值 U₁·n₂/n₁ 低 ' + fix(nc ? devA / nc : 0, 2) + '%，' +
        '其中漏磁贡献约 ' + fix(cnt ? leakA / rows.length : 0, 2) + '%、铜损（线圈电阻压降）贡献约 ' +
        fix(cnt ? cuA / rows.length : 0, 2) + '%。' +
        '结论：理想变压器 U₁/U₂ = n₁/n₂；实际变压器因漏磁和铜损，实测电压比总略小于匝数比。';
      return {
        value: signif(slope, 4),
        unit: 'V',
        text: text,
        errors: [
          '漏磁：铁芯未完全闭合、接缝有气隙时部分磁通不沿铁芯闭合，副线圈电压明显偏低（本模型用铁芯系数 k ≈ 0.45~0.97 表示）',
          '铜损：原、副线圈有直流电阻，电流通过时产生电压降并发热，使 U₂ 比理想值小（本模型按每匝电阻 0.0035 Ω/匝 × 匝数计算，即 n=200 匝时约 0.7 Ω）',
          '电压表读数误差：交流电压表量程与分辨力有限，读数应选合适挡位；原线圈电压越小相对误差越大',
          '学生电源输出随负载变化、铁芯涡流与磁滞损耗也使 U₁、U₂ 有约 ±0.5% 的波动'
        ]
      };
    },

    // 画面：闭合铁芯 + 两组线圈 + 交流电源 + 电压表
    draw: function (g, p, state) {
      var o = wrap(g), c = o.c;
      if (!c) { return; }
      state = state || {};
      var U1 = Math.max(0.5, num(pick(p, 'U1', 8), 8));
      var n1 = Math.max(10, num(pick(p, 'n1', 200), 200));
      var n2 = Math.max(10, num(pick(p, 'n2', 100), 100));
      var j = Math.max(0, Math.min(1, num(pick(p, 'j', 50), 50) / 100));
      var kcore = Math.max(0.2, Math.min(1, num(pick(p, 'core', 0.97), 0.97)));
      var t = num(state.t, 0);
      var S = o.S, w = o.w, h = o.h;

      var ratio = n2 / n1;
      var I2 = j * 0.25 * ratio;
      var r1d = 0.0035 * n1, r2d = 0.0035 * n2;      // 与 measure() 同一套铜损参数
      var U2 = U1 * ratio * kcore - (I2 * r2d + I2 * r1d * (n1 / Math.max(1, n2)));
      if (U2 < 0) { U2 = 0; }

      o.bg();
      o.text('可拆变压器：铁芯 + 原线圈 + 副线圈', w * 0.03, h * 0.045, 15 * S + 8, 'left', o.ink, true, true);
      o.text('理想变压器 U₁/U₂ = n₁/n₂；漏磁与铜损使实测 U₂ 略低于 U₁·n₂/n₁',
             w * 0.03, h * 0.045 + (15 * S + 8) * 1.5, 12 * S + 7, 'left', o.ink, false, false, 0.75);

      // ── 铁芯：矩形闭合框（左右两柱 + 上下轭），叠片用横线表示
      var coreX = w * 0.30, coreY = h * 0.22, coreW = w * 0.32, coreH = h * 0.46;
      var limb = 20 * S + 10;
      o.rect(coreX, coreY, coreW, limb, '#CFC9BC', o.ink, 1.6);                            // 上轭
      o.rect(coreX, coreY + coreH - limb, coreW, limb, '#CFC9BC', o.ink, 1.6);             // 下轭
      o.rect(coreX, coreY, limb, coreH, '#CFC9BC', o.ink, 1.6);                            // 左柱
      o.rect(coreX + coreW - limb, coreY, limb, coreH, '#CFC9BC', o.ink, 1.6);             // 右柱
      // 硅钢片叠片纹
      var k2;
      for (k2 = 1; k2 < 8; k2++) {
        var yy2 = coreY + coreH * k2 / 8;
        o.inkLine(coreX, coreY + limb, coreX + limb, coreY + limb, 0.8, 0.18);
        o.inkLine(coreX, yy2, coreX + limb, yy2, 0.8, 0.18);
        o.inkLine(coreX + coreW - limb, yy2, coreX + coreW, yy2, 0.8, 0.18);
      }
      // 铁芯状态：未闭合时在右上角画一段明显的气隙
      if (kcore < 0.9) {
        var gapPx = limb * (1 - kcore) * 1.1;
        o.rect(coreX + coreW - limb - gapPx * 0.5, coreY, gapPx + limb * 0.5, limb, o.paper, null, 0);
        o.colorLine(coreX + coreW - limb - gapPx * 0.5, coreY - 4 * S, coreX + coreW - limb - gapPx * 0.5,
                    coreY + limb + 4 * S, '#8C3B2E', 1.6 * S + 0.5, 1);
        o.colorLine(coreX + coreW - limb + gapPx * 0.5, coreY - 4 * S, coreX + coreW - limb + gapPx * 0.5,
                    coreY + limb + 4 * S, '#8C3B2E', 1.6 * S + 0.5, 1);
        o.text('气隙（漏磁大）', coreX + coreW - limb, coreY - 20 * S - 10, 11 * S + 5, 'center', '#8C3B2E', true, true);
      } else {
        o.text('铁芯闭合（漏磁小）', coreX + coreW / 2, coreY - 20 * S - 10, 11 * S + 5, 'center', o.ink, true, true);
      }

      // ── 原线圈（左柱）：匝数越多，画的圈越多
      var coilColW = limb * 1.5;
      function drawCoil(cxL, cyTop, cyBot, turns, color, label, sub) {
        var cnt = Math.max(3, Math.min(16, Math.round(turns / 25)));
        var hh = (cyBot - cyTop) / cnt;
        var m;
        for (m = 0; m < cnt; m++) {
          var y0 = cyTop + hh * m;
          o.rect(cxL - coilColW / 2, y0 + hh * 0.12, coilColW, hh * 0.76, null, color, 1.8 * S + 0.8);
        }
        o.text(label, cxL, cyTop - 16 * S - 8, 12 * S + 5, 'center', color, true, true);
        o.text(sub, cxL, cyBot + 16 * S + 8, 11 * S + 5, 'center', o.ink, false, false);
      }
      var coilTop = coreY + limb * 1.6, coilBot = coreY + coreH - limb * 1.6;
      drawCoil(coreX + limb / 2, coilTop, coilBot, n1, '#25507A', '原线圈 n₁ = ' + Math.round(n1) + ' 匝', 'U₁ = ' + fix(U1, 2) + ' V');
      drawCoil(coreX + coreW - limb / 2, coilTop, coilBot, n2, '#2F6F4F', '副线圈 n₂ = ' + Math.round(n2) + ' 匝', 'U₂ = ' + fix(U2, 3) + ' V');

      // ── 磁通（铁芯内的交变磁通）：沿闭合回路流动的亮点
      var pathPts = [
        [coreX + limb / 2, coreY + limb / 2],
        [coreX + coreW - limb / 2, coreY + limb / 2],
        [coreX + coreW - limb / 2, coreY + coreH - limb / 2],
        [coreX + limb / 2, coreY + coreH - limb / 2]
      ];
      var per = 0, seg;
      for (seg = 0; seg < 4; seg++) {
        var p0 = pathPts[seg], p1 = pathPts[(seg + 1) % 4];
        per += Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]);
      }
      var phase = ((t * 0.55 * (1 + 2 * j)) % 1 + 1) % 1;
      var want = phase * per, acc = 0, found = null;
      for (seg = 0; seg < 4 && !found; seg++) {
        var q0 = pathPts[seg], q1 = pathPts[(seg + 1) % 4];
        var segLen = Math.abs(q1[0] - q0[0]) + Math.abs(q1[1] - q0[1]);
        if (acc + segLen >= want) {
          var fr = segLen > 0 ? (want - acc) / segLen : 0;
          found = [q0[0] + (q1[0] - q0[0]) * fr, q0[1] + (q1[1] - q0[1]) * fr];
        }
        acc += segLen;
      }
      if (found) {
        var amp = Math.abs(Math.sin(t * 3.1)) * 0.85 + 0.15;
        o.circle(found[0], found[1], (5 * S + 2.4) * amp, 'rgba(140,59,46,' + (0.25 + 0.4 * amp).toFixed(2) + ')', null, 0);
      }
      o.text('铁芯中的交变磁通 Φ', coreX + coreW / 2, coreY + coreH / 2 - 10 * S, 10.5 * S + 5, 'center', o.ink, true, false, 0.55);
      o.text('（漏磁 = 没有全部沿铁芯闭合的那部分）', coreX + coreW / 2, coreY + coreH / 2 + 10 * S,
             10 * S + 4, 'center', o.ink, false, false, 0.45);

      // ── 交流电源（左下）
      var sx = w * 0.10, sy = h * 0.62;
      o.poly([[coreX + limb * 0.1, coilBot], [coreX + limb * 0.1, sy], [sx, sy]], o.ink, 1.6);
      o.poly([[coreX - limb * 0.1, coilTop], [coreX - limb * 0.1, sy - 40 * S - 18], [sx, sy - 40 * S - 18], [sx, sy]], o.ink, 1.6);
      o.circle(sx, sy, 20 * S + 9, '#EFEADF', o.ink, 1.8);
      // 正弦符号（交流）
      if (c.beginPath) {
        c.save(); c.strokeStyle = '#25507A'; c.lineWidth = 2 * S + 0.8;
        c.beginPath();
        var q;
        for (q = 0; q <= 24; q++) {
          var ax = sx - 11 * S + (22 * S) * q / 24;
          var ay = sy - Math.sin(q / 24 * PI * 2) * 7 * S;
          if (q === 0) { c.moveTo(ax, ay); } else { c.lineTo(ax, ay); }
        }
        c.stroke(); c.restore();
      }
      o.text('学生电源（交流）', sx, sy + 36 * S + 14, 11 * S + 5, 'center', o.ink, true, true);
      o.text('U₁ = ' + fix(U1, 2) + ' V', sx, sy + 52 * S + 20, 11 * S + 5, 'center', '#25507A', false, true);

      // ── 交流电压表（右下）
      var vx = w * 0.80, vy = h * 0.52;
      o.poly([[coreX + coreW - limb * 0.1, coilBot], [coreX + coreW - limb * 0.1, vy], [vx, vy]], o.ink, 1.6);
      o.poly([[coreX + coreW + limb * 0.1, coilTop], [coreX + coreW + limb * 0.1, vy - 40 * S - 18], [vx, vy - 40 * S - 18], [vx, vy]], o.ink, 1.6);
      o.circle(vx, vy, 20 * S + 9, '#EFEADF', o.ink, 1.8);
      o.text('V', vx, vy, 14 * S + 6, 'center', '#2F6F4F', true, true);
      o.text('交流电压表', vx, vy + 36 * S + 14, 11 * S + 5, 'center', o.ink, true, true);
      o.text('U₂ = ' + fix(U2, 3) + ' V', vx, vy + 52 * S + 20, 11 * S + 5, 'center', '#2F6F4F', false, true);

      // ── 读数面板（右上角空白处）
      var px0 = w * 0.66, py0 = h * 0.12;
      o.inkLine(px0, py0 - 14 * S, w * 0.97, py0 - 14 * S, 1, 0.25);
      o.lines([
        'n₁ = ' + Math.round(n1) + ' 匝　n₂ = ' + Math.round(n2) + ' 匝',
        '匝数比 n₂/n₁ = ' + fix(n2 / n1, 4),
        '理想 U₂ = U₁·n₂/n₁ = ' + fix(U1 * n2 / n1, 3) + ' V',
        '实测 U₂ = ' + fix(U2, 3) + ' V（低 ' + fix(U1 * n2 / n1 > 0 ? (1 - U2 / (U1 * n2 / n1)) * 100 : 0, 2) + '%）',
        '实测电压比 U₂/U₁ = ' + fix(U1 > 0 ? U2 / U1 : 0, 4),
        '铁芯系数 k = ' + fix(kcore, 2) + '　I₂ ≈ ' + fix(I2, 3) + ' A',
        '（漏磁 + 铜损 → 实测比总略小）'
      ], px0, py0, 11 * S + 5, (11 * S + 5) * 1.52, 'left', o.ink, false, false);

      var hintTxt2 = '提示：把「铁芯状态」调成“未闭合”，可见漏磁使 U₂ 显著下降（电压比与匝数比明显不等）';
      if (state._hintN2) {
        hintTxt2 = '拖动提示：继续按住可把「副线圈匝数 n₂」调到 ' + state._hintN2 + ' 匝（请在右栏滑块上确认该值）';
      }
      o.text(hintTxt2, w * 0.03, h - 14 * S, 11 * S + 5, 'left', o.ink, true, false, 0.6);
    },

    // 交流电的相位（画面流动靠它）
    step: function (p, state, dt) {
      state.t = num(state.t, 0) + num(dt, 0.016);
    },

    // 交互：按住上下拖动只用于"指向某个匝数"的视觉提示。
    // ⚠ 同样**不写参数、不改模型**：n₂ 必须由右栏滑块给定，否则电压比会与参数脱节。
    onPointer: function (ev, p, state) {
      if (!ev || !state) { return; }
      state._drag = (ev.type === 'down') ? true : (ev.type === 'up' ? false : state._drag);
      if (ev.type !== 'move' || !state._drag) { return; }
      if (typeof ev.y !== 'number' || !isFinite(ev.y)) { return; }
      var ph = num(state._stageH, 560);
      var f = 1 - (ev.y / ph);                      // 往上拖 → 匝数更多
      var n2 = 50 + Math.round(f * 7) * 50;
      if (n2 < 50) { n2 = 50; } else if (n2 > 400) { n2 = 400; }
      state._hintN2 = n2;                           // 仅用于给出"该把 n₂ 调到多少"的提示
    }
  };

  // ───────────────────────── 登记（id 逐字用契约值）─────────────────────────
  host.register('lenz-law', LENZ);
  host.register('ampere-force', AMPERE);
  host.register('transformer', XFMR);
})();
/* ============================================================================
 * 建模时写明的假设（有意为之的简化，别当成 bug 改掉；改之前先读设计契约 §4）
 *
 * 1) lenz-law 的“指针偏左还是偏右”是**相对符号**，不是绝对符号。
 *    物理事实（来源 [L1]/[L3]）：磁铁插入 → 磁通量增大 → 感应电流的磁场与原磁场
 *    方向相反；拔出 → 减小 → 相同（增反减同）。但“指针偏左/偏右”还取决于
 *    ① 螺线管的绕线方向 ② 电流计哪个接线柱接线圈哪一端 ③ 电流计本身的偏转极性。
 *    本模型固定取“从上往下看绕向为顺时针、按左手/右手螺旋关系接线”，于是
 *    N 极插入 → 指针向右、S 极插入 → 向左、拔出时反向。**可验证的是相对关系**：
 *    磁极反向则偏转反向、插拔互换则偏转反向 —— 这正是实验要归纳的结论。
 *    画面里也把“绕向”标注出来了，避免学生把绝对符号当结论。
 *
 * 2) lenz-law 的等效磁通梯度 k = K_LENZ = 2.0e-5 Wb/(m·匝) 是"线圈有效截面 ×
 *    磁铁端面附近的有效轴向磁场梯度"的合并值（磁铁强度已并入）。用条形磁铁中轴线
 *    的偶极子场估量级：B ≈ (μ₀/4π)·2m/d³（m ≈ 1 A·m²，d ≈ 0.12 m）→ |dB/dξ| ≈ 8 T/m，
 *    乘有效截面 A ≈ 5e-6 m²（偶极子远场公式在紧贴磁极处高估约一个量级，A 取小
 *    正是这一折减），落在 1e-5 量级；12% 的相对不确定度已写进误差来源。
 *    校验：N=200、v=1 m/s、R=50 Ω → ε ≈ 4.0 mV、I ≈ 0.080 mA、指针约 0.8 格，
 *    与"灵敏电流计（零刻度在中央）能看清偏转、但不会一插就满偏"的课堂经验一致。
 *
 * 3) ampere-force 的“测力方式”取**天平示数变化**（Δm = F/g）。教材/期刊里
 *    另一种常见装置是“把导线悬挂起来，看悬线偏角 θ ∝ F”（来源 [A3] 就是这种）。
 *    两者测的是同一个 F，只是把"读数"换成 Δm 或偏角；本模型选了
 *    天平（0.01 g 分辨力）因为它的"分辨力下限"能真实地产生一个可解释的
 *    “F 太小就测不出”的行为（θ = 0° 时 F 严格为 0，同样如实记 0）。
 *
 * 4) transformer 的 kcore（铁芯系数）把“漏磁”折成一个 0.45~0.97 的系数：
 *    它是"穿过副线圈的磁通 / 穿过原线圈的磁通"的等效比例。真值取决于铁芯
 *    接缝、气隙与装配状态，无法在本模型里从几何第一性原理算出，故作为可调
 *    状态量暴露给学生，并由它产生"实测电压比 < 匝数比"这一可解释的系统偏差。
 *    r₁ = 0.0035 Ω/匝 × n₁、r₂ = 0.0035 Ω/匝 × n₂ 是"每匝直流电阻"的典型量级
 *    （用 0.5 mm 漆包线绕制的小线圈，100 匝约 0.35 Ω、200 匝约 0.7 Ω），
 *    用来产生铜损压降；增大负载（j）即可看到 U₂ 随铜损继续下降。
 * ========================================================================== */
