/* ============================================================
 * mobile.js — 穷观手机版 · 窄屏交互增强
 * ------------------------------------------------------------
 * 只做"窄屏(≤768px)才需要"的几件事,宽屏一律直接 return:
 *   1) 左侧全屏抽屉的遮罩层(点它关闭;抽屉自身是 100% 宽,屏幕上
 *      没有别的"外面",所以遮罩做成顶栏高度的一条,既是关闭落点也是提示);
 *   2) 在抽屉上向右滑动关闭;
 *   3) 详情面板的底部抽屉形态:把 #detailPanel.open 同步成 <html>.sheet-open
 *      (CSS 靠它把右下角「破卷」按钮抬到抽屉上沿之上);
 *   4) 底部抽屉的上下拖拽:向上拖放大到 70dvh、向下拖缩小到 55dvh、
 *      继续向下拖过阈值即关闭(关闭走 #detailClose 的 click,复用 app.js 的
 *      deselectNode(),不重复实现选中/取消逻辑)。
 * 这里全部只操作 DOM 与类名,不触碰 app.js 的闭包,也不改变宽屏行为。
 * ============================================================ */
(function () {
  'use strict';

  var MQ = '(max-width: 768px)';
  function isNarrow() {
    try { return !!(window.matchMedia && window.matchMedia(MQ).matches); }
    catch (e) { return false; }
  }
  // 视口旋转 / 桌面调试时缩放窗口都可能跨越断点,必须每次重新判断
  if (!isNarrow()) {
    // 宽屏:什么也不做(但仍然挂一个监听,便于开发时把窗口缩小后立即生效)
  }

  function $(id) { return document.getElementById(id); }

  /* ================= 1) 抽屉遮罩 ================= */
  function buildMask() {
    if ($('drawerMask')) return $('drawerMask');
    var m = document.createElement('div');
    m.id = 'drawerMask';
    document.body.appendChild(m);
    m.addEventListener('click', function () {
      if (window.__qgDrawer) window.__qgDrawer.close();
    });
    return m;
  }
  buildMask();

  /* ================= 2) 抽屉右滑关闭 ================= */
  (function swipeDrawer() {
    var panel = $('leftPanel');
    if (!panel) return;
    var sx = 0, sy = 0, tracking = false;
    panel.addEventListener('touchstart', function (e) {
      if (!isNarrow() || !e.touches || e.touches.length !== 1) { tracking = false; return; }
      // 抽屉里有横向滚动/滑块时不要抢手势
      var t = e.target;
      if (t && t.closest && t.closest('input[type="range"], input[type="color"], canvas')) { tracking = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    panel.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (dx > 60 && Math.abs(dy) < 60 && window.__qgDrawer) window.__qgDrawer.close();
    }, { passive: true });
  })();

  /* ================= 3) 底部抽屉状态同步 ================= */
  var panel = $('detailPanel');
  function syncSheetClass() {
    try {
      var open = !!(panel && panel.classList.contains('open') && isNarrow());
      document.documentElement.classList.toggle('sheet-open', open);
    } catch (e) { /* 忽略 */ }
  }
  if (panel) {
    // 用 MutationObserver 而不是去改 app.js 的 selectNode/deselectNode:
    // 选中路径有好几条(画布点选 / 搜索结果 / 详情内跳转 / 参数直达),
    // 观察 class 是唯一不会漏的接法,且开销可忽略。
    try {
      var mo = new MutationObserver(syncSheetClass);
      mo.observe(panel, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {
      // 极老浏览器没有 MutationObserver:退化为定时轮询(200ms,足够跟手)
      setInterval(syncSheetClass, 200);
    }
    syncSheetClass();
  }

  /* ================= 4) 底部抽屉拖拽 ================= */
  (function sheetDrag() {
    if (!panel) return;
    var head = panel.querySelector('.detail-head');
    if (!head) return;

    var HEIGHTS = ['55dvh', '62dvh', '70dvh'];
    var level = 1;                 // 当前档位:0=55dvh 1=62dvh 2=70dvh
    var drag = null;

    function panelH() { try { return panel.getBoundingClientRect().height || 1; } catch (e) { return 1; } }
    function setLevel(i) {
      if (i < 0) i = 0;
      if (i > HEIGHTS.length - 1) i = HEIGHTS.length - 1;
      level = i;
      try { document.documentElement.style.setProperty('--sheet-h', HEIGHTS[level]); } catch (e) { /* 忽略 */ }
    }
    // 从实际高度反推档位,避免与 CSS 默认值(62dvh)不同步
    function currentLevel() {
      var h = panelH(), vh = window.innerHeight || 1;
      var r = h / vh;
      if (r < 0.585) return 0;
      if (r > 0.655) return 2;
      return 1;
    }

    head.addEventListener('pointerdown', function (e) {
      if (!isNarrow()) return;
      if (!panel.classList.contains('open')) return;
      // 关闭按钮等交互控件不参与拖拽
      if (e.target && e.target.closest && e.target.closest('button, a, input, select')) return;
      drag = { y: e.clientY, dy: 0, id: e.pointerId };
      level = currentLevel();
      panel.classList.add('sheet-drag');
      try { if (head.setPointerCapture) head.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    });

    head.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dy = e.clientY - drag.y;
      drag.dy = dy;
      // 向上拖只给 1/3 的跟手位移(上限 -48px),避免把抽屉整个拽离屏幕
      var shown = dy < 0 ? Math.max(dy / 3, -48) : dy;
      panel.style.transform = 'translateY(' + shown + 'px)';
      e.preventDefault();
    });

    function endDrag() {
      if (!drag) return;
      var dy = drag.dy;
      drag = null;
      panel.classList.remove('sheet-drag');
      panel.style.transform = '';
      if (dy > Math.max(90, panelH() * 0.25)) {
        // 下拉过阈值 → 关闭(复用 app.js 的关闭路径)
        var btn = $('detailClose');
        if (btn) btn.click(); else panel.classList.remove('open');
        try { document.documentElement.style.setProperty('--sheet-h', HEIGHTS[1]); } catch (e) { /* 忽略 */ }
        level = 1;
        return;
      }
      if (dy < -40) { setLevel(level + 1); return; }    // 上拖 → 放大
      if (dy > 40) { setLevel(level - 1); return; }     // 下拖 → 缩小
      /* 否则吸附回原位(transform 已清空,由 CSS 过渡回 translateY(0)) */
    }
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', function () {
      if (!drag) return;
      drag = null;
      panel.classList.remove('sheet-drag');
      panel.style.transform = '';
    });

    // 关闭后把高度复位到默认档,下次打开是标准高度
    if (panel) {
      try {
        new MutationObserver(function () {
          if (!panel.classList.contains('open')) {
            setLevel(1);
          }
        }).observe(panel, { attributes: true, attributeFilter: ['class'] });
      } catch (e) { /* 忽略 */ }
    }
  })();

  /* ================= 5) 断点变化时清理状态 ================= */
  (function watchBreakpoint() {
    function fix() {
      if (isNarrow()) { syncSheetClass(); return; }
      // 回到宽屏:清掉手机专属的中间状态,避免影响桌面样式
      try {
        document.documentElement.classList.remove('drawer-open');
        document.documentElement.classList.remove('sheet-open');
        document.documentElement.style.removeProperty('--sheet-h');
        if (panel) panel.style.transform = '';
      } catch (e) { /* 忽略 */ }
    }
    try {
      var mq = window.matchMedia(MQ);
      if (mq.addEventListener) mq.addEventListener('change', fix);
      else if (mq.addListener) mq.addListener(fix);
    } catch (e) { /* 忽略 */ }
    window.addEventListener('resize', fix);
    window.addEventListener('orientationchange', function () { setTimeout(fix, 250); });
  })();

  /* ================= 6) 窄屏默认形态(桌面形态搬到手机后失效的三处) =================
   * 6a) 桌面版侧栏只有约 300px 宽,五个分区全折叠时看着还正常;手机版抽屉是
   *     100% 宽的整屏,五个折叠标题合计只占约 320px(实测内容底边 y=421 / 视口
   *     844),下半屏是一大片纯空白 —— 用户打开抽屉看到的是"一个空面板"。
   *     窄屏首次进入时把主功能区「板块筛选」默认展开(其余分区保持可折叠)。
   * 6b)「本机资料库」靠桌面宿主(window.chrome.webview)读取本机语料文件夹并上传,
   *     手机版里没有宿主,README 已注明该功能手机上不可用;窄屏且无宿主时隐藏。
   * 6c) 最小化/最大化/关闭是桌面宿主窗口的按钮。竖屏已由 css/style.css 的
   *     @media (max-width:768px) 隐藏;手机横屏(844×390)宽度超过 768px 会退回
   *     桌面布局,这组按钮重新出现并把顶栏撑出屏幕(实测 #winCtrl 右边界 871 >
   *     视口 844,✕ 被裁掉点不到)。这里按"矮视口"再兜一层,只隐藏这组按钮,
   *     不动其余桌面布局。
   */
  (function narrowDefaults() {
    var docEl = document.documentElement;
    if (!document.getElementById('qgNarrowCSS')) {
      var st = document.createElement('style');
      st.id = 'qgNarrowCSS';
      st.textContent =
        '@media (max-width:768px){html.qg-nohost #dbSec{display:none}}' +
        '@media (max-width:1024px) and (max-height:520px){.winctrl{display:none !important}}';
      (document.head || docEl).appendChild(st);
    }
    var hostOk = !!(window.chrome && window.chrome.webview && window.chrome.webview.postMessage);
    try { docEl.classList.toggle('qg-nohost', !hostOk); } catch (e) { /* 忽略 */ }

    // 只做一次:之后用户在抽屉里的展开/折叠完全按他自己的操作来
    try {
      if (isNarrow() && !docEl.classList.contains('qg-sec-expanded-default')) {
        docEl.classList.add('qg-sec-expanded-default');
        var first = document.querySelector('#leftPanel .side-sec');
        if (first && first.classList.contains('collapsed')) first.classList.remove('collapsed');
      }
    } catch (e) { /* 忽略 */ }
  })();

  // 调试/验收口
  window.__qgMobile = {
    narrow: isNarrow,
    syncSheetClass: syncSheetClass,
    mask: function () { return $('drawerMask'); },
    hostOk: function () {
      return !!(window.chrome && window.chrome.webview && window.chrome.webview.postMessage);
    }
  };
})();
