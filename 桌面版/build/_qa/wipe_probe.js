// Headless probe: does train.html?wipe=1 trigger __apiClear (no-host path)?
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_wipe_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9753', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9753/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/train.html?wipe=1' });
  await sleep(4500);
  const st = await evalj('document.getElementById("status").textContent');
  const title = await evalj('document.title');
  const clearFn = await evalj('typeof window.__apiClear');
  console.log('STATUS=' + st);
  console.log('TITLE=' + title);
  console.log('HAS_CLEAR_FN=' + clearFn);
  edge.kill();
}
main();
