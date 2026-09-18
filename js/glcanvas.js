/* ============================================================
 * glcanvas.js — 穷观 V2.4.2「观澜」演示画布的 2D 数学绘图引擎(Canvas2D 实现)
 * 位置:index.html 中在 demo.js 之前加载;window.GL 暴露为工厂函数:
 *   var gl = window.GL(canvasEl, labelsEl);   // labelsEl 可缺省(null 时引擎自建)
 * 画布语义:世界坐标 = 数学坐标(右手系,y 向上);相机为
 *   {scale(px/单位), ox, oy(世界原点在屏幕上的像素位)} 的线性映射。
 * 场景描述 schema(纯声明式,AI/模板可生成):
 *   { camera:{cx,cy,scale}?, anim:{mode,dur}?, defs:[...], objects:[...] }
 * defs 按 id 合并求值(op: fixed/line/onLine/reflect/lineIntersect/mid/between),
 * 支持引用前面 def 的名字或 {x,y} 字面量;坐标/参数可为含 u 的四则表达式。
 * objects(op: dot/segment/line/ray/circle/polyline/polygon/arrow/curve/text),
 * 图元配色取主题色板,支持虚线、自由点拖动(drag:'free')、MathJax 标注(tex)。
 * 安全:表达式由自写词法/递归下降求值器处理(白名单 Math 函数),不引入
 * 任何动态执行手段;动画内时 u∈[0,1] 按真实时间推进。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ============================================================
   * 1. 通用工具
   * ============================================================ */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isStr(v) { return typeof v === 'string'; }
  function isObj(v) { return v !== null && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]'; }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 主题色板:青(主)/金(次,关键点与最优路径)/灰/红/白 */
  var PAL = {
    cyan: '#4fc3f7',
    gold: '#ffd54f',
    gray: '#8fa3c0',
    red: '#ff8a80',
    white: '#eaf2ff'
  };
  /* 坐标轴与刻度:灰调细线,不做网格(引擎默认无网格,可开 showGrid 加 5% 淡刻度线) */
  var AXIS_COLOR = 'rgba(143,163,192,0.42)';
  var AXIS_TEXT = 'rgba(143,163,192,0.8)';
  var GRID_COLOR = 'rgba(234,242,255,0.05)';
  var FONT_STACK = '"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif';
  /* 刻度/网格循环的硬迭代上限:即使可视矩形或步长因异常状态失去上界,
     循环也必须在有限步内退出(宁可少画几条刻度,也不能让页面假死,D1) */
  var MAX_TICK_ITERS = 4000;

  /* ============================================================
   * 2. 安全表达式求值器(自写 tokenizer + 递归下降,无动态执行)
   * 支持:数字、变量 u/x、常量 PI/E、+ - * /、括号、一元负号、
   *       白名单函数(全部来自 Math,无 eval/Function):
   *       sin cos tan asin acos atan atan2、sqrt cbrt abs、pow hypot、
   *       min max、exp ln log(底10) log2、floor ceil round sign。
   * ============================================================ */
  // 白名单函数表(函数名 -> 最少参数个数)。
  // 必须用无原型字典:若用普通对象字面量,MATH_ARITY['constructor'] 会沿原型链
  // 命中 Object.prototype.constructor(真值),nCall 就会把它当成合法函数放行,
  // 于是 'constructor' 这种"表达式"能编译成功却算不出数(R1)。
  var MATH_ARITY = Object.create(null);
  MATH_ARITY.sin = 1; MATH_ARITY.cos = 1; MATH_ARITY.tan = 1;
  MATH_ARITY.asin = 1; MATH_ARITY.acos = 1; MATH_ARITY.atan = 1; MATH_ARITY.atan2 = 2;
  MATH_ARITY.sqrt = 1; MATH_ARITY.cbrt = 1; MATH_ARITY.abs = 1;
  MATH_ARITY.pow = 2; MATH_ARITY.hypot = 2; MATH_ARITY.min = 2; MATH_ARITY.max = 2;
  MATH_ARITY.exp = 1; MATH_ARITY.ln = 1; MATH_ARITY.log = 1; MATH_ARITY.log2 = 1;
  MATH_ARITY.floor = 1; MATH_ARITY.ceil = 1; MATH_ARITY.round = 1; MATH_ARITY.sign = 1;

  // 词法:切出 数字 / 名称 / 运算符 / 括号 / 逗号
  function tokenize(src) {
    var out = [], i = 0, n = src.length, ch, j, s;
    while (i < n) {
      ch = src.charAt(i);
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      if (ch >= '0' && ch <= '9' || ch === '.') {
        j = i;
        while (j < n && (src.charAt(j) >= '0' && src.charAt(j) <= '9' || src.charAt(j) === '.')) j++;
        s = src.slice(i, j);
        if (s === '.' || s.charAt(s.length - 1) === '.') throw new Error('bad number');
        out.push({ k: 'num', v: parseFloat(s) });
        i = j;
      } else if (ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z') {
        j = i;
        while (j < n && (src.charAt(j) >= 'A' && src.charAt(j) <= 'Z' ||
          src.charAt(j) >= 'a' && src.charAt(j) <= 'z' || src.charAt(j) >= '0' && src.charAt(j) <= '9')) j++;
        out.push({ k: 'id', s: src.slice(i, j) });
        i = j;
      } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/' ||
        ch === '(' || ch === ')' || ch === ',') {
        out.push({ k: 'op', s: ch });
        i++;
      } else {
        throw new Error('unexpected char');
      }
    }
    return out;
  }

  // 语法树节点 = 返回闭包(node(env) -> number)
  function nLit(v) { return function () { return v; }; }
  function nVar(name) {
    return function (env) {
      if (name === 'u') return env.u == null ? 0 : Number(env.u);
      if (name === 'x') return env.x == null ? 0 : Number(env.x);
      if (name === 'PI') return Math.PI;
      if (name === 'E') return Math.E;
      return NaN; // 其余名称一律非法
    };
  }
  function nNeg(a) { return function (env) { return -(a(env)); }; }
  function nBin(op, a, b) {
    return function (env) {
      var x = a(env), y = b(env);
      if (!isNum(x) || !isNum(y)) return NaN;
      if (op === '+') return x + y;
      if (op === '-') return x - y;
      if (op === '*') return x * y;
      if (op === '/') return x / y;
      return NaN;
    };
  }
  function nCall(name, args) {
    // 只认白名单里显式列出的名字:用 has() 判定(不查原型链),
    // 否则 'constructor' / 'toString' 之类的名字会被误当成合法函数
    if (!has(MATH_ARITY, name)) throw new Error('bad fn ' + name);
    var arity = MATH_ARITY[name];
    if (!arity || args.length < arity) throw new Error('bad fn ' + name);
    var fn = has(Math, name) ? Math[name] : null; // 同样只取 Math 的自有属性
    // 中文习惯:ln = 自然对数(Math.log);log = 常用对数(底 10);log2 = 底 2
    if (name === 'ln') fn = Math.log;
    else if (name === 'log') fn = Math.log10;
    else if (name === 'log2') fn = Math.log2;
    if (typeof fn !== 'function') throw new Error('bad fn ' + name);
    return function (env) {
      var i, vals = [];
      for (i = 0; i < args.length; i++) {
        var v = args[i](env);
        if (!isNum(v)) return NaN;
        vals.push(v);
      }
      if (name === 'min' || name === 'max') return fn.apply(null, vals);
      if (arity === 2) return fn(vals[0], vals[1]);
      return fn(vals[0]);
    };
  }

  // 递归下降: expr := term (('+'|'-') term)* ...
  function parseExprTks(tks) {
    var p = 0;
    function peek() { return p < tks.length ? tks[p] : null; }
    function next() { return tks[p++]; }
    function expectOp(s) {
      var t = next();
      if (!t || t.k !== 'op' || t.s !== s) throw new Error('expect ' + s);
    }
    function parseAdd() {
      var node = parseMul(), t;
      while ((t = peek()) && t.k === 'op' && (t.s === '+' || t.s === '-')) {
        next();
        var rhs = parseMul();
        node = nBin(t.s, node, rhs);
      }
      return node;
    }
    function parseMul() {
      var node = parseUn(), t;
      while ((t = peek()) && t.k === 'op' && (t.s === '*' || t.s === '/')) {
        next();
        var rhs = parseUn();
        node = nBin(t.s, node, rhs);
      }
      return node;
    }
    function parseUn() {
      var t = peek();
      if (t && t.k === 'op' && t.s === '-') { next(); return nNeg(parseUn()); }
      return parsePrim();
    }
    function parsePrim() {
      var t = next();
      if (!t) throw new Error('empty expr');
      if (t.k === 'num') return nLit(t.v);
      if (t.k === 'op' && t.s === '(') {
        var e = parseAdd();
        expectOp(')');
        return e;
      }
      if (t.k === 'id') {
        if (peek() && peek().k === 'op' && peek().s === '(') {
          next(); // 吃掉 '('
          var args = [];
          if (!(peek() && peek().k === 'op' && peek().s === ')')) {
            args.push(parseAdd());
            while (peek() && peek().k === 'op' && peek().s === ',') {
              next();
              args.push(parseAdd());
            }
          }
          expectOp(')');
          return nCall(t.s, args);
        }
        return nVar(t.s);
      }
      throw new Error('bad token');
    }
    var root = parseAdd();
    if (p !== tks.length) throw new Error('trailing');
    return root;
  }

  // 表达式字符串 -> 求值闭包或 null。
  // 无原型字典:表达式源码来自 AI(可以是任意字符串),普通对象会让 '__proto__'
  // / 'constructor' 之类的键名命中原型链,既可能丢掉缓存也可能改坏原型(R1)。
  // 另设上限:AI 每次"现场生成"都会产出全新表达式,不封顶则缓存随会话无限增长。
  var EXPR_CACHE_MAX = 400;
  var exprCache = Object.create(null);
  var exprCacheN = 0;
  function compileExpr(src) {
    if (has(exprCache, src)) return exprCache[src];
    var c;
    try {
      c = parseExprTks(tokenize(src));
    } catch (e) {
      c = null;
    }
    if (exprCacheN >= EXPR_CACHE_MAX) {
      // 满了就整体丢弃重建:表达式在同一场景内复用率很高,
      // 清空只影响一次重编译的性能,不影响正确性,比维护 LRU 更省事也更不易出错。
      exprCache = Object.create(null);
      exprCacheN = 0;
    }
    exprCache[src] = c;
    exprCacheN++;
    return c;
  }
  // 数值/表达式求值:数字直接返回;字符串走安全求值器;非法返回 NaN
  function calcVal(v, env) {
    if (isNum(v)) return v;
    if (isStr(v)) {
      var f = compileExpr(v);
      if (!f) return NaN;
      try { var r = f(env); return isNum(r) ? r : NaN; } catch (e) { return NaN; }
    }
    return NaN;
  }

  /* ============================================================
   * 3. 画布引擎工厂:createGuanlanCanvas(canvasEl, labelsEl)
   * ============================================================ */
  function createGuanlanCanvas(canvasEl, labelsEl) {
    // 同一画布重复创建时复用既有引擎(防重复绑定事件),并允许换标注容器
    if (canvasEl && canvasEl.__glEngine) {
      var old = canvasEl.__glEngine;
      if (labelsEl) old.setLabels(labelsEl);
      return old;
    }

    /* ---------- 3.1 画布与环境 ---------- */
    var ctx = null;
    try { ctx = canvasEl && canvasEl.getContext ? canvasEl.getContext('2d') : null; } catch (e) { ctx = null; }
    if (!ctx) {
      // 拿不到 2D 上下文:返回"空引擎",方法齐备但不产生画面
      return {
        update: function () { return { ok: false, n: 0 }; },
        clear: function () { }, play: function () { }, pause: function () { },
        step: function () { }, reset: function () { }, setPlaying: function () { },
        getState: function () { return { playing: false, u: 0, objects: 0, labels: 0 }; },
        fit: function () { }, redraw: function () { }, setLabels: function () { },
        autoFitOnUpdate: true, onPick: null, __gl: null
      };
    }
    var doc = global.document || null;
    var dpr = (global.devicePixelRatio && isNum(global.devicePixelRatio)) ? global.devicePixelRatio : 1;
    var cssW = 0, cssH = 0;          // CSS 像素下的画布可视尺寸

    /* ---------- 3.2 标注层(MathJax 覆盖容器) ---------- */
    // labelsEl 缺省时引擎在画布父节点内自建绝对定位容器
    var labelsBox = null;
    var labelsAuto = false;
    function buildLabelsBox() {
      if (labelsBox) return;
      if (labelsEl) {
        labelsBox = labelsEl;
        labelsAuto = false;
      } else if (doc && doc.createElement && canvasEl.parentNode) {
        labelsBox = doc.createElement('div');
        labelsAuto = true;
        canvasEl.parentNode.insertBefore(labelsBox, canvasEl.nextSibling);
      } else if (doc && doc.createElement && doc.body) {
        labelsBox = doc.createElement('div');
        labelsAuto = true;
        doc.body.appendChild(labelsBox);
      } else {
        return; // 极端环境:无标注层,tex 标注降级为纯画布文本
      }
      // 容器必须与画布同原点、不拦截鼠标(引擎强制这些内联样式)
      try {
        if (!labelsBox.style) labelsBox.style = {};
        labelsBox.style.position = 'absolute';
        labelsBox.style.left = '0px';
        labelsBox.style.top = '0px';
        labelsBox.style.pointerEvents = 'none';
        if (labelsAuto) {
          labelsBox.style.width = '100%';
          labelsBox.style.height = '100%';
          labelsBox.style.overflow = 'hidden';
        }
      } catch (e) { /* 样式写入失败忽略 */ }
    }
    buildLabelsBox();

    /* ---------- 3.3 引擎状态 ---------- */
    var anim = { mode: 'pingpong', dur: 4 }; // 缺省:u 往返周期 4 秒
    var u = 0;                 // 动画相位 0..1(对外/表达式用的当前值)
    var uPhase = 0;            // pingpong 专用:单调累加相位,再折算成三角波
                               // (若直接对 u 做"反射式"折返,u 会在端点附近
                               //  每帧被弹回,表现为动点在端点原地颤抖且不再返回)
    var playing = false;
    var lastTs = null;         // 上一帧真实时间(暂停/恢复时置空防跳变)
    var rafId = null;          // 当前请求的动画帧 id
    var dirty = false;         // 有待重绘标记(仅 playing/dragging/dirty 时才跑帧循环)
    var autoFitOnUpdate = true;
    var gridOn = false;        // 淡网格默认关(见契约:无网格)
    var frameEpoch = 0;        // 帧代际号:几何缓存按帧失效
    // O1 性能优化:只在"几何可能变了"时才推进 frameEpoch。
    // 原实现每帧无条件 ++,使 def._fe/obj._fe 的逐帧缓存彻底失效 —— 暂停状态下
    // 任何一次重绘(面板尺寸变化、overlay 更新、滚轮缩放…)都会把全部 def/object
    // 连同曲线采样重算一遍。现在:播放中 / 拖动中 / 相位 u 变化才推进;
    // 否则复用上一帧结果,只重画一遍 canvas。
    // 凡是"直接改了 _ovr 或替换了图元"的路径,都必须显式调用 invalidateGeom()。
    var geomU = NaN;           // 上次"真正求值"时所用的动画相位
    function invalidateGeom() { frameEpoch++; }
    var labelsBoxW = -1, labelsBoxH = -1;   // overlay 容器上次写入的尺寸(避免每帧写样式)
    // 表达式求值共享环境。u 每帧重置为动画相位;x 是曲线自变量,每个图元/定义
    // 求值前都重置为 0,避免上一条曲线采样把 env.x 留在末点、同帧内后续用到 x
    // 的求值结果取决于引用顺序(D8)。
    var env = { u: 0, x: 0 };
    var cam = { scale: 42, ox: 0, oy: 0 };
    // id -> 条目 的字典一律用无原型对象:id 来自外部场景描述(demo.js 的 ID_RE
    // 允许 '__proto__' / 'constructor'),普通对象会让这些 id 命中原型链而静默
    // 丢条目、甚至换掉原型(D6)。读取一律配合 has() 判定。
    var defMap = Object.create(null);  // id -> def 条目
    var objMap = Object.create(null);  // id -> object 条目
    var defList = [];
    var objList = [];
    var overlayList = [];      // [{id, span, tex, lastX, lastY, lastVis, obj}]
    var typesetPending = false;

    /* ---------- 3.4 尺寸同步(设备像素比适配) ---------- */
    var camReady = false;      // 相机是否已按有效画布尺寸定过位(fit 或显式 camera)
    var camReq = null;         // 最近一次显式指定的机位 {scale,cx,cy}(尺寸恢复时按新尺寸重摆)
    function syncSize() {
      if (!canvasEl) return false;
      var w = 0, h = 0;
      try {
        w = canvasEl.clientWidth || 0;
        h = canvasEl.clientHeight || 0;
      } catch (e) { /* 忽略 */ }
      if (!w || !h) {
        // 面板隐藏/未布局:把可视尺寸真的置 0,后续才能识别"尺寸由 0 恢复"(D7),
        // 同时 drawScene 会因 cssW/cssH 为 0 直接跳过绘制(不再往 0 尺寸画布上画)
        cssW = 0; cssH = 0;
        return false;
      }
      dpr = (global.devicePixelRatio && isNum(global.devicePixelRatio)) ? global.devicePixelRatio : 1;
      var bw = Math.max(1, Math.round(w * dpr));
      var bh = Math.max(1, Math.round(h * dpr));
      if (canvasEl.width !== bw || canvasEl.height !== bh) {
        canvasEl.width = bw;
        canvasEl.height = bh;
      }
      cssW = w;
      cssH = h;
      return true;
    }
    // 尺寸变化(面板开合/窗口缩放)→ 重绘
    function markResized() {
      // 本次同步前是否处于"无尺寸"(如观澜面板 <div hidden> 时 clientWidth=0)
      var wasZero = !(cssW > 0 && cssH > 0);
      if (!syncSize()) return;
      // 引擎在面板隐藏时创建 → cssW/cssH 为 0 → fit() 直接 return,相机从未取景,
      // 面板打开后世界原点会被钉在画布左上角。故"从未取景"或"尺寸由 0 恢复"时
      // 补做一次:显式 camera 按新尺寸重摆,否则自动取景。普通窗口缩放不重做,
      // 以免覆盖用户手动缩放/平移后的视图(D7)。
      if (autoFitOnUpdate && (!camReady || wasZero)) {
        if (camReq) {
          cam.scale = camReq.scale;
          cam.ox = cssW / 2 - camReq.cx * cam.scale;
          cam.oy = cssH / 2 + camReq.cy * cam.scale;
          camReady = true;
        } else {
          fit();
        }
      }
      requestDraw();
    }
    function watchSize() {
      try {
        if (canvasEl && typeof global.ResizeObserver === 'function') {
          var ro = new global.ResizeObserver(function () { markResized(); });
          ro.observe(canvasEl);
        }
      } catch (e) { /* 忽略 */ }
      try {
        if (typeof global.addEventListener === 'function') {
          global.addEventListener('resize', markResized);
        }
      } catch (e) { /* 忽略 */ }
    }

    /* ---------- 3.5 坐标系换算 ---------- */
    function w2sx(wx) { return cam.ox + wx * cam.scale; }
    function w2sy(wy) { return cam.oy - wy * cam.scale; }
    function s2wx(sx) { return (sx - cam.ox) / cam.scale; }
    function s2wy(sy) { return (cam.oy - sy) / cam.scale; }
    // 当前可视世界矩形(可带外扩系数,用于裁剪到边缘)
    // 安全约定:返回值恒为有限数。scale<=0 / NaN / Infinity 时 s2wx 会给出
    // ±Infinity,而网格与刻度的循环都以 rect 为上界,一旦 rect 非有限,循环就
    // 失去上界(实测 cam.scale=0 触发约 20 万次 ctx 调用后页面假死,D1)。
    function viewRect(expand) {
      var e = expand || 0;
      var sc = cam.scale;
      var xmin, xmax, ymin, ymax;
      if (!isNum(sc) || sc <= 0) return { xmin: -1, xmax: 1, ymin: -1, ymax: 1 };
      xmin = s2wx(-cssW * e); xmax = s2wx(cssW * (1 + e));
      ymin = s2wy(cssH * (1 + e)); ymax = s2wy(-cssH * e);
      // 双保险:比例是极小正数时商仍可能溢出为 ±Infinity
      if (!isNum(xmin) || !isNum(xmax) || !isNum(ymin) || !isNum(ymax) ||
        xmin >= xmax || ymin >= ymax) {
        return { xmin: -1, xmax: 1, ymin: -1, ymax: 1 };
      }
      return { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
    }

    /* ---------- 3.6 点/线取值(引用解析) ---------- */
    // ptRef:任何"点写法" -> {ok,x,y}:{x,y}字面量(分量可为表达式) / def 点 id / object 点 id
    function ptRef(v, stack) {
      var r = { ok: false, x: NaN, y: NaN };
      if (isObj(v)) {
        var px = calcVal(v.x, env), py = calcVal(v.y, env);
        if (isNum(px) && isNum(py)) { r.ok = true; r.x = px; r.y = py; }
        return r;
      }
      if (isArr(v) && v.length >= 2) {
        var qx = calcVal(v[0], env), qy = calcVal(v[1], env);
        if (isNum(qx) && isNum(qy)) { r.ok = true; r.x = qx; r.y = qy; }
        return r;
      }
      if (isStr(v)) {
        if (has(defMap, v)) {
          defCompute(defMap[v], stack);
          var d = defMap[v];
          if (d._ok && d._kind === 'pt') { r.ok = true; r.x = d._x; r.y = d._y; }
          return r;
        }
        if (has(objMap, v)) {
          objCompute(objMap[v], stack);
          var o = objMap[v];
          if (o._ok && o._kind === 'pt') { r.ok = true; r.x = o._x; r.y = o._y; }
          return r;
        }
      }
      return r;
    }
    // lineRef:任何"直线写法" -> {ok,ax,ay,dx,dy}(ax/ay 线上一点,dx/dy 方向)
    function lineRef(v, stack) {
      var r = { ok: false, ax: NaN, ay: NaN, dx: NaN, dy: NaN };
      if (isStr(v)) {
        if (has(defMap, v)) {
          defCompute(defMap[v], stack);
          var d = defMap[v];
          if (d._ok && d._kind === 'line') { r.ok = true; r.ax = d._ax; r.ay = d._ay; r.dx = d._dx; r.dy = d._dy; }
          return r;
        }
        if (has(objMap, v)) {
          objCompute(objMap[v], stack);
          var o = objMap[v];
          if (o._ok && (o.type === 'line' || o.type === 'segment' || o.type === 'ray' || o.type === 'arrow')) {
            r.ok = true; r.ax = o._ax; r.ay = o._ay; r.dx = o._dx; r.dy = o._dy;
          }
          return r;
        }
      }
      if (isObj(v) && (v.a !== undefined || v.b !== undefined)) {
        var pa = ptRef(v.a, stack), pb = ptRef(v.b, stack);
        if (pa.ok && pb.ok) {
          r.ok = true; r.ax = pa.x; r.ay = pa.y;
          r.dx = pb.x - pa.x; r.dy = pb.y - pa.y;
        }
        return r;
      }
      return r;
    }
    // 长度平方:兼容两类载体 — 求值结果 {dx,dy} 与条目缓存 {_dx,_dy}
    function lineLen2(l) {
      var qx = isNum(l._dx) ? l._dx : l.dx;
      var qy = isNum(l._dy) ? l._dy : l.dy;
      return qx * qx + qy * qy;
    }

    /* def 计算(帧内 memo + 递归依赖 + 循环防护) */
    function defCompute(def, stack) {
      if (def._fe === frameEpoch) return def._ok;
      if (stack.indexOf(def.id) >= 0) { def._ok = false; def._fe = frameEpoch; return false; }
      stack.push(def.id);
      var fail = function () {
        def._ok = false;
        def._fe = frameEpoch;
        stack.pop();
        return false;
      };
      def._ok = false; def._kind = 'pt';
      env.x = 0; // 每次求值前重置曲线自变量,避免上一条曲线的采样值泄漏到本次(D8)
      try {
        if (def._ovr) { // 拖动覆盖:自由点被用户拖走,派生几何照常跟随
          def._x = def._ovr.x; def._y = def._ovr.y;
          def._ok = true; def._kind = 'pt';
        } else if (def.op === 'fixed') {
          var fx = calcVal(def.x, env), fy = calcVal(def.y, env);
          if (isNum(fx) && isNum(fy)) { def._x = fx; def._y = fy; def._ok = true; }
        } else if (def.op === 'line') {
          var p1 = ptRef(def.a, stack), p2 = ptRef(def.b, stack);
          if (p1.ok && p2.ok) {
            def._ax = p1.x; def._ay = p1.y; def._bx = p2.x; def._by = p2.y;
            def._dx = p2.x - p1.x; def._dy = p2.y - p1.y;
            if (lineLen2(def) > 1e-18) { def._ok = true; def._kind = 'line'; }
          }
        } else if (def.op === 'onLine') {
          var l1 = lineRef(def.line, stack);
          var t1 = calcVal(def.t, env);
          if (l1.ok && isNum(t1)) {
            def._x = l1.ax + t1 * l1.dx;
            def._y = l1.ay + t1 * l1.dy;
            def._ok = true;
          }
        } else if (def.op === 'reflect') {
          var pp = ptRef(def.pt, stack);
          var lr = lineRef(def.line, stack);
          if (pp.ok && lr.ok && lineLen2(lr) > 1e-18) {
            var tt = ((pp.x - lr.ax) * lr.dx + (pp.y - lr.ay) * lr.dy) / lineLen2(lr);
            def._x = 2 * (lr.ax + tt * lr.dx) - pp.x;
            def._y = 2 * (lr.ay + tt * lr.dy) - pp.y;
            def._ok = true;
          }
        } else if (def.op === 'lineIntersect') {
          var m1 = lineRef(def.l1, stack), m2 = lineRef(def.l2, stack);
          if (m1.ok && m2.ok) {
            var cr = m1.dx * m2.dy - m1.dy * m2.dx;
            if (Math.abs(cr) > 1e-12) { // 不平行才有唯一交点
              var s = ((m2.ax - m1.ax) * m2.dy - (m2.ay - m1.ay) * m2.dx) / cr;
              def._x = m1.ax + s * m1.dx;
              def._y = m1.ay + s * m1.dy;
              def._ok = true;
            }
          }
        } else if (def.op === 'mid') {
          var ma = ptRef(def.a, stack), mb = ptRef(def.b, stack);
          if (ma.ok && mb.ok) { def._x = (ma.x + mb.x) / 2; def._y = (ma.y + mb.y) / 2; def._ok = true; }
        } else if (def.op === 'between') {
          var ba = ptRef(def.a, stack), bb = ptRef(def.b, stack);
          var bt = calcVal(def.t, env);
          if (ba.ok && bb.ok && isNum(bt)) {
            def._x = ba.x + bt * (bb.x - ba.x);
            def._y = ba.y + bt * (bb.y - ba.y);
            def._ok = true;
          }
        } else {
          return fail(); // 未知 op
        }
      } catch (e) {
        return fail();
      }
      def._fe = frameEpoch;
      stack.pop();
      return def._ok;
    }

    // 曲线"至少能画出一个有限可见结果"的判据:按与绘制阶段相同的采样密度
    // (240 点)扫一遍,只要有一个有限且量级可绘的点即视为可画。
    // 用它替代"fn 能编译就算 ok":像 'sqrt(x)' 取 x<0 这种整段 NaN 的曲线,
    // 以前 _ok=true 但画布空白,AI 场景的"有效图元比例"校验会被骗过(D3)。
    function curveHasFiniteSample(fn, xa, xb) {
      if (!fn || !isNum(xa) || !isNum(xb)) return false;
      var keep = env.x, i, y, r, found = false;
      for (i = 0; i < 240 && !found; i++) {
        env.x = xa + (xb - xa) * i / 239;
        if (!isNum(env.x)) break; // 区间溢出:无法采样
        y = NaN;
        try { r = fn(env); if (isNum(r)) y = r; } catch (e) { y = NaN; }
        if (isFinite(y) && Math.abs(y) <= 1e8) found = true;
      }
      env.x = keep; // 恢复现场,不影响调用方的 env
      return found;
    }

    /* object 计算:把类型参数解析为可绘制数据(帧内 memo + 递归防护) */
    function objCompute(o, stack) {
      if (o._fe === frameEpoch) return o._ok;
      if (stack.indexOf(o.id) >= 0) { o._ok = false; o._fe = frameEpoch; return false; }
      stack.push(o.id);
      var fail = function () {
        o._ok = false;
        o._fe = frameEpoch;
        stack.pop();
        return false;
      };
      o._ok = false; o._kind = 'none';
      env.x = 0; // 每次求值前重置曲线自变量(D8,理由同 defCompute)
      try {
        var t = o.type;
        if (t === 'dot') {
          if (o._ovr) { o._x = o._ovr.x; o._y = o._ovr.y; o._ok = true; o._kind = 'pt'; }
          else {
            var d1 = ptRef(o.pt, stack);
            if (d1.ok) { o._x = d1.x; o._y = d1.y; o._ok = true; o._kind = 'pt'; }
          }
        } else if (t === 'segment' || t === 'arrow') {
          var s1 = ptRef(o.a, stack), s2 = ptRef(o.b, stack);
          if (s1.ok && s2.ok) {
            o._ax = s1.x; o._ay = s1.y; o._bx = s2.x; o._by = s2.y;
            o._dx = s2.x - s1.x; o._dy = s2.y - s1.y;
            // 退化判定:a=b 的线段/箭头只有一个点,描边什么都画不出来。
            // 阈值与 line/ray 一致(世界长度 > 1e-9),极短但仍可放大观察的图元照旧可见(D3)
            if (lineLen2(o) > 1e-18) { o._ok = true; o._kind = 'line'; }
          }
        } else if (t === 'line' || t === 'ray') {
          if (o.b !== undefined) { // a/b 双点形式(引用点 def 或字面量)
            var g1 = ptRef(o.a, stack), g2 = ptRef(o.b, stack);
            if (g1.ok && g2.ok) {
              o._ax = g1.x; o._ay = g1.y; o._bx = g2.x; o._by = g2.y;
              o._dx = g2.x - g1.x; o._dy = g2.y - g1.y;
              if (lineLen2(o) > 1e-18) { o._ok = true; o._kind = 'line'; }
            }
          } else { // a 直接引用一条 line def(如 {type:'line', a:'river'})
            var gL = lineRef(o.a, stack);
            if (gL.ok) {
              o._ax = gL.ax; o._ay = gL.ay;
              o._bx = gL.ax + gL.dx; o._by = gL.ay + gL.dy;
              o._dx = gL.dx; o._dy = gL.dy;
              o._ok = true; o._kind = 'line';
            }
          }
        } else if (t === 'circle') {
          var cc = ptRef(o.c, stack);
          var rr = NaN;
          if (o.r !== undefined) { rr = calcVal(o.r, env); }
          else if (o.rPt !== undefined) {
            var rp = ptRef(o.rPt, stack);
            if (cc.ok && rp.ok) {
              rr = Math.sqrt(Math.pow(rp.x - cc.x, 2) + Math.pow(rp.y - cc.y, 2));
            }
          }
          // r = 0 的"圆"是一个点:ctx.arc 半径为 0 什么都画不出来,按退化处理(D3)
          if (cc.ok && isNum(rr) && rr > 0 && rr < 1e7) {
            o._x = cc.x; o._y = cc.y; o._r = rr; o._ok = true; o._kind = 'pt';
          }
        } else if (t === 'polyline' || t === 'polygon') {
          var arr = isArr(o.pts) ? o.pts : [];
          var okAll = arr.length > 0, px = [], py = [];
          for (var i = 0; i < arr.length; i++) {
            var ppi = ptRef(arr[i], stack);
            if (!ppi.ok) { okAll = false; break; }
            px.push(ppi.x); py.push(ppi.y);
          }
          if (okAll) {
            o._px = px; o._py = py; o._n = px.length;
            // 退化判定:只给 1 个点画不出折线/多边形;所有点重合时同样不可见。
            // 判据取"严格不相等"(不设最小长度阈值),极短但仍可放大观察的图元照旧可见(D3)
            var mnx = px[0], mxx = px[0], mny = py[0], mxy = py[0], jj;
            for (jj = 1; jj < px.length; jj++) {
              if (px[jj] < mnx) mnx = px[jj];
              if (px[jj] > mxx) mxx = px[jj];
              if (py[jj] < mny) mny = py[jj];
              if (py[jj] > mxy) mxy = py[jj];
            }
            if (px.length >= 2 && (mxx > mnx || mxy > mny)) { o._ok = true; o._kind = 'none'; }
          }
        } else if (t === 'curve') {
          // fn 必须可编译;x0/x1 每帧求值(可含 u),采样放绘制阶段。
          // 仅"编译成功"不代表画得出来:整段采样都是 NaN 的曲线仍是空白,
          // 故这里按与绘制阶段同一套判据预采样一次,只有存在有限采样点才算 ok(D3)
          var fnf = compileExpr(isStr(o.fn) ? o.fn : '');
          if (fnf) {
            var xa = calcVal(o.x0, env), xb = calcVal(o.x1, env);
            if (!isNum(xa)) xa = -5;
            if (!isNum(xb)) xb = 5;
            if (xa > xb) { var sw = xa; xa = xb; xb = sw; }
            o._fn = fnf; o._xa = xa; o._xb = xb;
            if (curveHasFiniteSample(fnf, xa, xb)) { o._ok = true; o._kind = 'none'; }
          }
        } else if (t === 'text') {
          var ta = ptRef(o.at, stack);
          if (ta.ok) { o._x = ta.x; o._y = ta.y; o._ok = true; o._kind = 'pt'; }
        } else {
          return fail();
        }
      } catch (e) {
        return fail();
      }
      o._fe = frameEpoch;
      stack.pop();
      return o._ok;
    }

    /* ---------- 3.7 数值外观工具 ---------- */
    function pxNum(v, def) { return isNum(v) ? v : def; }
    function offset2(o, dx, dy) {
      var x = dx, y = dy;
      if (isObj(o)) { x = pxNum(o.x, dx); y = pxNum(o.y, dy); }
      return { x: x, y: y };
    }
    function colorOf(o, def) { return isStr(o.color) ? o.color : def; }
    function fontOf(px) { return px + 'px ' + FONT_STACK; }
    // 刻度步长:按屏幕最小间距反推 1/2/5 × 10^k 的"友好"步长
    // 安全约定:返回值恒为有限正数。步长同时是刻度/网格循环的除数与步进量,
    // 非有限值时循环会失去上界(D1)。
    function niceStep(pxPerUnit, minPx) {
      if (!isNum(pxPerUnit) || pxPerUnit <= 0) return 1;
      var raw = minPx / pxPerUnit;
      if (!isNum(raw) || raw <= 0) return 1;
      var pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
      if (!isNum(pow) || pow <= 0) return 1;
      var m;
      if (raw / pow <= 1.000001) m = 1;
      else if (raw / pow <= 2.000001) m = 2;
      else if (raw / pow <= 5.000001) m = 5;
      else m = 10;
      var s = m * pow;
      if (!isNum(s) || s <= 0) return 1;
      return s;
    }
    function tickDigits(step) {
      // 上限 12:极端相机比例下 -log10(step) 可达数百,而 toFixed(n>100) 会抛
      // RangeError 把整帧绘制打断,故夹取到安全位数(正常视野下远小于此值)
      if (step >= 1) return 0;
      return clamp(Math.ceil(-Math.log(step) / Math.LN10 - 1e-9), 0, 12);
    }
    // 参数直线对矩形裁剪(简化 Liang-Barsky),返回端点或 null
    function clipParamLine(x0, y0, x1, y1, dx, dy, t0, t1, rect) {
      var lo = t0, hi = t1, ta, tb;
      if (Math.abs(dx) < 1e-15) {
        if (x0 < rect.xmin || x0 > rect.xmax) return null;
      } else {
        ta = (rect.xmin - x0) / dx; tb = (rect.xmax - x0) / dx;
        lo = Math.max(lo, Math.min(ta, tb)); hi = Math.min(hi, Math.max(ta, tb));
      }
      if (Math.abs(dy) < 1e-15) {
        if (y0 < rect.ymin || y0 > rect.ymax) return null;
      } else {
        ta = (rect.ymin - y0) / dy; tb = (rect.ymax - y0) / dy;
        lo = Math.max(lo, Math.min(ta, tb)); hi = Math.min(hi, Math.max(ta, tb));
      }
      if (hi < lo - 1e-12) return null;
      return { x0: x0 + lo * dx, y0: y0 + lo * dy, x1: x0 + hi * dx, y1: y0 + hi * dy };
    }
    // 世界坐标线段绘制:按可视矩形(rectEx,可扩边)裁剪后描边
    // (segment 图元专用;此前该函数缺失导致所有线段被 drawScene 的
    //  单对象 try/catch 静默吞掉:PA/PB 折线、A→A′、A′B、A→Q→B 全部画不出来)
    function strokeWorldSeg(ax, ay, bx, by, rectEx, width, color, dash) {
      if (!isNum(ax) || !isNum(ay) || !isNum(bx) || !isNum(by)) return;
      var seg = clipParamLine(ax, ay, bx, by, bx - ax, by - ay, 0, 1, rectEx);
      if (!seg) return;
      ctx.lineWidth = pxNum(width, 1.5);
      ctx.strokeStyle = color;
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash(dash ? (isArr(dash) ? dash : [6, 4]) : []);
      }
      ctx.beginPath();
      ctx.moveTo(w2sx(seg.x0), w2sy(seg.y0));
      ctx.lineTo(w2sx(seg.x1), w2sy(seg.y1));
      ctx.stroke();
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
    }

    /* ---------- 3.8 绘制:坐标轴(极简:细轴 + 刻度短线 + 整数值灰字) ---------- */
    function drawAxes() {
      var rect = viewRect(0);
      var pxU = cam.scale;
      var step = niceStep(pxU, 46);
      var digits = tickDigits(step);
      var ox = w2sx(0), oy = w2sy(0);
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 1;
      // 淡刻度线(网格,默认关;开时 5% 透明度白线)
      if (gridOn) {
        ctx.strokeStyle = GRID_COLOR;
        var gk, gv, gsx, gsy, gIter = 0;
        ctx.beginPath();
        for (gk = Math.ceil(rect.xmin / step); gk * step <= rect.xmax + 1e-9; gk++) {
          if (++gIter > MAX_TICK_ITERS) break;   // 硬上限:任何情况下循环必须有界
          gv = gk * step; gsx = w2sx(gv);
          if (!isNum(gv) || !isNum(gsx)) break;  // 非有限坐标:立即停,不再迭代
          if (Math.abs(gv) > 1e-9) {
            ctx.moveTo(gsx, 0); ctx.lineTo(gsx, cssH);
          }
        }
        for (gk = Math.ceil(rect.ymin / step); gk * step <= rect.ymax + 1e-9; gk++) {
          if (++gIter > MAX_TICK_ITERS) break;
          gv = gk * step; gsy = w2sy(gv);
          if (!isNum(gv) || !isNum(gsy)) break;
          if (Math.abs(gv) > 1e-9) {
            ctx.moveTo(0, gsy); ctx.lineTo(cssW, gsy);
          }
        }
        ctx.stroke();
        ctx.strokeStyle = AXIS_COLOR;
      }
      // X 轴(y=0 在可视内才画;原点默认总被 fit 纳入)
      if (rect.ymin <= 0 && rect.ymax >= 0) {
        ctx.strokeStyle = AXIS_COLOR;
        ctx.beginPath();
        ctx.moveTo(0, oy); ctx.lineTo(cssW, oy);
        ctx.stroke();
        // 刻度短线 + 整数值
        ctx.strokeStyle = AXIS_TEXT;
        ctx.beginPath();
        var k, v, sx, kIter = 0;
        for (k = Math.ceil(rect.xmin / step); k * step <= rect.xmax + 1e-9; k++) {
          if (++kIter > MAX_TICK_ITERS) break;   // 硬上限(D1)
          v = k * step; sx = w2sx(v);
          if (!isNum(v) || !isNum(sx)) break;
          if (Math.abs(v) < 1e-9) continue; // 0 由原点小标负责
          ctx.moveTo(sx, oy - 3); ctx.lineTo(sx, oy + 3);
        }
        ctx.stroke();
        ctx.fillStyle = AXIS_TEXT;
        ctx.font = fontOf(10);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (k = Math.ceil(rect.xmin / step); k * step <= rect.xmax + 1e-9; k++) {
          if (++kIter > MAX_TICK_ITERS) break;
          v = k * step; sx = w2sx(v);
          if (!isNum(v) || !isNum(sx)) break;
          if (Math.abs(v) < 1e-9) continue;
          ctx.fillText(v.toFixed(digits), sx, oy + 5);
        }
      }
      // Y 轴(x=0 在可视内才画)
      if (rect.xmin <= 0 && rect.xmax >= 0) {
        kIter = 0; // 计数器复用前必须归零(否则上一条轴用满上限会连带截断这一条)
        ctx.strokeStyle = AXIS_COLOR;
        ctx.beginPath();
        ctx.moveTo(ox, 0); ctx.lineTo(ox, cssH);
        ctx.stroke();
        ctx.strokeStyle = AXIS_TEXT;
        ctx.beginPath();
        for (k = Math.ceil(rect.ymin / step); k * step <= rect.ymax + 1e-9; k++) {
          if (++kIter > MAX_TICK_ITERS) break;   // 硬上限(D1)
          v = k * step; sx = w2sy(v);
          if (!isNum(v) || !isNum(sx)) break;
          if (Math.abs(v) < 1e-9) continue;
          ctx.moveTo(ox - 3, sx); ctx.lineTo(ox + 3, sx);
        }
        ctx.stroke();
        ctx.fillStyle = AXIS_TEXT;
        ctx.font = fontOf(10);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (k = Math.ceil(rect.ymin / step); k * step <= rect.ymax + 1e-9; k++) {
          if (++kIter > MAX_TICK_ITERS) break;
          v = k * step; sx = w2sy(v);
          if (!isNum(v) || !isNum(sx)) break;
          if (Math.abs(v) < 1e-9) continue;
          ctx.fillText(v.toFixed(digits), ox - 5, sx);
        }
      }
      // 原点 0(仅原点可见时,单个灰点标签避免双轴 0 重叠)
      if (ox > 8 && ox < cssW - 8 && oy > 8 && oy < cssH - 8) {
        ctx.fillStyle = 'rgba(143,163,192,0.6)';
        ctx.font = fontOf(10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('0', ox + 4, oy + 4);
      }
    }

    /* ---------- 3.9 绘制:图元 ---------- */
    function setDash(o) {
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash(o.dash ? (isArr(o.dash) ? o.dash : [6, 4]) : []);
      }
    }
    // 颜色字符串加透明度:支持 #rrggbb / rgba(尽可能),失败原样返回
    function colToA(col, a) {
      if (!isStr(col)) return col;
      var m;
      if ((m = /^#([0-9a-fA-F]{6})$/.exec(col))) {
        return 'rgba(' + parseInt(m[1].substring(0, 2), 16) + ',' +
          parseInt(m[1].substring(2, 4), 16) + ',' + parseInt(m[1].substring(4, 6), 16) + ',' + a + ')';
      }
      if ((m = /^rgba?\(([^)]+)\)$/.exec(col))) {
        var parts = m[1].split(',');
        if (parts.length >= 3) {
          return 'rgba(' + parts[0].trim() + ',' + parts[1].trim() + ',' + parts[2].trim() + ',' + a + ')';
        }
      }
      return col;
    }
    function drawLabelText(text, x, y, col, size, align, baseline) {
      if (!isStr(text) || !text) return;
      ctx.fillStyle = col;
      ctx.font = fontOf(size);
      ctx.textAlign = align || 'left';
      ctx.textBaseline = baseline || 'middle';
      ctx.fillText(text, x, y);
    }
    // 线/射线上的名字(取可视段 38% 处,沿屏幕法线向外偏 16px)
    function drawLineCaption(o, colorStr, segA, segB, labelTxt) {
      if (!isStr(labelTxt) || !labelTxt) return;
      var s1x = w2sx(segA.x0), s1y = w2sy(segA.y0);
      var s2x = w2sx(segB.x1), s2y = w2sy(segB.y1);
      var mx = s1x + (s2x - s1x) * 0.38, my = s1y + (s2y - s1y) * 0.38;
      var lx = s2x - s1x, ly = s2y - s1y;
      var ln = Math.sqrt(lx * lx + ly * ly) || 1;
      var nx = -ly / ln, ny = lx / ln;
      if (ny > 0) { nx = -nx; ny = -ny; } // 法线取"偏上"一侧
      drawLabelText(labelTxt, mx + nx * 16, my + ny * 16, colToA(colorStr, 0.95), 11, 'center', 'middle');
    }

    /* 光点:柔光晕 + 主体圆 + 高光(屏幕空间恒定尺寸,不随缩放) */
    function drawDot(o) {
      if (!o || !o._ok || !isNum(o._x) || !isNum(o._y)) return;
      var col = colorOf(o, PAL.cyan);
      var x = w2sx(o._x), y = w2sy(o._y);
      var r = Math.max(2.5, pxNum(o.r, 5));
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // 高光小点(左上)
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.35, Math.max(1, r * 0.32), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawObj(o, rectEx) {
      var col;
      switch (o.type) {
      case 'dot':
        drawDot(o);
        if (o.label !== undefined && isStr(o.label)) {
          var off = offset2(o.offset, 8, -8);
          var rx = pxNum(o.r, 5);
          drawLabelText(o.label, w2sx(o._x) + off.x + rx, w2sy(o._y) + off.y - rx,
            isStr(o.labelColor) ? o.labelColor : 'rgba(234,242,255,0.92)', 12, 'left', 'middle');
        }
        break;
      case 'segment':
        if (!o._ok) break;
        strokeWorldSeg(o._ax, o._ay, o._bx, o._by, rectEx,
          pxNum(o.width, 1.5), colorOf(o, PAL.gray), o.dash);
        break;
      case 'line': {
        if (!o._ok) break;
        col = colorOf(o, PAL.cyan);
        var inf = clipParamLine(o._ax, o._ay, o._bx, o._by, o._dx, o._dy,
          -1e7, 1e7, rectEx);
        if (inf) {
          ctx.lineWidth = pxNum(o.width, 1.5);
          ctx.strokeStyle = col;
          setDash(o);
          ctx.beginPath();
          ctx.moveTo(w2sx(inf.x0), w2sy(inf.y0));
          ctx.lineTo(w2sx(inf.x1), w2sy(inf.y1));
          ctx.stroke();
          drawLineCaption(o, col, inf, inf, o.label);
        }
        break;
      }
      case 'ray': {
        if (!o._ok) break;
        col = colorOf(o, PAL.cyan);
        var ry = clipParamLine(o._ax, o._ay, o._bx, o._by, o._dx, o._dy,
          0, 1e7, rectEx);
        if (ry) {
          ctx.lineWidth = pxNum(o.width, 1.5);
          ctx.strokeStyle = col;
          setDash(o);
          ctx.beginPath();
          ctx.moveTo(w2sx(ry.x0), w2sy(ry.y0));
          ctx.lineTo(w2sx(ry.x1), w2sy(ry.y1));
          ctx.stroke();
          drawLineCaption(o, col, ry, ry, o.label);
        }
        break;
      }
      case 'circle':
        if (!o._ok) break;
        col = colorOf(o, PAL.cyan);
        ctx.lineWidth = pxNum(o.width, 1.5);
        ctx.strokeStyle = col;
        setDash(o);
        ctx.beginPath();
        ctx.arc(w2sx(o._x), w2sy(o._y), o._r * cam.scale, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'polyline':
      case 'polygon':
        if (!o._ok || !o._n) break;
        col = colorOf(o, PAL.cyan);
        ctx.beginPath();
        var i;
        ctx.moveTo(w2sx(o._px[0]), w2sy(o._py[0]));
        for (i = 1; i < o._n; i++) ctx.lineTo(w2sx(o._px[i]), w2sy(o._py[i]));
        if (o.type === 'polygon') {
          ctx.closePath();
          var fill = isStr(o.fill) ? o.fill : 'rgba(79,195,247,0.08)';
          if (fill && fill !== 'none') {
            ctx.fillStyle = fill;
            ctx.fill();
          }
        }
        ctx.lineWidth = pxNum(o.width, 1.5);
        ctx.strokeStyle = col;
        setDash(o);
        ctx.stroke();
        break;
      case 'arrow': {
        if (!o._ok) break;
        col = colorOf(o, PAL.gray);
        var aSeg = clipParamLine(o._ax, o._ay, o._bx, o._by, o._dx, o._dy, 0, 1, rectEx);
        if (!aSeg) break;
        var aw = pxNum(o.width, 1.5);
        ctx.lineWidth = aw;
        ctx.strokeStyle = col;
        setDash(o);
        ctx.beginPath();
        ctx.moveTo(w2sx(aSeg.x0), w2sy(aSeg.y0));
        ctx.lineTo(w2sx(aSeg.x1), w2sy(aSeg.y1));
        ctx.stroke();
        // 箭头(屏幕空间,尺寸不随缩放)
        var ax1 = w2sx(aSeg.x1), ay1 = w2sy(aSeg.y1);
        var ang = Math.atan2(ay1 - w2sy(aSeg.y0), ax1 - w2sx(aSeg.x0));
        var hs = Math.max(9, aw + 7);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(ax1, ay1);
        ctx.lineTo(ax1 - hs * Math.cos(ang - 0.38), ay1 - hs * Math.sin(ang - 0.38));
        ctx.lineTo(ax1 - hs * Math.cos(ang + 0.38), ay1 - hs * Math.sin(ang + 0.38));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'curve': {
        if (!o._ok || !o._fn) break;
        col = colorOf(o, PAL.gold);
        var nSamp = 240;
        var rectV = viewRect(0);
        var bandLo = rectV.ymin - (rectV.ymax - rectV.ymin) * 0.3;
        var bandHi = rectV.ymax + (rectV.ymax - rectV.ymin) * 0.3;
        ctx.lineWidth = pxNum(o.width, 1.5);
        ctx.strokeStyle = col;
        setDash(o);
        ctx.beginPath();
        var pen = false;
        for (i = 0; i < nSamp; i++) {
          env.x = o._xa + (o._xb - o._xa) * i / (nSamp - 1);
          var yy = NaN;
          try { var rv = o._fn(env); if (isNum(rv)) yy = rv; } catch (e) { yy = NaN; }
          if (!isFinite(yy) || yy < -1e8 || yy > 1e8) { pen = false; continue; }
          if (yy < bandLo || yy > bandHi) { pen = false; continue; } // y 超界忽略该点
          var cx2 = w2sx(env.x), cy2 = w2sy(yy);
          if (!pen) { ctx.moveTo(cx2, cy2); pen = true; }
          else { ctx.lineTo(cx2, cy2); }
        }
        ctx.stroke();
        break;
      }
      case 'text':
        if (!o._ok || !isStr(o.text)) break;
        var tOff = offset2(o.offset, 0, -14);
        drawLabelText(o.text, w2sx(o._x) + tOff.x, w2sy(o._y) + tOff.y,
          colorOf(o, PAL.white), pxNum(o.size, 12),
          isStr(o.align) ? o.align : 'center', isStr(o.baseline) ? o.baseline : 'middle');
        break;
      default:
        break;
      }
    }

    /* ---------- 3.10 MathJax 标注层 ---------- */
    // tex 对象:labelsEl 内建 <span>,内容 textContent 写入含 $..$ 文本,
    // 随后尝试 window.MathJax.typesetPromise([labelsEl])(失败吞错)。
    function spanFor(o) {
      var sp = null;
      var i;
      for (i = 0; i < overlayList.length; i++) {
        if (overlayList[i].id === o.id) { sp = overlayList[i]; break; }
      }
      if (!sp && doc) {
        var el = doc.createElement('span');
        // 必须逐属性赋值:element.style 是 CSSOM 的 PutForwards 属性,整体赋一个
        // 对象会被转成 style.cssText = "[object Object]" → 所有声明被判非法丢弃,
        // tex 公式就全部堆在 #glLabels 左上角(与上面建容器时的写法保持一致,D4)
        try {
          if (!el.style) el.style = {};
          el.style.position = 'absolute';
          el.style.transform = 'translate(-50%, -100%)';
          el.style.pointerEvents = 'none';
          el.style.whiteSpace = 'nowrap';
          el.style.color = '#eaf2ff';
        } catch (e) { /* 样式写入失败忽略 */ }
        el.textContent = o.tex;
        if (labelsBox && labelsBox.appendChild) labelsBox.appendChild(el);
        sp = { id: o.id, span: el, tex: o.tex, lastX: NaN, lastY: NaN, lastVis: true };
        overlayList.push(sp);
        scheduleTypeset();
      } else if (sp && sp.tex !== o.tex) {
        sp.tex = o.tex;
        sp.span.textContent = o.tex;
        scheduleTypeset();
      }
      return sp;
    }
    function scheduleTypeset() {
      if (typesetPending) return;
      typesetPending = true;
      setTimeout(function () {
        typesetPending = false;
        if (!labelsBox || !global.MathJax || typeof global.MathJax.typesetPromise !== 'function') return;
        try {
          global.MathJax.typesetPromise([labelsBox])
            .then(function () { })
            .catch(function () { /* 公式排版失败不影响演示 */ });
        } catch (e) { /* 忽略 */ }
      }, 0);
    }
    function layoutOverlays() {
      if (!labelsBox) return;
      var i, sp, o;
      var boxW = cssW, boxH = cssH;
      try {
        if (labelsAuto && labelsBox.style) {
          // 自建容器按画布像素对齐(画布因 dpr 缩放,容器跟 CSS 尺寸走)。
          // 只在尺寸真的变化时才写:每帧无条件写 style 会持续触发样式重算。
          if (labelsBoxW !== cssW) { labelsBox.style.width = cssW + 'px'; labelsBoxW = cssW; }
          if (labelsBoxH !== cssH) { labelsBox.style.height = cssH + 'px'; labelsBoxH = cssH; }
        }
      } catch (e) { /* 忽略 */ }
      for (i = 0; i < overlayList.length; i++) {
        sp = overlayList[i];
        o = has(objMap, sp.id) ? objMap[sp.id] : null;
        var vis = false, x = NaN, y = NaN;
        if (o && o.type === 'text') {
          if (o._fe !== frameEpoch) {
            try { objCompute(o, []); } catch (e) { /* 忽略 */ }
          }
          if (o._ok) {
            x = w2sx(o._x) + (isObj(o.offset) ? pxNum(o.offset.x, 0) : 0);
            y = w2sy(o._y) + (isObj(o.offset) ? pxNum(o.offset.y, 0) : 0);
            // 超出可视区(留富余)则隐藏
            vis = x > -220 && x < boxW + 220 && y > -80 && y < boxH + 120;
          }
        }
        if (!vis) {
          if (!sp.lastVis) continue;
          sp.lastVis = false;
          sp.span.style.display = 'none';
        } else {
          var dx = x - sp.lastX, dy = y - sp.lastY;
          // NaN 安全的"位移超过阈值"判定:首次排版时 lastX/lastY 是 NaN,
          // 写成 |dx|>0.5 的话 NaN 比较恒为 false,第一次定位会被整段跳过
          // (tex 标注要等到第二帧才落到坐标上,静态场景则永远停在左上角)。
          // 非 NaN 时 !(|dx|<=0.5 && |dy|<=0.5) 与旧写法完全等价
          if (!sp.lastVis || !(Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5)) {
            sp.lastVis = true;
            sp.lastX = x; sp.lastY = y;
            sp.span.style.display = '';
            sp.span.style.left = Math.round(x) + 'px';
            sp.span.style.top = Math.round(y) + 'px';
          }
        }
      }
    }

    /* ---------- 3.11 主绘制 ---------- */
    function drawScene() {
      if (!ctx || !cssW || !cssH) return;
      // O1:仅当几何可能变化时推进帧代际,否则复用上一帧的求值结果(见 geomU 处说明)
      if (playing || dragActive || u !== geomU) { frameEpoch++; geomU = u; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      env.u = u;
      drawAxes();
      // 逐个求值并绘制(单个对象出错不影响其它图元)
      var rectEx = viewRect(0.35);
      var i;
      for (i = 0; i < objList.length; i++) {
        try {
          objCompute(objList[i], []);
          drawObj(objList[i], rectEx);
        } catch (e) { /* 单对象异常吞掉 */ }
      }
      // tex 覆盖层最后排版定位
      try { layoutOverlays(); } catch (e) { /* 忽略 */ }
    }
    function requestDraw() { // 轻量重绘:无动画时同步直绘
      if (playing) { dirty = true; scheduleFrame(); }
      else { drawScene(); }
    }
    function redraw() { requestDraw(); }

    /* ---------- 3.12 内容管理:按 id 合并 defs / objects ---------- */
    function mergeById(list, map, items) {
      var i, k, it, e, pos;
      // 1) 声明"仍需要"的 id:本次描述未提到的旧条目整条移除(回收 map)。
      //    wanted/posOf 都是"以外部 id 为键"的字典,必须用无原型对象,
      //    否则 id='constructor'/'__proto__' 会命中原型链导致条目被静默丢弃(D6)
      var wanted = Object.create(null);
      for (i = 0; i < items.length; i++) {
        if (items[i] && isStr(items[i].id)) wanted[items[i].id] = 1;
      }
      var kept = [];
      for (i = 0; i < list.length; i++) {
        if (has(wanted, list[i].id)) kept.push(list[i]);
        else { delete map[list[i].id]; }
      }
      // 2) 按"旧条目保位 + 新条目追加"的顺序合并:
      //    已存在 id → 原位替换为新条目(旧几何缓存/拖动覆盖一并作废);
      //    新 id → 追加到末尾(依赖前序定义者须自行保证顺序)。
      var order = kept.slice();
      var posOf = Object.create(null);
      for (i = 0; i < order.length; i++) posOf[order[i].id] = i;
      for (i = 0; i < items.length; i++) {
        it = items[i];
        if (!it || !isStr(it.id)) continue;
        e = { id: it.id };
        for (k in it) {
          if (has(it, k)) e[k] = it[k]; // 拷贝描述字段,独立于外部对象
        }
        e._fe = -1;
        e._ovr = null;
        e._ok = false;
        e._kind = 'none';
        if (has(posOf, it.id)) {
          order[posOf[it.id]] = e;
        } else {
          posOf[it.id] = order.length;
          order.push(e);
        }
        map[it.id] = e;
      }
      list.length = 0;
      for (i = 0; i < order.length; i++) list.push(order[i]);
    }
    function clearOverrides() {
      var i;
      for (i = 0; i < defList.length; i++) defList[i]._ovr = null;
      for (i = 0; i < objList.length; i++) objList[i]._ovr = null;
      invalidateGeom();   // 覆盖被清掉 = 几何变了
    }
    function pruneOverlays() {
      var keep = [], i;
      for (i = 0; i < overlayList.length; i++) {
        var sp = overlayList[i];
        var o = has(objMap, sp.id) ? objMap[sp.id] : null;
        if (o && o.type === 'text' && isStr(o.tex)) {
          keep.push(sp);
        } else {
          if (sp.span && sp.span.parentNode) {
            try { sp.span.parentNode.removeChild(sp.span); } catch (e) { /* 忽略 */ }
          }
        }
      }
      overlayList = keep;
    }

    function update(desc) {
      if (!isObj(desc)) return { ok: false, n: 0 };
      try {
        // 动画配置(mode: pingpong|once|loop;dur:u 往返/周期秒数)
        if (isObj(desc.anim)) {
          var m = desc.anim.mode;
          anim.mode = (m === 'once' || m === 'loop' || m === 'pingpong') ? m : 'pingpong';
          var dd = pxNum(desc.anim.dur, 4);
          anim.dur = dd > 0.05 ? dd : 4;
        } else {
          anim.mode = 'pingpong'; anim.dur = 4;
        }
        // 图元与几何定义:按 id 合并(替换同 id / 追加新 id)
        mergeById(defList, defMap, isArr(desc.defs) ? desc.defs : []);
        mergeById(objList, objMap, isArr(desc.objects) ? desc.objects : []);
        pruneOverlays();
        // tex 标注容器建档
        var i;
        for (i = 0; i < objList.length; i++) {
          var o = objList[i];
          if (o.type === 'text' && isStr(o.tex)) spanFor(o);
        }
        // 动画相位回到起点并停止(场景重建视为新的开始)
        u = 0; uPhase = 0; playing = false; lastTs = null;
        clearOverrides();
        // 相机:显式 camera 优先;否则按 autoFitOnUpdate 自动取景
        if (isObj(desc.camera) && isNum(desc.camera.scale)) {
          var ccx = isNum(desc.camera.cx) ? desc.camera.cx : 0;
          var ccy = isNum(desc.camera.cy) ? desc.camera.cy : 0;
          camReq = { scale: desc.camera.scale, cx: ccx, cy: ccy };
          cam.scale = camReq.scale;
          cam.ox = cssW / 2 - ccx * cam.scale;
          cam.oy = cssH / 2 + ccy * cam.scale;
          camReady = true; // 调用方已明确指定机位,尺寸恢复时按新尺寸重摆而不是取景
        } else {
          camReq = null;   // 本场景没给机位:后续按自动取景处理
          if (autoFitOnUpdate) fit();
        }
        redraw();
        return { ok: true, n: objList.length };
      } catch (e) {
        return { ok: false, n: objList.length };
      }
    }

    function clear() {
      defList.length = 0; objList.length = 0;
      invalidateGeom();   // 图元全换了,作废旧缓存
      var k, i;
      for (k in defMap) { if (has(defMap, k)) delete defMap[k]; }
      for (k in objMap) { if (has(objMap, k)) delete objMap[k]; }
      for (i = 0; i < overlayList.length; i++) {
        try {
          if (overlayList[i].span && overlayList[i].span.parentNode) {
            overlayList[i].span.parentNode.removeChild(overlayList[i].span);
          }
        } catch (e) { /* 忽略 */ }
      }
      overlayList = [];
      u = 0; uPhase = 0; playing = false; lastTs = null;
      redraw();
    }

    /* ---------- 3.13 相机:自动取景 fit ---------- */
    // 依据图元包围盒(并集原点)取景,四周留 15% 边距
    function fit() {
      // 画布还没有有效尺寸(面板 hidden)时不能取景:直接返回,由 markResized 在
      // 尺寸由 0 变为有效时补做一次(camReady 保持 false,D7)
      if (!cssW || !cssH) { syncSize(); if (!cssW || !cssH) return; }
      // 取景必须基于最新几何:强制作废缓存,否则可能读到"同一 frameEpoch 下、
      // 但相位不同"的旧求值结果(表现为 u 变化后取景仍按旧相位计算)。
      invalidateGeom();
      geomU = u;
      env.u = u; // 让含 u 的表达式按当前相位求值(取景即时状态)
      var i, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      var add = function (x, y) {
        if (!isNum(x) || !isNum(y)) return;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      };
      add(0, 0); // 轴原点总纳入
      try {
        // 点类 def 参与取景(直线类仅提供锚点,略去避免撑爆画面)
        for (i = 0; i < defList.length; i++) {
          defCompute(defList[i], []);
          var d = defList[i];
          if (d._ok && d._kind === 'pt') add(d._x, d._y);
        }
        // object 取景:线段/点/圆/折线等有限图元;无限直线与射线不参与
        for (i = 0; i < objList.length; i++) {
          objCompute(objList[i], []);
          var o = objList[i];
          if (!o._ok) continue;
          if (o.type === 'dot' || o.type === 'text') {
            add(o._x, o._y);
          } else if (o.type === 'segment' || o.type === 'arrow') {
            add(o._ax, o._ay); add(o._bx, o._by);
          } else if (o.type === 'circle') {
            add(o._x - o._r, o._y - o._r); add(o._x + o._r, o._y + o._r);
          } else if (o.type === 'polyline' || o.type === 'polygon') {
            var j;
            for (j = 0; j < o._n; j++) add(o._px[j], o._py[j]);
          } else if (o.type === 'curve') {
            // 采样曲线,去掉 5% 极端尾部防止渐近线撑爆取景
            var ys = [];
            var fnf = o._fn || compileExpr(isStr(o.fn) ? o.fn : '');
            if (fnf && isNum(o._xa) && isNum(o._xb)) {
              var s;
              for (s = 0; s < 120; s++) {
                env.x = o._xa + (o._xb - o._xa) * s / 119;
                var yv = NaN;
                try {
                  var r2 = fnf(env);
                  if (isNum(r2) && Math.abs(r2) < 1e7) yv = r2;
                } catch (e2) { yv = NaN; }
                if (isFinite(yv)) ys.push(yv);
              }
              if (ys.length > 0) {
                ys.sort(function (a, b) { return a - b; });
                var cut = Math.floor(ys.length * 0.05);
                add(o._xa, ys[cut]);
                add(o._xb, ys[ys.length - 1 - cut]);
              }
            }
          }
        }
      } catch (e) { /* 取景尽力而为 */ }
      var cx, cy, bw, bh;
      if (minX > maxX || !isFinite(minX)) { cx = 0; cy = 0; bw = 10; bh = 7; }
      else {
        cx = (minX + maxX) / 2;
        cy = (minY + maxY) / 2;
        bw = Math.max(maxX - minX, 1e-6);
        bh = Math.max(maxY - minY, 1e-6);
        // 退化轴(如只画一条水平线)补出合理高度
        if (bh < 1e-6) bh = bw * 0.55;
        if (bw < 1e-6) bw = bh * 0.55;
        if (bw < 0.6) bw = 0.6;
        if (bh < 0.6) bh = 0.6;
      }
      // 15% 边距
      var padX = bw * 0.15 + 0.4, padY = bh * 0.15 + 0.4;
      bw += padX * 2; bh += padY * 2;
      cam.scale = Math.min(cssW / bw, cssH / bh);
      cam.ox = cssW / 2 - cx * cam.scale;
      cam.oy = cssH / 2 + cy * cam.scale;
      camReady = true; // 相机已按有效尺寸定过位,后续 resize 不再自动取景
    }
    // 备用交互镜头函数(本版本未接滚轮/拖移,留待后续;勿删)
    function zoomAt(factor, sx, sy) {
      var wx = s2wx(sx), wy = s2wy(sy);
      cam.scale = clamp(cam.scale * factor, 1e-6, 1e7);
      cam.ox = sx - wx * cam.scale;
      cam.oy = sy + wy * cam.scale;
      redraw();
    }
    function panByPx(dx, dy) {
      cam.ox += dx; cam.oy += dy;
      redraw();
    }

    /* ---------- 3.14 动画时钟 ---------- */
    function scheduleFrame() {
      if (rafId != null) return;
      var doFrame = function (ts) {
        rafId = null;
        if (!playing && !dragActive) { // 无动画且无拖动则停表
          if (dirty) { drawScene(); dirty = false; }
          return;
        }
        if (playing) {
          var now = (ts === undefined) ? new Date().getTime() : ts;
          if (lastTs == null) lastTs = now;
          var dt = Math.min(Math.max((now - lastTs) / 1000, 0), 0.1);
          lastTs = now;
          advanceClock(dt);
        }
        drawScene();
        dirty = false;
        if (playing || dragActive) scheduleFrame();
      };
      try {
        if (typeof global.requestAnimationFrame === 'function') {
          rafId = global.requestAnimationFrame(doFrame);
        } else {
          rafId = setTimeout(function () { doFrame(new Date().getTime()); }, 16);
        }
      } catch (e) { rafId = null; }
    }
    function advanceClock(dt) {
      var rate;
      if (anim.mode === 'pingpong') rate = 2 / anim.dur;   // 0→1→0 恰为一个 dur 周期
      else rate = 1 / anim.dur;                            // once/loop:0→1 用满 dur
      advanceU(dt * rate);
      if (anim.mode === 'once' && u >= 1) { u = 1; playing = false; lastTs = null; }
    }
    // u 前进(端点按模式折返/环绕/截停)
    function advanceU(delta) {
      if (!isNum(delta)) return;
      if (anim.mode === 'loop') {
        u += delta;
        if (u > 1) u -= Math.floor(u);
      } else if (anim.mode === 'pingpong') {
        // 相位累加 + 三角波折算:0→1→0 平滑折返,端点不抖动
        // (相位取模 2;u = phase<=1 ? phase : 2-phase)
        var ph = (uPhase + delta) % 2;
        if (ph < 0) ph += 2;
        uPhase = ph;
        u = ph <= 1 ? ph : 2 - ph;
      } else {
        u = clamp(u + delta, 0, 1);
      }
    }
    function play() {
      if (anim.mode === 'once' && u >= 1) { u = 0; uPhase = 0; } // 播完再播:从头
      // 手动拖过的点位(自由点/直线约束点)在重新播放时交还脚本动画
      var i;
      for (i = 0; i < defList.length; i++) if (defList[i]._ovr) defList[i]._ovr = null;
      for (i = 0; i < objList.length; i++) if (objList[i]._ovr) objList[i]._ovr = null;
      invalidateGeom();   // 交还脚本动画 = 几何变了
      playing = true;
      lastTs = null;
      if (!cssW) syncSize();
      drawScene();
      scheduleFrame();
    }
    function pause() { playing = false; lastTs = null; }
    function step(n) {
      var cnt = isNum(n) ? n : 1;
      if (!isFinite(cnt) || cnt === 0) return;
      advanceU(cnt / 48); // 契约:每步推进 u += 1/48
      drawScene();
    }
    function reset() {
      u = 0;
      uPhase = 0;
      playing = false;
      lastTs = null;
      clearOverrides();
      drawScene();
    }
    function setPlaying(b) {
      if (b) { play(); } else { pause(); }
    }

    /* ---------- 3.15 交互:自由点拖动 + 点选 ---------- */
    // 拖动期间动画暂停;命中半径为屏幕 10px;drag:'free' 的 dot 才可拖
    var pending = null;   // pointerdown 时命中的可拖点
    var dragging = null;  // 进行中的拖动
    var dragActive = false;
    var hoverDrag = false;
    var panState = null;  // 空白处拖拽平移(Desmos 式,按下时记录)
    var panning = false;  // 平移进行中
    var viewPan = true;   // 是否允许空白拖拽平移

    function canvasPos(ev) {
      var r = { x: 0, y: 0 };
      try {
        var rc = canvasEl.getBoundingClientRect();
        r.x = ev.clientX - rc.left;
        r.y = ev.clientY - rc.top;
      } catch (e) { /* 忽略 */ }
      return r;
    }
    // 命中判定:返回最上层(后绘)dot,可选仅限可拖点
    function hitDot(px, py, onlyFree) {
      var best = null, i;
      for (i = objList.length - 1; i >= 0; i--) {
        var o = objList[i];
        if (o.type !== 'dot') continue;
        if (onlyFree && !(o.drag === 'free' && !o.fixedFlag)) continue;
        try {
          objCompute(o, []);
          if (!o._ok) continue;
          var sx = w2sx(o._x), sy = w2sy(o._y);
          var dx = sx - px, dy = sy - py;
          if (dx * dx + dy * dy <= 100) { best = o; break; } // 半径 10px
        } catch (e) { /* 忽略 */ }
      }
      return best;
    }
    // 拖动的最终落点是"某 def 的自由坐标"时直接覆盖该 def,
    // 使派生图元(对称/交点/折线)实时跟随;否则覆盖 dot 自身
    function defUnderDot(o) {
      var v = o.pt;
      if (isStr(v) && has(defMap, v)) return defMap[v];
      return null;
    }
    function setDragPos(o, def, wx, wy) {
      if (def) {
        if (!def._ovr) def._ovr = {};
        def._ovr.x = wx; def._ovr.y = wy;
      } else {
        if (!o._ovr) o._ovr = {};
        o._ovr.x = wx; o._ovr.y = wy;
      }
      invalidateGeom(); // 让派生缓存立即失效
    }
    // 统一复位交互状态:指针丢失(window blur / lostpointercapture / pointercancel)
    // 时若不复位,cursor 会一直卡在 grabbing,后续 pointermove 还会继续拖旧点(R2)。
    // 与 onUp 的收尾保持一致:被拖 def 交还描述式求值,曾被打断的播放恢复播放。
    function abortInteraction() {
      if (!pending && !dragging && !panning && !panState && !dragActive) return;
      var d = dragging;
      pending = null;
      dragging = null;
      dragActive = false;
      panState = null;
      panning = false;
      hoverDrag = false;
      try { if (canvasEl && canvasEl.style) canvasEl.style.cursor = ''; } catch (e) { /* 忽略 */ }
      if (d) {
        if (d.changed && d.changed._ovr) { d.changed._ovr = null; invalidateGeom(); }
        if (d.wasPlaying) play(); else drawScene();
      }
    }
    function onDown(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      // 上一轮交互若因失焦/丢捕获而没收到 pointerup,先复位陈旧状态,
      // 否则本次按下会继承上次的 dragging/panning(R2)
      if (dragging || panning || dragActive) abortInteraction();
      var p = canvasPos(ev);
      var hit = hitDot(p.x, p.y, true);
      pending = null;
      if (hit) {
        pending = {
          obj: hit,
          x0: p.x, y0: p.y,
          def: defUnderDot(hit)
        };
        try { ev.preventDefault(); } catch (e) { /* 忽略 */ }
      } else if (viewPan) {
        // 空白处按下:记录平移起点(相机以像素平移)
        panState = { x0: p.x, y0: p.y, ox: cam.ox, oy: cam.oy };
        try { ev.preventDefault(); } catch (e) { /* 忽略 */ }
      }
      if (canvasEl.setPointerCapture) {
        try { canvasEl.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
      }
    }
    function onMove(ev) {
      if (dragging) {
        var q = canvasPos(ev);
        var wx = s2wx(q.x), wy = s2wy(q.y);
        // 直线约束点(onLine 定义,如将军饮马中的 P):只允许沿其所在直线滑动
        if (dragging.def && dragging.def.op === 'onLine' && isNum(wx) && isNum(wy)) {
          try {
            var ld = lineRef(dragging.def.line, []);
            if (ld && ld.ok) {
              var projT = ((wx - ld.ax) * ld.dx + (wy - ld.ay) * ld.dy) /
                Math.max(lineLen2(ld), 1e-18);
              wx = ld.ax + projT * ld.dx;
              wy = ld.ay + projT * ld.dy;
            }
          } catch (e) { /* 约束失败则按自由落点 */ }
        }
        if (isNum(wx) && isNum(wy)) {
          setDragPos(dragging.obj, dragging.def, wx, wy);
          drawScene(); // 拖动中每帧重算派生几何
        }
        try { ev.preventDefault(); } catch (e) { /* 忽略 */ }
        return;
      }
      var p = canvasPos(ev);
      if (pending) {
        var ddx = p.x - pending.x0, ddy = p.y - pending.y0;
        if (ddx * ddx + ddy * ddy > 16) { // 超过 4px 视为开始拖动
          dragging = {
            obj: pending.obj, def: pending.def,
            startX: pending.x0, startY: pending.y0,
            wasPlaying: playing,
            changed: (pending.def ? pending.def : pending.obj)
          };
          if (playing) pause(); // 拖动期间暂停动画
          dragActive = true;
          pending = null;
          panState = null;
          try { canvasEl.style.cursor = 'grabbing'; } catch (e) { /* 忽略 */ }
          try { ev.preventDefault(); } catch (e) { /* 忽略 */ }
          return;
        }
      }
      // 空白拖拽平移
      if (!pending && panState && !dragging) {
        var pdx = p.x - panState.x0, pdy = p.y - panState.y0;
        if (pdx * pdx + pdy * pdy > 16) panning = true;
      }
      if (panning) {
        var nx2 = p.x - panState.x0, ny2 = p.y - panState.y0;
        cam.ox = panState.ox + nx2;
        cam.oy = panState.oy + ny2;
        try { canvasEl.style.cursor = 'grabbing'; } catch (e) { /* 忽略 */ }
        try { ev.preventDefault(); } catch (e) { /* 忽略 */ }
        redraw();
        return;
      }
      // 悬停反馈:可拖自由点显示抓手;空白处提示可平移
      var free = !dragActive && !panning && hitDot(p.x, p.y, true);
      if (!!free !== hoverDrag) {
        hoverDrag = !!free;
        try { canvasEl.style.cursor = free ? 'grab' : (viewPan ? 'grab' : ''); } catch (e) { /* 忽略 */ }
      }
    }
    function onUp(ev) {
      var p = canvasPos(ev);
      if (dragging) {
        var d = dragging;
        var was = d.wasPlaying;
        dragging = null;
        dragActive = false;
        pending = null;
        try { canvasEl.style.cursor = ''; } catch (e) { /* 忽略 */ }
        if (was) {
          // 拖动曾打断播放:释放后恢复播放,被拖 def 交还描述式求值
          if (d.changed && d.changed._ovr) { d.changed._ovr = null; invalidateGeom(); }
          play();
        } else {
          drawScene(); // 静置态:自由点落位保留,派生几何重绘跟随
        }
        return;
      }
      if (panning) {
        panning = false;
        panState = null;
        try { canvasEl.style.cursor = viewPan ? 'grab' : ''; } catch (e) { /* 忽略 */ }
        return;
      }
      panState = null;
      pending = null;
      // 点击(未拖动):命中任意 dot 且注册了 onPick 则回调
      var hit = hitDot(p.x, p.y, false);
      if (hit && api.onPick) {
        try {
          objCompute(hit, []);
          api.onPick(hit, { x: hit._x, y: hit._y }, ev);
        } catch (e) { /* 忽略 */ }
      }
    }
    function bindEvents() {
      try { canvasEl.style.touchAction = 'none'; } catch (e) { /* 忽略 */ }
      if (!canvasEl.addEventListener) return;
      canvasEl.addEventListener('pointerdown', onDown);
      canvasEl.addEventListener('pointermove', onMove);
      canvasEl.addEventListener('pointerup', onUp);
      // pointercancel 是"这一轮指针作废",按中断处理(不再当成点击触发 onPick)
      canvasEl.addEventListener('pointercancel', abortInteraction);
      // 指针捕获丢失同样要复位(例如系统手势/拖出窗口)
      canvasEl.addEventListener('lostpointercapture', abortInteraction);
      canvasEl.addEventListener('wheel', onWheel, { passive: false });
      // 窗口失焦时不会再有 pointerup,必须兜底复位
      try {
        if (typeof global.addEventListener === 'function') {
          global.addEventListener('blur', abortInteraction);
        }
      } catch (e) { /* 忽略 */ }
    }
    function onWheel(ev) {
      if (!viewPan) return;
      try {
        var p = canvasPos(ev);
        var f = Math.exp(-(ev.deltaY || 0) * 0.0012);
        zoomAt(f, p.x, p.y);
        try { ev.preventDefault(); } catch (e2) { /* 忽略 */ }
      } catch (e) { /* 忽略 */ }
    }

    /* ---------- 3.16 对外 API ---------- */
    var api = {
      update: update,
      clear: clear,
      play: play,
      pause: pause,
      step: step,
      reset: reset,
      setPlaying: setPlaying,
      getState: function () {
        return {
          playing: playing,
          u: u,
          objects: objList.length,   // 图元数
          labels: overlayList.length // tex 标注数
        };
      },
      fit: fit,
      redraw: redraw,
      zoomAt: zoomAt,                        // 以屏幕点为中心缩放
      panByPx: panByPx,                      // 像素平移
      setViewPan: function (v) { viewPan = !!v; },  // 开关"空白拖拽平移 + 滚轮缩放"
      isDragging: function () { return !!(pending || dragging || panning); },
      onPick: null,                  // function(objEntry, worldPt, ev) 点选回调
      setLabels: function (el) {
        labelsEl = el || null;
        labelsAuto = false;
        if (el) {
          labelsBox = el;
          try {
            if (!labelsBox.style) labelsBox.style = {};
            labelsBox.style.position = 'absolute';
            labelsBox.style.left = '0px';
            labelsBox.style.top = '0px';
            labelsBox.style.pointerEvents = 'none';
          } catch (e) { /* 忽略 */ }
          var i;
          for (i = 0; i < overlayList.length; i++) {
            try {
              if (overlayList[i].span.parentNode) {
                overlayList[i].span.parentNode.removeChild(overlayList[i].span);
              }
            } catch (e2) { /* 忽略 */ }
            if (labelsBox.appendChild) labelsBox.appendChild(overlayList[i].span);
          }
        }
      }
    };
    // 开关属性直连内部状态(契约:autoFitOnUpdate 默认 true)
    Object.defineProperty(api, 'autoFitOnUpdate', {
      get: function () { return autoFitOnUpdate; },
      set: function (v) { autoFitOnUpdate = !!v; }
    });
    Object.defineProperty(api, 'showGrid', {
      get: function () { return gridOn; },
      // 开关切换后必须重绘:只在打开时重绘的话,关闭后网格会残留在画布上(D10)
      set: function (v) { gridOn = !!v; redraw(); }
    });

    /* 调试口:__gl = {u, playing, objects, redraw}(window.__gl 指向最近引擎) */
    var dbg = {};
    Object.defineProperty(dbg, 'u', { enumerable: true, get: function () { return u; } });
    Object.defineProperty(dbg, 'playing', { enumerable: true, get: function () { return playing; } });
    Object.defineProperty(dbg, 'objects', {
      enumerable: true,
      get: function () { return objList; } // 实时条目(含 _x/_y 等当前值,便于调试)
    });
    Object.defineProperty(dbg, 'redraw', { enumerable: true, get: function () { return redraw; } });
    Object.defineProperty(dbg, 'defs', {
      enumerable: true,
      get: function () { return defList; }
    });
    api.__gl = dbg;
    try { global.__gl = dbg; } catch (e) { /* 忽略 */ }

    /* ---------- 3.17 初始化 ---------- */
    syncSize();
    bindEvents();
    watchSize();
    // 初始:无内容也先出一帧(极简坐标轴可见)
    if (cssW && cssH) drawScene();
    // 复用保护:同一画布元素二次创建时直接返回本实例
    try { canvasEl.__glEngine = api; } catch (e) { /* 忽略 */ }
    return api;
  }

  /* ============================================================
   * 4. 对外暴露(契约:文件末尾暴露 window.GL)
   * demo.js 的用法是工厂式:var engine = window.GL(canvasEl, labelsEl);
   * ============================================================ */
  global.createGuanlanCanvas = createGuanlanCanvas;
  global.GL = createGuanlanCanvas;

})(typeof window !== 'undefined' ? window : this);
