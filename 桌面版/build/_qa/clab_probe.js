/* 穷观 · 化学实验台（观澜化学模式）· 常驻发布闸门
 *
 * 用法：
 *   1) 起静态服务器（workdir 必须是穷观根目录）：
 *        node 桌面版\build\_qa\server.js E:\workspace\穷观 8977
 *   2) 跑本探针：
 *        node 桌面版\build\_qa\clab_probe.js 8977 [profile目录]
 *      退出码：0 = 全部 PASS；1 = 有 FAIL（可直接当发布闸门用）
 *   产出：%TEMP%\qg_clab_probe\clab_probe_report.json（逐反应全量数据）
 *         %TEMP%\qg_clab_probe\clab_table50.md（50 行证据表）
 *
 * ============================ 判据（口径写死在这里） ============================
 * 契约：docs\化学实验台设计.md §4（八条）+ §3（接口）；工程约束与盲区：AGENTS.md §13/§14。
 *
 * 【科目注入】window.CUR_SUBJECT='chem' + localStorage('qg_subject') + ('qg_live_state').subject，
 *   经 Page.addScriptToEvaluateOnNewDocument **先于页面脚本**注入（照 AGENTS §13 的写法）。
 *
 * 【入口与三方互斥】（沙盒/物理实验台/化学实验台）
 *   E1 化学科目下 #glClBtn 存在、可见、在视口内、文案逐字「🧪 化学实验台」；#glPsBtn/#glPlBtn 都不存在。
 *   E2 真点击入口 → isMounted()===true、state().open===true、三栏在、#clCanvas 尺寸 >0、#clCSS 注入、6 组 50 项。
 *   E3/E4 三个入口按科目显隐，同一科目下不可能同时看到两个按钮 → 互斥用"把另一方的**引擎强制挂载**
 *         （引擎本身不看科目，只拦入口）+ 真点本方的真按钮"来验：对方 isMounted() 必须变 false、其 DOM 前缀清零。
 *   E5/E6 再点一次 / 真派发 Esc → cl- DOM 0 个、#clCSS 卸净、按钮文案与舞台类名还原；再进一次仍 50 项。
 *
 * 【50 行表】每个反应：
 *   C2 真点击 .cl-item → current().id 正确 / state().open / 左栏唯一高亮 / canvas >0
 *   C3 真点击 🔬 观察一次 → rows +1、现象表 DOM 同步、phenomena ≥2 条
 *   C4 conditions / type 非空
 *   C5 balance(react().equation) 的 status ∈ { ok, no-equation }（**用 react() 的返回值**，
 *      不是 spec.equation —— 后者不是字段）。no-equation = 本来就没有化学方程式（焰色是物理变化、
 *      碘的萃取是物理变化、SO₂-品红加合物无固定组成），**合法、不判红**；unbalanced 才是缺陷。
 *   C6 conclude() 形状 {text,equation,ionic,errors[]} 且 errors.length ≥2
 *   C7 columns:[] 的反应 graph() 必须返回 null（这是**合法**的，不是缺陷）
 *   C8 有定量列 ⇒ graph() 非 null、points ≥5、**不同 x ≥6**（AGENTS §13：固定参数下 x 无分布，r² 无意义）
 *   C9 线性拟合（fit 不是 'none'/false）⇒ 按下面"★r² 三条件"判定 r² > 0.9
 *   C10 fit:'none'/false 的反应 ⇒ 出点但 fit=null，且 note/title 里写明"为什么不该线性拟合"
 *   C11 方向性：**每个参数先把其余参数复位到默认**（open(id) 建新会话）再扫（numeric 6 点 / select 全选项），
 *       ≥2 个参数让现象文本或量化量发生变化。不复位会把上一个 select 的末值带进来 → 假红（踩过）。
 *   C12 "画到最后一笔"指令级对照：拦 CanvasRenderingContext2D.prototype 全部函数型属性、按 canvas.id 过滤，
 *       取 setParam 触发的**恰好一帧**实况指令；再用 Proxy 记录型假 ctx + 与核心 makeG 同形的 g
 *       按同一 params/state 独立重放 spec.draw。判据：**条数差 == 核心自己的 3 条前导** 且**末 3 条完全相同**。
 *   C13/14/15 drawErrorCount(id)===0、state().lastError 为空、state().warnings 为空
 *
 * ★ r² 只有在**三个条件同时满足**时才有意义（这三个坑本模块全踩过，别简化）：
 *   ① y 不能是常数序列 —— 核心 r2Of 在 ssTot≈0 时返回 1；常数序列会**假绿**
 *      （iron-ion-test 默认试样 fe2 加 KSCN 本就不显色 → 颜色读数恒 0 → 核心给 r²=1，是无意义的 1）；
 *   ② x 必须有分布（不同 x ≥6）—— 固定参数下 x 无分布（AGENTS §13 明文）；
 *   ③ 必须落在**各组 note 自述的线性区内** —— 全量程扫进饱和段，r² 必然下降，那不是数据不准而是用错区间。
 *      本探针对以下 5 个反应写死了"自述线性区"（区间依据各反应 note 原话 + 独立实测）：
 *        flame-test      conc ∈ [0.1, 1.1]   note：c ≤ 1.2 左右近似线性、之后趋于饱和
 *                                            实测 0.1→1.1 r²=1.0000(8点)；全量程 0.1→2.0 只有 0.8696
 *        gas-collection  time ∈ [10, 35] s   note：只扫 10~30 s 接近直线、扫到 60 s 明显饱和弯曲
 *                                            step=5 ⇒ 10..30 只有 5 个不同 x，取到 35 凑满 6 点；实测 0.9384
 *        so2-properties  conc ∈ [0.02, 0.25] note：跨到饱和段 r² 下降、应缩小浓度范围重测；实测 0.9428(8点)
 *        iron-ion-test   fvol ∈ [0.2, 1.0] mL（前置 sample='fe3'）note 明写"0.2~1.0 mL 这一段才是可用的线性范围"
 *                                            （读数接近 100 即满标）；实测 1.0000(6点)；全量程核心 r²=−0.9639
 *        kmno4-titration 用**固定条件重复观察**推进滴定（12 次）—— 它的 x（vb）是"每次观察累加的滴定体积"，
 *                                            绝不能与自变量同时变（那是双重自变量，r² 无意义）；实测 1.0000(12点)
 *      其余有定量列的反应：取"扫参数（每次复位）"与"固定条件重复"两种手法里，满足 ①② 且核心 r² 最高的那个。
 *      三条件不满足的（拿不出可用的线性配置）判 FAIL —— 不许用退化 r² 蒙过去。
 *
 * 【参数组合扫描】每个反应 ≥60 组（本探针取到 ≤120 组/反应）：
 *   每参数 6 档（min/0.2/0.4/0.6/0.8/max；select 取全部选项）⇒ 空间 ≤150 时**穷举**，否则确定性 LCG 采样；
 *   另加边界集：全 min / 全 max / 全 mid、每参数 6 档×其余默认（**这一族抓到过 D1**）、
 *   同量纲参数对的"等值"组合（滴数相等/浓度相等这类物理边界）、参数对的 3 种极值混搭。
 *   **每组都读** state().lastError / drawErrorCount(id) / reactErrorCount(id) / errorCounts(id) /
 *   row.balanced.status / state().warnings，并统计本探针自己 catch 到的异常（react() 抛给调用方也算）。
 *   S2/S3/S5/S6 = 0 异常 / 0 lastError / 0 绘制异常 / 0 体检 warning；S4 = balance 状态只允许 {ok, no-equation}；
 *   S7 = errorCounts(id) 的 draw/react/step/pointer/conclude 五类 since 全为 0。
 *  ⚠ 为什么必须"每组都读"：`open()` 会重置 lastError 与计数 —— "每个反应只读一次"会漏掉
 *   **只在某个参数组合下才炸**的缺陷（D1 就是这么漏过去的）。
 *
 * 【核心闸门与 balance 正反例】（独立复核核心自证，不采信）
 *   BAL-1 `NH4Cl + H2O ⇌ NH3·H2O + HCl` → ok（**不带数字的 `·`**）
 *   BAL-2 `Na2CO3 + 2HCl = 2NaCl + H2O + CO2↑；CO2 + Ca(OH)2 = CaCO3↓ + H2O` → ok 且 segments.length===2
 *   BAL-3 同上但用 `|` 分隔 → ok 且 segments.length===2
 *   BAL-4 `Cu - 2e- = Cu2+` → ok（**减电子写法**）
 *   BAL-5 `H2 + O2 = H2O` → unbalanced（**闸门没被放松**：故意写错的必须报红）且 reason 指出不守恒的元素
 *   BAL-6 `2NaOH + CO2 = Na2CO3 + H2O；H2 + O2 = H2O` → unbalanced 且 reason 里含「第 2 段」
 *   BAL-7 全库组合扫描里 unbalanced 组数 === 0（见 S4）
 *   DEG-1 `iron-ion-test` 默认试样 fe2（KSCN 不显色 ⇒ 颜色恒 0）→ graph().fit===null 且 degenerate===true 且 fitNote 非空
 *         （即"常数序列不再假绿 r²=1"）
 *   DEG-2 同一反应换 fe3、按自述线性区扫 fvol → degenerate===false 且 fit 非 null（证明不是"一律报退化"）
 *   REACT-DEF（放在最末，合成 spec 会污染注册表）`QG_CLAB.react()` 绝不把 spec.react 的异常冒给调用方：
 *         返回空数组、lastError 记录、reactErrorCount/errorCounts().react 计数 +1、不出行；直调 spec.react() 仍抛。
 *
 * 【负对照】往实况帧注入一次"第 K 条绘制指令抛错"（K = 干净帧指令数的一半），
 *   C12 的判据**必须变红**（条数断崖下降 / 末 3 条不一致）；移除注入后必须**回到绿**。
 *   不做负对照的"画到最后一笔"是盲判据（AGENTS §13）。
 *
 * 【跨科目零污染】math 科目下：#glClBtn 不存在、cl- 前缀 DOM 0 个、#clCSS 未注入。（其余科目同一条代码路径。）
 *
 * 【全局】0 条 Runtime.exceptionThrown；window.open 间谍全程 0 次调用；收尾后 cl- DOM 0、#clCSS 已卸。
 * ================================================================================
 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SPORT = process.argv[2] || '8977';
const OUTDIR = path.join(os.tmpdir(), 'qg_clab_probe');
const PROFILE = process.argv[3] || path.join(OUTDIR, 'prof');
const DPORT = 9400 + Math.floor(Math.random() * 300);
const BASE = 'http://127.0.0.1:' + SPORT + '/guanlan.html';

const results = [];
function check(name, ok, extra) {
  results.push({ name: name, ok: !!ok, extra: extra === undefined ? '' : String(extra) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' :: ' + String(extra).slice(0, 1100) : ''));
}
function info(n, e) { console.log('INFO ' + n + ' :: ' + String(e).slice(0, 1600)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(u) { return new Promise((res, rej) => { http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = []; this.logs = []; }
  static async connect(port) {
    let tab = null;
    for (let i = 0; i < 80; i++) { try { const l = await getJson('http://127.0.0.1:' + port + '/json/list'); tab = l.find(t => t.type === 'page'); if (tab) break; } catch (e) { } await sleep(250); }
    if (!tab) throw new Error('no tab（先起服务器：node _qa/server.js <穷观根目录> <端口>）');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) { const p = c.pending.get(m.id); c.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return; }
      if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; c.errors.push(String((d.exception && (d.exception.description || d.exception.value)) || d.text || '')); }
      if (m.method === 'Log.entryAdded') c.logs.push(m.params.entry.level + ': ' + m.params.entry.text);
    };
    return c;
  }
  send(m, p = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method: m, params: p })); }); }
  async eval(e) { const r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL-ERR: ' + (r.exceptionDetails.exception ? (r.exceptionDetails.exception.description || JSON.stringify(r.exceptionDetails.exception)) : r.exceptionDetails.text)); return r.result ? r.result.value : undefined; }
  close() { try { this.ws.close(); } catch (e) { } }
}

/* ============================== 页面内工具箱（注入一次） ============================== */
const HELPER = `window.__CP=(function(){
  var R2PLAN={
    'flame-test':      {key:'conc', lo:0.1,  hi:1.1,  n:8,  why:'note：c ≤ 1.2 左右近似线性、之后饱和'},
    'gas-collection':  {key:'time', lo:10,   hi:35,   n:6,  why:'note：10~30 s 接近直线；step=5 时 10..30 只有 5 个 x，取到 35 凑满 6 点'},
    'so2-properties':  {key:'conc', lo:0.02, hi:0.25, n:8,  why:'note：跨到饱和段 r² 会下降、应缩小浓度范围重测'},
    'iron-ion-test':   {key:'fvol', lo:0.2,  hi:1.0,  n:6,  pre:{sample:'fe3'}, why:'note 明写"0.2~1.0 mL 才是可用的线性范围"'},
    'kmno4-titration': {method:'repeat', n:12, why:'x=vb 是每次观察累加的滴定体积，不能与自变量同时变'}
  };
  var LEVELS=6, ops=[], patched=false, throwAt=0, liveN=0;
  /* ---- 画布指令拦截 ---- */
  function patch(){
    if(patched) return true;
    try{
      var proto=window.CanvasRenderingContext2D.prototype, names=Object.getOwnPropertyNames(proto), i;
      for(i=0;i<names.length;i++){(function(mm){
        var d=Object.getOwnPropertyDescriptor(proto,mm);
        if(!d||typeof d.value!=='function') return;
        Object.defineProperty(proto,mm,{configurable:true,writable:true,enumerable:!!d.enumerable,
          value:function(){
            var cid=(this&&this.canvas&&this.canvas.id)||'?';
            if(cid==='clCanvas'){
              liveN++;
              if(throwAt && liveN===throwAt) throw new Error('NEGCTL-mid-draw-abort@'+mm);
              var a=[].slice.call(arguments).map(function(v){ return typeof v==='number'?Math.round(v*10)/10:v; });
              ops.push(mm+'('+a.join(',')+')');
            }
            return d.value.apply(this,arguments);
          }});
      })(names[i]);}
      patched=true; return true;
    }catch(e){ return false; }
  }
  /* ---- 记录型假 ctx + 与核心 makeG 同形的 g ---- */
  function FakeCtx(){
    var self={ops:[]};
    return new Proxy(self,{ get:function(t,k){
      if(k==='ops') return t.ops;
      if(typeof k!=='string') return undefined;
      if(k in t) return t[k];
      return function(){ var a=[].slice.call(arguments).map(function(v){ return typeof v==='number'?Math.round(v*10)/10:v; });
        t.ops.push(k+'('+a.join(',')+')');
        if(k==='measureText') return {width:10};
        if(/Gradient|Pattern/.test(k)) return {addColorStop:function(){}};
        return undefined; }; },
      set:function(){ return true; } });
  }
  var FAM='Georgia,"Times New Roman",serif';
  function fontCss(size,a,b){
    var px=Number(size); if(!isFinite(px)||px<=0) px=14; px=Math.round(px*100)/100;
    var plain=px+'px '+FAM;
    if(typeof a==='string'){ var raw=String(a).replace(/^\\s+|\\s+$/g,''); return raw?(raw+' '+plain):plain; }
    var it=true, bo=false;
    if(typeof a==='boolean') it=a; else if(typeof a==='number') it=!!a;
    if(typeof b==='boolean') bo=b; else if(typeof b==='number') bo=!!b;
    return (it?'italic ':'')+(bo?'bold ':'')+plain;
  }
  function mkG(cx,W,H,dpr){
    var s=Math.min(W/760,H/470); if(!(s>0)) s=1; if(s<0.5) s=0.5; if(s>2) s=2;
    return { c:cx, w:W, h:H, dpr:dpr, scale:s, paper:'#F4F1EA', ink:'#26221C',
      font:function(size,st,bo){ return fontCss(size,st,bo); },
      text:function(str,x,y,size,align,color){ cx.save(); cx.font=this.font(size); cx.fillStyle=color||'#26221C';
        cx.textAlign=align||'left'; cx.textBaseline='alphabetic'; cx.fillText(String(str),x,y); cx.restore(); },
      line:function(x1,y1,x2,y2,color,w,dash){ cx.save(); cx.strokeStyle=color||'#26221C'; cx.lineWidth=w||1;
        if(dash) cx.setLineDash(dash); cx.beginPath(); cx.moveTo(x1,y1); cx.lineTo(x2,y2); cx.stroke(); cx.restore(); },
      arrow:function(x1,y1,x2,y2,color,w){ cx.save(); cx.strokeStyle=color||'#26221C'; cx.fillStyle=color||'#26221C';
        cx.lineWidth=w||1.4; cx.beginPath(); cx.moveTo(x1,y1); cx.lineTo(x2,y2); cx.stroke();
        var a=Math.atan2(y2-y1,x2-x1),L=8; cx.beginPath(); cx.moveTo(x2,y2);
        cx.lineTo(x2-L*Math.cos(a-0.4),y2-L*Math.sin(a-0.4)); cx.lineTo(x2-L*Math.cos(a+0.4),y2-L*Math.sin(a+0.4));
        cx.closePath(); cx.fill(); cx.restore(); },
      rect:function(x,y,w,h,color,fill){ cx.save();
        if(fill){ cx.fillStyle=color||'#26221C'; cx.fillRect(x,y,w,h); }
        else { cx.strokeStyle=color||'#26221C'; cx.lineWidth=1.2; cx.strokeRect(x,y,w,h); } cx.restore(); },
      circle:function(x,y,r,color,fill,lw){ cx.save(); cx.beginPath(); cx.arc(x,y,Math.max(0.5,r),0,Math.PI*2);
        if(fill){ cx.fillStyle=color||'#26221C'; cx.fill(); } else { cx.strokeStyle=color||'#26221C'; cx.lineWidth=lw||1.2; cx.stroke(); } cx.restore(); },
      liquid:function(x,y,w,h,color){ cx.save(); cx.fillStyle=color||'rgba(120,180,220,.45)'; cx.fillRect(x,y,w,h);
        cx.strokeStyle=color||'rgba(60,110,150,.7)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x+w,y); cx.stroke(); cx.restore(); },
      bubble:function(x,y,r,color,lw){ cx.save(); cx.strokeStyle=color||'rgba(38,34,28,.6)'; cx.lineWidth=lw||1;
        cx.beginPath(); cx.arc(x,y,Math.max(0.6,r),0,Math.PI*2); cx.stroke(); cx.restore(); },
      cloud:function(x,y,r,color,n){ cx.save(); cx.fillStyle=color||'rgba(38,34,28,.5)';
        var cnt=n||14,i,a,rr; for(i=0;i<cnt;i++){ a=(i/cnt)*Math.PI*2; rr=r*(0.25+0.75*((i*37)%100)/100);
          cx.beginPath(); cx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr*0.7,1.4,0,Math.PI*2); cx.fill(); } cx.restore(); } };
  }
  /* ---- 小工具 ---- */
  function same(a,b){ if(a===b) return true;
    if(a===null||a===undefined||b===null||b===undefined) return false;
    var x=Number(a), y=Number(b);
    if(isFinite(x)&&isFinite(y)) return Math.abs(x-y)<=1e-9*Math.max(1,Math.abs(x),Math.abs(y));
    return String(a)===String(b); }
  function optsOf(p){ var o=p&&p.options; if(!o||!o.length) return null; var r=[],i;
    for(i=0;i<o.length;i++) r.push((o[i]&&typeof o[i]==='object')?o[i].value:o[i]); return r; }
  function valuesOf(p,n){ var o=optsOf(p); if(o) return o;
    var lo=Number(p.min), hi=Number(p.max);
    if(!isFinite(lo)||!isFinite(hi)||hi<=lo) return null;
    var r2=[],i; for(i=0;i<n;i++) r2.push(lo+(hi-lo)*i/(n-1)); return r2; }
  function shortNum(v){ if(v===null||v===undefined) return String(v);
    var n=Number(v); if(!isFinite(n)) return String(v);
    var a=Math.abs(n); if(a!==0&&(a<1e-3||a>=1e5)) return n.toExponential(3);
    return String(Math.round(n*1e6)/1e6); }
  function distinctX(pts){ var s={},i,n=0; for(i=0;i<pts.length;i++){ var k=String(Math.round(pts[i].x*1e9)/1e9); if(!s[k]){s[k]=1;n++;} } return n; }
  function freeFit(pts){
    var n=pts.length,i; if(n<2) return null;
    var sx=0,sy=0,sxx=0,sxy=0;
    for(i=0;i<n;i++){ sx+=pts[i].x; sy+=pts[i].y; sxx+=pts[i].x*pts[i].x; sxy+=pts[i].x*pts[i].y; }
    var den=n*sxx-sx*sx; if(Math.abs(den)<1e-12) return null;
    var b=(n*sxy-sx*sy)/den, a=(sy-b*sx)/n, yb=sy/n, ssT=0, ssR=0;
    for(i=0;i<n;i++){ var yh=a+b*pts[i].x; ssR+=(pts[i].y-yh)*(pts[i].y-yh); ssT+=(pts[i].y-yb)*(pts[i].y-yb); }
    return { a:a, b:b, r2:(ssT<1e-12)?null:(1-ssR/ssT), ssTot:ssT, degenerate:(ssT<1e-12) };
  }
  /* ---- 一个参数的"方向性"序列：先把其余参数复位到默认 ---- */
  function series(L,id,p,n){
    var vals=valuesOf(p,n); if(!vals) return null;
    L.open(id);
    var out=[], i, rw, err;
    for(i=0;i<vals.length;i++){
      L.setParam(p.key, vals[i]); err='';
      try { L.react(1); } catch(e){ err=String(e&&e.message||e); }
      if(err){ out.push({v:L.params()[p.key], err:err}); continue; }
      var t=L.table(); rw=t[t.length-1];
      out.push({ v:L.params()[p.key], ph:rw.phenomena.join(' / '), m:rw.measures, eq:rw.equation });
    }
    return out;
  }
  function diffSeries(s){
    if(!s||s.length<2) return null;
    var ok=[],i; for(i=0;i<s.length;i++){ if(!s[i].err) ok.push(s[i]); }
    if(ok.length<2) return { any:false, okN:ok.length, total:s.length, errN:s.length-ok.length, ph:false, keyN:0, keyNames:[], eq:false, keys:{} };
    var ph=false, keys={}, k, m0=ok[0].m, mN=ok[ok.length-1].m;
    for(i=1;i<ok.length;i++){ if(ok[i].ph!==ok[0].ph){ ph=true; break; } }
    for(k in m0){ if(!Object.prototype.hasOwnProperty.call(m0,k)) continue;
      var moved=false;
      for(i=1;i<ok.length;i++){ if(!same(ok[i].m[k],m0[k])){ moved=true; break; } }
      if(moved) keys[k]={from:m0[k],to:mN[k]}; }
    var kn=[]; for(k in keys) kn.push(k);
    var eq=false; for(i=1;i<ok.length;i++){ if(String(ok[i].eq)!==String(ok[0].eq)) eq=true; }
    return { ph:ph, keys:keys, keyN:kn.length, keyNames:kn, eq:eq, any:(ph||kn.length>0||eq),
      okN:ok.length, total:s.length, errN:s.length-ok.length };
  }
  function dirText(p,s,d){
    var ok=[],i; for(i=0;i<s.length;i++){ if(!s[i].err) ok.push(s[i]); }
    var a=ok[0], b=ok[ok.length-1], parts=[];
    parts.push((optsOf(p)?String(a.v):shortNum(a.v))+'→'+(optsOf(p)?String(b.v):shortNum(b.v)));
    for(i=0;i<d.keyNames.length&&i<2;i++){ var k=d.keyNames[i]; parts.push(k+': '+shortNum(d.keys[k].from)+'→'+shortNum(d.keys[k].to)); }
    if(d.ph) parts.push('现象变化'); if(d.eq) parts.push('方程式变化');
    if(d.errN) parts.push('★该参数有 '+d.errN+'/'+d.total+' 个取值让 react() 抛错');
    return parts.join(' ');
  }
  /* ---- 手法：扫参数 / 固定条件重复 ---- */
  function summarize(via,g){
    var pts=g.points||[];
    return { via:via, points:pts.length, dx:distinctX(pts), skipped:g.skipped,
      fit:(g.fit?{a:g.fit.a,b:g.fit.b,r2:g.fit.r2}:null), free:freeFit(pts), xy:pts };
  }
  function applyPre(L,pre){ for(var k in pre){ if(Object.prototype.hasOwnProperty.call(pre,k)) L.setParam(k,pre[k]); } }
  function sweepParam(L,id,key,n,lo,hi,pre){
    var sp=L.spec(id), ps=sp.params||[], p=null,i;
    for(i=0;i<ps.length;i++) if(ps[i].key===key) p=ps[i];
    if(!p||optsOf(p)) return null;
    L.open(id); if(pre) applyPre(L,pre);
    for(i=0;i<n;i++){ L.setParam(key, lo+(hi-lo)*i/(n-1)); try{ L.react(1); }catch(e){} }
    var g=L.graph(); if(!g) return null;
    return summarize('扫 '+key+' '+n+' 点 ['+shortNum(lo)+','+shortNum(hi)+']'+(pre?' +前置':'')+(pre?JSON.stringify(pre):''), g);
  }
  function sweepRepeat(L,id,n,pre){
    L.open(id); if(pre) applyPre(L,pre);
    for(var i=0;i<n;i++){ try{ L.react(1); }catch(e){} }
    var g=L.graph(); if(!g) return null;
    return summarize('固定条件重复 '+n+' 次'+(pre?' +前置'+JSON.stringify(pre):''), g);
  }
  /* ---- 50 行表：单个反应的全量证据 ---- */
  function row(id){
    var L=window.QG_CLAB, out={ id:id };
    var el=document.querySelector('.cl-item[data-id="'+id+'"]');
    if(!el){ out.missing=true; return out; }
    el.click();                                                   /* 真点击左栏 */
    var el2=document.querySelector('.cl-item[data-id="'+id+'"]');
    var cur=L.current(), st=L.state(), sp=L.spec(id);
    out.curId=cur?cur.id:null; out.open=st.open; out.hl=el2?el2.className.indexOf('cl-on')>=0:false;
    out.cvW=st.canvas.w; out.cvH=st.canvas.h; out.paramsN=Object.keys(cur.params).length;
    out.cols=st.columns; out.qual=st.qualitative;
    var r0=st.rows;
    document.getElementById('clBtnReact').click();                 /* 真点击 🔬 观察一次 */
    var t=L.table(), rw=t[t.length-1];
    out.rowsDelta=[r0, L.state().rows];
    out.phenN=rw.phenomena.length; out.phen0=rw.phenomena[0]; out.cond=rw.conditions; out.type=rw.type;
    out.eq=rw.equation; out.ionic=rw.ionic; out.measures=rw.measures;
    var b1=L.balance(rw.equation); out.bal=b1.status; out.balReason=b1.reason;
    var con=L.conclude();
    out.con={ errN:con?(con.errors||[]).length:-1, textLen:con?String(con.text).length:0,
      eq:con?String(con.equation):'', ionicLen:con?String(con.ionic).length:0,
      balEq:(con&&con.balance&&con.balance.equation)?con.balance.equation.status:'?' };
    /* 方向性 */
    var ps=sp.params||[], i, j, d, s, changed=0, dirA=null, dirB=null, noChange=[], sweepCrash=0;
    for(i=0;i<ps.length;i++){
      s=series(L,id,ps[i],6); d=s?diffSeries(s):null;
      if(d&&d.errN) sweepCrash+=d.errN;
      if(d&&d.any){ changed++;
        if(!dirA) dirA={key:ps[i].key, txt:dirText(ps[i],s,d)};
        else if(!dirB) dirB={key:ps[i].key, txt:dirText(ps[i],s,d)}; }
      else noChange.push(ps[i].key);
    }
    out.dirChanged=changed; out.dirN=ps.length; out.dirA=dirA; out.dirB=dirB; out.noChange=noChange;
    out.sweepCrash=sweepCrash;
    /* 图 */
    out.graphDecl = sp.graph ? { x:sp.graph.x, y:sp.graph.y,
      fit:(sp.graph.fit===undefined?'(undefined)':String(sp.graph.fit)),
      title:String(sp.graph.title||''), note:String(sp.graph.note||'') } : null;
    out.plan = R2PLAN[id] ? { key:R2PLAN[id].key, lo:R2PLAN[id].lo, hi:R2PLAN[id].hi, n:R2PLAN[id].n,
      method:R2PLAN[id].method, why:R2PLAN[id].why } : null;
    out.graph=null; out.graphNull=false; out.cands=[];
    if(out.cols>0){
      var cands=[], lo2, hi2;
      for(i=0;i<ps.length;i++){
        if(optsOf(ps[i])) continue;
        lo2=Number(ps[i].min); hi2=Number(ps[i].max);
        if(!isFinite(lo2)||!isFinite(hi2)||hi2<=lo2) continue;
        cands.push(sweepParam(L,id,ps[i].key,10,lo2,hi2,null));
      }
      cands.push(sweepRepeat(L,id,12,null));
      var pl=R2PLAN[id], planCand=null;
      if(pl){ planCand = (pl.method==='repeat') ? sweepRepeat(L,id,pl.n||12,pl.pre||null)
        : sweepParam(L,id,pl.key,pl.n||8,pl.lo,pl.hi,pl.pre||null); cands.push(planCand); }
      out.cands = cands.map(function(c){ return c? { via:c.via, points:c.points, dx:c.dx,
        r2:(c.fit?c.fit.r2:null), freeR2:(c.free?c.free.r2:null), ssTot:(c.free?c.free.ssTot:null),
        degenerate:(c.free?c.free.degenerate:null) } : null; });
      var pick=null;
      if(pl && planCand){ pick=planCand; out.pickVia='计划区间/手法'; }
      else {
        for(j=0;j<cands.length;j++){ var c=cands[j]; if(!c) continue; if(c.dx<6) continue;
          if(!c.free || c.free.degenerate) continue;
          if(pick===null || ((c.fit?c.fit.r2:-9) > (pick.fit?pick.fit.r2:-9))) pick=c; }
        out.pickVia='两种手法里最优';
      }
      if(pick){ out.graph={ via:pick.via, points:pick.points, dx:pick.dx,
        fit:(pick.fit?{a:pick.fit.a,b:pick.fit.b,r2:pick.fit.r2}:null),
        freeR2:(pick.free?pick.free.r2:null), ssTot:(pick.free?pick.free.ssTot:null),
        degenerate:!!(pick.free&&pick.free.degenerate) }; }
      out.graphNull=false;
    } else {
      var g0=L.graph(); out.graphNull=(g0===null);
    }
    /* draw：实况一帧 vs 独立重放 */
    var orig=sp.draw, cap=null;
    sp.draw=function(g2,p2,st2){ cap={p:p2, st:st2}; return orig.apply(this,arguments); };
    L.pause();
    var kv=null, pdef=sp.params||[];
    for(i=0;i<pdef.length;i++){
      if(!optsOf(pdef[i]) && isFinite(Number(pdef[i].min)) && Number(pdef[i].max)>Number(pdef[i].min)){
        kv={k:pdef[i].key, v:Number(pdef[i].min)+(Number(pdef[i].max)-Number(pdef[i].min))*0.37}; break; }
    }
    if(!kv && pdef.length){ var o0=optsOf(pdef[0]); if(o0&&o0.length) kv={k:pdef[0].key, v:o0[o0.length-1]}; }
    ops.length=0; liveN=0; throwAt=0;
    if(kv) L.setParam(kv.k, kv.v);
    var liveOps=ops.slice();
    sp.draw=orig;
    var replayOps=[], replayErr='';
    if(cap){
      var fake=new FakeCtx(), W=L.state().canvas.w, H=L.state().canvas.h;
      var cvEl=document.getElementById('clCanvas');
      var dpr2=Math.max(1, Math.round(cvEl.width/Math.max(1,W)));
      try{ orig(mkG(fake,W,H,dpr2), cap.p, cap.st); }catch(e){ replayErr=String(e&&e.message||e); }
      replayOps=fake.ops;
    } else replayErr='(未捕获到 draw 调用)';
    out.draw={ liveN:liveOps.length, replayN:replayOps.length, diff:liveOps.length-replayOps.length,
      tailEq:(JSON.stringify(liveOps.slice(-3))===JSON.stringify(replayOps.slice(-3))),
      tailLive:liveOps.slice(-3), tailReplay:replayOps.slice(-3), replayErr:replayErr, kv:kv?kv.k:'(none)' };
    /* 门禁 */
    out.drawErr=L.drawErrorCount(id);
    out.lastError=String(L.state().lastError||'');
    out.warnN=(L.state().warnings||[]).length;
    out.warns=(L.state().warnings||[]).slice(0,4);
    return out;
  }
  /* ---- 参数组合扫描 ---- */
  function levelsOf(p){
    var o=optsOf(p); if(o) return o.slice(0);
    var lo=Number(p.min), hi=Number(p.max);
    if(!isFinite(lo)||!isFinite(hi)||hi<=lo) return [p.value];
    var r=[],i; for(i=0;i<LEVELS;i++) r.push(lo+(hi-lo)*i/(LEVELS-1)); return r;
  }
  function buildCombos(sp){
    var ps=sp.params||[], LV=[], i, j, space=1;
    for(i=0;i<ps.length;i++){ LV.push(levelsOf(ps[i])); space*=LV[i].length; }
    var combos=[], c, k;
    function pack(arr){ var o={},t; for(t=0;t<ps.length;t++) o[ps[t].key]=arr[t]; return o; }
    if(space<=150){
      var idx=[]; for(i=0;i<ps.length;i++) idx.push(0);
      for(;;){ var cur=[]; for(i=0;i<ps.length;i++) cur.push(LV[i][idx[i]]); combos.push(pack(cur));
        j=ps.length-1; for(;;){ if(j<0) break; idx[j]++; if(idx[j]<LV[j].length) break; idx[j]=0; j--; }
        if(j<0) break; }
    }
    /* 每参数逐档（其余默认）—— 这一族抓到过 "AgNO₃ 浓度推到上界必炸" */
    for(i=0;i<ps.length;i++) for(j=0;j<LV[i].length;j++){ c={}; c[ps[i].key]=LV[i][j]; combos.push(c); }
    /* 全 min / 全 max / 全 mid */
    var a1={}, a2={}, a3={};
    for(i=0;i<ps.length;i++){ a1[ps[i].key]=LV[i][0]; a2[ps[i].key]=LV[i][LV[i].length-1]; a3[ps[i].key]=LV[i][Math.floor(LV[i].length/2)]; }
    combos.push(a1); combos.push(a2); combos.push(a3);
    /* 参数对：极值混搭 + 同量纲"等值" */
    for(i=0;i<ps.length;i++) for(j=i+1;j<ps.length;j++){
      var A=LV[i], B=LV[j], x, y;
      var tri=[0, Math.floor(A.length/2), A.length-1], trj=[0, Math.floor(B.length/2), B.length-1], u, v;
      for(u=0;u<tri.length;u++) for(v=0;v<trj.length;v++){ c={}; c[ps[i].key]=A[tri[u]]; c[ps[j].key]=B[trj[v]]; combos.push(c); }
      if(!optsOf(ps[i]) && !optsOf(ps[j])){
        var lo=Math.max(Number(ps[i].min),Number(ps[j].min)), hi=Math.min(Number(ps[i].max),Number(ps[j].max));
        if(isFinite(lo)&&isFinite(hi)&&hi>=lo){
          for(x=0;x<LEVELS;x++){ var vv=lo+(hi-lo)*x/(LEVELS-1); c={}; c[ps[i].key]=vv; c[ps[j].key]=vv; combos.push(c); }
        }
      }
    }
    /* 空间大时补确定性随机采样 */
    if(space>150){
      var sd=987654321;
      function rnd(){ sd=(sd*1103515245+12345)%2147483648; return sd/2147483648; }
      for(i=0;i<96;i++){ c={}; for(j=0;j<ps.length;j++){ var arr=LV[j]; c[ps[j].key]=arr[Math.floor(rnd()*arr.length)]; } combos.push(c); }
    }
    /* 去重（按 key=value 序列）+ 截断到 120 组 */
    var seen={}, out=[];
    for(i=0;i<combos.length;i++){
      var key=ps.map(function(p){ return p.key+'='+String(combos[i][p.key]); }).join('|');
      if(seen[key]) continue; seen[key]=1; out.push(combos[i]);
      if(out.length>=120) break;
    }
    return { combos:out, space:space, keys:ps.map(function(p){ return p.key; }) };
  }
  function errApi(){
    var names=['reactErrorCount','reactionErrorCount','reactErrors','specErrorCount','specErrors','errorCount','errors'];
    for(var i=0;i<names.length;i++){
      var f=window.QG_CLAB[names[i]];
      if(typeof f==='function'){
        var nm=names[i];
        return { name:nm, read:function(id){
          var v=f(id);
          if(typeof v==='number') return v;
          if(v&&typeof v==='object'){ if(typeof v[id]==='number') return v[id]; if(typeof v.total==='number') return v.total; }
          return -1; } };
      }
    }
    return null;
  }
  /* 五类分开的计数快照；返回 {draw,react,step,pointer,conclude} 的 since 之和 */
  function counterSnapshot(id){
    var C=window.QG_CLAB.errorCounts;
    if(typeof C!=='function') return null;
    var o=C(id), out={}, k, sum=0;
    for(k in o){ if(Object.prototype.hasOwnProperty.call(o,k)){ out[k]=(o[k]&&typeof o[k].since==='number')?o[k].since:-1; if(out[k]>0) sum+=out[k]; } }
    return { kinds:out, sum:sum };
  }
  function scan(id){
    var L=window.QG_CLAB, sp=L.spec(id), B=buildCombos(sp), cs=B.combos, i, k;
    var out={ id:id, n:cs.length, space:B.space, levels:LEVELS, keys:B.keys,
      crashN:0, crashes:[], lastErrN:0, lastErrs:[], rowDrop:0, balStatus:{}, badBal:[],
      warnCombos:0, warnTexts:[], drawErrBefore:L.drawErrorCount(id), drawErrAfter:0,
      reactErrBefore:L.reactErrorCount(id), reactErrAfter:0, errCtr:null, counters:null, counterDelta:null };
    var api=errApi(); out.errApiName = api?api.name:'(未提供)';
    var snap0=counterSnapshot(id);
    for(i=0;i<cs.length;i++){
      var c=cs[i]; L.open(id);
      for(k in c){ if(Object.prototype.hasOwnProperty.call(c,k)) L.setParam(k, c[k]); }
      var got={}; for(k in c){ if(Object.prototype.hasOwnProperty.call(c,k)) got[k]=L.params()[k]; }
      var before=L.state().rows, err='';
      try { L.react(1); } catch(e){ err=String(e&&e.message||e); }
      var st=L.state(), after=st.rows, le=String(st.lastError||'');
      if(err){ out.crashN++; if(out.crashes.length<3) out.crashes.push({set:got, err:err}); }
      if(le){ out.lastErrN++; if(out.lastErrs.length<3) out.lastErrs.push({set:got, err:le}); }
      if(after===before && !err) out.rowDrop++;
      var t=L.table(), rw=t[t.length-1];
      if(rw&&rw.balanced){
        var s2=String(rw.balanced.status); out.balStatus[s2]=(out.balStatus[s2]||0)+1;
        if(s2!=='ok'&&s2!=='no-equation'&&out.badBal.length<4)
          out.badBal.push({ set:got, status:s2, eq:rw.equation, reason:String(rw.balanced.reason||'') });
      }
      if(st.warnings&&st.warnings.length){ out.warnCombos++; if(out.warnTexts.length<3) out.warnTexts.push({set:got, w:st.warnings.slice(0,2)}); }
    }
    out.drawErrAfter=L.drawErrorCount(id);
    out.reactErrAfter=L.reactErrorCount(id);
    var snap1=counterSnapshot(id); out.counters=snap1;
    if(snap0&&snap1){ out.counterDelta={}; for(k in snap1.kinds){ out.counterDelta[k]=snap1.kinds[k]-(snap0.kinds[k]||0); } }
    if(api){ try{ out.errCtr=api.read(id); }catch(e){ out.errCtr='ERR '+e.message; } }
    return out;
  }
  /* balance 正反例 + 退化拟合独立复核
     ⚠ 口径：segments[] **只在多段式（; ； ｜ |）时才有条目**；单段方程式的 segments 是空数组（长度 0），
     不是长度 1 —— 第一版我按"单段=1 段"写判据，假红了一次。 */
  function balanceBattery(){
    var L=window.QG_CLAB, out=[], cases=[
      ['ok-noDot', 'NH4Cl + H2O ⇌ NH3·H2O + HCl', 'ok', 0],
      ['ok-2seg-semi', 'Na2CO3 + 2HCl = 2NaCl + H2O + CO2↑；CO2 + Ca(OH)2 = CaCO3↓ + H2O', 'ok', 2],
      ['ok-2seg-bar', 'Na2CO3 + 2HCl = 2NaCl + H2O + CO2↑|CO2 + Ca(OH)2 = CaCO3↓ + H2O', 'ok', 2],
      ['ok-electron', 'Cu - 2e- = Cu2+', 'ok', 0],
      ['ok-plain', '2H2 + O2 = 2H2O', 'ok', 0],
      ['BAD-unbalanced', 'H2 + O2 = H2O', 'unbalanced', 0],
      ['BAD-2nd-seg', '2NaOH + CO2 = Na2CO3 + H2O；H2 + O2 = H2O', 'unbalanced', 2],
      ['no-eq', '无化学方程式（焰色试验是物理变化）', 'no-equation', 0]
    ];
    for(var i=0;i<cases.length;i++){
      var b=L.balance(cases[i][1]);
      out.push({ tag:cases[i][0], eq:cases[i][1], want:cases[i][2], got:b.status,
        segN:(b.segments?b.segments.length:0), wantSegN:cases[i][3],
        reason:String(b.reason||'').slice(0,120), bad:(b.bad||[]).join(','),
        ok:(b.status===cases[i][2]) });
    }
    return out;
  }
  function degenerateCheck(){
    var L=window.QG_CLAB, out={};
    L.open('iron-ion-test');
    for(var i=0;i<8;i++){ L.setParam('fvol', 0.2+(5.0-0.2)*i/7); L.react(1); }
    var g=L.graph();
    out.constant={ degenerate:(g?g.degenerate:null), fit:(g&&g.fit)?'obj':'null', fitNote:String(g?g.fitNote:''),
      points:g?g.points.length:0, r2:(g&&g.fit)?g.fit.r2:null };
    L.open('iron-ion-test'); L.setParam('sample','fe3');
    for(var j=0;j<6;j++){ L.setParam('fvol', 0.2+(1.0-0.2)*j/5); L.react(1); }
    var g2=L.graph();
    out.varying={ degenerate:(g2?g2.degenerate:null), fit:(g2&&g2.fit)?'obj':'null', fitNote:String(g2?g2.fitNote:''),
      points:g2?g2.points.length:0, r2:(g2&&g2.fit)?g2.fit.r2:null };
    return out;
  }
  /* 核心 react 防御的负对照（会往注册表塞一个合成 spec，必须放在最后跑） */
  function reactDefense(){
    var L=window.QG_CLAB, out={};
    L.register('__clab_throwtest', {
      id:'__clab_throwtest', name:'自检·react 抛错', group:'自检',
      aim:'x', principle:'x', apparatus:['x'], steps:['x'],
      params:[{key:'k',label:'k',unit:'',min:0,max:1,step:0.1,value:0.5}],
      react:function(){ throw new Error('NEGCTL-react-boom'); },
      columns:[], graph:null,
      conclude:function(){ return {text:'t',equation:'',ionic:'',errors:['a','b']}; },
      draw:function(g){ g.text('x',10,10,12); }
    });
    L.open('__clab_throwtest');
    var c0=counterSnapshot('__clab_throwtest');
    var threw='', ret=null;
    try{ ret=L.react(1); }catch(e){ threw=String(e&&e.message||e); }
    var st=L.state();
    out.core={ threw:threw, isArray:(Object.prototype.toString.call(ret)==='[object Array]'),
      len:ret?ret.length:-1, lastError:String(st.lastError||''),
      reactErrors:L.reactErrorCount('__clab_throwtest'), rows:st.rows,
      stateReactErrors:st.reactErrors, stateReactTotal:st.reactErrorsTotal,
      counters:counterSnapshot('__clab_throwtest'), countersBefore:c0 };
    var direct='';
    try{ L.spec('__clab_throwtest').react({k:0.5},{}); }catch(e){ direct=String(e&&e.message||e); }
    out.direct={ threw:direct };
    return out;
  }
  function apiSurface(){
    var k=Object.keys(window.QG_CLAB).sort();
    var st=null; try{ st=Object.keys(window.QG_CLAB.state()).sort(); }catch(e){ st=[String(e)]; }
    return { keys:k, stateKeys:st, hasReactErr:typeof window.QG_CLAB.reactErrorCount,
      hasDrawErr:typeof window.QG_CLAB.drawErrorCount, hasErrorCounts:typeof window.QG_CLAB.errorCounts,
      errType: String(window.QG_CLAB.reactErrorCount('na-water')),
      counts: window.QG_CLAB.errorCounts('na-water') };
  }
  /* ---- 负对照 ---- */
  function negctl(id){
    var L=window.QG_CLAB, sp=L.spec(id), out={ id:id };
    document.querySelector('.cl-item[data-id="'+id+'"]').click();
    L.pause();
    var orig=sp.draw, cap=null;
    sp.draw=function(g2,p2,st2){ cap={p:p2, st:st2}; return orig.apply(this,arguments); };
    var ps=sp.params||[], kv=null, i;
    for(i=0;i<ps.length;i++){
      if(!optsOf(ps[i]) && isFinite(Number(ps[i].min)) && Number(ps[i].max)>Number(ps[i].min)){
        kv={k:ps[i].key, v:Number(ps[i].min)+(Number(ps[i].max)-Number(ps[i].min))*0.37}; break; }
    }
    ops.length=0; liveN=0; throwAt=0;
    if(kv) L.setParam(kv.k, kv.v);
    var clean=ops.length;
    var K=Math.max(4, Math.floor(clean/2));
    ops.length=0; liveN=0; throwAt=K;
    if(kv) L.setParam(kv.k, kv.v);
    var liveBad=ops.slice();
    throwAt=0;
    out.clean=clean; out.K=K; out.liveBad=liveBad.length;
    out.drawErr=L.drawErrorCount(id); out.lastError=String(L.state().lastError||'');
    var replayOps=[], replayErr='';
    if(cap){
      var fake=new FakeCtx(), W=L.state().canvas.w, H=L.state().canvas.h;
      var cvEl=document.getElementById('clCanvas');
      var dpr2=Math.max(1, Math.round(cvEl.width/Math.max(1,W)));
      try{ orig(mkG(fake,W,H,dpr2), cap.p, cap.st); }catch(e){ replayErr=String(e&&e.message||e); }
      replayOps=fake.ops;
    }
    sp.draw=orig;
    out.replayN=replayOps.length; out.diff=liveBad.length-replayOps.length;
    out.tailEq=(JSON.stringify(liveBad.slice(-3))===JSON.stringify(replayOps.slice(-3)));
    out.red=!(out.diff===3 && out.tailEq===true);
    out.replayErr=replayErr;
    ops.length=0; liveN=0; throwAt=0;
    if(kv) L.setParam(kv.k, kv.v);
    var liveGood=ops.slice();
    out.goodN=liveGood.length; out.goodDiff=liveGood.length-replayOps.length;
    out.goodTailEq=(JSON.stringify(liveGood.slice(-3))===JSON.stringify(replayOps.slice(-3)));
    out.greenAgain=(out.goodDiff===3 && out.goodTailEq===true);
    return out;
  }
  return { patch:patch, ops:ops, row:row, scan:scan, negctl:negctl, r2plan:R2PLAN, LEVELS:LEVELS,
    distinctX:distinctX, buildCombos:buildCombos, errApiName:function(){ var a=errApi(); return a?a.name:null; },
    balanceBattery:balanceBattery, degenerateCheck:degenerateCheck, reactDefense:reactDefense,
    apiSurface:apiSurface, counterSnapshot:counterSnapshot };
})(); window.__CP.patch(); 'ok'`;

/* ==================================== 主流程 ==================================== */
(async () => {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(OUTDIR, { recursive: true });
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + DPORT, '--user-data-dir=' + PROFILE, '--window-size=1440,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let c = null;
  const report = { version: null, rows: [], scans: [], negctl: [], results: results };
  try {
    c = await CDP.connect(DPORT);
    await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Log.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const SUBJ_SRC = (s) => 'try{window.CUR_SUBJECT=' + JSON.stringify(s) + ';}catch(e){}' +
      'try{localStorage.setItem("qg_subject",' + JSON.stringify(s) + ');}catch(e){}' +
      'try{localStorage.setItem("qg_live_state",JSON.stringify({t:Date.now(),subject:' + JSON.stringify(s) + '}));}catch(e){}';
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: SUBJ_SRC('chem') + 'try{window.__openCalls=[];window.open=function(){window.__openCalls.push([].slice.call(arguments));return null;};}catch(e){}'
    });
    await c.send('Page.navigate', { url: BASE });
    let booted = false;
    for (let i = 0; i < 180; i++) {
      if (await c.eval('!!(window.QG_CLAB && window.QG_CLAB.list && window.QG_CLAB.list().length===50)')) { booted = true; break; }
      await sleep(200);
    }
    if (!booted) { check('B0 boot（化学科目，QG_CLAB.list().length===50）', false, '25s 超时：检查服务器端口/入口接线/guanlan.html 是否加载 7 个脚本'); throw new Error('boot timeout'); }
    const p = await c.eval(HELPER);
    info('画布指令拦截器', JSON.stringify(p));
    report.version = { build: await c.eval('window.QG_CLAB.build'), ver: await c.eval('window.QG_CLAB.version') };
    report.errApiName = await c.eval('window.__CP.errApiName()');
    check('B0 boot：化学科目下 50 个反应登记完成，QG_CLAB.build 为指纹', (await c.eval('window.QG_CLAB.list().length')) === 50,
      'build=' + report.version.build + ' version=' + report.version.ver);

    /* ---------------- P1 入口 / 互斥 / 收尾 ---------------- */
    console.log('\n=== P1 入口 · 三方互斥 · Esc 收尾 ===');
    const e1 = await c.eval(`(function(){ var A=window.__CP;
      var el=document.getElementById('glClBtn'), r=el?el.getBoundingClientRect():null;
      function has(id){ var e=document.getElementById(id); return e?{x:1,hidden:!!e.hidden,disp:getComputedStyle(e).display}:{x:0}; }
      return { cl:has('glClBtn'), ps:has('glPsBtn'), pl:has('glPlBtn'),
        text:String(el?el.textContent:''), rect:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
        onScreen:r?(r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth&&r.width>0&&r.height>0):null,
        clNodes:document.querySelectorAll('[class^=cl-],[class*= cl-]').length,
        clCSS:!!document.getElementById('clCSS'), isChem:window.QG_CLAB.isChemSubject() }; })()`);
    check('E1 化学科目：#glClBtn 存在/可见/在视口内/文案「🧪 化学实验台」，沙盒与物理实验台入口都不存在',
      e1.cl.x === 1 && e1.cl.hidden === false && e1.onScreen === true && e1.text === '🧪 化学实验台' &&
      e1.ps.x === 0 && e1.pl.x === 0 && e1.isChem === true, JSON.stringify(e1));
    const e2 = await c.eval(`(function(){
      document.getElementById('glClBtn').click();
      var st=window.QG_CLAB.state(), cv=document.getElementById('clCanvas'), r=cv?cv.getBoundingClientRect():null;
      var L=document.querySelector('.cl-left'), M=document.querySelector('.cl-mid'), R=document.querySelector('.cl-right');
      var b=document.getElementById('glClBtn');
      return { mounted:window.QG_CLAB.isMounted(), open:st.open, cvPx:cv?[cv.width,cv.height]:null,
        cvBox:r?[Math.round(r.width),Math.round(r.height)]:null, three:[!!L,!!M,!!R],
        items:document.querySelectorAll('.cl-item').length, groups:document.querySelectorAll('.cl-grp').length,
        clCSS:!!document.getElementById('clCSS'), btn:String(b.textContent),
        stage:String((document.getElementById('glStage')||{}).className) }; })()`);
    await sleep(400);
    check('E2 真点击入口 → isMounted/open、三栏建好、#clCanvas>0、#clCSS 注入、6 组 50 项、按钮变「↩ 返回演示」',
      e2.mounted === true && e2.open === true && e2.three[0] && e2.three[1] && e2.three[2] &&
      e2.cvPx[0] > 0 && e2.cvPx[1] > 0 && e2.clCSS === true && e2.items === 50 && e2.groups === 6 &&
      e2.btn === '↩ 返回演示' && e2.stage.indexOf('cl-on') >= 0, JSON.stringify(e2));
    const e3 = await c.eval(`(function(){
      window.QG_CLAB.close();
      var stage=document.getElementById('glStage');
      window.QG_PSANDBOX.mount(stage, {preset:''});
      var before=window.QG_PSANDBOX.isMounted(), domBefore=document.querySelectorAll('[class^=ps-],[class*= ps-]').length;
      document.getElementById('glClBtn').click();
      return { before:before, domBefore:domBefore, after:window.QG_PSANDBOX.isMounted(),
        domAfter:document.querySelectorAll('[class^=ps-],[class*= ps-]').length, chem:window.QG_CLAB.isMounted() }; })()`);
    await sleep(300);
    check('E3 互斥（化学 ← 沙盒）：强制挂沙盒 → 真点 #glClBtn → 沙盒 isMounted()===false、ps- DOM 清零、化学台开',
      e3.before === true && e3.after === false && e3.domAfter === 0 && e3.chem === true, JSON.stringify(e3));
    const e4 = await c.eval(`(function(){
      window.QG_CLAB.close();
      var stage=document.getElementById('glStage');
      window.QG_PSLAB.mount(stage, {}); window.QG_PSLAB.open('linear-motion');
      var before=window.QG_PSLAB.isMounted(), domBefore=document.querySelectorAll('[class^=pl-],[class*= pl-]').length;
      document.getElementById('glClBtn').click();
      return { before:before, domBefore:domBefore, after:window.QG_PSLAB.isMounted(),
        domAfter:document.querySelectorAll('[class^=pl-],[class*= pl-]').length,
        plCSS:!!document.getElementById('plCSS'), chem:window.QG_CLAB.isMounted() }; })()`);
    await sleep(300);
    check('E4 互斥（化学 ← 物理实验台）：强制挂物理台 → 真点 #glClBtn → 物理台收、pl- DOM 与 #plCSS 清零、化学台开',
      e4.before === true && e4.after === false && e4.domAfter === 0 && e4.plCSS === false && e4.chem === true, JSON.stringify(e4));
    const e5 = await c.eval(`(function(){
      var b=document.getElementById('glClBtn'); b.click();
      return { mounted:window.QG_CLAB.isMounted(), open:window.QG_CLAB.state().open,
        clNodes:document.querySelectorAll('[class^=cl-],[class*= cl-]').length,
        clCSS:!!document.getElementById('clCSS'), btn:String(b.textContent), cls:String(b.className),
        stage:String((document.getElementById('glStage')||{}).className) }; })()`);
    await sleep(300);
    check('E5 再点一次 → 化学台收：#clCSS 卸净、cl- DOM 0 个、按钮文案与舞台类名还原',
      e5.mounted === false && e5.open === false && e5.clNodes === 0 && e5.clCSS === false &&
      e5.btn === '🧪 化学实验台' && e5.cls === '' && e5.stage.indexOf('cl-on') < 0, JSON.stringify(e5));
    await c.eval('document.getElementById("glClBtn").click()'); await sleep(300);
    const e6 = await c.eval(`(function(){
      document.querySelector('.cl-item[data-id="na-water"]').click();
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      var b=document.getElementById('glClBtn');
      var a={ mounted:window.QG_CLAB.isMounted(), clNodes:document.querySelectorAll('[class^=cl-],[class*= cl-]').length,
        clCSS:!!document.getElementById('clCSS'), btn:String(b.textContent), root:!!document.getElementById('clRoot') };
      document.getElementById('glClBtn').click();
      a.againItems=document.querySelectorAll('.cl-item').length;
      a.againGroups=document.querySelectorAll('.cl-grp').length;
      a.againCSS=!!document.getElementById('clCSS');
      return a; })()`);
    await sleep(400);
    check('E6 真派发 Esc → DOM/#clCSS 全清、isMounted=false、按钮还原；再进一次仍 50 项 6 组',
      e6.mounted === false && e6.clNodes === 0 && e6.clCSS === false && e6.root === false &&
      e6.btn === '🧪 化学实验台' && e6.againItems === 50 && e6.againGroups === 6 && e6.againCSS === true, JSON.stringify(e6));

    /* ---------------- P2 50 行表 ---------------- */
    console.log('\n=== P2 50 行表（契约 §4 八条） ===');
    const ids = JSON.parse(await c.eval('JSON.stringify(window.QG_CLAB.list().map(function(x){return x.id;}))'));
    for (const id of ids) {
      let r;
      try { r = await c.eval('window.__CP.row(' + JSON.stringify(id) + ')'); }
      catch (e) { r = { id: id, evalError: String(e && e.message || e).slice(0, 300) }; }
      report.rows.push(r);
      const g = r.graph;
      console.log('  ' + String(id).padEnd(22) +
        ' 现象=' + r.phenN + ' bal=' + r.bal + ' 方向=' + r.dirChanged + '/' + r.dirN +
        ' 图=' + (r.cols === 0 ? 'null(定性合法)' : (g ? (g.dx + 'x/' + g.points + '点 r²=' + (g.fit ? (Math.round(g.fit.r2 * 1e4) / 1e4) : 'null')) : '✗无')) +
        ' draw=' + (r.draw ? r.draw.liveN + '/' + r.draw.replayN + '(差' + r.draw.diff + ')' : '?') +
        ' 门禁=' + r.drawErr + (r.lastError ? '/ERR' : '/ok') + (r.warnN ? ' warn' + r.warnN : '') +
        (r.sweepCrash ? ' ★扫参数崩' + r.sweepCrash : '') +
        (r.evalError ? ' ★EVAL-ERR' : ''));
      if (r.evalError) console.log('     ' + r.evalError);
    }
    const R = report.rows;
    const withId = R.filter(r => !r.evalError && !r.missing);
    check('C1 50 个反应全部取到证据行（无 eval 异常 / 无 missing）', withId.length === 50 && R.length === 50,
      'n=' + R.length + ' ok=' + withId.length + ' err=' + R.filter(r => r.evalError).length);
    const badClick = withId.filter(r => r.curId !== r.id || r.open !== true || r.hl !== true || !(r.cvW > 0 && r.cvH > 0));
    check('C2 真点击：current().id 正确 / open===true / 左栏唯一高亮 / canvas>0（50/50）', badClick.length === 0,
      'bad=' + badClick.length + (badClick[0] ? ' :: ' + JSON.stringify(badClick[0]).slice(0, 200) : ''));
    const badPh = withId.filter(r => !(r.phenN >= 2));
    const badRows = withId.filter(r => r.rowsDelta[1] !== r.rowsDelta[0] + 1);
    check('C3 真点 🔬 → rows +1 且 phenomena ≥2 条（50/50）', badPh.length === 0 && badRows.length === 0,
      'badPh=' + badPh.length + ' badRows=' + badRows.length);
    const badCT = withId.filter(r => !r.cond || !r.type);
    check('C4 conditions / type 非空（50/50）', badCT.length === 0, 'bad=' + badCT.length);
    const balSet = {}; withId.forEach(r => balSet[r.bal] = (balSet[r.bal] || 0) + 1);
    const balBad = withId.filter(r => r.bal !== 'ok' && r.bal !== 'no-equation');
    const noEq = withId.filter(r => r.bal === 'no-equation').map(r => r.id);
    check('C5 balance(react().equation) 的 status ∈ {ok, no-equation}（no-equation 合法；unbalanced 才是缺陷）',
      balBad.length === 0 && balSet['ok'] > 0,
      'ok=' + (balSet['ok'] || 0) + ' no-equation=' + (balSet['no-equation'] || 0) + ' 其它=' + JSON.stringify(balBad.map(r => r.id + ':' + r.bal + ':' + r.balReason)) + ' no-equation 名单=' + JSON.stringify(noEq));
    const badCon = withId.filter(r => !r.con || !(r.con.errN >= 2) || !r.con.textLen || !r.con.eq);
    check('C6 conclude() 返回 {text,equation,ionic,errors[]} 且 errors.length ≥2（50/50）', badCon.length === 0,
      'bad=' + badCon.length + (badCon[0] ? ' :: ' + JSON.stringify(badCon[0].con) : ''));
    const qual = withId.filter(r => r.cols === 0);
    const badQual = qual.filter(r => r.graphNull !== true);
    check('C7 columns:[] 的反应 graph() 返回 null（合法，不判红）', badQual.length === 0 && qual.length >= 20,
      '定性=' + qual.length + ' bad=' + JSON.stringify(badQual.map(r => r.id)));
    const quant = withId.filter(r => r.cols > 0);
    const badQuant = quant.filter(r => r.graphNull === true || !r.graph || !(r.graph.points >= 5) || !(r.graph.dx >= 6));
    check('C8 有定量列 ⇒ graph() 非 null、points ≥5、不同 x ≥6', badQuant.length === 0,
      '定量=' + quant.length + ' bad=' + JSON.stringify(badQuant.map(r => r.id + ' ' + JSON.stringify(r.graph))));
    /* C9：r² 三条件 */
    const linear = quant.filter(r => r.graphDecl && r.graphDecl.fit !== 'none' && r.graphDecl.fit !== 'false');
    const badR2 = [], vacuous = [];
    linear.forEach(r => {
      const g = r.graph;
      if (!g) { badR2.push(r.id + ':无图'); return; }
      if (g.degenerate) { vacuous.push(r.id); badR2.push(r.id + ':y 是常数序列（退化 r²）'); return; }
      if (!(g.dx >= 6)) { badR2.push(r.id + ':不同 x<6'); return; }
      if (!g.fit || !(g.fit.r2 > 0.9)) badR2.push(r.id + ':r²=' + (g.fit ? g.fit.r2 : 'null') + ' via=' + g.via);
    });
    check('C9 ★r²：y 非常数 + x 有分布（≥6）+ 在自述线性区内 → r²>0.9（三条件缺一不可）', badR2.length === 0,
      'linear=' + linear.length + ' bad=' + JSON.stringify(badR2) + ' 退化=' + JSON.stringify(vacuous));
    info('C9 各反应选中的扫法与 r²', JSON.stringify(linear.map(r => r.id + ' :: ' + (r.graph ? r.graph.via : '-') + ' → r²=' + (r.graph && r.graph.fit ? (Math.round(r.graph.fit.r2 * 1e6) / 1e6) : 'null'))));
    const fitNone = quant.filter(r => r.graphDecl && (r.graphDecl.fit === 'none' || r.graphDecl.fit === 'false'));
    const badNone = fitNone.filter(r => !r.graph || r.graph.fit || !(r.graph.points >= 5) ||
      (String(r.graphDecl.note).length + String(r.graphDecl.title).length) <= 8);
    check('C10 fit:none 的反应 ⇒ 出点但 fit=null，且 note/title 写明「为什么不该线性拟合」', fitNone.length >= 1 && badNone.length === 0,
      'n=' + fitNone.length + ' bad=' + JSON.stringify(badNone.map(r => r.id)));
    const badDir = withId.filter(r => !(r.dirChanged >= 2));
    check('C11 方向性（每个参数先复位其余参数）：≥2 个参数让现象或量化量变化（50/50）', badDir.length === 0,
      'bad=' + JSON.stringify(badDir.map(r => r.id + ' ' + r.dirChanged + '/' + r.dirN + ' noChange=' + JSON.stringify(r.noChange))));
    const badDraw = withId.filter(r => !r.draw || r.draw.diff !== 3 || r.draw.tailEq !== true || r.draw.replayErr);
    check('C12 ★"画到最后一笔"指令级对照：条数差==3 且末 3 条相同（50/50）', badDraw.length === 0,
      'bad=' + badDraw.length + (badDraw[0] ? ' :: ' + JSON.stringify(badDraw.slice(0, 3).map(r => ({ id: r.id, d: r.draw }))).slice(0, 500) : ''));
    const badDE = withId.filter(r => r.drawErr !== 0);
    check('C13 QG_CLAB.drawErrorCount(id)===0（50/50）', badDE.length === 0, 'bad=' + JSON.stringify(badDE.map(r => r.id + ':' + r.drawErr)));
    const badLE = withId.filter(r => r.lastError !== '');
    check('C14 state().lastError 全空（默认条件，50/50）', badLE.length === 0, 'bad=' + JSON.stringify(badLE.map(r => r.id + ' :: ' + r.lastError)));
    const badW = withId.filter(r => r.warnN !== 0);
    check('C15 state().warnings 全空（50/50）', badW.length === 0, 'bad=' + JSON.stringify(badW.map(r => r.id + ' ' + JSON.stringify(r.warns))));

    /* ---------------- P2.5 核心闸门与 balance 正反例 ---------------- */
    console.log('\n=== P2.5 核心闸门（balance 正反例 / 退化拟合）===');
    const SFC = await c.eval('window.__CP.apiSurface()');
    info('API 面', JSON.stringify({ hasReactErr: SFC.hasReactErr, hasErrorCounts: SFC.hasErrorCounts, counts: SFC.counts }));
    check('G-API 核心暴露 reactErrorCount / errorCounts（五类分开的计数）', SFC.hasReactErr === 'function' && SFC.hasErrorCounts === 'function',
      JSON.stringify({ reactErr: SFC.hasReactErr, counts: SFC.hasErrorCounts, sample: SFC.counts }));
    const BB = await c.eval('window.__CP.balanceBattery()');
    BB.forEach(b => console.log('  BAL ' + String(b.tag).padEnd(16) + ' want=' + String(b.want).padEnd(11) + ' got=' + String(b.got).padEnd(11) +
      ' seg=' + b.segN + '/' + b.wantSegN + (b.reason ? '  reason=' + JSON.stringify(b.reason.slice(0, 70)) : '')));
    const balFail = BB.filter(b => !b.ok || b.segN !== b.wantSegN);
    check('BAL-1..4 正例：不带数字的 `·`、`；`/`|` 多段（segments 逐段 2 条）、减电子写法 → 全判 ok',
      BB.slice(0, 5).every(b => b.ok) && BB[1].segN === 2 && BB[2].segN === 2 && BB[0].segN === 0,
      JSON.stringify(BB.slice(0, 5)));
    check('BAL-5/6 反例（闸门没被放松）：故意不配平 → unbalanced，且多段式指出是第几段',
      BB[5].got === 'unbalanced' && BB[6].got === 'unbalanced' && /第\s*2\s*段/.test(BB[6].reason),
      JSON.stringify(BB.slice(5)));
    check('BAL-7 no-equation 仍判 no-equation（合法档，不标红）', BB[7].got === 'no-equation', JSON.stringify(BB[7]));
    check('BAL 全部 8 条正反例全过', balFail.length === 0, JSON.stringify(balFail));
    const DG = await c.eval('window.__CP.degenerateCheck()');
    info('DEG 明细', JSON.stringify(DG));
    check('DEG-1 常数序列（iron-ion-test 默认 fe2 颜色恒 0）→ fit=null 且 degenerate=true 且 fitNote 非空（不再假绿 r²=1）',
      DG.constant.degenerate === true && DG.constant.fit === 'null' && DG.constant.fitNote.length > 0 && DG.constant.points >= 5,
      JSON.stringify(DG.constant));
    check('DEG-2 同一反应换成有分布的 fe3 数据 → degenerate=false 且 fit 非 null（不是"一律报退化"）',
      DG.varying.degenerate === false && DG.varying.fit === 'obj', JSON.stringify(DG.varying));

    /* ---------------- P3 参数组合扫描 ---------------- */
    console.log('\n=== P3 参数组合扫描（每反应 6 档/参数 + 边界集，上限 120 组；每组都读 lastError/drawErrorCount/balance/warnings） ===');
    for (const id of ids) {
      let s;
      try { s = await c.eval('window.__CP.scan(' + JSON.stringify(id) + ')'); }
      catch (e) { s = { id: id, scanError: String(e && e.message || e).slice(0, 200), n: 0 }; }
      report.scans.push(s);
      const flag = (s.crashN || s.lastErrN || (s.badBal && s.badBal.length) || s.warnCombos || s.rowDrop) ? '  ★' : '';
      console.log('  ' + String(id).padEnd(22) + ' 组=' + String(s.n).padStart(3) + ' 崩溃=' + s.crashN +
        ' lastError=' + s.lastErrN + ' 掉行=' + s.rowDrop + ' 平衡=' + JSON.stringify(s.balStatus) +
        ' warn组=' + s.warnCombos + ' drawErrΔ=' + ((s.drawErrAfter || 0) - (s.drawErrBefore || 0)) +
        ' errCtr=' + JSON.stringify(s.errCtr) + flag +
        (s.crashN ? '  例=' + JSON.stringify(s.crashes[0]).slice(0, 160) : '') +
        ((s.badBal && s.badBal.length) ? '  非ok方程=' + JSON.stringify(s.badBal[0]).slice(0, 160) : ''));
    }
    const S = report.scans;
    const few = S.filter(s => !(s.n >= 60));
    check('S1 每个反应 ≥60 组参数组合', few.length === 0,
      'min=' + Math.min.apply(null, S.map(s => s.n)) + ' total=' + S.reduce((a, s) => a + s.n, 0) + ' bad=' + JSON.stringify(few.map(s => s.id + ':' + s.n)));
    const crash = S.filter(s => s.crashN > 0);
    check('S2 react() 在可达参数组合下不抛异常（0 崩溃）', crash.length === 0,
      JSON.stringify(crash.map(s => ({ id: s.id, n: s.crashN, ex: s.crashes }))).slice(0, 900));
    const le = S.filter(s => s.lastErrN > 0);
    check('S3 没有组合让 state().lastError 非空（react/conclude/draw/step 都不炸）', le.length === 0,
      JSON.stringify(le.map(s => ({ id: s.id, n: s.lastErrN, ex: s.lastErrs }))).slice(0, 900));
    const bb = S.filter(s => s.badBal && s.badBal.length);
    const parseBad = S.filter(s => s.badBal && s.badBal.some(b => b.status === 'unparsed'));
    check('S4 组合扫描里 equation 的 balance().status 只允许 {ok, no-equation}（含 `·` 与 `；` 两处解析面）',
      bb.length === 0, JSON.stringify(bb.map(s => ({ id: s.id, ex: s.badBal }))).slice(0, 900));
    const de = S.filter(s => (s.drawErrAfter || 0) !== (s.drawErrBefore || 0));
    check('S5 组合扫描里 drawErrorCount 增量为 0', de.length === 0,
      JSON.stringify(de.map(s => s.id + ':' + s.drawErrBefore + '→' + s.drawErrAfter)));
    const wc = S.filter(s => s.warnCombos > 0);
    check('S6 组合扫描里 0 个组合产生 register/运行期体检 warning', wc.length === 0,
      JSON.stringify(wc.map(s => ({ id: s.id, n: s.warnCombos, ex: s.warnTexts }))).slice(0, 700));
    const ecBad = S.filter(s => typeof s.errCtr === 'number' && s.errCtr > 0);
    const ctrBad = S.filter(s => s.counterDelta && Object.keys(s.counterDelta).some(k => s.counterDelta[k] !== 0));
    check('S7 反应错误计数 reactErrorCount(id) 在所有组合下为 0', ecBad.length === 0,
      '接口名=' + report.errApiName + ' 非零=' + JSON.stringify(ecBad.map(s => s.id + ':' + s.errCtr)));
    check('S7b errorCounts(id) 五类（draw/react/step/pointer/conclude）在本反应扫描期间增量全为 0',
      ctrBad.length === 0,
      JSON.stringify(ctrBad.map(s => ({ id: s.id, delta: s.counterDelta, counters: s.counters }))).slice(0, 800));
    const balAll = {}; S.forEach(s => { for (const k in (s.balStatus || {})) balAll[k] = (balAll[k] || 0) + s.balStatus[k]; });
    info('S8 全参数空间的 balance 状态分布', JSON.stringify(balAll) + '（unparsed 组数=' +
      S.reduce((a, s) => a + ((s.balStatus || {}).unparsed || 0), 0) + '）');
    info('S9 unparsed 明细（修复 `·`/`；` 后应为 0）', JSON.stringify(parseBad.map(s => ({ id: s.id, ex: s.badBal.filter(b => b.status === 'unparsed').slice(0, 2) }))).slice(0, 1200));

    /* ---------------- P4 负对照 ---------------- */
    console.log('\n=== P4 负对照（"画到最后一笔"判据的灵敏性）===');
    for (const id of ['na-water', 'acid-base-titration']) {
      const neg = await c.eval('window.__CP.negctl(' + JSON.stringify(id) + ')');
      report.negctl.push(neg);
      check('N 负对照[' + id + ']：注入中途抛错 → 判据变红（实况 ' + neg.liveBad + ' < 重放 ' + neg.replayN + ' +3）；移除后回到绿',
        neg.red === true && neg.liveBad < neg.replayN + 3 && neg.greenAgain === true,
        JSON.stringify({ clean: neg.clean, K: neg.K, liveBad: neg.liveBad, replayN: neg.replayN, red: neg.red, goodDiff: neg.goodDiff, greenAgain: neg.greenAgain, lastError: neg.lastError }));
    }

    /* ---------------- P4.5 核心 react 防御的负对照 ----------------
       ⚠ 必须放在 P5（切科目 → 页面重载 → window.__CP 消失）之前；合成的 spec 只存在于本页注册表，
       导航后自然消失，不会污染 50 项的门禁。 */
    console.log('\n=== P4.5 核心 react 防御负对照（合成 spec）===');
    const RD = await c.eval('window.__CP.reactDefense()');
    report.reactDefense = RD;
    info('明细', JSON.stringify(RD));
    check('REACT-DEF QG_CLAB.react() 不把 spec.react 的异常冒给调用方：返回空数组 + lastError + 计数 +1 + 不出行',
      RD.core.threw === '' && RD.core.isArray === true && RD.core.len === 0 &&
      /NEGCTL-react-boom/.test(RD.core.lastError) && RD.core.reactErrors >= 1 && RD.core.rows === 0 &&
      RD.core.stateReactErrors >= 1 && RD.core.counters && RD.core.counters.kinds.react >= 1,
      JSON.stringify(RD.core));
    check('REACT-DEF-2 直调 spec.react() 仍抛（负对照证明是真拦住了东西，不是判据本身无效）',
      /NEGCTL-react-boom/.test(RD.direct.threw), JSON.stringify(RD.direct));

    /* ---------------- P5 跨科目零污染 ---------------- */
    console.log('\n=== P5 跨科目零污染（math） ===');
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: SUBJ_SRC('math') });
    await c.send('Page.navigate', { url: BASE });
    for (let i = 0; i < 120; i++) { if (await c.eval('!!(window.QG_CLAB && window.__guanlanTest)')) break; await sleep(200); }
    await sleep(500);
    const mx = await c.eval(`(function(){ var e=document.getElementById('glClBtn');
      return { clBtn:!!e, clNodes:document.querySelectorAll('[class^=cl-],[class*= cl-]').length,
        clCSS:!!document.getElementById('clCSS'), glClCSS:!!document.getElementById('glClCSS'),
        clMounted:window.QG_CLAB.isMounted(), coreChem:window.QG_CLAB.isChemSubject(),
        psBtn:!!document.getElementById('glPsBtn'), plBtn:!!document.getElementById('glPlBtn'),
        subj:String(window.CUR_SUBJECT) }; })()`);
    check('X1 math 科目：#glClBtn 不存在、cl- 前缀 DOM 0 个、#clCSS/#glClCSS 未注入、化学台未挂载',
      mx.clBtn === false && mx.clNodes === 0 && mx.clCSS === false && mx.glClCSS === false &&
      mx.clMounted === false && mx.coreChem === false && mx.subj === 'math', JSON.stringify(mx));

    /* ---------------- P6 全局 ---------------- */
    console.log('\n=== P6 全局（console / window.open）===');
    const errs = c.errors.slice(0);
    check('G1 全程 0 条 Runtime.exceptionThrown', errs.length === 0, 'n=' + errs.length + (errs[0] ? ' :: ' + errs[0].slice(0, 300) : ''));
    const oc = await c.eval('(window.__openCalls||[]).length');
    check('G2 window.open 间谍：全程 0 次调用（真点击路径不许解析到 window.open）', oc === 0, 'openCalls=' + oc);

    /* ---------------- 50 行表落盘 ---------------- */
    const md = ['| # | id | 方向（其余条件取默认） | balance | 现象 | 图 | conclude | draw 实况/重放 | 组合扫描 | 门禁 |',
      '|---|---|---|---|---|---|---|---|---|---|'];
    report.rows.forEach((r, i) => {
      if (r.evalError || r.missing) { md.push('| ' + (i + 1) + ' | `' + r.id + '` | ★EVAL-ERR | | | | | | | ' + String(r.evalError).replace(/\|/g, '/') + ' |'); return; }
      const g = r.cols === 0 ? 'null（定性，合法）' : (r.graph ? (r.graph.via + '；x ' + r.graph.dx + ' 点；' +
        (r.graph.fit ? 'r²=' + (Math.round(r.graph.fit.r2 * 1e4) / 1e4) : 'fit=null(' + r.graphDecl.fit + ')')) : '✗无');
      const s = report.scans.find(x => x.id === r.id) || {};
      md.push('| ' + (i + 1) + ' | `' + r.id + '` | ' + ((r.dirA ? r.dirA.key + '：' + r.dirA.txt : '—') + ' ／ ' + (r.dirB ? r.dirB.key + '：' + r.dirB.txt : '—')).replace(/\|/g, '/') +
        ' | ' + (r.bal === 'no-equation' ? 'no-equation ✔合法' : r.bal) + ' | ' + r.phenN + ' | ' + g.replace(/\|/g, '/') +
        ' | errors=' + r.con.errN + '，' + r.con.textLen + ' 字 | ' + r.draw.liveN + '/' + r.draw.replayN + '（差 ' + r.draw.diff + '）' +
        ' | 组=' + (s.n || 0) + ' 崩溃=' + (s.crashN || 0) + ' lastError=' + (s.lastErrN || 0) + ' warn=' + (s.warnCombos || 0) +
        ' | drawErr=' + r.drawErr + ' warn=' + r.warnN + ' |');
    });
    fs.writeFileSync(path.join(OUTDIR, 'clab_table50.md'), md.join('\n'), 'utf8');
    fs.writeFileSync(path.join(OUTDIR, 'clab_probe_report.json'), JSON.stringify(report, null, 1), 'utf8');
    console.log('\nWROTE ' + path.join(OUTDIR, 'clab_probe_report.json'));
    console.log('WROTE ' + path.join(OUTDIR, 'clab_table50.md'));
  } catch (e) {
    check('harness error', false, (e && e.stack || e).slice(0, 700));
    try { fs.writeFileSync(path.join(OUTDIR, 'clab_probe_report.json'), JSON.stringify(report, null, 1), 'utf8'); } catch (e2) { }
  } finally { if (c) c.close(); edge.kill(); }
  const fails = results.filter(r => !r.ok);
  console.log('\n==== CLAB probe: ' + (results.length - fails.length) + '/' + results.length + ' passed ====');
  if (fails.length) console.log('FAILED: ' + fails.map(f => f.name).join(' | '));
  process.exit(fails.length ? 1 : 0);
})();
