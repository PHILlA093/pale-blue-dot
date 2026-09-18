/* 量化:高考真题语料里高频、但我们的 3640 词表未覆盖的词
 * 输出:_gaokao_work\gap.json + gap_report.txt
 */
const fs = require('fs');
const DIR = 'E:/workspace/穷观/_gaokao_work';

const corpus = fs.readFileSync(DIR + '/corpus.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const rows = JSON.parse(fs.readFileSync(DIR + '/freq.json', 'utf8'));

const f = Object.create(null), yrs = Object.create(null);
for (const r of corpus) {
  (r.text.toLowerCase().match(/[a-z][a-z'-]*/g) || []).forEach(function (t) {
    t = t.replace(/^['-]+|['-]+$/g, '');
    if (t.endsWith("'s")) t = t.slice(0, -2);
    if (t.length < 2) return;
    f[t] = (f[t] || 0) + 1;
    if (r.year) { (yrs[t] = yrs[t] || new Set()).add(r.year); }
  });
}

const listWords = new Set(rows.map(r => String(r.word).toLowerCase().trim()));
const STOP = new Set(['the', 'to', 'of', 'and', 'in', 'it', 'for', 'on', 'with', 'as', 'at', 'by', 'that', 'this', 'these', 'those', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did', 'done', 'doing']);

function covered(tok) {
  if (listWords.has(tok)) return true;
  const cands = [
    tok.replace(/s$/, ''), tok.replace(/es$/, ''), tok.replace(/ies$/, 'y'),
    tok.replace(/ed$/, ''), tok.replace(/ed$/, 'e'), tok.replace(/d$/, ''),
    tok.replace(/ing$/, ''), tok.replace(/ing$/, 'e'), tok.replace(/ly$/, ''),
    tok.replace(/er$/, ''), tok.replace(/est$/, ''), tok.replace(/n$/, '')
  ];
  return cands.some(c => c.length >= 2 && listWords.has(c));
}

const all = Object.keys(f).sort((a, b) => f[b] - f[a]);
const missing = all.filter(t => !covered(t));
const top500 = all.slice(0, 500);
const missTop500 = top500.filter(t => !covered(t));
const missTop200 = all.slice(0, 200).filter(t => !covered(t));

const report = [];
report.push('语料不同词形(token)数:' + all.length);
report.push('语料频次前 200 词形中,词表未覆盖:' + missTop200.length + ' 个');
report.push('语料频次前 500 词形中,词表未覆盖:' + missTop500.length + ' 个');
report.push('');
report.push('前 500 中未覆盖的词(按频次降序,含次数/覆盖年份):');
missTop500.slice(0, 120).forEach(function (t) {
  report.push('  ' + t + '  ' + f[t] + ' 次 / ' + ((yrs[t] ? yrs[t].size : 0)) + ' 年');
});
fs.writeFileSync(DIR + '/gap.json', JSON.stringify({
  tokenCount: all.length,
  missTop200: missTop200.map(t => ({ w: t, freq: f[t], years: yrs[t] ? yrs[t].size : 0 })),
  missTop500: missTop500.map(t => ({ w: t, freq: f[t], years: yrs[t] ? yrs[t].size : 0 })),
  missingAll: missing.slice(0, 400).map(t => ({ w: t, freq: f[t] }))
}, null, 1), 'utf8');
fs.writeFileSync(DIR + '/gap_report.txt', report.join('\n'), 'utf8');
console.log(report.slice(0, 60).join('\n'));
