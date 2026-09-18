// Guanlan canvas smoke: apply 将军饮马 via applyDemo, verify engine state + painted pixels
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_gl_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9851', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9851/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EX:' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result ? r.result.value : undefined; };
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(3500);
  console.log('GL_TYPEOF=' + await evalj('typeof window.GL'));
  console.log('TPL_MANIFEST=' + await evalj('window.QG_TEMPLATES ? window.QG_TEMPLATES.manifest.length : -1'));
  await evalj('window.__guanlanTest.open(); "ok"');
  await evalj('document.getElementById("glCanvas").width = 900; document.getElementById("glCanvas").height = 600; "ok"');
  const r = await evalj('window.__guanlanTest.applyDemo("general-postman", {A:"-4,2", B:"4,3", k:"0"})');
  console.log('APPLY=' + JSON.stringify(r));
  await sleep(300);
  const st = await evalj('window.__guanlanTest.engine().getState()');
  console.log('STATE=' + JSON.stringify(st));
  // force a few frames at u mid: step
  console.log('STEP=' + await evalj('window.__guanlanTest.engine().step(1)') + ' U=' + await evalj('window.__guanlanTest.engine().__gl.u'));
  await sleep(250);
  const pixels = await evalj('(function(){var cv=document.getElementById("glCanvas"); try{ var c=cv.getContext("2d"); var d=c.getImageData(0,0,cv.width,cv.height).data; var n=0; for(var i=0;i<d.length;i+=4){ if(d[i]>60||d[i+1]>60||d[i+2]>60) n++; } return {w:cv.width,h:cv.height,lit:n}; }catch(e){ return {err:String(e)}; }})()');
  console.log('PIXELS=' + JSON.stringify(pixels));
  const ui = await evalj('JSON.stringify({tb: !document.getElementById("glToolbar").hidden, tip: getComputedStyle(document.getElementById("glStageTip")).display, state: document.getElementById("glDemoState").textContent})');
  console.log('UI=' + ui);
  console.log('PAUSE=' + await evalj('window.__guanlanTest.engine().pause()'));
  console.log('CLEAR=' + await evalj('window.__guanlanTest.engine().clear()') + ' OBJ_AFTER=' + await evalj('window.__guanlanTest.engine().getState().objects'));
  edge.kill();
}
main();
