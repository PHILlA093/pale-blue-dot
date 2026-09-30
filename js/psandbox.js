/* ============================================================================
 * 穷观 · 物理符号沙盒（Physics Symbol Sandbox）· 可嵌入模块
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 给"观澜"用的物理演示模式（只在**物理**科目下由 demo.js 挂出入口）。
 *
 * 本文件是**可嵌入模块**，页面加载它本身**不建任何 DOM、不起任何循环**：
 *   window.QG_PSANDBOX = {
 *     mount(containerEl, opts)  往 containerEl 里建舞台（画布+字形层+自己的工具条）
 *     unmount()                 彻底拆干净（DOM / 全局事件 / rAF 全退）
 *     isMounted()               是否已挂载
 *     applyPreset(key)          newton2 / energy / circular / gravity / freefall
 *     addBody(chars, opts)      摆出一组字形并返回该体状态（不依赖真实鼠标）
 *     bodies() / stepOnce(dt) / clear() / state()
 *   }
 * 纯 ES5、零外部依赖、不用 eval / new Function（守观澜的严格 CSP）。
 * 全部状态都关在 mount() 建的闭包里，unmount() 后连引用都不留 —— 重复
 * mount/unmount 不会累积。样式一次性插进 <head>（前缀 ps-，不碰 css/style.css）。
 *
 * 移植自 E:\workspace\physics-sandbox\index.html（单文件原作，只读，未被改动）。
 * 原作四处核心实现**逐条保住**：
 *   1. DOM 字形 + canvas 底层双渲染：字母是真 <div> 斜体衬线文字，场/粒子/
 *      箭头画在 canvas 上；met() 用 measureText 的 actualBoundingBoxAscent/
 *      Descent 取**墨迹上下沿**做基线对齐（排版好看的根本）。
 *   2. 手写公式排版引擎：tokenSeq -> hRun（字距）-> placeRun（墨迹居中）->
 *      layoutFrac（分子/分母/下标横线 + 按最大尺寸自动缩放）；排版结果
 *      B.hw/B.hh 同时就是碰撞盒。
 *   3. 组合语法 canMerge：显式规则 + 每条写"为什么"。
 *   4. 公式内容即行为：hasG 受重力、hasA 沿 θ 加速、hasV+hasR 圆周、isWell
 *      吸引；引力用 1/max(d,24) 软化；双星越界平移不拉伸；抓住一颗切向释放。
 *
 * 与原作的**有意差异**（改这里之前先读这段）：
 *   a) 坐标系：原作把一个 fixed 全屏画布当成世界原点，clientX/clientY 直接当
 *      世界坐标用。模块化之后舞台只占观澜画布区的一块，所以 #psTable 是
 *      position:relative，"世界坐标 = 舞台内坐标"；所有 getBoundingClientRect
 *      的读数一律过 worldRect()，指针一律过 xy() 换算。
 *   b) 屏幕震动：原作抖 document.body（整页），本模块只抖舞台内的实验台
 *      #psTable，绝不把观澜的面板/聊天区一起抖。
 *   c) 新增：挂载/卸载、工具条（清空 / 全部收进面板 / 重置）、?preset= 与
 *      opts.preset 五种预设、window.QG_PSANDBOX 测试接口。
 * ========================================================================== */
(function () {
  'use strict';

  var BUILD = 'QG-20260920-5e5d5a';
  var CSS_ID = 'psCSS';

  /* ------------------------------------------------------------------ *
   * 样式（只作用于本模块自己插入的 .ps-* 节点，绝不碰观澜既有样式）    *
   * ------------------------------------------------------------------ */
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* 舞台：米白"实验台" —— 原作纸色，字形是 Georgia 斜体衬线 */
      '.ps-overlay{position:absolute;left:0;top:0;right:0;bottom:0;z-index:9;background:#F4F1EA}',
      '.ps-table{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;',
      'background:#F4F1EA;font-family:Georgia,"Times New Roman",serif;font-style:italic;color:#26221C;',
      'user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}',
      '.ps-ground{position:absolute;left:0;right:0;bottom:20%;height:2px;background:#26221C;opacity:.65;pointer-events:none}',
      '.ps-cv{position:absolute;left:0;top:0;pointer-events:auto;z-index:0}',
      '.ps-char{position:absolute;left:0;top:0;line-height:1;font-size:48px;cursor:grab;touch-action:none;z-index:5}',
      '.ps-char:active{cursor:grabbing}',
      '.ps-panel .ps-char{position:static;pointer-events:auto;font-size:30px;display:flex;align-items:center;',
      'justify-content:center;width:100%;height:100%;background:rgba(255,255,255,.45);border-radius:10px;cursor:grab}',
      '.ps-panel .ps-char:active{cursor:grabbing}',
      '@keyframes psPopin{0%{transform:scale(0);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}',
      '.ps-dockin{animation:psPopin .22s ease-out}',
      '.ps-panel{position:absolute;top:12px;right:12px;display:grid;grid-template-columns:repeat(9,38px);',
      'grid-auto-rows:38px;gap:5px;padding:9px;border:1px solid rgba(38,34,28,.2);border-radius:14px;',
      'background:rgba(255,255,255,.5);pointer-events:none;z-index:3;',
      'max-height:calc(100% - 24px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}',
      '.ps-shadow{position:absolute;left:0;top:0;height:12px;border-radius:50%;',
      'background:radial-gradient(ellipse at center,rgba(38,34,28,.45),rgba(38,34,28,0) 70%);pointer-events:none;display:none}',
      '.ps-handle{position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.92);',
      'border:1px solid rgba(38,34,28,.35);box-shadow:0 3px 10px rgba(38,34,28,.14);display:flex;align-items:center;',
      'justify-content:center;opacity:0;pointer-events:none;transition:opacity .18s;cursor:grab;z-index:6}',
      '.ps-handle.on{opacity:1;pointer-events:auto}',
      '.ps-handle:active{cursor:grabbing}',
      '.ps-ring{position:absolute;width:150px;height:150px;border:2.5px solid rgba(38,34,28,.55);border-radius:50%;opacity:0;pointer-events:none}',
      '.ps-ring.go{animation:psRing .5s ease-out forwards}',
      '@keyframes psRing{from{opacity:.6;transform:scale(.3)}to{opacity:0;transform:scale(1.3)}}',
      '.ps-menu{position:absolute;display:none;z-index:9;padding:9px 18px;background:#26221C;color:#F4F1EA;',
      'font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:15px;border-radius:20px;',
      'box-shadow:0 6px 18px rgba(38,34,28,.28);cursor:pointer;letter-spacing:1px}',
      '.ps-menu.on{display:block}',
      '.ps-trash{position:absolute;right:14px;bottom:14px;display:flex;align-items:center;justify-content:center;',
      'opacity:.5;pointer-events:auto;transition:opacity .15s ease,transform .15s ease;z-index:3;cursor:pointer}',
      '.ps-trash.on{opacity:1;transform:scale(1.15)}',
      '.ps-trash svg{pointer-events:none}',
      /* 本模块自己的窄工具条（与观澜同风格：深色、细边、小圆角）。
         ⚠ max-width 必须给**托盘**让位（2026-09-30 修复）：托盘 402px 宽贴右上，
         工具条原来 max-width:calc(100% - 260px) 会横着盖住托盘第一行 ——
         第一行的 m/M/g/a/v/r 被工具条压住、按不到（真拖 m 没有任何反应，
         F+m+a 永远拼不出的真凶之一）。现在留 430px，不压托盘。 */
      '.ps-bar{position:absolute;left:10px;top:8px;z-index:7;display:flex;align-items:center;gap:6px;',
      'padding:4px 8px;border:1px solid rgba(38,34,28,.16);border-radius:10px;background:rgba(255,255,255,.72);',
      'max-width:calc(100% - 430px);font-style:normal}',
      '.ps-bar button{flex:none;height:24px;padding:0 10px;border:1px solid rgba(38,34,28,.30);border-radius:7px;',
      'background:rgba(255,255,255,.65);color:#26221C;font-family:inherit;font-style:normal;font-size:12px;',
      'line-height:1;cursor:pointer;white-space:nowrap}',
      '.ps-bar button:hover{background:#26221C;color:#F4F1EA;border-color:#26221C}',
      '.ps-bar button:active{transform:scale(.96)}',
      '.ps-sep{flex:none;width:1px;height:16px;background:rgba(38,34,28,.18)}',
      '.ps-hint{color:#4a443a;font-size:11.5px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ps-log{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:8;padding:5px 14px;',
      'border-radius:14px;background:rgba(38,34,28,.88);color:#F4F1EA;font-family:inherit;font-style:italic;',
      'font-size:12.5px;letter-spacing:.5px;opacity:0;pointer-events:none;transition:opacity .18s}',
      '.ps-log.on{opacity:1}',
      /* 参数药丸（公式卡读数，2026-09-30 移植清单 P2-11）：纸色底、墨色细边的小药丸，
         与卡片同一套纸墨语言；可点（一步）可拖（连续改值），悬停看范围。 */
      '.ps-pill{position:absolute;left:0;top:0;z-index:6;display:inline-flex;align-items:center;gap:3px;',
      'padding:1px 7px;height:17px;border:1px solid rgba(38,34,28,.28);border-radius:999px;',
      'background:rgba(255,255,255,.72);color:#26221C;font-family:Georgia,"Times New Roman",serif;',
      'font-style:italic;font-size:11.5px;cursor:ew-resize;white-space:nowrap;user-select:none}',
      '.ps-pill:hover{border-color:#26221C;background:#fff}',
      '.ps-pill.on{background:#26221C;color:#F4F1EA;border-color:#26221C}',
      '.ps-pill b{font-weight:normal;font-size:11px}',
      '.ps-pill u{text-decoration:none;opacity:.55;font-size:8.5px;font-style:normal}',
      /* 双义字形的下缀标签（2026-10-01 第三批：用户拍板"不共用字形，每个含义各造
         一个字"）：c比（比热容）/ p压（压强）/ λ熔（熔化热）/ E能（能量）——
         字形 = 字母 + 小号下缀字（比/压/熔/能），textContent 仍是整串
         （身份/去重/公式匹配都靠整串，一个字形一个含义）。 */
      '.ps-sub{font-size:56%;vertical-align:sub;line-height:1;font-style:normal;font-weight:normal}',
      /* 成就面板（2026-10-01 新功能）：放在观澜左侧 AI 对话区顶部。
         ⚠ 挂在 document.body 上、position:fixed（2026-10-01 修复"DOM 对但屏幕
         看不见"）：原来挂在 .ps-overlay 里、用负 left 往舞台左边伸出 —— 而
         .gl-stage 是 overflow:hidden，任何伸出舞台的 DOM 都被它裁掉
         （getBoundingClientRect 照常报盒子，像素却一个都不画）。fixed + body
         直挂后不受任何祖先裁剪；z-index 200 压过观澜外壳（#guanlan z-150）。
         纸色底、墨色细边、衬线斜体小徽章，克制不花哨；同类事件重复触发只计数。 */
      '.ps-achv{position:fixed;left:6px;top:62px;z-index:200;padding:5px 8px;border:1px solid rgba(38,34,28,.16);',
      'border-radius:9px;background:rgba(255,255,255,.78);font-family:Georgia,"Times New Roman",serif;',
      'color:#26221C;pointer-events:none;user-select:none}',
      '.ps-achv-title{font-size:10.5px;font-style:italic;color:#4a443a;letter-spacing:1px;margin-bottom:2px}',
      '.ps-achv-row{display:flex;flex-wrap:wrap;gap:3px;max-width:330px}',
      '.ps-achv-b{display:inline-block;padding:1px 6px;border:1px solid rgba(38,34,28,.28);border-radius:999px;',
      'background:rgba(255,255,255,.85);font-size:10px;font-style:italic;white-space:nowrap}',
      '.ps-achv-b b{font-weight:normal;opacity:.6;font-size:9px}',
      /* 窄窗（观澜在主窗里是浮动面板）：面板压到底部、提示收起、垃圾桶靠边。
         ⚠ 符号涨到 56 后这里列数固定 8（桌面 9），格子 30px —— 装不下就在面板
         内部纵向滚动（max-height:42%），不会把字形压成看不见的细条，也不会横向
         溢出舞台。dockSlotEl() 的钉位按 palCols() 与这里的断点保持一致。 */
      '@media (max-width:768px){',
      '.ps-panel{top:auto;bottom:6px;right:6px;left:auto;grid-template-columns:repeat(8,30px);',
      'grid-auto-rows:30px;padding:6px;gap:4px;max-height:42%}',
      '.ps-panel .ps-char{font-size:20px;border-radius:6px}',
      '.ps-bar{left:6px;top:6px;right:6px;max-width:none;flex-wrap:wrap;gap:4px;padding:3px 5px}',
      '.ps-bar button{height:26px;padding:0 8px}',
      '.ps-hint{display:none}',
      '.ps-trash{bottom:calc(42% + 12px);right:10px}',
      '.ps-ground{bottom:52%}',
      '}'
    ].join('');
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------------ *
   * 引擎：mount() 每次调用建一个**全新闭包**（状态天然隔离）           *
   * ------------------------------------------------------------------ */
  function createEngine(host, opts) {
    opts = opts || {};

    /* ---------------- 常量（数值全部沿用原作，手感全靠这些数） ---------------- */
    var F = 48;               // 场上字形字号（面板里是 34px）
    var GRAV = 2600;          // 重力加速度 px/s²（hasG 的体才受）
    var AACC = 1300;          // a 块沿 θ 的加速度
    var B_FIELD_RANGE = 320;  // B 磁场半径
    var BZ_DIR = 1;
    var Q_FORCE = 2.2;        // F = qv×B
    var A_FORCE = 900;        // I 在 B 场里的安培力
    var E_FIELD_RANGE = 320;  // E 电场**方形**区（半边长 160）
    var E_FIELD_ACC = 1500;   // F = qE
    var G_RANGE = 360;        // 引力井作用半径（画面上那圈虚线）
    /* 引力常数（玩具单位）—— **用户选择保留旧引力行为**（2026-09-30 移植清单 P3）：
       非牛顿玩具力场（软化 1/max(d,24) + 距离截断），不是课本万有引力；数值与
       手感逐位沿用旧版，永久断言（引力井 40 帧 d0→d1）压着它，不许改。 */
    var G_PULL = 52000;
    var BH_MAXR = 105;
    var BH_REACH = 2000;
    var BLAST_R = 500;
    var SHATTER_SPEED = 1100;
    var MT = {};              // met() 度量缓存

    var OPEN = '(', CLOSE = ')', PLUS = '+', SQ = '\u00B2', BAR = '-';
    var HALF = '\u00BD', MU = '\u03BC', SUB1 = '\u2081', SUB2 = '\u2082', PRIME = '\u2032';
    /* 运算符号与箭头（2026-09-30 移植清单 P2：托盘 45 → 56）。全部**单字符**，
       与既有排版管线兼容；'−' 用真减号 U+2212（结构分数线仍用 ASCII '-'，两者不混）。 */
    var MINUS = '\u2212', TIMES = '\u00D7', DIV = '\u00F7', RAD = '\u221A', DOT = '\u00B7';
    var ARROW = '\u2192', EQ = '=';
    function isOp(ch) {
      return ch === '+' || ch === MINUS || ch === TIMES || ch === DIV || ch === EQ ||
             ch === OPEN || ch === CLOSE || ch === SQ || ch === RAD || ch === DOT;
    }
    /* ---- 手速 → 初速度（2026-09-30 移植清单 P0-2）----
       实测教训：人手横跨屏幕拖一次就是 600~2000px/s，阈值过低会把每次拖放都变成
       甩飞（旧版 40px/s 阈值下正常拖放都带着初速度，落点跟着漂）。
       两条一起用：① STILL_MS：松手前最后一次移动距今超过它 -> "放稳了"，初速度 0；
       ② THROW_MIN：低于它不给初速度（正常拖放，落点 = 投放点）；超过的部分按比例
       转成初速度（超得越多给得越多），再封顶 THROW_MAX，方向永远等于手势方向。 */
    var STILL_MS = 140;
    var THROW_MIN = 1500;
    var THROW_MAX = 1400;
    /* ---- 松手合并半径（2026-09-30 移植清单 P1-4）----
       release 时刻按**实时位置**找半径内最近的可合并目标；"收下它就能拼齐某条
       课本公式"的组合半径再放宽一档（MERGE_R_EQ）。快甩（≥THROW_MIN）不吸附，
       只按手势方向飞出 —— 甩飞不受合并半径影响。 */
    var MERGE_R = 80;
    var MERGE_R_EQ = 160;
    /* 符号扩展新增的希腊字母/算符（都是**单字符**：排版管线按字符切 token，
       多字符会破坏 tokenSeq；所以只收单码点写法） */
    var OMEGA = '\u03C9', ETA = '\u03B7', THETA = '\u03B8', DELTA = '\u0394';
    var EPS = '\u03B5', PHI = '\u03A6', RHO = '\u03C1', LAMBDA = '\u03BB', NU = '\u03BD';

    /* ---------------- DOM：全部自建，绝不依赖宿主页面已有的节点 ---------------- */
    var DD = document;
    var overlay = DD.createElement('div'); overlay.className = 'ps-overlay';
    var table = DD.createElement('div'); table.className = 'ps-table';
    var cv = DD.createElement('canvas'); cv.className = 'ps-cv';
    var shadow = DD.createElement('div'); shadow.className = 'ps-shadow';
    var panel = DD.createElement('div'); panel.className = 'ps-panel';
    var handle = DD.createElement('div'); handle.className = 'ps-handle';
    handle.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#26221C" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="22 4 22 10 16 10"></polyline>' +
      '<path d="M19.5 15a8.5 8.5 0 1 1-2-8.9L22 10"></path></svg>';
    var menu = DD.createElement('div'); menu.className = 'ps-menu'; menu.textContent = '\u590d\u5236';
    var trash = DD.createElement('div'); trash.className = 'ps-trash';
    trash.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#26221C" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 6h18"></path><path d="M19 6l-1.2 13.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 6"></path>' +
      '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
      '<path d="M10 11v6M14 11v6"></path></svg>';
    var ring = DD.createElement('div'); ring.className = 'ps-ring';
    var ground = DD.createElement('div'); ground.className = 'ps-ground';
    var bar = DD.createElement('div'); bar.className = 'ps-bar';
    var logEl = DD.createElement('div'); logEl.className = 'ps-log';

    function mkBtn(id, label, title) {
      var b = DD.createElement('button');
      b.type = 'button';
      b.id = id;
      b.textContent = label;
      if (title) b.title = title;
      return b;
    }
    var bEmpty = mkBtn('psEmpty', '\u6e05\u7a7a', '\u6e05\u7a7a\u573a\u4e0a\u4e00\u5207\uff0c\u9762\u677f\u6062\u590d 62 \u4e2a\u5b57\u5f62');
    var bCollect = mkBtn('psCollect', '\u5168\u90e8\u6536\u8fdb\u9762\u677f', '\u628a\u573a\u4e0a\u6240\u6709\u5b9e\u4f53\u62c6\u56de\u5b57\u5f62\u5f52\u8fd8\u9762\u677f');
    var bReset = mkBtn('psReset', '\u91cd\u7f6e', '\u6e05\u7a7a\u5e76\u56de\u5230\u672c\u9875\u521d\u59cb\u72b6\u6001');
    var sepEl = DD.createElement('span'); sepEl.className = 'ps-sep';
    var hintEl = DD.createElement('span'); hintEl.className = 'ps-hint';
    /* 提示行（2026-10-01 更新）：符号 62（56 + V/d + 四个双义新字形），
       课本公式 39 条（28 + 第三批 11）。只列 4 条最直观的再补一句总括。 */
    hintEl.textContent = '\u62d6\u5230\u4e00\u8d77\u5c31\u80fd\u62fc\u51fa\u8bfe\u672c\u516c\u5f0f\uff1aF+m+a \u725b\u987f\u7b2c\u4e8c\u5b9a\u5f8b\u3001U+I+R \u6b27\u59c6\u5b9a\u5f8b\u3001F+k+x \u80e1\u514b\u5b9a\u5f8b\u3001F+B+I+L \u5b89\u57f9\u529b\uff1b\u7b49\u53f7\u53f3\u2192\u5de6\u6536\u7f29\u3001\u7bad\u5934\u8f93\u51fa\u94fe\u63a5\u516c\u5f0f\u7684\u91cf\uff1b\u5171 39 \u6761\uff0c\u60ac\u505c\u770b\u7b26\u53f7\u542b\u4e49';
    if (opts.hint) hintEl.textContent = String(opts.hint);
    bar.appendChild(bEmpty); bar.appendChild(bCollect); bar.appendChild(bReset);
    bar.appendChild(sepEl); bar.appendChild(hintEl);
    if (opts.toolbar === false) bar.style.display = 'none';

    var GROUND_SVG_NS = 'http://www.w3.org/2000/svg';
    table.appendChild(ground);
    table.appendChild(cv);
    table.appendChild(shadow);
    table.appendChild(panel);
    table.appendChild(handle);
    table.appendChild(menu);
    table.appendChild(trash);
    table.appendChild(ring);
    table.appendChild(bar);
    table.appendChild(logEl);
    overlay.appendChild(table);
    host.appendChild(overlay);
    void GROUND_SVG_NS;

    var cvx = cv.getContext('2d');
    var ctx2d = DD.createElement('canvas').getContext('2d');   // 只用来 measureText
    var dpr = window.devicePixelRatio || 1;

    var W = 0, H = 0, groundY = 0, tWorld = 0;
    var pointer = { x: -9999, y: -9999 };   // 舞台内坐标（不是 clientX/clientY）

    /* ---------------- 事件登记表：unmount() 靠它退干净 ---------------- */
    var listeners = [];
    function onEv(target, type, fn, opt) {
      if (!target || !target.addEventListener) return;
      target.addEventListener(type, fn, opt);
      listeners.push({ t: target, type: type, fn: fn, opt: opt });
    }
    function offAll() {
      for (var i = 0; i < listeners.length; i++) {
        var L = listeners[i];
        try { L.t.removeEventListener(L.type, L.fn, L.opt); } catch (e) { /* 忽略 */ }
      }
      listeners = [];
    }

    /* ---------------- 小工具 ---------------- */
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function shortAng(d) {
      d = d % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    }
    /* 某元素在**舞台坐标系**下的外框。本模块世界原点 = 舞台左上角，而
       getBoundingClientRect 给的是 client 坐标，两者差一个舞台原点。

       ★ 舞台原点的读数**一帧只取一次**（2026-09-30 流畅度修复）：
       getBoundingClientRect 是"强制同步布局"——只要这一帧已经写过任何样式
       （syncGlyphs 每帧都在写），它就会逼浏览器立刻把布局重算一遍。
       原来每次换算都读两遍（元素一遍 + 舞台一遍），一帧里叠加十几次。
       现在舞台原点缓存到 dirty 为止；tRectDirty 在 mount/换场/resize/屏幕震动
       时置位，由 frame() 在**任何样式写入之前**刷新一次。 */
    var tRect = null, tRectDirty = true;
    function tableOrigin() {
      if (!tRect || tRectDirty) {
        tRect = table.getBoundingClientRect();
        tRectDirty = false;
      }
      return tRect;
    }
    function invalidateTableOrigin() { tRectDirty = true; }
    function worldRect(el) {
      var r = el.getBoundingClientRect();
      var sr = tableOrigin();
      return { left: r.left - sr.left, top: r.top - sr.top,
               right: r.right - sr.left, bottom: r.bottom - sr.top,
               width: r.width, height: r.height };
    }
    function xy(e) {
      var sr = tableOrigin();
      return { x: e.clientX - sr.left, y: e.clientY - sr.top };
    }

    /* met(): 用 measureText 的 actualBoundingBox* 取**墨迹上下沿**。
       这是"字母看起来是排出来的、不是摆出来的"的根本：数学斜体的墨迹并不
       填满 fontBoundingBox，用 fontBoundingBox 对齐会歪。 */
    function met(ch, size) {
      size = size || F;
      var key = ch + '@' + size;
      if (MT[key]) return MT[key];
      ctx2d.font = 'italic ' + size + 'px Georgia,"Times New Roman",serif';
      var q = ctx2d.measureText(ch);
      var fba = q.fontBoundingBoxAscent || q.actualBoundingBoxAscent || 60;
      var fbd = q.fontBoundingBoxDescent || q.actualBoundingBoxDescent || 20;
      var ia = q.actualBoundingBoxAscent || 0;
      var id = q.actualBoundingBoxDescent || 0;
      var bl = (size - (fba + fbd)) / 2 + fba;   // 基线在"居中后的字体盒"里的位置
      MT[key] = { top: bl - ia - size / 2, bot: bl + id - size / 2, w: q.width };
      return MT[key];
    }
    function metS(ch, size) {
      ctx2d.font = 'italic ' + size + 'px Georgia,"Times New Roman",serif';
      var q = ctx2d.measureText(ch);
      var fba = q.fontBoundingBoxAscent || size * 0.8, fbd = q.fontBoundingBoxDescent || size * 0.25;
      var ia = q.actualBoundingBoxAscent || 0, id = q.actualBoundingBoxDescent || 0;
      var bl = (size - (fba + fbd)) / 2 + fba;
      return { top: bl - ia - size / 2, bot: bl + id - size / 2, w: q.width };
    }
    function isMass(d) { var t = (typeof d === 'string') ? d : d.type; return t === 'm' || t === 'M'; }

    /* ---------------- 世界状态 ---------------- */
    var ALL = [], freeL = [], bodies = [], formulas = [], particles = [];

    function GD(ch, sc) {
      sc = sc || 1;
      var sz = F * sc;
      var el = DD.createElement('div');
      el.className = 'ps-char';
      el.style.fontSize = sz + 'px';
      /* 双义字形（2026-10-01 第三批）：c比/p压/λ熔/E能 —— 字母 + 小号下缀字。
         textContent 仍是整串（el.textContent === ch，身份与去重不受影响）。 */
      if (ch.length > 1) el.innerHTML = ch.charAt(0) + '<span class="ps-sub">' + ch.slice(1) + '</span>';
      else el.textContent = ch;
      table.appendChild(el);
      var d = { el: el, ch: ch, type: ch, clone: false, body: null, sx: 0, sy: 0,
                w: el.offsetWidth, h: el.offsetHeight, wx: 0, wy: 0, vx: 0, vy: 0,
                anim: 0, rung: false, pop: 0, r: 0, dead: false, m: met(ch, sz) };
      ALL.push(d);
      el._letterRef = d;   // 反查：面板吞字 / 黑洞吃面板字都要靠它
      onEv(el, 'pointerdown', function (e) { gdDown(e, d); });
      onEv(el, 'contextmenu', function (e) {
        e.preventDefault();
        var mb = d.body;
        if (mb && mb.glyphs.indexOf(d) >= 0) openMenu(e.clientX, e.clientY, mb);
      });
      /* 箭头 →（2026-09-30 移植清单 P2-10）：滚轮改朝向（旧版旋转手柄之外的第二条路，
         与参考语义一致；只作用于箭头字形，其它字形滚轮无反应） */
      onEv(el, 'wheel', function (e) {
        if (d.ch !== ARROW) return;
        e.preventDefault();
        d.rot = (d.rot || 0) + ((e.deltaY > 0) ? 1 : -1) * 0.13;
        if (d.rot > Math.PI) d.rot -= 6.2832;
        if (d.rot < -Math.PI) d.rot += 6.2832;
        placeLetter(d);
        /* 操作日志：箭头转向（同一连串滚动 400ms 内只记一条，2026-10-01） */
        if (!d._logT || Date.now() - d._logT > 400) {
          d._logT = Date.now();
          opLog('arrow-turn', { deg: Math.round((d.rot || 0) * 180 / Math.PI) });
        }
      }, { passive: false });
      return d;
    }
    function stGD(ch, sc) { var d = GD(ch, sc || 1); d.stk = true; d.s = 1; return d; }
    function killG(g) {
      if (!g || g.dead) return;
      g.dead = true;
      if (g.el && g.el.parentNode) g.el.parentNode.removeChild(g.el);
      if (g.body) { var k = g.body.glyphs.indexOf(g); if (k >= 0) g.body.glyphs.splice(k, 1); }
      g.body = null;
    }
    function killLetter(d) {
      d.dead = true;
      var i = freeL.indexOf(d); if (i >= 0) freeL.splice(i, 1);
      i = ALL.indexOf(d); if (i >= 0) ALL.splice(i, 1);
      if (d.el && d.el.parentNode) d.el.parentNode.removeChild(d.el);
    }

    /* ---------------- 字形托盘（dock）的符号表 ----------------
       15 个移植自原作的符号 + 18 个按 **高中物理（必修 + 选择性必修）** 补齐的符号。
       新增的每一个都在 `note` 里写明它在高中物理里的含义（一个符号可能多义，
       主用法在前）；`group` 只用于面板的分组提示，不参与任何物理逻辑。

       ⚠ 选符号的两条纪律（写新符号前先读）：
         ① **不许凑数**：只收高中课本里真会出现的量。大学内容（张量、四维矢量、
            拉格朗日量、哈密顿量…）一律不收。
         ② **不许与既有符号同形**：托盘里一个字形只能有一个含义（原作就是"一个字母
            一个块"）。所以低频的"磁感应强度 B 的另一种写法"之类的重复写法不收。

       ⚠ 一个符号多义是**高中物理的既成事实**（f 既是摩擦力也是频率，h 既是高度
       也是普朗克常量，T 既是周期也是热力学温度，Q 既是电荷量也是热量，p 既是
       动量也是压强）。托盘里只保留**一个字形**，靠"跟谁组合"区分含义 ——
       这正是本沙盒"内容即行为"的原有设计，不要为了消歧而复制字形。 */
    var PAL = [
      /* ---- 原作 15 个（顺序与含义一律不动：PAL_ORDER 决定面板格子） ---- */
      { k: 'mO', ch: 'm', group: '力学', note: '质量（也是动量的 m）' },
      { k: 'M2O', ch: 'M', group: '力学', note: '质量（大质量天体：引力井/黑洞里的 M）' },
      { k: 'gO', ch: 'g', group: '力学', note: '重力加速度（g=9.8 m/s²；接了它的体才受重力）' },
      { k: 'aO', ch: 'a', group: '力学', note: '加速度（接了它的体沿 θ 方向加速）' },
      { k: 'vO', ch: 'v', group: '力学', note: '速度（v² 就是速度的平方）' },
      { k: 'rO', ch: 'r', group: '力学', note: '半径 / 距离（圆周运动与万有引力的 r）' },
      { k: 'halfO', ch: HALF, group: '力学', note: '½（动能 ½mv² 的系数）' },
      { k: 'muO', ch: MU, group: '力学', note: '动摩擦因数 μ' },
      { k: 'cO', ch: 'c', group: '近代', note: '真空中光速（mc²、2GM/c²）' },
      { k: 'GO', ch: 'G', group: '力学', note: '万有引力常量' },
      { k: 'tO', ch: 't', group: '力学', note: '时间（也是周期公式里的 t；拖到别的体上会触发 g+t→v、v+t→木板、q+t→I）' },
      { k: 'BO', ch: 'B', group: '电磁学', note: '磁感应强度（磁场里受洛伦兹力/安培力）' },
      { k: 'EO', ch: 'E', group: '电磁学', note: '电场强度（F=qE，方向可用 E 场的旋转手柄改）' },
      { k: 'qO', ch: 'q', group: '电磁学', note: '电荷量（在磁场里转弯、在电场里加速）' },
      { k: 'IO', ch: 'I', group: '电磁学', note: '电流（在磁场里受安培力）' },

      /* ---- 力学补齐 ---- */
      { k: 'FO', ch: 'F', group: '力学', note: '力 / 合力（F=ma、F=kx、F=qE）' },
      { k: 'fO', ch: 'f', group: '力学', note: '摩擦力（f=μN）；也读作频率（波长公式 v=λf 里的 f）' },
      { k: 'NO', ch: 'N', group: '力学', note: '支持力 / 压力（水平面上 N=mg，斜面上 N=mg·cosθ）' },
      { k: 'sO', ch: 's', group: '力学', note: '位移 / 路程（匀速 s=vt）' },
      { k: 'hO', ch: 'h', group: '力学', note: '高度（重力势能 E_p=mgh）；也读作普朗克常量（光子能量 ε=hν）' },
      { k: 'pO', ch: 'p', group: '力学', note: '动量（p=mv）；也读作压强（p=F/S）' },
      { k: 'TO', ch: 'T', group: '力学', note: '周期（ω=2π/T）；也读作热力学温度' },
      { k: 'omegaO', ch: '\u03C9', group: '力学', note: '角速度（ω=2π/T=2πn，圆周运动的 ω）' },
      { k: 'kO', ch: 'k', group: '力学', note: '劲度系数（胡克定律 F=kx）；也出现在静电力常量 k 里' },
      { k: 'etaO', ch: '\u03B7', group: '力学', note: '机械效率（η=P有用/P总×100%）' },
      { k: 'thetaO', ch: '\u03B8', group: '力学', note: '角度（斜面倾角、力的夹角；Fcosθ 是力的分量）' },
      { k: 'DeltaO', ch: '\u0394', group: '力学', note: '变化量算符（Δx=x₂−x₁、Δv、Δp；也用于 ΔE 与 ΔΦ）' },
      { k: 'xO', ch: 'x', group: '力学', note: '位移坐标 / 横坐标（v-t 图的横轴、x 轴上的位置）' },
      { k: 'yO', ch: 'y', group: '力学', note: '纵坐标（平抛运动的竖直分位移 y=½gt²）' },
      { k: 'AO', ch: 'A', group: '力学', note: '振幅（简谐运动的 A）；也读作面积' },
      { k: 'SO', ch: 'S', group: '力学', note: '面积 / 路程（压强 p=F/S；也用于 Φ=BS）' },

      /* ---- 电磁学补齐 ---- */
      { k: 'UO', ch: 'U', group: '电磁学', note: '电压（欧姆定律 U=IR、电功率 P=UI）' },
      { k: 'RO', ch: 'R', group: '电磁学', note: '电阻（D 的另一种写法不收：与 R 同形同义，托盘一个字形只有一个含义）' },
      { k: 'PO', ch: 'P', group: '电磁学', note: '功率（P=W/t=UI）' },
      { k: 'WO', ch: 'W', group: '电磁学', note: '功 / 电功（W=Fs=UIt）' },
      { k: 'QO', ch: 'Q', group: '电磁学', note: '电荷量（Q=It）；也读作热量（Q=I²Rt）' },
      { k: 'epsO', ch: '\u03B5', group: '电磁学', note: '电动势（闭合电路 ε=U+Ir）' },
      { k: 'CO', ch: 'C', group: '电磁学', note: '电容（C=Q/U）' },
      { k: 'LO', ch: 'L', group: '电磁学', note: '长度（导线长度 L、摆长 L）；也用于自感系数' },
      { k: 'PhiO', ch: '\u03A6', group: '电磁学', note: '磁通量（Φ=BS，法拉第电磁感应定律 E=nΔΦ/Δt）' },
      { k: 'rhoO', ch: '\u03C1', group: '电磁学', note: '电阻率（R=ρL/S）；也读作密度（ρ=m/V）' },
      { k: 'lambdaO', ch: '\u03BB', group: '电磁学', note: '波长（波速 v=λf）' },
      { k: 'nuO', ch: '\u03BD', group: '近代', note: '频率（v=λν）；也用于光子能量 ε=hν（注意与速度 v 不是同一个字形）' },
      { k: 'phiO', ch: '\u03C6', group: '电磁学', note: '电势 / 相位（φ 是相位角；电势差就是电压 U）' },
      { k: 'nO', ch: 'n', group: '电磁学', note: '折射率（n=sin i/sin r）；也读作物质的量（n=m/M）' },

      /* ---- 运算（10）+ 箭头（1）（2026-09-30 移植清单 P2：45 → 56）----
         运算符**不参与公式身份判定**（F+=+m+a ≡ F+m+a），只把"写法"并进表达式；
         '=' 有专门语义（成式后拖入 = 边→边变换、再碰一次换边）；箭头是**输出算子**
         （2026-10-01 用户澄清）：沿朝向射出，把附近那条公式的**输出量**放出来 ——
         升温只是 Q=cmΔT 这一条的输出，不是箭头本身的含义（详见 emitterOf 的对照表）。
         与结构字形（st.open/st.plus/st.sq）**不冲突**：
         结构字形只挂在 B.st 上、永不进托盘；这里的字形是玩家能真拖的。 */
      { k: 'plusO', ch: PLUS, group: '运算', note: '加号（把两项并成一项）' },
      { k: 'minusO', ch: MINUS, group: '运算', note: '减号（这一项取负）' },
      { k: 'timesO', ch: TIMES, group: '运算', note: '乘号（与"并排写"等价）' },
      { k: 'divO', ch: DIV, group: '运算', note: '除号（与"分数线"等价）' },
      { k: 'eqO', ch: EQ, group: '运算', note: '等号＝变换器（右→左，2026-10-01 用户澄清）：把右侧表达式收成左侧的量（IR 放上等号变成 U，卡片 U = IR；再碰一次拆回 IR）' },
      { k: 'openO', ch: OPEN, group: '运算', note: '左括号（改变运算顺序）' },
      { k: 'closeO', ch: CLOSE, group: '运算', note: '右括号（与左括号配对）' },
      { k: 'sqO', ch: SQ, group: '运算', note: '平方（写在量后面，如 v²）' },
      { k: 'radO', ch: RAD, group: '运算', note: '根号（写在量前面，如 √2）' },
      { k: 'dotO', ch: DOT, group: '运算', note: '点乘 / 分隔（两个量的乘积）' },
      { k: 'arrowO', ch: ARROW, group: '运算', note: '箭头→：输出算子 —— 沿朝向射出，把附近链接的那条公式的**输出量**放出来（升温只是 Q=cmΔT 这一条的输出）：Q=cmΔT→热量（打到目标升温）、Q=λm→相变潜热、Q=I²Rt→发热、v=λf→光波、ε=hν→光子、E=hν−W→光电子、U=IR→电流、P=UI→功率、U=Ed→电场（间隙够小且 E≥3×10⁶ V/m 时击穿空气）、F=ma→力、F=BIL/qvB→安培力/洛伦兹力、Φ=BS/E=ΔΦ/Δt→感应电流' },

      /* ---- 第三批新字形（2026-10-01：托盘 56 → 62）----
         双义量按用户拍板"不共用字形，每个含义各造一个字"：c 光速 / c比 比热容、
         p 动量 / p压 压强、λ 波长 / λ熔 熔化热、E 场强 / E能 能量 —— 下缀字
         （比/压/熔/能）就是视觉区分，两格都能真拖、公式表按各自字形匹配。 */
      { k: 'VO', ch: 'V', group: '力学', note: '体积（气体状态方程 pV/T、浮力 F=ρgV 的 V）' },
      { k: 'dO', ch: 'd', group: '力学', note: '距离 / 空气间隙（U=Ed 里的 d；间距越短越容易击穿）' },
      { k: 'cbiO', ch: 'c\u6bd4', group: '热学', note: '比热容（Q=cmΔT 的 c；与光速 c 是两个字，下缀「比」）' },
      { k: 'pyaO', ch: 'p\u538b', group: '力学', note: '压强（p=F/S、pV/T 的 p；与动量 p 是两个字，下缀「压」）' },
      { k: 'lrongO', ch: '\u03bb\u7194', group: '热学', note: '熔化热（Q=λm 的 λ；与波长 λ 是两个字，下缀「熔」）' },
      { k: 'EnengO', ch: 'E\u80fd', group: '近代', note: '能量（E=hν−W、Eₖ=½mv² 的 E；与场强 E 是两个字，下缀「能」）' }
    ];
    /* 面板列数：符号 15 → 33 → 45 → 56。桌面 CSS 是 9 列 × 38px（见 #psCSS），
       56 = 9×6+2 → 7 行；窄屏媒体查询降到 8 列。dockSlotEl() 按 **palCols()**
       实时取列数（窄屏 8、桌面 9），不要再写死 4/6。 */
    var PAL_COLS = 9;   // 桌面列数（与 #psCSS 的 repeat(9,38px) 一致；窄屏 palCols() 读 8）
    var P = {};
    var PAL_ORDER = (function () {
      var o = {};
      for (var i = 0; i < PAL.length; i++) o[PAL[i].ch] = i;
      return o;
    })();
    function makePalLetter(item) {
      var d = GD(item.ch);
      d.cat = 1; d.palKey = item.k;
      d.palNote = item.note || '';
      d.palGroup = item.group || '';
      if (d.el) d.el.title = item.ch + ' — ' + (item.note || '');
      P[item.k] = d;
      return d;
    }
    /* 托盘清单快照（供 letters().palette 与 API.palette() 共用；只读，不改状态） */
    function paletteList() {
      var out = [];
      for (var i = 0; i < PAL.length; i++) {
        var it = PAL[i], d = P[it.k];
        out.push({ ch: it.ch, key: it.k, group: it.group || '', note: it.note || '',
                   docked: !!(d && d.state === 'dock') });
      }
      return out;
    }

    /* ---------------- 高中物理公式表（符号扩展的"里子"） ----------------
       本沙盒的立身之本是"**公式内容即行为**"：字母摆成什么式子，它就该有什么脾气。
       新增的 18 个符号不能只是"能拖的装饰"，所以每一组能拼出的经典公式都在这里
       登记：**组成字母（多重集）→ 课本公式**。注册后：
         · 装配时允许按公式收字（canMerge = eqStepOK）—— 超过公式用量的重复字母仍被拒；
         · 拼齐后在公式体周围画一张**同一套墨线的公式卡**（canvas，rampColor 同一套颜色），
           并写进 bodyState().eq / eqText（探针与上层页面可读）。
       ⚠ 纪律（加新公式前必读）：
         ① **只收高中课本里成立的式子**，每条都在 `cond` 里写适用条件；
         ② 不收大学内容；不确定的宁可不加（项目红线：不许编物理）；
         ③ 公式体**不引入新行为**（不施力、不吸东西），只是把"式子"显示清楚 ——
            运动仍然由既有的 hasG/hasA/hasV/isWell 等决定，避免改变已有手感；
         ④ 令牌字母与既有组合不许抢：例如 GMm/r² 走 gravModeOf，绝不在这里重复登记。 */
    var EQUATIONS = [
      /* ---- 力学 ---- */
      { id: 'newton2', text: 'F = ma', toks: 'Fma', group: '力学',
        cond: '牛顿第二定律（惯性参考系，F 为合力）' },
      { id: 'work', text: 'W = Fs', toks: 'WFs', group: '力学',
        cond: '功的定义（F 与位移 s 同向时取正；夹角 θ 时 W=Fscosθ）' },
      { id: 'momentum', text: 'p = mv', toks: 'pmv', group: '力学',
        cond: '动量定义（p 与 v 同向；这是矢量式，中学常按一维处理）' },
      { id: 'weight', text: 'N = mg', toks: 'Nmg', group: '力学',
        cond: '水平支持面上的支持力（只在水平面、无其它竖直分力时成立）' },
      { id: 'friction', text: 'f = μN', toks: 'fN' + MU, group: '力学',
        cond: '滑动摩擦力（N 为正压力；静摩擦力要用平衡条件求，不套这条）' },
      { id: 'hooke', text: 'F = kx', toks: 'Fkx', group: '力学',
        cond: '胡克定律（在弹性限度内，x 为形变量）' },
      { id: 'circular', text: 'ω = 2π/T', toks: OMEGA + 'T', group: '力学',
        cond: '匀速圆周运动的角速度与周期关系' },
      { id: 'eff', text: 'η = W有用/W总', toks: ETA + 'W', group: '力学',
        cond: '机械效率（算出来是无单位的百分数）' },
      { id: 'powerW', text: 'P = W/t', toks: 'PWt', group: '力学',
        cond: '平均功率的定义（瞬时功率要写 P=Fv）' },
      { id: 'kinetic', text: 'Ek = ½mv²', toks: HALF + 'mvv', group: '力学',
        cond: '动能（½ 与 mv² 齐备；与既有的 ½mv² 排版同源）' },
      { id: 'potential', text: 'Ep = mgh', toks: 'mgh', group: '力学',
        cond: '重力势能（以参考面为零点，h 为相对高度）' },
      { id: 'delta', text: 'Δx = x₂ − x₁', toks: DELTA + 'x', group: '力学',
        cond: '位移的变化量（Δ 是算符，放在哪个量前面就读哪个量的变化）' },
      { id: 'coscomp', text: 'F₁ = Fcosθ', toks: 'F' + THETA, group: '力学',
        cond: '力的分解：F 沿 θ 方向的分量（正交分解时用）' },
      /* ---- 电磁学 ---- */
      { id: 'ohm', text: 'U = IR', toks: 'UIR', group: '电磁学',
        cond: '欧姆定律（纯电阻、线性元件；U 是这段电阻两端的电压）' },
      { id: 'powerE', text: 'P = UI', toks: 'PUI', group: '电磁学',
        cond: '电功率（这是定义式，对任何用电器都成立）' },
      { id: 'joule', text: 'Q = I²Rt', toks: 'QIRt', group: '电磁学',
        cond: '焦耳定律（电流通过电阻产生的热量；纯电阻时 Q=W=UIt）' },
      { id: 'charge', text: 'Q = It', toks: 'QIt', group: '电磁学',
        cond: '电荷量与电流的关系（恒定电流；I 的定义式 I=Q/t）' },
      { id: 'emf', text: 'ε = U + Ir', toks: EPS + 'UIr', group: '电磁学',
        cond: '闭合电路欧姆定律（r 为电源内阻，I 为干路电流）' },
      { id: 'cap', text: 'C = Q/U', toks: 'CQU', group: '电磁学',
        cond: '电容的定义式（对平行板电容器也写 C=εrS/(4πkd)，那是决定式）' },
      { id: 'faraday', text: 'E = ΔΦ/Δt', toks: 'E' + PHI + 't' + DELTA, group: '电磁学',
        cond: '法拉第电磁感应定律（单匝；n 匝时 E=nΔΦ/Δt。ΔΦ 用 Δ 与 Φ 拼出）' },
      { id: 'resis', text: 'R = ρL/S', toks: 'RLS' + RHO, group: '电磁学',
        cond: '电阻定律（与材料、长度、横截面积有关，与电压电流无关）' },
      { id: 'field', text: 'E = F/q', toks: 'EFq', group: '电磁学',
        cond: '电场强度的定义式（对任何电场都成立，与试探电荷 q 无关）' },
      /* 安培力 F = BIL：通电导体在磁场中受力。B 与 I 垂直时成立，
         方向用**左手定则**（让磁感线穿过手心、四指指向电流，大拇指指向安培力）。 */
      { id: 'ampere', text: 'F = BIL', toks: 'FBIL', group: '电磁学',
        cond: '安培力（B⊥I；不垂直时是 F=BILsinθ）' },
      /* 洛伦兹力 F = qvB：运动电荷在磁场中受力，方向同样用左手定则
         （正电荷；负电荷反向）。本模块做平面近似：力与 v 垂直、
         所以轨迹是圆（r = mv/(qB)）。 */
      { id: 'lorentz', text: 'F = qvB', toks: 'FqvB', group: '电磁学',
        cond: '洛伦兹力（v⊥B；不垂直时是 F=qvBsinθ）' },
      { id: 'epot', text: 'W = qU', toks: 'WqU', group: '电磁学',
        cond: '电场力做功（匀强电场与任意电场都成立，U 是两点间电势差）' },
      { id: 'flux', text: 'Φ = BS', toks: PHI + 'BS', group: '电磁学',
        cond: '磁通量的定义（B 与面垂直时；有夹角时是 Φ=BScosθ）' },
      { id: 'wave', text: 'v = λf', toks: LAMBDA + 'vf', group: '波动',
        cond: '波速公式（也写作 v=λν；f 与 ν 是同一个量。注意这里的 v 是**波速**，' +
              '横波纵波都成立）' },
      { id: 'photon', text: 'ε = hν', toks: EPS + 'h' + NU, group: '近代',
        cond: '光子能量（光电效应：h 为普朗克常量、ν 为光频率；ε 与电场强度的 E 是两个量）' },
      /* ---- 第三批基础公式（2026-10-01 用户点名："能产生效果/设定实验条件的做全"）----
         每条都带：公式 + 适用条件 + 来源级别（高中物理教材）+ 对应 eqStepOnce 的可见效果。 */
      { id: 'heatmass', text: 'Q = cm\u0394T', toks: 'Q' + 'c\u6bd4' + 'm' + DELTA + 'T', group: '热学',
        cond: '吸放热（高中物理教材）：Q=cmΔT，c 是比热容（下缀「比」；光速 c 是另一个字）——给定 Q、c、m 求 ΔT，目标温度随之变化' },
      { id: 'melt', text: 'Q = \u03bb\u7194m', toks: 'Q' + '\u03bb\u7194' + 'm', group: '热学',
        cond: '熔化/凝固热（高中物理教材）：Q=λm，相变吸放热、温度停在熔点；Q ≥ λm 时固→液（反之凝回固）' },
      { id: 'thermal-balance', text: 'Q\u5438 = Q\u653e', toks: 'QQ', group: '热学',
        cond: '热平衡（高中物理教材）：Q吸=Q放，两物体传热直至温度相等（按 m₁c₁T₁+m₂c₂T₂ 加权平均逼近）' },
      { id: 'ideal-gas', text: 'p\u538bV/T = \u6052\u91cf', toks: 'p\u538b' + 'V' + 'T', group: '热学',
        cond: '理想气体状态方程（高中物理教材）：pV/T 恒定，改一个量其余联动' },
      { id: 'isothermal', text: 'p\u538bV = \u6052\u91cf', toks: 'p\u538b' + 'V', group: '热学',
        cond: '等温变化（玻意耳定律，高中物理教材）：温度不变时 pV 恒定' },
      { id: 'isochoric', text: 'p\u538b/T = \u6052\u91cf', toks: 'p\u538b' + 'T', group: '热学',
        cond: '等容变化（查理定律，高中物理教材）：体积不变时 p/T 恒定' },
      { id: 'uniform-field', text: 'U = Ed', toks: 'U' + 'E' + 'd', group: '电磁学',
        cond: '匀强电场（高中物理教材）：U=Ed；与箭头击穿联动 —— 空气击穿场强约 3×10⁶ V/m（教材），E ≥ E_break 放电' },
      { id: 'impetus', text: '\u0394p = Ft', toks: DELTA + 'p' + 'F' + 't', group: '力学',
        cond: '动量定理（高中物理教材）：Δp=Ft（用 Δp 不用 I，避免与电流冲突）—— 目标体被冲量推动、速度改变' },
      { id: 'buoyancy', text: 'F = \u03c1gV', toks: 'F' + RHO + 'g' + 'V', group: '力学',
        cond: '浮力（阿基米德原理，高中物理教材）：F浮=ρ液gV排 —— F浮 > 重则浮、< 重则沉（可见浮沉）' },
      { id: 'pressure', text: 'p\u538b = F/S', toks: 'p\u538b' + 'F' + 'S', group: '力学',
        cond: '压强（高中物理教材）：p=F/S（F 垂直作用于面积 S）—— 读数 p 随 F、S 联动' },
      { id: 'photoelectric', text: 'E\u80fd = h\u03bd \u2212 W', toks: 'E\u80fd' + 'h' + NU + 'W', group: '近代',
        cond: '光电效应（高中物理教材）：E=hν−W —— hν ≥ W 才逸出光电子（负对照：hν < W 不逸出）' }
    ];
    /* 公式表按"字母多重集"建索引：键 = 令牌排序后的字符串 */
    var EQ_BY_SIG = {};
    var EQ_MAX = {};   // 字母 -> 在任一公式里出现的最大次数（用于 canMerge 的放行上限）
    (function () {
      for (var i = 0; i < EQUATIONS.length; i++) {
        var e = EQUATIONS[i];
        e._sig = sigOfToks(e.toks);
        /* 自检（2026-09-30）：tok 里每个字符都必须是**一个**符号字符，
           而且规范键必须与令牌**逐个字符**对得上。写 'omegaT' 这种"名字"当令牌
           曾经真的发生过 —— 它会被当成 o,m,e,g,a,T 六个字母，公式静默失效。
           宁可当场抛错，也不要一个永远认不出来的公式躺在表里。 */
        if (e._sig.length !== e.toks.length) throw new Error('psandbox: 公式令牌长度异常 ' + e.id);
        if (EQ_BY_SIG[e._sig]) throw new Error('psandbox: 公式签名冲突 ' + e.id);
        EQ_BY_SIG[e._sig] = e;
        var cnt = {};
        for (var k = 0; k < e.toks.length; k++) cnt[e.toks.charAt(k)] = (cnt[e.toks.charAt(k)] || 0) + 1;
        for (var c in cnt) if (!EQ_MAX[c] || EQ_MAX[c] < cnt[c]) EQ_MAX[c] = cnt[c];
      }
    })();
    /* 排障口：公式表自检（探针与人工排查用，只读，不参与任何逻辑） */
    function eqTableDump() {
      var out = [];
      for (var s in EQ_BY_SIG) out.push({ id: EQ_BY_SIG[s].id, sig: s, sigCodes: (function(){var a=[];for(var i=0;i<s.length;i++)a.push(s.charCodeAt(i));return a;})(), toks: EQ_BY_SIG[s].toks, text: EQ_BY_SIG[s].text });
      return out;
    }
    /* 字母多重集的**规范键**：把令牌按码点排序后拼起来。
       ⚠ 必须自己给比较器：默认的 Array.sort() 对 '½'(U+00BD) 与 'm','v'(ASCII)
       是按**码元**排的 —— 'mvv½' 会保持 m-v-v-½，而 '½mvv' 排成 ½-m-v-v，
       同一个字母集合得到两个不同的键，查表必然落空（½mv² 在"先摆 m v v 再补 ½"
       这条最自然的装配顺序上就认不出来）。用码点比较器才能得到唯一规范键。 */
    function sigOfToks(toks) {
      return String(toks).split('').sort(function (a, b) {
        var ca = a.charCodeAt(0), cb = b.charCodeAt(0);
        return ca === cb ? 0 : (ca < cb ? -1 : 1);
      }).join('');
    }
    /* 一个体的"字母多重集"签名：base（massG）与 mem 合起来数。
       为什么要合：真实用户是"先摆一个块、再把字母拖上去"，base 不在 mem 里 ——
       只看 mem 会永远凑不齐 F=ma（m 是 base）。
       ⚠ **必须按对象身份去重**：`attach()` 在空体接质量字母时会把**同一个字形**
       同时记成 massG 与 mem[0]（见 attach 里的 `if (!B.massG && isMass(d)) B.massG = d;`），
       不去重就会把 m 数成 "mm"，任何公式都匹配不上 —— 移植记录里"④ tokenSeq 会把
       同一个字母数两遍"是同一个坑，别再踩。
       ⚠ 运算符**不参与公式身份判定**（2026-09-30 移植清单 P2-8）：F+=+m+a ≡ F+m+a，
       '='/'+'/'²' 等只算"写法"，这里一律跳过 —— 否则 F+=+m+a 永远认不出 newton2。 */
    function toksOfBody(B) {
      var s = '', seen = [];
      if (B.massG && !B.massG.dead && !isOp(B.massG.type)) { s += B.massG.type; seen.push(B.massG); }
      for (var i = 0; i < B.mem.length; i++) {
        var g = B.mem[i];
        if (!g || g.dead || seen.indexOf(g) >= 0) continue;
        if (isOp(g.type)) continue;
        seen.push(g);
        s += g.type;
      }
      return s;
    }
    /* 这个体当前**已经拼齐**的公式（没有就是 null） */
    function eqOfBody(B) {
      if (!B || B.kind) return null;
      var sig = sigOfToks(toksOfBody(B));
      return EQ_BY_SIG[sig] || null;
    }
    /* 再加一个字 d.type 之后会不会**拼齐**某条公式 */
    function eqCompletes(B, ch) {
      if (!B || B.kind) return null;
      var sig = sigOfToks(toksOfBody(B) + ch);
      return EQ_BY_SIG[sig] || null;
    }
    /* 这个体的字母是否**还是**某条公式的前缀（用来决定"该不该收这个字"）。
       返回 true 表示"收下它以后，字母集合仍被某条公式容纳"；false 表示会变成
       一条公式都装不下的杂牌 —— 那种情况沿用原有 canMerge 的宽松规则，不许拦。 */
    function eqAccepts(B, ch) {
      var has = toksOfBody(B) + ch, sig = sigOfToks(has), cnt = {};
      for (var i = 0; i < sig.length; i++) cnt[sig.charAt(i)] = (cnt[sig.charAt(i)] || 0) + 1;
      for (var s in EQ_BY_SIG) {
        var e = EQ_BY_SIG[s], ok = true, need = {};
        for (var k = 0; k < e.toks.length; k++) need[e.toks.charAt(k)] = (need[e.toks.charAt(k)] || 0) + 1;
        for (var c in cnt) if ((need[c] || 0) < cnt[c]) { ok = false; break; }
        if (ok) return true;
      }
      return false;
    }
    /* eqGroupFor(chars)：这组字母**整体**属于哪条公式（找不到就 null）。
       判据：这组字母作为多重集是某条公式字母集的**子集**，取最短的那条 = "目的地"。
       用途（2026-09-30 加法式改法）：判断"以场符号打头的一组字形，是不是在拼公式" ——
       是的话就让场符号当**字形**参与组合；不是的话它照旧生成场体。 */
    function eqGroupFor(chars) {
      var i, cnt = {}, s;
      for (i = 0; i < chars.length; i++) cnt[chars.charAt(i)] = (cnt[chars.charAt(i)] || 0) + 1;
      var best = null;
      for (s in EQ_BY_SIG) {
        var e = EQ_BY_SIG[s], need = {}, ok = true, k;
        for (k = 0; k < e.toks.length; k++) need[e.toks.charAt(k)] = (need[e.toks.charAt(k)] || 0) + 1;
        for (var c in cnt) if ((need[c] || 0) < cnt[c]) { ok = false; break; }
        if (!ok) continue;
        if (!best || e.toks.length < best.toks.length) best = e;
      }
      return best;
    }

    /* ---------------- 体（Body） ---------------- */
    function BODY(x, y) {

      var B = { x: x, y: y, vx: 0, vy: 0, th: 0, sc: 1, glyphs: [], mem: [],
                massG: null, mass: 1, hasG: false, hasA: false, hasV: false, hasR: false,
                family: 0, hw: 40, hh: 26, dv: 0, drag: false, diss: false, orbit: null,
                pendingOrbit: false, kind: null, fg: null, fieldR: 0, Bz: 1, qsign: 1,
                Isign: 1, fieldState: null, L: 48, bh: null,
                st: { open: null, close: null, plus: null, sq: null, slash: null } };
      bodies.push(B);
      return B;
    }

    function spawnField(kind, x, y, svx, svy) {
      var B = BODY(x, y);
      B.kind = kind;
      var g = GD(kind);
      g.pop = 0; g.body = B; g.inBody = true;
      B.fg = g;
      B.glyphs = [g];
      var sp = Math.hypot(svx || 0, svy || 0);
      var f = sp > 20 ? clamp(1 - sp / 6000, 0.5, 1) : 0;
      if (kind === 'B') { B.fieldR = B_FIELD_RANGE; B.Bz = BZ_DIR; B.vx = 0; B.vy = 0; }
      else if (kind === 'E') { B.fieldR = E_FIELD_RANGE; B.th = 0; B.vx = 0; B.vy = 0; }
      else if (kind === 'q') { B.qsign = 1; B.vx = (svx || 0) * f; B.vy = (svy || 0) * f; }
      else if (kind === 'I') { B.Isign = 1; B.vx = (svx || 0) * f; B.vy = (svy || 0) * f; }
      refresh(B);
      ringGo(B.x, B.y);
      return B;
    }

    function makeRod(x, y, vx, vy) {
      var B = BODY(x, y);
      B.kind = 'T';        // vt→木板：像地面一样细的一条线，但可拖可转
      B.fg = null;
      B.hasG = true;       // 有重量、会落到地面停住，和真木板一样
      B.len = 170; B.php = F * 0.55;
      refresh(B);
      B.vx = vx || 0; B.vy = vy || 0;
      return B;
    }

    function tAnchor(B) {
      if (B.kind) return { x: B.x, y: B.y };
      return B.massG ? slot(B, B.massG) : { x: B.x, y: B.y };
    }

    /* ---------------- 't' 的三条组合路径 ---------------- */
    function findTComboTarget(L) {
      // t 只和这三种东西结合：场符号 q -> I（电流）；带 g 的体 -> gt -> v；带 v（且没有 g）
      // 的体 -> vt -> 木板。附近**游离**的小写 v 也能就地变木板（所以"先扔个 v 再放 t"也成立）。
      // 关键：组合**只由字母 t 触发** —— 别的字母绝不能被劫持（把第二个 v 拖到 mv 上必须
      // 得到 mv²，而不是把整个体变成木板）。
      if (!L || L.type !== 't') return null;
      var best = null, bd = 150;
      for (var fvi = 0; fvi < freeL.length; fvi++) {
        var FV = freeL[fvi];
        if (FV.type !== 'v' || FV === L || FV.dead) continue;
        var df = Math.hypot(FV.wx - L.wx, FV.wy - L.wy);
        if (df < bd) { bd = df; best = { fv: FV, kind: 'vt' }; }
      }
      if (!best) {
        for (var i = 0; i < bodies.length; i++) {
          var B = bodies[i];
          if (B.massG === L || B.mem.indexOf(L) >= 0) continue;
          var a = tAnchor(B);
          var d = Math.hypot(a.x - L.wx, a.y - L.wy);
          if (d > bd) continue;
          var memHasQ = false;
          for (var mq = 0; mq < B.mem.length; mq++) if (B.mem[mq] && B.mem[mq].type === 'q' && !B.mem[mq].dead) { memHasQ = true; break; }
          var ok = false, kind = '';
          /* q 有两条识别方式：① 已经是 q 场体（原有）；② 字母 q 在这个体的 mem 里
             —— addBody(['q','t']) 这类"q 打头、后面还有别字形"的装配会先把 q
             当普通 base 挂着（见 dropLetter 的 firstOfGroup），此时 kind 还是 null，
             只看 kind 就会漏掉 qt→I。这条不会误伤：既有任何体的 mem 里都不可能有 q
             （q 一旦落字就是场体，永不进 mem）。 */
          if (B.kind === 'q' || memHasQ) { ok = true; kind = 'qt'; }
          else if (B.kind && B.kind !== 'T') { continue; }
          else if (B.hasG && B.mem.length <= 2 && !B.hasGrav) { ok = true; kind = 'gt'; }
          else if ((B.kind === 'T') || (B.hasV && !B.hasG && !B.hasR && !B.hasGrav && B.mem.length <= 1)) { ok = true; kind = 'vt'; }
          if (ok && d < bd) { bd = d; best = { B: B, kind: kind }; }
        }
      }
      return best;
    }

    function applyTCombo(L, c) {
      var B = c.B;
      var touched = L.lastBody || null;   // 记录"本次落字作用到的体"，供 addBody/debug 读
      L.lastBody = null;
      if (c.kind === 'vt' && c.fv) {
        var rod = makeRod(L.wx, L.wy, 0, 0);   // 游离 v + t -> 就地变木板
        killLetter(c.fv);
        killLetter(L);
        ringGo(rod.x, rod.y);
        touched = rod;
        rod.lastBody = null;
        L.lastBody = rod;
        return rod;
      }
      if (c.kind === 'qt') {
        // 电流：t 落到场符号 q 上 -> q 变成 I。这就是"qt 组合变成 I"。
        if (B.fg) { B.fg.body = null; B.fg.inBody = false; killLetter(B.fg); B.fg = null; }
        B.kind = 'I'; B.Isign = 1;
        var ng = GD('I'); ng.pop = 0; ng.body = B; ng.inBody = true; B.fg = ng;
        killLetter(L);
        refresh(B); ringGo(B.x, B.y);
        L.lastBody = B;
        return B;
      }
      if (c.kind === 'gt') {
        // gt -> v：把 g 和 t 都去掉，补一个 v（g·t = v）
        for (var qi = B.mem.length - 1; qi >= 0; qi--) {
          if (B.mem[qi].type === 'g') { var gi2 = B.mem[qi]; B.mem.splice(qi, 1); killLetter(gi2); }
        }
        if (B.massG && B.massG.type === 'g') B.massG = null;   // base 就是那个 g：一起撤掉
        killLetter(L);
        var vg = GD('v'); vg.pop = 0; vg.body = B; vg.inBody = true; B.mem.push(vg);
        restoreBase(B);
        refresh(B); ringGo(B.x, B.y);
        L.lastBody = B;
        return B;
      }
      if (c.kind === 'vt') {
        // vt -> 木板：原来的质量-v 体变成实心杆（像地面，但可移动/可旋转）
        for (var jj = B.glyphs.length - 1; jj >= 0; jj--) {
          var og = B.glyphs[jj];
          if (og.body === B) { og.body = null; og.inBody = false; killLetter(og); }
        }
        for (var mmi = B.mem.length - 1; mmi >= 0; mmi--) { var mo2 = B.mem[mmi]; B.mem.splice(mmi, 1); killLetter(mo2); }
        killLetter(L);
        B.massG = null;
        B.hasG = true; B.hasV = false; B.kind = 'T'; B.fg = null;
        B.len = 170; B.php = F * 0.55;
        refresh(B); ringGo(B.x, B.y);
        L.lastBody = B;
        return B;
      }
      return touched;
    }

    /* ---------------- 公式语义（内容即行为） ---------------- */
    function setF(B) {
      B.hasG = false; B.hasA = false; B.hasV = false; B.hasR = false;
      B.hasHalf = false; B.hasMu = false; B.hasC = false; B.hasGrav = false;
      for (var i = 0; i < B.mem.length; i++) {
        var tt = B.mem[i].type;
        if (tt === 'g') B.hasG = true;
        else if (tt === 'a') B.hasA = true;
        else if (tt === 'v') B.hasV = true;
        else if (tt === 'r') B.hasR = true;
        else if (tt === HALF) B.hasHalf = true;
        else if (tt === MU) B.hasMu = true;
        else if (tt === 'c') B.hasC = true;
        else if (tt === 'G') B.hasGrav = true;
      }
      B.family = (B.hasG || B.hasA || B.hasMu || B.hasC || B.hasGrav) ? 1 : ((B.hasV || B.hasR || B.hasHalf) ? 2 : 0);
      B.vCount = 0;
      for (var k = 0; k < B.mem.length; k++) if (B.mem[k].type === 'v') B.vCount++;
      B.cCount = 0;
      for (var k2 = 0; k2 < B.mem.length; k2++) if (B.mem[k2].type === 'c') B.cCount++;
      B.rCount = 0;
      for (var rk = 0; rk < B.mem.length; rk++) if (B.mem[rk].type === 'r') B.rCount++;
      // ---- 引力公式的形态（唯一真源）----
      // 'schwarz' : 2GM/c²  -> 要 G、大写 M、至少一个 c（不要 r）。小写 m 不属于这条
      //             公式，所以它是被**藏起来**而不是画在 GM 上面。
      // 'well'    : GMm/r²  -> 要 G、大写 M **和小写 m**，还要 r²。光有 GM/r² 是残缺
      //             公式：没有引力圈、也没有引力。
      // 'plain'   : 残缺的引力体，按普通乘积排。
      B.gravMode = gravModeOf(B);
      B.isSchwarzschild = !!(B.gravMode === 'schwarz' && B.cCount >= 2);
      B.isWell = !!(B.gravMode === 'well');
      if (B.massG) B.mass = (B.massG.type === 'M') ? 3 : 1;
      /* ---- 课本公式识别（符号扩展）----
         字母集合正好等于某条公式的组成 -> 记下它，render() 会在体周围画公式卡，
         bodyState().eq / eqText 供探针与上层页面读。
         ⚠ 这里**只做识别**：绝不因此改写 hasG/hasA/hasV/isWell/mass 等既有行为字段
         （公式体不额外施力、不被吸引），否则会改变原有手感与确定性断言。 */
      var eq = eqOfBody(B);
      if (eq && !B.eq) {
        /* 成式那一刻（null → 某条公式）：成就「成式」+ 操作日志 assemble（2026-10-01） */
        eqEmit('formula', B, { eq: eq.id, text: eq.text });
        opLog('assemble', { eq: eq.id, text: eq.text });
        B.paramSide = 0;   /* 2026-10-01 = 右→左：没放 = 之前显示右式（左侧量淡出） */
      } else if (!eq && B.eq) {
        B.paramSide = 0;   // 公式散了：= 状态作废
      }
      B.eq = eq ? eq.id : null;
      B.eqText = eq ? eq.text : null;
      /* = 的"这一侧"淡出（2026-10-01 右→左语义）；公式散了就全亮 */
      if (B.eq) applySideFade(B);
      else {
        for (var fz = 0; fz < B.mem.length; fz++) if (B.mem[fz] && B.mem[fz].fade != null) B.mem[fz].fade = null;
        if (B.massG && B.massG.fade != null) B.massG.fade = null;
      }
    }

    function gravModeOf(B) {
      if (!B.hasGrav) return 'plain';
      // 大小写质量各数一份：base（massG）与 mem 都要看。
      // 为什么两个都看：base 是 G 的体也必须能成立 —— 玩家"先摆 G、再拖 M m r
      // 上去"是完全正常的装配顺序；只认 base 会让这条路 gravMode 永远是 plain
      // （没有引力圈、也没有引力），而画面明明写着 GMm/r²。
      var Mtot = 0, mtot = 0;
      if (B.massG) { if (B.massG.type === 'M') Mtot++; else if (B.massG.type === 'm') mtot++; }
      var rc = 0, cc2 = 0;
      for (var i = 0; i < B.mem.length; i++) {
        var t = B.mem[i].type;
        if (t === 'M') Mtot++;
        else if (t === 'm') mtot++;
        else if (t === 'r') rc++;
        else if (t === 'c') cc2++;
      }
      if (Mtot >= 1 && cc2 >= 1 && rc < 2) return 'schwarz';
      // 'well' 只要求**至少一个 r**：引擎本来就把 GMm/r² 的 ² 当**结构字形**
      // 自动补（这是原作的设计，"2GM/c²" 与 "½mv²" 的 ² 同理），玩家从面板里
      // 拿不到 ² 这个字形，只会有字母序列 G M m r。要求 rc>=2 会让
      // GMm/r 永远停在 plain —— 画面上明明写着分数形式的引力式，却没有引力圈、
      // 也不吸引任何东西。所以这里按"一个 r 就代表分母的 r²"判定。
      if (Mtot >= 1 && mtot >= 1 && rc >= 1) return 'well';
      return 'plain';
    }

    /* 字母在体里的排版次序权重。½ 必须排在**最前**：½mv² 是"系数 × 量"，
       读作"二分之一 m v 平方"；如果 ½ 排在后面（'mv²½'）就不是课本写法了。
       （2026-09-30 符号扩展时 ½ 一度按默认权重 3 落在末尾，这里显式定到 -1。）
       ⚠ 排序只在"公式没拼齐"时才做（见 layoutBody 的决定）——拼齐的公式用
       EQUATIONS 里的 toks 原序排版（½mv 就是 ½mv）。这里只负责没拼齐时的观感。 */
    function wLet(x) {
      if (x === HALF) return -1;
      if (x === 'g') return 0;
      if (x === 'a') return 1;
      if (x === 'v') return 2;
      return 3;
    }

    /* 结构字形（括号 / 加号 / ² / 分数线）按公式形态实时增删 */
    function ensureSt(B) {
      var p1 = (B.family === 1 && B.mem.length >= 2 && B.cCount < 2 && !(B.hasGrav || B.hasR));
      /* ★ 手写分数（÷）不套自动括号：括号版式是"整行一项一项并排"，与四格分数会打架 */
      if (B.div && B.div.on) p1 = false;
      var keeps = [];
      function live(k, ch, sc) {
        if (!B.st[k] || B.st[k].dead) { if (B.st[k]) killG(B.st[k]); B.st[k] = stGD(ch, sc); }
        var g = B.st[k];
        if (B.glyphs.indexOf(g) < 0) B.glyphs.push(g);
        g.body = B; g.s = 1; keeps.push(g);
      }
      function dead(k) { if (B.st[k]) { killG(B.st[k]); B.st[k] = null; } }
      if (p1) { live('open', OPEN); live('plus', PLUS); live('close', CLOSE); }
      else { dead('open'); dead('plus'); dead('close'); }
      var gMode = gravModeOf(B);
      var pSq = (B.family === 2 && B.vCount >= 2) || (B.family === 1 && B.cCount >= 2 && !B.hasGrav) ||
                (B.hasGrav && B.rCount >= 2) || (gMode === 'schwarz' && B.cCount >= 2);
      /* 托盘里现在有真 ²（2026-09-30 移植清单 P2-7）：玩家拖上来的 ² 要**顶掉**
         自动生成的结构 ²，否则 mv² 会画出两个平方（一个自动的、一个玩家拖的）。
         与 ½ 的 h2 槽位同一套写法：有真字形就绑真字形。 */
      var sqG = null;
      for (var sqi = 0; sqi < B.mem.length; sqi++) {
        if (B.mem[sqi] && B.mem[sqi].type === SQ && !B.mem[sqi].dead) { sqG = B.mem[sqi]; break; }
      }
      if (pSq) {
        if (sqG) {
          if (B.st.sq && B.st.sq !== sqG) killG(B.st.sq);
          B.st.sq = sqG;
          if (B.glyphs.indexOf(sqG) < 0) B.glyphs.push(sqG);
          sqG.body = B; sqG.s = 1; keeps.push(sqG);
          /* 结构 ² 一直是 0.6 倍字号 —— 玩家拖来的真 ² 也缩到同一档，
             排版度量（m/w/h）一并重取，视觉与老版逐像素一致。 */
          if (sqG.el.style.fontSize !== (F * 0.6) + 'px') {
            sqG.el.style.fontSize = (F * 0.6) + 'px';
            sqG.w = sqG.el.offsetWidth; sqG.h = sqG.el.offsetHeight;
            sqG.m = met(SQ, F * 0.6);
          }
        } else { live('sq', SQ, 0.6); }
      } else { dead('sq'); }
      // 引力体一旦到手分母字母（r 或 c）就立刻变分数，字母就不可能压在分子上
      // 手写分数（÷）也要横线：空分子/空分母时它就是那个"可瞄的目标"
      var pFrac = (gMode === 'schwarz') || (B.family === 2 && (B.hasR || B.hasHalf) && B.vCount >= 2) ||
                  (B.hasGrav && B.hasR) || !!(B.div && B.div.on);
      if (pFrac) { live('bar', BAR); } else { dead('bar'); }
      // h2 槽位：½（半个）与 2GM/c² 的前导 2 共用这个"分母上的那个 2"。
      // 关键：如果这个体身上真的有一个 ½ 字形（玩家从面板拖来的），就把槽位
      // **绑到那个真字形**上，而不是另造一个隐藏的替身 —— 替身路线会这样翻车：
      // layoutFrac 用替身排版（½ 的墨迹因此被算进分子），真正的 ½ 却因为不在
      // B.glyphs 里被 refresh 藏起来（display:none），画面上只剩一个莫名其妙的
      // "2" 挂在分数线下沿，等于把 ½mv² 画丢了。
      var halfG = null;
      for (var hq = 0; hq < B.mem.length; hq++) {
        if (B.mem[hq] && B.mem[hq].type === HALF && !B.mem[hq].dead) { halfG = B.mem[hq]; break; }
      }
      if (B.hasHalf && halfG) {
        if (B.st.h2 && B.st.h2 !== halfG) killG(B.st.h2);   // 丢掉以前那个替身
        B.st.h2 = halfG;
        if (B.glyphs.indexOf(halfG) < 0) B.glyphs.push(halfG);
        halfG.body = B; halfG.s = 1; keeps.push(halfG);
      } else if (B.hasHalf || B.isSchwarzschild) { live('h2', '2'); }
      else { dead('h1'); dead('h2'); }
      for (var i = B.glyphs.length - 1; i >= 0; i--) {
        var g2 = B.glyphs[i];
        if (g2.stk && keeps.indexOf(g2) < 0) { B.glyphs.splice(i, 1); killG(g2); }
      }
    }

    /* ---------------- 手写公式排版引擎 ----------------
       tokenSeq -> hRun（字距）-> placeRun（墨迹居中）-> layoutFrac/layoutGrav
       （分子/分母、下标横线、按最大尺寸自动缩放）。排版结果 hw/hh 同时就是碰撞盒。 */
    function gapPair(a, b) {
      if (b === SQ) return 1;
      if (a === SQ) return 2;
      if (a === OPEN) return 4;
      if (b === OPEN) return 6;
      if (a === PLUS) return 3;
      if (b === PLUS) return 3;
      if (b === CLOSE) return 3;
      if (isMass(a)) return (b === 'g' || b === 'v' || b === 'r' || b === 'a') ? -6 : 4;  // mv 紧贴
      return 4;
    }
    function tokenSeq(B) {
      // 同一个字形在一条公式里只能出现一次。按本引擎的规矩 base（massG）只待在
      // B.massG 里、不进 B.mem，所以 out 不会重复；但"空体直接接质量字母"那条
      // 路径（attach 的第一个字母）会让 base 同时留在 mem 里，于是 out 会把同一个
      // 字母数两遍（mv 排成 mmv）。这里按**对象身份**兜一道去重。
      var seen = [];
      var out = [];
      function push(g) {
        if (!g) return;
        for (var si = 0; si < seen.length; si++) if (seen[si] === g) return;
        seen.push(g);
        out.push(g);
      }
      push(B.massG);
      if (B.family === 0) {
        /* 纯基础体（没有 g/a/v/r/½/μ/c/G 这些"有脾气"的字母）。
           ★ 2026-09-30 符号扩展修复：这里原来**只摆质量字母**（`if (isMass(...))`），
           于是任何"非质量字母挂在质量 base 上"的体都会把那个字母**从排版里丢掉** ——
           字形还在 mem/element 里，却不在 B.glyphs 里，被 refresh 的收尾句
           `display:none` 藏掉。15 个符号的时代这条路只会被 M+m 走到（两个都是质量，
           看不出问题）；补齐 F U R N W Q 这些符号后，"先摆 m 再拖 F"是最自然的
           装配顺序，一丢就是"字母凭空消失"。现在一律摆出 mem 里的**全部**字母
           （运算符也并排摆 —— 它是"写法"的一部分，F=m 就该看见等号）。
           为什么安全：family 0 没有任何专用版式（括号/分数/上标都不参与），
           逐个平铺就是它本来就该有的样子；质量字母的相对顺序由 wLet 排序保证。 */
        for (var mi0 = 0; mi0 < B.mem.length; mi0++) push(B.mem[mi0]);
      } else if (B.family === 1) {
        if (B.mem.length === 1) { if (!isOp(B.mem[0].type)) push(B.mem[0]); }
        else if (B.cCount >= 2) {
          var c1 = null;
          for (var ci = 0; ci < B.mem.length; ci++) { if (B.mem[ci].type === 'c') { c1 = B.mem[ci]; break; } }
          push(c1);
          push(B.st.sq);
        } else {
          push(B.st.open);
          var nPushed = 0;
          for (var i = 0; i < B.mem.length; i++) {
            if (isOp(B.mem[i].type)) continue;   // 运算符不进括号排版（它只是识别-可忽略的写法）
            if (nPushed) push(B.st.plus);
            push(B.mem[i]);
            nPushed++;
          }
          push(B.st.close);
        }
      } else if (B.family === 2) {
        var vSeen = false;
        for (var j = 0; j < B.mem.length; j++) {
          var tt = B.mem[j].type;
          if (tt === 'r') continue;
          if (isOp(tt)) continue;
          if (tt === 'v') { if (vSeen) continue; vSeen = true; }
          push(B.mem[j]);
        }
        if (B.vCount >= 2) push(B.st.sq);
      }
      return out;
    }
    function kern(a, b) {
      if (a === SQ || b === SQ) return 2;
      if (a === OPEN || b === CLOSE) return 4;
      return 5;
    }
    function hRun(items) {
      var x = 0, parts = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var w = it.g.m.w * it.s;
        var gap = (i < items.length - 1) ? kern(it.g.type, items[i + 1].g.type) : 0;
        /* ★ 盒子不相交（2026-10-01 修复，用户报"公式字母重叠"的另一半）：
           字形是 DOM 元素，getBoundingClientRect 的盒子宽 = offsetWidth（整数取整），
           排版却按 measureText 的墨迹宽度推进 —— 窄字形后接宽字形时两个盒子会
           咬在一起（'I'(19px) 接 'R'(34px)：旧中心距 23.7px < 需要的 26.5px，
           重叠 ~2.8px；F(29) 接 m(42) 重叠 ~1.7px）。
           这里把中心距补到 ≥ (盒A+盒B)/2，只补"缺口"：
           · 补到刚好相接（x[i+1] = x[i]+w[i]，断言取 ≥）；
           · 缺口 ≤0.5px 的不补（GMm 的 G→M 只有 0.2px 亚像素级相接，补了会
             把永久断言 hw=76.76171875 顶掉 —— 那是逐位压死的，不许碰）。 */
        if (i < items.length - 1) {
          var bwA = (it.g.w || it.g.m.w) * it.s;
          var nxt = items[i + 1];
          var bwB = (nxt.g.w || nxt.g.m.w) * nxt.s;
          var need = (bwA + bwB) / 2;
          if (need - (w + gap) > 0.5) gap = need - w;
        }
        parts.push({ g: it.g, s: it.s, dy: it.dy, cx: x + w / 2, w: w });
        x += w + gap;
      }
      return { parts: parts, w: x };
    }
    /* placeRun：把这一行的**墨迹**整体垂直居中（不是把盒子居中） */
    function placeRun(parts, runW, centerY) {
      var top = 1e9, bot = -1e9;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        top = Math.min(top, p.dy + p.g.m.top * p.s);
        bot = Math.max(bot, p.dy + p.g.m.bot * p.s);
      }
      var dv = (top + bot) / 2;
      for (var j = 0; j < parts.length; j++) {
        var q = parts[j];
        q.g.sx = q.cx - runW / 2;
        q.g.sy = (q.dy - dv) + centerY;
      }
    }
    function layoutRun(B, items) {
      var run = hRun(items);
      placeRun(run.parts, run.w, 0);
      B.frac = false;
      var top = 1e9, bot = -1e9;
      for (var i = 0; i < run.parts.length; i++) {
        var p = run.parts[i];
        top = Math.min(top, p.dy + p.g.m.top * p.s);
        bot = Math.max(bot, p.dy + p.g.m.bot * p.s);
      }
      if (top > bot) { top = -10; bot = 10; }   // 空行兜底：别让 hw/hh 留着上一版的数
      B.hw = run.w / 2 + 5; B.hh = (bot - top) / 2 + 1; B.sc = 1; B.subBar = null;
    }
    function layoutBracket(B) {
      var toks = tokenSeq(B), items = [];
      for (var i = 0; i < toks.length; i++) items.push({ g: toks[i], s: 1, dy: 0 });
      layoutRun(B, items);
    }
    /* 分数排版：分子在上、分数线、分母在下；½ 与 r² 走"下标横线"那一支 */
    function layoutFrac(B, vG, rG) {
      var num = [{ g: B.massG, s: 1, dy: 0 }];
      if (vG) num.push({ g: vG, s: 1, dy: 0 });
      if (B.vCount >= 2 && B.st.sq) num.push({ g: B.st.sq, s: 1, dy: 0 });
      var numR = hRun(num);
      var nTop = 1e9, nBot = -1e9;
      numR.parts.forEach(function (p) { nTop = Math.min(nTop, p.dy + p.g.m.top * p.s); nBot = Math.max(nBot, p.dy + p.g.m.bot * p.s); });
      var rows = [];
      if (B.hasR && rG) { rows.push(hRun([{ g: rG, s: 1, dy: 0 }])); }
      if (B.hasHalf) { rows.push(hRun([{ g: B.st.h2, s: 1, dy: 0 }])); }
      rows.forEach(function (r) {
        r.top = 1e9; r.bot = -1e9;
        r.parts.forEach(function (p) { r.top = Math.min(r.top, p.dy + p.g.m.top * p.s); r.bot = Math.max(r.bot, p.dy + p.g.m.bot * p.s); });
      });
      var dGap = 7, subGap = 3;
      var denTop = nBot + dGap;
      var dBot, subBarY = null;
      if (rows.length === 1) {
        var r0 = rows[0], sh = denTop - r0.top;
        r0.parts.forEach(function (p) { p.g.sy = sh + p.dy; });
        dBot = r0.bot + sh;
      } else {
        var A = rows[0], Bb = rows[1];
        var ah = A.bot - A.top;
        subBarY = denTop + ah + subGap / 2;
        var shA = subBarY - subGap / 2 - A.bot;
        A.parts.forEach(function (p) { p.g.sy = shA + p.dy; });
        var shB = subBarY + subGap / 2 - Bb.top;
        Bb.parts.forEach(function (p) { p.g.sy = shB + p.dy; });
        dBot = Bb.bot + shB;
      }
      var numShift = -dGap - nBot;
      numR.parts.forEach(function (p) { p.g.sx = p.cx - numR.w / 2; p.g.sy = numShift + p.dy; });
      rows.forEach(function (r) { r.parts.forEach(function (p) { p.g.sx = p.cx - r.w / 2; }); });
      var denW = 0; rows.forEach(function (r) { denW = Math.max(denW, r.w); });
      var fracW = Math.max(numR.w, denW) + 14;
      B.st.bar.w = fracW; B.st.bar.h = 2; B.st.bar.sx = 0; B.st.bar.sy = 0;
      var wholeTop = nTop + numShift, wholeBot = dBot;
      var shiftY = -(wholeTop + wholeBot) / 2;
      numR.parts.forEach(function (p) { p.g.sy += shiftY; });
      rows.forEach(function (r) { r.parts.forEach(function (p) { p.g.sy += shiftY; }); });
      B.st.bar.sy = shiftY;
      if (subBarY != null) B.subBar = { y: subBarY + shiftY, w: Math.max(rows[0].w, rows[1].w) + 6 };
      else B.subBar = null;
      B.hw = fracW / 2 + 4; B.hh = (wholeBot - wholeTop) / 2 + 2;
      B.sc = clamp(155 / Math.max(fracW, (wholeBot - wholeTop)), 0.5, 1);   // 按最大尺寸自动缩放
      B.frac = true;
    }
    function gravParts(B) {
      // 按类型收集引力公式的零件，装配顺序随意。
      var Gg = null, bigM = null, smallM = null;
      for (var i = 0; i < B.mem.length; i++) {
        var t = B.mem[i].type;
        if (t === 'G') { if (!Gg) Gg = B.mem[i]; }
        else if (t === 'M') { if (!bigM) bigM = B.mem[i]; }
        else if (t === 'm') { if (!smallM) smallM = B.mem[i]; }
      }
      if (B.massG) {
        if (B.massG.type === 'M') { if (!bigM) bigM = B.massG; }
        else if (B.massG.type === 'm') { if (!smallM) smallM = B.massG; }
      }
      return { Gg: Gg, bigM: bigM, smallM: smallM };
    }
    function layoutGrav(B) {
      var p = gravParts(B), Gg = p.Gg, bigM = p.bigM, smallM = p.smallM, rG = null;
      for (var i = 0; i < B.mem.length; i++) { if (B.mem[i].type === 'r') rG = B.mem[i]; }
      var cG = null;
      for (var ci = 0; ci < B.mem.length; ci++) { if (B.mem[ci].type === 'c') { cG = B.mem[ci]; break; } }
      var mode = gravModeOf(B);
      function gravItems() {
        var a = [];
        if (B.isSchwarzschild && B.st.h2) a.push({ g: B.st.h2, s: 1, dy: 0 });  // 自动补的前导 2
        if (Gg) a.push({ g: Gg, s: 1, dy: 0 });
        if (bigM) a.push({ g: bigM, s: 1, dy: 0 });
        if (smallM && mode !== 'schwarz') a.push({ g: smallM, s: 1, dy: 0 });   // 2GM/c² 没有小 m
        return a;
      }
      var denMain = (B.hasR && rG) ? rG : ((mode === 'schwarz' && cG) ? cG : null);
      if (denMain) {
        var num = gravItems();
        var numR = hRun(num);
        var nTop = 1e9, nBot = -1e9;
        numR.parts.forEach(function (q) { nTop = Math.min(nTop, q.dy + q.g.m.top * q.s); nBot = Math.max(nBot, q.dy + q.g.m.bot * q.s); });
        var den = [{ g: denMain, s: 1, dy: 0 }];
        if (B.st.sq && (B.isSchwarzschild || B.rCount >= 2)) {
          // 上标 ²：抬到它的**下沿**比分母主字形的上沿高 4px（真指数），由度量算出
          var sqM = B.st.sq.m || { bot: 8, top: -12 };
          den.push({ g: B.st.sq, s: 1, dy: (denMain.m.top - sqM.bot) - 4 });
        }
        var dR = hRun(den);
        var dBot = -1e9;
        dR.parts.forEach(function (q) { dBot = Math.max(dBot, q.dy + q.g.m.bot * q.s); });
        var dGap = 7;
        var denTop = nBot + dGap;
        var shR = denTop - denMain.m.top;
        dR.parts.forEach(function (q) { q.g.sx = q.cx - dR.w / 2; q.g.sy = shR + q.dy; });
        var numShift = -dGap - nBot;
        numR.parts.forEach(function (q) { q.g.sx = q.cx - numR.w / 2; q.g.sy = numShift + q.dy; });
        var fracW = Math.max(numR.w, dR.w) + 14;
        B.st.bar.w = fracW; B.st.bar.h = 2; B.st.bar.sx = 0; B.st.bar.sy = 0;
        var wholeTop = nTop + numShift, wholeBot = dBot;
        var shiftY = -(wholeTop + wholeBot) / 2;
        numR.parts.forEach(function (q) { q.g.sy += shiftY; });
        dR.parts.forEach(function (q) { q.g.sy += shiftY; });
        B.st.bar.sy = shiftY;
        B.subBar = null;
        B.hw = fracW / 2 + 4; B.hh = (wholeBot - wholeTop) / 2 + 2;
        B.sc = clamp(155 / Math.max(fracW, (wholeBot - wholeTop)), 0.5, 1);
        B.frac = true;
      } else {
        // 还没有 r（也不在 2GM/c² 路径上）：按普通乘积 "GMm" 排。用户粘上去的每个字母
        // 都参与 —— 游离的 c 会并排摆开，既不会压在行上，也不会悄悄把 G 顶掉。
        var items = gravItems();
        for (var xi = 0; xi < B.mem.length; xi++) {
          var xg = B.mem[xi];
          if (xg.type === 'r') continue;
          var dup = false;
          for (var yj = 0; yj < items.length; yj++) if (items[yj].g === xg) { dup = true; break; }
          if (!dup) items.push({ g: xg, s: 1, dy: 0 });
        }
        var R = hRun(items);
        var top = 1e9, bot = -1e9;
        R.parts.forEach(function (q) { top = Math.min(top, q.dy + q.g.m.top); bot = Math.max(bot, q.dy + q.g.m.bot); });
        var dv = (top + bot) / 2;
        R.parts.forEach(function (q) { q.g.sx = q.cx - R.w / 2; q.g.sy = (q.dy - dv); });
        B.frac = false; B.subBar = null;
        B.hw = R.w / 2 + 5; B.hh = (bot - top) / 2 + 1;
        B.sc = clamp(155 / Math.max(R.w, (bot - top)), 0.5, 1);
        B._plainGlyphs = [];
        for (var gi2 = 0; gi2 < items.length; gi2++) B._plainGlyphs.push(items[gi2].g);
      }
    }
    /* ---------------- 手写分数（÷ 落在体上 = 一条分数横线）· 2026-10-01 ----------------
       用户原话：「把那个除号改成分母分子的形式，然后后面的字母如果放到上面就是在上面，
       放到下面就是在下面，如果放到横线后方和前方就是这两个位置另加」。
       落点相对**横线矩形**归位：
         · x 在横线两端之内、落点在横线上方 -> **分子**（横线上方、水平居中）
         · x 在横线两端之内、落点在横线下方 -> **分母**（横线下方、水平居中）
         · x 在横线左端之外 -> **前方项**（接在横线左侧、与横线同一基线）
         · x 在横线右端之外 -> **后方项**（接在横线右侧、同一基线）
       三条纪律：
       ① **归位在松手那一刻落定**（写进字形的 g.dz），之后谁动都不重算 —— 这就是"迟滞"，
          否则体一变形就会把已经放好的字母重新分类（同一位置反复横跳）。
          换格 = 双击把字形拆出来（既有手势）再拖回想要的那一格。
       ② 判公式用的**字形集合（toksOfBody）不认 ÷**（它是 isOp），所以 Q+U+C+÷
          仍然认出 C = Q/U，卡片课本写法、药丸、事件、成就全部照旧。
       ③ **落在横线正中**（|dy| ≤ DIV_HYS）按"离上/下哪边近"取 —— 正好为 0 取**上方**；
          拖动预览在这个窄带里沿用上一次的高亮（真迟滞，不闪）。
       ⚠ 多个 ÷：**最先落下的那个永远是横线**（B.div.bar，黏住不换），其余 ÷ 当**行内字形**
       排在它自己那一格里（默认"后方项"）。这样排版永远只有一条横线，不会打架。 */
    var DIV_MBAR = 34;     // 空分子/空分母时的最小横线长度（没它玩家就没得瞄）
    var DIV_PAD = 7;       // 横线相对"最宽那一行"左右各留的余量
    var DIV_GAPY = 6;      // 横线与分子/分母之间的净空
    var DIV_HYS = 2;       // 拖动预览在横线附近的迟滞半带（px）
    var DIV_MAXL = 12;     // 一个手写分数组最多收几个字母（防病态堆叠）
    var divHiB = null;     // 当前高亮的"手写分数"体（拖动预览用）

    /* 体的成员字形（massG + mem，按对象身份去重；skip 跳过横线那个 ÷） */
    function divMembers(B, skip) {
      var out = [], seen = [];
      function push(g) {
        if (!g || g.dead || g === skip) return;
        for (var i = 0; i < seen.length; i++) if (seen[i] === g) return;
        seen.push(g); out.push(g);
      }
      push(B.massG);
      for (var i = 0; i < B.mem.length; i++) push(B.mem[i]);
      return out;
    }
    /* 结构状态对齐：有 ÷ 就是手写分数；÷ 被拆走 -> 结构关掉，回到普通排版。
       兜底归位：没有格子的字形（右键复制出来的新体、拆分后重挂）一律进**分子**；
       多出来的 ÷ 排到"后方项"。 */
    function divSync(B) {
      var dg = null;
      if (B.div && B.div.bar && !B.div.bar.dead && B.mem.indexOf(B.div.bar) >= 0) dg = B.div.bar;
      if (!dg) {
        for (var i = 0; i < B.mem.length; i++) {
          var g = B.mem[i];
          if (g && !g.dead && g.type === DIV) { dg = g; break; }
        }
      }
      if (!dg) { B.div = null; B.divGlyphs = null; return null; }
      if (!B.div) B.div = { on: true, bar: dg, hi: null };
      B.div.on = true; B.div.bar = dg;
      var list = divMembers(B, dg);
      for (var j = 0; j < list.length; j++) {
        var m = list[j];
        if (m.type === DIV) { if (!m.dz || m.dz === 'bar') m.dz = 'right'; continue; }
        if (!m.dz) m.dz = 'num';
      }
      dg.dz = 'bar';
      return dg;
    }
    /* 横线在世界坐标里的矩形（落点判定与拖动预览都读它） */
    function divBarRect(B) {
      if (!B.div || !B.div.on || !B.st.bar || B.st.bar.dead) return null;
      var b = B.st.bar;
      var s = slot(B, b);
      var hw = (b.w / 2) * (B.sc || 1);
      return { cx: s.x, cy: s.y, left: s.x - hw, right: s.x + hw, y: s.y, w: b.w * (B.sc || 1) };
    }
    /* 落点 -> 格（世界坐标）。横线矩形之外按左右分"前方项/后方项"。 */
    function divZoneOf(B, wx, wy) {
      var r = divBarRect(B);
      if (!r) return null;
      if (wx < r.left) return 'left';
      if (wx > r.right) return 'right';
      return (wy <= r.y) ? 'num' : 'den';
    }
    /* 把一个字形按落点归格（松手那一刻调用一次；之后黏住） */
    function divAssign(B, g, wx, wy) {
      if (!B.div || !B.div.on || !g || g === B.div.bar) return;
      var z = divZoneOf(B, wx, wy);
      if (z) g.dz = z;
    }
    /* 第一个 ÷ 落到体上：这个体从此是"手写分数"。
       已经在体上的字母按**它们相对这个 ÷ 的落点**归位（线以上/压线 -> 分子，线以下 -> 分母）：
       这是"放到上面就是在上面"这条规则对老字母的自然延伸，也是唯一可预测的默认。 */
    function divTurnOn(B, d) {
      if (B.div && B.div.on) {
        if (!B.div.bar || B.div.bar.dead) B.div.bar = d;
        else { d.dz = (B.div.bar === d) ? 'bar' : 'right'; return; }   // 多出来的 ÷：行内，默认后方
      } else {
        B.div = { on: true, bar: d, hi: null };
      }
      d.dz = 'bar';
      var lineY = (d.wy == null) ? null : d.wy;
      var list = divMembers(B, d);
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        if (g.type === DIV) { g.dz = 'right'; continue; }
        if (lineY == null) { g.dz = 'num'; continue; }
        var s = slot(B, g);
        g.dz = (s.y <= lineY) ? 'num' : 'den';
      }
    }
    /* 手写分数的排版：分子/分母各自水平居中，横线 = max(分子宽, 分母宽) + 左右余量，
       前方项/后方项与横线同一基线接在两端。**不自动缩放**（sc=1）——缩放会让落点判定跟着变。 */
    function layoutDiv(B) {
      var bar = B.div.bar;
      var rows = { num: [], den: [], left: [], right: [] };
      var list = divMembers(B, bar);
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        var z = (g.type === DIV) ? 'right' : (g.dz || 'num');
        if (z !== 'num' && z !== 'den' && z !== 'left' && z !== 'right') z = 'num';
        rows[z].push(g);
      }
      /* 自动结构 ²（mv² 的那个）跟着分子走：它属于分子里那个 v */
      if (B.st.sq && !B.st.sq.dead) rows.num.push(B.st.sq);
      function items(arr) {
        var o = [];
        for (var k = 0; k < arr.length; k++) o.push({ g: arr[k], s: 1, dy: 0 });
        return o;
      }
      function ink(r) {
        var t = 1e9, b = -1e9;
        for (var k = 0; k < r.parts.length; k++) {
          t = Math.min(t, r.parts[k].dy + r.parts[k].g.m.top * r.parts[k].s);
          b = Math.max(b, r.parts[k].dy + r.parts[k].g.m.bot * r.parts[k].s);
        }
        return { top: t, bot: b };
      }
      var numR = hRun(items(rows.num)), denR = hRun(items(rows.den));
      var leftR = hRun(items(rows.left)), rightR = hRun(items(rows.right));
      var nI = ink(numR), dI = ink(denR), lI = ink(leftR), rI = ink(rightR);
      var barW = Math.max(numR.w, denR.w, DIV_MBAR) + DIV_PAD * 2;
      var leftW = leftR.w ? (leftR.w + 5) : 0;
      var rightW = rightR.w ? (rightR.w + 5) : 0;
      var totalW = leftW + barW + rightW;
      var barCx = -totalW / 2 + leftW + barW / 2;
      var half = barW / 2;
      /* 分子：墨迹下沿落在横线上方 DIV_GAPY；分母：墨迹上沿落在横线下方 DIV_GAPY */
      var numSh = numR.parts.length ? (-DIV_GAPY - nI.bot) : 0;
      var denSh = denR.parts.length ? (DIV_GAPY - dI.top) : 0;
      numR.parts.forEach(function (q) { q.g.sx = barCx + (q.cx - numR.w / 2); q.g.sy = numSh + q.dy; });
      denR.parts.forEach(function (q) { q.g.sx = barCx + (q.cx - denR.w / 2); q.g.sy = denSh + q.dy; });
      var lMid = (lI.top + lI.bot) / 2, rMid = (rI.top + rI.bot) / 2;
      var lx0 = barCx - half - 5 - leftR.w;
      leftR.parts.forEach(function (q) { q.g.sx = lx0 + q.cx; q.g.sy = q.dy - lMid; });
      var rx0 = barCx + half + 5;
      rightR.parts.forEach(function (q) { q.g.sx = rx0 + q.cx; q.g.sy = q.dy - rMid; });
      /* 整体竖直居中（横线先摆在本地 y=0，再统一平移；空分数也要占住横线的高度） */
      var top = -1, bot = 1;
      if (numR.parts.length) { top = Math.min(top, nI.top + numSh); bot = Math.max(bot, nI.bot + numSh); }
      if (denR.parts.length) { top = Math.min(top, dI.top + denSh); bot = Math.max(bot, dI.bot + denSh); }
      if (leftR.parts.length) { top = Math.min(top, lI.top - lMid); bot = Math.max(bot, lI.bot - lMid); }
      if (rightR.parts.length) { top = Math.min(top, rI.top - rMid); bot = Math.max(bot, rI.bot - rMid); }
      var shiftY = -(top + bot) / 2;
      var vis = [];
      function put(r) {
        for (var k = 0; k < r.parts.length; k++) { var q = r.parts[k]; q.g.sy += shiftY; vis.push(q.g); }
      }
      put(numR); put(denR); put(leftR); put(rightR);
      bar.sx = barCx; bar.sy = shiftY;                 // 隐藏的 ÷：也要有槽位（massG 可能指向它）
      B.st.bar.w = barW; B.st.bar.h = 2; B.st.bar.sx = barCx; B.st.bar.sy = shiftY;
      if (B.st.bar && !B.st.bar.dead) vis.push(B.st.bar);
      B.hw = totalW / 2 + 5;
      B.hh = (bot - top) / 2 + 2;
      B.sc = 1;
      B.frac = true; B.subBar = null;
      B.divGlyphs = vis;
      B.div.dbg = { barW: barW, totalW: totalW, top: top, bot: bot, shiftY: shiftY,
                    n: rows.num.length, d: rows.den.length, l: rows.left.length, r: rows.right.length,
                    rowW: { num: numR.w, den: denR.w, left: leftR.w, right: rightR.w } };
    }

    /* ---- 拖动预览（2026-10-01）：拖着字形靠近某个手写分数时，高亮它要落进去的那一格 ---- */
    function divPreviewFor(L) {
      var best = null, bd = 1e9;
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (!B.div || !B.div.on) continue;
        var r = divBarRect(B);
        if (!r) continue;
        var d = Math.hypot(L.wx - r.cx, L.wy - r.y);
        if (d < 150 && d < bd) { bd = d; best = B; }
      }
      if (divHiB && divHiB !== best) divHiB.div.hi = null;
      divHiB = best;
      if (!best) return;
      var rr = divBarRect(best);
      if (!rr) return;
      var z = divZoneOf(best, L.wx, L.wy);
      /* 迟滞：落在横线 ±DIV_HYS 的窄带里就沿用上一次的高亮，别在线上反复横跳 */
      if (z && Math.abs(L.wy - rr.y) <= DIV_HYS && best.div.hi) z = best.div.hi;
      best.div.hi = z;
    }
    function divPreviewClear() {
      if (divHiB && divHiB.div) divHiB.div.hi = null;
      divHiB = null;
    }

    function layoutBody(B) {
      repairBase(B);
      B.mem.sort(function (x, y) { return wLet(x.type) - wLet(y.type); });
      divSync(B);                                   // ★ ÷ 手写分数：先把结构状态对齐
      ensureSt(B);
      /* ★ 手写分数（÷）优先于通用排版：÷ 一旦落在体上，这个体就按"四格"排。
         引力体（GMm/r²、2GM/c²）除外 —— 它自己就是一套分数版式，两套会打架。 */
      if (B.div && B.div.on && !B.hasGrav) { layoutDiv(B); return; }
      if (B.hasGrav) { layoutGrav(B); return; }
      var isFrac = B.family === 2 && (B.hasR || B.hasHalf) && B.vCount >= 2;
      var vG = null, rG = null;
      for (var i = 0; i < B.mem.length; i++) {
        if (B.mem[i].type === 'v' && !vG) vG = B.mem[i];
        if (B.mem[i].type === 'r' && !rG) rG = B.mem[i];
      }
      if (B.family === 1) {
        if (B.cCount >= 2) {
          var cg = null;
          for (var ci2 = 0; ci2 < B.mem.length; ci2++) { if (B.mem[ci2].type === 'c') { cg = B.mem[ci2]; break; } }
          var num = [{ g: B.massG, s: 1, dy: 0 }];
          if (cg) num.push({ g: cg, s: 1, dy: 0 });
          if (B.st.sq) num.push({ g: B.st.sq, s: 1, dy: 0 });
          layoutRun(B, num);
          return;
        }
        layoutBracket(B); return;
      }
      if (isFrac) { layoutFrac(B, vG, rG); return; }
      /* ★ 排版必须覆盖 tokenSeq 会显示的全部字形（2026-10-01 修复，用户报"公式
         字母重叠"）：原来 num2 只放 massG + 质量字母 / 第一个 v，而 tokenSeq 会
         把非质量字母（U I R、F m a、p m v 里的 p…）都排出来 —— 没拿到 sx/sy 的
         字形全部留在局部 (0,0)，公式字母叠成一坨（UIR 实测三个字形 x=742/751/743）。
         现在 num2 与 tokenSeq 的显示集**逐字一致**（同一条跳过规则、同一套对象去重）。 */
      var num2 = [{ g: B.massG, s: 1, dy: 0 }];
      if (B.family === 0) {
        for (var mq = 0; mq < B.mem.length; mq++) {
          if (B.mem[mq] === B.massG) continue;   // 按对象身份去重（与 tokenSeq 同一套）
          num2.push({ g: B.mem[mq], s: 1, dy: 0 });
        }
      } else {
        var vSeen2 = false;
        for (var mq2 = 0; mq2 < B.mem.length; mq2++) {
          var tg = B.mem[mq2].type;
          if (tg === 'r' || isOp(tg)) continue;  // 与 tokenSeq family 2 的跳过规则一致
          if (tg === 'v') { if (vSeen2) continue; vSeen2 = true; }
          if (B.mem[mq2] === B.massG) continue;
          num2.push({ g: B.mem[mq2], s: 1, dy: 0 });
        }
        if (B.vCount >= 2 && B.st.sq) num2.push({ g: B.st.sq, s: 1, dy: 0 });
      }
      layoutRun(B, num2);
    }

    /* base 复原：把字母从 mem 里摘掉之后，基础质量可能已经不在这个体上了，
       必须重新认定 —— 否则排版会拿 null 当分子，hRun 里 `it.g.m` 直接抛异常
       （gt→v 就会走到这条：base 就是被撤掉的那个 g）。
       优先沿用原来的 base（它还在 mem 里就继续用），否则取第一个质量字母。 */
    function restoreBase(B) {
      if (B.massG && !B.massG.dead && B.mem.indexOf(B.massG) >= 0) return;
      B.massG = null;
      for (var i = 0; i < B.mem.length; i++) {
        var g = B.mem[i];
        if (g && !g.dead && isMass(g)) { B.massG = g; return; }
      }
    }
    /* 排版前的最后一道保险：mem 里有字母却没有 base 时替它认一个。
       优先质量字母（正常情况），没有质量就退而取第一个活字母 —— 例如 gt→v 之后
       这个体身上只剩一个 v，也必须排得出来（渲染绝不能被半截公式打断）。 */
    function repairBase(B) {
      if (B.massG && !B.massG.dead) return;
      B.massG = null;
      var firstLive = null;
      for (var i = 0; i < B.mem.length; i++) {
        var g = B.mem[i];
        if (!g || g.dead) continue;
        if (!firstLive) firstLive = g;
        if (isMass(g)) { B.massG = g; return; }
      }
      B.massG = firstLive;
    }

    /* slot：把体本地坐标 (sx,sy) 映射成世界坐标（含旋转与缩放） */
    function slot(B, g) {
      var sc = B.sc || 1;
      var co = Math.cos(B.th), si = Math.sin(B.th);
      return { x: B.x + (g.sx * co - g.sy * si) * sc, y: B.y + (g.sx * si + g.sy * co) * sc };
    }
    function tokList(B) {
      var t = tokenSeq(B);

      for (var i = 0; i < t.length; i++) { if (t[i] && !t[i].body) t[i].body = B; }
      return t;
    }

    /* refresh：公式变了就重排（并决定哪些字形显示、哪些藏起来） */
    function refresh(B) {
      if (B.kind) { layoutField(B); return; }

      if (B.bh && (B.bh.stage === 1 || B.bh.t > 0.6)) {
        // 公式正在/已经被黑洞吞掉 —— 绝不要重建它的字形
        B.bh.fade = (B.bh.stage === 1) ? null : 0;
        return;
      }
      setF(B);

      layoutBody(B);

      if (B.frac) {
        if (B.div && B.div.on && B.divGlyphs) {
          /* ★ 手写分数（÷）：可见字形由 layoutDiv 直接算好（四格 + 额外的 ÷ + 横线）——
             绝不能走下面那两条自动分数分支，它们只认 massG/v/r/½，会把分子分母全藏掉。 */
          B.glyphs = B.divGlyphs;
        } else if (B.hasGrav) {
          B.glyphs = [];
          var gp = gravParts(B), Gg = gp.Gg, bigM = gp.bigM, smallM = gp.smallM, rGg = null, cGg = null;
          for (var q = 0; q < B.mem.length; q++) {
            var tq = B.mem[q].type;
            if (tq === 'r') rGg = B.mem[q];
            else if (tq === 'c' && !cGg) cGg = B.mem[q];
          }
          if (gravModeOf(B) === 'schwarz') {
            // 2GM/c²：自动前导 2、G、M、分数线、c、² —— 小写 m 不属于这条公式，不列进字形表（保持隐藏）
            if (B.isSchwarzschild && B.st.h2) B.glyphs.push(B.st.h2);
            if (Gg) B.glyphs.push(Gg);
            if (bigM) B.glyphs.push(bigM);
            if (B.st.bar) B.glyphs.push(B.st.bar);
            if (cGg) B.glyphs.push(cGg);
            if (B.st.sq) B.glyphs.push(B.st.sq);
          } else {
            if (Gg) B.glyphs.push(Gg);
            if (bigM) B.glyphs.push(bigM);
            if (smallM) B.glyphs.push(smallM);
            if (rGg) B.glyphs.push(rGg);
            if (B.st.sq && B.rCount >= 2) B.glyphs.push(B.st.sq);
            if (B.st.bar) B.glyphs.push(B.st.bar);
          }
        } else {
          B.glyphs = [B.massG];
          var vG = null, rG = null;
          for (var q2 = 0; q2 < B.mem.length; q2++) {
            if (B.mem[q2].type === 'v' && !vG) vG = B.mem[q2];
            if (B.mem[q2].type === 'r' && !rG) rG = B.mem[q2];
          }
          if (vG) B.glyphs.push(vG);
          if (B.st.sq) B.glyphs.push(B.st.sq);
          if (rG) B.glyphs.push(rG);
          if (B.hasHalf) { if (B.st.h2) B.glyphs.push(B.st.h2); }
          if (B.st.bar) B.glyphs.push(B.st.bar);
        }
      } else if (B.hasGrav && B._plainGlyphs) {
        B.glyphs = B._plainGlyphs;
      } else {
        B.glyphs = tokList(B);
      }

      for (var i = 0; i < B.glyphs.length; i++) { B.glyphs[i].body = B; B.glyphs[i].inBody = true; }
      // 属于这个体但**不在** B.glyphs 里的字母一律藏起来，包括基础质量 massG
      // （例如 2GM/c² 里那个小写 m —— 它不属于这条公式，否则会压在大写 M 上）
      for (var m = 0; m < B.mem.length; m++) {
        if (B.glyphs.indexOf(B.mem[m]) < 0) B.mem[m].el.style.display = 'none';
      }
      if (B.massG && B.glyphs.indexOf(B.massG) < 0) B.massG.el.style.display = 'none';
      if (B.orb && !(B.hasV && B.hasR && B.vCount >= 2)) B.orb = null;
      if (!B.orb && (B.hasV && B.hasR && B.vCount >= 2)) {
        B.orb = { spin: 0, age: 0, pulse: 0, ringPts: null, R: 120, k: 0, e: 0, gx: B.x, gy: B.y, gs: 1, ga: 1 };
      }
      // mc² 起爆：保留当前速度，膨胀期间仍然可以被推动。
      // 2GM/c²（isSchwarzschild）不爆炸 —— 它塌成黑洞。
      // 引力体（G…）永远不是 mc² 炸弹：E=mc² 要有质量 + c² 且**没有** G。
      if (B.family === 1 && B.cCount >= 2 && !B.hasGrav && !B.isSchwarzschild && !B.exploding && !B.copied) {
        B.exploding = true; B.explT = 0; B.infl = 1;
      }
      if (B.cCount < 2 || B.isSchwarzschild) { B.exploding = false; B.infl = 1; B.wob = 0; }
      if (B.isSchwarzschild && !B.bh) {
        B.bh = { stage: 0, r: 0, R: 210, t: 0, age: 0, spin: 0, seed: Math.random() * 1000, dead: false };
        ringGo(B.x, B.y);
      }
      if (!B.isSchwarzschild && B.bh && B.bh.stage === 0) B.bh = null;
    }

    function layoutField(B) {
      if (B.kind === 'T') {
        B.fg = null;
        B.hw = B.len / 2 + 2; B.hh = 4;   // 木板是 3px 细线 -> 用很薄的碰撞盒（不会浮在地面上）
        B.sc = 1; B.frac = false; B.subBar = null;
        return;
      }
      B.glyphs = [B.fg];
      B.fg.body = B; B.fg.inBody = true; B.fg.sx = 0; B.fg.sy = 0;
      B.hw = (B.fg.m.w / 2) + 8; B.hh = (B.fg.m.bot - B.fg.m.top) / 2 + 4;
      B.sc = 1; B.frac = false; B.subBar = null;
    }

    /* place()：把字形摆到世界坐标 (x,y)。
       ★ 位置一律走 **transform: translate3d()**，不再写 left/top（2026-09-30 流畅度修复）。
       为什么：.ps-char 每帧都在动，写 left/top 属于"改布局"——浏览器要为每个字形重跑
       样式/布局，而画布还压在下面（同一个 #glStage 的裁剪子树），一帧里写几十次布局属性
       在慢机器/WebView2 上就会掉帧。translate 只影响"合成"，不动布局。
       视觉完全等价：原来 left/top 与 rotate/scale 本来就合成一个变换矩阵（元素
       transform-origin 是 center，left/top 用的又是缓存尺寸 g.w/g.h），现在只是把
       那个平移也放进同一个 transform 里 —— 元素盒子仍留在 (0,0)，渲染结果逐像素一致。
       注意：世界坐标仍以 #psTable 左上角为原点（与其他函数一致），不要在这里加舞台偏移。 */
    function place(g, x, y, rot, sc, show) {
      var e = g.el;
      if (!show) { e.style.display = 'none'; return; }
      e.style.display = '';
      var t = 'translate3d(' + (x - g.w / 2) + 'px,' + (y - g.h / 2) + 'px,0) rotate(' +
              (rot || 0) + 'rad) scale(' + (sc == null ? 1 : sc) + ')';
      if (e.style.transform !== t) e.style.transform = t;
    }
    function placeLetter(d) {
      if (d.state === 'dock') {
        if (d.el.parentNode !== panel) panel.appendChild(d.el);
        d.el.style.display = '';
        d.el.style.fontSize = '34px';
        d.el.style.left = ''; d.el.style.top = ''; d.el.style.transform = '';
        return;
      }
      if (d.el.parentNode !== table) table.appendChild(d.el);
      d.el.style.fontSize = F + 'px';
      if (d.inBody && d.body) {
        var s = slot(d.body, d);
        place(d, s.x, s.y, d.body.th || 0, 1, true);
      } else if (d.state === 'free' || d.state === 'grab') {
        place(d, d.wx || 0, d.wy || 0, d.rot || 0, 1, true);
      }
      d.el.style.opacity = (d.fade != null) ? d.fade : '';
    }

    /* ---------------- 面板（字形托盘） ---------------- */
    function dockedTwins(ch, me) {
      var elements = panel.querySelectorAll('.ps-char');
      for (var i = 0; i < elements.length; i++) {
        var e = elements[i];
        if (e === me) continue;
        if (e.textContent === ch) {
          var r = e._letterRef;
          if (r && r.state === 'dock') return true;
        }
      }
      return false;
    }
    function dockLetter(d) {
      // 面板永远保留每个字母的一份"停靠副本"（从面板拖出来拿到的是克隆体）。
      // 所以克隆体停靠回来会变成重复份 —— 让它化回面板；只有"停靠副本已经离开"
      // 的字母（比如被黑洞吃了）才允许真的停靠回来填回自己的空位。
      if (dockedTwins(d.ch, d.el)) { d.body = null; d.inBody = false; killLetter(d); return; }
      d.state = 'dock'; d.body = null; d.inBody = false;
      var e = d.el;
      if (e.parentNode !== panel) panel.appendChild(e);
      e.style.display = '';
      e.style.fontSize = '34px';
      e.style.left = ''; e.style.top = ''; e.style.transform = '';
      e.style.opacity = '';
      e.classList.remove('ps-dockin');
      e.classList.add('ps-dockin');
      setTimeout(function () { if (d.state === 'dock' && e.classList) e.classList.remove('ps-dockin'); }, 240);
      sortPanel();
    }
    /* 面板当前列数：与 #psCSS 的媒体查询同步（窄屏 8 列、桌面 9 列）。
       ⚠ 格子钉位必须用**当前**列数：桌面 9 列、窄屏 8 列，用错会把第 9 个之后的
       格子钉到网格外的隐式列上（被 overflow-x:hidden 裁掉，拖不到）。 */
    function palCols() {
      if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width:768px)').matches) return 8;
      return PAL_COLS;
    }
    function dockSlotEl(e) {
      var i = PAL_ORDER[e.textContent];
      if (i == null) return;
      var cols = palCols();
      e.style.gridRowStart = (Math.floor(i / cols) + 1);
      e.style.gridColumnStart = (i % cols + 1);
    }
    function sortPanel() {
      for (var i = 0; i < PAL.length; i++) {
        var d = P[PAL[i].k];
        if (d && d.state === 'dock' && d.el.parentNode !== panel) panel.appendChild(d.el);
      }
      var arr = [].slice.call(panel.querySelectorAll('.ps-char'));
      arr.sort(function (x, y) { return PAL_ORDER[x.textContent] - PAL_ORDER[y.textContent]; });
      arr.forEach(function (e) { panel.appendChild(e); });
      // 每个停靠字母钉在**自己**的格子里：黑洞吃掉一个时其余不会重排，
      // 被吃掉的字母只是在自己的格子里留一个空位。
      for (var k2 = 0; k2 < arr.length; k2++) dockSlotEl(arr[k2]);
    }
    /* 面板重置为 15 个完好单例（清空 / 重置 / 全部收进面板 共用） */
    function rebuildPanel() {
      var old = [].slice.call(panel.querySelectorAll('.ps-char'));
      for (var i = 0; i < old.length; i++) {
        var ref = old[i]._letterRef;
        if (ref) { ref.dead = true; var fi = freeL.indexOf(ref); if (fi >= 0) freeL.splice(fi, 1); }
        if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
      }
      for (var a = ALL.length - 1; a >= 0; a--) {
        if (ALL[a].state === 'dock') { ALL[a].dead = true; ALL.splice(a, 1); }
      }
      P = {};
      for (var p = 0; p < PAL.length; p++) {
        var d = makePalLetter(PAL[p]);
        d.state = 'dock';
        d.el.style.fontSize = '34px';
        panel.appendChild(d.el);
      }
      panel.style.opacity = '';
      sortPanel();
    }

    /* ---------------- 拖动 / 合成 / 拆分 ---------------- */
    function freeLetter(d, x, y, vx, vy, cat) {
      d.body = null; d.inBody = false; d.state = 'free';
      d.dz = null;              // 离开体 = 不再属于任何一格（手写分数的归位要重新判定）
      d.wx = x; d.wy = y; d.vx = vx || 0; d.vy = vy || 0; d.cat = cat;
      if (freeL.indexOf(d) < 0) freeL.push(d);
      d.el.classList.remove('ps-dockin');
      placeLetter(d);
    }
    function attach(B, d) {
      if (B.mem.indexOf(d) >= 0) return;
      var mi = freeL.indexOf(d); if (mi >= 0) freeL.splice(mi, 1);
      var pv = null;
      if (B.massG && B.massG.sx != null) pv = { sx: B.massG.sx, sy: B.massG.sy };
      d.state = 'mem';
      B.mem.push(d);
      d.body = B; d.inBody = true;
      // 空体接上一个质量字母时把它同时记成基础质量：排版（layoutRun/layoutFrac/
      // layoutGrav）都要读 B.massG，缺了它就会在 hRun 里对 null 取 .m 而崩。
      // 玩家路径上质量本来就是"先摆成 base 再拖别的字"，这里只是把同一条规则
      // 补到"空体直接接质量字母"这条路径上（addBody 的第一笔就走这里）。
      if (!B.massG && isMass(d)) B.massG = d;
      /* ★ ÷ 手写分数（2026-10-01）：÷ 落上来 = 这个体从此有一条分数横线；
         其余字形按**这一次的落点**归格（分子/分母/前方项/后方项），松手即定、之后黏住。 */
      if (d.type === DIV) divTurnOn(B, d);
      else if (B.div && B.div.on) divAssign(B, d, d.wx, d.wy);

      B.pop = 1;
      refresh(B);

      var hh = Math.max(20, B.hh || 18);
      if (B.y + hh > groundY) { B.y = groundY - hh; B.vy = -Math.abs(B.vy) * 0.5; }
      if (pv) keepMass(B, pv);
      ringGo(B.x, B.y);
    }
    function keepMass(B, pv) {
      var m = B.massG; if (!m) return;
      var th = B.th || 0, c = Math.cos(th), s = Math.sin(th);
      var dx = pv.sx - m.sx, dy = pv.sy - m.sy;
      B.x += dx * c - dy * s;
      B.y += dx * s + dy * c;
    }
    function splitOne(B, d) {
      var i = B.mem.indexOf(d);
      if (i < 0) {
        i = -1;
        for (var q = B.mem.length - 1; q >= 0; q--) if (B.mem[q].type === 'v') i = q;
        if (i < 0) i = B.mem.length - 1;
        if (i < 0) return;
        d = B.mem[i];
      }
      var out = [d];
      // 双击拆分 mv²/r：把 v 和 r 一起还回来（不然拆出来的 v 没法单独用）
      if (d.type === 'v' && B.vCount >= 2 && (B.hasR || B.hasHalf)) {
        for (var k = B.mem.length - 1; k >= 0; k--) {
          var tk = B.mem[k].type;
          if ((tk === 'r' || tk === HALF) && out.indexOf(B.mem[k]) < 0) out.push(B.mem[k]);
        }
      }
      var pv = null;
      if (B.massG && B.massG.sx != null) pv = { sx: B.massG.sx, sy: B.massG.sy };
      var msvx = B.vx, msvy = B.vy;
      for (var j = 0; j < out.length; j++) {
        var g = out[j], mi2 = B.mem.indexOf(g);
        if (mi2 >= 0) B.mem.splice(mi2, 1);
        g.body = null; g.inBody = false; g.state = 'free'; g.pop = 0;
      }
      refresh(B);
      if (pv) keepMass(B, pv);
      var dir = Math.random() * 6.2832, dx = Math.cos(dir), dy = Math.sin(dir), sep = 75;
      B.vx = msvx + dx * sep; B.vy = msvy + dy * sep;
      for (var n = 0; n < out.length; n++) {
        var L = out[n], sp = slot(B, L);
        var fi = freeL.indexOf(L); if (fi >= 0) freeL.splice(fi, 1);
        freeLetter(L, sp.x, sp.y, msvx - dx * sep + (Math.random() * 24 - 12), msvy - dy * sep + (Math.random() * 24 - 12), false);
      }
    }

    /* canMerge：组合语法（每条规则后面写的是**为什么**） */
    function canMerge(B, d) {

      if (!B || B.kind) return false;   // 场体（B/q/I/E）不是字母合并目标
      if (B.bh) return false;           // 黑洞吞字母，绝不与字母合并
      var t = d.type;
      /* ★ 手写分数（÷）的"装得下任意字母"例外（2026-10-01）：
         体已经是一条手写分数时，四格必须能收**任意**字母 —— 否则玩家把字母拖到横线
         上方/下方会"什么也没发生"（实测：Q U C ÷ 的体拒绝 a：a 与任何含 QUC 的公式都
         不相容；r 也被"要两个 v"的旧规矩挡在外面）。判公式用的字形集合**不受影响**
         （toksOfBody 照旧跳过运算符，eqAccepts 只是"能不能并进来"的闸门）。
         运算符（同字符不重复）、质量、c/G、t 的三条经典组合、箭头全都照旧。 */
      var divFree = !!(B.div && B.div.on);
      /* ★ 场符号（B/q/I/E）的合并闸门（2026-09-30 符号扩展）：dropLetter 现在会先给
         它们一次合并机会，这里就必须**只放行"这次字母集合仍被某条课本公式容纳"的
         情况** —— 否则一个 I 会被随便哪个体吸走，"单独落一个 I 生成电流体"这条
         既有行为也会被破坏。
         ⚠ 判据用 eqAccepts（子集）而**不是** eqCompletes（正好拼齐）：中间态必须放行，
         否则 U+I+R 里的 I 会因为"还差 R"而被拒，三元公式永远拼不齐。
         ⚠ B/E 也走这条（Φ=BS 要 B；E=ΔΦ/Δt 与 E=F/q 要 E）：它们的字母只在有公式
         时才会被容纳，所以"单独落一个 B/E 生成场体"同样不受影响。
         ⚠ **t 是例外**：q+t 必须留给 qt→I 那条经典路径（applyTCombo 会处理，
         它认 mem 里有 q 的体）。这里放行会让 t 先被并进 q 体，qt→I 就废了。 */
      if (t === 'B' || t === 'q' || t === 'I' || t === 'E') {
        /* ⚠ t 是例外：q+t 必须留给 qt→I 那条经典路径（applyTCombo 认 mem 里有 q 的体），
           这里放行会把 t 先并进 q 体、qt→I 就废了。 */
        if (eqCompletes(B, 't')) return false;
        return eqAccepts(B, t);
      }
      /* ★ 运算符（+ − × ÷ ( ) ² √ · =）：**不参与**公式身份判定（toksOfBody 已跳过），
         只把"写法"并进表达式，同字符不重复。'=' 例外：**已成式**的体不收 '=' ——
         它走 dropLetter 里的 transform 路径（边→边变换），而不是并进 mem。
         箭头 → 不在这里放行（箭头永不并入任何体，它是台上独立可旋转的字形）。 */
      if (isOp(t) && t !== ARROW) {
        if (t === EQ && B.eq) return false;
        /* ★ ÷ 允许多个（2026-10-01 手写分数）：**最先落下的那个是横线**（黏住不换），
           其余 ÷ 当行内字形排在它自己那一格 —— 所以"多个 ÷"不会出现两条横线打架。
           其余运算符仍然同字符不重复。 */
        if (t !== DIV) {
          for (var oi = 0; oi < B.mem.length; oi++) if (B.mem[oi].type === t) return false;
        }
        return true;
      }
      /* t：三条**经典组合路径优先** —— 体上带 g（g+t→v）或带 v 且没有 g（v+t→板）
         的，一律返回 false，让 dropLetter 走 findTComboTarget，既有手感一字不变。
         只有"三条路径都不适用"的体（例如 Q+I 这种纯公式体），才允许 t 去补完一条
         课本公式（Q=It、P=W/t、E=ΔΦ/Δt、ω=2π/T 都需要 t）。判据要求**正好拼齐**，
         所以随便一个体接 t 也不会被劫持。 */
      if (t === 't') {
        if (B.hasG || (B.hasV && !B.hasR)) return false;
        return !!eqCompletes(B, t);
      }
      if (isMass(t)) {
        var hasM = false, hasm = false;
        if (B.massG) { if (B.massG.type === 'M') hasM = true; else if (B.massG.type === 'm') hasm = true; }
        for (var mi = 0; mi < B.mem.length; mi++) {
          var mt = B.mem[mi].type;
          if (mt === 'M') hasM = true; else if (mt === 'm') hasm = true;
        }
        // 两个**相同**的质量永远不能合并（mm / MM）：每条公式至多一个大写 M、一个小写 m。
        // 不同的 M+m 仍然允许，这样装配顺序才自由。
        if (t === 'M' && hasM) return false;
        if (t === 'm' && hasm) return false;
        var nM = (hasM ? 1 : 0) + (hasm ? 1 : 0);
        if (B.hasGrav) {
          if (B.cCount >= 1) return false;  // 已走上 2GM/c² 路径（G M c …），质量就定死了
          if (nM >= 2) return false;        // GMm 两个质量都已就位（M 和 m）
          if (B.mem.length >= 5) return false;
          return true;
        }
        // 还没接上 G 之前：允许堆 M+m（所以 m→M→G 与 M→m→G 两条路都通）
        if (nM >= 2) return false;
        return true;
      }
      if (t === 'c') {
        var cc = 0;
        for (var cci = 0; cci < B.mem.length; cci++) if (B.mem[cci].type === 'c') cc++;
        if (cc >= 2) return false;
        if (B.hasV || B.hasR || B.hasHalf) return false;   // mv²/r 家族里塞 c 没有意义
        if (B.hasGrav) return B.mem.length < 4;            // GMc -> GMc²（奔 2GM/c²）
        if (B.mem.length >= 2) return false;               // 纯质量体（mc²）保持小巧
        return true;
      }
      if (t === 'G') {
        if (B.hasGrav) return false;              // 一个体上只能有一个 G
        if (B.family === 2) return false;         // 别把 G 丢进 v/r 公式
        if (B.hasC) { if (B.mem.length >= 1) return false; return true; }  // M+c -> GMc -> GMc² -> 2GM/c²
        // G 挂到"已有质量"的体上：真实用户是先摆质量块（那是 base/massG，
        // 不在 mem 里）再把 G 拖上去 —— 只看 mem 会把这条路误判成"空体接 G"而
        // 拒绝掉，于是 GMm/r² 只能靠"先摆 G"这一个顺序凑出来（引力井认不出小 m，
        // gravModeOf 永远是 plain）。所以这里要连 base 一起看，让 GM 与 MG 两种
        // 摆放顺序都能装成同一个体。
        var mCount = (B.massG && isMass(B.massG)) ? 1 : 0;
        for (var gm = 0; gm < B.mem.length; gm++) if (isMass(B.mem[gm])) mCount++;
        if (mCount >= 1) return true;
        if (B.mem.length >= 2) return false;
        return true;
      }
      var fam = (t === 'g' || t === 'a' || t === MU || t === 'c' || t === 'G') ? 1 : 2;
      /* ★ 公式优先于"族"这条软规则（2026-09-30 符号扩展）：
         下面这条 `两族不许混` 会把 h 挡在重力体外面（h 不属于族 1），
         于是 Ep=mgh 永远拼不齐（画面上还会出现 "m(g+)" 这种残缺括号）。
         改法：**先问公式表** —— 只要这次的字母集合仍被某条课本公式容纳，
         就放行；不涉及任何公式的字母（原有 15 个符号）走的还是老规则。 */
      if (!divFree && B.family && B.family !== fam && !B.hasGrav && !eqAccepts(B, t)) return false;
      if (t === 'r' || t === HALF) {
        /* ★ 手写分数：r / ½ 就是普通一格（四格里没有"分数套分数"要防），只保留同字符不重复 */
        if (divFree) {
          for (var dr = 0; dr < B.mem.length; dr++) {
            if (B.mem[dr] && B.mem[dr].type === t) return false;
          }
          return true;
        }
        /* ★ ½ 的公式通道（2026-09-30 符号扩展）：Ek=½mv² 这条式子要求 ½ 能挂到
           已经拼好的 mv² 上。原来的顺序是"先查 vCount/rCount 再放行"，而 ½mv²
           的装配顺序常常是 m → v → v（这时已经是一个完整的 mv² 体）→ ½，
           此时 vCount 与字母数都可能刚好卡在上限，½ 就被拒了。
           这里与"家族"那条同理：**先问公式表**，只要并进来以后仍被某条公式容纳
           （也就是 ½mv² 这条路）就直接放行，其余情况走原来的规矩。 */
        if (eqAccepts(B, t)) {
          if (t === HALF) {
            for (var i3 = 0; i3 < B.mem.length; i3++) if (B.mem[i3].type === HALF) return false;
          }
          return true;
        }
        if (t === 'r') {
          if (B.hasGrav) { if (B.rCount >= 2) return false; if (B.mem.length >= 5) return false; return true; }
          for (var i = 0; i < B.mem.length; i++) if (B.mem[i].type === 'r') return false;
        } else {
          for (var i2 = 0; i2 < B.mem.length; i2++) if (B.mem[i2].type === HALF) return false;
        }
        if (B.vCount < 2) return false;      // ½ 与 r 只有在 mv² 之上才有意义
        // 装入上限：基础质量 m/M 不算在 mem 里，所以 mv² 的 mem 是 [v,v]。
        // 上限放到 3 才能装下 ½mv² + r（mem = [v,v,½]）—— 4 个字母的 mv²/r
        // 与 ½mv²/r 都要能拼出来，这是圆周运动那一课的基本式子。
        if (B.mem.length >= 4) return false;
        return true;
      }
      if (t === 'v') {
        if (B.vCount >= 2) return false;     // 至多两个 v（v²）
        /* 装入上限 4（不是 3）：½mv² 的 mem 是 [½,v,m]，还要能再加一个 v 凑 v²
           —— 上限 3 会让「先摆 ½ m v、再补第二个 v」这条路被拒。
           手写分数的四格是玩家自己摆的，不设这条上限（下面另有总字母数兜底）。 */
        if (!divFree && B.mem.length >= 4) return false;
        return true;
      }
      /* 符号扩展新增的字母（F f N s h p T ω k η θ Δ x y A S U R P W Q ε C L Φ ρ λ ν φ n）
         走这里。规矩只有两条：
           ① **收下它以后，这个体的字母集合仍要被某条课本公式容纳** —— 多余的重复
              字母（例如往 F=ma 上再塞一个 m）会被拒；跟任何公式都无关的字母不受影响
              （沿用原来"同字母不重复"的宽松规则）。
           ② 字母个数上限 = **这条公式需要几个字母**（没有匹配的公式时沿用原来的 2）。
              为什么必须这样：原来写死的 `mem.length >= 2` 是照"至多两个字母的乘积"
              定的；而 F=ma / Q=I²Rt / ε=U+Ir 这些式子**本身就有 3~5 个字母**，
              写死 2 会让它们永远拼不齐（第三个字母一到就被拒）。 */
      if (!divFree && eqAccepts(B, t) === false) return false;
      /* 热平衡 Q吸=Q放 例外（2026-10-01 第三批）：允许**两个** Q（第三个才拒）。
         ⚠⚠ 必须**按对象身份去重**（2026-10-01 修复）：单个 Q 的体里，同一个字形
         既是 base（layoutBody→repairBase 把"第一个活字母"认成 massG）**又在 mem 里**
         —— 两边直接相加会把 1 个数成 2，于是**第二个 Q 永远被拒**：
         实测 `addBody(['Q','Q'])` 只剩一个 Q（eq 恒 null），真拖也拼不出 Q吸=Q放。
         判据与 toksOfBody 完全同构（那边也靠 seen[] 去重，注释里写着同一个坑）。 */
      if (t === 'Q') {
        var qc2 = 0, qseen = [];
        if (B.massG && B.massG.type === 'Q' && !B.massG.dead) { qc2++; qseen.push(B.massG); }
        for (var qi2 = 0; qi2 < B.mem.length; qi2++) {
          var qg2 = B.mem[qi2];
          if (!qg2 || qg2.dead || qg2.type !== 'Q' || qseen.indexOf(qg2) >= 0) continue;
          qc2++; qseen.push(qg2);
        }
        if (qc2 >= 2) return false;
      } else {
        for (var k = 0; k < B.mem.length; k++) if (B.mem[k].type === t) return false;  // 同字母不重复
      }
      /* 字母数上限 = "这次收下 t 之后仍被某条公式容纳"的那些公式里最长的那个。
         原来的写法是拿**当前**字母数去比上限，正好差一（mvv 要变成 ½mvv 时，
         当前 3 个、上限算成 3 就被拒了）。
         ⚠ 还有一条更隐蔽的：上限只在"收下之后的字母集合**已经**是某条公式的子集"
         时才算得出来。装配路上会出现"当前集合还差得远"的中间态 —— ½ 打头时
         body 是 {½}，收下第一个 v 得到 {½,v}，它对任何公式都不是子集
         （½mv² 还要第二个 v），于是 limit 掉回默认 2、第二个 v 被拒，
         ½mv² 就永远拼不齐。所以中间态一律放行：真正兜底的是"同字母不重复"
         ＋"收下后仍被某条公式容纳"这两条，字母数只防病态堆叠。 */
      var after = toksOfBody(B) + t, limit = 5;
      for (var sk in EQ_BY_SIG) {
        var need = {}, have = {}, okSub = true, ci;
        for (ci = 0; ci < sk.length; ci++) need[sk.charAt(ci)] = (need[sk.charAt(ci)] || 0) + 1;
        for (ci = 0; ci < after.length; ci++) have[after.charAt(ci)] = (have[after.charAt(ci)] || 0) + 1;
        for (var hc in have) if ((need[hc] || 0) < have[hc]) { okSub = false; break; }
        if (okSub && sk.length > limit) limit = sk.length;
      }
      if (divFree) return after.length <= DIV_MAXL;   // 手写分数：只防病态堆叠（总字母数上限）
      if (after.length > limit) return false;
      return true;
    }


    /* dropDistTo(B,x,y)：合并判据用的"这一次落字离这个体有多远"（2026-10-01 修）。
       ⚠ 原来一律量**到 base 字形（massG）的距离** —— 可玩家眼里目标是**一整个块**，
       而 base 只是块里第一个字母：宽体（Qc比m、E能hνW、mv²…）的右半边离 base
       100px 上下，落在块上照样判"够不着"。两条真机实测（都是真指针拖、不是 API）：
         · Q→c比→m→Δ→T（每步往右 36px）：Δ 落在 m 右缘、离 base(Q) 113.6px，
           canMerge 放行但普通半径只有 80px（"能拼齐公式"才放宽到 160px，而 Δ 单独
           并不拼齐 Q=cmΔT，还要 T）→ 不并 → 后面的 T 跟游离的 Δ 另起一坨 `ΔT`
           → **Q=cmΔT 真拖拼不出来**（bodies = [m, Qc比m, ΔT]，heat 事件 0 条）；
         · m→v→v→r：r 落在 ² 右侧 20px、离 base(m) ≈ 90px → 不并 →
           `mv²` 而不是 `mv²/r`，**双星也起不来**（orbiting=false）。
       现在按**落点到体 AABB 的距离**算（落在块内或贴着块 = 0）—— 与用户看到的判据一致。
       ⚠ 这条**不会**挡住"在公式体旁边摆另一个体"：合并只发生在"字形 → 体"，
       **体与体互拖永不合并**（pointerup 的 body 分支只做 findFreeLetterTarget，
       不做 canMerge），所以先把目标字形丢远一点、再把它整个拖到贴边即可
       （真拖验收 V3 就是这么摆出"边到边 0.8px"的）。canMerge 的公式闸门一字未动。 */
    function dropDistTo(B, x, y) {
      var ddx = Math.abs(x - B.x) - (B.hw || 40), ddy = Math.abs(y - B.y) - (B.hh || 18);
      if (ddx <= 0 && ddy <= 0) return 0;
      return Math.hypot(Math.max(0, ddx), Math.max(0, ddy));
    }
    function findMergeTarget(d) {
      var best = null, bd = MERGE_R_EQ;

      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.massG === d || B.mem.indexOf(d) >= 0) continue;
        if (!canMerge(B, d)) continue;
        var dist = dropDistTo(B, d.wx, d.wy);
        /* 双档半径（2026-09-30 移植清单 P1-4）：普通合并 MERGE_R；
           收下它就能**拼齐**某条课本公式的组合放宽到 MERGE_R_EQ。 */
        var limit = eqCompletes(B, d) ? MERGE_R_EQ : MERGE_R;
        if (dist < limit && dist < bd) { bd = dist; best = B; }
      }

      return best;
    }
    // 画面上一个游离的质量字母（碎裂/拆分剩下的）也能当合并目标：把另一个字母丢上去，
    // 它就当场升格成新体的基础（不用玩家先推它一下）。
    // 例外：draft=1（addBody 刚摆下的待装配字形）不能被"顺手牵羊"当基础 ——
    // 否则 addBody(['G','M']) 里那个同样的 'M' 会先被抢走当 base，明明该合成
    // 一个 GM 的，结果变成两坨（G 挂在被抢的 M 上、M 自己又是一坨）。
    function findFreeMassTarget(d) {
      var best = null, bd = 200;
      for (var i = 0; i < freeL.length; i++) {
        var F2 = freeL[i];
        if (F2 === d || F2.dead || F2.state !== 'free' || F2.draft) continue;
        if (!isMass(F2)) continue;
        var dist = Math.hypot(F2.wx - d.wx, F2.wy - d.wy);
        if (dist < bd) { bd = dist; best = F2; }
      }
      return best;
    }
    /* findFreeFormulaTarget(d)：**游离字母之间**也能按公式表合并的目标。
       为什么必须有它（2026-09-30 真拖拽 bug）：真交互里字形是先落成**游离字母**的
       （台面上还不是实体），而 `findMergeTarget` 只遍历 `bodies` —— 于是两个游离字母
       永远合不到一起；`U`+`I`+`R` 在真拖拽下只能变成"一颗电流场体"。
       判据与"升格成体再 canMerge"完全同构（canMerge 里带公式闸门），
       所以只有在真能拼公式时才返回目标；不成式一律 null（保持"游离字形"的既有行为）。
       draft=1 的字形排除，理由同 findFreeMassTarget。 */
    function findFreeFormulaTarget(d) {
      var best = null, bd = MERGE_R_EQ;
      for (var i = 0; i < freeL.length; i++) {
        var F2 = freeL[i];
        if (F2 === d || F2.dead || F2.state !== 'free' || F2.draft) continue;
        if (!F2.ch) continue;
        /* 用一个"只借不占"的探针体做判定：把 F2 当基础挂上去，问 canMerge 会不会放行。
           ⚠ BODY() 会**把自己登记进 bodies**，所以探针用完必须立刻摘掉 ——
           否则台面上会凭空多出一个空体（实测：真拖 U 再拖 I 会多出一颗空 formula 的体，
           还会把后面的 findMergeTarget 引到探针上，公式永远拼不齐）。 */
        var probe = BODY(F2.wx, F2.wy);
        probe.massG = F2; probe.glyphs = [F2]; probe.mem = [F2];
        var ok = canMerge(probe, d);
        var completes = ok ? !!eqCompletes(probe, d) : false;
        probe.massG = null; probe.glyphs = []; probe.mem = [];   // 立刻解绑，别留痕
        var pi = bodies.indexOf(probe); if (pi >= 0) bodies.splice(pi, 1);   // ★ 摘掉探针
        if (!ok) continue;
        var dist = Math.hypot(F2.wx - d.wx, F2.wy - d.wy);
        /* 双档半径：与 findMergeTarget 同一条规矩（能成全公式放宽到 MERGE_R_EQ） */
        var limit = completes ? MERGE_R_EQ : MERGE_R;
        if (dist < limit && dist < bd) { bd = dist; best = F2; }
      }
      return best;
    }
    /* ★ 场体溶回字形（2026-09-30 移植清单 P0-3）：I/q/B/E 单独落空处仍是场实体
       （旧行为），但落到"能成全公式"的字形/实体上时要溶回字形参与合并 ——
       这样 I+U+R、B+F+I+L 这类"场符号打头"的顺序也能拼出公式。
       判据：场符号字 + 这次的字合起来仍是某条课本公式的子集（eqGroupFor）。
       qt→I 由 findTComboTarget 优先处理（t 不在这里溶场）。 */
    function findDissolveTarget(d) {
      var best = null, bd = MERGE_R_EQ;
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (!B.kind || B.kind === 'T') continue;
        if (!eqGroupFor(B.kind + d.type)) continue;
        var dist = Math.hypot(B.x - d.wx, B.y - d.wy);
        if (dist < bd) { bd = dist; best = B; }
      }
      return best;
    }
    function dissolveField(B, L) {
      var g = B.fg;
      B.kind = null; B.fieldR = 0; B.fieldState = null;
      B.Isign = 0; B.qsign = 0;
      if (g) { g.inBody = true; g.body = B; }
      B.mem = g ? [g] : [];
      B.massG = null;
      refresh(B);
      attach(B, L);
      ringGo(B.x, B.y);
      return B;
    }
    function findFreeLetterTarget(B) {
      var best = null, bd = 200;
      for (var i = 0; i < freeL.length; i++) {
        var L = freeL[i];
        if (!canMerge(B, L)) continue;
        var d = Math.hypot(L.wx - B.x, L.wy - B.y);
        if (d < bd) { bd = d; best = L; }
      }
      return best;
    }

    function openMenu(clientX, clientY, B) {
      if (!B) return;
      menuBody = B;
      menu.style.left = clamp(clientX - table.getBoundingClientRect().left, 0, Math.max(0, W - 90)) + 'px';
      menu.style.top = clamp(clientY - table.getBoundingClientRect().top, 0, Math.max(0, H - 40)) + 'px';
      menu.classList.add('on');
    }
    function closeMenu() { menu.classList.remove('on'); }
    var menuBody = null;
    function ringGo(x, y) {
      ring.style.left = (x - 75) + 'px'; ring.style.top = (y - 75) + 'px';
      ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
    }
    onEv(menu, 'click', function (e) {
      e.stopPropagation();
      if (menuBody) copyBody(menuBody);
      closeMenu();
    });
    onEv(DD, 'pointerdown', function (e) {
      var n = e.target;
      while (n && n !== DD) { if (n === menu) return; n = n.parentNode; }
      closeMenu();
    });

    var grab = { kind: null, obj: null, gx: 0, gy: 0, lx: 0, ly: 0, t: 0, svx: 0, svy: 0, start: 0 };
    var dblState = { t: 0, x: 0, y: 0, body: null, g: null };
    var hoverB = null;
    var hoverArrow = null;   // 悬停的箭头字形（旋转手柄的第二种目标）
    function easeOutBack(k) { k -= 1; return 1 + k * k * ((2.2) * k + 1 + 2.2); }

    function gdDown(e, d) {
      if (e.button !== 0) return;
      /* ★ 指针先落位（2026-09-30 修复，真拖拼不出公式的根源）：pointer 只被
         pointermove 更新，首次按下时还是初始值 (-9999,-9999)。dock 分支拿它算
         grab.gx（`pointer.x - cx`）会把第一个字形甩到 1 万像素外 —— 之后所有
         "瞄着实时位置丢"的字形全都落在错误坐标上，合并半径再大也够不着，
         表现就是"真拖永远拼不出公式、落点乱飞"。按下那一刻先按事件坐标落位。 */
      var p0 = xy(e); pointer.x = p0.x; pointer.y = p0.y;
      if (d.state === 'dock') {
        var rp = worldRect(d.el);
        var cx = rp.left + rp.width / 2, cy = rp.top + rp.height / 2;
        var t2 = GD(d.ch);
        t2.cat = 1; t2.pop = 0;
        t2.state = 'grab';
        t2.body = null;
        t2.wx = cx; t2.wy = cy;
        /* ⚠ 不再覆盖 w/h（2026-09-30 落点修复）：原来写死 F*0.7 的宽，
           而真实字形墨迹宽度不是 0.7F —— 松手后字形中心会系统性偏离投放点
           4~5px（落点断言 ≤2px 就是这么红的）。GD() 已经用 offsetWidth 量好
           真实宽高，直接沿用即可，慢拖落点 = 投放点。 */
        opLog('drag-out', { ch: d.ch });   // 操作日志：从托盘拖出字形（2026-10-01）
        grab = { kind: 'letter', obj: t2, gx: pointer.x - cx, gy: pointer.y - cy,
                 lx: pointer.x, ly: pointer.y, t: performance.now(), start: pointer.x };
        table.appendChild(t2.el);
        place(t2, cx, cy, 0, 1, true);
        return;
      }
      if (d.body && !d.body.bh && d.body.glyphs && d.body.glyphs.indexOf(d) >= 0) {
        var B = d.body;
        if (dblState.body !== B) { dblState.t = 0; dblState.body = B; dblState.g = d; dblState.x = pointer.x; dblState.y = pointer.y; }
        grab = { kind: 'body', obj: B, gx: pointer.x - B.x, gy: pointer.y - B.y,
                 lx: pointer.x, ly: pointer.y, t: performance.now(), svx: B.vx, svy: B.vy,
                 start: pointer.x, x0: pointer.x, y0: pointer.y };
        table.appendChild(d.el);
        return;
      }
      if (d.state === 'free' || d.state === 'grab') {
        grab = { kind: 'letter', obj: d, gx: pointer.x - d.wx, gy: pointer.y - d.wy,
                 lx: pointer.x, ly: pointer.y, t: performance.now(), start: pointer.x };
        return;
      }
    }

    onEv(handle, 'pointerdown', function (e) {
      /* 旋转手柄同样先按事件落位（与 gdDown 同一条修复：首次旋转不能拿 -9999 起算） */
      var hp = xy(e); pointer.x = hp.x; pointer.y = hp.y;
      if (hoverArrow) {
        e.preventDefault(); e.stopPropagation();
        grab = { kind: 'rotLetter', obj: hoverArrow, lx: pointer.x, ly: pointer.y, t: performance.now() };
        return;
      }
      if (!hoverB || (!hoverB.hasA && hoverB.kind !== 'T' && hoverB.kind !== 'E')) return;
      e.preventDefault(); e.stopPropagation();
      grab = { kind: 'rot', obj: hoverB, lx: pointer.x, ly: pointer.y, t: performance.now() };
    });
    onEv(cv, 'pointerdown', function (e) {
      var p = xy(e);
      pointer.x = p.x; pointer.y = p.y;
      var hit = null;
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        var dx = pointer.x - B.x, dy = pointer.y - B.y;
        var th = B.th || 0, c = Math.cos(th), s = Math.sin(th);
        var lx = c * dx + s * dy, ly = -s * dx + c * dy;
        if (Math.abs(lx) < (B.hw || 30) + 10 && Math.abs(ly) < (B.hh || 24) + 10) hit = B;
      }
      if (hit && !hit.bh) {
        if (dblState.body !== hit) { dblState.t = 0; dblState.body = hit; dblState.g = hit.massG; dblState.x = pointer.x; dblState.y = pointer.y; }
        grab = { kind: 'body', obj: hit, gx: pointer.x - hit.x, gy: pointer.y - hit.y,
                 lx: pointer.x, ly: pointer.y, t: performance.now(), svx: hit.vx, svy: hit.vy,
                 start: pointer.x, x0: pointer.x, y0: pointer.y };
      }
    });

    onEv(DD, 'pointermove', function (e) {
      var p = xy(e);
      pointer.x = p.x; pointer.y = p.y;
      if (pillDrag) { pillMove(e.clientX); return; }
      if (trashDrag.active) {
        trash.style.left = (pointer.x - 17) + 'px';
        trash.style.top = (pointer.y - 17) + 'px';
        eraseUnderTrash();
        return;
      }
      var onT = (grab.kind === 'letter' || grab.kind === 'body') && inTrash(pointer.x, pointer.y);
      trash.classList.toggle('on', onT);
      if (grab.kind === 'body') {
        var B = grab.obj;
        B.x = pointer.x - grab.gx; B.y = pointer.y - grab.gy;
        var dt = (performance.now() - grab.t) / 1000 || 0.016;
        if (dt > 0) {
          /* 只记手速供松手判定，**不再把速度写进 B.vx/B.vy**（2026-10-01 修复，
             用户报"抓公式体松手飞走"的残余路径）：公式体的 eq 动力学在抓取期间
             照常积分，写进去的手速会让体在两帧之间漂移（实测慢拖 300px 松手，
             体漂出 121px）—— 轻轻放下就该停在松手处。甩出的初速度由松手那一刻
             按同一套 THROW 语义单独算。 */
          var spx = (pointer.x - grab.lx) / dt, spy = (pointer.y - grab.ly) / dt;
          grab.svx = spx; grab.svy = spy;
        }
        grab.lx = pointer.x; grab.ly = pointer.y; grab.t = performance.now();
        cv.style.cursor = findFreeLetterTarget(B) ? 'copy' : 'grabbing';
      } else if (grab.kind === 'letter') {
        var L = grab.obj;
        L.wx = pointer.x - grab.gx; L.wy = pointer.y - grab.gy;
        placeLetter(L);
        divPreviewFor(L);      // ★ 手写分数：高亮它要落进去的那一格（别让玩家猜）
        var dtt = (performance.now() - grab.t) / 1000 || 0.016;
        if (dtt > 0) { grab.svx = (pointer.x - grab.lx) / dtt; grab.svy = (pointer.y - grab.ly) / dtt; }
        grab.lx = pointer.x; grab.ly = pointer.y; grab.t = performance.now();
        cv.style.cursor = findMergeTarget(L) ? 'copy' : 'default';
      } else if (grab.kind === 'rot') {
        var Rb = grab.obj, s = tAnchor(Rb);
        var a0 = Math.atan2(grab.ly - s.y, grab.lx - s.x);
        var a1 = Math.atan2(pointer.y - s.y, pointer.x - s.x);
        Rb.th = shortAng(Rb.th + (a1 - a0));
        grab.lx = pointer.x; grab.ly = pointer.y;
      } else if (grab.kind === 'rotLetter') {
        var Rl = grab.obj;
        var al0 = Math.atan2(grab.ly - Rl.wy, grab.lx - Rl.wx);
        var al1 = Math.atan2(pointer.y - Rl.wy, pointer.x - Rl.wx);
        Rl.rot = shortAng((Rl.rot || 0) + (al1 - al0));
        grab.lx = pointer.x; grab.ly = pointer.y;
        placeLetter(Rl);
        /* 操作日志：箭头转向（拖手柄连转 400ms 内只记一条，2026-10-01） */
        if (!Rl._logT || Date.now() - Rl._logT > 400) {
          Rl._logT = Date.now();
          opLog('arrow-turn', { deg: Math.round((Rl.rot || 0) * 180 / Math.PI) });
        }
      }
    });

    onEv(DD, 'pointerup', function (e) {
      var p = xy(e);
      pointer.x = p.x; pointer.y = p.y;
      if (pillDrag) { pillUp(e.clientX); return; }
      divPreviewClear();       // ★ 手写分数：松手就撤掉高亮（归位已经在 attach 里定死）
      if (trashDrag.active) {
        trash.style.left = ''; trash.style.top = '';
        trash.style.right = '14px'; trash.style.bottom = '14px';
        trash.classList.remove('on');
        trashDrag.active = false;
        grab.kind = null; grab.obj = null;
        return;
      }
      trash.classList.remove('on');
      if (grab.kind === 'body') {
        var B = grab.obj;
        if (inTrash(pointer.x, pointer.y)) {
          if (B.bh) { explodeBlackHole(B); }   // 活黑洞丢进垃圾桶 -> 引爆
          else { killBody(B); }
          grab.kind = null; grab.obj = null;
          return;
        }
        if (inPanel(pointer.x, pointer.y) && !B.kind) {
          // 公式体丢回面板框 -> 它的字母全部停靠回面板
          for (var pi2 = B.glyphs.length - 1; pi2 >= 0; pi2--) { if (B.glyphs[pi2].stk) killG(B.glyphs[pi2]); }
          var rl = [];
          if (B.massG) rl.push(B.massG);
          for (var mi3 = 0; mi3 < B.mem.length; mi3++) { if (B.mem[mi3] !== B.massG) rl.push(B.mem[mi3]); }
          for (var ri = 0; ri < rl.length; ri++) {
            var LG = rl[ri];
            if (LG.body === B) { LG.body = null; LG.inBody = false; }
            LG.pop = 0;
            dockLetter(LG);
          }
          killBody(B);
          grab.kind = null; grab.obj = null;
          return;
        }
        if (B.kind) {
          if (inPanel(pointer.x, pointer.y)) { killBody(B); grab.kind = null; grab.obj = null; return; }
          /* 场体（q/I/B/E/T）抓取松手：与游离字形同一套手速语义（2026-10-01 修复，
             用户报"抓公式体飞走"）——轻轻放下 → 停在松手处；故意快甩才飞。 */
          var sp2 = Math.hypot(grab.svx, grab.svy);
          var still2 = (performance.now() - grab.t) > STILL_MS;
          if (!still2 && sp2 >= THROW_MIN) {
            var k2f = Math.min(1, (sp2 - THROW_MIN) / THROW_MIN);
            var out2 = sp2 * k2f; if (out2 > THROW_MAX) out2 = THROW_MAX;
            B.vx = (sp2 > 1e-6) ? (grab.svx / sp2) * out2 : 0;
            B.vy = (sp2 > 1e-6) ? (grab.svy / sp2) * out2 : 0;
          } else { B.vx = 0; B.vy = 0; }
          grab.kind = null; grab.obj = null;
          return;
        }
        var ds = dblState;
        var didSplit = false;
        if (ds.body === B) {
          var mvd = Math.hypot(pointer.x - ds.x, pointer.y - ds.y);
          var now = performance.now();
          if (mvd < 14) {
            if (ds.t > 0 && now - ds.t < 500) {   // 双击拆分
              splitOne(B, ds.g);
              ds.t = 0; ds.body = null; ds.g = null;
              didSplit = true;
            } else {
              ds.t = now; ds.x = pointer.x; ds.y = pointer.y;
            }
          } else {
            ds.t = 0; ds.body = null;
          }
        }
        if (didSplit) { grab.kind = null; grab.obj = null; return; }
        /* 公式体抓取松手：与游离字形同一套手速语义（2026-10-01 修复，用户报
           "按住公式体慢移 300px 松手，体飞了 841px"——旧阈值 20px/s 把正常拖动
           当甩动）。轻轻放下（<1500px/s 或松手前静置 ≥140ms）→ 初速度 0，
           正好停在松手处；故意快甩（≥1500px/s）→ 超出部分按比例转初速度、
           封顶 THROW_MAX，方向 = 手势方向。 */
        var spd0b = Math.hypot(grab.svx, grab.svy);
        var stillB = (performance.now() - grab.t) > STILL_MS;
        if (!stillB && spd0b >= THROW_MIN) {
          var k0b = Math.min(1, (spd0b - THROW_MIN) / THROW_MIN);
          var out0b = spd0b * k0b; if (out0b > THROW_MAX) out0b = THROW_MAX;
          B.vx = (spd0b > 1e-6) ? (grab.svx / spd0b) * out0b : 0;
          B.vy = (spd0b > 1e-6) ? (grab.svy / spd0b) * out0b : 0;
        } else {
          B.vx = 0; B.vy = 0;
        }
        var fl = findFreeLetterTarget(B);
        if (fl) { attach(B, fl); }
      } else if (grab.kind === 'letter') {
        dblState.t = 0;
        var L2 = grab.obj;
        if (inTrash(pointer.x, pointer.y)) { killLetter(L2); grab.kind = null; grab.obj = null; return; }
        if (inPanel(pointer.x, pointer.y)) { killLetter(L2); grab.kind = null; grab.obj = null; return; }
        /* ★★ 2026-09-30 真拖拽修复（用户实测报障：拖 U、I、R 拼不出 eq:'ohm'）★★
           真拖与 addBody 现在**共用同一个 dropLetter**，不再各写一份；这里只负责快甩。 */
        /* 快甩（手速 ≥ THROW_MIN 且松手前没静置）：按手势方向飞出，
           初速度 = 超出部分按比例、封顶 THROW_MAX（阈值 1500px/s，
           超得越多给得越多）；场符号快甩照旧生成场体并把初速度喂给场体。
           慢放/静置（正常拖放）：初速度 0，落点 = 投放点。 */
        var spd0 = Math.hypot(grab.svx, grab.svy);
        var still = (performance.now() - grab.t) > STILL_MS;
        var fvx = 0, fvy = 0;
        if (!still && spd0 >= THROW_MIN) {
          var k0 = Math.min(1, (spd0 - THROW_MIN) / THROW_MIN);
          var out0 = spd0 * k0; if (out0 > THROW_MAX) out0 = THROW_MAX;
          fvx = (spd0 > 1e-6) ? (grab.svx / spd0) * out0 : 0;
          fvy = (spd0 > 1e-6) ? (grab.svy / spd0) * out0 : 0;
        }
        dropLetter(L2, L2.wx, L2.wy, undefined, fvx, fvy);
        /* dropLetter 之后仍然游离（没被任何体收下）-> 应用快甩初速度。
           慢放时 fvx/fvy = 0，字形原地落点（= 投放点，容差 ≤2px 由探针断言）。 */
        if (!L2.dead && !L2.body && L2.state === 'free') {
          L2.vx = fvx; L2.vy = fvy;
        }
        cv.style.cursor = 'default';
      }
      grab.kind = null; grab.obj = null;
    });

    onEv(DD, 'pointercancel', function () {
      divPreviewClear();       // ★ 手写分数：手势被打断也要撤掉高亮
      if (grab.kind === 'letter' && grab.obj) {
        var L = grab.obj;
        L.state = 'free';
        if (freeL.indexOf(L) < 0) freeL.push(L);
        placeLetter(L);
      }
      grab.kind = null; grab.obj = null; cv.style.cursor = 'default';
    });

    /* ---------------- 物理 ---------------- */
    function stepPhysics(dt) {
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.eq) continue;      // ★ 双轨：公式体走 stepEqPhysics，老路径不碰它
        if (B.kind === 'B' || B.kind === 'E') continue;
        if (B.bh) continue;      // 黑洞（任何阶段）由 stepBlackHole 处理，不走普通物理
        if (grab.kind === 'body' && grab.obj === B) continue;
        if (B.shatterBlast) {
          B.shatterBlast = false;
          shatter(B, 'split');
          continue;
        }
        if (B.hasG) B.vy += GRAV * dt;              // g：受重力
        if (B.hasA) {                                // a：沿 θ 方向加速（F=ma 的方向性）
          var th = B.th || 0;
          B.vx += -AACC * Math.cos(th) * dt;
          B.vy += -AACC * Math.sin(th) * dt;
        }
        var damp = Math.pow(0.9992, dt * 60);
        if (B.kind !== 'q') { B.vx *= damp; B.vy *= damp; }
        B.x += B.vx * dt; B.y += B.vy * dt;
        walls(B);
      }
      for (var k = 0; k < freeL.length; k++) {
        var d = freeL[k];
        if (d.state === 'grab' && grab.kind === 'letter' && grab.obj === d) continue;
        var massless = !!d.massless;
        var fdmp = massless ? Math.pow(0.45, dt) : Math.pow(0.94, dt * 60);
        d.vx *= fdmp; d.vy *= fdmp;
        d.wx = d.wx + d.vx * dt; d.wy = d.wy + d.vy * dt;
        if (d.wx < 20) { d.wx = 20; d.vx = Math.abs(d.vx) * 0.6; }
        if (d.wx > W - 20) { d.wx = W - 20; d.vx = -Math.abs(d.vx) * 0.6; }
        if (d.wy < 20) { d.wy = 20; d.vy = Math.abs(d.vy) * 0.6; }
        if (!massless && d.wy > groundY - 8) { d.wy = groundY - 8; d.vy = -Math.abs(d.vy) * 0.6; }
      }
    }

    function shatter(B, mode) {
      var i = bodies.indexOf(B); if (i >= 0) bodies.splice(i, 1);
      var cx = B.x, cy = B.y;
      var S = Math.hypot(B.vx, B.vy) || 1;
      var ux = -B.vx / S, uy = -B.vy / S;
      var px = -uy, py = ux;
      var base = S * 0.275, spread = S * 0.275;
      for (var sk = B.glyphs.length - 1; sk >= 0; sk--) { if (B.glyphs[sk].stk) killG(B.glyphs[sk]); }
      var lets = [];
      if (B.massG) lets.push(B.massG);
      for (var j2 = 0; j2 < B.mem.length; j2++) if (B.mem[j2] !== B.massG) lets.push(B.mem[j2]);
      if (mode === 'split') {
        // 整块碎成**自己的**字母（mv² -> m, v, v），还能再用
        for (var q = 0; q < lets.length; q++) {
          var L = lets[q];
          if (L.body === B) { L.body = null; L.inBody = false; }
          L.pop = 0;
          var off = (q - (lets.length - 1) / 2) * 28;
          freeLetter(L, cx + px * off, cy + py * off, ux * base + px * spread * off / 28, uy * base + py * spread * off / 28, false);
        }
      } else {
        for (var j = 0; j < lets.length; j++) {
          var g = lets[j];
          if (g.body === B) { g.body = null; g.inBody = false; killLetter(g); }
        }
      }
      B.glyphs = []; B.mem = [];
      if (mode === 'formula') {
        // ½mv² 撞墙 —— 三种预设结局按概率：
        //   0.4  完整弹性碰撞对（v₁′/v₂′，分子带 (m₁−m₂)v₁+2m₂v₂）
        //   0.3  简化对：v₁′=(m₁−m₂)/(m₁+m₂)·v₁ 与 v₂′=2m₁/(m₁+m₂)·v₁
        //   0.3  单条共速公式 v_共=(m₁v₁+m₂v₂)/(m₁+m₂)，原路返回
        var roll = Math.random();
        if (roll < 0.4) {
          spawnFormula(1, cx + px * 26, cy + py * 26, ux * base + px * spread, uy * base + py * spread);
          spawnFormula(2, cx - px * 26, cy - py * 26, ux * base - px * spread, uy * base - py * spread);
        } else if (roll < 0.7) {
          spawnFormula(3, cx + px * 26, cy + py * 26, ux * base + px * spread, uy * base + py * spread);
          spawnFormula(4, cx - px * 26, cy - py * 26, ux * base - px * spread, uy * base - py * spread);
        } else {
          spawnFormula(5, cx, cy, ux * base * 0.8, uy * base * 0.8);
        }
      } else if (mode === 'labels') {
        spawnText('m\u2081v\u2081\u2032', cx + px * 26, cy + py * 26, ux * base + px * spread, uy * base + py * spread);
        spawnText('m\u2082v\u2082\u2032', cx - px * 26, cy - py * 26, ux * base - px * spread, uy * base - py * spread);
      }
      ringGo(cx, cy);
    }

    function walls(B) {
      if (B.kind) {
        if (B.kind !== 'T') return;
        // t-木板：像地面一样实心，落在地面上、撞屏幕边反弹，旋转保留
        var lenh = B.len / 2, c = Math.abs(Math.cos(B.th)), s = Math.abs(Math.sin(B.th));
        var ex = lenh * c + B.hh * s, ey = lenh * s + B.hh * c;
        if (B.y - ey < -8) { B.y = -8 + ey; B.vy = Math.abs(B.vy) * 0.5; if (Math.abs(B.vy) < 60) B.vy = 0; }
        if (B.y + ey > groundY) { B.y = groundY - ey; B.vy = -Math.abs(B.vy) * 0.5; if (Math.abs(B.vy) < 60) B.vy = 0; }
        if (B.x - ex < -8) { B.x = -8 + ex; B.vx = Math.abs(B.vx) * 0.5; if (Math.abs(B.vx) < 60) B.vx = 0; }
        if (B.x + ex > W + 8) { B.x = W + 8 - ex; B.vx = -Math.abs(B.vx) * 0.5; if (Math.abs(B.vx) < 60) B.vx = 0; }
        return;
      }
      var sc = B.sc || 1;
      var hw = (B.hw || 20) * sc, hh = (B.hh || 18) * sc;
      var el = B.hasV, e = el ? 0.92 : 0.28;    // 有 v 的体弹性大（撞得起）
      if (B.hasMu) { B.vx *= 0.90; B.vy *= 0.90; }   // μ：摩擦
      var ox = 0, oy = 0;
      if (B.orb && B.orb.k >= 0.02 && B.orb.gx != null) { ox = B.orb.gx - B.x; oy = B.orb.gy - B.y; }
      var cxp = B.x + ox, cyp = B.y + oy;
      function shatterIfFast(sp) {
        if (sp < SHATTER_SPEED) return false;
        if (B.hasC && B.cCount >= 2) return false;   // mc² 撞墙绝不碎 —— 它只是弹开（然后膨胀/爆炸）
        if (B.hasHalf && B.vCount >= 2) { shatter(B, 'formula'); return true; }   // ½mv² 碎成弹性碰撞公式碎片
        if (B.massG || B.mem.length) { shatter(B, 'split'); return true; }        // 其余碎成自己的字母
        return false;
      }
      if (cyp - hh < -8) { if (shatterIfFast(Math.abs(B.vy))) return; cyp = -8 + hh; B.vy = Math.abs(B.vy) * e; if (!el) B.vx *= 0.4; }
      if (cyp + hh > groundY) { if (shatterIfFast(Math.abs(B.vy))) return; cyp = groundY - hh; B.vy = -Math.abs(B.vy) * e; if (!el) B.vx *= 0.35; }
      if (cxp - hw < -8) { if (shatterIfFast(Math.abs(B.vx))) return; cxp = -8 + hw; B.vx = Math.abs(B.vx) * e; if (!el) B.vy *= 0.55; }
      if (cxp + hw > W + 8) { if (shatterIfFast(Math.abs(B.vx))) return; cxp = W + 8 - hw; B.vx = -Math.abs(B.vx) * e; if (!el) B.vy *= 0.55; }
      B.x = cxp - ox; B.y = cyp - oy;
    }

    function collideBodies() {
      /* ★ 双轨：公式体之间的碰撞由 eqCollide 负责，老路径不参与。 */
      function ext(B) {
        var th = B.th || 0, c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
        var hw = B.hw || 24, hh = B.hh || 18;
        return { ex: hw * c + hh * s, ey: hw * s + hh * c };
      }
      for (var i = 0; i < bodies.length; i++) {
        var A = bodies[i];
        if ((A.kind && A.kind !== 'T') || A.bh) continue;   // 场互相穿过；黑洞是奇点（没有实心盒）
        if (grab.kind === 'body' && grab.obj === A) continue;
        var ea = ext(A);
        for (var j = i + 1; j < bodies.length; j++) {
          var B = bodies[j];
          if ((B.kind && B.kind !== 'T') || B.bh) continue;
          if (grab.kind === 'body' && grab.obj === B) continue;
          var eb = ext(B);
          var aox = 0, aoy = 0; if (A.orb && A.orb.k >= 0.02 && A.orb.gx != null) { aox = A.orb.gx - A.x; aoy = A.orb.gy - A.y; }
          var box = 0, boy = 0; if (B.orb && B.orb.k >= 0.02 && B.orb.gx != null) { box = B.orb.gx - B.x; boy = B.orb.gy - B.y; }
          var dx = (B.x + box) - (A.x + aox), dy = (B.y + boy) - (A.y + aoy);
          var ox = ea.ex + eb.ex - Math.abs(dx);
          if (ox <= 0) continue;
          var oy = ea.ey + eb.ey - Math.abs(dy);
          if (oy <= 0) continue;
          var nx = 0, ny = 0, ov = 0;
          if (ox < oy) { nx = (dx > 0) ? 1 : -1; ov = ox; } else { ny = (dy > 0) ? 1 : -1; ov = oy; }
          // 完整的引力井（GMm/r²）与 t-木板是**静态体**：碰撞永远推不动它们。引力井被
          // 拆掉一块（丢了 M 或第二个 r）之后 isWell 为假，就恢复成普通的可推公式体。
          var mA = (A.kind === 'T' ? 1e7 : A.isWell ? 1e9 : (A.bh ? 1e9 : (A.mass || 1)));
          var mB = (B.kind === 'T' ? 1e7 : B.isWell ? 1e9 : (B.bh ? 1e9 : (B.mass || 1)));
          var sum = mA + mB;
          var immA = (A.kind === 'T') || A.isWell || !!A.bh, immB = (B.kind === 'T') || B.isWell || !!B.bh;
          if (!immA) { A.x -= nx * ov * (mB / sum); A.y -= ny * ov * (mB / sum); }
          if (!immB) { B.x += nx * ov * (mA / sum); B.y += ny * ov * (mA / sum); }
          var vn = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
          if (vn > 0) {   // vn>0 = 正在接近；按法向相对速度做反射
            var e = (A.hasV && B.hasV) ? 1 : 0.75;
            var jimp = -(1 + e) * vn / (1 / mA + 1 / mB);
            if (!immA) { A.vx += jimp * nx / mA; A.vy += jimp * ny / mA; }
            if (!immB) { B.vx -= jimp * nx / mB; B.vy -= jimp * ny / mB; }
          }
        }
      }
    }

    function refreshHover() {
      hoverB = null;
      hoverArrow = null;
      if (grab.kind === 'body') { hoverB = grab.obj; }
      else {
        var best = null, bd = 1e9;
        for (var i = 0; i < bodies.length; i++) {
          var B = bodies[i];
          var s = (B.kind === 'T') ? { x: B.x, y: B.y } : (B.massG ? slot(B, B.massG) : { x: B.x, y: B.y });
          var dx = pointer.x - s.x, dy = pointer.y - s.y;
          if (B.kind === 'E') {
            // E 场的悬浮旋转手柄：指针在**方形区**内任何位置都要出现（与 stepField /
            // drawFieldE 用同一个方形判定），而不是只在 E 字形上才出现。
            var hsE = (B.fieldR || E_FIELD_RANGE) / 2;
            if (Math.abs(dx) <= hsE && Math.abs(dy) <= hsE) {
              var dE = Math.max(Math.abs(dx), Math.abs(dy));
              if (dE < bd) { bd = dE; best = B; }
            }
            continue;
          }
          var rr = Math.max(34, (B.hw || 30)) + 18;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < rr && d < bd) { bd = d; best = B; }
        }
        hoverB = best;
        /* 箭头字形的旋转手柄（2026-09-30 移植清单 P2-10）：没有压到体时，
           悬停在台上的箭头字形上也会亮手柄（拖手柄 = 改朝向） */
        if (!hoverB) {
          for (var ai = 0; ai < freeL.length; ai++) {
            var AL = freeL[ai];
            if (!AL.arrow || AL.dead || AL.state === 'grab') continue;
            if (Math.abs(pointer.x - AL.wx) < 20 && Math.abs(pointer.y - AL.wy) < 20) { hoverArrow = AL; break; }
          }
        }
      }
      if (hoverArrow) {
        handle.style.left = (hoverArrow.wx - 15) + 'px';
        handle.style.top = (hoverArrow.wy - 15 - 34) + 'px';
        handle.classList.add('on');
      } else if (hoverB && (hoverB.hasA || hoverB.kind === 'T' || hoverB.kind === 'E')) {
        var s2 = hoverB.massG ? slot(hoverB, hoverB.massG) : { x: hoverB.x, y: hoverB.y };
        var th = hoverB.th || 0;
        var hh = Math.max(30, (hoverB.hh || 24)) + 26;
        if (hoverB.kind === 'E') {
          var hsE2 = (hoverB.fieldR || E_FIELD_RANGE) / 2, cth = Math.cos(th), sth = Math.sin(th);
          hh = hsE2 / Math.max(0.001, Math.max(Math.abs(cth), Math.abs(sth)));
        }
        handle.style.left = (s2.x + Math.sin(th) * hh - 15) + 'px';
        handle.style.top = (s2.y - Math.cos(th) * hh - 15) + 'px';
        handle.classList.add('on');
      } else handle.classList.remove('on');
    }

    function copyBody(src) {
      if (src.kind) {
        // 场源复制（B/q/I/E）：右键电场以前会克隆出一个裸 "m"，因为 copyBody 只认公式体。
        // 现在复制**同一种**场源，并保留它自己的方向/极性（E 保留 th，B 保留 Bz，q/I 保留符号）。
        var nb = spawnField(src.kind, src.x + 48 + Math.random() * 40 - 20, src.y + 42 + Math.random() * 30 - 15, 0, 0);
        if (src.kind === 'E') nb.th = src.th || 0;
        else if (src.kind === 'B') nb.Bz = src.Bz;
        else if (src.kind === 'q') nb.qsign = src.qsign;
        else if (src.kind === 'I') nb.Isign = src.Isign;
        nb.pop = 1; nb.orbPulse = 1; nb.copied = true;
        refresh(nb);
        ringGo(nb.x, nb.y);
        sortPanel();
        return nb;
      }
      var ch = (src.massG && src.massG.type === 'M') ? 'M' : 'm';
      var massN = GD(ch);
      massN.pop = 0;
      var B = BODY(src.x + 40 + Math.random() * 60 - 30, src.y + 30 + Math.random() * 40 - 20);
      B.massG = massN;
      massN.body = B;
      B.glyphs = []; B.mem = [];
      var mm = [];
      for (var i = 0; i < src.mem.length; i++) {
        var c2 = src.mem[i].type;
        var g2 = GD(c2); g2.pop = 0;
        /* ★ 手写分数（÷）：把**格子**一起抄过去（四格 = 分子/分母/前方项/后方项）。
           不抄的话副本会"所有字母挤在分子上"（dz 是字形对象上的字段，新字形默认没有）。 */
        g2.dz = src.mem[i].dz || null;
        B.mem.push(g2);
        mm.push(g2);
      }
      var list = [massN].concat(mm);
      list.forEach(function (g) { g.body = B; g.inBody = true; g.prev = { x: 0, y: 0 }; B.glyphs.push(g); });
      refresh(B);
      B.pop = 1;
      B.orbPulse = 1;
      B.copied = true;
      ringGo(B.x, B.y);
      var ms = slot(B, B.massG);
      B.x += src.x - ms.x; B.y += src.y - ms.y;
      refresh(B);
      B.vx = 60; B.vy = -40;
      sortPanel();
    }

    function inTrash(x, y) {
      var r = worldRect(trash);
      return x > r.left - 10 && x < r.right + 10 && y > r.top - 10 && y < r.bottom + 10;
    }
    function inPanel(x, y) {
      var r = worldRect(panel);
      return x > r.left - 12 && x < r.right + 12 && y > r.top - 12 && y < r.bottom + 12;
    }

    /* ---------------- 清空 / 收进面板 / 重置 ---------------- */
    function removeAllBodies() {
      if (BH_FINALE) {
        for (var fz = 0; fz < BH_FINALE.letters.length; fz++) {
          var Lz = BH_FINALE.letters[fz];
          if (!Lz.arr) { Lz.arr = true; if (Lz.el && Lz.el.parentNode) Lz.el.parentNode.removeChild(Lz.el); }
        }
        BH_FINALE = null;
      }
      resetTrashPos();
      for (var i = bodies.length - 1; i >= 0; i--) {
        var B = bodies[i];
        for (var j = 0; j < B.glyphs.length; j++) {
          var g = B.glyphs[j];
          if (g.body === B) { g.body = null; g.inBody = false; killLetter(g); }
        }
        B.glyphs = []; B.mem = [];
        destroyPills(B);
        if (B.bh) B.bh.dead = true;
        bodies.splice(i, 1);
      }
      for (var k = freeL.length - 1; k >= 0; k--) { killLetter(freeL[k]); freeL.splice(k, 1); }
      for (var f = formulas.length - 1; f >= 0; f--) { killFormula(formulas[f]); formulas.splice(f, 1); }
      shakeOn = false; shakeAmp = 0; shakeDur = 0;
      table.style.transform = '';
      invalidateTableOrigin();
    }
    /* 清空：场上全清，面板恢复 56 个字形的完好状态 */
    function clearAll() {
      removeAllBodies();
      rebuildPanel();
      opLog('clear');   // 操作日志（2026-10-01）
    }
    /* 全部收进面板：把场上所有实体**拆回字形**并归还面板 */
    function collectToPanel() {
      for (var i = bodies.length - 1; i >= 0; i--) {
        var B = bodies[i];
        for (var s = B.glyphs.length - 1; s >= 0; s--) { if (B.glyphs[s].stk) killG(B.glyphs[s]); }
        var lets = [];
        if (B.massG) lets.push(B.massG);
        for (var m = 0; m < B.mem.length; m++) if (B.mem[m] !== B.massG) lets.push(B.mem[m]);
        for (var L = 0; L < lets.length; L++) {
          var g = lets[L];
          if (g.body === B) { g.body = null; g.inBody = false; }
          g.pop = 0;
          dockLetter(g);
        }
        B.glyphs = []; B.mem = [];
        destroyPills(B);
        if (B.bh) B.bh.dead = true;
        var bi = bodies.indexOf(B); if (bi >= 0) bodies.splice(bi, 1);
      }
      for (var f = formulas.length - 1; f >= 0; f--) { killFormula(formulas[f]); formulas.splice(f, 1); }
      for (var k = freeL.length - 1; k >= 0; k--) {
        var d = freeL[k];
        freeL.splice(k, 1);
        dockLetter(d);
      }
      if (BH_FINALE) BH_FINALE = null;
      resetTrashPos();
      sortPanel();
      return { docked: panel.children.length };
    }

    function overlap(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }
    function eraseUnderTrash() {
      var r = worldRect(trash);
      for (var i = freeL.length - 1; i >= 0; i--) {
        var d = freeL[i];
        if (overlap(r, worldRect(d.el))) killLetter(d);
      }
      for (var j = bodies.length - 1; j >= 0; j--) {
        var B = bodies[j], hit = false;
        for (var k = 0; k < B.glyphs.length; k++) {
          if (B.glyphs[k].el && overlap(r, worldRect(B.glyphs[k].el))) { hit = true; break; }
        }
        if (hit) killBody(B);
      }
    }
    onEv(trash, 'dblclick', function (e) { e.preventDefault(); clearAll(); });
    var trashDrag = { active: false };
    onEv(trash, 'pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      trashDrag.active = true;
      var r = worldRect(trash);
      trash.style.right = 'auto'; trash.style.bottom = 'auto';
      trash.style.left = r.left + 'px'; trash.style.top = r.top + 'px';
      trash.classList.add('on');
    });

    function killBody(B) {
      var i = bodies.indexOf(B); if (i >= 0) bodies.splice(i, 1);
      destroyPills(B);
      // 解散涉及 B 的双星/轨道连接（同伴**切向释放**）
      if (B.go) {
        var gD = B.go, txd = -Math.sin(gD.ang), tyd = Math.cos(gD.ang);
        var P2 = (gD.bin) ? gD.by : null;
        if (P2 && bodies.indexOf(P2) >= 0) {
          P2.vx = txd * gD.w * (gD.rad * ((gD.bin) ? gD.rP : 1));
          P2.vy = tyd * gD.w * (gD.rad * ((gD.bin) ? gD.rP : 1));
          P2.goB = null;
        }
        B.go = null;
      }
      if (B.goB && bodies.indexOf(B.goB) >= 0) {
        var H = B.goB, gH = H.go;
        if (gH) { var txd2 = -Math.sin(gH.ang), tyd2 = Math.cos(gH.ang); H.vx = txd2 * gH.w * (gH.rad * gH.rB); H.vy = tyd2 * gH.w * (gH.rad * gH.rB); H.go = null; }
        H.goB = null;
        B.goB = null;
      }
      if (B.bh) { B.bh.dead = true; B.bh = null; }
      B.diss = true;
      for (var j = 0; j < B.glyphs.length; j++) {
        var g = B.glyphs[j];
        if (g.body === B) { g.body = null; g.inBody = false; killLetter(g); }
      }
      B.glyphs = []; B.mem = [];
    }

    /* ---------------- 碎裂后飘出的"公式碎片" ---------------- */
    function mkFG(ch, size) {
      var el = DD.createElement('div');
      el.className = 'ps-char';
      el.style.fontSize = size + 'px';
      el.style.pointerEvents = 'none';
      el.style.cursor = 'default';
      el.style.zIndex = '8';
      el.textContent = ch;
      table.appendChild(el);
      var m = metS(ch, size);
      el.style.display = 'none';
      var d = { el: el, ch: ch, m: m, sx: 0, sy: 0, dead: false };
      el._letterRef = d;
      return d;
    }
    function buildFormulaGlyphs(Fo, which) {
      function tok(ch, sub) { return { ch: ch, sub: sub ? true : false }; }
      var lhs, COM = '\u5171';
      var num, den;
      if (which === 1) {
        lhs = [tok('v'), tok(SUB1, true), tok(PRIME), tok('=')];
        num = [tok('('), tok('m'), tok(SUB1, true), tok('\u2212'), tok('m'), tok(SUB2, true), tok(')'), tok('v'), tok(SUB1, true), tok('+'), tok('2'), tok('m'), tok(SUB2, true), tok('v'), tok(SUB2, true)];
        den = [tok('m'), tok(SUB1, true), tok('+'), tok('m'), tok(SUB2, true)];
      } else if (which === 2) {
        lhs = [tok('v'), tok(SUB2, true), tok(PRIME), tok('=')];
        num = [tok('('), tok('m'), tok(SUB2, true), tok('\u2212'), tok('m'), tok(SUB1, true), tok(')'), tok('v'), tok(SUB2, true), tok('+'), tok('2'), tok('m'), tok(SUB1, true), tok('v'), tok(SUB1, true)];
        den = [tok('m'), tok(SUB2, true), tok('+'), tok('m'), tok(SUB1, true)];
      } else if (which === 3) {
        lhs = [tok('v'), tok(SUB1, true), tok(PRIME), tok('=')];
        num = [tok('('), tok('m'), tok(SUB1, true), tok('\u2212'), tok('m'), tok(SUB2, true), tok(')'), tok('v'), tok(SUB1, true)];
        den = [tok('m'), tok(SUB1, true), tok('+'), tok('m'), tok(SUB2, true)];
      } else if (which === 4) {
        lhs = [tok('v'), tok(SUB2, true), tok(PRIME), tok('=')];
        num = [tok('2'), tok('m'), tok(SUB1, true), tok('v'), tok(SUB1, true)];
        den = [tok('m'), tok(SUB1, true), tok('+'), tok('m'), tok(SUB2, true)];
      } else {
        lhs = [tok('v'), tok(COM, true), tok('=')];
        num = [tok('m'), tok(SUB1, true), tok('v'), tok(SUB1, true), tok('+'), tok('m'), tok(SUB2, true), tok('v'), tok(SUB2, true)];
        den = [tok('m'), tok(SUB1, true), tok('+'), tok('m'), tok(SUB2, true)];
      }
      function sizeOf(t) { return t.sub ? F * 0.62 : F; }
      function run(tokens) {
        var x = 0, items = [];
        for (var i = 0; i < tokens.length; i++) {
          var t = tokens[i];
          var g = mkFG(t.ch, sizeOf(t));
          var w = g.m.w;
          items.push({ g: g, x0: x, w: w, sub: t.sub });
          Fo.glyphs.push(g);
          x += w + (i < tokens.length - 1 ? 3 : 0);
        }
        return { items: items, width: x };
      }
      var L = run(lhs), N = run(num), D = run(den);
      var fracW = Math.max(N.width, D.width) + 14;
      var barGap = 5;
      var nTop = 1e9, nBot = -1e9;
      N.items.forEach(function (it) { var s = it.sub ? 0.62 : 1; nTop = Math.min(nTop, it.g.m.top * s); nBot = Math.max(nBot, it.g.m.bot * s); });
      var nShift = -barGap - nBot;
      N.items.forEach(function (it) { it.g.sx = (-N.width / 2) + it.x0 + it.w / 2; it.g.sy = nShift; });
      var dTop = 1e9, dBot = -1e9;
      D.items.forEach(function (it) { var s = it.sub ? 0.62 : 1; dTop = Math.min(dTop, it.g.m.top * s); dBot = Math.max(dBot, it.g.m.bot * s); });
      var dShift = barGap - dTop;
      D.items.forEach(function (it) { it.g.sx = (-D.width / 2) + it.x0 + it.w / 2; it.g.sy = dShift; });
      var wholeTop = nTop + nShift, wholeBot = dBot + dShift;
      var cY = -(wholeTop + wholeBot) / 2;
      N.items.forEach(function (it) { it.g.sy += cY; });
      D.items.forEach(function (it) { it.g.sy += cY; });
      var lhsX0 = -(fracW / 2) - 8 - L.width;
      L.items.forEach(function (it) { it.g.sx = lhsX0 + it.x0 + it.w / 2; it.g.sy = cY; });
      var totalL = lhsX0, totalR = fracW / 2;
      var cX = -(totalL + totalR) / 2;
      N.items.forEach(function (it) { it.g.sx += cX; });
      D.items.forEach(function (it) { it.g.sx += cX; });
      L.items.forEach(function (it) { it.g.sx += cX; });
      Fo.bar = { x1: cX - fracW / 2, y: cY, x2: cX + fracW / 2 };
      var extW = totalR - totalL, extH = wholeBot - wholeTop;
      Fo.sc = clamp(150 / Math.max(extW, extH), 0.55, 1);
      Fo.hw = extW * Fo.sc / 2; Fo.hh = extH * Fo.sc / 2;
    }
    function spawnFormula(which, x, y, bvx, bvy) {
      var Fo = { x: x, y: y, vx: bvx, vy: bvy, age: 0, life: 14, glyphs: [], alpha: 1, dead: false, bar: null, sc: 1, hw: 60, hh: 30, stoppedAt: null };
      buildFormulaGlyphs(Fo, which);
      var sc = Fo.sc || 1;
      for (var i = 0; i < Fo.glyphs.length; i++) {
        var g = Fo.glyphs[i];
        g.el.style.display = '';
        g.el.style.left = (x + g.sx * sc) + 'px';
        g.el.style.top = (y + g.sy * sc) + 'px';
        g.el.style.transform = 'translate(-50%,-50%) scale(' + sc + ')';
        g.el.style.transformOrigin = 'center';
        g.el.style.opacity = '1';
      }
      formulas.push(Fo);
      return Fo;
    }
    function spawnText(text, x, y, bvx, bvy) {
      var Fo = { x: x, y: y, vx: bvx, vy: bvy, age: 0, life: 14, glyphs: [], alpha: 1, dead: false, bar: null, sc: 1, hw: 60, hh: 30, stoppedAt: null };
      var g = mkFG(text, F * 0.92);
      g.sx = 0; g.sy = 0;
      Fo.glyphs.push(g);
      var w = g.el.offsetWidth || 120, h = g.el.offsetHeight || 44;
      Fo.sc = clamp(150 / Math.max(w, h), 0.55, 1);
      Fo.hw = w * Fo.sc / 2; Fo.hh = h * Fo.sc / 2;
      g.el.style.display = '';
      g.el.style.left = (x) + 'px';
      g.el.style.top = (y) + 'px';
      g.el.style.transform = 'translate(-50%,-50%) scale(' + Fo.sc + ')';
      g.el.style.transformOrigin = 'center';
      g.el.style.opacity = '1';
      formulas.push(Fo);
      return Fo;
    }
    function stepFormulas(dt) {
      for (var i = formulas.length - 1; i >= 0; i--) {
        var F2 = formulas[i];
        F2.age += dt;
        if (F2.hw && pointer.x > F2.x - F2.hw && pointer.x < F2.x + F2.hw && pointer.y > F2.y - F2.hh && pointer.y < F2.y + F2.hh) {
          F2.stoppedAt = null;
        }
        var damp = Math.pow(0.22, dt);
        F2.vx *= damp; F2.vy *= damp;
        F2.x += F2.vx * dt; F2.y += F2.vy * dt;
        var margin = 22, e = 0.9;
        if (F2.x < margin) { F2.x = margin; if (F2.vx < 0) F2.vx = -F2.vx * e; }
        if (F2.x > W - margin) { F2.x = W - margin; if (F2.vx > 0) F2.vx = -F2.vx * e; }
        if (F2.y < margin) { F2.y = margin; if (F2.vy < 0) F2.vy = -F2.vy * e; }
        if (F2.y > groundY - margin) { F2.y = groundY - margin; if (F2.vy > 0) F2.vy = -F2.vy * e; }
        var sp = Math.hypot(F2.vx, F2.vy);
        if (sp < 26) { if (F2.stoppedAt == null) F2.stoppedAt = F2.age; } else { F2.stoppedAt = null; }
        var a = 1;
        if (F2.stoppedAt != null) {
          var idle = F2.age - F2.stoppedAt - 3.0;
          if (idle > 0) {
            var blink = 0.35 + 0.65 * Math.abs(Math.sin(F2.age * 6));
            var fade = clamp(1 - idle / 2.0, 0, 1);
            a = blink * fade;
            if (idle >= 2.0) { killFormula(F2); formulas.splice(i, 1); continue; }
          }
        }
        F2.alpha = a;
        var sc = F2.sc || 1;
        for (var j = 0; j < F2.glyphs.length; j++) {
          var g = F2.glyphs[j];
          g.el.style.left = (F2.x + g.sx * sc) + 'px';
          g.el.style.top = (F2.y + g.sy * sc) + 'px';
          g.el.style.transform = 'translate(-50%,-50%) scale(' + sc + ')';
          g.el.style.opacity = a;
        }
        if (F2.age >= F2.life) { killFormula(F2); formulas.splice(i, 1); }
      }
    }
    function killFormula(Fo) {
      for (var i = 0; i < Fo.glyphs.length; i++) {
        var g = Fo.glyphs[i];
        if (g.el && g.el.parentNode) g.el.parentNode.removeChild(g.el);
      }
      Fo.glyphs = []; Fo.dead = true;
    }

    /* ---------------- 粒子 / 震动 / 爆炸 ---------------- */
    var shakeAmp = 0, shakeDur = 0, shakeT = 0, shakeOn = false;
    function shake(a, d) { shakeAmp = Math.max(shakeAmp, a); shakeDur = Math.max(shakeDur, d); shakeT = 0; shakeOn = true; }
    function stepParticles(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.age += dt;
        var damp = Math.pow(0.35, dt);
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.alpha = Math.max(0, 1 - p.age / p.life);
        if (p.age >= p.life) particles.splice(i, 1);
      }
    }
    function spawnExplosion(cx, cy) {
      var N = 240;
      for (var i = 0; i < N; i++) {
        var ang = Math.random() * 6.2832;
        var sp = 120 + Math.random() * 820;
        particles.push({ x: cx + (Math.random() * 10 - 5), y: cy + (Math.random() * 10 - 5),
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, age: 0,
          life: 0.9 + Math.random() * 1.1, r: 1 + Math.random() * 2.4, alpha: 1 });
      }
    }
    // 冲击波（mc² 爆炸 / 黑洞引爆）：范围内的整个体碎成自己的字母被甩出去；
    // 范围内的游离字母直接汽化；渲染中的公式碎片被吹飞。
    function blastAt(cx, cy, R) {
      for (var j = bodies.length - 1; j >= 0; j--) {
        var O = bodies[j];
        if (O.kind || O.bh) continue;
        if (grab.kind === 'body' && grab.obj === O) continue;
        var dx = O.x - cx, dy = O.y - cy;
        var d = Math.hypot(dx, dy);
        if (d <= R) {
          var dirx = dx / (d || 1), diry = dy / (d || 1);
          var fl = 1200 * (1 - d / R) + 240;
          O.vx += dirx * fl; O.vy += diry * fl;
          O.shatterBlast = true;
        }
      }
      for (var fl2 = freeL.length - 1; fl2 >= 0; fl2--) {
        var L2 = freeL[fl2];
        if (L2.state === 'grab') continue;
        if (Math.hypot(L2.wx - cx, L2.wy - cy) <= R) { killLetter(L2); }
      }
      for (var fx2 = formulas.length - 1; fx2 >= 0; fx2--) {
        var F2 = formulas[fx2];
        var fdx = F2.x - cx, fdy = F2.y - cy;
        var fd = Math.hypot(fdx, fdy);
        if (fd <= R) {
          var k2 = 1 - fd / R;
          F2.vx += (fdx / (fd || 1)) * (900 + 500 * k2);
          F2.vy += (fdy / (fd || 1)) * (900 + 500 * k2);
        }
      }
    }
    function explodeBody(B) {
      var cx = B.x, cy = B.y;
      var i = bodies.indexOf(B); if (i >= 0) bodies.splice(i, 1);
      spawnExplosion(cx, cy);
      for (var j = 0; j < B.glyphs.length; j++) { var g = B.glyphs[j]; if (g.body === B) { g.body = null; g.inBody = false; killLetter(g); } }
      B.glyphs = []; B.mem = [];
      blastAt(cx, cy, 300);
      shake(16, 0.55);
    }
    function stepExplode(dt) {
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (!B.exploding) continue;
        B.explT += dt;
        var T = 0.9;
        var k = clamp(B.explT / T, 0, 1);
        B.infl = 1 + 0.7 * k;
        B.wob = Math.sin(B.explT * 38) * 0.05 * k;
        if (B.explT >= T) { explodeBody(B); break; }
      }
    }
    function burstParticles(cx, cy, n, sp) {
      for (var i = 0; i < n; i++) {
        var ang = Math.random() * 6.2832;
        var v = 140 + Math.random() * 320 * sp;
        particles.push({ x: cx + (Math.random() * 16 - 8), y: cy + (Math.random() * 16 - 8),
          vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, age: 0,
          life: 0.7 + Math.random() * 0.8, r: 1.2 + Math.random() * 2.2, alpha: 1 });
      }
    }
    function killFieldBody(O) {
      burstParticles(O.x, O.y, 16, 1.1);
      ringGo(O.x, O.y);
      killBody(O);
    }
    function explodeBlackHole(B) {
      var cx = B.x, cy = B.y;
      var i = bodies.indexOf(B); if (i >= 0) bodies.splice(i, 1);
      if (B.bh) B.bh.dead = true;
      B.diss = true;
      B.glyphs.slice().forEach(function (g) { if (g.body === B) { g.body = null; g.inBody = false; killLetter(g); } });
      B.glyphs = []; B.mem = [];
      spawnExplosion(cx, cy);
      for (var w = 0; w < 120; w++) {
        var wa = Math.random() * 6.2832, ws = 200 + Math.random() * 900;
        particles.push({ x: cx, y: cy, vx: Math.cos(wa) * ws, vy: Math.sin(wa) * ws, age: 0,
          life: 0.5 + Math.random() * 0.7, r: 1 + Math.random() * 2, alpha: 1, hot: true });
      }
      shake(22, 0.8);
      blastAt(cx, cy, BLAST_R);
    }

    /* ---------------- 黑洞（2GM/c²）+ 终局演出 ---------------- */
    var BH_FINALE = null;
    function stepBlackHole(dt) {
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (!B.bh) continue;
        var bh = B.bh;
        bh.age += dt; bh.spin += dt * (0.5 + bh.r / 60);
        if (bh.stage === 0) {
          // 阶段 0 —— 塌缩：视界向外长，公式的字母（2、G、M、c、²）螺旋向内被吸进去（alpha -> 0）
          bh.t += dt;
          var k = bh.t / 0.8;
          if (k >= 1) { bh.stage = 1; bh.r = BH_MAXR; continue; }
          var ek = 1 - Math.pow(1 - clamp(k, 0, 1), 3);
          bh.r = BH_MAXR * ek * 0.5;
          B.infl = clamp(1 - k * 1.4, 0, 1); B.wob = Math.sin(bh.t * 30) * 0.3 * k;
          bh.fade = (k > 0.7) ? clamp(1 - (k - 0.7) * 4, 0, 1) : 1;
          if (k >= 0.92) {
            B.glyphs.slice().forEach(function (g) { if (g.body === B) { g.body = null; g.inBody = false; killLetter(g); } });
            B.glyphs = [];
          }
          continue;
        }
        // ---- 阶段 1 —— 存活：吞掉画面上的一切（全屏吸积）----
        if (B.vx || B.vy) { B.vx = 0; B.vy = 0; }
        if (BH_FINALE && BH_FINALE.hole === B) continue;
        if (grab.kind === 'body' && grab.obj === B) continue;
        var reach = BH_REACH;
        for (var j = bodies.length - 1; j >= 0; j--) {
          var O = bodies[j];
          if (O === B || O.bh) continue;
          if (grab.kind === 'body' && grab.obj === O) continue;
          var dx = B.x - O.x, dy = B.y - O.y;
          var d = Math.hypot(dx, dy) || 1;
          if (d > reach) { O.bhFade = null; O.bhShed = 0; continue; }
          // 螺旋吸积，越近越强：径向 + 切向 + **吸积阻尼**（正比于速度的能量汇）。
          var fall = (O.kind === 'q' || O.kind === 'I');
          var src = (O.kind === 'B' || O.kind === 'E');
          var taper = clamp(1 - d / reach, 0, 1);
          var inv = 1 / Math.max(d, 20);
          var ux2 = dx * inv, uy2 = dy * inv;
          var tx2 = -uy2, ty2 = ux2;
          var pull = (fall ? 1600 : (src ? 5000 : 20000)) * bh.r / (d * d) * (dt * 60) * taper;
          O.vx += ux2 * pull; O.vy += uy2 * pull;
          O.vx += tx2 * pull * 0.5; O.vy += ty2 * pull * 0.5;
          var drg = Math.pow(0.25, dt * 1.6 * Math.min(1, bh.r / Math.max(d, 30)));
          O.vx *= drg; O.vy *= drg;
          if (src || O.kind === 'T') { O.x += O.vx * dt; O.y += O.vy * dt; }   // 静态体在这里自己积分
          var near = clamp(1 - (d - bh.r) / 280, 0, 1);
          if (near > 0) {
            O.bhShed = (O.bhShed || 0) + dt;
            var iv = 0.06 - 0.045 * near;
            if (O.bhShed >= iv) {
              O.bhShed = 0;
              burstParticles(O.x + (Math.random() * 22 - 11), O.y + (Math.random() * 22 - 11), 2 + Math.round(near * 3), 0.45);
            }
            O.bhFade = clamp(1 - near * 1.1, 0.06, 1);
          }
          if (d < bh.r + 16) {
            if (fall || src) { burstParticles(O.x, O.y, 12, 1); killFieldBody(O); }
            else { annihBody(O); }
          }
        }
        for (var fl = freeL.length - 1; fl >= 0; fl--) {
          var L2 = freeL[fl];
          if (L2.state === 'grab') continue;
          var fdx = B.x - L2.wx, fdy = B.y - L2.wy;
          var fd = Math.hypot(fdx, fdy) || 1;
          if (fd > reach) continue;
          var fux = fdx / fd, fuy = fdy / fd;
          var ftap = clamp(1 - fd / reach, 0, 1);
          var fpull = (26000 * bh.r) / (fd * fd) * (dt * 60) * ftap;
          L2.vx += fux * fpull * 2.2; L2.vy += fuy * fpull * 2.2;
          L2.vx += (-fuy) * fpull * 0.5; L2.vy += (fux) * fpull * 0.5;
          var fnear = clamp(1 - (fd - bh.r) / 280, 0, 1);
          if (fnear > 0) {
            L2.bhShed = (L2.bhShed || 0) + dt;
            var fiv = 0.06 - 0.045 * fnear;
            if (L2.bhShed >= fiv) {
              L2.bhShed = 0;
              burstParticles(L2.wx + (Math.random() * 10 - 5), L2.wy + (Math.random() * 10 - 5), 1 + Math.round(fnear * 2), 0.4);
            }
            L2.fade = clamp(1 - fnear * 1.0, 0.1, 1);
          }
          if (fd < bh.r + 8) { killLetter(L2); burstParticles(B.x, B.y, 14, 1); }
        }
        for (var fx = formulas.length - 1; fx >= 0; fx--) {
          var F2 = formulas[fx];
          var fx2 = B.x - F2.x, fy2 = B.y - F2.y;
          var fd2 = Math.hypot(fx2, fy2) || 1;
          if (fd2 > reach) continue;
          var fux2 = fx2 / fd2, fuy2 = fy2 / fd2;
          var ftap2 = clamp(1 - fd2 / reach, 0, 1);
          var fp = (20000 * bh.r) / (fd2 * fd2) * (dt * 60) * ftap2;
          F2.vx += fux2 * fp * 2.2 - fuy2 * fp * 0.5; F2.vy += fuy2 * fp * 2.2 + fux2 * fp * 0.5;
          if (fd2 < bh.r + 10) { killFormula(F2); formulas.splice(fx, 1); burstParticles(B.x, B.y, 14, 1); }
        }
        for (var pi = particles.length - 1; pi >= 0; pi--) {
          var p = particles[pi];
          var pdx = B.x - p.x, pdy = B.y - p.y;
          var pd = Math.hypot(pdx, pdy) || 1;
          if (pd > reach) continue;
          var pux = pdx / pd, puy = pdy / pd;
          var ptap = clamp(1 - pd / reach, 0, 1);
          var ppull = (30000 * bh.r) / (pd * pd) * (dt * 60) * ptap;
          p.vx += pux * ppull * 1.6 - puy * ppull * 0.5;
          p.vy += puy * ppull * 1.6 + pux * ppull * 0.5;
          if (pd < bh.r * 0.75) { particles.splice(pi, 1); }
        }
        stepBlackHolePanel(B, bh, dt);
        bh.r = BH_MAXR + Math.sin(bh.age * 2.2) * 3;   // 视界缓慢呼吸
      }
    }
    // 黑洞会慢慢把面板里停靠的字母一个一个拽出来。每被拿走一个字母，托盘就留一个
    // **空格**（托盘本身不缩小、不散架：4×4 的格子由 CSS 固定，字母由 sortPanel 钉在各自格子里）
    function ensurePanelEat(bh) {
      if (bh.panelEat) return;
      bh.panelEat = { t: 0.45 + Math.random() * 0.35 };
    }
    function stepBlackHolePanel(B, bh, dt) {
      ensurePanelEat(bh);
      var pe = bh.panelEat;
      if (!pe) return;
      pe.t -= dt;
      if (pe.t > 0) return;
      var pool = [];
      var chars = [].slice.call(panel.querySelectorAll('.ps-char'));
      for (var i = 0; i < chars.length; i++) {
        var r = worldRect(chars[i]);
        var ref = chars[i]._letterRef;
        if (ref && ref.state === 'dock' && ref.el === chars[i]) {
          pool.push({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, d: ref });
        }
      }
      if (!pool.length) { maybeStartFinale(); return; }   // 托盘空了 -> 进入终局
      // 随机成批：有时只溜走一个，有时两三个一起走，永远在整个托盘里随机挑
      var rr = Math.random();
      var count = rr < 0.38 ? 1 : rr < 0.68 ? 2 : rr < 0.88 ? 3 : 4;
      if (count > pool.length) count = pool.length;
      for (var c = 0; c < count; c++) {
        var idx = Math.floor(Math.random() * pool.length);
        var cell = pool[idx];
        pool.splice(idx, 1);
        if (!cell || !cell.d) continue;
        var dx = B.x - cell.cx, dy = B.y - cell.cy, dd = Math.hypot(dx, dy) || 1;
        var sp = 180 + Math.random() * 300;
        var jx = (Math.random() - 0.5) * 130, jy = (Math.random() - 0.5) * 130;
        freeLetter(cell.d, cell.cx, cell.cy, (dx / dd) * sp + jx, (dy / dd) * sp + jy, 1);
      }
      pe.t = 0.5 + Math.random() * 1.15;
    }
    var BH_CHARS = ['m', 'M', 'g', 'a', 'v', 'r', '\u00BD', '\u03BC', 'c', 'G', 't', 'B', 'E', 'q', 'I'];
    function finaleSlot(i, pr) {
      var cl = i % 4, row = Math.floor(i / 4);
      return { x: pr.left + 10 + cl * 50 + 22, y: pr.top + 10 + row * 50 + 22 };
    }
    function resetTrashPos() {
      trash.style.left = ''; trash.style.top = ''; trash.style.transform = '';
      trash.style.right = '14px'; trash.style.bottom = '14px';
    }
    function trashTo(px, py) {
      trash.style.right = 'auto'; trash.style.bottom = 'auto';
      trash.style.left = px + 'px'; trash.style.top = py + 'px';
    }
    function trashCenter() {
      var r = worldRect(trash);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    // 终局：黑洞把面板字全吃光、场上也没别的东西之后，把垃圾桶从屏幕那头拽过来，
    // 自己钻进去，垃圾桶抖两下（里面有东西想出来），然后炸开 —— 15 个字母飞出来各自
    // 滑回格子，垃圾桶回到右下角。
    function maybeStartFinale() {
      if (BH_FINALE) return;
      if (grab.kind || trashDrag.active) return;
      var hole = null;
      for (var i = 0; i < bodies.length; i++) {
        var Bx = bodies[i];
        if (Bx.bh && Bx.bh.stage === 1) { hole = Bx; break; }
      }
      if (!hole) return;
      var docked = false;
      var chars = panel.querySelectorAll('.ps-char');
      for (var j = 0; j < chars.length; j++) {
        var ref = chars[j]._letterRef;
        if (ref && ref.state === 'dock') { docked = true; break; }
      }
      if (docked) return;
      if (bodies.length > 1) return;
      if (freeL.length || formulas.length) return;
      var bin = worldRect(trash);
      hole.bh.finalizing = true;
      BH_FINALE = { ph: 'pull', t: 0, hole: hole, hx: hole.x, hy: hole.y,
        bl: bin.left, bt: bin.top, bw: bin.width, bhh: bin.height,
        pullD: 1.05, suckD: 0.55, shakeD: 0.85, letters: [], removed: false };
    }
    function suckPuff(x, y, tx, ty) {
      for (var n = 0; n < 3; n++) {
        var a = Math.random() * 6.2832;
        particles.push({ x: x + (Math.random() * 10 - 5), y: y + (Math.random() * 10 - 5),
          vx: Math.cos(a) * 60 + (tx - x) * 1.6, vy: Math.sin(a) * 60 + (ty - y) * 1.6,
          age: 0, life: 0.28 + Math.random() * 0.22, r: 1 + Math.random() * 1.4, alpha: 1 });
      }
    }
    function finaleBurst() {
      var F2 = BH_FINALE;
      var pr = worldRect(panel);
      var names = [];
      for (var q = 0; q < PAL.length; q++) names.push(PAL[q].k);
      for (var i = 0; i < BH_CHARS.length; i++) {
        var old = P[names[i]];
        if (old && old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
        var nd = makePalLetter({ k: names[i], ch: BH_CHARS[i] });
        nd.cat = 1; nd.pop = 0;
        nd.el.style.fontSize = '34px';
        nd.el.style.pointerEvents = 'none';
        table.appendChild(nd.el);
        var a = Math.random() * 6.2832, sp = 240 + Math.random() * 360;
        var tgt = finaleSlot(i, pr);
        F2.letters.push({ d: nd, el: nd.el, x: F2.bx || F2.hx, y: F2.by || F2.hy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tx: tgt.x, ty: tgt.y, arr: false });
        place(nd, F2.hx, F2.hy, 0, 1, true);
      }
      burstParticles(F2.hx, F2.hy, 24, 1.5);
      ringGo(F2.hx, F2.hy);
    }
    function stepFinale(dt) {
      if (!BH_FINALE) { maybeStartFinale(); return; }
      var F2 = BH_FINALE;
      F2.t += dt;
      if (F2.ph === 'pull') {
        var e = Math.min(1, F2.t / F2.pullD); e = e * e;
        var bc = trashCenter();
        var sx = F2.bl + F2.bw / 2, sy = F2.bt + F2.bhh / 2;
        var cx = sx + (F2.hx - sx) * e, cy = sy + (F2.hy - sy) * e;
        trashTo(cx - F2.bw / 2, cy - F2.bhh / 2);
        if (F2.t >= F2.pullD) { F2.ph = 'suck'; F2.t = 0; }
      } else if (F2.ph === 'suck') {
        var e2 = Math.min(1, F2.t / F2.suckD);
        var h = F2.hole;
        if (h.bh) h.bh.r = Math.max(1.5, BH_MAXR * (1 - e2));
        if (Math.random() < 0.8) suckPuff(h.x, h.y, F2.hx, F2.hy);
        if (F2.t >= F2.suckD) {
          var hx = h.x, hy = h.y;
          var bi = bodies.indexOf(h); if (bi >= 0) bodies.splice(bi, 1);
          if (h.bh) { h.bh.dead = true; }
          F2.removed = true;
          burstParticles(hx, hy, 20, 1.2);
          shake(10, 0.35);
          F2.ph = 'shake'; F2.t = 0;
        }
      } else if (F2.ph === 'shake') {
        var p = Math.min(1, F2.t / F2.shakeD);
        var cyc = p * 2.2, n2 = Math.floor(cyc), f2 = cyc - n2;
        var amp = (1 - p) * 11;
        var ox = (n2 % 2 === 0 ? 1 : -1) * Math.sin(f2 * Math.PI) * amp;
        var oy = Math.sin(f2 * Math.PI * 1.7) * 2.4 * (1 - p);
        trash.style.transform = 'translate(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px)';
        if (F2.t >= F2.shakeD) { F2.ph = 'fly'; F2.t = 0; finaleBurst(); }
      } else if (F2.ph === 'fly') {
        var any = false;
        for (var i = 0; i < F2.letters.length; i++) {
          var L = F2.letters[i];
          if (L.arr) continue;
          any = true;
          L.vx += (L.tx - L.x) * 24 * dt; L.vy += (L.ty - L.y) * 24 * dt;
          L.vx *= Math.pow(0.86, dt * 60); L.vy *= Math.pow(0.86, dt * 60);
          var sp2 = Math.hypot(L.vx, L.vy);
          if (sp2 > 1500) { L.vx *= 1500 / sp2; L.vy *= 1500 / sp2; }
          L.x += L.vx * dt; L.y += L.vy * dt;
          L.el.style.left = (L.x - L.el.offsetWidth / 2) + 'px';
          L.el.style.top = (L.y - L.el.offsetHeight / 2) + 'px';
          var d2 = Math.hypot(L.tx - L.x, L.ty - L.y);
          if (d2 < 4 && sp2 < 140) { L.arr = true; L.el.style.pointerEvents = ''; dockLetter(L.d); }
        }
        var e4 = Math.min(1, F2.t / 1.1);
        var hx0 = F2.hx, hy0 = F2.hy;
        var hcx = F2.bl + F2.bw / 2, hcy = F2.bt + F2.bhh / 2;
        var cx2 = hx0 + (hcx - hx0) * e4, cy2 = hy0 + (hcy - hy0) * e4;
        trashTo(cx2 - F2.bw / 2, cy2 - F2.bhh / 2);
        var arrN = 0; for (var k = 0; k < F2.letters.length; k++) if (F2.letters[k].arr) arrN++;
        if ((!any && arrN === F2.letters.length) || F2.t > 4.5) {
          for (var m2 = 0; m2 < F2.letters.length; m2++) {
            var L2 = F2.letters[m2];
            if (!L2.arr) { L2.arr = true; L2.el.style.pointerEvents = ''; dockLetter(L2.d); }
          }
          resetTrashPos();
          BH_FINALE = null;
          return;
        }
      }
    }
    function annihBody(O) {
      burstParticles(O.x, O.y, 22, 1.2);
      ringGo(O.x, O.y);
      var i = bodies.indexOf(O); if (i >= 0) bodies.splice(i, 1);
      if (O.go) {
        var gD = O.go;
        if (gD.bin) { var P2 = gD.by; if (P2 && bodies.indexOf(P2) >= 0) { P2.vx = -Math.sin(gD.ang) * gD.w * gD.rad * gD.rP; P2.vy = Math.cos(gD.ang) * gD.w * gD.rad * gD.rP; P2.goB = null; } }
        O.go = null;
      }
      if (O.goB && bodies.indexOf(O.goB) >= 0) {
        var H2 = O.goB, gH2 = H2.go;
        if (gH2) { H2.vx = -Math.sin(gH2.ang) * gH2.w * gH2.rad * gH2.rB; H2.vy = Math.cos(gH2.ang) * gH2.w * gH2.rad * gH2.rB; H2.go = null; }
        O.goB.goB = null;
      }
      O.diss = true;
      for (var j = 0; j < O.glyphs.length; j++) {
        var g = O.glyphs[j];
        if (g.body === O) { g.body = null; g.inBody = false; killLetter(g); }
      }
      O.glyphs = []; O.mem = [];
    }

    /* ---------------- canvas 绘制 ---------------- */
    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        cvx.fillStyle = p.hot ? ('rgba(255,224,150,' + p.alpha + ')') : ('rgba(38,34,28,' + p.alpha + ')');
        cvx.beginPath(); cvx.arc(p.x, p.y, p.r, 0, 6.2832); cvx.fill();
      }
    }
    function drawFieldDots(cx, cy, R) {
      cvx.fillStyle = 'rgba(38,34,28,0.16)';
      var sp = 26;
      for (var gx = -R; gx <= R; gx += sp) {
        for (var gy = -R; gy <= R; gy += sp) {
          if (gx * gx + gy * gy <= R * R) {
            cvx.beginPath();
            cvx.arc(cx + gx, cy + gy, 1.7, 0, 6.2832);
            cvx.fill();
          }
        }
      }
      cvx.strokeStyle = 'rgba(38,34,28,0.10)';
      cvx.lineWidth = 1;
      cvx.beginPath();
      cvx.arc(cx, cy, R, 0, 6.2832);
      cvx.stroke();
    }
    function drawFieldE(cx, cy, R, th) {
      // E 场：**方形**范围（半边长 hs），被 9 条长平行箭头穿过，箭头**顶到**虚线边。
      // 颜色与透明度跟 B 场一致（38,34,28 @ ~0.18），电场和磁场一样含蓄，不抢戏。
      var hs = R / 2;
      var dx = Math.cos(th), dy = Math.sin(th);
      var px = -dy, py = dx;
      var n = 9, margin = 3, al = 11;
      var ah = Math.atan2(dy, dx);
      cvx.strokeStyle = 'rgba(38,34,28,0.18)';
      cvx.fillStyle = 'rgba(38,34,28,0.18)';
      cvx.lineWidth = 1.4; cvx.lineCap = 'round';
      for (var i = 0; i < n; i++) {
        var off = (i - (n - 1) / 2) * (2 * hs / n);
        var ox = cx + px * off, oy = cy + py * off;
        // 把这条无限长的场线按 slab 法裁到正方形里，于是每条箭头都正好横跨它穿过的那段
        var t0 = -1e9, t1 = 1e9, okk = true;
        if (Math.abs(dx) > 1e-6) {
          var a1 = (-hs - (ox - cx)) / dx, a2 = (hs - (ox - cx)) / dx;
          t0 = Math.max(t0, Math.min(a1, a2)); t1 = Math.min(t1, Math.max(a1, a2));
        } else if (Math.abs(ox - cx) > hs) okk = false;
        if (okk) {
          if (Math.abs(dy) > 1e-6) {
            var b1 = (-hs - (oy - cy)) / dy, b2 = (hs - (oy - cy)) / dy;
            t0 = Math.max(t0, Math.min(b1, b2)); t1 = Math.min(t1, Math.max(b1, b2));
          } else if (Math.abs(oy - cy) > hs) okk = false;
        }
        if (!okk || t1 - t0 < 26) continue;
        var ax = ox + dx * (t0 + margin), ay = oy + dy * (t0 + margin);
        var bx = ox + dx * (t1 - margin), by = oy + dy * (t1 - margin);
        cvx.beginPath(); cvx.moveTo(ax, ay); cvx.lineTo(bx, by); cvx.stroke();
        cvx.beginPath();
        cvx.moveTo(bx, by);
        cvx.lineTo(bx - al * Math.cos(ah - 0.42), by - al * Math.sin(ah - 0.42));
        cvx.lineTo(bx - al * Math.cos(ah + 0.42), by - al * Math.sin(ah + 0.42));
        cvx.closePath(); cvx.fill();
      }
      cvx.strokeStyle = 'rgba(38,34,28,0.12)';
      cvx.lineWidth = 1.2;
      cvx.setLineDash([7, 6]);
      cvx.strokeRect(cx - hs, cy - hs, hs * 2, hs * 2);
      cvx.setLineDash([]);
    }
    function stepShake(dt) {
      if (!shakeOn) return;
      shakeT += dt;
      var k = clamp(1 - shakeT / shakeDur, 0, 1);
      var a = shakeAmp * k;
      var dx = (Math.random() * 2 - 1) * a;
      var dy = (Math.random() * 2 - 1) * a;
      // 只抖"实验台"，不抖页面外壳（原作抖 document.body）
      table.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      if (shakeT >= shakeDur) { table.style.transform = ''; shakeOn = false; shakeAmp = 0; shakeDur = 0; }
    }
    function eOut(x) {
      x = clamp(x, 0, 1);
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    function cubE(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
    function popScale(p) {
      var x = 1 - clamp(p, 0, 1);
      var c1 = 1.70158, c3 = c1 + 1;
      var v = 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      return 0.25 + 0.75 * v;
    }
    function arrow(B, gx, gy, Cx, Cy, ddn) {
      var dx = Cx - gx, dy = Cy - gy;
      var L = Math.hypot(dx, dy);
      if (L < 26) return;
      var ux = dx / L, uy = dy / L;
      var al = 0.3 + 0.45 * ddn;
      var hl = 11;
      var sl = Math.min(Math.max((B.hw || 60) + 4, 10), L - hl - 2);
      var a0 = gx + ux * sl, b0 = gy + uy * sl;
      var bx = Cx - ux * hl, by = Cy - uy * hl;
      cvx.strokeStyle = 'rgba(38,34,28,' + al + ')';
      cvx.lineWidth = 2;
      cvx.lineCap = 'round';
      cvx.beginPath();
      cvx.moveTo(a0, b0);
      cvx.lineTo(bx, by);
      cvx.stroke();
      cvx.fillStyle = 'rgba(38,34,28,' + al + ')';
      cvx.beginPath();
      cvx.moveTo(Cx, Cy);
      cvx.lineTo(bx - uy * 5.5, by + ux * 5.5);
      cvx.lineTo(bx + uy * 5.5, by - ux * 5.5);
      cvx.closePath();
      cvx.fill();
    }
    function orbGeom(B) {
      var o = B.orb;
      if (!o || o.k < 0.02) return;
      var R = o.R || 120;
      var Cx = B.x, Cy = B.y - R;
      var Rk = R * Math.max(o.k, 0.001);
      var n = 72, i;
      var pts = [];
      for (i = 0; i < n; i++) {
        var b = i / n * 6.2832;
        pts.push([Cx + Rk * Math.cos(b), Cy + Rk * Math.sin(b)]);
      }
      cvx.strokeStyle = 'rgba(38,34,28,' + (0.45 * Math.max(o.e, 0.001)) + ')';
      cvx.lineWidth = 1.6;
      cvx.setLineDash([7, 6]);
      cvx.beginPath();
      for (i = 0; i < n; i++) { if (i) cvx.lineTo(pts[i][0], pts[i][1]); else cvx.moveTo(pts[i][0], pts[i][1]); }
      cvx.closePath();
      cvx.stroke();
      cvx.setLineDash([]);
      arrow(B, o.gx != null ? o.gx : B.x, o.gy != null ? o.gy : B.y, Cx, Cy, 1);
    }
    function tickOrbs(dt) {
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.pop && B.pop > 0) B.pop = Math.max(0, B.pop - dt * 3.2);
        var o = B.orb;
        if (!o) continue;
        o.age += dt;
        o.k = eOut(Math.min(o.age / 0.55, 1));
        o.e = cubE((o.age - 0.18) / 0.55);
        var R = o.R || 120;
        var Rk = R * Math.max(o.k, 0.001);
        if (!(grab.kind === 'body' && grab.obj === B)) o.spin += dt * 0.8;
        o.gx = B.x + Rk * Math.cos(o.spin);
        o.gy = B.y - R + Rk * Math.sin(o.spin);
      }
    }
    /* 公式卡：体拼齐一条课本公式时，在它周围画一张**同一套墨线**的卡片。
       风格纪律（别发明新视觉语言）：只用纸色底 + 墨色描边/文字 + 既有的
       pop 缩放（popScale）与屏幕震动机制；字号跟 F 走；不动 DOM 字形的位置。 */
    function drawEquationCard(B) {
      if (!B.eqText) return;
      var pop = (B.pop && B.pop > 0) ? popScale(B.pop) : 1;
      var sc = pop * (B.sc || 1) * (B.infl || 1);
      var th = (B.th || 0) + (B.wob || 0);
      var size = Math.max(11, F * 0.40 * sc);
      var pad = 9 * sc;
      var w = B.hw * 2 + pad * 2, h = B.hh * 2 + pad * 2 + size + 6 * sc;
      var fs = 'italic ' + size + 'px Georgia,"Times New Roman",serif';
      if (cvx.font !== fs) cvx.font = fs;
      var tw = cvx.measureText(B.eqText).width;
      if (tw + pad * 2 > w) w = tw + pad * 2;
      cvx.save();
      cvx.translate(B.x, B.y + B.hh + pad + size * 0.8);
      if (th) cvx.rotate(th);
      var x0 = -w / 2, y0 = -h / 2, r = 5 * sc;
      cvx.fillStyle = 'rgba(255,255,255,0.55)';
      cvx.strokeStyle = 'rgba(120,80,30,0.55)';
      cvx.lineWidth = 1;
      cvx.beginPath();
      cvx.moveTo(x0 + r, y0);
      cvx.lineTo(x0 + w - r, y0); cvx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      cvx.lineTo(x0 + w, y0 + h - r); cvx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
      cvx.lineTo(x0 + r, y0 + h); cvx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
      cvx.lineTo(x0, y0 + r); cvx.quadraticCurveTo(x0, y0, x0 + r, y0);
      cvx.closePath();
      cvx.fill(); cvx.stroke();
      cvx.fillStyle = 'rgba(38,34,28,0.92)';
      cvx.textAlign = 'center';
      cvx.textBaseline = 'middle';
      cvx.fillText(B.eqText, 0, 0);
      /* ---- 实时物理读数（2026-09-30 移植清单 P2-11）：读数做成**可点可拖的
         参数药丸**（DOM 元素，见 buildPills/updatePills），不再是 canvas 上的
         死文字 —— 这样用户自己够得到 R→0 这类状态。数值仍进 bodyState().readout
         供探针断言，卡片只保留公式课本写法。 ---- */
      cvx.restore();
    }
    /* ---- 参数药丸（2026-09-30 移植清单 P2-11）----
       公式卡上的读数做成可点可拖的小药丸（.ps-pill，纸色底、墨色细边，与卡片
       同一套纸墨语言）：
         · 拖动 = 连续改值（量程 VAL_DEF.lo~hi，按 step 取整；R 拖到 0 触发短路，
           I 飙升 + short-circuit 事件由既有的 eqStepOnce 判定，这里只写值）；
         · 单击 = 走一步（到量程顶后 wrap 回起点），悬停 title 写范围与含义。 */
    var pillDrag = null;
    /* ---- 药丸的刻度映射（2026-10-01：R 改**对数刻度**）----
       对数刻度按**归一化位置**映射（f = f0 + dx/220），不是按线性差值：
       0.05 ~ 1e6 这种跨 7 个数量级的量程上，线性差值等于"整段拖动全挤在小数区"，
       另一端永远够不到。取 3 位有效数字（人眼在对数刻度上能读的精度）。 */
    function pillFrac(v, d) {
      var lo = Math.log(d.lo), hi = Math.log(d.hi);
      var x = clamp(v, d.lo, d.hi);
      if (!(x > 0)) x = d.lo;
      return clamp((Math.log(x) - lo) / (hi - lo), 0, 1);
    }
    function pillFromFrac(f, d) {
      var lo = Math.log(d.lo), hi = Math.log(d.hi);
      var v = Math.exp(lo + clamp(f, 0, 1) * (hi - lo));
      var e10 = Math.floor(Math.log(v) / Math.LN10), pw = Math.pow(10, e10 - 2);
      v = Math.round(v / pw) * pw;
      return clamp(v, d.lo, d.hi);       // 端点必须**逐位**落在 lo/hi 上（判据是 <=0.05 / >=1e6）
    }
    function pillFmt(v) {
      if (v == null || !isFinite(v)) return '\u2014';
      var a = Math.abs(v);
      if (a === 0) return '0';
      if (a >= 1e5 || a < 1e-3) return String(+v.toExponential(2)).replace('e', '\u00D710^');
      if (a >= 100) return String(Math.round(v));
      if (a >= 10) return v.toFixed(1);
      return String(Math.round(v * 1000) / 1000);
    }
    function destroyPills(B) {
      if (!B._pills) B._pills = [];   // 首次也必须落成数组：buildPills 会 push（曾在这里崩）
      for (var i = 0; i < B._pills.length; i++) {
        var p = B._pills[i];
        if (p && p.parentNode) p.parentNode.removeChild(p);
      }
      B._pills = [];
      B._tpill = null;
    }
    function buildPills(B) {
      destroyPills(B);
      if (!B.eq || B.kind) return;
      eqInitState(B);
      var seen = {};
      for (var g = 0; g < B.mem.length; g++) {
        var glyph = B.mem[g];
        if (!glyph || glyph.dead) continue;
        var d = VAL_DEF[glyph.type];
        if (!d || seen[glyph.type]) continue;
        seen[glyph.type] = 1;
        if (typeof B.eqState[glyph.type] !== 'number') B.eqState[glyph.type] = d.val;
        var p = DD.createElement('div');
        p.className = 'ps-pill';
        p._pill = 1; p._body = B; p._ch = glyph.type; p._glyph = glyph;
        var palIt = PAL[PAL_ORDER[glyph.type]];
        p.title = ((palIt && palIt.note) ? palIt.note : glyph.type) +
          '\n\u5de6\u53f3\u62d6\u52a8\u6539\u6570\u503c\uff08' + (d.log ? '\u5bf9\u6570\u523b\u5ea6\uff0c' : '') +
          '\u8303\u56f4 ' + d.lo + ' ~ ' + d.hi +
          (d.unit ? ' ' + d.unit : '') + '\uff09\uff1b\u5355\u51fb\u8d70\u4e00\u6b65';
        p.innerHTML = '<i>' + glyph.type + '</i><b>' + pillFmt(B.eqState[glyph.type]) + '</b><u>\u21d4</u>';
        /* ⚠⚠ 必须**经过函数参数**绑定这颗药丸（2026-10-01 修，真机实测踩到）：
           `var p` 是函数作用域，循环里直接写
           `onEv(p, 'pointerdown', function (e) { pillDown(e, p); })`
           会让**所有**药丸的处理器都捕获同一个变量，而循环结束后它指向**最后一颗**
           —— 于是"按 U 拖出来的是 d"：实测 UEd 卡上拖 U 药丸，U 纹丝不动、d 变成 40
           （父 agent 报的"没能把 U 药丸拖上去"就是这个根因，不是手势问题）。
           走一次函数调用，参数 `el` 每次调用各有自己的绑定，闭包才抓对元素。 */
        bindPillDrag(p);
        table.appendChild(p);
        B._pills.push(p);
      }
    }
    /* 把一颗药丸的按下手势绑到**它自己**身上（见 buildPills 里的说明，别inline回去） */
    function bindPillDrag(el) {
      onEv(el, 'pointerdown', function (e) { pillDown(e, el); });
    }
    function updatePills(B) {
      if (!B._pills) return;
      var i;
      for (i = B._pills.length - 1; i >= 0; i--) {
        var p = B._pills[i];
        if (p._tpill) continue;
        if (!p._glyph || p._glyph.dead) {
          if (p.parentNode) p.parentNode.removeChild(p);
          B._pills.splice(i, 1);
          continue;
        }
        if (p.parentNode !== table) table.appendChild(p);
        var b = p.getElementsByTagName('b')[0];
        if (b) b.textContent = pillFmt(B.eqState[p._ch]);
      }
      /* 升温读数：被箭头射线打中后追加一颗只读的 T 药丸（同一套纸墨语言） */
      if (B.temp != null && B.temp > 20.05) {
        if (!B._tpill) {
          var tp = DD.createElement('div');
          tp.className = 'ps-pill'; tp._pill = 1; tp._tpill = 1;
          tp.style.cursor = 'default';
          tp.innerHTML = 'T <b>' + B.temp.toFixed(1) + '</b>';
          table.appendChild(tp);
          B._tpill = tp;
          B._pills.push(tp);
        } else {
          var tb = B._tpill.getElementsByTagName('b')[0];
          if (tb) tb.textContent = B.temp.toFixed(1);
        }
      } else if (B._tpill) {
        var ti = B._pills.indexOf(B._tpill);
        if (ti >= 0) B._pills.splice(ti, 1);
        if (B._tpill.parentNode) B._tpill.parentNode.removeChild(B._tpill);
        B._tpill = null;
      }
      placePills(B);
    }
    function placePills(B) {
      var x = B.x - B.hw, y = B.y + B.hh * 2 + 50;
      for (var i = 0; i < B._pills.length; i++) {
        var p = B._pills[i];
        if (!p.parentNode) continue;
        p.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        x += p.offsetWidth + 4;
      }
    }
    function pillDown(e, p) {
      var B = p._body;
      if (p._tpill) return;
      eqInitState(B);
      pillDrag = { p: p, B: B, ch: p._ch, startX: e.clientX, startVal: B.eqState[p._ch], moved: false };
      p.classList.add('on');
      e.preventDefault();
      e.stopPropagation();
    }
    function pillMove(clientX) {
      var d = VAL_DEF[pillDrag.ch];
      if (Math.abs(clientX - pillDrag.startX) > 2) pillDrag.moved = true;
      var nv;
      if (d.log) {
        nv = pillFromFrac(pillFrac(pillDrag.startVal, d) + (clientX - pillDrag.startX) / 220, d);
      } else {
        var dv = (clientX - pillDrag.startX) * (d.hi - d.lo) / 220;
        nv = clamp(pillDrag.startVal + dv, d.lo, d.hi);
        nv = Math.round(nv / d.step) * d.step;
      }
      var S = pillDrag.B.eqState;
      S[pillDrag.ch] = nv;
      /* R/U 在 ohm 里走 Rset/Uset 镜像（eqStepOnce 每步读它俩）；e 是恢复系数 */
      if (pillDrag.ch === 'R') S.Rset = nv;
      if (pillDrag.ch === 'U') S.Uset = nv;
      updatePills(pillDrag.B);
    }
    function pillUp(clientX) {
      if (!pillDrag.moved) {
        /* 单击 = 一步（"点一下也有效果"与拖动等价，不隐藏手势）；
           对数刻度的"一步" = 1/40 的**归一化**步长（不是 1/40 的数值跨度）。 */
        var d = VAL_DEF[pillDrag.ch];
        var v2;
        if (d.log) {
          var f = pillFrac(pillDrag.B.eqState[pillDrag.ch], d) + 1 / 40;
          v2 = (f > 1) ? d.lo : pillFromFrac(f, d);
        } else {
          var step = (d.hi - d.lo) / 40;
          v2 = pillDrag.B.eqState[pillDrag.ch] + step;
          if (v2 > d.hi) v2 = d.lo;
          v2 = Math.round(v2 / d.step) * d.step;
        }
        var S = pillDrag.B.eqState;
        S[pillDrag.ch] = v2;
        if (pillDrag.ch === 'R') S.Rset = v2;
        if (pillDrag.ch === 'U') S.Uset = v2;
        updatePills(pillDrag.B);
      }
      pillDrag.p.classList.remove('on');
      pillDrag = null;
    }
    function render() {
      cvx.clearRect(0, 0, W, H);
      // 分数横线 / ½ 的下标横线（墨色线画在 canvas 上，压在 DOM 字形之下）
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.frac && B.st.bar && !B.st.bar.dead) {
          var ob = B.orb, oxB = (ob && ob.k >= 0.02 && ob.gx != null) ? (ob.gx - B.x) : 0;
          var oyB = (ob && ob.k >= 0.02 && ob.gy != null) ? (ob.gy - B.y) : 0;
          var b = B.st.bar, th = B.th || 0, sc = B.sc || 1, ct = Math.cos(th), st = Math.sin(th);
          var s = slot(B, b);
          var hw = (b.w / 2) * sc;
          cvx.strokeStyle = 'rgba(38,34,28,0.85)';
          /* ★ 手写分数：拖动预览命中某一个格时把横线加粗（第二条可见反馈） */
          cvx.lineWidth = (B.div && B.div.hi) ? 2.6 : 1.6;
          cvx.lineCap = 'round';
          cvx.beginPath();
          cvx.moveTo(s.x + oxB - Math.cos(th) * hw, s.y + oyB - Math.sin(th) * hw);
          cvx.lineTo(s.x + oxB + Math.cos(th) * hw, s.y + oyB + Math.sin(th) * hw);
          cvx.stroke();
          if (B.subBar) {
            var sb = B.subBar, shw = (sb.w / 2) * sc;
            var spx = B.x + oxB + (-sb.y * st) * sc, spy = B.y + oyB + (sb.y * ct) * sc;
            cvx.beginPath();
            cvx.moveTo(spx - Math.cos(th) * shw, spy - Math.sin(th) * shw);
            cvx.lineTo(spx + Math.cos(th) * shw, spy + Math.sin(th) * shw);
            cvx.stroke();
          }
        }
      }
      /* ★ 手写分数（÷）的拖动预览：把"要落进去的那一格"用淡墨方块标出来
         （分子/分母 = 横线上下的横条，前方项/后方项 = 两端的竖块） */
      for (var dvq = 0; dvq < bodies.length; dvq++) {
        var DV = bodies[dvq];
        if (!DV.div || !DV.div.on || !DV.div.hi) continue;
        var dr = divBarRect(DV);
        if (!dr) continue;
        var bw = Math.max(18, dr.right - dr.left);
        var bx0, by0, bwid, bhei = 26;
        if (DV.div.hi === 'num') { bx0 = dr.cx - bw / 2; by0 = dr.y - 40; bwid = bw; }
        else if (DV.div.hi === 'den') { bx0 = dr.cx - bw / 2; by0 = dr.y + 14; bwid = bw; }
        else if (DV.div.hi === 'left') { bwid = 34; bhei = 26; bx0 = dr.left - 10 - bwid; by0 = dr.y - bhei / 2; }
        else { bwid = 34; bhei = 26; bx0 = dr.right + 10; by0 = dr.y - bhei / 2; }
        cvx.fillStyle = 'rgba(38,34,28,0.10)';
        cvx.strokeStyle = 'rgba(38,34,28,0.40)';
        cvx.lineWidth = 1.2;
        cvx.beginPath();
        cvx.rect(bx0, by0, bwid, bhei);
        cvx.fill();
        cvx.stroke();
      }
      for (var q = 0; q < bodies.length; q++) {
        var B2 = bodies[q];
        if (B2.orb) orbGeom(B2);
      }
      // 完整的引力井（GMm/r²）：把它的吸引范围用虚线圆画出来
      for (var gv = 0; gv < bodies.length; gv++) {
        var GV = bodies[gv];
        if (GV.kind || !GV.isWell) continue;
        cvx.strokeStyle = 'rgba(120,80,30,0.38)';
        cvx.lineWidth = 1.5;
        cvx.setLineDash([9, 7]);
        cvx.beginPath();
        cvx.arc(GV.x, GV.y, G_RANGE, 0, 6.2832);
        cvx.stroke();
        cvx.setLineDash([]);
      }
      // t-木板（vt→板）：像地面一样细的一条线，但可拖可转
      for (var tr = 0; tr < bodies.length; tr++) {
        var TB = bodies[tr];
        if (TB.kind !== 'T') continue;
        var tht = TB.th || 0, cth = Math.cos(tht), sth = Math.sin(tht), hl = TB.len / 2;
        var x1 = TB.x - cth * hl, y1 = TB.y - sth * hl, x2 = TB.x + cth * hl, y2 = TB.y + sth * hl;
        cvx.strokeStyle = 'rgba(38,34,28,0.85)';
        cvx.lineWidth = 3;
        cvx.lineCap = 'round';
        cvx.beginPath(); cvx.moveTo(x1, y1); cvx.lineTo(x2, y2); cvx.stroke();
      }
      // 磁场：点阵圆盘；电场：方形 + 长箭头
      for (var fb = 0; fb < bodies.length; fb++) {
        var FB = bodies[fb];
        if (FB.kind === 'B') drawFieldDots(FB.x, FB.y, FB.fieldR);
        else if (FB.kind === 'E') drawFieldE(FB.x, FB.y, FB.fieldR, FB.th || 0);
      }
      // I 在 B 场里的安培力方向箭头
      for (var qo = 0; qo < bodies.length; qo++) {
        var OB = bodies[qo];
        if (OB.kind === 'I') {
          var s2 = null, bd2 = 1e9;
          for (var ss = 0; ss < bodies.length; ss++) {
            var S3 = bodies[ss];
            if (S3.kind !== 'B') continue;
            var d2 = Math.hypot(OB.x - S3.x, OB.y - S3.y);
            if (d2 <= S3.fieldR && d2 < bd2) { bd2 = d2; s2 = S3; }
          }
          if (s2) {
            var fy2 = (s2.Bz > 0 ? 1 : -1) * OB.Isign;
            arrow(OB, OB.x, OB.y, OB.x, OB.y + fy2 * 36, 0.6);
          }
        }
      }
      for (var fi = 0; fi < formulas.length; fi++) {
        var F2 = formulas[fi];
        if (!F2.bar) continue;
        var fsc = F2.sc || 1;
        cvx.strokeStyle = 'rgba(38,34,28,' + (0.85 * F2.alpha) + ')';
        cvx.lineWidth = 1.8;
        cvx.lineCap = 'round';
        cvx.beginPath();
        cvx.moveTo(F2.x + F2.bar.x1 * fsc, F2.y + F2.bar.y * fsc);
        cvx.lineTo(F2.x + F2.bar.x2 * fsc, F2.y + F2.bar.y * fsc);
        cvx.stroke();
      }
      for (var bhv = 0; bhv < bodies.length; bhv++) {
        var HB = bodies[bhv];
        if (HB.bh) drawBlackHole(HB);
      }
      /* 公式卡画在最后（压在分数横线/场之上，但不遮 DOM 字形 —— 卡片在体下方）。
         正在被拖动的体不画卡（拖起来清爽些）。 */
      for (var eqv = 0; eqv < bodies.length; eqv++) {
        var EB = bodies[eqv];
        if (!EB.eqText || EB.bh) continue;
        if (grab.kind === 'body' && grab.obj === EB) continue;
        drawEquationCard(EB);
      }
      drawRays();
      drawTempTexts();
      drawParticles();
    }
    function drawBlackHole(B) {
      var bh = B.bh, cx = B.x, cy = B.y;
      var r = Math.max(4, bh.r);
      // 1) 引力透镜：视界外一圈圈被弯折的同心环
      var rings = 5;
      for (var li = 0; li < rings; li++) {
        var lr = r * 1.15 + li * 13 + Math.sin(bh.spin * 1.4 + li * 1.9) * 3;
        var wob = 1 + 0.10 * Math.sin(bh.spin * 2.1 + li * 2.4);
        cvx.strokeStyle = 'rgba(38,34,28,' + (0.30 - li * 0.045) + ')';
        cvx.lineWidth = 1.6 - li * 0.18;
        cvx.beginPath();
        var N = 26;
        for (var n = 0; n <= N; n++) {
          var a = n / N * 6.2832;
          var rr = lr * (wob + (0.05 * Math.sin(3 * a + bh.spin * 1.7)) * li * 0.4);
          var xx = cx + Math.cos(a) * rr;
          var yy = cy + Math.sin(a) * rr * (0.92 + 0.06 * Math.sin(2 * a + bh.spin));
          if (n === 0) cvx.moveTo(xx, yy); else cvx.lineTo(xx, yy);
        }
        cvx.stroke();
      }
      // 透镜拖纹：沿切向抹开的短弧
      cvx.strokeStyle = 'rgba(38,34,28,0.22)';
      cvx.lineWidth = 1.2;
      for (var s2 = 0; s2 < 8; s2++) {
        var sa = bh.spin * 0.9 + s2 * 0.7854;
        var sr = r * 1.3 + (s2 % 3) * 10;
        cvx.beginPath();
        cvx.arc(cx, cy, sr, sa, sa + 0.9);
        cvx.stroke();
      }
      // 2) 吸积盘：单色（墨色）旋纹。这张画布上一切都是墨线，没有颜色。
      for (var ai = 0; ai < 3; ai++) {
        var ar = r + 4 + ai * 4;
        cvx.strokeStyle = 'rgba(38,34,28,' + (0.55 - ai * 0.13) + ')';
        cvx.lineWidth = 3.4 - ai * 0.9;
        cvx.beginPath();
        cvx.arc(cx, cy, ar, bh.spin * 2 + ai * 0.5, bh.spin * 2 + ai * 0.5 + 4.6 - ai * 1.1);
        cvx.stroke();
      }
      // 3) 洞本身：纯黑核心 + 柔和暗边
      var grd = cvx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.05);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.78, 'rgba(12,10,14,0.96)');
      grd.addColorStop(1, 'rgba(20,18,22,0)');
      cvx.fillStyle = grd;
      cvx.beginPath();
      cvx.arc(cx, cy, r * 1.05, 0, 6.2832);
      cvx.fill();
      cvx.strokeStyle = 'rgba(38,34,28,0.75)';
      cvx.lineWidth = 1.4;
      cvx.beginPath();
      cvx.arc(cx, cy, r + 1, 0, 6.2832);
      cvx.stroke();
    }
    function syncGlyphs() {
      var i, j, k;
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        var bar = B.st.bar;
        if (bar && !bar.dead) bar.el.style.display = 'none';   // 分数线由 canvas 画
        var extra = (B.pop && B.pop > 0) ? popScale(B.pop) : 1;
        var sc2 = extra * (B.sc || 1) * (B.infl || 1);
        var th2 = (B.th || 0) + (B.wob || 0);
        var ox = 0, oy = 0;
        if (B.orb && B.orb.k >= 0.02 && B.orb.gx != null) { ox = B.orb.gx - B.x; oy = B.orb.gy - B.y; }
        for (j = 0; j < B.glyphs.length; j++) {
          var g2 = B.glyphs[j];
          if (g2.dead || g2.type === BAR) continue;
          var s2 = slot(B, g2);
          place(g2, s2.x + ox, s2.y + oy, th2, sc2, true);
          /* = 变换后"另一侧"的字形淡出（g2.fade，旧版黑洞口淡出同一条通道） */
          g2.el.style.opacity = (B.bh && B.bh.fade != null) ? B.bh.fade :
                                (B.bhFade != null ? B.bhFade : (g2.fade != null ? g2.fade : ''));
        }
        /* 参数药丸（公式卡读数）：公式体跟着体走；公式散了就收掉 */
        if (B.eq && !B.kind) {
          if (!B._pills) buildPills(B);
          updatePills(B);
        } else if (B._pills && B._pills.length) {
          destroyPills(B);
        }
      }
      for (k = 0; k < freeL.length; k++) {
        var d = freeL[k];
        if (d.dead) { freeL.splice(k, 1); k--; continue; }
        if (d.state === 'free') placeLetter(d);
      }
    }
    /* cursorTick：只在光标**真的变了**的时候写 style.cursor（2026-09-30 流畅度修复）。
       原来每帧无条件写一次 cv.style.cursor，即使值没变也会让浏览器标记该元素样式脏。 */
    var lastCursor = null;
    function cursorTick() {
      var want;
      if (grab.kind === 'body') want = 'grabbing';
      else if (grab.kind === 'letter') want = findMergeTarget(grab.obj) ? 'copy' : 'grabbing';
      else if (grab.kind === 'rot' || grab.kind === 'rotLetter') want = 'grabbing';
      else want = 'default';
      if (want !== lastCursor) { cv.style.cursor = want; lastCursor = want; }
    }

    /* ---------------- 引力（含双星）与场力 ---------------- */
    function stepGravity(dt) {
      var gravs = [];
      for (var g = 0; g < bodies.length; g++) { var Gb = bodies[g]; if (Gb.isWell) gravs.push(Gb); }
      // 注意：没有引力井也**不能**提前返回 —— 双星（两个 mv²/r 整块）必须能自己成对
      function releaseGo(Bb) {
        var go = Bb.go; if (!go) return;
        if (go.bin && go.by && bodies.indexOf(go.by) >= 0) { go.by.goB = null; }
        var tx = -Math.sin(go.ang), ty = Math.cos(go.ang);
        Bb.vx = tx * go.w * go.rad; Bb.vy = ty * go.w * go.rad;
        Bb.go = null;
      }
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.eq) continue;      // ★ 双轨：公式体不被引力井吸引
        if (B.kind) continue;
        if (B.bh) continue;      // 黑洞不绕任何东西
        if (B.isWell) continue;
        if (grab.kind === 'body' && grab.obj === B) continue;
        if (B.goB) {
          if (bodies.indexOf(B.goB) < 0) B.goB = null;   // 伴星由持有者统一积分
          continue;
        }
        var best = null, bd = 1e9, bcx = 0, bcy = 0;
        for (var k = 0; k < gravs.length; k++) {
          var Gb2 = gravs[k];
          var dx = B.x - Gb2.x, dy = B.y - Gb2.y;
          var d = Math.hypot(dx, dy);
          if (d < bd) { bd = d; best = Gb2; bcx = Gb2.x; bcy = Gb2.y; }
        }
        var isRot = (B.hasV && B.hasR && B.vCount >= 2);
        // 完整的引力井（GMm/r²）**支配**它范围内的一切：mv²/r 整块和别的体一样被吸引 ——
        // 在井的作用范围里没有"固定圆轨道"，也不会被双星抢走。只要没有井在拉它们，
        // 两个 mv²/r 整块之间仍然可以结成双星。
        var wellHolds = !!(best && bd <= G_RANGE && !(grab.kind === 'body' && grab.obj === best));
        if (isRot && !wellHolds) {
          // 双星配对：两个完整的 mv²/r 整块绕**共同质心**转。m₁·r₁ = m₂·r₂（轻的走大圈），
          // ω ∝ √(m总/间距) —— 不同的 M/m 配比会明显改变运动。
          var P2 = null, pp = 1e9;
          if (B.go && B.go.bin) {
            var oldP = B.go.by;
            if (bodies.indexOf(oldP) >= 0) { P2 = oldP; pp = Math.hypot(P2.x - B.x, P2.y - B.y); }
            else B.go = null;
          }
          if (!P2) {
            for (var pk = 0; pk < bodies.length; pk++) {
              var C = bodies[pk];
              if (C === B) continue;
              if (!(C.hasV && C.hasR && C.vCount >= 2)) continue;
              if (C.go && C.go.bin) continue;
              if (C.goB && C.goB !== B) continue;
              if (grab.kind === 'body' && grab.obj === C) continue;
              var dp = Math.hypot(C.x - B.x, C.y - B.y);
              if (dp < pp) { pp = dp; P2 = C; }
            }
          }
          if (P2 && pp <= G_RANGE) {
            var m1 = B.mass || 1, m2 = P2.mass || 1, ms = m1 + m2;
            if (!B.go || B.go.by !== P2) {
              var cmx = (m1 * B.x + m2 * P2.x) / ms, cmy = (m1 * B.y + m2 * P2.y) / ms;
              B.go = { by: P2, cmx: cmx, cmy: cmy, ang: Math.atan2(B.y - cmy, B.x - cmx),
                       rad: Math.max(pp, 10), target: clamp(pp, 80, 300),
                       rB: m2 / ms, rP: m1 / ms,
                       w: 1.1 * Math.sqrt(ms / Math.max(pp, 40)), bin: 1 };
              P2.goB = B;
            }
            if (grab.kind === 'body' && grab.obj === P2) {
              // 抓住同伴 -> 解散这一对，B 被**切向释放**
              var gX = B.go, txd = -Math.sin(gX.ang), tyd = Math.cos(gX.ang);
              B.vx = txd * gX.w * (gX.rad * gX.rB); B.vy = tyd * gX.w * (gX.rad * gX.rB);
              P2.goB = null; B.go = null;
            } else {
              var go = B.go;
              go.rad += (go.target - go.rad) * Math.min(1, dt * 0.9);
              go.ang += dt * go.w;
              var cA = Math.cos(go.ang), sA = Math.sin(go.ang);
              var rB = go.rad * go.rB, rP = go.rad * go.rP;
              var bx = go.cmx + rB * cA, by = go.cmy + rB * sA;
              var px = go.cmx - rP * cA, py = go.cmy - rP * sA;
              // 整对留在台面内：**平移**整对（间距不变），绝不拉伸 —— 谁都不许飞出边界
              var shx = 0, shy = 0;
              if (bx > W - B.hw) shx = W - bx - B.hw; else if (bx < B.hw) shx = B.hw - bx;
              if (by > groundY - B.hh) shy = groundY - by - B.hh; else if (by < B.hh) shy = B.hh - by;
              if (px > W - P2.hw) shx = W - px - P2.hw; else if (px < P2.hw) shx = P2.hw - px;
              if (py > groundY - P2.hh) shy = groundY - py - P2.hh; else if (py < P2.hh) shy = P2.hh - py;
              if (shx || shy) { go.cmx += shx; go.cmy += shy; bx += shx; by += shy; px += shx; py += shy; }
              B.x = bx; B.y = by; B.vx = 0; B.vy = 0;
              P2.x = px; P2.y = py;
              P2.vx = -go.w * rP * sA; P2.vy = go.w * rP * cA;
              continue;
            }
          }
          if (B.go) releaseGo(B);
        } else {
          if (B.go) releaseGo(B);
        }
        if (!best || bd > G_RANGE) continue;
        // ---- 简单吸引（对裸 m、mv²、mv²/r … 完全一样）----
        var inv = 1 / Math.max(bd, 24);        // 软化：太近也不爆炸
        var ax = (bcx - B.x) * inv, ay = (bcy - B.y) * inv;
        var a = G_PULL / (bd + 80);
        B.vx += ax * a * dt; B.vy += ay * a * dt;
      }
    }

    function stepField(dt) {
      var bsrcs = [], esrcs = [];
      for (var i = 0; i < bodies.length; i++) { var S = bodies[i]; if (S.kind === 'B') bsrcs.push(S); else if (S.kind === 'E') esrcs.push(S); }
      var kb;
      if (!bsrcs.length && !esrcs.length) {
        for (kb = 0; kb < bodies.length; kb++) {
          var Kb = bodies[kb];
          if (Kb.kind === 'B' || Kb.kind === 'E' || Kb.kind === 'T') continue;
          if (grab.kind === 'body' && grab.obj === Kb) continue;
          if (Kb.kind === 'q' || Kb.kind === 'I') {
            if (Kb.x < 24) { Kb.x = 24; Kb.vx = Math.abs(Kb.vx) * 0.5; }
            if (Kb.x > W - 24) { Kb.x = W - 24; Kb.vx = -Math.abs(Kb.vx) * 0.5; }
            if (Kb.y < 24) { Kb.y = 24; Kb.vy = Math.abs(Kb.vy) * 0.5; }
            if (Kb.y > groundY - 24) { Kb.y = groundY - 24; Kb.vy = -Math.abs(Kb.vy) * 0.5; }
          }
        }
        return;
      }
      for (var j = 0; j < bodies.length; j++) {
        var O = bodies[j];
        if (O.eq) continue;      // ★ 双轨：公式体不受 B/E 场力
        if (O.kind === 'B' || O.kind === 'E') continue;   // 场源感觉不到自己的场
        if (O.bh) continue;
        if (grab.kind === 'body' && grab.obj === O) continue;
        var src = null, bd = 1e9;
        for (var s = 0; s < bsrcs.length; s++) {
          var S2 = bsrcs[s];
          var d = Math.hypot(O.x - S2.x, O.y - S2.y);
          if (d <= S2.fieldR && d < bd) { bd = d; src = S2; }
        }
        var esrc = null, ed = 1e9;
        for (var se = 0; se < esrcs.length; se++) {
          var SE = esrcs[se], hsE = SE.fieldR / 2;
          if (Math.abs(O.x - SE.x) <= hsE && Math.abs(O.y - SE.y) <= hsE) {   // E 场是方形
            var de = Math.abs(O.x - SE.x) + Math.abs(O.y - SE.y);
            if (de < ed) { ed = de; esrc = SE; }
          }
        }
        var dir = src ? (src.Bz > 0 ? 1 : -1) : 1;
        if (O.kind === 'q') {
          // B 场里的洛伦兹力 F = q(v×B)：永远垂直于速度 -> 速率不变、轨迹转弯
          if (src) {
            var qc = O.qsign * dir;
            var th = -qc * Q_FORCE * dt;
            var cs = Math.cos(th), sn = Math.sin(th);
            var nvx = cs * O.vx - sn * O.vy;
            var nvy = sn * O.vx + cs * O.vy;
            O.vx = nvx; O.vy = nvy;
          }
          // E 场里的电场力 F = qE，沿场方向 (esrc.th) —— 让 q 加速
          if (esrc) {
            var eth = esrc.th || 0, ea = E_FIELD_ACC * O.qsign * dt;
            O.vx += Math.cos(eth) * ea;
            O.vy += Math.sin(eth) * ea;
          }
          O.fieldState = src ? { active: true } : null;
        } else if (O.kind === 'I') {
          if (src) {
            var fy = A_FORCE * O.Isign * dir;
            O.vy += fy * dt;
            var dmp = Math.pow(0.94, dt * 60);
            O.vx *= dmp; O.vy *= dmp;
          }
        }
      }
      for (kb = 0; kb < bodies.length; kb++) {
        var K = bodies[kb];
        if (K.kind === 'B' || K.kind === 'E' || K.kind === 'T') continue;
        if (K.bh) continue;
        if (K.x < 24) { K.x = 24; K.vx = Math.abs(K.vx) * 0.5; }
        if (K.x > W - 24) { K.x = W - 24; K.vx = -Math.abs(K.vx) * 0.5; }
        if (K.y < 24) { K.y = 24; K.vy = Math.abs(K.vy) * 0.5; }
        if (K.y > groundY - 24) { K.y = groundY - 24; K.vy = -Math.abs(K.vy) * 0.5; }
      }
    }

    /* ---------------- 箭头 →（2026-09-30 移植清单 P2-10）----------------
       箭头是台上**独立可旋转**的字形（不并入任何体）：沿朝向射一条可见射线，
       打中目标升温；左侧有 Q 时按 Q=cmΔt（c=4200，约定值）换算温度；
       F → a=F/m、U → I=U/R、I → Q=I²Rt 照课本做，不确定的不做。 */
    /* rayHit(A, em)：沿箭头朝向找**最近的被命中物**。
       em = 箭头这次链接的公式体（emitterOf 的结果，可为 null）—— **必须排除**：
       箭头就摆在它的输出源旁边，不排除的话射线会打到"自己的电源"上，于是无论在
       多远放目标都判成 d≈0、击穿恒成立（实测：负对照 130px 也照样 1 条 breakdown）。
       tEdge（到目标**表面**的距离）用于挑最近目标 + 画射线终点（2026-10-01 父补丁）：
       原来只按中心距挑，大物体明明挡在跟前却输给中心更近的小物体。 */
    function rayHit(A, em) {
      var ox = A.wx, oy = A.wy;
      var dx = Math.cos(A.rot || 0), dy = -Math.sin(A.rot || 0);
      var best = null;
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.bh || B === em) continue;
        var t = (B.x - ox) * dx + (B.y - oy) * dy;
        if (t < 8 || t > 640) continue;
        var perp = Math.abs((B.x - ox) * dy - (B.y - oy) * dx);
        if (perp > Math.max(B.hw, B.hh) + 10) continue;
        var tEdge = Math.max(1, t - (Math.abs(dx) * B.hw + Math.abs(dy) * B.hh));
        if (!best || tEdge < best.t) best = { t: tEdge, tCen: t, body: B, x: ox + dx * t, y: oy + dy * t };
      }
      for (var j = 0; j < freeL.length; j++) {
        var O = freeL[j];
        if (O === A || O.dead || O.arrow) continue;
        var t2 = (O.wx - ox) * dx + (O.wy - oy) * dy;
        if (t2 < 8 || t2 > 640) continue;
        var p2 = Math.abs((O.wx - ox) * dy - (O.wy - oy) * dx);
        if (p2 > 24) continue;
        var t2Edge = Math.max(1, t2 - 12);            // 半个字形 ≈12px
        if (!best || t2Edge < best.t) best = { t: t2Edge, tCen: t2, letter: O, x: ox + dx * t2, y: oy + dy * t2 };
      }
      return best;
    }
    /* 体/附近游离字形里有没有某个量（数值取该量的默认值，可由药丸/eqSet 改） */
    function nearVal(A, sym) {
      for (var i = 0; i < freeL.length; i++) {
        var L2 = freeL[i];
        if (L2 === A || L2.dead) continue;
        if (L2.ch !== sym) continue;
        if (Math.hypot(L2.wx - A.wx, L2.wy - A.wy) < 220) return (VAL_DEF[sym] ? VAL_DEF[sym].val : 1);
      }
      return null;
    }
    /* 空气击穿场强（高中物理教材级常量，2026-10-01）：约 3×10⁶ V/m。
       玩具比例尺：1 屏幕像素 = 1 μm（非真实尺寸，注释明示）—— 这样 U=60V、
       间隙 20px 时 E = 60/(20×10⁻⁶) = 3×10⁶ V/m 正好击穿，游戏窗口可玩；
       U = Ed 的关系与阈值数值按课本写死，不自造。 */
    var E_BREAK_AIR = 3e6;
    /* 两电极之间的**支持半径**（AABB 在单位方向 u 上的支撑函数）：
       盒子在 u 方向的"半径" = |ux|·hw + |uy|·hh —— 轴对齐盒子下这是精确值。 */
    function supportR(B, ux, uy) {
      if (!B) return 12;                       // 游离字形：半个字形
      return Math.abs(ux) * (B.hw || 12) + Math.abs(uy) * (B.hh || 12);
    }
    /* d = **两个电极之间的空气间隙**（px）= 源公式体表面 ↔ 被击中目标表面。
       2026-10-01 修正（第三批验收实测）：
         ① 原来 d 取"箭头到目标中心的距离" —— 两个体明明贴在一起（边到边 0px）
            读数仍有 ~140px，E=U/d 永远偏小、击穿永不成立（U 拉满 60V 也不行）；
         ② 父补丁改成"箭头到目标表面"后**仍不够**：箭头通常摆在源体的中间/边缘，
            到目标的距离里还含着源体自己的半个宽度（实测源体 hw≈57.6px，占了
            "20px 间隙"的 3 倍），而且射线会先打中源体自己（d=1 → 击穿恒成立，
            负对照 130px 也照样触发）。
       现在按物理定义取**电极间距**（源体 ↔ 目标体），1px = 1μm 的比例尺才成立。 */
    function arrowBreakdown(A, hit, uv, em) {
      var tx = hit.body ? hit.body.x : (hit.letter ? hit.letter.wx : A.wx);
      var ty = hit.body ? hit.body.y : (hit.letter ? hit.letter.wy : A.wy);
      var ex = em ? em.x : A.wx, ey = em ? em.y : A.wy;
      var cdx = tx - ex, cdy = ty - ey;
      var dCen = Math.hypot(cdx, cdy);
      var ux = (dCen > 1e-6) ? cdx / dCen : 1, uy = (dCen > 1e-6) ? cdy / dCen : 0;
      var dGap = Math.max(1, dCen - supportR(em, ux, uy) - supportR(hit.body, ux, uy));
      var dM = dGap * 1e-6;                        // 玩具比例尺：1px = 1μm
      var EField = uv / dM;                        // U = Ed → E = U/d
      var state = (hit.body ? hit.body : hit.letter);
      if (!state) return;
      if (EField >= E_BREAK_AIR && !state._bd) {
        state._bd = true;
        eqEmit('breakdown', hit.body, { U: uv, d: dGap, dM: +dM.toExponential(1), E: +EField.toExponential(2) });
        opLog('breakdown', { U: uv, d: dGap, E: +EField.toExponential(2) });   // 操作日志（2026-10-01）
        A.spark = 0.4; A.sparkX = hit.x; A.sparkY = hit.y;
        burstParticles(hit.x, hit.y, 10, 0.6);
        shake(2, 0.08);
      } else if (EField < E_BREAK_AIR * 0.8 && state._bd) {
        state._bd = false;                        // 间隙拉长/电压降低后重新武装
      }
    }
    /* 箭头 = 输出算子（emitter，2026-10-01 用户澄清："箭头只是输出后面链接着的公式，
       根据公式下方的数值输出"）。升温只是热量类公式的输出之一，不是箭头本身的含义。
       输出对照表（每条公式 → 输出；想不出物理上正确输出的不做并注明）：
         Q=cmΔT → 热量（命中物体升温）；Q=λm → 潜热（相变）；Q=I²Rt → 发热；
         v=λf → 光波（可见波）；ε=hν → 光/光子；E=hν−W → 光电子逸出（E≥0 才逸出）；
         U=IR → 电流；P=UI → 功率/发热；U=Ed → 电场 → E ≥ 3×10⁶ V/m 击穿空气（输出条件）；
         F=ma → 力（推动）；F=BIL / F=qvB → 安培力/洛伦兹力；Φ=BS / E=ΔΦ/Δt → 感应电流。
         未做：其余公式想不出物理上正确的"输出"（如 p=mv、η、Δx 等）——照实不输出。 */
    function emitterOf(A) {
      var best = null, bd = 220;
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (!B.eq || B.kind || B.bh) continue;
        var d = Math.hypot(B.x - A.wx, B.y - A.wy);
        if (d < bd) { bd = d; best = B; }
      }
      return best;
    }
    function applyRayEffect(A, hit, dt, em) {
      var vx = Math.cos(A.rot || 0), vy = -Math.sin(A.rot || 0);
      A.rayLife = 0.35; A.rayX = hit.x; A.rayY = hit.y;
      var B = hit.body;
      var L = hit.letter;
      if (em === undefined) em = emitterOf(A);   // 链接的公式体（没有公式 = 只有射线，无输出）
      if (em && !em.eqState) eqInitState(em);
      var ES = em ? em.eqState : null;
      var tgtTemp = function () {
        if (B) { if (B.temp == null) B.temp = 20; return B; }
        if (L) { if (L.temp == null) L.temp = 20; return L; }
        return null;
      };
      var massOf = function (t) { return Math.max(0.05, (t && t.mass) || 1); };
      var cOf = function (t) { return numOfGlyph(t, 'c\u6bd4'); };
      /* 玩具时间尺度：热量输出 1 模拟秒 = 公式数值的 1000 倍热作用（注释明示），
         事件里的 Q、c、m、dT 仍按 Q=cmΔT 逐字一致。 */
      var HEAT_K = 1000;
      var out = em ? em.eq : null;
      if (!out) return;              // 无链接公式：只画射线，不产生效果
      if (out === 'heatmass') {
        var hq = ES.Q, hc = ES.c || 4200, hm = Math.max(0.01, ES.m || 1);
        var td = tgtTemp(); if (!td) return;
        var dT1 = hq / (hc * hm) * HEAT_K * dt;
        td.temp += dT1;
        if (B && B.eq) eqSet(B, 'T', +B.temp.toFixed(4));
        if (!A._hmT || tWorld - A._hmT > 0.3) {
          A._hmT = tWorld;
          eqEmit('heat', B, { temp: Math.round(td.temp * 10) / 10, Q: hq, c: hc, m: hm, dT: hq / (hc * hm), by: 'emit' });
          opLog('heat', { target: B ? (B.eq || B.kind || 'body') : L.ch, temp: Math.round(td.temp * 10) / 10 });
        }
      } else if (out === 'melt') {
        var lq = ES.Q, ll = ES.lam || 334000, lm = Math.max(0.01, ES.m || 1);
        var td2 = tgtTemp(); if (!td2) return;
        td2._meltAcc = (td2._meltAcc || 0) + lq * HEAT_K * dt;
        if (td2._meltAcc >= ll * lm && !td2._melted) {
          td2._melted = true;
          eqEmit('phase-change', B, { phase: 'liquid', Q: lq, need: ll * lm, by: 'emit' });
          opLog('phase-change', { target: B ? (B.eq || B.kind || 'body') : L.ch, phase: 'liquid' });
          burstParticles(hit.x, hit.y, 8, 0.5);
        }
        if (B && B.eq) eqSet(B, 'phase', td2._melted ? '\u6db2' : '\u56fa');
      } else if (out === 'joule') {
        var jI = ES.I, jR = ES.R, td3 = tgtTemp(); if (!td3) return;
        var jq = jI * jI * jR * HEAT_K * dt / 4200;
        td3.temp += jq;
        if (B && B.eq) eqSet(B, 'T', +B.temp.toFixed(4));
        if (!A._jT || tWorld - A._jT > 0.3) { A._jT = tWorld; eqEmit('heat', B, { temp: Math.round(td3.temp * 10) / 10, by: 'joule' }); }
      } else if (out === 'wave') {
        A.waveT = 0.6;
        if (!A._wT || tWorld - A._wT > 0.5) {
          A._wT = tWorld;
          eqEmit('wave', B, { v: ES.v, lam: numOfGlyph(em, LAMBDA), f: numOfGlyph(em, 'f'), by: 'emit' });
          opLog('wave', { lam: numOfGlyph(em, LAMBDA), f: numOfGlyph(em, 'f') });
        }
      } else if (out === 'photon') {
        A.photonT = 0.5;
        if (!A._pT || tWorld - A._pT > 0.2) {
          A._pT = tWorld;
          burstParticles(A.wx + vx * 20, A.wy + vy * 20, 3, 0.8);
        }
        if (!A._pET || tWorld - A._pET > 0.5) {
          A._pET = tWorld;
          eqEmit('photon', B, { eps: ES.eps != null ? ES.eps : numOfGlyph(em, EPS), by: 'emit' });
        }
      } else if (out === 'photoelectric') {
        var canEsc = ES.E >= 0;
        if (canEsc) {
          if (!A._peT || tWorld - A._peT > 0.25) {
            A._peT = tWorld;
            burstParticles(hit.x, hit.y, 6, 0.7);
            eqEmit('photoescape', B, { E: +ES.E.toFixed(3), hnu: +(ES.h * ES.nu).toFixed(3), W: ES.W, by: 'emit' });
            opLog('photoescape', { E: +ES.E.toFixed(3) });
          }
        }
      } else if (out === 'ohm') {
        var oU = ES.U, oR = Math.max(0.05, ES.R);
        if (B && B.eq !== 'ohm') { B.current = oU / oR; B.voltage = oU; }
        if (!A._flT || tWorld - A._flT > 0.15) { A._flT = tWorld; burstParticles(A.wx + vx * 18, A.wy + vy * 18, 2, 0.5); }
        if (!A._oT || tWorld - A._oT > 0.5) { A._oT = tWorld; eqEmit('current', B, { U: oU, I: oU / oR, by: 'emit' }); }
      } else if (out === 'powerE') {
        var pP = ES.P, td4 = tgtTemp(); if (!td4) return;
        td4.temp += pP * HEAT_K * dt / 4200;
        if (B && B.eq) eqSet(B, 'T', +B.temp.toFixed(4));
        if (!A._pwrT || tWorld - A._pwrT > 0.5) { A._pwrT = tWorld; eqEmit('power', B, { P: pP, by: 'emit' }); }
      } else if (out === 'uniform-field') {
        /* 电场输出：达阈值击穿空气（输出条件），短距/高压才放电。
           d 取**源体与目标体之间的空气间隙**（不是箭头到目标的距离）—— 见 arrowBreakdown。 */
        arrowBreakdown(A, hit, ES.U, em);
      } else if (out === 'newton2') {
        if (B && !B.kind) {
          var aa = ES.F / Math.max(1e-6, massOf(B));
          B.vx += vx * aa * 20 * dt; B.vy += vy * aa * 20 * dt;
          B.forcePush = { F: ES.F, m: massOf(B), a: aa };
          if (!A._fT || tWorld - A._fT > 0.5) { A._fT = tWorld; eqEmit('force', B, { F: ES.F, a: +aa.toFixed(3), by: 'emit' }); }
        }
      } else if (out === 'ampere' || out === 'lorentz') {
        var FF = (out === 'ampere') ? (ES.B * ES.I * ES.L) : (ES.q * ES.v * ES.B);
        if (B && !B.kind) {
          var aa2 = FF / Math.max(1e-6, massOf(B));
          B.vx += vx * aa2 * 20 * dt; B.vy += vy * aa2 * 20 * dt;
          B.forcePush = { F: FF, m: massOf(B), a: aa2 };
          if (!A._fT2 || tWorld - A._fT2 > 0.5) { A._fT2 = tWorld; eqEmit('force', B, { F: FF, by: 'emit' }); }
        }
      } else if (out === 'flux' || out === 'faraday') {
        if (B && !B.kind) {
          B.induced = (out === 'flux') ? (ES.phi != null ? ES.phi : numOfGlyph(em, PHI) * numOfGlyph(em, 'S')) : (ES.eps != null ? ES.eps : 0);
          if (!A._indT || tWorld - A._indT > 0.5) { A._indT = tWorld; eqEmit('induction', B, { eps: +B.induced.toFixed(4), by: 'emit' }); }
        }
      }
      /* 其余公式：想不出物理上正确的输出 —— 不输出（见 emitterOf 注释） */
    }
    function stepArrows(dt) {
      var anyArrow = false, i;
      for (i = 0; i < freeL.length; i++) if (freeL[i].arrow && !freeL[i].dead) { anyArrow = true; break; }
      if (!anyArrow) return;
      for (i = 0; i < freeL.length; i++) {
        var A = freeL[i];
        if (!A.arrow || A.dead || A.state === 'grab') continue;
        if (A.rayLife > 0) A.rayLife -= dt;
        if (A.spark > 0) A.spark -= dt;      // 击穿火花淡出（2026-10-01）
        if (A.waveT > 0) A.waveT -= dt;      // 光波输出淡出（2026-10-01）
        if (A.photonT > 0) A.photonT -= dt;  // 光子输出淡出（2026-10-01）
        var emA = emitterOf(A);                       // 本帧只算一次，rayHit 与输出共用
        var hit = rayHit(A, emA);
        if (hit) applyRayEffect(A, hit, dt, emA);
      }
    }
    /* 射线画在 canvas 上（同一套墨线）：从箭头沿朝向打到命中点，随时间淡出；
       击穿时叠加之字火花（2026-10-01，墨色折线 + 既有热粒子） */
    function drawRays() {
      for (var i = 0; i < freeL.length; i++) {
        var A = freeL[i];
        if (!A.arrow || A.dead) continue;
        var a = (A.rayLife > 0) ? Math.min(1, A.rayLife / 0.35) : 0;
        /* 光波输出（v=λf，2026-10-01）：命中点向外扩散的同心波弧（墨线） */
        if (A.waveT > 0 && A.rayX != null) {
          var wkk = Math.min(1, A.waveT / 0.6);
          for (var wi = 0; wi < 3; wi++) {
            var wr = 8 + wi * 14 + (0.6 - A.waveT) * 46;
            cvx.strokeStyle = 'rgba(38,34,28,' + (0.5 * wkk) + ')';
            cvx.lineWidth = 1.6;
            cvx.beginPath();
            cvx.arc(A.rayX, A.rayY, wr, 0, 6.2832);
            cvx.stroke();
          }
        }
        /* 光子输出（ε=hν，2026-10-01）：沿线暖色粒子（既有热粒子通道） */
        if (A.photonT > 0 && A.rayX != null) {
          var pkk = Math.min(1, A.photonT / 0.5);
          cvx.fillStyle = 'rgba(38,34,28,' + (0.4 * pkk) + ')';
          for (var pi = 0; pi < 4; pi++) {
            var ppx = A.wx + Math.cos(A.rot || 0) * (18 + pi * 9), ppy = A.wy - Math.sin(A.rot || 0) * (18 + pi * 9);
            cvx.beginPath(); cvx.arc(ppx, ppy, 1.6, 0, 6.2832); cvx.fill();
          }
        }
        if (A.spark > 0) {
          var kk2 = Math.min(1, A.spark / 0.4);
          var x0 = A.wx + Math.cos(A.rot || 0) * 16, y0 = A.wy - Math.sin(A.rot || 0) * 16;
          var dxs = A.sparkX - x0, dys = A.sparkY - y0;
          var len = Math.max(1, Math.hypot(dxs, dys)), seg = 6;
          cvx.strokeStyle = 'rgba(38,34,28,' + (0.75 * kk2) + ')';
          cvx.lineWidth = 1.5;
          cvx.beginPath();
          cvx.moveTo(x0, y0);
          for (var si = 1; si <= seg; si++) {
            var perp = (si % 2 === 0) ? 1 : -1;
            var ox2 = -dys / len * 5 * perp, oy2 = dxs / len * 5 * perp;
            cvx.lineTo(x0 + dxs * si / seg + ox2, y0 + dys * si / seg + oy2);
          }
          cvx.stroke();
        }
        if (!(A.rayLife > 0)) continue;
        var ox = A.wx + Math.cos(A.rot || 0) * 16, oy = A.wy - Math.sin(A.rot || 0) * 16;
        cvx.strokeStyle = 'rgba(38,34,28,' + (0.5 * a) + ')';
        cvx.lineWidth = 2;
        cvx.lineCap = 'round';
        cvx.beginPath();
        cvx.moveTo(ox, oy);
        cvx.lineTo(A.rayX, A.rayY);
        cvx.stroke();
        cvx.fillStyle = 'rgba(38,34,28,' + (0.6 * a) + ')';
        cvx.beginPath();
        cvx.arc(A.rayX, A.rayY, 3, 0, 6.2832);
        cvx.fill();
      }
    }
    /* 升温读数：游离字形画在字形下方、体画在体下方（同一套墨线小字） */
    function drawTempTexts() {
      var fs = 'italic ' + Math.max(10, F * 0.30) + 'px Georgia,"Times New Roman",serif';
      if (cvx.font !== fs) cvx.font = fs;
      cvx.textAlign = 'center';
      cvx.textBaseline = 'top';
      cvx.fillStyle = 'rgba(38,34,28,0.72)';
      var i;
      for (i = 0; i < freeL.length; i++) {
        var L = freeL[i];
        if (!L || L.dead) continue;
        if (L.temp == null || L.temp <= 20.05) continue;
        cvx.fillText('T = ' + L.temp.toFixed(1) + ' \u00B0C', L.wx, L.wy + 14);
      }
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (!B || B.temp == null || B.temp <= 20.05) continue;
        if (B.eqText) continue;   // 公式体走公式卡/药丸上的 T 读数
        cvx.fillText('T = ' + B.temp.toFixed(1) + ' \u00B0C', B.x, B.y + (B.hh || 16) + 8);
      }
    }

    /* ---------------- 尺寸 / 主循环 ---------------- */
    function resize() {
      W = Math.max(200, table.clientWidth | 0);
      H = Math.max(160, table.clientHeight | 0);
      groundY = Math.round(H * 0.8);
      /* 跨过 768px 断点时托盘列数会变（9 ↔ 8），钉位要按新列数重排 */
      sortPanel();
      placeAchv();   // 成就面板位置跟着舞台左缘走（2026-10-01）
      // 全屏作用半径：黑洞的拉力在舞台对角线处恰好为 0，越靠里越强
      BH_REACH = Math.hypot(W, groundY) + 240;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cvx.setTransform(dpr, 0, 0, dpr, 0, 0);
      invalidateTableOrigin();   // 台面尺寸变了 -> 缓存的舞台原点作废
      // 台面尺寸变了，把所有实体拉回台面内，避免丢在外面看不见
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (B.kind === 'B' || B.kind === 'E') continue;
        B.x = clamp(B.x, 24, Math.max(30, W - 24));
        B.y = clamp(B.y, 24, Math.max(30, groundY - 24));
      }
      for (var k = 0; k < freeL.length; k++) {
        freeL[k].wx = clamp(freeL[k].wx, 20, Math.max(30, W - 20));
        freeL[k].wy = clamp(freeL[k].wy, 20, Math.max(30, groundY - 8));
      }
    }

    var rafId = 0, lastT = 0, running = true, alive = true;
    /* frame()：自动推进循环。
       ★ 必须真的检查 running（2026-09-30 修复）：原来 pause() 只把 running 置 false，
       而这里从不读它 —— 于是 pause() 返回 true 但画面照跑（空实现）。
       暂停时**仍然请求下一帧**（只是不推进），这样 resume() 之后能立刻续上，
       而且 lastT 不会被暂停期间的时间差污染（恢复了也不会"跳一大步"）。
       stepOnce() 走的是 stepFrame()，**不受 running 影响** —— 它是显式的手动单步，
       探针的确定性断言全靠它。 */
    function frame(now) {
      if (!alive) return;
      rafId = requestAnimationFrame(frame);
      if (!running) { lastT = now; return; }
      if (!lastT) lastT = now;
      var dt = Math.min(0.033, Math.max(0.008, (now - lastT) / 1000));
      lastT = now;
      stepFrame(dt);
    }
    /* 一帧的完整推进（rAF 与 stepOnce 共用同一条路径，所以探针推的帧
       和真跑的一帧完全一样） */
    function stepFrame(dt) {
      /* ★ 舞台原点必须在**任何样式写入之前**取一次（2026-09-30 流畅度修复）：
         此刻布局是干净的，这一次 getBoundingClientRect 不会触发强制同步布局；
         接下来这一帧里所有 worldRect()/xy() 都复用这个读数。
         放在 stepFrame 里（而不是 frame 里）是为了让 stepOnce 也走同一条路径。 */
      invalidateTableOrigin();
      tableOrigin();
      tWorld += dt;
      /* ============================ 双轨分界 ============================
         ★ 这是**两套物理的唯一分界点**（2026-09-30 第三段：事件与相互作用）。
         为什么要有这条分界：老 15 个符号 + 五个预设 + 既有 stepPhysics 积分是
         **已经发布出去的行为**，背后还压着两条永久确定性断言（自由落体
         y 100→122.35653620491976、引力井距 240.0500034375976→182.10799887040633）
         与排版 hw/hh；而"事件"要求公式体做真动力学（碰撞守恒、弹簧振子、
         欧姆回路…），两者塞进同一条积分路径必然互相改动数值。

         所以：
           · 老路径（下面的 stepPhysics / collideBodies / stepGravity / stepField /
             tickOrbs / …）**一行未动**，只服务"eq 为空"的实体；
           · 新路径（stepEqPhysics）只服务**公式体**（B.eq 非空），走固定步长 +
             累加器，完全独立；
           · 两条路径**互不施力**：stepEqPhysics 里跳过所有非公式体，
             下面的老函数里也跳过所有公式体（各处加 `if (B.eq) continue;`）。
         判据（探针会断言）：把一台沙盒里的 B.eq 全部清空后推进 N 帧，
         结果必须与"从来就没有过公式体"的沙盒逐位一致。
         ================================================================ */
      stepPhysics(dt);          // 老路径（内部已跳过公式体）
      collideBodies();          // 老路径（内部已跳过公式体）
      eqAccumulate(dt);         // 新路径：固定步长累加器，只推公式体
      stepGravity(dt);          // 老路径（内部已跳过公式体）
      stepField(dt);            // 老路径（内部已跳过公式体）
      stepArrows(dt);           // 箭头射线（老路径：只作用于台上的箭头字形与目标）
      tickOrbs(dt);
      stepExplode(dt);
      stepBlackHole(dt);
      stepFinale(dt);
      stepFormulas(dt);
      stepParticles(dt);
      stepShake(dt);
      refreshHover();
      render();
      syncGlyphs();
      cursorTick();
    }

    /* ---------------- 测试 / 集成接口用到的快照 ---------------- */
    var KIND_NAME = { 'T': 'plank', 'B': 'Bfield', 'E': 'Efield', 'q': 'charge', 'I': 'current' };

    /* 公式体动力学（双轨的**新路径**）                                       *
     *  只服务 eq 非空的实体；老实体一律不碰（反过来老函数也跳过公式体）。      *
     * ==================================================================== */
    var EQ_DT = 1 / 120;          // 固定步长（s）。1/120 让弹簧/碰撞有足够分辨率
    var eqAcc = 0;                // 固定步长累加器（帧率无关）
    var eqTime = 0;               // 公式体的仿真时钟（与 tWorld 分开，便于断言）
    var eqStepNo = 0;             // 子步序号（碰撞冷却：同一子步内一对体只判一次）
    var EQ_EVENTS = [];           // 事件环形缓冲（探针可读；只保留最近 64 条）
    var eqEventSeq = 0;
    /* ---- 成就面板（2026-10-01 新功能）：把触发过的事件挂成小徽章，同类计数。
       挂在观澜左侧 AI 对话区顶部（.ps-overlay 负 left 伸出舞台左边）；只在沙盒
       挂载时存在（unmount 连 overlay 一起拆干净）。 ---- */
    var ACHV_NAMES = {
      'formula': '\u6210\u5f0f', 'short-circuit': '\u77ed\u8def', 'open-circuit': '\u65ad\u8def',
      'collide': '\u78b0\u649e\u00b7\u03a3p \u5b88\u6052', 'spring-turn': '\u7b80\u8c10',
      'induced-emf': '\u611f\u5e94', 'binary': '\u53cc\u661f', 'cap-charged': '\u5145\u6ee1',
      'transform': '\u53d8\u6362', 'heat': '\u5347\u6e29', 'heat-caloric': '\u5347\u6e29', 'combo': '\u62fc\u5408',
      'breakdown': '\u51fb\u7a7f', 'phase-change': '\u76f8\u53d8', 'thermal-balance': '\u70ed\u5e73\u8861',
      'gas': '\u6c14\u6001', 'photoescape': '\u9038\u51fa', 'buoy': '\u6d6e\u6c89',
      'impulse': '\u51b2\u91cf', 'pressure': '\u538b\u5f3a',
      'wave': '\u5149\u6ce2', 'photon': '\u5149\u5b50', 'current': '\u7535\u6d41', 'power': '\u529f\u7387',
      'force': '\u529b', 'induction': '\u611f\u5e94'
    };
    var ACHV = {};   // type -> count（heat 与 heat-caloric 合并计数）
    var achvEl = null;
    function achvKeyOf(type) { return (type === 'heat-caloric') ? 'heat' : type; }
    function placeAchv() {
      if (!achvEl) return;
      /* fixed 定位（2026-10-01 修复）：按**舞台**的屏幕矩形摆位 ——
         舞台左边 ≥140px 说明左侧有 AI 对话栏：面板钉在对话栏顶部（视口左上角）；
         没有左栏（舞台顶满窗口）就退到舞台内、工具条下方，绝不伸出舞台。 */
      var sl = 0, st = 0;
      try { var o = tableOrigin(); sl = o.left; st = o.top; } catch (e) { sl = 0; st = 0; }
      if (sl >= 140) {
        achvEl.style.left = '6px';
        achvEl.style.top = (st + 6) + 'px';
        achvEl.style.maxWidth = (sl - 12) + 'px';
      } else {
        achvEl.style.left = (sl + 10) + 'px';
        achvEl.style.top = (st + 46) + 'px';
        achvEl.style.maxWidth = '';
      }
    }
    function refreshAchv() {
      if (!achvEl) return;
      var row = achvEl._row;
      if (!row || !row.parentNode) return;
      while (row.firstChild) row.removeChild(row.firstChild);
      var any = false;
      for (var k in ACHV) {
        if (!ACHV[k]) continue;
        var name = ACHV_NAMES[k];
        if (!name) continue;
        any = true;
        var b = DD.createElement('span');
        b.className = 'ps-achv-b';
        b.setAttribute('data-ev', k);
        if (ACHV[k] > 1) b.innerHTML = name + ' <b>\u00d7' + ACHV[k] + '</b>';
        else b.textContent = name;
        row.appendChild(b);
      }
      achvEl.style.display = any ? '' : 'none';
    }
    function buildAchv() {
      achvEl = DD.createElement('div');
      achvEl.className = 'ps-achv';
      var t = DD.createElement('div');
      t.className = 'ps-achv-title';
      t.textContent = '\u6210\u5c31';
      var row = DD.createElement('div');
      row.className = 'ps-achv-row';
      achvEl.appendChild(t);
      achvEl.appendChild(row);
      achvEl._row = row;
      achvEl.style.display = 'none';
      (DD.body || DD.documentElement).appendChild(achvEl);   // ★ 直挂 body（fixed），不受 .gl-stage 裁剪
      placeAchv();
      refreshAchv();
    }
    /* ---- 操作日志（2026-10-01 新功能）：记"用户做了什么操作"，持久化到
       localStorage['qg_ps_oplog']（JSON 数组，上限 500 条，超出丢最旧的）；
       桌面与手机同一套 localStorage，下次打开还能翻账。不进 UI。 ---- */
    var OPLOG_KEY = 'qg_ps_oplog';
    var oplog = [];
    function oplogLoad() {
      try {
        var s = window.localStorage.getItem(OPLOG_KEY);
        if (s) { oplog = JSON.parse(s); if (!oplog || typeof oplog.length !== 'number') oplog = []; }
      } catch (e) { oplog = []; }
      if (oplog.length > 500) oplog = oplog.slice(oplog.length - 500);
    }
    function oplogSave() {
      try { window.localStorage.setItem(OPLOG_KEY, JSON.stringify(oplog)); } catch (e) { /* 配额满就丢 */ }
    }
    function opLog(op, data) {
      var entry = { t: Date.now(), op: op };
      if (data) { for (var k in data) entry[k] = data[k]; }
      oplog.push(entry);
      if (oplog.length > 500) oplog = oplog.slice(oplog.length - 500);
      oplogSave();
    }
    function eqEmit(type, B, data) {
      eqEventSeq++;
      EQ_EVENTS.push({ seq: eqEventSeq, t: +eqTime.toFixed(6), type: type,
                       id: B ? bodies.indexOf(B) : -1, eq: B ? B.eq : null, data: data || null });
      if (EQ_EVENTS.length > 64) EQ_EVENTS.shift();
      if (B) { B.evType = type; B.evT = eqTime; }
      /* 成就计数 + 操作日志（2026-10-01） */
      var ak = achvKeyOf(type);
      if (ACHV_NAMES[ak]) { ACHV[ak] = (ACHV[ak] || 0) + 1; refreshAchv(); }
      opLog('event', { ev: type, d: data || null });
    }
    function eqResetAll() { EQ_EVENTS = []; eqEventSeq = 0; eqTime = 0; eqAcc = 0; }
    /* 物理读数：公式卡上实时显示的那几行（也进 bodyState().readout，供断言） */
    function eqReadout(B) {
      var r = B.eqRead;
      if (!r) return null;
      var out = {};
      for (var k in r) out[k] = (typeof r[k] === 'number') ? +r[k].toFixed(4) : r[k];
      return out;
    }
    function eqSet(B, k, v) { if (!B.eqRead) B.eqRead = {}; B.eqRead[k] = v; }
    /* 一个体的温度读数（2026-10-01 修复：Q吸=Q放 之前只看 B.temp）。
       B.temp 是"活温度"：只有被射线加热过、或自己就是热学公式体时才有。
       普通体（一个 m 块）根本没有 B.temp —— 于是"把一块 m 的 T 读数设成 80、
       再和 Q吸=Q放 的体靠近"永远配不出传热对（实测：thermal-balance 事件 0 条、
       目标温度恒 20）。所以温度按两级取：活温度优先，其次认它的 T 读数。 */
    function tempOf(O) {
      if (!O) return null;
      if (O.temp != null && isFinite(O.temp)) return O.temp;
      if (O.eqState && typeof O.eqState.T === 'number' && isFinite(O.eqState.T)) return O.eqState.T;
      return null;
    }
    function setTempOf(O, v) {
      if (!O) return;
      O.temp = v;
      if (O.eqState) O.eqState.T = v;      // 两个读数必须是同一个数（卡片与事件都读它）
    }

    /* 初始化一个公式体的动力学状态（换手/换公式/清场后调用） */
    function eqInitState(B) {
      if (B.eqState) return;
      B.eqState = {
        x0: B.x, y0: B.y, vx0: B.vx, vy0: B.vy,   // 公式体的运动一律从"拼齐那一刻"算起
        sx: 0, sv: 0, a: 0,                        // 弹簧位移/速度/加速度
        U: 0, R: 0, I: 0, P: 0, Q: 0, W: 0,        // 电学
        F: 0, q: 0, m: 1, L: 1,                    // 力/电荷/质量/长度（默认值，可由读数改）
        B: 1, E: 0, phi: 0, eps: 0,                // 磁场/电场/磁通/电动势
        chargeState: 'idle',                       // 电容：idle|charging|charged
        short: false, open: false,
        hits: 0, lastHit: -1, u0: null, u1: null   // 碰撞统计（u0/u1 = 碰前/碰后速度）
      };
      B.eqState.x0 = B.x; B.eqState.y0 = B.y;
      eqBootstrap(B);
    }
    /* 把体上的字母翻译成初始物理量（课本默认值；探针可用 API 覆盖） */
    function eqBootstrap(B) {
      var S = B.eqState, toks = toksOfBody(B), i;
      function has(c) { return toks.indexOf(c) >= 0; }
      function times(c) { var n = 0; for (i = 0; i < toks.length; i++) if (toks.charAt(i) === c) n++; return n; }
      if (B.eq === 'momentum') { S.m = 1; S.p = S.m * (B.vx || 0); B.eqRead = {}; }
      if (B.eq === 'ohm') { S.U = 6; S.R = 2; S.I = S.U / S.R; }
      if (B.eq === 'powerE') { S.U = 6; S.I = 2; S.P = S.U * S.I; S.R = S.U / S.I; }
      if (B.eq === 'joule') { S.I = 2; S.R = 2; S.t = 1; S.Q = S.I * S.I * S.R * S.t; }
      if (B.eq === 'charge') { S.I = 2; S.t = 1; S.Q = 2; }
      if (B.eq === 'cap') { S.C = 2; S.U = 5; S.Q = S.C * S.U; S.chargeState = 'charging'; }
      if (B.eq === 'hooke') { S.k = 40; S.m = 1; S.sx = (B.hw || 40) * 0.8; S.sv = 0; }
      if (B.eq === 'circular') { S.omega = 2 * Math.PI / Math.max(0.4, 1.2); }
      if (B.eq === 'circular') { /* ω=2π/T：T 由字母 T 的出现次数之外的物理量决定 */ }
      if (B.eq === 'kinetic' || B.eq === 'potential' || B.eq === 'work') { S.m = 1; S.g = 9.8; }
      if (B.eq === 'newton2') { S.F = 2; S.m = 1; S.a = S.F / S.m; }
      if (B.eq === 'ampere' || B.eq === 'lorentz') { S.B = 0.5; S.I = 2; S.L = 0.4; S.q = 0.002; S.v = 3; }
      if (B.eq === 'faraday') { S.phi = 0; S.eps = 0; }
      if (B.eq === 'weight' || B.eq === 'friction') { S.g = 9.8; S.m = 1; S.mu = 0.2; S.theta = 0; }
      if (B.eq && B.eq.indexOf('delta') === 0) { /* Δ：无需初值 */ }
      /* 第三批基础公式的初值（2026-10-01）。
         ⚠ 不要用 numOfGlyph 取初值：eqState 模板把 Q/W/F/U/E 预置成 0，
         numOfGlyph 会优先读到这些 0，公式量永远为 0（实测 Q=cmΔT 的 Q 恒 0）。
         沿用旧分支的写法：**写死课本默认值**，药丸拖动再改（pillMove 直接写这些键）。 */
      if (B.eq === 'heatmass') { S.Q = 4; S.c = 4200; S.m = 1; }
      if (B.eq === 'melt') { S.Q = 4; S.lam = 334000; S.m = 1; S.phase = 'solid'; }
      if (B.eq === 'thermal-balance') { S.Q = 4; if (B.temp == null) B.temp = 20; }
      if (B.eq === 'ideal-gas' || B.eq === 'isothermal' || B.eq === 'isochoric') { S.p = 100000; S.V = 2; S.T = 2; }
      if (B.eq === 'uniform-field') { S.U = 6; S.d = 2; }
      if (B.eq === 'impetus') { S.F = 10; S.t = 1; S.m = 1; }
      if (B.eq === 'buoyancy') { S.rho = 1000; S.g = 9.8; S.V = 2; S.m = 1; }
      if (B.eq === 'pressure') { S.F = 10; S.S = 2; }
      if (B.eq === 'photoelectric') { S.h = 2; S.nu = 3; S.W = 10; }
      B.eqRead = B.eqRead || {};
    }

    /* ---- 碰撞（动量守恒）：两个动量体靠近并相向运动时判定 ---- */
    function eqCollide(dt) {
      var i, j;
      for (i = 0; i < bodies.length; i++) {
        var A = bodies[i];
        if (!A.eq || A.eq !== 'momentum' || A.bh) continue;
        for (j = i + 1; j < bodies.length; j++) {
          var B = bodies[j];
          if (!B.eq || B.eq !== 'momentum' || B.bh) continue;
          var dx = B.x - A.x, dy = B.y - A.y;
          var gap = Math.hypot(dx, dy);
          var reach = (A.hw + B.hw + 10);
          if (gap > reach) continue;
          var nx = dx / (gap || 1), ny = dy / (gap || 1);
          /* 判据必须用**相对速度沿法向的分量** v_rel = (vA − vB)·n。
             为什么不能分别投影再相减：u1=120、u2=−60 时 u1−u2=180>0 恒成立，
             法向指反了也会被判成"正在接近"，于是刚摆下的两体会被无限次"碰"回去 ——
             实测两体在 x≈391~491 之间来回振荡、速度一直不换（30 次碰撞全是空碰）。
             相对速度才是物理上的接近判据：v_rel>0 表示 A 正在朝 B 靠近。 */
          var vrel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
          if (vrel <= 0) continue;              // 正在分离（或已经分开），不算碰撞
          var u1 = A.vx * nx + A.vy * ny;       // 沿法向的分量（公式与事件读数用）
          var u2 = B.vx * nx + B.vy * ny;
          if (u1 === u2) continue;              // 法向分量相同 = 整体平移，不产生碰撞
          /* 同一对体在一次碰撞后的**冷却**：判据是"这一次子步里已经处理过"。
             为什么要它：碰撞是"按住位置判距离"，如果不在同一子步里跳过重复判定，
             一帧内会连判几十次、逐次抽走能量，看起来像卡住（实测 hits 会飙到 50）。
             为什么要按**子步**而不是按"碰过的对象"：真实使用里两体会连续相撞多次
             （碰完弹开、撞墙又回来），只在"同一次子步"里去重才不会把真实碰撞吃掉。 */
          if (A.eqState.lastHitStep === eqStepNo || B.eqState.lastHitStep === eqStepNo) continue;
          if (eqTime - (A.eqState.lastHitT || -9) < 0.02 && eqTime - (B.eqState.lastHitT || -9) < 0.02) continue;
          var m1 = A.eqState.m, m2 = B.eqState.m;
          /* 恢复系数 e：课本上 e=1 弹性碰撞、e=0 完全非弹性（碰后共速）。
             ⚠ 公式别写歪（这里踩过一次）：`v = vcm + e·(u − vcm)` 在 e=1 时是**恒等式**
             —— 它把碰前速度原样返回，看起来"算了但没变"。正确的是先用**弹性碰撞**
             的一维公式求出碰后速度，再按 e 在"弹性结果"与"共速（vcm）"之间插值：
               v1e = ((m1−m2)u1 + 2m2u2)/(m1+m2)      （弹性，动量与动能都守恒）
               v2e = ((m2−m1)u2 + 2m1u1)/(m1+m2)      （等价于两者交换动量）
               v1f = vcm + e·(v1e − vcm)，  v2f = vcm + e·(v2e − vcm)
             e=1 -> 弹性结果；e=0 -> 两者都是 vcm（完全非弹性）；中间值线性插值。 */
          var e = (typeof A.eqState.e === 'number') ? A.eqState.e : 1;
          var vcm = (m1 * u1 + m2 * u2) / (m1 + m2);
          var v1e = ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2);
          var v2e = ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2);
          var v1f = vcm + e * (v1e - vcm);
          var v2f = vcm + e * (v2e - vcm);
          /* 把法向分量写回（切向保持不变） */
          A.vx += (v1f - u1) * nx; A.vy += (v1f - u1) * ny;
          B.vx += (v2f - u2) * nx; B.vy += (v2f - u2) * ny;
          var EkB = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
          var EkA = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
          A.eqState.hits++; B.eqState.hits++;
          A.eqState.u0 = u1; A.eqState.u1 = v1f;
          B.eqState.u0 = u2; B.eqState.u1 = v2f;
          A.eqState.e = e; B.eqState.e = e;
          A.eqState.EkLoss = +(EkB - EkA).toFixed(6);
          eqSet(A, 'Σp', m1 * v1f + m2 * v2f);
          eqSet(A, 'ΣEk', EkA);
          eqEmit('collide', A, { e: e, u1: +u1.toFixed(4), v1: +v1f.toFixed(4),
                                 u2: +u2.toFixed(4), v2: +v2f.toFixed(4),
                                 EkBefore: +EkB.toFixed(6), EkAfter: +EkA.toFixed(6),
                                 EkLoss: +(EkB - EkA).toFixed(6) });
          /* 碰撞的**可见提示**：复用既有的冲击环（ringGo）+ 一次轻微震动，别做夸张特效 */
          ringGo((A.x + B.x) / 2, (A.y + B.y) / 2);
          shake(3, 0.12);
          /* 把两体推开一点，避免贴着反复判定 */
          A.x -= nx * 3; A.y -= ny * 3; B.x += nx * 3; B.y += ny * 3;
        }
      }
    }

    /* ---- 固定步长的单步推进（只作用于公式体） ---- */
    function eqStepOnce() {
      eqTime += EQ_DT;
      eqStepNo++;              // 子步序号（碰撞冷却按它去重：同一子步内一对体只判一次）
      var dt = EQ_DT, i;
      /* 1) 通用运动：公式体默认**不受重力、不被引力井吸引**（双轨：两套物理不互相污染），
            只按自己的 v 匀速走，撞到台面边界反弹。 */
      for (i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        if (!B.eq || B.bh) continue;
        if (grab.kind === 'body' && grab.obj === B) continue;   // ★ 被抓住的体不积分（2026-10-01）
        eqInitState(B);
        var S = B.eqState;
        /* newton2：F=ma 真的给出加速度 */
        if (B.eq === 'newton2') { S.a = S.F / S.m; B.vx += S.a * dt * (B.th ? -Math.cos(B.th) : -1); }
        /* circular：向心加速度读数 a=v²/r（r 用两个圆周体的间距，没有伙伴就用自身 hw） */
        if (B.eq === 'circular') {
          var rr = Math.max(20, B.hw || 20);
          S.v = Math.hypot(B.vx, B.vy);
          S.a = S.v * S.v / rr;
        }
        /* 弹簧振子：F=-kx -> a=-kx/m（一维，沿 B.th 方向；T=2π√(m/k)） */
        if (B.eq === 'hooke') {
          S.a = -S.k * S.sx / S.m;
          S.sv += S.a * dt;
          S.sx += S.sv * dt;
          S.Ek = 0.5 * S.m * S.sv * S.sv;
          S.Ep = 0.5 * S.k * S.sx * S.sx;
          S.T = 2 * Math.PI * Math.sqrt(S.m / S.k);
          /* 弹簧体自己就沿它被摆下的方向来回振，位移直接写回世界坐标 */
          var th = B.th || 0;
          B.x = S.x0 + Math.cos(th) * S.sx;
          B.y = S.y0 + Math.sin(th) * S.sx;
        }
        /* kinetic / potential / work：能量读数（不做新运动） */
        if (B.eq === 'kinetic') { S.v = Math.hypot(B.vx, B.vy); S.Ek = 0.5 * S.m * S.v * S.v; }
        if (B.eq === 'potential') { S.h = (groundY - B.y) / 40; S.Ep = S.m * S.g * S.h; }
        if (B.eq === 'work') { S.s = Math.abs(B.x - S.x0) / 40; S.W = S.F ? S.F * S.s : 0; }
        /* 斜面与摩擦：tanθ > μ 才下滑（θ 由 th 给出，μ 由字母 μ 或在 API 里设） */
        if (B.eq === 'weight' || B.eq === 'friction') {
          /* 斜面倾角 θ 的**唯一真源是体的朝向 B.th**（玩家用旋转手柄摆倾角）。
             eqSet(id,'theta',θ) 在接口层直接写 B.th —— 只写 eqState.theta 的话
             读数里的 tanθ 永远是 0、判据永远"不下滑"（这里踩过一次）。 */
          var tanth = Math.abs(Math.tan(B.th || 0));
          S.theta = B.th || 0;
          S.tanTheta = tanth;
          S.slides = (B.eq === 'friction') && (tanth > S.mu);
          S.N = S.m * S.g * Math.cos(B.th || 0);
          S.f = S.mu * S.N;
          if (S.slides) { B.vx += Math.cos(B.th || 0) * (S.g * Math.sin(B.th || 0) - S.mu * S.g * Math.cos(B.th || 0)) * dt; }
          else if (B.eq === 'friction') { B.vx *= 0.9; B.vy *= 0.9; }
        }
        /* 电学：U/R 真的算出 I；R 太小 -> 短路；R 太大/断路 -> I=0 */
        if (B.eq === 'ohm' || B.eq === 'powerE') {
          if (B.eq === 'ohm') { S.R = (typeof S.Rset === 'number') ? S.Rset : S.R; S.U = (typeof S.Uset === 'number') ? S.Uset : S.U;
                                /* R→0 是短路：I=U/R 发散，物理上受电源内阻限制。
                                   这里给一个**可读的大电流哨兵**而不是 0 —— 0 会让
                                   "短路"看起来像"断路"，两个事件就分不出来了。 */
                                S.I = (S.R > 0.05) ? (S.U / S.R) : (S.U / 0.05); }
          S.P = S.U * S.I;
          var wasShort = S.short;
          S.short = (S.R <= 0.05);
          S.open = (S.R >= 1e6);
          if (S.short && !wasShort) eqEmit('short-circuit', B, { R: S.R, I: S.I });
          if (S.open && !S.openHit) { S.openHit = true; eqEmit('open-circuit', B, { R: S.R, I: S.I }); }
          if (!S.open) S.openHit = false;
          S.Q = S.I * S.I * S.R * 1;
          eqSet(B, 'I', S.I); eqSet(B, 'U', S.U); eqSet(B, 'P', S.P);
          eqSet(B, 'R', S.R); eqSet(B, 'short', S.short ? 1 : 0);
        }
        if (B.eq === 'joule') { S.Q = (typeof S.Q === 'number') ? S.Q : 0; S.Q += S.I * S.I * S.R * dt; eqSet(B, 'Q', S.Q); }
        if (B.eq === 'charge') { S.Q = (typeof S.Q === 'number') ? S.Q : 0; S.Q += S.I * dt; eqSet(B, 'Q', S.Q); }
        if (B.eq === 'emf') { S.I = (S.R > 0) ? (S.eps / (S.R + 0.5)) : 0; S.U = S.eps - S.I * 0.5; eqSet(B, 'I', S.I); eqSet(B, 'U', S.U); }
        if (B.eq === 'cap') {
          /* 充电：Q 从 0 涨到 CU，箭头方向表示充电（楞次/充电方向都要看得见） */
          var target = S.C * S.U;
          if (S.chargeState === 'charging') {
            S.Q += (target - S.Q) * Math.min(1, dt * 3);
            S.I = (target - S.Q) * 3;
            if (Math.abs(target - S.Q) < 0.01 * Math.max(1, target)) { S.chargeState = 'charged'; eqEmit('cap-charged', B, { Q: S.Q, U: S.U }); }
          }
          eqSet(B, 'Q', S.Q); eqSet(B, 'U', S.U); eqSet(B, 'I', S.I);
        }
        /* 磁场：安培力 F=BIL（方向：左手定则 —— I 与 B 垂直时 F 垂直于两者所在的平面）
           洛伦兹力 F=qvB（方向：正电荷用左手定则；这里只做平面内的转向） */
        if (B.eq === 'ampere' || B.eq === 'lorentz') {
          var F = (B.eq === 'ampere') ? (S.B * S.I * S.L) : (S.q * S.v * S.B);
          S.F = F;
          /* 方向：**电流/电荷的符号**（Isign / qsign，与托盘上 q、I 的既有极性语义一致），
             取不到才退回 chargeSign。平面近似下 I（或 v）沿 +x、B 垂直纸面向外时
             F 沿 -y（左手定则）；Isign=-1 即电流反向 -> 受力反向。
             ⚠ 这里踩过一次：原来只读 `S.chargeSign`，而接口/探针用的是 `Isign` ——
             名字对不上，方向就永远不翻转（实测 forward 与 reverse 完全相同）。 */
          var dir = (typeof S.Isign === 'number') ? S.Isign
                  : ((typeof S.qsign === 'number') ? S.qsign
                  : ((S.chargeSign == null) ? 1 : S.chargeSign));
          B.vy += dir * F * dt * 8;
          eqSet(B, 'F', F); eqSet(B, 'B', S.B);
        }
        /* 法拉第：ε = -ΔΦ/Δt（单匝）。磁通由"与最近磁场源的距离"给出，靠近/远离方向相反。 */
        if (B.eq === 'faraday') {
          var src = null, bd = 1e9, k2;
          for (k2 = 0; k2 < bodies.length; k2++) {
            var O2 = bodies[k2];
            if (!O2.eq) continue;
            if (O2.eq !== 'ampere' && O2.eq !== 'lorentz') continue;
            var dd = Math.hypot(O2.x - B.x, O2.y - B.y);
            if (dd < bd) { bd = dd; src = O2; }
          }
          var phiPrev = S.phi;
          S.phi = (src ? (1 / Math.max(40, bd)) : 0);
          S.eps = -(S.phi - phiPrev) / dt;
          S.approach = (S.phi > phiPrev) ? 'closer' : (S.phi < phiPrev ? 'away' : 'still');
          if (Math.abs(S.eps) > 1e-4 && S.approach !== S.lastApproach) {
            eqEmit('induction', B, { eps: +S.eps.toFixed(4), dir: S.approach });
            S.lastApproach = S.approach;
          }
          eqSet(B, 'ε', S.eps); eqSet(B, 'Φ', S.phi);
        }
        /* ---- 第三批基础公式（2026-10-01 用户点名"能产生效果/设定实验条件的做全"）----
           每条：公式 + 可见效果 + 事件；数值与公式一致（读数进 readout 可断言）。 */
        /* Q=cmΔT（吸放热）：ΔT=Q/(cm) → 目标温度变化（T 读数/药丸看得见） */
        if (B.eq === 'heatmass') {
          S.c = numOfGlyph(B, 'c\u6bd4'); S.m = numOfGlyph(B, 'm');
          S.Q = (typeof S.Q === 'number') ? S.Q : numOfGlyph(B, 'Q');
          S.dT = S.Q / (S.c * Math.max(0.01, S.m));
          B.temp = 20 + S.dT;
          eqSet(B, 'T', +B.temp.toFixed(3)); eqSet(B, 'dT', +S.dT.toFixed(3)); eqSet(B, 'Q', S.Q);
          if (!B._hmFired) { B._hmFired = true; eqEmit('heat', B, { temp: +B.temp.toFixed(3), dT: +S.dT.toFixed(3), by: 'cm' }); }
        }
        /* Q=λm（熔化/凝固热）：Q ≥ λm 才熔化，温度停在熔点 0°C（相变看得见） */
        if (B.eq === 'melt') {
          S.lam = numOfGlyph(B, '\u03bb\u7194'); S.m = numOfGlyph(B, 'm');
          S.Q = (typeof S.Q === 'number') ? S.Q : numOfGlyph(B, 'Q');
          S.Qneed = S.lam * Math.max(0.01, S.m);
          var wasPhase = S.phase;
          S.phase = (S.Q >= S.Qneed) ? 'liquid' : 'solid';
          if (wasPhase && S.phase !== wasPhase) eqEmit('phase-change', B, { phase: S.phase, Q: S.Q, Qneed: S.Qneed });
          S.T = (S.phase === 'solid') ? 0 : (20 + Math.max(0, (S.Q - S.Qneed) / (numOfGlyph(B, 'c\u6bd4') * Math.max(0.01, S.m))));
          eqSet(B, 'phase', S.phase === 'liquid' ? '\u6db2' : '\u56fa');
          eqSet(B, 'T', +S.T.toFixed(3)); eqSet(B, 'Q', S.Q); eqSet(B, 'Qneed', S.Qneed);
        }
        /* Q吸=Q放（热平衡）：与最近的另一个**有温度**的体趋向同一温度（两读数趋同看得见）。
           ⚠ 2026-10-01 修复两点：
             ① 配对判据原来只认 OB.temp（活温度）—— 普通体（一个 m 块）只有 T 读数、
                没有 temp，于是"两个物体传热"在真机上永远配不出对（事件 0 条）。
                现在走 tempOf()：活温度优先，其次 T 读数（探针 eqSet(id,'T',80) 也认）。
             ② 写回必须**两个读数一起写**（setTempOf）—— 只写 temp 会让卡片上的 T 读数
                与事件里的温度各说各话。 */
        if (B.eq === 'thermal-balance') {
          var tb = null, tbd = 1e9, tbi, tbv = null;
          for (tbi = 0; tbi < bodies.length; tbi++) {
            var OB = bodies[tbi];
            if (OB === B || !OB || OB.bh) continue;
            var ov = tempOf(OB);
            if (ov == null) continue;
            var tdd = Math.hypot(OB.x - B.x, OB.y - B.y);
            if (tdd < tbd) { tbd = tdd; tb = OB; tbv = ov; }
          }
          var tSelf = tempOf(B);
          if (tSelf == null) tSelf = 20;
          if (tb && tbd < 260) {
            var c1 = numOfGlyph(B, 'c\u6bd4'), m1 = Math.max(0.01, numOfGlyph(B, 'm'));
            var c2 = numOfGlyph(tb, 'c\u6bd4'), m2 = Math.max(0.01, numOfGlyph(tb, 'm'));
            var t1 = tSelf, t2 = tbv;
            var Teq = (c1 * m1 * t1 + c2 * m2 * t2) / (c1 * m1 + c2 * m2);
            var kk = Math.min(1, dt * 1.2);
            var n1 = t1 + (Teq - t1) * kk, n2 = t2 + (Teq - t2) * kk;
            setTempOf(B, n1);
            setTempOf(tb, n2);
            if (!B._tbFired) { B._tbFired = true; eqEmit('thermal-balance', B, { Teq: +Teq.toFixed(3), other: bodies.indexOf(tb), T1: +t1.toFixed(3), T2: +t2.toFixed(3) }); }
          }
          eqSet(B, 'T', +tSelf.toFixed(3));
        }
        /* pV/T、pV、p/T（气体状态）：药丸改 V/T → p 联动（读数看得见） */
        if (B.eq === 'ideal-gas' || B.eq === 'isothermal' || B.eq === 'isochoric') {
          var pv0 = numOfGlyph(B, 'p\u538b'), Vv = numOfGlyph(B, 'V'), Tv = numOfGlyph(B, 'T');
          if (!B._gasK) B._gasK = (pv0 * Vv) / Math.max(0.1, Tv);
          S.K = B._gasK;
          if (B.eq === 'ideal-gas') S.p = S.K * Tv / Math.max(0.01, Vv);
          else if (B.eq === 'isothermal') S.p = S.K / Math.max(0.01, Vv);
          else S.p = S.K * Tv;
          eqSet(B, 'p', +S.p.toFixed(3)); eqSet(B, 'V', Vv); eqSet(B, 'T', Tv);
          if (!B._gasFired) { B._gasFired = true; eqEmit('gas', B, { p: +S.p.toFixed(3), V: Vv, T: Tv, K: +S.K.toFixed(3) }); }
        }
        /* U=Ed（匀强电场）：读数 E=U/d；与箭头击穿联动（击穿判定在 stepArrows）。
           U 与 ohm 同一套约定：药丸/eqSet 写的 U 走 Uset 镜像。 */
        if (B.eq === 'uniform-field') {
          S.U = (typeof S.Uset === 'number') ? S.Uset : S.U;
          S.d = Math.max(1, (typeof S.d === 'number' && S.d > 0) ? S.d : numOfGlyph(B, 'd'));
          S.E = S.U / S.d;
          eqSet(B, 'U', S.U); eqSet(B, 'd', S.d); eqSet(B, 'E', +S.E.toFixed(3));
        }
        /* Δp=Ft（动量定理）：冲量推动体、速度改变（动起来看得见） */
        if (B.eq === 'impetus') {
          if (!(S.F > 0)) S.F = 10;    // 模板预置 0，未设过就回课本默认
          S.t = numOfGlyph(B, 't'); S.m = numOfGlyph(B, 'm');
          S.dp = S.F * S.t;
          B.vx += -S.dp / Math.max(0.01, S.m) * dt * 0.5;
          if (!B._impFired) { B._impFired = true; eqEmit('impulse', B, { dp: S.dp, F: S.F, t: S.t }); }
          eqSet(B, 'dp', +S.dp.toFixed(3));
        }
        /* F=ρgV（浮力/浮沉）：F浮 > 重则上浮、< 重则下沉（运动看得见；加速度做玩具尺度封顶，
           读数 Fb=ρgV 与公式逐字一致） */
        if (B.eq === 'buoyancy') {
          S.rho = numOfGlyph(B, RHO); S.g = numOfGlyph(B, 'g'); S.V = numOfGlyph(B, 'V');
          S.m = numOfGlyph(B, 'm');
          S.Fb = S.rho * S.g * S.V; S.W = S.m * S.g;
          var wasSt = S.state;
          S.state = (S.Fb > S.W * 1.01) ? 'float' : ((S.Fb < S.W * 0.99) ? 'sink' : 'hover');
          var ay = (S.state === 'float') ? -((S.Fb - S.W) / Math.max(0.01, S.m)) : ((S.state === 'sink') ? ((S.W - S.Fb) / Math.max(0.01, S.m)) : 0);
          B.vy += clamp(ay, -400, 400) * dt;
          if (wasSt && S.state !== wasSt) eqEmit('buoy', B, { state: S.state, Fb: S.Fb, W: S.W });
          if (!B._buoyFired) { B._buoyFired = true; eqEmit('buoy', B, { state: S.state, Fb: S.Fb, W: S.W }); }
          eqSet(B, 'Fb', +S.Fb.toFixed(3)); eqSet(B, 'W', S.W); eqSet(B, 'state', S.state);
        }
        /* p=F/S（压强）：读数 p 随 F、S 联动 */
        if (B.eq === 'pressure') {
          if (!(S.F > 0)) S.F = 10;    // 模板预置 0，未设过就回课本默认
          S.S = numOfGlyph(B, 'S');
          S.p = S.F / Math.max(0.01, S.S);
          eqSet(B, 'p', +S.p.toFixed(3));
          if (!B._presFired) { B._presFired = true; eqEmit('pressure', B, { p: +S.p.toFixed(3), F: S.F, S: S.S }); }
        }
        /* E=hν−W（光电效应）：hν ≥ W 才逸出电子（负对照：不够就不逸出），逸出有粒子可见 */
        if (B.eq === 'photoelectric') {
          S.h = numOfGlyph(B, 'h'); S.nu = numOfGlyph(B, NU);
          if (!(S.W > 0)) S.W = 10;   // 模板预置 0，未设过就回课本默认（逸出功）
          S.E = S.h * S.nu - S.W;
          eqSet(B, 'E', +S.E.toFixed(3));
          var canEscape = S.E >= 0;
          if (canEscape && !B._escFired) {
            B._escFired = true;
            eqEmit('photoescape', B, { E: +S.E.toFixed(3), hnu: +(S.h * S.nu).toFixed(3), W: S.W });
            burstParticles(B.x, B.y - 12, 14, 0.7);
          }
          eqSet(B, 'escape', canEscape ? 1 : 0);
        }
        /* 卫星轨道（引力井系统用 eq 体表达不了，这里给"圆周运动 + 逃逸判据"读数） */
        /* 通用位移积分（弹簧体已经直接写了坐标，跳过） */
        if (B.eq !== 'hooke') { B.x += B.vx * dt; B.y += B.vy * dt; }
        /* 边界：公式体在台面内反弹（不施力、不吸东西，只防跑出屏幕） */
        if (B.x < 24) { B.x = 24; B.vx = Math.abs(B.vx) * 0.9; }
        if (B.x > W - 24) { B.x = W - 24; B.vx = -Math.abs(B.vx) * 0.9; }
        if (B.y < 24) { B.y = 24; B.vy = Math.abs(B.vy) * 0.9; }
        if (B.y > groundY - 24) { B.y = groundY - 24; B.vy = -Math.abs(B.vy) * 0.9; }
      }
      /* 2) 碰撞（动量守恒）放在运动之后，判据用"这一子步的位置" */
      eqCollide(dt);
    }
    /* 累加器：把真实帧间隔切成固定步长；单帧最多补 8 步（防止卡顿时追帧爆炸） */
    function eqAccumulate(dt) {
      var any = false, i;
      for (i = 0; i < bodies.length; i++) if (bodies[i].eq && !bodies[i].bh) { any = true; break; }
      if (!any) { eqAcc = 0; return; }
      eqAcc += dt;
      var n = 0;
      while (eqAcc >= EQ_DT && n < 8) { eqStepOnce(); eqAcc -= EQ_DT; n++; }
      if (eqAcc > EQ_DT * 8) eqAcc = 0;
    }

    /* 公式文本：把可见字形按"读出来的顺序"拼成字符串。
       排序关键：**先按 y 分行，再按 x 从左到右** —— 这样 ² 永远跟在底数字母
       后面（y 只差一点点，用 12px 容差归到同一行），分数线上下的字形则先出
       分子再出分母，跟肉眼读的顺序一致。
       "是否被 refresh() 藏起来"用 offsetParent 判（display:none 的元素为 null）。 */
    function orderGlyphs(B) {
      var arr = [];
      for (var i = 0; i < B.glyphs.length; i++) {
        var g = B.glyphs[i];
        if (!g || g.dead || g.type === BAR) continue;
        if (g.el && g.el.offsetParent === null) continue;
        arr.push(g);
      }
      arr.sort(function (a, b) {
        var dy = (a.sy || 0) - (b.sy || 0);
        if (Math.abs(dy) > 12) return dy;
        return (a.sx || 0) - (b.sx || 0);
      });
      return arr;
    }
    function textOf(arr) {
      var s = '';
      for (var i = 0; i < arr.length; i++) s += arr[i].ch;
      return s;
    }
    function formulaOf(B) {
      if (B.kind) return B.kind === 'T' ? 'plank' : B.kind;
      return textOf(orderGlyphs(B));
    }
    /* layout：结构化描述（分子 / 分母 / 公式串），比单纯的 formula 更适合人读，
       也方便上层页面标"这是什么式子"。
       ½ 领出来写在前头：排版上它也占"分母那一行的最上面"（½mv² 这个复合字形
       本来就该排在分子左边），但读式子时它是**系数**，写成 "½·(mv²)/r" 才对。 */
    function layoutOf(B) {
      if (B.kind) return { type: B.kind === 'T' ? 'plank' : 'field', formula: B.kind };
      var arr = orderGlyphs(B);
      var lead = '', num = [], den = [], nums = '', dens = '', i, g;
      for (i = 0; i < arr.length; i++) {
        g = arr[i];
        if (B.hasHalf && g.type === HALF) { lead = HALF; continue; }
        if (B.frac && B.st.bar && !B.st.bar.dead && (g.sy || 0) > (B.st.bar.sy || 0)) den.push(g);
        else num.push(g);
      }
      nums = textOf(num); dens = textOf(den);
      var f;
      if (!B.frac || !dens) f = lead + nums + dens;
      else f = lead + '(' + nums + ')/' + dens;
      return { type: B.frac ? 'fraction' : 'run', formula: f, lead: lead, num: nums, den: dens,
               bar: !!B.frac, isWell: !!B.isWell, gravMode: B.gravMode };
    }

    function bodyState(B) {
      return {
        id: bodies.indexOf(B),
        kind: B.kind,
        kindName: B.kind ? (KIND_NAME[B.kind] || B.kind) : 'formula',
        formula: formulaOf(B),
        layout: layoutOf(B),
        x: B.x, y: B.y, vx: B.vx, vy: B.vy, th: B.th, sc: B.sc,
        hw: B.hw, hh: B.hh, mass: B.mass, frac: !!B.frac,
        flags: { hasG: !!B.hasG, hasA: !!B.hasA, hasV: !!B.hasV, hasR: !!B.hasR,
                 hasHalf: !!B.hasHalf, hasMu: !!B.hasMu, hasC: !!B.hasC,
                 hasGrav: !!B.hasGrav, hasI: B.kind === 'I', hasQ: B.kind === 'q' },
        vCount: B.vCount || 0, cCount: B.cCount || 0, rCount: B.rCount || 0,
        gravMode: B.gravMode, isWell: !!B.isWell, isSchwarzschild: !!B.isSchwarzschild,
        eq: B.eq || null, eqText: B.eqText || null,
        /* 2026-09-30 移植清单：= 变换的当前边、箭头升温的温度、短路态（三处可读：
           bodyState 这里 + readout.short + eqState(id).short） */
        paramSide: B.paramSide || 0,
        temp: (B.temp == null ? 20 : +B.temp.toFixed(4)),
        shortCircuit: !!(B.eqState && B.eqState.short),
        /* 公式体的实时物理读数（双轨新路径）。老实体这里是 null —— 探针可以据此
           区分"这台实体走没走新物理"。 */
        readout: (B.eq && B.eqRead) ? eqReadout(B) : null,
        evType: B.evType || null,
        hasBH: !!B.bh, bhStage: B.bh ? B.bh.stage : null, bhR: B.bh ? B.bh.r : null,
        orbiting: !!B.go, orbitPartner: B.go ? bodies.indexOf(B.go.by) : null,
        isOrbitPartner: !!B.goB,
        glyphs: B.glyphs.length, mem: B.mem.length,
        massGlyph: B.massG ? B.massG.type : null,
        glyphChars: (function () {
          var a = [];
          for (var i = 0; i < B.glyphs.length; i++) { if (!B.glyphs[i].dead) a.push(B.glyphs[i].ch); }
          return a;
        })()
      };
    }

    /* addBody(chars, opts)：在给定位置摆出一组字形并返回该体的状态对象。
       完全复用**落字同一条代码路径**（dropLetter = 松手那一刻的全部判定），
       只是不依赖真实鼠标。三条装配纪律：
         1) **基础质量先落**：真实用户是"先摆一个块、再把字母拖上去"，所以先把
            这组字形里的第一个质量字母（m/M）落成 base。若让 G 先落，它自己会当
            base，而 base 是 G 的体凑不出 GMm/r²（gravModeOf 要小写 m 才算引力井）。
            两个质量字母时（M 与 m）保持原顺序，正好复现"先摆 M 块、再拖别的字"。
         2) 剩下的字母一律走 dropLetter（含场符号 B/q/I/E，它们各自生成场体）。
         3) ★ 相邻字形间距**必须收窄**（2026-09-30 符号扩展）：装配走的是
            findMergeTarget()，它有一条**距离闸门**（`return bd < 200 ? best : null`）。
            原来 spread=34 是照着"2~4 个字形"定的，公式一长就出事：
            7 个字母的第 8 个字形会落在 238px 外，**超出闸门**，于是 F/m/a 只能拼出
            "Fm"、I 永远并不进 U 的体 —— 表现就是"公式永远凑不齐"。
            现在按字母数算一个 ≤24px 的间距：最多 3 个间距（封装上限），
            最远字形离锚点 ≤72px，稳稳落在闸门之内。字形多到 8 个以上时，
            超过 GRP 的那几个会另起一坨 —— 这是**有意的**：一次 addBody 只承诺
            可靠装配一个公式，要更多就分次调用（预设与探针本来就是这么写的）。 */
    var AB_GRP = 3;      // 一次 addBody 内"保证落在合并闸门内"的间距个数
    var AB_PITCH = 24;   // 相邻字形的基准间距（px）
    function abSpread(n) {
      if (n <= 1) return AB_PITCH;
      return Math.max(12, Math.min(AB_PITCH, Math.round((AB_PITCH * (AB_GRP + 1)) / n)));
    }
    function addBody(chars, o) {
      o = o || {};
      if (typeof chars === 'string') chars = chars.split('');
      chars = chars || [];
      var n = chars.length;
      var spread = o.spread || abSpread(n);
      var x0 = (o.x != null) ? o.x : Math.round(W * 0.5 - (n - 1) * spread / 2);
      var y0 = (o.y != null) ? o.y : Math.round(H * 0.34);
      // 找基础质量：只认 m/M，且整组里只有一个质量时才提前（两个质量要保持顺序）
      var massIdx = -1, massCount = 0;
      for (var q = 0; q < n; q++) { if (isMass(chars[q])) { massCount++; if (massIdx < 0) massIdx = q; } }
      var order = [];
      if (massCount === 1 && massIdx > 0) order.push(massIdx);
      for (var q2 = 0; q2 < n; q2++) if (order.indexOf(q2) < 0) order.push(q2);

      // 第一个字母**不建新体**：挂到一个空体上（= 玩家先把块摆到台面上）。
      // 为什么：BODY() 是"裸体"，直接给它 massG 会让 setF 漏掉这个字母
      // （setF 只扫 B.mem），于是单放一个 g 的体 hasG=false —— g+t→v 就不成立了。
      // 例外：B/q/I/E 是**场符号**，它们各自生成场体（q 会和 m/M 共用 isMass，
      // 混进字符合成那条路会把 addBody(['q','t']) 变成"q 体 + t"而不是"q 场 + t → I"）。
      var firstCh = n > 0 ? chars[order[0]] : '';
      var firstIsField = (firstCh === 'B' || firstCh === 'q' || firstCh === 'I' || firstCh === 'E');
      /* 箭头/等号开头（2026-09-30 移植清单 P2）：它们不是"先摆块再拖字"的料 ——
         箭头是台上独立可旋转的字形（自己射射线）、= 是变换器，都走 dropLetter
         的专门分支，不预先建空体（否则箭头会被 attach 进体里、射线逻辑失效）。 */
      var firstIsSpecial = (firstCh === ARROW || firstCh === EQ);
      var B = (n > 0 && !firstIsField && !firstIsSpecial) ? BODY(x0, y0) : null;
      var first = n > 0 ? GD(firstCh) : null;
      if (first) {
        first.pop = 0;
        // freeLetter 只为拿到"定位 + 显形"这一套，attach 会立刻把它从 freeL 摘走
        freeLetter(first, x0 + order[0] * spread, y0, 0, 0, 1);
        if (firstIsField) {
          /* 场符号开头（2026-09-30 符号扩展）：
             · 只落这一个字形（n === 1）-> 照旧生成场体（电流/电荷/磁场/电场），
               这条既有行为一个字没变；
             · 'q' 后面还有别的字形 -> 传 firstOfGroup=1 让 dropLetter 把 q 当普通
               base 挂着（不生成 q 场体），后面的字母才有机会按公式并进来
               （E=F/q、W=qU）；qt→I 那条路仍然有效（findTComboTarget 现在也认
               "mem 里有 q"的体）。
             · 'I' 不走这个特例：它后面跟 t 必须还能走 qt→I（kind 必须是 'q'），
               而且没有任何公式以 I 打头，所以 I 照旧生成电流场体。
             · **判据不硬编码字母，而是问公式表**（2026-09-30 定稿）：
               `eqGroupFor(本组字母)` 能给出这条公式、且**公式的第一个令牌就是场符号本身**
               -> 这个场符号是在"拼公式"（如 E+Δ+Φ+t → E=ΔΦ/Δt、q+t? 由 t 例外排除），
                  当字形挂上去；
               否则 -> 保持原路（生成场体）。
               为什么这么写：`addBody(['F','B','I','L'])` 里 B 不是**开头令牌**（安培力公式
               是 F 打头），所以 B 不该当锚点 —— 它应当走普通场符号路径（落字时先试并入
               FIL，成功即拼成 F=BIL）。硬编码字母名单会把这种"B 在中间"的情况判错。 */
          var grpEq = n > 1 ? eqGroupFor(chars.join('')) : null;
          /* ⚠ 't' 的排除**只对 q 成立**：q+t 必须留给 qt→I 那条经典路径
             （applyTCombo 认 mem 里有 q 的体），所以"q 打头且组里有 t"不当锚点。
             对 E 不能照搬这条 —— E=ΔΦ/Δt 的令牌里**本来就有 t**，
             一排除就永远拼不出感应公式（实测踩到）。 */
          var anchorOK = !!grpEq && grpEq.toks.charAt(0) === firstCh &&
                         !(firstCh === 'q' && chars.indexOf('t') >= 0);
          B = dropLetter(first, x0 + order[0] * spread, y0, anchorOK);
        } else if (firstIsSpecial) {
          B = dropLetter(first, x0 + order[0] * spread, y0, undefined, 0, 0);
        } else attach(B, first);
      }
      var made = first ? [{ d: first, x: x0 + order[0] * spread, y: y0 }] : [];
      for (var k = 1; k < order.length; k++) {
        var idx = order[k], ch = chars[idx], lx = x0 + idx * spread;
        var L = GD(ch);
        L.pop = 0;
        freeLetter(L, lx, y0, 0, 0, 1);
        made.push({ d: L, x: lx, y: y0 });
        var before = bodies.length;
        var tb = dropLetter(L, lx, y0);

        // "这组字形做出来的体"分三级找：字母还属于某个体 > 本次新造的体 > 组合上报的体
        // （gt→v 会把 g 吃掉、qt→I 改的是老体，都不能只靠字母反查）
        var owner = (L.body && bodies.indexOf(L.body) >= 0) ? L.body
                  : ((tb && bodies.indexOf(tb) >= 0) ? tb
                  : ((bodies.length > before) ? bodies[bodies.length - 1] : null));
        if (owner) B = owner;
      }

      if (!B || bodies.indexOf(B) < 0) {
        for (var m2 = made.length - 1; m2 >= 0; m2--) {
          var ob = made[m2].d.body;
          if (ob && bodies.indexOf(ob) >= 0) { B = ob; break; }
        }
      }
      if (!B || bodies.indexOf(B) < 0) return null;
      var id = bodies.indexOf(B);
      // 先改初速度/朝向，再 refresh，最后取快照 —— 否则快照里的 gravMode 会是旧的
      if (o.vx != null) B.vx = o.vx;
      if (o.vy != null) B.vy = o.vy;
      if (o.th != null) B.th = o.th;
      refresh(B);
      /* 把**没被任何体收下**的残留字母清掉（被收下的字母属于某个体，绝不能杀）。
         ⚠ **但绝不能杀掉这次真正拼出来的那个体**（2026-09-30 符号扩展的坑）：
         E=ΔΦ/Δt 这类"场符号打头"的写法里，第一个字形先被当锚点挂着、后面并入成功时
         锚点体已经被它自己的字形认领（`dd.body` 指向锚点体），这里再去杀就会把
         刚拼好的 EΔΦt body 一起拆掉 —— 表现是 addBody(['E','Δ','Φ','t']) 只剩一个
         孤零零的 E（field 体）。判据：这个字形属于**当前结果体 B** 就留着。 */
      for (var z2 = 0; z2 < made.length; z2++) {
        var dd = made[z2].d;
        if (!dd || dd.dead) continue;
        if (dd === B) continue;                       // 结果体自身（场符号锚点路径）
        if (dd.body && bodies.indexOf(dd.body) >= 0) continue;
        if (dd.arrow && dd.state === 'free') continue;   // 箭头是台上独立字形，不收进体
        var fi = freeL.indexOf(dd); if (fi >= 0) freeL.splice(fi, 1);
        killLetter(dd);
      }
      /* 摆开一点：addBody 常用于"一次摆好几个公式"（预设、探针、上课举例），
         每个体的空格不同（F=ma 是三个字形、GMm/r² 是分数），落在同一个网格上
         很容易互相压住 —— 这里把新体挪到空白处。
         ⚠ 但**两个都是 addBody 摆出来的体之间不挪**：连着两次 addBody 写在同一个
         坐标上，原来的语义就是"合成同一个体"（A14b 就是这样拿 ½mv² 的）；
         一挪反而凭空多出一坨。所以只跟"不是 addBody 摆出来的"体（玩家拖出来的、
         预设里的、碎裂后的）做分离。 */
      if (!B.draft) {
        for (var sep = 0; sep < 24; sep++) {
          var hit = null;
          for (var bi = 0; bi < bodies.length; bi++) {
            var O = bodies[bi];
            if (O === B || O.kind === 'B' || O.kind === 'E' || O.draft) continue;
            var ox = Math.abs(O.x - B.x), oy = Math.abs(O.y - B.y);
            if (ox < (O.hw + B.hw + 16) && oy < (O.hh + B.hh + 16)) { hit = O; break; }
          }
          if (!hit) break;
          B.y -= (hit.hh + B.hh + 20);
          if (B.y < B.hh + 20) { B.y = hit.y; B.x += (hit.hw + B.hw + 22); }   // 顶到上边界就改往右让
        }
        refresh(B);
      }

      B.draft = true;    // 标记：这个体是 addBody 摆出来的（分离逻辑会跳过它）
      var snap = bodyState(B);
      snap.id = id;
      return snap;
    }

    /* 按 id 取活体（预设内部用：预设要改的是真体，不是快照对象） */
    function liveBody(idOrSnap) {
      if (idOrSnap == null) return null;
      if (typeof idOrSnap === 'number') return bodies[idOrSnap] || null;
      if (typeof idOrSnap.id === 'number') return bodies[idOrSnap.id] || null;
      return null;
    }

    /* dropLetter：把"松手"那一刻的全部判定跑一遍（与 pointerup 的字母分支同构）。
       返回值 = 这次落字**作用到的体**，没有就是 null。
       为什么要返回：t 的三条组合（gt→v / qt→I / vt→板）会"吃掉"原来的字母、
       body 引用随之清空，上层（addBody）不能靠字母反查体，只能由这里如实上报。 */
    /* ---- 参数默认值表（2026-09-30 移植清单 P2-11，参数药丸与 = 变换共用）----
       只有课本里本来就可调的量；val 是默认读数、lo/hi/step 是药丸的拖动范围。
       药丸拖到的值写进体自己的 eqState（Rset/Uset 另加镜像），不碰这张表。 */
    var VAL_DEF = {
      /* ⚠ R 是**对数刻度**（lo/hi 跨 0.05 ~ 1e6，7 个数量级），别改成线性的：
         断路判据是 `S.R >= 1e6`（见 eqStepOnce 的 ohm 分支），而线性量程上界原来
         只有 40 Ω —— 差 25000 倍，药丸拖到底也够不到断路，于是"R 拖到最大 = 断路"
         这个状态在界面上**根本不存在**（AGENTS §12 第 3 条：够不到的状态也算缺陷）。
         电阻本身在物理上就是跨数量级的量，对数刻度是它正确的表示法：
         左端 0.05 Ω = 短路、右端 1e6 Ω = 断路，两端都能用手指拖到。 */
      'R': { val: 2, lo: 0.05, hi: 1e6, step: 0.05, log: true, unit: '\u03A9' },
      'U': { val: 6, lo: 0, hi: 60, step: 0.2, unit: 'V' },
      'I': { val: 3, lo: 0, hi: 60, step: 0.1, unit: 'A' },
      'q': { val: 2, lo: 0, hi: 50, step: 0.1, unit: 'C' },
      'm': { val: 1, lo: 0.2, hi: 20, step: 0.1, unit: 'kg' },
      'M': { val: 1, lo: 0.2, hi: 20, step: 0.1, unit: 'kg' },
      'v': { val: 5, lo: 0, hi: 60, step: 0.5, unit: 'm/s' },
      'F': { val: 10, lo: 0, hi: 100, step: 0.5, unit: 'N' },
      'f': { val: 2, lo: 0, hi: 50, step: 0.2, unit: 'N' },
      'N': { val: 10, lo: 0, hi: 100, step: 0.5, unit: 'N' },
      'k': { val: 40, lo: 1, hi: 400, step: 1, unit: 'N/m' },
      'C': { val: 2, lo: 0.05, hi: 20, step: 0.05, unit: 'F' },
      'L': { val: 0.4, lo: 0.02, hi: 10, step: 0.02, unit: 'm' },
      'B': { val: 0.5, lo: 0, hi: 5, step: 0.01, unit: 'T' },
      't': { val: 1, lo: 0.1, hi: 20, step: 0.1, unit: 's' },
      'T': { val: 2, lo: 0.1, hi: 20, step: 0.1, unit: 's' },
      'x': { val: 2, lo: 0, hi: 40, step: 0.1, unit: 'm' },
      'h': { val: 2, lo: 0, hi: 30, step: 0.1, unit: 'm' },
      'S': { val: 2, lo: 0.05, hi: 40, step: 0.05, unit: 'm\u00B2' },
      'A': { val: 3, lo: 0, hi: 40, step: 0.1, unit: 'm' },
      's': { val: 5, lo: 0, hi: 60, step: 0.5, unit: 'm' },
      'r': { val: 2, lo: 0.1, hi: 20, step: 0.1, unit: 'm' },
      'e': { val: 1, lo: 0, hi: 1, step: 0.05, unit: '' },
      /* ⚠⚠ 这几个键**必须写成希腊字母本身**（'μ'/'θ'…），不能写 `MU:` / `NU:` 这种
         标识符名（2026-10-01 修）。为什么：ES5 的对象字面量里 `MU:` 就是**名为 "MU"
         的键**，不是"变量 MU 的值"（那是 ES6 的计算属性 `[MU]:`）。而全模块的查表一律
         传**字符**（numOfGlyph(B,'ν')、buildPills 的 VAL_DEF[glyph.type]）——
         键名对不上 → numOfGlyph 一路掉到 `return 1`、药丸也建不出来。
         实测后果（第三批验收 ③ 红）：`E能 = hν − W` 里 ν 恒为 1（h=6.63 时
         E = 6.63×1−10 = −3.37 → escape 恒 0，逸出永不发生）；同理 μ/θ/ω/η/ε/Φ/ρ/λ
         在公式里读到的也全是 1，而不是各自的课本默认值。 */
      '\u03BC': { val: 0.2, lo: 0, hi: 1, step: 0.01, unit: '' },
      '\u03B8': { val: 0.3, lo: 0, hi: 1.5, step: 0.01, unit: 'rad' },
      '\u03C9': { val: 3.14, lo: 0.1, hi: 20, step: 0.1, unit: 'rad/s' },
      '\u03B7': { val: 0.8, lo: 0, hi: 1, step: 0.01, unit: '' },
      'Q': { val: 4, lo: 0, hi: 200, step: 0.2, unit: 'C' },
      'W': { val: 10, lo: 0, hi: 500, step: 0.5, unit: 'J' },
      'P': { val: 12, lo: 0, hi: 400, step: 0.5, unit: 'W' },
      '\u03B5': { val: 9, lo: 0, hi: 60, step: 0.2, unit: 'V' },
      'E': { val: 4, lo: 0, hi: 60, step: 0.2, unit: 'V/m' },
      '\u03C1': { val: 1.7, lo: 0, hi: 40, step: 0.1, unit: '' },
      '\u03BB': { val: 2, lo: 0.05, hi: 40, step: 0.05, unit: 'm' },
      '\u03BD': { val: 3, lo: 0.1, hi: 60, step: 0.1, unit: 'Hz' },
      '\u03A6': { val: 1, lo: 0, hi: 40, step: 0.1, unit: 'Wb' },
      PHI2: { val: 3, lo: 0, hi: 60, step: 0.2, unit: 'V' },
      'n': { val: 1.5, lo: 1, hi: 4, step: 0.01, unit: '' },
      'g': { val: 9.8, lo: 0.1, hi: 30, step: 0.1, unit: 'm/s\u00B2' },
      'a': { val: 2, lo: 0, hi: 40, step: 0.2, unit: 'm/s\u00B2' },
      /* 第三批新字形（2026-10-01，托盘 62） */
      'V': { val: 2, lo: 0.05, hi: 40, step: 0.05, unit: 'm\u00B3' },
      'd': { val: 2, lo: 0.05, hi: 40, step: 0.05, unit: 'm' },
      'c\u6bd4': { val: 4200, lo: 100, hi: 8400, step: 50, unit: 'J/(kg\u00B7\u00B0C)' },
      'p\u538b': { val: 100000, lo: 10000, hi: 1000000, step: 10000, unit: 'Pa' },
      '\u03bb\u7194': { val: 334000, lo: 10000, hi: 1000000, step: 10000, unit: 'J/kg' },
      'E\u80fd': { val: 3, lo: 0, hi: 100, step: 0.5, unit: 'J' }
    };
    function numOfGlyph(B, ch) {
      var S = B.eqState;
      if (S && typeof S[ch] === 'number') return S[ch];
      var d = VAL_DEF[ch];
      return d ? d.val : 1;
    }
    /* 这条公式的"结果量"数值（= 两侧共用的值 —— 等号两边的式子本来就相等，
       所以 before 与 after 恒等，|Δ| = 0 就是"数值守恒"）。 */
    function eqValueOf(B) {
      eqInitState(B);
      var S = B.eqState, id = B.eq;
      var m = numOfGlyph(B, 'm'), v = numOfGlyph(B, 'v'), F = numOfGlyph(B, 'F'), a = numOfGlyph(B, 'a'),
          U = numOfGlyph(B, 'U'), I = numOfGlyph(B, 'I'), R = numOfGlyph(B, 'R'), q = numOfGlyph(B, 'q'),
          Bf = numOfGlyph(B, 'B'), L = numOfGlyph(B, 'L'), t = numOfGlyph(B, 't'), x = numOfGlyph(B, 'x'),
          k = numOfGlyph(B, 'k'), C = numOfGlyph(B, 'C'), W = numOfGlyph(B, 'W'),
          s = numOfGlyph(B, 's'), N = numOfGlyph(B, 'N'), mu = numOfGlyph(B, MU), h = numOfGlyph(B, 'h'),
          T = numOfGlyph(B, 'T'), lam = numOfGlyph(B, LAMBDA), f = numOfGlyph(B, 'f'), nu = numOfGlyph(B, NU),
          Phi = numOfGlyph(B, PHI), S2 = numOfGlyph(B, 'S'), rho = numOfGlyph(B, RHO),
          Q = numOfGlyph(B, 'Q'), eta = numOfGlyph(B, ETA), omega = numOfGlyph(B, OMEGA), theta = numOfGlyph(B, THETA);
      if (id === 'newton2') return (typeof S.F === 'number') ? S.F : m * a;
      if (id === 'work') return (typeof S.W === 'number') ? S.W : F * s;
      if (id === 'momentum') return m * v;
      if (id === 'weight') return (typeof S.N === 'number') ? S.N : m * 9.8;
      if (id === 'friction') return mu * N;
      if (id === 'hooke') return (typeof S.F === 'number') ? S.F : k * x;
      if (id === 'circular') return (typeof S.omega === 'number') ? S.omega : (2 * Math.PI / Math.max(0.4, T));
      if (id === 'eff') return eta * W;
      if (id === 'powerW') return W / Math.max(0.05, t);
      if (id === 'kinetic') return 0.5 * m * v * v;
      if (id === 'potential') return m * 9.8 * h;
      if (id === 'delta' || id === 'coscomp') return 0;
      if (id === 'ohm') return U;
      if (id === 'powerE') return U * I;
      if (id === 'joule') return I * I * R * t;
      if (id === 'charge') return I * t;
      if (id === 'emf') return U + I * numOfGlyph(B, 'r');
      if (id === 'cap') return C * U;
      if (id === 'faraday') return (typeof S.eps === 'number') ? S.eps : 0;
      if (id === 'resis') return rho * L / Math.max(0.05, S2);
      if (id === 'field') return F / Math.max(1e-6, q);
      if (id === 'ampere') return Bf * I * L;
      if (id === 'lorentz') return q * v * Bf;
      if (id === 'epot') return q * U;
      if (id === 'flux') return Bf * S2;
      if (id === 'wave') return lam * f;
      if (id === 'photon') return h * nu;
      /* 第三批（2026-10-01）：等号两侧的"结果量" */
      if (id === 'heatmass') return numOfGlyph(B, 'Q');
      if (id === 'melt') return numOfGlyph(B, 'Q');
      if (id === 'thermal-balance') return numOfGlyph(B, 'Q');
      if (id === 'ideal-gas' || id === 'isothermal' || id === 'isochoric') return numOfGlyph(B, 'p\u538b');
      if (id === 'uniform-field') return numOfGlyph(B, 'U');
      if (id === 'impetus') return numOfGlyph(B, 'F') * numOfGlyph(B, 't');
      if (id === 'buoyancy') return numOfGlyph(B, 'F');
      if (id === 'pressure') return numOfGlyph(B, 'p\u538b');
      if (id === 'photoelectric') return numOfGlyph(B, 'E\u80fd');
      return 0;
    }
    /* 每条公式**左侧**的主符号（2026-10-01 用户澄清 = 的方向是**右→左**：
       '=' 放上去时把右侧表达式收成左侧这个量；再碰一次拆回右侧）。 */
    var LEAD_OF = { newton2: 'F', work: 'W', momentum: 'p', weight: 'N', friction: 'f', hooke: 'F',
      circular: OMEGA, eff: ETA, powerW: 'P', kinetic: HALF, potential: 'm', delta: DELTA, coscomp: 'F',
      ohm: 'U', powerE: 'P', joule: 'Q', charge: 'Q', emf: EPS, cap: 'C', faraday: 'E', resis: 'R',
      field: 'E', ampere: 'F', lorentz: 'F', epot: 'W', flux: PHI, wave: 'v', photon: EPS,
      heatmass: 'Q', melt: 'Q', 'thermal-balance': 'Q', 'ideal-gas': 'p\u538b', isothermal: 'p\u538b',
      isochoric: 'p\u538b', 'uniform-field': 'U', impetus: DELTA, buoyancy: 'F', pressure: 'p\u538b',
      photoelectric: 'E\u80fd' };
    /* "右侧表达式"索引（2026-10-01 = 右→左收敛）：键 = toks 去掉 lead 之后的规范键。
       例如 ohm：{I,R} → '=' 放上去收成 U。冲突（两个公式同右式）登记时抛错。 */
    var PARAMS_BY_SIG = {};
    (function () {
      for (var i = 0; i < EQUATIONS.length; i++) {
        var e = EQUATIONS[i];
        var lead = LEAD_OF[e.id];
        if (lead == null) continue;
        var ps = '', removed = false;
        for (var k = 0; k < e.toks.length; k++) {
          var c = e.toks.charAt(k);
          if (!removed && c === lead.charAt(0)) { removed = true; continue; }
          ps += c;
        }
        if (removed) {
          var sig = sigOfToks(ps);
          if (PARAMS_BY_SIG[sig]) throw new Error('psandbox: 右式签名冲突 ' + e.id + ' vs ' + PARAMS_BY_SIG[sig].id);
          PARAMS_BY_SIG[sig] = e;
        }
      }
    })();
    /* = 的"这一侧"淡出（2026-10-01 右→左语义）：paramSide 1 = 左侧量显示（lead 亮、
       右式淡出）；paramSide 0 = 右式显示（lead 淡出）。½ 是分数结构字形，不淡出。 */
    function applySideFade(B) {
      var lead = B.eq ? LEAD_OF[B.eq] : null;
      var fadeLead = (B.paramSide !== 1);
      var fadeRest = (B.paramSide === 1);
      if (lead === HALF) fadeLead = false;
      for (var i = 0; i < B.mem.length; i++) {
        var g = B.mem[i];
        if (g.type === lead) g.fade = fadeLead ? 0.14 : null;
        else g.fade = fadeRest ? 0.14 : null;
      }
      if (B.massG) {
        var m2 = B.massG;
        if (m2.type === lead) m2.fade = fadeLead ? 0.14 : null;
        else m2.fade = fadeRest ? 0.14 : null;
      }
    }
    function findFormulaBodyNear(L) {
      var best = null, bd = MERGE_R_EQ;
      for (var i = 0; i < bodies.length; i++) {
        var B = bodies[i];
        /* 2026-10-01（= 右→左）：目标可以是**已成式的公式体**，也可以是
           "右侧表达式体"（字母集合 = 某条公式去掉左侧量，如 IR → ohm）。 */
        if (!B.eq && !PARAMS_BY_SIG[sigOfToks(toksOfBody(B))]) continue;
        if (B.kind || B.bh) continue;
        var d = Math.hypot(B.x - L.wx, B.y - L.wy);
        if (d < bd) { bd = d; best = B; }
      }
      return best;
    }
    /* = 变换器（2026-10-01 用户澄清方向：**右 → 左**）。
       不放 =：右侧表达式（IR）保持原样；把 = 放上去：整个右式收成左侧的量
       （IR → U，卡片 U = IR，数值守恒 |Δ|=0）；再碰一次 = 反向拆开（U → IR）。
       不做复杂形变 —— 沿用旧版简单观感：旧 pop/环 + 旧 fade 通道淡出另一侧。
       不成式（既不是公式体、右式也对不上任何公式）不转换、不报错。 */
    function transformBody(B) {
      var E3 = null, fromExpr = false;
      if (B.eq) {
        E3 = EQ_BY_SIG[sigOfToks(toksOfBody(B))] || null;
      }
      if (!E3) {
        E3 = PARAMS_BY_SIG[sigOfToks(toksOfBody(B))] || null;
        fromExpr = !!E3;
      }
      if (!E3) return false;   // 不成式：不转换、不报错
      B.eq = E3.id; B.eqText = E3.text;
      B.paramSide = B.paramSide ? 0 : 1;      // 再碰一次 = 反向（拆回右式）
      eqInitState(B);
      var before = eqValueOf(B);
      var after = eqValueOf(B);
      B._cons = { before: before, after: after, d: Math.abs(before - after) };
      eqEmit('transform', B, { eq: B.eq, before: before, after: after, d: B._cons.d, side: B.paramSide });
      opLog('transform', { before: before, after: after, d: B._cons.d });   // 操作日志（2026-10-01）
      addLog(B.eqText + ' \u4e24\u4fa7\u4e92\u6362\uff08\u6570\u503c\u5b88\u6052\uff0c\u5dee ' + B._cons.d + '\uff09');
      if (fromExpr) {
        /* 右式 → 左侧量：造一个 lead 字形挂上（IR 收成 U）。attach 会 refresh，
           setF 认得"同一公式"从而保留 paramSide=1 并套用左侧淡出。 */
        var lead = LEAD_OF[E3.id] || null;
        var hasLead = false;
        for (var gi = 0; gi < B.mem.length; gi++) if (B.mem[gi].type === lead) hasLead = true;
        if (B.massG && B.massG.type === lead) hasLead = true;
        if (lead && !hasLead) {
          var ng = GD(lead); ng.pop = 0;
          attach(B, ng);
        } else {
          applySideFade(B);
          B.pop = 1; ringGo(B.x, B.y);
        }
      } else {
        applySideFade(B);
        B.pop = 1; ringGo(B.x, B.y);
      }
      return true;
    }

    /* 游离字形升格成体 / 撤销升格（真拖与 API 共用同一套写法） */
    function promoteFree(d) {
      var fi = freeL.indexOf(d); if (fi >= 0) freeL.splice(fi, 1);
      var nb = BODY(d.wx, d.wy);
      d.pop = 0; d.body = nb; d.inBody = true;
      nb.massG = d; nb.glyphs = [d]; nb.mem = [d];
      if (d.type === DIV) divTurnOn(nb, d);   // ★ 升格出来的体带 ÷：当场就是手写分数
      refresh(nb);
      return nb;
    }
    function demoteFree(d, nb) {
      var ri = bodies.indexOf(nb); if (ri >= 0) bodies.splice(ri, 1);
      d.body = null; d.inBody = false; d.pop = 0;
      if (freeL.indexOf(d) < 0) freeL.push(d);
      placeLetter(d);
    }

    /* dropLetter：把"松手"那一刻的全部判定跑一遍（真拖 pointerup 与 addBody **共用**，
       不再各写一份）。返回值 = 这次落字**作用到的体**，没有就是 null。
       为什么要返回：t 的三条组合（gt→v / qt→I / vt→板）会"吃掉"原来的字母、
       body 引用随之清空，上层（addBody）不能靠字母反查体，只能由这里如实上报。
       fvx/fvy：真拖路径传快甩初速度（只喂给场体 spawnField；addBody 不传 = 0）。 */
    function dropLetter(L, lx, ly, firstOfGroup, fvx, fvy) {
      L.wx = lx; L.wy = ly;

      /* ★ 等号变换器：成式后把 '=' 拖到公式体上 -> 边→边变换；再碰一次 = 换边。
         不成式：不转换、不报错，继续走普通运算符并入（F+=+m+a 里的 = 只是写法）。 */
      if (L.ch === EQ) {
        var eqt = findFormulaBodyNear(L);
        if (eqt) { transformBody(eqt); killLetter(L); return eqt; }
      }
      /* ★ 箭头（P2-10）：永不并入任何体 —— 它是台上独立可旋转的字形，自己射射线 */
      if (L.ch === ARROW) {
        L.state = 'free';
        L.vx = 0; L.vy = 0;
        L.arrow = true; L.rot = 0;
        if (freeL.indexOf(L) < 0) freeL.push(L);
        placeLetter(L);
        return null;
      }
      if (L.ch === 'B' || L.ch === 'q' || L.ch === 'I' || L.ch === 'E') {
        /* ★ 场符号也要先试一次"并入课本公式"（2026-09-30 符号扩展）。
           为什么：B/q/I/E 原来是**无条件**各自生成场体，所以 U+I、Q+I、ε+U+I+r
           这些电磁学式子里的 I 永远并不进 U/Q 的体 —— 公式永远拼不齐。
           现在先走一次合并判定（canMerge 里对场符号有专门闸门：只有"字母集合仍被
           某条课本公式容纳"时才允许并入），能并就并；并不能才回到"生成场体"的原路。
           既有行为不受影响：B/E 不在任何公式里，q 的公式只有 E=F/q，
           单独落一个场符号时 findMergeTarget 返回 null，照旧生成场体。 */
        if (firstOfGroup) {
          /* 把**这个字形本身**当基础挂到一个空体上（它就是那一笔，不要另造一个，
             否则会多出一个看不见的重复字形）。massG 必须一起设：排版与
             toksOfBody 都要读它，缺了它 hRun 会对 null 取 .m 而抛异常。 */
          var fb = BODY(L.wx, L.wy);
          var fi0 = freeL.indexOf(L); if (fi0 >= 0) freeL.splice(fi0, 1);
          L.body = fb; L.inBody = true; L.state = 'mem'; L.pop = 0;
          fb.massG = L; fb.glyphs = [L]; fb.mem = [L];
          refresh(fb);
          /* 顺手把附近游离的同类字形也并进来。
             为什么需要：GD() 造字形时会把同一个字符的所有字形都 append 到 table，
             addBody 又是"先全部造出来、再逐个 drop" —— 造第二个 v 时第一个 v 已经在
             freeL 里了，于是 'v'+'v' 的第二次 drop 有可能自己跟自己合成。这里对
             **同一批还没装配的游离字形**做一次合并，既补上这种情形，也让
             addBody(['m','v','v','r']) 这类多字母写法更稳。判据仍走 canMerge。 */
          for (var fl2 = freeL.length - 1; fl2 >= 0; fl2--) {
            var cand = freeL[fl2];
            if (!cand || cand.dead || cand === L) continue;
            if (Math.hypot(cand.wx - fb.x, cand.wy - fb.y) > 160) continue;
            if (canMerge(fb, cand)) attach(fb, cand);
          }
          ringGo(fb.x, fb.y);
          return fb;
        }
        if (!L.ch) { var FBx = spawnField(L.ch, L.wx, L.wy, 0, 0); killLetter(L); return FBx; }
        /* ★ 优先级（2026-09-30 加法式改法，用户裁决的三条组合靠它成立）：
             ① **能成全公式 -> 优先并入**：先试 findMergeTarget（canMerge 里对场符号
                的闸门是"收下后仍被某条公式容纳"，所以只有真在拼公式时才会放行）；
             ② 游离字形之间也能并（I+U+R 的 I 要先与游离 U 合成体，findFreeFormulaTarget）；
             ③ 场体目标也能溶回字形（I 打头 + U 落在 I 场体上，findDissolveTarget）；
             ④ **落空处 -> 生成场体**：合并失败才走原来的 spawnField。
           为什么原来不行：B/E 在这之前就**无条件**生成场体（`if (L.ch === 'B' || …) return FB0`），
           连合并的机会都没有 —— 于是把 B 拖到 F I L 上永远只是"多了一个磁场"，
           拼不出 F=BIL；`addBody(['F','B','I','L'])` 也只会得到 FIL + 一个 B 场体。
           ⚠ 这条是**纯加法**：单独落一个 B/E（附近没有能收它的体）时三条合并
           都返回 null，走的还是原来那条 spawnField —— 已发布语义一字未变（探针有断言）。 */
        var FBs = findMergeTarget(L);
        if (FBs) { attach(FBs, L); return FBs; }
        var FFf = findFreeFormulaTarget(L);
        if (FFf) {
          var nbF2 = promoteFree(FFf);
          if (canMerge(nbF2, L)) { attach(nbF2, L); ringGo(nbF2.x, nbF2.y); }
          else demoteFree(FFf, nbF2);
          if (L.body || L.dead) return L.body || null;
        }
        var FBd2 = findDissolveTarget(L);
        if (FBd2) { return dissolveField(FBd2, L); }
        if (L.ch === 'B' || L.ch === 'E') {
          var FB0 = spawnField(L.ch, L.wx, L.wy, fvx || 0, fvy || 0);
          killLetter(L);
          return FB0;
        }
        var FB = spawnField(L.ch, L.wx, L.wy, fvx || 0, fvy || 0);
        killLetter(L);
        return FB;
      }
      var tc = findTComboTarget(L);
      if (tc) {
        var TB = applyTCombo(L, tc);   // applyTCombo 返回它作用的体
        return TB;
      }
      var B2 = findMergeTarget(L);

      if (B2) { attach(B2, L); return B2; }

      var FF2 = findFreeFormulaTarget(L);
      if (FF2) {
        var nbF = promoteFree(FF2);
        if (canMerge(nbF, L)) { attach(nbF, L); ringGo(nbF.x, nbF.y); }
        else demoteFree(FF2, nbF);
        if (L.body || L.dead) return L.body || null;
      }

      var FBd = findDissolveTarget(L);
      if (FBd) { return dissolveField(FBd, L); }

      var FM = findFreeMassTarget(L);
      if (FM) {
        var nb = promoteFree(FM);
        if (canMerge(nb, L)) { attach(nb, L); ringGo(nb.x, nb.y); return nb; }
        demoteFree(FM, nb);
      }

      /* ★ ÷ 也走这条：**单独把一个 ÷ 丢到空处 = 当场出现一条空分数横线**
         （不然它就是一颗飘着的算符，玩家没有可瞄的目标 —— 用户要的是"÷ = 分数结构"）。
         空分子/空分母照样画横线，长度取 DIV_MBAR。 */
      if (isMass(L) || L.type === 'G' || L.type === DIV) {
        var nb2 = BODY(L.wx, L.wy);
        L.pop = 0; L.body = nb2; L.inBody = true;
        if (isMass(L)) { nb2.massG = L; nb2.glyphs = [L]; refresh(nb2); }
        else { nb2.glyphs = [L]; attach(nb2, L); }
        ringGo(nb2.x, nb2.y);
        return nb2;
      }
      L.state = 'free';
      L.vx = 0; L.vy = 0;
      if (freeL.indexOf(L) < 0) freeL.push(L);
      placeLetter(L);
      return null;
    }

    /* ---------------- 预设（每个都摆成**立刻能看**的初态） ----------------
       注意：预设改的是**活体**（bodies[id]），不是 addBody 返回的快照对象。 */
    function setVel(st, vx, vy) {
      var B = liveBody(st);
      if (!B) return;
      B.vx = vx; B.vy = vy;
    }
    function presetNewtons2() {
      // F=ma 的方向性：a 块沿 θ 加速（θ 指右上）—— 摆上去就斜着加速出去
      var b = addBody(['m', 'a'], { x: Math.round(W * 0.26), y: Math.round(H * 0.30), spread: AB_PITCH });
      var B = liveBody(b);
      if (B) B.th = -0.45;
      return { bodies: [b] };
    }
    function presetEnergy() {
      // ½mv² 整块：E_k = ½mv² —— 给一个斜向初速度扔出去撞墙
      // （撞碎会飘出弹性碰撞公式碎片，正好是动量守恒那一课的开场）
      var b = addBody(['\u00BD', 'm', 'v', 'v'], { x: Math.round(W * 0.30), y: Math.round(H * 0.24), spread: AB_PITCH });
      setVel(b, 520, -260);
      return { bodies: [b] };
    }
    function presetCircular() {
      // m v²/r 两块 -> 双星互绕（m₁r₁=m₂r₂、ω∝√(m总/间距)）：两块轻微反向起步，配对后立刻转起来。
      // 位置往下放：这对体成对后会绕共同质心转、半径还会长到 target(80~300)，
      // 摆太高会顶到工具栏/字形面板（面板在右上角）。
      var b1 = addBody(['m', 'v', 'v', 'r'], { x: Math.round(W * 0.30), y: Math.round(H * 0.46), spread: AB_PITCH });
      var b2 = addBody(['m', 'v', 'v', 'r'], { x: Math.round(W * 0.30 + 150), y: Math.round(H * 0.46), spread: AB_PITCH });
      setVel(b1, 0, -70);
      setVel(b2, 0, 70);
      return { bodies: [b1, b2] };
    }
    function presetGravity() {
      // GMm/r² 引力井 + 旁边一个 m 块被吸进去（给一点横向初速度 -> 弧线坠入）。
      // m 块放在井的右下方：右上角那片是字形托盘（约 x>0.72W 且 y<0.42H），
      // 摆在那儿会被托盘整个盖住 —— 探针统计得到"没被吸引"，其实是被挡住了。
      var well = addBody(['G', 'M', 'm', 'r'], { x: Math.round(W * 0.28), y: Math.round(H * 0.42), spread: AB_PITCH });
      var mb = addBody(['m'], { x: Math.round(W * 0.55), y: Math.round(H * 0.62), spread: AB_PITCH });
      setVel(mb, -40, 0);
      return { bodies: [well, mb] };
    }
    function presetFreefall() {
      // 自由落体：g 在台面上（它就是"重力加速度"那个 g），m 在它上方。
      // 注意一个物理设定（沿用原作）：**只有接了 g 的体才受重力**（hasG）——
      // 裸 m 不受重力，因为"质量"本身不是"重力"。所以这里摆 m + g 两块，
      // 并给 m 一个向下的初速度，让它当着 g 的面落下来。
      var gb = addBody(['g'], { x: Math.round(W * 0.30), y: Math.round(H * 0.52), spread: AB_PITCH });
      var mb = addBody(['m'], { x: Math.round(W * 0.42), y: Math.round(H * 0.14), spread: AB_PITCH });
      setVel(mb, 0, 90);
      return { bodies: [mb, gb] };
    }
    var PRESETS = {
      'newton2': presetNewtons2,
      'energy': presetEnergy,
      'circular': presetCircular,
      'gravity': presetGravity,
      'freefall': presetFreefall
    };
    function applyPreset(key) {
      if (!key) return null;
      key = String(key).toLowerCase();
      var fn = PRESETS[key];
      if (!fn) return null;                 // 未知 preset：正常空场，不报错
      clearAll();
      resize();
      tWorld = 0;
      opLog('preset', { key: key });        // 操作日志（2026-10-01）
      return { key: key, made: fn() };
    }

    /* ---------------- 工具条 / 对外接口 ---------------- */
    function addLog(msg) {
      logEl.textContent = msg;
      logEl.classList.add('on');
      clearTimeout(addLog._t);
      addLog._t = setTimeout(function () { if (alive) logEl.classList.remove('on'); }, 1400);
    }
    onEv(bEmpty, 'click', function () { clearAll(); addLog('\u5df2\u6e05\u7a7a'); });
    onEv(bCollect, 'click', function () { collectToPanel(); addLog('\u5df2\u5168\u90e8\u6536\u56de\u9762\u677f'); });
    onEv(bReset, 'click', function () {
      clearAll();
      tWorld = 0;
      var k = opts.preset;
      if (k) applyPreset(k);
      addLog('\u5df2\u91cd\u7f6e');
    });
    onEv(window, 'resize', resize);

    /* 操作日志载入 + 面板 56 个字形 + 成就面板 + 起循环（2026-10-01） */
    oplogLoad();
    opLog('mount');
    rebuildPanel();
    buildAchv();
    resize();
    requestAnimationFrame(frame);
    if (opts.preset) applyPreset(opts.preset);

    function unmount() {
      alive = false;
      opLog('unmount');   // 操作日志（2026-10-01）
      if (rafId) { try { cancelAnimationFrame(rafId); } catch (e) { /* 忽略 */ } rafId = 0; }
      offAll();
      clearTimeout(addLog._t);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (achvEl && achvEl.parentNode) achvEl.parentNode.removeChild(achvEl);   // 成就是 body 直挂的，单独拆
      // 断开所有引用，让这次 mount 的整套闭包可以整体回收
      ALL = []; freeL = []; bodies = []; formulas = []; particles = [];
      P = {};
      achvEl = null;
      // 通知宿主收尾（观澜靠它把舞台类名/提示行/按钮文案还原）。
      // 无论 unmount() 是谁调的（按钮、切科目、探针直接调），宿主都必须收干净。
      if (typeof opts.onUnmount === 'function') {
        try { opts.onUnmount(); } catch (e) { /* 宿主收尾失败不影响拆解 */ }
      }
    }

    return {
      unmount: unmount,
      root: overlay,
      applyPreset: applyPreset,
      addBody: addBody,
      bodies: function () {
        var out = [];
        for (var i = 0; i < bodies.length; i++) out.push(bodyState(bodies[i]));
        return out;
      },
      clear: function () { clearAll(); return { bodies: bodies.length, free: freeL.length }; },
      collect: function () { return collectToPanel(); },
      stepOnce: function (dt) {
        dt = (dt == null) ? (1 / 60) : Number(dt);
        if (!(dt > 0)) dt = 1 / 60;
        if (dt > 0.05) dt = 0.05;
        stepFrame(dt);
        return { t: tWorld, bodies: bodies.length, free: freeL.length, particles: particles.length };
      },
      state: function () {
        var docked = 0;
        var ch = panel.querySelectorAll('.ps-char');
        for (var i = 0; i < ch.length; i++) { var r = ch[i]._letterRef; if (r && r.state === 'dock') docked++; }
        return {
          build: BUILD,
          mounted: true,
          W: W, H: H, groundY: groundY, t: tWorld,
          bodies: bodies.length, freeLetters: freeL.length,
          formulas: formulas.length, particles: particles.length,
          panelLetters: docked,
          paused: !running,
          preset: opts.preset || '',
          presetKeys: ['newton2', 'energy', 'circular', 'gravity', 'freefall'],
          domNodes: overlay.getElementsByTagName('*').length + 1
        };
      },
      /* letters()：场上**游离**的字形（原有语义，一个字段都没改）。
         ★ 2026-09-30 移植清单 P1-5：坐标是**实时**坐标 —— 游离字形用 wx/wy
         （stepPhysics 每帧推进，松手后不会再改写过期的旧坐标），探针"瞄着实时
         位置丢"靠的就是这份读数。体里的字形不进这个数组（既有语义：探针数
         "游离"个数靠它；体字形的实时位置按既有惯例从 DOM rect 读）。
         ★ 额外挂一个 `palette` 字段（数组的附加属性，不改返回类型）：符号扩展后
         （45 → 56）探针与上层页面需要一个稳定的读取口，不能靠数 DOM。 */
      letters: function () {
        var out = [];
        for (var i = 0; i < freeL.length; i++) {
          var d = freeL[i];
          out.push({ ch: d.ch, x: d.wx, y: d.wy, state: d.state,
                     temp: (d.temp == null ? 20 : +d.temp.toFixed(3)) });
        }
        out.palette = paletteList();
        return out;
      },
      /* palette()：托盘的完整符号清单（只读）。每项 { ch, key, group, note, docked } */
      palette: paletteList,
      /* divInfo(id)：手写分数（÷）的结构读数（只读）。横线是 canvas 画的、没有 DOM 盒子，
         所以探针要断言"这个字形到底落在哪一格、横线在哪"只能从这里读。
         返回：{ on, bar:{cx,cy,left,right,w}, zones:{num,den,left,right}:[{ch,cx,cy,w,h}],
                box:{left,top,right,bottom} } —— 坐标全是**世界坐标**（与 B.x/B.y 同一套）。 */
      divInfo: function (id) {
        var B = bodies[id];
        if (!B) return null;
        var r = divBarRect(B);
        var out = { on: !!(B.div && B.div.on), bar: r ? { cx: r.cx, cy: r.cy, left: r.left, right: r.right, w: r.w } : null,
                    zones: { num: [], den: [], left: [], right: [] },
                    rowW: null, box: null, sc: B.sc || 1 };
        if (!B.div || !B.div.on) return out;
        if (B.div.dbg) out.rowW = B.div.dbg.rowW;
        var list = divMembers(B, B.div.bar);
        for (var i = 0; i < list.length; i++) {
          var g = list[i];
          var z = (g.type === DIV) ? 'right' : (g.dz || 'num');
          if (!out.zones[z]) z = 'num';
          var s = slot(B, g);
          var sc = B.sc || 1;
          out.zones[z].push({ ch: g.ch, cx: s.x, cy: s.y,
                              w: (g.w || 0) * sc, h: (g.h || 0) * sc,
                              left: s.x - (g.w || 0) * sc / 2, right: s.x + (g.w || 0) * sc / 2,
                              top: s.y - (g.h || 0) * sc / 2, bottom: s.y + (g.h || 0) * sc / 2 });
        }
        var l = 1e9, t = 1e9, rr = -1e9, bb = -1e9;
        for (var zk in out.zones) {
          for (var j = 0; j < out.zones[zk].length; j++) {
            var q = out.zones[zk][j];
            l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); bb = Math.max(bb, q.bottom);
          }
        }
        if (r) { l = Math.min(l, r.left); t = Math.min(t, r.cy - 1); rr = Math.max(rr, r.right); bb = Math.max(bb, r.cy + 1); }
        if (l < 1e8) out.box = { left: l, top: t, right: rr, bottom: bb };
        return out;
      },
      /* eqTable()：公式表自检（只读）。用于探针与人工排查"这条式子为什么没被认出来" */
      eqTable: eqTableDump,
      /* ---- 公式体动力学（双轨新路径）的测试接口 ---- */
      /* eqEvents(n)：最近 n 条事件（新的在后）。事件 = 碰撞/短路/断路/充电完成/感应… */
      eqEvents: function (n) {
        var out = EQ_EVENTS.slice();
        if (n > 0) out = out.slice(Math.max(0, out.length - n));
        return out;
      },
      /* eqClock()：公式体的仿真时钟与累加器（固定步长，帧率无关） */
      eqClock: function () { return { t: eqTime, acc: eqAcc, dt: EQ_DT }; },
      /* eqStep(n)：手动推进 n 个固定步 —— 让探针**不依赖真实帧率**地做确定性断言 */
      eqStep: function (n) {
        n = (n == null) ? 1 : Math.max(1, Math.min(100000, n | 0));
        for (var i = 0; i < n; i++) eqStepOnce();
        return { t: eqTime, n: n };
      },
      /* eqClearEvents()：清空事件缓冲（每条交互的断言都从干净状态起算） */
      eqClearEvents: function () { EQ_EVENTS = []; eqEventSeq = 0; return true; },
      /* operationLog(n)（2026-10-01 新功能）：最近 n 条操作日志（mount/unmount/
         drag-out/assemble/event/preset/transform/arrow-turn/heat/clear）；
         n 缺省取最多 500；n===0 = 清空。持久化在 localStorage['qg_ps_oplog']。 */
      operationLog: function (n) {
        if (n === 0) { oplog = []; oplogSave(); return []; }
        n = (n == null) ? 500 : Math.max(1, Math.min(500, n | 0));
        return oplog.slice(Math.max(0, oplog.length - n));
      },
      operationLogClear: function () { oplog = []; oplogSave(); return true; },
      /* eqSet(id, k, v)：改写某个公式体的物理参数（探针用它构造场景，
         例如把 m 设成 2、把 R 设成 0 造短路、把 e 设成 0 造非弹性碰撞） */
      eqSet: function (id, k, v) {
        var B = bodies[id];
        if (!B) return null;
        eqInitState(B);
        if (k === 'R') B.eqState.Rset = v;
        else if (k === 'U') B.eqState.Uset = v;
        /* theta：斜面倾角的**唯一真源是体的朝向 B.th**（与玩家的旋转手柄同一条），
           所以这里连 B.th 一起写 —— 只写 eqState.theta 的话读数里的 tanθ 永远是 0，
           判据会永远"不下滑"（实测踩到）。 */
        else if (k === 'theta') { B.th = v; B.eqState.theta = v; }
        else B.eqState[k] = v;
        return eqReadout(B);
      },
      /* eqVel(id, vx, vy)：给公式体一个初速度（探针构造碰撞场景用；同时记录成
         "初始速度"，方便断言"碰前 Σp"）。老实体没有公式，返回 null。 */
      eqVel: function (id, vx, vy) {
        var B = bodies[id];
        if (!B || !B.eq) return null;
        eqInitState(B);
        B.vx = vx; B.vy = vy || 0;
        B.eqState.vx0 = B.vx; B.eqState.vy0 = B.vy;
        return { id: id, vx: B.vx, vy: B.vy };
      },
      /* eqState(id)：某个公式体的完整动力学状态（只读快照，供断言） */
      eqState: function (id) {
        var B = bodies[id];
        if (!B || !B.eqState) return null;
        var S = B.eqState, out = {};
        for (var k in S) out[k] = (typeof S[k] === 'number') ? +S[k].toFixed(6) : S[k];
        return out;
      },
      /* 只读的原始内部快照（排查排版/合成为什么长这样时用，不参与任何逻辑） */
      rawBodies: function () {
        var out = [];
        for (var i = 0; i < bodies.length; i++) {
          var B = bodies[i];
          out.push({
            i: i, x: B.x, y: B.y, kind: B.kind, family: B.family, vCount: B.vCount, cCount: B.cCount,
            hw: B.hw, hh: B.hh, frac: !!B.frac, gravMode: B.gravMode, isWell: !!B.isWell,
            massG: B.massG ? B.massG.type : null,
            mem: (function () { var a = []; for (var k = 0; k < B.mem.length; k++) a.push(B.mem[k].type); return a; })(),
            glyphs: (function () { var a = []; for (var k = 0; k < B.glyphs.length; k++) if (B.glyphs[k]) a.push(B.glyphs[k].type); return a; })(),
            st: { open: !!B.st.open, plus: !!B.st.plus, close: !!B.st.close, sq: !!B.st.sq, bar: !!B.st.bar }
          });
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
      _internal: { bodies: bodies, freeL: freeL, root: overlay }
    };
  }

  /* ------------------------------------------------------------------ *
   * 对外接口：window.QG_PSANDBOX                                        *
   * ------------------------------------------------------------------ */
  var current = null;      // 当前引擎实例（未挂载时为 null）
  var hostEl = null;

  var API = {
    build: BUILD,
    /* 往 containerEl 里建舞台。opts: { preset, hint, toolbar } */
    mount: function (containerEl, opts) {
      if (!containerEl) return null;
      if (current) API.unmount();
      injectCSS();
      hostEl = containerEl;
      current = createEngine(containerEl, opts || {});
      return true;
    },
    /* 彻底拆干净：DOM、全局事件、rAF 循环、闭包引用 */
    unmount: function () {
      if (!current) return false;
      var eng = current;
      current = null;
      try { eng.unmount(); } catch (e) { /* 忽略：拆解失败也要把引用放掉 */ }
      hostEl = null;
      return true;
    },
    isMounted: function () { return !!current; },
    /* 以下是**已挂载时**才有效的直通接口，未挂载时返回 null/false，不抛错 */
    applyPreset: function (k) { return current ? current.applyPreset(k) : null; },
    addBody: function (chars, opts) { return current ? current.addBody(chars, opts) : null; },
    bodies: function () { return current ? current.bodies() : []; },
    clear: function () { return current ? current.clear() : null; },
    collect: function () { return current ? current.collect() : null; },
    stepOnce: function (dt) { return current ? current.stepOnce(dt) : null; },
    /* 暂停 / 继续 rAF 自动推进（探针想完全手动控帧、或页面想冻结画面时用） */
    pause: function () { return current ? current.pause() : false; },
    resume: function () { return current ? current.resume() : false; },
    state: function () { return current ? current.state() : { build: BUILD, mounted: false }; },
    letters: function () { return current ? current.letters() : []; },
    /* 托盘符号清单（只读）。符号扩展后（15 → 33）给探针/上层页面一个稳定读取口。
       未挂载时返回 []（与其他直通接口一致：不抛错）。 */
    palette: function () { return current ? current.palette() : []; },
    /* 公式表自检（只读）。探针用它列出全部已登记的课本公式与触发字母集合。 */
    eqTable: function () { return current ? current.eqTable() : []; },
    /* ---- 公式体动力学（双轨新路径）的直通接口；未挂载时给安全默认值 ---- */
    eqEvents: function (n) { return current ? current.eqEvents(n) : []; },
    eqClock: function () { return current ? current.eqClock() : { t: 0, acc: 0, dt: 0 }; },
    eqStep: function (n) { return current ? current.eqStep(n) : null; },
    eqClearEvents: function () { return current ? current.eqClearEvents() : false; },
    /* 操作日志（2026-10-01 新功能，加法）：未挂载时返回 []/false，不抛错 */
    operationLog: function (n) { return current ? current.operationLog(n) : []; },
    operationLogClear: function () { return current ? current.operationLogClear() : false; },
    eqSet: function (id, k, v) { return current ? current.eqSet(id, k, v) : null; },
    eqVel: function (id, vx, vy) { return current ? current.eqVel(id, vx, vy) : null; },
    eqState: function (id) { return current ? current.eqState(id) : null; },
    rawBodies: function () { return current ? current.rawBodies() : []; },
    distance: function (a, b) { return current ? current.distance(a, b) : null; },
    /* 供页面自行判断是否要显示入口用不到，但留着方便排障 */
    host: function () { return hostEl; },
    /* divInfo(id)：手写分数（÷）的结构读数直通（未挂载时 null） */
    divInfo: function (id) { return current ? current.divInfo(id) : null; }
  };

  window.QG_PSANDBOX = API;
})();
