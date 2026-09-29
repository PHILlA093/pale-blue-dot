/* ============================================================
 * 年份意图:离线断言(不改动任何被测文件,只读 + 原样抽取)
 *   A. 从 corpus.js / train.js **逐字抽出**新增纯函数(按函数名 + 花括号配对),
 *      配假依赖(常量也从文件里逐字抽)后直接跑断言;
 *   B. 把 corpus.js 整文件按 window 打桩加载,用合成块池跑 _internals.search,
 *      验证"年份限定检索 / 0 段退回普通检索"这条链路;
 *   C. 用同一批函数在**真实语料**上核对年份筛选规模。
 * 用法: node qg_year_assert.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const CORPUS_JS = 'E:\\workspace\\穷观手机版\\js\\corpus.js';
const TRAIN_JS = 'E:\\workspace\\穷观手机版\\js\\train.js';
const CORPUS_TXT = 'E:\\workspace\\穷观手机版\\数据库\\qg_corpus.txt';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name + (extra !== undefined ? ' :: ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' :: ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
}

/* ---------- 抽取器:按函数名定位,花括号配对取完整函数体(逐字) ----------
 * 需要认掉注释、字符串与**正则字面量**(正则的字符类里可能出现 {} ,不认会把配对算错)。 */
function extractFn(text, name) {
  const key = 'function ' + name + '(';
  const at = text.indexOf(key);
  if (at < 0) throw new Error('找不到函数 ' + name);
  let i = text.indexOf('{', at);
  let depth = 0, inS = 0, q = '';
  for (let j = i; j < text.length; j++) {
    const c = text[j], prev = text[j - 1];
    if (inS) {
      if (c === '\\') { j++; continue; }
      if (c === q) inS = 0;
      continue;
    }
    if (c === '/' && text[j + 1] === '/') { while (j < text.length && text[j] !== '\n') j++; continue; }
    if (c === '/' && text[j + 1] === '*') { j = text.indexOf('*/', j) + 1; continue; }
    if (c === '"' || c === "'") { inS = 1; q = c; continue; }
    if (c === '/') {
      // 正则字面量:前一个有效字符不是标识符/右括号时才算(避免把除法当正则)
      let k = j - 1;
      while (k >= 0 && /\s/.test(text[k])) k--;
      const pk = k >= 0 ? text[k] : '';
      if (!/[A-Za-z0-9_$)\]}]/.test(pk)) {
        let inCls = 0;
        for (let m2 = j + 1; m2 < text.length; m2++) {
          const cc = text[m2];
          if (cc === '\\') { m2++; continue; }
          if (cc === '[') inCls = 1;
          else if (cc === ']') inCls = 0;
          else if (cc === '/' && !inCls) { j = m2; break; }
          else if (cc === '\n') break;              // 正则不会跨行
        }
        continue;
      }
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { const src = text.slice(at, j + 1); return { src, line: text.slice(0, at).split('\n').length }; } }
  }
  throw new Error('函数体不闭合: ' + name);
}
function extractLine(text, re, what) {
  const m = re.exec(text);
  if (!m) throw new Error('找不到常量 ' + what);
  return { src: m[0], line: text.slice(0, m.index).split('\n').length };
}

const corpusSrc = fs.readFileSync(CORPUS_JS, 'utf8');
const trainSrc = fs.readFileSync(TRAIN_JS, 'utf8');

const parts = [];
const prov = [];
function take(text, file, name) {
  const r = extractFn(text, name);
  parts.push(r.src);
  prov.push(name + ' @ ' + path.basename(file) + ':' + r.line);
  return r.src;
}
const cYearRe = extractLine(corpusSrc, /var YEAR_Q_RE = .*?;/, 'YEAR_Q_RE');
const cBlockYearRe = extractLine(corpusSrc, /var YEAR_RE = .*?;/, 'YEAR_RE');
const cIntent = extractLine(corpusSrc, /var INTENT_WORDS = \[.*?\];/, 'INTENT_WORDS');
const cPaper = extractLine(corpusSrc, /var PAPER_HINTS = \[[\s\S]*?\];/, 'PAPER_HINTS');
const cCache = extractLine(corpusSrc, /var yearRangeCache = null;/, 'yearRangeCache');
const cAskIntent = extractLine(trainSrc, /var YEAR_ASK_INTENT = \[[\s\S]*?\];/, 'YEAR_ASK_INTENT');
const cAskNoise = extractLine(trainSrc, /var YEAR_ASK_NOISE = \[.*?\];/, 'YEAR_ASK_NOISE');
const cAskRe = extractLine(trainSrc, /var YEAR_ASK_RE = .*?;/, 'YEAR_ASK_RE');
parts.push(cYearRe.src, cBlockYearRe.src, cIntent.src, cPaper.src, cCache.src, cAskIntent.src, cAskNoise.src, cAskRe.src);
prov.push('YEAR_Q_RE @ corpus.js:' + cYearRe.line, 'YEAR_RE(BlockYearRe) @ corpus.js:' + cBlockYearRe.line,
  'INTENT_WORDS @ corpus.js:' + cIntent.line,
  'PAPER_HINTS @ corpus.js:' + cPaper.line, 'yearRangeCache @ corpus.js:' + cCache.line,
  'YEAR_ASK_INTENT @ train.js:' + cAskIntent.line, 'YEAR_ASK_NOISE @ train.js:' + cAskNoise.line,
  'YEAR_ASK_RE @ train.js:' + cAskRe.line);

take(corpusSrc, CORPUS_JS, 'parseYearIntent');
take(corpusSrc, CORPUS_JS, 'headOf');
take(corpusSrc, CORPUS_JS, 'blockYear');
take(corpusSrc, CORPUS_JS, 'headHasYear');
take(corpusSrc, CORPUS_JS, 'filterByYear');
take(corpusSrc, CORPUS_JS, 'yearSets');
take(corpusSrc, CORPUS_JS, 'paperInfo');
take(corpusSrc, CORPUS_JS, 'expandCjkTerms');
take(corpusSrc, CORPUS_JS, 'paperRank');
take(corpusSrc, CORPUS_JS, 'yearNamedRank');
take(corpusSrc, CORPUS_JS, 'countYearNamed');
take(corpusSrc, CORPUS_JS, 'archiveYearRange');
take(trainSrc, TRAIN_JS, 'yearAskMode');
take(trainSrc, TRAIN_JS, 'buildQuery');
take(trainSrc, TRAIN_JS, 'resolveRealN');
take(trainSrc, TRAIN_JS, 'yearStatusText');
take(trainSrc, TRAIN_JS, 'yearInfoOf');
take(trainSrc, TRAIN_JS, 'gateRun');
take(trainSrc, TRAIN_JS, 'srcNames');

console.log('== 原样抽取的纯函数(逐字来自两个文件) ==');
prov.forEach(p => console.log('   ' + p));
console.log('   合计 ' + parts.length + ' 段,共 ' + parts.join('\n').length + ' 字符');

/* 假依赖:archiveYearRange 的缓存变量与两个常量都从文件里逐字抽来,拼在同一作用域里 */
const sandbox = {};
const factory = new Function('YEAR_RE_STUB', parts.join('\n') + '\nreturn {' +
  'parseYearIntent:parseYearIntent, headOf:headOf, headHasYear:headHasYear,' +
  'filterByYear:filterByYear, yearSets:yearSets, paperInfo:paperInfo, expandCjkTerms:expandCjkTerms,' +
  'paperRank:paperRank, yearNamedRank:yearNamedRank,' +
  'countYearNamed:countYearNamed, archiveYearRange:archiveYearRange,' +
  'yearAskMode:yearAskMode, buildQuery:buildQuery, resolveRealN:resolveRealN,' +
  'yearStatusText:yearStatusText, gateRun:gateRun, srcNames:srcNames, yearInfoOf:yearInfoOf};');
const F = factory();

console.log('\n== A1. 年份识别(规格 1) ==');
let r = F.parseYearIntent('2026高考题');
eq('2026高考题 → year', r.year, 2026);
eq('2026高考题 → intent', r.intent, '真题');
eq('2026高考题 → hit', r.hit, true);
eq('2026高考题 → 命中词', r.word, '高考');
r = F.parseYearIntent('2026年高考真题');
eq('2026年高考真题 → year', r.year, 2026);
eq('2026年高考真题 → intent', r.intent, '真题');
r = F.parseYearIntent('第01讲 集合');
eq('第01讲 集合 → year', r.year, null);
eq('第01讲 集合 → hit', r.hit, false);
r = F.parseYearIntent('4题');
eq('4题 → year', r.year, null);
eq('4题 → hit', r.hit, false);
r = F.parseYearIntent('高考真题');
eq('高考真题 → intent', r.intent, '真题');
eq('高考真题 → year', r.year, null);
eq('高考真题 → hit', r.hit, false);
r = F.parseYearIntent('2023-2026年高考真题(多取第一个)');
eq('2023-2026年… → 取第一个', r.year, 2023);
r = F.parseYearIntent('1999年模拟卷');
eq('1999年模拟卷 → year', r.year, 1999);
r = F.parseYearIntent('1800年真题');
eq('1800年真题 → 非 19/20 前缀不认', r.year, null);
r = F.parseYearIntent('2026 集合');
eq('2026 集合(无意图词)→ hit', r.hit, false);
eq('2026 集合(无意图词)→ year 仍解析出来', r.year, 2026);
r = F.parseYearIntent('2026年一模');
eq('2026年一模 → 意图词命中', r.hit, true);
r = F.parseYearIntent('4题 第01讲 数列');
eq('混合噪声 → year', r.year, null);

console.log('\n== A2. 年份筛选(候选 / 真原卷,与桌面同一口径) ==');
const pool = [
  '###SRC:zt/全卷解析/2026年上海卷(春)原卷.txt\n集合 2026 年上海卷题目…',
  '###SRC:zt/全卷解析/2025年新课标Ⅰ卷原卷.txt\n集合 2025 年新课标题目…',
  '###SRC:zt/版本2：数学（按省份分类）2008-2026/2025年高考数学试卷（新课标Ⅰ卷）（解析卷）.txt\n集合 试卷…',
  '###SRC:yl/一轮复习/第01讲 集合（原卷版）.txt\n集合 讲义…',
  '###SRC:zt/全卷解析/1952年全国卷原卷.txt\n集合 1952 题目…'
];
eq('headOf 只取块首', F.headOf(pool[0]).indexOf('###SRC:zt/全卷解析/2026年上海卷(春)原卷.txt'), 0);
eq('headHasYear 2026 命中(文件名带年份)', F.headHasYear(pool[0], 2026), true);
eq('headHasYear 2026 命中(路径含 2026 的合集目录)', F.headHasYear(pool[2], 2026), true);
eq('headHasYear 2026 不误伤 2025 卷', F.headHasYear(pool[1], 2026), false);
eq('headHasYear 对第01讲不误判', F.headHasYear(pool[3], 2026), false);
eq('filterByYear(2026) 候选段数(宽松)', F.filterByYear(pool, 2026, '').length, 2);
eq('filterByYear(2026) + zt 前缀 段数', F.filterByYear(pool, 2026, '###SRC:zt/').length, 2);
eq('filterByYear(2026) + yl 前缀 段数', F.filterByYear(pool, 2026, '###SRC:yl/').length, 0);
eq('filterByYear 保持原池顺序', F.filterByYear(pool, 2026, '')[0] === pool[0], true);
const ys = F.yearSets(pool, 2026, '');
eq('yearSets:2026 候选 2 段', ys.candidates.length, 2);
eq('yearSets:2026 真原卷只有 1 段(合集目录那块自身是 2025 → 剔除)', ys.strict.length, 1);
eq('yearSets:真原卷就是 2026年上海卷', /2026年上海卷/.test(ys.strict[0]), true);
const pi = F.paperInfo(ys.strict, 3);
eq('paperInfo:试卷份数', pi.papers, 1);
eq('paperInfo:文件名取末段', pi.names[0], '2026年上海卷(春)原卷.txt');
eq('paperInfo:清单不超过 max', F.paperInfo(ys.strict, 0).names.length <= 3, true);
const rr = F.archiveYearRange(pool, '');
eq('archiveYearRange 起点', rr.from, 1952);
eq('archiveYearRange 终点', rr.to, 2026);
eq('archiveYearRange + yl 前缀(无年份)', F.archiveYearRange(pool, '###SRC:yl/').from, 0);

console.log('\n== A3. 三档分级(搜索框原话;规格:2026=年份主导 / 2026 函数=年份限定 / 函数与导数=无年份) ==');
const POINT = '集合与常用逻辑用语 集合 子集 交并补';   // 当前知识点的检索词(必须**不**出现在年份档检索式里)
let am = F.yearAskMode('2026');
eq('2026 → 档位', am.mode, 'yearOnly');
eq('2026 → year', am.year, 2026);
eq('2026 → 检索式', am.query, '2026');
eq('2026 → 主题', am.topic, '2026 年高考真题');
let bq = F.buildQuery('2026', POINT);
ok('2026 → 检索式不含知识点名', bq.query.indexOf('集合') < 0 && bq.query.indexOf('子集') < 0, bq.query);
eq('2026年 → 档位', F.yearAskMode('2026年').mode, 'yearOnly');
eq('2026高考题 → 档位', F.yearAskMode('2026高考题').mode, 'yearOnly');
eq('2026高考题 → 检索式只含年份+意图词', F.buildQuery('2026高考题', POINT).query, '2026 高考');
eq('2026年高考真题 → 档位', F.yearAskMode('2026年高考真题').mode, 'yearOnly');
eq('2026年高考真题 → 检索式', F.buildQuery('2026年高考真题', POINT).query, '2026 高考 真题');
eq('2026年高考真题(带"的")→ 仍年份主导', F.yearAskMode('2026年的高考真题').mode, 'yearOnly');
eq('2026年原卷 → 年份主导', F.yearAskMode('2026年原卷').mode, 'yearOnly');
am = F.yearAskMode('2026 函数与单调性');
eq('2026 函数与单调性 → 档位', am.mode, 'yearScope');
eq('2026 函数与单调性 → 检索式=实词(年份交给子池)', F.buildQuery('2026 函数与单调性', POINT).query, '函数与单调性');
ok('年份限定检索式不含知识点名', F.buildQuery('2026 函数与单调性', POINT).query.indexOf('集合') < 0);
eq('2026 函数与单调性 → 主题', am.topic, '2026 年 函数与单调性');
eq('2026 函数 → 档位', F.yearAskMode('2026 函数').mode, 'yearScope');
eq('2026 集合 → 档位', F.yearAskMode('2026 集合').mode, 'yearScope');
eq('2026年函数(连写不带空格)→ 实词仍被拆出来', F.buildQuery('2026年函数单调性', POINT).query, '函数单调性');
eq('函数与导数 → 档位', F.yearAskMode('函数与导数').mode, 'none');
eq('空检索词 → 档位', F.yearAskMode('').mode, 'none');
ok('无年份档仍用知识点拼检索式', F.buildQuery('函数', POINT).query === POINT);
ok('无年份档且无知识点 → 用搜索框原话', F.buildQuery('牛顿第二定律', '').query === '牛顿第二定律');
eq('第01讲 集合 → 不误判年份', F.yearAskMode('第01讲 集合').mode, 'none');
eq('4题 → 不误判年份', F.yearAskMode('4题').mode, 'none');

console.log('\n== A4. 入口判定(无知识点也能搜题) ==');
let g = F.gateRun(true, null, '2026高考题');
eq('无知识点+有检索词 → 放行', g.ok, true);
eq('无知识点+有检索词 → 目标 p 为空', g.t.p, null);
eq('无知识点+有检索词 → byAsk', g.byAsk, true);
eq('无知识点+有检索词 → 检索式', g.t.kw, '2026高考题');
g = F.gateRun(true, null, '   ');
eq('无知识点+无检索词 → 拦', g.ok, false);
eq('无知识点+无检索词 → 文案', g.msg, '请输入要搜的题(例如:2026高考题),或在主界面点选知识点');
g = F.gateRun(true, { p: { name: '集合' }, via: 'sel' }, '');
eq('有知识点 → 放行且原样', g.ok, true && g.t.p.name === '集合' && g.byAsk === false);
g = F.gateRun(false, null, '2026高考题');
eq('curDB 为空 → 仍拦(文案不变)', g.ok, false);
eq('curDB 为空 → 文案', g.msg, '先选目标:在主系统点选一个知识点,或在上面输入关键词并「定位」');
g = F.gateRun(false, { p: { name: 'x' }, via: 'sel' }, '2026');
eq('curDB 为空 → 即使有目标也拦', g.ok, false);

console.log('\n== A5. 年份意图 → realN(年份主导 4 题;年份限定/用户选 0 不动) ==');
const yiOnly = { year: 2026, intent: '真题', word: '高考', hit: true, mode: 'yearOnly' };
const yiScope = { year: 2026, intent: '真题', word: '高考', hit: true, mode: 'yearScope' };
eq('年份主导 + 用户选 2 → 4', F.resolveRealN(2, yiOnly).realN, 4);
eq('年份主导 + 用户选 4 → 4', F.resolveRealN(4, yiOnly).realN, 4);
eq('年份主导 + 用户显式选 0 → 0(以用户为准)', F.resolveRealN(0, yiOnly).realN, 0);
eq('年份限定 + 用户选 2 → 2(按用户选择)', F.resolveRealN(2, yiScope).realN, 2);
eq('年份限定 + 非法值 7 → 2', F.resolveRealN(7, yiScope).realN, 2);
eq('年份主导 + 非法值 7 → 4', F.resolveRealN(7, yiOnly).realN, 4);
eq('无年份 + 选 2 → 2', F.resolveRealN(2, null).realN, 2);
eq('raised 标记(2→4)', F.resolveRealN(2, yiOnly).raised, true);

console.log('\n== A6. 状态栏文案(年份主导 / 空结果 / AI 原创) ==');
const specHit = '识别到你要 2026 年真题:本机档案 2026 年命中 12 段,已取 4 段作为素材';
let t = F.yearStatusText(yiOnly, { year: 2026, pool: 3665, matched: 12, fallback: false, archiveYear: 0, range: { from: 1952, to: 2026, from20: 2000, to20: 2026 } }, 4, 10, '', { names: ['2026年上海卷(春)原卷.txt', '2026年上海卷(春)解析.txt'], total: 10 });
ok('命中文案含规格原句', t.indexOf(specHit) === 0, t);
ok('命中文案带来源文件名 + 等 N 段', t.indexOf('(如 2026年上海卷(春)原卷.txt、2026年上海卷(春)解析.txt 等 10 段)') > 0, t);
ok('年份主导明说"已按年份出题"(无知识点时)',
  F.yearStatusText(Object.assign({}, yiOnly, { available: true }), { year: 2026, pool: 3665, matched: 12, fallback: false, range: { from: 1952, to: 2026, from20: 2000, to20: 2026 } }, 4, 10, '', { names: ['2026年上海卷(春)原卷.txt', '2026年上海卷(春)解析.txt'], total: 10 }).indexOf(',已按年份出题') > 0);
ok('命中文案含"提到 4 题"', t.indexOf('因指定年份,已把素材题数提到 4 题') > 0, t);
t = F.yearStatusText({ year: 2026, hit: true, mode: 'yearOnly', ignoredPoint: true, available: true }, { year: 2026, pool: 3665, matched: 12, fallback: false, range: { from: 1952, to: 2026, from20: 2000, to20: 2026 } }, 4, 10, '', { names: ['a.txt'], total: 10 });
ok('有选中点被忽略时明说「已按年份检索,本次忽略当前知识点」', t.indexOf('已按年份检索,本次忽略当前知识点') > 0, t);
t = F.yearStatusText({ year: 2026, hit: true, mode: 'yearScope', ignoredPoint: true, available: true }, { year: 2026, pool: 3665, matched: 12, fallback: false, range: { from: 1952, to: 2026, from20: 2000, to20: 2026 } }, 2, 10, '', null);
ok('年份限定不谎称"已按年份出题"(按用户选择的 2 题)', t.indexOf('已按年份出题') < 0 && t.indexOf('提到 4 题') < 0 && t.indexOf('未拼入当前知识点') > 0, t);
const specZero = '本机档案里没有 2026 年的题(档案年份 1952-2026)。请换年份,或去掉年份按知识点出题。';
t = F.yearStatusText(yiOnly, { year: 2026, pool: 0, matched: 0, fallback: true, candidates: 41, strict: 0, otherYears: 41, archiveYear: 0, range: { from: 1952, to: 2026, from20: 2000, to20: 2026 } }, 4, 0, '', null);
ok('空结果文案含规格原句(区间与桌面一致:1952-2026)', t.indexOf(specZero) > 0, t);
ok('空结果如实说明"候选都不是该年原卷"', t.indexOf('头部含"2026"的 41 段都不是 2026 年原卷') > 0, t);
ok('空结果如实说"已退回普通检索"', t.indexOf('已退回普通检索') > 0, t);
t = F.yearStatusText(yiOnly, { year: 2026, pool: 3665, matched: 0, fallback: false, archiveYear: 0, range: { from: 1952, to: 2026, from20: 2000, to20: 2026 } }, 4, 0, '', null);
ok('年份子池有段但 0 命中 → 如实说 0 段', t.indexOf('本机档案 2026 年命中 0 段') > 0, t);
t = F.yearStatusText(yiOnly, null, 0, 0, '', null);
ok('用户选 AI 原创 → 以用户为准且不吹年份', t.indexOf('素材偏好=AI 原创') > 0 && t.indexOf('提到 4 题') < 0, t);
t = F.yearStatusText(yiOnly, null, 4, 0, '内置语料读取失败:HTTP 404', null);
ok('检索失败 → 如实说失败,不谎称"档案里没有"', t.indexOf('本机资料库检索失败') > 0 && t.indexOf('本机档案里没有') < 0, t);
eq('没有年份档 → 空串(不动原有文案)', F.yearStatusText({ year: 0, hit: false }, null, 4, 0, '', null), '');
ok('每段文案都以。收尾', F.yearStatusText(yiOnly, { year: 2026, pool: 3665, matched: 12, fallback: false, range: { from: 1952, to: 2026, from20: 2000, to20: 2026 } }, 4, 10, '', null).slice(-1) === '。');

console.log('\n== A7. 素材来源文件名(最多 3 条 + 等 N 段) ==');
const hits9 = [{ src: 't/全卷解析/2026年上海卷(春)原卷.txt' }, { src: 't/全卷解析/2026年上海卷(春)原卷.txt' },
  { src: 't/全卷解析/2026年上海卷(春)解析.txt' }, { src: 't/五科真题/a.txt' }, { src: 't/五科真题/b.txt' },
  { src: 't/x/c.txt' }, { src: 't/x/d.txt' }];
let sn = F.srcNames(hits9, 3);
eq('文件名去重保序(只留末段)', sn.names.join('|'), '2026年上海卷(春)原卷.txt|2026年上海卷(春)解析.txt|a.txt');
eq('total = 片段段数', sn.total, 7);
eq('more = 被截掉的去重名数', sn.more, 3);
eq('空命中 → 空名字', F.srcNames([], 3).names.length, 0);

console.log('\n== A8. 年份回执归一化(手机版内置语料 / 桌面宿主两种形状) ==');
const phoneResp = { year: { year: 2026, pool: 536, strict: 536, candidates: 3665, matched: 536, papers: 18, fallback: false, range: { from: 1952, to: 2026 } } };
let yinfo = F.yearInfoOf(phoneResp);
eq('内置语料形状:原样透传 pool', yinfo.pool, 536);
eq('内置语料形状:candidates', yinfo.candidates, 3665);
const hostResp = { kind: 'matsResp', ok: true, year: 2026, intent: true, yearMode: true, yearOnly: true, filtered: 3665, strict: 536, otherYears: 3129, matched: 536, papers: 18, fallback: false, yearFrom: 1952, yearTo: 2026 };
yinfo = F.yearInfoOf(hostResp);
eq('桌面宿主形状:year 是数字 → 拉平成对象', typeof yinfo, 'object');
eq('桌面宿主形状:pool 取 strict', yinfo.pool, 536);
eq('桌面宿主形状:candidates 取 filtered', yinfo.candidates, 3665);
eq('桌面宿主形状:otherYears/papers', yinfo.otherYears + '/' + yinfo.papers, '3129/18');
eq('桌面宿主形状:年份区间取 yearFrom/yearTo', yinfo.range.from + '-' + yinfo.range.to, '1952-2026');
eq('无年份回执 → null', F.yearInfoOf({ ok: true, hits: [] }), null);
eq('失败回执 → null', F.yearInfoOf({ ok: false, err: 'x' }), null);

/* ---------- B. 整文件加载 corpus.js,跑 search 链路(合成池) ---------- */
console.log('\n== B. search() 链路:年份限定 / 试卷优先 / 0 段退回(合成池) ==');
const win = {};
global.window = win;
global.fetch = function () { return Promise.reject(new Error('offline harness')); };
new Function('window', 'fetch', fs.readFileSync(CORPUS_JS, 'utf8'))(win, global.fetch);
const I = win.QGCorpus._internals;
ok('corpus.js 暴露 yearIntent 纯函数', typeof win.QGCorpus.yearIntent === 'function');
eq('QGCorpus.yearIntent(2026高考题).year', win.QGCorpus.yearIntent('2026高考题').year, 2026);

const body = '集合 子集 交集 并集 补集 集合的运算 例题解析 '.repeat(6);
function blk(src, extra) { return '###SRC:' + src + '\n' + body + (extra || ''); }
const bigPool = [
  blk('zt/全卷解析/2026年上海卷(春)原卷.txt'),
  blk('zt/全卷解析/2025年新课标Ⅰ卷原卷.txt'),
  blk('zt/全卷解析/2024年全国甲卷原卷.txt'),
  blk('yl/一轮复习/第01讲 集合（原卷版）.txt'),
  blk('zt/版本2：数学（按省份分类）2008-2026/2025年高考数学试卷（新课标Ⅰ卷）（解析卷）.txt')
];
let s = I.search(bigPool, { query: '集合 子集', src: 'zt', loose: true });
eq('无年份:普通检索命中数(zt 4 块)', s.matched, 4);
eq('无年份:结果里没有 year 字段', s.year, undefined);
s = I.search(bigPool, { query: '集合 子集', src: 'zt', loose: true, year: 2026 });
eq('year=2026:候选 2 段(含合集目录命中)', s.year.candidates, 2);
eq('year=2026:真原卷 1 段(合集目录那块自身是 2025 → 剔除)', s.year.strict, 1);
eq('year=2026:被剔除的其他年份段数', s.year.otherYears, 1);
eq('year=2026:子池段数(只用真原卷)', s.year.pool, 1);
eq('year=2026:命中数', s.year.matched, 1);
eq('year=2026:未退回', s.year.fallback, false);
eq('year=2026:扫的是真原卷子池', s.scanned, 1);
ok('year=2026:命中片段来自 2026 素材', s.hits.length > 0 && s.hits.every(h => /2026/.test(h.src)), JSON.stringify(s.hits.map(h => h.src)));
s = I.search(bigPool, { query: '集合 子集', src: 'zt', loose: true, query2: 0, year: 2027 });
eq('year=2027(档案没有):fallback', s.year.fallback, true);
eq('year=2027:子池 0 段', s.year.pool, 0);
eq('year=2027:退回普通检索后仍有命中', s.matched, 4);
eq('year=2027:档案年份跨度', s.year.range.from + '-' + s.year.range.to, '2008-2026');
eq('year=2027:20xx 主区间', s.year.range.from20 + '-' + s.year.range.to20, '2008-2026');
s = I.search(bigPool, { query: '2026高考题 集合', src: 'zt', loose: true });
eq('查询自带年份 → 自动限定(不传 year)', s.year.pool, 1);
s = I.search(bigPool, { query: '2026 集合', src: 'zt', loose: true });
eq('只有年份没有意图词 → 不限定(query 路径)', s.year, undefined);
eq('年份主导实参 msg.year=2026 仍限定', I.search(bigPool, { query: '2026', src: 'zt', loose: true, year: 2026 }).year.pool, 1);
s = I.search(bigPool, { query: '集合', src: 'yl', loose: true, year: 2026 });
eq('year=2026 但 src=yl 无该年份真题', s.year.fallback, true);
eq('year=2026 + src=yl:档案里(不限 src)另有该年份段数', s.year.archiveYear, 2);

/* 年份限定必须真的"年内缩小":年份词不能顶替实词满足命中门槛
 * (合成池里放一段 2026 但没有"集合"的块 —— 修好之前它也会被算作命中) */
const narrowPool = [
  blk3('zt/全卷解析/2026年甲卷原卷.txt', '集合 子集 交集 '.repeat(12)),
  blk3('zt/全卷解析/2026年乙卷原卷.txt', '数列 通项 求和 '.repeat(12)),
  blk3('zt/全卷解析/2025年丙卷原卷.txt', '集合 子集 交集 '.repeat(12))
];
const nr = I.search(narrowPool, { query: '函数单调性', src: 'zt', loose: true, year: 2026 });
eq('年份限定:全是 2026 子池', nr.year.pool, 2);
eq('年份限定:实词(函数单调性)命中 0 段', nr.year.matched, 0);
const nr2 = I.search(narrowPool, { query: '2026 集合', src: 'zt', loose: true, year: 2026 });
eq('年份限定:年份词不再顶替实词(命中被真正缩小)', nr2.year.matched, 1);
const nr3 = I.search(narrowPool, { query: '2026 集合', src: 'zt', loose: true, year: 2026, paperFirst: true });
eq('年份主导:子池内不做词过滤(全子池命中)', nr3.year.matched, 2);
ok('年份主导:不要求知识点/实词关键词', nr3.year.matched === nr3.year.pool);
const nr4 = I.search(narrowPool, { query: '2026', src: 'zt', loose: true, year: 2026, paperFirst: true });
eq('年份主导(只有年份):全子池命中', nr4.year.matched, 2);

/* 长中文实词拆 2 字片段(与桌面同一手法):真原卷池里整串匹配常常 0 命中 */
eq('expandCjkTerms:长中文词拆片段', I.expandCjkTerms(['函数单调性']).join('|'), '函数单调性|函数|数单|单调|调性');
eq('expandCjkTerms:短词不动', I.expandCjkTerms(['集合']).join('|'), '集合');
eq('expandCjkTerms:英文不切', I.expandCjkTerms(['physics']).join('|'), 'physics');
eq('expandCjkTerms:不重复已有词', I.expandCjkTerms(['函数单调性', '函数']).join('|'), '函数单调性|函数|数单|单调|调性');
const frPool = [
  blk3('zt/全卷解析/2026年甲卷原卷.txt', '本题考察函数的单调性,函数 单调 性质。'),
  blk3('zt/全卷解析/2026年乙卷原卷.txt', '数列 通项 求和。')
];
const fr = I.search(frPool, { query: '函数单调性', src: 'zt', loose: true, year: 2026 });
eq('年份限定:整串不命中时靠 2 字片段召回', fr.year.matched, 1);
eq('年份限定:片段命中仍只在该年份真原卷里', fr.hits.length, 1);

/* 试卷优先:年份子池内路径含 原卷/真题/解析/各地卷 的排前。
 * 对照设计:讲义块最短(不排 paperFirst 时按"短块在前"排第一),
 * 原卷块更长 —— 只有 paperFirst 生效才会顶到最前。用块内标记判断主命中块
 * (loose 会把相邻块并入,所以看 text 里的标记而不是 src 标签)。 */
function blk2(src, extra, n) { return '###SRC:' + src + '\n' + body.slice(0, n) + (extra || ''); }
function blk3(src, text) { return '###SRC:' + src + '\n' + text; }
const paperPool = [
  blk2('zt/全卷解析/2026年A卷原卷.txt', ' MARK-Y1', 200),
  blk2('zt/全卷解析/2026年B卷原卷.txt', ' MARK-Y2', 200),
  blk2('zt/一轮复习讲义/2026年复习资料.txt', ' MARK-J', 60)
];
const noPaper = I.search(paperPool, { query: '2026', src: 'zt', loose: true, year: 2026 });
const withPaper = I.search(paperPool, { query: '2026', src: 'zt', loose: true, year: 2026, paperFirst: true });
ok('paperFirst:原卷排到最前', withPaper.hits[0].text.indexOf('MARK-Y1') >= 0,
  withPaper.hits.map(h => h.src).join(' | '));
ok('对照:不加 paperFirst 时第一段不是原卷(短讲义在前)', noPaper.hits[0].text.indexOf('MARK-Y1') < 0,
  noPaper.hits.map(h => h.src).join(' | '));
ok('paperFirst:命中集合不变(只是顺序)', withPaper.matched === noPaper.matched && withPaper.matched === 3,
  withPaper.matched + ' vs ' + noPaper.matched);
eq('paperRank:原卷=0', I.paperRank('###SRC:zt/全卷解析/2026年上海卷(春)原卷.txt\nx'), 0);
eq('paperRank:讲义=1', I.paperRank('###SRC:zt/一轮复习讲义/a.txt\nx'), 1);

/* 年份直写优先:实测 zt 里"头部含 2026"的 3 665 段只有 536 段路径直写"2026年",
 * 其余是 "…/2008-2026/2025年高考数学试卷….txt" 这种年份区间目录命中(块本身是别的年份)。
 * 用 loose:false(不并入相邻块)才能用 src 直接判定主命中块。 */
const namedPool = [
  blk2('zt/版本2：数学（按省份分类）2008-2026/2025年高考数学试卷（新课标Ⅰ卷）（解析卷）.txt', '', 60),
  blk2('zt/全卷解析/2026年上海卷(春)原卷.txt', '', 200)
];
const ns1 = I.search(namedPool, { query: '2026 集合', src: 'zt', loose: false, year: 2026 });
const ns2 = I.search(namedPool, { query: '2026 集合', src: 'zt', loose: false, year: 2026, paperFirst: true });
ok('对照:合集目录那块(自身 2025)已被真原卷精筛剔除', I.yearSets(namedPool, 2026, '###SRC:zt/').strict.length === 1 && /2026年上海卷/.test(ns1.hits[0].src), ns1.hits[0].src);
ok('年份直写的块排到最前(年份区间目录命中不再抢先)', /2026年上海卷/.test(ns2.hits[0].src), ns2.hits[0].src);
eq('yearNamedRank:直写 2026年=0', I.yearNamedRank('###SRC:zt/全卷解析/2026年上海卷(春)原卷.txt\nx', 2026), 0);
eq('yearNamedRank:年份区间目录=1', I.yearNamedRank('###SRC:zt/版本2：数学（按省份分类）2008-2026/2025年高考数学试卷（新课标Ⅰ卷）（解析卷）.txt\nx', 2026), 1);
eq('countYearNamed', I.countYearNamed(namedPool, 2026), 1);
ok('年份主导检索不需要知识点关键词即可命中', I.search(bigPool, { query: '2026', src: 'zt', loose: true, year: 2026, paperFirst: true }).matched === 1);

/* ---------- C. 真实语料:用文件里的函数核对规模 ---------- */
console.log('\n== C. 真实语料(49,945,760 B)上核对 ==');
const t0 = Date.now();
const all = fs.readFileSync(CORPUS_TXT, 'utf8');
const realPool = I.splitBlocks(all);
eq('splitBlocks 块数', realPool.length, 37246);
const y2026 = I.filterByYear(realPool, 2026, '###SRC:zt/');
eq('zt 下 2026 年子池段数', y2026.length, 3665);
eq('zt 下 2025 年子池段数', I.filterByYear(realPool, 2025, '###SRC:zt/').length, 804);
eq('zt 下 2027 年子池段数(应为 0)', I.filterByYear(realPool, 2027, '###SRC:zt/').length, 0);
const range = I.archiveYearRange(realPool, '###SRC:zt/');
eq('zt 真题档案年份跨度(全)', range.from + '-' + range.to, '1952-2026');
eq('zt 真题档案年份跨度(20xx 主区间)', range.from20 + '-' + range.to20, '2000-2026');
const sReal = I.search(realPool, { query: '集合 子集 交集', src: 'zt', loose: true, year: 2026 });
console.log('   真语料 year=2026 检索: 子池=' + sReal.year.pool + ' 命中=' + sReal.year.matched
  + ' 输出片段=' + sReal.hits.length + ' 首条 src=' + (sReal.hits[0] ? sReal.hits[0].src.substring(0, 46) : '—'));
ok('真语料:年份限定生效(命中段远小于全池)', sReal.year.matched > 0 && sReal.year.matched < 4000, sReal.year.matched);
const sRealAll = I.search(realPool, { query: '集合 子集 交集', src: 'zt', loose: true });
console.log('   真语料 无年份 对照: 命中=' + sRealAll.matched + ' 输出片段=' + sRealAll.hits.length);
ok('真语料:限定年份后命中数 < 不限定', sReal.year.matched < sRealAll.matched);
// 年份主导(「2026」):检索式只有年份,按试卷优先取整卷
const sRealOnly = I.search(realPool, { query: '2026', src: 'zt', loose: true, year: 2026, paperFirst: true });
console.log('   真语料 年份主导「2026」: 子池=' + sRealOnly.year.pool + ' 命中=' + sRealOnly.year.matched
  + ' 输出片段=' + sRealOnly.hits.length);
console.log('     取到来源: ' + I.search(realPool, { query: '2026', src: 'zt', loose: true, year: 2026, paperFirst: true }).hits.map(h => h.src.split('/').pop()).join('、'));
ok('真语料:「2026」不需要知识点关键词即命中全部年份子池', sRealOnly.year.matched === sRealOnly.year.pool, sRealOnly.year.matched + '/' + sRealOnly.year.pool);
const srcNames = F.srcNames(sRealOnly.hits, 3);
console.log('     界面将显示: 素材来源:' + srcNames.names.join('、')
  + (srcNames.total > srcNames.names.length ? ' 等 ' + srcNames.total + ' 段' : ''));
ok('真语料:来源文件名可显示', srcNames.names.length > 0 && srcNames.names.length <= 3);
const realNote = F.yearStatusText({ year: 2026, hit: true, mode: 'yearOnly', ignoredPoint: true, available: true },
  { year: 2026, pool: sRealOnly.year.pool, matched: sRealOnly.year.matched, fallback: false, named: sRealOnly.year.named,
    candidates: sRealOnly.year.candidates, strict: sRealOnly.year.strict, otherYears: sRealOnly.year.otherYears,
    papers: sRealOnly.year.papers,
    archiveYear: 0, range: { from: range.from, to: range.to, from20: range.from20, to20: range.to20 } },
  4, sRealOnly.hits.length, '', srcNames);
console.log('   真语料状态栏文案:\n     ' + realNote);
console.log('   年份子池里路径直写"2026年"的段数 = ' + sRealOnly.year.named + ' / ' + sRealOnly.year.pool);
ok('真语料文案含规格原句与忽略知识点说明',
  realNote.indexOf('识别到你要 2026 年真题:本机档案 2026 年命中 ') === 0
  && realNote.indexOf('已按年份检索,本次忽略当前知识点') > 0, realNote);
ok('真语料文案如实报候选/真原卷拆分', realNote.indexOf('头部含"2026"的候选 3665 段,其中自身就是 2026 年原卷的 536 段') > 0 && realNote.indexOf('已只用这 536 段') > 0, realNote);
ok('真语料:候选 3665 → 真原卷 536(3129 段合集目录命中被剔除)', sRealOnly.year.candidates === 3665 && sRealOnly.year.strict === 536 && sRealOnly.year.otherYears === 3129,
  JSON.stringify({ candidates: sRealOnly.year.candidates, strict: sRealOnly.year.strict, otherYears: sRealOnly.year.otherYears, papers: sRealOnly.year.papers }));
ok('真语料:按年份主导排序后取到的首段是 2026 年直写卷',
  /2026年/.test(sRealOnly.hits[0].src), sRealOnly.hits[0].src);
console.log('   (真实语料这一段耗时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒)');

/* ---------- D. 端到端:打桩 fetch,走 QGCorpus.mats() 的完整响应(含 load/解析/回执) ---------- */
console.log('\n== D. mats() 端到端响应(打桩 fetch,含 load 与 ###SRC: 解析) ==');
(async function partD() {
  const fakeBlocks = [
    blk2('zt/全卷解析/2026年A卷原卷.txt', '', 300),
    blk2('zt/全卷解析/2026年B卷真题.txt', '', 300),
    blk2('zt/全卷解析/2025年C卷原卷.txt', '', 300),
    blk2('zt/一轮复习讲义/2026年复习资料.txt', '', 300)
  ];
  // 真语料的形态:###SRC: 只在每块开头出现,块之间用 \n###SRC: 分隔
  const fakeAll = fakeBlocks.map(b => b.replace(/^###SRC:/, '')).join('\n###SRC:');
  const win2 = {};
  const fakeFetch = function (url) {
    const body = /qg_corpus\.txt/.test(String(url)) ? fakeAll : '';
    return Promise.resolve({
      ok: true, status: 200, statusText: 'OK',
      text: function () { return Promise.resolve(body); }
    });
  };
  new Function('window', 'fetch', fs.readFileSync(CORPUS_JS, 'utf8'))(win2, fakeFetch);
  const QG = win2.QGCorpus;
  try {
    const r1 = await QG.mats({ kind: 'mats', src: 'zt', loose: true, query: '2026', year: 2026, paperFirst: true });
    eq('mats():kind/ok', r1.kind + '/' + r1.ok, 'matsResp/true');
    ok('mats():年份回执透传(子池段数)', !!(r1.year) && r1.year.pool === 3, JSON.stringify(r1.year));
    eq('mats():年份直写段数', r1.year.named, 3);
    ok('mats():年份回执里不带整池引用(可安全序列化)',
      JSON.stringify(r1.year).length < 400 && r1.year.range.pool === undefined,
      'len=' + JSON.stringify(r1.year).length);
    eq('mats():命中段数(年份主导=全子池)', r1.year.matched, 3);
    eq('mats():未退回', r1.year.fallback, false);
    ok('mats():首条是年份直写卷', /2026年A卷原卷\.txt/.test(r1.hits[0].src), r1.hits[0].src);
    const r2 = await QG.mats({ kind: 'mats', src: 'zt', loose: true, query: '2027' });
    eq('mats():无年份档不带 year 回执', r2.year, undefined);
    const r3 = await QG.mats({ kind: 'mats', src: 'zt', loose: true, query: '2027高考题', year: 2027 });
    ok('mats():档案没有的年份 → fallback 回执', r3.year && r3.year.fallback === true && r3.year.pool === 0, JSON.stringify(r3.year));
    const st = QG.stat();
    ok('stat():块数来自解析', (await st).baseBlocks === 4, JSON.stringify((await QG.stat()).baseBlocks));
  } catch (e) {
    ok('mats() 端到端', false, String(e && e.message || e));
  }
  console.log('\n==== 年份意图离线断言: ' + pass + ' 通过 / ' + fail + ' 失败 ====');
  process.exit(fail ? 1 : 0);
})();




