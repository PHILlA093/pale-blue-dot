// ============================================================
// 穷观 · 宣传片 · 时间线 v3 (90 秒 / 5400 帧 @60fps)
// 纯函数:__film.frame(f) 只依赖帧号 f -> 可重放、可断点续渲、与真实时间无关。
// 画面语言:深空藏青底 / 单一青色强调 / 细线 / 慢缓动 / 克制字幕 / 左文右图分栏。
// 字幕取向:不喊口号,按"它是什么、怎么用、为什么这么做"逐条讲清楚。
//
//   片头      0-420      0.0-7.0
//   知识云    420-1980   7.0-33.0   数学:先总览(四科数字/六科入口),再实操(搜索/详情)
//   学科巡礼  1980-2880  33.0-48.0  化学 -> 物理 -> 英语
//   破卷     2880-4020  48.0-67.0
//   观澜     4020-5100  67.0-85.0
//   片尾     5100-5400  85.0-90.0
// ============================================================
window.__film = (function () {
    var FPS = 60;
    var TOTAL = 5400;
    var done = {};
    var S = { sceneOn: 0, typed: {} };
    var camBase = null;

    function o(id, v) { var e = document.getElementById(id); if (e) e.style.opacity = String(v); }
    function tx(id, s) { var e = document.getElementById(id); if (e && e.textContent !== s) e.textContent = s; }
    function txh(id, s) { var e = document.getElementById(id); if (e && e.innerHTML !== s) e.innerHTML = s; }
    function st(id, k, v) { var e = document.getElementById(id); if (e) e.style[k] = v; }
    function act(key, f, f0, fn) { if (f >= f0 && !done[key]) { done[key] = 1; try { fn(); } catch (e) { } } }
    function seg(f, a, b, e) { return window.__seg(f, a, b, e); }
    function black(f, a, b) { return 1 - seg(f, a, b, 'inOut'); }

    /* ---------------- 字幕表 [起, 止, 文本] ---------------- */
    var SUBS = [
        // 知识云:总览
        [470, 640, '知识云:把高中三年连成一张网'],
        [680, 840, '四科 2271 个知识点 · 2053 条关联:数学 115、化学 86、物理 92、英语 1978'],
        [880, 1040, '六个学科入口已就位,目前开放数学、化学、物理、英语'],
        // 知识云:实操
        [1120, 1270, '高度是重要度,半径是相关度,颜色是所属板块'],
        [1310, 1450, '打字即搜索:多个关键词用空格隔开,全部命中才列出'],
        [1490, 1700, '点开任意一点:完整讲解、公式、关键词,以及所有与之相关的知识点'],
        [1740, 1940, '相关知识点会自动排到周围,顺着连线就能一路看下去'],
        // 学科巡礼
        [2020, 2180, '化学 86 个知识点 · 219 条关联 · 8 个板块'],
        [2260, 2420, '物理 92 个知识点 · 152 条关联 · 10 个板块'],
        [2500, 2680, '英语 1978 个知识点:词根、短语、句型、语法分层铺开'],
        [2720, 2860, '四科共用一套交互:搜索、定位、出题都在同一张网上'],
        // 破卷
        [2930, 3090, '破卷:AI 出题训练。给它一个板块或知识点,它来出题'],
        [3130, 3260, '每批 4 道,同一题型、同一难度'],
        [3300, 3450, '难度档位直接对应真实高考真题占比:难度一 0%,难度五 100%'],
        [3480, 3640, '题目优先取自本机高考真卷,不足时联网检索,再不足才由 AI 原创'],
        [3660, 3800, '每道题都注明来源:真题 / 联网 / 回忆 / AI 生成'],
        [3840, 3960, '答案与解析一步展开,解析里带完整推导'],
        // 观澜
        [4070, 4220, '观澜:不懂就问。输入框里可以直接粘贴题目图片或教材截图'],
        [4260, 4400, 'AI 先读图,再讲解:概念、公式、易错点一条条讲清'],
        [4440, 4600, '还能把讲解变成一张会动的示意图'],
        [4660, 4840, '31 个内置演示模板:导数、圆锥曲线、立体几何……'],
        [4880, 5040, '可播放、暂停、单步、重置,自己控制演示节奏']
    ];

    /* ---------------- 版面 ---------------- */
    function layout(mode) {
        var k = document.getElementById('__ovKicker');
        var s = document.getElementById('__ovSub');
        var w = document.getElementById('__ovWait');
        var h = document.getElementById('__ovHead');
        if (mode === 'glan') {
            if (k) { k.style.left = '440px'; k.style.top = '92px'; }
            if (s) { s.style.left = '440px'; s.style.bottom = '96px'; s.style.maxWidth = '1180px'; }
            if (w) { w.style.left = '440px'; w.style.top = '452px'; }
            if (h) h.style.display = 'none';
        } else if (mode === 'split') {
            if (k) { k.style.left = '104px'; k.style.top = '92px'; }
            if (s) { s.style.left = '104px'; s.style.bottom = '104px'; s.style.maxWidth = '660px'; }
            if (w) { w.style.left = '104px'; w.style.top = '452px'; }
            if (h) h.style.display = 'block';
        } else {
            if (k) { k.style.left = '104px'; k.style.top = '92px'; }
            if (s) { s.style.left = '104px'; s.style.bottom = '104px'; s.style.maxWidth = '1240px'; }
            if (w) { w.style.left = '104px'; w.style.top = '452px'; }
            if (h) h.style.display = 'none';
        }
    }
    function kicker(f, a, b, text) {
        tx('__ovKickerTxt', text);
        o('__ovKicker', seg(f, a, a + 34, 'out') * (1 - seg(f, b - 30, b, 'inOut')));
    }
    function subtitle(f) {
        var v = 0, t = '';
        for (var i = 0; i < SUBS.length; i++) {
            var s = SUBS[i];
            if (f >= s[0] - 40 && f <= s[1] + 40) {
                var k2 = seg(f, s[0], s[0] + 16, 'out') * (1 - seg(f, s[1] - 18, s[1], 'inOut'));
                if (k2 > 0) { v = k2; t = s[2]; }
            }
        }
        if (t) tx('__ovSubTxt', t);
        o('__ovSub', v);
    }
    function waitDot(f, on, label) {
        var e = document.getElementById('__ovWait');
        if (!e) return;
        if (!on) { e.style.opacity = '0'; return; }
        tx('__ovWaitTxt', label);
        var p = 0.5 + 0.5 * Math.sin(f / 7);
        e.style.opacity = '1';
        var d = document.getElementById('__ovWaitDot');
        if (d) { d.style.transform = 'scale(' + (0.6 + 0.6 * p).toFixed(3) + ')'; d.style.opacity = String((0.35 + 0.65 * p).toFixed(3)); }
    }

    /* ---------------- 3D 相机 ---------------- */
    function camCapture() {
        var c = window.__qgControls;
        if (!c) return false;
        var p = c.object.position, t = c.target;
        var dx = p.x - t.x, dz = p.z - t.z;
        camBase = { rad: Math.sqrt(dx * dx + dz * dz), yaw: Math.atan2(dx, dz), dy: p.y - t.y };
        try { c.enableDamping = false; if ('autoRotate' in c) c.autoRotate = false; } catch (e) { }
        return true;
    }
    function camDrive(yawDeg, zoom, dyScale) {
        var c = window.__qgControls;
        if (!c || !camBase) return;
        var a = camBase.yaw + yawDeg * Math.PI / 180;
        var r = camBase.rad * zoom;
        var t = c.target;
        c.object.position.set(t.x + r * Math.sin(a), t.y + camBase.dy * (dyScale || 1), t.z + r * Math.cos(a));
        c.object.lookAt(t);
    }

    /* ---------------- 片头 0-420 ---------------- */
    function segOpen(f) {
        o('__ovBlack', black(f, 350, 420));
        o('__ovBrand', seg(f, 14, 60, 'out') * (1 - seg(f, 346, 390, 'inOut')));
        o('__lgNavy', seg(f, 16, 62, 'out'));
        var cy = seg(f, 44, 104, 'out');
        st('__lgCyan', 'transform', 'scale(' + (0.55 + 0.45 * cy).toFixed(4) + ')');
        o('__lgCyan', cy);
        var dt = seg(f, 76, 132, 'out');
        st('__lgDot', 'transform', 'scale(' + (0.2 + 0.8 * dt).toFixed(4) + ')');
        o('__lgDot', dt);
        o('__lgRing', seg(f, 30, 120, 'out') * 0.55);
        var ti = seg(f, 88, 178, 'out');
        o('__ovTitle', ti);
        st('__ovTitle', 'letterSpacing', (0.52 - 0.34 * ti).toFixed(3) + 'em');
        st('__ovTitle', 'transform', 'translateY(' + ((1 - ti) * 14).toFixed(2) + 'px)');
        var s2 = seg(f, 146, 214, 'out');
        o('__ovSub2', s2);
        st('__ovSub2', 'transform', 'translateY(' + ((1 - s2) * 10).toFixed(2) + 'px)');
        o('__ovHair', seg(f, 176, 206, 'out'));
        st('__ovHair', 'transform', 'scaleX(' + seg(f, 176, 238, 'inOut').toFixed(4) + ')');
        var app = document.getElementById('app');
        if (app) app.style.opacity = String(seg(f, 358, 424, 'inOut'));
    }

    /* ---------------- 知识云 420-1980 ----------------
     * 前段总览(缓慢环绕+缓推),后段实操:搜索 -> 定位 -> 详情 -> 拉回看关联 */
    function segCloud(f) {
        o('__ovBlack', 0);
        layout('index');
        kicker(f, 436, 1060, '知识云 · 数学');
        if (!(f >= 1240 && f <= 1336)) {
            if (f < 1240) {
                var g = seg(f, 420, 1240, 'inOutSine');
                camDrive(-8 + 26 * g, 1 - 0.14 * g, 1 + 0.04 * g);
            } else {
                var g2 = seg(f, 1337, 1390, 'out');
                var spin = seg(f, 1390, 1900, 'inOutSine');
                camDrive(5 * spin, 1 + 1.45 * g2, 1);
            }
        }
        act('typing', f, 1096, function () { window.__film.typing('searchInput', 1096, 1160); });
        act('search', f, 1168, function () { var b = document.getElementById('searchBtn'); if (b) b.click(); });
        act('pick', f, 1206, function () { var li = document.querySelector('#searchResults li[data-id]'); if (li) li.click(); });
        act('focus', f, 1252, function () { var b = document.getElementById('dFocus'); if (b) b.click(); });
        act('rebased', f, 1336, function () { camCapture(); });
        kicker(f, 1080, 1900, '知识云 · 搜索与详情');
        o('__ovBlack', seg(f, 1940, 1980, 'inOut'));
    }

    /* ---------------- 学科巡礼 1980-2880 ---------------- */
    function segSubject(f, cfg) {
        var g = seg(f, cfg.a + cfg.in, cfg.b - cfg.out, 'inOutSine');
        camDrive(cfg.yaw * g, 1 - cfg.push * g, 1 + 0.03 * g);
        o('__ovBlack', Math.max(black(f, cfg.a, cfg.a + cfg.in), seg(f, cfg.b - cfg.out, cfg.b, 'inOut')));
    }

    /* ---------------- 破卷 2880-4020 ---------------- */
    function segTrain(f) {
        layout('split');
        kicker(f, 2904, 3240, '破卷 · AI 出题训练');
        txh('__ovHeadTxt', '说一个知识点<br>它来出一套题');
        var h = seg(f, 2930, 3002, 'out');
        o('__ovHead', h);
        st('__ovHead', 'transform', 'translateY(' + ((1 - h) * 16).toFixed(2) + 'px)');
        var w = document.getElementById('__trWindow');
        if (w) w.style.transform = 'scale(' + (1.045 + 0.022 * seg(f, 2880, 4020, 'inOutSine')).toFixed(4) + ')';
        act('type2', f, 2912, function () { window.__film.typing('askInput', 2912, 2968); });
        act('locate', f, 2984, function () { var b = document.getElementById('locateBtn'); if (b) b.click(); });
        if (f >= 3120 && f < 3300) {
            var cs0 = document.querySelectorAll('#qaArea .qcard');
            for (var i0 = 0; i0 < cs0.length; i0++) cs0[i0].style.opacity = '0';
        }
        var cs = document.querySelectorAll('#qaArea .qcard');
        for (var i = 0; i < cs.length; i++) {
            cs[i].style.opacity = String(seg(f, 3360 + i * 16, 3388 + i * 16, 'out'));
        }
        act('sol', f, 3800, function () {
            var b = document.querySelector('#qaArea .qcard .sol-btn');
            if (b) b.click();
            var s2 = document.querySelector('#qaArea .qcard .sol');
            if (s2) s2.style.opacity = '0';
        });
        var sol = document.querySelector('#qaArea .qcard .sol');
        if (sol && f >= 3800) sol.style.opacity = String(seg(f, 3806, 3856, 'out'));
        o('__ovBlack', Math.max(black(f, 2880, 2928), seg(f, 3980, 4020, 'inOut')));
    }

    /* ---------------- 观澜 4020-5100 ---------------- */
    function segGlan(f) {
        layout('glan');
        kicker(f, 4044, 4400, '观澜 · AI 讲解与动态演示');
        act('type3', f, 4102, function () { window.__film.typing('glAsk', 4102, 4178); });
        if (f >= 4420) {
            var sc = document.querySelector('.gl-chat');
            if (sc) sc.scrollTop = sc.scrollHeight * seg(f, 4420, 4600, 'inOutSine');
        }
        act('demo', f, 4540, function () { var b = document.getElementById('glDemoBtn'); if (b) b.click(); });
        act('scene', f, 4740, function () {
            try {
                var m = (window.QG_TEMPLATES.manifest || []).filter(function (x) { return x.id === 'func-derivative-tangent'; })[0];
                var p = {};
                if (m && m.params) m.params.forEach(function (q) { p[q.k] = q.def; });
                window.__guanlanTest.applyDemo('func-derivative-tangent', p);
                window.__guanlanTest.engine().pause();
                S.sceneOn = 1;
            } catch (e) { }
        });
        if (S.sceneOn) {
            try {
                var e2 = window.__guanlanTest.engine();
                e2.reset();
                e2.step(seg(f, 4740, 5100, 'inOutSine') * 48);
            } catch (e) { }
        }
        var stage = document.getElementById('glStage');
        if (stage) stage.style.transform = 'scale(' + (1 + 0.10 * seg(f, 4740, 5100, 'inOutSine')).toFixed(4) + ')';
        o('__ovBlack', Math.max(black(f, 4020, 4068), seg(f, 5060, 5100, 'inOut')));
    }

    /* ---------------- 片尾 5100-5400 ---------------- */
    function segOutro(f) {
        o('__ovBlack', 1);
        o('__ovVig', 0); o('__ovBars', 0); o('__ovKicker', 0); o('__ovSub', 0); o('__ovMark', 0);
        var g = seg(f, 5136, 5200, 'out') * (1 - seg(f, 5362, 5400, 'inOut'));
        o('__ovEnd', g);
        o('__ovEndName', seg(f, 5136, 5196, 'out') * g);
        st('__ovEndName', 'letterSpacing', (0.34 - 0.14 * seg(f, 5136, 5210, 'out')).toFixed(3) + 'em');
        o('__ovEndQuote', seg(f, 5186, 5244, 'out') * g);
        o('__ovEndLine', seg(f, 5226, 5252, 'out') * g);
        st('__ovEndLine', 'transform', 'scaleX(' + seg(f, 5226, 5282, 'inOut').toFixed(4) + ')');
        o('__ovEndMods', seg(f, 5240, 5300, 'out') * g);
        o('__ovEndFoot', seg(f, 5276, 5330, 'out') * g);
    }

    /* ---------------- 帧入口 ---------------- */
    var SUBJECTS = {
        chem: { a: 1980, b: 2220, in: 40, out: 26, push: 0.16, yaw: 3 },
        physics: { a: 2220, b: 2460, in: 36, out: 24, push: 0.15, yaw: -3 },
        eng: { a: 2460, b: 2880, in: 36, out: 40, push: 0.22, yaw: 6 }
    };

    function frame(f) {
        if (!window.__ov || !window.__ov.build()) return;
        if (f >= 420 && f < 5100) {
            var v = seg(f, 420, 482, 'out') * (1 - seg(f, 5040, 5100, 'inOut'));
            o('__ovVig', v); o('__ovBars', v);
        }
        if (f >= 420) {
            o('__ovProgWrap', 0.85 * seg(f, 420, 482, 'out') * (1 - seg(f, 5392, 5400, 'inOut')));
            st('__ovProg', 'width', (100 * Math.min(1, f / TOTAL)).toFixed(2) + '%');
        }
        if (f >= 450 && f < 5040) o('__ovMark', 0.5 * seg(f, 450, 520, 'out') * (1 - seg(f, 5000, 5040, 'inOut')));
        else if (f >= 5040) o('__ovMark', 0);

        var waiting = (f >= 3120 && f < 3300) || (f >= 4600 && f < 4680);
        waitDot(f, waiting, (f < 3300) ? 'AI 正在出题' : 'AI 正在生成示意图');

        if (f < 420) { segOpen(f); }
        else if (f < 1980) { segCloud(f); }
        else if (f < 2220) { layout('index'); kicker(f, 1996, 2220, '学科巡礼 · 化学'); segSubject(f, SUBJECTS.chem); }
        else if (f < 2460) { layout('index'); kicker(f, 2236, 2460, '学科巡礼 · 物理'); segSubject(f, SUBJECTS.physics); }
        else if (f < 2880) { layout('index'); kicker(f, 2476, 2700, '学科巡礼 · 英语'); segSubject(f, SUBJECTS.eng); }
        else if (f < 4020) { segTrain(f); }
        else if (f < 5100) { segGlan(f); }
        else { segOutro(f); }

        subtitle(f);
    }

    return {
        FPS: FPS, TOTAL: TOTAL, SUBS: SUBS, frame: frame, layout: layout,
        camCapture: camCapture, camDrive: camDrive, state: S,
        typing: function (id, a, b) {
            var e = document.getElementById(id);
            if (!e) return;
            var full = e.dataset.qgFull || e.value || '';
            S.typed[id] = { el: e, a: a, b: b, full: full };
            e.value = '';
        },
        tickTyping: function (f) {
            for (var k in S.typed) {
                var t = S.typed[k];
                // 打完就彻底撒手:否则页面自己清空输入框时(如点选节点会退出搜索态),
                // 这里会"重新打一遍"并派发 input,反倒把页面的状态机顶回去。
                if (f > t.b + 1) { delete S.typed[k]; continue; }
                var n = Math.max(0, Math.min(t.full.length, Math.round(t.full.length * seg(f, t.a, t.b, 'inOut'))));
                var v = t.full.slice(0, n);
                if (t.el.value !== v) { t.el.value = v; t.el.dispatchEvent(new Event('input', { bubbles: true })); }
            }
        }
    };
})();
