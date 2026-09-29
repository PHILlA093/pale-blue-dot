/* ============================================================================
 * 穷观 · 化学实验台 · 组 4 · 电化学（js/clab/electro.js）
 * Build ID: QG-20260920-5e5d5a          （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向化学实验台注册表登记 6 个电化学实验
 *     galvanic-cuzn       Cu-Zn 原电池（稀硫酸单液 / 盐桥双液）
 *     electrolysis-cucl2  电解 CuCl₂ 溶液（阴极析铜 + 阳极黄绿色气体）
 *     electrolysis-brine  电解饱和食盐水（H₂ + Cl₂ + NaOH，检验）
 *     electroplating      电镀（铁上镀铜 / 镀锌）
 *     iron-corrosion      铁的吸氧腐蚀 / 析氢腐蚀（中性、酸性水膜对比）
 *     fuel-cell           氢氧燃料电池（酸性 / 碱性电解质）
 * 纯 ES5、零外部依赖、不用 eval / new Function（守观澜的严格 CSP）；
 * 画面全部用调用方给的 Canvas 2D 上下文画，不建任何 DOM 节点、不起循环（惰性）。
 *
 * 契约：window.QG_CLAB.register(id, spec)，字段见 docs/化学实验台设计.md §3、§4。
 * 绘图约定沿用 docs/物理实验台设计.md §9：
 *   · g.font 是**宽容签名**（(size) / (size,bool) / (size,'italic bold') / (size,italic,bold)
 *     都行）——本文件一律走 g.font(size) 或经 fontOf() 兜底，绝不把 true/false 拼进字体串；
 *   · null = "这次观察在该项目上没有有效值"（不是 0）：例如石墨阳极时"阳极溶解量"、
 *     稀硫酸单液电池里"铜析出量"都记 null（表格显示「—」），真实的 0 照常记 0；
 *   · 选项型参数一律写成 { type:'select', options:[{value,label},…], value }；
 *   · r² 只在"扫自变量"时才有意义 —— 本组每个有图线的实验都给出可扫的自变量
 *     （放电/通电/电镀时间 t、腐蚀时间 t），图线是过原点的法拉第直线。
 *
 * ----------------------------------------------------------------------------
 * 【电极反应式怎么放 —— 一条实测出来的写法（写给验收的人）】
 * 本组 6 个反应都要"正负极/阴阳极分开写"。做法是：
 *   ① `ionic` = **一个干净的净离子方程式**，紧跟一个**中文括注**，括注里把
 *      正/负极（阴/阳极）反应式、电子流向与离子移动方向**写全**，例如
 *      「Zn + 2H+ = Zn2+ + H2↑（负极：Zn - 2e- = Zn2+，氧化；正极：2H+ + 2e- = H2↑，还原；…）」；
 *   ② 另给 `ionicHalf`（同一条电极反应式的独立字段）与 `electrodes`（结构化：负极/正极/电子流向/离子移动）。
 * 为什么这么写：核心 `QG_CLAB.balance()` 会对 `ionic` 也跑一遍配平校验，而它的
 * `normEqText()` 会**先剥掉含汉字的小括号括注**（`stripCjkParens`）再解析 —— 所以
 * "净方程式 + 中文括注"既能通过配平校验、界面上又完整显示电极反应式（实测：核心
 * 对 `equation` 与 `ionic` 的 balance 都是 ok）。
 * ⚠ 两条实测约束（改这段文字时别踩）：括注里**不能出现嵌套的英文括号**
 *   （如 Fe(SCN)3、Fe(OH)3、c(Fe3+)），否则括注没被剥掉、离子式会被判"未配平"；
 *   也不要把电极反应写成 `负极：Zn - 2e- = …` 直接裸露在 ionic 里（会被当成化学式解析）。
 *   `ionicNet` 再给一份**纯离子方程式**（无任何括注），供下游只想要方程式时用。
 * 每条电极反应式本身都是配平的（自测里逐条断言过）。
 *
 * ----------------------------------------------------------------------------
 * 【化学事实的权威来源核对】（不凭记忆编造）
 *
 * · Cu-Zn 原电池（稀 H₂SO₄ 单液）负极 Zn-2e⁻=Zn²⁺（氧化）、正极 2H⁺+2e⁻=H₂↑（还原）、
 *   "电子移动方向：从锌出发经过导线流向铜"、"溶液中氢离子向正极移动"：
 *     https://www.jyeoo.com/shiti/69710edb-15f7-151a-95e3-d3615938e25b  （菁优网·全文已核）
 * · Cu-Zn 盐桥双液电池：负极 Zn-2e⁻=Zn²⁺、正极 Cu²⁺+2e⁻=Cu、导线中电子由锌到铜、
 *   "盐桥中的 K⁺ 向右侧（CuSO₄）烧杯移动、Cl⁻ 向左侧（ZnSO₄）烧杯移动"：
 *     https://www.jyeoo.com/shiti/46d10431-1518-1556-a508-2529b51b8d15  （菁优网·摘录：搜索返回全文片段）
 *     https://www.jyeoo.com/shiti/233810da-0915-4c15-b758-b641ef9a225f/ （菁优网·摘录："盐桥中向 CuSO₄ 溶液中迁移的离子是 K⁺"）
 * · 电解 CuCl₂ 溶液：阴极"产生红色物质"Cu²⁺+2e⁻=Cu；阳极 2Cl⁻-2e⁻=Cl₂↑、
 *   "阳极石墨表面产生大量气泡，有刺激性气味"、"湿润的淀粉碘化钾试纸置于上方 → 试纸变蓝"、
 *   溶液蓝色变浅：
 *     https://www.jyeoo.com/shiti/6ab10005-3115-415d-ba51-8f43d2cd2524  （菁优网·全文已核）
 *     https://www.jyeoo.com/shiti/109b3dab-1573-415f-a54d-4253dc814301  （菁优网·全文已核）
 * · 电解饱和食盐水：阴极 2H⁺+2e⁻=H₂↑、"放出气体，溶液变红"（酚酞）；阳极 2Cl⁻-2e⁻=Cl₂↑、
 *   "把湿润的碘化钾淀粉试纸放在 Y 电极附近，试纸变蓝色"；总反应
 *   2Cl⁻+2H₂O --电解--> H₂↑+Cl₂↑+2OH⁻：
 *     https://www.jyeoo.com/shiti/db105108-6152-15f5-852b-d125247a2d6d  （菁优网·全文已核）
 *     https://www.jyeoo.com/shiti/52104ff7-8154-415b-a850-625688477bfd  （菁优网·全文已核）
 * · 电镀（铁上镀铜）：铁棒作阴极、铜作阳极、CuSO₄ 作电镀液；阳极 Cu-2e⁻=Cu²⁺、
 *   阴极 Cu²⁺+2e⁻=Cu、"另一电极用于及时补充消耗的镀层物质"：
 *     https://www.jyeoo.com/shiti/52104ff7-8154-415b-a850-625688477bfd  （菁优网·全文已核）
 *     https://www.jyeoo.com/shiti/db105108-6152-15f5-852b-d125247a2d6d  （菁优网·全文已核）
 * · 铁的腐蚀：两种电化学腐蚀的负极反应均为 Fe-2e⁻=Fe²⁺；水膜酸度较高时正极
 *   2H⁺+2e⁻=H₂↑（析氢腐蚀），水膜酸性不强时正极 O₂+2H₂O+4e⁻=4OH⁻（吸氧腐蚀）：
 *     https://www.jyeoo.com/shiti/19698610-115f-4215-5553-fb21c256f568  （菁优网·全文已核）
 *   吸氧腐蚀全过程（世界腐蚀组织中文官网科普文，铁锅生锈）：
 *     负极（Fe）2Fe-4e→2Fe²⁺；正极（C）2H₂O+4e+O₂→4OH⁻；Fe²⁺+2OH⁻→Fe(OH)₂；
 *     4Fe(OH)₂+O₂+2H₂O→4Fe(OH)₃；2Fe(OH)₃→Fe₂O₃·xH₂O（铁锈）+(3-x)H₂O：
 *     http://www.corrosion.org.cn/kzpj/kpwz/202304/t20230417_165114.html （全文已核）
 * · 氢氧燃料电池：酸式（稀硫酸）负极 2H₂-4e⁻=4H⁺、正极 O₂+4e⁻+4H⁺=2H₂O、总反应
 *   2H₂+O₂=2H₂O、电解质溶液 pH **增大**；碱式（NaOH/KOH）负极 2H₂-4e⁻+4OH⁻=4H₂O、
 *   正极 O₂+4e⁻+2H₂O=4OH⁻、总反应相同、pH **减小**：
 *     https://www.jyeoo.com/shiti/1883ab10-0c15-4215-bb5f-e65e83b5c025  （菁优网·全文已核）
 * · 法拉第电解定律 m = M·Q/(nF)（作图用的定量关系；F = 96485 C/mol，标准状况
 *   气体摩尔体积 22.4 L/mol）：高中电解计算的通行依据，本文件所有定量列都按它算。
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

  /* 参数取值（宽容：缺字段/空串都退回默认值） */
  function pv(p, k, d) {
    if (!p) return d;
    var v = p[k];
    if (v === undefined || v === null || v === '') return d;
    return v;
  }
  function pnum(p, k, d) { return num(pv(p, k, d), d); }

  /* 确定性伪随机（Park–Miller）：同一份代码重复跑得到同一串数，
     便于"扫自变量测 r²"复现；核心若提供 ctx.noise 则优先用核心的。 */
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

  /* 常量：法拉第常数 / 摩尔质量 / 标准状况气体摩尔体积 */
  var F = 96485;
  var M_CU = 63.55, M_ZN = 65.38, M_FE = 55.85, M_O2 = 32.0;
  var VM = 22400;                    /* mL/mol */

  /* 法拉第电解定律：通过 Q 库仑电量析出/溶解的物质质量（mg） */
  function faradayMass(Q, M, n) { return M * Q / (n * F) * 1000; }
  /* 通过 Q 库仑电量生成的气体在标准状况下的体积（mL），n = 每摩尔气体转移的电子数 */
  function faradayGas(Q, n) { return VM * Q / (n * F); }

  /* ====================================================================== *
   * 1. 画图通用件（纸面观感与物理实验台一致：米白纸 + 墨色 + Georgia 斜体）  *
   * ====================================================================== */

  var PAPER = '#F4F1EA', INK = '#26221C';
  var BLUE = '#4a7fb5', SOLCU = '#5b9bd5', CURED = '#b4552f', CL2G = '#c3d43f';
  var ZNG = '#aeb8bf', RUST = '#8a4b23', RED = '#a3232b', PINK = '#d9607f';
  var GRAYG = '#8d9aa3', WATER = '#a8cbe4', YELLOW = '#d8c24a';

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
  /* 宽容字体：优先用核心的 g.font（§9 的四种签名都认），失败再自己拼一串合法的 */
  function fontOf(g, size, italic, bold) {
    var s = Math.round(num(size, 12));
    if (g && isfn(g.font)) {
      try {
        var f = g.font(s, italic !== false, !!bold);
        if (typeof f === 'string' && f) return f;
      } catch (e) { /* 退回下面自己拼 */ }
    }
    return ((italic === false) ? '' : 'italic ') + (bold ? 'bold ' : '') +
      s + 'px Georgia,"Times New Roman",serif';
  }
  function txt(g, s, x, y, size, align, color, italic, bold) {
    if (g && isfn(g.text)) {
      try { g.text(s, x, y, size, align, color); return; } catch (e) { /* 退回原生 */ }
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
      try { g.line(x1, y1, x2, y2, color, w); return; } catch (e) { /* 退回原生 */ }
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
      try { g.arrow(x1, y1, x2, y2, color, w); return; } catch (e) { /* 退回原生 */ }
    }
    var col = color || INK;
    c.save();
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w || 1.4;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    var a = Math.atan2(y2 - y1, x2 - x1), L = 8;
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - L * Math.cos(a - 0.4), y2 - L * Math.sin(a - 0.4));
    c.lineTo(x2 - L * Math.cos(a + 0.4), y2 - L * Math.sin(a + 0.4));
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
    } else {
      c.rect(x, y, w, h);
    }
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
  /* 试管：下圆上直（x,y = 管口左上角；管口朝上） */
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
    var lh = clamp(num(level, 0.5), 0, 0.94) * h;
    if (liquid) {
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
  /* 一串小气泡（phase 推进 → 像素会变；确定性，不用 Math.random） */
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
  /* 浑浊/沉淀颗粒（确定性点阵） */
  function specks(g, x, y, w, h, dens, color, seed) {
    var c = ctxOf(g), i, n, s;
    if (!c) return;
    n = Math.round(clamp(dens, 0, 1) * 90);
    s = num(seed, 1);
    c.save();
    c.fillStyle = color;
    for (i = 0; i < n; i++) {
      var rx = ((i * 12.9898 + s * 78.233) % 1 + 1) % 1;
      var ry = ((i * 39.3468 + s * 11.135) % 1 + 1) % 1;
      c.beginPath();
      c.arc(x + rx * w, y + ry * h, 0.9 + 1.1 * (((i * 7.13 + s) % 1 + 1) % 1), 0, 6.283185307179586);
      c.fill();
    }
    c.restore();
  }
  /* 铁锈斑（不规则块） */
  function rustSpots(g, x, y, w, h, amount, seed) {
    var i, n = Math.round(clamp(amount, 0, 1.4) * 9), s = num(seed, 1);
    for (i = 0; i < n; i++) {
      var rx = ((i * 21.13 + s * 5.7) % 1 + 1) % 1;
      var ry = ((i * 17.71 + s * 9.1) % 1 + 1) % 1;
      var rr = 3 + 6 * (((i * 3.31 + s) % 1 + 1) % 1);
      ell(g, x + rx * w, y + ry * h, rr, rr * 0.72, 'rgba(138,75,35,.78)', 'rgba(110,58,26,.9)', 1);
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
  /* 读数面板（右上一小块纸面） */
  function panel(g, x, y, w, lines) {
    var i, lh = 15, h = 10 + lines.length * lh;
    box(g, x, y, w, h, 'rgba(255,255,255,.55)', 'rgba(38,34,28,.35)', 1, 4);
    for (i = 0; i < lines.length; i++) {
      txt(g, lines[i][0], x + 8, y + 20 + i * lh, 11.5, 'left',
        lines[i][1] || 'rgba(38,34,28,.86)');
    }
    return h;
  }
  /* 电源符号（直流）：两条长短线 */
  function dcSource(g, x, y, label) {
    ln(g, x - 16, y - 8, x + 16, y - 8, INK, 1.6);
    ln(g, x - 9, y + 4, x + 9, y + 4, INK, 3.4);
    txt(g, label || '直流电源', x, y + 22, 11, 'center', 'rgba(38,34,28,.8)');
  }
  /* 电流计符号：圆圈 + G */
  function galv(g, x, y, r, label) {
    circle(g, x, y, r, 'rgba(255,255,255,.7)', INK, 1.4);
    txt(g, 'G', x, y + 4, Math.round(r * 1.15), 'center', INK, false, true);
    if (label) txt(g, label, x, y + r + 13, 10.5, 'center', 'rgba(38,34,28,.75)');
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
  function paperTitle(g, str, sub) {
    var S = sceneSize(g), sc = scaleOf(g);
    txt(g, str, 14 * sc, 24 * sc, Math.round(14 * sc), 'left', 'rgba(38,34,28,.88)');
    if (sub) txt(g, sub, 14 * sc, 40 * sc, Math.round(11 * sc), 'left', 'rgba(38,34,28,.6)');
    ln(g, 12 * sc, 46 * sc, S.w - 12 * sc, 46 * sc, 'rgba(38,34,28,.25)', 1);
  }

  /* ====================================================================== *
   * 2. 反应 1 · Cu-Zn 原电池                                              *
   * ====================================================================== */

  var galvanic = {
    id: 'galvanic-cuzn',
    name: '铜锌原电池（Cu-Zn 原电池）',
    group: '电化学',
    aim: '组装 Cu-Zn 原电池，观察电流与电极变化，写出正负极反应式，判断电子流向与离子移动方向',
    principle: 'Zn 比 Cu 活泼，Zn 失电子被氧化作负极：Zn - 2e- = Zn2+；' +
      '稀硫酸单液时 H+ 在铜（正极）上得电子：2H+ + 2e- = H2↑，总反应 Zn + H2SO4 = ZnSO4 + H2↑；' +
      '盐桥双液（ZnSO4 ‖ CuSO4）时 Cu2+ 在铜（正极）上得电子：Cu2+ + 2e- = Cu，总反应 Zn + Cu2+ = Zn2+ + Cu。' +
      '电子由锌经导线流向铜（负极 → 正极）；溶液中阳离子移向正极（H+ 移向铜电极；盐桥中 K+ 移向 CuSO4 一侧），' +
      '阴离子移向负极（SO4^2- 移向锌电极；盐桥中 Cl- 移向 ZnSO4 一侧）。' +
      '原电池把化学能转化为电能，电流大小随电极面积、电解质浓度、温度增大而增大（锌片表面氧化膜会使电流明显减小）。',
    apparatus: ['烧杯（单液）/ U 形管与盐桥（双液）', '锌片', '铜片', '稀硫酸或 ZnSO4、CuSO4 溶液',
      '灵敏电流计', '导线', '砂纸', '秒表'],
    steps: ['用砂纸打磨锌片、铜片，除去表面氧化膜', '按装置图把锌片、铜片插入电解质，接好导线与电流计',
      '观察电流计指针偏转方向与读数，记录电流', '观察两极现象（锌片溶解、铜片上的气泡或红色物质）',
      '按设定的放电时间记录数据，用 m = M·Q/(nF) 核对锌的溶解量'],
    params: [
      { key: 'electrolyte', label: '电解质体系', type: 'select',
        options: [
          { value: 'acid', label: '稀硫酸（单液）' },
          { value: 'saltbridge', label: '盐桥双液（ZnSO4 ‖ CuSO4）' }
        ], value: 'acid' },
      { key: 'c', label: '电解质浓度（稀硫酸或 CuSO4）', unit: 'mol/L', min: 0.1, max: 2.0, step: 0.1, value: 1.0 },
      { key: 'area', label: '电极浸入面积', unit: 'cm²', min: 1, max: 12, step: 0.5, value: 5 },
      { key: 'temp', label: '温度', unit: '℃', min: 5, max: 60, step: 1, value: 25 },
      { key: 'sand', label: '锌片是否用砂纸打磨', type: 'select',
        options: [
          { value: 'yes', label: '已打磨（光亮）' },
          { value: 'no', label: '未打磨（有氧化膜）' }
        ], value: 'yes' },
      { key: 'time', label: '放电时间', unit: 'min', min: 1, max: 30, step: 1, value: 5 }
    ],
    react: function (p, ctx) {
      var sys = String(pv(p, 'electrolyte', 'acid'));
      var c = pnum(p, 'c', 1.0);
      var area = pnum(p, 'area', 5);
      var temp = pnum(p, 'temp', 25);
      var sand = String(pv(p, 'sand', 'yes'));
      var mins = pnum(p, 'time', 5);
      var acid = (sys !== 'saltbridge');

      /* 电动势：能斯特方程（25 ℃，0.0592 V/电子） */
      var emf;
      if (acid) emf = 0.76 + 0.0592 * lg(Math.max(c, 0.01));
      else emf = 1.10 + 0.0296 * lg(Math.max(c, 0.01));
      emf = clamp(emf, 0.30, 1.60);

      /* 电流：面积、温度、打磨、浓度都影响（接触电阻/极化） */
      var polish = (sand === 'yes') ? 1.0 : 0.12;
      var tf = 1 + 0.004 * (temp - 25);
      var cf = 0.55 + 0.45 * clamp(c / 1.0, 0, 1.6);
      var current = 2.2 * area * emf * polish * tf * cf;      /* mA */
      current = clamp(current, 0.05, 900);

      var tsec = mins * 60;
      var Q = current / 1000 * tsec;                          /* C */
      var znLoss = faradayMass(Q, M_ZN, 2);
      var cuGain = acid ? null : faradayMass(Q, M_CU, 2);
      var h2 = acid ? faradayGas(Q, 2) : null;
      var eFlow = Q / F * 1000;                               /* mmol 电子 */

      var ph = [];
      ph.push('电流计指针发生偏转，说明化学能转化为电能（原电池）');
      ph.push('电子由锌片经导线流向铜片（负极 → 正极），电流方向与电子流向相反');
      if (acid) {
        ph.push('铜片表面产生大量气泡，气体是 H₂（点燃有爆鸣声）');
        ph.push('溶液中 H⁺ 向铜（正极）移动、SO₄²⁻ 向锌（负极）移动');
        ph.push('锌片逐渐溶解变薄（锌中杂质上也有少量气泡，属于自腐蚀）');
      } else {
        ph.push('铜片表面析出红色的铜（Cu²⁺ + 2e⁻ = Cu）');
        ph.push('CuSO₄ 溶液蓝色变浅，锌片逐渐溶解变薄');
        ph.push('盐桥中 K⁺ 移向 CuSO₄ 溶液（正极区），Cl⁻ 移向 ZnSO₄ 溶液（负极区）');
      }
      if (sand === 'no') ph.push('锌片表面有氧化膜，电流明显偏小（接触电阻大、锌不易失电子）');
      if (area >= 8) ph.push('电极面积大，电流明显增大');
      if (temp >= 45) ph.push('温度升高，离子迁移加快，电流略有增大');
      if (c >= 1.6) ph.push('电解质浓度大，单位时间转移的电子多，电流较大');

      return {
        phenomena: ph,
        equation: acid ? 'Zn + H2SO4 = ZnSO4 + H2↑' : 'Zn + CuSO4 = ZnSO4 + Cu',
        ionic: acid
          ? 'Zn + 2H+ = Zn2+ + H2↑（负极：Zn - 2e- = Zn2+，氧化；正极：2H+ + 2e- = H2↑，还原；电子由锌经导线流向铜，溶液中的 H+ 移向正极铜）'
          : 'Zn + Cu2+ = Zn2+ + Cu（负极：Zn - 2e- = Zn2+；正极：Cu2+ + 2e- = Cu；盐桥中 K+ 移向 CuSO4 一侧、Cl- 移向 ZnSO4 一侧）',
        ionicNet: acid ? 'Zn + 2H+ = Zn2+ + H2↑' : 'Zn + Cu2+ = Zn2+ + Cu',
        ionicHalf: acid
          ? '负极（氧化）：Zn - 2e- = Zn2+；正极（还原）：2H+ + 2e- = H2↑'
          : '负极（氧化）：Zn - 2e- = Zn2+；正极（还原）：Cu2+ + 2e- = Cu',
        electrodes: {
          negative: 'Zn - 2e- = Zn2+（氧化反应，锌片溶解）',
          positive: acid ? '2H+ + 2e- = H2↑（还原反应，铜片上冒气泡）' : 'Cu2+ + 2e- = Cu（还原反应，铜片上析出红色铜）',
          electronFlow: '电子：Zn →（导线）→ Cu；电流：Cu →（导线）→ Zn',
          ionFlow: acid ? 'H+ → 正极（铜）；SO4^2- → 负极（锌）'
            : '盐桥中 K+ → CuSO4 一侧（正极区）；Cl- → ZnSO4 一侧（负极区）'
        },
        type: '原电池（化学能转化为电能）',
        conditions: acid
          ? '常温，稀硫酸作电解质（单液），锌片用砂纸打磨'
          : '常温，盐桥（饱和 KCl 琼胶）连接 ZnSO4 与 CuSO4 两种溶液（双液）',
        measures: {
          emf: emf, current: current, q: Q, eFlow: eFlow,
          znLoss: znLoss, cuGain: cuGain, h2: h2
        }
      };
    },
    columns: [
      { key: 'emf', label: '电动势', unit: 'V' },
      { key: 'current', label: '电流', unit: 'mA' },
      { key: 'q', label: '通过电量', unit: 'C' },
      { key: 'eFlow', label: '转移电子', unit: 'mmol' },
      { key: 'znLoss', label: '锌溶解', unit: 'mg' },
      { key: 'cuGain', label: '铜析出（盐桥）', unit: 'mg' },
      { key: 'h2', label: '氢气体积（稀硫酸）', unit: 'mL' }
    ],
    graph: {
      x: 'q', y: 'znLoss', fit: 'origin',
      title: '锌溶解质量–通过电量 图线（法拉第电解定律 m = M·Q/(nF)）',
      note: '扫"放电时间"这个自变量：电量 Q = I·t 越大，负极溶解的锌越多，' +
        '图线是过原点的直线，斜率 = M(Zn)/(2F) = 0.339 mg/C。'
    },
    conclude: function (rows, p) {
      var sys = String(pv(p, 'electrolyte', 'acid'));
      var acid = (sys !== 'saltbridge');
      var n = rows ? rows.length : 0;
      return {
        text: 'Cu-Zn 原电池中锌比铜活泼，锌失电子被氧化，作负极；' +
          (acid
            ? '稀硫酸中的 H⁺ 在铜片（正极）上得电子析出 H₂，总反应 Zn + H2SO4 = ZnSO4 + H2↑。'
            : 'CuSO4 中的 Cu²⁺ 在铜片（正极）上得电子析出铜，总反应 Zn + Cu2+ = Zn2+ + Cu。') +
          '电子由负极（锌）经导线流向正极（铜），溶液中阳离子移向正极、阴离子移向负极；' +
          '共记录 ' + n + ' 组数据，锌的溶解量随通过电量成正比增大（m = M·Q/(nF)）。',
        equation: acid ? 'Zn + H2SO4 = ZnSO4 + H2↑' : 'Zn + CuSO4 = ZnSO4 + Cu',
        ionic: acid
          ? 'Zn + 2H+ = Zn2+ + H2↑（负极：Zn - 2e- = Zn2+，氧化；正极：2H+ + 2e- = H2↑，还原；电子由锌经导线流向铜，H+ 移向正极）'
          : 'Zn + Cu2+ = Zn2+ + Cu（负极：Zn - 2e- = Zn2+，氧化；正极：Cu2+ + 2e- = Cu，还原；盐桥中 K+ 移向 CuSO4 一侧）',
        errors: [
          '锌片表面氧化膜未用砂纸打磨干净，接触电阻大，电流偏小、数据偏小',
          '放电时间用秒表计时，通电与开始计时的时刻不同步会带来系统误差',
          '铜片表面附着气泡（稀硫酸体系）会减小有效电极面积，使电流逐渐下降',
          '温度升高或溶液蒸发会使浓度变化，影响电动势与电流的稳定读数',
          '盐桥使用过久（KCl 扩散流失）会使内阻增大、电流衰减'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var sys = String(pv(p, 'electrolyte', 'acid'));
      var acid = (sys !== 'saltbridge');
      var row = lastRow(state);
      var phase = num(anim.galv, 0);
      var w = S.w, h = S.h;
      var cx = w / 2, baseY = h - 46 * sc;
      var bw = (acid ? 150 : 132) * sc, bh = 108 * sc;
      var i;

      paperTitle(g, 'Cu-Zn 原电池（' + (acid ? '稀硫酸单液' : '盐桥双液') + '）',
        '电子：锌 →（导线）→ 铜　·　' + (acid ? '溶液中 H⁺ 移向正极（铜）' : '盐桥中 K⁺ 移向 CuSO₄ 一侧'));

      /* 两个烧杯（盐桥体系）或一个烧杯（单液） */
      var cells = [], k;
      if (acid) {
        cells = [{ x: cx - bw / 2, label: '稀硫酸' }];
      } else {
        cells = [{ x: cx - bw - 26 * sc, label: 'ZnSO4 溶液' }, { x: cx + 26 * sc, label: 'CuSO4 溶液' }];
      }
      for (i = 0; i < cells.length; i++) {
        var cc = cells[i];
        var liq = acid ? 'rgba(168,203,228,.55)'
          : (i === 0 ? 'rgba(210,222,232,.5)' : 'rgba(91,155,213,.52)');
        /* 杯体 */
        box(g, cc.x, baseY - bh, bw, bh, null, INK, 1.6);
        box(g, cc.x + 1, baseY - bh * 0.62, bw - 2, bh * 0.62 - 1, liq, null, 0);
        txt(g, cc.label, cc.x + bw / 2, baseY - 8 * sc, 11 * sc, 'center', 'rgba(38,34,28,.8)');
      }
      /* 盐桥 */
      if (!acid) {
        var lx = cells[0].x + bw, rx = cells[1].x, midY = baseY - bh * 0.36;
        ln(g, lx, midY, rx, midY, INK, 4);
        ln(g, lx, midY, rx, midY, 'rgba(244,241,234,.9)', 2);
        txt(g, '盐桥（饱和 KCl 琼胶）', (lx + rx) / 2, midY - 8 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.75)');
        txt(g, 'K⁺ →', (lx + rx) / 2 + 30 * sc, midY + 13 * sc, 10.5 * sc, 'center', RED);
        txt(g, '← Cl⁻', (lx + rx) / 2 - 30 * sc, midY + 13 * sc, 10.5 * sc, 'center', BLUE);
      }
      /* 电极：左锌 右铜 */
      var ex0 = acid ? (cells[0].x + bw * 0.28) : (cells[0].x + bw * 0.5);
      var ex1 = acid ? (cells[0].x + bw * 0.72) : (cells[1].x + bw * 0.5);
      var eTop = baseY - bh - 62 * sc, eBot = baseY - bh * 0.16;
      var ew = 13 * sc;
      var sand = String(pv(p, 'sand', 'yes'));
      /* 锌片（打磨：亮银；未打磨：灰暗 + 麻点） */
      box(g, ex0 - ew / 2, eTop, ew, eBot - eTop, sand === 'yes' ? ZNG : '#9c9c94', INK, 1.3);
      if (sand === 'no') specks(g, ex0 - ew / 2, eTop, ew, eBot - eTop, 0.55, 'rgba(70,70,64,.6)', 3);
      /* 铜片 */
      box(g, ex1 - ew / 2, eTop, ew, eBot - eTop, '#a9603a', INK, 1.3);
      txt(g, 'Zn（负极）', ex0, eTop - 8 * sc, 11.5 * sc, 'center', INK);
      txt(g, 'Cu（正极）', ex1, eTop - 8 * sc, 11.5 * sc, 'center', INK);
      /* 导线 + 电流计 */
      var wireY = eTop - 30 * sc, gx = (ex0 + ex1) / 2;
      ln(g, ex0, eTop, ex0, wireY, INK, 1.6);
      ln(g, ex1, eTop, ex1, wireY, INK, 1.6);
      ln(g, ex0, wireY, gx - 15 * sc, wireY, INK, 1.6);
      ln(g, ex1, wireY, gx + 15 * sc, wireY, INK, 1.6);
      galv(g, gx, wireY, 14 * sc, '灵敏电流计');
      /* 电子流向箭头：锌 → 铜（左→右），画在导线上方 */
      arrow(g, ex0 + 14 * sc, wireY - 12 * sc, ex1 - 14 * sc, wireY - 12 * sc, RED, 1.6);
      txt(g, 'e⁻ 流向（负极 → 正极）', gx, wireY - 18 * sc, 10.5 * sc, 'center', RED);
      /* 两极现象 */
      var cur = rowVal(row, 'current');
      var bub = isfin(cur) ? clamp(cur / 60, 0.15, 1) : 0.35;
      if (acid) {
        bubbles(g, ex1 - ew, eBot - bh * 0.7, ew * 2.2, bh * 0.55, phase, Math.round(3 + 9 * bub), 'rgba(38,34,28,.5)');
        txt(g, 'H₂↑', ex1 + 20 * sc, eBot - bh * 0.5, 11.5 * sc, 'left', INK);
        txt(g, 'H⁺ →', ex0 + 26 * sc, eBot - bh * 0.42, 11 * sc, 'left', RED);
      } else {
        specks(g, ex1 - ew / 2, eBot - bh * 0.62, ew, bh * 0.5, 0.85, CURED, 5);
        txt(g, 'Cu 析出', ex1 + 16 * sc, eBot - bh * 0.5, 11 * sc, 'left', CURED);
      }
      /* 读数面板 */
      var lines = [
        ['电动势 E = ' + (isfin(rowVal(row, 'emf')) ? fx(rowVal(row, 'emf'), 2) : '—') + ' V', INK],
        ['电流 I = ' + (isfin(cur) ? fx(cur, 1) : '—') + ' mA', RED],
        ['电量 Q = ' + (isfin(rowVal(row, 'q')) ? fx(rowVal(row, 'q'), 1) : '—') + ' C', INK],
        ['m(Zn) = ' + (isfin(rowVal(row, 'znLoss')) ? fx(rowVal(row, 'znLoss'), 1) : '—') + ' mg', INK],
        [acid ? 'V(H₂) = ' + (isfin(rowVal(row, 'h2')) ? fx(rowVal(row, 'h2'), 1) : '—') + ' mL'
          : 'm(Cu) = ' + (isfin(rowVal(row, 'cuGain')) ? fx(rowVal(row, 'cuGain'), 1) : '—') + ' mg', INK]
      ];
      panel(g, w - 214 * sc, 56 * sc, 200 * sc, lines);
      txt(g, '负极（氧化）：Zn - 2e⁻ = Zn²⁺　正极（还原）：' +
        (acid ? '2H⁺ + 2e⁻ = H₂↑' : 'Cu²⁺ + 2e⁻ = Cu'),
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.galv = num(anim.galv, 0) + (isfin(dt) ? dt : 0) * 0.9;
      if (anim.galv > 1e6) anim.galv = 0;
    }
  };

  /* ====================================================================== *
   * 3. 反应 2 · 电解 CuCl₂ 溶液                                            *
   * ====================================================================== */

  var lyseCuCl2 = {
    id: 'electrolysis-cucl2',
    name: '电解 CuCl₂ 溶液',
    group: '电化学',
    aim: '用惰性电极电解 CuCl₂ 溶液，观察阴极析铜、阳极气体的颜色与检验，写出阴、阳极反应式',
    principle: '阴极（与电源负极相连）Cu2+ + 2e- = Cu，析出红色的铜；' +
      '阳极（与电源正极相连，石墨惰性电极）2Cl- - 2e- = Cl2↑，产生黄绿色、有刺激性气味的氯气，' +
      '能使湿润的淀粉碘化钾试纸变蓝；总反应 CuCl2 --通电--> Cu + Cl2↑，' +
      '溶液中 Cu2+ 移向阴极、Cl- 移向阳极。' +
      '若把阳极换成铜棒（活性电极），则阳极是铜失电子溶解（Cu - 2e- = Cu2+），' +
      '阴极仍然是 Cu2+ + 2e- = Cu，总效果相当于铜从阳极转移到阴极、电解质浓度基本不变（电镀/电解精炼原理）。' +
      '通过电量 Q = I·t，阴极析出的铜满足法拉第电解定律 m = M·Q/(2F)。',
    apparatus: ['U 形管', '石墨电极 2 根（或石墨 + 铜棒）', '直流电源', '电流表', '导线',
      '10% CuCl₂ 溶液', '湿润的淀粉碘化钾试纸', '秒表'],
    steps: ['向 U 形管中加入约 2/3 体积的 CuCl₂ 溶液', '插入两根电极，接好直流电源与电流表',
      '接通电源，观察阴极、阳极的现象', '用湿润的淀粉碘化钾试纸靠近阳极管口检验气体',
      '记录通电时间与电流，用 m = M·Q/(2F) 核对阴极析出的铜'],
    params: [
      { key: 'c', label: 'CuCl₂ 溶液浓度', unit: '%', min: 1, max: 20, step: 1, value: 10 },
      { key: 'U', label: '直流电压', unit: 'V', min: 1.5, max: 12, step: 0.5, value: 6 },
      { key: 't', label: '通电时间', unit: 'min', min: 0.5, max: 10, step: 0.5, value: 5 },
      { key: 'anode', label: '阳极材料', type: 'select',
        options: [
          { value: 'graphite', label: '石墨（惰性电极）' },
          { value: 'cu', label: '铜棒（活性电极）' }
        ], value: 'graphite' }
    ],
    react: function (p, ctx) {
      var c = pnum(p, 'c', 10);
      var U = pnum(p, 'U', 6);
      var mins = pnum(p, 't', 5);
      var anode = String(pv(p, 'anode', 'graphite'));
      var inert = (anode !== 'cu');

      /* 分解电压约 1.8 V；溶液电阻随浓度增大而减小 */
      var R = clamp(12 - 0.5 * c, 2.0, 12);            /* Ω */
      var I = clamp((U - 1.8) / R, 0.01, 6);           /* A */
      var Q = I * mins * 60;                           /* C */
      var cuMass = faradayMass(Q, M_CU, 2);            /* mg */
      var cl2 = inert ? faradayGas(Q, 2) : null;       /* mL（标准状况） */
      var anodeLoss = inert ? 0 : cuMass;              /* 活性阳极溶解的铜 */
      /* 溶液中 Cu2+ 剩余百分比：20 mL CuCl2 溶液，c(CuCl2) ≈ 0.0743·c% mol/L */
      var nCu0 = 0.0743 * c * 0.020;                   /* mol */
      var cuRemain = inert
        ? clamp(100 - (cuMass / 1000 / M_CU) / Math.max(nCu0, 1e-9) * 100, 0, 100)
        : 100;

      var ph = [];
      ph.push('阴极石墨棒表面逐渐附着一层红色的铜（Cu²⁺ + 2e⁻ = Cu）');
      if (inert) {
        ph.push('阳极石墨棒上产生大量气泡，气体呈黄绿色、有刺激性气味（Cl₂）');
        ph.push('湿润的淀粉碘化钾试纸靠近阳极管口变蓝，说明阳极产物是 Cl₂');
        ph.push('U 形管中蓝色溶液逐渐变浅（溶液中 c(Cu²⁺) 减小）');
      } else {
        ph.push('阳极铜棒逐渐溶解变细（Cu - 2e⁻ = Cu²⁺），阳极没有气体产生');
        ph.push('溶液中 Cu²⁺ 浓度基本不变，蓝色不褪（总效果是铜从阳极转移到阴极）');
      }
      ph.push('U 形管壁发热，能量转化形式是电能转化为化学能和热能');
      if (c >= 15) ph.push('溶液浓度较大，电阻小、电流大，相同时间内析出的铜更多');
      if (U <= 3) ph.push('电压接近分解电压，电流很小，现象出现得很慢');

      return {
        phenomena: ph,
        equation: 'CuCl2 = Cu + Cl2↑',
        ionic: inert
          ? 'Cu2+ + 2Cl- = Cu + Cl2↑（阴极：Cu2+ + 2e- = Cu，还原；阳极：2Cl- - 2e- = Cl2↑，氧化；Cu2+ 移向阴极、Cl- 移向阳极）'
          : 'Cu + Cu2+ = Cu2+ + Cu（阴极：Cu2+ + 2e- = Cu；阳极：Cu - 2e- = Cu2+；总效果是铜由阳极转移到阴极，电解质浓度不变）',
        ionicNet: inert ? 'Cu2+ + 2Cl- = Cu + Cl2↑' : 'Cu + Cu2+ = Cu2+ + Cu',
        ionicHalf: inert
          ? '阴极（还原）：Cu2+ + 2e- = Cu；阳极（氧化）：2Cl- - 2e- = Cl2↑'
          : '阴极（还原）：Cu2+ + 2e- = Cu；阳极（氧化）：Cu - 2e- = Cu2+',
        electrodes: {
          cathode: 'Cu2+ + 2e- = Cu（还原反应，红色铜析出）',
          anode: inert ? '2Cl- - 2e- = Cl2↑（氧化反应，黄绿色气体）'
            : 'Cu - 2e- = Cu2+（氧化反应，铜棒溶解，无气体）',
          electronFlow: '电子：电源负极 → 阴极；阳极 → 电源正极（溶液中由 Cu2+、Cl- 定向移动导电）',
          ionFlow: '阳离子 Cu2+ 移向阴极，阴离子 Cl- 移向阳极'
        },
        type: inert ? '电解池（电能转化为化学能，惰性电极）' : '电解池（活性阳极：电镀/电解精炼原理）',
        conditions: inert ? '直流电源通电，石墨作阴、阳极（惰性电极）' : '直流电源通电，铜棒作阳极（活性电极）、石墨作阴极',
        measures: {
          current: I, q: Q, cuMass: cuMass, cl2: cl2,
          anodeLoss: anodeLoss, cuRemain: cuRemain
        }
      };
    },
    columns: [
      { key: 'current', label: '电流', unit: 'A' },
      { key: 'q', label: '通过电量', unit: 'C' },
      { key: 'cuMass', label: '阴极析出铜', unit: 'mg' },
      { key: 'cl2', label: '阳极 Cl₂ 体积', unit: 'mL' },
      { key: 'anodeLoss', label: '阳极溶解（铜棒）', unit: 'mg' },
      { key: 'cuRemain', label: '溶液剩余 Cu²⁺', unit: '%' }
    ],
    graph: {
      x: 'q', y: 'cuMass', fit: 'origin',
      title: '阴极析出铜质量–通过电量 图线（法拉第电解定律 m = M·Q/(2F)）',
      note: '扫"通电时间"：电量 Q = I·t 越大，阴极析出的铜越多，过原点直线，' +
        '斜率 = M(Cu)/(2F) = 0.329 mg/C。'
    },
    conclude: function (rows, p) {
      var inert = String(pv(p, 'anode', 'graphite')) !== 'cu';
      var n = rows ? rows.length : 0;
      return {
        text: '用惰性电极电解 CuCl₂ 溶液时，阴极上 Cu²⁺ 得电子析出红色的铜，' +
          '阳极上 Cl⁻ 失电子生成黄绿色、有刺激性气味的 Cl₂（能使湿润的淀粉碘化钾试纸变蓝），' +
          '总反应 CuCl2 = Cu + Cl2↑；溶液中 Cu²⁺ 移向阴极、Cl⁻ 移向阳极。' +
          (inert ? '' : '本实验改用铜棒作阳极，阳极铜溶解、阴极析铜，电解质浓度基本不变。') +
          '共记录 ' + n + ' 组数据，阴极析出铜的质量与通过电量成正比（m = M·Q/(2F)）。',
        equation: 'CuCl2 = Cu + Cl2↑',
        ionic: inert
          ? 'Cu2+ + 2Cl- = Cu + Cl2↑（阴极：Cu2+ + 2e- = Cu；阳极：2Cl- - 2e- = Cl2↑）'
          : 'Cu + Cu2+ = Cu2+ + Cu（阴极：Cu2+ + 2e- = Cu；阳极：Cu - 2e- = Cu2+；铜由阳极转移到阴极）',
        errors: [
          '通电时间计时误差直接按比例影响电量与析出铜的质量（Q = I·t）',
          '阴极析出的铜可能部分脱落沉入溶液，称量结果偏小',
          'Cl₂ 在水中部分溶解并发生 Cl2 + H2O ⇌ H+ + Cl- + HClO，量气管读数偏小',
          '溶液浓度大时 Cu²⁺ 与 Cl⁻ 形成 [CuCl4]²⁻，溶液变黄绿色，会干扰颜色的判断',
          '电流表读数随时间略有波动（极化和温度升高），应取平均电流'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var inert = String(pv(p, 'anode', 'graphite')) !== 'cu';
      var row = lastRow(state);
      var ph = num(anim.lyse, 0), w = S.w, h = S.h;
      var cx = w / 2, tubeW = 230 * sc, tubeH = 170 * sc, top = 108 * sc;
      var left = cx - tubeW / 2;
      paperTitle(g, '电解 CuCl₂ 溶液（' + (inert ? '石墨惰性电极' : '铜棒活性阳极') + '）',
        '阴极：Cu²⁺ + 2e⁻ = Cu　·　阳极：' + (inert ? '2Cl⁻ - 2e⁻ = Cl₂↑' : 'Cu - 2e⁻ = Cu²⁺ → 阴极析铜'));
      /* U 形管 */
      var uw = 26 * sc;
      ln(g, left, top, left, top + tubeH - 40 * sc, INK, 1.6);
      ln(g, left + uw, top, left + uw, top + tubeH - 70 * sc, INK, 1.6);
      ln(g, left + tubeW - uw, top, left + tubeW - uw, top + tubeH - 70 * sc, INK, 1.6);
      ln(g, left + tubeW, top, left + tubeW, top + tubeH - 40 * sc, INK, 1.6);
      var c2 = ctxOf(g);
      if (c2) {
        c2.save();
        c2.beginPath();
        c2.moveTo(left + 1, top + 24 * sc);
        c2.lineTo(left + 1, top + tubeH - 46 * sc);
        c2.quadraticCurveTo(left + 1, top + tubeH - 20 * sc, cx, top + tubeH - 20 * sc);
        c2.quadraticCurveTo(left + tubeW - 1, top + tubeH - 20 * sc, left + tubeW - 1, top + tubeH - 46 * sc);
        c2.lineTo(left + tubeW - 1, top + 24 * sc);
        c2.closePath();
        c2.fillStyle = 'rgba(91,155,213,.5)';
        c2.fill();
        c2.restore();
      }
      /* 电极：左阴极(石墨) 右阳极 */
      var eTop = top - 34 * sc, eBot = top + tubeH - 52 * sc;
      var xL = left + uw / 2, xR = left + tubeW - uw / 2, ew = 11 * sc;
      box(g, xL - ew / 2, eTop, ew, eBot - eTop, '#5a5a56', INK, 1.2);
      box(g, xR - ew / 2, eTop, ew, eBot - eTop, inert ? '#5a5a56' : '#a9603a', INK, 1.2);
      txt(g, '阴极 C', xL, eTop - 8 * sc, 11.5 * sc, 'center', INK);
      txt(g, inert ? '阳极 C' : '阳极 Cu', xR, eTop - 8 * sc, 11.5 * sc, 'center', INK);
      /* 电源 */
      var psY = eTop - 52 * sc;
      dcSource(g, cx, psY, '直流电源 ' + fx(pnum(p, 'U', 6), 1) + ' V');
      ln(g, xL, eTop, xL, psY, INK, 1.6);
      ln(g, xR, eTop, xR, psY, INK, 1.6);
      ln(g, xL, psY, cx - 16 * sc, psY, INK, 1.6);
      ln(g, xR, psY, cx + 16 * sc, psY, INK, 1.6);
      txt(g, '－', cx - 26 * sc, psY - 12 * sc, 13 * sc, 'center', BLUE);
      txt(g, '＋', cx + 26 * sc, psY - 12 * sc, 13 * sc, 'center', RED);
      /* 现象 */
      var cur = rowVal(row, 'current');
      var amp = isfin(cur) ? clamp(cur, 0.05, 2) : 0.4;
      specks(g, xL - ew / 2 - 1, eBot - 60 * sc, ew + 2, 56 * sc, 0.9, CURED, 7);
      if (inert) {
        bubbles(g, xR - ew, eBot - 84 * sc, ew * 2.4, 70 * sc, ph, Math.round(4 + 9 * amp), 'rgba(120,150,40,.75)');
        txt(g, 'Cl₂（黄绿色）', xR + 14 * sc, eBot - 80 * sc, 11 * sc, 'left', 'rgba(110,130,20,.95)');
        /* 淀粉碘化钾试纸 */
        var px = xR + 16 * sc, py = eTop + 6 * sc;
        box(g, px, py, 34 * sc, 20 * sc, 'rgba(255,255,255,.92)', INK, 1.1, 2);
        txt(g, 'KI 淀粉试纸变蓝', px + 17 * sc, py + 32 * sc, 10 * sc, 'center', 'rgba(40,60,120,.9)');
      } else {
        txt(g, '铜棒溶解', xR + 14 * sc, eBot - 74 * sc, 11 * sc, 'left', CURED);
        arrow(g, xR + 12 * sc, eBot - 50 * sc, xR + 12 * sc, eBot - 66 * sc, CURED, 1.3);
      }
      txt(g, 'Cu 析出（红色）', xL - 16 * sc, eBot - 74 * sc, 11 * sc, 'right', CURED);
      var lines = [
        ['电流 I = ' + (isfin(cur) ? fx(cur, 2) : '—') + ' A', INK],
        ['电量 Q = ' + (isfin(rowVal(row, 'q')) ? fx(rowVal(row, 'q'), 1) : '—') + ' C', INK],
        ['m(Cu) = ' + (isfin(rowVal(row, 'cuMass')) ? fx(rowVal(row, 'cuMass'), 1) : '—') + ' mg', CURED],
        ['V(Cl₂) = ' + (isfin(rowVal(row, 'cl2')) ? fx(rowVal(row, 'cl2'), 1) : '—') + ' mL', 'rgba(110,130,20,.95)'],
        ['剩余 Cu²⁺ ≈ ' + (isfin(rowVal(row, 'cuRemain')) ? fx(rowVal(row, 'cuRemain'), 1) : '—') + ' %', BLUE]
      ];
      panel(g, w - 206 * sc, 56 * sc, 192 * sc, lines);
      txt(g, inert ? '阳极（氧化）：2Cl⁻ - 2e⁻ = Cl₂↑　阴极（还原）：Cu²⁺ + 2e⁻ = Cu'
        : '阳极（氧化）：Cu - 2e⁻ = Cu²⁺　阴极（还原）：Cu²⁺ + 2e⁻ = Cu',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.lyse = num(anim.lyse, 0) + (isfin(dt) ? dt : 0) * 1.1;
      if (anim.lyse > 1e6) anim.lyse = 0;
    }
  };

  /* ====================================================================== *
   * 4. 反应 3 · 电解饱和食盐水                                             *
   * ====================================================================== */

  var brine = {
    id: 'electrolysis-brine',
    name: '电解饱和食盐水（氯碱工业原理）',
    group: '电化学',
    aim: '电解饱和食盐水，检验 H₂、Cl₂ 与阴极区生成的 NaOH，写出电极反应式与总反应',
    principle: '阴极：2H2O + 2e- = H2↑ + 2OH-（水电离出的 H+ 得电子，阴极区 c(OH-) 增大，滴酚酞变红）；' +
      '阳极：2Cl- - 2e- = Cl2↑（黄绿色、有刺激性气味，能使湿润的淀粉碘化钾试纸变蓝）；' +
      '总反应 2NaCl + 2H2O --通电--> 2NaOH + H2↑ + Cl2↑（离子方程式 2Cl- + 2H2O = H2↑ + Cl2↑ + 2OH-）。' +
      '溶液中 Na+ 移向阴极、Cl- 移向阳极；H₂ 与 Cl₂ 的体积比为 1∶1（同温同压下），' +
      '生成 NaOH 的物质的量等于转移电子的物质的量（n(NaOH) = Q/F）。',
    apparatus: ['U 形管（或电解槽）', '石墨电极 2 根', '直流电源', '导线', '饱和食盐水',
      '酚酞溶液', '湿润的淀粉碘化钾试纸', '小试管（收集气体）', '秒表'],
    steps: ['向 U 形管中加入饱和食盐水，两边各滴入几滴酚酞溶液',
      '插入石墨电极，接通直流电源', '观察阴极区颜色变化与两极气体',
      '用湿润的淀粉碘化钾试纸检验阳极气体，用小试管收集阴极气体并验纯点燃',
      '记录电流与通电时间，计算 H₂、Cl₂ 体积与生成 NaOH 的量'],
    params: [
      { key: 'U', label: '直流电压', unit: 'V', min: 3, max: 12, step: 0.5, value: 6 },
      { key: 't', label: '通电时间', unit: 'min', min: 1, max: 30, step: 1, value: 8 },
      { key: 'temp', label: '温度', unit: '℃', min: 10, max: 60, step: 1, value: 25 },
      { key: 'indicator', label: '阴极区指示剂', type: 'select',
        options: [
          { value: 'phenolphthalein', label: '滴加酚酞溶液' },
          { value: 'none', label: '不加指示剂' }
        ], value: 'phenolphthalein' }
    ],
    react: function (p, ctx) {
      var U = pnum(p, 'U', 6);
      var mins = pnum(p, 't', 8);
      var temp = pnum(p, 'temp', 25);
      var ind = String(pv(p, 'indicator', 'phenolphthalein'));

      var R = 5.0 * (1 - 0.006 * (temp - 25));         /* Ω，温度升高电阻减小 */
      R = clamp(R, 2.0, 8.0);
      var I = clamp((U - 2.2) / R, 0.01, 6);           /* A */
      var Q = I * mins * 60;
      var h2 = faradayGas(Q, 2);
      var cl2 = faradayGas(Q, 2);
      var naoh = Q / F * 1000;                          /* mmol */
      var vCath = 0.020;                                /* L，阴极区溶液体积 */
      var cOH = naoh / 1000 / vCath;                    /* mol/L */

      var ph = [];
      ph.push('阴极（铁棒/石墨）表面产生大量气泡，气体为 H₂（点燃发出爆鸣声）');
      ph.push('阳极（石墨）产生黄绿色、有刺激性气味的气体 Cl₂');
      ph.push('湿润的淀粉碘化钾试纸靠近阳极管口变蓝，说明 Cl₂ 有氧化性');
      if (ind === 'phenolphthalein') ph.push('阴极区溶液变红（酚酞），说明阴极区生成 NaOH、显碱性');
      else ph.push('未加指示剂，需用 pH 试纸检验阴极区溶液显碱性');
      ph.push('H₂ 与 Cl₂ 的体积比约为 1∶1，阴极区 c(OH⁻) 不断增大');
      if (temp >= 45) ph.push('温度较高，溶液电阻小、电流大，产气明显加快');
      if (U >= 10) ph.push('电压较高，电流明显增大（注意电解液发热与 Cl₂ 逸出）');
      if (Q < 30) ph.push('通电时间短，两极气体还很少，现象不明显');

      return {
        phenomena: ph,
        equation: '2NaCl + 2H2O = 2NaOH + H2↑ + Cl2↑',
        ionic: '2Cl- + 2H2O = H2↑ + Cl2↑ + 2OH-（阴极：2H2O + 2e- = H2↑ + 2OH-；阳极：2Cl- - 2e- = Cl2↑；Na+ 移向阴极、Cl- 移向阳极）',
        ionicNet: '2Cl- + 2H2O = H2↑ + Cl2↑ + 2OH-',
        ionicHalf: '阴极（还原）：2H2O + 2e- = H2↑ + 2OH-；阳极（氧化）：2Cl- - 2e- = Cl2↑',
        electrodes: {
          cathode: '2H2O + 2e- = H2↑ + 2OH-（也可写 2H+ + 2e- = H2↑，H+ 来自水的电离）',
          anode: '2Cl- - 2e- = Cl2↑（氧化反应）',
          electronFlow: '电子：电源负极 → 阴极；阳极 → 电源正极',
          ionFlow: '阳离子 Na+、H+ 移向阴极；阴离子 Cl-、OH- 移向阳极'
        },
        type: '电解池（氯碱工业：电解饱和食盐水）',
        conditions: '直流电源通电，石墨惰性电极，饱和食盐水，阴极区滴酚酞检验碱性',
        measures: { current: I, q: Q, h2: h2, cl2: cl2, naoh: naoh, cOH: cOH }
      };
    },
    columns: [
      { key: 'current', label: '电流', unit: 'A' },
      { key: 'q', label: '通过电量', unit: 'C' },
      { key: 'h2', label: '阴极 H₂ 体积', unit: 'mL' },
      { key: 'cl2', label: '阳极 Cl₂ 体积', unit: 'mL' },
      { key: 'naoh', label: '生成 NaOH', unit: 'mmol' },
      { key: 'cOH', label: '阴极区 c(OH⁻)', unit: 'mol/L' }
    ],
    graph: {
      x: 'q', y: 'naoh', fit: 'origin',
      title: '生成 NaOH 物质的量–通过电量 图线（n(NaOH) = Q/F）',
      note: '扫"通电时间"：电量 Q = I·t 越大，阴极区生成的 NaOH 越多；' +
        '过原点直线，斜率 = 1/F = 0.01036 mmol/C。'
    },
    conclude: function (rows, p) {
      var n = rows ? rows.length : 0;
      return {
        text: '电解饱和食盐水时，阴极上水电离出的 H⁺ 得电子放出 H₂，同时留下 OH⁻，' +
          '阴极区显碱性（酚酞变红）；阳极上 Cl⁻ 失电子生成 Cl₂（能使湿润的淀粉碘化钾试纸变蓝）。' +
          '总反应 2NaCl + 2H2O = 2NaOH + H2↑ + Cl2↑，H₂ 与 Cl₂ 体积比 1∶1。' +
          '共记录 ' + n + ' 组数据：生成的 NaOH 与通过电量成正比（n(NaOH) = Q/F），符合法拉第电解定律。',
        equation: '2NaCl + 2H2O = 2NaOH + H2↑ + Cl2↑',
        ionic: '2Cl- + 2H2O = H2↑ + Cl2↑ + 2OH-（阴极：2H2O + 2e- = H2↑ + 2OH-；阳极：2Cl- - 2e- = Cl2↑）',
        errors: [
          'Cl₂ 在饱和食盐水中部分溶解（并发生 Cl2 + H2O ⇌ H+ + Cl- + HClO），收集到的 Cl₂ 体积偏小',
          'H₂ 与 Cl₂ 体积比读数受温度、压强影响，两管收集时间不同步会造成偏差',
          '阴极区滴加酚酞后需静置观察，溶液扩散会使红色区边界模糊、判断不准',
          '电流随电解发热与浓度变化而波动，取单一电流值计算电量会有偏差',
          'Cl₂ 有毒，必须在通风处进行并用 NaOH 溶液吸收尾气'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var ind = String(pv(p, 'indicator', 'phenolphthalein'));
      var row = lastRow(state);
      var ph = num(anim.brine, 0), w = S.w, h = S.h;
      var cx = w / 2, top = 108 * sc, tubeW = 250 * sc, tubeH = 176 * sc, uw = 28 * sc;
      var left = cx - tubeW / 2;
      paperTitle(g, '电解饱和食盐水（氯碱工业）',
        '阴极：2H₂O + 2e⁻ = H₂↑ + 2OH⁻　·　阳极：2Cl⁻ - 2e⁻ = Cl₂↑');
      /* U 形管 + 溶液 */
      var c2 = ctxOf(g);
      ln(g, left, top, left, top + tubeH - 40 * sc, INK, 1.6);
      ln(g, left + uw, top, left + uw, top + tubeH - 74 * sc, INK, 1.6);
      ln(g, left + tubeW - uw, top, left + tubeW - uw, top + tubeH - 74 * sc, INK, 1.6);
      ln(g, left + tubeW, top, left + tubeW, top + tubeH - 40 * sc, INK, 1.6);
      if (c2) {
        c2.save();
        c2.beginPath();
        c2.moveTo(left + 1, top + 22 * sc);
        c2.lineTo(left + 1, top + tubeH - 46 * sc);
        c2.quadraticCurveTo(left + 1, top + tubeH - 20 * sc, cx, top + tubeH - 20 * sc);
        c2.quadraticCurveTo(left + tubeW - 1, top + tubeH - 20 * sc, left + tubeW - 1, top + tubeH - 46 * sc);
        c2.lineTo(left + tubeW - 1, top + 22 * sc);
        c2.closePath();
        c2.fillStyle = 'rgba(200,214,226,.6)';
        c2.fill();
        c2.restore();
      }
      /* 阴极区碱性（酚酞红） */
      var qv = rowVal(row, 'q');
      var redW = isfin(qv) ? clamp(6 + qv * 0.12, 6, uw - 3) : 8 * sc;
      if (ind === 'phenolphthalein') {
        box(g, left + 2, top + 26 * sc, redW, tubeH - 108 * sc, 'rgba(217,96,127,.45)', null, 0);
        txt(g, '阴极区变红', left + 8 * sc, top + tubeH - 62 * sc, 10.5 * sc, 'left', 'rgba(180,40,70,.95)');
      }
      /* 电极 */
      var eTop = top - 34 * sc, eBot = top + tubeH - 56 * sc;
      var xL = left + uw / 2, xR = left + tubeW - uw / 2, ew = 11 * sc;
      box(g, xL - ew / 2, eTop, ew, eBot - eTop, '#4f4f4b', INK, 1.2);
      box(g, xR - ew / 2, eTop, ew, eBot - eTop, '#4f4f4b', INK, 1.2);
      txt(g, '阴极 C（－）', xL, eTop - 8 * sc, 11.5 * sc, 'center', INK);
      txt(g, '阳极 C（＋）', xR, eTop - 8 * sc, 11.5 * sc, 'center', INK);
      /* 电源 */
      var psY = eTop - 52 * sc;
      dcSource(g, cx, psY, '直流电源 ' + fx(pnum(p, 'U', 6), 1) + ' V');
      ln(g, xL, eTop, xL, psY, INK, 1.6);
      ln(g, xR, eTop, xR, psY, INK, 1.6);
      ln(g, xL, psY, cx - 16 * sc, psY, INK, 1.6);
      ln(g, xR, psY, cx + 16 * sc, psY, INK, 1.6);
      txt(g, '－', cx - 27 * sc, psY - 12 * sc, 13 * sc, 'center', BLUE);
      txt(g, '＋', cx + 27 * sc, psY - 12 * sc, 13 * sc, 'center', RED);
      /* 气泡 */
      var cur = rowVal(row, 'current');
      var amp = isfin(cur) ? clamp(cur, 0.05, 2) : 0.4;
      bubbles(g, xL - ew, eBot - 92 * sc, ew * 2.4, 82 * sc, ph, Math.round(5 + 10 * amp), 'rgba(38,34,28,.5)');
      bubbles(g, xR - ew, eBot - 92 * sc, ew * 2.4, 82 * sc, ph + 0.4, Math.round(5 + 10 * amp), 'rgba(120,150,40,.8)');
      txt(g, 'H₂↑', xL - 18 * sc, eBot - 96 * sc, 12 * sc, 'right', INK);
      txt(g, 'Cl₂↑', xR + 18 * sc, eBot - 96 * sc, 12 * sc, 'left', 'rgba(110,130,20,.95)');
      /* 试纸 */
      var px = xR + 20 * sc, py = eTop + 10 * sc;
      box(g, px, py, 34 * sc, 20 * sc, 'rgba(255,255,255,.92)', INK, 1.1, 2);
      txt(g, 'KI 淀粉试纸 → 变蓝', px + 17 * sc, py + 33 * sc, 10 * sc, 'center', 'rgba(40,60,120,.9)');
      var lines = [
        ['电流 I = ' + (isfin(cur) ? fx(cur, 2) : '—') + ' A', INK],
        ['电量 Q = ' + (isfin(qv) ? fx(qv, 1) : '—') + ' C', INK],
        ['V(H₂) = ' + (isfin(rowVal(row, 'h2')) ? fx(rowVal(row, 'h2'), 1) : '—') + ' mL', INK],
        ['V(Cl₂) = ' + (isfin(rowVal(row, 'cl2')) ? fx(rowVal(row, 'cl2'), 1) : '—') + ' mL', 'rgba(110,130,20,.95)'],
        ['n(NaOH) = ' + (isfin(rowVal(row, 'naoh')) ? fx(rowVal(row, 'naoh'), 2) : '—') + ' mmol', PINK],
        ['c(OH⁻)阴极区 = ' + (isfin(rowVal(row, 'cOH')) ? fx(rowVal(row, 'cOH'), 3) : '—') + ' mol/L', PINK]
      ];
      panel(g, w - 214 * sc, 56 * sc, 200 * sc, lines);
      txt(g, '总反应：2NaCl + 2H₂O --通电--> 2NaOH + H₂↑ + Cl₂↑（n(NaOH) = Q/F）',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.brine = num(anim.brine, 0) + (isfin(dt) ? dt : 0) * 1.2;
      if (anim.brine > 1e6) anim.brine = 0;
    }
  };

  /* ====================================================================== *
   * 5. 反应 4 · 电镀                                                       *
   * ====================================================================== */

  var plating = {
    id: 'electroplating',
    name: '电镀（铁上镀铜 / 镀锌）',
    group: '电化学',
    aim: '在铁件上电镀铜（或锌），观察镀层与阳极变化，写出阴、阳极反应式并理解电镀液浓度不变',
    principle: '电镀时镀件作阴极、镀层金属作阳极、含镀层金属离子的溶液作电镀液：' +
      '镀铜阳极 Cu - 2e- = Cu2+、阴极 Cu2+ + 2e- = Cu；镀锌阳极 Zn - 2e- = Zn2+、阴极 Zn2+ + 2e- = Zn。' +
      '阳极溶解的金属离子在阴极析出，电镀液中金属离子浓度基本不变（总效果是金属由阳极转移到阴极）。' +
      '镀层质量满足 m = M·Q/(nF)（Q = I·t）；电流密度过大会使镀层粗糙、电流效率下降（η < 100%）。',
    apparatus: ['烧杯（电镀槽）', '铁件（镀件，阴极）', '铜片/锌片（阳极）', 'CuSO₄ 或 ZnSO₄ 电镀液',
      '直流电源', '电流表', '导线', '砂纸', '秒表', '天平'],
    steps: ['用砂纸把铁件表面打磨光亮、除油', '把铁件接电源负极作阴极，铜（锌）片接正极作阳极，浸入电镀液',
      '接通电源，调节电流，观察镀件表面与阳极的变化', '通电到设定时间后取出镀件，洗净干燥后称量镀层质量',
      '用 m = M·Q/(nF) 核对镀层质量并计算镀层厚度'],
    params: [
      { key: 'metal', label: '镀层金属', type: 'select',
        options: [
          { value: 'cu', label: '镀铜（CuSO₄ 电镀液）' },
          { value: 'zn', label: '镀锌（ZnSO₄ 电镀液）' }
        ], value: 'cu' },
      { key: 'current', label: '电镀电流', unit: 'A', min: 0.1, max: 2.0, step: 0.1, value: 0.5 },
      { key: 't', label: '电镀时间', unit: 'min', min: 1, max: 30, step: 1, value: 10 },
      { key: 'area', label: '镀件面积', unit: 'cm²', min: 1, max: 20, step: 1, value: 6 }
    ],
    react: function (p, ctx) {
      var metal = String(pv(p, 'metal', 'cu'));
      var I = pnum(p, 'current', 0.5);
      var mins = pnum(p, 't', 10);
      var area = pnum(p, 'area', 6);
      var isCu = (metal !== 'zn');
      var M = isCu ? M_CU : M_ZN;
      var name = isCu ? '铜' : '锌';
      var rho = isCu ? 8.96 : 7.14;                     /* g/cm³ */

      var j = I / Math.max(area, 0.2);                  /* A/cm² 电流密度 */
      var eff = clamp(1 / (1 + 0.35 * Math.pow(clamp(j, 0, 4), 1.2)), 0.5, 0.995);
      var Q = I * mins * 60;
      var coat = faradayMass(Q, M, 2) * eff;            /* mg */
      var thickness = (coat / 1000) / (rho * area) * 1e4; /* μm */
      var anodeLoss = coat / eff;                       /* mg，阳极溶解量 */
      var cChange = 0;                                  /* 电镀液浓度基本不变 */

      var ph = [];
      ph.push('镀件（铁件，阴极）表面逐渐覆盖一层' + (isCu ? '红色的铜' : '银白色（灰白色）的锌'));
      ph.push((isCu ? '铜片' : '锌片') + '（阳极）逐渐溶解变薄（' +
        (isCu ? 'Cu - 2e- = Cu2+' : 'Zn - 2e- = Zn2+') + '）');
      ph.push('电镀液中 ' + (isCu ? 'Cu2+' : 'Zn2+') + ' 浓度基本不变（阳极溶解补充阴极消耗），溶液颜色不变');
      ph.push('镀层致密、光亮时电流密度较小；电流密度过大时镀层粗糙、发暗');
      if (!isCu) ph.push('镀锌层是牺牲阳极的阴极保护层：锌比铁活泼，破损后先腐蚀锌，保护铁');
      if (j > 0.25) ph.push('电流密度偏大（' + fx(j, 2) + ' A/cm²），镀层质量变差、电流效率下降到 ' + fx(eff * 100, 1) + '%');
      else ph.push('电流密度较小（' + fx(j, 2) + ' A/cm²），电流效率约 ' + fx(eff * 100, 1) + '%，镀层较均匀');

      return {
        phenomena: ph,
        equation: isCu ? 'Cu + Cu2+ = Cu2+ + Cu' : 'Zn + Zn2+ = Zn2+ + Zn',
        ionic: isCu
          ? 'Cu + Cu2+ = Cu2+ + Cu（阳极：Cu - 2e- = Cu2+，氧化；阴极：Cu2+ + 2e- = Cu，还原；电镀液中 Cu2+ 浓度基本不变）'
          : 'Zn + Zn2+ = Zn2+ + Zn（阳极：Zn - 2e- = Zn2+，氧化；阴极：Zn2+ + 2e- = Zn，还原；电镀液中 Zn2+ 浓度基本不变）',
        ionicNet: isCu ? 'Cu + Cu2+ = Cu2+ + Cu' : 'Zn + Zn2+ = Zn2+ + Zn',
        ionicHalf: isCu
          ? '阳极（氧化）：Cu - 2e- = Cu2+；阴极（还原）：Cu2+ + 2e- = Cu'
          : '阳极（氧化）：Zn - 2e- = Zn2+；阴极（还原）：Zn2+ + 2e- = Zn',
        electrodes: {
          cathode: isCu ? 'Cu2+ + 2e- = Cu（镀件上析出铜）' : 'Zn2+ + 2e- = Zn（镀件上析出锌）',
          anode: isCu ? 'Cu - 2e- = Cu2+（铜阳极溶解补充 Cu2+）' : 'Zn - 2e- = Zn2+（锌阳极溶解补充 Zn2+）',
          electronFlow: '电子：电源负极 → 镀件（阴极）；阳极 → 电源正极',
          ionFlow: '阳离子 ' + (isCu ? 'Cu2+' : 'Zn2+') + ' 移向阴极（镀件），阴离子 SO4^2- 移向阳极'
        },
        type: '电解池（电镀：电能转化为化学能，阳极是镀层金属）',
        conditions: '直流电源通电，镀件作阴极、' + name + '片作阳极，' + (isCu ? 'CuSO4' : 'ZnSO4') + ' 溶液作电镀液',
        note: '电镀的总变化是"镀层金属由阳极转移到阴极"（阳极溶解多少、阴极就析出多少，' +
          '电镀液浓度基本不变），所以 equation 写成 ' + (isCu ? 'Cu + Cu2+ = Cu2+ + Cu' : 'Zn + Zn2+ = Zn2+ + Zn') +
          ' 表示这个转移；两极的电极反应式见 ionic 与 ionicHalf',
        measures: {
          current: I, j: j, q: Q, coat: coat, thickness: thickness,
          anodeLoss: anodeLoss, efficiency: eff * 100, cChange: cChange
        }
      };
    },
    columns: [
      { key: 'q', label: '通过电量', unit: 'C' },
      { key: 'j', label: '电流密度', unit: 'A/cm²' },
      { key: 'coat', label: '镀层质量', unit: 'mg' },
      { key: 'thickness', label: '镀层厚度', unit: 'μm' },
      { key: 'anodeLoss', label: '阳极溶解', unit: 'mg' },
      { key: 'efficiency', label: '电流效率', unit: '%' },
      { key: 'cChange', label: '电镀液浓度变化', unit: 'mol/L' }
    ],
    graph: {
      x: 'q', y: 'coat', fit: 'origin',
      title: '镀层质量–通过电量 图线（m = η·M·Q/(2F)）',
      note: '扫"电镀时间"：Q = I·t 越大，镀层越厚（成正比）；过原点直线。' +
        '电流密度大时电流效率 η 下降，图线斜率会变小。'
    },
    conclude: function (rows, p) {
      var isCu = String(pv(p, 'metal', 'cu')) !== 'zn';
      var n = rows ? rows.length : 0;
      return {
        text: '电镀是应用电解原理在镀件表面覆盖一层金属：镀件作阴极、' +
          (isCu ? '铜' : '锌') + '片作阳极、' + (isCu ? 'CuSO4' : 'ZnSO4') + ' 溶液作电镀液。' +
          '阳极 ' + (isCu ? 'Cu - 2e- = Cu2+' : 'Zn - 2e- = Zn2+') + '，阴极 ' +
          (isCu ? 'Cu2+ + 2e- = Cu' : 'Zn2+ + 2e- = Zn') +
          '，阳极溶解的金属离子在阴极析出，电镀液中离子浓度基本不变。' +
          '共记录 ' + n + ' 组数据：镀层质量与通过电量成正比（m = η·M·Q/(nF)），镀层厚度由质量和面积算出。',
        equation: isCu ? 'Cu + Cu2+ = Cu2+ + Cu' : 'Zn + Zn2+ = Zn2+ + Zn',
        ionic: isCu
          ? 'Cu + Cu2+ = Cu2+ + Cu（阳极：Cu - 2e- = Cu2+；阴极：Cu2+ + 2e- = Cu；电镀液浓度不变）'
          : 'Zn + Zn2+ = Zn2+ + Zn（阳极：Zn - 2e- = Zn2+；阴极：Zn2+ + 2e- = Zn；电镀液浓度不变）',
        errors: [
          '镀件表面除油、除锈不彻底，镀层结合力差、易起皮，称量的镀层质量偏低',
          '电流密度过大使镀层粗糙、甚至出现海绵状沉积，电流效率下降、厚度不均匀',
          '通电时间与电流读数误差按比例传递到镀层质量（Q = I·t）',
          '取出镀件时表面附着电镀液，未充分洗涤干燥会使称量结果偏大',
          '镀层厚度按"质量/(密度×面积)"估算，实际镀层密度与分布不均会带来偏差'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var isCu = String(pv(p, 'metal', 'cu')) !== 'zn';
      var row = lastRow(state);
      var ph = num(anim.plate, 0), w = S.w, h = S.h;
      var cx = w / 2, tankW = 250 * sc, tankH = 150 * sc, baseY = h - 66 * sc;
      var left = cx - tankW / 2, top = baseY - tankH;
      paperTitle(g, '电镀（铁上镀' + (isCu ? '铜' : '锌') + '）',
        '镀件作阴极：' + (isCu ? 'Cu²⁺ + 2e⁻ = Cu' : 'Zn²⁺ + 2e⁻ = Zn') +
        '　·　阳极：' + (isCu ? 'Cu - 2e⁻ = Cu²⁺' : 'Zn - 2e⁻ = Zn²⁺'));
      /* 镀槽 */
      box(g, left, top, tankW, tankH, null, INK, 1.6);
      box(g, left + 1, top + tankH * 0.22, tankW - 2, tankH * 0.78 - 1,
        isCu ? 'rgba(91,155,213,.5)' : 'rgba(205,214,220,.55)', null, 0);
      txt(g, (isCu ? 'CuSO₄' : 'ZnSO₄') + ' 电镀液（浓度基本不变）',
        cx, baseY - 10 * sc, 11 * sc, 'center', 'rgba(38,34,28,.78)');
      /* 电极 */
      var eTop = top - 52 * sc, eBot = baseY - tankH * 0.14;
      var xL = left + tankW * 0.28, xR = left + tankW * 0.72, ew = 12 * sc;
      /* 阴极：铁件（先灰后镀上金属） */
      var qv = rowVal(row, 'q');
      var cov = isfin(qv) ? clamp(6 + qv * 0.05, 6, 99) : (isfin(rowVal(row, 'thickness')) ? clamp(rowVal(row, 'thickness') * 3, 6, 99) : 6);
      var ew2 = ew * (1 + cov / 100);
      box(g, xL - ew2 / 2, eBot - 74 * sc, ew2, 74 * sc, '#8b8b86', INK, 1.2);
      box(g, xL - ew2 / 2, eBot - 74 * sc * (cov / 100), ew2, 74 * sc * (cov / 100),
        isCu ? CURED : ZNG, null, 0);
      txt(g, '镀件（铁，阴极 －）', xL, eTop + 4 * sc, 11.5 * sc, 'center', INK);
      /* 阳极：镀层金属片（随电量变薄） */
      var loss = isfin(rowVal(row, 'anodeLoss')) ? rowVal(row, 'anodeLoss') : 0;
      var thin = clamp(74 - loss * 0.35, 26, 74) * sc;
      box(g, xR - ew / 2, eBot - thin, ew, thin, isCu ? '#a9603a' : ZNG, INK, 1.2);
      txt(g, (isCu ? '铜片' : '锌片') + '（阳极 ＋）', xR, eTop + 4 * sc, 11.5 * sc, 'center', INK);
      /* 电源 */
      var psY = eTop - 26 * sc;
      dcSource(g, cx, psY, '直流电源');
      ln(g, xL, eTop, xL, psY, INK, 1.6);
      ln(g, xR, eTop, xR, psY, INK, 1.6);
      ln(g, xL, psY, cx - 16 * sc, psY, INK, 1.6);
      ln(g, xR, psY, cx + 16 * sc, psY, INK, 1.6);
      txt(g, '－', cx - 27 * sc, psY - 12 * sc, 13 * sc, 'center', BLUE);
      txt(g, '＋', cx + 27 * sc, psY - 12 * sc, 13 * sc, 'center', RED);
      /* 离子迁移 + 镀层小气泡/离子示意 */
      var amp = isfin(rowVal(row, 'current')) ? clamp(rowVal(row, 'current'), 0.1, 2) : 0.5;
      arrow(g, cx - 40 * sc, top + tankH * 0.5, xL + ew, top + tankH * 0.5, RED, 1.3);
      txt(g, (isCu ? 'Cu²⁺' : 'Zn²⁺') + ' 移向阴极', cx - 6 * sc, top + tankH * 0.5 - 6 * sc, 10.5 * sc, 'center', RED);
      arrow(g, xR - ew, top + tankH * 0.72, cx + 40 * sc, top + tankH * 0.72, BLUE, 1.3);
      txt(g, 'SO₄²⁻ 移向阳极', cx + 6 * sc, top + tankH * 0.72 - 6 * sc, 10.5 * sc, 'center', BLUE);
      specks(g, xL - ew2 / 2, eBot - 60 * sc, ew2, 56 * sc, 0.5 + 0.4 * amp / 2, isCu ? CURED : ZNG, 9);
      /* 阴极附近析出的离子流（随动画相位推进 → 画布像素会变） */
      bubbles(g, xL - ew - 6 * sc, eBot - 64 * sc, ew * 2 + 12 * sc, 54 * sc, ph,
        Math.round(3 + 5 * amp), 'rgba(70,110,150,.4)');
      var lines = [
        ['设定：I = ' + fx(pnum(p, 'current', 0.5), 2) + ' A　t = ' + fx(pnum(p, 't', 10), 0) + ' min', INK],
        ['镀件面积 = ' + fx(pnum(p, 'area', 6), 0) + ' cm²　镀层金属：' + (isCu ? '铜' : '锌'), INK],
        ['I = ' + (isfin(rowVal(row, 'current')) ? fx(rowVal(row, 'current'), 2) : '—') + ' A', INK],
        ['j = ' + (isfin(rowVal(row, 'j')) ? fx(rowVal(row, 'j'), 3) : '—') + ' A/cm²', INK],
        ['Q = ' + (isfin(qv) ? fx(qv, 1) : '—') + ' C', INK],
        ['m(镀层) = ' + (isfin(rowVal(row, 'coat')) ? fx(rowVal(row, 'coat'), 1) : '—') + ' mg', isCu ? CURED : INK],
        ['厚度 d ≈ ' + (isfin(rowVal(row, 'thickness')) ? fx(rowVal(row, 'thickness'), 2) : '—') + ' μm', INK],
        ['电流效率 η = ' + (isfin(rowVal(row, 'efficiency')) ? fx(rowVal(row, 'efficiency'), 1) : '—') + ' %', GRAYG]
      ];
      panel(g, w - 214 * sc, 56 * sc, 200 * sc, lines);
      txt(g, '电镀液浓度基本不变：阳极溶解的 ' + (isCu ? 'Cu' : 'Zn') + ' 等于阴极析出的 ' + (isCu ? 'Cu' : 'Zn'),
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.plate = num(anim.plate, 0) + (isfin(dt) ? dt : 0) * 0.8;
      if (anim.plate > 1e6) anim.plate = 0;
    }
  };

  /* ====================================================================== *
   * 6. 反应 5 · 铁的腐蚀（吸氧 / 析氢）                                     *
   * ====================================================================== */

  var corrosion = {
    id: 'iron-corrosion',
    name: '铁的电化学腐蚀（吸氧腐蚀与析氢腐蚀）',
    group: '电化学',
    aim: '比较中性（弱酸性）水膜与较强酸性水膜中铁的腐蚀，写出两种情况的正、负极反应式并说明铁锈的生成',
    principle: '铁中含少量碳，铁与碳在潮湿环境里构成原电池，铁作负极被腐蚀：Fe - 2e- = Fe2+。' +
      '水膜酸性不强（中性/弱酸性）时发生**吸氧腐蚀**，正极 O2 + 2H2O + 4e- = 4OH-，' +
      '总反应 2Fe + O2 + 2H2O = 2Fe(OH)2，随后 4Fe(OH)2 + O2 + 2H2O = 4Fe(OH)3、' +
      '2Fe(OH)3 = Fe2O3·xH2O（铁锈）+(3-x)H2O；' +
      '水膜酸度较高时发生**析氢腐蚀**，正极 2H+ + 2e- = H2↑，总反应 Fe + 2H+ = Fe2+ + H2↑。' +
      '溶液中溶解氧越多、Cl- 浓度越大（海水）、温度越高，腐蚀越快；铁锈疏松多孔不能保护内层铁。',
    apparatus: ['铁片（含碳杂质的薄铁片）', '烧杯/培养皿', 'NaCl 溶液（模拟海水）', '稀硫酸（模拟酸性水膜）',
      '蒸馏水', '氧气（空气）', 'KSCN 溶液与新制氯水（检验 Fe²⁺）', '秒表/计时器', '天平'],
    steps: ['把铁片打磨、洗净、干燥后称量', '分别放入盛有中性（含溶解氧）水膜与较强酸性水膜的容器中',
      '按设定时间观察铁片表面的气泡、颜色与铁锈', '取出铁片洗净干燥后再次称量，计算质量损失',
      '用 KSCN 溶液检验溶液中的 Fe²⁺（先不变红，滴氯水后变红）'],
    params: [
      { key: 'env', label: '水膜环境', type: 'select',
        options: [
          { value: 'neutral', label: '中性/弱酸性水膜（吸氧腐蚀）' },
          { value: 'acid', label: '较强酸性水膜（析氢腐蚀）' }
        ], value: 'neutral' },
      { key: 'o2', label: '水中溶解氧（相对量）', unit: 'mg/L', min: 0, max: 14, step: 0.5, value: 8 },
      { key: 'nacl', label: 'NaCl 质量分数（模拟海水）', unit: '%', min: 0, max: 5, step: 0.5, value: 0 },
      { key: 'temp', label: '温度', unit: '℃', min: 5, max: 60, step: 1, value: 25 },
      { key: 't', label: '腐蚀时间', unit: 'h', min: 1, max: 48, step: 1, value: 24 }
    ],
    react: function (p, ctx) {
      var env = String(pv(p, 'env', 'neutral'));
      var acid = (env === 'acid');
      var o2 = pnum(p, 'o2', 8);
      var nacl = pnum(p, 'nacl', 0);
      var temp = pnum(p, 'temp', 25);
      var hours = pnum(p, 't', 24);

      var tf = Math.exp(50 * (1 / 298.15 - 1 / (273.15 + temp)));   /* 约每升 10 ℃ 速率×2 */
      var saltF = 1 + 0.32 * nacl;
      var massLoss;
      if (acid) {
        massLoss = 0.85 * hours * tf * saltF;                       /* mg（酸性水膜，速率较大） */
      } else {
        massLoss = 0.0625 * o2 * hours * tf * saltF;                /* mg（受溶解氧控制） */
      }
      massLoss = Math.max(0, massLoss);
      var o2Used = acid ? null : massLoss * 0.2005;                 /* mL O₂ */
      var h2 = acid ? massLoss * 0.401 : null;                      /* mL H₂ */
      var rust = massLoss * 1.90;                                   /* mg（以 Fe(OH)₃/Fe₂O₃·xH₂O 计） */
      var rate = massLoss / Math.max(hours, 0.1);                   /* mg/h */

      var ph = [];
      if (acid) {
        ph.push('铁片表面不断冒出气泡（H₂），收集后点燃有爆鸣声');
        ph.push('铁片质量减小、表面逐渐变暗，溶液中出现 Fe²⁺（滴 KSCN 不变红，再滴氯水后变红）');
        ph.push('酸性水膜中发生析氢腐蚀：正极 2H⁺ + 2e⁻ = H₂↑，负极 Fe - 2e⁻ = Fe²⁺');
        ph.push('铁片表面仍会缓慢出现少量铁锈（Fe²⁺ 被空气氧化，4Fe(OH)₂ + O₂ + 2H₂O = 4Fe(OH)₃）');
      } else {
        ph.push('铁片表面出现红棕色铁锈（Fe₂O₃·xH₂O），铁锈疏松多孔、不能保护内层铁');
        ph.push('密闭容器中氧气被消耗，导管内水面上升（正极 O₂ + 2H₂O + 4e⁻ = 4OH⁻）');
        ph.push('铁片附近溶液 pH 升高（正极生成 OH⁻），铁片质量减小');
        ph.push('铁与其中的碳构成原电池，铁作负极：Fe - 2e⁻ = Fe²⁺');
      }
      if (nacl >= 2) ph.push('含 NaCl 的水膜（模拟海水）腐蚀明显加快：Cl⁻ 破坏表面氧化膜、溶液导电性更好');
      if (temp >= 40) ph.push('温度升高，腐蚀速率明显加快');
      if (!acid && o2 <= 1) ph.push('溶解氧很少（如煮沸后冷却的蒸馏水），几乎看不到铁锈，说明吸氧腐蚀必须有 O₂ 参加');
      if (acid) ph.push('该条件下溶解氧不是主要影响因素，腐蚀速率主要由 H⁺ 浓度决定');

      return {
        phenomena: ph,
        equation: acid ? 'Fe + H2SO4 = FeSO4 + H2↑' : '2Fe + O2 + 2H2O = 2Fe(OH)2',
        ionic: acid
          ? 'Fe + 2H+ = Fe2+ + H2↑（负极：Fe - 2e- = Fe2+，氧化；正极：2H+ + 2e- = H2↑，还原；水膜酸度较高时发生的就是这种析氢腐蚀）'
          : '2Fe + O2 + 2H2O = 2Fe2+ + 4OH-（负极：Fe - 2e- = Fe2+；正极：O2 + 2H2O + 4e- = 4OH-；Fe2+ 与 OH- 结合生成氢氧化亚铁，再被氧化为氢氧化铁、脱水成铁锈）',
        ionicNet: acid ? 'Fe + 2H+ = Fe2+ + H2↑' : '2Fe + O2 + 2H2O = 2Fe2+ + 4OH-',
        ionicHalf: acid
          ? '负极（氧化）：Fe - 2e- = Fe2+；正极（还原）：2H+ + 2e- = H2↑'
          : '负极（氧化）：Fe - 2e- = Fe2+；正极（还原）：O2 + 2H2O + 4e- = 4OH-',
        electrodes: {
          negative: 'Fe - 2e- = Fe2+（两种腐蚀的负极反应相同）',
          positive: acid ? '2H+ + 2e- = H2↑（析氢腐蚀）' : 'O2 + 2H2O + 4e- = 4OH-（吸氧腐蚀）',
          electronFlow: '电子：铁（负极）→ 铁中的碳等杂质（正极），在金属内部传递，不经过外电路',
          ionFlow: acid ? 'H+ 移向正极（碳）；Fe2+ 进入溶液' : 'O2 在正极得电子；OH- 在正极附近生成，Fe2+ 移向正极区'
        },
        type: acid ? '原电池（金属的电化学腐蚀：析氢腐蚀）' : '原电池（金属的电化学腐蚀：吸氧腐蚀）',
        conditions: acid ? '常温附近，铁片浸泡在较强酸性水膜（稀硫酸/酸雨）中' : '常温附近，铁片表面覆盖中性或弱酸性水膜，且溶有氧气',
        note: '吸氧腐蚀的后续反应：4Fe(OH)2 + O2 + 2H2O = 4Fe(OH)3；2Fe(OH)3 = Fe2O3·xH2O(铁锈) + (3-x)H2O',
        measures: {
          t: hours, massLoss: massLoss, rate: rate, rust: rust, o2Used: o2Used, h2: h2,
          phLocal: acid ? 3.0 : clamp(7.0 + massLoss * 0.02, 7, 9.5)
        }
      };
    },
    columns: [
      { key: 't', label: '腐蚀时间', unit: 'h' },
      { key: 'massLoss', label: '铁质量损失', unit: 'mg' },
      { key: 'rate', label: '平均腐蚀速率', unit: 'mg/h' },
      { key: 'rust', label: '生成铁锈（以 Fe(OH)₃ 计）', unit: 'mg' },
      { key: 'o2Used', label: '消耗 O₂（吸氧腐蚀）', unit: 'mL' },
      { key: 'h2', label: '放出 H₂（析氢腐蚀）', unit: 'mL' },
      { key: 'phLocal', label: '铁片附近 pH', unit: '' }
    ],
    graph: {
      x: 't', y: 'massLoss', fit: 'origin',
      title: '铁质量损失–腐蚀时间 图线（斜率 = 平均腐蚀速率）',
      note: '扫"腐蚀时间"这个自变量：其它条件不变时，铁的腐蚀量随时间成正比增大，' +
        '图线过原点；溶解氧、NaCl、温度改变的是斜率（腐蚀速率）。'
    },
    conclude: function (rows, p) {
      var acid = String(pv(p, 'env', 'neutral')) === 'acid';
      var n = rows ? rows.length : 0;
      return {
        text: '铁的电化学腐蚀中，铁都是负极：Fe - 2e- = Fe2+。' +
          (acid
            ? '水膜酸度较高时发生析氢腐蚀，正极 2H+ + 2e- = H2↑，总反应 Fe + 2H+ = Fe2+ + H2↑，表面可见气泡。'
            : '水膜酸性不强时发生吸氧腐蚀，正极 O2 + 2H2O + 4e- = 4OH-，总反应 2Fe + O2 + 2H2O = 2Fe(OH)2，' +
              '进一步被氧化生成 Fe(OH)3 并脱水为铁锈 Fe2O3·xH2O。') +
          '含 NaCl（海水）、溶解氧多、温度高都会加快腐蚀。共记录 ' + n +
          ' 组数据：铁的腐蚀量随时间成正比增大，斜率即平均腐蚀速率。',
        equation: acid ? 'Fe + H2SO4 = FeSO4 + H2↑' : '2Fe + O2 + 2H2O = 2Fe(OH)2',
        ionic: acid
          ? 'Fe + 2H+ = Fe2+ + H2↑（负极：Fe - 2e- = Fe2+；正极：2H+ + 2e- = H2↑）'
          : '2Fe + O2 + 2H2O = 2Fe2+ + 4OH-（负极：Fe - 2e- = Fe2+；正极：O2 + 2H2O + 4e- = 4OH-）',
        errors: [
          '铁片表面油污、氧化膜未除净，腐蚀速率偏小且数据分散',
          '除锈时部分铁基体被一起刷掉，使质量损失偏大',
          '水膜中溶解氧含量随放置时间变化（不断被消耗），吸氧腐蚀后期速率下降',
          '腐蚀时间用普通时钟计时，长时间实验（数小时以上）温度波动会影响速率',
          '铁锈疏松易脱落，称量前若刷洗过度会同时带走基体铁，导致结果偏大'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var acid = String(pv(p, 'env', 'neutral')) === 'acid';
      var row = lastRow(state);
      var ph = num(anim.corr, 0), w = S.w, h = S.h;
      var cx = w / 2, panW = 250 * sc, panH = 120 * sc, baseY = h - 74 * sc;
      var left = cx - panW / 2, top = baseY - panH;
      paperTitle(g, '铁的电化学腐蚀（' + (acid ? '较强酸性水膜：析氢腐蚀' : '中性/弱酸性水膜：吸氧腐蚀') + '）',
        '负极（Fe）：Fe - 2e⁻ = Fe²⁺　·　正极（C）：' +
        (acid ? '2H⁺ + 2e⁻ = H₂↑' : 'O₂ + 2H₂O + 4e⁻ = 4OH⁻'));
      /* 培养皿 + 水膜 */
      ell(g, cx, baseY, panW / 2, 20 * sc, 'rgba(255,255,255,.5)', INK, 1.5);
      box(g, left, top, panW, panH, null, INK, 1.4);
      ell(g, cx, top, panW / 2, 16 * sc, 'rgba(168,203,228,.55)', INK, 1.2);
      box(g, left + 1, top, panW - 2, panH * 0.5, acid ? 'rgba(226,203,180,.5)' : 'rgba(168,203,228,.5)', null, 0);
      txt(g, acid ? '较强酸性水膜（稀硫酸 / 酸雨）' : '中性水膜（溶有 O₂ 与少量 CO₂）',
        cx, baseY + 34 * sc, 11 * sc, 'center', 'rgba(38,34,28,.78)');
      /* 铁片（含碳杂质） */
      var fw = 150 * sc, fh = 12 * sc, fy = top + panH * 0.32;
      box(g, cx - fw / 2, fy, fw, fh, '#8f8f8a', INK, 1.3);
      specks(g, cx - fw / 2, fy, fw, fh, 0.5, 'rgba(40,40,38,.75)', 4);
      txt(g, '铁片（含碳杂质）', cx, fy - 8 * sc, 11.5 * sc, 'center', INK);
      /* 微原电池示意：负极 Fe / 正极 C */
      var mx = cx - fw / 2 + 24 * sc;
      txt(g, 'Fe（负极）', mx, fy + fh + 16 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.85)');
      txt(g, 'C（正极）', mx + 64 * sc, fy + fh + 16 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.85)');
      arrow(g, mx + 10 * sc, fy + fh + 26 * sc, mx + 54 * sc, fy + fh + 26 * sc, RED, 1.3);
      txt(g, 'e⁻', mx + 32 * sc, fy + fh + 40 * sc, 10.5 * sc, 'center', RED);
      /* 现象 */
      var amt = clamp((isfin(rowVal(row, 'massLoss')) ? rowVal(row, 'massLoss') : 6) / 30, 0.1, 1.2);
      if (acid) {
        bubbles(g, cx - fw / 2, fy - 52 * sc, fw, 48 * sc, ph, Math.round(4 + 10 * amt), 'rgba(38,34,28,.5)');
        txt(g, 'H₂↑（气泡）', cx + fw / 2 + 14 * sc, fy - 20 * sc, 11.5 * sc, 'left', INK);
        rustSpots(g, cx - fw / 2 + 30 * sc, fy + 4 * sc, fw - 40 * sc, fh, 0.25, 2);
        txt(g, 'Fe²⁺ 进入溶液（KSCN 不变红，加氯水后变红）', cx, top - 12 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.72)');
      } else {
        rustSpots(g, cx - fw / 2, fy - 6 * sc, fw, fh + 12 * sc, amt, 6);
        txt(g, '红棕色铁锈 Fe₂O₃·xH₂O', cx + fw / 2 + 14 * sc, fy + 6 * sc, 11.5 * sc, 'left', RUST);
        /* 氧气被消耗：小气泡朝铁片汇聚 */
        for (var i = 0; i < 7; i++) {
          var bx = cx - fw / 2 - 40 * sc + i * 13 * sc;
          circle(g, bx, fy - 16 * sc + 6 * Math.sin(ph * 1.2 + i), 2.1, null, 'rgba(70,110,150,.75)', 1);
        }
        txt(g, 'O₂ 被消耗 → 导管内水面上升', cx, top - 12 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.72)');
        txt(g, '正极附近 c(OH⁻) 增大，pH 升高', cx, baseY + 50 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.72)');
      }
      var lines = [
        ['c(溶解氧) = ' + fx(pnum(p, 'o2', 8), 1) + ' mg/L', INK],
        ['NaCl = ' + fx(pnum(p, 'nacl', 0), 1) + ' %', INK],
        ['T = ' + fx(pnum(p, 'temp', 25), 0) + ' ℃　t = ' + fx(pnum(p, 't', 24), 0) + ' h', INK],
        ['Δm(Fe) = ' + (isfin(rowVal(row, 'massLoss')) ? fx(rowVal(row, 'massLoss'), 1) : '—') + ' mg', RUST],
        ['v(平均) = ' + (isfin(rowVal(row, 'rate')) ? fx(rowVal(row, 'rate'), 2) : '—') + ' mg/h', INK],
        acid ? 'V(H₂) = ' + (isfin(rowVal(row, 'h2')) ? fx(rowVal(row, 'h2'), 1) : '—') + ' mL'
          : 'V(O₂) = ' + (isfin(rowVal(row, 'o2Used')) ? fx(rowVal(row, 'o2Used'), 1) : '—') + ' mL'
      ];
      panel(g, w - 214 * sc, 56 * sc, 200 * sc, lines);
      txt(g, acid ? '总反应：Fe + 2H⁺ = Fe²⁺ + H₂↑（析氢腐蚀）'
        : '总反应：2Fe + O₂ + 2H₂O = 2Fe(OH)₂ → 4Fe(OH)₃ → Fe₂O₃·xH₂O（铁锈）',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.corr = num(anim.corr, 0) + (isfin(dt) ? dt : 0) * 0.7;
      if (anim.corr > 1e6) anim.corr = 0;
    }
  };

  /* ====================================================================== *
   * 7. 反应 6 · 氢氧燃料电池                                               *
   * ====================================================================== */

  var fuelCell = {
    id: 'fuel-cell',
    name: '氢氧燃料电池（酸性 / 碱性电解质）',
    group: '电化学',
    aim: '组装氢氧燃料电池，比较酸性、碱性电解质中电极反应式的写法，观察电流与电解质 pH 的变化',
    principle: '氢氧燃料电池的总反应都是 2H2 + O2 = 2H2O，但**电极反应式随电解质酸碱性而变**：' +
      '酸性（稀硫酸、质子交换膜）电解质中，负极 2H2 - 4e- = 4H+、正极 O2 + 4e- + 4H+ = 2H2O，' +
      'H+ 由负极区移向正极区，生成水使 c(H+) 减小，电解质溶液 pH 增大；' +
      '碱性（NaOH/KOH）电解质中，负极 2H2 - 4e- + 4OH- = 4H2O、正极 O2 + 4e- + 2H2O = 4OH-，' +
      'OH- 由正极区移向负极区，消耗水使 c(OH-) 减小，电解质溶液 pH 减小。' +
      '燃料电池把化学能转化为电能，能量转化率高、产物只有水；输出电流随温度升高而增大。',
    apparatus: ['U 形管/电解槽（两个电极室）', '多孔铂（或石墨）电极 2 根', '稀硫酸（或 KOH 溶液）',
      'H₂ 与 O₂ 气源', '导线', '灵敏电流计/小灯泡', '秒表'],
    steps: ['按装置图把两个多孔电极插入电解质溶液，接好导线与电流计',
      '从负极一侧通入 H₂、从正极一侧通入 O₂', '观察电流计读数与两极现象（气体被消耗、正极有水生成）',
      '用 pH 试纸（或 pH 计）测反应前后电解质的 pH', '按设定放电时间记录电量与消耗的气体体积'],
    params: [
      { key: 'medium', label: '电解质', type: 'select',
        options: [
          { value: 'acid', label: '酸性电解质（稀 H₂SO₄）' },
          { value: 'alkaline', label: '碱性电解质（KOH / NaOH 溶液）' }
        ], value: 'acid' },
      { key: 'h2Rate', label: 'H₂ 通入速率', unit: 'mL/min', min: 5, max: 100, step: 5, value: 40 },
      { key: 'load', label: '外电路负载电阻', unit: 'Ω', min: 0.5, max: 20, step: 0.5, value: 5 },
      { key: 'temp', label: '工作温度', unit: '℃', min: 20, max: 80, step: 1, value: 25 },
      { key: 't', label: '放电时间', unit: 'min', min: 1, max: 30, step: 1, value: 10 }
    ],
    react: function (p, ctx) {
      var medium = String(pv(p, 'medium', 'acid'));
      var alkaline = (medium === 'alkaline');
      var rate = pnum(p, 'h2Rate', 40);
      var load = pnum(p, 'load', 5);
      var temp = pnum(p, 'temp', 25);
      var mins = pnum(p, 't', 10);

      var emf = clamp(1.00 + 0.0012 * (temp - 25), 0.85, 1.15);   /* 开路电压（实际值，理论 1.23 V） */
      var rint = clamp(0.80 * (1 - 0.006 * (temp - 25)), 0.25, 1.6);
      var I = emf / (rint + Math.max(load, 0.1));                 /* A */
      /* 气体供应上限：I 不能超过供氢能支持的电流 */
      var iMax = rate / 6.966;                                    /* mL/min ÷ (mL/min per A) */
      if (I > iMax) I = iMax;
      var Q = I * mins * 60;
      var h2Used = faradayGas(Q, 2) / 1000 * 1000;                /* mL（标准状况） */
      var o2Used = h2Used / 2;
      var water = h2Used / VM * 18 * 1000;                        /* mg */
      var h2Need = I * 6.966;                                     /* mL/min 实际消耗速率 */
      var ph = alkaline
        ? clamp(13.60 - 0.5 * (water / 200), 12.0, 13.8)
        : clamp(1.00 + 0.5 * (water / 200), 0.6, 3.0);

      var ph2 = [];
      ph2.push('通 H₂ 的一极（负极）气体被消耗，通 O₂ 的一极（正极）气体被消耗并生成水（电极表面出现液滴）');
      ph2.push('电流计指针偏转、小灯泡发光，说明化学能转化为电能');
      if (alkaline) {
        ph2.push('碱性电解质中 OH⁻ 由正极区移向负极区（阴离子移向负极）');
        ph2.push('负极：2H₂ - 4e⁻ + 4OH⁻ = 4H₂O；正极：O₂ + 4e⁻ + 2H₂O = 4OH⁻');
        ph2.push('消耗水使 c(OH⁻) 减小，电解质溶液 pH 减小');
      } else {
        ph2.push('酸性电解质中 H⁺ 由负极区移向正极区（阳离子移向正极）');
        ph2.push('负极：2H₂ - 4e⁻ = 4H⁺；正极：O₂ + 4e⁻ + 4H⁺ = 2H₂O');
        ph2.push('生成水使 c(H⁺) 减小，电解质溶液 pH 增大');
      }
      ph2.push('电池总反应 2H₂ + O₂ = 2H₂O，产物只有水，属于环境友好的化学电源');
      if (temp >= 60) ph2.push('温度升高，电极反应加快、内阻减小，输出电流增大');
      if (h2Need >= rate * 0.95) ph2.push('外电路电流已达供气上限，气体通入速率限制了输出电流');
      if (load <= 1.0) ph2.push('外电路电阻很小（接近短路），电流很大、电压降低（极化）');

      return {
        phenomena: ph2,
        equation: '2H2 + O2 = 2H2O',
        ionic: alkaline
          ? '2H2 + O2 = 2H2O（碱性电解质：负极 2H2 - 4e- + 4OH- = 4H2O，氧化；正极 O2 + 4e- + 2H2O = 4OH-，还原；OH- 移向负极，pH 减小）'
          : '2H2 + O2 = 2H2O（酸性电解质：负极 2H2 - 4e- = 4H+，氧化；正极 O2 + 4e- + 4H+ = 2H2O，还原；H+ 移向正极，pH 增大）',
        ionicNet: '2H2 + O2 = 2H2O',
        ionicHalf: alkaline
          ? '负极（氧化）：2H2 - 4e- + 4OH- = 4H2O；正极（还原）：O2 + 4e- + 2H2O = 4OH-'
          : '负极（氧化）：2H2 - 4e- = 4H+；正极（还原）：O2 + 4e- + 4H+ = 2H2O',
        electrodes: {
          negative: alkaline ? '2H2 - 4e- + 4OH- = 4H2O（H₂ 被氧化）' : '2H2 - 4e- = 4H+（H₂ 被氧化）',
          positive: alkaline ? 'O2 + 4e- + 2H2O = 4OH-（O₂ 被还原）' : 'O2 + 4e- + 4H+ = 2H2O（O₂ 被还原）',
          electronFlow: '电子：负极（通 H₂）→ 外电路 → 正极（通 O₂）',
          ionFlow: alkaline ? 'OH- 由正极区移向负极区（阴离子移向负极）' : 'H+ 由负极区移向正极区（阳离子移向正极）'
        },
        type: '原电池（燃料电池：化学能转化为电能）',
        conditions: alkaline
          ? '常温附近，碱性电解质（KOH/NaOH 溶液），多孔电极，不断通入 H₂ 与 O₂'
          : '常温附近，酸性电解质（稀硫酸或质子交换膜），多孔电极，不断通入 H₂ 与 O₂',
        measures: {
          emf: emf, current: I * 1000, q: Q, h2Used: h2Used,
          o2Used: o2Used, water: water, ph: ph
        }
      };
    },
    columns: [
      { key: 'emf', label: '工作电压', unit: 'V' },
      { key: 'current', label: '输出电流', unit: 'mA' },
      { key: 'q', label: '通过电量', unit: 'C' },
      { key: 'h2Used', label: '消耗 H₂', unit: 'mL' },
      { key: 'o2Used', label: '消耗 O₂', unit: 'mL' },
      { key: 'water', label: '生成水', unit: 'mg' },
      { key: 'ph', label: '电解质 pH', unit: '' }
    ],
    graph: {
      x: 'q', y: 'h2Used', fit: 'origin',
      title: '消耗 H₂ 体积–通过电量 图线（V(H₂) = 22.4 L/mol × Q/(2F)）',
      note: '扫"放电时间"：Q = I·t 越大，消耗的 H₂ 越多；过原点直线，' +
        '斜率 = 0.116 mL/C（标准状况）。'
    },
    conclude: function (rows, p) {
      var alkaline = String(pv(p, 'medium', 'acid')) === 'alkaline';
      var n = rows ? rows.length : 0;
      return {
        text: '氢氧燃料电池的总反应都是 2H2 + O2 = 2H2O，但电极反应式随电解质酸碱性不同：' +
          (alkaline
            ? '碱性电解质中负极 2H2 - 4e- + 4OH- = 4H2O、正极 O2 + 4e- + 2H2O = 4OH-，OH- 移向负极，pH 减小。'
            : '酸性电解质中负极 2H2 - 4e- = 4H+、正极 O2 + 4e- + 4H+ = 2H2O，H+ 移向正极，pH 增大。') +
          '电子由负极经外电路流向正极。共记录 ' + n +
          ' 组数据：消耗的 H₂ 与通过电量成正比（V = 22.4 L/mol × Q/(2F)）。',
        equation: '2H2 + O2 = 2H2O',
        ionic: alkaline
          ? '2H2 + O2 = 2H2O（碱性：负极 2H2 - 4e- + 4OH- = 4H2O；正极 O2 + 4e- + 2H2O = 4OH-；OH- 移向负极，pH 减小）'
          : '2H2 + O2 = 2H2O（酸性：负极 2H2 - 4e- = 4H+；正极 O2 + 4e- + 4H+ = 2H2O；H+ 移向正极，pH 增大）',
        errors: [
          '放电时间与电流读数误差按比例影响电量与气体消耗量（Q = I·t）',
          '气体体积未换算到标准状况（温度、压强不同），与理论值比较会产生偏差',
          '电解质 pH 变化很小，用 pH 试纸测量分辨不够，应使用 pH 计并注意 CO₂ 干扰（碱性液易吸收 CO₂）',
          '多孔电极被水淹没或气体流速不稳时，电流波动、电压下降（浓差极化）',
          '把"工作电压"当成理论电动势 1.23 V 会造成计算错误：实际电池存在极化与内阻损失'
        ]
      };
    },
    draw: function (g, p, state) {
      var S = sceneSize(g), sc = scaleOf(g), c = ctxOf(g);
      if (!c) return;
      var alkaline = String(pv(p, 'medium', 'acid')) === 'alkaline';
      var row = lastRow(state);
      var ph = num(anim.fuel, 0), w = S.w, h = S.h;
      var cx = w / 2, tankW = 250 * sc, tankH = 132 * sc, baseY = h - 74 * sc;
      var left = cx - tankW / 2, top = baseY - tankH;
      paperTitle(g, '氢氧燃料电池（' + (alkaline ? '碱性电解质 KOH' : '酸性电解质 稀 H₂SO₄') + '）',
        '总反应：2H₂ + O₂ = 2H₂O　·　' + (alkaline ? 'OH⁻ 移向负极，pH 减小' : 'H⁺ 移向正极，pH 增大'));
      /* 电解槽 */
      box(g, left, top, tankW, tankH, null, INK, 1.6);
      box(g, left + 1, top + tankH * 0.26, tankW - 2, tankH * 0.74 - 1,
        alkaline ? 'rgba(200,206,235,.55)' : 'rgba(214,206,232,.5)', null, 0);
      txt(g, alkaline ? 'KOH 溶液（碱性电解质）' : '稀 H₂SO₄（酸性电解质）',
        cx, baseY - 10 * sc, 11 * sc, 'center', 'rgba(38,34,28,.78)');
      /* 电极 + 气路 */
      var eTop = top - 46 * sc, eBot = baseY - tankH * 0.16;
      var xL = left + tankW * 0.26, xR = left + tankW * 0.74, ew = 13 * sc;
      box(g, xL - ew / 2, eTop, ew, eBot - eTop, '#6b6b66', INK, 1.2);
      box(g, xR - ew / 2, eTop, ew, eBot - eTop, '#6b6b66', INK, 1.2);
      txt(g, '负极（－）H₂', xL, eTop - 26 * sc, 11.5 * sc, 'center', INK);
      txt(g, '正极（＋）O₂', xR, eTop - 26 * sc, 11.5 * sc, 'center', INK);
      /* 进气箭头 */
      arrow(g, xL - 52 * sc, eTop - 14 * sc, xL - 8 * sc, eTop - 14 * sc, BLUE, 1.4);
      txt(g, 'H₂', xL - 62 * sc, eTop - 10 * sc, 11 * sc, 'center', BLUE);
      arrow(g, xR + 52 * sc, eTop - 14 * sc, xR + 8 * sc, eTop - 14 * sc, RED, 1.4);
      txt(g, 'O₂', xR + 62 * sc, eTop - 10 * sc, 11 * sc, 'center', RED);
      /* 外电路：导线 + 电流计 + 灯泡 */
      var wireY = eTop - 40 * sc;
      ln(g, xL, eTop, xL, wireY, INK, 1.6);
      ln(g, xR, eTop, xR, wireY, INK, 1.6);
      ln(g, xL, wireY, cx - 40 * sc, wireY, INK, 1.6);
      ln(g, xR, wireY, cx + 40 * sc, wireY, INK, 1.6);
      galv(g, cx, wireY, 13 * sc, '电流计');
      circle(g, cx - 40 * sc, wireY, 8 * sc, 'rgba(216,194,74,.55)', INK, 1.2);
      circle(g, cx + 40 * sc, wireY, 8 * sc, 'rgba(216,194,74,.55)', INK, 1.2);
      txt(g, '小灯泡', cx, wireY - 26 * sc, 10.5 * sc, 'center', 'rgba(38,34,28,.7)');
      arrow(g, xL + 16 * sc, wireY - 13 * sc, xR - 16 * sc, wireY - 13 * sc, RED, 1.5);
      txt(g, 'e⁻', cx, wireY - 17 * sc, 10.5 * sc, 'center', RED);
      /* 离子迁移 */
      if (alkaline) {
        arrow(g, xR - 18 * sc, top + tankH * 0.55, xL + 18 * sc, top + tankH * 0.55, BLUE, 1.4);
        txt(g, 'OH⁻ ←（移向负极）', cx, top + tankH * 0.55 - 6 * sc, 10.5 * sc, 'center', BLUE);
      } else {
        arrow(g, xL + 18 * sc, top + tankH * 0.55, xR - 18 * sc, top + tankH * 0.55, RED, 1.4);
        txt(g, 'H⁺ →（移向正极）', cx, top + tankH * 0.55 - 6 * sc, 10.5 * sc, 'center', RED);
      }
      /* 正极生成水：小液滴；气体被消耗：气泡 */
      var amp = isfin(rowVal(row, 'current')) ? clamp(rowVal(row, 'current') / 300, 0.1, 1.2) : 0.3;
      bubbles(g, xL - ew, eBot - 70 * sc, ew * 2.2, 60 * sc, ph, Math.round(3 + 8 * amp), 'rgba(70,110,170,.6)');
      bubbles(g, xR - ew, eBot - 70 * sc, ew * 2.2, 60 * sc, ph + 0.5, Math.round(3 + 8 * amp), 'rgba(170,70,60,.6)');
      for (var i = 0; i < 5; i++) {
        circle(g, xR + 24 * sc + 6 * i, top + tankH * 0.4 + 4 * Math.sin(ph * 1.5 + i), 2.2,
          'rgba(150,190,220,.8)', null, 0);
      }
      txt(g, '正极生成水', xR + 40 * sc, top + tankH * 0.3, 10.5 * sc, 'center', 'rgba(60,110,160,.95)');
      var lines = [
        ['工作电压 U = ' + (isfin(rowVal(row, 'emf')) ? fx(rowVal(row, 'emf'), 2) : '—') + ' V', INK],
        ['电流 I = ' + (isfin(rowVal(row, 'current')) ? fx(rowVal(row, 'current'), 1) : '—') + ' mA', RED],
        ['Q = ' + (isfin(rowVal(row, 'q')) ? fx(rowVal(row, 'q'), 1) : '—') + ' C', INK],
        ['V(H₂) = ' + (isfin(rowVal(row, 'h2Used')) ? fx(rowVal(row, 'h2Used'), 1) : '—') + ' mL', BLUE],
        ['V(O₂) = ' + (isfin(rowVal(row, 'o2Used')) ? fx(rowVal(row, 'o2Used'), 1) : '—') + ' mL', RED],
        ['pH = ' + (isfin(rowVal(row, 'ph')) ? fx(rowVal(row, 'ph'), 2) : '—') +
          (alkaline ? '（变小）' : '（变大）'), 'rgba(90,70,150,.95)']
      ];
      panel(g, w - 214 * sc, 56 * sc, 200 * sc, lines);
      txt(g, alkaline
        ? '负极：2H₂ - 4e⁻ + 4OH⁻ = 4H₂O　正极：O₂ + 4e⁻ + 2H₂O = 4OH⁻'
        : '负极：2H₂ - 4e⁻ = 4H⁺　正极：O₂ + 4e⁻ + 4H⁺ = 2H₂O',
        14 * sc, h - 14 * sc, 11 * sc, 'left', 'rgba(38,34,28,.72)');
    },
    step: function (p, state, dt) {
      anim.fuel = num(anim.fuel, 0) + (isfin(dt) ? dt : 0) * 1.0;
      if (anim.fuel > 1e6) anim.fuel = 0;
    }
  };

  /* ====================================================================== *
   * 8. 动画相位（模块级，只被 step 推进；draw 读它 → run(1) 后像素会变）    *
   * ====================================================================== */

  var anim = { galv: 0, lyse: 0, brine: 0, plate: 0, corr: 0, fuel: 0 };

  /* ====================================================================== *
   * 9. 登记                                                                *
   * ====================================================================== */

  var SPECS = [galvanic, lyseCuCl2, brine, plating, corrosion, fuelCell];

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
    if (!window.QG_CLAB_ELECTRO_ORIGIN) window.QG_CLAB_ELECTRO_ORIGIN = BUILD;
  }
})();
