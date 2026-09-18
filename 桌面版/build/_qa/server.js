// Minimal static file server for QA (no deps)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const PORT = parseInt(process.argv[3] || '8931', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log('SERVE ' + ROOT + ' @ http://127.0.0.1:' + PORT));
