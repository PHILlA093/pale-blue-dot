/* ============================================================================
 * 穷观 · 化学实验台 —— 组 2 · 金属与非金属单质（js/clab/metals.js）
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向实验台注册表登记 10 个反应
 *     window.QG_CLAB.register(id, spec)
 * 不自建 DOM、不起循环、不读写全局状态（惰性，与物理实验台各组一致）。
 *
 * ── 契约依据 ────────────────────────────────────────────────────────────────
 *   docs/化学实验台设计.md  §2 组 2 · 金属与非金属单质（10 个 id 逐字一致）
 *                           §3 register(id, spec) 的字段与 react() 返回要求
 *                           §4 每个反应的验收（1~8 条）
 *   docs/物理实验台设计.md  §9 实现约定补充（核心落地后追认，比 §4/§5 更权威）
 *     ① null = "这张图上没有有效值"（本组 10 个反应都是**纯定性**：
 *        columns: [] + graph: null，契约 §3 明确合法）；
 *     ② g.font 宽容签名：本文件一律用 g.font(size) / g.font(size, true|false)
 *        （默认斜体衬线，纸色观感），**不**自己拼 true/false 进字体串；
 *     ③ 滑块 step 会被归一化 —— 本文件每个滑块都给了与量程匹配的 step；
 *     ④ 没有 min/max 的条件参数**必须**写成 type:'select' + options
 *        （本组的 常温/加热、浓/稀、金属种类、气氛、光照、是否打磨… 全部走 select）。
 *
 * ── 本组特别注意（用户点名） ────────────────────────────────────────────────
 *   · 浓/稀硝酸产物不同  → cu-hno3 用 type:'select' 选浓/稀，方程式与气体颜色随之变；
 *   · 钠常温/加热产物不同 → na-oxygen 选条件，常温 Na₂O（白）/ 加热 Na₂O₂（淡黄）；
 *   · 氯水成分与漂白性    → cl2-water：浅黄绿色、三分子四离子、石蕊先红后褪、
 *                           干燥氯气不漂白（漂白的是 HClO）、见光分解 2HClO = 2HCl + O₂↑；
 *   · 铝热反应的高温现象  → al-thermite：镁条引燃 + KClO₃ 助燃、耀眼白光、火星四射、
 *                           纸漏斗烧穿、红热铁珠落入沙中；
 *   · Mg 在 CO₂ 中燃烧    → mg-co2：反常识反应，条件（点燃）与产物（白色 MgO + 黑色 C）
 *                           都写清楚，并给出"CO₂ 不能扑灭镁火灾"的结论。
 *
 * ── 化学事实来源（逐条核对，均为 http(s) 可复核来源；标注"全文/摘录"） ──────
 *   [T1] 人教版《普通高中教科书·化学 必修 第一册》（2019 版，扫描/数字版 PDF，
 *        华南师范大学 moodle 镜像，**全文**）：
 *        https://moodle.scnu.edu.cn/pluginfile.php/1332827/mod_folder/content/0/2023%e7%89%88%e4%ba%ba%e6%95%99%e7%89%88%e5%bf%85%e4%bf%ae%e4%b8%80.pdf
 *        · 钠：熔点 97.8 ℃、沸点 883 ℃、密度 0.971 g/cm³（P34 "数据"栏）
 *        · 4Na + O₂ = 2Na₂O（常温，白色氧化钠）；2Na + O₂ --△--> Na₂O₂
 *          "钠受热后先熔化，然后与氧气剧烈反应，发出黄色火焰，生成一种淡黄色固体"
 *        · 2Na + 2H₂O = 2NaOH + H₂↑；"能与水发生剧烈反应；反应时放出热量；
 *          反应后得到的溶液显碱性"（P37）
 *        · Fe + CuSO₄ = FeSO₄ + Cu；离子方程式 Fe + Cu²⁺ = Cu + Fe²⁺（P27 习题 10；
 *          P91 实验活动"在一支试管中加入 2 mL CuSO₄ 溶液，再将一段铁丝放入"
 *          "过一会儿，取出铁丝，观察现象"）；FeCl₃ 溶液棕黄色、Fe²⁺ 浅绿色（P83）
 *        · "钠、铁、铜等都能与氯气在加热条件下发生反应：2Fe + 3Cl₂ --△--> 2FeCl₃、
 *          Cu + Cl₂ --△--> CuCl₂"（P45）；习题："将烧至红热的铁丝伸到盛有氯气的
 *          集气瓶中，可观察到铁丝剧烈燃烧，产生棕黄色的烟"（P77）
 *        · 氯水：25 ℃ 时 1 体积水溶解约 2 体积氯气；Cl₂ + H₂O ⇌ HCl + HClO；
 *          "次氯酸的强氧化性还能使某些染料和有机色素褪色"；"次氯酸不稳定，在光照下
 *          容易分解放出氧气：2HClO --光照--> 2HCl + O₂↑"；实验 2-8 干燥的与湿润的
 *          有色纸条分别放入盛干燥氯气的集气瓶；图 2-16 光照过程中氯水的 pH、Cl⁻ 浓度、
 *          O₂ 体积分数的变化（数字化实验）（P46~P48）
 *        · 铝与 NaOH：【实验 3-5】"放入打磨过铝片的试管中立即产生气泡；而放入未打磨的
 *          铝片的试管中开始没有气泡，一段时间后才产生气泡"；
 *          2Al + 2NaOH + 6H₂O = 2Na[Al(OH)₄] + 3H₂↑（四羟基合铝酸钠）；
 *          Al₂O₃ + 2NaOH + 3H₂O = 2Na[Al(OH)₄]（P82）
 *        · 铝热：习题 3 "高温下铝粉与氧化铁的反应可用来焊接钢轨……该反应放出大量的热，
 *          置换出的铁呈熔融态。熔融的铁流入钢轨的裂缝里，冷却后就将钢轨牢牢地焊接
 *          在一起"（P27）
 *   [T2] 人教版《普通高中教科书·化学 必修 第二册》（扫描件 PDF，**全文**；
 *        该 PDF 文本层部分字形编码异常，化学式/方程式行可读）：
 *        http://www.hxzxs.cn/uploads/soft/%E6%99%AE%E9%80%9A%E9%AB%98%E4%B8%AD%E6%95%99%E7%A7%91%E4%B9%A6%E8%A7%A3%E8%AF%BB%E4%B9%8B%E5%BF%85%E4%BF%AE%E4%BA%8C.pdf
 *        · 硫：S + Fe --△--> FeS（硫化亚铁）；S + 2Cu --△--> Cu₂S（硫化亚铜）；
 *          硫的熔点 113 ℃、沸点 445 ℃、密度 2.06 g/cm³（P2）
 *        · 硝酸：4HNO₃(浓) + Cu = Cu(NO₃)₂ + 2NO₂↑ + 2H₂O；
 *          8HNO₃(稀) + 3Cu = 3Cu(NO₃)₂ + 2NO↑ + 4H₂O（P15）；
 *          习题原文："（3）使用浓硝酸进行实验：反应剧烈进行，铜丝变细，溶液变绿，
 *          试管中放出红棕色气体……②某同学推测反应后溶液呈绿色的原因是 NO₂ 溶于其中"
 *          （P20，OCR 字形异常，语义可辨）
 *        · 铝热：Fe₂O₃ + 2Al --高温--> 2Fe + Al₂O₃（P89 金属矿物的开发利用）
 *   [S1]《科普中国》"氯水"词条（中国科协主办，**全文**）：
 *        https://www.kepuchina.cn/article/articleinfo?ar_id=355057
 *        "饱和氯水呈现浅黄绿色"；"3 种分子：Cl₂、HClO、H₂O；4 种离子：Cl⁻、H⁺、
 *         ClO⁻、OH⁻"；"久置氯水由于次氯酸的见光分解(2HClO=2HCl+O₂↑)，基本上可以看成
 *         是盐酸，所以氯水要用棕色试剂瓶保存"；"可以使蓝色石蕊试纸先变红色（酸性）
 *         后褪色（次氯酸的漂白作用）"；"最后导致氯水的黄绿色颜色消失，pH 减小"
 *   [S2]《生活教育》2020 年 7 月第 7 期（南京晓庄学院教学资源镜像，**全文**）中
 *        "钠与水反应"现象—原因对照表：钠浮在水面上（密度比水小）/ 熔成一个小球
 *        （反应放热，熔点低）/ 在水面上四处游动（气体推动小球移动）/
 *        发出嘶嘶的响声（反应剧烈，放出气体）/ 反应后溶液变红（生成碱性物质），
 *        概括为"浮 熔 游 响 红"：
 *        https://tyy.njxzc.edu.cn/_upload/article/files/c2/41/d98d199041279ec45728c99bf193/48c5d4fc-08a0-4e23-a375-68a9b94a1180.pdf
 *   [S3] 高中化学教材"铝热反应"现象原文（现行教材表述，题库逐字引用，**摘录**）：
 *        "'反应放出大量的热，并发出耀眼的光芒''纸漏斗的下部被烧穿，有熔融物落入沙中'"
 *        https://www.jyeoo.com/shiti/313d1064-e115-4159-8058-3878250537fd
 *        实验步骤（教材实验，逐字引用，**摘录**）："把 5 g 炒干的氧化铁粉末和 2 g 铝粉
 *        混合均匀后放入纸漏斗中，上面加少量氯酸钾并在混合物中间插一根镁条，用小木条
 *        点燃镁条"；现象"①镁条剧烈燃烧；②放出大量的热，并发出耀眼的光芒，火星四射；
 *        ③纸漏斗的下部被烧穿；④有红热状态的液珠落入蒸发皿内的细沙上，液珠冷却后变为
 *        黑色固体"；镁条=引燃剂、氯酸钾=助燃剂
 *        https://www.jyeoo.com/shiti/ff665610-2915-4150-95aa-25fa2e5bab74
 *   [S4] 铜在氯气中燃烧（现行教材实验表述，题库逐字引用，**摘录**）：
 *        "红热的铜丝在氯气里剧烈燃烧，使集气瓶中充满棕黄色的烟，这种烟实际上是氯化铜
 *        固体颗粒……CuCl₂ 溶于少量水后，溶液呈蓝绿色"；"用坩埚钳夹住一束铜丝，灼热后，
 *        立刻放入充满氯气的集气瓶"
 *        https://www.jyeoo.com/shiti/108f3b43-15ef-4e15-5a67-0cb1df254a90
 *   [S5] 镁在二氧化碳中燃烧（加州大学圣塔芭芭拉分校化学演示库，**全文**）：
 *        "The reaction that is occurring is Mg(s) + CO₂(s) → C(s) + MgO(s)；
 *         The black residue left over after the reaction is complete is carbon and
 *         the white residue is the MgO. … Due to the above reaction CO₂ fire
 *         extinguishers should never be used to put out Mg fires."
 *        https://people.chem.ucsb.edu/feldwinn/darby/DemoLibrary/DemoPDFs/Demo012.pdf
 *        现象（中文题库逐字引用，**摘录**）："将镁条点燃后迅速伸入盛有二氧化碳的集气瓶中，
 *        发现镁条剧烈燃烧，发出白光，放热，产生一种白色粉末和一种黑色粉末"
 *        https://www.jyeoo.com/shiti/4bf10510-815f-1540-520e-371f2255e26c
 *   [S6] 铜与稀硝酸（常州市武进区洛阳高级中学 樊耀平《铜与稀硝酸反应实验的探究》，
 *        **全文**）：3Cu + 8HNO₃(稀) = 3Cu(NO₃)₂ + 2NO↑ + 4H₂O；2NO + O₂ = 2NO₂；
 *        浓度实测（室温 10 ℃）：2 mol/L"反应极其缓慢/无明显现象"、
 *        4 mol/L 与 5 mol/L"溶液变蓝，产生无色气体"、6 mol/L"溶液变蓝，产生淡红棕色气体"；
 *        "在水浴和催化剂条件下，反应都明显加快"；"教材中的试管实验，铜和稀硝酸反应，
 *        由于试管内存在空气……观察不到无色气体"
 *        http://www.lygz.wj.czedu.cn/html/article1366069.html
 *   [S7] FeS 与磁铁（中学实验现象，题库逐字引用，**摘录**）："将少量硫粉与铁粉混合后堆放
 *        在石棉网上，小心地加热，待反应一发生即停止加热，反应仍可持续进行。若两者恰好
 *        完全反应，生成黑色的硫化亚铁。实验结束后……用磁体吸引该黑色固体，发现它不能
 *        被磁铁吸引。"（同时印证：反应放热、可自持）
 *        http://www.jyeoo.com/shiti/fc103641-c158-4150-995c-71b4e18ff25c
 *   [S8] 硫化亚铜 Cu₂S 的物相（Encyclopaedia Britannica "chalcocite"，**全文**）：
 *        "Chalcocite (Cu₂S) belongs to a group of sulfide minerals formed at
 *         relatively low temperatures"
 *        https://www.britannica.com/science/chalcocite
 *   [S9] 北京化工大学 国有资产与实验室安全管理处《【安全提示】锂、钠、钾等易制爆活泼金属
 *        安全提示》（2025-10-04，.edu.cn 实验室安全官方页，**全文**）：
 *        "2025 年 9 月 1 日，某高校两名硕士研究生在实验过程中将金属钠块投入水中，引发剧烈
 *         反应导致爆炸。喷溅物造成两人面部及双手灼伤……"；
 *        "金属钠为活泼金属，遇水会发生剧烈放热反应并释放氢气，可能导致爆炸"；
 *        "活泼金属火灾严禁用水、二氧化碳、泡沫灭火剂扑救，应使用干沙或灭火毯覆盖灭火"
 *        —— na-water 的"钠块过大可能燃烧/爆鸣"与 mg-co2 的"CO₂ 不能扑灭镁、要用干燥沙土"
 *        两条都以此为准（也与人教版"活泼金属火灾不能用水而要用干燥沙土"一致）。
 *        https://labsafety.buct.edu.cn/2025/1004/c10859a211444/page.htm
 *
 * 常用常量按 IUPAC/教材值取：M(Na)=22.99、M(Al)=26.98、M(Fe)=55.85、M(Cu)=63.55、
 * M(S)=32.06、M(Mg)=24.31、M(O)=16.00、M(C)=12.01 g/mol；
 * M(Fe₂O₃)=159.69、M(CuSO₄)=159.61、M(Na₂O)=61.98、M(Na₂O₂)=77.98 g/mol；
 * 标准状况气体摩尔体积 Vm = 22.4 L/mol。
 *
 * 纯 ES5（无箭头函数 / let / const / 模板串 / class / eval / new Function）、
 * 零依赖、不联网、不自建 DOM。指纹 QG-20260920-5e5d5a。
 *
 * ── 两处"故意这么写"（照抄 AGENTS.md §13 的两条教训，别当成缺陷改掉）────────────────
 *   ① **draw 里没有任何空 catch**：画图原语（seg/circ/box/poly/txt…）一律不写 try/catch。
 *      组内的空 catch 会把绘制异常吞在 body 内部 —— 那样 console 干净、核心的
 *      state().lastError 也是空的、探针全绿，而画面上只画了一半（物理实验台真踩过：
 *      单摆/胡克定律整块没画）。异常要让它**穿出 spec.draw**，由核心在那一层统一接住
 *      并写在纸上；本文件的自测另有一条负对照（注入中途抛错的 ctx 必须被检出）。
 *   ② draw 里的 `var X = sc.X, Y = sc.Y, Z = sc.Z;` 是**转存函数**（把 scene() 的坐标
 *      映射方法取成短名字，再 s.X(40) 这样调用）。这正是物理核心 shadowAudit 记录在案的
 *      "合法误报形状"（`var line = d.line; line(...)`）—— 不是"局部变量被当函数调用"
 *      那类真缺陷（真缺陷是 RHS 为函数调用/普通值）。
 * ========================================================================== */
(function () {
  'use strict';

  if (!window.QG_CLAB || typeof window.QG_CLAB.register !== 'function') return;

  var GROUP = '金属与非金属单质';

  /* ------------------------------------------------------------------ 常量 */
  var M_NA = 22.99, M_AL = 26.98, M_FE = 55.85, M_CU = 63.55, M_S = 32.06;
  var M_MG = 24.31, M_O = 16.00, M_C = 12.01;
  var M_FE2O3 = 159.69, M_CUSO4 = 159.61, M_NA2O = 61.98, M_NA2O2 = 77.98;
  var M_MGO = 40.31, M_CO2 = 44.01, M_CU2S = 159.16, M_FES = 87.91;
  var VM = 22.4;              /* 标准状况气体摩尔体积 L/mol */
  var C_WATER = 4.18;         /* 水的比热容 J/(g·℃) */
  var DH_NA_WATER = 184.0;    /* 2Na + 2H₂O = 2NaOH + H₂↑ 的 |ΔH| ≈ 368 kJ/mol ÷ 2 = 184 kJ/mol Na */

  /* ------------------------------------------------------------------ 小工具 */
  function isFn(f) { return typeof f === 'function'; }
  function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  /* 读参数（p 可能被核心传成 null/空对象，一律要有默认值兜底） */
  function pn(p, k, d) { return num(p ? p[k] : undefined, d); }
  function ps(p, k, d) {
    var v = p ? p[k] : undefined;
    if (v === undefined || v === null || v === '') return d;
    return String(v);
  }
  function isSel(p, k, v) { return ps(p, k, '') === v; }
  function fx(x, n) {
    if (!isFinite(x)) return '—';
    var d = (n === undefined) ? 2 : n;
    var q = Math.pow(10, d);
    var v = Math.round(x * q) / q;
    var s = String(v);
    if (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) s = v.toFixed(d);
    return s;
  }
  /* 确定性伪随机（画图用；同一参数 + 同一相位 → 同一张图，便于像素签名比对） */
  function rnd(seed) {
    var s = (Math.floor(Math.abs(seed)) % 2147483647) || 1;
    return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }

  /* ------------------------------------------------------------------ 画图 */
  function ink(g) { return (g && g.ink) ? g.ink : '#26221C'; }
  /* 布局：把 760×470 的设计坐标映射到任意画布，并居中 */
  function scene(g) {
    var W = num(g && g.w, 760), H = num(g && g.h, 470);
    var k = Math.min(W / 760, H / 470);
    if (!(k > 0)) k = 1;
    var ox = (W - 760 * k) / 2, oy = (H - 470 * k) / 2;
    return {
      W: W, H: H, k: k,
      X: function (x) { return ox + x * k; },
      Y: function (y) { return oy + y * k; },
      Z: function (s) { return s * k; }
    };
  }
  /* 字体：用核心承诺的宽容签名（size）/（size, 是否斜体）/（size, 是否斜体, 是否粗体）。
     ⚠ 核心的 g.font() 只**返回**字体串（不写 ctx.font），所以必须把返回值赋给 c.font；
     自己拼串时绝不能把 true/false 拼进去（非法串会被 canvas 静默忽略，观感整体丢失）。
     ⚠⚠ 这里**不写 try/catch**（AGENTS.md §13「第二类盲区」）：组内的空 catch 会把绘制异常吞掉，
     让核心的 state().lastError / drawErrorCount 这类闸门全部看不见 —— 异常要让它穿出去，
     由核心在 spec.draw 这一层统一接住并写在纸上。 */
  function font(g, size, italic, bold) {
    var px = Math.round(num(size, 13) * 100) / 100;
    if (!(px > 0)) px = 13;
    var out = '';
    if (g && isFn(g.font)) out = String(g.font(px, italic !== false, !!bold) || '');
    if (!out) {
      out = (italic === false ? '' : 'italic ') + (bold ? 'bold ' : '') +
        px + 'px Georgia,"Times New Roman",serif';
    }
    if (g && g.c) g.c.font = out;
    return out;
  }
  function txt(g, s, x, y, size, color, align, italic, bold) {
    if (!g || !g.c) return;
    var c = g.c;
    c.save();
    font(g, size, italic, bold);
    c.fillStyle = color || ink(g);
    c.textAlign = align || 'left';
    c.fillText(String(s), x, y);
    c.restore();
  }
  function seg(g, x1, y1, x2, y2, color, w, dash) {
    if (!g || !g.c) return;
    var c = g.c;
    c.save();
    c.strokeStyle = color || ink(g);
    c.lineWidth = w || 1.2;
    if (dash && isFn(c.setLineDash)) c.setLineDash(dash);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.restore();
  }
  function curve(g, x1, y1, cx, cy, x2, y2, color, w) {
    if (!g || !g.c) return;
    var c = g.c;
    c.save();
    c.strokeStyle = color || ink(g);
    c.lineWidth = w || 1.2;
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.stroke();
    c.restore();
  }
  function box(g, x, y, w, h, color, fill, lw) {
    if (!g || !g.c) return;
    var c = g.c;
    c.save();
    if (fill) { c.fillStyle = color || ink(g); c.fillRect(x, y, w, h); }
    else { c.strokeStyle = color || ink(g); c.lineWidth = lw || 1.4; c.strokeRect(x, y, w, h); }
    c.restore();
  }
  function circ(g, x, y, r, color, fill, lw) {
    if (!g || !g.c) return;
    var c = g.c;
    c.save();
    c.beginPath(); c.arc(x, y, Math.max(0.4, r), 0, Math.PI * 2);
    if (fill) { c.fillStyle = color || ink(g); c.fill(); }
    else { c.strokeStyle = color || ink(g); c.lineWidth = lw || 1.1; c.stroke(); }
    c.restore();
  }
  function poly(g, pts, color, fill, lw, close) {
    if (!g || !g.c || !pts || pts.length < 2) return;
    var c = g.c, i;
    c.save();
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (close !== false) c.closePath();
    if (fill) { c.fillStyle = color || ink(g); c.fill(); }
    else { c.strokeStyle = color || ink(g); c.lineWidth = lw || 1.4; c.stroke(); }
    c.restore();
  }
  function arrow(g, x1, y1, x2, y2, color, lw) {
    if (!g || !g.c) return;
    var c = g.c;
    c.save();
    c.strokeStyle = color || ink(g); c.fillStyle = color || ink(g);
    c.lineWidth = lw || 1.3;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    var a = Math.atan2(y2 - y1, x2 - x1), L = 7;
    c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - L * Math.cos(a - 0.42), y2 - L * Math.sin(a - 0.42));
    c.lineTo(x2 - L * Math.cos(a + 0.42), y2 - L * Math.sin(a + 0.42));
    c.closePath(); c.fill();
    c.restore();
  }
  /* 火焰：外焰 + 内焰 */
  function flame(g, x, y, h, w, c1, c2) {
    if (!g || !g.c) return;
    var hh = Math.max(3, h), ww = Math.max(2, w || h * 0.42);
    poly(g, [[x, y - hh], [x + ww * 0.5, y - hh * 0.45], [x + ww * 0.34, y],
      [x - ww * 0.34, y], [x - ww * 0.5, y - hh * 0.45]],
      c1 || 'rgba(240,170,60,.85)', true);
    poly(g, [[x, y - hh * 0.62], [x + ww * 0.24, y - hh * 0.22], [x, y],
      [x - ww * 0.24, y - hh * 0.22]], c2 || 'rgba(120,180,235,.85)', true);
  }
  /* 上升气泡：相位由 state.phase 驱动 */
  function bubblesUp(g, seed, x0, x1, yTop, yBot, n, phase, color, rmax, rmin) {
    if (!g || !g.c) return;
    var r = rnd(seed), span = Math.max(1, yBot - yTop), i, x, y, rr, t;
    for (i = 0; i < n; i++) {
      x = x0 + (x1 - x0) * r();
      t = (r() + (phase || 0)) % 1;
      y = yBot - span * t;
      rr = (rmin || 1.1) + ((rmax || 3.2) - (rmin || 1.1)) * r();
      circ(g, x, y, rr, color || 'rgba(38,34,28,.55)', false, 1);
    }
  }
  /* 火星四射 */
  function sparks(g, seed, cx, cy, r0, n, phase, color, len) {
    if (!g || !g.c) return;
    var r = rnd(seed), i, a, d, L;
    for (i = 0; i < n; i++) {
      a = r() * Math.PI * 2;
      d = r0 * (0.45 + 0.9 * ((r() + (phase || 0)) % 1));
      L = (len || 6) * (0.5 + r());
      seg(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75,
        cx + Math.cos(a) * (d + L), cy + Math.sin(a) * (d + L) * 0.75,
        color || 'rgba(255,190,80,.95)', 1.6);
    }
  }
  /* 烟/固体小颗粒云 */
  function puff(g, seed, cx, cy, r0, n, color, alpha, dy) {
    if (!g || !g.c) return;
    var r = rnd(seed), i, a, d, rr;
    for (i = 0; i < n; i++) {
      a = r() * Math.PI * 2;
      d = r0 * Math.sqrt(r());
      rr = r0 * 0.16 * (0.5 + r());
      circ(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * (dy === undefined ? 0.72 : dy) ,
        rr, color || 'rgba(196,148,60,' + (alpha === undefined ? 0.5 : alpha) + ')', true);
    }
  }
  /* 耀眼白光（星芒） */
  function star(g, cx, cy, r1, r2, n, color, phase) {
    if (!g || !g.c) return;
    var i, a, w;
    for (i = 0; i < n; i++) {
      a = (i / n) * Math.PI * 2 + (phase || 0) * 0.6;
      w = (i % 2) ? 1.2 : 2.2;
      seg(g, cx + Math.cos(a) * r1 * 0.5, cy + Math.sin(a) * r1 * 0.5,
        cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, color || 'rgba(255,244,200,.9)', w);
    }
    circ(g, cx, cy, r1, color || 'rgba(255,248,220,.95)', true);
  }
  /* 烧杯（上宽下略窄 + 嘴） */
  function beaker(g, x, y, w, h) {
    var x2 = x + w, y2 = y + h;
    seg(g, x, y, x, y2, ink(g), 2);
    seg(g, x2, y, x2, y2, ink(g), 2);
    seg(g, x, y2, x2, y2, ink(g), 2);
    seg(g, x, y, x + 6, y - 5, ink(g), 2);
    seg(g, x + 6, y - 5, x2, y, ink(g), 2);
  }
  /* 试管（圆底，口朝上） */
  function tube(g, cx, top, w, h) {
    var hw = w / 2, bot = top + h;
    seg(g, cx - hw, top, cx - hw, bot - hw, ink(g), 2);
    seg(g, cx + hw, top, cx + hw, bot - hw, ink(g), 2);
    if (g && g.c) {
      g.c.save();
      g.c.strokeStyle = ink(g); g.c.lineWidth = 2;
      g.c.beginPath(); g.c.arc(cx, bot - hw, hw, 0, Math.PI); g.c.stroke();
      g.c.restore();
    }
  }
  /* 液体（矩形 + 液面线） */
  function liq(g, x, y, w, h, color) {
    box(g, x, y, w, h, color, true);
    seg(g, x, y, x + w, y, 'rgba(38,34,28,.45)', 1);
  }

  /* ==========================================================================
   * 1 · na-water   钠与水的反应
   * ======================================================================== */
  window.QG_CLAB.register('na-water', {
    id: 'na-water',
    name: '钠与水的反应',
    group: GROUP,
    aim: '观察钠与水反应的现象（浮、熔、游、响、红），写出化学方程式与离子方程式，并解释钠为什么必须保存在煤油中',
    principle: '2Na + 2H2O = 2NaOH + H2↑（放热反应，每 2 mol Na 约放出 368 kJ 热量）。' +
      '钠的密度 0.971 g/cm³ 小于水 → 浮在水面；钠的熔点只有 97.8 ℃，反应放热使钠熔成小球；' +
      '生成的氢气推动小球在水面游动并发出嘶嘶声；产物 NaOH 使酚酞变红（溶液显碱性）。' +
      '正因为钠与水剧烈反应放热，量大时可能燃烧甚至爆鸣，实验室必须把钠保存在煤油（或石蜡油）中隔绝空气和水；' +
      '活泼金属着火也不能用水扑救，要用干燥沙土。',
    apparatus: ['烧杯', '镊子', '滤纸', '小刀', '钠块（保存在煤油中）', '酚酞溶液', '温度计'],
    steps: ['向烧杯中加入约 1/2 体积的水，滴入 2 滴酚酞溶液', '用镊子取一小块钠（绿豆大），用滤纸吸干表面的煤油',
      '把钠投入水中，观察钠的位置、形状、运动与声音', '观察溶液颜色变化，反应后触摸烧杯外壁感受温度'],
    params: [
      { key: 'naMass', label: '钠块质量', unit: 'g', min: 0.05, max: 0.6, step: 0.01, value: 0.2 },
      { key: 'temp', label: '水温', unit: '℃', min: 5, max: 80, step: 5, value: 25 },
      { key: 'drops', label: '酚酞滴数', unit: '滴', min: 0, max: 5, step: 1, value: 2 }
    ],
    react: function (p) {
      var m = clamp(pn(p, 'naMass', 0.2), 0.02, 5);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var drops = clamp(pn(p, 'drops', 2), 0, 10);
      var nNa = m / M_NA;                       /* mol */
      var nH2 = nNa / 2;
      var vH2 = nH2 * VM * 1000;                /* mL（标准状况） */
      var heat = nNa * DH_NA_WATER;             /* kJ */
      var dT = heat * 1000 / (100 * C_WATER);   /* 100 mL 水 */
      var T2 = T + dT;
      var force = m * (1 + (T - 25) / 45);      /* 剧烈程度指数 */
      var ph = [];
      ph.push('钠浮在水面上（ρ(Na) = 0.971 g/cm³ ＜ ρ(水)）');
      ph.push('钠熔成闪亮的小球（熔点 97.8 ℃，反应放热使钠熔化）');
      if (force < 0.16) {
        ph.push('小球缓慢地在水面上游动，发出轻微的嘶嘶声');
      } else if (force < 0.35) {
        ph.push('小球在水面上四处游动，发出明显的嘶嘶声');
      } else {
        ph.push('小球在水面上急速游动，嘶嘶声很响，水面被搅动');
      }
      if (m >= 0.4) {
        ph.push('放热集中：钠球最后着火燃烧，发出黄色火焰（钠块过大时甚至爆鸣，' +
          '教材特别提醒"不要近距离俯视烧杯"）');
      }
      if (drops > 0) {
        ph.push('滴有酚酞的水变红（生成 NaOH，溶液显碱性）');
      } else {
        ph.push('未滴酚酞：溶液仍是无色，需用酚酞或 pH 试纸才能检验出碱性（反应后溶液显碱性）');
      }
      ph.push('理论生成 H₂ 约 ' + fx(vH2, 0) + ' mL（标准状况，n(Na) = ' + fx(m, 2) + ' g ÷ 22.99 g/mol）');
      ph.push('放热约 ' + fx(heat, 2) + ' kJ，水温由 ' + fx(T, 0) + ' ℃ 升到约 ' + fx(T2, 1) + ' ℃');
      if (T >= 60) ph.push('水温高，反应一开始就很剧烈（温度升高加快了反应速率）');
      return {
        phenomena: ph,
        equation: '2Na + 2H2O = 2NaOH + H2↑',
        ionic: '2Na + 2H2O = 2Na+ + 2OH- + H2↑',
        type: '置换反应（金属与水反应，属于氧化还原反应）',
        conditions: '常温常压，钠块 ' + fx(m, 2) + ' g（绿豆大），水温 ' + fx(T, 0) + ' ℃',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var m = clamp(pn(p, 'naMass', 0.2), 0.02, 5);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var drops = clamp(pn(p, 'drops', 2), 0, 10);
      var nNa = m / M_NA;
      var vH2 = nNa / 2 * VM * 1000;
      var dT = nNa * DH_NA_WATER * 1000 / (100 * C_WATER);
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：钠与水的反应可以用"浮、熔、游、响、红"五个字概括 —— ' +
          '浮（密度比水小）、熔（熔点低且反应放热）、游与响（生成的 H₂ 推动小球并发出嘶嘶声）、' +
          '红（生成 NaOH 使酚酞变红）。钠块 ' + fx(m, 2) + ' g 时理论放出 H₂ 约 ' + fx(vH2, 0) +
          ' mL（标准状况），放热使 100 mL 水升温约 ' + fx(dT, 1) + ' ℃（' + fx(T, 0) + ' ℃ 起）。' +
          '钠块越大、水温越高，反应越剧烈；' + (m >= 0.4 ? '本次钠块偏大，已经出现燃烧现象，' : '') +
          '这正是钠要保存在煤油里、活泼金属着火不能用水扑救的原因。' +
          (drops > 0 ? '' : '本次没滴酚酞，所以看不到"红"这一步 —— 现象要靠指示剂才能显出来。'),
        equation: '2Na + 2H2O = 2NaOH + H2↑',
        ionic: '2Na + 2H2O = 2Na+ + 2OH- + H2↑',
        errors: ['钠块表面的煤油没有用滤纸吸干：煤油浮在水面上会干扰"浮、游"的观察，还可能局部燃烧',
          '钠块取大了（超过绿豆大）：放热集中会燃烧甚至爆鸣，教材明确提醒不要近距离俯视烧杯',
          '没加酚酞就下结论"溶液显碱性"：碱性必须用酚酞变红或 pH 试纸检验，不能凭想象',
          '用手直接拿钠或把剩余钠丢进水槽：钠会灼伤皮肤，剩余的钠必须放回煤油中']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var m = clamp(pn(p, 'naMass', 0.2), 0.02, 5);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var drops = clamp(pn(p, 'drops', 2), 0, 10);
      var done = !!(state && state.rows && state.rows.length);
      var ph = (state && state.phase) || 0;
      var bx = s.X(300), by = s.Y(150), bw = s.Z(190), bh = s.Z(240);
      var lvl = by + s.Z(58), floor = by + bh;
      txt(g, '钠与水反应', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, '2Na + 2H2O = 2NaOH + H2↑', s.X(40), s.Y(70), Math.round(s.Z(14)), 'rgba(38,34,28,.7)');
      txt(g, '水温 ' + fx(T, 0) + ' ℃ · 钠块 ' + fx(m, 2) + ' g · 酚酞 ' + fx(drops, 0) + ' 滴',
        s.X(40), s.Y(92), Math.round(s.Z(13)), 'rgba(38,34,28,.6)');
      /* 桌面 */
      seg(g, s.X(60), floor, s.X(700), floor, 'rgba(38,34,28,.45)', 2);
      /* 烧杯与液体：滴了酚酞且已反应 → 变红 */
      beaker(g, bx, by, bw, bh);
      var red = (drops > 0 && done);
      liq(g, bx + 2, lvl, bw - 4, floor - lvl - 2,
        red ? 'rgba(214,74,96,.5)' : 'rgba(150,190,215,.42)');
      if (!done) {
        /* 反应前：钠块放在滤纸上（银白，表面有煤油光泽） */
        box(g, s.X(120), s.Y(300), s.Z(70), s.Z(46), 'rgba(150,150,150,.9)', true);
        box(g, s.X(120), s.Y(300), s.Z(70), s.Z(46), L, false, 1.4);
        txt(g, '钠块（滤纸吸干煤油）', s.X(120), s.Y(370), Math.round(s.Z(12)), 'rgba(38,34,28,.7)');
        txt(g, '把钠投入水中 →', s.X(210), s.Y(316), Math.round(s.Z(13)), 'rgba(38,34,28,.75)');
        arrow(g, s.X(210), s.Y(326), s.X(292), s.Y(326), 'rgba(38,34,28,.6)', 1.4);
      } else {
        /* 反应中：水面上闪亮小球 + 气泡 + 游动轨迹 */
        var r = s.Z(10 + 16 * clamp(m / 0.6, 0.15, 1));
        var cx = bx + bw * 0.5, cyy = lvl + r * 0.35;
        bubblesUp(g, 7 + m * 100, bx + s.Z(18), bx + bw - s.Z(18), lvl + s.Z(4), floor - s.Z(6),
          Math.round(10 + 30 * clamp(m / 0.6, 0.1, 1)), ph, 'rgba(38,34,28,.5)', s.Z(3.2), s.Z(1));
        seg(g, bx + s.Z(18), cyy + r * 0.2, cx - r * 2.4, cyy - r * 0.1, 'rgba(38,34,28,.3)', 1, [3, 3]);
        circ(g, cx, cyy, r, 'rgba(228,228,232,.98)', true);
        circ(g, cx, cyy, r, 'rgba(90,90,96,.9)', false, 1.4);
        circ(g, cx - r * 0.3, cyy - r * 0.35, r * 0.32, 'rgba(255,255,255,.95)', true);
        if (m >= 0.4) {
          flame(g, cx, cyy - r - s.Z(2), s.Z(34), s.Z(18), 'rgba(246,196,66,.85)', 'rgba(255,248,214,.9)');
          star(g, cx, cyy - r - s.Z(20), s.Z(9), s.Z(26), 10, 'rgba(255,236,150,.85)', ph);
        }
        /* 嘶嘶声 */
        curve(g, cx + r + s.Z(6), cyy - s.Z(8), cx + r + s.Z(22), cyy - s.Z(16), cx + r + s.Z(30), cyy - s.Z(2),
          'rgba(38,34,28,.45)', 1.2);
        curve(g, cx + r + s.Z(6), cyy - s.Z(2), cx + r + s.Z(20), cyy - s.Z(4), cx + r + s.Z(28), cyy + s.Z(8),
          'rgba(38,34,28,.35)', 1.2);
        txt(g, '嘶嘶', cx + r + s.Z(34), cyy - s.Z(4), Math.round(s.Z(12)), 'rgba(38,34,28,.6)');
      }
      /* 现象→原因 对照 */
      var lx = s.X(520), ly = s.Y(150);
      txt(g, '现象 → 原因', lx, ly, Math.round(s.Z(15)), L, 'left', true, true);
      seg(g, lx, ly + s.Z(8), s.X(720), ly + s.Z(8), 'rgba(38,34,28,.35)', 1);
      txt(g, '浮：密度比水小', lx, ly + s.Z(30), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '熔：熔点 97.8 ℃ + 放热', lx, ly + s.Z(50), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '游 / 响：H₂ 推动小球', lx, ly + s.Z(70), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, (drops > 0 ? '红：生成 NaOH（碱性）' : '（未滴酚酞，看不到红）'),
        lx, ly + s.Z(90), Math.round(s.Z(12.5)), drops > 0 ? 'rgba(178,46,66,.9)' : 'rgba(38,34,28,.55)');
      txt(g, '结论：钠要保存在煤油中', lx, ly + s.Z(122), Math.round(s.Z(13)), L, 'left', true, true);
      txt(g, '活泼金属着火用干燥沙土，不能用水', lx, ly + s.Z(142), Math.round(s.Z(12)), 'rgba(38,34,28,.7)');
    }
  });

  /* ==========================================================================
   * 2 · na-oxygen   钠与氧气（常温 / 加热，产物不同）
   * ======================================================================== */
  window.QG_CLAB.register('na-oxygen', {
    id: 'na-oxygen',
    name: '钠与氧气（常温 / 加热）',
    group: GROUP,
    aim: '对比钠在常温与加热条件下跟氧气反应的产物与颜色，写出两个方程式，理解"条件决定产物"',
    principle: '常温下：4Na + O2 = 2Na2O，钠表面生成一层白色的氧化钠（新切开的银白色断面很快变暗）；' +
      '加热（或点燃）时：2Na + O2 = Na2O2，钠先熔化再与氧气剧烈反应，发出黄色火焰，生成淡黄色的过氧化钠。' +
      '两个反应都是化合反应、都是氧化还原反应：常温下每个 Na 失去 1 个电子给氧（O 为 −2 价），' +
      '加热时生成的 Na2O2 里氧为 −1 价（既有氧化又有还原的歧化，钠仍为 +1 价）。' +
      '所以钠必须保存在煤油或石蜡油里隔绝空气（也隔绝水蒸气）。',
    apparatus: ['坩埚（或蒸发皿）', '泥三角', '酒精灯', '镊子', '滤纸', '小刀', '钠块', '玻璃片'],
    steps: ['用镊子取一小块钠，滤纸吸干煤油，用小刀切去外皮，观察新切面的银白色光泽与变暗过程',
      '常温对比：把切好的钠放在玻璃片上，每隔一段时间观察表面颜色的变化',
      '加热实验：把一块绿豆大的钠迅速投入已加热的干燥坩埚中，继续加热片刻',
      '观察钠是否熔化、火焰颜色与最终固体的颜色（注意：不要近距离俯视坩埚）'],
    params: [
      { key: 'mode', label: '反应条件', type: 'select', value: 'room', options: [
        { value: 'room', label: '常温（放在干燥空气中）' },
        { value: 'heat', label: '加热（坩埚中加热/点燃）' }
      ] },
      { key: 'naMass', label: '钠的质量', unit: 'g', min: 0.1, max: 2, step: 0.05, value: 0.5 },
      { key: 'time', label: '观察/加热时间', unit: 's', min: 10, max: 300, step: 10, value: 60 }
    ],
    react: function (p) {
      var heat = isSel(p, 'mode', 'heat');
      var m = clamp(pn(p, 'naMass', 0.5), 0.02, 10);
      var t = clamp(pn(p, 'time', 60), 1, 3600);
      var nNa = m / M_NA;
      var ph = [];
      if (!heat) {
        var conv = clamp(0.35 * Math.sqrt(t / 300), 0.01, 0.35);   /* 常温只有表层被氧化 */
        var mNa2O = nNa * conv / 2 * M_NA2O;
        ph.push('新切开的钠断面呈银白色金属光泽，很快变暗');
        ph.push('表面生成一薄层白色的氧化钠 Na₂O（不是燃烧，看不到火焰）');
        if (t <= 30) {
          ph.push('放置 ' + fx(t, 0) + ' s：只有表面刚刚发暗，氧化层还很薄（约 ' + fx(conv * 100, 1) + '% 的钠被氧化）');
        } else {
          ph.push('放置 ' + fx(t, 0) + ' s：断面明显发暗、发白，氧化层增厚（约 ' + fx(conv * 100, 1) +
            '% 的钠被氧化，生成 Na₂O 约 ' + fx(mNa2O, 3) + ' g）');
        }
        ph.push('长时间放在空气中，表面还会继续吸收水蒸气和 CO₂，最终变成 NaOH、Na₂CO₃（所以钠要密封保存）');
      } else {
        var convH = clamp(0.25 + 0.75 * (t / 180), 0.05, 1);
        var mNa2O2 = nNa * convH / 2 * M_NA2O2;
        ph.push('钠受热后先熔化（熔点 97.8 ℃），熔成一颗银白色的小球');
        if (t < 40) {
          ph.push('加热 ' + fx(t, 0) + ' s：钠刚熔化，与氧气剧烈反应但尚未完全燃烧（转化约 ' + fx(convH * 100, 0) + '%）');
        } else {
          ph.push('钠与氧气剧烈反应，发出黄色火焰');
          ph.push('生成淡黄色固体过氧化钠 Na₂O₂（约 ' + fx(mNa2O2, 3) + ' g，转化率约 ' + fx(convH * 100, 0) + '%）');
        }
        ph.push('坩埚内壁附着淡黄色固体，冷却后仍是淡黄色（注意：不要近距离俯视坩埚，强光与飞溅会伤眼）');
      }
      return {
        phenomena: ph,
        equation: heat ? '2Na + O2 = Na2O2' : '4Na + O2 = 2Na2O',
        ionic: '',
        type: '化合反应（氧化还原反应，钠被氧气氧化）',
        conditions: heat ? '加热（干燥坩埚中加热，钠熔化后与氧气剧烈反应）'
          : '常温（干燥空气中放置，只有表面被氧化）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var heat = isSel(p, 'mode', 'heat');
      var m = clamp(pn(p, 'naMass', 0.5), 0.02, 10);
      var t = clamp(pn(p, 'time', 60), 1, 3600);
      var n = rows && rows.length ? rows.length : 0;
      var nNa = m / M_NA;
      return {
        text: '做了 ' + n + ' 次观察（' + (heat ? '加热' : '常温') + '条件，钠 ' + fx(m, 2) + ' g，时间 ' + fx(t, 0) +
          ' s）：' + (heat
            ? '加热时钠先熔化，再与氧气剧烈反应，发出黄色火焰，生成淡黄色的 Na₂O₂ —— ' +
              '2Na + O2 = Na2O2。理论最多生成 Na₂O₂ 约 ' + fx(nNa / 2 * M_NA2O2, 3) + ' g。'
            : '常温下钠只是表面被氧气氧化，断面变暗、生成一层白色的 Na₂O —— 4Na + O2 = 2Na2O，' +
              '看不到火焰。') +
          '同一个反应物（Na 与 O₂）在不同条件下得到不同产物，这正是"条件决定产物"的典型例子；' +
          '而 Na₂O₂ 中氧为 −1 价，所以它既是氧化剂又是还原剂，能与水、CO₂ 反应放出 O₂，可作供氧剂。',
        equation: heat ? '2Na + O2 = Na2O2' : '4Na + O2 = 2Na2O',
        ionic: '',
        errors: ['常温实验里把"表面变暗"当成"钠燃烧了"：常温只生成 Na₂O，没有火焰',
          '加热时距离坩埚太近俯视：强光会伤眼，熔融的钠还会飞溅（教材提醒不要近距离俯视坩埚）',
          '产物颜色判断失误：Na₂O 白色与 Na₂O₂ 淡黄色在灯光下不易分辨，应在自然光下对比观察',
          '钠表面的煤油没吸干：煤油燃烧的火焰会干扰对钠燃烧现象的判断']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var heat = isSel(p, 'mode', 'heat');
      var m = clamp(pn(p, 'naMass', 0.5), 0.02, 10);
      var t = clamp(pn(p, 'time', 60), 1, 3600);
      var ph = (state && state.phase) || 0;
      txt(g, heat ? '钠在加热条件下与氧气反应' : '钠在常温下被氧气氧化', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, heat ? '2Na + O2 = Na2O2（淡黄色固体）' : '4Na + O2 = 2Na2O（白色固体）',
        s.X(40), s.Y(70), Math.round(s.Z(14)), 'rgba(38,34,28,.7)');
      txt(g, '钠 ' + fx(m, 2) + ' g · 时间 ' + fx(t, 0) + ' s', s.X(40), s.Y(92), Math.round(s.Z(13)), 'rgba(38,34,28,.6)');
      var conv = heat ? clamp(0.25 + 0.75 * (t / 180), 0.05, 1) : clamp(0.35 * Math.sqrt(t / 300), 0.01, 0.35);
      if (!heat) {
        /* 玻璃片 + 钠块：表面氧化层随时间变白 */
        var gx = s.X(230), gy = s.Y(230), gw = s.Z(260), gh = s.Z(16);
        box(g, gx, gy, gw, gh, 'rgba(38,34,28,.35)', true);
        var nx = s.X(330), ny = s.Y(180), nw = s.Z(70), nh = s.Z(48);
        box(g, nx, ny, nw, nh, 'rgba(226,226,230,.98)', true);
        box(g, nx, ny, nw, nh, L, false, 1.4);
        /* 变暗层 */
        box(g, nx, ny, nw, nh * clamp(conv * 2.4, 0.05, 1), 'rgba(246,246,242,.95)', true);
        txt(g, '新切面：银白色', s.X(560), s.Y(160), Math.round(s.Z(13)), 'rgba(38,34,28,.8)');
        arrow(g, s.X(556), s.Y(168), s.X(420), s.Y(180), 'rgba(38,34,28,.5)', 1.2);
        txt(g, '表面变暗 → 白色 Na₂O 薄层', s.X(560), s.Y(186), Math.round(s.Z(13)), 'rgba(38,34,28,.8)');
        arrow(g, s.X(556), s.Y(194), s.X(404), s.Y(204), 'rgba(38,34,28,.5)', 1.2);
        txt(g, '被氧化的钠约 ' + fx(conv * 100, 1) + '%（常温只能氧化表层）', s.X(560), s.Y(224),
          Math.round(s.Z(12.5)), 'rgba(38,34,28,.65)');
        txt(g, '结论：4Na + O2 = 2Na2O，看不到火焰', s.X(560), s.Y(252), Math.round(s.Z(13)), L, 'left', true, true);
      } else {
        /* 坩埚 + 酒精灯 + 黄色火焰 + 淡黄色固体 */
        var cx = s.X(340), cy = s.Y(300);
        poly(g, [[cx - s.Z(78), cy], [cx + s.Z(78), cy], [cx + s.Z(58), cy + s.Z(54)], [cx - s.Z(58), cy + s.Z(54)]],
          L, false, 1.6);
        box(g, cx - s.Z(90), cy - s.Z(8), s.Z(180), s.Z(8), 'rgba(38,34,28,.5)', true);
        /* 酒精灯 */
        var lx = cx, ly = s.Y(430);
        poly(g, [[lx - s.Z(34), ly], [lx + s.Z(34), ly], [lx + s.Z(24), ly - s.Z(40)], [lx - s.Z(24), ly - s.Z(40)]],
          'rgba(38,34,28,.6)', false, 1.6);
        seg(g, lx - s.Z(8), ly - s.Z(40), lx + s.Z(8), ly - s.Z(40), L, 1.6);
        flame(g, lx, ly - s.Z(42), s.Z(46) + s.Z(6) * Math.sin(ph * Math.PI * 2), s.Z(26),
          'rgba(240,170,60,.8)', 'rgba(255,236,180,.9)');
        /* 钠球与淡黄固体 */
        var r = s.Z(14 + 18 * clamp(m / 2, 0.1, 1));
        circ(g, cx, cy - r * 0.4, r, 'rgba(240,222,120,.95)', true);
        circ(g, cx, cy - r * 0.4, r, 'rgba(120,104,30,.8)', false, 1.4);
        /* 黄色火焰 + 白光 */
        flame(g, cx, cy - r - s.Z(4), s.Z(52), s.Z(30), 'rgba(246,196,66,.9)', 'rgba(255,248,214,.95)');
        flame(g, cx - s.Z(30), cy - r - s.Z(2), s.Z(30), s.Z(18), 'rgba(246,196,66,.7)', 'rgba(255,248,214,.8)');
        flame(g, cx + s.Z(30), cy - r - s.Z(2), s.Z(30), s.Z(18), 'rgba(246,196,66,.7)', 'rgba(255,248,214,.8)');
        star(g, cx, cy - r - s.Z(26), s.Z(11), s.Z(34), 12, 'rgba(255,240,170,.8)', ph);
        sparks(g, 11, cx, cy - r - s.Z(10), s.Z(60), 10, ph, 'rgba(255,196,90,.9)', s.Z(9));
        txt(g, '黄色火焰', s.X(470), s.Y(190), Math.round(s.Z(13)), 'rgba(150,110,20,.95)');
        txt(g, '淡黄色固体 Na₂O₂（转化约 ' + fx(conv * 100, 0) + '%）', s.X(470), s.Y(214),
          Math.round(s.Z(13)), 'rgba(38,34,28,.8)');
        txt(g, '钠先熔化（熔点 97.8 ℃）再与 O₂ 剧烈反应', s.X(470), s.Y(238), Math.round(s.Z(12.5)), 'rgba(38,34,28,.65)');
        txt(g, '注意：不要近距离俯视坩埚', s.X(470), s.Y(268), Math.round(s.Z(12.5)), 'rgba(170,50,40,.85)');
      }
    }
  });

  /* ==========================================================================
   * 3 · fe-cuso4   铁与硫酸铜溶液（置换）
   * ======================================================================== */
  window.QG_CLAB.register('fe-cuso4', {
    id: 'fe-cuso4',
    name: '铁与硫酸铜溶液（置换反应）',
    group: GROUP,
    aim: '观察铁从铜盐溶液中置换出铜的现象，写出化学方程式与离子方程式，并说明浓度、温度、接触面积对反应快慢的影响',
    principle: 'Fe + CuSO4 = FeSO4 + Cu（置换反应，离子方程式 Fe + Cu2+ = Cu + Fe2+）。' +
      '铁的金属活动性比铜强，把铁浸入蓝色的 CuSO₄ 溶液中，铁表面会析出一层红色的铜，' +
      '溶液中的 Cu²⁺ 逐渐被 Fe²⁺ 取代，蓝色变浅、最后呈 FeSO₄ 的浅绿色；' +
      '每溶解 1 mol Fe 就析出 1 mol Cu（M 从 55.85 增到 63.55），铁的质量会变大。' +
      '这正是"曾青得铁则化为铜"（湿法炼铜）的原理。增大 CuSO₄ 浓度、升高温度、' +
      '把铁钉换成铁粉（增大接触面积）都会加快反应。',
    apparatus: ['试管', '铁钉（或细铁丝、铁粉）', '砂纸', 'CuSO₄ 溶液', '胶头滴管', '镊子', '水浴（可选）'],
    steps: ['用砂纸打磨铁钉，除去表面的铁锈和油污，用水洗净',
      '向试管中加入约 1/3 体积的 CuSO₄ 溶液', '把铁钉浸入溶液（铁钉要完全浸没）',
      '观察铁钉表面与溶液颜色的变化，定时取出观察（对比不同浓度/温度/铁的形状）'],
    params: [
      { key: 'conc', label: 'CuSO₄ 溶液浓度', unit: 'mol/L', min: 0.1, max: 1, step: 0.1, value: 0.5 },
      { key: 'temp', label: '溶液温度', unit: '℃', min: 10, max: 60, step: 5, value: 25 },
      { key: 'form', label: '铁的形状', type: 'select', value: 'nail', options: [
        { value: 'nail', label: '铁钉（整块）' },
        { value: 'wire', label: '细铁丝' },
        { value: 'powder', label: '铁粉' }
      ] },
      { key: 'time', label: '浸泡时间', unit: 'min', min: 1, max: 30, step: 1, value: 5 }
    ],
    react: function (p) {
      var c = clamp(pn(p, 'conc', 0.5), 0.01, 5);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var form = ps(p, 'form', 'nail');
      var t = clamp(pn(p, 'time', 5), 0.2, 600);
      var area = form === 'powder' ? 12 : (form === 'wire' ? 3.4 : 1);
      var rate = c * Math.pow(1.9, (T - 25) / 10) * area;   /* 相对速率（浓度/温度/接触面积） */
      var extent = clamp(rate * t / 26, 0.001, 1);          /* 反应程度 0~1 */
      var nCu = extent * c * 0.02;                          /* 假定 20 mL 溶液里可反应的最大铜量比例 */
      var ph = [];
      ph.push('铁表面覆盖一层红色的铜（紫红色的铜层，用镊子取出可以看到）');
      if (extent < 0.12) {
        ph.push('溶液仍是蓝色，只有铁表面出现少量红色斑点（反应刚开始）');
      } else if (extent < 0.45) {
        ph.push('溶液的蓝色明显变浅，铁表面红色铜层变厚');
      } else {
        ph.push('溶液由蓝色变成浅绿色（FeSO₄ 溶液的颜色），铁表面覆盖厚厚一层红色的铜');
      }
      ph.push('铁钉/铁丝变细、表面变粗糙，反应后铁的质量变大（每 1 mol Fe 置换 1 mol Cu，55.85 → 63.55 g）');
      ph.push('随着 Cu²⁺ 被消耗、Fe²⁺ 不断生成，溶液的颜色从蓝色向浅绿色（FeSO₄ 的颜色）过渡');
      if (form === 'powder') ph.push('用铁粉时接触面积大，反应一开始就很快（同样的时间里现象最明显）');
      if (form === 'nail') ph.push('用整块铁钉时接触面积小，现象出现得最慢，适合做"观察表面覆盖铜"的演示');
      if (T >= 45) ph.push('溶液温度较高（' + fx(T, 0) + ' ℃），蓝色变浅的速度明显加快');
      if (c >= 0.8) ph.push('CuSO₄ 浓度高（' + fx(c, 1) + ' mol/L），析出的铜更多、颜色变化更快');
      ph.push('浸泡 ' + fx(t, 0) + ' min 后估计反应程度约 ' + fx(extent * 100, 0) + '%（按浓度、温度、接触面积估算）');
      return {
        phenomena: ph,
        equation: 'Fe + CuSO4 = FeSO4 + Cu',
        ionic: 'Fe + Cu2+ = Fe2+ + Cu',
        type: '置换反应（金属与盐溶液，属于氧化还原反应）',
        conditions: '常温溶液浸泡（' + fx(T, 0) + ' ℃，CuSO₄ ' + fx(c, 1) + ' mol/L，' +
          (form === 'powder' ? '铁粉' : (form === 'wire' ? '细铁丝' : '铁钉')) + '）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var c = clamp(pn(p, 'conc', 0.5), 0.01, 5);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var form = ps(p, 'form', 'nail');
      var t = clamp(pn(p, 'time', 5), 0.2, 600);
      var area = form === 'powder' ? 12 : (form === 'wire' ? 3.4 : 1);
      var extent = clamp(c * Math.pow(1.9, (T - 25) / 10) * area * t / 26, 0.001, 1);
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：铁把铜从它的盐溶液里置换出来 —— Fe + CuSO4 = FeSO4 + Cu' +
          '（离子方程式 Fe + Cu2+ = Fe2+ + Cu）。现象是"铁表面析出红色的铜、蓝色溶液变浅最后呈浅绿色、' +
          '铁变细而质量变大"。本次条件（CuSO₄ ' + fx(c, 1) + ' mol/L、' + fx(T, 0) + ' ℃、' +
          (form === 'powder' ? '铁粉' : (form === 'wire' ? '细铁丝' : '铁钉')) + '、' + fx(t, 0) +
          ' min）下反应程度约 ' + fx(extent * 100, 0) + '%。把浓度加大、温度升高或把铁钉换成铁粉，' +
          '都能让反应更快更明显 —— 这与"浓度、温度、接触面积影响反应速率"一致。' +
          '工业上湿法炼铜（"曾青得铁则化为铜"）用的就是这个反应。',
        equation: 'Fe + CuSO4 = FeSO4 + Cu',
        ionic: 'Fe + Cu2+ = Fe2+ + Cu',
        errors: ['铁钉表面的铁锈或油污没有打磨干净：铜附着不牢，红色铜层容易被误判为"没有反应"',
          'CuSO₄ 溶液太稀（如 0.1 mol/L）：蓝色变化很慢，现象不明显',
          '把溶液变浅绿误判为"生成了 Fe³⁺"：Fe²⁺ 本身是浅绿色，Fe³⁺ 是棕黄色',
          '铁钉没有完全浸没或浸泡时间太长：前者看不到完整现象，后者铜层脱落使溶液变浑浊']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var c = clamp(pn(p, 'conc', 0.5), 0.01, 5);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var form = ps(p, 'form', 'nail');
      var t = clamp(pn(p, 'time', 5), 0.2, 600);
      var area = form === 'powder' ? 12 : (form === 'wire' ? 3.4 : 1);
      var extent = clamp(c * Math.pow(1.9, (T - 25) / 10) * area * t / 26, 0.001, 1);
      var ph = (state && state.phase) || 0;
      txt(g, '铁与硫酸铜溶液', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, 'Fe + CuSO4 = FeSO4 + Cu （Fe + Cu2+ = Fe2+ + Cu）', s.X(40), s.Y(70), Math.round(s.Z(14)), 'rgba(38,34,28,.7)');
      txt(g, 'CuSO₄ ' + fx(c, 1) + ' mol/L · ' + fx(T, 0) + ' ℃ · ' +
        (form === 'powder' ? '铁粉' : (form === 'wire' ? '细铁丝' : '铁钉')) + ' · ' + fx(t, 0) + ' min',
        s.X(40), s.Y(92), Math.round(s.Z(13)), 'rgba(38,34,28,.6)');
      /* 试管 + 蓝色溶液（随 extent 由蓝变浅绿） */
      var cx = s.X(280), top = s.Y(140), tw = s.Z(120), th = s.Z(280);
      tube(g, cx, top, tw, th);
      var bot = top + th - tw / 2;
      var lt = top + s.Z(58);
      var blue = Math.round(40 + 120 * (1 - extent)), green = Math.round(120 + 90 * extent);
      liq(g, cx - tw / 2 + s.Z(2), lt, tw - s.Z(4), bot - lt - s.Z(1),
        'rgba(60,' + green + ',' + Math.round(150 + 60 * (1 - extent)) + ',.5)');
      /* 铁钉/铁丝/铁粉 */
      if (form === 'powder') {
        var r = rnd(21), i, px, py;
        for (i = 0; i < 60; i++) {
          px = cx - tw / 2 + s.Z(10) + r() * (tw - s.Z(20));
          py = bot - s.Z(6) - r() * s.Z(52);
          circ(g, px, py, s.Z(1.8), 'rgba(70,70,74,.85)', true);
        }
      } else {
        var nw = form === 'wire' ? s.Z(7) : s.Z(20);
        box(g, cx - nw / 2, top + s.Z(70), nw, th - s.Z(120), 'rgba(96,96,100,.95)', true);
        box(g, cx - nw / 2, top + s.Z(70), nw, th - s.Z(120), 'rgba(38,34,28,.8)', false, 1.2);
        /* 表面红色铜层：随 extent 变厚 */
        var coat = clamp(extent * 1.6, 0.06, 1);
        box(g, cx - nw / 2 - s.Z(3), top + s.Z(70), s.Z(3), (th - s.Z(120)) * coat, 'rgba(178,74,52,.95)', true);
        box(g, cx + nw / 2, top + s.Z(70), s.Z(3), (th - s.Z(120)) * coat, 'rgba(178,74,52,.95)', true);
      }
      /* 颜色对照条 */
      var bx = s.X(430), by = s.Y(150);
      txt(g, '溶液颜色变化', bx, by, Math.round(s.Z(14)), L, 'left', true, true);
      box(g, bx, by + s.Z(12), s.Z(70), s.Z(22), 'rgba(52,110,214,.85)', true);
      txt(g, '蓝色（Cu²⁺）', bx + s.Z(78), by + s.Z(28), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      arrow(g, bx + s.Z(30), by + s.Z(42), bx + s.Z(150), by + s.Z(42), 'rgba(38,34,28,.55)', 1.4);
      box(g, bx + s.Z(160), by + s.Z(12), s.Z(70), s.Z(22), 'rgba(120,190,150,.85)', true);
      txt(g, '浅绿色（Fe²⁺）', bx + s.Z(238), by + s.Z(28), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      /* 铜层 */
      box(g, bx + s.Z(160), by + s.Z(58), s.Z(70), s.Z(22), 'rgba(178,74,52,.95)', true);
      txt(g, '铁表面析出红色的铜', bx + s.Z(238), by + s.Z(74), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '反应程度约 ' + fx(extent * 100, 0) + '%', bx, by + s.Z(112), Math.round(s.Z(13)), 'rgba(38,34,28,.75)');
      txt(g, '质量：每 1 mol Fe → 1 mol Cu', bx, by + s.Z(134), Math.round(s.Z(12.5)), 'rgba(38,34,28,.65)');
      txt(g, '（55.85 g → 63.55 g，铁变重）', bx, by + s.Z(154), Math.round(s.Z(12.5)), 'rgba(38,34,28,.65)');
      txt(g, '温度/浓度/接触面积 ↑ → 反应更快', bx, by + s.Z(184), Math.round(s.Z(13)), L, 'left', true, true);
      if (extent > 0.05) bubblesUp(g, 33 + extent * 100, cx - tw / 2 + s.Z(8), cx + tw / 2 - s.Z(8),
        lt, bot - s.Z(6), 0, ph, 'rgba(38,34,28,.4)', s.Z(2), s.Z(1));
    }
  });

  /* ==========================================================================
   * 4 · al-naoh   铝与氢氧化钠溶液
   * ======================================================================== */
  window.QG_CLAB.register('al-naoh', {
    id: 'al-naoh',
    name: '铝与氢氧化钠溶液的反应',
    group: GROUP,
    aim: '观察铝与 NaOH 溶液反应放出氢气的现象（并对比打磨/未打磨铝片），写出化学方程式与离子方程式，理解铝的两性',
    principle: '2Al + 2NaOH + 6H2O = 2Na[Al(OH)4] + 3H2↑（人教版 2019 必修一 P82 原文，产物是四羟基合铝酸钠；' +
      '按旧教材的写法可简写作 2Al + 2NaOH + 2H2O = 2NaAlO2 + 3H2↑，两式实质相同）。' +
      '铝是两性金属：既能与盐酸反应，也能与强碱溶液反应。反应分两步：' +
      'Al2O3 + 2NaOH + 3H2O = 2Na[Al(OH)4] 先溶解表面的氧化膜，然后 2Al + 2NaOH + 6H2O = 2Na[Al(OH)4] + 3H2↑。' +
      '所以未打磨的铝片开始没有气泡，一段时间后才冒气泡；打磨过的铝片立即产生气泡。放出的气体是 H₂（可燃）。',
    apparatus: ['试管', '砂纸', '铝片（两块）', 'NaOH 溶液', '镊子', '木条', '火柴', '水浴（可选）'],
    steps: ['取两支试管各加入少量 NaOH 溶液', '一支放入一小块铝片，另一支放入用砂纸打磨过的铝片',
      '观察两支试管中产生气泡的先后与快慢', '过一会儿把点燃的木条放在试管口，检验放出的气体'],
    params: [
      { key: 'conc', label: 'NaOH 溶液浓度', unit: 'mol/L', min: 0.5, max: 6, step: 0.5, value: 2 },
      { key: 'temp', label: '溶液温度', unit: '℃', min: 20, max: 80, step: 5, value: 25 },
      { key: 'surface', label: '铝片表面', type: 'select', value: 'oxide', options: [
        { value: 'polished', label: '已打磨（除去氧化膜）' },
        { value: 'oxide', label: '未打磨（表面有 Al₂O₃ 氧化膜）' }
      ] },
      { key: 'time', label: '观察时间', unit: 's', min: 10, max: 300, step: 10, value: 60 }
    ],
    react: function (p) {
      var c = clamp(pn(p, 'conc', 2), 0.05, 20);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var polished = isSel(p, 'surface', 'polished');
      var t = clamp(pn(p, 'time', 60), 1, 3600);
      var rate = c * Math.pow(1.8, (T - 25) / 10);
      var delay = polished ? 0 : clamp(18 / Math.max(0.15, rate), 1, 120);  /* 溶解氧化膜所需时间（s） */
      var eff = clamp((t - delay) / 60 * rate / 2, 0, 1);
      var ph = [];
      if (polished) {
        ph.push('打磨过的铝片放入 NaOH 溶液后立即产生气泡（表面的 Al₂O₃ 已被砂纸除去）');
      } else {
        ph.push('未打磨的铝片放入 NaOH 溶液后开始没有气泡：NaOH 先溶解表面的 Al₂O₃ 氧化膜' +
          '（Al2O3 + 2NaOH + 3H2O = 2Na[Al(OH)4]），约 ' + fx(delay, 0) + ' s 后才开始冒气泡');
      }
      if (eff > 0.02) {
        ph.push('铝片表面持续产生无色气泡，气泡不断上升逸出（放出的气体是 H₂）');
        if (eff > 0.35) ph.push('气泡产生很快，铝片逐渐变薄、变小，试管壁明显发热（反应放热）');
        if (eff > 0.7) ph.push('反应很剧烈，气体带着泡沫上涌，用燃着的木条靠近试管口有爆鸣声（检验 H₂）');
      } else {
        ph.push('观察时间内只有少量气泡，现象还不明显（可以调高浓度或水浴加热）');
      }
      if (T >= 50) ph.push('水浴加热到 ' + fx(T, 0) + ' ℃，气泡产生明显加快（温度升高加快反应速率）');
      if (c >= 4) ph.push('NaOH 浓度高（' + fx(c, 1) + ' mol/L），反应一开始就很剧烈，注意碱液溅出');
      ph.push('观察 ' + fx(t, 0) + ' s 后估计反应程度约 ' + fx(eff * 100, 0) +
        '%（按浓度、温度与时间估算）');
      ph.push('铝既能与盐酸反应又能与 NaOH 溶液反应，说明铝是两性金属（"铝制餐具不宜用来蒸煮或长时间存放酸性或碱性食物"）');
      return {
        phenomena: ph,
        equation: '2Al + 2NaOH + 6H2O = 2Na[Al(OH)4] + 3H2↑',
        ionic: '2Al + 2OH- + 6H2O = 2[Al(OH)4]- + 3H2↑',
        type: '氧化还原反应（金属与强碱溶液反应，铝表现两性）',
        conditions: '常温常压，NaOH 溶液 ' + fx(c, 1) + ' mol/L、' + fx(T, 0) + ' ℃，' +
          (polished ? '铝片已打磨' : '铝片未打磨（带氧化膜）'),
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var c = clamp(pn(p, 'conc', 2), 0.05, 20);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var polished = isSel(p, 'surface', 'polished');
      var t = clamp(pn(p, 'time', 60), 1, 3600);
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：铝与 NaOH 溶液反应放出氢气 —— ' +
          '2Al + 2NaOH + 6H2O = 2Na[Al(OH)4] + 3H2↑（离子方程式 2Al + 2OH- + 6H2O = 2[Al(OH)4]- + 3H2↑）。' +
          '本次用的是' + (polished ? '打磨过的铝片，一放进溶液就冒气泡' :
            '未打磨的铝片，开始要先溶解表面的 Al₂O₃ 氧化膜，约 ' + fx(clamp(18 / Math.max(0.15, c * Math.pow(1.8, (T - 25) / 10)), 1, 120), 0) +
            ' s 后才冒气泡') + '；观察 ' + fx(t, 0) + ' s、NaOH ' + fx(c, 1) + ' mol/L、' + fx(T, 0) +
          ' ℃ 的条件下，反应程度约 ' + fx(clamp((t - (polished ? 0 : clamp(18 / Math.max(0.15, c * Math.pow(1.8, (T - 25) / 10)), 1, 120))) / 60 * c * Math.pow(1.8, (T - 25) / 10) / 2, 0, 1) * 100, 0) + '%。' +
          '注意：这不是铝置换出钠（钠比铝活泼），而是铝被强碱溶液氧化、水中的氢被还原成 H₂，' +
          '铝因此表现出"既溶于酸又溶于强碱"的两性。',
        equation: '2Al + 2NaOH + 6H2O = 2Na[Al(OH)4] + 3H2↑',
        ionic: '2Al + 2OH- + 6H2O = 2[Al(OH)4]- + 3H2↑',
        errors: ['铝片没有打磨：开始一段时间不冒气泡，容易被误判为"铝与 NaOH 不反应"',
          'NaOH 溶液浓度过大或没有防护：反应剧烈、碱液飞溅会腐蚀皮肤和衣服，必须戴护目镜',
          '把反应写成"铝置换钠"（如 2Al + 6NaOH = 2Al(OH)3 + 6Na）：钠比铝活泼，铝不能把钠置换出来',
          '检验氢气时木条离试管口太近或试管口对着人：爆鸣会伤人，应把木条放在管口侧面']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var c = clamp(pn(p, 'conc', 2), 0.05, 20);
      var T = clamp(pn(p, 'temp', 25), 0, 100);
      var polished = isSel(p, 'surface', 'polished');
      var t = clamp(pn(p, 'time', 60), 1, 3600);
      var rate = c * Math.pow(1.8, (T - 25) / 10);
      var delay = polished ? 0 : clamp(18 / Math.max(0.15, rate), 1, 120);
      var eff = clamp((t - delay) / 60 * rate / 2, 0, 1);
      var ph = (state && state.phase) || 0;
      txt(g, '铝与氢氧化钠溶液的反应', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, '2Al + 2NaOH + 6H2O = 2Na[Al(OH)4] + 3H2↑', s.X(40), s.Y(70), Math.round(s.Z(13.5)), 'rgba(38,34,28,.7)');
      txt(g, 'NaOH ' + fx(c, 1) + ' mol/L · ' + fx(T, 0) + ' ℃ · ' +
        (polished ? '铝片已打磨' : '铝片未打磨（有 Al₂O₃ 膜）') + ' · 观察 ' + fx(t, 0) + ' s',
        s.X(40), s.Y(92), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      /* 两支试管：左=打磨，右=未打磨（按当前选择高亮） */
      var pairs = [{ x: s.X(210), on: polished, lab: '打磨过' }, { x: s.X(390), on: !polished, lab: '未打磨' }];
      var i, cx, top = s.Y(150), tw = s.Z(92), th = s.Z(250), bot, lt;
      for (i = 0; i < 2; i++) {
        cx = pairs[i].x; bot = top + th - tw / 2; lt = top + s.Z(52);
        tube(g, cx, top, tw, th);
        liq(g, cx - tw / 2 + s.Z(2), lt, tw - s.Z(4), bot - lt - s.Z(1), 'rgba(170,200,215,.35)');
        var alx = cx - s.Z(12), aly = bot - s.Z(58);
        box(g, alx, aly, s.Z(24), s.Z(40), 'rgba(196,198,204,.98)', true);
        box(g, alx, aly, s.Z(24), s.Z(40), 'rgba(38,34,28,.75)', false, 1.2);
        if (i === 1) {
          /* 氧化膜：虚线包一层 */
          box(g, alx - s.Z(3), aly - s.Z(3), s.Z(30), s.Z(46), 'rgba(120,120,130,.9)', false, 1.2);
        }
        var e2 = pairs[i].on ? eff : 0;
        if (e2 > 0.02) {
          bubblesUp(g, 51 + i * 7, cx - tw / 2 + s.Z(8), cx + tw / 2 - s.Z(8), lt, bot - s.Z(8),
            Math.round(6 + 26 * e2), ph, 'rgba(38,34,28,.5)', s.Z(3), s.Z(1));
        }
        txt(g, pairs[i].lab + (pairs[i].on ? '（本次条件）' : ''), cx, top + th + s.Z(22),
          Math.round(s.Z(12.5)), pairs[i].on ? L : 'rgba(38,34,28,.5)', 'center', true, pairs[i].on);
      }
      /* 气体检验 */
      var hx = s.X(560);
      txt(g, '检验放出的气体', hx, s.Y(150), Math.round(s.Z(14)), L, 'left', true, true);
      seg(g, hx, s.Y(158), s.X(720), s.Y(158), 'rgba(38,34,28,.35)', 1);
      txt(g, '无色气泡 → 收集后点燃', hx, s.Y(184), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '有爆鸣声 → 气体是 H₂', hx, s.Y(206), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      flame(g, hx + s.Z(24), s.Y(252), s.Z(22), s.Z(12), 'rgba(240,170,60,.85)', 'rgba(255,236,180,.9)');
      txt(g, '爆鸣', hx + s.Z(44), s.Y(250), Math.round(s.Z(12.5)), 'rgba(150,110,20,.95)');
      txt(g, '反应程度约 ' + fx(eff * 100, 0) + '%', hx, s.Y(300), Math.round(s.Z(13)), 'rgba(38,34,28,.75)');
      if (!polished) txt(g, '氧化膜溶解约需 ' + fx(delay, 0) + ' s', hx, s.Y(322), Math.round(s.Z(12.5)), 'rgba(38,34,28,.65)');
      txt(g, '铝是两性金属：既与酸又与强碱反应', hx, s.Y(356), Math.round(s.Z(13)), L, 'left', true, true);
      txt(g, '不是铝置换钠（钠比铝活泼）', hx, s.Y(378), Math.round(s.Z(12.5)), 'rgba(170,50,40,.85)');
    }
  });

  /* ==========================================================================
   * 5 · al-thermite   铝热反应
   * ======================================================================== */
  window.QG_CLAB.register('al-thermite', {
    id: 'al-thermite',
    name: '铝热反应（铝与氧化铁）',
    group: GROUP,
    aim: '观察铝热反应的高温现象，写出化学方程式，理解铝的强还原性与铝热反应在焊接钢轨、冶炼高熔点金属中的应用',
    principle: '2Al + Fe2O3 = Al2O3 + 2Fe（高温）。铝是活泼金属、还原性强，在高温下把铁从其氧化物中置换出来；' +
      '反应放出大量的热，放出的热使置换出来的铁呈熔融态（铁的熔点 1535 ℃），' +
      '熔融的铁流入钢轨的裂缝里冷却后就把钢轨牢牢地焊接在一起 —— 这就是铝热反应（教材 P27 与必修二 P89）。' +
      '实验用镁条作引燃剂、少量氯酸钾作助燃剂提供引发所需的高温（教材实验：5 g 炒干的 Fe₂O₃ 粉末与 2 g 铝粉混匀）。' +
      '铝与 Fe₂O₃ 的物质的量之比接近 2 : 1 时反应最完全；铝太少则 Fe₂O₃ 剩余、铁珠少，铝太多则熔渣多。',
    apparatus: ['纸漏斗（两张滤纸折成，底部剪孔、用水润湿）', '铁圈', '铁架台', '蒸发皿（内盛细沙）',
      'Fe₂O₃ 粉末（炒干）', '铝粉', '镁条', '氯酸钾', '小木条', '火柴', '磁铁'],
    steps: ['把 5 g 炒干的氧化铁粉末与 2 g 铝粉混合均匀（铝热剂）',
      '把混合物放入纸漏斗中，上面加少量氯酸钾，在混合物中间插一根镁条',
      '纸漏斗架在铁圈上，下面放盛细沙的蒸发皿',
      '用小木条点燃镁条，观察现象（不要直视强光）',
      '反应后用磁铁检验落下的铁珠（能被磁铁吸引）'],
    params: [
      { key: 'fe2o3', label: 'Fe₂O₃ 质量', unit: 'g', min: 2, max: 10, step: 0.5, value: 5 },
      { key: 'al', label: '铝粉质量', unit: 'g', min: 0.5, max: 6, step: 0.1, value: 2 },
      { key: 'igniter', label: '引燃方式', type: 'select', value: 'kclo3', options: [
        { value: 'kclo3', label: '镁条 + 氯酸钾助燃剂' },
        { value: 'mg', label: '只用镁条引燃（不加助燃剂）' },
        { value: 'none', label: '不引燃（只把混合物装好）' }
      ] },
      { key: 'wet', label: '纸漏斗是否润湿/剪孔', type: 'select', value: 'yes', options: [
        { value: 'yes', label: '已润湿并在底部剪孔' },
        { value: 'no', label: '未润湿、底部没剪孔' }
      ] }
    ],
    react: function (p) {
      var mFe2O3 = clamp(pn(p, 'fe2o3', 5), 0.5, 50);
      var mAl = clamp(pn(p, 'al', 2), 0.05, 50);
      var ign = ps(p, 'igniter', 'kclo3');
      var wet = isSel(p, 'wet', 'yes');
      var nFe2O3 = mFe2O3 / M_FE2O3, nAl = mAl / M_AL;
      var ratio = nAl / nFe2O3;                          /* 理论 2.0 */
      var need = 2 * nFe2O3;                             /* 需要的铝量 mol */
      var nFe = 2 * Math.min(nFe2O3, nAl / 2);           /* 按限量试剂生成铁 */
      var mFe = nFe * M_FE;
      var ph = [];
      if (ign === 'none') {
        ph.push('只把 Fe₂O₃ 与铝粉混合装进纸漏斗：常温下没有任何反应（铝热反应需要高温引发）');
        ph.push('混合物仍是红棕色（Fe₂O₃）与银灰色（铝粉）的混合粉末');
        ph.push('铝热反应要在高温下才能发生，必须用镁条引燃（必要时加少量氯酸钾助燃）');
        return {
          phenomena: ph,
          equation: '2Al + Fe2O3 = Al2O3 + 2Fe',
          ionic: '',
          type: '置换反应（铝热反应，高温下的氧化还原反应）',
          conditions: '未引燃（常温，反应不能发生）',
          measures: {}
        };
      }
      if (ign === 'mg' && ratio < 1.2) {
        ph.push('镁条剧烈燃烧，放出大量的热并发出耀眼的白光');
        ph.push('铝粉严重不足（n(Al) : n(Fe₂O₃) = ' + fx(ratio, 2) + ' : 1，理论需要 2 : 1），' +
          '热量不够维持反应，混合物只局部红热后便熄灭');
        ph.push('纸漏斗没有被烧穿，几乎没有熔融物落下（Fe₂O₃ 大量剩余）');
      } else {
        ph.push('镁条剧烈燃烧，放出大量的热并发出耀眼的白光（引燃剂）' +
          (ign === 'kclo3' ? '，氯酸钾分解放出氧气起助燃作用' : ''));
        ph.push('铝热剂被引燃后反应剧烈，放出大量的热，发出耀眼的光芒，火星四射');
        ph.push('纸漏斗的下部被烧穿，有红热状态的液珠（熔融的铁）落入蒸发皿的细沙中');
        ph.push('液珠冷却后变成黑色固体（铁珠），用磁铁靠近能被吸引 —— 证明生成了铁');
        ph.push('理论生成铁约 ' + fx(mFe, 2) + ' g（按 ' + (nAl / 2 < nFe2O3 ? '铝粉为限量试剂' : 'Fe₂O₃ 为限量试剂') +
          '计算，n(Fe₂O₃) = ' + fx(nFe2O3, 4) + ' mol，n(Al) = ' + fx(nAl, 4) + ' mol）');
      }
      if (ratio < 1.6) {
        ph.push('铝粉偏少（n(Al) : n(Fe₂O₃) = ' + fx(ratio, 2) + ' : 1 ＜ 2 : 1），' +
          'Fe₂O₃ 没有全部被还原，铁珠少、熔渣多、现象偏弱');
      } else if (ratio > 3) {
        ph.push('铝粉偏多（n(Al) : n(Fe₂O₃) = ' + fx(ratio, 2) + ' : 1 ＞ 2 : 1），' +
          '多余的铝也被氧化放热，反应更猛烈但熔渣（Al₂O₃）明显增多');
      } else {
        ph.push('配比接近理论值（n(Al) : n(Fe₂O₃) ≈ ' + fx(ratio, 2) + ' : 1，教材实验 5 g Fe₂O₃ 配 2 g 铝粉），' +
          '反应剧烈而完全，铁珠大而多');
      }
      if (!wet) {
        ph.push('纸漏斗没有润湿、底部也没剪孔：熔融物无法顺利落下，容易积在漏斗里烧穿四周（操作缺陷）');
      } else {
        ph.push('内层纸漏斗底部剪了小孔、纸已润湿，熔融的铁水能顺利流下（润湿的纸也耐火一些）');
      }
      return {
        phenomena: ph,
        equation: '2Al + Fe2O3 = Al2O3 + 2Fe',
        ionic: '',
        type: '置换反应（铝热反应，高温下的氧化还原反应）',
        conditions: '高温（镁条引燃' + (ign === 'kclo3' ? '，氯酸钾作助燃剂' : '') + '；反应放热使铁呈熔融态）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var mFe2O3 = clamp(pn(p, 'fe2o3', 5), 0.5, 50);
      var mAl = clamp(pn(p, 'al', 2), 0.05, 50);
      var ign = ps(p, 'igniter', 'kclo3');
      var nFe2O3 = mFe2O3 / M_FE2O3, nAl = mAl / M_AL;
      var ratio = nAl / nFe2O3;
      var mFe = 2 * Math.min(nFe2O3, nAl / 2) * M_FE;
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：铝热反应 2Al + Fe2O3 = Al2O3 + 2Fe 需要在「高温」下才能发生 —— ' +
          (ign === 'none' ? '不引燃时混合物毫无变化，' : '镁条（引燃剂）与氯酸钾（助燃剂）提供引发温度，') +
          '引燃后铝把铁从 Fe₂O₃ 中置换出来，反应放出大量的热，使铁呈熔融态（铁的熔点 1535 ℃）：' +
          '耀眼的光芒、火星四射、纸漏斗被烧穿、红热的铁珠落入沙中，冷却后能被磁铁吸引。' +
          '本次 n(Al) : n(Fe₂O₃) = ' + fx(ratio, 2) + ' : 1，理论生成铁约 ' + fx(mFe, 2) + ' g；' +
          '配比接近 2 : 1 时反应最完全（教材实验用 5 g Fe₂O₃ 配 2 g 铝粉）。' +
          '工业上用这一原理焊接钢轨、冶炼高熔点金属（如用铝热法冶炼钒、铬、锰）。',
        equation: '2Al + Fe2O3 = Al2O3 + 2Fe',
        ionic: '',
        errors: ['镁条太短或铝粉受潮：引燃热量不够，反应中途熄灭（现象只有局部红热）',
          '纸漏斗没有润湿、底部没剪孔：熔融物落不下去，会烧穿漏斗四周，看不到铁珠落下',
          '蒸发皿里沙层太薄或没放沙：高温熔融物落下会炸裂蒸发皿（教材明确要求盛沙）',
          '近距离直视反应：铝热反应的强光会灼伤眼睛，必须保持距离并戴护目镜',
          '把 Fe₂O₃ 与铝粉随便配比：铝太少则 Fe₂O₃ 剩余、铝太多则熔渣多，都会让"铁珠"现象变差']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var mFe2O3 = clamp(pn(p, 'fe2o3', 5), 0.5, 50);
      var mAl = clamp(pn(p, 'al', 2), 0.05, 50);
      var ign = ps(p, 'igniter', 'kclo3');
      var wet = isSel(p, 'wet', 'yes');
      var nFe2O3 = mFe2O3 / M_FE2O3, nAl = mAl / M_AL;
      var ratio = nAl / nFe2O3;
      var fired = (ign !== 'none') && !(ign === 'mg' && ratio < 1.2);
      var ph = (state && state.phase) || 0;
      txt(g, '铝热反应（2Al + Fe2O3 = Al2O3 + 2Fe，高温）', s.X(40), s.Y(46), Math.round(s.Z(19)), L, 'left', true, true);
      txt(g, 'Fe₂O₃ ' + fx(mFe2O3, 1) + ' g + 铝粉 ' + fx(mAl, 1) + ' g · n(Al):n(Fe₂O₃) = ' + fx(ratio, 2) + ' : 1' +
        '（理论 2 : 1）', s.X(40), s.Y(70), Math.round(s.Z(13)), 'rgba(38,34,28,.7)');
      txt(g, ign === 'none' ? '未引燃：常温下不发生反应' :
        (ign === 'kclo3' ? '镁条引燃 + 氯酸钾助燃' : '只用镁条引燃（不加助燃剂）'),
        s.X(40), s.Y(92), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      /* 铁架台 + 铁圈 */
      var cx = s.X(300);
      seg(g, s.X(120), s.Y(120), s.X(120), s.Y(440), 'rgba(38,34,28,.7)', 3);
      seg(g, s.X(120), s.Y(120), s.X(210), s.Y(120), 'rgba(38,34,28,.7)', 3);
      seg(g, cx - s.Z(74), s.Y(180), cx + s.Z(74), s.Y(180), 'rgba(38,34,28,.6)', 2);
      /* 纸漏斗 */
      poly(g, [[cx - s.Z(70), s.Y(186)], [cx + s.Z(70), s.Y(186)], [cx + s.Z(16), s.Y(300)], [cx - s.Z(16), s.Y(300)]],
        wet ? 'rgba(120,96,54,.85)' : 'rgba(160,140,96,.9)', false, 1.8);
      if (wet) {
        for (var q = 0; q < 5; q++) {
          seg(g, cx - s.Z(70) + q * s.Z(28), s.Y(186), cx - s.Z(16) + q * s.Z(6), s.Y(278), 'rgba(120,96,54,.35)', 1);
        }
        seg(g, cx - s.Z(10), s.Y(298), cx + s.Z(10), s.Y(298), 'rgba(38,34,28,.8)', 2);
      }
      /* 混合物 + 镁条 */
      poly(g, [[cx - s.Z(58), s.Y(196)], [cx + s.Z(58), s.Y(196)], [cx + s.Z(14), s.Y(268)], [cx - s.Z(14), s.Y(268)]],
        'rgba(150,96,58,.9)', true);
      seg(g, cx, s.Y(196), cx, s.Y(150), 'rgba(120,120,126,.95)', 4);
      /* 蒸发皿 + 沙 */
      var dx = cx, dy = s.Y(360);
      poly(g, [[dx - s.Z(96), dy], [dx + s.Z(96), dy], [dx + s.Z(60), dy + s.Z(54)], [dx - s.Z(60), dy + s.Z(54)]],
        'rgba(38,34,28,.8)', false, 2);
      liq(g, dx - s.Z(84), dy + s.Z(6), s.Z(168), s.Z(30), 'rgba(206,186,140,.85)');
      txt(g, '细沙', dx + s.Z(104), dy + s.Z(24), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      if (fired) {
        /* 镁条燃烧 + 火星四射 + 铁珠落下 */
        star(g, cx, s.Y(170), s.Z(12), s.Z(40), 14, 'rgba(255,246,200,.9)', ph);
        sparks(g, 77, cx, s.Y(210), s.Z(80), 22, ph, 'rgba(255,196,90,.95)', s.Z(12));
        flame(g, cx, s.Y(196), s.Z(40), s.Z(24), 'rgba(246,196,66,.85)', 'rgba(255,250,220,.95)');
        var i, r2 = rnd(99), ddy;
        for (i = 0; i < 5; i++) {
          ddy = s.Y(190) + (s.Y(356) - s.Y(190)) * ((r2() + ph) % 1);
          circ(g, cx - s.Z(26) + r2() * s.Z(52), ddy, s.Z(3.4 + r2() * 2.2), 'rgba(232,96,44,.95)', true);
        }
        txt(g, '红热铁珠落入沙中 → 冷却后是黑色铁珠（能被磁铁吸引）', s.X(430), s.Y(300),
          Math.round(s.Z(12.5)), 'rgba(38,34,28,.82)');
      } else {
        txt(g, ign === 'none' ? '未点燃：没有反应' : '引燃失败：只局部红热后熄灭',
          s.X(430), s.Y(300), Math.round(s.Z(13)), 'rgba(170,50,40,.9)');
      }
      txt(g, '现象 → 原因', s.X(430), s.Y(150), Math.round(s.Z(15)), L, 'left', true, true);
      seg(g, s.X(430), s.Y(158), s.X(720), s.Y(158), 'rgba(38,34,28,.35)', 1);
      txt(g, '耀眼的光芒、火星四射：反应放出大量的热', s.X(430), s.Y(184), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '纸漏斗被烧穿：温度远高于纸的着火点', s.X(430), s.Y(206), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '铁呈熔融态：温度高于铁的熔点 1535 ℃', s.X(430), s.Y(228), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '磁铁吸引铁珠：产物确实是铁', s.X(430), s.Y(250), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '用途：焊接钢轨、冶炼高熔点金属', s.X(430), s.Y(340), Math.round(s.Z(13)), L, 'left', true, true);
      txt(g, '安全：不要直视强光；沙层要够厚', s.X(430), s.Y(362), Math.round(s.Z(12.5)), 'rgba(170,50,40,.85)');
    }
  });

  /* ==========================================================================
   * 6 · cl2-metal   氯气与铁/铜（加热）
   * ======================================================================== */
  window.QG_CLAB.register('cl2-metal', {
    id: 'cl2-metal',
    name: '氯气与金属（铁 / 铜）的反应',
    group: GROUP,
    aim: '观察铁、铜在氯气中燃烧的现象（棕黄色的烟），写出方程式，理解氯气的强氧化性（把铁氧化成 +3 价）',
    principle: '2Fe + 3Cl2 = 2FeCl3；Cu + Cl2 = CuCl2。氯气是很活泼的非金属单质、具有强氧化性，' +
      '能与大多数金属化合生成金属氯化物（教材：钠、铁、铜等都能与氯气在加热条件下发生反应）。' +
      '把烧至红热的铁丝（或铜丝）伸进盛满氯气的集气瓶，金属在氯气里剧烈燃烧，' +
      '集气瓶中充满棕黄色的烟 —— 这"烟"其实是 FeCl₃ / CuCl₂ 的固体小颗粒（不是气体）。' +
      'CuCl₂ 溶于少量水后溶液呈蓝绿色。注意：铁在氯气中生成 +3 价的 FeCl₃（氯气氧化性强），' +
      '而铁与盐酸、硫反应只生成 +2 价的亚铁化合物。氯气有毒，实验必须在通风处进行并处理尾气。',
    apparatus: ['集气瓶（盛满氯气）', '坩埚钳', '酒精灯', '铁丝（或铜丝）', '砂纸', '玻璃片', '尾气吸收装置（NaOH 溶液）'],
    steps: ['在通风处用集气瓶收集一瓶氯气（用玻璃片盖住）',
      '用砂纸打磨铁丝/铜丝，用坩埚钳夹住，在酒精灯上烧至红热',
      '迅速把红热的金属丝伸入集气瓶中，观察现象（不要俯视瓶口）',
      '反应后向瓶中加入少量水，观察溶液颜色'],
    params: [
      { key: 'metal', label: '金属', type: 'select', value: 'fe', options: [
        { value: 'fe', label: '铁丝 Fe' },
        { value: 'cu', label: '铜丝 Cu' }
      ] },
      { key: 'temp', label: '金属丝预热温度', unit: '℃', min: 100, max: 600, step: 50, value: 500 },
      { key: 'cl2', label: '集气瓶中氯气', type: 'select', value: 'full', options: [
        { value: 'full', label: '充满（一瓶纯氯气）' },
        { value: 'little', label: '只有少量氯气' }
      ] },
      { key: 'water', label: '反应后加水', type: 'select', value: 'yes', options: [
        { value: 'yes', label: '加少量水并振荡' },
        { value: 'no', label: '不加水' }
      ] }
    ],
    react: function (p) {
      var fe = isSel(p, 'metal', 'fe');
      var T = clamp(pn(p, 'temp', 500), 0, 1200);
      var full = isSel(p, 'cl2', 'full');
      var addW = isSel(p, 'water', 'yes');
      var hot = T >= 400;
      var ph = [];
      if (!hot) {
        ph.push('金属丝只预热到 ' + fx(T, 0) + ' ℃，伸进氯气后只是表面变暗、发黑（' +
          (fe ? '生成一薄层 FeCl₃' : '生成一薄层 CuCl₂') + '），没有剧烈燃烧');
        ph.push('瓶内只出现少量棕黄色固体颗粒，看不到"充满棕黄色的烟"的现象');
        ph.push('说明铁、铜与氯气的反应需要足够高的温度（教材：在加热条件下反应）');
      } else {
        ph.push((fe ? '烧至红热的铁丝' : '烧至红热的铜丝') + '伸入氯气后剧烈燃烧，集气瓶中充满棕黄色的烟');
        ph.push('这种"烟"是' + (fe ? 'FeCl₃' : 'CuCl₂') + '的固体小颗粒（烟 = 固体小颗粒，不是气体，也不是雾）');
        ph.push('瓶壁上附着' + (fe ? '棕褐色' : '棕黄色') + '的固体，金属丝变细、变脆');
        if (fe) {
          ph.push('产物中铁为 +3 价（FeCl₃）：氯气的氧化性强，把铁氧化到高价态' +
            '（对比：铁与盐酸、硫反应只得到 +2 价的亚铁化合物）');
        } else {
          ph.push('产物是 +2 价的 CuCl₂（铜只有 +1、+2 价，这里被氧化到 +2 价）');
        }
      }
      if (!full) {
        ph.push('集气瓶里氯气太少：燃烧很快就停止，烟只出现在瓶口附近（氯气不足，反应不能持续）');
      }
      if (addW) {
        if (fe) {
          ph.push('加少量水振荡后得到棕黄色溶液（FeCl₃ 溶液，Fe³⁺ 呈棕黄色）');
        } else {
          ph.push('加少量水振荡后溶液呈蓝绿色（CuCl₂ 溶液，Cu²⁺ 的水合离子显色）');
        }
      }
      ph.push('尾气必须用 NaOH 溶液吸收（Cl₂ 有毒，不能直接排入空气）');
      return {
        phenomena: ph,
        equation: fe ? '2Fe + 3Cl2 = 2FeCl3' : 'Cu + Cl2 = CuCl2',
        ionic: '',
        type: '化合反应（氯气与金属，属于氧化还原反应；氯气作氧化剂）',
        conditions: (hot ? '加热（把烧至红热的' + (fe ? '铁丝' : '铜丝') + '伸入氯气中，教材写作"加热条件下"）'
          : '加热不足（' + fx(T, 0) + ' ℃，只发生表面反应）') +
          (full ? '；集气瓶中充满氯气' : '；氯气少量'),
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var fe = isSel(p, 'metal', 'fe');
      var T = clamp(pn(p, 'temp', 500), 0, 1200);
      var hot = T >= 400;
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：' + (fe ? '2Fe + 3Cl2 = 2FeCl3' : 'Cu + Cl2 = CuCl2') + '。' +
          (hot ? '把烧至红热的' + (fe ? '铁丝' : '铜丝') + '（' + fx(T, 0) + ' ℃）伸入氯气，金属剧烈燃烧，' +
            '瓶内充满棕黄色的烟（' + (fe ? 'FeCl₃' : 'CuCl₂') + ' 固体小颗粒），瓶壁附着固体；' +
            (fe ? '铁被氧化成 +3 价。' : '铜被氧化成 +2 价，加水后溶液呈蓝绿色。')
            : '预热温度只有 ' + fx(T, 0) + ' ℃，只看到金属表面变黑（薄层氯化物），没有剧烈燃烧 —— ' +
              '说明该反应需要足够高的温度。') +
          '这条反应说明氯气是强氧化剂：它能把铁直接氧化到 +3 价（FeCl₃），' +
          '而盐酸、硫只能把铁氧化到 +2 价。氯气有毒，实验要在通风处进行并把尾气通入 NaOH 溶液吸收。',
        equation: fe ? '2Fe + 3Cl2 = 2FeCl3' : 'Cu + Cl2 = CuCl2',
        ionic: '',
        errors: ['集气瓶里的氯气没充满（或装置漏气）：燃烧很快停止，看不到"充满棕黄色的烟"',
          '金属丝没有烧至红热就伸进氯气：现象只是表面变黑，容易被误判为"不反应"',
          '把棕黄色的烟说成"黄绿色气体"：烟是固体小颗粒，黄绿色气体才是氯气本身',
          '没有尾气处理或在开放环境中做：氯气有毒，会刺激呼吸道，必须在通风橱中进行',
          '铁与氯气反应的产物写成 FeCl₂：氯气氧化性强，产物是 FeCl₃']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var fe = isSel(p, 'metal', 'fe');
      var T = clamp(pn(p, 'temp', 500), 0, 1200);
      var full = isSel(p, 'cl2', 'full');
      var addW = isSel(p, 'water', 'yes');
      var hot = T >= 400;
      var ph = (state && state.phase) || 0;
      txt(g, '氯气与' + (fe ? '铁' : '铜') + '的反应', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, fe ? '2Fe + 3Cl2 = 2FeCl3' : 'Cu + Cl2 = CuCl2', s.X(40), s.Y(70), Math.round(s.Z(14)), 'rgba(38,34,28,.7)');
      txt(g, '金属丝 ' + fx(T, 0) + ' ℃ · ' + (full ? '氯气充满集气瓶' : '氯气少量') +
        (addW ? ' · 反应后加水' : ''), s.X(40), s.Y(92), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      /* 集气瓶 */
      var bx = s.X(250), by = s.Y(180), bw = s.Z(220), bh = s.Z(210), neck = s.Z(56);
      seg(g, bx, by, bx, by + bh, L, 2);
      seg(g, bx + bw, by, bx + bw, by + bh, L, 2);
      seg(g, bx, by + bh, bx + bw, by + bh, L, 2);
      seg(g, bx, by, bx + neck, by, L, 2);
      seg(g, bx + bw - neck, by, bx + bw, by, L, 2);
      seg(g, bx + neck, by, bx + neck, by - s.Z(26), L, 2);
      seg(g, bx + bw - neck, by, bx + bw - neck, by - s.Z(26), L, 2);
      /* 氯气：黄绿色（少量时只有薄薄一层） */
      var gasH = full ? bh - s.Z(4) : bh * 0.22;
      liq(g, bx + s.Z(2), by + bh - gasH - s.Z(2), bw - s.Z(4), gasH,
        full ? 'rgba(186,206,86,.42)' : 'rgba(186,206,86,.22)');
      /* 金属丝（坩埚钳夹住，红热） */
      var mx = bx + bw * 0.52;
      seg(g, mx, s.Y(120), mx, by + bh - s.Z(30), fe ? 'rgba(110,110,116,.95)' : 'rgba(186,110,70,.95)', 4);
      if (hot) circ(g, mx, by + s.Z(70), s.Z(9), 'rgba(240,140,60,.75)', true);
      seg(g, mx - s.Z(26), s.Y(112), mx + s.Z(26), s.Y(112), 'rgba(38,34,28,.75)', 3);
      txt(g, '坩埚钳', mx + s.Z(32), s.Y(116), Math.round(s.Z(12)), 'rgba(38,34,28,.65)');
      /* 棕黄色的烟 */
      if (hot) {
        puff(g, 131, bx + bw * 0.5, by + bh * 0.52, s.Z(full ? 92 : 46), full ? 46 : 16,
          fe ? 'rgba(176,120,48,.55)' : 'rgba(196,148,60,.55)', 0.55);
        puff(g, 137, bx + bw * 0.5, by + bh * 0.34, s.Z(full ? 70 : 34), full ? 26 : 10,
          'rgba(200,156,72,.45)', 0.45);
        sparks(g, 141, mx, by + s.Z(76), s.Z(30), 8, ph, 'rgba(255,200,110,.8)', s.Z(6));
      }
      /* 瓶底固体 */
      if (hot) box(g, bx + s.Z(6), by + bh - s.Z(9), bw - s.Z(12), s.Z(7), fe ? 'rgba(96,62,26,.9)' : 'rgba(150,104,32,.9)', true);
      /* 加水后的溶液 */
      if (hot && addW) {
        liq(g, bx + s.Z(6), by + bh - s.Z(58), bw - s.Z(12), s.Z(50),
          fe ? 'rgba(196,150,60,.6)' : 'rgba(60,150,150,.55)');
        txt(g, fe ? '棕黄色溶液（Fe³⁺）' : '蓝绿色溶液（Cu²⁺）', bx + bw + s.Z(14), by + bh - s.Z(24),
          Math.round(s.Z(12.5)), 'rgba(38,34,28,.85)');
      }
      txt(g, '现象 → 结论', s.X(520), s.Y(180), Math.round(s.Z(15)), L, 'left', true, true);
      seg(g, s.X(520), s.Y(188), s.X(720), s.Y(188), 'rgba(38,34,28,.35)', 1);
      txt(g, '棕黄色的烟 = ' + (fe ? 'FeCl₃' : 'CuCl₂') + ' 固体小颗粒', s.X(520), s.Y(214),
        Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '黄绿色气体 = 未反应的 Cl₂', s.X(520), s.Y(236), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, fe ? '铁被氧化成 +3 价（FeCl₃）' : '铜被氧化成 +2 价（CuCl₂）', s.X(520), s.Y(258),
        Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '对比：Fe + 盐酸/硫 → 只到 +2 价', s.X(520), s.Y(282), Math.round(s.Z(12.5)), 'rgba(38,34,28,.65)');
      txt(g, 'Cl₂ 有毒 → 尾气用 NaOH 吸收', s.X(520), s.Y(316), Math.round(s.Z(13)), L, 'left', true, true);
      if (!hot) {
        txt(g, '预热不足：金属丝只表面变黑', s.X(520), s.Y(344), Math.round(s.Z(12.5)), 'rgba(170,50,40,.9)');
      }
    }
  });

  /* ==========================================================================
   * 7 · cl2-water   氯气与水（氯水的成分、漂白性、见光分解）
   * ======================================================================== */
  window.QG_CLAB.register('cl2-water', {
    id: 'cl2-water',
    name: '氯气与水的反应（氯水的成分与漂白性）',
    group: GROUP,
    aim: '认识氯水的成分（三分子四离子）、漂白性与见光分解，写出氯气与水、次氯酸分解的方程式，理解"起漂白作用的是 HClO"',
    principle: 'Cl2 + H2O = HCl + HClO（可逆反应，常温下部分氯气与水反应）。' +
      '氯水是混合物：3 种分子（Cl₂、HClO、H₂O）和 4 种离子（H⁺、Cl⁻、ClO⁻、OH⁻，其中 ClO⁻ 和 OH⁻ 很少）。' +
      '氯水呈浅黄绿色、有刺激性气味（说明其中还有 Cl₂ 分子），显酸性（H⁺），' +
      '因为含 Cl⁻ 所以加 AgNO₃ 溶液会产生白色沉淀，因为含 HClO 所以有漂白性：' +
      '能使有色布条褪色、使石蕊先变红（酸性）后褪色（漂白）。' +
      '★ 干燥的氯气不能使干燥的有色布条褪色，只有湿润的布条才褪色 —— 起漂白作用的是 HClO 而不是 Cl₂。' +
      '次氯酸不稳定，见光分解：2HClO = 2HCl + O2↑，所以氯水要装在棕色试剂瓶中避光保存；' +
      '久置的氯水黄绿色消失、pH 减小、漂白能力消失，基本上可以看成稀盐酸。',
    apparatus: ['新制氯水（浅黄绿色）', '棕色试剂瓶', '试管', '有色布条（或品红溶液）', '紫色石蕊试液',
      'AgNO₃ 溶液', 'pH 试纸', '集气瓶（干燥氯气）'],
    steps: ['观察新制氯水的颜色、闻气味（扇闻）', '取少量氯水滴入紫色石蕊试液，观察颜色变化',
      '把干燥的有色布条与湿润的有色布条分别放入盛干燥氯气的集气瓶中，对比现象',
      '把氯水放在日光下（或强光下）照射一段时间，观察黄绿色、气泡与 pH 的变化',
      '向氯水中滴加 AgNO₃ 溶液，观察白色沉淀'],
    params: [
      { key: 'light', label: '保存/照射条件', type: 'select', value: 'dark', options: [
        { value: 'dark', label: '避光保存（棕色试剂瓶）' },
        { value: 'light', label: '放在光亮处' },
        { value: 'sun', label: '日光直射（强光）' }
      ] },
      { key: 'hours', label: '放置时间', unit: 'h', min: 0, max: 72, step: 1, value: 0 },
      { key: 'cl2', label: '氯水浓度', type: 'select', value: 'sat', options: [
        { value: 'sat', label: '饱和氯水（黄绿色明显）' },
        { value: 'dilute', label: '稀氯水（颜色很浅）' }
      ] },
      { key: 'dye', label: '有色布条', type: 'select', value: 'wet', options: [
        { value: 'wet', label: '湿润的有色布条' },
        { value: 'dry', label: '干燥的有色布条（通干燥氯气）' }
      ] }
    ],
    react: function (p) {
      var light = ps(p, 'light', 'dark');
      var h = clamp(pn(p, 'hours', 0), 0, 240);
      var sat = isSel(p, 'cl2', 'sat');
      var wet = isSel(p, 'dye', 'wet');
      /* 分解程度：光照越强、时间越长，HClO 分解越多 */
      var k = (light === 'sun') ? 1 : (light === 'light' ? 0.45 : 0.04);
      var dec = clamp(1 - Math.exp(-k * h / 10), 0, 0.999);
      var ph = [];
      var cl2Left = (sat ? 1 : 0.35) * (1 - 0.85 * dec);
      ph.push('新制氯水呈浅黄绿色（' + (sat ? '饱和氯水颜色较明显' : '稀氯水颜色很浅') +
        '）、有刺激性气味 —— 说明氯水中还存在 Cl₂ 分子');
      ph.push('氯水显酸性：滴入紫色石蕊试液先变红（H⁺）');
      if (wet) {
        ph.push('湿润的有色布条迅速褪色 —— 起漂白作用的是 HClO（强氧化性）');
      } else {
        ph.push('干燥的有色布条不褪色 —— 干燥的氯气没有漂白性，说明起漂白作用的不是 Cl₂ 本身');
      }
      ph.push('石蕊试液变红后继续褪色（HClO 的漂白作用把红色漂去）');
      ph.push('滴加 AgNO₃ 溶液产生白色沉淀（AgCl，说明氯水中有 Cl⁻）');
      if (dec < 0.05) {
        ph.push('避光放置 ' + fx(h, 0) + ' h：黄绿色基本不变、pH 基本不变（棕色试剂瓶能减缓 HClO 分解）');
      } else if (dec < 0.6) {
        ph.push('光照 ' + fx(h, 0) + ' h：黄绿色变浅、有少量气泡逸出（O₂），pH 试纸显示酸性增强' +
          '（HClO 分解出 HCl）');
      } else {
        ph.push('光照 ' + fx(h, 0) + ' h：黄绿色几乎消失、不断有气泡逸出（O₂），pH 明显减小，' +
          '漂白能力消失 —— 久置氯水基本上可以看成稀盐酸');
      }
      ph.push('HClO 分解程度约 ' + fx(dec * 100, 0) + '%（0% = 新制氯水，100% = 久置氯水≈稀盐酸）');
      ph.push('成分：3 种分子（Cl₂、HClO、H₂O）+ 4 种离子（H⁺、Cl⁻、ClO⁻、OH⁻，后两者很少）' +
        '；剩余 Cl₂ 约 ' + fx(cl2Left * 100, 0) + '%（相对新制饱和氯水）');
      return {
        phenomena: ph,
        equation: dec >= 0.5 ? '2HClO = 2HCl + O2↑' : 'Cl2 + H2O = HCl + HClO',
        ionic: dec >= 0.5 ? '' : 'Cl2 + H2O = H+ + Cl- + HClO',
        type: dec >= 0.5 ? '分解反应（次氯酸见光分解，氯水久置变质）'
          : '氯气与水的反应（可逆反应、歧化反应）',
        conditions: (light === 'dark' ? '常温避光（棕色试剂瓶），放置 ' + fx(h, 0) + ' h'
          : (light === 'sun' ? '常温、日光直射 ' : '常温、放在光亮处 ') + fx(h, 0) + ' h'),
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var light = ps(p, 'light', 'dark');
      var h = clamp(pn(p, 'hours', 0), 0, 240);
      var sat = isSel(p, 'cl2', 'sat');
      var wet = isSel(p, 'dye', 'wet');
      var k = (light === 'sun') ? 1 : (light === 'light' ? 0.45 : 0.04);
      var dec = clamp(1 - Math.exp(-k * h / 10), 0, 0.999);
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：氯气溶于水时部分与水反应 Cl2 + H2O = HCl + HClO（可逆），' +
          '所以氯水是混合物 —— 3 种分子（Cl₂、HClO、H₂O）与 4 种离子（H⁺、Cl⁻、ClO⁻、OH⁻）。' +
          '氯水显酸性、能与 AgNO₃ 生成白色 AgCl 沉淀，并有漂白性（使有色布条褪色、使石蕊先变红后褪色）；' +
          (wet ? '本次用湿润的有色布条，褪色很快；' : '本次用干燥的有色布条通干燥氯气，不褪色 —— 这正说明漂白的是 HClO，不是 Cl₂；') +
          '次氯酸不稳定，见光分解 2HClO = 2HCl + O2↑：' +
          (light === 'dark' ? '本次避光放置 ' + fx(h, 0) + ' h，分解只有约 ' + fx(dec * 100, 0) +
            '%，氯水基本没变（所以要装在棕色试剂瓶里避光保存）；'
            : '本次' + (light === 'sun' ? '日光直射' : '放在光亮处') + ' ' + fx(h, 0) + ' h，HClO 分解约 ' +
              fx(dec * 100, 0) + '%，黄绿色变浅、放出 O₂、pH 减小，久置氯水基本上就是稀盐酸。') +
          '这次的氯水浓度：' + (sat ? '饱和氯水' : '稀氯水') + '。',
        equation: dec >= 0.5 ? '2HClO = 2HCl + O2↑' : 'Cl2 + H2O = HCl + HClO',
        ionic: 'Cl2 + H2O = H+ + Cl- + HClO',
        errors: ['用久置的氯水做漂白实验：HClO 已分解，布条不褪色，会得出"氯水没有漂白性"的错误结论',
          '氯水没有装在棕色试剂瓶里避光保存：HClO 见光分解，氯水很快变质',
          '把"干燥氯气使有色布条褪色"当成事实：干燥氯气没有漂白性，必须是湿润的布条（生成 HClO）才褪色',
          '闻氯水气味时把鼻子凑到瓶口直接吸：氯气有毒、有强烈刺激性，必须用手扇闻',
          '把 Cl₂ 与氯水当成同一种物质：液氯是纯净物（Cl₂），氯水是混合物']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var light = ps(p, 'light', 'dark');
      var h = clamp(pn(p, 'hours', 0), 0, 240);
      var sat = isSel(p, 'cl2', 'sat');
      var wet = isSel(p, 'dye', 'wet');
      var k = (light === 'sun') ? 1 : (light === 'light' ? 0.45 : 0.04);
      var dec = clamp(1 - Math.exp(-k * h / 10), 0, 0.999);
      var ph = (state && state.phase) || 0;
      txt(g, '氯水的成分、漂白性与见光分解', s.X(40), s.Y(46), Math.round(s.Z(19)), L, 'left', true, true);
      txt(g, 'Cl2 + H2O = HCl + HClO　（见光分解：2HClO = 2HCl + O2↑）', s.X(40), s.Y(70), Math.round(s.Z(13.5)), 'rgba(38,34,28,.7)');
      txt(g, (light === 'dark' ? '避光保存' : (light === 'sun' ? '日光直射' : '光亮处')) + ' ' + fx(h, 0) +
        ' h · ' + (sat ? '饱和氯水' : '稀氯水') + ' · 分解约 ' + fx(dec * 100, 0) + '%',
        s.X(40), s.Y(92), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      /* 试剂瓶（棕色 / 无色） */
      var bx = s.X(150), by = s.Y(190), bw = s.Z(110), bh = s.Z(190), neck = s.Z(34);
      seg(g, bx, by, bx, by + bh, L, 2);
      seg(g, bx + bw, by, bx + bw, by + bh, L, 2);
      seg(g, bx, by + bh, bx + bw, by + bh, L, 2);
      seg(g, bx + neck, by, bx + neck, by - s.Z(34), L, 2);
      seg(g, bx + bw - neck, by, bx + bw - neck, by - s.Z(34), L, 2);
      box(g, bx + neck - s.Z(6), by - s.Z(40), bw - 2 * neck + s.Z(12), s.Z(10),
        light === 'dark' ? 'rgba(96,62,30,.9)' : 'rgba(210,210,206,.9)', true);
      box(g, bx + neck - s.Z(6), by - s.Z(40), bw - 2 * neck + s.Z(12), s.Z(10), L, false, 1.2);
      /* 溶液：浅黄绿色，随分解变淡 */
      var gA = (sat ? 0.42 : 0.2) * (1 - 0.85 * dec);
      liq(g, bx + s.Z(2), by + s.Z(46), bw - s.Z(4), bh - s.Z(48), 'rgba(186,206,86,' + fx(gA, 2) + ')');
      txt(g, '氯水（浅黄绿色）', bx - s.Z(6), by + bh + s.Z(24), Math.round(s.Z(12.5)), 'rgba(38,34,28,.75)');
      txt(g, light === 'dark' ? '棕色试剂瓶（避光）' : '受光照射', bx - s.Z(6), by + bh + s.Z(46),
        Math.round(s.Z(12.5)), light === 'dark' ? 'rgba(38,34,28,.75)' : 'rgba(170,110,20,.9)');
      /* 光照 */
      if (light !== 'dark') {
        var sx = s.X(150), sy = s.Y(140);
        circ(g, sx, sy, s.Z(20), 'rgba(240,190,60,.95)', true);
        var i, a;
        for (i = 0; i < 8; i++) {
          a = (i / 8) * Math.PI * 2;
          seg(g, sx + Math.cos(a) * s.Z(24), sy + Math.sin(a) * s.Z(24),
            sx + Math.cos(a) * s.Z(34), sy + Math.sin(a) * s.Z(34), 'rgba(240,190,60,.85)', 2);
        }
        for (i = 0; i < 5; i++) {
          seg(g, s.X(180) + i * s.Z(30), s.Y(160), s.X(160) + i * s.Z(34), s.Y(196), 'rgba(240,190,60,.5)', 1.4);
        }
      }
      /* O₂ 气泡（分解明显时） */
      if (dec > 0.12) {
        bubblesUp(g, 313, bx + s.Z(10), bx + bw - s.Z(10), by + s.Z(50), by + bh - s.Z(6),
          Math.round(4 + 22 * dec), ph, 'rgba(38,34,28,.45)', s.Z(3), s.Z(1));
      }
      /* 有色布条对比：左=干燥氯气（不褪色），右=湿润（褪色） */
      var dx = s.X(360), dy = s.Y(170);
      txt(g, '漂白性（起漂白作用的是 HClO）', dx, dy - s.Z(18), Math.round(s.Z(14)), L, 'left', true, true);
      box(g, dx, dy, s.Z(120), s.Z(34), wet ? 'rgba(226,226,222,.95)' : 'rgba(214,86,120,.85)', true);
      box(g, dx, dy, s.Z(120), s.Z(34), L, false, 1.3);
      txt(g, '干燥的氯气：不褪色', dx, dy + s.Z(54), Math.round(s.Z(12)), 'rgba(38,34,28,.75)');
      box(g, dx + s.Z(160), dy, s.Z(120), s.Z(34), 'rgba(226,226,222,.95)', true);
      box(g, dx + s.Z(160), dy, s.Z(120), s.Z(34), L, false, 1.3);
      txt(g, '湿润的布条：褪色', dx + s.Z(160), dy + s.Z(54), Math.round(s.Z(12)), 'rgba(38,34,28,.75)');
      txt(g, wet ? '← 本次选的是湿润布条' : '← 本次选的是干燥布条', dx, dy + s.Z(78),
        Math.round(s.Z(12.5)), 'rgba(38,34,28,.85)');
      /* 石蕊先红后褪 */
      box(g, dx, dy + s.Z(110), s.Z(34), s.Z(58), 'rgba(214,74,120,.85)', true);
      box(g, dx, dy + s.Z(110) + s.Z(34), s.Z(34), s.Z(24), 'rgba(228,228,224,.95)', true);
      txt(g, '石蕊：先变红（酸性）后褪色（HClO 漂白）', dx + s.Z(48), dy + s.Z(134), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      /* 成分表 */
      var cx2 = s.X(360), cy2 = s.Y(330);
      txt(g, '氯水的成分（混合物）', cx2, cy2, Math.round(s.Z(14)), L, 'left', true, true);
      txt(g, '3 种分子：Cl₂、HClO、H₂O', cx2, cy2 + s.Z(24), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '4 种离子：H⁺、Cl⁻、ClO⁻、OH⁻（后两者很少）', cx2, cy2 + s.Z(46), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '久置氯水 ≈ 稀盐酸（黄绿色消失、pH 减小）', cx2, cy2 + s.Z(70), Math.round(s.Z(12.5)), 'rgba(170,50,40,.85)');
    }
  });

  /* ==========================================================================
   * 8 · s-metal   硫与铁 / 铜（加热）
   * ======================================================================== */
  window.QG_CLAB.register('s-metal', {
    id: 's-metal',
    name: '硫与铁、铜的反应（加热）',
    group: GROUP,
    aim: '观察硫与铁粉、铜丝加热反应生成黑色硫化物的现象与条件，写出方程式，理解硫的氧化性比氯气弱',
    principle: 'Fe + S = FeS（生成黑色的硫化亚铁）；2Cu + S = Cu2S（生成黑色的硫化亚铜，铜显 +1 价）。' +
      '硫与铁、铜的反应需要在「加热」条件下才能发生（常温不反应），反应一旦引发就会放热并持续进行。' +
      '硫的氧化性比氯气弱：与铁反应时硫只能把铁氧化到 +2 价（FeS），' +
      '而氯气能把铁氧化到 +3 价（FeCl₃）；与铜反应时硫把铜氧化到 +1 价（Cu₂S，黑色），' +
      '氯气则把铜氧化到 +2 价（CuCl₂）。硫过量时多余硫受热熔化、变成橙黄色的硫蒸气，冷却后凝成黄色固体。',
    apparatus: ['试管（或坩埚）', '酒精灯', '石棉网', '铁粉', '铜丝（或铜粉）', '硫粉', '药匙', '磁铁'],
    steps: ['把铁粉（或铜丝）与硫粉按一定比例混合，放在石棉网上堆成小堆',
      '用酒精灯小心加热混合物的一端，观察现象', '一旦混合物开始红热就移开酒精灯，观察反应能否继续',
      '冷却后用磁铁靠近产物，观察黑色固体能否被吸引（对比铁粉与 FeS）',
      '若硫过量，注意观察未反应的硫熔化、汽化与冷却后凝华的现象'],
    params: [
      { key: 'metal', label: '金属', type: 'select', value: 'fe', options: [
        { value: 'fe', label: '铁粉 Fe（生成 FeS）' },
        { value: 'cu', label: '铜丝 Cu（生成 Cu₂S）' }
      ] },
      { key: 'ratio', label: 'n(S) : n(金属)', min: 0.5, max: 2.5, step: 0.1, value: 1 },
      { key: 'temp', label: '加热温度', unit: '℃', min: 150, max: 500, step: 10, value: 300 },
      { key: 'metalMass', label: '金属用量', unit: 'g', min: 0.5, max: 5, step: 0.1, value: 2 }
    ],
    react: function (p) {
      var fe = isSel(p, 'metal', 'fe');
      var r = clamp(pn(p, 'ratio', 1), 0.1, 10);
      var T = clamp(pn(p, 'temp', 300), 0, 1000);
      var m = clamp(pn(p, 'metalMass', 2), 0.05, 50);
      var need = fe ? 1 : 0.5;                        /* 1 mol 金属需要的硫（mol） */
      var nM = m / (fe ? M_FE : M_CU);
      var nS = r * nM;
      var nNeed = need * nM;
      var nProd = fe ? Math.min(nS / 1, nM) : Math.min(nS / 0.5, nM);
      var mProd = fe ? nProd * M_FES : nProd * M_CU2S;
      var mSLeft = Math.max(0, nS - nNeed) * M_S;
      var mLeft = Math.max(0, nM - nProd) * (fe ? M_FE : M_CU);
      var ph = [];
      if (T < 200) {
        ph.push('加热到 ' + fx(T, 0) + ' ℃：混合物只有硫受热熔化（硫的熔点 113 ℃），' +
          '铁粉/铜丝没有明显变化，反应没有引发');
        ph.push('硫熔化成黄色的液体，继续加热会变成橙黄色的硫蒸气（硫的沸点 445 ℃）');
        ph.push('这说明硫与铁、铜的反应需要足够高的温度（一般要加热到红热才能引发）');
      } else {
        ph.push('加热后混合物局部开始红热，随后反应剧烈地进行，' +
          (fe ? '生成黑色的硫化亚铁 FeS' : '生成黑色的硫化亚铜 Cu₂S'));
        ph.push('反应放热：移开酒精灯后红热仍能持续一段时间（反应放出的热维持了反应）');
        ph.push('冷却后得到黑色固体，' + (fe ? '用磁铁靠近：铁粉能被吸引，而生成的 FeS 不能被磁铁吸引，' +
          '说明生成了新物质' : '用磁铁靠近：铜和 Cu₂S 都不被磁铁吸引（要用其他方法检验）'));        ph.push('理论生成 ' + (fe ? 'FeS' : 'Cu₂S') + ' 约 ' + fx(mProd, 2) + ' g' +
          '（n(' + (fe ? 'Fe' : 'Cu') + ') = ' + fx(nM, 4) + ' mol，n(S) = ' + fx(nS, 4) + ' mol）');
        ph.push(fe ? '铁被氧化到 +2 价（FeS）：硫的氧化性比氯气弱，氯气会把铁氧化到 +3 价（FeCl₃）'
          : '铜被氧化到 +1 价（Cu₂S，不是 CuS）：硫的氧化性比氯气弱，氯气会把铜氧化到 +2 价（CuCl₂）');
        if (mSLeft > 0.005) {
          ph.push('硫过量：还有约 ' + fx(mSLeft, 2) + ' g 硫没有反应，受热时熔化成黄色液体、' +
            '部分变成橙黄色蒸气，冷却后凝成黄色固体混在产物里（产物不纯）');
        }
        if (mLeft > 0.005) {
          ph.push('金属过量：还有约 ' + fx(mLeft, 2) + ' g ' + (fe ? '铁粉' : '铜丝') +
            '剩余（硫不足，产物中混有未反应的金属）');
        }
        if (mSLeft <= 0.005 && mLeft <= 0.005) ph.push('硫与金属恰好按化学计量比反应，产物比较纯');
      }
      return {
        phenomena: ph,
        equation: fe ? 'Fe + S = FeS' : '2Cu + S = Cu2S',
        ionic: '',
        type: '化合反应（硫与金属，属于氧化还原反应；硫作氧化剂）',
        conditions: '加热（约 ' + fx(T, 0) + ' ℃ 引发；反应放热，可自行持续）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var fe = isSel(p, 'metal', 'fe');
      var r = clamp(pn(p, 'ratio', 1), 0.1, 10);
      var T = clamp(pn(p, 'temp', 300), 0, 1000);
      var m = clamp(pn(p, 'metalMass', 2), 0.05, 50);
      var nM = m / (fe ? M_FE : M_CU);
      var nProd = fe ? Math.min(r * nM / 1, nM) : Math.min(r * nM / 0.5, nM);
      var mProd = fe ? nProd * M_FES : nProd * M_CU2S;
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：' + (fe ? 'Fe + S = FeS（黑色硫化亚铁）' : '2Cu + S = Cu2S（黑色硫化亚铜）') +
          '。' + (T < 200 ? '本次加热温度只有 ' + fx(T, 0) + ' ℃，只看到硫熔化、汽化，反应没有被引发 —— ' +
            '硫与铁、铜的反应必须在加热（红热）条件下才能发生。'
            : '加热到 ' + fx(T, 0) + ' ℃ 后混合物红热、反应持续进行，冷却得到黑色固体' +
              (fe ? '，且该固体不再像铁粉那样被磁铁吸引' : '') + '；本次理论生成产物约 ' + fx(mProd, 2) + ' g。') +
          'n(S) : n(' + (fe ? 'Fe' : 'Cu') + ') = ' + fx(r, 1) + ' : 1（化学计量比 ' +
          (fe ? '1 : 1' : '1 : 2') + '），硫过量时产物中会混有未反应的硫（黄色）。' +
          '对比氯气：硫的氧化性比氯气弱 —— 硫只能把铁氧化到 +2 价（FeS）、把铜氧化到 +1 价（Cu₂S，黑色），' +
          '而氯气把铁氧化到 +3 价（FeCl₃）、把铜氧化到 +2 价（CuCl₂）。',
        equation: fe ? 'Fe + S = FeS' : '2Cu + S = Cu2S',
        ionic: '',
        errors: ['加热温度不够（没到红热）：反应不能被引发，只看到硫熔化，容易被误判为"不反应"',
          '硫粉用量不足：产物中混有未反应的铁粉（用磁铁就能检验出来），产物不纯',
          '在空气中长时间强热：铁、铜和硫会与氧气反应（生成氧化物、SO₂），干扰对产物的判断',
          '把铜与硫的产物写成 CuS：铜与硫直接化合生成的是 Cu₂S（铜为 +1 价），不是 CuS',
          '用磁铁检验 Cu₂S：铜和 Cu₂S 都不被磁铁吸引，这一步对铜的实验没有意义']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var fe = isSel(p, 'metal', 'fe');
      var r = clamp(pn(p, 'ratio', 1), 0.1, 10);
      var T = clamp(pn(p, 'temp', 300), 0, 1000);
      var m = clamp(pn(p, 'metalMass', 2), 0.05, 50);
      var nM = m / (fe ? M_FE : M_CU);
      var nProd = fe ? Math.min(r * nM, nM) : Math.min(r * nM / 0.5, nM);
      var mProd = fe ? nProd * M_FES : nProd * M_CU2S;
      var nSLeft = Math.max(0, r * nM - (fe ? nM : 0.5 * nM)) * M_S;
      var hot = T >= 200;
      var ph = (state && state.phase) || 0;
      txt(g, '硫与' + (fe ? '铁' : '铜') + '的反应（加热）', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, fe ? 'Fe + S = FeS（黑色）' : '2Cu + S = Cu2S（黑色）', s.X(40), s.Y(70), Math.round(s.Z(14)), 'rgba(38,34,28,.7)');
      txt(g, 'n(S):n(' + (fe ? 'Fe' : 'Cu') + ') = ' + fx(r, 1) + ' : 1 · ' + fx(T, 0) + ' ℃ · 金属 ' +
        fx(m, 1) + ' g', s.X(40), s.Y(92), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      /* 石棉网 + 混合物小堆 */
      var cx = s.X(280), cy = s.Y(330);
      seg(g, s.X(140), cy + s.Z(30), s.X(430), cy + s.Z(30), 'rgba(38,34,28,.7)', 3);
      for (var i2 = 0; i2 < 14; i2++) seg(g, s.X(146 + i2 * 20), cy + s.Z(30), s.X(140 + i2 * 20), cy + s.Z(40), 'rgba(38,34,28,.3)', 1);
      poly(g, [[cx - s.Z(80), cy + s.Z(28)], [cx + s.Z(80), cy + s.Z(28)], [cx + s.Z(46), cy - s.Z(6)], [cx - s.Z(46), cy - s.Z(6)]],
        hot ? 'rgba(58,54,50,.95)' : 'rgba(150,132,58,.95)', true);
      if (!hot) {
        /* 未反应：黄色硫粉 + 灰黑色金属粉 混在一起 */
        var r3 = rnd(41), k2;
        for (k2 = 0; k2 < 46; k2++) {
          circ(g, cx - s.Z(70) + r3() * s.Z(140), cy + s.Z(2) + r3() * s.Z(22), s.Z(2),
            r3() > 0.5 ? 'rgba(224,204,74,.95)' : 'rgba(74,72,70,.9)', true);
        }
        txt(g, '加热 ' + fx(T, 0) + ' ℃：硫熔化（熔点 113 ℃）、变成橙黄色硫蒸气，反应未引发',
          s.X(330), s.Y(160), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      } else {
        /* 反应：红热 + 黑色产物 */
        star(g, cx, cy - s.Z(10), s.Z(8), s.Z(26), 10, 'rgba(232,120,60,.5)', ph);
        sparks(g, 53, cx, cy - s.Z(6), s.Z(80), 12, ph, 'rgba(240,150,70,.85)', s.Z(8));
        txt(g, '混合物红热，反应放热并持续进行', s.X(330), s.Y(160), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
        txt(g, '冷却后是黑色固体（' + (fe ? 'FeS' : 'Cu₂S') + '）约 ' + fx(mProd, 2) + ' g',
          s.X(330), s.Y(184), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      }
      /* 酒精灯 */
      var lx = cx, ly = s.Y(440);
      poly(g, [[lx - s.Z(30), ly], [lx + s.Z(30), ly], [lx + s.Z(20), ly - s.Z(34)], [lx - s.Z(20), ly - s.Z(34)]],
        'rgba(38,34,28,.6)', false, 1.6);
      if (hot) flame(g, lx, ly - s.Z(36), s.Z(40) + s.Z(6) * Math.sin(ph * Math.PI * 2), s.Z(22),
        'rgba(240,170,60,.85)', 'rgba(255,236,180,.9)');
      else flame(g, lx, ly - s.Z(36), s.Z(24), s.Z(14), 'rgba(240,170,60,.7)', 'rgba(255,236,180,.8)');
      /* 磁铁检验 */
      var mx = s.X(540), my = s.Y(210);
      txt(g, '产物检验', mx, my - s.Z(26), Math.round(s.Z(15)), L, 'left', true, true);
      seg(g, mx, my - s.Z(14), s.X(720), my - s.Z(14), 'rgba(38,34,28,.35)', 1);
      /* 马蹄形磁铁 */
      poly(g, [[mx, my], [mx, my + s.Z(34)], [mx + s.Z(34), my + s.Z(34)], [mx + s.Z(34), my]],
        'rgba(150,60,60,.9)', false, s.Z(5));
      txt(g, fe ? '铁粉：被磁铁吸引' : '铜丝：不被磁铁吸引', mx + s.Z(48), my + s.Z(12), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, fe ? (fe ? 'FeS：不被磁铁吸引 → 生成了新物质' : '') : 'Cu₂S：黑色固体',
        mx + s.Z(48), my + s.Z(34), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '硫过量：剩余 ' + fx(nSLeft, 2) + ' g（黄色）', mx, my + s.Z(80), Math.round(s.Z(12.5)), 'rgba(38,34,28,.7)');
      txt(g, '硫的氧化性比氯气弱：', mx, my + s.Z(120), Math.round(s.Z(13)), L, 'left', true, true);
      txt(g, 'Fe + S → FeS（+2 价）', mx, my + s.Z(144), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '2Fe + 3Cl2 → 2FeCl3（+3 价）', mx, my + s.Z(166), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      if (fe) txt(g, '2Cu + S → Cu2S（+1 价，不是 CuS）', mx, my + s.Z(188), Math.round(s.Z(12.5)), 'rgba(170,50,40,.85)');
    }
  });

  /* ==========================================================================
   * 9 · mg-co2   镁在二氧化碳中燃烧
   * ======================================================================== */
  window.QG_CLAB.register('mg-co2', {
    id: 'mg-co2',
    name: '镁在二氧化碳中燃烧',
    group: GROUP,
    aim: '观察镁在 CO₂ 中继续燃烧并生成白色粉末与黑色固体的"反常识"现象，写出方程式，理解燃烧不一定需要氧气、CO₂ 不能扑灭镁火灾',
    principle: '2Mg + CO2 = 2MgO + C（点燃）。镁是活泼金属、还原性强，点燃后能在二氧化碳中继续燃烧：' +
      'CO₂ 中的碳被还原成单质碳（黑色固体小颗粒），镁被氧化成氧化镁（白色粉末），反应放出大量的热并发出耀眼的白光。' +
      '这个实验说明：① 燃烧不一定需要氧气参加；② CO₂ 不是万能的灭火剂 —— ' +
      '镁（以及钠、钾等活泼金属）着火时不能用 CO₂ 灭火器，要用干燥沙土覆盖。' +
      '在空气中燃烧时，镁主要与 O₂ 生成白色的 MgO，同时还会与 N₂ 生成少量的氮化镁 Mg₃N₂（黄绿色固体）。',
    apparatus: ['集气瓶（充满 CO₂）', '镁条', '砂纸', '坩埚钳', '酒精灯（或火柴）', '玻璃片'],
    steps: ['用砂纸擦亮镁条，除去表面的氧化膜',
      '在集气瓶中收集满 CO₂（用玻璃片盖住瓶口）',
      '点燃镁条，迅速伸入盛满 CO₂ 的集气瓶中，观察现象（不要直视强光）',
      '反应后观察瓶壁与瓶底的固体颜色，冷却后取出固体观察'],
    params: [
      { key: 'mg', label: '镁条质量', unit: 'g', min: 0.2, max: 3, step: 0.1, value: 1 },
      { key: 'bottle', label: '集气瓶容积（CO₂ 体积）', unit: 'L', min: 0.2, max: 3, step: 0.1, value: 1 },
      { key: 'atmos', label: '瓶内气体', type: 'select', value: 'co2', options: [
        { value: 'co2', label: '充满 CO₂（本反应的"反常识"条件）' },
        { value: 'air', label: '空气（对比实验）' }
      ] },
      { key: 'dry', label: '瓶壁是否干燥', type: 'select', value: 'dry', options: [
        { value: 'dry', label: '干燥的集气瓶' },
        { value: 'wet', label: '瓶壁有水珠（未干燥）' }
      ] }
    ],
    react: function (p) {
      var m = clamp(pn(p, 'mg', 1), 0.01, 50);
      var V = clamp(pn(p, 'bottle', 1), 0.05, 50);
      var co2 = isSel(p, 'atmos', 'co2');
      var dry = isSel(p, 'dry', 'dry');
      var nMg = m / M_MG;
      var nCO2 = V / VM;
      var nR = co2 ? Math.min(nMg, 2 * nCO2) : 0;         /* 按 CO2 限量计算反应的镁 */
      var mMgO = nR * M_MGO * (co2 ? 1 : 0.94);            /* 空气中主要也是 MgO（另有少量 Mg3N2） */
      var mC = nR / 2 * M_C;
      var ph = [];
      if (!co2) {
        ph.push('镁条在空气中剧烈燃烧，发出耀眼的白光，放出大量的热');
        ph.push('生成白色粉末（MgO，主要产物），瓶壁上还能看到少量淡黄绿色的固体（Mg₃N₂，镁与 N₂ 反应的产物）');
        ph.push('没有黑色固体生成 —— 空气里没有能被镁还原出碳的 CO₂（体积分数只有约 0.03%）');
        ph.push('理论生成 MgO 约 ' + fx(mMgO, 2) + ' g（按 ' + fx(m, 2) + ' g 镁计算）');
        ph.push('对比结论：把瓶内换成 CO₂，现象会多出"黑色固体"这一条 —— 这就是下面这个反常识实验的关键');
      } else {
        ph.push('点燃的镁条伸入 CO₂ 后继续剧烈燃烧（CO₂ 不但没有熄灭它，反而支持了燃烧），发出耀眼的白光');
        ph.push('集气瓶内壁附着一层黑色固体小颗粒（被还原出来的碳单质）');
        ph.push('瓶底出现白色粉末（MgO），瓶壁发烫，放出大量的热');
        ph.push('反应消耗了瓶内的 CO₂，冷却后瓶内压强减小（把瓶塞塞紧的话会感到不易拔出）');
        if (nMg > 2 * nCO2 + 1e-9) {
          ph.push('镁条过量：瓶内的 CO₂ 全部被消耗后，剩下的镁就不能继续在 CO₂ 中燃烧' +
            '（本次 CO₂ ' + fx(nCO2, 4) + ' mol 只能消耗镁 ' + fx(2 * nCO2, 4) + ' mol）');
        } else {
          ph.push('镁条能把瓶内 CO₂ 还原：n(Mg) = ' + fx(nMg, 4) + ' mol，n(CO₂) = ' + fx(nCO2, 4) +
            ' mol，两者按 2 : 1 反应（CO₂ 足量）');
        }
        ph.push('理论生成白色的 MgO 约 ' + fx(mMgO, 2) + ' g、黑色的碳约 ' + fx(mC, 2) + ' g');
        ph.push('★ 结论：CO₂ 不能扑灭镁（以及钠、钾等活泼金属）引起的火灾，要用干燥沙土覆盖');
      }
      if (!dry) {
        ph.push('瓶壁没有干燥、附着水珠：水珠会被高温汽化，还可能与镁反应（Mg + 2H2O = Mg(OH)2 + H2↑），' +
          '使"黑色固体"的观察受到干扰，也增加了爆裂的危险');
      }
      ph.push('安全：镁燃烧的强光含大量紫外线，绝不能直视（会灼伤眼睛）');
      return {
        phenomena: ph,
        equation: '2Mg + CO2 = 2MgO + C',
        ionic: '',
        type: '置换反应（镁在二氧化碳中燃烧，属于氧化还原反应）',
        conditions: co2 ? '点燃（镁条点燃后伸入盛满 CO₂ 的集气瓶）' : '点燃（镁条在空气中燃烧，对比实验）',
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var m = clamp(pn(p, 'mg', 1), 0.01, 50);
      var V = clamp(pn(p, 'bottle', 1), 0.05, 50);
      var co2 = isSel(p, 'atmos', 'co2');
      var nMg = m / M_MG, nCO2 = V / VM;
      var nR = co2 ? Math.min(nMg, 2 * nCO2) : nMg;
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：' + (co2
          ? '点燃的镁条在 CO₂ 中继续剧烈燃烧 —— 2Mg + CO2 = 2MgO + C。现象是"发出耀眼的白光、放出大量的热、' +
            '瓶壁附着黑色固体（碳）、瓶底有白色粉末（MgO）"。本次镁 ' + fx(m, 2) + ' g（' + fx(nMg, 4) +
            ' mol）、CO₂ ' + fx(V, 1) + ' L（' + fx(nCO2, 4) + ' mol），' +
            (nMg > 2 * nCO2 ? '镁过量，CO₂ 先被耗尽，' : 'CO₂ 足量，') +
            '理论生成 MgO 约 ' + fx(nR * M_MGO, 2) + ' g、碳约 ' + fx(nR / 2 * M_C, 2) + ' g。'
          : '镁条在空气中燃烧（对比实验），主要生成白色 MgO、还有少量淡黄绿色的 Mg₃N₂。') +
          '这个"反常识"反应说明两件事：① 燃烧不一定需要氧气参加；' +
          '② CO₂ 不能扑灭镁等活泼金属的火灾（镁能把 CO₂ 还原出碳），活泼金属着火要用干燥沙土覆盖。' +
          '做这个实验必须在通风处、不能直视强光。',
        equation: '2Mg + CO2 = 2MgO + C',
        ionic: '',
        errors: ['集气瓶里的 CO₂ 没收集满（混有空气）：产物中会混有 Mg₃N₂，黑色碳也变少，现象不纯',
          '集气瓶没有干燥、瓶壁有水珠：高温下水与镁反应生成 H₂，可能爆裂，也干扰黑色固体的观察',
          '直视镁条燃烧的强光：强光含大量紫外线，会灼伤眼睛（必须保持距离并戴护目镜）',
          '用 CO₂ 灭火器去扑灭镁燃烧：镁能在 CO₂ 中继续燃烧，灭火器反而"助燃"（必须用干燥沙土）',
          '把产物说成"只有白色粉末"：还必须能看到黑色的碳，两者都是本反应的特征现象']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var m = clamp(pn(p, 'mg', 1), 0.01, 50);
      var V = clamp(pn(p, 'bottle', 1), 0.05, 50);
      var co2 = isSel(p, 'atmos', 'co2');
      var dry = isSel(p, 'dry', 'dry');
      var nMg = m / M_MG, nCO2 = V / VM;
      var nR = co2 ? Math.min(nMg, 2 * nCO2) : nMg;
      var ph = (state && state.phase) || 0;
      txt(g, '镁在' + (co2 ? '二氧化碳' : '空气') + '中燃烧', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, co2 ? '2Mg + CO2 = 2MgO + C（点燃）' : '2Mg + O2 = 2MgO（点燃，对比）',
        s.X(40), s.Y(70), Math.round(s.Z(14)), 'rgba(38,34,28,.7)');
      txt(g, '镁条 ' + fx(m, 2) + ' g · 瓶内 ' + fx(V, 1) + ' L ' + (co2 ? 'CO₂' : '空气'),
        s.X(40), s.Y(92), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      /* 集气瓶 */
      var bx = s.X(230), by = s.Y(170), bw = s.Z(230), bh = s.Z(230), neck = s.Z(56);
      seg(g, bx, by, bx, by + bh, L, 2);
      seg(g, bx + bw, by, bx + bw, by + bh, L, 2);
      seg(g, bx, by + bh, bx + bw, by + bh, L, 2);
      seg(g, bx, by, bx + neck, by, L, 2);
      seg(g, bx + bw - neck, by, bx + bw, by, L, 2);
      if (co2) {
        /* CO₂ 无色：用淡点示意 + 标注 */
        box(g, bx + s.Z(3), by + s.Z(3), bw - s.Z(6), bh - s.Z(6), 'rgba(120,150,170,.12)', true);
        txt(g, 'CO₂（无色）', bx + s.Z(12), by + s.Z(26), Math.round(s.Z(12.5)), 'rgba(38,34,28,.5)');
      }
      /* 镁条 */
      var mx = bx + bw * 0.5;
      seg(g, mx, s.Y(120), mx, by + bh - s.Z(46), 'rgba(190,190,196,.98)', 4);
      seg(g, mx - s.Z(30), s.Y(112), mx + s.Z(30), s.Y(112), 'rgba(38,34,28,.75)', 3);
      /* 白光 + 火星 */
      star(g, mx, by + s.Z(86), s.Z(14), s.Z(46), 16, 'rgba(255,250,226,.95)', ph);
      sparks(g, 211, mx, by + s.Z(86), s.Z(60), 20, ph, 'rgba(255,214,120,.9)', s.Z(12));
      /* 白色粉末（瓶底）与黑色碳（瓶壁） */
      if (co2) {
        box(g, bx + s.Z(6), by + bh - s.Z(12), bw - s.Z(12), s.Z(10), 'rgba(246,246,242,.95)', true);
        var r4 = rnd(223), i4;
        for (i4 = 0; i4 < 40; i4++) {
          circ(g, bx + s.Z(8) + r4() * (bw - s.Z(16)), by + s.Z(10) + r4() * (bh - s.Z(26)), s.Z(1.6) + r4() * s.Z(1.2),
            'rgba(34,30,26,.85)', true);
        }
        txt(g, '瓶壁：黑色固体（碳）', bx + bw + s.Z(14), by + s.Z(50), Math.round(s.Z(12.5)), 'rgba(38,34,28,.85)');
        txt(g, '瓶底：白色粉末（MgO）', bx + bw + s.Z(14), by + bh - s.Z(10), Math.round(s.Z(12.5)), 'rgba(38,34,28,.85)');
      } else {
        box(g, bx + s.Z(6), by + bh - s.Z(12), bw - s.Z(12), s.Z(10), 'rgba(246,246,242,.95)', true);
        var r5 = rnd(227), i5;
        for (i5 = 0; i5 < 16; i5++) {
          circ(g, bx + s.Z(8) + r5() * (bw - s.Z(16)), by + s.Z(10) + r5() * (bh - s.Z(26)), s.Z(1.8),
            'rgba(196,206,110,.85)', true);
        }
        txt(g, '白色 MgO（主要）+ 少量黄绿色 Mg₃N₂', bx + bw + s.Z(14), by + s.Z(50),
          Math.round(s.Z(12.5)), 'rgba(38,34,28,.85)');
        txt(g, '没有黑色固体（空气中没有足够的 CO₂）', bx + bw + s.Z(14), by + s.Z(74),
          Math.round(s.Z(12.5)), 'rgba(38,34,28,.7)');
      }
      if (!dry) {
        var r6 = rnd(229), i6;
        for (i6 = 0; i6 < 18; i6++) {
          circ(g, bx + s.Z(6) + r6() * (bw - s.Z(12)), by + s.Z(6) + r6() * (bh - s.Z(12)), s.Z(1.8),
            'rgba(90,140,190,.7)', true);
        }
        txt(g, '瓶壁有水珠（未干燥）→ 干扰观察、有爆裂危险', bx, by + bh + s.Z(26),
          Math.round(s.Z(12.5)), 'rgba(170,50,40,.9)');
      }
      /* 结论 */
      var cx2 = s.X(520), cy2 = s.Y(170);
      txt(g, '反常识在哪里？', cx2, cy2, Math.round(s.Z(15)), L, 'left', true, true);
      seg(g, s.X(520), cy2 + s.Z(8), s.X(720), cy2 + s.Z(8), 'rgba(38,34,28,.35)', 1);
      txt(g, '· CO₂ 一般不支持燃烧，但镁能在其中继续燃烧', cx2, cy2 + s.Z(34), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '· 燃烧不一定需要氧气参加', cx2, cy2 + s.Z(56), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '· 黑色固体是碳（CO₂ 中的碳被还原）', cx2, cy2 + s.Z(78), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '· MgO 约 ' + fx(nR * M_MGO, 2) + ' g，C 约 ' + fx(nR / 2 * M_C, 2) + ' g',
        cx2, cy2 + s.Z(100), Math.round(s.Z(12.5)), 'rgba(38,34,28,.7)');
      txt(g, '结论：CO₂ 不能扑灭镁火灾', cx2, cy2 + s.Z(140), Math.round(s.Z(13.5)), 'rgba(170,50,40,.9)', 'left', true, true);
      txt(g, '活泼金属着火用干燥沙土覆盖', cx2, cy2 + s.Z(162), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, '安全：不可直视镁燃烧的强光', cx2, cy2 + s.Z(192), Math.round(s.Z(12.5)), 'rgba(38,34,28,.7)');
    }
  });

  /* ==========================================================================
   * 10 · cu-hno3   铜与浓 / 稀硝酸（产物不同）
   * ======================================================================== */
  window.QG_CLAB.register('cu-hno3', {
    id: 'cu-hno3',
    name: '铜与浓硝酸、稀硝酸的反应',
    group: GROUP,
    aim: '对比铜与浓、稀硝酸的产物与现象（红棕色 NO₂ / 无色 NO 遇空气变红棕色），写出两个方程式与离子方程式，理解浓硝酸的强氧化性',
    principle: 'Cu + 4HNO3(浓) = Cu(NO3)2 + 2NO2↑ + 2H2O（铜与浓硝酸）；' +
      '3Cu + 8HNO3(稀) = 3Cu(NO3)2 + 2NO↑ + 4H2O（铜与稀硝酸）。' +
      '硝酸是强氧化性酸，无论浓稀都能与铜反应，且都不放出氢气，被还原的是氮：' +
      '浓硝酸被还原成红棕色的 NO₂（有刺激性气味），稀硝酸被还原成无色的 NO；' +
      'NO 不溶于水，逸出后遇到空气立即被氧化：2NO + O2 = 2NO2，气体由无色变成红棕色 —— 这是检验 NO 的经典方法。' +
      '反应后溶液显蓝色（Cu²⁺）；浓硝酸的实验中溶液常呈绿色，是因为生成的 NO₂ 溶在溶液里，' +
      '加少量水稀释后 NO₂ 与水反应（3NO2 + H2O = 2HNO3 + NO），溶液又变回蓝色。' +
      '浓硝酸与铜在常温下反应就非常剧烈；稀硝酸反应较慢（可微热加快）。' +
      'NO、NO₂ 都是大气污染物，尾气必须用 NaOH 溶液吸收。',
    apparatus: ['试管', '铜片（或铜丝）', '浓硝酸', '稀硝酸', '橡胶塞', '胶头滴管', 'NaOH 溶液（尾气吸收）', '水浴'],
    steps: ['取两支试管，分别加入约 2 mL 浓硝酸和稀硝酸，各放入一小块铜片（用橡胶塞塞住管口）',
      '观察两支试管中气泡的快慢、气体的颜色与溶液颜色的变化',
      '把稀硝酸试管中逸出的气体暴露在空气中（或鼓入空气），观察颜色变化',
      '反应后向浓硝酸的试管中加少量水稀释，观察溶液颜色',
      '尾气通入 NaOH 溶液吸收'],
    params: [
      { key: 'mode', label: '硝酸浓度', type: 'select', value: 'conc', options: [
        { value: 'conc', label: '浓硝酸（约 15 mol/L）' },
        { value: 'dil', label: '稀硝酸（约 2~5 mol/L）' }
      ] },
      { key: 'cu', label: '铜片质量', unit: 'g', min: 0.1, max: 3, step: 0.1, value: 1 },
      { key: 'temp', label: '温度', unit: '℃', min: 20, max: 80, step: 5, value: 25 },
      { key: 'water', label: '反应后加水稀释', type: 'select', value: 'no', options: [
        { value: 'no', label: '不加水' },
        { value: 'add', label: '加少量水稀释' }
      ] }
    ],
    react: function (p) {
      var conc = isSel(p, 'mode', 'conc');
      var mCu = clamp(pn(p, 'cu', 1), 0.01, 50);
      var T = clamp(pn(p, 'temp', 25), 0, 120);
      var addW = isSel(p, 'water', 'add');
      var nCu = mCu / M_CU;
      var nGas = conc ? 2 * nCu : 2 * nCu / 3;      /* NO₂ 或 NO 的理论物质的量（按铜完全反应） */
      var vGas = nGas * VM * 1000;                  /* mL（标准状况） */
      var fast = conc || T >= 45;
      var ph = [];
      if (conc) {
        ph.push('铜片表面立即产生大量气泡，反应剧烈进行（试管发热，铜片逐渐变小、溶解）');
        ph.push('试管内液面上方出现红棕色气体（NO₂），有刺激性气味');
        ph.push('溶液很快变绿（生成 Cu²⁺ 的蓝色与溶在其中的 NO₂ 的颜色叠加）');
        ph.push('理论生成 NO₂ 约 ' + fx(vGas, 0) + ' mL（标准状况，' + fx(mCu, 2) + ' g Cu = ' +
          fx(nCu, 4) + ' mol，按铜完全反应计）');
        ph.push(T >= 45 ? '温度较高（' + fx(T, 0) + ' ℃）：反应更加剧烈，红棕色气体放出得更快'
          : '常温（' + fx(T, 0) + ' ℃）下浓硝酸与铜反应就已经非常剧烈');
        if (addW) {
          ph.push('加少量水稀释后，溶在溶液里的 NO₂ 与水反应（3NO2 + H2O = 2HNO3 + NO），绿色褪去、溶液变为蓝色');
        } else {
          ph.push('若不加水稀释，溶液一直呈绿色，容易被误认为"Cu²⁺ 是绿色的"（Cu²⁺ 的水合离子是蓝色的）');
        }
      } else {
        ph.push('铜片表面缓慢产生无色气泡（NO），反应明显比浓硝酸慢');
        if (fast) ph.push('温度较高（' + fx(T, 0) + ' ℃），气泡产生明显加快（升温加快反应速率）');
        ph.push('试管内上方气体无色（NO 不溶于水，是无色气体）');
        ph.push('把气体暴露在空气中（或鼓入空气）：气体立即由无色变成红棕色（2NO + O2 = 2NO2）');
        ph.push('溶液慢慢变蓝（Cu²⁺ 的水合离子显蓝色）');
        ph.push('理论生成 NO 约 ' + fx(vGas, 0) + ' mL（标准状况，' + fx(mCu, 2) + ' g Cu = ' +
          fx(nCu, 4) + ' mol，按铜完全反应计）');
        if (!fast) ph.push('常温下稀硝酸与铜反应较慢，实验时常微微加热以加快反应');
        ph.push(addW ? '加水稀释后溶液仍是蓝色（Cu²⁺），不会出现浓硝酸实验里那种"绿色"'
          : '不加水的稀硝酸实验里溶液一直是蓝色（Cu²⁺ 的水合离子）');
      }
      ph.push('注意：铜与浓、稀硝酸反应都不放出氢气（硝酸是氧化性酸，被还原的是氮）');
      ph.push('NO、NO₂ 都有毒，尾气必须通入 NaOH 溶液吸收');
      return {
        phenomena: ph,
        equation: conc ? 'Cu + 4HNO3 = Cu(NO3)2 + 2NO2↑ + 2H2O' : '3Cu + 8HNO3 = 3Cu(NO3)2 + 2NO↑ + 4H2O',
        ionic: conc ? 'Cu + 4H+ + 2NO3- = Cu2+ + 2NO2↑ + 2H2O'
          : '3Cu + 8H+ + 2NO3- = 3Cu2+ + 2NO↑ + 4H2O',
        type: '氧化还原反应（金属与氧化性酸反应，硝酸被还原）',
        conditions: conc ? '常温（浓硝酸，反应剧烈）'
          : ('常温' + (T >= 45 ? '并加热到 ' + fx(T, 0) + ' ℃' : '（稀硝酸反应较慢，可微热加快）')),
        measures: {}
      };
    },
    columns: [],
    graph: null,
    conclude: function (rows, p) {
      var conc = isSel(p, 'mode', 'conc');
      var mCu = clamp(pn(p, 'cu', 1), 0.01, 50);
      var T = clamp(pn(p, 'temp', 25), 0, 120);
      var addW = isSel(p, 'water', 'add');
      var nCu = mCu / M_CU;
      var n = rows && rows.length ? rows.length : 0;
      return {
        text: '做了 ' + n + ' 次观察：铜与硝酸反应，浓稀不同产物就不同 —— ' +
          (conc ? 'Cu + 4HNO3 = Cu(NO3)2 + 2NO2↑ + 2H2O（浓硝酸）'
            : '3Cu + 8HNO3 = 3Cu(NO3)2 + 2NO↑ + 4H2O（稀硝酸）') + '。' +
          (conc ? '现象是"反应剧烈、放出红棕色的 NO₂、溶液变绿' + (addW ? '，加水稀释后变蓝' : '') + '"；'
            : '现象是"缓慢放出无色的 NO、溶液变蓝、气体遇空气立即变红棕色"；') +
          '本次铜片 ' + fx(mCu, 2) + ' g（' + fx(nCu, 4) + ' mol），温度 ' + fx(T, 0) + ' ℃，' +
          '理论上放出 ' + (conc ? 'NO₂' : 'NO') + ' 约 ' + fx((conc ? 2 * nCu : 2 * nCu / 3) * VM * 1000, 0) +
          ' mL（标准状况）。两个反应都说明硝酸是氧化性酸：' +
          '它跟铜反应都不放氢气，被还原的是氮（浓 → NO₂，稀 → NO）；' +
          'NO 遇空气变红棕色（2NO + O2 = 2NO2）正是检验 NO 的方法。' +
          '浓硝酸中溶液显绿色是溶有 NO₂ 的缘故，加少量水后 NO₂ 与水反应，溶液才显示 Cu²⁺ 的蓝色。',
        equation: conc ? 'Cu + 4HNO3 = Cu(NO3)2 + 2NO2↑ + 2H2O' : '3Cu + 8HNO3 = 3Cu(NO3)2 + 2NO↑ + 4H2O',
        ionic: conc ? 'Cu + 4H+ + 2NO3- = Cu2+ + 2NO2↑ + 2H2O'
          : '3Cu + 8H+ + 2NO3- = 3Cu2+ + 2NO↑ + 4H2O',
        errors: ['试管里有空气就把稀硝酸的实验做完：NO 立刻被氧化成红棕色的 NO₂，看不到"无色气体"，' +
          '应先把装置中的空气排尽（或用教材的铜丝上下移动法控制反应）',
          '把浓硝酸实验中"绿色的溶液"当成 Cu²⁺ 的颜色：绿色是溶有 NO₂ 造成的，加少量水后变蓝才是 Cu²⁺',
          '把铜与硝酸的反应写成放出氢气（如 Cu + 2HNO3 = Cu(NO3)2 + H2↑）：硝酸是氧化性酸，产物是 NO₂ 或 NO',
          'NO₂ 尾气直接排入空气：NO₂ 有毒且有刺激性气味，必须用 NaOH 溶液吸收',
          '稀硝酸与铜反应时长时间不观察：反应较慢，若不微热或不耐心观察会误判为"不反应"']
      };
    },
    draw: function (g, p, state) {
      var s = scene(g), L = ink(g);
      var conc = isSel(p, 'mode', 'conc');
      var mCu = clamp(pn(p, 'cu', 1), 0.01, 50);
      var T = clamp(pn(p, 'temp', 25), 0, 120);
      var addW = isSel(p, 'water', 'add');
      var ph = (state && state.phase) || 0;
      var green = conc && !addW;
      txt(g, '铜与' + (conc ? '浓' : '稀') + '硝酸的反应', s.X(40), s.Y(46), Math.round(s.Z(20)), L, 'left', true, true);
      txt(g, conc ? 'Cu + 4HNO3(浓) = Cu(NO3)2 + 2NO2↑ + 2H2O'
        : '3Cu + 8HNO3(稀) = 3Cu(NO3)2 + 2NO↑ + 4H2O',
        s.X(40), s.Y(70), Math.round(s.Z(13)), 'rgba(38,34,28,.7)');
      txt(g, '铜 ' + fx(mCu, 2) + ' g · ' + fx(T, 0) + ' ℃ · ' + (conc ? '反应剧烈' : '反应较慢') +
        (addW ? ' · 已加水稀释' : ''), s.X(40), s.Y(92), Math.round(s.Z(12.5)), 'rgba(38,34,28,.6)');
      /* 试管 */
      var cx = s.X(250), top = s.Y(130), tw = s.Z(120), th = s.Z(300), bot = top + th - tw / 2, lt = top + s.Z(50);
      tube(g, cx, top, tw, th);
      /* 溶液：浓+不加水 → 绿；否则蓝 */
      liq(g, cx - tw / 2 + s.Z(2), lt, tw - s.Z(4), bot - lt - s.Z(1),
        green ? 'rgba(80,170,110,.6)' : 'rgba(58,110,206,.55)');
      /* 铜片 */
      box(g, cx - s.Z(26), bot - s.Z(26), s.Z(52), s.Z(12), 'rgba(184,104,62,.95)', true);
      box(g, cx - s.Z(26), bot - s.Z(26), s.Z(52), s.Z(12), 'rgba(38,34,28,.7)', false, 1.2);
      /* 气泡 */
      bubblesUp(g, conc ? 401 : 409, cx - tw / 2 + s.Z(8), cx + tw / 2 - s.Z(8), lt + s.Z(6),
        bot - s.Z(22), conc ? 26 : 10, ph, 'rgba(38,34,28,.5)', s.Z(3.2), s.Z(1.2));
      /* 液面上方的气体 */
      if (conc) {
        puff(g, 421, cx, top + s.Z(26), s.Z(34), 26, 'rgba(168,72,40,.6)', 0.6);
        txt(g, '红棕色 NO₂（有刺激性气味）', cx + tw / 2 + s.Z(16), top + s.Z(30), Math.round(s.Z(12.5)), 'rgba(150,60,30,.95)');
      } else {
        txt(g, '无色气体 NO', cx + tw / 2 + s.Z(16), top + s.Z(30), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
        /* 遇空气变红棕：一支小试管/导管 */
        var sx = cx + tw / 2 + s.Z(130), sy = top + s.Z(48);
        seg(g, cx + tw / 2, top + s.Z(24), sx, sy, 'rgba(38,34,28,.6)', 2);
        puff(g, 431, sx + s.Z(20), sy, s.Z(16), 16, 'rgba(168,72,40,.55)', 0.55);
        txt(g, '遇空气立即变红棕色', sx + s.Z(2), sy + s.Z(34), Math.round(s.Z(12)), 'rgba(150,60,30,.95)');
        txt(g, '2NO + O2 = 2NO2', sx + s.Z(2), sy + s.Z(54), Math.round(s.Z(12)), 'rgba(38,34,28,.8)');
      }
      /* 溶液颜色说明 */
      var rx = s.X(430), ry = s.Y(300);
      txt(g, '溶液颜色', rx, ry, Math.round(s.Z(14)), L, 'left', true, true);
      seg(g, rx, ry + s.Z(8), s.X(720), ry + s.Z(8), 'rgba(38,34,28,.35)', 1);
      if (green) {
        txt(g, '绿色 = Cu²⁺ 的蓝 + 溶在溶液里的 NO₂', rx, ry + s.Z(32), Math.round(s.Z(12.5)), 'rgba(38,34,28,.85)');
        txt(g, '加少量水稀释后变为蓝色（Cu²⁺）', rx, ry + s.Z(54), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
        txt(g, '3NO2 + H2O = 2HNO3 + NO', rx, ry + s.Z(76), Math.round(s.Z(12.5)), 'rgba(38,34,28,.7)');
      } else {
        txt(g, '蓝色 = Cu²⁺ 的水合离子', rx, ry + s.Z(32), Math.round(s.Z(12.5)), 'rgba(38,34,28,.85)');
        if (conc) txt(g, '（加水后 NO₂ 与水反应，绿色褪去）', rx, ry + s.Z(54), Math.round(s.Z(12.5)), 'rgba(38,34,28,.7)');
      }
      txt(g, '都不放出氢气：硝酸是氧化性酸', rx, ry + s.Z(112), Math.round(s.Z(13)), L, 'left', true, true);
      txt(g, '浓 → NO₂（红棕色）；稀 → NO（无色）', rx, ry + s.Z(134), Math.round(s.Z(12.5)), 'rgba(38,34,28,.8)');
      txt(g, 'NO₂ / NO 有毒 → 尾气用 NaOH 吸收', rx, ry + s.Z(164), Math.round(s.Z(12.5)), 'rgba(170,50,40,.9)');
    }
  });
})();
