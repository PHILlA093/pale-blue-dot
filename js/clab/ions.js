/* ============================================================================
 * 穷观 · 化学实验台 —— 组 1 · 离子反应与溶液平衡（js/clab/ions.js）
 * Build ID: QG-20260920-5e5d5a      （穷观原创指纹，请勿删除/改写）
 * © 2026 PHILlA093 · 原创作品 · 保留所有权利
 * ----------------------------------------------------------------------------
 * 本文件只做一件事：向化学实验台注册表登记 9 个反应
 *     window.QG_CLAB.register(id, spec)
 * 不自建 DOM、不起循环、不读写全局状态（惰性，与 js/pslab/*.js、js/clab/*.js 一致）。
 * 纯 ES5（无箭头函数 / let / const / 模板串 / class / eval / new Function）、
 * 零依赖、不联网（守观澜的严格 CSP）。
 *
 * ── 契约依据 ────────────────────────────────────────────────────────────────
 *   docs/化学实验台设计.md §2 组 1 · 离子反应与溶液平衡（9 个 id，逐字）
 *       agcl-precip / baso4-precip / cuoh2-precip / feoh3-precip /
 *       carbonate-acid / ammonium-alkali / hydrolysis /
 *       precipitate-convert / complex-ion
 *                          §3 register(id, spec) 的字段与 react() 的返回值
 *                          §4 每个反应的验收（1~8 条）
 *   docs/物理实验台设计.md §9 实现约定补充（逐条照做）：
 *      ① null =「这次观察在这张图上没有有效值」，**不是 0**（核心跳过该行、不进 r²）；
 *      ② g.font 是宽容签名（(size) / (size,bool) / (size,'italic bold') / (size,italic,bold)）；
 *      ③ 滑块 step 会被归一化，register 时做参数体检，warning 进 state().warnings；
 *      ④ 没有 min/max 的参数必须写 type:'select'（本文件大量使用：试液种类、加什么酸、
 *         铁的价态、滴加顺序、水解的盐、配体体系、是否加热…）。
 *   另两条判据事实：r² 只在「扫自变量」时才有意义；定量列必须能作图。
 *
 * ── react() 的返回（契约 §3）───────────────────────────────────────────────
 *   { phenomena:[…≥2], equation:'…', ionic:'…', type:'…', conditions:'…', measures:{…} }
 *   **equation 一律配平**（核心 balance() 逐元素 + 电荷核对，标红即不合格）。
 *   measures 的键与 columns 的键一一对应；columns 为空数组 = 纯定性反应，
 *   此时 graph 必须写 null（§3：「纯定性反应：columns:[]、graph:null 合法」）。
 *   本组：6 个给定量列 + 图（agcl / baso4 / cuoh2 / hydrolysis /
 *   precipitate-convert / complex-ion），3 个纯定性（feoh3-precip /
 *   carbonate-acid / ammonium-alkali）。
 *
 * ── 三个刻意的设计决定（都写清楚了，别当成疏漏）────────────────────────────
 *  ① **沉淀类反应的 graph 横轴取「生成的沉淀的物质的量 nPre」而不是「加入量」。**
 *     若把横轴写成"加入的 Ag⁺/Ba²⁺/OH⁻ 的量"，曲线会在某一方过量时出现**平台**——
 *     那是真实而且重要的化学（限量试剂），但它**不是直线**，r² 就不该按直线读。
 *     本台的处理：**图只保留严格成正比的 m–n 关系（斜率即摩尔质量）**，
 *     而"谁是限制试剂、反应有没有进行完全"交给 columns 里的 nLimit / complete
 *     两列与结论卡承载。这样任何一个参数被扫描时，点都落在同一条过原点直线上。
 *  ② **水解的温度效应只用教材里查得到的三个数**（Kw(25 ℃)=1.0×10⁻¹⁴、
 *     中和热 57.3 kJ/mol、"电离常数随温度变化不大"），按 van't Hoff 外推：
 *         Kw(T) = Kw(298)·exp[ (ΔH/R)·(1/298 − 1/T) ]，ΔH = +57.3 kJ/mol（水解吸热）
 *         Kh(T) = Kw(T)/Ka（或 /Kb），Ka、Kb 取 25 ℃ 值不随温度变（教材原话）
 *     实测这个外推在 50 ℃ 给出 pKw = 13.22（手册值 13.26），够用。
 *     **Fe³⁺ 的水解常数教材没给**（人教版附录Ⅱ 只有弱酸弱碱表），所以
 *     `fecl3` 的 pH 返回 **null**（约定①：本台不编数值），改用**可由教材 Ksp 严格
 *     算出**的 `pHpre`（使 Fe³⁺ 开始沉淀为 Fe(OH)₃ 的 pH）承担 FeCl₃ 的定量内容；
 *     Fe³⁺ 第一步水解的 Ka₁ 另在 [S6] 有权威编译值，本文件只用它做**文字说明**，
 *     不拿它当 pH 的计算依据。
 *  ③ **所有格式化入口只认 `typeof x === 'number' && isFinite(x)`**（`qgIsNum`）。
 *     别写 `!isFinite(x)` 单独当守卫 —— `isFinite(null) === true`、`isFinite('') === true`，
 *     null 会被"当成 0"穿过守卫，然后在 `x.toExponential()` 上抛 TypeError。
 *     这条不是理论风险：把 `precipitate-convert` 的「AgNO₃ 浓度」推到滑块上界 0.20
 *     （其余默认）时，n(Ag⁺) = 0.20×2×0.05 与 n(I⁻) = 0.100×4×0.05 **是同一个 IEEE754 值**
 *     → 旧模型在"沉淀剂恰好等于化学计量"这一点给出 c(Ag⁺) = null → `react()` 记
 *     `lastError: react: Cannot read properties of null (reading 'toExponential')`、
 *     现象表不出行、结论卡"暂时填不出来"、画布底部红字`绘图出错`。
 *     现在的两道防线：**① 模型层不再产生 null**（无过量化沉淀剂时按"AgX 自身溶解"解出
 *     正数浓度：1:1 型解 c² + c过量·c − Ksp = 0，2:1 型退化为 ∛(2Ksp)）；
 *     **② 格式化层对任何非数值一律回落到 '—'**（`qgSig` 回落 `null` = 约定① 的"无有效值"）。
 *     回归闸门：`%TEMP%\qg_clab_ions\scan.js`（每个反应 ≥66 组参数组合，共 636 组）。
 *
 * ── 化学事实的来源（逐条核对过；PDF 一律用 Invoke-WebRequest 下载后抽取全文）──
 *  [S1] 人教版《普通高中教科书·化学 必修 第一册》（2019）——**全文**（PDF 139 页抽取）
 *       https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master/高中/化学/人教版-人民教育出版社/普通高中教科书·化学必修%20第一册.pdf
 *       · 实验 2-9 氯离子的检验：三支试管分装稀盐酸 / NaCl / Na₂CO₃，各滴 AgNO₃
 *         「三支试管中都有白色沉淀生成。前两支试管中的白色沉淀**不溶于稀硝酸**，
 *          这是 AgCl 沉淀；第三支试管中的沉淀溶于稀硝酸，这是 Ag₂CO₃ 沉淀」
 *         「Cl⁻ + Ag⁺ = AgCl↓」「CO₃²⁻ + 2Ag⁺ = Ag₂CO₃↓」
 *         「Ag₂CO₃ + 2H⁺ = 2Ag⁺ + CO₂↑ + H₂O」
 *         「用 AgNO₃ 溶液检验 Cl⁻ 时，一般先在被检测的溶液中滴入适量稀硝酸，使其
 *          酸化，以排除 CO₃²⁻ 等的干扰，然后滴入 AgNO₃ 溶液」
 *       · 第一章封面图注「将 CuCl₂ 溶液滴入 NaOH 溶液中形成的蓝色絮状 Cu(OH)₂ 沉淀」；
 *         习题「Cu²⁺ + 2OH⁻ = Cu(OH)₂↓」
 *       · 实验 3-1：FeCl₃ + NaOH 生成**红褐色** Fe(OH)₃；FeSO₄ + NaOH 的白色絮状
 *         Fe(OH)₂「迅速变成灰绿色，过一段时间后还会有红褐色物质生成」
 *         （4Fe(OH)₂ + O₂ + 2H₂O = 4Fe(OH)₃）
 *       · 「加热 Fe(OH)₃ 时，它能失去水生成红棕色的 Fe₂O₃ 粉末：2Fe(OH)₃ = Fe₂O₃ + 3H₂O」
 *       · 实验 3-2：「含有 Fe³⁺ 的盐溶液遇到 KSCN 溶液时变成红色」
 *       · 习题：Cu → CuO → CuSO₄ → Cu(OH)₂ → CuSO₄ → Cu 的转化关系
 *  [S2] 人教版《化学 必修 第二册》（2019）——**全文**（PDF 139 页抽取）
 *       https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master/高中/化学/人教版-人民教育出版社/普通高中教科书·化学必修%20第二册.pdf
 *       · 实验 5-4 硫酸根离子的检验：「在溶液中，SO₄²⁻ 可与 Ba²⁺ 反应，生成**不溶于
 *         稀盐酸的白色 BaSO₄ 沉淀**。Ba²⁺ + SO₄²⁻ = BaSO₄↓」；
 *         「硫酸钡不溶于水和酸……医疗上可被用作消化系统 X 射线检查的内服药剂，俗称'钡餐'」；
 *         安全提示「BaCl₂、Ba(OH)₂ 等可溶性钡的化合物和 BaCO₃ **有毒**」
 *       · 氨与铵盐：「氨是**无色、有刺激性气味**的气体，密度比空气的小」
 *         「氨的水溶液（俗称氨水）显弱碱性，能使酚酞溶液变红或使**红色石蕊试纸变蓝**」
 *         「NH₃ + HCl = NH₄Cl」
 *       · 实验 5-7：「向盛有少量 NH₄Cl 溶液、NH₄NO₃ 溶液和 (NH₄)₂SO₄ 溶液的三支试管
 *         中分别加入 NaOH 溶液**并加热**（注意通风），用镊子夹住一片**湿润的红色石蕊
 *         试纸放在试管口**」；「NH₄⁺ + OH⁻ = NH₃↑ + H₂O」（条件：△）
 *  [S3] 人教版《化学 选择性必修1 化学反应原理》（2019）——**全文**（PDF 139 页抽取）
 *       https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master/高中/化学/人教版-人民教育出版社/普通高中教科书·化学选择性必修1%20化学反应原理.pdf
 *       · 第三节 盐类的水解：「强酸强碱盐的溶液呈中性，**强酸弱碱盐的溶液呈酸性，
 *         强碱弱酸盐的溶液呈碱性**」；探究用盐：NaCl、Na₂CO₃、NH₄Cl、KNO₃、
 *         CH₃COONa、(NH₄)₂SO₄
 *       · 「NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺」（NH₄Cl 溶液显酸性）；
 *         「CO₃²⁻ + H₂O ⇌ HCO₃⁻ + OH⁻」「HCO₃⁻ + H₂O ⇌ H₂CO₃ + OH⁻」
 *       · 「**Na₂CO₃ 第二步水解的程度很小，平衡时溶液中 H₂CO₃ 的浓度很小，
 *          不会放出 CO₂ 气体**」（本文件 carbonate-acid 的一条注意事项）
 *       · 「加热可促使平衡向水解反应的方向移动，盐的水解程度增大；
 *          **加水稀释可促使平衡向水解反应的方向移动**，盐的水解程度增大」
 *       · 「配制 FeCl₃ 溶液时，常将 FeCl₃ 晶体溶于较浓的盐酸中，然后再加水稀释……
 *          通过增大溶液中 H⁺ 的浓度来**抑制** FeCl₃ 的水解」
 *       · 探究「**反应条件对 FeCl₃ 水解平衡的影响**」：0.01 mol/L FeCl₃ 溶液、
 *         FeCl₃ 晶体、浓盐酸、浓氢氧化钠溶液、pH 计（教材给的是定性与半定量）
 *       · 「电离常数随温度变化不大，如 CH₃COOH 在 25 ℃ 时 Ka 为 1.75×10⁻⁵，
 *          0 ℃ 时 Ka 为 1.65×10⁻⁵，所以室温时可以不考虑温度对电离常数的影响」
 *       · 第四节 沉淀溶解平衡：「将 AgNO₃ 溶液与 NaCl 溶液混合，会生成**白色的
 *          AgCl 沉淀**，Ag⁺ + Cl⁻ = AgCl↓」；Ksp 定义；「Q > Ksp 溶液中有沉淀析出」
 *       · 实验 3-4（沉淀的转化）：「AgCl 沉淀转化为 AgI 沉淀，AgI 沉淀又转化为
 *          Ag₂S 沉淀」；「Ksp(AgCl) = 1.8×10⁻¹⁰」「Ksp(AgI) = 8.5×10⁻¹⁷」
 *         「Ksp(AgI) 远小于 Ksp(AgCl)……**I⁻(aq) + AgCl(s) ⇌ AgI(s) + Cl⁻(aq)**」
 *       · 附录Ⅱ 某些弱电解质的电离常数（25 ℃）：H₂CO₃ Ka₁=4.5×10⁻⁷ / Ka₂=4.7×10⁻¹¹、
 *         CH₃COOH 1.75×10⁻⁵、NH₃·H₂O 1.8×10⁻⁵
 *       · 附录Ⅲ 常见难溶电解质的溶度积常数（25 ℃）：AgCl 1.8×10⁻¹⁰、AgBr 5.4×10⁻¹³、
 *         AgI 8.5×10⁻¹⁷、Ag₂S 6.3×10⁻⁵⁰、BaSO₄ 1.1×10⁻¹⁰、BaCO₃ 2.6×10⁻⁹、
 *         CaCO₃ 3.4×10⁻⁹、Cu(OH)₂ 2.2×10⁻²⁰、Mg(OH)₂ 5.6×10⁻¹²、
 *         Fe(OH)₂ 4.9×10⁻¹⁷、Fe(OH)₃ 2.8×10⁻³⁹
 *       · 「大量实验测得，在 25 ℃ 和 101 kPa 下，强酸的稀溶液与强碱的稀溶液发生中和
 *          反应生成 1 mol H₂O 时，放出 **57.3 kJ** 的热量」
 *       · 书末元素周期表（相对原子质量）：H 1.008 / C 12.01 / N 14.01 / O 16.00 /
 *         Na 22.99 / S 32.06 / Cl 35.45 / K 39.10 / Ca 40.08 / Fe 55.85 /
 *         Cu 63.55 / Br 79.90 / Ag 107.9 / I 126.9 / Ba 137.3（本文件摩尔质量按此算）
 *  [S4] 人教版《化学 选择性必修2 物质结构与性质》（2019）——**全文**（PDF 115 页抽取）
 *       https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master/高中/化学/人教版-人民教育出版社/普通高中教科书·化学选择性必修2%20物质结构与性质.pdf
 *       · 第四节 配合物与超分子 · 实验 3-3：向 4 mL 0.1 mol/L CuSO₄ 中滴几滴 1 mol/L
 *         氨水「**首先形成难溶物**，继续添加氨水并振荡试管」→「蓝色沉淀 → 深蓝色溶液」；
 *         「Cu²⁺ + 2NH₃·H₂O = Cu(OH)₂↓ + 2NH₄⁺」「Cu(OH)₂ + 4NH₃ = [Cu(NH₃)₄](OH)₂」；
 *         加入 95% 乙醇可析出深蓝色晶体
 *       · 实验 3-4：FeCl₃ + 1 滴 0.1 mol/L KSCN，「试管里溶液的颜色跟血液极为相似」
 *         （**血红色**），「Fe²⁺ 跟 SCN⁻ 不显红色」
 *       · 实验 3-5：NaCl + AgNO₃ → 白色 AgCl 沉淀；再滴 1 mol/L 氨水，「白色的 AgCl
 *         沉淀消失，得到澄清的无色溶液」：**AgCl + 2NH₃ = [Ag(NH₃)₂]Cl**
 *       · [Cu(H₂O)₄]²⁺ 天蓝色、配位键由配体提供孤电子对
 *  [S5] 人教版《化学 九年级 上册》——**全文**（PDF 162 页抽取）
 *       https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master/初中/化学/人教版-人民教育出版社/九年级/义务教育教科书·化学九年级上册.pdf
 *       · 「**二氧化碳可以使澄清石灰水变成白色浑浊液**，白色浑浊物越多，说明气体中
 *          二氧化碳越多」（CO₂ 的检验依据）
 *       · 实验 1-4「碳酸钠粉末与稀盐酸反应」（反应很剧烈——本文件 carbonate-acid 的
 *          剧烈程度模型依据）
 *  [S6] COST Action 1802 ·《Equilibrium constants for hydrolysis and associated
 *       equilibria in critical compilations — Iron》——**全文**（PDF 4 页抽取；
 *       数据源：Baes & Mesmer 1976 / Lemire et al. 2013 / Brown & Ekberg 2016）
 *       https://equilibriumdata.github.io/docs/COST/Fe.pdf
 *       http://www.cost-nectar.eu/docs/wg1_pt/FeIII.pdf
 *       · Fe³⁺ + H₂O ⇌ FeOH²⁺ + H⁺：lg K = −2.19（Baes & Mesmer）/ −2.15±0.07（Lemire）
 *         / **−2.20±0.02（Brown & Ekberg 2016）** ⇒ Ka₁ ≈ 6.3×10⁻³（仅用于文字说明）
 *       · Fe(OH)₃(s) ⇌ Fe³⁺ + 3OH⁻：−38.97±0.64（2-line ferrihydrite）
 *         —— 与教材 Ksp(Fe(OH)₃)=2.8×10⁻³⁹（lg = −38.55）一致，教材值可用
 *  [S7] 穷观本机高考真题档案（`桌面版\数据库\qg_corpus.txt`，**全文**）——
 *       `###SRC:` 路径即来源卷别，逐条按文件核过：
 *       · 2025·湖北卷·解答题：「Cu(OH)₂ =Δ= CuO + H₂O」（蓝色沉淀受热变黑）
 *       · 2025·安徽卷·选择题：「Cu(OH)₂ 溶于氨水得到深蓝色 [Cu(NH₃)₄](OH)₂ 溶液，
 *         加入稀硫酸又转化为蓝色 [Cu(H₂O)₄]SO₄ 溶液」；「氨水溶解 Cu(OH)₂：
 *         Cu(OH)₂ + 4NH₃ = [Cu(NH₃)₄](OH)₂」
 *       · 2025·江苏卷·选择题：5% CuSO₄ 加浓氨水「产生蓝色沉淀」，沉淀溶于浓氨水
 *         「溶液呈现深蓝色」
 *       · 2025·江苏卷·解答题：「Ksp(AgCl) = 1.8×10⁻¹⁰」
 *       · 2025·重庆卷·选择题：2 mL 0.1 mol/L AgNO₃ 与同浓度同体积 NaCl 混合得悬浊液，
 *         再依次加氨水、NaI；选项含「上述实验可证明 Ksp(AgCl) > Ksp(AgI)」
 *       · 2025·甘肃卷·选择题：「比较 AgCl 和 AgI 的 Ksp 大小」的标准操作是
 *         「向 AgNO₃ 溶液先滴入几滴 NaCl 溶液，再滴入几滴 NaI 溶液，观察沉淀颜色变化」
 *       · 2025·黑吉辽蒙卷·选择题：NH₄⁺ 的水解常数 **Kh(NH₄⁺) = 10⁻⁹·²⁵**
 *         （与教材 Kb(NH₃·H₂O)=1.8×10⁻⁵ 自洽：Kw/Kb = 5.6×10⁻¹⁰）
 *       · 2022·全国甲卷·选择题：「比较 CH₃COO⁻ 和 HCO₃⁻ 的水解常数」——分别测浓度均为
 *         0.1 mol/L 的 CH₃COONH₄ 和 NaHCO₃ 溶液的 pH
 *       · 2015·全国卷·选择题：含 Fe³⁺ 溶液滴 KSCN「溶液成血红色」
 *       · 2017·全国卷·选择题：「一只试管中产生黄色沉淀，为 AgI……可说明
 *         Ksp(AgI) < Ksp(AgCl)」
 *       · 2012·新课标卷·选择题：「加入 BaCl₂ 溶液，产生不溶于稀硝酸的白色沉淀，
 *         可能为 AgCl 或 BaSO₄」
 *       · 2019·全国卷·选择题：「澄清的石灰水久置后出现白色固体
 *         Ca(OH)₂ + CO₂ = CaCO₃↓ + H₂O」
 *       · 2025·广东卷·解答题：Ksp(298 K) 表 Fe(OH)₃ 2.8×10⁻³⁹ / Cu(OH)₂ 2.2×10⁻²⁰
 *         （与教材附录Ⅲ 一致）
 *  [S8] 菁优网 真题解析（**摘录**，非全文）
 *       https://www.jyeoo.com/shiti/1063f1b6-1550-415f-5d4d-eac62251c355
 *       「加入一定量的 NaOH 溶液加热，有刺激性气味的气体产生，将湿润的红色石蕊试纸
 *        靠近试管口，观察到试纸的颜色变蓝」；「Ba²⁺ + SO₄²⁻ = BaSO₄↓」
 *
 * ── 台架约定（写进 steps，学生看得见）─────────────────────────────────────
 *   · 1 滴 ≈ 0.05 mL（20 滴 / mL）；
 *   · 全部溶液体积按「取样体积 + 滴加体积」相加，忽略混合体积收缩；
 *   · 溶液颜色深浅用「相对吸光度 A」（朗伯-比尔：A 与有色粒子浓度成正比）表示。
 * ========================================================================== */
(function () {
  'use strict';

  var API = window.QG_CLAB;
  if (!API || typeof API.register !== 'function') return;

  /* ==================================================================== *
   * 0 · 通用小工具                                                       *
   * ==================================================================== */
  /* 取参数值：**null / undefined / '' / 布尔 / 非数字一律回落到默认值**。
     注意不能用 `Number(v)` 直接兜底 —— `Number(null) === 0`、`Number('') === 0`，
     会把"没给这个参数"悄悄变成 0（本文件踩过一次：react({}) 与 react({x:null})
     必须给出同样的默认值，否则参数兜底与"真实 0"分不开）。 */
  function qgNum(v, dflt) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return dflt;
    var x = Number(v);
    return (typeof x === 'number' && isFinite(x)) ? x : dflt;
  }
  function qgInt(v, dflt) {
    var x = qgNum(v, NaN);
    return isFinite(x) ? Math.round(x) : dflt;
  }
  function qgClamp(x, lo, hi) {
    if (!(x > lo)) x = lo;          /* 同时挡住 NaN */
    if (x > hi) x = hi;
    return x;
  }
  /* ★★ 数值守卫 —— 四个格式化入口的**唯一判据**，别再单独写 `!isFinite(x)`。
     为什么（真事故，已复现）：`isFinite(null) === true`、`isFinite('') === true`、
     `isFinite([]) === true` —— 它们全会被"当成 0"从 `!isFinite(x)` 这道门穿过去，
     然后在 `x.toExponential()` / `x.toFixed()` 上抛 `TypeError: Cannot read
     properties of null`。触发场景是**必然可达**的：把「AgNO₃ 溶液浓度」推到滑块上界
     0.20（其余默认）时，n(I⁻) 与 n(AgCl) 恰好是同一个 IEEE754 值 → 按约定① 记 null →
     `react()` 把 TypeError 抛给调用方、工具条显示 `⚠ conclude: …`、画布底部红字
     `绘图出错: Cannot read properties of null`。
     所以：**任何可能为 null 的量在进入格式化前必须先过 qgIsNum()**。 */
  function qgIsNum(x) {
    return (typeof x === 'number') && isFinite(x);
  }
  function qgRound(x, n) {
    if (!qgIsNum(x)) return null;          /* 缺值就如实给 null，不伪装成 0 */
    var p = Math.pow(10, n === undefined ? 3 : n);
    return Math.round(x * p) / p;
  }
  /* 按**有效数字**取整（不是小数位）：化学里浓度跨好几个数量级，
     用 toFixed 会把 7.5e-6 直接抹成 0。
     非数值 → 返回 **null**（约定①：这是"没有有效值"，不是 0；核心会跳过该行、不进 r²）。 */
  function qgSig(x, n) {
    if (!qgIsNum(x)) return null;
    if (x === 0) return 0;
    var e = Math.floor(Math.log(Math.abs(x)) / Math.LN10);
    var p = Math.pow(10, n - 1 - e);
    return Math.round(x * p) / p;
  }
  /* 按有效数字格式化成**字符串**（画布/结论文本用）。非数值 → '—'。 */
  function qgSigStr(x, n) {
    if (!qgIsNum(x)) return '—';
    if (x === 0) return '0';
    var a = Math.abs(x), d;
    if (a >= 1e5 || a < 1e-3) return qgSci(x, n);
    d = Math.max(0, Math.min(8, n - 1 - Math.floor(Math.log(a) / Math.LN10)));
    return x.toFixed(d);
  }
  var QG_SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
                 '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺' };
  /* 把 1.8e-10 写成 1.8×10⁻¹⁰（画布上不放 "e-10" 这种半成品）。非数值 → '—'。 */
  function qgSci(x, n) {
    if (!qgIsNum(x)) return '—';
    if (x === 0) return '0';
    var parts = x.toExponential(Math.max(0, n - 1)).split('e');
    var ex = String(Number(parts[1])), sup = '', i;
    for (i = 0; i < ex.length; i++) sup += (QG_SUP[ex.charAt(i)] || ex.charAt(i));
    return parts[0] + '×10' + sup;
  }
  function qgPct(x, n) {
    if (!qgIsNum(x)) return '—';
    return qgRound(x, n === undefined ? 1 : n) + '%';
  }
  /* 确定性伪随机（线性同余）：同一个 (实验台时钟, 第几次) 永远给同一个数 ——
     "连按观察一次"时现象有细微抖动（真实），但**同一条记录重画不会变**。
     方向性判据用的都是大跨度参数差，±0.4% 的抖动翻不过来。 */
  function qgRng(seed) {
    var s = Math.floor(Math.abs(qgNum(seed, 1))) % 2147483647;
    if (s < 1) s = 1;
    return function () {
      s = (s * 48271) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  /* 线性最小二乘（**中心化**，量级大时不丢有效位）。a = 斜率，b = 截距。 */
  function qgFit(pts) {
    var n = pts.length, i, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    if (n < 3) return null;
    for (i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; }
    var mx = sx / n, my = sy / n;
    for (i = 0; i < n; i++) {
      var dx = pts[i].x - mx, dy = pts[i].y - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    if (!(sxx > 0) || !(syy > 0)) return null;
    return { a: sxy / sxx, b: my - (sxy / sxx) * mx,
             r2: qgClamp((sxy * sxy) / (sxx * syy), 0, 1), n: n };
  }

  /* ==================================================================== *
   * 1 · 化学常量（**全部带来源**，见文件头 [S1]~[S7]）                    *
   * ==================================================================== */
  /* 摩尔质量 g/mol —— 按人教版选择性必修1 书末元素周期表的相对原子质量算 */
  var M_AGCL = 143.35, M_AGBR = 187.80, M_AGI = 234.80, M_AG2S = 247.86;
  var M_AG2CO3 = 275.81, M_BASO4 = 233.36, M_BACO3 = 197.34;
  var M_CUOH2 = 97.57, M_CUO = 79.55, M_FEOH3 = 106.87, M_FEOH2 = 89.86;
  var M_FE2O3 = 159.70, M_NH4CL = 53.49, M_NACL = 58.44, M_NA2CO3 = 105.99;
  var M_NAHCO3 = 84.01, M_NA2SO4 = 142.04, M_CUSO4 = 159.61, M_CACO3 = 100.09;
  var M_CO2 = 44.01, M_NH3 = 17.04, M_KSCN = 97.18;

  /* 溶度积 Ksp（25 ℃，人教版选择性必修1 附录Ⅲ [S3]；括号内为 lg Ksp） */
  var KSP = {
    agcl: 1.8e-10, agbr: 5.4e-13, agi: 8.5e-17, ag2s: 6.3e-50,
    baso4: 1.1e-10, baco3: 2.6e-9, caco3: 3.4e-9,
    cuoh2: 2.2e-20, mgoh2: 5.6e-12, feoh2: 4.9e-17, feoh3: 2.8e-39
  };
  /* 电离常数（25 ℃，人教版选择性必修1 附录Ⅱ [S3]） */
  var KA_CH3COOH = 1.75e-5, KB_NH3H2O = 1.8e-5;
  var KW25 = 1.0e-14;              /* 25 ℃ 水的离子积（教材值） */
  var DH_NEUT = 57.3e3;            /* 中和热 57.3 kJ/mol（教材值）→ 水解 ΔH = +57.3 kJ/mol */
  var RGAS = 8.314;                /* J/(mol·K) */

  var ML_PER_DROP = 0.05;          /* 台架约定：1 滴 ≈ 0.05 mL */

  /* Kw(T)：教材没给表，用 van't Hoff 从教材两个数外推（见文件头设计决定 ②）。
     50 ℃ 给出 pKw = 13.22（手册值 13.26），够教学用。 */
  function qgKw(T) {
    var t = qgClamp(qgNum(T, 298.15), 273.15, 373.15);
    return KW25 * Math.exp((DH_NEUT / RGAS) * (1 / 298.15 - 1 / t));
  }
  /* 一元弱酸（或弱碱的共轭酸）精确解：c(H⁺) = (−Ka + √(Ka² + 4Ka·c))/2 */
  function qgHofWeakAcid(Ka, c) {
    if (!(c > 0)) return 0;
    var k = qgNum(Ka, 0);
    if (!(k > 0)) return 0;
    return (-k + Math.sqrt(k * k + 4 * k * c)) / 2;
  }
  /* 使 M(OH)n 开始沉淀所需的 pH（由 Ksp 严格算：c(OH⁻) = (Ksp/c)^(1/n)） */
  function qgPrecipPH(ksp, c, n) {
    if (!(ksp > 0) || !(c > 0) || !(n > 0)) return null;
    var oh = Math.pow(ksp / c, 1 / n);
    if (!(oh > 0)) return null;
    return 14 + Math.log(oh) / Math.LN10;   /* pH = 14 + lg c(OH⁻) */
  }
  /* 沉淀溶解平衡里 1:1 难溶盐的 c(Ag⁺) */
  function qgAgOf(kspAGX, cX) {
    if (!(kspAGX > 0) || !(cX > 0)) return null;
    return kspAGX / cX;
  }
  function qgLg(x) { return (x > 0) ? Math.log(x) / Math.LN10 : null; }

  /* ==================================================================== *
   * 2 · 画布工具（与 js/pslab/mod.js、js/clab/analysis.js 同一套观感：   *
   *     米白纸 #F4F1EA + 墨色 #26221C + Georgia 斜体）                    *
   * ==================================================================== */
  var PAPER = '#F4F1EA';
  var INK = '#26221C';

  /* g.font 宽容签名 → 本文件内部统一用 F(size, bold, italic) */
  function qgFontFn(g) {
    var custom = (g && typeof g.font === 'function') ? g.font : null;
    return function (size, bold, italic) {
      if (custom) {
        try {
          var v = custom(size, !!bold, !!italic);
          if (typeof v === 'string' && v) return v;
        } catch (e) { custom = null; }   /* 宿主给坏了就退回自己拼 */
      }
      return (italic ? 'italic ' : '') + (bold ? 'bold ' : '') + size +
             'px Georgia,"Times New Roman",serif';
    };
  }
  function qgDraw(g) {
    var c = g.c;
    function path(pts, close) {
      if (!pts || !pts.length) return;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      if (close) c.closePath();
    }
    return {
      line: function (x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); },
      rect: function (x, y, w, h, fill, stroke, lw) {
        path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.lineWidth = lw || 1; c.strokeStyle = stroke; c.stroke(); }
      },
      poly: function (pts, fill, stroke, lw, close) {
        if (!pts || !pts.length) return;
        path(pts, close);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.lineWidth = lw || 1; c.strokeStyle = stroke; c.stroke(); }
      },
      circle: function (x, y, r, fill, stroke, lw) {
        c.beginPath(); c.arc(x, y, r < 0 ? 0 : r, 0, Math.PI * 2);
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.lineWidth = lw || 1; c.strokeStyle = stroke; c.stroke(); }
      },
      txt: function (s, x, y, font, color, align) {
        c.font = font || 'italic 11px Georgia,"Times New Roman",serif';
        c.fillStyle = color || INK;
        c.textAlign = align || 'left';
        c.textBaseline = 'middle';
        c.fillText(String(s), x, y);
      },
      dash: function (on, pattern) {
        if (c.setLineDash) c.setLineDash(on ? (pattern || [4, 4]) : []);
      }
    };
  }
  function qgPanel(g, d, F, x, y, w, h, title, tag) {
    d.rect(x, y, w, h, 'rgba(255,255,255,0.62)', 'rgba(38,34,28,0.20)', 1);
    if (title) d.txt(title, x + 12, y + 16, F(12, true, false), INK, 'left');
    if (tag) d.txt(tag, x + w - 12, y + 16, F(10, false, true), '#6B645C', 'right');
    return { x: x, y: y, w: w, h: h, cx: x + 14, cy: y + 36 };
  }
  function qgHead(g, d, F, title, tag) {
    d.txt(title, 26, 24, F(15, true, false), INK, 'left');
    if (tag) d.txt(tag, g.w - 26, 24, F(12, false, true), '#7A4A2B', 'right');
  }
  /* 试管：从 (x,y) 顶部往下长 h（含圆底），半径 r；液面比例 frac ∈ [0,1] */
  function qgTube(d, F, x, y, w, h, frac, fill, label, labelColor) {
    var r = w / 2;
    d.poly([[x - r, y], [x - r, y + h - r], [x + r, y + h - r], [x + r, y]],
           'rgba(255,255,255,0.72)', INK, 1.4, false);
    d.circle(x, y + h - r, r, 'rgba(255,255,255,0.72)', INK, 1.4);
    if (frac > 0) {
      var lv = y + h - (h - 2) * qgClamp(frac, 0.02, 1);
      d.rect(x - r + 1, lv, w - 2, (y + h) - lv - 1, fill || 'rgba(160,200,230,0.55)', null, 0);
      d.line(x - r + 1, lv, x + r - 1, lv);
    }
    if (label) d.txt(label, x, y + h + 13, F(9.5, false, false), labelColor || '#6B645C', 'center');
  }
  /* 烧杯：从 (x,y) 顶部往下 h，宽 w；液面比例 frac */
  function qgBeaker(d, F, x, y, w, h, frac, fill, label) {
    d.poly([[x, y], [x, y + h], [x + w, y + h], [x + w, y]],
           'rgba(255,255,255,0.72)', INK, 1.4, false);
    if (frac > 0) {
      var lv = y + h - (h - 3) * qgClamp(frac, 0.02, 1);
      d.rect(x + 1, lv, w - 2, (y + h) - lv - 1, fill || 'rgba(160,200,230,0.5)', null, 0);
      d.line(x + 1, lv, x + w - 1, lv);
    }
    if (label) d.txt(label, x + w / 2, y + h + 13, F(9.5, false, false), '#6B645C', 'center');
  }
  /* 沉淀层：不平整的堆积（用确定性抖动画出"絮状/颗粒"感）。
     amt ∈ [0,1] 决定厚度，col 是沉淀颜色，fuzz 决定边缘毛糙程度。 */
  function qgPrecip(d, seed, x, y, w, hMax, amt, col, fuzz) {
    var a = qgClamp(amt, 0, 1);
    if (!(a > 0.004)) return;
    var hh = hMax * a, rnd = qgRng(seed), i, n = 22;
    var top = [];
    for (i = 0; i <= n; i++) top.push([x + w * i / n, y - hh + (rnd() - 0.5) * (fuzz || 6) * a]);
    var poly = top.slice(0);
    poly.push([x + w, y]); poly.push([x, y]);
    d.poly(poly, col, null, 0, true);
    for (i = 0; i < 9; i++) {   /* 悬浮的小颗粒，让"絮状"看得出来 */
      var px = x + rnd() * w, py = y - hh * rnd();
      d.circle(px, py, 1 + rnd() * 1.6, col, null, 0);
    }
  }
  /* 气泡：从底部往上冒（n 个，确定性位置） */
  function qgBubbles(d, seed, x, y, w, h, n, col) {
    var rnd = qgRng(seed), i, k = Math.max(0, Math.min(40, qgInt(n, 0)));
    for (i = 0; i < k; i++) {
      var bx = x + 3 + rnd() * (w - 6);
      var by = y - rnd() * h;
      d.circle(bx, by, 1.2 + rnd() * 1.8, null, col || 'rgba(255,255,255,0.95)', 1.1);
    }
  }
  /* 酒精灯火焰 */
  function qgFlameShape(d, x, y, h, col, alpha) {
    var w = h * 0.5;
    d.poly([[x, y - h], [x + w * 0.5, y - h * 0.42], [x + w * 0.46, y],
            [x - w * 0.46, y], [x - w * 0.5, y - h * 0.42]],
           col || 'rgba(230,150,40,' + (alpha === undefined ? 0.75 : alpha) + ')', null, 0, true);
  }
  /* 「实验记录」面板：把已做过的观察逐行画进画面。
     为什么每个反应都要画它（不是装饰）：① 纯定性反应（feoh3 / carbonate-acid /
     ammonium-alkali）的画面只由参数决定，学生连按"观察一次"时画面纹丝不动，
     看起来像"点了没反应"；② 契约 §4.6 要求"画布像素签名会变"，不读 state.rows
     的 draw() 在这条上必然不合格。 */
  function qgRowText(rows, pairs, max) {
    max = max || 4;
    var n = rows ? rows.length : 0, out = [], i, j, seg;
    var from = n > max ? n - max : 0;
    if (!n) return { lines: ['（还没做过观察：点"🔬 观察一次"开始记录）'], n: 0, from: 0 };
    for (i = from; i < n; i++) {
      seg = [];
      for (j = 0; j < pairs.length; j++) {
        var v = rows[i] ? rows[i][pairs[j][0]] : undefined;
        if (v === undefined || v === null || v === '') continue;
        seg.push(pairs[j][1] + '=' + (typeof v === 'number' ? qgRound(v, 3) : v));
      }
      out.push('#' + (i + 1) + '  ' + seg.join('　'));
    }
    return { lines: out, n: n, from: from };
  }
  function qgRecord(d, F, rec, x, y, w) {
    d.txt('实验记录（共 ' + rec.n + ' 次观察' +
          (rec.n > rec.lines.length ? '，显示最近 ' + rec.lines.length + ' 次' : '') + '）',
          x, y, F(10.5, true, false), '#6B645C', 'left');
    var i;
    for (i = 0; i < rec.lines.length; i++) {
      d.txt(rec.lines[i], x, y + 16 + i * 14, F(10, false, false), '#3A3630', 'left');
    }
    return 16 + rec.lines.length * 14;
  }
  /* 一行"读数"（画面上写关键量化量） */
  function qgReadout(d, F, x, y, w, items) {
    var i, cx = x;
    for (i = 0; i < items.length; i++) {
      if (!items[i]) continue;
      d.txt(items[i][0], cx, y, F(10, false, true), '#6B645C', 'left');
      d.txt(items[i][1], cx, y + 15, F(13, true, false), items[i][2] || INK, 'left');
      cx += w;
    }
  }
  /* 一条"lg Ksp"对比柱（沉淀转化用；lg Ksp 越负 = 越难溶 = 柱越短）。
     **文件级函数**，故意不放进 draw 体内（见 precipitate-convert 的 draw 注释）。 */
  function qgKspBar(d, F, x, y, w, h, lab, lgk, colr) {
    d.txt(lab, x, y - 12, F(10, false, false), '#6B645C', 'left');
    var frac = qgClamp((lgk + 52) / 52, 0, 1);
    var bw = w * frac;
    if (bw < 2) bw = 2;
    d.rect(x, y, bw, h, colr, 'rgba(38,34,28,0.35)', 1);
    d.txt('lg Ksp = ' + qgRound(lgk, 2), x + bw + 6, y + h / 2,
          F(10, false, true), '#3A3630', 'left');
  }

  /* ==================================================================== *
   * 3 · 组 1 · 反应 1／9 —— agcl-precip（AgNO₃ + NaCl，含稀硝酸检验）     *
   * ==================================================================== */
  var AGCL_SAMPLE = [
    { value: 'nacl', label: 'NaCl 溶液（含 Cl⁻）' },
    { value: 'carbonate', label: 'Na₂CO₃ 溶液（只含 CO₃²⁻，干扰项）' }
  ];
  function agclModel(p) {
    var cS = qgNum(p.cSample, 0.5), vS = qgNum(p.vSample, 5);
    var cA = qgNum(p.cAgNO3, 0.1), dA = qgInt(p.dropsAg, 2);
    var hno = qgInt(p.hno3, 0);
    var isCl = (p.sample !== 'carbonate');
    var vAg = dA * ML_PER_DROP;
    var nAg = cA * vAg;                       /* mmol 加入的 Ag⁺ */
    var nX = cS * vS;                         /* mmol 试液里的 Cl⁻ 或 CO₃²⁻ */
    var vTot = vS + vAg;                      /* mL */
    var nLimit, nPre, mPre, mCol, gas = 0, turbid = 0;
    if (isCl) {
      nLimit = Math.min(nAg, nX);
      nPre = nLimit;                          /* AgCl */
      mPre = nPre * M_AGCL;
    } else {
      nLimit = Math.min(nAg / 2, nX);
      nPre = nLimit;                          /* Ag₂CO₃ */
      mPre = nPre * M_AG2CO3;
    }
    /* 加稀硝酸：AgCl 不溶；Ag₂CO₃ 溶解并放出 CO₂ */
    if (!isCl && hno > 0 && nPre > 0) {
      gas = nPre * M_CO2 / 1000;              /* mmol CO₂ → 近似按 mL 记（台架约定） */
      mCol = 0;
    } else {
      mCol = mPre;
    }
    var cAgLeft = (nAg - (isCl ? nPre : 2 * nPre)) / vTot;   /* mol/L（mmol/mL = mol/L） */
    if (cAgLeft < 0) cAgLeft = 0;
    var complete = nAg > 0 ? (isCl ? nPre / nAg : 2 * nPre / nAg) * 100 : 0;
    complete = qgClamp(complete, 0, 100);
    /* 相对浊度：沉淀量越大越浑；加硝酸把碳酸银溶掉后变澄清液 */
    turbid = qgClamp(Math.sqrt(Math.max(mCol, 0)) * 2.4, 0, 100);
    return { isCl: isCl, hno: hno, vAg: vAg, nAg: nAg, nX: nX, vTot: vTot,
             nLimit: nLimit, nPre: nPre, mPre: mPre, mCol: mCol, gas: gas,
             cAgLeft: cAgLeft, complete: complete, turbid: turbid };
  }
  function agclRow(m, idx) {
    var rnd = qgRng(idx * 7919 + Math.round(m.nPre * 1000) + 13);
    return {
      nAg: qgSig(m.nAg, 3), nX: qgSig(m.nX, 3), nLimit: qgSig(m.nLimit, 3),
      nPre: qgSig(m.nPre, 4), mPre: qgSig(m.mPre, 4),
      mLeft: qgSig(m.mCol, 4), complete: qgSig(m.complete, 3),
      cAgLeft: qgSig(m.cAgLeft, 2),
      turb: qgSig(m.turbid * (0.996 + 0.008 * rnd()), 3)
    };
  }
  function agclPhen(m, p) {
    var out = [], c = qgNum(p.cAgNO3, 0.1), s = qgNum(p.cSample, 0.5);
    if (m.isCl) {
      out.push(m.nPre > 0
        ? ('滴入 AgNO₃ 后立即出现**白色**' +
           (m.mPre < 5 ? '浑浊（悬浊液，量很少、看不出颗粒）' : '絮状沉淀') + '（AgCl）')
        : '没有出现沉淀（Ag⁺ 或 Cl⁻ 的量太少，未达到 AgCl 的 Ksp）');
      if (m.nPre > 0) {
        out.push(m.mPre < 5
          ? '振荡后浑浊不消失，长时间静置也只有极少量白色固体落到管底（AgCl 的溶解度极小，但加的量本来就不多）'
          : '振荡后沉淀不消失，静置时白色固体沉在试管底部，上层液接近无色');
      }
    } else {
      out.push(m.nPre > 0 ? '滴入 AgNO₃ 后同样出现**白色**沉淀（Ag₂CO₃）——与 AgCl 外观无法区分'
                          : '没有出现沉淀');
      out.push('这就是"只用 AgNO₃ 不能断定含 Cl⁻"的原因：CO₃²⁻ 会产生同样的白色沉淀');
    }
    if (m.hno > 0) {
      if (m.isCl) {
        out.push('再加 ' + m.hno + ' 滴稀硝酸并振荡：**白色沉淀不溶解**（AgCl 不溶于稀硝酸）');
      } else if (m.nPre > 0) {
        out.push('再加 ' + m.hno + ' 滴稀硝酸并振荡：沉淀**溶解**，溶液变澄清并**冒出无色气泡**（CO₂）');
        out.push('气泡使澄清石灰水变浑浊（CO₂ + Ca(OH)₂ = CaCO₃↓ + H₂O）');
      }
    } else if (!m.isCl && m.nPre > 0) {
      out.push('（还没加稀硝酸：此时两支试管的现象一模一样，无法判断是 AgCl 还是 Ag₂CO₃）');
    }
    if (m.nAg > 0 && m.complete < 99.5) {
      out.push('Ag⁺ 没有沉淀完全：反应后 c(Ag⁺) ≈ ' + qgSigStr(m.cAgLeft, 2) +
               ' mol/L（> 1×10⁻⁵ mol/L，按教材口径不能算"沉淀完全"）');
    }
    if (m.complete >= 99.5 && m.nPre > 0) {
      out.push('Ag⁺ 基本沉淀完全（沉淀完全度 ≈ ' + qgSigStr(m.complete, 3) + '%）');
    }
    /* 谁是限量试剂 —— 现象上就是"沉淀的量由谁决定"，随条件变化最明显的一行 */
    if (m.nPre > 0) {
      var need = m.isCl ? 1 : 2;
      var nAgNeed = need * m.nX;                 /* 恰好反应所需的 Ag⁺ */
      if (Math.abs(m.nAg - nAgNeed) <= 0.02 * Math.max(m.nAg, nAgNeed, 1e-9)) {
        out.push('Ag⁺ 与试液里的 ' + (m.isCl ? 'Cl⁻' : 'CO₃²⁻') + '恰好按 ' + need +
                 ':1 完全反应（两者的物质的量正好匹配），沉淀量达到这一组的最大值 ' +
                 qgSigStr(m.mPre, 3) + ' mg');
      } else if (m.nAg < nAgNeed) {
        out.push('Ag⁺ 不足、' + (m.isCl ? 'Cl⁻' : 'CO₃²⁻') + '过量：沉淀的量由 Ag⁺ 决定，' +
                 '再加试液沉淀也不会增多（限量试剂）');
      } else {
        out.push('Ag⁺ 过量、' + (m.isCl ? 'Cl⁻' : 'CO₃²⁻') + '不足：沉淀的量由' +
                 (m.isCl ? ' Cl⁻' : ' CO₃²⁻') + '决定，沉淀只有 ' + qgSigStr(m.mPre, 3) +
                 ' mg，多加 AgNO₃ 也不会增多');
      }
    }
    if (c >= 0.15 || s >= 0.8) out.push('溶液浓度较大，沉淀生成得很稠、沉降较慢');
    return out;
  }
  API.register('agcl-precip', {
    id: 'agcl-precip',
    name: '硝酸银与氯化钠（氯离子的检验）',
    group: '离子反应与溶液平衡',
    aim: '观察 Ag⁺ 与 Cl⁻ 生成白色 AgCl 沉淀，并用稀硝酸排除 CO₃²⁻ 的干扰，学会 Cl⁻ 的检验',
    principle: 'AgNO₃ 与 NaCl 都是易溶强电解质，在溶液中电离出的 Ag⁺ 与 Cl⁻ 结合成难溶的 ' +
               'AgCl（Ksp = 1.8×10⁻¹⁰），Q > Ksp 时析出白色沉淀：Ag⁺ + Cl⁻ = AgCl↓。' +
               'AgCl 不溶于稀硝酸，而 CO₃²⁻ 与 Ag⁺ 生成的 Ag₂CO₃（Ksp = 2.6×10⁻⁹）能溶于稀硝酸' +
               '并放出 CO₂ —— 所以检验 Cl⁻ 必须先用适量稀硝酸酸化，把 CO₃²⁻ 这类干扰离子排除掉，' +
               '再加 AgNO₃；出现不溶于稀硝酸的白色沉淀才能判定含 Cl⁻。沉淀的量由不足的那一方' +
               '（限量试剂）决定，这正是"沉淀完全度"讨论的落点。',
    apparatus: ['试管', '试管架', '胶头滴管', '量筒', 'NaCl 溶液', 'Na₂CO₃ 溶液',
                'AgNO₃ 溶液', '稀硝酸', '澄清石灰水（检验 CO₂ 用）'],
    steps: ['取 vSample mL 试液加入试管（台架约定：1 滴 ≈ 0.05 mL）',
            '滴入 dropsAg 滴 AgNO₃ 溶液，振荡，观察沉淀的颜色与形态',
            '再加 hno3 滴稀硝酸，振荡，观察沉淀是否溶解、有无气泡',
            '把气体通入澄清石灰水，若变浑浊则说明放出的是 CO₂',
            '把试液换成 Na₂CO₃ 溶液重做一遍，比较两种试液的现象差异',
            '改变浓度与滴数，比较沉淀的量与"沉淀完全度"的变化'],
    params: [
      { key: 'sample', label: '试液种类', type: 'select', value: 'nacl', options: AGCL_SAMPLE },
      { key: 'cSample', label: '试液浓度', unit: 'mol/L', min: 0.01, max: 1.00, step: 0.01, value: 0.50 },
      { key: 'vSample', label: '试液体积', unit: 'mL', min: 1, max: 10, step: 0.5, value: 5.0 },
      { key: 'cAgNO3', label: 'AgNO₃ 溶液浓度', unit: 'mol/L', min: 0.01, max: 0.20, step: 0.01, value: 0.10 },
      { key: 'dropsAg', label: '滴入 AgNO₃ 的滴数', unit: '滴', min: 1, max: 20, step: 1, value: 2 },
      { key: 'hno3', label: '再加稀硝酸的滴数', unit: '滴', min: 0, max: 10, step: 1, value: 2 }
    ],
    react: function (p, ctx) {
      var m = agclModel(p), idx = qgNum(ctx && ctx.index, 0);
      var row = agclRow(m, idx);
      return {
        phenomena: agclPhen(m, p),
        equation: m.isCl ? 'AgNO3 + NaCl = AgCl↓ + NaNO3'
                         : '2AgNO3 + Na2CO3 = Ag2CO3↓ + 2NaNO3',
        ionic: m.isCl ? 'Ag+ + Cl- = AgCl↓'
                      : (m.hno > 0 && m.nPre > 0
                          ? 'Ag2CO3 + 2H+ = 2Ag+ + H2O + CO2↑'
                          : '2Ag+ + CO32- = Ag2CO3↓'),
        type: '复分解反应（沉淀反应 / 离子反应）',
        conditions: m.hno > 0 ? '常温；再加稀硝酸酸化后观察' : '常温',
        measures: row
      };
    },
    columns: [
      { key: 'nAg', label: '加入 Ag⁺ 的物质的量', unit: 'mmol' },
      { key: 'nX', label: '试液中 Cl⁻(或 CO₃²⁻) 的物质的量', unit: 'mmol' },
      { key: 'nLimit', label: '限制试剂的物质的量', unit: 'mmol' },
      { key: 'nPre', label: '生成沉淀的物质的量', unit: 'mmol' },
      { key: 'mPre', label: '沉淀质量（加酸前）', unit: 'mg' },
      { key: 'mLeft', label: '加稀硝酸后不溶的沉淀质量', unit: 'mg' },
      { key: 'complete', label: 'Ag⁺ 的沉淀完全度', unit: '%' },
      { key: 'cAgLeft', label: '反应后 c(Ag⁺)', unit: 'mol/L' },
      { key: 'turb', label: '上层液浑浊程度（相对）', unit: '' }
    ],
    graph: {
      x: 'nPre', y: 'mPre', fit: 'origin',
      title: '沉淀质量 m(AgCl) 与沉淀的物质的量 n(AgCl) 的关系',
      note: 'm = M·n，斜率就是 AgCl 的摩尔质量 143.35 g/mol（M 按人教版选择性元素周期表的' +
            '相对原子质量算：Ag 107.9 + Cl 35.45）。横轴取"生成的沉淀的物质的量"而不是' +
            '"加入量"是有意的：加入量过大时曲线出现平台（限量试剂），平台不是直线，' +
            '本台把"谁是限制试剂、沉淀完全不完全"交给 nLimit / complete 两列与结论卡承载。',
      xLabel: '生成的沉淀的物质的量 n / mmol',
      yLabel: '沉淀质量 m / mg'
    },
    conclude: function (rows, p) {
      var m = agclModel(p), n = rows ? rows.length : 0;
      var txt = m.isCl
        ? 'AgNO₃ 与 NaCl 反应生成白色 AgCl 沉淀：Ag⁺ + Cl⁻ = AgCl↓（Ksp = 1.8×10⁻¹⁰）。' +
          '本次加入 n(Ag⁺) = ' + qgSigStr(m.nAg, 3) + ' mmol、试液中 n(Cl⁻) = ' +
          qgSigStr(m.nX, 3) + ' mmol，生成的 AgCl 为 ' + qgSigStr(m.nPre, 3) +
          ' mmol（' + qgSigStr(m.mPre, 3) + ' mg），Ag⁺ 的沉淀完全度 ' +
          qgSigStr(m.complete, 3) + '%。'
        : 'Na₂CO₃ 与 AgNO₃ 同样生成白色沉淀（Ag₂CO₃），外观与 AgCl 无法区分；' +
          '加稀硝酸后沉淀溶解并放出 CO₂，说明它是 Ag₂CO₃ 而不是 AgCl。';
      if (m.hno > 0 && m.isCl) txt += '加稀硝酸后沉淀不溶解 —— 这正是 Cl⁻ 检验的判据。';
      if (m.hno > 0 && !m.isCl && m.nPre > 0) txt += '沉淀溶解、冒气泡 —— 说明原试液里没有 Cl⁻（或不能据此判定含 Cl⁻）。';
      if (m.complete < 99.5 && m.nPre > 0) {
        txt += '沉淀没做完全：反应后 c(Ag⁺) ≈ ' + qgSigStr(m.cAgLeft, 2) +
               ' mol/L，教材口径（剩余离子浓度 < 1×10⁻⁵ mol/L 才算沉淀完全）下不合格。';
      }
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: m.isCl ? 'AgNO3 + NaCl = AgCl↓ + NaNO3'
                         : '2AgNO3 + Na2CO3 = Ag2CO3↓ + 2NaNO3',
        ionic: m.isCl ? 'Ag+ + Cl- = AgCl↓' : '2Ag+ + CO32- = Ag2CO3↓',
        errors: [
          '没有先用稀硝酸酸化：CO₃²⁻、SO₃²⁻ 等都会生成白色沉淀，会把"含 Cl⁻"判成假阳性（教材实验 2-9 的原始用意）',
          '稀硝酸加得太多或太浓：AgCl 在浓硝酸/大量酸中会因生成 [Ag(NO₃)ₙ] 等而部分溶解，也会把沉淀冲散、看不清"是否溶解"',
          'AgNO₃ 溶液见光易分解、久置会变灰黑，且会腐蚀皮肤衣物；滴管口不能接触试管内壁，否则沉淀会挂在管壁上误判为"没溶解"',
          '观测"沉淀不溶解"要在振荡后静置片刻再看：刚加酸时沉淀被冲起呈悬浮状，容易误判'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = agclModel(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, '氯离子的检验：AgNO₃ + NaCl', m.isCl ? '试液：NaCl' : '试液：Na₂CO₃（干扰）');
        var M = 26;
        var topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管里的现象',
                m.hno > 0 ? '已加稀硝酸 ' + m.hno + ' 滴' : '未加稀硝酸');
        var tx = M + 84, ty = y1 + 46, tw = 62, th = Math.min(h1 - 70, 200);
        if (th < 90) th = 90;
        var liquid = 'rgba(214,226,232,0.65)';
        if (!m.isCl && m.hno > 0 && m.nPre > 0) liquid = 'rgba(228,236,240,0.55)';
        qgTube(d, F, tx, ty, tw, th, 0.86, liquid, '反应液', '#6B645C');
        /* 沉淀：白色；加硝酸后碳酸银溶解 → 只剩清水样 */
        var pc = m.isCl ? 'rgba(252,252,250,0.98)' : 'rgba(250,250,247,0.98)';
        var amt = qgClamp(m.mCol / 26, 0, 1);
        qgPrecip(d, 1001 + Math.round(m.nPre * 100), tx - tw / 2 + 3, ty + th - 8,
                 tw - 6, 26, amt, pc, 7);
        if (amt > 0.02) d.txt('白色沉淀', tx, ty + th - 34, F(10, true, false), '#5A5348', 'center');
        /* 气泡（碳酸银被酸溶解时） */
        if (m.gas > 0) {
          qgBubbles(d, 2002 + Math.round(m.gas * 40), tx - tw / 2 + 3, ty + th - 10, tw - 6,
                    th * 0.6, 10 + Math.round(m.gas * 30), 'rgba(255,255,255,0.95)');
          d.txt('↑ CO₂ 气泡', tx + tw / 2 + 8, ty + 18, F(10.5, true, false), '#2E6B4F', 'left');
        }
        /* 右侧读数 */
        var rx = M + 200;
        qgReadout(d, F, rx, y1 + 52, 132, [
          ['加入 n(Ag⁺) / mmol', qgSigStr(m.nAg, 3), INK],
          ['试液 n(' + (m.isCl ? 'Cl⁻' : 'CO₃²⁻') + ') / mmol', qgSigStr(m.nX, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 132, [
          ['生成沉淀 n / mmol', qgSigStr(m.nPre, 3), '#7A4A2B'],
          ['沉淀质量 m / mg', qgSigStr(m.mPre, 3), '#7A4A2B']
        ]);
        qgReadout(d, F, rx, y1 + 132, 132, [
          ['沉淀完全度', qgPct(m.complete, 1), m.complete > 99.5 ? '#2E6B4F' : '#A03028'],
          ['反应后 c(Ag⁺) / (mol/L)', qgSigStr(m.cAgLeft, 2), INK]
        ]);
        d.txt(m.isCl ? '结论提示：白色沉淀不溶于稀硝酸 → 含 Cl⁻'
                     : (m.hno > 0 && m.nPre > 0 ? '结论提示：沉淀溶于稀硝酸并放 CO₂ → 不是 Cl⁻'
                                                : '结论提示：还没加稀硝酸，无法区分'),
              rx, y1 + h1 - 22, F(11, false, true), m.isCl ? '#2E6B4F' : '#8A5A22', 'left');
        /* 实验记录 */
        var rec = qgRowText(rows, [['nPre', 'n沉淀/mmol'], ['mPre', 'm/mg'],
                                   ['complete', '完全度/%'], ['turb', '浊度']], 4);
        var recH = qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
        if (recH > h1 - 60) d.txt('（把窗口拉高一些，实验记录会更清楚）', M + 14, y1 + h1 - 6,
                                  F(10, false, true), '#8A8378', 'left');
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 4 · 反应 2／9 —— baso4-precip（BaCl₂ + Na₂SO₄）                       *
   * ==================================================================== */
  var BASO4_ACID = [
    { value: 'none', label: '不加酸（只洗涤）' },
    { value: 'hcl', label: '加少量稀盐酸' },
    { value: 'hno3', label: '加少量稀硝酸' }
  ];
  function baso4Model(p) {
    var cB = qgNum(p.cBaCl2, 0.10), vB = qgNum(p.vBaCl2, 2.0);
    var cS = qgNum(p.cNa2SO4, 0.50), vS = qgNum(p.vNa2SO4, 5.0);
    var T = qgNum(p.temp, 25);
    var nBa = cB * vB, nSO4 = cS * vS;
    var nPre = Math.min(nBa, nSO4);
    var vTot = vB + vS;
    var cBaLeft = (nBa - nPre) / vTot;
    if (cBaLeft < 0) cBaLeft = 0;
    var complete = nBa > 0 ? nPre / nBa * 100 : 0;
    /* 水温高 → 沉淀颗粒长大、沉降快（"陈化"效应）：澄清时间按 Arrhenius 式缩短 */
    var settle = 150 * Math.exp(-0.055 * (T - 20));
    if (settle < 6) settle = 6;
    /* 陈化充分时细颗粒减少，上层液更清 */
    var turbid = qgClamp(Math.sqrt(nPre * M_BASO4) * 2.2 * (1 + 26 / (T + 26)), 0, 100);
    return { nBa: nBa, nSO4: nSO4, nPre: nPre, mPre: nPre * M_BASO4, vTot: vTot,
             cBaLeft: cBaLeft, complete: complete, settle: settle, turbid: turbid,
             T: T, acid: p.acid || 'none' };
  }
  function baso4Phen(m, p) {
    var out = [];
    if (m.nPre > 0) {
      out.push('滴入 BaCl₂ 后立即出现**白色**沉淀（BaSO₄），振荡也不消失');
      out.push('静置 ' + qgRound(m.settle, 0) + ' s 左右上层液开始变清，白色固体沉在管底（' +
               (m.T >= 60 ? '水温高，颗粒长得大、沉降快' : '水温低，沉淀细而分散、沉降慢') + '）');
    } else {
      out.push('没有出现沉淀：Ba²⁺ 或 SO₄²⁻ 的量太少，离子积还没超过 Ksp(BaSO₄) = 1.1×10⁻¹⁰');
    }
    if (m.acid === 'hcl') out.push('加稀盐酸后振荡：沉淀**不溶解**（BaSO₄ 不溶于稀盐酸，这是 SO₄²⁻ 检验的判据）');
    if (m.acid === 'hno3') out.push('加稀硝酸后振荡：沉淀**不溶解**（BaSO₄ 也不溶于稀硝酸）');
    if (m.acid === 'none' && m.nPre > 0) out.push('（还没加酸：要排除 CO₃²⁻ 等干扰必须再酸化一次，沉淀不溶才能判定含 SO₄²⁻）');
    if (m.nBa > 0 && m.complete < 99.5) {
      out.push('Ba²⁺ 没有沉淀完全：反应后 c(Ba²⁺) ≈ ' + qgSigStr(m.cBaLeft, 2) +
               ' mol/L（> 1×10⁻⁵ mol/L）');
    }
    if (m.nPre > 0) {
      if (Math.abs(m.nBa - m.nSO4) <= 0.02 * Math.max(m.nBa, m.nSO4, 1e-9)) {
        out.push('Ba²⁺ 与 SO₄²⁻ 恰好按 1:1 完全反应，沉淀量达到这一组的最大值 ' +
                 qgSigStr(m.mPre, 3) + ' mg');
      } else if (m.nBa < m.nSO4) {
        out.push('SO₄²⁻ 过量、Ba²⁺ 不足：沉淀的量由 Ba²⁺ 决定（限量试剂）——' +
                 '这正是重量法测 SO₄²⁻ 时"必须让 BaCl₂ 按待测液里 SO₄²⁻ 的量加"的原因');
      } else {
        out.push('Ba²⁺ 过量、SO₄²⁻ 不足：沉淀的量由 SO₄²⁻ 决定，只有 ' +
                 qgSigStr(m.mPre, 3) + ' mg');
      }
    }
    return out;
  }
  API.register('baso4-precip', {
    id: 'baso4-precip',
    name: '氯化钡与硫酸钠（硫酸根离子的检验）',
    group: '离子反应与溶液平衡',
    aim: '观察 Ba²⁺ 与 SO₄²⁻ 生成不溶于稀盐酸的白色 BaSO₄ 沉淀，学会 SO₄²⁻ 的检验',
    principle: 'BaCl₂ 与 Na₂SO₄ 都是易溶强电解质，电离出的 Ba²⁺ 与 SO₄²⁻ 结合成极难溶的 BaSO₄' +
               '（Ksp = 1.1×10⁻¹⁰）：Ba²⁺ + SO₄²⁻ = BaSO₄↓。BaSO₄ 既不溶于水也不溶于稀盐酸、' +
               '稀硝酸，因此"先加足量稀盐酸酸化、再加 BaCl₂ 出现白色沉淀"就是 SO₄²⁻ 的检验方法' +
               '（酸化是为了排除 CO₃²⁻、SO₃²⁻ 等生成的可溶性钡盐的干扰）。正因为 BaSO₄ 不溶于酸、' +
               '又不易被 X 射线透过，它才能做"钡餐"；而可溶性钡盐和 BaCO₃ 有毒，不能入口。',
    apparatus: ['试管', '试管架', '胶头滴管', '量筒', '水浴（调温用）', 'Na₂SO₄ 溶液',
                'BaCl₂ 溶液', '稀盐酸', '稀硝酸'],
    steps: ['取 vBaCl2 mL BaCl₂ 溶液加入试管',
            '加入 vNa2SO4 mL Na₂SO₄ 溶液，振荡，观察白色沉淀的生成与沉降',
            '把试管放进设定温度的水浴里，记录上层液变清所需的时间',
            '再加少量稀盐酸（或稀硝酸），振荡，观察沉淀是否溶解',
            '改变两种溶液的浓度与体积，比较沉淀量与"沉淀完全度"'],
    params: [
      { key: 'cBaCl2', label: 'BaCl₂ 溶液浓度', unit: 'mol/L', min: 0.01, max: 0.20, step: 0.01, value: 0.10 },
      { key: 'vBaCl2', label: 'BaCl₂ 溶液体积', unit: 'mL', min: 1, max: 10, step: 0.5, value: 2.0 },
      { key: 'cNa2SO4', label: 'Na₂SO₄ 溶液浓度', unit: 'mol/L', min: 0.01, max: 1.00, step: 0.01, value: 0.50 },
      { key: 'vNa2SO4', label: 'Na₂SO₄ 溶液体积', unit: 'mL', min: 1, max: 10, step: 0.5, value: 5.0 },
      { key: 'temp', label: '水浴温度', unit: '℃', min: 20, max: 80, step: 5, value: 25 },
      { key: 'acid', label: '再加的酸', type: 'select', value: 'hcl', options: BASO4_ACID }
    ],
    react: function (p, ctx) {
      var m = baso4Model(p), idx = qgNum(ctx && ctx.index, 0);
      var rnd = qgRng(idx * 6619 + Math.round(m.nPre * 991) + 7);
      return {
        phenomena: baso4Phen(m, p),
        equation: 'BaCl2 + Na2SO4 = BaSO4↓ + 2NaCl',
        ionic: 'Ba2+ + SO42- = BaSO4↓',
        type: '复分解反应（沉淀反应 / 离子反应）',
        conditions: m.acid === 'none' ? ('常温' + (m.T >= 60 ? '、水浴加热至 ' + m.T + ' ℃' : ''))
                                      : ('常温；再滴加' + (m.acid === 'hcl' ? '稀盐酸' : '稀硝酸') + '酸化'),
        measures: {
          nBa: qgSig(m.nBa, 3), nSO4: qgSig(m.nSO4, 3),
          nLimit: qgSig(Math.min(m.nBa, m.nSO4), 3),
          nPre: qgSig(m.nPre, 4), mPre: qgSig(m.mPre, 4),
          complete: qgSig(m.complete, 3), cBaLeft: qgSig(m.cBaLeft, 2),
          settle: qgSig(m.settle * (0.97 + 0.06 * rnd()), 3),
          turb: qgSig(m.turbid * (0.99 + 0.02 * rnd()), 3)
        }
      };
    },
    columns: [
      { key: 'nBa', label: '加入 Ba²⁺ 的物质的量', unit: 'mmol' },
      { key: 'nSO4', label: '加入 SO₄²⁻ 的物质的量', unit: 'mmol' },
      { key: 'nLimit', label: '限制试剂的物质的量', unit: 'mmol' },
      { key: 'nPre', label: '生成 BaSO₄ 的物质的量', unit: 'mmol' },
      { key: 'mPre', label: 'BaSO₄ 沉淀质量', unit: 'mg' },
      { key: 'complete', label: 'Ba²⁺ 的沉淀完全度', unit: '%' },
      { key: 'cBaLeft', label: '反应后 c(Ba²⁺)', unit: 'mol/L' },
      { key: 'settle', label: '上层液变清所需时间', unit: 's' },
      { key: 'turb', label: '上层液浑浊程度（相对）', unit: '' }
    ],
    graph: {
      x: 'nPre', y: 'mPre', fit: 'origin',
      title: 'BaSO₄ 沉淀质量 m 与沉淀的物质的量 n 的关系',
      note: 'm = M·n，斜率即 BaSO₄ 的摩尔质量 233.36 g/mol（Ba 137.3 + S 32.06 + O 4×16.00）。' +
            '"谁是限制试剂、沉淀完全不完全"请看 nLimit 与 complete 两列：加入量超过另一方的' +
            '化学计量时，沉淀量不再增加（出现平台），那一段本来就不该按直线读。',
      xLabel: '生成 BaSO₄ 的物质的量 n / mmol',
      yLabel: '沉淀质量 m / mg'
    },
    conclude: function (rows, p) {
      var m = baso4Model(p), n = rows ? rows.length : 0;
      var txt = 'BaCl₂ 与 Na₂SO₄ 反应生成不溶于稀盐酸（也不溶于稀硝酸）的白色 BaSO₄ 沉淀：' +
                'Ba²⁺ + SO₄²⁻ = BaSO₄↓（Ksp = 1.1×10⁻¹⁰）。本次 n(Ba²⁺) = ' + qgSigStr(m.nBa, 3) +
                ' mmol、n(SO₄²⁻) = ' + qgSigStr(m.nSO4, 3) + ' mmol，生成 BaSO₄ ' +
                qgSigStr(m.nPre, 3) + ' mmol（' + qgSigStr(m.mPre, 3) + ' mg），沉淀完全度 ' +
                qgSigStr(m.complete, 3) + '%。';
      if (m.complete < 99.5) {
        txt += ' 由于 Ba²⁺ 过量，反应后 c(Ba²⁺) ≈ ' + qgSigStr(m.cBaLeft, 2) +
               ' mol/L > 1×10⁻⁵ mol/L，按教材口径不算沉淀完全。';
      }
      if (m.T >= 60) txt += ' 水浴升温使沉淀颗粒长大（陈化），沉降时间缩短到约 ' +
                            qgRound(m.settle, 0) + ' s。';
      txt += ' 结论：SO₄²⁻ 的检验方法是"先用足量稀盐酸酸化，再加 BaCl₂ 溶液，出现不溶于酸的白色沉淀"。';
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: 'BaCl2 + Na2SO4 = BaSO4↓ + 2NaCl',
        ionic: 'Ba2+ + SO42- = BaSO4↓',
        errors: [
          '用 Ba(NO₃)₂ 或把酸化用的酸换成稀硝酸代替 BaCl₂/稀盐酸：若试液里含 SO₃²⁻，硝酸会把它氧化成 SO₄²⁻ 造成假阳性；正确做法是"稀盐酸酸化 + BaCl₂"',
          '酸化用的盐酸加得不够：CO₃²⁻、SO₃²⁻、PO₄³⁻ 都会生成溶于酸的白色钡盐沉淀，不酸化就会把干扰当成 SO₄²⁻',
          '沉淀没有洗涤就称量：表面吸附的 Cl⁻、Na⁺ 及可溶性杂质会使沉淀质量偏大（重量法测 SO₄²⁻ 的主要系统误差）',
          'BaCl₂、Ba(OH)₂ 等可溶性钡盐与 BaCO₃ 都有毒，实验后废液必须回收处理，不能直接倒入下水道'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = baso4Model(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, '硫酸根离子的检验：BaCl₂ + Na₂SO₄',
               m.acid === 'none' ? '未酸化' : ('已加' + (m.acid === 'hcl' ? '稀盐酸' : '稀硝酸')));
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管里的现象',
                '水浴 ' + qgRound(m.T, 0) + ' ℃');
        var tx = M + 84, ty = y1 + 46, tw = 62, th = Math.min(h1 - 70, 200);
        if (th < 90) th = 90;
        /* 上层液浑浊程度直接画进液色（浊度越高越乳白） */
        var al = qgClamp(0.20 + m.turbid / 100 * 0.72, 0, 0.95);
        var liquid = 'rgba(248,248,244,' + qgRound(al, 2) + ')';
        qgTube(d, F, tx, ty, tw, th, 0.86, liquid, '反应液', '#6B645C');
        var amt = qgClamp(m.mPre / 60, 0, 1);
        qgPrecip(d, 3101 + Math.round(m.mPre), tx - tw / 2 + 3, ty + th - 8, tw - 6, 28,
                 amt, 'rgba(252,252,250,0.99)', 8);
        if (amt > 0.02) d.txt('白色 BaSO₄', tx, ty + th - 36, F(10, true, false), '#5A5348', 'center');
        if (m.acid !== 'none' && amt > 0.02) {
          d.txt('酸洗后仍不溶解', tx + tw / 2 + 10, ty + 16, F(10.5, true, false), '#2E6B4F', 'left');
        }
        /* 水浴槽 */
        var bx = M + 196, by = y1 + h1 - 62, bw = 150, bh = 38;
        qgBeaker(d, F, bx, by, bw, bh, 0.9, 'rgba(160,200,230,0.45)', '水浴 ' + qgRound(m.T, 0) + ' ℃');
        d.txt('沉降（变清）约 ' + qgRound(m.settle, 0) + ' s',
              bx + bw + 12, by + 18, F(10.5, false, true), '#6B645C', 'left');
        var rx = M + 370;
        qgReadout(d, F, rx, y1 + 52, 122, [
          ['n(Ba²⁺) / mmol', qgSigStr(m.nBa, 3), INK],
          ['n(SO₄²⁻) / mmol', qgSigStr(m.nSO4, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 122, [
          ['n(BaSO₄) / mmol', qgSigStr(m.nPre, 3), '#7A4A2B'],
          ['m(BaSO₄) / mg', qgSigStr(m.mPre, 3), '#7A4A2B']
        ]);
        qgReadout(d, F, rx, y1 + 132, 122, [
          ['沉淀完全度', qgPct(m.complete, 1), m.complete > 99.5 ? '#2E6B4F' : '#A03028'],
          ['c(Ba²⁺) / (mol/L)', qgSigStr(m.cBaLeft, 2), INK]
        ]);
        var rec = qgRowText(rows, [['nPre', 'n/mmol'], ['mPre', 'm/mg'],
                                   ['complete', '完全度/%'], ['settle', '变清/s']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 5 · 反应 3／9 —— cuoh2-precip（CuSO₄ + NaOH，加热分解为黑色 CuO）    *
   * ==================================================================== */
  function cuoh2Model(p) {
    var cCu = qgNum(p.cCuSO4, 0.10), vCu = qgNum(p.vCuSO4, 2.0);
    var cOH = qgNum(p.cNaOH, 1.00), dOH = qgInt(p.dropsNaOH, 10);
    var T = qgNum(p.temp, 20), t = qgNum(p.time, 0);
    var nCu = cCu * vCu, nOH = cOH * dOH * ML_PER_DROP;
    var vTot = vCu + dOH * ML_PER_DROP;
    var nPre = Math.min(nCu, nOH / 2);              /* Cu(OH)₂ */
    var cCuLeft = (nCu - nPre) / vTot;
    if (cCuLeft < 0) cCuLeft = 0;
    var complete = nCu > 0 ? nPre / nCu * 100 : 0;
    /* 碱过量倍数：> 4 倍时能明显看出"Fe(OH)₃ 型"的不溶于过量碱（Cu(OH)₂ 也不溶于 NaOH，
       但这里用它表示"碱是否过量"这个条件） */
    var over = nCu > 0 ? (nOH / 2) / nCu : 0;
    /* 热分解：Cu(OH)₂ =Δ= CuO + H₂O。60 ℃ 以下基本不分解，100 ℃ 起很快分解完全。 */
    var aEq = qgClamp((T - 60) / 40, 0, 1);
    var dec = aEq * (1 - Math.exp(-Math.max(t, 0) / 60));   /* 分解率 */
    var mCuOH2 = nPre * M_CUOH2, mCuO = nPre * M_CUO;
    var mSolid = mCuOH2 * (1 - dec) + mCuO * dec;
    return { nCu: nCu, nOH: nOH, nPre: nPre, complete: complete, cCuLeft: cCuLeft,
             over: over, T: T, t: t, dec: dec, mCuOH2: mCuOH2, mCuO: mCuO,
             mSolid: mSolid, vTot: vTot };
  }
  function cuoh2Phen(m, p) {
    var out = [];
    if (m.nPre > 0) {
      out.push('滴入 NaOH 后立即出现**蓝色絮状**沉淀（Cu(OH)₂），振荡不消失');
      out.push('静置后蓝色沉淀沉在管底，上层液' +
               (m.cCuLeft > 1e-3 ? '仍显明显的蓝色（Cu²⁺ 没沉淀完）' : '几乎无色'));
    } else {
      out.push('没有出现蓝色沉淀：OH⁻ 太少');
    }
    if (m.nCu > 0 && m.complete < 99.5) {
      out.push('碱不够：Cu²⁺ 只沉淀了 ' + qgPct(m.complete, 1) + '，反应后 c(Cu²⁺) ≈ ' +
               qgSigStr(m.cCuLeft, 2) + ' mol/L（> 1×10⁻⁵ mol/L，不算沉淀完全）');
    } else if (m.nPre > 0) {
      out.push('碱足量：Cu²⁺ 基本沉淀完全（' + qgPct(m.complete, 1) + '），上层液几乎无色');
    }
    if (m.over >= 4 && m.nPre > 0) {
      out.push('NaOH 明显过量（约 ' + qgRound(m.over, 1) + ' 倍化学计量）：蓝色沉淀**不溶解**' +
               '（Cu(OH)₂ 不溶于过量 NaOH，这一点与 Al(OH)₃ 不同）');
    }
    if (m.T >= 60 && m.t > 0) {
      if (m.dec < 0.02) {
        out.push('加热到 ' + qgRound(m.T, 0) + ' ℃ 才 ' + qgRound(m.t, 0) +
                 ' s，蓝色还没有明显变化（温度不够/时间太短）');
      } else if (m.dec < 0.85) {
        out.push('加热 ' + qgRound(m.t, 0) + ' s（' + qgRound(m.T, 0) + ' ℃）：蓝色逐渐变深、发暗，' +
                 '底部出现**黑色**固体（已分解 ' + qgPct(m.dec * 100, 0) + '）');
        out.push('黑色固体是 CuO：Cu(OH)₂ =Δ= CuO + H₂O');
      } else {
        out.push('加热 ' + qgRound(m.t, 0) + ' s（' + qgRound(m.T, 0) + ' ℃）：蓝色沉淀全部变成' +
                 '**黑色**粉末状 CuO，试管内壁有**水珠**生成');
        out.push('这是"难溶性碱受热分解"的典型现象：Cu(OH)₂ =Δ= CuO + H₂O');
      }
    } else if (m.T < 60) {
      out.push('温度低于 60 ℃：即使放很久，蓝色沉淀也不分解（Cu(OH)₂ 的分解需要加热）');
    }
    return out;
  }
  API.register('cuoh2-precip', {
    id: 'cuoh2-precip',
    name: '硫酸铜与氢氧化钠（蓝色沉淀与它的热分解）',
    group: '离子反应与溶液平衡',
    aim: '观察 Cu²⁺ 与 OH⁻ 生成蓝色 Cu(OH)₂ 沉淀；加热使它分解为黑色 CuO，并研究碱的用量对沉淀完全度的影响',
    principle: 'CuSO₄ 与 NaOH 在溶液中电离出的 Cu²⁺ 与 OH⁻ 结合成难溶的蓝色 Cu(OH)₂' +
               '（Ksp = 2.2×10⁻²⁰）：Cu²⁺ + 2OH⁻ = Cu(OH)₂↓。沉淀的量由不足的那一方决定：' +
               'n[Cu(OH)₂] = min(n(Cu²⁺), n(OH⁻)/2)，碱不足时 Cu²⁺ 沉淀不完全、溶液仍显蓝色。' +
               'Cu(OH)₂ 是难溶性碱，受热分解生成黑色的 CuO 和水：Cu(OH)₂ =Δ= CuO + H₂O' +
               '（与 Fe(OH)₃ 受热失水生成 Fe₂O₃ 同一类反应）。注意 Cu(OH)₂ 与 Al(OH)₃ 不同，' +
               '它不溶于过量的 NaOH。',
    apparatus: ['试管', '试管夹', '试管架', '胶头滴管', '量筒', '酒精灯', 'CuSO₄ 溶液', 'NaOH 溶液'],
    steps: ['取 vCuSO4 mL CuSO₄ 溶液加入试管',
            '滴入 dropsNaOH 滴 NaOH 溶液，边滴边振荡，观察蓝色絮状沉淀',
            '静置，观察上层液的颜色（判断 Cu²⁺ 有没有沉淀完全）',
            '用试管夹夹住试管在酒精灯上加热到设定温度，保持设定时间',
            '观察沉淀由蓝变黑的过程，并注意试管内壁是否有水珠',
            '改变碱的浓度/滴数，比较沉淀量与沉淀完全度'],
    params: [
      { key: 'cCuSO4', label: 'CuSO₄ 溶液浓度', unit: 'mol/L', min: 0.01, max: 0.20, step: 0.01, value: 0.10 },
      { key: 'vCuSO4', label: 'CuSO₄ 溶液体积', unit: 'mL', min: 1, max: 10, step: 0.5, value: 2.0 },
      { key: 'cNaOH', label: 'NaOH 溶液浓度', unit: 'mol/L', min: 0.05, max: 2.00, step: 0.05, value: 1.00 },
      { key: 'dropsNaOH', label: '滴入 NaOH 的滴数', unit: '滴', min: 1, max: 40, step: 1, value: 10 },
      { key: 'temp', label: '加热温度', unit: '℃', min: 20, max: 500, step: 20, value: 20 },
      { key: 'time', label: '加热时间', unit: 's', min: 0, max: 300, step: 10, value: 0 }
    ],
    react: function (p, ctx) {
      var m = cuoh2Model(p), idx = qgNum(ctx && ctx.index, 0);
      var rnd = qgRng(idx * 5231 + Math.round(m.nPre * 977) + 3);
      return {
        phenomena: cuoh2Phen(m, p),
        equation: m.dec > 0.02 ? 'Cu(OH)2 = CuO + H2O' : 'CuSO4 + 2NaOH = Cu(OH)2↓ + Na2SO4',
        ionic: m.dec > 0.02 ? 'Cu(OH)2 = CuO + H2O' : 'Cu2+ + 2OH- = Cu(OH)2↓',
        type: m.dec > 0.02 ? '分解反应（难溶性碱受热分解）' : '复分解反应（沉淀反应）',
        conditions: m.dec > 0.02 ? ('加热 ' + qgRound(m.T, 0) + ' ℃，' + qgRound(m.t, 0) + ' s')
                                 : '常温',
        measures: {
          nCu: qgSig(m.nCu, 3), nOH: qgSig(m.nOH, 3),
          nPre: qgSig(m.nPre, 4), mSolid: qgSig(m.mSolid * (0.995 + 0.01 * rnd()), 4),
          complete: qgSig(m.complete, 3), cCuLeft: qgSig(m.cCuLeft, 2),
          dec: qgSig(m.dec * 100, 3), blackPct: qgSig(m.dec * 100, 3)
        }
      };
    },
    columns: [
      { key: 'nCu', label: '加入 Cu²⁺ 的物质的量', unit: 'mmol' },
      { key: 'nOH', label: '加入 OH⁻ 的物质的量', unit: 'mmol' },
      { key: 'nPre', label: '生成 Cu(OH)₂ 的物质的量', unit: 'mmol' },
      { key: 'mSolid', label: '试管里固体的质量', unit: 'mg' },
      { key: 'complete', label: 'Cu²⁺ 的沉淀完全度', unit: '%' },
      { key: 'cCuLeft', label: '反应后 c(Cu²⁺)', unit: 'mol/L' },
      { key: 'dec', label: 'Cu(OH)₂ 的分解率', unit: '%' },
      { key: 'blackPct', label: '黑色固体（CuO）占比', unit: '%' }
    ],
    graph: {
      x: 'nPre', y: 'mSolid', fit: 'origin',
      title: '试管里固体的质量与 Cu(OH)₂ 的物质的量的关系',
      note: '未分解时 m = n·97.57（Cu(OH)₂），分解完全后 m = n·79.55（CuO），两者都过原点、' +
            '都是直线 —— 点在直线上移向下方就表示"脱水变轻了"。横轴取沉淀的物质的量而不是' +
            '加入量：加入量超过另一方的化学计量时沉淀量会出现平台（限量试剂），那一段不是直线。',
      xLabel: '生成 Cu(OH)₂ 的物质的量 n / mmol',
      yLabel: '固体质量 m / mg'
    },
    conclude: function (rows, p) {
      var m = cuoh2Model(p), n = rows ? rows.length : 0;
      var txt = 'CuSO₄ 与 NaOH 反应生成蓝色絮状 Cu(OH)₂ 沉淀：Cu²⁺ + 2OH⁻ = Cu(OH)₂↓' +
                '（Ksp = 2.2×10⁻²⁰）。本次 n(Cu²⁺) = ' + qgSigStr(m.nCu, 3) + ' mmol、n(OH⁻) = ' +
                qgSigStr(m.nOH, 3) + ' mmol，生成 Cu(OH)₂ ' + qgSigStr(m.nPre, 3) + ' mmol（' +
                qgSigStr(m.mCuOH2, 3) + ' mg）。';
      if (m.complete < 99.5) {
        txt += ' OH⁻ 不足，Cu²⁺ 只沉淀了 ' + qgSigStr(m.complete, 3) + '%，反应后 c(Cu²⁺) ≈ ' +
               qgSigStr(m.cCuLeft, 2) + ' mol/L —— "加碱量不足 → 沉淀不完全"在数据上就是这一列。';
      } else {
        txt += ' OH⁻ 足量，Cu²⁺ 基本沉淀完全。';
      }
      if (m.dec > 0.02) {
        txt += ' 加热到 ' + qgRound(m.T, 0) + ' ℃ 保持 ' + qgRound(m.t, 0) + ' s 后，有 ' +
               qgPct(m.dec * 100, 0) + ' 的 Cu(OH)₂ 分解为黑色 CuO（Cu(OH)₂ =Δ= CuO + H₂O），' +
               '固体质量由 ' + qgSigStr(m.mCuOH2, 3) + ' mg 减到 ' + qgSigStr(m.mSolid, 3) +
               ' mg（少了的水以水珠形式凝在管壁上）。';
      } else {
        txt += ' 温度低于 60 ℃（或加热时间太短）时沉淀不分解，仍是蓝色的 Cu(OH)₂。';
      }
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: 'CuSO4 + 2NaOH = Cu(OH)2↓ + Na2SO4',
        ionic: 'Cu2+ + 2OH- = Cu(OH)2↓',
        errors: [
          'NaOH 加得不足：Cu²⁺ 沉淀不完全，上层液仍显蓝色，会误判成"反应没发生"；要让 Cu²⁺ 沉淀完全，n(OH⁻) 至少要达到 2n(Cu²⁺)',
          '加热时试管口对着人、或加热过猛：Cu(OH)₂ 受热会溅出，且分解产生的水蒸气会带出碱液，必须用试管夹并让管口朝无人方向',
          '把"蓝色变黑"当作唯一判据：NaOH 过量很多并长时间加热时，黑色的 CuO 可能沉在管底被蓝色糊状物盖住，要振荡后再看；试管内壁的水珠才是"分解生成了水"的直接证据',
          '用自来水或未洗净的试管：Cl⁻、CO₃²⁻ 会与 Cu²⁺ 生成碱式碳酸铜等浅绿色杂沉淀，使"蓝色"的判断失准'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = cuoh2Model(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, 'CuSO₄ + NaOH：蓝色沉淀与热分解',
               m.dec > 0.02 ? ('加热 ' + qgRound(m.T, 0) + ' ℃／' + qgRound(m.t, 0) + ' s') : '常温');
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管里的现象',
                m.dec > 0.02 ? '沉淀正在由蓝变黑' : '蓝色絮状沉淀');
        var tx = M + 84, ty = y1 + 46, tw = 62, th = Math.min(h1 - 70, 200);
        if (th < 90) th = 90;
        /* 上层液：Cu²⁺ 剩余越多越蓝 */
        var cu = qgClamp(m.cCuLeft / 0.06, 0, 1);
        var liquid = 'rgba(' + Math.round(214 - 60 * cu) + ',' + Math.round(228 - 40 * cu) + ',' +
                     Math.round(238 - 30 * cu) + ',0.75)';
        qgTube(d, F, tx, ty, tw, th, 0.86, liquid, '反应液', '#6B645C');
        /* 沉淀颜色：蓝 (Ksp 型) → 黑，按分解率线性混色 */
        var r0 = 96, g0 = 156, b0 = 214, r1 = 26, g1 = 26, b1 = 26;
        var pc = 'rgba(' + Math.round(r0 + (r1 - r0) * m.dec) + ',' +
                          Math.round(g0 + (g1 - g0) * m.dec) + ',' +
                          Math.round(b0 + (b1 - b0) * m.dec) + ',0.97)';
        var amt = qgClamp(m.nPre / 0.9, 0, 1);
        qgPrecip(d, 4101 + Math.round(m.nPre * 911), tx - tw / 2 + 3, ty + th - 8, tw - 6, 30,
                 amt, pc, 9);
        if (amt > 0.02) {
          d.txt(m.dec > 0.85 ? '黑色 CuO' : (m.dec > 0.02 ? '蓝→黑' : '蓝色 Cu(OH)₂'),
                tx, ty + th - 40, F(10, true, false), '#4A4438', 'center');
        }
        /* 加热：酒精灯 + 管壁水珠 */
        if (m.dec > 0.02) {
          qgFlameShape(d, tx, ty + th + 34, 30, 'rgba(232,152,44,0.8)');
          var k;
          for (k = 0; k < 5; k++) {
            d.circle(tx - tw / 2 + 6 + k * 12, ty + 16 + (k % 2) * 10, 1.6,
                     'rgba(120,180,220,0.9)', null, 0);
          }
          d.txt('管壁水珠（分解生成 H₂O）', tx + tw / 2 + 10, ty + 14,
                F(10.5, true, false), '#2E6B4F', 'left');
        } else {
          qgFlameShape(d, tx, ty + th + 30, 24, 'rgba(200,200,200,0.35)');
          d.txt('（酒精灯未点燃）', tx, ty + th + 46, F(9.5, false, true), '#9A938A', 'center');
        }
        var rx = M + 200;
        qgReadout(d, F, rx, y1 + 52, 132, [
          ['n(Cu²⁺) / mmol', qgSigStr(m.nCu, 3), INK],
          ['n(OH⁻) / mmol', qgSigStr(m.nOH, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 132, [
          ['n[Cu(OH)₂] / mmol', qgSigStr(m.nPre, 3), '#7A4A2B'],
          ['固体质量 m / mg', qgSigStr(m.mSolid, 3), '#7A4A2B']
        ]);
        qgReadout(d, F, rx, y1 + 132, 132, [
          ['沉淀完全度', qgPct(m.complete, 1), m.complete > 99.5 ? '#2E6B4F' : '#A03028'],
          ['分解率', qgPct(m.dec * 100, 0), m.dec > 0.02 ? '#2A2A2A' : '#8A8378']
        ]);
        if (m.over >= 4 && m.nPre > 0) {
          d.txt('NaOH 过量 ' + qgRound(m.over, 1) + ' 倍：沉淀不溶解（区别于 Al(OH)₃）',
                rx, y1 + h1 - 22, F(10.5, false, true), '#8A5A22', 'left');
        }
        var rec = qgRowText(rows, [['nPre', 'n/mmol'], ['mSolid', 'm/mg'],
                                   ['complete', '完全度/%'], ['dec', '分解/%']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 6 · 反应 4／9 —— feoh3-precip（FeCl₃ + NaOH，纯定性）                 *
   *     契约 §3：「纯定性反应：columns: []、graph: null 合法」            *
   * ==================================================================== */
  var FEOH3_IRON = [
    { value: 'fe3', label: 'FeCl₃ 溶液（Fe³⁺）' },
    { value: 'fe2', label: 'FeSO₄ 溶液（Fe²⁺，易被空气氧化）' }
  ];
  var FEOH3_HEAT = [
    { value: 'no', label: '常温、不加热' },
    { value: 'yes', label: '在酒精灯上加热（并灼烧一段时间）' }
  ];
  function feoh3Model(p) {
    var cFe = qgNum(p.cFeCl3, 0.10), vFe = qgNum(p.vFeCl3, 2.0);
    var cOH = qgNum(p.cNaOH, 1.00), dOH = qgInt(p.dropsNaOH, 6);
    var nFe = cFe * vFe, nOH = cOH * dOH * ML_PER_DROP;
    var isFe2 = (p.iron === 'fe2');
    var need = isFe2 ? 2 : 3;                        /* 每个 Fe 需要几个 OH⁻ */
    var nPre = Math.min(nFe, nOH / need);
    var over = nFe > 0 ? (nOH / need) / nFe : 0;
    var left = nFe - nPre;
    return { nFe: nFe, nOH: nOH, nPre: nPre, need: need, over: over, left: left,
             isFe2: isFe2, heat: p.heat === 'yes', cFe: cFe };
  }
  function feoh3Phen(m, p) {
    var out = [];
    if (m.nPre <= 0) {
      out.push('只看到溶液本身的颜色，没有出现沉淀：OH⁻ 太少，离子积还没超过 Ksp');
      return out;
    }
    if (m.isFe2) {
      out.push('滴入 NaOH 后先出现**白色絮状**沉淀（Fe(OH)₂）');
      out.push('白色沉淀很快变成**灰绿色**，再过一段时间（接触空气）转成**红褐色**：' +
               '4Fe(OH)₂ + O₂ + 2H₂O = 4Fe(OH)₃ —— 白色的 Fe(OH)₂ 被溶解在溶液里的氧气氧化了');
      out.push('所以做 Fe(OH)₂ 必须把滴管伸入液面下、必要时加煤油隔绝空气，否则看到的总是灰绿/红褐色');
    } else {
      out.push('滴入 NaOH 后立即出现**红褐色絮状**沉淀（Fe(OH)₃），振荡不消失');
      out.push('静置后红褐色沉淀沉在管底，上层液' +
               (m.left > 1e-3 ? '仍显黄色（Fe³⁺ 没沉淀完）' : '接近无色'));
    }
    if (m.left > 1e-3 && m.nFe > 0) {
      out.push('碱不够：只有 ' + qgRound(m.nPre / m.nFe * 100, 0) + '% 的 Fe 被沉淀，' +
               '剩下的 Fe' + (m.isFe2 ? '²⁺' : '³⁺') + ' 留在溶液里（Fe³⁺ 显黄色）');
    } else {
      out.push('碱足量：Fe' + (m.isFe2 ? '²⁺' : '³⁺') + ' 基本沉淀完全，上层液接近无色');
    }
    if (m.over >= 4) {
      out.push('NaOH 已过量约 ' + qgRound(m.over, 1) + ' 倍化学计量：红褐色沉淀**不溶解**' +
               '（Fe(OH)₃ 不溶于过量强碱；这是它与 Al(OH)₃ 的关键区别）');
    }
    if (m.heat) {
      if (m.isFe2) {
        out.push('加热并灼烧：沉淀先变红褐，最后变成**红棕色**粉末（2Fe(OH)₃ =Δ= Fe₂O₃ + 3H₂O，' +
                 '教材：加热 Fe(OH)₃ 时它能失去水生成红棕色的 Fe₂O₃ 粉末）');
      } else {
        out.push('加热时红褐色絮状沉淀逐渐聚集成较大的颗粒、颜色变深，沉降明显变快');
        out.push('继续灼烧，沉淀变成**红棕色**粉末：2Fe(OH)₃ =Δ= Fe₂O₃ + 3H₂O');
      }
      out.push('试管内壁出现水珠，说明分解生成了水');
    } else {
      out.push('常温下无论放多久，Fe(OH)₃ 的絮状沉淀都不分解（Fe(OH)₃ 的失水需要加热）');
    }
    return out;
  }
  API.register('feoh3-precip', {
    id: 'feoh3-precip',
    name: '氯化铁与氢氧化钠（红褐色沉淀）',
    group: '离子反应与溶液平衡',
    aim: '观察 Fe³⁺ 与 OH⁻ 生成红褐色 Fe(OH)₃ 沉淀；对比 Fe²⁺ 的白色→灰绿→红褐色变化；并考察碱的用量与加热的影响',
    principle: 'FeCl₃ 与 NaOH 电离出的 Fe³⁺ 与 OH⁻ 结合成难溶的红褐色 Fe(OH)₃（Ksp = 2.8×10⁻³⁹）：' +
               'Fe³⁺ + 3OH⁻ = Fe(OH)₃↓（教材实验 3-1）。若用 FeSO₄，先生成白色的 Fe(OH)₂' +
               '（Ksp = 4.9×10⁻¹⁷）：Fe²⁺ + 2OH⁻ = Fe(OH)₂↓，它立刻被溶解在溶液中的氧气氧化成' +
               '红褐色的 Fe(OH)₃：4Fe(OH)₂ + O₂ + 2H₂O = 4Fe(OH)₃，所以现象是"白色→灰绿色→红褐色"。' +
               'Fe(OH)₃ 不溶于过量的强碱（区别于 Al(OH)₃），但受热会失去水生成红棕色的 Fe₂O₃：' +
               '2Fe(OH)₃ =Δ= Fe₂O₃ + 3H₂O。沉淀的量同样由不足的那一方决定。',
    apparatus: ['试管', '试管架', '胶头滴管', '量筒', '酒精灯', '试管夹',
                'FeCl₃ 溶液', 'FeSO₄ 溶液（新制）', 'NaOH 溶液', '煤油（隔绝空气用）'],
    steps: ['取 vFeCl3 mL FeCl₃（或 FeSO₄）溶液加入试管',
            '滴入 dropsNaOH 滴 NaOH 溶液，边滴边振荡，观察沉淀的颜色与形态变化',
            'Fe²⁺ 那组要把滴管伸入液面下滴加，并连续观察白色→灰绿→红褐的变化',
            '静置，看上层液是否还有颜色（判断有没有沉淀完全）',
            '选择加热，用试管夹在酒精灯上加热并灼烧，观察颜色与管壁水珠',
            '把 NaOH 滴数调大，检验沉淀在过量碱中是否溶解'],
    params: [
      { key: 'iron', label: '铁盐的种类', type: 'select', value: 'fe3', options: FEOH3_IRON },
      { key: 'cFeCl3', label: '铁盐溶液浓度', unit: 'mol/L', min: 0.01, max: 1.00, step: 0.01, value: 0.10 },
      { key: 'vFeCl3', label: '铁盐溶液体积', unit: 'mL', min: 1, max: 10, step: 0.5, value: 2.0 },
      { key: 'cNaOH', label: 'NaOH 溶液浓度', unit: 'mol/L', min: 0.05, max: 4.00, step: 0.05, value: 1.00 },
      { key: 'dropsNaOH', label: '滴入 NaOH 的滴数', unit: '滴', min: 1, max: 40, step: 1, value: 15 },
      { key: 'heat', label: '是否加热', type: 'select', value: 'no', options: FEOH3_HEAT }
    ],
    react: function (p) {
      var m = feoh3Model(p);
      return {
        phenomena: feoh3Phen(m, p),
        equation: m.heat
          ? (m.isFe2 ? '4Fe(OH)2 + O2 + 2H2O = 4Fe(OH)3' : '2Fe(OH)3 = Fe2O3 + 3H2O')
          : (m.isFe2 ? 'FeSO4 + 2NaOH = Fe(OH)2↓ + Na2SO4' : 'FeCl3 + 3NaOH = Fe(OH)3↓ + 3NaCl'),
        ionic: m.heat
          ? (m.isFe2 ? '4Fe(OH)2 + O2 + 2H2O = 4Fe(OH)3' : '2Fe(OH)3 = Fe2O3 + 3H2O')
          : (m.isFe2 ? 'Fe2+ + 2OH- = Fe(OH)2↓' : 'Fe3+ + 3OH- = Fe(OH)3↓'),
        type: m.heat ? '分解反应（难溶性碱受热分解）／氧化还原反应'
                     : '复分解反应（沉淀反应）',
        conditions: m.heat ? '常温滴加后，在酒精灯上加热并灼烧' : '常温（Fe²⁺ 组需隔绝空气观察）',
        measures: {}                     /* 纯定性反应：没有可量化量，按契约给 {} */
      };
    },
    columns: [],                        /* 纯定性（契约 §3 明确合法） */
    graph: null,                        /* 纯定性必须写 null */
    conclude: function (rows, p) {
      var m = feoh3Model(p), n = rows ? rows.length : 0;
      var txt = m.isFe2
        ? 'FeSO₄ 与 NaOH 反应生成白色的 Fe(OH)₂ 沉淀（Fe²⁺ + 2OH⁻ = Fe(OH)₂↓），' +
          '它随即被溶解在溶液中的氧气氧化：4Fe(OH)₂ + O₂ + 2H₂O = 4Fe(OH)₃，' +
          '于是现象是"白色絮状 → 灰绿色 → 红褐色"。'
        : 'FeCl₃ 与 NaOH 反应生成红褐色的 Fe(OH)₃ 絮状沉淀：Fe³⁺ + 3OH⁻ = Fe(OH)₃↓' +
          '（Ksp = 2.8×10⁻³⁹）。';
      txt += ' 本次 n(Fe) = ' + qgSigStr(m.nFe, 3) + ' mmol、n(OH⁻) = ' + qgSigStr(m.nOH, 3) +
             ' mmol，按 Fe(OH)' + (m.isFe2 ? '₂' : '₃') + ' 的化学计量，沉淀了 ' +
             qgSigStr(m.nPre, 3) + ' mmol。';
      if (m.left > 1e-3) txt += ' 碱不足，Fe 没有沉淀完全，上层液还带颜色。';
      if (m.over >= 4) txt += ' NaOH 过量时沉淀不溶解 —— Fe(OH)₃ 不是两性氢氧化物。';
      txt += m.heat ? ' 加热灼烧后沉淀变成红棕色 Fe₂O₃ 粉末（2Fe(OH)₃ =Δ= Fe₂O₃ + 3H₂O），管壁有水珠。'
                    : ' 常温下 Fe(OH)₃ 不分解，需要加热才会失水生成 Fe₂O₃。';
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: m.isFe2 ? 'FeCl3 + 3NaOH = Fe(OH)3↓ + 3NaCl' : 'FeCl3 + 3NaOH = Fe(OH)3↓ + 3NaCl',
        ionic: 'Fe3+ + 3OH- = Fe(OH)3↓',
        errors: [
          '制 Fe(OH)₂ 时滴管没有伸入液面下、也没加煤油隔绝空气：白色沉淀一生成就被氧化，只能看到灰绿或红褐色，误以为"Fe²⁺ 也生成红褐色沉淀"',
          'FeSO₄ 溶液本身已经变质（含 Fe³⁺）：一加碱就出现红褐色，必须用新制 FeSO₄ 并加少量铁屑防止氧化',
          'NaOH 滴加过量很多：红褐色沉淀会变得很稠、包住未反应的 Fe³⁺，使"是否沉淀完全"的判断失真；判断完全应按上层清液的颜色',
          '灼烧时试管口对着人、或直接用大火：Fe(OH)₃ 分解产生的水蒸气会把碱液带出，且骤热易炸管，要预热并让管口朝无人方向'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = feoh3Model(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, 'Fe 盐 + NaOH：红褐色沉淀',
               (m.isFe2 ? 'Fe²⁺' : 'Fe³⁺') + (m.heat ? '　加热灼烧' : '　常温'));
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管里的现象',
                m.heat ? '灼烧中' : '滴加碱后');
        var tx = M + 84, ty = y1 + 46, tw = 62, th = Math.min(h1 - 70, 200);
        if (th < 90) th = 90;
        /* 上层液：Fe³⁺ 剩余呈黄色；Fe²⁺ 剩余呈浅绿色 */
        var frac = m.nFe > 0 ? qgClamp(m.left / m.nFe, 0, 1) : 0;
        var liquid = m.isFe2
          ? 'rgba(' + Math.round(226 - 30 * frac) + ',' + Math.round(238 - 20 * frac) + ',' +
            Math.round(226 - 30 * frac) + ',0.85)'
          : 'rgba(' + Math.round(240 - 20 * frac) + ',' + Math.round(232 - 60 * frac) + ',' +
            Math.round(210 - 90 * frac) + ',0.85)';
        qgTube(d, F, tx, ty, tw, th, 0.86, liquid, '反应液', '#6B645C');
        /* 沉淀颜色：Fe(OH)₃ 红褐 #8B3A1E；Fe(OH)₂ 白 → 灰绿 → 红褐（按观察序号推进，
           但一加热就直接红褐/红棕） */
        var pc, lab;
        if (m.isFe2 && !m.heat) {
          var k = qgNum(state && state.rowCount, 0);      /* 观察次数推进氧化程度 */
          pc = (k % 3 === 0) ? 'rgba(246,246,242,0.98)'
             : (k % 3 === 1) ? 'rgba(150,168,140,0.96)' : 'rgba(139,58,30,0.95)';
          lab = (k % 3 === 0) ? '白色 Fe(OH)₂' : (k % 3 === 1 ? '灰绿色' : '红褐色 Fe(OH)₃');
        } else {
          pc = m.heat ? 'rgba(150,63,26,0.97)' : 'rgba(139,58,30,0.95)';
          lab = m.heat ? '红棕色 Fe₂O₃' : '红褐色 Fe(OH)₃';
        }
        var amt = qgClamp(m.nPre / 0.6, 0, 1);
        qgPrecip(d, 5101 + Math.round(m.nPre * 877), tx - tw / 2 + 3, ty + th - 8, tw - 6, 30,
                 amt, pc, 11);
        if (amt > 0.02) d.txt(lab, tx, ty + th - 42, F(10, true, false), '#4A3A30', 'center');
        if (m.heat) {
          qgFlameShape(d, tx, ty + th + 34, 30, 'rgba(232,152,44,0.8)');
          var kk;
          for (kk = 0; kk < 4; kk++) {
            d.circle(tx - tw / 2 + 10 + kk * 13, ty + 18 + (kk % 2) * 9, 1.5,
                     'rgba(120,180,220,0.9)', null, 0);
          }
          d.txt('管壁水珠', tx + tw / 2 + 10, ty + 16, F(10.5, true, false), '#2E6B4F', 'left');
        }
        var rx = M + 200;
        qgReadout(d, F, rx, y1 + 52, 132, [
          ['n(Fe) / mmol', qgSigStr(m.nFe, 3), INK],
          ['n(OH⁻) / mmol', qgSigStr(m.nOH, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 132, [
          ['沉淀 n / mmol', qgSigStr(m.nPre, 3), '#7A4A2B'],
          ['需要的 OH⁻/Fe', String(m.need), INK]
        ]);
        qgReadout(d, F, rx, y1 + 132, 132, [
          ['沉淀完全度', qgPct(m.nFe > 0 ? m.nPre / m.nFe * 100 : 0, 1),
           (m.left <= 1e-3 && m.nPre > 0) ? '#2E6B4F' : '#A03028'],
          ['碱过量倍数', m.over > 0 ? (qgRound(m.over, 1) + ' 倍') : '—', INK]
        ]);
        d.txt(m.over >= 4 ? '过量碱中沉淀不溶解：Fe(OH)₃ 不是两性氢氧化物'
                          : '（把 NaOH 滴数调大，检验沉淀在过量碱中是否溶解）',
              rx, y1 + h1 - 22, F(10.5, false, true), '#8A5A22', 'left');
        var rec = qgRowText(rows, [['phenomena', '现象条数']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
        d.txt('观察记录（纯定性反应：没有量化列，画面靠现象与记录变化）',
              M + 14, y1 + h1 - 6, F(10, false, true), '#8A8378', 'left');
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 7 · 反应 5／9 —— carbonate-acid（Na₂CO₃ + 盐酸，纯定性）              *
   * ==================================================================== */
  var CARB_ORDER = [
    { value: 'acid2carb', label: '把盐酸滴入 Na₂CO₃ 溶液（先无气泡）' },
    { value: 'carb2acid', label: '把 Na₂CO₃ 溶液滴入盐酸（立即冒气泡）' }
  ];
  function carbModel(p) {
    var cHCl = qgNum(p.cHCl, 1.00), cNa = qgNum(p.cNa2CO3, 0.10), vNa = qgNum(p.vNa2CO3, 5.0);
    var drops = qgInt(p.drops, 12), T = qgNum(p.temp, 25);
    var nNa = cNa * vNa;                       /* mmol Na₂CO₃ */
    var nH = cHCl * drops * ML_PER_DROP;       /* mmol 盐酸（按一元酸计） */
    var nH2 = cHCl * 5.0;                      /* carb2acid 时试管里固有的是 5 mL 盐酸 */
    var stage, nCO2, turning = nNa / (cHCl * ML_PER_DROP);  /* acid2carb 的转折滴数 */
    if (p.order === 'carb2acid') {
      var nNaAdd = cNa * drops * ML_PER_DROP;
      stage = 'direct';
      nCO2 = Math.min(nNaAdd, nH2 / 2);
    } else {
      if (nH <= nNa) { stage = 'first'; nCO2 = 0; }
      else { stage = 'second'; nCO2 = Math.min(nNa, (nH - nNa) / 2); }
    }
    /* 冒泡剧烈程度：与浓度、温度、CO₂ 量有关 */
    var rate = nCO2 * (0.6 + cHCl) * Math.exp(0.035 * (T - 25));
    return { nNa: nNa, nH: nH, stage: stage, nCO2: nCO2, turning: turning,
             rate: rate, T: T, cHCl: cHCl, order: p.order, drops: drops };
  }
  function carbPhen(m, p) {
    var out = [];
    if (m.order === 'carb2acid') {
      if (m.nCO2 > 0) {
        out.push('Na₂CO₃ 溶液一落进盐酸里就**剧烈冒气泡**（CO₂），液面翻腾，能听到"嘶嘶"声');
        out.push('这里盐酸始终过量，发生的是一步到位的反应：CO₃²⁻ + 2H⁺ = H₂O + CO₂↑');
        out.push('反应放热，用手摸试管外壁能感到**发热**');
      } else {
        out.push('几乎没有气泡：滴入的 Na₂CO₃ 太少');
      }
    } else {
      if (m.stage === 'first') {
        out.push('**开始一段时间没有气泡**，溶液只是被稀释、微微发热');
        out.push('因为 Na₂CO₃ 过量，先生成的是碳酸氢钠：CO₃²⁻ + H⁺ = HCO₃⁻' +
                 '（教材上的原话是"开始无气泡产生，一段时间后产生气泡"）');
        out.push('继续滴加盐酸：按当前浓度，滴到第 ' + Math.ceil(m.turning) + ' 滴左右才会开始冒气泡');
      } else if (m.stage === 'second') {
        out.push('从第 ' + Math.ceil(m.turning) + ' 滴开始，溶液**突然冒出大量气泡**（CO₂）');
        out.push('这一步是 HCO₃⁻ + H⁺ = H₂O + CO₂↑ —— 前一段生成的 HCO₃⁻ 被继续酸化');
        out.push('反应放热，试管外壁发热；气泡使液面翻腾并带出酸雾');
      } else {
        out.push('没有明显现象：滴入的盐酸太少');
      }
    }
    if (m.nCO2 > 0) {
      out.push('把气体通入澄清石灰水：石灰水**变浑浊**（白色浑浊物越多说明 CO₂ 越多）' +
               '：CO₂ + Ca(OH)₂ = CaCO₃↓ + H₂O');
      out.push('把气体通入足量澄清石灰水后再继续通：浑浊又会变澄清（CaCO₃ + CO₂ + H₂O = Ca(HCO₃)₂）');
      out.push('气体量约 ' + qgSigStr(m.nCO2 * 24.5, 3) + ' mL（按标准状况 24.5 L/mol 估算），' +
               '冒泡剧烈程度随浓度与温度上升而增大');
    }
    if (m.T >= 45) out.push('温度较高（' + qgRound(m.T, 0) + ' ℃）：气泡产生得更快、更急');
    if (m.T <= 15) out.push('温度较低（' + qgRound(m.T, 0) + ' ℃）：气泡产生得慢而少');
    return out;
  }
  API.register('carbonate-acid', {
    id: 'carbonate-acid',
    name: '碳酸钠与盐酸（气泡与它的检验）',
    group: '离子反应与溶液平衡',
    aim: '观察 Na₂CO₃ 与盐酸反应产生 CO₂ 的现象，学会用澄清石灰水检验 CO₂，并理解"滴加顺序不同、现象不同"',
    principle: 'Na₂CO₃ 与盐酸的反应分两步：当 Na₂CO₃ 过量时先发生 CO₃²⁻ + H⁺ = HCO₃⁻（无气体）；' +
               '盐酸继续加入、H⁺ 过量后才发生 HCO₃⁻ + H⁺ = H₂O + CO₂↑。所以**把盐酸滴入 Na₂CO₃ 溶液**' +
               '会看到"开始无气泡、后来才冒泡"；而**把 Na₂CO₃ 溶液滴入盐酸**时盐酸始终过量，' +
               '一步就生成 CO₂，立即剧烈冒泡。总反应 Na₂CO₃ + 2HCl = 2NaCl + H₂O + CO₂↑。' +
               'CO₂ 能使澄清石灰水变浑浊（CO₂ + Ca(OH)₂ = CaCO₃↓ + H₂O），这是 CO₂ 的检验方法。' +
               '注意：Na₂CO₃ 在水溶液里的水解也会产生 OH⁻，但教材明确指出第二步水解程度很小、' +
               '"不会放出 CO₂ 气体"，所以溶液显碱性并不等于会冒泡。',
    apparatus: ['试管', '试管架', '胶头滴管', '量筒', '带导管的橡胶塞', 'Na₂CO₃ 溶液',
                '稀盐酸（不同浓度）', '澄清石灰水', '水浴（调温用）'],
    steps: ['取 vNa2CO3 mL Na₂CO₃ 溶液加入试管（carb2acid 时改为取 5 mL 盐酸）',
            '按设定顺序滴加：把盐酸滴入 Na₂CO₃，或把 Na₂CO₃ 滴入盐酸',
            '边滴边观察：有没有气泡、气泡出现得早还是晚、剧烈程度如何',
            '塞上带导管的橡胶塞，把气体通入澄清石灰水，观察是否变浑浊',
            '继续通入过量气体，观察浑浊是否又变澄清',
            '改变浓度、滴数与温度，比较冒泡的快慢与气体量'],
    params: [
      { key: 'order', label: '滴加顺序', type: 'select', value: 'acid2carb', options: CARB_ORDER },
      { key: 'cHCl', label: '盐酸浓度', unit: 'mol/L', min: 0.10, max: 6.00, step: 0.10, value: 1.00 },
      { key: 'cNa2CO3', label: 'Na₂CO₃ 溶液浓度', unit: 'mol/L', min: 0.05, max: 1.00, step: 0.05, value: 0.10 },
      { key: 'vNa2CO3', label: 'Na₂CO₃ 溶液体积', unit: 'mL', min: 1, max: 10, step: 0.5, value: 5.0 },
      { key: 'drops', label: '滴加液体的滴数', unit: '滴', min: 1, max: 40, step: 1, value: 12 },
      { key: 'temp', label: '温度', unit: '℃', min: 10, max: 60, step: 5, value: 25 }
    ],
    react: function (p) {
      var m = carbModel(p);
      var eq, io;
      if (m.nCO2 > 0) {
        eq = 'Na2CO3 + 2HCl = 2NaCl + H2O + CO2↑';
        io = 'CO32- + 2H+ = H2O + CO2↑';
      } else {
        eq = 'Na2CO3 + HCl = NaHCO3 + NaCl';
        io = 'CO32- + H+ = HCO3-';
      }
      return {
        phenomena: carbPhen(m, p),
        equation: eq,
        ionic: io,
        type: m.nCO2 > 0 ? '复分解反应（强酸制弱酸，放出气体）'
                         : '复分解反应（只发生第一步，生成酸式盐）',
        conditions: '常温' + (m.T >= 45 ? '、水浴加热至 ' + qgRound(m.T, 0) + ' ℃' : ''),
        measures: {}
      };
    },
    columns: [],                        /* 纯定性（契约 §3 明确合法） */
    graph: null,
    conclude: function (rows, p) {
      var m = carbModel(p), n = rows ? rows.length : 0;
      var txt = '本次按「' + (m.order === 'carb2acid' ? 'Na₂CO₃ 滴入盐酸' : '盐酸滴入 Na₂CO₃') +
                '」操作：n(Na₂CO₃) = ' + qgSigStr(m.nNa, 3) + ' mmol，滴入的盐酸共 ' +
                qgSigStr(m.nH, 3) + ' mmol（H⁺ 计）。';
      if (m.order === 'acid2carb' && m.stage === 'first') {
        txt += ' 由于 CO₃²⁻ 过量，只发生 CO₃²⁻ + H⁺ = HCO₃⁻，**没有气泡**；' +
               '按当前浓度要滴到约第 ' + Math.ceil(m.turning) + ' 滴以后才开始冒泡。';
      } else if (m.nCO2 > 0) {
        txt += ' 生成了约 ' + qgSigStr(m.nCO2, 3) + ' mmol CO₂（标准状况约 ' +
               qgSigStr(m.nCO2 * 24.5, 3) + ' mL），通入澄清石灰水后变浑浊，' +
               '说明气体是 CO₂（CO₂ + Ca(OH)₂ = CaCO₃↓ + H₂O）。';
      }
      txt += ' 结论：Na₂CO₃ 与盐酸的反应产物由**两者的相对量**决定 —— 碳酸钠过量得 NaHCO₃，' +
             '盐酸过量才放出 CO₂；因此"滴加顺序不同，现象不同"是这一组实验最重要的观察点。';
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: 'Na2CO3 + 2HCl = 2NaCl + H2O + CO2↑',
        ionic: 'CO32- + 2H+ = H2O + CO2↑',
        errors: [
          '把"没气泡"当成"不反应"：盐酸不足时只生成 NaHCO₃（CO₃²⁻ + H⁺ = HCO₃⁻），确实看不到气泡，必须继续滴加或改变滴加顺序再判断',
          '用稀盐酸而不是较浓的盐酸、且滴数太少：CO₂ 生成量小，气泡不明显；反过来浓度太高（>6 mol/L）时酸雾会一起逸出，导管口出现白雾，容易把"酸雾"误认成"气体"',
          '澄清石灰水放久了已经部分变成 CaCO₃ 浊液：通气体前后都"浑浊"，无法判断；必须用新制的澄清石灰水',
          '把 CO₂ 通入石灰水的时间过长：先生成的 CaCO₃ 会与过量 CO₂ 继续反应生成可溶的 Ca(HCO₃)₂，浑浊重新变澄清，会被误判成"没有 CO₂"'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = carbModel(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, 'Na₂CO₃ + 盐酸：气泡与 CO₂ 的检验',
               m.order === 'carb2acid' ? 'Na₂CO₃ → 盐酸' : '盐酸 → Na₂CO₃');
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管与石灰水',
                m.nCO2 > 0 ? '正在冒气泡' : (m.stage === 'first' ? '暂无气泡' : '—'));
        var tx = M + 74, ty = y1 + 46, tw = 62, th = Math.min(h1 - 76, 196);
        if (th < 84) th = 84;
        qgTube(d, F, tx, ty, tw, th, 0.86, 'rgba(214,230,238,0.6)', '反应试管', '#6B645C');
        var nb = m.nCO2 > 0 ? qgClamp(6 + m.rate * 3, 6, 34) : 0;
        if (nb > 0) {
          qgBubbles(d, 6101 + Math.round(m.nCO2 * 131), tx - tw / 2 + 3, ty + th - 12, tw - 6,
                    th * 0.8, nb, 'rgba(255,255,255,0.95)');
          d.txt('CO₂ ↑', tx + tw / 2 + 8, ty + 16, F(11, true, false), '#2E6B4F', 'left');
        } else if (m.stage === 'first') {
          d.txt('无气泡', tx + tw / 2 + 8, ty + 16, F(11, true, false), '#8A5A22', 'left');
          d.txt('（先生成 NaHCO₃）', tx + tw / 2 + 8, ty + 32, F(10, false, true), '#8A5A22', 'left');
        }
        /* 导管 + 石灰水试管 */
        var dx = tx + tw / 2 + 66, dy = y1 + 60, dw = 56, dh = Math.min(h1 - 96, 150);
        if (dh < 70) dh = 70;
        d.txt('导管', (tx + tw / 2 + dx) / 2, ty + 8, F(9.5, false, true), '#8A8378', 'center');
        d.line(tx + tw / 2, ty + 6, dx, dy + 6);
        d.line(dx, dy + 6, dx, dy + dh * 0.55);
        var turb = m.nCO2 > 0 ? qgClamp(0.25 + m.nCO2 * 8, 0.25, 0.95) : 0.12;
        qgTube(d, F, dx, dy, dw, dh, 0.8,
               'rgba(' + Math.round(250 - 4 * turb) + ',' + Math.round(250 - 4 * turb) + ',' +
               Math.round(246 - 2 * turb) + ',' + qgRound(0.25 + turb * 0.7, 2) + ')',
               '澄清石灰水', '#6B645C');
        if (m.nCO2 > 0) {
          d.txt('变浑浊', dx, dy + dh - 30, F(10, true, false), '#7A4A2B', 'center');
          qgPrecip(d, 7101 + Math.round(m.nCO2 * 313), dx - dw / 2 + 3, dy + dh - 6, dw - 6, 22,
                   turb, 'rgba(252,252,250,0.98)', 7);
        } else {
          d.txt('仍澄清', dx, dy + dh - 30, F(10, false, true), '#8A8378', 'center');
        }
        var rx = M + 240;
        qgReadout(d, F, rx, y1 + 52, 132, [
          ['n(Na₂CO₃) / mmol', qgSigStr(m.nNa, 3), INK],
          ['滴入盐酸 / mmol(H⁺)', qgSigStr(m.nH, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 132, [
          ['生成 CO₂ / mmol', qgSigStr(m.nCO2, 3), m.nCO2 > 0 ? '#2E6B4F' : '#8A8378'],
          ['CO₂ 体积（标况）/ mL', qgSigStr(m.nCO2 * 24.5, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 132, 132, [
          ['反应阶段', m.order === 'carb2acid' ? '一步生成 CO₂'
                     : (m.stage === 'first' ? '第一步（HCO₃⁻）' : '第二步（放 CO₂）'), '#7A4A2B'],
          ['开始冒泡的滴数', m.order === 'carb2acid' ? '第 1 滴'
                     : ('约第 ' + Math.ceil(m.turning) + ' 滴'), INK]
        ]);
        var rec = qgRowText(rows, [['phenomena', '现象条数']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
        d.txt('纯定性反应：没有量化列，画面靠气泡、石灰水浑浊与观察记录变化',
              M + 14, y1 + h1 - 6, F(10, false, true), '#8A8378', 'left');
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 8 · 反应 6／9 —— ammonium-alkali（NH₄Cl + NaOH，加热，纯定性）        *
   * ==================================================================== */
  var AM_PAPER = [
    { value: 'red', label: '湿润的红色石蕊试纸（放在试管口）' },
    { value: 'blue', label: '湿润的蓝色石蕊试纸（放在试管口）' },
    { value: 'hcl', label: '蘸了浓盐酸的玻璃棒（靠近试管口）' }
  ];
  function amModel(p) {
    var cA = qgNum(p.cNH4Cl, 0.50), vA = qgNum(p.vNH4Cl, 2.0);
    var cOH = qgNum(p.cNaOH, 1.00), dOH = qgInt(p.dropsNaOH, 10);
    var T = qgNum(p.temp, 20);
    var nNH4 = cA * vA, nOH = cOH * dOH * ML_PER_DROP;
    var nReact = Math.min(nNH4, nOH);           /* 能转化掉的 NH₄⁺ */
    /* 逸出比例：氨极易溶于水，常温下几乎全留在溶液里；温度越高逸出越多。
       60 ℃ 以上才明显"有刺激性气味的气体"。 */
    var esc = qgClamp((T - 40) / 60, 0, 1) * (0.55 + 0.45 * qgClamp(nReact / 0.5, 0, 1));
    var nNH3 = nReact * (0.08 + 0.92 * esc);    /* 实际逸出的 NH₃ */
    return { nNH4: nNH4, nOH: nOH, nReact: nReact, nNH3: nNH3, T: T,
             paper: p.paper || 'red', enough: nOH >= nNH4 };
  }
  function amPhen(m, p) {
    var out = [];
    if (m.nReact <= 1e-6) {
      out.push('没有气体产生：加入的碱太少（或铵盐太少），NH₄⁺ 根本没有被转化');
      return out;
    }
    /* "碱是否足量"必须**无条件**写出来（不能藏在温度分支后面）：
       它是这个反应最容易被忽略的条件，而且学生把滴数调大/调小时第一眼就要看到它。 */
    if (m.enough) {
      out.push('碱足量（n(OH⁻) ≥ n(NH₄⁺)）：铵盐被完全赶出氨，现象最明显');
    } else {
      out.push('碱不足：只有约 ' + qgPct(m.nReact / m.nNH4 * 100, 0) + ' 的 NH₄⁺ 变成了 NH₃，' +
               '气味与试纸变色都比较弱（NH₄⁺ + OH⁻ ⇌ NH₃·H₂O 的平衡没有被拉到底）');
    }
    if (m.T < 55) {
      out.push('加热到 ' + qgRound(m.T, 0) + ' ℃：溶液变热、有少量氨味，但试管口**看不到明显气体**' +
               '（氨极易溶于水，常温下 1 体积水约能溶解 700 体积氨，必须加热才能把它赶出来）');
      if (m.nNH3 > 0) {
        out.push('把湿润的红色石蕊试纸放在试管口，试纸只是边缘**微微发蓝**，颜色变化很慢');
      }
      return out;
    }
    out.push('加热后试管里产生**无色气体**，闻到**刺激性气味**（氨味），试管口有气体逸出');
    out.push('气体使**湿润的红色石蕊试纸变蓝**（氨水显弱碱性，教材实验 5-7 的判据）' +
             '：NH₃ + H₂O ⇌ NH₃·H₂O ⇌ NH₄⁺ + OH⁻');
    if (m.paper === 'blue') out.push('若改用湿润的蓝色石蕊试纸：试纸**不变红**（氨是碱性气体）');
    if (m.paper === 'hcl') out.push('若把蘸了浓盐酸的玻璃棒靠近试管口：产生**大量白烟**' +
                                    '（NH₃ + HCl = NH₄Cl 固体小颗粒）');
    out.push('试管口的湿润试纸要"靠近"而不是塞住管口：塞住会把气体闷回去，也可能倒吸');
    if (m.nNH3 / Math.max(m.nNH4, 1e-9) > 0.6) {
      out.push('试管内壁出现水珠：NH₄⁺ + OH⁻ =Δ= NH₃↑ + H₂O 生成了水');
    }
    return out;
  }
  API.register('ammonium-alkali', {
    id: 'ammonium-alkali',
    name: '铵盐与碱（加热放出氨气）',
    group: '离子反应与溶液平衡',
    aim: '观察 NH₄Cl 与 NaOH 加热放出刺激性气体、湿润红色石蕊试纸变蓝，学会 NH₄⁺ 的检验',
    principle: '铵盐与强碱在加热条件下反应放出氨：NH₄⁺ + OH⁻ =Δ= NH₃↑ + H₂O（教材必修二实验 5-7）。' +
               '氨是无色、有刺激性气味的气体，极易溶于水，溶于水后形成 NH₃·H₂O 并部分电离出 OH⁻，' +
               '因此氨水显弱碱性 —— 湿润的红色石蕊试纸遇氨变蓝，这就是检验 NH₄⁺ 的经典方法；' +
               '把蘸浓盐酸的玻璃棒靠近试管口会生成白烟（NH₃ + HCl = NH₄Cl），也能确证氨的存在。' +
               '注意两点：① **必须加热**（常温下氨几乎全部溶在水里，逸出极少）；' +
               '② 碱要加足，否则水解/中和平衡没被拉到底，现象很弱。',
    apparatus: ['试管', '试管夹', '酒精灯', '胶头滴管', '量筒', 'NH₄Cl 溶液', 'NaOH 溶液',
                '湿润的红色石蕊试纸', '湿润的蓝色石蕊试纸', '蘸浓盐酸的玻璃棒', '通风橱'],
    steps: ['取 vNH4Cl mL NH₄Cl 溶液加入试管',
            '加入 dropsNaOH 滴 NaOH 溶液，摇匀',
            '用试管夹夹住试管在酒精灯上加热到设定温度（注意通风、管口不要对着人）',
            '把湿润的红色石蕊试纸放在试管口（不要塞住），观察颜色变化',
            '换用湿润的蓝色石蕊试纸、或把蘸浓盐酸的玻璃棒靠近管口再对比一次',
            '改变碱的滴数与加热温度，比较气味的强弱与试纸变色的快慢'],
    params: [
      { key: 'cNH4Cl', label: 'NH₄Cl 溶液浓度', unit: 'mol/L', min: 0.05, max: 2.00, step: 0.05, value: 0.50 },
      { key: 'vNH4Cl', label: 'NH₄Cl 溶液体积', unit: 'mL', min: 1, max: 10, step: 0.5, value: 2.0 },
      { key: 'cNaOH', label: 'NaOH 溶液浓度', unit: 'mol/L', min: 0.05, max: 4.00, step: 0.05, value: 1.00 },
      { key: 'dropsNaOH', label: '滴入 NaOH 的滴数', unit: '滴', min: 1, max: 40, step: 1, value: 20 },
      { key: 'temp', label: '加热温度', unit: '℃', min: 20, max: 150, step: 10, value: 100 },
      { key: 'paper', label: '管口放的试纸/玻璃棒', type: 'select', value: 'red', options: AM_PAPER }
    ],
    react: function (p) {
      var m = amModel(p);
      return {
        phenomena: amPhen(m, p),
        equation: 'NH4Cl + NaOH = NaCl + NH3↑ + H2O',
        ionic: 'NH4+ + OH- = NH3↑ + H2O',
        type: '复分解反应（强碱制弱碱，加热放出气体）',
        conditions: '加热（' + qgRound(m.T, 0) + ' ℃）；常温下几乎不放出氨',
        measures: {}
      };
    },
    columns: [],                        /* 纯定性（契约 §3 明确合法） */
    graph: null,
    conclude: function (rows, p) {
      var m = amModel(p), n = rows ? rows.length : 0;
      var txt = 'NH₄Cl 与 NaOH 在加热条件下反应放出氨：NH₄⁺ + OH⁻ =Δ= NH₃↑ + H₂O。' +
                '本次 n(NH₄⁺) = ' + qgSigStr(m.nNH4, 3) + ' mmol、n(OH⁻) = ' + qgSigStr(m.nOH, 3) +
                ' mmol，被转化掉的 NH₄⁺ 为 ' + qgSigStr(m.nReact, 3) + ' mmol。';
      if (m.T < 55) {
        txt += ' 加热温度只有 ' + qgRound(m.T, 0) + ' ℃，氨几乎全溶在水里，试管口看不到明显气体 —— ' +
               '"常温/低温不加热就闻不到、试纸也不变色"正是本实验最重要的条件。';
      } else {
        txt += ' 加热到 ' + qgRound(m.T, 0) + ' ℃ 后逸出的氨约 ' + qgSigStr(m.nNH3, 3) +
               ' mmol，管口能闻到刺激性气味、湿润的红色石蕊试纸变蓝' +
               (m.paper === 'hcl' ? '，蘸浓盐酸的玻璃棒靠近时产生白烟（NH₃ + HCl = NH₄Cl）' : '') + '。';
      }
      if (!m.enough) txt += ' 碱没有加足，平衡没被拉到底，现象偏弱。';
      txt += ' 结论：NH₄⁺ 的检验方法是"加浓 NaOH 溶液并加热，用湿润的红色石蕊试纸检验放出的气体"。';
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: 'NH4Cl + NaOH = NaCl + NH3↑ + H2O',
        ionic: 'NH4+ + OH- = NH3↑ + H2O',
        errors: [
          '没有加热或加热温度不够：氨极易溶于水（常温下 1 体积水约溶解 700 体积氨），不加热几乎不放气，会误判成"不含 NH₄⁺"',
          '用湿润的蓝色石蕊试纸或用干燥的红色石蕊试纸：氨是碱性气体，只有**湿润的红色**石蕊试纸遇氨才变蓝，试纸不湿润就无法形成 NH₃·H₂O 而不变色',
          '把试纸直接塞住管口或伸进试管：会挡住气体、还可能被碱液溅到造成污染与烫伤，正确做法是"靠近管口"',
          '在密闭不通风的地方做：氨有强烈刺激性气味、对眼和呼吸道有刺激，必须在通风处进行，且试管口不能对着任何人'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = amModel(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, 'NH₄Cl + NaOH（加热）：氨气的检验',
               '加热 ' + qgRound(m.T, 0) + ' ℃');
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管与管口的试纸',
                m.T >= 55 ? '有氨逸出' : '几乎无气体逸出');
        var tx = M + 84, ty = y1 + 46, tw = 62, th = Math.min(h1 - 76, 190);
        if (th < 84) th = 84;
        qgTube(d, F, tx, ty, tw, th, 0.86, 'rgba(220,232,238,0.6)', '反应液', '#6B645C');
        qgFlameShape(d, tx, ty + th + 30, m.T >= 55 ? 30 : 20,
                     m.T >= 55 ? 'rgba(232,152,44,0.82)' : 'rgba(200,200,200,0.35)');
        var k;
        for (k = 0; k < 5; k++) {
          d.circle(tx - tw / 2 + 8 + k * 12, ty + th + 12 - (k % 2) * 8, 1.5,
                   'rgba(120,180,220,0.9)', null, 0);
        }
        /* 逸出的氨：用向上的小箭头 + 试纸 */
        var nGas = qgClamp(m.nNH3 * 26, 0, 18);
        for (k = 0; k < nGas; k++) {
          d.line(tx - 12 + (k % 5) * 6, ty - 6 - k * 3, tx - 12 + (k % 5) * 6, ty - 16 - k * 3);
        }
        /* 试纸：红→蓝（或蓝不变、或玻璃棒白烟） */
        var px = tx + tw / 2 + 74, py = ty + 20;
        if (m.paper === 'hcl') {
          d.line(px - 40, py - 18, px + 10, py - 2);
          d.txt('蘸浓盐酸的玻璃棒', px, py - 26, F(9.5, false, true), '#6B645C', 'center');
          if (m.nNH3 > 0.002) {
            for (k = 0; k < 10; k++) {
              d.circle(px - 10 + (k % 5) * 7, py - 4 - Math.floor(k / 5) * 7, 2.2,
                       'rgba(250,250,248,0.95)', 'rgba(160,155,145,0.9)', 0.8);
            }
            d.txt('白烟（NH₄Cl 固体）', px + 4, py + 8, F(10, true, false), '#2E6B4F', 'left');
          } else {
            d.txt('无白烟', px + 4, py + 8, F(10, false, true), '#8A8378', 'left');
          }
        } else {
          var isRed = (m.paper === 'red');
          var turned = m.nNH3 > 0.002;
          var fill = isRed ? (turned ? 'rgba(70,90,196,0.92)' : 'rgba(206,64,64,0.92)')
                           : (turned ? 'rgba(206,64,64,0.92)' : 'rgba(70,90,196,0.92)');
          d.rect(px - 26, py - 12, 52, 24, fill, 'rgba(38,34,28,0.6)', 1);
          d.txt(isRed ? '湿润红色石蕊试纸' : '湿润蓝色石蕊试纸', px, py + 24,
                F(9.5, false, true), '#6B645C', 'center');
          d.txt(turned ? (isRed ? '变成蓝色 ✔' : '仍为蓝色（不变红）') : '颜色未变',
                px + 40, py, F(10.5, true, false), turned ? '#2E6B4F' : '#8A8378', 'left');
        }
        var rx = M + 250;
        qgReadout(d, F, rx, y1 + 52, 132, [
          ['n(NH₄⁺) / mmol', qgSigStr(m.nNH4, 3), INK],
          ['n(OH⁻) / mmol', qgSigStr(m.nOH, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 132, [
          ['被转化的 NH₄⁺ / mmol', qgSigStr(m.nReact, 3), '#7A4A2B'],
          ['逸出的 NH₃ / mmol', qgSigStr(m.nNH3, 3), m.nNH3 > 0.002 ? '#2E6B4F' : '#8A8378']
        ]);
        qgReadout(d, F, rx, y1 + 132, 132, [
          ['碱是否足量', m.enough ? '足量' : '不足', m.enough ? '#2E6B4F' : '#A03028'],
          ['逸出比例', qgPct(m.nNH4 > 0 ? m.nNH3 / m.nNH4 * 100 : 0, 0), INK]
        ]);
        var rec = qgRowText(rows, [['phenomena', '现象条数']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
        d.txt('纯定性反应：现象随"加热温度 / 碱的用量 / 试纸种类"变化（常温下几乎无气体）',
              M + 14, y1 + h1 - 6, F(10, false, true), '#8A8378', 'left');
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 9 · 反应 7／9 —— hydrolysis（盐类的水解：FeCl₃ / CH₃COONa / NH₄Cl）  *
   * ==================================================================== */
  var HYD_SALT = [
    { value: 'ch3coona', label: 'CH₃COONa（强碱弱酸盐，显碱性）' },
    { value: 'nh4cl', label: 'NH₄Cl（强酸弱碱盐，显酸性）' },
    { value: 'fecl3', label: 'FeCl₃（强酸弱碱盐，显酸性；教材未给水解常数）' }
  ];
  var HYD_ADD = [
    { value: 'none', label: '不加（只观察稀释/升温的影响）' },
    { value: 'hcl', label: '滴加少量盐酸（增大 c(H⁺)，抑制水解）' },
    { value: 'naoh', label: '滴加少量 NaOH（减小 c(H⁺)，促进水解）' },
    { value: 'salt', label: '加入同离子盐固体（CH₃COONa 加醋酸钠 / NH₄Cl 加 NH₄Cl）' }
  ];
  var HYD_SALT_LABEL = { ch3coona: 'CH₃COONa', nh4cl: 'NH₄Cl', fecl3: 'FeCl₃' };
  function hydModel(p) {
    var salt = p.salt || 'ch3coona';
    var c0 = qgNum(p.c0, 0.100), n = qgNum(p.dilute, 1), T = qgNum(p.temp, 25) + 273.15;
    var add = p.add || 'none', dAdd = qgInt(p.dropsAdd, 1);
    var c = c0 / Math.max(n, 1e-9);                    /* 稀释后的浓度 mol/L */
    var kw = qgKw(T);
    var cAdd = 1.0 * dAdd * ML_PER_DROP / 1000;        /* 加入 1 mol/L 酸碱的物质的量浓度贡献（mol/L，未计体积变化） */
    var alpha = null, cH = null, cOH = null, pH = null, pHpre = null;
    if (salt === 'ch3coona') {
      /* 强碱弱酸盐：Kh = Kw/Ka(CH₃COOH)，c(OH⁻) = √(Kh·c) */
      var kh = kw / KA_CH3COOH;
      cOH = Math.sqrt(kh * c);
      if (add === 'hcl') cOH = Math.max(cOH - cAdd, 1e-9);
      if (add === 'naoh') cOH = cOH + cAdd;
      if (add === 'salt' && n > 1) { /* 同离子：加回同种盐，等于把有效浓度抬回去 */
        cOH = Math.sqrt(kh * (c + 0.005));
      }
      cH = kw / cOH;
      pH = -Math.log(cH) / Math.LN10;
      alpha = cOH / c * 100;
      pHpre = null;                        /* CH₃COONa 不涉及 Fe(OH)₃ 沉淀，按约定① 给 null */
    } else if (salt === 'nh4cl') {
      /* 强酸弱碱盐：Kh = Kw/Kb(NH₃·H₂O)，c(H⁺) = √(Kh·c) */
      var kh2 = kw / KB_NH3H2O;
      cH = Math.sqrt(kh2 * c);
      if (add === 'hcl') cH = cH + cAdd;
      if (add === 'naoh') cH = Math.max(cH - cAdd, 1e-12);
      if (add === 'salt' && n > 1) cH = Math.sqrt(kh2 * (c + 0.005));
      cOH = kw / cH;
      pH = -Math.log(cH) / Math.LN10;
      alpha = cH / c * 100;
      pHpre = null;
    } else {
      /* FeCl₃：人教版没有给 Fe³⁺ 的水解常数（附录Ⅱ 只有弱酸弱碱表），
         所以本台**不编 pH**，按约定① 返回 null；改用可以由教材 Ksp(Fe(OH)₃)=2.8×10⁻³⁹
         严格算出的"开始沉淀 pH"承担 FeCl₃ 的定量内容。 */
      pHpre = qgPrecipPH(KSP.feoh3, c, 3);
      alpha = null;
    }
    /* 稀释倍数换算成 lg c，图用 */
    var lgC = (c > 0) ? Math.log(c) / Math.LN10 : null;
    return { salt: salt, c0: c0, n: n, c: c, T: T, Tdeg: T - 273.15, add: add,
             dAdd: dAdd, kw: kw, pKw: -Math.log(kw) / Math.LN10,
             cH: cH, cOH: cOH, pH: pH, alpha: alpha, pHpre: pHpre, lgC: lgC };
  }
  function hydPhen(m, p) {
    var out = [], name = HYD_SALT_LABEL[m.salt] || m.salt;
    if (m.salt === 'ch3coona') {
      out.push('用 pH 计/pH 试纸测 ' + name + ' 溶液：**显碱性**（' +
               (m.pH !== null ? 'pH ≈ ' + qgSigStr(m.pH, 3) : 'pH > 7') + '），' +
               '滴入酚酞溶液**变红**');
      out.push('原因：CH₃COO⁻ 结合了水电离出的 H⁺ 生成弱酸 CH₃COOH，' +
               '使水的电离平衡右移，c(OH⁻) > c(H⁺)：CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻');
    } else if (m.salt === 'nh4cl') {
      out.push('用 pH 计/pH 试纸测 ' + name + ' 溶液：**显酸性**（' +
               (m.pH !== null ? 'pH ≈ ' + qgSigStr(m.pH, 3) : 'pH < 7') + '），' +
               '滴入紫色石蕊溶液**变红**');
      out.push('原因：NH₄⁺ 结合水电离出的 OH⁻ 生成弱碱 NH₃·H₂O，' +
               '使 c(H⁺) > c(OH⁻)：NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺');
    } else {
      out.push('FeCl₃ 溶液**显酸性**（pH 试纸变红、pH 计读数明显小于 7），' +
               '溶液呈**黄色**（Fe³⁺ 的水合离子颜色）');
      out.push('原因：Fe³⁺ + 3H₂O ⇌ Fe(OH)₃ + 3H⁺（教材选择性必修1 探究的原话：' +
               '"FeCl₃ 溶液呈酸性还是碱性？写出 FeCl₃ 发生水解的离子方程式"）');
      out.push('人教版附录Ⅱ 里没有 Fe³⁺ 的水解常数，所以本台**不给出具体 pH 数值**，' +
               '只给出可以由教材 Ksp(Fe(OH)₃)=2.8×10⁻³⁹ 严格算出的量：' +
               '当前浓度下使 Fe³⁺ 开始沉淀为 Fe(OH)₃ 的 pH ≈ ' +
               qgSigStr(m.pHpre, 3) + '（加碱把 pH 调到这里就会析出红褐色沉淀）');
    }
    if (m.n > 1) {
      out.push('加水稀释到原来的 1/' + qgRound(m.n, 0) + '（c = ' + qgSigStr(m.c, 3) +
               ' mol/L）：**稀释促进水解**（教材原话），水解程度由 ' +
               (m.alpha !== null ? qgPct(m.alpha, 3) : '—') + ' 继续增大');
      if (m.salt !== 'fecl3') {
        out.push('溶液颜色/试纸颜色：稀释后碱性（或酸性）**变弱**（c(OH⁻) 或 c(H⁺) 减小），' +
                 '但**水解程度反而增大** —— 这两个结论不矛盾，一个说浓度、一个说比例');
      }
    }
    if (m.Tdeg > 30) {
      out.push('加热到 ' + qgRound(m.Tdeg, 0) + ' ℃：**升温促进水解**（水解是吸热反应，' +
               '相当于中和反应的逆反应，中和放热 57.3 kJ/mol）');
      if (m.salt === 'fecl3') {
        out.push('FeCl₃ 溶液加热后**颜色明显加深**（黄色 → 橙红 → 红褐），' +
                 '继续加热会析出红褐色 Fe(OH)₃ 胶体/沉淀 —— 这正是"升温促进水解"最直观的证据');
      } else if (m.cOH !== null) {
        out.push('c(OH⁻) 由 25 ℃ 的 ' + qgSigStr(Math.sqrt(m.kw / KA_CH3COOH * m.c), 3) +
                 ' mol/L 增大到 ' + qgSigStr(m.cOH, 3) + ' mol/L（碱性增强）；' +
                 '但由于升温使 Kw 增大得更多（pKw 由 14.00 降到 ' + qgSigStr(m.pKw, 4) +
                 '），**pH 反而略降**到 ' + qgSigStr(m.pH, 3) + ' —— 这是本反应最容易被记错的一点');
      } else if (m.cH !== null) {
        out.push('c(H⁺) 增大到 ' + qgSigStr(m.cH, 3) + ' mol/L（酸性增强），' +
                 '但 pH 因 Kw 增大而略降为 ' + qgSigStr(m.pH, 3));
      }
    }
    if (m.add === 'hcl') {
      out.push('滴入 ' + m.dAdd + ' 滴 1 mol/L 盐酸：**水解被抑制**' +
               (m.salt === 'fecl3' ? '，FeCl₃ 溶液颜色变浅' : '，溶液的碱性/酸性变弱') +
               '（教材：配制 FeCl₃ 溶液时先溶于较浓盐酸再稀释，就是为了抑制水解）');
    } else if (m.add === 'naoh') {
      out.push('滴入 ' + m.dAdd + ' 滴 1 mol/L NaOH：**水解被促进**' +
               (m.salt === 'fecl3' ? '，直接析出**红褐色** Fe(OH)₃ 沉淀' : '，溶液的碱性/酸性增强'));
    } else if (m.add === 'salt') {
      out.push('加入同种盐的固体（同离子效应）：水解平衡**向左移动**，水解程度减小' +
               '（对 CH₃COONa，加入的 CH₃COO⁻ 抑制了 CH₃COO⁻ 的水解）');
    }
    return out;
  }
  API.register('hydrolysis', {
    id: 'hydrolysis',
    name: '盐类的水解（FeCl₃ / CH₃COONa / NH₄Cl）',
    group: '离子反应与溶液平衡',
    aim: '测定不同盐溶液的酸碱性，并考察加水稀释、升高温度、加入酸碱或同离子盐对水解平衡的影响',
    principle: '盐类的水解：盐电离出的离子与水电离出的 H⁺ 或 OH⁻ 结合生成弱电解质，' +
               '从而破坏水的电离平衡。强酸弱碱盐（NH₄Cl、FeCl₃）显酸性' +
               '（NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺；Fe³⁺ + 3H₂O ⇌ Fe(OH)₃ + 3H⁺）；' +
               '强碱弱酸盐（CH₃COONa）显碱性（CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻）；' +
               '强酸强碱盐不水解、显中性。水解是中和反应的逆反应，中和放热 57.3 kJ/mol，' +
               '所以**水解吸热：升温促进水解**；**加水稀释也促进水解**（水解程度增大，' +
               '但 c(H⁺)/c(OH⁻) 反而减小）；加入酸或碱会按平衡移动原理抑制或促进水解，' +
               '加入同离子盐则抑制水解（教材：配 FeCl₃ 溶液要先用较浓盐酸溶解）。' +
               '本台用教材的三个数据（Kw(25 ℃)=1.0×10⁻¹⁴、中和热 57.3 kJ/mol、' +
               '"电离常数随温度变化不大"）按 van\'t Hoff 外推温度效应；' +
               'FeCl₃ 因为教材没给 Fe³⁺ 的水解常数，pH 一列返回 null（不给编造的数值）。',
    apparatus: ['试管', '试管架', '胶头滴管', '量筒', 'pH 计（或 pH 试纸）', '酒精灯', '水浴',
                'CH₃COONa 溶液', 'NH₄Cl 溶液', 'FeCl₃ 溶液', '1 mol/L 盐酸', '1 mol/L NaOH 溶液',
                '酚酞、紫色石蕊（指示剂）'],
    steps: ['取 c0 mol/L 的盐溶液，用 pH 计（或用 pH 试纸/指示剂）测它的酸碱性',
            '按设定倍数加水稀释，再测一次 pH，比较水解程度的变化',
            '把试管放进水浴加热到设定温度，再测 pH，观察颜色变化（升温促进水解）',
            '滴加少量盐酸或 NaOH，观察平衡移动的方向',
            '加入同种盐的固体，验证同离子效应对水解的抑制',
            '记录 pH、c(H⁺)、c(OH⁻) 与水解程度，作 pH–lg c 图'],
    params: [
      { key: 'salt', label: '盐的种类', type: 'select', value: 'ch3coona', options: HYD_SALT },
      { key: 'c0', label: '盐溶液初始浓度', unit: 'mol/L', min: 0.001, max: 1.000, step: 0.001, value: 0.100 },
      { key: 'dilute', label: '加水稀释倍数 n', unit: '倍', min: 1, max: 1000, step: 1, value: 1 },
      { key: 'temp', label: '温度', unit: '℃', min: 20, max: 80, step: 5, value: 25 },
      { key: 'add', label: '再加入的试剂', type: 'select', value: 'none', options: HYD_ADD },
      { key: 'dropsAdd', label: '加入的滴数（1 mol/L）', unit: '滴', min: 1, max: 10, step: 1, value: 1 }
    ],
    react: function (p, ctx) {
      var m = hydModel(p), idx = qgNum(ctx && ctx.index, 0);
      var rnd = qgRng(idx * 4409 + Math.round(m.c * 1e6) + 5);
      var eq, io;
      if (m.salt === 'ch3coona') {
        eq = 'CH3COONa + H2O ⇌ CH3COOH + NaOH';
        io = 'CH3COO- + H2O ⇌ CH3COOH + OH-';
      } else if (m.salt === 'nh4cl') {
        eq = 'NH4Cl + H2O ⇌ NH3·H2O + HCl';
        io = 'NH4+ + H2O ⇌ NH3·H2O + H+';
      } else {
        eq = 'FeCl3 + 3H2O ⇌ Fe(OH)3 + 3HCl';
        io = 'Fe3+ + 3H2O ⇌ Fe(OH)3 + 3H+';
      }
      return {
        phenomena: hydPhen(m, p),
        equation: eq,
        ionic: io,
        type: '盐类的水解（可逆反应；中和反应的逆反应）',
        conditions: '常温' + (m.Tdeg > 30 ? '、水浴加热至 ' + qgRound(m.Tdeg, 0) + ' ℃' : '') +
                    (m.n > 1 ? '、稀释 ' + qgRound(m.n, 0) + ' 倍' : '') +
                    (m.add === 'none' ? '' : '、加入' +
                      (m.add === 'hcl' ? '少量盐酸' : (m.add === 'naoh' ? '少量 NaOH' : '同离子盐'))),
        measures: {
          c0: qgSig(m.c0, 3), c: qgSig(m.c, 3), lgC: (m.lgC === null ? null : qgSig(m.lgC, 4)),
          pH: (m.pH === null ? null : qgSig(m.pH + (rnd() - 0.5) * 0.02, 4)),
          cH: (m.cH === null ? null : qgSig(m.cH, 3)),
          cOH: (m.cOH === null ? null : qgSig(m.cOH, 3)),
          alpha: (m.alpha === null ? null : qgSig(m.alpha, 3)),
          pKw: qgSig(m.pKw, 4),
          pHpre: (m.pHpre === null ? null : qgSig(m.pHpre, 3))
        }
      };
    },
    columns: [
      { key: 'c0', label: '初始浓度 c₀', unit: 'mol/L' },
      { key: 'c', label: '稀释后浓度 c', unit: 'mol/L' },
      { key: 'lgC', label: 'lg c', unit: '' },
      { key: 'pH', label: 'pH', unit: '' },
      { key: 'cH', label: 'c(H⁺)', unit: 'mol/L' },
      { key: 'cOH', label: 'c(OH⁻)', unit: 'mol/L' },
      { key: 'alpha', label: '水解程度', unit: '%' },
      { key: 'pKw', label: '该温度下的 pKw', unit: '' },
      { key: 'pHpre', label: '开始沉淀 Fe(OH)₃ 的 pH（仅 FeCl₃）', unit: '' }
    ],
    graph: {
      x: 'lgC', y: 'pH', fit: 'linear',
      title: 'pH 随 lg c 的变化（稀释对水解的影响）',
      note: '强碱弱酸盐（CH₃COONa）的 pH = pKw − ½pKh + ½·lg c，强酸弱碱盐（NH₄Cl）的 ' +
            'pH = ½pKh − ½·lg c —— 两条都是直线，斜率 ±0.5，这正是"稀释促进水解"的定量表现。' +
            'FeCl₃ 的 pH 按约定① 返回 null（教材没给 Fe³⁺ 的水解常数），这些行会被跳过、' +
            '不进拟合；改看 pHpre 一列（由教材 Ksp(Fe(OH)₃)=2.8×10⁻³⁹ 算出）。' +
            '温度不是这张图的自变量：升温的结论请比较同一浓度、不同温度两次观察的 c(OH⁻)/c(H⁺)。',
      xLabel: 'lg[稀释后浓度 c/(mol·L⁻¹)]',
      yLabel: 'pH'
    },
    conclude: function (rows, p) {
      var m = hydModel(p), n = rows ? rows.length : 0;
      var name = HYD_SALT_LABEL[m.salt] || m.salt;
      var txt = name + ' 在水溶液中发生水解：' + (m.salt === 'ch3coona'
        ? 'CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻，溶液显**碱性**。'
        : (m.salt === 'nh4cl' ? 'NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺，溶液显**酸性**。'
                              : 'Fe³⁺ + 3H₂O ⇌ Fe(OH)₃ + 3H⁺，溶液显**酸性**。'));
      if (m.pH !== null) {
        txt += ' 本次 c = ' + qgSigStr(m.c, 3) + ' mol/L、温度 ' + qgRound(m.Tdeg, 0) +
               ' ℃：pH = ' + qgSigStr(m.pH, 3) + '，c(H⁺) = ' + qgSigStr(m.cH, 3) +
               ' mol/L，c(OH⁻) = ' + qgSigStr(m.cOH, 3) + ' mol/L，水解程度 ' +
               qgSigStr(m.alpha, 3) + '%。';
      } else {
        txt += ' 本次 c = ' + qgSigStr(m.c, 3) + ' mol/L：教材未给出 Fe³⁺ 的水解常数，' +
               '本台按约定不给编造的 pH；可由教材 Ksp(Fe(OH)₃) = 2.8×10⁻³⁹ 严格算出：' +
               '把 pH 调到 ' + qgSigStr(m.pHpre, 3) + ' 左右 Fe³⁺ 就开始沉淀为红褐色 Fe(OH)₃。';
      }
      if (m.n > 1) txt += ' 稀释 ' + qgRound(m.n, 0) + ' 倍后水解程度增大（教材：加水稀释促使平衡向水解方向移动）。';
      if (m.Tdeg > 30) txt += ' 升温到 ' + qgRound(m.Tdeg, 0) + ' ℃ 后水解程度增大（水解吸热）；' +
        '注意' + (m.cOH !== null ? 'c(OH⁻) 增大但 pH 略降（Kw 增大得更多）' : 'c(H⁺) 增大') + '。';
      txt += ' 结论：盐溶液的酸碱性由"谁被水解"决定；升温、稀释都促进水解，' +
             '加入酸/碱或同离子盐则按平衡移动原理改变水解程度。';
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: (m.salt === 'ch3coona' ? 'CH3COONa + H2O ⇌ CH3COOH + NaOH'
                   : (m.salt === 'nh4cl' ? 'NH4Cl + H2O ⇌ NH3·H2O + HCl'
                                         : 'FeCl3 + 3H2O ⇌ Fe(OH)3 + 3HCl')),
        ionic: (m.salt === 'ch3coona' ? 'CH3COO- + H2O ⇌ CH3COOH + OH-'
                : (m.salt === 'nh4cl' ? 'NH4+ + H2O ⇌ NH3·H2O + H+'
                                      : 'Fe3+ + 3H2O ⇌ Fe(OH)3 + 3H+')),
        errors: [
          '用蒸馏水以外的水（自来水）配溶液或洗试管：水里的 CO₃²⁻、HCO₃⁻ 本身显碱性，会让"盐溶液显碱性"的结论失真；pH 计必须先用标准缓冲液校准',
          '把 pH 试纸直接伸进溶液：既污染溶液又使读数偏低（试纸要用玻璃棒蘸取点在试纸上，与标准比色卡对照）；用 pH 计则要充分搅拌、待读数稳定后再读',
          '测"升温的影响"时没有等温度稳定就读数：水温与溶液温度不一致会给出错误方向的结论；且高温下 pH 计的电极响应变慢，要等读数稳定',
          '把"稀释后 pH 变小/变大"直接等同于"水解程度变小/变大"：稀释促进水解（水解程度增大），但 c(H⁺) 或 c(OH⁻) 是减小的 —— 浓度与程度是两件事（FeCl₃ 稀释时颜色变浅、但水解程度变大）'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = hydModel(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, '盐类的水解：' + (HYD_SALT_LABEL[m.salt] || m.salt),
               'c = ' + qgSigStr(m.c, 3) + ' mol/L　' + qgRound(m.Tdeg, 0) + ' ℃');
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '三支试管的对比（同浓度、同温度）',
                m.add === 'none' ? '只改变浓度/温度' : '已加入试剂');
        /* 三支试管：NaCl（对照，中性） / 本盐 / 加酸碱后的本盐 */
        var base = M + 52, gap = 96, tw = 54, ty = y1 + 52;
        var th = Math.min(h1 - 92, 172);
        if (th < 80) th = 80;
        var salts = [
          { k: 'NaCl（对照）', col: 'rgba(224,232,238,0.6)' },
          { k: (HYD_SALT_LABEL[m.salt] || m.salt), col: 'rgba(224,232,238,0.6)' },
          { k: (m.add === 'none' ? '（未加试剂）' : '加了试剂'),
            col: 'rgba(224,232,238,0.6)' }
        ];
        var i, cxs = [];
        for (i = 0; i < 3; i++) {
          var cx = base + i * gap;
          cxs.push(cx);
          var col = salts[i].col;
          if (i === 1) {
            if (m.salt === 'fecl3') {
              /* FeCl₃ 黄色，升温/水解加深 */
              var dd = qgClamp((m.Tdeg - 25) / 55, 0, 1);
              col = 'rgba(' + Math.round(240 - 30 * dd) + ',' + Math.round(226 - 70 * dd) + ',' +
                    Math.round(180 - 100 * dd) + ',0.85)';
            } else if (m.salt === 'ch3coona') {
              col = m.cOH > 1e-5 ? 'rgba(226,214,238,0.8)' : 'rgba(232,232,240,0.7)';
            } else {
              col = 'rgba(238,224,224,0.8)';
            }
          }
          if (i === 2 && m.add !== 'none') {
            col = m.add === 'hcl' ? 'rgba(240,224,204,0.8)'
                : (m.add === 'naoh' ? 'rgba(214,222,244,0.8)' : 'rgba(228,228,236,0.8)');
          }
          qgTube(d, F, cx, ty, tw, th, 0.84, col, salts[i].k, '#6B645C');
        }
        /* 指示剂颜色：酚酞（碱性变红）/ 石蕊（酸性变红） */
        var ind = (m.salt === 'ch3coona') ? '酚酞：变红' :
                  (m.salt === 'fecl3' ? 'pH 试纸：变红（pH < 7）' : '紫色石蕊：变红');
        if (m.salt === 'ch3coona' && (m.cOH === null || m.cOH < 1e-6)) ind = '酚酞：几乎不变色';
        d.txt('指示剂 / pH 试纸：' + ind, cxs[1] - tw, ty + th + 30, F(10.5, true, false),
              '#7A4A2B', 'center');
        /* 温度计/水浴 */
        var bx = base + 2 * gap + 44, by = y1 + h1 - 60, bw = 120, bh = 34;
        qgBeaker(d, F, bx, by, bw, bh, 0.9, 'rgba(160,200,230,0.45)', '水浴 ' + qgRound(m.Tdeg, 0) + ' ℃');
        if (m.Tdeg > 30) qgFlameShape(d, bx + bw / 2, by + bh + 26, 24, 'rgba(232,152,44,0.8)');
        var rx = M + 350;
        qgReadout(d, F, rx, y1 + 52, 128, [
          ['c（稀释后）/ (mol/L)', qgSigStr(m.c, 3), INK],
          ['pH', m.pH === null ? '—（教材未给常数）' : qgSigStr(m.pH, 3),
           m.pH === null ? '#8A8378' : '#7A4A2B']
        ]);
        qgReadout(d, F, rx, y1 + 92, 128, [
          ['c(H⁺) / (mol/L)', m.cH === null ? '—' : qgSigStr(m.cH, 3), INK],
          ['c(OH⁻) / (mol/L)', m.cOH === null ? '—' : qgSigStr(m.cOH, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 132, 128, [
          ['水解程度', m.alpha === null ? '—' : qgPct(m.alpha, 3), '#7A4A2B'],
          ['开始沉淀的 pH', m.pHpre === null ? '—' : qgSigStr(m.pHpre, 3), '#8A5A22']
        ]);
        var rec = qgRowText(rows, [['c', 'c/(mol/L)'], ['pH', 'pH'], ['lgC', 'lg c'],
                                   ['alpha', '水解/%']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 10 · 反应 8／9 —— precipitate-convert（AgCl → AgI 等，Ksp 差异）      *
   * ==================================================================== */
  var PC_ANION = [
    { value: 'ki', label: 'KI 溶液（生成黄色 AgI）' },
    { value: 'kbr', label: 'KBr 溶液（生成淡黄色 AgBr）' },
    { value: 'na2s', label: 'Na₂S 溶液（生成黑色 Ag₂S）' }
  ];
  var PC_KSPKEY = { ki: 'agi', kbr: 'agbr', na2s: 'ag2s' };
  var PC_ANION_LABEL = { ki: 'I⁻', kbr: 'Br⁻', na2s: 'S²⁻' };
  function pcKsp(anion) { return KSP[PC_KSPKEY[anion] || 'agi']; }
  function pcModel(p) {
    var anion = p.anion || 'ki';
    var vNaCl = 2.0;                                  /* 固定 2 mL NaCl 溶液 */
    var cNaCl = qgNum(p.cNaCl, 0.10);
    var cAg = qgNum(p.cAgNO3, 0.10), dAg = qgInt(p.dropsAg, 2);
    var cX = qgNum(p.cAnion, 0.100), dX = qgInt(p.dropsAnion, 4);
    var vAg = dAg * ML_PER_DROP, vX = dX * ML_PER_DROP;
    var vTot = vNaCl + vAg + vX;                      /* mL */
    var nAg = cAg * vAg, nCl = cNaCl * vNaCl, nX = cX * vX;
    var nAgCl = Math.min(nAg, nCl);                   /* 先生成的 AgCl */
    var isSulfide = (anion === 'na2s');
    var kspAGX = pcKsp(anion);
    var cCl = nAgCl / vTot;                           /* mol/L */
    var cXeq, cAgEq, nConv, alpha;
    /* ★ 这里**绝不产生 null**（见文件头 §0 的数值守卫说明）。旧写法在"沉淀剂恰好等于
       化学计量"时给 cAgEq = null，而那一点是**必然可达**的：cAgNO3 滑到上界 0.20 且
       dropsAg = 2 时 n(Ag⁺) = 0.010 mmol，与默认 n(I⁻) = 0.100×4×0.05 = 0.020… 的
       边界点（cNaCl 与 dropsAnion 取到相同刻度时）是同一个 IEEE754 值。
       物理上"没有过量沉淀剂"并不等于"没有 Ag⁺"：AgX 还会**自身溶解**提供阴离子。
       1:1 型：c(Ag⁺)·[c过量 + c(Ag⁺)] = Ksp ⇒ 解一元二次（连续、c过量 = 0 时退化为 √Ksp）；
       2:1 型：c(S²⁻) = c过量 + c(Ag⁺)/2 ⇒ c过量 = 0 时退化为 c(Ag⁺) = ∛(2Ksp)。
       两个分支的解都严格 > 0，所以 lg c(Ag⁺)、lg c(X⁻) 永远有定义（图上不再有被跳过的点）。 */
    if (isSulfide) {
      /* 2AgCl + S²⁻ ⇌ Ag₂S + 2Cl⁻ */
      var nConvMax = nAgCl / 2;
      nConv = Math.min(nX, nConvMax);                 /* 已转化的 AgCl（以 2AgCl 计） */
      var cSex = (nX - nConvMax) / vTot;              /* 过量 S²⁻（可为负） */
      if (cSex > 0) {
        cAgEq = Math.sqrt(kspAGX / cSex);             /* Ag₂S 饱和 + 过量 S²⁻ */
      } else if (nX < nConvMax && cCl > 0) {
        cAgEq = KSP.agcl / cCl;                       /* AgCl 还没转化完，Ag⁺ 由它决定 */
      } else {
        cAgEq = Math.pow(2 * kspAGX, 1 / 3);          /* 只剩 Ag₂S：自身溶解 */
      }
      cXeq = kspAGX / (cAgEq * cAgEq);                /* 由 Ag₂S 的 Ksp 反解 c(S²⁻) */
      alpha = nAgCl > 0 ? nConv * 2 / nAgCl * 100 : 0;
    } else {
      nConv = Math.min(nX, nAgCl);
      if (nX < nAgCl && cCl > 0) {
        cAgEq = KSP.agcl / cCl;                       /* AgCl 还在，c(Ag⁺) 由 AgCl 决定 */
      } else {
        var cXex = (nX - nAgCl) / vTot;               /* ≥ 0 */
        cAgEq = (-cXex + Math.sqrt(cXex * cXex + 4 * kspAGX)) / 2;
      }
      cXeq = kspAGX / cAgEq;                          /* 恒 > 0 */
      alpha = nAgCl > 0 ? nConv / nAgCl * 100 : 0;
    }
    /* 兜底：万一将来改了模型又漏出一个非法值，也**不能**让 null/NaN 往下游传
       （下游是 qgSigStr/qgSci/画布）。按"只有新沉淀、无过量沉淀剂"的自身溶解值收口。 */
    if (!qgIsNum(cAgEq) || cAgEq <= 0) cAgEq = Math.sqrt(kspAGX);
    if (!qgIsNum(cXeq) || cXeq <= 0) cXeq = kspAGX / cAgEq;
    var lgX = qgLg(cXeq), lgAg = qgLg(cAgEq);
    /* 沉淀颜色：AgCl 白 / AgBr 淡黄 / AgI 黄 / Ag₂S 黑，按转化率混色 */
    return { anion: anion, nAg: nAg, nCl: nCl, nX: nX, nAgCl: nAgCl, nConv: nConv,
             alpha: qgClamp(alpha, 0, 100), cCl: cCl, cXeq: cXeq, cAgEq: cAgEq,
             lgX: lgX, lgAg: lgAg, kspAGX: kspAGX, kspAgCl: KSP.agcl,
             ratio: KSP.agcl / kspAGX, vTot: vTot, isSulfide: isSulfide };
  }
  function pcPhen(m, p) {
    var out = [], xl = PC_ANION_LABEL[m.anion] || 'X⁻';
    out.push('先加 NaCl 再滴 AgNO₃：出现**白色** AgCl 沉淀（Ag⁺ + Cl⁻ = AgCl↓）');
    if (m.nX <= 0) {
      out.push('还没加沉淀剂：沉淀仍是白色的 AgCl');
      return out;
    }
    if (m.anion === 'ki') {
      out.push(m.alpha > 95 ? '再加入 KI 溶液并振荡：**白色沉淀逐渐变成黄色**（AgI），上层液仍无色'
                            : '加入 KI 后白色沉淀部分变黄（AgI 与 AgCl 混在一起）');
    } else if (m.anion === 'kbr') {
      out.push(m.alpha > 95 ? '再加入 KBr 溶液并振荡：白色沉淀变成**淡黄色**（AgBr）'
                            : '加入 KBr 后白色沉淀略带淡黄色（AgBr 与 AgCl 混在一起）');
    } else {
      out.push(m.alpha > 95 ? '再加入 Na₂S 溶液并振荡：沉淀迅速变成**黑色**（Ag₂S）'
                            : '加入 Na₂S 后沉淀变灰黑（Ag₂S 与 AgCl 混在一起）');
    }
    out.push('转化率约 ' + qgPct(m.alpha, 1) + '：Ksp(AgCl) = 1.8×10⁻¹⁰ 比 Ksp(Ag' +
             (m.anion === 'ki' ? 'I' : (m.anion === 'kbr' ? 'Br' : '₂S')) + ') = ' +
             qgSci(m.kspAGX, 2) + ' 大 ' + qgSci(m.ratio, 2) +
             ' 倍，所以平衡强烈偏向生成更难溶的那种沉淀');
    out.push('平衡后 c(Ag⁺) ≈ ' + qgSigStr(m.cAgEq, 3) + ' mol/L、c(' + xl + ') ≈ ' +
             qgSigStr(m.cXeq, 3) + ' mol/L：难溶盐把 c(Ag⁺) 压得极低，这就是沉淀转化的驱动力');
    if (m.alpha < 99.5) {
      out.push('沉淀剂不足：还有 ' + qgPct(100 - m.alpha, 1) + ' 的 AgCl 没转化，' +
               '要加足量（教材：加足量 KI 溶液，绝大部分 AgCl 才能转化为 AgI）');
    }
    out.push('（对照：AgCl 能溶于氨水生成 [Ag(NH₃)₂]⁺，而 AgI 不溶于氨水 —— ' +
             '2025 年重庆卷/甘肃卷就是用这个差别来比较 Ksp 的）');
    return out;
  }
  API.register('precipitate-convert', {
    id: 'precipitate-convert',
    name: '沉淀的转化（AgCl → AgI / AgBr / Ag₂S）',
    group: '离子反应与溶液平衡',
    aim: '观察白色 AgCl 沉淀转化为更难溶的 AgI / AgBr / Ag₂S，理解沉淀转化与 Ksp 的关系',
    principle: 'AgCl 在水中存在沉淀溶解平衡 AgCl(s) ⇌ Ag⁺ + Cl⁻（Ksp = 1.8×10⁻¹⁰）；' +
               'AgI 同样存在 AgI(s) ⇌ Ag⁺ + I⁻（Ksp = 8.5×10⁻¹⁷）。因为 Ksp(AgI) 远小于 Ksp(AgCl)，' +
               '向 AgCl 沉淀中滴加 KI 时 Q(AgI) > Ksp(AgI)，Ag⁺ 与 I⁻ 结合生成 AgI，' +
               '使 AgCl 的溶解平衡向溶解方向移动，直到绝大部分 AgCl 转化为 AgI：' +
               'I⁻(aq) + AgCl(s) ⇌ AgI(s) + Cl⁻(aq)（人教版实验 3-4）。同理 AgI 还能继续转化为 ' +
               'Ag₂S。转化的方向总是"由较易溶的向更难溶的"；转化后 c(Ag⁺) 由更难溶的那种盐决定，' +
               '即 lg c(Ag⁺) = lg Ksp(AgX) − lg c(X⁻) —— 图中斜率 −1 的直线。',
    apparatus: ['试管', '试管架', '胶头滴管', '量筒', 'NaCl 溶液', 'AgNO₃ 溶液',
                'KI 溶液', 'KBr 溶液', 'Na₂S 溶液', '氨水（做对照用）'],
    steps: ['取 2 mL NaCl 溶液加入试管，滴入 dropsAg 滴 AgNO₃ 溶液，得到白色 AgCl 沉淀',
            '再滴入 dropsAnion 滴沉淀剂（KI / KBr / Na₂S），振荡，观察沉淀颜色的变化',
            '静置，观察上层液的颜色（判断是不是转化完全）',
            '改变沉淀剂的浓度与滴数，比较转化率与平衡时的 c(Ag⁺)',
            '做对照：把 AgCl 沉淀分成两份，一份加氨水（溶解），一份加 KI 后再加氨水（不溶解）'],
    params: [
      { key: 'anion', label: '加入的沉淀剂', type: 'select', value: 'ki', options: PC_ANION },
      { key: 'cNaCl', label: 'NaCl 溶液浓度', unit: 'mol/L', min: 0.01, max: 0.20, step: 0.01, value: 0.10 },
      { key: 'cAgNO3', label: 'AgNO₃ 溶液浓度', unit: 'mol/L', min: 0.01, max: 0.20, step: 0.01, value: 0.10 },
      { key: 'dropsAg', label: '滴入 AgNO₃ 的滴数', unit: '滴', min: 1, max: 8, step: 1, value: 2 },
      { key: 'cAnion', label: '沉淀剂浓度', unit: 'mol/L', min: 0.005, max: 0.100, step: 0.005, value: 0.100 },
      { key: 'dropsAnion', label: '滴入沉淀剂的滴数', unit: '滴', min: 1, max: 20, step: 1, value: 4 }
    ],
    react: function (p, ctx) {
      var m = pcModel(p), idx = qgNum(ctx && ctx.index, 0);
      var rnd = qgRng(idx * 3701 + Math.round(m.cXeq * 1e9) + 11);
      var eq, io, nm;
      if (m.anion === 'ki') {
        eq = 'AgCl + KI = AgI↓ + KCl';
        io = 'AgCl + I- ⇌ AgI + Cl-';
        nm = 'AgI';
      } else if (m.anion === 'kbr') {
        eq = 'AgCl + KBr = AgBr↓ + KCl';
        io = 'AgCl + Br- ⇌ AgBr + Cl-';
        nm = 'AgBr';
      } else {
        eq = '2AgCl + Na2S = Ag2S↓ + 2NaCl';
        io = '2AgCl + S2- ⇌ Ag2S + 2Cl-';
        nm = 'Ag2S';
      }
      return {
        phenomena: pcPhen(m, p),
        equation: eq,
        ionic: io,
        type: '沉淀的转化（难溶电解质的沉淀溶解平衡移动）',
        conditions: '常温；先制得 AgCl 沉淀，再加足量沉淀剂并振荡',
        measures: {
          nAgCl: qgSig(m.nAgCl, 4), nX: qgSig(m.nX, 4), nConv: qgSig(m.nConv, 4),
          alpha: qgSig(m.alpha, 4), cCl: qgSig(m.cCl, 3),
          cX: qgSig(m.cXeq, 3), cAg: qgSig(m.cAgEq, 3),
          lgX: (m.lgX === null ? null : qgSig(m.lgX, 4)),
          lgAg: (m.lgAg === null ? null : qgSig(m.lgAg + (rnd() - 0.5) * 0.01, 4)),
          kspAGX: m.kspAGX, ratio: qgSig(m.ratio, 3)
        }
      };
    },
    columns: [
      { key: 'nAgCl', label: '生成的 AgCl', unit: 'mmol' },
      { key: 'nX', label: '加入的沉淀剂', unit: 'mmol' },
      { key: 'nConv', label: '被转化的 AgCl', unit: 'mmol' },
      { key: 'alpha', label: '转化率', unit: '%' },
      { key: 'cCl', label: '平衡 c(Cl⁻)', unit: 'mol/L' },
      { key: 'cX', label: '平衡 c(沉淀剂阴离子)', unit: 'mol/L' },
      { key: 'cAg', label: '平衡 c(Ag⁺)', unit: 'mol/L' },
      { key: 'lgX', label: 'lg c(沉淀剂阴离子)', unit: '' },
      { key: 'lgAg', label: 'lg c(Ag⁺)', unit: '' },
      { key: 'kspAGX', label: 'Ksp(新沉淀)', unit: '' },
      { key: 'ratio', label: 'Ksp(AgCl)/Ksp(新沉淀)', unit: '倍' }
    ],
    graph: {
      x: 'lgX', y: 'lgAg', fit: 'linear',
      title: 'lg c(Ag⁺) 与 lg c(沉淀剂阴离子) 的关系（沉淀溶解平衡的定量表现）',
      note: '转化完成后 c(Ag⁺) 由更难溶的那种银盐决定：AgX 型给出 c(Ag⁺) = Ksp/c(X⁻)，' +
            '所以 lg c(Ag⁺) = lg Ksp − lg c(X⁻)，是一条**斜率 −1** 的直线，' +
            '纵轴截距就是 lg Ksp。即使沉淀剂不足（AgCl 还没转化完），两个平衡同时成立，' +
            '点仍然落在这条线上。Ag₂S 是 2:1 型（c(Ag⁺) = √(Ksp/c(S²⁻))），斜率是 −0.5，' +
            '换沉淀剂时请把整段数据一起换，别把两种盐的点混在一条直线上读。',
      xLabel: 'lg[平衡 c(沉淀剂阴离子)/(mol·L⁻¹)]',
      yLabel: 'lg[平衡 c(Ag⁺)/(mol·L⁻¹)]'
    },
    conclude: function (rows, p) {
      var m = pcModel(p), n = rows ? rows.length : 0;
      var nm = (m.anion === 'ki' ? 'AgI' : (m.anion === 'kbr' ? 'AgBr' : 'Ag₂S'));
      var txt = '把 ' + nm + ' 的沉淀剂加入白色的 AgCl 沉淀中，沉淀发生了转化：' +
                (m.anion === 'ki' ? 'AgCl + I⁻ ⇌ AgI + Cl⁻'
                 : (m.anion === 'kbr' ? 'AgCl + Br⁻ ⇌ AgBr + Cl⁻'
                                      : '2AgCl + S²⁻ ⇌ Ag₂S + 2Cl⁻')) + '。' +
                '本次生成 AgCl ' + qgSigStr(m.nAgCl, 3) + ' mmol，加入沉淀剂 ' +
                qgSigStr(m.nX, 3) + ' mmol，转化掉 AgCl ' + qgSigStr(m.nConv, 3) +
                ' mmol（转化率 ' + qgSigStr(m.alpha, 3) + '%）。';
      txt += ' Ksp(AgCl) = 1.8×10⁻¹⁰ 比 Ksp(' + nm + ') = ' + qgSci(m.kspAGX, 2) +
             ' 大 ' + qgSci(m.ratio, 2) + ' 倍，所以平衡强烈偏向生成更难溶的 ' + nm + '；' +
             '平衡时 c(Ag⁺) ≈ ' + qgSigStr(m.cAgEq, 3) + ' mol/L，被压得极低。';
      txt += ' 结论：沉淀转化的方向总是由溶解度较大的向溶解度更小的方向进行，' +
             '两种难溶盐的 Ksp 差别越大，转化越完全。';
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: (m.anion === 'ki' ? 'AgCl + KI = AgI↓ + KCl'
                   : (m.anion === 'kbr' ? 'AgCl + KBr = AgBr↓ + KCl'
                                        : '2AgCl + Na2S = Ag2S↓ + 2NaCl')),
        ionic: (m.anion === 'ki' ? 'AgCl + I- ⇌ AgI + Cl-'
                : (m.anion === 'kbr' ? 'AgCl + Br- ⇌ AgBr + Cl-'
                                     : '2AgCl + S2- ⇌ Ag2S + 2Cl-')),
        errors: [
          '沉淀剂加得不够（或浓度太低）：AgCl 只转化了一部分，看到的是白黄混杂的颜色，容易误判成"没有转化"；教材的做法是加**足量** KI 溶液',
          'AgNO₃ 加得太多：溶液里残留大量 Ag⁺，后加的 I⁻ 会直接与游离 Ag⁺ 生成 AgI 沉淀，而不是"由 AgCl 转化而来"，实验就失去了证明力',
          '试管没有洗净、或用了自来水：Cl⁻、CO₃²⁻ 会带来额外的白色沉淀，颜色变化的判据被干扰',
          '只看颜色不看"是否为转化"的对照：要证明 AgI 比 AgCl 更难溶，还必须做"AgCl 溶于氨水、AgI 不溶于氨水"的对照（2025 年重庆卷、甘肃卷的考点就在这里）'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = pcModel(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        if (c.clearRect) c.clearRect(0, 0, W, H);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, '沉淀的转化：AgCl → ' +
               (m.anion === 'ki' ? 'AgI' : (m.anion === 'kbr' ? 'AgBr' : 'Ag₂S')),
               '转化率 ' + qgPct(m.alpha, 1));
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管里的颜色变化', '白色 AgCl → 新沉淀');
        var tx = M + 84, ty = y1 + 46, tw = 62, th = Math.min(h1 - 70, 200);
        if (th < 90) th = 90;
        qgTube(d, F, tx, ty, tw, th, 0.86, 'rgba(224,232,238,0.55)', '反应液', '#6B645C');
        /* 颜色混合：AgCl 白 (250,250,247) → AgI 黄 (222,196,50) / AgBr 淡黄 (236,228,180)
           / Ag₂S 黑 (32,30,28) */
        var t = qgClamp(m.alpha / 100, 0, 1);
        var c0 = [250, 250, 247];
        var c1 = (m.anion === 'ki') ? [222, 196, 50]
               : (m.anion === 'kbr' ? [236, 226, 176] : [34, 32, 30]);
        var col = 'rgba(' + Math.round(c0[0] + (c1[0] - c0[0]) * t) + ',' +
                          Math.round(c0[1] + (c1[1] - c0[1]) * t) + ',' +
                          Math.round(c0[2] + (c1[2] - c0[2]) * t) + ',0.98)';
        var amt = qgClamp(m.nAgCl / 0.06, 0, 1);
        qgPrecip(d, 8101 + Math.round(m.nAgCl * 613), tx - tw / 2 + 3, ty + th - 8, tw - 6, 30,
                 amt, col, 8);
        d.txt(m.anion === 'ki' ? (t > 0.9 ? '黄色 AgI' : '白 → 黄')
              : (m.anion === 'kbr' ? (t > 0.9 ? '淡黄色 AgBr' : '白 → 淡黄')
                                   : (t > 0.9 ? '黑色 Ag₂S' : '白 → 黑')),
              tx, ty + th - 42, F(10, true, false), '#4A4438', 'center');
        /* Ksp 对比条形图（lg Ksp，越负越难溶）。
           注意：画柱的原语是**文件级函数** qgKspBar（不是 draw 里的局部函数）——
           局部函数/局部变量在 draw 体内被当函数调用会被核心的 shadowAudit 判红，
           物理实验台就在这里踩过坑（mech.js 的 var L 遮蔽了画线原语 L()，
           draw() 每帧抛 TypeError → 画面只画一半而 console 干净）。别搬回里面。 */
        var bx = M + 200, by = y1 + 52, bw = 230, bh = 16;
        qgKspBar(d, F, bx, by + 20, bw, bh, 'AgCl',
                 Math.log(KSP.agcl) / Math.LN10, 'rgba(246,246,242,0.98)');
        qgKspBar(d, F, bx, by + 56, bw, bh,
                 (m.anion === 'ki' ? 'AgI' : (m.anion === 'kbr' ? 'AgBr' : 'Ag₂S')),
                 Math.log(m.kspAGX) / Math.LN10,
                 m.anion === 'ki' ? 'rgba(222,196,50,0.9)'
                   : (m.anion === 'kbr' ? 'rgba(236,226,176,0.95)' : 'rgba(40,38,36,0.9)'));
        d.txt('条越短 = Ksp 越小 = 越难溶（转化方向：由长到短）',
              bx, by + 96, F(10, false, true), '#7A4A2B', 'left');
        var rx = M + 460;
        qgReadout(d, F, rx, y1 + 52, 116, [
          ['n(AgCl) / mmol', qgSigStr(m.nAgCl, 3), INK],
          ['n(沉淀剂) / mmol', qgSigStr(m.nX, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 116, [
          ['转化率', qgPct(m.alpha, 1), m.alpha > 99.5 ? '#2E6B4F' : '#A03028'],
          ['c(Ag⁺) / (mol/L)', qgSigStr(m.cAgEq, 3), '#7A4A2B']
        ]);
        qgReadout(d, F, rx, y1 + 132, 116, [
          ['lg c(Ag⁺)', m.lgAg === null ? '—' : qgSigStr(m.lgAg, 3), INK],
          ['Ksp 之比', qgSci(m.ratio, 2) + ' 倍', '#8A5A22']
        ]);
        var rec = qgRowText(rows, [['alpha', '转化/%'], ['cAg', 'c(Ag⁺)'],
                                   ['lgX', 'lg c(X⁻)'], ['lgAg', 'lg c(Ag⁺)']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
      } finally { c.restore(); }
    }
  });

  /* ==================================================================== *
   * 11 · 反应 9／9 —— complex-ion（配离子：Fe(SCN)₃ 血红色 / [Cu(NH₃)₄]²⁺）*
   * ==================================================================== */
  var CX_SYS = [
    { value: 'fescn', label: 'Fe³⁺ + SCN⁻（血红色）' },
    { value: 'cuamm', label: 'Cu²⁺ + 过量氨水（深蓝色）' }
  ];
  var CX_VOL = 5.0;     /* 金属离子溶液固定 5 mL（教材实验 2-1 的做法） */
  function cxModel(p) {
    var sys = p.sys || 'fescn';
    var cM = qgNum(p.cM, sys === 'fescn' ? 0.010 : 0.010);
    var cKSCN = qgNum(p.cKSCN, 0.150), cNH3 = qgNum(p.cNH3, 2.0);
    var dL = qgInt(p.dropsL, 40);
    var vL = dL * ML_PER_DROP;
    var vTot = CX_VOL + vL;
    var nN = cM * CX_VOL;                       /* mmol 金属离子 */
    var out = { sys: sys, cM: cM, nN: nN, vL: vL, vTot: vTot, dL: dL,
                cKSCN: cKSCN, cNH3: cNH3 };
    if (sys === 'fescn') {
      var nSCN = cKSCN * vL;
      out.nLig = nSCN;
      /* Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃：配体不足时按 1:3 限量 */
      var nCom = Math.min(nN, nSCN / 3);
      out.nCom = nCom;
      out.cCom = nCom / vTot;                   /* mmol/mL = mol/L */
      out.cComMm = nCom / vTot * 1000;          /* mmol/L */
      out.stage = (nSCN >= 3 * nN) ? 'full' : 'ligand-limit';
      /* 相对吸光度：本台把这台"分光计"的满量程定在 c = 20 mmol/L，
         A = c/(20 mmol·L⁻¹)。**不做上限截断**，否则扫浓度时高浓度点会被削平、
         A–c 图就不再是过原点的直线（第一版就是在这里把 r² 弄成了负数）。 */
      out.abs = out.cComMm / 20;
      out.nFree = nN - nCom;
    } else {
      var nNH3 = cNH3 * vL;
      out.nLig = nNH3;
      /* 先生成 Cu(OH)₂（消耗 2 NH₃），再溶解成 [Cu(NH₃)₄]²⁺（再消耗 4 NH₃）：
         总共 6 NH₃ / Cu 才能得到澄清深蓝色溶液 */
      var nCuOH2 = Math.min(nN, nNH3 / 2);
      var nCom2 = Math.min(nCuOH2, Math.max(nNH3 - 2 * nCuOH2, 0) / 4);
      out.nCuOH2 = nCuOH2 - nCom2;
      out.nCom = nCom2;
      out.cCom = nCom2 / vTot;
      out.cComMm = nCom2 / vTot * 1000;
      if (nNH3 < 2 * nN) out.stage = 'too-little';
      else if (nCom2 >= nN - 1e-9) out.stage = 'full';
      else out.stage = 'partial';
      out.abs = out.cComMm / 20;
      out.nFree = nN - nCom2;
    }
    return out;
  }
  function cxPhen(m, p) {
    var out = [];
    if (m.sys === 'fescn') {
      out.push(m.nCom > 0
        ? '滴入 KSCN 溶液后，溶液立即变成**血红色**（颜色跟血液极为相似）'
        : '没有明显变化：SCN⁻ 或 Fe³⁺ 太少');
      if (m.nCom > 0) {
        out.push('颜色深浅随配离子浓度变化：本次 c[Fe(SCN)₃] ≈ ' + qgSigStr(m.cComMm, 3) +
                 ' mmol/L，相对吸光度 A ≈ ' + qgSigStr(m.abs, 3) + '（朗伯-比尔：A 与有色粒子浓度成正比）');
      }
      if (m.stage === 'ligand-limit') {
        out.push('KSCN 不足（n(SCN⁻) < 3n(Fe³⁺)）：血红色偏浅，' +
                 '还有 ' + qgPct(m.nFree / Math.max(m.nN, 1e-9) * 100, 1) + ' 的 Fe³⁺ 没有配位');
      } else {
        out.push('KSCN 足量：Fe³⁺ 基本全部配位，血红色最深（教材实验 2-1：' +
                 '5 mL 0.005 mol/L FeCl₃ + 5 mL 0.015 mol/L KSCN 溶液呈红色）');
        out.push('再加入 FeCl₃ 或 KSCN（增大反应物浓度），平衡右移、红色**加深**' +
                 '（这就是"同离子/浓度使平衡移动"的直观表现）');
      }
      out.push('注意：Fe²⁺ 与 SCN⁻ **不显红色**，所以这个反应可以鉴定 Fe³⁺ 的存在');
      out.push('加入 NaOH 会生成红褐色 Fe(OH)₃ 沉淀、血红色褪去（Fe³⁺ 被夺走，平衡左移）');
    } else {
      if (m.stage === 'too-little') {
        out.push('氨水太少：出现**蓝色絮状** Cu(OH)₂ 沉淀（Cu²⁺ + 2NH₃·H₂O = Cu(OH)₂↓ + 2NH₄⁺），' +
                 '溶液仍是浅蓝色');
        out.push('（继续加氨水，蓝色沉淀会溶解）');
      } else if (m.stage === 'partial') {
        out.push('先出现**蓝色** Cu(OH)₂ 沉淀，继续滴加氨水时沉淀**部分溶解**，' +
                 '溶液变成蓝色与深蓝色混杂');
        out.push('此时剩余 Cu(OH)₂ 约 ' + qgSigStr(m.nCuOH2, 3) + ' mmol —— ' +
                 '氨水还不够把沉淀全部溶解成配离子');
      } else {
        out.push('先出现**蓝色** Cu(OH)₂ 沉淀，继续加氨水后沉淀**完全溶解**，' +
                 '得到**深蓝色**的澄清溶液');
        out.push('生成的是四氨合铜配离子：Cu(OH)₂ + 4NH₃ = [Cu(NH₃)₄](OH)₂ ' +
                 '（深蓝色 [Cu(NH₃)₄]²⁺，教材选择性必修2 实验 3-3）');
        out.push('本次 c{[Cu(NH₃)₄]²⁺} ≈ ' + qgSigStr(m.cComMm, 3) + ' mmol/L，' +
                 '相对吸光度 A ≈ ' + qgSigStr(m.abs, 3) + '（颜色比 Cu²⁺ 的浅蓝色深得多）');
        out.push('再向深蓝色溶液里加入乙醇：溶解度变小，析出**深蓝色晶体**（Cu(NH₃)₄SO₄·H₂O）');
        out.push('加入稀硫酸：深蓝色褪去、恢复 Cu²⁺ 的蓝色（[Cu(H₂O)₄]²⁺）—— 2025 年安徽卷的考点');
      }
    }
    return out;
  }
  API.register('complex-ion', {
    id: 'complex-ion',
    name: '配离子的形成（Fe³⁺ + SCN⁻ 血红色；Cu²⁺ + 过量氨水深蓝色）',
    group: '离子反应与溶液平衡',
    aim: '观察 Fe³⁺ 与 SCN⁻ 生成血红色配离子、Cu²⁺ 与过量氨水生成深蓝色四氨合铜配离子，理解配位平衡与浓度的影响',
    principle: '中心离子与配体以配位键结合成配离子。Fe³⁺ 与 SCN⁻ 生成血红色的硫氰化铁配离子：' +
               'Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃（教材选择性必修2 实验 3-4 描述其颜色"跟血液极为相似"，' +
               'Fe²⁺ 不显红色，因此可用于鉴定 Fe³⁺）。Cu²⁺ 与氨水先生成蓝色的 Cu(OH)₂ 沉淀' +
               '（Cu²⁺ + 2NH₃·H₂O = Cu(OH)₂↓ + 2NH₄⁺），继续加氨水时 Cu(OH)₂ 溶解并生成' +
               '深蓝色的 [Cu(NH₃)₄]²⁺：Cu(OH)₂ + 4NH₃ = [Cu(NH₃)₄](OH)₂，总反应可写成' +
               'CuSO₄ + 4NH₃ = [Cu(NH₃)₄]SO₄。配离子的浓度直接决定颜色深浅 —— ' +
               '按朗伯-比尔定律，吸光度 A 与有色粒子浓度成正比，所以 A–c 图是过原点的直线。' +
               '加入酸、碱或改变配体浓度都会使配位平衡移动（加 H⁺ 会夺走 NH₃，深蓝色褪去）。',
    apparatus: ['试管', '试管架', '胶头滴管', '量筒', 'FeCl₃ 溶液', 'KSCN 溶液',
                'CuSO₄ 溶液', '浓氨水（约 15 mol/L）', '稀硫酸', '95% 乙醇'],
    steps: ['取 5 mL 金属离子溶液（FeCl₃ 或 CuSO₄）加入试管',
            'Fe³⁺ 组：滴入 KSCN 溶液，观察血红色的出现与深浅',
            'Cu²⁺ 组：先滴少量氨水看蓝色 Cu(OH)₂ 沉淀，再继续滴到沉淀完全溶解成深蓝色',
            '改变金属离子浓度、配体浓度与滴数，比较颜色深浅（相对吸光度）',
            'Cu²⁺ 组再加乙醇（析出深蓝色晶体）、再加稀硫酸（深蓝色褪去）做对照'],
    params: [
      { key: 'sys', label: '配位体系', type: 'select', value: 'fescn', options: CX_SYS },
      { key: 'cM', label: '金属离子浓度（FeCl₃ / CuSO₄）', unit: 'mol/L', min: 0.001, max: 0.020, step: 0.001, value: 0.010 },
      { key: 'cKSCN', label: 'KSCN 溶液浓度', unit: 'mol/L', min: 0.005, max: 0.150, step: 0.005, value: 0.150 },
      { key: 'cNH3', label: '氨水浓度', unit: 'mol/L', min: 0.5, max: 15.0, step: 0.5, value: 2.0 },
      { key: 'dropsL', label: '滴入配体的滴数', unit: '滴', min: 1, max: 40, step: 1, value: 40 }
    ],
    react: function (p, ctx) {
      var m = cxModel(p), idx = qgNum(ctx && ctx.index, 0);
      var rnd = qgRng(idx * 2903 + Math.round(m.cComMm * 1000) + 17);
      var eq, io;
      if (m.sys === 'fescn') {
        eq = 'FeCl3 + 3KSCN ⇌ Fe(SCN)3 + 3KCl';
        io = 'Fe3+ + 3SCN- ⇌ Fe(SCN)3';
      } else if (m.stage === 'too-little') {
        eq = 'CuSO4 + 2NH3·H2O = Cu(OH)2↓ + (NH4)2SO4';
        io = 'Cu2+ + 2NH3·H2O = Cu(OH)2↓ + 2NH4+';
      } else {
        eq = 'CuSO4 + 4NH3 = [Cu(NH3)4]SO4';
        io = 'Cu2+ + 4NH3 = [Cu(NH3)4]2+';
      }
      return {
        phenomena: cxPhen(m, p),
        equation: eq,
        ionic: io,
        type: m.sys === 'fescn' ? '配位反应（配位平衡，可逆）'
                                : (m.stage === 'too-little' ? '复分解反应（沉淀反应）'
                                                            : '配位反应（沉淀溶解并形成配离子）'),
        conditions: '常温；配体要**过量**（Cu²⁺ 组需要 n(NH₃) ≥ 6n(Cu²⁺) 才能得到澄清深蓝色溶液）',
        measures: {
          nN: qgSig(m.nN, 4), nLig: qgSig(m.nLig, 4), nCom: qgSig(m.nCom, 4),
          cCom: qgSig(m.cComMm, 4),
          abs: qgSig(m.abs * (0.995 + 0.01 * rnd()), 4),
          nFree: qgSig(m.nFree, 4),
          ratio: qgSig(m.nLig / Math.max(m.nN, 1e-9), 3)
        }
      };
    },
    columns: [
      { key: 'nN', label: '金属离子的物质的量', unit: 'mmol' },
      { key: 'nLig', label: '配体的物质的量', unit: 'mmol' },
      { key: 'ratio', label: 'n(配体)/n(金属离子)', unit: '' },
      { key: 'nCom', label: '生成配离子的物质的量', unit: 'mmol' },
      { key: 'cCom', label: 'c(配离子)', unit: 'mmol/L' },
      { key: 'abs', label: '颜色深浅（相对吸光度 A）', unit: '' },
      { key: 'nFree', label: '未配位的金属离子', unit: 'mmol' }
    ],
    graph: {
      x: 'cCom', y: 'abs', fit: 'origin',
      title: '溶液颜色（相对吸光度 A）与配离子浓度的关系',
      note: '朗伯-比尔定律：同一液层厚度下 A = ε·b·c，所以 A 与有色粒子浓度成正比、' +
            '过原点，斜率就是 ε·b（本台的相对标度取 A = c/(20 mmol·L⁻¹)，不做上限截断）。' +
            '图上的点落在直线上说明"颜色深浅确实是配离子浓度决定的"；' +
            '点向横轴方向堆叠（斜率不变但 c 不再增大）表示配体已经用尽、配位达到饱和 —— ' +
            '那一段要看 nLig/nN 一列，不要再按直线外推。',
      xLabel: 'c(配离子) / (mmol·L⁻¹)',
      yLabel: '相对吸光度 A'
    },
    conclude: function (rows, p) {
      var m = cxModel(p), n = rows ? rows.length : 0;
      var txt;
      if (m.sys === 'fescn') {
        txt = 'Fe³⁺ 与 SCN⁻ 生成血红色的配离子：Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃（教材：颜色跟血液极为' +
              '相似；Fe²⁺ 不显红色，可用此鉴定 Fe³⁺）。本次 n(Fe³⁺) = ' + qgSigStr(m.nN, 3) +
              ' mmol、n(SCN⁻) = ' + qgSigStr(m.nLig, 3) + ' mmol，生成配离子 ' +
              qgSigStr(m.nCom, 3) + ' mmol，c[Fe(SCN)₃] ≈ ' + qgSigStr(m.cComMm, 3) +
              ' mmol/L，相对吸光度 A ≈ ' + qgSigStr(m.abs, 3) + '。';
        if (m.stage === 'ligand-limit') {
          txt += ' KSCN 不足（n(SCN⁻) < 3n(Fe³⁺)），血红色偏浅、Fe³⁺ 没有全部配位。';
        } else {
          txt += ' KSCN 足量，Fe³⁺ 基本全部配位，血红色最深。';
        }
        txt += ' 加入 NaOH 会因生成 Fe(OH)₃ 而使血红色褪去（平衡左移）。';
      } else {
        txt = 'Cu²⁺ 与氨水的反应分两步：先生成蓝色 Cu(OH)₂ 沉淀' +
              '（Cu²⁺ + 2NH₃·H₂O = Cu(OH)₂↓ + 2NH₄⁺），氨水过量时沉淀溶解并生成深蓝色的' +
              '[Cu(NH₃)₄]²⁺（Cu(OH)₂ + 4NH₃ = [Cu(NH₃)₄](OH)₂）。本次 n(Cu²⁺) = ' +
              qgSigStr(m.nN, 3) + ' mmol、n(NH₃) = ' + qgSigStr(m.nLig, 3) +
              ' mmol（即 ' + qgSigStr(m.nLig / Math.max(m.nN, 1e-9), 3) + ' 倍），';
        if (m.stage === 'too-little') {
          txt += '氨水不足 2 倍化学计量，只看到蓝色沉淀，还没有配离子生成。';
        } else if (m.stage === 'partial') {
          txt += '氨水在 2~6 倍之间，沉淀只溶解了一部分（还剩 ' + qgSigStr(m.nCuOH2, 3) +
                 ' mmol Cu(OH)₂），溶液是蓝色与深蓝色混杂。';
        } else {
          txt += '氨水超过 6 倍化学计量，沉淀完全溶解，得到澄清的深蓝色溶液，' +
                 'c{[Cu(NH₃)₄]²⁺} ≈ ' + qgSigStr(m.cComMm, 3) + ' mmol/L，A ≈ ' +
                 qgSigStr(m.abs, 3) + '。';
        }
        txt += ' 结论：配离子的形成需要配体过量；颜色深浅由配离子浓度决定（A ∝ c）。';
      }
      if (n > 1) txt += ' 已记录 ' + n + ' 次观察。';
      return {
        text: txt,
        equation: (m.sys === 'fescn' ? 'FeCl3 + 3KSCN ⇌ Fe(SCN)3 + 3KCl'
                                     : 'CuSO4 + 4NH3 = [Cu(NH3)4]SO4'),
        ionic: (m.sys === 'fescn' ? 'Fe3+ + 3SCN- ⇌ Fe(SCN)3'
                                  : 'Cu2+ + 4NH3 = [Cu(NH3)4]2+'),
        errors: [
          'KSCN 或氨水加得不足：Fe³⁺ 组红色偏浅会误判成"浓度低"；Cu²⁺ 组沉淀没溶完会误判成"氨水不能溶解 Cu(OH)₂"，必须按 n(NH₃) ≥ 6n(Cu²⁺) 加足',
          '用 Fe²⁺ 溶液或已被氧化的 FeSO₄ 做实验：Fe²⁺ 与 SCN⁻ 不显红色，若溶液里混有 Fe³⁺ 就会出现"时红时不红"的假象；做 Fe³⁺ 鉴定要用新制的 FeCl₃ 溶液',
          '试管里残留 NaOH 或其他碱：Fe³⁺ 会直接生成红褐色 Fe(OH)₃ 沉淀、Cu²⁺ 会生成蓝色 Cu(OH)₂，把配离子的颜色盖住；试管必须洗净',
          '浓氨水挥发出的氨有强刺激性、对眼和呼吸道有刺激：滴加时试管口不能对着人，必须在通风处操作；加乙醇析出晶体时也要避免明火'
        ]
      };
    },
    draw: function (g, p, state) {
      var gr = g || {}, c = gr.c;
      if (!c) return;
      var W = qgNum(gr.w, 800), H = qgNum(gr.h, 520);
      var d = qgDraw(gr), F = qgFontFn(gr);
      var m = cxModel(p), rows = (state && state.rows) ? state.rows : [];
      c.save();
      try {
        if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
        c.lineJoin = 'round'; c.lineCap = 'round';
        qgHead(gr, d, F, m.sys === 'fescn' ? 'Fe³⁺ + SCN⁻：血红色配离子'
                                           : 'Cu²⁺ + 过量氨水：深蓝色配离子',
               '配体 ' + qgSigStr(m.nLig, 3) + ' mmol');
        var M = 26, topW = W - M * 2, y1 = 40;
        var h1 = Math.max(180, H - y1 - M - 128);
        qgPanel(gr, d, F, M, y1, topW, h1, '试管里的颜色',
                'A ≈ ' + qgSigStr(m.abs, 3));
        var tx = M + 84, ty = y1 + 46, tw = 62, th = Math.min(h1 - 70, 200);
        if (th < 90) th = 90;
        var liquid, lab, pcol = null;
        var a = qgClamp(m.abs / 0.8, 0, 1);
        if (m.sys === 'fescn') {
          /* 血红色：由浅粉到深血红 */
          liquid = 'rgba(' + Math.round(238 - 60 * a) + ',' + Math.round(226 - 190 * a) + ',' +
                   Math.round(220 - 180 * a) + ',0.9)';
          lab = a > 0.02 ? '血红色（颜色似血液）' : '几乎无色';
        } else {
          if (m.stage === 'too-little' || m.stage === 'partial') {
            liquid = 'rgba(150,196,232,0.85)';
            lab = '浅蓝色 + 蓝色沉淀';
            pcol = 'rgba(96,156,214,0.97)';
          } else {
            liquid = 'rgba(' + Math.round(96 - 66 * a) + ',' + Math.round(150 - 90 * a) + ',' +
                     Math.round(216 - 46 * a) + ',0.92)';
            lab = '深蓝色 [Cu(NH₃)₄]²⁺';
          }
        }
        qgTube(d, F, tx, ty, tw, th, 0.86, liquid, '反应液', '#6B645C');
        if (pcol) {
          qgPrecip(d, 9101 + Math.round(m.nCuOH2 * 811), tx - tw / 2 + 3, ty + th - 8, tw - 6, 26,
                   qgClamp(m.nCuOH2 / 0.05, 0, 1), pcol, 9);
        }
        d.txt(lab, tx, ty + th + 30, F(10.5, true, false), '#4A3A50', 'center');
        /* 颜色深浅标尺 */
        var sx = M + 200, sy = y1 + 56, sw = 210, sh = 18;
        d.txt('颜色深浅标尺（相对吸光度 A）', sx, sy - 12, F(10, false, false), '#6B645C', 'left');
        var gi = c.createLinearGradient ? c.createLinearGradient(sx, 0, sx + sw, 0) : null;
        if (gi && gi.addColorStop) {
          if (m.sys === 'fescn') {
            gi.addColorStop(0, 'rgba(246,244,242,1)'); gi.addColorStop(0.5, 'rgba(224,140,140,1)');
            gi.addColorStop(1, 'rgba(150,18,18,1)');
          } else {
            gi.addColorStop(0, 'rgba(224,238,248,1)'); gi.addColorStop(0.5, 'rgba(120,176,224,1)');
            gi.addColorStop(1, 'rgba(18,58,150,1)');
          }
          c.fillStyle = gi;
          c.fillRect(sx, sy, sw, sh);
          c.strokeStyle = 'rgba(38,34,28,0.35)'; c.lineWidth = 1;
          c.strokeRect(sx, sy, sw, sh);
        } else {
          d.rect(sx, sy, sw, sh, 'rgba(180,180,190,0.6)', 'rgba(38,34,28,0.35)', 1);
        }
        var mx = sx + sw * qgClamp(m.abs / 0.8, 0, 1);
        d.line(mx, sy - 6, mx, sy + sh + 6);
        d.txt('当前 A = ' + qgSigStr(m.abs, 3), mx, sy + sh + 18, F(10, true, false), '#7A4A2B', 'center');
        if (m.sys === 'fescn') {
          d.txt('Fe²⁺ + SCN⁻ 不显红色 → 这个反应可鉴定 Fe³⁺', sx, sy + sh + 40,
                F(10, false, true), '#7A4A2B', 'left');
          if (m.stage === 'ligand-limit') {
            d.txt('KSCN 不足：红色偏浅，还有 ' + qgSigStr(m.nFree, 3) + ' mmol Fe³⁺ 未配位',
                  sx, sy + sh + 58, F(10, false, true), '#A03028', 'left');
          } else {
            d.txt('KSCN 足量：再加 FeCl₃ / KSCN，平衡右移、红色加深（同离子效应）',
                  sx, sy + sh + 58, F(10, false, true), '#2E6B4F', 'left');
          }
        } else {
          d.txt('加乙醇 → 析出深蓝色晶体；加稀硫酸 → 深蓝色褪为 Cu²⁺ 的蓝色',
                sx, sy + sh + 40, F(10, false, true), '#7A4A2B', 'left');
          d.txt('澄清深蓝色需要 n(NH₃) ≥ 6n(Cu²⁺)（先 2 个生成 Cu(OH)₂，再 4 个配位）',
                sx, sy + sh + 58, F(10, false, true), m.stage === 'full' ? '#2E6B4F' : '#A03028', 'left');
        }
        var rx = M + 452;
        qgReadout(d, F, rx, y1 + 52, 116, [
          ['n(金属离子) / mmol', qgSigStr(m.nN, 3), INK],
          ['n(配体) / mmol', qgSigStr(m.nLig, 3), INK]
        ]);
        qgReadout(d, F, rx, y1 + 92, 116, [
          ['n(配体)/n(金属)', qgSigStr(m.nLig / Math.max(m.nN, 1e-9), 3), INK],
          ['n(配离子) / mmol', qgSigStr(m.nCom, 3), '#7A4A2B']
        ]);
        qgReadout(d, F, rx, y1 + 132, 116, [
          ['c(配离子) / (mmol/L)', qgSigStr(m.cComMm, 3), '#7A4A2B'],
          ['相对吸光度 A', qgSigStr(m.abs, 3), '#4A3A50']
        ]);
        var rec = qgRowText(rows, [['cCom', 'c配/(mmol/L)'], ['abs', 'A'],
                                   ['nCom', 'n配/mmol'], ['ratio', 'n配体/n金属']], 4);
        qgRecord(d, F, rec, M + 14, y1 + h1 - 16 - 4 * 14 - 16, topW - 28);
      } finally { c.restore(); }
    }
  });

})();
