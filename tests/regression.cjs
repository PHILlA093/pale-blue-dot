// Run: node --test tests/regression.cjs. Uses isolated memory; never reads user profiles/API keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
const train = read('js/train.js');
const app = read('js/app.js');
function fn(source, name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);
  const end = source.indexOf('\n  }', start);
  return source.slice(start, end + 4);
}
function context(functions, globals = {}) {
  const ctx = vm.createContext({ console, ...globals });
  vm.runInContext(functions.join('\n'), ctx);
  return ctx;
}
function storage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.get(k) ?? null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); }
  };
}
const clone = v => JSON.parse(JSON.stringify(v));
function question(i = 0) {
  return { type: '单选', difficulty: 3, stem: '已知函数 f(x)=x+' + i + ',求函数在指定点的值。',
    options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'], answer: 'A', analysis: '代入函数式计算并核对。', source: 'AI 生成', sourceId: '' };
}
const quality = context(['parseAI', 'validateBatch', 'verifySource', 'buildPrompt', 'modelConfig',
  'isPickedTarget', 'boardNameOf'].map(n => fn(train, n)));

test('all scripts parse and all five databases retain valid IDs, boards and links', () => {
  for (const name of fs.readdirSync(path.join(root, 'js')).filter(n => n.endsWith('.js'))) {
    new vm.Script(read('js/' + name), { filename: name });
  }
  for (const name of ['data.js', 'data_chem.js', 'data-physics.js', 'data_eng.js', 'data_bio.js']) {
    const ctx = context([], { window: {} });
    vm.runInContext(read('js/' + name), ctx);
    const db = Object.values(ctx.window).find(v => v && v.points);
    const ids = new Set(db.points.map(p => p.id));
    assert.equal(ids.size, db.points.length, name);
    const boards = new Set(db.boards.map(b => b.id));
    for (const p of db.points) {
      assert.ok(boards.has(p.board), name + '/' + p.id);
      assert.ok(p.content && p.name);
      assert.ok((p.links || []).every(id => ids.has(id)), name + '/' + p.id);
    }
  }
});

test('legacy notes load and two stale windows can add notes without overwriting each other', () => {
  const old = { id: 'legacy', subject: 'math', name: '旧笔记', links: ['base'] };
  const ls = storage({ qg_custom_points_v1: JSON.stringify([old]) });
  const make = subject => context([fn(app, 'readCustomStore'), fn(app, 'saveCustomPoints')], {
    CUSTOM_PREFIX: 'qg_custom_point_v2:', DB: { subject }, localStorage: ls
  });
  const a = make('math'), b = make('math'), chem = make('chem');
  assert.equal(a.readCustomStore().length, 1);
  assert.equal(b.readCustomStore().length, 1);
  assert.equal(a.saveCustomPoints({ id: 'a', name: 'A', content: 'A', links: ['legacy'] }), true);
  assert.equal(b.saveCustomPoints({ id: 'b', name: 'B', content: 'B', links: [] }), true);
  assert.equal(chem.saveCustomPoints({ id: 'c', name: 'C', content: 'C' }), true);
  assert.deepEqual(new Set(a.readCustomStore().map(p => p.id)), new Set(['legacy', 'a', 'b', 'c']));
  assert.deepEqual(JSON.parse(ls.getItem('qg_custom_points_v1')), [old]);
  assert.deepEqual(clone(a.readCustomStore().find(p => p.id === 'a').links), ['legacy']);
});

test('quota errors are reported without modifying prior notes', () => {
  const ls = storage({ qg_custom_points_v1: '[{"id":"old","name":"keep"}]' });
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  const ctx = context([fn(app, 'saveCustomPoints')], { DB: { subject: 'math' }, CUSTOM_PREFIX: 'qg_custom_point_v2:', localStorage: ls });
  assert.equal(ctx.saveCustomPoints({ id: 'new', name: 'new' }), false);
  assert.equal(ls.getItem('qg_custom_points_v1'), '[{"id":"old","name":"keep"}]');
  const commit = app.slice(app.indexOf('    function commitCustomPointCore('), app.indexOf('    // 提交'));
  assert.ok(commit.indexOf('if (!saveCustomPoints(p)) return null;') < commit.indexOf('DB.points.push(p)'));
  const submit = app.slice(app.indexOf("submitBtn.addEventListener('click'"));
  assert.ok(submit.indexOf('if (!p) return;') < submit.indexOf("nameEl.value = ''"));
});

test('one malformed stored note cannot hide intact old and new notes', () => {
  const ls = storage({ qg_custom_points_v1: 'broken', 'qg_custom_point_v2:math:bad': '{',
    'qg_custom_point_v2:math:ok': JSON.stringify({ id: 'ok', subject: 'math', name: '笔记' }) });
  const ctx = context([fn(app, 'readCustomStore')], { localStorage: ls, CUSTOM_PREFIX: 'qg_custom_point_v2:' });
  assert.deepEqual(clone(ctx.readCustomStore()).map(p => p.id), ['ok']);
});

test('valid choice/fill/essay batches pass; invalid batches fail instead of rendering', () => {
  assert.equal(quality.validateBatch([0, 1, 2, 3].map(question), '单选', 3, 4), '');
  for (const type of ['多选', '填空', '解答']) {
    const qs = [0, 1, 2, 3].map(question).map(q => ({ ...q, type, options: type === '多选' ? q.options : null, answer: type === '多选' ? 'AC' : '答案' }));
    assert.equal(quality.validateBatch(qs, type, 3, 4), '');
  }
  const mutations = [q => q.type = '解答', q => q.difficulty = 1, q => q.difficulty = '3',
    q => q.stem = '', q => q.answer = '', q => q.analysis = '', q => q.options = [],
    q => q.options[1] = 'B. 1', q => q.answer = 'E', q => q.answer = 'AA',
    q => q.options[0] = 'D. 1', q => q.stem = { fake: true }];
  for (const mutate of mutations) {
    const qs = [0, 1, 2, 3].map(question); mutate(qs[0]);
    assert.notEqual(quality.validateBatch(qs, '单选', 3, 4), '');
  }
  assert.notEqual(quality.validateBatch([question(), question(), question(), question()], '单选', 3, 4), '');
  assert.notEqual(quality.validateBatch([null, 1, false, 'bad'], '单选', 3, 4), '');
  assert.throws(() => quality.parseAI('{"questions":"bad"}'));
});

test('invented sources, unrelated same-year text and forged verification fields never become verified', () => {
  for (const source of ['真题·历年全国卷', '真题·2016全国卷I', '联网·2025全国卷']) {
    const q = { ...question(), source, _sourceKind: 'local' };
    quality.verifySource(q, [], []);
    assert.equal(q._sourceKind, 'unverified');
    assert.match(q.source, /待核实/);
  }
  const q = { ...question(), source: '真题·2016全国卷I', sourceId: 'local-1' };
  quality.verifySource(q, [{ year: 2016, src: 'zt/2016全国卷', text: '这是完全不相关的素材。' }], []);
  assert.equal(q._sourceKind, 'unverified');
});

test('matching source must include unchanged stem and all options in the original order', () => {
  const original = question();
  const hit = { src: 'zt/测试原卷', text: original.stem + '\n' + original.options.join('\n') };
  const q = { ...clone(original), sourceId: 'local-1' };
  quality.verifySource(q, [hit], []);
  assert.equal(q._sourceKind, 'local');
  assert.equal(q.source, '本地原文匹配·zt/测试原卷');
  for (const mutate of [q => q.stem = q.stem.replace('x+0', 'x-0'), q => q.options[3] = 'D. 9', q => q.options.reverse()]) {
    const changed = { ...clone(original), sourceId: 'local-1' }; mutate(changed);
    quality.verifySource(changed, [hit], []);
    assert.equal(changed._sourceKind, 'unverified');
  }
  const web = { ...clone(original), sourceId: 'web-1' };
  quality.verifySource(web, [], [{ ...hit, src: '', title: '测试网页' }]);
  assert.equal(web._sourceKind, 'web');
});

test('English prompts use English tasks, stable subject snapshots and explicit source IDs', () => {
  const t = { p: { name: '定语从句', board: 'grammar', keywords: [], content: '语法讲解', importance: 3 } };
  const ctx = { subject: 'eng', subjectName: '高中英语', boards: [{ id: 'grammar', name: '语法' }] };
  const prompt = quality.buildPrompt(t, [{ text: 'local' }], [{ text: 'web' }], [], 3, 2, 4, { label: '阅读理解', jsonType: '单选' }, ctx);
  assert.match(prompt.system, /使用英语;解析用中文/);
  assert.doesNotMatch(prompt.system, /题干、选项、答案均用中文/);
  assert.match(prompt.user, /科目:高中英语/);
  assert.match(prompt.user, /sourceId=local-1/);
  assert.match(prompt.user, /sourceId=web-1/);
  t.p.content = '错误资料，待人工校对';
  assert.doesNotMatch(quality.buildPrompt(t, [], [], [], 3, 0, 4, null, ctx).user, /错误资料/);
});

test('default and legacy DeepSeek names migrate; explicit model choices remain intact', () => {
  for (const name of ['', null, 'deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash']) assert.equal(quality.modelConfig(name).model, 'deepseek-flash');
  assert.equal(quality.modelConfig('deepseek-reasoner').thinking.type, 'enabled');
  assert.equal(quality.modelConfig('deepseek-chat').thinking.type, 'disabled');
  assert.equal(quality.modelConfig('deepseek-v4-pro').model, 'deepseek-v4-pro');
  assert.equal(quality.modelConfig('explicit-vision-model').model, 'explicit-vision-model');
});

test('browser requests preserve JSON format, explicit thinking mode and token budget', async () => {
  for (const file of ['js/train.js', 'js/demo.js']) {
    const code = read(file);
    let sent;
    const ctx = context([fn(code, 'modelConfig'), fn(code, 'dsAsk')], {
      hasHost: false, LS_MODEL: 'model', load: () => 'deepseek-chat',
      AbortController, setTimeout, clearTimeout,
      fetch: async (url, opts) => {
        sent = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }) };
      }
    });
    await ctx.dsAsk([{ role: 'user', content: 'JSON' }], 'mock', file.endsWith('train.js') ? 8000 : { json: true, max_tokens: 8000 });
    assert.equal(sent.model, 'deepseek-flash');
    assert.deepEqual(sent.thinking, { type: 'disabled' });
    assert.deepEqual(sent.response_format, { type: 'json_object' });
    assert.equal(sent.max_tokens, 8000);
  }
});

function runContext(responder, onMaterials, opts = {}) {
  const p = { name: '导数', board: 'calc', importance: 3, keywords: ['导数'], content: '数学讲解' };
  const els = { qType: { value: 'single' }, qDiff: { value: '3' }, qSource: { value: '2' }, genBtn: {},
    askInput: { value: '' },
    qaArea: { innerHTML: 'old questions', insertBefore() {}, firstChild: null } };
  const status = [], messages = [], mats = [], cards = [], subjQueries = [];
  if (opts.ask !== undefined) els.askInput.value = opts.ask;
  if (opts.source !== undefined) els.qSource.value = opts.source;
  if (opts.target) Object.assign(p, opts.target);
  const ctx = context(['runGen', 'buildPrompt', 'parseAI', 'validateBatch', 'verifySource',
    'parseYearIntent', 'parseSearchIntent', 'yearTopic', 'pickRealN', 'targetLabel', 'sourceLabels',
    'yearIntentNote', 'subjFilterOf', 'isPickedTarget', 'boardNameOf'].map(n => fn(train, n)), {
    busy: false, curDB: 'curDB' in opts ? opts.curDB : { subject: opts.subject || 'math', subjectName: opts.subjectName || '高中数学', boards: [] }, els,
    // 真实 currentTarget 一定会带 via:'picked'|'sel'|'board'|'ask';桩默认 'sel'(= 主系统当前选中点),
    // 需要"只由输入反推出来的点"时显式传 via:'ask'。
    currentTarget: () => (opts.noTarget ? null : { p, kw: opts.kw, via: opts.via || 'sel' }),
    keyState: () => 'mock-only', tag() {}, setSteps() {},
    setStatus: (s, kind) => status.push({ s, kind }),
    subjMats: async q => { subjQueries.push(q); if (onMaterials) onMaterials(ctx); return []; },
    gkMats: async (query, meta, req) => {
      mats.push({ query, req, meta });
      if (!opts.matsMeta) return [];
      Object.assign(meta, opts.matsMeta);
      return opts.matsHits || [];
    },
    webMats: async () => [],
    dsAsk: async ms => { messages.push(ms); return responder(messages.length); },
    renderQuestions: qs => { els.qaArea.innerHTML = JSON.stringify(qs); },
    document: { createElement: () => ({ set textContent(v) { cards.push(v); }, className: '' }) }
  });
  return { ctx, els, status, messages, mats, cards, subjQueries, p };
}
test('a network failure leaves the previous batch intact and unlocks all controls', async () => {
  const r = runContext(() => { throw new Error('模拟断网'); });
  await r.ctx.runGen();
  assert.equal(r.els.qaArea.innerHTML, 'old questions');
  assert.equal(r.ctx.busy, false);
  assert.equal(r.els.genBtn.disabled, false);
  assert.equal(r.status.at(-1).kind, 'err');
});
test('truncated model output does not trigger repeated paid requests or clear previous questions', async () => {
  const r = runContext(() => ({ ok: true, content: '{', finish_reason: 'length' }));
  await r.ctx.runGen();
  assert.equal(r.messages.length, 1);
  assert.equal(r.els.qaArea.innerHTML, 'old questions');
  assert.equal(r.status.at(-1).kind, 'err');
});
test('malformed responses retry finitely then preserve old questions; a subsequent valid response recovers', async () => {
  const invalid = () => ({ ok: true, content: JSON.stringify({ questions: [null, null, null, null] }) });
  const failed = runContext(invalid);
  await failed.ctx.runGen();
  assert.equal(failed.messages.length, 3);
  assert.equal(failed.els.qaArea.innerHTML, 'old questions');
  const recovered = runContext(n => n === 1 ? invalid() : ({ ok: true, content: JSON.stringify({ questions: [0, 1, 2, 3].map(question) }) }));
  await recovered.ctx.runGen();
  assert.equal(recovered.messages.length, 2);
  assert.notEqual(recovered.els.qaArea.innerHTML, 'old questions');
});
test('no-source fallback uses one AI call; changing subjects mid-request does not change the captured context', async () => {
  const r = runContext(() => ({ ok: true, content: JSON.stringify({ questions: [0, 1, 2, 3].map(question) }) }), ctx => {
    ctx.curDB = { subject: 'eng', subjectName: '高中英语', boards: [] };
  });
  await r.ctx.runGen();
  assert.equal(r.messages.length, 1);
  assert.match(r.messages[0][1].content, /科目:高中数学/);
  assert.match(r.messages[0][1].content, /知识点:导数/);
  assert.doesNotMatch(r.messages[0][1].content, /高中英语/);
  assert.equal(r.ctx.busy, false);
});

test('desktop database acknowledgments resolve independently and do not mutate messages for other listeners', async () => {
  const source = read('js/mainbridge.js');
  const start = source.indexOf('  (function dbAuto() {');
  const end = source.indexOf('  // 自动化测试通道', start);
  const listeners = [], timers = new Map(), sent = [], state = { textContent: '' }, rows = {};
  let timerSeq = 0;
  const ls = storage();
  const win = { CUR_SUBJECT: 'math', addEventListener() {}, MATH_DB: {
    subject: 'math', subjectName: '高中数学', boards: [], points: [{ id: 'x', name: '知识点', keywords: [], content: '正文' }]
  }, chrome: { webview: {
    addEventListener: (type, f) => listeners.push(f),
    postMessage(msg) { sent.push(msg); }
  } } };
  const ctx = context([], { window: win, localStorage: ls,
    document: { getElementById: id => id === 'dbRows' ? rows : id === 'dbState' ? state : { textContent: '数学' } },
    setTimeout: f => { const id = ++timerSeq; timers.set(id, f); return id; },
    clearTimeout: id => timers.delete(id), setInterval() {}
  });
  vm.runInContext(source.slice(start, end), ctx);
  assert.equal(listeners.length, 1);
  win.__dbAuto.stat(); win.__dbAuto.doUpload(false);
  const upload = sent.find(m => m.kind === 'dbAdd');
  const stat = sent.find(m => m.kind === 'dbStat');
  const reply = { _seq: upload._seq, ok: true, points: 1, updated: true };
  listeners[0]({ data: { _seq: 99999, ok: true } });
  listeners[0]({ data: reply });
  await new Promise(setImmediate);
  listeners[0]({ data: { _seq: stat._seq, ok: true, baseBlocks: 12, subjects: [] } });
  await new Promise(setImmediate);
  assert.equal(reply._seq, upload._seq);
  assert.match(state.textContent, /已自动上传/);
  assert.match(rows.innerHTML, /12/);
  assert.ok(ls.getItem('qg_db_digest_math'));
  assert.equal(timers.size, 0);
  win.__dbAuto.doUpload(false);
  assert.equal(sent.filter(m => m.kind === 'dbAdd').length, 1);
});

/* ============================================================
 * 年份检索(「2026」/「2026高考题」/「2026 函数单调性」)与"只给检索词也能搜"
 * ============================================================ */
const yi = context(['parseYearIntent', 'parseSearchIntent', 'yearTopic', 'pickRealN',
  'yearIntentNote', 'sourceLabels', 'subjFilterOf'].map(n => fn(train, n)));
const okBatch = () => ({ ok: true, content: JSON.stringify({ questions: [0, 1, 2, 3].map(question) }) });

test('year intent: a four-digit 1900-2099 year plus an exam-intent word is recognised', () => {
  assert.deepEqual(clone(yi.parseYearIntent('2026高考题')), { year: 2026, intent: true });
  assert.equal(yi.parseYearIntent('2026年高考真题').year, 2026);
  assert.equal(yi.parseYearIntent('2026年高考真题').intent, true);
  assert.equal(yi.parseYearIntent('高考真题 2024 2026').year, 2024, '多个年份取第一个');
  assert.equal(yi.parseYearIntent('1999年高考题').year, 1999, '1900 是下界');
});

test('year intent: lesson numbers, question counts and intent-only queries are not years', () => {
  for (const q of ['第01讲 集合', '4题', '第4讲 三角函数 12题', '导数 1899', '导数 2100', '编号12026']) {
    assert.equal(yi.parseYearIntent(q).year, null, q);
  }
  assert.deepEqual(clone(yi.parseYearIntent('高考真题')), { year: null, intent: true });
  assert.deepEqual(clone(yi.parseYearIntent('一轮复习讲义')), { year: null, intent: false });
});

test('search intent: a bare year dominates, a year plus content words only scopes', () => {
  for (const q of ['2026', '2026年', '2026高考', '2026高考题', '2026年高考真题', '2026 一模', '2026真题卷']) {
    assert.equal(yi.parseSearchIntent(q).mode, 'yearOnly', q);
    assert.equal(yi.parseSearchIntent(q).year, 2026, q);
  }
  for (const q of ['2026 函数单调性', '2026导数压轴', '2026数学', '2026 函数 与 导数']) {
    assert.equal(yi.parseSearchIntent(q).mode, 'yearScope', q);
    assert.ok(yi.parseSearchIntent(q).words.length > 0, q);
  }
  assert.equal(yi.parseSearchIntent('2026 函数单调性').words, '函数单调性');
  assert.equal(yi.parseSearchIntent('2026导数压轴').words, '导数压轴');
  for (const q of ['函数与导数', '第01讲 集合', '高考真题', '']) {
    assert.equal(yi.parseSearchIntent(q).mode, 'none', q);
    assert.equal(yi.parseSearchIntent(q).year, null, q);
  }
  assert.equal(yi.yearTopic(2026, '2026高考题'), '2026 年高考真题');
  assert.equal(yi.yearTopic(2026, '2026一模'), '2026 年模拟题');
});

test('year-only requests take four material questions unless the user chose AI-only', () => {
  assert.equal(yi.pickRealN(2, true), 4);
  assert.equal(yi.pickRealN(4, true), 4);
  assert.equal(yi.pickRealN('', true), 4, '非法值先回退 2,再按年份主导提到 4');
  assert.equal(yi.pickRealN(0, true), 0, '用户选 AI 原创 → 不被覆盖');
  assert.equal(yi.pickRealN(2, false), 2, '年份限定档按用户选择');
  assert.equal(yi.pickRealN(3, false), 2);
});

test('year status text reports the archive honestly: hits, papers taken and a missing year', () => {
  const only = yi.yearIntentNote(2026, { only: 1, filtered: 3666, strict: 537, matched: 537, papers: 12,
    hits: 4, tookYear: 4, yearFrom: 1952, yearTo: 2026, paper: '2026年上海卷(春)原卷.txt' });
  assert.match(only, /识别到你要 2026 年的题:本机档案命中 3666 段,其中 2026年上海卷\(春\)原卷\.txt 等 12 份试卷,已取 4 段作为素材/);
  assert.match(only, /确属 2026 年原卷 537 段/);
  const none = yi.yearIntentNote(2026, { filtered: 3666, strict: 0, matched: 0, papers: 0, hits: 0, yearFrom: 1952, yearTo: 2026 });
  assert.match(none, /本机档案里没有 2026 年的题\(档案年份 1952-2026\)。请换年份,或去掉年份按知识点出题。/);
  const fell = yi.yearIntentNote(2026, { filtered: 3666, strict: 0, matched: 0, papers: 0, hits: 2, yearFrom: 1952, yearTo: 2026 });
  assert.match(fell, /本次取的 2 段来自其他年份,按片段自身年份标注,没有一段标成 2026 年/);
  const scoped = yi.yearIntentNote(2026, { filtered: 3666, strict: 537, matched: 12, hits: 4, tookYear: 4, yearFrom: 1952, yearTo: 2026 });
  assert.match(scoped, /识别到你要 2026 年真题:本机档案 2026 年命中 12 段,已取 4 段作为素材/);
  const stale = yi.yearIntentNote(2026, { filtered: 3666, strict: 537, matched: 12, hits: 4, tookYear: 0 });
  assert.match(stale, /只有 0 段标着 2026 年/);
  const blind = yi.yearIntentNote(2026, { hits: 4, tookYear: 1 });
  assert.match(blind, /未取到本机档案的年份统计/);
  assert.match(blind, /标为 2026 年的有 1 段/);
  // 旧文案是"真题档案检索当前只对数学启用" —— 那是自设闸门(gkLib = subject === 'math')的产物:
  // 档案里 zt/五科真题/ 本来就有语英物化生 2010-2024 的真题(带答案解析),却被这门闸锁在门外。
  // 2026-09-27 起 gkLib 放开,改由 subjFilterOf 把检索锁到当前科目;所以这里只断言"如实说没检索",
  // 不再断言那句已经不成立的理由。
  assert.match(yi.yearIntentNote(2026, { checked: false, why: 'subject' }), /本次未检索本机真题档案/);
  assert.match(yi.yearIntentNote(2026, { checked: false, why: 'source0' }), /你选择了 AI 原创\(素材题数 0\)/);
  // 本科目档案区间优先:物理档案只到 2010-2024,对物理用户说"档案年份 1952-2026"等于把可查
  // 范围说大了(那是整个档案的区间)。宿主回执带 subj{name,blocks,from,to} 时用本科目区间;
  // 没有该字段(旧宿主)时退回整体区间 —— 见 js/train.js 里 yearIntentNote 的 range 逻辑。
  assert.match(
    yi.yearIntentNote(2026, { checked: true, filtered: 100, strict: 0, matched: 0, papers: 0, hits: 0,
      yearFrom: 1952, yearTo: 2026, subjName: '物理', subjBlocks: 230, subjFrom: 2010, subjTo: 2024 }),
    /本机档案里没有 2026 年的题\(物理档案 2010-2024\)/);
  assert.match(
    yi.yearIntentNote(2026, { checked: true, filtered: 100, strict: 0, matched: 0, papers: 0, hits: 0,
      yearFrom: 1952, yearTo: 2026 }),
    /本机档案里没有 2026 年的题\(档案年份 1952-2026\)/, '没有 subj 字段时保持整体区间(不编数字)');
});

test('material source labels are archive file names, deduped and capped with a count', () => {
  const hits = [
    { src: 'zt/全卷解析/2026年上海卷(春)原卷.txt\r' },
    { src: 'zt/全卷解析/2026年上海卷(春)原卷.txt\r' },
    { src: 'zt/全卷解析/2026年北京卷解析.txt' },
    { src: 'zt/全卷解析/2026年天津卷解析.txt' },
    { src: 'zt/全卷解析/2026年全国I卷解析.txt' }
  ];
  assert.equal(yi.sourceLabels(hits, 3), '2026年上海卷(春)原卷.txt · 2026年北京卷解析.txt · 2026年天津卷解析.txt 等 4 段');
  assert.equal(yi.sourceLabels(hits, 1), '2026年上海卷(春)原卷.txt 等 4 段');
  assert.equal(yi.sourceLabels([{ title: '某网页' }], 3), '某网页');
  assert.equal(yi.sourceLabels([], 3), '');
});

test('searching a bare year drives the retrieval: no knowledge point in the query, prompt and status say so', async () => {
  const r = runContext(okBatch, null, {
    ask: '2026', kw: '2026', noTarget: true,
    matsMeta: { filtered: 3666, strict: 537, matched: 537, papers: 12, yearFrom: 1952, yearTo: 2026, fallback: false, yearOnly: true, year: 2026 },
    matsHits: [{ year: 2026, src: 'zt/全卷解析/2026年上海卷(春)原卷.txt', text: '2026 年真题原文' }]
  });
  await r.ctx.runGen();
  assert.equal(r.mats.length, 1);
  assert.equal(r.mats[0].query, '2026', '年份主导时检索式就是年份本身');
  assert.equal(r.mats[0].req.year, 2026);
  assert.equal(r.mats[0].req.yearOnly, true);
  assert.match(r.messages[0][0].content, /点名要 2026 年的\(高考\/试卷类\)真题/);
  assert.match(r.messages[0][0].content, /年份整卷"模式:用户要的是 2026 年那一套卷子\(不是某个知识点的专项题\)/);
  assert.match(r.messages[0][0].content, /不得凭记忆写 2026 年真题/);
  assert.match(r.messages[0][0].content, /不能凭年份认证来源/, '既有硬规则不能被年份锚定挤掉');
  assert.match(r.messages[0][0].content, /禁止凭记忆伪造真题/);
  assert.match(r.messages[0][1].content, /本次忽略当前知识点/);
  assert.doesNotMatch(r.messages[0][1].content, /知识点:导数/, '年份检索不拼当前知识点');
  assert.match(r.status[0].s, /按年份整卷检索,本次忽略当前知识点/);
  const last = r.status.at(-1).s;
  assert.match(last, /因指定年份,已把素材题数提到 4 题/);
  assert.match(last, /识别到你要 2026 年的题:本机档案命中 3666 段,其中 2026年上海卷\(春\)原卷\.txt 等 12 份试卷,已取 1 段作为素材/);
  assert.ok(r.cards.some(c => /素材来源:2026年上海卷\(春\)原卷\.txt/.test(c)), '素材来源要显示给用户');
});

test('a selected knowledge point never leaks into a bare-year query', async () => {
  const r = runContext(okBatch, null, {
    ask: '2026', noTarget: false,
    matsMeta: { filtered: 3666, strict: 537, matched: 537, papers: 12, yearFrom: 1952, yearTo: 2026 },
    matsHits: [{ year: 2026, src: 'zt/全卷解析/2026年北京卷解析.txt', text: '2026 北京卷原文' }]
  });
  await r.ctx.runGen();
  assert.equal(r.mats[0].query, '2026');
  assert.doesNotMatch(r.mats[0].query, /导数/, '主系统选中点也不参与年份检索');
  assert.match(r.status[0].s, /识别到你要 2026 年的题/);
  assert.match(r.cards.find(c => /本批次/.test(c)), /本批次:高中数学 · 2026 年高考真题/);
});

test('a year plus content words only scopes the year and keeps the user choice of material count', async () => {
  const r = runContext(okBatch, null, {
    ask: '2026 函数单调性', noTarget: true,
    matsMeta: { filtered: 3666, strict: 537, matched: 4, papers: 3, yearFrom: 1952, yearTo: 2026 },
    matsHits: [{ year: 2026, src: 'zt/全卷解析/2026年全国I卷解析.txt', text: '2026 全国I卷原文' }]
  });
  await r.ctx.runGen();
  assert.equal(r.mats[0].query, '2026 函数单调性');
  assert.equal(r.mats[0].req.yearOnly, false);
  assert.match(r.messages[0][1].content, /2026 年 \+ 函数单调性/);
  assert.doesNotMatch(r.messages[0][1].content, /知识点:导数/);
  assert.doesNotMatch(r.status.at(-1).s, /素材题数提到 4 题/, '限定档按用户选择(默认 2)');
  assert.match(r.status.at(-1).s, /识别到你要 2026 年真题:本机档案 2026 年命中 4 段,已取 1 段作为素材/);
});

test('without a year the user input drives retrieval; the selected point only biases the prompt', async () => {
  // 用户口径:「出题由输入的内容决定,只有显式选择了知识点才让知识点做偏向」。
  // 旧行为是把"知识点名 + 关键词"拼在输入前面(搜「函数与导数」→ 检索式「导数 导数 函数与导数」),
  // 于是用户随便打一句话,出题范围都被悄悄换成那个知识点。
  const r = runContext(okBatch, null, { ask: '函数与导数', kw: '函数与导数', via: 'sel' });
  await r.ctx.runGen();
  assert.equal(r.mats[0].query, '函数与导数', '输入优先:检索式 = 用户输入原文');
  assert.doesNotMatch(r.mats[0].query, /^导数 /, '不再前置知识点名/关键词');
  assert.equal(r.mats[0].req.year, 0);
  assert.equal(r.mats[0].req.yearOnly, false);
  const user = r.messages[0][1].content;
  assert.doesNotMatch(user, /知识点:导数/, '显式选点 + 有输入时,不再以知识点为主因');
  assert.match(user, /【可选偏向,不是命题范围】导数\(板块:calc · 重要度 ★3\/5\)/);
  assert.match(user, /用户输入决定本批的范围与主题/);
  assert.match(user, /不得把它当成命题范围/);
  assert.match(user, /两者冲突时以用户输入为准/);
  assert.deepEqual(r.subjQueries, ['导数'], '显式选点仍可取该点讲解素材(它是"偏向"材料)');
  assert.doesNotMatch(r.status.at(-1).s, /素材题数提到 4 题/);
  assert.equal(r.status.at(-1).kind, 'warn', '无素材时的既有提示不变');
});

test('a year the archive does not have is reported as missing instead of faked from other years', async () => {
  const r = runContext(okBatch, null, {
    ask: '2050高考题', noTarget: true,
    matsMeta: { filtered: 0, strict: 0, matched: 0, papers: 0, yearFrom: 1952, yearTo: 2026, fallback: true },
    matsHits: [{ year: 2023, src: 'zt/全卷解析/2023年全国甲卷.txt', text: '其他年份素材' }]
  });
  await r.ctx.runGen();
  const last = r.status.at(-1).s;
  assert.match(last, /识别到你要 2050 年的题:本机档案里没有 2050 年的题\(档案年份 1952-2026\)。请换年份,或去掉年份按知识点出题。/);
  assert.match(last, /本次取的 1 段来自其他年份,按片段自身年份标注,没有一段标成 2050 年/);
  assert.match(r.messages[0][1].content, /本机档案里没有 2050 年的题\(档案年份 1952-2026\)/);
  assert.match(r.messages[0][1].content, /不得把任何题目说成\/标成 2050 年/);
});

test('an explicit AI-only choice is not overridden by a year query', async () => {
  const r = runContext(okBatch, null, {
    ask: '2026高考题', noTarget: true, source: '0',
    matsMeta: { filtered: 3666, strict: 537, matched: 537, papers: 12, yearFrom: 1952, yearTo: 2026 },
    matsHits: [{ year: 2026, src: 'zt/x.txt', text: 'y' }]
  });
  await r.ctx.runGen();
  assert.equal(r.mats.length, 0, '选了 AI 原创就不该去检索本机真题档案');
  const last = r.status.at(-1).s;
  assert.doesNotMatch(last, /素材题数提到 4 题/);
  assert.match(last, /识别到你要 2026 年的题:你选择了 AI 原创\(素材题数 0\),本次未检索本机真题档案/);
  assert.match(r.messages[0][1].content, /用户选择了 AI 原创\(素材题数 0\),本次未检索本机真题档案/);
});

test('a search-only query with no knowledge point is allowed; an empty one is refused with a hint', async () => {
  const searched = runContext(okBatch, null, { ask: '导数新题型', noTarget: true });
  await searched.ctx.runGen();
  assert.equal(searched.messages.length, 1, '只给检索词也要能出题');
  assert.equal(searched.mats[0].query, '导数新题型', '无知识点时检索式就是搜索框原话');
  // 状态栏必须说清这批按什么出题:只给了输入 → "按你说的「…」出题(未选知识点)"
  assert.match(searched.status[0].s, /按你说的「导数新题型」出题\(未选知识点\)/);
  assert.match(searched.messages[0][1].content, /知识点:未指定\(用户只输入了检索式/);
  assert.match(searched.messages[0][1].content, /素材为空时如实说明/);

  const empty = runContext(okBatch, null, { ask: '', noTarget: true });
  await empty.ctx.runGen();
  assert.equal(empty.messages.length, 0);
  assert.equal(empty.mats.length, 0);
  assert.equal(empty.status.at(-1).kind, 'warn');
  assert.match(empty.status.at(-1).s, /请输入要搜的题\(例如:2026高考题\),或在主系统点选知识点/);
});

/* ============================================================
 * 出题口径:「出题由输入的内容决定,只有显式选择了知识点才让知识点做偏向」
 *   —— 输入优先(硬) / 知识点降级为"偏向"(软) / 只有"选点 + 空输入"才回到按知识点出题。
 * 这一组是本轮改动的核心证据:旧口径下(改前)前两条必红(检索式会被拼成
 * "法拉第电磁感应定律 磁通量变化率 感应电动势 电磁感应 楞次定律",提示词里出现
 * "知识点:法拉第电磁感应定律"、系统提示词写死"围绕给定知识点")。
 * ============================================================ */
const EMF = { name: '法拉第电磁感应定律', board: 'em', importance: 4, core: 4,
  keywords: ['磁通量变化率', '感应电动势'],
  content: '甲'.repeat(600) + '<这段超过 600 字,只应出现在"按知识点出题"那一档>' };

test('input-first: with no picked point the query is the raw input and the prompt has no knowledge point', async () => {
  const r = runContext(okBatch, null, {
    ask: '电磁感应 楞次定律', kw: '电磁感应 楞次定律', via: 'ask', target: EMF,
    subject: 'physics', subjectName: '高中物理',
    matsMeta: {}, matsHits: [{ year: 0, src: 'zt/全卷解析/某原卷.txt', text: '素材原文片段。' }]
  });
  await r.ctx.runGen();
  assert.equal(r.mats[0].query, '电磁感应 楞次定律', '检索式 = 用户输入原文(一个字都不加)');
  assert.doesNotMatch(r.mats[0].query, /法拉第电磁感应定律|磁通量变化率|感应电动势/,
    '由输入反推出来的点不得进入检索式');
  const sys = r.messages[0][0].content, user = r.messages[0][1].content;
  assert.doesNotMatch(user, /知识点/, '未选择知识点时,提示词里不出现"知识点"');
  assert.doesNotMatch(user, /法拉第电磁感应定律/);
  assert.doesNotMatch(sys, /围绕给定知识点/);
  assert.match(sys, /任务:按用户输入的范围与主题命制一组高质量训练题/);
  assert.match(sys, /本批的范围与主题由用户在搜索框里写的内容「电磁感应 楞次定律」决定/);
  assert.deepEqual(r.subjQueries, [], '不取该点讲解素材');
  assert.match(r.status[0].s, /按你说的「电磁感应 楞次定律」出题\(未选知识点\)/);
});

test('input-first: a picked point only biases the prompt and never moves the query', async () => {
  const r = runContext(okBatch, null, {
    ask: '电磁感应 楞次定律', kw: '电磁感应 楞次定律', via: 'sel', target: EMF,
    subject: 'physics', subjectName: '高中物理', matsMeta: {}
  });
  await r.ctx.runGen();
  assert.equal(r.mats[0].query, '电磁感应 楞次定律', '显式选点也不改检索式:仍以输入为准');
  assert.doesNotMatch(r.mats[0].query, /法拉第电磁感应定律|磁通量变化率/);
  const sys = r.messages[0][0].content, user = r.messages[0][1].content;
  assert.doesNotMatch(user, /知识点:法拉第电磁感应定律/, '不能再出现"知识点:X"这种命题范围字段');
  const at = user.indexOf('【可选偏向,不是命题范围】');
  assert.ok(at > 0, '降级说明必须在要点之前');
  const spots = [...user.matchAll(/法拉第电磁感应定律/g)].map(m => m.index);
  assert.ok(spots.length > 0 && spots.every(i => i >= at), '点名只允许出现在"偏向"说明里');
  assert.match(user, /只用于偏向其角度、相关考点与常见考法/);
  assert.match(user, /不得把它当成命题范围,不得用它替换或收窄用户输入的主题;两者冲突时以用户输入为准/);
  assert.match(user, /仅作参考的要点摘录,不是命题范围/);
  assert.equal(user.indexOf('这段超过 600 字'), -1, '要点摘录收到 600 字,不许压过用户那一句输入');
  assert.match(user, /甲{600}/, '要点本身仍然保留(它只是降级为参考)');
  assert.doesNotMatch(sys, /任务:围绕给定知识点命制/);
  assert.match(sys, /不得把它当成命题范围,不得用它替换或收窄用户输入的主题;两者冲突时以用户输入为准/);
  assert.deepEqual(r.subjQueries, ['法拉第电磁感应定律'], '显式选点仍可取该点讲解素材');
  assert.match(r.status[0].s, /按你说的「电磁感应 楞次定律」出题,偏向知识点:法拉第电磁感应定律/);
  assert.match(r.status[0].s, /本批范围由你的输入决定,知识点「法拉第电磁感应定律」只作偏向/);
});

test('point-driven only when nothing was typed: the picked point keeps its full excerpt and materials', async () => {
  const r = runContext(okBatch, null, { ask: '', via: 'sel', target: EMF, subject: 'physics', subjectName: '高中物理' });
  await r.ctx.runGen();
  assert.equal(r.mats[0].query, '法拉第电磁感应定律 磁通量变化率 感应电动势', '输入为空 → 回到按知识点拼检索式');
  const sys = r.messages[0][0].content, user = r.messages[0][1].content;
  assert.match(user, /知识点:法拉第电磁感应定律/);
  assert.match(user, /知识点要点\(节选\):/);
  assert.match(user, /这段超过 600 字/, '这一档保留原有 1600 字上限(知识点是唯一依据)');
  assert.match(sys, /任务:围绕给定知识点命制/);
  assert.doesNotMatch(user, /可选偏向/);
  assert.deepEqual(r.subjQueries, ['法拉第电磁感应定律'], 'subjMats 照取');
  assert.match(r.status[0].s, /按知识点 法拉第电磁感应定律 出题\(你没写关键词\)/);
});

test('the two year tiers are untouched by the input-first rule', async () => {
  const bare = runContext(okBatch, null, {
    ask: '2026', kw: '2026', via: 'sel', target: EMF,
    matsMeta: { filtered: 3666, strict: 537, matched: 537, papers: 12, yearFrom: 1952, yearTo: 2026 },
    matsHits: [{ year: 2026, src: 'zt/全卷解析/2026年上海卷(春)原卷.txt', text: '2026 年真题原文' }]
  });
  await bare.ctx.runGen();
  assert.equal(bare.mats[0].query, '2026', '年份主导:检索式只含年份与意图词');
  assert.equal(bare.mats[0].req.yearOnly, true);
  assert.doesNotMatch(bare.messages[0][1].content, /法拉第电磁感应定律/, '年份档仍然忽略当前知识点');
  assert.deepEqual(bare.subjQueries, []);
  const scoped = runContext(okBatch, null, {
    ask: '2026 函数单调性', kw: '2026 函数单调性', via: 'sel', target: EMF,
    matsMeta: { filtered: 3666, strict: 537, matched: 4, papers: 3, yearFrom: 1952, yearTo: 2026 },
    matsHits: [{ year: 2026, src: 'zt/全卷解析/2026年全国I卷解析.txt', text: '2026 全国I卷原文' }]
  });
  await scoped.ctx.runGen();
  assert.equal(scoped.mats[0].query, '2026 函数单调性');
  assert.equal(scoped.mats[0].req.yearOnly, false);
  assert.match(scoped.messages[0][1].content, /2026 年 \+ 函数单调性/);
  assert.doesNotMatch(scoped.messages[0][1].content, /法拉第电磁感应定律/);
});

test('the pick test is one shared rule: ask is never a pick, picked/sel/board always are', () => {
  const { isPickedTarget } = context(['isPickedTarget'].map(n => fn(train, n)));
  const p = { name: 'X' };
  for (const via of ['picked', 'sel', 'board']) assert.equal(isPickedTarget({ p, via }), true, via);
  assert.equal(isPickedTarget({ p, via: 'ask' }), false, '由输入反推出来的点不算"选择"');
  assert.equal(isPickedTarget({ p, via: undefined }), false);
  assert.equal(isPickedTarget({ p: null, via: 'sel' }), false);
  assert.equal(isPickedTarget(null), false);
});

test('a missing subject database still refuses to run, with the original hint', async () => {
  const r = runContext(okBatch, null, { ask: '2026高考题', noTarget: true, curDB: null });
  await r.ctx.runGen();
  assert.equal(r.messages.length, 0);
  assert.equal(r.mats.length, 0);
  assert.equal(r.status.at(-1).kind, 'warn');
  assert.match(r.status.at(-1).s, /先选目标:在主系统点选知识点,或输入关键词并定位/);
});

test('the target line says which basis the batch uses: input first, a picked point only as bias', () => {
  const els = { targetInfo: { innerHTML: '' }, askInput: { value: '2026高考题' } };
  const ctx = context(['esc', 'parseYearIntent', 'parseSearchIntent', 'yearTopic', 'renderTarget',
    'isPickedTarget', 'boardNameOf'].map(n => fn(train, n)),
    { els, curDB: { boards: [{ id: 'em', name: '电磁感应' }] }, live: { selName: '' } });
  // ① 年份档:提示文案保持原样(本次忽略当前知识点)
  ctx.renderTarget(null);
  assert.match(els.targetInfo.innerHTML, /检索式:<b>2026高考题<\/b> ｜ 2026 年高考真题 ｜ 已按年份检索,本次忽略当前知识点/);
  // ② 只给了输入、没选知识点
  els.askInput.value = '函数与导数';
  ctx.renderTarget(null);
  assert.match(els.targetInfo.innerHTML, /按你说的「<b>函数与导数<\/b>」出题\(未选知识点\)/);
  // ③ via==='ask'(由输入反推出来的点)不算"选择":不能显示成"目标:导数"
  ctx.renderTarget({ p: { name: '法拉第电磁感应定律', board: 'em', importance: 4, keywords: ['磁通量'], core: 4 }, via: 'ask', matched: 1 });
  assert.match(els.targetInfo.innerHTML, /按你说的「<b>函数与导数<\/b>」出题\(未选知识点\)/);
  assert.doesNotMatch(els.targetInfo.innerHTML, /偏向知识点/);
  assert.match(els.targetInfo.innerHTML, /检索命中的「法拉第电磁感应定律」不作为命题范围/);
  // ④ 显式选择了知识点 + 有输入 → 输入出题,知识点只作"偏向"
  els.askInput.value = '电磁感应 楞次定律';
  ctx.renderTarget({ p: { name: '法拉第电磁感应定律', board: 'em', importance: 4, keywords: ['磁通量'], core: 4 }, via: 'sel' });
  assert.match(els.targetInfo.innerHTML, /按你说的「<b>电磁感应 楞次定律<\/b>」出题,偏向知识点:<b>法拉第电磁感应定律<\/b>/);
  assert.match(els.targetInfo.innerHTML, /不是命题范围/);
  // ⑤ 只选了知识点、没写关键词 → 知识点是唯一依据
  els.askInput.value = '';
  ctx.renderTarget({ p: { name: '法拉第电磁感应定律', board: 'em', importance: 4, keywords: ['磁通量'], core: 4 }, via: 'sel' });
  assert.match(els.targetInfo.innerHTML, /按知识点 <b>法拉第电磁感应定律<\/b> 出题\(你没写关键词\) ｜ 板块:电磁感应/);
  // ⑥ 既没输入也没选点 → 空
  ctx.renderTarget(null);
  assert.equal(els.targetInfo.innerHTML, '');
});

test('desktop host filters by year, prefers real papers and logs the decision', () => {
  const host = fs.readFileSync(path.join(root, '桌面版/build/Program.cs'), 'utf8');
  // 年份必须是 1900-2099 的四位数,且两侧不能顶数字(不误判 第01讲 / 4题 / 12026)
  assert.ok(host.includes('(?<!\\d)(?:19|20)\\d{2}(?!\\d)'), '查询年份正则');
  assert.ok(host.includes('" year=" + qYear + " intent=" + (qIntent ? "真题" : "-")'), 'MATS 日志带 year=/intent=');
  assert.ok(host.includes('" filtered=" + yearCand'), 'MATS 日志带 filtered=');
  assert.ok(host.includes('year = qYear, intent = qIntent, yearMode = yearMode, yearOnly = qYearOnly'), '年份识别结果要回给页面');
  assert.ok(host.includes('filtered = yearCand, strict = yearStrict'), '候选数/真原卷数要回给页面');
  // 只有"自身年份 == 目标年份"的块能当该年份素材(合集目录名带年份的不算)
  assert.ok(host.includes('bool inYear = limitYear && BlockYearOfHead(head) == qYear;'));
  assert.ok(host.includes('if (limitYear && !inYear) continue;'));
  // 年份主导档不按关键词过滤,且试卷优先
  assert.ok(host.includes('scores[i] = (IsPaperHead(head) ? 100000.0 : 0.0) + BlockWeight(b);'));
  assert.ok(host.includes('原卷|真题|全卷解析|解析|全国卷|新高考|上海卷|北京卷|天津卷|浙江卷|模拟|一模|二模'), '试卷优先标记');
});

test('subject names map to the archive folders; math deliberately maps to nothing', () => {
  // 五科真题档案按 zt/五科真题/<中文科目>/ 分目录;数学散在 zt/全卷解析、zt/版本2、jyfs、yl、gs。
  // 所以"中文科目名"是给宿主的唯一线索:有名字 → 只查那一科;没名字(数学) → 排除五科档案。
  const { subjFilterOf } = context(['subjFilterOf'].map(n => fn(train, n)), {});
  assert.equal(subjFilterOf('高中物理'), '物理');
  assert.equal(subjFilterOf('高中英语'), '英语');
  assert.equal(subjFilterOf('高中化学'), '化学');
  assert.equal(subjFilterOf('高中生物'), '生物');
  assert.equal(subjFilterOf('高中数学'), '', '数学档案不在五科目录下,空串表示"排除五科"');
  assert.equal(subjFilterOf(''), '');
  assert.equal(subjFilterOf(undefined), '');
});

test('every subject searches its own archive now: gkLib is open and the request carries the subject', async () => {
  // 旧行为:gkLib = (subject === 'math') —— 学科网档案里明明有语英物化生的真题(2010-2024,带答案解析),
  // 却被这门闸锁在门外,界面还会显示"真题档案检索当前只对数学启用"。这条断言把放开后的行为钉住。
  const valid = () => ({ ok: true, content: JSON.stringify({ questions: [0, 1, 2, 3].map(question) }) });
  const phy = runContext(valid, null, { subject: 'physics', subjectName: '高中物理' });
  await phy.ctx.runGen();
  assert.equal(phy.mats.length, 1, '物理也要查本机真题档案(旧行为是 0 次)');
  assert.equal(phy.mats[0].req.subj, '物理', '请求要带中文科目,宿主据此只查 zt/五科真题/物理/');
  assert.equal(phy.ctx.busy, false);

  const math = runContext(valid, null, { subject: 'math', subjectName: '高中数学' });
  await math.ctx.runGen();
  assert.equal(math.mats.length, 1);
  assert.equal(math.mats[0].req.subj, '', '数学不带科目名 → 宿主按"排除五科档案"处理');
});

test('the desktop host scopes the archive by subject so materials can never mix subjects', () => {
  const host = fs.readFileSync(path.join(root, '桌面版/build/Program.cs'), 'utf8');
  assert.ok(host.includes('string subjNeed = subjFilter.Length > 0 ? "五科真题/" + subjFilter + "/" : "";'),
    '五科:素材路径必含该科目录');
  assert.ok(host.includes('bool subjSkipWuKe = subjFilter.Length == 0;'), '数学:页面不带科目名');
  assert.ok(host.includes('if (b.IndexOf(subjNeed, StringComparison.Ordinal) < 0) continue;'), '五科:筛掉别的科目');
  assert.ok(host.includes('else if (subjSkipWuKe && b.IndexOf("五科真题/", StringComparison.Ordinal) >= 0) continue;'),
    '数学:排除五科档案(否则数学查询会捞到物理/化学片段)');
  // 实测口径(2026-09-27,语料 49,945,760 B / 37,249 块):五科真题 3,991 块 =
  // 语文 947 + 英语 1,994 + 物理 230 + 化学 393 + 生物 427;数学(subj 为空)命中其余 33,258 块。
});

/* ============================================================
 * 物理沙盒 js/psandbox.js 的纯逻辑 —— 2026-10-01 本轮新增的几块都在这里补断言:
 *   ① 手写分数(÷):落格判定 / ±DIV_HYS 迟滞 / 归位 / divInfo 结构读数 / DIV_MBAR 横线宽度
 *   ② 箭头吸附到"式子的右边"(arrowSnapPos / arrowFindHost)
 *   ③ 击穿空气的 BREAK_M 算术(E = U/(d_px·BREAK_M) ≥ 3e6 ⇔ d_px ≤ U/0.3)
 *   ④ canMerge 里"箭头不许并进体"那道闸门 + 手写分数的 divFree 例外
 * 做法与本文件既有风格一致:**函数/常量原样从源码里切出来**(不手抄改写过的副本),
 * 配假依赖跑。两点差异:psandbox 的函数都在 IIFE 里(缩进 4 空格),上面的 fn() 切不动;
 * divInfo 是对象字面量里的方法(单独切)。抽取器切完立刻 vm.Script 语法校验,切歪了当场炸。
 * ============================================================ */
const psandbox = read('js/psandbox.js');

// 原样切一个 psandbox 函数(isMass 那种单行写法也认);切完语法校验,不许静默跑半截
function fnPs(name) {
  const start = psandbox.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);
  const head = psandbox.slice(start, psandbox.indexOf('\n', start));
  const text = head.trimEnd().endsWith('}') ? head
    : psandbox.slice(start, psandbox.indexOf('\n    }', start) + 6);
  assert.ok(text.trimEnd().endsWith('}'), 'unterminated function ' + name);
  new vm.Script(text, { filename: 'psandbox:' + name });
  return text;
}
// 从源码里读常量的**值**(数字或单引号字符串) —— 改了源码里的数,下面的断言就跟着动
function psConst(name) {
  const m = psandbox.match(new RegExp('(?:var|,)\\s+' + name + "\\s*=\\s*('(?:\\\\.|[^'])*'|[^,;]+)"));
  assert.ok(m, 'missing constant ' + name);
  return vm.runInNewContext('(' + m[1].trim() + ')');
}
// 符号常量(OPEN/CLOSE/…/DIV/HALF/MU 与九个希腊字母)在源码里是**连着一整段**声明的,
// 整段原样切出来最省事、也最不会漏(公式表 EQUATIONS 里到处是它们)
const PS_SYMBOLS = (() => {
  const a = psandbox.indexOf("    var OPEN = '(', CLOSE = ')'");
  const b = psandbox.indexOf('\n', psandbox.indexOf('    var EPS = ', a));
  assert.ok(a > 0 && b > a, 'psandbox: 符号常量块切片');
  const text = psandbox.slice(a, b);
  new vm.Script(text, { filename: 'psandbox:symbols' });
  return text;
})();
// 公式表(EQUATIONS + 按字母多重集建索引的那个 IIFE)也原样切出来 —— canMerge 的字母数上限要遍历它
const PS_EQ_TABLE = (() => {
  const a = psandbox.indexOf('    var EQUATIONS = [');
  const b = psandbox.indexOf('\n    ];', a) + 6;
  const c = psandbox.indexOf('    var EQ_BY_SIG = {};');
  const d = psandbox.indexOf('\n    })();', c) + 10;
  assert.ok(a > 0 && b > a && c > b && d > c, 'psandbox: 公式表切片');
  const text = psandbox.slice(a, b) + '\n' + psandbox.slice(c, d);
  new vm.Script(text, { filename: 'psandbox:EQUATIONS' });
  return text;
})();

/* ---------- ① 手写分数(÷) ---------- */
// 落格/迟滞/归位/读数要用到的原函数 + 真 slot(不是假件:体给 x/y/th/sc 就能算出世界坐标)
function psDivCtx(over = {}) {
  const g = { DIV: psConst('DIV'), DIV_HYS: psConst('DIV_HYS'), bodies: [], divHiB: null };
  return context(['divMembers', 'slot', 'divBarRect', 'divZoneOf', 'divTurnOn', 'divPreviewFor'].map(fnPs),
    { ...g, ...over });
}
// 一个"手写分数体":横线 40px 宽、世界中心 (200,100)
function psDivBody(mem = [], over = {}) {
  const bar = { type: psConst('DIV'), ch: psConst('DIV'), sx: 0, sy: 0, w: 40, dead: false };
  return { x: 200, y: 100, th: 0, sc: 1, mem: mem.concat([bar]), massG: null,
    div: { on: true, bar, hi: null }, st: { bar }, ...over };
}

test('÷ 落格判定:横线矩形内分上下(压线归分子),两端之外分前后项,横线没了就 null', () => {
  const ctx = psDivCtx();
  const B = psDivBody();
  // 横线矩形(世界坐标):中心 (200,100)、宽 40 → x ∈ [180,220]
  assert.deepEqual(clone(ctx.divBarRect(B)), { cx: 200, cy: 100, left: 180, right: 220, y: 100, w: 40 });
  assert.equal(ctx.divZoneOf(B, 200, 99), 'num', '横线上方 → 分子');
  assert.equal(ctx.divZoneOf(B, 200, 101), 'den', '横线下方 → 分母');
  assert.equal(ctx.divZoneOf(B, 200, 100), 'num', '正好压在横线上 → 取上方(源码注释③)');
  assert.equal(ctx.divZoneOf(B, 179, 100), 'left', '左端之外 → 前方项');
  assert.equal(ctx.divZoneOf(B, 221, 100), 'right', '右端之外 → 后方项');
  assert.equal(ctx.divZoneOf(B, 180, 100), 'num', '端点之内(含端点)');
  assert.equal(ctx.divZoneOf(B, 220, 103), 'den', '端点之内(含端点),另一侧');
  assert.equal(ctx.divZoneOf(B, 200, -1000), 'num', '只按在横线哪一侧分,竖向不封顶(远近由调用方管)');
  assert.equal(ctx.divZoneOf(B, 200, 1000), 'den');
  // 缩放:落格判定跟着 sc 走(体放大 2 倍 → 横线也宽一倍,160 就该算"之内"了)
  assert.equal(ctx.divZoneOf(psDivBody([], { sc: 2 }), 160, 99), 'num');
  assert.equal(ctx.divZoneOf(psDivBody([], { sc: 2 }), 159, 99), 'left');
  // 没有横线(÷ 被拆走 / 死了 / 还没落上)→ null:调用方据此不归格,字形维持原状
  assert.equal(ctx.divZoneOf({ div: null, st: { bar: null }, sc: 1 }, 200, 99), null);
  assert.equal(ctx.divZoneOf({ div: { on: false, bar: {} }, st: { bar: {} }, sc: 1 }, 200, 99), null);
  const dead = psDivBody(); dead.st.bar.dead = true;
  assert.equal(ctx.divZoneOf(dead, 200, 99), null);
  assert.equal(ctx.divBarRect({ div: { on: true }, st: {}, sc: 1 }), null, 'st.bar 缺失也不许抛');
});

test('÷ 拖动预览的迟滞:横线 ±DIV_HYS 窄带里沿用上一次高亮,出了带子才换格', () => {
  const HYS = psConst('DIV_HYS');
  assert.equal(HYS, 2, 'DIV_HYS 就是源码里那个迟滞半带(px)');
  const ctx = psDivCtx();
  const B = psDivBody();
  ctx.bodies.push(B);
  ctx.divPreviewFor({ wx: 200, wy: 100 + HYS });
  assert.equal(B.div.hi, 'den', '第一次落在带里:还没有"上一次",按原始落格取分母');
  ctx.divPreviewFor({ wx: 200, wy: 100 - HYS });
  assert.equal(B.div.hi, 'den', '仍在带内(差 ' + HYS + 'px)→ 不许翻成分子,否则会在线上反复横跳');
  ctx.divPreviewFor({ wx: 200, wy: 100 - HYS - 1 });
  assert.equal(B.div.hi, 'num', '出了带子(差 ' + (HYS + 1) + 'px)才换格');
  ctx.divPreviewFor({ wx: 200, wy: 100 + HYS });
  assert.equal(B.div.hi, 'num', '从分子那一侧回到带内 → 仍是分子(带子双向:只有出带才换格)');
  ctx.divPreviewFor({ wx: 200, wy: 100 + HYS + 1 });
  assert.equal(B.div.hi, 'den', '出带且落在横线下方 → 换成分母');
  ctx.divPreviewFor({ wx: 200 - 60, wy: 100 });
  assert.equal(B.div.hi, 'den', '迟滞只看竖直距离 —— 贴在横线这一行上不切前后项');
  ctx.divPreviewFor({ wx: 200 - 60, wy: 100 + HYS + 1 });
  assert.equal(B.div.hi, 'left', '竖向出带 + 落在左端之外 → 前方项');
  ctx.divPreviewFor({ wx: 200 + 151, wy: 100 });
  assert.equal(B.div.hi, null, '离横线中心 151px > 150px 吸附圈 → 高亮清空');
  // 负对照(真跑,不是注释):把迟滞半带改成 0,同样两步立刻翻格 ——
  // 上面第二条断言就是靠这个 ±DIV_HYS 带子成立的,迟滞一去掉它必红。
  const ctl = psDivCtx({ DIV_HYS: 0 });
  const B2 = psDivBody();
  ctl.bodies.push(B2);
  ctl.divPreviewFor({ wx: 200, wy: 102 });
  ctl.divPreviewFor({ wx: 200, wy: 98 });
  assert.equal(B2.div.hi, 'num', '负对照:DIV_HYS=0 时同样的移动会翻成分子');
});

test('第一个 ÷ 落到体上:老字母按线以上/以下归分子分母,多出来的 ÷ 排到后方项', () => {
  const DIV = psConst('DIV');
  const ctx = psDivCtx();
  const a = { type: 'A', sx: 0, sy: -20, dead: false };      // 世界 y=80(线以上)
  const b = { type: 'B', sx: 0, sy: 20, dead: false };       // 世界 y=120(线以下)
  const gone = { type: 'Z', sx: 0, sy: -30, dead: true };    // 已拆掉
  const bar = { type: DIV, sx: 0, sy: 0, w: 40, dead: false, wy: 100 };
  const B = { x: 200, y: 100, th: 0, sc: 1, mem: [a, b, gone], massG: null };
  ctx.divTurnOn(B, bar);
  assert.equal(B.div.on, true);
  assert.equal(B.div.bar, bar);
  assert.equal(bar.dz, 'bar');
  assert.equal(a.dz, 'num', '线以上 → 分子');
  assert.equal(b.dz, 'den', '线以下 → 分母');
  assert.equal(gone.dz, undefined, 'dead 字形不归格');
  // 归位在松手那一刻落定:再叫一次不重算(体一变形就把摆好的字母重新分类是既有纪律①)
  a.dz = 'left';
  ctx.divTurnOn(B, bar);
  assert.equal(a.dz, 'left', '已在手写分数模式 → 直接返回,不动已落定的格子');
  assert.equal(b.dz, 'den');
  // 多出来的 ÷:当行内字形排在"后方项",横线永远是第一个
  const bar2 = { type: DIV, sx: 0, sy: 0, w: 40, dead: false, wy: 100 };
  ctx.divTurnOn(B, bar2);
  assert.equal(bar2.dz, 'right');
  assert.equal(B.div.bar, bar, '横线黏住不换');
  // 已经在 mem 里的另一个 ÷ 一样排到后方项
  const bar3 = { type: DIV, sx: 0, sy: 0, w: 40, dead: false, wy: 100 };
  const barNew = { type: DIV, sx: 0, sy: 0, w: 40, dead: false, wy: 100 };
  const C = { x: 200, y: 100, th: 0, sc: 1, mem: [bar3], massG: null };
  ctx.divTurnOn(C, barNew);
  assert.equal(bar3.dz, 'right');
  // 没有落点记录(wy == null)→ 一律进分子(唯一可预测的默认)
  const d2 = { type: 'D', sx: 0, sy: -20, dead: false };
  const e2 = { type: 'E', sx: 0, sy: 20, dead: false };
  const D = { x: 200, y: 100, th: 0, sc: 1, mem: [d2, e2], massG: null };
  ctx.divTurnOn(D, { type: DIV, sx: 0, sy: 0, w: 40, dead: false });
  assert.equal(d2.dz, 'num');
  assert.equal(e2.dz, 'num', '没有落点记录 → 全进分子');
  // 横线被拆走/死了 → 新的 ÷ 顶上当横线
  const E2 = psDivBody();
  E2.div = { on: true, bar: { type: DIV, dead: true }, hi: null };
  const nb = { type: DIV, sx: 0, sy: 0, w: 40, dead: false, wy: 100 };
  E2.mem.push(nb);
  ctx.divTurnOn(E2, nb);
  assert.equal(E2.div.bar, nb);
  assert.equal(nb.dz, 'bar');
});

test('divInfo 结构读数:四格归属(未知格兜底分子)、空分数的 box 就是横线本身', () => {
  const DIV = psConst('DIV');
  const m = psandbox.indexOf('      divInfo: function (id) {');
  assert.ok(m > 0, 'missing method divInfo');
  const text = psandbox.slice(psandbox.indexOf('function (id) {', m), psandbox.indexOf('\n      },', m) + 8);
  new vm.Script('var divInfo = ' + text + ';', { filename: 'psandbox:divInfo' });
  const ctx = context(['divMembers', 'slot', 'divBarRect'].map(fnPs).concat(['var divInfo = ' + text + ';']),
    { DIV, bodies: [] });
  assert.equal(ctx.divInfo(0), null, '没有这个体 → null');
  const g = (ch, dz, sx, sy) => ({ type: ch, ch, dz, sx, sy, w: 10, h: 8, dead: false });
  const num = g('n', 'num', 0, -20), den = g('d', 'den', 0, 20), left = g('l', 'left', -40, 0);
  const right = g('r', 'right', 40, 0), odd = g('o', 'wat', 0, -40), div2 = g(DIV, null, 45, 0);
  const bar = { type: DIV, ch: DIV, sx: 0, sy: 0, w: 40, dead: false };
  ctx.bodies.push({ x: 200, y: 100, th: 0, sc: 1, massG: null, mem: [num, den, left, right, odd, div2, bar],
    div: { on: true, bar, hi: null }, st: { bar } });
  const out = clone(ctx.divInfo(0));
  assert.equal(out.on, true);
  assert.deepEqual(out.bar, { cx: 200, cy: 100, left: 180, right: 220, w: 40 });
  const chs = z => out.zones[z].map(q => q.ch);
  assert.deepEqual(chs('num'), ['n', 'o'], 'dz 认不出来的格子一律当分子');
  assert.deepEqual(chs('den'), ['d']);
  assert.deepEqual(chs('left'), ['l']);
  assert.deepEqual(chs('right'), ['r', DIV], '横线以外的 ÷ 排在后方项');
  assert.deepEqual(out.zones.num[0], { ch: 'n', cx: 200, cy: 80, w: 10, h: 8, left: 195, right: 205, top: 76, bottom: 84 });
  assert.deepEqual(out.box, { left: 155, top: 56, right: 250, bottom: 124 }, 'box = 各格字形并集');
  // 空分数:一个字形都没有,box 就是横线本身(上下各 1px)—— "空分数也要占住横线的高度"
  const empty = psDivBody();
  ctx.bodies.push(empty);
  const e = clone(ctx.divInfo(1));
  assert.deepEqual(e.zones, { num: [], den: [], left: [], right: [] });
  assert.deepEqual(e.box, { left: 180, top: 99, right: 220, bottom: 101 });
  // 没开手写分数的体:on:false / bar:null / box:null
  ctx.bodies.push({ x: 0, y: 0, th: 0, sc: 1, mem: [], massG: null, div: null, st: { bar: null } });
  assert.deepEqual(clone(ctx.divInfo(2)),
    { on: false, bar: null, zones: { num: [], den: [], left: [], right: [] }, rowW: null, box: null, sc: 1 });
  // 缩放:读数按 sc 放大(横线 40 → 80)
  ctx.bodies.push(psDivBody([], { sc: 2 }));
  assert.equal(clone(ctx.divInfo(3)).bar.w, 80);
  assert.deepEqual(clone(ctx.divInfo(3)).box, { left: 160, top: 99, right: 240, bottom: 101 });
});

test('手写分数的横线宽度:不小于 DIV_MBAR + 左右各 DIV_PAD', () => {
  const MBAR = psConst('DIV_MBAR'), PAD = psConst('DIV_PAD');
  // 这一条**不是**整个 layoutDiv(它依赖 hRun/ink/repairBase 一大串运行时状态,抽不动),
  // 只把其中算横线宽度的**那一行**原样抽出来喂假分子分母 —— 来源 js/psandbox.js:1460
  // `var barW = Math.max(numR.w, denR.w, DIV_MBAR) + DIV_PAD * 2;`
  const line = psandbox.match(/var barW = [^;]+;/g);
  assert.ok(line && line.length === 1, 'layoutDiv 里的横线宽度算式只有一处');
  const ctx = context(['function barWOf(numW, denW) { var numR = { w: numW }, denR = { w: denW }; ' + line[0] + ' return barW; }'],
    { DIV_MBAR: MBAR, DIV_PAD: PAD });
  // 负对照(说明):把这行改成 Math.max(numR.w, denR.w) + DIV_PAD*2,第一条立刻从 48 变 14
  assert.equal(ctx.barWOf(0, 0), MBAR + PAD * 2, '空分子/空分母也要有 ' + MBAR + 'px 横线(没它玩家没得瞄)');
  assert.equal(ctx.barWOf(10, 4), MBAR + PAD * 2, '最宽那行比 DIV_MBAR 窄时不缩');
  assert.equal(ctx.barWOf(100, 20), 100 + PAD * 2, '最宽那行更宽时按它 + 左右余量');
});

/* ---------- ② 箭头吸附 ---------- */
test('箭头吸附位置 = 卡片右边缘外 2px、竖直贴体中线并夹在卡片上下沿之内', () => {
  const GAP = psConst('ARROW_GAP');
  assert.equal(GAP, 2, 'ARROW_GAP 就是源码里"贴着卡片右侧"那个空隙');
  const ctx = context(['arrowSnapPos', 'arrowFindHost'].map(fnPs), { ARROW_GAP: GAP, ARROW_SNAP_R: psConst('ARROW_SNAP_R'), bodies: [] });
  const card = { right: 300, top: 100, bottom: 140 };
  const B = { x: 200, y: 120, hw: 40, hh: 18, sc: 1, _card: card };
  const s = clone(ctx.arrowSnapPos(B, { w: 20, h: 30 }));
  assert.equal(s.right, 300, '贴卡片右边缘');
  assert.equal(s.x, 300 + GAP + 10, '再往外留 ' + GAP + 'px,并让箭头自身居中');
  assert.equal(s.y, 120, '竖直用体的中线');
  assert.equal(s.ah, 30);
  // 卡片上沿天生比体中线低 ~1px:夹在 [top+2, bot-2],含端点
  assert.equal(ctx.arrowSnapPos({ ...B, y: 90 }, { w: 20, h: 30 }).y, 102);
  assert.equal(ctx.arrowSnapPos({ ...B, y: 101 }, { w: 20, h: 30 }).y, 102);
  assert.equal(ctx.arrowSnapPos({ ...B, y: 138 }, { w: 20, h: 30 }).y, 138);
  assert.equal(ctx.arrowSnapPos({ ...B, y: 200 }, { w: 20, h: 30 }).y, 138);
  // 卡片这一帧还没画(_card 为空)→ 退回体的 AABB 右边缘,缩放照样算
  const noCard = { x: 100, y: 50, hw: 40, hh: 18, sc: 2 };
  assert.equal(ctx.arrowSnapPos(noCard, { w: 30, h: 30 }).x, 100 + 80 + GAP + 15);
  assert.equal(ctx.arrowSnapPos(noCard, { w: 30, h: 30 }).y, 50);
  assert.equal(ctx.arrowSnapPos(noCard, null).x, 100 + 80 + GAP + 15, '箭头还没量过尺寸 → 按 30 宽算');
  assert.equal(ctx.arrowSnapPos(noCard, null).ah, 30);
  // 吸附圈:落点离卡片矩形 ≤ ARROW_SNAP_R 才算"丢在体上/体附近",差 1px 就不吸
  const R = psConst('ARROW_SNAP_R');
  const host = { x: 0, y: 0, hw: 40, hh: 18, sc: 1, eq: {}, eqText: 'U=Ed', _card: { left: 0, right: 100, top: 0, bottom: 40 } };
  ctx.bodies.push(host);
  assert.equal(ctx.arrowFindHost(100 + R, 20), host, '正好在吸附圈边界上 → 吸');
  assert.equal(ctx.arrowFindHost(100 + R + 1, 20), null, '出圈 1px → 不吸(恢复游离字形)');
  assert.equal(ctx.arrowFindHost(50, 20), host, '落在卡片矩形内 → 距离 0');
  ctx.bodies.length = 0;
  ctx.bodies.push({ ...host, eq: null }, { ...host, kind: 'field' }, { ...host, bh: {} });
  assert.equal(ctx.arrowFindHost(50, 20), null, '没有公式卡片的体(场体/黑洞/还没成式)不是吸附目标');
});

/* ---------- ③ 击穿空气的 BREAK_M 算术 ---------- */
// 一次"发射":源体(0,0)、目标体(dCen,0),两个都 hw=hh=0 —— supportR 里 `B.hw || 12` 会兜到 12,
// 所以两侧各贡献 12px;取 dCen = dGap + 24,arrowBreakdown 量出来的空气间隙就正好是 dGap(px)。
function psBreakCtx(breakM) {
  const events = [];
  const ctx = context(['supportR', 'arrowBreakdown'].map(fnPs), {
    BREAK_M: breakM === undefined ? psConst('BREAK_M') : breakM,
    E_BREAK_AIR: psConst('E_BREAK_AIR'),
    eqEmit: (type, B, data) => events.push({ type, data, body: B }),
    opLog: () => {}, burstParticles: () => {}, shake: () => {}
  });
  ctx.events = events;
  return ctx;
}
function psShoot(ctx, U, px, prev) {
  const before = ctx.events.length;
  const em = { x: 0, y: 0, hw: 0, hh: 0, eq: 'uniform-field', eqState: {} };
  const target = prev ? prev.target : { y: 0, hw: 0, hh: 0 };
  target.x = px + 24;
  ctx.arrowBreakdown({ wx: 1, wy: 0 }, { body: target, x: target.x, y: 0 }, U, em);
  return { fired: ctx.events.length > before, ev: ctx.events.slice(before), em, target };
}

test('BREAK_M 这把尺子:击穿判据等价于 d_px ≤ U/0.3,四条临界与两条实测边界都钉住', () => {
  const M = psConst('BREAK_M'), EAIR = psConst('E_BREAK_AIR');
  assert.equal(M, 1e-7, '1 屏幕像素 = 0.1 μm');
  assert.equal(EAIR, 3e6, '空气击穿场强 3×10⁶ V/m');
  const ctx = psBreakCtx();
  for (const [U, px] of [[6, 20], [20, 66], [30, 100], [60, 200]]) {
    assert.equal(Math.floor(U / (EAIR * M)), px, 'U=' + U + 'V 的临界间隙(⇔ U/0.3)');
    assert.equal(psShoot(ctx, U, px).fired, true, U + 'V / ' + px + 'px 正好 3×10⁶ V/m → 击穿(判据含等号)');
    assert.equal(psShoot(ctx, U, px + 1).fired, false, U + 'V / ' + (px + 1) + 'px 差一点点 → 不击穿');
  }
  // 第三批验收实测过的两条边界(60V)
  const hit = psShoot(ctx, 60, 194.8);
  assert.equal(hit.fired, true, '实测:60V / 194.8px(E=3.08×10⁶)击穿');
  assert.equal(hit.ev[0].type, 'breakdown');
  assert.equal(hit.ev[0].data.U, 60);
  assert.equal(+hit.ev[0].data.d.toFixed(2), 194.8, '事件里的 d 是量出来的空气间隙(px),不是箭头到目标中心的距离');
  assert.equal(hit.ev[0].data.E, 3.08e6, '事件里的 E = U/(d·BREAK_M)');
  assert.equal(hit.em.eqState.d, 194.8, '卡面 d 药丸与事件共用同一个数(卡面 E 与事件逐位一致)');
  assert.equal(psShoot(ctx, 60, 249.8).fired, false, '实测:60V / 249.8px(E=2.40×10⁶)不击穿');
  // 重新武装:同一个目标击穿一次后不再重复触发,场掉到 80% 以下才复位
  const t1 = psShoot(ctx, 60, 200);
  assert.equal(t1.fired, true);
  assert.equal(t1.target._bd, true, '击穿后目标的 _bd 立起来');
  assert.equal(psShoot(ctx, 60, 200, t1).fired, false, '已击穿的目标不重复触发(等重新武装)');
  assert.equal(psShoot(ctx, 60, 249.8, t1).target._bd, true, 'E=2.40×10⁶ 还在 0.8×3×10⁶ 线以上 → 不复位');
  assert.equal(psShoot(ctx, 60, 260, t1).target._bd, false, 'E=2.31×10⁶ < 0.8×3×10⁶ → 重新武装');
  assert.equal(psShoot(ctx, 60, 200, t1).fired, true, '重新武装后再靠近 → 又能击穿一次');
  // 打在**游离字形**上(hit.letter、没有体)走同一套算术
  const n0 = ctx.events.length;
  const L = { wx: 44, wy: 0 };
  ctx.arrowBreakdown({ wx: 1, wy: 0 }, { letter: L }, 6, { x: 0, y: 0, hw: 0, hh: 0, eq: null, eqState: null });
  assert.equal(ctx.events.length, n0 + 1, '6V / 20px(6/(20×10⁻⁷)=3×10⁶)打在字形上 → 击穿');
  assert.equal(L._bd, true);
  // 负对照(真跑):把尺子换成 1e-6(1px = 1μm),同样的 6V/20px 只有 3×10⁵ V/m ——
  // 上面那条"20px 击穿"靠的就是 BREAK_M=1e-7,尺子一改必红。
  const ctl = psBreakCtx(1e-6);
  assert.equal(psShoot(ctl, 6, 20).fired, false, '负对照:BREAK_M=1e-6 时 6V/20px 不击穿');
  assert.equal(psShoot(ctl, 6, 2).fired, true, '负对照:同一把尺子要 2px 才够(6V/3×10⁶×10⁻⁶)');
});

/* ---------- ④ canMerge:箭头闸门 + divFree 例外 ---------- */
function psCanMergeCtx(over = {}) {
  const fns = ['isOp', 'isMass', 'sigOfToks', 'toksOfBody', 'eqCompletes', 'eqAccepts'].map(fnPs);
  const g = { DIV_MAXL: psConst('DIV_MAXL'), ...(over.globals || {}) };
  return context([PS_SYMBOLS, PS_EQ_TABLE, ...fns, over.src || fnPs('canMerge')], g);
}

test('canMerge:箭头永不并进体(手写分数的"收任意字母"也不例外),÷ 允许多个', () => {
  const DIV = psConst('DIV'), ARROW = psConst('ARROW'), EQ = psConst('EQ');
  const MINUS = psConst('MINUS'), MAXL = psConst('DIV_MAXL');
  const ctx = psCanMergeCtx();
  // 正对照:抽出来的确实是产品的 canMerge(不是个恒 false 的空壳)
  assert.equal(ctx.canMerge({ mem: [], massG: null }, { type: 'm' }), true, '第一个质量字母照常能并');
  assert.equal(ctx.canMerge({ mem: [{ type: 'm' }], massG: null }, { type: 'm' }), false, '两个相同的质量永远不能合并');
  // ① 箭头闸门:手写分数体"四格收任意字母",但这道闸门必须先把箭头挡在外面
  const frac = { mem: [{ type: 'Q' }, { type: 'U' }, { type: 'C' }, { type: DIV }], massG: null, family: 2, div: { on: true } };
  assert.equal(ctx.canMerge(frac, { type: 'a' }), true, '开了手写分数(Q U C ÷)必须能收 a —— 否则拖到横线上方"什么也没发生"');
  assert.equal(ctx.canMerge(frac, { type: ARROW }), false, '但箭头不许被吞成体里的一个字形(2026-10-01 显式挡的那一道)');
  assert.equal(ctx.canMerge({ mem: [{ type: 'm' }], massG: null }, { type: ARROW }), false, '任何体都不收箭头');
  // 负对照(真删行重跑):把 `if (t === ARROW) return false;` 拿掉,同一个手写分数体就会把箭头收下 ——
  // 证明上面那条断言真的挂在那一行上,不是被别的规则顺带拒掉的。
  const stripped = fnPs('canMerge').replace(/[ \t]*if \(t === ARROW\) return false;\n/, '');
  assert.notEqual(stripped, fnPs('canMerge'), '负对照必须真的删掉了那一行');
  const ctl = psCanMergeCtx({ src: stripped });
  assert.equal(ctl.canMerge(frac, { type: ARROW }), true, '负对照:没有闸门时箭头被吞(divFree 例外漏到它身上)');
  assert.equal(ctl.canMerge({ mem: [{ type: 'm' }], massG: null }, { type: ARROW }), false, '普通体在负对照里也仍被公式闸门拦住');
  // ② divFree 例外:同一个体,开了 ÷ 能收"跟任何公式都不相容"的字母,没开就拒
  const plain = { mem: [{ type: 'Q' }, { type: 'U' }, { type: 'C' }], massG: null, family: 2 };
  assert.equal(ctx.canMerge(plain, { type: 'a' }), false, 'QUC 与任何含 a 的公式都不相容 + 不属于族 2 → 老规矩拒');
  assert.equal(ctx.canMerge({ ...plain, div: { on: true } }, { type: 'a' }), true, '开了手写分数 → 四格必须收得下任意字母');
  // ③ ÷ 允许多个(第一个是横线,其余当行内字形);其余运算符仍然同字符不重复
  assert.equal(ctx.canMerge({ mem: [{ type: DIV }], massG: null }, { type: DIV }), true, '多个 ÷ 允许');
  assert.equal(ctx.canMerge({ mem: [{ type: '+' }], massG: null }, { type: '+' }), false, '同字符不重复');
  assert.equal(ctx.canMerge({ mem: [{ type: '+' }], massG: null }, { type: MINUS }), true, '不同运算符仍可共存');
  // ④ 已成式的体不收 '='(它走边→边变换那条路)
  const eqBody = { mem: [{ type: 'm' }, { type: 'v' }, { type: 'v' }], massG: null, family: 2, eq: {} };
  assert.equal(ctx.canMerge(eqBody, { type: EQ }), false);
  assert.equal(ctx.canMerge({ ...eqBody, eq: null }, { type: EQ }), true);
  // ⑤ 手写分数只防病态堆叠:总字母数上限 DIV_MAXL
  const stack = n => ({ mem: Array.from({ length: n }, () => ({ type: 'z' })), massG: null, div: { on: true } });
  assert.equal(ctx.canMerge(stack(MAXL), { type: 'x' }), false, '到 ' + MAXL + ' 个字母就收不下了');
  assert.equal(ctx.canMerge(stack(MAXL - 1), { type: 'x' }), true, '差一个还能收');
});
