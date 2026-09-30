/* ============================================================================
 * 穷观 · 化学实验台（Chemistry Lab Bench）· 可嵌入模块
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 「观澜」化学模式的第二块（第一块是 js/psandbox.js 物理符号沙盒，参照实现是
 *  js/pslab.js 物理实验台）。沙盒 = 玩符号；实验台 = 做实验：
 *   选试剂 → 调条件 → 看现象 → 写方程式 → 得结论。
 * 与物理实验台**同架构、同观感、同工程约束**，差别只在「测量」换成「现象」。
 *
 * 本文件是**可嵌入模块**，页面加载它本身**不建任何 DOM、不起任何循环**：
 * 只有 mount(container) 之后才建三栏实验台；unmount()/close() 之后连 #clCSS
 * 一起撤干净。非化学科目下 demo.js 连入口按钮都不建，所以非化学科目里**不会**
 * 出现任何 cl- 前缀节点、也不会注入 #clCSS（硬约束，别破坏）。
 * 纯 ES5、零外部依赖、不用网络、不用 eval / Function 构造器（守观澜的严格 CSP）。
 *
 * ---------------------------------------------------------------------------
 * ★ 观察语义：**独立观察**（与物理的某些实验刻意不同，别照抄物理的"系列推进"）
 *   react(n) = 按**当前参数**独立地做 n 次反应/观察，每次都是一次完整的、互相
 *   独立的实验；返回 n 条新增的现象行。核心**不做**"第 k 次调用就推进到时间轴
 *   第 k 个点"这种事：只有 setParam 改了条件，结果才会按化学规律变。
 *   想让某次观察带上序号/时间（例如"出现浑浊需要的时间"），请自己在 react 里用
 *   ctx.index（第几次，从 0 起）与 ctx.t（本实验台时钟，秒）算并写进 measures。
 *   探针判据随之不同：**固定参数下连测几次不该期望 r²>0.9** —— 那是"同一个点附近
 *   的散布"，r² 只有在**扫自变量**（改条件）时才有意义（照抄物理 §9 的两条事实）。
 *
 * ---------------------------------------------------------------------------
 * 对外接口 window.QG_CLAB（设计契约 docs/化学实验台设计.md §3）：
 *   register(id, spec)      各组模块登记反应（组脚本只做这一件事，不自建 DOM）
 *   mount(el, opts)         往 el 里建三栏实验台；opts={onUnmount:fn}
 *   unmount()               拆掉 DOM / 全局事件 / rAF（保留当前反应会话）
 *   isMounted()             是否已挂载
 *   list()                  [{id,name,group}, ...]
 *   open(id)                打开反应（等于左栏点击）；返回 true/false
 *   close()                 退出实验台（拆 DOM 并清掉会话）；返回是否真的关了
 *   current()               {id,name,group,params,rows,conclusion} | null
 *   setParam(key, value)    设条件（夹到 min/max，按 step 吸附；**不动现象表**）
 *   react(n)                独立地做 n 次观察（默认 1），返回新增的现象行
 *   clear()                 清空现象表与图像
 *   table()                 现象表快照（行数组：第几次/现象/方程式/条件/量化列）
 *   graph()                 纯定性反应返回 **null**（合法）；有定量列返回
 *                           {points:[{x,y}], fit:{a,b,r2}|null, xLabel, yLabel, title, note, skipped}
 *   concluded()             {text, equation, ionic, errors[]} | null
 *   run(seconds)            推进仿真 seconds 秒（固定步长 1/60）
 *   state()                 {open,id,name,group,running,t,rows,canvas:{w,h},warnings,
 *                            drawErrors/reactErrors/errorCounts,…}
 *   audit()                 全部已登记反应的体检结论（参数 + 结构 + 静态遮蔽 + 配平）
 *   balance(eq)             ★ 方程式配平校验：逐元素 + 电荷守恒；不配平会指出哪个元素
 *   drawErrorCount(id)      运行时：穿过 spec.draw 的异常次数（自本次挂载以来）
 *   reactErrorCount(id)     运行时：spec.react 抛的异常次数（核心吞掉、不出行、不抛给调用方）
 *   shadowAudit(mode)       静态：'var-called'（变量遮蔽）| 'empty-catch'（只列不判）
 * 附加（排障/自检用）：spec(id) / groups() / params() / columns() / build / version / resize() /
 *   running() / play() / pause() / debug() / errorCounts(id) / isChemSubject()。
 *
 * ★ **react() 绝不把异常冒给调用方**（UI 路径与 API 路径一个待遇）：
 *   组的 react() 抛错（例：组 1 的 precipitate-convert 在"等物质的量"边界抛
 *   TypeError: Cannot read properties of null (reading 'toExponential')）→ 核心捕获、
 *   noteError 计数（reactErrorCount / state().reactErrors）、写 state().lastError、
 *   **只 console.warn 一次** → **这一次不出行**（坏的那几次少几行，行号仍连续）→
 *   返回数组、**不抛**。原因：一个边界数值问题不该让 QG_CLAB.react() 把异常摔到
 *   探针或学生脸上；而"抛出去了"在修前是**完全看不见**的（没有计数、没有 lastError）。
 *
 * react(n) 的返回值（刻意做成两种读法都能用，契约 §4.1 就是按"react() 返回的
 * phenomena 非空"写的）：
 *   · 永远先是一个**数组**（长度 = 本次新增的行数）——react(6)[0].phenomena 可用；
 *   · 同时把**最后一行**的字段（phenomena/equation/ionic/type/conditions/measures）
 *     挂到数组对象上——react().phenomena 也可用（n=1 时两者完全等价）。
 *   这样"n 条独立观察"与"一次观察"两种读法都不会踩空。
 *
 * ---------------------------------------------------------------------------
 * 给**组模块作者**的四条（照抄物理实验台 §9 的四条真实约定，别绕开）：
 *   ① null = "这次观察在这张图上没有有效值"，**不是 0**。核心的 coordOf() 把
 *      null / undefined / 空串视为缺值：该行不进图、也不进 fit 的 r²（图下注明
 *      "已跳过 N 个在这张图上无有效值的点"）；现象表里显示「—」。**真实的 0
 *      照常进图**（别用 0 表示"没测到"）。
 *   ② g.font(size, …) 是**宽容签名**，四种写法都行：
 *        g.font(13)                   → 斜体衬线（默认，纸色观感）
 *        g.font(13, true|false)       → 布尔 = 是否斜体
 *        g.font(13, 'italic bold')    → 字符串 = 原样拼进字体串（仍会校验合法性）
 *        g.font(13, italic, bold)     → 三参布尔形式
 *      **不要**把 true/false 拼进自己拼的字体串：非法 font 会让 canvas 静默退回
 *      默认字体（观感整体丢失，而像素签名照样在变，肉眼与探针都难发现）。核心用
 *      "哨兵回读"校验（先写 37px monospace 再写待校验串，回读里若还带哨兵即非法）。
 *   ③ 滑块 step 会被**归一化**（未写 → 0.01；显式 step<=0、step>量程、step==量程
 *      且两端非 0 → 改用 (max-min)/100 并记 warning），register 时做一次参数体检：
 *      key 唯一 / min<max / value 落在 [min,max] / step 合理。**不合格只 warn 不拒收**，
 *      warning 进 state().warnings，也可用 QG_CLAB.audit() 一次看全。
 *   ④ **没有 min/max 的条件参数必须写成 `type:'select'` + `options`**（例：温度档位、
 *      催化剂种类、电解质类型），否则会退回 0..100 的滑块，根本选不到想要的取值。
 *      核心对这类参数渲染 <select>，setParam(key,value) 按**选项原值**匹配。
 *      真的既没有 min/max 又不想给选项时，核心渲染成数字输入框并记一条 warning。
 *
 * 关于 balance(eq)（化学里唯一客观的对错判据，务必做对）：
 *   · 支持 = / ⇌ / → / -> / --> / =条件= / --条件--> 等反应号；
 *   · 支持系数、括号嵌套（Ca(OH)2、Al2(SO4)3、[Cu(NH3)4]2+）、结晶水与水合物
 *     （CuSO4·5H2O、Na2CO3·10H2O、**NH3·H2O**（人教版标准写法，`·` 后面没有数字））、
 *     上下标（H₂O / SO₄²⁻）、↑↓ / (g)(s)(l)(aq) 状态符号、全角＝＋－、
 *     汉字括注（HNO3(浓)）、电子 e-、**减电子写法**（Cu - 2e- = Cu2+、2H2O - 4e- = O2 + 4H+）、
 *     结构式键（CH2=CH2 / CH≡CH / CH3-CH2-OH / 带空格的 CH3 - CH2 - OH）、
 *     **高分子聚合度 n**（nC2H4 = (C2H4)n、(C6H10O5)n + nH2O = nC6H12O6 —— n 按 1 记账，
 *     等价于"两边同乘一个符号"的守恒；真实组文件就是这么写的）；
 *   · **多步方程式逐段校验**：`A = B；C = D`（`;` / `；` / `｜` / `|` 分隔）——
 *     全 ok 才算 ok；某段不配平就在 reason 里指明「第 k 段：…」，明细在 segments[]；
 *     电极写法 `阳极：Cu - 2e- = Cu2+ ｜ 阴极：…` 也按段切开并先剥掉「标签：」。
 *   · 逐元素核对守恒 + **电荷守恒**；不守恒时返回 bad[]（元素名/电荷）与中文 reason；
 *   · 系数有公约数 / 出现分数时不算"不配平"（守恒优先），另给 minimal/note 提示。
 *   ★ status 四档（界面据此决定"标红 / 黄字 / 中性灰字"，**别一律标红**）：
 *     'ok'          已配平；
 *     'unbalanced'  **解析出来了但不守恒** → 界面标红 + 写明哪个元素/电荷（契约要的那条）；
 *     'unparsed'    有反应号但某一侧解析不了（写法太怪）→ 黄字提示；
 *     'no-equation' 压根没有反应号 —— 焰色试验、碘的萃取、SO2 与品红的加合物这类
 *                   **本来就没有化学方程式**的物理变化，组里会老实写"无化学方程式（…）"，
 *                   这时给中性灰字、**不记 warning**（不许把它当成"未配平"来羞辱）。
 *
 * ★ 关于 graph() 的 r²（**只有 y 非常数、且 x 有分布时才可用**）：
 *   · x 没有分布（点都在同一条竖直线上）→ `fit: null`（与物理核心 fitLinear 同口径）；
 *   · **y 几乎不变（ssTot≈0）→ `fit: null`**：旧实现在这里返回 **r²=1**，那是**假绿** ——
 *     验收探针只要查 "r²>0.9" 就会把"根本没变化的数据"判成完美线性（实测命中过
 *     iron-ion-test 默认试样颜色恒 0）。现在返回 null，并在 `graph().degenerate=true`
 *     与 `graph().fitNote` 里说明原因（UI 图上也会写出来）。
 *   · 固定条件下重复观察得到的只是"同一个点附近的散布"，r² 只在**扫自变量**时才有意义。
 *
 * 两条"防静默缺画面"的闸门（照抄物理实验台 AGENTS §13 那套，化学这边同样需要）：
 *   QG_CLAB.drawErrorCount(id)         运行时：**穿过 spec.draw 这一层**的异常次数
 *                                      （自本次挂载以来；state() 里是 drawErrors/drawErrorsTotal）
 *                                      ⚠ 覆盖不到"组内自己 catch"的异常 —— 原理性上限，别指望它。
 *   QG_CLAB.shadowAudit('var-called')  静态：局部 var 被当函数调用（变量遮蔽）—— 真正能对它报红的
 *                                      （'empty-catch' 只列不判；结果也进 audit()[].suspects/emptyCatch）
 *   两条都做过负对照（注入 var scratch=1; scratch(2) → shadowAudit 报红、drawErrorCount 涨）。
 * ========================================================================== */
(function () {
  'use strict';

  var BUILD = 'QG-20260920-5e5d5a';
  var VERSION = '1.0.0';
  var CSS_ID = 'clCSS';
  var PAPER = '#F4F1EA';         // 实验台纸色（与物理实验台/沙盒同一张台面）
  var INK = '#26221C';           // 墨色
  var GRAPH_PAPER = '#F4F1EA';   // 小图像也是同一张纸
  var STEP = 1 / 60;             // run() 的固定步长
  var DEFAULT_CYCLE = 4;         // state.phase 的默认周期（秒）
  var MAX_REACT_PER_CALL = 500;
  var EPS = 1e-12;
  var TOL = 1e-9;                // 元素/电荷守恒的容差（系数允许 0.5 这种写法）

  /* 六组的展示顺序（契约 §2）。未列出的组按注册先后排在后面。 */
  var GROUP_ORDER = [
    '离子反应与溶液平衡', '金属与非金属单质', '有机反应',
    '电化学', '反应速率与平衡', '物质检验·分离·定量'
  ];

  /* ------------------------------------------------------------------ *
   * 小工具                                                              *
   * ------------------------------------------------------------------ */
  function isFn(f) { return typeof f === 'function'; }
  function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function warn(msg) {
    try { if (window.console && window.console.warn) window.console.warn('[QG_CLAB] ' + msg); } catch (e) { /* 忽略 */ }
  }
  function cel(tag, cls, txt) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt !== undefined && txt !== null) d.textContent = String(txt);
    return d;
  }
  function clr(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function clone(o) {
    var r = {}, k;
    for (k in o) { if (has(o, k)) r[k] = o[k]; }
    return r;
  }
  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : d;
  }
  function pushOnce(arr, key, msg) {
    var i;
    for (i = 0; i < arr.length; i++) if (arr[i].key === key) return false;
    arr.push({ key: key, msg: msg });
    return true;
  }
  function textsOf(a) {
    var out = [], i;
    for (i = 0; i < a.length; i++) out.push(a[i].msg);
    return out;
  }
  /* 表格/图上的数字格式化：整数原样，普通数最多 4 位小数，极大极小走科学计数 */
  function fmtNum(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'string') return v;
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e5 || a < 1e-3) return n.toExponential(3);
    var s = n.toFixed(4);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  /* 图线取坐标：返回数字，或 null 表示"这一行在这个轴上没有有效值"。
     **不能写成 Number(v)** —— Number(null) === 0、Number('') === 0，会把"这次观察
     在这张图上没有意义"伪装成真实的 0。真实的零（x=0 / y=0）照常返回 0。 */
  function coordOf(row, key) {
    var v = row ? row[key] : null;
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  /* 选项型条件（type:'select' + options）：值可以是字符串（催化剂 'MnO2'）或数字 */
  function isSelectParam(d) {
    return !!(d && d.type === 'select' && isArr(d.options) && d.options.length);
  }
  function optionOf(d, value) {
    var i, o;
    for (i = 0; i < d.options.length; i++) {
      o = d.options[i];
      if (!o) continue;
      if (o.value === value || String(o.value) === String(value)) return o;
    }
    return null;
  }
  function hasRange(d) {
    return isFinite(num(d && d.min, NaN)) && isFinite(num(d && d.max, NaN)) && num(d.max, NaN) > num(d.min, NaN);
  }
  /* 学科判据（与 psandbox/pslab 同一套写法，不发明新键）：供 demo.js 接线时用，
     核心自己**不**用它拦 mount —— 与物理实验台保持一致（门关在 demo.js 的入口处）。 */
  function isChemSubject() {
    try {
      if (typeof window.CUR_SUBJECT === 'string' && window.CUR_SUBJECT) return window.CUR_SUBJECT === 'chem';
      var s = '';
      try { s = window.localStorage ? window.localStorage.getItem('qg_subject') : ''; } catch (e1) { s = ''; }
      if (s) return s === 'chem';
      var live = '';
      try { live = window.localStorage ? window.localStorage.getItem('qg_live_state') : ''; } catch (e2) { live = ''; }
      if (live) {
        var o = null;
        try { o = JSON.parse(live); } catch (e3) { o = null; }
        if (o && typeof o === 'object' && o.subject) return o.subject === 'chem';
      }
    } catch (e) { /* 读不到 = 非化学 */ }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * 字体串：给组作者一个**宽容签名**（与物理实验台同一份实现）            *
   *   g.font(size)                     默认斜体衬线                     *
   *   g.font(size, true|false)         布尔 = 是否斜体                   *
   *   g.font(size, 'italic bold')      字符串 = 原样拼接（仍校验合法性） *
   *   g.font(size, italic, bold)       三参（布尔形式）                   *
   * 为什么必须宽容：把 true/false 直接拼进字体串会得到 "true 13px Georgia"
   * 这种**非法字体串**，canvas 会**静默退回默认字体**，"纸色斜体"的观感整体丢失，
   * 而像素签名照样在变，肉眼与探针都抓不到。现在：绝不把 true/false/undefined
   * 拼进串里，且最终串一律过 fontOK() 校验（哨兵回读）。
   * ------------------------------------------------------------------ */
  var FONT_FAMILY = 'Georgia,"Times New Roman",serif';
  var fontProbe = null, fontCache = {}, fontCacheN = 0;
  function fontOK(s) {
    try {
      if (typeof document === 'undefined' || !document.createElement) return false;
      if (!fontProbe) {
        var c = document.createElement('canvas');
        fontProbe = c && c.getContext ? c.getContext('2d') : null;
      }
      if (!fontProbe) return false;
      fontProbe.font = '37px monospace';    // 哨兵：只用来判断"下一次赋值有没有被静默忽略"
      fontProbe.font = s;
      var back = String(fontProbe.font || '');
      return back.length > 0 && back.indexOf('37px monospace') < 0;
    } catch (e) { return false; }
  }
  function fontCss(size, a, b) {
    var px = Number(size);
    if (!isFinite(px) || px <= 0) px = 14;
    px = Math.round(px * 100) / 100;
    var plain = px + 'px ' + FONT_FAMILY;
    var key = px + '|' + (a === undefined ? '' : String(a)) + '|' + (b === undefined ? '' : String(b));
    if (has(fontCache, key)) return fontCache[key];
    var out = plain, raw, safe, s;
    if (typeof a === 'string') {
      raw = a.replace(/^\s+|\s+$/g, '');
      if (raw) {
        s = raw + ' ' + plain;
        if (fontOK(s)) out = s;
        else {
          safe = raw.replace(/[^a-zA-Z0-9 %\-]/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
          s = safe ? (safe + ' ' + plain) : plain;
          out = fontOK(s) ? s : plain;
        }
      }
    } else {
      var italic = true, bold = false;
      if (typeof a === 'boolean') italic = a;
      else if (typeof a === 'number') italic = !!a;
      if (typeof b === 'boolean') bold = b;
      else if (typeof b === 'number') bold = !!b;
      s = (italic ? 'italic ' : '') + (bold ? 'bold ' : '') + plain;
      out = fontOK(s) ? s : plain;
    }
    fontCacheN++;
    if (fontCacheN > 256) { fontCache = {}; fontCacheN = 0; }
    fontCache[key] = out;
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 参数体检与 step 归一化（register 时做一次，结果存进 META[id]）        *
   *   · 未写 step / step 非数      → 0.01（量程比它还小则用 span/100）    *
   *   · 显式 step <= 0             → span/100（没有 min/max 时用 1），记 warning
   *   · step > 量程 span            → span/100，记 warning                 *
   *   · step == span 且两端非 0     → span/100，记 warning（0..1 step1 放行）*
   *   · 既没有 min/max 又不是 select → 渲染成数字输入框，记 warning（约定 ④）*
   * 为什么必须管：step 不合理时滑块会停在一串无意义的刻度上，**而且没有任何提示**。*
   * ------------------------------------------------------------------ */
  function normStep(d) {
    var lo = num(d.min, NaN), hi = num(d.max, NaN);
    var ok = isFinite(lo) && isFinite(hi) && hi > lo;
    var span = ok ? (hi - lo) : NaN;
    var raw = num(d.step, NaN);
    if (!isFinite(raw)) {
      if (ok && 0.01 > span) return { step: span / 100, warn: '' };
      return { step: 0.01, warn: '' };
    }
    if (!(raw > 0)) return { step: ok ? span / 100 : 1, warn: 'step 非正（' + raw + '）' };
    if (ok && (raw > span || (raw === span && lo !== 0 && hi !== 0))) {
      return { step: span / 100, warn: 'step（' + raw + '）与量程 [' + lo + ',' + hi + '] 不匹配' };
    }
    return { step: raw, warn: '' };
  }
  /* 参数体检：key 唯一 / min<max / value 落在 [min,max] / step 合理 / 无 min-max 必须
     写成 select。不合格**不静默吞掉** —— 走 warn() 通道，同时原样留在
     state().warnings 里可查（契约 §4.8 要求组的 spec 做到 0 警告）。 */
  function paramAudit(id, spec) {
    var steps = {}, warns = [], seen = {}, i, k, d, lo, hi, v, ns;
    if (!isArr(spec.params)) return { steps: steps, warnings: warns };
    for (i = 0; i < spec.params.length; i++) {
      d = spec.params[i];
      if (!d || !d.key) { warns.push('params[' + i + '] 缺少 key（该条件已忽略）'); continue; }
      k = String(d.key);
      if (has(seen, k)) { warns.push('参数 ' + k + '：key 重复（只有第一处生效）'); continue; }
      seen[k] = 1;
      if (isSelectParam(d)) {
        if (!optionOf(d, d.value)) warns.push('参数 ' + k + '：value（' + d.value + '）不在 options 里');
        continue;
      }
      lo = num(d.min, NaN); hi = num(d.max, NaN);
      if (isFinite(lo) && isFinite(hi)) {
        if (!(hi > lo)) warns.push('参数 ' + k + '：min（' + lo + '）必须小于 max（' + hi + '）');
        else {
          v = num(d.value, NaN);
          if (isFinite(v) && (v < lo || v > hi)) warns.push('参数 ' + k + '：value（' + v + '）不在 [' + lo + ',' + hi + '] 内');
        }
      } else {
        warns.push('参数 ' + k + '：既没有 min/max 也不是 type:\'select\'（约定 ④ 要求这种参数写成下拉框；' +
          '现在退化成数字输入框）');
      }
      ns = normStep(d);
      steps[k] = ns.step;
      if (ns.warn) warns.push('参数 ' + k + '：' + ns.warn + ' → 已改用 step = ' + ns.step);
    }
    return { steps: steps, warnings: warns };
  }
  /* 结构体检：有定量列就必须能作图（graph 的 x/y 必须是 columns 里的 key） */
  function structAudit(id, spec) {
    var warns = [], i, c, keys = {}, g = spec.graph;
    if (!isArr(spec.columns)) warns.push('缺少 columns 数组（纯定性反应请老实写 columns: []）');
    else {
      for (i = 0; i < spec.columns.length; i++) {
        c = spec.columns[i];
        if (!c || typeof c.key !== 'string' || !c.key) { warns.push('columns[' + i + '] 缺少 key'); continue; }
        if (has(keys, c.key)) warns.push('columns 里 key 重复：' + c.key);
        keys[c.key] = 1;
      }
      if (spec.columns.length && !g) {
        warns.push('给了 ' + spec.columns.length + ' 个定量列却没有 graph —— 契约要求"有定量列就必须能作图"（纯定性请写 columns: [] + graph: null）');
      }
    }
    if (g) {
      if (!g.x || !g.y) warns.push('graph 必须同时给 x 与 y（列的 key）');
      else {
        if (!has(keys, g.x)) warns.push('graph.x（' + g.x + '）不在 columns 里');
        if (!has(keys, g.y)) warns.push('graph.y（' + g.y + '）不在 columns 里');
      }
    }
    if (!isFn(spec.react)) warns.push('缺少 react(p, ctx) 函数');
    if (!isFn(spec.conclude)) warns.push('缺少 conclude(rows, p, ctx) 函数');
    if (!isFn(spec.draw)) warns.push('缺少 draw(g, p, state) 函数（中栏实验台会画不出东西）');
    return warns;
  }
  /* ------------------------------------------------------------------ *
   * 两条"防静默缺画面"的闸门（照抄物理实验台 §13 那套，化学这边同样需要）*
   * 背景：组里若在 draw 内部用空 catch 兜底，异常根本不会冒到核心这一层 —— *
   * console 干净、lastError 空、像素每帧照样在变（读数/动画），所有探针全绿，*
   * 而画面上只画了一半。物理实验台 mech.js 实测踩过（hooke-law/单摆）。    *
   *   ① drawErrorCount(id)：**穿过 spec.draw 这一层**的异常次数（运行时）  *
   *      ⚠ 覆盖不到"组内自己 catch"的异常 —— 那是原理性上限，别指望它。  *
   *   ② shadowAudit('var-called')：静态文本启发式，扫 5 个回调**自己的     *
   *      函数体**里"局部 var 被当函数调用"（变量遮蔽）——真正能对它报红的  *
   *      是这条。已知合法误报形状：var line = d.line; line(...)（转存函数）。*
   * ------------------------------------------------------------------ */
  var SCAN_CBS = ['draw', 'react', 'conclude', 'step', 'onPointer'];
  var SCAN_KEYWORDS = ('if for while switch catch function return typeof new delete void in do else try ' +
    'throw case break continue var this true false null undefined').split(' ');
  var SCAN_KEYWORD_SET = {};
  (function () { var i; for (i = 0; i < SCAN_KEYWORDS.length; i++) SCAN_KEYWORD_SET[SCAN_KEYWORDS[i]] = 1; })();
  /* 先剥字符串、再用带状态的词法扫描剥注释（顺序不能反，AGENTS §13 的教训） */
  function stripForScan(src) {
    var t = String(src), i = 0, ch, q, masked = '', out = '', inLine = false, inBlock = false, c, d;
    while (i < t.length) {
      ch = t.charAt(i);
      if (ch === '"' || ch === "'" || ch === '`') {
        q = ch; masked += ' '; i++;
        while (i < t.length && t.charAt(i) !== q) {
          if (t.charAt(i) === '\\') { masked += '  '; i += 2; continue; }
          masked += (t.charAt(i) === '\n') ? '\n' : ' ';
          i++;
        }
        masked += ' '; i++;
        continue;
      }
      masked += ch; i++;
    }
    i = 0;
    while (i < masked.length) {
      c = masked.charAt(i); d = masked.charAt(i + 1);
      if (inLine) { if (c === '\n') { inLine = false; out += '\n'; } else out += ' '; i++; continue; }
      if (inBlock) {
        if (c === '*' && d === '/') { inBlock = false; out += '  '; i += 2; continue; }
        out += (c === '\n') ? '\n' : ' '; i++; continue;
      }
      if (c === '/' && d === '/') { inLine = true; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { inBlock = true; out += '  '; i += 2; continue; }
      out += c; i++;
    }
    return out;
  }
  function lineNoOf(s, idx) {
    var n = 1, i;
    for (i = 0; i < idx && i < s.length; i++) if (s.charAt(i) === '\n') n++;
    return n;
  }
  function shadowScan(fn) {
    var res = { suspects: [], emptyCatch: [] };
    if (!isFn(fn)) return res;
    var src;
    try { src = Function.prototype.toString.call(fn); } catch (e) { return res; }
    var body = stripForScan(src), m, name, seen = {};
    var locals = {}, factory = {};
    var reVar = /\bvar\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = reVar.exec(body)) !== null) locals[m[1]] = 1;
    var reFn = /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = reFn.exec(body)) !== null) locals[m[1]] = 1;
    /* var X = 某函数调用(...)  → 工厂返回的函数，调用它是合法的（mod.js 的 mkFontFn） */
    var reFac = /\bvar\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*[A-Za-z_$][A-Za-z0-9_$.]*\s*\(/g;
    while ((m = reFac.exec(body)) !== null) factory[m[1]] = 1;
    var reCall = /([^.\w$]|^)([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while ((m = reCall.exec(body)) !== null) {
      name = m[2];
      if (!has(locals, name) || has(factory, name) || has(SCAN_KEYWORD_SET, name)) continue;
      var key = name + '@' + lineNoOf(body, m.index);
      if (has(seen, key)) continue;
      seen[key] = 1;
      res.suspects.push({ name: name, line: lineNoOf(body, m.index) });
    }
    /* 空 catch（只有注释/空白）—— **只列不判**（有些兜底是有理由的），但要有它就别指望异常能冒出来 */
    var reCatch = /catch\s*\([^)]*\)\s*\{([^}]*)\}/g;
    while ((m = reCatch.exec(body)) !== null) {
      if (!m[1].replace(/\s+/g, '')) res.emptyCatch.push({ line: lineNoOf(body, m.index) });
    }
    return res;
  }
  function addShadowAudit(spec) {
    var sus = [], ec = [], i, j, k, r;
    for (i = 0; i < SCAN_CBS.length; i++) {
      k = SCAN_CBS[i];
      if (!isFn(spec[k])) continue;
      r = shadowScan(spec[k]);
      for (j = 0; j < r.suspects.length; j++) sus.push({ cb: k, name: r.suspects[j].name, line: r.suspects[j].line });
      for (j = 0; j < r.emptyCatch.length; j++) ec.push({ cb: k, line: r.emptyCatch[j].line });
    }
    return { suspects: sus, emptyCatch: ec };
  }
  /* ------------------------------------------------------------------ *
   * ① 运行时错误计数（同族）：**穿过核心这一层**的异常次数                 *
   *    kind = 'draw' | 'react' | 'step' | 'pointer'                      *
   *    since = 自本次挂载以来（与物理核心同口径），total = 累计            *
   * 口径（务必记准）：                                                   *
   *  · **react 抛错绝不许冒给调用方** —— 核心吞掉、记一次、**不出行**、    *
   *    继续做剩下的次数。UI 路径与 API 路径一个待遇（API 路径以前会抛）。  *
   *  · 覆盖不到"组内自己 catch"的异常 —— 原理性上限，配 shadowAudit 一起看。*
   * ------------------------------------------------------------------ */
  var ERR_KINDS = ['draw', 'react', 'step', 'pointer', 'conclude'];
  var RUN_ERR = {};        // id -> { draw:{since,total}, react:{...}, ... }
  var WARN_ONCE = {};      // key -> 1（同一处异常只 console.warn 一次，别刷屏）
  function warnOnce(key, msg) {
    if (has(WARN_ONCE, key)) return false;
    WARN_ONCE[key] = 1;
    warn(msg);
    return true;
  }
  function errSlot(id, kind) {
    var rec = has(RUN_ERR, id) ? RUN_ERR[id] : (RUN_ERR[id] = {});
    return has(rec, kind) ? rec[kind] : (rec[kind] = { since: 0, total: 0 });
  }
  /* 统一的"组回调出错"通道：计数 + lastError + **一次** console.warn + 界面上能看到 */
  function noteError(id, kind, e) {
    var m = (e && e.message) ? String(e.message) : String(e);
    var slot = errSlot(id || '', kind);
    slot.since++; slot.total++;
    if (S && S.id === id) S.lastError = kind + ': ' + m;
    warnOnce(kind + ':' + id + ':' + m, '[' + (id || '?') + '] ' + kind + '() 抛异常（核心已吞掉，不冒给调用方）：' + m);
    return m;
  }
  function runErrCount(kind, id) {
    var t = 0, k, rec, sl;
    if (id !== undefined && id !== null) {
      rec = has(RUN_ERR, id) ? RUN_ERR[id] : null;
      return (rec && has(rec, kind)) ? rec[kind].since : 0;
    }
    for (k in RUN_ERR) {
      if (!has(RUN_ERR, k)) continue;
      rec = RUN_ERR[k];
      sl = has(rec, kind) ? rec[kind] : null;
      if (sl) t += sl.since;
    }
    return t;
  }
  function runErrTotal(kind, id) {
    var t = 0, k, rec, sl;
    if (id !== undefined && id !== null) {
      rec = has(RUN_ERR, id) ? RUN_ERR[id] : null;
      return (rec && has(rec, kind)) ? rec[kind].total : 0;
    }
    for (k in RUN_ERR) {
      if (!has(RUN_ERR, k)) continue;
      rec = RUN_ERR[k];
      sl = has(rec, kind) ? rec[kind] : null;
      if (sl) t += sl.total;
    }
    return t;
  }
  /* since 的口径 = **自本次挂载以来**（与物理核心一致）；挂载时统一归零 */
  function resetRunErr() {
    var k, kind, rec;
    for (k in RUN_ERR) {
      if (!has(RUN_ERR, k)) continue;
      rec = RUN_ERR[k];
      for (var i = 0; i < ERR_KINDS.length; i++) {
        kind = ERR_KINDS[i];
        if (has(rec, kind)) rec[kind].since = 0;
      }
    }
  }

  /* 坐标轴刻度标签：比表格更短 */
  function fmtTick(v) {    var n = Number(v);
    if (!isFinite(n)) return String(v);
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e4 || a < 1e-3) return n.toExponential(1);
    var s = n.toPrecision(3);
    if (s.indexOf('.') >= 0 && s.indexOf('e') < 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  /* 化学计量数/整数计数：整数原样，分数保留 3 位 */
  function fmtCount(v) {
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    if (Math.abs(n - Math.round(n)) < TOL) return String(Math.round(n));
    return String(Math.round(n * 1000) / 1000);
  }
  function fmtSigned(n) { return (n > 0 ? '+' : '') + fmtCount(n); }

  /* ------------------------------------------------------------------ *
   * ★ 化学方程式解析与配平校验 balance(eq)                               *
   *   化学里唯一客观的对错判据：逐元素守恒 + 电荷守恒。                    *
   * ------------------------------------------------------------------ */

  /* 元素符号表（用来标记"不认识的符号"，**不**因此拒绝解析：宁可继续核对守恒，
     也不要因为一个少见的写法把整条方程式判死） */
  var ELEMENT_LIST = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn ' +
    'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu ' +
    'Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm ' +
    'Bk Cf Es Fm Md No Lr').split(' ');
  var EL_KNOWN = {};
  (function () { var i; for (i = 0; i < ELEMENT_LIST.length; i++) EL_KNOWN[ELEMENT_LIST[i]] = 1; })();

  var SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
  var SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function mapDigits(s, table) {
    var out = '', i, ch, k;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      k = table.indexOf(ch);
      out += (k >= 0 ? String(k) : ch);
    }
    return out;
  }
  /* 去掉含汉字的括注（HNO3(浓)、NaOH(溶液)、（放热））—— 它们不参与守恒 */
  function stripCjkParens(t) {
    var prev = null, guard = 0;
    while (prev !== t && guard++ < 6) {
      prev = t;
      t = t.replace(/\(([^()]*)\)/g, function (m, inner) {
        return /[\u3400-\u9fff]/.test(inner) ? '' : m;
      });
    }
    return t;
  }
  /* 归一化：上下标 → ASCII、全角 → 半角、去掉不影响守恒的符号与条件标注 */
  function normEqText(s) {
    var t = String(s === undefined || s === null ? '' : s);
    t = mapDigits(t, SUB_DIGITS);
    t = mapDigits(t, SUP_DIGITS);
    t = t.replace(/⁺/g, '+').replace(/⁻/g, '-');
    t = t.replace(/[−–—―]/g, '-');
    t = t.replace(/[•∙⋅·＊*]/g, '·');
    /* 全角 ASCII（Ｈ２Ｏ、＝、＋、－、（）、［］…）整段折成半角 */
    t = t.replace(/[\uff01-\uff5e]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xfee0); });
    t = t.replace(/\u3000/g, ' ');
    t = t.replace(/[↑↓]/g, '');                       // 气体/沉淀符号：不影响守恒
    t = t.replace(/\^/g, '');                         // SO4^2- 这类写法
    t = t.replace(/[ \t\u00a0]+/g, ' ');
    t = stripCjkParens(t);
    t = t.replace(/^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩]|\(\d{1,2}\)|\d{1,2}[.、])\s*/, '');   // 序号（不会吃掉 "2Na"）
    t = t.replace(/[\s。；;，,]+$/, '');
    return t;
  }
  /* 反应号：**按优先级取第一个命中的模式**（顺序即优先级），每个模式内取最左匹配。
     顺序为什么是这样（都是踩过的）：
       1) ⇌/⇋/⇔/<=> —— 可逆号无歧义
       2) =条件=     —— 2KClO3 =MnO2,△= 2KCl + 3O2↑ 这种教科书写法；条件里不含 + 与空格，
                        所以不会把 CH2=CH2 + H2 = C2H6 的碳碳双键误判成"条件"
       3) 空格=空格   —— 最常见的"A + B = C + D"写法（两侧都有空格的等号）
       4) -/--/-->   —— 箭头（也吃 --浓硫酸,170℃--> 这种把条件写进箭头的）。
                         ⚠ 条件里**不许带空格**（`-{1,3}[^->=\s]{0,40}-{0,3}>`）：
                        旧写法 `-{1,3}[^>]{0,40}>` 会从**更早**的一个空格连字符开始匹配，
                        把 `CH3 - CH2 - OH --催化剂--> C2H4 + H2O` 劈成 `CH3` 与其余
                        （实测踩到：左边只数出 C1 H3，守恒直接算错）。箭头前的
                        结构式单键一旦带空格就是这个下场，所以条件段一律不许有空格；
                        `-- 条件 -->` 这种带空格的写法由第二个分支 `-{1,3}>` 兜住。
       5) → 等单字符箭头
       6) 裸 =       —— 无空格的 2Na+2H2O=2NaOH+H2↑
     为什么不是"一律取最左"：CH2=CH2 + H2 = C2H6 里最左的 = 是碳碳双键，会把方程式劈错。 */
  var SEP_PATTERNS = [
    { re: /⇌|⇋|⇔|<=>|<==>|↔/, kind: 'eq' },
    { re: /=\s*[^=+\s][^=+]{0,38}?=/, kind: 'cond' },
    { re: /\s=\s/, kind: 'eq' },
    { re: /-{1,3}[^->=\s]{0,40}-{0,3}>|-{1,3}>/, kind: 'arrow' },
    { re: /[→⟶⟹⇀➔]/, kind: 'arrow' },
    { re: /=/, kind: 'eq' }
  ];
  function findSep(t) {
    var i, m, p;
    for (i = 0; i < SEP_PATTERNS.length; i++) {
      p = SEP_PATTERNS[i];
      m = p.re.exec(t);
      if (!m) continue;
      return { index: m.index, len: m[0].length, text: m[0], kind: p.kind };
    }
    return null;
  }
  /* 判断某个 '+' 是"物质之间的加号"还是"离子电荷的加号"。
     规则：前面是空白/加号/减号 → 分隔符（"Na+ + Cl-" 的第二个 +）；
     紧贴前一个字符时，看后面第一个非空字符是不是化学式起始（"Fe3++Cu" 的第二个 +）；
     否则就是电荷（"Fe3+ "、"SO42-"、"H+" 末尾）。 */
  function isSepPlus(s, i) {
    var prev = i > 0 ? s.charAt(i - 1) : ' ';
    if (prev === ' ' || prev === '+' || prev === '-') return true;
    var j = i + 1;
    while (j < s.length && s.charAt(j) === ' ') j++;
    var nx = j < s.length ? s.charAt(j) : '';
    return /[A-Za-z0-9(\[]/.test(nx);
  }
  /* 判断某个 '-' 是"**减电子**的分隔符"（半反应写法：阳极：Cu - 2e- = Cu2+）。
     **只认减电子这一种**：后面必须紧跟「可选数字 + e + 可选电荷」。
     为什么这么窄：`CH3 - CH2 - OH` 这种带空格的单键如果也被当分隔符，
     后面那些项的元素会被"减掉"，守恒直接算错。宁可不认，也不能认错。 */
  function isSepMinusElectron(s, i) {
    var rest = s.slice(i + 1);
    return /^\s*[0-9]{0,2}\s*e\s*[+-]?\s*(?:\+|$)/i.test(rest);
  }
  function splitTerms(side) {
    var out = [], buf = '', depth = 0, i, ch, sign = 1;
    for (i = 0; i < side.length; i++) {
      ch = side.charAt(i);
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') { if (depth > 0) depth--; }
      if (ch === '+' && depth === 0 && isSepPlus(side, i)) {
        if (buf.replace(/\s/g, '')) out.push({ text: buf, sign: sign });
        buf = ''; sign = 1;
        continue;
      }
      if (ch === '-' && depth === 0 && isSepMinusElectron(side, i)) {
        if (buf.replace(/\s/g, '')) out.push({ text: buf, sign: sign });
        buf = ''; sign = -1;                  // 减号：后面那一项整体取负（电荷也跟着翻，正好对）
        continue;
      }
      buf += ch;
    }
    if (buf.replace(/\s/g, '')) out.push({ text: buf, sign: sign });
    return out;
  }
  /* 拆出电荷。电荷写在末尾（+ / - / 2+ / 42- ），且要和下标区分开：
       · "Fe3+"  → 电荷 +3，化学式 Fe        （前面是小写字母 = 元素符号已完整）
       · "O2-"   → 电荷 -2，化学式 O         （单原子离子，2/3/4 当电荷）
       · "S2-"   → 电荷 -2，化学式 S
       · "SO42-" → 电荷 -2，化学式 SO4       （多位数字：末位是电荷，其余是下标）
       · "NH4+"  → 电荷 +1，化学式 NH4       （多原子离子，数字是下标）
       · "MnO4-" → 电荷 -1，化学式 MnO4
       · "[Cu(NH3)4]2+" → 电荷 +2，化学式 [Cu(NH3)4]（右括号后的个位数字是电荷）
     */
  function splitCharge(body) {
    var m = /([0-9]*)([+-]{1,3})$/.exec(body);
    if (!m || (!m[1] && !m[2])) return { formula: body, charge: 0 };
    var digits = m[1], signs = m[2];
    var pre = body.slice(0, body.length - m[0].length);
    if (!pre) return { formula: '', charge: 0 };
    var sign = signs.charAt(0) === '+' ? 1 : -1;
    var mag, formula, d;
    if (!digits) { mag = 1; formula = pre; }
    else if (digits.length >= 2) {
      mag = parseInt(digits.charAt(digits.length - 1), 10);
      formula = pre + digits.slice(0, digits.length - 1);
    } else {
      d = parseInt(digits, 10);
      if (/[a-z]$/.test(pre)) { mag = d; formula = pre; }
      else if (/^[A-Z][a-z]?$/.test(pre) && d >= 2 && d <= 4) { mag = d; formula = pre; }
      else if (/[\)\]]$/.test(pre)) { mag = d; formula = pre; }
      else { mag = 1; formula = pre + digits; }
    }
    return { formula: formula, charge: sign * mag };
  }
  function readNumAt(f, i) {
    var s = '', ch;
    while (i < f.length) {
      ch = f.charAt(i);
      if (ch < '0' || ch > '9') break;
      s += ch; i++;
    }
    return s;
  }
  function addScaled(dst, src, k) {
    var key;
    for (key in src) { if (has(src, key)) dst[key] = (dst[key] || 0) + src[key] * k; }
  }
  /* 读下标：数字下标，或**聚合度符号** n/m/x（高分子写法 `(C6H10O5)n`、`[-CH2-CH2-]n`）。
     聚合度按 1 记账 —— 守恒校验是"两边同乘一个符号"，代 1 进去正好等价于符号守恒。
     （真实教学里聚合度只出现在两边配对的位置；把 n 当 1 是这类方程式唯一可机械校验的做法，
     极端反例 `nA = B` 会被低估成守恒 —— 这种写法不在中学范围，代价可接受。） */
  function readSub(f, pos) {
    var s = readNumAt(f, pos.i), ch;
    pos.i += s.length;
    if (s) return parseInt(s, 10);
    ch = f.charAt(pos.i);
    if (ch === 'n' || ch === 'm' || ch === 'x') {
      var nx = f.charAt(pos.i + 1);
      if (!(nx >= 'a' && nx <= 'z')) { pos.i++; return 1; }
    }
    return 1;
  }
  /* 递归下降解析化学式（括号嵌套 + 结晶水点 + 下标 + 结构式键） */
  function parseGroup(f, pos, out, mult, err) {
    var n = f.length, ch, sym, cnt, sub, k, mk, pending = 1;
    while (pos.i < n) {
      ch = f.charAt(pos.i);
      if (ch === ')' || ch === ']' || ch === '}') return true;
      if (ch === ' ' || ch === '\t') { pos.i++; continue; }
      /* 结构式里的单键（[-CH2-CH2-]、CH3-CH2-OH、Cl-CH2-COOH）：电荷已在 splitCharge
         里取走，所以进了本函数还剩下的「-」一定是键，不是电荷 → 直接跳过。 */
      if (ch === '-') { pos.i++; continue; }
      if (ch === '·' || ch === '.') {                     // 结晶水/水合物：CuSO4·5H2O、NH3·H2O
        pos.i++;
        mk = readNumAt(f, pos.i);
        pos.i += mk.length;
        /* 「·」后面**可以没有数字**：NH3·H2O 是人教版标准写法（一水合氨），
           旧实现直接判「后面缺少数字或化学式」→ 把标准写法当成"不规范"挂黄字。
           没有数字时系数按 1（NH3·H2O = N1 H5 O1）。 */
        pending = mk ? parseInt(mk, 10) : 1;
        continue;
      }
      if (ch === '(' || ch === '[' || ch === '{') {
        pos.i++;
        sub = {};
        if (!parseGroup(f, pos, sub, 1, err)) return false;
        if (pos.i >= n) { err.msg = '括号没有闭合（' + f + '）'; return false; }
        pos.i++;                                          // 右括号
        k = readSub(f, pos);
        addScaled(out, sub, mult * pending * k);
        pending = 1;
        continue;
      }
      if (ch >= 'A' && ch <= 'Z') {
        sym = ch; pos.i++;
        if (pos.i < n && f.charAt(pos.i) >= 'a' && f.charAt(pos.i) <= 'z') { sym += f.charAt(pos.i); pos.i++; }
        cnt = readSub(f, pos);
        out[sym] = (out[sym] || 0) + cnt * mult * pending;
        /* ⚠ 这里**不能**把 pending 清回 1：结晶水的系数管的是**整个分子**，
           不是紧跟的一个元素。踩过：CuSO4·5H2O 只把 5 乘到 H 上 → O 记成 4+1=5，
           于是"CuSO4·5H2O = CuSO4 + 5H2O"被误判成 O 不守恒（左 5、右 9）。
           现在 pending 一直管到下一个「·」或本层结束。 */
        continue;
      }
      if (ch >= 'a' && ch <= 'z') { err.msg = '元素符号不能以小写字母开头：「' + ch + '」（' + f + '）'; return false; }
      err.msg = '化学式里有无法识别的字符「' + ch + '」（' + f + '）';
      return false;
    }
    return true;
  }
  /* 解析一个物质项：系数 + 化学式 + 电荷 */
  function parseTerm(raw) {
    var s = String(raw).replace(/^\s+|\s+$/g, '');
    var out = {
      raw: raw, text: s, ok: false, err: '', coef: 1, formula: '', charge: 0,
      els: {}, unknown: [], electron: false
    };
    if (!s) { out.err = '空物质项'; return out; }
    s = s.replace(/\((?:s|l|g|aq|aq\.)\)$/i, '');          // 状态符号 (s)(l)(g)(aq)
    var m = /^([0-9]+(?:\.[0-9]+)?)/.exec(s);
    if (m) { out.coef = parseFloat(m[1]); s = s.slice(m[1].length); }
    /* 聚合度/未知系数 n、m、x（高分子写法：nCH2=CH2、nH2O、nC6H12O6）→ 按 1 记账。
       要求紧跟大写字母或左括号，避免把普通的错写小写字母也一起放过。 */
    if (/^[nmx](?=[A-Z(\[])/.test(s)) { s = s.slice(1); out.symbolic = true; }
    if (!s) { out.err = '缺少化学式'; return out; }
    /* 结构式里的键（CH2=CH2 的双键、CH≡CH 的三键、CH3-CH2-OH 的单键）不参与计量，
       先去掉。**必须在电荷解析之前**：否则 CH2=CH2 尾巴上的 "2=" 会被当成电荷。
       注意只去掉"后面紧跟字母/括号"的连字符，末尾的 - 是电荷（Cl-、SO42-）。 */
    s = s.replace(/[=≡#]/g, '').replace(/-(?=[A-Za-z(\[])/g, '');
    if (!s) { out.err = '缺少化学式'; return out; }
    var em = /^e([0-9]?)([+-]?)$/i.exec(s);                // 电子：e- / 2e-
    if (em) {
      out.electron = true;
      out.formula = 'e';
      out.charge = ((em[2] === '+') ? 1 : -1) * (em[1] ? parseInt(em[1], 10) : 1) * out.coef;
      out.ok = true;
      return out;
    }
    var c = splitCharge(s);
    out.formula = c.formula;
    out.charge = c.charge * out.coef;
    if (!out.formula) { out.err = '缺少化学式'; return out; }
    var err = { msg: '' }, els = {}, pos = { i: 0 };
    if (!parseGroup(out.formula, pos, els, 1, err)) { out.err = err.msg; return out; }
    if (pos.i < out.formula.length) {
      out.err = '化学式里有没解析完的内容：「' + out.formula.slice(pos.i) + '」';
      return out;
    }
    out.els = els;
    var k;
    for (k in els) { if (has(els, k) && !EL_KNOWN[k]) out.unknown.push(k); }
    out.ok = true;
    return out;
  }
  function parseSide(side) {
    var res = { ok: false, err: '', els: {}, charge: 0, coefs: [], unknown: [], terms: [] };
    var parts = splitTerms(side), i, j, t;
    if (!parts.length) { res.err = '这一侧没有物质'; return res; }
    for (i = 0; i < parts.length; i++) {
      t = parseTerm(parts[i].text);
      /* 减电子的那一项整体取负（元素计数与电荷一起翻号）——
         `Cu - 2e- = Cu2+` 左边电荷 = 0 - (-2) = +2，与右边 +2 相等，守恒才算得对。 */
      if (parts[i].sign < 0) { t.coef = -t.coef; t.charge = -t.charge; }
      res.terms.push({
        text: t.text, coef: t.coef, formula: t.formula, charge: t.charge,
        els: t.els, electron: t.electron
      });
      if (!t.ok) { res.err = '「' + t.text + '」' + t.err; return res; }
      addScaled(res.els, t.els, t.coef);
      res.charge += t.charge;
      res.coefs.push(t.coef);
      for (j = 0; j < t.unknown.length; j++) {
        if (res.unknown.indexOf(t.unknown[j]) < 0) res.unknown.push(t.unknown[j]);
      }
    }
    res.ok = true;
    return res;
  }
  function gcdInt(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }
  /* ★ 配平校验：返回 ok / status / bad / reason / elements / charge / minimal / … *
   * status 四档（界面据此决定标红 / 黄字 / 中性灰字，别一律标红）：               *
   *   'ok'          已配平（元素 + 电荷守恒）                                    *
   *   'unbalanced'  **解析出来了但不守恒** → 界面上标红并指出哪个元素/电荷        *
   *   'unparsed'    有反应号但某一侧解析不了（写法太怪）→ 界面黄字提示            *
   *   'no-equation' 压根没有反应号（焰色试验/萃取/品红加合物这类**本来就没有化学
   *                  方程式**的物理变化，组里会老实写"无化学方程式（…）"）→ 中性 *
   * 多步方程式：`A = B；C = D`（`;`/`；`/`｜`/`|` 分隔）**逐段校验**，全 ok 才算 ok；
   *   某段不配平就在 reason 里指明「第 k 段：…」，明细在返回的 segments[] 里。
   *   为什么支持：多步方程式在化学里很常见（`Na2CO3+2HCl=…；CO2+Ca(OH)2=…`），
   *   旧实现会把两段拼成一个假化学式（`CO2;CO2`）并给出误导性报错。            *
   *   电极写法 `阳极：Cu - 2e- = Cu2+ ｜ 阴极：…` 也按段切开，并先剥掉「标签：」。*/
  function balance(eq) {
    var t = normEqText((eq === undefined || eq === null) ? '' : String(eq));
    var segs = splitSegments(t);
    if (segs.length > 1) return balanceMulti(segs);
    return balanceOne(segs.length ? segs[0] : t);
  }
  /* 按 `;` / `；`（已在归一化里折成 `;`）/ `｜` / `|` 切段，并剥掉「阳极：」这类前缀标签 */
  function splitSegments(t) {
    var raw = String(t).split(/[;|]/), out = [], i, s;
    for (i = 0; i < raw.length; i++) {
      s = raw[i].replace(/^\s+|\s+$/g, '');
      s = s.replace(/^[^=⇌→⟶]{0,16}?[：:]\s*/, '');
      if (s) out.push(s);
    }
    return out;
  }
  var BAL_RANK = { 'ok': 0, 'no-equation': 1, 'unparsed': 2, 'unbalanced': 3 };
  var BAL_RANK_NAME = ['ok', 'no-equation', 'unparsed', 'unbalanced'];
  function balanceMulti(segs) {
    var out = {
      ok: false, status: 'no-equation', parsed: false, multi: true, input: segs.join('；'),
      equation: segs.join('；'), left: '', right: '', sep: '', error: '', reason: '',
      bad: [], elements: [], unknown: [], minimal: true, gcd: 0, note: '',
      charge: { left: 0, right: 0, ok: true },
      terms: { left: [], right: [] }, segments: []
    };
    var i, j, s, worst = 0, msgs = [], notes = [], errs = [], okAll = true, minAll = true, parsedAll = true;
    var first = null, firstBad = null;
    for (i = 0; i < segs.length; i++) {
      s = balanceOne(segs[i]);
      out.segments.push({
        index: i + 1, equation: segs[i], ok: s.ok, status: s.status, bad: s.bad.slice(0),
        reason: s.reason, error: s.error, elements: s.elements, charge: s.charge,
        minimal: s.minimal, note: s.note, parsed: s.parsed, left: s.left, right: s.right,
        terms: s.terms, unknown: s.unknown.slice(0)
      });
      if (!first) first = s;
      if (!s.ok) {
        okAll = false;
        if (!firstBad) firstBad = s;
        msgs.push('第 ' + (i + 1) + ' 段：' + (s.reason || s.error || '未配平'));
      }
      if (s.error) errs.push('第 ' + (i + 1) + ' 段：' + s.error);
      for (j = 0; j < s.bad.length; j++) if (out.bad.indexOf(s.bad[j]) < 0) out.bad.push(s.bad[j]);
      for (j = 0; j < s.unknown.length; j++) if (out.unknown.indexOf(s.unknown[j]) < 0) out.unknown.push(s.unknown[j]);
      if (!s.minimal) minAll = false;
      if (!s.parsed) parsedAll = false;
      if (s.note) notes.push('第 ' + (i + 1) + ' 段：' + s.note);
      if (BAL_RANK[s.status] > worst) worst = BAL_RANK[s.status];
    }
    out.ok = okAll;
    out.status = BAL_RANK_NAME[worst];
    out.parsed = parsedAll;
    out.minimal = minAll;
    out.note = notes.join('；');
    out.error = errs.join('；');
    out.reason = okAll
      ? ('已配平：' + segs.length + ' 段全部守恒')
      : msgs.join('；');
    /* 顶层字段镜像"第一段失败的段"（全 ok 就镜像第一段），老调用方读 left/right/elements/charge 不会踩空 */
    var mirror = firstBad || first || null;
    if (mirror) {
      out.left = mirror.left; out.right = mirror.right; out.sep = mirror.sep;
      out.elements = mirror.elements; out.charge = mirror.charge;
      out.terms = mirror.terms; out.gcd = mirror.gcd;
      if (!out.error) out.error = mirror.error;
    }
    return out;
  }
  /* 单段（原来那条路径；输入已归一化） */
  function balanceOne(t) {
    var out = {
      ok: false, status: 'no-equation', parsed: false, input: t,
      equation: t, left: '', right: '', sep: '', error: '', reason: '',
      bad: [], elements: [], unknown: [], minimal: true, gcd: 0, note: '',
      charge: { left: 0, right: 0, ok: true },
      terms: { left: [], right: [] }
    };
    if (!t) { out.error = '空方程式'; out.reason = out.error; return out; }
    var sep = findSep(t);
    if (!sep) { out.error = '没有找到反应号（= / ⇌ / →）'; out.reason = out.error; return out; }
    out.sep = sep.text;
    out.left = t.slice(0, sep.index).replace(/^\s+|\s+$/g, '');
    out.right = t.slice(sep.index + sep.len).replace(/^\s+|\s+$/g, '');
    if (!out.left || !out.right) {
      out.error = '反应号两边都必须有物质';
      out.reason = out.error;
      out.status = 'unparsed';
      return out;
    }
    var pl = parseSide(out.left), pr = parseSide(out.right);
    out.terms.left = pl.terms; out.terms.right = pr.terms;
    if (!pl.ok) { out.error = '左边解析失败：' + pl.err; out.reason = out.error; out.status = 'unparsed'; return out; }
    if (!pr.ok) { out.error = '右边解析失败：' + pr.err; out.reason = out.error; out.status = 'unparsed'; return out; }
    out.parsed = true;
    var keys = [], k, i;
    for (k in pl.els) { if (has(pl.els, k) && keys.indexOf(k) < 0) keys.push(k); }
    for (k in pr.els) { if (has(pr.els, k) && keys.indexOf(k) < 0) keys.push(k); }
    var elements = [], bad = [], okAll = true, lv, rv, good;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      lv = has(pl.els, k) ? pl.els[k] : 0;
      rv = has(pr.els, k) ? pr.els[k] : 0;
      good = Math.abs(lv - rv) < TOL;
      elements.push({ el: k, left: lv, right: rv, ok: good });
      if (!good) { bad.push(k); okAll = false; }
    }
    if (!elements.length) { out.error = '两边都没有解析出元素'; out.reason = out.error; out.status = 'unparsed'; return out; }
    var chOk = Math.abs(pl.charge - pr.charge) < TOL;
    out.charge = { left: pl.charge, right: pr.charge, ok: chOk };
    if (!chOk) bad.push('电荷');
    out.elements = elements;
    out.bad = bad;
    out.ok = okAll && chOk;
    out.unknown = pl.unknown.slice(0);
    for (i = 0; i < pr.unknown.length; i++) {
      if (out.unknown.indexOf(pr.unknown[i]) < 0) out.unknown.push(pr.unknown[i]);
    }
    /* 系数是否最简整数比（**不算**"不配平"：守恒优先，另外提示） */
    var coefs = pl.coefs.concat(pr.coefs), allInt = true, g0 = 0, ci;
    for (i = 0; i < coefs.length; i++) {
      ci = coefs[i];
      if (Math.abs(ci - Math.round(ci)) > TOL) { allInt = false; break; }
      g0 = gcdInt(g0, Math.round(ci));
    }
    out.gcd = allInt ? g0 : 0;
    out.minimal = allInt && g0 <= 1;
    out.note = !allInt ? '系数里出现了分数，规范写法应化为最简整数比'
      : (g0 > 1 ? '系数有公约数 ' + g0 + '，应约简为最简整数比' : '');
    if (out.ok) {
      out.status = 'ok';
      out.reason = '已配平：' + elements.length + ' 种元素与电荷均守恒' +
        (out.unknown.length ? '（未识别的符号：' + out.unknown.join('、') + '）' : '');
    } else {
      out.status = 'unbalanced';
      var msgs = [];
      for (i = 0; i < elements.length; i++) {
        if (!elements[i].ok) {
          msgs.push('元素 ' + elements[i].el + ' 不守恒（左 ' + fmtCount(elements[i].left) +
            '，右 ' + fmtCount(elements[i].right) + '）');
        }
      }
      if (!chOk) msgs.push('电荷不守恒（左 ' + fmtSigned(pl.charge) + '，右 ' + fmtSigned(pr.charge) + '）');
      out.reason = '未配平：' + msgs.join('；');
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 随机数：ctx.rnd() / ctx.noise(sigma)                                *
   * 用 Park-Miller 线性同余（16807 乘子，乘积 < 2^53，双精度不丢位）      *
   * ------------------------------------------------------------------ */
  var rndState = (Math.floor(Date.now()) % 2147483646) + 1;
  function nextRand() {
    rndState = (rndState * 16807) % 2147483647;
    return (rndState - 1) / 2147483646;
  }
  function hashSeed(s) {
    var h = 2166136261, str = String(s), i;
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  /* ctx：{ rnd(seed), noise(sigma), t, index }（与物理同一份；index = 第几次观察，从 0 起） */
  var CTX = {
    t: 0,
    index: 0,
    rnd: function (seed) {
      if (seed === undefined || seed === null || seed === '') return nextRand();
      return (hashSeed(seed) % 1000000) / 1000000;
    },
    noise: function (sigma) {
      var u1 = nextRand(); if (u1 < 1e-9) u1 = 1e-9;
      var u2 = nextRand();
      var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return z * (sigma === undefined || sigma === null ? 1 : num(sigma, 1));
    }
  };

  /* ------------------------------------------------------------------ *
   * 最小二乘拟合（graph().fit = {a,b,r2}；y = a + b·x）                  *
   * ⚠ **r² 只有在 y 非常数、且 x 有分布时才可用**（与物理核心同口径）：    *
   *   · x 没有分布（所有点在同一条竖直线上）→ fit 返回 **null**（物理侧同）*
   *   · y 几乎不变（ssTot≈0）→ 旧实现在这里返回 r²=1，那是**假绿** ——    *
   *     验收探针只要查 "r²>0.9" 就会把"根本没变化的数据"判成完美线性！     *
   *     实测命中过：iron-ion-test 默认试样颜色恒 0 → r²=1。现在返回 null，  *
   *     并在 graph().degenerate / graph().fitNote 里说明原因。             *
   * ------------------------------------------------------------------ */
  function ySpreadOf(pts) {
    var i, ybar = 0, ss = 0;
    if (pts.length < 2) return 0;
    for (i = 0; i < pts.length; i++) ybar += pts[i].y;
    ybar = ybar / pts.length;
    for (i = 0; i < pts.length; i++) ss += (pts[i].y - ybar) * (pts[i].y - ybar);
    return ss;
  }
  function fitLinear(pts) {
    var n = pts.length, i, x, y;
    if (n < 2) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (i = 0; i < n; i++) { x = pts[i].x; y = pts[i].y; sx += x; sy += y; sxx += x * x; sxy += x * y; }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < EPS) return null;              // x 无分布 → 没有"直线"可言
    if (ySpreadOf(pts) < EPS) return null;             // y 无分布 → r² 是假绿，别回 1
    var b = (n * sxy - sx * sy) / den;
    var a = (sy - b * sx) / n;
    return { a: a, b: b, r2: r2Of(pts, a, b) };
  }
  function fitOrigin(pts) {
    var n = pts.length, i, sxx = 0, sxy = 0;
    if (n < 2) return null;
    for (i = 0; i < n; i++) { sxx += pts[i].x * pts[i].x; sxy += pts[i].x * pts[i].y; }
    if (Math.abs(sxx) < EPS) return null;
    if (ySpreadOf(pts) < EPS) return null;
    var b = sxy / sxx;
    return { a: 0, b: b, r2: r2Of(pts, 0, b) };
  }
  function r2Of(pts, a, b) {
    var n = pts.length, i, ybar = 0, ssTot = 0, ssRes = 0, y, yh;
    for (i = 0; i < n; i++) ybar += pts[i].y;
    ybar = ybar / n;
    for (i = 0; i < n; i++) {
      y = pts[i].y; yh = a + b * pts[i].x;
      ssRes += (y - yh) * (y - yh);
      ssTot += (y - ybar) * (y - ybar);
    }
    if (ssTot < EPS) return ssRes < EPS ? 1 : 0;
    return 1 - ssRes / ssTot;
  }
  function niceStep(range, n) {
    if (!(range > 0)) return 1;
    var raw = range / Math.max(1, n);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag, s;
    if (norm <= 1) s = 1; else if (norm <= 2) s = 2; else if (norm <= 5) s = 5; else s = 10;
    return s * mag;
  }

  /* ------------------------------------------------------------------ *
   * 注册表                                                              *
   * ------------------------------------------------------------------ */
  var REG = {};    // id -> spec
  var ORDER = [];  // 注册顺序（list() 的分组内排序）
  var META = {};   // id -> { steps:{key:step}, warnings:[...] }（register 时的体检结果）

  function groupOf(spec) {
    var g = spec && spec.group ? String(spec.group) : '';
    return g || '其他';
  }
  function nameOf(spec, fallbackId) {
    var n = spec && spec.name ? String(spec.name) : '';
    return n || String(fallbackId || (spec && spec.id) || '未命名');
  }
  function groupSeq() {
    var out = [], seen = {}, i, g;
    for (i = 0; i < GROUP_ORDER.length; i++) {
      g = GROUP_ORDER[i];
      if (hasAnyInGroup(g)) { out.push(g); seen[g] = 1; }
    }
    for (i = 0; i < ORDER.length; i++) {
      g = groupOf(REG[ORDER[i]]);
      if (!seen[g]) { seen[g] = 1; out.push(g); }
    }
    return out;
  }
  function hasAnyInGroup(g) {
    var i;
    for (i = 0; i < ORDER.length; i++) if (groupOf(REG[ORDER[i]]) === g) return true;
    return false;
  }
  function idsInGroup(g) {
    var out = [], i;
    for (i = 0; i < ORDER.length; i++) if (groupOf(REG[ORDER[i]]) === g) out.push(ORDER[i]);
    return out;
  }

  /* 登记一个反应。必需：id 非空字符串 / react 函数 / columns 是数组（**可为空**，
     纯定性反应契约 §3 明确允许 columns: [] + graph: null）。
     不合格**不登记**并 console.warn —— 宁可列表里少一个，也不要一个点了就炸的条目。 */
  function register(id, spec) {
    if (typeof id !== 'string' || !id) { warn('register: id 必须是非空字符串'); return false; }
    if (!spec || typeof spec !== 'object') { warn('register(' + id + '): spec 必须是对象'); return false; }
    if (!isFn(spec.react)) { warn('register(' + id + '): 缺少 react(p, ctx) 函数'); return false; }
    if (!isArr(spec.columns)) { warn('register(' + id + '): columns 必须是数组（纯定性反应写 columns: []）'); return false; }
    var i, c;
    for (i = 0; i < spec.columns.length; i++) {
      c = spec.columns[i];
      if (!c || typeof c.key !== 'string' || !c.key) { warn('register(' + id + '): columns[' + i + '] 缺少 key'); return false; }
    }
    try {
      if (!spec.id) spec.id = id;
      if (!spec.name) spec.name = id;
    } catch (e) { /* 冻结对象：读取处有 nameOf() 兜底 */ }
    if (!has(REG, id)) ORDER.push(id);
    REG[id] = spec;
    var pa = paramAudit(id, spec);
    var sa = structAudit(id, spec);
    var sh = addShadowAudit(spec);
    META[id] = {
      steps: pa.steps, warnings: pa.warnings.concat(sa), paramWarnings: pa.warnings.length,
      suspects: sh.suspects, emptyCatch: sh.emptyCatch
    };
    if (META[id].warnings.length) warn('register(' + id + ') 体检：' + META[id].warnings.join('；'));
    /* 静态遮蔽只在 console 提示（口径同物理核心：不进 state().warnings，探针查 shadowAudit()） */
    if (sh.suspects.length) {
      warn('register(' + id + ') 静态体检：局部变量被当函数调用（draw 里会静默缺画面）：' +
        sh.suspects.map(function (x) { return x.cb + '() 第 ' + x.line + ' 行 ' + x.name + '()'; }).join('；'));
    }
    return true;
  }

  function list() {
    var out = [], gs = groupSeq(), g, i, ids, sp;
    for (g = 0; g < gs.length; g++) {
      ids = idsInGroup(gs[g]);
      for (i = 0; i < ids.length; i++) {
        sp = REG[ids[i]];
        out.push({ id: ids[i], name: nameOf(sp, ids[i]), group: groupOf(sp) });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 会话（模型层）：条件 + 现象表 + 时钟                                  *
   * ------------------------------------------------------------------ */
  var S = null;   // { id, spec, params, rows, seq, st, lastError, warnings, steps }
  var V = null;   // 已挂载的视图（null = 未挂载）

  function str(v) { return (v === undefined || v === null) ? '' : String(v); }
  function errMsg(e) { return (e && e.message) ? String(e.message) : String(e); }
  function defParams(spec) {
    var p = {}, i, d, v;
    if (!spec || !isArr(spec.params)) return p;
    for (i = 0; i < spec.params.length; i++) {
      d = spec.params[i];
      if (!d || !d.key) continue;
      if (has(p, d.key)) continue;      // key 重复：只有第一处生效（paramAudit 会 warn）
      v = d.value;
      if (typeof v === 'string' && isFinite(Number(v))) v = Number(v);
      p[d.key] = v === undefined ? null : v;
    }
    return p;
  }
  function paramDef(spec, key) {
    var i, d;
    if (!spec || !isArr(spec.params)) return null;
    for (i = 0; i < spec.params.length; i++) {
      d = spec.params[i];
      if (d && d.key === key) return d;
    }
    return null;
  }
  function seedWarnings(meta) {
    var out = [], i;
    if (!meta || !isArr(meta.warnings)) return out;
    for (i = 0; i < meta.warnings.length; i++) out.push({ key: 'audit:' + i, msg: meta.warnings[i] });
    return out;
  }
  function newSession(id) {
    var spec = REG[id];
    var st = { rows: [], running: false, t: 0, phase: 0, hover: null };
    var meta = META[id] || { steps: {}, warnings: [] };
    return {
      id: id, spec: spec, params: defParams(spec), rows: [], seq: 0,
      st: st, lastError: '',
      steps: clone(meta.steps),                 // 归一化后的 step（UI 与 setParam 共用同一份）
      warnings: seedWarnings(meta)              // 体检 + 运行期问题（state().warnings 可查）
    };
  }
  function syncRows() {
    if (!S) return;
    S.st.rows = S.rows;
    S.st.running = !!S.st.running;
  }
  function paramSnap() { return S ? clone(S.params) : {}; }
  function rowsSnap() {
    var out = [], i;
    if (!S) return out;
    for (i = 0; i < S.rows.length; i++) out.push(cloneRow(S.rows[i]));
    return out;
  }
  function cloneRow(r) {
    var out = {
      n: r.n, phenomena: r.phenomena.slice(0), equation: r.equation, ionic: r.ionic,
      type: r.type, conditions: r.conditions, measures: clone(r.measures)
    };
    out.balanced = {
      ok: r.balanced.ok, status: r.balanced.status, bad: r.balanced.bad.slice(0), reason: r.balanced.reason,
      parsed: r.balanced.parsed, minimal: r.balanced.minimal, note: r.balanced.note,
      error: r.balanced.error
    };
    return out;
  }
  /* phenomena 允许写成数组或单个字符串；一律归一化成字符串数组 */
  function toStrList(v) {
    var out = [], i;
    if (v === undefined || v === null || v === '') return out;
    if (isArr(v)) {
      for (i = 0; i < v.length; i++) {
        if (v[i] === undefined || v[i] === null) continue;
        if (String(v[i]).replace(/\s/g, '')) out.push(String(v[i]));
      }
      return out;
    }
    if (String(v).replace(/\s/g, '')) out.push(String(v));
    return out;
  }
  /* 记录一条运行期 warning（**不**打 console.warn：验收要求 0 console 异常/警告） */
  function note(key, msg) { if (S) pushOnce(S.warnings, key, msg); }
  function balSummary(b) {
    return {
      ok: b.ok, status: b.status, bad: b.bad.slice(0), reason: b.reason, parsed: b.parsed,
      minimal: b.minimal, note: b.note, error: b.error
    };
  }

  /* 推进一小步（时钟归属与物理一致：spec.step 自己碰了 state.t 就不再推） */
  function advance(dt) {
    if (!S) return;
    var spec = S.spec, st = S.st;
    var t0 = st.t, ph0 = st.phase;
    if (isFn(spec.step)) {
      try { spec.step(paramSnap(), st, dt); }
      catch (e) { noteError(S.id, 'step', e); }
    }
    if (st.t === t0) st.t = t0 + dt;
    if (st.phase === ph0) {
      var cyc = num(spec.cycle, DEFAULT_CYCLE);
      if (!(cyc > 0)) cyc = DEFAULT_CYCLE;
      st.phase = ((st.t % cyc) + cyc) % cyc / cyc;
    }
  }
  function stepN(seconds) {
    var secs = num(seconds, 0);
    if (!(secs > 0)) return { steps: 0, t: S ? S.st.t : 0 };
    var n = Math.round(secs / STEP);
    if (n > 60 * 30) n = 60 * 30;    // 上限 30 s：探针传 1e9 也不会把页面卡死
    for (var i = 0; i < n; i++) advance(STEP);
    return { steps: n, t: S ? S.st.t : 0 };
  }

  /* 把一次组回调的返回值归一化成一行现象（可能抛 —— 由 reactCore 兜住） */
  function buildRow(r, cols) {
    var k, j, ph, measures = {}, mm, missing = [];
    ph = toStrList(r.phenomena);
    if (ph.length < 2) {
      note('phen', 'react() 返回的 phenomena 少于 2 条（契约 §4.2 要求 ≥2 条，现在只有 ' + ph.length + ' 条）');
    }
    var equation = str(r.equation);
    var bal = balance(equation);
    /* 只有"解析出来了但不守恒"和"写法解析不了"才算缺陷要记 warning；
       'no-equation'（焰色/萃取/品红加合物这类本来就没有化学方程式的物理变化，
       组里会老实写"无化学方程式（…）"）是**正当写法**，不记 warning、界面也不标红。 */
    if (bal.status === 'unbalanced') note('bal:' + bal.bad.join(','), 'react() 的方程式没通过配平校验：' + bal.reason);
    else if (bal.status === 'unparsed') note('balu:' + bal.error, 'react() 的方程式解析不了（写法可能不规范）：' + bal.reason);
    var cond = str(r.conditions);
    if (!cond) note('cond', 'react() 返回的 conditions 为空（契约 §4.2 要求非空）');
    var tp = str(r.type);
    if (!tp) note('type', 'react() 返回的 type 为空（契约 §4.2 要求非空）');
    mm = r.measures;
    if (mm === undefined || mm === null) mm = {};
    if (typeof mm === 'object' && !isArr(mm)) {
      for (k in mm) { if (has(mm, k)) measures[k] = mm[k]; }
    } else {
      note('mm', 'react() 的 measures 必须是对象（没有量化量就给 {}）');
    }
    /* 声明了定量列却没给值 → 按 null 处理（约定 ①：缺值不是 0），并记一条 warning */
    for (j = 0; j < cols.length; j++) {
      if (!has(measures, cols[j].key)) { measures[cols[j].key] = null; missing.push(cols[j].key); }
    }
    if (missing.length) {
      note('miss:' + missing.join(','), 'react() 的 measures 缺少列：' + missing.join('、') +
        '（按 null 处理：不进图、现象表里显示「—」）');
    }
    return {
      n: 0, phenomena: ph.slice(0), equation: equation, ionic: str(r.ionic),
      type: tp, conditions: cond, measures: measures, balanced: balSummary(bal)
    };
  }
  /* ★ 做 n 次**独立**观察（见文件头"观察语义"）。
     每次调用都是一次完整的、与前后无关的实验：结果只随**当前条件**变化。
     ⚠ **组里 react() 抛异常绝不许冒给调用方**（API 路径与 UI 路径一个待遇）：
     捕获 → noteError 计数 + state().lastError + 一次 console.warn → **这一次不出行**、
     继续做剩下的次数（n 次里坏的那几次就少几行），**不抛**。
     为什么：组 1 的 precipitate-convert 在"等物质的量"边界抛过
     TypeError: Cannot read properties of null (reading 'toExponential') ——
     一个边界数值问题不该让 QG_CLAB.react() 把异常摔到探针/学生脸上。 */
  function reactCore(n) {
    if (!S) return [];
    var spec = S.spec, cols = spec.columns, out = [], i, r, copy;
    n = (n === undefined || n === null) ? 1 : Math.floor(Number(n));
    if (!(n > 0)) n = 1;
    if (n > MAX_REACT_PER_CALL) n = MAX_REACT_PER_CALL;
    for (i = 0; i < n; i++) {
      CTX.t = S.st.t;
      CTX.index = S.seq;
      try {
        r = spec.react(paramSnap(), CTX);
        if (!r || typeof r !== 'object') throw new Error('react() 未返回对象');
        copy = buildRow(r, cols);
      } catch (e) {
        noteError(S.id, 'react', e);
        continue;                     // **不出行、不抛**
      }
      S.seq++;
      copy.n = S.seq;
      S.rows.push(copy);
      out.push(cloneRow(copy));
    }
    syncRows();
    /* 兼容两种读法（见文件头）：数组本身 + 末尾一行的字段（n=1 时两者等价） */
    if (out.length) {
      var last = out[out.length - 1];
      out.phenomena = last.phenomena;
      out.equation = last.equation;
      out.ionic = last.ionic;
      out.type = last.type;
      out.conditions = last.conditions;
      out.measures = last.measures;
      out.balanced = last.balanced;
      out.n = last.n;
    }
    return out;
  }

  /* 纯定性反应（graph: null / 或没给 x,y）→ qualitative=true，graph() 返回 null（合法） */
  function hasGraph(spec) {
    var g = spec && spec.graph;
    return !!(g && g.x && g.y);
  }
  function graphData() {
    var res = {
      points: [], fit: null, xLabel: '', yLabel: '', title: '', note: '',
      xKey: '', yKey: '', valid: 0, skipped: 0, qualitative: true,
      degenerate: false, fitNote: ''
    };
    if (!S) return res;
    var spec = S.spec, g = spec.graph;
    if (!g || !g.x || !g.y || g.fit === 'none' || g.fit === false) {
      if (hasGraph(spec) && (g.fit === 'none' || g.fit === false)) {
        res.qualitative = false;
        res.xKey = String(g.x); res.yKey = String(g.y);
        res.title = str(g.title); res.note = str(g.note);
        res.xLabel = g.xLabel ? String(g.xLabel) : labelOf(res.xKey);
        res.yLabel = g.yLabel ? String(g.yLabel) : labelOf(res.yKey);
        res.points = pointsOf(res.xKey, res.yKey);
        res.valid = res.points.length;
        res.skipped = S.rows.length - res.points.length;
        res.fit = null;
      }
      return res;
    }
    res.qualitative = false;
    res.xKey = String(g.x); res.yKey = String(g.y);
    res.title = str(g.title);
    res.note = str(g.note);
    res.xLabel = g.xLabel ? String(g.xLabel) : labelOf(res.xKey);
    res.yLabel = g.yLabel ? String(g.yLabel) : labelOf(res.yKey);
    /* 取点：**必须显式挡掉 null / undefined / 空串**，不能靠 Number()+isFinite()。
       为什么：某次观察在这张图上没有意义时组模块会按语义返回 null（约定 ①），而
       Number(null) === 0，旧写法会把假点 (x, 0) 塞进图里 → r² 被假点拉垮。
       这里只**跳过**"语义上无值"的行：不补 0、也不当 0 用；真实的 0 照常进图。
       fit 用的是同一份 pts，所以被跳过的行绝不会进 r²。 */
    res.points = pointsOf(res.xKey, res.yKey);
    res.valid = res.points.length;
    res.skipped = S.rows.length - res.points.length;
    var kind = (g.fit === undefined || g.fit === null) ? 'linear' : g.fit;
    if (kind === 'origin') res.fit = fitOrigin(res.points);
    else res.fit = fitLinear(res.points);
    /* 退化标记：x 或 y 没有分布时**不给拟合**（fit=null），并说明为什么 ——
       否则"y 恒定"会被 r²=1 伪装成完美线性（假绿，实测命中过 iron-ion-test）。 */
    res.degenerate = false;
    res.fitNote = '';
    if (res.points.length >= 2 && !res.fit) {
      var xs = 0, ys = 0, i2, p0 = res.points[0];
      for (i2 = 1; i2 < res.points.length; i2++) {
        if (Math.abs(res.points[i2].x - p0.x) > EPS) xs = 1;
        if (Math.abs(res.points[i2].y - p0.y) > EPS) ys = 1;
      }
      if (!xs && !ys) { res.degenerate = true; res.fitNote = 'x 与 y 都没有分布（所有点几乎重合），不做拟合'; }
      else if (!xs) { res.degenerate = true; res.fitNote = 'x 没有分布（点都在同一条竖直线上），不做拟合'; }
      else if (!ys) { res.degenerate = true; res.fitNote = 'y 几乎不变（数据无分布），r² 不可用，不做拟合'; }
    }
    return res;
  }
  function pointsOf(xKey, yKey) {
    var pts = [], i, row, x, y;
    for (i = 0; i < S.rows.length; i++) {
      row = S.rows[i];
      x = coordOf(row.measures, xKey);
      y = coordOf(row.measures, yKey);
      if (x === null || y === null) continue;
      pts.push({ x: x, y: y });
    }
    return pts;
  }
  function labelOf(key) {
    if (!S) return String(key);
    var cols = S.spec.columns, i, c;
    for (i = 0; i < cols.length; i++) {
      c = cols[i];
      if (c.key === key) return String(c.label === undefined ? key : c.label) + (c.unit ? ' / ' + c.unit : '');
    }
    return String(key);
  }

  /* 结论：contract 的形状是 {text, equation, ionic, errors[]}。
     与物理不同的一点（有意）：**不要求先有数据** —— 化学结论多数由"做过这个反应"
     得出，探针在 open() 后立刻 conclude() 也应该拿到东西（组模块自己按 rows 判空）。 */
  function concludeCore() {
    if (!S || !isFn(S.spec.conclude)) return null;
    var r;
    try { r = S.spec.conclude(rowsSnap(), paramSnap(), CTX); }
    catch (e) { noteError(S.id, 'conclude', e); return null; }
    if (!r || typeof r !== 'object') return null;
    var errs = r.errors;
    if (errs === undefined || errs === null) errs = r.errorSources;
    if (!isArr(errs)) errs = (errs === undefined || errs === null || errs === '') ? [] : [String(errs)];
    var strs = [], i;
    for (i = 0; i < errs.length; i++) { if (str(errs[i]).replace(/\s/g, '')) strs.push(str(errs[i])); }
    if (strs.length < 2) note('cerr', 'conclude() 的 errors 少于 2 条（契约 §4.4 要求 ≥2 条）');
    var out = {
      text: str(r.text),
      equation: str(r.equation),
      ionic: str(r.ionic),
      errors: strs,
      balance: { equation: balSummary(balance(str(r.equation))), ionic: balSummary(balance(str(r.ionic))) }
    };
    if (r.value !== undefined) out.value = r.value;
    if (r.unit !== undefined) out.unit = str(r.unit);
    if (r.note !== undefined) out.note = str(r.note);
    if (!out.balance.equation.ok && out.equation && out.balance.equation.status === 'unbalanced') {
      note('cbal', 'conclude() 的方程式没通过配平校验：' + out.balance.equation.reason);
    }
    return out;
  }

  /* 条件写入（夹范围 + 按归一化后的 step 吸附）。不动现象表。 */
  function setParamCore(key, value) {
    if (!S) return false;
    var d = paramDef(S.spec, key);
    if (!d) return false;
    /* 选项型条件（type:'select' + options）：按**选项原值**匹配、原样存入（类型不丢）。
       旧写法一律 Number(value) —— 催化剂 'MnO2' → NaN → 直接 false，下拉框切不动。 */
    if (isSelectParam(d)) {
      var o = optionOf(d, value);
      if (!o) return false;
      S.params[key] = o.value;
      return true;
    }
    var n = Number(value);
    if (!isFinite(n)) return false;
    var lo = num(d.min, NaN), hi = num(d.max, NaN);
    var stp = num(S.steps ? S.steps[key] : NaN, NaN);
    if (isFinite(lo) && n < lo) n = lo;
    if (isFinite(hi) && n > hi) n = hi;
    /* 只有给了量程才吸附（没量程的参数是"数字输入框"通道，硬吸附会把 0.001 吸成 0） */
    if (isFinite(lo) && isFinite(stp) && stp > 0) {
      n = lo + Math.round((n - lo) / stp) * stp;
      n = Number(n.toFixed(6));
    }
    S.params[key] = n;
    return true;
  }
  function stepOf(key) {
    var s = (S && S.steps) ? S.steps[key] : NaN;
    return (isFinite(s) && s > 0) ? s : 0.01;
  }

  function stateCore() {
    return {
      open: !!(V || S),
      id: S ? S.id : null,
      name: S ? nameOf(S.spec, S.id) : '',
      group: S ? groupOf(S.spec) : '',
      running: !!(S && S.st.running),
      t: S ? S.st.t : 0,
      rows: S ? S.rows.length : 0,
      canvas: V ? { w: V.W, h: V.H } : { w: 0, h: 0 },
      columns: S ? S.spec.columns.length : 0,
      qualitative: S ? !hasGraph(S.spec) : true,
      params: S ? clone(S.params) : null,
      warnings: S ? textsOf(S.warnings) : [],
      lastError: S ? S.lastError : '',
      /* 闸门①：本会话穿过核心这一层的异常数（**不含组内自己 catch 的**）
         draw = spec.draw 抛的；react = spec.react 抛的（核心吞掉、不出行、不抛给调用方） */
      drawErrors: runErrCount('draw', S ? S.id : null),
      drawErrorsTotal: runErrTotal('draw'),
      reactErrors: runErrCount('react', S ? S.id : null),
      reactErrorsTotal: runErrTotal('react'),
      errorCounts: {
        draw: runErrCount('draw', S ? S.id : null),
        react: runErrCount('react', S ? S.id : null),
        step: runErrCount('step', S ? S.id : null),
        pointer: runErrCount('pointer', S ? S.id : null),
        conclude: runErrCount('conclude', S ? S.id : null)
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 样式：全部注入 #clCSS（选择器一律 cl- 前缀，不碰 css/style.css）      *
   * ------------------------------------------------------------------ */
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* 外壳：与观澜/物理实验台同一套深色（#070b14 / rgba(8,12,24) / #4fc3f7） */
      '.cl-root{position:absolute;left:0;top:0;right:0;bottom:0;z-index:8;display:flex;flex-direction:column;',
      'background:#070b14;color:#c8d4e4;font-family:Georgia,"Times New Roman",serif;font-size:13px;line-height:1.55;',
      'overflow:hidden;-webkit-tap-highlight-color:transparent;text-align:left}',
      '.cl-top{flex:none;display:flex;align-items:center;gap:10px;padding:6px 12px;',
      'border-bottom:1px solid rgba(120,160,220,.18);background:rgba(8,12,24,.92)}',
      '.cl-title{flex:none;font-style:italic;font-size:13.5px;color:#dff2ff;letter-spacing:.5px;white-space:nowrap}',
      '.cl-sub{flex:1;min-width:0;font-size:12px;color:#8fa3c0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cl-stat{flex:none;font-size:11.5px;color:#4fc3f7;white-space:nowrap}',
      '.cl-body{flex:1;min-height:0;display:flex}',
      /* 左栏：反应清单 + 目的/原理/器材/步骤 */
      '.cl-left{flex:none;width:236px;min-height:0;overflow-y:auto;padding:6px 8px 16px;',
      'background:rgba(10,16,30,.55);border-right:1px solid rgba(120,160,220,.18)}',
      '.cl-grp{padding:9px 4px 4px;margin-bottom:3px;font-size:11.5px;letter-spacing:1px;color:#6f86a6;',
      'border-bottom:1px solid rgba(120,160,220,.12)}',
      '.cl-item{display:block;width:100%;margin:2px 0;padding:6px 8px;text-align:left;border:1px solid transparent;',
      'border-radius:7px;background:transparent;color:#a9bcd4;font-family:inherit;font-size:12.5px;cursor:pointer;',
      'transition:color .16s,background .16s,border-color .16s}',
      '.cl-item:hover{color:#dff2ff;background:rgba(79,195,247,.12)}',
      '.cl-item.cl-on{color:#070b14;background:#f4f1ea;border-color:#f4f1ea;font-style:italic}',
      '.cl-info{margin-top:10px}',
      '.cl-sec{margin:0 0 6px;border:1px solid rgba(120,160,220,.14);border-radius:8px;background:rgba(9,14,26,.5)}',
      '.cl-sech{display:block;width:100%;padding:6px 8px;text-align:left;border:0;background:transparent;color:#8fa3c0;',
      'font-family:inherit;font-size:12px;cursor:pointer;letter-spacing:.5px}',
      '.cl-sech:hover{color:#dff2ff}',
      '.cl-arrow{float:right;color:#4fc3f7}',
      '.cl-secb{padding:0 9px 8px;font-size:12px;line-height:1.75;color:#b9c7da;word-break:break-word}',
      '.cl-sec.cl-fold .cl-secb{display:none}',
      '.cl-ul{margin:0;padding-left:16px}.cl-ul li{margin:2px 0}',
      '.cl-ol{margin:0;padding-left:18px}.cl-ol li{margin:3px 0}',
      /* 中栏：米白实验台 + 顶部细工具条 */
      '.cl-mid{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:#05080f}',
      '.cl-bar{flex:none;display:flex;align-items:center;gap:6px;padding:5px 8px;',
      'border-bottom:1px solid rgba(120,160,220,.18);background:rgba(8,12,24,.92)}',
      '.cl-bar button{flex:none;height:26px;padding:0 10px;border:1px solid rgba(120,160,220,.18);border-radius:7px;',
      'background:transparent;color:#8fa3c0;font-family:inherit;font-size:12px;cursor:pointer;white-space:nowrap;',
      'transition:all .2s}',
      '.cl-bar button:hover{color:#fff;border-color:rgba(79,195,247,.5);background:rgba(79,195,247,.14)}',
      '.cl-bar button:active{transform:scale(.96)}',
      '.cl-bar button.cl-go{border-color:transparent;background:linear-gradient(135deg,#2f80ed,#1e5bb8);color:#fff}',
      '.cl-hint{flex:1;min-width:0;font-size:11.5px;font-style:italic;color:#8fa3c0;text-align:right;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cl-stagewrap{position:relative;flex:1;min-height:0;overflow:hidden;background:#F4F1EA}',
      '.cl-canvas{position:absolute;left:0;top:0;display:block;background:#F4F1EA;touch-action:none}',
      /* 右栏：条件区 / 现象表 / 结论卡 */
      '.cl-right{flex:none;width:420px;min-height:0;overflow-y:auto;padding:8px;',
      'background:rgba(10,16,30,.55);border-left:1px solid rgba(120,160,220,.18)}',
      '.cl-card{margin:0 0 8px;border:1px solid rgba(120,160,220,.14);border-radius:9px;background:rgba(9,14,26,.55)}',
      '.cl-cardh{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 9px;',
      'border-bottom:1px solid rgba(120,160,220,.12);font-size:12px;color:#8fa3c0;letter-spacing:.5px}',
      '.cl-count{font-size:11px;color:#4fc3f7;white-space:nowrap}',
      '.cl-params{padding:6px 9px 9px}',
      '.cl-prow{margin:7px 0 0}',
      '.cl-plabel{display:flex;justify-content:space-between;gap:6px;font-size:11.5px;color:#9fb2c9}',
      '.cl-pval{color:#dff2ff;font-style:italic;white-space:nowrap}',
      '.cl-prange{display:block;width:100%;height:16px;margin:3px 0 0;accent-color:#4fc3f7;cursor:pointer}',
      /* 选项型条件（type:'select' + options）用下拉框 */
      '.cl-psel{display:block;width:100%;height:24px;margin:4px 0 0;padding:0 5px;',
      'border:1px solid rgba(120,160,220,.28);border-radius:6px;background:#0a101e;color:#dff2ff;',
      'font-family:inherit;font-size:11.5px;cursor:pointer}',
      '.cl-psel:focus{border-color:#4fc3f7;outline:none}',
      /* 没有 min/max 的兜底数字输入框（约定 ④ 要求这种参数写成 select，体检会 warn） */
      '.cl-pnum{display:block;width:100%;height:24px;margin:4px 0 0;padding:0 5px;box-sizing:border-box;',
      'border:1px solid rgba(120,160,220,.28);border-radius:6px;background:#0a101e;color:#dff2ff;',
      'font-family:inherit;font-size:11.5px}',
      '.cl-pnum:focus{border-color:#4fc3f7;outline:none}',
      /* 现象表 */
      '.cl-warnbar{margin:6px 9px 0;padding:4px 6px;border:1px solid rgba(255,120,110,.45);border-radius:6px;',
      'background:rgba(120,30,25,.18);color:#ff9b90;font-size:11.5px;line-height:1.6}',
      '.cl-warnbar-u{border-color:rgba(230,180,60,.45);background:rgba(120,90,20,.18);color:#e8c76a}',
      '.cl-tablewrap{max-height:340px;overflow:auto;padding:4px 6px 8px}',
      /* 现象表：列固定为「第几次/现象/方程式/条件」（契约 §3）。定量列的数字折进
         条件格里显示 —— 实测把定量列也做成表格列时，7 列挤在 400px 的右栏里会变成
         "一个字一行"，完全读不了（真浏览器截图确认）。 */
      '.cl-table{width:100%;table-layout:fixed;border-collapse:collapse;font-family:Georgia,"Times New Roman",serif;font-size:11.5px}',
      /* 表头吸顶：新行追加后核心会自动滚到底（让最新一次观察可见），表头不能被滚掉 */
      '.cl-th{padding:4px 5px;text-align:left;color:#8fa3c0;font-weight:400;line-height:1.35;',
      'position:sticky;top:0;background:#0d1524;z-index:1;',
      'border-bottom:1px solid rgba(120,160,220,.18)}',
      '.cl-thn{text-align:center;width:54px}',
      '.cl-thp{width:31%}',
      '.cl-the{width:31%}',
      '.cl-u{color:#5f7594;font-size:10px}',
      '.cl-td{padding:4px 5px;vertical-align:top;color:#cfdcec;border-bottom:1px solid rgba(120,160,220,.08);',
      'word-break:break-word;overflow-wrap:break-word}',
      '.cl-tdn{text-align:center;color:#5f7594}',
      '.cl-phen{margin:0;padding-left:14px}.cl-phen li{margin:1px 0;color:#dbe6f4}',
      '.cl-eq{color:#dff2ff;word-break:break-word}',
      '.cl-eqbad{margin-top:2px;color:#ff8a80;font-size:11px;line-height:1.55;font-style:italic}',
      '.cl-eqwarn{margin-top:2px;color:#e8c76a;font-size:11px;line-height:1.55;font-style:italic}',
      '.cl-eqnote{margin-top:2px;color:#6f86a6;font-size:11px;line-height:1.55;font-style:italic}',
      '.cl-cond2{margin-top:2px;color:#6f86a6;font-size:11px;font-style:italic}',
      '.cl-empty{padding:10px 9px;font-size:11.5px;font-style:italic;color:#6f86a6}',
      /* 图像（有定量列才出现） */
      '.cl-graph{display:block;width:100%;background:#F4F1EA;border-radius:0 0 8px 8px}',
      '.cl-gnote{padding:3px 9px 7px;font-size:11px;font-style:italic;color:#8fa3c0}',
      /* 结论卡 */
      '.cl-concl{padding:8px 9px 10px}',
      '.cl-cval{font-size:19px;font-style:italic;color:#dff2ff}',
      '.cl-cunit{margin-left:4px;font-size:12px;color:#8fa3c0}',
      '.cl-ctext{margin-top:5px;font-size:12px;line-height:1.75;color:#c8d4e4;white-space:pre-wrap}',
      '.cl-eqline{margin-top:6px;font-size:12px;color:#dff2ff;word-break:break-word}',
      '.cl-ionline{margin-top:3px;font-size:11.5px;color:#9fb2c9;word-break:break-word}',
      '.cl-ckey{color:#6f86a6}',
      '.cl-cerr{margin:7px 0 0;padding-left:16px}',
      '.cl-cerr li{margin:2px 0;font-size:11.5px;color:#9fb2c9}',
      '.cl-cempty{padding:8px 9px;font-size:11.5px;font-style:italic;color:#6f86a6}',
      '.cl-warn{margin:6px 9px 0;font-size:11px;color:#c9a227;line-height:1.6}',
      /* 窄屏（≤768px）：三栏改上下堆叠，整块可滚，实验台仍可玩 */
      '@media (max-width:768px){',
      '.cl-body{flex-direction:column;overflow-y:auto}',
      '.cl-left{flex:none;width:auto;max-height:30vh;border-right:0;border-bottom:1px solid rgba(120,160,220,.18)}',
      '.cl-mid{flex:none;width:auto;height:54vh}',
      '.cl-right{flex:none;width:auto;overflow:visible;border-left:0}',
      '.cl-hint{display:none}',
      '.cl-top{flex-wrap:wrap;gap:4px 8px}',
      '}'
    ].join('');
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  function dropCSS() {
    var st = document.getElementById(CSS_ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
  }

  /* ------------------------------------------------------------------ *
   * 视图（DOM 层）：mount() 才建，unmount() 全撤                          *
   * ------------------------------------------------------------------ */
  function createView(host, opts) {
    opts = opts || {};
    var alive = true;
    var W = 320, H = 240, dpr = 1;
    var GW = 340, GH = 168;
    var c2d = null, g2d = null;
    var rafId = 0, lastMs = 0;
    var folded = { aim: false, principle: false, apparatus: false, steps: false };

    /* ---- 骨架 ---- */
    var root = cel('div', 'cl-root'); root.id = 'clRoot';
    var top = cel('div', 'cl-top'); root.appendChild(top);
    var elTitle = cel('span', 'cl-title', '🧪 化学实验台'); top.appendChild(elTitle);
    var elSub = cel('span', 'cl-sub', ''); top.appendChild(elSub);
    var elStat = cel('span', 'cl-stat', ''); top.appendChild(elStat);
    var body = cel('div', 'cl-body'); root.appendChild(body);

    var left = cel('div', 'cl-left'); body.appendChild(left);
    var elList = cel('div', 'cl-list'); left.appendChild(elList);
    var elInfo = cel('div', 'cl-info'); left.appendChild(elInfo);

    var mid = cel('div', 'cl-mid'); body.appendChild(mid);
    var bar = cel('div', 'cl-bar'); mid.appendChild(bar);
    var btnRun = cel('button', 'cl-btn-run', '▶ 开始'); btnRun.type = 'button'; btnRun.id = 'clBtnRun'; btnRun.title = '开始 / 暂停动画'; bar.appendChild(btnRun);
    var btnReact = cel('button', 'cl-btn-react', '🔬 观察一次'); btnReact.type = 'button'; btnReact.id = 'clBtnReact'; btnReact.title = '按当前条件做一次反应，追加一行现象'; bar.appendChild(btnReact);
    var btnReset = cel('button', 'cl-btn-reset', '↺ 重置'); btnReset.type = 'button'; btnReset.id = 'clBtnReset'; btnReset.title = '条件回默认值、时间归零（保留现象表）'; bar.appendChild(btnReset);
    var btnClear = cel('button', 'cl-btn-clear', '清空'); btnClear.type = 'button'; btnClear.id = 'clBtnClear'; btnClear.title = '清空现象表与图像'; bar.appendChild(btnClear);
    var elHint = cel('span', 'cl-hint', ''); bar.appendChild(elHint);

    var stageWrap = cel('div', 'cl-stagewrap'); mid.appendChild(stageWrap);
    var cv = cel('canvas', 'cl-canvas'); cv.id = 'clCanvas'; stageWrap.appendChild(cv);

    var right = cel('div', 'cl-right'); body.appendChild(right);
    /* 条件区（契约 §3：滑块 + type:'select' 下拉框） */
    var cardP = cel('div', 'cl-card'); right.appendChild(cardP);
    cardP.appendChild(cel('div', 'cl-cardh', '反应条件'));
    var elParams = cel('div', 'cl-params'); cardP.appendChild(elParams);
    /* 现象表 */
    var cardT = cel('div', 'cl-card'); right.appendChild(cardT);
    var thT = cel('div', 'cl-cardh'); cardT.appendChild(thT);
    thT.appendChild(cel('span', '', '现象记录'));
    var elCount = cel('span', 'cl-count', '0 次'); thT.appendChild(elCount);
    var elWarnBar = cel('div', 'cl-warnbar'); elWarnBar.style.display = 'none'; cardT.appendChild(elWarnBar);
    var elTable = cel('div', 'cl-tablewrap'); elTable.id = 'clTableWrap'; cardT.appendChild(elTable);
    /* 图像（只有声明了定量列 + graph 的反应才出现，纯定性反应整张卡片隐藏） */
    var cardG = cel('div', 'cl-card'); right.appendChild(cardG);
    var thG = cel('div', 'cl-cardh'); cardG.appendChild(thG);
    thG.appendChild(cel('span', '', '图像'));
    var elFitTag = cel('span', 'cl-count', ''); thG.appendChild(elFitTag);
    var gcv = cel('canvas', 'cl-graph'); gcv.id = 'clGraph'; cardG.appendChild(gcv);
    var elGNote = cel('div', 'cl-gnote', ''); cardG.appendChild(elGNote);
    /* 结论卡 */
    var cardC = cel('div', 'cl-card'); right.appendChild(cardC);
    cardC.appendChild(cel('div', 'cl-cardh', '实验结论'));
    var elConcl = cel('div', 'cl-concl'); cardC.appendChild(elConcl);
    /* 体检提示（参数/结构 warning，来自 register 与运行期） */
    var cardW = cel('div', 'cl-card'); right.appendChild(cardW);
    cardW.appendChild(cel('div', 'cl-cardh', '体检提示'));
    var elWarn = cel('div', 'cl-warn'); cardW.appendChild(elWarn);

    host.appendChild(root);

    /* ---- 画布尺寸 ---- */
    function resize() {
      if (!alive) return;
      var w = stageWrap.clientWidth, h = stageWrap.clientHeight;
      if (!w || !h) { w = host.clientWidth; h = host.clientHeight; }
      W = Math.max(200, Math.floor(w || 640));
      H = Math.max(160, Math.floor(h || 420));
      dpr = num(window.devicePixelRatio, 1);
      if (dpr < 1) dpr = 1;
      if (dpr > 2) dpr = 2;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      c2d = cv.getContext('2d');
      GW = Math.max(200, Math.floor(gcv.clientWidth || 340));
      GH = 168;
      gcv.width = Math.round(GW * dpr); gcv.height = Math.round(GH * dpr);
      gcv.style.height = GH + 'px';
      g2d = gcv.getContext('2d');
      if (view) { view.W = W; view.H = H; }
      draw(); renderGraph();
    }

    /* ---- 舞台绘制 ---- */
    function makeG() {
      var s = Math.min(W / 760, H / 470);
      if (!(s > 0)) s = 1;
      if (s < 0.5) s = 0.5;
      if (s > 2) s = 2;
      return {
        c: c2d, w: W, h: H, dpr: dpr, scale: s, paper: PAPER, ink: INK,
        font: function (size, style, bold) { return fontCss(size, style, bold); },
        text: function (s1, x, y, size, align, color) {
          c2d.save();
          c2d.font = this.font(size);
          c2d.fillStyle = color || INK;
          c2d.textAlign = align || 'left';
          c2d.textBaseline = 'alphabetic';
          c2d.fillText(String(s1), x, y);
          c2d.restore();
        },
        line: function (x1, y1, x2, y2, color, width, dash) {
          c2d.save();
          c2d.strokeStyle = color || INK;
          c2d.lineWidth = width || 1;
          if (dash) c2d.setLineDash(dash);
          c2d.beginPath(); c2d.moveTo(x1, y1); c2d.lineTo(x2, y2); c2d.stroke();
          c2d.restore();
        },
        arrow: function (x1, y1, x2, y2, color, width) {
          c2d.save();
          c2d.strokeStyle = color || INK; c2d.fillStyle = color || INK;
          c2d.lineWidth = width || 1.4;
          c2d.beginPath(); c2d.moveTo(x1, y1); c2d.lineTo(x2, y2); c2d.stroke();
          var a = Math.atan2(y2 - y1, x2 - x1), L = 8;
          c2d.beginPath();
          c2d.moveTo(x2, y2);
          c2d.lineTo(x2 - L * Math.cos(a - 0.4), y2 - L * Math.sin(a - 0.4));
          c2d.lineTo(x2 - L * Math.cos(a + 0.4), y2 - L * Math.sin(a + 0.4));
          c2d.closePath(); c2d.fill();
          c2d.restore();
        },
        /* —— 化学向的顺手小工具（可选；组里也可以只用 c 自己画）—— */
        rect: function (x, y, w, h, color, fill) {
          c2d.save();
          if (fill) { c2d.fillStyle = color || INK; c2d.fillRect(x, y, w, h); }
          else { c2d.strokeStyle = color || INK; c2d.lineWidth = 1.2; c2d.strokeRect(x, y, w, h); }
          c2d.restore();
        },
        circle: function (x, y, r, color, fill, lw) {
          c2d.save();
          c2d.beginPath(); c2d.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
          if (fill) { c2d.fillStyle = color || INK; c2d.fill(); }
          else { c2d.strokeStyle = color || INK; c2d.lineWidth = lw || 1.2; c2d.stroke(); }
          c2d.restore();
        },
        /* —— 容器内腔（圆底试管 / 圆底烧瓶 / 方槽）：把"内腔路径"抽出来给**液体与沉淀共用** ——
           为什么必须有它：六个组各自那套试管（ions / organic / analysis / kinetics / electro 形状本来就不同，
           **故意不统一**）以前都用"矩形"去填液体与沉淀 —— 圆底处矩形会伸到管壁之外、
           还把轮廓线盖掉（实测 feoh3-precip：沉淀是一个盖住圆底、左右各溢出约 6px 的方块）。
           约定：**调用方给了内腔就必须被裁剪**（给了 cav 却不裁剪 = 缺陷）。
           cav 两种形状（用 r 区分）：
             圆底腔 {cx, y, r, h}  cx = 中轴，y = 腔口 y，r = 内腔半径，h = 含圆底的总高
             方  腔 {x, y, w, h}  左上角 + 宽高 */
        cavityPath: function (cav) {
          if (!cav || !c2d) return false;
          c2d.beginPath();
          if (cav.r > 0) {
            var yb = cav.y + cav.h - cav.r;
            c2d.moveTo(cav.cx - cav.r, cav.y);
            c2d.lineTo(cav.cx - cav.r, yb);
            c2d.arc(cav.cx, yb, cav.r, Math.PI, 0, true);   /* 下半圆 = 圆底 */
            c2d.lineTo(cav.cx + cav.r, cav.y);
          } else {
            c2d.moveTo(cav.x, cav.y);
            c2d.lineTo(cav.x + cav.w, cav.y);
            c2d.lineTo(cav.x + cav.w, cav.y + cav.h);
            c2d.lineTo(cav.x, cav.y + cav.h);
          }
          c2d.closePath();
          return true;
        },
        clipCavity: function (cav) {
          if (!this.cavityPath(cav)) return false;
          if (!c2d.clip) return false;
          c2d.clip();
          return true;
        },
        save: function () { if (c2d) c2d.save(); },
        restore: function () { if (c2d) c2d.restore(); },
        /* 液体：从 (x,y) 起、宽 w、深 h，带一条液面线 */
        liquid: function (x, y, w, h, color) {
          c2d.save();
          c2d.fillStyle = color || 'rgba(120,180,220,.45)';
          c2d.fillRect(x, y, w, h);
          c2d.strokeStyle = color || 'rgba(60,110,150,.7)';
          c2d.lineWidth = 1;
          c2d.beginPath(); c2d.moveTo(x, y); c2d.lineTo(x + w, y); c2d.stroke();
          c2d.restore();
        },
        /* 气泡：只描边的小圆（H2/CO2 冒泡） */
        bubble: function (x, y, r, color, lw) {
          c2d.save();
          c2d.strokeStyle = color || 'rgba(38,34,28,.6)';
          c2d.lineWidth = lw || 1;
          c2d.beginPath(); c2d.arc(x, y, Math.max(0.6, r), 0, Math.PI * 2); c2d.stroke();
          c2d.restore();
        },
        /* 沉淀/浑浊：一团抖动的小点。cav 给了就**必须**被裁剪在内腔里（第 6 个参数） */
        cloud: function (x, y, r, color, n, cav) {
          c2d.save();
          if (cav && this.clipCavity(cav)) { /* 已裁剪到内腔 */ }
          c2d.fillStyle = color || 'rgba(38,34,28,.5)';
          var cnt = n || 14, i, a, rr;
          for (i = 0; i < cnt; i++) {
            a = (i / cnt) * Math.PI * 2;
            rr = r * (0.25 + 0.75 * ((i * 37) % 100) / 100);
            c2d.beginPath();
            c2d.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, 1.4, 0, Math.PI * 2);
            c2d.fill();
          }
          c2d.restore();
        }
      };
    }
    function emptyHint() {
      if (!c2d) return;
      var g = makeG();
      c2d.save();
      c2d.font = g.font(Math.round(26 * g.scale));
      c2d.fillStyle = 'rgba(38,34,28,.82)';
      c2d.textAlign = 'center';
      c2d.fillText('化学实验台', W / 2, H / 2 - 10 * g.scale);
      c2d.font = g.font(Math.round(14 * g.scale));
      c2d.fillStyle = 'rgba(38,34,28,.55)';
      c2d.fillText('从左侧选一个反应：调条件 → 看现象 → 写方程式 → 得结论', W / 2, H / 2 + 18 * g.scale);
      c2d.strokeStyle = 'rgba(38,34,28,.28)';
      c2d.lineWidth = 1.5;
      c2d.beginPath();
      c2d.moveTo(W * 0.08, H * 0.82);
      c2d.lineTo(W * 0.92, H * 0.82);
      c2d.stroke();
      c2d.restore();
    }
    function drawErr(msg) {
      if (!c2d) return;
      c2d.save();
      c2d.font = 'italic 13px Georgia,"Times New Roman",serif';
      c2d.fillStyle = 'rgba(160,40,40,.9)';
      c2d.textAlign = 'left';
      c2d.fillText('绘图出错：' + String(msg).slice(0, 90), 14, H - 14);
      c2d.restore();
    }
    /* 每帧调用。**捕获 spec.draw 的异常**：一个反应画崩了不该把整个实验台带走，
       出错写在纸上，探针"draw() 不抛异常"这条仍然成立。 */
    function draw() {
      if (!alive || !c2d) return;
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.clearRect(0, 0, W, H);
      c2d.fillStyle = PAPER;
      c2d.fillRect(0, 0, W, H);
      if (!S) { emptyHint(); return; }
      var g = makeG();
      if (!isFn(S.spec.draw)) {
        g.text(nameOf(S.spec, S.id) + ' · 该反应没有提供画面（draw）', 18, 34, 15, 'left', 'rgba(38,34,28,.7)');
        return;
      }
      try { S.spec.draw(g, paramSnap(), S.st); }
      catch (e) {
        /* 闸门①：穿过 spec.draw 这一层的异常 → 计数 + lastError + 一次 console.warn，
           并且把错误写在纸上（探针"draw() 不抛异常"这条仍然成立）。 */
        var m = noteError(S.id, 'draw', e);
        drawErr(m);
      }
    }

    /* ---- rAF 循环（只在 running 时存在） ---- */
    var frameN = 0;
    function frame() {
      if (!alive) return;
      var now = Date.now();
      var dt = (now - lastMs) / 1000;
      lastMs = now;
      if (!(dt > 0)) dt = STEP;
      if (dt > 0.05) dt = 0.05;
      advance(dt);
      draw();
      frameN++;
      if (frameN % 6 === 0) updateStat();    // 状态行的 t 每 6 帧刷一次，别每帧写 DOM
      rafId = window.requestAnimationFrame(frame);
    }
    function play() {
      if (!alive || !S) return false;
      if (S.st.running) return true;
      S.st.running = true;
      lastMs = Date.now();
      if (!rafId) rafId = window.requestAnimationFrame(frame);
      updateButtons();
      return true;
    }
    function pause() {
      if (!S) return false;
      S.st.running = false;
      if (rafId) { try { window.cancelAnimationFrame(rafId); } catch (e) { /* 忽略 */ } rafId = 0; }
      updateButtons();
      return true;
    }
    function updateButtons() {
      var run = !!(S && S.st.running);
      btnRun.textContent = run ? '⏸ 暂停' : '▶ 开始';
      btnRun.className = run ? 'cl-btn-run cl-go' : 'cl-btn-run';
      btnRun.disabled = !S;
      btnReact.disabled = !S;
      btnReset.disabled = !S;
      btnClear.disabled = !S;
    }

    /* ---- 渲染：左栏清单 ---- */
    function renderList() {
      clr(elList);
      var gs = groupSeq(), gi, ids, ii, sp, b;
      for (gi = 0; gi < gs.length; gi++) {
        elList.appendChild(cel('div', 'cl-grp', gs[gi]));
        ids = idsInGroup(gs[gi]);
        for (ii = 0; ii < ids.length; ii++) {
          sp = REG[ids[ii]];
          b = cel('button', 'cl-item', nameOf(sp, ids[ii]));
          b.type = 'button';
          b.setAttribute('data-id', ids[ii]);
          b.title = ids[ii];
          if (S && S.id === ids[ii]) b.className = 'cl-item cl-on';
          b.addEventListener('click', onPick(ids[ii]));
          elList.appendChild(b);
        }
      }
      if (!ORDER.length) elList.appendChild(cel('div', 'cl-empty', '还没有登记反应（各组的 js/clab 组文件会把反应注册进来）'));
    }
    /* ⚠ 这里必须写 API.open，**不能写裸的 open(id)**：本作用域里没有 open，
       裸调用会解析到 window.open —— 点左栏反应变成去开一个新窗口（id 当 URL），
       桌面 WebView2 宿主把原生窗口拦掉，学生点了毫无反应。
       （同类陷阱：close / focus / print / stop / scroll 在 window 上都真实存在。） */
    function onPick(id) { return function () { API.open(id); if (V) V.sync(); }; }

    /* ---- 渲染：目的 / 原理 / 器材 / 步骤（可折叠） ---- */
    function section(key, title, bodyNode) {
      var sec = cel('div', 'cl-sec' + (folded[key] ? ' cl-fold' : ''));
      var h = cel('button', 'cl-sech', title);
      h.type = 'button';
      var ar = cel('span', 'cl-arrow', folded[key] ? '▸' : '▾');
      h.appendChild(ar);
      h.addEventListener('click', function () {
        folded[key] = !folded[key];
        if (folded[key]) sec.className = 'cl-sec cl-fold'; else sec.className = 'cl-sec';
        ar.textContent = folded[key] ? '▸' : '▾';
      });
      sec.appendChild(h);
      var b = cel('div', 'cl-secb');
      b.appendChild(bodyNode);
      sec.appendChild(b);
      return sec;
    }
    function textNode(t) { return document.createTextNode(str(t)); }
    function listNode(arr, ordered) {
      var ul = cel(ordered ? 'ol' : 'ul', ordered ? 'cl-ol' : 'cl-ul'), i, li;
      for (i = 0; i < arr.length; i++) { li = cel('li', ''); li.appendChild(textNode(arr[i])); ul.appendChild(li); }
      return ul;
    }
    function renderInfo() {
      clr(elInfo);
      if (!S) { elInfo.appendChild(cel('div', 'cl-empty', '左栏点一个反应，这里显示目的 / 原理 / 器材 / 步骤。')); return; }
      var sp = S.spec;
      elInfo.appendChild(section('aim', '实验目的', textNode(sp.aim || '（未填写）')));
      var pw = cel('div', '');
      var lines = str(sp.principle || '（未填写）').split('\n');
      var i;
      for (i = 0; i < lines.length; i++) {
        if (i) pw.appendChild(cel('br', ''));
        pw.appendChild(textNode(lines[i]));
      }
      elInfo.appendChild(section('principle', '反应原理', pw));
      elInfo.appendChild(section('apparatus', '实验器材', isArr(sp.apparatus) && sp.apparatus.length ? listNode(sp.apparatus, false) : textNode('（未填写）')));
      elInfo.appendChild(section('steps', '实验步骤', isArr(sp.steps) && sp.steps.length ? listNode(sp.steps, true) : textNode('（未填写）')));
    }

    /* ---- 渲染：条件区（滑块 / 下拉框 / 兜底数字框） ---- */
    var refs = {};
    function renderParams() {
      clr(elParams);
      refs = {};
      if (!S) { elParams.appendChild(cel('div', 'cl-empty', '—')); return; }
      var ps = S.spec.params;
      if (!isArr(ps) || !ps.length) { elParams.appendChild(cel('div', 'cl-empty', '该反应没有可调条件')); return; }
      var i, d, row, lab, name, val, rg, sel, j, o, op, nin;
      for (i = 0; i < ps.length; i++) {
        d = ps[i];
        if (!d || !d.key) continue;
        row = cel('div', 'cl-prow');
        lab = cel('div', 'cl-plabel');
        name = cel('span', '', String(d.label === undefined ? d.key : d.label) + (d.unit ? '（' + d.unit + '）' : ''));
        val = cel('span', 'cl-pval', fmtNum(S.params[d.key]));
        lab.appendChild(name); lab.appendChild(val); row.appendChild(lab);
        if (isSelectParam(d)) {
          sel = cel('select', 'cl-psel');
          sel.setAttribute('data-key', d.key);
          for (j = 0; j < d.options.length; j++) {
            o = d.options[j];
            if (!o) continue;
            op = cel('option', '');
            op.value = String(o.value);
            op.textContent = String(o.label === undefined || o.label === null ? o.value : o.label);
            sel.appendChild(op);
          }
          sel.value = String(S.params[d.key]);
          sel.addEventListener('change', onSelect(d.key));
          row.appendChild(sel);
          elParams.appendChild(row);
          refs[d.key] = { sel: sel, val: val };
          continue;
        }
        if (!hasRange(d)) {
          /* 约定 ④ 的兜底：没有 min/max 又没给 options → 数字输入框（体检已记 warning） */
          nin = cel('input', 'cl-pnum');
          nin.type = 'number';
          nin.setAttribute('data-key', d.key);
          nin.step = String(stepOf(d.key));
          nin.value = String(num(S.params[d.key], 0));
          nin.addEventListener('input', onNumber(d.key));
          nin.addEventListener('change', onNumber(d.key));
          row.appendChild(nin);
          elParams.appendChild(row);
          refs[d.key] = { num: nin, val: val };
          continue;
        }
        rg = cel('input', 'cl-prange');
        rg.type = 'range';
        rg.setAttribute('data-key', d.key);
        rg.min = String(d.min);
        rg.max = String(d.max);
        rg.step = String(stepOf(d.key));      // 归一化后的 step（与 setParam 的吸附同源）
        rg.value = String(isFinite(num(S.params[d.key], NaN)) ? S.params[d.key] : num(d.min, 0));
        rg.addEventListener('input', onSlider(d.key));
        row.appendChild(rg);
        elParams.appendChild(row);
        refs[d.key] = { range: rg, val: val };
      }
    }
    function onSlider(key) {
      return function (ev) {
        setParamCore(key, ev.target.value);
        var r = refs[key];
        if (r) r.val.textContent = fmtNum(S ? S.params[key] : ev.target.value);
        draw(); updateStat();
      };
    }
    function onNumber(key) {
      return function (ev) {
        setParamCore(key, ev.target.value);
        var r = refs[key];
        if (r) r.val.textContent = fmtNum(S ? S.params[key] : ev.target.value);
        draw(); updateStat();
      };
    }
    function onSelect(key) {
      return function (ev) {
        setParamCore(key, ev.target.value);
        var r = refs[key];
        if (r) r.val.textContent = fmtNum(S ? S.params[key] : ev.target.value);
        draw(); updateStat();
      };
    }
    function refreshParamValues() {
      var k, r;
      for (k in refs) {
        if (!has(refs, k)) continue;
        r = refs[k];
        if (S) {
          if (r.range && r.range.value !== String(S.params[k])) r.range.value = String(S.params[k]);
          if (r.sel && r.sel.value !== String(S.params[k])) r.sel.value = String(S.params[k]);
          if (r.num && r.num.value !== String(S.params[k])) r.num.value = String(S.params[k]);
          r.val.textContent = fmtNum(S.params[k]);
        }
      }
    }

    /* ---- 渲染：现象表（第几次 / 现象 / 方程式 / 条件 [+ 定量列]） ---- */
    function renderTable() {
      clr(elTable);
      elCount.textContent = (S ? S.rows.length : 0) + ' 次';
      /* 配平校验结果：**只有真的不守恒才标红**（并指出哪个元素）。
         "解析不了"用黄字提示；"本来就没有化学方程式"（焰色/萃取这类物理变化）用中性灰字，
         否则组里老实写"无化学方程式（…）"反而被当成错误。 */
      var lastBal = (S && S.rows.length) ? S.rows[S.rows.length - 1].balanced : null;
      if (lastBal && lastBal.status === 'unbalanced') {
        elWarnBar.style.display = '';
        elWarnBar.textContent = '⚠ 方程式未配平：' + (lastBal.reason || '（解析失败）');
      } else if (lastBal && lastBal.status === 'unparsed') {
        elWarnBar.style.display = '';
        elWarnBar.className = 'cl-warnbar cl-warnbar-u';
        elWarnBar.textContent = '⚠ 方程式解析不了（写法可能不规范）：' + (lastBal.error || lastBal.reason || '');
      } else {
        elWarnBar.style.display = 'none';
        elWarnBar.textContent = '';
      }
      elWarnBar.className = (lastBal && lastBal.status === 'unparsed') ? 'cl-warnbar cl-warnbar-u' : 'cl-warnbar';
      if (!S) { elTable.appendChild(cel('div', 'cl-empty', '尚无现象 — 点「🔬 观察一次」记录一次')); return; }
      var cols = S.spec.columns, i, j, row, t;
      if (!S.rows.length) {
        elTable.appendChild(cel('div', 'cl-empty', '尚无现象 — 点「🔬 观察一次」记录一次'));
        return;
      }
      t = cel('table', 'cl-table'); t.id = 'clTable';
      var thead = cel('thead', 'cl-thead'), htr = cel('tr', 'cl-tr');
      htr.appendChild(cel('th', 'cl-th cl-thn', '第几次'));
      htr.appendChild(cel('th', 'cl-th cl-thp', '现象'));
      htr.appendChild(cel('th', 'cl-th cl-the', '方程式'));
      htr.appendChild(cel('th', 'cl-th', '条件'));
      thead.appendChild(htr); t.appendChild(thead);
      var tb = cel('tbody', '');
      for (i = 0; i < S.rows.length; i++) {
        row = cel('tr', 'cl-tr');
        row.appendChild(cel('td', 'cl-td cl-tdn', String(S.rows[i].n)));
        /* 现象：一条一行（≥2 条是契约要求） */
        var tdPh = cel('td', 'cl-td');
        if (S.rows[i].phenomena.length) {
          var ul = cel('ul', 'cl-phen'), pi;
          for (pi = 0; pi < S.rows[i].phenomena.length; pi++) {
            ul.appendChild(cel('li', '', S.rows[i].phenomena[pi]));
          }
          tdPh.appendChild(ul);
        } else {
          tdPh.appendChild(cel('span', 'cl-cond2', '（未给出）'));
        }
        row.appendChild(tdPh);
        /* 方程式：不配平 → 红字 + 哪个元素不守恒 */
        var tdEq = cel('td', 'cl-td');
        var eqDiv = cel('div', 'cl-eq', S.rows[i].equation || '（未给出）');
        tdEq.appendChild(eqDiv);
        if (S.rows[i].balanced.status === 'unbalanced') {
          var badDiv = cel('div', 'cl-eqbad', '⚠ ' + (S.rows[i].balanced.reason || '未配平'));
          badDiv.title = S.rows[i].balanced.reason || '';
          tdEq.appendChild(badDiv);
        } else if (S.rows[i].balanced.status === 'unparsed') {
          tdEq.appendChild(cel('div', 'cl-eqwarn', '⚠ 解析不了：' + (S.rows[i].balanced.error || '')));
        } else if (S.rows[i].balanced.status === 'no-equation' && S.rows[i].equation) {
          tdEq.appendChild(cel('div', 'cl-eqnote', '（本反应没有化学方程式）'));
        } else if (S.rows[i].balanced.note) {
          tdEq.appendChild(cel('div', 'cl-cond2', '※ ' + S.rows[i].balanced.note));
        }
        if (S.rows[i].ionic) tdEq.appendChild(cel('div', 'cl-cond2', '离子式：' + S.rows[i].ionic));
        row.appendChild(tdEq);
        /* 条件（+ 类型 + 定量列的数字：折在这里显示，别把表挤成一条竖线） */
        var tdC = cel('td', 'cl-td');
        tdC.appendChild(cel('div', '', S.rows[i].conditions || '（未给出）'));
        if (S.rows[i].type) tdC.appendChild(cel('div', 'cl-cond2', S.rows[i].type));
        for (j = 0; j < cols.length; j++) {
          tdC.appendChild(cel('div', 'cl-cond2',
            String(cols[j].label === undefined ? cols[j].key : cols[j].label) + '：' +
            fmtNum(S.rows[i].measures[cols[j].key]) + (cols[j].unit ? ' ' + cols[j].unit : '')));
        }
        row.appendChild(tdC);
        tb.appendChild(row);
      }
      t.appendChild(tb);
      elTable.appendChild(t);
      try { elTable.scrollTop = elTable.scrollHeight; } catch (e) { /* 忽略 */ }
    }

    /* ---- 渲染：小图像（纯定性反应整卡隐藏） ---- */
    function renderGraph() {
      if (!g2d || !alive) return;
      var hasG = !!(S && hasGraph(S.spec));
      cardG.style.display = hasG ? '' : 'none';
      if (!hasG) {
        g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        g2d.fillStyle = GRAPH_PAPER; g2d.fillRect(0, 0, GW, GH);
        elFitTag.textContent = '';
        elGNote.textContent = '';
        return;
      }
      var d = graphData();
      g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      g2d.fillStyle = GRAPH_PAPER;
      g2d.fillRect(0, 0, GW, GH);
      var padL = 46, padR = 12, padT = 20, padB = 26;
      var x0 = padL, y0 = GH - padB, x1 = GW - padR, y1 = padT;
      var pts = d.points, i;
      elFitTag.textContent = d.fit ? ('r² = ' + fmtNum(d.fit.r2)) : '';
      elGNote.textContent = (d.title ? d.title + (d.note ? ' · ' : '') : '') + (d.note || '') +
        (d.skipped ? '（已跳过 ' + d.skipped + ' 个在这张图上无有效值的点）' : '') +
        (d.fitNote ? '⚠ ' + d.fitNote : '');
      if (!pts.length) {
        g2d.font = 'italic 12px Georgia,"Times New Roman",serif';
        g2d.fillStyle = 'rgba(38,34,28,.45)';
        g2d.textAlign = 'center';
        var msg;
        if (!S.rows.length) msg = '观察满 2 次后自动作图';
        else if (S.rows.length >= 2) msg = '这些数据在这张图上没有有效点（该条件下无测量值）';
        else msg = '观察满 2 次后自动作图';
        g2d.fillText(msg, GW / 2, GH / 2);
        return;
      }
      var xmin = pts[0].x, xmax = pts[0].x, ymin = pts[0].y, ymax = pts[0].y;
      for (i = 1; i < pts.length; i++) {
        if (pts[i].x < xmin) xmin = pts[i].x;
        if (pts[i].x > xmax) xmax = pts[i].x;
        if (pts[i].y < ymin) ymin = pts[i].y;
        if (pts[i].y > ymax) ymax = pts[i].y;
      }
      if (d.fit && d.fit.a === 0 && xmin > 0 && xmin / (xmax || 1) > 0.25) xmin = 0;
      if (xmax - xmin < EPS) { xmin -= 0.5; xmax += 0.5; }
      if (ymax - ymin < EPS) { ymin -= 0.5; ymax += 0.5; }
      var padx = (xmax - xmin) * 0.08, pady = (ymax - ymin) * 0.1;
      xmin -= padx; xmax += padx; ymin -= pady; ymax += pady;
      var sx = (x1 - x0) / (xmax - xmin), sy = (y1 - y0) / (ymax - ymin);
      function px(v) { return x0 + (v - xmin) * sx; }
      function py(v) { return y0 + (v - ymin) * sy; }
      var k, stepX = niceStep(xmax - xmin, 3), stepY = niceStep(ymax - ymin, 4), gv;
      g2d.font = '10px Georgia,"Times New Roman",serif';
      g2d.textAlign = 'center'; g2d.textBaseline = 'top';
      for (k = Math.ceil(xmin / stepX); k * stepX <= xmax; k++) {
        gv = k * stepX;
        g2d.strokeStyle = 'rgba(38,34,28,.10)';
        g2d.beginPath(); g2d.moveTo(px(gv), y0); g2d.lineTo(px(gv), y1); g2d.stroke();
        g2d.fillStyle = 'rgba(38,34,28,.62)';
        g2d.fillText(fmtTick(gv), px(gv), y0 + 4);
      }
      g2d.textAlign = 'right'; g2d.textBaseline = 'middle';
      for (k = Math.ceil(ymin / stepY); k * stepY <= ymax; k++) {
        gv = k * stepY;
        g2d.strokeStyle = 'rgba(38,34,28,.10)';
        g2d.beginPath(); g2d.moveTo(x0, py(gv)); g2d.lineTo(x1, py(gv)); g2d.stroke();
        g2d.fillStyle = 'rgba(38,34,28,.62)';
        g2d.fillText(fmtTick(gv), x0 - 5, py(gv));
      }
      g2d.strokeStyle = 'rgba(38,34,28,.55)';
      g2d.lineWidth = 1;
      g2d.beginPath(); g2d.moveTo(x0, y0); g2d.lineTo(x1, y0); g2d.stroke();
      g2d.beginPath(); g2d.moveTo(x0, y0); g2d.lineTo(x0, y1); g2d.stroke();
      g2d.fillStyle = '#1d4ed8';
      for (i = 0; i < pts.length; i++) {
        g2d.beginPath();
        g2d.arc(px(pts[i].x), py(pts[i].y), 2.6, 0, Math.PI * 2);
        g2d.fill();
      }
      if (d.fit) {
        var xa = xmin, xb = xmax;
        g2d.strokeStyle = 'rgba(180,60,40,.85)';
        g2d.lineWidth = 1.6;
        g2d.beginPath();
        g2d.moveTo(px(xa), py(d.fit.a + d.fit.b * xa));
        g2d.lineTo(px(xb), py(d.fit.a + d.fit.b * xb));
        g2d.stroke();
        g2d.textAlign = 'left'; g2d.textBaseline = 'top';
        g2d.font = 'italic 10.5px Georgia,"Times New Roman",serif';
        g2d.fillStyle = 'rgba(244,241,234,.86)';
        g2d.fillRect(x0 + 3, y1 + 1, 148, 40);
        g2d.fillStyle = 'rgba(150,40,30,.95)';
        g2d.fillText('y = a + b·x', x0 + 4, y1 + 2);
        g2d.fillText('b(斜率) = ' + fmtNum(d.fit.b), x0 + 4, y1 + 15);
        g2d.fillText('a(截距) = ' + fmtNum(d.fit.a) + '   r² = ' + fmtNum(d.fit.r2), x0 + 4, y1 + 28);
      }
      g2d.font = 'italic 10.5px Georgia,"Times New Roman",serif';
      g2d.fillStyle = 'rgba(38,34,28,.8)';
      g2d.textAlign = 'right'; g2d.textBaseline = 'bottom';
      g2d.fillText(d.xLabel || d.xKey, x1, GH - 2);
      g2d.save();
      g2d.translate(11, y1 + 4);
      g2d.rotate(-Math.PI / 2);
      g2d.textAlign = 'right'; g2d.textBaseline = 'top';
      g2d.fillText(d.yLabel || d.yKey, 0, 0);
      g2d.restore();
    }

    /* ---- 渲染：结论卡（结论 + 方程式 + 离子方程式 + ≥2 条注意） ---- */
    function eqLine(label, eq, bal) {
      var box = cel('div', 'cl-eqline');
      box.appendChild(cel('span', 'cl-ckey', label));
      box.appendChild(textNode(eq));
      if (bal && eq && bal.status === 'unbalanced') {
        box.appendChild(cel('div', 'cl-eqbad', '⚠ ' + (bal.reason || '未配平')));
      } else if (bal && eq && bal.status === 'unparsed') {
        box.appendChild(cel('div', 'cl-eqwarn', '⚠ 解析不了：' + (bal.error || '')));
      }
      return box;
    }
    function renderConcl() {
      clr(elConcl);
      if (!S) { elConcl.appendChild(cel('div', 'cl-cempty', '做过反应之后给出结论与注意事项')); return; }
      var c = concludeCore();
      if (!c) {
        var why = isFn(S.spec.conclude) ? '结论暂时算不出来。' : '该反应未提供结论函数（conclude）。';
        elConcl.appendChild(cel('div', 'cl-cempty', why));
        return;
      }
      if (c.value !== undefined && c.value !== null) {
        var v = cel('div', 'cl-cval', fmtNum(c.value));
        if (c.unit) v.appendChild(cel('span', 'cl-cunit', c.unit));
        elConcl.appendChild(v);
      }
      if (c.text) elConcl.appendChild(cel('div', 'cl-ctext', c.text));
      if (c.equation) elConcl.appendChild(eqLine('方程式：', c.equation, c.balance.equation));
      if (c.ionic) elConcl.appendChild(eqLine('离子方程式：', c.ionic, c.balance.ionic));
      if (c.note) elConcl.appendChild(cel('div', 'cl-cond2', c.note));
      if (c.errors && c.errors.length) {
        var ul = cel('ul', 'cl-cerr'), i;
        for (i = 0; i < c.errors.length; i++) ul.appendChild(cel('li', '', '⚠ ' + c.errors[i]));
        elConcl.appendChild(ul);
      }
    }

    /* ---- 渲染：体检提示 ---- */
    function renderWarnings() {
      clr(elWarn);
      var ws = (S && S.warnings) ? S.warnings : [];
      if (!ws.length) { elWarn.appendChild(cel('div', 'cl-cempty', '没有体检问题。')); return; }
      var ul = cel('ul', 'cl-cerr'), i;
      for (i = 0; i < ws.length; i++) ul.appendChild(cel('li', '', '• ' + ws[i].msg));
      elWarn.appendChild(ul);
    }

    function updateStat() {
      if (!S) { elStat.textContent = ''; elSub.textContent = '从左侧选择一个反应开始'; return; }
      elSub.textContent = groupOf(S.spec) + ' · ' + nameOf(S.spec, S.id);
      elStat.textContent = 't = ' + S.st.t.toFixed(2) + ' s · ' + S.rows.length + ' 次观察' + (S.st.running ? ' · 运行中' : '');
      elHint.textContent = S.lastError ? ('⚠ ' + S.lastError)
        : (S.rows.length ? '点「🔬 观察一次」继续记录；改条件后现象与量化量按化学规律变化' : '点「🔬 观察一次」记录第一次观察');
    }

    /* ---- 交互：工具条 ----
       ⚠ 这里一律写 view.xxx()（**不要写裸的 sync()/draw()**）：createView 作用域里
       没有这些名字的函数，它们只是 view 对象的方法 —— 裸调用会抛 ReferenceError，
       表现就是"🔬 观察一次 / ↺ 重置 / 清空 点了没反应"。 */
    btnRun.addEventListener('click', function () {
      if (!S) return;
      if (S.st.running) pause(); else play();
      updateStat();
    });
    btnReact.addEventListener('click', function () {
      if (!S) return;
      try { reactCore(1); } catch (e) { S.lastError = errMsg(e); }
      view.sync();
    });
    btnReset.addEventListener('click', function () {
      if (!S) return;
      S.params = defParams(S.spec);
      S.st.t = 0; S.st.phase = 0; S.st.hover = null; S.lastError = '';
      pause();
      view.sync();
    });
    btnClear.addEventListener('click', function () {
      if (!S) return;
      S.rows = []; S.seq = 0;
      syncRows();
      view.sync();
    });
    /* 指针事件转成图纸坐标后转给 spec.onPointer（契约 §3 可选） */
    function pointerEv(type) {
      return function (ev) {
        if (!S || !isFn(S.spec.onPointer)) return;
        var r = cv.getBoundingClientRect();
        try {
          S.spec.onPointer({ type: type, x: ev.clientX - r.left, y: ev.clientY - r.top }, paramSnap(), S.st);
        } catch (e) { noteError(S.id, 'pointer', e); }
        if (type === 'move' || type === 'down') draw();
      };
    }
    cv.addEventListener('pointerdown', function (ev) {
      try { if (cv.setPointerCapture) cv.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
      pointerEv('down')(ev);
    });
    cv.addEventListener('pointermove', pointerEv('move'));
    cv.addEventListener('pointerup', pointerEv('up'));
    cv.addEventListener('pointercancel', pointerEv('up'));

    /* ---- 尺寸自适应 ---- */
    var ro = null;
    function onWinResize() { resize(); }
    window.addEventListener('resize', onWinResize);
    if (window.ResizeObserver) {
      try { ro = new ResizeObserver(function () { resize(); }); ro.observe(stageWrap); } catch (e) { ro = null; }
    }

    /* ---- 视图对外 ---- */
    var view = {
      W: 0, H: 0,
      sync: function () {
        if (!alive) return;
        renderList(); renderInfo(); renderParams(); renderTable(); renderGraph();
        renderConcl(); renderWarnings();
        updateButtons(); updateStat(); draw();
        view.W = W; view.H = H;
      },
      light: function () { refreshParamValues(); updateStat(); draw(); },
      draw: draw,
      resize: resize,
      play: play,
      pause: pause,
      syncRows: function () { renderTable(); renderGraph(); renderConcl(); renderWarnings(); updateStat(); draw(); },
      destroy: function () {
        alive = false;
        if (rafId) { try { window.cancelAnimationFrame(rafId); } catch (e) { /* 忽略 */ } rafId = 0; }
        window.removeEventListener('resize', onWinResize);
        if (ro) { try { ro.disconnect(); } catch (e) { /* 忽略 */ } ro = null; }
        if (root.parentNode) root.parentNode.removeChild(root);
        if (typeof opts.onUnmount === 'function') {
          try { opts.onUnmount(); } catch (e) { /* 宿主收尾失败不影响拆解 */ }
        }
      }
    };
    resize();
    view.sync();
    updateButtons();
    return view;
  }

  /* ------------------------------------------------------------------ *
   * 对外 API                                                            *
   * ------------------------------------------------------------------ */
  var API = {
    build: BUILD,
    version: VERSION,

    /* 各组模块登记反应 */
    register: register,
    /* 排障用：读某个已登记 spec */
    spec: function (id) { return has(REG, id) ? REG[id] : null; },
    groups: groupSeq,
    /* 学科判据（demo.js 接线时用；核心自己不拿它拦 mount，与物理实验台一致） */
    isChemSubject: isChemSubject,

    /* 建舞台。opts: { onUnmount } —— 无论是谁拆的，宿主收尾都会跑 */
    mount: function (containerEl, opts) {
      if (!containerEl || !containerEl.appendChild) return false;
      if (V) API.unmount();
      resetRunErr();                       // 闸门①的 since 口径 = 自本次挂载以来
      injectCSS();
      V = createView(containerEl, opts || {});
      return true;
    },
    /* 只拆视图（保留当前反应会话，便于"收起再展开"）；#clCSS 一并撤掉 */
    unmount: function () {
      if (!V) return false;
      var v = V;
      V = null;
      try { v.destroy(); } catch (e) { /* 拆解失败也要把引用放掉 */ }
      dropCSS();
      return true;
    },
    isMounted: function () { return !!V; },

    list: list,

    /* 打开某反应（等于左栏点击）。未挂载时也能开 —— 会话先建好，mount() 时画出来。 */
    open: function (id) {
      if (typeof id !== 'string' || !has(REG, id)) return false;
      S = newSession(id);
      syncRows();
      if (V) V.sync();
      return true;
    },
    /* 退出实验台：拆 DOM + 关会话。返回是否真的关了。 */
    close: function () {
      var had = !!(V || S);
      if (V) API.unmount();
      S = null;
      return had;
    },

    current: function () {
      if (!S) return null;
      return {
        id: S.id,
        name: nameOf(S.spec, S.id),
        group: groupOf(S.spec),
        params: clone(S.params),
        rows: rowsSnap(),
        conclusion: concludeCore(),
        warnings: textsOf(S.warnings)
      };
    },
    params: function () { return S ? clone(S.params) : null; },
    columns: function () {
      if (!S) return [];
      var out = [], i, c;
      for (i = 0; i < S.spec.columns.length; i++) {
        c = S.spec.columns[i];
        out.push({ key: c.key, label: c.label === undefined ? c.key : c.label, unit: str(c.unit) });
      }
      return out;
    },

    /* 设条件（不动现象表）。返回是否写入成功。 */
    setParam: function (key, value) {
      var ok = setParamCore(key, value);
      if (ok && V) V.light();
      return ok;
    },

    /* ★ 独立地做 n 次观察（默认 1），返回新增的现象行（数组；末行字段也挂在数组上） */
    react: function (n) {
      if (!S) return [];
      var out = [];
      try { out = reactCore(n); }
      finally { if (V) V.syncRows(); }
      return out;
    },

    /* 清空现象表与图 */
    clear: function () {
      if (!S) return false;
      S.rows = [];
      S.seq = 0;
      syncRows();
      if (V) V.syncRows();
      return true;
    },

    /* 现象表快照（行数组；每行 = {n, phenomena, equation, ionic, type, conditions, measures, balanced}） */
    table: function () { return rowsSnap(); },

    /* 纯定性反应返回 null（契约 §4.7：这是**合法**的）；有定量列返回点集 + 拟合 */
    graph: function () {
      if (!S || !hasGraph(S.spec)) return null;
      var d = graphData();
      var pts = [], i;
      for (i = 0; i < d.points.length; i++) pts.push({ x: d.points[i].x, y: d.points[i].y });
      return {
        points: pts,
        fit: d.fit ? { a: d.fit.a, b: d.fit.b, r2: d.fit.r2 } : null,
        xLabel: d.xLabel, yLabel: d.yLabel, title: d.title, note: d.note,
        valid: d.valid, skipped: d.skipped,
        /* 退化：x 或 y 没有分布 → fit=null 且这里为 true（r² 不可用，别把 null 当 0） */
        degenerate: !!d.degenerate,
        fitNote: d.fitNote || ''
      };
    },
    conclude: concludeCore,

    /* 推进仿真 seconds 秒（固定步长 1/60），返回 { steps, t } */
    run: function (seconds) {
      var r = stepN(seconds);
      if (V) { V.draw(); V.syncRows(); }
      return r;
    },

    play: function () { return V ? V.play() : false; },
    pause: function () { return V ? V.pause() : false; },
    running: function () { return !!(S && S.st.running); },
    resize: function () { if (V) V.resize(); return V ? { w: V.W, h: V.H } : null; },

    state: stateCore,

    /* ★ 方程式配平校验（逐元素 + 电荷）。化学里唯一客观的对错判据。 */
    balance: balance,

    /* 闸门①：穿过核心这一层的异常次数。
       drawErrorCount(id) → spec.draw 抛的；reactErrorCount(id) → spec.react 抛的
       （react 的异常核心会吞掉、不出行、不冒给调用方；这里只是让它可见）
       不给 id = 全部反应的本会话合计。since 口径 = 自本次挂载以来。
       ⚠ **覆盖不到"组内自己 catch"的异常** —— 那是原理性上限，配合 shadowAudit 一起看。 */
    drawErrorCount: function (id) { return runErrCount('draw', id === undefined ? null : id); },
    reactErrorCount: function (id) { return runErrCount('react', id === undefined ? null : id); },
    /* 全族计数快照（排障用）：{draw:{since,total}, react:{…}, step:{…}, pointer:{…}} */
    errorCounts: function (id) {
      var rec = (id !== undefined && id !== null && has(RUN_ERR, id)) ? RUN_ERR[id] : null;
      var out = {}, i, kind, sl, k, t;
      for (i = 0; i < ERR_KINDS.length; i++) {
        kind = ERR_KINDS[i];
        if (rec) {
          sl = has(rec, kind) ? rec[kind] : { since: 0, total: 0 };
          out[kind] = { since: sl.since, total: sl.total };
        } else {
          t = { since: 0, total: 0 };
          for (k in RUN_ERR) {
            if (!has(RUN_ERR, k)) continue;
            sl = has(RUN_ERR[k], kind) ? RUN_ERR[k][kind] : null;
            if (sl) { t.since += sl.since; t.total += sl.total; }
          }
          out[kind] = t;
        }
      }
      return out;
    },
    /* 闸门②：静态遮蔽扫描。mode: 'var-called' | 'empty-catch'（不给 = 两者都回） */
    shadowAudit: function (mode) {
      var out = [], i, id, m;
      for (i = 0; i < ORDER.length; i++) {
        id = ORDER[i];
        m = META[id] || {};
        if (mode === 'var-called') {
          if (m.suspects && m.suspects.length) out.push({ id: id, suspects: m.suspects.slice(0) });
        } else if (mode === 'empty-catch') {
          if (m.emptyCatch && m.emptyCatch.length) out.push({ id: id, emptyCatch: m.emptyCatch.slice(0) });
        } else {
          out.push({ id: id, suspects: (m.suspects || []).slice(0), emptyCatch: (m.emptyCatch || []).slice(0) });
        }
      }
      return out;
    },

    /* 排障用：每个已登记反应的体检结论（参数 + 结构；哪一组不规范，一次看全） */
    audit: function () {
      var out = [], i, id, sp, m, g;
      for (i = 0; i < ORDER.length; i++) {
        id = ORDER[i];
        sp = REG[id];
        m = META[id] || { steps: {}, warnings: [] };
        g = hasGraph(sp) ? sp.graph : null;
        out.push({
          id: id,
          name: nameOf(sp, id),
          group: groupOf(sp),
          warnings: m.warnings.slice(0),
          steps: clone(m.steps),
          params: isArr(sp.params) ? sp.params.length : 0,
          columns: isArr(sp.columns) ? sp.columns.length : 0,
          qualitative: !g,
          graph: g ? { x: str(g.x), y: str(g.y), fit: (g.fit === undefined || g.fit === null) ? 'linear' : g.fit } : null,
          /* 闸门②：静态遮蔽（变量遮蔽）与空 catch —— 探针查这里或 shadowAudit() */
          suspects: (m.suspects || []).slice(0),
          emptyCatch: (m.emptyCatch || []).slice(0),
          has: {
            react: isFn(sp.react), conclude: isFn(sp.conclude), draw: isFn(sp.draw),
            step: isFn(sp.step), onPointer: isFn(sp.onPointer)
          }
        });
      }
      return out;
    },

    /* 会话内部快照（排障用，不参与逻辑） */
    debug: function () {
      return {
        registered: ORDER.length,
        groups: groupSeq(),
        session: S ? {
          id: S.id, params: clone(S.params), rows: S.rows.length, t: S.st.t, phase: S.st.phase,
          lastError: S.lastError, steps: clone(S.steps), warnings: textsOf(S.warnings)
        } : null,
        mounted: !!V
      };
    }
  };

  window.QG_CLAB = API;
})();
