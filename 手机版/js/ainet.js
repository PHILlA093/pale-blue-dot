/* ============================================================
 * ainet.js — 穷观 · AI 调用层(三模式自动选择)
 * ------------------------------------------------------------
 * 同一个页面要能在三种环境里跑,调用方(破卷 train.js / 观澜 demo.js)
 * 不需要知道自己在哪种环境里 —— 只调 window.QGAi.request(opts)。
 *
 *   模式 A · host   桌面宿主存在(window.chrome.webview)
 *                   → 交给宿主代发(桌面版行为一字不变)。
 *   模式 B · native Capacitor 原生壳(APK)
 *                   → 直连 https://api.deepseek.com/chat/completions。
 *                     Capacitor(启用 CapacitorHttp 时)由原生层发请求,
 *                     不存在浏览器 CORS 限制,故这里**不能**绕 /api/ds。
 *   模式 C · proxy  普通浏览器(局域网访问手机版)
 *                   → fetch('/api/ds'),由本地 server.js 反向代理转发。
 *
 * 统一契约:request() **永不 reject**,一律 resolve 成
 *   { ok: true,  content: '<模型回答文本>' }
 *   { ok: false, err: '<可读的中文原因>' }
 * 这样调用方只需判 r.ok,不必各自处理超时/网络异常/上游报错。
 *
 * Key 依旧只从调用方传入(前端 localStorage),本文件不读取、不存储任何 Key。
 * ============================================================ */
(function () {
  'use strict';

  var DS_URL = 'https://api.deepseek.com/chat/completions';
  var TIMEOUT_MS = 60000;      // 与桌面版网页兜底一致;宿主模式由宿主自己兜 180s

  /* ---------- 环境检测 ---------- */
  function hostAvailable() {
    try {
      return !!(typeof window.chrome !== 'undefined' && window.chrome.webview &&
        typeof window.chrome.webview.postMessage === 'function');
    } catch (e) { return false; }
  }
  // Capacitor 原生壳:isNativePlatform() 只在真机/模拟器里为 true;
  // 在浏览器里跑同一份 Capacitor 工程时它返回 false,此时应退回模式 C。
  function capacitorNative() {
    try {
      var c = window.Capacitor;
      if (!c) return false;
      if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
      // 老版本 Capacitor 没有 isNativePlatform:退化为 platform 判定
      return !!(c.platform && c.platform !== 'web');
    } catch (e) { return false; }
  }

  var HAS_HOST = hostAvailable();
  var IS_NATIVE = !HAS_HOST && capacitorNative();
  var MODE = HAS_HOST ? 'host' : (IS_NATIVE ? 'native' : 'proxy');

  /* ---------- 模式 A:宿主通道由页面注入(各页已有自己的 postMessage 通道) ---------- */
  var hostSend = null;      // function(payload) -> Promise<宿主原始回复>
  function setHostSender(fn) { if (typeof fn === 'function') hostSend = fn; }

  /* ---------- 统一的响应取值:兼容标准 Response 与 CapacitorHttp 的已解析对象 ---------- */
  // CapacitorHttp 会把 fetch 打补丁成"直接返回已解析对象"的形态,
  // 此时 res.json 不是函数,直接调用会抛 "res.json is not a function"。
  function pickStatus(res) {
    if (!res) return 0;
    if (typeof res.status === 'number') return res.status;
    if (typeof res.statusCode === 'number') return res.statusCode;   // CapacitorHttp 原始形态
    if (typeof res.ok === 'boolean') return res.ok ? 200 : 0;
    return 0;
  }
  function pickJson(res) {
    return new Promise(function (resolve, reject) {
      if (!res) { reject(new Error('空响应')); return; }
      // 1) 标准 Response
      if (typeof res.json === 'function') {
        try {
          res.json().then(resolve, function (e) {
            reject(new Error('返回内容不是合法 JSON(' + ((e && e.message) || '解析失败') + ')'));
          });
        } catch (e) {
          reject(new Error('读取响应失败:' + ((e && e.message) || e)));
        }
        return;
      }
      // 2) CapacitorHttp 形态:对象里已经放好 data / 或本身就是解析结果
      if (Object.prototype.hasOwnProperty.call(res, 'data')) { resolve(res.data); return; }
      resolve(res);
    });
  }
  // 从任意形态里取错误文案
  function errTextOf(j) {
    if (!j) return '';
    if (typeof j === 'string') return j.slice(0, 300);
    if (j.error && j.error.message) return String(j.error.message);
    if (j.message) return String(j.message);
    return '';
  }
  function contentOf(j) {
    if (!j) return '';
    if (j.choices && j.choices[0] && j.choices[0].message &&
      typeof j.choices[0].message.content === 'string') return j.choices[0].message.content;
    if (j.data && j.data.choices && j.data.choices[0] && j.data.choices[0].message) {
      return String(j.data.choices[0].message.content || '');
    }
    return '';
  }

  /* ---------- 组装发往 DeepSeek 的请求体 ---------- */
  function buildBody(o) {
    var body = {
      model: o.model || 'deepseek-chat',
      messages: o.messages,
      max_tokens: o.max_tokens || 2400,
      temperature: o.temperature != null ? o.temperature : 0.3
    };
    // 提示词里含 JSON 字样时才开 json_object(与桌面宿主行为一致)
    if (o.json) body.response_format = { type: 'json_object' };
    if (o.stream) body.stream = true;
    return body;
  }

  /* ---------- 带超时的 fetch ---------- */
  function fetchWithTimeout(url, init, ms) {
    var ctl = null, tid = null;
    try { ctl = new AbortController(); } catch (e) { ctl = null; }
    if (ctl) {
      init.signal = ctl.signal;
      tid = setTimeout(function () { try { ctl.abort(); } catch (e) { /* 忽略 */ } }, ms);
    }
    return fetch(url, init).then(function (res) {
      if (tid) { clearTimeout(tid); tid = null; }
      return res;
    }, function (e) {
      if (tid) { clearTimeout(tid); tid = null; }
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))) {
        throw new Error('AI 请求超时(' + Math.round(ms / 1000) + ' 秒无响应),请检查网络后重试');
      }
      throw new Error('网络请求失败:' + ((e && e.message) || '未知错误'));
    });
  }

  /* ---------- 模式 B:直连官方接口(APK / 原生壳) ---------- */
  function requestNative(o) {
    var init = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + o.key
      },
      body: JSON.stringify(buildBody(o))
    };
    return fetchWithTimeout(DS_URL, init, o.timeout || TIMEOUT_MS).then(function (res) {
      var st = pickStatus(res);
      var isOk = (typeof res.ok === 'boolean') ? res.ok : (st >= 200 && st < 300);
      return pickJson(res).then(function (j) {
        if (isOk && contentOf(j)) return { ok: true, content: contentOf(j) };
        var msg = errTextOf(j);
        if (st === 401) return { ok: false, err: 'API Key 无效或已过期(401)' + (msg ? ':' + msg : '') };
        if (st === 402) return { ok: false, err: 'DeepSeek 账户余额不足(402)' + (msg ? ':' + msg : '') };
        if (st === 429) return { ok: false, err: '请求过于频繁(429),请稍后重试' };
        if (!isOk) return { ok: false, err: 'AI 接口返回 HTTP ' + st + (msg ? ':' + msg : '') };
        return { ok: false, err: msg || 'AI 未返回可用内容' };
      }, function (e) {
        return { ok: false, err: 'AI 响应解析失败:' + ((e && e.message) || e) };
      });
    }, function (e) {
      return { ok: false, err: (e && e.message) || '网络请求失败' };
    });
  }

  /* ---------- 模式 C:走本地 server.js 的 /api/ds 代理 ---------- */
  function requestProxy(o) {
    var init = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + o.key,
        'Accept': o.stream ? 'text/event-stream' : 'application/json'
      },
      body: JSON.stringify(buildBody(o))
    };
    return fetchWithTimeout('/api/ds', init, o.timeout || TIMEOUT_MS).then(function (res) {
      var st = pickStatus(res);
      var isOk = (typeof res.ok === 'boolean') ? res.ok : (st >= 200 && st < 300);
      return pickJson(res).then(function (j) {
        if (isOk && contentOf(j)) return { ok: true, content: contentOf(j) };
        var msg = errTextOf(j);
        if (st === 401) return { ok: false, err: msg || 'API Key 无效或已过期(401)' };
        if (st === 404) {
          return { ok: false, err: '本地代理 /api/ds 不可用(404)。请用「启动手机版.bat」或 node server.js 启动后再访问本页。' };
        }
        if (st === 405) return { ok: false, err: '本地代理拒绝了该请求(405)' };
        if (st === 502) return { ok: false, err: msg || '本地服务器无法连接 DeepSeek(502)' };
        if (!isOk) return { ok: false, err: '本地代理返回 HTTP ' + st + (msg ? ':' + msg : '') };
        return { ok: false, err: msg || 'AI 未返回可用内容' };
      }, function () {
        // 代理返回的不是 JSON(多见于用静态服务器直接打开、/api/ds 落到 404 页面)
        return { ok: false, err: '本地代理 /api/ds 未就绪(返回了非 JSON 内容)。请用「启动手机版.bat」启动,而不是直接打开 html 文件。' };
      });
    }, function (e) {
      return { ok: false, err: (e && e.message) || '网络请求失败' };
    });
  }

  /* ---------- 模式 A:交给宿主页面的通道 ---------- */
  function requestHost(o) {
    if (!hostSend) {
      return Promise.resolve({ ok: false, err: '桌面宿主通道未注册(页面脚本加载顺序异常)' });
    }
    var payload = {
      kind: 'ds',
      key: o.key,
      json: !!o.json,
      model: o.model || 'deepseek-chat',
      messages: o.messages,
      max_tokens: o.max_tokens || 2400,
      temperature: o.temperature != null ? o.temperature : 0.3
    };
    var p;
    try { p = hostSend(payload); } catch (e) {
      return Promise.resolve({ ok: false, err: '宿主通道异常:' + ((e && e.message) || e) });
    }
    return Promise.resolve(p).then(function (r) {
      if (!r) return { ok: false, err: '宿主无响应' };
      if (r._timeout) return { ok: false, err: 'AI 请求超时(请稍后重试或检查网络)' };
      if (r.ok && typeof r.content === 'string') return { ok: true, content: r.content };
      if (r.ok) return { ok: false, err: '宿主返回内容为空' };
      return { ok: false, err: r.err || 'AI 请求失败' };
    }, function (e) {
      return { ok: false, err: '宿主通道异常:' + ((e && e.message) || e) };
    });
  }

  /* ---------- 对外唯一入口 ---------- */
  function request(opts) {
    var o = opts || {};
    if (!o.messages || !o.messages.length) {
      return Promise.resolve({ ok: false, err: '内部错误:请求缺少 messages' });
    }
    if (!o.key) {
      return Promise.resolve({ ok: false, err: '未设置 DeepSeek API Key(请在页面里填入后保存)' });
    }
    if (MODE === 'host') return requestHost(o);
    if (MODE === 'native') return requestNative(o);
    return requestProxy(o);
  }

  window.QGAi = {
    mode: MODE,
    hasHost: HAS_HOST,
    isNative: IS_NATIVE,
    setHostSender: setHostSender,
    request: request,
    // 调试/验收用:一句话说明当前走哪条路
    describe: function () {
      return MODE === 'host' ? '模式A·桌面宿主代发'
        : MODE === 'native' ? '模式B·Capacitor 原生直连 https://api.deepseek.com'
          : '模式C·本地代理 POST /api/ds';
    }
  };
})();
