/* ============================================================================
 * 穷观 · 化学实验台 · 组 5 · 反应速率与化学平衡（js/clab/kinetics.js）
 * Build ID: QG-20260920-5e5d5a          （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向化学实验台注册表登记 6 个"速率与平衡"实验
 *     rate-concentration  浓度对反应速率的影响（Na₂S₂O₃ + H₂SO₄，出现浑浊的时间）
 *     rate-temperature    温度对反应速率的影响（同一体系，不同温度 → 阿伦尼乌斯图线）
 *     rate-catalyst       催化剂对 H₂O₂ 分解速率的影响（MnO₂ / FeCl₃ / CuSO₄）
 *     equilibrium-fescn   Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃ 平衡移动（加 FeCl₃/KSCN/NaOH、稀释、升温、加压）
 *     equilibrium-no2     2NO₂ ⇌ N₂O₄ 平衡移动（加压/减压/升温/降温 → 颜色深浅）
 *     weak-electrolyte    弱电解质电离平衡（稀释、同离子、加碱/加酸、升温）
 *
 * **本组是"必须能作图"的一组**：每个反应都给可量化的列并声明 graph:{x,y,fit}，
 * 而且自变量都能"扫"（出现浑浊的时间 t / 速率 1/t / 产气速率 / 颜色深浅 / pH），
 * 图线是本文件的核心产出（详见各 spec 的 graph.note）。
 *
 * 纯 ES5、零外部依赖、不用 eval / new Function；画面全部用调用方给的 Canvas 2D
 * 上下文画，不建任何 DOM 节点、不起循环（惰性）。
 *
 * 契约：window.QG_CLAB.register(id, spec)，字段见 docs/化学实验台设计.md §3、§4。
 * 绘图约定沿用 docs/物理实验台设计.md §9：
 *   · g.font 宽容签名（(size)/(size,bool)/(size,'italic bold')/(size,italic,bold)）；
 *   · **null = 该行在这张图上没有有效值**（不是 0）——例如"不加催化剂"时收满 20 mL O₂
 *     的时间项目记 null（表格显示「—」），真实的 0 照常记 0；
 *   · 选项型参数（操作/催化剂/控温方式）一律 { type:'select', options:[…], value }；
 *   · **r² 只在"扫自变量"时才有意义** —— 本文件每组都有明确的可扫自变量
 *     （浓度 c、温度 T、催化剂用量、加入量 V、活塞体积 V、稀释倍数 n）。
 *
 * `ionic` 的写法（与组 4 一致，实测过核心的平衡校验）：先给一个**干净的净离子方程式**，
 * 后面跟一个**中文括注**补充说明（核心的 normEqText 会先剥掉含汉字的括注再解析，所以
 * 带括注也能通过配平校验），另给 `ionicNet` 一份不带任何括注的纯离子方程式。
 * 气体之间/催化分解这类**没有离子方程式**的反应，`ionic` 与 `ionicNet` 一律给 ''（空串合法）。
 *
 * ----------------------------------------------------------------------------
 * 【化学事实的权威来源核对】（不凭记忆编造；只有搜索摘录的写明"摘录"）
 *
 * · Na₂S₂O₃ + H₂SO₄ = Na₂SO₄ + S↓ + SO₂↑ + H₂O（生成乳白色/淡黄色硫单质浑浊），
 *   通过"出现浑浊的时间"比较速率；**温度越高、浓度越大，出现浑浊越快**：
 *     https://cjournal.hep.com.cn/1004-2326/CN/10.19935/j.cnki.1004-2326.2025.09.026
 *       （《实验教学与仪器》2025,42(9):80-82 全文可读：反应式；25 ℃ 与 60 ℃ 对比"温度越高，
 *         化学反应速率越快"；高低浓度对比"浓度越高，化学反应速率越快"；
 *         还给出"单位时间内产生沉淀量"的定量方法）
 *     https://gaotu.cn/topic/8@590771499342151682@1/483/400 （高途·高中"影响化学反应速率的外因"
 *         全文：同浓度时温度越高速率越快、同温度时浓度越大速率越快，"最先出现浑浊"）
 *     https://www.jyeoo.com/shiti/dcd10bc8-115b-1550-aa5b-116552572c2a （菁优网·全文：
 *         "通过测定该反应发生时溶液变浑浊的时间，研究外界条件对化学反应速率的影响"，
 *         ①⑤或②④探究温度、①②③探究浓度）
 * · 温度每升高 10 ℃，反应速率增大到原来的 2~4 倍（经验规律；本模型取约 2 倍）：
 *     https://mirror1.dsedj.gov.mo/tplan/2020/plan/C086.pdf （澳门教学计划·摘录："溫度每升高
 *         10℃，反應速率增加為原來3倍"）
 *     http://tiku.rizhaojiaoyu.cn/shiti/17878473.shtml （摘录："温度每升高10℃反应速率是原来的2倍"）
 * · H₂O₂ 分解：2H₂O₂ = 2H₂O + O₂↑；MnO₂、FeCl₃（Fe³⁺）都能催化，加催化剂后
 *   "试管中有大量气泡产生、带火星木条复燃"，且催化剂反应前后质量与化学性质不变：
 *     https://www.jyeoo.com/shiti/7310761d-150a-4b15-95c1-42f070b025d8  （菁优网·全文：
 *         FeCl₃ 催化 H₂O₂，"试管中有大量气泡产生，带火星木条复燃"；起催化作用的是 Fe³⁺ 不是 Cl⁻）
 *     https://www.jyeoo.com/shiti/94101938-da15-4158-b059-f1ca6b64d252/ （菁优网·全文：
 *         FeCl₃ 溶液可作催化剂；反应前后质量、化学性质不变）
 *     https://www.jyeoo.com/shiti/dcd10bc8-115b-1550-aa5b-116552572c2a （菁优网·相似题·摘录：
 *         "已知：Cu²⁺、Fe³⁺ 对 H₂O₂ 的分解起催化作用"）
 * · Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃（血红色）：加浓 FeCl₃ / 加 KSCN → 红色**变深**（正向移动）；
 *   加 NaOH 固体 → Fe³⁺ 被沉淀、红色**变浅**（逆向移动）；该体系适合研究浓度与温度，
 *   **不适合研究压强**（溶液中没有气体参加）：
 *     https://www.jyeoo.com/shiti/10d4d6eb-9215-4b15-a57f-d7207afc625c  （菁优网·全文：5 份
 *         平衡混合液的对比实验设计：①水 ②KCl ③饱和 FeCl₃ ④KSCN ⑤NaOH；③比①深、
 *         ④正向移动、⑤"减少反应物浓度，平衡发生逆向移动"）
 *     https://www.jyeoo.com/shiti/a8905510-5115-4915-55ec-46ded878725a （菁优网·摘录：
 *         "加入浓 FeCl₃ 溶液后的混合溶液红色变深；加入浓 KSCN 溶液后红色变深；
 *          加入 NaOH 固体后红色变浅"；A（2NO₂⇌N₂O₄）适合研究浓度、温度、压强，
 *          B（FeCl₃+3KSCN）只适合研究浓度、温度）
 *     https://studio.wuhaneduyun.cn/index.php?r=studio/post/view&sid=303&id=14584 （武汉教育云·
 *         名师工作室文章全文：改变温度平衡一定移动；加 KCl 固体不影响，加 KCl 溶液是"稀释"
 *         使平衡逆向移动、颜色变浅）
 *     络合反应放热（升温红色略变浅、降温加深）：
 *     https://qb.zuoyebang.com/xfe-question/question/50a5c69c501304e7134256da81fef01b.html（问答·摘录）
 * · 2NO₂(g) ⇌ N₂O₄(g) ΔH<0：**升温颜色变深、降温颜色变浅**（升温向吸热方向移动）：
 *     https://www.jyeoo.com/shiti/f210f94c-d15c-4155-a5db-f7fc670c25ab （菁优网·全文：甲瓶升温
 *         "气体的颜色将变深……平衡逆向移动，c(NO₂) 增大"，乙瓶降温"颜色将变浅……平衡向正
 *         反应方向移动"，结论"升温平衡向吸热方向移动，降温平衡向放热反应方向移动"）
 *   压缩体积（加压）：平衡向气体体积减小的方向（正反应）移动，混合气体平均相对分子质量增大：
 *     https://gaotu.cn/topic/8@547895382941818880@1/483/112 （高途·全文：注射器压缩，
 *         "保持活塞位置不变后，平衡向着正向移动，混合气体的物质的量逐渐减小，M 增大"）
 * · 弱电解质电离平衡：加水稀释 → 电离程度增大而 c(H⁺) 减小；加同离子（NH₄Cl/CH₃COONa）
 *   → 抑制电离、pH 增大；加 NaOH → c(OH⁻) 增大、pH 增大；弱电解质的电离一般吸热：
 *     https://gaotu.cn/topic/8@576125716979331072@1/483/400 （高途·全文：氨水中加 NH₄Cl 固体
 *         "电离平衡左移，c(OH⁻) 减小"；加水稀释 c(OH⁻) 减小；稀释醋酸时
 *         c(CH₃COO⁻)/c(CH₃COOH) 增大（电离程度增大）而 c(H⁺) 减小）
 *     https://www.jyeoo.com/shiti/c4417d10-a415-1589-b5f7-93a837c25d7c （菁优网·全文：
 *         0.1 mol/L 醋酸加醋酸钠晶体后 pH 增大，"醋酸钠溶于水电离出大量醋酸根离子，
 *         抑制了醋酸的电离，使 c(H⁺) 减小"）
 *     https://studio.wuhaneduyun.cn/index.php?r=studio/post/view&sid=303&id=14584 （同上一文：
 *         "弱电解质的电离一般是吸热过程，故其电离 ΔH>0"）
 * ========================================================================== */
(function () {
  'use strict';

  var BUILD = 'QG-20260920-5e5d5a';

  /* ====================================================================== *
   * 0. 通用小工具（纯函数，不碰 DOM）                                       *
   * ====================================================================== */

  function isfn(v) { return typeof v === 'function'; }
  function isfin(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
  function num(v, d) {
    var x = (typeof v === 'string') ? parseFloat(v) : v;
    return isfin(x) ? x : d;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fx(x, n) { return isfin(x) ? x.toFixed(n) : '—'; }
  function lg(x) { return x > 0 ? Math.log(x) / Math.LN10 : 0; }

  function pv(p, k, d) {
    if (!p) return d;
    var v = p[k];
    if (v === undefined || v === null || v === '') return d;
    return v;
  }
  function pnum(p, k, d) { return num(pv(p, k, d), d); }

  /* 确定性伪随机（Park–Miller）：便于"扫自变量测 r²"复现；核心给了 ctx.noise 就用核心的 */
  var rndState = 20260920 % 2147483647;
  function nextRand() {
    rndState = (rndState * 16807) % 2147483647;
    return (rndState - 1) / 2147483646;
  }
  function nrm(ctx, sigma) {
    if (!isfin(sigma) || sigma <= 0) return 0;
    if (ctx && isfn(ctx.noise)) {
      var v = null;
      try { v = ctx.noise(sigma); } catch (e) { v = null; }
      if (isfin(v)) return v;
    }
    var u1 = nextRand(), u2 = nextRand();
    if (u1 < 1e-9) u1 = 1e-9;
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(6.283185307179586 * u2);
  }

  var RGAS = 8.314;

  /* ---- 反应速率模型：Na₂S₂O₃ + H₂SO₄（本组两个反应的公共体系） ---- */
  /* 表观速率常数：由"0.1 mol/L Na₂S₂O₃ + 0.1 mol/L H₂SO₄（混合后各 0.1 mol/L）在 25 ℃
     约 45 s 出现浑浊"这一通行实验标定；Ea 取 52 kJ/mol，使"每升高 10 ℃ 速率约 2 倍"
     （与"2~4 倍"的经验规律一致）。 */
  var K298 = 2.2e-4;        /* L/(mol·s) */
  var EA_THIO = 52000;      /* J/mol */
  var DTHR = 1.0e-4;        /* mol/L：肉眼可辨"出现浑浊"所需消耗的 S₂O₃²⁻ 浓度 */
  function kThio(T) { return K298 * Math.exp(-EA_THIO / RGAS * (1 / T - 1 / 298.15)); }
  function thioState(c1, c2, water, tempC) {
    var Vtot = 10 + Math.max(0, water);                 /* mL：5 mL + 5 mL + 加水 */
    var cMix = c1 * 5 / Vtot;
    var cAcid = c2 * 5 / Vtot;
    var T = 273.15 + tempC;
    var rate = kThio(T) * cMix * cAcid;                  /* mol/(L·s) */
    if (!(rate > 1e-12)) rate = 1e-12;
    return { V: Vtot, cMix: cMix, cAcid: cAcid, T: T, rate: rate, t: DTHR / rate };
  }
  /* 计时误差（人眼判断浑浊 + 秒表）：约 ±(0.2 + 2% t) 秒 */
  function timed(ctx, t, level) {
    var sig = (0.20 + 0.02 * t) * (isfin(level) ? level : 1);
    var v = t + nrm(ctx, sig);
    if (!(v > 0.5)) v = 0.5;
    return Math.round(v * 10) / 10;
  }

  /* ---- 平衡求解小工具 ---- */
  /* Fe3+ + 3SCN- ⇌ Fe(SCN)3：K = x/((Fe-x)(SCN-3x)^3)，左边单调增 → 二分 */
  function solveFeSCN(Fe, SCN, K) {
    var hiCap = Math.min(Fe, SCN / 3);
    if (!(hiCap > 0) || !(K > 0)) return 0;
    var lo = 0, hi = hiCap * (1 - 1e-12), mid, i, q;
    for (i = 0; i < 90; i++) {
      mid = (lo + hi) / 2;
      q = mid / (Math.max(Fe - mid, 1e-15) * Math.pow(Math.max(SCN - 3 * mid, 1e-15), 3));
      if (q < K) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  /* 2NO2 ⇌ N2O4：n0 = a + 2b，Kc = (b/V)/(a/V)^2 → a = [-1+sqrt(1+8·Kc·n0/V)]/(4·Kc/V) */
  function no2State(VmL, TK, n0mmol) {
    var VL = Math.max(VmL, 1) / 1000;                   /* L */
    var n0 = Math.max(n0mmol, 1e-6) / 1000;             /* mol */
    var Kc = 170 * Math.exp(-(-57200) / RGAS * (1 / TK - 1 / 298.15)); /* 2NO2⇌N2O4 正反应放热 */
    var A = 4 * Kc / VL;                                /* 4Kc/V */
    var a = (-1 + Math.sqrt(1 + 2 * A * n0)) / A;       /* mol NO2 */
    if (!(a > 0) || !(a < n0)) a = n0;
    var b = (n0 - a) / 2;                               /* mol N2O4 */
    var cNO2 = a / VL * 1000;                           /* mmol/L */
    var cN2O4 = b / VL * 1000;                          /* mmol/L */
    var p = (a + b) * 1000 * RGAS * TK / Math.max(VmL, 1);   /* kPa */
    return { Kc: Kc, a: a, b: b, cNO2: cNO2, cN2O4: cN2O4, p: p, alpha: (n0 - a) / n0 * 100 };
  }
  var REF_NO2 = no2State(60, 298.15, 4).cNO2;           /* 相对颜色的参考态：25 ℃、60 mL、4 mmol */

  /* ---- 弱电解质（醋酸）模型 ---- */
  var KA25 = 1.75e-5;
  function kaOf(T) { return KA25 * Math.exp(-2000 / RGAS * (1 / T - 1 / 298.15)); }
  function hacX(c, Ka) {                                  /* 一元弱酸：Ka = x²/(c-x) */
    if (!(c > 0)) return 0;
    return (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * c)) / 2;
  }

  /* ====================================================================== *
   * 1. 画图通用件（与其它组同一纸面观感：米白纸 + 墨色 + Georgia 斜体）      *
   * ====================================================================== */

  var PAPER = '#F4F1EA', INK = '#26221C';
  var CLOUD = '#d8d2c2', SULFUR = '#e0d79a', ACID = '#cfe0ea';
  // PINK 原本只在 electro.js 的文件级 IIFE 里定义 —— 跨文件拿不到（weak-electrolyte 的
  // draw 在 op=加NaOH 且 c0 很小、pH>7 时会用到它），实测会抛 "PINK is not defined"、
  // 画面在 pH 读数之后整块不画（338 -> 46 条指令）。这里补上本文件自己的定义，取值与
  // electro.js 保持一致，别删。
  var BLOOD = '#a3232b', NO2C = '#b4642a', RED = '#a3232b', BLUE = '#4a7fb5', PINK = '#d9607f';
  var H2O2C = '#bcd7e6', GRAYG = '#8d9aa3', GREEN = '#5f8a4a';

  function ctxOf(g) {
    if (!g) return null;
    if (g.c && g.c.canvas) return g.c;
    if (g.ctx && g.ctx.canvas) return g.ctx;
    if (g.ctx2d && g.ctx2d.canvas) return g.ctx2d;
    if (g.canvas && isfn(g.canvas.getContext)) {
      try { return g.canvas.getContext('2d'); } catch (e) { return null; }
    }
    return null;
  }
  function fontOf(g, size, italic, bold) {
    var s = Math.round(num(size, 12));
    if (g && isfn(g.font)) {
      try {
        var f = g.font(s, italic !== false, !!bold);
        if (typeof f === 'string' && f) return f;
      } catch (e) { /* 自己拼 */ }
    }
    return ((italic === false) ? '' : 'italic ') + (bold ? 'bold ' : '') +
      s + 'px Georgia,"Times New Roman",serif';
  }
  function txt(g, s, x, y, size, align, color, italic, bold) {
    if (g && isfn(g.text)) {
      try { g.text(s, x, y, size, align, color); return; } catch (e) { /* 原生兜底 */ }
    }
    var c = ctxOf(g);
    if (!c) return;
    c.save();
    c.font = fontOf(g, size, italic, bold);
    c.fillStyle = color || INK;
    c.textAlign = align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillText(String(s), x, y);
    c.restore();
  }
  function ln(g, x1, y1, x2, y2, color, w, dash) {
    var c = ctxOf(g);
    if (!c) return;
    if (g && isfn(g.line) && !dash) {
      try { g.line(x1, y1, x2, y2, color, w); return; } catch (e) { /* 原生兜底 */ }
    }
    c.save();
    c.strokeStyle = color || INK;
    c.lineWidth = w || 1;
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.restore();
  }
  function arrow(g, x1, y1, x2, y2, color, w) {
    var c = ctxOf(g);
    if (!c) return;
    if (g && isfn(g.arrow)) {
      try { g.arrow(x1, y1, x2, y2, color, w); return; } catch (e) { /* 原生兜底 */ }
    }
    var col = color || INK;
    c.save();
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w || 1.4;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    var ang = Math.atan2(y2 - y1, x2 - x1), L = 8;
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - L * Math.cos(ang - 0.4), y2 - L * Math.sin(ang - 0.4));
    c.lineTo(x2 - L * Math.cos(ang + 0.4), y2 - L * Math.sin(ang + 0.4));
    c.closePath(); c.fill();
    c.restore();
  }
  function box(g, x, y, w, h, fill, stroke, lw, r) {
    var c = ctxOf(g);
    if (!c) return;
    var rad = num(r, 0);
    c.save();
    c.beginPath();
    if (rad > 0) {
      c.moveTo(x + rad, y);
      c.lineTo(x + w - rad, y); c.quadraticCurveTo(x + w, y, x + w, y + rad);
      c.lineTo(x + w, y + h - rad); c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
      c.lineTo(x + rad, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rad);
      c.lineTo(x, y + rad); c.quadraticCurveTo(x, y, x + rad, y);
      c.closePath();
    } else c.rect(x, y, w, h);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.2; c.stroke(); }
    c.restore();
  }
  function circle(g, x, y, r, fill, stroke, lw) {
    var c = ctxOf(g);
    if (!c) return;
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, 6.283185307179586);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.1; c.stroke(); }
    c.restore();
  }
  function ell(g, x, y, rx, ry, fill, stroke, lw) {
    var c = ctxOf(g);
    if (!c) return;
    c.save();
    c.beginPath();
    if (c.ellipse) c.ellipse(x, y, rx, ry, 0, 0, 6.283185307179586);
    else {
      var k = 0.5522847498;
      c.moveTo(x + rx, y);
      c.bezierCurveTo(x + rx, y + ry * k, x + rx * k, y + ry, x, y + ry);
      c.bezierCurveTo(x - rx * k, y + ry, x - rx, y + ry * k, x - rx, y);
      c.bezierCurveTo(x - rx, y - ry * k, x - rx * k, y - ry, x, y - ry);
      c.bezierCurveTo(x + rx * k, y - ry, x + rx, y - ry * k, x + rx, y);
      c.closePath();
    }
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.1; c.stroke(); }
    c.restore();
  }
  function poly(g, pts, fill, stroke, lw) {
    var c = ctxOf(g), i;
    if (!c || !pts || pts.length < 2) return;
    c.save();
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.1; c.stroke(); }
    c.restore();
  }
  /* 试管（管口朝上；x,y = 管口左上角） */
  function tube(g, x, y, w, h, liquid, level, stroke) {
    var c = ctxOf(g);
    if (!c) return;
    c.save();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y + h - w / 2);
    c.arc(x + w / 2, y + h - w / 2, w / 2, Math.PI, 0, true);
    c.lineTo(x + w, y);
    c.strokeStyle = stroke || INK; c.lineWidth = 1.4; c.stroke();
    if (liquid) {
      var lh = clamp(num(level, 0.5), 0, 0.92) * h;
      c.save();
      c.beginPath();
      c.moveTo(x + 1, y + h - lh);
      c.lineTo(x + 1, y + h - w / 2);
      c.arc(x + w / 2, y + h - w / 2, w / 2 - 1, Math.PI, 0, true);
      c.lineTo(x + w - 1, y + h - lh);
      c.closePath();
      c.fillStyle = liquid; c.fill();
      c.restore();
    }
    c.restore();
  }
  /* 浑浊颗粒（确定性点阵；dens 0~1） */
  function specks(g, x, y, w, h, dens, color, seed) {
    var c = ctxOf(g), i, n, s;
    if (!c) return;
    n = Math.round(clamp(dens, 0, 1) * 110);
    s = num(seed, 1);
    c.save();
    c.fillStyle = color;
    for (i = 0; i < n; i++) {
      var rx = ((i * 12.9898 + s * 78.233) % 1 + 1) % 1;
      var ry = ((i * 39.3468 + s * 11.135) % 1 + 1) % 1;
      c.beginPath();
      c.arc(x + rx * w, y + ry * h, 0.8 + 1.2 * (((i * 7.13 + s) % 1 + 1) % 1), 0, 6.283185307179586);
      c.fill();
    }
    c.restore();
  }
  function bubbles(g, x, y, w, h, phase, n, color) {
    var c = ctxOf(g), i;
    if (!c) return;
    for (i = 0; i < n; i++) {
      var f = ((i * 0.37 + phase * 0.25) % 1 + 1) % 1;
      var px = x + w * (0.12 + 0.76 * (((i * 0.61 + phase * 0.13) % 1 + 1) % 1));
      var py = y + h * (1 - f);
      var r = 1.1 + 1.9 * (((i * 0.29 + 0.3) % 1 + 1) % 1);
      circle(g, px, py, r, null, color || 'rgba(38,34,28,.55)', 1);
    }
  }
  function sceneSize(g) {
    var c = ctxOf(g), W, H, dpr;
    dpr = num(g && g.dpr, 1); if (!(dpr > 0)) dpr = 1;
    W = num(g && g.w, 0);
    if (!(W > 0)) W = (c && c.canvas) ? c.canvas.width / dpr : 640;
    H = num(g && g.h, 0);
    if (!(H > 0)) H = (c && c.canvas) ? c.canvas.height / dpr : 420;
    return { w: Math.max(160, W), h: Math.max(120, H), dpr: dpr };
  }
  function scaleOf(g) {
    var S = sceneSize(g), s = num(g && g.scale, 0);
    if (!(s > 0)) s = Math.min(S.w / 760, S.h / 470);
    return clamp(s, 0.5, 2);
  }
  function panel(g, x, y, w, lines) {
    var i, lh = 15, h = 10 + lines.length * lh;
    box(g, x, y, w, h, 'rgba(255,255,255,.55)', 'rgba(38,34,28,.35)', 1, 4);
    for (i = 0; i < lines.length; i++) {
      txt(g, lines[i][0], x + 8, y + 20 + i * lh, 11.5, 'left', lines[i][1] || 'rgba(38,34,28,.86)');
    }
    return h;
  }
  function paperTitle(g, str, sub) {
    var S = sceneSize(g), sc = scaleOf(g);
    txt(g, str, 14 * sc, 24 * sc, Math.round(14 * sc), 'left', 'rgba(38,34,28,.88)');
    if (sub) txt(g, sub, 14 * sc, 40 * sc, Math.round(11 * sc), 'left', 'rgba(38,34,28,.6)');
    ln(g, 12 * sc, 46 * sc, S.w - 12 * sc, 46 * sc, 'rgba(38,34,28,.25)', 1);
  }
  /* 秒表 */
  function stopwatch(g, x, y, r, label) {
    circle(g, x, y, r, 'rgba(255,255,255,.75)', INK, 1.4);
    ln(g, x, y - r, x, y - r - 5, INK, 1.6);
    ln(g, x, y, x + r * 0.55, y - r * 0.35, INK, 1.4);
    if (label) txt(g, label, x, y + r + 13, 11, 'center', 'rgba(38,34,28,.8)');
  }
  /* 水浴烧杯 */
  function bath(g, x, y, w, h, color, label) {
    box(g, x, y, w, h, null, INK, 1.5);
    box(g, x + 1, y + h * 0.35, w - 2, h * 0.65 - 1, color, null, 0);
    if (label) txt(g, label, x + w / 2, y + h + 14, 11, 'center', 'rgba(38,34,28,.78)');
  }
  function lastRow(state) {
    if (!state || !state.rows || !state.rows.length) return null;
    return state.rows[state.rows.length - 1];
  }
  function rowVal(row, k) {
    if (!row) return NaN;
    var v = row[k];
    if (v === undefined || v === null || v === '') {
      if (row.measures && typeof row.measures === 'object') v = row.measures[k];
    }
    return num(v, NaN);
  }
  /* 颜色深浅（血红色 / 红棕色）：用 alpha 叠色画一个色块 */
  function tint(g, x, y, w, h, amount, rgb, maxA) {
    var a = clamp(num(amount, 0), 0, 1) * (isfin(maxA) ? maxA : 0.85);
    box(g, x, y, w, h, 'rgba(' + rgb + ',' + fx(a, 3) + ')', null, 0);
  }

  /* ====================================================================== *
   * 2. 反应 1 · 浓度对反应速率的影响（Na₂S₂O₃ + H₂SO₄）                     *
   * ====================================================================== */

  var rateConc = {
    id: 'rate-concentration',
    name: '浓度对化学反应速率的影响（Na₂S₂O₃ + H₂SO₄）',
    group: '反应速率与化学平衡',
    aim: '用不同浓度的 Na₂S₂O₃、H₂SO₄ 溶液反应，测"出现浑浊的时间"，作出速率–浓度图线',
    principle: 'Na2S2O3 + H2SO4 = Na2SO4 + S↓ + SO2↑ + H2O，生成的硫单质使溶液出现淡黄色浑浊。' +
      '硫代硫酸根与 H+ 的反应：S2O3^2- + 2H+ = S↓ + SO2↑ + H2O。' +
      '其它条件不变时，反应物浓度越大，单位体积内活化分子数越多，有效碰撞越频繁，反应速率越快，' +
      '出现浑浊所需时间 t 越短。用 1/t 表示相对反应速率，则 1/t 与反应物浓度成正比（正比关系），' +
      '所以 t 与浓度成反比。加水稀释（总体积增大）会使浓度减小、浑浊出现变慢，' +
      '因此做浓度对比实验时必须控制总体积相同、观察标准相同（同一标记线）。',
    apparatus: ['试管（若干支，规格相同）', '量筒（10 mL）', '胶头滴管', '秒表', '0.1 mol/L Na₂S₂O₃ 溶液',
      '0.1 mol/L 稀硫酸', '蒸馏水', '白纸与黑色标记（十字）', '温度计'],
    steps: ['在试管中加入规定体积的 Na₂S₂O₃ 溶液，按需要加入蒸馏水控制总体积',
      '在另一支试管中加入相同体积的稀硫酸，两支试管同时放入水浴中恒温',
      '把稀硫酸迅速倒入 Na₂S₂O₃ 溶液，立即开始计时并振荡',
      '在试管下面垫一张画有十字标记的白纸，从管口俯视，记录十字完全看不见的时间 t',
      '改变 Na₂S₂O₃（或 H₂SO₄）的浓度（或加水量）重复实验，用 1/t 比较速率的相对大小'],
    params: [
      { key: 'c1', label: 'Na₂S₂O₃ 溶液浓度', unit: 'mol/L', min: 0.05, max: 0.50, step: 0.05, value: 0.20 },
      { key: 'c2', label: '稀硫酸浓度', unit: 'mol/L', min: 0.05, max: 1.00, step: 0.05, value: 0.20 },
      { key: 'water', label: '另加蒸馏水体积', unit: 'mL', min: 0, max: 10, step: 1, value: 0 },
      { key: 'temp', label: '水浴温度', unit: '℃', min: 10, max: 60, step: 1, value: 25 }
    ],
    react: function (p, ctx) {
      var c1 = pnum(p, 'c1', 0.20);
      var c2 = pnum(p, 'c2', 0.20);
      var water = pnum(p, 'water', 0);
      var temp = pnum(p, 'temp', 25);
      var st = thioState(c1, c2, water, temp);
      var t = timed(ctx, st.t, 1);
      var rate = 1000 / t;                              /* 10⁻³ s⁻¹，相对速率 */

      var ph = [];
      ph.push('混合后溶液先是澄清的，随后逐渐变浑浊（生成淡黄色硫单质）');
      ph.push('浑浊逐渐加重，直到试管下面白纸上的十字标记完全看不见，此时停止计时（t = ' + fx(t, 1) + ' s）');
      ph.push('管口有刺激性气味气体产生（SO₂，有毒，需在通风处并用 NaOH 溶液吸收）');
      if (c1 >= 0.35 || c2 >= 0.6) ph.push('反应物浓度较大，浑浊出现得很快（' + fx(t, 1) + ' s 就看不到标记）');
      if (c1 <= 0.10) ph.push('Na₂S₂O₃ 浓度较小，浑浊出现明显变慢（t = ' + fx(t, 1) + ' s）');
      if (water >= 4) ph.push('加入 ' + fx(water, 0) + ' mL 蒸馏水后浓度被稀释，出现浑浊的时间明显变长');
      if (c2 <= 0.10) ph.push('稀硫酸浓度较小，c(H⁺) 低，反应速率较小');
      if (temp >= 45) ph.push('水浴温度较高，出现浑浊的时间进一步缩短');

      return {
        phenomena: ph,
        equation: 'Na2S2O3 + H2SO4 = Na2SO4 + S↓ + SO2↑ + H2O',
        ionic: 'S2O32- + 2H+ = S↓ + SO2↑ + H2O（Na+ 与 SO4^2- 不参加反应，反应中硫元素既被氧化又被还原）',
        ionicNet: 'S2O32- + 2H+ = S↓ + SO2↑ + H2O',
        type: '氧化还原反应（速率探究·控制变量法）',
        conditions: '常温或水浴恒温，稀硫酸，混合后立即计时至溶液出现浑浊（观察标准相同）',
        note: '混合后浓度：c(Na₂S₂O₃) = ' + fx(st.cMix, 3) + ' mol/L，c(H₂SO₄) = ' + fx(st.cAcid, 3) +
          ' mol/L；总体积 ' + fx(st.V, 1) + ' mL（控制变量：总体积与观察标准相同）',
        measures: {
          c1: c1, c2: c2, V: st.V, cMix: st.cMix, cAcid: st.cAcid,
          temp: temp, t: t, rate: rate
        }
      };
    },
    columns: [
      { key: 'cMix', label: '混合后 c(Na₂S₂O₃)', unit: 'mol/L' },
      { key: 'cAcid', label: '混合后 c(H₂SO₄)', unit: 'mol/L' },
      { key: 'V', label: '混合液总体积', unit: 'mL' },
      { key: 'temp', label: '温度', unit: '℃' },
      { key: 't', label: '出现浑浊的时间 t', unit: 's' },
      { key: 'rate', label: '反应速率 1/t（相对）', unit: '10⁻³ s⁻¹' }
    ],
    graph: {
      x: 'cMix', y: 'rate', fit: 'linear',
      title: '反应速率(1/t)–Na₂S₂O₃ 浓度 图线',
      note: '扫"Na₂S₂O₃ 溶液浓度"这个自变量（保持稀硫酸浓度、温度、总体积不变）：' +
        '浓度越大，出现浑浊的时间越短，1/t 越大；1/t 与浓度成正比，图线是过原点的直线。'
    },
    conclude: function (rows, p) {
      var n = rows ? rows.length : 0;
      return {
        text: '在其它条件不变时，反应物浓度越大，反应速率越快：' +
          'Na₂S₂O₃ 与稀硫酸反应生成硫单质，浓度大的试管出现浑浊所需时间短，1/t 大。' +
          '共记录 ' + n + ' 组数据，以 1/t 为纵轴、混合后 c(Na₂S₂O₃) 为横轴作图得到过原点的直线，' +
          '说明该反应在实验范围内速率与浓度成正比（v ∝ c）。' +
          '做此实验必须控制总体积相同、温度相同、观察"出现浑浊"的标准相同。',
        equation: 'Na2S2O3 + H2SO4 = Na2SO4 + S↓ + SO2↑ + H2O',
        ionic: 'S2O32- + 2H+ = S↓ + SO2↑ + H2O',
        errors: [
          '计时起点与终点都靠人眼判断（倒入最后一滴到开始计时、十字标记刚好看不见），有约 0.2~0.5 s 的主观误差',
          '两支试管没有同时放入水浴恒温，混合时温度不一致，会改变速率（温度是强影响因素）',
          '加蒸馏水控制体积时读数不准，实际浓度偏离设定值，图线斜率偏差',
          '硫单质会附着在管壁上，观察时若试管晃动或从侧面看，浑浊终点判断偏晚',
          '生成的 SO₂ 有刺激性气味且有毒，未及时用碱液吸收会影响实验环境'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var row = lastRow(state);
      var ph = num(anim.rc, 0), w = S.w, h = S.h;
      var c1 = pnum(p, 'c1', 0.20), water = pnum(p, 'water', 0);
      var t = rowVal(row, 't');
      var cloud = isfin(t) ? clamp(60 / t, 0.12, 1) : 0.3;
      paperTitle(g, '浓度对反应速率的影响（Na₂S₂O₃ + H₂SO₄）',
        'Na₂S₂O₃ + H₂SO₄ = Na₂SO₄ + S↓ + SO₂↑ + H₂O　·　浓度越大，出现浑浊越快（t 越短）');
      /* 两支对比试管：左 = 当前浓度，右 = 参照（0.05 mol/L 稀释） */
      var ty = 100 * sc, tw = 34 * sc, th = 150 * sc;
      var x1 = w * 0.26, x2 = w * 0.52;
      var cRef = 0.05;
      var tRef = DTHR / Math.max(kThio(273.15 + pnum(p, 'temp', 25)) * (cRef * 5 / (10 + water)) *
        (pnum(p, 'c2', 0.20) * 5 / (10 + water)), 1e-12);
      var cloudRef = clamp(60 / tRef, 0.12, 1);
      /* 各自的浑浊程度按"同一时刻"比较：当前浓度比参照快，所以当前更浑浊 */
      var ratio = clamp(cloud / Math.max(cloudRef, 1e-6), 0.2, 3);
      var dens1 = clamp(0.25 + 0.5 * ratio, 0, 1);
      var dens2 = clamp(0.25 + 0.5 / ratio, 0, 1);
      tube(g, x1 - tw / 2, ty, tw, th, 'rgba(236,232,214,.8)', 0.62);
      specks(g, x1 - tw / 2, ty + th * 0.38, tw, th * 0.62, dens1, 'rgba(214,205,150,.95)', 3);
      tube(g, x2 - tw / 2, ty, tw, th, 'rgba(236,232,214,.8)', 0.62);
      specks(g, x2 - tw / 2, ty + th * 0.38, tw, th * 0.62, dens2, 'rgba(214,205,150,.95)', 8);
      txt(g, 'c(Na₂S₂O₃) = ' + fx(c1, 2) + ' mol/L', x1, ty + th + 18 * sc, 11 * sc, 'center', INK);
      txt(g, '对照：0.05 mol/L', x2, ty + th + 18 * sc, 11 * sc, 'center', 'rgba(38,34,28,.7)');
      /* 十字标记（观察标准） */
      var my = ty + th - 16 * sc;
      ln(g, x1 - 12 * sc, my, x1 + 12 * sc, my, 'rgba(38,34,28,.55)', 1.2);
      ln(g, x1, my - 10 * sc, x1, my + 10 * sc, 'rgba(38,34,28,.55)', 1.2);
      txt(g, '十字标记（看不清时停止计时）', x1, my + 26 * sc, 10 * sc, 'center', 'rgba(38,34,28,.6)');
      /* 秒表 */
      stopwatch(g, w * 0.78, ty + 46 * sc, 30 * sc,
        't = ' + (isfin(t) ? fx(t, 1) : '—') + ' s');
      txt(g, '1/t = ' + (isfin(rowVal(row, 'rate')) ? fx(rowVal(row, 'rate'), 2) : '—') + ' ×10⁻³ s⁻¹',
        w * 0.78, ty + 106 * sc, 11.5 * sc, 'center', RED);
      /* 浓度–速率小图（用最近若干行画点，展示"成正比"） */
      var gx = w * 0.78 - 62 * sc, gy = ty + 140 * sc, gw = 124 * sc, gh = 90 * sc;
      box(g, gx, gy, gw, gh, 'rgba(255,255,255,.5)', 'rgba(38,34,28,.3)', 1, 3);
      ln(g, gx + 22 * sc, gy + gh - 16 * sc, gx + gw - 8 * sc, gy + gh - 16 * sc, 'rgba(38,34,28,.5)', 1);
      ln(g, gx + 22 * sc, gy + gh - 16 * sc, gx + 22 * sc, gy + 8 * sc, 'rgba(38,34,28,.5)', 1);
      txt(g, '1/t', gx + 12 * sc, gy + 18 * sc, 10 * sc, 'center', 'rgba(38,34,28,.7)');
      txt(g, 'c', gx + gw - 12 * sc, gy + gh - 4 * sc, 10 * sc, 'center', 'rgba(38,34,28,.7)');
      var rows = (state && state.rows) ? state.rows : [];
      var i, mx = 1e-9, my2 = 1e-9;
      for (i = 0; i < rows.length; i++) {
        var cx0 = rowVal(rows[i], 'cMix'), cy0 = rowVal(rows[i], 'rate');
        if (isfin(cx0) && cx0 > mx) mx = cx0;
        if (isfin(cy0) && cy0 > my2) my2 = cy0;
      }
      for (i = 0; i < rows.length; i++) {
        var px = rowVal(rows[i], 'cMix'), py = rowVal(rows[i], 'rate');
        if (!isfin(px) || !isfin(py)) continue;
        circle(g, gx + 22 * sc + (gw - 30 * sc) * (px / mx),
          gy + gh - 16 * sc - (gh - 26 * sc) * (py / my2), 2.4, RED, null, 0);
      }
      /* 气泡（SO₂ 逸出）+ 标记 */
      bubbles(g, x1 - tw / 2, ty - 20 * sc, tw, 24 * sc, ph, 3, 'rgba(150,140,90,.6)');
      var lines = [
        ['混合后 c(Na₂S₂O₃) = ' + fx(rowVal(row, 'cMix'), 3) + ' mol/L', INK],
        ['混合后 c(H₂SO₄) = ' + fx(rowVal(row, 'cAcid'), 3) + ' mol/L', INK],
        ['总体积 = ' + fx(rowVal(row, 'V'), 1) + ' mL　T = ' + fx(pnum(p, 'temp', 25), 0) + ' ℃', INK],
        ['出现浑浊时间 t = ' + (isfin(t) ? fx(t, 1) : '—') + ' s', RED],
        ['相对速率 1/t = ' + (isfin(rowVal(row, 'rate')) ? fx(rowVal(row, 'rate'), 2) : '—') + ' ×10⁻³ s⁻¹', RED],
        ['已记录 ' + rows.length + ' 组（可扫浓度作图）', GRAYG]
      ];
      panel(g, w - 226 * sc, 56 * sc, 212 * sc, lines);
      txt(g, '结论：其它条件不变时，浓度越大 → 单位体积活化分子越多 → 有效碰撞越多 → 速率越快（v ∝ c）',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.rc = num(anim.rc, 0) + (isfin(dt) ? dt : 0) * 0.9;
      if (anim.rc > 1e6) anim.rc = 0;
    }
  };

  /* ====================================================================== *
   * 3. 反应 2 · 温度对反应速率的影响（同一体系）                            *
   * ====================================================================== */

  var rateTemp = {
    id: 'rate-temperature',
    name: '温度对化学反应速率的影响（Na₂S₂O₃ + H₂SO₄）',
    group: '反应速率与化学平衡',
    aim: '在同一浓度下改变温度，测"出现浑浊的时间"，作 ln(1/t)–1/T 图线并估算活化能',
    principle: '温度升高使分子运动加快、活化分子百分数增大（有效碰撞增多），反应速率迅速增大；' +
      '经验规律是"温度每升高 10 ℃，反应速率增大到原来的 2~4 倍"。' +
      '用出现浑浊时间的倒数 1/t 表示相对速率，把 ln(1/t) 对 1/T 作图（阿伦尼乌斯关系）得到直线：' +
      'ln(1/t) = ln A − Ea/(RT)，斜率 = −Ea/R，由斜率可估算反应的活化能 Ea。' +
      '注意：温度是强影响因素，做浓度对比实验时必须先恒温。',
    apparatus: ['试管（若干支）', '烧杯（水浴：冷水、温水、热水）', '温度计', '酒精灯/热水',
      '秒表', '0.1 mol/L Na₂S₂O₃ 溶液', '0.1 mol/L 稀硫酸', '白纸与十字标记'],
    steps: ['取两支试管分别加入相同体积、相同浓度的 Na₂S₂O₃ 溶液和稀硫酸',
      '把两支试管同时放入同一温度的水浴中恒温约 2 min',
      '迅速混合并立即计时，记录出现浑浊（十字看不清）的时间',
      '改变水浴温度（如 15、25、35、45、55 ℃）重复实验',
      '把 ln(1/t) 对 1/T 作图，由斜率估算活化能 Ea'],
    params: [
      { key: 'temp', label: '水浴温度', unit: '℃', min: 10, max: 60, step: 1, value: 25 },
      { key: 'c1', label: 'Na₂S₂O₃ 溶液浓度', unit: 'mol/L', min: 0.05, max: 0.50, step: 0.05, value: 0.20 },
      { key: 'c2', label: '稀硫酸浓度', unit: 'mol/L', min: 0.05, max: 1.00, step: 0.05, value: 0.20 },
      { key: 'heating', label: '控温方式', type: 'select',
        options: [
          { value: 'bath', label: '水浴恒温（温度均匀）' },
          { value: 'direct', label: '直接加热（温度不均匀、误差大）' }
        ], value: 'bath' }
    ],
    react: function (p, ctx) {
      var temp = pnum(p, 'temp', 25);
      var c1 = pnum(p, 'c1', 0.20);
      var c2 = pnum(p, 'c2', 0.20);
      var way = String(pv(p, 'heating', 'bath'));
      var st = thioState(c1, c2, 0, temp);
      var level = (way === 'direct') ? 2.6 : 1.0;
      var t = timed(ctx, st.t, level);
      var rate = 1000 / t;
      var T = 273.15 + temp;
      var invT = 1000 / T;                              /* 10⁻³ K⁻¹ */
      var lnRate = Math.log(rate);
      var st25 = thioState(c1, c2, 0, 25);
      var t25 = timed(ctx, st25.t, 0.35);               /* 参照：25 ℃ 的速率（误差小） */
      var ratio = (1 / t) / (1 / t25);
      var ea = -EA_THIO / 1000;                         /* 模型取 52 kJ/mol */

      var ph = [];
      ph.push('温度越高，出现浑浊所需时间越短：本组实验 t = ' + fx(t, 1) + ' s');
      ph.push('热水浴中的试管很快变浑浊，冷水浴（或室温）中的试管浑浊得慢');
      ph.push('每升高 10 ℃，反应速率约增大到原来的 2 倍（经验规律为 2~4 倍，与活化能大小有关）');
      if (way === 'direct') ph.push('直接用火焰加热时试管内温度不均匀、局部过热，计时结果分散（误差比水浴大）');
      if (temp >= 45) ph.push('温度较高（' + fx(temp, 0) + ' ℃），速率约为 25 ℃ 时的 ' + fx(ratio, 1) + ' 倍');
      if (temp <= 15) ph.push('温度较低（' + fx(temp, 0) + ' ℃），浑浊出现很慢，需要耐心观察并防止温度回升');
      ph.push('把两支试管先在水浴中恒温再混合，是为了保证混合瞬间温度一致');

      return {
        phenomena: ph,
        equation: 'Na2S2O3 + H2SO4 = Na2SO4 + S↓ + SO2↑ + H2O',
        ionic: 'S2O32- + 2H+ = S↓ + SO2↑ + H2O',
        ionicNet: 'S2O32- + 2H+ = S↓ + SO2↑ + H2O',
        type: '氧化还原反应（温度对速率的影响·阿伦尼乌斯关系）',
        conditions: (way === 'direct' ? '直接加热控温' : '水浴恒温') + '，同一浓度的 Na₂S₂O₃ 与稀硫酸，混合后立即计时',
        note: '图线做法：纵轴 ln(1/t)（1/t 用 10⁻³ s⁻¹），横轴 1/T（10⁻³ K⁻¹）；' +
          '斜率 = −Ea/R，本模型取 Ea ≈ ' + fx(ea, 0) + ' kJ/mol',
        measures: {
          temp: temp, T: T, invT: invT, cMix: st.cMix, cAcid: st.cAcid,
          t: t, rate: rate, lnRate: lnRate, ratio: ratio, t25: t25
        }
      };
    },
    columns: [
      { key: 'temp', label: '温度', unit: '℃' },
      { key: 'invT', label: '1/T', unit: '10⁻³ K⁻¹' },
      { key: 't', label: '出现浑浊的时间 t', unit: 's' },
      { key: 'rate', label: '反应速率 1/t（相对）', unit: '10⁻³ s⁻¹' },
      { key: 'lnRate', label: 'ln(1/t)', unit: '' },
      { key: 'ratio', label: '相对 25 ℃ 的倍数', unit: '倍' },
      { key: 't25', label: '同一浓度 25 ℃ 的 t', unit: 's' }
    ],
    graph: {
      x: 'invT', y: 'lnRate', fit: 'linear',
      title: 'ln(1/t)–1/T 图线（阿伦尼乌斯关系，斜率 = −Ea/R）',
      note: '扫"水浴温度"这个自变量（浓度、体积、观察标准不变）：' +
        '温度越高 1/t 越大；ln(1/t) 对 1/T 作图是斜率为负的直线，' +
        '由斜率可估算活化能 Ea（模型值约 52 kJ/mol）。'
    },
    conclude: function (rows, p) {
      var n = rows ? rows.length : 0;
      return {
        text: '其它条件不变时，升高温度反应速率明显加快：温度升高使活化分子百分数增大、' +
          '有效碰撞增多，出现浑浊所需时间缩短；经验规律是温度每升高 10 ℃ 速率增大到原来的 2~4 倍。' +
          '共记录 ' + n + ' 组数据，以 ln(1/t) 对 1/T 作图得直线，斜率 = −Ea/R，' +
          '由此可估算该反应的活化能（模型值约 52 kJ/mol，对应每升温 10 ℃ 约 2 倍）。',
        equation: 'Na2S2O3 + H2SO4 = Na2SO4 + S↓ + SO2↑ + H2O',
        ionic: 'S2O32- + 2H+ = S↓ + SO2↑ + H2O',
        errors: [
          '水浴温度读数与试管内实际温度有差别（未充分恒温），高温组偏差更明显',
          '温度高时反应太快，计时反应时间（人眼判断终点）带来的相对误差被放大',
          '热水浴温度随时间下降（散热），同一组实验内温度不恒定',
          '用直接加热代替水浴时温度不均匀、局部过热，数据点明显分散、偏离直线',
          '观察浑浊终点的标准（白纸上的十字标记、光线）在不同温度组之间未保持一致'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var row = lastRow(state);
      var ph = num(anim.rt, 0), w = S.w, h = S.h;
      var temp = pnum(p, 'temp', 25);
      var hot = temp >= 35;
      paperTitle(g, '温度对反应速率的影响（Na₂S₂O₃ + H₂SO₄）',
        '温度越高 → 活化分子百分数越大 → 出现浑浊越快　·　ln(1/t) 对 1/T 作图为直线');
      /* 两个水浴：左热 右冷（相对当前温度） */
      var by = 150 * sc, bw = 118 * sc, bh = 104 * sc;
      var x1 = w * 0.27, x2 = w * 0.55;
      bath(g, x1 - bw / 2, by, bw, bh, hot ? 'rgba(226,178,150,.55)' : 'rgba(168,203,228,.55)',
        hot ? '热水浴（' + fx(temp, 0) + ' ℃）' : '温水浴（' + fx(temp, 0) + ' ℃）');
      bath(g, x2 - bw / 2, by, bw, bh, 'rgba(168,203,228,.55)', '冷水浴（约 15 ℃ 对照）');
      /* 水浴里的对流/气泡（随动画相位动 → 画布像素会变） */
      bubbles(g, x1 - bw / 2 + 6 * sc, by + bh * 0.42, bw - 12 * sc, bh * 0.5, ph,
        hot ? 7 : 3, 'rgba(150,175,200,.55)');
      bubbles(g, x2 - bw / 2 + 6 * sc, by + bh * 0.42, bw - 12 * sc, bh * 0.5, ph + 0.5,
        3, 'rgba(150,175,200,.45)');
      /* 试管 */
      var tw = 26 * sc, th = 96 * sc, ty = by + 4 * sc;
      tube(g, x1 - tw / 2, ty, tw, th, 'rgba(236,232,214,.8)', 0.6);
      tube(g, x2 - tw / 2, ty, tw, th, 'rgba(236,232,214,.8)', 0.6);
      var t = rowVal(row, 't');
      var dens1 = isfin(t) ? clamp(70 / t, 0.1, 1) : 0.4;
      var st15 = thioState(pnum(p, 'c1', 0.2), pnum(p, 'c2', 0.2), 0, 15);
      var dens2 = clamp(70 / st15.t, 0.1, 1);
      specks(g, x1 - tw / 2, ty + th * 0.4, tw, th * 0.6, dens1, 'rgba(214,205,150,.95)', 4);
      specks(g, x2 - tw / 2, ty + th * 0.4, tw, th * 0.6, dens2, 'rgba(214,205,150,.95)', 9);
      /* 温度计 */
      ln(g, x1 + bw / 2 - 16 * sc, by - 34 * sc, x1 + bw / 2 - 16 * sc, by + bh * 0.72, INK, 3.2);
      circle(g, x1 + bw / 2 - 16 * sc, by + bh * 0.74, 4 * sc, RED, null, 0);
      txt(g, fx(temp, 0) + ' ℃', x1 + bw / 2 - 16 * sc, by - 40 * sc, 11 * sc, 'center', RED);
      /* 秒表 + 速率对比 */
      stopwatch(g, w * 0.79, by + 26 * sc, 28 * sc, 't = ' + (isfin(t) ? fx(t, 1) : '—') + ' s');
      txt(g, '1/t = ' + (isfin(rowVal(row, 'rate')) ? fx(rowVal(row, 'rate'), 2) : '—') + ' ×10⁻³ s⁻¹',
        w * 0.79, by + 80 * sc, 11.5 * sc, 'center', RED);
      txt(g, '相对 25 ℃：' + (isfin(rowVal(row, 'ratio')) ? fx(rowVal(row, 'ratio'), 2) : '—') + ' 倍',
        w * 0.79, by + 96 * sc, 11 * sc, 'center', 'rgba(38,34,28,.8)');
      /* ln(1/t)–1/T 小图 */
      var gx = w * 0.79 - 66 * sc, gy = by + 112 * sc, gw = 132 * sc, gh = 96 * sc;
      box(g, gx, gy, gw, gh, 'rgba(255,255,255,.5)', 'rgba(38,34,28,.3)', 1, 3);
      ln(g, gx + 24 * sc, gy + gh - 16 * sc, gx + gw - 8 * sc, gy + gh - 16 * sc, 'rgba(38,34,28,.5)', 1);
      ln(g, gx + 24 * sc, gy + gh - 16 * sc, gx + 24 * sc, gy + 10 * sc, 'rgba(38,34,28,.5)', 1);
      txt(g, 'ln(1/t)', gx + 12 * sc, gy + 22 * sc, 9.5 * sc, 'center', 'rgba(38,34,28,.7)');
      txt(g, '1/T', gx + gw - 16 * sc, gy + gh - 4 * sc, 9.5 * sc, 'center', 'rgba(38,34,28,.7)');
      var rows = (state && state.rows) ? state.rows : [], i;
      var xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
      for (i = 0; i < rows.length; i++) {
        var ix = rowVal(rows[i], 'invT'), iy = rowVal(rows[i], 'lnRate');
        if (!isfin(ix) || !isfin(iy)) continue;
        if (ix < xmin) xmin = ix; if (ix > xmax) xmax = ix;
        if (iy < ymin) ymin = iy; if (iy > ymax) ymax = iy;
      }
      if (xmax - xmin < 1e-6) { xmax = xmin + 0.5; }
      if (ymax - ymin < 1e-6) { ymax = ymin + 1; }
      for (i = 0; i < rows.length; i++) {
        var px = rowVal(rows[i], 'invT'), py = rowVal(rows[i], 'lnRate');
        if (!isfin(px) || !isfin(py)) continue;
        circle(g, gx + 24 * sc + (gw - 32 * sc) * (px - xmin) / (xmax - xmin),
          gy + gh - 16 * sc - (gh - 28 * sc) * (py - ymin) / (ymax - ymin), 2.4, RED, null, 0);
      }
      txt(g, '斜率 = −Ea/R', gx + gw / 2, gy + gh + 13 * sc, 10 * sc, 'center', RED);
      var lines = [
        ['设定水浴温度 = ' + fx(pnum(p, 'temp', 25), 0) + ' ℃　控温：' +
          (String(pv(p, 'heating', 'bath')) === 'direct' ? '直接加热' : '水浴恒温'), INK],
        ['Na₂S₂O₃ = ' + fx(pnum(p, 'c1', 0.2), 2) + ' mol/L　H₂SO₄ = ' + fx(pnum(p, 'c2', 0.2), 2) + ' mol/L', INK],
        ['水浴温度 T = ' + fx(temp, 0) + ' ℃ （' + fx(rowVal(row, 'T'), 2) + ' K）', INK],
        ['1/T = ' + (isfin(rowVal(row, 'invT')) ? fx(rowVal(row, 'invT'), 4) : '—') + ' ×10⁻³ K⁻¹', INK],
        ['出现浑浊 t = ' + (isfin(t) ? fx(t, 1) : '—') + ' s', RED],
        ['ln(1/t) = ' + (isfin(rowVal(row, 'lnRate')) ? fx(rowVal(row, 'lnRate'), 3) : '—'), RED],
        ['控温方式：' + (String(pv(p, 'heating', 'bath')) === 'direct' ? '直接加热（误差大）' : '水浴恒温'), GRAYG],
        ['已记录 ' + rows.length + ' 组（可扫温度作图）', GRAYG]
      ];
      panel(g, w - 226 * sc, 56 * sc, 212 * sc, lines);
      txt(g, '结论：升温使活化分子百分数增大 → 有效碰撞增多 → 速率迅速增大（每升 10 ℃ 约 2~4 倍）',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.rt = num(anim.rt, 0) + (isfin(dt) ? dt : 0) * 1.1;
      if (anim.rt > 1e6) anim.rt = 0;
    }
  };

  /* ====================================================================== *
   * 4. 反应 3 · 催化剂对 H₂O₂ 分解速率的影响                               *
   * ====================================================================== */

  var CATS = {
    none: { k: 0.004, name: '不加催化剂', short: '催化剂', color: GRAYG },
    mno2: { k: 1.00, name: 'MnO₂ 粉末', short: 'MnO₂', color: '#4a4a46' },
    fecl3: { k: 0.42, name: 'FeCl₃ 溶液（Fe³⁺）', short: 'FeCl₃ 溶液', color: '#b98a3a' },
    cuso4: { k: 0.30, name: 'CuSO₄ 溶液（Cu²⁺）', short: 'CuSO₄ 溶液', color: '#4a7fb5' }
  };

  var rateCat = {
    id: 'rate-catalyst',
    name: '催化剂对化学反应速率的影响（H₂O₂ 分解）',
    group: '反应速率与化学平衡',
    aim: '比较不加催化剂与加入 MnO₂、FeCl₃、CuSO₄ 时 H₂O₂ 分解的快慢，测产气速率并作图',
    principle: '2H2O2 --催化剂--> 2H2O + O2↑。催化剂能降低反应的活化能，使活化分子百分数增大，' +
      '从而加快反应速率；催化剂在反应前后质量和化学性质都不改变。' +
      '本实验用相同浓度、相同体积的 H₂O₂ 溶液，比较收集相同体积（20 mL）O₂ 所需时间 t，' +
      '用平均产气速率 v = V(O₂)/t 或 1/t 表示反应速率的相对大小。' +
      '同一催化剂下，v 与 H₂O₂ 的浓度成正比（v = k·c）；不同催化剂的 k 不同（MnO₂ > Fe³⁺ > Cu²⁺ > 无催化剂）。',
    apparatus: ['试管（若干支）', '药匙', '胶头滴管', '量筒', '秒表', '带火星的木条',
      '5% H₂O₂ 溶液', 'MnO₂ 粉末', 'FeCl₃ 溶液', 'CuSO₄ 溶液', '排水法集气装置（或注射器）'],
    steps: ['取相同体积、相同浓度的 H₂O₂ 溶液分别加入试管',
      '一支不加催化剂，其余分别加入 MnO₂ 粉末、FeCl₃ 溶液、CuSO₄ 溶液',
      '立即塞上带导管的塞子，用排水法（或注射器）收集气体并同时计时',
      '记录收集 20 mL O₂ 所需时间 t，计算平均产气速率 v = 20/t',
      '把带火星的木条伸到管口检验氧气；改变 H₂O₂ 浓度（或催化剂用量）重复实验，作图比较'],
    params: [
      { key: 'cat', label: '催化剂', type: 'select',
        options: [
          { value: 'mno2', label: 'MnO₂ 粉末' },
          { value: 'none', label: '不加催化剂' },
          { value: 'fecl3', label: 'FeCl₃ 溶液（Fe³⁺）' },
          { value: 'cuso4', label: 'CuSO₄ 溶液（Cu²⁺）' }
        ], value: 'mno2' },
      { key: 'catAmt', label: '催化剂用量', unit: 'g', min: 0, max: 1.0, step: 0.05, value: 0.20 },
      { key: 'cH2O2', label: 'H₂O₂ 溶液浓度', unit: '%', min: 1, max: 20, step: 1, value: 5 },
      { key: 'temp', label: '温度', unit: '℃', min: 10, max: 50, step: 1, value: 25 }
    ],
    react: function (p, ctx) {
      var cat = String(pv(p, 'cat', 'mno2'));
      var amt = pnum(p, 'catAmt', 0.20);
      var conc = pnum(p, 'cH2O2', 5);
      var temp = pnum(p, 'temp', 25);
      var info = CATS[cat] || CATS.none;
      var kCat = info.k;
      var sat = 1 - Math.exp(-clamp(amt, 0, 3) / 0.12);   /* 用量增大 → 活性趋于饱和 */
      var kNow = CATS.none.k + (kCat - CATS.none.k) * (cat === 'none' ? 0 : sat);
      var tf = Math.exp(50000 / RGAS * (1 / 298.15 - 1 / (273.15 + temp)));
      var vO2 = 4.0 * kNow * (conc / 5) * tf;             /* mL/s */
      vO2 = clamp(vO2, 0.0005, 400);
      var o2Total = 2 * (conc / 100) / 34 / 2 * 22400;    /* 2 mL 溶液的理论产氧量（mL） */
      var t20 = (vO2 > 20 / 3600) ? Math.round(20 / vO2 * 10) / 10 : null;
      if (t20 !== null) t20 = t20 * (1 + 0.01 * nrm(ctx, 1));  /* 计时的细小误差 */
      var rateRel = vO2 / (4.0 * CATS.mno2.k * 1 * 1) * 100;   /* 相对 MnO₂ 满量程的百分数 */

      var ph = [];
      if (cat === 'none') {
        ph.push('不加催化剂时几乎看不到气泡，放置很久试管内也没有明显变化');
        ph.push('收集 20 mL O₂ 需要很长时间（本条件下未能在 1 h 内收满，时间项目记 null）');
        ph.push('说明常温下 H₂O₂ 分解很慢，需要催化剂或加热才能明显加快');
      } else {
        ph.push('加入 ' + info.short + ' 后立即产生大量气泡（产气速率 v ≈ ' + fx(vO2, 2) + ' mL/s）');
        ph.push('把带火星的木条伸到管口，木条复燃，说明生成的气体是 O₂');
        ph.push('试管壁发热，说明 H₂O₂ 分解是放热反应');
        ph.push('反应结束后 ' + info.name + '的质量和化学性质都没有改变（催化剂的特点）');
      }
      if (conc >= 12) ph.push('H₂O₂ 浓度大（' + fx(conc, 0) + '%），产气明显更快、更剧烈');
      if (conc <= 2) ph.push('H₂O₂ 浓度小（' + fx(conc, 0) + '%），气泡产生得很慢');
      if (amt >= 0.6 && cat !== 'none') ph.push('催化剂用量已较大，速率增大但趋于饱和（再增加用量效果不明显）');
      if (amt < 0.05 && cat !== 'none') ph.push('催化剂用量很少，速率接近不加催化剂时的水平');
      if (temp >= 40) ph.push('温度升高，分解速率进一步加快（催化剂与温度共同影响速率）');

      return {
        phenomena: ph,
        equation: '2H2O2 = 2H2O + O2↑',
        ionic: '',            /* H₂O₂ 是弱电解质，催化分解不写离子方程式 */
        ionicNet: '',
        type: '分解反应（催化剂对速率的影响）',
        conditions: '常温（或水浴控温），' + info.short + ' 催化，排水法收集并计量气体',
        note: 'H₂O₂ 是弱电解质，本反应通常写化学方程式；催化剂只改变速率、不改变化学平衡与产物',
        measures: {
          cH2O2: conc, catAmt: amt, temp: temp, vO2: vO2, t20: t20,
          o2Total: o2Total, rateRel: rateRel, kRel: kNow / CATS.mno2.k
        }
      };
    },
    columns: [
      { key: 'cH2O2', label: 'H₂O₂ 浓度', unit: '%' },
      { key: 'catAmt', label: '催化剂用量', unit: 'g' },
      { key: 'temp', label: '温度', unit: '℃' },
      { key: 'vO2', label: '平均产气速率 v(O₂)', unit: 'mL/s' },
      { key: 't20', label: '收集 20 mL O₂ 的时间', unit: 's' },
      { key: 'o2Total', label: '理论产氧量（2 mL 溶液）', unit: 'mL' },
      { key: 'rateRel', label: '相对速率（MnO₂ 满量程=100）', unit: '' }
    ],
    graph: {
      x: 'cH2O2', y: 'vO2', fit: 'origin',
      title: '平均产气速率–H₂O₂ 浓度 图线（v = k·c）',
      note: '扫"H₂O₂ 溶液浓度"这个自变量（催化剂种类、用量、温度不变）：' +
        '产气速率与浓度成正比，图线是过原点的直线；换用不同催化剂只改变斜率（k 越大线越陡），' +
        '不加催化剂时斜率极小。'
    },
    conclude: function (rows, p) {
      var cat = String(pv(p, 'cat', 'mno2'));
      var info = CATS[cat] || CATS.none;
      var n = rows ? rows.length : 0;
      return {
        text: '催化剂能加快 H₂O₂ 的分解速率：加入 ' + info.name +
          ' 后立即产生大量气泡，带火星的木条复燃（生成 O₂），而相同条件下不加催化剂时几乎看不到气泡。' +
          '催化剂降低反应活化能、增大活化分子百分数，但反应前后其质量和化学性质不变，也不改变产物。' +
          '共记录 ' + n + ' 组数据：同一催化剂下产气速率与 H₂O₂ 浓度成正比（v = k·c），' +
          '不同催化剂的 k 不同（MnO₂ > Fe³⁺ > Cu²⁺ > 不加催化剂）。',
        equation: '2H2O2 = 2H2O + O2↑',
        ionic: '',
        errors: [
          'O₂ 收集与计时不同步（开始产生气泡与按下秒表之间有间隔），产气速率偏小',
          'MnO₂ 粉末附着在管壁或部分沉底，与 H₂O₂ 接触不充分，速率偏低',
          'H₂O₂ 会自行分解且浓度随时间降低（尤其放置较久），浓度按标签值计算会有偏差',
          '排水法量气时量筒内液面与外部液面不平，读数偏大或偏小',
          '反应放热使溶液温度升高，温度升高本身也会加快分解，速率被高估'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var cat = String(pv(p, 'cat', 'mno2'));
      var info = CATS[cat] || CATS.none;
      var row = lastRow(state);
      var ph = num(anim.rcat, 0), w = S.w, h = S.h;
      paperTitle(g, '催化剂对 H₂O₂ 分解速率的影响',
        '2H₂O₂ --催化剂--> 2H₂O + O₂↑　·　催化剂降低活化能、加快速率，自身质量与化学性质不变');
      /* 试管 + 气泡 */
      var tw = 40 * sc, th = 156 * sc, tx = w * 0.3 - tw / 2, ty = 104 * sc;
      tube(g, tx, ty, tw, th, 'rgba(188,215,230,.75)', 0.66);
      specks(g, tx + 2, ty + th * 0.55, tw - 4, th * 0.42, cat === 'none' ? 0.08 : 0.85,
        info.color, 4);
      var v = rowVal(row, 'vO2');
      var amp = isfin(v) ? clamp(v / 4, 0.05, 1.4) : 0.3;
      bubbles(g, tx, ty + th * 0.2, tw, th * 0.6, ph, Math.round(2 + 14 * amp), 'rgba(70,110,150,.6)');
      txt(g, cat === 'none' ? '不加催化剂（几乎没有气泡）' : '加入 ' + info.short,
        tx + tw / 2, ty - 10 * sc, 11.5 * sc, 'center', info.color);
      /* 带火星木条 */
      var stx = tx + tw + 16 * sc, sty = ty + 6 * sc;
      ln(g, stx, sty, stx + 46 * sc, sty - 18 * sc, '#8a6a3a', 3);
      if (cat !== 'none') {
        circle(g, stx - 4 * sc, sty + 4 * sc, 5 * sc, 'rgba(226,140,60,.75)', null, 0);
        txt(g, '木条复燃（O₂）', stx + 52 * sc, sty - 20 * sc, 11 * sc, 'left', 'rgba(190,90,30,.95)');
      } else {
        txt(g, '木条不复燃', stx + 52 * sc, sty - 20 * sc, 11 * sc, 'left', 'rgba(38,34,28,.7)');
      }
      /* 集气量筒（收集 20 mL） */
      var mx = w * 0.62, mw = 32 * sc, mh = 120 * sc, my = ty + 20 * sc;
      box(g, mx, my, mw, mh, 'rgba(255,255,255,.6)', INK, 1.4, 3);
      var fill = isfin(rowVal(row, 't20')) ? clamp(20 / 20, 0, 1) : 0;
      box(g, mx + 1, my + mh * (1 - fill) + 1, mw - 2, mh * fill - 1, 'rgba(168,203,228,.7)', null, 0);
      txt(g, '20 mL O₂', mx + mw / 2, my + mh + 15 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.75)');
      txt(g, 't = ' + (isfin(rowVal(row, 't20')) ? fx(rowVal(row, 't20'), 1) : '未收满') + ' s',
        mx + mw / 2, my + mh + 30 * sc, 11 * sc, 'center', RED);
      /* 催化剂活性对比条 */
      var bx = w * 0.74, by = my + 6 * sc, bw = 96 * sc;
      var keys = ['mno2', 'fecl3', 'cuso4', 'none'], i;
      for (i = 0; i < keys.length; i++) {
        var kk = CATS[keys[i]];
        var rel = kk.k / CATS.mno2.k;
        var y0 = by + i * 22 * sc;
        txt(g, kk.name.slice(0, 6), bx - 6 * sc, y0 + 9 * sc, 10 * sc, 'right', 'rgba(38,34,28,.8)');
        box(g, bx, y0, bw * rel, 10 * sc, keys[i] === cat ? RED : 'rgba(120,140,160,.55)', null, 0, 2);
      }
      txt(g, '催化剂活性对比（相对 MnO₂）', bx + bw / 2, by - 8 * sc, 10 * sc, 'center', 'rgba(38,34,28,.7)');
      var lines = [
        ['催化剂：' + info.name, info.color],
        ['用量 = ' + fx(rowVal(row, 'catAmt'), 2) + ' g　T = ' + fx(rowVal(row, 'temp'), 0) + ' ℃', INK],
        ['c(H₂O₂) = ' + fx(rowVal(row, 'cH2O2'), 0) + ' %', INK],
        ['v(O₂) = ' + (isfin(v) ? fx(v, 3) : '—') + ' mL/s', RED],
        ['收集 20 mL 用时 = ' + (isfin(rowVal(row, 't20')) ? fx(rowVal(row, 't20'), 1) : '未收满（null）') + ' s',
          isfin(rowVal(row, 't20')) ? RED : GRAYG],
        ['理论产氧量 = ' + fx(rowVal(row, 'o2Total'), 1) + ' mL', GRAYG]
      ];
      panel(g, w - 226 * sc, 56 * sc, 212 * sc, lines);
      txt(g, '结论：同一催化剂下 v ∝ c(H₂O₂)（过原点直线）；不同催化剂 k 不同 → 直线斜率不同',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.rcat = num(anim.rcat, 0) + (isfin(dt) ? dt : 0) * 1.6;
      if (anim.rcat > 1e6) anim.rcat = 0;
    }
  };

  /* ====================================================================== *
   * 5. 反应 4 · Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃ 的平衡移动                        *
   * ====================================================================== */

  var FE_K25 = 1.0e5;          /* (L/mol)^3，表观稳定常数（模型取值） */
  var FE_DH = -5000;           /* J/mol，络合放热（升温红色略变浅） */
  function feK(T) { return FE_K25 * Math.exp(-FE_DH / RGAS * (1 / T - 1 / 298.15)); }

  var eqFescn = {
    id: 'equilibrium-fescn',
    name: 'Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃ 的化学平衡移动',
    group: '反应速率与化学平衡',
    aim: '通过加 FeCl₃、加 KSCN、加 NaOH、稀释、升温等操作，观察血红色深浅变化，判断平衡移动方向',
    principle: 'FeCl3 + 3KSCN ⇌ Fe(SCN)3 + 3KCl，反应的实质是 Fe3+ + 3SCN- ⇌ Fe(SCN)3（血红色）。' +
      '其它条件不变时：增大反应物浓度（加 FeCl₃ 或 KSCN 溶液）→ 平衡正向移动、红色变深；' +
      '减小反应物浓度（加 NaOH 使 Fe³⁺ 生成红褐色 Fe(OH)₃ 沉淀：Fe3+ + 3OH- = Fe(OH)3↓）→ 平衡逆向移动、红色变浅；' +
      '加水稀释时离子浓度都减小、平衡向微粒数多的一方（逆反应方向）移动，红色变浅得比单纯稀释更明显。' +
      '该络合反应放热，升高温度平衡逆向移动、红色略变浅。溶液中没有气体参加反应，' +
      '改变压强对平衡几乎没有影响（所以此体系不适合研究压强的影响）。',
    apparatus: ['试管（若干支）', '胶头滴管', '量筒', '烧杯（水浴）', '温度计', '注射器（加压用）',
      '0.005 mol/L FeCl₃ 溶液', '0.015 mol/L KSCN 溶液', '0.2 mol/L FeCl₃ 溶液', '0.2 mol/L KSCN 溶液',
      '0.1 mol/L NaOH 溶液', '蒸馏水'],
    steps: ['取 5 mL 0.005 mol/L FeCl₃ 溶液与 5 mL 0.015 mol/L KSCN 溶液混合，得到血红色溶液并分成若干份',
      '向第一份中滴加 FeCl₃ 溶液，观察红色深浅变化',
      '向第二份中滴加 KSCN 溶液；向第三份中滴加 NaOH 溶液；向第四份中加蒸馏水稀释',
      '把一份放入热水浴中（对照放冷水浴），比较红色深浅',
      '用注射器压缩一份溶液的液面上方空间，观察颜色是否变化'],
    params: [
      { key: 'op', label: '操作', type: 'select',
        options: [
          { value: 'fecl3', label: '加 0.05 mol/L FeCl₃ 溶液（每滴 0.05 mL）' },
          { value: 'kscn', label: '加 0.05 mol/L KSCN 溶液（每滴 0.05 mL）' },
          { value: 'naoh', label: '加 0.05 mol/L NaOH 溶液（每滴 0.05 mL）' },
          { value: 'water', label: '加蒸馏水稀释（每滴 0.5 mL）' },
          { value: 'heat', label: '水浴升温（用温度参数控制）' },
          { value: 'pressure', label: '加压（注射器压缩，体积不变）' }
        ], value: 'fecl3' },
      { key: 'drops', label: '加入滴数', unit: '滴', min: 0, max: 8, step: 1, value: 4 },
      { key: 'temp', label: '温度', unit: '℃', min: 10, max: 60, step: 1, value: 25 },
      { key: 'cFe', label: 'FeCl₃ 初始浓度', unit: 'mol/L', min: 0.001, max: 0.02, step: 0.001, value: 0.005 },
      { key: 'cKSCN', label: 'KSCN 初始浓度', unit: 'mol/L', min: 0.005, max: 0.030, step: 0.001, value: 0.015 }
    ],
    react: function (p, ctx) {
      var op = String(pv(p, 'op', 'fecl3'));
      var drops = pnum(p, 'drops', 4);
      var temp = pnum(p, 'temp', 25);
      var cFe0 = pnum(p, 'cFe', 0.005);
      var cKSCN0 = pnum(p, 'cKSCN', 0.015);
      var T = 273.15 + temp;
      var added = (op === 'fecl3' || op === 'kscn' || op === 'naoh' || op === 'water');
      var dropML = (op === 'water') ? 0.5 : 0.05;      /* 每滴体积（mL） */
      var cAdd = 0.05;                                 /* 加入溶液的浓度（mol/L） */
      var Vadd = added ? drops * dropML : 0;           /* 实际加入体积（mL） */
      var VL = (10 + Vadd) / 1000;                     /* L（各取 5 mL 混合，共 10 mL） */
      var nFe = cFe0 / 2 * 0.010;                      /* mol */
      var nSCN = cKSCN0 / 2 * 0.010;
      if (op === 'fecl3') nFe += cAdd * Vadd / 1000;
      if (op === 'kscn') nSCN += cAdd * Vadd / 1000;
      var nOH = 0;
      if (op === 'naoh') {
        nOH = cAdd * Vadd / 1000;
        nFe = Math.max(0, nFe - nOH / 3);              /* Fe3+ + 3OH- = Fe(OH)3↓ */
      }
      var compress = (op === 'pressure');
      if (compress) VL = VL * 0.80;                  /* 压缩 20% */
      var Fe = nFe / VL, SCN = nSCN / VL;
      var K = feK(T);
      var x = solveFeSCN(Fe, SCN, K);
      /* 参考态：同浓度同温度、不加任何试剂、不压缩 */
      var xRef = solveFeSCN(cFe0 / 2, cKSCN0 / 2, K);
      var abs = clamp(x / 1.0e-4 * 0.62, 0, 2.0);
      var absRef = clamp(xRef / 1.0e-4 * 0.62, 0, 2.0);
      var shift = (x > xRef * 1.03) ? 1 : ((x < xRef * 0.97) ? -1 : 0);

      var ph = [];
      ph.push('原混合液呈血红色（Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃），本操作后颜色深浅：' +
        (shift > 0 ? '变深' : (shift < 0 ? '变浅' : '基本不变')));
      if (op === 'fecl3') {
        ph.push('滴加 FeCl₃ 溶液后红色明显变深：增大反应物 c(Fe³⁺)，平衡正向移动');
        ph.push('平衡正向移动使 c[Fe(SCN)₃] 增大（' + fx(x * 1e4, 2) + '×10⁻⁴ mol/L）');
      } else if (op === 'kscn') {
        ph.push('滴加 KSCN 溶液后红色明显变深：增大反应物 c(SCN⁻)，平衡正向移动');
        ph.push('K⁺、Cl⁻ 不参加反应，对平衡没有影响（只有 c(Fe³⁺)、c(SCN⁻) 改变才移动）');
      } else if (op === 'naoh') {
        ph.push('滴加 NaOH 溶液后出现红褐色沉淀 Fe(OH)₃，溶液红色变浅');
        ph.push('Fe³⁺ + 3OH⁻ = Fe(OH)₃↓ 使 c(Fe³⁺) 减小，平衡逆向移动，Fe(SCN)₃ 减少');
      } else if (op === 'water') {
        ph.push('加蒸馏水稀释后红色变浅，且比"只按体积稀释"更浅');
        ph.push('稀释使各离子浓度都减小，平衡向离子总数多的一方（逆反应方向）移动');
      } else if (op === 'heat') {
        ph.push('放入热水浴后红色略变浅：络合反应放热，升温平衡逆向移动');
        ph.push('（同时 Fe³⁺ 水解程度增大也会使红色略变浅，两组因素方向一致）');
      } else {
        ph.push('用注射器压缩溶液上方空间，红色基本不变（略有变深，属于浓度效应）');
        ph.push('溶液中没有气体参加反应，改变压强对平衡几乎没有影响——该体系不适合研究压强');
      }
      if (op !== 'heat') ph.push('温度保持 ' + fx(temp, 0) + ' ℃ 不变（温度不变则平衡常数不变）');

      return {
        phenomena: ph,
        equation: 'FeCl3 + 3KSCN ⇌ Fe(SCN)3 + 3KCl',
        ionic: 'Fe3+ + 3SCN- ⇌ Fe(SCN)3（溶液呈血红色；加 NaOH 时 Fe3+ 被 OH- 沉淀为红褐色氢氧化铁，铁离子浓度减小、平衡逆向移动）',
        ionicNet: 'Fe3+ + 3SCN- ⇌ Fe(SCN)3',
        type: '可逆反应·化学平衡移动（浓度、温度对平衡的影响）',
        conditions: '常温，0.005 mol/L FeCl₃ 与 0.015 mol/L KSCN 等体积混合，' +
          (op === 'heat' ? '水浴升温' : '恒温') + '观察血红色深浅',
        note: '本实验用"相对吸光度 A"（颜色深浅）作为量化列：A 越大说明 c[Fe(SCN)₃] 越大；' +
          '加入液统一配成 0.05 mol/L（FeCl₃ / KSCN / NaOH），每滴 0.05 mL、最多 8 滴，' +
          '这样"颜色深浅随加入滴数近似线性变化"，便于定量作图（演示实验常用**饱和** FeCl₃ 使颜色变化更剧烈）；' +
          '稀释水每滴按 0.5 mL 计。该平衡适合研究浓度与温度，不适合研究压强',
        measures: {
          drops: drops, dropML: dropML, Vadd: Vadd, temp: temp, abs: abs, absRef: absRef,
          cCom: x * 1e4, cFeFree: Math.max(Fe - x, 0) * 1000,
          cSCN: Math.max(SCN - 3 * x, 0) * 1000, shift: shift, kc: K / 1e5
        }
      };
    },
    columns: [
      { key: 'drops', label: '加入滴数', unit: '滴' },
      { key: 'Vadd', label: '加入体积', unit: 'mL' },
      { key: 'abs', label: '颜色深浅（相对吸光度 A）', unit: '' },
      { key: 'cCom', label: 'c[Fe(SCN)₃]', unit: '10⁻⁴ mol/L' },
      { key: 'cFeFree', label: 'c(Fe³⁺)（游离）', unit: 'mmol/L' },
      { key: 'cSCN', label: 'c(SCN⁻)', unit: 'mmol/L' },
      { key: 'shift', label: '平衡移动方向（+1 正 / −1 逆 / 0 不变）', unit: '' },
      { key: 'temp', label: '温度', unit: '℃' }
    ],
    graph: {
      x: 'drops', y: 'abs', fit: 'linear',
      title: '血红色深浅（相对吸光度 A）–加入滴数 图线',
      note: '扫"加入滴数"这个自变量，在**加 FeCl₃（或 KSCN）溶液**的操作下：' +
        '滴数越多，平衡正向移动越多、A 越大，图线近似为上升的直线（A ∝ c[Fe(SCN)₃]）；' +
        '加 NaOH 时 Fe³⁺ 被沉淀消耗，A 随滴数近似线性下降；' +
        '加蒸馏水稀释时 A 迅速下降（且比单纯按体积稀释更浅）。'
    },
    conclude: function (rows, p) {
      var op = String(pv(p, 'op', 'fecl3'));
      var n = rows ? rows.length : 0;
      var opTxt = {
        fecl3: '增大 c(Fe³⁺) 使平衡正向移动、红色变深',
        kscn: '增大 c(SCN⁻) 使平衡正向移动、红色变深',
        naoh: 'NaOH 与 Fe³⁺ 生成 Fe(OH)₃ 沉淀，c(Fe³⁺) 减小，平衡逆向移动、红色变浅',
        water: '加水稀释使平衡向离子数多的一方（逆向）移动，红色变浅',
        heat: '升温使平衡向吸热方向（逆向）移动，红色略变浅，说明络合反应放热',
        pressure: '溶液中无气体参加，改变压强对平衡几乎没有影响'
      }[op] || '改变条件使平衡发生移动';
      return {
        text: 'Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃ 是血红色配合物的生成平衡：' + opTxt + '。' +
          '增大反应物浓度或减小生成物浓度，平衡向正反应方向移动；减小反应物浓度，平衡向逆反应方向移动；' +
          '升温平衡向吸热方向移动。共记录 ' + n + ' 组数据，用相对吸光度 A（颜色深浅）与 ' +
          'c[Fe(SCN)₃] 量化平衡移动的程度。',
        equation: 'FeCl3 + 3KSCN ⇌ Fe(SCN)3 + 3KCl',
        ionic: 'Fe3+ + 3SCN- ⇌ Fe(SCN)3（加 FeCl3 或 KSCN 时平衡正向移动、红色变深；加 NaOH 时铁离子被沉淀、平衡逆向移动、红色变浅）',
        errors: [
          '红色深浅靠眼睛比较，主观性强；应使用比色皿/分光光度计测吸光度',
          '滴加 FeCl₃、KSCN 溶液会带入水使体积增大（稀释效应与浓度效应方向相反），必须同时做加等量水的对照',
          'NaOH 溶液加入后生成的 Fe(OH)₃ 胶体使溶液变浑浊，颜色判断受干扰',
          '温度改变时 Fe³⁺ 水解程度也随之改变（水解吸热），对红色深浅有附加影响',
          'FeCl₃ 与 KSCN 的初始浓度配比不同会使平衡点不同，各组数据不能直接横向比较'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var op = String(pv(p, 'op', 'fecl3'));
      var row = lastRow(state);
      var ph = num(anim.eqf, 0);
      var w = S.w, h = S.h;
      paperTitle(g, 'Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃ 的平衡移动',
        '操作：' + ({
          fecl3: '加 FeCl₃ 溶液', kscn: '加 KSCN 溶液', naoh: '加 NaOH 溶液',
          water: '加蒸馏水稀释', heat: '水浴升温', pressure: '注射器加压'
        }[op] || op) + '　·　血红色越深 → c[Fe(SCN)₃] 越大');
      var a = rowVal(row, 'abs');
      if (!isfin(a)) a = 0.62;
      /* 对照管 + 实验管 */
      var tw = 42 * sc, th = 158 * sc, ty = 100 * sc;
      var x1 = w * 0.3, x2 = w * 0.56;
      tube(g, x1 - tw / 2, ty, tw, th, 'rgba(240,238,230,.7)', 0.62);
      tint(g, x1 - tw / 2 + 2, ty + th * 0.38, tw - 4, th * 0.6, clamp(a / 1.6, 0.02, 1), '163,35,43', 0.8);
      tube(g, x2 - tw / 2, ty, tw, th, 'rgba(240,238,230,.7)', 0.62);
      var ar = rowVal(row, 'absRef');
      if (!isfin(ar)) ar = 0.62;
      tint(g, x2 - tw / 2 + 2, ty + th * 0.38, tw - 4, th * 0.6, clamp(ar / 1.6, 0.02, 1), '163,35,43', 0.8);
      txt(g, '实验组（' + ({ fecl3: '加 FeCl₃', kscn: '加 KSCN', naoh: '加 NaOH', water: '加水稀释', heat: '升温', pressure: '加压' }[op] || op) + '）',
        x1, ty + th + 18 * sc, 11 * sc, 'center', INK);
      txt(g, '对照组（不加试剂、25 ℃）', x2, ty + th + 18 * sc, 11 * sc, 'center', 'rgba(38,34,28,.7)');
      txt(g, 'A = ' + fx(a, 2), x1, ty - 8 * sc, 12 * sc, 'center', BLOOD);
      txt(g, 'A = ' + fx(ar, 2), x2, ty - 8 * sc, 12 * sc, 'center', BLOOD);
      /* 移动方向箭头 */
      var sh = rowVal(row, 'shift');
      if (sh > 0.5) {
        arrow(g, x2 + tw / 2 + 6 * sc, ty + th * 0.5, x1 - tw / 2 - 6 * sc, ty + th * 0.5, RED, 1.6);
        txt(g, '平衡正向移动（红色变深）', (x1 + x2) / 2, ty + th * 0.5 - 8 * sc, 11 * sc, 'center', RED);
      } else if (sh < -0.5) {
        arrow(g, x1 + tw / 2 + 6 * sc, ty + th * 0.5, x2 - tw / 2 - 6 * sc, ty + th * 0.5, BLUE, 1.6);
        txt(g, '平衡逆向移动（红色变浅）', (x1 + x2) / 2, ty + th * 0.5 - 8 * sc, 11 * sc, 'center', BLUE);
      } else {
        txt(g, '平衡基本不移动（颜色几乎不变）', (x1 + x2) / 2, ty + th * 0.5, 11 * sc, 'center', GRAYG);
      }
      if (op === 'naoh') {
        specks(g, x1 - tw / 2 + 2, ty + th * 0.42, tw - 4, th * 0.56, 0.5, 'rgba(138,75,35,.85)', 6);
        txt(g, '红褐色 Fe(OH)₃ 沉淀', x1, ty - 24 * sc, 10.5 * sc, 'center', 'rgba(138,75,35,.95)');
      }
      if (op === 'heat') {
        bath(g, x1 - tw / 2 - 14 * sc, ty + th * 0.45, tw + 28 * sc, 50 * sc, 'rgba(226,178,150,.55)', '热水浴');
      }
      if (op === 'pressure') {
        box(g, x1 - tw / 2 - 6 * sc, ty - 16 * sc, tw + 12 * sc, 14 * sc, 'rgba(120,140,160,.5)', INK, 1.2, 3);
        arrow(g, x1, ty - 34 * sc, x1, ty - 20 * sc, INK, 1.5);
        txt(g, '注射器加压', x1, ty - 40 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.8)');
      }
      /* 溶液中配合物微粒（随动画相位轻微移动 → 画布像素会变） */
      for (i = 0; i < 7; i++) {
        circle(g, x1 - tw / 2 + 8 * sc + (tw - 16 * sc) * (0.5 + 0.45 * Math.sin(ph * 0.9 + i * 1.7)),
          ty + th * 0.5 + 14 * sc + 12 * sc * Math.cos(ph * 1.1 + i * 2.3),
          1.8 + 0.8 * (i % 3), 'rgba(163,35,43,.45)', null, 0);
      }
      /* 浓度柱：Fe³⁺ / SCN⁻ / 配合物 */
      var bx = w * 0.74, by = 130 * sc, bw = 92 * sc, i;
      var bars = [
        ['c[Fe(SCN)₃]', rowVal(row, 'cCom') / 2.5, BLOOD],
        ['c(Fe³⁺)游离', rowVal(row, 'cFeFree') / 25, 'rgba(180,140,60,.8)'],
        ['c(SCN⁻)', rowVal(row, 'cSCN') / 75, 'rgba(90,140,120,.8)']
      ];
      txt(g, '浓度对比（柱长∝相对量）', bx + bw / 2, by - 10 * sc, 10 * sc, 'center', 'rgba(38,34,28,.7)');
      for (i = 0; i < bars.length; i++) {
        var y0 = by + i * 26 * sc;
        txt(g, bars[i][0], bx - 6 * sc, y0 + 10 * sc, 10 * sc, 'right', 'rgba(38,34,28,.8)');
        box(g, bx, y0, bw, 12 * sc, 'rgba(38,34,28,.12)', null, 0, 2);
        box(g, bx, y0, bw * clamp(num(bars[i][1], 0), 0, 1), 12 * sc, bars[i][2], null, 0, 2);
      }
      var lines = [
        ['设定：' + ({ fecl3: '加 0.05 mol/L FeCl₃', kscn: '加 0.05 mol/L KSCN', naoh: '加 0.05 mol/L NaOH', water: '加蒸馏水（每滴 0.5 mL）', heat: '水浴升温', pressure: '注射器加压' }[op] || op) +
          '　' + fx(pnum(p, 'drops', 4), 0) + ' 滴', INK],
        ['操作：' + ({ fecl3: '加 FeCl₃ 溶液', kscn: '加 KSCN 溶液', naoh: '加 NaOH 溶液', water: '加水稀释', heat: '升温', pressure: '加压' }[op] || op), INK],
        ['加入 ' + fx(rowVal(row, 'drops'), 0) + ' 滴（' + fx(rowVal(row, 'Vadd'), 2) +
          ' mL）　T = ' + fx(rowVal(row, 'temp'), 0) + ' ℃', INK],
        ['相对吸光度 A = ' + fx(a, 2) + '（对照 ' + fx(ar, 2) + '）', BLOOD],
        ['c[Fe(SCN)₃] = ' + (isfin(rowVal(row, 'cCom')) ? fx(rowVal(row, 'cCom'), 2) : '—') + ' ×10⁻⁴ mol/L', BLOOD],
        ['平衡移动：' + (sh > 0.5 ? '正向 (+1)' : (sh < -0.5 ? '逆向 (−1)' : '几乎不变 (0)')), INK],
        ['已记录 ' + ((state && state.rows) ? state.rows.length : 0) + ' 组（可扫加入量作图）', GRAYG]
      ];
      panel(g, w - 226 * sc, 56 * sc, 212 * sc, lines);
      txt(g, '结论：增大反应物浓度（或减小生成物浓度）→ 平衡正向移动；减小反应物浓度 → 平衡逆向移动；升温向吸热方向移动',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      /* 不需要动画：颜色由参数决定；保留 step 以便核心的 run() 走通 */
      anim.eqf = num(anim.eqf, 0) + (isfin(dt) ? dt : 0) * 0.2;
      if (anim.eqf > 1e6) anim.eqf = 0;
    }
  };

  /* ====================================================================== *
   * 6. 反应 5 · 2NO₂ ⇌ N₂O₄ 的平衡移动（加压/降温的颜色变化）              *
   * ====================================================================== */

  var eqNo2 = {
    id: 'equilibrium-no2',
    name: '2NO₂ ⇌ N₂O₄ 的化学平衡移动（压强与温度）',
    group: '反应速率与化学平衡',
    aim: '用注射器（针管）压缩或扩大气体体积、用冷热水浴改变温度，观察红棕色深浅变化并判断平衡移动',
    principle: '2NO2(g) ⇌ N2O4(g)，正反应是气体体积减小的放热反应（ΔH<0）。' +
      '**压强**：压缩体积（加压）时，气体浓度瞬间增大、颜色先变深，随后平衡向气体体积减小的方向（正反应）移动，' +
      'NO₂ 减少、颜色又变浅一些，最终比压缩前深、比刚压缩时浅；扩大体积（减压）时相反。' +
      '**温度**：升温平衡向吸热方向（逆反应方向）移动，NO₂ 增多、红棕色变深；降温平衡向放热方向（正反应方向）移动，颜色变浅。' +
      '混合气体的平均相对分子质量 M = m/n 随 N₂O₄ 增多而增大，所以加压、降温后 M 增大。',
    apparatus: ['注射器（针管，带活塞，密封）', 'NO₂ 与 N₂O₄ 的混合气体', '烧杯（热水、冷水）',
      '温度计', '夹子/橡皮管', '比色卡片（对照颜色）'],
    steps: ['把 NO₂ 与 N₂O₄ 的混合气体充入注射器，记录起始体积与颜色',
      '迅速推动活塞压缩气体体积，观察颜色"先变深后变浅"的变化并记录最终体积',
      '拉动活塞扩大体积，观察颜色"先变浅后略变深"的变化',
      '把注射器分别放入热水浴和冷水浴中，比较红棕色深浅',
      '比较同一活塞位置下不同温度的颜色，得出温度对平衡的影响'],
    params: [
      { key: 'op', label: '操作', type: 'select',
        options: [
          { value: 'compress', label: '压缩体积（加压）' },
          { value: 'expand', label: '扩大体积（减压）' },
          { value: 'cool', label: '降温（冷水浴）' },
          { value: 'heat', label: '升温（热水浴）' },
          { value: 'none', label: '恒温恒容（对照）' }
        ], value: 'compress' },
      { key: 'V', label: '活塞位置（气体体积）', unit: 'mL', min: 20, max: 100, step: 5, value: 60 },
      { key: 'temp', label: '温度', unit: '℃', min: 0, max: 60, step: 1, value: 25 },
      { key: 'n0', label: '起始 NO₂ 物质的量', unit: 'mmol', min: 1, max: 10, step: 0.5, value: 4 }
    ],
    react: function (p, ctx) {
      var op = String(pv(p, 'op', 'compress'));
      var V0 = pnum(p, 'V', 60);
      var temp = pnum(p, 'temp', 25);
      var n0 = pnum(p, 'n0', 4);
      var Ve = V0, Te = temp;
      if (op === 'compress') Ve = V0 / 2.5;
      else if (op === 'expand') Ve = V0 * 1.8;
      else if (op === 'cool') Te = temp - 20;
      else if (op === 'heat') Te = temp + 25;
      Ve = clamp(Ve, 15, 120);
      Te = clamp(Te, 0, 80);
      var TK = 273.15 + Te;
      var st = no2State(Ve, TK, n0);
      var st0 = no2State(60, 298.15, n0);            /* 相对颜色的参考态 */
      var abs = clamp(st.cNO2 / Math.max(st0.cNO2, 1e-9), 0, 3);
      var absBefore = clamp(no2State(Ve, 298.15, n0).cNO2 / Math.max(st0.cNO2, 1e-9), 0, 3);

      var ph = [];
      if (op === 'compress') {
        ph.push('推动活塞压缩体积，红棕色先明显变深（体积减小，c(NO₂) 瞬间增大）');
        ph.push('随后颜色又变浅一些：平衡 2NO₂ ⇌ N₂O₄ 正向移动，NO₂ 转化成 N₂O₄');
        ph.push('最终颜色比压缩前深、比刚压缩时浅；混合气体的平均相对分子质量 M 增大');
      } else if (op === 'expand') {
        ph.push('拉动活塞扩大体积，红棕色先变浅（c(NO₂) 瞬间减小）');
        ph.push('随后颜色略变深：平衡逆向移动，N₂O₄ 又分解出 NO₂');
        ph.push('最终颜色比拉开前浅；M 减小');
      } else if (op === 'cool') {
        ph.push('放入冷水浴后红棕色变浅：降温平衡向放热方向（正反应）移动，NO₂ 减少');
        ph.push('N₂O₄ 的含量增大，混合气体的平均相对分子质量 M 增大');
      } else if (op === 'heat') {
        ph.push('放入热水浴后红棕色变深：升温平衡向吸热方向（逆反应）移动，NO₂ 增多');
        ph.push('N₂O₄ 的含量减小，M 减小');
      } else {
        ph.push('恒温恒容下红棕色不变（对照实验）：Q = K，平衡不移动');
      }
      ph.push('本温度下 c(NO₂) = ' + fx(st.cNO2, 2) + ' mmol/L、c(N₂O₄) = ' + fx(st.cN2O4, 2) + ' mmol/L');
      if (op === 'compress' || op === 'expand') ph.push('活塞位置与颜色要同时观察：体积变化同时带来"浓度效应"和"平衡移动"两种效果');
      if (Te >= 60) ph.push('温度较高（' + fx(Te, 0) + ' ℃），红棕色明显加深');
      if (Te <= 5) ph.push('温度较低（' + fx(Te, 0) + ' ℃），红棕色明显变浅');

      return {
        phenomena: ph,
        equation: '2NO2 ⇌ N2O4',
        ionic: '',            /* 气体之间的可逆反应，不写离子方程式 */
        ionicNet: '',
        type: '可逆反应·化学平衡移动（压强、温度对气体平衡的影响）',
        conditions: '注射器内密封的 NO₂/N₂O₄ 混合气体，' +
          (op === 'heat' ? '热水浴' : (op === 'cool' ? '冷水浴' : '恒温')) + '，观察红棕色深浅',
        note: '相对颜色 A = c(NO₂)/c(NO₂)参考（参考态：25 ℃、60 mL、' + fx(n0, 1) + ' mmol），A 越大红棕色越深',
        measures: {
          V: Ve, temp: Te, Vset: V0, pTotal: st.p, cNO2: st.cNO2, cN2O4: st.cN2O4,
          alpha: st.alpha, abs: abs, absBefore: absBefore, invV: 1000 / Ve, kc: st.Kc
        }
      };
    },
    columns: [
      { key: 'V', label: '气体体积', unit: 'mL' },
      { key: 'invV', label: '1/V', unit: 'L⁻¹' },
      { key: 'temp', label: '温度', unit: '℃' },
      { key: 'pTotal', label: '总压强', unit: 'kPa' },
      { key: 'cNO2', label: 'c(NO₂)', unit: 'mmol/L' },
      { key: 'cN2O4', label: 'c(N₂O₄)', unit: 'mmol/L' },
      { key: 'alpha', label: 'NO₂ 转化为 N₂O₄ 的转化率', unit: '%' },
      { key: 'abs', label: '红棕色深浅（相对颜色 A）', unit: '' }
    ],
    graph: {
      x: 'invV', y: 'cNO2', fit: 'linear',
      title: 'c(NO₂)–1/V 图线（压缩体积时颜色变深的定量关系）',
      note: '扫"活塞位置（气体体积 V）"这个自变量：1/V 越大（气体被压得越紧），c(NO₂) 越大、' +
        '红棕色越深；由于同时发生平衡移动，图线近似为直线但斜率小于"只按体积压缩"的斜率。' +
        '温度的影响则用 c(NO₂) 随温度升高而增大来表示。'
    },
    conclude: function (rows, p) {
      var op = String(pv(p, 'op', 'compress'));
      var n = rows ? rows.length : 0;
      var opTxt = {
        compress: '压缩体积（加压）时平衡向气体体积减小的正反应方向移动，NO₂ 减少、颜色先深后浅',
        expand: '扩大体积（减压）时平衡向气体体积增大的逆反应方向移动，NO₂ 增多、颜色先浅后深',
        cool: '降温时平衡向放热方向（正反应）移动，红棕色变浅',
        heat: '升温时平衡向吸热方向（逆反应）移动，红棕色变深',
        none: '恒温恒容时平衡不移动，颜色不变'
      }[op] || '条件改变引起平衡移动';
      return {
        text: '2NO₂(g) ⇌ N₂O₄(g) 的正反应是气体体积减小的放热反应：' + opTxt + '。' +
          '压强改变时既有浓度效应又有平衡移动，所以颜色是"先变深后变浅"（或先浅后深）；' +
          '温度改变只影响平衡（K 变化），升温向吸热方向移动、降温向放热方向移动。' +
          '共记录 ' + n + ' 组数据，用 c(NO₂)（或相对颜色 A）量化 NO₂ 的多少。',
        equation: '2NO2 ⇌ N2O4',
        ionic: '',
        errors: [
          '推动活塞时手握住针筒会使气体温度升高，颜色变化混入温度因素',
          '颜色深浅靠眼睛比较，应固定光源与背景，或使用比色卡/色度计',
          '活塞与筒壁摩擦、密封不严会漏气，使实际物质的量改变、数据失真',
          '压缩后需要等几秒让平衡建立，读数过早会把"瞬时浓度效应"当成平衡结果',
          '水浴控温时注射器内气体温度与水温达到一致需要时间，未恒温就读数会偏差'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var op = String(pv(p, 'op', 'compress'));
      var row = lastRow(state);
      var ph = num(anim.eqn, 0);
      var w = S.w, h = S.h;
      paperTitle(g, '2NO₂ ⇌ N₂O₄ 的平衡移动（' +
        ({ compress: '压缩体积', expand: '扩大体积', cool: '降温', heat: '升温', none: '恒温恒容对照' }[op] || op) + '）',
        '正反应：气体体积减小、放热　·　加压/降温 → NO₂ 减少（颜色变浅）');
      var a = rowVal(row, 'abs');
      if (!isfin(a)) a = 1;
      /* 活塞位置由**当前参数**（活塞体积设定）与操作共同决定，改参数就能看到活塞移动 */
      var Vset = pnum(p, 'V', 60);
      var Ve = Vset;
      if (op === 'compress') Ve = Vset / 2.5;
      else if (op === 'expand') Ve = Vset * 1.8;
      Ve = clamp(Ve, 15, 120);
      if (!isfin(rowVal(row, 'V'))) { /* 没有数据行时也画得出来 */ }
      /* 注射器：筒身长度按体积 20~100 mL 映射 */
      var bodyW = 250 * sc, bodyH = 74 * sc, bx = w * 0.16, by = 128 * sc;
      box(g, bx, by, bodyW, bodyH, 'rgba(255,255,255,.45)', INK, 1.6, 6);
      var fillW = bodyW * clamp(Ve / 100, 0.12, 1);
      tint(g, bx + 2, by + 2, fillW - 4, bodyH - 4, clamp(a / 2, 0.05, 1), '180,100,42', 0.9);
      /* 活塞 */
      box(g, bx + fillW, by - 5 * sc, 12 * sc, bodyH + 10 * sc, 'rgba(120,130,140,.85)', INK, 1.3, 3);
      ln(g, bx + fillW + 6 * sc, by + bodyH / 2, bx + fillW + 62 * sc, by + bodyH / 2, INK, 3);
      /* 针头 */
      poly(g, [[bx - 2, by + bodyH * 0.38], [bx - 26 * sc, by + bodyH * 0.46],
        [bx - 26 * sc, by + bodyH * 0.54], [bx - 2, by + bodyH * 0.62]], 'rgba(150,160,170,.8)', INK, 1);
      txt(g, 'V = ' + fx(Ve, 0) + ' mL', bx + fillW / 2, by - 12 * sc, 12 * sc, 'center', INK);
      txt(g, '注射器（针管）内密封的 NO₂ / N₂O₄ 混合气体', bx + bodyW / 2, by + bodyH + 20 * sc,
        11 * sc, 'center', 'rgba(38,34,28,.78)');
      /* 气体分子（随动画相位轻微运动 → 画布像素会变） */
      for (i = 0; i < 12; i++) {
        circle(g, bx + 8 * sc + (fillW - 16 * sc) * (0.5 + 0.46 * Math.sin(ph * 0.8 + i * 1.3)),
          by + 10 * sc + (bodyH - 20 * sc) * (0.5 + 0.44 * Math.cos(ph * 1.05 + i * 2.1)),
          1.6 + 0.7 * (i % 3), 'rgba(60,40,30,.35)', null, 0);
      }
      if (op === 'compress') {
        arrow(g, bx + bodyW + 70 * sc, by + bodyH / 2, bx + bodyW + 18 * sc, by + bodyH / 2, RED, 1.8);
        txt(g, '推活塞（加压）', bx + bodyW + 44 * sc, by + bodyH / 2 - 10 * sc, 10.5 * sc, 'center', RED);
      } else if (op === 'expand') {
        arrow(g, bx + bodyW + 18 * sc, by + bodyH / 2, bx + bodyW + 70 * sc, by + bodyH / 2, BLUE, 1.8);
        txt(g, '拉活塞（减压）', bx + bodyW + 44 * sc, by + bodyH / 2 - 10 * sc, 10.5 * sc, 'center', BLUE);
      } else if (op === 'cool' || op === 'heat') {
        bath(g, bx + 20 * sc, by + bodyH + 34 * sc, bodyW - 40 * sc, 44 * sc,
          op === 'heat' ? 'rgba(226,178,150,.6)' : 'rgba(168,203,228,.6)',
          op === 'heat' ? '热水浴（升温）' : '冷水浴（降温）');
        txt(g, '温度：' + fx(rowVal(row, 'temp'), 0) + ' ℃', bx + bodyW / 2, by + bodyH + 96 * sc,
          11.5 * sc, 'center', op === 'heat' ? RED : BLUE);
      }
      /* 颜色对照卡 + 定量柱 */
      var cx0 = w * 0.62, cy0 = 120 * sc;
      txt(g, '颜色对照（A 越大越深）', cx0 + 70 * sc, cy0 - 10 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.7)');
      var i;
      for (i = 0; i < 5; i++) {
        var amt = (i + 1) / 5;
        box(g, cx0 + i * 29 * sc, cy0, 26 * sc, 30 * sc, 'rgba(255,255,255,.5)', 'rgba(38,34,28,.3)', 1, 2);
        tint(g, cx0 + i * 29 * sc + 1, cy0 + 1, 24 * sc, 28 * sc, amt, '180,100,42', 0.9);
      }
      box(g, cx0 + clamp(a / 3, 0, 1) * 145 * sc - 2, cy0 - 6 * sc, 4 * sc, 42 * sc, RED, null, 0);
      /* NO₂ / N₂O₄ 比例条 */
      var py = cy0 + 66 * sc, pw = 150 * sc;
      var al = rowVal(row, 'alpha');
      if (!isfin(al)) al = 30;
      box(g, cx0, py, pw, 14 * sc, 'rgba(180,100,42,.75)', null, 0, 2);
      box(g, cx0, py, pw * clamp(al / 100, 0, 1), 14 * sc, 'rgba(90,110,130,.75)', null, 0, 2);
      txt(g, 'NO₂ ' + fx(100 - al, 1) + '%　·　N₂O₄ ' + fx(al, 1) + '%（摩尔分数）',
        cx0 + pw / 2, py + 28 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.8)');
      var lines = [
        ['设定：' + ({ compress: '压缩体积（V 的 2/5）', expand: '扩大体积（V 的 1.8 倍）', cool: '降温 20 ℃', heat: '升温 25 ℃', none: '恒温恒容' }[op] || op), INK],
        ['操作：' + ({ compress: '压缩体积', expand: '扩大体积', cool: '降温', heat: '升温', none: '对照' }[op] || op), INK],
        ['V = ' + fx(Ve, 0) + ' mL　T = ' + fx(rowVal(row, 'temp'), 0) + ' ℃', INK],
        ['p(总) = ' + (isfin(rowVal(row, 'pTotal')) ? fx(rowVal(row, 'pTotal'), 1) : '—') + ' kPa', INK],
        ['c(NO₂) = ' + (isfin(rowVal(row, 'cNO2')) ? fx(rowVal(row, 'cNO2'), 2) : '—') + ' mmol/L', 'rgba(180,100,42,.95)'],
        ['c(N₂O₄) = ' + (isfin(rowVal(row, 'cN2O4')) ? fx(rowVal(row, 'cN2O4'), 2) : '—') + ' mmol/L', 'rgba(90,110,130,.95)'],
        ['相对颜色 A = ' + fx(a, 2), 'rgba(180,100,42,.95)'],
        ['已记录 ' + ((state && state.rows) ? state.rows.length : 0) + ' 组（可扫活塞位置作图）', GRAYG]
      ];
      panel(g, w - 226 * sc, 56 * sc, 212 * sc, lines);
      txt(g, '结论：加压/降温 → 平衡向气体体积减小、放热的方向（正反应）移动 → NO₂ 减少、颜色变浅（压缩瞬间先变深）',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.eqn = num(anim.eqn, 0) + (isfin(dt) ? dt : 0) * 0.25;
      if (anim.eqn > 1e6) anim.eqn = 0;
    }
  };

  /* ====================================================================== *
   * 7. 反应 6 · 弱电解质（醋酸）的电离平衡                                  *
   * ====================================================================== */

  var weakElec = {
    id: 'weak-electrolyte',
    name: '弱电解质的电离平衡（醋酸）',
    group: '反应速率与化学平衡',
    aim: '通过稀释、加入同离子、加碱/加酸、升温等操作，观察 pH 与电离度的变化，理解电离平衡的移动',
    principle: 'CH3COOH ⇌ CH3COO- + H+（Ka = c(CH3COO-)·c(H+)/c(CH3COOH)，25 ℃ 时 Ka ≈ 1.75×10⁻⁵）。' +
      '弱电解质只部分电离，存在电离平衡：加水稀释 → 电离程度（电离度 α）增大，但 c(H⁺) 减小、pH 增大；' +
      '加入同离子（如 CH₃COONa 固体）→ 平衡逆向移动、电离被抑制、c(H⁺) 减小、pH 增大；' +
      '加入 NaOH（消耗 H⁺）→ 平衡正向移动、已电离的醋酸总量增大；加入盐酸（增大 c(H⁺)）→ 平衡逆向移动；' +
      '弱电解质的电离一般吸热，升温使 Ka 略增大、电离程度略增大。' +
      '对一元弱酸，c(H⁺) ≈ √(Ka·c)，所以每稀释 10 倍 pH 约增大 0.5（而强酸每稀释 10 倍 pH 增大 1）。',
    apparatus: ['烧杯（若干）', '量筒', '玻璃棒', 'pH 计（或 pH 试纸、酸度计）', '电子天平', '药匙',
      '0.1 mol/L CH₃COOH 溶液', 'CH₃COONa 固体', 'NaOH 固体', '浓盐酸', '蒸馏水', '温度计'],
    steps: ['配制一定浓度的醋酸溶液，测量其 pH',
      '取相同体积的醋酸溶液分别进行：加水稀释、加少量 CH₃COONa 固体、加少量 NaOH 固体、加少量浓盐酸、水浴升温',
      '每种操作后测量 pH（并计算 c(H⁺)）与电离度',
      '以 pH 对稀释倍数 n 的常用对数 lg n 作图，验证"稀释 10 倍 pH 增大 0.5"的规律',
      '比较各操作对电离平衡移动方向的影响，总结勒夏特列原理在电离平衡中的应用'],
    params: [
      { key: 'op', label: '操作', type: 'select',
        options: [
          { value: 'dilute', label: '加水稀释' },
          { value: 'naac', label: '加 CH₃COONa 固体（同离子）' },
          { value: 'naoh', label: '加 NaOH 固体' },
          { value: 'hcl', label: '加少量浓盐酸（增大 c(H⁺)）' },
          { value: 'heat', label: '水浴升温（用温度参数控制）' }
        ], value: 'dilute' },
      { key: 'n', label: '稀释倍数 n', unit: '倍', min: 1, max: 100, step: 1, value: 10 },
      { key: 'm', label: '加入固体（或浓盐酸）的质量', unit: 'g', min: 0, max: 2.0, step: 0.1, value: 0.5 },
      { key: 'c0', label: '醋酸初始浓度', unit: 'mol/L', min: 0.01, max: 1.00, step: 0.01, value: 0.10 },
      { key: 'temp', label: '温度', unit: '℃', min: 10, max: 60, step: 1, value: 25 }
    ],
    react: function (p, ctx) {
      var op = String(pv(p, 'op', 'dilute'));
      var n = pnum(p, 'n', 10);
      var m = pnum(p, 'm', 0.5);
      var c0 = pnum(p, 'c0', 0.10);
      var temp = pnum(p, 'temp', 25);
      var T = 273.15 + temp;
      var Ka = kaOf(T);
      var cAcid = c0, extraAc = 0, x, nAc, shift;
      var cHtotal = NaN;            /* 溶液里 c(H+) 的总值（加盐酸时 = 醋酸电离的 + 盐酸提供的） */
      var xRef = hacX(c0, kaOf(298.15));
      var alphaRef = xRef / c0 * 100;

      if (op === 'dilute') {
        cAcid = c0 / Math.max(n, 1);
        x = hacX(cAcid, Ka);
        nAc = x;
      } else if (op === 'naac') {
        var cSalt = m / 82.03;                       /* mol/L，按 1 L 溶液计 */
        var b = Ka + cSalt;
        x = (-b + Math.sqrt(b * b + 4 * Ka * c0)) / 2;
        nAc = x;
        cAcid = c0;
      } else if (op === 'naoh') {
        var nOH = m / 40.0;                          /* mol/L */
        if (nOH <= 0) x = hacX(c0, Ka);
        else if (nOH >= c0 * 0.995) x = Math.max(1e-13, 1e-14 / Math.max(nOH, 1e-9));
        else x = Ka * (c0 - nOH) / nOH;
        nAc = x + Math.min(nOH, c0);
        cAcid = Math.max(c0 - nOH, 1e-6);
      } else if (op === 'hcl') {
        var nHCl = m / 36.46;                        /* mol/L，按 HCl 溶质质量计 */
        /* 加入强酸后：游离 H+ 由醋酸贡献 x，盐酸贡献 nHCl —— 解 x(x+nHCl)/(c0-x) = Ka */
        x = (-(nHCl + Ka) + Math.sqrt(Math.pow(nHCl + Ka, 2) + 4 * Ka * c0)) / 2;
        nAc = x;
        cAcid = c0;
        cHtotal = x + nHCl;                          /* ★ 不能只报 x：盐酸提供的 H+ 占绝对多数 */
      } else {                                        /* heat */
        x = hacX(c0, Ka);
        nAc = x;
        cAcid = c0;
      }
      if (!(x > 0)) x = 1e-12;
      if (!(cHtotal > 0)) cHtotal = x;
      var pH = -lg(cHtotal);
      var alpha = nAc / Math.max(cAcid, 1e-9) * 100;
      shift = (alpha > alphaRef * 1.02) ? 1 : ((alpha < alphaRef * 0.98) ? -1 : 0);
      var lgN = lg(Math.max(n, 1));

      var ph = [];
      ph.push('用 pH 计测得溶液 pH = ' + fx(pH, 2) + '，c(H⁺) = ' + fx(cHtotal * 1000, 3) + ' ×10⁻³ mol/L');
      ph.push('电离度 α = ' + fx(alpha, 2) + '%（' + fx(nAc * 1000, 4) +
        ' mmol/L 醋酸已电离成 CH₃COO⁻），说明醋酸是弱电解质、只部分电离');
      if (op === 'dilute') {
        ph.push('加水稀释到 ' + fx(n, 0) + ' 倍后：电离度增大（平衡正向移动），但 c(H⁺) 减小、pH 增大');
        ph.push('弱酸每稀释 10 倍 pH 约增大 0.5（强酸每稀释 10 倍 pH 增大 1），这是弱电解质稀释的定量特征');
      } else if (op === 'naac') {
        ph.push('加入 CH₃COONa 固体后，c(CH₃COO⁻) 增大，电离平衡逆向移动（同离子效应）');
        ph.push('电离度减小、c(H⁺) 减小、pH 增大（溶液显碱性的趋势增强）');
      } else if (op === 'naoh') {
        ph.push('加入 NaOH 固体后，OH⁻ 与 H⁺ 反应生成水，c(H⁺) 减小、pH 明显增大');
        ph.push('电离平衡正向移动：已电离的醋酸总量（醋酸根）增大到 ' + fx(nAc * 1000, 3) + ' mmol/L');
      } else if (op === 'hcl') {
        ph.push('加入浓盐酸后，c(H⁺) 增大，电离平衡逆向移动（同离子效应）');
        ph.push('电离度减小，但溶液总体 c(H⁺) 仍然增大、pH 减小');
      } else {
        ph.push('水浴升温后 Ka 略增大（弱电解质电离一般吸热），电离度略增大、c(H⁺) 略增大、pH 略减小');
        ph.push('温度对电离平衡的影响比浓度、同离子小得多，属于次要因素');
      }
      if (op !== 'heat') ph.push('温度保持 ' + fx(temp, 0) + ' ℃：温度不变则电离常数 Ka 不变');
      ph.push('醋酸溶液中存在电离平衡 CH₃COOH ⇌ CH₃COO⁻ + H⁺，加入水、同离子、酸或碱都会使平衡移动');

      return {
        phenomena: ph,
        equation: 'CH3COOH ⇌ CH3COO- + H+',
        ionic: 'CH3COOH ⇌ CH3COO- + H+（加 CH3COONa 时同离子效应抑制电离；加水稀释促进电离，每稀释 10 倍 pH 约增大 0.5）',
        ionicNet: 'CH3COOH ⇌ CH3COO- + H+',
        type: '可逆反应·弱电解质的电离平衡（稀释、同离子、温度的影响）',
        conditions: '常温（或水浴控温），0.1 mol/L 左右醋酸溶液，用 pH 计测量并计算 c(H⁺) 与电离度',
        note: 'Ka(25 ℃) 取 1.75×10⁻⁵；电离度 α = 已电离（或已转化为醋酸根）的醋酸 / 起始醋酸 × 100%',
        measures: {
          lgN: lgN, pH: pH, cH: cHtotal * 1000, alpha: alpha, nAc: nAc * 1000,
          shift: shift, Ka: Ka * 1e5, cAcid: cAcid, temp: temp
        }
      };
    },
    columns: [
      { key: 'lgN', label: 'lg(稀释倍数 n)', unit: '' },
      { key: 'pH', label: 'pH', unit: '' },
      { key: 'cH', label: 'c(H⁺)', unit: '10⁻³ mol/L' },
      { key: 'alpha', label: '电离度 α', unit: '%' },
      { key: 'nAc', label: '已电离（醋酸根）总量', unit: 'mmol/L' },
      { key: 'Ka', label: '电离常数 Ka', unit: '10⁻⁵' },
      { key: 'shift', label: '平衡移动方向（+1 正 / −1 逆 / 0 不变）', unit: '' }
    ],
    graph: {
      x: 'lgN', y: 'pH', fit: 'linear',
      title: 'pH–lg(稀释倍数 n) 图线（弱酸每稀释 10 倍 pH 约增大 0.5）',
      note: '扫"稀释倍数 n"这个自变量（在**加水稀释**操作下）：lg n 每增大 1（稀释 10 倍），' +
        'pH 约增大 0.5，图线是斜率为 0.5 的直线（强酸则为 1，这是判断强弱电解质的定量依据）。' +
        '其它操作与稀释倍数无关，图线为水平线。'
    },
    conclude: function (rows, p) {
      var op = String(pv(p, 'op', 'dilute'));
      var n = rows ? rows.length : 0;
      var opTxt = {
        dilute: '加水稀释时电离平衡正向移动、电离度增大，但 c(H⁺) 减小、pH 增大（每稀释 10 倍 pH 约增大 0.5）',
        naac: '加入 CH₃COONa（同离子）时平衡逆向移动、电离被抑制，c(H⁺) 减小、pH 增大',
        naoh: '加入 NaOH 时 H⁺ 被中和，平衡正向移动、已电离的醋酸总量增大，pH 明显增大',
        hcl: '加入盐酸时 c(H⁺) 增大，平衡逆向移动、电离度减小，但 pH 减小',
        heat: '升温时 Ka 略增大（电离吸热），电离度与 c(H⁺) 略增大、pH 略减小'
      }[op] || '条件改变使电离平衡发生移动';
      return {
        text: '醋酸是弱电解质，溶液中存在电离平衡 CH₃COOH ⇌ CH₃COO⁻ + H⁺：' + opTxt + '。' +
          '电离平衡也遵循勒夏特列原理：增大生成物浓度（H⁺、CH₃COO⁻）平衡逆向移动，减小生成物浓度平衡正向移动，' +
          '稀释时向微粒数增多的一方（正向）移动，升温向吸热方向（正向）移动。' +
          '共记录 ' + n + ' 组数据，用 pH 与电离度 α 量化平衡移动的程度。',
        equation: 'CH3COOH ⇌ CH3COO- + H+',
        ionic: 'CH3COOH ⇌ CH3COO- + H+',
        errors: [
          'pH 计（或 pH 试纸）读数误差：弱酸溶液缓冲能力强，稀释后 pH 变化小，仪器精度不足会看不出规律',
          '稀释用的蒸馏水未除去溶解的 CO₂，会使 pH 偏低（偏酸）',
          '加入 CH₃COONa 固体后溶解吸热/放热使溶液温度变化，Ka 随之改变，混入温度因素',
          '空气中的 CO₂ 溶入碱性较强的溶液（加 NaOH 后）会消耗 OH⁻，使 pH 读数偏低',
          '浓盐酸挥发、取量不准，且加入后溶液体积略增大，浓度计算有偏差'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var op = String(pv(p, 'op', 'dilute'));
      var row = lastRow(state);
      var ph = num(anim.weak, 0);
      var w = S.w, h = S.h;
      paperTitle(g, '弱电解质的电离平衡（醋酸，操作：' +
        ({ dilute: '加水稀释', naac: '加 CH₃COONa', naoh: '加 NaOH', hcl: '加浓盐酸', heat: '水浴升温' }[op] || op) + '）',
        'CH₃COOH ⇌ CH₃COO⁻ + H⁺　·　稀释促进电离（α↑）但 c(H⁺)↓、pH↑');
      /* 烧杯 + 溶液（颜色随 pH：酸无色、碱淡红） */
      var bx = w * 0.2, bw = 190 * sc, bh = 130 * sc, by = 132 * sc;
      var pH = rowVal(row, 'pH');
      if (!isfin(pH)) pH = 2.9;
      var liq = (pH > 8) ? 'rgba(217,96,127,.35)' : 'rgba(214,222,232,.55)';
      box(g, bx, by, bw, bh, null, INK, 1.6);
      box(g, bx + 1, by + bh * 0.28, bw - 2, bh * 0.72 - 1, liq, null, 0);
      txt(g, 'CH₃COOH 溶液', bx + bw / 2, by + bh + 18 * sc, 11 * sc, 'center', 'rgba(38,34,28,.78)');
      /* pH 计 */
      var px = bx + bw + 22 * sc;
      box(g, px, by + 6 * sc, 78 * sc, 46 * sc, 'rgba(255,255,255,.75)', INK, 1.3, 4);
      txt(g, 'pH = ' + fx(pH, 2), px + 39 * sc, by + 36 * sc, 15 * sc, 'center',
        pH > 7 ? PINK : (pH > 3 ? INK : RED), false, true);
      ln(g, px + 39 * sc, by + 52 * sc, bx + bw * 0.6, by + bh * 0.5, 'rgba(38,34,28,.55)', 1.4);
      /* 电离示意：分子/离子格子（离子对数 ∝ α） */
      var gx = w * 0.56, gy = 120 * sc, gcols = 8, grows = 4, cw = 20 * sc, ch = 20 * sc;
      var alpha = rowVal(row, 'alpha');
      if (!isfin(alpha)) alpha = 1.3;
      var frac = clamp(alpha / 100 * 6, 0, 0.85);
      txt(g, '电离示意：○ CH₃COOH　● CH₃COO⁻ + H⁺（离子对数 ∝ 电离度 α = ' + fx(alpha, 2) + '%）',
        gx - 8 * sc, gy - 10 * sc, 10.5 * sc, 'left', 'rgba(38,34,28,.78)');
      var i, j, k = 0;
      for (j = 0; j < grows; j++) {
        for (i = 0; i < gcols; i++) {
          /* 微粒随动画相位轻微抖动（画布像素会变；化学量仍由 α 决定） */
          var jx = 1.6 * Math.sin(ph * 1.3 + k * 0.7);
          var jy = 1.4 * Math.cos(ph * 1.1 + k * 0.9);
          var cx0 = gx + i * cw + jx, cy0 = gy + j * ch + jy, kk = k;
          k++;
          if ((kk * 0.37 % 1) < frac) {
            circle(g, cx0 + 5 * sc, cy0 + 5 * sc, 3.6 * sc, RED, null, 0);
            circle(g, cx0 + 12 * sc, cy0 + 5 * sc, 3.6 * sc, BLUE, null, 0);
          } else {
            circle(g, cx0 + 8 * sc, cy0 + 5 * sc, 5.2 * sc, null, 'rgba(38,34,28,.6)', 1.1);
          }
        }
      }
      /* pH–lg n 小图 */
      var qx = gx, qy = gy + grows * ch + 24 * sc, qw = 150 * sc, qh = 92 * sc;
      box(g, qx, qy, qw, qh, 'rgba(255,255,255,.5)', 'rgba(38,34,28,.3)', 1, 3);
      ln(g, qx + 24 * sc, qy + qh - 16 * sc, qx + qw - 8 * sc, qy + qh - 16 * sc, 'rgba(38,34,28,.5)', 1);
      ln(g, qx + 24 * sc, qy + qh - 16 * sc, qx + 24 * sc, qy + 10 * sc, 'rgba(38,34,28,.5)', 1);
      txt(g, 'pH', qx + 12 * sc, qy + 22 * sc, 9.5 * sc, 'center', 'rgba(38,34,28,.7)');
      txt(g, 'lg n', qx + qw - 16 * sc, qy + qh - 4 * sc, 9.5 * sc, 'center', 'rgba(38,34,28,.7)');
      var rows = (state && state.rows) ? state.rows : [];
      var xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
      for (i = 0; i < rows.length; i++) {
        var ix = rowVal(rows[i], 'lgN'), iy = rowVal(rows[i], 'pH');
        if (!isfin(ix) || !isfin(iy)) continue;
        if (ix < xmin) xmin = ix; if (ix > xmax) xmax = ix;
        if (iy < ymin) ymin = iy; if (iy > ymax) ymax = iy;
      }
      if (xmax - xmin < 1e-6) xmax = xmin + 1;
      if (ymax - ymin < 1e-6) ymax = ymin + 0.5;
      for (i = 0; i < rows.length; i++) {
        var ax = rowVal(rows[i], 'lgN'), ay = rowVal(rows[i], 'pH');
        if (!isfin(ax) || !isfin(ay)) continue;
        circle(g, qx + 24 * sc + (qw - 32 * sc) * (ax - xmin) / (xmax - xmin),
          qy + qh - 16 * sc - (qh - 28 * sc) * (ay - ymin) / (ymax - ymin), 2.4, RED, null, 0);
      }
      txt(g, '斜率约 0.5（弱酸）', qx + qw / 2, qy + qh + 13 * sc, 10 * sc, 'center', RED);
      /* 操作示意 */
      if (op === 'heat') {
        bath(g, bx - 10 * sc, by + bh * 0.5, bw + 20 * sc, 46 * sc, 'rgba(226,178,150,.55)', '水浴升温');
      } else if (op === 'dilute') {
        arrow(g, bx - 40 * sc, by + bh * 0.4, bx - 8 * sc, by + bh * 0.4, BLUE, 1.4);
        txt(g, '加水 ' + fx(pnum(p, 'n', 10), 0) + ' 倍', bx - 42 * sc, by + bh * 0.4 - 8 * sc, 10.5 * sc, 'center', BLUE);
      } else if (op === 'naac' || op === 'naoh' || op === 'hcl') {
        var addName = (op === 'naac') ? 'CH₃COONa' : (op === 'naoh' ? 'NaOH' : '浓盐酸');
        circle(g, bx + bw * 0.5, by - 6 * sc, 5 * sc, 'rgba(255,255,255,.9)', INK, 1.2);
        txt(g, '加入 ' + addName + ' ' + fx(pnum(p, 'm', 0.5), 1) + ' g',
          bx + bw * 0.5, by - 16 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.85)');
      }
      var lines = [
        ['设定：' + ({ dilute: '加水稀释 ' + fx(pnum(p, 'n', 10), 0) + ' 倍', naac: '加 CH₃COONa ' + fx(pnum(p, 'm', 0.5), 1) + ' g', naoh: '加 NaOH ' + fx(pnum(p, 'm', 0.5), 1) + ' g', hcl: '加浓盐酸（HCl ' + fx(pnum(p, 'm', 0.5), 1) + ' g）', heat: '水浴升温至 ' + fx(pnum(p, 'temp', 25), 0) + ' ℃' }[op] || op), INK],
        ['操作：' + ({ dilute: '加水稀释', naac: '加 CH₃COONa', naoh: '加 NaOH', hcl: '加浓盐酸', heat: '升温' }[op] || op), INK],
        ['稀释倍数 n = ' + fx(pnum(p, 'n', 10), 0) + '　lg n = ' + (isfin(rowVal(row, 'lgN')) ? fx(rowVal(row, 'lgN'), 3) : '—'), INK],
        ['pH = ' + fx(pH, 2) + '　c(H⁺) = ' + (isfin(rowVal(row, 'cH')) ? fx(rowVal(row, 'cH'), 3) : '—') + ' ×10⁻³ mol/L', RED],
        ['电离度 α = ' + (isfin(alpha) ? fx(alpha, 2) : '—') + ' %', INK],
        ['已电离（醋酸根）= ' + (isfin(rowVal(row, 'nAc')) ? fx(rowVal(row, 'nAc'), 3) : '—') + ' mmol/L', INK],
        ['Ka = ' + (isfin(rowVal(row, 'Ka')) ? fx(rowVal(row, 'Ka'), 3) : '—') + ' ×10⁻⁵　T = ' + fx(pnum(p, 'temp', 25), 0) + ' ℃', GRAYG],
        ['平衡移动：' + (rowVal(row, 'shift') > 0.5 ? '正向 (+1)' :
          (rowVal(row, 'shift') < -0.5 ? '逆向 (−1)' : '几乎不变 (0)')), INK]
      ];
      panel(g, w - 226 * sc, 56 * sc, 212 * sc, lines);
      txt(g, '结论：加水稀释、加碱（消耗 H⁺）→ 电离平衡正向移动；加同离子（CH₃COONa、盐酸）→ 逆向移动；电离一般吸热，升温促进电离',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.weak = num(anim.weak, 0) + (isfin(dt) ? dt : 0) * 0.3;
      if (anim.weak > 1e6) anim.weak = 0;
    }
  };

  /* ====================================================================== *
   * 8. 动画相位（模块级；只被 step 推进，draw 读它 → run(1) 后像素会变）    *
   * ====================================================================== */

  var anim = { rc: 0, rt: 0, rcat: 0, eqf: 0, eqn: 0, weak: 0 };

  /* ====================================================================== *
   * 9. 登记                                                                *
   * ====================================================================== */

  var SPECS = [rateConc, rateTemp, rateCat, eqFescn, eqNo2, weakElec];

  function reg(spec) {
    var A = (typeof window !== 'undefined') ? window.QG_CLAB : null;
    if (A && isfn(A.register)) {
      A.register(spec.id, spec);
      return true;
    }
    return false;
  }

  var i;
  for (i = 0; i < SPECS.length; i++) reg(SPECS[i]);

  if (typeof window !== 'undefined') {
    if (!window.QG_CLAB_KINETICS_ORIGIN) window.QG_CLAB_KINETICS_ORIGIN = BUILD;
  }
})();
