/* 建立并集词表 union.json
 * 成员 = 考纲口径清单(canonical.json)∪ 人教版课本单词表(18 册,单词型)
 *        ∪ ckaorceu 高考3500 词表(单词型,补漏)
 * 音标/释义优先级:canonical(已有音标释义) > 课本表 > ckaorceu
 * 教材出处:记录出现的册与单元(2019 版带单元,旧版无单元)
 */
const fs = require('fs');
const D = 'E:/workspace/穷观/_gaokao_work/';
const SRC = D + 'src/';

function norm(s) {
  return String(s == null ? '' : s).replace(/[\u2018\u2019]/g, "'").replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
const map = new Map();
function ensure(word) {
  const k = norm(word);
  if (!k) return null;
  if (!map.has(k)) map.set(k, { word: String(word).trim(), ph: '', pos: '', def: '', srcs: [], books: [], units: [] });
  return map.get(k);
}

/* 1) canonical(考纲口径,已含音标/释义) */
const canon = JSON.parse(fs.readFileSync(D + 'canonical.json', 'utf8'));
canon.forEach(function (c) {
  const e = ensure(c.word);
  if (!e) return;
  if (e.srcs.indexOf('考纲') < 0) e.srcs.push('考纲');
  if (!e.ph && c.ph) e.ph = c.ph;
  if (!e.pos && c.pos) e.pos = c.pos;
  if (!e.def && c.def) e.def = c.def;
  if (c.srcs && c.srcs.indexOf('补录') >= 0 && e.srcs.indexOf('补录') < 0) e.srcs.push('补录');
});

/* 2) 课本单词表(18 册) */
const tb = fs.readFileSync(D + 'textbook_words_B.jsonl', 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
let tbSingle = 0, tbPhrase = 0;
tb.forEach(function (r) {
  const w = norm(r.word);
  if (!w) return;
  const isPhrase = /[^a-z'\- ]/.test(w) || w.indexOf(' ') >= 0;
  if (isPhrase) { tbPhrase++; } else { tbSingle++; }
  const e = ensure(r.word);
  if (!e) return;
  if (e.srcs.indexOf('教材') < 0) e.srcs.push('教材');
  if (r.book && e.books.indexOf(r.book) < 0) e.books.push(r.book);
  if (r.unit && e.units.indexOf(r.unit) < 0) e.units.push(r.unit);
  if (!e.ph && r.ph) e.ph = r.ph;
  if (!e.pos && r.pos) e.pos = r.pos;
  if (!e.def && r.def) e.def = r.def;
});

/* 3) ckaorceu 考纲词表(补漏:部分课本词/考纲词只在它里面) */
if (fs.existsSync(SRC + 'ckaorceu_words.json')) {
  const raw = JSON.parse(fs.readFileSync(SRC + 'ckaorceu_words.json', 'utf8'));
  const arr = Array.isArray(raw) ? raw : (raw.words || raw.list || raw.data || []);
  arr.forEach(function (r) {
    const w = r.name || r.word || '';
    const k = norm(w);
    if (!k || k.indexOf(' ') >= 0) return;
    const e = ensure(w);
    if (!e) return;
    if (e.srcs.indexOf('考纲') < 0) e.srcs.push('考纲');
    if (!e.ph && (r.usphone || r.ukphone)) e.ph = r.usphone || r.ukphone;
    if (!e.pos && r.pos) e.pos = r.pos;
    if (!e.def && r.meaning) e.def = r.meaning;
  });
}

const rows = Array.from(map.values()).filter(function (e) { return e.word; });
rows.sort(function (a, b) { return norm(a.word).localeCompare(norm(b.word)); });
fs.writeFileSync(D + 'union.json', JSON.stringify(rows, null, 1), 'utf8');

const only = k => rows.filter(e => e.srcs.indexOf(k) >= 0).length;
const single = rows.filter(e => e.word.indexOf(' ') < 0).length;
console.log('并集词表 = ' + rows.length + ' 条(单词型 ' + single + ' / 含短语 ' + (rows.length - single) + ')');
console.log('  来源标记:考纲 ' + only('考纲') + ' · 教材 ' + only('教材') + ' · 两者都有 ' + rows.filter(e => e.srcs.indexOf('考纲') >= 0 && e.srcs.indexOf('教材') >= 0).length);
console.log('  课本原始:单词型 ' + tbSingle + ' 条 / 短语型 ' + tbPhrase + ' 条');
console.log('  有音标 ' + rows.filter(e => e.ph).length + ' · 有释义 ' + rows.filter(e => e.def).length);
console.log('  仅考纲有(课本课后词表未收): ' + rows.filter(e => e.srcs.indexOf('考纲') >= 0 && e.srcs.indexOf('教材') < 0).length);
console.log('  仅教材有: ' + rows.filter(e => e.srcs.indexOf('教材') >= 0 && e.srcs.indexOf('考纲') < 0).length);
