// Headless probe: intro must show on clean load and be dismissible.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_intro_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9761', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9761/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.enable');
  // clean load, no params
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html' });
  await sleep(900);
  const introVisible = await evalj('(function(){var i=document.getElementById("intro"); if(!i) return "no-intro"; var cs=getComputedStyle(i); return cs.display!=="none" && cs.opacity!=="0";})()');
  const introLive = await evalj('document.documentElement.classList.contains("intro-live")');
  console.log('INTRO_VISIBLE=' + introVisible + ' LIVE=' + introLive);
  const btnEarly = await evalj('(function(){var b=document.getElementById("trainBtn"); if(!b) return "no-btn"; return b.classList.contains("show") + "/" + getComputedStyle(b).opacity + "/" + getComputedStyle(b).pointerEvents;})()');
  console.log('BTN_EARLY=' + btnEarly + ' (expect false/0/none while intro)');
  // dismiss via pointerdown; intro removed & app reveal begins
  await evalj('window.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true})); "ok"');
  await sleep(1600);
  const btnMid = await evalj('(function(){var b=document.getElementById("trainBtn"); if(!b) return "no-btn"; return b.classList.contains("show") + "/" + getComputedStyle(b).opacity;})()');
  console.log('BTN_MID=' + btnMid + ' (expect false/0 during reveal)');
  await sleep(4200);
  const btnLate = await evalj('(function(){var b=document.getElementById("trainBtn"); if(!b) return "no-btn"; return b.classList.contains("show") + "/" + getComputedStyle(b).opacity + "/" + getComputedStyle(b).pointerEvents;})()');
  console.log('BTN_LATE=' + btnLate + ' (expect true/1/auto after full reveal)');
  const introGone = await evalj('!document.getElementById("intro")');
  const appRevealed = await evalj('document.getElementById("app").classList.contains("reveal")');
  console.log('INTRO_GONE=' + introGone + ' APP_REVEALED=' + appRevealed);
  edge.kill();
}
main();
