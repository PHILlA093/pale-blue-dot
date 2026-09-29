/* ============================================================================
 * 穷观 · 物理实验台（Physics Lab Bench）· 可嵌入模块
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 「观澜」物理模式的第二块（第一块是 js/psandbox.js 物理符号沙盒）：
 *   沙盒 = 玩符号（把 m、g、a、v、r 拖到一起看它动）；实验台 = 做实验
 *   （调参数 → 看现象 → 记录数据 → 作图 → 得结论）。
 *
 * 本文件是**可嵌入模块**，页面加载它本身**不建任何 DOM、不起任何循环**：
 * 只有 mount(container) 之后才建舞台；unmount()/close() 之后连 #plCSS 一起撤干净。
 * 非物理科目下 demo.js 连入口按钮都不建，所以非物理科目里**不会**出现任何
 * pl- 前缀节点、也不会注入 #plCSS（硬约束，别破坏）。
 * 纯 ES5、零外部依赖、不用网络、不用 eval / Function 构造器（守观澜的严格 CSP）。
 *
 * ---------------------------------------------------------------------------
 * 对外接口 window.QG_PSLAB（设计契约 docs/物理实验台设计.md §6）：
 *   register(id, spec)      各组模块登记实验（组脚本只做这一件事，不自建 DOM）
 *   mount(el, opts)         往 el 里建三栏实验台；opts={onUnmount:fn}
 *   unmount()               拆掉 DOM / 全局事件 / rAF（保留当前实验会话）
 *   isMounted()             是否已挂载
 *   list()                  [{id,name,group}, ...]
 *   open(id)                打开实验（等于左栏点击）；返回 true/false
 *   close()                 退出实验台（拆 DOM 并清掉会话）；返回是否真的关了
 *   current()               {id,name,params,rows,conclusion} | null
 *   setParam(key, value)    设参数（夹到 min/max，按 step 吸附；**不动数据表**）
 *   measure(n)              连续测量 n 次（默认 1），返回新增的行数组
 *   clear()                 清空数据表与图
 *   graph()                 {points:[{x,y}], fit:{a,b,r2}|null, xLabel, yLabel}
 *   conclude()              {value,unit,text,errors[]} | null
 *   run(seconds)            推进仿真 seconds 秒（固定步长 1/60）
 *   state()                 {open,id,running,t,rows,canvas:{w,h}}
 * 附加（排障/自检用，契约没要求，但很有用）：spec(id) / params() / groups() /
 *   build / version / resize() / running() / play() / pause()。
 *
 * ---------------------------------------------------------------------------
 * 会话与视图是分开的：S = 当前实验会话（参数 + 数据 + 时钟），V = 已挂载的视图。
 * 于是 mount() 之前也能 register/open/measure/conclude（探针友好），mount() 只是
 * "把会话画出来"；unmount() 只拆视图，close() 才连会话一起关。
 *
 * 契约的两处**细化**（组模块作者请照这里写）：
 *   1) 时钟归属：spec.step 里若自己推进了 state.t（契约示例就是 state.t += dt），
 *      核心就不再动它；若 spec.step 没碰 state.t（或干脆没写 step），核心按
 *      state.t += dt 推进。这样"静态实验"也有时钟可动，"自管时钟的实验"不会
 *      被双倍计时。state.phase（0..1）同理：spec 没写就按 spec.cycle（默认 4 s）
 *      从 t 折算。
 *   2) measure/conclude 拿到的参数 p 是**每次新建的快照**（只读）；要改参数请用
 *      QG_PSLAB.setParam。draw 拿到的 state 是**活的**（spec 可写 state.hover /
 *      state.phase）。
 *
 * ---------------------------------------------------------------------------
 * 给**组模块作者**的三条（都是被真实踩过才加进来的，别绕开）：
 *   a) g.font(size, …) 是**宽容签名**，四种写法都行：
 *        g.font(13)                       → 斜体衬线（默认）
 *        g.font(13, true|false)           → 布尔 = 是否斜体
 *        g.font(13, 'italic bold')        → 字符串 = 原样拼进字体串（仍会校验合法性）
 *        g.font(13, italic, bold)         → 三参布尔形式
 *      **不要**把 true/false 拼进自己拼的字体串里：非法 font 会让 canvas 静默退回
 *      默认字体（纸色斜体观感整体丢失，而像素签名照样在变，肉眼与探针都难发现）。
 *      要自己拼就 g.font 之外别碰 c.font；核心会把最终串过一遍合法性校验。
 *   b) params 里的 step 会被**归一化**：未写 step → 0.01；显式 step<=0、step 大于
 *      量程、或 step==量程且量程两端都不是 0 → 一律改成 (max-min)/100，并记进
 *      state().warnings（控制台也会 warn）。二元量请老实写 min:0,max:1,step:1。
 *   c) 某次测量在物理上没有意义时（例：入射光频率低于截止频率 ν_c，不发生光电
 *      效应），该列请**返回 null**，不要返回 0 —— 核心在图线上会跳过这种行
 *      （数据表里显示「—」），不会把它当成真实的 0 画进图里。
 * ========================================================================== */
(function () {
  'use strict';

  var BUILD = 'QG-20260920-5e5d5a';
  var VERSION = '1.0.0';
  var CSS_ID = 'plCSS';
  var PAPER = '#F4F1EA';         // 实验台纸色（与 psandbox 同一张台面）
  var INK = '#26221C';           // 墨色
  var GRAPH_PAPER = '#F4F1EA';   // 小图像也是同一张纸
  var STEP = 1 / 60;             // run() 的固定步长
  var DEFAULT_CYCLE = 4;         // state.phase 的默认周期（秒）
  var MAX_MEASURE_PER_CALL = 500;
  var EPS = 1e-12;

  /* 六组的展示顺序（契约 §2）。未列出的组按注册先后排在后面。 */
  var GROUP_ORDER = ['力学', '电学基础', '磁场与电磁感应', '光学', '热学与分子', '近代物理'];

  /* ------------------------------------------------------------------ *
   * 小工具                                                              *
   * ------------------------------------------------------------------ */
  function isFn(f) { return typeof f === 'function'; }
  function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function warn(msg) {
    try { if (window.console && window.console.warn) window.console.warn('[QG_PSLAB] ' + msg); } catch (e) { /* 忽略 */ }
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
     **不能写成 Number(v)** —— Number(null) === 0、Number('') === 0，会把"这次测量
     物理上没有意义"伪装成真实的 0。真实的零（x=0 / y=0）照常返回 0。 */
  function coordOf(row, key) {
    var v = row ? row[key] : null;
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  /* 选项型参数（type:'select' + options）：值可以是字符串（阴极材料 'zn'）或数字（波长 435.8） */
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

  /* ------------------------------------------------------------------ *
   * 字体串：给组作者一个**宽容签名**                                     *
   *   g.font(size)                     默认斜体衬线                     *
   *   g.font(size, true|false)         布尔 = 是否斜体                   *
   *   g.font(size, 'italic bold')      字符串 = 原样拼接（仍校验合法性） *
   *   g.font(size, italic, bold)       三参（布尔形式）                   *
   * 为什么必须宽容：旧实现把第二个参数直接拼进字体串，组里按
   * fontFn(px, !!italic, !!bold) 的直觉一调就得到
   * "true 13px Georgia,serif" —— **非法字体串**，canvas 会**静默退回默认字体**，
   * 于是"纸色斜体"的整体观感丢了，而像素签名照样在变，探针根本抓不到。
   * 现在：绝不把 true/false/undefined 拼进串里，且最终串一律过 fontOK() 校验
   * （拿一次性 canvas 设 ctx.font 后回读，被静默忽略就说明非法 → 退回默认）。
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
      /* 字符串形式：原样拼接（opt.js / therm.js 就是这么调的：g.font(p, bold ? 'bold' : 'normal')） */
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
      /* 布尔形式：g.font(px) / g.font(px, italic) / g.font(px, italic, bold)（mag.js 是三参写法） */
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
   * 规则（文件头也写了一份给组作者）：                                    *
   *   · 未写 step / step 非数      → 0.01（契约惯例；量程比它还小则用 span/100）*
   *   · 显式 step <= 0             → span/100（没有 min/max 时用 1），记 warning *
   *   · step > 量程 span           → span/100，记 warning                 *
   *   · step == span 且量程两端都不是 0 → span/100，记 warning             *
   *     （0..1 step1、0..100 step100 这类"开关量/两档量"是合理的，放行）    *
   * 为什么要管：step 不合理时滑块会停在一串无意义的刻度上，**而且没有任何提示**。*
   * ------------------------------------------------------------------ */
  function normStep(d) {
    var lo = num(d.min, NaN), hi = num(d.max, NaN);
    var hasRange = isFinite(lo) && isFinite(hi) && hi > lo;
    var span = hasRange ? (hi - lo) : NaN;
    var raw = num(d.step, NaN);
    if (!isFinite(raw)) {
      if (hasRange && 0.01 > span) return { step: span / 100, warn: '' };
      return { step: 0.01, warn: '' };
    }
    if (!(raw > 0)) return { step: hasRange ? span / 100 : 1, warn: 'step 非正（' + raw + '）' };
    if (hasRange && (raw > span || (raw === span && lo !== 0 && hi !== 0))) {
      return { step: span / 100, warn: 'step（' + raw + '）与量程 [' + lo + ',' + hi + '] 不匹配' };
    }
    return { step: raw, warn: '' };
  }
  /* 参数体检：key 唯一 / min<max / value 落在 [min,max] / step 合理。
     不合格**不静默吞掉** —— 走 warn() 通道，同时原样留在 state().warnings 里。 */
  function paramAudit(id, spec) {
    var steps = {}, warns = [], seen = {}, i, k, d, lo, hi, v, ns;
    if (!isArr(spec.params)) return { steps: steps, warnings: warns };
    for (i = 0; i < spec.params.length; i++) {
      d = spec.params[i];
      if (!d || !d.key) { warns.push('params[' + i + '] 缺少 key（该参数已忽略）'); continue; }
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
      }
      ns = normStep(d);
      steps[k] = ns.step;
      if (ns.warn) warns.push('参数 ' + k + '：' + ns.warn + ' → 已改用 step = ' + ns.step);
    }
    return { steps: steps, warnings: warns };
  }
  /* 坐标轴刻度标签：比表格更短 */
  function fmtTick(v) {
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e4 || a < 1e-3) return n.toExponential(1);
    var s = n.toPrecision(3);
    if (s.indexOf('.') >= 0 && s.indexOf('e') < 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
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
  /* ctx：契约 §4 的 { rnd(seed), noise(sigma), t }。附加 index（第几次测量，从 0 起）。 */
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
   * 最小二乘拟合（契约 §6 graph().fit = {a,b,r2}；y = a + b·x）          *
   * ------------------------------------------------------------------ */
  function fitLinear(pts) {
    var n = pts.length, i, x, y;
    if (n < 2) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (i = 0; i < n; i++) { x = pts[i].x; y = pts[i].y; sx += x; sy += y; sxx += x * x; sxy += x * y; }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < EPS) return null;
    var b = (n * sxy - sx * sy) / den;
    var a = (sy - b * sx) / n;
    return { a: a, b: b, r2: r2Of(pts, a, b) };
  }
  /* 过原点拟合 y = b·x（玻意耳 p–1/V、胡克 F–x 这类"理论上过原点"的图线用） */
  function fitOrigin(pts) {
    var n = pts.length, i, sxx = 0, sxy = 0;
    if (n < 2) return null;
    for (i = 0; i < n; i++) { sxx += pts[i].x * pts[i].x; sxy += pts[i].x * pts[i].y; }
    if (Math.abs(sxx) < EPS) return null;
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
  var META = {};   // id -> { steps:{key:step}, warnings:[...] }（register 时的参数体检结果）

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

  /* 登记一个实验。必需：id / name / measure(fn) / columns(非空数组)。
     不合格**不登记**并 console.warn —— 宁可列表里少一个，也不要一个点了就炸的条目。 */
  function register(id, spec) {
    if (typeof id !== 'string' || !id) { warn('register: id 必须是非空字符串'); return false; }
    if (!spec || typeof spec !== 'object') { warn('register(' + id + '): spec 必须是对象'); return false; }
    if (!isFn(spec.measure)) { warn('register(' + id + '): 缺少 measure(p, ctx) 函数'); return false; }
    if (!isArr(spec.columns) || !spec.columns.length) { warn('register(' + id + '): columns 必须是非空数组'); return false; }
    var i, c;
    for (i = 0; i < spec.columns.length; i++) {
      c = spec.columns[i];
      if (!c || typeof c.key !== 'string' || !c.key) { warn('register(' + id + '): columns[' + i + '] 缺少 key'); return false; }
    }
    /* 补 id/name 只是方便，用 try 包住：组模块若把 spec 冻结了也不该登记失败 */
    try {
      if (!spec.id) spec.id = id;
      if (!spec.name) spec.name = id;
    } catch (e) { /* 冻结对象：读取处有 nameOf() 兜底 */ }
    if (!has(REG, id)) ORDER.push(id);
    REG[id] = spec;
    /* 参数体检：key 唯一 / min<max / value 落在量程内 / step 合理。
       不合格**不静默吞掉** —— 走 warn() 通道，同时留在 state().warnings 里可查。 */
    META[id] = paramAudit(id, spec);
    if (META[id].warnings.length) warn('register(' + id + ') 参数体检：' + META[id].warnings.join('；'));
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
   * 会话（模型层）：参数 + 数据 + 时钟                                   *
   * ------------------------------------------------------------------ */
  var S = null;   // { id, spec, params, rows, seq, st, lastError }
  var V = null;   // 已挂载的视图（null = 未挂载）

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
  function newSession(id) {
    var spec = REG[id];
    var st = { rows: [], running: false, t: 0, phase: 0, hover: null };
    var meta = META[id] || { steps: {}, warnings: [] };
    return {
      id: id, spec: spec, params: defParams(spec), rows: [], seq: 0,
      st: st, lastError: '',
      steps: clone(meta.steps),                 // 归一化后的 step（UI 与 setParam 共用同一份）
      warnings: meta.warnings.slice(0)          // 参数体检结论（state().warnings 可查）
    };
  }
  function syncRows() {
    if (!S) return;
    S.st.rows = S.rows;
    S.st.running = !!S.st.running;
  }
  function paramSnap() { return S ? clone(S.params) : {}; }

  /* 推进一小步。契约 §4 细则见文件头"时钟归属"。 */
  function advance(dt) {
    if (!S) return;
    var spec = S.spec, st = S.st;
    var t0 = st.t, ph0 = st.phase;
    if (isFn(spec.step)) {
      try { spec.step(paramSnap(), st, dt); }
      catch (e) { S.lastError = 'step: ' + (e && e.message ? e.message : e); }
    }
    if (st.t === t0) st.t = t0 + dt;                       // spec 没自管时钟 → 核心推
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

  function measureCore(n) {
    if (!S) return [];
    var spec = S.spec, cols = spec.columns, out = [], i, k, row, missing, copy, kk;
    n = (n === undefined || n === null) ? 1 : Math.floor(Number(n));
    if (!(n > 0)) n = 1;
    if (n > MAX_MEASURE_PER_CALL) n = MAX_MEASURE_PER_CALL;
    for (i = 0; i < n; i++) {
      CTX.t = S.st.t;
      CTX.index = S.seq;
      row = spec.measure(paramSnap(), CTX);
      if (!row || typeof row !== 'object') throw new Error('measure() 未返回对象');
      missing = [];
      for (k = 0; k < cols.length; k++) if (!(cols[k].key in row)) missing.push(cols[k].key);
      if (missing.length) throw new Error('measure() 返回值缺少列: ' + missing.join(', '));
      copy = {};
      for (kk in row) { if (has(row, kk)) copy[kk] = row[kk]; }
      S.rows.push(copy);
      S.seq++;
      out.push(clone(copy));
    }
    syncRows();
    return out;
  }

  function graphData() {
    var res = { points: [], fit: null, xLabel: '', yLabel: '', title: '', note: '', xKey: '', yKey: '' };
    if (!S) return res;
    var spec = S.spec, g = spec.graph;
    if (!g || !g.x || !g.y) return res;
    res.xKey = String(g.x); res.yKey = String(g.y);
    res.title = g.title ? String(g.title) : '';
    res.note = g.note ? String(g.note) : '';
    res.xLabel = g.xLabel ? String(g.xLabel) : labelOf(res.xKey);
    res.yLabel = g.yLabel ? String(g.yLabel) : labelOf(res.yKey);
    /* 取点：**必须显式挡掉 null / undefined / 空串**，不能靠 Number()+isFinite()。
       为什么：某次测量在物理上没有意义时，组模块会按语义返回 null（例：入射光频率
       低于截止频率 ν_c，根本不发生光电效应 → mod.js 返回 Uc = null）。而
       Number(null) === 0，旧写法会把假点 (ν, 0) 塞进图里 —— 实测混进 3 个零点后
       U_c–ν 直线的 r² 从 0.99999 掉到 0.34，直接违反契约 §7.3。
       这里只**跳过**"语义上无值"的行：不补 0、也不当 0 用；真实的 0 照常进图。
       fit 用的是同一份 pts，所以被跳过的行绝不会进 r²。
       数据表与结论卡不动：fmtNum 早就把 null 渲染成「—」。 */
    var pts = [], i, row, x, y, skipped = 0;
    for (i = 0; i < S.rows.length; i++) {
      row = S.rows[i];
      x = coordOf(row, res.xKey);
      y = coordOf(row, res.yKey);
      if (x === null || y === null) { skipped++; continue; }
      pts.push({ x: x, y: y });
    }
    res.points = pts;
    res.valid = pts.length;
    res.skipped = skipped;
    var kind = g.fit === undefined || g.fit === null ? 'linear' : g.fit;
    if (kind === 'none' || kind === false) res.fit = null;
    else if (kind === 'origin') res.fit = fitOrigin(pts);
    else res.fit = fitLinear(pts);
    return res;
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

  function concludeCore() {
    if (!S || !S.rows.length || !isFn(S.spec.conclude)) return null;
    var r;
    try { r = S.spec.conclude(S.rows.slice(0), paramSnap(), CTX); }
    catch (e) { S.lastError = 'conclude: ' + (e && e.message ? e.message : e); return null; }
    if (!r || typeof r !== 'object') return null;
    var errs = r.errors;
    if (errs === undefined || errs === null) errs = r.errorSources;
    if (!isArr(errs)) errs = (errs === undefined || errs === null || errs === '') ? [] : [String(errs)];
    var out = { value: (r.value === undefined ? null : r.value), unit: String(r.unit === undefined || r.unit === null ? '' : r.unit), text: String(r.text === undefined || r.text === null ? '' : r.text), errors: errs };
    if (r.note !== undefined) out.note = String(r.note);
    return out;
  }

  /* 参数写入（夹范围 + 按归一化后的 step 吸附）。不动数据表。 */
  function setParamCore(key, value) {
    if (!S) return false;
    var d = paramDef(S.spec, key);
    if (!d) return false;
    /* 选项型参数（type:'select' + options）：值可以是字符串（阴极材料 'zn'）
       或数字（波长 435.8）。旧实现一律 Number(value) —— 'zn' → NaN → 直接 false，
       于是 mod.js 的阴极材料根本切不动。这里按**选项原值**匹配、原样存入（类型不丢）。 */
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
    if (isFinite(stp) && stp > 0) {
      var base = isFinite(lo) ? lo : 0;
      n = base + Math.round((n - base) / stp) * stp;
      n = Number(n.toFixed(6));
    }
    S.params[key] = n;
    return true;
  }
  /* 取某个参数归一化后的 step（UI 的 range 与 setParam 的吸附必须用同一个值） */
  function stepOf(key) {
    var s = (S && S.steps) ? S.steps[key] : NaN;
    return (isFinite(s) && s > 0) ? s : 0.01;
  }

  function stateCore() {
    return {
      open: !!(V || S),
      id: S ? S.id : null,
      running: !!(S && S.st.running),
      t: S ? S.st.t : 0,
      rows: S ? S.rows.length : 0,
      canvas: V ? { w: V.W, h: V.H } : { w: 0, h: 0 },
      warnings: S ? S.warnings.slice(0) : []
    };
  }

  /* ------------------------------------------------------------------ *
   * 样式：全部注入 #plCSS（选择器一律 pl- 前缀，不碰 css/style.css）      *
   * ------------------------------------------------------------------ */
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* 外壳：与观澜同一套深色（#05080f / rgba(8,12,24) / rgba(120,160,220,…) / #4fc3f7） */
      '.pl-root{position:absolute;left:0;top:0;right:0;bottom:0;z-index:8;display:flex;flex-direction:column;',
      'background:#070b14;color:#c8d4e4;font-family:Georgia,"Times New Roman",serif;font-size:13px;line-height:1.55;',
      'overflow:hidden;-webkit-tap-highlight-color:transparent;text-align:left}',
      '.pl-top{flex:none;display:flex;align-items:center;gap:10px;padding:6px 12px;',
      'border-bottom:1px solid rgba(120,160,220,.18);background:rgba(8,12,24,.92)}',
      '.pl-title{flex:none;font-style:italic;font-size:13.5px;color:#dff2ff;letter-spacing:.5px;white-space:nowrap}',
      '.pl-sub{flex:1;min-width:0;font-size:12px;color:#8fa3c0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pl-stat{flex:none;font-size:11.5px;color:#4fc3f7;white-space:nowrap}',
      '.pl-body{flex:1;min-height:0;display:flex}',
      /* 左栏：清单 + 目的/原理/器材/步骤 */
      '.pl-left{flex:none;width:224px;min-height:0;overflow-y:auto;padding:6px 8px 16px;',
      'background:rgba(10,16,30,.55);border-right:1px solid rgba(120,160,220,.18)}',
      '.pl-grp{padding:9px 4px 4px;margin-bottom:3px;font-size:11.5px;letter-spacing:1px;color:#6f86a6;',
      'border-bottom:1px solid rgba(120,160,220,.12)}',
      '.pl-item{display:block;width:100%;margin:2px 0;padding:6px 8px;text-align:left;border:1px solid transparent;',
      'border-radius:7px;background:transparent;color:#a9bcd4;font-family:inherit;font-size:12.5px;cursor:pointer;',
      'transition:color .16s,background .16s,border-color .16s}',
      '.pl-item:hover{color:#dff2ff;background:rgba(79,195,247,.12)}',
      '.pl-item.pl-on{color:#070b14;background:#f4f1ea;border-color:#f4f1ea;font-style:italic}',
      '.pl-info{margin-top:10px}',
      '.pl-sec{margin:0 0 6px;border:1px solid rgba(120,160,220,.14);border-radius:8px;background:rgba(9,14,26,.5)}',
      '.pl-sech{display:block;width:100%;padding:6px 8px;text-align:left;border:0;background:transparent;color:#8fa3c0;',
      'font-family:inherit;font-size:12px;cursor:pointer;letter-spacing:.5px}',
      '.pl-sech:hover{color:#dff2ff}',
      '.pl-arrow{float:right;color:#4fc3f7}',
      '.pl-secb{padding:0 9px 8px;font-size:12px;line-height:1.75;color:#b9c7da;word-break:break-word}',
      '.pl-sec.pl-fold .pl-secb{display:none}',
      '.pl-ul{margin:0;padding-left:16px}.pl-ul li{margin:2px 0}',
      '.pl-ol{margin:0;padding-left:18px}.pl-ol li{margin:3px 0}',
      /* 中栏：米白实验台 + 顶部细工具条 */
      '.pl-mid{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:#05080f}',
      '.pl-bar{flex:none;display:flex;align-items:center;gap:6px;padding:5px 8px;',
      'border-bottom:1px solid rgba(120,160,220,.18);background:rgba(8,12,24,.92)}',
      '.pl-bar button{flex:none;height:26px;padding:0 10px;border:1px solid rgba(120,160,220,.18);border-radius:7px;',
      'background:transparent;color:#8fa3c0;font-family:inherit;font-size:12px;cursor:pointer;white-space:nowrap;',
      'transition:all .2s}',
      '.pl-bar button:hover{color:#fff;border-color:rgba(79,195,247,.5);background:rgba(79,195,247,.14)}',
      '.pl-bar button:active{transform:scale(.96)}',
      '.pl-bar button.pl-go{border-color:transparent;background:linear-gradient(135deg,#2f80ed,#1e5bb8);color:#fff}',
      '.pl-hint{flex:1;min-width:0;font-size:11.5px;font-style:italic;color:#8fa3c0;text-align:right;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pl-stagewrap{position:relative;flex:1;min-height:0;overflow:hidden;background:#F4F1EA}',
      '.pl-canvas{position:absolute;left:0;top:0;display:block;background:#F4F1EA;touch-action:none}',
      /* 右栏：参数 / 数据表 / 图像 / 结论 */
      '.pl-right{flex:none;width:308px;min-height:0;overflow-y:auto;padding:8px;',
      'background:rgba(10,16,30,.55);border-left:1px solid rgba(120,160,220,.18)}',
      '.pl-card{margin:0 0 8px;border:1px solid rgba(120,160,220,.14);border-radius:9px;background:rgba(9,14,26,.55)}',
      '.pl-cardh{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 9px;',
      'border-bottom:1px solid rgba(120,160,220,.12);font-size:12px;color:#8fa3c0;letter-spacing:.5px}',
      '.pl-count{font-size:11px;color:#4fc3f7;white-space:nowrap}',
      '.pl-params{padding:6px 9px 9px}',
      '.pl-prow{margin:7px 0 0}',
      '.pl-plabel{display:flex;justify-content:space-between;gap:6px;font-size:11.5px;color:#9fb2c9}',
      '.pl-pval{color:#dff2ff;font-style:italic;white-space:nowrap}',
      '.pl-prange{display:block;width:100%;height:16px;margin:3px 0 0;accent-color:#4fc3f7;cursor:pointer}',
      /* 选项型参数（type:'select' + options）用下拉框 */
      '.pl-psel{display:block;width:100%;height:24px;margin:4px 0 0;padding:0 5px;',
      'border:1px solid rgba(120,160,220,.28);border-radius:6px;background:#0a101e;color:#dff2ff;',
      'font-family:inherit;font-size:11.5px;cursor:pointer}',
      '.pl-psel:focus{border-color:#4fc3f7;outline:none}',
      '.pl-tablewrap{max-height:236px;overflow:auto}',
      '.pl-table{width:auto;min-width:100%;border-collapse:collapse;font-family:Georgia,"Times New Roman",serif;font-size:11.5px}',
      '.pl-th{padding:4px 5px;text-align:right;color:#8fa3c0;font-weight:400;white-space:nowrap;',
      'border-bottom:1px solid rgba(120,160,220,.18)}',
      '.pl-thn{text-align:center;width:20px}',
      '.pl-u{color:#5f7594;font-size:10px}',
      '.pl-td{padding:3px 5px;text-align:right;color:#cfdcec;border-bottom:1px solid rgba(120,160,220,.08)}',
      '.pl-tdn{text-align:center;color:#5f7594}',
      '.pl-del{width:18px;height:18px;padding:0;border:1px solid transparent;border-radius:5px;background:transparent;',
      'color:#5f7594;font-family:inherit;font-size:12px;line-height:1;cursor:pointer}',
      '.pl-del:hover{color:#ff8a80;border-color:rgba(255,138,128,.4)}',
      '.pl-empty{padding:10px 9px;font-size:11.5px;font-style:italic;color:#6f86a6}',
      '.pl-graph{display:block;width:100%;background:#F4F1EA;border-radius:0 0 8px 8px}',
      '.pl-gnote{padding:3px 9px 7px;font-size:11px;font-style:italic;color:#8fa3c0}',
      '.pl-concl{padding:8px 9px 10px}',
      '.pl-cval{font-size:19px;font-style:italic;color:#dff2ff}',
      '.pl-cunit{margin-left:4px;font-size:12px;color:#8fa3c0}',
      '.pl-ctext{margin-top:5px;font-size:12px;line-height:1.75;color:#c8d4e4}',
      '.pl-cerr{margin:7px 0 0;padding-left:16px}',
      '.pl-cerr li{margin:2px 0;font-size:11.5px;color:#9fb2c9}',
      '.pl-cempty{padding:8px 9px;font-size:11.5px;font-style:italic;color:#6f86a6}',
      /* 窄屏（≤768px）：三栏改上下堆叠，整块可滚，实验台仍可玩 */
      '@media (max-width:768px){',
      '.pl-body{flex-direction:column;overflow-y:auto}',
      '.pl-left{flex:none;width:auto;max-height:30vh;border-right:0;border-bottom:1px solid rgba(120,160,220,.18)}',
      '.pl-mid{flex:none;width:auto;height:54vh}',
      '.pl-right{flex:none;width:auto;overflow:visible;border-left:0}',
      '.pl-hint{display:none}',
      '.pl-top{flex-wrap:wrap;gap:4px 8px}',
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
    var GW = 260, GH = 162;
    var c2d = null, g2d = null;
    var rafId = 0, lastMs = 0;
    var folded = { aim: false, principle: false, apparatus: false, steps: false };

    /* ---- 骨架 ---- */
    var root = cel('div', 'pl-root'); root.id = 'plRoot';
    var top = cel('div', 'pl-top'); root.appendChild(top);
    var elTitle = cel('span', 'pl-title', '🧪 物理实验台'); top.appendChild(elTitle);
    var elSub = cel('span', 'pl-sub', ''); top.appendChild(elSub);
    var elStat = cel('span', 'pl-stat', ''); top.appendChild(elStat);
    var body = cel('div', 'pl-body'); root.appendChild(body);

    var left = cel('div', 'pl-left'); body.appendChild(left);
    var elList = cel('div', 'pl-list'); left.appendChild(elList);
    var elInfo = cel('div', 'pl-info'); left.appendChild(elInfo);

    var mid = cel('div', 'pl-mid'); body.appendChild(mid);
    var bar = cel('div', 'pl-bar'); mid.appendChild(bar);
    var btnRun = cel('button', 'pl-btn-run', '▶ 开始'); btnRun.type = 'button'; btnRun.title = '开始 / 暂停仿真'; bar.appendChild(btnRun);
    var btnMeasure = cel('button', 'pl-btn-measure', '📏 测量一次'); btnMeasure.type = 'button'; btnMeasure.title = '按当前参数做一次测量，追加一行数据'; bar.appendChild(btnMeasure);
    var btnReset = cel('button', 'pl-btn-reset', '↺ 重置'); btnReset.type = 'button'; btnReset.title = '参数回默认值、时间归零（保留数据表）'; bar.appendChild(btnReset);
    var btnClear = cel('button', 'pl-btn-clear', '清空数据'); btnClear.type = 'button'; btnClear.title = '清空数据表与图像'; bar.appendChild(btnClear);
    var elHint = cel('span', 'pl-hint', ''); bar.appendChild(elHint);

    var stageWrap = cel('div', 'pl-stagewrap'); mid.appendChild(stageWrap);
    var cv = cel('canvas', 'pl-canvas'); cv.id = 'plCanvas'; stageWrap.appendChild(cv);

    var right = cel('div', 'pl-right'); body.appendChild(right);
    /* 参数滑块（契约 §4：右栏滑块） */
    var cardP = cel('div', 'pl-card'); right.appendChild(cardP);
    cardP.appendChild(cel('div', 'pl-cardh', '可调参数'));
    var elParams = cel('div', 'pl-params'); cardP.appendChild(elParams);
    /* 数据表 */
    var cardT = cel('div', 'pl-card'); right.appendChild(cardT);
    var thT = cel('div', 'pl-cardh'); cardT.appendChild(thT);
    thT.appendChild(cel('span', '', '数据记录'));
    var elCount = cel('span', 'pl-count', '0 行'); thT.appendChild(elCount);
    var elTable = cel('div', 'pl-tablewrap'); elTable.id = 'plTableWrap'; cardT.appendChild(elTable);
    /* 图像 */
    var cardG = cel('div', 'pl-card'); right.appendChild(cardG);
    var thG = cel('div', 'pl-cardh'); cardG.appendChild(thG);
    thG.appendChild(cel('span', '', '图像'));
    var elFitTag = cel('span', 'pl-count', ''); thG.appendChild(elFitTag);
    var gcv = cel('canvas', 'pl-graph'); gcv.id = 'plGraph'; cardG.appendChild(gcv);
    var elGNote = cel('div', 'pl-gnote', ''); cardG.appendChild(elGNote);
    /* 结论 */
    var cardC = cel('div', 'pl-card'); right.appendChild(cardC);
    cardC.appendChild(cel('div', 'pl-cardh', '实验结论'));
    var elConcl = cel('div', 'pl-concl'); cardC.appendChild(elConcl);

    host.appendChild(root);

    /* ---- 画布尺寸 ---- */
    function resize() {
      if (!alive) return;
      var w = stageWrap.clientWidth, h = stageWrap.clientHeight;
      if (!w || !h) { w = host.clientWidth; h = host.clientHeight; }
      W = Math.max(200, Math.floor(w || 640));
      H = Math.max(160, Math.floor(h || 420));
      dpr = num(window.devicePixelRatio, 1);
      if (dpr < 1) dpr = 1; if (dpr > 2) dpr = 2;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      c2d = cv.getContext('2d');
      GW = Math.max(180, Math.floor(gcv.clientWidth || 260));
      GH = 162;
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
        text: function (str, x, y, size, align, color) {
          c2d.save();
          c2d.font = this.font(size);
          c2d.fillStyle = color || INK;
          c2d.textAlign = align || 'left';
          c2d.textBaseline = 'alphabetic';
          c2d.fillText(String(str), x, y);
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
      c2d.fillText('物理实验台', W / 2, H / 2 - 10 * g.scale);
      c2d.font = g.font(Math.round(14 * g.scale));
      c2d.fillStyle = 'rgba(38,34,28,.55)';
      c2d.fillText('从左侧选一个实验：调参数 → 看现象 → 记录数据 → 作图 → 得结论', W / 2, H / 2 + 18 * g.scale);
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
    /* 每帧调用。**捕获 spec.draw 的异常**：一个实验画崩了不该把整个实验台带走，
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
        g.text(nameOf(S.spec, S.id) + ' · 该实验没有提供画面（draw）', 18, 34, 15, 'left', 'rgba(38,34,28,.7)');
        return;
      }
      try { S.spec.draw(g, paramSnap(), S.st); }
      catch (e) {
        var m = (e && e.message) ? e.message : String(e);
        S.lastError = 'draw: ' + m;
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
      btnRun.className = run ? 'pl-btn-run pl-go' : 'pl-btn-run';
      btnRun.disabled = !S;
      btnMeasure.disabled = !S;
      btnReset.disabled = !S;
      btnClear.disabled = !S;
    }

    /* ---- 渲染：左栏清单 ---- */
    function renderList() {
      clr(elList);
      var gs = groupSeq(), gi, ids, ii, sp, b;
      for (gi = 0; gi < gs.length; gi++) {
        elList.appendChild(cel('div', 'pl-grp', gs[gi]));
        ids = idsInGroup(gs[gi]);
        for (ii = 0; ii < ids.length; ii++) {
          sp = REG[ids[ii]];
          b = cel('button', 'pl-item', nameOf(sp, ids[ii]));
          b.type = 'button';
          b.setAttribute('data-id', ids[ii]);
          b.title = ids[ii];
          if (S && S.id === ids[ii]) b.className = 'pl-item pl-on';
          b.addEventListener('click', onPick(ids[ii]));
          elList.appendChild(b);
        }
      }
      if (!ORDER.length) elList.appendChild(cel('div', 'pl-empty', '还没有登记实验（各组的 js/pslab/*.js 会把实验注册进来）'));
    }
    /* ⚠ 这里必须写 API.open，**不能写裸的 open(id)**：本作用域里没有 open，
       裸调用会解析到 window.open —— 点左栏实验变成去开一个新窗口（id 当 URL），
       桌面 WebView2 宿主把原生窗口拦掉，学生点了毫无反应。
       （同类陷阱：close / focus / print / stop / scroll 在 window 上都真实存在。） */
    function onPick(id) { return function () { API.open(id); if (V) V.sync(); }; }

    /* ---- 渲染：目的 / 原理 / 器材 / 步骤（可折叠） ---- */
    function section(key, title, bodyNode) {
      var sec = cel('div', 'pl-sec' + (folded[key] ? ' pl-fold' : ''));
      var h = cel('button', 'pl-sech', title);
      h.type = 'button';
      var ar = cel('span', 'pl-arrow', folded[key] ? '▸' : '▾');
      h.appendChild(ar);
      h.addEventListener('click', function () {
        folded[key] = !folded[key];
        if (folded[key]) sec.className = 'pl-sec pl-fold'; else sec.className = 'pl-sec';
        ar.textContent = folded[key] ? '▸' : '▾';
      });
      sec.appendChild(h);
      var b = cel('div', 'pl-secb');
      b.appendChild(bodyNode);
      sec.appendChild(b);
      return sec;
    }
    function textNode(t) { return document.createTextNode(String(t === undefined || t === null ? '' : t)); }
    function listNode(arr, ordered) {
      var ul = cel(ordered ? 'ol' : 'ul', ordered ? 'pl-ol' : 'pl-ul'), i, li;
      for (i = 0; i < arr.length; i++) { li = cel('li', ''); li.appendChild(textNode(arr[i])); ul.appendChild(li); }
      return ul;
    }
    function renderInfo() {
      clr(elInfo);
      if (!S) { elInfo.appendChild(cel('div', 'pl-empty', '左栏点一个实验，这里显示目的 / 原理 / 器材 / 步骤。')); return; }
      var sp = S.spec;
      elInfo.appendChild(section('aim', '实验目的', textNode(sp.aim || '（未填写）')));
      var pw = cel('div', '');
      var lines = String(sp.principle || '（未填写）').split('\n');
      var i;
      for (i = 0; i < lines.length; i++) {
        if (i) pw.appendChild(cel('br', ''));
        pw.appendChild(textNode(lines[i]));
      }
      elInfo.appendChild(section('principle', '实验原理', pw));
      elInfo.appendChild(section('apparatus', '实验器材', isArr(sp.apparatus) && sp.apparatus.length ? listNode(sp.apparatus, false) : textNode('（未填写）')));
      elInfo.appendChild(section('steps', '实验步骤', isArr(sp.steps) && sp.steps.length ? listNode(sp.steps, true) : textNode('（未填写）')));
    }

    /* ---- 渲染：参数滑块 ---- */
    var sliderRefs = {};
    function renderParams() {
      clr(elParams);
      sliderRefs = {};
      if (!S) { elParams.appendChild(cel('div', 'pl-empty', '—')); return; }
      var ps = S.spec.params;
      if (!isArr(ps) || !ps.length) { elParams.appendChild(cel('div', 'pl-empty', '该实验没有可调参数')); return; }
      var i, d, row, lab, name, val, rg, sel, j, o, op;
      for (i = 0; i < ps.length; i++) {
        d = ps[i];
        if (!d || !d.key) continue;
        row = cel('div', 'pl-prow');
        lab = cel('div', 'pl-plabel');
        name = cel('span', '', String(d.label === undefined ? d.key : d.label) + (d.unit ? '（' + d.unit + '）' : ''));
        val = cel('span', 'pl-pval', fmtNum(S.params[d.key]));
        lab.appendChild(name); lab.appendChild(val); row.appendChild(lab);
        /* 选项型参数（type:'select' + options）：下拉框，不是滑块。
           组里真在用（mod.js 的入射光波长 λ / 阴极材料），旧实现一律当滑块，
           而这些参数没有 min/max —— 滑块会退回浏览器默认的 0..100，等于坏掉。 */
        if (isSelectParam(d)) {
          sel = cel('select', 'pl-psel');
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
          sliderRefs[d.key] = { sel: sel, val: val };
          continue;
        }
        rg = cel('input', 'pl-prange');
        rg.type = 'range';
        rg.setAttribute('data-key', d.key);
        if (isFinite(num(d.min, NaN))) rg.min = String(d.min);
        if (isFinite(num(d.max, NaN))) rg.max = String(d.max);
        rg.step = String(stepOf(d.key));      // 归一化后的 step（与 setParam 的吸附同源）
        rg.value = String(isFinite(num(S.params[d.key], NaN)) ? S.params[d.key] : num(d.min, 0));
        rg.addEventListener('input', onSlider(d.key));
        row.appendChild(rg);
        elParams.appendChild(row);
        sliderRefs[d.key] = { range: rg, val: val };
      }
    }
    function onSlider(key) {
      return function (ev) {
        setParamCore(key, ev.target.value);
        var r = sliderRefs[key];
        if (r) r.val.textContent = fmtNum(S ? S.params[key] : ev.target.value);
        draw(); updateStat();
      };
    }
    function onSelect(key) {
      return function (ev) {
        setParamCore(key, ev.target.value);
        var r = sliderRefs[key];
        if (r) r.val.textContent = fmtNum(S ? S.params[key] : ev.target.value);
        draw(); updateStat();
      };
    }
    function refreshParamValues() {
      var k, r;
      for (k in sliderRefs) {
        if (!has(sliderRefs, k)) continue;
        r = sliderRefs[k];
        if (S) {
          if (r.range && r.range.value !== String(S.params[k])) r.range.value = String(S.params[k]);
          if (r.sel && r.sel.value !== String(S.params[k])) r.sel.value = String(S.params[k]);
          r.val.textContent = fmtNum(S.params[k]);
        }
      }
    }

    /* ---- 渲染：数据表 ---- */
    function renderTable() {
      clr(elTable);
      elCount.textContent = (S ? S.rows.length : 0) + ' 行';
      if (!S) { elTable.appendChild(cel('div', 'pl-empty', '尚无数据 — 点「📏 测量一次」记录一组')); return; }
      var cols = S.spec.columns, i, j, row;
      var t = cel('table', 'pl-table'); t.id = 'plTable';
      var thead = cel('thead', 'pl-thead'), htr = cel('tr', 'pl-tr');
      var th0 = cel('th', 'pl-th pl-thn', '#'); htr.appendChild(th0);
      for (i = 0; i < cols.length; i++) {
        var th = cel('th', 'pl-th');
        th.appendChild(textNode(cols[i].label === undefined ? cols[i].key : cols[i].label));
        if (cols[i].unit) { var u = cel('span', 'pl-u', ' / ' + cols[i].unit); th.appendChild(u); }
        htr.appendChild(th);
      }
      htr.appendChild(cel('th', 'pl-th pl-thn', ''));
      thead.appendChild(htr); t.appendChild(thead);
      var tb = cel('tbody', '');
      for (i = 0; i < S.rows.length; i++) {
        row = cel('tr', 'pl-tr');
        row.appendChild(cel('td', 'pl-td pl-tdn', String(i + 1)));
        for (j = 0; j < cols.length; j++) row.appendChild(cel('td', 'pl-td', fmtNum(S.rows[i][cols[j].key])));
        var td = cel('td', 'pl-td pl-tdn');
        var del = cel('button', 'pl-del', '×');
        del.type = 'button'; del.title = '删除这一行';
        del.addEventListener('click', onDelRow(i));
        td.appendChild(del); row.appendChild(td);
        tb.appendChild(row);
      }
      t.appendChild(tb);
      elTable.appendChild(t);
    }
    function onDelRow(i) {
      return function () {
        if (!S || i < 0 || i >= S.rows.length) return;
        S.rows.splice(i, 1);
        syncRows();
        if (V) V.sync();
      };
    }

    /* ---- 渲染：小图像 ---- */
    function renderGraph() {
      if (!g2d || !alive) return;
      var d = graphData();
      g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      g2d.fillStyle = GRAPH_PAPER;
      g2d.fillRect(0, 0, GW, GH);
      var padL = 44, padR = 12, padT = 20, padB = 26;
      var x0 = padL, y0 = GH - padB, x1 = GW - padR, y1 = padT;
      var pts = d.points;
      elFitTag.textContent = d.fit ? ('r² = ' + fmtNum(d.fit.r2)) : '';
      elGNote.textContent = (d.title ? d.title + (d.note ? ' · ' : '') : '') + (d.note || '') +
        (d.skipped ? '（已跳过 ' + d.skipped + ' 个在这张图上无有效值的点）' : '');
      if (!pts.length) {
        g2d.font = 'italic 12px Georgia,"Times New Roman",serif';
        g2d.fillStyle = 'rgba(38,34,28,.45)';
        g2d.textAlign = 'center';
        var msg;
        if (!S) msg = '先选一个实验';
        else if (!S.spec.graph) msg = '该实验未定义图线';
        else if (S.rows.length >= 2) msg = '这些数据在这张图上没有有效点（该条件下无测量值）';
        else msg = '数据满 2 行后自动作图';
        g2d.fillText(msg, GW / 2, GH / 2);
        return;
      }
      var i, xmin = pts[0].x, xmax = pts[0].x, ymin = pts[0].y, ymax = pts[0].y;
      for (i = 1; i < pts.length; i++) {
        if (pts[i].x < xmin) xmin = pts[i].x;
        if (pts[i].x > xmax) xmax = pts[i].x;
        if (pts[i].y < ymin) ymin = pts[i].y;
        if (pts[i].y > ymax) ymax = pts[i].y;
      }
      /* 过原点的图线：坐标轴从 0 起，读斜率才直观 */
      if (d.fit && d.fit.a === 0 && xmin > 0 && xmin / (xmax || 1) > 0.25) xmin = 0;
      if (xmax - xmin < EPS) { xmin -= 0.5; xmax += 0.5; }
      if (ymax - ymin < EPS) { ymin -= 0.5; ymax += 0.5; }
      var padx = (xmax - xmin) * 0.08, pady = (ymax - ymin) * 0.1;
      xmin -= padx; xmax += padx; ymin -= pady; ymax += pady;
      var sx = (x1 - x0) / (xmax - xmin), sy = (y1 - y0) / (ymax - ymin);
      function px(v) { return x0 + (v - xmin) * sx; }
      function py(v) { return y0 + (v - ymin) * sy; }
      /* 网格 + 刻度 */
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
      /* 轴 */
      g2d.strokeStyle = 'rgba(38,34,28,.55)';
      g2d.lineWidth = 1;
      g2d.beginPath(); g2d.moveTo(x0, y0); g2d.lineTo(x1, y0); g2d.stroke();
      g2d.beginPath(); g2d.moveTo(x0, y0); g2d.lineTo(x0, y1); g2d.stroke();
      /* 数据点 */
      g2d.fillStyle = '#1d4ed8';
      for (i = 0; i < pts.length; i++) {
        g2d.beginPath();
        g2d.arc(px(pts[i].x), py(pts[i].y), 2.6, 0, Math.PI * 2);
        g2d.fill();
      }
      /* 拟合线 + 斜率/截距标注 */
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
        /* 标注底衬：数据点密的时候也要读得清 */
        g2d.fillStyle = 'rgba(244,241,234,.86)';
        g2d.fillRect(x0 + 3, y1 + 1, 148, 40);
        g2d.fillStyle = 'rgba(150,40,30,.95)';
        g2d.fillText('y = a + b·x', x0 + 4, y1 + 2);
        g2d.fillText('b(斜率) = ' + fmtNum(d.fit.b), x0 + 4, y1 + 15);
        g2d.fillText('a(截距) = ' + fmtNum(d.fit.a) + '   r² = ' + fmtNum(d.fit.r2), x0 + 4, y1 + 28);
      }
      /* 轴名 */
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

    /* ---- 渲染：结论卡片 ---- */
    function renderConcl() {
      clr(elConcl);
      if (!S) { elConcl.appendChild(cel('div', 'pl-cempty', '测量之后给出结论与误差来源')); return; }
      var c = concludeCore();
      if (!c) {
        var why = !S.rows.length ? '先测几组数据，再给结论。' : (isFn(S.spec.conclude) ? '结论暂时算不出来。' : '该实验未提供结论函数（conclude）。');
        elConcl.appendChild(cel('div', 'pl-cempty', why));
        return;
      }
      var v = cel('div', 'pl-cval', c.value === null || c.value === undefined ? '—' : fmtNum(c.value));
      if (c.unit) v.appendChild(cel('span', 'pl-cunit', c.unit));
      elConcl.appendChild(v);
      if (c.text) elConcl.appendChild(cel('div', 'pl-ctext', c.text));
      if (c.errors && c.errors.length) {
        var ul = cel('ul', 'pl-cerr'), i;
        for (i = 0; i < c.errors.length; i++) ul.appendChild(cel('li', '', '⚠ ' + c.errors[i]));
        elConcl.appendChild(ul);
      }
    }

    function updateStat() {
      if (!S) { elStat.textContent = ''; elSub.textContent = '从左侧选择一个实验开始'; return; }
      elSub.textContent = groupOf(S.spec) + ' · ' + nameOf(S.spec, S.id);
      elStat.textContent = 't = ' + S.st.t.toFixed(2) + ' s · ' + S.rows.length + ' 组数据' + (S.st.running ? ' · 运行中' : '');
      elHint.textContent = S.lastError ? ('⚠ ' + S.lastError) : (S.rows.length ? '点「📏 测量一次」继续记录；改参数后数据会落在同一张图上' : '点「📏 测量一次」记录第一组数据');
    }

    /* ---- 交互：工具条 ----
       ⚠ 这里一律写 view.sync()（**不要写裸的 sync()**）：createView 作用域里没有
       sync 这个函数，它只是 view 对象的方法 —— 裸调用会抛 ReferenceError，
       表现就是"📏 测量一次 / ↺ 重置 / 清空数据 点了没反应"。 */
    btnRun.addEventListener('click', function () {
      if (!S) return;
      if (S.st.running) pause(); else play();
      updateStat();
    });
    btnMeasure.addEventListener('click', function () {
      if (!S) return;
      try { measureCore(1); } catch (e) { S.lastError = (e && e.message) ? e.message : String(e); }
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
    /* 指针事件转成图纸坐标后转给 spec.onPointer（契约 §4） */
    function pointerEv(type) {
      return function (ev) {
        if (!S || !isFn(S.spec.onPointer)) return;
        var r = cv.getBoundingClientRect();
        try { S.spec.onPointer({ type: type, x: ev.clientX - r.left, y: ev.clientY - r.top }, paramSnap(), S.st); }
        catch (e) { S.lastError = 'onPointer: ' + (e && e.message ? e.message : e); }
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
        renderList(); renderInfo(); renderParams(); renderTable(); renderGraph(); renderConcl();
        updateButtons(); updateStat(); draw();
        view.W = W; view.H = H;
      },
      light: function () { refreshParamValues(); updateStat(); draw(); },
      draw: draw,
      resize: resize,
      play: play,
      pause: pause,
      syncRows: function () { renderTable(); renderGraph(); renderConcl(); updateStat(); draw(); },
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
  function syncView() { if (V) V.sync(); }

  var API = {
    build: BUILD,
    version: VERSION,

    /* 各组模块登记实验 */
    register: register,
    /* 排障用：读某个已登记 spec 的浅层信息 */
    spec: function (id) { return has(REG, id) ? REG[id] : null; },
    groups: groupSeq,

    /* 建舞台。opts: { onUnmount } —— 无论是谁拆的，宿主收尾都会跑 */
    mount: function (containerEl, opts) {
      if (!containerEl || !containerEl.appendChild) return false;
      if (V) API.unmount();
      injectCSS();
      V = createView(containerEl, opts || {});
      return true;
    },
    /* 只拆视图（保留当前实验会话，便于"收起再展开"） */
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

    /* 打开某实验（等于左栏点击）。未挂载时也能开 —— 会话先建好，mount() 时画出来。 */
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
      var c = concludeCore();
      return {
        id: S.id,
        name: nameOf(S.spec, S.id),
        group: groupOf(S.spec),
        params: clone(S.params),
        rows: (function () { var o = [], i; for (i = 0; i < S.rows.length; i++) o.push(clone(S.rows[i])); return o; })(),
        conclusion: c
      };
    },
    params: function () { return S ? clone(S.params) : null; },

    /* 设参数（不动数据表）。返回是否写入成功。 */
    setParam: function (key, value) {
      var ok = setParamCore(key, value);
      if (ok) { if (V) V.light(); }
      return ok;
    },

    /* 连续测量 n 次（默认 1），返回新增的行数组 */
    measure: function (n) {
      if (!S) return [];
      var out = [];
      try { out = measureCore(n); }
      finally { if (V) V.syncRows(); }
      return out;
    },

    /* 清空数据表与图 */
    clear: function () {
      if (!S) return false;
      S.rows = [];
      S.seq = 0;
      syncRows();
      if (V) V.syncRows();
      return true;
    },

    graph: function () {
      var d = graphData();
      var pts = [], i;
      for (i = 0; i < d.points.length; i++) pts.push({ x: d.points[i].x, y: d.points[i].y });
      return { points: pts, fit: d.fit ? { a: d.fit.a, b: d.fit.b, r2: d.fit.r2 } : null, xLabel: d.xLabel, yLabel: d.yLabel };
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
    /* 会话内部快照（排障用，不参与逻辑） */
    debug: function () {
      return {
        registered: ORDER.length,
        groups: groupSeq(),
        session: S ? {
          id: S.id, params: clone(S.params), rows: S.rows.length, t: S.st.t, phase: S.st.phase,
          lastError: S.lastError, steps: clone(S.steps), warnings: S.warnings.slice(0)
        } : null,
        audit: S ? (META[S.id] ? { warnings: META[S.id].warnings.slice(0) } : null) : null,
        mounted: !!V
      };
    },
    /* 排障用：每个已登记实验的参数体检结论（哪一组有参数不规范，一次看全） */
    audit: function () {
      var out = [], i, id;
      for (i = 0; i < ORDER.length; i++) {
        id = ORDER[i];
        out.push({ id: id, warnings: (META[id] ? META[id].warnings.slice(0) : []), steps: (META[id] ? clone(META[id].steps) : {}) });
      }
      return out;
    }
  };

  window.QG_PSLAB = API;
})();
