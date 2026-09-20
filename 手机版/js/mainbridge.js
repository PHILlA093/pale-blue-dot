/* ============================================================
 * mainbridge.js — 主系统 ⇄ 破卷 桥(穷观 V2.4.2)
 * 职责(全部通过 DOM / localStorage / 公开全局完成,不侵入 app.js 闭包):
 *  1) 心跳发布主系统状态:{科目, 当前选中知识点名, 搜索词}
 *  2) 执行训练窗的「定位」指令:模拟一次搜索并点选首个结果
 *     (即主系统把该知识点选中并弹出详情卡)
 * 注意:本文件只在主窗(index.html)加载;训练窗另有 train.js。
 * ============================================================ */
(function () {
  var LS_STATE = 'qg_live_state';
  var LS_CMD = 'qg_live_cmd';
  var doneSeq = 0;
  var bootAt = Date.now();      // 只执行本页加载之后发出的指令(防陈旧指令重放)

  function snap() {
    var dp = document.getElementById('detailPanel');
    var dName = document.getElementById('dName');
    var si = document.getElementById('searchInput');
    var open = !!(dp && dName && dp.classList.contains('open') && dName.textContent.trim());
    return {
      t: Date.now(),
      subject: window.CUR_SUBJECT || 'math',
      subjectName: (function () {
        var lb = document.getElementById('subjectLabel');
        return lb ? lb.textContent : '';
      })(),
      selName: open ? dName.textContent.trim() : '',
      keyword: si ? (si.value || '').trim() : '',
      title: document.title
    };
  }

  // 状态心跳(700ms;训练窗轮询读取)
  var lastJson = '';
  function publish() {
    try {
      var s = snap();
      // 比较时必须剔除时间戳 t:snap() 每次都带新的 t,直接比 JSON.stringify(s)
      // 会让 j !== lastJson 永远成立,变更检测形同虚设(退化成每 700ms 无条件写一次)。
      var j = JSON.stringify({
        subject: s.subject, subjectName: s.subjectName,
        selName: s.selName, keyword: s.keyword, title: s.title
      });
      if (j !== lastJson) {
        lastJson = j;
        localStorage.setItem(LS_STATE, JSON.stringify(s));
      }
    } catch (e) { /* 忽略 */ }
  }

  // 指令轮询:只支持 type=locate(在主系统搜索并选中第一个结果)。
  // 原 setkey 分支已删除 —— qg_live_cmd 是普通同源 localStorage,
  // 保留"写 API Key"的能力等于把用户的 Key 交给任意注入脚本。
  function pollCmd() {
    var raw = null;
    try { raw = localStorage.getItem(LS_CMD); } catch (e) { return; }
    if (!raw) return;
    var c = null;
    try { c = JSON.parse(raw); } catch (e) { return; }
    if (!c || !c.seq || c.seq <= doneSeq) return;
    if (!c.t || c.t < bootAt - 500) { doneSeq = c.seq; return; }   // 陈旧指令:只标记不执行
    doneSeq = c.seq;
    // 执行后立刻清除,避免陈旧指令重放(原先只靠 2 秒时间戳窗口挡)
    try { localStorage.removeItem(LS_CMD); } catch (e) { /* 忽略 */ }
    if (c.type === 'locate' && c.kw) executeLocate(c.kw);
  }

  // app.js 搜索防抖 250ms,但数据量大时"防抖 + 渲染"可能远超一次 480ms 定时,
  // 原先赌一次就会静默失败(破卷窗却显示"已同步定位")。这里改成轮询多次,
  // 并把结果写进 qg_live_ack 供破卷窗读取真实结果。
  function executeLocate(kw) {
    var input = document.getElementById('searchInput');
    if (!input) return false;
    input.value = kw;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    function ack(ok) {
      try { localStorage.setItem('qg_live_ack', JSON.stringify({ kw: kw, ok: ok, t: Date.now() })); } catch (e) { }
    }
    var tries = [300, 500, 900, 1500];
    (function poke(i) {
      if (i >= tries.length) { ack(false); return; }
      setTimeout(function () {
        var li = document.querySelector('#searchResults li[data-id]');
        if (li) { li.click(); ack(true); return; }
        poke(i + 1);
      }, tries[i]);
    })(0);
    return true;
  }

  // 打开破卷。手机版(浏览器 / Capacitor APK)里必须走「同一个 WebView 内跳转」:
  // Capacitor 的原生壳里没有"第二个窗口",window.open 通常会失效或把页面甩到系统浏览器,
  // 破卷页里点「← 返回知识云」就回不来了。破卷页自带返回按钮,故这里直接改地址。
  function openTrain(url) {
    try { location.href = url; }
    catch (e) { qgNotice('无法打开破卷:' + e); }
  }

  // 「🎯 破卷」按钮:同 WebView 内跳转到破卷页
  function bindTrainBtn() {
    var btn = document.getElementById('trainBtn');
    if (!btn || btn.__qgBound) return;
    btn.__qgBound = true;
    btn.addEventListener('click', function () { openTrain('train.html'); });
  }

  // 顶栏「⟳」:重新加载当前科目(保留科目、跳过开场,直接回到知识云)
  function bindReloadBtn() {
    var btn = document.getElementById('reloadBtn');
    if (!btn || btn.__qgBound) return;
    btn.__qgBound = true;
    btn.addEventListener('click', function () {
      try {
        var m = {};
        location.search.replace(/[?&]([^=]+)=([^&]*)/g, function (_, k, v) { m[k] = decodeURIComponent(v); });
        var url = location.pathname + '?skip=1';
        if (m.subject) url += '&subject=' + encodeURIComponent(m.subject);
        location.href = url;
      } catch (e) {
        location.reload();
      }
    });
  }

  /* ---------- 无边框主窗:自绘控件 + 顶栏拖动(宿主移动窗口) ---------- */
  (function winFrame() {
    var hostOk = !!(typeof window.chrome !== 'undefined' && window.chrome.webview &&
      window.chrome.webview.postMessage);
    function wnd(op, dx, dy) {
      if (!hostOk) return;
      var m = { kind: 'wnd', op: op };
      if (op === 'move') { m.dx = dx || 0; m.dy = dy || 0; }
      try { window.chrome.webview.postMessage(m); } catch (e) { /* 忽略 */ }
    }
    function bind(id, op) {
      var b = document.getElementById(id);
      if (b) b.addEventListener('click', function () { wnd(op); });
    }
    bind('winMin', 'min');
    bind('winMax', 'max');
    bind('winClose', 'close');
    // 顶栏空白处拖动窗口;按钮/输入等交互区不触发
    var topbar = document.getElementById('topbar');
    if (!topbar || !hostOk) return;
    var drag = null;
    var IGN = 'button, input, select, a, textarea';
    topbar.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest(IGN)) return;
      // 用屏幕坐标算增量:窗口随手指移动时 clientX 会自变导致抖动
      drag = { sx: e.screenX, sy: e.screenY };
      try { if (topbar.setPointerCapture) topbar.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      try { if (e.preventDefault) e.preventDefault(); } catch (err) { /* 忽略 */ }
    });
    topbar.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.screenX - drag.sx;
      var dy = e.screenY - drag.sy;
      drag.sx = e.screenX; drag.sy = e.screenY;
      wnd('move', dx, dy);
    });
    function endDrag() { drag = null; }
    topbar.addEventListener('pointerup', endDrag);
    topbar.addEventListener('pointercancel', endDrag);
    topbar.addEventListener('dblclick', function (e) {
      if (e.target && e.target.closest && e.target.closest(IGN)) return;
      wnd('max');
    });
    // 最大化时页面圆角置直角(与宿主 Region 行为一致)
    function syncMaxed() {
      try {
        var m = Math.abs(window.innerWidth - screen.availWidth) < 4 &&
          Math.abs(window.innerHeight - screen.availHeight) < 4;
        var de = document.documentElement;
        if (de) de.classList.toggle('maxed', m);
      } catch (e) { /* 忽略 */ }
    }
    window.addEventListener('resize', syncMaxed);
    setInterval(syncMaxed, 1000);
    syncMaxed();
    // 顶层灰色描边覆盖层(圆角贴合窗口弧线)
    try {
      if (!document.querySelector('.winedge')) {
        var edge = document.createElement('div');
        edge.className = 'winedge';
        (document.body || document.documentElement).appendChild(edge);
      }
    } catch (e) { /* 忽略 */ }
  })();

  setInterval(publish, 700);
  setInterval(pollCmd, 400);
  publish();
  bindTrainBtn();
  bindReloadBtn();

  // 页面(含切科目重载后)就绪后立刻推一次状态
  window.addEventListener('load', function () { setTimeout(publish, 500); bindTrainBtn(); bindReloadBtn(); });

  /* ---------- 侧栏「本机资料库」:当前科目知识云自动上传 ----------
   * 桌面版(exe)宿主把当前科目数据注册进 数据库\qg_subjects.txt,
   * 破卷检索资料时自动合并本机科目块;网页版无宿主,仅提示。
   */
  (function dbAuto() {
    var hostOk = !!(typeof window.chrome !== 'undefined' && window.chrome.webview &&
      window.chrome.webview.postMessage);
    var rowsEl = null, stateEl = null;
    function el() {
      if (!rowsEl) {
        rowsEl = document.getElementById('dbRows');
        stateEl = document.getElementById('dbState');
      }
      return !!(rowsEl && stateEl);
    }
    function esc(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function dbList() {
      var out = [];
      for (var k in window) {
        try {
          var v = window[k];
          if (v && v.subject && v.subjectName && v.boards && v.points &&
            Object.prototype.toString.call(v.points) === '[object Array]' &&
            Object.prototype.toString.call(v.boards) === '[object Array]') out.push(v);
        } catch (e) { /* 忽略 */ }
      }
      return out;
    }
    function curDb() {
      var labelEl = document.getElementById('subjectLabel');
      var label = labelEl ? (labelEl.textContent || '') : '';
      var sub = window.CUR_SUBJECT || '';
      var all = dbList();
      for (var i = 0; i < all.length; i++) if (all[i].subject === sub) return all[i];
      for (var j = 0; j < all.length; j++) {
        if (label && all[j].subjectName && all[j].subjectName.indexOf(label) >= 0) return all[j];
      }
      return all.length ? all[0] : null;
    }
    // 发号统一走 window 上的共享计数器:主窗里 mainbridge 与 demo.js(观澜面板)
    // 共用同一个 WebView 通道,各自独立计数会撞号,把响应派给错误的回调。
    var pend = {};
    function nextSeq() {
      window.__qgSeq = (window.__qgSeq || 0) + 1;
      return window.__qgSeq;
    }
    function ask(obj) {
      return new Promise(function (res) {
        if (!hostOk) { res({ _nohost: true }); return; }
        var s = nextSeq();
        obj._seq = s;
        pend[s] = res;
        window.chrome.webview.postMessage(obj);
        setTimeout(function () { if (pend[s]) { delete pend[s]; res({ _timeout: true }); } }, 60000);
      });
    }
    // 指纹必须覆盖"实际会上传的全部字段":原先只取 id/name/board/importance/关键词**个数**,
    // 于是改正文、或把关键词换成等长词,指纹都不变 → 永远不重传,资料库停在旧内容。
    function digest(db) {
      var h = 7;
      db.points.forEach(function (p) {
        var s = (p.id || '') + '|' + (p.name || '') + '|' + (p.board || '') + '|' +
          (p.importance || 0) + '|' + ((p.keywords || []).join('、')) + '|' +
          String(p.content || '').slice(0, 2500);
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      });
      h = (h * 31 + (db.points.length || 0)) >>> 0;
      return h.toString(36);
    }
    function setState(msg, cls) {
      if (!el()) return;
      stateEl.className = 'db-' + cls;
      stateEl.textContent = msg;
    }
    /* 无宿主(手机浏览器 / Capacitor APK)时「本机资料库」这条路走不通:
     * 它的数据是电脑上 数据库\qg_subjects.txt 里的科目块,只能由桌面宿主读写。
     * 原来只说"网页浏览模式",用户会反复点;这里明确说明不可用及原因。
     * 注意:AI 请求不在这里 —— 破卷/观澜的 AI 调用统一走 js/ainet.js
     * (无宿主时自动改走 /api/ds 本地代理 或 Capacitor 原生直连)。 */
    var NOHOST_MSG = '手机版不支持「本机资料库」:它依赖桌面宿主的电脑本地数据库,' +
      '请在电脑上的桌面版里维护。手机版的知识云 / 搜索 / 破卷 / 观澜均不受影响。';
    function renderStat(r) {
      if (!el()) return;
      var html = '<div class="db-row"><span class="k">📚 内置四份资料</span>' +
        '<span class="v">' + (r && r.baseBlocks ? r.baseBlocks.toLocaleString() : '—') + ' 块</span></div>';
      var subs = (r && r.subjects) ? r.subjects : [];
      for (var i = 0; i < subs.length; i++) {
        var s = subs[i];
        html += '<div class="db-row"><span class="k">☁️ ' + esc(s.name || s.key) + '(' + esc(s.key) + ')</span>' +
          '<span class="v">' + (s.points || 0) + ' 点</span></div>';
      }
      rowsEl.innerHTML = html;
    }
    var uploading = false;
    function doUpload(force) {
      // 防重入:15s 轮询与 load 触发可能同时进来,原先会并发发两个大 payload
      // (指纹只在成功后落盘,所以飞行中的第二次不会被 prev === d 挡住)
      if (uploading) return;
      var db = curDb();
      if (!db || !el()) return;
      if (!hostOk) { setState(NOHOST_MSG, 'bad'); return; }
      var key = db.subject || 'db';
      var d = digest(db);
      var prev = '';
      try { prev = localStorage.getItem('qg_db_digest_' + key) || ''; } catch (e) { }
      if (prev === d && !force) return;
      uploading = true;
      setState('正在自动上传当前科目知识云数据(' + db.points.length + ' 点)…', 'busy');
      ask({
        kind: 'dbAdd', subjectKey: key, subjectName: db.subjectName || '',
        hash: d,
        points: db.points.map(function (p) {
          return {
            id: p.id || '',
            name: p.name, board: p.board || '',
            keywords: (p.keywords || []).join('、'),
            content: String(p.content || '').slice(0, 2500)
          };
        })
      }).then(function (r) {
        uploading = false;
        if (!r || r._timeout) { setState('上传超时,将自动重试。', 'bad'); return; }
        if (r.ok) {
          try { localStorage.setItem('qg_db_digest_' + key, d); } catch (e) { }
          setState((r.updated ? '已自动上传' : '已是最新') + ':' + db.subjectName + ' ' +
            (r.points || db.points.length) + ' 个知识点已纳入本机资料库。', 'good');
        } else {
          setState('上传失败:' + (r.err || '未知错误'), 'bad');
        }
      });
    }
    function stat() {
      if (!el()) return;
      if (!hostOk) { setState(NOHOST_MSG, 'bad'); return; }
      ask({ kind: 'dbStat' }).then(function (r) {
        if (r && !r._timeout && r.ok) {
          renderStat(r);
          var db = curDb();
          var key = db ? (db.subject || '') : '';
          var prev = '';
          try { prev = key ? (localStorage.getItem('qg_db_digest_' + key) || '') : 'x'; } catch (e) { }
          if (!prev) doUpload(false);
        } else if (r && r._timeout) {
          setState('连接本机资料库超时。', 'bad');
        }
      });
    }
    window.addEventListener('load', function () {
      setTimeout(stat, 700);
      setTimeout(function () { doUpload(false); }, 1000);
    });
    // 自动检查:自定义点/数据变化时(最长 15s 内)自动重传
    setInterval(function () {
      if (!el() || !hostOk) return;
      var db = curDb();
      if (!db) return;
      var key = db.subject || 'db';
      var prev = '';
      try { prev = localStorage.getItem('qg_db_digest_' + key) || ''; } catch (e) { }
      if (prev !== digest(db)) doUpload(false);
    }, 15000);
    window.__dbAuto = {
      hostOk: hostOk, stat: stat, doUpload: doUpload,
      cur: function () { var db = curDb(); return db ? { subject: db.subject, subjectName: db.subjectName, n: db.points.length } : null; }
    };
  })();

  // 自动化测试通道(与桌面版 --qa=… 配合;普通使用无这些参数,不受影响):
  //   ask=… → 主系统定位该知识点;wipe=1 → 清除 API;open=1 → 自动打开训练窗;
  //   gopen=1 → 自动打开观澜无边框独立窗(测试/验收用)。
  // 注意:通道不再接受 key=…,任何自动化流程都不能写入/覆盖用户保存的 API Key。
  (function qaAuto() {
    var m = {};
    location.search.replace(/[?&]([^=]+)=([^&]*)/g, function (_, k, v) { m[k] = decodeURIComponent(v); });
    if (!m.ask && !m.open && !m.wipe && !m.gopen) return;
    if (m.ask) {
      setTimeout(function () { executeLocate(m.ask); }, 900);
    }
    if (m.gopen === '1') {
      setTimeout(function () {
        try { if (!window.open('guanlan.html', 'qg_guanlan')) qgNotice('浏览器拦截了新窗口,请允许本站弹出窗口后重试'); } catch (e) { qgNotice('无法打开观澜窗口:' + e); }
      }, 1800);
    }
    if (m.open) {
      setTimeout(function () {
        var u = 'train.html?auto=1';
        if (m.wipe === '1') u = 'train.html?wipe=1';
        else if (m.ask) u += '&ask=' + encodeURIComponent(m.ask);
        openTrain(u);   // 与「🎯 破卷」按钮同一条路:同 WebView 内跳转
      }, 1800);
    }
  })();

  // 供调试
  window.__qgBridge = {
    snap: snap,
    publish: publish,
    executeLocate: executeLocate,
    origin: 'QG-20260920-5e5d5a-D'
  };
})();

/* 非阻塞提示条:替代 qgNotice(alert 会冻结页面,对无头测试与真实用户都不友好) */
function qgNotice(msg) {
    try {
        var d = document.createElement("div");
        d.textContent = msg;
        d.style.cssText = "position:fixed;left:50%;bottom:72px;transform:translateX(-50%);" +
            "background:rgba(229,57,53,.95);color:#fff;padding:10px 16px;border-radius:8px;" +
            "font-size:13px;line-height:1.5;z-index:100000;box-shadow:0 6px 20px rgba(0,0,0,.45);max-width:80vw";
        document.body.appendChild(d);
        setTimeout(function () { try { d.remove(); } catch (e) { } }, 5000);
    } catch (e) { }
}
