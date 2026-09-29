/* ============================================================================
 * 穷观 · 化学实验台 —— 组 3 · 有机反应（js/clab/organic.js）
 *
 * 本文件只做一件事：向化学实验台注册表登记 11 个有机反应
 *     window.QG_CLAB.register(id, spec)
 * 不自建 DOM、不起循环、不读写全局状态（惰性，与 js/pslab/*.js、js/psandbox.js 一致）。
 *
 * ── 契约依据 ────────────────────────────────────────────────────────────────
 *   docs/化学实验台设计.md  §2 组 3 · 有机反应（11 个 id 逐字）
 *                           §3 register(id,spec) 字段与 react() 返回契约
 *                           §4 每个反应的验收（8 条）
 *   docs/物理实验台设计.md  §9 实现约定（null 语义 / g.font 宽容签名 /
 *                            滑块 step 体检 / 没有 min/max 的参数必须写 select）
 *
 * ── 本组的两条硬约定（写别的组之前先看这里） ────────────────────────────────
 * ① **`equation` 字段里不许出现 `=` `→` `⇌` 以外的符号歧义**：核心的
 *    `balance(eq)` 要按 `=`（或 →）切分物种再逐元素核对，所以凡是结构简式里
 *    自带 `=` 的物质（乙烯 CH2=CH2、乙炔、苯环的凯库勒式…）在方程式里**一律
 *    写分子式**（乙烯写 C2H4）；葡萄糖写 C6H12O6 而不是 CH2OH(CHOH)4CHO
 *    （后者被"忽略括号倍数"的解析器读成 C3H7O3）；银氨溶液写 Ag(NH3)2OH
 *    （方括号 [ ] 不在化学式的常规括号集里，写圆括号更保险）。
 *    结构简式照旧出现在 principle / phenomena / conclude 的文字里——那里不查配平。
 * ② **聚合度 / 单元数 n 不能出现在 `equation` 里**：核心 `balance()` 的解析器
 *    （js/clab.js parseGroup）遇到裸小写字母会直接判
 *    「元素符号不能以小写字母开头」，`nC2H4`、`(C6H10O5)n`、`nH2O` 一律解析失败
 *    → `balance().ok === false`（已用真核心实测）。
 *    所以本组凡涉及 n 的方程式**一律把 n 写实为 1000 的具体形式**：
 *      `1000C2H4 = (C2H4)1000`、`(C6H10O5)1000 + 1000H2O = 1000C6H12O6`、
 *      `(C6H10O5)1000 + 500H2O = 500C12H22O11`（系数 1/500/500，gcd=1 仍是最简比）。
 *    通式（`nC2H4 → (C2H4)n`、`(C6H10O5)n + nH2O → nC6H12O6`）写在
 *    principle / phenomena / conclude 的文字里——那里不查配平，学生照样看得到标准写法。
 *
 * ── 条件被抑制时的写法（本组统一口径，不是糊弄） ────────────────────────────
 *    有机反应的灵魂是条件：光照 / 催化剂 / 浓硫酸 / 170 ℃ vs 140 ℃ /
 *    水浴 / 酸性 vs 碱性水解。凡是"某条件下反应被抑制"（避光、酶在沸水浴
 *    中变性、溴水太少、催化剂缺失），`react()` 仍然返回**该体系对应的配平
 *    方程式**，同时把 `conditions` 与 `phenomena` 写成明确的事实：没有发生 /
 *    几乎不发生 / 看不到现象。理由有两条，都是硬的：
 *      a) 核心的 `balance('')` 会把空方程式判为不配平，返回空串必然踩验收第 2 条；
 *      b) 这正是课本对照实验的写法——方程式写在黑板上，现象栏照样写"无现象"。
 *
 * ── 化学事实的来源（全部为公开可核对的页面/PDF，逐条见回报） ─────────────────
 *   [S1] 高宏《甲烷与氯气的取代反应实验改进》，《实验教学与仪器》2025,42(11):88-90
 *        DOI:10.19935/j.cnki.1004-2326.2025.11.027（**全文**，PDF 已下载抽取）
 *        —— 人教版"光亮处（不要日光直射）"、苏教版"灯光照射"、体积比 1:1 与 1:4、
 *           油状液滴/颜色变浅/液面上升、CH3Cl 为气体其余氯代甲烷为难溶于水的液体
 *   [S2] 葛海祥《乙醇消去反应的改进与创新》，《实验教学与仪器》2025,42(04):67-68
 *        DOI:10.19935/j.cnki.1004-2326.2025.04.022（**全文**，PDF 已下载抽取）
 *        —— 140 ℃ 溶液发黄 / 150 ℃ 加深 / 160 ℃ 变黑 / 170 ℃ 炭化严重、
 *           炭黑挂壁、大量刺激性气味 SO2、全过程约 15 min、浓硫酸有催化剂与
 *           脱水剂多重作用、降低酸的比例（醇酸体积比 1.0:1.5~1.0:1.0）可减少炭化、
 *           碳正离子生成是决速步、必须迅速升温
 *   [S3] 武汉教育云·万长江名师工作室《解读苯酚与溴水反应实验》（**全文**）
 *        —— 教材原句"向盛有少量苯酚稀溶液的试管里滴入过量浓溴水"与"苯酚与溴的
 *           反应很灵敏，常用于苯酚的定性检验与定量测定"；2 滴→无现象（三溴苯酚
 *           量少且溶解在苯酚中）、4 滴→大量白色沉淀、10 滴→变黄（生成黄色的
 *           2,4,4,6-四溴环己二烯酮）；结论"浓溴水应稍过量，但不能过量太多"
 *   [S4] 科普中国《Tollens 反应 / 银镜反应》（**全文**）
 *        —— 银氨溶液=硝酸银的氨水溶液、弱氧化剂、将醛氧化为羧酸并析出金属银
 *           （银镜）、酮不反应、**现配现用**、久置易生成易爆的雷酸银与氮化银
 *   [S5] 菁优网题目页（**摘录/全文**，见回报逐条 URL）
 *        —— 银氨溶液配法"向 1 mL 2% AgNO3 溶液边振荡边逐滴滴入 2% 稀氨水至最初
 *           产生的沉淀恰好消失"、水浴加热不能直接加热、稀硝酸可洗去银镜；
 *           苯的溴代"2Fe+3Br2=2FeBr3""AgBr 浅黄色沉淀""红褐色油状液滴含 Br2"
 *           "长导管导气兼冷凝回流""NaOH 溶液洗涤后分液"；苯的硝化"50~60 ℃ 水浴"
 *           "淡黄色油状液体（含 NO2）""苦杏仁气味""密度比水大"；
 *           淀粉水解"60~80 ℃ 水浴 5~6 min""甲/乙/丙三管对照""没有加碱中和稀硫酸
 *           导致无砖红色沉淀""先加 NaOH 再滴碘水会因碘与 NaOH 反应而不显蓝"；
 *           甲烷"CH4 与 Cl2 反应条件是光照""日光直射可能引起爆炸""油状液滴化学式
 *           CH2Cl2、CHCl3、CCl4，其中 CHCl3、CCl4 是重要溶剂""用饱和食盐水降低
 *           Cl2 溶解度"；乙醇消去"170 ℃ 主要反应得乙烯""140 ℃ 副反应得乙醚"
 *           "170 ℃ 以上浓硫酸氧化乙醇生成黑色碳 C2H5OH+2H2SO4(浓)=2C+2SO2↑+5H2O"
 *           "杂质 SO2 也能使溴水褪色，必须先经 NaOH 溶液"
 *   [S6] 科普中国《聚乙烯》（**全文**）
 *        —— 1933 年高压法（低密度聚乙烯）、1953 年齐格勒 TiCl4-Al(C2H5)3 低压法
 *           （高密度聚乙烯）、聚乙烯乳白色蜡状颗粒、密度约 0.920 g/cm³、
 *           熔点 108~126 ℃、不溶于水、耐酸碱、高压法 100~300 MPa / 200~300 ℃
 *           用氧或过氧化物引发
 *   [S7] 1010jiajiao 题目页（**全文**）
 *        —— 乙酸乙酯水解三支试管对照：稀硫酸①"酯层变薄"、NaOH②"酯层消失"、
 *           水③"酯层基本不变"；稀硫酸起催化作用；NaOH 与生成的乙酸中和使平衡
 *           正移、水解彻底
 *
 * 纯 ES5（无箭头函数/let/const/模板串/class/eval/new Function）、零依赖、不联网。
 * 指纹 QG-20260920-5e5d5a
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ========================================================================== */
(function () {
  'use strict';

  if (!window.QG_CLAB || typeof window.QG_CLAB.register !== 'function') return;

  /* ======================================================================
   * 0 · 小工具（纯函数，无副作用）
   * ==================================================================== */

  function qgNum(v, d) {
    var x = Number(v);
    return isFinite(x) ? x : d;
  }
  function qgClamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function qgLerp(a, b, t) { return a + (b - a) * t; }

  /* 参数读取：核心没给这个 key（或给了空值）时退回默认值——
     探针可能只 setParam 一两个键，其余必须仍然能算出结果。 */
  function qgP(p, k, d) {
    if (!p) return d;
    var v = p[k];
    if (v === undefined || v === null || v === '') return d;
    return v;
  }
  function qgSel(p, k, d) { return String(qgP(p, k, d)); }
  function qgPN(p, k, d) { return qgNum(qgP(p, k, d), d); }

  function qgHas(list, s) { return String(list).indexOf(s) >= 0; }

  /* 把 0~1 的强度写成"很/较/略"这种定性词，避免在现象里编造具体数字 */
  function qgWord(x, w0, w1, w2) {
    if (x < 0.34) return w0;
    if (x < 0.67) return w1;
    return w2;
  }

  /* 固定小数（只用于"由真实公式算出"的量，见各反应注释；纯定性反应不用） */
  function qgFix(x, n) { var m = Math.pow(10, n); return Math.round(x * m) / m; }

  /* ======================================================================
   * 1 · 画布工具箱（只碰 g.c；g.font/g.text/g.line 有就用、没有就自己拼 ES5 串）
   *
   * 契约（物理实验台 §4 + 化学 §3 同款）：
   *   g = { c: CanvasRenderingContext2D, w, h, paper:'#F4F1EA', ink:'#26221C',
   *         scale, font(size[,italic[,bold]]) }
   * 这里**不依赖**核心提供 g.font/g.text/g.line/arrow：即使探针只给
   * {c,w,h} 也必须画得出来、不抛异常。
   * ==================================================================== */

  var QG_PAPER = '#F4F1EA';
  var QG_INK = '#26221C';
  var QG_FONT = 'Georgia,"Times New Roman",serif';

  var QG_FS = 1;   /* 当前帧的缩放（qgFrame 写；线宽用它保证小画布上仍有最小可见宽度） */
  function qgLw(w) {
    w = qgNum(w, 1.4);
    if (QG_FS > 0 && QG_FS < 1) {
      var min = 1.15 / QG_FS;
      if (w < min) w = min;
    }
    return w;
  }
  function qgFontOf(g, px, italic, bold) {
    if (g && typeof g.font === 'function') {
      try {
        var s = g.font(px, !!italic, !!bold);
        if (typeof s === 'string' && s) return s;
      } catch (e) { /* 核心的 font 抛了就用本地兜底 */ }
    }
    return (italic ? 'italic ' : '') + (bold ? 'bold ' : '') +
      Math.max(6, Math.round(px)) + 'px ' + QG_FONT;
  }
  function qgInk(g, c) { return c || (g && g.ink) || QG_INK; }

  function qgTxt(g, s, x, y, px, align, color, italic, bold) {
    var c = g && g.c;
    if (!c || s === null || s === undefined) return;
    c.save();
    c.font = qgFontOf(g, px, italic, bold);
    c.fillStyle = qgInk(g, color);
    c.textAlign = align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillText(String(s), x, y);
    c.restore();
  }
  function qgLine(g, x1, y1, x2, y2, color, w, dash) {
    var c = g && g.c;
    if (!c) return;
    c.save();
    c.strokeStyle = qgInk(g, color);
    c.lineWidth = qgLw(w || 1);
    if (dash) { c.setLineDash(dash); }
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.restore();
  }
  function qgRect(g, x, y, w, h, stroke, fill, lw) {
    var c = g && g.c;
    if (!c) return;
    c.save();
    if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
    if (stroke) {
      c.strokeStyle = qgInk(g, stroke);
      c.lineWidth = qgLw(lw || 1);
      c.strokeRect(x, y, w, h);
    }
    c.restore();
  }
  function qgPath(g, pts, stroke, fill, lw, close) {
    var c = g && g.c, i;
    if (!c || !pts || !pts.length) return;
    c.save();
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (close) c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) {
      c.strokeStyle = qgInk(g, stroke);
      c.lineWidth = qgLw(lw || 1);
      c.stroke();
    }
    c.restore();
  }
  function qgCircle(g, x, y, r, stroke, fill, lw) {
    var c = g && g.c;
    if (!c) return;
    c.save();
    c.beginPath();
    c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2, false);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) {
      c.strokeStyle = qgInk(g, stroke);
      c.lineWidth = qgLw(lw || 1);
      c.stroke();
    }
    c.restore();
  }
  function qgDashRect(g, x, y, w, h, color, lw) {
    qgLine(g, x, y, x + w, y, color, lw, [4, 3]);
    qgLine(g, x + w, y, x + w, y + h, color, lw, [4, 3]);
    qgLine(g, x + w, y + h, x, y + h, color, lw, [4, 3]);
    qgLine(g, x, y + h, x, y, color, lw, [4, 3]);
  }

  /* 圆底试管的**内腔路径**：cx = 中轴，y = 腔口，r = 内腔半径，h = 含圆底的总高（圆心 y+h-r）。
     轮廓与"液体/沉淀"的裁剪共用这一条路径。 */
  function qgTubePath(c, cx, y, r, h) {
    if (!c) return;
    var yb = y + h - r;
    c.beginPath();
    c.moveTo(cx - r, y);
    c.lineTo(cx - r, yb);
    c.arc(cx, yb, r, Math.PI, 0, true);
    c.lineTo(cx + r, y);
    c.closePath();
  }
  /* 最近一次 qgTube 画出的内腔（供 qgTubeBegin/End 裁剪用） */
  var qgLastTube = null;
  /* 进入/离开"试管内腔"裁剪：液体与沉淀**必须**在两者之间画。
     内缩 1.2px ⇒ 永远不盖住 1.4px 宽的轮廓线（原来 qgRect 一路铺到腔底，
     把圆底轮廓整段盖掉、还在两侧溢出管外）。 */
  function qgTubeBegin(g) {
    var c = g && g.c, t = qgLastTube;
    if (!c || !t || typeof c.save !== 'function') return false;
    c.save();
    qgTubePath(c, t.cx, t.y, t.r, t.h);
    if (typeof c.clip === 'function') c.clip();
    return true;
  }
  function qgTubeEnd(g) {
    var c = g && g.c;
    if (c && typeof c.restore === 'function') c.restore();
  }

  /* 试管：竖放，(x,y) 为管口左上角；返回管内空腔 {x,y,w,h} */
  function qgTube(g, x, y, w, h, lw) {
    qgLine(g, x, y, x, y + h - w / 2, null, lw || 1.4);
    qgLine(g, x + w, y, x + w, y + h - w / 2, null, lw || 1.4);
    var c = g && g.c;
    if (c) {
      c.save();
      c.beginPath();
      c.arc(x + w / 2, y + h - w / 2, w / 2, 0, Math.PI, false);
      c.strokeStyle = qgInk(g, null);
      c.lineWidth = lw || 1.4;
      c.stroke();
      c.restore();
    }
    qgLastTube = { cx: x + w / 2, y: y + 1.2, r: Math.max(1, w / 2 - 1.2), h: h - 2.4 };
    return { x: x + 1, y: y + 1, w: w - 2, h: h - 2 };
  }
  /* 圆底烧瓶：cx,cy = 球心；返回瓶内空腔（含瓶颈） */
  function qgFlask(g, cx, cy, r, neckW, neckH, lw) {
    qgCircle(g, cx, cy, r, null, null, lw || 1.4);
    qgLine(g, cx - neckW / 2, cy - r, cx - neckW / 2, cy - r - neckH, null, lw || 1.4);
    qgLine(g, cx + neckW / 2, cy - r, cx + neckW / 2, cy - r - neckH, null, lw || 1.4);
    qgLine(g, cx - neckW / 2, cy - r - neckH, cx + neckW / 2, cy - r - neckH, null, lw || 1.4);
    return { cx: cx, cy: cy, r: r - 2, top: cy - r - neckH + 2, neckW: neckW };
  }
  /* 烧杯 */
  function qgBeaker(g, x, y, w, h, lw) {
    qgPath(g, [[x, y], [x, y + h], [x + w, y + h], [x + w, y]], null, null, lw || 1.4, false);
    return { x: x + 1, y: y + 1, w: w - 2, h: h - 2 };
  }
  /* 酒精灯（含火焰，flame=0..1 控制火苗大小） */
  function qgLamp(g, cx, baseY, s, flame) {
    var f = flame === undefined ? 1 : flame;
    qgPath(g, [[cx - 16 * s, baseY], [cx + 16 * s, baseY],
      [cx + 12 * s, baseY - 14 * s], [cx - 12 * s, baseY - 14 * s]],
      null, 'rgba(38,34,28,.10)', 1.3, true);
    qgLine(g, cx - 3 * s, baseY - 14 * s, cx - 3 * s, baseY - 22 * s, null, 1.3);
    qgLine(g, cx + 3 * s, baseY - 14 * s, cx + 3 * s, baseY - 22 * s, null, 1.3);
    if (f > 0.02) {
      qgPath(g, [[cx - 4 * s, baseY - 22 * s],
        [cx, baseY - (22 + 22 * f) * s],
        [cx + 4 * s, baseY - 22 * s]],
        'rgba(200,120,40,.85)', 'rgba(240,190,90,.35)', 1.2, true);
    }
  }
  /* 气泡：phase 为动画相位 */
  function qgBubbles(g, x, y, w, h, phase, n, color) {
    var i, t, bx, by, r;
    for (i = 0; i < n; i++) {
      t = ((phase * 0.6 + i / n) % 1);
      bx = x + w * (0.15 + 0.7 * ((i * 37 % 100) / 100));
      by = y + h * (1 - t);
      r = 1.4 + 2.2 * (1 - t);
      qgCircle(g, bx, by, r, color || 'rgba(38,34,28,.55)', null, 1);
    }
  }
  /* 铁架台 */
  function qgStand(g, x, baseY, h) {
    qgLine(g, x, baseY, x, baseY - h, null, 2.4);
    qgLine(g, x - 22, baseY, x + 22, baseY, null, 2.4);
    qgLine(g, x, baseY - h, x + 26, baseY - h, null, 2);
  }
  /* 温度计：从 yTop 到水银球 yBulb，showBulb 决定画不画球 */
  function qgThermo(g, x, yTop, yBulb, lw) {
    qgLine(g, x, yTop, x, yBulb, null, lw || 2);
    qgCircle(g, x, yBulb, 3.2, null, 'rgba(180,60,60,.55)', 1);
  }
  /* 导管（折线管） */
  function qgPipe(g, pts, lw) { qgPath(g, pts, null, null, lw || 1.6, false); }
  /* 小标签（斜体、贴在物体下方） */
  function qgTag(g, s, x, y, px, color) {
    qgTxt(g, s, x, y, px || 11, 'center', color || 'rgba(38,34,28,.78)', true, false);
  }
  /* 光：从左上角射下的光线束 + 光源标记 */
  function qgLight(g, x, y, n, len, color) {
    var i;
    for (i = 0; i < n; i++) {
      qgLine(g, x + i * 14, y, x + i * 14 + len * 0.55, y + len, color || 'rgba(230,190,60,.75)', 1.4);
    }
  }
  /* 气味波纹（刺激性气味/果香） */
  function qgSmell(g, cx, y, phase, color) {
    var i, r;
    for (i = 0; i < 3; i++) {
      r = 6 + 7 * i + 4 * Math.sin(phase + i);
      qgCircle(g, cx, y - i * 9, Math.max(2, r * 0.42), color || 'rgba(120,90,40,.45)', null, 1.1);
    }
  }

  /* ---- 自适应画框：所有 draw 里的绝对坐标都按 780×500 的"设计坐标系"摆，
     再按真实画布等比缩放 + 居中。**这不是可选项**：中栏 canvas 的尺寸随窗口
     变化（实测桌面三栏下只有 426×537，竖长条），按固定像素硬画会把装置裁掉一半
     （第一版真机截图里"饱和食盐水/试管"只露出一角）。用 save/translate/scale
     包一层，线宽与字号也一起被缩放，画完 restore 不影响核心自己的绘制。 */
  var QG_DW = 780, QG_DH = 500;
  function qgFrame(g) {
    var c = g.c, W = qgNum(g.w, QG_DW), H = qgNum(g.h, QG_DH), s, ox, oy;
    s = Math.min(W / QG_DW, H / QG_DH);
    if (!(s > 0)) s = 1;
    ox = (W - QG_DW * s) / 2;
    oy = (H - QG_DH * s) / 2;
    QG_FS = s;
    if (typeof c.save === 'function') c.save();
    if (typeof c.translate === 'function') c.translate(ox, oy);
    if (typeof c.scale === 'function') c.scale(s, s);
    return { s: s, ox: ox, oy: oy };
  }
  function qgUnframe(g) {
    if (g && g.c && typeof g.c.restore === 'function') g.c.restore();
  }
  /* 圆底烧瓶里的液体/固体：**必须裁剪到球内**，否则矩形会伸出球外，
     看起来像在烧瓶上贴了一张方纸（第一版真机截图就是这样）。 */
  function qgFlaskFill(g, cx, cy, r, yTop, yBot, color) {
    var c = g && g.c;
    if (!c) return;
    if (typeof c.save === 'function') c.save();
    c.beginPath();
    c.arc(cx, cy, Math.max(1, r - 1.5), 0, Math.PI * 2, false);
    if (typeof c.clip === 'function') c.clip();
    qgRect(g, cx - r, yTop, r * 2, Math.max(0, yBot - yTop), null, color, 0);
    if (typeof c.restore === 'function') c.restore();
  }

  /* ======================================================================
   * 2 · 组 3 · 有机反应（11 个）
   * ==================================================================== */

  /* ---------------------------------------------------------------- 1 / 11
   * methane-substitute · 甲烷与氯气的取代反应
   * 来源 [S1]（实验教学与仪器 2025(11)，全文）+ [S5]（菁优网摘录）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('methane-substitute', {
    id: 'methane-substitute',
    name: '甲烷与氯气的取代反应',
    group: '有机反应',
    aim: '观察甲烷与氯气在光照下发生取代反应的现象，认识"光照"这一必要条件与油状液滴的成因',
    principle: 'CH4 + Cl2 --光照--> CH3Cl + HCl（自由基链式取代）：光照使 Cl—Cl 键均裂产生氯原子自由基，引发链反应；四步取代依次生成 CH3Cl、CH2Cl2、CHCl3、CCl4。' +
      'CH3Cl 常温下是气体，其余三种氯代甲烷都是难溶于水的油状液体（密度大于水），HCl 极易溶于水且遇水蒸气形成白雾。' +
      '所以管内会出现"黄绿色变浅、内壁油状液滴、少量白雾、液面上升"。教材要求"光亮处（不要日光直射）"：光照强度直接决定自由基产生的快慢，' +
      '日光直射会因反应剧烈放热而引起爆炸，避光则完全不反应。用饱和食盐水代替水是为了降低 Cl2 的溶解度、抑制 Cl2 与水的反应。',
    apparatus: ['大试管（或量筒）', '饱和食盐水水槽', '甲烷（CH4）', '氯气（Cl2，黄绿色）',
      '日光灯（漫射光/弱光）', '黑色纸套（避光对照）', '铁架台'],
    steps: [
      '用排饱和食盐水法在试管（或量筒）里收集甲烷与氯气：人教版按体积比约 1:1，苏教版按 1:4',
      '把试管倒扣在饱和食盐水中，放在"光亮处"用漫射光照射（教材明确：不要日光直射）',
      '观察黄绿色变浅、试管内壁的油状液滴、管内少量白雾与液面上升',
      '另取一支同样充气的试管，用黑纸套住避光作对照：管内无明显变化',
      '用湿润的蓝色石蕊试纸靠近管口（变红）或用 AgNO3 溶液检验，证明生成了 HCl'
    ],
    params: [
      {
        key: 'light', label: '光照条件', type: 'select', value: 'diffuse',
        options: [
          { value: 'diffuse', label: '漫射光（光亮处，不直射）' },
          { value: 'lamp', label: '日光灯下（弱光）' },
          { value: 'sun', label: '日光直射（强光，有爆炸危险）' },
          { value: 'dark', label: '避光（黑暗对照）' }
        ]
      },
      { key: 'ratio', label: 'Cl2 与 CH4 体积比', unit: '', min: 0.5, max: 4, step: 0.5, value: 1 },
      { key: 'time', label: '光照时间', unit: 'min', min: 1, max: 30, step: 1, value: 6 }
    ],
    /* 模型（纯定性反应：只用来决定"哪一种取代产物为主"与现象的强弱，不产生假数据）
       rate  ∝ 光强因子 L × (0.6 + 0.7×体积比)      —— 光越强、Cl2 越浓，自由基链反应越快
       extent = rate × t / 6                        —— 取代深度随光照时间累积
       深度 1~4 → 主产物 CH3Cl / CH2Cl2 / CHCl3 / CCl4（四步取代逐一取代一个 H） */
    react: function (p) {
      var light = qgSel(p, 'light', 'diffuse');
      var ratio = qgPN(p, 'ratio', 1);
      var t = qgPN(p, 'time', 6);
      var L = { diffuse: 1.0, lamp: 0.35, sun: 3.0, dark: 0 }[light];
      if (L === undefined) L = 1.0;
      var rate = L * (0.6 + 0.7 * ratio);
      var extent = rate * t / 6;
      if (light === 'dark') extent = 0;
      var depth = extent < 0.45 ? 1 : extent < 1.6 ? 1 : extent < 3.2 ? 2 : extent < 5.2 ? 3 : 4;
      var eqAll = [
        'CH4 + Cl2 = CH3Cl + HCl',
        'CH4 + 2Cl2 = CH2Cl2 + 2HCl',
        'CH4 + 3Cl2 = CHCl3 + 3HCl',
        'CH4 + 4Cl2 = CCl4 + 4HCl'
      ];
      var equation = eqAll[depth - 1];
      var product = ['一氯甲烷 CH3Cl（气体）', '二氯甲烷 CH2Cl2（油状液体）',
        '三氯甲烷 CHCl3（油状液体）', '四氯化碳 CCl4（油状液体）'][depth - 1];
      var ph = [];

      if (light === 'dark') {
        ph.push('试管内黄绿色气体颜色几乎不变（避光时 Cl—Cl 键无法均裂，自由基链反应不能引发）');
        ph.push('试管内壁没有油状液滴，管内液面也不上升（气体分子数几乎不变）');
        ph.push('这正是对照实验要说明的事：甲烷与氯气的取代反应必须由光照引发（B 管无明显现象）');
      } else if (light === 'sun') {
        ph.push('管内气体迅速褪色，反应非常剧烈（强光下自由基产生极快，链反应迅猛）');
        ph.push('大量白雾与油状液滴同时出现，试管壁很快挂满油状物');
        ph.push('反应放热使管内气体受热膨胀——教材明确要求"不要日光直射"，强光直射有可能引起爆炸');
      } else if (light === 'lamp' && extent < 1.0) {
        ph.push('日光灯下光照较弱，' + t + ' min 内只看到黄绿色略微变浅（室内日光灯下常出现"等很久、现象不明显"）');
        ph.push('试管内壁尚未出现明显的油状液滴，液面上升也很少');
      } else {
        ph.push('试管内黄绿色气体颜色逐渐变浅（Cl2 被消耗，生成 HCl 与氯代甲烷）');
        ph.push('试管内壁出现油状液滴，成分是 ' + product.replace(/（.*?）/, '') + ' 等难溶于水的氯代甲烷，密度大于水');
        ph.push('管内出现少量白雾（生成的 HCl 极易溶于水，遇水蒸气形成盐酸小液滴）');
        ph.push('管内液面上升（HCl 大量溶于饱和食盐水，气体减少、压强减小），但不会充满试管——因为 CH3Cl 是气体');
      }
      if (light !== 'dark' && depth >= 3) {
        ph.push('油状液滴明显增多并沉在管底：' + product + ' 的密度都大于水，且不再溶于水');
      }
      if (light !== 'dark' && depth === 4) {
        ph.push('氯气大大过量、光照时间又长，取代一直进行到四氯化碳（CCl4 是重要的有机溶剂）');
      }
      if (light !== 'dark' && ratio >= 3) {
        ph.push('Cl2 与 CH4 的体积比很大，深度取代的比例明显提高（Cl2 越多越容易继续取代）');
      }
      return {
        phenomena: ph,
        equation: equation,
        ionic: '',
        type: '取代反应（烷烃的自由基链式取代）',
        conditions: light === 'dark'
          ? '避光（黑暗对照）——此条件下不发生取代反应；方程式给出的是该体系在光照下的反应式'
          : (light === 'sun' ? '强光（日光直射）、常温——教材要求"光亮处，不要日光直射"'
            : '漫射光（光照）、常温，CH4 与 Cl2 体积比约 ' + ratio + ':1'),
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var light = qgSel(p, 'light', 'diffuse');
      var ratio = qgPN(p, 'ratio', 1);
      var t = qgPN(p, 'time', 6);
      var text = '甲烷与氯气在光照下发生取代反应：Cl2 在光照下均裂产生氯原子自由基，链反应逐步把 CH4 的氢原子换成氯原子，依次得到 CH3Cl、CH2Cl2、CHCl3、CCl4 和 HCl。' +
        '现象与条件一一对应：黄绿色变浅（Cl2 被消耗）、内壁油状液滴（CH2Cl2/CHCl3/CCl4 难溶于水、密度大于水）、少量白雾与液面上升（HCl 极易溶于水）。' +
        '本次条件：' + (light === 'dark' ? '避光（对照，无现象）' : light + '、体积比 ' + ratio + ':1、光照 ' + t + ' min') + '。';
      return {
        text: text,
        equation: 'CH4 + Cl2 = CH3Cl + HCl',
        ionic: '',
        errors: [
          '用日光直射代替漫射光：反应过于剧烈、放热集中，有爆炸危险（教材明确要求"光亮处，不要日光直射"）',
          '光照时间太短或只用室内弱光，自由基引发慢，看不到油状液滴与液面上升',
          '用水代替饱和食盐水：Cl2 溶解并与水反应，干扰液面上升的判断',
          '把"液面上升"当成"反应完全"：CH3Cl 是气体、难溶于饱和食盐水，液面最终不会充满试管',
          '氯气与甲烷的体积比不当（人教版 1:1、苏教版 1:4），取代程度难以控制，产物不是单一物质'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var light = qgSel(p, 'light', 'diffuse');
      var ratio = qgPN(p, 'ratio', 1);
      var t = qgPN(p, 'time', 6);
      var L = { diffuse: 1.0, lamp: 0.35, sun: 3.0, dark: 0 }[light];
      if (L === undefined) L = 1.0;
      var extent = qgClamp(L * (0.6 + 0.7 * ratio) * t / 6 / 6, 0, 1);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);

      /* 光源 */
      if (light === 'sun') {
        qgLight(g, 120, 26, 4, 74, 'rgba(230,180,40,.8)');
        qgCircle(g, 150, 40, 17, 'rgba(200,150,30,.9)', 'rgba(245,215,120,.55)', 1.4);
        qgTag(g, '日光直射（危险）', 150, 74, 11.5, 'rgba(150,90,20,.9)');
      } else if (light === 'diffuse' || light === 'lamp') {
        qgLight(g, 130, 26, 3, 60, light === 'lamp' ? 'rgba(180,180,120,.55)' : 'rgba(230,200,90,.6)');
        qgTxt(g, light === 'lamp' ? '日光灯（弱光）' : '漫射光（光亮处）', 118, 40, 11.5, 'left', 'rgba(120,100,40,.85)');
      } else {
        qgDashRect(g, 108, 22, 92, 40, 'rgba(38,34,28,.6)', 1.4);
        qgTxt(g, '黑纸套（避光对照）', 112, 40, 11.5, 'left', 'rgba(38,34,28,.7)');
      }

      /* 水槽 + 倒扣的试管：管内黄绿色气体柱高度随反应程度缩短 */
      var bx = 300, by = 360, bw = 300, bh = 96;
      qgPath(g, [[bx, by], [bx, by + bh], [bx + bw, by + bh], [bx + bw, by]], null, null, 1.6, false);
      qgRect(g, bx + 2, by + 26, bw - 4, bh - 28, null, 'rgba(150,190,215,.30)', 0);
      qgTag(g, '饱和食盐水（降低 Cl2 溶解度）', bx + bw / 2, by + bh + 18, 11.5);

      var tx = 420, ty = 120, tw = 62, th = 216;
      var inner = qgTube(g, tx, ty, tw, th);
      qgTubeBegin(g);                       /* 气体/液体/液滴全部裁剪在试管内腔里 */
      var gasH = inner.h * (1 - 0.72 * extent);
      /* 黄绿色气体 */
      qgRect(g, inner.x + 1, inner.y + 1, inner.w - 2, gasH, null,
        light === 'dark' ? 'rgba(180,205,90,.55)' : 'rgba(160,200,70,' + (0.25 + 0.55 * (1 - extent)) + ')', 0);
      /* 液面以上到管口的空气/白雾 */
      if (light === 'sun' || extent > 0.25) {
        qgRect(g, inner.x + 1, inner.y + 1, inner.w - 2, gasH * 0.42, null, 'rgba(255,255,255,.45)', 0);
      }
      /* 油状液滴：数量随取代深度增加 */
      var i, drops = Math.round(extent * 12);
      for (i = 0; i < drops; i++) {
        var dy = inner.y + 14 + (inner.h - 30) * ((i * 53 % 100) / 100);
        var dx = (i % 2 === 0) ? inner.x + 4 : inner.x + inner.w - 7;
        qgCircle(g, dx, dy, 3.4, 'rgba(90,70,40,.7)', 'rgba(220,190,120,.85)', 1);
      }
      /* 液面（水被压入试管） */
      var watY = inner.y + inner.h - inner.h * 0.72 * extent;
      qgRect(g, inner.x + 1, watY, inner.w - 2, inner.y + inner.h - watY, null, 'rgba(140,185,215,.45)', 0);
      qgLine(g, inner.x + 1, watY, inner.x + inner.w - 1, watY, 'rgba(60,110,150,.8)', 1.4);
      qgTubeEnd(g);
      qgTag(g, 'CH4 + Cl2（黄绿色）', tx + tw / 2, ty - 10, 11.5);
      qgTag(g, '液面上升 ' + Math.round(extent * 72) + '%', tx + tw / 2, ty + th + 4, 11);
      /* 管内气体与油状液滴的扰动（动画相位：优先用 state.t / state.anim，保证 run(1) 后画面会变） */
      qgBubbles(g, inner.x + 6, inner.y + 12, inner.w - 12, Math.max(12, gasH - 16), ph, 5,
        'rgba(255,255,255,.5)');

      /* 标题与状态 */
      qgTxt(g, '甲烷与氯气（光照取代）', 300, 56, 15, 'left', null, true, false);
      qgTxt(g,
        (light === 'dark' ? '避光：不发生取代反应' : '光照：黄绿色变浅 · 内壁油状液滴 · 少量白雾 · 液面上升'),
        300, 76, 12, 'left', 'rgba(38,34,28,.72)', true, false);
      if (extent > 0.55) {
        qgSmell(g, 380, 108, ph, 'rgba(200,200,200,.4)');
      }
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 2 / 11
   * ethylene-addition · 乙烯与溴的加成反应
   * 来源 [S5]（菁优网：1,2-二溴乙烷密度比水大、难溶于水、易溶于四氯化碳；
   *      教材用溴的四氯化碳溶液替代溴水以避免溴与水反应的产物干扰）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('ethylene-addition', {
    id: 'ethylene-addition',
    name: '乙烯与溴的加成反应',
    group: '有机反应',
    aim: '观察乙烯使溴水（或溴的四氯化碳溶液）褪色的现象，理解加成反应与取代反应的区别',
    principle: 'CH2=CH2 + Br2 → CH2BrCH2Br（1,2-二溴乙烷）。乙烯分子里的碳碳双键中有一对电子容易被打开，' +
      '溴原子直接加到两个碳原子上，双键变单键——这就是加成反应，常温下就能迅速进行，不需要光照。' +
      '生成的 1,2-二溴乙烷是无色油状液体，难溶于水、密度比水大（沉在水层下面），但易溶于四氯化碳，' +
      '所以溴水褪色后会分层、溴的四氯化碳溶液褪色后不分层。' +
      '加成反应不产生 HBr（没有白雾），这一点正是它与甲烷取代反应最直观的区别。' +
      '教材用溴的四氯化碳溶液代替溴水，是为了避免 Br2 与水反应的产物干扰对现象的观察。',
    apparatus: ['试管', '导管（通入乙烯）', '乙烯（C2H4）', '溴水（橙黄色）',
      '溴的四氯化碳溶液（橙红色）', '橡胶塞'],
    steps: [
      '取一支试管，加入 2~3 mL 溴水（或溴的四氯化碳溶液），观察颜色',
      '把乙烯气体经导管缓缓通入溶液中，边通边观察颜色变化',
      '溴水褪色后静置，观察液体是否分层、下层油状物的颜色与位置',
      '改换溴的四氯化碳溶液重复上述操作，比较两者的现象差异',
      '用湿润的蓝色石蕊试纸靠近导管口，确认没有酸性气体（不生成 HBr）'
    ],
    params: [
      {
        key: 'reagent', label: '溴的溶液', type: 'select', value: 'br2water',
        options: [
          { value: 'br2water', label: '溴水（橙黄色）' },
          { value: 'br2ccl4', label: '溴的四氯化碳溶液（橙红色）' }
        ]
      },
      { key: 'br2Ratio', label: '溴与乙烯的物质的量之比', unit: '', min: 0.5, max: 3, step: 0.1, value: 1 },
      { key: 'c2h4Vol', label: '通入乙烯的体积', unit: 'mL', min: 10, max: 100, step: 5, value: 40 }
    ],
    /* 模型：褪色程度 ∝ 乙烯量 / 需要的溴量；生成油状物的量 ∝ min(溴, 乙烯) */
    react: function (p) {
      var rg = qgSel(p, 'reagent', 'br2water');
      var k = qgPN(p, 'br2Ratio', 1);      /* 溴相对乙烯的物质的量之比 */
      var v = qgPN(p, 'c2h4Vol', 40);      /* 通入乙烯的体积 mL */
      var need = v / 40;                   /* 把 40 mL 乙烯当作"1 份" */
      var dec = qgClamp(need / k, 0, 1.4); /* >1 表示溴被耗尽、褪色彻底 */
      var made = qgClamp(Math.min(need, k) / 1.6, 0, 1); /* 生成 1,2-二溴乙烷的相对量 */
      var ph = [];
      if (rg === 'br2water') {
        if (dec >= 1) {
          ph.push('橙黄色的溴水颜色完全褪去，溶液变为无色（Br2 全部与乙烯加成而被消耗）');
        } else {
          ph.push('溴水的橙黄色明显变浅但没有褪尽（通入的乙烯不够，Br2 有剩余）');
        }
        if (made > 0.15) {
          ph.push('静置后液体分成两层：上层水层接近无色，下层出现无色油状液体（1,2-二溴乙烷难溶于水、密度比水大，沉在下面）');
        } else {
          ph.push('分层不明显：生成的 1,2-二溴乙烷很少，还看不到明显的油状下层');
        }
        ph.push('导管口没有白雾、也没有酸性气体（加成反应不生成 HBr，这一点与甲烷的取代反应不同）');
      } else {
        if (dec >= 1) {
          ph.push('橙红色的溴的四氯化碳溶液褪为无色（Br2 被乙烯加成消耗）');
        } else {
          ph.push('橙红色明显变浅但仍带浅橙色（乙烯量不足，溶液里还有 Br2）');
        }
        ph.push('溶液始终只有一层、不分层：生成的 1,2-二溴乙烷易溶于四氯化碳');
        ph.push('导管口没有白雾（不生成 HBr）；教材用溴的四氯化碳溶液，正是为了避免溴与水的反应产物干扰观察');
      }
      if (k > 1.8) {
        ph.push('溴相对于乙烯过量较多，褪色需要通入更多乙烯（溴越多，"褪色"这一现象越不容易看完全）');
      }
      return {
        phenomena: ph,
        equation: 'C2H4 + Br2 = C2H4Br2',
        ionic: '',
        type: '加成反应（碳碳双键与溴的加成）',
        conditions: '常温、常压，不需要光照和催化剂（乙烯与溴的水溶液或四氯化碳溶液直接加成）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var rg = qgSel(p, 'reagent', 'br2water');
      var k = qgPN(p, 'br2Ratio', 1);
      var v = qgPN(p, 'c2h4Vol', 40);
      return {
        text: '乙烯通入溴水（或溴的四氯化碳溶液）时，Br2 与碳碳双键发生加成：双键中较活泼的一对电子打开，两个溴原子分别加到两个碳原子上，' +
          '生成无色的 1,2-二溴乙烷，所以溶液褪色。本次用了' + (rg === 'br2water' ? '溴水' : '溴的四氯化碳溶液') +
          '：' + (rg === 'br2water' ? '褪色后分层，下层是无色油状液体（密度比水大、难溶于水）' :
            '褪色后不分层（1,2-二溴乙烷易溶于四氯化碳）') +
          '。溴与乙烯的物质的量之比为 ' + k + '，通入乙烯 ' + v + ' mL。',
        equation: 'C2H4 + Br2 = C2H4Br2',
        ionic: '',
        errors: [
          '把加成当成取代：加成不产生 HBr（导管口无白雾），而甲烷与溴蒸气的取代会生成 HBr',
          '用溴的四氯化碳溶液却按"分层"去判断——该体系只有一层，应看颜色是否褪尽',
          '乙烯通入量太少，溴未褪尽就下结论（溶液仍显浅橙色说明还有 Br2）',
          '把褪色后的分层现象误认为"生成了沉淀"：1,2-二溴乙烷是油状液体，不是沉淀',
          '先通入的乙烯中混有 SO2 等还原性杂质，它们也能使溴水褪色，会干扰判断'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var rg = qgSel(p, 'reagent', 'br2water');
      var k = qgPN(p, 'br2Ratio', 1);
      var v = qgPN(p, 'c2h4Vol', 40);
      var need = v / 40;
      var dec = qgClamp(need / k, 0, 1.4);
      var made = qgClamp(Math.min(need, k) / 1.6, 0, 1);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);

      /* 试管 */
      var tx = 330, ty = 90, tw = 96, th = 250;
      var inner = qgTube(g, tx, ty, tw, th);
      qgTubeBegin(g);                       /* 液体/油层裁剪在试管内腔里 */
      var isWater = (rg === 'br2water');
      /* 液体：溴的颜色随褪色程度变浅 */
      var alpha = qgClamp(0.85 * (1 - dec * 0.95), 0.04, 0.9);
      var liqTop = inner.y + 34;
      if (isWater && made > 0.15) {
        /* 下层油状 1,2-二溴乙烷 */
        var oilH = 16 + 44 * made;
        qgRect(g, inner.x + 1, inner.y + inner.h - oilH, inner.w - 2, oilH, null, 'rgba(226,220,200,.85)', 0);
        qgLine(g, inner.x + 1, inner.y + inner.h - oilH, inner.x + inner.w - 1, inner.y + inner.h - oilH,
          'rgba(90,80,60,.7)', 1.2);
        qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.h - (liqTop - inner.y) - oilH, null,
          'rgba(232,140,40,' + alpha + ')', 0);
        qgTag(g, '下层：1,2-二溴乙烷（油状、密度大于水）', tx + tw / 2, ty + th + 16, 11);
      } else {
        qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.y + inner.h - liqTop, null,
          (isWater ? 'rgba(232,140,40,' : 'rgba(220,90,40,') + alpha + ')', 0);
      }
      qgTubeEnd(g);
      /* 导管 + 气泡 */
      qgPipe(g, [[tx + tw / 2, 40], [tx + tw / 2, ty + 26]], 2);
      qgBubbles(g, inner.x + 6, liqTop + 12, inner.w - 12, inner.y + inner.h - liqTop - 18, ph, 7,
        'rgba(255,255,255,.75)');
      qgTag(g, '乙烯', tx + tw / 2, 30, 12);
      qgTag(g, isWater ? '溴水' : '溴的四氯化碳溶液', tx + tw / 2, ty - 10, 12);

      /* 对照：颜色卡 */
      qgTxt(g, '加成反应：C2H4 + Br2 = C2H4Br2', 60, 70, 14.5, 'left', null, true, false);
      qgTxt(g, isWater ? '现象：褪色后分层，下层油状（难溶于水、密度大于水）'
        : '现象：褪色后不分层（产物易溶于 CCl4）', 60, 92, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '无白雾、无 HBr 生成 —— 与取代反应的区别', 60, 112, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgRect(g, 60, 130, 46, 22, 'rgba(38,34,28,.5)', 'rgba(232,140,40,.8)', 1);
      qgTxt(g, '反应前', 60, 170, 11, 'left', 'rgba(38,34,28,.7)');
      qgRect(g, 60, 190, 46, 22, 'rgba(38,34,28,.5)', 'rgba(232,140,40,' + alpha + ')', 1);
      qgTxt(g, '反应后（褪色 ' + Math.round(dec * 100) + '%）', 60, 230, 11, 'left', 'rgba(38,34,28,.7)');
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 3 / 11
   * ethylene-polymer · 乙烯的加聚反应
   * 来源 [S6]（科普中国《聚乙烯》全文）+ [S5]（nCH2=CH2 催化剂→ 聚乙烯）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('ethylene-polymer', {
    id: 'ethylene-polymer',
    name: '乙烯的加聚反应（制聚乙烯）',
    group: '有机反应',
    aim: '观察乙烯加聚成聚乙烯的条件与现象，理解加聚反应中"气体分子数急剧减少"与产物性质的关系',
    principle: 'nCH2=CH2 --催化剂--> [-CH2—CH2-]n，写成一个式子就是 nC2H4 → (C2H4)n' +
      '（聚合度 n 很大，本台在方程式里把它写实为 n=1000：1000C2H4 = (C2H4)1000，便于逐元素核对）。' +
      '加聚反应里双键打开、分子互相"手拉手"连成很长的链，所以气体分子数急剧减少（压强下降）、生成常温下为固体的高分子。' +
      '条件决定产物：用 TiCl4-Al(C2H5)3（齐格勒-纳塔催化剂）在较低温度、较低压力下聚合，得到支链少、密度高的高密度聚乙烯（HDPE）；' +
      '用微量氧或有机过氧化物引发，在 200~300 ℃、100~300 MPa 下聚合，得到支链多、密度低的低密度聚乙烯（LDPE）。' +
      '聚乙烯是无味无臭、无毒的乳白色蜡状（白色粉末/颗粒）固体，不溶于水，密度约 0.92 g/cm³，熔点约 108~126 ℃，有热塑性。',
    apparatus: ['耐压反应器（或密闭试管）', '乙烯（C2H4）', 'TiCl4-Al(C2H5)3 催化剂',
      '微量 O2 / 有机过氧化物引发剂', '压力表', '水浴/油浴加热装置'],
    steps: [
      '把乙烯通入密闭反应器，加入少量齐格勒-纳塔催化剂（或过氧化物引发剂）',
      '按所选方法控制温度与压强（低压法约 60~75 ℃、0.5~1 MPa；高压法约 200~300 ℃、100~300 MPa）',
      '观察压力表读数下降与器壁上逐渐析出的白色固体',
      '取出产物，观察颜色、状态、溶解性（不溶于水）与热塑性（受热变软、冷却变硬）',
      '比较两种条件得到的聚乙烯：较硬（HDPE）与较软（LDPE）'
    ],
    params: [
      {
        key: 'cat', label: '催化剂/引发剂', type: 'select', value: 'zn',
        options: [
          { value: 'zn', label: 'TiCl4-Al(C2H5)3（齐格勒-纳塔，低压法）' },
          { value: 'peroxide', label: '微量 O2 / 有机过氧化物（高压法）' }
        ]
      },
      { key: 'temp', label: '聚合温度', unit: '℃', min: 40, max: 320, step: 10, value: 70 },
      { key: 'press', label: '聚合压强', unit: 'MPa', min: 0.5, max: 300, step: 0.5, value: 1 }
    ],
    /* 模型（定性；两个方向都来自真实规律）
       转化率：压强越高（气体分子数减少的方向）越大；温度偏离该催化体系的适宜温度越远越小
       产物结构：催化剂决定支链多少→密度；温度越高，链转移越容易→支链增多→密度与结晶度下降 */
    react: function (p) {
      var cat = qgSel(p, 'cat', 'zn');
      var temp = qgPN(p, 'temp', 70);
      var press = qgPN(p, 'press', 1);
      var zn = (cat === 'zn');
      var pressRef = zn ? 1 : 200;        /* 该体系的参考压强 MPa */
      var tOpt = zn ? 70 : 250;           /* 该体系的适宜温度 ℃ */
      /* 转化率随压强单调增大（加聚是气体分子数减少的方向，加压有利），但不会到 100% */
      var conv = 0.05 + 0.93 * (press / (press + pressRef * 0.4)) *
        qgClamp(1 - Math.abs(temp - tOpt) / 260, 0.15, 1);
      conv = qgClamp(conv, 0.02, 0.985);
      /* 密度：支链越多密度越低（HDPE 约 0.95、LDPE 约 0.92 g/cm³） */
      var dens = (zn ? 0.950 : 0.922) - 0.0035 * Math.max(0, (temp - tOpt) / 40) - (zn ? 0 : 0.004);
      dens = qgClamp(dens, 0.905, 0.960);
      var soft = 108 + 22 * (dens - 0.920) / 0.035;   /* 软化温度 ≈ 108~130 ℃ */
      var ph = [];
      ph.push('反应器内压强不断下降（气体分子数急剧减少：n 个乙烯分子聚合成 1 个大分子），压力表读数从 ' +
        qgFix(press, 1) + ' MPa 降到约 ' + qgFix(press * (1 - conv), 1) + ' MPa');
      ph.push('器壁（或液面下）逐渐析出白色蜡状固体——聚乙烯，无味无臭、不溶于水（转化率约 ' +
        Math.round(conv * 100) + '%）');
      if (conv > 0.6) {
        ph.push('产物较多，取出后能明显地"受热变软、冷却变硬"（热塑性，软化温度约 ' + Math.round(soft) + ' ℃）');
      } else {
        ph.push('产物很少，只有薄薄一层白色粉末（温度或压强偏离该催化体系的适宜条件，聚合很慢）');
      }
      if (zn) {
        ph.push('低压法（' + Math.round(temp) + ' ℃ / ' + qgFix(press, 1) +
          ' MPa）得到的是支链少、密度较高（约 ' + qgFix(dens, 3) + ' g/cm³）、较硬的高密度聚乙烯 HDPE');
      } else {
        ph.push('高压法（' + Math.round(temp) + ' ℃ / ' + qgFix(press, 1) +
          ' MPa）得到的是支链多、密度较低（约 ' + qgFix(dens, 3) + ' g/cm³）、较柔软的低密度聚乙烯 LDPE');
      }
      ph.push('方程式按聚合度 n=1000 写出：1000C2H4 = (C2H4)1000（通式 nC2H4 → (C2H4)n，实际产物的聚合度可达数千，' +
        '分子量约 1 万~10 万）');
      if (temp > (zn ? 200 : 320) - 1) {
        ph.push('温度过高，链转移与降解加剧，产物发软、发黄（分子量下降）');
      }
      if (press < pressRef * 0.25) {
        ph.push('压强远低于该体系的常用值，气体分子"碰头"的机会少，聚合速率与转化率都很低');
      }
      return {
        phenomena: ph,
        equation: '1000C2H4 = (C2H4)1000',
        ionic: '',
        type: '加聚反应（不饱和单体的聚合反应）',
        conditions: zn
          ? 'TiCl4-Al(C2H5)3（齐格勒-纳塔催化剂）、低压法（约 60~75 ℃、0.5~1 MPa）'
          : '微量 O2 / 有机过氧化物引发、高压法（约 200~300 ℃、100~300 MPa）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var cat = qgSel(p, 'cat', 'zn');
      var temp = qgPN(p, 'temp', 70);
      var press = qgPN(p, 'press', 1);
      var zn = (cat === 'zn');
      return {
        text: '乙烯加聚时碳碳双键打开、分子彼此相连，生成高分子聚乙烯：nC2H4 → (C2H4)n，结构简式是 [-CH2—CH2-]n。' +
          '因为 n 个气体分子变成 1 个大分子，容器内压强明显下降；产物是不溶于水的白色蜡状固体，有热塑性。' +
          '本次用' + (zn ? '齐格勒-纳塔催化剂（低压法）' : '过氧化物引发（高压法）') + '，' +
          Math.round(temp) + ' ℃、' + qgFix(press, 1) + ' MPa：' +
          (zn ? '支链少、密度高、较硬（HDPE）' : '支链多、密度低、较软（LDPE）') + '。',
        equation: '1000C2H4 = (C2H4)1000',
        ionic: '',
        errors: [
          '温度过高：链转移与热降解加剧，分子量下降，产物发软、发黄，甚至结块',
          '压强不足（尤其高压法）：乙烯分子碰撞机会少，转化率低，看不到明显的白色固体',
          '催化剂或引发剂用量、种类不当，得到的是支链结构不同的聚乙烯（密度与软硬不一样）',
          '把加聚与加成混为一谈：加聚生成高分子，产物不再是气体，容器内压强会明显下降',
          '反应器密闭性差导致乙烯泄漏，压强降不下来，转化率与分子量都偏低'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var cat = qgSel(p, 'cat', 'zn');
      var temp = qgPN(p, 'temp', 70);
      var press = qgPN(p, 'press', 1);
      var zn = (cat === 'zn');
      var pressRef = zn ? 1 : 200;
      var tOpt = zn ? 70 : 250;
      var conv = qgClamp(0.05 + 0.93 * (press / (press + pressRef * 0.4)) *
        qgClamp(1 - Math.abs(temp - tOpt) / 260, 0.15, 1), 0.02, 0.985);
      var dens = qgClamp((zn ? 0.950 : 0.918) - 0.0035 * Math.max(0, (temp - tOpt) / 40), 0.905, 0.960);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);

      /* 反应器 */
      var fx = 150, fy = 400, fr = 84;
      var fl = qgFlask(g, fx + fr, fy - fr, fr, 34, 52);
      /* 内部气体颜色（压力越高越"浓"） */
      var gasA = qgClamp(0.10 + 0.35 * qgClamp(press / pressRef, 0, 1), 0.08, 0.45);
      qgCircle(g, fl.cx, fl.cy, fl.r, null, 'rgba(150,190,215,' + gasA + ')', 1.2);
      /* 生成的聚乙烯（白色固体，堆在球底） */
      var solidH = 8 + 52 * conv;
      qgFlaskFill(g, fl.cx, fl.cy, fl.r, fl.cy + fl.r - solidH, fl.cy + fl.r, 'rgba(250,248,240,.95)');
      qgTxt(g, zn ? 'HDPE（低压法）' : 'LDPE（高压法）', fl.cx, fl.cy + fl.r + 22, 12, 'center',
        'rgba(38,34,28,.75)', true, false);
      /* 压力表 */
      var gx = 520, gy = 150, gr = 46;
      qgCircle(g, gx, gy, gr, 'rgba(38,34,28,.8)', 'rgba(255,255,255,.65)', 1.6);
      var ang = -Math.PI / 2 + Math.PI * 1.6 * qgClamp(1 - press / (zn ? 3 : 320), 0, 1);
      qgLine(g, gx, gy, gx + Math.cos(ang) * (gr - 8), gy + Math.sin(ang) * (gr - 8), 'rgba(180,60,60,.9)', 2);
      qgTxt(g, '压力表', gx, gy + gr + 16, 11.5, 'center', 'rgba(38,34,28,.7)', true, false);
      qgTxt(g, qgFix(press, 1) + ' MPa', gx, gy + 6, 12, 'center', null, true, false);
      /* 数据文字 */
      qgTxt(g, '乙烯加聚（加聚反应）', 60, 60, 15, 'left', null, true, false);
      qgTxt(g, '条件：' + (zn ? 'TiCl4-Al(C2H5)3、60~75 ℃、0.5~1 MPa' : '过氧化物引发、200~300 ℃、100~300 MPa'),
        60, 82, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '转化率 ≈ ' + Math.round(conv * 100) + '%   密度 ≈ ' + qgFix(dens, 3) + ' g/cm³',
        60, 104, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '1000C2H4 = (C2H4)1000（通式 nC2H4 → (C2H4)n）', 60, 126, 12, 'left', null, true, true);
      qgBubbles(g, fl.cx - fl.r * 0.7, fl.cy - fl.r * 0.4, fl.r * 1.4, fl.r * 1.2, ph, 6,
        'rgba(255,255,255,.6)');
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 4 / 11
   * ethanol-oxidation · 乙醇的催化氧化
   * 来源 [S5]（菁优网：铜丝灼烧变黑→插入乙醇变红、刺激性气味乙醛、
   *      2CH3CH2OH+O2 --Cu,Δ--> 2CH3CHO+2H2O；乙醇沸点 78 ℃、乙醛沸点 20.8 ℃）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('ethanol-oxidation', {
    id: 'ethanol-oxidation',
    name: '乙醇的催化氧化（铜或银作催化剂）',
    group: '有机反应',
    aim: '观察铜丝"由红变黑、再由黑变红"的现象，认识乙醇催化氧化成乙醛的条件与断键位置',
    principle: '2CH3CH2OH + O2 --Cu,Δ--> 2CH3CHO + 2H2O。分两步看更清楚：' +
      '① 2Cu + O2 --Δ--> 2CuO（灼烧时铜丝表面由紫红色变黑）；' +
      '② CH3CH2OH + CuO --Δ--> CH3CHO + Cu + H2O（把灼烧过的铜丝插入乙醇，CuO 被乙醇还原，铜丝又变回光亮的紫红色）。' +
      '乙醇分子断的是 O—H 键和与羟基相连的碳上的 C—H 键（α-H），脱去两个氢原子形成醛基，所以产物是乙醛。' +
      '铜（或银）在两步里一失一得氧，本身的质量和化学性质都不变，是催化剂。' +
      '乙醛沸点只有 20.8 ℃，常温下就容易挥发，所以能闻到强烈的刺激性气味；它还能被新制 Cu(OH)2 氧化（加热出现砖红色沉淀）或发生银镜反应，可用来检验。',
    apparatus: ['试管（或锥形瓶）', '螺旋状铜丝（或铜网）', '无水乙醇', '酒精灯',
      '鼓入空气的洗耳球/气泵', '新制 Cu(OH)2（检验乙醛）'],
    steps: [
      '把铜丝绕成螺旋状（增大与乙醇蒸气的接触面），在酒精灯上灼烧到表面变黑（生成 CuO）',
      '迅速把灼烧过的铜丝插入盛有乙醇的试管中，观察铜丝表面颜色的变化',
      '反复"灼烧—插入"几次，闻试管内的气味（乙醛的刺激性气味）',
      '取反应后的溶液，加入新制 Cu(OH)2 悬浊液并加热，观察砖红色沉淀（检验乙醛）',
      '比较通空气与通纯氧、不同灼烧温度下的现象差异'
    ],
    params: [
      {
        key: 'cat', label: '催化剂形状', type: 'select', value: 'wire',
        options: [
          { value: 'wire', label: '螺旋状铜丝（Cu）' },
          { value: 'net', label: '铜网（Cu，接触面更大）' }
        ]
      },
      { key: 'temp', label: '灼烧温度', unit: '℃', min: 150, max: 600, step: 10, value: 400 },
      {
        key: 'oxidant', label: '氧的来源', type: 'select', value: 'air',
        options: [
          { value: 'air', label: '鼓入空气（O2 约占 1/5）' },
          { value: 'o2', label: '通入纯氧' }
        ]
      },
      { key: 'cycles', label: '反复"灼烧—插入"次数', unit: '次', min: 1, max: 6, step: 1, value: 3 }
    ],
    /* 模型（定性）：温度决定 CuO 能否生成；氧浓度与次数决定乙醛生成的多少 */
    react: function (p) {
      var cat = qgSel(p, 'cat', 'wire');
      var temp = qgPN(p, 'temp', 400);
      var ox = qgSel(p, 'oxidant', 'air');
      var cyc = qgPN(p, 'cycles', 3);
      var surface = (cat === 'net') ? 1.35 : 1.0;
      var tempF = qgClamp((temp - 150) / 300, 0, 1.15);       /* 温度越高，CuO 生成越快 */
      var oxF = (ox === 'o2') ? 1.6 : 1.0;
      var amount = qgClamp(tempF * oxF * surface * cyc / 3.6, 0, 1.3);
      var ph = [];

      if (temp < 300) {
        ph.push('铜丝在酒精灯上只烧到暗红，表面没有明显变黑（温度不够，生成的 CuO 很少）');
        ph.push('迅速插入乙醇后几乎闻不到刺激性气味（催化氧化几乎不发生）');
      } else {
        ph.push('灼烧时铜丝表面由紫红色变成黑色（2Cu + O2 --Δ--> 2CuO）');
        ph.push('把灼烧过的铜丝迅速插入乙醇，铜丝表面又变回光亮的紫红色（CuO 被乙醇还原成 Cu，铜丝起催化作用）');
        if (amount > 0.35) {
          ph.push('试管内产生有强烈刺激性气味的气体（乙醛，沸点约 20.8 ℃，常温下容易挥发）');
        } else {
          ph.push('试管内只有很淡的刺激性气味（生成的乙醛少）');
        }
        if (cyc >= 3) {
          ph.push('反复"灼烧—插入" ' + cyc + ' 次后，试管内液体明显减少、刺激性气味越来越浓（乙醛不断生成并逸出）');
        }
      }
      if (ox === 'o2' && temp >= 300 && cyc >= 4) {
        ph.push('氧气充足又反复多次时，乙醛会进一步被氧化成乙酸（刺激性气味中夹有酸味，产物不再只是乙醛）');
      }
      if (cat === 'net') {
        ph.push('改用铜网：与乙醇蒸气的接触面更大，同样次数下现象更明显（催化剂表面越大，催化效率越高）');
      }
      return {
        phenomena: ph,
        equation: '2CH3CH2OH + O2 = 2CH3CHO + 2H2O',
        ionic: '',
        type: '氧化反应（醇的催化氧化，羟基被氧化成醛基）',
        conditions: 'Cu 催化、加热（铜丝在酒精灯上灼烧至表面变黑后迅速插入乙醇）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var temp = qgPN(p, 'temp', 400);
      var cyc = qgPN(p, 'cycles', 3);
      var ox = qgSel(p, 'oxidant', 'air');
      return {
        text: '乙醇的催化氧化分两步：铜先被氧气氧化成黑色的 CuO，CuO 再把乙醇氧化成乙醛、自身变回红色的铜。' +
          '断键位置是乙醇的 O—H 键和 α-C 上的 C—H 键，脱去两个氢形成醛基，所以产物是乙醛（不是乙酸）。' +
          '本次灼烧温度 ' + Math.round(temp) + ' ℃、' + (ox === 'o2' ? '通纯氧' : '鼓空气') +
          '、反复 ' + cyc + ' 次：' + (temp < 300 ? '温度不足，铜丝没有明显变黑，几乎看不到反应。'
            : '铜丝"黑→红"的变化与乙醛的刺激性气味都很明显。') +
          '产物乙醛可用新制 Cu(OH)2 加热（砖红色沉淀）或银镜反应检验。',
        equation: '2CH3CH2OH + O2 = 2CH3CHO + 2H2O',
        ionic: '',
        errors: [
          '铜丝没有灼烧到表面变黑（CuO 生成不足）就插入乙醇，看不到"由黑变红"',
          '灼烧温度过高、时间过长：乙醇大量挥发，甚至在管口燃烧，乙醛也被进一步氧化成乙酸',
          '把灼烧的铜丝一直停留在火焰上而不插入乙醇，只能看到铜被氧化，观察不到乙醇被氧化',
          '检验乙醛时没有用新制 Cu(OH)2 并加热，或者体系不是碱性，看不到砖红色沉淀',
          '把乙醛的刺激性气味当成"乙醇挥发"：乙醛沸点只有 20.8 ℃，必须结合砖红色沉淀或银镜来确认'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var cat = qgSel(p, 'cat', 'wire');
      var temp = qgPN(p, 'temp', 400);
      var ox = qgSel(p, 'oxidant', 'air');
      var cyc = qgPN(p, 'cycles', 3);
      var hot = qgClamp((temp - 150) / 300, 0, 1.15);
      var amount = qgClamp(hot * ((ox === 'o2') ? 1.6 : 1.0) * ((cat === 'net') ? 1.35 : 1) * cyc / 3.6, 0, 1.3);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);
      /* 铜丝颜色：灼烧时黑（CuO），插入后红（Cu）——用相位在两者间摆动，模拟反复操作 */
      var blink = (Math.sin(ph * 1.6) + 1) / 2;
      var copper = hot < 0.25 ? 'rgba(170,90,60,.85)'
        : (blink > 0.5 ? 'rgba(30,28,26,.92)' : 'rgba(196,92,58,.95)');

      /* 试管 + 乙醇 */
      var tx = 300, ty = 120, tw = 104, th = 220;
      var inner = qgTube(g, tx, ty, tw, th);
      qgTubeBegin(g);                       /* 液体裁剪在试管内腔里 */
      var liqTop = inner.y + inner.h * 0.34;
      qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.y + inner.h - liqTop, null, 'rgba(180,210,225,.45)', 0);
      qgLine(g, inner.x + 1, liqTop, inner.x + inner.w - 1, liqTop, 'rgba(70,120,150,.8)', 1.2);
      qgTubeEnd(g);
      qgTag(g, '无水乙醇', tx + tw / 2, ty + th + 16, 11.5);

      /* 铜丝（螺旋） */
      var cxi = tx + tw / 2, cy0 = ty + 58, i;
      for (i = 0; i < 6; i++) {
        qgCircle(g, cxi, cy0 + i * 11, (cat === 'net' ? 12 : 8), copper, null, 3.4);
      }
      qgLine(g, cxi, ty - 26, cxi, cy0, copper, 2.6);
      qgTag(g, (cat === 'net' ? '铜网' : '螺旋铜丝') + '（' + (blink > 0.5 ? 'CuO 黑色' : 'Cu 红色') + '）',
        tx + tw / 2, ty - 34, 11.5);

      /* 酒精灯 */
      qgLamp(g, tx + tw / 2 - 130, 452, 1.1, qgClamp(hot, 0.15, 1));
      qgTag(g, '酒精灯', tx + tw / 2 - 130, 470, 11);

      /* 刺激性气味 */
      if (amount > 0.3) {
        qgSmell(g, tx + tw + 44, ty + 26, ph, 'rgba(150,110,40,.5)');
        qgTxt(g, '刺激性气味（乙醛）', tx + tw + 20, ty + 66, 12, 'left', 'rgba(140,90,30,.9)', true, false);
      }
      /* 数据 */
      qgTxt(g, '乙醇催化氧化', 56, 62, 15, 'left', null, true, false);
      qgTxt(g, '2CH3CH2OH + O2 = 2CH3CHO + 2H2O', 56, 84, 12.5, 'left', null, true, true);
      qgTxt(g, '灼烧温度 ' + Math.round(temp) + ' ℃   ' + (ox === 'o2' ? '通纯氧' : '鼓入空气') +
        '   反复 ' + cyc + ' 次', 56, 106, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '现象：铜丝 由红变黑（CuO）→ 由黑变红（Cu）', 56, 128, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '产物检验：新制 Cu(OH)2 加热 → 砖红色 Cu2O', 56, 150, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgBubbles(g, inner.x + 8, liqTop + 10, inner.w - 16, inner.y + inner.h - liqTop - 14, ph, 5,
        'rgba(255,255,255,.7)');
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 5 / 11
   * ethanol-elimination · 乙醇的消去反应（170 ℃ 制乙烯 / 140 ℃ 生成乙醚）
   * 来源 [S2]（实验教学与仪器 2025(4)，全文）+ [S5]（菁优网：170 ℃/140 ℃、
   *      温度计插液面下、迅速升温、副产物 SO2、乙醇与浓硫酸体积比约 1:3）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('ethanol-elimination', {
    id: 'ethanol-elimination',
    name: '乙醇的消去反应（浓硫酸、170 ℃ 制乙烯）',
    group: '有机反应',
    aim: '观察乙醇与浓硫酸共热时"170 ℃ 生成乙烯、140 ℃ 生成乙醚"的条件差异，理解温度与副反应的关系',
    principle: '分子内脱水（消去反应）：CH3CH2OH --浓硫酸,170℃--> CH2=CH2↑ + H2O，乙醇分子里脱去一个羟基和相邻碳上的一个氢，形成碳碳双键。' +
      '分子间脱水（取代反应）：2CH3CH2OH --浓硫酸,140℃--> CH3CH2OCH2CH3 + H2O，两个乙醇分子之间脱掉一分子水生成乙醚。' +
      '所以浓硫酸既是催化剂又是脱水剂，而**温度决定产物**：必须迅速升温到 170 ℃ 并保持在 170 ℃。' +
      '温度偏低（140 ℃ 左右）主要得到乙醚；升温太慢会在 140 ℃ 区间停留过久，乙醚增多。' +
      '浓硫酸还会使乙醇脱水炭化并把自身还原，产生 SO2 与 CO2，所以气体必须先经 NaOH 溶液除去 SO2 等杂质，' +
      '再用溴的四氯化碳溶液（或酸性 KMnO4 溶液）检验乙烯——否则 SO2 也能使溴水褪色，结论不可靠。' +
      '温度计的水银球必须插入反应液面以下，才能测到反应液的温度。',
    apparatus: ['圆底烧瓶（配温度计与导管）', '无水乙醇', '浓硫酸', '碎瓷片（沸石）',
      '酒精灯（或酒精喷灯）', 'NaOH 溶液洗气瓶', '溴的四氯化碳溶液 / 酸性 KMnO4 溶液'],
    steps: [
      '在圆底烧瓶中加入无水乙醇，再沿瓶壁慢慢加入浓硫酸（乙醇与浓硫酸体积比约 1:3），摇匀并放入几片碎瓷片',
      '插好温度计，让水银球插入反应液面以下；导管另一端先通入 NaOH 溶液洗气瓶，再连到溴的四氯化碳溶液中',
      '迅速加热使液体温度升到 170 ℃ 并保持（不要慢慢升温，以免在 140 ℃ 区间停留太久生成乙醚）',
      '观察反应液逐渐变黄→变黑（炭化）、导管口气体的刺激性气味与溴的四氯化碳溶液褪色',
      '改用 140 ℃ 左右重复实验：逸出气体明显减少，产物主要是乙醚（冷凝后收集为液体），溴的四氯化碳溶液不褪色'
    ],
    params: [
      { key: 'temp', label: '反应液温度', unit: '℃', min: 100, max: 200, step: 5, value: 170 },
      { key: 'acidRatio', label: '浓硫酸与乙醇的体积比', unit: '', min: 1, max: 3, step: 0.5, value: 3 },
      {
        key: 'heat', label: '升温方式', type: 'select', value: 'fast',
        options: [
          { value: 'fast', label: '迅速升温（酒精喷灯，尽快越过 140 ℃）' },
          { value: 'slow', label: '缓慢升温（酒精灯，长时间停留在 140 ℃ 区间）' }
        ]
      },
      { key: 'time', label: '加热时间', unit: 'min', min: 2, max: 20, step: 1, value: 8 }
    ],
    /* 模型（定性）
       醚占比：缓慢升温先经过 140 ℃ 区间 → 乙醚增多；温度 ≤145 ℃ 以乙醚为主、160 ℃ 以上以乙烯为主
       炭化程度：浓硫酸比例越大、温度越高、时间越长，炭化与 SO2 副反应越严重
                 （[S2] 实测：140 ℃ 溶液发黄、150 ℃ 加深、160 ℃ 变黑、170 ℃ 炭化严重） */
    react: function (p) {
      var temp = qgPN(p, 'temp', 170);
      var acid = qgPN(p, 'acidRatio', 3);
      var heat = qgSel(p, 'heat', 'fast');
      var t = qgPN(p, 'time', 8);
      var etherFrac = 0;
      if (heat === 'slow') etherFrac += 0.45;
      if (temp <= 145) etherFrac += 0.6;
      else if (temp < 160) etherFrac += 0.25;
      etherFrac = qgClamp(etherFrac, 0, 1);
      var mainEne = etherFrac < 0.6;
      var charr = qgClamp((acid - 1) / 2 * 0.5 + Math.max(0, (temp - 140) / 60) * 0.4 + t / 20 * 0.3, 0, 1.1);
      var gas = qgClamp((temp - 130) / 60, 0.05, 1.1) * (1 - 0.45 * etherFrac);
      var ph = [];

      if (mainEne) {
        ph.push('温度计读数迅速升到 ' + Math.round(temp) + ' ℃，烧瓶内液体剧烈沸腾，导管口连续冒出大量气体');
        ph.push('反应液颜色由无色逐渐变黄' + (charr > 0.55
          ? '、变深直至变黑（浓硫酸使乙醇脱水炭化，析出黑色的碳）' : '（有轻度炭化）'));
        if (charr > 0.45) {
          ph.push('导管口的气体有刺激性气味，还能使品红溶液褪色（炭化时浓硫酸被还原，产生 SO2）');
        }
        ph.push('气体经 NaOH 溶液洗气后再通入溴的四氯化碳溶液，溶液褪色（乙烯与 Br2 加成）——必须先除去 SO2，' +
          '否则 SO2 也能使溴水褪色，不能证明是乙烯');
        ph.push('把气体通入酸性 KMnO4 溶液，紫色褪去（乙烯被氧化，可用于检验不饱和烃）');
        if (gas < 0.5) {
          ph.push('产气速率不算快：温度虽到 170 ℃，但时间短或升温慢，乙烯的量还不多');
        }
        if (etherFrac > 0.25) {
          ph.push('升温过程中在 140 ℃ 区间停留较久：除了乙烯，还生成了较多乙醚（分子内脱水与分子间脱水同时发生）');
        }
      } else {
        ph.push('温度维持在 ' + Math.round(temp) + ' ℃ 左右，反应液只变黄' + (charr > 0.6 ? '、局部变深' : '') +
          '，炭化较轻（分子间脱水需要的温度低）');
        ph.push('导管口逸出的气体明显比 170 ℃ 时少，冷凝后可收集到有特殊气味的液体——乙醚（沸点 34.6 ℃）');
        ph.push('把逸出的气体通入溴的四氯化碳溶液，溶液不褪色（乙醚不能与 Br2 加成，可用来与乙烯区别）');
        ph.push('若继续把温度升到 170 ℃，气体量会突然增大、溴的四氯化碳溶液开始褪色（产物由乙醚变成乙烯）');
      }
      if (temp > 175) {
        ph.push('温度超过 175 ℃ 后炭化与氧化副反应明显加剧：C2H5OH + 2H2SO4(浓) = 2C + 2SO2↑ + 5H2O，' +
          '烧瓶内液体发黑、瓶壁挂炭黑颗粒');
      }
      if (acid >= 3 && charr > 0.5) {
        ph.push('浓硫酸比例大（约 1:' + acid + '）时脱水能力强、反应快，但炭化更严重；' +
          '适当降低酸的比例（醇酸体积比 1.0:1.5~1.0:1.0）能明显减少炭化');
      }
      return {
        phenomena: ph,
        equation: mainEne ? 'CH3CH2OH = C2H4↑ + H2O' : '2CH3CH2OH = CH3CH2OCH2CH3 + H2O',
        ionic: '',
        type: mainEne ? '消去反应（醇的分子内脱水）' : '取代反应（醇的分子间脱水，生成乙醚）',
        conditions: mainEne
          ? '浓硫酸作催化剂和脱水剂、迅速加热到 170 ℃ 并保持（温度计水银球插入反应液面下）'
          : '浓硫酸作催化剂和脱水剂、温度控制在 140 ℃ 左右（分子间脱水）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var temp = qgPN(p, 'temp', 170);
      var acid = qgPN(p, 'acidRatio', 3);
      var heat = qgSel(p, 'heat', 'fast');
      var ene = (temp > 160 && heat === 'fast');
      return {
        text: '乙醇与浓硫酸共热时，温度决定脱水方式：170 ℃ 时主要发生分子内脱水（消去）生成乙烯，' +
          '140 ℃ 时主要发生分子间脱水（取代）生成乙醚；浓硫酸既催化又脱水，同时会把乙醇炭化并产生 SO2，' +
          '所以气体必须先经 NaOH 溶液除杂再检验。本次温度 ' + Math.round(temp) + ' ℃、浓硫酸与乙醇体积比约 1:' + acid +
          '、' + (heat === 'fast' ? '迅速升温' : '缓慢升温') + '：' +
          (ene ? '以乙烯为主，溴的四氯化碳溶液褪色。' : '以乙醚为主，溴的四氯化碳溶液不褪色。'),
        equation: ene ? 'CH3CH2OH = C2H4↑ + H2O' : '2CH3CH2OH = CH3CH2OCH2CH3 + H2O',
        ionic: '',
        errors: [
          '升温太慢、在 140 ℃ 区间停留过久，主要得到乙醚而不是乙烯',
          '温度计水银球没有插入反应液面以下，测到的是蒸气温度，无法判断反应液是否真的到了 170 ℃',
          '不先除去 SO2 就把气体通入溴水（或酸性 KMnO4 溶液）：SO2 同样能使它们褪色，结论不成立',
          '浓硫酸比例过大、温度过高或加热时间过长，反应液炭化发黑，产气量下降且杂质增多',
          '忘记加碎瓷片（沸石），液体暴沸可能把反应液冲进导管'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var temp = qgPN(p, 'temp', 170);
      var acid = qgPN(p, 'acidRatio', 3);
      var heat = qgSel(p, 'heat', 'fast');
      var t = qgPN(p, 'time', 8);
      var etherFrac = qgClamp((heat === 'slow' ? 0.45 : 0) + (temp <= 145 ? 0.6 : (temp < 160 ? 0.25 : 0)), 0, 1);
      var ene = etherFrac < 0.6;
      var charr = qgClamp((acid - 1) / 2 * 0.5 + Math.max(0, (temp - 140) / 60) * 0.4 + t / 20 * 0.3, 0, 1.1);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);

      /* 圆底烧瓶 + 反应液（颜色随炭化加深） */
      var fx = 210, fy = 350, fr = 74;
      var fl = qgFlask(g, fx, fy, fr, 30, 56);
      var liqTop = fl.cy + fr * 0.16;
      var k = Math.min(1, charr);
      qgFlaskFill(g, fl.cx, fl.cy, fr, liqTop, fl.cy + fr - 2,
        'rgba(' + Math.round(200 - 130 * k) + ',' + Math.round(190 - 150 * k) + ',' +
        Math.round(120 - 80 * k) + ',.6)');
      /* 温度计：水银球插入液面以下 */
      qgThermo(g, fx, 150, liqTop + 16, 3);
      qgTxt(g, Math.round(temp) + ' ℃', fx - 10, 140, 13, 'right', 'rgba(160,50,50,.95)', true, true);
      qgTag(g, '温度计水银球插入液面下', fx + 8, 132, 11);
      /* 碎瓷片 */
      qgPath(g, [[fx + 10, fl.cy + fr - 12], [fx + 26, fl.cy + fr - 6], [fx + 12, fl.cy + fr - 2]],
        'rgba(38,34,28,.5)', 'rgba(38,34,28,.18)', 1, true);
      /* 酒精灯（或喷灯：火焰更大） */
      qgLamp(g, fx + 6, 460, heat === 'fast' ? 1.5 : 1.1, qgClamp((temp - 100) / 100, 0.2, 1));
      qgTag(g, heat === 'fast' ? '酒精喷灯（迅速升温）' : '酒精灯（缓慢升温）', fx + 6, 478, 11);
      /* 导管 → NaOH 洗气瓶 → 溴的四氯化碳溶液 */
      qgPipe(g, [[fl.cx + fl.neckW / 2, 150], [fl.cx + 96, 150], [fl.cx + 96, 300], [430, 300], [430, 330]], 2);
      var bx = 404, by = 330;
      var bk = qgBeaker(g, bx, by, 56, 76, 1.4);
      qgRect(g, bk.x + 1, by + 22, 54, 52, null, 'rgba(160,200,220,.4)', 0);
      qgTag(g, 'NaOH 溶液（除 SO2）', bx + 28, by + 96, 11);
      qgPipe(g, [[bx + 28, by - 6], [bx + 28, 296], [530, 296], [530, 336]], 2);
      var tx2 = 500, ty2 = 336;
      var in2 = qgTube(g, tx2, ty2, 56, 92);
      qgTubeBegin(g);                       /* 液体裁剪在试管内腔里 */
      var dec = ene ? qgClamp(0.9 * (1 - 0.15 * Math.min(1, charr)), 0, 1) : 0;
      qgRect(g, in2.x + 1, in2.y + 18, in2.w - 2, 70, null, 'rgba(220,90,40,' + (0.8 * (1 - dec)) + ')', 0);
      qgTubeEnd(g);
      qgTag(g, '溴的四氯化碳溶液', tx2 + 28, ty2 + 108, 11);
      if (ene) {
        qgBubbles(g, in2.x + 6, in2.y + 22, in2.w - 12, 62, ph, 6, 'rgba(255,255,255,.8)');
        qgBubbles(g, fl.cx - 40, 150, 40, 120, ph, 4, 'rgba(120,150,90,.55)');
      }
      /* 文字 */
      qgTxt(g, '乙醇的消去反应', 56, 60, 15, 'left', null, true, false);
      qgTxt(g, ene ? '170 ℃：CH3CH2OH = C2H4↑ + H2O（消去）'
        : '140 ℃：2CH3CH2OH = CH3CH2OCH2CH3 + H2O（分子间脱水）',
        56, 82, 12.5, 'left', null, true, true);
      qgTxt(g, '炭化程度 ' + Math.round(Math.min(1, charr) * 100) + '%   ' +
        (ene ? '溴的四氯化碳溶液褪色（乙烯）' : '溴的四氯化碳溶液不褪色（乙醚）'),
        56, 104, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '副反应：C2H5OH + 2H2SO4(浓) = 2C + 2SO2↑ + 5H2O（温度过高时）',
        56, 126, 11.5, 'left', 'rgba(38,34,28,.7)', true, false);
      qgSmell(g, fl.cx + 60, 170, ph, 'rgba(150,110,40,.35)');
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 6 / 11
   * esterification · 酯化反应（乙酸 + 乙醇 → 乙酸乙酯）
   * 来源 [S5]（菁优网：浓硫酸"催化剂和吸水剂"、饱和 Na2CO3 的三个作用、
   *      导管不能插入液面、18O 示踪"酸脱羟基醇脱氢"、试剂加入顺序与分液）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('esterification', {
    id: 'esterification',
    name: '酯化反应（乙酸与乙醇制乙酸乙酯）',
    group: '有机反应',
    aim: '观察乙酸乙酯的生成与收集现象，理解酯化反应的条件、可逆性与"酸脱羟基、醇脱氢"',
    principle: 'CH3COOH + CH3CH2OH --浓硫酸,Δ--> CH3COOC2H5 + H2O（可逆反应，用"⇌"表示更准确）。' +
      '断键规律是"酸脱羟基、醇脱氢"：乙酸脱去 —OH，乙醇脱去 —OH 上的 H，两者结合成酯和水。' +
      '这个结论来自同位素示踪实验：用 18O 标记乙醇（CH3CH218OH）时，生成的乙酸乙酯中含 18O（CH3CO18OCH2CH3）；' +
      '反过来用 CH3CO18OH 时，18O 全部进入水（H218O）——说明酯中的氧来自乙醇、水中的氧来自乙酸。' +
      '浓硫酸的作用是**催化剂和吸水剂**：催化加快反应，吸水使平衡正移、提高产率。' +
      '反应可逆，所以要加过量乙醇（或及时把酯蒸出）才能提高乙酸乙酯的产率。' +
      '收集时用饱和 Na2CO3 溶液：溶解乙醇、中和乙酸、降低乙酸乙酯的溶解度，便于酯层分层析出；' +
      '导管口要悬在液面上方，不能插入液面，以防倒吸。',
    apparatus: ['试管（或圆底烧瓶）', '乙酸', '乙醇（过量）', '浓硫酸', '碎瓷片',
      '导管（兼作冷凝回流与导气）', '饱和 Na2CO3 溶液', '酒精灯 / 水浴'],
    steps: [
      '在一支试管中加入 3 mL 乙醇，再沿管壁慢慢加入 2 mL 浓硫酸，冷却后加入 2 mL 乙酸（顺序：乙醇→浓硫酸→乙酸）',
      '按装置连接导管，导管口悬在饱和 Na2CO3 溶液的液面上方（不能插入液面）',
      '用酒精灯小心均匀加热 3~5 min（或改用 60~70 ℃ 水浴加热）',
      '观察液面上浮起的无色透明油状液体与果香味，注意 Na2CO3 溶液中冒出的气泡',
      '停止加热，振荡后静置分层，用分液漏斗把上层乙酸乙酯分离出来'
    ],
    params: [
      {
        key: 'cat', label: '催化剂', type: 'select', value: 'conc',
        options: [
          { value: 'conc', label: '浓硫酸（催化剂 + 吸水剂）' },
          { value: 'dilute', label: '稀硫酸（只催化，还带入水）' },
          { value: 'none', label: '不加酸（只加热）' }
        ]
      },
      { key: 'ratio', label: '乙醇与乙酸的物质的量之比', unit: '', min: 0.5, max: 3, step: 0.25, value: 1.5 },
      { key: 'temp', label: '加热温度', unit: '℃', min: 20, max: 130, step: 5, value: 110 },
      { key: 'time', label: '加热时间', unit: 'min', min: 1, max: 15, step: 1, value: 5 }
    ],
    /* 模型（定性）：速率由催化剂与温度决定；平衡转化率由"吸水"与"乙醇过量"决定 */
    react: function (p) {
      var cat = qgSel(p, 'cat', 'conc');
      var ratio = qgPN(p, 'ratio', 1.5);
      var temp = qgPN(p, 'temp', 110);
      var t = qgPN(p, 'time', 5);
      var catF = cat === 'conc' ? 1.0 : (cat === 'dilute' ? 0.5 : 0.16);
      var tempF = qgClamp((temp - 20) / 90, 0.05, 1.2);
      var eqF = (cat === 'conc' ? 1.0 : (cat === 'dilute' ? 0.6 : 0.3)) * qgClamp(0.7 + 0.3 * ratio, 0.7, 1.6);
      var extent = qgClamp(catF * tempF * eqF * (0.55 + 0.45 * qgClamp(t / 8, 0, 1.3)), 0, 1.25);
      var bath = temp <= 80;
      var ph = [];
      ph.push(bath ? '试管放在水浴中加热（约 ' + Math.round(temp) + ' ℃），反应比较温和，液体不会暴沸'
        : '用酒精灯直接加热（约 ' + Math.round(temp) + ' ℃），试管内液体沸腾，蒸气经导管导出并冷凝');
      if (extent > 0.3) {
        ph.push('导管口冷凝下来的液体滴入饱和 Na2CO3 溶液，液面上浮起一层无色透明的油状液体（乙酸乙酯密度比水小、难溶于水）');
        ph.push('能闻到果香味（乙酸乙酯的气味）；油状层随加热时间变厚（' +
          (extent > 0.85 ? '酯层较厚' : '酯层较薄') + '）');
      } else {
        ph.push('液面上只浮起极薄的一层油状物，果香味很淡（同时间内生成的酯很少）');
      }
      ph.push('饱和 Na2CO3 溶液中有气泡冒出（挥发出的乙酸与 Na2CO3 反应放出 CO2）；经它洗涤可溶解乙醇、中和乙酸、' +
        '并降低乙酸乙酯的溶解度，便于酯层分层析出');
      if (cat === 'conc') {
        ph.push('浓硫酸既加快了反应速率，又吸收生成的水使平衡正移，所以酯层比同条件下的稀硫酸明显厚');
      } else if (cat === 'dilute') {
        ph.push('用稀硫酸时反应也会发生，但它带入大量水，平衡转化率明显低于浓硫酸（酯层薄）');
      } else {
        ph.push('不加酸只加热时，很长时间也几乎闻不到果香（没有催化剂，酯化速率极慢）');
      }
      if (ratio >= 1.75) {
        ph.push('乙醇过量（n(乙醇):n(乙酸) = ' + ratio + ':1）：增大反应物浓度使平衡正移，酯的产率提高');
      } else if (ratio <= 0.75) {
        ph.push('乙醇不足（n(乙醇):n(乙酸) = ' + ratio + ':1）：平衡转化率低，酯层薄');
      }
      ph.push('反应是可逆的：随着酯的生成，水解（逆反应）同时进行，所以产率不可能达到 100%');
      return {
        phenomena: ph,
        equation: 'CH3COOH + CH3CH2OH = CH3COOC2H5 + H2O',
        ionic: '',
        type: '酯化反应（取代反应，可逆）',
        conditions: (cat === 'conc' ? '浓硫酸作催化剂和吸水剂、'
          : (cat === 'dilute' ? '稀硫酸催化、' : '不加催化剂、')) +
          (bath ? '水浴加热约 ' + Math.round(temp) + ' ℃' : '直接加热约 ' + Math.round(temp) + ' ℃') + '（可逆反应）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var cat = qgSel(p, 'cat', 'conc');
      var ratio = qgPN(p, 'ratio', 1.5);
      var temp = qgPN(p, 'temp', 110);
      return {
        text: '乙酸与乙醇在浓硫酸催化、加热的条件下生成乙酸乙酯和水，反应可逆。' +
          '断键规律是"酸脱羟基、醇脱氢"（18O 示踪实验证明：标记乙醇时酯中含 18O，标记乙酸时 18O 进入水）。' +
          '浓硫酸既催化又吸水，吸水使平衡正移；加入过量乙醇同样能使平衡正移、提高产率。' +
          '本次用' + (cat === 'conc' ? '浓硫酸' : (cat === 'dilute' ? '稀硫酸' : '不加酸')) +
          '、n(乙醇):n(乙酸) = ' + ratio + ':1、加热到约 ' + Math.round(temp) + ' ℃。' +
          '产物用饱和 Na2CO3 溶液收集：溶解乙醇、中和乙酸、降低酯的溶解度，液面上出现有果香味的无色油状液体。',
        equation: 'CH3COOH + CH3CH2OH = CH3COOC2H5 + H2O',
        ionic: '',
        errors: [
          '导管口插入饱和 Na2CO3 溶液液面以下，加热不均匀时会倒吸',
          '忘记加碎瓷片（沸石）或直接用大火加热，液体暴沸把反应液冲入导管',
          '把浓硫酸换成稀硫酸，或忘记加过量乙醇：平衡转化率低，酯层很薄',
          '加试剂顺序颠倒（先加乙酸再加浓硫酸），混合时放热剧烈、液体飞溅',
          '把"饱和 Na2CO3 溶液"写成 NaOH 溶液：碱性太强会使乙酸乙酯水解，酯层反而消失',
          '只凭气味判断产物，没有观察液面上的油状液体与分层'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var cat = qgSel(p, 'cat', 'conc');
      var ratio = qgPN(p, 'ratio', 1.5);
      var temp = qgPN(p, 'temp', 110);
      var t = qgPN(p, 'time', 5);
      var catF = cat === 'conc' ? 1.0 : (cat === 'dilute' ? 0.5 : 0.16);
      var eqF = (cat === 'conc' ? 1.0 : (cat === 'dilute' ? 0.6 : 0.3)) * qgClamp(0.7 + 0.3 * ratio, 0.7, 1.6);
      var extent = qgClamp(catF * qgClamp((temp - 20) / 90, 0.05, 1.2) * eqF *
        (0.55 + 0.45 * qgClamp(t / 8, 0, 1.3)), 0, 1.25);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);
      var bath = temp <= 80;

      /* 反应试管 */
      var tx = 170, ty = 90, tw = 86, th = 200;
      var in1 = qgTube(g, tx, ty, tw, th);
      qgTubeBegin(g);                       /* 液体裁剪在试管内腔里 */
      var liqTop = in1.y + in1.h * 0.42;
      qgRect(g, in1.x + 1, liqTop, in1.w - 2, in1.y + in1.h - liqTop, null, 'rgba(210,200,150,.55)', 0);
      qgTubeEnd(g);
      qgTag(g, '乙醇 + 乙酸 + ' + (cat === 'conc' ? '浓硫酸' : (cat === 'dilute' ? '稀硫酸' : '不加酸')),
        tx + tw / 2, ty + th + 16, 11.5);
      if (bath) {
        var bk = qgBeaker(g, tx - 24, 206, tw + 48, 96, 1.4);
        qgRect(g, bk.x + 1, 228, bk.w - 2, 72, null, 'rgba(150,190,215,.35)', 0);
        qgTag(g, '水浴（约 ' + Math.round(temp) + ' ℃）', tx + tw / 2, 322, 11);
      } else {
        qgLamp(g, tx + tw / 2, 452, 1.2, qgClamp((temp - 20) / 110, 0.2, 1));
        qgTag(g, '直接加热（约 ' + Math.round(temp) + ' ℃）', tx + tw / 2, 470, 11);
      }
      /* 导管 → 收集试管（导管口悬在液面上方） */
      qgPipe(g, [[tx + tw / 2, 60], [tx + tw / 2, 44], [560, 44], [560, 120]], 2);
      var ty2 = 120, tx2 = 512, tw2 = 96, th2 = 190;
      var in2 = qgTube(g, tx2, ty2, tw2, th2);
      qgTubeBegin(g);                       /* 液体/酯层裁剪在试管内腔里 */
      var naTop = in2.y + 30;
      qgRect(g, in2.x + 1, naTop, in2.w - 2, in2.y + in2.h - naTop, null, 'rgba(170,205,225,.45)', 0);
      qgLine(g, in2.x + 1, naTop, in2.x + in2.w - 1, naTop, 'rgba(70,120,150,.8)', 1.2);
      /* 酯层（密度比水小，浮在液面上） */
      var esterH = 4 + 40 * qgClamp(extent, 0, 1);
      qgRect(g, in2.x + 1, naTop - esterH, in2.w - 2, esterH, null, 'rgba(245,240,200,.92)', 0);
      qgLine(g, in2.x + 1, naTop - esterH, in2.x + in2.w - 1, naTop - esterH, 'rgba(120,110,60,.7)', 1.1);
      qgTubeEnd(g);
      qgTag(g, '饱和 Na2CO3 溶液', tx2 + tw2 / 2, ty2 + th2 + 16, 11.5);
      qgTxt(g, '乙酸乙酯（果香、密度比水小）', tx2 + tw2 / 2, ty2 - 34, 11.5, 'center',
        'rgba(120,100,40,.95)', true, false);
      qgTxt(g, '导管口悬在液面上方（防倒吸）', tx2 + tw2 / 2, ty2 - 16, 11, 'center',
        'rgba(38,34,28,.7)', true, false);
      if (extent > 0.35) {
        qgBubbles(g, in2.x + 6, naTop + 10, in2.w - 12, in2.y + in2.h - naTop - 14, ph, 4, 'rgba(255,255,255,.8)');
        qgSmell(g, tx2 + tw2 + 26, ty2 + 40, ph, 'rgba(180,150,60,.5)');
      }
      /* 文字 */
      qgTxt(g, '酯化反应（可逆）', 56, 60, 15, 'left', null, true, false);
      qgTxt(g, 'CH3COOH + CH3CH2OH = CH3COOC2H5 + H2O', 56, 82, 12.5, 'left', null, true, true);
      qgTxt(g, '酸脱羟基、醇脱氢（18O 示踪证明）', 56, 104, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '浓硫酸：催化剂 + 吸水剂（使平衡正移）', 56, 126, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '酯层相对厚度 ' + Math.round(qgClamp(extent, 0, 1) * 100) + '%', 56, 148, 12, 'left',
        'rgba(38,34,28,.75)', true, false);
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 7 / 11
   * ester-hydrolysis · 乙酸乙酯的水解（酸性 / 碱性 / 中性对照）
   * 来源 [S7]（1010jiajiao 全文：稀硫酸①酯层变薄、NaOH②酯层消失、水③酯层基本不变）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('ester-hydrolysis', {
    id: 'ester-hydrolysis',
    name: '乙酸乙酯的水解（酸性条件与碱性条件对比）',
    group: '有机反应',
    aim: '对比乙酸乙酯在稀硫酸、NaOH 溶液和蒸馏水中的水解情况，理解"碱性水解趋于完全"的原因',
    principle: '酸性水解（可逆）：CH3COOC2H5 + H2O --稀硫酸,Δ--> CH3COOH + CH3CH2OH，' +
      '稀硫酸只起催化作用，反应达到平衡后仍有酯剩余，所以酯层只是变薄。' +
      '碱性水解（趋于完全）：CH3COOC2H5 + NaOH --Δ--> CH3COONa + CH3CH2OH，' +
      '生成的乙酸被 NaOH 中和成乙酸钠，乙酸的浓度不断降低，水解平衡不断向正反应方向移动，' +
      '所以酯层会完全消失——碱性水解在 NaOH 足量时不是可逆反应。' +
      '不加酸的蒸馏水只能靠生成的乙酸自催化，速率极慢，酯层几乎不变。',
    apparatus: ['三支试管（放在同一水浴中）', '乙酸乙酯', '稀硫酸（1:5）',
      'NaOH 溶液（30%）', '蒸馏水', '水浴加热装置', '紫色石蕊（检验酸性）'],
    steps: [
      '取三支相同的试管，各加入约 1 mL 乙酸乙酯',
      '分别加入等体积的稀硫酸、NaOH 溶液和蒸馏水，振荡后放在同一水浴中加热相同时间',
      '观察三支试管里酯层的厚度变化：稀硫酸中酯层变薄、NaOH 溶液中酯层消失、水中酯层基本不变',
      '用紫色石蕊检验酸性水解后的溶液（变红，说明生成了乙酸）',
      '比较三者的现象，用化学平衡移动原理解释 NaOH 溶液中水解彻底的原因'
    ],
    params: [
      {
        key: 'medium', label: '水解介质', type: 'select', value: 'acid',
        options: [
          { value: 'acid', label: '稀硫酸（酸性水解，可逆）' },
          { value: 'base', label: 'NaOH 溶液（碱性水解，趋于完全）' },
          { value: 'water', label: '蒸馏水（中性对照）' }
        ]
      },
      { key: 'temp', label: '水浴温度', unit: '℃', min: 30, max: 100, step: 5, value: 70 },
      { key: 'time', label: '加热时间', unit: 'min', min: 1, max: 20, step: 1, value: 5 },
      { key: 'ester', label: '乙酸乙酯用量', unit: 'mL', min: 0.5, max: 3, step: 0.25, value: 1 }
    ],
    /* 模型（定性）：碱性介质下平衡不断正移 → 酯层可以完全消失；酸性/中性受平衡限制 */
    react: function (p) {
      var med = qgSel(p, 'medium', 'acid');
      var temp = qgPN(p, 'temp', 70);
      var t = qgPN(p, 'time', 5);
      var est = qgPN(p, 'ester', 1);
      var medF = med === 'base' ? 1.15 : (med === 'acid' ? 0.8 : 0.2);
      var extent = qgClamp(medF * qgClamp((temp - 30) / 60, 0.05, 1.1) *
        (0.4 + 0.6 * qgClamp(t / 8, 0, 1.4)) * (1 + (est - 1) * 0.12), 0, 1.3);
      var cap = med === 'base' ? 1.3 : (med === 'acid' ? 0.72 : 0.16);
      var shown = Math.min(extent, cap);
      var ph = [];
      if (med === 'base') {
        if (shown >= 0.75) {
          ph.push('油状酯层随加热逐渐变薄，最后完全消失（水解产生的乙酸被 NaOH 中和，平衡不断正移，水解彻底）');
          ph.push('闻到的是乙醇的气味，果香味消失（酯已水解完）');
          ph.push('溶液仍显碱性：乙酸被中和成乙酸钠，所以 NaOH 足量时碱性水解不是可逆反应');
        } else {
          ph.push('酯层明显变薄，但仍剩下少量油状物（温度偏低或时间太短，继续加热可完全消失）');
          ph.push('溶液中有乙酸钠生成（乙酸被 NaOH 中和），这正是水解平衡正移的原因');
        }
      } else if (med === 'acid') {
        ph.push('油状酯层明显变薄，但不能完全消失——酸性水解是可逆反应，达到平衡后仍有酯剩余');
        ph.push('溶液能使紫色石蕊变红（生成了乙酸），同时能闻到乙酸和乙醇的气味');
        ph.push('稀硫酸只起催化作用，不消耗产物，所以水解程度受平衡限制');
      } else {
        ph.push('同样温度和时间下，酯层几乎不变（没有催化剂，水解速率极慢）');
        ph.push('长时间加热后酯层略有变薄：生成的乙酸起了自催化作用');
      }
      if (temp >= 90) {
        ph.push('水浴接近沸腾，水解速率明显加快，同时乙酸乙酯挥发加快（试管口能闻到较浓的酯的气味）');
      }
      if (est >= 2) {
        ph.push('乙酸乙酯用量较多，酯层较厚：要让它完全消失需要更长时间或更高的温度');
      }
      return {
        phenomena: ph,
        equation: med === 'base' ? 'CH3COOC2H5 + NaOH = CH3COONa + CH3CH2OH'
          : 'CH3COOC2H5 + H2O = CH3COOH + CH3CH2OH',
        ionic: '',
        type: med === 'base' ? '水解反应（酯的碱性水解，不可逆）' : '水解反应（酯的酸性水解，可逆）',
        conditions: med === 'base' ? 'NaOH 溶液、水浴加热约 ' + Math.round(temp) + ' ℃'
          : (med === 'acid' ? '稀硫酸催化、水浴加热约 ' + Math.round(temp) + ' ℃（可逆）'
            : '蒸馏水、水浴加热约 ' + Math.round(temp) + ' ℃（无催化剂，仅自催化）'),
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var med = qgSel(p, 'medium', 'acid');
      var temp = qgPN(p, 'temp', 70);
      var t = qgPN(p, 'time', 5);
      return {
        text: '乙酸乙酯的水解在酸性、碱性条件下都能进行，但程度不同：' +
          '稀硫酸只催化，反应可逆、酯层变薄但不消失；NaOH 溶液把生成的乙酸中和成乙酸钠，' +
          '使水解平衡不断正移，所以酯层完全消失（NaOH 足量时碱性水解趋于完全）；' +
          '不加催化剂的蒸馏水中酯层几乎不变。本次用' +
          (med === 'base' ? 'NaOH 溶液' : (med === 'acid' ? '稀硫酸' : '蒸馏水')) +
          '，水浴 ' + Math.round(temp) + ' ℃、加热 ' + t + ' min。',
        equation: med === 'base' ? 'CH3COOC2H5 + NaOH = CH3COONa + CH3CH2OH'
          : 'CH3COOC2H5 + H2O = CH3COOH + CH3CH2OH',
        ionic: '',
        errors: [
          '三支试管的酯用量、加热温度与时间不一致，无法比较（必须同水浴、同时间、同体积）',
          '用浓硫酸代替稀硫酸：浓硫酸会使酯炭化，还可能把乙醇氧化，现象被掩盖',
          '加入的 NaOH 太少：乙酸不能被完全中和，水解仍受平衡限制、酯层消失不完全',
          '加热温度过高使乙酸乙酯大量挥发，酯层"变薄"是挥发造成的假象',
          '忘记振荡：酯与水不相溶，接触面小，水解速率明显偏慢'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var med = qgSel(p, 'medium', 'acid');
      var temp = qgPN(p, 'temp', 70);
      var t = qgPN(p, 'time', 5);
      var est = qgPN(p, 'ester', 1);
      var medF = med === 'base' ? 1.15 : (med === 'acid' ? 0.8 : 0.2);
      var extent = qgClamp(medF * qgClamp((temp - 30) / 60, 0.05, 1.1) *
        (0.4 + 0.6 * qgClamp(t / 8, 0, 1.4)), 0, 1.3);
      var cap = med === 'base' ? 1.3 : (med === 'acid' ? 0.72 : 0.16);
      var shown = Math.min(extent, cap);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);

      /* 水浴烧杯 + 三支试管（当前介质那支加虚线框） */
      var bx = 250, by = 300, bw = 340, bh = 132;
      qgPath(g, [[bx, by], [bx, by + bh], [bx + bw, by + bh], [bx + bw, by]], null, null, 1.6, false);
      qgRect(g, bx + 2, by + 26, bw - 4, bh - 28, null, 'rgba(150,190,215,.35)', 0);
      qgTag(g, '水浴加热（约 ' + Math.round(temp) + ' ℃，三支试管同时放入）', bx + bw / 2, by + bh + 20, 11.5);
      var i, tx0 = bx + 30;
      var labels = ['稀硫酸', 'NaOH 溶液', '蒸馏水'];
      var keys = ['acid', 'base', 'water'];
      for (i = 0; i < 3; i++) {
        var tx = tx0 + i * 100, ty = 150, tw = 60, th = 150;
        var inner = qgTube(g, tx, ty, tw, th);
        qgTubeBegin(g);                     /* 液体/酯层裁剪在试管内腔里（本组三支试管各一次） */
        var liqTop = inner.y + inner.h * 0.30;
        qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.y + inner.h - liqTop, null, 'rgba(180,210,225,.45)', 0);
        var thisShown = (keys[i] === med) ? shown
          : (keys[i] === 'base' ? 0.08 : (keys[i] === 'acid' ? 0.05 : 0.02));
        var esterH = (2 + 42 * (1 - qgClamp(thisShown, 0, 1))) * (0.6 + 0.4 * qgClamp(est, 0, 1));
        qgRect(g, inner.x + 1, liqTop, inner.w - 2, Math.min(esterH, 58), null, 'rgba(245,240,200,.92)', 0);
        qgTubeEnd(g);
        if (keys[i] === med) {
          qgDashRect(g, tx - 6, ty - 6, tw + 12, th + 12, 'rgba(38,34,28,.55)', 1.2);
        }
        qgTag(g, labels[i], tx + tw / 2, ty + th + 16, 11, keys[i] === med ? null : 'rgba(38,34,28,.6)');
        if (keys[i] === med) {
          qgBubbles(g, inner.x + 6, liqTop + 34, inner.w - 12, inner.y + inner.h - liqTop - 40, ph, 3,
            'rgba(255,255,255,.7)');
        }
      }
      qgTxt(g, '乙酸乙酯的水解（酸性 vs 碱性）', 56, 60, 15, 'left', null, true, false);
      qgTxt(g, med === 'base' ? '碱性：CH3COOC2H5 + NaOH = CH3COONa + CH3CH2OH'
        : '酸性/中性：CH3COOC2H5 + H2O = CH3COOH + CH3CH2OH',
        56, 82, 12.5, 'left', null, true, true);
      qgTxt(g, '酯层剩余 ' + Math.round((1 - qgClamp(shown, 0, 1)) * 100) + '%   ' +
        (med === 'base' ? '（碱性水解趋于完全）' : (med === 'acid' ? '（可逆，酯层不会消失）' : '（几乎不变）')),
        56, 104, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '对照：稀硫酸①酯层变薄 · NaOH②酯层消失 · 水③酯层基本不变', 56, 126, 12, 'left',
        'rgba(38,34,28,.75)', true, false);
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 8 / 11
   * glucose-silver · 葡萄糖的银镜反应 / 与新制 Cu(OH)2 反应
   * 来源 [S4]（科普中国 Tollens 反应全文）+ [S5]（菁优网：银氨溶液配法、
   *      水浴加热、NaOH 煮沸洗试管、葡萄糖与新制 Cu(OH)2 的适宜条件）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('glucose-silver', {
    id: 'glucose-silver',
    name: '葡萄糖的银镜反应与新制氢氧化铜反应',
    group: '有机反应',
    aim: '观察葡萄糖把银氨溶液还原成银镜、把新制 Cu(OH)2 还原成砖红色 Cu2O 的现象，掌握两种试剂的配制与条件',
    principle: '葡萄糖是多羟基醛，分子里有醛基（—CHO），能被弱氧化剂氧化，所以有还原性。' +
      '① 银镜反应：C6H12O6 + 2Ag(NH3)2OH --水浴--> C6H15NO7 + 2Ag↓ + 3NH3 + H2O' +
      '（产物是葡萄糖酸铵；写成结构简式即 CH2OH(CHOH)4CHO + 2[Ag(NH3)2]OH → CH2OH(CHOH)4COONH4 + 2Ag↓ + 3NH3 + H2O）。' +
      '银氨溶液（Tollens 试剂）必须现配现用：向 AgNO3 溶液中逐滴滴入稀氨水，直到最初生成的沉淀恰好溶解为止；' +
      '久置会生成易爆的雷酸银、氮化银。试管内壁必须洁净（先用 NaOH 溶液煮沸除去油污），加热只能用水浴，不能直接加热。' +
      '② 与新制 Cu(OH)2 反应：C6H12O6 + 2Cu(OH)2 --Δ--> C6H12O7 + Cu2O↓ + 2H2O（葡萄糖酸 + 砖红色 Cu2O）。' +
      '新制 Cu(OH)2 要在 NaOH 溶液中滴加少量 CuSO4 制得，**碱必须过量**：一是保证碱性条件，二是防止 CuSO4 过量，' +
      '加热时生成黑色 CuO 干扰砖红色沉淀的观察。检验葡萄糖（或其他还原性糖）前，如果溶液显酸性，必须先加碱中和。',
    apparatus: ['洁净试管（用 NaOH 煮沸除油污）', '2% AgNO3 溶液', '2% 稀氨水',
      '10% NaOH 溶液', '5% CuSO4 溶液', '葡萄糖溶液', '温水浴（温度计）'],
    steps: [
      '配制银氨溶液：向 1 mL 2% AgNO3 溶液中边振荡边逐滴滴入 2% 稀氨水，直到最初生成的沉淀恰好溶解（现配现用）',
      '向银氨溶液中滴入 3~4 滴葡萄糖溶液，放在温水浴中静置加热几分钟（不要振荡、不要直接加热）',
      '观察试管内壁附着的银镜；用稀硝酸可以把它洗去',
      '另取一支试管，向 10% NaOH 溶液中滴加 4~5 滴 5% CuSO4 溶液，制得蓝色的新制 Cu(OH)2 悬浊液（碱明显过量）',
      '加入葡萄糖溶液并加热至沸腾，观察蓝色絮状沉淀逐渐变成砖红色 Cu2O'
    ],
    params: [
      {
        key: 'reagent', label: '弱氧化剂', type: 'select', value: 'silver',
        options: [
          { value: 'silver', label: '银氨溶液（银镜反应）' },
          { value: 'cuoh2', label: '新制 Cu(OH)2 悬浊液（砖红色沉淀）' }
        ]
      },
      { key: 'bath', label: '水浴温度', unit: '℃', min: 30, max: 100, step: 5, value: 60 },
      {
        key: 'alkali', label: '碱性条件', type: 'select', value: 'enough',
        options: [
          { value: 'enough', label: '按教材操作（银氨溶液滴到沉淀恰好溶解 / Cu(OH)2 时碱明显过量）' },
          { value: 'poor', label: '氨水加过量 / 制 Cu(OH)2 时 CuSO4 过量（碱不足）' }
        ]
      },
      { key: 'conc', label: '葡萄糖溶液浓度', unit: '%', min: 1, max: 20, step: 1, value: 10 },
      { key: 'time', label: '水浴加热时间', unit: 'min', min: 1, max: 15, step: 1, value: 5 }
    ],
    /* 模型（定性）：浓度/温度/时间决定反应程度；温度过高得到黑色银粉；碱不足干扰 Cu(OH)2 的观察 */
    react: function (p) {
      var rg = qgSel(p, 'reagent', 'silver');
      var bath = qgPN(p, 'bath', 60);
      var alk = qgSel(p, 'alkali', 'enough');
      var conc = qgPN(p, 'conc', 10);
      var t = qgPN(p, 'time', 5);
      var amount = qgClamp(qgClamp(conc / 10, 0.1, 2) * qgClamp((bath - 25) / 45, 0.1, 1.4) *
        (0.5 + 0.5 * qgClamp(t / 6, 0, 1.6)), 0, 2);
      var ph = [];
      if (rg === 'silver') {
        if (bath > 80) {
          ph.push('加热过猛（水浴接近沸腾）：试管内壁得到的是黑色疏松的银粉，而不是光亮的银镜');
          ph.push('溶液发暗、出现黑色悬浮小颗粒（银以细小颗粒析出）——银镜反应要用水浴温和加热，且加热时不能振荡');
        } else if (amount < 0.3) {
          ph.push('水浴温度偏低、时间又短，' + Math.round(t) + ' min 内管壁只是发暗，还没有形成光亮的银镜');
          ph.push('溶液基本还是无色的（银氨溶液被还原的量很少）');
        } else {
          ph.push('试管内壁附着一层光亮如镜的金属银（银镜）' + (amount > 1.1 ? '，银层较厚且均匀' : '，银层较薄'));
          ph.push('溶液逐渐变成浅褐色、管壁上出现细小的银粒（银沉积在管壁上）');
          ph.push('把液体倒出后用稀硝酸可以洗去管壁上的银（银溶于稀硝酸），说明析出的确实是金属银');
        }
        if (alk === 'poor') {
          ph.push('氨水加得过多（沉淀溶解后仍继续滴加）：银氨溶液的氧化能力下降，银镜出现得很慢、不均匀——' +
            '教材要求"滴到最初生成的沉淀恰好溶解为止"');
        } else {
          ph.push('试管先用 NaOH 溶液煮沸洗净（除油污），银才能均匀附着；银氨溶液现配现用，久置会生成易爆的雷酸银');
        }
      } else {
        if (alk === 'poor') {
          ph.push('NaOH 不足（CuSO4 过量）时，加热后出现黑色物质（CuO 与 Cu2O 混在一起），砖红色沉淀看不清');
          ph.push('蓝色絮状沉淀先变深、再变黑，说明体系不是碱性条件——检验还原性糖必须在碱性条件下进行');
        } else {
          ph.push('蓝色絮状沉淀（新制 Cu(OH)2）在加热过程中逐渐变成砖红色沉淀（Cu2O）');
          ph.push('溶液由蓝色逐渐变浅，管壁上出现红色物质（Cu2O 附着在管壁上）');
          ph.push('砖红色沉淀的量随葡萄糖浓度与加热时间增加而增多' + (amount > 1.1 ? '（本次沉淀很多）' : ''));
        }
        if (bath < 45) {
          ph.push('温度偏低：蓝色沉淀的变化很慢，需要加热到接近沸腾才容易看到砖红色');
        }
      }
      if (conc >= 15) {
        ph.push('葡萄糖浓度较高（' + Math.round(conc) + '%）：反应更快、现象更明显，但浓度过高时产物颜色会偏深');
      }
      return {
        phenomena: ph,
        equation: rg === 'silver'
          ? 'C6H12O6 + 2Ag(NH3)2OH = C6H15NO7 + 2Ag↓ + 3NH3 + H2O'
          : 'C6H12O6 + 2Cu(OH)2 = C6H12O7 + Cu2O↓ + 2H2O',
        ionic: '',
        type: rg === 'silver' ? '氧化反应（醛基被银氨溶液氧化，银镜反应）'
          : '氧化反应（醛基被新制 Cu(OH)2 氧化）',
        conditions: rg === 'silver'
          ? '新制银氨溶液（AgNO3 中逐滴加稀氨水至沉淀恰好溶解）、温水浴加热约 ' + Math.round(bath) + ' ℃（不可直接加热）'
          : '新制 Cu(OH)2 悬浊液、碱性（NaOH 明显过量）、加热约 ' + Math.round(bath) + ' ℃',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var rg = qgSel(p, 'reagent', 'silver');
      var bath = qgPN(p, 'bath', 60);
      var alk = qgSel(p, 'alkali', 'enough');
      return {
        text: '葡萄糖分子中含醛基，有还原性，能把弱氧化剂还原：' +
          (rg === 'silver' ? '与银氨溶液水浴加热时析出金属银，在洁净试管内壁上形成银镜；'
            : '与新制 Cu(OH)2 共热时生成砖红色 Cu2O 沉淀。') +
          '两个反应都必须在碱性条件下进行：银氨溶液要现配现用（久置生成易爆物），' +
          '新制 Cu(OH)2 要用 NaOH 与少量 CuSO4 配制、碱明显过量；加热方式上银镜反应用水浴，不能直接加热。' +
          '本次水浴 ' + Math.round(bath) + ' ℃、' +
          (alk === 'enough' ? '按教材的碱性条件操作。' : '碱性条件不合适（氨水过量 / 碱不足），现象不理想。'),
        equation: rg === 'silver'
          ? 'C6H12O6 + 2Ag(NH3)2OH = C6H15NO7 + 2Ag↓ + 3NH3 + H2O'
          : 'C6H12O6 + 2Cu(OH)2 = C6H12O7 + Cu2O↓ + 2H2O',
        ionic: '',
        errors: [
          '试管内壁不洁净（有油污）：银附着不均匀，出现黑色斑点而不是光亮银镜',
          '直接加热代替水浴、或者加热时振荡试管：得到黑色疏松的银粉而不是银镜',
          '银氨溶液放置过久或氨水加得过量：前者生成易爆的雷酸银，后者使银镜出现很慢、不均匀',
          '配制新制 Cu(OH)2 时 CuSO4 过量（碱不足）：加热生成黑色 CuO，砖红色沉淀看不清',
          '检验水解液（如淀粉水解液）中的葡萄糖时没有先加 NaOH 中和酸，Cu(OH)2 被酸溶解，看不到砖红色沉淀',
          '把"砖红色沉淀"与"红色沉淀"混为一谈：Cu2O 是砖红色，铜单质是紫红色'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var rg = qgSel(p, 'reagent', 'silver');
      var bath = qgPN(p, 'bath', 60);
      var alk = qgSel(p, 'alkali', 'enough');
      var conc = qgPN(p, 'conc', 10);
      var t = qgPN(p, 'time', 5);
      var amount = qgClamp(qgClamp(conc / 10, 0.1, 2) * qgClamp((bath - 25) / 45, 0.1, 1.4) *
        (0.5 + 0.5 * qgClamp(t / 6, 0, 1.6)), 0, 2);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);
      var mirror = qgClamp(amount / 1.4, 0, 1);

      /* 水浴烧杯 + 温度计 */
      var bx = 250, by = 300, bw = 320, bh = 132;
      qgPath(g, [[bx, by], [bx, by + bh], [bx + bw, by + bh], [bx + bw, by]], null, null, 1.6, false);
      qgRect(g, bx + 2, by + 26, bw - 4, bh - 28, null, 'rgba(150,190,215,.35)', 0);
      qgTag(g, '温水浴（约 ' + Math.round(bath) + ' ℃，银镜反应不能直接加热）', bx + bw / 2, by + bh + 20, 11.5);
      qgThermo(g, bx + bw - 26, 176, by + bh - 18, 2.4);
      /* 试管 */
      var tx = 330, ty = 150, tw = 84, th = 170;
      var inner = qgTube(g, tx, ty, tw, th);
      qgTubeBegin(g);                       /* 液体/银镜/砖红色 Cu₂O 沉淀裁剪在试管内腔里 */
      var liqTop = inner.y + inner.h * 0.34;
      qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.y + inner.h - liqTop, null,
        rg === 'silver' ? 'rgba(215,225,235,.5)' : 'rgba(120,170,225,.55)', 0);
      if (rg === 'silver') {
        var c2 = g.c, i;
        if (c2) {
          c2.save();
          c2.strokeStyle = 'rgba(190,196,205,' + (0.35 + 0.6 * mirror) + ')';
          c2.lineWidth = 5;
          c2.beginPath();
          c2.moveTo(inner.x + 2, inner.y + 4);
          c2.lineTo(inner.x + 2, inner.y + inner.h - 6);
          c2.moveTo(inner.x + inner.w - 2, inner.y + 4);
          c2.lineTo(inner.x + inner.w - 2, inner.y + inner.h - 6);
          c2.stroke();
          c2.restore();
        }
        for (i = 0; i < Math.round(6 * mirror); i++) {
          qgCircle(g, inner.x + 3 + (i % 2) * (inner.w - 8), inner.y + 22 + i * 18, 2.4,
            'rgba(150,150,150,.7)', 'rgba(210,214,220,.95)', 1);
        }
        if (bath > 80) {
          qgTxt(g, '加热过猛 → 黑色银粉（不是银镜）', tx + tw / 2, ty - 26, 12, 'center',
            'rgba(60,50,40,.95)', true, true);
          qgCircle(g, tx + tw / 2, inner.y + inner.h - 30, 6, 'rgba(30,28,26,.7)', 'rgba(40,38,36,.85)', 1);
        } else {
          qgTxt(g, '管壁附着光亮银镜', tx + tw / 2, ty - 26, 12.5, 'center', 'rgba(70,80,95,.95)', true, true);
        }
        qgTxt(g, '银氨溶液（现配现用）', tx + tw / 2, ty + th + 16, 11.5, 'center', 'rgba(38,34,28,.8)', true, false);
      } else {
        var red = qgClamp(amount / 1.2, 0, 1), i2;
        for (i2 = 0; i2 < 12; i2++) {
          var px = inner.x + 8 + (i2 * 29 % (inner.w - 16));
          var py = inner.y + inner.h - 12 - (i2 * 13 % 40);
          qgCircle(g, px, py, 4.2, null,
            (alk === 'poor' && i2 % 3 === 0) ? 'rgba(30,28,26,.8)'
              : 'rgba(' + Math.round(qgLerp(70, 175, red)) + ',' + Math.round(qgLerp(130, 60, red)) + ',' +
              Math.round(qgLerp(215, 40, red)) + ',.85)', 0);
        }
        qgTxt(g, alk === 'poor' ? '碱不足 → 出现黑色 CuO，砖红色看不清' : '蓝色絮状沉淀 → 砖红色 Cu2O 沉淀',
          tx + tw / 2, ty - 26, 12, 'center', alk === 'poor' ? 'rgba(40,38,36,.95)' : 'rgba(150,70,30,.95)', true, true);
        qgTxt(g, '新制 Cu(OH)2（NaOH 中滴少量 CuSO4，碱过量）', tx + tw / 2, ty + th + 16, 11.5, 'center',
          'rgba(38,34,28,.8)', true, false);
      }
      qgTubeEnd(g);
      qgBubbles(g, inner.x + 8, liqTop + 12, inner.w - 16, inner.y + inner.h - liqTop - 18, ph, 4,
        'rgba(255,255,255,.6)');
      /* 文字 */
      qgTxt(g, '葡萄糖的还原性（含醛基）', 56, 60, 15, 'left', null, true, false);
      qgTxt(g, rg === 'silver' ? 'C6H12O6 + 2Ag(NH3)2OH = C6H15NO7 + 2Ag↓ + 3NH3 + H2O'
        : 'C6H12O6 + 2Cu(OH)2 = C6H12O7 + Cu2O↓ + 2H2O',
        56, 82, 12, 'left', null, true, true);
      qgTxt(g, rg === 'silver'
        ? '结构简式：CH2OH(CHOH)4CHO + 2[Ag(NH3)2]OH → CH2OH(CHOH)4COONH4 + 2Ag↓ + 3NH3 + H2O'
        : '结构简式：CH2OH(CHOH)4CHO + 2Cu(OH)2 → CH2OH(CHOH)4COOH + Cu2O↓ + 2H2O',
        56, 104, 11, 'left', 'rgba(38,34,28,.7)', true, false);
      qgTxt(g, '葡萄糖 ' + Math.round(conc) + '%   水浴 ' + Math.round(bath) + ' ℃   ' + Math.round(t) + ' min',
        56, 126, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 9 / 11
   * starch-hydrolysis · 淀粉的水解（稀硫酸 / 唾液淀粉酶）与碘水检验
   * 来源 [S5]（菁优网：60~80 ℃ 水浴 5~6 min；甲/乙/丙三管对照；
   *      "没有加碱中和作为催化剂的稀硫酸"导致无砖红色沉淀；
   *      "先加 NaOH 再滴碘水会因碘与 NaOH 反应而不显蓝"；
   *      淀粉水解方程式 (C6H10O5)n + nH2O --酸性--> nC6H12O6）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('starch-hydrolysis', {
    id: 'starch-hydrolysis',
    name: '淀粉的水解（稀硫酸或淀粉酶催化）',
    group: '有机反应',
    aim: '观察淀粉在酸或酶催化下水解的分步过程，学会用碘水检验淀粉、用新制 Cu(OH)2 检验葡萄糖',
    principle: '淀粉是天然高分子，水解是分步进行的：淀粉 → 糊精 → 麦芽糖 → 葡萄糖。' +
      '完全水解的化学方程式：(C6H10O5)n + nH2O --催化剂--> nC6H12O6（葡萄糖）；' +
      '中间两步可写成 2(C6H10O5)n + nH2O → nC12H22O11（麦芽糖）与 C12H22O11 + H2O → 2C6H12O6。' +
      '（聚合度 n 很大，本台在方程式里把它写实为 n=1000：(C6H10O5)1000 + 1000H2O = 1000C6H12O6，便于逐元素核对。）' +
      '催化剂可以是稀硫酸（要加热，实验常用 60~80 ℃ 水浴 5~6 min）或淀粉酶（唾液淀粉酶的最适温度约 37 ℃，' +
      '沸水浴中会变性失活）。检验方法有两套：① 用碘水检验淀粉——淀粉遇碘变蓝，' +
      '随水解进行颜色由深蓝→蓝紫→棕红（糊精）→不变蓝（水解完全）；' +
      '② 用新制 Cu(OH)2（或银氨溶液）检验葡萄糖——**必须先加 NaOH 把稀硫酸中和掉**，' +
      '否则 Cu(OH)2 会被酸溶解，看不到砖红色沉淀。还要注意：检验淀粉是否水解完全时，' +
      '要在冷却后的水解液中直接滴加碘水，不能先加 NaOH——碘会与 NaOH 反应，蓝色就不出现了。',
    apparatus: ['试管（甲：加催化剂并加热；乙：不加热对照；丙：加碱后再检验）', '淀粉溶液',
      '稀硫酸', '唾液淀粉酶（或淀粉酶溶液）', '碘水', '新制 Cu(OH)2', 'NaOH 溶液', '水浴（60~80 ℃）'],
    steps: [
      '取三支试管各加入 2 mL 淀粉溶液：甲、丙加稀硫酸，乙加等量蒸馏水（不加热对照）',
      '把甲、丙放入 60~80 ℃ 水浴加热 5~6 min，乙不加热',
      '取少量甲中溶液，直接滴加碘水：若不变蓝说明淀粉已完全水解；取少量乙中溶液滴碘水，变蓝',
      '另取少量甲中溶液，先加 NaOH 溶液中和稀硫酸至碱性，再加新制 Cu(OH)2 并加热，观察砖红色沉淀',
      '用唾液淀粉酶代替稀硫酸重复实验（37 ℃ 水浴，不需要中和），比较两种催化剂的条件差异'
    ],
    params: [
      {
        key: 'cat', label: '催化剂', type: 'select', value: 'h2so4',
        options: [
          { value: 'h2so4', label: '稀硫酸（酸催化，需加热）' },
          { value: 'enzyme', label: '唾液淀粉酶（最适约 37 ℃）' },
          { value: 'none', label: '不加催化剂（只加水，对照）' }
        ]
      },
      { key: 'temp', label: '水浴温度', unit: '℃', min: 20, max: 100, step: 5, value: 80 },
      { key: 'time', label: '水解时间', unit: 'min', min: 2, max: 30, step: 1, value: 10 }
    ],
    /* 模型（定性）：给出"水解到哪一步"——0 淀粉 / 1 糊精 / 2 麦芽糖 / 3 葡萄糖
       酸催化随温度升高加快（60~80 ℃ 水浴几分钟即可完全水解）
       酶催化在 37 ℃ 附近最快，超过 60 ℃ 迅速变性失活（沸水浴中几乎不水解） */
    react: function (p) {
      var cat = qgSel(p, 'cat', 'h2so4');
      var temp = qgPN(p, 'temp', 80);
      var t = qgPN(p, 'time', 10);
      var act;
      if (cat === 'h2so4') act = qgClamp((temp - 20) / 55, 0.04, 1.15);
      else if (cat === 'enzyme') act = (temp > 60) ? 0.04 : qgClamp(1 - Math.abs(temp - 37) / 45, 0.15, 1);
      else act = 0.02 + 0.02 * (temp / 100);
      var extent = qgClamp(act * (t / 8), 0, 1.4);
      var stage = extent < 0.25 ? 0 : (extent < 0.5 ? 1 : (extent < 0.8 ? 2 : 3));
      var denatured = (cat === 'enzyme' && temp > 60);
      var ph = [];

      if (stage === 0) {
        ph.push('取样滴加碘水，溶液立即变成深蓝色——淀粉基本没有水解');
        ph.push('另取样液先加 NaOH 中和，再加新制 Cu(OH)2 加热，没有砖红色沉淀（还没有还原性糖生成）');
      } else if (stage === 1) {
        ph.push('取样滴加碘水，溶液呈蓝紫色→棕红色（生成糊精：淀粉已经部分水解，遇碘的显色变浅）');
        ph.push('样液先加 NaOH 中和后与新制 Cu(OH)2 共热，出现少量砖红色沉淀（已经有还原性糖生成）');
      } else if (stage === 2) {
        ph.push('取样滴加碘水不再变蓝（淀粉已完全水解，没有淀粉与碘的显色反应）');
        ph.push('样液与新制 Cu(OH)2 共热出现明显的砖红色沉淀（麦芽糖也是还原性糖，能还原 Cu(OH)2）');
        ph.push('此阶段水解产物主要是麦芽糖（C12H22O11），继续水解才得到葡萄糖');
      } else {
        ph.push('取样滴加碘水不变蓝——淀粉已完全水解');
        ph.push('水解液先加 NaOH 中和稀硫酸后，与新制 Cu(OH)2 共热产生大量砖红色沉淀（葡萄糖，还原性糖）');
        ph.push('水解液也能发生银镜反应（水浴加热后管壁出现银镜），说明生成了葡萄糖');
      }
      if (denatured) {
        ph.push('沸水浴（约 ' + Math.round(temp) + ' ℃）中唾液淀粉酶变性失活，碘水仍变深蓝色：酶催化需要温和的温度');
      } else if (cat === 'enzyme') {
        ph.push('唾液淀粉酶在 37 ℃ 左右活性最高：本次 ' + Math.round(temp) + ' ℃，水解' +
          (stage >= 2 ? '进行得比较顺利' : '速度一般'));
      }
      if (cat === 'h2so4') {
        ph.push('酸催化必须加热：60~80 ℃ 水浴 5~6 min 就能水解完全（常温下几乎不水解）');
        ph.push('检验葡萄糖前一定要先加 NaOH 中和稀硫酸；但检验淀粉是否完全水解时要在冷却后的水解液中**直接**滴碘水，' +
          '先加碱会使碘与 NaOH 反应、蓝色不出现');
      }
      if (cat === 'none') {
        ph.push('不加催化剂时，即使加热很长时间也几乎不水解（对照实验说明催化剂是必要条件）');
      }
      return {
        phenomena: ph,
        equation: stage <= 1 ? '(C6H10O5)1000 + 500H2O = 500C12H22O11'
          : (stage === 2 ? 'C12H22O11 + H2O = 2C6H12O6' : '(C6H10O5)1000 + 1000H2O = 1000C6H12O6'),
        ionic: '',
        type: '水解反应（多糖的分步水解）',
        conditions: cat === 'h2so4' ? '稀硫酸催化、60~80 ℃ 水浴加热'
          : (cat === 'enzyme' ? '唾液淀粉酶催化、约 37 ℃ 温水浴（沸水浴会使酶变性失活）'
            : '不加催化剂、加热（对照：几乎不水解）'),
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var cat = qgSel(p, 'cat', 'h2so4');
      var temp = qgPN(p, 'temp', 80);
      var t = qgPN(p, 'time', 10);
      var act = cat === 'h2so4' ? qgClamp((temp - 20) / 55, 0.04, 1.15)
        : (cat === 'enzyme' ? ((temp > 60) ? 0.04 : qgClamp(1 - Math.abs(temp - 37) / 45, 0.15, 1))
          : 0.02 + 0.02 * (temp / 100));
      var extent = qgClamp(act * (t / 8), 0, 1.4);
      var stage = extent < 0.25 ? 0 : (extent < 0.5 ? 1 : (extent < 0.8 ? 2 : 3));
      return {
        text: '淀粉在酸或酶的催化下水解，过程是分步的：淀粉 → 糊精 → 麦芽糖 → 葡萄糖，' +
          '完全水解的方程式为 (C6H10O5)n + nH2O → nC6H12O6（表中把聚合度写实为 n=1000：' +
          '(C6H10O5)1000 + 1000H2O = 1000C6H12O6）。' +
          '检验用两把"尺子"：碘水检验淀粉（变蓝说明还有淀粉，不变蓝说明已水解完全），' +
          '新制 Cu(OH)2 检验葡萄糖（砖红色沉淀，检验前必须先加 NaOH 中和酸）。' +
          '本次用' + (cat === 'h2so4' ? '稀硫酸' : (cat === 'enzyme' ? '唾液淀粉酶' : '不加催化剂')) +
          '、' + Math.round(temp) + ' ℃、' + Math.round(t) + ' min，水解程度为第 ' + stage + ' 步（0 淀粉/1 糊精/2 麦芽糖/3 葡萄糖）。',
        equation: '(C6H10O5)1000 + 1000H2O = 1000C6H12O6',
        ionic: '',
        errors: [
          '检验葡萄糖前没有加 NaOH 中和稀硫酸，Cu(OH)2 被酸溶解，看不到砖红色沉淀',
          '为了"确保碱性"先加 NaOH 再滴碘水：碘与 NaOH 反应，蓝色不出现，无法判断淀粉是否水解完全',
          '用唾液淀粉酶却在沸水浴中加热：酶变性失活，水解几乎不发生（酶催化的最适温度约 37 ℃）',
          '加热时间太短或水浴温度太低（如只到 40 ℃ 用酸催化）：水解只到糊精/麦芽糖阶段，检验结果判读错误',
          '把"碘水不变蓝"直接当成"生成了葡萄糖"：不变蓝只说明淀粉已水解完，还要用新制 Cu(OH)2 或银镜反应确认葡萄糖'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var cat = qgSel(p, 'cat', 'h2so4');
      var temp = qgPN(p, 'temp', 80);
      var t = qgPN(p, 'time', 10);
      var act = cat === 'h2so4' ? qgClamp((temp - 20) / 55, 0.04, 1.15)
        : (cat === 'enzyme' ? ((temp > 60) ? 0.04 : qgClamp(1 - Math.abs(temp - 37) / 45, 0.15, 1))
          : 0.02 + 0.02 * (temp / 100));
      var extent = qgClamp(act * (t / 8), 0, 1.4);
      var stage = extent < 0.25 ? 0 : (extent < 0.5 ? 1 : (extent < 0.8 ? 2 : 3));
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);

      /* 水浴 + 水解试管 */
      var bx = 180, by = 300, bw = 240, bh = 126;
      qgPath(g, [[bx, by], [bx, by + bh], [bx + bw, by + bh], [bx + bw, by]], null, null, 1.6, false);
      qgRect(g, bx + 2, by + 26, bw - 4, bh - 28, null, 'rgba(150,190,215,.35)', 0);
      qgTag(g, cat === 'enzyme' ? '温水浴（约 ' + Math.round(temp) + ' ℃，酶最适约 37 ℃）'
        : '水浴（约 ' + Math.round(temp) + ' ℃）', bx + bw / 2, by + bh + 20, 11.5);
      var tx = 240, ty = 160, tw = 76, th = 150;
      var inner = qgTube(g, tx, ty, tw, th);
      qgTubeBegin(g);                       /* 液体裁剪在试管内腔里 */
      var liqTop = inner.y + inner.h * 0.30;
      qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.y + inner.h - liqTop, null, 'rgba(235,232,215,.75)', 0);
      if (stage === 0) {
        qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.y + inner.h - liqTop, null, 'rgba(60,80,140,.35)', 0);
      }
      qgTubeEnd(g);
      qgTag(g, '淀粉溶液 + ' + (cat === 'h2so4' ? '稀硫酸' : (cat === 'enzyme' ? '唾液淀粉酶' : '蒸馏水')),
        tx + tw / 2, ty - 12, 11.5);

      /* 检验试管①：碘水 */
      var ax = 470, ay = 160, aw = 64, ah = 130;
      var inA = qgTube(g, ax, ay, aw, ah);
      qgTubeBegin(g);
      var topA = inA.y + inA.h * 0.30;
      var iodine = ['rgba(30,50,140,.85)', 'rgba(90,60,150,.7)', 'rgba(180,150,120,.35)', 'rgba(230,228,215,.25)'][stage];
      qgRect(g, inA.x + 1, topA, inA.w - 2, inA.y + inA.h - topA, null, iodine, 0);
      qgTubeEnd(g);
      qgTag(g, '加碘水：' + ['变深蓝色', '蓝紫→棕红', '不变蓝', '不变蓝'][stage], ax + aw / 2, ay + ah + 16, 11);

      /* 检验试管②：新制 Cu(OH)2 */
      var cx2 = 580, cy2 = 160, cw = 64, ch = 130;
      var inC = qgTube(g, cx2, cy2, cw, ch);
      qgTubeBegin(g);                       /* 液体 + 砖红色 Cu₂O 圆点都裁剪在内腔里 */
      var topC = inC.y + inC.h * 0.30;
      qgRect(g, inC.x + 1, topC, inC.w - 2, inC.y + inC.h - topC, null,
        stage >= 2 ? 'rgba(160,80,40,.7)' : 'rgba(120,170,225,.6)', 0);
      var k, n = Math.round(stage * 5);
      for (k = 0; k < n; k++) {
        qgCircle(g, inC.x + 8 + (k * 21 % (inC.w - 14)), inC.y + inC.h - 10 - (k * 9 % 22), 3.6, null,
          'rgba(180,70,30,.85)', 0);
      }
      qgTubeEnd(g);
      qgTag(g, '先加 NaOH 中和，再加新制 Cu(OH)2 加热：' +
        (stage >= 2 ? '砖红色沉淀' : '无明显砖红色'), cx2 + cw / 2, cy2 + ch + 16, 11);

      /* 分步箭头 */
      qgTxt(g, '淀粉 → 糊精 → 麦芽糖 → 葡萄糖', 56, 60, 14, 'left', null, true, false);
      var i;
      for (i = 0; i < 4; i++) {
        var sx = 70 + i * 96;
        qgRect(g, sx, 78, 62, 24, 'rgba(38,34,28,.5)',
          i <= stage ? 'rgba(200,180,120,.85)' : 'rgba(230,228,220,.7)', 1.2);
        qgTag(g, ['淀粉', '糊精', '麦芽糖', '葡萄糖'][i], sx + 31, 118, 11,
          i <= stage ? null : 'rgba(38,34,28,.45)');
        if (i < 3) qgLine(g, sx + 62, 90, sx + 96, 90, 'rgba(38,34,28,.55)', 1.4);
      }
      qgTxt(g, '当前水解程度：第 ' + stage + ' 步（' + ['未水解', '生成糊精', '生成麦芽糖', '水解完全，得葡萄糖'][stage] + '）',
        56, 146, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '通式：(C6H10O5)n + nH2O = nC6H12O6（表中 n 写实为 1000）', 56, 166, 12, 'left', null, true, true);
      if (cat === 'h2so4') {
        qgTxt(g, '注意：检验葡萄糖前必须加 NaOH 中和稀硫酸；检验淀粉要在冷却后直接滴碘水',
          56, 186, 11.5, 'left', 'rgba(150,70,30,.9)', true, false);
      } else if (cat === 'enzyme') {
        qgTxt(g, temp > 60 ? '沸水浴使淀粉酶变性失活 —— 几乎不水解' : '酶催化：37 ℃ 左右活性最高',
          56, 186, 11.5, 'left', temp > 60 ? 'rgba(150,70,30,.9)' : 'rgba(38,34,28,.75)', true, false);
      }
      qgBubbles(g, inner.x + 6, liqTop + 12, inner.w - 12, inner.y + inner.h - liqTop - 18, ph, 3,
        'rgba(255,255,255,.6)');
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 10 / 11
   * benzene-bromo · 苯的溴代与硝化（液溴 + FeBr3 / 浓硝酸 + 浓硫酸）
   * 来源 [S5]（菁优网：2Fe+3Br2=2FeBr3、AgBr 浅黄色沉淀、红褐色油状液滴含 Br2、
   *      长导管"导气，冷凝回流"、NaOH 洗涤后分液；硝化 50~60 ℃ 水浴、
   *      淡黄色油状液体含 NO2、苦杏仁气味、密度比水大、5% NaOH 洗涤除酸）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('benzene-bromo', {
    id: 'benzene-bromo',
    name: '苯的溴代反应与硝化反应',
    group: '有机反应',
    aim: '对比苯的溴代与硝化：看清催化剂（FeBr3 / 浓硫酸）、温度条件（常温 / 50~60 ℃ 水浴）与产物',
    principle: '苯环上的氢原子可以被取代，但**必须有催化剂**，而且要用液溴、不能用溴水。' +
      '① 溴代：C6H6 + Br2 --FeBr3--> C6H5Br + HBr。铁屑先与溴反应生成 FeBr3（2Fe + 3Br2 = 2FeBr3）作催化剂；' +
      '生成的 HBr 气体遇空气中水蒸气形成白雾，通入 AgNO3 溶液生成淡黄色 AgBr 沉淀。' +
      '产物溴苯是无色油状液体、密度比水大、不溶于水；粗产品因溶有溴而呈红褐色，用 NaOH 溶液（或水）洗涤后再分液、蒸馏可得无色溴苯。' +
      '② 硝化：C6H6 + HNO3 --浓硫酸,50~60℃--> C6H5NO2 + H2O。浓硫酸起催化剂和吸水剂的作用；' +
      '温度必须用水浴控制在 50~60 ℃——温度过高硝酸会分解产生 NO2，还会发生多硝化等副反应（生成间二硝基苯）。' +
      '硝基苯是无色油状液体、密度比水大、有苦杏仁气味，实验中因溶有 NO2 而显淡黄色。' +
      '两个反应都用长导管（或冷凝管）导气并冷凝回流苯和溴，提高原料利用率。',
    apparatus: ['圆底烧瓶（或三颈烧瓶）', '苯', '液溴', '铁屑（生成 FeBr3）', '浓硝酸', '浓硫酸',
      '长导管（冷凝回流）', 'AgNO3 溶液', '50~60 ℃ 水浴'],
    steps: [
      '溴代：在烧瓶中加入苯和少量液溴，再加入少量铁屑（先生成 FeBr3 作催化剂），塞紧带长导管的塞子',
      '把导管口通入 AgNO3 溶液，观察烧瓶内液体微沸、白雾、导管口的红棕色气体与锥形瓶中的淡黄色沉淀',
      '反应后向烧瓶中加入水（或 NaOH 溶液）洗涤，分液得到密度比水大的褐色油状粗溴苯',
      '硝化：先配混酸（把浓硫酸慢慢加入浓硝酸中并不断搅拌冷却），再加入苯，装好温度计与冷凝回流装置',
      '在 50~60 ℃ 水浴中加热并控制温度，冷却后把混合液倒入水中，观察底部淡黄色油状液体（硝基苯，有苦杏仁气味）'
    ],
    params: [
      {
        key: 'rxn', label: '反应', type: 'select', value: 'bromo',
        options: [
          { value: 'bromo', label: '溴代：苯 + 液溴（FeBr3 催化）' },
          { value: 'nitro', label: '硝化：苯 + 浓硝酸（浓硫酸催化/吸水）' }
        ]
      },
      { key: 'cat', label: '催化剂用量（铁屑 g / 浓硫酸 mL）', unit: '', min: 0.1, max: 3, step: 0.1, value: 0.5 },
      { key: 'temp', label: '反应温度', unit: '℃', min: 20, max: 80, step: 5, value: 25 },
      { key: 'time', label: '反应时间', unit: 'min', min: 1, max: 20, step: 1, value: 5 }
    ],
    /* 模型（定性）
       溴代：常温即可，但必须有 FeBr3（铁屑）——催化剂太少时几乎不发生取代
       硝化：必须 45~65 ℃ 水浴；温度过高硝酸分解、且发生多硝化（生成间二硝基苯） */
    react: function (p) {
      var rxn = qgSel(p, 'rxn', 'bromo');
      var cat = qgPN(p, 'cat', 0.5);
      var temp = qgPN(p, 'temp', 25);
      var t = qgPN(p, 'time', 5);
      var ph = [];
      var extent, equation, conditions, type;

      if (rxn === 'bromo') {
        var catOK = cat >= 0.2;
        extent = qgClamp((catOK ? qgClamp(cat / 0.8, 0.2, 1.2) : 0.08) *
          qgClamp((temp - 5) / 35, 0.15, 1.1) * (0.4 + 0.6 * qgClamp(t / 8, 0, 1.3)), 0, 1.3);
        equation = 'C6H6 + Br2 = C6H5Br + HBr';
        type = '取代反应（苯环上的溴代）';
        conditions = '液溴、铁屑（先生成 FeBr3 作催化剂）、常温（约 ' + Math.round(temp) + ' ℃）';
        if (!catOK) {
          ph.push('几乎没有气泡和白雾：没有 FeBr3 催化时，苯与溴在常温下几乎不发生取代反应');
          ph.push('烧瓶内的液体只是被溴染成橙红色（溴溶于苯），长时间放置也只有极少量 HBr 生成');
        } else {
          ph.push('烧瓶内液体呈微沸状态，液面上方出现白雾（生成的 HBr 遇空气中的水蒸气）');
          ph.push('导管口有红棕色气体逸出（未反应的溴蒸气挥发）；把气体通入 AgNO3 溶液，产生淡黄色沉淀（AgBr），' +
            '证明发生了取代反应并生成了 HBr');
          ph.push('反应后加入水（或 NaOH 溶液）洗涤，烧瓶底部出现褐色油状液体（粗溴苯溶有溴而显褐色，密度比水大、不溶于水）');
          if (extent > 0.8) {
            ph.push('反应进行得比较充分：油状粗溴苯较多，白雾持续时间长（催化剂用量、温度和时间都合适）');
          }
          ph.push('铁屑的作用：2Fe + 3Br2 = 2FeBr3，真正起催化作用的是 FeBr3；用溴水代替液溴只能发生萃取（苯层变橙红），' +
            '不会发生取代反应');
        }
        if (temp > 60) {
          ph.push('温度偏高使溴大量挥发，导管口红棕色气体增多、溴损失，产率下降（溴代常温即可，不需要加热）');
        }
      } else {
        var ok = temp >= 45 && temp <= 65;
        extent = qgClamp((ok ? 1 : (temp < 45 ? 0.1 : 0.5)) * qgClamp(cat / 1.5, 0.15, 1.2) *
          (0.4 + 0.6 * qgClamp(t / 8, 0, 1.3)), 0, 1.3);
        if (temp > 65) {
          equation = 'C6H6 + 2HNO3 = C6H4(NO2)2 + 2H2O';
          type = '取代反应（苯环上的硝化，温度过高时发生多硝化）';
        } else {
          equation = 'C6H6 + HNO3 = C6H5NO2 + H2O';
          type = '取代反应（苯环上的硝化）';
        }
        conditions = '浓硝酸与浓硫酸的混酸（浓硫酸作催化剂和吸水剂）、' +
          (ok ? '50~60 ℃ 水浴加热' : (temp < 45 ? '温度偏低（低于 45 ℃）' : '温度过高（超过 65 ℃）'));
        if (!ok && temp < 45) {
          ph.push('水浴温度偏低，混合液长时间没有明显变化：硝化反应需要 50~60 ℃ 的水浴温度');
          ph.push('倒入水中后只有极少量淡黄色油状液体（生成的硝基苯很少）');
        } else if (temp > 65) {
          ph.push('温度超过 65 ℃：硝酸受热分解，混合液上方出现红棕色气体（NO2），反应难以控制');
          ph.push('除了硝基苯，还发生多硝化等副反应（生成间二硝基苯），产物颜色变深、不纯');
          ph.push('得到的油状液体密度比水大、气味更刺鼻，用水洗涤时分层不如纯硝基苯清晰');
        } else {
          ph.push('水浴加热（50~60 ℃）时，混合液逐渐变为淡黄色（溶有硝酸分解产生的 NO2）');
          ph.push('冷却后把混合液倒入水中，烧杯底部出现淡黄色油状液体——硝基苯，密度比水大、有苦杏仁气味');
          ph.push('纯净的硝基苯是无色油状液体；粗产品依次用蒸馏水、5% NaOH 溶液、蒸馏水洗涤后干燥蒸馏可得到纯品');
        }
        ph.push('配制混酸时必须把浓硫酸慢慢加入浓硝酸中并不断搅拌、冷却（顺序颠倒会因放热剧烈而飞溅）');
        if (cat < 0.5) {
          ph.push('浓硫酸用量偏少：它既是催化剂又是吸水剂，用量不足时反应速率与产率都下降');
        }
      }
      return {
        phenomena: ph,
        equation: equation,
        ionic: '',
        type: type,
        conditions: conditions,
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var rxn = qgSel(p, 'rxn', 'bromo');
      var cat = qgPN(p, 'cat', 0.5);
      var temp = qgPN(p, 'temp', 25);
      var t = qgPN(p, 'time', 5);
      if (rxn === 'bromo') {
        return {
          text: '苯与液溴在 FeBr3（由铁屑与溴反应生成）催化下发生取代反应：C6H6 + Br2 → C6H5Br + HBr。' +
            '现象是液体微沸、白雾（HBr）、导管口红棕色气体（挥发的溴）、AgNO3 溶液中出现淡黄色 AgBr 沉淀，' +
            '反应后得到密度比水大的褐色油状粗溴苯（含溴），洗涤分液后可提纯。' +
            '本次铁屑 ' + cat + ' g、温度 ' + Math.round(temp) + ' ℃、' + Math.round(t) + ' min。' +
            '注意：苯与溴水不反应（只发生萃取），必须用液溴。',
          equation: 'C6H6 + Br2 = C6H5Br + HBr',
          ionic: '',
          errors: [
            '用溴水代替液溴：苯只把溴萃取到苯层（橙红色），不发生取代反应，也没有 HBr 生成',
            '忘记加铁屑（FeBr3）：没有催化剂，苯与溴几乎不反应',
            '把挥发出的溴蒸气当成 HBr：溴蒸气也能与 AgNO3 溶液生成淡黄色沉淀，应先用苯或 CCl4 洗气除去溴',
            '粗溴苯没有用 NaOH 溶液（或水）洗涤就蒸馏：溶有的溴与氢溴酸随蒸气一起蒸出，产物仍带颜色',
            '温度过高使溴大量挥发，溴损失、产率下降（溴代在常温下进行即可）'
          ]
        };
      }
      return {
        text: '苯与浓硝酸在浓硫酸催化、50~60 ℃ 水浴条件下发生取代（硝化）反应：C6H6 + HNO3 → C6H5NO2 + H2O。' +
          '浓硫酸既催化又吸水；温度必须控制好：过低几乎不反应，过高则硝酸分解（产生红棕色 NO2）并发生多硝化。' +
          '产物硝基苯是无色油状液体（含 NO2 时显淡黄色）、密度比水大、有苦杏仁气味。' +
          '本次温度 ' + Math.round(temp) + ' ℃、催化剂用量 ' + cat + '、反应 ' + Math.round(t) + ' min。',
        equation: 'C6H6 + HNO3 = C6H5NO2 + H2O',
        ionic: '',
        errors: [
          '水浴温度没有控制在 50~60 ℃：温度过低不反应，温度过高硝酸分解并发生多硝化，产物不纯',
          '配制混酸时把浓硝酸加入浓硫酸（或没搅拌、没冷却）：放热集中、液体飞溅',
          '忘记加浓硫酸或用量太少：缺少催化剂和吸水剂，反应速率与产率都低',
          '把混合液倒入水中后没有分液就直接蒸馏：混酸与副产物一起被蒸出，腐蚀设备且产物不纯',
          '用温度计测蒸气温度而不是水浴/反应液温度，控温失效'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var rxn = qgSel(p, 'rxn', 'bromo');
      var cat = qgPN(p, 'cat', 0.5);
      var temp = qgPN(p, 'temp', 25);
      var t = qgPN(p, 'time', 5);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);
      var i;

      /* 圆底烧瓶（苯 + 试剂） */
      var fx = 230, fy = 350, fr = 68;
      var fl = qgFlask(g, fx, fy, fr, 28, 54);
      var liqTop = fl.cy + fr * 0.22;
      var orange = rxn === 'bromo' ? 'rgba(200,110,50,.7)' : 'rgba(225,215,140,.7)';
      qgFlaskFill(g, fl.cx, fl.cy, fr, liqTop, fl.cy + fr - 2, orange);
      if (rxn === 'nitro') {
        qgFlaskFill(g, fl.cx, fl.cy, fr, liqTop, liqTop + 16, 'rgba(240,220,120,.75)');
      }
      qgTag(g, rxn === 'bromo' ? '苯 + 液溴 + 铁屑' : '苯 + 混酸（浓硝酸 + 浓硫酸）', fl.cx, fl.cy + fr + 24, 11.5);
      if (rxn === 'bromo') {
        for (i = 0; i < 5; i++) {
          qgCircle(g, fl.cx - 26 + i * 13, fl.cy + fr - 16 - (i % 2) * 6, 3, 'rgba(38,34,28,.6)',
            'rgba(60,58,54,.7)', 1);
        }
      }
      /* 加热方式 */
      if (rxn === 'nitro') {
        var bk = qgBeaker(g, fl.cx - 92, 366, 184, 92, 1.4);
        qgRect(g, bk.x + 1, 392, bk.w - 2, 64, null, 'rgba(150,190,215,.35)', 0);
        qgTag(g, '50~60 ℃ 水浴（' + Math.round(temp) + ' ℃）', fl.cx, 478, 11.5);
        qgThermo(g, fl.cx + 74, 250, 400, 2.4);
      } else {
        qgTag(g, '常温（约 ' + Math.round(temp) + ' ℃）', fl.cx, 478, 11.5);
      }
      /* 长导管（导气 + 冷凝回流） */
      qgPipe(g, [[fl.cx + fl.neckW / 2, 268], [fl.cx + 60, 268], [fl.cx + 60, 200], [470, 200], [470, 268]], 2);
      qgTxt(g, '长导管：导气 + 冷凝回流', fl.cx + 96, 190, 11, 'left', 'rgba(38,34,28,.7)', true, false);
      /* AgNO3 锥形瓶 */
      var gx = 430, gy = 268;
      qgPath(g, [[gx, gy + 78], [gx + 88, gy + 78], [gx + 74, gy], [gx + 14, gy]], null, null, 1.5, false);
      qgRect(g, gx + 8, gy + 30, 72, 46, null, 'rgba(190,215,230,.45)', 0);
      var ppt = rxn === 'bromo' ? qgClamp(cat / 0.8, 0, 1) : 0;
      for (i = 0; i < Math.round(9 * ppt); i++) {
        qgCircle(g, gx + 16 + (i * 23 % 58), gy + 70 - (i * 7 % 20), 3.2, null, 'rgba(235,225,120,.95)', 0);
      }
      qgTag(g, 'AgNO3 溶液', gx + 44, gy + 96, 11);
      qgTxt(g, rxn === 'bromo' ? '淡黄色 AgBr 沉淀（证明生成 HBr）' : '（本反应不产生 HBr，该瓶可省）',
        gx + 44, gy + 114, 10.5, 'center', 'rgba(38,34,28,.7)', true, false);

      /* 文字 */
      qgTxt(g, rxn === 'bromo' ? '苯的溴代（FeBr3 催化）' : '苯的硝化（浓硫酸催化、水浴控温）', 56, 60, 15, 'left', null, true, false);
      qgTxt(g, rxn === 'bromo' ? 'C6H6 + Br2 = C6H5Br + HBr    （2Fe + 3Br2 = 2FeBr3）'
        : (temp > 65 ? 'C6H6 + 2HNO3 = C6H4(NO2)2 + 2H2O（温度过高，多硝化）'
          : 'C6H6 + HNO3 = C6H5NO2 + H2O'),
        56, 82, 12, 'left', null, true, true);
      qgTxt(g, rxn === 'bromo' ? '产物：溴苯（无色油状、密度比水大）——粗品溶溴呈褐色'
        : '产物：硝基苯（无色油状、密度比水大、苦杏仁气味）——含 NO2 时显淡黄色',
        56, 104, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, rxn === 'bromo' ? '白雾（HBr）· 导管口红棕色气体 · 液体微沸'
        : (temp > 65 ? '温度过高：NO2 红棕色气体 + 多硝化副反应' : '水浴 50~60 ℃：混合液变淡黄色'),
        56, 126, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      if (rxn === 'bromo') {
        qgSmell(g, fl.cx + 140, 240, ph, 'rgba(200,200,200,.55)');
      }
      qgBubbles(g, fl.cx - fr * 0.6, liqTop + 6, fr * 1.2, fl.cy + fr - liqTop - 12, ph, 5,
        'rgba(255,255,255,.55)');
      qgUnframe(g);
    }
  });

  /* ---------------------------------------------------------------- 11 / 11
   * phenol-bromine · 苯酚与浓溴水的反应（2,4,6-三溴苯酚白色沉淀）
   * 来源 [S3]（武汉教育云·万长江名师工作室《解读苯酚与溴水反应实验》全文：
   *      教材原句"向盛有少量苯酚稀溶液的试管里滴入过量浓溴水"、
   *      "苯酚与溴的反应很灵敏，常用于苯酚的定性检验与定量测定"；
   *      2 滴→无现象（三溴苯酚量少且溶解在苯酚中）、4 滴→大量白色沉淀、
   *      10 滴→变黄（生成黄色的 2,4,4,6-四溴环己二烯酮）；
   *      结论"浓溴水应稍过量，但不能过量太多"）
   * -------------------------------------------------------------- */
  window.QG_CLAB.register('phenol-bromine', {
    id: 'phenol-bromine',
    name: '苯酚与浓溴水的反应（三溴苯酚白色沉淀）',
    group: '有机反应',
    aim: '观察苯酚与浓溴水反应生成白色沉淀的现象，理解苯酚中苯环比苯更活泼、以及溴水用量对现象的影响',
    principle: 'C6H5OH + 3Br2 --→ C6H2Br3OH↓ + 3HBr，生成 2,4,6-三溴苯酚白色沉淀。' +
      '苯酚分子中羟基直接连在苯环上，羟基是致活基团，使苯环上的邻、对位变得非常活泼，' +
      '所以苯酚与溴水**不需要催化剂、常温下就能反应**，而且一次取代三个氢原子；' +
      '对比苯的溴代需要 FeBr3 催化、且只能一取代，可以说明羟基对苯环的影响。' +
      '这个反应很灵敏，常用于苯酚的定性检验与定量测定，但**溴水必须稍过量**：' +
      '溴水太少时生成的三溴苯酚量少、又会溶解在过量的苯酚里，看不到白色沉淀；' +
      '溴水过量太多时，白色沉淀会继续被溴氧化/取代而转变成黄色的 2,4,4,6-四溴环己二烯酮。' +
      '注意：苯胺与溴水反应也生成白色沉淀，所以不能只凭"白色沉淀"就断定是苯酚。',
    apparatus: ['试管', '苯酚稀溶液', '浓溴水（饱和溴水）', '胶头滴管', '蒸馏水'],
    steps: [
      '取一支试管，加入约 1 mL 苯酚稀溶液（苯酚在冷水中溶解度小，通常用稀溶液）',
      '用胶头滴管逐滴加入浓溴水，边加边振荡，观察沉淀的出现',
      '先滴 2 滴：溶液只变浑浊、看不到白色沉淀（三溴苯酚量少且溶解在苯酚中）',
      '继续滴到 4 滴左右（稍过量）：出现大量白色沉淀，这就是教材的演示方法',
      '再继续滴到 10 滴（大大过量）：白色沉淀转变为黄色沉淀，说明溴水不能过量太多'
    ],
    params: [
      {
        key: 'br2Conc', label: '溴水浓度', type: 'select', value: 'conc',
        options: [
          { value: 'conc', label: '浓溴水（饱和溴水，教材用法）' },
          { value: 'dilute', label: '稀溴水（浓度约为浓溴水的 1/5）' }
        ]
      },
      { key: 'drops', label: '滴入浓溴水的滴数', unit: '滴', min: 1, max: 10, step: 1, value: 4 },
      { key: 'phenolVol', label: '苯酚稀溶液的用量', unit: 'mL', min: 0.5, max: 3, step: 0.25, value: 1 }
    ],
    /* 模型（定性，直接照搬 [S3] 的实验事实）
       4 滴浓溴水对 1 mL 稀苯酚溶液 ≈ 稍过量（教材方法，大量白色沉淀）
       滴数太少（溴不足）→ 无沉淀；滴数太多（溴大大过量）→ 沉淀变黄 */
    react: function (p) {
      var conc = qgSel(p, 'br2Conc', 'conc');
      var drops = qgPN(p, 'drops', 4);
      var vol = qgPN(p, 'phenolVol', 1);
      /* 以"4 滴浓溴水对 1 mL 稀苯酚溶液 = 稍过量（教材方法）"为基准 1.0；稀溴水按 1/5 折算 */
      var eff = drops * (conc === 'conc' ? 1 : 0.2) / (4 * vol);
      var ph = [];
      var state;
      if (eff < 0.6) {
        state = 'none';
        ph.push('滴入溴水后溶液只变浑浊、略带橙黄色，看不到白色沉淀' +
          '（生成的三溴苯酚量太少，而且溶解在过量的苯酚里）');
        ph.push('继续滴加浓溴水（让溴稍过量）后才会出现白色沉淀——教材演示必须滴入过量浓溴水');
      } else if (eff <= 2.0) {
        state = 'white';
        ph.push('滴入浓溴水后立即出现大量白色沉淀（2,4,6-三溴苯酚，不溶于水）');
        ph.push('振荡后沉淀不消失，溶液由澄清变浑浊；这一现象很灵敏，常用于苯酚的定性检验与定量测定');
        ph.push('反应不需要催化剂、常温下就能进行（对比：苯的溴代必须用 FeBr3 催化）');
        ph.push('溶液中同时生成 HBr，使溶液显酸性（可用 AgNO3 溶液检验 Br-）');
      } else {
        state = 'yellow';
        ph.push('先是出现白色沉淀，继续滴加浓溴水后白色沉淀逐渐转变成黄色沉淀');
        ph.push('溴水大大过量时，三溴苯酚继续被溴取代/氧化，生成黄色的 2,4,4,6-四溴环己二烯酮');
        ph.push('结论：浓溴水应"稍过量"，过量太多反而得不到白色沉淀（白色沉淀转为黄色）');
      }
      if (conc === 'dilute' && state !== 'none') {
        ph.push('用稀溴水时要滴入更多滴才能达到同样的效果（溴的总量才是决定现象的关键）');
      }
      if (vol >= 2) {
        ph.push('苯酚溶液用量较多：需要更多溴水才能把苯酚完全沉淀，否则沉淀会被过量的苯酚溶解');
      }
      return {
        phenomena: ph,
        equation: 'C6H5OH + 3Br2 = C6H2Br3OH↓ + 3HBr',
        ionic: '',
        type: '取代反应（苯酚苯环上的三溴代，羟基使苯环活化）',
        conditions: '浓溴水稍过量、常温、不需要催化剂（苯酚与溴水直接反应）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var conc = qgSel(p, 'br2Conc', 'conc');
      var drops = qgPN(p, 'drops', 4);
      var vol = qgPN(p, 'phenolVol', 1);
      var eff = drops * (conc === 'conc' ? 1 : 0.2) / (4 * vol);
      var res = eff < 0.6 ? '看不到白色沉淀（溴不足）' : (eff <= 2.0 ? '出现大量白色沉淀（教材方法）' : '白色沉淀转为黄色沉淀（溴大大过量）');
      return {
        text: '苯酚与浓溴水在常温下就能反应，生成 2,4,6-三溴苯酚白色沉淀：C6H5OH + 3Br2 → C6H2Br3OH↓ + 3HBr。' +
          '羟基使苯环上的邻、对位变得活泼，所以既不需要催化剂、又能一次取代三个氢原子' +
          '（对比苯的溴代需要 FeBr3 催化且只一取代）。本次用' + (conc === 'conc' ? '浓溴水' : '稀溴水') +
          ' ' + Math.round(drops) + ' 滴、苯酚稀溶液 ' + vol + ' mL：' + res + '。' +
          '操作要点是"浓溴水稍过量，但不能过量太多"。',
        equation: 'C6H5OH + 3Br2 = C6H2Br3OH↓ + 3HBr',
        ionic: '',
        errors: [
          '溴水没有稍过量：三溴苯酚量少又溶解在过量苯酚中，看不到白色沉淀（误判为"不反应"）',
          '溴水过量太多：白色沉淀转变成黄色的 2,4,4,6-四溴环己二烯酮，现象与教材不符',
          '苯酚溶液浓度过大或用量过多：需要更多溴水，沉淀还可能被苯酚溶解',
          '苯酚在冷水中溶解度小，取用前没有配成稀溶液（或没有振荡），反应不均匀',
          '只凭"白色沉淀"断定是苯酚：苯胺与溴水反应也生成白色沉淀，需要结合 FeCl3 显紫色等其他方法'
        ]
      };
    },
    step: function (p, state, dt) {
      if (state) state.anim = qgNum(state.anim, 0) + dt;
    },
    draw: function (g, p, state) {
      if (!g || !g.c) return;
      qgFrame(g);
      var conc = qgSel(p, 'br2Conc', 'conc');
      var drops = qgPN(p, 'drops', 4);
      var vol = qgPN(p, 'phenolVol', 1);
      var eff = drops * (conc === 'conc' ? 1 : 0.2) / (4 * vol);
      var ph = qgNum(state && (state.anim !== undefined ? state.anim : state.t), 0);
      var st = eff < 0.6 ? 'none' : (eff <= 2.0 ? 'white' : 'yellow');

      /* 试管 */
      var tx = 300, ty = 120, tw = 104, th = 250;
      var inner = qgTube(g, tx, ty, tw, th);
      var liqTop = inner.y + inner.h * 0.34;
      qgTubeBegin(g);                       /* 浊液 + 白色/黄色三溴苯酚沉淀圆点裁剪在内腔里 */
      var base = st === 'none' ? 'rgba(235,225,195,.55)' : (st === 'white' ? 'rgba(240,238,230,.85)' : 'rgba(238,228,150,.85)');
      qgRect(g, inner.x + 1, liqTop, inner.w - 2, inner.y + inner.h - liqTop, null, base, 0);
      var i, n = st === 'none' ? 0 : (st === 'white' ? 16 : 16);
      for (i = 0; i < n; i++) {
        var px = inner.x + 8 + (i * 31 % (inner.w - 18));
        var py = liqTop + 10 + (i * 17 % (inner.y + inner.h - liqTop - 18));
        qgCircle(g, px, py, 3.2, null,
          st === 'white' ? 'rgba(252,252,250,.95)' : 'rgba(226,206,70,.95)', 0);
      }
      qgTubeEnd(g);
      /* 滴管 */
      qgRect(g, tx + tw / 2 - 7, 40, 14, 62, 'rgba(38,34,28,.7)', 'rgba(225,230,235,.6)', 1.2);
      qgPath(g, [[tx + tw / 2 - 3, 102], [tx + tw / 2, 122], [tx + tw / 2 + 3, 102]],
        'rgba(38,34,28,.6)', 'rgba(220,225,230,.7)', 1, true);
      for (i = 0; i < Math.min(10, Math.round(drops)); i++) {
        qgCircle(g, tx + tw / 2, 132 + i * 0 + (i % 3) * 2, 2.6, null, 'rgba(210,120,40,.9)', 0);
      }
      qgTxt(g, (conc === 'conc' ? '浓溴水' : '稀溴水') + ' ' + Math.round(drops) + ' 滴',
        tx + tw / 2 + 24, 60, 12, 'left', 'rgba(160,90,20,.95)', true, false);
      qgTag(g, '苯酚稀溶液 ' + vol + ' mL', tx + tw / 2, ty + th + 18, 11.5);
      /* 现象文字 */
      qgTxt(g, st === 'none' ? '现象：溶液变浑浊、略带橙黄，看不到白色沉淀'
        : (st === 'white' ? '现象：立即出现大量白色沉淀（2,4,6-三溴苯酚）'
          : '现象：白色沉淀逐渐转变为黄色沉淀（四溴环己二烯酮）'),
        tx + tw + 30, 200, 12.5, 'left',
        st === 'white' ? 'rgba(90,90,90,.95)' : (st === 'yellow' ? 'rgba(160,130,20,.95)' : 'rgba(150,90,20,.95)'),
        true, true);
      /* 文字 */
      qgTxt(g, '苯酚与浓溴水（不需要催化剂）', 56, 60, 15, 'left', null, true, false);
      qgTxt(g, 'C6H5OH + 3Br2 = C6H2Br3OH↓ + 3HBr', 56, 82, 12.5, 'left', null, true, true);
      qgTxt(g, '羟基使苯环活化 → 常温、无催化剂即可三溴代', 56, 104, 12, 'left', 'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '对比：苯的溴代需要 FeBr3 催化，且只生成一溴代物', 56, 126, 12, 'left',
        'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '溴水用量：2 滴→无沉淀 · 4 滴（稍过量）→大量白色沉淀 · 10 滴→变黄', 56, 148, 12, 'left',
        'rgba(38,34,28,.75)', true, false);
      qgTxt(g, '该反应很灵敏，常用于苯酚的定性检验与定量测定', 56, 170, 12, 'left',
        'rgba(38,34,28,.75)', true, false);
      qgBubbles(g, inner.x + 6, liqTop + 8, inner.w - 12, inner.y + inner.h - liqTop - 14, ph, 3,
        'rgba(255,255,255,.55)');
      qgUnframe(g);
    }
  });
}());
