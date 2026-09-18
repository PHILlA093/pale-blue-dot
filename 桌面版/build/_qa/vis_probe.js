// Visual probe: colors & dot presence before/after unchecking a board
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const outBase = process.argv[2] || 'E:\\workspace\\qg_probe_shot';
  const PROFILE = path.join(os.tmpdir(), 'qg_vis_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9781', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9781/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(4000);
  // expand first side section so checkbox is visible (also verified clickable via DOM anyway)
  await evalj('(function(){var h=document.querySelector("#leftPanel .side-sec .sec-head"); if(h) h.click();})()');
  await sleep(300);
  const shot = async fn => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(fn, Buffer.from(r.data, 'base64'));
  };
  await shot(outBase + '_A_on.png');
  const nBefore = await evalj('(function(){var s=0; document.querySelectorAll("#boardList .board-item input").forEach(function(c){ if(c.checked) s++; }); return s;})()');
  // uncheck board #1 (calculus)
  await evalj('document.querySelectorAll("#boardList .board-item input")[1].click(); "ok"');
  await sleep(1200);
  await shot(outBase + '_B_off.png');
  const nAfter = await evalj('(function(){var s=0; document.querySelectorAll("#boardList .board-item input").forEach(function(c){ if(c.checked) s++; }); return s;})()');
  console.log('CHECKED_BEFORE=' + nBefore + ' AFTER=' + nAfter);
  edge.kill();
}
main();
