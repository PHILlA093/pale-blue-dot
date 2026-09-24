# 穷观 · 宣传片生成流水线

一支 45 秒 / 1920×1080 / 60fps 的产品宣传片,全部由脚本驱动生成,不录屏、不剪辑软件。

```
docs\宣传片\
├── inject.js     注入层:虚拟时钟 + 抓 THREE 相机/控制器 + 覆盖层(片头片尾/字幕/进度线/暗角)
├── film.js       时间线:__film.frame(f) 是"帧号 → 画面"的纯函数(总长 2700 帧 @60fps = 45s)
├── record.js     录制器:无头 Edge + CDP 逐帧推进并截图,处理真实等待(AI 网络请求)
├── music.py      配乐:纯标准库逐样本合成(C 大调 I-V-vi-IV + 八分音符琶音 + 点八分乒乓回声,
│                 每拍一声轻 tick、每小节一记低频心跳,不打鼓;商务/发布会质感)
└── assemble.ps1  合成:PNG 序列 → H.264 mp4 → 混音 → 拷到桌面
```

## 跑一遍

```powershell
# 0) 静态服务器(把项目根当站点)
node 桌面版\build\_qa\server.js E:\workspace\穷观 8931

# 1) 取样(只截若干关键帧,用来验收构图;其余帧照常推进、真实 AI 也照跑)
node docs\宣传片\record.js 8931 E:\qg_promo\check --stills 205,400,900,1500,2320 --prefix k

# 2) 全片渲染(2700 张 PNG,约 8-12 分钟;耗时主要取决于 AI 出题/讲解的等待)
node docs\宣传片\record.js 8931 E:\qg_promo\frames

# 3) 配乐 + 合成 + 交付到桌面
python docs\宣传片\music.py E:\qg_promo\music.wav
powershell -NoProfile -ExecutionPolicy Bypass -File docs\宣传片\assemble.ps1

# 只换配乐(视频帧没变,不必重编码 2700 帧,几秒钟出片)
python docs\宣传片\music.py E:\qg_promo\music.wav
powershell -NoProfile -ExecutionPolicy Bypass -File docs\宣传片\assemble.ps1 -SkipVideo
```

`record.js` 的其他开关:`--range 300:1020` 只渲一段;`--dump "900||<js>"` 在某帧打印页面状态(排查用)。

## 三个关键设计

**1. 虚拟时钟 —— 60fps 的每一帧都精确对应 1/60 秒**
`inject.js` 在页面脚本之前把 `performance.now` / `Date.now` / `requestAnimationFrame` / `setTimeout`
全部换成"由我喂时间"的实现,于是页面时间成了 `__pump(t)` 的参数。录制器逐帧调用
`__film.frame(f) → __pump(f/60) → 截图`,所以既不会丢帧也不会重复帧,而且同一帧号永远画出同一画面。

**2. 真实等待用"闸门",不占帧号**
出题、AI 讲解、AI 生成示意图都是真实网络请求(真实 AI 输出,不是预置内容)。
等待段先按固定帧数录"AI 正在出题"的呼吸指示,闸门条件(如"4 张题卡已出现")没满足就
空转等待、**不推进帧号**,所以 AI 快慢不影响成片时长与节奏。
触发动作(点「出题训练」「发送」)必须放在等待段的 prep 里、即闸门之前,否则会死锁。

**3. 覆盖层挂在 `<html>` 上,不是 `<body>`**
破卷段把 body 做了 `transform: scale()`(让 980×780 的真窗口像"浮在舞台上的窗口")。
CSS 规范下祖先有 transform 时,fixed 定位会改用该祖先做包含块 —— 挂在 body 上会让整层
字幕跟着窗口一起偏移。挂到 `<html>` 就与那个包含块无关了。

## 环境与坑

- **本机只有 Windows PowerShell 5.1**(没有 pwsh 7):`.ps1` 必须 **纯 ASCII**——
  否则非 ASCII 字节会被按 ANSI 解码并**静默吞掉后续行**。`_rebuild.ps1` / `assemble.ps1`
  / `_makeicon.ps1` 都加了自检守卫,违反就直接 `FAILED` 退出。
- ffmpeg 是 npm 的静态包(见 `assemble.ps1` 顶部的绝对路径);重装需设
  `$env:FFMPEG_BINARIES_URL = "https://registry.npmmirror.com/-/binary/ffmpeg-static"`,否则 GitHub 限速会卡死。
- API Key 只从环境变量 `QG_KEY` 或 `E:\qg_promo\ds_key.txt` 读,不写进项目、不打印全文;
  页面里的 Key 输入框是 `type=password`,成片不会泄露。
- 画面里没有对项目文件做任何改动:所有标题/字幕/窗口取景都是录制时注入的 DOM 与 CSS。
