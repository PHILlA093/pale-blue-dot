// Probe: uncheck calculus -> select a visible geometry point -> inspect hidden & visible recs
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_state_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9791', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9791/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EX:' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result ? r.result.value : undefined; };
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(4000);
  // find ids
  const ids = await evalj('(function(){var c={},g={}; MATH_DB.points.forEach(function(p){ if(p.board==="calculus") c[p.id]=p.name; }); MATH_DB.points.forEach(function(p){ if(g.calc==null&&p.board!=="calculus") { g.calc=p.id; g.name=p.name; } }); return {calc:Object.keys(c), other:g};})()');
  console.log('IDS=' + JSON.stringify(ids));
  const calc0 = ids.calc[0];
  // uncheck calculus
  await evalj('(function(){var its=document.querySelectorAll("#boardList .board-item"); for(var i=0;i<its.length;i++){var t=(its[i].querySelector(".b-name").textContent||""); if(t.indexOf("函数与导数")>=0){ if(its[i].querySelector("input").checked) its[i].querySelector("input").click(); return true;}} return false;})()');
  await sleep(300);
  const afterUncheckCalc = await evalj('window.__qg3D.recOf("' + calc0 + '")');
  console.log('HIDDEN_CALC_AFTER_UNCHECK=' + JSON.stringify(afterUncheckCalc));
  // select a point in another board (visible)
  await evalj('window.__qg3D.select("' + ids.other.calc + '")');
  await sleep(900);
  const afterSel = await evalj('window.__qg3D.recOf("' + calc0 + '")');
  console.log('HIDDEN_CALC_AFTER_SELECT=' + JSON.stringify(afterSel));
  const colorsAfter = await evalj('(function(){var m={}; MATH_DB.points.forEach(function(p){ if(p.board!=="calculus"){ var r=window.__qg3D.recOf(p.id); if(!m[r.outerColor]) m[r.outerColor]=0; m[r.outerColor]++; } }); return m;})()');
  console.log('VISIBLE_COLORS_AFTER=' + JSON.stringify(colorsAfter));
  // select hidden-board point via API directly (search-like bypass) -> board should auto re-check
  await evalj('(function(){var its=document.querySelectorAll("#boardList .board-item"); for(var i=0;i<its.length;i++){var t=(its[i].querySelector(".b-name").textContent||""); if(t.indexOf("函数与导数")>=0){ if(its[i].querySelector("input").checked) its[i].querySelector("input").click(); return true;}} return false;})()');
  await sleep(200);
  const autoRe = await evalj('window.__qg3D.select("' + calc0 + '"); "ok"');
  await sleep(700);
  const afterAuto = await evalj('window.__qg3D.recOf("' + calc0 + '")');
  console.log('AFTER_AUTO_RECHECK=' + JSON.stringify(afterAuto));
  edge.kill();
}
main();
