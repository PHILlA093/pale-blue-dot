// ============================================================
// 穷观 · 宣传片录制器
//   无头 Edge + CDP:注入虚拟时钟与时间线,逐帧推进 -> 截图序列 -> 交给 ffmpeg 编码
// 用法:
//   node record.js <静态服务器端口> <帧输出目录> [--stills 60,420,900] [--range 0:300] [--prefix f]
// 说明:
//   虚拟时钟让页面时间只听命令,所以 60fps 的每一帧都精确对应 1/60 秒,不会丢帧/重复帧。
//   真实等待(AI 网络请求)用"闸门"处理:闸门没满足就空转等待,不消耗帧号,时间线不动。
// ============================================================
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const PORT_SRV = process.argv[2] || '8931';
const OUT = process.argv[3] || 'E:\\qg_promo\\frames';
const argv = process.argv.slice(4);
function argVal(name, def) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; }
const STILLS = (argVal('--stills', '') || '').split(',').filter(Boolean).map(Number);
const RANGE = (argVal('--range', '') || '').split(':').filter(Boolean).map(Number);
const PREFIX = argVal('--prefix', 'f');
// --dump "帧号||js表达式" 可重复:在渲染完该帧后把页面状态打出来(排查用)
const DUMPS = [];
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dump' && argv[i + 1]) {
        const s = argv[i + 1], k = s.indexOf('||');
        if (k > 0) DUMPS.push({ f: Number(s.slice(0, k)), expr: s.slice(k + 2) });
    }
}

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = path.join(os.tmpdir(), 'qg_promo_profile');
const FPS = 60;
const TOTAL = 5400;
const HERE = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }

/* ---------------- 阶段定义 ---------------- */
const PREP_INDEX = `
window.__freezeCss();
try{ var i=document.getElementById('intro'); if(i&&i.parentNode) i.parentNode.removeChild(i); }catch(e){}
try{ document.documentElement.classList.remove('intro-live'); }catch(e){}
var a=document.getElementById('app'); if(a) a.style.opacity='0';
var si=document.getElementById('searchInput'); if(si){ si.dataset.qgFull='椭圆'; si.value=''; }
''`;

const PREP_TRAIN = `
window.__freezeCss();
var st=document.createElement('style'); st.id='__trFrame';
st.textContent='html{background:radial-gradient(120% 112% at 50% 0%,#0c1728 0%,#06090f 58%,#03060a 100%)!important;overflow:hidden!important}'
+'body{position:absolute!important;left:auto!important;top:auto!important;right:96px!important;bottom:104px!important;'
+'width:980px!important;height:780px!important;margin:0!important;overflow:hidden!important;border-radius:14px!important;'
+'background:#070b14!important;transform-origin:100% 100%!important;transform:scale(1.045);'
+'box-shadow:0 46px 140px rgba(0,0,0,.85),0 0 0 1px rgba(120,160,220,.16),0 0 120px rgba(79,195,247,.06)}';
document.head.appendChild(st);
try{ if(!document.body.id) document.body.id='__trWindow'; }catch(e){}
// 关键:破卷页的科目来自"主窗桥接的 live 状态"。录制时前面刚走过英语学科页,
// live 状态是 eng,于是破卷页带着英语库启动 —— 「椭圆」在英语库里一个都匹配不到,
// currentTarget() 返回 null,出题按钮会立刻以"先选目标"退出,AI 请求根本发不出去。
// 用应用自带的测试钩子把上下文明确锁成数学(它内部会重选 curDB 并刷新顶部信息条)。
try{ window.__trainTest.setLive({ t: Date.now(), subject: 'math', subjectName: '高中数学', selName: '椭圆', keyword: '' }); }catch(e){}
var ai=document.getElementById('askInput'); if(ai){ ai.dataset.qgFull='椭圆'; ai.value=''; }
return 'live set, db=' + (window.__trainTest && window.__trainTest.state ? JSON.stringify(window.__trainTest.state()).slice(0,120) : '-');
`;

const PREP_GLAN = `
window.__freezeCss();
var ai=document.getElementById('glAsk'); if(ai){ ai.dataset.qgFull='导数的几何意义是什么?'; ai.value=''; }
var st=document.getElementById('glStage'); if(st){ st.style.transformOrigin='50% 52%'; }
''`;

// 学科页(化学/物理/英语):整页加载,不放开场,直接把云亮出来并抓相机基准
const PREP_CLOUD = `
window.__freezeCss();
try{ var i=document.getElementById('intro'); if(i&&i.parentNode) i.parentNode.removeChild(i); }catch(e){}
try{ document.documentElement.classList.remove('intro-live'); }catch(e){}
var a=document.getElementById('app'); if(a) a.style.opacity='1';
return window.__film.camCapture() ? 'cam ok' : 'NO_CONTROLS';
`;

const FALLBACK_Q = `
(function(){
  if(document.querySelectorAll('#qaArea .qcard').length>=4) return 'already';
  window.__trainTest.renderQuestions([
    {type:'单选',difficulty:3,stem:'已知椭圆 $\\\\frac{x^2}{25}+\\\\frac{y^2}{9}=1$ 的左、右焦点分别为 $F_1,F_2$,点 $P$ 在椭圆上,则 $|PF_1|+|PF_2|$ 等于( )',
     options:['A. 5','B. 8','C. 10','D. 16'],answer:'C',analysis:'由椭圆定义,$|PF_1|+|PF_2|=2a=10$。',source:'真题·2019 全国卷 I'},
    {type:'单选',difficulty:3,stem:'椭圆 $\\\\frac{x^2}{16}+\\\\frac{y^2}{7}=1$ 的离心率为( )',
     options:['A. $\\\\frac{3}{4}$','B. $\\\\frac{\\\\sqrt{7}}{4}$','C. $\\\\frac{1}{2}$','D. $\\\\frac{\\\\sqrt{7}}{3}$'],answer:'A',analysis:'$a=4,b=\\\\sqrt7,c=3$,故 $e=\\\\frac{c}{a}=\\\\frac34$。',source:'真题·2018 全国卷 II'},
    {type:'单选',difficulty:3,stem:'过椭圆 $\\\\frac{x^2}{9}+\\\\frac{y^2}{4}=1$ 的右焦点作垂直于长轴的弦,弦长为( )',
     options:['A. $\\\\frac{4}{3}$','B. $\\\\frac{8}{3}$','C. $\\\\frac{5}{3}$','D. $\\\\frac{10}{3}$'],answer:'B',analysis:'通径长 $\\\\frac{2b^2}{a}=\\\\frac{8}{3}$。',source:'真题·2017 全国卷 III'},
    {type:'单选',difficulty:3,stem:'若椭圆 $\\\\frac{x^2}{m}+y^2=1$ 的焦距为 2,则 $m$ 的值为( )',
     options:['A. 2','B. 3','C. 4','D. 5'],answer:'A',analysis:'$c=1$,由 $m-1=1$ 得 $m=2$。',source:'真题·2020 全国卷 I'}
  ], false);
  return 'fallback';
})()`;

const PHASES = [
    { id: 'open', a: 0, b: 420, nav: 'index.html?subject=math&skip=1', prep: PREP_INDEX, ready: '!!(window.__qg3D&&document.getElementById("scene")&&document.getElementById("scene").width>100)' },
    { id: 'cloud', a: 420, b: 1980, prep: `if(!window.__film.camCapture()) return 'NO_CONTROLS'; return 'cam ok';` },
    // 学科巡礼:三科各整页加载一次
    { id: 'chem', a: 1980, b: 2220, nav: 'index.html?subject=chem&skip=1', prep: PREP_CLOUD, ready: '!!(window.__qg3D&&document.getElementById("scene")&&document.getElementById("scene").width>100)' },
    { id: 'physics', a: 2220, b: 2460, nav: 'index.html?subject=physics&skip=1', prep: PREP_CLOUD, ready: '!!(window.__qg3D&&document.getElementById("scene")&&document.getElementById("scene").width>100)' },
    { id: 'eng', a: 2460, b: 2880, nav: 'index.html?subject=eng&skip=1', prep: PREP_CLOUD, ready: '!!(window.__qg3D&&document.getElementById("scene")&&document.getElementById("scene").width>100)' },
    { id: 'train1', a: 2880, b: 3120, nav: 'train.html', prep: PREP_TRAIN, ready: '!!window.__trainTest' },
    {
        id: 'trainWait', a: 3120, b: 3300,
        prep: `var ai=document.getElementById('askInput');
            if(ai && (ai.value||'').trim()===''){ ai.value='椭圆'; ai.dispatchEvent(new Event('input',{bubbles:true})); }
            var ti=document.getElementById('targetInfo');
            if(ti && !(ti.innerText||'').trim()){ var lb=document.getElementById('locateBtn'); if(lb) lb.click(); }
            var b=document.getElementById('genBtn');
            if(document.querySelectorAll('#qaArea .qcard').length<4 && b && !b.disabled) b.click();
            return 'ask=' + (ai?ai.value:'-') + ' target=' + ((ti?ti.innerText:'').slice(0,20)) + ' dis=' + (b?b.disabled:'-');`,
        gate: `document.querySelectorAll('#qaArea .qcard').length>=4`,
        retry: `var ai=document.getElementById('askInput'), ti=document.getElementById('targetInfo'), b=document.getElementById('genBtn');
            var st='ask='+(ai?ai.value:'-')+' cards='+document.querySelectorAll('#qaArea .qcard').length+' dis='+(b?b.disabled:'-')+' | '+((document.getElementById('status')||{}).textContent||'').slice(0,40);
            if(ti && !(ti.innerText||'').trim()){ var lb=document.getElementById('locateBtn'); if(lb) lb.click(); st+=' [relocate]'; }
            if(b && !b.disabled && document.querySelectorAll('#qaArea .qcard').length<4){ b.click(); st+=' [gen]'; }
            return st;`,
        fallback: FALLBACK_Q, gateTimeout: 300000
    },
    { id: 'train2', a: 3300, b: 4020 },
    { id: 'glan1', a: 4020, b: 4260, nav: 'guanlan.html', prep: PREP_GLAN, ready: '!!window.__guanlanTest' },
    {
        id: 'glanWait', a: 4260, b: 4400,
        prep: `if(!document.querySelector('.gl-msg.user')){var b=document.getElementById('glSend'); if(b) b.click();} return 'send clicked';`,
        gate: `!!document.querySelector('.gl-msg.ai')`,
        retry: `var b=document.getElementById('glSend'); if(b&&!document.querySelector('.gl-msg.user')&&!document.querySelector('.gl-msg.ai')) b.click(); return 'retry-send';`,
        gateTimeout: 300000
    },
    { id: 'glan2', a: 4400, b: 4600 },
    {
        id: 'demoWait', a: 4600, b: 4680,
        prep: `if(!(window.__gl&&window.__gl.objects&&window.__gl.objects.length)){var b=document.getElementById('glDemoBtn'); if(b) b.click();} return 'demo clicked';`,
        gate: `!!(window.__gl&&window.__gl.objects&&window.__gl.objects.length)`,
        fallback: `window.__guanlanTest.applyDemo('func-derivative-tangent',{}); window.__guanlanTest.engine().pause(); 'demo fallback'`,
        gateTimeout: 240000
    },
    { id: 'glan3', a: 4680, b: 5100 },
    { id: 'outro', a: 5100, b: 5400 }
];

function phaseOf(f) { for (let i = 0; i < PHASES.length; i++) if (f >= PHASES[i].a && f < PHASES[i].b) return PHASES[i]; return PHASES[PHASES.length - 1]; }

/* ---------------- 主流程 ---------------- */
async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    fs.rmSync(PROFILE, { recursive: true, force: true });
    const PORT = 9893;
    const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
        '--window-size=1920,1080', '--force-device-scale-factor=1', '--hide-scrollbars',
        '--disable-lcd-text', '--font-render-hinting=none', 'about:blank'], { stdio: 'ignore' });
    let tab = null;
    for (let i = 0; i < 100; i++) { try { const l = await getJson('http://127.0.0.1:' + PORT + '/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(200); }
    if (!tab) { console.log('FAIL no tab'); edge.kill(); process.exit(1); }
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pend = {};
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
    const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
    const evalj = async expr => {
        const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const r = m.result || {};
        if (r.exceptionDetails) return 'EX:' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
        return r.result ? r.result.value : undefined;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    const clock = fs.readFileSync(path.join(HERE, 'inject.js'), 'utf8');
    const film = fs.readFileSync(path.join(HERE, 'film.js'), 'utf8');
    // API Key:只从环境变量或临时文件读,绝不落进项目、绝不打印
    const KEYFILE = 'E:\\qg_promo\\ds_key.txt';
    const KEY = process.env.QG_KEY || (fs.existsSync(KEYFILE) ? fs.readFileSync(KEYFILE, 'utf8').trim() : '');
    console.log('api key: ' + (KEY ? 'present (' + KEY.slice(0, 6) + '…' + KEY.slice(-4) + ')' : 'MISSING -> AI gates will fall back'));
    if (KEY) await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("qg_ds_key",' + JSON.stringify(KEY) + ');}catch(e){}' });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: clock });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: film });

    const log = [];
    const t0 = Date.now();
    let cur = null, shots = 0, pumped = 0, fails = 0;
    // 闸门等待期间的真实耗时,要补进虚拟时间:页面里出题/讲解的分步流程有 setTimeout,
    // 时钟冻住的话这些定时器永不触发,AI 请求会卡在那里直到闸门超时(实测就是这么抖的)。
    // 只增不减,保证泵给页面的时间始终单调,不会出现时间倒流。
    let timeOffset = 0;

    const enterPhase = async (ph, f) => {
        console.log(`\n=== [${ph.id}] frames ${ph.a}-${ph.b - 1}  t=${(f / 60).toFixed(2)}s ===`);
        if (ph.nav) {
            timeOffset = 0;                       // 新文档新时钟
            await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT_SRV + '/' + ph.nav });
            let ok = false;
            for (let i = 0; i < 160; i++) { await sleep(150); if (await evalj(ph.ready)) { ok = true; break; } }
            console.log('  nav ready=' + ok);
            // 预热:让被冻结的时钟扫过一小段,把页面的 init 定时器放出来
            const tf = f * 1000 / 60;
            for (let k = 0; k <= 12; k++) { await evalj('window.__pump(' + (tf - 800 + k * 70) + ')'); await sleep(45); }
        }
        // prep 可能带 return,Runtime.evaluate 顶层不允许 -> 包一层函数
        // 注意:prep 自己不要再写成 IIFE,否则这里再包一层会把它的返回值吞掉(排查时踩过)
        if (ph.prep) console.log('  prep -> ' + JSON.stringify(await evalj('(function(){' + ph.prep + '})()')));
        if (ph.gate) {
            const tf = f * 1000 / 60 + timeOffset;
            let ok = false; const g0 = Date.now();
            const PACE = 0.25;   // 虚拟时间只按真实时间的 1/4 走
            while (Date.now() - g0 < (ph.gateTimeout || 120000)) {
                // 既要让页面里的定时器能触发(时钟完全冻住会把出题流程卡死),
                // 又不能冲太快 —— train.js 用 setTimeout 给 AI 请求挂了 60 秒 abort,
                // 时钟按真实时间 1:1 冲过去就会在 60 秒处自己掐断请求。
                // 1/4 速度:定时器正常触发,而 60 虚拟秒 ≈ 240 真实秒,足够 API 返回。
                await evalj('window.__pump(' + (tf + (Date.now() - g0) * PACE) + ')');
                if (await evalj(ph.gate)) { ok = true; break; }
                // 真实 AI 会抖:闸门等太久就反复重试触发(页面自己用 disabled 防重入)
                if (ph.retry) {
                    const n = Math.floor((Date.now() - g0) / 45000);
                    if (n > (ph._retries || 0)) {
                        ph._retries = n;
                        // 同样要包一层函数:重试表达式里带 return,顶层求值会直接语法报错
                        console.log('  retry#' + n + ' -> ' + await evalj('(function(){' + ph.retry + '})()'));
                    }
                }
                await sleep(400);
            }
            console.log('  gate ' + (ok ? 'OPEN' : 'TIMEOUT') + ' after ' + ((Date.now() - g0) / 1000).toFixed(1) + 's');
            timeOffset += Date.now() - g0;        // 把等待时间记进偏移,后续帧的泵时间继续单调递增
            if (!ok && ph.fallback) console.log('  fallback -> ' + await evalj(ph.fallback));
            else if (!ok) { console.log('  !! GATE NEVER OPENED'); log.push('gate-timeout:' + ph.id); }
        }
    };

    const want = f => {
        if (STILLS.length) return STILLS.indexOf(f) >= 0;
        if (RANGE.length === 2) return f >= RANGE[0] && f < RANGE[1];
        return true;
    };

    for (let f = 0; f < TOTAL; f++) {
        const ph = phaseOf(f);
        if (ph !== cur) { await enterPhase(ph, f); cur = ph; }
        const t = ((f * 1000 / 60) + timeOffset).toFixed(4);
        try {
            await evalj(`if(window.__film){__film.frame(${f});__film.tickTyping(${f});} __pump(${t}); __syncCss(${t}); 1`);
            pumped++;
            for (const d of DUMPS) if (d.f === f) console.log('  DUMP@' + f + ' = ' + JSON.stringify(await evalj(d.expr)));
            if (want(f)) {
                const m = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
                const b = m.result && m.result.data;
                if (!b) { fails++; log.push('shot-fail:' + f); }
                else {
                    fs.writeFileSync(path.join(OUT, PREFIX + String(f).padStart(5, '0') + '.png'), Buffer.from(b, 'base64'));
                    shots++;
                }
            }
        } catch (e) { fails++; }
        if (f % 120 === 0 || f === TOTAL - 1) {
            const el = (Date.now() - t0) / 1000;
            console.log(`  f=${f} shots=${shots} pumped=${pumped} fails=${fails} elapsed=${el.toFixed(0)}s (${(f / el).toFixed(1)} f/s)`);
        }
        if (fails > 25) { console.log('TOO MANY FAILURES, aborting'); break; }
    }
    const meta = { fps: FPS, total: TOTAL, shots, pumped, fails, stills: STILLS, range: RANGE, prefix: PREFIX, log, seconds: ((Date.now() - t0) / 1000).toFixed(1) };
    fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify(meta, null, 2));
    console.log('\nDONE ' + JSON.stringify(meta));
    edge.kill();
}
main().catch(e => { console.log('FATAL ' + e.stack); process.exit(1); });
