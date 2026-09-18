// Guanlan demo screenshot probe: capture the math demo canvas for visual inspection
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_demo_shot');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const PORT = 9863;
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
      '--window-size=1440,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:' + PORT + '/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => {
    const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const r = m.result || {};
    if (r.exceptionDetails) return 'EX:' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails.text);
    return r.result ? r.result.value : undefined;
  };
  const shot = async (name) => {
    const m = await send('Page.captureScreenshot', { format: 'png' });
    const data = m.result && m.result.data;
    if (!data) { console.log('SHOT-FAIL ' + name); return; }
    const f = path.join('E:\\workspace\\穷观\\桌面版\\build', name);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    console.log('SHOT ' + f + ' ' + fs.statSync(f).size + 'B');
  };

  await send('Page.enable');
  const SPORT = process.argv[2] || '8933';
  await send('Page.navigate', { url: 'http://127.0.0.1:' + SPORT + '/index.html?subject=math&skip=1' });
  await sleep(4000);
  console.log('SUBJ=' + await evalj('window.CUR_SUBJECT'));
  await evalj('window.__guanlanTest.open(); "ok"');
  await sleep(600);
  console.log('PANEL=' + JSON.stringify(await evalj('window.__guanlanTest.state()')));
  console.log('APPLY=' + JSON.stringify(await evalj('window.__guanlanTest.applyDemo("general-postman", {A:"-4,2", B:"4,3", k:"0"})')));
  await sleep(1500);
  await shot('_demo_math_a.png');
  await sleep(1800);
  await shot('_demo_math_b.png');
  console.log('STATE=' + JSON.stringify(await evalj('window.__guanlanTest.engine() ? window.__guanlanTest.engine().getState() : null')));
  console.log('U=' + await evalj('window.__guanlanTest.engine() ? window.__guanlanTest.engine().__gl.u : null'));
  console.log('LAYOUT=' + JSON.stringify(await evalj('(function(){var cv=document.getElementById("glCanvas"); var r=cv.getBoundingClientRect(); return {w:cv.width,h:cv.height,cssW:Math.round(r.width),cssH:Math.round(r.height),x:Math.round(r.left),y:Math.round(r.top),innerW:window.innerWidth,innerH:window.innerHeight,dpr:window.devicePixelRatio};})()')));
  edge.kill();
}
main();
