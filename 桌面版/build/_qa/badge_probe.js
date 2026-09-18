// Probe: badge mapping local/web/memory incl noLocal downgrade
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_badge_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9773', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9773/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/train.html' });
  await sleep(3000);
  const math = await evalj('(function(){window.__trainTest.renderQuestions([{type:"解答",difficulty:5,stem:"题",options:null,answer:"a",analysis:"",source:"真题·2016全国卷I"}], false); var c=document.querySelector(".qcard"); return {badge: c.querySelector(".q-gk,.q-mem,.q-web")?c.querySelector(".q-gk,.q-mem,.q-web").className:"" , src: c.querySelector(".q-src").textContent};})()');
  console.log('MATH_LOCAL=' + JSON.stringify(math));
  const chem = await evalj('(function(){window.__trainTest.renderQuestions([{type:"解答",difficulty:5,stem:"题",options:null,answer:"a",analysis:"",source:"真题·2016全国卷I"}], true); var c=document.querySelector(".qcard"); return {badge: c.querySelector(".q-gk,.q-mem,.q-web")?c.querySelector(".q-gk,.q-mem,.q-web").className:"" , src: c.querySelector(".q-src").textContent};})()');
  console.log('CHEM_LOCAL_DOWNGRADE=' + JSON.stringify(chem));
  const web = await evalj('(function(){window.__trainTest.renderQuestions([{type:"解答",difficulty:5,stem:"题",options:null,answer:"a",analysis:"",source:"联网·2016全国卷I(学科网)"}], true); var c=document.querySelector(".qcard"); return {badge: c.querySelector(".q-gk,.q-mem,.q-web")?c.querySelector(".q-gk,.q-mem,.q-web").className:"" , src: c.querySelector(".q-src").textContent};})()');
  console.log('WEB=' + JSON.stringify(web));
  edge.kill();
}
main();
