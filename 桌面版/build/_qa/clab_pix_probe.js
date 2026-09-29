/* 穷观 · 化学实验台「容器内腔裁剪」常驻像素探针（防回归）
 * ============================================================================
 * 【用法】三步（必须在**穷观根目录**起服务器，端口自己挑一个没被占的）：
 *     1) node 桌面版\build\_qa\server.js E:\workspace\穷观 8977
 *     2) node 桌面版\build\_qa\clab_pix_probe.js 8977                → 正常全绿
 *        node 桌面版\build\_qa\clab_pix_probe.js 8977 --negctl       → 一键负对照
 *     3) 退出码：**0 = 全过**（含 SKIP，SKIP 不算失败）；**1 = 有 FAIL**（或 harness 出错）
 *   产出：%TEMP%\qg_clab_pix_probe\clab_pix_report.json（逐反应全量读数）
 *         %TEMP%\qg_clab_pix_probe\clab_pix_table.md  （人看的对照表）
 *   ⚠ 退出码在两种模式下含义不同（都已写死在脚本末尾）：
 *      · 不带 --negctl：0 = 全部判据通过；1 = 有任何一条 FAIL。
 *      · 带 --negctl  ：**0 = 负对照按设计工作**（cuoh2 那 4 条确实变红 + 相邻反应没被带红 + 文件按字节还原），
 *        1 = 负对照没按预期变红/没还原干净 —— 也就是"判据瞎了或补丁点失效"。
 *        （此时 P1 里那 4 条 FAIL 是**故意的**，看 N1/N2/N3 三行才是结论。）
 *
 * 【--negctl 是什么】把**一处**（组 1 的 cuoh2-precip 沉淀调用点）临时改回修前画法：
 *     基线改成 ty+th-8、宽度 tw-6、去掉内腔参数 ⇒ 该处沉淀又变成"平底方块 + 越出圆管"。
 *     断言 cuoh2-precip 的 4 条判据（outChanged / outSed / gap / ink）**必须同时变红**，
 *     再断言相邻反应（agcl / baso4 / feoh3 / complex-ion）**一动不动**（证明回退是局部的、判据不是瞎红）。
 *     探针自己备份原文件字节 + sha256，跑完在 finally 里按字节还原并核对 sha256；
 *     进程被强杀也不会丢：下次启动若发现 %TEMP%\qg_clab_pix_probe\ions.js.negctl-bak 还在，会先还原它。
 *
 * 【为什么需要这个探针】用户报过两个真缺陷：「试管底部明明是圆的为什么还有平面沉淀」「沉淀都跑到试管外了」。
 *     根因：五套试管（ions / organic / analysis / kinetics / electro，形状本来就不同，**故意不统一**）
 *     里有四套把**液体与沉淀都画成矩形** —— 圆底处矩形既越出管壁、又把轮廓线盖掉（修复前 grep `clip(` = 0 处）。
 *     修复方式：把"内腔路径"抽出来（竖壁 + 下半圆弧），液体与沉淀 save→clip→画→restore，且内缩 1.2px 不盖轮廓。
 *     本探针只读产品代码，用**画布真像素**守住这条：任何一次"顺手改回矩形"都会在这里变红。
 *
 * ============================ 判据口径（阈值全部来自 2026-09-30 的实测） ============================
 * 【几何真值】拦 CanvasRenderingContext2D.arc（只记 #clCanvas），**乘上当时的变换矩阵**换算成设备像素，
 *   得到容器内腔 {cx, cy, r}：y<=cy 处为竖直壁（|dx|<=r），y>cy 处为半圆。与"沉淀怎么画"无关 ⇒ 判据不自证。
 *   ⚠ organic.js 用 save/translate/scale 把 780×500 设计坐标映射到画布；不换算就会量错地方（第一版踩过）。
 *   ⚠ ions.js/analysis.js 的 draw 会 clearRect 成透明 ⇒ 取像素前先合成到画布底色，否则"背景"是 (0,0,0)。
 *
 * ① outChanged：内腔外 **1~8px** 带内、"把沉淀调到最大 vs 调到最小"两帧之间发生变化的像素数。
 *      实测：修复后 0~2（cuoh2/agcl/baso4/carbonate-acid/precipitate-convert/complex-ion/iron-ion-test/so2/hydrolysis/
 *      phenol/glucose/ethylene-addition/ethanol-oxidation/esterification/ester-hydrolysis/rate-* 全为 0，ethanol-elimination=2）；
 *      修复前 6~392（6=carbonate-acid 的最小信号）。阈值 **≤4**（给 2px 抗锯齿余量，仍能抓住 6）。
 * ② outChanged13：同上但只取 **1~3px** 窄带。用于 ROI 里有"更远的"文字/装置的场景。阈值 **≤4**。
 * ③ outSed：内腔外 1~8px 带内的**沉淀色**像素数（颜色表逐反应写死，取自源码调用点）。
 *      实测修复后 0（phenol 的 5、carbonate-acid/baso4 的 1878~2104 是**白色沉淀/浊液与面板白同色**造成的
 *      假阳性 —— 这几个反应因此不用 outSed）；修复前 cuoh2=38、feoh3=40、complex-ion=40、rate-temperature=16、
 *      equilibrium-fescn=4、glucose=5、rate-concentration=1。阈值 **≤2**。⚠ **白沉淀不可用**：白沉淀 (252,252,250) 与本组面板白 (251,250,247) 只差 3 个色阶，
 *      掩膜会把面板背景算进来（agcl/baso4/carbonate-acid/precipitate-convert/phenol 的白点）——
 *      这些反应**不用 outSed**，改看 outChanged / gap(changed 掩膜) / ink。这就是"哪些反应不适用哪条判据"。
 * ④ outForeign：内腔外 **3~6px** 带内"既相对低帧变了、又不属于本帧背景调色板（前 6 色 ±10）"的像素数，
 *      并排除酒精灯/灯焰窗口（管口正下方 cx±0.62r × [cy+r, cy+r+44]）。实测修复后多为 0。
 * ⑤ absColorRay：**绝对判据**（不看差分、也不看调色板）：内腔外 **3.5~6.5px** 带内，
 *      把该像素与"同一方向再往外 8px 处"的像素比色，差 >30 就算一个"轮廓外多出来的颜色"（排除灯焰窗口）。
 *      为什么要有它：差分掩膜只能看见"两帧之间变了的东西"；有些反应低/高帧之间装置整体换形
 *      （水浴 ↔ 酒精灯直热），差分被装置淹没。而"按调色板判背景"的版本（absColor，仍作为参考读数保留）
 *      在"管内液体本身就是一大片颜色"时会把液体色当成背景而漏判 —— 沿半径取参考点的版本没有这个盲区。
 *      实测：修前 83/75/66/87/16（esterification / ethanol-oxidation / ethylene-addition / feoh3 / ester-hydrolysis），
 *      修后 27/0/0/1/6。阈值 **≤40**（ester-hydrolysis 单独收紧到 ≤12：它本来就是弱信号，实测 16→6）。
 * ⑥ gap：逐列"最低沉淀像素 y"与**本列理论圆底弧**的最大偏差 gapMax（9 列，-0.9r…+0.9r；每列取 ±2px 竖条，
 *      避免点阵稀疏漏检），以及"最深的那一列"位置（0~8，中轴=4）。
 *      实测：修复后 gapMax 1.5~4.9、最深列 3~4；修复前 7.8~8.2、最深列 1~2，且 9 列里有 5~7 列等于同一个 y
 *      （一条水平线，中轴反而最浅）。阈值写成**区间**：gapMax ≤ 6.0 且 最深列 ∈ [2,6]（中轴=4）。
 *      注意白沉淀用 gapSed（changed 掩膜会被"随浓度变色的浊液"铺满内腔 ⇒ baso4/carbonate-acid 的 gapChanged 是假红）。
 *      ⚠ 点阵型沉淀（glucose-silver / starch-hydrolysis 的 Cu₂O 圆点）不适用 gap —— 点与点之间有缝，
 *        "最低点"取决于哪一列正好有个点（实测 gapMaxS=17.3 却完全正确）。这些反应**不用 gap**。
 * ⑦ ink：下半弧（10°~170°，33 个采样点）"轮廓仍可见"的比例 = 采样点是实墨，**或**明显比线内一圈更暗
 *      （抗锯齿摊薄的细线仍算在；液体/沉淀把线整段盖住时线内同色 ⇒ 判不可见）。
 *      实测：修复后 ions/kinetics/analysis 全 100%，organic 91~100%（glucose 94%、starch 91%）；
 *      修复前 cuoh2=52%、feoh3=45%、complex-ion=55%、agcl/baso4/carbonate-acid/precipitate-convert=76%、
 *      rate-temperature=79%。阈值 **≥0.85**。⚠ organic 的液体是半透明的（arc 只是被压暗、没被盖死）⇒
 *      这一条对 organic 没有区分力（修前 94~97%），有机组的缺陷由 outChanged/outSed/outForeign 抓。
 *
 * 【已知假阳性与本探针的处理（不许动不动就红）】
 *   · rate-temperature：chOut 修复前后都是 392 —— 低帧是冷水浴(蓝)、高帧是热水浴(粉)，**水浴换色**灌满整个 ROI。
 *     ⇒ 该反应**不用 outChanged**，用 outSed（16→0）+ gap + ink（79%→100%）。
 *   · esterification：chOut 修复前后都是 785 —— 低帧 temp=20 走酒精灯直热、高帧 temp=130 走水浴，**装置整体换形**。
 *     ⇒ 不用 outChanged，用 absColor（不看差分）。
 *   · na-water(538) / cl2-metal(266)：金属组本轮**一行未改**（它们本来就不越界），chOut 修前修后逐位相同；
 *     且这两个反应根本没有圆底试管（烧杯 / 集气瓶，平底容器；探针抓到的是钠球、灯焰之类的圆）。
 *     ⇒ 列入 NOT_APPLICABLE，只做"结构存在性"记录，不判分。
 *   · feoh3-precip：outChanged 修复后仍余 33 —— 是**标签文字「红褐色 Fe(OH)₃」的抗锯齿**（文字本来就画在那里，
 *     字形越出右管壁约 3px，且随沉淀量出现/消失）。⇒ 该反应不用 outChanged，用 outSed（40→0）。
 *   · starch-hydrolysis：outChanged 修复后仍余 71 —— 落在 6~8px 与 >8px 带，是**邻管说明文字**
 *     （"砖红色沉淀"/"无明显砖红色"随水解程度变化）；贴近管壁的 1~3px 带 54→0。⇒ 用 outChanged13 + outForeign。
 *   · methane-substitute：管底正下方 4px 处就是随现象变化的标签"液面上升 x%"，1~6px 带里全是它的字形
 *     ⇒ 三条出界判据都不可用（修前 chOut=173 是标签、修后仍有 130），只报读数不判分。
 *   · ammonium-alkali / rate-concentration / rate-catalyst：**修前也不红**（信号本来就 <阈值）。
 *     ammonium-alkali 的液体色接近纸色（差分与彩色判据都测不到）；rate-concentration 的试管最小（r≈10，
 *     越界仅 1~2px）；rate-catalyst 的 MnO₂ 点阵在圆底处的越界 <2px。这三条保留为"防大回归"。
 *   · ethylene-addition / ethanol-oxidation / esterification：低/高帧画面对"改变的像素"区分度差
 *     （前者液体色变化小、后者装置换形）⇒ 改用 absColorRay（修前 66/75/83 → 修后 0/0/27）。
 *
 * 【覆盖范围】COVERED = 25 个反应（17 个"有沉淀/浑浊"的 ★ + 8 个"只有液体"的 ★；另外 2 个只有液体的
 *   methane / ammonium-alkali 也在 COVERED 里但分别标注"不判分"/"只有 ink 一条"）。
 *   NOT_APPLICABLE = 25 个：方槽/集气瓶/坩埚/锥形瓶/滴定管等**没有圆底容器**的，以及 metals/electro
 *   这些**本轮实测"本来就对、一行未改"**的（fe-cuso4/al-naoh/cu-hno3 液体止于弧心；qgFlaskFill 早已 clip）。
 *   每个都带一句"为什么不用这条判据"，见 NOT_APPLICABLE 表与探针输出末尾的 SKIP 行。
 * ============================================================================
 * 约束：本文件是 Node 侧脚本（与 clab_probe.js 同风格：var + function + 字符串拼接，仅用 async/await 组织时序）；
 *   **注入页面的测量代码是纯 ES5**（与产品同一约束）；零外部依赖（只用 Node 内置模块）；
 *   **只读产品代码** —— 除了 --negctl 那一次临时改写（自动按字节还原 + sha256 核对）之外，绝不写 js/clab*。
 * ============================================================================
 */
'use strict';
var http = require('http');
var spawn = require('child_process').spawn;
var fs = require('fs');
var os = require('os');
var path = require('path');

var EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
var SPORT = process.argv[2] || '8977';
var NEGCTL = process.argv.indexOf('--negctl') >= 0;
var OUTDIR = path.join(os.tmpdir(), 'qg_clab_pix_probe');
var PROFILE = path.join(OUTDIR, 'prof');
var DPORT = 9600 + Math.floor(Math.random() * 300);
var BASE = 'http://127.0.0.1:' + SPORT + '/guanlan.html';
var ROOT = path.resolve(__dirname, '..', '..', '..');          /* _qa → build → 桌面版 → 穷观 */
var IONS = path.join(ROOT, 'js', 'clab', 'ions.js');
var BAK = path.join(OUTDIR, 'ions.js.negctl-bak');

/* ============================== 阈值（来源见文件头） ============================== */
var TH = {
  outChanged: 4,          /* ① 内腔外 1~8px 带内 changed 像素 ≤ 4（实测修复后 0~2；修复前 6~785） */
  outChanged13: 4,        /* ② 同上 1~3px 带（修复后 0，修复前 6~120） */
  outSed: 2,              /* ③ 内腔外沉淀色像素 ≤ 2（实测修复后 0；修复前 4~40） */
  outForeign: 2,          /* ④ 3~6px 带内"变了且非背景色" ≤ 2（实测修复后 0；修复前 3~46） */
  absColor: 2,            /* ⑤-a 2~6px 带内"彩色内容"（调色板口径） ≤ 2 */
  absColorRay: 40,        /* ⑤-b 3.5~6.5px 带内"与同方向再外 8px 处的颜色差 >30"的像素数 ≤ 6
                           *     （不依赖调色板 ⇒ 管内液体色本身很大一片时也不会被当成"背景"而漏判） */
  rayDelta: 30,           /* ⑤-b 的颜色差阈值 */
  gapMax: 6.0,            /* ⑥ 与理论圆底弧的最大偏差 ≤ 6.0px（修复后 1.5~4.9；修复前 7.8） */
  deepColLo: 2,           /* ⑥ 最深列必须落在 [2,6]（9 列，中轴=4） */
  deepColHi: 6,
  ink: 0.85               /* ⑦ 下半弧"轮廓可见"比例 ≥ 0.85（修复后 91~100%；修复前 45~79%） */
};

/* ============================== 覆盖清单 ==============================
 * need = 要断言哪几条（名字见上）；limits 可逐条覆盖阈值；note = 为什么这么选（含"哪条不适用"）
 * ——— 17 个"有沉淀/浑浊"的 ★ + 10 个"只有液体"的 ★ ———
 */
var COVERED = [
  /* ---- 组 1（ions.js：qgTube + qgPrecip，7 处沉淀） ---- */
  { id: 'agcl-precip', rHint: 31, react: 3, need: ['outChanged', 'gapChanged', 'ink'],
    colors: [[252, 252, 250]], tol: 11, minPaper: 12,
    low: { cSample: 0.01, vSample: 1, cAgNO3: 0.01, dropsAg: 1, hno3: 0 },
    high: { sample: 'nacl', cSample: 1, vSample: 10, cAgNO3: 0.2, dropsAg: 20, hno3: 0 },
    note: '白色 AgCl：颜色掩膜与面板白同色 ⇒ 不用 outSed/outForeign；用 changed 差分 + changed-gap + ink' },
  { id: 'baso4-precip', rHint: 31, react: 3, need: ['outChanged', 'gapSed', 'ink'],
    colors: [[252, 252, 250], [248, 248, 244]], tol: 8, minPaper: 11,
    low: { cBaCl2: 0.01, vBaCl2: 1, cNa2SO4: 0.01, vNa2SO4: 1, temp: 20 },
    high: { cBaCl2: 0.2, vBaCl2: 10, cNa2SO4: 1, vNa2SO4: 10, temp: 20, acid: 'hcl' },
    note: '白色 BaSO₄ + 乳白浊液：不用颜色掩膜判"出界"（白与面板白同色）；贴弧这一条用 gapSed' +
      '（★不用 gapChanged：浊液颜色随浓度变，changed 掩膜铺满整个内腔 ⇒ 实测 gapMax=25.8 是假红）' },
  { id: 'cuoh2-precip', rHint: 31, react: 3, need: ['outChanged', 'outSed', 'gapSed', 'ink'],
    colors: [[97, 157, 214]], tol: 20, minPaper: 9,
    low: { cCuSO4: 0.01, vCuSO4: 1, cNaOH: 0.05, dropsNaOH: 1 },
    high: { cCuSO4: 0.2, vCuSO4: 10, cNaOH: 2, dropsNaOH: 40, temp: 20, time: 0 },
    note: '蓝色 Cu(OH)₂：高对比，颜色掩膜与差分都可用（本反应也是 --negctl 的单点回退对象）' },
  { id: 'feoh3-precip', rHint: 31, react: 3, need: ['outSed', 'absColorRay', 'gapSed', 'ink'],
    colors: [[144, 62, 41], [151, 67, 29]], tol: 22, minPaper: 9,
    low: { cFeCl3: 0.01, vFeCl3: 1, cNaOH: 0.05, dropsNaOH: 1 },
    high: { iron: 'fe3', cFeCl3: 1, vFeCl3: 10, cNaOH: 4, dropsNaOH: 40, heat: 'no' },
    note: '★不用 outChanged：标签「红褐色 Fe(OH)₃」的字形越出右管壁约 3px 且随沉淀量出现/消失，残留 33 个抗锯齿像素' },
  { id: 'carbonate-acid', rHint: 28, react: 3, need: ['outChanged', 'gapSed', 'ink'],
    colors: [[252, 252, 250]], tol: 10, minPaper: 12,
    low: { cHCl: 0.1, cNa2CO3: 0.05, vNa2CO3: 1, drops: 1 },
    high: { order: 'acid2carb', cHCl: 6, cNa2CO3: 1, vNa2CO3: 10, drops: 40, temp: 25 },
    note: '石灰水变浑浊（白色 CaCO₃）：白色 ⇒ 不用颜色掩膜判出界；★不用 gapChanged（浊液铺满内腔 ⇒ gapMax=17 是假红），用 gapSed（实测 4.9、最深列 3）' },
  { id: 'precipitate-convert', rHint: 31, react: 3, need: ['outChanged', 'outForeign', 'gapChanged', 'ink'],
    colors: [[222, 196, 50], [250, 250, 247]], tol: 14, minPaper: 12,
    low: { cNaCl: 0.01, cAgNO3: 0.01, dropsAg: 1, cAnion: 0.005, dropsAnion: 1 },
    high: { anion: 'ki', cNaCl: 0.2, cAgNO3: 0.2, dropsAg: 8, cAnion: 0.1, dropsAnion: 20 },
    note: 'AgCl 白 → AgI 黄；修复前 outForeign=12 / outChanged=55' },
  { id: 'complex-ion', rHint: 31, react: 3, need: ['outChanged', 'outSed', 'gapSed', 'ink'],
    colors: [[96, 156, 214]], tol: 20, minPaper: 9,
    low: { sys: 'cuamm', cM: 0.001, cNH3: 0.5, dropsL: 1 },
    high: { sys: 'cuamm', cM: 0.02, cNH3: 0.5, dropsL: 2, cKSCN: 0.005 },
    note: 'NH₃ 不足时先出蓝色 Cu(OH)₂ 沉淀；修复前 outChanged=230 / outSed=40 / gapSed=7.8' },
  { id: 'hydrolysis', rHint: 27, react: 3, need: ['outChanged', 'ink'],
    colors: [], tol: 16, minPaper: 9,
    low: { c0: 0.001, dilute: 1, temp: 20, dropsAdd: 1 },
    high: { salt: 'fecl3', c0: 1, dilute: 1, temp: 80, add: 'none', dropsAdd: 1 },
    note: '★只有液体（本组 qgTube 的液体矩形）：修复前 outChanged=166；无沉淀层 ⇒ 无 gap' },
  { id: 'ammonium-alkali', rHint: 31, react: 3, need: ['ink'],
    colors: [], tol: 16, minPaper: 9,
    low: { cNH4Cl: 0.05, vNH4Cl: 1, cNaOH: 0.05, dropsNaOH: 1, temp: 20 },
    high: { cNH4Cl: 2, vNH4Cl: 10, cNaOH: 4, dropsNaOH: 40, temp: 150, paper: 'red' },
    note: '只有液体 + 湿润石蕊试纸；液体色接近纸色 ⇒ 差分看不出来（修前修后 outChanged 都是 36，来自试纸/白烟）' },

  /* ---- 组 3（organic.js：qgTubeBegin/End，12 处） ---- */
  { id: 'glucose-silver', rHint: 24.4, react: 3, need: ['outChanged', 'outSed', 'outForeign', 'ink'],
    colors: [[175, 81, 68]], tol: 25, minPaper: 9,
    low: { bath: 30, conc: 1, time: 1 },
    high: { reagent: 'cuoh2', bath: 100, alkali: 'enough', conc: 20, time: 15 },
    note: '砖红色 Cu₂O 圆点；★点阵型 ⇒ **不用 gap**（点间有缝，"最低点"取决于哪列有点，实测 gapMaxS=17.3 却完全正确）' },
  { id: 'starch-hydrolysis', rHint: 18.6, react: 3, need: ['outChanged13', 'outForeign', 'outSed', 'ink'],
    colors: [[181, 79, 40]], tol: 24, minPaper: 9,
    low: { temp: 20, time: 2 },
    high: { cat: 'h2so4', temp: 100, time: 30 },
    note: '★不用 outChanged(1~8px)：6~8px/>8px 带里有邻管说明文字（随水解程度变），残留 71；1~3px 带 54→0。点阵型 ⇒ 不用 gap' },
  { id: 'phenol-bromine', rHint: 30.3, react: 3, need: ['outChanged', 'outForeign', 'ink'],
    colors: [[251, 251, 249]], tol: 11, minPaper: 12,
    low: { drops: 1, phenolVol: 0.5 },
    high: { br2Conc: 'conc', drops: 4, phenolVol: 0.5 },
    note: '白色三溴苯酚圆点 + 乳白浊液：白点色与面板白只差 3 ⇒ **不用 outSed**；点阵型 ⇒ 不用 gap。修前 outChanged=242' },
  { id: 'methane-substitute', rHint: 18.0, react: 3, need: [],
    colors: [], tol: 16, minPaper: 9,
    low: { ratio: 0.5, time: 1 },
    high: { light: 'diffuse', ratio: 4, time: 30 },
    note: '★不判分（只报读数）：管底正下方 4px 就是随现象变化的标签"液面上升 x%%"，1~6px 带里全是它的字形 ⇒ 三条出界判据都不可用' },
  { id: 'ethylene-addition', rHint: 27.9, react: 3, need: ['absColorRay', 'ink'],
    colors: [], tol: 16, minPaper: 9,
    low: { br2Ratio: 0.5, c2h4Vol: 10 },
    high: { reagent: 'br2water', br2Ratio: 3, c2h4Vol: 100 },
    note: '只有液体（油层）；修前 outChanged 仅 8（低/高帧液体色变化小）⇒ 用 absColorRay（修前 66 → 修后 0）' },
  { id: 'ethanol-oxidation', rHint: 30.3, react: 3, need: ['absColorRay', 'ink'],
    colors: [], tol: 16, minPaper: 9,
    low: { temp: 150, cycles: 1 },
    high: { cat: 'wire', temp: 600, oxidant: 'o2', cycles: 6 },
    note: '只有液体 + 铜丝颜色；修前 outChanged=0（两帧画面对该 ROI 无变化）⇒ 用 absColorRay（修前 75 → 修后 0）' },
  { id: 'ethanol-elimination', rHint: 16.3, react: 3, need: ['outChanged', 'outForeign', 'ink'],
    colors: [], tol: 16, minPaper: 9,
    low: { temp: 100, acidRatio: 1, time: 2 },
    high: { temp: 200, acidRatio: 3, heat: 'fast', time: 20 },
    note: '只有液体（溴的 CCl₄ 溶液）；修前 outChanged=44 / outForeign=7' },
  { id: 'esterification', rHint: 25.0, react: 3, need: ['absColorRay', 'ink'],
    colors: [], tol: 16, minPaper: 9,
    low: { ratio: 0.5, temp: 130, time: 1 },
    high: { cat: 'conc', ratio: 3, temp: 130, time: 15 },
    note: '★不用 outChanged：低/高帧若跨水浴↔酒精灯会整体换形（实测 785 修前修后一样）；改用**绝对**判据 absColor（低/高帧都锁 temp=130 走水浴）' },
  { id: 'ester-hydrolysis', rHint: 17.5, react: 3, need: ['absColorRay', 'ink'], limits: { absColorRay: 12 },
    colors: [], tol: 16, minPaper: 9,
    low: { medium: 'acid', temp: 30, time: 1, ester: 0.5 },
    high: { medium: 'acid', temp: 100, time: 20, ester: 3 },
    note: '三支试管（酸/碱/水）都是"液体矩形铺到腔底"；★不用 outChanged：一改 medium 就会换高亮虚线框与标签配色，' +
      '实测残留 252 个像素全是那些装饰（低/高帧都锁 medium=acid 后改用**绝对**判据 absColor）' },

  /* ---- 组 4/5（kinetics.js：tube 早有液体 clip，本轮给 specks 加 cav） ---- */
  { id: 'rate-concentration', rHint: 10.2, react: 4, need: ['outSed', 'gapSed', 'ink'],
    colors: [[215, 206, 153]], tol: 18, minPaper: 9,
    low: { c1: 0.05, c2: 0.05, water: 0, temp: 10 },
    high: { c1: 0.5, c2: 1, water: 0, temp: 60 },
    note: '硫的浑浊；★不用 outChanged：两帧浑浊点阵逐像素相同（点位置只由序号决定）⇒ 差分=0；用颜色掩膜 + gap + ink。' +
      '本反应管子最小 r≈10，越界量本来只有 1~2px ⇒ 这三条是弱判据（absRay 修前 19 / 修后 19），已如实标注' },
  { id: 'rate-temperature', rHint: 7.8, react: 4, need: ['outSed', 'gapSed', 'ink'],
    colors: [[215, 206, 153]], tol: 18, minPaper: 9,
    low: { temp: 10, c1: 0.05, c2: 0.05 },
    high: { temp: 60, c1: 0.5, c2: 1, heating: 'bath' },
    note: '★不用 outChanged：低帧冷水浴(蓝)/高帧热水浴(粉)的**水浴换色**灌满 ROI（实测 392，修前修后相同）；用 outSed(16→0)+gap+ink(79%%→100%%)' },
  { id: 'rate-catalyst', rHint: 12.0, react: 4, need: ['outSed', 'gapSed', 'ink'],
    colors: [[74, 74, 70]], tol: 18, minPaper: 9,
    low: { catAmt: 0, cH2O2: 1, temp: 10 },
    high: { cat: 'mno2', catAmt: 1, cH2O2: 20, temp: 50 },
    note: 'MnO₂ 粉末点阵（CATS.mno2.color #4a4a46）；★本反应**修前也不红**（实测修前 ch18/sed/absRay 全为 0：点少、圆底处越界 <2px）——' +
      '这三条是"防大回归"（一旦有人去掉 specks 的 clip 并调高密度就会红），不是"修前必须红"的判据' },
  { id: 'equilibrium-fescn', rHint: 12.5, react: 3, need: ['outSed', 'outForeign', 'ink'],
    colors: [[154, 100, 64]], tol: 20, minPaper: 9,
    low: { op: 'fecl3', drops: 0, cFe: 0.001, cKSCN: 0.005, temp: 10 },
    high: { op: 'naoh', drops: 8, temp: 25, cFe: 0.02, cKSCN: 0.03 },
    note: '红褐 Fe(OH)₃ 点阵（只有加 NaOH 的支路才画）；★点阵稀疏 ⇒ 不用 gap（sedN 仅 4~8 个像素）；修前 outChanged=52（含别的支路文字）' },

  /* ---- 组 6（analysis.js：qgTube 的填充=沉淀色） ---- */
  { id: 'iron-ion-test', rHint: 17, react: 3, need: ['outChanged', 'outForeign', 'ink'],
    colors: [[164, 97, 62], [62, 85, 163]], tol: 20, minPaper: 9,
    low: { sample: 'fe3', test: 'naoh', oxidation: 0, kscn: 1, fvol: 0.2 },
    high: { sample: 'fe3', test: 'naoh', oxidation: 0, kscn: 2, fvol: 0.5 },
    note: '红褐/蓝沉淀色被当作**液体色**填满试管（analysis 的 qgTube）⇒ 修前 outChanged=46 / outForeign=12' },
  { id: 'so2-properties', rHint: 19.2, react: 3, need: ['outChanged', 'outForeign', 'ink'],
    colors: [[222, 213, 104]], tol: 20, minPaper: 9,
    low: { reagent: 'h2s', conc: 0.02, time: 2, humid: 0 },
    high: { reagent: 'h2s', conc: 0.5, time: 40, humid: 60 },
    note: 'H₂S 管的淡黄色硫沉淀（= 该管液体色）⇒ 修前 outChanged=76 / outForeign=29' },
  { id: 'iodine-starch', rHint: 23, react: 3, need: ['outChanged13', 'outForeign', 'ink'],
    colors: [], tol: 16, minPaper: 9,
    low: { sample: 'starch', c0: 0.001, ratio: 0.2 },
    high: { sample: 'starch', extract: 'ccl4', c0: 0.05, ratio: 3 },
    note: '淀粉-碘蓝色液体（非沉淀）；3~6px 外有"加热→蓝色褪去"文字 ⇒ 用 1~3px 带 + outForeign' }
];

/* ============================== 明确"不适用"的反应（防遗漏） ==============================
 * 这些反应要么根本没有圆底容器，要么本轮已验证"本来就对、一行未改"。
 * 探针仍然把它们**读一遍**（容器半径/内腔外读数），但**不判分**，只在表里标 NA + 原因。
 */
var NOT_APPLICABLE = {
  'na-water': '烧杯（平底容器）+ 钠球是圆 ⇒ arc 拦到的是钠球，不是试管；组 2 本轮一行未改（实测不越界）',
  'na-oxygen': '坩埚 + 钠块，无圆底容器（本轮未改）',
  'fe-cuso4': '试管液体止于弧心（腔内最宽处），实测 outChanged=0、ink=100% —— **本来就对**（本轮未改）',
  'al-naoh': '同 fe-cuso4：液体止于弧心，实测 outChanged=0（本轮未改）',
  'al-thermite': '坩埚，无圆底容器（本轮未改）',
  'cl2-metal': '集气瓶（平底）+ 灯焰圆 ⇒ 抓到的圆不是容器；本轮未改',
  'cl2-water': '集气瓶（平底），无圆弧容器（本轮未改）',
  's-metal': '坩埚，无圆弧容器（本轮未改）',
  'mg-co2': '集气瓶（平底），固体堆在瓶底（本轮未改）',
  'cu-hno3': '试管液体止于弧心 + 铜片矩形都在腔内，实测 outChanged=0（本轮未改）',
  'ethylene-polymer': '圆底烧瓶 qgFlaskFill **本来就有 clip**（对照组：实测 outChanged=0）',
  'benzene-bromo': '锥形瓶/烧杯（平底容器）',
  'galvanic-cuzn': '方槽 + 电极矩形（本轮未改）',
  'electrolysis-cucl2': '方槽 + 电极矩形（本轮未改）',
  'electrolysis-brine': '方槽 + 电极矩形（本轮未改）',
  'electroplating': '方槽 + 电极矩形（本轮未改）',
  'iron-corrosion': '方槽 + 铁片矩形（本轮未改）',
  'fuel-cell': '方槽 + 电极矩形（本轮未改）',
  'equilibrium-no2': '注射器/方槽（本轮未改）',
  'weak-electrolyte': '平底烧杯（本轮未改）',
  'flame-test': '铂丝 + 火焰，无试管；arc 拦到的是灯焰圆',
  'anion-test': '★沉淀示意画在**方框**里（方底方沉淀，本来就对）；无圆弧容器',
  'acid-base-titration': '滴定管/锥形瓶（平底）',
  'kmno4-titration': '滴定管/锥形瓶（平底）',
  'gas-collection': '集气瓶（平底）'
};

/* ============================== 页面内工具箱（注入一次；纯 ES5） ============================== */
var MEASURE = 'window.__PXP=(function(){' +
  'var PAPER=[244,241,234], INK=[38,34,28], TAU=Math.PI*2;' +
  'function dist(a,b){var dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2];return Math.sqrt(dr*dr+dg*dg+db*db);}' +
  'if(!window.__ARC){ window.__ARC={buf:[]};' +
  ' var proto=CanvasRenderingContext2D.prototype, oa=proto.arc, oc=proto.clearRect;' +
  ' proto.arc=function(cx,cy,r,a0,a1,ccw){ try{ if(this.canvas&&this.canvas.id==="clCanvas"){' +
  '   var m=this.getTransform?this.getTransform():{a:1,d:1,e:0,f:0};' +
  '   window.__ARC.buf.push({cx:m.a*cx+m.e, cy:m.d*cy+m.f, r:r*m.a, a0:a0, a1:a1, ccw:!!ccw}); } }catch(e){}' +
  '  return oa.apply(this,arguments); };' +
  ' proto.clearRect=function(){ try{ if(this.canvas&&this.canvas.id==="clCanvas") window.__ARC.buf=[]; }catch(e){}' +
  '  return oc.apply(this,arguments); }; }' +
  'function bgColor(){ var el=document.getElementById("clCanvas");' +
  ' while(el){ var c=""; try{ c=getComputedStyle(el).backgroundColor; }catch(e){}' +
  '  if(c && c!=="rgba(0, 0, 0, 0)" && c!=="transparent") return c; el=el.parentElement; }' +
  ' return "#F4F1EA"; }' +
  'function snap(){ var cv=document.getElementById("clCanvas");' +
  ' var off=document.createElement("canvas"); off.width=cv.width; off.height=cv.height;' +
  ' var g=off.getContext("2d"); g.fillStyle=bgColor(); g.fillRect(0,0,off.width,off.height);' +
  ' g.drawImage(cv,0,0);' +
  ' return {w:off.width,h:off.height,data:g.getImageData(0,0,off.width,off.height).data}; }' +
  'function grab(key){ var s=snap(); window.__GRAB=window.__GRAB||{}; window.__GRAB[key]=s; return [s.w,s.h]; }' +
  'function candidates(){ var out=[],i,a,r,span,full,half,buf=window.__ARC?window.__ARC.buf:[];' +
  ' for(i=0;i<buf.length;i++){ a=buf[i]; r=a.r; if(!(r>=6)) continue;' +
  '  span=Math.abs(a.a1-a.a0); full=(span>TAU-0.02); half=(Math.abs(span-Math.PI)<0.02);' +
  '  if(!full&&!half) continue;' +
  '  if(!full && !(Math.sin((a.a0+a.a1)/2)>0.5)) continue;' +
  '  out.push({cx:a.cx,cy:a.cy,r:r,full:full}); }' +
  ' var uniq=[],j,dup;' +
  ' for(i=0;i<out.length;i++){ dup=false;' +
  '  for(j=0;j<uniq.length;j++){ if(Math.abs(out[i].cx-uniq[j].cx)<1.5&&Math.abs(out[i].cy-uniq[j].cy)<1.5&&' +
  '    Math.abs(out[i].r-uniq[j].r)<1.5){dup=true;break;} }' +
  '  if(!dup) uniq.push(out[i]); }' +
  ' return uniq; }' +
  'function dOut(cx,cy,r,px,py){ var dx=px-cx, dy=py-cy;' +
  ' if(dy<=0) return Math.abs(dx)-r; return Math.sqrt(dx*dx+dy*dy)-r; }' +
  'return {snap:snap,grab:grab,candidates:candidates,dOut:dOut,dist:dist,bgColor:bgColor,PAPER:PAPER,INK:INK};' +
  '})();';

/* 单个反应的全量读数。参数：id / 颜色表 / tol / minPaper / 低帧 key / rHint */
var ANALYZE = '(function(id, colors, tol, minPaper, lowKey, rHint){' +
  'var cv=document.getElementById("clCanvas"); if(!cv) return {err:"no canvas"};' +
  'var M=window.__PXP, cur=M.snap(), L=(window.__GRAB||{})[lowKey]||null;' +
  'var W=cur.w,H=cur.h,D=cur.data,LD=L?L.data:null;' +
  'function at(x,y){ var i=((y|0)*W+(x|0))*4; return [D[i],D[i+1],D[i+2]]; }' +
  'function changed(x,y){ if(!LD) return false; var i=((y|0)*W+(x|0))*4;' +
  ' return Math.abs(D[i]-LD[i])>3||Math.abs(D[i+1]-LD[i+1])>3||Math.abs(D[i+2]-LD[i+2])>3; }' +
  'function dist(a,b){return M.dist(a,b);}' +
  'function isPaper(c){ return dist(c,M.PAPER)<=13; }' +
  'function isInk(c){ return dist(c,M.INK)<=150; }' +
  'function isSed(c){ if(dist(c,M.PAPER)<minPaper) return false;' +
  ' for(var i=0;i<colors.length;i++){ if(dist(c,colors[i])<=tol) return true; } return false; }' +
  /* 本帧背景调色板（全局抽样，取前 6 色） */
  'var gH={},x4,y4,k4;' +
  'for(y4=0;y4<H;y4+=2) for(x4=0;x4<W;x4+=2){ var q=at(x4,y4), kk=q[0]+","+q[1]+","+q[2]; gH[kk]=(gH[kk]||0)+1; }' +
  'var pal=[],p; for(p in gH) if(Object.prototype.hasOwnProperty.call(gH,p)) pal.push([p,gH[p]]);' +
  'pal.sort(function(a,b){return b[1]-a[1];}); pal=pal.slice(0,6);' +
  'var palRGB=[],i5; for(i5=0;i5<pal.length;i5++) palRGB.push(pal[i5][0].split(",").map(Number));' +
  'function isBg(c){ for(var i=0;i<palRGB.length;i++){ if(dist(c,palRGB[i])<=10) return true; } return false; }' +
  'var cands=M.candidates();' +
  'if(rHint>0){ var keep=[],hr=rHint,tolR=Math.max(1.5,0.12*hr),i8;' +
  ' for(i8=0;i8<cands.length;i8++){ if(Math.abs(cands[i8].r-hr)<=tolR) keep.push(cands[i8]); }' +
  ' if(keep.length) cands=keep; }' +
  'if(!cands.length) return {err:"no container arc captured"};' +
  /* 选容器：内腔里 changed 像素最多（判据与颜色无关），退化到 sed / 非纸色 */
  'var stat=[],i2,cd,xx,yy;' +
  'for(i2=0;i2<cands.length;i2++){ cd=cands[i2]; var nc=0,ns=0,nn=0;' +
  ' for(yy=Math.max(0,(cd.cy-cd.r)|0); yy<Math.min(H,(cd.cy+cd.r+1)|0); yy++)' +
  '  for(xx=Math.max(0,(cd.cx-cd.r-1)|0); xx<Math.min(W,(cd.cx+cd.r+2)|0); xx++){' +
  '   if(M.dOut(cd.cx,cd.cy,cd.r,xx+0.5,yy+0.5)>-1.0) continue;' +
  '   if(changed(xx,yy)) nc++; if(isSed(at(xx,yy))) ns++; if(!isPaper(at(xx,yy))) nn++; }' +
  ' stat.push({cx:cd.cx,cy:cd.cy,r:cd.r,full:cd.full,changedIn:nc,sedIn:ns,nonPaperIn:nn}); }' +
  'function best(key){ var bi=-1,bv=-1,i; for(i=0;i<stat.length;i++){ if(stat[i][key]>bv){bv=stat[i][key];bi=i;} } return {idx:bi,v:bv}; }' +
  'var pk=best("changedIn"),pkName="changed";' +
  'if(pk.v<=0){ pk=best("sedIn"); pkName="sed"; }' +
  'if(pk.v<=0){ pk=best("nonPaperIn"); pkName="nonpaper"; }' +
  'cd=cands[pk.idx]; var cx=cd.cx, cy=cd.cy, r=cd.r;' +
  'var x0=Math.max(0,(cx-r-8)|0), x1=Math.min(W,(cx+r+9)|0);' +
  'var y0=Math.max(0,(cy-r-8)|0), y1=Math.min(H,(cy+r+9)|0);' +
  'var fx0=cx-0.62*r, fx1=cx+0.62*r, fy0=cy+r, fy1=cy+r+44;' +
  /* 出界统计（1~8px / 1~3px / 3~6px 分档；灯焰窗口单独记） */
  'var o18=0,o13=0,o36=0,sedOut=0,foreign=0,foreignFlame=0,absColor=0,absFlame=0,absRay=0,absRayFlame=0;' +
  'for(y=y0;y<y1;y++) for(x=x0;x<x1;x++){' +
  ' var dd=M.dOut(cx,cy,r,x+0.5,y+0.5); if(dd<=1.0) continue;' +
  ' var ch=changed(x,y), c=at(x,y), inFl=(x>=fx0&&x<=fx1&&y>=fy0&&y<=fy1);' +
  ' if(dd<=8.0){ if(ch) o18++; if(dd<=3.0&&ch) o13++; if(dd>3.0&&dd<=6.0&&ch) o36++; }' +
  ' if(isSed(c)) sedOut++;' +
  ' if(dd>3.0&&dd<=6.0&&ch&&!isBg(c)){ if(inFl) foreignFlame++; else foreign++; }' +
  ' if(dd>2.0&&dd<=6.0&&!isBg(c)&&!isInk(c)){ if(inFl) absFlame++; else absColor++; }' +
  /* ⑤-b「沿半径再外 8px 处取参考色」：不依赖调色板，管内液体色很大一片也不会被当背景 */
  ' if(dd>3.5&&dd<=6.5){' +
  '  var px=x+0.5, py=y+0.5, rx2, ry2, dxr=px-cx, dyr=py-cy;' +
  '  if(dyr<=0){ rx2=cx+(dxr>=0?(dxr+8):(dxr-8)); ry2=py; }' +
  '  else { var L=Math.sqrt(dxr*dxr+dyr*dyr), sc2=(L+8)/Math.max(L,0.001); rx2=cx+dxr*sc2; ry2=cy+dyr*sc2; }' +
  '  if(rx2>0&&ry2>0&&rx2<W-1&&ry2<H-1){' +
  '   var dc=M.dist(c, at(rx2,ry2));' +
  '   if(dc>30){ if(inFl) absRayFlame++; else absRay++; } } } }' +
  /* 逐列"最低沉淀像素 y"（每列 ±2px 竖条；排除轮廓笔画 1.2px 带）+ 逐列 changed 最低 y */
  'function lowest(mode){ var cols=[],nc=9,i;' +
  ' for(i=0;i<nc;i++){ var frac=-0.9+1.8*i/(nc-1), xc=cx+frac*r, low=-1, xw;' +
  '  for(xw=Math.max(0,Math.round(xc)-2); xw<=Math.min(W-1,Math.round(xc)+2); xw++){' +
  '   for(var y=Math.min(H-1,(cy+r)|0); y>cy-2; y--){' +
  '    if(M.dOut(cx,cy,r,xw+0.5,y+0.5) > -1.2) continue;' +
  '    var hit=(mode==="sed")?isSed(at(xw,y)):changed(xw,y);' +
  '    if(hit){ if(y>low) low=y; break; } } }' +
  '  var dx=xc-cx;' +
  '  var th=(Math.abs(dx)<=r-1.2)? (cy+Math.sqrt(Math.max(0,(r-1.2)*(r-1.2)-dx*dx))) : null;' +
  '  cols.push({frac:Math.round(frac*100)/100, lowestY:low, theoryY:th===null?null:Math.round(th*10)/10,' +
  '   gap:(low<0||th===null)?null:Math.round((th-low)*10)/10}); }' +
  ' var deep=-1,dy=-1,n=0,gm=null,ga=[],i2;' +
  ' for(i2=0;i2<cols.length;i2++){ if(cols[i2].lowestY>=0){ n++; if(cols[i2].lowestY>dy){dy=cols[i2].lowestY;deep=i2;} }' +
  '  if(cols[i2].gap!==null) ga.push(Math.abs(cols[i2].gap)); }' +
  ' if(ga.length){ gm=0; for(i2=0;i2<ga.length;i2++){ if(ga[i2]>gm) gm=ga[i2]; } }' +
  ' return {cols:cols, deepCol:deep, gapMax:gm, n:n}; }' +
  /* 轮廓可见：下半弧 10°~170°，33 点；实墨 或 明显比线内更暗 */
  'var inkN=0,inkDark=0,inkPure=0,k2;' +
  'for(k2=0;k2<=32;k2++){ var ang=Math.PI*(10+160*(k2/32))/180;' +
  ' var sx=cx+Math.cos(ang)*r, sy=cy+Math.sin(ang)*r;' +
  ' if(sx<1||sy<1||sx>=W-1||sy>=H-1) continue;' +
  ' inkN++; var cmin=1e9;' +
  ' for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ var dq=dist(at(sx+ox,sy+oy),M.INK); if(dq<cmin) cmin=dq; }' +
  ' var din=dist(at(cx+Math.cos(ang)*(r-3.2), cy+Math.sin(ang)*(r-3.2)),M.INK);' +
  ' if(cmin<=60) inkPure++;' +
  ' if(cmin<=60 || (cmin+30<din)) inkDark++; }' +
  'var gapS=lowest("sed"), gapC=lowest("changed");' +
  'return { id:id, canvas:[W,H], pickBy:pkName, cands:stat, container:{cx:cx,cy:cy,r:r},' +
  ' out:{ changed18:o18, changed13:o13, changed36:o36, sed:sedOut, foreign:foreign, foreignFlame:foreignFlame,' +
  '       absColor:absColor, absFlame:absFlame, absRay:absRay, absRayFlame:absRayFlame, lowFrame:!!LD },' +
  ' gapSed:gapS, gapChanged:gapC, ink:{ n:inkN, frac:(inkN?inkDark/inkN:0), pureFrac:(inkN?inkPure/inkN:0) } };' +
  '})';

/* ============================== 小工具 ============================== */
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function getJson(u) {
  return new Promise(function (res, rej) {
    http.get(u, function (r) { var d = ''; r.on('data', function (c) { d += c; }); r.on('end', function () { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
function sha256(buf) { return require('crypto').createHash('sha256').update(buf).digest('hex'); }

function CDP(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = []; }
CDP.connect = async function (port) {
  var tab = null, i, l;
  for (i = 0; i < 80; i++) {
    try { l = await getJson('http://127.0.0.1:' + port + '/json/list'); tab = l.filter(function (t) { return t.type === 'page'; })[0]; if (tab) break; } catch (e) { }
    await sleep(250);
  }
  if (!tab) throw new Error('no tab（先起服务器：node 桌面版\\build\\_qa\\server.js <穷观根目录> <端口>）');
  var ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(function (r, j) { ws.onopen = r; ws.onerror = j; });
  var c = new CDP(ws);
  ws.onmessage = function (ev) {
    var m = JSON.parse(ev.data);
    if (m.id && c.pending.has(m.id)) {
      var p = c.pending.get(m.id); c.pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      var d = m.params.exceptionDetails;
      c.errors.push(String((d.exception && (d.exception.description || d.exception.value)) || d.text || ''));
    }
  };
  return c;
};
CDP.prototype.send = function (m, p) {
  var self = this, id = ++this.id;
  return new Promise(function (res, rej) {
    self.pending.set(id, { resolve: res, reject: rej });
    self.ws.send(JSON.stringify({ id: id, method: m, params: p || {} }));
  });
};
CDP.prototype.eval = async function (e) {
  var r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    var d = r.exceptionDetails;
    throw new Error('EVAL-ERR: ' + (d.exception ? (d.exception.description || JSON.stringify(d.exception)) : d.text));
  }
  return r.result ? r.result.value : undefined;
};
CDP.prototype.close = function () { try { this.ws.close(); } catch (e) { } };

/* ============================== 结果登记 ============================== */
var results = [];
function check(name, ok, extra) {
  results.push({ name: name, ok: !!ok, extra: extra === undefined ? '' : String(extra) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' :: ' + String(extra).slice(0, 900) : ''));
}
function info(name, extra) { console.log('INFO ' + name + ' :: ' + String(extra).slice(0, 900)); }
function skip(name, why) {
  results.push({ name: name, ok: true, skip: true, extra: why });
  console.log('SKIP ' + name + ' :: ' + why);
}
function near(v, lim) { return v !== null && v !== undefined && v <= lim; }

/* ============================== 判据执行（逐反应） ============================== */
function runChecks(cfg, m) {
  var out = [], o = m.out, lim;
  function add(key, ok, detail) { out.push({ key: key, ok: !!ok, detail: detail }); }

  if (cfg.need.indexOf('outChanged') >= 0) {
    lim = cfg.limits && cfg.limits.outChanged !== undefined ? cfg.limits.outChanged : TH.outChanged;
    add('outChanged', near(o.changed18, lim), '内腔外 1~8px 带内 changed=' + o.changed18 + '（≤' + lim + '）');
  }
  if (cfg.need.indexOf('outChanged13') >= 0) {
    lim = cfg.limits && cfg.limits.outChanged13 !== undefined ? cfg.limits.outChanged13 : TH.outChanged13;
    add('outChanged13', near(o.changed13, lim), '内腔外 1~3px 带内 changed=' + o.changed13 + '（≤' + lim + '）');
  }
  if (cfg.need.indexOf('outSed') >= 0) {
    lim = cfg.limits && cfg.limits.outSed !== undefined ? cfg.limits.outSed : TH.outSed;
    add('outSed', near(o.sed, lim), '内腔外沉淀色像素=' + o.sed + '（≤' + lim + '）');
  }
  if (cfg.need.indexOf('outForeign') >= 0) {
    lim = cfg.limits && cfg.limits.outForeign !== undefined ? cfg.limits.outForeign : TH.outForeign;
    add('outForeign', near(o.foreign, lim), '内腔外 3~6px 带内 changed∧非背景=' + o.foreign + '（≤' + lim + '）');
  }
  if (cfg.need.indexOf('absColor') >= 0) {
    lim = cfg.limits && cfg.limits.absColor !== undefined ? cfg.limits.absColor : TH.absColor;
    add('absColor', near(o.absColor, lim), '内腔外 2~6px 带内彩色内容（调色板口径）=' + o.absColor + '（≤' + lim + '）');
  }
  if (cfg.need.indexOf('absColorRay') >= 0) {
    lim = cfg.limits && cfg.limits.absColorRay !== undefined ? cfg.limits.absColorRay : TH.absColorRay;
    add('absColorRay', near(o.absRay, lim), '内腔外 3.5~6.5px 带内"与同方向再外 8px 处色差>' + TH.rayDelta + '"的像素=' +
      o.absRay + '（≤' + lim + '）');
  }
  if (cfg.need.indexOf('gapSed') >= 0 || cfg.need.indexOf('gapChanged') >= 0) {
    var g = cfg.need.indexOf('gapSed') >= 0 ? m.gapSed : m.gapChanged;
    var which = cfg.need.indexOf('gapSed') >= 0 ? 'sed' : 'changed';
    var limG = cfg.limits && cfg.limits.gapMax !== undefined ? cfg.limits.gapMax : TH.gapMax;
    var lo = TH.deepColLo, hi = TH.deepColHi;
    if (g.gapMax === null || g.n < 5) {
      add('gap(' + which + ')', false, '有效列数 ' + g.n + ' 太少、gapMax=' + g.gapMax + ' ⇒ 无法判定');
    } else {
      var okG = (g.gapMax <= limG) && (g.deepCol >= lo) && (g.deepCol <= hi);
      add('gap(' + which + ')', okG, 'gapMax=' + g.gapMax.toFixed(1) + '（≤' + limG + '）最深列=' + g.deepCol +
        '（须 ' + lo + '~' + hi + '，中轴=4）列最低y=' + JSON.stringify(g.cols.map(function (c) { return c.lowestY; })));
    }
  }
  if (cfg.need.indexOf('ink') >= 0) {
    lim = cfg.limits && cfg.limits.ink !== undefined ? cfg.limits.ink : TH.ink;
    add('ink', m.ink.frac >= lim - 1e-9, '下半弧轮廓可见率=' + (m.ink.frac * 100).toFixed(0) + '%（≥' +
      (lim * 100).toFixed(0) + '%，实墨 ' + (m.ink.pureFrac * 100).toFixed(0) + '%，采样 ' + m.ink.n + ' 点）');
  }
  return out;
}

/* ============================== --negctl 的单点回退 ============================== */
var NEGCTL_OLD_A = 'qgPrecip(d, 4101 + Math.round(m.nPre * 911), tx - tw / 2, ty + th + 2, tw, 30,';
var NEGCTL_OLD_B = 'amt, pc, 9, qgTubeCav(tx, ty, tw, th));';
var NEGCTL_NEW_A = 'qgPrecip(d, 4101 + Math.round(m.nPre * 911), tx - tw / 2 + 3, ty + th - 8, tw - 6, 30,';
var NEGCTL_NEW_B = 'amt, pc, 9);';
var negctlState = { patched: false, shaBefore: '', shaAfter: '', restored: null };

function negctlPatch() {
  var src = fs.readFileSync(IONS);
  negctlState.shaBefore = sha256(src);
  fs.writeFileSync(BAK, src);
  var t = src.toString('utf8');
  if (t.indexOf(NEGCTL_OLD_A) < 0 || t.indexOf(NEGCTL_OLD_B) < 0) {
    throw new Error('负对照补丁点没找到（ions.js 的 cuoh2 qgPrecip 调用点形状变了？）—— 请检查源码后更新 NEGCTL_* 常量');
  }
  t = t.replace(NEGCTL_OLD_A, NEGCTL_NEW_A).replace(NEGCTL_OLD_B, NEGCTL_NEW_B);
  fs.writeFileSync(IONS, Buffer.from(t, 'utf8'));
  negctlState.patched = true;
  return { shaBefore: negctlState.shaBefore, bytes: src.length };
}
function negctlRestore() {
  if (!fs.existsSync(BAK)) return null;
  var src = fs.readFileSync(BAK);
  fs.writeFileSync(IONS, src);
  var now = sha256(fs.readFileSync(IONS));
  var want = sha256(src);
  negctlState.restored = { ok: now === want, sha: now, bytes: src.length };
  fs.unlinkSync(BAK);
  negctlState.patched = false;
  return negctlState.restored;
}

/* ============================== 主流程 ============================== */
(async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.rmSync(PROFILE, { recursive: true, force: true });
  /* 上次被强杀留下的补丁 → 先还原（探针自己收拾自己） */
  if (fs.existsSync(BAK)) {
    var r0 = negctlRestore();
    info('发现上次 --negctl 留下的备份，已自动还原 ions.js', JSON.stringify(r0));
  }

  var report = { when: new Date().toISOString(), negctl: NEGCTL, rows: [], results: results };
  var rows = report.rows;
  var edge = null, c = null, failN = 0;

  try {
    if (NEGCTL) {
      var p = negctlPatch();
      info('--negctl：已把 cuoh2-precip 的沉淀调用点临时改回旧画法（去掉内腔参数、基线 ty+th-8、宽 tw-6）',
        'ions.js sha256(before)=' + p.shaBefore.slice(0, 16) + '… bytes=' + p.bytes);
    }

    edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=' + DPORT, '--user-data-dir=' + PROFILE, '--window-size=1440,900',
      '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
    c = await CDP.connect(DPORT);
    await c.send('Runtime.enable'); await c.send('Page.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{window.CUR_SUBJECT="chem";}catch(e){}' +
        'try{localStorage.setItem("qg_subject","chem");}catch(e){}' +
        'try{localStorage.setItem("qg_live_state",JSON.stringify({t:Date.now(),subject:"chem"}));}catch(e){}'
    });
    await c.send('Page.navigate', { url: BASE });
    var booted = false, i;
    for (i = 0; i < 180; i++) {
      if (await c.eval('!!(window.QG_CLAB && window.QG_CLAB.list && window.QG_CLAB.list().length===50)')) { booted = true; break; }
      await sleep(200);
    }
    if (!booted) throw new Error('boot 超时（25s）：检查端口/服务器根目录/guanlan.html 是否加载 7 个脚本');
    await c.eval(MEASURE);
    await c.eval('document.getElementById("glClBtn").click(); 1');
    await sleep(400);
    report.canvas = await c.eval('(function(){var cv=document.getElementById("clCanvas");return [cv.width,cv.height,window.devicePixelRatio];})()');
    info('boot ok', 'canvas=' + JSON.stringify(report.canvas) + '（宽,高,dpr）');
    check('B0 boot：化学科目下 50 个反应登记完成、#clCanvas 可用',
      (await c.eval('window.QG_CLAB.list().length')) === 50 && report.canvas[0] > 0,
      JSON.stringify(report.canvas));

    /* ---------------- 逐个反应 ---------------- */
    console.log('\n=== P1 容器内腔裁剪 · 逐反应像素判据（' + COVERED.length + ' 个）===');
    for (i = 0; i < COVERED.length; i++) {
      var cfg = COVERED[i], t0 = Date.now(), row = { id: cfg.id, note: cfg.note, need: cfg.need.slice(0) };
      try {
        await c.eval('document.querySelector(\'.cl-item[data-id=' + JSON.stringify(cfg.id) + ']\').click(); 1');
        /* 低帧（沉淀最小） */
        await c.eval('(function(){var pr=' + JSON.stringify(cfg.low) + ';for(var k in pr){' +
          'if(Object.prototype.hasOwnProperty.call(pr,k)) window.QG_CLAB.setParam(k,pr[k]);}return 1;})()');
        await c.eval('try{window.QG_CLAB.react(1);}catch(e){} 1');
        await c.eval('window.__PXP.grab(' + JSON.stringify('L_' + cfg.id) + ')');
        /* 高帧（沉淀最大） */
        await c.eval('(function(){var pr=' + JSON.stringify(cfg.high) + ';for(var k in pr){' +
          'if(Object.prototype.hasOwnProperty.call(pr,k)) window.QG_CLAB.setParam(k,pr[k]);}return 1;})()');
        await c.eval('(function(){for(var i=0;i<' + (cfg.react || 3) + ';i++){ window.QG_CLAB.react(1); } return 1;})()');
        row.rows = await c.eval('window.QG_CLAB.state().rows');
        row.lastError = await c.eval('String(window.QG_CLAB.state().lastError||"")');
        row.drawErr = await c.eval('window.QG_CLAB.drawErrorCount(' + JSON.stringify(cfg.id) + ')');
        row.reactErr = await c.eval('window.QG_CLAB.reactErrorCount(' + JSON.stringify(cfg.id) + ')');
        var m = await c.eval('(' + ANALYZE + ')(' + JSON.stringify(cfg.id) + ',' + JSON.stringify(cfg.colors) + ',' +
          cfg.tol + ',' + cfg.minPaper + ',' + JSON.stringify('L_' + cfg.id) + ',' + (cfg.rHint || 0) + ')');
        if (m && m.err) { row.err = m.err; check('P1[' + cfg.id + '] 量到容器内腔', false, m.err); }
        else {
          row.container = m.container; row.out = m.out; row.gapSed = m.gapSed; row.gapChanged = m.gapChanged;
          row.ink = m.ink; row.pickBy = m.pickBy; row.cands = m.cands;
          var rs = runChecks(cfg, m);
          row.checks = rs;
          for (var k2 = 0; k2 < rs.length; k2++) {
            check('P1[' + cfg.id + '] ' + rs[k2].key, rs[k2].ok, rs[k2].detail);
          }
          check('P1[' + cfg.id + '] 运行时无异常（lastError 空 / drawErrorCount=0 / reactErrorCount=0）',
            row.lastError === '' && row.drawErr === 0 && row.reactErr === 0,
            'lastError="' + row.lastError + '" drawErr=' + row.drawErr + ' reactErr=' + row.reactErr);
          info('P1[' + cfg.id + '] 读数',
            'r=' + m.container.r.toFixed(1) + ' chOut=' + m.out.changed18 + ' sedOut=' + m.out.sed +
            ' foreign=' + m.out.foreign + ' absColor=' + m.out.absColor +
            ' gapMaxS=' + (m.gapSed.gapMax === null ? '—' : m.gapSed.gapMax.toFixed(1)) + ' deepS=' + m.gapSed.deepCol +
            ' ink=' + (m.ink.frac * 100).toFixed(0) + '%');
        }
      } catch (e) { row.err = String(e && e.message || e); check('P1[' + cfg.id + '] 执行', false, row.err); }
      row.ms = Date.now() - t0;
      rows.push(row);
      fs.writeFileSync(path.join(OUTDIR, 'clab_pix_report.json'), JSON.stringify(report, null, 1), 'utf8');
    }

    /* ---------------- P2 明确不适用的反应：仍然读一遍，不判分 ---------------- */
    console.log('\n=== P2 不适用清单（逐个说明为什么不用这条判据）===');
    var naIds = Object.keys(NOT_APPLICABLE);
    for (i = 0; i < naIds.length; i++) {
      skip('P2[' + naIds[i] + ']', NOT_APPLICABLE[naIds[i]]);
    }

    /* ---------------- P3 --negctl 断言 ---------------- */
    if (NEGCTL) {
      console.log('\n=== P3 负对照（单点回退必须让 4 条判据同时变红）===');
      var cu = rows.filter(function (r) { return r.id === 'cuoh2-precip'; })[0];
      var keys = {};
      if (cu && cu.checks) { for (i = 0; i < cu.checks.length; i++) keys[cu.checks[i].key] = cu.checks[i]; }
      var wantRed = ['outChanged', 'outSed', 'gap(sed)', 'ink'];
      var red = 0, j;
      for (j = 0; j < wantRed.length; j++) { if (keys[wantRed[j]] && !keys[wantRed[j]].ok) red++; }
      check('N1 负对照[cuoh2-precip]：4 条判据必须同时变红（' + wantRed.join(' / ') + '）',
        red === 4,
        JSON.stringify({ redCount: red, outChanged: keys['outChanged'] ? keys['outChanged'].detail : '—',
          outSed: keys['outSed'] ? keys['outSed'].detail : '—',
          gap: keys['gap(sed)'] ? keys['gap(sed)'].detail : '—',
          ink: keys['ink'] ? keys['ink'].detail : '—' }));
      /* 相邻反应一动不动 */
      var others = ['agcl-precip', 'baso4-precip', 'feoh3-precip', 'complex-ion'], bad = [];
      for (j = 0; j < others.length; j++) {
        var rr = rows.filter(function (r) { return r.id === others[j]; })[0];
        if (!rr || !rr.checks) { bad.push(others[j] + ':无数据'); continue; }
        for (i = 0; i < rr.checks.length; i++) { if (!rr.checks[i].ok) bad.push(others[j] + '.' + rr.checks[i].key); }
      }
      check('N2 负对照的**局部性**：相邻 4 个反应（agcl/baso4/feoh3/complex-ion）的判据必须全绿（证明判据不是瞎红）',
        bad.length === 0, bad.length ? ('仍然变红的判据：' + bad.join(', ')) : '四个反应全绿');
    }

    /* ---------------- P4 收尾 ---------------- */
    console.log('\n=== P4 收尾 ===');
    check('G1 全程 0 条未捕获异常（Runtime.exceptionThrown）', c.errors.length === 0,
      c.errors.slice(0, 3).join(' | ') || 'n=0');
  } catch (e) {
    check('harness error', false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { if (c) c.close(); } catch (e) { }
    try { if (edge) edge.kill(); } catch (e) { }
    if (negctlState.patched || fs.existsSync(BAK)) {
      var rz = negctlRestore();
      info('--negctl 收尾：ions.js 已按字节还原', JSON.stringify(rz));
      check('N3 --negctl 后产品代码按字节还原（sha256 与打补丁前一致）',
        !!rz && rz.ok === true, JSON.stringify(rz));
    }
    /* 汇总 */
    var pass = 0, fail = 0, sk = 0, q;
    for (q = 0; q < results.length; q++) {
      if (results[q].skip) sk++;
      else if (results[q].ok) pass++;
      else fail++;
    }
    failN = fail;
    if (NEGCTL) {
      /* 负对照模式：那 4 条 FAIL 是故意的 ⇒ 退出码看 N1/N2/N3 是否都过 */
      var nOK = true, nn2;
      for (nn2 = 0; nn2 < results.length; nn2++) {
        if (/^N[123] /.test(results[nn2].name) && !results[nn2].ok) nOK = false;
      }
      console.log('\n（--negctl 模式）上面 P1[cuoh2-precip] 的 ' + (4) + ' 条 FAIL 是**故意**的：' +
        '负对照按设计变红 ⇒ 退出码看 N1/N2/N3：' + (nOK ? '全过 ⇒ exit 0' : '有不过 ⇒ exit 1'));
      failN = nOK ? 0 : 1;
    }
    report.summary = { pass: pass, fail: fail, skip: sk, negctl: NEGCTL, exitCode: failN ? 1 : 0 };
    fs.writeFileSync(path.join(OUTDIR, 'clab_pix_report.json'), JSON.stringify(report, null, 1), 'utf8');
    /* 人看的对照表 */
    var md = '# 化学实验台「容器内腔裁剪」常驻探针 · ' + (NEGCTL ? '负对照(--negctl)' : '正常') + '\n\n';
    md += '阈值：chOut(1-8)≤4、chOut(1-3)≤4、sedOut≤2、foreign≤2、absRay≤40（ester-hydrolysis≤12）、' +
      'gapMaxS≤6 且最深列∈[2,6]、ink≥85%。判定列 ✓ = 该反应这一轮无 FAIL；FAIL: … = 哪几条红了；「（不判分）」= 该反应本轮不断言（原因见下）。「判据」列写的是本反应**实际断言**哪几条。\n\n';
    md += '| 反应 | 判据（need） | 容器 r | chOut(1-8) | chOut(1-3) | sedOut | foreign | absRay | absColor(参考) | gapMaxS | 最深列 | ink | 判定 |\n';
    md += '|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
    for (q = 0; q < rows.length; q++) {
      var R = rows[q];
      var needTxt = (R.need && R.need.length) ? R.need.join('+') : '**（不判分）**';
      if (!R.out) { md += '| `' + R.id + '` | ' + needTxt + ' | — | — | — | — | — | — | — | — | — | — | ERR ' + (R.err || '') + ' |\n'; continue; }
      var verdict = (R.checks || []).filter(function (x) { return !x.ok; }).map(function (x) { return x.key; });
      var vTxt = verdict.length ? ('**FAIL: ' + verdict.join(' / ') + '**') : ((R.need && R.need.length) ? '✓' : '（不判分）');
      md += '| `' + R.id + '` | ' + needTxt + ' | ' + R.container.r.toFixed(1) + ' | ' + R.out.changed18 + ' | ' + R.out.changed13 + ' | ' +
        R.out.sed + ' | ' + R.out.foreign + ' | ' + R.out.absRay + ' | ' + R.out.absColor + ' | ' +
        (R.gapSed.gapMax === null ? '—' : R.gapSed.gapMax.toFixed(1)) + ' | ' + R.gapSed.deepCol + ' | ' +
        (R.ink.frac * 100).toFixed(0) + '% | ' + vTxt + ' |\n';
    }
    md += '\n不适用清单：\n';
    var ks = Object.keys(NOT_APPLICABLE);
    for (q = 0; q < ks.length; q++) md += '- `' + ks[q] + '`：' + NOT_APPLICABLE[ks[q]] + '\n';
    fs.writeFileSync(path.join(OUTDIR, 'clab_pix_table.md'), md, 'utf8');

    console.log('\n==== CLAB PIX probe: ' + pass + '/' + (pass + fail) + ' passed' +
      (sk ? ('（另有 ' + sk + ' 条 SKIP=不适用，不计入）') : '') + ' ====');
    if (fail) {
      console.log('FAILED:');
      for (q = 0; q < results.length; q++) if (!results[q].skip && !results[q].ok) console.log('  - ' + results[q].name + ' :: ' + results[q].extra);
    }
    console.log('WROTE ' + path.join(OUTDIR, 'clab_pix_report.json'));
    console.log('WROTE ' + path.join(OUTDIR, 'clab_pix_table.md'));
  }
  process.exit(failN ? 1 : 0);
})();
