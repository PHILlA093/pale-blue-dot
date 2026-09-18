/* 对照语料高频词,找出规范词表仍未覆盖的词 */
const fs = require('fs');
const DIR = 'E:/workspace/穷观/_gaokao_work';
const corpus = fs.readFileSync(DIR + '/corpus.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
['corpus_A.jsonl'].forEach(function (f) {
  if (!fs.existsSync(DIR + '/' + f)) return;
  fs.readFileSync(DIR + '/' + f, 'utf8').split('\n').filter(Boolean).forEach(function (l) {
    try { const r = JSON.parse(l); if (r && r.text) corpus.push(r); } catch (e) { }
  });
});
const rows = JSON.parse(fs.readFileSync(DIR + '/canon_freq.json', 'utf8'));

const f = Object.create(null), yrs = Object.create(null);
corpus.forEach(function (r) {
  (String(r.text).toLowerCase().match(/[a-z][a-z'-]*/g) || []).forEach(function (t) {
    t = t.replace(/^['-]+|['-]+$/g, '');
    if (t.endsWith("'s")) t = t.slice(0, -2);
    if (t.length < 2) return;
    f[t] = (f[t] || 0) + 1;
    if (r.year) { (yrs[t] = yrs[t] || new Set()).add(r.year); }
  });
});
const listed = new Set(rows.map(r => String(r.word).toLowerCase().trim()));
function covered(tok) {
  if (listed.has(tok)) return true;
  const cands = [tok.replace(/s$/, ''), tok.replace(/es$/, ''), tok.replace(/ies$/, 'y'), tok.replace(/ed$/, ''),
    tok.replace(/ed$/, 'e'), tok.replace(/d$/, ''), tok.replace(/ing$/, ''), tok.replace(/ing$/, 'e'),
    tok.replace(/ly$/, ''), tok.replace(/er$/, ''), tok.replace(/est$/, ''), tok.replace(/n$/, '')];
  return cands.some(c => c.length >= 2 && listed.has(c));
}
const all = Object.keys(f).sort((a, b) => f[b] - f[a]);
const missing = all.filter(t => !covered(t));
const strongMiss = missing.filter(t => f[t] >= 15);
const midMiss = missing.filter(t => f[t] >= 8 && f[t] < 15);
console.log('词表条目 ' + rows.length + ' / 语料不同词形 ' + all.length);
console.log('语料中频次 >=15 但词表未覆盖: ' + strongMiss.length + ' 个');
strongMiss.slice(0, 80).forEach(t => console.log('   ' + t + '  ' + f[t] + ' 次 / ' + (yrs[t] ? yrs[t].size : 0) + ' 年'));
console.log('语料中频次 8~14 且未覆盖: ' + midMiss.length + ' 个');
console.log('   ' + midMiss.slice(0, 60).map(t => t + '(' + f[t] + ')').join(', '));
fs.writeFileSync(DIR + '/gap2.json', JSON.stringify({
  strong: strongMiss.map(t => ({ w: t, freq: f[t], years: yrs[t] ? yrs[t].size : 0 })),
  mid: midMiss.map(t => ({ w: t, freq: f[t], years: yrs[t] ? yrs[t].size : 0 }))
}, null, 1), 'utf8');
