// Probe3: canvas pan + wheel zoom after demo scene
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_gl3_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9871', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9871/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EX:' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result ? r.result.value : undefined; };
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(3500);
  await evalj('window.__guanlanTest.open(); window.__guanlanTest.applyDemo("general-postman", {}); "ok"');
  await sleep(300);
  await evalj('window.__guanlanTest.engine().pause(); "ok"');
  const camBefore = await evalj('(function(){var e=window.__guanlanTest.engine(); return JSON.stringify({ox:e.__gl ? "n/a" : "n/a", isDrag:e.isDragging()});})()');
  // simulate empty-canvas drag: pointerdown at (450,300) move to (500,330)
  const dragRes = await evalj('(function(){var cv=document.getElementById("glCanvas"); function ev(t,x,y){ cv.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x+ cv.getBoundingClientRect().left, clientY:y+cv.getBoundingClientRect().top, pointerId:1, button:0})); } ev("pointerdown",450,300); ev("pointermove",480,320); ev("pointerup",480,320); return "ok";})()');
  console.log('DRAG_DISPATCH=' + dragRes + ' ' + camBefore);
  console.log('API_PAN=' + await evalj('typeof window.__guanlanTest.engine().panByPx') + ' ZOOM=' + await evalj('typeof window.__guanlanTest.engine().zoomAt') + ' SETVP=' + await evalj('typeof window.__guanlanTest.engine().setViewPan'));
  // wheel zoom
  await evalj('(function(){var cv=document.getElementById("glCanvas"); var r=cv.getBoundingClientRect(); cv.dispatchEvent(new WheelEvent("wheel",{bubbles:true,cancelable:true,clientX:r.left+450,clientY:r.top+300,deltaY:-240})); return "ok";})()');
  await sleep(200);
  const st = await evalj('window.__guanlanTest.engine().getState()');
  console.log('STATE_AFTER=' + JSON.stringify(st));
  edge.kill();
}
main();
