// Exact repro: select X -> uncheck all OTHER boards -> recheck all -> deselect
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_exact_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9821', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9821/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async fn => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(fn, Buffer.from(r.data, 'base64')); };
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(4200);
  // 1) select a random point (first point of MATH_DB)
  const selInfo = await evalj('(function(){ var p=MATH_DB.points[5]; var bn=""; MATH_DB.boards.forEach(function(b){ if(b.id===p.board) bn=b.name; }); window.__qg3D.select(p.id); return {id:p.id, board:p.board, boardName:bn}; })()');
  await sleep(1000);
  console.log('SELECTED=' + JSON.stringify(selInfo));
  // 2) uncheck all boards EXCEPT the selected point's board
  await evalj('(function(){var keep="' + selInfo.boardName + '"; var its=document.querySelectorAll("#boardList .board-item"); for(var i=0;i<its.length;i++){var b=(its[i].querySelector(".b-name").textContent||""); if(b.indexOf(keep)>=0) continue; var cb=its[i].querySelector("input"); if(cb.checked) cb.click(); } return "done";})()');
  await sleep(1200);
  const unState = await evalj('window.__qg3D.recOf("' + selInfo.id + '")');
  const hiddenCount = await evalj('(function(){var n=0; MATH_DB.points.forEach(function(p){ var r=window.__qg3D.recOf(p.id); if(r&&!r.outerVisible) n++; }); return n;})()');
  console.log('hiddenAfterUncheck=' + hiddenCount + ' selRec=' + JSON.stringify(unState));
  // 3) recheck all
  await evalj('(function(){var its=document.querySelectorAll("#boardList .board-item"); for(var i=0;i<its.length;i++){ var cb=its[i].querySelector("input"); if(!cb.checked) cb.click(); } return "done";})()');
  await sleep(1200);
  const onAll = await evalj('(function(){var n=0; MATH_DB.points.forEach(function(p){ var r=window.__qg3D.recOf(p.id); if(r&&r.outerVisible) n++; }); return n;})()');
  console.log('VISIBLE_AFTER_RECHECK=' + onAll);
  // 4) deselect
  await evalj('window.__qg3D.deselect()');
  await sleep(2200);   // includes 1.4s insurance restyle
  const fin = await evalj('(function(){var s={on:0,off:0,grey:0,lowOp:0}; MATH_DB.points.forEach(function(p){ var r=window.__qg3D.recOf(p.id); if(!r) return; if(r.outerVisible) s.on++; else s.off++; if(r.outerColor==="#42536e") s.grey++; if(r.outerOpacity<0.5) s.lowOp++; }); return s;})()');
  console.log('FINAL=' + JSON.stringify(fin));
  await shot('E:\\workspace\\qg_exact_final.png');
  edge.kill();
}
main();
