// Guanlan stage-1 smoke: open/close, key row, send error path, memory-only, no-host
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_guanlan_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9841', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9841/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EX:' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result ? r.result.value : undefined; };
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(3500);
  console.log('OPEN_BTN=' + await evalj('!!document.getElementById("guanlanOpen")'));
  console.log('OPEN=' + await evalj('window.__guanlanTest ? window.__guanlanTest.open() : "no-api"'));
  console.log('VISIBLE=' + await evalj('!document.getElementById("guanlan").hidden'));
  console.log('CTX=' + await evalj('document.getElementById("glCtx").textContent'));
  // no key -> send -> key row appears
  await evalj('localStorage.removeItem("qg_ds_key"); "ok"');
  await evalj('document.getElementById("glAsk").value="\u4ec0\u4e48\u662f\u5bfc\u6570"; document.getElementById("glSend").click(); "ok"');
  await sleep(400);
  console.log('KEYROW_SHOWN=' + await evalj('!document.getElementById("glKeyRow").hidden'));
  console.log('CONV0=' + await evalj('window.__guanlanTest.state().convLen'));
  // with fake key + broken net: assistant error bubble shown, conv has user only
  await evalj('localStorage.setItem("qg_ds_key","sk-fake-x"); window.__oldFetch=window.fetch; window.fetch=function(){return Promise.reject(new Error("net-off"));}; document.getElementById("glAsk").value="\u89e3\u91ca\u5bfc\u6570"; document.getElementById("glSend").click(); "ok"');
  await sleep(2500);
  console.log('STATE=' + await evalj('JSON.stringify(window.__guanlanTest.state())'));
  console.log('ERR_BUBBLE=' + await evalj('(function(){var m=document.querySelectorAll("#glMsgs .gl-msg"); var n=0; m.forEach(function(x){ if(x.className.indexOf("err")>=0) n++; }); return n;})()'));
  console.log('CLEAR=' + await evalj('window.__guanlanTest.clear()'));
  console.log('CONV_AFTER_CLEAR=' + await evalj('window.__guanlanTest.state().convLen'));
  // close keeps memory? (we cleared) then reopen & type works; reload resets
  console.log('CLOSE=' + await evalj('window.__guanlanTest.close()'));
  console.log('VIS2=' + await evalj('document.getElementById("guanlan").hidden'));
  edge.kill();
}
main();
