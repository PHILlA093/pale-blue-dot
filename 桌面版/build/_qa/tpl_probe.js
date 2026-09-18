// 观澜模板库 + AI 现场生成(scene)校验探针
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SPORT = process.argv[2] || '8951';
const PROFILE = process.argv[3] || path.join(os.tmpdir(), 'qg_tpl_qa');
const DPORT = 9910 + Math.floor(Math.random() * 80);

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
    await c.send('Page.navigate', { url: base + '/index.html?subject=math&skip=1' });
    await new Promise((res, rej) => {
      const t0 = Date.now();
      (function poll() {
        c.eval('window.__guanlanTest && window.QG_TEMPLATES ? 1 : 0').then(v => {
          if (v) return res();
          if (Date.now() - t0 > 20000) return rej(new Error('boot timeout'));
          setTimeout(poll, 200);
        }).catch(rej);
      })();
    });
    await c.eval('window.__guanlanTest.open(); 1');
    await sleep(600);

    // 1) 模板清单完整性
    const manifest = await c.eval('window.QG_TEMPLATES.manifest.map(function(t){return t.id;})');
    check('manifest 数量 = 31', manifest.length === 31, 'n=' + manifest.length + ' ids=' + manifest.slice(0, 6).join(',') + '…');
    const builders = await c.eval('Object.keys(window.QG_TEMPLATES.build).length');
    check('每个模板都有 build', builders === manifest.length, 'build=' + builders + ' manifest=' + manifest.length);
    const badMeta = await c.eval(`(function(){
      var m=window.QG_TEMPLATES.manifest, bad=[];
      for (var i=0;i<m.length;i++){
        var t=m[i];
        if (!t.id || !t.name || !t.desc || !t.params || !t.params.length) bad.push(t.id||('#'+i));
      }
      return bad;
    })()`);
    check('模板元数据完整(id/name/desc/params)', badMeta.length === 0, JSON.stringify(badMeta));

    // 2) 逐个模板:能否构建 → 绘制 → 全部图元有效
    const failures = [];
    for (const id of manifest) {
      const r = await c.eval(`JSON.stringify(window.__guanlanTest.applyDemo(${JSON.stringify(id)}, {}))`);
      let apply = null;
      try { apply = JSON.parse(r); } catch (e) { apply = { raw: r }; }
      await sleep(220);
      const st = await c.eval(`(function(){
        var g=window.__gl; if(!g) return {total:-1,ok:-1,notOk:[]};
        var o=g.objects,total=o.length,ok=0,notOk=[];
        for(var i=0;i<total;i++){ if(o[i]._ok) ok++; else notOk.push(o[i].id+':'+o[i].type); }
        return {total:total,ok:ok,notOk:notOk};
      })()`);
      const good = apply && apply.ok && st.total > 0 && st.ok === st.total;
      if (!good) failures.push({ id, apply, st });
      check('模板 ' + id, good, 'objects=' + st.total + ' ok=' + st.ok + (st.notOk.length ? ' notOk=' + st.notOk.slice(0, 5).join('|') : ''));
    }

    // 3) 动画类模板确实在动(u 推进)与静态模板可停住
    const animInfo = await c.eval(`(function(){
      var out=[];
      var ids=['func-quadratic','conic-ellipse','vec-dot-projection','geo-circle-tangent','general-postman'];
      for (var i=0;i<ids.length;i++){
        window.__guanlanTest.applyDemo(ids[i], {});
        out.push({id:ids[i], u:window.__gl.u, playing:window.__gl.playing});
      }
      return out;
    })()`);
    await sleep(500);
    const uAfter = await c.eval('window.__gl.u');
    check('动画相位在推进', uAfter > 0, 'u=' + uAfter + ' last=' + JSON.stringify(animInfo[animInfo.length - 1]));

    // 4) AI 现场生成:合法场景(单位圆 + 正弦线 + 动点)
    //    注意相位偏 0.4:T=(2cosφ,2sinφ) 与 Fx=(2cosφ,0) 在 u=0 时必须不重合。
    //    引擎从 u=0 起播,若 φ=0 则两点重合、sin 线段长度为 0,
    //    在"线段退化不算可绘"的判据下会被正确判为 _ok=false(旧实现只判编译成功,恒真)。
    //    这里偏移相位以保证场景在初始帧就完全可绘,断言因此可以保持"全部图元都可绘"。
    const goodScene = {
      anim: { mode: 'pingpong', dur: 6 },
      defs: [
        { id: 'O', op: 'fixed', x: 0, y: 0 },
        { id: 'T', op: 'fixed', x: '(2*cos(2*PI*u+0.4))', y: '(2*sin(2*PI*u+0.4))' },
        { id: 'Fx', op: 'fixed', x: '(2*cos(2*PI*u+0.4))', y: 0 }
      ],
      objects: [
        { id: 'circ', type: 'circle', c: 'O', r: 2, color: '#4fc3f7' },
        { id: 'rad', type: 'segment', a: 'O', b: 'T', color: '#ffd54f', width: 2 },
        { id: 'sin', type: 'segment', a: 'T', b: 'Fx', color: '#ff8a80', dash: true },
        { id: 'cx', type: 'line', a: { x: -3, y: 0 }, b: { x: 3, y: 0 }, dash: true },
        { id: 'dT', type: 'dot', pt: 'T', color: '#ff8a80', r: 5, label: 'T', drag: 'free' },
        { id: 'cap', type: 'text', at: 'O', text: '单位圆上动点 T:sinθ = 纵坐标,cosθ = 横坐标', offset: { x: 0, y: 34 } },
        { id: 'formula', type: 'text', at: 'Fx', text: 'sin²θ + cos²θ = 1', tex: '$\\sin^2\\theta+\\cos^2\\theta=1$', offset: { x: 0, y: -20 } }
      ]
    };
    const okScene = await c.eval(`JSON.stringify(window.__guanlanTest.applyScene(${JSON.stringify(goodScene)}))`);
    let okParsed = null;
    try { okParsed = JSON.parse(okScene); } catch (e) { okParsed = { raw: okScene }; }
    check('AI 现场生成:合法场景可绘制', okParsed && okParsed.ok === true && okParsed.okObjects >= 7, JSON.stringify(okParsed));

    // 5) AI 现场生成:非法场景必须被拒绝(且不误清空后崩溃)
    //    注意「非法 id」不在此列:id 只是命名问题,现改为**自动归一化并同步改写引用**
    //    (demo.js 的 buildIdPlan/remapScene)—— 否则一个中文 id 就会让整段演示失败,
    //    用户侧看到的就是「动态演示生成失败:objects[0] id 非法」。
    const badScenes = [
      { name: '未知 op', scene: { defs: [{ id: 'A', op: 'teleport', x: 0, y: 0 }], objects: [{ id: 'd', type: 'dot', pt: 'A' }] } },
      { name: '未知图元类型', scene: { defs: [], objects: [{ id: 'x', type: 'cube', a: 1 }] } },
      { name: '缺少必需字段', scene: { defs: [], objects: [{ id: 'd', type: 'dot' }] } },
      { name: '图元数量超限', scene: { defs: [], objects: new Array(120).fill(0).map((_, i) => ({ id: 'd' + i, type: 'dot', pt: { x: i % 10, y: 0 } })) } },
      { name: '空图元', scene: { defs: [], objects: [] } }
    ];
    for (const t of badScenes) {
      const r = await c.eval(`JSON.stringify(window.__guanlanTest.validateScene(${JSON.stringify(t.scene)}))`);
      let parsed = null;
      try { parsed = JSON.parse(r); } catch (e) { parsed = { raw: r }; }
      check('拒绝非法场景:' + t.name, parsed && parsed.ok === false && !!parsed.err, parsed && parsed.err);
    }

    // 5b) 非法/中文 id:必须被修正为可绘制,且引用同步改写
    const idScene = {
      defs: [{ id: '点P', op: 'fixed', x: 0, y: 0 }],
      objects: [{ id: '点A', type: 'dot', pt: '点P', label: 'A' }]
    };
    const rId = await c.eval(`JSON.stringify(window.__guanlanTest.validateScene(${JSON.stringify(idScene)}))`);
    let idParsed = null;
    try { idParsed = JSON.parse(rId); } catch (e) { idParsed = { raw: rId }; }
    check('非法/中文 id 自动修正而非拒绝',
      idParsed && idParsed.ok === true && idParsed.idFixed > 0 &&
      idParsed.scene.defs[0].id === 'P' && idParsed.scene.objects[0].id === 'A' &&
      idParsed.scene.objects[0].pt === 'P',
      JSON.stringify(idParsed).slice(0, 170));

    // 6) 表达式写错时:校验通过但绘制无效 → 必须报错而不是留一张错图
    const brokenExpr = {
      defs: [],
      objects: [{ id: 'curvebad', type: 'curve', fn: 'foo(x)*2', x0: -3, x1: 3 }]
    };
    const rBad = await c.eval(`JSON.stringify(window.__guanlanTest.applyScene(${JSON.stringify(brokenExpr)}))`);
    let badParsed = null;
    try { badParsed = JSON.parse(rBad); } catch (e) { badParsed = { raw: rBad }; }
    const afterClear = await c.eval('window.__gl.objects.length');
    check('表达式错误被拦截并清空画布', badParsed && badParsed.ok === false && afterClear === 0, JSON.stringify(badParsed) + ' objsAfter=' + afterClear);

    // 7) 模板参数可被 AI 覆盖(用一组非默认参数重画)
    const custom = await c.eval(`JSON.stringify(window.__guanlanTest.applyDemo('func-quadratic', {a:'-0.5', h:'2', k:'3'}))`);
    await sleep(200);
    const curveOk = await c.eval(`(function(){
      var g=window.__gl,o=g.objects,found=null;
      for(var i=0;i<o.length;i++){ if(o[i].type==='curve') found=o[i]; }
      return found ? {ok:!!found._ok, fn:found.fn} : null;
    })()`);
    check('模板参数覆盖生效', curveOk && curveOk.ok && /-0\.5/.test(curveOk.fn), JSON.stringify(custom) + ' ' + JSON.stringify(curveOk));

    // 8) 无异常
    await sleep(300);
    const bad = errors.filter(e => !/404|Failed to load resource|favicon|net::|ERR_/.test(e));
    check('no JS exceptions', bad.length === 0, 'n=' + bad.length + (bad[0] ? ' :: ' + bad[0].slice(0, 240) : ''));
    if (failures.length) console.log('FAILURES=' + JSON.stringify(failures, null, 1).slice(0, 4000));
  } catch (e) {
    check('harness error', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (c) c.close();
    edge.kill();
  }
  const fails = results.filter(r => !r.ok);
  console.log('==== TPL probe: ' + (results.length - fails.length) + '/' + results.length + ' passed ====');
  process.exit(fails.length ? 1 : 0);
}
main();
