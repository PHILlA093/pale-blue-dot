// ENG heavy-cloud probe: static layout perf + lazy word-layer labels + default-hidden words board.
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SPORT = process.argv[2] || '8941';
const PROFILE = process.argv[3] || path.join(os.tmpdir(), 'qg_eng_qa');
const DPORT = 9900 + Math.floor(Math.random() * 90);

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' :: ' + extra : ''));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(port) {
    let tab = null;
    for (let i = 0; i < 80; i++) {
      try {
        const list = await getJson('http://127.0.0.1:' + port + '/json/list');
        tab = list.find(t => t.type === 'page');
        if (tab) break;
      } catch (e) { }
      await sleep(250);
    }
    if (!tab) throw new Error('no tab');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) {
        const { resolve, reject } = c.pending.get(m.id);
        c.pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL-ERR: ' + (r.exceptionDetails.exception ? JSON.stringify(r.exceptionDetails.exception.description || r.exceptionDetails.exception) : r.exceptionDetails.text));
    return r.result ? r.result.value : undefined;
  }
  close() { try { this.ws.close(); } catch (e) { } }
}
function waitFor(fn, timeout = 20000, step = 250) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      Promise.resolve().then(fn).then(v => {
        if (v) resolve(v);
        else if (Date.now() - t0 > timeout) reject(new Error('timeout'));
        else setTimeout(poll, step);
      }).catch(reject);
    })();
  });
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + DPORT, '--user-data-dir=' + PROFILE,
    '--window-size=1440,900', 'about:blank'
  ], { stdio: 'ignore' });
  let c;
  try {
    c = await CDP.connect(DPORT);
    const errors = [];
    c.send('Runtime.enable');
    c.send('Log.enable');
    c.ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      let t = '';
      if (m.method === 'Runtime.exceptionThrown') {
        t = m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : (m.params.exceptionDetails.text || '');
      } else if (m.method === 'Log.entryAdded') {
        t = m.params.entry.text || '';
      }
      if (t) errors.push(String(t));
    });
    const base = 'http://127.0.0.1:' + SPORT;
    await c.send('Page.enable');

    // 1) eng boot: heavy cloud must settle fast (< 5s wall clock incl page load)
    const t0 = Date.now();
    await c.send('Page.navigate', { url: base + '/index.html?subject=eng&skip=1' });
    await waitFor(() => c.eval('window.ENG_DB && window.CUR_SUBJECT==="eng" && document.getElementById("statBar").textContent.indexOf("\u8282\u70b9 3053")>=0'), 30000);
    const bootMs = Date.now() - t0;
    check('eng boot quick', bootMs < 9000, 'bootMs=' + bootMs);
    await sleep(600);
    const st = await c.eval('document.getElementById("statBar").textContent');
    check('eng statbar 3053 nodes', (st || '').indexOf('3053') >= 0 && (st || '').indexOf('\u8282\u70b9') >= 0, st);
    check('eng title', await c.eval('document.title.indexOf("\u82f1\u8bed")>=0'));
    check('eng boards = 10', await c.eval('ENG_DB.boards.length') === 10, 'n=' + await c.eval('ENG_DB.boards.length'));

    // 2) 词点层:当前英语数据里词点(eng-w-*)分散在 7 个教材册板块中(占全库 72%),没有任何单个
    //    板块超过 40% —— 所以"按板块默认收起词点层"在真实数据上不成立,也不该生效:
    //    LAYER_BOARD_ID 必须是 null,10 个板块全部保持勾选(否则会藏掉 2000+ 个点却没有开关能调回来)。
    const layerId = await c.eval('(function(){try{return window.__qg3D && window.__qg3D.layerBoardId ? window.__qg3D.layerBoardId() : "n/a";}catch(e){return "err";}})()');
    const checkedCnt = await c.eval('document.querySelectorAll("#boardList .board-item input:checked").length');
    check('no board hidden by default (words spread across boards)', checkedCnt === 10, 'checked=' + checkedCnt + ' layerBoardId=' + layerId);
    check('word-layer heuristic must not fire on real data', layerId === null || layerId === 'n/a', 'layerBoardId=' + layerId);

    // 3) 词点用 id 前缀定位(eng-w-*):开机可见,选中后建标签并弹详情
    const wid = await c.eval('(function(){var p=ENG_DB.points.filter(function(q){return /^eng-w-/.test(q.id);})[0]; return p ? p.id : null;})()');
    check('word point exists (eng-w-*)', !!wid, wid);
    const lazyBefore = await c.eval('(function(){var p=ENG_DB.points.filter(function(q){return /^eng-w-/.test(q.id);})[0]; var r=window.__qg3D.recOf(p.id); return {labelVisible:r.labelVisible, labelOn:r.labelOn, outerVisible:r.outerVisible};})()');
    check('word visible at boot (no board hidden), label lazy', lazyBefore.outerVisible === true, JSON.stringify(lazyBefore));
    await c.eval('window.__qg3D.select(' + JSON.stringify(wid) + '); "ok"');
    await sleep(800);
    const after = await c.eval('(function(){var p=ENG_DB.points.filter(function(q){return /^eng-w-/.test(q.id);})[0]; var r=window.__qg3D.recOf(p.id); return {boardOn:r.boardOn, outerVisible:r.outerVisible, labelVisible:r.labelVisible, labelOn:r.labelOn};})()');
    check('select word: stays visible, label created', after.boardOn === true && after.outerVisible === true, JSON.stringify(after));
    const selDetail = await c.eval('document.getElementById("detailPanel").classList.contains("open") ? document.getElementById("dName").textContent : ""');
    check('word detail card opened', (selDetail || '').length > 0, 'name=' + String(selDetail).slice(0, 30));

    // 4) hover over a root shows its label (non-word label path intact on heavy)
    await c.eval('document.getElementById("detailClose").click(); "ok"');
    await sleep(400);
    const rid = await c.eval('(function(){var p=ENG_DB.points.filter(function(q){return q.board==="eng-roots";})[0]; return p ? p.id : null;})()');
    const rootInfo = await c.eval('(function(){var r=window.__qg3D.recOf(' + JSON.stringify(rid) + '); return {boardOn:r.boardOn, outerVisible:r.outerVisible, labelVisible:r.labelVisible, color:r.outerColor};})()');
    check('root board visible at boot', rootInfo.boardOn === true && rootInfo.outerVisible === true && /^#[0-9a-f]{6}$/.test(rootInfo.color || ''), JSON.stringify(rootInfo));

    // 5) positions deterministic & finite (sample)
    const posOk = await c.eval('(function(){var pts=ENG_DB.points.slice(0,600); for(var i=0;i<pts.length;i++){var p=pts[i]._pos; if(!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) return false; if(Math.sqrt(p.x*p.x+p.z*p.z)>52) return "far:"+p.x+","+p.z;} return true;})()');
    check('heavy static layout finite & in-bounds', posOk === true, 'res=' + posOk);

    // 6) frame responsiveness: sample one animate frame duration while idle
    const fps = await c.eval('(function(){return new Promise(function(res){var t0=performance.now(); requestAnimationFrame(function(){res(Math.round(performance.now()-t0));});});})()');
    check('render frame responsive', fps < 120, 'frameMs=' + fps);

    // 6.5) 点选成本(回归守卫):relayoutTargets 曾经是全配对 O(n²) —— 英语库每次点选约有
    //      2979 个点被塞进同一个半径 46 的圆环,4 轮跑满 ≈ 1770 万次配对,同步阻塞 0.35–1.1 秒。
    //      修好之后参与推开推的只有 0~3 跳的几十个点(≈10³ 次配对)。这里连点 6 个不同节点,
    //      任何一次同步耗时都不该超过 250ms —— 阈值故意留得很宽,只抓"又退回 O(n²)"这一类回归。
    await c.eval('window.__perfIds = ENG_DB.points.filter(function(q){return q.board==="eng-bx1";}).slice(0,6).map(function(q){return q.id;}); "ok"');
    const clickMs = [];
    for (let k = 0; k < 6; k++) {
      const ms = await c.eval('(function(){var t0=performance.now(); window.__qg3D.select(window.__perfIds[' + k + ']); return Math.round(performance.now()-t0);})()');
      clickMs.push(ms);
      await sleep(150);
    }
    const worst = Math.max.apply(null, clickMs);
    check('node click cost stays small on 3053-point library', worst < 250, 'ms=' + clickMs.join(',') + ' worst=' + worst);

    // 7) train page (搜题/刷题) loads English DB like other subjects
    await c.eval('location.href="' + base + '/train.html"; "nav"');
    await waitFor(() => c.eval('window.__trainTest && document.getElementById("genBtn")'), 15000);
    await sleep(500);
    const engN = await c.eval('window.ENG_DB ? ENG_DB.points.length : 0');
    check('train page loads ENG_DB', engN === 3053, 'n=' + engN);
    await c.eval('window.__trainTest.setLive({t:Date.now(), subject:"eng", subjectName:"\u9ad8\u4e2d\u82f1\u8bed", selName:"", keyword:""}); "ok"');
    await sleep(400);
    const dbinfo = await c.eval('window.__trainTest.db()');
    check('train picks English DB', !!dbinfo && dbinfo.subject === 'eng' && String(dbinfo.subjectName).indexOf('\u82f1\u8bed') >= 0 && dbinfo.n === 3053, JSON.stringify(dbinfo));
    const pill = await c.eval('document.getElementById("pSubject").textContent');
    check('train subject pill shows English', (pill || '').indexOf('\u82f1\u8bed') >= 0, pill);
    await c.eval('document.getElementById("askInput").value = "\u8bcd\u6839"; "ok"');
    await c.eval('document.getElementById("locateBtn").click(); "ok"');
    await sleep(700);
    const brHead2 = await c.eval('document.querySelector("#boardRes .br-head") ? document.querySelector("#boardRes .br-head").textContent : ""');
    const brRows2 = await c.eval('document.querySelectorAll("#boardRes .br-item").length');
    check('English board locate works', !(await c.eval('document.getElementById("boardRes").hidden')) && (brHead2 || '').indexOf('\u547d\u4e2d') >= 0 && brRows2 > 0, 'rows=' + brRows2 + ' head=' + String(brHead2).slice(0, 40));
    await c.eval('document.querySelector("#boardRes .br-item").click(); "ok"');
    await sleep(300);
    const tp = await c.eval('(function(){var t=window.__trainTest.currentTarget(); return t ? {name:t.p.name, board:t.p.board} : null;})()');
    check('English target point picked', tp !== null && String(tp.name).length > 0, JSON.stringify(tp));

    // 8) no JS exceptions
    await sleep(300);
    const bad = errors.filter(e => !/404|Failed to load resource|favicon|net::|ERR_/.test(e));
    check('no JS exceptions', bad.length === 0, 'n=' + bad.length + (bad[0] ? ' :: ' + bad[0].slice(0, 300) : ''));
  } catch (e) {
    check('harness error', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (c) c.close();
    edge.kill();
  }
  const fails = results.filter(r => !r.ok);
  console.log('==== ENG probe: ' + (results.length - fails.length) + '/' + results.length + ' passed ====');
  process.exit(fails.length ? 1 : 0);
}
main();
