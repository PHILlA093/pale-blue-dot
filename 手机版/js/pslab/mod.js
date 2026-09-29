/* ============================================================================
 * 穷观 · 物理实验台 —— 组 6 · 近代物理（js/pslab/mod.js）
 *
 * 本文件只做一件事：向实验台注册表登记 1 个实验
 *     window.QG_PSLAB.register('photoelectric', spec)
 * 不自建 DOM、不起循环、不读写全局状态（惰性，与物理沙盒一致）。
 *
 * ── 契约依据 ────────────────────────────────────────────────────────────────
 *   docs/物理实验台设计.md  §2 组 6 · 近代物理（id = photoelectric）
 *                           §4 模块契约（register(id, spec) 的字段与约束）
 *                           §7 每个实验的验收（7 条）
 *
 * ── 物理模型（全部量纲用国际单位制；ν 一律以 Hz 计） ────────────────────────
 *   光子能量          ε      = h ν                        [J]
 *   爱因斯坦光电方程   E_k    = h ν − W₀                   [J]   （E_k ≥ 0 才可能有光电子）
 *   遏止电压           e U_c  = E_k      →  U_c = (h ν − W₀)/e   [V]
 *   截止频率           ν_c    = W₀/h                       [Hz]
 *   光电流（U–I 特性） I(U)   = I_sat / (1 + exp(−(U − 0.5b)/b)) + I_dark   （b = 0.06 V）
 *                        截止：U 转到 −U_c 以下约 0.5 V 后只剩反向电流/暗电流 I_dark
 *                        饱和：U 升到 +0.3 V 以上进入平台 I → I_sat；U = 0 时约为半高
 *                        膝部宽度由电子能量分布的展宽决定；曲线整体随 U 单调上升，
 *                        与实测光电管 U–I 曲线一致
 *   两个关键结论（教材实验的落点）：
 *     ① U_c 只由 ν 与材料 W₀ 决定，与光强无关（光强只改变 I_sat）；
 *     ② U_c–ν 图线是直线，斜率 k = h/e ⇒ h = e k，横轴截距即 ν_c。
 *
 * ── 常量取值（不凭记忆：来自 NIST CODATA，国际单位制 2019 定义值，均为精确值） ──
 *   h = 6.62607015×10⁻³⁴ J·s   https://physics.nist.gov/cgi-bin/cuu/Value?h
 *   e = 1.602176634×10⁻¹⁹ C    https://physics.nist.gov/cgi-bin/cuu/Value?e
 *   逸出功 W₀(Na)=2.28 eV / W₀(Zn)=4.30 eV / W₀(Pt)=6.35 eV —— 见下方 MATS 注释
 *
 * ── 误差模型（§4「允许带一点可解释的误差」，全部来自测量而非模型本身） ──────
 *   电流读数：乘性误差 0.5% + 0.35% 满度分辨力（微安表）
 *   电压读数：0.01 V 分辨力 + 0.4% 读数（电压表）
 *   反向电流/暗电流：光电管固有的微小本底 I_dark = 0.008 μA 偏置（U_c 附近读零不准的主因）
 *   U_c 读出：以电压表分辨力为准，独立取 ±0.012 V 随机偏差
 *
 * 纯 ES5（无箭头函数/let/const/模板串/class/eval/new Function）、零依赖、不联网。
 * 指纹 QG-20260920-5e5d5a
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ========================================================================== */
(function () {
  'use strict';

  if (!window.QG_PSLAB || typeof window.QG_PSLAB.register !== 'function') return;

  /* ------------------------------------------------------------------ 常量 */
  var QG_H = 6.62607015e-34;      /* 普朗克常量 J·s（CODATA 精确值） */
  var QG_E = 1.602176634e-19;     /* 元电荷 C（CODATA 精确值） */
  var QG_HC = QG_H * 2.99792458e8;/* hc，用于 ε(eV) = hc/(λ/nm) / e */
  var QG_KEV = 1.602176634e-19;   /* 1 eV 对应的 J（与 e 同值，量纲不同） */

  /* 谱线表：只有波长 nm。频率一律由 ν = c/λ 现算（c = 2.99792458×10⁸ m/s），
     不写死、不预先四舍五入 —— 否则把 ν 截断到 3 位有效数字会让 U_c–ν 图线
     出现 1% 量级的假弯曲（实测：铂的紫外点 r² 会从 0.999 掉到 0.845）。
     可见光取 4 条：红光 750（滤光片）、钠黄 589.3、氢蓝 435.8、紫 400；
     紫外取 6 条：汞 253.7 nm（紫外区较强谱线）、重氢灯 220 / 200 / 180 / 160 / 150 nm
     （低压汞灯在 200 nm 以下辐射很弱，本台架按「石英窗重氢灯」给出）。
     紫外给到 6 条是为了让逸出功大的金属也能取到足够多、频率跨度够大的点：
     锌（W₀ = 4.30 eV，λ_c ≈ 288 nm）能取 5 点，
     铂（W₀ = 6.35 eV，λ_c ≈ 195 nm）能取 3 点（180 / 160 / 150 nm）——
     只有 2~3 个点挤在一条很短的频率区间里，读数误差会把 r² 压到 0.9 以下。 */
  var QG_LINES = [750.0, 589.3, 435.8, 400.0, 253.7, 220.0, 200.0, 180.0, 160.0, 150.0];
  var QG_C = 2.99792458e8;

  /* 光电管材料与逸出功（eV）
     Na 2.28 / Zn 4.30 / Pt 6.35 —— 金属逸出功表（Vedantu 引用的标准表，
     与 hyperphysics「Work Functions for Photoelectric Effect」同源）：
     https://www.vedantu.com/question-answer/the-work-function-for-photoelectric-effect-is-a-class-12-physics-cbse-5f5a3eab6e663a29cce9cf0d
     人教版把钠的逸出功写作 2.29 eV，与之只差 0.01 eV（表格精度），本模块取表格值 2.28 eV。
     说明：逸出功是「表面」性质，随晶面与沾污有 0.1 eV 量级浮动，各家表略有出入。 */
  var QG_MATS = [
    { id: 'na', name: '钠 Na', W: 2.28 },
    { id: 'zn', name: '锌 Zn', W: 4.30 },
    { id: 'pt', name: '铂 Pt', W: 6.35 }
  ];

  var QG_REF_ISAT = 1.60;   /* 光强 100 时饱和光电流的数量级基准 μA */
  var QG_DARK = 0.008;      /* 反向电流/暗电流本底 μA（约为饱和电流的 0.5%） */
  var QG_KNEE = 0.06;       /* U–I 曲线「膝部」宽度 V（能量分布展宽，见文件头模型说明） */

  /* ---------------------------------------------------------------- 小工具 */
  function qgNum(v, dflt) {
    var x = Number(v);
    if (!isFinite(x)) return dflt;
    return x;
  }

  function qgRound(x, n) {
    var p = Math.pow(10, n);
    return Math.round(x * p) / p;
  }

  var QG_SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
                 '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

  /* 把 6.62607015e-34 写成 6.63×10⁻³⁴（画布与结论文本共用，避免出现 "^" 这种半成品） */
  function qgSci(x, n) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    var s = x.toExponential(Math.max(0, n - 1));
    var parts = s.split('e');
    var mant = parts[0];
    var ex = String(Number(parts[1]));
    var sup = '', i;
    for (i = 0; i < ex.length; i++) sup += (QG_SUP[ex.charAt(i)] || ex.charAt(i));
    return mant + '×10' + sup;
  }

  /* 有效数字格式化（返回字符串）：量级适中给定点，过大过小给 ×10ⁿ 形式 */
  function qgSig(x, n) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    var a = Math.abs(x);
    var d;
    if (a >= 1e5 || a < 1e-3) return qgSci(x, n);
    d = Math.max(0, Math.min(8, n - 1 - Math.floor(Math.log(a) / Math.LN10)));
    return x.toFixed(d);
  }

  function qgClamp(x, lo, hi) {
    if (x < lo) return lo;
    if (x > hi) return hi;
    return x;
  }

  /* 按**有效数字**取整（不是按小数位）。
     踩过的坑：conclude() 里写 qgRound(h, 4)，而 h ≈ 6.6×10⁻³⁴J·s，
     小数位取整会把它直接变成 0 —— 探针读到 value=0 会判「结论无数值」。
     凡是量级可能远离 1 的物理量，取整一律用这个函数。 */
  function qgSigRound(x, n) {
    if (!isFinite(x) || x === 0) return 0;
    var e = Math.floor(Math.log(Math.abs(x)) / Math.LN10);
    var p = Math.pow(10, n - 1 - e);
    return Math.round(x * p) / p;
  }

  /* 线性最小二乘（纯函数，自己算，不依赖核心）。
     注意：ν ≈ 10¹⁵ Hz 这类大数必须先用**中心化**形式再算，否则
     Σx² 与 (Σx)²/n 都在 10³⁰ 量级、相减后有效位被吃光（r² 会变成 NaN/负值）。
     曾用未中心化的 r = (nΣxy−ΣxΣy)/√((nΣx²−(Σx)²)(nΣy²−(Σy)²))，在真实量级下直接坏掉。 */
  function plFit(pts) {
    var n = pts.length, i, s = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, a, b, r2;
    if (n < 3) return null;
    for (i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; }
    var mx = sx / n, my = sy / n;
    for (i = 0; i < n; i++) {
      var dx = pts[i].x - mx, dy = pts[i].y - my;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }
    if (!(sxx > 0) || !(syy > 0)) return null;
    a = sxy / sxx;
    b = my - a * mx;
    r2 = qgClamp((sxy * sxy) / (sxx * syy), 0, 1);
    return { a: a, b: b, r2: r2, n: n };
  }

  /* ------------------------------------------------------------ 读出参数 */
  /* 两个踩过的坑，别再犯：
     ① 局部变量名不要用 U / I —— 这里形参就叫 p，而 U、I 是常用短名；
        曾写成 var U = ...，于是 return { U: U, I: I } 变成了
        「整个参数对象 / 光强字符串」，再被 qgNum 静默兜底成 0 与 100（电压、光强滑块全失效）。
     ② 吸附到最近谱线时必须写进**新变量 snap**，绝不能写回 lam ——
        曾写成 lam = QG_LINES[i]，而 QG_LINES 是引用，
        于是数组被就地改写成 [750,750,750,400,400,400,400]，所有谱线自我坍缩成两条。
        （教训：拿数组元素当累加器之前，先确认那是副本。） */
  function readP(p) {
    p = p || {};
    var lam = qgNum(p.lambda, 435.8), i, best = Infinity, snap = QG_LINES[0], d;
    for (i = 0; i < QG_LINES.length; i++) {
      d = Math.abs(QG_LINES[i] - lam);
      if (d < best) { best = d; snap = QG_LINES[i]; }
    }
    var mat = null;
    for (i = 0; i < QG_MATS.length; i++) {
      if (QG_MATS[i].id === p.material) { mat = QG_MATS[i]; break; }
    }
    if (!mat) mat = QG_MATS[0];
    var inten = Math.round(qgClamp(qgNum(p.intensity, 100), 10, 100));
    var volts = qgClamp(qgNum(p.voltage, 0), -4, 4);
    return { lam: snap, mat: mat, inten: inten, volts: volts };
  }

  /* ------------------------------------------------------ 物理（无噪声） */
  /* 返回单色光照射该材料光电管时的物理量（理想值）。
     r.lam 为波长 nm；ν 由 c/λ 现算，全程不打磨（量纲一律 SI，能量最后除以 e 换成 eV）。 */
  function physics(r) {
    var nu = QG_C / (r.lam * 1e-9);          /* Hz */
    var eps = QG_H * nu;                     /* 光子能量 J */
    var W = r.mat.W * QG_KEV;                /* 逸出功 J */
    var Ek = eps - W;
    if (Ek < 0) Ek = 0;                      /* 光子能量不足：无光电子 */
    var Uc = Ek / QG_E;                      /* 遏止电压 V */
    var nuc = W / QG_H;                      /* 截止频率 Hz（= W₀/h） */
    var Isat = QG_REF_ISAT * (r.inten / 100) * (0.70 + 0.60 * Math.pow(10, (r.lam - 400) / 1200));
    var on = (eps > W);
    return {
      nu: nu, nu14: nu / 1e14, lam: r.lam, epsJ: eps, eps: eps / QG_KEV,
      W: r.mat.W, Wmat: r.mat, Ek: Ek, EkEv: Ek / QG_KEV, Uc: Uc,
      nuc: nuc, Isat: Isat, on: on
    };
  }

  /* 光电管 U–I 特性（理想曲线），U 单位 V，返回 μA（含反向电流/暗电流本底）。
     陡膝模型：转折点定在 U = 0（此时正好半高），膝宽 b = QG_KNEE。
     单调性自查：U 增大 → exp(−(U−0.5b)/b) 变小 → 电流单调增大 → 趋近 I_sat；
                 U = 0 半高；U < −U_c − 0.5 V 以后只剩 I_dark；U > +0.3 V 以后进入平台。
     ⚠ 指数参数里的负号不能少：写成 exp(+(U−0.5b)/b) 会让曲线随电压**下降**
       （U 越大电流越小、饱和与截止互换），实测 U=+1.5 V 时电流反而掉到暗电流。 */
  function tubeI(ph, U) {
    if (!ph.on) return 0;
    var b = QG_KNEE;
    return ph.Isat / (1 + Math.exp(-(U - 0.5 * b) / b)) + QG_DARK;
  }

  /* 当前工作点上的光电流（理想值） */
  function workI(ph, U) {
    return tubeI(ph, U);
  }

  /* ============================================================ 测量函数 */
  function measure(p, ctx) {
    ctx = ctx || {};
    var noise = (typeof ctx.noise === 'function') ? ctx.noise : function () { return 0; };
    var r = readP(p);
    var ph = physics(r);

    /* —— 三个独立读数：光电流（微安表）、工作电压（电压表）、遏止电压读出 ——
       读数噪声互不相同，所以同一组参数重复测量不会得到一模一样的一行。
       注意：暗电流/反向电流是**与光强无关**的独立本底，它的读数噪声也必须独立给
       （曾写成全部乘在 ph.Isat 上，于是 ν<ν_c 时 Isat=0 → 噪声也归零 →
        读数变成纯随机正负值，甚至出现「电流在遏止点以下反而更大」的怪行）。 */
    var iErr = ph.Isat * (0.005 * noise(1) + 0.0035 * noise(1)) + 0.003 * noise(1);
    var Iread = workI(ph, r.volts) + iErr;
    if (Iread < 0) Iread = 0;                       /* 微安表只向一个方向偏转 */

    var uErr = 0.010 * noise(1) + 0.004 * Math.abs(r.volts) * noise(1);
    var Uread = r.volts + uErr;

    var ucErr = 0;
    if (ph.on) {
      /* 电压表分辨力 0.01 V + 读数误差；用乘法型扰动并夹在 ±15% 内，
         保证不会把 U_c「推穿」到零平台。0.01 V 是分辨力下限，不宜再小；
         重复测量取平均可以让随机部分互相抵消（这正是实验里的做法）。 */
      ucErr = 0.010 * noise(1) + 0.004 * ph.Uc * noise(1);
      ucErr = qgClamp(ucErr, -0.15 * ph.Uc, 0.15 * ph.Uc);
    }
    var UcRead = ph.on ? (ph.Uc + ucErr) : 0;
    if (UcRead < 0) UcRead = 0;                     /* 反向偏压扫到电流反向才算「遏止」 */

    /* 微安表分辨力 0.01 μA；电压表分辨力 0.001 V。
       nu 用整数 Hz（斜率 k 的单位因此正好是 V·s = h/e），打到数据表里由核心按列显示。 */
    var Iout = Math.max(0, qgRound(Iread, 2));
    var Uout = qgRound(Uread, 3);
    /* ⚠ 未发生光电效应时 U_c 必须返回 null，**不能返回 0**：
       核心的 graphData() 是按 (x,y) 都 isFinite 来收集作图点的，
       U_c=0 会让 ν<ν_c 的点落在 (ν, 0) 上，把 U_c–ν 直线硬拽弯（混 3 个零点 r² 就掉到 0.35），
       直接违反契约 §7.3「数据本身是线性的实验必须 r²>0.9」。
       契约 §6 的 current().rows 与数据表都能显示 null（核心 fmtNum 把它渲染成「—」）。 */
    var UcOut = ph.on ? qgRound(UcRead, 3) : null;

    /* 饱和标志：膝部在 U = 0 附近、宽度约 0.06 V，故 U > 0.25 V 时已进入平台。
       判据不能只看电流大小：反向偏压时光电流被压到 0，
       若拿电流去比 97%×I_sat，反而会把「已饱和」误判成未饱和。 */
    var sat = ph.on && (r.volts > 0.25) && (workI(ph, r.volts) - QG_DARK) > 0.97 * ph.Isat;

    return {
      lambda: qgRound(r.lam, 1),
      nu: qgRound(ph.nu, 0),                      /* Hz（整数位；斜率单位因此是 V·s） */
      eps: qgRound(ph.eps, 3),
      Ek: qgRound(ph.EkEv, 3),
      Uc: UcOut,
      I: Iout,
      U: Uout,
      Isat: ph.on ? qgRound(ph.Isat, 2) : 0,
      W: r.mat.W,
      nuc: qgRound(ph.nuc, 0),                    /* 截止频率 Hz */
      sat: sat ? 1 : 0,
      emit: ph.on ? 1 : 0
    };
  }

  /* ================================================================ 结论 */
  function conclude(rows, p2, ctx) {
    ctx = ctx || {};
    var pts = [], nrows = 0, i, r, fit = null, h = null, rel = null;
    rows = rows || [];
    nrows = rows.length;

    for (i = 0; i < nrows; i++) {
      r = rows[i];
      if (!r) continue;
      /* 跳过未发生光电效应的行：measure 在这些行返回 Uc=null（见 measure 里的说明）。
         必须显式判断 null —— Number(null) === 0，会被后面的 isFinite 放行。 */
      if (r.Uc === null || r.Uc === undefined || r.Uc === '') continue;
      var uc = Number(r.Uc), nu = Number(r.nu);
      if (!isFinite(uc) || !isFinite(nu)) continue;
      if (uc <= 0) continue;              /* 恰在截止频率附近：不进拟合 */
      pts.push({ x: nu, y: uc });
    }

    /* 拟合优先级：核心给的 ctx.fit（§6 graph().fit）→ 自己最小二乘。
       ⚠ 核心的 fit 里 a 是**截距**、b 是**斜率**（y = a + b·x，见 pslab.js fitLinear），
       与本模块 plFit 返回的 {a: 斜率, b: 截距} 恰好相反 —— 取斜率一律用 fit.b。 */
    var slope = null;
    if (ctx && ctx.fit && isFinite(ctx.fit.b)) {
      slope = Number(ctx.fit.b);
      fit = { a: slope, b: qgNum(ctx.fit.a, 0), r2: qgNum(ctx.fit.r2, NaN), n: pts.length };
    } else if (pts.length >= 3) {
      fit = plFit(pts);
      if (fit) slope = fit.a;
    }

    if (slope !== null && isFinite(slope) && slope > 0) {
      /* 横轴 ν 用 Hz，故 k = h/e 的单位就是 V·s（= V/Hz）：h = e·k，量纲 V·s·C = J·s ✓
         （曾把横轴写成 10¹⁴ Hz 却漏了换算，h 会差 10²⁸ 倍 —— 现在统一 SI，不做单位换乘） */
      h = QG_E * slope;
      rel = Math.abs(h - QG_H) / QG_H * 100;
    }

    var mats = {}, mkey = [];
    for (i = 0; i < nrows; i++) {
      var nm = rows[i] && rows[i].W;
      if (nm === undefined || nm === null) continue;
      if (!mats[nm]) { mats[nm] = 0; mkey.push(nm); }
      mats[nm]++;
    }
    var matTxt = '';
    for (i = 0; i < mkey.length; i++) {
      if (i) matTxt += '、';
      matTxt += mkey[i] + ' eV 组' + mats[mkey[i]] + ' 次';
    }

    var errors = [];
    errors.push('反向电流与暗电流本底：光电管在反向电压下仍有微小本底电流（本台架约 0.008 μA），' +
                '使"电流恰好为零"的位置判断偏早，遏止电压系统性偏小；用补偿法或取正反向电流相等处可减小。');
    errors.push('电压表读数与分辨力：电压表分辨力约 0.01 V，且 U_c 附近电流变化很陡，' +
                '读数偏差 0.01 V 经斜率 k=h/e 放大后对 h 有约 1% 量级影响（应多测几次取平均）。');
    errors.push('频率换算：谱线频率由 ν=c/λ 换算，波长本身有 ±0.5 nm 量级不确定度（滤光片带宽更宽），' +
                '在 250 nm 处约带来 0.2% 的频率偏差，直接进入斜率。');
    errors.push('单色性/滤光片带宽：滤光片透过的不是严格单色光，短波成分会抬高表观遏止电压；' +
                '紫外波段还要求石英窗口，玻璃窗会吸收紫外使光电流偏小。');
    errors.push('金属表面状态：逸出功是表面性质，氧化、沾污与晶面不同会使 W₀ 有 0.1 eV 量级漂移' +
                '（台架换材料、使用久了都会变），导致同一条 U_c–ν 线的截距移动。');
    if (mkey.length > 1) {
      errors.push('把不同材料的数据混在同一张 U_c–ν 图上：不同 W₀ 对应不同截距，' +
                  '混点会使拟合直线变弯、r² 下降；应逐个材料分别作图。');
    }

    if (h === null) {
      return {
        value: 0,
        unit: 'J·s',
        text: '数据不足：需要在同一材料下至少取 3 个「能发生光电效应」的频率点' +
              '（U_c > 0），才能作 U_c–ν 图并由斜率求普朗克常量 h。当前有效点 ' + pts.length +
              ' 个（共记录 ' + nrows + ' 次）。可提高入射光频率或改用逸出功更小的材料。',
        errors: errors
      };
    }

    var r2txt = isFinite(fit.r2) ? fit.r2.toFixed(4) : '—';
    var okTxt = (rel <= 5) ? '与公认值相符' : '与公认值偏差偏大';
    var text = '作 U_c–ν 图得直线，斜率 k = ' + qgSci(fit.a, 3) + ' V·s，' +
               '线性相关系数 r² = ' + r2txt + '（共 ' + pts.length + ' 个有效点）。' +
               '由 k = h/e 得普朗克常量 h = e·k = ' + qgSci(h, 3) + ' J·s，' +
               '与公认值 ' + qgSci(QG_H, 4) + ' J·s 相比相对偏差 ' + rel.toFixed(2) + '%，' + okTxt + '；' +
               '图线在横轴上的截距即该材料的截止频率 ν_c，纵轴截距的绝对值乘 e 即逸出功 W₀。' +
               (matTxt ? '本次数据：' + matTxt + '。' : '') +
               '结论：遏止电压 U_c 只随入射光频率线性增大、与光强无关，' +
               '光电子最大初动能 E_k = hν − W₀ 量子化了光的能量。';

    return {
      value: qgSigRound(h, 4),          /* 4 位有效数字；按小数位取整会得到 0 */
      unit: 'J·s',
      h: h,
      rel: qgRound(rel, 2),
      slope: fit.a,
      r2: fit.r2,
      n: pts.length,
      text: text,
      errors: errors
    };
  }

  /* ================================================================ 绘图 */
  /* U–I 特性曲线采样（供画布用；不改数据表） */
  function curve(ph, lo, hi, n) {
    var out = [], i, U, t, imax = ph.Isat + QG_DARK;
    for (i = 0; i < n; i++) {
      t = n > 1 ? (i / (n - 1)) : 0;
      U = lo + (hi - lo) * t;
      out.push({ u: U, i: tubeI(ph, U) });
    }
    return out;
  }

  /* 字体取用：核心给了 F(...) 就用它（与实验台观感一致），
     没给/给坏了就退回自己拼一个，保证 draw() 在任何宿主下都不会因字体而抛异常 */
  function mkFontFn(gr) {
    var custom = (typeof gr.font === 'function') ? gr.font : null;
    return function (size, bold, italic) {
      var s = (italic ? 'italic ' : '') + (bold ? 'bold ' : '') + size + 'px ' + (gr.family || 'Georgia, serif');
      if (custom) {
        try {
          var v = custom(size, bold, italic);
          if (typeof v === 'string' && v) return v;
        } catch (e) { /* 忽略：退回默认字体串 */ }
      }
      return s;
    };
  }

  function mk(gr) {
    var F = mkFontFn(gr);
    function path(pts, close) {
      if (!pts.length) return;
      gr.c.beginPath();
      gr.c.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) gr.c.lineTo(pts[i][0], pts[i][1]);
      if (close) gr.c.closePath();
    }
    return {
      line: function (x1, y1, x2, y2) {
        gr.c.beginPath(); gr.c.moveTo(x1, y1); gr.c.lineTo(x2, y2); gr.c.stroke();
      },
      rect: function (x, y, w, h, fill, stroke, lw) {
        path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
        if (fill) { gr.c.fillStyle = fill; gr.c.fill(); }
        if (stroke) { gr.c.lineWidth = lw || 1; gr.c.strokeStyle = stroke; gr.c.stroke(); }
      },
      poly: function (pts, fill, stroke, lw, close) {
        if (!pts.length) return;
        path(pts, close);
        if (fill) { gr.c.fillStyle = fill; gr.c.fill(); }
        if (stroke) { gr.c.lineWidth = lw || 1; gr.c.strokeStyle = stroke; gr.c.stroke(); }
      },
      circle: function (x, y, r, fill, stroke, lw) {
        gr.c.beginPath(); gr.c.arc(x, y, r, 0, Math.PI * 2);
        if (fill) { gr.c.fillStyle = fill; gr.c.fill(); }
        if (stroke) { gr.c.lineWidth = lw || 1; gr.c.strokeStyle = stroke; gr.c.stroke(); }
      },
      txt: function (s, x, y, font, color, align) {
        gr.c.font = font || F(11, false, false);
        gr.c.fillStyle = color || gr.ink;
        gr.c.textAlign = align || 'left';
        gr.c.textBaseline = 'middle';
        gr.c.fillText(s, x, y);
      },
      dash: function (on, pattern) {
        if (gr.c.setLineDash) gr.c.setLineDash(on ? (pattern || [4, 4]) : []);
      }
    };
  }

  function monoColor(lam) {
    if (lam >= 620) return '#C0392B';
    if (lam >= 570) return '#B8860B';
    if (lam >= 480) return '#2E7D32';
    if (lam >= 430) return '#3B5BA5';
    if (lam >= 380) return '#5B3E9B';
    return '#6A5ACD';
  }

  function head(gr, d, F, title, tag) {
    d.txt(title, 26, 24, F(15, true, false), gr.ink, 'left');
    if (tag) d.txt(tag, gr.w - 26, 24, F(12, false, true), '#7A4A2B', 'right');
  }

  /* 左下：装置示意图（光电管 / 单色光与滤光片 / 微安表 / 电压表 / 滑动变阻器） */
  function drawRig(gr, d, F, ph, r, x0, y0, pw, phh) {
    var x1 = x0 + pw, y1 = y0 + phh, w = pw, h = phh;
    var wl = r.lam, mc = monoColor(wl), isUV = (wl < 380);

    d.rect(x0, y0, w, h, 'rgba(255,255,255,0.62)', 'rgba(38,34,28,0.20)', 1);
    d.txt('① 实验装置', x0 + 12, y0 + 16, F(12, true, false), gr.ink, 'left');
    d.txt('光电管（石英窗）· 单色光 · 微安表 · 电压表 · 分压器', x1 - 12, y0 + 16,
          F(10, false, true), '#6B645C', 'right');

    var bx0 = x0 + 12, bx1 = x1 - 12, by0 = y0 + 30, by1 = y1 - 12;
    var tubeY = by0 + (by1 - by0) * 0.50;

    /* ---- 光源 + 单色器 ---- */
    var lampX = bx0 + 30, lampY = tubeY - 2;
    d.poly([[lampX - 16, lampY - 13], [lampX + 14, lampY - 13], [lampX + 14, lampY + 13], [lampX - 16, lampY + 13]],
           '#4A423A', '#26221C', 1.2, true);
    d.circle(lampX + 20, lampY, 13, 'rgba(255,241,214,0.95)', '#4A423A', 1.2);
    d.txt('光源', lampX - 1, lampY + 24, F(9.5, false, false), '#6B645C', 'center');
    if (isUV) d.txt('重氢灯', lampX - 1, lampY - 24, F(9.5, false, false), '#3B5BA5', 'center');

    /* ---- 滤光片 / 单色器 ---- */
    var fltX = lampX + 46;
    d.rect(fltX - 6, lampY - 20, 12, 40, isUV ? 'rgba(120,140,220,0.30)' : 'rgba(200,190,160,0.40)', '#4A423A', 1.2);
    d.txt(isUV ? '石英窗' : '滤光片', fltX, lampY - 32, F(9.5, false, false), '#6B645C', 'center');

    /* ---- 光束 ---- */
    var beamA = fltX + 7, beamB = bx0 + 178;
    var cols = [monoColor(Math.min(750, wl + 120)), mc, monoColor(Math.max(360, wl - 40))];
    for (var k = 0; k < 3; k++) {
      var yy = lampY - 8 + k * 8;
      gr.c.strokeStyle = cols[k];
      gr.c.lineWidth = isUV ? 1.0 : 1.5;
      d.dash(isUV, [6, 4]);
      d.line(beamA, yy, beamB, yy - 2 + k * 2);
    }
    d.dash(false);
    d.txt('λ = ' + wl.toFixed(1) + ' nm（' + (isUV ? '紫外' : '可见光') + '）', beamA + 2, lampY - 22,
          F(10.5, false, true), mc, 'left');

    /* ---- 光电管 ---- */
    var tcx = bx0 + 224, tcy = tubeY - 18, trx = 32, tryy = 27;
    gr.c.beginPath();
    gr.c.moveTo(tcx - trx, tcy - tryy);
    gr.c.lineTo(tcx + trx - 10, tcy - tryy);
    gr.c.arc(tcx + trx - 10, tcy, tryy, -Math.PI / 2, Math.PI / 2, false);
    gr.c.lineTo(tcx - trx, tcy + tryy);
    gr.c.closePath();
    gr.c.fillStyle = 'rgba(214,228,238,0.55)';
    gr.c.fill();
    gr.c.strokeStyle = '#4A423A'; gr.c.lineWidth = 1.4; gr.c.stroke();

    /* 入射光穿过石英窗照到阴极 K */
    gr.c.save();
    gr.c.beginPath();
    gr.c.moveTo(tcx - trx, tcy - tryy);
    gr.c.lineTo(tcx + trx - 10, tcy - tryy);
    gr.c.arc(tcx + trx - 10, tcy, tryy, -Math.PI / 2, Math.PI / 2, false);
    gr.c.lineTo(tcx - trx, tcy + tryy);
    gr.c.closePath();
    gr.c.clip();
    gr.c.strokeStyle = mc; gr.c.lineWidth = 1.6; d.dash(isUV, [5, 4]);
    for (var q = 0; q < 3; q++) d.line(beamB, lampY - 8 + q * 8, tcx - 9, tcy - 4 + q * 4);
    d.dash(false);
    gr.c.restore();

    /* 阴极 K（左，被照射）与阳极 A（右） */
    d.rect(tcx - 12, tcy - 15, 5, 30, '#8C7B62', '#26221C', 1);
    d.rect(tcx + 8, tcy - 15, 5, 30, '#A79A85', '#26221C', 1);
    d.txt('K', tcx - 20, tcy - 21, F(11, true, false), gr.ink, 'center');
    d.txt('A', tcx + 11, tcy - 21, F(11, true, false), gr.ink, 'center');
    d.txt('光电管', tcx + 4, tcy + tryy + 12, F(9.5, false, false), '#6B645C', 'center');

    /* 光电子：只有发生光电效应才画 */
    if (ph.on) {
      for (var e2 = 0; e2 < 4; e2++) {
        var p0x = tcx - 6, p0y = tcy - 10 + e2 * 7;
        var p1x = tcx + 7, p1y = p0y + 1.5;
        gr.c.strokeStyle = '#C0392B'; gr.c.lineWidth = 1.1;
        d.line(p0x, p0y, p1x, p1y);
        d.poly([[p1x, p1y], [p1x - 4, p1y - 2.4], [p1x - 4, p1y + 2.4]], '#C0392B', null, 1, true);
      }
      d.txt('e⁻', tcx - 3, tcy + 20, F(9, false, false), '#C0392B', 'center');
    }

    /* ---- 电路：K→微安表→电源→A，电压表并联在光电管两端 ---- */
    var railY = by1 - 22;
    gr.c.strokeStyle = '#26221C'; gr.c.lineWidth = 1.6;
    d.line(tcx - 12, tcy + 15, tcx - 12, railY);
    d.line(tcx + 8, tcy + 15, tcx + 8, railY);
    d.circle(tcx - 12, railY, 2.6, '#26221C', null, 0);
    d.circle(tcx + 8, railY, 2.6, '#26221C', null, 0);

    /* 微安表（K 支路） */
    var uax = tcx - 78;
    d.line(tcx - 12, railY, uax + 15, railY);
    d.circle(uax, railY, 15, '#F4F1EA', '#26221C', 1.4);
    d.txt('μA', uax, railY - 3, F(10, true, false), gr.ink, 'center');
    d.txt('微安表', uax, railY + 26, F(9.5, false, false), '#6B645C', 'center');

    /* 电压表（并联在 K、A 之间） */
    var vmx = tcx - 2, vmy = railY + 42;
    if (vmy > by1 - 4) vmy = by1 - 6;
    gr.c.strokeStyle = '#26221C'; gr.c.lineWidth = 1.6;
    d.line(tcx - 12, railY, tcx - 12, vmy);
    d.line(tcx + 8, railY, tcx + 8, vmy);
    d.line(tcx - 12, vmy, vmx - 15, vmy);
    d.line(tcx + 8, vmy, vmx + 15, vmy);
    d.circle(vmx, vmy, 15, '#F4F1EA', '#26221C', 1.4);
    d.txt('V', vmx, vmy - 3, F(10, true, false), gr.ink, 'center');
    d.txt('电压表', vmx, vmy + 25 > by1 - 2 ? vmy - 22 : vmy + 25, F(9.5, false, false), '#6B645C', 'center');

    /* 分压器：电源 + 滑动变阻器（A 支路） */
    var px = tcx + 78;
    d.line(tcx + 8, railY, px - 26, railY);
    d.rect(px - 26, railY - 11, 52, 22, '#EFEADF', '#26221C', 1.4);
    d.txt('滑动变阻器', px, railY + 26, F(9.5, false, false), '#6B645C', 'center');
    d.poly([[px - 9, railY - 13], [px + 9, railY - 13], [px, railY - 26]], '#26221C', null, 0, true);
    d.circle(px, railY - 15, 2.2, '#26221C', null, 0);

    var batx = px + 26;
    d.line(px + 26, railY, batx + 44, railY);
    d.rect(batx + 44, railY - 12, 26, 24, '#EFEADF', '#26221C', 1.4);
    d.txt('电源', batx + 57, railY + 24, F(9.5, false, false), '#6B645C', 'center');

    /* 电压极性说明 */
    d.txt('U > 0：A 接正极（加速，趋饱和）   U < 0：反向偏压（减速，到 −U_c 时电流为零）',
          x0 + 12, y1 - 12, F(10, false, false), '#6B645C', 'left');

    /* 当前读数 */
    var rd = 'U = ' + r.volts.toFixed(2) + ' V　I = ' + qgSig(workI(ph, r.volts), 3) + ' μA';
    d.txt(rd, x1 - 12, y1 - 12, F(11, true, false), '#26221C', 'right');
  }

  /* 右下：光电流–电压曲线 */
  function drawCurve(gr, d, F, ph, r, x0, y0, pw, phh, running) {
    var w = pw, h = phh, x1 = x0 + pw, y1 = y0 + phh;
    d.rect(x0, y0, w, h, 'rgba(255,255,255,0.62)', 'rgba(38,34,28,0.20)', 1);
    d.txt('② 光电流 I – 电压 U 曲线', x0 + 12, y0 + 16, F(12, true, false), gr.ink, 'left');
    var tag = r.mat.name + '　λ=' + r.lam.toFixed(1) + 'nm　光强 ' + r.inten + '%';
    d.txt(tag, x1 - 12, y0 + 16, F(10, false, true), monoColor(r.lam), 'right');

    var p = { x0: x0 + 46, x1: x1 - 16, y0: y0 + 46, y1: y1 - 34 };
    var Ulo = -Math.max(1.2, ph.Uc * 1.35 + 0.25), Uhi = 1.6;
    var Imax = (ph.on ? ph.Isat : 0.02) * 1.14 + QG_DARK;
    function sx(U) { return p.x0 + (U - Ulo) / (Uhi - Ulo) * (p.x1 - p.x0); }
    function sy(I) { return p.y1 - I / Imax * (p.y1 - p.y0); }

    /* 网格 */
    var gx, gy;
    gr.c.strokeStyle = 'rgba(38,34,28,0.10)'; gr.c.lineWidth = 1;
    for (gx = p.x0; gx <= p.x1 + 0.5; gx += (p.x1 - p.x0) / 6) d.line(gx, p.y0, gx, p.y1);
    for (gy = p.y0; gy <= p.y1 + 0.5; gy += (p.y1 - p.y0) / 4) d.line(p.x0, gy, p.x1, gy);

    /* 坐标轴 */
    gr.c.strokeStyle = gr.ink; gr.c.lineWidth = 1.3;
    var yA = sy(0);
    d.line(p.x0, p.y0, p.x0, p.y1);
    d.line(p.x0, yA, p.x1, yA);
    d.txt('U / V', p.x1, yA + 14, F(10, false, false), '#6B645C', 'right');
    d.txt('I / μA', p.x0 - 4, p.y0 - 13, F(10, false, false), '#6B645C', 'left');

    /* 刻度 */
    var tick;
    d.txt(Ulo.toFixed(1), p.x0, yA + 13, F(9.5, false, false), '#6B645C', 'center');
    d.txt(Uhi.toFixed(1), p.x1, yA + 13, F(9.5, false, false), '#6B645C', 'center');
    d.txt(Imax.toFixed(2), p.x0 - 5, p.y0, F(9.5, false, false), '#6B645C', 'right');

    /* 曲线 */
    var pts = [], cv = curve(ph, Ulo, Uhi, 140), i;
    for (i = 0; i < cv.length; i++) pts.push([sx(cv[i].u), sy(cv[i].i)]);
    d.poly(pts, null, monoColor(r.lam), 2, false);

    /* 饱和电流水平线 + 遏止电压竖线 */
    if (ph.on) {
      d.dash(true, [4, 4]);
      gr.c.strokeStyle = 'rgba(38,34,28,0.45)'; gr.c.lineWidth = 1;
      d.line(p.x0, sy(ph.Isat), p.x1, sy(ph.Isat));
      d.txt('饱和电流 ' + qgSig(ph.Isat, 3) + ' μA', p.x1 - 2, sy(ph.Isat) - 9, F(9.5, false, false), '#6B645C', 'right');
      gr.c.strokeStyle = '#C0392B'; gr.c.lineWidth = 1.2;
      d.line(sx(-ph.Uc), p.y0, sx(-ph.Uc), yA);
      d.txt('−U_c = ' + (-ph.Uc).toFixed(2) + ' V', sx(-ph.Uc), yA + 22, F(10, true, false), '#C0392B', 'center');
      d.dash(false);
    } else {
      d.txt('ν < ν_c：不发生光电效应，I ≡ 0', (p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, F(11, false, true), '#8A2B1F', 'center');
      d.dash(false);
    }

    /* 当前工作点 */
    var Iop = workI(ph, r.volts);
    if (Iop > Imax) Iop = Imax;
    d.circle(sx(r.volts), sy(Iop), 4.2, '#C0392B', '#F4F1EA', 1.5);
    d.txt('工作点 (' + r.volts.toFixed(2) + ' V, ' + qgSig(workI(ph, r.volts), 3) + ' μA)',
          qgClamp(sx(r.volts) + 8, p.x0 + 2, p.x1 - 140), sy(Iop) - 13, F(10, false, false), '#C0392B', 'left');

    if (running) {
      d.txt('扫描中…', x0 + 12, y1 - 14, F(10, false, true), '#8A2B1F', 'left');
    }
    d.txt('光强只改变饱和电流的高度；曲线与 U 轴的交点 −U_c 不随光强移动。',
          x0 + 12, y0 + 44, F(10, false, false), '#6B645C', 'left');
  }

  /* 右上角读数条 */
  function drawReadout(gr, d, F, ph, r, x0, y0, pw) {
    var items = [
      ['λ', r.lam.toFixed(1) + ' nm'],
      ['ν', qgSci(ph.nu, 3) + ' Hz'],
      ['ε = hν', qgSig(ph.eps, 3) + ' eV'],
      ['W₀', r.mat.W.toFixed(2) + ' eV'],
      ['E_k', qgSig(ph.EkEv, 3) + ' eV'],
      ['U_c', ph.on ? qgSig(ph.Uc, 3) + ' V' : '—'],
      ['ν_c', qgSci(ph.nuc, 3) + ' Hz'],
      ['I', qgSig(workI(ph, r.volts), 3) + ' μA']
    ];
    var h = 30, w = pw, n = items.length, gap = w / n;
    d.rect(x0, y0, w, h, 'rgba(255,255,255,0.70)', 'rgba(38,34,28,0.20)', 1);
    for (var i = 0; i < n; i++) {
      var cx = x0 + gap * i + 10;
      d.txt(items[i][0], cx, y0 + 10, F(10, false, true), '#6B645C', 'left');
      d.txt(items[i][1], cx, y0 + 23, F(12, true, false), gr.ink, 'left');
    }
  }

  function draw(g, p, state) {
    var gr = g || {};
    var c = gr.c;
    if (!c) return;
    var W = qgNum(gr.w, 800), H = qgNum(gr.h, 560);
    var d = mk(gr);
    var F = mkFontFn(gr);
    var r = readP(p);
    var ph = physics(r);
    var stateObj = state || {};

    c.save();
    try {
      if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
      if (c.clearRect) c.clearRect(0, 0, W, H);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.font = F(11, false, false);

      head(gr, d, F, '探究光电效应的规律', r.mat.name + '　W₀ = ' + r.mat.W.toFixed(2) + ' eV');

      var M = 26, gapy = 12;
      var readH = 30;
      var top = 40;
      var restH = H - top - M - readH - 12;
      var rigH = restH * 0.46;               /* 上面板：装置示意图 */
      var curH = restH - rigH - gapy;        /* 下面板：I–U 曲线（留够高度，曲线才看得清） */
      if (curH < 130) { curH = 130; rigH = restH - curH - gapy; }
      if (rigH < 120) { rigH = 120; }
      var fullW = W - M * 2;

      drawReadout(gr, d, F, ph, r, M, top, fullW);
      drawRig(gr, d, F, ph, r, M, top + readH + 12, fullW, rigH);
      drawCurve(gr, d, F, ph, r, M, top + readH + 12 + rigH + gapy, fullW, curH, stateObj.running);
      if (H < 430 || W < 560) {
        d.txt('（画面偏小：把窗口拉大一些，装置与曲线会更清楚）', M, H - 8, F(10, false, true), '#8A8378', 'left');
      }
    } finally {
      c.restore();
    }
  }

  /* ========================================================= 登记（§4） */
  window.QG_PSLAB.register('photoelectric', {
    id: 'photoelectric',
    name: '探究光电效应的规律',
    group: '近代物理',
    aim: '用不同频率的单色光照射光电管，测遏止电压 U_c，作 U_c–ν 图线求普朗克常量 h，并验证遏止电压与光强无关',

    principle: '爱因斯坦光电效应方程 E_k = hν − W₀（W₀ 为金属逸出功）。' +
               '光电子最大初动能被反向电压全部"吃掉"时，eU_c = E_k，故 U_c = (hν − W₀)/e = (h/e)ν − W₀/e：' +
               'U_c 与 ν 成一次函数，斜率 k = h/e（由此得 h = e·k），横轴截距 ν_c = W₀/h 叫截止频率；' +
               'ν < ν_c 时无论光多强都不发生光电效应。光强只决定单位时间到达阳极的光电子数，' +
               '即只改变饱和电流 I_sat 的大小，不改变 U_c —— 这正是"光的能量量子化"与经典波动说的分水岭。',

    apparatus: [
      '光电管（真空管，阴极 K 为待测金属膜：钠 / 锌 / 铂，紫外波段需石英窗口）',
      '低压汞灯 + 滤光片（或单色仪）：给出 750 / 589.3 / 435.8 / 400 nm 等可见光谱线',
      '重氢灯（紫外波段）：给出 253.7 / 220 / 200 / 180 / 160 / 150 nm 谱线',
      '微安表（测光电流，分辨力约 0.01 μA）',
      '直流电压表（测光电管两端电压，分辨力约 0.01 V）',
      '滑动变阻器（分压接法，提供 −4 V ~ +4 V 连续可调电压）',
      '直流电源、开关、导线'
    ],

    steps: [
      '按图连好电路：微安表与光电管串联，电压表并联在光电管两端，滑动变阻器接成分压器，注意电压可以从反向连续调到正向。',
      '装上某种材料的阴极（如钠），先选一条可见光谱线（如 435.8 nm），遮住入射光，观察微安表读出的暗电流/本底电流。',
      '打开光源，把电压调到 +1.5 V 以上，光电流达到最大且不再随电压增大 → 这就是饱和电流 I_sat，记下它。',
      '把光强减为原来的一半，重复上一步：可以看到饱和电流随之减小（约减半），但下一步测出的遏止电压不变。',
      '换到反向偏压，从 0 V 慢慢往负方向调，光电流逐渐减小；电流恰好减小到零（或反向电流最小的转折点）时，电压表读数的大小就是遏止电压 U_c。',
      '换用不同波长的单色光（每换一次都要重新调零/读数），各测一次 U_c，填入数据表；每次测量都记下 ν = c/λ。为减小读数误差，同一波长建议重复测 3~5 次取平均。',
      '把同一材料的数据作 U_c–ν 图线，用最小二乘法（或取两端点）求斜率 k = h/e，算出 h = e k；再由横轴截距求截止频率 ν_c，进而求逸出功 W₀ = hν_c。',
      '换用锌、铂阴极重复以上步骤，比较不同逸出功材料的 U_c–ν 图线：斜率相同（都是 h/e），截距不同（W₀ 不同）。'
    ],

    params: [
      { key: 'lambda', label: '入射光波长 λ', unit: 'nm', type: 'select', value: 435.8,
        options: [
          { value: 750.0, label: '750.0 nm 红光（滤光片）' },
          { value: 589.3, label: '589.3 nm 钠黄光' },
          { value: 435.8, label: '435.8 nm 氢蓝光' },
          { value: 400.0, label: '400.0 nm 紫光' },
          { value: 253.7, label: '253.7 nm 紫外（汞灯）' },
          { value: 220.0, label: '220.0 nm 紫外（重氢灯）' },
          { value: 200.0, label: '200.0 nm 紫外（重氢灯）' },
          { value: 180.0, label: '180.0 nm 紫外（重氢灯）' },
          { value: 160.0, label: '160.0 nm 紫外（重氢灯）' },
          { value: 150.0, label: '150.0 nm 紫外（重氢灯）' }
        ] },
      { key: 'material', label: '阴极材料', unit: '', type: 'select', value: 'na',
        options: [
          { value: 'na', label: '钠 Na（W₀ = 2.28 eV）' },
          { value: 'zn', label: '锌 Zn（W₀ = 4.30 eV）' },
          { value: 'pt', label: '铂 Pt（W₀ = 6.35 eV）' }
        ] },
      { key: 'intensity', label: '入射光强（相对值）', unit: '%', min: 10, max: 100, step: 5, value: 100 },
      { key: 'voltage', label: '光电管电压 U（负值即反向偏压）', unit: 'V', min: -4, max: 4, step: 0.05, value: 0 }
    ],

    measure: measure,

    columns: [
      { key: 'lambda', label: '波长 λ', unit: 'nm' },
      { key: 'nu', label: '频率 ν', unit: 'Hz' },
      { key: 'eps', label: '光子能量 hν', unit: 'eV' },
      { key: 'Ek', label: '最大初动能 E_k', unit: 'eV' },
      { key: 'Uc', label: '遏止电压 U_c', unit: 'V' },
      { key: 'I', label: '光电流 I', unit: 'μA' },
      { key: 'U', label: '管压 U', unit: 'V' },
      { key: 'Isat', label: '饱和电流', unit: 'μA' },
      { key: 'W', label: '逸出功 W₀', unit: 'eV' },
      { key: 'nuc', label: '截止频率 ν_c', unit: 'Hz' }
    ],

    graph: {
      x: 'nu',
      y: 'Uc',
      fit: 'linear',
      title: 'U_c–ν 图线（由斜率 k = h/e 求普朗克常量）',
      note: '斜率 k = h/e ⇒ h = e·k；横轴截距为截止频率 ν_c = W₀/h，纵轴截距的绝对值为 W₀/e。' +
            '注意：只有 U_c > 0（该频率能发生光电效应）的点才落在拟合直线上。',
      xLabel: '频率 ν / Hz',
      yLabel: '遏止电压 U_c / V'
    },

    conclude: conclude,
    draw: draw
  });
})();
