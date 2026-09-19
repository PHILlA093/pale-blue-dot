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

  // 诊断信息落宿主日志(kind=note):演示的成败原先只在界面气泡里显示,
  // 排查时日志什么也看不到。只发文本、不等回执,失败也不影响主流程。
  function note(text) {
    if (!hasHost) return;
    try {
      window.chrome.webview.postMessage({ kind: 'note', text: String(text == null ? '' : text).slice(0, 240) });
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- DeepSeek 调用(宿主优先,fetch 兜底) ---------- */
  // 成功 resolve 为文本;失败 reject Error(错误信息 message 透出)。opts 可覆盖模型参数。
  function dsAsk(messages, key, opts) {
    opts = opts || {};
    var payload = {
      kind: 'ds', key: key,
      json: !!opts.json,      // 仅协议类请求开启 json_object(其提示词含 JSON 字样)
      model: opts.model || load(LS_MODEL) || 'deepseek-chat',
      messages: messages,
      max_tokens: opts.max_tokens || 2400,
      temperature: opts.temperature != null ? opts.temperature : 0.3
    };
    if (hasHost) {
      return hostReq(payload).then(function (r) {
        if (r && r._timeout) throw new Error('AI 请求超时(请稍后重试或检查网络)');
        if (!r || !r.ok) throw new Error((r && r.err) ? r.err : 'AI 请求失败');
        return r.content;
      });
    }
    // 网页版兜底直连(CORS 是否放行取决于 DeepSeek 服务端)。
    // 必须带超时:原先裸 fetch 在连接挂起时会永久 pending → 发送按钮永久禁用。
    var ctl = null, tid = null;
    try { ctl = new AbortController(); } catch (e) { ctl = null; }
    if (ctl) tid = setTimeout(function () { try { ctl.abort(); } catch (e) { } }, 60000);
    return fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: ctl ? ctl.signal : undefined,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: payload.model, messages: payload.messages,
        max_tokens: payload.max_tokens, temperature: payload.temperature
      })
    }).then(function (res) {
      if (tid) { clearTimeout(tid); tid = null; }
      // 不判 res.ok 时,5xx 的 HTML 会以 "Unexpected token <" 的面目出现
      if (!res.ok) throw new Error('网络直连失败(HTTP ' + res.status + '),建议在桌面版中使用');
      return res.json();
    }).then(function (j) {
      if (j && j.choices && j.choices[0] && j.choices[0].message) {
        return j.choices[0].message.content;
      }
      var err = j && j.error && j.error.message ? j.error.message : '网络直连失败(建议在桌面版中使用)';
      throw new Error(err);
    }).then(null, function (e) {
      if (tid) { clearTimeout(tid); tid = null; }
      throw e;
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
    // 未出图时禁用播放类按钮,🎬 动态演示始终可用
    var has = canvasCount() > 0;
    var ids = ['glPlayBtn', 'glPauseBtn', 'glStepBtn', 'glResetBtn', 'glClearCanvasBtn'];
    for (var i = 0; i < ids.length; i++) {
      var b = $(ids[i]);
      if (b) b.disabled = !has;
    }
    if (!canvasActive) {
      var st = $('glDemoState');
      if (st) st.textContent = has ? '画布:就绪' : '画布:空 · 点「🎬 动态演示」出图';
    }
  }
  function openPanel() {
    if (els.guanlan) els.guanlan.hidden = false;
    refreshCtx();
    ensureToolbar();
    try { if (els.glAsk) els.glAsk.focus(); } catch (e) { /* 忽略 */ }
    return 'ok';
  }
  function closePanel() {
    if (window.__guanlanStandalone) {
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
  // 侧栏「观澜」入口:直接打开无边框独立窗口(桌面版由宿主拦截;网页版开新标签页)
  on('guanlanOpen', function () {
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
  if (els.glStageTip) els.glStageTip.textContent = '输入题目后点「🎬 动态演示」:优先匹配内置模板(函数图像 / 向量 / 圆锥曲线 / 平面几何 / 立体几何 / 数列概率),匹配不到时由 AI 现场生成示意图';

  /* ============ 观澜画布:引擎装载 / 工具条 / AI→模板协议(2a) ============ */
  var engine = null;
  var canvasEl = $('glCanvas');
  var labelsEl = $('glLabels');
  if (canvasEl && window.GL) {
    engine = window.GL(canvasEl, labelsEl);
  }
  window.__guanlanGL = engine;

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
      'text{at:点,text,offset:{x,y},size} 以及带 tex:"$公式$" 的 MathJax 标注' +
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
    polyline: 1, polygon: 1, arrow: 1, curve: 1, text: 1
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
  function validateScene(raw) {
    if (!isPlainObj(raw)) return { ok: false, err: 'AI 未给出 scene 对象' };
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

  // 应用 AI 现场生成的场景:校验 → 绘制 → 检查有效图元比例(不合格则清空并报错)
  function applyScene(scene) {
    if (!engine) return { ok: false, err: '画布引擎未就绪' };
    var v = validateScene(scene);
    if (!v.ok) return { ok: false, err: v.err };
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
    return { ok: true, objects: total, okObjects: okN, idFixed: v.idFixed || 0 };
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
            + ' idFixed=' + (rs.idFixed || 0));
          setDemoState('画布:AI 现场生成 · 播放中…');
          addBubble('ai', '🎬 已按题意现场生成动态演示(' + rs.okObjects + ' 个图元)'
            + (rs.idFixed ? '(已自动修正 ' + rs.idFixed + ' 个不规范 id)' : '')
            + ((obj.caption && String(obj.caption).trim()) ? '\n' + String(obj.caption).trim() : '')
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
    if (engine) engine.clear();
    canvasActive = false;
    ensureToolbar();
    setDemoState('画布:空 · 点「🎬 动态演示」出图');
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
})();
