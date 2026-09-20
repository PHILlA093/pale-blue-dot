/* ============================================================
 * gltemplates.js — 观澜演示模板清单与场景构建(穷观 V2.4.2)
 * 结构:
 *   window.QG_TEMPLATES = {
 *     manifest: [{id, name, desc, params:[{k,label,def}]}],   // 供 AI 与 UI 使用
 *     build: { [id]: function (params) -> descriptor }        // 返回 glcanvas 场景描述
 *   }
 * 场景描述 schema 见 glcanvas.js(纯声明式:defs 求值 + objects 绘制 + anim)。
 * 表达式可用:变量 u(0..1 动画相位)/x(曲线自变量)/PI/E,函数
 *   sin cos tan asin acos atan atan2、sqrt cbrt abs pow hypot、min max、
 *   exp ln log(底10) log2、floor ceil round sign。
 * 说明:模板参数在 build 时即被烘焙成数字/表达式字符串,因此表达式里
 *   只能出现 u/x/PI/E —— 需要"随参数联动"的量一律在 build 阶段算好。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 通用小工具 ---------------- */
  function num(s, def) {
    var n = parseFloat(s);
    return isFinite(n) ? n : def;
  }
  function pt2(s, defX, defY) {
    if (Object.prototype.toString.call(s) === '[object Array]') {
      return { x: num(s[0], defX), y: num(s[1], defY) };
    }
    var p = String(s == null ? '' : s).split(',');
    return { x: num(p[0], defX), y: num(p[1], defY) };
  }
  // 把数字转成"普通十进制"字面量:JS 的 String(n) 在 |n| >= 1e21 或 < 1e-6 时
  // 会输出科学计数法(1e+21 / 1e-7),而 glcanvas 的词法只认数字与小数点,
  // 'e' 会被当成标识符 → 变量非法 → 整条曲线/动点静默消失。这里把指数写法
  // 按位展开成等价的十进制写法(parseFloat 可原样还原,精度不丢)。
  function plainNum(n) {
    var s = String(n);
    var m = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
    if (!m) return s; // 已是普通写法(或 -0/Infinity 之类,由 fmt 兜底)
    var sign = m[1], ip = m[2], fp = m[3] || '', exp = parseInt(m[4], 10);
    var digits = ip + fp;
    var pointPos = ip.length + exp; // 小数点在 digits 中的位置
    var out;
    if (pointPos <= 0) {
      out = '0.' + new Array(-pointPos + 1).join('0') + digits;
    } else if (pointPos >= digits.length) {
      out = digits + new Array(pointPos - digits.length + 1).join('0');
    } else {
      out = digits.slice(0, pointPos) + '.' + digits.slice(pointPos);
    }
    return sign + out;
  }
  // 数字 → 表达式字面量。硬性约定:输出必须是本文件解析器一定能接受的字面量
  // ——绝不含 e/E 科学计数法,也绝不把非零数舍成 0(否则 AI/模板生成的表达式
  // 要么整条非法、要么数学含义被改掉:func-quadratic({a:1e21}) 曾给出
  // '1e+21*pow(...)' 整条曲线消失,prob-normal({sigma:1e-4}) 曾把 2σ² 舍成 0)。
  function fmt(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '0'; // 非有限值 → 安全默认
    if (n === 0) return '0';
    var av = Math.abs(n);
    var r = n;
    // |v| >= 5e-7 时沿用"6 位小数取整"(与既有实现逐位一致,保持文案可读性);
    // 更小的量级旧实现会被舍成 0(prob-normal({sigma:1e-4}) 的 2σ²=2e-8 → 0),
    // 这时保留原值,由 plainNum 输出等价十进制写法,绝不把非零数变成 0
    if (av >= 5e-7 && av < 1e15) {
      r = Math.round(n * 1e6) / 1e6;
      if (r === 0) r = n; // 兜底(阈值保证不会走到,防御性保留)
    }
    return plainNum(r);
  }
  // 参数校验:夹取到 [lo,hi];非数字/非有限时用默认值 def。
  // 模板参数直接来自 AI/用户,越界值会把 NaN / Infinity 带进表达式与 legend 文案。
  function clampNum(v, lo, hi, def) {
    var n = num(v, def);
    if (!isFinite(n)) return def;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }
  // 必须为正的参数(长度/半径/公比/标准差等):非有限或 <= 0 时回退默认值
  function posNum(v, def) {
    var n = num(v, def);
    return (n > 0) ? n : def;
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function def_(id, op, extra) {
    var o = { id: id, op: op }, k;
    if (extra) for (k in extra) if (has(extra, k)) o[k] = extra[k];
    return o;
  }
  function obj_(id, type, extra) {
    var o = { id: id, type: type }, k;
    if (extra) for (k in extra) if (has(extra, k)) o[k] = extra[k];
    return o;
  }
  function gdot(id, pt, color, label, extra) {
    var e = { pt: pt, color: color };
    if (label) e.label = label;
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'dot', e);
  }
  function gseg(id, a, b, color, extra) {
    var e = { a: a, b: b, color: color };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'segment', e);
  }
  function garrow(id, a, b, color, extra) {
    var e = { a: a, b: b, color: color };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'arrow', e);
  }
  function glinePts(id, p1, p2, color, extra) {
    var e = { a: { x: p1.x, y: p1.y }, b: { x: p2.x, y: p2.y }, color: color };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'line', e);
  }
  function gcurve(id, fn, x0, x1, color, extra) {
    var e = { fn: fn, x0: x0, x1: x1, color: color };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'curve', e);
  }
  function gtext(id, at, txt, off, extra) {
    var e = { at: at, text: txt, offset: off || { x: 0, y: -16 } };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'text', e);
  }
  function gpoly(id, pts, color, extra) {
    var e = { pts: pts, color: color };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'polygon', e);
  }
  function gpolyline(id, pts, color, extra) {
    var e = { pts: pts, color: color };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'polyline', e);
  }
  function gcircle(id, c, r, color, extra) {
    var e = { c: c, r: r, color: color };
    if (extra) for (var k in extra) if (has(extra, k)) e[k] = extra[k];
    return obj_(id, 'circle', e);
  }
  function lit(x, y) { return { x: x, y: y }; }
  function mid2(A, B) { return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }; }
  function len(A, B) { return Math.hypot(A.x - B.x, A.y - B.y); }
  function circumcenter(A, B, C) {
    var d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    if (Math.abs(d) < 1e-9) return null;
    var ux = ((A.x * A.x + A.y * A.y) * (B.y - C.y) +
      (B.x * B.x + B.y * B.y) * (C.y - A.y) +
      (C.x * C.x + C.y * C.y) * (A.y - B.y)) / d;
    var uy = ((A.x * A.x + A.y * A.y) * (C.x - B.x) +
      (B.x * B.x + B.y * B.y) * (A.x - C.x) +
      (C.x * C.x + C.y * C.y) * (B.x - A.x)) / d;
    return { x: ux, y: uy };
  }
  // 椭圆采样(供 polyline/polygon 用)
  function ellipsePts(cx, cy, rx, ry, n, a0, a1) {
    var out = [], N = n || 64, i, t;
    var s = (a0 === undefined) ? 0 : a0, e = (a1 === undefined) ? Math.PI * 2 : a1;
    for (i = 0; i <= N; i++) {
      t = s + (e - s) * i / N;
      out.push(lit(cx + rx * Math.cos(t), cy + ry * Math.sin(t)));
    }
    return out;
  }
  // 组合数
  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1, i;
    for (i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }
  // 数值积分(Simpson)
  function integrate(fn, a, b, n) {
    var N = n || 200;
    if (b === a) return 0;
    var h = (b - a) / N, s = fn(a) + fn(b), i;
    for (i = 1; i < N; i++) s += fn(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  }

  var templates = {
    /* ============================================================
     * 模板清单(manifest):AI 调度与参数填写都以此为准
     * ============================================================ */
    manifest: [
      {
        id: 'general-postman',
        name: '将军饮马(河岸最短路径)',
        desc: '两点 A、B 在河岸(水平直线 y=k)同侧,动点 P 在河岸上移动,' +
          '演示 PA+PB 的折线变化,并显示反射点与最优点 Q(PA+PB 最小处)。',
        params: [
          { k: 'A', label: '点 A 坐标 x,y', def: '-4,2' },
          { k: 'B', label: '点 B 坐标 x,y', def: '4,3' },
          { k: 'k', label: '河岸直线 y = k', def: '0' }
        ]
      },
      {
        id: 'func-quadratic',
        name: '二次函数(顶点式与对称性)',
        desc: '画 y = a(x−h)² + k,标出顶点、对称轴、与 x 轴交点(存在时才画);' +
          '动点 P 沿抛物线滑动,并显示 P 关于对称轴的对称点 P′。',
        params: [
          { k: 'a', label: '二次项系数 a', def: '1' },
          { k: 'h', label: '顶点横坐标 h', def: '0' },
          { k: 'k', label: '顶点纵坐标 k', def: '-2' }
        ]
      },
      {
        id: 'func-derivative-tangent',
        name: '导数与切线(动点切线)',
        desc: '曲线 y = x³ − 3x 上动点 P 滑动,切线随之转动,显示切线斜率' +
          ' k = f′(x₀) = 3x₀² − 3 随 x₀ 的变化,并标出极大值点与极小值点。',
        params: [
          { k: 'xs', label: '动点起点 x', def: '-1.6' },
          { k: 'xe', label: '动点终点 x', def: '1.6' }
        ]
      },
      {
        id: 'func-exp-log',
        name: '指数函数与对数函数(互为反函数)',
        desc: 'y = aˣ 与 y = log_a x 两条曲线关于直线 y = x 对称;动点 P 在指数曲线上,' +
          '对称点 Q 落在对数曲线上,连线 PQ 的中点在 y = x 上。',
        params: [{ k: 'base', label: '底数 a(>0 且 ≠1)', def: '2' }]
      },
      {
        id: 'func-trig',
        name: '三角函数图象(振幅/周期/相位)',
        desc: 'y = A sin(ωx + φ) + k 的图象,标出振幅 A、周期 T = 2π/ω 与中线;' +
          '动点 P 沿曲线滑动。',
        params: [
          { k: 'A', label: '振幅 A', def: '1' },
          { k: 'w', label: '角频率 ω', def: '1' },
          { k: 'phi', label: '初相 φ', def: '0' },
          { k: 'k', label: '中线 k', def: '0' }
        ]
      },
      {
        id: 'vec-add',
        name: '向量加减(平行四边形/三角形法则)',
        desc: '向量 a、b 及其和 a+b(平行四边形法则)与差 a−b;' +
          '各向量完全由参数 a、b 决定(端点不可交互移动)。',
        params: [
          { k: 'a', label: '向量 a 坐标 x,y', def: '-3,2' },
          { k: 'b', label: '向量 b 坐标 x,y', def: '3,1' }
        ]
      },
      {
        id: 'vec-dot-projection',
        name: '数量积与投影',
        desc: '向量 b 绕原点转动,显示 a·b = |a||b|cosθ、b 在 a 方向上的投影点 H,' +
          '以及投影长度随夹角的变化。',
        params: [
          { k: 'a', label: '向量 a 坐标 x,y', def: '4,0' },
          { k: 'r', label: '向量 b 的长度', def: '3' },
          { k: 'from', label: '起始夹角(度)', def: '30' },
          { k: 'to', label: '终止夹角(度)', def: '150' }
        ]
      },
      {
        id: 'vec-basis',
        name: '向量的基底分解',
        desc: '把向量 v 分解到基底 e₁、e₂:v = λe₁ + μe₂,画出平行四边形分解过程' +
          '并给出 λ、μ 的坐标解。',
        params: [
          { k: 'e1', label: '基底 e₁ 坐标 x,y', def: '2,1' },
          { k: 'e2', label: '基底 e₂ 坐标 x,y', def: '-1,2' },
          { k: 'v', label: '向量 v 坐标 x,y', def: '3,3' }
        ]
      },
      {
        id: 'conic-ellipse',
        name: '椭圆的定义(距离之和恒定)',
        desc: '椭圆上动点 P 到两焦点 F₁、F₂ 的距离之和恒为 2a;显示 PF₁、PF₂ 两段' +
          '与 c = √(a²−b²)。',
        params: [
          { k: 'a', label: '长半轴 a', def: '5' },
          { k: 'b', label: '短半轴 b', def: '3' }
        ]
      },
      {
        id: 'conic-parabola',
        name: '抛物线的定义(焦点与准线)',
        desc: '抛物线 y² = 2px 上动点 P 到焦点 F 的距离等于它到准线的距离(PH);' +
          '显示两条相等的距离线段。',
        params: [{ k: 'p', label: '焦准距参数 p(须 > 0)', def: '2' }]
      },
      {
        id: 'conic-line-circle',
        name: '直线与圆的位置关系',
        desc: '直线 l:y = k 上下平移,比较圆心到直线的距离 d 与半径 r:相交(两交点)、' +
          '相切、相离三种情形随动画切换。',
        params: [
          { k: 'r', label: '圆半径 r', def: '3' },
          { k: 'k', label: '直线起点纵坐标', def: '-2' },
          { k: 'dk', label: '平移范围(终点−起点)', def: '6' }
        ]
      },
      {
        id: 'geo-tri-centers',
        name: '三角形的四心(重心/外心/垂心/内心)',
        desc: '给定三角形,画三条中线(分别连到三边中点)与重心 G、外接圆与圆心 O、' +
          '垂心 H、内切圆与内心 I。',
        params: [
          { k: 'A', label: '顶点 A 坐标 x,y', def: '0,4' },
          { k: 'B', label: '顶点 B 坐标 x,y', def: '-4,-2' },
          { k: 'C', label: '顶点 C 坐标 x,y', def: '5,-2' }
        ]
      },
      {
        id: 'geo-sine-law',
        name: '正弦定理与外接圆',
        desc: '三角形顶点 A 沿外接圆滑动,三边与三角随之变化,但 a/sinA = b/sinB' +
          ' = c/sinC = 2R 保持不变。',
        params: [
          { k: 'A', label: '顶点 A 坐标 x,y', def: '0,4' },
          { k: 'B', label: '顶点 B 坐标 x,y', def: '-4,-2' },
          { k: 'C', label: '顶点 C 坐标 x,y', def: '5,-2' },
          { k: 'sweep', label: 'A 滑动角度(度)', def: '30' }
        ]
      },
      {
        id: 'geo-circle-tangent',
        name: '圆外一点的切线(切线长相等)',
        desc: '圆外一点 P 沿射线移动,两条切线的切点 T₁、T₂ 随之移动,切线长' +
          'PT₁ = PT₂ = √(d²−r²) 始终相等。',
        params: [
          { k: 'r', label: '圆半径 r', def: '3' },
          { k: 'P', label: '圆外一点 P 坐标 x,y', def: '7,1' }
        ]
      },
      {
        id: 'solid-cuboid-sphere',
        name: '长方体与体对角线/外接球',
        desc: '斜二测示意长方体,画出体对角线与外接球:2R = √(a²+b²+c²)。',
        params: [
          { k: 'a', label: '长 a', def: '4' },
          { k: 'b', label: '宽 b', def: '3' },
          { k: 'c', label: '高 c', def: '2.5' }
        ]
      },
      {
        id: 'solid-line-plane-angle',
        name: '直线与平面所成的角(正方体)',
        desc: '正方体中体对角线 AC₁ 与底面 ABCD 所成的角:作出投影 AC,标出角' +
          '∠C₁AC ≈ 35.26°。',
        params: [{ k: 'L', label: '正方体棱长', def: '3' }]
      },
      {
        id: 'seq-arith-geo',
        name: '等差数列与等比数列',
        desc: '同一坐标系里画出等差数列(线性增长)与等比数列(指数增长)的点列与通项,' +
          '对比两种增长方式。',
        params: [
          { k: 'a1', label: '首项 a₁', def: '2' },
          { k: 'd', label: '公差 d', def: '1.5' },
          { k: 'q', label: '公比 q', def: '1.4' },
          { k: 'n', label: '项数 n', def: '8' }
        ]
      },
      {
        id: 'prob-binomial',
        name: '二项分布(分布列条形图)',
        desc: 'X ~ B(n, p) 的分布列:P(X=k) = C(n,k)pᵏ(1−p)ⁿ⁻ᵏ 画成条形图与折线,' +
          '并给出 E(X)、D(X)。',
        params: [
          { k: 'n', label: '试验次数 n', def: '6' },
          { k: 'p', label: '单次成功概率 p', def: '0.5' }
        ]
      },
      {
        id: 'prob-normal',
        name: '正态分布曲线与区间面积',
        desc: '正态分布 N(μ, σ²) 的密度曲线,阴影标出 P(a < X < b) 对应的面积并给出' +
          '数值积分结果;区间端点超过 μ±4σ 时阴影按该窗口截取(窗口外概率 ≈ 0/1,数值等价)。',
        params: [
          { k: 'mu', label: '均值 μ', def: '0' },
          { k: 'sigma', label: '标准差 σ', def: '1' },
          { k: 'a', label: '区间左端 a', def: '-1' },
          { k: 'b', label: '区间右端 b', def: '1' }
        ]
      },
      {
        id: 'conic-hyperbola',
        name: '双曲线的定义(差为定值)',
        desc: '双曲线 x²/a² − y²/b² = 1 上动点 P:||PF₁| − |PF₂|| = 2a 恒定;' +
          '同时画出两条渐近线。',
        params: [
          { k: 'a', label: '实半轴 a', def: '3' },
          { k: 'b', label: '虚半轴 b', def: '2' }
        ]
      },
      {
        id: 'conic-ellipse-eccentricity',
        name: '椭圆的离心率与准线',
        desc: '椭圆的两条准线 x = ±a²/c、离心率 e = c/a,以及右焦半径公式 |PF₂| = a − e·x_P。',
        params: [
          { k: 'a', label: '长半轴 a', def: '5' },
          { k: 'c', label: '半焦距 c', def: '3' }
        ]
      },
      {
        id: 'conic-circle-chord',
        name: '圆的弦与垂径定理',
        desc: '直线平移时圆心到直线的距离 d 变化,弦长 |AB| = 2√(r² − d²) 随之变化,' +
          '半径、弦心距构成直角三角形。',
        params: [
          { k: 'r', label: '圆半径 r', def: '3' },
          { k: 'k', label: '直线起点纵坐标', def: '-2' },
          { k: 'dk', label: '平移范围(终点−起点)', def: '3.6' }
        ]
      },
      {
        id: 'func-monotonic-extrema',
        name: '导数与单调性(增减区间与极值)',
        desc: '同时画 f(x) = x³ − 3x 与 f′(x) = 3x² − 3:绿色带 f′>0 为递增区间、' +
          '红色带 f′<0 为递减区间,极值点在 x = ±1。',
        params: [
          { k: 'xs', label: '动点起点 x', def: '-2.2' },
          { k: 'xe', label: '动点终点 x', def: '2.2' }
        ]
      },
      {
        id: 'func-sin-transform',
        name: '三角函数的图象变换',
        desc: '由 y = sin x 到 y = A sin(ωx + φ) 的平移与伸缩:标出平移量 |φ/ω|、' +
          '横向伸缩 1/ω、纵向伸缩 A 与周期 T。',
        params: [
          { k: 'A', label: '振幅 A', def: '1' },
          { k: 'w', label: '角频率 ω', def: '2' },
          { k: 'phi', label: '初相 φ', def: '1' }
        ]
      },
      {
        id: 'func-integral-area',
        name: '定积分的几何意义(曲边梯形)',
        desc: '把曲边梯形用 n 个小矩形近似,再取极限得到 ∫ₐᵇ f(x)dx;可选几种常见被积函数。',
        params: [
          { k: 'kind', label: '被积函数(x2/x3/sqrt/sin/inv)', def: 'x2' },
          { k: 'a', label: '积分下限 a', def: '0' },
          { k: 'b', label: '积分上限 b', def: '2' }
        ]
      },
      {
        id: 'func-quadratic-inequality',
        name: '一元二次不等式与解集',
        desc: '抛物线 y = ax² + bx + c 与 x 轴的位置关系,在数轴上用金色粗线段标出 ' +
          'ax² + bx + c > 0 的解集。',
        params: [
          { k: 'a', label: '二次项系数 a', def: '1' },
          { k: 'b', label: '一次项系数 b', def: '-2' },
          { k: 'c', label: '常数项 c', def: '-3' }
        ]
      },
      {
        id: 'solid-three-view',
        name: '三视图(长对正/高平齐/宽相等)',
        desc: '左边斜二测直观图,右边正视图、侧视图、俯视图,并用虚线演示「长对正、' +
          '高平齐、宽相等」的对应关系。',
        params: [
          { k: 'a', label: '长 a', def: '4' },
          { k: 'b', label: '宽 b', def: '3' },
          { k: 'h', label: '高 h', def: '2' }
        ]
      },
      {
        id: 'solid-tetrahedron-sphere',
        name: '正四面体的内切球与外接球',
        desc: '棱长 a 的正四面体:外接球 R = √6a/4、内切球 r = √6a/12,两球同心且 R = 3r。',
        params: [{ k: 'L', label: '棱长 a', def: '3' }]
      },
      {
        id: 'prob-geometric-area',
        name: '几何概型(面积比)',
        desc: '在正方形区域内等可能取点,用面积比求 P(x + y < t):阴影区域与总面积之比。',
        params: [
          { k: 's', label: '正方形边长', def: '2' },
          { k: 't', label: '阈值 t(事件 x+y<t)', def: '1' }
        ]
      },
      {
        id: 'stat-regression-line',
        name: '散点图与回归直线',
        desc: '根据成对数据求最小二乘回归方程 ŷ = b̂x + â 与样本相关系数 r,并画出回归直线。',
        params: [
          { k: 'xs', label: 'x 数据(逗号分隔)', def: '1,2,3,4,5' },
          { k: 'ys', label: 'y 数据(逗号分隔)', def: '2.1,3.9,6.2,7.8,10.1' }
        ]
      },
      {
        id: 'seq-recursion-fib',
        name: '递推数列(斐波那契与黄金比)',
        desc: '由 a₁ = a₂ = 1、aₙ = aₙ₋₁ + aₙ₋₂ 递推得到的点列,相邻项之比趋近黄金比 φ ≈ 1.618。',
        params: [{ k: 'n', label: '项数 n(4~16)', def: '10' }]
      }
    ],

    /* ============================================================
     * 场景构建:每个模板返回 glcanvas 场景描述
     * ============================================================ */
    build: {
      /* ---------- 平面几何 · 将军饮马(原有模板) ---------- */
      'general-postman': function (params) {
        params = params || {};
        var A = pt2(params.A, -4, 2);
        var B = pt2(params.B, 4, 3);
        var k = num(params.k, 0);
        var wide = 12;
        return {
          anim: { mode: 'pingpong', dur: 5 },
          defs: [
            { id: 'river', op: 'line', a: { x: -wide, y: k }, b: { x: wide, y: k } },
            { id: 'A', op: 'fixed', x: A.x, y: A.y },
            { id: 'B', op: 'fixed', x: B.x, y: B.y },
            { id: 'A1', op: 'reflect', pt: 'A', line: 'river' },   // A 关于河岸的对称点
            { id: 'A1B', op: 'line', a: 'A1', b: 'B' },
            { id: 'P', op: 'onLine', line: 'river', t: '0.08+0.84*u' },
            { id: 'Q', op: 'lineIntersect', l1: 'A1B', l2: 'river' } // 最优点
          ],
          objects: [
            { id: 'riverObj', type: 'line', a: 'river', color: 'rgba(79,195,247,0.65)', width: 1.6, label: '河岸' },
            { id: 'ap', type: 'segment', a: 'A', b: 'P', color: '#8fa3c0', dash: true },
            { id: 'pb', type: 'segment', a: 'P', b: 'B', color: '#8fa3c0', dash: true },
            { id: 'aa1', type: 'segment', a: 'A', b: 'A1', color: 'rgba(255,138,128,0.55)', dash: true },
            { id: 'a1b', type: 'segment', a: 'A1', b: 'B', color: 'rgba(255,213,79,0.5)', dash: false },
            { id: 'aq', type: 'segment', a: 'A', b: 'Q', color: '#ffd54f', width: 2 },
            { id: 'qb', type: 'segment', a: 'Q', b: 'B', color: '#ffd54f', width: 2 },
            { id: 'dotA', type: 'dot', pt: 'A', color: '#ff8a80', r: 5, label: 'A', drag: 'free' },
            { id: 'dotB', type: 'dot', pt: 'B', color: '#ff8a80', r: 5, label: 'B', drag: 'free' },
            { id: 'dotA1', type: 'dot', pt: 'A1', color: 'rgba(255,138,128,0.7)', r: 4, label: 'A′' },
            { id: 'dotQ', type: 'dot', pt: 'Q', color: '#ffd54f', r: 5.5, label: 'Q' },
            { id: 'dotP', type: 'dot', pt: 'P', color: '#4fc3f7', r: 6, label: 'P', drag: 'free' },
            { id: 'legend', type: 'text', at: 'B', text: '将军饮马:可拖动 A / B 微调,点播放看 P 沿河岸滑动', offset: { x: -20, y: -30 } }
          ]
        };
      },

      /* ---------- 函数 1:二次函数(顶点式) ---------- */
      'func-quadratic': function (params) {
        params = params || {};
        var a = num(params.a, 1), h = num(params.h, 0), k = num(params.k, -2);
        var xE = '(' + fmt(h - 3) + '+6*u)';
        var yE = '(' + fmt(k) + '+' + fmt(a) + '*pow(' + xE + '-' + fmt(h) + ',2))';
        var objs = [
          gcurve('q-curve', fmt(a) + '*pow(x-' + fmt(h) + ',2)+' + fmt(k), h - 4.6, h + 4.6, '#4fc3f7', { width: 2 }),
          glinePts('q-axis', lit(h, -8), lit(h, 9), 'rgba(143,163,192,0.5)', { dash: true, label: '对称轴' }),
          gseg('q-foot', 'P', 'q-footDef', 'rgba(143,163,192,0.7)', { dash: true }),
          gseg('q-pp', 'P', 'Pr', 'rgba(255,138,128,0.5)', { dash: true }),
          gdot('q-dotV', 'V', '#ffd54f', '顶点'),
          gdot('q-dotP', 'P', '#ff8a80', 'P'),
          gdot('q-dotPr', 'Pr', 'rgba(255,138,128,0.75)', 'P′'),
          gtext('q-legend', 'V', 'y = ' + fmt(a) + '(x − ' + fmt(h) + ')² + ' + fmt(k) +
            '(顶点 (' + fmt(h) + ', ' + fmt(k) + '),对称轴 x = ' + fmt(h) + ')',
            { x: 0, y: -26 })
        ];
        var defs = [
          def_('V', 'fixed', { x: h, y: k }),
          def_('P', 'fixed', { x: xE, y: yE }),
          def_('q-footDef', 'fixed', { x: h, y: yE }),
          def_('q-axisDef', 'line', { a: { x: h, y: -8 }, b: { x: h, y: 9 } }),
          def_('Pr', 'reflect', { pt: 'P', line: 'q-axisDef' })
        ];
        // 与 x 轴交点(若存在)
        if (a !== 0 && -k / a >= 0) {
          var r = Math.sqrt(-k / a);
          defs.push(def_('R1', 'fixed', { x: h - r, y: 0 }));
          defs.push(def_('R2', 'fixed', { x: h + r, y: 0 }));
          objs.push(gdot('q-dotR1', 'R1', '#4fc3f7', 'x₁'));
          objs.push(gdot('q-dotR2', 'R2', '#4fc3f7', 'x₂'));
        }
        return { anim: { mode: 'pingpong', dur: 6 }, defs: defs, objects: objs };
      },

      /* ---------- 函数 2:导数与切线 ---------- */
      'func-derivative-tangent': function (params) {
        params = params || {};
        var xs = num(params.xs, -1.6), xe = num(params.xe, 1.6);
        var xE = '(' + fmt(xs) + '+' + fmt(xe - xs) + '*u)';
        var yE = '(pow(' + xE + ',3)-3*(' + xE + '))';
        var kE = '(3*pow(' + xE + ',2)-3)';
        return {
          anim: { mode: 'pingpong', dur: 6 },
          defs: [
            def_('P', 'fixed', { x: xE, y: yE }),
            def_('Fx', 'fixed', { x: xE, y: 0 }),
            def_('T1', 'fixed', { x: '(' + xE + '-2)', y: '(' + yE + ')+(' + kE + ')*(-2)' }),
            def_('T2', 'fixed', { x: '(' + xE + '+2)', y: '(' + yE + ')+(' + kE + ')*(2)' }),
            def_('d-Max', 'fixed', { x: -1, y: 2 }),
            def_('d-Min', 'fixed', { x: 1, y: -2 })
          ],
          objects: [
            gcurve('d-curve', 'pow(x,3)-3*x', -2.6, 2.6, '#4fc3f7', { width: 2 }),
            gseg('d-tangent', 'T1', 'T2', '#ffd54f', { width: 2 }),
            gseg('d-foot', 'P', 'Fx', 'rgba(143,163,192,0.7)', { dash: true }),
            gdot('d-dotP', 'P', '#ff8a80', 'P'),
            gdot('d-dotMax', 'd-Max', '#ffd54f', '极大值点', { r: 4 }),
            gdot('d-dotMin', 'd-Min', '#ffd54f', '极小值点', { r: 4 }),
            gtext('d-legend', 'd-Min', 'y = x³ − 3x:切线斜率 k = f′(x₀) = 3x₀² − 3,随动点 P 滑动而变化',
              { x: -40, y: 34 })
          ]
        };
      },

      /* ---------- 函数 3:指数与对数(互为反函数) ---------- */
      'func-exp-log': function (params) {
        params = params || {};
        var b = num(params.base, 2);
        if (b <= 0 || Math.abs(b - 1) < 1e-6) b = 2;
        var xE = '(-1.6+3.2*u)';
        var yE = '(pow(' + fmt(b) + ',' + xE + '))';
        return {
          anim: { mode: 'pingpong', dur: 6 },
          defs: [
            def_('P', 'fixed', { x: xE, y: yE }),
            def_('Q', 'fixed', { x: yE, y: xE }),
            def_('M', 'mid', { a: 'P', b: 'Q' })
          ],
          objects: [
            gcurve('el-exp', 'pow(' + fmt(b) + ',x)', -3, 3, '#4fc3f7', { width: 2 }),
            gcurve('el-log', 'ln(x)/ln(' + fmt(b) + ')', 0.06, 9, '#ffd54f', { width: 2 }),
            glinePts('el-yx', lit(-3, -3), lit(9, 9), 'rgba(143,163,192,0.55)', { dash: true, label: 'y = x' }),
            gseg('el-pq', 'P', 'Q', 'rgba(255,213,79,0.6)', { dash: true }),
            gdot('el-dotP', 'P', '#ff8a80', 'P'),
            gdot('el-dotQ', 'Q', '#ff8a80', 'Q'),
            gdot('el-dotM', 'M', '#4fc3f7', 'M'),
            gtext('el-legend', 'M', 'y = aˣ 与 y = log_a x 互为反函数(此处 a = ' + fmt(b) +
              '):图象关于 y = x 对称,P 与 Q 关于 y = x 对称', { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 函数 4:三角函数图象 ---------- */
      'func-trig': function (params) {
        params = params || {};
        var A = num(params.A, 1), w = num(params.w, 1), ph = num(params.phi, 0), k = num(params.k, 0);
        var xE = '(-6.283+12.566*u)';
        var fn = fmt(A) + '*sin(' + fmt(w) + '*x+' + fmt(ph) + ')+' + fmt(k);
        var yE = '(' + fmt(A) + '*sin(' + fmt(w) + '*(' + xE + ')+' + fmt(ph) + ')+' + fmt(k) + ')';
        var T = (Math.abs(w) > 1e-9) ? (2 * Math.PI / Math.abs(w)) : Infinity;
        return {
          anim: { mode: 'pingpong', dur: 8 },
          defs: [
            def_('P', 'fixed', { x: xE, y: yE }),
            def_('Fx', 'fixed', { x: xE, y: 0 }),
            def_('tri-mid', 'line', { a: { x: -7, y: k }, b: { x: 7, y: k } }),
            def_('tri-top', 'line', { a: { x: -7, y: k + A }, b: { x: 7, y: k + A } }),
            def_('tri-bot', 'line', { a: { x: -7, y: k - A }, b: { x: 7, y: k - A } })
          ],
          objects: [
            gcurve('tri-curve', fn, -7, 7, '#4fc3f7', { width: 2 }),
            obj_('tri-lineMid', 'line', { a: 'tri-mid', color: 'rgba(143,163,192,0.75)', dash: true, label: '中线 y = k' }),
            obj_('tri-lineTop', 'line', { a: 'tri-top', color: 'rgba(255,213,79,0.5)', dash: true, label: '最高点 y = k+A' }),
            obj_('tri-lineBot', 'line', { a: 'tri-bot', color: 'rgba(255,213,79,0.5)', dash: true, label: '最低点 y = k−A' }),
            gseg('tri-amp', 'P', 'Fx', 'rgba(143,163,192,0.6)', { dash: true }),
            gdot('tri-dotP', 'P', '#ff8a80', 'P'),
            gtext('tri-legend', 'Fx',
              'y = A sin(ωx + φ) + k:A = ' + fmt(A) + ',ω = ' + fmt(w) + ',φ = ' + fmt(ph) +
              ',k = ' + fmt(k) + (isFinite(T) ? ',周期 T = 2π/ω ≈ ' + fmt(Math.round(T * 1000) / 1000) : ''),
              { x: -60, y: 40 })
          ]
        };
      },

      /* ---------- 向量 1:加减法 ---------- */
      'vec-add': function (params) {
        params = params || {};
        var a = pt2(params.a, -3, 2), b = pt2(params.b, 3, 1);
        return {
          anim: { mode: 'once', dur: 4 },
          defs: [
            def_('O', 'fixed', { x: 0, y: 0 }),
            def_('PA', 'fixed', { x: a.x, y: a.y }),
            def_('PB', 'fixed', { x: b.x, y: b.y }),
            def_('PS', 'fixed', { x: a.x + b.x, y: a.y + b.y }),
            def_('PD', 'fixed', { x: a.x - b.x, y: a.y - b.y })
          ],
          objects: [
            garrow('va-a', 'O', 'PA', '#4fc3f7', { width: 2.2 }),
            garrow('va-b', 'O', 'PB', '#8fa3c0', { width: 2.2 }),
            garrow('va-sum', 'O', 'PS', '#ffd54f', { width: 2.4 }),
            gseg('va-h1', 'PA', 'PS', 'rgba(143,163,192,0.5)', { dash: true }),
            gseg('va-h2', 'PB', 'PS', 'rgba(143,163,192,0.5)', { dash: true }),
            garrow('va-diff', 'O', 'PD', '#ff8a80', { width: 2 }),
            gdot('va-dotA', 'PA', '#ff8a80', 'A'),
            gdot('va-dotB', 'PB', '#ff8a80', 'B'),
            gdot('va-dotS', 'PS', '#ffd54f', 'A+B'),
            gdot('va-dotD', 'PD', '#ff8a80', 'A−B'),
            gtext('va-legend', 'PD', 'a = (' + fmt(a.x) + ', ' + fmt(a.y) + '),b = (' + fmt(b.x) + ', ' + fmt(b.y) +
              '):a + b 用平行四边形法则,a − b 由三角形法则', { x: 0, y: 30 })
          ]
        };
      },

      /* ---------- 向量 2:数量积与投影 ---------- */
      'vec-dot-projection': function (params) {
        params = params || {};
        var A = pt2(params.a, 4, 0);
        var r = num(params.r, 3);
        var t0 = num(params.from, 30), t1 = num(params.to, 150);
        // a 不能是零向量:投影点 H = (a·b/|a|²)·a 会变成 0/0 = NaN,
        // 投影段与 H 点整条派生链消失。非法值回退默认基底 (4,0)
        var aa = A.x * A.x + A.y * A.y;
        if (!(aa > 1e-12)) { A = { x: 4, y: 0 }; aa = 16; }
        var th = '(' + fmt(t0) + '+' + fmt(t1 - t0) + '*u)*PI/180';
        var bx = '(' + fmt(r) + '*cos(' + th + '))';
        var by = '(' + fmt(r) + '*sin(' + th + '))';
        var dp = '(' + fmt(A.x) + '*' + bx + '+' + fmt(A.y) + '*' + by + ')';   // a·b
        var hx = '((' + dp + ')/' + fmt(aa) + '*' + fmt(A.x) + ')';
        var hy = '((' + dp + ')/' + fmt(aa) + '*' + fmt(A.y) + ')';
        return {
          anim: { mode: 'pingpong', dur: 7 },
          defs: [
            def_('O', 'fixed', { x: 0, y: 0 }),
            def_('PA', 'fixed', { x: A.x, y: A.y }),
            def_('PB', 'fixed', { x: bx, y: by }),
            def_('PH', 'fixed', { x: hx, y: hy })
          ],
          objects: [
            garrow('vp-a', 'O', 'PA', '#4fc3f7', { width: 2.2 }),
            garrow('vp-b', 'O', 'PB', '#ffd54f', { width: 2.2 }),
            gseg('vp-proj', 'O', 'PH', '#8fa3c0', { width: 4 }),
            gseg('vp-drop', 'PB', 'PH', 'rgba(255,138,128,0.7)', { dash: true }),
            gdot('vp-dotB', 'PB', '#ff8a80', 'B'),
            gdot('vp-dotH', 'PH', '#ff8a80', 'H(投影)'),
            gtext('vp-legend', 'PB', 'a·b = |a||b|cosθ;b 在 a 方向上的投影 = |b|cosθ' +
              '(动画中 b 绕 O 转动,投影点 H 随之移动)', { x: 0, y: -28 })
          ]
        };
      },

      /* ---------- 向量 3:基底分解 ---------- */
      'vec-basis': function (params) {
        params = params || {};
        var e1 = pt2(params.e1, 2, 1), e2 = pt2(params.e2, -1, 2), v = pt2(params.v, 3, 3);
        var det = e1.x * e2.y - e1.y * e2.x;
        if (Math.abs(det) < 1e-9) { e2 = { x: -1, y: 2 }; det = e1.x * e2.y - e1.y * e2.x; }
        var lam = (v.x * e2.y - v.y * e2.x) / det;
        var mu = (e1.x * v.y - e1.y * v.x) / det;
        var Q1 = { x: lam * e1.x, y: lam * e1.y };
        return {
          anim: { mode: 'once', dur: 4 },
          defs: [
            def_('O', 'fixed', { x: 0, y: 0 }),
            def_('E1', 'fixed', { x: e1.x, y: e1.y }),
            def_('E2', 'fixed', { x: e2.x, y: e2.y }),
            def_('V', 'fixed', { x: v.x, y: v.y }),
            def_('Q1', 'fixed', { x: Q1.x, y: Q1.y })
          ],
          objects: [
            garrow('vb-e1', 'O', 'E1', '#4fc3f7', { width: 2 }),
            garrow('vb-e2', 'O', 'E2', '#8fa3c0', { width: 2 }),
            garrow('vb-v', 'O', 'V', '#ffd54f', { width: 2.4 }),
            gseg('vb-q1', 'O', 'Q1', '#4fc3f7', { width: 3 }),
            gseg('vb-q2', 'Q1', 'V', '#8fa3c0', { width: 3 }),
            gseg('vb-h1', 'E1', 'Q1', 'rgba(143,163,192,0.35)', { dash: true }),
            gseg('vb-h2', 'E2', 'V', 'rgba(143,163,192,0.35)', { dash: true }),
            gdot('vb-dotE1', 'E1', '#4fc3f7', 'e₁'),
            gdot('vb-dotE2', 'E2', '#8fa3c0', 'e₂'),
            gdot('vb-dotV', 'V', '#ffd54f', 'v'),
            gdot('vb-dotQ1', 'Q1', '#4fc3f7', 'λe₁'),
            gtext('vb-legend', 'V', 'v = λe₁ + μe₂(λ = ' + fmt(Math.round(lam * 1000) / 1000) +
              ', μ = ' + fmt(Math.round(mu * 1000) / 1000) + '):先沿 e₁ 走 λ 倍,再沿 e₂ 走 μ 倍', { x: 0, y: -28 })
          ]
        };
      },

      /* ---------- 解析几何 1:椭圆定义 ---------- */
      'conic-ellipse': function (params) {
        params = params || {};
        var a = posNum(params.a, 5);              // 半轴必须为正(<=0 回退默认 5)
        var b = num(params.b, 3);
        if (b <= 0 || b > a) b = Math.max(1, a * 0.6);
        var c = Math.sqrt(Math.max(a * a - b * b, 0));
        return {
          anim: { mode: 'pingpong', dur: 9 },
          defs: [
            def_('F1', 'fixed', { x: -c, y: 0 }),
            def_('F2', 'fixed', { x: c, y: 0 }),
            def_('P', 'fixed', { x: '(' + fmt(a) + '*cos(2*PI*u))', y: '(' + fmt(b) + '*sin(2*PI*u))' })
          ],
          objects: [
            gpoly('ell-shape', ellipsePts(0, 0, a, b, 96), '#4fc3f7', { fill: 'rgba(79,195,247,0.07)', width: 2 }),
            gseg('ell-pf1', 'P', 'F1', '#ffd54f', { width: 2 }),
            gseg('ell-pf2', 'P', 'F2', '#ffd54f', { width: 2 }),
            glinePts('ell-axis', lit(-a - 1, 0), lit(a + 1, 0), 'rgba(143,163,192,0.35)', { dash: true }),
            gdot('ell-dotF1', 'F1', '#4fc3f7', 'F₁'),
            gdot('ell-dotF2', 'F2', '#4fc3f7', 'F₂'),
            gdot('ell-dotP', 'P', '#ff8a80', 'P'),
            gtext('ell-legend', 'F2', '椭圆定义:|PF₁| + |PF₂| = 2a = ' + fmt(2 * a) +
              '(a = ' + fmt(a) + ', b = ' + fmt(b) + ', c = √(a²−b²) ≈ ' + fmt(Math.round(c * 1000) / 1000) + ')',
              { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 解析几何 2:抛物线定义 ---------- */
      'conic-parabola': function (params) {
        params = params || {};
        // p 是焦准距(距离,恒正):p<=0 时 y²=2px 开口向左,本模板的曲线
        // sqrt(2px)、焦点 p/2、准线 -p/2 都不再自洽(曲线整条变 NaN 只剩焦点准线),
        // 故 p<=0 回退默认值(legend 里打印的是实际使用的 p)
        var p = posNum(params.p, 2);
        var tE = '(-4+8*u)';
        var xMax = 16 / (2 * Math.abs(p));
        return {
          anim: { mode: 'pingpong', dur: 7 },
          defs: [
            def_('F', 'fixed', { x: p / 2, y: 0 }),
            def_('P', 'fixed', { x: '(pow(' + tE + ',2)/' + fmt(2 * p) + ')', y: tE }),
            def_('H', 'fixed', { x: (-p / 2), y: tE })
          ],
          objects: [
            gcurve('par-up', 'sqrt(' + fmt(2 * p) + '*x)', 0, xMax, '#4fc3f7', { width: 2 }),
            gcurve('par-dn', '-sqrt(' + fmt(2 * p) + '*x)', 0, xMax, '#4fc3f7', { width: 2 }),
            glinePts('par-dir', lit(-p / 2, -5.5), lit(-p / 2, 5.5), 'rgba(143,163,192,0.7)', { dash: true, label: '准线' }),
            gseg('par-pf', 'P', 'F', '#ffd54f', { width: 2 }),
            gseg('par-ph', 'P', 'H', '#ff8a80', { width: 2 }),
            gdot('par-dotF', 'F', '#4fc3f7', 'F(焦点)'),
            gdot('par-dotP', 'P', '#ff8a80', 'P'),
            gdot('par-dotH', 'H', '#ffd54f', 'H'),
            gtext('par-legend', 'H', '抛物线定义:|PF| = |PH|:动点到焦点的距离恒等于它到准线的距离(p = ' + fmt(p) + ')',
              { x: -30, y: 34 })
          ]
        };
      },

      /* ---------- 解析几何 3:直线与圆 ---------- */
      'conic-line-circle': function (params) {
        params = params || {};
        var r = posNum(params.r, 3);              // 半径必须为正
        var k0 = num(params.k, -2), dk = num(params.dk, 6);
        var kE = '(' + fmt(k0) + '+' + fmt(dk) + '*u)';
        return {
          anim: { mode: 'pingpong', dur: 8 },
          defs: [
            def_('cl-C', 'fixed', { x: 0, y: 0 }),
            def_('cl-lineDef', 'line', { a: { x: -9, y: kE }, b: { x: 9, y: kE } }),
            def_('cl-H', 'fixed', { x: 0, y: kE }),
            def_('cl-I1', 'fixed', { x: 'sqrt(' + fmt(r * r) + '-pow(' + kE + ',2))', y: kE }),
            def_('cl-I2', 'fixed', { x: '-sqrt(' + fmt(r * r) + '-pow(' + kE + ',2))', y: kE })
          ],
          objects: [
            gcircle('cl-circle', 'cl-C', r, '#4fc3f7', { width: 2 }),
            obj_('cl-line', 'line', { a: 'cl-lineDef', color: '#ffd54f', width: 2, label: 'l: y = k' }),
            gseg('cl-dist', 'cl-C', 'cl-H', '#8fa3c0', { width: 3 }),
            gdot('cl-dotH', 'cl-H', '#8fa3c0', 'H(d)'),
            gdot('cl-dotI1', 'cl-I1', '#ff8a80', 'A'),
            gdot('cl-dotI2', 'cl-I2', '#ff8a80', 'B'),
            gtext('cl-legend', 'cl-C', '比较 d = |k| 与 r = ' + fmt(r) + ':d < r 相交(两点)、d = r 相切、d > r 相离;动画中直线上下平移',
              { x: 0, y: 34 })
          ]
        };
      },

      /* ---------- 平面几何 1:三角形的四心 ---------- */
      'geo-tri-centers': function (params) {
        params = params || {};
        var A = pt2(params.A, 0, 4), B = pt2(params.B, -4, -2), C = pt2(params.C, 5, -2);
        var G = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
        var O = circumcenter(A, B, C) || G;
        var R = len(O, A);
        var Hc = { x: A.x + B.x + C.x - 2 * O.x, y: A.y + B.y + C.y - 2 * O.y };
        var la = len(B, C), lb = len(C, A), lc = len(A, B), sum = la + lb + lc || 1;
        var I = {
          x: (la * A.x + lb * B.x + lc * C.x) / sum,
          y: (la * A.y + lb * B.y + lc * C.y) / sum
        };
        var area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
        var rIn2 = sum > 0 ? (2 * area / sum) : 0;
        var MAB = mid2(A, B), MBC = mid2(B, C), MCA = mid2(C, A);
        return {
          anim: { mode: 'once', dur: 4 },
          defs: [
            def_('tc-A', 'fixed', { x: A.x, y: A.y }),
            def_('tc-B', 'fixed', { x: B.x, y: B.y }),
            def_('tc-C', 'fixed', { x: C.x, y: C.y }),
            def_('tc-G', 'fixed', { x: G.x, y: G.y }),
            def_('tc-O', 'fixed', { x: O.x, y: O.y }),
            def_('tc-H', 'fixed', { x: Hc.x, y: Hc.y }),
            def_('tc-I', 'fixed', { x: I.x, y: I.y }),
            def_('tc-MAB', 'fixed', { x: MAB.x, y: MAB.y }),
            def_('tc-MBC', 'fixed', { x: MBC.x, y: MBC.y }),
            def_('tc-MCA', 'fixed', { x: MCA.x, y: MCA.y })
          ],
          objects: [
            gpoly('tc-tri', [{ x: A.x, y: A.y }, { x: B.x, y: B.y }, { x: C.x, y: C.y }], '#4fc3f7',
              { fill: 'rgba(79,195,247,0.06)', width: 2 }),
            gcircle('tc-circum', 'tc-O', Math.round(R * 1e6) / 1e6, 'rgba(79,195,247,0.55)', { dash: true }),
            gcircle('tc-in', 'tc-I', Math.round(rIn2 * 1e6) / 1e6, 'rgba(255,138,128,0.5)', { dash: true }),
            gseg('tc-m1', 'tc-A', 'tc-MBC', 'rgba(143,163,192,0.5)', { dash: true }),
            gseg('tc-m2', 'tc-B', 'tc-MCA', 'rgba(143,163,192,0.5)', { dash: true }),
            gseg('tc-m3', 'tc-C', 'tc-MAB', 'rgba(143,163,192,0.5)', { dash: true }),
            gdot('tc-dotA', 'tc-A', '#ff8a80', 'A'),
            gdot('tc-dotB', 'tc-B', '#ff8a80', 'B'),
            gdot('tc-dotC', 'tc-C', '#ff8a80', 'C'),
            gdot('tc-dotG', 'tc-G', '#ffd54f', 'G(重心)'),
            gdot('tc-dotO', 'tc-O', '#4fc3f7', 'O(外心)'),
            gdot('tc-dotH', 'tc-H', '#eaf2ff', 'H(垂心)'),
            gdot('tc-dotI', 'tc-I', '#ff8a80', 'I(内心)'),
            gdot('tc-dotM', 'tc-MBC', '#8fa3c0', ''),
            gtext('tc-legend', 'tc-H', '三条中线交于重心 G;外接圆圆心 O 到三顶点等距;' +
              '三条高交于垂心 H;内切圆圆心 I 到三边等距', { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 平面几何 2:正弦定理与外接圆 ---------- */
      'geo-sine-law': function (params) {
        params = params || {};
        var A = pt2(params.A, 0, 4), B = pt2(params.B, -4, -2), C = pt2(params.C, 5, -2);
        var sweep = num(params.sweep, 30) * Math.PI / 180;
        var O = circumcenter(A, B, C) || { x: 0, y: 0 };
        var R = len(O, A);
        var thA = Math.atan2(A.y - O.y, A.x - O.x);
        var thE = '(' + fmt(thA) + '+' + fmt(sweep) + '*u)';
        var axE = '(' + fmt(O.x) + '+' + fmt(R) + '*cos(' + thE + '))';
        var ayE = '(' + fmt(O.y) + '+' + fmt(R) + '*sin(' + thE + '))';
        var a = len(B, C), b = len(C, A), c = len(A, B);
        var sA = a / (2 * R || 1);
        return {
          anim: { mode: 'pingpong', dur: 8 },
          defs: [
            def_('sl-A', 'fixed', { x: axE, y: ayE }),
            def_('sl-B', 'fixed', { x: B.x, y: B.y }),
            def_('sl-C', 'fixed', { x: C.x, y: C.y }),
            def_('sl-O', 'fixed', { x: O.x, y: O.y })
          ],
          objects: [
            gcircle('sl-circum', 'sl-O', Math.round(R * 1e6) / 1e6, 'rgba(143,163,192,0.65)', { dash: true }),
            gpoly('sl-tri', ['sl-A', 'sl-B', 'sl-C'], '#4fc3f7', { fill: 'rgba(79,195,247,0.06)', width: 2 }),
            gseg('sl-r1', 'sl-O', 'sl-A', 'rgba(255,213,79,0.75)', { dash: true }),
            gseg('sl-r2', 'sl-O', 'sl-B', 'rgba(255,213,79,0.45)', { dash: true }),
            gseg('sl-r3', 'sl-O', 'sl-C', 'rgba(255,213,79,0.45)', { dash: true }),
            gdot('sl-dotA', 'sl-A', '#ff8a80', 'A'),
            gdot('sl-dotB', 'sl-B', '#ff8a80', 'B'),
            gdot('sl-dotC', 'sl-C', '#ff8a80', 'C'),
            gdot('sl-dotO', 'sl-O', '#ffd54f', 'O'),
            gtext('sl-legend', 'sl-O', 'a/sinA = b/sinB = c/sinC = 2R = ' + fmt(Math.round(2 * R * 1000) / 1000) +
              '(顶点 A 沿外接圆滑动,比值保持不变)', { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 平面几何 3:圆外一点的切线 ---------- */
      'geo-circle-tangent': function (params) {
        params = params || {};
        var r = posNum(params.r, 3);              // 半径必须为正
        var P = pt2(params.P, 7, 1);
        var d0 = Math.hypot(P.x, P.y);
        if (d0 <= r * 1.08) { P = { x: r * 2.2, y: r * 0.4 }; d0 = Math.hypot(P.x, P.y); }
        var alpha = Math.atan2(P.y, P.x);
        var ca = Math.cos(alpha), sa = Math.sin(alpha);
        var dE = '(' + fmt(d0) + '*(1+0.22*u))';
        var pxE = '(' + fmt(P.x) + '*(1+0.22*u))';
        var pyE = '(' + fmt(P.y) + '*(1+0.22*u))';
        var cosB = '(' + fmt(r) + '/' + dE + ')';
        var sinB = 'sqrt(1-pow(' + cosB + ',2))';
        var t1x = '(' + fmt(r) + '*(' + fmt(ca) + '*' + cosB + '-' + fmt(sa) + '*' + sinB + '))';
        var t1y = '(' + fmt(r) + '*(' + fmt(sa) + '*' + cosB + '+' + fmt(ca) + '*' + sinB + '))';
        var t2x = '(' + fmt(r) + '*(' + fmt(ca) + '*' + cosB + '+' + fmt(sa) + '*' + sinB + '))';
        var t2y = '(' + fmt(r) + '*(' + fmt(sa) + '*' + cosB + '-' + fmt(ca) + '*' + sinB + '))';
        return {
          anim: { mode: 'pingpong', dur: 7 },
          defs: [
            def_('ct-O', 'fixed', { x: 0, y: 0 }),
            def_('ct-P', 'fixed', { x: pxE, y: pyE }),
            def_('ct-T1', 'fixed', { x: t1x, y: t1y }),
            def_('ct-T2', 'fixed', { x: t2x, y: t2y })
          ],
          objects: [
            gcircle('ct-circle', 'ct-O', r, '#4fc3f7', { width: 2 }),
            gseg('ct-tan1', 'ct-P', 'ct-T1', '#ffd54f', { width: 2 }),
            gseg('ct-tan2', 'ct-P', 'ct-T2', '#ffd54f', { width: 2 }),
            gseg('ct-op', 'ct-O', 'ct-P', 'rgba(143,163,192,0.6)', { dash: true }),
            gseg('ct-ot1', 'ct-O', 'ct-T1', 'rgba(143,163,192,0.45)', { dash: true }),
            gseg('ct-ot2', 'ct-O', 'ct-T2', 'rgba(143,163,192,0.45)', { dash: true }),
            gdot('ct-dotO', 'ct-O', '#4fc3f7', 'O'),
            gdot('ct-dotP', 'ct-P', '#ff8a80', 'P'),
            gdot('ct-dotT1', 'ct-T1', '#ffd54f', 'T₁'),
            gdot('ct-dotT2', 'ct-T2', '#ffd54f', 'T₂'),
            gtext('ct-legend', 'ct-P', '过圆外一点作圆的两条切线:PT₁ = PT₂ = √(d² − r²)(r = ' + fmt(r) +
              ';P 沿射线移动时切线随之变化)', { x: -20, y: -30 })
          ]
        };
      },

      /* ---------- 立体几何 1:长方体与体对角线/外接球 ---------- */
      'solid-cuboid-sphere': function (params) {
        params = params || {};
        // 棱长必须为正:负值会把长方体画成反向镜像(与"斜二测示意"不符),
        // 非法值统一回退默认棱长(legend 打印的是实际使用的值)
        var a = posNum(params.a, 4), b = posNum(params.b, 3), c = posNum(params.c, 2.5);
        function pr(x, y, z) { return lit(x + 0.5 * z, y + 0.3 * z); }
        var V = {};
        var xs = [0, a], ys = [0, b], zs = [0, c], i, j, k;
        for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) for (k = 0; k < 2; k++) {
          V['' + i + j + k] = pr(xs[i], ys[j], zs[k]);
        }
        var edges = [
          ['000', '100'], ['100', '110'], ['110', '010'], ['010', '000'],
          ['001', '101'], ['101', '111'], ['111', '011'], ['011', '001'],
          ['000', '001'], ['100', '101'], ['110', '111'], ['010', '011']
        ];
        var objs = [gpoly('cs-base', [V['000'], V['100'], V['110'], V['010']], '#4fc3f7',
          { fill: 'rgba(79,195,247,0.06)', width: 2 })];
        for (i = 0; i < edges.length; i++) {
          var p1 = V[edges[i][0]], p2 = V[edges[i][1]];
          objs.push(gseg('cs-e' + i, lit(p1.x, p1.y), lit(p2.x, p2.y), 'rgba(143,163,192,0.75)', { width: 1.4 }));
        }
        var R = Math.sqrt(a * a + b * b + c * c) / 2;
        var O3 = pr(a / 2, b / 2, c / 2);
        objs.push(gseg('cs-diag', lit(V['000'].x, V['000'].y), lit(V['111'].x, V['111'].y), '#ffd54f', { width: 2.4 }));
        objs.push(gcircle('cs-sphere', lit(O3.x, O3.y), Math.round(R * 1e6) / 1e6, 'rgba(79,195,247,0.5)', { dash: true }));
        objs.push(gdot('cs-dotO', lit(O3.x, O3.y), '#ffd54f', 'O(球心)'));
        objs.push(gdot('cs-dotA', lit(V['000'].x, V['000'].y), '#ff8a80', 'A'));
        objs.push(gdot('cs-dotC', lit(V['111'].x, V['111'].y), '#ff8a80', 'C₁'));
        objs.push(gtext('cs-legend', lit(O3.x, O3.y),
          '体对角线 = √(a²+b²+c²) = ' + fmt(Math.round(2 * R * 1000) / 1000) +
          ':外接球直径即体对角线,2R = ' + fmt(Math.round(2 * R * 1000) / 1000) + ',R ≈ ' + fmt(Math.round(R * 1000) / 1000),
          { x: 0, y: -34 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 立体几何 2:直线与平面所成的角 ---------- */
      'solid-line-plane-angle': function (params) {
        params = params || {};
        // 棱长必须为正: L=0 时 arctan(L/(L√2)) = arctan(0/0) = NaN,
        // legend 会真的输出"≈ NaN°";负棱长则是镜像的"正方体"
        var L = posNum(params.L, 3);
        function pr(x, y, z) { return lit(x + 0.5 * z, y + 0.3 * z); }
        var A = pr(0, 0, 0), B = pr(L, 0, 0), C = pr(L, L, 0), D = pr(0, L, 0);
        var C1 = pr(L, L, L), B1 = pr(L, 0, L);
        var edges = [
          [A, B], [B, C], [C, D], [D, A],
          [A, pr(0, 0, L)], [B, B1], [C, C1], [D, pr(0, L, L)],
          [pr(0, 0, L), B1], [B1, C1], [C1, pr(0, L, L)], [pr(0, L, L), pr(0, 0, L)]
        ];
        var objs = [gpoly('sp-base', [A, B, C, D], '#4fc3f7', { fill: 'rgba(79,195,247,0.07)', width: 2 })];
        for (var i = 0; i < edges.length; i++) {
          objs.push(gseg('sp-e' + i, edges[i][0], edges[i][1], 'rgba(143,163,192,0.7)', { width: 1.3 }));
        }
        // 体对角线 AC₁ 与它在底面的投影 AC
        objs.push(gseg('sp-line', A, C1, '#ffd54f', { width: 2.4 }));
        objs.push(gseg('sp-proj', A, C, '#8fa3c0', { width: 2, dash: true }));
        objs.push(gseg('sp-perp', C, C1, 'rgba(255,138,128,0.8)', { width: 1.8, dash: true }));
        // 夹角弧线(投影方向 → 体对角线方向,屏幕空间按投影后方向取弧)
        var v1 = { x: C.x - A.x, y: C.y - A.y }, v2 = { x: C1.x - A.x, y: C1.y - A.y };
        var n1 = Math.hypot(v1.x, v1.y) || 1, n2 = Math.hypot(v2.x, v2.y) || 1;
        var a1 = Math.atan2(v1.y, v1.x), a2 = Math.atan2(v2.y, v2.x);
        var arc = [], NA = 24;
        for (i = 0; i <= NA; i++) {
          var t = a1 + (a2 - a1) * i / NA, rr = 0.85;
          arc.push(lit(A.x + rr * Math.cos(t), A.y + rr * Math.sin(t)));
        }
        objs.push(gpolyline('sp-arc', arc, '#eaf2ff', { width: 1.8 }));
        var ang = Math.atan(L / (L * Math.SQRT2)) * 180 / Math.PI;
        objs.push(gdot('sp-dotA', A, '#ff8a80', 'A'));
        objs.push(gdot('sp-dotC', C, '#8fa3c0', 'C'));
        objs.push(gdot('sp-dotC1', C1, '#ff8a80', 'C₁'));
        objs.push(gtext('sp-legend', C1,
          'AC₁ 与底面 ABCD 所成角 = arctan(1/√2) ≈ ' + fmt(Math.round(ang * 100) / 100) +
          '°(先找 AC₁ 在底面的投影 AC,再求 ∠C₁AC)', { x: -10, y: -30 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 数列 1:等差与等比 ---------- */
      'seq-arith-geo': function (params) {
        params = params || {};
        // 公比必须为正:q<0 时通项曲线 pow(q,x-1)(x 取任意实数)整段是 NaN,
        // 只剩孤立的点列;非法值回退默认 1.4(legend 打印实际使用的 q)
        var a1 = num(params.a1, 2), d = num(params.d, 1.5), q = posNum(params.q, 1.4);
        var n = Math.max(2, Math.min(12, Math.round(num(params.n, 8))));
        var defs = [], objs = [], i;
        for (i = 1; i <= n; i++) {
          defs.push(def_('sq-a' + i, 'fixed', { x: i, y: a1 + (i - 1) * d }));
          defs.push(def_('sq-g' + i, 'fixed', { x: i, y: a1 * Math.pow(q, i - 1) }));
        }
        objs.push(gcurve('sq-arithLine', fmt(a1) + '+' + fmt(d) + '*(x-1)', 1, n, '#4fc3f7', { width: 2 }));
        objs.push(gcurve('sq-geoCurve', fmt(a1) + '*pow(' + fmt(q) + ',x-1)', 1, n, '#ffd54f', { width: 2 }));
        for (i = 1; i <= n; i++) {
          objs.push(gdot('sq-da' + i, 'sq-a' + i, '#4fc3f7', String(i), { r: 4 }));
          objs.push(gdot('sq-dg' + i, 'sq-g' + i, '#ffd54f', String(i), { r: 4 }));
        }
        objs.push(gtext('sq-legend', 'sq-a' + n,
          '等差数列 aₙ = a₁ + (n−1)d = ' + fmt(a1) + ' + ' + fmt(d) + '(n−1)(线性增长);' +
          '等比数列 aₙ = a₁qⁿ⁻¹(q = ' + fmt(q) + ')(指数增长)', { x: -20, y: -28 }));
        return { anim: { mode: 'once', dur: 4 }, defs: defs, objects: objs };
      },

      /* ---------- 概率 1:二项分布 ---------- */
      'prob-binomial': function (params) {
        params = params || {};
        var n = clampNum(Math.round(num(params.n, 6)), 1, 20, 6);   // 试验次数 1~20
        var p = clampNum(params.p, 0.001, 0.999, 0.5);              // 概率 0.001~0.999
        var objs = [glinePts('pb-base', lit(-0.6, 0), lit(n + 0.6, 0), 'rgba(143,163,192,0.5)', {})];
        var tops = [], i, pk;
        for (i = 0; i <= n; i++) {
          pk = comb(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
          tops.push(lit(i, pk));
          objs.push(gpoly('pb-bar' + i, [
            lit(i - 0.34, 0), lit(i - 0.34, pk), lit(i + 0.34, pk), lit(i + 0.34, 0)
          ], '#4fc3f7', { fill: 'rgba(79,195,247,0.22)', width: 1.2 }));
        }
        objs.push(gpolyline('pb-poly', tops, '#ffd54f', { width: 2 }));
        for (i = 0; i <= n; i++) objs.push(gdot('pb-dot' + i, lit(i, tops[i].y), '#ffd54f', String(i), { r: 3.2 }));
        var E = n * p, D = n * p * (1 - p);
        objs.push(gtext('pb-legend', lit(n * 0.55, 0.05),
          'X ~ B(' + n + ', ' + fmt(p) + '):P(X = k) = C(n,k)pᵏ(1−p)ⁿ⁻ᵏ;E(X) = np = ' +
          fmt(Math.round(E * 1000) / 1000) + ',D(X) = np(1−p) = ' + fmt(Math.round(D * 1000) / 1000),
          { x: 0, y: -26 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 概率 2:正态分布曲线与区间面积 ---------- */
      'prob-normal': function (params) {
        params = params || {};
        var mu = num(params.mu, 0), sg = posNum(params.sigma, 1);
        var a = num(params.a, -1), b = num(params.b, 1);
        if (a > b) { var tmp = a; a = b; b = tmp; }
        var den = sg * Math.sqrt(2 * Math.PI);
        var fn = 'exp(-pow(x-' + fmt(mu) + ',2)/' + fmt(2 * sg * sg) + ')/' + fmt(den);
        function pdf(x) { return Math.exp(-Math.pow(x - mu, 2) / (2 * sg * sg)) / den; }
        var x0 = mu - 4 * sg, x1 = mu + 4 * sg;
        // 阴影/积分区间夹到 μ±4σ 窗口内:端点远在窗口之外时(如 a=-1e7),阴影顶点
        // 会把 fit 的包围盒撑到 1e7,scale 塌成 8e-5、曲线缩成一个点;而且对超宽区间
        // 做 200 段 Simpson 本身也是错的。窗口外概率 ≈ 0/1,夹取后数值等价(D9)
        var aD = clampNum(a, x0, x1, x0), bD = clampNum(b, x0, x1, x1);
        var clipped = (aD !== a) || (bD !== b);
        var N = 60, pts = [lit(aD, 0)], i, t;
        for (i = 0; i <= N; i++) {
          t = aD + (bD - aD) * i / N;
          pts.push(lit(t, pdf(t)));
        }
        pts.push(lit(bD, 0));
        var prob = integrate(pdf, aD, bD, 200);
        return {
          anim: { mode: 'once', dur: 4 },
          defs: [],
          objects: [
            gcurve('pn-curve', fn, x0, x1, '#4fc3f7', { width: 2 }),
            gpoly('pn-area', pts, '#ffd54f', { fill: 'rgba(255,213,79,0.22)', width: 1.6, color: '#ffd54f' }),
            glinePts('pn-a', lit(aD, 0), lit(aD, pdf(aD)), 'rgba(255,138,128,0.8)', { dash: true }),
            glinePts('pn-b', lit(bD, 0), lit(bD, pdf(bD)), 'rgba(255,138,128,0.8)', { dash: true }),
            glinePts('pn-mu', lit(mu, 0), lit(mu, pdf(mu)), 'rgba(143,163,192,0.6)', { dash: true }),
            gdot('pn-dotMu', lit(mu, pdf(mu)), '#ffd54f', 'μ'),
            gtext('pn-legend', lit(mu, pdf(mu)),
              'N(μ, σ²),μ = ' + fmt(mu) + ',σ = ' + fmt(sg) + ':阴影面积 = P(' + fmt(a) + ' < X < ' + fmt(b) +
              ') ≈ ' + fmt(Math.round(prob * 1e4) / 1e4) +
              (clipped ? '(端点超出 μ±4σ,阴影按该窗口截取)' : ''), { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 解析几何 4:双曲线(定义与渐近线) ---------- */
      'conic-hyperbola': function (params) {
        params = params || {};
        var a = posNum(params.a, 3), b = posNum(params.b, 2); // 半轴必须为正
        var c = Math.sqrt(a * a + b * b);
        var yE = '(-4+8*u)';
        var xE = '(' + fmt(a) + '*sqrt(1+pow(' + yE + ',2)/' + fmt(b * b) + '))';
        var y1 = 4.5, xMax = a * Math.sqrt(1 + y1 * y1 / (b * b));
        var yFn = fmt(b) + '*sqrt(pow(x,2)/' + fmt(a * a) + '-1)';
        return {
          anim: { mode: 'pingpong', dur: 8 },
          defs: [
            def_('hy-F1', 'fixed', { x: -c, y: 0 }),
            def_('hy-F2', 'fixed', { x: c, y: 0 }),
            def_('hy-P', 'fixed', { x: xE, y: yE })
          ],
          objects: [
            gcurve('hy-u1', yFn, a, xMax, '#4fc3f7', { width: 2 }),
            gcurve('hy-d1', '-' + yFn, a, xMax, '#4fc3f7', { width: 2 }),
            gcurve('hy-u2', yFn, -xMax, -a, '#4fc3f7', { width: 2 }),
            gcurve('hy-d2', '-' + yFn, -xMax, -a, '#4fc3f7', { width: 2 }),
            glinePts('hy-as1', lit(-xMax, -(b / a) * xMax), lit(xMax, (b / a) * xMax), 'rgba(143,163,192,0.5)', { dash: true, label: '渐近线' }),
            glinePts('hy-as2', lit(-xMax, (b / a) * xMax), lit(xMax, -(b / a) * xMax), 'rgba(143,163,192,0.5)', { dash: true }),
            gseg('hy-pf1', 'hy-P', 'hy-F1', '#ffd54f', { width: 2 }),
            gseg('hy-pf2', 'hy-P', 'hy-F2', '#ff8a80', { width: 2 }),
            gdot('hy-dotF1', 'hy-F1', '#4fc3f7', 'F₁'),
            gdot('hy-dotF2', 'hy-F2', '#4fc3f7', 'F₂'),
            gdot('hy-dotP', 'hy-P', '#ff8a80', 'P'),
            gtext('hy-legend', 'hy-F1', '双曲线定义:||PF₁| − |PF₂|| = 2a = ' + fmt(2 * a) +
              '(a = ' + fmt(a) + ', b = ' + fmt(b) + ', c = √(a²+b²) ≈ ' + fmt(Math.round(c * 1000) / 1000) + ')',
              { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 解析几何 5:椭圆的离心率与准线 ---------- */
      'conic-ellipse-eccentricity': function (params) {
        params = params || {};
        var a = posNum(params.a, 5);
        // c 必须满足 0 < c < a:c=0 时准线 x = a²/c = Infinity(legend 出现 "±Infinity"),
        // c>=a 时不再是椭圆。非法值回退到 a 的 0.6 倍(与原有 c>=a 的处理一致)
        var c = Math.abs(num(params.c, 3));
        if (!(c > 0) || c >= a) c = a * 0.6;
        var b = Math.sqrt(Math.max(a * a - c * c, 1e-6));
        var e = c / a, dir = a * a / c;
        return {
          anim: { mode: 'pingpong', dur: 9 },
          defs: [
            def_('ee-F1', 'fixed', { x: -c, y: 0 }),
            def_('ee-F2', 'fixed', { x: c, y: 0 }),
            def_('ee-P', 'fixed', { x: '(' + fmt(a) + '*cos(2*PI*u))', y: '(' + fmt(b) + '*sin(2*PI*u))' })
          ],
          objects: [
            gpoly('ee-shape', ellipsePts(0, 0, a, b, 96), '#4fc3f7', { fill: 'rgba(79,195,247,0.07)', width: 2 }),
            glinePts('ee-dirR', lit(dir, -b - 1.6), lit(dir, b + 1.6), 'rgba(255,213,79,0.75)', { dash: true, label: '右准线' }),
            glinePts('ee-dirL', lit(-dir, -b - 1.6), lit(-dir, b + 1.6), 'rgba(255,213,79,0.45)', { dash: true }),
            glinePts('ee-axis', lit(-a - 1, 0), lit(a + 1, 0), 'rgba(143,163,192,0.35)', { dash: true }),
            gseg('ee-r2', 'ee-P', 'ee-F2', '#ffd54f', { width: 2 }),
            gseg('ee-r1', 'ee-P', 'ee-F1', 'rgba(255,138,128,0.6)', { dash: true }),
            gdot('ee-dotF1', 'ee-F1', '#4fc3f7', 'F₁'),
            gdot('ee-dotF2', 'ee-F2', '#4fc3f7', 'F₂'),
            gdot('ee-dotP', 'ee-P', '#ff8a80', 'P'),
            gtext('ee-legend', 'ee-F2', '离心率 e = c/a = ' + fmt(Math.round(e * 1000) / 1000) +
              '(a = ' + fmt(a) + ', c = ' + fmt(c) + ', b ≈ ' + fmt(Math.round(b * 1000) / 1000) +
              ');准线 x = ±a²/c = ±' + fmt(Math.round(dir * 1000) / 1000) + ';右焦半径 |PF₂| = a − e·x_P',
              { x: -50, y: -30 })
          ]
        };
      },

      /* ---------- 解析几何 6:圆的弦与垂径定理 ---------- */
      'conic-circle-chord': function (params) {
        params = params || {};
        var r = posNum(params.r, 3);              // 半径必须为正
        var k0 = num(params.k, -2), dk = num(params.dk, 3.6);
        var kE = '(' + fmt(k0) + '+' + fmt(dk) + '*u)';
        var kUp = '(' + fmt(k0 + 0.5) + '+' + fmt(dk) + '*u)';   // 直角标记用:比 kE 高 0.5
        var rootE = 'sqrt(' + fmt(r * r) + '-pow(' + kE + ',2))';   // 半弦长 √(r²−d²)
        return {
          anim: { mode: 'pingpong', dur: 8 },
          defs: [
            def_('cc-C', 'fixed', { x: 0, y: 0 }),
            def_('cc-lineDef', 'line', { a: { x: -6, y: kE }, b: { x: 6, y: kE } }),
            def_('cc-H', 'fixed', { x: 0, y: kE }),
            def_('cc-A', 'fixed', { x: rootE, y: kE }),
            def_('cc-B', 'fixed', { x: '-' + rootE, y: kE })
          ],
          objects: [
            gcircle('cc-circle', 'cc-C', r, '#4fc3f7', { width: 2 }),
            obj_('cc-line', 'line', { a: 'cc-lineDef', color: '#ffd54f', width: 1.8, label: 'l' }),
            gseg('cc-chord', 'cc-A', 'cc-B', '#ff8a80', { width: 2.6 }),
            gseg('cc-dist', 'cc-C', 'cc-H', '#8fa3c0', { width: 2.6 }),
            glinePts('cc-right', lit(-0.4, kE), lit(-0.4, kUp), 'rgba(143,163,192,0.6)', {}),
            glinePts('cc-right2', lit(-0.4, kUp), lit(0.1, kUp), 'rgba(143,163,192,0.6)', {}),
            gdot('cc-dotH', 'cc-H', '#8fa3c0', 'H(d)'),
            gdot('cc-dotA', 'cc-A', '#ff8a80', 'A'),
            gdot('cc-dotB', 'cc-B', '#ff8a80', 'B'),
            gtext('cc-legend', 'cc-C', '垂径定理:弦长 |AB| = 2√(r² − d²) = 2√(' + fmt(r * r) +
              ' − d²),d = |k|(动画中直线平移:d 由 ' + fmt(Math.abs(k0)) + ' 变到 ' + fmt(Math.abs(k0 + dk)) + ')',
              { x: 0, y: 34 })
          ]
        };
      },

      /* ---------- 函数 5:导数与单调性/极值 ---------- */
      'func-monotonic-extrema': function (params) {
        params = params || {};
        var xs = num(params.xs, -2.2), xe = num(params.xe, 2.2);
        var xE = '(' + fmt(xs) + '+' + fmt(xe - xs) + '*u)';
        return {
          anim: { mode: 'pingpong', dur: 7 },
          defs: [
            def_('me-P', 'fixed', { x: xE, y: '(pow(' + xE + ',3)-3*(' + xE + '))' }),
            def_('me-P2', 'fixed', { x: xE, y: '(3*pow(' + xE + ',2)-3)' }),
            def_('me-vline', 'line', { a: { x: xE, y: -5 }, b: { x: xE, y: 7 } }),
            def_('me-A', 'fixed', { x: -1, y: 2 }),
            def_('me-B', 'fixed', { x: 1, y: -2 })
          ],
          objects: [
            gpoly('me-inc1', [lit(-3.2, 0), lit(-3.2, 6.2), lit(-1, 6.2), lit(-1, 0)], 'rgba(0,0,0,0)', { fill: 'rgba(77,182,172,0.12)', width: 1 }),
            gpoly('me-dec', [lit(-1, 0), lit(-1, 6.2), lit(1, 6.2), lit(1, 0)], 'rgba(0,0,0,0)', { fill: 'rgba(255,138,128,0.10)', width: 1 }),
            gpoly('me-inc2', [lit(1, 0), lit(1, 6.2), lit(3.2, 6.2), lit(3.2, 0)], 'rgba(0,0,0,0)', { fill: 'rgba(77,182,172,0.12)', width: 1 }),
            gcurve('me-f', 'pow(x,3)-3*x', -3, 3, '#4fc3f7', { width: 2.2 }),
            gcurve('me-fp', '3*pow(x,2)-3', -3, 3, '#ffd54f', { width: 2, dash: true }),
            obj_('me-line', 'line', { a: 'me-vline', color: 'rgba(143,163,192,0.6)', dash: true }),
            gdot('me-dotP', 'me-P', '#ff8a80', 'P(f)'),
            gdot('me-dotP2', 'me-P2', '#ffd54f', 'P′(f′)'),
            gdot('me-dotA', 'me-A', '#4db6ac', '极大值点'),
            gdot('me-dotB', 'me-B', '#ff8a80', '极小值点'),
            gtext('me-legend', 'me-A', 'f(x) = x³ − 3x,f′(x) = 3x² − 3(虚线):绿色带 f′ > 0 递增,' +
              '红色带 f′ < 0 递减,极值点在 x = ±1', { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 函数 6:三角函数图象变换 ---------- */
      'func-sin-transform': function (params) {
        params = params || {};
        var A = num(params.A, 1), w = num(params.w, 2), ph = num(params.phi, 1);
        if (Math.abs(w) < 1e-6) w = 1;
        var shift = -ph / w, T = 2 * Math.PI / Math.abs(w);
        var xE = '(-6.283+12.566*u)';
        return {
          anim: { mode: 'pingpong', dur: 8 },
          defs: [
            def_('st-P', 'fixed', { x: xE, y: '(' + fmt(A) + '*sin(' + fmt(w) + '*(' + xE + ')+' + fmt(ph) + '))' }),
            def_('st-v1', 'line', { a: { x: 0, y: -3 }, b: { x: 0, y: 3 } }),
            def_('st-v2', 'line', { a: { x: shift, y: -3 }, b: { x: shift, y: 3 } })
          ],
          objects: [
            gcurve('st-sin', 'sin(x)', -7, 7, 'rgba(143,163,192,0.8)', { width: 1.8, dash: true }),
            gcurve('st-curve', fmt(A) + '*sin(' + fmt(w) + '*x+' + fmt(ph) + ')', -7, 7, '#4fc3f7', { width: 2.2 }),
            obj_('st-line1', 'line', { a: 'st-v1', color: 'rgba(143,163,192,0.5)', dash: true, label: 'x = 0' }),
            obj_('st-line2', 'line', { a: 'st-v2', color: 'rgba(255,213,79,0.7)', dash: true, label: 'x = −φ/ω' }),
            gseg('st-shift', lit(0, A + 0.6), lit(shift, A + 0.6), '#ffd54f', { width: 3 }),
            gdot('st-dotP', 'st-P', '#ff8a80', 'P'),
            gtext('st-legend', 'st-P', '把 y = sin x 平移 |φ/ω| = ' + fmt(Math.round(Math.abs(shift) * 1000) / 1000) +
              ',横坐标伸缩到 1/ω、纵坐标伸缩到 A = ' + fmt(A) + ' 倍 → y = A sin(ωx + φ);周期 T = 2π/ω ≈ ' +
              fmt(Math.round(T * 1000) / 1000), { x: 0, y: -30 })
          ]
        };
      },

      /* ---------- 函数 7:定积分的几何意义 ---------- */
      'func-integral-area': function (params) {
        params = params || {};
        var a = num(params.a, 0), b = num(params.b, 2);
        var kind = String(params.kind == null ? 'x2' : params.kind);
        var fnStr, fv;
        if (kind === 'x3') { fnStr = 'pow(x,3)'; fv = function (x) { return x * x * x; }; }
        else if (kind === 'sqrt') { fnStr = 'sqrt(x)'; fv = function (x) { return Math.sqrt(Math.max(x, 0)); }; }
        else if (kind === 'sin') { fnStr = 'sin(x)'; fv = function (x) { return Math.sin(x); }; }
        else if (kind === 'inv') { fnStr = '1/x'; fv = function (x) { return x === 0 ? NaN : 1 / x; }; }
        else { kind = 'x2'; fnStr = 'pow(x,2)'; fv = function (x) { return x * x; }; }
        // sqrt(x) 在 x<0 无定义:fv 用 max(x,0) 仍会画出阴影,而曲线整段是 NaN,
        // 曲线与面积不一致 → 把积分下限夹到定义域内(legend 打印夹取后的 a)
        if (kind === 'sqrt' && !(a >= 0)) a = 0;
        if (!(b > a)) b = a + 2;
        var N = 60, i, t;
        var pts = [lit(a, 0)];
        for (i = 0; i <= N; i++) {
          t = a + (b - a) * i / N;
          pts.push(lit(t, fv(t)));
        }
        pts.push(lit(b, 0));
        var m = 8, rects = [], wdt = (b - a) / m;
        for (i = 0; i < m; i++) {
          var xl = a + i * wdt, xr = xl + wdt, yh = fv((xl + xr) / 2);
          rects.push(gpoly('ia-r' + i, [lit(xl, 0), lit(xl, yh), lit(xr, yh), lit(xr, 0)], '#ffd54f',
            { fill: 'rgba(255,213,79,0.14)', width: 1 }));
        }
        var objs = [gcurve('ia-curve', fnStr, a - 0.2, b + 0.2, '#4fc3f7', { width: 2.2 }),
          gpoly('ia-area', pts, '#4fc3f7', { fill: 'rgba(79,195,247,0.12)', width: 1.6 })];
        for (i = 0; i < rects.length; i++) objs.push(rects[i]);
        // 竖直参考线:端点函数值为 0 时是零长度线段(画不出),直接跳过
        if (Math.abs(fv(a)) > 0.02) {
          objs.push(glinePts('ia-va', lit(a, 0), lit(a, fv(a)), 'rgba(255,138,128,0.8)', { dash: true }));
        }
        if (Math.abs(fv(b)) > 0.02) {
          objs.push(glinePts('ia-vb', lit(b, 0), lit(b, fv(b)), 'rgba(255,138,128,0.8)', { dash: true }));
        }
        objs.push(glinePts('ia-axis', lit(a - 1, 0), lit(b + 1, 0), 'rgba(143,163,192,0.45)', {}));
        var approx = 0;
        for (i = 0; i < m; i++) approx += fv(a + (i + 0.5) * wdt) * wdt;
        objs.push(gtext('ia-legend', lit((a + b) / 2, fv((a + b) / 2)),
          '定积分的几何意义:曲边梯形面积 = ∫ₐᵇ f(x)dx;把 [' + fmt(a) + ', ' + fmt(b) + '] 分成 ' + m +
          ' 个矩形(中点法)≈ ' + fmt(Math.round(approx * 1e4) / 1e4), { x: 0, y: -30 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 函数 8:一元二次不等式解集 ---------- */
      'func-quadratic-inequality': function (params) {
        params = params || {};
        var a = num(params.a, 1), b = num(params.b, -2), c = num(params.c, -3);
        if (Math.abs(a) < 1e-6) a = 1;
        var h = -b / (2 * a), k = a * h * h + b * h + c;
        var disc = b * b - 4 * a * c;
        var x0 = h - 4.5, x1 = h + 4.5, sol = null;
        if (disc >= 0) {
          var r1 = (-b - Math.sqrt(disc)) / (2 * a), r2 = (-b + Math.sqrt(disc)) / (2 * a);
          sol = { lo: Math.min(r1, r2), hi: Math.max(r1, r2) };
        }
        function clampX(v) { return Math.max(x0, Math.min(x1, v)); }
        var objs = [
          glinePts('qi-xaxis', lit(x0, 0), lit(x1, 0), 'rgba(143,163,192,0.45)', {}),
          gcurve('qi-curve', fmt(a) + '*pow(x,2)+' + fmt(b) + '*x+' + fmt(c), x0, x1, '#4fc3f7', { width: 2.2 }),
          gdot('qi-dotV', lit(h, k), '#ffd54f', '顶点')
        ];
        if (sol) {
          objs.push(gdot('qi-dotR1', lit(sol.lo, 0), '#ff8a80', 'x₁'));
          objs.push(gdot('qi-dotR2', lit(sol.hi, 0), '#ff8a80', 'x₂'));
          if (a > 0) {
            objs.push(gseg('qi-s1', lit(x0, 0), lit(clampX(sol.lo), 0), '#ffd54f', { width: 5 }));
            objs.push(gseg('qi-s2', lit(clampX(sol.hi), 0), lit(x1, 0), '#ffd54f', { width: 5 }));
          } else {
            objs.push(gseg('qi-s1', lit(clampX(sol.lo), 0), lit(clampX(sol.hi), 0), '#ffd54f', { width: 5 }));
          }
        }
        var desc;
        if (!sol) desc = (a > 0) ? '由于 Δ < 0 且开口向上,不等式恒成立,解集为全体实数' : '由于 Δ < 0 且开口向下,不等式无解';
        else if (a > 0) desc = '解集 x < ' + fmt(Math.round(sol.lo * 1000) / 1000) + ' 或 x > ' + fmt(Math.round(sol.hi * 1000) / 1000);
        else desc = '解集 ' + fmt(Math.round(sol.lo * 1000) / 1000) + ' < x < ' + fmt(Math.round(sol.hi * 1000) / 1000);
        objs.push(gtext('qi-legend', lit(h, k), '解 ' + fmt(a) + 'x² + ' + fmt(b) + 'x + ' + fmt(c) + ' > 0:'
          + desc + '(金色粗线段 = 解集)', { x: 0, y: -30 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 立体几何 3:三视图 ---------- */
      'solid-three-view': function (params) {
        params = params || {};
        // 长/宽/高必须为正:负边长会让直观图反向镜像,三视图"长对正/高平齐"直接失效。
        // 非法值回退默认值(各处文字标注打印的是实际使用的值)
        var a = posNum(params.a, 4), b = posNum(params.b, 3), h = posNum(params.h, 2);
        function pr(x, y, z) { return lit(x + 0.45 * z, y + 0.3 * z); }
        var OX = -9.5, V = {}, i, j, k, xs = [0, a], ys = [0, h], zs = [0, b];
        for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) for (k = 0; k < 2; k++) {
          var q = pr(xs[i], ys[j], zs[k]);
          V['' + i + j + k] = lit(q.x + OX, q.y);
        }
        var edges = [
          ['000', '100'], ['100', '110'], ['110', '010'], ['010', '000'],
          ['001', '101'], ['101', '111'], ['111', '011'], ['011', '001'],
          ['000', '001'], ['100', '101'], ['110', '111'], ['010', '011']
        ];
        var objs = [], p1, p2;
        for (i = 0; i < edges.length; i++) {
          p1 = V[edges[i][0]]; p2 = V[edges[i][1]];
          objs.push(gseg('tv-e' + i, lit(p1.x, p1.y), lit(p2.x, p2.y), 'rgba(143,163,192,0.7)', { width: 1.3 }));
        }
        var FX = 0, FY = 0, SX = a + 1.6, SY = 0, TY = -(b + 1.6);
        objs.push(gpoly('tv-front', [lit(FX, FY), lit(FX + a, FY), lit(FX + a, FY + h), lit(FX, FY + h)],
          '#4fc3f7', { fill: 'rgba(79,195,247,0.10)', width: 2 }));
        objs.push(gpoly('tv-side', [lit(SX, SY), lit(SX + b, SY), lit(SX + b, SY + h), lit(SX, SY + h)],
          '#ffd54f', { fill: 'rgba(255,213,79,0.10)', width: 2 }));
        objs.push(gpoly('tv-top', [lit(FX, TY - b), lit(FX + a, TY - b), lit(FX + a, TY), lit(FX, TY)],
          '#4db6ac', { fill: 'rgba(77,182,172,0.10)', width: 2 }));
        objs.push(gseg('tv-g1', lit(FX, FY + h), lit(FX, TY - b), 'rgba(143,163,192,0.35)', { dash: true }));
        objs.push(gseg('tv-g2', lit(FX + a, FY + h), lit(FX + a, TY - b), 'rgba(143,163,192,0.35)', { dash: true }));
        objs.push(gseg('tv-g3', lit(FX + a, FY + h), lit(SX + b, SY + h), 'rgba(143,163,192,0.35)', { dash: true }));
        objs.push(gseg('tv-g4', lit(FX + a, FY), lit(SX + b, SY), 'rgba(143,163,192,0.35)', { dash: true }));
        objs.push(gtext('tv-t1', lit(FX + a / 2, FY + h / 2), '正视图(长 ' + fmt(a) + ' × 高 ' + fmt(h) + ')', { x: 0, y: 0 }));
        objs.push(gtext('tv-t2', lit(SX + b / 2, SY + h / 2), '侧视图(宽 ' + fmt(b) + ' × 高 ' + fmt(h) + ')', { x: 0, y: 0 }));
        objs.push(gtext('tv-t3', lit(FX + a / 2, TY - b / 2), '俯视图(长 ' + fmt(a) + ' × 宽 ' + fmt(b) + ')', { x: 0, y: 0 }));
        objs.push(gtext('tv-legend', lit(OX + a / 2, h + b + 1.4),
          '三视图口诀:长对正、高平齐、宽相等;左侧为斜二测直观图', { x: 0, y: 0 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 立体几何 4:正四面体的内切球与外接球 ---------- */
      'solid-tetrahedron-sphere': function (params) {
        params = params || {};
        var L = posNum(params.L, 3);              // 棱长必须为正(原有校验,改用统一工具)
        function pr(x, y, z) { return lit(x + 0.45 * z, y + 0.3 * z); }
        var A = pr(0, 0, 0);
        var B = pr(L, 0, 0);
        var C = pr(L / 2, L * Math.sqrt(3) / 2, 0);
        var D = pr(L / 2, L * Math.sqrt(3) / 6, L * Math.sqrt(2 / 3));
        var G = { x: (A.x + B.x + C.x + D.x) / 4, y: (A.y + B.y + C.y + D.y) / 4 };
        var Rout = Math.sqrt(6) / 4 * L, Rin = Math.sqrt(6) / 12 * L;
        var r6 = function (v) { return Math.round(v * 1e6) / 1e6; };
        return {
          anim: { mode: 'once', dur: 4 },
          defs: [],
          objects: [
            gpoly('ts-base', [A, B, C], '#4fc3f7', { fill: 'rgba(79,195,247,0.10)', width: 2 }),
            gseg('ts-ad', A, D, 'rgba(143,163,192,0.8)', { width: 1.5 }),
            gseg('ts-bd', B, D, 'rgba(143,163,192,0.8)', { width: 1.5 }),
            gseg('ts-cd', C, D, 'rgba(143,163,192,0.8)', { width: 1.5 }),
            gcircle('ts-out', lit(G.x, G.y), r6(Rout), 'rgba(79,195,247,0.55)', { dash: true }),
            gcircle('ts-in', lit(G.x, G.y), r6(Rin), 'rgba(255,138,128,0.65)', { dash: true }),
            gdot('ts-dotA', A, '#ff8a80', 'A'),
            gdot('ts-dotB', B, '#ff8a80', 'B'),
            gdot('ts-dotC', C, '#ff8a80', 'C'),
            gdot('ts-dotD', D, '#ff8a80', 'D'),
            gdot('ts-dotG', lit(G.x, G.y), '#ffd54f', 'O'),
            gtext('ts-legend', lit(G.x, G.y), '棱长 a = ' + fmt(L) + ' 的正四面体:外接球 R = √6a/4 ≈ ' +
              fmt(Math.round(Rout * 1000) / 1000) + ',内切球 r = √6a/12 ≈ ' + fmt(Math.round(Rin * 1000) / 1000) +
              ',两球同心且 R = 3r', { x: 0, y: -34 })
          ]
        };
      },

      /* ---------- 概率 3:几何概型(面积比) ---------- */
      'prob-geometric-area': function (params) {
        params = params || {};
        var s = posNum(params.s, 2), t = num(params.t, 1); // 边长必须为正
        if (t <= 0) t = s * 0.5;
        var pts = [lit(0, 0)], area;
        if (t <= s) {
          pts.push(lit(t, 0), lit(0, t));
          area = t * t / 2;
        } else if (t < 2 * s) {
          pts.push(lit(s, 0), lit(s, t - s), lit(t - s, s), lit(0, s));
          area = s * s - (2 * s - t) * (2 * s - t) / 2;
        } else {
          pts.push(lit(s, 0), lit(s, s), lit(0, s));
          area = s * s;
        }
        var p = area / (s * s);
        var objs = [
          gpoly('ga-square', [lit(0, 0), lit(s, 0), lit(s, s), lit(0, s)], '#4fc3f7',
            { fill: 'rgba(79,195,247,0.06)', width: 2 }),
          gpoly('ga-event', pts, '#ffd54f', { fill: 'rgba(255,213,79,0.25)', width: 2 })
        ];
        if (t <= s) {
          objs.push(gseg('ga-line', lit(t, 0), lit(0, t), 'rgba(255,138,128,0.9)', { dash: true, width: 2 }));
        } else if (t < 2 * s) {
          objs.push(gseg('ga-line', lit(s, t - s), lit(t - s, s), 'rgba(255,138,128,0.9)', { dash: true, width: 2 }));
        }
        objs.push(gtext('ga-legend', lit(s * 0.5, s * 0.5),
          '几何概型:正方形面积 ' + fmt(s * s) + ',事件区域面积 ' + fmt(Math.round(area * 1000) / 1000) +
          ' → P(x + y < ' + fmt(t) + ') = ' + fmt(Math.round(p * 1e4) / 1e4), { x: 0, y: -30 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 统计:散点图与回归直线 ---------- */
      'stat-regression-line': function (params) {
        params = params || {};
        var xs = String(params.xs == null ? '1,2,3,4,5' : params.xs).split(',').map(function (v) { return parseFloat(v); });
        var ys = String(params.ys == null ? '2.1,3.9,6.2,7.8,10.1' : params.ys).split(',').map(function (v) { return parseFloat(v); });
        var n = Math.min(xs.length, ys.length), i;
        var okNums = true;
        for (i = 0; i < n; i++) if (!isFinite(xs[i]) || !isFinite(ys[i])) okNums = false;
        if (n < 2 || !okNums) {
          xs = [1, 2, 3, 4, 5]; ys = [2.1, 3.9, 6.2, 7.8, 10.1]; n = 5;
        }
        var sx = 0, sy = 0;
        for (i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
        var mx = sx / n, my = sy / n, sxy = 0, sxx = 0, syy = 0, dx, dy;
        for (i = 0; i < n; i++) {
          dx = xs[i] - mx; dy = ys[i] - my;
          sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
        }
        var bb = sxx ? sxy / sxx : 0, aa = my - bb * mx;
        var rr = (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : 0;
        var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
        if (xmax - xmin < 0.5) { xmin -= 0.5; xmax += 0.5; }
        var pad = (xmax - xmin) * 0.15;
        var objs = [glinePts('sr-xaxis', lit(xmin - pad, 0), lit(xmax + pad, 0), 'rgba(143,163,192,0.4)', {})];
        for (i = 0; i < n; i++) objs.push(gdot('sr-p' + i, lit(xs[i], ys[i]), '#4fc3f7', '', { r: 4.5 }));
        objs.push(gseg('sr-line', lit(xmin - pad, aa + bb * (xmin - pad)), lit(xmax + pad, aa + bb * (xmax + pad)),
          '#ffd54f', { width: 2.4 }));
        objs.push(gdot('sr-mean', lit(mx, my), '#ff8a80', '样本中心'));
        objs.push(gtext('sr-legend', lit(mx, my), '回归方程 ŷ = ' + fmt(Math.round(bb * 1000) / 1000) + 'x + ' +
          fmt(Math.round(aa * 1000) / 1000) + '(必过样本中心(' + fmt(Math.round(mx * 100) / 100) + ', ' +
          fmt(Math.round(my * 100) / 100) + '));相关系数 r ≈ ' + fmt(Math.round(rr * 1e4) / 1e4), { x: 0, y: -30 }));
        return { anim: { mode: 'once', dur: 4 }, defs: [], objects: objs };
      },

      /* ---------- 数列 2:递推数列(斐波那契) ---------- */
      'seq-recursion-fib': function (params) {
        params = params || {};
        var n = clampNum(Math.round(num(params.n, 10)), 4, 16, 10); // 项数 4~16
        var vals = [1, 1], defs = [], objs = [], poly = [], i;
        for (i = 3; i <= n; i++) vals.push(vals[vals.length - 1] + vals[vals.length - 2]);
        for (i = 1; i <= n; i++) {
          defs.push(def_('fb-' + i, 'fixed', { x: i, y: vals[i - 1] }));
          poly.push('fb-' + i);
          objs.push(gdot('fb-d' + i, 'fb-' + i, '#ffd54f', '', { r: 3.6 }));
        }
        objs.push(gpolyline('fb-line', poly, '#ffd54f', { width: 2 }));
        // 通项渐近式 F(n) ~ φⁿ/√5:此前除数写成 1.618(即 φ),整条参照曲线被
        // 高估 φ/√5 ≈ 1.382 倍(如 x=10 时 76.0,而 F(10)=55)。除数用 sqrt(5) 表达
        objs.push(gcurve('fb-curve', 'pow(1.618,x)/sqrt(5)', 1, n, 'rgba(79,195,247,0.75)', { width: 1.6, dash: true }));
        objs.push(glinePts('fb-axis', lit(0, 0), lit(n + 1, 0), 'rgba(143,163,192,0.4)', {}));
        objs.push(gdot('fb-d1', 'fb-1', '#ff8a80', 'a₁=1'));
        objs.push(gdot('fb-d2', 'fb-2', '#ff8a80', 'a₂=1'));
        objs.push(gtext('fb-legend', 'fb-' + n, '递推 aₙ = aₙ₋₁ + aₙ₋₂(斐波那契):项为 ' +
          vals.slice(0, Math.min(8, n)).join(', ') + (n > 8 ? ', …' : '') +
          ';相邻项之比趋近黄金比 φ = (1+√5)/2 ≈ 1.618(蓝色虚线为通项渐近式 φⁿ/√5 的参照曲线)',
          { x: -30, y: -32 }));
        return { anim: { mode: 'once', dur: 4 }, defs: defs, objects: objs };
      }
    }
  };

  // 模板 id 来自外部(AI 调度),build 是用外部 id 作键的字典:普通对象会让
  // build['constructor'] 命中 Object 构造函数而被当成"模板存在",调度就会以
  // 空场景"成功"收场。这里换成无原型字典,访问方式 build[id] 保持不变(D6 同类)
  var rawBuild = templates.build;
  var safeBuild = Object.create(null);
  for (var bid in rawBuild) if (has(rawBuild, bid)) safeBuild[bid] = rawBuild[bid];
  templates.build = safeBuild;

  window.QG_TEMPLATES = templates;
})();
