/* ============================================================
 * sw.js — 穷观手机版 Service Worker(PWA 应用外壳缓存)
 * ------------------------------------------------------------
 * 策略:网络优先,失败回退缓存(network-first, falling back to cache)。
 *   · 在线时永远拿最新代码,不会出现"改了脚本手机上还是旧版";
 *   · 断网 / 弱网(APK 离线、手机在无网环境)时用缓存把应用外壳撑起来。
 *
 * 明确**不缓存**:
 *   · /api/ds 以及任何同源 /api/ 开头的请求(AI 代理,必须实时);
 *   · https://api.deepseek.com 及一切跨域请求(直接放行走网络);
 *   · 非 GET 请求(POST 一律不拦)。
 *
 * 注册时机与限制:
 *   Service Worker 只在「安全上下文」可用 —— https 或 localhost。
 *   用 http://<局域网IP>:8080 访问手机时属于非安全上下文,浏览器会拒绝注册,
 *   此时本文件不会被使用,页面照常工作(注册失败被静默吞掉,不报错)。
 *   在 Capacitor APK(https://localhost)与电脑 127.0.0.1 自测时正常生效。
 * ============================================================ */

var VERSION = 'qg-mobile-v1';
var SHELL_CACHE = VERSION + '-shell';
var RUNTIME_CACHE = VERSION + '-runtime';

/* 应用外壳:体积都很小,安装时一次性预缓存 */
var SHELL = [
  './',
  './index.html',
  './train.html',
  './guanlan.html',
  './manifest.webmanifest',
  './favicon.ico',
  './css/style.css',
  './js/ainet.js',
  './js/app.js',
  './js/mainbridge.js',
  './js/mobile.js',
  './js/train.js',
  './js/demo.js',
  './js/glcanvas.js',
  './js/gltemplates.js',
  './vendor/three.min.js',
  './vendor/OrbitControls.js',
  './vendor/mathjax-tex-svg.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* 五科数据体积很大(合计约 3.8MB),不阻塞安装:安装完成后在后台补缓存。
   首次访问后即离线可用;单科失败不影响其它科与整体安装结果。 */
var DATA = [
  './js/data.js',
  './js/data_chem.js',
  './js/data-physics.js',
  './js/data_eng.js',
  './js/data_bio.js'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // 逐个 add:任何单个文件失败都不会让整次安装失败
      return Promise.all(SHELL.map(function (u) {
        return cache.add(new Request(u, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
  // 后台预热大数据文件(不参与 waitUntil,失败无所谓)
  ev.waitUntil(
    caches.open(RUNTIME_CACHE).then(function (cache) {
      return Promise.all(DATA.map(function (u) {
        return cache.add(new Request(u, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).catch(function () { return null; })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isBypassed(url, req) {
  if (req.method !== 'GET') return true;                       // 只缓存 GET
  if (url.origin !== self.location.origin) return true;         // 跨域(含 api.deepseek.com)一律放行
  if (url.pathname.indexOf('/api/') === 0) return true;         // AI 代理解接口必须实时
  return false;
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (isBypassed(url, req)) return;   // 不拦,交给浏览器原生网络栈

  ev.respondWith(
    fetch(req).then(function (res) {
      // 只缓存成功的同源响应(含 opaque?同源不会 opaque,这里保守只收 200)
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(RUNTIME_CACHE).then(function (c) {
          c.put(req, copy).catch(function () { return null; });
        }).catch(function () { return null; });
      }
      return res;
    }).catch(function () {
      // 网络失败 → 回退缓存
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        // 导航请求(直接输网址/刷新)回退到缓存的 index.html
        if (req.mode === 'navigate') {
          return caches.match('./index.html').then(function (idx) {
            if (idx) return idx;
            return new Response('离线:该页面尚未被缓存。请先在联网状态下打开一次。', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        }
        return new Response('离线:该资源尚未被缓存。', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
