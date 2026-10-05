// Mobile-viewport (390x844) render check for the 穷观 phone build.
// Verifies: intro + visible credit line actually paint, the splash QQ group line
// (1126399720) actually paints too, main UI reveals, 0 console exceptions,
// and the runtime fingerprint constant is present. Edge is always started headless.
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SPORT = process.argv[2] || '8932';
const SHOT_DIR = process.argv[3] || path.join(os.tmpdir(), 'qg_mobile_fp_shots');
const PROFILE = path.join(os.tmpdir(), 'qg_mobile_fp_prof');
const DPORT = 9940 + Math.floor(Math.random() * 40);
const W = 390, H = 844;

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' :: ' + extra : ''));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(port) {
    let tab = null;
    for (let i = 0; i < 80; i++) {
      try { const list = await getJson('http://127.0.0.1:' + port + '/json/list'); tab = list.find(t => t.type === 'page'); if (tab) break; } catch (e) { }
      await sleep(250);
    }
    if (!tab) throw new Error('no tab');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) { const { resolve, reject } = c.pending.get(m.id); c.pending.delete(m.id); if (m.error) reject(new Error(m.error.message)); else resolve(m.result); }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL-ERR: ' + (r.exceptionDetails.exception ? JSON.stringify(r.exceptionDetails.exception.description || r.exceptionDetails.exception) : r.exceptionDetails.text));
    return r.result ? r.result.value : undefined;
  }
  close() { try { this.ws.close(); } catch (e) { } }
}
function waitFor(fn, timeout = 15000, step = 250) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      Promise.resolve().then(fn).then(v => { if (v) resolve(v); else if (Date.now() - t0 > timeout) reject(new Error('timeout')); else setTimeout(poll, step); }).catch(reject);
    })();
  });
}
async function shot(c, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const r = await c.send('Page.captureScreenshot', { format: 'png' });
  const f = path.join(SHOT_DIR, name);
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  console.log('SHOT ' + f + ' (' + fs.statSync(f).size + ' bytes)');
  return f;
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + DPORT, '--user-data-dir=' + PROFILE,
    '--window-size=' + W + ',' + H, 'about:blank'
  ], { stdio: 'ignore' });
  let c;
  try {
    c = await CDP.connect(DPORT);
    const errors = [];
    c.send('Runtime.enable');
    c.send('Log.enable');
    c.send('Page.enable');
    c.ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      let t = '';
      if (m.method === 'Runtime.exceptionThrown') t = m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : (m.params.exceptionDetails.text || '');
      else if (m.method === 'Log.entryAdded') t = m.params.entry.text || '';
      if (t) errors.push(String(t));
    });
    await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 3, mobile: true });

    await c.send('Page.navigate', { url: 'http://127.0.0.1:' + SPORT + '/index.html' });
    await waitFor(() => c.eval('!!document.getElementById("intro")'));

    const vp = await c.eval('JSON.stringify({w:innerWidth,h:innerHeight,dpr:devicePixelRatio})');
    check('mobile viewport 390x844', /"w":390/.test(vp) && /"h":844/.test(vp), vp);

    // intro paints (not skipped) and the visible credit line reaches full opacity
    const creditTxt = await c.eval('(function(){var e=document.querySelector(".intro-credit"); return e?e.textContent.trim():"";})()');
    check('intro credit element exists', creditTxt.length > 0, creditTxt);
    await sleep(7500);
    const creditVis = await c.eval(`(function(){
      var e=document.querySelector(".intro-credit"); if(!e) return null;
      var cs=getComputedStyle(e), r=e.getBoundingClientRect();
      return {op:cs.opacity, disp:cs.display, vis:cs.visibility, fs:cs.fontSize, color:cs.color,
              rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
              onScreen:(r.top>=0 && r.bottom<=innerHeight && r.width>0 && r.height>0)};
    })()`);
    check('intro credit actually painted on screen',
      creditVis && parseFloat(creditVis.op) > 0.9 && creditVis.onScreen === true && creditVis.disp !== 'none',
      JSON.stringify(creditVis));

    // 开屏交流 QQ 群号（2026-10-05 起）：源码里有不算，必须真的渲染出来——
    // 与版权行同款判据：元素存在 + 渐显完成后不透明 + 有尺寸 + 完整落在视口内。
    const groupTxt = await c.eval('(function(){var e=document.querySelector(".intro-group"); return e?e.textContent.trim():"";})()');
    check('intro QQ group line exists', groupTxt.indexOf('1126399720') >= 0, groupTxt);
    const groupVis = await c.eval(`(function(){
      var e=document.querySelector(".intro-group"); if(!e) return null;
      var cs=getComputedStyle(e), r=e.getBoundingClientRect();
      return {op:cs.opacity, disp:cs.display, vis:cs.visibility, fs:cs.fontSize, color:cs.color,
              rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
              onScreen:(r.top>=0 && r.bottom<=innerHeight && r.width>0 && r.height>0)};
    })()`);
    check('intro QQ group actually painted on screen',
      groupVis && parseFloat(groupVis.op) > 0.9 && groupVis.onScreen === true && groupVis.disp !== 'none',
      JSON.stringify(groupVis));
    await shot(c, 'phone_390x844_intro.png');

    const origin = await c.eval('window.__QG_ORIGIN');
    check('runtime fingerprint constant', origin === 'QG-20260920-5e5d5a', String(origin));

    // enter the app
    await c.eval('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})); "ok"');
    await waitFor(() => c.eval('document.getElementById("app") && document.getElementById("app").classList.contains("reveal")'), 20000);
    await sleep(2500);
    const home = await c.eval(`(function(){
      var cv=document.querySelector("#app canvas"), sb=document.getElementById("statBar");
      return {canvas: !!cv, cw: cv?cv.width:0, ch: cv?cv.height:0, stat: sb?sb.textContent.trim().slice(0,60):"",
              nodes: (window.MATH_DB?MATH_DB.points.length:0), subj: window.CUR_SUBJECT||""};
    })()`);
    check('home page renders after intro', home && home.canvas === true && home.nodes > 0 && home.stat.length > 0, JSON.stringify(home));
    await shot(c, 'phone_390x844_home.png');

    await sleep(600);
    const bad = errors.filter(e => !/404|Failed to load resource|favicon|net::|ERR_|Permissions policy|manifest/i.test(e));
    check('0 console exceptions / errors', bad.length === 0, 'n=' + bad.length + (bad[0] ? ' :: ' + bad[0].slice(0, 250) : ''));
  } catch (e) {
    check('harness error', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (c) c.close();
    edge.kill();
  }
  const fails = results.filter(r => !r.ok);
  console.log('==== MOBILE 390x844 probe: ' + (results.length - fails.length) + '/' + results.length + ' passed ====');
  process.exit(fails.length ? 1 : 0);
}
main();
