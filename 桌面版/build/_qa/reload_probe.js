const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_reload_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9811', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9811/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1&subject=chem' });
  await sleep(3500);
  const btn = await evalj('document.getElementById("reloadBtn") ? document.getElementById("reloadBtn").textContent : "none"');
  console.log('RELOAD_BTN=' + btn);
  await evalj('document.getElementById("reloadBtn").click(); "ok"');
  await sleep(3500);
  const url = await evalj('location.href');
  const db = await evalj('window.CUR_SUBJECT');
  console.log('AFTER_URL=' + url + ' SUBJ=' + db);
  edge.kill();
}
main();
