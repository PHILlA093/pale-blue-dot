/* ============================================================
 * demo.js — 观澜 · AI 演示问答(浮动面板 + 独立窗)(穷观 V2.4.2)
 * 位置:主窗 index.html,在 app.js / mainbridge.js 之后加载。
 * 依赖:
 *   1) 对话状态仅内存(var conv,不写 localStorage;关闭应用即清空);
 *      唯一写入 localStorage 的是 DeepSeek API Key('qg_ds_key',
 *      与破卷 train.js 共用)与模型名('qg_ds_model')。
 *   2) 宿主通道写法与 train.js 一致(chrome.webview + _seq + pending,
 *      180 秒超时);网页版无宿主时 fetch 直连 DeepSeek 兜底。
 *   3) 画布(#glCanvas)与动态演示留待下一阶段,本文件不触碰画布逻辑。
 * ============================================================ */
(function () {
  'use strict';
  var LS_KEY = 'qg_ds_key';
  var LS_MODEL = 'qg_ds_model';
  var MAX_HIST = 12;          // 送入模型的最近对话条数上限
  var HOST_TIMEOUT = 180000;  // 宿主请求超时(毫秒)
  var ORIGIN_TAG = 'QG-20260920-5e5d5a-A';  // 原创工程标识(仅留存,不参与任何逻辑)

  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  ['guanlanOpen', 'guanlan', 'glClose', 'glClearText', 'glCtx', 'glMsgs',
   'glKeyRow', 'glKeyInput', 'glKeySave', 'glAsk', 'glSend', 'glStageTip']
    .forEach(function (id) { els[id] = $(id); });

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 忽略 */ } }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- 对话状态(仅内存) ---------- */
  var conv = [];             // [{role:'user'|'assistant', content:String}]
  var busy = false;          // 发送防重

  /* ---------- 固定中文系统提示 ---------- */
  var SYS_TXT = '你是"穷观"的全科讲解老师(数学 / 物理 / 化学 / 生物 / 语文 / 英语等),' +
    '面向高中学生讲解题目与知识点。要求:1) 讲解简洁清楚,可用"思路 / 步骤 / 易错点"的方式展开;' +
    '2) 公式用 $...$ 书写(支持 LaTeX 语法);3) 若题目适合配示意图或动态演示辅助理解' +
    '(如函数图像、轨迹、几何构造等),可在结尾简单说明"可生成动态演示"。';

  /* ---------- 当前上下文读取(科目 + 详情卡选中知识点) ---------- */

  // 独立窗(guanlan.html)里**没有** #subjectLabel / #detailPanel,
  // 于是每条请求都带着"当前科目:未知;当前知识点:未选中" —— 拆窗后上下文等于丢了。
  // 这里回退读主窗发布的心跳(qg_live_state),独立窗照样能拿到正确的科目与知识点。
  function liveState() {
    try {
      var raw = localStorage.getItem('qg_live_state');
      if (!raw) return null;
      var o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }
  // 读 #subjectLabel 文本,补"高中"前缀以与界面文案一致(如"高中数学")
  function readSubj() {
    var lb = null;
    try { lb = $('subjectLabel'); } catch (e) { /* 忽略 */ }
    var s = lb ? String(lb.textContent || '').trim() : '';
    if (!s) { var ls = liveState(); if (ls && ls.subjectName) s = String(ls.subjectName).trim(); }
    if (s && s.indexOf('高中') !== 0) s = '高中' + s;
    return s;
  }
  // 详情卡打开且有知识点名时返回其名,否则空串(全程 try 保护)
  function readPoint() {
    var dp = null, dn = null, name = '';
    try { dp = $('detailPanel'); } catch (e) { /* 忽略 */ }
    var open = false;
    if (dp) { try { open = !!(dp.classList && dp.classList.contains('open')); } catch (e) { open = false; } }
    if (open) {
      try { dn = $('dName'); } catch (e) { dn = null; }
      if (dn) name = String(dn.textContent || '').trim();
    }
    if (!name) { var ls = liveState(); if (ls && ls.selName) name = String(ls.selName).trim(); }
    return name;
  }
  // 右上角 #glCtx,如:"高中数学 · 当前知识点:导数"
  function refreshCtx() {
    try {
      var subj = readSubj();
      var pt = readPoint();
      var t = (subj || '—') + ' · 当前知识点:' + (pt || '未选中');
      if (els.glCtx) { els.glCtx.textContent = t; els.glCtx.title = pt || ''; }
    } catch (e) { /* 忽略 */ }
  }
  // 作为 messages 中的 user 上下文行,如:"当前科目:高中数学;当前知识点:导数。"
  function buildCtxLine() {
    var s = '当前科目:' + (readSubj() || '未知');
    s += readPoint() ? ';当前知识点:' + readPoint() : ';当前知识点:未选中';
    return s + '。';
  }

  /* ---------- 宿主通道(与 train.js 相同模式) ---------- */
  var hasHost = !!(typeof window.chrome !== 'undefined' && window.chrome.webview &&
    window.chrome.webview.postMessage);
  // 发号统一走 window 上的共享计数器:主窗里本面板与 mainbridge 的 dbAuto
  // 共用同一个 WebView 通道,各自独立计数(原先本面板从 100000 起)只是靠约定避让,
  // 一旦再添第三个发送方就会撞号 → 响应被派给错误的回调。
  var hostPending = {};
  function nextSeq() {
    window.__qgSeq = (window.__qgSeq || 0) + 1;
    return window.__qgSeq;
  }
  function hostReq(payload) {
    return new Promise(function (resolve) {
      var seq = nextSeq();
      // 复制一份再挂 _seq:直接改调用方对象,复用同一 payload 时会串号
      var msg = {};
      for (var k in payload) { if (Object.prototype.hasOwnProperty.call(payload, k)) msg[k] = payload[k]; }
      msg._seq = seq;
      hostPending[seq] = resolve;
      window.chrome.webview.postMessage(msg);
      setTimeout(function () {
        if (hostPending[seq]) { delete hostPending[seq]; resolve({ _timeout: true }); }
      }, HOST_TIMEOUT);
    });
  }
  function attachHost() {
    if (!hasHost) return;
    window.chrome.webview.addEventListener('message', function (ev) {
      var d = ev.data;
      if (!d || !d._seq) return;
      var seq = d._seq;
      delete d._seq;
      var cb = hostPending[seq];
      if (cb) { delete hostPending[seq]; cb(d); }
    });
  }
  attachHost();
  // 宿主通道交给统一 AI 层(ainet.js):桌面宿主在时走老通道(行为不变),
  // 手机浏览器 / Capacitor APK 里自动改走 /api/ds 或原生直连。
  if (window.QGAi && window.QGAi.setHostSender) window.QGAi.setHostSender(hostReq);

  // 诊断信息落宿主日志(kind=note):演示的成败原先只在界面气泡里显示,
  // 排查时日志什么也看不到。只发文本、不等回执,失败也不影响主流程。
  function note(text) {
    if (!hasHost) return;
    try {
      window.chrome.webview.postMessage({ kind: 'note', text: String(text == null ? '' : text).slice(0, 240) });
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- DeepSeek 调用(三模式由 ainet.js 统一选择) ---------- */
  // 成功 resolve 为文本;失败 reject Error(错误信息 message 透出)。opts 可覆盖模型参数。
  //   · 桌面宿主存在 → 宿主代发(与改造前完全一致)
  //   · Capacitor APK  → 原生直连 https://api.deepseek.com(无 CORS 限制)
  //   · 手机浏览器     → POST /api/ds 由本地 server.js 反向代理
  function dsAsk(messages, key, opts) {
    opts = opts || {};
    if (!window.QGAi || !window.QGAi.request) {
      return Promise.reject(new Error('AI 调用层未加载(js/ainet.js 缺失)'));
    }
    return window.QGAi.request({
      key: key,
      json: !!opts.json,      // 仅协议类请求开启 json_object(其提示词含 JSON 字样)
      model: opts.model || load(LS_MODEL) || 'deepseek-chat',
      messages: messages,
      max_tokens: opts.max_tokens || 2400,
      temperature: opts.temperature != null ? opts.temperature : 0.3
    }).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.err) ? r.err : 'AI 请求失败');
      return r.content;
    });
  }

  /* ---------- 渲染(安全气泡 + 滚动 + MathJax 整块排版) ---------- */
  // 一律 textContent 写入,防 XSS;换行保留给 CSS(pre-wrap)处理。
  function addBubble(cls, text, hint) {
    var wrap = document.createElement('div');
    wrap.className = 'gl-msg ' + cls;
    if (hint) wrap.setAttribute('data-hint', '1');   // 提示型气泡(如缺 Key),保存 Key 后清除
    var txt = document.createElement('div');
    txt.className = 'txt';
    txt.textContent = String(text == null ? '' : text);
    wrap.appendChild(txt);
    els.glMsgs.appendChild(wrap);
    scrollDown();
    typesetLater();
  }
  function scrollDown() {
    try { if (els.glMsgs) els.glMsgs.scrollTop = els.glMsgs.scrollHeight; } catch (e) { /* 忽略 */ }
  }
  // setTimeout 0 让新气泡 DOM 先落地,再对整块 #glMsgs 排一次公式(.catch 吞错)。
  // MathJax 异步就绪(且 guanlan.html 设了 startup:{typeset:false}),直接判
  // typesetPromise 是否存在会撞竞态窗口 → 首批公式静默不排版,故等 startup.promise。
  function typesetLater() {
    try {
      if (!window.MathJax) return;
      function run() {
        setTimeout(function () {
          try {
            MathJax.typesetPromise([els.glMsgs])
              .then(function () { scrollDown(); })
              .catch(function () { /* 公式排版失败不影响对话 */ });
          } catch (e) { scrollDown(); }
        }, 0);
      }
      if (MathJax.startup && MathJax.startup.promise) MathJax.startup.promise.then(run);
      else if (MathJax.typesetPromise) run();
    } catch (e) { /* 忽略 */ }
  }
  function clearHints() {
    if (!els.glMsgs) return;
    var list = els.glMsgs.querySelectorAll('.gl-msg[data-hint]');
    Array.prototype.forEach.call(list, function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
  }

  /* ---------- 面板开关(均幂等) ---------- */
  function canvasCount() { return engine && engine.getState ? engine.getState().objects : 0; }
  function ensureToolbar() {
    var tb = $('glToolbar');
    if (!tb) return;
    if (engine) tb.hidden = false;
    /* 把工具条实测高度写进 #glStage 的 CSS 变量 --gl-tb-h,供窄屏下的
       表达式栏/参数栏落点使用(见 injectExprCSS 的 @media (max-width:768px))。
       必须在 hidden=false 之后量:手机宽度下工具条折成 4 行约 155px 高,
       而面板原本固定 top:88px,正好压在工具条第三行 —— 实测「清空画布」
       整颗按钮被 .gl-expr-head 盖住,elementFromPoint 命中的是表达式栏,
       手指点上去毫无反应。宽屏不读这个变量,行为不变。 */
    try {
      var stg = $('glStage');
      if (stg && !tb.hidden && tb.getBoundingClientRect) {
        var tr = tb.getBoundingClientRect();
        // 面板还没显示时高度为 0,不能用它去覆盖变量
        if (tr.height > 0 && tr.width > 0) {
          stg.style.setProperty('--gl-tb-h', (Math.round(tr.height) + 14) + 'px');
        }
      }
    } catch (e) { /* 忽略 */ }
    // 未出图时禁用播放类按钮,🎬 动态演示始终可用;
    // 「清空画布」还要看用户表达式:只有表达式、没有 AI 图元时也该能清
    var has = canvasCount() > 0;
    var ex = exprCount();
    var ids = ['glPlayBtn', 'glPauseBtn', 'glStepBtn', 'glResetBtn'];
    for (var i = 0; i < ids.length; i++) {
      var b = $(ids[i]);
      if (b) b.disabled = !has;
    }
    var cb = $('glClearCanvasBtn');
    if (cb) cb.disabled = !(has || ex > 0);
    if (!canvasActive) {
      var st = $('glDemoState');
      if (st) {
        st.textContent = ex > 0
          ? '画布:已输入 ' + ex + ' 条表达式' + (has ? ' + AI 图元' : '')
          : (has ? '画布:就绪' : '画布:空 · 点「🎬 动态演示」出图');
      }
    }
  }
  function openPanel() {
    if (els.guanlan) els.guanlan.hidden = false;
    refreshCtx();
    ensureToolbar();
    /* 面板刚从 hidden 变成可见时,画布才第一次拿到真实尺寸(clientWidth/Height)。
     * 引擎虽然挂了 ResizeObserver,回调却不在同帧送达 —— 实测手机视口下面板打开
     * 1.2 秒后 canvas 的像素尺寸仍是 HTML 属性里的 900×600(于是第一帧被拉伸)。
     * 这里主动派发一次 resize:引擎内部的 markResized() 会立刻 syncSize()
     * (按 clientWidth × devicePixelRatio 重设画布像素尺寸)并重绘。
     * 幂等操作,不改变任何绘制状态。 */
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* 忽略 */ }
    try { if (engine && engine.redraw) engine.redraw(); } catch (e) { /* 忽略 */ }
    try { if (els.glAsk) els.glAsk.focus(); } catch (e) { /* 忽略 */ }
    return 'ok';
  }
  function closePanel() {
    if (window.__guanlanStandalone) {
      if (!hasHost) {
        /* 手机浏览器 / APK 里没有宿主窗口可关,而 window.close() 对
         * 用户自己打开的标签页无效 —— 原先按 ✕ 会毫无反应,用户卡在观澜页。
         * 这里退回上一页;没有上一页(直接输网址打开)就回主界面。 */
        try {
          if (window.history && window.history.length > 1) { window.history.back(); return 'ok'; }
        } catch (e) { /* 忽略 */ }
        try { window.location.href = 'index.html'; } catch (e) { /* 忽略 */ }
        return 'ok';
      }
      sendWnd('close');                       // 无边框独立窗:请宿主关闭
      try { if (window.close) window.close(); } catch (e) { /* 忽略 */ }
      return 'ok';
    }
    if (els.guanlan) els.guanlan.hidden = true;
    return 'ok';
  }
  function minWindow() {                       // 无边框独立窗最小化(观澜独立页按钮)
    sendWnd('min');
    return 'ok';
  }
  function maxWindow() {                       // 无边框独立窗最大化/还原
    sendWnd('max');
    return 'ok';
  }
  function clearConv() {
    conv = [];
    if (els.glMsgs) els.glMsgs.innerHTML = '';
    ensureToolbar();
    return 'ok';
  }

  /* ---------- 面板拖动(标题栏) ---------- */
  var dragState = null;
  // 无边框独立窗口:窗口移动交给宿主(页面只发增量)
  var wndDrag = null;
  function sendWnd(op, extra) {
    if (!hasHost) return;
    var m = { kind: 'wnd', op: op };
    if (extra) { m.dx = extra.dx || 0; m.dy = extra.dy || 0; }
    try { window.chrome.webview.postMessage(m); } catch (e) { /* 忽略 */ }
  }
  function headPointerDown(e) {
    var p = els.guanlan;
    if (!p || p.hidden) return;
    if (e.target && e.target.closest && e.target.closest('button, input, select, a, textarea')) return;
    if (window.__guanlanStandalone) {
      wndDrag = { sx: e.screenX, sy: e.screenY };
      try { if (e.preventDefault) e.preventDefault(); } catch (err) { /* 忽略 */ }
      return;
    }
    var rect = p.getBoundingClientRect();
    // 首次拖动:由“居中”布局切到“像素定位”,之后记住位置
    p.style.left = rect.left + 'px';
    p.style.top = rect.top + 'px';
    p.style.transform = 'none';
    dragState = { mx: e.clientX, my: e.clientY, lx: rect.left, ty: rect.top, w: rect.width, h: rect.height };
    try { if (e.preventDefault) e.preventDefault(); } catch (err) { /* 忽略 */ }
  }
  function headPointerMove(e) {
    if (window.__guanlanStandalone && wndDrag) {
      // 屏幕坐标增量:窗口移动不会反作用于 clientX 造成抖动
      var dx = e.screenX - wndDrag.sx;
      var dy = e.screenY - wndDrag.sy;
      wndDrag.sx = e.screenX;
      wndDrag.sy = e.screenY;
      sendWnd('move', { dx: dx, dy: dy });
      try { if (e.preventDefault) e.preventDefault(); } catch (err) { /* 忽略 */ }
      return;
    }
    if (!dragState) return;
    var p = els.guanlan;
    var nx = dragState.lx + (e.clientX - dragState.mx);
    var ny = dragState.ty + (e.clientY - dragState.my);
    nx = Math.max(0, Math.min(nx, (window.innerWidth || 1280) - dragState.w));
    ny = Math.max(0, Math.min(ny, (window.innerHeight || 800) - dragState.h));
    p.style.left = nx + 'px';
    p.style.top = ny + 'px';
  }
  function headPointerUp() { dragState = null; wndDrag = null; }

  /* ---------- 拆为独立窗口(观澜 standalone,对话经 localStorage 握手迁移) ---------- */
  function detachWindow() {
    try {
      var payload = {
        conv: conv.slice(-30),
        ctx: (els.glCtx ? els.glCtx.textContent : '') || ''
      };
      // 不再把对话塞进 URL:宿主会把新窗口的完整 URI 原样写进运行日志(NWREQ:),
      // URL 也会进浏览历史 —— 与"对话仅保留在内存、关闭即清空"的承诺直接冲突。
      store('qg_guanlan_conv', JSON.stringify(payload));
      if (!window.open('guanlan.html', 'qg_guanlan')) { try { openPanel(); } catch (e) { } }
      // 兜底清除(独立窗正常读取后会立即自删)
      setTimeout(function () {
        try { localStorage.removeItem('qg_guanlan_conv'); } catch (e) { /* 忽略 */ }
      }, 8000);
    } catch (e) {
      addBubble('err', '无法打开独立窗口:' + (e && e.message ? e.message : '未知错误'));
    }
  }
  if (window.addEventListener) {
    window.addEventListener('pagehide', function () {
      try { localStorage.removeItem('qg_guanlan_conv'); } catch (e) { /* 忽略 */ }
    });
  }
  on('glDetach', detachWindow);

  /* ---------- 独立窗口启动(观澜 standalone 页) ---------- */
  function bootStandalone() {
    // 标记:由 guanlan.html 内联脚本置 window.__guanlanStandalone = true
    if (!window.__guanlanStandalone) return;
    if (els.guanlan) els.guanlan.hidden = false;
    if (els.guanlan) els.guanlan.style.position = 'static';   // 页面自带布局
    var hadCtx = false;
    try {
      // 握手数据走 localStorage(qg_guanlan_conv),不再经 URL。
      // 原实现只解析 location.search —— 于是这条握手通道**从来没被读取过**,
      // 只在最后被删掉,拆窗后对话其实是空的。
      var rawHs = null;
      try { rawHs = localStorage.getItem('qg_guanlan_conv'); } catch (e2) { rawHs = null; }
      var obj = null;
      if (rawHs) { try { obj = JSON.parse(rawHs); } catch (e3) { obj = null; } }
      if (!obj) {
        // 兼容旧的 URL 传参形式
        var q = location.search;
        var m = {};
        q.replace(/[?&]([^=]+)=([^&]*)/g, function (_, k, v) { m[k] = decodeURIComponent(v); });
        if (m.conv) { try { obj = JSON.parse(m.conv); } catch (e4) { obj = null; } }
      }
      var list = obj && obj.conv;
      if (Object.prototype.toString.call(list) === '[object Array]') {
        for (var i = 0; i < list.length; i++) {
          if (!list[i] || !list[i].role || !list[i].content) continue;
          conv.push({ role: list[i].role === 'assistant' ? 'assistant' : 'user', content: String(list[i].content) });
          addBubble(list[i].role === 'assistant' ? 'ai' : 'user', String(list[i].content));
        }
      }
      if (obj && obj.ctx && els.glCtx) { els.glCtx.textContent = String(obj.ctx); hadCtx = true; }
    } catch (e) { /* 忽略:空会话进入 */ }
    try { localStorage.removeItem('qg_guanlan_conv'); } catch (e) { /* 忽略 */ }
    if (!hadCtx) refreshCtx();
    // 启动留痕:排查问题时能确认"观澜是什么时候开的、会话迁移了几条"
    note('观澜独立窗已启动 conv=' + conv.length + (hadCtx ? ' 已迁移上下文' : ''));
    ensureToolbar();
    // 最大化时页面圆角置直角(与宿主 Region 行为一致)
    try {
      var syncMaxed = function () {
        try {
          var mx = Math.abs(window.innerWidth - screen.availWidth) < 4 &&
            Math.abs(window.innerHeight - screen.availHeight) < 4;
          var de = document.documentElement;
          if (de) de.classList.toggle('maxed', mx);
        } catch (e) { /* 忽略 */ }
      };
      window.addEventListener('resize', syncMaxed);
      setInterval(syncMaxed, 1000);
      syncMaxed();
      // 顶层灰色描边覆盖层(圆角贴合窗口弧线)
      if (!document.querySelector('.winedge')) {
        var edge = document.createElement('div');
        edge.className = 'winedge';
        (document.body || document.documentElement).appendChild(edge);
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- API Key 处理 ---------- */
  function showKeyRow() {
    if (els.glKeyRow) els.glKeyRow.hidden = false;
    // 仅在消息流末尾不是缺 Key 提示时补一条,避免重复刷屏
    var kids = els.glMsgs ? els.glMsgs.children : null;
    var need = true;
    if (kids && kids.length) {
      var last = kids[kids.length - 1];
      need = !(last && last.getAttribute && last.getAttribute('data-hint'));
    }
    if (need) addBubble('err', '尚未设置 DeepSeek API Key:请在上方输入框填写 sk-… 并点「保存」' +
      '(与破卷共用,仅存本机)。', true);
  }
  function saveKey() {
    var v = (els.glKeyInput ? els.glKeyInput.value : '') || '';
    v = v.trim();
    if (v) store(LS_KEY, v);                 // 空值视为不修改,不清除既有 Key
    if (els.glKeyInput) els.glKeyInput.value = '';
    if (els.glKeyRow) els.glKeyRow.hidden = true;
    clearHints();
    try { if (els.glAsk) els.glAsk.focus(); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 图片输入(视觉模型) ----------
   * 观澜支持"拍/贴一张题图 → AI 读图讲解"。走 DeepSeek 的图像理解接口:
   *   · content 用内容块数组,图片为 {type:'image_url', image_url:{url:'data:image/…;base64,…'}};
   *   · 图片**只能出现在 user 消息**里(system/assistant 带图会 400);
   *   · 带图请求改用多模态模型,纯文本请求仍用原模型(不动既有行为与成本)。
   * 官方限制:JPEG/PNG/GIF/WebP、单图 ≤32 MiB、请求体 ≤48 MiB、每图 ≤1024 token。
   * 模型内部会把图缩到约 1300×1300,所以本地先缩好再传 —— 传更大只是白费带宽。
   */
  var VISION_MODEL = 'deepseek-flash';
  var SYS_IMG = '用户可能附上图片(题目照片 / 教材截图 / 手写解答)。'
    + '请先仔细观察图片,把题目或图形内容准确读出来再作答;'
    + '若图片模糊、被裁切或信息不足,明确说明缺什么,不要臆测。';
  var IMG_MAX_EDGE = 1300;
  var IMG_MAX_BYTES = 32 * 1024 * 1024;
  var IMG_SOFT_BYTES = 2.2 * 1024 * 1024;
  var imgCur = null;                 // {dataUrl,w,h,bytes,name}
  var imgEls = {};

  function setImgBarInfo(t) { if (imgEls.info) imgEls.info.textContent = t || ''; }

  function clearImage() {
    imgCur = null;
    if (imgEls.bar) imgEls.bar.hidden = true;
    if (imgEls.thumb) { try { imgEls.thumb.removeAttribute('src'); } catch (e) { /* 忽略 */ } }
    setImgBarInfo('');
  }

  // 本地缩放:已足够小就原样保留(截图是 PNG,保清晰度比省字节重要)
  function downscaleDataUrl(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth || img.width || 0, h = img.naturalHeight || img.height || 0;
      if (!w || !h) { cb(null); return; }
      var sc = Math.min(1, IMG_MAX_EDGE / Math.max(w, h));
      var tw = Math.max(1, Math.round(w * sc)), th = Math.max(1, Math.round(h * sc));
      if (sc >= 1 && dataUrl.length <= IMG_SOFT_BYTES) { cb(dataUrl, w, h); return; }
      try {
        var cv = document.createElement('canvas');
        cv.width = tw; cv.height = th;
        var c2 = cv.getContext('2d');
        c2.fillStyle = '#ffffff';        // 白底:透明通道转 JPEG 会变黑,影响识别
        c2.fillRect(0, 0, tw, th);
        c2.drawImage(img, 0, 0, tw, th);
        var isPng = /^data:image\/png/i.test(dataUrl);
        var out = isPng ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92);
        if (out.length > IMG_SOFT_BYTES) out = cv.toDataURL('image/jpeg', 0.85);
        cb(out, tw, th);
      } catch (e) { cb(dataUrl, w, h); }   // 画布不可用时退回原图
    };
    img.onerror = function () { cb(null); };
    img.src = dataUrl;
  }

  function ingestDataUrl(dataUrl, name) {
    dataUrl = String(dataUrl || '');
    if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(dataUrl)) {
      addBubble('err', '图片格式不支持(官方只接受 JPEG / PNG / GIF / WebP),请换一张。');
      return false;
    }
    if (imgEls.bar) imgEls.bar.hidden = false;
    setImgBarInfo('正在处理图片…');
    downscaleDataUrl(dataUrl, function (out, w, h) {
      if (!out) { clearImage(); addBubble('err', '图片处理失败:无法解码。'); return; }
      imgCur = { dataUrl: out, w: w, h: h, bytes: out.length, name: name || '' };
      if (imgEls.thumb) imgEls.thumb.src = out;
      setImgBarInfo('图片 ' + w + '×' + h + ' · 约 ' + Math.round(out.length * 0.75 / 1024)
        + ' KB · 将用 ' + VISION_MODEL);
    });
    return true;
  }

  function ingestFile(file) {
    if (!file) return;
    var t = String(file.type || '');
    if (t.indexOf('image/') !== 0) { addBubble('err', '只支持图片文件(JPEG / PNG / GIF / WebP)。'); return; }
    if (file.size && file.size > IMG_MAX_BYTES) {
      addBubble('err', '图片过大(' + Math.round(file.size / 1048576) + ' MB),请压缩到 32 MB 以内。');
      return;
    }
    var fr = new FileReader();
    fr.onload = function () { ingestDataUrl(String(fr.result || ''), file.name || ''); };
    fr.onerror = function () { addBubble('err', '读取图片失败。'); };
    try { fr.readAsDataURL(file); } catch (e) { addBubble('err', '读取图片失败:' + e.message); }
  }

  // 动态建 UI:观澜有两套形态(主窗浮动面板 / guanlan.html 独立窗),
  // 用 JS 注入可以只维护一份,不必改两个 html。
  function buildImgUI() {
    var row = document.querySelector('.gl-inputrow');
    if (!row || document.getElementById('glImgBtn')) return;

    var bar = document.createElement('div');
    bar.id = 'glImgBar';
    bar.hidden = true;
    var thumb = document.createElement('img');
    thumb.id = 'glImgThumb'; thumb.alt = '附图预览';
    var info = document.createElement('span');
    info.id = 'glImgInfo';
    var del = document.createElement('button');
    del.type = 'button'; del.id = 'glImgDel'; del.title = '移除图片'; del.textContent = '✕';
    bar.appendChild(thumb); bar.appendChild(info); bar.appendChild(del);
    row.parentNode.insertBefore(bar, row);

    var file = document.createElement('input');
    file.type = 'file'; file.id = 'glImgFile'; file.hidden = true;
    file.accept = 'image/png,image/jpeg,image/gif,image/webp';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'glImgBtn'; btn.textContent = '📷';
    btn.title = '附图:选图 / 直接粘贴(Ctrl+V) / 把图片拖进来';
    row.insertBefore(file, row.firstChild);
    row.insertBefore(btn, file.nextSibling);
    imgEls = { bar: bar, thumb: thumb, info: info, file: file, btn: btn };

    btn.addEventListener('click', function () { try { file.click(); } catch (e) { /* 忽略 */ } });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (f) ingestFile(f);
      file.value = '';
    });
    del.addEventListener('click', function (e) { if (e.preventDefault) e.preventDefault(); clearImage(); });

    function onPaste(e) {
      try {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type && items[i].type.indexOf('image/') === 0) {
            var f = items[i].getAsFile();
            if (f) { ingestFile(f); if (e.preventDefault) e.preventDefault(); return; }
          }
        }
      } catch (err) { /* 忽略 */ }
    }
    if (els.glAsk) els.glAsk.addEventListener('paste', onPaste);
    var panel = els.guanlan;
    if (panel) {
      panel.addEventListener('paste', onPaste);
      panel.addEventListener('dragover', function (e) { if (e.preventDefault) e.preventDefault(); });
      panel.addEventListener('drop', function (e) {
        try {
          var dt = e.dataTransfer;
          if (dt && dt.files && dt.files.length) {
            for (var i = 0; i < dt.files.length; i++) {
              var f = dt.files[i];
              if (f.type && f.type.indexOf('image/') === 0) {
                ingestFile(f);
                if (e.preventDefault) e.preventDefault();
                return;
              }
            }
          }
        } catch (err) { /* 忽略 */ }
      });
    }
  }

  // 历史里的图只保留"最近一条"的原图:更早的降级为文字标记,
  // 避免 base64 在内存里按条累积(对话本就关窗即清,这里再省一层)。
  function buildHist() {
    var h = conv.slice(-MAX_HIST), lastImg = -1, i, out = [];
    for (i = 0; i < h.length; i++) if (h[i].img) lastImg = i;
    for (i = 0; i < h.length; i++) {
      var m = h[i];
      if (m.img && i === lastImg) {
        out.push({ role: m.role, content: [
          { type: 'text', text: String(m.content || '') },
          { type: 'image_url', image_url: { url: m.img, detail: 'high' } }
        ] });
      } else if (m.img) {
        out.push({ role: m.role, content: String(m.content || '') + '\n[附图已省略]' });
      } else {
        out.push({ role: m.role, content: m.content });
      }
    }
    return out;
  }

  /* ---------- 发送主流程 ---------- */
  function doSend() {
    if (busy) return;
    var text = (els.glAsk ? els.glAsk.value : '') || '';
    text = text.trim();
    var withImg = !!(imgCur && imgCur.dataUrl);
    if (!text && !withImg) { try { if (els.glAsk) els.glAsk.focus(); } catch (e) { /* 忽略 */ } return; }
    if (!text) text = '请看这张图,把题目读出来并讲解。';
    var key = load(LS_KEY);
    if (!key) { showKeyRow(); try { if (els.glKeyInput) els.glKeyInput.focus(); } catch (e) { /* 忽略 */ } return; }
    busy = true;
    if (els.glSend) els.glSend.disabled = true;
    if (els.glAsk) els.glAsk.value = '';
    // 历史取最近最多 12 条(不含本条),当前消息作为最后一条 user 送入
    var hist = buildHist();
    conv.push(withImg ? { role: 'user', content: text, img: imgCur.dataUrl }
                      : { role: 'user', content: text });
    addBubble('user', text + (withImg ? '\n[已附图 ' + imgCur.w + '×' + imgCur.h + ']' : ''));
    var msgs = [
      { role: 'system', content: withImg ? (SYS_TXT + '\n' + SYS_IMG) : SYS_TXT },
      { role: 'user', content: buildCtxLine() }
    ];
    for (var i = 0; i < hist.length; i++) msgs.push(hist[i]);
    // 带图时最后一条 user 用内容块数组;纯文本仍走字符串(保持原行为)
    if (withImg) {
      msgs.push({ role: 'user', content: [
        { type: 'text', text: text },
        { type: 'image_url', image_url: { url: imgCur.dataUrl, detail: 'high' } }
      ] });
    } else {
      msgs.push({ role: 'user', content: text });
    }
    var t0 = Date.now();
    var sentWithImg = withImg;
    dsAsk(msgs, key, withImg ? { model: VISION_MODEL } : null)
      .then(function (content) {
        conv.push({ role: 'assistant', content: content });
        addBubble('ai', content);
        // 已送出:清掉待发图,避免下一条消息又把它带上(历史里已保留最近一张,追问仍可用)
        if (sentWithImg) clearImage();
      })
      .catch(function (err) {
        addBubble('err', (err && err.message) ? err.message : 'AI 请求失败,请重试');
      })
      .then(function () {
        busy = false;
        if (els.glSend) els.glSend.disabled = false;
        try { if (els.glAsk) els.glAsk.focus(); } catch (e) { /* 忽略 */ }
      });
  }

  /* ---------- 绑定事件 ---------- */
  function on(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }
  // 侧栏「观澜」入口:桌面版开无边框独立窗口(宿主拦截;网页版开新标签页)。
  // 手机(≤768px)例外:面板本身已经是整屏,直接在页内打开更顺手 ——
  // 开新标签页在手机上要来回切换,还容易被弹窗拦截。
  on('guanlanOpen', function () {
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) { openPanel(); return; }
    } catch (e) { /* 忽略 */ }
    try { if (!window.open('guanlan.html', 'qg_guanlan')) openPanel(); } catch (e) { openPanel(); }
  });
  on('glClose', closePanel);
  on('glClearText', clearConv);
  on('glSend', doSend);
  on('glMin', minWindow);   // 观澜独立页的"最小化"按钮(宿主窗口)
  on('glMax', maxWindow);   // 观澜独立页的"最大化/还原"按钮(宿主窗口)
  // Key 行本身是 <form>(密码框须在表单内,避免浏览器告警);提交即保存
  var keyForm = $('glKeyRow');
  if (keyForm && keyForm.tagName === 'FORM') {
    keyForm.addEventListener('submit', function (e) { e.preventDefault(); saveKey(); });
  } else {
    on('glKeySave', saveKey);
  }
  if (els.glAsk) els.glAsk.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSend();
  });
  if (els.glKeyInput) els.glKeyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveKey();
  });

  /* ---------- 初始化 ---------- */
  buildImgUI();
  if (els.glStageTip) els.glStageTip.textContent = '输入题目后点「🎬 动态演示」:优先匹配内置模板(函数图像 / 向量 / 圆锥曲线 / 平面几何 / 立体几何 / 数列概率),匹配不到时由 AI 现场生成示意图。也可以在左上角的表达式栏自己画:y=x^2、r=2cos(3θ)(极坐标玫瑰线,自动换算到普通坐标系)、a=2(参数滑块)、隐函数圆。';

  /* ============ 观澜画布:引擎装载 / 工具条 / AI→模板协议(2a) ============ */
  var engine = null;
  var canvasEl = $('glCanvas');
  var labelsEl = $('glLabels');
  if (canvasEl && window.GL) {
    engine = window.GL(canvasEl, labelsEl);
  }
  window.__guanlanGL = engine;

  /* ============ 观澜画布:用户表达式 + 参数滑块(Desmos 式交互) ============
   * 设计要点:
   *   · 表达式与滑块由引擎的"用户表达式层"(glcanvas.js 3.18)独立存储,
   *     与 AI 场景/模板互不干扰:换模板、重播动画都不会清掉用户自己写的函数;
   *     只有「清空画布」会两者一起清(带二次确认)。
   *   · UI 全部 DOM 动态构建:观澜有两个入口(guanlan.html 独立窗 / index.html
   *     主窗面板)且共用本文件,而 index.html 与 css/style.css 都不在可改清单里,
   *     因此新增样式在 injectExprCSS() 里注入一次(内联样式,CSP 的
   *     style-src 'unsafe-inline' 放行),两个入口的观感保持一致。
   *   · 拖滑块走 requestAnimationFrame 节流:一帧最多提交一次参数值并重绘,
   *     不重新解析表达式、不重建场景(引擎侧只做"改数 + 失效几何 + 重绘")。
   *   · 表达式存 localStorage(qg_gl_expr_v1),重开页面自动恢复。
   */
  var LS_EXPR = 'qg_gl_expr_v1';
  var eui = {
    box: null, listEl: null, rows: [], rowSeq: 0, thetaWrap: null,
    bar: null, barList: null, barEmpty: null, pRecs: {},
    thetaA: null, thetaB: null, gridBox: null, gridOn: false,
    applyTimer: null, saveTimer: null, rafId: null, thetaTimer: null,
    folded: false, userBarToggle: false, fittedOnce: false, pending: {}
  };

  function cel(tag, cls, txt) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt !== undefined && txt !== null) d.textContent = String(txt);
    return d;
  }
  function exprCount() { return (engine && engine.ueCount) ? engine.ueCount() : 0; }

  /* ---------- 样式(只注入一次,两个入口共用) ---------- */
  function injectExprCSS() {
    if (document.getElementById('glExprCSS')) return;
    var css = [
      '#glExprBox{position:absolute;left:8px;top:46px;z-index:6;width:336px;max-width:58%;',
      'background:rgba(8,12,24,.88);border:1px solid rgba(120,160,220,.18);border-radius:10px;',
      'box-shadow:0 8px 24px rgba(0,0,0,.45);color:#8fa3c0;font-size:12px;overflow:hidden}',
      '#glExprBox.folded .gl-expr-body{display:none}',
      '.gl-expr-head{display:flex;align-items:center;gap:6px;padding:6px 8px;',
      'border-bottom:1px solid rgba(120,160,220,.14)}',
      '.gl-expr-title{color:#cfe0f5;font-weight:600;flex:none}',
      '.gl-expr-sub{flex:1;min-width:0;font-size:10.5px;color:#5c708f;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.gl-expr-fold{flex:none;width:22px;height:20px;line-height:1;padding:0;border:0;',
      'background:transparent;color:#8fa3c0;cursor:pointer}',
      '.gl-expr-fold:hover{color:#fff}',
      '.gl-expr-list{max-height:34vh;overflow:auto;padding:5px 6px 2px}',
      '.gl-expr-row{display:grid;grid-template-columns:12px 1fr 20px;align-items:center;gap:6px;',
      'padding:1px 0}',
      '.gl-expr-dot{width:10px;height:10px;border-radius:50%;background:#4fc3f7}',
      '.gl-expr-in{width:100%;height:26px;padding:0 8px;border:1px solid rgba(120,160,220,.2);',
      'border-radius:6px;background:#0a101e;color:#eaf2ff;font-size:12.5px;',
      'font-family:Consolas,"Courier New",monospace}',
      '.gl-expr-in:focus{border-color:#4fc3f7;outline:none}',
      '.gl-expr-row.bad .gl-expr-in{border-color:#ff8a80;background:rgba(255,138,128,.06)}',
      '.gl-expr-err{grid-column:2/4;color:#ff8a80;font-size:11px;line-height:1.4;',
      'padding:1px 0 2px 2px;word-break:break-all}',
      '.gl-expr-del{width:20px;height:22px;line-height:1;padding:0;border:0;background:transparent;',
      'color:#5c708f;cursor:pointer;font-size:12px}',
      '.gl-expr-del:hover{color:#ff8a80}',
      '.gl-expr-foot,.gl-expr-foot2{display:flex;align-items:center;gap:8px;padding:5px 8px;',
      'border-top:1px solid rgba(120,160,220,.14)}',
      '.gl-expr-add{height:24px;padding:0 10px;border:1px solid rgba(120,160,220,.22);',
      'border-radius:6px;background:transparent;color:#8fa3c0;font-size:12px;cursor:pointer}',
      '.gl-expr-add:hover{color:#fff;border-color:rgba(79,195,247,.5);background:rgba(79,195,247,.14)}',
      '.gl-expr-tip{flex:1;min-width:0;font-size:10.5px;color:#5c708f;text-align:right;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gl-expr-foot2.dim{opacity:.5}',
      '.gl-theta-in{width:52px;height:22px;padding:0 5px;border:1px solid rgba(120,160,220,.22);',
      'border-radius:5px;background:#0a101e;color:#dbe6f5;font-size:11.5px}',
      '.gl-theta-in.bad{border-color:#ff8a80}',
      '.gl-eq-grid{display:flex;align-items:center;gap:4px;margin-left:auto;font-size:11px;',
      'color:#8fa3c0;cursor:pointer;white-space:nowrap}',
      '#glParamBar{position:absolute;right:0;top:46px;bottom:10px;width:200px;z-index:6;',
      'display:flex;flex-direction:column;background:rgba(8,12,24,.88);',
      'border:1px solid rgba(120,160,220,.18);border-right:0;border-radius:10px 0 0 10px;',
      'box-shadow:-8px 8px 24px rgba(0,0,0,.4);color:#8fa3c0;font-size:12px;overflow:hidden;',
      'transition:width .16s}',
      '#glParamBar.folded{width:24px}',
      '#glParamBar.folded .gl-pb-body{display:none}',
      '.gl-pb-head{display:flex;align-items:center;gap:6px;padding:6px 8px;flex:none;',
      'border-bottom:1px solid rgba(120,160,220,.14)}',
      '#glParamBar.folded .gl-pb-head{padding:6px 0;justify-content:center;border-bottom:0}',
      '.gl-pb-title{flex:1;color:#cfe0f5;font-weight:600}',
      '#glParamBar.folded .gl-pb-title{display:none}',
      '.gl-pb-tog{flex:none;width:20px;height:20px;line-height:1;padding:0;border:0;',
      'background:transparent;color:#8fa3c0;cursor:pointer;font-size:13px}',
      '.gl-pb-tog:hover{color:#fff}',
      '.gl-pb-body{flex:1;min-height:0;overflow:auto;padding:4px 8px 8px}',
      '.gl-pb-empty{color:#5c708f;font-size:11px;line-height:1.7;padding:6px 2px}',
      '.gl-param{padding:6px 0;border-bottom:1px dashed rgba(120,160,220,.14)}',
      '.gl-param-top{display:flex;align-items:center;gap:5px}',
      '.gl-param-name{color:#eaf2ff;font-weight:600;font-family:Consolas,monospace;min-width:10px}',
      '.gl-param-eq{color:#5c708f}',
      '.gl-param-val{flex:1;min-width:0;height:22px;padding:0 5px;border:1px solid rgba(120,160,220,.22);',
      'border-radius:5px;background:#0a101e;color:#dbe6f5;font-size:11.5px}',
      '.gl-param-range{width:100%;margin:6px 0 3px;height:16px}',
      '.gl-param-lim{display:flex;align-items:center;gap:3px;font-size:10px;color:#5c708f}',
      '.gl-param-lim input{width:100%;min-width:0;height:18px;padding:0 3px;font-size:10px;',
      'border:1px solid rgba(120,160,220,.18);border-radius:4px;background:#0a101e;color:#8fa3c0}',
      '.gl-param-lim span{flex:none}',
      '.gl-param-id{font-size:10.5px;color:#5c708f;margin-left:2px}',
      /* ---------- 手机(≤768px)专用排布 ----------
         画布区只有约 390×362,表达式栏与参数栏若沿用桌面坐标会把图挡死:
         表达式栏下移到工具条下方并收窄,参数栏同样下移,避免与工具条叠在一起。
         只在窄屏媒体查询内生效,桌面两个入口(#guanlan 浮动面板 / 独立窗)不受影响。 */
      '@media (max-width:768px){',
      /* 落点用 --gl-tb-h(工具条实测高度 + 间隙,由 ensureToolbar 写进 #glStage):
         工具条在手机宽度下折成 4 行(约 155px),面板固定 top:88px 会正好压在
         工具条第三行上 —— 实测「清空画布」整颗按钮被 .gl-expr-head 盖住,
         elementFromPoint 命中表达式栏,点不动。变量没写时退回 88px。 */
      '#glExprBox{top:var(--gl-tb-h,88px);width:66vw;max-width:66vw}',
      '.gl-expr-sub{display:none}',
      '.gl-expr-head{padding:8px 10px}',
      '.gl-expr-title{font-size:12.5px}',
      '.gl-expr-fold{width:34px;height:28px;font-size:15px}',
      '.gl-expr-list{max-height:20dvh}',
      '.gl-expr-in{height:34px;font-size:16px}',
      '.gl-expr-add{height:36px;font-size:13px}',
      '.gl-theta-in{height:32px;width:56px;font-size:14px}',
      '#glParamBar{top:var(--gl-tb-h,88px);bottom:8px;width:150px}',
      '#glParamBar.folded{width:28px}',
      '.gl-pb-tog{width:26px;height:26px;font-size:15px}',
      '.gl-pb-body{padding:6px 10px 10px}',
      '.gl-param-val{height:30px;font-size:14px}',
      '.gl-param-range{height:26px}',
      '.gl-param-lim input{height:26px;font-size:12px}',
      '}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'glExprCSS';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- 表达式面板 ---------- */
  function buildExprUI() {
    var stage = $('glStage');
    if (!stage || document.getElementById('glExprBox') || !engine || !engine.ueSet) return false;
    injectExprCSS();
    // —— 表达式列表(画布左上角,stage 内) ——
    var box = cel('div');
    box.id = 'glExprBox';
    var head = cel('div', 'gl-expr-head');
    head.appendChild(cel('span', 'gl-expr-title', '表达式'));
    head.appendChild(cel('span', 'gl-expr-sub', 'y=x^2 · r=2cos(3θ) · a=2 · (x-1)^2+(y-1)^2=4'));
    var fold = cel('button', 'gl-expr-fold', '▴');
    fold.type = 'button';
    fold.title = '折叠 / 展开表达式面板';
    fold.addEventListener('click', function () {
      eui.folded = !eui.folded;
      box.className = eui.folded ? 'folded' : '';
      fold.textContent = eui.folded ? '▾' : '▴';
    });
    head.appendChild(fold);
    box.appendChild(head);
    var body = cel('div', 'gl-expr-body');
    var list = cel('div', 'gl-expr-list');
    body.appendChild(list);
    var foot = cel('div', 'gl-expr-foot');
    var add = cel('button', 'gl-expr-add', '+ 添加');
    add.type = 'button';
    add.id = 'glExprAdd';
    add.title = '新增一条表达式';
    add.addEventListener('click', function () {
      var r = addExprRow('', null);
      applyExprs();
      showCanvasUI();
      try { if (r && r.inp) r.inp.focus(); } catch (e) { /* 忽略 */ }
    });
    foot.appendChild(add);
    foot.appendChild(cel('span', 'gl-expr-tip', '回车立即生效'));
    body.appendChild(foot);
    // θ 区间(只作用于 r=f(θ)) + 可选的极坐标网格叠加
    var foot2 = cel('div', 'gl-expr-foot2');
    foot2.appendChild(cel('span', null, 'θ ∈ ['));
    var tA = cel('input', 'gl-theta-in');
    tA.type = 'text'; tA.value = '0'; tA.title = '极坐标 θ 下限(可写 0 / -PI)';
    var tB = cel('input', 'gl-theta-in');
    tB.type = 'text'; tB.value = '2π'; tB.title = '极坐标 θ 上限(可写 2π / 4*PI)';
    foot2.appendChild(tA);
    foot2.appendChild(cel('span', null, ','));
    foot2.appendChild(tB);
    foot2.appendChild(cel('span', null, ']'));
    var gw = cel('label', 'gl-eq-grid');
    var gcb = document.createElement('input');
    gcb.type = 'checkbox';
    gw.appendChild(gcb);
    gw.appendChild(cel('span', null, '叠加 θ 网格'));
    gw.title = '可选辅助层:同心圆 + 30° 射线。坐标系仍是普通直角坐标系,默认关闭';
    gcb.addEventListener('change', function () {
      eui.gridOn = !!gcb.checked;
      if (engine.setPolarGrid) engine.setPolarGrid(eui.gridOn);
      saveExprState();
    });
    foot2.appendChild(gw);
    body.appendChild(foot2);
    box.appendChild(body);
    stage.appendChild(box);

    // —— 参数滑块栏(画布右侧,可折叠) ——
    var bar = cel('div');
    bar.id = 'glParamBar';
    var pbHead = cel('div', 'gl-pb-head');
    pbHead.appendChild(cel('span', 'gl-pb-title', '参数'));
    var pbTog = cel('button', 'gl-pb-tog', '›');
    pbTog.type = 'button';
    pbTog.title = '折叠 / 展开参数栏';
    pbTog.addEventListener('click', function () {
      eui.userBarToggle = true;
      toggleParamBar();
    });
    pbHead.appendChild(pbTog);
    bar.appendChild(pbHead);
    var pbBody = cel('div', 'gl-pb-body');
    var pbEmpty = cel('div', 'gl-pb-empty', '表达式里出现单字母参数(例如 a=2 或 r=a*cos(3θ))时,这里会自动出现滑块');
    var pbList = cel('div', 'gl-pb-list');
    pbBody.appendChild(pbEmpty);
    pbBody.appendChild(pbList);
    bar.appendChild(pbBody);
    stage.appendChild(bar);

    eui.box = box; eui.listEl = list; eui.bar = bar; eui.barList = pbList;
    eui.barEmpty = pbEmpty; eui.thetaA = tA; eui.thetaB = tB;
    eui.thetaWrap = foot2; eui.gridBox = gcb;

    /* 手机(≤768px):表达式栏默认折叠。
     * 390px 宽的观澜画布区里,展开的表达式栏(约 226px 宽 + 若干行)会盖住大半个
     * canvas,几乎看不见图。折叠后只留一行标题,用户点 ▾ 随时可以展开。
     * 判定用 matchMedia 而不是 stage.clientWidth,是为了**不影响桌面**:
     * 桌面观澜独立窗(900×620)的画布区约 570px,同样小于 620,但不应改变默认态。 */
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        eui.folded = true;
        box.className = 'folded';
        fold.textContent = '▾';
      }
    } catch (e) { /* 忽略 */ }

    function onThetaInput() {
      if (eui.thetaTimer) clearTimeout(eui.thetaTimer);
      eui.thetaTimer = setTimeout(function () { eui.thetaTimer = null; applyTheta(); }, 400);
    }
    tA.addEventListener('input', onThetaInput);
    tB.addEventListener('input', onThetaInput);
    tA.addEventListener('change', function () { applyTheta(); });
    tB.addEventListener('change', function () { applyTheta(); });
    return true;
  }

  function toggleParamBar() {
    if (!eui.bar) return;
    var folded = eui.bar.className.indexOf('folded') < 0;
    eui.bar.className = folded ? 'folded' : '';
    var b = eui.bar.querySelector ? eui.bar.querySelector('.gl-pb-tog') : null;
    if (b) b.textContent = folded ? '‹' : '›';
  }

  /* ---------- 表达式行 ---------- */
  function addExprRow(src, color) {
    if (!eui.listEl) return null;
    var id = 'ue' + (++eui.rowSeq);
    var row = cel('div', 'gl-expr-row');
    row.setAttribute('data-id', id);
    var dot = cel('span', 'gl-expr-dot');
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'gl-expr-in';
    inp.spellcheck = false;
    inp.setAttribute('autocomplete', 'off');
    inp.placeholder = '例如 y = x^2 - 2x + 1';
    inp.value = String(src == null ? '' : src);
    var del = cel('button', 'gl-expr-del', '✕');
    del.type = 'button';
    del.title = '删除这条表达式';
    var err = cel('div', 'gl-expr-err');
    row.appendChild(dot); row.appendChild(inp); row.appendChild(del); row.appendChild(err);
    var rec = { id: id, row: row, dot: dot, inp: inp, del: del, err: err, color: color || null };
    if (!rec.color) {
      var used = [], i;
      for (i = 0; i < eui.rows.length; i++) if (eui.rows[i].color) used.push(eui.rows[i].color);
      rec.color = (engine.ueNextColor) ? engine.ueNextColor(used) : '#4fc3f7';
    }
    dot.style.background = rec.color;
    inp.addEventListener('input', function () { scheduleApply(); });
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); applyExprs(); }
    });
    del.addEventListener('click', function (ev) {
      if (ev.preventDefault) ev.preventDefault();
      removeExprRow(rec);
    });
    eui.rows.push(rec);
    eui.listEl.appendChild(row);
    return rec;
  }
  function removeExprRow(rec) {
    var i;
    for (i = 0; i < eui.rows.length; i++) {
      if (eui.rows[i] === rec) { eui.rows.splice(i, 1); break; }
    }
    if (rec.row && rec.row.parentNode) rec.row.parentNode.removeChild(rec.row);
    applyExprs();
  }
  function clearExprRows() {
    var i;
    for (i = 0; i < eui.rows.length; i++) {
      if (eui.rows[i].row && eui.rows[i].row.parentNode) {
        eui.rows[i].row.parentNode.removeChild(eui.rows[i].row);
      }
    }
    eui.rows = [];
    if (engine && engine.ueClear) engine.ueClear();
    renderParams();
  }
  function scheduleApply() {
    if (eui.applyTimer) clearTimeout(eui.applyTimer);
    // 防抖 150ms(需求上限 200ms):连续敲键只在停顿后提交一次
    eui.applyTimer = setTimeout(function () { eui.applyTimer = null; applyExprs(); }, 150);
  }

  /* ---------- 提交表达式 -> 引擎(整表解析,参数表同步) ---------- */
  function applyExprs() {
    if (eui.applyTimer) { clearTimeout(eui.applyTimer); eui.applyTimer = null; }
    if (!engine || !engine.ueSet) return;
    var items = [], i, r, s, info;
    for (i = 0; i < eui.rows.length; i++) {
      r = eui.rows[i];
      s = String(r.inp.value == null ? '' : r.inp.value);
      if (!s.replace(/\s+/g, '')) { r.err.textContent = ''; r.row.className = 'gl-expr-row'; continue; }
      items.push({ id: r.id, src: s, color: r.color });
    }
    info = engine.ueSet(items) || [];
    var byId = {}, j, it;
    for (j = 0; j < info.length; j++) byId[info[j].id] = info[j];
    for (i = 0; i < eui.rows.length; i++) {
      r = eui.rows[i];
      it = byId[r.id];
      if (!it) continue;
      if (it.color && it.color !== r.color) { r.color = it.color; r.dot.style.background = it.color; }
      if (it.ok) {
        r.row.className = 'gl-expr-row';
        r.err.textContent = '';
      } else {
        r.row.className = 'gl-expr-row bad';
        r.err.textContent = '⚠ ' + (it.err || '无法解析');
      }
      // 用户手工改写了参数定义式(例如拖动滑块后又把 a = 3 改成 a = 5):
      // 文本即真相 —— 把滑块拉到新值,避免"定义式与滑块各说各话"
      var srcNow = String(r.inp.value == null ? '' : r.inp.value);
      if (r.lastSrc !== undefined && r.lastSrc !== srcNow &&
        it.ok && it.kind === 'param' && it.lhs && it.constVal !== null) {
        engine.ueSetParam(it.lhs, it.constVal);
      }
      r.lastSrc = srcNow;
    }
    // θ 区间只在有 r=f(θ) 时才显得重要:没有就把那一行压暗
    var hasPolar = false;
    for (j = 0; j < info.length; j++) if (info[j].kind === 'r') hasPolar = true;
    if (eui.thetaWrap) eui.thetaWrap.className = hasPolar ? 'gl-expr-foot2' : 'gl-expr-foot2 dim';
    renderParams();
    saveExprState();
    // 画布上还没有 AI 图元时,给用户的第一条曲线自动取一次景(只做一次,不抢用户视野)
    if (!eui.fittedOnce && canvasCount() === 0) {
      var drawable = 0;
      for (j = 0; j < info.length; j++) if (info[j].ok && info[j].kind !== 'param') drawable++;
      if (drawable > 0) { eui.fittedOnce = true; if (engine.ueFit) engine.ueFit(); }
    }
    if (info.length && !canvasActive) setDemoState('画布:已输入 ' + info.length + ' 条表达式');
    updateToolbarState();
  }

  /* ---------- 参数滑块栏 ---------- */
  function renderParams() {
    if (!eui.barList || !engine || !engine.ueParams) return;
    var ps = engine.ueParams() || [];
    var seen = {}, i, p, rec, name;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      seen[p.name] = 1;
      rec = eui.pRecs[p.name];
      if (!rec) rec = createParamRow(p);
      syncParamRow(rec, p);
    }
    for (name in eui.pRecs) {
      if (!Object.prototype.hasOwnProperty.call(eui.pRecs, name)) continue;
      if (seen[name]) continue;
      rec = eui.pRecs[name];
      if (rec.row && rec.row.parentNode) rec.row.parentNode.removeChild(rec.row);
      delete eui.pRecs[name];
    }
    if (eui.barEmpty) eui.barEmpty.style.display = ps.length ? 'none' : '';
  }
  function createParamRow(p) {
    var row = cel('div', 'gl-param');
    row.setAttribute('data-name', p.name);
    var top = cel('div', 'gl-param-top');
    top.appendChild(cel('span', 'gl-param-name', p.name));
    top.appendChild(cel('span', 'gl-param-eq', '='));
    var val = cel('input', 'gl-param-val');
    val.type = 'number';
    val.step = 'any';
    top.appendChild(val);
    row.appendChild(top);
    var rg = cel('input', 'gl-param-range');
    rg.type = 'range';
    row.appendChild(rg);
    var lim = cel('div', 'gl-param-lim');
    var mn = cel('input'), mx = cel('input'), stp = cel('input');
    mn.type = 'number'; mx.type = 'number'; stp.type = 'number';
    mn.title = '最小值'; mx.title = '最大值'; stp.title = '步长';
    lim.appendChild(cel('span', null, '最小'));
    lim.appendChild(mn);
    lim.appendChild(cel('span', null, '最大'));
    lim.appendChild(mx);
    lim.appendChild(cel('span', null, '步长'));
    lim.appendChild(stp);
    row.appendChild(lim);
    var rec = { name: p.name, row: row, val: val, rg: rg, mn: mn, mx: mx, stp: stp };
    rg.addEventListener('input', function () { onParamInput(rec, parseFloat(rg.value)); });
    rg.addEventListener('change', function () {
      onParamInput(rec, parseFloat(rg.value));
      saveExprState();
    });
    val.addEventListener('input', function () { onParamInput(rec, parseFloat(val.value)); });
    val.addEventListener('change', function () { onParamInput(rec, parseFloat(val.value)); saveExprState(); });
    function onLim() {
      var a = parseFloat(mn.value), b = parseFloat(mx.value), s = parseFloat(stp.value);
      if (engine.ueSetParamRange) engine.ueSetParamRange(rec.name, a, b, s);
      var ps = engine.ueParams ? engine.ueParams() : [];
      for (var k = 0; k < ps.length; k++) if (ps[k].name === rec.name) syncParamRow(rec, ps[k]);
      saveExprState();
    }
    mn.addEventListener('change', onLim);
    mx.addEventListener('change', onLim);
    stp.addEventListener('change', onLim);
    eui.pRecs[p.name] = rec;
    eui.barList.appendChild(row);
    return rec;
  }
  function fmtParam(v) {
    if (!isFinite(v)) return '0';
    var r = Math.round(v * 1e6) / 1e6;
    return String(r);
  }
  function syncParamRow(rec, p) {
    rec.rg.min = fmtParam(p.min);
    rec.rg.max = fmtParam(p.max);
    rec.rg.step = fmtParam(p.step > 0 ? p.step : 0.1);
    rec.rg.value = fmtParam(p.value);
    if (document.activeElement !== rec.val) rec.val.value = fmtParam(p.value);
    if (document.activeElement !== rec.mn) rec.mn.value = fmtParam(p.min);
    if (document.activeElement !== rec.mx) rec.mx.value = fmtParam(p.max);
    if (document.activeElement !== rec.stp) rec.stp.value = fmtParam(p.step);
  }
  /* 滑块/数值框改动:rAF 节流 —— 一帧只提交一次参数值并重绘 */
  function onParamInput(rec, v) {
    if (!engine || !engine.ueSetParam) return;
    if (!isFinite(v)) return;
    rec.pending = v;
    eui.pending[rec.name] = v;
    if (eui.rafId != null) return;
    var run = function () {
      eui.rafId = null;
      var k;
      for (k in eui.pending) {
        if (!Object.prototype.hasOwnProperty.call(eui.pending, k)) continue;
        var vv = eui.pending[k];
        delete eui.pending[k];
        if (engine.ueSetParam(k, vv)) {
          // 参数有 a=2 这类定义式时,把定义行文本同步成新值(只在输入框未聚焦时改)
          syncParamDefText(k, vv);
          var rr = eui.pRecs[k];
          if (rr && rr.val && document.activeElement !== rr.val) rr.val.value = fmtParam(vv);
        }
      }
      /* 引擎会把超区间的值夹回 [min,max](见 glcanvas.js ueClampParam):
         回读一次,让数值框/滑块始终显示引擎真正在用的那个数 —— 否则在数值框里
         敲一个区间外的值(如区间 0..1 时敲 99),数值框停在你敲的 99、
         滑块被浏览器夹到 1、曲线按 1 画。 */
      renderParams();
    };
    if (typeof requestAnimationFrame === 'function') eui.rafId = requestAnimationFrame(run);
    else eui.rafId = setTimeout(run, 16);
  }
  // 把 a = 2 这一行的文本同步为 a = 3(拖滑块后定义式与滑块不再各说各话)
  function syncParamDefText(name, v) {
    if (!engine.ueList) return;
    var info = engine.ueList() || [], i, it, j, rec;
    for (i = 0; i < info.length; i++) {
      it = info[i];
      if (it.kind !== 'param' || it.lhs !== name) continue;
      for (j = 0; j < eui.rows.length; j++) {
        rec = eui.rows[j];
        if (rec.id !== it.id) continue;
        if (document.activeElement === rec.inp) continue;
        rec.inp.value = name + ' = ' + fmtParam(v);
      }
    }
  }

  /* ---------- θ 区间 ---------- */
  function applyTheta() {
    if (!engine || !engine.ueSetTheta) return;
    var va = String(eui.thetaA.value == null ? '' : eui.thetaA.value);
    var vb = String(eui.thetaB.value == null ? '' : eui.thetaB.value);
    var a = engine.calcConst ? engine.calcConst(va) : parseFloat(va);
    var b = engine.calcConst ? engine.calcConst(vb) : parseFloat(vb);
    eui.thetaA.className = isFinite(a) ? 'gl-theta-in' : 'gl-theta-in bad';
    eui.thetaB.className = isFinite(b) ? 'gl-theta-in' : 'gl-theta-in bad';
    if (!isFinite(a) || !isFinite(b) || !(b > a)) return;   // 非法输入:保留上一次的有效区间
    engine.ueSetTheta(a, b);
    saveExprState();
  }

  /* ---------- 持久化(qg_gl_expr_v1) ---------- */
  function saveExprState() {
    if (eui.saveTimer) clearTimeout(eui.saveTimer);
    eui.saveTimer = setTimeout(function () {
      eui.saveTimer = null;
      try {
        var d = {
          v: 1,
          theta: [String(eui.thetaA ? eui.thetaA.value : '0'),
            String(eui.thetaB ? eui.thetaB.value : '2π')],
          grid: !!(eui.gridBox && eui.gridBox.checked),
          exprs: [], params: {}
        };
        var i, r, s;
        for (i = 0; i < eui.rows.length; i++) {
          r = eui.rows[i];
          s = String(r.inp.value == null ? '' : r.inp.value);
          if (!s.replace(/\s+/g, '')) continue;
          d.exprs.push({ src: s, color: r.color });
        }
        var ps = engine.ueParams ? engine.ueParams() : [];
        for (i = 0; i < ps.length; i++) {
          d.params[ps[i].name] = {
            v: ps[i].value, min: ps[i].min, max: ps[i].max, step: ps[i].step,
            touched: ps[i].touched ? 1 : 0
          };
        }
        localStorage.setItem(LS_EXPR, JSON.stringify(d));
      } catch (e) { /* 存储失败(隐私模式/配额)不影响使用 */ }
    }, 300);
  }
  function loadExprState() {
    var raw = null, d = null, i;
    try { raw = localStorage.getItem(LS_EXPR); } catch (e) { raw = null; }
    if (raw) { try { d = JSON.parse(raw); } catch (e2) { d = null; } }
    if (!d || typeof d !== 'object') return false;
    var list = Object.prototype.toString.call(d.exprs) === '[object Array]' ? d.exprs : [];
    for (i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      addExprRow(String(list[i].src == null ? '' : list[i].src),
        typeof list[i].color === 'string' ? list[i].color : null);
    }
    if (Object.prototype.toString.call(d.theta) === '[object Array]' && eui.thetaA) {
      eui.thetaA.value = String(d.theta[0] == null ? '0' : d.theta[0]);
      eui.thetaB.value = String(d.theta[1] == null ? '2π' : d.theta[1]);
    }
    if (d.grid && eui.gridBox) {
      eui.gridBox.checked = true;
      eui.gridOn = true;
      if (engine.setPolarGrid) engine.setPolarGrid(true);
    }
    applyTheta();
    applyExprs();
    // 参数:区间总是恢复;数值只恢复"用户手动调过"的(touched),
    // 否则会把 a=2 这类定义式的初值钉死,之后改定义式就不生效了
    var ps = d.params || {}, k;
    for (k in ps) {
      if (!Object.prototype.hasOwnProperty.call(ps, k)) continue;
      var p = ps[k];
      if (!p) continue;
      if (engine.ueSetParamRange) engine.ueSetParamRange(k, p.min, p.max, p.step);
      if (p.touched && engine.ueSetParam) engine.ueSetParam(k, p.v);
    }
    renderParams();
    applyExprs();
    return true;
  }

  /* ---------- 工具条联动 ---------- */
  function updateToolbarState() {
    ensureToolbar();
    if (!canvasActive) {
      var st = $('glDemoState');
      if (st) {
        st.textContent = exprCount()
          ? ('画布:已输入 ' + exprCount() + ' 条表达式 · 点「🎬 动态演示」出 AI 图')
          : '画布:空';
      }
    }
  }

  /* ---------- 初始化 ---------- */
  function initExprUI() {
    if (!buildExprUI()) return false;
    // 引擎视野被用户接管(滚轮/拖拽/双击)后,不再让 AI 场景的自动取景抢走视野
    engine.onViewChange = function () { engine.autoFitOnUpdate = false; };
    // 双击复位:有用户表达式时按表达式取景,否则交给引擎的默认视野
    engine.onDblClick = function () {
      if (exprCount() > 0 && engine.ueFit) { engine.ueFit(); return true; }
      return false;
    };
    var restored = loadExprState();
    if (!restored || !eui.rows.length) {
      if (!eui.rows.length) addExprRow('', null);
      applyExprs();
    }
    renderParams();
    // 窄窗(主窗浮动面板)下默认折叠参数栏,折叠后不挡画布
    var stage = $('glStage');
    if (stage && stage.clientWidth && stage.clientWidth < 620) {
      if (eui.bar && eui.bar.className.indexOf('folded') < 0) {
        eui.bar.className = 'folded';
        var b = eui.bar.querySelector ? eui.bar.querySelector('.gl-pb-tog') : null;
        if (b) b.textContent = '‹';
      }
    }
    if (window.addEventListener) {
      window.addEventListener('resize', function () {
        if (eui.userBarToggle || !eui.bar || !stage) return;
        if (eui.bar.className.indexOf('folded') >= 0) return;
        if (stage.clientWidth && stage.clientWidth < 620) {
          eui.bar.className = 'folded';
          var b2 = eui.bar.querySelector ? eui.bar.querySelector('.gl-pb-tog') : null;
          if (b2) b2.textContent = '‹';
        }
      });
    }
    return true;
  }

  var lastUserText = '';     // 最近一次成功发出的提问
  var lastAiText = '';       // 最近一条 AI 回答
  var canvasActive = false;  // 画布是否已出过图

  function setDemoState(txt) {
    var el = $('glDemoState');
    if (el) el.textContent = txt || '';
  }
  function showCanvasUI() {
    var tb = $('glToolbar');
    if (tb) tb.hidden = false;
    if (els.glStageTip) els.glStageTip.style.display = 'none';
    canvasActive = true;
    ensureToolbar();
  }

  // —— 把一段 AI 输出严格当 JSON 解析(剥围栏) ——
  function parseJsonStrict(s) {
    var t = String(s || '');
    var a = t.indexOf('{');
    var b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('AI 未返回 JSON');
    var obj = JSON.parse(t.slice(a, b + 1));
    return obj || {};
  }

  // —— 组装"演示调度"消息(让 AI 只输出协议 JSON) ——
  function demoProtocolSystem() {
    var lines = [];
    var m = window.QG_TEMPLATES && window.QG_TEMPLATES.manifest;
    if (m) {
      m.forEach(function (t) {
        var ps = (t.params || []).map(function (p) {
          return p.k + '(' + p.label + ',默认' + p.def + ')';
        }).join(';');
        lines.push('- ' + t.id + '「' + t.name + '」:' + (t.desc || '') + ' 参数:' + ps);
      });
    }
    return '你是"观澜"的动态演示调度器,把用户最近提问变成**画布场景**。三种输出任选其一,只输出 JSON:' +
      '\n(1) 内置模板合适时:{"mode":"template","template":"<模板id>","params":{"参数k":"值"},"caption":"不超过40字的一句话讲解"}' +
      '\n(2) 没有合适模板时,自己按下面的画布 schema 现场生成:{"mode":"scene","scene":{...},"caption":"不超过40字的讲解"}' +
      '\n(3) 都不适合时:{"mode":"none","reason":"简短理由"}' +
      '\n\n【画布 schema(纯声明式,必须严格遵守)】' +
      '\n{"anim":{"mode":"pingpong|once|loop","dur":秒},"defs":[...],"objects":[...]}' +
      '\n· defs(几何定义,id 只能由英文字母/数字/下划线/连字符组成,1~24 位,**不要用中文或标点**,且必须唯一;op 只能取):' +
      '\n  {"id":"A","op":"fixed","x":数值或表达式,"y":...}                    // 定点' +
      '\n  {"id":"l","op":"line","a":点,"b":点}                                // 过两点的直线' +
      '\n  {"id":"P","op":"onLine","line":"l","t":0..1}                        // 直线上按比例的点' +
      '\n  {"id":"A1","op":"reflect","pt":"A","line":"l"}                      // 关于直线对称点' +
      '\n  {"id":"Q","op":"lineIntersect","l1":"l","l2":"m"}                   // 两直线交点' +
      '\n  {"id":"M","op":"mid","a":"A","b":"B"}                               // 中点' +
      '\n  {"id":"N","op":"between","a":"A","b":"B","t":0.6}                   // 定比分点' +
      '\n· objects(type 只能取,id 同上规则):' +
      '\n  dot{pt,r,color,label,drag:"free"}、segment/arrow{a,b,color,width,dash}、' +
      'line{a,b 或 a:直线id,label}、ray{a,b}、circle{c,r 或 rPt}、' +
      'polyline/polygon{pts:[点,...],fill}、curve{fn:"含 x 的表达式",x0,x1}、' +
      'polar{r:"含 θ 的表达式",thetaMin,thetaMax,color,width}、' +
      'text{at:点,text,offset:{x,y},size} 以及带 tex:"$公式$" 的 MathJax 标注' +
      '\n· **极坐标曲线(玫瑰线/花瓣线/心形线/螺线/圆)一律用 polar,禁止用 curve 顶替**:' +
      '\n  polar 是引擎的一等图元,内部按 x = r·cosθ、y = r·sinθ 换算后画在普通直角坐标系上,' +
      'r<0 时点自然落在反方向(不要取绝对值、不要自己补负号);' +
      '\n  写法:{"id":"rose","type":"polar","r":"cos(3*theta)","thetaMin":0,"thetaMax":6.283185307179586,"color":"#ffd54f"}' +
      '\n  · r 是 θ 的表达式(θ 可写 theta 或 θ,π 写 PI;可用 + - * / ^ 与全部白名单函数);' +
      '\n  · thetaMin/thetaMax 是 θ 的扫过范围,玫瑰线/心形线用 0 ~ 6.283185307179586,' +
      '螺线 r=0.2*theta 用 0 ~ 12.566370614359172(多转几圈);' +
      '\n  · 例:三瓣玫瑰线 r=cos(3*theta)、四瓣玫瑰线 r=cos(2*theta)、' +
      '五瓣 r=2+cos(5*theta)、心形线 r=1-cos(theta)、圆 r=2*sin(theta)、' +
      '阿基米德螺线 r=0.3*theta、双纽线 r=sqrt(4*cos(2*theta))' +
      '\n  · 讲解文字里若写了"极坐标 / r = … / 玫瑰线 / 花瓣 / 螺线 / 心形线",' +
      '画布上就必须有对应的 polar 图元,否则学生会看到"标注说玫瑰线、画的是波浪线"' +
      '\n· "点"可以写成 def/object 的 id 字符串,或 {"x":...,"y":...},或 [x,y]' +
      '\n· 表达式里只允许变量 u(动画相位 0→1)、x(曲线自变量)、PI、E,以及函数' +
      ' sin cos tan asin acos atan atan2 sqrt cbrt abs pow hypot min max exp ln log log2 floor ceil round sign;' +
      '禁止任何变量名(参数必须先在计算后写成数字)' +
      '\n· 限制:defs ≤ 60 条、objects ≤ 90 条;不要输出多余字段;坐标范围建议控制在 ±20 内' +
      '\n· 无合适模板但能画出示意时优先用 scene;画不出就用 none,不要硬凑' +
      '\n\n【内置模板(优先使用)】\n' + (lines.join('\n') || '(暂无)');
  }

  /* ---------- AI 现场生成场景:白名单校验(失败即拒绝,不清空已有画面) ---------- */
  var DEF_OPS = { fixed: 1, line: 1, onLine: 1, reflect: 1, lineIntersect: 1, mid: 1, between: 1 };
  var OBJ_TYPES = {
    dot: 1, segment: 1, line: 1, ray: 1, circle: 1,
    polyline: 1, polygon: 1, arrow: 1, curve: 1, polar: 1, text: 1
  };
  var ID_RE = /^[A-Za-z0-9_-]{1,24}$/;
  function isPlainObj(v) {
    return v !== null && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]';
  }
  function isArr2(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function isNumExpr(v) {
    if (typeof v === 'number') return isFinite(v);
    if (typeof v === 'string') return v.length > 0 && v.length <= 160;
    return false;
  }
  function isPointRef(v) {
    if (typeof v === 'string') return ID_RE.test(v);
    if (isArr2(v)) return v.length >= 2 && isNumExpr(v[0]) && isNumExpr(v[1]);
    if (isPlainObj(v)) return isNumExpr(v.x) && isNumExpr(v.y);
    return false;
  }
  function isLineRef(v) { return typeof v === 'string' ? ID_RE.test(v) : isPointRef(v); }
  function cpPoint(v) {
    if (typeof v === 'string') return v;
    if (isArr2(v)) return [v[0], v[1]];
    return { x: v.x, y: v.y };
  }
  function cpStr(v, n) { return (typeof v === 'string' && v.length <= n) ? v : null; }
  function cpNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  // 宽松数值:模型常把区间写成字符串("0" / "6.283185307179586"),一并接受
  function cpNumLoose(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.length <= 40) {
      var n = parseFloat(v);
      if (isFinite(n)) return n;
    }
    return null;
  }
  function cpStyle(src, out, forLine) {
    var c = cpStr(src.color, 32); if (c) out.color = c;
    var w = cpNum(src.width); if (w !== null && w > 0 && w <= 12) out.width = w;
    if (src.dash === true || src.dash === false) out.dash = src.dash;
    else if (isArr2(src.dash) && src.dash.length <= 6 && src.dash.every(function (x) { return typeof x === 'number'; })) out.dash = src.dash.slice();
    var lb = cpStr(src.label, 20); if (forLine && lb) out.label = lb;
  }
  // 报错要说清"到底是哪种不对":非对象与 id 不合法原先共用同一句
  // 「objects[0] id 非法」,把两类完全不同的原因混在一起,日志里也看不出所以然。
  function typeName(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (isArr2(v)) return 'array';
    return typeof v;
  }
  function cleanDef(d, idx) {
    if (!isPlainObj(d)) return 'defs[' + idx + '] 不是对象(收到 ' + typeName(d) + ')';
    if (!ID_RE.test(String(d.id || ''))) return 'defs[' + idx + '] id 不合法:"' + String(d.id) + '"';
    if (!DEF_OPS[d.op]) return 'defs[' + idx + '] op 非法:' + d.op;
    var o = { id: d.id, op: d.op };
    if (d.op === 'fixed') {
      if (!isNumExpr(d.x) || !isNumExpr(d.y)) return 'defs[' + idx + '] fixed 需要数值/表达式 x,y';
      o.x = d.x; o.y = d.y;
    } else if (d.op === 'line') {
      if (!isPointRef(d.a) || !isPointRef(d.b)) return 'defs[' + idx + '] line 需要点 a,b';
      o.a = cpPoint(d.a); o.b = cpPoint(d.b);
    } else if (d.op === 'onLine') {
      if (!isLineRef(d.line) || !isNumExpr(d.t)) return 'defs[' + idx + '] onLine 需要 line,t';
      o.line = d.line; o.t = d.t;
    } else if (d.op === 'reflect') {
      if (!isPointRef(d.pt) || !isLineRef(d.line)) return 'defs[' + idx + '] reflect 需要 pt,line';
      o.pt = d.pt; o.line = d.line;
    } else if (d.op === 'lineIntersect') {
      if (!isLineRef(d.l1) || !isLineRef(d.l2)) return 'defs[' + idx + '] lineIntersect 需要 l1,l2';
      o.l1 = d.l1; o.l2 = d.l2;
    } else if (d.op === 'mid') {
      if (!isPointRef(d.a) || !isPointRef(d.b)) return 'defs[' + idx + '] mid 需要 a,b';
      o.a = d.a; o.b = d.b;
    } else if (d.op === 'between') {
      if (!isPointRef(d.a) || !isPointRef(d.b) || !isNumExpr(d.t)) return 'defs[' + idx + '] between 需要 a,b,t';
      o.a = d.a; o.b = d.b; o.t = d.t;
    }
    return o;
  }
  function cleanObject(o, idx) {
    if (!isPlainObj(o)) return 'objects[' + idx + '] 不是对象(收到 ' + typeName(o) + ')';
    if (!ID_RE.test(String(o.id || ''))) return 'objects[' + idx + '] id 不合法:"' + String(o.id) + '"';
    if (!OBJ_TYPES[o.type]) return 'objects[' + idx + '] type 非法:' + o.type;
    var e = { id: o.id, type: o.type };
    if (o.type === 'dot') {
      if (!isPointRef(o.pt)) return 'objects[' + idx + '] dot 需要 pt';
      e.pt = cpPoint(o.pt);
      var r = cpNum(o.r); if (r !== null && r > 0 && r <= 30) e.r = r;
      var lb = cpStr(o.label, 20); if (lb) e.label = lb;
      if (o.drag === 'free') e.drag = 'free';
      cpStyle(o, e, false);
    } else if (o.type === 'segment' || o.type === 'arrow' || o.type === 'ray') {
      if (!isPointRef(o.a) || !isPointRef(o.b)) return 'objects[' + idx + '] ' + o.type + ' 需要点 a,b';
      e.a = cpPoint(o.a); e.b = cpPoint(o.b);
      cpStyle(o, e, o.type === 'ray');
    } else if (o.type === 'line') {
      if (isLineRef(o.a) && typeof o.a === 'string' && !o.b) {
        e.a = o.a;
      } else {
        if (!isPointRef(o.a) || !isPointRef(o.b)) return 'objects[' + idx + '] line 需要 a(直线id)或 a,b 两点';
        e.a = cpPoint(o.a); e.b = cpPoint(o.b);
      }
      cpStyle(o, e, true);
    } else if (o.type === 'circle') {
      if (!isPointRef(o.c)) return 'objects[' + idx + '] circle 需要 c';
      e.c = cpPoint(o.c);
      if (isNumExpr(o.r)) e.r = o.r;
      else if (isPointRef(o.rPt)) e.rPt = cpPoint(o.rPt);
      else return 'objects[' + idx + '] circle 需要 r 或 rPt';
      cpStyle(o, e, false);
    } else if (o.type === 'polyline' || o.type === 'polygon') {
      if (!isArr2(o.pts) || o.pts.length < 2 || o.pts.length > 120) return 'objects[' + idx + '] ' + o.type + ' pts 数量非法';
      var ok = o.pts.every(isPointRef);
      if (!ok) return 'objects[' + idx + '] ' + o.type + ' pts 含非法点';
      e.pts = o.pts.map(cpPoint);
      var fl = cpStr(o.fill, 40); if (fl) e.fill = fl;
      cpStyle(o, e, false);
    } else if (o.type === 'curve') {
      var fn = cpStr(o.fn, 160);
      if (!fn) return 'objects[' + idx + '] curve 需要 fn 表达式';
      if (!isNumExpr(o.x0) || !isNumExpr(o.x1)) return 'objects[' + idx + '] curve 需要 x0,x1';
      e.fn = fn; e.x0 = o.x0; e.x1 = o.x1;
      cpStyle(o, e, false);
    } else if (o.type === 'polar') {
      // 极坐标曲线:r 是 θ 的表达式(θ/theta 都行),thetaMin/thetaMax 是 θ 的范围
      var pr = cpStr(o.r, 200) || cpStr(o.fn, 200);
      if (!pr) return 'objects[' + idx + '] polar 需要 r(含 θ 的表达式)';
      e.r = pr;
      var pt0 = cpNumLoose(o.thetaMin), pt1 = cpNumLoose(o.thetaMax);
      e.thetaMin = (pt0 !== null) ? pt0 : 0;
      e.thetaMax = (pt1 !== null) ? pt1 : Math.PI * 2;
      if (!(e.thetaMax > e.thetaMin)) { e.thetaMin = 0; e.thetaMax = Math.PI * 2; }
      // θ 范围上限:AI 偶尔给出 1e9 这类值,引擎另有一道兜底,这里先拦一次
      if (e.thetaMax - e.thetaMin > Math.PI * 200) e.thetaMax = e.thetaMin + Math.PI * 200;
      cpStyle(o, e, false);
    } else if (o.type === 'text') {
      if (!isPointRef(o.at)) return 'objects[' + idx + '] text 需要 at';
      e.at = cpPoint(o.at);
      var tx = cpStr(o.text, 120); if (tx) e.text = tx;
      var te = cpStr(o.tex, 120); if (te) e.tex = te;
      if (!e.text && !e.tex) return 'objects[' + idx + '] text 需要 text 或 tex';
      if (isPlainObj(o.offset)) {
        var ox = cpNum(o.offset.x), oy = cpNum(o.offset.y);
        if (ox !== null && oy !== null) e.offset = { x: ox, y: oy };
      }
      var sz = cpNum(o.size); if (sz !== null && sz >= 8 && sz <= 28) e.size = sz;
      if (o.align === 'left' || o.align === 'center' || o.align === 'right') e.align = o.align;
      var c2 = cpStr(o.color, 32); if (c2) e.color = c2;
    }
    return e;
  }
  /* ---------- id 归一化 ----------
   * AI 现场生成时经常给出不合规的 id:中文(「点A」)、带标点(「A.1」「A B」)、
   * 超长、甚至漏写。这些只是命名问题,却会被 ID_RE 判非法而让整段演示失败
   * (界面表现为「动态生成失败:objects[0] id 非法」)。
   * 提示词里虽然已写明"id 为 1~24 位字母数字",但约束模型并不能保证 —— 这里兜底:
   *   非法字符去掉 → 超长截断 → 重名加后缀 → 空 id 自动编号,
   * 并**同步改写所有引用**(pt/a/b/line/l1/l2/c/rPt/at/pts),让"命名不规范"
   * 不再等于"演示做不出来"。
   * 取舍:这样重名不再报错(会被自动去重),代价是偶尔掩盖模型的重复 id;
   * 换来的是演示能画出来 —— 对教学场景这个取舍是值的。
   */
  var REF_KEYS = ['pt', 'a', 'b', 'line', 'l1', 'l2', 'c', 'rPt', 'at'];
  var _hasOwn = Object.prototype.hasOwnProperty;
  function hk(o, k) { return !!o && _hasOwn.call(o, k); }

  function sanitizeId(s) {
    s = String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '');
    if (s.length > 24) s = s.slice(0, 24);
    return s;
  }

  // 与 [defs..., objects...] 同序产出规范 id;refMap 只记"首次出现"用于解析引用
  function buildIdPlan(defs, objs) {
    var refMap = Object.create(null), used = Object.create(null);
    var auto = 0, fixed = 0, seq = [];
    function pick(orig) {
      var cand = sanitizeId(orig);
      if (!cand) { auto++; cand = 'x' + auto; }
      var base = cand, n = 1;
      while (hk(used, cand)) { n++; cand = base + '_' + n; if (cand.length > 24) cand = cand.slice(0, 24); }
      used[cand] = 1;
      if (cand !== orig) fixed++;
      return cand;
    }
    var i, it, orig, a, b;
    for (i = 0; i < defs.length; i++) {
      it = defs[i]; orig = isPlainObj(it) ? String(it.id == null ? '' : it.id) : '';
      a = pick(orig);
      if (!hk(refMap, orig)) refMap[orig] = a;
      seq.push(a);
    }
    for (i = 0; i < objs.length; i++) {
      it = objs[i]; orig = isPlainObj(it) ? String(it.id == null ? '' : it.id) : '';
      b = pick(orig);
      if (!hk(refMap, orig)) refMap[orig] = b;
      seq.push(b);
    }
    return { refMap: refMap, seq: seq, fixed: fixed };
  }

  function remapRef(v, refMap) {
    return (typeof v === 'string' && hk(refMap, v)) ? refMap[v] : v;
  }

  // 按 idPlan 重写 id 与引用,返回新对象(不改动原 scene)
  function remapScene(raw, plan) {
    function one(o, newId) {
      var c = {}, k, i, rk;
      for (k in o) { if (hk(o, k)) c[k] = o[k]; }
      c.id = newId;
      for (i = 0; i < REF_KEYS.length; i++) {
        rk = REF_KEYS[i];
        if (hk(c, rk)) c[rk] = remapRef(c[rk], plan.refMap);
      }
      if (isArr2(c.pts)) c.pts = c.pts.map(function (p) { return remapRef(p, plan.refMap); });
      return c;
    }
    var out = {}, k2, i, nd = raw.defs.length;
    for (k2 in raw) { if (hk(raw, k2)) out[k2] = raw[k2]; }
    out.defs = [];
    for (i = 0; i < nd; i++) out.defs.push(isPlainObj(raw.defs[i]) ? one(raw.defs[i], plan.seq[i]) : raw.defs[i]);
    out.objects = [];
    for (i = 0; i < raw.objects.length; i++) {
      out.objects.push(isPlainObj(raw.objects[i]) ? one(raw.objects[i], plan.seq[nd + i]) : raw.objects[i]);
    }
    return out;
  }

  // 返回 {ok:true, scene, idFixed} 或 {ok:false, err}
  /* ---------- 极坐标归一化(修"标注与图形不符"的关键一环) ----------
   * 实测踩过的坑:提问"画一个花瓣线,就是极坐标 r=cos(3θ) 那种玫瑰线",AI 讲解
   * 完全正确,却把曲线写成了笛卡尔函数 → 画布上是一条余弦波浪线,而标注写着
   * 「三瓣玫瑰线」。除了提示词里要求用 polar 图元,这里再做一层兜底:
   * 模型若把极坐标曲线写进 defs(op:'polar'),defs 只参与点/线求值、不会被绘制,
   * 直接搬到 objects 当图元画,避免"讲了玫瑰线、画布上什么都没有"。
   */
  function normalizePolar(raw) {
    if (!isPlainObj(raw)) return raw;
    var defs = isArr2(raw.defs) ? raw.defs : [];
    var objs = isArr2(raw.objects) ? raw.objects : [];
    var i, d, found = false;
    for (i = 0; i < defs.length; i++) {
      d = defs[i];
      if (isPlainObj(d) && (d.op === 'polar' || d.type === 'polar')) { found = true; break; }
    }
    if (!found) return raw;
    var out = {}, k, k2;
    for (k in raw) { if (hk(raw, k)) out[k] = raw[k]; }
    out.defs = []; out.objects = [];
    for (i = 0; i < defs.length; i++) {
      d = defs[i];
      if (isPlainObj(d) && (d.op === 'polar' || d.type === 'polar')) {
        var m = {};
        for (k2 in d) { if (hk(d, k2)) m[k2] = d[k2]; }
        if (m.op === 'polar') delete m.op;
        m.type = 'polar';
        out.objects.push(m);
      } else {
        out.defs.push(d);
      }
    }
    for (i = 0; i < objs.length; i++) out.objects.push(objs[i]);
    return out;
  }

  /* ---------- "标注与图形不符"的防御性检查 ----------
   * 讲解/标注里出现极坐标关键词(极坐标 / r=…cosθ / 玫瑰线 / 花瓣 / 螺线 / 心形线),
   * 但场景里没有任何 polar 图元 → 图形大概率是笛卡尔函数顶替的,与标注不符。
   * 只提示、不拦演示(用户仍能看到图),但状态栏与气泡里要说清楚。
   * 注意:这里刻意不写 console.warn —— 自动化探针把控制台输出当异常收集,
   * 不能因为一句提示把既有回归测试判红。 */
  var POLAR_KW = /极坐标|玫瑰线|花瓣线|花瓣|螺线|心形线|ρ|r\s*=\s*[^,。;、]{0,12}(cos|sin)/;
  function polarMismatch(scene) {
    if (!isPlainObj(scene)) return false;
    var objs = isArr2(scene.objects) ? scene.objects : [];
    var i, o, txt, hasPolar = false, kw = false;
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      if (!isPlainObj(o)) continue;
      if (o.type === 'polar') { hasPolar = true; continue; }
      if (o.type === 'text') {
        txt = String(o.text == null ? '' : o.text) + ' ' + String(o.tex == null ? '' : o.tex);
        if (POLAR_KW.test(txt)) kw = true;
      }
    }
    return kw && !hasPolar;
  }

  function validateScene(raw) {
    if (!isPlainObj(raw)) return { ok: false, err: 'AI 未给出 scene 对象' };
    raw = normalizePolar(raw);   // 极坐标写进 defs 的写法先搬到 objects
    if (!isArr2(raw.defs)) raw.defs = [];
    if (!isArr2(raw.objects)) raw.objects = [];
    if (raw.defs.length > 60) return { ok: false, err: '几何定义过多(' + raw.defs.length + ' > 60)' };
    if (raw.objects.length > 90) return { ok: false, err: '图元过多(' + raw.objects.length + ' > 90)' };
    if (!raw.objects.length) return { ok: false, err: '场景里没有任何图元' };
    // 先归一化 id 与引用,再做原有逐字段校验(否则一个中文 id 就会让整段失败)
    var plan = buildIdPlan(raw.defs, raw.objects);
    if (plan.fixed > 0) raw = remapScene(raw, plan);
    var i, ids = {}, d;
    var out = { defs: [], objects: [] };
    for (i = 0; i < raw.defs.length; i++) {
      d = cleanDef(raw.defs[i], i);
      if (typeof d === 'string') return { ok: false, err: d };
      if (ids[d.id]) return { ok: false, err: 'defs id 重复:' + d.id };
      ids[d.id] = 1;
      out.defs.push(d);
    }
    for (i = 0; i < raw.objects.length; i++) {
      d = cleanObject(raw.objects[i], i);
      if (typeof d === 'string') return { ok: false, err: d };
      if (ids[d.id]) return { ok: false, err: 'id 重复:' + d.id };
      ids[d.id] = 1;
      out.objects.push(d);
    }
    if (isPlainObj(raw.anim)) {
      var md = raw.anim.mode;
      var du = cpNum(raw.anim.dur);
      out.anim = {
        mode: (md === 'once' || md === 'loop' || md === 'pingpong') ? md : 'pingpong',
        dur: (du !== null && du >= 0.2 && du <= 60) ? du : 6
      };
    } else {
      out.anim = { mode: 'pingpong', dur: 6 };
    }
    return { ok: true, scene: out, idFixed: plan.fixed };
  }

  // AI 出新场景 = 新的一幕,恢复"自动取景"(用户此前手动缩放/平移会把
  // engine.autoFitOnUpdate 置 false,不能让上一条演示的视野粘住新场景)
  function followScene() { if (engine) engine.autoFitOnUpdate = true; }

  // 应用 AI 现场生成的场景:校验 → 绘制 → 检查有效图元比例(不合格则清空并报错)
  function applyScene(scene) {
    if (!engine) return { ok: false, err: '画布引擎未就绪' };
    var v = validateScene(scene);
    if (!v.ok) return { ok: false, err: v.err };
    followScene();
    engine.clear();
    engine.update(v.scene);
    var objs = (engine.__gl && engine.__gl.objects) ? engine.__gl.objects : [];
    var total = objs.length, okN = 0, i;
    for (i = 0; i < total; i++) if (objs[i] && objs[i]._ok) okN++;
    if (!total || okN * 2 < total) {
      engine.clear();
      return { ok: false, err: '图形无法绘制(有效图元 ' + okN + '/' + total + ',多为表达式或引用错误)' };
    }
    showCanvasUI();
    engine.play();
    return {
      ok: true, objects: total, okObjects: okN, idFixed: v.idFixed || 0,
      mismatch: polarMismatch(v.scene)   // true = 标注提极坐标、图里却没有 polar 图元
    };
  }

  // —— 生成演示(手动按钮 / 测试钩子共用) ——
  function runDemoRequest() {
    if (!engine) { addBubble('err', '画布引擎未就绪'); return; }
    var key = load(LS_KEY);
    if (!key) { showKeyRow(); return; }
    var ask = lastUserText || (els.glAsk ? els.glAsk.value : '') || '';
    if (!ask) {
      // 退路:取对话最后一条 user
      for (var i = conv.length - 1; i >= 0; i--) {
        if (conv[i].role === 'user') { ask = conv[i].content; break; }
      }
    }
    var sysTxt = demoProtocolSystem();
    var userTxt = '最近提问:' + ask + '\nAI 回答:' + (lastAiText || '(无)') + '\n' + buildCtxLine();
    setDemoState('AI 调度中…');
    note('DEMO:start ask=' + String(ask == null ? '' : ask).slice(0, 50));
    dsAsk([{ role: 'system', content: sysTxt }, { role: 'user', content: userTxt }], key,
      { max_tokens: 900, temperature: 0.2, json: true })
      .then(function (content) {
        var obj = parseJsonStrict(content);
        if (!obj || obj.mode === 'none') {
          setDemoState('画布:未生成');
          note('DEMO:none reason=' + ((obj && obj.reason) ? String(obj.reason).slice(0, 90) : '(未给出)'));
          addBubble('ai', (obj && obj.reason) ? '当前问题暂不适用内置动态模板:' + obj.reason
            : '当前问题暂不适用内置动态模板(演示调度未给出原因)。');
          return;
        }
        if (obj.mode === 'scene') {
          // AI 现场生成的场景:先白名单校验,再绘制;失败则抛错走统一兜底
          var rawSc = obj.scene || {};
          var rawN = ((rawSc.objects && rawSc.objects.length) || 0) + ((rawSc.defs && rawSc.defs.length) || 0);
          var rs = applyScene(obj.scene);
          if (!rs.ok) {
            // 失败原因必须进日志,否则用户只能看到气泡、事后无从排查
            note('DEMO:scene FAIL raw=' + rawN + ' err=' + String(rs.err || '校验未通过'));
            throw new Error(rs.err || '场景校验未通过');
          }
          note('DEMO:scene ok raw=' + rawN + ' objs=' + rs.objects + ' okObjs=' + rs.okObjects
            + ' idFixed=' + (rs.idFixed || 0) + (rs.mismatch ? ' MISMATCH=polar-missing' : ''));
          setDemoState(rs.mismatch
            ? '⚠ AI 未使用极坐标图元(r=f(θ)),画面可能与标注不符'
            : '画布:AI 现场生成 · 播放中…');
          addBubble('ai', '🎬 已按题意现场生成动态演示(' + rs.okObjects + ' 个图元)'
            + (rs.idFixed ? '(已自动修正 ' + rs.idFixed + ' 个不规范 id)' : '')
            + ((obj.caption && String(obj.caption).trim()) ? '\n' + String(obj.caption).trim() : '')
            + (rs.mismatch ? '\n⚠ 注意:本次演示的标注提到极坐标(玫瑰线/心形线/螺线等),'
              + '但画面里没有 r=f(θ) 图元,图形可能与标注不符 —— 可在左上角表达式栏输入 '
              + 'r=cos(3θ) 自己画一朵核对。' : '')
            + '\n(右栏画布:播放 / 暂停 / 步进 / 重置;自由点可直接拖动)');
          return;
        }
        if (obj.mode !== 'template' || !obj.template) throw new Error('AI 调度格式异常');
        var builder = window.QG_TEMPLATES && window.QG_TEMPLATES.build &&
          window.QG_TEMPLATES.build[obj.template];
        var meta = null;
        if (window.QG_TEMPLATES && window.QG_TEMPLATES.manifest) {
          for (var mi = 0; mi < window.QG_TEMPLATES.manifest.length; mi++) {
            if (window.QG_TEMPLATES.manifest[mi].id === obj.template) meta = window.QG_TEMPLATES.manifest[mi];
          }
        }
        if (!builder) throw new Error('模板不存在:' + obj.template);
        var descriptor = builder(obj.params || {});
        followScene();
        engine.clear();
        engine.update(descriptor);
        showCanvasUI();
        setDemoState('画布:《' + (meta ? meta.name : obj.template) + '》 播放中…');
        engine.play();
        note('DEMO:template id=' + obj.template + ' objs='
          + (engine.getState ? engine.getState().objects : -1));
        addBubble('ai', '🎬 已生成动态演示《' + (meta ? meta.name : obj.template) + '》'
          + ((obj.caption && obj.caption.trim()) ? '\n' + String(obj.caption).trim() : '')
          + '\n(右栏画布:播放 / 暂停 / 步进 / 重置;拖动自由点可微调)');
      })
      .catch(function (err) {
        setDemoState('画布:生成失败');
        note('DEMO:fail ' + ((err && err.message) ? err.message : '未知错误'));
        addBubble('err', '动态演示生成失败:' + ((err && err.message) ? err.message : '未知错误'));
      });
  }

  // —— 工具条绑定 ——
  on('glDemoBtn', runDemoRequest);
  on('glPlayBtn', function () { if (engine) { engine.play(); setDemoState('播放中…'); } });
  on('glPauseBtn', function () { if (engine) { engine.pause(); setDemoState('已暂停(可步进)'); } });
  on('glStepBtn', function () { if (engine) { engine.pause(); engine.step(1); } });
  on('glResetBtn', function () { if (engine) { engine.reset(); setDemoState('已回到起点'); } });
  on('glClearCanvasBtn', function () {
    // 用户表达式与 AI 图元**一起**清(否则会出现"清空后函数还在"的困惑),
    // 但先给一次二次确认 —— 用户手写的表达式不该被一次误点抹掉
    var hasObj = canvasCount() > 0, hasEx = exprCount() > 0;
    if ((hasObj || hasEx) && !window.__glNoConfirm) {
      var msg = '清空画布将同时删除' + (hasObj ? 'AI 演示的图元' : '') +
        (hasObj && hasEx ? '和' : '') + (hasEx ? ('你输入的 ' + hasEx + ' 条表达式') : '') +
        ',确定继续吗?';
      var yes = true;
      try { yes = window.confirm(msg); } catch (e) { yes = true; }
      if (!yes) return;
    }
    if (engine) engine.clear();
    clearExprRows();
    if (engine && engine.ueClear) engine.ueClear();
    if (eui.listEl && !eui.rows.length) addExprRow('', null);
    applyExprs();
    canvasActive = false;
    ensureToolbar();
    setDemoState('画布:空 · 点「🎬 动态演示」出图,或在左上角输入表达式自己画');
    var tip2 = els.glStageTip;
    if (tip2) tip2.style.display = '';
  });

  // —— 拖动标题栏 ——
  var glHead = $('glHead');
  if (glHead) {
    glHead.addEventListener('pointerdown', headPointerDown);
    // 双击标题栏最大化/还原 —— 与主窗、破卷窗一致(原先只有观澜独立窗没有)
    glHead.addEventListener('dblclick', function (e) {
      if (e.target && e.target.closest && e.target.closest('button, input, select, a, textarea')) return;
      maxWindow();
    });
  }
  if (window.addEventListener) {
    window.addEventListener('pointermove', headPointerMove);
    window.addEventListener('pointerup', headPointerUp);
    // 缺 pointercancel 时,系统取消指针(切换窗口、触控笔离开感应区)不会复位状态,
    // 表现为面板继续"粘"着鼠标走。train.js / mainbridge.js 都有这个处理,这里补齐。
    window.addEventListener('pointercancel', headPointerUp);
    window.addEventListener('blur', headPointerUp);
  }

  /* ---------- 调试口 ---------- */
  window.__guanlanTest = {
    open: openPanel,
    close: closePanel,
    send: function (text) {          // 触发异步流程后立即返回
      if (els.glAsk) els.glAsk.value = String(text == null ? '' : text);
      doSend();
    },
    state: function () {
      return {
        visible: !!(els.guanlan && !els.guanlan.hidden),
        convLen: conv.length,
        keySet: !!load(LS_KEY),
        engineReady: !!engine,
        canvasActive: canvasActive
      };
    },
    clear: clearConv,
    applyDemo: function (templateId, params) {   // 测试钩子:跳过 AI 直接出图
      if (!engine || !window.QG_TEMPLATES || !window.QG_TEMPLATES.build) return { ok: false, err: 'engine/templates missing' };
      var builder = window.QG_TEMPLATES.build[templateId];
      if (!builder) return { ok: false, err: 'no template ' + templateId };
      var descriptor = builder(params || {});
      followScene();
      engine.clear();
      engine.update(descriptor);
      showCanvasUI();
      setDemoState('画布:《' + templateId + '》 播放中…');
      engine.play();
      return { ok: true, objects: engine.getState ? engine.getState().objects : -1 };
    },
    engine: function () { return engine; },
    applyScene: function (scene) { return applyScene(scene); },   // 测试钩子:AI 现场生成路径
    validateScene: validateScene,                                 // 测试钩子:仅校验不绘制
    templates: function () { return (window.QG_TEMPLATES && window.QG_TEMPLATES.manifest) || []; },
    // 用户表达式 / 参数滑块 测试钩子(与真实 UI 共用同一套引擎入口)
    expr: {
      set: function (list) {          // 直接用文本数组设置表达式(等同逐行输入后回车)
        clearExprRows();
        var i, arr = Object.prototype.toString.call(list) === '[object Array]' ? list : [];
        for (i = 0; i < arr.length; i++) addExprRow(String(arr[i]), null);
        applyExprs();
        return engine && engine.ueList ? engine.ueList() : [];
      },
      list: function () { return engine && engine.ueList ? engine.ueList() : []; },
      params: function () { return engine && engine.ueParams ? engine.ueParams() : []; },
      setParam: function (name, v) {
        var ok = engine && engine.ueSetParam ? engine.ueSetParam(name, Number(v)) : false;
        renderParams();
        return ok;
      },
      setTheta: function (a, b) { return engine && engine.ueSetTheta ? engine.ueSetTheta(a, b) : null; },
      theta: function () { return engine && engine.ueTheta ? engine.ueTheta() : null; },
      setCoordGrid: function (v) { return engine && engine.setPolarGrid ? engine.setPolarGrid(v) : false; },
      clear: function () { clearExprRows(); if (engine && engine.ueClear) engine.ueClear(); applyExprs(); },
      state: function () {
        return {
          count: exprCount(),
          rows: eui.rows.length,
          errTexts: (function () {
            var out = [], i;
            for (i = 0; i < eui.rows.length; i++) out.push(String(eui.rows[i].err.textContent || ''));
            return out;
          })(),
          params: (engine && engine.ueParams) ? engine.ueParams() : [],
          theta: (engine && engine.ueTheta) ? engine.ueTheta() : null,
          grid: !!(engine && engine.polarGrid && engine.polarGrid()),
          view: (engine && engine.getView) ? engine.getView() : null
        };
      }
    },
    // 视觉输入测试钩子:attachImage 接 dataURL,imgState 读当前待发图
    attachImage: function (dataUrl) { return ingestDataUrl(String(dataUrl || ''), 'test'); },
    clearImage: clearImage,
    imgState: function () {
      return imgCur ? { w: imgCur.w, h: imgCur.h, bytes: imgCur.bytes, model: VISION_MODEL } : null;
    }
  };

  // 记录最近问答(供 🎬 使用)
  var dsOrig = dsAsk;
  dsAsk = function (messages, key, opts) {
    // 拦截“讲解发送”,记录最近一问一答(不动协议调用)
    return dsOrig(messages, key, opts).then(function (content) {
      var lastRole = messages[messages.length - 1];
      if (lastRole && lastRole.role === 'user' && !opts) {
        lastUserText = String(lastRole.content || '');
        lastAiText = String(content || '');
      }
      return content;
    });
  };

  // 独立窗口(观澜 standalone)启动
  bootStandalone();
  // 用户表达式面板 + 参数滑块栏(引擎已在上面装载完毕)
  try { initExprUI(); } catch (e) { /* 面板失败不影响 AI 演示 */ }
})();
