/* ============================================================
 * qlabm.js — 穷观手机版 · 三个实验台的窄屏(≤768px)布局层
 * ------------------------------------------------------------
 * 背景:桌面版的三个实验台(物理沙盒 js/psandbox.js、物理实验台 js/pslab.js、
 * 化学实验台 js/clab.js)都是**自包含 ES5 模块**,三栏布局(左列表 / 中画布 /
 * 右数据参数)。它们被**原样**复制进手机版源码树(逐字节相同),因此手机侧的
 * 窄屏改造**不写在模块里**,而是全部集中在本文件:
 *
 *   1) 注入一份只作用于这三个模块自己类名的窄屏样式(#qgLabMCSS),
 *      整份规则都包在 @media (max-width:768px) 里 —— 宽屏下等于不存在,
 *      模块自带的桌面三栏布局原样保留。
 *   2) 物理/化学实验台在窄屏下把三栏折成"上=画布(占主要高度) /
 *      下=可切换的列表 与 参数·数据面板":插入一个 .qm-tabs 标签栏,
 *      用 .qm-tab-list / .qm-tab-data 两个类切换显示哪一栏。
 *   3) 观澜整屏面板在实验台打开时打上 #guanlan.qg-lab-on:
 *      隐藏对话区、把 #glStage 撑满、并把观澜自己的画布/工具条/表达式栏
 *      藏起来(观澜原生画布仍旧在 DOM 里,退出后原样回来)。
 *
 * 硬约束(与桌面版同一条红线):
 *   · 本文件**加载时不建任何 DOM、不注入任何 CSS、不起任何循环**。
 *     只有 attach() 被显式调用时才干活(由 js/demo.js 在"确认科目正确 +
 *     已点开入口 + 模块已 mount"之后调用),detach() 把一切退干净。
 *   · 非物理/化学科目下不会走到这里 —— 入口按钮本身就不存在(见 demo.js)。
 *
 * 与模块的关系:只做"外层容器与样式",绝不碰模块内部的状态/接口;
 * 唯一"接管"的是实验列表项的点击(捕获阶段监听),用来在选定实验后
 * 自动把下方标签页切到「参数 · 数据」。
 * ============================================================ */
(function () {
  'use strict';

  var CSS_ID = 'qgLabMCSS';
  var MQ = '(max-width: 768px)';
  var TAB_H = 48;              // 标签栏高度(px),仅用于日志/断言

  function $(id) { return document.getElementById(id); }
  function isNarrow() {
    try { return !!(window.matchMedia && window.matchMedia(MQ).matches); }
    catch (e) { return false; }
  }
  function cel(tag, cls, txt) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt !== undefined && txt !== null) d.textContent = String(txt);
    return d;
  }

  /* ------------------------------------------------------------------ *
   * 1) 窄屏样式(只作用于 ps- / pl- / cl- 与 .qm-* 自己的类名)          *
   * ------------------------------------------------------------------ */
  function cssText() {
    return [
      /* ---------- 实验台公共骨架:画布在上、下方标签页 ---------- */
      '@media (max-width:768px){',

      /* 观澜面板:实验台打开时对话区让位,整屏交给实验台 */
      '#guanlan.qg-lab-on .gl-chat{display:none}',
      '#guanlan.qg-lab-on .gl-stage{flex:1 1 auto;min-height:0}',
      '#guanlan.qg-lab-on #glClearText{display:none}',
      '#guanlan.qg-lab-on .gl-sub{display:none}',
      /* 观澜原生画布/工具条/表达式栏/参数栏/提示:实验台盖住它们,直接不可见 */
      '#guanlan.qg-lab-on .gl-stage > #glCanvas,',
      '#guanlan.qg-lab-on .gl-stage > #glLabels,',
      '#guanlan.qg-lab-on .gl-stage > #glExprBox,',
      '#guanlan.qg-lab-on .gl-stage > #glParamBar,',
      '#guanlan.qg-lab-on .gl-stage > #glToolbar,',
      '#guanlan.qg-lab-on .gl-stage > #glStageTip{visibility:hidden}',

      /* 顶栏:窄屏压紧,字号提到可读 */
      '#plRoot .pl-top,#clRoot .cl-top{padding:5px 8px;gap:7px}',
      '#plRoot .pl-title,#clRoot .cl-title{font-size:13px}',
      '#plRoot .pl-sub,#clRoot .cl-sub{font-size:12px}',
      '#plRoot .pl-stat,#clRoot .cl-stat{font-size:11px}',

      /* 主体:纵向排列,画布优先吃掉剩余高度 */
      '#plRoot .pl-body,#clRoot .cl-body{flex-direction:column;overflow:hidden}',
      '#plRoot .pl-mid,#clRoot .cl-mid{order:1;flex:1 1 auto;width:auto;height:auto;min-height:132px}',
      '#plRoot .pl-stagewrap,#clRoot .cl-stagewrap{min-height:132px}',

      /* 标签栏(本文件插入) */
      '.qm-tabs{order:2;flex:none;display:flex;gap:6px;padding:5px 6px;',
      'background:rgba(8,12,24,.96);border-top:1px solid rgba(120,160,220,.22)}',
      '.qm-tab{flex:1 1 0;min-height:' + TAB_H + 'px;padding:0 6px;border:1px solid rgba(120,160,220,.22);',
      'border-radius:9px;background:transparent;color:#8fa3c0;font-family:inherit;font-size:13.5px;',
      'cursor:pointer;line-height:1.2}',
      '.qm-tab.qm-on{color:#070b14;background:#f4f1ea;border-color:#f4f1ea;font-style:italic}',
      '.qm-tab:active{transform:scale(.97)}',

      /* 下方两栏:同一个位置,二选一显示;整块可滚(不再让整页滚) */
      '#plRoot .pl-left,#clRoot .cl-left{order:3;flex:0 0 auto;width:auto;max-height:none;height:38vh;',
      'overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
      'border-right:0;border-bottom:0;border-top:1px solid rgba(120,160,220,.18)}',
      '#plRoot .pl-right,#clRoot .cl-right{order:3;flex:0 0 auto;width:auto;height:38vh;overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;overscroll-behavior:contain;border-left:0;',
      'border-top:1px solid rgba(120,160,220,.18)}',
      '.pl-body.qm-tab-data .pl-left{display:none}',
      '.pl-body.qm-tab-list .pl-right{display:none}',
      '.cl-body.qm-tab-data .cl-left{display:none}',
      '.cl-body.qm-tab-list .cl-right{display:none}',
      /* 实验列表在窄屏下不再被 30vh 压扁(它占了整个下方面板) */
      '#plRoot .pl-left .pl-list,#clRoot .cl-left .cl-list{padding-bottom:8px}',

      /* ---------- 触控热区:一律 ≥40×40 ---------- */
      '#plRoot .pl-item,#clRoot .cl-item{min-height:44px;padding:11px 12px;font-size:14px;margin:4px 0}',
      '#plRoot .pl-grp,#clRoot .cl-grp{font-size:12.5px;padding:12px 4px 5px}',
      '#plRoot .pl-sech,#clRoot .cl-sech{min-height:42px;padding:11px 10px;font-size:13px}',
      '#plRoot .pl-secb,#clRoot .cl-secb{font-size:12.5px}',
      '#plRoot .pl-bar,#clRoot .cl-bar{flex-wrap:wrap;gap:6px;padding:5px 6px}',
      '#plRoot .pl-bar button,#clRoot .cl-bar button{min-height:40px;padding:0 12px;font-size:13.5px}',
      '#plRoot .pl-hint,#clRoot .cl-hint{display:none}',
      '#plRoot .pl-del,#clRoot .pl-del{width:40px;height:40px;font-size:15px}',
      '#plRoot .pl-thn{width:46px}',
      '#plRoot .pl-tablewrap,#clRoot .cl-tablewrap{max-height:none}',

      /* 参数控件:滑块/下拉/数字框都要"手指点得到" */
      '#plRoot .pl-params,#clRoot .cl-params{padding:8px 10px 14px}',
      '#plRoot .pl-prow,#clRoot .cl-prow{margin:11px 0 0}',
      '#plRoot .pl-plabel,#clRoot .cl-plabel{font-size:13px;align-items:baseline}',
      '#plRoot .pl-prange,#clRoot .cl-prange{height:40px;margin:2px 0 0}',
      '#plRoot .pl-psel,#clRoot .cl-psel{height:40px;font-size:14px;padding:0 8px}',
      '#clRoot .cl-pnum{height:40px;font-size:14px;padding:0 8px}',
      '#plRoot .pl-cardh,#clRoot .cl-cardh{font-size:12.5px;padding:8px 10px}',
      '#plRoot .pl-table,#clRoot .cl-table{font-size:12.5px}',
      '#plRoot .pl-th,#clRoot .cl-th{padding:6px 5px}',
      '#plRoot .pl-td,#clRoot .cl-td{padding:6px 5px}',
      '#plRoot .pl-cval,#clRoot .cl-cval{font-size:20px}',
      '#plRoot .pl-ctext,#clRoot .cl-ctext{font-size:12.5px}',

      /* ---------- 物理沙盒 ----------
         ① 字形面板:沙盒的面板是**固定 4×4 格**(psandbox.js 的 dockSlotEl 把第 i 个
            字形钉在 grid-row=⌊i/4⌋+1 / grid-column=i%4+1),模块自带的窄屏规则只把
            grid-template-columns 改成 repeat(8,1fr),那些钉死的格子并不会跟着重排
            ——实测它们的第 3、4 行落进隐式 auto 行(高 34px,摸不到),面板也长到 185px。
            手机版改成"4 列 × 4 行、每格 46px"的方形面板:与模块的钉格逻辑一致,
            触控热区 46×46。
         ② 位置:面板放**左下**、垃圾桶留在右下(模块自己把垃圾桶钉在右下,见下)。
         ③ ⚠ 垃圾桶的 right/bottom 是 psandbox.js 用**内联 style** 写的
            (resetTrashPos(): trash.style.right='14px'; trash.style.bottom='14px'),
            内联样式压过任何选择器。所以这里**绝不能只写 left** ——
            那会变成 left+right 双向约束,盒子被拉成 390-12-14=364px 宽、里面的
            30px 图标被 flex 居中到 x≈184,正好糊在字形面板上(第一版就是这么错的)。
            正确做法:不碰它的定位,只放大图标尺寸(容器是 shrink-to-fit,自动跟着变大)。 */
      '#glStage .ps-bar{gap:5px;padding:5px 6px}',
      '#glStage .ps-bar button{min-height:40px;padding:0 12px;font-size:13px}',
      '#glStage .ps-sep{height:22px}',
      '#glStage .ps-panel{top:auto;bottom:6px;right:auto;left:6px;',
      'grid-template-columns:repeat(4,46px);grid-template-rows:repeat(4,46px);gap:5px;padding:6px}',
      '#glStage .ps-panel .ps-char{font-size:26px}',
      '#glStage .ps-trash svg{width:40px;height:40px}',
      '#glStage .ps-menu{padding:12px 20px;font-size:16px}',
      '#glStage .ps-log{left:50%;bottom:auto;top:126px;transform:translateX(-50%);font-size:13px;padding:7px 16px}',
      '}'
    ].join('');
  }
  function ensureCSS() {
    if (!isNarrow()) return null;
    var st = $(CSS_ID);
    if (!st) { st = document.createElement('style'); st.id = CSS_ID; st.type = 'text/css'; }
    st.textContent = cssText();
    // 追加到 head 末尾:模块的 #plCSS/#clCSS/#psCSS 是 mount 时才注入的,
    // 而实验台 unmount 时会把它们**移除**,下次 mount 又会重新追加到末尾 ——
    // 所以每次 attach 都要把自己的样式重新挪到末尾,才能稳定压过模块样式。
    (document.head || document.documentElement).appendChild(st);
    return st;
  }
  function dropCSS() {
    var st = $(CSS_ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
  }

  /* ------------------------------------------------------------------ *
   * 2) 当前挂载状态                                                    *
   * ------------------------------------------------------------------ */
  var cur = null;   // { kind, root, body, bar, tab, onPick, mq }

  function bodyOf(root, kind) {
    var cls = (kind === 'clab') ? 'cl-body' : 'pl-body';
    return root ? root.querySelector('.' + cls) : null;
  }

  function setTab(name) {
    if (!cur || !cur.body) return false;
    if (name !== 'list' && name !== 'data') return false;
    cur.tab = name;
    var b = cur.body;
    b.className = String(b.className)
      .replace(/(^|\s)qm-tab-(list|data)(\s|$)/g, '$1')
      .replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
    b.className = b.className + ' qm-tab-' + name;
    var btns = cur.bar ? cur.bar.querySelectorAll('.qm-tab') : [];
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-qm') === name;
      if (on) btns[i].classList.add('qm-on'); else btns[i].classList.remove('qm-on');
      btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    return true;
  }

  /* 实验列表点击(捕获阶段):模块自己的 click 处理器照常跑,我们只额外
     把下方标签页切到「参数 · 数据」—— 选完实验马上就能调参数,少一次点击。 */
  function onListClick(ev) {
    if (!cur) return;
    var t = ev.target;
    if (!t || !t.closest) return;
    var cls = (cur.kind === 'clab') ? '.cl-item' : '.pl-item';
    if (!t.closest(cls)) return;
    setTimeout(function () { if (cur && cur.tab !== 'data') setTab('data'); }, 0);
  }

  function syncBreakpoint() {
    if (!cur) return;
    var narrow = isNarrow();
    if (cur.bar) cur.bar.style.display = narrow ? 'flex' : 'none';
    if (!narrow && cur.body) {
      // 回到宽屏:交还给模块自带的桌面三栏布局,标签类名要清掉
      cur.body.className = String(cur.body.className)
        .replace(/(^|\s)qm-tab-(list|data)(\s|$)/g, '$1')
        .replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
    } else if (narrow && cur.body && !/qm-tab-/.test(cur.body.className)) {
      setTab(cur.tab || 'data');
    }
  }

  /* ------------------------------------------------------------------ *
   * 3) 对外接口                                                        *
   * ------------------------------------------------------------------ */
  var API = {
    /* kind: 'psandbox' | 'plab' | 'clab'
     * rootEl: 模块 mount 时建的根节点(.ps-overlay / #plRoot / #clRoot)
     * opts: { tab: 'list' | 'data' }  —— 初始标签页(缺省 data)
     */
    attach: function (kind, rootEl, opts) {
      opts = opts || {};
      API.detach();
      if (!rootEl) return false;
      cur = { kind: kind, root: rootEl, body: null, bar: null, tab: null, mq: null };
      ensureCSS();
      if (kind !== 'psandbox') {
        var body = bodyOf(rootEl, kind);
        if (body) {
          cur.body = body;
          var bar = cel('div', 'qm-tabs');
          bar.id = 'qmTabs';
          bar.setAttribute('role', 'tablist');
          var bList = cel('button', 'qm-tab', (kind === 'clab') ? '🧫 反应列表' : '📋 实验列表');
          bList.type = 'button'; bList.setAttribute('data-qm', 'list'); bList.setAttribute('aria-selected', 'false');
          var bData = cel('button', 'qm-tab', (kind === 'clab') ? '📊 条件 · 现象' : '📊 参数 · 数据');
          bData.type = 'button'; bData.setAttribute('data-qm', 'data'); bData.setAttribute('aria-selected', 'true');
          bar.appendChild(bList); bar.appendChild(bData);
          bar.addEventListener('click', function (ev) {
            var b = ev.target && ev.target.closest ? ev.target.closest('.qm-tab') : null;
            if (!b) return;
            setTab(b.getAttribute('data-qm'));
          });
          body.appendChild(bar);
          cur.bar = bar;
          cur.onPick = onListClick;
          rootEl.addEventListener('click', onListClick, true);
          setTab(opts.tab === 'list' ? 'list' : 'data');
        }
      }
      try {
        var mq = window.matchMedia(MQ);
        if (mq.addEventListener) mq.addEventListener('change', syncBreakpoint);
        else if (mq.addListener) mq.addListener(syncBreakpoint);
        cur.mq = mq;
      } catch (e) { /* 忽略 */ }
      syncBreakpoint();
      return true;
    },

    /* 退出实验台(或切页/切科目)时调用:标签栏、类名、样式全部撤掉 */
    detach: function () {
      var c = cur;
      cur = null;
      if (!c) { dropCSS(); return false; }
      try { if (c.root && c.onPick) c.root.removeEventListener('click', c.onPick, true); } catch (e) { /* 忽略 */ }
      try { if (c.bar && c.bar.parentNode) c.bar.parentNode.removeChild(c.bar); } catch (e2) { /* 忽略 */ }
      try { if (c.mq) { if (c.mq.removeEventListener) c.mq.removeEventListener('change', syncBreakpoint); else if (c.mq.removeListener) c.mq.removeListener(syncBreakpoint); } } catch (e3) { /* 忽略 */ }
      dropCSS();
      return true;
    },

    /* 观澜面板上打/撤 qg-lab-on(实验台打开时对话区让位) */
    setPanelLab: function (on) {
      var p = $('guanlan');
      if (!p) return false;
      try {
        if (on) p.classList.add('qg-lab-on');
        else p.classList.remove('qg-lab-on');
      } catch (e) { return false; }
      return true;
    },

    setTab: setTab,
    tab: function () { return cur ? cur.tab : null; },
    attached: function () { return !!cur; },
    kind: function () { return cur ? cur.kind : null; },
    tabs: function () { return !!(cur && cur.bar); },
    isNarrow: isNarrow,
    cssId: CSS_ID,
    /* 排障用:标签栏与画布区的真实盒子(探针断言像素级尺寸时读它) */
    metrics: function () {
      if (!cur) return null;
      var out = { kind: cur.kind, tab: cur.tab, css: !!$(CSS_ID), tabs: !!cur.bar };
      try {
        if (cur.bar) {
          var r = cur.bar.getBoundingClientRect();
          out.tabBar = { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
        }
        var mid = cur.root.querySelector((cur.kind === 'clab') ? '.cl-mid' : '.pl-mid');
        if (mid) {
          var m = mid.getBoundingClientRect();
          out.stage = { w: Math.round(m.width), h: Math.round(m.height), top: Math.round(m.top) };
        }
        var pn = cur.root.querySelector((cur.kind === 'clab') ? '.cl-left' : '.pl-left');
        if (pn) { var p2 = pn.getBoundingClientRect(); out.listPanel = { w: Math.round(p2.width), h: Math.round(p2.height), visible: pn.offsetParent !== null }; }
        var rp = cur.root.querySelector((cur.kind === 'clab') ? '.cl-right' : '.pl-right');
        if (rp) { var p3 = rp.getBoundingClientRect(); out.dataPanel = { w: Math.round(p3.width), h: Math.round(p3.height), visible: rp.offsetParent !== null }; }
      } catch (e) { out.err = String(e && e.message || e); }
      return out;
    }
  };

  window.QG_LABMOBILE = API;
})();
