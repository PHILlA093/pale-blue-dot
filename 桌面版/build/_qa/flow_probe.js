// Probe exact user flow: uncheck B -> select A -> recheck B -> deselect; inspect all
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_flow_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9801', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9801/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(4000);
  const shot = async fn => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(fn, Buffer.from(r.data, 'base64')); };
  const toggleBoard = '(function(name){var its=document.querySelectorAll("#boardList .board-item"); for(var i=0;i<its.length;i++){var t=(its[i].querySelector(".b-name").textContent||""); if(t.indexOf(name)>=0){ its[i].querySelector("input").click(); return its[i].querySelector("input").checked;}} return null;})';
  // B = calculus
  await evalj('window.__qg3D.deselect(); "ok"');
  await evalj(toggleBoard + '("\u51fd\u6570\u4e0e\u5bfc\u6570")');   // uncheck calculus
  await sleep(400);
  await evalj('window.__qg3D.select("solid-structure")');          // select point in another board
  await sleep(900);
  const mid = await evalj('(function(){var s=window.__qg3D.recOf("solid-structure"); return s;})()');
  console.log('MID_SELECT=' + JSON.stringify(mid));
  await evalj(toggleBoard + '("\u51fd\u6570\u4e0e\u5bfc\u6570")');   // recheck calculus
  await sleep(600);
  const re = await evalj('window.__qg3D.recOf("calc-limit")');
  console.log('RECHECKED_CALC=' + JSON.stringify(re));
  await shot('E:\\workspace\\qg_flow_mid.png');
  await evalj('window.__qg3D.deselect()');                          // back to unselected
  await sleep(1800);
  const fin = await evalj('(function(){var sum={on:0,off:0,grey:0}; MATH_DB.points.forEach(function(p){var r=window.__qg3D.recOf(p.id); if(!r) return; if(r.outerVisible) sum.on++; else sum.off++; if(r.outerColor==="#42536e") sum.grey++;}); return sum;})()');
  console.log('FINAL_SUMMARY=' + JSON.stringify(fin));
  const sample = await evalj('window.__qg3D.recOf("calc-limit")');
  console.log('FINAL_CALC=' + JSON.stringify(sample));
  const other = await evalj('window.__qg3D.recOf("solid-structure")');
  console.log('FINAL_OTHER=' + JSON.stringify(other));
  await shot('E:\\workspace\\qg_flow_final.png');
  edge.kill();
}
main();
