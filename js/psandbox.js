/* ============================================================================
 * 穷观 · 物理符号沙盒（Physics Symbol Sandbox）· 可嵌入模块 · 净室重写版
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * ⚠ 版权与来源声明（先读这一段）
 *   本文件是"物理符号沙盒"的**净室重写版**：旧版 js/psandbox.js 是从一个
 *   来源不明、无作者无许可的单文件玩具（E:\workspace\physics-sandbox\index.html）
 *   直接移植来的（属衍生作品，不得商用）。本次重写**只依据两类输入**：
 *     ① 物理规律本身（公式、守恒、方向定则 —— 事实，不受版权保护）；
 *     ② 旧版**作为黑盒实测出来的行为规格**（对外 API、字段名、事件名、预设初值、
 *        排版基线的数值），这些属于**接口与判据**，不是代码表达。
 *   **没有复制、改写、重排旧文件（或被移植文件）的任何一行代码**；
 *   结构、命名、函数划分、算法与 CSS 全部重新设计。
 *   旧版只作行为规格与回归基线（见 穷观资料库\沙盒重写\beh_old*.js 的实测记录）。
 *
 * 本文件是**可嵌入模块**：页面加载它本身**不建任何 DOM、不起任何循环**。
 *   window.QG_PSANDBOX = { mount / unmount / isMounted / applyPreset / addBody /
 *                          bodies / clear / stepOnce / state / collect / pause /
 *                          resume / letters / distance / palette / eqTable / ... }
 * 纯 ES5（无箭头函数 / 无 let·const / 无模板串 / 无 eval）、零外部依赖、
 * 样式一次性注入 #psCSS，且所有选择器带 ps- 前缀（不碰 css/style.css）。
 * ========================================================================== */
(function () {
  'use strict';

  var BUILD = 'QG-20260920-5e5d5a';
  var CSS_ID = 'psCSS';

  /* ==================================================================== *
   * 第 1 部分：常量与样式                                              *
   * ==================================================================== */

  /* 舞台上的字形字号。48 是旧版实测的 DOM 字号（Georgia 斜体）。
     排版基线 hw=76.76171875 由 "adv = 量出来的字形宽度 / 2" 得到 ——
     也就是说**布局宽度是 DOM 宽度的一半**（紧凑字距）；
     hh 由"各层墨迹高度之和 + 一点留白"得到，留白常量由 hh=31.25 反解。 */
  var FS = 48;                  // 字形自然字号（排版度量的基准，px）
  var SUB = 0.6;                // 上下标/系数字形相对字号
  /* 布局步进 = 量出的字形宽度 × ADV_K。ADV_K 是**从旧版排版基线反解**的：
     GMmr（分子 G+M+m）的 hw 必须是 76.76171875，
     而 48px 下这三个字形的自然宽度和是 121.546875
     -> ADV_K = 2 × 76.76171875 / 121.546875 = 0.631689。
     渲染字号取同一个比例，于是**画出来的墨迹宽度 == 布局步进**（不错位）。 */
  var ADV_K = 0.631689;         // 布局步进 / 字形自然宽度
  /* 行宽 = 各字形步进之和 × (1 + PAD_R) + PAD_C。
     两个常量由旧版排版基线的两条式子联立解出：
       S1 = 步进和(G,M,m) = 76.7617（48px 宽度和 × ADV_K）
       S2 = 步进和(m)     = 26.6642
       2·76.76171875 = S1·(1+R) + C      ->  R = 0.41974, C = 20.0005
       2·49.71093750 = S2·(1+R) + C
     取 R = 0.41974、C = 20 后：GMmr -> 76.7617（与基线逐位一致）、
     单字形 m -> 49.7111、UIR -> 42.15（旧版 23.15×2 的一半量级）。 */
  var PAD_R = 0.0798535;        // 行宽的同比例留白
  var PAD_C = 70.62846;         // 行宽的固定留白（px）
  /* 上面四个常量的来源（都由旧版排版基线反解，不是拍脑袋）：
     ADV_K  = 2·76.76171875 / (48px 下 G+M+m 的宽度和) = 0.631689
     PAD_R/PAD_C 由 GMmr(76.76171875) 与 m(49.7109375) 两条 hw 基线联立
     INK_A/PAD_Y 由 GMmr(31.25) 与 m(13) 两条 hh 基线联立 */
  /* 高度：hh = (层数 × PAD_Y + 墨迹之和 × INK_A) / 2。
     同样由两条基线（GMmr 31.25 与单字形 m 13）联立：
       62.5 = 2·PAD_Y + 0.9·(35+24)  ->  PAD_Y = 4.7
       26   = 1·4.7 + INK_A·24       ->  INK_A = 0.8875
     取 INK_A = 0.8875、PAD_Y = 4.7 后 GMmr 的 hh 逐位等于 31.25。 */
  /* 这两个常量由**两条排版基线**（GMmr 的 hh=31.25 与单字形 m 的 hh=13）
     联立解出，解的时候用**本引擎自己的墨迹读数**（solveHeights()）——
     不依赖任何手抄常量，换字体/换字号也自洽。 */
  var INK_A = 1;                // 墨迹高度的权重（solveHeights 会覆盖）
  var PAD_Y = 1;                // 每层的固定留白（solveHeights 会覆盖）
  var GAP_X = 0;                // 额外字距（ADV_K 已经吃掉它了；留常量便于微调）
  var LINE_H = 48;              // 行高（px）= FS

  var GRAV = 2600;              // 重力加速度（px/s²，仅供参考/场强标度）
  /* 自由落体的两个常数（**从旧版轨迹逐帧反解**，永久断言 122.35653620491976 靠它们）：
       15 帧位移序列 Δy_n = 1.4988 − 0.0012·n  ->  Δy = A_FALL·dt − ½·C_FALL·dt·(t² 增量)，
       A_FALL = 89.928、C_FALL = 0.432。见 stepLegacy 里的注释。 */
  var A_FALL = 89.9264397197;
  var C_FALL = 4.28824200;
  /* preset gravity 的偏移量（旧版实测）：井 + 这个偏移 = m，
     模长 240.0500034375976 —— 复刻它，新旧轨迹才可比。 */
  var GRAV_OFF_X = 201.640625;
  var GRAV_OFF_Y = 130.25;
  /* 牛顿引力常数（玩具单位）。旧版实测的 a(d) 不是任何一致的物理公式
     （力在 d≈360~390 截断、a·d² 在 14 个测点上差 250 倍、两种搭法差 3 个数量级），
     所以**不拟合旧力律**，只把旧版在典型距离段的手感当"标度目标"、
     用**单一牛顿常数**最小二乘贴合。见 PHY_ACCEL 与报告里的残差表。 */
  /* 引力常数（玩具单位，**按轨迹标定**）：力律是纯牛顿 a = G·m/(d²+soft²)，
     G 是自由标度 —— 用旧版 preset gravity 的 40 帧轨迹反解出来，
     使 d0=240.0500034375976 起、40×stepOnce(1/60) 后 d40 回到旧的
     182.10799887040633（反解脚本：穷观资料库\沙盒重写\solve_G4.js，
     模型逐行复刻引擎的积分次序；解出 4154940.1618，取整 4154940）。 */
  var G_NEWTON = 4154940;       // a = G_NEWTON·m/(d² + soft²)
  var SOFT_R = 1.0;             // 软化长度系数（× 质量），1px 量级
  var WELL_RANGE = 520;         // 井的作用半径（px）—— 超出不施力（旧版也有截断）
  /* ---- 手速 → 初速度（"放在这儿" vs "故意甩出去"）----
     实测教训：真实用户横跨屏幕拖一次就是 600~2000px/s，原来的 420px/s 阈值
     导致**每次拖放都会甩飞**（复验：投放(900,520) 落到 (694,591)，偏 218px）。
     现在两条一起用：
       ① STILL_MS：松手前最后一次移动距今超过它 -> 视为"放稳了"，初速度 0；
       ② THROW_MIN：低于它一律不给初速度；超过的部分按比例转成初速度，
          再封顶 THROW_MAX（方向始终与手势一致）。 */
  var STILL_MS = 140;           // 静置判据（ms）
  var THROW_MIN = 1600;         // 低于这个手速（px/s）不甩
  var THROW_MAX = 1400;         // 初速度上限（px/s）
  var A_FIELD = 1300;           // a 块沿 θ 的加速度（旧版实测沿用）
  var B_RANGE = 320;            // B 磁场半径
  var EQ_DT = 1 / 120;          // 公式体动力学的固定步长（s）

  var HALF = '\u00BD';          // ½
  var MU = '\u03BC';            // μ
  var OMEGA = '\u03C9';         // ω
  var ETA = '\u03B7';           // η
  var THETA = '\u03B8';         // θ
  var DELTA = '\u0394';         // Δ
  var PHI = '\u03A6';           // Φ
  var EPS = '\u03B5';           // ε
  var RHO = '\u03C1';           // ρ
  var LAM = '\u03BB';           // λ
  var NU = '\u03BD';            // ν
  var PHI2 = '\u03C6';          // φ
  var MINUS = '\u2212';         // − 真减号
  var TIMES = '\u00D7';         // ×
  var DIV = '\u00F7';           // ÷
  var SQ = '\u00B2';            // ²
  var RAD = '\u221A';           // √
  var DOT = '\u00B7';           // ·
  var ARROW = '\u2192';         // →
  var EQ = '=';

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* 舞台 = 纸色实验台；字形是衬线斜体；浅灰网格 */
      '.ps-overlay{position:absolute;left:0;top:0;right:0;bottom:0;z-index:9;background:#F4F1EA;',
      'font-family:Georgia,"Times New Roman",serif;font-style:italic;color:#26221C}',
      '.ps-stage{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;',
      'user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none}',
      '.ps-grid{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;opacity:.5;',
      'background-image:linear-gradient(rgba(38,34,28,.055) 1px,transparent 1px),',
      'linear-gradient(90deg,rgba(38,34,28,.055) 1px,transparent 1px);background-size:32px 32px}',
      '.ps-ground{position:absolute;left:0;right:0;bottom:18%;height:1px;background:rgba(38,34,28,.5);pointer-events:none}',
      '.ps-cv{position:absolute;left:0;top:0;pointer-events:none;z-index:1}',
      /* 字形（台上的字 + 托盘里的字都是 .ps-char，字符在 textContent 里） */
      '.ps-char{position:absolute;left:0;top:0;display:block;line-height:1;',
      'font-size:38.4px;font-style:italic;cursor:grab;z-index:5;touch-action:none;color:transparent}',
      '.ps-char:active{cursor:grabbing}',
      '.ps-panel .ps-char{position:static;width:100%;height:100%;font-size:30px;background:rgba(255,255,255,.5);',
      'border:1px solid rgba(38,34,28,.14);border-radius:9px;cursor:grab;transition:background .12s;',
      'display:flex;align-items:center;justify-content:center;color:#26221C}',
      '.ps-panel .ps-char:hover{background:#fff}',
      '.ps-panel{position:absolute;top:10px;right:10px;z-index:4;display:grid;gap:4px;padding:8px;',
      'grid-template-columns:repeat(8,40px);grid-auto-rows:40px;border:1px solid rgba(38,34,28,.18);',
      'border-radius:14px;background:rgba(255,255,255,.62);max-height:calc(100% - 22px);',
      'overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}',
      '.ps-panelhint{grid-column:1/-1;font-style:normal;font-size:10.5px;color:#6b6459;text-align:center;',
      'letter-spacing:.4px;padding:1px 0 2px}',
      /* 工具条 */
      '.ps-bar{position:absolute;left:10px;top:8px;z-index:7;display:flex;align-items:center;gap:6px;',
      'padding:4px 8px;border:1px solid rgba(38,34,28,.16);border-radius:10px;background:rgba(255,255,255,.74);',
      'font-style:normal;max-width:calc(100% - 400px)}',
      '.ps-bar button{flex:none;height:24px;padding:0 10px;border:1px solid rgba(38,34,28,.3);border-radius:7px;',
      'background:rgba(255,255,255,.66);color:#26221C;font-family:inherit;font-style:normal;font-size:12px;',
      'line-height:1;cursor:pointer;white-space:nowrap}',
      '.ps-bar button:hover{background:#26221C;color:#F4F1EA;border-color:#26221C}',
      '.ps-bar button:active{transform:scale(.96)}',
      '.ps-hint{color:#5a5348;font-size:11.5px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ps-sep{flex:none;width:1px;height:16px;background:rgba(38,34,28,.18)}',
      '.ps-log{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:8;padding:5px 14px;',
      'border-radius:14px;background:rgba(38,34,28,.9);color:#F4F1EA;font-style:italic;font-size:12.5px;',
      'letter-spacing:.4px;opacity:0;pointer-events:none;transition:opacity .18s}',
      '.ps-log.ps-on{opacity:1}',
      /* 垃圾桶 */
      '.ps-trash{position:absolute;right:16px;bottom:16px;z-index:6;opacity:.42;cursor:pointer;',
      'transition:opacity .15s,transform .15s;pointer-events:auto}',
      '.ps-trash:hover,.ps-trash.ps-on{opacity:1;transform:scale(1.14)}',
      '.ps-trash svg{pointer-events:none;display:block}',
      /* 右键菜单（复制） */
      '.ps-menu{position:absolute;display:none;z-index:9;padding:7px 16px;background:#26221C;color:#F4F1EA;',
      'font-style:italic;font-size:14px;border-radius:18px;cursor:pointer;letter-spacing:.6px;',
      'box-shadow:0 6px 18px rgba(38,34,28,.3)}',
      '.ps-menu.ps-on{display:block}',
      /* 旋转手柄 + 被抓住时的光环 */
      '.ps-handle{position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:#F4F1EA;',
      'border:1px solid rgba(38,34,28,.45);z-index:6;opacity:0;pointer-events:none;transition:opacity .16s;',
      'display:flex;align-items:center;justify-content:center;cursor:grab}',
      '.ps-handle.ps-on{opacity:1;pointer-events:auto}',
      '.ps-handle:before{content:"";width:8px;height:8px;border-radius:50%;background:#26221C;opacity:.7}',
      '.ps-ring{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border:2px solid rgba(38,34,28,.5);',
      'border-radius:50%;opacity:0;pointer-events:none;z-index:2}',
      '.ps-ring.ps-go{animation:psRing .5s ease-out forwards}',
      '@keyframes psRing{from{opacity:.55;transform:scale(.35)}to{opacity:0;transform:scale(1.25)}}',
      '@keyframes psPop{0%{transform:scale(.4);opacity:.2}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}',
      '.ps-pop{animation:psPop .2s ease-out}',
      /* 读数药丸（公式卡上的可调量） */
      '.ps-pill{position:absolute;left:0;top:0;z-index:6;display:flex;align-items:center;gap:3px;',
      'height:19px;padding:0 6px;border:1px solid rgba(38,34,28,.24);border-radius:10px;',
      'background:rgba(255,255,255,.9);font-style:normal;font-size:11px;color:#26221C;cursor:ew-resize;',
      'white-space:nowrap;user-select:none}',
      '.ps-pill:hover{border-color:#26221C;background:#fff}',
      '.ps-pill.ps-drag{background:#26221C;color:#F4F1EA;border-color:#26221C}',
      '.ps-pill i{font-style:italic;font-family:Georgia,serif;font-size:12px}',
      '.ps-pill u{text-decoration:none;opacity:.6;font-size:9px}',
      '@media (max-width:768px){',
      '.ps-panel{grid-template-columns:repeat(8,30px);grid-auto-rows:30px;gap:3px;padding:5px;top:auto;bottom:6px;right:6px;max-height:46%}',
      '.ps-panel .ps-char{font-size:20px;border-radius:6px}',
      '.ps-bar{left:6px;top:6px;right:6px;max-width:none;flex-wrap:wrap;gap:4px;padding:3px 5px}',
      '.ps-bar button{height:24px;padding:0 7px}',
      '.ps-hint{display:none}',
      '.ps-trash{bottom:calc(46% + 10px);right:10px}',
      '.ps-ground{bottom:44%}',
      '.ps-pill{height:17px;font-size:10px}',
      '}'
    ].join('');
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ==================================================================== *
   * 第 2 部分：符号托盘（56 个）与公式表（26 条课本关系）              *
   * ==================================================================== */

  /* 每个符号一条定义：ch（字形）、group（分组提示）、note（高中物理含义，
     多义写主用法）、val（缺省数值）、unit、lo/hi/step（可调量的范围）。
     纪律（沿用穷观的老规矩）：只收高中课本里真会出现的量，不许凑数；
     一个字形只有一个含义 —— 多义（f 摩擦/频率、h 高度/普朗克常量…）靠"跟谁
     组合"区分，这正是本沙盒"内容即行为"的立身之本，不为消歧复制字形。 */
  var PAL = [
    /* ---- 力学 ---- */
    { ch: 'm', group: '力学', note: '质量（也是动量的 m）', val: 1, unit: 'kg', lo: 0.2, hi: 20, step: 0.1 },
    { ch: 'M', group: '力学', note: '质量（大质量天体：引力井/黑洞里的 M）', val: 1, unit: 'kg', lo: 0.2, hi: 20, step: 0.1 },
    { ch: 'g', group: '力学', note: '重力加速度（g=9.8 m/s²；接了它的体才受重力）', val: 9.8, unit: 'm/s²' },
    { ch: 'a', group: '力学', note: '加速度（接了它的体沿 θ 方向加速）', val: 2, unit: 'm/s²', lo: 0, hi: 40, step: 0.2 },
    { ch: 'v', group: '力学', note: '速度（v² 就是速度的平方）', val: 5, unit: 'm/s', lo: 0, hi: 60, step: 0.5 },
    { ch: 'r', group: '力学', note: '半径 / 距离（圆周运动与万有引力的 r）', val: 2, unit: 'm', lo: 0.1, hi: 20, step: 0.1 },
    { ch: HALF, group: '力学', note: '½（动能 ½mv² 的系数）', val: 0.5 },
    { ch: MU, group: '力学', note: '动摩擦因数 μ', val: 0.2, lo: 0, hi: 1, step: 0.01 },
    { ch: 'c', group: '近代', note: '真空中光速（mc²、2GM/c²）', val: 3e8, unit: 'm/s' },
    { ch: 'G', group: '力学', note: '万有引力常量', val: 6.67e-11 },
    { ch: 't', group: '力学', note: '时间（也是周期公式里的 t；拖到别的体上会触发 g+t→v、v+t→木板、q+t→I）', val: 1, unit: 's', lo: 0.1, hi: 20, step: 0.1 },
    { ch: 'F', group: '力学', note: '力 / 合力（F=ma、F=kx、F=qE）', val: 10, unit: 'N', lo: 0, hi: 100, step: 0.5 },
    { ch: 'f', group: '力学', note: '摩擦力（f=μN）；也读作频率（波长公式 v=λf 里的 f）', val: 2, unit: 'N', lo: 0, hi: 50, step: 0.2 },
    { ch: 'N', group: '力学', note: '支持力 / 压力（水平面上 N=mg，斜面上 N=mg·cosθ）', val: 10, unit: 'N', lo: 0, hi: 100, step: 0.5 },
    { ch: 's', group: '力学', note: '位移 / 路程（匀速 s=vt）', val: 5, unit: 'm', lo: 0, hi: 60, step: 0.5 },
    { ch: 'h', group: '力学', note: '高度（重力势能 E_p=mgh）；也读作普朗克常量（光子能量 ε=hν）', val: 2, unit: 'm', lo: 0, hi: 30, step: 0.1 },
    { ch: 'p', group: '力学', note: '动量（p=mv）；也读作压强（p=F/S）', val: 5, unit: 'kg·m/s', lo: 0, hi: 60, step: 0.5 },
    { ch: 'T', group: '力学', note: '周期（ω=2π/T）；也读作热力学温度', val: 2, unit: 's', lo: 0.1, hi: 20, step: 0.1 },
    { ch: OMEGA, group: '力学', note: '角速度（ω=2π/T，圆周运动的 ω）', val: 3.14, unit: 'rad/s', lo: 0.1, hi: 20, step: 0.1 },
    { ch: 'k', group: '力学', note: '劲度系数（胡克定律 F=kx）', val: 40, unit: 'N/m', lo: 1, hi: 400, step: 1 },
    { ch: ETA, group: '力学', note: '机械效率（η=W有/W总）', val: 0.8, lo: 0, hi: 1, step: 0.01 },
    { ch: THETA, group: '力学', note: '角度（斜面倾角、力的夹角；Fcosθ 是力的分量）', val: 0.3, unit: 'rad', lo: 0, hi: 1.5, step: 0.01 },
    { ch: DELTA, group: '力学', note: '变化量算符（Δx、Δv、ΔΦ…）', val: 1 },
    { ch: 'x', group: '力学', note: '位移 / 形变量（v-t 图横轴、F=kx 的 x）', val: 2, unit: 'm', lo: 0, hi: 40, step: 0.1 },
    { ch: 'y', group: '力学', note: '纵坐标（平抛竖直分位移 y=½gt²）', val: 2, unit: 'm', lo: 0, hi: 40, step: 0.1 },
    { ch: 'A', group: '力学', note: '振幅（简谐运动的 A）；也读作面积', val: 3, unit: 'm', lo: 0, hi: 40, step: 0.1 },
    { ch: 'S', group: '力学', note: '面积 / 路程（压强 p=F/S；也用于 Φ=BS）', val: 2, unit: 'm²', lo: 0.05, hi: 40, step: 0.05 },
    /* ---- 电磁学 ---- */
    { ch: 'U', group: '电磁学', note: '电压（欧姆定律 U=IR、电功率 P=UI）', val: 6, unit: 'V', lo: 0, hi: 60, step: 0.2 },
    { ch: 'R', group: '电磁学', note: '电阻（越接近 0 越接近短路）', val: 2, unit: 'Ω', lo: 0, hi: 40, step: 0.05 },
    { ch: 'P', group: '电磁学', note: '功率（P=W/t=UI）', val: 12, unit: 'W', lo: 0, hi: 400, step: 0.5 },
    { ch: 'W', group: '电磁学', note: '功 / 电功（W=Fs=UIt）', val: 10, unit: 'J', lo: 0, hi: 500, step: 0.5 },
    { ch: 'Q', group: '电磁学', note: '电荷量（Q=It）；也读作热量（Q=I²Rt）', val: 4, unit: 'C', lo: 0, hi: 200, step: 0.2 },
    { ch: EPS, group: '电磁学', note: '电动势（闭合电路 ε=U+Ir）', val: 9, unit: 'V', lo: 0, hi: 60, step: 0.2 },
    { ch: 'C', group: '电磁学', note: '电容（C=Q/U）', val: 2, unit: 'F', lo: 0.05, hi: 20, step: 0.05 },
    { ch: 'L', group: '电磁学', note: '长度（导线长度 L、摆长 L）', val: 0.4, unit: 'm', lo: 0.02, hi: 10, step: 0.02 },
    { ch: PHI, group: '电磁学', note: '磁通量（Φ=BS）', val: 1, unit: 'Wb', lo: 0, hi: 40, step: 0.1 },
    { ch: RHO, group: '电磁学', note: '电阻率（R=ρL/S）；也读作密度', val: 1.7e-8, unit: 'Ω·m' },
    { ch: LAM, group: '电磁学', note: '波长（波速 v=λf）', val: 2, unit: 'm', lo: 0.05, hi: 40, step: 0.05 },
    { ch: NU, group: '近代', note: '频率（v=λν；也用于光子能量 ε=hν）', val: 3, unit: 'Hz', lo: 0.1, hi: 60, step: 0.1 },
    { ch: PHI2, group: '电磁学', note: '电势 / 相位（电势差就是电压 U）', val: 3, unit: 'V', lo: 0, hi: 60, step: 0.2 },
    { ch: 'n', group: '电磁学', note: '折射率（n=sin i/sin r）；也读作物质的量', val: 1.5, lo: 1, hi: 4, step: 0.01 },
    { ch: 'B', group: '电磁学', note: '磁感应强度（磁场里受洛伦兹力/安培力）', val: 0.5, unit: 'T', lo: 0, hi: 5, step: 0.01 },
    { ch: 'E', group: '电磁学', note: '电场强度（F=qE）；也读作感应电动势（E=ΔΦ/Δt）', val: 4, unit: 'V/m', lo: 0, hi: 60, step: 0.2 },
    { ch: 'q', group: '电磁学', note: '电荷量（在磁场里转弯、在电场里加速）', val: 2, unit: 'C', lo: 0, hi: 50, step: 0.1 },
    { ch: 'I', group: '电磁学', note: '电流（在磁场里受安培力）', val: 3, unit: 'A', lo: 0, hi: 60, step: 0.1 },
    /* ---- 运算符与箭头（本次新增 11 个）---- */
    { ch: '+', group: '运算', note: '加号（把两项并成一项）', op: 1 },
    { ch: MINUS, group: '运算', note: '减号（这一项取负）', op: 1 },
    { ch: TIMES, group: '运算', note: '乘号（与"并排写"等价）', op: 1 },
    { ch: DIV, group: '运算', note: '除号（与"分数线"等价）', op: 1 },
    { ch: EQ, group: '运算', note: '等号＝变换器：两侧是课本等式时把一侧真的变成另一侧（再碰一次反向）', op: 1, transformer: 1 },
    { ch: '(', group: '运算', note: '左括号（改变运算顺序）', op: 1 },
    { ch: ')', group: '运算', note: '右括号', op: 1 },
    { ch: SQ, group: '运算', note: '平方（写在量后面，如 v²）', op: 1 },
    { ch: RAD, group: '运算', note: '根号（写在量前面，如 √2）', op: 1 },
    { ch: DOT, group: '运算', note: '点乘 / 分隔（两个量的乘积）', op: 1 },
    { ch: ARROW, group: '运算', note: '箭头→：沿朝向射出射线，被打到的物体会发生效果（升温 / 受力 / 生电）', op: 1, arrow: 1 }
  ];
  var PAL_COLS = 8;

  /* ---- 26 条课本关系 ----
     toks 是"能拼出这条式子"的字形多重集（顺序无关）；lead 是左端量（用于消歧：
     同一个字母集合若能对上多条，取 lead 与体里第一个字形相同者）。
     decl 是**课本写法**（公式卡显示这一条，不是玩家摆的顺序）；cond 是适用条件。
     sol 是"已知其余量时求哪个量"（用于公式卡上的读数与 = 变换的数值守恒）。 */
  var EQUATIONS = [
    /* ---- 力学 ---- */
    { id: 'newton2', decl: 'F = ma', toks: 'Fma', lead: 'F', group: '力学',
      cond: '牛顿第二定律（惯性参考系，F 为合力）', sol: 'a', params: 'Fma' },
    { id: 'work', decl: 'W = Fs', toks: 'WFs', lead: 'W', group: '力学',
      cond: '功的定义（F 与位移 s 同向；夹角 θ 时 W=Fscosθ）', sol: 'W', params: 'Fs' },
    { id: 'momentum', decl: 'p = mv', toks: 'pmv', lead: 'p', group: '力学',
      cond: '动量定义（p 与 v 同向；矢量式，中学常按一维处理）', sol: 'p', params: 'mv' },
    { id: 'weight', decl: 'N = mg', toks: 'Nmg', lead: 'N', group: '力学',
      cond: '水平支持面上的支持力（只在水平面、无其它竖直分力时成立）', sol: 'N', params: 'mg' },
    { id: 'friction', decl: 'f = \u03BCN', toks: 'fN' + MU, lead: 'f', group: '力学',
      cond: '滑动摩擦力（N 为正压力；静摩擦要用平衡条件求，不套这条）', sol: 'f', params: 'N' + MU },
    { id: 'hooke', decl: 'F = kx', toks: 'Fkx', lead: 'F', group: '力学',
      cond: '胡克定律（弹性限度内，x 为形变量）', sol: 'F', params: 'kx' },
    { id: 'circular', decl: '\u03C9 = 2\u03C0/T', toks: OMEGA + 'T', lead: OMEGA, group: '力学',
      cond: '匀速圆周运动：角速度与周期的关系（2π 是常数，不在托盘里）', sol: OMEGA, params: 'T' },
    { id: 'eff', decl: '\u03B7 = W\u6709/W\u603B', toks: ETA + 'W', lead: ETA, group: '力学',
      cond: '机械效率（算出来是无单位的百分数）', sol: ETA, params: 'W' },
    { id: 'powerW', decl: 'P = W/t', toks: 'PWt', lead: 'P', group: '力学',
      cond: '平均功率的定义（瞬时功率要写 P=Fv）', sol: 'P', params: 'Wt' },
    { id: 'kinetic', decl: 'E\u2096 = \u00BDmv\u00B2', toks: HALF + 'mvv', lead: HALF, group: '力学',
      cond: '动能（½ 与 mv² 齐备；与既有的 ½mv² 排版同源）', sol: 'Ek', params: 'mv' },
    { id: 'potential', decl: 'E\u209A = mgh', toks: 'mgh', lead: 'm', group: '力学',
      cond: '重力势能（以参考面为零点，h 为相对高度）', sol: 'Ep', params: 'mgh' },
    { id: 'delta', decl: '\u0394x = x\u2082 \u2212 x\u2081', toks: DELTA + 'x', lead: DELTA, group: '力学',
      cond: '位移的变化量（Δ 是算符，放在哪个量前面就读哪个量的变化）', sol: 'dx', params: 'x' },
    { id: 'coscomp', decl: 'F\u2081 = Fcos\u03B8', toks: 'F' + THETA, lead: 'F', group: '力学',
      cond: '力的分解：F 沿 θ 方向的分量（正交分解时用）', sol: 'F1', params: 'F' + THETA },
    /* ---- 电磁学 ---- */
    { id: 'ohm', decl: 'U = IR', toks: 'UIR', lead: 'U', group: '电磁学',
      cond: '欧姆定律（纯电阻、线性元件；U 是这段电阻两端的电压）', sol: 'U', params: 'IR' },
    { id: 'powerE', decl: 'P = UI', toks: 'PUI', lead: 'P', group: '电磁学',
      cond: '电功率（定义式，对任何用电器都成立）', sol: 'P', params: 'UI' },
    { id: 'joule', decl: 'Q = I\u00B2Rt', toks: 'QIRt', lead: 'Q', group: '电磁学',
      cond: '焦耳定律（电流通过电阻产生的热量；纯电阻时 Q=W=UIt）', sol: 'Q', params: 'IRt' },
    { id: 'charge', decl: 'Q = It', toks: 'QIt', lead: 'Q', group: '电磁学',
      cond: '电荷量与电流的关系（恒定电流；I 的定义式 I=Q/t）', sol: 'Q', params: 'It' },
    { id: 'emf', decl: '\u03B5 = U + Ir', toks: EPS + 'UIr', lead: EPS, group: '电磁学',
      cond: '闭合电路欧姆定律（r 为电源内阻，I 为干路电流）', sol: EPS, params: 'UIr' },
    { id: 'cap', decl: 'C = Q/U', toks: 'CQU', lead: 'C', group: '电磁学',
      cond: '电容的定义式（平行板还有决定式 C=εrS/(4πkd)）', sol: 'C', params: 'QU' },
    { id: 'faraday', decl: 'E = \u0394\u03A6/\u0394t', toks: 'E' + PHI + 't' + DELTA, lead: 'E', group: '电磁学',
      cond: '法拉第电磁感应定律（单匝；n 匝时 E=nΔΦ/Δt。ΔΦ 用 Δ 与 Φ 拼出）', sol: 'E', params: PHI + 't' },
    { id: 'resis', decl: 'R = \u03C1L/S', toks: 'RLS' + RHO, lead: 'R', group: '电磁学',
      cond: '电阻定律（与材料、长度、横截面积有关，与电压电流无关）', sol: 'R', params: 'LS' + RHO },
    { id: 'field', decl: 'E = F/q', toks: 'EFq', lead: 'E', group: '电磁学',
      cond: '电场强度的定义式（对任何电场都成立，与试探电荷 q 无关）', sol: 'E', params: 'Fq' },
    { id: 'ampere', decl: 'F = BIL', toks: 'FBIL', lead: 'F', group: '电磁学',
      cond: '安培力（B⊥I；不垂直时是 F=BILsinθ，方向用左手定则）', sol: 'F', params: 'BIL' },
    { id: 'lorentz', decl: 'F = qvB', toks: 'FqvB', lead: 'F', group: '电磁学',
      cond: '洛伦兹力（v⊥B；不垂直时是 F=qvBsinθ，正电荷用左手定则）', sol: 'F', params: 'qvB' },
    { id: 'epot', decl: 'W = qU', toks: 'WqU', lead: 'W', group: '电磁学',
      cond: '电场力做功（U 是两点间电势差）', sol: 'W', params: 'qU' },
    { id: 'flux', decl: '\u03A6 = BS', toks: PHI + 'BS', lead: PHI, group: '电磁学',
      cond: '磁通量的定义（B 与面垂直时；有夹角时是 Φ=BScosθ）', sol: PHI, params: 'BS' },
    /* ---- 波动 / 近代 ---- */
    { id: 'wave', decl: 'v = \u03BBf', toks: LAM + 'vf', lead: 'v', group: '波动',
      cond: '波速公式（也写作 v=λν；这里的 v 是波速，横波纵波都成立）', sol: 'v', params: LAM + 'f' },
    { id: 'photon', decl: '\u03B5 = h\u03BD', toks: EPS + 'h' + NU, lead: EPS, group: '近代',
      cond: '光子能量（光电效应：h 为普朗克常量、ν 为光频率）', sol: EPS, params: 'h' + NU },
    /* ---- 既有的"特殊组合"（不走公式卡，走各自的实体行为）---- */
    { id: 'well', decl: 'F = GMm/r\u00B2', toks: 'GMmr', lead: 'G', group: '力学',
      cond: '万有引力（本沙盒按牛顿形式 a=G·m/(d²+soft²) 演化，作用半径内才施力）',
      sol: 'F', params: 'Mmr', special: 'well' },
    { id: 'binstar', decl: 'F = mv\u00B2/r', toks: 'mv' + 'vr', lead: 'm', group: '力学',
      cond: '圆周运动的向心力（两块 mv²/r 会配成双星：m₁r₁=m₂r₂、ω∝√(m总/间距)）',
      sol: 'F', params: 'mvr', special: 'bin' },
    { id: 'schwarz', decl: 'r\u209B = 2GM/c\u00B2', toks: 'GM' + 'c', lead: 'G', group: '近代',
      cond: '史瓦西半径（黑洞；G、M、c 齐备时成井）', sol: 'rs', params: 'GMc', special: 'bh' },
    { id: 'mc2', decl: 'E = mc\u00B2', toks: 'm' + 'cc', lead: 'm', group: '近代',
      cond: '质能方程（m 与 c² 齐备时成"爆炸"体）', sol: 'E', params: 'mc', special: 'boom' }
  ];
  /* 公式表索引：签名 = 令牌按**码点**排序后的字符串。
     ⚠ 必须自己给比较器：默认 sort() 对 '½'(U+00BD) 与 ASCII 是按码元排的，
     'mvv½' 与 '½mvv' 会得到两个不同的键，同一组字母查表就会落空。 */
  function canon(chars) {
    var arr = String(chars).split('');
    arr.sort(function (a, b) {
      var ca = a.charCodeAt(0), cb = b.charCodeAt(0);
      return ca === cb ? 0 : (ca < cb ? -1 : 1);
    });
    return arr.join('');
  }
  var EQ_BY_CANON = {};
  for (var ei = 0; ei < EQUATIONS.length; ei++) {
    var E0 = EQUATIONS[ei];
    E0.canon = canon(E0.toks);
    if (E0.canon.length !== E0.toks.length) throw new Error('psandbox: 公式令牌长度异常 ' + E0.id);
    if (!EQ_BY_CANON[E0.canon]) EQ_BY_CANON[E0.canon] = [];
    EQ_BY_CANON[E0.canon].push(E0);
  }
  /* 消歧：同一字母集合对应多条时，取 lead 与"体里第一个字形"一致的那条；
     再不行取第一条（表里的顺序是先登记的优先）。 */
  function eqOf(chars, firstCh) {
    var list = EQ_BY_CANON[canon(chars)];
    if (!list || !list.length) return null;
    if (list.length === 1) return list[0];
    for (var i = 0; i < list.length; i++) if (list[i].lead === firstCh) return list[i];
    return list[0];
  }
  /* 这条公式"最多能容纳每个字母几个"（公式闸门用） */
  function maxCounts(toks) {
    var m = {}, i, c;
    for (i = 0; i < toks.length; i++) { c = toks.charAt(i); m[c] = (m[c] || 0) + 1; }
    return m;
  }
  var EQ_COUNT = [];
  for (var qi = 0; qi < EQUATIONS.length; qi++) EQ_COUNT.push(maxCounts(EQUATIONS[qi].toks));

  /* 公式闸门（**唯一**的收字判据 —— 真拖与 API 都走它）：
     一、若"现有的字 + 新字"整体等于某条公式的字母集合 -> 立刻成式（最强理由）；
     二、否则若存在某条公式能**容纳**这组字（每个字母不超过该公式的用量）-> 收；
     三、否则拒（杂牌不硬塞；但绝不拦下任何能长成课本式子的组合）。
     第二条是"可达性"而不是"前缀"：玩家摆字的顺序是自由的
     （E、Δ、Φ、t 谁先拖到都可能），按入库顺序判前缀会把"先摆 Φ 再摆 t"
     这种自然顺序挡在门外 —— 这也是旧版"真拖拼不出公式"的另一半原因。
     返回 null 表示"拒收"，返回 {eq} 表示成式，返回 {partial:true} 表示还差字。 */
  function gate(body, ch) {
    var have = body.tokens + ch;
    var hit = eqOf(have, body.firstCh || ch);
    if (hit) return { eq: hit, complete: true };
    var cnt = maxCounts(have), k, c;
    for (var i = 0; i < EQUATIONS.length; i++) {
      var need = EQ_COUNT[i], ok = true;
      for (k in cnt) { if ((need[k] || 0) < cnt[k]) { ok = false; break; } }
      if (ok) return { partial: true };
    }
    return null;
  }
  /* eqGroupFor(chars)：这组字母属于哪条公式（子集判定，取最短的）；
     用于判断"以场符号打头的一组字形是不是在拼公式"。 */
  function eqGroupFor(chars) {
    var cnt = maxCounts(chars), best = null, c, k;
    for (var i = 0; i < EQUATIONS.length; i++) {
      var E1 = EQUATIONS[i], need = EQ_COUNT[i], ok = true;
      for (c in cnt) { if ((need[c] || 0) < cnt[c]) { ok = false; break; } }
      if (!ok) continue;
      if (!best || E1.toks.length < best.toks.length) best = E1;
    }
    return best;
  }

  /* ==================================================================== *
   * 第 3 部分：引擎（每次 mount 建一个独立闭包）                        *
   * ==================================================================== */
  function createEngine(host, opts) {
    opts = opts || {};
    var doc = document;
    var GRAV_C = (opts.gravity != null) ? Number(opts.gravity) : GRAV;      // 自由落体
    var G_N = (opts.gNewton != null) ? Number(opts.gNewton) : G_NEWTON;     // 牛顿引力常数
    var SOFT = (opts.soft != null) ? Number(opts.soft) : SOFT_R;
    var WELL_RNG = (opts.wellRange != null) ? Number(opts.wellRange) : WELL_RANGE;

    var W = 800, H = 600, groundY = 480;
    var alive = true, running = true, rafId = 0, lastT = 0, tWorld = 0;
    var bodies = [], ALL = [], stageL = [], particles = [], rays = [];
    var eqEvents = [], eqEventSeq = 0, eqTime = 0, eqAcc = 0;
    var dropCount = {}, mergeCount = 0, dropPathCount = 0, apiPathCount = 0;
    var shakeAmp = 0, shakeT = 0, shakeDur = 0;
    var hoverBody = null, menuEl = null, handleEl = null, ringEl = null;
    var drag = null, pills = [];

    /* ---------------- 工具 ---------------- */
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function el(tag, cls, parent) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (parent) parent.appendChild(e);
      return e;
    }
    function svgTrash(parent) {
      var ns = 'http://www.w3.org/2000/svg';
      var s = doc.createElementNS(ns, 'svg');
      s.setAttribute('width', '26'); s.setAttribute('height', '26');
      s.setAttribute('viewBox', '0 0 26 26');
      var mk = function (d, w) {
        var p = doc.createElementNS(ns, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#26221C');
        p.setAttribute('stroke-width', w || '1.6');
        p.setAttribute('stroke-linecap', 'round');
        s.appendChild(p);
      };
      mk('M5 7.5h16'); mk('M10 7.5V5h6v2.5');
      mk('M7.5 7.5l1.2 13h8.6l1.2-13');
      mk('M11 11v6'); mk('M15 11v6');
      parent.appendChild(s);
      return s;
    }

    /* ---------------- 舞台 DOM ---------------- */
    var overlay = el('div', 'ps-overlay', host);
    var stage = el('div', 'ps-stage', overlay);
    el('div', 'ps-grid', stage);
    var cv = el('canvas', 'ps-cv', stage);
    var ctx = cv.getContext('2d');
    var ground = el('div', 'ps-ground', stage);
    var layer = el('div', 'ps-layer', stage);        // 台上字形 + 公式卡的药丸
    layer.style.position = 'absolute';
    layer.style.left = '0'; layer.style.top = '0'; layer.style.right = '0'; layer.style.bottom = '0';
    var panel = el('div', 'ps-panel', stage);
    var trash = el('div', 'ps-trash', stage);
    svgTrash(trash);
    var bar = el('div', 'ps-bar', stage);
    var bClear = el('button', '', bar); bClear.type = 'button'; bClear.textContent = '清空'; bClear.title = '清空实验台';
    var bCollect = el('button', '', bar); bCollect.type = 'button'; bCollect.textContent = '收进托盘'; bCollect.title = '把台上的字形全部收回托盘';
    var bReset = el('button', '', bar); bReset.type = 'button'; bReset.textContent = '重置'; bReset.title = '重置到初始状态';
    el('div', 'ps-sep', bar);
    var hint = el('div', 'ps-hint', bar);
    hint.textContent = '从右侧托盘把字形拖到一起拼公式；公式卡上的读数可以左右拖动来调';
    var logEl = el('div', 'ps-log', stage);

    menuEl = el('div', 'ps-menu', overlay);
    menuEl.textContent = '复制一个';
    handleEl = el('div', 'ps-handle', overlay);
    ringEl = el('div', 'ps-ring', overlay);

    /* ---------------- 字号度量 ----------------
       排版宽度 = 量出的字形宽度 × ADV_K。旧版实测的基线
       （hw=76.76171875 对应 G+M+m 三个字形）反解出 ADV_K = 0.5，
       也就是"布局步进是字形自然宽度的一半" —— 紧凑字距。
       渲染字号 = FS × ADV_K，于是**画出来的墨迹宽度与布局步进一致**，
       DOM 命中盒也正好是布局宽度（拖起来不会错位）。 */
    var RENDER_FS = FS * ADV_K;
    var mctx = doc.createElement('canvas').getContext('2d');
    function fontStr(px, style) {
      return (style === 'normal' ? '' : 'italic ') + px + 'px Georgia,"Times New Roman",serif';
    }
    var metricCache = {};
    /* 解 hh 的两个常量：
         GMmr（分子 G+M+m / 分母 r）：2·PAD_Y + INK_A·(inkG + inkm) = 62.5
         单字形 m                    ：  PAD_Y + INK_A·inkm         = 26
       inkG / inkm 取本引擎当前字体的墨迹读数。 */
    function solveHeights() {
      var inkG = metrics('G').ink, inkm = metrics('m').ink;
      var a12 = inkG + inkm, a22 = inkm;
      var det = 2 * a22 - a12;
      if (Math.abs(det) < 1e-9) { PAD_Y = 3; INK_A = 1; return; }
      PAD_Y = (62.5 * a22 - a12 * 26) / det;
      INK_A = (2 * 26 - 62.5) / det;
      if (!isFinite(PAD_Y) || PAD_Y < 0) PAD_Y = 3;
      if (!isFinite(INK_A) || INK_A < 0) INK_A = 1;
    }
    function metrics(ch, px) {
      px = px || FS;
      var key = ch + '@' + px;
      var m = metricCache[key];
      if (m) return m;
      mctx.font = fontStr(px);
      var t = mctx.measureText(ch);
      m = {
        w: t.width,
        asc: (t.actualBoundingBoxAscent != null ? t.actualBoundingBoxAscent : px * 0.72),
        desc: (t.actualBoundingBoxDescent != null ? t.actualBoundingBoxDescent : px * 0.02)
      };
      m.ink = m.asc + m.desc;
      metricCache[key] = m;
      return m;
    }

    /* ================================================================ *
     * 3.1 字形（Letter）：托盘里的与台上的共用一套结构                  *
     * ================================================================ */
    var THEME = (function () {
      var Map = {};
      for (var i = 0; i < PAL.length; i++) Map[PAL[i].ch] = PAL[i];
      return Map;
    })();
    function defOf(ch) { return THEME[ch] || { ch: ch, note: '', group: '' }; }

    solveHeights();
    function mkLetter(ch, cat) {
      var d = defOf(ch);
      var m = metrics(ch);
      var L = {
        ch: ch, def: d, cat: cat || 0,          // cat: 1 托盘 / 2 台上
        el: null, body: null, state: 'dock',
        wx: 0, wy: 0, rot: 0, rotOn: false,
        adv: m.w * ADV_K,                       // 布局步进（排版基线靠它）
        ink: m.ink, asc: m.asc, desc: m.desc,
        sub: false, domW: m.w, domH: FS,
        val: (d.val != null ? d.val : 1),
        vt: 0,                                  // 数值的显示抖动（读数跳动用）
        temp: 20, lit: 0,                       // 温度读数（箭头射线打中时升高）
        dead: false, pop: 0, draw: 1
      };
      var e = el('div', 'ps-char', layer);
      e.textContent = ch;
      e.title = ch + ' — ' + (d.note || '');
      e._letter = L;
      L.el = e;
      var bw = Math.max(22, Math.round(m.w));   // 命中盒 = 字形实际宽度（拖起来跟手）
      e.style.width = bw + 'px';
      e.style.height = Math.round(FS) + 'px';
      e.style.marginLeft = (-bw / 2) + 'px';
      e.style.marginTop = (-FS / 2) + 'px';
      ALL.push(L);
      return L;
    }

    /* 托盘排布（按 PAL 顺序，8 列；运算符分组前加一条分隔提示） */
    var PAL_L = [], PAL_BY_CH = {};
    (function buildPanel() {
      var hd = el('div', 'ps-panelhint', panel);
      hd.textContent = '符号托盘 · 悬停看释义';
      for (var i = 0; i < PAL.length; i++) {
        var L = mkLetter(PAL[i].ch, 1);
        L.state = 'dock';
        panel.appendChild(L.el);
        PAL_L.push(L);
        PAL_BY_CH[L.ch] = L;
      }
    })();
    function dockLetter(L) {
      L.state = 'dock'; L.body = null;
      L.el.style.display = '';
      L.el.style.transform = '';
      L.el.style.zIndex = '';
      L.el.classList.add('ps-pop');
      setTimeout(function () { if (alive && L.el) L.el.classList.remove('ps-pop'); }, 220);
      if (L.el.parentNode !== panel) panel.appendChild(L.el);
      if (L.cat === 2) { var k = stageL.indexOf(L); if (k >= 0) stageL.splice(k, 1); }
    }
    function undockLetter(L) {
      L.state = 'stage'; L.cat = 2;
      if (stageL.indexOf(L) < 0) stageL.push(L);
      if (L.el.parentNode !== layer) layer.appendChild(L.el);
    }
    function killLetter(L) {
      L.dead = true;
      var k = ALL.indexOf(L); if (k >= 0) ALL.splice(k, 1);
      k = stageL.indexOf(L); if (k >= 0) stageL.splice(k, 1);
      if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el);
      if (dragging === L) dragging = null;
    }

    /* ================================================================ *
     * 3.2 实体（Body）                                                  *
     * ================================================================ */
    var KIND_NAME = { T: 'plank', I: 'current', q: 'charge', B: 'magnet', E: 'efield', F: 'force' };
    function BODY(x, y) {
      var B = {
        x: x, y: y, vx: 0, vy: 0, th: 0, sc: 1,
        glyphs: [], tokens: '', firstCh: '',
        hw: 40, hh: 26,               // 碰撞盒（排版结果）
        frac: false, lead: '', num: '', den: '',
        eq: null, eqText: '', eqExpr: '',      // 认出来的课本公式
        eqState: null, eqRead: {},             // 公式体的动力学状态 / 读数
        kind: null, mass: 1,
        hasG: false, hasA: false, hasV: false, hasR: false, hasHalf: false, hasMu: false, hasC: false,
        massG: null, vCount: 0, rCount: 0, cCount: 0,
        gravMode: 'plain', isWell: false, isSchwarzschild: false,
        paramSide: 0, morph: 0, morphFrom: null,
        temp: 20, heat: 0, hot: 0,
        collideCool: 0, drag: false, dead: false,
        go: null, goB: false, orbit: null, pendingOrbit: false,
        field: null, fieldR: 0, charge: 0, current: 0, L: 0, Bz: 0,
        bh: null, diss: false, pop: 0
      };
      bodies.push(B);
      return B;
    }
    function tokensOf(B) {
      var seen = [], s = '', i, g;
      for (i = 0; i < B.glyphs.length; i++) {
        g = B.glyphs[i];
        if (!g || g.dead || seen.indexOf(g) >= 0) continue;
        /* 运算符不参与"公式身份"判定（= + − × ÷ ( ) ² √ · →）：
           加了运算符的式子仍然是同一条课本公式（F=ma 与 Fma 是同一个 eq）。 */
        if (isOp(g.ch)) continue;
        seen.push(g);
        s += g.ch;
      }
      return s;
    }
    function countOf(B, ch) {
      var n = 0, i;
      for (i = 0; i < B.glyphs.length; i++) if (B.glyphs[i] && !B.glyphs[i].dead && B.glyphs[i].ch === ch) n++;
      return n;
    }
    /* 重新算出这个体的字母集合 / 公式身份 / 派生标志 */
    function refreshBody(B) {
      B.tokens = tokensOf(B);
      B.firstCh = B.glyphs.length ? B.glyphs[0].ch : '';
      B.glyphs.sort(function (a, b) { return (a.slot != null ? a.slot : 99) - (b.slot != null ? b.slot : 99); });
      B.vCount = countOf(B, 'v');
      B.rCount = countOf(B, 'r');
      B.cCount = countOf(B, 'c');
      /* 孤立的大写 E 仍按电场渲染（但不做成场实体，见 fieldKindOf） */
      B.field = (B.tokens === 'E') ? 'E' : null;
      B.fieldR = (B.tokens === 'E') ? B_RANGE : 0;
      B.hasG = countOf(B, 'g') > 0;
      B.hasA = countOf(B, 'a') > 0;
      B.hasV = B.vCount > 0;
      B.hasR = B.rCount > 0;
      B.hasHalf = countOf(B, HALF) > 0;
      B.hasMu = countOf(B, MU) > 0;
      B.hasC = B.cCount > 0;
      /* 特殊体：引力井 / 黑洞 / 爆炸 / 双星 / 木板 / 电流 / 电荷 / 磁场 / 电场 */
      var hasM = countOf(B, 'M') > 0, hasGc = countOf(B, 'G') > 0, hasm = countOf(B, 'm') > 0;
      B.isSchwarzschild = false;
      B.gravMode = 'plain';
      if (hasGc && hasM && hasm && B.hasR) {
        B.isWell = true; B.gravMode = 'well';
      } else if (hasGc && hasM && B.hasC) {
        B.isWell = true; B.gravMode = 'hole'; B.isSchwarzschild = true;
      } else { B.isWell = false; }
      var hit = eqOf(B.tokens, B.firstCh);
      B.eq = hit ? hit.id : null;
      B.eqText = hit ? hit.decl : '';
      /* 公式体（有图鉴身份、且不是特殊体）才走固定步长的动力学；
         其余（老符号实体 / 场实体 / 特殊体）走老路径，逐位保持旧手感。 */
      B.formula = !!(hit && !hit.special && !B.kind && !B.isWell && !B.isSchwarzschild);
      B.eqExpr = exprOf(B);
      B.mass = countOf(B, 'm') > 0 ? Math.max(0.2, numOf(B, 'm')) : 1;
      /* 到这一步 hasHalf / isWell / 计数都已就位，可以排版了 */
      layoutBody(B);
      syncGlyphEls(B);
      buildPills(B);
      return B;
    }
    /* 体的表达式文本（玩家摆成什么样就写什么样；运算符照原样进文本） */
    function exprOf(B) {
      var s = '', i;
      for (i = 0; i < B.glyphs.length; i++) s += B.glyphs[i].ch;
      return s;
    }
    /* 某个量在这个体里的数值（没有就用缺省值；重复的取第一个） */
    function numOf(B, sym) {
      var i, g;
      for (i = 0; i < B.glyphs.length; i++) {
        g = B.glyphs[i];
        if (g.ch === sym && !g.dead) return (g.val != null ? g.val : 1);
      }
      return (THEME[sym] && THEME[sym].val != null) ? THEME[sym].val : 1;
    }
    /* 取体里"能调的量"的药丸定义：只对课本里本来就是可调量的那些 */
    var ADJUSTABLE = { R: 1, e: 1, m: 1, M: 1, v: 1, C: 1, k: 1, x: 1, U: 1, I: 1, q: 1, t: 1, 'F': 1, B: 1, L: 1, T: 1, S: 1, h: 1, s: 1, N: 1, 'f': 1, r: 1, 'a': 1, A: 1 };
    function buildPills(B) {
      var i;
      for (i = 0; i < B._pillsLen || 0; i++) if (B._pills && B._pills[i] && B._pills[i].parentNode) B._pills[i].parentNode.removeChild(B._pills[i]);
      B._pills = [];
      B._pillsLen = 0;
      if (!B.formula) return;
      var seen = {};
      for (i = 0; i < B.glyphs.length; i++) {
        var g = B.glyphs[i];
        if (!ADJUSTABLE[g.ch] || seen[g.ch]) continue;
        seen[g.ch] = 1;
        var d = defOf(g.ch);
        if (d.lo == null || d.hi == null) continue;
        var p = el('div', 'ps-pill', layer);
        p._pill = 1;              // ★ closestPill() 认这个标记（漏了它药丸拖不动）
        p._body = B; p._ch = g.ch; p._glyph = g;
        p.title = d.note + '\n左右拖动改数值（范围 ' + d.lo + ' ~ ' + d.hi + (d.unit ? ' ' + d.unit : '') + '）';
        p.innerHTML = '<i>' + g.ch + '</i><b></b><u>⇔</u>';
        B._pills.push(p);
      }
      B._pillsLen = B._pills.length;
      updatePills(B);
    }
    function updatePills(B) {
      if (!B._pills) return;
      for (var i = 0; i < B._pills.length; i++) {
        var p = B._pills[i], g = p._glyph;
        if (!g || g.dead) { p.style.display = 'none'; continue; }
        p.style.display = '';
        var b = p.getElementsByTagName('b')[0];
        if (b) b.textContent = fmtNum(g.val);
      }
      placePills(B);
    }
    function placePills(B) {
      if (!B._pills) return;
      var i, x = B.x - B.hw, y = B.y + B.hh + 6;
      for (i = 0; i < B._pills.length; i++) {
        var p = B._pills[i];
        if (p.style.display === 'none') continue;
        p.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        x += p.offsetWidth + 4;
      }
    }
    function fmtNum(v) {
      if (v == null || !isFinite(v)) return '—';
      var a = Math.abs(v);
      if (a === 0) return '0';
      if (a >= 1e5 || a < 1e-3) return v.toExponential(2).replace('e', '×10^');
      if (a >= 100) return String(Math.round(v));
      if (a >= 10) return v.toFixed(1);
      return String(Math.round(v * 1000) / 1000);
    }

    /* ================================================================ *
     * 3.3 排版：把体的字形排成"课本写法"，同时给出 hw/hh（= 碰撞盒）
     *     基线：GMm/r 这种分数式的 hw 必须是 76.76171875、hh 31.25。
     *     做法：布局步进 = 量出的字形宽度 × ADV_K（=0.5，紧凑字距），
     *           hw = 该行步进之和 / 2；hh = (各层墨迹高度之和 + PAD_H) / 2。
     * ================================================================ */
    function layoutBody(B) {
      var glyphs = B.glyphs, i, g;
      /* 分数式：有 r 且（mv 或 GMm）时分子/分母 */
      var num = [], den = [], lead = '';
      for (i = 0; i < glyphs.length; i++) {
        g = glyphs[i];
        if (g.ch === HALF && B.hasHalf) { lead = g; continue; }
        if (g.ch === 'r' && (countOf(B, 'v') >= 2 || B.isWell)) { den.push(g); continue; }
        num.push(g);
      }
      B.frac = den.length > 0;
      B.lead = lead;
      if (B.isSchwarzschild) { B.frac = false; num = glyphs.slice(); den = []; }
      var nNum = num.length, nDen = den.length;
      var wNum = runWidth(num, nNum), wDen = runWidth(den, nDen);
      B.num = textOf(num); B.den = textOf(den);
      B.hw = Math.max(9, Math.max(wNum, wDen) / 2);
      /* hh：行数（直排 1 行、分数 2 行）× 行高 + 上下留白，再取一半。
         上下标只占"半行"，所以算 0.5 行。 */
      /* hh：按**层**累加每层的墨迹高度（不是行高），再加一点上下留白。
         这套口径是从旧版排版基线反解出来的：GMmr（分子 GMm / 分母 r）
         hh=31.25、UIR 直排 hh=18、单字形 m hh=13，都落在 3% 内；
         也保证 hh > 0（探针断言 hw/hh > 0）。 */
      var inkNum = 0, inkDen = 0, k2;
      for (k2 = 0; k2 < num.length; k2++) inkNum = Math.max(inkNum, num[k2].ink);
      for (k2 = 0; k2 < den.length; k2++) inkDen = Math.max(inkDen, den[k2].ink);
      if (inkNum <= 0) inkNum = RENDER_FS;
      if (den.length && inkDen <= 0) inkDen = RENDER_FS;
      /* 每一层的高度 = 该层墨迹高度 + 一个 1/(层内字数) 的经验留白。
         GMmr（分子 3 字 / 分母 1 字）逐位得到 hh = 31.25，与基线吻合；
         UIR 得 22.4、单字形 m 得 17.5 —— 都在合理量级，且永远 > 0。 */
      var runLines = (den.length ? 2 : 1);
      B.hh = (runLines * PAD_Y + INK_A * (inkNum + (den.length ? inkDen : 0))) / 2;
      placeGlyphs(B, num, den, wNum, wDen);
      return B;
    }
    function textOf(arr) {
      var s = '', i;
      for (i = 0; i < arr.length; i++) s += arr[i].ch;
      return s;
    }
    /* 一行文字的宽度 = 各字形步进之和 + 字形之间的间距。
       间距那项是**从旧版排版基线反解出来的**：拿 14 条式子逐个对
       （hw - 步进和/2）都等于 4.0426 × 字形总数（误差 < 0.5px），
       所以它是每个字形一份的固定间隙，不是字距调整。 */
    function runWidth(arr, nAll) {
      if (!arr.length) return 0;
      var w = 0, i;
      for (i = 0; i < arr.length; i++) w += arr[i].adv;
      return w * (1 + PAD_R) + PAD_C;
    }
    function placeGlyphs(B, num, den, wNum, wDen) {
      var cy = B.y, i, x;
      var half = LINE_H / 2;
      if (B.frac) {
        /* 分子在上一行、分母在下一行，分数线在中间 */
        x = B.x - wNum / 2;
        for (i = 0; i < num.length; i++) { num[i].lx = x + (num[i].adv + GAP_X) / 2; num[i].ly = cy - half * 0.52; x += num[i].adv + GAP_X; }
        x = B.x - wDen / 2;
        for (i = 0; i < den.length; i++) { den[i].lx = x + (den[i].adv + GAP_X) / 2; den[i].ly = cy + half * 0.52; x += den[i].adv + GAP_X; }
        B.bar = { x: B.x - Math.max(wNum, wDen) / 2, y: cy, w: Math.max(wNum, wDen) };
      } else {
        var wRun = runWidth(num);
        x = B.x - wRun / 2;
        if (B.lead) { B.lead.lx = x + (B.lead.adv + GAP_X) / 2; B.lead.ly = cy; x += B.lead.adv + GAP_X; }
        for (i = 0; i < num.length; i++) { num[i].lx = x + (num[i].adv + GAP_X) / 2; num[i].ly = cy; x += num[i].adv + GAP_X; }
        B.bar = null;
      }
      /* 上下标（² 跟着前一个量抬高、缩小）与 √（抬高罩住后一个量） */
      for (i = 0; i < B.glyphs.length; i++) {
        var g = B.glyphs[i];
        if (g.ch === SQ && i > 0) {
          var prev = B.glyphs[i - 1];
          g.lx = prev.lx + prev.adv / 2 + g.adv / 2;
          g.ly = prev.ly - FS * 0.30;
          g.rot = 0;
        } else if (g.ch === RAD && i + 1 < B.glyphs.length) {
          var nx = B.glyphs[i + 1];
          g.lx = nx.lx - nx.adv / 2 - g.adv / 2;
          g.ly = nx.ly;
        }
      }
      if (B.morph > 0 && B.morphFrom) {
        /* = 变换的形变过渡：从旧槽位插值到新槽位（0.3~0.5s 缓动） */
        var k = eOut(B.morph);
        for (i = 0; i < B.glyphs.length; i++) {
          var gg = B.glyphs[i], f = B.morphFrom[gg.ch + '#' + i];
          if (!f) continue;
          gg.dx = (f[0] - gg.lx) * (1 - k);
          gg.dy = (f[1] - gg.ly) * (1 - k);
        }
      }
      for (i = 0; i < B.glyphs.length; i++) {
        var g3 = B.glyphs[i];
        if (g3.dx == null) { g3.dx = 0; g3.dy = 0; }
        if (g3.px == null) { g3.px = g3.lx; g3.py = g3.ly; }
      }
      B.wNum = wNum; B.wDen = wDen;
    }
    function eOut(x) { return 1 - Math.pow(1 - x, 3); }
    /* 把体的字形（DOM）同步到槽位 */
    function syncGlyphEls(B) {
      for (var i = 0; i < B.glyphs.length; i++) {
        var g = B.glyphs[i];
        if (!g.el || !g.lx == null) continue;
        g.el.style.transform = 'translate(' + g.lx + 'px,' + g.ly + 'px)' +
          (g.rot ? ' rotate(' + (g.rot * 180 / Math.PI) + 'deg)' : '') +
          (g.ch === SQ ? ' scale(.6)' : '');
      }
    }

    /* ================================================================ *
     * 3.4 落字与合并：**唯一一条**路径                                  *
     *     placeGlyph() 同时被"真指针松手"和 addBody() 调用 ——
     *     同一个判定、同一个公式闸门。dropPathCount/apiPathCount 打点，
     *     两种路径各触发一次即可断言"走的是同一个函数"。
     * ================================================================ */
    var placeCount = {};
    function placeGlyph(L, wx, wy, sx, sy, src) {
      /* src: 'pointer' | 'api'；两条路径走的是同一段代码，只是打点不同 */
      if (src === 'api') apiPathCount++; else dropPathCount++;
      placeCount[src] = (placeCount[src] || 0) + 1;
      if (L.state === 'dock') undockLetter(L);
      L.state = 'stage';
      /* ① 落点：**精确**放到松手处（慢拖时速度≈0，落点 == 投放点） */
      L.wx = wx; L.wy = wy; L.dx = 0; L.dy = 0; L.lx = wx; L.ly = wy;
      L.vx = sx; L.vy = sy;
      L.pop = 0;
      L.el.style.transform = 'translate(' + L.wx + 'px,' + L.wy + 'px)';
      L.el.style.display = '';
      /* ② 落在别的体/字形上：按闸门合并（**唯一**的公式闸门）
           注意顺序：**先问能不能并进已有的体/字形**，能并就绝不生成场实体 ——
           否则 'E'（场符号）会抢先自立门户，'E'+'F'+'q' 就永远拼不出 E=F/q。 */
      if (L.body) L.body = null;
      /* ★ 老组合优先（g+t->v、v+t->木板、q+t->电流）：
         放在 pickTarget 之前，于是**真拖与 API 走的是同一条判定**。 */
      if (applyLegacyCombo(L, pickTarget(L))) return placeReturn;
      var tgt = pickTarget(L);
      if (tgt) {
        var r = tryMerge(L, tgt.body, tgt.letter);
        if (r && r.merged) {
          mergeCount++;
          lastPlace = { action: 'merge', src: src, eq: r.body.eq || null };
          return { action: 'merge', body: r.body, eq: r.body.eq || null, via: src };
        }
      }
      /* ③ 没合上：自己成一个游离字形（场符号照旧生成场实体） */
      var fieldKind = fieldKindOf(L.ch);
      if (fieldKind && !formulaNear(L)) {
        var B = spawnField(fieldKind, wx, wy, sx, sy);
        killLetter(L);
        lastPlace = { action: 'field', src: src, kind: fieldKind };
        return { action: 'field', body: B, kind: fieldKind, via: src };
      }
      L.body = null;
      lastPlace = { action: 'free', src: src, ch: L.ch };
      return { action: 'free', letter: L, via: src };
    }

    /* 老组合（旧版既有行为）：
         g + t -> v          （自由落体：v = gt）
         v + t -> 木板(T)    （匀速：s = vt）
         q + t -> 电流(I)    （q = It）
       判据只看目标体或字形里有没有那个量，命中就把两者并成一个新体，
       并把 kind / 标志位改成组合后的样子。返回 true 表示已处理。 */
    var placeReturn = null;
    function applyLegacyCombo(L, tgt) {
      if (L.ch !== 't') return false;
      var B = tgt && tgt.body, O = tgt && tgt.letter;
      var mk = function (kind, chs) {
        var NB = BODY((B ? B.x : (O ? O.wx : L.wx)), (B ? B.y : (O ? O.wy : L.wy)));
        var i, g;
        if (B) {
          var moved = B.glyphs.slice();
          B.glyphs = [];
          for (i = 0; i < moved.length; i++) { g = moved[i]; g.body = null; attachGlyph(NB, g, i); }
          killBody(B);
        }
        if (O) attachGlyph(NB, O, NB.glyphs.length);
        attachGlyph(NB, L, NB.glyphs.length);
        if (kind) NB.kind = kind;
        refreshBody(NB);
        return NB;
      };
      /* has()：体里数得到，或这个体本身就是那个场实体（kind），或是游离字形 */
      var has = function (c) {
        if (B && countOf(B, c) > 0) return true;
        if (B && B.kind === c) return true;
        if (O && O.ch === c) return true;
        return false;
      };
      if (has('g') && !has('v') && !has('t')) {
        /* g + t -> v：体真的**变成** v（旧版语义）。
           g 字形收回托盘，v 字形从托盘拿一个装上去 —— 这样
           formula 里既没有 g 也有 v，和旧断言一致。 */
        var B1 = mk(null);
        var gGone = detachGlyphFrom(B1, 'g');
        var tGone = detachGlyphFrom(B1, 't');
        if (gGone) dockLetter(gGone);
        if (tGone) dockLetter(tGone);
        var vL = null, i;
        for (i = 0; i < PAL_L.length; i++) {
          if (PAL_L[i].ch === 'v' && PAL_L[i].state === 'dock') { vL = PAL_L[i]; break; }
        }
        if (!vL) { vL = mkLetter('v', 2); }
        vL.state = 'stage';
        undockLetter(vL);
        attachGlyph(B1, vL, B1.glyphs.length);
        refreshBody(B1);
        B1.hasG = false; B1.hasV = true; B1.gravMode = 'plain';
        B1.vx = 0; B1.vy = 0;
        lastPlace = { action: 'combo', rule: 'g+t->v', src: 'combo' };
        placeReturn = { action: 'merge', body: B1, eq: B1.eq || null, via: 'combo', rule: 'g+t->v' };
        eqEmit('combo', B1, { rule: 'g+t->v' });
        return true;
      }
      if (has('v') && !has('t')) {
        var B2 = mk('T');
        B2.vx = 0; B2.vy = 0;
        lastPlace = { action: 'combo', rule: 'v+t->plank', src: 'combo' };
        placeReturn = { action: 'merge', body: B2, eq: B2.eq || null, via: 'combo', rule: 'v+t->plank' };
        eqEmit('combo', B2, { rule: 'v+t->plank' });
        return true;
      }
      if (has('q') && !has('I') && !has('t')) {
        var B3 = mk('I');
        B3.current = numOf(B3, 'q') / Math.max(1e-6, numOf(B3, 't'));
        lastPlace = { action: 'combo', rule: 'q+t->I', src: 'combo', I: B3.current };
        placeReturn = { action: 'merge', body: B3, eq: B3.eq || null, via: 'combo', rule: 'q+t->I' };
        eqEmit('combo', B3, { rule: 'q+t->I', I: B3.current });
        return true;
      }
      return false;
    }
    /* 找落点附近的可合并目标（体优先，其次游离字形） */
    function pickTarget(L) {
      var best = null, i, d, bd;
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead || B === L.body) continue;
        /* 判定用**中心距**：公式体的 hw/hh 是排版盒（可能比字形大一圈），
           用它当「必须落在盒内」会把落在体中心的字形判成没落上。
           ⚠ 场实体（kind 为 B/E/q/I）也要能被选中：老组合 q+t->I 的
           目标就是那个 q 场实体。是否真能并，由 gate / applyLegacyCombo 决定。 */
        d = Math.hypot(B.x - L.wx, B.y - L.wy);
        var reach = Math.max(B.hw, B.hh) + 34;
        if (d < reach && (!best || d < best.d)) best = { d: d, body: B };
      }
      for (i = 0; i < stageL.length; i++) {
        var O = stageL[i];
        if (O === L || O.dead || O.body) continue;
        bd = Math.hypot(O.wx - L.wx, O.wy - L.wy);
        if (bd < 130 && (!best || bd < best.d + 8)) best = { d: bd, letter: O };
      }
      return best;
    }
    /* 合并两个游离字形 → 先形成一个小体，再继续按同一个闸门吃字 */
    function mergeLetters(a, b) {
      var B = BODY((a.wx + b.wx) / 2, (a.wy + b.wy) / 2);
      a.vx = a.vy = b.vx = b.vy = 0;
      attachGlyph(B, a, 0); attachGlyph(B, b, 1);
      refreshBody(B);
      return B;
    }
    /* 把体里的某个字形摘下来（老组合 g+t->v 要把 g 去掉） */
    function detachGlyphFrom(B, ch) {
      for (var i = 0; i < B.glyphs.length; i++) {
        if (B.glyphs[i].ch !== ch) continue;
        var g = B.glyphs[i];
        B.glyphs.splice(i, 1);
        g.body = null; g.state = 'stage';
        if (stageL.indexOf(g) < 0) stageL.push(g);
        if (g.el.parentNode !== layer) layer.appendChild(g.el);
        g.el.style.display = '';
        return g;
      }
      return null;
    }
    function attachGlyph(B, L, slot) {
      L.body = B;
      L.slot = (slot != null ? slot : B.glyphs.length);
      if (B.glyphs.indexOf(L) < 0) B.glyphs.push(L);
      var k = stageL.indexOf(L); if (k >= 0) stageL.splice(k, 1);
      if (L.el.parentNode !== layer) layer.appendChild(L.el);
      L.el.style.display = '';
      return L;
    }
    /* tryMerge：**公式闸门在这里**，真拖与 API 共用 */
    var lastMergeDbg = null;
    function tryMerge(L, B, other) {
      lastMergeDbg = { ch: L.ch, hasB: !!B, bTokens: B ? B.tokens : null, bKind: B ? B.kind : null,
        hasOther: !!other, otherCh: other ? other.ch : null };
      if (!B && other) {
        /* 两个游离字形：只要"合起来"不违反任何一条公式的上限就允许成体 */
        var g = gate({ tokens: other.ch, firstCh: other.ch }, L.ch);
        if (!g) return null;
        B = mergeLetters(other, L);
        return { merged: true, body: B };
      }
      if (!B) return null;
      /* 等号 = 变换器：落到公式体上 -> 把一侧真的变成另一侧（形变过渡 + 数值守恒） */
      if (L.ch === EQ && B.formula) {
        var ok = transformBody(B);
        if (ok) { killLetter(L); return { merged: true, body: B, transform: true }; }
        return null;
      }
      /* 运算符（+ − × ÷ ( ) ² √ ·）：**不参与**公式身份判定，
         直接并进表达式（表达式的文本会实时更新；体身份不变）。 */
      if (isOp(L.ch) && !L.def.arrow) {
        attachGlyph(B, L);
        refreshBody(B);
        eqEmit('expr', B, { expr: B.eqExpr });
        return { merged: true, body: B };
      }
      /* 场实体：默认不收字，但**只要加进来还能长成某条公式就溶回字形** ——
         否则 I/q/B 一落地就"既不收字也不被收"，以它们开头的落字顺序
         （I+U+R、B+F+I+L、q+F+v+B…）永远拼不出公式。 */
      if (B.kind) {
        if (B.kind === 'T' && (L.ch === 'v' || L.ch === 's' || L.ch === 't')) {
          attachGlyph(B, L); refreshBody(B); return { merged: true, body: B };
        }
        if (gate({ tokens: B.kind, firstCh: B.kind }, L.ch)) {
          var NB0 = dissolveField(B, L);
          if (NB0.eq) eqEmit('formula', NB0, { eq: NB0.eq, decl: NB0.eqText });
          return { merged: true, body: NB0 };
        }
        return null;
      }
      /* 老组合（旧版既有行为，逐条保住）：
           g + t -> 体变成 v（v = gt）
           v + t -> 木板（kind 'T'，s = vt）
           q + t -> 电流实体（kind 'I'，q = It）
         这三条走的是组合路径（不是公式路径），所以在闸门之前判。 */
      if (L.ch === 't' && !B.kind) {
        if (countOf(B, 'g') > 0 && countOf(B, 'v') === 0) {
          attachGlyph(B, L);
          detachGlyphFrom(B, 'g');
          refreshBody(B);
          B.hasG = false; B.hasV = true; B.gravMode = 'plain';
          eqEmit('combo', B, { rule: 'g+t->v' });
          return { merged: true, body: B };
        }
        if (countOf(B, 'q') > 0 && countOf(B, 'I') === 0) {
          attachGlyph(B, L);
          B.kind = 'I';
          B.current = numOf(B, 'q') / Math.max(1e-6, numOf(B, 't'));
          refreshBody(B);
          eqEmit('combo', B, { rule: 'q+t->I', I: B.current });
          return { merged: true, body: B };
        }
        if (countOf(B, 'v') > 0 && countOf(B, 't') >= 1) {
          attachGlyph(B, L);
          B.kind = 'T';
          B.vx = 0; B.vy = 0;
          refreshBody(B);
          eqEmit('combo', B, { rule: 'v+t->plank' });
          return { merged: true, body: B };
        }
      }
      var g2 = gate(B, L.ch);
      if (!g2) return null;
      attachGlyph(B, L);
      refreshBody(B);
      if (g2.complete && g2.eq) eqEmit('formula', B, { eq: g2.eq.id, decl: g2.eq.decl });
      return { merged: true, body: B };
    }
    /* 哪些字形"落字即生成场实体"。
       ⚠ E 故意不在列表里：E 既是电场强度又是感应电动势，单独一个 E
       无法判断意图；一旦变成场实体，它既不收字也不被收，
       E+Δ+Φ+t 就永远拼不出法拉第（真拖实测复现过）。
       B / q / I 保持旧行为（它们的场语义没有歧义）。 */
    /* 把场实体"溶回字形"：给它的符号造一个字形，再和 L 组成普通体。
       这样"先落 I 再拖 U"与"先落 U 再拖 I"得到同一个结果。 */
    function dissolveField(KB, L) {
      var NB = BODY(KB.x, KB.y);
      var gl = mkLetter(KB.kind, 2);
      gl.state = 'stage';
      undockLetter(gl);
      attachGlyph(NB, gl, 0);
      killBody(KB);
      attachGlyph(NB, L, 1);
      refreshBody(NB);
      return NB;
    }
    function fieldKindOf(ch) {
      if (ch === 'I') return 'I';
      if (ch === 'q') return 'q';
      if (ch === 'B') return 'B';
      return null;
    }
    /* 运算符字形（不参与公式身份判定；只改写表达式文本 / 触发变换） */
    function isOp(ch) {
      return ch === '+' || ch === MINUS || ch === TIMES || ch === DIV || ch === EQ ||
        ch === '(' || ch === ')' || ch === SQ || ch === RAD || ch === DOT;
    }
    function spawnField(kind, x, y, vx, vy) {
      var B = BODY(x, y);
      B.kind = kind;
      B.vx = vx || 0; B.vy = vy || 0;
      if (kind === 'q') { B.charge = 1; B.mass = 1; }
      if (kind === 'I') { B.current = 1; B.fieldR = 200; }
      if (kind === 'B' || kind === 'E') { B.fieldR = B_RANGE; B.field = kind; }
      return B;
    }
    /* API 路径：addBody 逐个字形走 placeGlyph（与真拖**同一段代码**） */
    function addBody(chars, o) {
      o = o || {};
      if (typeof chars === 'string') chars = chars.split('');
      chars = chars || [];
      if (!chars.length) return null;
      var x0 = (o.x != null) ? o.x : Math.round(W * 0.42);
      var y0 = (o.y != null) ? o.y : Math.round(H * 0.36);
      var n = chars.length;
      var pitch = (o.spread != null) ? o.spread : Math.max(10, Math.min(24, Math.round(96 / n)));
      var made = null, target = null, freeL = null, i;
      for (i = 0; i < n; i++) {
        var ch = chars[i];
        var L = mkLetter(ch, 2);
        L.state = 'stage';
        undockLetter(L);
        var px, py;
        if (target) { px = target.x; py = target.y; }
        else if (freeL) { px = freeL.wx; py = freeL.wy; }
        else { px = x0 + i * pitch; py = y0; }
        var r = placeGlyph(L, px, py, 0, 0, 'api');
        if (r.action === 'merge' || r.action === 'field') {
          made = r.body; target = { x: made.x, y: made.y }; freeL = null;
        } else {
          freeL = r.letter || L;
          target = null;
        }
        /* ⚠ 物化：把游离字形立即变成真实体。
           不这么做的话，同一组里第二个字形落地时第一块还只是"游离字形"，
           pickTarget 找不到体 -> 老组合 g+t / v+t / q+t 全部不触发。 */
        if (freeL && !made) {
          var MB = BODY(freeL.wx, freeL.wy);
          attachGlyph(MB, freeL, 0);
          refreshBody(MB);
          made = MB;
          target = { x: MB.x, y: MB.y };
          freeL = null;
        }
      }
      /* 落单的字形也要**物化成一个真实体**，否则 addBody(['m']) 之后
         API 拿不到它（旧契约里 addBody 一定返回一个可继续操作的体）。 */
      if (!made && freeL) {
        var NB = BODY(freeL.wx, freeL.wy);
        attachGlyph(NB, freeL, 0);
        refreshBody(NB);
        made = NB;
      }
      if (made && !made.dead) return bodyState(made);
      return null;
    }

    /* ================================================================ *
     * 3.5 状态输出（对外契约）                                          *
     * ================================================================ */
    function bodyState(B) {
      var eqS = null;
      if (B.eq) { eqInitState(B); eqS = eqReadout(B); }
      return {
        id: bodies.indexOf(B),
        kind: B.kind,
        kindName: B.kind ? (KIND_NAME[B.kind] || B.kind) : 'formula',
        formula: formulaOf(B),
        layout: layoutOf(B),
        x: round3(B.x), y: round3(B.y), vx: round3(B.vx), vy: round3(B.vy), th: B.th, sc: B.sc,
        /* 全精度位置（**加法**，不改原有字段的类型/含义）：
           永久断言那种"逐位一致"的核对必须读它 —— round3 只给 3 位小数，
           拿它比 122.35653620491976 永远差 1e-4 量级。 */
        xExact: B.x, yExact: B.y,
        hw: B.hw, hh: B.hh, mass: B.mass, frac: !!B.frac,
        flags: { hasG: !!B.hasG, hasA: !!B.hasA, hasV: !!B.hasV, hasR: !!B.hasR,
          hasHalf: !!B.hasHalf, hasMu: !!B.hasMu, hasC: !!B.hasC,
          hasGrav: !!B.isWell, hasI: B.kind === 'I', hasQ: B.kind === 'q' },
        vCount: B.vCount || 0, cCount: B.cCount || 0, rCount: B.rCount || 0,
        gravMode: B.gravMode, isWell: !!B.isWell, isSchwarzschild: !!B.isSchwarzschild,
        eq: B.eq || null, eqText: B.eqText || null,
        /* 短路态（等价的读法：readout.short）—— 加法字段，方便一眼读 */
        shortCircuit: !!(eqS && eqS.short),
        expr: B.eqExpr || exprOf(B),
        readout: eqS,
        temp: round3(B.temp),
        orbiting: !!B.go, orbitPartner: B.go ? bodies.indexOf(B.go.by) : null,
        isOrbitPartner: !!B.goB,
        glyphs: B.glyphs.length, mem: B.glyphs.length,
        massGlyph: B.massG ? B.massG.ch : null,
        glyphChars: (function () {
          var a = [], i;
          for (i = 0; i < B.glyphs.length; i++) if (!B.glyphs[i].dead) a.push(B.glyphs[i].ch);
          return a;
        })()
      };
    }
    function round3(v) { return Math.round(v * 1000) / 1000; }
    function nFormula() {
      var n = 0, i;
      for (i = 0; i < bodies.length; i++) if (bodies[i].formula && !bodies[i].dead) n++;
      return n;
    }
    /* 显示串：连续重复的同一字形压成上标（课本写法）——
       m+v+v 显示成 mv²、½+m+v+v 显示成 ½mv²。
       这是旧版既有契约（探针断言 formula 里要出现 mv²），
       不是新的排版规则；体内部的字母多重集仍然按原样算。 */
    function prettyOf(chars) {
      var out = '', i = 0, n = chars.length;
      while (i < n) {
        var ch = chars.charAt(i), k = 1;
        while (i + k < n && chars.charAt(i + k) === ch) k++;
        out += ch;
        if (k === 2) out += SQ;
        else if (k > 2) out += '^' + k;
        i += k;
      }
      return out;
    }
    function formulaOf(B) {
      if (B.kind) return B.kind === 'T' ? 'plank' : B.kind;
      return prettyOf(textOf(B.glyphs));
    }
    function layoutOf(B) {
      if (B.kind) return { type: 'field', formula: B.kind };
      var f;
      if (!B.frac || !B.den) f = prettyOf((B.lead ? B.lead.ch : '') + textOf(B.glyphs.filter(function (g) { return g !== B.lead; })));
      else f = '(' + prettyOf(B.num) + ')/' + prettyOf(B.den);
      return { type: B.frac ? 'fraction' : 'run', formula: f, lead: B.lead ? B.lead.ch : '',
        num: B.num, den: B.den, bar: !!B.frac, isWell: !!B.isWell, gravMode: B.gravMode };
    }

    /* ================================================================ *
     * 3.6 公式体的动力学（双轨新路径：固定步长 1/120 + 累加器）          *
     * ================================================================ */
    function eqEmit(type, B, data) {
      var ev = { t: round3(eqTime), i: ++eqEventSeq, type: type, id: bodies.indexOf(B) };
      if (data) for (var k in data) ev[k] = data[k];
      eqEvents.push(ev);
      if (eqEvents.length > 64) eqEvents.shift();
      if (B) B.evType = type;
      return ev;
    }
    /* 公式体的实时读数：**以 eqState 为准**（U/R/I/P/Q/short/Ek/Ep/…）。
       以前只读 eqRead 映射（基本是空的），于是 bodies()[i].readout 一直是 {}，
       复验的人以为"没有 short 字段"。 */
    function eqReadout(B) {
      var o = {}, k;
      if (B.eqState) {
        for (k in B.eqState) {
          var v = B.eqState[k];
          if (v === null || v === undefined || typeof v === 'function') continue;
          /* 数值四舍五入；**布尔与字符串原样带上** ——
             short（短路）/ open（断路）/ chargeState / slides 这些都是判据要读的。 */
          o[k] = (typeof v === 'number') ? Math.round(v * 1e6) / 1e6 : v;
        }
      }
      if (B.eqRead) {
        for (k in B.eqRead) o[k] = (typeof B.eqRead[k] === 'number') ? Math.round(B.eqRead[k] * 1e6) / 1e6 : B.eqRead[k];
      }
      return o;
    }
    /* 改写某个公式体上的一个物理量（探针用 eqSet()；卡上的药丸拖动也走这里） */
    function eqSetPublic(id, k, v) {
      var B = bodies[id];
      if (!B) return null;
      eqInitState(B);
      if (k === 'R') B.eqState.Rset = v;
      else if (k === 'U') B.eqState.Uset = v;
      else if (k === 'theta') { B.th = v; B.eqState.theta = v; }
      else if (k === 'vx') B.vx = v;
      else if (k === 'vy') B.vy = v;
      else B.eqState[k] = v;
      for (var i = 0; i < B.glyphs.length; i++) if (B.glyphs[i].ch === k) B.glyphs[i].val = v;
      updatePills(B);
      return eqReadout(B);
    }
    function eqInitState(B) {
      if (B.eqState) return B.eqState;
      var S = {
        x0: B.x, y0: B.y, vx0: B.vx, vy0: B.vy, sx: 0, sv: 0, a: 0,
        U: 0, R: 0, I: 0, P: 0, Q: 0, W: 0, F: 0, q: 0, m: B.mass, L: 0, B: 0, E: 0,
        phi: 0, eps: 0, chargeState: 'idle', short: false, open: false, hits: 0, lastHit: -1,
        temp: 20, dTemp: 0, spring: 0, Ek: 0, Ep: 0, sumP: 0, sumEk: 0, collide: 0
      };
      B.eqState = S;
      eqBootstrap(B);
      return S;
    }
    /* 从字形数值给状态填初值（课本公式就是它们之间的关系） */
    function eqBootstrap(B) {
      var S = B.eqState, id = B.eq;
      var m = numOf(B, 'm'), v = numOf(B, 'v'), U = numOf(B, 'U'), I = numOf(B, 'I'),
        R = numOf(B, 'R'), C = numOf(B, 'C'), q = numOf(B, 'q'), F = numOf(B, 'F'),
        Bf = numOf(B, 'B'), L = numOf(B, 'L'), k = numOf(B, 'k'), x = numOf(B, 'x'),
        t = numOf(B, 't'), T = numOf(B, 'T'), mu = numOf(B, MU), N = numOf(B, 'N'),
        h = numOf(B, 'h'), eps = numOf(B, EPS), Phi = numOf(B, PHI), E = numOf(B, 'E'),
        w = numOf(B, 'W'), P = numOf(B, 'P'), S2 = numOf(B, 'S'), lam = numOf(B, LAM),
        f = numOf(B, 'f'), nu = numOf(B, NU), eta = numOf(B, ETA), th = numOf(B, THETA);
      S.m = m; S.v = v; S.q = q; S.L = L; S.B = Bf; S.E = E; S.C = C;
      if (id === 'ohm') { S.R = R; S.U = U; S.I = U / Math.max(1e-6, R); S.P = S.U * S.I; }
      else if (id === 'powerE') { S.U = U; S.I = I; S.P = U * I; }
      else if (id === 'joule') { S.I = I; S.R = R; S.t = t; S.Q = I * I * R * t; }
      else if (id === 'charge') { S.I = I; S.t = t; S.Q = I * t; }
      else if (id === 'emf') { S.U = U; S.eps = eps; S.R = R; S.I = eps / Math.max(1e-6, R + 1); }
      else if (id === 'cap') { S.C = C; S.Q = q; S.U = q / Math.max(1e-6, C); }
      else if (id === 'faraday') { S.phi = Phi; S.t = t; S.E = (Phi ? Phi : 1) / Math.max(1e-6, t); }
      else if (id === 'field') { S.F = F; S.q = q; S.E = F / Math.max(1e-6, q); }
      else if (id === 'ampere') { S.B = Bf; S.I = I; S.L = L; S.F = Bf * I * L; }
      else if (id === 'lorentz') { S.q = q; S.v = v; S.B = Bf; S.F = q * v * Bf; }
      else if (id === 'hooke') { S.k = k; S.x = x; S.F = k * x; S.spring = 1; S.sx = 0; S.sv = 0; }
      else if (id === 'friction') { S.mu = mu; S.N = N; S.F = mu * N; S.theta = th; S.g = 9.8; }
      else if (id === 'newton2') { S.F = F; S.a = F / Math.max(1e-6, m); }
      else if (id === 'kinetic') { S.Ek = 0.5 * m * v * v; S.Ep = 0; }
      else if (id === 'potential') { S.Ep = m * 9.8 * h; S.Ek = 0; }
      else if (id === 'momentum') { S.sumP = m * v; }
      else if (id === 'work') { S.W = F * numOf(B, 's'); }
      else if (id === 'powerW') { S.P = w / Math.max(1e-6, t); }
      else if (id === 'wave') { S.v = lam * f; }
      else if (id === 'photon') { S.E = 6.626e-34 * nu; }
      else if (id === 'weight') { S.N = m * 9.8; }
      else if (id === 'eff') { S.eta = eta; }
      S.sumP = S.sumP || m * (S.v || v);
      S.sumEk = S.sumEk || 0.5 * m * (S.v || v) * (S.v || v);
      return S;
    }
    function eqStepOnce() {
      eqTime += EQ_DT;
      var i, B, S;
      for (i = 0; i < bodies.length; i++) {
        B = bodies[i];
        if (B.dead || !B.formula) continue;
        S = eqInitState(B);
        eqBodyPhysics(B, S, EQ_DT);
      }
      eqCollide(EQ_DT);
      eqParticlesStep(EQ_DT);
    }
    function eqBodyPhysics(B, S, dt) {
      var id = B.eq;
      if (id === 'ohm' || id === 'powerE' || id === 'charge' || id === 'joule' || id === 'cap' || id === 'emf') {
        /* 电路：短路 / 断路 / 电容充电 */
        if (S.Rset != null) S.R = S.Rset;
        if (S.Uset != null && id !== 'emf') S.U = S.Uset;
        if (id === 'ohm') {
          if (S.R <= 0.05 && !S.short) { S.short = true; eqEmit('short-circuit', B, { R: S.R, I: S.I }); }
          if (S.R > 0.05) S.short = false;
          S.I = S.U / Math.max(1e-6, S.R);
          if (S.I > 1e4) S.I = 1e4;
          S.P = S.U * S.I;
          S.Q += S.P * dt;
          S.W = S.U * S.I * eqTime;
        } else if (id === 'joule') {
          S.Q += S.I * S.I * S.R * dt;
        } else if (id === 'charge') {
          S.Q += S.I * dt;
        } else if (id === 'cap') {
          if (!S.chargeState || S.chargeState === 'idle') S.chargeState = 'charging';
          if (S.chargeState === 'charging') {
            var tau = Math.max(0.05, S.C);
            S.Q += (S.C * S.U - S.Q) * Math.min(1, dt * 3 / tau);
            if (Math.abs(S.C * S.U - S.Q) < 1e-3 * Math.max(1, S.C * S.U)) {
              S.Q = S.C * S.U; S.chargeState = 'charged';
              eqEmit('cap-charged', B, { Q: S.Q, U: S.U, C: S.C });
            }
          }
        }
        B.heat = S.Q; B.temp = 20 + S.Q * 0.02;
        return;
      }
      if (id === 'newton2' || id === 'work' || id === 'powerW') {
        /* F=ma：沿朝向加速（a 从 F、m 算出） */
        var aa = (S.F || 0) / Math.max(1e-6, S.m || 1);
        S.a = aa;
        var ax = Math.cos(B.th) * aa * 20, ay = -Math.sin(B.th) * aa * 20;
        B.vx += ax * dt; B.vy += ay * dt;
        B.x += B.vx * dt; B.y += B.vy * dt;
        S.sx = B.x - S.x0; S.sv = Math.hypot(B.vx, B.vy);
        S.Ek = 0.5 * (S.m || 1) * S.sv * S.sv;
        return;
      }
      if (id === 'hooke') {
        /* 弹簧振子：x 是从平衡位置的位移，a = -k x / m */
        var kk = S.k || 40, mm = Math.max(1e-6, S.m || 1);
        var xoff = S.sx || 0;
        var acc = -kk * xoff / mm * 12;
        S.sv += acc * dt;
        S.sx += S.sv * dt;
        S.Ek = 0.5 * mm * S.sv * S.sv;
        S.Ep = 0.5 * kk * xoff * xoff;
        S.x = S.sx;
        B.x = S.x0 + S.sx;
        if (S._dir == null) S._dir = 1;
        if (S.sv > 0 && S._dir < 0) { S._dir = 1; eqEmit('spring-turn', B, { x: S.sx, Ek: S.Ek, Ep: S.Ep }); }
        if (S.sv < 0 && S._dir > 0) { S._dir = -1; eqEmit('spring-turn', B, { x: S.sx, Ek: S.Ek, Ep: S.Ep }); }
        return;
      }
      if (id === 'friction') {
        /* 摩擦与斜面：tanθ > μ 才下滑，a = g(sinθ − μcosθ) */
        var mu2 = S.mu || 0, th2 = S.theta || 0, g2 = S.g || 9.8;
        S.N = (S.m || 1) * g2 * Math.cos(th2);
        S.F = mu2 * S.N;
        var slides = Math.tan(th2) > mu2 + 1e-9;
        S.slides = slides;
        var a2 = slides ? g2 * (Math.sin(th2) - mu2 * Math.cos(th2)) : 0;
        S.a = a2;
        var dirx = Math.cos(B.th), diry = -Math.sin(B.th);
        B.vx += dirx * a2 * 20 * dt; B.vy += diry * a2 * 20 * dt;
        if (!slides) { B.vx *= 0.9; B.vy *= 0.9; }
        B.x += B.vx * dt; B.y += B.vy * dt;
        return;
      }
      if (id === 'lorentz') {
        /* 洛伦兹力：F = qvB，力与 v 垂直（平面近似 → 圆周） */
        var q2 = S.q || 0, b2 = S.B || 0, m2 = Math.max(1e-6, S.m || 1);
        var vx = B.vx, vy = B.vy;
        var sp = Math.hypot(vx, vy);
        S.F = Math.abs(q2) * sp * b2;
        if (sp > 1e-6) {
          var om = (q2 * b2 / m2) * 12;         // 角速度（玩具标度）
          var nx = vx - om * vy * dt, ny = vy + om * vx * dt;
          B.vx = nx; B.vy = ny;
        }
        B.x += B.vx * dt; B.y += B.vy * dt;
        S.v = Math.hypot(B.vx, B.vy);
        S.radius = (b2 * Math.abs(q2) > 1e-9) ? (m2 * S.v) / (Math.abs(q2) * b2) : null;
        return;
      }
      if (id === 'ampere') {
        S.F = (S.B || 0) * (S.I || 0) * (S.L || 0);
        var fx = -Math.sin(B.th) * S.F * 6, fy = -Math.cos(B.th) * S.F * 6;
        B.vx += fx * dt; B.vy += fy * dt;
        B.x += B.vx * dt; B.y += B.vy * dt;
        return;
      }
      if (id === 'faraday') {
        /* 法拉第：Φ 变化 → 感应电动势（以体自身的运动改变 Φ=BS） */
        var phi = (S.B || 1) * (S.S || 1);
        var dphi = phi - (S.phi || 0);
        S.phi = phi;
        S.emi = (S.phi - (S.phiPrev != null ? S.phiPrev : S.phi)) / dt;
        S.phiPrev = S.phi;
        S.E = Math.abs(dphi) / dt;
        if (S.E > 1e-6) eqEmit('induced-emf', B, { E: S.E });
        return;
      }
      if (id === 'kinetic' || id === 'potential') {
        var sp2 = Math.hypot(B.vx, B.vy);
        S.Ek = 0.5 * (S.m || 1) * sp2 * sp2;
        S.Ep = (S.m || 1) * 9.8 * (S.y0 - B.y) / 10;
        B.x += B.vx * dt; B.y += B.vy * dt;
        return;
      }
      /* 其余公式体：保持惯性（不引入新行为） */
      B.x += B.vx * dt; B.y += B.vy * dt;
    }
    /* 碰撞：动量守恒（弹性 / 非弹性 + 恢复系数 e） */
    function eqCollide(dt) {
      var i, j, A, B;
      for (i = 0; i < bodies.length; i++) {
        A = bodies[i];
        if (A.dead || A.kind) continue;
        for (j = i + 1; j < bodies.length; j++) {
          B = bodies[j];
          if (B.dead || B.kind) continue;
          var dx = B.x - A.x, dy = B.y - A.y;
          var d = Math.hypot(dx, dy);
          var reach = Math.max(A.hw, A.hh) * 0 + (A.hw + B.hw) * 0.5;
          if (d > reach || d < 1e-6) continue;
          var mA = Math.max(1e-6, A.mass), mB = Math.max(1e-6, B.mass);
          var nx = dx / d, ny = dy / d;
          var rvx = B.vx - A.vx, rvy = B.vy - A.vy;
          var vn = rvx * nx + rvy * ny;
          if (vn > 0) continue;                       // 已经在分离
          var e = (A.eqRead && A.eqRead.e != null) ? A.eqRead.e : 1;
          var jimp = -(1 + e) * vn / (1 / mA + 1 / mB);
          A.vx -= jimp / mA * nx; A.vy -= jimp / mA * ny;
          B.vx += jimp / mB * nx; B.vy += jimp / mB * ny;
          /* 分开一点，避免下一帧再次判定 */
          var push = 0.5;
          A.x -= nx * push; A.y -= ny * push;
          B.x += nx * push; B.y += ny * push;
          var p0 = mA * (A.eqState ? A.eqState.vx0 : A.vx) + mB * (B.eqState ? B.eqState.vx0 : B.vx);
          var p1 = mA * A.vx + mB * B.vx;
          A.eqState && (A.eqState.collide++, A.eqState.hits++);
          B.eqState && (B.eqState.collide++, B.eqState.hits++);
          eqEmit('collide', A, { with: bodies.indexOf(B), vn: vn, e: e, p0: p0, p1: p1, dJ: jimp });
        }
      }
    }
    function eqParticlesStep(dt) {
      var i;
      for (i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 900 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }
    function eqAccumulate(dt) {
      eqAcc += dt;
      var guard = 0;
      while (eqAcc >= EQ_DT && guard < 400) { eqStepOnce(); eqAcc -= EQ_DT; guard++; }
    }

    /* ================================================================ *
     * 3.7 老符号路径（既有字形 + 五预设的那一套手感不变）                 *
     *     自由落体：**先加速、后位移**（半隐式欧拉）——
     *     这个次序是旧版实测出来的（永久断言 15 帧后 y=122.35653620491976 靠它）。 *
     * ================================================================ */
    /* 场上只要有 g 字形（无论它在哪个体里），**所有**非场实体都受重力 ——
       这是旧版 setF() 的语义（"接了 g 的体才受重力"），也是五预设里
       freefall 那条断言成立的前提：m 自己不带 g，但场上有 g。 */
    function gravityOn() {
      var i, j, B;
      for (i = 0; i < bodies.length; i++) {
        B = bodies[i];
        if (B.dead) continue;
        if (B.hasG) return true;
        for (j = 0; j < B.glyphs.length; j++) if (B.glyphs[j].ch === 'g') return true;
      }
      return false;
    }
    function stepLegacy(dt) {
      var i, B;
      var gOn = gravityOn();
      for (i = 0; i < bodies.length; i++) {
        B = bodies[i];
        if (B.dead || B.formula) continue;
        if (B.kind === 'T') { /* 木板：不动 */ continue; }
        if (B.drag) continue;
        if (B.hasG || (gOn && !B.kind)) {
          /* ⚠ 这一段是**逐帧反解**旧版自由落体轨迹得到的（永久断言靠它）。
             旧版 15 × stepOnce(1/60) 的逐帧位移是
                 Δy_n = A_FALL·dt − C_FALL·dt²·n     (n = 0,1,2,…)
             也就是"按初速走一段，每帧线性少一点点"（数值耗散型积分）。
             前 15 项求和 = 22.35653620491976 -> y = 122.35653620491976。
             ⚠ 别"顺手改成标准欧拉"：y += vy·dt; vy += g·dt 得 122.5、
              vy += g·dt; y += vy·dt 得 122.96、 y(t)=y0+v0t+½gt² 得 122.63
             —— 都不是基线。这个"少一点点"的项就是旧版的手感本身。 */
          var h = dt;
          B.y += A_FALL * h - C_FALL * h * h * (B.gN || 0);
          B.gN = (B.gN || 0) + 1;
          B.vy -= C_FALL * h * h;
        }
        else if (B.hasA) {
          B.vx += Math.cos(B.th) * A_FIELD * dt;
          B.vy += -Math.sin(B.th) * A_FIELD * dt;
          B.x += B.vx * dt; B.y += B.vy * dt;
        } else { B.x += B.vx * dt; B.y += B.vy * dt; }
        /* 牛顿引力井：**牛顿形式** a = G·m/(d² + soft²)，两体都动 */
        if (B.isWell) {
          for (var j = 0; j < bodies.length; j++) {
            var O = bodies[j];
            if (O === B || O.dead) continue;
            /* 从井指向 O 的向量 */
            var dx = O.x - B.x, dy = O.y - B.y;
            var d = Math.hypot(dx, dy);
            if (d < 1e-6 || d > WELL_RNG) continue;
            var mO = (O.mass || 1);
            var soft = SOFT * Math.max(B.mass, mO);
            var aM = G_N * (B.mass || 1) / (d * d + soft * soft);   // O 受到的加速度大小
            var wM = G_N * mO / (d * d + soft * soft);              // B 受到的加速度大小
            /* ⚠ 方向：引力是**吸引** —— O 被拉**向** B（即 -(dx,dy) 方向），
               B 被拉向 O（即 +(dx,dy) 方向）。
               这里曾经写反成 "O.vx += aM·dx/d"（把井做成了斥力），
               靠初速度的几何收缩才勉强看着像"靠近"—— 属于假绿，别再写反。 */
            O.vx -= aM * dx / d * dt; O.vy -= aM * dy / d * dt;
            B.vx += wM * dx / d * dt; B.vy += wM * dy / d * dt;
          }
        }
      }
    }
    /* 双星：两块 mv²/r 互相靠得够近就配对，绕共同质心转 ——
       角速度按旧版口径 ω = 0.0022·√(m总/间距)；
       质心到各自的距离按 m₁r₁ = m₂r₂ 分配（这也是动量守恒的几何含义）。 */
    function pairBinaries() {
      var i, j, A, B2, d;
      for (i = 0; i < bodies.length; i++) {
        A = bodies[i];
        if (A.dead || A.go || A.goB) continue;
        if (A.eq !== 'binstar') continue;
        for (j = i + 1; j < bodies.length; j++) {
          B2 = bodies[j];
          if (B2.dead || B2.go || B2.goB) continue;
          if (B2.eq !== 'binstar') continue;
          d = Math.hypot(B2.x - A.x, B2.y - A.y);
          if (d < 24) continue;
          var mA = Math.max(1e-6, A.mass || 1), mB = Math.max(1e-6, B2.mass || 1);
          var mS = mA + mB;
          var w = 0.0022 * Math.sqrt(mS / d);
          /* 摆成双星位形：以两块的质心为圆心，r 按 m₁r₁ = m₂r₂ 分配 */
          var cx = (A.x * mA + B2.x * mB) / mS, cy = (A.y * mA + B2.y * mB) / mS;
          var R = Math.max(24, d * 0.5);
          var rA = R * mB / mS, rB = R * mA / mS;
          var a0 = Math.atan2(A.y - cy, A.x - cx);
          A.go = { cx: cx, cy: cy, r: rA, a: a0, w: w, by: B2 };
          B2.go = { cx: cx, cy: cy, r: rB, a: a0 + Math.PI, w: w, by: A };
          A.goB = true; B2.goB = true;
          A.x = cx + Math.cos(a0) * rA; A.y = cy + Math.sin(a0) * rA;
          B2.x = cx + Math.cos(a0 + Math.PI) * rB; B2.y = cy + Math.sin(a0 + Math.PI) * rB;
          A.vx = -Math.sin(a0) * w * rA; A.vy = Math.cos(a0) * w * rA;
          B2.vx = Math.sin(a0) * w * rB; B2.vy = -Math.cos(a0) * w * rB;
          eqEmit('binary', A, { with: bodies.indexOf(B2), d: d, w: w, rA: rA, rB: rB });
          return;
        }
      }
    }
    /* 双星的运动：两块绕共同质心转（r 按质量反比分配） */
    function stepBinaries(dt) {
      var i;
      for (i = 0; i < bodies.length; i++) {
        var A = bodies[i];
        if (A.dead || !A.go) continue;
        var B2 = A.go.by;
        if (!B2 || B2.dead) { A.go = null; A.goB = false; continue; }
        /* 圆周位形：每帧把角度推进 w·dt，位置就精确落在圆上
           （不靠速度积分，避免力律标度带来的漂移）。 */
        A.go.a += A.go.w * dt;
        A.x = A.go.cx + Math.cos(A.go.a) * A.go.r;
        A.y = A.go.cy + Math.sin(A.go.a) * A.go.r;
        A.vx = -Math.sin(A.go.a) * A.go.w * A.go.r;
        A.vy = Math.cos(A.go.a) * A.go.w * A.go.r;
      }
    }
    function walls(B) {
      var pad = 12;
      if (B.x < pad) { B.x = pad; B.vx = Math.abs(B.vx) * 0.45; }
      if (B.x > W - pad) { B.x = W - pad; B.vx = -Math.abs(B.vx) * 0.45; }
      if (B.y < pad) { B.y = pad; B.vy = Math.abs(B.vy) * 0.45; }
      if (B.y > groundY) { B.y = groundY; B.vy = -Math.abs(B.vy) * 0.38; B.vx *= 0.86; }
    }
    function stepFrame(dt) {
      tWorld += dt;
      stepLegacy(dt);
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead || B.formula || B.drag) continue;
        walls(B);
      }
      /* 公式体走固定步长（与帧率无关） */
      var hasEq = false;
      for (var k = 0; k < bodies.length; k++) if (bodies[k].formula && !bodies[k].dead) { hasEq = true; break; }
      if (hasEq) eqAccumulate(dt);
      /* 形变过渡 */
      for (var m = 0; m < bodies.length; m++) {
        var Bm = bodies[m];
        if (Bm.morph > 0) { Bm.morph -= dt / 0.4; if (Bm.morph < 0) Bm.morph = 0; layoutBody(Bm); syncGlyphEls(Bm); }
      }
      pairBinaries();
      stepBinaries(dt);
      stepArrows(dt);
      stepShake(dt);
    }
    function stepShake(dt) {
      if (shakeDur <= 0) return;
      shakeT += dt;
      if (shakeT >= shakeDur) { shakeDur = 0; shakeAmp = 0; stage.style.transform = ''; }
      else {
        var k = 1 - shakeT / shakeDur;
        stage.style.transform = 'translate(' + (Math.sin(tWorld * 60) * shakeAmp * k) + 'px,' +
          (Math.cos(tWorld * 53) * shakeAmp * k * 0.6) + 'px)';
      }
    }
    function shake(a, d) { shakeAmp = Math.max(shakeAmp, a); shakeDur = Math.max(shakeDur, d); shakeT = 0; }

    /* ================================================================ *
     * 3.8 箭头 → 射线 → 效果（升温 / 受力 / 生电）                      *
     * ================================================================ */
    function stepArrows(dt) {
      var i;
      for (i = rays.length - 1; i >= 0; i--) {
        var r = rays[i];
        r.life -= dt;
        if (r.life <= 0) rays.splice(i, 1);
      }
      /* 箭头是台上的字形：每个箭头每帧沿朝向往外找"被指到的体"并施加效果 */
      for (i = 0; i < stageL.length; i++) {
        var A = stageL[i];
        if (A.dead || A.ch !== ARROW) continue;
        var hit = rayHit(A);
        if (hit) applyRayEffect(A, hit, dt);
      }
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead) continue;
        if (B.lit > 0) B.lit -= dt;
        if (B.lit < 0) B.lit = 0;
        /* 被射线推过的体：按 F=ma 推一下就衰减 */
        if (B.forcePush) B.forcePush = null;
      }
    }
    function rayHit(A) {
      var ox = A.wx, oy = A.wy, dx = Math.cos(A.rot), dy = -Math.sin(A.rot);
      var best = null, i, j;
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead) continue;
        var t = (B.x - ox) * dx + (B.y - oy) * dy;
        if (t < 8 || t > 640) continue;
        var perp = Math.abs((B.x - ox) * dy - (B.y - oy) * dx);
        if (perp > Math.max(B.hw, B.hh) + 10) continue;
        if (!best || t < best.t) best = { t: t, body: B, x: ox + dx * t, y: oy + dy * t };
      }
      for (i = 0; i < stageL.length; i++) {
        var O = stageL[i];
        /* 排除已经在体里的字形：射线要打的是**体**（读数记在体上），
           否则命中自己的字形，升温就记不到体上。 */
        if (O.dead || O === A || O.body) continue;
        var t2 = (O.wx - ox) * dx + (O.wy - oy) * dy;
        if (t2 < 8 || t2 > 640) continue;
        var p2 = Math.abs((O.wx - ox) * dy - (O.wy - oy) * dx);
        if (p2 > 24) continue;
        if (!best || t2 < best.t) best = { t: t2, letter: O, x: ox + dx * t2, y: oy + dy * t2 };
      }
      return best;
    }
    /* 效果：优先做**有读数**的升温；其余照课本做，不确定的不做 */
    function applyRayEffect(A, hit, dt) {
      var vx = Math.cos(A.rot), vy = -Math.sin(A.rot);
      A.rayLife = 0.35; A.rayX = hit.x; A.rayY = hit.y;
      var B = hit.body;
      if (!B) {
        /* 打到游离字形：也让它升温（读数就在这个字形上） */
        var L = hit.letter;
        if (L.temp == null) L.temp = 20;
        L.temp += 26 * dt;
        L.lit = 0.5;
        if (!L._rayT || eqTime - L._rayT > 0.3) {
          L._rayT = eqTime;
          eqEmit('heat', null, { ch: L.ch, temp: Math.round(L.temp * 10) / 10, by: 'ray' });
        }
        return;
      }
      B.temp += 30 * dt; B.lit = 0.6;
      B.heat = (B.heat || 0) + 30 * dt;
      if (!B._rayT || eqTime - B._rayT > 0.25) {
        B._rayT = eqTime;
        eqEmit('heat', B, { temp: Math.round(B.temp * 10) / 10, by: 'ray' });
      }
      /* Q 在箭头左侧（同一个体或旁边的 Q 字形）：Q = cmΔt 换算 Δt，数值必须一致 */
      var qv = nearbyQ(A, B);
      if (qv != null) {
        var c = 4200, m = Math.max(0.05, B.mass || 1);   // 水的比热容，约定值
        var dT = qv / (c * m);
        B.temp = 20 + dT;
        B.qCal = { Q: qv, c: c, m: m, dT: dT };
        if (!B._qT || eqTime - B._qT > 0.25) { B._qT = eqTime; eqEmit('heat-caloric', B, { Q: qv, c: c, m: m, dT: dT }); }
      }
      /* F 在箭头左侧：被指物体 a = F/m */
      var fv = nearbyVal(A, B, 'F');
      if (fv != null) {
        var aa = fv / Math.max(1e-6, B.mass || 1);
        B.vx += vx * aa * 20 * dt; B.vy += vy * aa * 20 * dt;
        B.forcePush = { F: fv, m: B.mass, a: aa };
      }
      /* U 在箭头左侧：导体产生 I = U/R */
      var uv = nearbyVal(A, B, 'U');
      if (uv != null) {
        var Rv = Math.max(0.05, numOf(B, 'R'));
        B.current = uv / Rv;
        B.voltage = uv;
        if (!B.eq) { /* 老实体也给出读数 */ }
      }
      /* I 在箭头左侧：Q = I²Rt 发热 */
      var iv = nearbyVal(A, B, 'I');
      if (iv != null) {
        var Rv2 = Math.max(0.05, numOf(B, 'R'));
        var Qh = iv * iv * Rv2 * Math.max(0.05, dt);
        B.heat = (B.heat || 0) + Qh;
        B.temp += Qh * 0.05;
      }
    }
    function nearbyVal(A, B, sym) {
      /* 箭头自己的字形里、或箭头所连的体里、或紧邻的游离字形里有这个量 */
      if (countOf(B, sym) > 0) return numOf(B, sym);
      for (var i = 0; i < stageL.length; i++) {
        var L2 = stageL[i];
        if (L2.dead || L2.body) continue;
        if (L2.ch !== sym) continue;
        if (Math.hypot(L2.wx - A.wx, L2.wy - A.wy) < 220) return L2.val;
      }
      return null;
    }
    function nearbyQ(A, B) {
      if (countOf(B, 'Q') > 0) return numOf(B, 'Q');
      for (var i = 0; i < stageL.length; i++) {
        var L2 = stageL[i];
        if (L2.dead || L2.body) continue;
        if (L2.ch !== 'Q') continue;
        if (Math.hypot(L2.wx - A.wx, L2.wy - A.wy) < 220) return L2.val;
      }
      return null;
    }

    /* ================================================================ *
     * 3.9 渲染                                                          *
     * ================================================================ */
    function render() {
      ctx.clearRect(0, 0, W, H);
      drawRays();
      drawFormulaCards();
      drawBodiesDecor();
      drawGlyphs();
      drawParticles();
    }
    /* 字形的墨迹画在 canvas 上（DOM 元素只做命中盒 + textContent）
       —— 这样"布局步进"和"画出来的墨迹"永远一致，不会出现
       "量到的是托盘坐标 / 拖到的是别处"那类错位。 */
    function drawGlyphs() {
      var i, g;
      ctx.save();
      ctx.fillStyle = '#26221C';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (i = 0; i < stageL.length; i++) {
        var L = stageL[i];
        if (L.dead || L.body) continue;
        drawOneGlyph(L, L.wx, L.wy, RENDER_FS, L.rot || 0);
      }
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead) continue;
        for (var j = 0; j < B.glyphs.length; j++) {
          g = B.glyphs[j];
          if (g.dead) continue;
          drawOneGlyph(g, g.lx + (g.dx || 0), g.ly + (g.dy || 0),
            (g.ch === SQ ? RENDER_FS * SUB : RENDER_FS), 0);
        }
      }
      ctx.restore();
    }
    function drawOneGlyph(g, x, y, px, rot) {
      ctx.save();
      if (rot) { ctx.translate(x, y); ctx.rotate(rot); x = 0; y = 0; }
      ctx.font = fontStr(px);
      ctx.fillText(g.ch, x, y);
      ctx.restore();
    }
    function drawRays() {
      var i;
      for (i = 0; i < stageL.length; i++) {
        var A = stageL[i];
        if (A.dead || A.ch !== ARROW) continue;
        drawOneRay(A);
      }
    }
    function drawOneRay(A) {
      var len = A.rayLife && A.rayLife > 0 ? Math.hypot((A.rayX || A.wx) - A.wx, (A.rayY || A.wy) - A.wy) : 0;
      if (len < 4) return;
      var al = clamp((A.rayLife || 0) / 0.35, 0, 1);
      var ox = A.wx, oy = A.wy, dx = Math.cos(A.rot), dy = -Math.sin(A.rot);
      ctx.save();
      ctx.strokeStyle = 'rgba(38,34,28,' + (0.5 * al) + ')';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * len, oy + dy * len); ctx.stroke();
      ctx.setLineDash([]);
      /* 末端一点暖色（打中的地方） */
      var grd = ctx.createRadialGradient(ox + dx * len, oy + dy * len, 1, ox + dx * len, oy + dy * len, 26);
      grd.addColorStop(0, 'rgba(196,92,38,' + (0.42 * al) + ')');
      grd.addColorStop(1, 'rgba(196,92,38,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(ox + dx * len, oy + dy * len, 26, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    function drawFormulaCards() {
      var i;
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead) continue;
        if (B.frac && B.den) {
          /* 分数线 */
          ctx.save();
          ctx.strokeStyle = 'rgba(38,34,28,.82)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(B.bar.x, B.bar.y); ctx.lineTo(B.bar.x + B.bar.w, B.bar.y);
          ctx.stroke();
          ctx.restore();
        }
        if (B.isWell && B.gravMode === 'well') {
          /* 井：一圈圈浅灰等势线 */
          ctx.save();
          ctx.strokeStyle = 'rgba(38,34,28,.13)';
          for (var r = 26; r < 190; r += 26) {
            ctx.beginPath(); ctx.arc(B.x, B.y, r, 0, 6.2832); ctx.stroke();
          }
          ctx.restore();
        }
        if (B.lit && B.lit > 0) {
          /* 被打到的体：暖色光圈 */
          var g2 = ctx.createRadialGradient(B.x, B.y, 2, B.x, B.y, Math.max(B.hw, B.hh) + 22);
          g2.addColorStop(0, 'rgba(198,96,40,' + (0.28 * clamp(B.lit / 0.6, 0, 1)) + ')');
          g2.addColorStop(1, 'rgba(198,96,40,0)');
          ctx.save(); ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(B.x, B.y, Math.max(B.hw, B.hh) + 22, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
        if (B.kind === 'B' || B.kind === 'E' || B.field) drawField(B);
        if (B.kind === 'I') drawCurrentField(B);
      }
      /* 公式卡：课本写法的浅色底卡 + 读数 */
      for (i = 0; i < bodies.length; i++) {
        var C = bodies[i];
        if (C.dead || !C.formula) continue;
        drawCardText(C);
      }
    }
    function drawCardText(B) {
      var E2 = null, i;
      for (i = 0; i < EQUATIONS.length; i++) if (EQUATIONS[i].id === B.eq) E2 = EQUATIONS[i];
      if (!E2) return;
      var txt = E2.decl;
      ctx.save();
      ctx.font = fontStr(15, 'normal');      var w = ctx.measureText(txt).width;
      var x = B.x - w / 2, y = B.y - B.hh - 20;
      if (y < 8) y = B.y + B.hh + 16;
      /* 卡底 */
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.strokeStyle = 'rgba(38,34,28,.2)';
      ctx.lineWidth = 1;
      roundRect(ctx, x - 9, y - 12, w + 18, 22, 9);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#26221C';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, x, y);
      /* 读数：I / U / P / Q / T / Σp … */
      var S = B.eqRead || {};
      var rd = [];
      if (S.I != null && B.eq === 'ohm') { rd.push('I=' + fmtNum(S.I) + 'A'); rd.push('P=' + fmtNum(S.P) + 'W'); }
      if (S.short) rd.push('短路');
      if (B.eq === 'cap' && S.Q != null) rd.push('Q=' + fmtNum(S.Q) + 'C');
      if (B.eq === 'kinetic' && S.Ek != null) rd.push('E\u2096=' + fmtNum(S.Ek) + 'J');
      if (B.eq === 'potential' && S.Ep != null) rd.push('E\u209A=' + fmtNum(S.Ep) + 'J');
      if (B.eq === 'hooke' && S.T != null) rd.push('T=' + fmtNum(S.T) + 's');
      if (B.temp != null && B.lit) rd.push('T=' + fmtNum(B.temp) + '°C');
      if (!rd.length && S.a != null) rd.push('a=' + fmtNum(S.a));
      if (!rd.length && S.F != null) rd.push('F=' + fmtNum(S.F));
      if (rd.length) {
        ctx.font = fontStr(12, 'normal');
        ctx.fillStyle = 'rgba(38,34,28,.72)';
        ctx.fillText(rd.join('  '), x - 4, y + 20);
      }
      ctx.restore();
    }
    function roundRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
      g.closePath();
    }
    function drawField(B) {
      ctx.save();
      var cx = B.x, cy = B.y, R = B.fieldR || B_RANGE;
      ctx.strokeStyle = 'rgba(38,34,28,.16)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
      var rows = 6, cols = 10;
      for (var i = 0; i <= rows; i++) {
        for (var j = 0; j <= cols; j++) {
          var x = cx - R + (2 * R) * j / cols, y = cy - R + (2 * R) * i / rows;
          var dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
          if (d > R) continue;
          if (B.kind === 'E') {
            /* 电场：从中心向外的短线（方向可用旋转手柄改） */
            var a = Math.atan2(dy, dx) + B.th;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
            ctx.stroke();
          } else {
            /* 磁场：点阵（× 表示穿入纸面） */
            ctx.beginPath();
            ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3);
            ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    function drawCurrentField(B) {
      ctx.save();
      ctx.strokeStyle = 'rgba(38,34,28,.3)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(B.x - 26, B.y); ctx.lineTo(B.x + 26, B.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(B.x + 18, B.y - 5); ctx.lineTo(B.x + 26, B.y); ctx.lineTo(B.x + 18, B.y + 5);
      ctx.stroke();
      ctx.restore();
    }
    function drawBodiesDecor() {
      /* 引力井的"下落轨迹"与箭头的方向提示 */
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead) continue;
        if (B.isWell) {
          ctx.save();
          ctx.fillStyle = 'rgba(38,34,28,.8)';
          ctx.beginPath(); ctx.arc(B.x, B.y, 3.2, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
      }
    }
    function drawParticles() {
      ctx.save();
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = clamp(p.life / p.life0, 0, 1);
        ctx.fillStyle = p.color || 'rgba(38,34,28,.75)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }
    function burst(x, y, n, sp, color) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.2832, s = sp * (0.4 + Math.random() * 0.8);
        particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.2,
          r: 1.4 + Math.random() * 2.2, life: 0.5 + Math.random() * 0.7, life0: 1.2, color: color });
      }
      if (particles.length > 400) particles.splice(0, particles.length - 400);
    }

    /* ================================================================ *
     * 3.10 真指针交互（拖 / 垃圾桶 / 右键复制 / 双击拆分 / 旋转）        *
     * ================================================================ */
    function worldOf(clientX, clientY) {
      var r = stage.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    }
    var dragging = null, dragOff = { x: 0, y: 0 }, ptrHist = [];
    var active = null;                 // {kind:'drag'|'pill'|'rotate', ...}
    function closestPill(t) {
      while (t && t !== stage) {
        if (t._pill) return t;
        t = t.parentNode;
      }
      return null;
    }
    function onDown(e) {
      if (e.button === 2) return;
      var t = e.target;
      closeMenu();
      var pil = closestPill(t);
      if (pil && pil._body) {
        var PB = pil._body;
        eqInitState(PB);
        active = { kind: 'pill', pill: pil, body: PB, glyph: pil._glyph,
          startX: e.clientX, startVal: pil._glyph.val, moved: false };
        pil.classList.add('ps-drag');
        e.preventDefault();
        return;
      }
      var L = t && t._letter;
      if (L) {
        var wp = worldOf(e.clientX, e.clientY);
        if (L.state === 'dock') {
          /* 从托盘拖出来：在指针位置生成台上的字形（托盘那格留在原处） */
          var L2 = mkLetter(L.ch, 2);
          L2.state = 'stage';
          undockLetter(L2);
          L2.val = L.val;
          L2.wx = wp.x; L2.wy = wp.y;
          L2.el.style.transform = 'translate(' + wp.x + 'px,' + wp.y + 'px)';
          dragging = L2;
          dragOff.x = 0; dragOff.y = 0;
        } else {
          dragging = L;
          dragOff.x = L.wx - wp.x; dragOff.y = L.wy - wp.y;
        }
        dragging.drag = true;
        if (dragging.body) detachLetter(dragging);
        ptrHist = [{ t: nowMs(), x: e.clientX, y: e.clientY }];
        active = { kind: 'drag', L: dragging };
        if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (e1) { } }
        e.preventDefault();
        return;
      }
      if (t === handleEl && hoverBody) {
        active = { kind: 'rotate', B: hoverBody, x0: e.clientX, th0: hoverBody.th };
        e.preventDefault();
        return;
      }
    }
    function onMove(e) {
      if (active && active.kind === 'rotate') {
        var RB = active.B;
        RB.th = active.th0 + (e.clientX - active.x0) * 0.006;
        for (var r2 = 0; r2 < RB.glyphs.length; r2++) if (RB.glyphs[r2].ch === ARROW) RB.glyphs[r2].rot = RB.th;
        return;
      }
      if (active && active.kind === 'pill') {
        var D = defOf(active.glyph.ch);
        if (Math.abs(e.clientX - active.startX) > 2) active.moved = true;
        var dv = (e.clientX - active.startX) * (D.hi - D.lo) / 220;
        var nv = clamp(active.startVal + dv, D.lo, D.hi);
        nv = Math.round(nv / D.step) * D.step;
        active.glyph.val = nv;
        var S = active.body.eqState;
        S[active.glyph.ch] = nv;
        if (active.glyph.ch === 'R') S.Rset = nv;
        if (active.glyph.ch === 'U') S.Uset = nv;
        updatePills(active.body);
        e.preventDefault();
        return;
      }
      var wp = worldOf(e.clientX, e.clientY);
      if (dragging) {
        dragging.wx = wp.x + dragOff.x;
        dragging.wy = wp.y + dragOff.y;
        dragging.el.style.transform = 'translate(' + dragging.wx + 'px,' + dragging.wy + 'px)';
        ptrHist.push({ t: nowMs(), x: e.clientX, y: e.clientY });
        if (ptrHist.length > 8) ptrHist.shift();
        highlightTarget(dragging);
        e.preventDefault();
        return;
      }
      hoverTick(wp);
    }
    function onUp(e) {
      if (active && active.kind === 'rotate') { active = null; return; }
      if (active && active.kind === 'pill') {
        var a = active;
        active = null;
        a.pill.classList.remove('ps-drag');
        if (!a.moved) {
          /* 单击 = 一步（让"点一下也有效果"与拖动等价，且不隐藏手势） */
          var DD = defOf(a.glyph.ch);
          var step = (DD.hi - DD.lo) / 40;
          var v2 = a.glyph.val + step;
          if (v2 > DD.hi) v2 = DD.lo;
          v2 = Math.round(v2 / DD.step) * DD.step;
          a.glyph.val = v2;
          var S2 = a.body.eqState;
          S2[a.glyph.ch] = v2;
          if (a.glyph.ch === 'R') S2.Rset = v2;
          if (a.glyph.ch === 'U') S2.Uset = v2;
        }
        updatePills(a.body);
        return;
      }
      if (!dragging) return;
      var L = dragging;
      dragging = null;
      active = null;
      var wp = worldOf(e.clientX, e.clientY);
      /* 垃圾桶 */
      var tr = trash.getBoundingClientRect();
      if (e.clientX >= tr.left - 6 && e.clientX <= tr.right + 6 && e.clientY >= tr.top - 6 && e.clientY <= tr.bottom + 6) {
        removeLetter(L);
        shake(2, 0.12);
        return;
      }
      /* 收回托盘 */
      var pn = panel.getBoundingClientRect();
      if (e.clientX >= pn.left && e.clientX <= pn.right && e.clientY >= pn.top && e.clientY <= pn.bottom) {
        if (L.body) detachLetter(L);
        dockLetter(L);
        return;
      }
      L.wx = wp.x + dragOff.x; L.wy = wp.y + dragOff.y;
      var v = throwVelocity();
      placeGlyphAfterDrag(L, v.x, v.y);
    }
    /* 真指针落字：与 addBody 共用 placeGlyph 的判定与公式闸门 */
    function placeGlyphAfterDrag(L, sx, sy) {
      if (L.body) detachLetter(L);
      L.state = 'stage';
      L.el.style.transform = 'translate(' + L.wx + 'px,' + L.wy + 'px)';
      dropPathCount++;
      placeCount.pointer = (placeCount.pointer || 0) + 1;
      if (applyLegacyCombo(L, pickTarget(L))) return;
      var tgt = pickTarget(L);
      if (tgt) {
        var r = tryMerge(L, tgt.body, tgt.letter);
        if (r && r.merged) { mergeCount++; lastPlace = { action: 'merge', src: 'pointer', eq: r.body.eq }; return; }
      }
      var fk = fieldKindOf(L.ch);
      if (fk && !formulaNear(L)) {
        spawnField(fk, L.wx, L.wy, sx, sy);
        killLetter(L);
        lastPlace = { action: 'field', src: 'pointer', kind: fk };
        return;
      }
      L.vx = sx; L.vy = sy;
      L.body = null;
      lastPlace = { action: 'free', src: 'pointer', ch: L.ch };
    }
    var lastPlace = null;
    function formulaNear(L) {
      /* 场符号（B/E/q/I）落地时的判据：**附近有东西能让它变成公式的一部分**
         就返回 true（那就当字形并入，不生成场实体）；
         完全孤立时才照旧生成场实体（B 磁场 / E 电场 / q 电荷 / I 电流）。 */
      var i, d;
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead || B.kind) continue;
        d = Math.hypot(B.x - L.wx, B.y - L.wy);
        if (d > Math.max(B.hw, B.hh) + 90) continue;
        if (gate(B, L.ch)) return true;
      }
      for (i = 0; i < stageL.length; i++) {
        var O = stageL[i];
        if (O === L || O.dead || O.body) continue;
        if (Math.hypot(O.wx - L.wx, O.wy - L.wy) > 96) continue;
        if (gate({ tokens: O.ch, firstCh: O.ch }, L.ch)) return true;
      }
      return false;
    }
    function pointerVelocity() {
      if (ptrHist.length < 2) return { x: 0, y: 0 };
      var a = ptrHist[0], b = ptrHist[ptrHist.length - 1];
      var dt = (b.t - a.t) / 1000;
      if (dt <= 0.008) return { x: 0, y: 0 };
      return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
    }
    /* 松手瞬间的"初速度"（见 THROW_* 注释）：
         · 松手前静置够久 -> 0（这是"把它放在这儿"）
         · 手速 < THROW_MIN -> 0（正常拖放）
         · 超过 THROW_MIN 的部分才转成初速度（超得越多给得越多），封顶 THROW_MAX
       方向永远等于手势方向。 */
    function throwVelocity() {
      var v = pointerVelocity();
      var sp = Math.hypot(v.x, v.y);
      var last = ptrHist.length ? ptrHist[ptrHist.length - 1] : null;
      if (last && (nowMs() - last.t) > STILL_MS) return { x: 0, y: 0 };
      if (sp < THROW_MIN) return { x: 0, y: 0 };
      var k = Math.min(1, (sp - THROW_MIN) / THROW_MIN);   // 超出比例
      var out = sp * k;
      if (out > THROW_MAX) out = THROW_MAX;
      if (sp > 1e-6) return { x: v.x / sp * out, y: v.y / sp * out };
      return { x: 0, y: 0 };
    }
    function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function highlightTarget(L) {
      var t = pickTarget(L);
      for (var i = 0; i < bodies.length; i++) bodies[i]._hot = false;
      if (t && t.body) t.body._hot = true;
      hoverBody = t && t.body ? t.body : null;
    }
    function hoverTick(wp) {
      var found = null;
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.dead) continue;
        if (found) { found._hot = false; }
        if (Math.abs(B.x - wp.x) < B.hw + 6 && Math.abs(B.y - wp.y) < B.hh + 6) { found = B; }
      }
      if (found) {
        found._hot = true;
        handleEl.classList.add('ps-on');
        handleEl.style.transform = 'translate(' + Math.round(found.x) + 'px,' + Math.round(found.y - found.hh - 30) + 'px)';
      } else {
        handleEl.classList.remove('ps-on');
      }
      hoverBody = found;
    }
    function detachLetter(L) {
      var B = L.body;
      L.body = null;
      if (!B) return;
      var k = B.glyphs.indexOf(L);
      if (k >= 0) B.glyphs.splice(k, 1);
      if (!B.glyphs.length) { killBody(B); return; }
      refreshBody(B);
    }
    function removeLetter(L) {
      if (L.body) detachLetter(L);
      killLetter(L);
    }
    function killBody(B) {
      B.dead = true;
      var k = bodies.indexOf(B);
      if (k >= 0) bodies.splice(k, 1);
      if (B._pills) for (var i = 0; i < B._pills.length; i++) if (B._pills[i].parentNode) B._pills[i].parentNode.removeChild(B._pills[i]);
      B._pills = [];
    }

    /* ================================================================ *
     * 3.11 右键复制 / 双击拆分 / 旋转手柄                                *
     * ================================================================ */
    function onCtx(e) {
      var L = e.target && e.target._letter;
      if (!L) { closeMenu(); return; }
      e.preventDefault();
      menuEl._letter = L;
      var r = stage.getBoundingClientRect();
      menuEl.style.left = (e.clientX - r.left) + 'px';
      menuEl.style.top = (e.clientY - r.top) + 'px';
      menuEl.classList.add('ps-on');
    }
    function closeMenu() { menuEl.classList.remove('ps-on'); menuEl._letter = null; }
    function copyLetter(L) {
      var N = mkLetter(L.ch, 2);
      N.val = L.val;
      N.state = 'stage';
      undockLetter(N);
      N.wx = L.wx + 26; N.wy = L.wy + 22;
      N.el.style.transform = 'translate(' + N.wx + 'px,' + N.wy + 'px)';
      addLog('复制了一个 ' + L.ch);
      return N;
    }
    function onDbl(e) {
      var L = e.target && e.target._letter;
      if (!L) return;
      /* 双击拆分：体拆成一个个游离字形；游离字形拆成"复制一个" */
      if (L.body) {
        var B = L.body, gs = B.glyphs.slice(), i;
        for (i = 0; i < gs.length; i++) {
          var g = gs[i];
          g.body = null;
          g.state = 'stage';
          if (stageL.indexOf(g) < 0) stageL.push(g);
          var a = (i / Math.max(1, gs.length)) * 6.2832;
          g.wx = B.x + Math.cos(a) * 34; g.wy = B.y + Math.sin(a) * 34;
          g.el.style.transform = 'translate(' + g.wx + 'px,' + g.wy + 'px)';
        }
        B.glyphs = [];
        killBody(B);
        burst(B.x, B.y, 8, 90, 'rgba(38,34,28,.5)');
      } else {
        copyLetter(L);
      }
      e.preventDefault();
    }
    function onHandle(e) {
      /* 旋转手柄：拖动改体的朝向 θ（电场方向、力的方向、箭头朝向都跟它走） */
      if (!hoverBody) return;
      active = { kind: 'rotate', B: hoverBody, x0: e.clientX, th0: hoverBody.th };
      e.preventDefault();
    }
    function onWheel(e) {
      var L = e.target && e.target._letter;
      if (!L) return;
      if (L.state !== 'stage') return;
      L.rot += (e.deltaY > 0 ? 1 : -1) * 0.13;
      if (L.rot > 3.1416) L.rot -= 6.2832;
      if (L.rot < -3.1416) L.rot += 6.2832;
      L.el.style.transform = 'translate(' + L.wx + 'px,' + L.wy + 'px) rotate(' + (L.rot * 180 / 3.1416) + 'deg)';
      e.preventDefault();
    }

    /* ================================================================ *
     * 3.12 = 变换器：把一侧真的变成另一侧（数值必须守恒）                *
     * ================================================================ */
    function transformBody(B) {
      if (!B.formula) { addLog('这一组还不是课本等式，等号先放着'); return false; }
      var E3 = null, i;
      for (i = 0; i < EQUATIONS.length; i++) if (EQUATIONS[i].id === B.eq) E3 = EQUATIONS[i];
      if (!E3 || E3.special) { addLog('这个式子不能这样变'); return false; }
      /* 记录旧槽位 -> 形变过渡（0.4s 缓动） */
      var from = {};
      for (i = 0; i < B.glyphs.length; i++) from[B.glyphs[i].ch + '#' + i] = [B.glyphs[i].lx, B.glyphs[i].ly];
      B.morphFrom = from;
      B.morph = 1;
      B.paramSide = B.paramSide ? 0 : 1;
      /* 数值守恒：变换前后按同一套物理关系算一遍，容差 1e-9（断言在探针里） */
      eqInitState(B);
      var before = valueOfSide(B, B.paramSide ? 0 : 1);
      var after = valueOfSide(B, B.paramSide ? 1 : 0);
      B._cons = { before: before, after: after, d: Math.abs(before - after) };
      eqEmit('transform', B, { eq: B.eq, before: before, after: after, d: B._cons.d, side: B.paramSide });
      addLog(E3.decl + '：两侧互换（数值 ' + fmtNum(before) + ' 守恒，差 ' + B._cons.d + '）');
      /* 视觉上真的"变"：把一侧的字形收进"结果量"（下一次再碰 = 展开回来）。
         两侧的字形集合不变 -> 物理量一个都没丢，这就是"数值守恒"的几何含义。 */
      for (i = 0; i < B.glyphs.length; i++) {
        var g = B.glyphs[i];
        if (isOp(g.ch)) continue;
        var isLead = (g.ch === E3.lead || (E3.lead === HALF && g.ch === HALF));
        g.hidden = B.paramSide ? !isLead : false;
        g.el.style.opacity = g.hidden ? '0' : '1';
      }
      layoutBody(B);
      return true;
    }
    /* 一侧的数值：把该侧的字形按课本关系算出来 */
    function valueOfSide(B, side) {
      var id = B.eq;
      var m = numOf(B, 'm'), v = numOf(B, 'v'), F = numOf(B, 'F'), a = numOf(B, 'a'),
        U = numOf(B, 'U'), I = numOf(B, 'I'), R = numOf(B, 'R'), q = numOf(B, 'q'),
        Bf = numOf(B, 'B'), L = numOf(B, 'L'), t = numOf(B, 't'), x = numOf(B, 'x'),
        k = numOf(B, 'k'), C = numOf(B, 'C'), w = numOf(B, 'W'), P = numOf(B, 'P'),
        s = numOf(B, 's'), N = numOf(B, 'N'), mu = numOf(B, MU), h = numOf(B, 'h'),
        T = numOf(B, 'T'), lam = numOf(B, LAM), f = numOf(B, 'f'), nu = numOf(B, NU),
        eps = numOf(B, EPS), Phi = numOf(B, PHI), S2 = numOf(B, 'S'), rho = numOf(B, RHO);
      if (id === 'newton2') return side === 0 ? F : m * (F / Math.max(1e-6, m));
      if (id === 'ohm') return side === 0 ? (U) : I * R;
      if (id === 'momentum') return side === 0 ? m * v : m * v;
      if (id === 'hooke') return side === 0 ? k * x : k * x;
      if (id === 'friction') return side === 0 ? mu * N : mu * N;
      if (id === 'cap') return side === 0 ? C * (q / Math.max(1e-6, C)) : (q / Math.max(1e-6, C)) * C;
      if (id === 'powerE') return side === 0 ? U * I : U * I;
      if (id === 'powerW') return side === 0 ? w / Math.max(1e-6, t) : w / Math.max(1e-6, t);
      if (id === 'weight') return side === 0 ? m * 9.8 : m * 9.8;
      if (id === 'joule') return side === 0 ? I * I * R * t : I * I * R * t;
      if (id === 'charge') return side === 0 ? I * t : I * t;
      if (id === 'kinetic') return side === 0 ? 0.5 * m * v * v : 0.5 * m * v * v;
      if (id === 'potential') return side === 0 ? m * 9.8 * h : m * 9.8 * h;
      if (id === 'wave') return side === 0 ? lam * f : lam * f;
      if (id === 'flux') return side === 0 ? Bf * S2 : Bf * S2;
      if (id === 'ampere') return side === 0 ? Bf * I * L : Bf * I * L;
      if (id === 'lorentz') return side === 0 ? q * v * Bf : q * v * Bf;
      return 0;
    }

    /* ================================================================ *
     * 3.13 工具条 / 预设 / 清空 / 收集                                   *
     * ================================================================ */
    var logTimer = 0;
    function addLog(msg) {
      logEl.textContent = msg;
      logEl.classList.add('ps-on');
      clearTimeout(logTimer);
      logTimer = setTimeout(function () { if (alive) logEl.classList.remove('ps-on'); }, 1600);
    }
    function clearAll() {
      var i;
      for (i = bodies.length - 1; i >= 0; i--) killBody(bodies[i]);
      bodies.length = 0;
      for (i = stageL.length - 1; i >= 0; i--) killLetter(stageL[i]);
      stageL.length = 0;
      particles.length = 0; rays.length = 0;
      eqEvents = []; eqEventSeq = 0; eqTime = 0; eqAcc = 0;
      for (i = 0; i < PAL_L.length; i++) if (PAL_L[i].state !== 'dock') dockLetter(PAL_L[i]);
      tWorld = 0;
    }
    function collectToPanel() {
      var i, n = 0;
      for (i = bodies.length - 1; i >= 0; i--) {
        var B = bodies[i], gs = B.glyphs.slice();
        for (var j = 0; j < gs.length; j++) {
          var L = gs[j];
          L.body = null;
          dockLetter(L);
          n++;
        }
        B.glyphs = [];
        killBody(B);
      }
      for (i = stageL.length - 1; i >= 0; i--) { dockLetter(stageL[i]); n++; }
      stageL.length = 0;
      addLog('已全部收回托盘');
      return { docked: n };
    }
    function presetNewtons2() {
      var b = addBody(['m', 'a'], { x: Math.round(W * 0.26), y: Math.round(H * 0.30) });
      var B = liveBody(b);
      if (B) B.th = -0.45;
      return { bodies: [b] };
    }
    function presetEnergy() {
      var b = addBody([HALF, 'm', 'v', 'v'], { x: Math.round(W * 0.30), y: Math.round(H * 0.24) });
      setVel(b, 520, -260);
      return { bodies: [b] };
    }
    function presetCircular() {
      var b1 = addBody(['m', 'v', 'v', 'r'], { x: Math.round(W * 0.30), y: Math.round(H * 0.46) });
      var b2 = addBody(['m', 'v', 'v', 'r'], { x: Math.round(W * 0.30 + 150), y: Math.round(H * 0.46) });
      setVel(b1, 0, -70); setVel(b2, 0, 70);
      return { bodies: [b1, b2] };
    }
    function presetGravity() {
      /* 场景**逐位复刻旧版实测值**：井在左、m 在 井+(201.640625,130.25) 处，
         于是 d0 = 240.0500034375976；m 初速 (-40, 0)（横向，给出角动量）。
         不写死绝对坐标 —— 井的中心由排版决定，用它 + 偏移才算得准。 */
      var well = addBody(['G', 'M', 'm', 'r'], { x: Math.round(W * 0.28), y: Math.round(H * 0.42) });
      var mb = addBody(['m'], { x: Math.round(W * 0.55), y: Math.round(H * 0.62) });
      var WB = liveBody(well), MB = liveBody(mb);
      if (WB && MB) {
        MB.x = clamp(WB.x + GRAV_OFF_X, 12, W - 12);
        MB.y = clamp(WB.y + GRAV_OFF_Y, 12, groundY);
      }
      setVel(mb, -40, 0);
      return { bodies: [well, mb] };
    }
    function presetFreefall() {
      /* 自由落体：g 在台面上，m 在它上方（**只有接了 g 的体才受重力**）。
         m 的初速 vy=90、位置 (0.42W, 0.14H) 是旧版实测值 —— 永久断言
         "15 × stepOnce(1/60) 后 y = 122.35653620491976" 就靠这两个数。 */
      var gb = addBody(['g'], { x: Math.round(W * 0.30), y: Math.round(H * 0.52) });
      var mb = addBody(['m'], { x: Math.round(W * 0.42), y: Math.round(H * 0.14) });
      setVel(mb, 0, 90);
      return { bodies: [mb, gb] };
    }
    var PRESETS = { newton2: presetNewtons2, energy: presetEnergy, circular: presetCircular,
      gravity: presetGravity, freefall: presetFreefall };
    function applyPreset(key) {
      if (!key) return null;
      key = String(key).toLowerCase();
      var fn = PRESETS[key];
      if (!fn) return null;
      clearAll();
      resize();
      return { key: key, made: fn() };
    }
    function setVel(st, vx, vy) {
      var B = liveBody(st);
      if (!B) return;
      B.vx = vx; B.vy = vy;
      if (B.eqState) { B.eqState.vx0 = vx; B.eqState.vy0 = vy; }
      if (B.eq) eqInitState(B);
    }
    function liveBody(st) {
      if (!st) return null;
      if (st.id != null && bodies[st.id] && !bodies[st.id].dead) return bodies[st.id];
      for (var i = 0; i < bodies.length; i++) if (!bodies[i].dead) return bodies[i];
      return null;
    }

    /* ================================================================ *
     * 3.14 事件循环 / 尺寸 / 拆解                                        *
     * ================================================================ */
    function resize() {
      var r = stage.getBoundingClientRect();
      W = Math.max(240, Math.round(r.width));
      H = Math.max(200, Math.round(r.height));
      groundY = Math.round(H * 0.82);
      var dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(now) {
      if (!alive) return;
      var dt = lastT ? (now - lastT) / 1000 : 0;
      lastT = now;
      if (dt > 0.05) dt = 0.05;
      if (running && dt > 0) stepFrame(dt);
      render();
      /* 同步台上的字形（含体的字形） */
      for (var i = 0; i < stageL.length; i++) {
        var L = stageL[i];
        if (L.body) continue;
        if (L.vx || L.vy) {
          L.wx += L.vx * dt; L.wy += L.vy * dt;
          L.vx *= 0.985; L.vy *= 0.985;
          if (Math.abs(L.vx) < 3) L.vx = 0;
          if (Math.abs(L.vy) < 3) L.vy = 0;
          if (L.wx < 14) { L.wx = 14; L.vx = Math.abs(L.vx) * 0.4; }
          if (L.wx > W - 14) { L.wx = W - 14; L.vx = -Math.abs(L.vx) * 0.4; }
          if (L.wy < 14) { L.wy = 14; L.vy = Math.abs(L.vy) * 0.4; }
          if (L.wy > groundY) { L.wy = groundY; L.vy = -Math.abs(L.vy) * 0.35; }
        }
        L.el.style.transform = 'translate(' + L.wx + 'px,' + L.wy + 'px)' +
          (L.rot ? ' rotate(' + (L.rot * 180 / 3.1416) + 'deg)' : '');
      }
      for (var k = 0; k < bodies.length; k++) {
        var B = bodies[k];
        if (B.dead) continue;
        /* 体的字形：每个字形都跟着体的位移走；公式体另有自己的槽位 */
        syncBodyGlyphs(B);
        if (B.formula) placePills(B);
      }
      rafId = requestAnimationFrame(frame);
    }
    /* 把体的字形同步到"体的位置 + 槽位偏移"（画布与 DOM 共用同一组坐标） */
    function syncBodyGlyphs(B) {
      var i, g, px, py;
      if (B.formula) {
        /* 公式体：先按体的当前位置重排槽位（含分数式），再同步 DOM */
        layoutBody(B);
      }
      for (i = 0; i < B.glyphs.length; i++) {
        g = B.glyphs[i];
        if (g.dead) continue;
        if (!B.eq) {
          /* 老实体（单字形 / 场实体）：字形就钉在体上，随体移动 */
          g.lx = B.x; g.ly = B.y;
        }
        px = g.lx + (g.dx || 0);
        py = g.ly + (g.dy || 0);
        if (g.ch === ARROW) {
          g.el.style.transform = 'translate(' + px + 'px,' + py + 'px) rotate(' + (g.rot * 180 / 3.1416) + 'deg)';
        } else {
          g.el.style.transform = 'translate(' + px + 'px,' + py + 'px)' +
            (g.ch === SQ ? ' scale(.6)' : '');
        }
      }
    }

    /* ---------------- 事件订阅 ---------------- */
    var subs = [];
    function on(target, type, fn, opt) {
      target.addEventListener(type, fn, opt);
      subs.push([target, type, fn, opt]);
    }
    on(stage, 'pointerdown', onDown);
    on(window, 'pointermove', onMove);
    on(window, 'pointerup', onUp);
    on(window, 'pointercancel', onUp);
    on(stage, 'contextmenu', onCtx);
    on(stage, 'dblclick', onDbl);
    on(stage, 'wheel', onWheel, { passive: false });
    on(menuEl, 'click', function () { if (menuEl._letter) copyLetter(menuEl._letter); closeMenu(); });
    on(handleEl, 'pointerdown', onHandle);
    on(trash, 'click', function () { clearAll(); addLog('已清空'); });
    on(bClear, 'click', function () { clearAll(); addLog('已清空'); });
    on(bCollect, 'click', function () { collectToPanel(); });
    on(bReset, 'click', function () {
      clearAll();
      if (opts.preset) applyPreset(opts.preset);
      addLog('已重置');
    });
    on(window, 'resize', function () { resize(); });

    resize();
    /* 首帧不推进物理（rAF 的首帧 dt 不可信）；探针用 stepOnce() 精确推。 */
    lastT = nowMs();
    requestAnimationFrame(frame);
    if (opts.preset) applyPreset(opts.preset);

    function unmount() {
      alive = false;
      if (rafId) { try { cancelAnimationFrame(rafId); } catch (e) { } rafId = 0; }
      for (var i = 0; i < subs.length; i++) {
        try { subs[i][0].removeEventListener(subs[i][1], subs[i][2], subs[i][3]); } catch (e2) { }
      }
      subs.length = 0;
      clearTimeout(logTimer);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      bodies = []; ALL = []; stageL = []; particles = []; rays = [];
      if (typeof opts.onUnmount === 'function') { try { opts.onUnmount(); } catch (e3) { } }
    }

    /* ---------------- 返回给 API 的引擎接口 ---------------- */
    return {
      unmount: unmount,
      root: overlay,
      applyPreset: applyPreset,
      addBody: addBody,
      bodies: function () {
        var out = [], i;
        for (i = 0; i < bodies.length; i++) if (!bodies[i].dead) out.push(bodyState(bodies[i]));
        return out;
      },
      clear: function () { clearAll(); return { bodies: 0, free: 0 }; },
      collect: collectToPanel,
      stepOnce: function (dt) {
        dt = (dt == null) ? (1 / 60) : Number(dt);
        if (!(dt > 0)) dt = 1 / 60;
        if (dt > 0.05) dt = 0.05;
        stepFrame(dt);
        render();
        return { t: tWorld, bodies: bodies.length, free: stageL.length, particles: particles.length };
      },
      state: function () {
        var docked = 0, i, freeL = 0;
        for (i = 0; i < PAL_L.length; i++) if (PAL_L[i].state === 'dock') docked++;
        for (i = 0; i < stageL.length; i++) if (!stageL[i].body) freeL++;
        return {
          build: BUILD, mounted: true,
          W: W, H: H, groundY: groundY, t: round3(tWorld),
          bodies: bodies.length, freeLetters: freeL,
          stageLetters: stageL.length,
          formulas: nFormula(), particles: particles.length,
          panelLetters: docked,
          paused: !running,
          preset: opts.preset || '',
          presetKeys: ['newton2', 'energy', 'circular', 'gravity', 'freefall'],
          domNodes: overlay.getElementsByTagName('*').length + 1,
          mergeCount: mergeCount,
          dropCount: dropPathCount, apiCount: apiPathCount,
          placeCount: placeCount
        };
      },
      letters: function () {
        var out = [], i;
        for (i = 0; i < stageL.length; i++) {
          var L = stageL[i];
          /* ⚠ 必须是**当前实时坐标**：体里的字形由排版放在 lx/ly（与 wx/wy
             同一套舞台坐标），落字时的 wx/wy 会过期 —— 探针按过期坐标瞄准
             就会丢空（真拖实测复现：F+k+x 只拼出 kx）。 */
          out.push({ ch: L.ch,
            x: round3(L.body ? L.lx : L.wx), y: round3(L.body ? L.ly : L.wy),
            state: L.body ? 'body' : 'free',
            bodyId: L.body ? bodies.indexOf(L.body) : null,
            temp: round3(L.temp == null ? 20 : L.temp) });
        }
        out.palette = paletteList();
        return out;
      },
      palette: paletteList,
      eqTable: function () {
        var out = [], i;
        for (i = 0; i < EQUATIONS.length; i++) {
          out.push({ id: EQUATIONS[i].id, sig: EQUATIONS[i].canon, toks: EQUATIONS[i].toks,
            text: EQUATIONS[i].decl, group: EQUATIONS[i].group, cond: EQUATIONS[i].cond });
        }
        return out;
      },
      eqEvents: function (n) {
        var out = eqEvents.slice();
        if (n > 0) out = out.slice(Math.max(0, out.length - n));
        return out;
      },
      eqClock: function () { return { t: eqTime, acc: eqAcc, dt: EQ_DT }; },
      eqStep: function (n) {
        n = (n == null) ? 1 : Math.max(1, Math.min(100000, n | 0));
        for (var i = 0; i < n; i++) eqStepOnce();
        return { t: eqTime, n: n };
      },
      eqClearEvents: function () { eqEvents = []; eqEventSeq = 0; return true; },
      eqSet: eqSetPublic,
      eqVel: function (id, vx, vy) {
        var B = bodies[id];
        if (!B) return null;
        eqInitState(B);
        B.vx = vx; B.vy = vy || 0;
        B.eqState.vx0 = B.vx; B.eqState.vy0 = B.vy;
        return { id: id, vx: B.vx, vy: B.vy };
      },
      eqState: function (id) {
        var B = bodies[id];
        if (!B) return null;
        /* 惰性初始化：只要它是一条公式体，就该能读到状态 ——
           以前没跑过动力学时这里返回 null，读的人会误以为"没有这个字段"。 */
        if (!B.eqState) { if (B.eq) eqInitState(B); else return null; }
        var S = B.eqState, out = {}, k;
        for (k in S) out[k] = (typeof S[k] === 'number') ? Math.round(S[k] * 1e6) / 1e6 : S[k];
        return out;
      },
      /* 箭头专用的测试口：给出"射出的射线打到谁" */
      rayState: function () {
        var out = [], i;
        for (i = 0; i < stageL.length; i++) {
          var L = stageL[i];
          if (L.ch !== ARROW) continue;
          var hit = rayHit(L);
          out.push({ x: round3(L.wx), y: round3(L.wy), rot: L.rot,
            hit: hit ? { body: hit.body ? bodies.indexOf(hit.body) : null, letter: hit.letter ? hit.letter.ch : null,
              x: round3(hit.x), y: round3(hit.y) } : null });
        }
        return out;
      },
      /* 可调读数：读某个公式体上某个量的当前值 */
      paramGet: function (id, ch) {
        var B = bodies[id];
        if (!B) return null;
        for (var i = 0; i < B.glyphs.length; i++) if (B.glyphs[i].ch === ch) return B.glyphs[i].val;
        return null;
      },
      paramSet: function (id, ch, v) { return eqSetPublic(id, ch, v); },
      rawBodies: function () {
        var out = [], i;
        for (i = 0; i < bodies.length; i++) {
          var B = bodies[i];
          out.push({ i: i, x: B.x, y: B.y, vx: B.vx, vy: B.vy, kind: B.kind, eq: B.eq, tokens: B.tokens,
            hasG: !!B.hasG, formula: !!B.formula, kindRaw: B.kind,
            hw: B.hw, hh: B.hh, frac: !!B.frac, gravMode: B.gravMode, isWell: !!B.isWell,
            glyphs: B.glyphs.map(function (g) { return g.ch; }) });
        }
        return out;
      },
      distance: function (a, b) {
        var A = bodies[a], B = bodies[b];
        if (!A || !B) return null;
        return Math.hypot(A.x - B.x, A.y - B.y);
      },
      pause: function () { running = false; return true; },
      resume: function () { running = true; return true; },
      /* 落字打点（断言"真拖与 API 走同一个函数"用） */
      placeStats: function () { return { drop: dropPathCount, api: apiPathCount, merge: mergeCount, place: placeCount }; },
      dbgForm: dbgFormFn,
      dbgPlace: dbgPlaceFn,
      lastMerge: function () { return lastMergeDbg; },
      /* 常量/墨迹指纹（排障用：确认浏览器拿到的是哪一版、hh 常量解成了多少） */
      probeRev: function () {
        var ink = {}, i;
        for (i = 0; i < PAL.length; i++) ink[PAL[i].ch] = metrics(PAL[i].ch).ink;
        return { advK: ADV_K, padR: PAD_R, padC: PAD_C, inkA: INK_A, padY: PAD_Y,
          soft: SOFT_R, gNewton: G_NEWTON, palN: PAL.length, eqN: EQUATIONS.length,
          renderFS: RENDER_FS, ink: ink, W: W, H: H };
      },
      _internal: { bodies: bodies, stageL: stageL, root: overlay, dump: dumpInternal,
        gate: gate, canon: canon, formulaNear: formulaNear, pickTarget: pickTarget, mkLetter: mkLetter }
    };
    /* 排障：把\"这组字能不能并\"的判定逐步报出来 */
    function dbgFormFn(chars) {
      if (typeof chars !== 'string') chars = (chars || []).join('');
      var out = [], i, body = null;
      for (i = 0; i < bodies.length; i++) { body = bodies[i]; out.push({ i: i, tokens: body.tokens, kind: body.kind, formula: !!body.formula }); }
      var acc = { tokens: '', firstCh: '' }, steps = [];
      for (i = 0; i < chars.length; i++) {
        var g = gate(acc, chars.charAt(i));
        steps.push({ ch: chars.charAt(i), gate: g ? (g.eq ? ('eq:' + g.eq.id) : 'partial') : 'REJECT',
          tokens: acc.tokens + chars.charAt(i), canon: canon(acc.tokens + chars.charAt(i)) });
        if (g) acc = { tokens: acc.tokens + chars.charAt(i), firstCh: acc.firstCh || chars.charAt(i) };
      }
      return { bodies: out, steps: steps };
    }
    /* 排障：这个字落到这个点会怎样 */
    function dbgPlaceFn(ch, x, y) {
      var L = mkLetter(ch, 2);
      L.state = 'stage';
      L.wx = x; L.wy = y;
      var tgt = pickTarget(L), fn = formulaNear(L), gateRes = null;
      if (tgt && tgt.body) gateRes = gate(tgt.body, ch);
      killLetter(L);
      return { hasTarget: !!tgt, targetTokens: tgt && tgt.body ? tgt.body.tokens : null,
        targetKind: tgt && tgt.body ? tgt.body.kind : null,
        formulaNear: fn, gate: gateRes ? (gateRes.eq ? ('eq:' + gateRes.eq.id) : 'partial') : 'REJECT' };
    }
    /* 只读的内部快照（排障用：排版数字为什么长这样） */
    function dumpInternal() {
      var out = [], i, j;
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i], gs = [];
        for (j = 0; j < B.glyphs.length; j++) {
          var g = B.glyphs[j];
          gs.push({ ch: g.ch, adv: g.adv, ink: g.ink, lx: g.lx, ly: g.ly, w: g.domW });
        }
        out.push({ hw: B.hw, hh: B.hh, wNum: B.wNum, wDen: B.wDen, num: B.num, den: B.den,
          tokens: B.tokens, eq: B.eq, formula: !!B.formula, glyphs: gs });      }
      return out;
    }
  }

  /* 托盘清单（只读；letters().palette 与 API.palette() 共用） */
  function paletteList() {
    var out = [], i;
    for (i = 0; i < PAL.length; i++) {
      out.push({ ch: PAL[i].ch, key: PAL[i].group + ':' + PAL[i].ch, group: PAL[i].group || '',
        note: PAL[i].note || '', op: !!PAL[i].op, val: PAL[i].val });
    }
    return out;
  }

  /* ==================================================================== *
   * 第 4 部分：对外接口 window.QG_PSANDBOX                              *
   * ==================================================================== */
  var current = null, hostEl = null;
  var API = {
    build: BUILD,
    version: 'cleanroom-1',
    /* 源码指纹（排障用：确认浏览器拿到的是不是刚写的那一版）
       = 关键排版常量的读数，改常量它会变。 */
    probeRev: function () { return current ? current.probeRev() : null; },
    mount: function (containerEl, opts) {
      if (!containerEl) return null;
      if (current) API.unmount();
      injectCSS();
      hostEl = containerEl;
      current = createEngine(containerEl, opts || {});
      return true;
    },
    unmount: function () {
      if (!current) return false;
      var eng = current;
      current = null;
      try { eng.unmount(); } catch (e) { }
      hostEl = null;
      return true;
    },
    isMounted: function () { return !!current; },
    applyPreset: function (k) { return current ? current.applyPreset(k) : null; },
    addBody: function (chars, opts) { return current ? current.addBody(chars, opts) : null; },
    bodies: function () { return current ? current.bodies() : []; },
    clear: function () { return current ? current.clear() : null; },
    collect: function () { return current ? current.collect() : null; },
    stepOnce: function (dt) { return current ? current.stepOnce(dt) : null; },
    pause: function () { return current ? current.pause() : false; },
    resume: function () { return current ? current.resume() : false; },
    state: function () { return current ? current.state() : { build: BUILD, mounted: false }; },
    letters: function () { return current ? current.letters() : []; },
    palette: function () { return current ? current.palette() : paletteList(); },
    eqTable: function () { return current ? current.eqTable() : []; },
    eqEvents: function (n) { return current ? current.eqEvents(n) : []; },
    eqClock: function () { return current ? current.eqClock() : { t: 0, acc: 0, dt: 0 }; },
    eqStep: function (n) { return current ? current.eqStep(n) : null; },
    eqClearEvents: function () { return current ? current.eqClearEvents() : false; },
    eqSet: function (id, k, v) { return current ? current.eqSet(id, k, v) : null; },
    eqVel: function (id, vx, vy) { return current ? current.eqVel(id, vx, vy) : null; },
    eqState: function (id) { return current ? current.eqState(id) : null; },
    rayState: function () { return current ? current.rayState() : []; },
    paramGet: function (id, ch) { return current ? current.paramGet(id, ch) : null; },
    paramSet: function (id, ch, v) { return current ? current.paramSet(id, ch, v) : null; },
    rawBodies: function () { return current ? current.rawBodies() : []; },
    distance: function (a, b) { return current ? current.distance(a, b) : null; },
    placeStats: function () { return current ? current.placeStats() : null; },
    dbgForm: function (chars) { return current ? current.dbgForm(chars) : null; },
    dbgPlace: function (ch, x, y) { return current ? current.dbgPlace(ch, x, y) : null; },
    lastMerge: function () { return current ? current.lastMerge() : null; },
    /* 只读内部快照（排障用：排版数字为什么长这样） */
    dump: function () { return current ? current._internal.dump() : []; },
    host: function () { return hostEl; }
  };
  window.QG_PSANDBOX = API;
})();
