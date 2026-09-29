# 穷观（穷观学习）· 给 Agent 的工作手册

> 本文件是给**在本仓库/本工作区动手的 AI agent** 读的。它不讲"怎么用这个软件"（那是 `桌面版\使用说明.txt` 与 `README.md` 的事），只讲
> **① 这套东西是怎么搭的、② 每一处为什么这么设计、③ 哪些东西碰了就会出事、④ 这台机器上的坑**。
> 所有"为什么"都来自实际排查与实测（含踩坑记录），不是推测；凡是**没有**实测证据的地方，文中会明确写"未实测/仅代码走查"。

---

## 0. 一句话与三条红线

穷观 = **3D 弹性知识云**（主窗）+ **AI 出题「破卷」**（独立窗口）+ **AI 讲解/动态演示「观澜」**（桌面版走独立窗口，手机版走整屏面板）。
三种形态共用同一套网页代码：**桌面版**（.NET Framework 4.8 + WinForms + WebView2，单进程、网页资源全部内嵌进 exe）、**手机版**（Capacitor APK）、**纯网页版**（直接开 `index.html`，无宿主）。

**三条红线（违反即事故）：**

1. **原创指纹不许动。** Build ID `QG-20260920-5e5d5a` 分布在 16 处（下述 §6），另有作者署名行与开屏版权行。任何"重构/清理/格式化"都不得删改它们。
2. **用户数据不许删改。** `桌面版\数据库\qg_subjects.txt`（用户自己的知识云数据）、`桌面版\穷观学习.exe.WebView2\`（内含**真实 API Key**、笔记、自绘函数）、以及桌面快捷方式 `D:\OneDrive\Desktop\穷观学习.lnk` 属于用户资产，测试时**先备份再还原**，或干脆不碰。
3. **不要并发改同一个文件。** 本工作区经常有多个 agent 同时干活；动手前先看目标文件的 `LastWriteTime`，必要时把任务写进消息交给正在改它的那个 agent，而不是抢过来改。

---

## 1. 运行时架构与数据流

```
桌面版（单进程 exe）
├─ MainForm          主窗        → index.html   （知识云 / 检索 / 自定义知识点）
├─ TrainForm         破卷窗      → train.html   （AI 出题；观澜也复用这个窗体类开窗）
└─ （观澜）          独立窗口     → guanlan.html （AI 讲解 + 动态演示画布）
        ↑ 每个窗体各自一个 WebView2，各自加载各自的页面
        │
   页面 ⇄ 宿主： postMessage(JSON) / WebMessageReceived(JSON)
        请求 = { kind, ... , _seq:N }      回执 = { kind:"xxxResp", _seq:N, ... }
        kind: ds(AI) mats(素材检索) dbAdd/dbStat(知识云) wipe(清除) wnd(窗口) ping note
```

- **资源全部内嵌**：`index.html / train.html / guanlan.html / css / js / vendor / 指纹` 编进 exe 的资源里，经 `https://app.local/...` 提供。
  - **为什么**：一个 exe 就是完整应用，用户不需要解压一堆文件，也不会出现"网页文件被误删/版本错配"。
  - **代价**：改任何网页代码都必须**重编 exe** 才在桌面版生效。**这是最容易犯的错**：改了 `js/*.js` 却发现桌面版行为没变，99% 是没重编。
- **只有两个文件是运行时从磁盘读的**：`数据库\qg_corpus.txt`（语料，只读）与 `数据库\qg_subjects.txt`（知识云，可写）。所以改这两个文件**不需要**重编 exe。
- **为什么用 `app.local` 这个假域名**：既能拿到"同源"的浏览器待遇（localStorage、fetch 相对路径都正常），又能用一个**明确的字符串**做白名单校验（宿主的消息桥与导航拦截都只认它）。

### 1.1 消息桥的几个关键约定（每一条都是踩出来的）

| 约定 | 为什么 |
|---|---|
| 请求必须带 `_seq`，回执原样带回 | 同一窗口里可能有多个在途请求，页面靠它配对回调。 |
| **回执投递目标是"发消息的那个 WebView"** | 宿主 `HandleWebMessage(wv, cw, …)` → `PostAsync(wv, cw, …)`，`wv/cw` 来自该窗的 `WebMessageReceived` 事件。**不要**改成"发给主窗"——多窗口同时开着时会把回执串到错误的窗口。 |
| **收到回执后不要 `delete d._seq`** | 同一窗口可能挂着多套通道（`mainbridge` 的资料库通道 + `demo.js` 的观澜通道）。谁先删谁让后面的监听器认不出自己的回执。曾因此出现"UI 说成功、其实没保存"。 |
| `pend` 用 `Object.create(null)` | 否则 id 叫 `constructor`/`__proto__` 的键会命中原型链，误判成"已有回调"。 |
| 发送时**复制**对象再挂 `_seq` | 不改写调用方对象（调用方可能还要复用/记录它）。 |
| `postMessage` 失败要 try/catch 并给出明确错误 | 否则页面会一直等到超时（60s/180s），用户看到的是"卡住"。 |
| 宿主回包必须带 `_seq`，**解析失败也要带** | JSON 坏了的时候页面完全无法配对，只能从原始串里用正则宽容抠出 `_seq`（`SeqRe`）。 |

### 1.2 观澜在两端的结构**刻意不同**（不要"统一"它们）

- **桌面版**：观澜是**独立窗口**。主窗 `index.html` 里**没有**观澜面板、没有"拆为独立窗口"按钮、也不加载 `glcanvas.js/gltemplates.js/demo.js`。
  - **为什么**：主窗内嵌面板 + 独立窗口两套入口曾导致"重复窗口"与"宿主拦住原生窗口时被误判成弹窗拦截"。
- **手机版**：**保留**主界面整屏面板 + `⤢ 独立窗口` 两条路。
  - **为什么**：手机上 `window.open` 成功率低，≤768px 直接铺满整屏更顺手；且 `demo.js` 里 `openPanel()` 是"主路径"而非"降级"。照搬桌面版会点开**空面板**（观澜 DOM 是 `demo.js` 动态构建的）。
  - ⚠ 因此**不要把手机版丢给桌面版的观澜窗口测试**（`tests/guanlan-window.cjs` 断言主窗"不含 `#guanlan/#glDetach/#glAsk/#glCanvas`"，在手机版结构下必然失败，那是假红）。

---

## 2. 知识云（数据层）

- 数据文件形态：`window.MATH_DB / CHEM_DB / PHYSICS_DB / ENG_DB / BIO_DB = {version,subject,subjectName,boards[],points[]}`；点字段 `id,name,board,importance,core,keywords,content,links,book,ch`（部分带 `note`）。
- **板块 = 分组，不是层级**；`links` 是知识点之间的关联（画成连线）。词云里"点的大小/亮度/环层"由 `importance/core/跳数` 决定。
- **为什么要"降载"**（英语库 3053 点）：实例化渲染下 3053 个点只有 2 个 draw call，GPU 不是瓶颈；真正的瓶颈是**重排算法**（见 §3.1）。所以别再往"更激进的隐藏"方向优化。
- 自定义知识点（用户在详情面板手工加的）：
  - **逐条独立存储**：`qg_custom_point_v2:<科目>:<id>`；同时**兼容读**旧版整表键 `qg_custom_points_v1`。
  - **为什么**：旧实现是"整表单键覆盖写"，两个窗口/两个科目先后新增会**互相抹掉**（数学加一个、切化学再加一个 → 数学那个消失且不可恢复）。
  - **先存后挂**：`commitCustomPointCore()` 开头 `if (!saveCustomPoints(p)) return null;`。**为什么**：旧实现先挂进场景再存，配额满时"云上多了个点、刷新就没了"，属于欺骗性成功。
  - `?qg_clear=1` 会清旧键 + 所有 v2 前缀键（**跨科目全清**，这是"清空全部自定义知识点"的原意）。
- `内容待校对` 标签：`content` 含「待人工校对」的点，详情页要显示"请对照教材或词典核实"，并且**出题提示词里要声明"待校对正文不得作为命题依据"**。**为什么**：英语库有 202 条这样的内容（集中在词根点），不能让它们悄悄变成"事实"。

---

## 3. 前端两个"重活"的设计原因

### 3.1 `relayoutTargets`（英语库点选卡顿的真凶）

- 症状：点一个知识点要 **631.75 ms**（英语 3053 点）。
- 根因：BFS 之外，"互相推开"这一步遍历了**全部 3053 个点**的两两配对（≈1860 万次 × 4 轮），而且把"不可达 / 4 跳以上"的点当成"第 4 层"，全铺在同一个半径 46 的环上 → 密度超阈值 25 倍 → 每轮都有海量 `moved` → `if (!moved) break` 永不触发。
- 修法与原则：**只让"相关的点"动**（0~3 跳，英语一个单元簇 56~73 个点），无关点回到默认云位置；BFS 队列用下标游标而不是 `shift()`。
- 实测：点选 **631.75 ms → 4.65 ms**（CPU Profiler 里 `relayoutTargets` 595.5 → 1.22 ms）；三方独立测量互相印证。**已写成永久回归断言**（`_qa/eng_probe.js` 断言最坏 < 250 ms），改动这块前后都必须跑它。
- 副作用（**已知且接受**）：聚焦时无关点留在原位，与相关簇之间的连线会被拉长（视觉上是一条长扇面）。

### 3.2 `heavyShim`（重负载库的接口替身）

- 英语页走"实例化渲染"路径，那里没有真的 `THREE.Mesh`，而通用代码会调用 `scale.setScalar()`、`color.getHexString()`、`needsUpdate` 等。**缺接口 → 退出聚焦时在 setTimeout 回调里抛未捕获 TypeError → 后续复位整段被跳过**（实测 5 处异常 → 修后 0）。
- **隐藏实例要把 `scale` 写 0**（不是只把 alpha 写 0）：尺寸为 0 的四边形在光栅化阶段直接被丢弃；实测取消勾选 378 点的板块后"非零尺寸实例"从 3053 降到 2675。
  - 注意：**桌面版写回时带 `|| 1` 兜底，手机版目前没有**（小差异，必要时对齐）。

### 3.3 板块 id 一律**探测**，不要硬编码

- 历史坑：曾经硬编码 `'words'` / `'roots'` 作为"词点层/词根层"，而真实数据里根本没有这两个 id → 整段降载逻辑是死代码。
- 现在的规则：`detectLayerBoardId()`（优先 `layer:true`，否则"点数占比 > 40% 的板块"）、`detectRootBoardId()`（`/root|词根|词缀/i`）。
- **当前真实数据下 `LAYER_BOARD_ID` 仍为 null**（英语最大板块 `eng-bx3` 仅 15.1%）——这是**数据事实**，不是 bug。要真正启用"词点层默认收起"，得改数据（给板块打 `layer:true`），不是改代码。

---

## 4. 破卷（AI 出题）：每一条规则背后的原因

### 4.1 "来源"必须可验证，绝不靠年份自证

- 提示词要求模型对采用素材的题写 `sourceId="local-N"` / `"web-N"`；`verifySource()` 做**硬校验**：
  1. 解析 `sourceId` → 取对应检索片段文本（本地约 1000 字 / 联网约 1100 字）；
  2. 去掉空白后，**题干必须出现在片段原文里**；
  3. **每个选项必须按原顺序都能命中**（`next < 0` 即失败）。
- 命中 → 标 `本地原文匹配·…` / `联网原文匹配·…`；不命中 → **`来源待核实(未匹配到本次素材原文)`**；确实没给素材且模型声明原创 → `AI 生成`。
- **为什么**：这一栏以前是"模型说它是某年真题它就是"，等于把幻觉直接印在用户眼前。`_sourceKind` **永不采用模型自报的认证字段**。
- 反向禁止：**不允许"凭年份认证来源"**、**不允许凭记忆伪造真题**、**待人工校对内容不得作为命题依据** —— 这三句必须在系统提示词里。

### 4.2 "截断"是硬失败，不许自动重试，但要让它不发生

- 设计：`finish_reason === 'length'` → 立刻抛出、**不重试**，保留上一批题目。
  - **为什么**：截断意味着这轮回答残缺，重试＝再付一次费且很可能再截断。这条被 `tests/regression.cjs` 断言锁住（"truncated model output does not trigger repeated paid requests"），**不要**改成自动重试。
- 但"硬失败"必须罕见，所以提示词里有**长度预算（第 4b 条）**：整段 JSON 约 ≤5000 汉字、每题解析 ≤200 字、解答题压成 3~5 条要点。
  - **为什么**：实测踩过 —— `max_tokens=8000`、回包 `contentChars=11972`（≈8000 token 的中文容量），四道解答题写满分步解答**正好撞满上限**，整批作废。
- 失败文案必须**可执行**（改用单选题 / 降难度 / 缩小范围），并明说"上一批题目仍保留"。
- 宿主日志必须能看出原因：`DS:ok http=… contentChars=… finish=…`（**没有 `finish=` 时，只能靠 `contentChars` 反推，极难排查**）。

### 4.3 失败与并发

- 生成期间禁用"出题/题型/难度/素材偏好"四个控件，结束时统一恢复。
- **连接失败**与**截断** → 不重试；**格式错误** → 最多 3 次（把上一次的 `validateBatch` 结论作为 feedback 回灌）。
- 任何失败都**保留上一批题目与已展开的解析**（`runGen` 开头**不要**清 `qaArea`；只有 `validateBatch` 通过后才由 `renderQuestions` 整体替换）。
- `validateBatch` 是**严格**校验（恰好 4 题、`difficulty` 严格等于所选整数、选项标号 A/B/C/D 顺序、答案字母合法、解析非空、题干不重复）。**为什么**：宁可重试/失败，也不要渲染一批"看着像题、其实字段错乱"的东西。副作用要知悉：模型输出格式但凡不合规就会重试到失败（有上限）。

### 4.4 检索式怎么拼：**用户原话 > 知识点**

- 历史坑：`query` 由"目标点名 + 目标关键词 + 搜索框原话"拼成，于是**搜「2026」得到的是"2026 年的函数与单调性题"**——这正是用户明确不要的行为。
- 现在的三档（`parseSearchIntent`）：

| 用户输入 | 档位 | 行为 |
|---|---|---|
| 只有年份 + 意图词（`2026`、`2026年`、`2026高考题`、`2026年高考真题`） | **yearOnly（年份主导）** | 检索式**只含年份与意图词**，**绝不拼入当前知识点**；素材**不按知识点过滤**；年内按"像不像一份卷子"（`原卷/真题/全卷解析/解析/全国卷/新高考/上海卷/北京卷/…`）排序；界面明说"已按年份检索,本次忽略当前知识点"；`realN` 提到 4（用户显式选"AI 原创"则尊重） |
| 年份 + 其它实词（`2026 函数单调性`） | **yearScope（年份限定）** | 年份圈范围，实词在年内缩小；仍不拼当前知识点 |
| 无年份 | none | **输入优先（硬）**：检索式 = **用户输入原文**（不再前置当前知识点名/关键词）；**只有用户在破卷窗里"显式选择"了知识点**（`picked`/`sel`/`board`）时才让知识点做**偏向** —— 提示词里它被放进`【可选偏向，不是命题范围】`段落并写明"冲突时以用户输入为准"，其要点上限压到 600 字；输入为空时才回到"围绕该知识点出题"（此时它才是唯一依据，要点上限仍是 1600 字） |
- **年份判定**：四位且 1900–2099，两侧不能顶数字 → `第01讲`、`4题`、`12026` 都不算年份。页面为了兼容老内核**不用后行断言**，用捕获组等价实现。
- **"是不是只要年份"**：把年份、`年`、试卷类词、标点空白全部去掉后**不剩实词** → yearOnly（所以 `学年` 与 `题` 不算实词）。

### 4.5 素材的"年份"怎么算：**必须是它自己的年份**

- 语料 `###SRC:` 头是**文件路径**（例：`###SRC:zt/全卷解析/2026年上海卷(春)原卷.txt`）。
- 两级口径（**关键判断，别改回去**）：
  - `filtered` = 头部**提到**该年份的块（2026 → 3665 段）；
  - `strict` = **自身年份 == 目标年份**的块（2026 → **536** 段 / 18 份试卷）。
  - 差额 3129 段来自 `zt/版本2：数学（按省份分类）2008-2026/…/2017年高考数学试卷…` 这类**合集目录名**——它提 2026，但内容是 2017 的卷子。
- **素材只取 `strict`**：否则"搜 2026"会拿到 2017 的题（这正是用户验收标准里的反面）。`filtered` 只用于统计与文案。
- **档案年份区间**（实测 1952–2026）**要现算**，不要写死；为 0 段时如实说"本机档案里没有 XXXX 年的题(档案年份 a–b)"，**绝不**凭记忆编。
- 已知限制（未做）：**六科档案都已开放检索**（2026-09-29 起 `gkLib = true`，按科目用 `subj` 过滤，见 §10）；
  年份主导档一次最多取 10 段（沿用既有 loose 上限）；五科档案只到 **2025**（数学到 2026），且缺图
  （物理/化学装置图、生物遗传图解在抓取时无法从 PDF 还原，题干里"如图"仍在）——**不许补画**。

### 4.6 定位指令的跨窗同步

- 主窗 ↔ 破卷用一个 **localStorage 计数器** `qg_live_cmd_seq` 传递"定位到哪个知识点"。
- **必须只增不删**（不要从 `LS_CMD` 反推序号）。**为什么**：重开破卷窗后序号会回退，主窗把它当"陈旧指令"丢弃且**不清 key** → 表现为"界面说已选中、主窗毫无反应"。
- 陈旧分支要**清掉 key**，否则会一直重复丢弃。

### 4.7 窗口拖动

- 拖动增量用 **rAF 合并成每帧一条**（原来 60+ 条/秒把消息桥打满）。
- 位置的钳制范围是**整个虚拟桌面**（`SystemInformation.VirtualScreen`），不是单屏工作区——否则窗口永远拖不到第二块显示器。

---

## 5. 安装 / 卸载：安全语义（改这里之前先读三遍）

- **归属标记**：安装时写 `安装信息.txt`，里面 `CleanDirectory=1` 表示"装的时候这个目录是本程序新建的**空**目录"。
- **卸载闸门（唯一凭证）**：`HasOurMarker && MarkerSaysCleanDir`。**没有"无标记也放行"的兜底**。
  - **为什么**：那是**唯一一条会把用户整个文件夹递归删光**的路径。实测验证过：装进含用户文件的目录（标记为 `CleanDirectory=0`）→ 手工删掉标记 → 卸载 → **用户文件与子目录全部存活、哈希未变**，只删掉本程序自己的文件。
- **`CountEntries` 枚举失败（-1）不能当成"空"**（fail-open）：一个字都不删并如实说明。**为什么**：把权限问题当作"目录不存在"，是数据丢失的经典路径。
- **整体递归删除也要遵守保留清单**：删之前把 `数据库\qg_subjects.txt` 挪到 `%TEMP%`，删完放回（放不回要明确告知副本路径）。
- **卸载保留 `穷观学习.exe.WebView2\` 配置目录**：里面有**真实的笔记、自绘函数与本机设置**（还有 API Key）。卸载确认框的文案必须与行为一致（曾经相反：对话框说"会删缓存含 API Key"，代码也真删）。
- **单实例 Mutex**（`Local\穷观学习_安装`）：双击两次安装不再互相拆台。
- **黑名单里不要放"默认安装目录"本身**：曾把 `Shared.DefaultDir()` 放进 forbidden，导致默认路径卸载永远拿不到闸门 → 目录+卸载器永久残留，而提示是假的。
- **盘符相对路径必须拒**（`/DIR=E:`）：`Path.GetFullPath("E:")` 会解析成"E 盘的当前目录"（= 调用方 CWD），实测把 57 MB 载荷撒进工作目录。`/DIR=E:`、`/DIR=E:\`、`/DIR=E:rel`、`/DIR=C:` 全部 exit 2 且**零写入**。
- 构建脚本**禁止静默成功**：写操作全部显式校验（长度+SHA256）、`Write-Gzip` 从编译产物打包、`/SELFTEST` 核对内嵌资源清单、打印产物字节数与 SHA256。

---

## 6. 原创指纹（不许动）

Build ID **`QG-20260920-5e5d5a`**，位于：
`js/app.js`(头部注释 + `window.__QG_ORIGIN`)、`js/demo.js`(`-A`)、`js/train.js`(`-B`)、`js/glcanvas.js`(`GL.origin` `-C`)、`js/mainbridge.js`(`__qgBridge.origin` `-D`)、5 个 `js/data*.js` 头部、`index.html`/`train.html`/`guanlan.html` 注释、`桌面版\build\_指纹.txt`（并作为 `web.qg.fingerprint.txt` 内嵌进 exe 与安装程序）、手机版 `指纹.txt` 及 4 份 JS 拷贝。
另有作者署名 `© 2026 PHILlA093 · 原创作品 · 保留所有权利`（开屏页必须**实际绘制可见**，`_qa/desk_fp_probe.js` 会验"真的画在屏幕上"）。

---

## 7. 验证体系（改完必跑）

**桌面/网页探针**（目录 `桌面版\build\_qa\`，协议：`node server.js <根目录> <端口>` 起静态服务器，再 `node <探针>.js <端口> [profile/截图目录]`）：

| 探针 | 覆盖 | 当前基线 |
|---|---|---|
| `qa.js` | 主回归（加载/检索/自定义点/出题失败处理/公式必须被排版/无异常） | **46/46** |
| `clab_probe.js` | 化学实验台 44 条判据（50 行表 + 画到最后一笔 + 5930 组组合扫描 + 真点击 + 零污染 + 两个负对照） | **44/44** |
| `clab_pix_probe.js` | 化学实验台**像素级**回归：沉淀/液体的裁剪与贴弧 —— 出界像素（内腔外 1~8px 带）、9 列"沉淀最低 y"与理论圆底弧的 gapMax + 最深列位置、下半弧轮廓可见率；**25 个反应逐条配判据**（不适用的显式列 `NOT_APPLICABLE` 并写原因），带 **`--negctl` 一键负对照**（故意红 4 条 + 验证局部性与字节还原） | **98/98**（+25 SKIP；换成**修前树**跑 = 51/98、47 条红、覆盖 19 个反应） |
| `tpl_probe.js` | 观澜模板库 + 场景校验 | **45/45**（⚠️ 必须指向 `guanlan.html`，指向 `index.html` 会 boot timeout） |
| `eng_probe.js` | 英语重负载库（3053 点/10 板块/点选成本 < 250ms） | **20/20** |
| `desk_fp_probe.js` | 开屏版权实际绘制 + 运行期指纹 | **3/3** |
| `mobile_fp_probe.js` | 手机版 390×844 开屏/首页/指纹/0 异常 | **6/6** |
| 物理沙盒探针（在 `%TEMP%`，未归档进项目） | 观澜物理模式：组合规则 6 条 + 物理真在跑 + 排版就绪 + 预设 + unmount 清理 + **数学科目零污染** | **28/28** |

**项目自带测试**：`node --test tests/regression.cjs`（纯逻辑，把函数原样抽出配假依赖跑，**不联网、不读用户 Key**）；`tests/guanlan-window.cjs`（观澜窗口行为）；`tests/InstallerRegression.cs`（**只在自建临时夹具**里验证卸载保留语义，不碰注册表/不做真实卸载）；`tests/preview-server.py`（只绑回环、永不调真实 API）。

**三条"假红"教训**（看到红先怀疑探针，别急着改产品）：
1. `eng_probe` 曾长期断言"节点 1978 / 6 板块"，数据长大到 3053/10 后必然失败；
2. `qa.js` 的自定义点断言只读旧整表键，存储改版成逐点键后必然失败（**判据应以"数据确实写进去了"为准**）；
3. `tpl_probe` 在观澜搬进独立窗口后仍加载 `index.html`，必然 boot timeout。

**每次改完至少跑**：`node --check` 所有改动的 JS + `node --test tests/regression.cjs` + 上面四个桌面探针（+ 手机版探针，如果改了手机版）。

---

## 8. 发布流程（一条龙，别跳步）

```
源码(js/css/html/数据)
  → 桌面 exe            powershell -File 桌面版\build\_rebuild.ps1
  → 验证              内嵌资源与源码逐字节一致(**资源总数 21**：20 项映射 + 生成图标/指纹/psandbox) + 指纹 + 启动烟测
  → 安装程序            powershell -File 桌面版\build\_build_installer.ps1   （载荷必须逐字节等于新 exe）
  → 下载 zip           Compress-Archive 安装程序 + 下载\先读我_怎么安装.txt
  → 手机 APK           node 穷观手机版_apk\_scripts\sync-www.js
                       npx --no-install cap sync android
                       android\gradlew.bat assembleDebug --no-daemon      （versionCode 必须递增！）
                       ⚠ `sync-www.js` 的排除规则必须同时作用于**目录**：它原来只对文件用
                       `isTempFile()`（下划线/点开头、`.bak-*`），目录只认硬编码的 `EXCLUDE_DIRS`，
                       于是 `_backup_mathjax_autoload_<时间戳>\` 这种工作目录被**整目录**同步进
                       `www/`（文件数 32→36），差点把修前的旧文件打进 APK 盖住新版。已修：
                       目录也过 `isTempFile()`。**跑完务必核对输出是不是"32 个文件"**。
  → 验证 APK           aapt2 dump badging(versionCode/label) + assets 与源码逐字节 + 语料/指纹 + Key 扫描
  → 推仓库             main（桌面侧源码/exe/zip/tests）与 mobile-apk（手机版源码/APK）分开提交
  → 桌面               桌面版 zip 与 安卓 APK 换新（旧的**归档不删**到 穷观_归档\旧备份与旧版本\）
```

- **新增网页资源必须同时改两处**：`_rebuild.ps1` 里加 `/resource:` 参数**并加进 `$args`**，否则不会进 exe。
  **宿主不用改** —— 它按请求路径通用推导资源名（`asm.GetManifestResourceStream(resName)`，`/js/x.js` → `web.js.x.js`）。
  `_rebuild.ps1` **必须保持纯 ASCII**（非 ASCII 字节会被按 ANSI 解码并吞掉后面的行，历史上真丢过 `/win32icon:`）。
- **语料更新不需要重编 exe**（它运行时从磁盘读），**但必须重打安装程序与 zip**（语料是安装程序的第 6 个载荷
  `qg.payload.5.gz`），并同步到 `穷观手机版\数据库\qg_corpus.txt` 之后重打 APK。
- **版本号**：APK 的 `versionCode` 必须递增（安卓只在 versionCode 变大时才覆盖安装）；`versionName` 跟着写。桌面版当前对外版本号是 **V2.4.2**（改它要同步 exe 标题、`使用说明.txt`、安装程序与 zip 命名 —— 改动面较大，先问用户）。
- **签名**：手机版用**默认 debug 签名**（`C:\Users\Administrator\.android\debug.keystore`，2618 B）。**这个文件丢了就无法覆盖安装**，绝对不要删/动。
- **桌面版签名（2026-09-29 起）**：exe 与安装程序用**本机自签名证书**签（`CN=穷观学习 PHILlA093`，指纹 `FDA869EC0B69FB20DAD49B3B71754D43F6806986`，
  有效期至 2031-09-29；`.cer` 存在 `E:\workspace\穷观资料库\证书\`）。**顺序必须是：先签 exe → 再打安装程序（这样载荷才是已签名的那份）→ 再签安装程序 → 最后压 zip**。
  漏了顺序就会出现"装完还是被 SmartScreen 拦"（安装程序里裹着未签名的 exe）。**每台新机器要先用那个 `.cer` 装进"受信任的根"**（当前用户即可），
  否则签名状态是 `UnknownError`（链断），SmartScreen 该拦还拦。查状态：`Get-AuthenticodeSignature <文件>` 应为 `Valid`。
- **发布前必过 Key 闸门**：对"将要提交的全部文本文件 + 全部二进制产物（exe/安装程序/zip/APK）"扫 `sk-[A-Za-z0-9_\-]{16,}`，命中必须为 **0**。历史 blob（曾经提交过的日志）也要抽查。
- **隐私**：`穷观学习.exe.WebView2\` 与 `数据库\qg_subjects.txt` 属于本机数据；前者**永不进仓库**（`.gitignore` 有 `*.exe.WebView2/`），后者**用户已明确同意公开**（那两份文件保持现状即可）。

---

## 9. 这台机器上的坑（照抄能省几小时）

1. **PowerShell 是 5.1**（Desktop 版）。`.ps1`/`.bat` 必须是**纯 ASCII**（中文会被按 GBK 误读）。
2. **每条 `pwsh` 调用都是新进程**，而且本机存在**大小写重复的代理变量**（`http_proxy`/`HTTP_PROXY`、`https_proxy`/`HTTPS_PROXY`、`no_proxy`/`NO_PROXY`）→ `Start-Process` 会直接报
   「已添加项。字典中的关键字…」。**凡是用 `Start-Process` 的命令，开头先清一遍**：
   ```powershell
   foreach ($pair in @(@('http_proxy','HTTP_PROXY'), @('https_proxy','HTTPS_PROXY'), @('no_proxy','NO_PROXY'), @('all_proxy','ALL_PROXY'))) {
     $val = [System.Environment]::GetEnvironmentVariable($pair[1]); if (-not $val) { $val = [System.Environment]::GetEnvironmentVariable($pair[0]) }
     [System.Environment]::SetEnvironmentVariable($pair[0], $null); [System.Environment]::SetEnvironmentVariable($pair[1], $null)
     if ($val) { [System.Environment]::SetEnvironmentVariable($pair[1], $val) }
   }
   ```
3. **不要用短函数名**：`H` 会撞 `h`=`Get-History`、`MD` 会撞 `md`=`mkdir`（本人各踩一次，各刷出一屏错误）。给辅助函数起 `Get-XxxHash` 这类明确名字，或直接用 `Get-FileHash`。
4. **中文路径不能直接喂给原生命令的参数**：`csc /out:中文路径` 会乱码 → 一律先编到 `%TEMP%` 的 ASCII 路径再复制回来。
5. `Set-Content -Encoding UTF8` 在 5.1 会**加 BOM**；要无 BOM 用 `[System.IO.File]::WriteAllText(path, text, (New-Object System.Text.UTF8Encoding($false)))`。
6. **APK/DLL 里的中文条目名没有 UTF-8 标志**：用 .NET 按名字匹配会读到乱码 → 按**原始大小**认领（`qg_corpus.txt` 49,945,760 B / `qg_subjects.txt` 2,306,529 B / `指纹.txt` 976 B）。
7. **`aapt` 在中文路径下会失败**（`Illegal byte sequence`）→ 用 `aapt2`。它要 `JAVA_HOME`，命令里临时设 `$env:JAVA_HOME='E:\android\jdk17'`。
8. Android 工具链路径：JDK `E:\android\jdk17`、SDK `E:\android\sdk`、Gradle home `E:\android\gradle-home`；**这些环境变量在本会话里默认是空的**，每条打包命令都要自己设。
9. **headless 浏览器探针**用项目自带的 `_qa/*.js`（原生 CDP，不需要 puppeteer）。它们会往 `%TEMP%` 写 profile 与截图；端口请错开（各探针内部端口是 9800+随机，外部端口由你传）。
10. **别对正在被别的 agent 改的文件动手**；也别删别人的 `_backup_*` / `_cc_*` / 探针临时目录。
11. **MathJax 的 `autoload` 必须显式关掉**（三个页面的 `window.MathJax.tex` 里都有 `autoload: false`）。默认开启时，正文里出现**任何未内置的宏**（`\boldsymbol`、`\cancel`、`\bbox`、`\unicode`、`\textcolor` …）都会让 MathJax **懒加载** `input/tex/extensions/<名字>.js`；而本应用只内嵌了单个 `vendor/mathjax-tex-svg.js`，那个请求必然 **404** → `typesetPromise` **整体 reject** → 而调用处的 `.catch(function(){})` 会把它**静默吞掉** → 结果是**整张卡片的公式全部保持 `$...$` 不排版**（实测事故：2026 真题里的 `\boldsymbol{a}`，日志留下 `404:web.vendor.input.tex.extensions.boldsymbol.js`）。
    现在的兜底有三层：关 `autoload` + 给 8 个常见扩展宏做等价替身（`\boldsymbol`/`\bm` → `\mathbf` 等）+ 提示词禁用这些宏。**改动 MathJax 配置或渲染调用处后，必须跑断言：页面里渲染过的公式要出现 `mjx-container`、且文本里不再含 `$`**（`_qa/qa.js` 里有这条）。同类"静默失败"的排查思路：**先看 `%LOCALAPPDATA%\穷观学习\knet_run.log` 有没有 `404:` / `ERROR` 行，再看被 `.catch` 吞掉的 Promise**。
    **两个实测出来的细节（别再踩）**：① 断言要写在 **`MathJax.config.tex.autoload`** —— 本构建（MathJax 3.2.2 的 `tex-svg` 单文件版）里**没有** `window.MathJax.tex` 这一层（`MathJax.startup.input[0].options.autoload` 读数也不可靠，实测 `undefined`）；② **`autoload: true` 不是"恢复旧行为"** —— MathJax 期望它是一个**映射对象**，写 `true` 时 `Object.keys(true) === []`，等于**也把 autoload 关掉了**，做负对照实验时会因此复现不出 bug。
12. **`Start-Process` 传含中文的参数会乱码**（把 UTF-8 当 GBK：`桌面版` → `妗岄潰鐗`）。起本地服务器/跑探针时用**后台作业通道**或 `node -e` / `cmd /c`，并让脚本自己 `cd`（`node 桌面版\build\_qa\server.js <绝对根目录> <端口>` 的 workdir 必须是项目根）。
13. **`web_fetch` 读不了 PDF**（返回 `unsupported content type "application/pdf"`）。要核对教材/课标/论文里的原文时：用 `Invoke-WebRequest`（本机代理 `http://127.0.0.1:7897`）把 PDF/DOCX 下到 `%TEMP%`，再用现成的抽取工具转文本 —— `%TEMP%\qg_gk2025\tools\` 里就有 `get-doc.ps1`（一键下载+自动抽取）、`docx2txt.ps1`、`pdf2txt.py` 可复用。**只拿到搜索摘录时，必须在回报里写明"这是摘录不是全文"**（实验台各组就是这么做的）。

---

## 10. 当前状态与已知未解（截至 2026-09-29 上午）

**已发布（GitHub）**：
- **最新（2026-09-29 晚）`main` = `0e25613`**：新增**物理实验台**（§13，20 个实验）+ 修掉 4 处"裸函数名"致命缺陷
  （左栏 `open()` 解析到 `window.open`、工具条三颗按钮的裸 `sync()`）+ 修掉 `mech.js` 的**变量遮蔽**（两个实验装置图只画一半）
  + 核心加固（`drawErrorCount()` / `shadowAudit()` / 被吞异常可见化 / warn 节流）。
  **桌面三件产物**：`穷观学习.exe` **7,948,288 B** / `08217C68A6225E67A1542C2E…`；安装程序 **13,944,832 B** / `D7628AB741A9197E…`；
  下载 zip **13,228,661 B** / `8F4BD67932A625C0…`。已复核：**内嵌资源 28/28 与源码逐字节一致**（含 7 个新资源）、
  安装程序 6 载荷逐字节、zip 三层一致、Key 闸门 0 命中、桌面 zip 与快捷方式指向的 exe 都已换新。
  ⚠ 启动烟测的**日志四行这次没验上**（本会话里 app 的 `Shared.Log()` 静默失败：`knet_run.log` 不涨；已排查为环境问题非回归），
  替代证据：新 exe 能起、3D 词云完整渲染、`穷观学习.exe.WebView2\EBWebView` 正常写入、关闭后进程归零。
  ⚠ 本会话 **`Start-Process` 被策略拒**（ERROR_CANCELLED），导致 `_build_installer.ps1` 最后一步跑不了 `/SELFTEST` → **脚本 exit 1 但产物完整**；
  已按脚本原逻辑手工复现 selftest（exit 0、10 资源、逐字节载荷比对）。
- `main` = **5a4ae58**（2026-09-29 上午，历史）：在 9a8b024 的基础上又进了三块 —— **物理观澜沙盒**（§12）、**六科真题档案 + 按科目过滤**、**语料新增 2025 五科真题 419 块**；连同重建的 exe 与 zip。此前的主线修复（宿主 8 处 + 前端 5 处 + 安装程序 7 处、年份检索三档、破卷长度预算与截断可执行化、公式不排版修复、`qa.js` 的公式闸门）都在。
- `mobile-apk` = **b66e7c7**：按科目过滤真题档案 + 语料新增 2025 五科；APK **v1.5 / versionCode 6**（20,029,651 B / `D8B3725A…`，与 v1.4 同一 debug 签名可覆盖安装）。手机版**没有**物理沙盒、**也没有**物理实验台（本轮不做手机版）。
- **化学实验台（§14）已发布（2026-09-29 深夜）`main` = `5fc953b`**：`js/clab.js` + 六个组文件共 **50 个反应**；
  `demo.js`（入口 `#glClBtn` + 三方互斥）、`guanlan.html`（7 个脚本）、`_rebuild.ps1`（资源 **28 → 35**）都已接好。
  **桌面三件产物**：`穷观学习.exe` **8,944,640 B** / `D78D1CF0CA50E952C01172D54BF213B4…`；
  安装程序 **14,235,648 B** / `40341CF25220CB83…`；下载 zip **13,519,722 B** / `99D721B476C3E3E9…`。
  已复核：**内嵌资源 35/35 与源码逐字节一致**（抽查 17/17，含化学 7 个与 `PINK` 修复）、安装程序载荷逐字节、
  zip 三层一致、Key 闸门 0 命中、桌面 zip 与快捷方式指向的 exe 都已换新。
  **独立验收 + 常驻闸门**：`_qa/clab_probe.js` **44/44**（50 行表 + "画到最后一笔" + **5930 组参数组合 0 崩溃** + 真点击 + 零污染 + 两个负对照）；
  回归 `node --test` 39/39、`tpl_probe` 45/45、`qa.js` 46/46、`eng_probe` 20/20、`desk_fp_probe` 3/3。
  本次抓到并修掉的真缺陷：`precipitate-convert` 的 `isFinite(null)` 必炸、`weak-electrolyte` 的跨文件常量 `PINK`、
  `balance()` 不认 `NH3·H2O` 与多段式、常数序列的假绿 r²；顺带修掉贪婪箭头正则、减电子写法、`qgNum(null,默认值)→0`、`react()` 冒异常。
- **历史产物（已被 0e25613 取代，留档备查）**：`穷观学习.exe` 7,452,160 B / `44784466…`（更早一版 7,276,544 / `FEE2FCAB…`，
  2026-09-27 06:31–06:33）；安装程序 13,790,208 / `3CC4ECAB…`；zip 13,073,873 / `59682F08…`。
  ⚠ 要复原更早的版本：从**那一版的安装程序**里解 `qg.payload.0.gz`；旧二进制归档在 `穷观_归档\旧备份与旧版本\`（**不删**）。

**本次发布的内容（2026-09-29，已完成并验收）**：
1. **六科真题档案 + 按科目过滤**：`js/train.js` `gkLib = true`（原 `= subject === 'math'`，把档案里本来就有的语英物化生真题锁在门外）、`subjFilterOf`、`gkMats` 带 `subj`；宿主 `HandleMats` 读 `subj`（五科要求路径含 `五科真题/<科目>/`，数学排除五科）、回执新增 `subj{name,blocks,from,to}`、MATS 日志带 `subj=`；手机版 `corpus.js`（`filterBySubject`/`subjectPool`/`yearSpan`，`VERSION='phone-3'`）与 `train.js` 同语义。
   实测口径：五科真题 **3,991 块**（语文 947 / 英语 1,994 / 物理 230 / 化学 393 / 生物 427）+ 2025 新增 **419 块**；数学（`subj` 为空）**15,637 块**（`gkMats` 带 `src:'zt'` 时只覆盖 `zt/`，`jyfs`/`yl`/`gs` 本来就不在检索范围内）。**手机版 71/71** + A/B 等价 + 负对照（旧版在全池上跑会五科共 50 条串科）；桌面 `node --test` **39/39**。
2. **语料新增 2025 五科真题 419 块**：`qg_corpus.txt` 49,945,760 B → **50,424,693 B**，`###SRC:` 37,249 → **37,668**；**旧文件是新文件的前缀**（既有内容一字节未动，逐科目老数据块数对账全等）。抓取来源与未采用原因见 `%TEMP%\qg_gk2025\来源清单.md`（**没有伪造**：找不到的答案/图一律留空）。已知缺：物理只 3 份卷、生物 2 份、语文全国一卷残缺（官方只公布选摘）、所有图丢失、某份源 PDF 疑为 OCR、语文某题两个来源答案冲突未裁决。
3. **物理观澜沙盒**（见 §12）：新增 `js/psandbox.js`，`demo.js`/`guanlan.html` 已改，**只在物理科目出现**。
4. 手机版 **versionCode 6 / versionName 1.5**；桌面对外版本号仍是 **V2.4.2**（未改）。

**验证体系当前基线**：`qa.js` **46/46**、`tpl_probe` 45/45、`eng_probe` 20/20、`desk_fp_probe` 3/3、`mobile_fp_probe` 6/6、物理沙盒探针 **28/28**；`node --test tests\regression.cjs tests\guanlan-window.cjs` **39/39**。

**年份检索三档（两侧均已实现并实测）**：
- 桌面侧：`js/train.js`（`parseSearchIntent`/`pickRealN`/`yearTopic`/`yearIntentNote`/`gateRun`/素材来源卡片）+ 宿主 `Program.cs`（`QueryYearOnly`/`HasExamIntent`/`ArchiveYearRange`、**只取自身年份==目标年份的真原卷**、试卷优先排序、`MATS:` 日志新字段）。实测：`2026` → 候选 3665 段中**真原卷 536 段 / 18 份试卷**；`2050` → 0 段并如实报"档案年份 1952-2026"；`第01讲`/`4题` 不误判年份；`node --test` **34/34**。
- 手机侧：`js/corpus.js`（`parseYearIntent`/`yearSets`/`paperRank`/`expandCjkTerms`/`archiveYearRange`/`mats()` 补 `year`）+ `js/train.js`（`yearAskMode`/`buildQuery`/`resolveRealN`/`yearStatusText`/`gateRun`/`srcNames`）。离线断言 **177/177**、页面探针 **6/6**、破卷页真机探针 **30/30**（页面内真读 50 MB 语料）；并顺手修了 3 个真 bug：`mats()` 没透传年份回执会把"有素材"说成"没年份"、年份区间对象把 37k 块池引用塞进回执、`2026 函数单调性` 因年份词满足宽松门槛导致**完全不缩小**。
- 桌面版对外版本号仍是 **V2.4.2**（未改；改它要同步标题/说明/安装程序/zip 命名，需先问用户）。

**公式修复另有 A/B 实证**：构造"修前树"复现出 `404 / typesetPromise rejected / mjx-container=0 / 文本仍是 $...$`，修后同段内容 `404=0 / resolved / mjx-container=5 / 文本 a+x`，并证明新闸门在 bug 状态下**必然变红**。（上面"验证体系当前基线"那一行是最新的：`node --test` 已是 **39/39**，不再是 34/34。）

**已知未解/打折**：
- **替身宏是语义降级**：`\cancel` → 内容保留但**没有删除线**、`\boldsymbol`/`\bm` → 粗体（非粗斜体）、`\textcolor`/`\enclose` → 丢颜色/框；**`\bbox[5px]{z}` 的 `[5px]` 会以字面量漏出**（`['#1',1]` 只吃一个参数）。只影响这两个罕见宏，但若模型真用了会有瑕疵。
- **年份主导模式下模型可能不照抄原题**：实测用户搜「2026」时，素材（真原卷 536 段 / 18 份卷）确实被检出并送进了提示词，但模型自己写了 2026 风格的新题，于是四题都标「来源待核实」。按现行规则这**不算错**（只在"采用素材"的题上要求逐字一致），但不符合"搜 2026 就给我 2026 的题"。**候选改法（未做，需先问用户）**：在年份主导档的提示词里明确"必须优先原样采用素材原题，不得以'自己出得更规范'为由改写"。
- **语料缺图**：物理/化学的装置图、生物遗传图解在抓取时无法从 PDF 还原，题干里"如图"仍在 —— **不许补画，也不许凭想象描述图**；
- 语文那 962 块**在应用里检索不到**：应用只有数学/物理/化学/英语/生物五个科目（`SUBJ:loaded 5`），没有"语文"这一科，
  按科目过滤后语文档案不会被任何科目命中。要用它得先加一门语文（含一套语文知识云，是另一件大工程，**需先问用户**）；
- 年份主导档一次最多取 10 段（"整卷"其实更适合"少而长"的片段，需要给宿主传 `realN`）；
- 手机版 `paperFirst` 是自造 payload 字段（同时发 `yearOnly`），若桌面未来改字段名需再对齐；手机版 heavyShim 写回尺寸时**没有**桌面的 `|| 1` 兜底；
- `hit.src` 可能带尾部 `\r`（既有）；新"素材来源"显示处已清，宿主字段未动；
- 英语库在真实数据下**不会**触发"词点层默认收起"（没有板块 >40%，也没有 `layer:true`）；
- `index.html` 的 CSP 仍含 `'unsafe-inline'`（为不破坏既有 QA 未收紧）；
- 桌面 `使用说明.txt` / `README.md` / `DESIGN.md` 里可能仍有与最新数据不符的旧数字（改前请核对实测值）。

---

## 11. 给 agent 的协作约定

1. **先备份再改**：沿用仓库既有惯例 `_backup_<主题>_<时间戳>\`（把将要覆盖的文件按原路径拷进去），并在 `修复说明_<日期>.md` 里写清改了什么、为什么、验证了什么。
2. **测试先行/同步**：改逻辑就补 `tests/regression.cjs` 的断言（那套是**纯离线**的：把函数原样抽出配假依赖），改界面就补/跑 `_qa/*.js` 探针。
3. **上报要带实证**：命令、退出码、关键数字（哈希/字节数/命中数/测试通过数）、以及与基线的对比；**没验证的就说没验证**。
4. **不越界**：只改被授权的文件；不构建、不提交、不动用户数据与指纹，除非任务明确要求。
5. **口径冲突时以"用户的原话"为准**（例如"搜 2026 就要 2026 的题"优先于任何"看起来更聪明"的排序策略）。

---

## 12. 物理观澜沙盒（`js/psandbox.js` + `demo.js` 的物理模式）

**它是什么**：从 `E:\workspace\physics-sandbox\index.html`（用户自己的单文件玩具，116 KB，**只读，不要改**）移植进来的
"物理符号沙盒"：15 个可拖拽字形 `m M g a v r ½ μ c G t B E q I`，拖到一起**按物理规律组合成有行为的实体** ——
`g+t→v`（v=gt）、`v+t→木板`（s=vt）、`q+t→I`、`m v²/r` 两个成**双星**（m₁r₁=m₂r₂、ω∝√(m总/间距)）、
`GMm/r²` **引力井**、`2GM/c²` **黑洞**（含终局演出）、`mc²` **爆炸碎裂**；另有磁场 `B`、电场 `E`（F=qE，方向可转）、
电荷/电流、高速撞击碎裂、垃圾桶、右键复制、双击拆分、旋转手柄。

**只在物理科目出现（硬约束，别破坏）**：入口按钮的创建整段关在 `demo.js` 的 `initPhysicsSandbox()` 开头
`if (!isPhysicsSubject()) return;` 里；连 `#psCSS` 都要等真正用到才注入。非物理科目下**不得出现任何 `ps-` 前缀 DOM**。
科目读取用既有写法（不发明新键）：`window.CUR_SUBJECT` → `localStorage('qg_subject')` → 主窗心跳
`localStorage('qg_live_state').subject`；读不到 = 非物理。

**接口**（`window.QG_PSANDBOX`）：`mount(containerEl, opts)` / `unmount()` / `isMounted()` / `applyPreset(key)` /
`addBody(chars)` / `bodies()` / `clear()` / `stepOnce(dt)` / `state()` / `collect()` / `pause()` / `resume()` /
`letters()` / `distance()`。**加载它本身不建 DOM、不起循环**（原作是页面加载即启动，模块化时必须保持"惰性"）。
五个预设：`newton2` / `energy` / `circular` / `gravity` / `freefall`；未知键静默返回 `null` 且**不动场上已有实体**。

**移植时改掉的 5 个真问题（都在代码注释里，别改回去）**：
① `gravModeOf` 只认 base → "先摆 G 再拖 M m r"永远凑不出引力井；② `canMerge` 的 G 分支只看 `mem` → 装配顺序敏感；
③ `r` 装入上限 3 → 把 `½mv²/r` 挡在门外（放宽到 4）；④ `tokenSeq` 会把同一个字母数两遍（`mv` 排成 `mmv`）→ 按对象身份去重；
⑤ **原作给 `½` 另造隐藏结构字形**，导致真 `½` 被判"不在字形表里"而 `display:none`，画面上只剩一个孤零零的 `2`
（`½mv²` 把 ½ 画丢了）→ 槽位直接指向玩家那个 ½ 字形。另：屏幕震动只抖实验台（原作抖 `document.body`，在观澜里会把聊天区一起抖）。

**验证**：沙盒探针 **28/28** —— 组合规则 6 条、物理真在跑（自由落体 y 100→122.36；引力井距 240.05→182.11 / 40 帧）、
排版就绪（`hw=76.76/hh=31.25` + DOM 里有对应字形）、五个预设、工具条与 `unmount()` 清理、**数学科目零污染**
（无按钮、无 CSS、既有 8 个控件全在、既有「🎬 动态演示」流程 `objects:10`、0 异常）。纯 ES5（扫描确认：0 箭头函数 /
0 `let`/`const` / 0 模板串 / 0 `eval`），零外部依赖，样式全在 `#psCSS` 且选择器带 `ps-` 前缀（**没碰 `css/style.css`**）。

**已知未做**：≤768px 移动端布局只做了代码走查（未实测）；**手机版尚未移植**（手机版观澜是整屏面板、结构不同，
`tests/guanlan-window.cjs` 的断言也不适用，别照搬桌面版）；黑洞终局演出整套搬了但没跑完整终局探针。

---

## 13. 物理实验台（`js/pslab.js` + `js/pslab/*.js`，物理观澜的第二块）

**它是什么**：高中物理**全部学生实验**的可交互实验台 —— 调参数 → 看现象 → 记录数据 → 作图 → 得结论。
与沙盒（§12）并列：沙盒是"玩符号"，实验台是"做实验"。**接口契约与实验清单在 `docs/物理实验台设计.md`（写新实验前先读它，尤其 §4 与 §9）。**

**文件**：核心 `js/pslab.js`（注册表 + 三栏 UI + 数据表 + 图像 + 结论卡 + 测试接口）+ 六个组文件
`js/pslab/{mech,elec,mag,opt,therm,mod}.js`（每组只做一件事：`window.QG_PSLAB.register(id, spec)`，**不自建 DOM、不起循环** —— 惰性）。
**20 个实验**：力学 8（`linear-motion` `newton-second` `force-composition` `hooke-law` `projectile` `mech-energy` `momentum` `simple-pendulum`）、
电学 4（`resistivity` `multimeter` `emf-internal` `va-characteristic`）、磁场与电磁感应 3（`lenz-law` `ampere-force` `transformer`）、
光学 2（`refraction` `double-slit`）、热学 2（`oil-film` `isothermal`）、近代 1（`photoelectric`）。

**只在物理科目出现**（与沙盒同一套判据）：入口 `#glPlBtn` 的创建整段关在 `demo.js` 的 `if (!isPhysicsSubject()) return;` 里；
`#plCSS` 在 unmount/close 时**会被移除**（沙盒保留 `#psCSS`，两者不同，别"统一"）；两个模式互斥（开一个自动关另一个）。

**四条实现约定（核心落地后追认，细节见设计文档 §9）**：
① `null` = "这次测量在该图上没有有效值"，**不是 0**（核心跳过该行、不进 fit；真实的 0 照常进图）；
② `g.font` 宽容签名（`(size)` / `(size,bool)` / `(size,'italic bold')` / `(size,italic,bold)` 都行，内部用哨兵回读校验合法性）；
③ 滑块 `step` 会归一化并在 `register` 时做参数体检，warning 进 `state().warnings`，`QG_PSLAB.audit()` 可一次看全；
④ 没有 min/max 的参数必须写成 `type:'select'`（`mod.js` 的波长/阴极材料）。
**两条探针判据事实**：**r² 必须在"扫自变量"时才有意义**（固定参数下核心返回 `fit:null` 或退化成相关系数平方）；
**`measure()` 有两种合理语义**（独立测量 / 推进数据系列），比较"改参数前后"时**每个状态各采 24 次**（6 与 8 的公倍数）再比均值。

**⚠ 这个模块踩过的最贵的坑（写任何 UI 回调前先看这条）**：核心左栏的点击处理曾写成
`function onPick(id){ return function(){ open(id); … }; }` —— 作用域里**没有**局部 `open`，于是解析到**全局 `window.open`**，
点一个实验变成去开新窗口（桌面 WebView2 会拦原生窗口）→ **学生点了毫无反应**，而所有 API 探针都是绿的（因为 API 路径调的是 `API.open`）。
**教训**：① UI 回调里的裸函数名要当心 `open`/`close`/`focus`/`print`/`stop` 这类**浏览器 window 上真实存在**的名字，一律写 `API.xxx(...)`；
② **验收必须用真点击/真交互，不能只走 API** —— 这个 bug 只有 `.click()` 能发现（顺带用 `window.open` 间谍断言零调用）。
**同类一共 4 处**（`open` ×1 + 工具条 `📏测量一次/↺重置/清空数据` 里的裸 `sync()` ×3 —— 后者的死法是抛 `ReferenceError`，症状一样是"点了没反应"）。
现在有一条**常驻闸门**：`%TEMP%\qg_plab\barecall_audit.js`（tokenizer 扫描全文件"前面不是 `.`"的调用，逐个查该名字有没有声明；
当前 425 处裸调用 / 81 个名字 / **0 未解析 / 0 window 陷阱**）。**写类似扫描器时注意**：作者第一版**先剥 `/*…*/` 再剥字符串**，
而源码注释里有一句 `各组的 js/pslab/*.js 会把实验注册进来` —— 那个 `/*` 让扫描器把后面 60 行全吞了，**它因此漏报了 `onPick` 那一行**。
**粗糙的正则剥离会给出假绿**：必须先剥字符串、再用带状态的词法扫描处理注释。

**⚠ 第二类盲区：被"空 catch"吞掉的绘制异常（比上面那个更隐蔽，务必读完这一节）**
`mech.js` 的 `hooke-law` / `simple-pendulum` 曾因**局部变量遮蔽画线原语**而 `draw()` 每帧抛 `TypeError`，
却被组方 `safeDraw` 的**空 catch** 吃在 body 内部 —— 结果：console 干净、`state.lastError` 空、**所有探针全绿**，
但画面上只画了一半（单摆的摆线/摆球/悬点/摆角弧全没画）。**这类问题只能靠下面这套判据抓。**

**抓不到的（都实测过，别再指望它们）**：
① `Runtime.exceptionThrown` / `window.onerror` / console error 计数 —— 异常在 `catch` 里被吞，浏览器根本不报；
② 核心的 `lastError` —— 它只接住"逃出 body"的异常；
③ **"画布像素签名会变"** —— 破坏方式是中途夭折，而画面每帧都在变（读数/动画），坏版本下照样变；
④ "非空白像素 > 0" —— 画到一半也有几万像素；
⑤ 静态**裸调用**扫描器 —— 抓不到**变量遮蔽**（`L(...)` 里 `L` 是解析得到的局部变量）；
⑥ 只跑 API 的探针 —— 抓不到只发生在 UI/绘制路径的问题。
**能抓住的**：
① `Debugger.setPauseOnExceptions({state:'all'})` + 逐帧读 `Debugger.paused` 的栈 —— 唯一能在"被吞"情况下拿到确切 file:line 的手段
（⚠ `callFrames[i].url` 可能为空，判据要用 `params.data.description` 的栈文本或 scriptId→url 映射，否则**假绿** —— 第一版就全判成了 clean）；
② **"画到最后一笔"指令级对照**：拦 `CanvasRenderingContext2D.prototype` 上所有函数型属性记指令序列（按 `this.canvas.id` 过滤），
再用记录型假 ctx（Proxy 兜底未知方法，**含 `createRadialGradient`**）按同一 `params`/`state` 独立重放 `spec.draw`，
比较**指令条数**与**末 3 条签名**：正常帧只差核心自己的 3 条前导，夭折帧断崖下降（实测 **68 vs 1825**）。**必须带负对照**（注入一次中途抛错，判据不变红就是盲的）；
③ 失败通道 + 每帧哨兵（`safeDraw(id, body)` 写 `state.lastError`、每帧末尾画 1×1 哨兵）；
注意**哨兵只证明包装器跑完、不证明 body 跑完**，且 1×1 在缩放/抗锯齿下不能精确比色，要判"颜色方向一致（cos>0.985）+ 明显偏离纸色"；
④ 关键实验的**几何级特征**（按源码公式算坐标再数像素：单摆 14/14 采样点非纸色、胡克定律 3/3 标记点为纯墨色）；
⑤ 真点击 / 真派发事件 + `window.open` 间谍。

**核心为此新增的两条闸门（口径别记错）**：
```js
QG_PSLAB.drawErrorCount(id) === 0          // 运行时：异常"穿过 spec.draw 这一层"的次数（自挂载以来；state() 里是 drawErrors/drawErrorsTotal）
QG_PSLAB.shadowAudit('var-called') === []   // 静态：局部 var 被当函数调用（mech 那一类）——真正能对它报红的是这条
```
- ⚠ **`drawErrorCount` 覆盖不到"组内自己 catch"的异常** —— 那是原理性上限（已用对照实验证明：把 `hooke-law` 的 draw 装回修前形状，
  计数仍为 **0**，而 `shadowAudit` 报红）。所以**两条都要断言**，缺一不可。
- ⚠ **`shadowAudit` 的警告只进 console，不进 `state().warnings`**（§13 上面那条"warning 进 `state().warnings`"指的是**参数体检**那类；
  遮蔽扫描与 `empty-catch` 走 console）。探针要查 `QG_PSLAB.shadowAudit()` / `audit()[].suspects` 或 console，**别只查 `state().warnings`**。
- `shadowAudit` 是**文本启发式**（基于 `spec.draw.toString()`），只扫 draw/measure/step/conclude/onPointer **这 5 个回调本身的函数体**、
  不跟进组内 helper；已知**合法误报**形状：`var line = d.line; line(...)`（转存函数）；已排除"RHS 是调用表达式（工厂返回函数）"（`mod.js` 的 `var F = mkFontFn(gr); F(...)` 不再误报）。
  当前对 20 个真实实验 **0 误报**；`empty-catch`（只含注释的 catch）**只列不判**（存在有理由的兜底写法，但要提醒组方：有它在，draw 里任何新异常都会再次静默缺画面）。
- 修复的可见证据（独立复验实测）：`hooke-law` 非纸色像素 **2397 → 6085**、`simple-pendulum` **2050 → 5516**；
  20/20 实验每帧被吞异常数 **0**、指令级对照差恒为 3、主探针 217/217。

**验收基线（2026-09-29，20/20 通过 §7 的 1/2/3/4/5/6 条）**：方向性 20/20 ✓（如单摆 L↑→T↑、双缝 d↑→Δy↓、气体 V↑→p↓、
**光电效应光强×10 → I_sat↑ 而 U_c 不变**）；19 个线性实验 r² ∈ **0.9936~0.99999**，`va-characteristic` 契约 `fit:'none'`；
结论量级全对（g=9.824、n=1.50、λ=6.575e-7 m、d=6.165e-10 m、**h=6.616e-34 J·s**、ρ=1.087e-6、E=1.494 V/r=0.487 Ω）；
`20/20 lastError 为空`、0 register 警告、0 console 异常；**数学科目零污染**（无按钮、无 `pl-` DOM、无 `#plCSS`、既有 8 控件与 🎬 流程照旧）。

**已知未做/打折**：手机版未移植；≤768px 只做代码走查；`onPointer` 多数实验未实现（契约里是可选项）；
各组自测的"像素被画"有些是假 canvas 调用签名（真像素由验收探针补）；部分实验的原理/器材是**搜索摘录级来源**（PDF 读不了，见 §9.13）；
`emf-internal` 的参数语义是"电流表读数 I"（变阻器电阻由模型反解）；`oil-film` 的"浓度↑→d↑"走"未充分展开→S 偏小"这条人为误差通道。

**发布**：7 个新网页资源必须在 `_rebuild.ps1` 里各加一条 `/resource:` → 内嵌资源总数 **21 → 28**。

---

## 14. 化学实验台（反应台，`js/clab.js` + `js/clab/*.js`，化学观澜的一块）

**它是什么**：与物理实验台（§13）**同架构、同观感、同工程约束**，差别只在"测量"换成"现象" ——
选试剂 → 调条件 → **看现象** → 写方程式（核心**自动校验配平**）→ 得结论。
**契约在 `docs/化学实验台设计.md`（写新反应前先读它）。**

**文件**：核心 `js/clab.js`（注册表 + 三栏 UI + 现象表 + 结论卡 + `balance()` + 测试接口）+ 六组
`js/clab/{ions,metals,organic,electro,kinetics,analysis}.js`。**共 50 个反应**：
离子与溶液平衡 9（`agcl-precip` `baso4-precip` `cuoh2-precip` `feoh3-precip` `carbonate-acid` `ammonium-alkali` `hydrolysis` `precipitate-convert` `complex-ion`）、
金属与非金属 10（`na-water` `na-oxygen` `fe-cuso4` `al-naoh` `al-thermite` `cl2-metal` `cl2-water` `s-metal` `mg-co2` `cu-hno3`）、
有机 11（`methane-substitute` `ethylene-addition` `ethylene-polymer` `ethanol-oxidation` `ethanol-elimination` `esterification` `ester-hydrolysis` `glucose-silver` `starch-hydrolysis` `benzene-bromo` `phenol-bromine`）、
电化学 6（`galvanic-cuzn` `electrolysis-cucl2` `electrolysis-brine` `electroplating` `iron-corrosion` `fuel-cell`）、
速率与平衡 6（`rate-concentration` `rate-temperature` `rate-catalyst` `equilibrium-fescn` `equilibrium-no2` `weak-electrolyte`）、
检验·分离·定量 8（`flame-test` `iron-ion-test` `anion-test` `iodine-starch` `acid-base-titration` `kmno4-titration` `gas-collection` `so2-properties`）。

**只在化学科目出现**：入口 `#glClBtn` 的创建整段关在 `demo.js` 的 `if (!isChemSubject()) return;` 里；
`#clCSS` 在 unmount/close 时会被移除；**沙盒 / 物理实验台 / 化学实验台三者互斥**（开任一个自动收另外两个），
各自用独立类名（`ps-on` / `pl-on` / `cl-on`）与独立样式 id（`#psCSS` / `#glPlCSS` / `#glClCSS`）——
**别"统一"它们**，独立命名才能保证一方收尾不抹掉另一方。

**`balance()` 的四档状态（探针口径，别记错）**：
```js
{ status: 'ok'          }  // 配平（含离子电荷守恒、括号嵌套、结晶水、聚合物按 n=1 记账）
{ status: 'no-equation' }  // 本来就没有化学方程式 —— 焰色(物理变化)/碘的萃取(物理变化)/SO₂ 品红加合物(无固定组成)
                           //   ★ 这是**合法**写法，界面中性灰字、不记 warning、**不许判红**（否则等于惩罚"不编造化学"）
{ status: 'unbalanced'  }  // 真不配平 —— 只有这一档是缺陷，界面标红并**指出哪个元素/电荷不守恒**
{ status: 'unparsed'    }  // 解析失败（黄字）
```
**已知近似**：聚合物按 1 记账（`nC2H4 = (C2H4)n` 这类写法 ok；`nA = B` 这种不配对写法会被低估成守恒——不在中学范围）；
`balance` 判守恒不判最简（非最简给 `minimal=false` + note）。

**另外三条实现约定（组里都在用）**：① `react()` 返回"长度 n 的数组 + 末行字段挂在数组上"（`react(6)[0]` 与 `react().phenomena` 都可用）；
② 现象表就 **4 列**（第几次/现象/方程式/条件），定量列的数字折进"条件"格里显示（7 列会把右栏挤成一字一行）；③ `ionic` 里给全电极反应式时，
用「净离子方程式 + 中文括注」写法（核心的 `normEqText()` 会先剥含汉字的小括号括注再解析配平；**括注里不能再嵌英文括号**，否则剥不掉会判未配平）。

**⚠ 这轮踩到的三个坑（写新反应前先看）**：
① **`g.font(size)` 只返回字体串、不写 `ctx.font`** —— 不赋值就整块文字观感丢失，而**像素签名照样在变**，极难发现；自己 `c.font = font`。
② **`balance()` 不认化学式里的裸小写 `n`**（`nC2H4`/`(C6H10O5)n` 直接解析失败）→ 组 3 把 n 写实为 1000（并另加 500 保持最简比），通式写在 principle/文字里。
③ **局部函数/变量遮蔽**（`draw()` 体内声明 `bar()` 又被调用）会被核心的 `shadowAudit('var-called')` 抓到 —— 组 1 的 `precipitate-convert` 就中过，
改法是**把画图原语提到文件级**（`qgKspBar(...)`），别搬回 `draw` 体内。
④ **`isFinite(null) === true`** —— 判"是不是数字"千万别只写 `!isFinite(x)`：一个表示"无有效值"的 `null` 会穿过守卫，
走到 `x.toExponential()` 抛 TypeError（组 1 就因此在"等物质的量"边界必炸：`0.2×0.1` 与 `0.1×0.2` 是同一个 IEEE754 值，而滑块上界正好 0.20）。
正确写法：`x === null || x === undefined || typeof x !== 'number' || !isFinite(x)`。**滑块量程端点要当作必然会被点到的边界来设计。**

**核心的判据口径（断言"化学没坏"就用这几条）**：
```js
QG_CLAB.react(n)                      // ★ 绝不把 spec.react 的异常冒给调用方：捕获 → 计数 → lastError → 一次 console.warn → 那一次不出行（行号仍连续）→ 返回数组
QG_CLAB.reactErrorCount(id) === 0     // 运行时：spec.react 抛的次数（自本次挂载以来；state() 里是 reactErrors/reactErrorsTotal，另有 errorCounts:{draw,react,step,pointer,conclude}）
QG_CLAB.drawErrorCount(id) === 0      // 口径不变；★ 这两条都覆盖不到"组内自己 catch"的异常 —— 那是原理性上限（同 §13）
QG_CLAB.balance(eq).status            // ok | unbalanced | unparsed | no-equation（'no-equation' 合法、不标红、不记 warning）
QG_CLAB.balance(eq).segments[]        // 多步方程式（`;` `；` `｜` `|` 分隔）**逐段**校验；reason 里写「第 k 段：元素 X 不守恒」
QG_CLAB.graph().degenerate / fitNote  // y 恒定或 x 无分布 → fit:null + degenerate:true（r² 只在"y 非常数且 x 有分布"时可用）
```
`balance()` 现在认得：不带数字的 `·`（`NH3·H2O`，N1/H5/O1）、多段式、**减电子写法**（`Cu - 2e- = Cu2+`）；
修掉的两个真 bug：箭头正则过度贪婪会把 `CH3 - CH2 - OH --催化剂--> C2H4 + H2O` 从更早的空格连字符处劈开（元素数错），
以及减号只许当"减电子"用（带空格的单键若当分隔符会把元素减掉）。

**⚠ 参数组合扫描是化学的必备闸门**：`open()` 会重置 `lastError`/计数 —— "每个反应只读一次"会漏掉**只在某个参数组合下才炸**的缺陷。
实际做法：每个反应 ≥60 组（每个 numeric 的 min/mid/max × 每个 select 的全部选项 ＋ 同类单位参数"取相等值"的边界），**每组都读**状态。
组 1 用它拿到 `precipitate-convert` 的**修前 6 红 → 修后 0 红**；核心用 2745 组全库扫描 + 定点穷举该反应 **1,498,224** 组确认零抛错。

**验收与证据（2026-09-29）**：核心 `node --check` exit 0、离线自证 **133/133** + 真浏览器 **59/59**（真点击、真 rAF、真 `getImageData`）、
`balance()` 正反例 **45/45**；组内自测：离子 **364**、金属 **506 + 46（真挂载）**、有机 **327 + 110 + 58 + 14 张真像素**、
电化学/速率 **294 + 28 条配平**、检验定量 **314 + 139**；**全库 register 警告 0、`shadowAudit` 两类均 0、`drawErrorCount` 全 0**
（我用独立脚本复核过：50 个反应、0 重复 id、0 警告、每个 `draw()` 都能真跑出指令）。
接线后**四套探针保持基线**（`qa.js` 46/46、`tpl_probe` 45/45、`eng_probe` 20/20、`desk_fp_probe` 3/3、`node --test` 39/39）。
**发布**：7 个新网页资源各加一条 `/resource:` → 内嵌资源总数 **28 → 35**。
