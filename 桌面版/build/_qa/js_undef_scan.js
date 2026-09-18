// Static scan: find identifiers that are CALLED but never declared in the same file
const fs = require('fs');
const files = process.argv.slice(2);
const BUILTIN = new Set(['function', 'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'new', 'do', 'else', 'try',
  'Math', 'JSON', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'RegExp', 'Error', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'Promise', 'Map', 'Set', 'WeakMap', 'console', 'document', 'window', 'alert', 'decodeURIComponent',
  'encodeURIComponent', 'performance', 'fetch', 'Uint8Array', 'Float32Array', 'webkitRequestAnimationFrame', 'Symbol',
  'Intl', 'URL', 'Blob', 'Image', 'TextDecoder', 'TextEncoder', 'structuredClone', 'queueMicrotask', 'globalThis', 'eval']);

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const declared = new Set();
  let m;
  const reDecl = /(?:function\s+([A-Za-z_$][\w$]*))|(?:(?:var|let|const)\s+([A-Za-z_$][\w$]*))|(?:\b([A-Za-z_$][\w$]*)\s*[:=]\s*function)/g;
  while ((m = reDecl.exec(src))) declared.add(m[1] || m[2] || m[3]);
  // function parameters (rough): inside function (...) lists
  const reParams = /function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g;
  while ((m = reParams.exec(src))) {
    m[1].split(',').forEach(p => { const n = p.trim().split(/[\s=]/)[0]; if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n); });
  }
  const calls = new Map();
  const reCall = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = reCall.exec(src))) {
    const name = m[2];
    if (BUILTIN.has(name) || declared.has(name)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    if (!calls.has(name)) calls.set(name, []);
    calls.get(name).push(line);
  }
  console.log('=== ' + f);
  if (!calls.size) console.log('  (no unresolved calls)');
  for (const [name, lines] of calls) console.log('  UNRESOLVED ' + name + ' @ lines ' + lines.join(','));
}
