// ============================================================
// 穷观 · 宣传片录制 · 注入层 (promo inject)
// 在页面自身脚本之前执行,只做三件事,不修改任何项目文件:
//   1) 虚拟时钟:page time 变成我可以手拧的值 -> 每帧都是时间的纯函数,60fps 均匀无丢帧
//   2) 抓 THREE 相机 / OrbitControls 实例(它们藏在 app.js 的 IIFE 闭包里,没有 window 出口)
//   3) 建覆盖层:片头片尾品牌块、字幕、进度细线、暗角、黑场
// ============================================================
(function () {
    if (window.__vt !== undefined) return;

    /* ---------------- 1. 虚拟时钟 ---------------- */
    var timers = [];
    var tid = 1;
    window.__vt = 0;
    window.__rafQ = [];

    performance.now = function () { return window.__vt; };
    Date.now = function () { return 1700000000000 + window.__vt; };
    window.requestAnimationFrame = function (cb) { window.__rafQ.push(cb); return window.__rafQ.length; };
    window.cancelAnimationFrame = function () { };
    window.webkitRequestAnimationFrame = window.requestAnimationFrame;

    window.setTimeout = function (fn, ms) { timers.push({ id: tid, at: window.__vt + (ms || 0), fn: fn, every: 0 }); return tid++; };
    window.setInterval = function (fn, ms) { timers.push({ id: tid, at: window.__vt + (ms || 1), fn: fn, every: Math.max(1, ms || 1) }); return tid++; };
    window.clearTimeout = window.clearInterval = function (id) {
        for (var i = 0; i < timers.length; i++) if (timers[i].id === id) { timers.splice(i, 1); return; }
    };

    window.__pump = function (t) {
        window.__vt = t;
        for (var guard = 0; guard < 800; guard++) {
            var due = null;
            for (var i = 0; i < timers.length; i++) { if (timers[i].at <= t) { due = timers[i]; break; } }
            if (!due) break;
            if (due.every) { due.at = due.at + due.every; }
            else { for (var k = 0; k < timers.length; k++) if (timers[k] === due) { timers.splice(k, 1); break; } }
            try { due.fn(); } catch (e) { }
        }
        var q = window.__rafQ; window.__rafQ = [];
        for (var j = 0; j < q.length; j++) { try { q[j](t); } catch (e) { } }
        return window.__vt;
    };

    // CSS 动画/过渡归合成器管,按需把它们也对齐到虚拟时间
    window.__syncCss = function (t) {
        try {
            var as = document.getAnimations ? document.getAnimations() : [];
            for (var i = 0; i < as.length; i++) { try { as[i].currentTime = t; } catch (e) { } }
        } catch (e) { }
    };
    // 录制期间不允许任何"自己会动"的过渡(所有淡入淡出由时间线逐帧指定)
    window.__freezeCss = function () {
        if (document.getElementById('__ovFreeze')) return;
        var s = document.createElement('style');
        s.id = '__ovFreeze';
        s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important}';
        (document.head || document.documentElement).appendChild(s);
    };

    /* ---------------- 2. 抓相机与控制器 ---------------- */
    // three.min.js 是 UMD:执行时给 global 赋 THREE = {}。这里先埋 setter,
    // 等它赋值的那一刻再给 OrbitControls 也埋一个 setter,包一层记录实例的构造函数。
    var _THREE;
    try {
        Object.defineProperty(window, 'THREE', {
            configurable: true,
            get: function () { return _THREE; },
            set: function (v) {
                _THREE = v;
                if (!v || v.__qgTrapped) return;
                v.__qgTrapped = true;
                var _oc = v.OrbitControls;
                try {
                    Object.defineProperty(v, 'OrbitControls', {
                        configurable: true,
                        get: function () { return _oc; },
                        set: function (Ctor) {
                            _oc = function (el, cam) {
                                var inst = new Ctor(el, cam);
                                window.__qgControls = inst;
                                window.__qgCam = cam;
                                window.__qgCanvasEl = el;
                                return inst;
                            };
                            _oc.prototype = Ctor.prototype;
                            for (var k in Ctor) { try { _oc[k] = Ctor[k]; } catch (e) { } }
                        }
                    });
                } catch (e) { }
                // 兜底:渲染循环每帧都会 render(scene, camera)
                try {
                    var r0 = v.WebGLRenderer.prototype.render;
                    v.WebGLRenderer.prototype.render = function (sc, cam) {
                        window.__qgScene = sc; window.__qgCam = cam;
                        return r0.apply(this, arguments);
                    };
                } catch (e) { }
                try {
                    var d0 = v.EventDispatcher.prototype.dispatchEvent;
                    v.EventDispatcher.prototype.dispatchEvent = function (ev) {
                        if (this && this.object && this.target && this.domElement && typeof this.update === 'function') window.__qgControls = this;
                        return d0.apply(this, arguments);
                    };
                } catch (e) { }
            }
        });
    } catch (e) { }

    /* ---------------- 3. 覆盖层 ---------------- */
    var FONT = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Hiragino Sans GB","Segoe UI",sans-serif';
    var CYAN = '#4fc3f7';
    var TEXT = 'rgba(226,237,250,.94)';
    var DIM = 'rgba(150,170,196,.62)';

    var OV = {
        built: false,
        el: {},
        build: function () {
            if (OV.built || !document.documentElement) return OV.built;
            OV.built = true;
            var wrap = document.createElement('div');
            wrap.id = '__ov';
            wrap.setAttribute('style', 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483000;pointer-events:none;overflow:hidden;'
                + 'font-family:' + FONT + ';-webkit-font-smoothing:antialiased');
            wrap.innerHTML = [
                // 暗角:让画面四周压暗,中心更聚焦(电影感)
                '<div id="__ovVig" style="position:absolute;inset:0;opacity:0;background:'
                + 'radial-gradient(118% 88% at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,.30) 78%, rgba(0,0,0,.60) 100%)"></div>',
                // 上下压边
                '<div id="__ovBars" style="position:absolute;inset:0;opacity:0;background:'
                + 'linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 82%, rgba(0,0,0,.60) 100%)"></div>',
                // 黑场(转场用)
                '<div id="__ovBlack" style="position:absolute;inset:0;background:#000;opacity:0"></div>',
                // 片头/片尾品牌块
                '<div id="__ovBrand" style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0">'
                + '  <div style="position:absolute;left:0;right:0;top:44%;transform:translateY(-50%);text-align:center">'
                + '    <div id="__ovLogo" style="display:inline-block;line-height:0">'
                + '      <svg viewBox="0 0 64 64" width="116" height="116">'
                + '        <circle id="__lgNavy" cx="32" cy="32" r="30" fill="#121b30"/>'
                + '        <circle id="__lgCyan" cx="32" cy="32" r="20" fill="' + CYAN + '"/>'
                + '        <circle id="__lgDot" cx="32" cy="32" r="8" fill="#ffffff"/>'
                + '        <circle id="__lgRing" cx="32" cy="32" r="31" fill="none" stroke="' + CYAN + '" stroke-width="0.8" opacity="0.55"/>'
                + '      </svg>'
                + '    </div>'
                + '    <div id="__ovTitle" style="margin-top:30px;font-size:74px;font-weight:200;color:' + TEXT + ';letter-spacing:.34em;text-indent:.34em">穷观</div>'
                + '    <div id="__ovSub2" style="margin-top:20px;font-size:19px;font-weight:300;color:' + DIM + ';letter-spacing:.42em;text-indent:.42em">高中知识网络 · 学习系统</div>'
                + '    <div id="__ovHair" style="margin:34px auto 0;width:340px;height:1px;background:linear-gradient(90deg,rgba(79,195,247,0) 0%,rgba(79,195,247,.85) 50%,rgba(79,195,247,0) 100%);transform:scaleX(0)"></div>'
                + '  </div>'
                + '</div>',
                // 片尾
                '<div id="__ovEnd" style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0">'
                + '  <div style="position:absolute;left:0;right:0;top:43%;transform:translateY(-50%);text-align:center">'
                + '    <div style="display:inline-block;line-height:0">'
                + '      <svg viewBox="0 0 64 64" width="92" height="92">'
                + '        <circle cx="32" cy="32" r="30" fill="#121b30"/><circle cx="32" cy="32" r="20" fill="' + CYAN + '"/><circle cx="32" cy="32" r="8" fill="#fff"/>'
                + '        <circle cx="32" cy="32" r="31" fill="none" stroke="' + CYAN + '" stroke-width="0.7" opacity="0.5"/>'
                + '      </svg>'
                + '    </div>'
                + '    <div id="__ovEndName" style="margin-top:32px;font-size:50px;font-weight:250;color:' + TEXT + ';letter-spacing:.22em;text-indent:.22em">穷观学习</div>'
                + '    <div id="__ovEndQuote" style="margin-top:30px;font-size:27px;font-weight:300;color:rgba(186,206,230,.9);letter-spacing:.18em;text-indent:.18em">知识理应流通与分享</div>'
                + '    <div id="__ovEndLine" style="margin:42px auto 0;width:300px;height:1px;background:linear-gradient(90deg,rgba(79,195,247,0),rgba(79,195,247,.75),rgba(79,195,247,0));transform:scaleX(0)"></div>'
                + '    <div id="__ovEndMods" style="margin-top:40px;font-size:17px;font-weight:300;color:rgba(160,182,208,.78);letter-spacing:.40em;text-indent:.40em">知识云 &nbsp;·&nbsp; 破卷 &nbsp;·&nbsp; 观澜</div>'
                + '    <div id="__ovEndFoot" style="margin-top:26px;font-size:15px;font-weight:300;color:rgba(132,152,180,.62);letter-spacing:.26em;text-indent:.26em">Windows 桌面版 · 数据全部留在本机</div>'
                + '  </div>'
                + '</div>',
                // 章节小标(左上角,细体大写感)
                '<div id="__ovKicker" style="position:absolute;left:104px;top:92px;opacity:0">'
                + '  <div style="display:flex;align-items:center;gap:14px">'
                + '    <div style="width:22px;height:1px;background:' + CYAN + ';opacity:.9"></div>'
                + '    <div id="__ovKickerTxt" style="font-size:16px;font-weight:300;color:rgba(190,208,230,.85);letter-spacing:.34em"></div>'
                + '  </div>'
                + '</div>',
                // 左侧大字标题(破卷段用,与右侧窗口形成编辑式分栏)
                '<div id="__ovHead" style="position:absolute;left:104px;top:236px;opacity:0;max-width:640px">'
                + '  <div id="__ovHeadTxt" style="font-size:42px;font-weight:250;line-height:1.46;color:' + TEXT + ';letter-spacing:.04em"></div>'
                + '</div>',
                // 等待指示(真实 AI 在跑的时候亮;呼吸完全由帧号驱动)
                '<div id="__ovWait" style="position:absolute;left:104px;top:452px;opacity:0">'
                + '  <div style="display:flex;align-items:center;gap:16px">'
                + '    <div id="__ovWaitDot" style="width:9px;height:9px;border-radius:50%;background:' + CYAN + ';box-shadow:0 0 16px rgba(79,195,247,.95)"></div>'
                + '    <div id="__ovWaitTxt" style="font-size:19px;font-weight:300;color:rgba(190,208,230,.78);letter-spacing:.26em"></div>'
                + '  </div>'
                + '</div>',
                // 字幕
                '<div id="__ovSub" style="position:absolute;left:104px;bottom:104px;max-width:1240px;opacity:0">'
                + '  <div style="position:relative;padding-left:26px">'
                + '    <div id="__ovTick" style="position:absolute;left:0;top:14px;width:14px;height:1px;background:' + CYAN + ';box-shadow:0 0 10px rgba(79,195,247,.9)"></div>'
                + '    <div id="__ovSubTxt" style="font-size:29px;font-weight:300;line-height:1.55;color:' + TEXT + ';letter-spacing:.05em;text-shadow:0 2px 26px rgba(0,0,0,.9)"></div>'
                + '  </div>'
                + '</div>',
                // 角标
                '<div id="__ovMark" style="position:absolute;right:96px;bottom:100px;opacity:0;font-size:14px;font-weight:300;color:rgba(150,170,196,.55);letter-spacing:.30em">穷观 · QIONGGUAN</div>',
                // 底部进度细线
                '<div id="__ovProgWrap" style="position:absolute;left:0;bottom:0;width:100%;height:2px;background:rgba(120,160,220,.10);opacity:0">'
                + '  <div id="__ovProg" style="width:0%;height:100%;background:linear-gradient(90deg,rgba(79,195,247,.35),' + CYAN + ')"></div>'
                + '</div>'
            ].join('');
            // 关键:挂到 <html> 上而不是 <body>。宣传片会给 body 加 transform(把真窗口缩成
            // "浮在舞台上的窗口"),而 CSS 规范下祖先有 transform 时,fixed 定位会改用该祖先做
            // 包含块 —— 那样整层字幕都会跟着窗口一起偏移。<html> 上没有任何 transform。
            document.documentElement.appendChild(wrap);
            ['__ovVig', '__ovBars', '__ovBlack', '__ovBrand', '__ovEnd', '__ovKicker', '__ovKickerTxt', '__ovSub', '__ovSubTxt',
                '__ovTitle', '__ovSub2', '__ovHair', '__ovLogo', '__ovMark', '__ovProgWrap', '__ovProg', '__ovEndName',
                '__ovEndQuote', '__ovEndLine', '__ovEndFoot', '__ovEndMods', '__lgNavy', '__lgCyan', '__lgDot', '__lgRing', '__ovTick',
                '__ovHead', '__ovHeadTxt', '__ovWait', '__ovWaitDot', '__ovWaitTxt'].forEach(function (k) {
                    OV.el[k] = document.getElementById(k);
                });
            return true;
        }
    };
    window.__ov = OV;

    /* ---------------- 4. 缓动/工具 ---------------- */
    window.__ease = {
        linear: function (t) { return t; },
        inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
        out: function (t) { return 1 - Math.pow(1 - t, 3); },
        outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
        inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
        outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
    };
    // 帧区间归一化进度(带缓动)
    window.__seg = function (f, a, b, ease) {
        if (f <= a) return 0;
        if (f >= b) return 1;
        var t = (f - a) / (b - a);
        return ease ? window.__ease[ease](t) : t;
    };
    window.__mix = function (a, b, t) { return a + (b - a) * t; };
    window.__set = function (id, prop, val) {
        var e = OV.el[id]; if (!e) return;
        if (prop === 'text') { if (e.textContent !== val) e.textContent = val; return; }
        e.style[prop] = val;
    };
})();
