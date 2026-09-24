/* 合并多源词表 → 规范词表 canonical.json
 * 成员来源(决定"哪些词进入清单"):
 *   A. citu 03_data/wordlist.txt(3395,含 have/go/do/can 等功能词)★考纲主干
 *   B. 我们英语预热的高考3500词表(3640,带音标/释义/词根)
 *   C. 子代理采集的教科书单词表(textbook_words_B.jsonl,若存在)
 * 仅用于补全音标/释义的来源:
 *   D. ckaorceu words.json(3893,usphone/ukphone/pos/meaning)
 *   E. citu words.json(3423,phonetic/meaning/pos)
 *   F. Lazuli raw.txt 解析结果(3662,音标/词性/释义)
 * 输出:_gaokao_work\canonical.json + canonical_report.txt
 */
const fs = require('fs');
const DIR = 'E:/workspace/穷观/_gaokao_work';
const SRC = DIR + '/src';

function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2018\u2019]/g, "'").replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
function key(s) { return norm(s).replace(/\s*\((?:[^)]*)\)\s*$/, '').trim(); }   // 去掉尾部括号说明

const map = new Map();
function ensure(word) {
  const k = key(word);
  if (!k) return null;
  if (!map.has(k)) map.set(k, { word: String(word).trim(), ph: '', pos: '', def: '', srcs: [], books: [], units: [] });
  return map.get(k);
}
function addSrc(e, s) { if (e && e.srcs.indexOf(s) < 0) e.srcs.push(s); }

/* --- A. citu wordlist.txt(决定成员) --- */
const wl = fs.readFileSync(SRC + '/citu_wordlist.txt', 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
wl.forEach(w => { const e = ensure(w); addSrc(e, 'citu-wordlist'); });

/* --- B. 我们的 3640 词表(决定成员) --- */
const ours = JSON.parse(fs.readFileSync('E:/workspace/穷观/英语预热/高考英语3500词根版_全量.json', 'utf8'));
ours.forEach(function (o) {
  const e = ensure(o.word);
  if (!e) return;
  addSrc(e, 'qg3500');
  if (!e.ph && o.ph) e.ph = String(o.ph).trim();
  if (!e.pos && o.pos) e.pos = String(o.pos).trim();
  if (!e.def && o.def) e.def = String(o.def).trim();
});

/* --- C. 教科书单词表(决定成员,若已采集) --- */
const tbPath = DIR + '/textbook_words_B.jsonl';
let tbCount = 0;
if (fs.existsSync(tbPath)) {
  fs.readFileSync(tbPath, 'utf8').split('\n').filter(Boolean).forEach(function (l) {
    let r; try { r = JSON.parse(l); } catch (e) { return; }
    if (!r || !r.word) return;
    const e = ensure(r.word);
    if (!e) return;
    addSrc(e, 'textbook');
    tbCount++;
    if (r.book && e.books.indexOf(r.book) < 0) e.books.push(r.book);
    if (r.unit && e.units.indexOf(r.unit) < 0) e.units.push(r.unit);
    if (!e.pos && r.pos) e.pos = String(r.pos).trim();
    if (!e.def && r.def) e.def = String(r.def).trim();
  });
}

/* --- D/E/F. 仅补音标与释义 --- */
function enrich(file, pick) {
  if (!fs.existsSync(SRC + '/' + file)) return 0;
  let raw;
  try { raw = JSON.parse(fs.readFileSync(SRC + '/' + file, 'utf8')); } catch (e) { return 0; }
  const arr = Array.isArray(raw) ? raw : (raw.words || raw.list || raw.data || []);
  let n = 0;
  arr.forEach(function (r) {
    const w = r.word || r.name || '';
    const e = map.get(key(w));
    if (!e) return;
    n++;
    const p = pick(r);
    addSrc(e, file.replace(/\.json$/, ''));
    if (!e.ph && p.ph) e.ph = String(p.ph).trim();
    if (!e.pos && p.pos) e.pos = String(p.pos).trim();
    if (!e.def && p.def) e.def = String(p.def).trim();
    if (!e.word && w) e.word = String(w).trim();
  });
  return n;
}
enrich('ckaorceu_words.json', r => ({ ph: r.usphone || r.ukphone || '', pos: r.pos || '', def: r.meaning || '' }));
enrich('citu_words.json', r => ({ ph: r.phonetic || '', pos: r.pos || '', def: r.meaning || '' }));
if (fs.existsSync(SRC + '/lazuli.json')) {
  const laz = JSON.parse(fs.readFileSync(SRC + '/lazuli.json', 'utf8'));
  laz.forEach(function (r) {
    const e = map.get(key(r.word));
    if (!e) return;
    addSrc(e, 'lazuli');
    if (!e.ph && r.ph) e.ph = r.ph;
    if (!e.pos && r.pos) e.pos = r.pos;
    if (!e.def && r.def) e.def = r.def;
  });
}

const rows = Array.from(map.values()).filter(e => e.word && key(e.word).length > 0);
rows.sort((a, b) => key(a.word).localeCompare(key(b.word)));
fs.writeFileSync(DIR + '/canonical.json', JSON.stringify(rows, null, 1), 'utf8');

const withPh = rows.filter(r => r.ph).length, withDef = rows.filter(r => r.def).length;
const fromTb = rows.filter(r => r.srcs.indexOf('textbook') >= 0).length;
const rep = [];
rep.push('规范词表条目:' + rows.length);
rep.push('  citu wordlist 成员:' + wl.length);
rep.push('  我们词表成员:' + ours.length);
rep.push('  教科书词条(记录数 ' + tbCount + ',去重后 ' + fromTb + ')');
rep.push('  有音标:' + withPh + '  有释义:' + withDef + '  两缺:' + rows.filter(r => !r.ph && !r.def).length);
rep.push('');
rep.push('核心功能词覆盖:');
['have', 'go', 'do', 'can', 'say', 'get', 'take', 'come', 'see', 'know', 'think', 'give', 'tell', 'many', 'much', 'more', 'most', 'little', 'toward', 'could', 'must', 'make', 'will', 'would'].forEach(function (w) {
  const e = map.get(w);
  rep.push('  ' + w.padEnd(9) + (e ? ('Y  [' + e.ph + '] ' + e.pos + ' ' + String(e.def).slice(0, 16) + '  来源:' + e.srcs.join('+')) : '-'));
});
fs.writeFileSync(DIR + '/canonical_report.txt', rep.join('\n'), 'utf8');
console.log(rep.join('\n'));
