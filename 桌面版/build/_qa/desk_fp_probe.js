// Desktop-viewport check: the visible credit line on the intro must paint at 1440x900,
// the intro's QQ group line (交流 QQ 群：1126399720) must actually render -- asserted on the
// live DOM + computed style + hit-testing, never on the source string,
// the runtime fingerprint constant must be present, and the console must stay clean.
// Edge always runs headless.
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SPORT = process.argv[2] || '8931';
const SHOT_DIR = process.argv[3] || path.join(os.tmpdir(), 'qg_desk_fp_shots');
const PROFILE = path.join(os.tmpdir(), 'qg_desk_fp_prof');
const DPORT = 9960 + Math.floor(Math.random() * 30);

const results = [];
function check(name, ok, extra) { results.push({ name, ok, extra }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' :: ' + extra : '')); }
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
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
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
    (function poll() { Promise.resolve().then(fn).then(v => { if (v) resolve(v); else if (Date.now() - t0 > timeout) reject(new Error('timeout')); else setTimeout(poll, step); }).catch(reject); })();
  });
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + DPORT, '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'
  ], { stdio: 'ignore' });
  let c;
  try {
    c = await CDP.connect(DPORT);
    const errors = [];
    c.send('Runtime.enable'); c.send('Log.enable'); c.send('Page.enable');
    c.ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      let t = '';
      if (m.method === 'Runtime.exceptionThrown') t = m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : (m.params.exceptionDetails.text || '');
      else if (m.method === 'Log.entryAdded') t = m.params.entry.text || '';
      if (t) errors.push(String(t));
    });
    await c.send('Page.navigate', { url: 'http://127.0.0.1:' + SPORT + '/index.html' });
    await waitFor(() => c.eval('!!document.querySelector(".intro-credit")'));
    // the credit fades in at 6.4s (1.6s ease) -- wait for the animation to actually finish
    // instead of sampling a fixed instant, so a slow headless start cannot fake a failure
    await waitFor(() => c.eval('(function(){var e=document.querySelector(".intro-credit");return e && parseFloat(getComputedStyle(e).opacity) > 0.99;})()'), 20000, 250);
    await sleep(300);
    const vis = await c.eval(`(function(){
      var e=document.querySelector(".intro-credit"); var cs=getComputedStyle(e), r=e.getBoundingClientRect();
      return {txt:e.textContent.trim(), file:'index.html', op:cs.opacity, fs:cs.fontSize, color:cs.color,
              rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
              onScreen:(r.top>=0 && r.bottom<=innerHeight && r.width>0 && r.height>0)};
    })()`);
    check('desktop intro credit painted', vis && parseFloat(vis.op) > 0.9 && vis.onScreen === true, JSON.stringify(vis));

    // 开屏 QQ 群：必须真的渲染出来才算过。判据全部取自"活页面"——
    //   ① DOM 文本里要有 1126399720（不是去读源码字符串）
    //   ② 计算样式 opacity 已渐显完成（.intro-group 走 introHint 动画，6.1s 起 1.4s）
    //   ③ 元素矩形在视口内且非零
    //   ④ 对它自己中心点做命中测试：elementFromPoint 必须命中它（或其子节点）——
    //      这一条能抓住"存在但被遮挡/被 display:none 之外的方式藏起来"的假绿
    await waitFor(() => c.eval('!!document.querySelector(".intro-group")'));
    await waitFor(() => c.eval('(function(){var e=document.querySelector(".intro-group");return e && parseFloat(getComputedStyle(e).opacity) > 0.99;})()'), 25000, 250);
    await sleep(300);
    const grp = await c.eval(`(function(){
      var e=document.querySelector(".intro-group"); if(!e) return null;
      var cs=getComputedStyle(e), r=e.getBoundingClientRect();
      var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
      var topEl=document.elementFromPoint(cx,cy);
      return {txt:e.textContent.replace(/\\s+/g,''), op:cs.opacity, vis:cs.visibility, disp:cs.display,
              rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
              onScreen:(r.top>=0 && r.bottom<=innerHeight && r.width>0 && r.height>0),
              uncovered: !!(topEl && (topEl===e || e.contains(topEl) || topEl===e.querySelector('b'))),
              topTag: topEl ? (topEl.tagName + (topEl.className ? '.'+topEl.className : '')) : null};
    })()`);
    check('desktop intro QQ group rendered', !!grp && grp.txt.indexOf('1126399720') >= 0 && parseFloat(grp.op) > 0.9 && grp.onScreen === true && grp.uncovered === true, JSON.stringify(grp));

    check('desktop runtime fingerprint constant', (await c.eval('window.__QG_ORIGIN')) === 'QG-20260920-5e5d5a', String(await c.eval('window.__QG_ORIGIN')));
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const r = await c.send('Page.captureScreenshot', { format: 'png' });
    const f = path.join(SHOT_DIR, 'desktop_1440x900_intro.png');
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
    console.log('SHOT ' + f + ' (' + fs.statSync(f).size + ' bytes)');
    await sleep(400);
    const bad = errors.filter(e => !/404|Failed to load resource|favicon|net::|ERR_|manifest/i.test(e));
    check('0 console exceptions', bad.length === 0, 'n=' + bad.length + (bad[0] ? ' :: ' + bad[0].slice(0, 200) : ''));
  } catch (e) {
    check('harness error', false, String(e && e.message || e).slice(0, 300));
  } finally { if (c) c.close(); edge.kill(); }
  const fails = results.filter(r => !r.ok);
  console.log('==== DESKTOP intro check: ' + (results.length - fails.length) + '/' + results.length + ' passed ====');
  process.exit(fails.length ? 1 : 0);
}
main();
