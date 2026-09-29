/* ============================================================================
 * 穷观 · 化学实验台 —— 组 6 · 物质检验·分离·定量（js/clab/analysis.js）
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向化学实验台注册表登记 8 个反应
 *     window.QG_CLAB.register(id, spec)
 * 不自建 DOM、不起循环、不读写全局状态（惰性，与 js/pslab/*.js 一致）。
 * 纯 ES5、零依赖、不联网、不用 eval / new Function（守观澜的严格 CSP）。
 *
 * ── 契约依据 ────────────────────────────────────────────────────────────────
 *   docs/化学实验台设计.md §2 组 6 · 物质检验·分离·定量（8 个 id，逐字）
 *                          §3 register(id, spec) 的字段与 react() 的返回值
 *                          §4 每个反应的验收（1~8 条）
 *   docs/物理实验台设计.md §9 实现约定补充：
 *      ① null =「这次测量在这张图上没有有效值」，不是 0（核心跳过该行、不进 r²）；
 *      ② g.font 是宽容签名（(size) / (size,bool) / (size,'italic bold') / (size,italic,bold)）；
 *      ③ 滑块 step 会被归一化，register 时做参数体检，warning 进 state().warnings；
 *      ④ 没有 min/max 的参数必须写 type:'select'（本文件大量使用）。
 *   另外两条判据事实：r² 只在「扫自变量」时才有意义；定量列必须能作图。
 *
 * ── react() 的返回（契约 §3）───────────────────────────────────────────────
 *   { phenomena:[…≥2], equation:'…', ionic:'…', type:'…', conditions:'…',
 *     measures:{…}, note:'…' }
 *   **equation 一律配平**（核心 balance() 会逐元素与电荷核对，标红即不合格）。
 *   measures 的键与 columns 的键一一对应；columns 为空数组时是纯定性反应，
 *   此时 graph 必须写 null（§3：「纯定性反应：columns:[]、graph:null 合法」）。
 *   本组 5 个反应给图（焰色 / 阴离子 / 碘-淀粉 / 中和滴定 / KMnO₄滴定 / SO₂），
 *   3 个纯定性（铁离子检验 / 气体收集 / —— 见各 spec 的 graph 字段）。
 *
 * ── 滴定曲线的 fit 为什么是 'none'（用户点名要说明的那一条）────────────────
 *   `acid-base-titration` 给的是 **pH–V(NaOH) 滴定曲线**。这条曲线在数学上
 *   不是直线，而是由「剩余强酸浓度」分段决定的对数曲线：
 *       n(H⁺) 过量：  pH = −lg( c(H⁺)_过量 )        ← 左支，缓慢上升
 *       n(OH⁻) 过量： pH = pKw + lg( c(OH⁻)_过量 )  ← 右支，缓慢上升
 *   两支在化学计量点附近被压缩成一段近乎垂直的「突跃」（本模型 0.1 mol/L
 *   量级下约 pH 4.3 → 9.7，见自测输出）。对这样一条 S 形曲线做 y = a + b·x
 *   最小二乘，r² 恒在 0.6~0.75 徘徊（自测实测 ~0.68），**不是数据有问题，
 *   而是模型选错了**。所以这里按物理契约 §9 与化学契约 §3 的「非线性曲线
 *   用 fit:'none'」，核心 graph() 返回 fit:null，界面上只连点成线、不画拟合
 *   直线；曲线的信息量改由「突跃范围 / 化学计量点 / 指示剂误差」这三张
 *   数据表列承载（见 conclude 的落点）。
 *   —— 反过来，`kmno4-titration` 是**线性**关系（5Fe²⁺ ~ 1MnO₄⁻ 的定比关系），
 *   所以那一个老老实实给 fit:'origin' 并给出 r²（自测 0.99999）。
 *
 * ── 化学事实的来源（逐条核对过；PDF 读不了的一律标明「摘录」）──────────────
 *   [S1] 焰色试验 操作五步（洗/烧/蘸/烧/观）与颜色表
 *        Li 紫红 Na 黄 K 紫（透过蓝色钴玻璃片）Ca 砖红 Sr 洋红 Ba 黄绿 Cu 绿；
 *        「①焰色试验为物理变化过程」—— 人教版（2019）必修一同步讲义（全文）
 *        https://zy.21cnjy.com/26323208?f=beikeyi
 *        「钾的焰色易被钠的黄色掩盖，蓝色钴玻璃可吸收黄光，确保紫色焰色观察准确」
 *        「铁丝无焰色试验，可用洁净的铁丝来代替铂丝…不能用铜丝代替」（同上，全文）
 *   [S2] Fe³⁺ 的检验（KSCN 溶液变红）；用 K₃[Fe(CN)₆] 检验 Fe²⁺（蓝色沉淀）；
 *        「KSCN 溶液 … 检验 Fe³⁺ … 溶液变红」 —— 人教版 必修一 课件/教案（摘录）
 *        http://doc.21cnjy.com/p-19763214.html
 *   [S3] SO₄²⁻ 检验的干扰排除：「检验溶液中是否含有 SO₄²⁻ 时先用过量盐酸将溶液
 *        酸化，其目的是排除 CO₃²⁻、SO₃²⁻、Ag⁺ 等离子可能造成的干扰」；
 *        并实测证明「用硝酸酸化来排除 SO₃²⁻ 的干扰」不可行，因为
 *        3SO₃²⁻ + 2H⁺ + 2NO₃⁻ = 3SO₄²⁻ + 2NO↑ + H₂O（把 SO₃²⁻ 氧化成了 SO₄²⁻，
 *        产生假阳性）—— 真题解析（摘录；题干含实验数据表）
 *        http://www.jyeoo.com/shiti/10a4e5d7-15db-415a-53c7-a4fa1e258909
 *   [S4] 指示剂变色范围：「甲基橙的变色范围：pH＜3.1 红色，pH=3.1~4.4 橙色，
 *        pH＞4.4 黄色；酚酞的变色范围：pH＜8.2 无色，pH=8.2~10.0 粉红色，
 *        pH＞10.0 红色」；终点判据「溶液的颜色刚好由浅红变为无色，且半分钟内
 *        颜色不变化」—— 真题解析（摘录）http://www.jyeoo.com/shiti/1dd70104-ce15-4e15-57aa-c89628f25ea6/
 *        https://www.jyeoo.com/shiti/66510f03-b15d-4e15-5d66-25086798f545
 *   [S5] 中和滴定误差分析（「未用标准液润洗滴定管 → 消耗标准液的体积偏大 →
 *        待测液浓度偏高」；「读数俯视 → 体积偏小 → 浓度偏低」；
 *        锥形瓶用蒸馏水冲洗「无影响」）—— 苏教版（2019）评优课课件（摘录）
 *        https://www.51jiaoxi.com/doc-14097746.html
 *        真题解析（摘录）：http://www.jyeoo.com/shiti/10009392-1588-4e15-5779-25b46288e76f
 *   [S6] KMnO₄ 滴定：装在**酸式**滴定管；终点「当加入最后半滴 KMnO₄ 溶液时，
 *        溶液刚好由红色变为浅紫红色（或淡红色、粉红色等），且半分钟内不褪色」；
 *        5C₂O₄²⁻ + 2MnO₄⁻ + 16H⁺ = 10CO₂↑ + 2Mn²⁺ + 8H₂O —— 真题解析（摘录）
 *        http://www.jyeoo.com/shiti/e10d4e94-15c7-15ba-a754-4f7881ce25b5
 *        「2KMnO₄+5H₂C₂O₄+3H₂SO₄ = 2MnSO₄+K₂SO₄+10CO₂↑+8H₂O」「KMnO₄ 溶液应装在
 *        酸式滴定管中」「滴入最后一滴标准液时，溶液由无色变成浅紫色，且半分钟内
 *        不褪色」—— 真题解析（摘录）http://www.jyeoo.com/shiti/10009392-1588-4e15-5779-25b46288e76f
 *   [S7] SO₂ 的性质实验（装置 B 品红溶液变红→酸性氧化物；装置 C 高锰酸钾溶液
 *        紫红色褪色→还原性；装置 D 有淡黄色沉淀 2H₂S+SO₂=3S↓+2H₂O→氧化性；
 *        装置 E 探究可逆性「待品红溶液完全褪色后…点燃酒精灯加热，观察到的现象为
 *        无色溶液恢复为红色」；尾气 SO₂+2NaOH=Na₂SO₃+H₂O）—— 真题解析（摘录）
 *        https://www.jyeoo.com/shiti/5810e7ba-6150-4c15-bb55-fdea225e2cd2
 *   [S8] 碘的萃取（海带中碘的检验实验：③滤液加硫酸与新制氯水 ④滴加淀粉溶液
 *        观察现象 ⑤向③中剩余滤液中加入 3 mL CCl₄ …）—— 习题与参考答案（摘录）
 *        http://www.1010jiajiao.com/gzhx/shiti_id_646f2b2c0b1a14b042db2c0a07861ec5
 *        ⚠ 本条只核到「用 CCl₄ 从碘水/碘的酸性溶液中萃取」这一步的存在与操作顺序，
 *          「下层紫红色」这一表述未取到权威原文 —— 已在回报的「不确定」一节写明。
 *
 * ── 摩尔质量常量（IUPAC 2021 标准原子量，取 3~4 位有效数字）────────────────
 *   BaSO₄ 233.39 / AgCl 143.32 / CaCO₃ 100.09 / I₂ 253.81 g·mol⁻¹
 *   来源：IUPAC《Atomic weights of the elements 2021》
 *   https://www.qmul.ac.uk/sbcs/iupac/AtWt/ （表；本文件只用它做质量换算，
 *   质量换算不影响任何「检验结论」的正确性）
 * ========================================================================== */
(function () {
  'use strict';

  var API = window.QG_CLAB;
  if (!API || typeof API.register !== 'function') return;

  /* ==================================================================== *
   * 0 · 通用小工具                                                       *
   * ==================================================================== */
  /* ⚠ qgNum 必须把 null/undefined/'' 当成"没给"而不是 0：
     Number(null) === 0、Number('') === 0，旧写法会让一个"缺值"静默变成真实的 0
     （例如某条件没传时温度变成 0 ℃、浓度变成 0 mol/L），而 0 在化学里是有意义的取值，
     于是错误会被当成真数据一路算下去。真实的 0 与数字字符串 '0' 照常返回 0。 */
  function qgNum(v, dflt) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return dflt;
    var x = Number(v);
    return isFinite(x) ? x : dflt;
  }
  function qgInt(v, dflt) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return dflt;
    var x = Math.round(Number(v));
    return isFinite(x) ? x : dflt;
  }
  /* ------------------------------------------------------------------ *
   * 数字守卫：**不能只用 !isFinite(x)**                                  *
   *   isFinite(null) === true（null 被强制转成 0）、isFinite('') === true、*
   *   isFinite('12') === true —— 于是一个"表示无有效值的 null"会穿过      *
   *   `if (!isFinite(x))` 这道守卫，一路走到 x.toExponential() 抛           *
   *   TypeError（在组 1 的 ions.js 里已经真实炸过：现象表不出行、画布红字   *
   *   "绘图出错"、react() 把异常抛给调用方）。                            *
   *   本文件虽然目前没有哪条路径真的把 null 喂进这些格式化函数（我们的量都是 *
   *   当场算出来的数），但**形状一样**，所以守卫统一写成"显式挡 null/undefined/
   *   非 number + isFinite"，不再依赖 isFinite 的隐式转换。                *
   * ------------------------------------------------------------------ */
  function qgBadNum(x) {
    return x === null || x === undefined ||
           typeof x !== 'number' || !isFinite(x);
  }
  function qgClamp(x, lo, hi) {
    if (!(x > lo)) x = lo;          /* 同时挡住 NaN */
    if (x > hi) x = hi;
    return x;
  }
  function qgRound(x, n) {
    if (qgBadNum(x)) return 0;      /* 防御：调用方若给了 null，别让 NaN 漏出去 */
    var p = Math.pow(10, n);
    return Math.round(x * p) / p;
  }
  /* 按**有效数字**取整（不是小数位）。化学里浓度/质量跨好几个数量级，
     用 toFixed 会把 1.2e-4 直接抹成 0（物理组踩过同样的坑）。
     无有效值时返回字符串 '—'（与核心 fmtNum 的口径一致），不再返回数字 0 ——
     否则调用方会把它当成"真实的 0"拼进文字里。 */
  function qgSig(x, n) {
    if (qgBadNum(x) || x === 0) return '—';
    var e = Math.floor(Math.log(Math.abs(x)) / Math.LN10);
    var p = Math.pow(10, n - 1 - e);
    return String(Math.round(x * p) / p);
  }
  var QG_SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
                 '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺' };
  /* 把 1.2e-4 写成 1.2×10⁻⁴（画布上不放 "e-4" 这种半成品） */
  function qgSci(x, n) {
    if (qgBadNum(x)) return '—';
    if (x === 0) return '0';
    var parts = x.toExponential(Math.max(0, n - 1)).split('e');
    var ex = String(Number(parts[1])), sup = '', i;
    for (i = 0; i < ex.length; i++) sup += (QG_SUP[ex.charAt(i)] || ex.charAt(i));
    return parts[0] + '×10' + sup;
  }
  function qgPct(x, n) {
    if (qgBadNum(x)) return '—';
    return qgRound(x, n === undefined ? 1 : n) + '%';
  }
  /* 线性最小二乘（**中心化**，量级大时不丢有效位）。a = 斜率，b = 截距。
     注意核心 pslab.js/clab.js 的 fitLinear 返回的是 {a: 截距, b: 斜率}，
     与这里正好相反 —— 读核心 ctx.fit 时一律用 ctx.fit.b 当斜率。 */
  function qgFit(pts) {
    var n = pts.length, i, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    if (n < 3) return null;
    for (i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; }
    var mx = sx / n, my = sy / n;
    for (i = 0; i < n; i++) {
      var dx = pts[i].x - mx, dy = pts[i].y - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    if (!(sxx > 0) || !(syy > 0)) return null;
    return { a: sxy / sxx, b: my - (sxy / sxx) * mx,
             r2: qgClamp((sxy * sxy) / (sxx * syy), 0, 1), n: n };
  }

  /* ==================================================================== *
   * 1 · 画布工具（与 js/pslab/mod.js 同一套观感：米白纸 + 墨色 + Georgia 斜体）*
   * ==================================================================== */
  var PAPER = '#F4F1EA';
  var INK = '#26221C';

  /* g.font 宽容签名 → 本文件内部统一用 F(size, bold, italic)。 */
  function qgFontFn(g) {
    var custom = (g && typeof g.font === 'function') ? g.font : null;
    return function (size, bold, italic) {
      if (custom) {
        try {
          var v = custom(size, !!bold, !!italic);
          if (typeof v === 'string' && v) return v;
        } catch (e) { /* 忽略：退回自己拼的字体串 */ }
      }
      return (italic ? 'italic ' : '') + (bold ? 'bold ' : '') + size +
             'px Georgia,"Times New Roman",serif';
    };
  }
  function qgDraw(g) {
    var c = g.c;
    function path(pts, close) {
      if (!pts || !pts.length) return;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      if (close) c.closePath();
    }
    return {
      line: function (x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); },
      rect: function (x, y, w, h, fill, stroke, lw) {
        path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.lineWidth = lw || 1; c.strokeStyle = stroke; c.stroke(); }
      },
      poly: function (pts, fill, stroke, lw, close) {
        if (!pts || !pts.length) return;
        path(pts, close);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.lineWidth = lw || 1; c.strokeStyle = stroke; c.stroke(); }
      },
      circle: function (x, y, r, fill, stroke, lw) {
        c.beginPath(); c.arc(x, y, r < 0 ? 0 : r, 0, Math.PI * 2);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.lineWidth = lw || 1; c.strokeStyle = stroke; c.stroke(); }
      },
      txt: function (s, x, y, font, color, align) {
        c.font = font || 'italic 11px Georgia,"Times New Roman",serif';
        c.fillStyle = color || INK;
        c.textAlign = align || 'left';
        c.textBaseline = 'middle';
        c.fillText(String(s), x, y);
      },
      dash: function (on, pattern) {
        if (c.setLineDash) c.setLineDash(on ? (pattern || [4, 4]) : []);
      }
    };
  }
  /* 一块带标题的面板（全文件的画面都是"若干面板"拼出来的）。
     返回 { x, y, w, h, cx, cy }：cx/cy 是标题下第一行内容的坐标，
     调用处直接用它排"实验记录"，不必各自重算一遍。 */
  function qgPanel(g, d, F, x, y, w, h, title, tag) {
    d.rect(x, y, w, h, 'rgba(255,255,255,0.62)', 'rgba(38,34,28,0.20)', 1);
    if (title) d.txt(title, x + 12, y + 16, F(12, true, false), INK, 'left');
    if (tag) d.txt(tag, x + w - 12, y + 16, F(10, false, true), '#6B645C', 'right');
    return { x: x, y: y, w: w, h: h, cx: x + 14, cy: y + 36 };
  }
  /* ---------------------------------------------------------------- *
   * 「实验记录」面板：把已经做过的观察逐行画在画面里。               *
   * 为什么每个反应都要画它（不是装饰）：                             *
   *   ① 对**纯定性**反应（焰色/铁离子/气体/SO₂），画面的其余部分只由  *
   *      参数决定 —— 学生连按"观察一次"时画面纹丝不动，看起来像"点了 *
   *      没反应"；把记录画出来才看得见"我又观察了一次、看到了什么"。 *
   *   ② 契约 §4.6 要求"画布像素签名会变"：不读 state.rows 的 draw()  *
   *      在这条上必然不合格（自测抓到的就是这个）。                  *
   * ---------------------------------------------------------------- */
  function qgRowText(rows, pairs, max) {
    max = max || 4;
    var n = rows ? rows.length : 0, out = [], i, j, seg;
    var from = n > max ? n - max : 0;
    if (!n) return { lines: ['（还没做过观察：点"🔬 观察一次"开始记录）'], n: 0, from: 0 };
    for (i = from; i < n; i++) {
      seg = [];
      for (j = 0; j < pairs.length; j++) {
        var v = rows[i] ? rows[i][pairs[j][0]] : undefined;
        if (v === undefined || v === null || v === '') continue;
        seg.push(pairs[j][1] + '=' + (typeof v === 'number' ? qgRound(v, 3) : v));
      }
      out.push('#' + (i + 1) + '  ' + seg.join('　'));
    }
    return { lines: out, n: n, from: from };
  }
  /* 把「实验记录」画在 (x, y) 起、宽 w 的区域里；返回占用的高度 */
  function qgRecord(d, F, rec, x, y, w) {
    d.txt('实验记录（共 ' + rec.n + ' 次观察' + (rec.n > rec.lines.length ? '，显示最近 ' + rec.lines.length + ' 次' : '') + '）',
          x, y, F(10.5, true, false), '#6B645C', 'left');
    var i;
    for (i = 0; i < rec.lines.length; i++) {
      d.txt(rec.lines[i], x, y + 16 + i * 14, F(10, false, false), '#3A3630', 'left');
    }
    return 16 + rec.lines.length * 14;
  }
  function qgHead(g, d, F, title, tag) {
    d.txt(title, 26, 24, F(15, true, false), INK, 'left');
    if (tag) d.txt(tag, g.w - 26, 24, F(12, false, true), '#7A4A2B', 'right');
  }
  /* 试管：从 (x,y) 顶部往下长 h，半径 r。液面高度 frac ∈ [0,1]。 */
  function qgTube(d, F, x, y, w, h, frac, fill, label, labelColor) {
    var r = w / 2;
    d.poly([[x - r, y], [x - r, y + h - r], [x + r, y + h - r], [x + r, y]],
           'rgba(255,255,255,0.72)', INK, 1.4, false);
    d.circle(x, y + h - r, r, 'rgba(255,255,255,0.72)', INK, 1.4);
    if (frac > 0) {
      var lv = y + h - (h - 2) * qgClamp(frac, 0.02, 1);
      d.rect(x - r + 1, lv, w - 2, (y + h) - lv - 1, fill || 'rgba(160,200,230,0.55)', null, 0);
      d.line(x - r + 1, lv, x + r - 1, lv);
    }
    if (label) d.txt(label, x, y + h + 13, F(9.5, false, false), labelColor || '#6B645C', 'center');
  }
  /* 火焰：椭圆火焰（焰色反应用），col 为焰色 */
  function qgFlame(d, x, y, h, col, alpha) {
    var w = h * 0.52;
    d.poly([[x, y - h], [x + w * 0.55, y - h * 0.42], [x + w * 0.5, y], [x - w * 0.5, y], [x - w * 0.55, y - h * 0.42]],
           col, null, 0, true);
    d.poly([[x, y - h * 0.72], [x + w * 0.32, y - h * 0.3], [x + w * 0.3, y], [x - w * 0.3, y], [x - w * 0.32, y - h * 0.3]],
           alpha || 'rgba(255,255,255,0.55)', null, 0, true);
  }

  /* ==================================================================== *
   * 2 · 1 · 焰色反应（flame-test）                                        *
   * ==================================================================== */
  /* 颜色表逐字取 [S1]：「Li 紫红 Na 黄 K 紫（透过蓝色钴玻璃片）Ca 砖红 Sr 洋红
     Ba 黄绿 Cu 绿」；source 里的「紫（透过蓝色钴玻璃片）」即 K 的关键操作。 */
  var FT_METALS = {
    na: { name: '钠 Na', color: '黄色', hex: '#F2C31B', ideal: 86, salt: 'NaCl 溶液',
          note: '黄色火焰明亮而持久，是本组最灵敏的焰色' },
    k:  { name: '钾 K',  color: '紫色（透过蓝色钴玻璃观察）', hex: '#9B7BD4', ideal: 74, salt: 'KCl 溶液',
          note: '钾的紫色常被微量钠的黄光掩盖，必须透过蓝色钴玻璃滤去黄光才能看清' },
    ca: { name: '钙 Ca', color: '砖红色', hex: '#C0492B', ideal: 62, salt: 'CaCl₂ 溶液',
          note: '砖红色偏暗，火焰不宜过大' },
    cu: { name: '铜 Cu', color: '绿色', hex: '#3FA45B', ideal: 66, salt: 'CuCl₂ 溶液',
          note: '铜盐的绿色很明显；铜丝本身灼烧也显绿色，故焰色试验不能用铜丝代替铂丝' },
    li: { name: '锂 Li', color: '紫红色', hex: '#C2185B', ideal: 70, salt: 'LiCl 溶液',
          note: '紫红色（洋红偏紫），与钾的紫色可区分' },
    sr: { name: '锶 Sr', color: '洋红色', hex: '#D81B60', ideal: 68, salt: 'SrCl₂ 溶液',
          note: '洋红色，用于红色烟火' },
    ba: { name: '钡 Ba', color: '黄绿色', hex: '#A8C020', ideal: 58, salt: 'BaCl₂ 溶液',
          note: '黄绿色，比钠的黄更深、更偏绿' }
  };
  function ftRow(metal) {
    return FT_METALS[metal] || FT_METALS.na;
  }
  /* 模型：亮度 = 铂丝上带出的试样量 × 火焰供氧
     试样量 ∝ c（浓度）× 是否用盐酸洗涤（不洗则残渣挡住试样、亮度打折）
     供氧 ∝ 火焰高度（灯芯伸出长度）—— 火焰太高时供氧不足，焰色发暗发黄
     ⚠ 作图用的 y 必须是 **bright0**（不含"是否洗涤"这个因子）：
        洗涤与否是 1 或 0.62 的**阶跃因子**，把两类点混在一条线上，
        最小二乘的 r² 会被这个阶跃拉垮（自测实测 r² 会从 0.998 掉到 0.889）。
        所以列里给 bright0（同一根洗净铂丝下的本征亮度），洗涤的影响另立一列。 */
  function ftPhysics(p) {
    var m = ftRow(p.metal);
    var c = qgClamp(qgNum(p.conc, 0.5), 0.1, 2.0);       /* mol/L */
    var wick = qgClamp(qgNum(p.wick, 8), 2, 12);          /* mm */
    var washed = (p.wash === 'hcl');
    var supply = 0.52 + 0.48 * Math.sin(Math.PI * qgClamp(wick / 12, 0.08, 0.98));
    var bright0 = qgClamp(m.ideal * (0.34 + 0.52 * Math.min(1, c / 1.2)) * supply, 3, 99);
    var bright = qgClamp(bright0 * (washed ? 1 : 0.62), 3, 99);
    /* 残钠量（mol/L）：未用盐酸洗 → 铂丝上留有上一次试样的钠盐（主要是 NaCl），
       第一次使用时铂丝是干净的，故从 0.35×c 起算；洗过则只剩痕量。 */
    var naRes = washed ? 0.0004 : 0.35 * c;
    /* 溶液太浓 → 试样在铂丝上结盐块，灼烧时"爆跳"，焰色断续（真实实验现象） */
    var spatter = c > 1.2;
    var dur = qgClamp(3.4 + c * 4.4 + wick * 0.42 - (spatter ? 1.6 : 0), 2, 20);
    var naInterf = naRes * 1000;                                  /* 供显示的干扰指数 */
    /* 判据：能不能看见特征色。钠的黄色极其灵敏，所以阈值取得很低：
       干扰指数 > 10（≈ 铂丝上残留 0.01 mol/L 的钠盐）就足以盖住钾的紫色 ——
       未洗铂丝时（0.35c）任何 c ≥ 0.03 mol/L 的试样都会超标，这正是课本
       "检验钾必须用蓝色钴玻璃"的原因。洗净后干扰指数只有 0.4，紫色才看得见。 */
    var masked = naInterf > 10;
    var seen, observed;
    if (m.name.indexOf('钾') === 0 && p.glass !== 'cobalt') {
      seen = bright * (masked ? 0.28 : 0.72);                     /* 黄光盖住紫色 */
      observed = masked ? '黄色（钾的紫色被钠的黄光掩盖，看不出紫色）'
                        : '黄中略带紫，紫色不能确认';
    } else {
      seen = bright;
      observed = m.color;
    }
    seen = qgClamp(seen, 2, 99);
    /* ⚠ 判"看到的颜色是不是黄"必须用**字符位置**判，不要用正则：
       自测里 `^黄` / `黄` 这两条正则对同一个字符串 '黄色（钾的紫色被钠的黄光掩盖，看不出紫色）'
       出现过"该匹配却不匹配"的假红（`indexOf('黄') === 0` 则是稳定可靠的）。
       这类"正则假阴性"会把**正确的**化学结论误判成 bug，宁可写啰嗦一点都不用正则。 */
    var yellowFirst = (observed.indexOf('黄') === 0);
    return { m: m, c: c, wick: wick, washed: washed, bright: bright, bright0: bright0,
             naRes: naRes, naInterf: naInterf, masked: masked, spatter: spatter, dur: dur,
             seen: seen, observed: observed, yellowFirst: yellowFirst };
  }
  function flameTestReact(p) {
    var r = ftPhysics(p);
    var ph = [];
    ph.push('铂丝蘸取' + r.m.salt + '在酒精灯外焰上灼烧，火焰呈' + r.m.color);
    if (r.m.name.indexOf('钾') === 0) {
      ph.push(p.glass === 'cobalt'
        ? '透过蓝色钴玻璃观察：紫色清晰可辨（钴玻璃滤去了钠的黄光）'
        : '不透过蓝色钴玻璃时，火焰几乎全是黄色，钾的紫色被掩盖');
    }
    ph.push('焰色持续时间约 ' + qgRound(r.dur, 1) + ' s，' +
            (r.bright0 > 58 ? '颜色鲜明' : (r.bright0 > 32 ? '颜色偏淡' : '火焰颜色很淡，几乎看不出特征色')));
    if (r.spatter) ph.push('试样浓度过大，铂丝上的盐粒在火焰中爆跳，焰色断续不匀');
    if (!r.washed) ph.push('铂丝未用稀盐酸洗净，残留的钠盐使火焰发黄，干扰了本来的焰色');
    ph.push('灼烧前后试样的组成没有改变，只是金属元素使火焰呈现特征颜色（物理变化）');
    return {
      phenomena: ph,
      equation: '无化学方程式（焰色试验是物理变化：电子跃迁发光，没有新物质生成）',
      ionic: '',
      type: '元素的性质（焰色试验 / 焰色反应）',
      conditions: '酒精灯外焰灼烧；' + (p.glass === 'cobalt' ? '透过蓝色钴玻璃观察' : '直接观察') +
                  '；铂丝先用稀盐酸洗涤并灼烧至与灯焰颜色一致',
      measures: {
        conc: qgRound(r.c, 2),
        color: r.observed,
        bright: qgRound(r.bright0, 1),
        wash: r.washed ? 1 : 0,
        dur: qgRound(r.dur, 1),
        naInterf: qgRound(r.naInterf, 4)
      },
      note: r.m.note
    };
  }
  function flameTestConclude(rows, p) {
    var r = ftPhysics(p);
    var errors = [];
    errors.push('铂丝未用稀盐酸洗涤/未灼烧至灯焰无色：上一次试样的钠盐残留在铂丝上，' +
                '黄色会掩盖钾的紫色（钠的焰色极其灵敏，痕量即可显黄）。');
    errors.push('检验钾时不透过蓝色钴玻璃：钠的黄光强度远大于钾的紫光，' +
                '直接观察只能看到黄色，会把含钾试样误判为不含钾。');
    errors.push('用铜丝代替铂丝蘸取试样：铜丝本身灼烧就显绿色，' +
                '既会引入铜的焰色，也无法判断绿色是来自试样还是来自铜丝（铁丝无焰色，可以代用）。');
    errors.push('试样浓度过大：铂丝上结成盐块，灼烧时盐粒爆跳、焰色断续，颜色反而看不准。');
    errors.push('把焰色试验当成化学变化、或据此区分 NaCl 与 Na₂CO₃：' +
                '焰色只反映金属元素，同一金属的不同化合物焰色相同，无法据此鉴别。');
    var kNote = '';
    if (r.m.name.indexOf('钾') === 0) {
      kNote = p.glass === 'cobalt'
        ? '结论：透过蓝色钴玻璃见到紫色，可判定试样含钾元素。'
        : '结论：未透过蓝色钴玻璃时看到的是黄色，不能判定含钾 —— 必须重做。';
    } else {
      kNote = '结论：焰色呈' + r.m.color + '，可判定试样含' + r.m.name + '元素。';
    }
    return {
      text: '焰色试验是**元素的物理性质**：试样在火焰中灼烧时，原子吸收能量后电子跃迁，' +
            '回到低能级时发出特定波长的光，于是火焰呈现该元素的特征颜色。' +
            '本组颜色表（人教版）：Li 紫红、Na 黄、K 紫（透过蓝色钴玻璃）、Ca 砖红、' +
            'Sr 洋红、Ba 黄绿、Cu 绿。' + kNote +
            ' 操作五步要记牢：洗（稀盐酸）、烧（灼烧至与灯焰同色）、蘸（试样）、烧、观。',
      equation: '无化学方程式（焰色试验是物理变化：电子跃迁发光，没有新物质生成）',
      ionic: '',
      errors: errors
    };
  }
  function flameTestDraw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var r = ftPhysics(p), W = g.w, H = g.h, M = 26;
    qgHead(g, d, F, '焰色反应 · 观察金属元素的特征焰色',
           (p.glass === 'cobalt' ? '透过蓝色钴玻璃观察' : '直接观察'));
    var topW = W - M * 2;
    var topH = Math.min(150, H * 0.34);
    qgPanel(g, d, F, M, 40, topW, topH, '① 实验装置', '铂丝 · 酒精灯 · 稀盐酸');
    /* 酒精灯 */
    var lx = M + 96, ly = 40 + topH - 20;
    d.rect(lx - 22, ly - 34, 44, 34, 'rgba(220,214,198,0.85)', INK, 1.4);
    d.rect(lx - 8, ly - 44, 16, 10, 'rgba(200,194,178,0.9)', INK, 1.2);
    d.line(lx - 14, ly - 34, lx + 14, ly - 34);
    /* 火焰 */
    var fh = 34 + (r.wick / 12) * 40;
    qgFlame(d, lx, ly - 46, fh, '#F0A93B', 'rgba(255,246,214,0.75)');
    d.txt('酒精灯', lx, ly + 16, F(9.5, false, false), '#6B645C', 'center');
    /* 铂丝 + 试样 */
    var px = lx, py = ly - 46 - fh * 0.42;
    d.line(px - 74, py - 34, px, py);
    d.circle(px, py, 3.2, '#B9B2A6', INK, 1);
    var seenCol = r.observed.indexOf('黄') === 0 ? '#F2C31B' : r.m.hex;
    d.circle(px, py, 6, seenCol, null, 0);
    d.txt('铂丝蘸取试样', px - 78, py - 34, F(9.5, false, false), '#6B645C', 'right');
    /* 钴玻璃 */
    if (p.glass === 'cobalt') {
      d.rect(px + 52, py - 30, 34, 46, 'rgba(43,58,150,0.72)', '#1E2A66', 1.4);
      d.txt('蓝色钴玻璃', px + 69, py + 26, F(9.5, false, true), '#2B3A96', 'center');
    }
    /* 盐酸小烧杯 */
    var bx = M + topW - 92;
    d.poly([[bx - 26, ly - 30], [bx + 26, ly - 30], [bx + 22, ly], [bx - 22, ly]], 'rgba(255,255,255,0.7)', INK, 1.4, true);
    d.rect(bx - 24, ly - 20, 48, 20, 'rgba(170,205,230,0.62)', null, 0);
    d.txt(r.washed ? '稀盐酸（已洗涤）' : '稀盐酸（未洗涤）', bx, ly + 16, F(9.5, false, false),
          r.washed ? '#2E7D32' : '#B3261E', 'center');

    /* ② 观察结果
       面板垂直切三带：上=读数行（左列名/右值）｜右上=实测焰色色块｜底部=实验记录。
       色块必须只占右侧一列、记录另起一带，否则文字会互相压字（第一版就压了）。 */
    var y2 = 40 + topH + 12;
    var h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② 观察到的焰色与读数',
             '试样 ' + r.m.salt + '　c = ' + qgRound(r.c, 2) + ' mol/L');
    var seenYellow = (r.observed.indexOf('黄') === 0);
    var seenHex = (seenYellow && r.m.name.indexOf('钾') === 0) ? '#F2C31B' : r.m.hex;
    /* 右上：色块 */
    var sw = 86, sh = 34, sx = M + topW - sw - 16, sy = y2 + 28;
    d.rect(sx, sy, sw, sh, seenHex, INK, 1.2);
    d.txt('实测焰色', sx + sw / 2, sy + sh + 11, F(9.5, false, false), '#6B645C', 'center');
    /* 底部：实验记录（先算它占多高，读数行就知道该在哪里收尾） */
    var rec = qgRowText((state && state.rows) || [], [['color', '看到'], ['bright', '亮度'], ['dur', '持续']], 4);
    var recH = 16 + rec.lines.length * 14;
    var ry = y2 + 30, i;
    var dataArr = [
      ['元素', r.m.name],
      ['特征焰色', r.m.color],
      ['火焰本征亮度', qgRound(r.bright0, 1) + ' %（洗净铂丝时）'],
      ['焰色持续时间', qgRound(r.dur, 1) + ' s'],
      ['残留钠干扰指数', qgRound(r.naInterf, 4) + (r.masked ? '（严重：紫色被掩盖）' : '（可忽略）')],
      ['实际看到', r.observed]
    ];
    for (i = 0; i < dataArr.length; i++) {
      if (ry > y2 + h2 - recH - 14) break;      /* 别压到底部的记录带 */
      d.txt(dataArr[i][0], M + 14, ry, F(10.5, false, true), '#6B645C', 'left');
      d.txt(dataArr[i][1], M + 132, ry, F(11, true, false),
            i === 5 ? (seenYellow && r.m.name.indexOf('钾') === 0 ? '#B3261E' : r.m.hex) : INK, 'left');
      ry += 19;
    }
    qgRecord(d, F, rec, M + 14, y2 + h2 - recH - 4, topW - 28);
  }

  /* ==================================================================== *
   * 3 · 2 · Fe²⁺/Fe³⁺ 的检验（iron-ion-test）                             *
   * ==================================================================== */
  /* 试剂与现象（[S2] + 人教版必修一「铁及其化合物」）：
       Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃      血红色（络合显色，不是沉淀）
       Fe³⁺ + 3OH⁻  = Fe(OH)₃↓      红褐色沉淀
       Fe²⁺ + 2OH⁻  = Fe(OH)₂↓      白色沉淀 → 灰绿 → 红褐（被空气氧化）
       3Fe²⁺ + 2[Fe(CN)₆]³⁻ = Fe₃[Fe(CN)₆]₂↓   蓝色沉淀（检验 Fe²⁺ 最灵敏）
       2Fe²⁺ + Cl₂ = 2Fe³⁺ + 2Cl⁻   加氯水/KSCN 由不变红到变红（证明原溶液含 Fe²⁺） */
  var IIT_TESTS = {
    kscn:  { name: 'KSCN 溶液（硫氰化钾）', target: 'Fe³⁺',
             phen: ['滴入 KSCN 溶液后，溶液立即变成血红色（Fe(SCN)₃ 络合物）'],
             fe3: '溶液变成血红色 —— 证明原溶液含有 Fe³⁺',
             fe2: '溶液不变红（Fe²⁺ 与 SCN⁻ 不显红色）—— 不能据此证明 Fe²⁺，须再加氧化剂' },
    naoh:  { name: 'NaOH 溶液（氢氧化物法）', target: 'Fe²⁺/Fe³⁺',
             phen: ['滴入 NaOH 溶液，立即出现沉淀并观察颜色变化'],
             fe3: '产生红褐色沉淀 Fe(OH)₃ —— 证明原溶液含有 Fe³⁺',
             fe2: '先生成白色沉淀 Fe(OH)₂，迅速变为灰绿色，最后变成红褐色 Fe(OH)₃ —— 证明原溶液含有 Fe²⁺' },
    ferri: { name: 'K₃[Fe(CN)₆] 溶液（铁氰化钾法）', target: 'Fe²⁺',
             phen: ['滴入铁氰化钾溶液，立即出现蓝色沉淀'],
             fe3: '不产生蓝色沉淀（该试剂只对 Fe²⁺ 灵敏），不能用它检验 Fe³⁺',
             fe2: '产生蓝色沉淀 Fe₃[Fe(CN)₆]₂ —— 检验 Fe²⁺ 最灵敏的方法' },
    chlorine: { name: '先加 KSCN、再加氯水（顺序法）', target: 'Fe²⁺',
             phen: ['先滴加 KSCN 溶液，溶液不变红，说明原溶液不含 Fe³⁺',
                    '再滴加少量氯水，溶液变成血红色'],
             fe3: '本来就变红，无法判断 Fe³⁺ 是原有的还是氯水氧化出来的（顺序反了）',
             fe2: '先不变红、加氯水后变红 —— 证明原溶液含有 Fe²⁺' }
  };
  /* 比色管里的浓度换算（用于"比色法测 Fe³⁺"这条定量的线）：
       取 V_s mL 待测液 → 定容到 50.00 mL → 加 KSCN 显色。
       所以 c(管) = c(原) × V_s / 50.00（稀释倍数 50/V_s），
       而显色深浅正比于管内的 Fe³⁺ 浓度 —— 这就是"有定量列就必须能作图"的那条直线：
       扫 V_s 时 颜色读数 ∝ V_s，过原点、r² 应当接近 1。 */
  var IIT_VFLASK = 50.00;      /* 比色管/容量瓶定容体积 mL */
  function iitPhysics(p) {
    var sampleKey = (p.sample === 'fe2') ? 'fe2' : 'fe3';
    var t = IIT_TESTS[p.test] || IIT_TESTS.kscn;
    var ox = qgClamp(qgNum(p.oxidation, 0), 0, 1);          /* Fe²⁺ 被氧化的程度 */
    var vk = qgClamp(qgNum(p.kscn, 2), 1, 5);               /* KSCN 滴数（滴） */
    var vs = qgClamp(qgNum(p.fvol, 1.0), 0.2, 5.0);         /* 取样体积 mL */
    /* 试样：Fe²⁺ 用新制 FeSO₄ 溶液，Fe³⁺ 用 FeCl₃ 溶液 */
    var c0;
    if (sampleKey === 'fe2') c0 = { fe2: 0.1000 * (1 - ox), fe3: 0.1000 * ox, name: '新制 FeSO₄ 溶液（含 Fe²⁺）', c0fe3: 0.1000 * ox };
    else c0 = { fe2: 0, fe3: 0.0200, name: 'FeCl₃ 溶液（含 Fe³⁺）', c0fe3: 0.0200 };
    /* 比色管内的 Fe³⁺ 浓度（mol/L） */
    var cFlask = c0.c0fe3 * vs / IIT_VFLASK;
    /* 显色/沉淀强度：Fe³⁺ 与 KSCN 的络合在 1~5 滴内基本完全，再滴只加深度。
       基准换算：1 滴 KSCN 时"颜色读数 = 管内 c(Fe³⁺)/0.0004 × 100"，
       于是 0.02 mol/L 取 5 mL 定容后（0.002 mol/L）读数正好 100（满标）。 */
    var color = qgClamp(cFlask / 0.0004 * 100 * (0.86 + 0.035 * vk), 0, 100);
    var blue = qgClamp(c0.fe2 * 780, 0, 100);
    var brown = qgClamp(c0.fe3 * 560 + c0.fe2 * 260 * ox, 0, 100);
    /* 结论判定 */
    var verdict, observed;
    if (t.target === 'Fe²⁺/Fe³⁺' || p.test === 'naoh') {
      if (c0.fe3 > 0.004) { verdict = 'fe3'; observed = t.fe3; }
      else if (c0.fe2 > 0.02) { verdict = 'fe2'; observed = t.fe2; }
      else { verdict = 'none'; observed = '沉淀颜色介于两者之间，无法判定（Fe²⁺ 已被空气大量氧化）'; }
    } else if (p.test === 'ferri') {
      if (c0.fe2 > 0.02) { verdict = 'fe2'; observed = t.fe2; }
      else { verdict = 'none'; observed = p.sample === 'fe2'
        ? '未见蓝色沉淀：Fe²⁺ 已被氧化，此法失效' : '不产生蓝色沉淀 —— 说明原溶液不含 Fe²⁺'; }
    } else if (p.test === 'chlorine') {
      if (c0.fe3 > 0.004) { verdict = 'fe3'; observed = t.fe3; }
      else if (c0.fe2 > 0.02) { verdict = 'fe2'; observed = t.fe2; }
      else { verdict = 'none'; observed = '加氯水后仍不变红，两种离子都不足以判定'; }
    } else { /* kscn */
      if (c0.fe3 > 0.004) { verdict = 'fe3'; observed = t.fe3; }
      else { verdict = 'none'; observed = t.fe2; }
    }
    /* 褪色时间：KSCN 用量越接近化学计量、Fe³⁺ 越少，红色越浅、越容易褪 */
    var fade = qgClamp(2.2 + 3.4 * (color / 100) * (1.15 - 0.05 * (vk - 1)), 0.5, 12);
    return { t: t, ox: ox, vk: vk, vs: vs, c: c0, cFlask: cFlask, color: color,
             blue: blue, brown: brown, verdict: verdict, observed: observed, fade: fade };
  }
  function ironIonReact(p) {
    var r = iitPhysics(p);
    var ph = r.t.phen.slice(0);
    ph.push('最终现象：' + r.observed);
    if (r.c.fe3 > 0.004 && r.color > 55) ph.push('血红色很深，随放置时间延长约 ' + qgRound(r.fade, 1) + ' s 后略有变浅（络合平衡受温度与浓度影响）');
    if (r.ox > 0.15 && p.sample === 'fe2') ph.push('试管里的 FeSO₄ 溶液放置过程中由浅绿逐渐转黄：Fe²⁺ 已被空气中的 O₂ 氧化为 Fe³⁺，这会让"先不变红"的判断失真');
    if (r.t.target === 'Fe²⁺' && p.sample === 'fe3' && p.test === 'ferri') ph.push('对 Fe³⁺ 溶液加铁氰化钾不产生蓝色沉淀 —— 说明该试剂只对 Fe²⁺ 灵敏');
    var eq, ion, cond;
    if (p.test === 'naoh') {
      eq = 'FeCl3 + 3NaOH = Fe(OH)3↓ + 3NaCl';
      ion = 'Fe3+ + 3OH- = Fe(OH)3↓';
      cond = '常温，逐滴加入 NaOH 溶液并振荡';
    } else if (p.test === 'ferri') {
      eq = '3FeSO4 + 2K3[Fe(CN)6] = Fe3[Fe(CN)6]2↓ + 3K2SO4';
      ion = '3Fe2+ + 2[Fe(CN)6]3- = Fe3[Fe(CN)6]2↓';
      cond = '常温，向待测液中滴加铁氰化钾溶液';
    } else if (p.test === 'chlorine') {
      eq = '2FeCl2 + Cl2 = 2FeCl3（再与 KSCN 显血红色）';
      ion = '2Fe2+ + Cl2 = 2Fe3+ + 2Cl-';
      cond = '常温，先加 KSCN 溶液、后加少量氯水（顺序不可颠倒）';
    } else {
      eq = 'FeCl3 + 3KSCN ⇌ Fe(SCN)3 + 3KCl';
      ion = 'Fe3+ + 3SCN- ⇌ Fe(SCN)3（血红色）';
      cond = '常温，滴加 KSCN 溶液并振荡';
    }
    return {
      phenomena: ph,
      equation: eq,
      ionic: ion,
      type: '离子的检验（络合显色 / 沉淀法 / 氧化还原顺序法）',
      conditions: cond,
      measures: {
        fvol: qgRound(r.vs, 2),
        cFlask: qgSci(r.cFlask, 3),
        color: qgRound(r.color, 1),
        ox: qgRound(r.ox, 2),
        vk: qgRound(r.vk, 1),
        blue: qgRound(r.blue, 1),
        brown: qgRound(r.brown, 1)
      },
      note: 'Fe²⁺ 与 Fe³⁺ 都常用 NaOH 与 KSCN，但**判据不同**：Fe³⁺ 看"红褐色沉淀 / 血红色"，' +
            'Fe²⁺ 看"白色→灰绿→红褐"的渐变或"蓝色沉淀"。'
    };
  }
  function ironIonConclude(rows, p) {
    var r = iitPhysics(p);
    var errors = [];
    errors.push('检验 Fe²⁺ 时直接用 KSCN：Fe²⁺ 与 SCN⁻ 本来就不显红色，' +
                '无论含不含 Fe²⁺ 都不变红，得不到任何信息；必须配氧化剂（氯水）或用铁氰化钾。');
    errors.push('"先加氯水、再加 KSCN"顺序颠倒：氯水把 Fe²⁺ 氧化成 Fe³⁺ 后才加 KSCN，' +
                '溶液照样变红，无法区分原溶液里究竟是 Fe²⁺ 还是 Fe³⁺（红色是"原有的"还是"氧化来的"分不清）。');
    errors.push('FeSO₄ 溶液久置：Fe²⁺ 被空气中的 O₂ 缓慢氧化为 Fe³⁺，' +
                '试管里溶液先由浅绿变黄，此时"先加 KSCN 不变红"这一步就会失败，必须用**新制**的 FeSO₄ 溶液。');
    errors.push('KSCN 溶液本身不含铁、过量也不会显红：若把"滴数越多越红"当成判据，' +
                '会误认为试剂加得不够；红色的深浅只由 Fe³⁺ 浓度决定。');
    errors.push('观察沉淀颜色变化时没等够时间：Fe(OH)₂ 的"白色→灰绿→红褐"是逐步氧化过程，' +
                '试管内若已溶有氧气或振荡过猛，白色阶段会一闪而过，容易被误记成"直接得到红褐色沉淀"。');
    return {
      text: 'Fe³⁺ 的三条判据：① 加 KSCN 溶液变血红色 Fe(SCN)₃；② 加 NaOH 生成红褐色 Fe(OH)₃ 沉淀；' +
            '③ 待测液本身呈棕黄色。Fe²⁺ 的三条判据：① 加 K₃[Fe(CN)₆] 生成**蓝色沉淀**（最灵敏）；' +
            '② 加 NaOH 先生成**白色** Fe(OH)₂ 沉淀，迅速变灰绿、最后变红褐；' +
            '③ 先加 KSCN 不变红，再加氯水变红。本组被测试样当前判定为：' +
            (r.verdict === 'fe3' ? '含有 Fe³⁺' : (r.verdict === 'fe2' ? '含有 Fe²⁺' : '不能判定（试样已被氧化或所选试剂不适用）')) + '。',
      equation: 'FeCl3 + 3KSCN ⇌ Fe(SCN)3 + 3KCl',
      ionic: 'Fe3+ + 3SCN- ⇌ Fe(SCN)3（血红色）；Fe2+ 与 SCN- 不显红色',
      errors: errors
    };
  }
  function ironIonDraw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var r = iitPhysics(p), W = g.w, H = g.h, M = 26;
    qgHead(g, d, F, 'Fe²⁺ 与 Fe³⁺ 的检验', r.c.name);
    var topH = Math.min(178, H * 0.40);
    var topW = W - M * 2;
    qgPanel(g, d, F, M, 40, topW, topH, '① 三支试管：KSCN / NaOH / K₃[Fe(CN)₆]', '观察颜色与沉淀');
    var y0 = 40 + 44, th = topH - 62;
    var xs = [M + 76, M + 172, M + 268];
    var fills = [
      r.color > 40 ? 'rgba(178,32,32,' + qgRound(0.25 + r.color / 160, 2) + ')' : 'rgba(214,228,214,0.75)',
      r.c.fe3 > 0.004 ? 'rgba(150,72,32,0.85)' : (r.c.fe2 > 0.02 ? 'rgba(226,226,222,0.95)' : 'rgba(214,228,214,0.75)'),
      r.blue > 20 ? 'rgba(30,58,150,0.85)' : 'rgba(214,228,214,0.75)'
    ];
    var labels = ['KSCN', 'NaOH', 'K₃[Fe(CN)₆]'];
    var i;
    for (i = 0; i < 3; i++) {
      qgTube(d, F, xs[i], y0, 34, th, 0.52, fills[i], labels[i]);
      d.txt(i === 0 ? (r.color > 40 ? '血红色' : '不变红')
            : (i === 1 ? (r.c.fe3 > 0.004 ? '红褐色沉淀' : (r.c.fe2 > 0.02 ? '白→灰绿→红褐' : '无明显沉淀'))
                       : (r.blue > 20 ? '蓝色沉淀' : '无蓝色沉淀')),
            xs[i], y0 + th - 22, F(9.5, true, false),
            (i === 0 && r.color > 40) ? '#8E1B1B' : (i === 2 && r.blue > 20 ? '#1E2A96' : '#6B645C'), 'center');
    }
    /* 试样标签 */
    d.rect(M + 14, y0 + 6, 44, th - 12, 'rgba(220,232,214,0.8)', INK, 1.2);
    d.txt(p.sample === 'fe2' ? 'Fe²⁺' : 'Fe³⁺', M + 36, y0 + th / 2, F(12, true, false), INK, 'center');

    var y2 = 40 + topH + 12;
    var h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② 本组所选试剂的结果', r.t.name);
    var rows = [
      ['所用试剂', r.t.name],
      ['检验对象', r.t.target],
      ['Fe²⁺ 已被氧化的程度', qgPct(r.ox * 100, 0) + '（放置越久越大）'],
      ['KSCN 滴数', qgRound(r.vk, 1) + ' 滴'],
      ['血红色深度', qgRound(r.color, 1) + ' / 100'],
      ['蓝色沉淀强度', qgRound(r.blue, 1) + ' / 100'],
      ['结论', r.observed]
    ];
    var ry = y2 + 40, k;
    var rec = qgRowText((state && state.rows) || [],
                        [['color', '血红'], ['blue', '蓝沉'], ['brown', '红褐'], ['ox', '氧化']], 4);
    var recH = 16 + rec.lines.length * 14;
    for (k = 0; k < rows.length; k++) {
      if (ry > y2 + h2 - recH - 14) break;
      d.txt(rows[k][0], M + 14, ry, F(10.5, false, true), '#6B645C', 'left');
      d.txt(rows[k][1], M + 158, ry, F(11, k === 6, false),
            k === 6 ? (r.verdict === 'fe3' ? '#8E1B1B' : (r.verdict === 'fe2' ? '#1E2A96' : '#B3261E')) : INK, 'left');
      ry += 18;
    }
    qgRecord(d, F, rec, M + 14, y2 + h2 - recH - 4, topW - 28);
  }

  /* ==================================================================== *
   * 4 · 3 · SO₄²⁻ / Cl⁻ / CO₃²⁻ 的检验（anion-test）                      *
   * ==================================================================== */
  /* 试剂顺序与干扰排除（[S3]，逐字）：
     「检验溶液中是否含有 SO₄²⁻ 时先用过量盐酸将溶液酸化，其目的是排除
       CO₃²⁻、SO₃²⁻、Ag⁺ 等离子可能造成的干扰」
     「用硝酸酸化来排除 SO₃²⁻ 的干扰」不可行：
       3SO₃²⁻ + 2H⁺ + 2NO₃⁻ = 3SO₄²⁻ + 2NO↑ + H₂O （把 SO₃²⁻ 氧化成 SO₄²⁻ → 假阳性）
     Cl⁻：[S4] 的常规做法 —— 先用稀硝酸酸化（排除 CO₃²⁻、SO₃²⁻ 生成的白色银盐干扰），
          再加 AgNO₃ 得白色 AgCl 沉淀；不能用稀盐酸/稀硫酸酸化（引入 Cl⁻ / 生成 Ag₂SO₄ 干扰）。 */
  var AT_ANIONS = {
    so4: { name: 'SO₄²⁻（硫酸根）', reagent: 'BaCl₂ 溶液', precip: '白色沉淀 BaSO₄（不溶于稀盐酸）',
           pre: '稀盐酸', inter: 'CO₃²⁻、SO₃²⁻、Ag⁺', mw: 233.39, sig: 'so4' },
    cl:  { name: 'Cl⁻（氯离子）', reagent: 'AgNO₃ 溶液', precip: '白色沉淀 AgCl（不溶于稀硝酸）',
           pre: '稀硝酸', inter: 'CO₃²⁻、SO₃²⁻、PO₄³⁻', mw: 143.32, sig: 'cl' },
    co3: { name: 'CO₃²⁻（碳酸根）', reagent: '稀盐酸 + 澄清石灰水', precip: '石灰水变浑浊（CaCO₃）',
           pre: '（本法不需预先酸化）', inter: 'HCO₃⁻、SO₃²⁻（也有气体）', mw: 100.09, sig: 'co3' }
  };
  var AT_ACIDS = {
    hcl:  { name: '稀盐酸', ok: true,  note: '盐酸盐易挥发，既除去了 CO₃²⁻/SO₃²⁻ 的干扰，又不引入 SO₄²⁻' },
    hno3: { name: '稀硝酸', ok: false, note: '稀硝酸会把 SO₃²⁻ 氧化成 SO₄²⁻（3SO₃²⁻+2H⁺+2NO₃⁻=3SO₄²⁻+2NO↑+H₂O），造成假阳性' },
    none: { name: '不加酸（直接加BaCl₂/AgNO₃）', ok: false, note: 'CO₃²⁻、SO₃²⁻ 与 Ba²⁺/Ag⁺ 也生成白色沉淀，无法与 SO₄²⁻/Cl⁻ 区分' }
  };
  function atPhysics(p) {
    var a = AT_ANIONS[p.anion] || AT_ANIONS.so4;
    var c = qgClamp(qgNum(p.conc, 0.100), 0.010, 0.500);      /* mol/L */
    var v = qgClamp(qgNum(p.vol, 2.0), 1.0, 10.0);            /* mL */
    var acid = AT_ACIDS[p.acid] || AT_ACIDS.hcl;
    var n = c * v / 1000;                                     /* mol */
    var mm = n * 1000;                                        /* mmol */
    var mass = n * a.mw * 1000;                               /* mg 沉淀 */
    /* 干扰信号：不加酸 → CO₃²⁻/SO₃²⁻ 各按 12% 的"假沉淀"计入；
       加硝酸（检验 SO₄²⁻ 时）→ SO₃²⁻ 全部被氧化成 SO₄²⁻，假阳性 100% */
    var falsePct = 0, falseMass = 0;
    if (!acid.ok) {
      if (p.acid === 'hno3' && a.sig === 'so4') { falsePct = 100; }
      else { falsePct = 24; }
      falseMass = mass * falsePct / 100;
    }
    /* 加酸时的气泡现象（CO₃²⁻/SO₃²⁻ 被酸化） */
    var fizz = acid.ok || p.acid === 'hno3';
    /* 酸化后的 pH（过量稀盐酸，取 0.5 mL 1 mol/L 盐酸对 2 mL 试液） */
    var pHacid = -Math.log10(1.0 * 0.5 / (v + 1.5));
    var verdict;
    if (falsePct >= 100) verdict = '假阳性：SO₃²⁻ 被硝酸氧化成 SO₄²⁻，会产生白色沉淀但原溶液未必含 SO₄²⁻';
    else if (!acid.ok) verdict = '沉淀来源不明：可能是 CO₃²⁻/SO₃²⁻ 的钡盐（或银盐），不能判定为 ' + a.name;
    else if (a.sig === 'co3') verdict = '气体使澄清石灰水变浑浊 → 含有 CO₃²⁻（HCO₃⁻ 也有同样现象，需另行排除）';
    else verdict = '白色沉淀不溶于所加的酸 → 含有 ' + a.name;
    return { a: a, c: c, v: v, acid: acid, n: n, mm: mm, mass: mass,
             falsePct: falsePct, falseMass: falseMass, fizz: fizz, pHacid: pHacid, verdict: verdict };
  }
  function anionReact(p) {
    var r = atPhysics(p);
    var ph = [];
    if (r.a.sig === 'co3') {
      ph.push('向试样中滴加稀盐酸，立即产生大量无色无味气泡（CO₂）');
      ph.push('把气体通入澄清石灰水，石灰水变浑浊（CaCO₃）');
      ph.push('把湿润的蓝色石蕊试纸放在管口，试纸变红（酸性气体）');
    } else {
      ph.push('先向试样中滴加' + r.acid.name + '酸化' + (r.fizz ? '，若含 CO₃²⁻/SO₃²⁻ 会看到气泡（这一步就是在排除它们的干扰）' : ''));
      ph.push('再加 ' + r.a.reagent + '，产生' + r.a.precip);
      if (r.falsePct >= 100) ph.push('⚠ 酸化用的是稀硝酸：SO₃²⁻ 被氧化成 SO₄²⁻，沉淀可能来自 SO₃²⁻ 而不是原来的 SO₄²⁻');
      else if (!r.acid.ok) ph.push('⚠ 没有预先酸化：CO₃²⁻/SO₃²⁻ 与 ' + r.a.reagent.split(' ')[0] + ' 也生成白色沉淀，现象与 ' + r.a.name + ' 无法区分');
      ph.push('过滤后向沉淀上加稀盐酸（或稀硝酸），沉淀不溶解 —— 这一步是确认沉淀成分的关键');
    }
    var eq, ion;
    if (r.a.sig === 'co3') {
      eq = 'Na2CO3 + 2HCl = 2NaCl + H2O + CO2↑；CO2 + Ca(OH)2 = CaCO3↓ + H2O';
      ion = 'CO32- + 2H+ = H2O + CO2↑；CO2 + Ca2+ + 2OH- = CaCO3↓ + H2O';
    } else if (r.a.sig === 'cl') {
      eq = 'NaCl + AgNO3 = AgCl↓ + NaNO3';
      ion = 'Ag+ + Cl- = AgCl↓（白色，不溶于稀硝酸）';
    } else {
      eq = 'Na2SO4 + BaCl2 = BaSO4↓ + 2NaCl';
      ion = 'Ba2+ + SO42- = BaSO4↓（白色，不溶于稀盐酸）';
    }
    return {
      phenomena: ph,
      equation: eq,
      ionic: ion,
      type: '离子的检验（沉淀法 / 气体法，含试剂顺序与干扰排除）',
      conditions: r.a.sig === 'co3' ? '常温；先加盐酸、再把气体通入澄清石灰水'
                                    : '常温；先加' + r.acid.name + '酸化，再加 ' + r.a.reagent,
      measures: {
        vol: qgRound(r.v, 2),
        mmol: qgRound(r.mm, 4),
        mass: qgRound(r.mass, 3),
        falseMass: qgRound(r.falseMass, 3),
        pH: qgRound(r.pHacid, 2)
      },
      note: r.verdict
    };
  }
  function anionConclude(rows, p) {
    var r = atPhysics(p);
    var errors = [];
    errors.push('试剂顺序颠倒（先加 BaCl₂/AgNO₃、后加酸）：CO₃²⁻、SO₃²⁻ 同样生成白色沉淀，' +
                '先加沉淀剂就分不清沉淀是"本来就有"还是"酸化后才出现的"；' +
                '正确顺序是**先酸化、再加沉淀剂、最后加酸验证沉淀不溶**。');
    errors.push('用稀硝酸代替稀盐酸酸化（检验 SO₄²⁻ 时）：NO₃⁻ 在酸性条件下有氧化性，' +
                '3SO₃²⁻ + 2H⁺ + 2NO₃⁻ = 3SO₄²⁻ + 2NO↑ + H₂O，把 SO₃²⁻ 氧化成 SO₄²⁻，' +
                '于是不含 SO₄²⁻ 的试样也出现 BaSO₄ 白色沉淀（假阳性）。');
    errors.push('用稀盐酸（或稀硫酸）酸化来检验 Cl⁻：稀盐酸本身引入 Cl⁻，' +
                '稀硫酸会与 Ag⁺ 生成微溶的 Ag₂SO₄ 造成浑浊，都会把"有 Cl⁻"变成假结论。');
    errors.push('只用"白色沉淀"当判据：Ag₂CO₃、Ag₂SO₃、BaCO₃、BaSO₃、PbCl₂ 都是白色沉淀，' +
                '必须再向沉淀上加酸确认不溶解，才能收敛到 AgCl / BaSO₄。');
    errors.push('忽略其他阴离子的干扰：检验 CO₃²⁻ 时 HCO₃⁻ 也放出 CO₂ 并使石灰水变浑浊；' +
                '检验 SO₄²⁻ 时 SO₃²⁻ 是最近的一个坑（它既能生成白色钡盐、又能被氧化成 SO₄²⁻）。');
    return {
      text: '本组三条检验的规范流程：① SO₄²⁻ —— 取试样先滴加**足量稀盐酸**酸化' +
            '（排除 CO₃²⁻、SO₃²⁻、Ag⁺），再加 **BaCl₂ 溶液**，生成不溶于稀盐酸的**白色沉淀** BaSO₄；' +
            '② Cl⁻ —— 先加**稀硝酸**酸化，再加 **AgNO₃ 溶液**，生成不溶于稀硝酸的**白色沉淀** AgCl；' +
            '③ CO₃²⁻ —— 加稀盐酸放出**无色无味气体**，通入**澄清石灰水**变浑浊。' +
            '本次实验结果：' + r.verdict + '。',
      equation: r.a.sig === 'cl' ? 'NaCl + AgNO3 = AgCl↓ + NaNO3'
              : (r.a.sig === 'co3' ? 'Na2CO3 + 2HCl = 2NaCl + H2O + CO2↑'
                                   : 'Na2SO4 + BaCl2 = BaSO4↓ + 2NaCl'),
      ionic: r.a.sig === 'cl' ? 'Ag+ + Cl- = AgCl↓'
           : (r.a.sig === 'co3' ? 'CO32- + 2H+ = H2O + CO2↑'
                                : 'Ba2+ + SO42- = BaSO4↓'),
      errors: errors
    };
  }
  function anionDraw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var r = atPhysics(p), W = g.w, H = g.h, M = 26;
    qgHead(g, d, F, 'SO₄²⁻ / Cl⁻ / CO₃²⁻ 的检验', r.a.name + '　' + r.acid.name + '酸化');
    var topW = W - M * 2;
    var topH = Math.min(170, H * 0.38);
    qgPanel(g, d, F, M, 40, topW, topH, '① 试剂顺序（先酸化、后沉淀、再验证）', '顺序错了结论就错');
    /* 三个"步骤瓶" */
    var bx = M + 20, by = 40 + 44, bw = Math.min(150, (topW - 70) / 3), bh = topH - 66;
    var steps = [
      ['① 加' + r.acid.name, r.acid.ok ? 'color:#2E7D32' : 'color:#B3261E',
       r.fizz ? '若有 CO₃²⁻/SO₃²⁻ → 冒气泡' : '无明显现象'],
      ['② 加' + r.a.reagent, 'color:#26221C',
       r.a.sig === 'co3' ? '通入澄清石灰水 → 变浑浊' : '产生白色沉淀'],
      ['③ 加稀酸验证', 'color:#26221C', '沉淀不溶解 → 确认成分']
    ];
    var i;
    for (i = 0; i < 3; i++) {
      var x = bx + i * (bw + 16);
      d.rect(x, by, bw, bh, 'rgba(255,255,255,0.7)', 'rgba(38,34,28,0.35)', 1.2);
      d.txt(steps[i][0], x + bw / 2, by + 18, F(10.5, true, false), INK, 'center');
      d.txt(steps[i][2], x + bw / 2, by + bh - 18, F(9.5, false, true), '#6B645C', 'center');
      if (i < 2) d.txt('→', x + bw + 8, by + bh / 2, F(14, true, false), '#8A8378', 'center');
    }
    /* 沉淀示意 */
    var px = bx + 2 * (bw + 16) + bw + 0;
    d.rect(px, by, 58, bh, 'rgba(255,255,255,0.7)', 'rgba(38,34,28,0.35)', 1.2);
    var pc = r.a.sig === 'co3' ? 'rgba(236,240,236,0.95)' : 'rgba(248,248,246,0.98)';
    d.rect(px + 8, by + bh - 22, 42, 14, pc, 'rgba(38,34,28,0.45)', 1);
    d.txt('沉淀', px + 29, by + bh - 15, F(9, false, false), '#3A3630', 'center');
    d.txt('白色', px + 29, by + 16, F(10, true, false), INK, 'center');

    var y2 = 40 + topH + 12;
    var h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② 定量读数与干扰核算',
             'c = ' + qgRound(r.c, 3) + ' mol/L　V = ' + qgRound(r.v, 2) + ' mL');
    var rows = [
      ['试样中 ' + r.a.name + ' 的物质的量', qgRound(r.mm, 4) + ' mmol'],
      ['理论沉淀质量', qgRound(r.mass, 3) + ' mg'],
      ['干扰引入的"假沉淀"质量', qgRound(r.falseMass, 3) + ' mg（' + qgPct(r.falsePct, 0) + '）'],
      ['酸化后的 pH', qgRound(r.pHacid, 2)],
      ['主要干扰离子', r.a.inter],
      ['结论', r.verdict]
    ];
    var ry = y2 + 40, k;
    var rec = qgRowText((state && state.rows) || [],
                        [['vol', 'V'], ['mass', '沉淀'], ['falseMass', '假沉淀'], ['pH', 'pH']], 4);
    var recH = 16 + rec.lines.length * 14;
    for (k = 0; k < rows.length; k++) {
      if (ry > y2 + h2 - recH - 14) break;
      d.txt(rows[k][0], M + 14, ry, F(10.5, false, true), '#6B645C', 'left');
      d.txt(rows[k][1], M + 176, ry, F(11, k === 5, false),
            k === 5 ? (r.falsePct > 0 ? '#B3261E' : '#2E7D32') : INK, 'left');
      ry += 18;
    }
    qgRecord(d, F, rec, M + 14, y2 + h2 - recH - 4, topW - 28);
  }

  /* ==================================================================== *
   * 5 · 4 · 碘与淀粉显蓝、碘的萃取（iodine-starch）                       *
   * ==================================================================== */
  /* 显色：I₂ 与淀粉形成**蓝色**包合物（碘分子进入淀粉的螺旋结构中），
     是检验 I₂（或淀粉）的灵敏方法；该显色加热褪去、冷却恢复（可逆）。
     萃取：I₂ 在 CCl₄ 中的溶解度远大于在水中（分配系数 K_D ≈ 85），
     CCl₄ 密度 1.594 g/cm³ **大于水**，故有机层在**下层**、呈紫色（碘在非极性
     溶剂中的特征色）；用苯时苯层在上层。 */
  var IS_KDC = 85;      /* I₂ 在 CCl₄/水 两相中的分配系数（约值） */
  var IS_KDB = 60;      /* I₂ 在 苯/水 中的分配系数（约值，苯的溶解能力略弱） */
  function isPhysics(p) {
    var c0 = qgClamp(qgNum(p.c0, 0.010), 0.001, 0.050);       /* 碘水浓度 mol/L */
    var ratio = qgClamp(qgNum(p.ratio, 1.0), 0.2, 3.0);       /* V(CCl₄)/V(水) */
    var ext = (p.extract === 'benzene') ? 'benzene' : 'ccl4';
    var KD = (ext === 'benzene') ? IS_KDB : IS_KDC;
    var isStarch = (p.sample === 'starch');
    /* 萃取率 E = KD·r / (1 + KD·r)，r = V有机/V水 */
    var E = KD * ratio / (1 + KD * ratio);
    var cOrg = c0 * (1 - E);
    var cW = c0 - cOrg * ratio;          /* 萃取后水相碘浓度 mol/L */
    if (cW < 0) cW = 0;
    var washOut = qgClamp(100 * E, 0, 100);
    var blue = qgClamp(46 * Math.pow(c0 / 0.010, 0.42), 0, 100);   /* 淀粉蓝的深浅 */
    var residue = qgClamp(100 * (1 - E), 0, 100);
    var layer = (ext === 'ccl4') ? '下层（CCl₄ 密度 1.594 g/cm³ > 水）' : '上层（苯密度 0.877 g/cm³ < 水）';
    var orgColor = (ext === 'ccl4') ? '紫色（紫红色）' : '紫红色';
    return { c0: c0, ratio: ratio, ext: ext, KD: KD, E: E, cOrg: cOrg, cW: cW,
             washOut: washOut, blue: blue, residue: residue, layer: layer,
             orgColor: orgColor, isStarch: isStarch };
  }
  function iodineReact(p) {
    var r = isPhysics(p);
    var ph = [];
    if (r.isStarch) {
      ph.push('向淀粉溶液中滴入碘水，溶液立即变成蓝色（碘与淀粉形成的包合物）');
      ph.push('蓝色深浅：' + (r.blue > 70 ? '深蓝' : (r.blue > 35 ? '蓝色明显' : '浅蓝，颜色较淡')));
      ph.push('把试管加热，蓝色褪去；冷却后蓝色重新出现 —— 该显色是可逆的（包合物被破坏后又能重新形成）');
    } else {
      ph.push('碘水呈浅黄（棕黄）色；加入 CCl₄（或苯）并充分振荡后静置，液体分为两层');
      ph.push('有机层出现在' + r.layer + '，呈' + r.orgColor + '；水层颜色明显变浅' +
              (r.washOut > 92 ? '（几乎无色）' : ''));
      ph.push('萃取率约 ' + qgRound(r.washOut, 1) + '%：碘在 CCl₄ 中的溶解度远大于在水中的溶解度，' +
              '故碘被"拉"进有机层');
      ph.push('水层残留的碘约 ' + qgRound(r.residue, 1) + '%，可再加少量 CCl₄ 重复萃取（多次少量比一次多量更彻底）');
      ph.push('萃取过程中碘单质没有变成新物质，只是从水层转移到有机层（物理变化）');
    }
    return {
      phenomena: ph,
      equation: r.isStarch
        ? '无化学方程式（碘分子进入淀粉螺旋结构形成包合物，属物理显色，加热褪去、冷却复蓝）'
        : '无化学方程式（碘在两相间按分配定律转移，萃取是物理变化）',
      ionic: '',
      type: r.isStarch ? '碘的检验（显色反应）' : '物质的分离与提纯（萃取、分液）',
      conditions: r.isStarch ? '常温；检验时现配现用，避免碘挥发与淀粉变质'
                             : '常温；分液漏斗中充分振荡（注意放气）后静置分层',
      measures: {
        c0: qgRound(r.c0, 4),
        ratio: qgRound(r.ratio, 2),
        E: qgRound(r.E * 100, 1),
        cOrg: qgRound(r.cOrg, 4),
        cW: qgRound(r.cW, 5)
      },
      note: r.isStarch
        ? '淀粉遇碘变蓝既可用来检验 I₂，也可反过来检验淀粉；加热褪色、冷却复蓝，说明这是可逆的包合过程。'
        : '有机层的"上/下"由密度决定：CCl₄（1.594 g/cm³）在**下层**，苯（0.877 g/cm³）在**上层**；分液时下层从下口放出。'
    };
  }
  function iodineConclude(rows, p) {
    var r = isPhysics(p);
    var errors = [];
    errors.push('把萃取剂选成水或酒精：萃取剂必须与原溶剂**不互溶**、且碘在其中溶解度更大；' +
                '酒精与水互溶，根本分不出两层。');
    errors.push('分液时没有先检漏、振荡时没有及时放气：分液漏斗活塞或上口漏液会使有机层流失（结果偏低）；' +
                '振荡中产生的气体不放出，会把塞子顶开甚至冲液。');
    errors.push('分不清哪一层是有机层就乱放液：CCl₄ 密度大于水，**有机层在下**（紫红色），' +
                '应先从下口放出下层；用苯时正好相反（有机层在上，必须从上口倒出）。');
    errors.push('一次用大量萃取剂：分配定律给出的是"每次按比例分配"，' +
                '同样体积分 2~3 次萃取的总萃取率高于一次用完（本台架可把 V(CCl₄)/V(水) 调小再多次观察）。');
    errors.push('用"淀粉变蓝"给碘的萃取定量：显色只能定性（蓝到什么程度没有刻度），' +
                '碘的转移量必须用有机层与水层的浓度（或再滴定）来量化。');
    if (r.isStarch) {
      errors.push('把蓝色当成化学变化的证据：加热褪色、冷却复蓝说明这只是可逆的包合（物理）过程，' +
                  '碘与淀粉之间没有生成新的化学键化合物。');
    }
    return {
      text: r.isStarch
        ? '碘遇淀粉显**蓝色**是检验 I₂ 的灵敏方法（反过来也可检验淀粉）；蓝色在加热时褪去、' +
          '冷却后恢复，说明碘分子只是钻进淀粉的螺旋结构中形成包合物，属于**可逆的物理过程**。'
        : '碘在水中的溶解度很小，在 CCl₄（或苯）中却大得多，因此可以用**萃取**把碘从水层转移到有机层：' +
          '加入 CCl₄ 并振荡后静置，溶液分两层，' + r.layer + '呈' + r.orgColor + '，' +
          '水层颜色变浅。本次 V(CCl₄)/V(水) = ' + qgRound(r.ratio, 2) + ' 时萃取率约 **' +
          qgRound(r.washOut, 1) + '%**（分配系数 K_D ≈ ' + r.KD + '）。',
      equation: r.isStarch
        ? '无化学方程式（碘分子进入淀粉螺旋结构形成包合物，属物理显色，加热褪去、冷却复蓝）'
        : '无化学方程式（碘在两相间按分配定律转移，萃取是物理变化）',
      ionic: '',
      errors: errors
    };
  }
  function iodineDraw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var r = isPhysics(p), W = g.w, H = g.h, M = 26;
    qgHead(g, d, F, '碘与淀粉显蓝 · 碘的萃取（CCl₄ / 苯）',
           r.isStarch ? '显色实验' : 'V(有机)/V(水) = ' + qgRound(r.ratio, 2));
    var topW = W - M * 2;
    var topH = Math.min(176, H * 0.40);
    qgPanel(g, d, F, M, 40, topW, topH, r.isStarch ? '① 淀粉溶液 + 碘水' : '① 分液漏斗中的两层',
             r.isStarch ? '加热褪色、冷却复蓝' : 'CCl₄ 在下层（紫红）');
    var cy = 40 + 40, chh = topH - 60;
    if (r.isStarch) {
      var tx = M + 70;
      var bf = 'rgba(28,52,168,' + qgRound(0.18 + r.blue / 145, 2) + ')';
      qgTube(d, F, tx, cy + 4, 46, chh - 10, 0.60, bf, '淀粉 + 碘水（蓝）');
      qgTube(d, F, tx + 110, cy + 4, 46, chh - 10, 0.60, 'rgba(238,238,232,0.9)', '加热后（蓝褪去）');
      /* 酒精灯在中间：示意加热 */
      qgFlame(d, tx + 55 + 3, cy + chh + 6, 20, '#F0A93B', 'rgba(255,246,214,0.7)');
      d.txt('加热 → 蓝色褪去；冷却 → 蓝色恢复（可逆）', M + 250, cy + chh / 2, F(11, false, true), '#2B3A96', 'left');
      d.rect(M + 250, cy + chh / 2 + 14, 74, 22, bf, 'rgba(38,34,28,0.3)', 1);
      d.txt('蓝色深浅 ' + qgRound(r.blue, 0) + '%', M + 287, cy + chh / 2 + 25, F(10, true, false), '#1E2A96', 'center');
    } else {
      /* 分液漏斗 */
      var fx = M + 96, fy = cy + 2, fw = 76, fh = chh - 8;
      d.poly([[fx, fy], [fx + fw, fy], [fx + fw, fy + fh * 0.42], [fx + fw / 2, fy + fh], [fx, fy + fh * 0.42]],
             'rgba(255,255,255,0.72)', INK, 1.4, true);
      d.line(fx - 12, fy, fx + fw + 12, fy);
      var yTop = fy + fh * 0.24, yBot = fy + fh * 0.66;
      var orgFill = (r.ext === 'ccl4') ? 'rgba(120,44,150,0.72)' : 'rgba(150,70,170,0.62)';
      var watFill = 'rgba(232,226,180,' + qgRound(0.30 + 0.6 * (r.residue / 100), 2) + ')';
      /* 水层 */
      d.rect(fx + 3, yTop, fw - 6, yBot - yTop, watFill, null, 0);
      /* 有机层：CCl₄ 在下、苯在上 */
      if (r.ext === 'ccl4') d.rect(fx + 4, yBot, fw - 8, fh * 0.34 - 6, orgFill, null, 0);
      else d.rect(fx + 3, yTop - fh * 0.18, fw - 6, fh * 0.18, orgFill, null, 0);
      d.line(fx + 1, yTop, fx + fw - 1, yTop);
      d.line(fx + 1, yBot, fx + fw - 1, yBot);
      d.txt('水层（浅黄，残留 ' + qgRound(r.residue, 1) + '%）', fx + fw + 18, (yTop + yBot) / 2,
            F(10, false, false), '#7A6A2B', 'left');
      d.txt((r.ext === 'ccl4' ? 'CCl₄ 层' : '苯层') + '（' + r.orgColor + '，' + qgRound(r.washOut, 1) + '% 的碘）',
            fx + fw + 18, r.ext === 'ccl4' ? yBot + fh * 0.16 : yTop - fh * 0.09,
            F(10, true, false), '#6A2B8A', 'left');
      d.txt('分液漏斗', fx + fw / 2, fy - 14, F(10, true, false), INK, 'center');
    }

    var y2 = 40 + topH + 12;
    var h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② 定量：分配与萃取率',
             'K_D ≈ ' + r.KD + '（' + (r.ext === 'ccl4' ? 'CCl₄' : '苯') + '/水）');
    var rows = [
      ['碘水浓度 c₀', qgRound(r.c0, 4) + ' mol/L'],
      ['V(有机)/V(水)', qgRound(r.ratio, 2)],
      ['萃取率 E = K_D·r/(1+K_D·r)', qgPct(r.washOut, 1)],
      ['有机层碘浓度', qgRound(r.cOrg, 4) + ' mol/L'],
      ['萃取后水层碘浓度', qgSci(r.cW, 3) + ' mol/L'],
      ['有机层位置', r.layer]
    ];
    var ry = y2 + 40, k;
    var rec = qgRowText((state && state.rows) || [],
                        [['c0', 'c₀'], ['ratio', 'r'], ['E', '萃取率%'], ['cW', '水层']], 4);
    var recH = 16 + rec.lines.length * 14;
    for (k = 0; k < rows.length; k++) {
      if (ry > y2 + h2 - recH - 14) break;
      d.txt(rows[k][0], M + 14, ry, F(10.5, false, true), '#6B645C', 'left');
      d.txt(rows[k][1], M + 202, ry, F(11, k === 2, false), k === 2 ? '#6A2B8A' : INK, 'left');
      ry += 18;
    }
    qgRecord(d, F, rec, M + 14, y2 + h2 - recH - 4, topW - 28);
  }

  /* ==================================================================== *
   * 6 · 5 · 酸碱中和滴定（acid-base-titration）—— 本组的"必须能作图"之一  *
   * ==================================================================== */
  /* 模型（强酸 + 强碱，全程按**电荷/物料守恒**算，不用经验公式）：
       设待测盐酸 V_a mL、c_a mol/L；滴入 NaOH V_b mL、c_b mol/L。
       过量酸：  c(H⁺) = (c_a·V_a − c_b·V_b)/(V_a+V_b)      pH = −lg c(H⁺)
       化学计量点（c_aV_a = c_bV_b）：只余 NaCl 与 H₂O，pH 由水的电离决定。
       过量碱：  解 c(OH⁻)² − Δ·c(OH⁻) − Kw = 0（Δ = (c_bV_b−c_aV_a)/(V_a+V_b)），
                 pH = 14 − lg c(OH⁻)。
       这样在计量点附近自动给出单调变化 + 突跃，无需人为拼接。
     Kw 随温度变（教材：升温促进水的电离）：pKw(25℃)=14.00、pKw(40℃)≈13.53，
     故化学计量点的 pH 随温度升高而**略降**（本模型取 6.6~7.0）。 */
  function abPkw(T) {
    /* 用 van't Hoff 型近似：pKw(25)=14.00、pKw(0)≈14.94、pKw(40)≈13.53 */
    var t = qgClamp(qgNum(T, 25), 15, 40);
    return 14.00 - 0.0115 * (t - 25) - 0.00008 * (t - 25) * (t - 25);
  }
  /* ⚠ 这里必须用 Math.log10（或 log/LN10 加**括号**）。
     踩过的坑：曾写成 `pkw - Math.log(c) / Math.LN10` ——
     它算的是 pKw − lg(c·ln10) 而不是 pKw + lg(c)，于是碱过量一侧的 pH 整整偏了
     +5.8 个单位（V(NaOH)=20.5 mL 时真值 11.09 被算成 16.91），而且因为 lg 的符号被吃掉，
     曲线在计量点之后**反而下降**（16.91 → 16.61 → … → 15.88），直接违反
     「滴定曲线在计量点后单调上升」这条最基本的化学事实。酸过量一侧的 −lg c 同理。
     现在两支都用 log10，并且加了"pH 必须随 V 单调不减"的自测断言。 */
  function abPH(ca, va, cb, vb, pkw) {
    var vt = va + vb;
    if (!(vt > 0)) return 7;
    var d = (cb * vb - ca * va) / vt;          /* mol/L，正=碱过量 */
    var kw = Math.pow(10, -pkw);
    if (d > 1e-9) {
      /* 碱过量：c(OH⁻)² − d·c(OH⁻) − Kw = 0 → c = (d + √(d²+4Kw))/2，pH = pKw + lg c */
      var c = (d + Math.sqrt(d * d + 4 * kw)) / 2;
      return pkw + Math.log10(c);
    }
    /* 酸过量：c(H⁺)² + d·c(H⁺) − Kw = 0（注意 d 此时为负）→ pH = −lg c(H⁺) */
    var h = (-d + Math.sqrt(d * d + 4 * kw)) / 2;
    return -Math.log10(h);
  }
  /* 指示剂：找"滴定过程中 pH 首次进入变色区间"的体积（学生看到变色那一刻的读数） */
  function abIndicatorV(ca, va, cb, pkw, lo, hi) {
    var v = 0, step = 0.002, max = va * ca / cb * 3 + 1, prev = abPH(ca, va, cb, 0, pkw);
    while (v < max) {
      v += step;
      var ph = abPH(ca, va, cb, v, pkw);
      if (ph >= lo) {
        /* 线性内插到恰好进入 lo 的位置，避免 0.002 mL 的量化台阶 */
        if (ph > prev) v = v - step * (ph - lo) / (ph - prev);
        return v;
      }
      prev = ph;
    }
    return max;
  }
  var AB_IND = {
    phen: { name: '酚酞', lo: 8.2, hi: 10.0, from: '无色', to: '浅红色（粉红）',
            note: '强碱滴强酸用酚酞：终点时溶液由无色变浅红，人的眼睛对"浅红出现"很敏感' },
    methyl: { name: '甲基橙', lo: 3.1, hi: 4.4, from: '红色', to: '橙色→黄色',
              note: '甲基橙的变色区间在突跃的"偏酸"一侧，同样可用；但它本身显色，颜色判断不如酚酞鲜明' },
    litmus: { name: '石蕊', lo: 5.0, hi: 8.0, from: '红色', to: '紫色',
              note: '石蕊的变色区间宽（约 pH 5~8）、颜色变化是"红→紫"的渐变色，终点不敏锐，' +
                    '**中和滴定不用石蕊**' }
  };
  function abState(p) {
    var ca = qgClamp(qgNum(p.ca, 0.1000), 0.0200, 0.3000);   /* 待测盐酸浓度 */
    var va = qgClamp(qgNum(p.va, 20.00), 10.00, 25.00);      /* 待测盐酸体积 mL */
    var cb = qgClamp(qgNum(p.cb, 0.1000), 0.0500, 0.2000);   /* NaOH 标准液浓度 */
    var T = qgClamp(qgNum(p.temp, 25), 15, 40);
    var ind = AB_IND[p.indicator] || AB_IND.phen;
    var pkw = abPkw(T);
    var Veq = ca * va / cb;
    return { ca: ca, va: va, cb: cb, T: T, ind: ind, pkw: pkw, Veq: Veq,
             ph0: abPH(ca, va, cb, 0, pkw), phEq: abPH(ca, va, cb, Veq, pkw) };
  }
  function abReact(p, ctx) {
    var s = abState(p);
    var step = qgClamp(qgNum(p.step, 0.50), 0.10, 2.00);
    var vb = qgRound(step * ((ctx && ctx.index ? ctx.index : 0) + 1), 3);
    var ph = abPH(s.ca, s.va, s.cb, vb, s.pkw);
    var d = (s.cb * vb - s.ca * s.va) / (s.va + vb);
    var indV = abIndicatorV(s.ca, s.va, s.cb, s.pkw, s.ind.lo, s.ind.hi);
    var relErr = (indV - s.Veq) / s.Veq * 100;
    var ph = [];
    if (vb < 0.001) {
      ph.push('滴定前：锥形瓶中的盐酸无色透明，pH = ' + qgRound(abPH(s.ca, s.va, s.cb, 0, s.pkw), 2));
    } else {
      ph.push('滴入 ' + qgRound(vb, 2) + ' mL NaOH 标准液，溶液 pH = ' + qgRound(abPH(s.ca, s.va, s.cb, vb, s.pkw), 2));
      if (Math.abs(vb - s.Veq) < step * 1.2) {
        ph.push('已到化学计量点附近：再加半滴，溶液颜色发生突变（这就是"突跃"）');
      }
      if (d > 1e-6) ph.push('NaOH 已过量 ' + qgSci(d, 2) + ' mol/L，锥形瓶中溶液显碱性');
      else if (vb < s.Veq) ph.push('盐酸尚未被完全中和，溶液仍显酸性');
    }
    if (s.ind.name === '酚酞') {
      ph.push(abPH(s.ca, s.va, s.cb, vb, s.pkw) >= s.ind.lo
        ? '酚酞已由无色变为浅红色，且半分钟内不褪色 —— 到达滴定终点'
        : '酚酞仍为无色（pH 还没进入 8.2~10.0 的变色区间）');
    } else if (s.ind.name === '甲基橙') {
      var pv = abPH(s.ca, s.va, s.cb, vb, s.pkw);
      ph.push(pv < s.ind.lo ? '甲基橙显红色（pH < 3.1）'
            : (pv <= s.ind.hi ? '甲基橙由红变橙 —— 到达滴定终点' : '甲基橙已变黄（pH > 4.4，碱已过量）'));
    } else {
      ph.push('石蕊由红向紫色渐变，颜色变化不敏锐（这就是滴定不用石蕊的原因）');
    }
    ph.push('温度 ' + qgRound(s.T, 0) + ' ℃ 时 pKw = ' + qgRound(s.pkw, 2) +
            '，故化学计量点的 pH = ' + qgRound(s.phEq, 2) + '（由水的电离决定，25 ℃ 时约为 7.00）');
    return {
      phenomena: ph,
      equation: 'HCl + NaOH = NaCl + H2O',
      ionic: 'H+ + OH- = H2O',
      type: '定量分析（酸碱中和滴定 / 强酸强碱）',
      conditions: '常温（本台架 ' + qgRound(s.T, 0) + ' ℃）；用碱式滴定管装 NaOH 标准液；' +
                  '锥形瓶下垫白纸便于比色；指示剂 ' + s.ind.name + '（不用石蕊）',
      measures: {
        vb: qgRound(vb, 3),
        pH: qgRound(abPH(s.ca, s.va, s.cb, vb, s.pkw), 2),
        indV: qgRound(indV, 3),
        relErr: qgRound(relErr, 4)
      }
    };
  }
  function abConclude(rows, p) {
    var s = abState(p);
    var indV = abIndicatorV(s.ca, s.va, s.cb, s.pkw, s.ind.lo, s.ind.hi);
    var relErr = (indV - s.Veq) / s.Veq * 100;
    var cMeas = (s.cb * indV) / s.va;
    var errors = [];
    errors.push('滴定管未用待装液润洗（或只用蒸馏水洗）：标准液被残留的水稀释，' +
                '要消耗更多体积才能中和，算出的待测浓度**偏高**（本台架可把 c_b 调小模拟这一效果）。');
    errors.push('滴定前尖嘴有气泡、滴定后气泡消失：气泡的体积被当成滴出的液体，读数**偏大**，结果偏高；' +
                '反之滴定后尖嘴挂液/漏液则结果偏低。读数时视线要与凹液面最低点相平，' +
                '滴定前仰视、滴定后俯视都会使 ΔV 偏小 → 结果偏低。');
    errors.push('锥形瓶用待测液（盐酸）润洗：瓶里多出额外的待测物，消耗的标准液偏多，结果**偏高**；' +
                '锥形瓶里本来残留少量蒸馏水则**无影响**（待测物的物质的量没变）。');
    errors.push('指示剂选择不当或用量过多：石蕊变色区间宽、颜色渐变，终点不敏锐；' +
                '指示剂本身是弱酸/弱碱，滴入过多会消耗标准液，也给终点带来主观误差。');
    errors.push('终点判断过早/过晚（最后半滴没"悬而未落"加入、变色后没等够半分钟）：' +
                '本台架在 0.1 mol/L 量级下化学计量点前后 ±0.02 mL 的 pH 就从 ' +
                qgRound(abPH(s.ca, s.va, s.cb, s.Veq - 0.02, s.pkw), 2) + ' 跳到 ' +
                qgRound(abPH(s.ca, s.va, s.cb, s.Veq + 0.02, s.pkw), 2) +
                '，肉眼能分辨的"半滴"约 0.02~0.04 mL，已足以把结果带偏 0.1%~0.2%。');
    return {
      text: '强酸强碱中和滴定的滴定曲线是一条**S 形曲线**：起点 pH 由待测盐酸浓度决定（本台架 ' +
            qgRound(s.ph0, 2) + '），计量点前缓慢上升，在化学计量点附近出现 pH 突跃，' +
            '之后又趋于平缓。本台架条件下 V(NaOH) 从 ' + qgRound(s.Veq - 0.02, 2) + ' mL 到 ' +
            qgRound(s.Veq + 0.02, 2) + ' mL 时，pH 由 ' +
            qgRound(abPH(s.ca, s.va, s.cb, s.Veq - 0.02, s.pkw), 2) + ' 突跃到 ' +
            qgRound(abPH(s.ca, s.va, s.cb, s.Veq + 0.02, s.pkw), 2) +
            '。化学计量点（pH = ' + qgRound(s.phEq, 2) + '，' + qgRound(s.T, 0) + ' ℃）附近这一段' +
            '正好落在酚酞（8.2~10.0）与甲基橙（3.1~4.4）的变色区间内 —— 这就是强酸强碱滴定' +
            '两种指示剂都能用的原因；而石蕊的变色区间虽也在其中，但颜色是渐变、终点不敏锐，故不用。' +
            '本组用 ' + s.ind.name + ' 时，指示剂在 V = ' + qgRound(indV, 3) +
            ' mL 处变色（化学计量点 V = ' + qgRound(s.Veq, 3) + ' mL），由此算得 c(HCl) = ' +
            qgRound(cMeas, 4) + ' mol/L，相对误差 ' + qgRound(relErr, 3) + '%。',
      equation: 'HCl + NaOH = NaCl + H2O',
      ionic: 'H+ + OH- = H2O',
      errors: errors
    };
  }
  function abDraw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var s = abState(p), W = g.w, H = g.h, M = 26;
    /* rows 在 state 里（核心把活 state 传给 draw），用来把已经滴出的点连成曲线 */
    var rows = (state && state.rows) ? state.rows : [];
    qgHead(g, d, F, '酸碱中和滴定 · 滴定曲线与指示剂',
           'c(HCl) = ' + qgRound(s.ca, 4) + ' mol/L　V = ' + qgRound(s.va, 2) + ' mL');
    var topH = Math.min(168, H * 0.37);
    var topW = W - M * 2;
    qgPanel(g, d, F, M, 40, topW, topH, '① 滴定装置', '酸式/碱式滴定管 + 锥形瓶 + 白纸');
    var bx = M + 70, byy = 40 + 36, bh = topH - 56;
    /* 碱式滴定管 */
    d.rect(bx - 9, byy, 18, bh * 0.66, 'rgba(255,255,255,0.8)', INK, 1.4);
    d.rect(bx - 8, byy + 2, 16, bh * 0.40, 'rgba(170,205,230,0.55)', null, 0);
    d.txt('碱式滴定管', bx, byy - 14, F(10, true, false), INK, 'center');
    d.txt('NaOH', bx, byy + bh * 0.20, F(9.5, true, false), '#2B5A8A', 'center');
    d.circle(bx, byy + bh * 0.70, 5, 'rgba(220,214,198,0.9)', INK, 1.2);
    d.line(bx, byy + bh * 0.75, bx, byy + bh * 0.86);
    /* 锥形瓶 */
    var fx = bx, fy = byy + bh * 0.88, fw2 = 34;
    d.poly([[fx - 7, fy], [fx + 7, fy], [fx + fw2, fy + bh * 0.42], [fx - fw2, fy + bh * 0.42]],
           'rgba(255,255,255,0.7)', INK, 1.4, true);
    var liq = (rows.length ? Number(rows[rows.length - 1].pH) : s.ph0);
    var col = liq < s.ind.lo ? 'rgba(240,236,224,0.85)'
            : (liq <= s.ind.hi + 0.2 ? 'rgba(232,120,160,0.55)' : 'rgba(214,80,130,0.62)');
    d.poly([[fx - 16, fy + bh * 0.30], [fx + 16, fy + bh * 0.30], [fx + fw2 - 2, fy + bh * 0.42], [fx - fw2 + 2, fy + bh * 0.42]],
           col, null, 0, true);
    d.txt('锥形瓶（' + s.ind.name + '）', fx, fy + bh * 0.42 + 14, F(9.5, false, false), '#6B645C', 'center');
    d.txt('V 读 = ' + qgRound(rows.length ? Number(rows[rows.length - 1].vb) : 0, 2) + ' mL',
          M + topW - 16, byy + 22, F(11, true, false), '#2B5A8A', 'right');
    d.txt('pH = ' + qgRound(liq, 2), M + topW - 16, byy + 42, F(11, true, false), '#8E1B1B', 'right');
    d.txt('指示剂：' + s.ind.name + '（' + s.ind.from + ' → ' + s.ind.to + '）',
          M + topW - 16, byy + 62, F(10, false, true), '#6B645C', 'right');

    /* ② 滴定曲线：把 rows 直接画出来 —— 这就是"必须能作图"的那张图 */
    var y2 = 40 + topH + 12, h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② pH–V(NaOH) 滴定曲线（S 形，非线性 → 不做线性拟合）',
             'fit = none');
    var px0 = M + 48, px1 = M + topW - 116, py0 = y2 + 34, py1 = y2 + h2 - 26;
    d.line(px0, py0, px0, py1); d.line(px0, py1, px1, py1);
    d.txt('V(NaOH) / mL', px1, py1 + 13, F(9.5, false, false), '#6B645C', 'right');
    d.txt('pH', px0 - 6, py0 - 10, F(9.5, false, false), '#6B645C', 'left');
    var vMax = s.Veq * 2.2; if (vMax < 1) vMax = 1;
    function sx(v) { return px0 + qgClamp(v / vMax, 0, 1) * (px1 - px0); }
    function sy(ph) { return py1 - qgClamp(ph / 14, 0, 1) * (py1 - py0); }
    /* 理论曲线（浅色虚线） */
    var i, pts = [];
    for (i = 0; i <= 120; i++) {
      var v = vMax * i / 120;
      pts.push([sx(v), sy(abPH(s.ca, s.va, s.cb, v, s.pkw))]);
    }
    d.dash(true, [3, 3]); d.poly(pts, null, 'rgba(38,34,28,0.35)', 1.2, false); d.dash(false);
    /* 实测点（学生滴出来的） */
    var real = [];
    for (i = 0; i < rows.length; i++) {
      var vv = Number(rows[i].vb), pp = Number(rows[i].pH);
      if (!isFinite(vv) || !isFinite(pp)) continue;
      real.push([sx(vv), sy(pp)]);
    }
    if (real.length) d.poly(real, null, '#8E1B1B', 2, false);
    for (i = 0; i < real.length; i++) d.circle(real[i][0], real[i][1], 2.4, '#8E1B1B', null, 0);
    /* 计量点竖线 + 酚酞变色区间带 */
    d.dash(true, [4, 3]);
    d.line(sx(s.Veq), py0, sx(s.Veq), py1);
    d.dash(false);
    d.txt('计量点 ' + qgRound(s.Veq, 2) + ' mL', sx(s.Veq), py0 - 0, F(9, false, true), '#2B5A8A', 'center');
    d.rect(px0 + 2, sy(s.ind.hi), px1 - px0 - 4, Math.max(2, sy(s.ind.lo) - sy(s.ind.hi)),
           'rgba(214,80,130,0.16)', null, 0);
    d.txt(s.ind.name + '变色区间 ' + s.ind.lo + '~' + s.ind.hi, px1 - 4, sy((s.ind.lo + s.ind.hi) / 2),
          F(9, false, true), '#8E1B1B', 'right');
    /* 侧栏数值 */
    d.txt('化学计量点 pH', px1 + 12, py0 + 18, F(9.5, false, true), '#6B645C', 'left');
    d.txt(qgRound(s.phEq, 2), px1 + 12, py0 + 34, F(12, true, false), INK, 'left');
    d.txt('突跃（±0.02 mL）', px1 + 12, py0 + 58, F(9.5, false, true), '#6B645C', 'left');
    d.txt(qgRound(abPH(s.ca, s.va, s.cb, s.Veq - 0.02, s.pkw), 1) + ' → ' +
          qgRound(abPH(s.ca, s.va, s.cb, s.Veq + 0.02, s.pkw), 1), px1 + 12, py0 + 74, F(12, true, false), '#8E1B1B', 'left');
    d.txt('已测 ' + real.length + ' 点', px1 + 12, py0 + 100, F(10, false, true), '#6B645C', 'left');
  }

  /* ==================================================================== *
   * 7 · 6 · KMnO₄ 滴定（kmno4-titration）—— 本组另一张"必须能作图"的图    *
   * ==================================================================== */
  /* 反应（[S6]）：
       酸性：MnO₄⁻ + 5Fe²⁺ + 8H⁺ = Mn²⁺ + 5Fe³⁺ + 4H₂O     （本台架用它）
       标定：2MnO₄⁻ + 5C₂O₄²⁻ + 16H⁺ = 2Mn²⁺ + 10CO₂↑ + 8H₂O
             （分子式写法 2KMnO₄+5H₂C₂O₄+3H₂SO₄ = 2MnSO₄+K₂SO₄+10CO₂↑+8H₂O）
     要点：KMnO₄ 本身紫红色 → **自身指示剂**，终点是"最后半滴使溶液呈浅紫红色、
     半分钟内不褪色"；必须装**酸式**滴定管（强氧化性腐蚀橡皮管）；必须用**稀硫酸**
     酸化（盐酸会被氧化：2MnO₄⁻+10Cl⁻+16H⁺=2Mn²⁺+5Cl₂↑+8H₂O，使结果偏高；
     硝酸本身有氧化性，也会氧化 Fe²⁺）。 */
  function kmState(p) {
    var cb = qgClamp(qgNum(p.cb, 0.0200), 0.0050, 0.0500);   /* KMnO₄ 标准液浓度 */
    var vs = qgClamp(qgNum(p.vs, 20.00), 10.00, 25.00);      /* FeSO₄ 待测液体积 mL */
    var T = qgClamp(qgNum(p.temp, 75), 55, 85);
    var acid = p.acid || 'h2so4';
    var cs = qgClamp(qgNum(p.cs, 0.1000), 0.0200, 0.2000);   /* 待测 Fe²⁺ 浓度 */
    /* "最后半滴"的体积：滴定管最小分度是 0.1 mL，按"半滴 ≈ 0.02 mL"量级取；
       它是终点读数**系统地**比化学计量点大的那一部分，也是本台架误差的主要来源。
       （量纲自查：cs[mol/L]×vs[mL] = 10⁻³ mol 量级；cb[mol/L]×vb[mL] 同量纲，
        所以 Veq = cs·vs/(5·cb) 直接得 mL，无需再乘 1000。） */
    var drop = qgClamp(qgNum(p.drop, 0.02), 0.01, 0.05);
    var Veq = cs * vs / (5 * cb);                             /* 5Fe²⁺ ~ 1MnO₄⁻，mL */
    /* 终点读数 = 化学计量点 + 最后那半滴（这就是 KMnO₄ 滴定误差的主要来源） */
    var Vep = Veq + drop;
    var cMeas = 5 * cb * Vep / vs;
    var relErr = (cMeas - cs) / cs * 100;                     /* ≈ drop/Veq × 100 */
    /* 酸的影响（见文件头 [S6]） */
    var acidBad = 0, acidNote = '稀硫酸：既提供酸性介质，又不会氧化 Fe²⁺（正确选择）';
    if (acid === 'hcl') { acidBad = 2.4; acidNote = '稀盐酸：Cl⁻ 被 MnO₄⁻ 氧化（2MnO₄⁻+10Cl⁻+16H⁺=2Mn²⁺+5Cl₂↑+8H₂O），多消耗 KMnO₄，结果偏高'; }
    else if (acid === 'hno3') { acidBad = 0.9; acidNote = '稀硝酸：本身有氧化性，会把部分 Fe²⁺ 直接氧化，使消耗的 KMnO₄ 偏少，结果偏低'; }
    else if (acid === 'none') { acidBad = 5.0; acidNote = '不加酸：MnO₄⁻ 在中性/碱性条件下被还原为 MnO₂（棕色沉淀），反应计量关系改变，滴定失效'; }
    relErr += acidBad;
    /* 温度只影响"反应快不快、终点好不好判"，不改变终点读数本身（见 kmReact 的现象文字）。
       用每升 15 ℃ 约 3.3 倍的 Arrhenius 经验系数：55 ℃ ≈ 25 ℃ 的 7.4 倍、75 ℃ ≈ 82 倍、
       85 ℃ ≈ 220 倍 —— 这样"温度 55→85 ℃"在读数上有一个数量级的差别，学生看得出快慢。 */
    var rate = Math.exp((T - 25) / 15);
    var excess = drop * cb / (vs + Vep);                      /* 过量 MnO₄⁻ mol/L（显浅紫红的那一点） */
    return { cb: cb, vs: vs, cs: cs, T: T, acid: acid, acidNote: acidNote, acidBad: acidBad,
             drop: drop, Veq: Veq, Vep: Vep, cMeas: cMeas, relErr: relErr, rate: rate,
             excess: excess };
  }
  function kmReact(p, ctx) {
    var s = kmState(p);
    var step = qgClamp(qgNum(p.step, 0.50), 0.10, 2.00);
    var vb = 0.50 + step * (ctx && ctx.index ? ctx.index : 0);   /* 滴定管初读数 0.50 mL */
    var mnTot = s.cb * vb;                                       /* 已加入的 MnO₄⁻ mmol */
    var cap = s.cs * s.vs / 5;                                   /* 按计量关系最多能消耗的 MnO₄⁻ mmol */
    var reacted = Math.min(mnTot, cap);
    var consumed = reacted * 5;                                  /* 5Fe²⁺ ~ 1MnO₄⁻ → Fe²⁺ mmol */
    var cFe = consumed / s.vs;                                   /* mol/L（当前已反应的量，只用于校验） */
    /* 图上要画的是**已反应的** n(MnO₄⁻)（mmol）：它与 V 成正比直到计量点，
       到计量点后不再增长 → 图上出现水平台阶，台阶的拐点就是终点读数。
       （不能画"过量 MnO₄⁻"：它在终点之前恒为 0，整张图会是贴着横轴的一条线。） */
    var nMn = reacted;
    /* c(Fe²⁺) 这一列给的是**按终点读数算出的结果**（s.cMeas），不是"当前已反应量/vs"：
       后者会随滴入体积一路涨到 0.065 这种错值（真正的终点读数才是 c(Fe²⁺)）。
       滴定过程中它基本恒定（因为终点读数不会随着继续滴而改变），
       学生看到它在 0.1002 附近不动、而 nMn/nFe 沿直线上升，正是"到达终点后读数不再变"的直观体现。 */
    void cFe;
    var ph = [];
    if (vb < s.Veq * 0.97) {
      ph.push('滴入 ' + qgRound(vb, 2) + ' mL KMnO₄ 溶液，紫红色迅速褪去（Mn²⁺ 生成后反应加快，先慢后快）');
      ph.push('锥形瓶中溶液仍为 Fe²⁺ 的浅绿色：MnO₄⁻ 一进去就被 Fe²⁺ 还原成几乎无色的 Mn²⁺');
    } else if (vb < s.Veq + 0.005) {
      ph.push('紫红色褪去明显变慢 —— 已到化学计量点附近，此时要放慢速度、边滴边摇');
      ph.push('溶液由浅绿转为浅黄（Fe³⁺ 的颜色逐渐显现）');
    } else {
      ph.push('滴入最后半滴后，溶液呈**浅紫红色**（微红色），半分钟内不褪色 —— 到达滴定终点');
      ph.push('过量 MnO₄⁻ 浓度约 ' + qgSci(s.excess, 2) + ' mol/L，正是它让溶液显出浅紫红色' +
              '（KMnO₄ 自己就是指示剂，不需要另加）');
    }
    ph.push('水浴温度 ' + qgRound(s.T, 0) + ' ℃：' + (s.T >= 70
      ? '反应速率合适（相对 25 ℃ 约 ' + qgRound(s.rate, 0) + ' 倍），滴定顺畅'
      : '温度偏低，褪色慢（相对 25 ℃ 只有 ' + qgRound(s.rate, 1) +
        ' 倍），容易把"尚未反应完"误当成"快到终点"而滴过量（Mn²⁺ 的自催化作用还没起来）'));
    if (s.acidBad > 1) ph.push('⚠ ' + s.acidNote);
    return {
      phenomena: ph,
      equation: '2KMnO4 + 10FeSO4 + 8H2SO4 = 2MnSO4 + 5Fe2(SO4)3 + K2SO4 + 8H2O',
      ionic: 'MnO4- + 5Fe2+ + 8H+ = Mn2+ + 5Fe3+ + 4H2O',
      type: '定量分析（氧化还原滴定；KMnO₄ 自身指示剂）',
      conditions: '酸性介质（稀硫酸酸化）；' + qgRound(s.T, 0) + ' ℃ 水浴；' +
                  'KMnO₄ 溶液装在酸式滴定管中；终点以"浅紫红色半分钟不褪"为准',
      measures: {
        vb: qgRound(vb, 3),
        nMn: qgRound(nMn, 4),
        nFe: qgRound(consumed, 4),
        cFe: qgRound(s.cMeas, 4),
        rate: qgRound(s.rate, 1),
        relErr: qgRound(s.relErr, 3)
      },
      note: '定量关系：n(Fe²⁺) = 5 × n(MnO₄⁻)，所以 c(Fe²⁺) = 5·c(KMnO₄)·V(KMnO₄)/V(FeSO₄)。' +
            '表中 c(Fe²⁺) 是**按终点读数算出的结果**（滴定过程中基本不变，到终点那一行才是有效读数）；' +
            'n(MnO₄⁻)、n(Fe²⁺) 则是**随滴入体积累积**的量，用来作过原点直线图。'
    };
  }
  function kmConclude(rows, p) {
    var s = kmState(p);
    var errors = [];
    errors.push('没有用稀硫酸酸化（或错用盐酸/硝酸）：Cl⁻ 会被 MnO₄⁻ 氧化（' +
                '2MnO₄⁻+10Cl⁻+16H⁺=2Mn²⁺+5Cl₂↑+8H₂O）而多消耗标准液，结果**偏高**；' +
                '硝酸本身有氧化性会先氧化掉一部分 Fe²⁺，结果**偏低**；不加酸则 MnO₄⁻ 被还原成棕色 MnO₂，' +
                '计量关系变成 3e⁻，整个计算失效。');
    errors.push('KMnO₄ 装错滴定管：KMnO₄ 有强氧化性，会把碱式滴定管的橡皮管氧化腐蚀，' +
                '必须装在**酸式**滴定管（玻璃活塞）里。');
    errors.push('滴定速度过快 / 温度过低：KMnO₄ 与 Fe²⁺（以及标定用的草酸钠）反应是 Mn²⁺ **自催化**的，' +
                '第一滴褪色慢、之后越来越快。温度过低时反应速率只有 75 ℃ 的 ' +
                qgPct(100 / Math.exp((75 - 55) / 12), 2) + '（本台架按每升 12 ℃ 约 2.7 倍估算），' +
                '褪色慢、容易把"还没反应完"误当成"快到终点"，从而滴过量；温度过高（>90 ℃）草酸会分解，' +
                '标定出的 c(KMnO₄) 就不准。');
    errors.push('"最后半滴"控制不准：本台架的终点读数比化学计量点多出 ' + qgRound(s.drop, 3) +
                ' mL（一滴的一半），它带来 ' + qgRound(s.drop / s.Veq * 100, 3) + '% 的**系统偏高**；' +
                'V(KMnO₄) 越小的滴定（标准液越稀、待测液越稀）这一项占比越大。' +
                '减小办法：终点前放慢速度、用半滴法并把瓶壁上的液滴冲下去，必要时做空白校正。');
    errors.push('终点判断不严：必须"最后**半滴**使溶液呈浅紫红色且**半分钟内不褪色**"。' +
                '颜色太浅就判终点 → V 偏小、c(Fe²⁺) 偏低；紫红色已经很深才判 → V 偏大、结果偏高。');
    errors.push('忘记 KMnO₄ 溶液的"自身指示剂"特点而另加指示剂：多加的指示剂本身会消耗氧化剂；' +
                'KMnO₄ 溶液还应避光保存、现标定现用（见光分解），否则 c(KMnO₄) 会缓慢变小。');
    return {
      text: 'KMnO₄ 滴定用**酸性 KMnO₄ 溶液**作标准液，MnO₄⁻ 本身显紫红色、还原产物 Mn²⁺ 几乎无色，' +
            '所以**不需要另加指示剂**（自身指示剂）；终点是"最后半滴使溶液呈浅紫红色且半分钟内不褪色"。' +
            '定量关系由电子守恒给出：MnO₄⁻ 得 5e⁻、Fe²⁺ 失 1e⁻ → n(Fe²⁺) = 5n(MnO₄⁻)，' +
            '故 c(Fe²⁺) = 5c(KMnO₄)·V(KMnO₄)/V(FeSO₄)。本台架：c(KMnO₄) = ' + qgRound(s.cb, 4) +
            ' mol/L、V(FeSO₄) = ' + qgRound(s.vs, 2) + ' mL、' + qgRound(s.T, 0) + ' ℃、' +
            s.acidNote.split('：')[0] + '酸化 → 终点 V = ' + qgRound(s.Vep, 3) +
            ' mL（化学计量点 ' + qgRound(s.Veq, 3) + ' mL，多出的 ' + qgRound(s.drop, 3) +
            ' mL 就是"最后半滴"显色所需），' +
            '算得 c(Fe²⁺) = ' + qgRound(s.cMeas, 4) + ' mol/L，相对误差 ' + qgRound(s.relErr, 3) +
            '%。作 n(MnO₄⁻)–V(KMnO₄) 图是一条过原点的直线（斜率即 c(KMnO₄)），' +
            '计量点之后出现水平台阶（本图 r² 应接近 1）。',
      equation: '2KMnO4 + 10FeSO4 + 8H2SO4 = 2MnSO4 + 5Fe2(SO4)3 + K2SO4 + 8H2O',
      ionic: 'MnO4- + 5Fe2+ + 8H+ = Mn2+ + 5Fe3+ + 4H2O',
      errors: errors
    };
  }
  function kmDraw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var s = kmState(p), W = g.w, H = g.h, M = 26;
    var rows = (state && state.rows) ? state.rows : [];
    qgHead(g, d, F, 'KMnO₄ 滴定（自身指示剂）',
           'c(KMnO₄) = ' + qgRound(s.cb, 4) + ' mol/L　' + qgRound(s.T, 0) + ' ℃');
    var topH = Math.min(168, H * 0.37);
    var topW = W - M * 2;
    qgPanel(g, d, F, M, 40, topW, topH, '① 装置与终点颜色', s.acidNote.split('：')[0] + '酸化');
    var bx = M + 74, byy = 40 + 36, bh = topH - 56;
    d.rect(bx - 9, byy, 18, bh * 0.64, 'rgba(255,255,255,0.8)', INK, 1.4);
    d.rect(bx - 8, byy + 2, 16, bh * 0.42, 'rgba(150,40,140,0.62)', null, 0);   /* 紫红色标准液 */
    d.txt('酸式滴定管', bx, byy - 14, F(10, true, false), INK, 'center');
    d.txt('KMnO₄', bx, byy + bh * 0.22, F(9.5, true, false), '#6A1B6A', 'center');
    d.rect(bx - 10, byy + bh * 0.66, 20, 8, 'rgba(230,230,225,0.95)', INK, 1.3); /* 玻璃活塞 */
    d.line(bx, byy + bh * 0.74, bx, byy + bh * 0.86);
    var fx = bx, fy = byy + bh * 0.88, fw2 = 34;
    d.poly([[fx - 7, fy], [fx + 7, fy], [fx + fw2, fy + bh * 0.42], [fx - fw2, fy + bh * 0.42]],
           'rgba(255,255,255,0.7)', INK, 1.4, true);
    var lastV = rows.length ? Number(rows[rows.length - 1].vb) : 0;
    var ended = lastV > s.Veq;
    var liqCol = ended ? 'rgba(196,120,190,0.62)'
              : (lastV > s.Veq * 0.9 ? 'rgba(226,224,180,0.75)' : 'rgba(206,226,206,0.7)');
    d.poly([[fx - 16, fy + bh * 0.30], [fx + 16, fy + bh * 0.30], [fx + fw2 - 2, fy + bh * 0.42], [fx - fw2 + 2, fy + bh * 0.42]],
           liqCol, null, 0, true);
    d.txt(ended ? '浅紫红色（终点）' : (lastV > 0 ? '紫红迅速褪去' : 'FeSO₄ 浅绿色'),
          fx, fy + bh * 0.42 + 14, F(9.5, false, false), ended ? '#6A1B6A' : '#2E7D32', 'center');
    d.txt('V(KMnO₄) = ' + qgRound(lastV, 2) + ' mL', M + topW - 16, byy + 20, F(11, true, false), '#6A1B6A', 'right');
    d.txt('化学计量点 ' + qgRound(s.Veq, 2) + ' mL', M + topW - 16, byy + 40, F(10, false, true), '#6B645C', 'right');
    d.txt(s.acidBad > 1 ? '⚠ 酸化用酸有干扰' : '酸化用酸正确（稀硫酸）',
          M + topW - 16, byy + 60, F(10, true, false), s.acidBad > 1 ? '#B3261E' : '#2E7D32', 'right');

    /* ② n(MnO₄⁻)–V(KMnO₄) 图：定比关系 → 线性，给真拟合（过原点） */
    var y2 = 40 + topH + 12, h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② n(MnO₄⁻) 随 V(KMnO₄) 的变化（过原点直线 + 终点台阶）',
             'fit = origin');
    var px0 = M + 52, px1 = M + topW - 116, py0 = y2 + 34, py1 = y2 + h2 - 26;
    d.line(px0, py0, px0, py1); d.line(px0, py1, px1, py1);
    d.txt('V(KMnO₄) / mL', px1, py1 + 13, F(9.5, false, false), '#6B645C', 'right');
    d.txt('n(MnO₄⁻)反应 / mmol', px0 - 6, py0 - 10, F(9.5, false, false), '#6B645C', 'left');
    var nCap = s.cb * s.Veq;                                   /* 计量点时的 n(MnO₄⁻) mmol */
    var vMax = Math.max(1, s.Veq * 1.8), nMax = Math.max(0.001, nCap * 1.15);
    function sx(v) { return px0 + qgClamp(v / vMax, 0, 1) * (px1 - px0); }
    function sy(n) { return py1 - qgClamp(n / nMax, 0, 1) * (py1 - py0); }
    d.dash(true, [3, 3]);
    d.line(sx(0), sy(0), sx(s.Veq), sy(nCap));                 /* 理论直线（过原点） */
    d.line(sx(s.Veq), sy(nCap), sx(vMax), sy(nCap));           /* 计量点后的水平台阶 */
    d.dash(false);
    var pts = [], i;
    for (i = 0; i < rows.length; i++) {
      var vv = Number(rows[i].vb), nn = Number(rows[i].nMn);
      if (!isFinite(vv) || !isFinite(nn)) continue;
      pts.push([sx(vv), sy(nn)]);
    }
    if (pts.length) d.poly(pts, null, '#6A1B6A', 2, false);
    for (i = 0; i < pts.length; i++) d.circle(pts[i][0], pts[i][1], 2.6, '#6A1B6A', null, 0);
    d.circle(sx(s.Veq), sy(nCap), 4.6, null, '#C0392B', 1.6);
    d.txt('计量点 ' + qgRound(s.Veq, 2) + ' mL', sx(s.Veq), sy(nCap) - 12, F(9.5, true, false), '#C0392B', 'center');
    d.txt('斜率 = c(KMnO₄)', px1 - 4, py0 + 14, F(9.5, false, true), '#6B645C', 'right');
    d.txt(qgRound(s.cb, 4) + ' mol/L', px1 - 4, py0 + 30, F(11, true, false), '#6A1B6A', 'right');
    d.txt('已测 ' + pts.length + ' 点', px1 + 12, py0 + 20, F(10, false, true), '#6B645C', 'left');
    d.txt('c(Fe²⁺) 测得', px1 + 12, py0 + 44, F(9.5, false, true), '#6B645C', 'left');
    d.txt(qgRound(s.cMeas, 4), px1 + 12, py0 + 60, F(12, true, false), INK, 'left');
    d.txt('相对误差', px1 + 12, py0 + 84, F(9.5, false, true), '#6B645C', 'left');
    d.txt(qgRound(s.relErr, 2) + '%', px1 + 12, py0 + 100, F(12, true, false),
          s.acidBad > 1 ? '#B3261E' : '#2E7D32', 'left');
  }

  /* ==================================================================== *
   * 8 · 7 · 气体的收集与检验（gas-collection）                            *
   * ==================================================================== */
  /* 收集方法按「密度 vs 空气」与「在水中溶解性」两条性质选：
       ρ(空气) 取 1.29 g/L（0 ℃、101 kPa），标准状况下气体密度由 M/22.4 得。
       H₂ 0.0899 → 向下排空气；O₂ 1.429 → 向上排空气（也可排水）；
       CO₂ 1.977 → 向上排空气；Cl₂ 3.17 → 向上排空气（不能用排水：与水反应）；
       NH₃ 0.771 → 向下排空气（极易溶于水，绝不能用排水）；SO₂ 2.86 → 向上排空气
       （溶于水，不用排水）。 */
  var GC_GASES = {
    h2:  { name: '氢气 H₂',  mw: 2.016,  rho: 0.0899, sol: 0.02, detect: '点燃时发出**爆鸣声**（尖锐的爆鸣声）',
           color: '无色', smell: '无味', toxic: false, tail: 'combust',
           eq: 'Zn + H2SO4 = ZnSO4 + H2↑', ion: 'Zn + 2H+ = Zn2+ + H2↑' },
    o2:  { name: '氧气 O₂',  mw: 32.00,  rho: 1.429,  sol: 0.04, detect: '用**带火星的木条**伸入瓶内，木条**复燃**',
           color: '无色', smell: '无味', toxic: false, tail: 'vent',
           eq: '2KClO3 --MnO2/Δ--> 2KCl + 3O2↑', ion: '' },
    co2: { name: '二氧化碳 CO₂', mw: 44.01, rho: 1.977, sol: 0.9, detect: '通入**澄清石灰水**，石灰水**变浑浊**',
           color: '无色', smell: '无味', toxic: false, tail: 'naoh',
           eq: 'CaCO3 + 2HCl = CaCl2 + H2O + CO2↑', ion: 'CaCO3 + 2H+ = Ca2+ + H2O + CO2↑' },
    cl2: { name: '氯气 Cl₂', mw: 70.90, rho: 3.17, sol: 4.0, detect: '**湿润的淀粉碘化钾试纸**放在瓶口→试纸**变蓝**；' +
           '黄绿色、有刺激性气味',
           color: '黄绿色', smell: '强烈刺激性气味', toxic: true, tail: 'naoh',
           eq: 'MnO2 + 4HCl(浓) --Δ--> MnCl2 + Cl2↑ + 2H2O', ion: '' },
    nh3: { name: '氨气 NH₃', mw: 17.03, rho: 0.771, sol: 700, detect: '**湿润的红色石蕊试纸**变**蓝**；' +
           '或用蘸浓盐酸的玻璃棒靠近瓶口产生**白烟**（NH₄Cl）',
           color: '无色', smell: '刺激性气味', toxic: true, tail: 'water',
           eq: '2NH4Cl + Ca(OH)2 --Δ--> CaCl2 + 2NH3↑ + 2H2O', ion: '' },
    so2: { name: '二氧化硫 SO₂', mw: 64.07, rho: 2.86, sol: 40, detect: '**湿润的蓝色石蕊试纸**变**红**（酸性氧化物）；' +
           '能使**品红溶液褪色**（漂白性）、使**酸性 KMnO₄ 溶液褪色**（还原性）',
           color: '无色', smell: '刺激性气味', toxic: true, tail: 'naoh',
           eq: 'Na2SO3 + H2SO4(浓) = Na2SO4 + H2O + SO2↑', ion: '' }
  };
  var GC_METHODS = {
    water:  { name: '排水法', need: '不溶于水且不与水反应', short: '排水' },
    up:     { name: '向上排空气法', need: '密度比空气大', short: '向上' },
    down:   { name: '向下排空气法', need: '密度比空气小', short: '向下' }
  };
  var GC_TAIL = {
    naoh:  { name: 'NaOH 溶液吸收', ok: true,  note: '酸性/有毒气体用 NaOH 溶液吸收（浓度比石灰水高，吸收完全）' },
    water: { name: '水（配倒置漏斗防倒吸）', ok: true, note: 'NH₃ 极易溶于水，导管口接倒置漏斗可防倒吸' },
    burn:  { name: '点燃（燃烧掉）', ok: true, note: 'H₂、CO 等可燃性尾气直接点燃处理' },
    vent:  { name: '直接排入空气', ok: false, note: '有毒气体不得直接排放；无毒气体也不该在密闭实验室里直排' }
  };
  function gcPhysics(p) {
    var gso = GC_GASES[p.gas] || GC_GASES.co2;
    var mth = GC_METHODS[p.method] || GC_METHODS.up;
    var t = qgClamp(qgNum(p.time, 30), 10, 60);          /* 收集时间 s */
    var T = qgClamp(qgNum(p.temp, 25), 5, 35);           /* 室温 ℃ */
    var tail = GC_TAIL[p.tail] || GC_TAIL.naoh;
    /* 匹配度 */
    var fit = 100, why = [];
    if (mth === GC_METHODS.water) {
      if (gso.sol > 3) { fit = 42; why.push(gso.name + '在水中溶解度大（或与水反应），不能用排水法，收集到的气体很少'); }
      else { fit = 96 - gso.sol * 4; why.push('排水法收集到的气体常带水蒸气，需要时再干燥'); }
    } else if (mth === GC_METHODS.up) {
      if (gso.rho < 1.0) { fit = 52; why.push(gso.name + '密度比空气小，用向上排空气法会把瓶里的空气留在下面，收不满也不纯'); }
      else { fit = 97; why.push('密度比空气大，向上排空气法合适；导管要伸到集气瓶底部以排尽空气'); }
    } else {
      if (gso.rho > 1.0) { fit = 52; why.push(gso.name + '密度比空气大，用向下排空气法会"沉不下去"，集不满'); }
      else { fit = 97; why.push('密度比空气小，向下排空气法合适；导管要伸到集气瓶底部'); }
    }
    /* 溶解造成的损失（排水法时随温度升高而减小） */
    if (mth === GC_METHODS.water && gso.sol > 3) {
      var hot = 1 - (T - 5) / 60;
      fit = qgClamp(fit * (1.35 - 0.35 * hot), 20, 60);
    }
    /* 纯度：瓶内的空气/水蒸气随收集时间被逐渐排出，越久越接近该方法的"上限"，' +
       但不是硬截断 —— 用指数趋近（1 − 0.5·e^(−t/14)）更贴近真实：
       t = 10 s 时约 75%、20 s 约 88%、30 s 约 94%、60 s 约 99%。 */
    var purity = qgClamp(fit * (1 - 0.5 * Math.exp(-t / 14)), 15, 99.5);
    var vol = qgRound(t * 2.1 * (1 + (25 - T) * 0.006), 1);   /* 收集到的体积 mL（气泡速率随温度略变） */
    /* 检验是否成功：有毒气体未处理则判"不能验满" */
    var detectOK = purity > 55;
    var tailOK = tail.ok || !gso.toxic;
    var verdict;
    if (!detectOK) verdict = '收集到的气体太不纯/太少，检验现象不明显，需换收集方法';
    else if (!tailOK) verdict = '气体本身收得到，但**尾气直接排放**——' + gso.name + '有毒，必须先处理尾气';
    else verdict = '收集方法合适、检验现象明显、尾气已处理，本次收集与检验成功';
    return { g: gso, m: mth, t: t, T: T, tail: tail, fit: fit, why: why, purity: purity,
             vol: vol, detectOK: detectOK, tailOK: tailOK, verdict: verdict };
  }
  function gcReact(p) {
    var r = gcPhysics(p);
    var ph = [];
    ph.push('用' + r.m.name + '收集 ' + r.g.name + '（' + r.m.need + '），收集 ' +
            qgRound(r.t, 0) + ' s 后得到约 ' + qgRound(r.vol, 1) + ' mL 气体');
    ph.push(r.g.name + '是' + r.g.color + '、' + r.g.smell + '的气体；' +
            (r.g.rho > 1 ? '密度比空气大' : '密度比空气小') + '（ρ ≈ ' + r.g.rho + ' g/L）');
    ph.push('验满/检验：' + r.g.detect);
    if (!r.detectOK) ph.push('⚠ 收集到的气体纯度只有 ' + qgPct(r.purity, 1) + '，检验现象不明显');
    if (r.tail.ok) ph.push('尾气处理：' + r.tail.name + ' —— ' + r.tail.note);
    else ph.push('⚠ 尾气' + r.tail.name + '：' + r.tail.note);
    if (r.g.toxic) ph.push(r.g.name + '有毒，实验要在通风处进行，尾气必须处理后再排放');
    var i;
    for (i = 0; i < r.why.length; i++) ph.push(r.why[i]);
    return {
      phenomena: ph,
      equation: r.g.eq,
      ionic: r.g.ion || '',
      type: '气体的实验室制法与检验（收集方法 + 验满 + 尾气处理）',
      conditions: '常温常压（本台架 ' + qgRound(r.T, 0) + ' ℃）；' + r.m.name + '；' +
                  (r.tail.ok ? '尾气用' + r.tail.name : '尾气未处理'),
      measures: {
        vol: qgRound(r.vol, 1),
        purity: qgRound(r.purity, 1),
        match: qgRound(r.fit, 1),
        t: qgRound(r.t, 1)
      },
      note: r.verdict
    };
  }
  function gcConclude(rows, p) {
    var r = gcPhysics(p);
    var errors = [];
    errors.push('收集方法选错：' + r.g.name + (r.g.rho > 1 ? '密度比空气大' : '密度比空气小') +
                '，' + (r.m === GC_METHODS.water ? '若改用排水法，会因溶解/与水反应而收不到气体' :
                        '若改用' + (r.g.rho > 1 ? '向下' : '向上') + '排空气法，瓶里的空气排不出去，气体不纯也收不满') +
                '。判据只有两条：**密度与空气比**、**在水中溶解性**。');
    errors.push('导管位置不对：排空气法时导管口必须伸到**集气瓶底部**，' +
                '否则瓶内空气排不尽，验满会"假成功"；排水法时导管口要放在瓶口附近，' +
                '等气泡**连续均匀**冒出再开始收集，最初排出的气体含空气。');
    errors.push('用排水法收集 Cl₂、NH₃、SO₂：Cl₂ 与水反应、NH₃ 极易溶（1 体积水溶约 700 体积）、' +
                'SO₂ 也易溶，三种气体都收不到；反过来 H₂、O₂ 用排水法反而更纯。');
    errors.push('尾气直接排放：Cl₂、SO₂、NH₃ 都有刺激性气味且有毒，' +
                '必须用 NaOH 溶液吸收（NH₃ 用水或稀酸并**防倒吸**，H₂ 可点燃），不能直排。');
    errors.push('验满操作不当：检验 O₂ 的带火星木条要放在**瓶口**（伸入瓶内会把瓶内气体搅出）；' +
                '检验 NH₃ 的湿润红色石蕊试纸要放在瓶口，不能浸入溶液（否则被碱液直接染蓝，产生假阳性）。');
    return {
      text: '气体的收集方法只由两条性质决定：**密度与空气比较**（决定向上还是向下排空气）、' +
            '**在水中溶解性与是否与水反应**（决定能不能用排水法）。H₂/O₂ 可用排水法，' +
            'H₂/NH₃ 用向下排空气法，CO₂/Cl₂/SO₂ 用向上排空气法。' +
            '检验各有专属试剂：H₂ 点燃听**爆鸣声**、O₂ 用**带火星木条**看**复燃**、' +
            'CO₂ 通**澄清石灰水**看**变浑浊**、Cl₂ 用**湿润淀粉碘化钾试纸**看**变蓝**、' +
            'NH₃ 用**湿润红色石蕊试纸**看**变蓝**（或蘸浓盐酸的玻璃棒产生**白烟**）、' +
            'SO₂ 用**湿润蓝色石蕊试纸**看**变红**（并可用品红褪色、酸性 KMnO₄ 褪色进一步区分）。' +
            '本次实验结果：' + r.verdict + '。',
      equation: r.g.eq,
      ionic: r.g.ion || '',
      errors: errors
    };
  }
  function gcDraw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var r = gcPhysics(p), W = g.w, H = g.h, M = 26;
    qgHead(g, d, F, '气体的收集与检验', r.g.name + '　' + r.m.name);
    var topW = W - M * 2;
    var topH = Math.min(184, H * 0.42);
    qgPanel(g, d, F, M, 40, topW, topH, '① 收集装置（' + r.m.name + '）',
             r.m.need);
    /* 集气瓶 */
    var bx = M + 110, byy = 40 + 40, bw = 78, bh = topH - 66;
    d.poly([[bx, byy], [bx + bw, byy], [bx + bw, byy + bh], [bx, byy + bh]], 'rgba(255,255,255,0.72)', INK, 1.5, true);
    /* 气体颜色填充 */
    var gcol = r.g.name.indexOf('氯') >= 0 ? 'rgba(196,214,60,0.45)'
             : (r.g.name.indexOf('二氧化硫') >= 0 ? 'rgba(214,214,220,0.35)' : 'rgba(230,238,248,0.45)');
    var lvl = r.m === GC_METHODS.water ? byy + 10 : byy + bh - (bh - 8) * qgClamp(r.purity / 100, 0.1, 1);
    d.rect(bx + 2, lvl, bw - 4, byy + bh - lvl - 2, gcol, null, 0);
    if (r.m === GC_METHODS.water) {
      d.rect(bx + 2, byy + 10, bw - 4, bh - 12, 'rgba(170,205,230,0.35)', null, 0);
      d.txt('水', bx + bw / 2, byy + bh - 12, F(9.5, false, true), '#2B5A8A', 'center');
      /* 水槽 + 气泡 */
      var i;
      for (i = 0; i < 5; i++) d.circle(bx + 20 + i * 10, byy + 40 + (i % 3) * 14, 2.2, 'rgba(255,255,255,0.9)', 'rgba(38,34,28,0.4)', 0.8);
    } else {
      d.txt(r.m === GC_METHODS.up ? '导管伸到瓶底' : '瓶口向下', bx + bw / 2, byy + 14, F(9.5, false, true), '#6B645C', 'center');
    }
    d.txt('集气瓶', bx + bw / 2, byy + bh + 13, F(9.5, false, false), '#6B645C', 'center');
    /* 气体发生装置（简画试管/锥形瓶） */
    var sx = M + 30;
    d.rect(sx, byy + bh * 0.25, 44, bh * 0.55, 'rgba(255,255,255,0.7)', INK, 1.4);
    d.rect(sx + 2, byy + bh * 0.25 + 12, 40, bh * 0.55 - 14, 'rgba(206,226,206,0.6)', null, 0);
    d.txt('发生装置', sx + 22, byy + bh - 4, F(9.5, false, false), '#6B645C', 'center');
    d.line(sx + 44, byy + bh * 0.38, bx, byy + bh * 0.38);
    /* 尾气处理 */
    var tx = M + topW - 76;
    if (r.tail.ok) {
      d.rect(tx - 18, byy + bh * 0.30, 52, bh * 0.66, 'rgba(255,255,255,0.7)', INK, 1.4);
      d.rect(tx - 16, byy + bh * 0.30 + 16, 48, bh * 0.66 - 18, 'rgba(190,214,238,0.6)', null, 0);
      d.txt('⑤ NaOH(尾气)', tx + 8, byy + bh - 2, F(9.5, false, false), '#2B5A8A', 'center');
    } else {
      d.txt('尾气直排 ⚠', tx + 8, byy + bh * 0.6, F(10.5, true, false), '#B3261E', 'center');
    }

    /* ② 纯度与检验 */
    var y2 = 40 + topH + 12, h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② 收集结果与检验方法',
             '纯度 ' + qgPct(r.purity, 1) + '　' + qgRound(r.vol, 1) + ' mL');
    /* 纯度柱 */
    var barW = Math.min(200, topW * 0.34), barH = 12, bxx = M + 14, byy2 = y2 + 34;
    d.rect(bxx, byy2, barW, barH, 'rgba(38,34,28,0.10)', 'rgba(38,34,28,0.25)', 1);
    d.rect(bxx, byy2, barW * r.purity / 100, barH,
           r.purity > 85 ? 'rgba(46,125,50,0.75)' : (r.purity > 55 ? 'rgba(200,160,40,0.8)' : 'rgba(179,38,30,0.8)'), null, 0);
    d.txt('纯度 ' + qgPct(r.purity, 1), bxx + barW + 10, byy2 + 6, F(10.5, true, false), INK, 'left');
    var rows = [
      ['收集方法匹配度', qgRound(r.fit, 1) + ' %'],
      ['收集到的体积', qgRound(r.vol, 1) + ' mL'],
      ['密度（g/L）', String(r.g.rho) + (r.g.rho > 1.29 ? '（比空气大）' : '（比空气小）')],
      ['检验方法', r.g.detect.replace(/\*\*/g, '')],
      ['尾气处理', r.tail.name],
      ['结论', r.verdict]
    ];
    var ry = byy2 + 34, k;
    var rec = qgRowText((state && state.rows) || [],
                        [['t', 't'], ['vol', 'V'], ['purity', '纯度%'], ['match', '匹配%']], 4);
    var recH = 16 + rec.lines.length * 14;
    for (k = 0; k < rows.length; k++) {
      if (ry > y2 + h2 - recH - 14) break;
      d.txt(rows[k][0], M + 14, ry, F(10.5, false, true), '#6B645C', 'left');
      d.txt(rows[k][1], M + 150, ry, F(11, k === 5, false),
            k === 5 ? (r.detectOK && r.tailOK ? '#2E7D32' : '#B3261E') : INK, 'left');
      ry += 18;
    }
    qgRecord(d, F, rec, M + 14, y2 + h2 - recH - 4, topW - 28);
  }

  /* ==================================================================== *
   * 9 · 8 · SO₂ 的性质（so2-properties）                                  *
   * ==================================================================== */
  /* 现象逐字取 [S7]：装置 B 品红溶液"溶液变红色"→ 酸性氧化物；
     装置 C"高锰酸钾溶液紫红色褪色"→ 还原性；装置 D"有淡黄色沉淀生成"
     2H₂S+SO₂=3S↓+2H₂O → 氧化性；装置 E 探究可逆性"待品红溶液完全褪色后…
     点燃酒精灯加热，观察到的现象为无色溶液恢复为红色"；
     尾气"SO₂+2NaOH=Na₂SO₃+H₂O"。 */
  /* ⚠ 焰色 / 碘的萃取 / 品红褪色 在化学上**确实没有**化学方程式（都是物理变化）：
     契约 §3 对 ionic 有「不适用时给 ''」的豁免，equation 没有这一条；核心 balance()
     对它们只会报"解析不了"（不是"配不平"）。为避免核心把这三条误标成"编错了方程式"，
     equation 里给**不含 "=" 的说明性文字**，并在 spec 上声明 **noBalance: true**。
     （clab.js 还没落地，这个字段是按契约精神做的自我声明；若主线核心不认它，
      最多是界面上这三条仍被标红提示 —— 不影响任何数值与结论。） */
  var SO2_REAGENTS = {
    fuchsin: {
      name: '品红溶液', prop: '漂白性',
      phen: ['品红溶液的红色逐渐褪去，得到无色溶液（SO₂ 与品红化合生成不稳定的无色物质）',
             '把褪色后的溶液加热，红色重新出现 —— 说明 SO₂ 的漂白是**可逆**的（不稳定化合）'],
      eq: '无化学方程式（SO₂ 与品红生成的加合物没有固定组成，教材只作定性描述）',
      ion: '', propTxt: '漂白性（化合型漂白，可逆）'
    },
    kmno4: {
      name: '酸性 KMnO₄ 溶液', prop: '还原性',
      phen: ['紫红色的酸性 KMnO₄ 溶液逐渐褪色，变成几乎无色的溶液',
             '这里 SO₂ 作**还原剂**被氧化成 SO₄²⁻，MnO₄⁻ 被还原成几乎无色的 Mn²⁺'],
      eq: '5SO2 + 2KMnO4 + 2H2O = K2SO4 + 2MnSO4 + 2H2SO4',
      ion: '5SO2 + 2MnO4- + 2H2O = 5SO42- + 2Mn2+ + 4H+',
      propTxt: '还原性（被 KMnO₄ 氧化成 SO₄²⁻）'
    },
    litmus: {
      name: '湿润的蓝色石蕊试纸', prop: '酸性氧化物',
      phen: ['湿润的蓝色石蕊试纸**变红**，但继续通 SO₂ **只变红、不褪色**（这是与"漂白"的关键区别）',
             'SO₂ 与水反应生成亚硫酸（H₂SO₃），溶液显酸性；酸性氧化物只能让指示剂变色，不能漂白'],
      eq: 'SO2 + H2O ⇌ H2SO3',
      ion: 'SO2 + H2O ⇌ H2SO3 ⇌ H+ + HSO3-',
      propTxt: '酸性氧化物（与水化合生成中强酸 H₂SO₃；与碱反应生成盐和水）'
    },
    h2s: {
      name: 'H₂S 溶液（氢硫酸）', prop: '氧化性',
      phen: ['溶液变浑浊，析出**淡黄色沉淀**（硫单质）',
             '这里 SO₂ 作**氧化剂**（S 由 +4 降到 0），H₂S 作还原剂（S 由 −2 升到 0）'],
      eq: 'SO2 + 2H2S = 3S↓ + 2H2O',
      ion: 'SO2 + 2H2S = 3S↓ + 2H2O（H₂S 为弱电解质，写分子式）',
      propTxt: '氧化性（+4 价的 S 被还原成 0 价硫单质）'
    },
    chlorine: {
      name: '氯水（或溴水）', prop: '还原性',
      phen: ['氯水的黄绿色褪去，同时溶液显酸性增强',
             'SO₂ 与 Cl₂ 发生氧化还原：SO₂ 被氧化成 H₂SO₄，Cl₂ 被还原成 HCl —— ' +
             '两者混合后漂白能力反而**消失**（都消耗掉了）'],
      eq: 'SO2 + Cl2 + 2H2O = H2SO4 + 2HCl',
      ion: 'SO2 + Cl2 + 2H2O = SO42- + 4H+ + 2Cl-',
      propTxt: '还原性（被 Cl₂ 氧化成 SO₄²⁻）'
    },
    naoh: {
      name: 'NaOH 溶液（尾气吸收）', prop: '酸性氧化物',
      phen: ['通入 SO₂ 后 NaOH 溶液的碱性逐渐减弱（可用酚酞指示剂观察红色变浅）',
             '这是实验室处理 SO₂ 尾气的标准做法'],
      eq: 'SO2 + 2NaOH = Na2SO3 + H2O',
      ion: 'SO2 + 2OH- = SO3 2- + H2O',
      propTxt: '酸性氧化物（与碱反应生成盐和水）'
    }
  };
  function so2Physics(p) {
    var rg = SO2_REAGENTS[p.reagent] || SO2_REAGENTS.fuchsin;
    var c = qgClamp(qgNum(p.conc, 0.10), 0.02, 0.50);        /* 通入的 SO₂ 相对浓度 mol/L */
    var hum = qgClamp(qgNum(p.humid, 60), 0, 100);           /* 环境相对湿度 %（影响试纸类） */
    var t = qgClamp(qgNum(p.time, 10), 2, 40);               /* 通气时间 s */
    var fade = qgClamp(100 * (1 - Math.exp(-c * 9 * t / 12)), 0, 99.5);
    var absorb = qgRound(c * 1000 * t / 60 * 46, 1);         /* 表观吸收量（mmol，作图用） */
    var litmus = qgClamp(hum * 0.65 + c * 90, 0, 100);
    var redox = qgClamp(c * 780 * Math.min(1, t / 8), 0, 100);
    var sulfur = qgClamp(c * 900 * Math.min(1, t / 8), 0, 100);
    var ph2 = 7 - qgClamp(Math.log10(1 + c * 260), 0, 5.4);
    var obs;
    if (rg.prop === '漂白性') obs = fade > 70 ? '品红完全褪为无色' : (fade > 25 ? '品红明显变浅' : '品红略变浅');
    else if (rg.prop === '酸性氧化物' && p.reagent === 'litmus') obs = litmus > 55 ? '蓝色石蕊试纸变红（不褪色）' : '试纸变色很慢（湿度偏低）';
    else if (rg.prop === '酸性氧化物') obs = 'NaOH 溶液碱性减弱（酚酞红色变浅）';
    else if (rg.prop === '还原性' && p.reagent === 'kmno4') obs = redox > 70 ? '紫红色完全褪去' : (redox > 25 ? '紫红色明显变浅' : '紫红色略变浅');
    else if (rg.prop === '还原性') obs = redox > 70 ? '氯水黄绿色完全褪去' : (redox > 25 ? '氯水颜色明显变浅' : '氯水颜色略变浅');
    else obs = sulfur > 70 ? '析出大量淡黄色沉淀（硫）' : (sulfur > 25 ? '溶液变浑浊，出现淡黄色沉淀' : '浑浊不明显');
    return { rg: rg, c: c, hum: hum, t: t, fade: fade, absorb: absorb, litmus: litmus,
             redox: redox, sulfur: sulfur, pH2: ph2, obs: obs };
  }
  function so2React(p) {
    var r = so2Physics(p);
    var ph = r.rg.phen.slice(0);
    ph.push('本次读数：' + r.obs + '（通气 ' + qgRound(r.t, 0) + ' s，c(SO₂) ≈ ' +
            qgRound(r.c, 2) + ' mol/L，湿度 ' + qgRound(r.hum, 0) + '%）');
    if (r.rg.prop === '漂白性') ph.push('注意区分：SO₂ 只使**品红**等有机色料褪色（可逆），' +
            '并不能使石蕊褪色（只变红）；氯水/漂白粉的褪色是氧化型的，加热不恢复');
    if (r.rg.prop === '酸性氧化物' && p.reagent === 'litmus') {
      ph.push(r.litmus > 55 ? '试纸变红说明 SO₂ 是酸性氧化物（H₂SO₃ 电离出 H⁺），' +
              '但它**不会**把石蕊漂白' : '湿度不足时试纸变色慢 —— 试纸必须**湿润**（干燥 SO₂ 不显酸性）');
    }
    if (p.reagent === 'fuchsin' && r.fade > 60) ph.push('结论落点：SO₂ 的漂白是**化合型**的（生成不稳定无色物质），加热可恢复红色；这与 Cl₂ 的氧化型漂白（不可逆）本质不同');
    return {
      phenomena: ph,
      equation: r.rg.eq,
      ionic: r.rg.ion,
      type: '元素化合物的性质探究（SO₂：酸性氧化物 / 漂白性 / 还原性 / 氧化性）',
      conditions: '常温常压通气；' + (p.reagent === 'litmus' ? '试纸必须**湿润**' : '溶液现用现配') +
                  '；尾气用 NaOH 溶液吸收',
      measures: {
        conc: qgRound(r.c, 3),
        fade: qgRound(r.fade, 1),
        absorb: qgRound(r.absorb, 1),
        pH: qgRound(r.pH2, 2),
        litmus: qgRound(r.litmus, 1)
      },
      note: '本组试剂体现的性质：' + r.rg.propTxt
    };
  }
  function so2Conclude(rows, p) {
    var r = so2Physics(p);
    var errors = [];
    errors.push('把 SO₂ 的漂白性与氯水的漂白性混为一谈：SO₂ 与品红**化合**生成不稳定的无色物质，' +
                '加热红色**恢复**（可逆）；氯水/漂白粉/Na₂O₂ 是**氧化型**漂白，把有色物质氧化破坏，' +
                '加热不恢复。SO₂ 也不能使石蕊褪色（只变红）。');
    errors.push('用干燥的试纸/干燥气体做酸性检验：SO₂ 本身不能电离出 H⁺，' +
                '必须**遇水生成 H₂SO₃** 才显酸性 —— 试纸要湿润，否则"不变红"并不说明 SO₂ 不是酸性氧化物。');
    errors.push('把 SO₂ 使酸性 KMnO₄ 褪色当成漂白性：这里 SO₂ 是**还原剂**被氧化成 SO₄²⁻，' +
                '属于氧化还原反应（5SO₂+2MnO₄⁻+2H₂O=5SO₄²⁻+2Mn²⁺+4H⁺），与漂白机理完全不同。');
    errors.push('忽略尾气：SO₂ 有刺激性气味且有毒，是形成硫酸型酸雨的主要污染物，' +
                '必须用 NaOH 溶液吸收（SO₂+2NaOH=Na₂SO₃+H₂O），不能直排。');
    errors.push('通 SO₂ 时间过长/浓度过大后仍按"褪色"判断：品红褪色后继续通入 SO₂ 或放置过久，' +
                '现象会趋于饱和；要研究可逆性必须"完全褪色后**停止通气**再加热"，' +
                '否则一边通一边加热，红色当然回不来。');
    return {
      text: 'SO₂ 的性质可以归成四条：① **酸性氧化物** —— SO₂+H₂O ⇌ H₂SO₃（使湿润蓝色石蕊变红，不褪色）、' +
            'SO₂+2NaOH=Na₂SO₃+H₂O；② **漂白性** —— 使品红褪色，**加热恢复红色**（化合型、可逆，' +
            '与氯水的氧化型漂白不同）；③ **还原性** —— 被 O₂、酸性 KMnO₄、氯水/溴水氧化成 SO₄²⁻' +
            '（5SO₂+2KMnO₄+2H₂O=K₂SO₄+2MnSO₄+2H₂SO₄、SO₂+Cl₂+2H₂O=H₂SO₄+2HCl）；' +
            '④ **氧化性** —— 与 H₂S 反应析出淡黄色硫（SO₂+2H₂S=3S↓+2H₂O）。' +
            '本次用 ' + r.rg.name + ' 检验，体现的是' + r.rg.propTxt + '，观察到的现象是：' + r.obs + '。',
      equation: 'SO2 + H2O ⇌ H2SO3；SO2 + 2NaOH = Na2SO3 + H2O；5SO2 + 2KMnO4 + 2H2O = K2SO4 + 2MnSO4 + 2H2SO4',
      ionic: 'SO2 + 2OH- = SO3 2- + H2O；5SO2 + 2MnO4- + 2H2O = 5SO42- + 2Mn2+ + 4H+',
      errors: errors
    };
  }
  function so2Draw(g, p, state) {
    var d = qgDraw(g), F = qgFontFn(g);
    var r = so2Physics(p), W = g.w, H = g.h, M = 26;
    qgHead(g, d, F, 'SO₂ 的性质（漂白性 / 还原性 / 酸性氧化物 / 氧化性）',
           r.rg.name + '：' + r.rg.prop);
    var topW = W - M * 2;
    var topH = Math.min(180, H * 0.41);
    qgPanel(g, d, F, M, 40, topW, topH, '① 五支试管的对比实验', '每支试管验一条性质');
    var i, tw = Math.min(74, (topW - 60) / 5), th = topH - 74, tx0 = M + 24, ty = 40 + 40;
    var sets = [
      ['品红', r.fade, 'rgba(206,54,120,', '褪为无色', '#B3261E'],
      ['酸性KMnO₄', r.redox, 'rgba(150,40,140,', '紫红褪去', '#6A1B6A'],
      ['蓝色石蕊试纸', r.litmus, 'rgba(40,80,190,', '变红', '#B3261E'],
      ['H₂S 溶液', r.sulfur, 'rgba(214,204,60,', '淡黄沉淀', '#8A7A12'],
      ['NaOH(尾气)', 100 - r.fade * 0.6, 'rgba(160,190,220,', '碱性减弱', '#2B5A8A']
    ];
    for (i = 0; i < 5; i++) {
      var x = tx0 + i * (tw + 8);
      var fill = sets[i][2] + qgRound(0.15 + 0.6 * (sets[i][1] / 100), 2) + ')';
      if (i === 2) fill = r.litmus > 55 ? 'rgba(214,80,96,0.75)' : 'rgba(40,80,190,0.6)';
      qgTube(d, F, x + tw / 2, ty + 4, tw * 0.56, th, 0.58, fill, sets[i][0]);
      d.txt(sets[i][3], x + tw / 2, ty + th - 20, F(9, true, false), sets[i][4], 'center');
    }
    d.txt('SO₂ →', M + 14, ty + th / 2, F(11, true, false), '#6B645C', 'left');

    var y2 = 40 + topH + 12, h2 = H - y2 - M - 4;
    qgPanel(g, d, F, M, y2, topW, h2, '② 定量读数（性质 ↔ 现象 ↔ 方程式）',
             'c(SO₂) = ' + qgRound(r.c, 2) + ' mol/L，通气 ' + qgRound(r.t, 0) + ' s');
    var rows = [
      ['本组试剂 / 体现的性质', r.rg.name + '　→　' + r.rg.propTxt],
      ['品红褪色率', qgPct(r.fade, 1) + '（加热可恢复红色）'],
      ['KMnO₄ / 氯水褪色强度', qgRound(r.redox, 1) + ' / 100（还原性）'],
      ['硫沉淀强度', qgRound(r.sulfur, 1) + ' / 100（氧化性）'],
      ['石蕊变红程度', qgRound(r.litmus, 1) + ' / 100（需湿润）'],
      ['吸收量（表观）', qgRound(r.absorb, 1) + ' mmol'],
      ['对应溶液 pH', qgRound(r.pH2, 2) + '（H₂SO₃ 为中强酸）'],
      ['现象', r.obs]
    ];
    var ry = y2 + 40, k;
    var rec = qgRowText((state && state.rows) || [],
                        [['conc', 'c'], ['fade', '褪色%'], ['pH', 'pH'], ['litmus', '石蕊']], 4);
    var recH = 16 + rec.lines.length * 14;
    for (k = 0; k < rows.length; k++) {
      if (ry > y2 + h2 - recH - 14) break;
      d.txt(rows[k][0], M + 14, ry, F(10.5, false, true), '#6B645C', 'left');
      d.txt(rows[k][1], M + 208, ry, F(11, k === 7, false), k === 7 ? '#8E1B1B' : INK, 'left');
      ry += 18;
    }
    qgRecord(d, F, rec, M + 14, y2 + h2 - recH - 4, topW - 28);
  }

  /* ==================================================================== *
   * 10 · 登记（契约 §2 组 6 的 8 个 id，逐字）                            *
   * ==================================================================== */
  function reg(id, spec) {
    spec.id = id;
    API.register(id, spec);
  }
  var GROUP = '物质检验·分离·定量';

  /* ---- 1 flame-test ---------------------------------------------------- */
  reg('flame-test', {
    id: 'flame-test',
    name: '焰色反应（Na 黄 / K 紫 / Ca 砖红 / Cu 绿）',
    group: GROUP,
    aim: '用焰色试验检验 Na、K、Ca、Cu 等金属元素，学会"洗—烧—蘸—烧—观"五步操作，' +
         '并理解检验钾时为什么要透过蓝色钴玻璃观察',
    principle: '某些金属或它们的化合物在灼烧时会使火焰呈现特殊的颜色，这叫焰色试验（焰色反应）。' +
               '灼烧时原子吸收能量、电子跃迁到高能级，回到低能级时以特定波长的光放出能量，' +
               '于是火焰带上该元素的特征颜色 —— 焰色只与**金属元素**有关，与它组成什么化合物无关，' +
               '而且过程中没有新物质生成，属于**物理变化**。\n' +
               '人教版常见焰色：Li 紫红、Na 黄、K 紫（**透过蓝色钴玻璃片**观察）、Ca 砖红、' +
               'Sr 洋红、Ba 黄绿、Cu 绿。钠的黄色极其灵敏，微量钠就会把钾的紫色掩盖，' +
               '蓝色钴玻璃能吸收黄光，所以检验钾必须透过它观察。',
    apparatus: ['铂丝（或洁净的铁丝；**不能用铜丝**，铜丝灼烧本身显绿色）',
                '酒精灯', '稀盐酸', '蓝色钴玻璃片', '待测试样：NaCl、KCl、CaCl₂、CuCl₂、LiCl、SrCl₂、BaCl₂ 溶液',
                '镍铬丝/镊子、试管'],
    steps: ['洗：把铂丝浸入稀盐酸中洗涤，除去表面的杂质（盐酸盐易挥发，不会留在铂丝上）',
            '烧：把铂丝放在酒精灯外焰上灼烧，直到火焰与酒精灯原来的颜色一致（说明铂丝已洁净）',
            '蘸：用灼烧过的铂丝蘸取待测试样溶液',
            '烧：把铂丝放在酒精灯外焰上灼烧，观察火焰的颜色',
            '观：**检验钾时必须透过蓝色钴玻璃片**观察，滤去钠的黄光后才能看到紫色',
            '每次换试样前都要重复"洗—烧"两步，否则上一种试样的钠残留会使火焰发黄'],
    params: [
      { key: 'metal', label: '待测试样（金属元素）', unit: '', type: 'select', value: 'na',
        options: [
          { value: 'na', label: 'NaCl 溶液（钠）' },
          { value: 'k',  label: 'KCl 溶液（钾）' },
          { value: 'ca', label: 'CaCl₂ 溶液（钙）' },
          { value: 'cu', label: 'CuCl₂ 溶液（铜）' },
          { value: 'li', label: 'LiCl 溶液（锂）' },
          { value: 'sr', label: 'SrCl₂ 溶液（锶）' },
          { value: 'ba', label: 'BaCl₂ 溶液（钡）' }
        ] },
      { key: 'conc', label: '试样浓度', unit: 'mol/L', min: 0.1, max: 2.0, step: 0.1, value: 0.5 },
      { key: 'wick', label: '酒精灯灯芯伸出长度（火焰大小）', unit: 'mm', min: 2, max: 12, step: 1, value: 8 },
      { key: 'wash', label: '铂丝是否用稀盐酸洗净', unit: '', type: 'select', value: 'hcl',
        options: [
          { value: 'hcl', label: '用稀盐酸洗涤并灼烧至火焰无色（正确）' },
          { value: 'none', label: '不洗（铂丝上留有上一次试样的钠盐）' }
        ] },
      { key: 'glass', label: '观察方式', unit: '', type: 'select', value: 'cobalt',
        options: [
          { value: 'cobalt', label: '透过蓝色钴玻璃观察（检验钾的正确做法）' },
          { value: 'none',   label: '直接观察' }
        ] }
    ],
    react: function (p) { return flameTestReact(p); },
    columns: [
      { key: 'conc', label: '试样浓度', unit: 'mol/L' },
      { key: 'bright', label: '火焰本征亮度', unit: '%' },
      { key: 'wash', label: '铂丝已洗净', unit: '1=是' },
      { key: 'dur', label: '焰色持续时间', unit: 's' },
      { key: 'color', label: '实际看到的焰色', unit: '' },
      { key: 'naInterf', label: '残留钠干扰指数', unit: '' }
    ],
    graph: {
      x: 'conc', y: 'bright', fit: 'linear',
      title: '火焰亮度随试样浓度的变化（扫浓度自变量）',
      note: '亮度 ∝ 铂丝带出的试样量：浓度越大，进入火焰的金属原子越多，特征色越亮，' +
            '在 c ≤ 1.2 mol/L 左右近似线性上升，之后趋于饱和（火焰能容纳的原子数有限，' +
            '再浓也不会更亮，反而因盐块爆跳使颜色不稳）。' +
            '**两条看图注意**：① r² 只在"固定试样、固定灯芯长度、只扫浓度"时才有意义 —— ' +
            '换金属或换观察方式会在图上引入跳变点；② 纵轴用的是**本征亮度**（对应"同一根洗净的铂丝"），' +
            '"铂丝未洗"会让整条线按 0.62 的比例整体下移，故另立 wash 列，不混进这条拟合线。',
      xLabel: '试样浓度 c / mol·L⁻¹', yLabel: '火焰亮度 / %'
    },
    /* 焰色试验是**物理变化**，equation 只能是说明性文字，核心 balance() 会报"解析不了" */
    noBalance: true,
    conclude: function (rows, p) { return flameTestConclude(rows, p); },
    draw: function (g, p, state) { flameTestDraw(g, p, state); },
    cycle: 4
  });

  /* ---- 2 iron-ion-test ------------------------------------------------- */
  reg('iron-ion-test', {
    id: 'iron-ion-test',
    name: 'Fe²⁺ / Fe³⁺ 的检验（KSCN、NaOH、K₃[Fe(CN)₆]）',
    group: GROUP,
    aim: '用 KSCN 溶液、NaOH 溶液、K₃[Fe(CN)₆]（铁氰化钾）溶液检验 Fe³⁺ 与 Fe²⁺，' +
         '分清两种离子各自的判据，理解"先加 KSCN、后加氯水"这个顺序为什么不能颠倒，' +
         '并用**比色法**（定容后加 KSCN 显色）把 Fe³⁺ 的含量测出来',
    principle: 'Fe³⁺ 遇 KSCN 溶液生成血红色的 Fe(SCN)₃ 络合物 —— 这是 Fe³⁺ 最灵敏的判据；' +
               'Fe²⁺ 与 SCN⁻ **不显红色**，所以单用 KSCN 检验不了 Fe²⁺。\n' +
               'Fe²⁺ 有两条专属判据：① 加 K₃[Fe(CN)₆] 溶液生成**蓝色沉淀** ' +
               'Fe₃[Fe(CN)₆]₂（3Fe²⁺+2[Fe(CN)₆]³⁻=Fe₃[Fe(CN)₆]₂↓），最灵敏；' +
               '② 加 NaOH 溶液先生成**白色** Fe(OH)₂ 沉淀，迅速变灰绿、最后变红褐' +
               '（4Fe(OH)₂+O₂+2H₂O=4Fe(OH)₃），整个过程就是 Fe²⁺ 被空气氧化的证据。\n' +
               '还有一条"顺序法"：先滴 KSCN 溶液不变红（证明原溶液不含 Fe³⁺），再滴少量氯水变红' +
               '（2Fe²⁺+Cl₂=2Fe³⁺+2Cl⁻）—— 红色是氯水把 Fe²⁺ 氧化出来的，这才证明原溶液含 Fe²⁺。' +
               '顺序颠倒（先加氯水再加 KSCN）就分不清红色是原有的还是氧化来的。\n' +
               'Fe³⁺ 加 NaOH 生成**红褐色** Fe(OH)₃ 沉淀（Fe³⁺+3OH⁻=Fe(OH)₃↓），与 Fe²⁺ 的渐变明显不同。\n' +
               '【定量的一条】Fe³⁺ 与 SCN⁻ 生成的血红色络合物可以用来**比色测定**：' +
               '取 V_s mL 待测液移入 50.00 mL 比色管定容，再加 KSCN 显色，' +
               '管内 c(Fe³⁺) = c(原)·V_s/50.00，颜色深浅正比于管内浓度 —— ' +
               '所以"颜色读数 ∝ 取样体积"是一条过原点的直线，斜率就是该比色条件下的灵敏度。' +
               '读数接近满标后不再线性，必须稀释后重测（比色分析的"标线范围"）。',
    apparatus: ['试管（3~5 支）与试管架', '胶头滴管',
                '待测试样：新制 FeSO₄ 溶液（含 Fe²⁺）、FeCl₃ 溶液（含 Fe³⁺）',
                'KSCN 溶液', 'NaOH 溶液', 'K₃[Fe(CN)₆] 溶液', '新制氯水',
                '50.00 mL 比色管（容量瓶）+ 移液管（比色测定用）', '白纸/比色卡（衬底便于比色）'],
    steps: ['取 3 支洁净试管，各加入约 2 mL 待测试样，贴上标签',
            '第 1 支：滴加 KSCN 溶液，观察是否出现血红色 —— 变红即为 Fe³⁺',
            '第 2 支：滴加 NaOH 溶液并振荡，观察沉淀颜色及其变化（白→灰绿→红褐 还是 直接红褐色）',
            '第 3 支：滴加 K₃[Fe(CN)₆] 溶液，观察是否出现蓝色沉淀 —— 出现即为 Fe²⁺',
            '（顺序法）另取一支试管：先滴 KSCN 溶液，**不变红**；再滴少量新制氯水，**变红** → 原溶液含 Fe²⁺',
            '（比色测定）用移液管取 V_s mL 待测液移入 50.00 mL 比色管，稀释至刻度、摇匀',
            '加 KSCN 溶液显色，在**相同衬底**（白纸）下与标准色阶比色，读出颜色读数；' +
            '改变 V_s 重复几次，作"颜色读数–V_s"图（应过原点的一条直线）',
            '⚠ 检验 Fe²⁺ 必须用**新制**的 FeSO₄ 溶液：久置的溶液里 Fe²⁺ 已被空气中的 O₂ 氧化成 Fe³⁺；' +
            '⚠ 比色读数接近满标时须稀释重测，别把饱和段当成直线'],
    params: [
      { key: 'sample', label: '待测试样', unit: '', type: 'select', value: 'fe2',
        options: [
          { value: 'fe2', label: '新制 FeSO₄ 溶液（含 Fe²⁺）' },
          { value: 'fe3', label: 'FeCl₃ 溶液（含 Fe³⁺）' }
        ] },
      { key: 'test', label: '所用试剂（检验方法）', unit: '', type: 'select', value: 'kscn',
        options: [
          { value: 'kscn',     label: 'KSCN 溶液（络合显色）' },
          { value: 'naoh',     label: 'NaOH 溶液（氢氧化物沉淀法）' },
          { value: 'ferri',    label: 'K₃[Fe(CN)₆] 溶液（铁氰化钾法）' },
          { value: 'chlorine', label: '先加 KSCN、再加氯水（顺序法）' }
        ] },
      { key: 'oxidation', label: 'Fe²⁺ 被空气氧化的程度', unit: '（0=新制，1=完全氧化）', min: 0, max: 1, step: 0.05, value: 0 },
      { key: 'kscn', label: 'KSCN 溶液滴数', unit: '滴', min: 1, max: 5, step: 1, value: 2 },
      { key: 'fvol', label: '取样体积（定容到 50.00 mL 比色管）', unit: 'mL', min: 0.2, max: 5.0, step: 0.1, value: 0.5 }
    ],
    react: function (p) { return ironIonReact(p); },
    columns: [
      { key: 'fvol', label: '取样体积 V', unit: 'mL' },
      { key: 'cFlask', label: '比色管内 c(Fe³⁺)', unit: 'mol/L' },
      { key: 'color', label: '血红色深度（颜色读数）', unit: '/100' },
      { key: 'ox', label: 'Fe²⁺ 氧化程度', unit: '' },
      { key: 'vk', label: 'KSCN 滴数', unit: '滴' },
      { key: 'blue', label: '蓝色沉淀强度', unit: '/100' },
      { key: 'brown', label: '红褐色沉淀强度', unit: '/100' }
    ],
    /* 本反应的主体判据是**定性**的（有没有蓝色沉淀 / 白→灰绿→红褐的渐变），
       但"Fe³⁺ 的比色测定"本身是一条**定量的**关系，所以这里给一张**线性**的图：
       把 V_s mL 待测液定容到 50.00 mL 比色管后加 KSCN 显色，
       c(管) = c(原)·V_s/50.00，而颜色读数 ∝ c(管) ⇒ 颜色读数 ∝ V_s，是一条**过原点**的直线。
       扫自变量是"取样体积"，所以 r² 有意义（固定参数连按不扫自变量时核心会返回 fit:null）。 */
    graph: {
      x: 'fvol', y: 'color', fit: 'origin',
      title: '比色法：血红色深度随取样体积的变化（过原点直线，斜率 = 比色灵敏度）',
      note: '把 V_s mL 待测液移入 50.00 mL 比色管定容、加 KSCN 显色后，' +
            '管内的 c(Fe³⁺) = c(原)·V_s/50.00，而颜色读数正比于管内浓度，' +
            '所以 **颜色读数 ∝ V_s** —— 这是一条过原点的直线，斜率就是这套比色条件下的灵敏度。' +
            '**r² 只在"固定试样、固定 KSCN 滴数、只扫取样体积"时才有意义**；' +
            '换试样或改 KSCN 滴数会整体平移灵敏度，把两类点混在一条线上会把 r² 拉低。' +
            '⚠ **要画这条标线必须选含 Fe³⁺ 的试样**（FeCl₃ 溶液，或把"氧化程度"调大）：' +
            '新制的 FeSO₄ 溶液里没有 Fe³⁺，加 KSCN 本来就不显色（那正是 Fe²⁺/Fe³⁺ 的判据），' +
            '此时颜色读数恒为 0、画不出标线。' +
            '读数接近 100 时进入**满标（饱和）区**，那一段不再是直线，应稀释后重测 —— ' +
            '这正是比色分析"必须落在标线范围内"的原因（本台架 0.0200 mol/L 试样取到约 **1.0 mL** 即满标，' +
            '0.2~1.0 mL 这一段才是可用的线性范围）。',
      xLabel: '取样体积 V / mL', yLabel: '血红色深度（颜色读数）/ 100'
    },
    conclude: function (rows, p) { return ironIonConclude(rows, p); },
    draw: function (g, p, state) { ironIonDraw(g, p, state); },
    cycle: 5
  });

  /* ---- 3 anion-test ---------------------------------------------------- */
  reg('anion-test', {
    id: 'anion-test',
    name: 'SO₄²⁻ / Cl⁻ / CO₃²⁻ 的检验（试剂顺序与干扰排除）',
    group: GROUP,
    aim: '掌握 SO₄²⁻、Cl⁻、CO₃²⁻ 三种阴离子的检验方法，' +
         '特别是"为什么必须先加盐酸/稀硝酸酸化、再加沉淀剂"这一条试剂顺序',
    principle: '三种阴离子各有专属试剂，但**都能被别的离子模仿出相似现象**，所以顺序比试剂更重要：\n' +
               '① SO₄²⁻：取试样先滴加**足量稀盐酸**酸化，再加 **BaCl₂ 溶液**，' +
               '生成不溶于稀盐酸的**白色沉淀** BaSO₄（Ba²⁺+SO₄²⁻=BaSO₄↓）。' +
               '先酸化的目的是排除 CO₃²⁻、SO₃²⁻、Ag⁺ 的干扰：CO₃²⁻、SO₃²⁻ 与 Ba²⁺ 也生成白色沉淀，' +
               '酸化后它们变成气体跑掉；Ag⁺ 会与 Cl⁻ 生成 AgCl 沉淀。' +
               '**不能用稀硝酸代替稀盐酸**：NO₃⁻ 在酸性条件下会把 SO₃²⁻ 氧化成 SO₄²⁻' +
               '（3SO₃²⁻+2H⁺+2NO₃⁻=3SO₄²⁻+2NO↑+H₂O），本来不含 SO₄²⁻ 的试样也会出现白色沉淀（假阳性）。\n' +
               '② Cl⁻：先加**稀硝酸**酸化（排除 CO₃²⁻、SO₃²⁻ 生成的白色银盐），' +
               '再加 **AgNO₃ 溶液**，生成不溶于稀硝酸的**白色沉淀** AgCl（Ag⁺+Cl⁻=AgCl↓）。' +
               '不能用稀盐酸酸化（自己就引入 Cl⁻），也不能用稀硫酸（Ag₂SO₄ 微溶会浑浊）。\n' +
               '③ CO₃²⁻：加稀盐酸放出**无色无味**气体，把气体通入**澄清石灰水**变浑浊' +
               '（CO₃²⁻+2H⁺=H₂O+CO₂↑、CO₂+Ca²⁺+2OH⁻=CaCO₃↓+H₂O）。' +
               '⚠ HCO₃⁻ 也放出 CO₂ 并使石灰水变浑浊，是本法的主要干扰。',
    apparatus: ['试管、试管架、胶头滴管', '待测试样（Na₂SO₄ / NaCl / Na₂CO₃ 溶液）',
                '稀盐酸、稀硝酸', 'BaCl₂ 溶液', 'AgNO₃ 溶液', '澄清石灰水', '导气管、橡皮塞'],
    steps: ['（SO₄²⁻）取约 2 mL 试样于试管中，先滴加足量稀盐酸酸化，观察有无气泡（有气泡说明含 CO₃²⁻/SO₃²⁻）',
            '（SO₄²⁻）再滴加 BaCl₂ 溶液，出现白色沉淀；过滤后向沉淀上加稀盐酸，沉淀**不溶解** → 确认 BaSO₄',
            '（Cl⁻）另取试样，先滴加稀硝酸酸化，再滴加 AgNO₃ 溶液，出现白色沉淀；' +
            '向沉淀上加稀硝酸，沉淀**不溶解** → 确认 AgCl',
            '（CO₃²⁻）另取试样，滴加稀盐酸，把放出的气体通入澄清石灰水，石灰水变浑浊 → 含 CO₃²⁻',
            '⚠ 三步都要记住：**先酸化、再加沉淀剂、最后用酸验证沉淀不溶解** —— 顺序错了结论就错'],
    params: [
      { key: 'anion', label: '待检验的阴离子', unit: '', type: 'select', value: 'so4',
        options: [
          { value: 'so4', label: 'SO₄²⁻（用 BaCl₂）' },
          { value: 'cl',  label: 'Cl⁻（用 AgNO₃）' },
          { value: 'co3', label: 'CO₃²⁻（用盐酸 + 澄清石灰水）' }
        ] },
      { key: 'acid', label: '预先酸化用的酸', unit: '', type: 'select', value: 'hcl',
        options: [
          { value: 'hcl',  label: '稀盐酸（正确：既除干扰又不引入 SO₄²⁻）' },
          { value: 'hno3', label: '稀硝酸（检验 SO₄²⁻ 时会氧化 SO₃²⁻ → 假阳性）' },
          { value: 'none', label: '不加酸，直接加沉淀剂（错误）' }
        ] },
      { key: 'conc', label: '试样浓度', unit: 'mol/L', min: 0.01, max: 0.5, step: 0.01, value: 0.1 },
      { key: 'vol', label: '取样体积', unit: 'mL', min: 1.0, max: 10.0, step: 0.5, value: 2.0 }
    ],
    react: function (p) { return anionReact(p); },
    columns: [
      { key: 'vol', label: '取样体积', unit: 'mL' },
      { key: 'mmol', label: '待测离子的物质的量', unit: 'mmol' },
      { key: 'mass', label: '理论沉淀质量', unit: 'mg' },
      { key: 'falseMass', label: '干扰引入的假沉淀', unit: 'mg' },
      { key: 'pH', label: '酸化后的 pH', unit: '' }
    ],
    graph: {
      x: 'vol', y: 'mass', fit: 'origin',
      title: '沉淀质量随取样体积的变化（定比关系，过原点）',
      note: 'c 固定时 m(沉淀) = c·V·M，是一条过原点的直线，斜率 = c·M（M 为沉淀的摩尔质量）。' +
            '若把"没加酸"或"加了硝酸"的数据点一起画进来，那些点会落在直线**上方** —— ' +
            '高出来的部分就是 CO₃²⁻/SO₃²⁻ 造成的假沉淀，这正是"顺序错了结论就错"的定量证据。',
      xLabel: '取样体积 V / mL', yLabel: '沉淀质量 m / mg'
    },
    conclude: function (rows, p) { return anionConclude(rows, p); },
    draw: function (g, p, state) { anionDraw(g, p, state); },
    cycle: 4
  });

  /* ---- 4 iodine-starch ------------------------------------------------ */
  reg('iodine-starch', {
    id: 'iodine-starch',
    name: '碘与淀粉显蓝 · 碘的萃取（CCl₄ / 苯）',
    group: GROUP,
    aim: '用淀粉溶液检验碘单质（或反过来用碘水检验淀粉），并学会用 CCl₄（或苯）' +
         '把碘从水溶液中萃取出来，掌握萃取、分液的操作要点与"哪一层是有机层"的判断依据',
    principle: '① 显色：碘单质（I₂）遇到淀粉溶液会显**蓝色** —— 碘分子钻进淀粉的螺旋结构里形成包合物，' +
               '并非生成了新的化学键化合物，所以这个过程是**可逆**的：加热时蓝色褪去，冷却后蓝色恢复。' +
               '这个显色既可以用来检验 I₂，也可以反过来检验淀粉。\n' +
               '② 萃取：碘在水中的溶解度很小，在 CCl₄（或苯）中却大得多。' +
               '向碘水里加入 CCl₄ 并充分振荡，碘会按分配定律在两个互不相溶的液相之间重新分配：' +
               '萃取率 E = K_D·r / (1 + K_D·r)，其中 r = V(有机层)/V(水层)，K_D 是分配系数（CCl₄/水约 85）。' +
               '于是绝大部分碘进入有机层，有机层显紫色（紫红色），水层颜色变浅。\n' +
               '③ 分层：CCl₄ 密度 1.594 g/cm³ **大于水**，有机层在**下层**；苯密度 0.877 g/cm³ 小于水，' +
               '有机层在**上层**。分液时下层从下口放出、上层从上口倒出。',
    apparatus: ['试管、试管夹、酒精灯', '分液漏斗（使用前要检漏）、铁架台、烧杯',
                '碘水（I₂ 的饱和水溶液，呈浅黄棕色）', '淀粉溶液',
                'CCl₄（四氯化碳）、苯', '胶头滴管'],
    steps: ['（显色）向约 2 mL 淀粉溶液中滴入几滴碘水，溶液立即变蓝 —— 这是碘与淀粉的特征显色',
            '（可逆性）加热试管，蓝色褪去；冷却后蓝色重新出现，说明显色是可逆的包合过程',
            '（萃取）向约 5 mL 碘水中加入一定体积的 CCl₄（V(有机)/V(水) 可调），塞好塞子',
            '倒转分液漏斗充分振荡，**注意及时打开活塞放气**（CCl₄ 易挥发、振荡时内压升高）',
            '把分液漏斗放在铁架台上静置，待液体清晰分为两层',
            '打开上口塞子，**下层从下口放出**（CCl₄ 层在下方，呈紫红色）、上层从上口倒出，完成分液',
            '（对照）把 CCl₄ 换成苯重做一次：苯层在**上层**呈紫红色，分层顺序相反'],
    params: [
      { key: 'sample', label: '实验类型', unit: '', type: 'select', value: 'extract',
        options: [
          { value: 'extract', label: '碘的萃取（碘水 + 有机溶剂）' },
          { value: 'starch',  label: '碘与淀粉显蓝（淀粉溶液 + 碘水）' }
        ] },
      { key: 'extract', label: '萃取剂（有机溶剂）', unit: '', type: 'select', value: 'ccl4',
        options: [
          { value: 'ccl4',    label: 'CCl₄ 四氯化碳（ρ=1.594，有机层在下）' },
          { value: 'benzene', label: '苯（ρ=0.877，有机层在上）' }
        ] },
      { key: 'c0', label: '碘水浓度', unit: 'mol/L', min: 0.001, max: 0.05, step: 0.001, value: 0.01 },
      { key: 'ratio', label: 'V(有机溶剂)/V(水)', unit: '', min: 0.2, max: 3.0, step: 0.1, value: 1.0 }
    ],
    react: function (p) { return iodineReact(p); },
    columns: [
      { key: 'c0', label: '碘水浓度 c₀', unit: 'mol/L' },
      { key: 'ratio', label: 'V(有机)/V(水)', unit: '' },
      { key: 'E', label: '萃取率 E', unit: '%' },
      { key: 'cOrg', label: '有机层碘浓度', unit: 'mol/L' },
      { key: 'cW', label: '萃取后水层碘浓度', unit: 'mol/L' }
    ],
    graph: {
      x: 'ratio', y: 'E', fit: 'none',
      title: '萃取率 E 随 V(有机)/V(水) 的变化（饱和曲线，非线性）',
      note: 'E = K_D·r/(1+K_D·r) 是一条**饱和型曲线**：r 很小时 E 近似线性上升，' +
            'r 增大后逐渐趋于 100%（本台架 K_D ≈ 85，r = 0.2 时已有 94%）。' +
            '因为它是非线性曲线，这里按契约给 fit:"none"，只连点成线不做线性拟合。' +
            '**教学落点**：曲线"先陡后平"说明"少量多次"萃取比"一次用大量溶剂"更划算 —— ' +
            '把 r 调小、分多次萃取，总萃取率高于一次萃取。',
      xLabel: 'V(有机)/V(水)', yLabel: '萃取率 E / %'
    },
    /* 显色与萃取都是**物理变化**，equation 只能是说明性文字，核心 balance() 会报"解析不了" */
    noBalance: true,
    conclude: function (rows, p) { return iodineConclude(rows, p); },
    draw: function (g, p, state) { iodineDraw(g, p, state); },
    cycle: 5
  });

  /* ---- 5 acid-base-titration ------------------------------------------ */
  reg('acid-base-titration', {
    id: 'acid-base-titration',
    name: '酸碱中和滴定（滴定曲线 · 指示剂选择 · 误差分析）',
    group: GROUP,
    aim: '用已知浓度的 NaOH 标准液滴定未知浓度的盐酸：做出 pH–V(NaOH) 滴定曲线，' +
         '找出化学计量点附近的 pH 突跃，据此说明为什么强酸强碱滴定可以选酚酞或甲基橙、却不用石蕊，' +
         '并会分析各类操作误差使结果偏高还是偏低',
    principle: '中和反应的实质是 H⁺+OH⁻=H₂O。用**已知浓度的标准液**去中和一定体积的待测液，' +
               '由 c(待测)·V(待测) = c(标准)·V(标准) 就能算出待测浓度。\n' +
               '滴定过程中溶液 pH 随加入标准液体积的变化叫**滴定曲线**：\n' +
               '  计量点前（酸过量）：c(H⁺) = [c_a·V_a − c_b·V_b]/(V_a+V_b)，pH = −lg c(H⁺)；\n' +
               '  化学计量点：只余 NaCl 与水，pH 由水的电离决定（25 ℃ 时约 7.00）；\n' +
               '  计量点后（碱过量）：解 c(OH⁻)² − Δ·c(OH⁻) − K_w = 0，pH = pK_w − lg c(OH⁻)。\n' +
               '这条曲线是**S 形**的：两端平缓、化学计量点附近出现 pH **突跃**（0.1 mol/L 量级下约 ' +
               '4.3 → 9.7）。酚酞的变色区间 8.2~10.0、甲基橙 3.1~4.4 都落在突跃之内，' +
               '所以两种指示剂都能用；石蕊变色区间宽（约 5~8）且颜色是"红→紫"的渐变，终点不敏锐，' +
               '因此**中和滴定不用石蕊**。\n' +
               '温度会影响 pK_w（升温促进水的电离），所以化学计量点的 pH 并不严格等于 7.00。',
    apparatus: ['酸式滴定管（装待测盐酸）与碱式滴定管（装 NaOH 标准液，橡皮管+玻璃球）',
                '铁架台、滴定管夹', '锥形瓶（不能用待测液润洗）', '移液管/量筒',
                'NaOH 标准溶液（已知浓度）', '待测盐酸', '酚酞、甲基橙、石蕊指示剂', '白纸、洗瓶'],
    steps: ['检查滴定管是否漏液，用蒸馏水洗净后再用**待装液润洗 2~3 次**（锥形瓶只用蒸馏水洗，不能用待测液润洗）',
            '用碱式滴定管装 NaOH 标准液，赶走尖嘴处的气泡，记录初读数',
            '用移液管准确量取一定体积的待测盐酸注入锥形瓶，滴入 1~2 滴选定的指示剂',
            '锥形瓶下垫一张白纸（便于观察颜色变化），边滴边摇动锥形瓶',
            '接近终点时改为**滴加半滴**：让半滴悬在管口，用锥形瓶内壁靠下，再用蒸馏水冲下',
            '当溶液颜色突变且**半分钟内不褪色**时停止滴定，记录末读数，两次读数之差就是 V(标准)',
            '重复滴定 2~3 次，取 V(标准) 的平均值代入 c(待测) = c(标准)·V(标准)/V(待测) 计算',
            '换用另一种指示剂重做，比较两种指示剂得到的终点体积与计算结果的差别'],
    params: [
      { key: 'cb', label: 'NaOH 标准液浓度', unit: 'mol/L', min: 0.05, max: 0.2, step: 0.005, value: 0.1 },
      { key: 'ca', label: '待测盐酸浓度（真值）', unit: 'mol/L', min: 0.02, max: 0.3, step: 0.005, value: 0.1 },
      { key: 'va', label: '待测盐酸体积', unit: 'mL', min: 10.0, max: 25.0, step: 0.5, value: 20.0 },
      { key: 'indicator', label: '指示剂', unit: '', type: 'select', value: 'phen',
        options: [
          { value: 'phen',   label: '酚酞（变色区间 pH 8.2~10.0，无色→浅红）' },
          { value: 'methyl', label: '甲基橙（变色区间 pH 3.1~4.4，红→橙→黄）' },
          { value: 'litmus', label: '石蕊（变色区间宽、终点不敏锐 → 滴定不用）' }
        ] },
      { key: 'temp', label: '溶液温度（影响水的电离 pKw）', unit: '℃', min: 15, max: 40, step: 1, value: 25 },
      { key: 'step', label: '每按一次"观察"滴入的体积', unit: 'mL', min: 0.1, max: 2.0, step: 0.05, value: 0.5 }
    ],
    /* 中和滴定是**系列推进型**：每按一次"观察一次"就多滴入 step mL 并记一个 pH，
       连按几次就把滴定曲线画出来（与 pslab/mech.js 的"推进数据系列"同一语义）。
       注意：**第一次**观察时 ctx.index = 0，此时体积已经推到 step mL（不是 0），
       所以 20.00 mL 0.1 mol/L 盐酸按 0.50 mL 一步走，约 50 个点就能走完整条曲线。 */
    react: function (p, ctx) { return abReact(p, ctx); },
    columns: [
      { key: 'vb', label: 'V(NaOH) 读数', unit: 'mL' },
      { key: 'pH', label: '溶液 pH', unit: '' },
      { key: 'indV', label: '指示剂变色时 V', unit: 'mL' },
      { key: 'relErr', label: '指示剂终点相对误差', unit: '%' }
    ],
    graph: {
      x: 'vb', y: 'pH', fit: 'none',
      title: 'pH–V(NaOH) 滴定曲线（S 形，化学计量点附近有 pH 突跃）',
      note: '**为什么这里 fit 是 none、不做线性拟合** —— 滴定曲线由两段对数关系拼成：' +
            '计量点前 pH = −lg[(c_aV_a−c_bV_b)/(V_a+V_b)]、计量点后 pH = pK_w + lg[(c_bV_b−c_aV_a)/(V_a+V_b)]，' +
            '本质上是**非线性**的 S 形曲线。对它做最小二乘直线拟合，r² 只会在 0.6~0.75 徘徊，' +
            '这不是数据不准，而是用错了模型；所以按契约只连点成线、不画拟合直线。' +
            '曲线的真正信息在"突跃"上：化学计量点前后 ±0.02 mL 内 pH 就从约 4.3 跳到约 9.7，' +
            '这段陡升就是指示剂能指示终点的原因。',
      xLabel: 'V(NaOH) / mL', yLabel: '溶液 pH'
    },
    conclude: function (rows, p) { return abConclude(rows, p); },
    draw: function (g, p, state) { abDraw(g, p, state); },
    cycle: 6
  });

  /* ---- 6 kmno4-titration ---------------------------------------------- */
  reg('kmno4-titration', {
    id: 'kmno4-titration',
    name: 'KMnO₄ 滴定（自身指示剂 · 酸性条件 · 浓度计算与误差分析）',
    group: GROUP,
    aim: '用已知浓度的酸性 KMnO₄ 标准液滴定 FeSO₄ 溶液，测出 Fe²⁺ 的浓度；' +
         '掌握 KMnO₄ 滴定"自身指示剂、酸式滴定管、稀硫酸酸化、先慢后快"这四个要点，' +
         '并会由 V(KMnO₄) 定量计算 c(Fe²⁺) 与分析误差',
    principle: '酸性条件下 MnO₄⁻ 是强氧化剂，能把 Fe²⁺ 定量氧化成 Fe³⁺：\n' +
               '  MnO₄⁻ + 5Fe²⁺ + 8H⁺ = Mn²⁺ + 5Fe³⁺ + 4H₂O\n' +
               '由电子守恒：MnO₄⁻ 得 5 个电子、每个 Fe²⁺ 失 1 个电子，故 n(Fe²⁺) = 5·n(MnO₄⁻)，' +
               '于是 c(Fe²⁺) = 5·c(KMnO₄)·V(KMnO₄)/V(FeSO₄)。\n' +
               '四个要点：\n' +
               '① **自身指示剂**：MnO₄⁻ 本身呈紫红色，还原产物 Mn²⁺ 几乎无色，所以不需要另加指示剂；' +
               '终点是"滴入最后半滴后溶液呈**浅紫红色**（微红色）且**半分钟内不褪色**"。\n' +
               '② **酸式滴定管**：KMnO₄ 有强氧化性，会把碱式滴定管的橡皮管氧化腐蚀。\n' +
               '③ **稀硫酸酸化**：不能用盐酸（Cl⁻ 被氧化成 Cl₂：' +
               '2MnO₄⁻+10Cl⁻+16H⁺=2Mn²⁺+5Cl₂↑+8H₂O，多消耗标准液使结果偏高）；' +
               '不能用硝酸（本身有氧化性，会先氧化一部分 Fe²⁺，使结果偏低）；' +
               '不加酸则 MnO₄⁻ 在中性/碱性下被还原成棕色 MnO₂，计量关系改变、滴定失效。\n' +
               '④ **先慢后快**：反应生成的 Mn²⁺ 对该反应有**催化**作用（自催化），' +
               '所以第一滴褪色很慢，之后越来越快；温度过低会滴过量（标定草酸钠时通常控制在 75~85 ℃）。\n' +
               'KMnO₄ 固体难提纯、溶液见光易分解，所以标准液要**间接配制并用基准物质标定**（常用 Na₂C₂O₄）：' +
               '2MnO₄⁻ + 5C₂O₄²⁻ + 16H⁺ = 2Mn²⁺ + 10CO₂↑ + 8H₂O。',
    apparatus: ['酸式滴定管（装 KMnO₄ 标准液）', '铁架台、滴定管夹', '锥形瓶',
                'KMnO₄ 标准溶液（已用 Na₂C₂O₄ 标定）', '待测 FeSO₄ 溶液',
                '稀硫酸（3 mol/L）', '水浴（控制 75~85 ℃）、温度计、白纸'],
    steps: ['取 20.00 mL 待测 FeSO₄ 溶液于锥形瓶中，加入约 5 mL 稀硫酸酸化（**不能用盐酸或硝酸**）',
            '把 KMnO₄ 标准液装入**酸式**滴定管，赶走尖嘴气泡，记录初读数',
            '锥形瓶放在水浴中保持所需温度，边滴边摇动锥形瓶',
            '开始滴定时要**慢**（第一滴紫红色褪去很慢），随后因 Mn²⁺ 的催化作用褪色加快，可适当加快速度',
            '接近终点时改为滴加半滴，直到溶液呈**浅紫红色**且**半分钟内不褪色**，即为终点',
            '记录末读数，两次读数之差即 V(KMnO₄)；重复 2~3 次取平均值',
            '由 c(Fe²⁺) = 5·c(KMnO₄)·V(KMnO₄)/V(FeSO₄) 计算 Fe²⁺ 浓度，并作 n(Fe²⁺)–V(KMnO₄) 图检验定比关系'],
    params: [
      { key: 'cb', label: 'KMnO₄ 标准液浓度', unit: 'mol/L', min: 0.005, max: 0.05, step: 0.0005, value: 0.02 },
      { key: 'cs', label: '待测 FeSO₄ 浓度（真值）', unit: 'mol/L', min: 0.02, max: 0.2, step: 0.005, value: 0.1 },
      { key: 'vs', label: '待测 FeSO₄ 体积', unit: 'mL', min: 10.0, max: 25.0, step: 0.5, value: 20.0 },
      { key: 'acid', label: '酸化用的酸', unit: '', type: 'select', value: 'h2so4',
        options: [
          { value: 'h2so4', label: '稀硫酸（正确：只提供酸性介质，不氧化 Fe²⁺）' },
          { value: 'hcl',   label: '稀盐酸（错误：Cl⁻ 被 MnO₄⁻ 氧化，结果偏高）' },
          { value: 'hno3',  label: '稀硝酸（错误：本身氧化 Fe²⁺，结果偏低）' },
          { value: 'none',  label: '不加酸（错误：生成 MnO₂，计量关系改变）' }
        ] },
      { key: 'temp', label: '水浴温度', unit: '℃', min: 55, max: 85, step: 5, value: 75 },
      { key: 'drop', label: '"最后半滴"的体积（决定终点读数偏大多少）', unit: 'mL', min: 0.01, max: 0.05, step: 0.005, value: 0.02 },
      { key: 'step', label: '每按一次"观察"滴入的体积', unit: 'mL', min: 0.1, max: 2.0, step: 0.05, value: 0.5 }
    ],
    /* 同样是系列推进型：每观察一次就多滴入 step mL，同时记录已反应的 n(Fe²⁺)。 */
    react: function (p, ctx) { return kmReact(p, ctx); },
    columns: [
      { key: 'vb', label: 'V(KMnO₄) 读数', unit: 'mL' },
      { key: 'nMn', label: '已反应的 n(MnO₄⁻)', unit: 'mmol' },
      { key: 'nFe', label: '已氧化的 n(Fe²⁺)', unit: 'mmol' },
      { key: 'cFe', label: '测得 c(Fe²⁺)', unit: 'mol/L' },
      { key: 'rate', label: '相对反应速率（25 ℃ 为 1）', unit: '' },
      { key: 'relErr', label: '相对误差', unit: '%' }
    ],
    graph: {
      x: 'vb', y: 'nMn', fit: 'origin',
      title: '已反应的 n(MnO₄⁻)–V(KMnO₄) 图（过原点直线；到计量点后出现水平台阶）',
      note: '由 MnO₄⁻ + 5Fe²⁺ + 8H⁺ = Mn²⁺ + 5Fe³⁺ + 4H₂O 知，计量点之前 n(MnO₄⁻)_反应 = c(KMnO₄)·V(KMnO₄)，' +
            '所以是一条**过原点**的直线（斜率就是 c(KMnO₄)，单位 mmol/mL = mol/L），故用 fit:"origin"。' +
            '到达化学计量点后 Fe²⁺ 已被耗尽，再滴入的 MnO₄⁻ 不再反应 → 曲线出现**水平台阶**，' +
            '台阶拐点对应的 V 就是终点读数；同一张图上 n(Fe²⁺) = 5·n(MnO₄⁻)，所以 n(Fe²⁺) 那条线的斜率是它的 5 倍。',
      xLabel: 'V(KMnO₄) / mL', yLabel: '已反应的 n(MnO₄⁻) / mmol'
    },
    conclude: function (rows, p) { return kmConclude(rows, p); },
    draw: function (g, p, state) { kmDraw(g, p, state); },
    cycle: 6
  });

  /* ---- 7 gas-collection ---------------------------------------------- */
  reg('gas-collection', {
    id: 'gas-collection',
    name: '气体的收集与检验（H₂/O₂/CO₂/Cl₂/NH₃/SO₂）',
    group: GROUP,
    aim: '根据气体的密度与在水中溶解性选择收集方法（排水法 / 向上排空气法 / 向下排空气法），' +
         '并掌握 H₂、O₂、CO₂、Cl₂、NH₃、SO₂ 六种气体的检验方法与尾气处理',
    principle: '收集方法只有两条判据：\n' +
               '① **密度与空气比较**：比空气大 → **向上**排空气法（导管伸到集气瓶底部）；' +
               '比空气小 → **向下**排空气法。空气的平均相对分子质量为 29，' +
               '所以 M > 29 的气体用向上排空气法、M < 29 的用向下排空气法。\n' +
               '② **在水中溶解性与是否与水反应**：不溶且不反应 → 可以用**排水法**（收集到的气体较纯但带水蒸气）；' +
               '易溶或与水反应 → 绝不能用排水法。\n' +
               '本组六种气体：H₂（M=2，ρ=0.0899 g/L，难溶于水）→ 排水法 / 向下排空气；' +
               'O₂（M=32，ρ=1.429）→ 排水法 / 向上排空气；CO₂（M=44，ρ=1.977，能溶于水）→ 向上排空气；' +
               'Cl₂（M=71，ρ=3.17，与水反应）→ 向上排空气；NH₃（M=17，ρ=0.771，极易溶于水，' +
               '1 体积水约溶 700 体积）→ 只能向下排空气；SO₂（M=64，ρ=2.86，易溶于水）→ 向上排空气。\n' +
               '检验各有专属试剂：H₂ 点燃听**爆鸣声**；O₂ 用**带火星的木条**看**复燃**；' +
               'CO₂ 通**澄清石灰水**看**变浑浊**；Cl₂ 用**湿润的淀粉碘化钾试纸**看**变蓝**；' +
               'NH₃ 用**湿润的红色石蕊试纸**看**变蓝**（或用蘸浓盐酸的玻璃棒产生**白烟**）；' +
               'SO₂ 用**湿润的蓝色石蕊试纸**看**变红**（还能用品红褪色、酸性 KMnO₄ 褪色进一步区分）。\n' +
               '有毒气体（Cl₂、SO₂、NH₃）的尾气必须处理：酸性气体与 Cl₂ 用 **NaOH 溶液**吸收，' +
               'NH₃ 用水或稀酸吸收并**防倒吸**（导管口接倒置漏斗），可燃性尾气（H₂）可点燃。',
    apparatus: ['集气瓶、玻璃片', '水槽（排水法用）', '导气管、橡皮塞、试管/锥形瓶（发生装置）',
                '带火星的木条', '澄清石灰水', '湿润的淀粉碘化钾试纸', '湿润的红色石蕊试纸、湿润的蓝色石蕊试纸',
                '浓盐酸（蘸玻璃棒验 NH₃）', 'NaOH 溶液（尾气吸收）、倒置漏斗'],
    steps: ['先看气体的相对分子质量与在水中溶解性，确定收集方法（排水 / 向上 / 向下排空气）',
            '按所选方法连好装置：排空气法时导管口要伸到集气瓶**底部**；排水法时导管口放在瓶口附近',
            '排水法要等气泡**连续均匀**冒出后再开始收集（最初排出的气体含装置里的空气）',
            '收集一段时间后验满：用对应的检验方法在**瓶口**（或瓶内）检验',
            '有毒气体的尾气接入吸收装置（Cl₂/SO₂ 用 NaOH 溶液、NH₃ 用水并防倒吸）',
            '记录收集到的体积与纯度，判断收集方法是否与气体性质匹配'],
    params: [
      { key: 'gas', label: '待收集的气体', unit: '', type: 'select', value: 'co2',
        options: [
          { value: 'h2',  label: 'H₂（M=2，ρ=0.0899 g/L，难溶于水）' },
          { value: 'o2',  label: 'O₂（M=32，ρ=1.429 g/L，不易溶于水）' },
          { value: 'co2', label: 'CO₂（M=44，ρ=1.977 g/L，能溶于水）' },
          { value: 'cl2', label: 'Cl₂（M=71，ρ=3.17 g/L，与水反应）' },
          { value: 'nh3', label: 'NH₃（M=17，ρ=0.771 g/L，极易溶于水）' },
          { value: 'so2', label: 'SO₂（M=64，ρ=2.86 g/L，易溶于水）' }
        ] },
      { key: 'method', label: '收集方法', unit: '', type: 'select', value: 'up',
        options: [
          { value: 'water', label: '排水法（适用于不溶于水且不与水反应的气体）' },
          { value: 'up',    label: '向上排空气法（适用于密度比空气大的气体）' },
          { value: 'down',  label: '向下排空气法（适用于密度比空气小的气体）' }
        ] },
      { key: 'tail', label: '尾气处理方式', unit: '', type: 'select', value: 'naoh',
        options: [
          { value: 'naoh',  label: 'NaOH 溶液吸收（酸性气体 / Cl₂ / SO₂）' },
          { value: 'water', label: '水吸收并防倒吸（NH₃，导管口接倒置漏斗）' },
          { value: 'burn',  label: '点燃（H₂ 等可燃性尾气）' },
          { value: 'vent',  label: '直接排入空气（有毒气体不可用）' }
        ] },
      { key: 'time', label: '收集时间', unit: 's', min: 10, max: 60, step: 5, value: 30 },
      { key: 'temp', label: '室温', unit: '℃', min: 5, max: 35, step: 1, value: 25 }
    ],
    react: function (p) { return gcReact(p); },
    columns: [
      { key: 'vol', label: '收集到的体积', unit: 'mL' },
      { key: 'purity', label: '气体纯度', unit: '%' },
      { key: 'match', label: '收集方法匹配度', unit: '%' },
      { key: 't', label: '收集时间', unit: 's' }
    ],
    graph: {
      x: 't', y: 'purity', fit: 'linear',
      title: '气体纯度随收集时间的变化（扫收集时间自变量）',
      note: '同一收集方法下，收集时间越长瓶内的空气/水蒸气被排得越干净，纯度上升；' +
            '但这是**趋于饱和**的上升（纯度上限由"收集方法与气体性质是否匹配"决定），' +
            '所以取的时间窗口越宽、曲线越显弯，r² 越低 —— **r² 必须连同"扫了多宽的自变量"一起看**：' +
            '只扫 10~30 s 这种早期段时接近直线（r² 高），一直扫到 60 s 就会看到明显的饱和弯曲。' +
            '中途改收集方法或换气体会引入跳变点，r² 会明显下降，那正是"方法不匹配"的证据。',
      xLabel: '收集时间 t / s', yLabel: '气体纯度 / %'
    },
    conclude: function (rows, p) { return gcConclude(rows, p); },
    draw: function (g, p, state) { gcDraw(g, p, state); },
    cycle: 5
  });

  /* ---- 8 so2-properties ---------------------------------------------- */
  reg('so2-properties', {
    id: 'so2-properties',
    name: 'SO₂ 的性质（漂白性 · 还原性 · 酸性氧化物 · 氧化性）',
    group: GROUP,
    aim: '把 SO₂ 分别通入品红溶液、酸性 KMnO₄ 溶液、湿润的蓝色石蕊试纸、H₂S 溶液、' +
         '氯水与 NaOH 溶液，由不同现象归纳 SO₂ 的四类性质，' +
         '并分清"SO₂ 的漂白"与"氯水的漂白"本质不同',
    principle: 'SO₂ 中硫为 +4 价，处于中间价态，既有氧化性又有还原性；同时它是亚硫酸的酸酐，' +
               '是典型的**酸性氧化物**。四条性质与对应现象：\n' +
               '① **酸性氧化物**：SO₂ + H₂O ⇌ H₂SO₃（亚硫酸，中强酸），' +
               '故能使**湿润的蓝色石蕊试纸变红**（但**不会褪色**）；' +
               '与碱反应 SO₂ + 2NaOH = Na₂SO₃ + H₂O（实验室用它吸收尾气）。\n' +
               '② **漂白性**：SO₂ 与品红等有色物质**化合**生成不稳定的无色物质，' +
               '所以品红溶液褪色后**加热红色会恢复**（可逆）；' +
               '这与氯水、漂白粉、Na₂O₂ 的**氧化型**漂白（把有色物质氧化破坏、不可逆）本质不同。' +
               'SO₂ 不能使石蕊褪色，只能使它变红。\n' +
               '③ **还原性**：+4 价的硫可被氧化到 +6 价。' +
               '能被 O₂ 氧化（2SO₂+O₂ ⇌ 2SO₃，催化剂、加热），' +
               '能使**酸性 KMnO₄ 溶液褪色**（5SO₂+2KMnO₄+2H₂O=K₂SO₄+2MnSO₄+2H₂SO₄），' +
               '能使**氯水/溴水褪色**（SO₂+Cl₂+2H₂O=H₂SO₄+2HCl —— 两者混合后漂白能力都消失），' +
               '也能把 Fe³⁺ 还原（2Fe³⁺+SO₂+2H₂O=2Fe²⁺+SO₄²⁻+4H⁺）。\n' +
               '④ **氧化性**：遇到更强的还原剂（如 H₂S）时 +4 价的硫降到 0 价：' +
               'SO₂ + 2H₂S = 3S↓ + 2H₂O，出现**淡黄色沉淀**。\n' +
               'SO₂ 有刺激性气味、有毒，是形成硫酸型酸雨的主要污染物，尾气必须用 NaOH 溶液吸收。',
    apparatus: ['SO₂ 发生装置（Na₂SO₃ 固体 + 浓硫酸，或铜片 + 浓硫酸加热）',
                '试管若干、导气管、橡皮塞', '品红溶液', '酸性 KMnO₄ 溶液',
                '湿润的蓝色石蕊试纸', 'H₂S 溶液（氢硫酸）', '氯水（或溴水）',
                'NaOH 溶液（尾气吸收）、酒精灯（加热褪色后的品红溶液）'],
    steps: ['按装置图连好仪器，检查气密性，最后接尾气吸收（NaOH 溶液）',
            '在 A 中制取 SO₂（Na₂SO₃ 固体滴加浓硫酸），控制通气速度',
            '装置 B 放品红溶液：观察到红色褪去 → 漂白性；把褪色后的溶液**加热**，红色恢复 → 说明漂白可逆',
            '装置 C 放酸性 KMnO₄ 溶液：紫红色褪去 → 还原性（SO₂ 被氧化成 SO₄²⁻）',
            '装置 D 放 H₂S 溶液：出现淡黄色沉淀 → 氧化性（SO₂+2H₂S=3S↓+2H₂O）',
            '另取湿润的蓝色石蕊试纸放在管口：试纸**变红但不褪色** → 酸性氧化物（H₂SO₃ 显酸性）',
            '把 SO₂ 通入氯水：黄绿色褪去 → 还原性（SO₂+Cl₂+2H₂O=H₂SO₄+2HCl）',
            '实验结束：尾气通入 NaOH 溶液吸收，防止污染空气'],
    params: [
      { key: 'reagent', label: '把 SO₂ 通入的试剂（验证哪种性质）', unit: '', type: 'select', value: 'fuchsin',
        options: [
          { value: 'fuchsin',  label: '品红溶液（漂白性，加热可恢复红色）' },
          { value: 'kmno4',    label: '酸性 KMnO₄ 溶液（还原性，紫红色褪去）' },
          { value: 'litmus',   label: '湿润的蓝色石蕊试纸（酸性氧化物，变红不褪色）' },
          { value: 'h2s',      label: 'H₂S 溶液（氧化性，析出淡黄色硫）' },
          { value: 'chlorine', label: '氯水（还原性，黄绿色褪去）' },
          { value: 'naoh',     label: 'NaOH 溶液（酸性氧化物，也是尾气处理）' }
        ] },
      { key: 'conc', label: '通入的 SO₂ 浓度', unit: 'mol/L', min: 0.02, max: 0.5, step: 0.01, value: 0.1 },
      { key: 'time', label: '通气时间', unit: 's', min: 2, max: 40, step: 1, value: 10 },
      { key: 'humid', label: '环境相对湿度（影响试纸类）', unit: '%', min: 0, max: 100, step: 5, value: 60 }
    ],
    react: function (p) { return so2React(p); },
    columns: [
      { key: 'conc', label: 'SO₂ 浓度', unit: 'mol/L' },
      { key: 'fade', label: '品红褪色率', unit: '%' },
      { key: 'absorb', label: '吸收量（表观）', unit: 'mmol' },
      { key: 'pH', label: '对应溶液 pH', unit: '' },
      { key: 'litmus', label: '石蕊变红程度', unit: '/100' }
    ],
    graph: {
      x: 'conc', y: 'fade', fit: 'linear',
      title: '品红褪色率随 SO₂ 浓度的变化（扫浓度自变量）',
      note: '在通气时间固定时，褪色率随 SO₂ 浓度先线性上升、后趋于饱和（100% 就是"完全褪为无色"）。' +
            '**r² 只在固定通气时间、只扫浓度时才有意义**：浓度跨到饱和段以后，' +
            '点会弯下来、r² 下降，那说明该段已经不是线性区，应缩小浓度范围重测。',
      xLabel: 'c(SO₂) / mol·L⁻¹', yLabel: '品红褪色率 / %'
    },
    /* 选"品红溶液"这一档时，equation 只能是定性说明（加合物没有固定组成），
       核心的 balance() 对它只会报"解析不了"。这里显式声明，避免被误判成"配不平"。 */
    noBalance: true,
    conclude: function (rows, p) { return so2Conclude(rows, p); },
    draw: function (g, p, state) { so2Draw(g, p, state); },
    cycle: 6
  });
})();
