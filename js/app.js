/* ============================================================
 * 穷观 · 3D 可视化与关键词搜索
 * 布局规则:
 *   高度 Y  = importance(1~5)  → 越高越重要、越总体
 *   半径 R  = core(1~5)        → 越靠中心相关度越高,由中间向外递减
 *   扇区    = 板块(10 个)
 *   连线    = 知识点之间的相关性(links)
 * ------------------------------------------------------------
 * 原创标识 QG-20260920-5e5d5a · © 2026 PHILlA093 · 保留所有权利
 * ============================================================ */
/* 构建指纹:仅在页面全局写入一个字符串常量,不参与渲染 / 网络 / 存储,无任何副作用。 */
window.__QG_ORIGIN = 'QG-20260920-5e5d5a';
(function () {
  'use strict';

  /* ---- 科目选择:整页刷新切换,启动时一次性确定 DB ----
   * 优先级:?subject=xxx → localStorage(qg_subject) → math
   * 已开放:math(数学)、chem(化学)、physics(物理)、eng(英语),对应
   * window.MATH_DB / window.CHEM_DB / window.PHYSICS_DB / window.ENG_DB。 */
  var BOOT_OK = { math: 1, chem: 1, physics: 1, eng: 1, bio: 1 };
  var bootSub = (/[?&]subject=([a-z]+)/.exec(window.location.search) || [])[1];
  if (!BOOT_OK[bootSub]) {
    try { bootSub = localStorage.getItem('qg_subject'); } catch (e) { bootSub = null; }
    if (!BOOT_OK[bootSub]) bootSub = 'math';
  }
  window.CUR_SUBJECT = bootSub;
  var DB = window.MATH_DB;
  if (bootSub === 'chem' && window.CHEM_DB) DB = window.CHEM_DB;
  if (bootSub === 'physics' && window.PHYSICS_DB) DB = window.PHYSICS_DB;
  if (bootSub === 'eng' && window.ENG_DB) DB = window.ENG_DB;
if (bootSub === 'bio' && window.BIO_DB) DB = window.BIO_DB;
  if (!DB) {   // 连兜底数据都没有:必须给出可见报错,而不是黑屏 + 控制台一行日志
    showFatal('知识库数据加载失败:未找到任何科目数据(js/data*.js 缺失或存在语法错误)。');
    return;
  }
  // 旧格式数据文件可能没有 subject 字段:按启动科目补齐(只补运行时字段,不改文件),
  // 让下面的"科目一致性"判断在旧数据上依然成立
  if (!DB.subject) DB.subject = bootSub;
  /* 科目与数据必须一致:data_chem.js 缺失或有语法错误时,上面的兜底会静默保留
   * MATH_DB,而 CUR_SUBJECT 仍是 chem —— 于是标题写着「高中化学」却渲染数学云,
   * 新增的自定义点被标成 chem、板块却是数学的,之后被 isRealBoard 静默丢弃,
   * 用户只看到"加了点却不见了"。这里与 WebGL 失败路径一致,用 showFatal 明确报错,
   * 绝不静默退化成别的科目。 */
  if (DB.subject !== window.CUR_SUBJECT) {
    showFatal('「' + window.CUR_SUBJECT + '」科目的知识库数据加载失败:实际载入的是「' +
      (DB.subjectName || DB.subject) + '」的数据。\n' +
      '通常是安装目录下 js/data*.js 缺失或存在语法错误,请修复数据文件后重启。');
    return;
  }

  /* ---------------- 常量 ----------------
   * 布局刻意放大:节点间预留大量空间,整体疏朗,
   * 缩小(拉远)视角才能看到网络全貌。
   */
  var R_MAX = 56;                     // 知识云设计半径(辅助参考)
// 取景下移量:顶栏在画面最上方、底部还有提示条与字幕,可视区的真正中心比画面中心低,
// 所以把相机与注视点一起抬高 CAM_DROP,云在画面里就整体下移(值是云半径的约 11%,
// 视觉上约画幅高度的 5%,属于"往下放一点"的量级;要再低就调大这个数)。
var CAM_DROP = 6;
  var Y_MIN = 1.5, Y_MAX = 34;        // 高度范围(低→高)
  var BOARD_COUNT = DB.boards.length;

  var BOARD_COLORS = {
    calculus: 0x4fc3f7,  solid: 0xff8a65,   analytic: 0xaed581,
    stats: 0xba68c8,     trig_seq: 0xffd54f, sets: 0x4db6ac,
    vector: 0xf06292,    inequality: 0xffb74d, complex: 0x90a4ae,
    counting: 0x7986cb
  };

  /* ---------------- 用户自定义知识点 ----------------
   * 「定义新知识点」表单创建的知识点持久化于 localStorage
   * (qg_custom_points_v1),data.js 不被改动;
   * 底层分类永远是既有十大板块:自定义节点必须归属其中某一板块,
   * 参与对应板块的筛选/扇区/颜色逻辑;光点颜色默认取板块固有颜色,
   * 也允许用户用 RGB 自定义覆盖。
   */
  function isRealBoard(id) {
    for (var i = 0; i < DB.boards.length; i++) if (DB.boards[i].id === id) return true;
    return false;
  }
  // 读回存储中的自定义知识点全量(所有科目共用 qg_custom_points_v1 一格)
  function readCustomStore() {
    var arr = null;
    try {
      var raw = localStorage.getItem('qg_custom_points_v1');
      if (raw) arr = JSON.parse(raw);
    } catch (e) { /* 忽略 */ }
    return Array.isArray(arr) ? arr : [];
  }
  function saveCustomPoints() {
    var cur = DB.subject;
    var list = DB.points.filter(function (p) { return p.user; })
      .map(function (p) {
        return {
          id: p.id, name: p.name, board: p.board, subject: cur,
          importance: p.importance, core: p.core,
          keywords: p.keywords, content: p.content,
          links: p.links, customColor: p.customColor || null
        };
      });
    // 存储是所有科目共用的一格:直接整体覆盖只会留下当前科目 ——
    // 数学加 1 个自定义点、切到化学再加 1 个,数学的那些就会全部消失且不可恢复。
    // 因此写入前先读回全量,按 subject 合并后再写,其它科目的条目原样保留。
    var keep = readCustomStore().filter(function (r) {
      if (!r || typeof r.id !== 'string' || !r.id) return false;
      if (r.subject) return r.subject !== cur;   // 其它科目:原样保留
      // 旧格式条目没有 subject 字段:视为当前科目,由上面的 list 取代(不会重复);
      // 但它若连板块都不属于当前科目,说明其实是别的科目的旧数据,同样必须保留
      return !isRealBoard(r.board);
    });
    try { localStorage.setItem('qg_custom_points_v1', JSON.stringify(keep.concat(list))); } catch (e) { /* 忽略 */ }
  }
  function loadCustomPoints() {
    var arr = readCustomStore();
    if (!arr.length) return;
    var mine = [];
    arr.forEach(function (raw) {
      if (!raw || typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string' || !raw.name) return;
      // 只挑当前科目的条目用于渲染;其它科目的条目继续留在存储里 ——
      // 本函数从不回写存储,保存时按 subject 合并,绝不因"不是本科目"而丢弃
      if (raw.subject && raw.subject !== DB.subject) return;
      if (DB.points.some(function (q) { return q.id === raw.id; })) return;
      if (!isRealBoard(raw.board)) return;   // 无真实板块归属的旧数据不兼容,忽略
      mine.push({
        id: raw.id, name: String(raw.name), board: raw.board, user: true, subject: DB.subject,
        importance: Math.min(5, Math.max(1, Math.round(Number(raw.importance) || 3))),
        core: Math.min(5, Math.max(1, Math.round(Number(raw.core) || 3))),
        keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
        content: String(raw.content || '').trim(),
        links: Array.isArray(raw.links) ? raw.links.map(String) : [],
        customColor: /^#[0-9a-fA-F]{6}$/.test(raw.customColor || '') ? raw.customColor : null
      });
    });
    if (!mine.length) return;
    var ids = {};
    DB.points.forEach(function (p) { ids[p.id] = 1; });
    mine.forEach(function (p) { ids[p.id] = 1; });
    mine.forEach(function (p) {
      p.links = p.links.filter(function (t) { return !!ids[t]; });   // 只保留已知引用
      DB.points.push(p);
    });
  }
  // 调试/自救钩子:?qg_clear=1 清空全部自定义知识点并刷新
  if (/[?&]qg_clear=1/.test(window.location.search)) {
    try { localStorage.removeItem('qg_custom_points_v1'); } catch (e) { /* 忽略 */ }
  }
  loadCustomPoints();

  /* ---------------- 工具 ---------------- */
  function boardName(id) {
    for (var i = 0; i < DB.boards.length; i++) if (DB.boards[i].id === id) return DB.boards[i].name;
    return id;
  }
  function boardIdx(id) {
    for (var i = 0; i < DB.boards.length; i++) if (DB.boards[i].id === id) return i;
    return 0;
  }
  function boardColor(id) {
    // 板块固有颜色优先取 DB 内定义(化学各板自带 color 字段),
    // 数学沿用下方 BOARD_COLORS 常量表。
    for (var i = 0; i < DB.boards.length; i++) {
      if (DB.boards[i].id === id && DB.boards[i].color) {
        var h = String(DB.boards[i].color).replace('#', '');
        if (/^[0-9a-fA-F]{6}$/.test(h)) return parseInt(h, 16);
      }
    }
    return BOARD_COLORS[id] || 0xcccccc;
  }
  function hexColor(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function renderContentText(t) {
    // 简单 Markdown 子集:**粗体** 与换行
    var s = escapeHtml(t);
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }
  function showFatal(msg) {
    var el = document.getElementById('glError');
    if (el) { el.hidden = false; el.textContent = msg; }
    // 出错时也立即揭示主界面,让用户看到错误提示而非黑屏
    var a = document.getElementById('app');
    if (a) { a.style.transition = 'none'; a.classList.add('reveal'); }
    var i = document.getElementById('intro');
    if (i) i.style.display = 'none';
    document.documentElement.classList.remove('intro-live');
    console.error('[知识库] ' + msg);
  }

  /* ---------------- 画布与渲染器 ---------------- */
  var canvas = document.getElementById('scene');
  var renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (err) {
    showFatal('3D 渲染初始化失败:当前环境不支持 WebGL(浏览器可能禁用了硬件加速,或显卡驱动异常)。\n' + err.message);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // 顶栏高度取自 CSS 变量 --topbar-h(style.css 是唯一来源),
  // 避免两处各写一个 58 而日后改样式时悄悄漂移。取不到时回退量 DOM 再回退 58。
  function topbarH() {
    try {
      var n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h'));
      if (isFinite(n) && n > 0) return n;
    } catch (e) { /* 忽略 */ }
    var tb = document.getElementById('topbar');
    if (tb && tb.clientHeight) return tb.clientHeight;
    return 58;
  }
  function syncSize() {
    // 尺寸一律取自容器(#canvasWrap)而非 canvas 本身:
    // renderer.setSize 会把内联 style 写死并覆盖 CSS 的 width:100%,
    // 导致窗口放大后画布被锁在旧尺寸(全屏不跟随)。
    var wrap = document.getElementById('canvasWrap');
    var w = wrap ? wrap.clientWidth : (window.innerWidth - 560);
    var h = wrap ? wrap.clientHeight : (window.innerHeight - topbarH());
    if (w < 50) w = 900;
    if (h < 50) h = 640;
    renderer.setSize(w, h, false);   // 不写内联样式,由 CSS 100% 跟随布局
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a101f);
  // 不使用雾,防止视角拉远后画面被雾色覆盖而全黑

  var camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 1200);
  camera.position.set(70, 50 + CAM_DROP, 76);
  syncSize();

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 480;
  controls.target.set(0, CAM_DROP, 0);   // 注视点 = 云的几何中心(原点),盘面内容上下均衡
  // 待机自转:默认关闭(宣传片录制期间临时开启过,录完按用户要求还原)。
  // 需要再次拍片时把下一行改成 true 即可,autoRotateSpeed 1.2 ≈ 7.2°/秒(约 50 秒一圈)。
  // 注意:OrbitControls 的 autoRotate 只在没有拖拽时生效,开着也不会跟用户操作打架。
  controls.autoRotate = false;
  controls.autoRotateSpeed = 1.2;
  // 用户开始拖拽/滚轮时立即终止正在进行的相机动画(取景/聚焦/归位),交还操控权
  controls.addEventListener('start', function () { camAnim = null; });

  scene.add(new THREE.AmbientLight(0x8899bb, 0.95));
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(30, 50, 25);
  scene.add(dirLight);
  var dirLight2 = new THREE.DirectionalLight(0x4fc3f7, 0.4);
  dirLight2.position.set(-25, 10, -30);
  scene.add(dirLight2);

  /* ---------------- 知识云布局:无中心力导向 ----------------
   * 知识云没有中心:节点不围绕任何固定中心排列,
   * 而由「连线弹簧 + 互斥」在水平面自然铺开——
   * 相关的知识点靠得近(连线短),不相关的自然远离;
   * 高度仍只表达重要度。位置在边集合构建后计算。
   */

  /* ---------------- 构建边集合(无向、去重) ---------------- */
  var idToPoint = {};
  DB.points.forEach(function (p) { idToPoint[p.id] = p; });
  var edgeSet = {};
  var edges = [];
  DB.points.forEach(function (p) {
    (p.links || []).forEach(function (t) {
      if (!idToPoint[t]) return;
      var key = p.id < t ? p.id + '|' + t : t + '|' + p.id;
      if (edgeSet[key]) return;
      edgeSet[key] = true;
      edges.push({ a: p, b: idToPoint[t], key: key });
    });
  });

  /* ---------------- 无中心力导向布局 ----------------
   * 各板块节点先在自身扇区方向随机铺开(仅作初值,保证收敛质量),
   * 随后由物理松弛决定最终位置:
   *   弹簧(连线):有关系的节点互相拉近,rest≈11;
   *   互斥力:所有节点彼此推开(≥8.5),保证不重合与留白;
   *   高度只由重要度决定,不受力学影响。
   * 收敛后整体归一化到半径 50 的视野内。
   */
  var visualR = {};
  DB.points.forEach(function (p) { visualR[p.id] = 1.05 + p.importance * 0.22; });

  /* ---------------- 大容量知识库(重负载)优化 ----------------
   * 节点规模超过 HEAVY_LIMIT(如英语全库 1978 点)时启用:
   *   1) 布局改用 O(n) 确定性静态排布,不再跑 800 轮 O(n²) 物理松弛;
   *   2) 词点层(w- 系列挂词根节点)的标签改为按需生成,不一次性
   *      创建上千张画布纹理;
   *   3) 聚焦重排 / 新增节点的「推开防重叠」迭代次数大幅缩减。
   * 数学 / 物理 / 化学(<900 点)不满足阈值,行为与之前完全一致。
   */
  var HEAVY_LIMIT = 900;
  var HEAVY_CLOUD = DB.points.length > HEAVY_LIMIT;
  var LAYER_BOARD_ID = null;    // 词点层板块(英语:words);无则返回 null
  if (HEAVY_CLOUD) {
    for (var li = 0; li < DB.boards.length; li++) {
      if (DB.boards[li].id === 'words') { LAYER_BOARD_ID = 'words'; break; }
    }
  }

  /* —— 重负载库:确定性静态布局(O(n),单次完成) ——
   * · 概念节点(词根/主题/句型/语法/词组):由内向外逐圈入座——
   *   每圈座位数随半径增大(相邻节点间距≈2.8),板块按数据序先后
   *   落座,形成由内而外的环带,颜色按板块自然分区;
   * · 词点层节点:以所属词根的位置为圆心小环环绕(卫星式);
   *   无词根归属的孤点(如有)落在近中心的确定性位置;
   * · 高度仍只表达重要度(与常规库语义一致);
   * · 完成后整体归一化到半径≈50 视野,并写入 _defX/_defZ
   *   (聚焦重排 / 回位 / 新增节点默认位全部照常可用)。
   */
  function heavyStaticLayout() {
    var pts = DB.points, n = pts.length;
    var byBoard = {};
    pts.forEach(function (p) {
      if (!byBoard[p.board]) byBoard[p.board] = [];
      byBoard[p.board].push(p);
    });
    var layerArr = LAYER_BOARD_ID ? (byBoard[LAYER_BOARD_ID] || []) : [];
    var rootPolar = {};              // 词根 id -> { r, a }(词点环绕的锚)
    var R0 = 4.4, DR = 2.6, TGAP = 2.8;   // 圈距 2.6、同圈相邻弧距≈2.8
    var rows = [];                   // 每圈 { r, angles[], used }
    var rowIdx = 0;
    DB.boards.forEach(function (b) {
      var arr = byBoard[b.id];
      if (!arr || b.id === LAYER_BOARD_ID) return;
      arr.forEach(function (p) {
        while (true) {
          while (rowIdx >= rows.length) {
            var r = R0 + rows.length * DR;
            var seats = Math.max(8, Math.floor(2 * Math.PI * r / TGAP));
            var angs = [];
            for (var s = 0; s < seats; s++) angs.push(s / seats * Math.PI * 2);
            rows.push({ r: r, angles: angs, used: 0 });
          }
          var row = rows[rowIdx];
          if (row.used >= row.angles.length) { rowIdx++; continue; }
          var seatAng = row.angles[row.used];
          row.used++;
          // 确定性微抖动:纯函数取值,避免机械的放射线感
          var jit = Math.sin(p.id.charCodeAt(0) * 91.7 + p.id.length * 13.3 + rowIdx) * 0.16;
          var rr = row.r + jit;
          var aa = seatAng + jit / rr;
          p._pos = new THREE.Vector3(rr * Math.cos(aa), 0, rr * Math.sin(aa));
          if (p.board === 'roots') rootPolar[p.id] = { r: rr, a: aa };
          break;
        }
      });
    });
    // 词点层:按所属词根分组后小环环绕
    var wGroups = {}, wOrder = [];
    layerArr.forEach(function (w) {
      var rid = (w.links && w.links.length && rootPolar[w.links[0]]) ? w.links[0] : null;
      if (!rid) rid = '@' + w.id;   // 孤点占位组
      if (!wGroups[rid]) { wGroups[rid] = []; wOrder.push(rid); }
      wGroups[rid].push(w);
    });
    wOrder.forEach(function (rid) {
      var arr = wGroups[rid];
      var anchor = rid.charAt(0) === '@' ? null : rootPolar[rid];
      arr.forEach(function (w, wi) {
        var rr, aa;
        if (anchor) {
          var ring = 0, left = wi;
          while (true) {
            var r0 = anchor.r + 2.1 + ring * 2.7;
            var cap = Math.max(8, Math.floor(2 * Math.PI * r0 / 2.5));
            if (left < cap) {
              rr = r0;
              aa = anchor.a + (left - (cap - 1) / 2) * (2.5 / r0);
              break;
            }
            left -= cap; ring++;
          }
        } else {
          aa = wi * 2.39996;
          rr = 7.5 + (wi % 7) * 2.1;    // 孤点:近中心确定性散落
        }
        w._pos = new THREE.Vector3(rr * Math.cos(aa), 0, rr * Math.sin(aa));
      });
    });
    // 高度定级(重要度)+ 归一化到半径≈50
    var maxR = 0;
    pts.forEach(function (p) {
      p._pos.y = Y_MIN + (Y_MAX - Y_MIN) * (p.importance - 1) / 4;
      var rr = Math.sqrt(p._pos.x * p._pos.x + p._pos.z * p._pos.z);
      if (rr > maxR) maxR = rr;
    });
    if (maxR > 0.5) {
      var sc = 50 / maxR;
      pts.forEach(function (p) { p._pos.x *= sc; p._pos.z *= sc; });
    }
    pts.forEach(function (p) {
      p._defX = p._pos.x;
      p._defZ = p._pos.z;
    });
  }

  (function settleLayout() {
    var pts = DB.points, n = pts.length;
    if (HEAVY_CLOUD) { heavyStaticLayout(); return; }   // 重负载:静态排布,零卡顿
    var vx = {}, vz = {};
    var P = {};
    var ids = [];
    DB.points.forEach(function (p) {
      ids.push(p.id);
      var bi = boardIdx(p.board);
      var r0 = 10 + Math.random() * 40;
      var a0 = (bi + 0.5) / BOARD_COUNT * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
      p._pos = new THREE.Vector3(r0 * Math.cos(a0), 0, r0 * Math.sin(a0));
      P[p.id] = p._pos;
      vx[p.id] = 0; vz[p.id] = 0;
    });
    var REST = 11, KSPR = 0.011, REPR = 8.5, KREP = 0.055;
    var damp = 0.93;
    for (var it = 0; it < 800; it++) {
      // 弹簧:连线把相关节点拉近
      for (var ei = 0; ei < edges.length; ei++) {
        var e = edges[ei];
        var A = P[e.a.id], B = P[e.b.id];
        var dx = A.x - B.x, dz = A.z - B.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 0.001;
        var f = (d - REST) * KSPR * 0.5;
        vx[e.a.id] -= dx / d * f; vz[e.a.id] -= dz / d * f;
        vx[e.b.id] += dx / d * f; vz[e.b.id] += dz / d * f;
      }
      // 互斥:所有节点互相推开
      for (var i = 0; i < n; i++) {
        for (var j = i + 1; j < n; j++) {
          var a = P[ids[i]], b = P[ids[j]];
          var dx2 = a.x - b.x, dz2 = a.z - b.z;
          var d2 = dx2 * dx2 + dz2 * dz2;
          if (d2 < REPR * REPR && d2 > 1e-6) {
            var dd = Math.sqrt(d2);
            var ff = KREP * (REPR - dd) / dd * 0.5;
            vx[ids[i]] += dx2 * ff; vz[ids[i]] += dz2 * ff;
            vx[ids[j]] -= dx2 * ff; vz[ids[j]] -= dz2 * ff;
          }
        }
      }
      // 阻尼 + 积分 + 高度定级(重要度)
      if (it > 550) damp = 0.90;
      if (it > 700) damp = 0.84;
      for (var k = 0; k < n; k++) {
        var p = pts[k];
        var y = Y_MIN + (Y_MAX - Y_MIN) * (p.importance - 1) / 4;
        p._pos.y = y;
        vx[p.id] *= damp; vz[p.id] *= damp;
        p._pos.x += vx[p.id];
        p._pos.z += vz[p.id];
      }
    }
    // 归一化到设计视野(半径≈50)
    var maxR = 0;
    for (var m = 0; m < n; m++) {
      var rr = Math.sqrt(pts[m]._pos.x * pts[m]._pos.x + pts[m]._pos.z * pts[m]._pos.z);
      if (rr > maxR) maxR = rr;
    }
    if (maxR > 0.5) {
      var sc = 50 / maxR;
      for (var s2 = 0; s2 < n; s2++) {
        pts[s2]._pos.x *= sc;
        pts[s2]._pos.z *= sc;
      }
    }
    // 保底:极端情况下仍保证不重叠
    for (var it2 = 0; it2 < 160; it2++) {
      var moved = 0;
      for (var i2 = 0; i2 < n; i2++) {
        var a2 = P[ids[i2]];
        for (var j2 = i2 + 1; j2 < n; j2++) {
          var b2 = P[ids[j2]];
          var dx3 = a2.x - b2.x, dz3 = a2.z - b2.z;
          var minSep = (visualR[ids[i2]] + visualR[ids[j2]]) * 0.62;
          if (minSep < 1.3) minSep = 1.3;
          var d3 = dx3 * dx3 + dz3 * dz3;
          if (d3 < minSep * minSep && d3 > 1e-8) {
            var dd3 = Math.sqrt(d3);
            var push = (minSep - dd3) / dd3 * 0.5;
            a2.x += dx3 * push * 0.5; a2.z += dz3 * push * 0.5;
            b2.x -= dx3 * push * 0.5; b2.z -= dz3 * push * 0.5;
            moved++;
          }
        }
      }
      if (!moved) break;
    }
    // 保存默认坐标(未聚焦时知识云的形态;聚焦重排后可平滑回位)
    DB.points.forEach(function (p) {
      p._defX = p._pos.x;
      p._defZ = p._pos.z;
    });
  })();

  /* ---------------- 创建节点(动态光点)与连线 ---------------- */
  var nodeById = {};      // id -> {inner, outer, label, hit, point, ...}
  var allHit = [];        // 点击命中体(不可见小球,供射线检测)
  var allEdges = [];      // {line, mat, edge}

  // 光点纹理:径向渐变光斑(白色,由 SpriteMaterial.color 染色)
  function makeGlowTexture() {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var ctx = cv.getContext('2d');
    var grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.1, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.42)');
    grad.addColorStop(0.62, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }
  var glowTex = makeGlowTexture();
  var hitGeo = new THREE.SphereGeometry(1, 12, 10);

  function makeLabel(text, color, worldH) {
    worldH = worldH || 1.75;      // 标签世界高度(字号观感由它统一)
    // 画布按文本长度自适应,超长自动缩字号 —— 名称不会被截断
    var fs = 48;
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');
    function labelFont() { return 'bold ' + fs + 'px "Microsoft YaHei", sans-serif'; }
    ctx.font = labelFont();
    var tw = ctx.measureText(text).width;
    while (fs > 28 && tw > 860) {
      fs -= 4;
      ctx.font = labelFont();
      tw = ctx.measureText(text).width;
    }
    var h = Math.max(90, Math.ceil(fs * 3.0));
    var w = Math.max(230, Math.ceil(tw + fs * 2.4));
    cv.width = w; cv.height = h;
    ctx = cv.getContext('2d');
    ctx.font = labelFont();
    // 半透明深色胶囊底:任何光晕/连线背景下名称都完整可读
    var bw = Math.min(w - 8, tw + fs * 1.4);
    var bx = (w - bw) / 2;
    var bh = h * 0.68;
    var by = (h - bh) / 2;
    var r = bh / 2;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
    ctx.arcTo(bx, by + bh, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4, 9, 18, 0.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 160, 220, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 白字 + 深色描边
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(3, fs * 0.14);
    ctx.strokeText(text, w / 2, h / 2 + 1);
    ctx.fillStyle = color || '#eaf2ff';
    ctx.fillText(text, w / 2, h / 2 + 1);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(worldH * w / h, worldH, 1);   // 按纹理比例,文字不变形
    return sp;
  }

  // 为单个知识点创建 3D 对象(光点/命中体/名称);新增自定义知识点时复用
  function addPointRender(p) {
    var pos = p._pos;
    /* 自定义色是 '#rrggbb' 字符串,会被写进 rec.colorHex,而样式重置/层级重画走的是
     * outerMat.color.setHex(rec.colorHex);three 的 setHex 内部为 Math.floor(t),
     * 字符串 → NaN → r=g=b=0,自定义光点永远渲染成黑色(hexColor() 恰好兼容字符串,
     * 掩盖了这个 bug)。因此这里统一归一为数值:THREE.Color 构造兼容字符串与数字。 */
    var colorHex = new THREE.Color(p.customColor || boardColor(p.board)).getHex();
    p._colorHex = colorHex;
    // 板块勾选的当前状态:新增节点必须据此初始化 boardOn 与显隐,否则
    // outer.visible / labelOn / hit.userData.boardVisible 全取默认 true,
    // "被取消勾选板块"里的新点、名称照常出现(悬停/点击也照常命中)。
    // 启动阶段 boardChecks 尚未建立(undefined)→ 视为可见,随后 applyBoardFilter 统一校正。
    var boardVis = (boardChecks && boardChecks[p.board]) ? boardChecks[p.board].checked : true;
    // 呼吸相位:由 id 派生,节点之间错开。
    // id 短于 3 字符时 charCodeAt(2) 返回 NaN → ph 为 NaN → SpriteMaterial.scale 变 NaN,
    // 故做长度保护:不足 3 位时退到第 2 位 / 0
    var iA = p.id.charCodeAt(0) || 0;
    var iB = p.id.length > 2 ? p.id.charCodeAt(2) : (p.id.length > 1 ? p.id.charCodeAt(1) : 0);
    var ph = ((iA + iB + p.id.length) % 7) / 7 * Math.PI * 2;

    // 外层:彩色光晕
    var outerBase = visualR[p.id];
    var outerMat = new THREE.SpriteMaterial({
      map: glowTex, color: colorHex,
      transparent: true, opacity: 0.75, depthWrite: false
    });
    var outerSp = new THREE.Sprite(outerMat);
    outerSp.position.copy(pos);
    outerSp.scale.setScalar(outerBase);

    // 内层:白色亮核
    var innerBase = 0.36 + p.importance * 0.07;
    var innerMat = new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff,
      transparent: true, opacity: 0.95, depthWrite: false
    });
    var innerSp = new THREE.Sprite(innerMat);
    innerSp.position.copy(pos);
    innerSp.scale.setScalar(innerBase);

    // 点击命中体:不可见小球(visible=false 不渲染,但仍参与射线检测)
    var hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial());
    hit.position.copy(pos);
    hit.scale.setScalar(1.2 + p.importance * 0.18);
    hit.visible = false;
    hit.userData = { id: p.id, boardVisible: boardVis };

    /* 名称标签:重负载库(英语 ~1978 点)一律按需生成 —— 悬停/选中/搜索命中时
     * 由 ensureNodeLabel 建一次。原先预建 ~864 张 ~300×144 的 CanvasTexture
     * (≈170KB/张 ≈150MB CPU + 等量显存),而它们开屏就被板块筛选统一置为
     * 不可见,纯属浪费;轻负载库照常预生成(显示行为完全不变)。 */
    var labelOff = 1.6 + outerBase * 0.55;
    var label = null;
    if (!HEAVY_CLOUD) {
      label = makeLabel(p.name);
      label.position.copy(pos);
      label.position.y += labelOff;
      label.userData = p.id;
    }

    scene.add(outerSp); scene.add(innerSp); scene.add(hit);
    if (label) scene.add(label);
    var rec = {
      point: p, label: label, labelOn: false, labelOff: labelOff,   // labelOn 由下面的 boardOn 派生,不设无条件 true
      outer: outerSp, outerMat: outerMat, outerBase: outerBase,
      inner: innerSp, innerMat: innerMat, innerBase: innerBase,
      hit: hit, ph: ph, colorHex: colorHex, boardOn: boardVis
    };
    // 建节点时即按板块勾选状态定下显隐(与 applyBoardFilter 同一套语义),
    // 保证新点不会在"已取消勾选"的板块里冒出来;
    // labelOn 一律由 boardOn 派生(重负载库常态不常显名称)
    outerSp.visible = boardVis;
    innerSp.visible = boardVis;
    rec.labelOn = boardVis && !HEAVY_CLOUD;
    if (label) label.visible = rec.labelOn;
    nodeById[p.id] = rec;
    allHit.push(hit);
    return rec;
  }

  // 重负载库标签按需生成:首次需要显示(悬停/选中/搜索命中)时建一次并挂入场景
  function ensureNodeLabel(rec) {
    if (!rec || rec.label) return rec ? rec.label : null;
    var lb = makeLabel(rec.point.name);
    lb.position.copy(rec.point._pos);
    lb.position.y += rec.labelOff;
    lb.userData = rec.point.id;
    scene.add(lb);
    rec.label = lb;
    return lb;
  }
  DB.points.forEach(addPointRender);

  var EDGE_COLOR = 0x3f9bff;   // 蓝色细线
  // 连线使用动态位置缓冲:知识云重排(聚焦/回位)时可平滑跟随
  function fillEdgeArr(arr, a, b) {
    arr[0] = a.x; arr[1] = a.y; arr[2] = a.z;
    arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
  }
  function addEdgeRender(e) {
    var mat = new THREE.LineBasicMaterial({
      color: EDGE_COLOR, transparent: true, opacity: 0.3, depthWrite: false
    });
    var arr = new Float32Array(6);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    fillEdgeArr(arr, e.a._pos, e.b._pos);
    var line = new THREE.Line(geo, mat);
    scene.add(line);
    allEdges.push({ line: line, mat: mat, edge: e, arr: arr, geo: geo });
  }
  edges.forEach(addEdgeRender);
  function syncEdges() {
    allEdges.forEach(function (er) {
      fillEdgeArr(er.arr, er.edge.a._pos, er.edge.b._pos);
      er.geo.attributes.position.needsUpdate = true;
    });
  }

  /* ---------------- 辅助视觉:极简坐标系 ----------------
   * 设计语言:统一冰蓝灰细线、低透明度、克制。
   * 坐标系只做「空间参考」:标识高度(重要度)与方位;
   * 节点之间的关系远近由节点间的实际距离表达,无固定中心。
   */
  function addRing(radius, y, color, opacity, segs) {
    var pts = [];
    var n = segs || 128;
    for (var i = 0; i <= n; i++) {
      var a = i / n * Math.PI * 2;
      pts.push(new THREE.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)));
    }
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false });
    scene.add(new THREE.Line(geo, mat));
  }
  function addThinLine(p1, p2, color, opacity) {
    var geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity, depthWrite: false
    })));
  }
  var AXIS_C = 0x7d97bd;          // 轴色:冰蓝灰
  var AXIS_EXT = R_MAX + 6;

  // 三轴细线:仅正方向伸出,不横穿网络
  addThinLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(AXIS_EXT, 0, 0), AXIS_C, 0.45);
  addThinLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, AXIS_EXT), AXIS_C, 0.45);
  addThinLine(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, Y_MAX + 1.6, 0), AXIS_C, 0.5);

  // 轴端小标签(小、淡,仅作方位参考)
  ['X', 'Y', 'Z'].forEach(function (ch, i) {
    var l = makeLabel(ch, '#9db4d8', 0.46);
    l.position.set(i === 0 ? AXIS_EXT + 1.4 : 0, i === 1 ? Y_MAX + 2.4 : 0, i === 2 ? AXIS_EXT + 1.4 : 0);
    scene.add(l);
  });

  // 楼层细环:重要度层级(淡,近看仍可辨)
  for (var j = 1; j <= 5; j++) {
    var yy = Y_MIN + (Y_MAX - Y_MIN) * (j - 1) / 4;
    addRing(R_MAX + 0.4, yy, 0x9db8e0, 0.14);
  }

  // 地平面:轻辐线 + 参考圆(罗盘感,近看仍有可辨参考)
  for (var s = 0; s < 8; s++) {
    var sa = s / 8 * Math.PI * 2;
    addThinLine(
      new THREE.Vector3(0, 0.03, 0),
      new THREE.Vector3((R_MAX + 1.6) * Math.cos(sa), 0.03, (R_MAX + 1.6) * Math.sin(sa)),
      0x6f88ad, 0.18
    );
  }
  addRing(R_MAX + 1.6, 0.04, 0x6f88ad, 0.26);

  /* ---------------- 状态 ---------------- */
  var selectedId = null;    // 当前选中节点
  var hoverId = null;       // 当前悬停节点
  var deselectRestyleTimer = null;   // 取消聚焦后的"归位保险"重画计时器
  var searchMode = false;   // 搜索高亮模式
  var searchSet = {};       // 命中的节点 id 集合
  var camAnim = null;       // 相机聚焦动画

  /* ---------------- 高亮辅助 ---------------- */
  function edgesOf(id) {
    var list = [];
    allEdges.forEach(function (e) {
      if (e.edge.a.id === id || e.edge.b.id === id) list.push(e);
    });
    return list;
  }

  function resetEdgeStyle() {
    allEdges.forEach(function (e) { e.mat.color.setHex(EDGE_COLOR); e.mat.opacity = 0.34; });
  }

  // 以 centerId 为起点沿连线(无向图)的层数(hop);maxH 截断
  function hopMapOf(centerId, maxH) {
    var adj = {};
    DB.points.forEach(function (p) { adj[p.id] = []; });
    edges.forEach(function (e) {
      adj[e.a.id].push(e.b.id);
      adj[e.b.id].push(e.a.id);
    });
    var hop = {};
    var q = [centerId];
    hop[centerId] = 0;
    while (q.length) {
      var c = q.shift();
      var nh = hop[c] + 1;
      if (nh > maxH) continue;
      var nbArr = adj[c];
      for (var i = 0; i < nbArr.length; i++) {
        var nb = nbArr[i];
        if (hop[nb] === undefined) { hop[nb] = nh; q.push(nb); }
      }
    }
    return hop;
  }

  function resetNodeStyle() {
    DB.points.forEach(function (p) {
      var rec = nodeById[p.id];
      if (!rec) return;
      rec.outerMat.color.setHex(rec.colorHex);
      rec.outerMat.opacity = 0.75;
      rec.innerMat.opacity = 0.95;
      if (HEAVY_CLOUD) {
        // 重负载:常态不常显名称(仅悬停/选中/搜索命中时临时点亮),
        // 画面清爽且大幅降低每帧标签绘制量
        rec.labelOn = false;
        if (rec.label) rec.label.visible = false;
      } else {
        // 板块被取消勾选时,名称必须保持隐藏(reset 不得把 label 无条件点亮):
        // labelOn 是"该不该显示名称"的唯一真值源,一律受 boardOn 约束
        rec.labelOn = rec.boardOn !== false;
        rec.label.visible = rec.labelOn;
        rec.label.material.opacity = 1;
      }
    });
  }

  function applyVisualState() {
    // 优先级:搜索模式 > 选中(按相关层级逐级显示:1 级亮,2/3 级变暗,更远隐去) > 悬停
    var selectedRel = null;
    resetEdgeStyle();
    resetNodeStyle();
    if (searchMode) {
      DB.points.forEach(function (p) {
        var rec = nodeById[p.id];
        var hit = !!searchSet[p.id];
        rec.outerMat.opacity = hit ? 1 : 0.07;
        rec.innerMat.opacity = hit ? 1 : 0.05;
        if (!hit) rec.outerMat.color.setHex(0x60789e);
        // 命中也必须让位于板块筛选:否则被取消勾选板块的名称会随搜索复现
        rec.labelOn = hit && rec.boardOn !== false;
        if (rec.label) {
          rec.label.visible = rec.labelOn;
          rec.label.material.opacity = hit ? 1 : 0;
        }
      });
      allEdges.forEach(function (e) {
        var hit = searchSet[e.edge.a.id] && searchSet[e.edge.b.id];
        e.mat.opacity = hit ? 0.8 : 0.05;
        if (hit) e.mat.color.setHex(0x66d0ff);
      });
    } else if (selectedId) {
      var srec = nodeById[selectedId];
      var hop = hopMapOf(selectedId, 4);
      // 「相关集」(1 级)供悬停提亮判定
      var rel = {};
      rel[selectedId] = true;
      edgesOf(selectedId).forEach(function (e) {
        rel[e.edge.a.id] = true;
        rel[e.edge.b.id] = true;
      });
      selectedRel = rel;
      // 选中:自身暖金;1 级保持;2 级光点变暗、名称变淡;3 级更暗更淡;4 级以上隐去
      DB.points.forEach(function (p) {
        var rec = nodeById[p.id];
        var h = hop[p.id] === undefined ? 9 : hop[p.id];
        rec.lev = h;
        var o = rec.outerMat, i = rec.innerMat, lb = rec.label;
        if (h === 0) {
          o.color.setHex(0xffe27a); o.opacity = 1; i.opacity = 1;
          rec.labelOn = rec.boardOn !== false;
          if (!lb) lb = ensureNodeLabel(rec);   // 选中的词点层节点:临时生成名称
          if (lb) lb.material.opacity = 1;
        } else if (h === 1) {
          o.color.setHex(rec.colorHex); o.opacity = 0.95; i.opacity = 0.95;
          rec.labelOn = rec.boardOn !== false; if (lb) lb.material.opacity = 1;
        } else if (h === 2) {
          o.color.setHex(rec.colorHex); o.opacity = 0.42; i.opacity = 0.4;
          rec.labelOn = rec.boardOn !== false; if (lb) lb.material.opacity = 0.55;
        } else if (h === 3) {
          o.color.setHex(rec.colorHex); o.opacity = 0.2; i.opacity = 0.2;
          rec.labelOn = rec.boardOn !== false; if (lb) lb.material.opacity = 0.28;
        } else {
          o.color.setHex(0x42536e); o.opacity = 0.05; i.opacity = 0.05;
          rec.labelOn = false; if (lb) lb.material.opacity = 0;
          if (lb) lb.visible = false;
        }
        // 板块被取消勾选的知识点:名称始终不显示(reset/层级的显隐都要让位于板块筛选)
        if (rec.boardOn === false) {
          if (lb) lb.visible = false;
          rec.labelOn = false;
          o.visible = false;
          i.visible = false;
        }
      });
      // 连线:与选中点直连的亮金;层级越远越淡,保留空间结构
      allEdges.forEach(function (e) {
        var ha = hop[e.edge.a.id] === undefined ? 9 : hop[e.edge.a.id];
        var hb = hop[e.edge.b.id] === undefined ? 9 : hop[e.edge.b.id];
        var m = Math.min(ha, hb);
        if (m === 0) { e.mat.opacity = 0.95; e.mat.color.setHex(0xffd54f); }
        else if (m === 1) { e.mat.opacity = 0.4; e.mat.color.setHex(EDGE_COLOR); }
        else if (m === 2) { e.mat.opacity = 0.18; e.mat.color.setHex(EDGE_COLOR); }
        else if (m === 3) { e.mat.opacity = 0.09; e.mat.color.setHex(EDGE_COLOR); }
        else { e.mat.opacity = 0.03; e.mat.color.setHex(EDGE_COLOR); }
      });
    }
    if (hoverId && !searchMode) {
      var hrec = nodeById[hoverId];
      if (hrec) {
        // 悬停预览:临时显示其名称(便于辨认第二、三级知识点);
        // 同样受板块筛选约束,被取消勾选板块的节点悬停也不显示名称
        hrec.labelOn = hrec.boardOn !== false;
        var hlb = hrec.label || ensureNodeLabel(hrec);
        if (hlb) {
          hlb.material.opacity = 1;
          hlb.visible = hrec.labelOn;
        }
        if (!selectedId || (selectedRel && selectedRel[hoverId])) {
          // 常态或悬停到"相关"节点:正常提亮
          if (selectedId !== hoverId) hrec.outerMat.color.setHex(0xcfeaff);
          hrec.outerMat.opacity = Math.max(hrec.outerMat.opacity, 0.95);
          hrec.innerMat.opacity = 1;
        } else {
          // 悬停"已变暗"的 2~3 级节点:轻微预览,不点亮其连线;
          // 4 级及以上的隐藏节点仅"显影"极弱光晕,提示其存在
          hrec.outerMat.color.setHex(0x9db4d8);
          var liftLev = (hrec.lev !== undefined && hrec.lev >= 4) ? 0.26 : 0.5;
          hrec.outerMat.opacity = Math.max(hrec.outerMat.opacity, liftLev);
          hrec.innerMat.opacity = Math.max(hrec.innerMat.opacity, liftLev + 0.06);
        }
      }
      if (!selectedId || (selectedRel && selectedRel[hoverId])) {
        edgesOf(hoverId).forEach(function (e) {
          if (e.mat.opacity < 0.6) { e.mat.opacity = 0.6; e.mat.color.setHex(0xa8d8ff); }
        });
      }
    }
  }

  /* ---------------- 搜索 ---------------- */
  var searchInput = document.getElementById('searchInput');
  var searchResultsEl = document.getElementById('searchResults');
  var searchBtn = document.getElementById('searchBtn');
  var searchClear = document.getElementById('searchClear');

  function tokenize(q) {
    return q.toLowerCase().split(/[\s,，、;；/|]+/).filter(function (t) { return t.length > 0; });
  }

  function matchPoint(p, tokens) {
    var hay = (p.name + ' ' + (p.keywords || []).join(' ') + ' ' + p.content + ' ' + boardName(p.board)).toLowerCase();
    for (var i = 0; i < tokens.length; i++) {
      if (hay.indexOf(tokens[i]) === -1) return false;
    }
    return true;
  }

  function doSearch(keepPanel) {
    var q = searchInput.value.trim();
    if (!q) { clearSearch(); return; }
    var tokens = tokenize(q);
    var matches = DB.points.filter(function (p) { return matchPoint(p, tokens); });
    searchMode = true;
    searchSet = {};
    matches.forEach(function (p) { searchSet[p.id] = true; });
    renderResults(matches, tokens.length);
    // 进入搜索态先收起旧的选择(聚焦重排 / 详情卡),避免云层搜索高亮与
    // 详情卡内容不一致;此处 applyVisualState 会以搜索态为准重画。
    if (selectedId && !keepPanel) deselectNode();   // 从关键词标签发起搜索时保留详情面板
    applyVisualState();
    document.getElementById('statBar').textContent =
      '节点 ' + DB.points.length + ' · 关联 ' + edges.length + ' · 命中 ' + matches.length;
  }

  function renderResults(matches, tokenCount) {
    if (!matches.length) {
      searchResultsEl.innerHTML = '<div class="r-count">未找到匹配「' + escapeHtml(searchInput.value.trim()) + '」的知识点</div>';
      searchResultsEl.hidden = false;
      return;
    }
    var sorted = matches.slice().sort(function (a, b) {
      return (b.importance - a.importance) || (b.core - a.core);
    });
    var html = '<ul>';
    sorted.slice(0, 40).forEach(function (p) {
      // p.id 对自定义点来自 localStorage,只校验过"是非空字符串",
      // 不转义就能被篡改成属性/事件注入(getAttribute 会还原转义,点击逻辑不受影响)
      html += '<li data-id="' + escapeHtml(p.id) + '">' +
        '<span class="dot" style="background:' + hexColor(boardColor(p.board)) + '"></span>' +
        '<span class="r-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="r-meta">' + escapeHtml(boardName(p.board)) + ' · ★' + p.importance + ' · 相关度' + p.core + '</span>' +
        '</li>';
    });
    if (sorted.length > 40) html += '<li class="r-count">仅显示前 40 条,共 ' + sorted.length + ' 条</li>';
    html += '</ul>';
    searchResultsEl.innerHTML = html;
    searchResultsEl.hidden = false;
    searchResultsEl.querySelectorAll('li[data-id]').forEach(function (li) {
      li.addEventListener('click', function () {
        pickSearchResult(li.getAttribute('data-id'));
      });
    });
  }

  // 点击搜索结果 == 执行一次点选(selectNode 内会先退出搜索态)
  function pickSearchResult(id) {
    selectNode(id);
  }

  function clearSearch() {
    searchMode = false;
    searchSet = {};
    searchInput.value = '';
    searchResultsEl.hidden = true;
    applyVisualState();
    document.getElementById('statBar').textContent = '节点 ' + DB.points.length + ' · 关联 ' + edges.length;
    // ✕ 的完整复位语义:清除搜索 + 退出聚焦(云回到默认形态,详情面板收起)
    if (selectedId) deselectNode();
  }

  var searchTimer = null;
  var composing = false;    // 中文输入法正在拼字(候选未上屏)
  searchInput.addEventListener('compositionstart', function () {
    // 拼音拼字期间 input 会连续触发,若不挂起防抖就会每 250ms 搜一次生拼音
    composing = true;
    clearTimeout(searchTimer);
    searchTimer = null;
  });
  searchInput.addEventListener('compositionend', function () {
    composing = false;
    // 候选上屏后再触发一次,保证最后一次输入不会被丢掉
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 250);
  });
  searchInput.addEventListener('input', function (e) {
    if (composing || (e && e.isComposing)) return;   // 拼字中:挂起,等 compositionend
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 250);
  });
  searchInput.addEventListener('keydown', function (e) {
    // 输入法候选框里的回车是"上屏",不是提交搜索,否则会先搜一遍未上屏的文本
    if (e.key === 'Enter' && !e.isComposing) { clearTimeout(searchTimer); doSearch(); }
    if (e.key === 'Escape') { clearSearch(); searchInput.blur(); }
  });
  searchBtn.addEventListener('click', doSearch);
  searchClear.addEventListener('click', clearSearch);

  /* ---------------- 板块筛选 ---------------- */
  var boardChecks = {};
  (function buildBoardList() {
    var list = document.getElementById('boardList');
    // 全选 / 全不选:板块多了以后逐个点很烦,而且「全不选」是排错常用动作
    (function boardBulk() {
      var bar = document.createElement('div');
      bar.className = 'board-bulk';
      [['全选', true], ['全不选', false]].forEach(function (pair) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = pair[0];
        b.addEventListener('click', function () {
          DB.boards.forEach(function (bb) { if (boardChecks[bb.id]) boardChecks[bb.id].checked = pair[1]; });
          applyBoardFilter();
          applyVisualState();
        });
        bar.appendChild(b);
      });
      list.parentNode.insertBefore(bar, list);
    })();
    DB.boards.forEach(function (b) {
      var item = document.createElement('label');
      item.className = 'board-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      // 重负载库的词点层(w- 词点,如英语 1113 点)默认收起:入口清爽流畅,
      // 需要全量词点时在左侧勾选"词汇总览·词点层"即可随时展开
      cb.checked = !(HEAVY_CLOUD && b.id === LAYER_BOARD_ID);
      cb.value = b.id;
      boardChecks[b.id] = cb;
      item.appendChild(cb);
      var dot = document.createElement('span');
      dot.className = 'b-dot';
      dot.style.background = hexColor(boardColor(b.id));
      item.appendChild(dot);
      var name = document.createElement('span');
      name.className = 'b-name';
      name.textContent = b.name;
      item.appendChild(name);
      var kind = document.createElement('span');
      kind.className = 'b-kind' + (b.kind === 'major' ? ' major' : '');
      kind.textContent = b.kind === 'major' ? '大板块' : '小板块';
      item.appendChild(kind);
      cb.addEventListener('change', function () {
        // 勾选/取消勾选后:先按板块重设显隐,再按当前模式(默认/搜索/选中)
        // 重画一次样式 —— 重新勾回的板块立即恢复正确颜色与明暗,不会残留旧状态
        applyBoardFilter();
        applyVisualState();
      });
      list.appendChild(item);
    });
  })();
  // 启动即应用一次板块筛选(词点层默认隐藏等重负载默认值立即生效)
  applyBoardFilter();

  /* 板块筛选后的统计:不再是固定总数,而是「可见/总数」,并显示被隐藏的点数,
   * 避免「全部取消勾选后 statBar 仍写着 132」这种自相矛盾。 */
  function updateFilterStat() {
    var el = document.getElementById('statBar');
    if (!el) return;
    var total = DB.points.length, vn = 0;
    DB.points.forEach(function (p) { var r = nodeById[p.id]; if (r && r.boardOn) vn++; });
    var et = edges.length, ve = 0;
    allEdges.forEach(function (e) { if (e.line.visible) ve++; });
    el.textContent = (vn === total)
      ? '节点 ' + total + ' · 关联 ' + et
      : '节点 ' + vn + '/' + total + ' · 关联 ' + ve + '/' + et + ' · 已隐藏 ' + (total - vn) + ' 点';
  }

  function applyBoardFilter() {
    DB.points.forEach(function (p) {
      var vis = boardChecks[p.board] ? boardChecks[p.board].checked : true;
      var rec = nodeById[p.id];
      if (!rec) return;
      rec.boardOn = vis;                       // 板块筛选基准,样式重置/层级显隐均以此为准
      rec.outer.visible = vis;
      rec.inner.visible = vis;
      if (HEAVY_CLOUD) {
        // 重负载:筛选只决定光点显隐,名称仍走"按需点亮"策略
        rec.labelOn = false;
        if (rec.label) rec.label.visible = false;
      } else {
        rec.labelOn = vis;
        rec.label.visible = vis;
      }
      rec.hit.userData.boardVisible = vis;
    });
    allEdges.forEach(function (e) {
      var va = boardChecks[e.edge.a.board] ? boardChecks[e.edge.a.board].checked : true;
      var vb = boardChecks[e.edge.b.board] ? boardChecks[e.edge.b.board].checked : true;
      e.line.visible = va && vb;
    });
    updateFilterStat();     // 必须在点与边都更新完之后再统计,否则关联数滞后一格
    // 正在查看/聚焦的知识点所属板块被取消勾选 → 立即收起其详情与聚焦,
    // 避免界面上残留"该知识点已不存在(被隐藏)"的名称
    if (selectedId) {
      var srec = nodeById[selectedId];
      if (srec && boardChecks[srec.point.board] && !boardChecks[srec.point.board].checked) {
        deselectNode();
      }
    }
  }

  /* ---------------- 交互:悬停 / 点击 / 双击 ---------------- */
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();

  function pickAt(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(allHit, false);
    for (var i = 0; i < hits.length; i++) {
      var u = hits[i].object.userData;
      if (u && u.boardVisible) return u.id;
    }
    return null;
  }

  var hoverTimer = null;
  canvas.addEventListener('pointermove', function (e) {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      var id = pickAt(e.clientX, e.clientY);
      if (id !== hoverId) {
        hoverId = id;
        canvas.style.cursor = id ? 'pointer' : 'grab';
        applyVisualState();
      }
    }, 40);
  });
  // 鼠标移出画布:清除悬停高亮与光标,避免状态残留
  canvas.addEventListener('mouseleave', function () {
    if (hoverId !== null) {
      hoverId = null;
      canvas.style.cursor = 'grab';
      applyVisualState();
    }
  });

  var downPos = null;
  canvas.addEventListener('pointerdown', function (e) {
    downPos = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!downPos) return;
    var dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    downPos = null;
    if (Math.hypot(dx, dy) > 6) return;   // 拖拽旋转,不算点击
    var id = pickAt(e.clientX, e.clientY);
    if (id) selectNode(id);
    else deselectNode();
  });
  canvas.addEventListener('dblclick', function (e) {
    var id = pickAt(e.clientX, e.clientY);
    if (id) { selectNode(id); focusNode(id); }
  });

  /* ---------------- 选中与详情 ---------------- */
  var detailPanel = document.getElementById('detailPanel');

  // 点选是最高优先级的显示状态:任何点选(画布点击 / 搜索结果 / 
  // 详情相关跳转 / 直达参数)都会先退出搜索高亮,显示以点选为准。
  function leaveSearchMode() {
    if (!searchMode) return;
    searchMode = false;
    searchSet = {};
    searchInput.value = '';
    searchResultsEl.hidden = true;
    document.getElementById('statBar').textContent = '节点 ' + DB.points.length + ' · 关联 ' + edges.length;
  }

  function selectNode(id) {
    leaveSearchMode();
    // 经搜索等途径点选到"板块已被取消勾选"的知识点:自动重新显示其板块,
    // 避免出现"选中了却看不到该知识点"的矛盾状态
    var srec0 = nodeById[id];
    if (srec0 && srec0.boardOn === false && boardChecks[srec0.point.board]) {
      boardChecks[srec0.point.board].checked = true;
      applyBoardFilter();
    }
    selectedId = id;
    hoverId = null;
    beginFocusLayout(id);          // 坐标系以该知识点为中心重排
    applyVisualState();
    renderDetail(nodeById[id].point);
    detailPanel.classList.add('open');   // 弹出详情卡
    var rec = nodeById[id];
    if (rec) {
      rec.outer.visible = true;
      rec.inner.visible = true;
      rec.labelOn = rec.boardOn !== false;
      var slb = rec.label || ensureNodeLabel(rec);
      if (slb) slb.visible = rec.labelOn;
    }
  }
  function deselectNode() {
    selectedId = null;
    beginFocusLayout(null);        // 云回到默认的无中心形态
    applyVisualState();
    detailPanel.classList.remove('open');  // 收起详情卡
    /* 注视点平滑归位到原点(若此前镜头因聚焦飞离),距离保持。
     * 这里必须是"覆盖式"重新赋值 camAnim:双击聚焦产生的 0.9s 镜头动画期间
     * 点 ✕ / 空白时 camAnim 仍在飞行,原来的 if (!camAnim) 会让整段归位被跳过,
     * controls.target 停在旧节点而节点已回到默认云,fitFullView 又因
     * camAnim / layoutCenterId 不重算取景 → 视角长期偏在空处。
     * 以当前相机位置为 from 重排一段归位动画,归位必定生效。 */
    var tgt0 = new THREE.Vector3(0, 0, 0);
    var dir0 = new THREE.Vector3().subVectors(camera.position, controls.target);
    var dist0 = Math.max(dir0.length() || 1, 10);
    dir0.normalize();
    camAnim = {
      t: 0, dur: 0.7,
      camFrom: camera.position.clone(),
      camTo: tgt0.clone().addScaledVector(dir0, dist0),
      tgtFrom: controls.target.clone(),
      tgtTo: tgt0.clone()
    };
    // 归位保险:待云/镜头动画结束后,把所有知识点强制"重渲染"一次
    // (显隐/颜色/透明度/缩放/标签纹理全部复位),杜绝真实窗口下的残留。
    clearTimeout(deselectRestyleTimer);
    deselectRestyleTimer = setTimeout(function () {
      if (selectedId || searchMode) return;      // 保险只作用于"回到未选中"状态
      refreshAllNodesDefault();
      syncNodeViews();
    }, 1400);
  }

  // 把全部知识点强制复位为"默认云"的渲染状态(板块勾选为准)
  function refreshAllNodesDefault() {
    resetNodeStyle();
    DB.points.forEach(function (p) {
      var rec = nodeById[p.id];
      if (!rec) return;
      var vis = rec.boardOn !== false;
      rec.outer.visible = vis;
      rec.inner.visible = vis;
      rec.outer.scale.setScalar(rec.outerBase || 1);
      rec.inner.scale.setScalar(rec.innerBase || 1);
      if (rec.outerMat) rec.outerMat.needsUpdate = true;
      if (rec.innerMat) rec.innerMat.needsUpdate = true;
      if (HEAVY_CLOUD) {
        // 重负载复位后保持"默认不常显名称"策略(悬停/选中/搜索仍会点亮)
        rec.labelOn = false;
        if (rec.label) rec.label.visible = false;
      } else if (rec.label && rec.label.material) {
        rec.label.visible = vis;
        rec.label.material.opacity = 1;
        if (rec.label.material.map) rec.label.material.map.needsUpdate = true;
        if (rec.label.material) rec.label.material.needsUpdate = true;
        rec.labelOn = vis;
      } else {
        rec.labelOn = vis;
      }
    });
    allEdges.forEach(function (e) {
      var va = boardChecks[e.edge.a.board] ? boardChecks[e.edge.a.board].checked : true;
      var vb = boardChecks[e.edge.b.board] ? boardChecks[e.edge.b.board].checked : true;
      e.line.visible = va && vb;
      e.mat.opacity = 0.3;
      e.mat.color.setHex(EDGE_COLOR);
    });
  }

  // 只读调试口(不影响任何 UI;供自动化验证节点显隐/配色状态)
  window.__qg3D = {
    recOf: function (id) {
      var r = nodeById[id];
      if (!r) return null;
      return {
        board: r.point.board,
        outerVisible: r.outer.visible,
        labelVisible: r.label ? r.label.visible : false,
        labelOn: r.labelOn,
        outerColor: '#' + r.outerMat.color.getHexString(),
        outerOpacity: r.outerMat.opacity,
        boardOn: r.boardOn === false ? false : true
      };
    },
    allRecs: function () {
      var out = {};
      DB.points.forEach(function (p) {
        var rr2 = nodeById[p.id];
        out[p.id] = { board: p.board, ov: rr2.outer.visible, lv: rr2.label ? rr2.label.visible : false };
      });
      return out;
    },
    select: function (id) { selectNode(id); },
    deselect: function () { deselectNode(); },
    filter: function () { applyBoardFilter(); }
  };

  function renderDetail(p) {
    document.getElementById('dName').textContent = p.name;
    var b = null;
    DB.boards.forEach(function (x) { if (x.id === p.board) b = x; });
    var meta = document.getElementById('dMeta');
    // 教材归属标签:book=册次,unit=英语单元,ch=章节。数据里没有这些字段时不渲染,向后兼容。
    var bookTag = [p.book, p.unit || p.ch].filter(Boolean).join(' · ');
    meta.innerHTML =
      '<span class="tag board" style="color:' + hexColor(p.customColor || boardColor(p.board)) + '">' + escapeHtml(boardName(p.board)) + '</span>' +
      '<span class="tag kind">' + (b && b.kind === 'major' ? '大板块' : '小板块') + '</span>' +
      '<span class="tag imp">★ 重要度 ' + p.importance + '/5</span>' +
      '<span class="tag core">● 相关度 ' + p.core + '/5</span>' +
      (bookTag ? '<span class="tag ch" title="人教版教材归属:' + escapeHtml(bookTag) + '">📖 ' + escapeHtml(bookTag) + '</span>' : '');

    document.getElementById('dContent').innerHTML = renderContentText(p.content);

    // 公式排版:等待 MathJax 就绪后,仅对详情正文触发一次排版(失败不影响阅读)
    var mjEl = document.getElementById('dContent');
    if (window.MathJax) {
      var doTypeset = function () {
        try {
          if (MathJax.typesetPromise) MathJax.typesetPromise([mjEl]);
        } catch (err) { /* 忽略 */ }
      };
      if (MathJax.startup && MathJax.startup.promise) {
        MathJax.startup.promise.then(doTypeset);
      } else {
        setTimeout(doTypeset, 60);
      }
    }

    var kw = document.getElementById('dKeywords');
    kw.innerHTML = '';
    (p.keywords || []).forEach(function (k) {
      var s = document.createElement('span');
      s.className = 'kw';
      s.textContent = k;
      s.addEventListener('click', function () {
        searchInput.value = k;
        doSearch(true);            // true = 保留详情面板(点关键词只是想看看相关命中)
      });
      kw.appendChild(s);
    });

    var linksEl = document.getElementById('dLinks');
    linksEl.innerHTML = '';
    (p.links || []).forEach(function (t) {
      var tp = idToPoint[t];
      if (!tp) return;
      var li = document.createElement('li');
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = hexColor(boardColor(tp.board));
      li.appendChild(dot);
      var span = document.createElement('span');
      span.textContent = tp.name + ' · ' + boardName(tp.board);
      li.appendChild(span);
      li.addEventListener('click', function () {
        selectNode(tp.id);
        focusNode(tp.id);
      });
      linksEl.appendChild(li);
    });
  }

  document.getElementById('dFocus').addEventListener('click', function () {
    if (selectedId) focusNode(selectedId);
  });

  /* 重置视角:转晕了 / 拖到极端角度后的一键复位(与初始机位一致) */
  (function resetView() {
    var btn = document.getElementById('resetViewBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      camera.position.set(70, 50 + CAM_DROP, 76);
      controls.target.set(0, CAM_DROP, 0);
      controls.update();
    });
  })();

  /* ---------------- 界面控件 ----------------
   * 左上按钮 ↔ 抽屉侧栏;分栏头/箭头 ↔ 分栏折叠;✕ ↔ 关闭详情
   */
  (function uiControls() {
    var leftPanelEl = document.getElementById('leftPanel');
    var sideToggle = document.getElementById('sideToggle');
    if (sideToggle && leftPanelEl) {
      sideToggle.addEventListener('click', function () {
        leftPanelEl.classList.toggle('open');
      });
    }
    var closeBtn = document.getElementById('detailClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        deselectNode();
      });
    }
    var secs = document.querySelectorAll('.side-sec');
    Array.prototype.forEach.call(secs, function (sec) {
      var head = sec.querySelector('.sec-head');
      if (head) {
        head.addEventListener('click', function () {
          sec.classList.toggle('collapsed');
        });
      }
    });
  })();

  /* ---------------- 学科切换(按钮形式,六科;数学/物理/化学已开放) ----------------
   * 自定义知识点始终加入"屏幕当前显示科目"的知识云。
   * 切换 = 整页刷新:科目写入 localStorage(qg_subject)并带 ?subject= 参数重载,
   * DB 在启动时按此一次性确定,保证全部闭包数据一致。
   */
  (function subjectSwitcher() {
    var wrap = document.getElementById('subjectWrap');
    var btn = document.getElementById('subjectBtn');
    var menu = document.getElementById('subjectMenu');
    var label = document.getElementById('subjectLabel');
    if (!wrap || !btn || !menu) return;
    var NAMES = {
      chinese: '语文', math: '数学', english: '英语',
      physics: '物理', chemistry: '化学', biology: '生物'
    };
    var OPEN = { math: 1, chemistry: 1, physics: 1, english: 1, biology: 1 };   // 已开放
    // 未开放科目(目前只有语文)在菜单里直接标出,免得点进去才发现是"建设中"
    setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll('#subjectMenu [data-sub]'), function (el) {
        var sub = el.getAttribute('data-sub');
        if (!OPEN[sub] && !/建设中/.test(el.textContent)) {
          el.classList.add('soon');
          el.innerHTML = el.innerHTML + '<span class=\"soon-tag\">建设中</span>';
        }
      });
    }, 0);
    // boot 科目值(math/chem/physics/eng/bio) ↔ 菜单值(math/chemistry/physics/english/biology)
    var MENU_OF = { math: 'math', chem: 'chemistry', physics: 'physics', eng: 'english', bio: 'biology' };
    var KEY_OF = { math: 'math', chemistry: 'chem', physics: 'physics', english: 'eng', biology: 'bio' };
    var SUB_LONG = { math: '高中数学', chemistry: '高中化学', physics: '高中物理', english: '高中英语', biology: '高中生物' };
    var SEARCH_PH = {
      math: '关键词搜索,如:导数 / 椭圆 / 方差 / 正弦定理 / 二面角 …',
      chemistry: '关键词搜索,如:氧化还原 / 阿伏伽德罗常数 / 盐类水解 / 官能团 / 晶胞 …',
      physics: '关键词搜索,如:牛顿第二定律 / 动能定理 / 电磁感应 / 平抛 / 光电效应 …',
      english: '关键词搜索,如:词根 ject / 定语从句 / 虚拟语气 / 句型 so...that / take off …',
      biology: '关键词搜索,如:细胞膜 / 光合作用 / 分离定律 / 神经调节 / 种群数量 / PCR …'
    };
    var cur = MENU_OF[window.CUR_SUBJECT] || 'math';
    var toastTimer = null;
    function showToast(msg) {
      var t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
    }
    window.__showToast = showToast;
    function closeMenu() {
      menu.hidden = true;
      wrap.classList.remove('open');
    }
    // 启动文案:科目名、激活按钮、页面标题、品牌副标题、搜索占位
    label.textContent = NAMES[cur];
    Array.prototype.forEach.call(menu.querySelectorAll('button[data-sub]'), function (x) {
      x.classList.toggle('active', x.getAttribute('data-sub') === cur);
    });
    document.title = '穷观 V2.4.2 · ' + SUB_LONG[cur] + '知识网络';
    var subEl = document.querySelector('.brand .sub');
    if (subEl) subEl.textContent = SUB_LONG[cur] + ' · 3D 知识网络';
    var si = document.getElementById('searchInput');
    if (si) si.placeholder = SEARCH_PH[cur] || SEARCH_PH.math;
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (menu.hidden) { menu.hidden = false; wrap.classList.add('open'); }
      else closeMenu();
    });
    // 学科切换:不重放开场动画 —— 当前画面缓慢淡出(遮罩),
    // 暗屏期整页装载新科目,新页加载完成后遮罩缓慢淡出揭示新学科画面。
    var switching = false;
    menu.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button[data-sub]') : null;
      if (!b) return;
      var sub = b.getAttribute('data-sub');
      closeMenu();
      if (!OPEN[sub]) {
        showToast('「' + (NAMES[sub] || sub) + '」知识云建设中,当前开放:数学 / 化学 / 物理 / 英语 / 生物');
        return;
      }
      if (sub === cur) return;
      if (switching) return;
      switching = true;
      // 第 1 步:当前画面缓慢淡出
      var mask = document.getElementById('xmask');
      if (mask) mask.classList.add('on');
      try { sessionStorage.setItem('qg_xin', '1'); } catch (e) { /* 忽略 */ }
      // 第 2 步:暗屏期装载目标科目(整页刷新,不触发开场)。
      // 放慢节奏:等遮罩完全变暗后再多停留片刻,给新页装载留足时间。
      var k = KEY_OF[sub];
      setTimeout(function () {
        try { localStorage.setItem('qg_subject', k); } catch (e2) { /* 忽略 */ }
        window.location.href = window.location.pathname + (k === 'math' ? '' : '?subject=' + k);
      }, 1200);
    });
    document.addEventListener('click', function () {
      if (!menu.hidden) closeMenu();
    });
  })();

  /* ---------------- 知识云重排:聚焦动态坐标系 ----------------
   * 聚焦(选中)某知识点时,三维空间以它为新的中心重排:
   *   平面距离 = 与聚焦点的相关度(按连线层数 hop 分层:
   *               直接相关最近 → 间接次之 → 无关最远);
   *   高度 Y   = 重要性(层级语义始终不变,任何视角下都有效);
   * 取消聚焦时,整片云平滑回到默认的无中心力导向形态。
   */
  var layoutCenterId = null;   // 当前重排中心(null = 默认云)
  var nodeTween = {};          // 节点移动动画
  var lastFrame = null;

  function relayoutTargets(centerId) {
    var targets = {};
    var pts = DB.points;
    if (centerId == null) {
      pts.forEach(function (p) { targets[p.id] = { x: p._defX, z: p._defZ }; });
      return targets;
    }
    // BFS:该知识点与聚焦中心之间的相关度(连线层数)
    var adj = {};
    pts.forEach(function (p) { adj[p.id] = []; });
    edges.forEach(function (e) {
      adj[e.a.id].push(e.b.id);
      adj[e.b.id].push(e.a.id);
    });
    var hop = {};
    var q = [centerId];
    hop[centerId] = 0;
    while (q.length) {
      var c = q.shift();
      var nh = hop[c] + 1;
      if (nh > 4) continue;
      adj[c].forEach(function (nb) {
        if (hop[nb] === undefined) { hop[nb] = nh; q.push(nb); }
      });
    }
    // 分层半径:直接相关最近,无关最远
    var layerR = { 0: 0, 1: 12, 2: 24, 3: 36, 4: 46 };
    var layerList = {};
    pts.forEach(function (p) {
      var h = p.id === centerId ? 0 : (hop[p.id] === undefined ? 4 : Math.min(hop[p.id], 4));
      (layerList[h] = layerList[h] || []).push(p.id);
    });
    var base = Math.random() * Math.PI * 2;
    Object.keys(layerList).forEach(function (h) {
      var list = layerList[h];
      if (h === '0') { targets[centerId] = { x: 0, z: 0 }; return; }
      list.sort(function (a, b) {
        var ba = idToPoint[a].board, bb = idToPoint[b].board;
        return ba < bb ? -1 : (ba > bb ? 1 : 0);
      });
      var R = layerR[h];
      list.forEach(function (id, i) {
        var a = base + (i + 0.5) / list.length * Math.PI * 2;
        var rad = R + (Math.random() - 0.5) * 2.2;
        targets[id] = { x: rad * Math.cos(a), z: rad * Math.sin(a) };
      });
    });
    targets[centerId] = { x: 0, z: 0 };
    // 保底:高度不同但水平投影接近的节点互相推开,避免重合
    var idl = pts.map(function (p) { return p.id; });
    var sepMax = HEAVY_CLOUD ? 4 : 140;   // 重负载:仅少量推开迭代,避免 O(n²) 卡顿
    for (var it = 0; it < sepMax; it++) {
      var moved = 0;
      for (var i = 0; i < idl.length; i++) {
        for (var j = i + 1; j < idl.length; j++) {
          var A = targets[idl[i]], B = targets[idl[j]];
          var dx = A.x - B.x, dz = A.z - B.z;
          var d2 = dx * dx + dz * dz;
          var ms = Math.max(2.4, (visualR[idl[i]] + visualR[idl[j]]) * 0.62);
          if (d2 < ms * ms && d2 > 1e-8) {
            var d = Math.sqrt(d2);
            var pu = (ms - d) / d * 0.5;
            A.x += dx * pu * 0.5; A.z += dz * pu * 0.5;
            B.x -= dx * pu * 0.5; B.z -= dz * pu * 0.5;
            moved++;
          }
        }
      }
      if (!moved) break;
    }
    return targets;
  }

  // 发起重排:每个节点从当前位置平滑移动到新坐标系位置
  function beginFocusLayout(id) {
    if (layoutCenterId === id) return;   // 中心未变,不重复重排
    layoutCenterId = id;
    var targets = relayoutTargets(id);
    DB.points.forEach(function (p) {
      var t = targets[p.id];
      nodeTween[p.id] = {
        el: 0, dur: 1.1,
        fx: p._pos.x, fz: p._pos.z,
        tx: t.x, tz: t.z
      };
    });
  }

  // 重排进行时,让光点/标签/命中体/连线跟随节点新位置
  function syncNodeViews() {
    DB.points.forEach(function (p) {
      var rec = nodeById[p.id];
      rec.outer.position.copy(p._pos);
      rec.inner.position.copy(p._pos);
      rec.hit.position.copy(p._pos);
      if (rec.label) rec.label.position.set(p._pos.x, p._pos.y + rec.labelOff, p._pos.z);
    });
  }

  /* ---------------- 相机聚焦动画 ---------------- */
  function focusNode(id) {
    var rec = nodeById[id];
    if (!rec) return;
    var pos = rec.point._pos;
    // 若该节点是当前重排中心(正移向坐标原点),相机以终点为准
    var tgt = new THREE.Vector3(pos.x, pos.y, pos.z);
    if (id === selectedId && layoutCenterId === id) { tgt.x = 0; tgt.z = 0; }
    var dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.6, 1).normalize();
    var dist = 15 + rec.point.importance * 2.2;
    camAnim = {
      t: 0, dur: 0.9,
      camFrom: camera.position.clone(),
      camTo: tgt.clone().addScaledVector(dir, dist),
      tgtFrom: controls.target.clone(),
      tgtTo: tgt.clone()
    };
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ---------------- 动画循环 ---------------- */
  function animate() {
    requestAnimationFrame(animate);
    var now = performance.now() / 1000;
    var dt = lastFrame == null ? 1 / 60 : Math.min(now - lastFrame, 0.08);
    lastFrame = now;

    if (camAnim) {
      camAnim.t += dt;                     // 按真实帧时间推进(低帧率不拖慢)
      var k = Math.min(camAnim.t / camAnim.dur, 1);
      var e = easeInOutCubic(k);
      camera.position.lerpVectors(camAnim.camFrom, camAnim.camTo, e);
      controls.target.lerpVectors(camAnim.tgtFrom, camAnim.tgtTo, e);
      if (k >= 1) camAnim = null;
    }
    controls.update();

    // 知识云重排动画:节点平滑滑向(离开)聚焦坐标系
    var hadTween = false;
    DB.points.forEach(function (p) {
      var tw = nodeTween[p.id];
      if (!tw) return;
      hadTween = true;
      tw.el += dt;
      var kk = Math.min(1, tw.el / tw.dur);
      var ee = easeInOutCubic(kk);
      p._pos.x = tw.fx + (tw.tx - tw.fx) * ee;
      p._pos.z = tw.fz + (tw.tz - tw.fz) * ee;
      if (kk >= 1) nodeTween[p.id] = null;
    });
    if (hadTween) {          // 仅重排期间同步子对象与连线,静态时零开销
      syncNodeViews();
      syncEdges();
    }

    // 动态光点:呼吸脉动 + 标签 LOD
    var camPos = camera.position;
    DB.points.forEach(function (p) {
      var rec = nodeById[p.id];
      if (!rec || !rec.outer.visible) return;
      var isSel = p.id === selectedId;
      var isHov = p.id === hoverId;
      var isHit = searchMode && !!searchSet[p.id];

      // 每个光点独立相位,缓慢呼吸 + 轻微高频颤动(星光感)
      var t1 = now * 2.0 + rec.ph;
      var t2 = now * 5.3 + rec.ph * 2.7;
      var emph = isSel ? 1.3 : (isHov ? 1.12 : (isHit ? 1.18 : 1));
      var pulse = (isSel || isHit ? 0.16 : 0.07) * (1 + Math.sin(t1));
      rec.outer.scale.setScalar(rec.outerBase * emph * (1 + pulse) * (1 + 0.05 * Math.sin(t2)));
      rec.inner.scale.setScalar(rec.innerBase * emph * (1 + pulse * 1.4) * (1 + 0.05 * Math.sin(t2 + 1.4)));

      // 待机漂浮:每个光点按自身相位缓慢上下浮动(±0.26 单位,约为云半径的 1%),
      // 相邻点相位不同 → 整片云看起来在"呼吸"。基准位置 p._pos 不变,
      // 重排动画结束时 syncNodeViews() 会按 p._pos 复位,两者不冲突。
      var dy = 0.26 * Math.sin(now * 0.8 + rec.ph * 1.7);
      rec.outer.position.y = p._pos.y + dy;
      rec.inner.position.y = p._pos.y + dy;
      rec.hit.position.y = p._pos.y + dy;
      if (rec.label) rec.label.position.y = p._pos.y + rec.labelOff + dy;

      // 标签:仅当"该显示"(板块可见 + 搜索命中/悬停/选中的 labelOn)且足够近时显示。
      // 板块判定必须在这里再查一次:labelOn 只是"意向",任何让 outer.visible 变回 true
      // 却没重查板块的路径,都可能让隐藏板块的名称复现(labelOn 与 boardOn 不能各说各话)。
      if (rec.labelOn && rec.boardOn !== false && camPos.distanceTo(p._pos) < 170) {
        // 重负载库的标签按需生成:只有真正要显示时才建这一张画布纹理,
        // 不再开屏预建上千张(概念节点原先预生成 → 改为首次需要时生成,显示行为不变);
        // 词点层仍只在悬停/选中时由 ensureNodeLabel 生成,避免选中词根时
        // 一帧之内连建上千张纹理
        var lb2 = rec.label;
        if (!lb2 && (!HEAVY_CLOUD || p.board !== LAYER_BOARD_ID)) lb2 = ensureNodeLabel(rec);
        if (lb2) lb2.visible = true;
      } else if (rec.label) {
        rec.label.visible = false;
      }
    });

    renderer.render(scene, camera);
  }

  /* ---------------- 窗口变化适配(全屏跟随) ----------------
   * 1) 渲染尺寸 / 宽高比跟随容器(窗口缩放、最大化、DPI 变化);
   * 2) 「比例取景」:窗口变宽/变高时,相机按比例拉近/拉远,
   *    让知识云始终撑满画布(横向 ≈92%,纵向保证完整),
   *    全屏后词云随之充满全屏,而不是缩在中间一小块;
   * 3) 保留用户手动缩放的比例(缩放意向 keep 不变),
   *    聚焦近看 / 镜头飞行中不打扰;
   * 4) ResizeObserver 监听画布容器,兜底各类布局变化。
   */
  var lastFullD = null;      // 上次"撑满距离"(用于判定相机是否被用户动过)
  function fitFullView() {
    if (!controls) return;
    if (camAnim || layoutCenterId != null) return;   // 聚焦近看/飞行中:不打扰
    var asp = camera.aspect || 16 / 9;
    var halfV = camera.fov * Math.PI / 360;          // 垂直半视场角
    var halfH = Math.atan(Math.tan(halfV) * asp);    // 水平半视场角
    // 云(含楼层参考环)横向占画布约 92% 所需距离
    var fullD = 58 / (Math.tan(halfH) * 0.92);
    // 纵向需求:顶部标签 ~Y_MAX+6 到底部环,保证完整可见
    var fullV = 42 / Math.tan(halfV);
    if (fullD < fullV) fullD = fullV;
    var dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    var d = dir.length() || 1;
    lastFullD = fullD;
    // 用户刻意近看细节(远小于填充距)或拉远留白(远大于填充距):尊重用户视角
    if (d < fullD * 0.55 || d > fullD * 1.6) return;
    if (Math.abs(d - fullD) < 0.02) return;          // 已就位
    dir.normalize();
    var tgt = controls.target.clone();
    var to = tgt.clone().addScaledVector(dir, fullD);
    // 平滑移动到新取景距离(注视点不变)
    camAnim = {
      t: 0, dur: 0.5,
      camFrom: camera.position.clone(),
      camTo: to,
      tgtFrom: tgt.clone(),
      tgtTo: tgt.clone()
    };
  }
  var fitTimer = null;
  function onViewportChange() {
    syncSize();
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitFullView, 120);             // 等 syncSize 完成 aspect 更新
  }
  window.addEventListener('resize', onViewportChange);
  if (window.ResizeObserver) {
    try {
      new ResizeObserver(onViewportChange).observe(canvas.parentNode);
    } catch (e) { /* 忽略 */ }
  }
  // 布局稳定后再校准两次渲染尺寸,防止初始尺寸为 0 导致画布全黑
  setTimeout(onViewportChange, 300);
  setTimeout(onViewportChange, 1000);

  /* ---------------- 启动 ---------------- */
  document.getElementById('statBar').textContent = '节点 ' + DB.points.length + ' · 关联 ' + edges.length;
  applyVisualState();
  animate();

  // 直达聚焦:?focus=<知识点id> 打开即聚焦该知识点(重排坐标系 + 高亮)
  var fm = /[?&]focus=([A-Za-z0-9_-]+)/.exec(window.location.search);
  if (fm && idToPoint[fm[1]]) {
    (function (fid) {
      setTimeout(function () { selectNode(fid); }, 350);
      setTimeout(function () { focusNode(fid); }, 700);
    })(fm[1]);
  }

  // 数据完整性自查(控制台)
  var bad = DB.points.filter(function (p) {
    return !(p.links || []).every(function (t) { return !!idToPoint[t]; });
  });
  if (bad.length) console.warn('存在无效关联的节点:', bad.map(function (p) { return p.name; }));
  console.log('[知识库] ' + (DB.subjectName || window.CUR_SUBJECT) + ' ' + DB.points.length + ' 个知识点 / ' + edges.length + ' 条关联,' + DB.boards.length + ' 个板块');

  /* ============================================================
   * 定义新知识点(左侧边栏表单)
   * 新节点按「未选中时的坐标系(默认云)」放置:
   *   有自选关联 → 以关联点默认云位置的重心为锚,带随机偏移;
   *   无关联      → 在云外缘随机取位;随后迭代推开保证不重叠。
   * 高度仍由用户自选的重要度决定。
   * ============================================================ */
  (function customNodeUI() {
    var CUSTOM_KEY = 'qg_custom_points_v1';
    function $(id) { return document.getElementById(id); }
    var sec = $('newNodeSec');
    if (!sec) return;
    var nameEl = $('nnName'), colorEl = $('nnColor'), impEl = $('nnImp'),
      impVal = $('nnImpVal'), keysEl = $('nnKeys'), linkInput = $('nnLinkInput'),
      linkHint = $('nnLinkHint'), linkChips = $('nnLinkChips'),
      contentEl = $('nnContent'), submitBtn = $('nnSubmit'), msgEl = $('nnMsg'),
      boardSelect = $('nnBoard'), swatchesEl = $('nnSwatches'),
      colorTextEl = $('nnColorText');

    if (!submitBtn) return;
    var pickedLinks = [];      // 已选关联 id

    // —— 文案按当前科目动态化(板块数 / 色板说明) ——
    var btEl = document.getElementById('nnBoardTip');
    if (btEl) btEl.textContent = '底层分类始终为该科目固定的 ' + DB.boards.length + ' 个板块';
    var ctEl = document.getElementById('nnColorTip');
    if (ctEl) ctEl.textContent = '也可点下方色块直接选用该科目各板块的固有颜色';

    // —— 所属板块(底层永远是十大板块)+ 板块固有颜色 ——
    // 填充板块下拉:大板块组 / 小板块组
    (function initBoardUI() {
      var majors = [], minors = [];
      DB.boards.forEach(function (b) {
        (b.kind === 'major' ? majors : minors).push(b);
      });
      function addGroup(label, list) {
        if (!list.length) return;
        var og = document.createElement('optgroup');
        og.label = label;
        list.forEach(function (b) {
          var op = document.createElement('option');
          op.value = b.id;
          op.textContent = b.name;
          og.appendChild(op);
        });
        boardSelect.appendChild(og);
      }
      addGroup('大板块', majors);
      addGroup('小板块', minors);
      // 色板:十个板块固有颜色(点击=选板块并取其固有颜色)
      var all = majors.concat(minors);
      function markSelSwatch(bid) {
        Array.prototype.forEach.call(swatchesEl.querySelectorAll('.swatch.sel'), function (s) {
          s.classList.remove('sel');
        });
        if (bid) {
          var t = swatchesEl.querySelector('.swatch[data-board="' + bid + '"]');
          if (t) t.classList.add('sel');
        }
      }
      all.forEach(function (b) {
        var sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'swatch';
        sw.title = b.name + '(板块固有颜色)';
        sw.style.background = hexColor(boardColor(b.id));
        sw.setAttribute('data-board', b.id);
        sw.addEventListener('click', function () {
          boardSelect.value = b.id;
          if (colorEl.dataset.manual) delete colorEl.dataset.manual;  // 点色板=重新跟随板块色
          pickBoardColor(b.id);
        });
        swatchesEl.appendChild(sw);
      });
      function pickBoardColor(bid) {
        var c = hexColor(boardColor(bid));
        colorEl.value = c;
        if (colorTextEl) colorTextEl.textContent = c;
        markSelSwatch(bid);
      }
      window.__pickBoardColor = pickBoardColor;
      // 板块下拉联动:选择板块时给出其固有颜色(不覆盖用户已自定义的颜色提示由 msg 说明)
      boardSelect.addEventListener('change', function () {
        var bid = boardSelect.value;
        if (!colorEl.dataset.manual) pickBoardColor(bid);
      });
      // 手动改色标记(自定义颜色时取消色板选中高亮)
      colorEl.addEventListener('input', function () {
        colorEl.dataset.manual = '1';
        if (colorTextEl) colorTextEl.textContent = colorEl.value;
        markSelSwatch(null);
      });
      // 默认板块:第一个(函数与导数),并给其固有颜色(含色板选中高亮)
      if (all.length) {
        boardSelect.value = all[0].id;
        pickBoardColor(all[0].id);
      }
    })();

    // 重要度滑条联动
    impEl.addEventListener('input', function () {
      impVal.textContent = impEl.value + ' / 5';
    });

    // 关联选择:输入过滤 → 候选列表 → 点击添加 chip
    linkInput.addEventListener('input', function () {
      var q = linkInput.value.trim().toLowerCase();
      if (!q) { linkHint.innerHTML = ''; return; }
      var cands = DB.points.filter(function (p) {
        if (pickedLinks.indexOf(p.id) >= 0) return false;
        return (p.name.toLowerCase().indexOf(q) >= 0 ||
          (p.keywords || []).some(function (k) { return k.toLowerCase().indexOf(q) >= 0; }));
      }).slice(0, 8);
      linkHint.innerHTML = '';
      cands.forEach(function (p) {
        var d = document.createElement('div');
        d.className = 'link-cand';
        d.innerHTML = '<span class="dot" style="background:' + hexColor(p.customColor || boardColor(p.board)) + '"></span>' +
          '<span class="lc-name">' + escapeHtml(p.name) + '</span>' +
          '<span class="lc-board">' + escapeHtml(boardName(p.board)) + '</span>';
        d.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          addLinkChip(p);
          linkInput.value = '';
          linkHint.innerHTML = '';
        });
        linkHint.appendChild(d);
      });
    });
    function addLinkChip(p) {
      if (pickedLinks.indexOf(p.id) >= 0) return;
      pickedLinks.push(p.id);
      var chip = document.createElement('span');
      chip.className = 'link-chip';
      chip.innerHTML = '<span class="dot" style="background:' + hexColor(p.customColor || boardColor(p.board)) + '"></span>' +
        '<span>' + escapeHtml(p.name) + '</span><b title="移除">×</b>';
      chip.querySelector('b').addEventListener('click', function () {
        var i = pickedLinks.indexOf(p.id);
        if (i >= 0) pickedLinks.splice(i, 1);
        chip.remove();
      });
      linkChips.appendChild(chip);
    }

    // —— 核心:把一个完整的新知识点挂入知识云 ——
    // 坐标系按「未选中时的默认云」规则放置:
    // 有关联 → 以关联点默认云位置重心为锚 + 随机偏移;无关联 → 云外缘随机;
    // 之后迭代推开保证不与既有节点重叠;高度由重要度决定。
    function commitCustomPointCore(p) {
      // 视觉半径先就位(定位排斥计算需要),避免 NaN
      visualR[p.id] = 1.05 + p.importance * 0.22;
      var ax = 0, az = 0, cnt = 0, x, z;
      p.links.forEach(function (t) {
        var q = idToPoint[t];
        if (q && typeof q._defX === 'number' && typeof q._defZ === 'number') {
          ax += q._defX; az += q._defZ; cnt++;
        }
      });
      if (cnt) {
        x = ax / cnt + (Math.random() - 0.5) * 16;
        z = az / cnt + (Math.random() - 0.5) * 16;
      } else {
        var a = Math.random() * Math.PI * 2;
        var r = 32 + Math.random() * 18;
        x = r * Math.cos(a); z = r * Math.sin(a);
      }
      var sepItMax = HEAVY_CLOUD ? 8 : 160;   // 重负载:减少全库推开迭代,仍保证基本不重叠
      for (var it = 0; it < sepItMax; it++) {
        var moved = false;
        DB.points.forEach(function (q) {
          if (q === p) return;
          var qx = (typeof q._defX === 'number') ? q._defX : q._pos.x;
          var qz = (typeof q._defZ === 'number') ? q._defZ : q._pos.z;
          var dx = x - qx, dz = z - qz;
          var sep = Math.max(2.6, (visualR[p.id] + visualR[q.id]) * 0.62);
          var d2 = dx * dx + dz * dz;
          if (d2 < sep * sep && d2 > 1e-8) {
            var d = Math.sqrt(d2);
            var push = (sep - d) / d * 0.8;
            x += dx * push; z += dz * push;
            moved = true;
          }
        });
        if (!moved) break;
      }
      var y = Y_MIN + (Y_MAX - Y_MIN) * (p.importance - 1) / 4;
      p._pos = new THREE.Vector3(x, y, z);
      p._defX = x; p._defZ = z;

      // 挂入数据与场景
      DB.points.push(p);
      idToPoint[p.id] = p;
      addPointRender(p);
      p.links.forEach(function (t) {
        var b = idToPoint[t];
        if (!b) return;
        var key = p.id < b.id ? p.id + '|' + b.id : b.id + '|' + p.id;
        if (edgeSet[key]) return;
        edgeSet[key] = true;
        var e = { a: p, b: b, key: key };
        edges.push(e);
        addEdgeRender(e);
      });
      saveCustomPoints();
      // 若正处于聚焦态,回到默认云(新点本身就在默认坐标,视觉一致)
      if (selectedId !== null || layoutCenterId !== null) deselectNode();
      else applyVisualState();
      document.getElementById('statBar').textContent = '节点 ' + DB.points.length + ' · 关联 ' + edges.length;
      // 选中新节点并弹出详情,让用户确认。
      // 但该点所属板块当前被取消勾选时,绝不选中它:selectNode 会自动把该板块
      // 重新勾上(那是给"搜索/详情跳转"用的),那样"取消勾选的板块里不该出现新点"
      // 的筛选语义就被绕过了 —— 新点必须连光点、名称、悬停、点击一起保持不可见。
      var bcNew = boardChecks[p.board];
      if (!bcNew || bcNew.checked) selectNode(p.id);
      return p;
    }

    // 提交
    submitBtn.addEventListener('click', function () {
      msgEl.textContent = '';
      var name = nameEl.value.trim();
      if (!name) { msgEl.textContent = '请填写知识点名称'; return; }
      var board = boardSelect ? boardSelect.value : '';
      if (!isRealBoard(board)) { msgEl.textContent = '请先选择所属板块'; return; }
      var id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      while (idToPoint[id]) { id = 'u' + Math.random().toString(36).slice(2, 10); }
      var imp = Math.min(5, Math.max(1, Math.round(Number(impEl.value) || 3)));
      var color = /^#[0-9a-fA-F]{6}$/.test(colorEl.value) ? colorEl.value : null;
      var keys = keysEl.value.split(/[,，、;；]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      var content = contentEl.value.trim();
      var links = pickedLinks.slice().filter(function (t) { return !!idToPoint[t]; });

      var p = commitCustomPointCore({
        id: id, name: name, board: board, user: true,
        subject: DB.subject,
        importance: imp, core: 3,
        keywords: keys, content: content,
        links: links, customColor: color
      });
      msgEl.textContent = p
        ? ((!boardChecks[board] || boardChecks[board].checked)
          ? '✓ 已加入知识云(点 ✕ 退出聚焦回到全网)'
          : '✓ 已加入,但「' + boardName(board) + '」当前未勾选,勾选该板块后即可看到')
        : '加入失败';
      nameEl.value = ''; keysEl.value = ''; contentEl.value = '';
      linkInput.value = ''; linkHint.innerHTML = '';
      pickedLinks = [];
      linkChips.innerHTML = '';
    });

    // 自动化验证钩子:?autoadd=1 追加一个演示自定义节点(仅数学页,无 UI 依赖)
    if (/[?&]autoadd=1/.test(window.location.search) && window.CUR_SUBJECT === 'math') {
      setTimeout(function () {
        commitCustomPointCore({
          id: 'u' + Date.now().toString(36),
          name: '测试:圆锥曲线的光学性质', board: 'analytic', user: true,
          subject: DB.subject,
          importance: 4, core: 3,
          keywords: ['光学性质', '焦点', '反射'],
          content: '**定义** 从椭圆(双曲线、抛物线)一个焦点发出的光线,经曲线反射后必过另一个焦点(抛物线反射后平行于对称轴)。\n**核心公式** 抛物线 $y^{2}=2px$ 的焦点反射性质:入射角 $=$ 反射角。',
          links: ['ana-parabola', 'ana-focus-chord', 'ana-ellipse'],
          customColor: '#ff7043'
        });
      }, 800);
    }
  })();

})();

/* ============================================================
 * 开场画面交互:任意键 / 鼠标点击 → 开场整体缓慢淡出(至黑屏)
 * → 主界面再浮现(?skip=1 参数跳过开场,用于调试与自动化测试)
 * ============================================================ */
(function () {
  var intro = document.getElementById('intro');
  if (!intro) return;
  var app = document.getElementById('app');
  var docEl = document.documentElement;
  docEl.classList.add('intro-live');   // 开场期间页面背景纯黑

  // 右下角「训练」按钮:待主界面完全显示后才出现
  function showTrainBtn() {
    var b = document.getElementById('trainBtn');
    if (b) b.classList.add('show');
  }

  var mask = document.getElementById('xmask');
  var xin = false;
  try { xin = sessionStorage.getItem('qg_xin') === '1'; } catch (e) { /* 忽略 */ }
  var fromSwitch = /[?&]subject=/.test(window.location.search);

  if (/[?&]skip=1/.test(window.location.search)) {
    app.style.transition = 'none';
    app.classList.add('reveal');
    docEl.classList.remove('intro-live');
    intro.style.display = 'none';
    showTrainBtn();
    return;
  }

  // 学科切换进入:不播放开场动画 —— 遮罩即刻全遮(无过渡),
  // 主界面就绪后先暗屏停留片刻,再缓慢淡出遮罩,浮现新学科画面。
  if (xin || fromSwitch) {
    try { sessionStorage.removeItem('qg_xin'); } catch (e) { /* 忽略 */ }
    docEl.classList.remove('intro-live');
    intro.style.display = 'none';
    app.classList.add('reveal');
    app.style.transition = 'opacity 0.8s ease';
    if (mask) {
      mask.style.transition = 'none';
      mask.style.opacity = '1';
      mask.style.pointerEvents = 'auto';
      void mask.offsetWidth;              // 强制应用初始全遮
      // 暗屏 0.6s:给脚本装载 / 知识云首帧渲染留时间,再缓慢淡入(1.2s)
      setTimeout(function () {
        mask.style.pointerEvents = 'none';
        mask.style.transition = 'opacity 1.2s ease';
        mask.style.opacity = '0';
      }, 600);
    }
    // 遮罩完全淡出(约 0.6+1.2s)后,新学科画面彻底呈现,再亮出训练按钮
    setTimeout(showTrainBtn, 2100);
    return;
  }

  var entered = false;
  function enterApp() {
    if (entered) return;
    entered = true;
    window.removeEventListener('keydown', enterApp);
    window.removeEventListener('pointerdown', enterApp);

    // 第 1 步:开场(文字 + 渐变)整体缓慢淡化(1.4s)
    intro.classList.add('exit');

    // 第 2 步:淡出完成后移除开场层,短暂黑屏(0.4s)
    setTimeout(function () {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      docEl.classList.remove('intro-live');
      // 第 3 步:主界面从黑屏中浮现(1.8s 淡入)
      setTimeout(function () {
        app.classList.add('reveal');
        // 第 4 步:主界面完全淡入完成后再显示训练按钮
        setTimeout(showTrainBtn, 1900);
      }, 400);
    }, 1450);
  }

  window.addEventListener('keydown', enterApp);
  window.addEventListener('pointerdown', enterApp);
})();
