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
const quality = context(['parseAI', 'validateBatch', 'verifySource', 'buildPrompt', 'modelConfig'].map(n => fn(train, n)));

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

function runContext(responder, onMaterials) {
  const p = { name: '导数', board: 'calc', importance: 3, keywords: ['导数'], content: '数学讲解' };
  const els = { qType: { value: 'single' }, qDiff: { value: '3' }, qSource: { value: '2' }, genBtn: {},
    qaArea: { innerHTML: 'old questions', insertBefore() {}, firstChild: null } };
  const status = [], messages = [];
  const ctx = context(['runGen', 'buildPrompt', 'parseAI', 'validateBatch', 'verifySource'].map(n => fn(train, n)), {
    busy: false, curDB: { subject: 'math', subjectName: '高中数学', boards: [] }, els,
    currentTarget: () => ({ p }), keyState: () => 'mock-only', tag() {}, setSteps() {},
    setStatus: (s, kind) => status.push({ s, kind }),
    subjMats: async () => { if (onMaterials) onMaterials(ctx); return []; },
    gkMats: async () => [], webMats: async () => [],
    dsAsk: async ms => { messages.push(ms); return responder(messages.length); },
    renderQuestions: qs => { els.qaArea.innerHTML = JSON.stringify(qs); },
    document: { createElement: () => ({}) }
  });
  return { ctx, els, status, messages };
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
