# 穷观 · 架构设计说明

> 面向维护者。版本 V2.4.2。本文只描述**当前实际实现**,不含设想。

## 1. 总体形态

单进程桌面程序:.NET Framework 4.8 WinForms + WebView2,**没有后端、没有 HTTP 服务器、没有构建工具链**。

```
穷观 V2.4.2(单进程)
├─ MainForm           无边框 1440×900  → https://app.local/index.html
├─ trainWindow  (static) TrainForm  无边框 980×780  → train.html   「破卷」
└─ guanlanWindow(static) TrainForm  无边框 1180×820 → guanlan.html 「观澜」
```

三个窗口共用同一个 C# 类 `TrainForm`,靠两个**静态字段**区分;重复点开只前置、不新开。

- **网页资源全部内嵌为 exe 资源**,命名规则 `web.<路径点号化>`(如 `js/app.js` → `web.js.app.js`)。
- 宿主注册 `AddWebResourceRequestedFilter("https://app.local/*")`,由 `OnWebResourceRequested`
  从 `Assembly.GetManifestResourceStream` 取流并回包,附带 `Access-Control-Allow-Origin: *`
  与 `Cache-Control: no-store`。
- 因此**新增任何网页文件都必须同步加进 `桌面版\build\_rebuild.ps1` 的 `/resource:` 列表**,
  否则宿主返回 404、页面直接缺样式或缺脚本。

## 2. 页面 ⇄ 宿主 消息协议

页面用 `window.chrome.webview.postMessage({kind, ...})` 发起;宿主 `HandleWebMessage`
按 `kind` 分发,**除 `ping` 外一律 `Task.Run` 到线程池**执行,回包在 UI 线程
`PostWebMessageAsJson`。

| kind | 参数 | 返回 | 用途 |
|---|---|---|---|
| `ds` | `key, messages, model, max_tokens, temperature, json` | `{ok, content, err, http}` | DeepSeek 代理(`json:true` 时才加 `response_format=json_object`) |
| `mats` | `query, src, loose` | `{ok, hits:[{src,text,year}]}` | 本机语料检索 |
| `webq` | `query, terms` | `{ok, hits:[{url,title,snippet,text}]}` | 必应联网检索(免密钥) |
| `dbAdd` | `subjectKey, subjectName, hash, points[]` | `{ok, updated, points, err}` | 知识云上传进本机资料库 |
| `dbStat` | — | `{ok, where, baseBlocks, subjects[]}` | 资料库统计 |
| `wipe` | `hadKey` | `{ok}` | 删除运行日志 |
| `wnd` | `op: move\|min\|max\|close`, `dx, dy` | `{ok}` | 无边框窗口控制 |
| `ping` | — | `{kind:'pong', ts}` | 心跳 |

**硬性约定**

1. **`_seq` 必须原样回带**(`WithSeq` 在最后一个 `}` 前插入)。页面靠它配对 Promise。
2. **发号必须走 `window.__qgSeq` 共享计数器**(`nextSeq()`)。同一窗口里可能有多个发送方
   (同一页面若有多个请求发送方),各自独立计数会撞号,
   表现为"回调收到别人的字段"。`train.js` / `demo.js` / `mainbridge.js` 三处均已改为共享计数器。
3. **不要直接改调用方传来的 payload**(`hostReq` 会先浅拷贝再挂 `_seq`),否则复用同一对象会串号。
4. `JavaScriptSerializer` 把 JSON 数组解成 `ArrayList`,宿主侧统一用 `AsArr()` 归一。

## 3. 并发与锁(容易踩)

每个 WebView 消息都在**线程池**上跑,所以下列静态状态是跨线程共享的:

`baseBlocks` / `subjEntries`(List)/ `mergedBlocks` / `baseWhere`

统一用 `CorpusLock` 保护:

- `EnsureCorpus()` —— 双检锁,首次加载 ≈44 MB 语料并切块。
- `HandleDbAdd()` / `HandleDbStat()` —— **整个方法体在锁内**。
- `HandleMats()` —— 只在锁内**取一次 `mergedBlocks` 引用快照**,耗时的全量扫描放在锁外。

> 背景:主窗 `load` 后 700 ms 发 `dbStat`、1000 ms 发 `dbAdd`,两者会并行。
> 若 `HandleDbStat` 的 `foreach (subjEntries)` 撞上 `HandleDbAdd` 的写入,会抛
> `InvalidOperationException: Collection was modified` 并被 catch 吞掉(表现为"连接资料库失败")。
> `CorpusLock` 用的是 Monitor,**同线程可重入**,所以锁内再调 `EnsureCorpus()` 不会死锁。

`subjEntries` 的持久化是**原子**的:先写 `.tmp`,再 `File.Replace` 到目标并留一份 `.bak`;
落盘失败会**回滚内存并返回 `ok:false`**,不会假报"已上传"。

## 4. 语料与检索

- 语料文件:`桌面版\数据库\qg_corpus.txt`(每块以 `###SRC:<相对路径>` 开头,块长约 560 字)。
- 加载优先级:数据库文件夹 → 内嵌资源 `web.corpus.txt`(当前未内嵌)→ 无。
  `baseWhere` 会如实反映实际来源,**未找到时报"未找到本地语料"**。
- 来源前缀:`zt/` 高考真题 · `jyfs/` 举一反三 · `yl/` 一轮讲义 · `gs/` 公式结论 · `subj/` 用户上传的知识云。

**年份权重**(`RecentFrom=2017`,`RecentTo=2026`,`WRecent=3.0`,`WNormal=1.0`):
只对 `###SRC:zt/` 的块生效,排序分 = `词命中数 × 年份权重`;**阈值仍按原始词命中数判定**,
权重只影响排序、不改召回门槛。年份从块首 SRC 行的 `YYYY年` 提取。

**上传区按 560 字切块**(`SubjChunkChars`)。整科目合成一个巨块会导致检索输出上限
(1200/2400 字)之后的内容永远取不到。

## 5. AI 提示词与来源可信度

- 出题请求开始时快照当前科目、知识点、题型、难度,后续主窗切科目不改变该请求。
- 难度与素材目标独立。素材不足时用原创补齐,不为无法满足的来源比例反复调用 AI。
- 返回 JSON 先经 `validateBatch` 检查题数、题型、难度字段、非空题干/答案/解析、选项数、选项字母和重复题。最多重试三次格式错误;仍失败则保留上一批题。
- 每个检索片段有 `local-N` / `web-N` 标识。`verifySource` 仅在题干与全部选项按顺序匹配对应片段时给出“原文匹配”标签;只忽略空白,保留公式、数字和符号。模型自己声明的来源与认证字段不能作为证明。
- 未匹配到原文的来源标记为待核实;联网原文匹配不表示网页内容一定是真题,答案与解析也仍由 AI 生成。
- 联网正文仍用 `<<<UNTRUSTED_WEB_BEGIN>>>` 包裹,其中指令不得覆盖系统提示。知识云档案不是真题。
- 默认 DeepSeek 模型为 `deepseek-flash`,兼容转换旧别名;显式传递 thinking 模式,网页版结构化请求也携带 `response_format`。

## 6. 无边框窗口

三个窗口都是 `FormBorderStyle.None`:圆角由宿主用 `Region` 裁剪(半径随 DPI 缩放),
页面另加一层 `.winedge` 覆盖层画灰色描边,`html.maxed` 在最大化时改直角。

拖动由页面发 `wnd{op:'move', dx, dy}`,**用 `screenX/screenY` 算增量**(窗口跟手移动时
client 坐标会自变导致抖动),宿主在 `WorkingArea` 内做钳制,保证至少 120×40 可见
(无边框窗没有标题栏可抓,拖出屏幕就找不回来了)。

外部链接(`target="_blank"`)由宿主交给系统默认浏览器 —— 无边框窗没有地址栏,
在窗内打开会成为死胡同。

## 7. 安全边界

- API Key 只存本机同源 localStorage(`qg_ds_key`),不写 URL、不进日志
  (`SanitizeMsg` 把 `"key":"…"` 替换为 `***`)。
- **`qg_live_cmd` 只认 `locate` 指令**;`setkey` 分支已删除 —— 任何同源脚本都能写这个 key,
  保留"写入 Key"的能力等于把 Key 交给任意注入脚本。指令执行后立即 `removeItem`,防重放。
- 联网抓取(`webq`)对外部 URL 做公网校验(`IsPublicHttpUrl`),拦截 localhost / 私网 / 保留地址(SSRF)。
- TLS 只启用 1.2 及以上。
- 页面 CSP 见三个 html 的 `<meta http-equiv="Content-Security-Policy">`;
  页面**零外链、零 CDN**(`vendor/` 全部本地化),必须保持离线可用。

## 8. 已知限制

- 不是真正的单文件:WebView2 的 3 个 DLL 必须同目录。
- 数据库目录不可写时(如放在 `C:\Program Files`),知识云上传会**明确失败并提示**,
  不再静默假报成功。
- 语料检索是**朴素词频匹配**,没有分词、没有向量检索;检索质量依赖块切分与关键词命中。
- 观澜从入口直接打开独立窗口;主窗不再加载观澜浮动面板与画布脚本。
  对话仅存内存,主窗关闭时子窗一并退出。
- `js/app.js` 与 `js/glcanvas.js` 使用普通对象做字典的地方必须以外部 id 为键时改用
  `Object.create(null)`,否则 `constructor` / `__proto__` 这类 id 会命中原型导致条目丢失。

## 9. 个人数据与回归检查

新增知识点按 `qg_custom_point_v2:<subject>:<id>` 独立写入 localStorage,旧整表继续读取且不重写。保存失败时不提交内存节点、不清空表单。卸载保留整个 WebView2 配置目录;发现该目录或无法检查目录内容时,禁止整目录递归删除。

资料库桥接为自身的 pending 请求注册独立回执监听,匹配 `_seq` 后清除计时器,不删除共享事件对象的字段。

运行 `node --test tests/regression.cjs` 验证已修复的异常路径。`tests/InstallerRegression.cs` 直接调用卸载清理辅助函数,只对全新临时夹中的模拟文件操作,不执行真实卸载。
