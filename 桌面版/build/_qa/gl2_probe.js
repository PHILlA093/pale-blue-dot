// Probe2: toolbar visible on open, demo btn, detach handoff, standalone boot
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const PROFILE = path.join(os.tmpdir(), 'qg_gl2_probe');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9861', '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60; i++) { try { const l = await getJson('http://127.0.0.1:9861/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalj = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EX:' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result ? r.result.value : undefined; };
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?skip=1' });
  await sleep(3500);
  await evalj('window.__guanlanTest.open(); "ok"');
  await sleep(300);
  console.log('TOOLBAR_VISIBLE=' + await evalj('!document.getElementById("glToolbar").hidden'));
  console.log('DEMO_BTN=' + await evalj('!!document.getElementById("glDemoBtn")'));
  console.log('PLAY_DISABLED=' + await evalj('document.getElementById("glPlayBtn").disabled'));
  console.log('STATE_TXT=' + await evalj('document.getElementById("glDemoState").textContent'));
  console.log('HEAD_CURSOR=' + await evalj('getComputedStyle(document.getElementById("glHead")).cursor'));
  // simulate conversation then detach
  await evalj('localStorage.setItem("qg_ds_key","sk-fake-x"); window.__oldFetch=window.fetch; window.fetch=function(){return Promise.reject(new Error("net-off"));}; window.__guanlanTest.send("讲讲将军饮马"); "ok"');
  await sleep(2000);
  const before = await evalj('window.__guanlanTest.state().convLen');
  const cap = await evalj('(function(){ window.__openLog=[]; var o=window.open; window.open=function(u,n){ window.__openLog.push({u:u,n:n}); return null; }; document.getElementById("glDetach").click(); window.open=o; return window.__openLog; })()');
  console.log('DETACH_URL=' + JSON.stringify(cap));
  console.log('CONV_BEFORE=' + before + ' HANDOFF=' + await evalj('(function(){try{return !!localStorage.getItem("qg_guanlan_conv");}catch(e){return false;}})()'));
  // standalone boot with handoff
  // 真实桌面版是 window.open 到"另一个原生窗口",发起页不会卸载;
  // 而这里用"同页跳转"模拟,跳转会让发起页触发 pagehide,
  // 其清理逻辑会先把 qg_guanlan_conv 删掉 —— 那测的就不是握手本身了。
  // 因此跳转前把 removeItem 对握手键屏蔽掉,还原真实时序。
  const convUrl = cap[0].u;
  await evalj('(function(){try{var o=localStorage.removeItem.bind(localStorage);localStorage.removeItem=function(k){if(k==="qg_guanlan_conv")return;return o(k);};}catch(e){}return "patched";})()');
  await evalj('location.href="http://127.0.0.1:8931/' + convUrl + '"; "nav"');
  await sleep(3500);
  console.log('SA_VISIBLE=' + await evalj('!document.getElementById("guanlan").hidden'));
  console.log('SA_POS=' + await evalj('getComputedStyle(document.getElementById("guanlan")).position'));
  console.log('SA_CONV=' + await evalj('window.__guanlanTest ? window.__guanlanTest.state().convLen : -1'));
  console.log('SA_TOOLBAR=' + await evalj('!document.getElementById("glToolbar").hidden'));
  console.log('SA_CTX=' + await evalj('document.getElementById("glCtx").textContent'));
  edge.kill();
}
main();
