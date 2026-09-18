// Probe: re-checking a board restores proper colors/visibility in current mode
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_recheck_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9797', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9797/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(4000);
  const toggleCalc = '(function(){var its=document.querySelectorAll("#boardList .board-item"); for(var i=0;i<its.length;i++){var t=(its[i].querySelector(".b-name").textContent||""); if(t.indexOf("函数与导数")>=0){ its[i].querySelector("input").click(); return true;}} return false;})()';
  // default mode: uncheck -> recheck -> rec should be visible, colored (not grey), full label on
  await evalj(toggleCalc); await sleep(350);
  await evalj(toggleCalc); await sleep(500);
  const d1 = await evalj('window.__qg3D.recOf("calc-limit")');
  console.log('DEFAULT_RECHECK=' + JSON.stringify(d1));
  // selection mode: select other-board point -> uncheck calc -> recheck calc while selected
  await evalj('window.__qg3D.select("solid-structure")'); await sleep(800);
  await evalj(toggleCalc); await sleep(300);
  await evalj(toggleCalc); await sleep(600);
  const d2 = await evalj('window.__qg3D.recOf("calc-limit")');
  console.log('SELECTED_RECHECK=' + JSON.stringify(d2));
  // deselect -> all bright again
  await evalj('window.__qg3D.deselect()'); await sleep(600);
  const d3 = await evalj('window.__qg3D.recOf("calc-limit")');
  console.log('AFTER_DESELECT=' + JSON.stringify(d3));
  edge.kill();
}
main();
