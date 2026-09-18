// Frame-by-frame audit of the 观澜 demo scene: every object's computed state + painted element counts
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const SPORT = process.argv[2] || '8936';
  const PROFILE = path.join(os.tmpdir(), 'qg_demo_frames');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const PORT = 9877;
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
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
  const counts = `(function(){
    var cv=document.getElementById('glCanvas'); var c=cv.getContext('2d');
    var d=c.getImageData(0,0,cv.width,cv.height).data;
    var out={gold:0,gray:0,coral:0,cyan:0,text:0};
    for(var i=0;i<d.length;i+=4){
      var r=d[i],g=d[i+1],b=d[i+2];
      if(r>225&&g>180&&g<240&&b<120) out.gold++;
      else if(r>250&&g>180&&g<215&&b<150) out.coral++;
      else if(r>120&&r<200&&g>130&&g<195&&b>165&&b<225) out.gray++;
      else if(r>55&&r<105&&g>180&&g<220&&b>235) out.cyan++;
      else if(r>215&&g>225&&b>240) out.text++;
    }
    return out;
  })()`;
  const objState = `(function(){
    var gl=window.__gl; if(!gl) return null;
    var o=gl.objects, out=[];
    for(var i=0;i<o.length;i++){
      out.push({id:o[i].id,type:o[i].type,ok:!!o[i]._ok,
        x:(typeof o[i]._x==='number')?Math.round(o[i]._x*100)/100:null,
        y:(typeof o[i]._y==='number')?Math.round(o[i]._y*100)/100:null});
    }
    return out;
  })()`;

  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:' + SPORT + '/index.html?subject=math&skip=1' });
  await sleep(4000);
  await evalj('window.__guanlanTest.open(); "ok"');
  await sleep(400);
  console.log('APPLY=' + JSON.stringify(await evalj('window.__guanlanTest.applyDemo("general-postman", {A:"-4,2", B:"4,3", k:"0"})')));
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await sleep(400);
    const u = await evalj('window.__gl ? window.__gl.u : null');
    const px = await evalj(counts);
    samples.push({ u: (typeof u === 'number') ? Math.round(u * 1000) / 1000 : u, px });
  }
  console.log('SAMPLES=' + JSON.stringify(samples));
  const st = await evalj(objState);
  console.log('OBJECTS=' + JSON.stringify(st));
  const bad = (st || []).filter(o => !o.ok);
  console.log('NOT_OK=' + JSON.stringify(bad));
  edge.kill();
}
main();
