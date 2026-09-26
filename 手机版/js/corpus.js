/* ============================================================
 * corpus.js — 手机版「本机资料库」(包内语料)读取 + 检索
 * [原创指纹] QG-20260920-5e5d5a · 文件 js/corpus.js · © 2026 PHILlA093 · 保留所有权利
 * ------------------------------------------------------------
 * 为什么要有这个文件:
 *   桌面版的「本机资料库 / 破卷真题素材」全部由 WinForms 宿主代劳 ——
 *   宿主读 数据库\qg_corpus.txt(###SRC: 分块)与 数据库\qg_subjects.txt
 *   (###SUBJ: 科目上传区),解析后由 kind:'mats' 消息返回命中片段。
 *   手机版(Capacitor APK / 手机浏览器)**没有宿主**,那条路走不通。
 *   本文件就是把宿主那一套解析与检索口径**原样搬到 JS 侧**,
 *   数据源换成同一个包内的 数据库\*.txt(fetch 自己的 https://localhost/ 资源)。
 *
 * 口径来源(桌面版 build\Program.cs,只读参考,未改动):
 *   · SplitBlocks()      —— 块分隔与长度门槛
 *   · LoadSubjects()     —— ###SUBJ: 科目区段
 *   · RebuildMerged()    —— 上传区按 560 字切块,拼进检索池
 *   · BlockYear/BlockWeight() —— 真题年份权重(2017-2026 ×3)
 *   · HandleMats()       —— 分词、召回门槛、排序、输出配额
 *   逐条对应见下面每个函数上方的 "宿主对应" 注释。
 *
 * 刻意保留的宿主怪癖(改了才会"两边不一致",所以照样复刻):
 *   ① 宿主取 src 用 block.Substring(8, …),而 "###SRC:" 只有 7 个字符,
 *      于是 src 的第一位被吃掉:zt/… → "t/…",subj/… → "ubj/…"。
 *   ② 同理 ###SUBJ: 头的 key 用 Substring(8) → "math" → "ath"。
 *      两者都只影响"回传字符串",不影响召回与排序;手机版逐字节照抄。
 *
 * 性能约定(手机弱):
 *   · 懒加载:不在启动时读;只有第一次真正检索(gkMats/subjMats)时才 fetch + 解析;
 *   · 解析只用一次 String.split('\n###SRC:'),不对 44MB 全文做正则扫描;
 *     年份正则只跑在每个块的首行(与宿主一致);
 *   · 解析结果只放内存(33k 块 ≈ 47MB,localStorage 5~10MB 塞不下,
 *     IndexedDB 还要把同样字节再落一份盘 —— 都不划算,故只用内存);
 *   · 解析完立刻丢掉 45MB 原文引用,峰值过后常驻只剩块数组;
 *   · 失败一律给出可读原因(HTTP 码 / 网络异常 / 格式不符),绝不静默返回空。
 * ============================================================ */
(function () {
  'use strict';

  var VERSION = 'phone-1';

  /* 包内资源:与桌面版 数据库\qg_corpus.txt / qg_subjects.txt **同一个文件**
     (构建时按字节复制,见 _gaokao_work\语料内置说明.md 的 SHA256 对拍) */
  var CORPUS_URL = '数据库/qg_corpus.txt';
  var SUBJ_URL = '数据库/qg_subjects.txt';

  /* ---------- 与宿主一致的常量 ---------- */
  var BLOCK_SEP = '\n###SRC:';      // SplitBlocks: all.Split(new[]{"\n###SRC:"}, RemoveEmptyEntries)
  var SRC_TAG = '###SRC:';          // 7 个字符
  var SUBJ_TAG = '###SUBJ:';        // 7 个字符
  var MIN_BLOCK = 40;               // SplitBlocks: 只保留 s.Length > 40 的块
  var SUBJ_CHUNK_CHARS = 560;       // SubjChunkChars:上传区切块粒度
  var RECENT_FROM = 2017, RECENT_TO = 2026;   // 近十年区间(含)
  var W_RECENT = 3.0, W_NORMAL = 1.0;         // 年份权重
  var YEAR_RE = /(?:19|20)\d{2}(?=\s*年)/;    // BlockYearRe
  var TOKEN_SEP = /[ ,，、;；]+/;             // HandleMats: ' ' , ， 、 ; ；

  /* 桌面版同期的块数(仅用于"疑似不完整"提示,不参与任何判定逻辑) */
  var EXPECT_BLOCKS = 33255;

  /* ---------- 状态 ---------- */
  var state = {
    phase: 'idle',        // idle | loading | ready | error
    err: '',              // 致命错误(可读中文)
    warn: '',             // 非致命提示(如科目上传区读取失败)
    where: '',            // 数据来源描述(对应宿主的 baseWhere)
    base: null,           // string[] 基座块
    merged: null,         // string[] 检索池 = 基座 + 科目上传区切块
    subjects: [],         // [{key,name,points}]
    bytes: 0,             // 语料文件字节数
    ms: {}                // 耗时分解
  };
  var loading = null;

  function now() {
    try { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    catch (e) { return Date.now(); }
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* ============================================================
   * 解析:宿主 SplitBlocks(string all) 的逐行等价实现
   *   C#: parts = all.Split(["\n###SRC:"], RemoveEmptyEntries)
   *       s = p.StartsWith("###SRC:") ? p : "###SRC:" + p
   *       if (s.Length > 40) list.Add(s)
   * ============================================================ */
  function splitBlocks(all) {
    if (!all || all.length < MIN_BLOCK) return [];
    var parts = all.split(BLOCK_SEP);
    var list = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.length === 0) continue;                 // RemoveEmptyEntries
      var s = p.indexOf(SRC_TAG) === 0 ? p : SRC_TAG + p;
      if (s.length > MIN_BLOCK) list.push(s);
    }
    return list;
  }

  /* ============================================================
   * 解析:宿主 LoadSubjects() 的等价实现
   *   C# 用 File.ReadAllLines(Encoding.UTF8):按 \r\n | \n | \r 分行,且自动吃掉 BOM
   *   段落文本 = 逐行 AppendLine(即每行补 \r\n)
   *   头部 = line.Substring(8).Split('|') → key|hash|points|name(同样少取一位)
   * ============================================================ */
  // File.ReadAllLines 语义:文件以换行结尾时**不**产生末尾那个空行。
  // 直接 split 会多出一个 "" 元素,导致最后一块上传区切块多一个换行(实测差 1 个字符,
  // 见 _gaokao_work/verify_blocks.js 的逐块 MD5 对拍)。
  function readAllLines(text) {
    if (!text) return [];
    var lines = text.split(/\r\n|\n|\r/);
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  function loadSubjects(text) {
    var out = [];
    if (!text) return out;
    var lines = readAllLines(text);
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(SUBJ_TAG) !== 0) continue;
      var h = lines[i].substring(8).split('|');      // 与宿主一致:Substring(8)
      if (h.length < 4) continue;
      var e = { key: h[0], hash: h[1], points: parseInt(h[2], 10) || 0, name: h[3], lines: [] };
      i++;
      while (i < lines.length && lines[i].indexOf(SUBJ_TAG) !== 0) { e.lines.push(lines[i]); i++; }
      i--;
      out.push(e);
    }
    return out;
  }

  /* ============================================================
   * 解析:宿主 RebuildMerged() 的等价实现
   *   上传区正文先 \r\n→\n 再按 \n 切行(段落末尾 AppendLine 会多出一个空行,照抄),
   *   然后按 560 字切块,块头 "###SRC:subj/<key>/<part> 自动上传(<points>点)"
   * ============================================================ */
  function rebuildMerged(base, subjects) {
    var list = base.slice();
    for (var si = 0; si < subjects.length; si++) {
      var e = subjects[si];
      var lines = (e.lines.join('\n') + '\n').replace(/\r\n/g, '\n').split('\n');
      var buf = '';
      var part = 0;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        if (buf.length > 0 && buf.length + ln.length + 1 > SUBJ_CHUNK_CHARS) {
          part++;
          list.push(SRC_TAG + 'subj/' + e.key + '/' + part + ' 自动上传(' + e.points + '点)\n' + buf);
          buf = '';
        }
        if (buf.length > 0) buf += '\n';
        buf += ln;
      }
      if (buf.length > 0) {
        part++;
        list.push(SRC_TAG + 'subj/' + e.key + '/' + part + ' 自动上传(' + e.points + '点)\n' + buf);
      }
    }
    return list;
  }

  /* 宿主 BlockYear:只看块首行,取首个 (19|20)xx 后跟"年"的四位数 */
  function blockYear(block) {
    if (!block) return 0;
    var nl = block.indexOf('\n');
    var head = nl > 0 ? block.substring(0, nl) : block;
    var m = YEAR_RE.exec(head);
    if (!m) return 0;
    var y = parseInt(m[0], 10);
    return isNaN(y) ? 0 : y;
  }
  function isRecent(y) { return y >= RECENT_FROM && y <= RECENT_TO; }
  /* 宿主 BlockWeight:只有 ###SRC:zt/ 开头的真题按年份加权,其余恒为 1 */
  function blockWeight(block) {
    if (!block) return W_NORMAL;
    if (block.indexOf(SRC_TAG + 'zt/') !== 0) return W_NORMAL;
    return isRecent(blockYear(block)) ? W_RECENT : W_NORMAL;
  }
  /* 宿主 BlockLen:去掉首行后的长度 */
  function blockLen(block) {
    var sep = block.indexOf('\n');
    return sep > 0 ? block.length - sep : block.length;
  }
  /* 宿主取 src 的写法:bk.Substring(8, sep - 8)(少一位,见文件头说明)*/
  function srcOf(block, sep) {
    return sep > 8 ? block.substring(8, sep) : '';
  }

  /* ============================================================
   * 排序:逐位复刻宿主 .NET 的排序过程(不是"随便排一下")
   * ------------------------------------------------------------
   * 宿主用的是 List<int>.Sort(Comparison<int>),实测(_gaokao_work/sort_probe.js 与
   * sort_real2.js:把自制检索池灌进宿主真实 HandleMats,再逐批"揭示"它的完整排序顺序)
   * 走的是 .NET Framework 的经典 QuickSort:
   *   ① 每次分区前先把 low / middle / high 三个位置按比较器排好(三数取中),再取中点当枢轴;
   *   ② 双指针扫描:左指针停在 "≥ 枢轴",右指针停在 "≤ 枢轴",交换后各自前进;
   *   ③ 只递归较小的一半,另一半用循环继续(递归深度 O(log n))。
   * 为什么必须照抄:V8 的 Array.prototype.sort 自 ES2019 起是**稳定**排序,
   * 在"命中词数相同 + 块体长度相同"的块上会保留扫描顺序,而宿主的快排会打乱 ——
   * 实测 69 条查询里 53 条"命中集合一样、但首条块不同"就是这么来的。
   * 逐位复刻后,手机版与桌面版的命中顺序完全一致(69/69 逐字节相同)。
   * 注:扫描方向与枢轴都踩过坑 —— 右指针必须是 cmp(keys[j], x) > 0(而不是 cmp(x, keys[j]) > 0),
   *     两者在"键值全等"的自制池上看不出差别,只有真实比较器才暴露(会把数组排成乱序)。
   * ============================================================ */
  function swapIfGreater(keys, cmp, a, b) {
    if (a !== b && cmp(keys[a], keys[b]) > 0) {
      var t = keys[a]; keys[a] = keys[b]; keys[b] = t;
    }
  }
  function dotNetSort(keys, cmp) {
    if (keys.length < 2) return keys;
    quickSort(keys, 0, keys.length - 1, cmp);
    return keys;
  }
  function quickSort(keys, left, right, cmp) {
    do {
      var i = left, j = right;
      var middle = i + ((j - i) >> 1);
      swapIfGreater(keys, cmp, i, middle);       // 三数取中:先把 low/middle/high 排好
      swapIfGreater(keys, cmp, i, j);
      swapIfGreater(keys, cmp, middle, j);
      var x = keys[middle];                      // 枢轴取排好后的中点元素
      do {
        while (cmp(keys[i], x) < 0) i++;         // 左指针:停在 ≥ 枢轴
        while (cmp(keys[j], x) > 0) j--;         // 右指针:停在 ≤ 枢轴
        if (i > j) break;
        if (i < j) { var t = keys[i]; keys[i] = keys[j]; keys[j] = t; }
        i++; j--;
      } while (i <= j);
      // 只递归较小的一半,另一半用循环继续(与 .NET 一致)
      if ((j - left) <= (right - i)) {
        if (left < j) quickSort(keys, left, j, cmp);
        left = i;
      } else {
        if (i < right) quickSort(keys, i, right, cmp);
        right = j;
      }
    } while (left < right);
    return keys;
  }

  /* 命中排序入口:默认用宿主的 .NET 排序(QA 里可替换成别的实现做对照实验) */
  var sortHits = dotNetSort;

  /* ============================================================
   * 检索:宿主 HandleMats() 的逐行等价实现
   *   terms    = q.Split(' ', ',', '，', '、', ';', '；') 去空,Trim 后长度 ≥ 2
   *   召回     = 命中词数 ≥ (loose ? 1 : 2),单词最多数 3
   *   排序     = 加权分(命中词数 × 年份权重)降序 → 块体长度升序(用宿主的 .NET 排序)
   *   输出     = loose: ≤10 条 / 14000 字 / 每条 1200… 见下 maxHits/charCap/perCap
   * ============================================================ */
  function search(pool, msg) {
    msg = msg || {};
    var q = msg.query == null ? '' : String(msg.query);
    var srcFilter = msg.src == null ? '' : String(msg.src);
    var loose = !!msg.loose;

    var tokens = q.split(TOKEN_SEP);
    var terms = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i].replace(/^\s+|\s+$/g, '');
      if (t.length >= 2) terms.push(t);
    }
    var prefix = srcFilter.length > 0 ? SRC_TAG + srcFilter + '/' : '';
    var needScore = loose ? 1 : 2;

    var idxHits = [];
    var scores = {};
    for (var bi = 0; bi < pool.length; bi++) {
      var b = pool[bi];
      if (prefix.length > 0 && b.indexOf(prefix) !== 0) continue;
      var score = 0;
      for (var k = 0; k < terms.length; k++) {
        if (b.indexOf(terms[k]) >= 0) score++;
        if (score >= 3) break;
      }
      if (score >= needScore) { idxHits.push(bi); scores[bi] = score * blockWeight(b); }
    }
    var matched = idxHits.length;

    // 与宿主同一套排序(.NET introsort),见上面 dotNetSort 的说明
    sortHits(idxHits, function (a, c) {
      var d = scores[c] - scores[a];              // 分高者前(降序)
      if (d !== 0) return d > 0 ? 1 : -1;
      return blockLen(pool[a]) - blockLen(pool[c]);  // 同分:短块在前(升序)
    });

    var maxHits = loose ? 10 : 6;
    var charCap = loose ? 14000 : 5200;
    var perCap = loose ? 2400 : 1200;
    var used = {};
    var outHits = [];
    var totalChars = 0;
    for (var hi = 0; hi < idxHits.length && outHits.length < maxHits && totalChars < charCap; hi++) {
      var idx = idxHits[hi];
      if (used[idx]) continue;
      var i0 = loose ? Math.max(0, idx - 1) : idx;
      var i1 = loose ? Math.min(pool.length - 1, idx + 1) : idx;
      var sb = '';
      var src = '';
      for (var kk = i0; kk <= i1; kk++) {
        used[kk] = true;
        var bk = pool[kk];
        var sep = bk.indexOf('\n');
        if (kk === i0) src = srcOf(bk, sep);
        var body = sep > 0 ? bk.substring(sep + 1) : bk;
        if (sb.length > 0) sb += '\n';
        if (sb.length + body.length <= perCap) sb += body;
        else sb += body.substring(0, Math.max(0, perCap - sb.length));
      }
      var hy = blockYear(pool[idx]);
      outHits.push({ src: src, text: sb, year: hy });
      totalChars += sb.length;
    }
    return { hits: outHits, matched: matched, total: pool.length, scanned: pool.length };
  }

  /* ============================================================
   * 读取:懒加载 + 单飞(并发只读一次),失败给可读原因
   * ============================================================ */
  function fetchText(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) {
        var e = new Error('HTTP ' + res.status + ' ' + (res.statusText || '') + ' — ' + url);
        e.http = res.status;
        throw e;
      }
      return res.text();
    });
  }

  function load() {
    if (loading) return loading;
    state.phase = 'loading';
    var t0 = now();
    loading = Promise.resolve().then(function () {
      return fetchText(CORPUS_URL);
    }).then(function (all) {
      var tFetched = now();
      state.bytes = all ? all.length : 0;
      if (all && all.charCodeAt(0) === 0xFEFF) all = all.substring(1);  // 与 .NET 一致:吃掉 BOM
      if (!all || all.length < MIN_BLOCK) {
        throw new Error('语料文件为空或过短(' + (all ? all.length : 0) + ' 字符):' + CORPUS_URL);
      }
      var base = splitBlocks(all);
      var tSplit = now();
      all = null;                                   // 丢掉 45MB 原文引用,只留块数组
      if (!base.length) {
        throw new Error('语料格式不符:未解析出任何 "' + SRC_TAG + '" 数据块(' + CORPUS_URL
          + ')。文件可能被截断、损坏,或不是桌面版的 qg_corpus.txt。');
      }
      state.base = base;
      state.where = '手机版内置语料(' + CORPUS_URL + ')';
      if (base.length < EXPECT_BLOCKS / 4) {
        state.warn = '内置语料块数偏少(仅 ' + base.length + ' 块,桌面版同期为 '
          + EXPECT_BLOCKS + ' 块),文件可能不完整';
      }
      state.ms.fetch = r1(tFetched - t0);
      state.ms.split = r1(tSplit - tFetched);
      // 科目上传区(失败不致命:基座语料仍可检索,与宿主"没有上传区"的表现一致)
      return fetchText(SUBJ_URL).then(function (subjText) {
        var tSubj = now();
        if (subjText && subjText.charCodeAt(0) === 0xFEFF) subjText = subjText.substring(1);
        var subs = loadSubjects(subjText);
        state.subjects = subs.map(function (e) { return { key: e.key, name: e.name, points: e.points }; });
        state.merged = rebuildMerged(base, subs);
        state.ms.subj = r1(now() - tSubj);
        state.ms.bytes = state.bytes;
        state.phase = 'ready';
        state.ms.total = r1(now() - t0);
        return state;
      }, function (err) {
        state.warn = '科目上传区(' + SUBJ_URL + ')读取失败:' + (err && err.message ? err.message : err)
          + ' — 仅基座语料可用';
        state.subjects = [];
        state.merged = base.slice();
        state.phase = 'ready';
        state.ms.total = r1(now() - t0);
        return state;
      });
    }).catch(function (err) {
      loading = null;                               // 允许用户重试
      state.phase = 'error';
      state.err = readable(err);
      state.ms.total = r1(now() - t0);
      throw new Error(state.err);
    });
    return loading;
  }

  function readable(err) {
    var m = err && err.message ? err.message : String(err);
    if (err && err.http) return '手机版内置语料读取失败:' + m;
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
      return '手机版内置语料读取失败:取不到 ' + CORPUS_URL
        + '(网络/资源不可用)。若这是 APK,请确认 www 里带了 数据库 目录。';
    }
    return '手机版内置语料不可用:' + m;
  }

  /* ============================================================
   * 对外:与宿主 kind:'mats' 响应**同形状**的检索接口
   *   宿主返回 {kind:'matsResp', ok:true, hits:[{src,text,year}], total, where}
   *   手机版返回同名字段(ok:false 时带 err),train.js 无需分环境处理。
   * ============================================================ */
  function mats(payload) {
    var t0 = now();
    return load().then(function () {
      var t1 = now();
      var r = search(state.merged, payload || {});
      var out = {
        kind: 'matsResp', ok: true, hits: r.hits, total: r.total, matched: r.matched,
        where: state.where, src: 'phone-corpus', ms: { load: r1(t1 - t0), search: r1(now() - t1) }
      };
      if (state.warn) out.warn = state.warn;
      return out;
    }, function (err) {
      return { kind: 'matsResp', ok: false, err: (err && err.message) || state.err || '内置语料不可用' };
    });
  }

  function stat() {
    return load().then(function () {
      return {
        ok: true, where: state.where, baseBlocks: state.base.length, mergedBlocks: state.merged.length,
        subjects: state.subjects, bytes: state.bytes, ms: state.ms, warn: state.warn, phase: state.phase
      };
    }, function (err) {
      return { ok: false, err: (err && err.message) || state.err, phase: state.phase, ms: state.ms };
    });
  }

  window.QGCorpus = {
    version: VERSION,
    corpusUrl: CORPUS_URL,
    subjectsUrl: SUBJ_URL,
    load: load,          // 预加载(可选);不调用也不会在启动时读盘
    mats: mats,          // 检索(自动触发懒加载)
    stat: stat,          // 加载状态 / 块数 / 耗时
    state: function () {
      return {
        phase: state.phase, err: state.err, warn: state.warn, where: state.where,
        baseBlocks: state.base ? state.base.length : 0,
        mergedBlocks: state.merged ? state.merged.length : 0,
        subjects: state.subjects, bytes: state.bytes, ms: state.ms
      };
    },
    /* 内部实现:仅供一致性 QA 对拍,业务代码不要用 */
    _internals: {
      splitBlocks: splitBlocks, loadSubjects: loadSubjects, rebuildMerged: rebuildMerged,
      blockYear: blockYear, blockWeight: blockWeight, blockLen: blockLen, search: search,
      dotNetSort: dotNetSort,
      setSort: function (fn) { sortHits = fn || dotNetSort; },
      getSort: function () { return sortHits; },
      poolRef: function () { return state.merged || (state.base || []); },
      searchRef: function (msg) { return search(state.merged || [], msg); },
      constants: {
        MIN_BLOCK: MIN_BLOCK, SUBJ_CHUNK_CHARS: SUBJ_CHUNK_CHARS,
        RECENT_FROM: RECENT_FROM, RECENT_TO: RECENT_TO, W_RECENT: W_RECENT, W_NORMAL: W_NORMAL
      }
    }
  };
})();
