/* ============================================================
 * 穷观手机版 · 本地服务器(纯 Node 标准库,零依赖)
 * ------------------------------------------------------------
 * 为什么需要它:
 *   手机浏览器里没有桌面版那样的「宿主(WebView2)」可以代发 AI 请求,
 *   而网页直接 fetch https://api.deepseek.com 会被浏览器的跨域(CORS)拦下。
 *   所以这里起一个极小的本地服务器:
 *     1) 把本目录当静态站点伺服(手机连同一 Wi-Fi 即可访问);
 *     2) 提供 POST /api/ds 代理,把请求原样转发到 DeepSeek 官方接口,
 *        再把上游响应(状态码 / 流式或非流式内容)原样回给前端。
 *
 * 安全约定(务必保持):
 *   · API Key 只存在于前端 localStorage,随请求头 Authorization 透传;
 *     本进程**不读取、不解析、不落盘、不打印**任何 Key 或请求体;
 *   · 逐请求不写访问日志(只保留启动横幅与不含敏感信息的错误提示);
 *   · 默认只监听回环(127.0.0.1):静态站点会把整个目录(含 47 MB 真题语料与安装包)端出去,
 *     所以"能被同网段访问"必须是显式选择,不能是默认行为。
 *
 * 用法:
 *   node server.js                   # 默认 8080 端口,只监听 127.0.0.1(仅本机自测)
 *   node server.js 8080              # 指定端口,同样只监听回环
 *   node server.js 8080 lan          # 开放给同网段的手机(等价 --lan / 0.0.0.0)
 *   node server.js 8080 192.168.1.5  # 或显式指定一个网卡地址
 *   「启动手机版.bat」会自动带上 lan,双击即用。
 * ============================================================ */
'use strict';

var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var os = require('os');

var ROOT = __dirname;
var PORT = parseInt(process.argv[2], 10);
if (!PORT || PORT < 1 || PORT > 65535) PORT = 8080;
// 默认只监听回环:0.0.0.0 会把整个目录(47 MB 真题语料、安装包、指纹文件)端给同网段的任何人。
// 要让手机连进来必须显式声明:第三个参数给 lan / --lan / 0.0.0.0,或直接给本机某个网卡地址。
// 「启动手机版.bat」已经代劳(它会传 lan),所以正常用法不受影响。
var HOST = '127.0.0.1';
var LAN = false;
var hostArg = process.argv[3] || '';
if (hostArg === 'lan' || hostArg === '--lan' || hostArg === '0.0.0.0' || hostArg === '*') {
  HOST = '0.0.0.0'; LAN = true;
} else if (hostArg && hostArg !== '127.0.0.1' && hostArg !== 'localhost') {
  HOST = hostArg; LAN = true;      // 也允许显式指定一个网卡地址
}

var DS_HOST = 'api.deepseek.com';
var DS_PATH = '/chat/completions';
var UPSTREAM_TIMEOUT = 180000;   // 与桌面版宿主的 180s 兜底一致

/* ---------- 静态站点:扩展名 → Content-Type ---------- */
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8'
};

function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

/* ---------- 统一的 JSON 回复(错误一律给明确状态码,绝不吐堆栈) ---------- */
function sendJson(res, code, obj) {
  var body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/* ---------- 静态文件伺服 ---------- */
function serveStatic(req, res, pathname) {
  // 畸形百分号编码(例如 /%E4%ZZ)会让 decodeURIComponent 抛异常,而这段在请求回调的同步路径上
  // —— 未捕获就是一次进程级崩溃,同网段任何人都能触发。解码失败按 400 处理。
  var rel;
  try { rel = decodeURIComponent(pathname); }
  catch (e) { sendJson(res, 400, { error: { message: '请求路径编码非法', type: 'bad_path' } }); return; }
  if (rel === '/' || rel === '') rel = '/index.html';
  // 归一化后必须仍在站点根目录内(防 ../ 目录穿越)
  var target = path.normalize(path.join(ROOT, rel));
  if (target !== ROOT && target.indexOf(ROOT + path.sep) !== 0) {
    sendJson(res, 403, { error: { message: '禁止访问该路径' } });
    return;
  }
  fs.stat(target, function (err, st) {
    if (!err && st.isDirectory()) {
      target = path.join(target, 'index.html');
      st = null;
      err = null;
      fs.stat(target, function (e2, s2) {
        if (e2 || !s2.isFile()) { sendJson(res, 404, { error: { message: '目录下没有 index.html' } }); return; }
        streamFile(res, target, s2);
      });
      return;
    }
    if (err || !st.isFile()) {
      sendJson(res, 404, { error: { message: '未找到:' + rel } });
      return;
    }
    streamFile(res, target, st);
  });
}

function streamFile(res, file, st) {
  var head = {
    'Content-Type': mimeOf(file),
    'Content-Length': st.size,
    // 知识库/脚本改动频繁,禁用强缓存,避免手机上刷不到新版
    'Cache-Control': 'no-cache'
  };
  res.writeHead(200, head);
  var rs = fs.createReadStream(file);
  rs.on('error', function () { try { res.destroy(); } catch (e) { /* 忽略 */ } });
  rs.pipe(res);
}

/* ---------- POST /api/ds:DeepSeek 反向代理 ---------- */
function proxyDs(req, res) {
  var auth = req.headers['authorization'] || '';
  // 没有 Authorization 直接挡掉:给出明确 401,而不是让上游报错后返回 500 堆栈
  if (!auth) {
    sendJson(res, 401, { error: { message: '缺少 Authorization 请求头(请先在页面里填入 DeepSeek API Key)', type: 'no_auth' } });
    return;
  }

  var chunks = [];
  var size = 0;
  var MAX = 8 * 1024 * 1024;      // 8MB 上限,防止超大请求打爆内存
  var aborted = false;
  req.on('data', function (c) {
    if (aborted) return;
    size += c.length;
    if (size > MAX) {
      aborted = true;
      sendJson(res, 413, { error: { message: '请求体过大', type: 'too_large' } });
      try { req.destroy(); } catch (e) { /* 忽略 */ }
      return;
    }
    chunks.push(c);
  });
  req.on('error', function () {
    // 客户端中途断开:无需回复,静默收场
  });
  req.on('end', function () {
    if (aborted) return;
    var body = Buffer.concat(chunks);

    var headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Authorization': auth,
      'Accept': req.headers['accept'] || 'application/json',
      'Content-Length': body.length,
      'User-Agent': 'qiongguan-mobile-proxy/1.0'
    };
    if (req.headers['accept-language']) headers['Accept-Language'] = req.headers['accept-language'];

    var up = https.request({
      host: DS_HOST,
      port: 443,
      method: 'POST',
      path: DS_PATH,
      headers: headers,
      timeout: UPSTREAM_TIMEOUT
    }, function (upRes) {
      // 上游状态码与响应体裁原样回传(流式 SSE 也走这条管道)
      var outHead = {
        'Content-Type': upRes.headers['content-type'] || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        // 上游可能压缩,统一声明为不转码,交给 Node 直接透传
        'X-Proxy': 'qiongguan-local'
      };
      if (upRes.headers['content-encoding']) outHead['Content-Encoding'] = upRes.headers['content-encoding'];
      try { res.writeHead(upRes.statusCode || 502, outHead); } catch (e) { /* 忽略 */ }
      upRes.pipe(res);
      upRes.on('error', function () { try { res.destroy(); } catch (e) { /* 忽略 */ } });
    });

    up.on('timeout', function () {
      try { up.destroy(new Error('上游响应超时')); } catch (e) { /* 忽略 */ }
    });
    up.on('error', function (e) {
      // 网络不通 / DNS 失败 / TLS 失败:返回 502 + 可读原因(不含任何 Key)
      if (res.headersSent) { try { res.destroy(); } catch (e2) { /* 忽略 */ } return; }
      sendJson(res, 502, {
        error: {
          message: '无法连接 DeepSeek 接口(' + (e && e.message ? e.message : '网络错误') + ')。请检查电脑是否能上外网。',
          type: 'upstream_unreachable'
        }
      });
    });
    // 客户端断开时同步掐掉上游连接,避免悬挂
    res.on('close', function () { if (!up.destroyed) { try { up.destroy(); } catch (e) { /* 忽略 */ } } });

    up.end(body);
  });
}

/* ---------- 路由 ---------- */
var server = http.createServer(function (req, res) {
  var pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (e) {
    pathname = (req.url || '/').split('?')[0];
  }

  if (pathname === '/api/ds') {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Allow': 'POST' }); res.end(); return; }
    if (req.method !== 'POST') { sendJson(res, 405, { error: { message: '/api/ds 只接受 POST', type: 'method_not_allowed' } }); return; }
    proxyDs(req, res);
    return;
  }
  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'qiongguan-mobile', port: PORT });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: { message: '静态资源只接受 GET / HEAD', type: 'method_not_allowed' } });
    return;
  }
  serveStatic(req, res, pathname);
});

server.on('error', function (e) {
  if (e && e.code === 'EADDRINUSE') {
    console.error('[穷观手机版] 端口 ' + PORT + ' 已被占用。换一个端口再试,例如:node server.js 8081');
  } else {
    console.error('[穷观手机版] 服务器启动失败:' + (e && e.message ? e.message : e));
  }
  process.exit(1);
});

server.listen(PORT, HOST, function () {
  var ips = [];
  var ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(function (name) {
    (ifs[name] || []).forEach(function (it) {
      if (it && it.family === 'IPv4' && !it.internal) ips.push(it.address);
    });
  });
  console.log('');
  console.log('  ============================================================');
  console.log('   穷观手机版 · 本地服务器已启动');
  console.log('  ============================================================');
  console.log('   本机自测:      http://127.0.0.1:' + PORT + '/');
  if (!LAN) {
    // 默认只听回环:不打印局域网地址,并明确告诉用户怎么开放(否则会误以为"手机连不上"是坏了)
    console.log('   手机访问:      未开放(当前只监听 127.0.0.1,同网段访问不到)');
    console.log('                  要开放请改用:  node server.js ' + PORT + ' lan');
    console.log('                  或直接双击「启动手机版.bat」(它会自动带上 lan)');
  } else if (ips.length) {
    ips.forEach(function (ip) {
      console.log('   手机访问(同一 Wi-Fi): http://' + ip + ':' + PORT + '/');
    });
  } else {
    console.log('   未检测到局域网 IPv4 地址(请确认已连接 Wi-Fi 或网线)');
  }
  console.log('   AI 代理:       POST /api/ds  →  https://api.deepseek.com' + DS_PATH);
  console.log('   Key 只保存在手机浏览器 localStorage,本服务器不留存、不打印。');
  console.log('   停止服务:在本窗口按 Ctrl+C');
  console.log('');
});
