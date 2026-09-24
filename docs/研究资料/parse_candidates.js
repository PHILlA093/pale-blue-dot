/* 解析候选词表源并与我们现有 3640 词表对比
 * 输入:_gaokao_work\src\Lazuli_raw.txt、pluto_3500.txt
 * 输出:_gaokao_work\src\lazuli.json、pluto.json、diff_report.txt
 */
const fs = require('fs');
const DIR = 'E:/workspace/穷观/_gaokao_work';
const SRC = DIR + '/src';

function parseLazuli(txt) {
  const out = [], bad = [];
  txt.split(/\r?\n/).forEach(function (line) {
    let s = line.replace(/\u3000/g, ' ').trim();
    if (!s) return;
    if (/^[A-Z]$/.test(s)) return;                       // 字母分节标题
    let word = '', ph = '', rest = '';
    const bi = s.indexOf('[');
    if (bi > 0) {
      const ci = s.indexOf(']', bi);
      if (ci < 0) { bad.push(s); return; }
      word = s.slice(0, bi).trim();
      ph = s.slice(bi + 1, ci).trim();
      rest = s.slice(ci + 1).trim();
    } else {
      const si = s.indexOf(' ');
      if (si < 0) { word = s; } else { word = s.slice(0, si).trim(); rest = s.slice(si + 1).trim(); }
    }
    word = word.replace(/\s+/g, ' ').trim();
    if (!/^[A-Za-z][A-Za-z'’\-\. ]*$/.test(word)) { bad.push(s); return; }
    let pos = '', def = '';
    const mp = /^((?:[a-z]+\.\s*)+)(.*)$/.exec(rest);
    if (mp) { pos = mp[1].trim(); def = mp[2].trim(); } else { def = rest; }
    out.push({ word: word, ph: ph, pos: pos, def: def });
  });
  return { rows: out, bad: bad };
}

function parsePluto(txt) {
  const lines = txt.split(/\r?\n/).map(s => s.trim());
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const w = lines[i];
    if (!w || /^\[/.test(w)) continue;
    if (!/^[A-Za-z][A-Za-z'’\-\.() ]*$/.test(w)) continue;
    let ph = '', def = '';
    if (lines[i + 1] && /^\[/.test(lines[i + 1])) { ph = lines[i + 1].replace(/^\[|\]$/g, ''); i++; }
    if (lines[i + 1] && /^[a-z]+\./.test(lines[i + 1])) { def = lines[i + 1]; i++; }
    out.push({ word: w, ph: ph, def: def });
  }
  return out;
}

const laz = parseLazuli(fs.readFileSync(SRC + '/Lazuli_raw.txt', 'utf8'));
const pl = parsePluto(fs.readFileSync(SRC + '/pluto_3500.txt', 'utf8'));
fs.writeFileSync(SRC + '/lazuli.json', JSON.stringify(laz.rows, null, 1), 'utf8');
fs.writeFileSync(SRC + '/pluto.json', JSON.stringify(pl, null, 1), 'utf8');

const ours = JSON.parse(fs.readFileSync('E:/workspace/穷观/英语预热/高考英语3500词根版_全量.json', 'utf8'));
const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').replace(/[’]/g, "'").trim();
const ourSet = new Set(ours.map(e => norm(e.word)));
const lazSet = new Map();
laz.rows.forEach(r => { const k = norm(r.word); if (!lazSet.has(k)) lazSet.set(k, r); });
const plutoSet = new Set(pl.map(r => norm(r.word)));

const CORE = ['have', 'has', 'had', 'go', 'went', 'do', 'does', 'did', 'can', 'could', 'must', 'say', 'said', 'get', 'got',
  'take', 'took', 'come', 'came', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'give', 'gave', 'tell', 'told',
  'more', 'most', 'many', 'much', 'little', 'toward', 'towards', 'make', 'made', 'use', 'used', 'find', 'found'];

const rep = [];
rep.push('Lazuli 解析:' + laz.rows.length + ' 条(无法解析 ' + laz.bad.length + ' 行)');
rep.push('Pluto  解析:' + pl.length + ' 条');
rep.push('我们词表:' + ours.length + ' 条');
rep.push('');
rep.push('核心词覆盖检查(在 Lazuli / Pluto / 我们的词表中是否存在):');
CORE.forEach(function (w) {
  rep.push('  ' + w.padEnd(10) + ' Lazuli=' + (lazSet.has(w) ? 'Y' : '-') + '  Pluto=' + (plutoSet.has(w) ? 'Y' : '-') + '  我们=' + (ourSet.has(w) ? 'Y' : '-'));
});
const inLazNotOurs = Array.from(lazSet.keys()).filter(k => !ourSet.has(k));
const inOursNotLaz = Array.from(ourSet).filter(k => !lazSet.has(k));
rep.push('');
rep.push('Lazuli 有、我们词表缺:' + inLazNotOurs.length + ' 个');
rep.push('  样例: ' + inLazNotOurs.slice(0, 60).join(', '));
rep.push('我们词表有、Lazuli 无:' + inOursNotLaz.length + ' 个');
rep.push('  样例: ' + inOursNotLaz.slice(0, 40).join(', '));
const both = Array.from(lazSet.keys()).filter(k => ourSet.has(k));
rep.push('两表交集:' + both.length + ' 个');
fs.writeFileSync(DIR + '/src/diff_report.txt', rep.join('\n'), 'utf8');
console.log(rep.slice(0, 55).join('\n'));
