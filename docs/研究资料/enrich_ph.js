/* 用 ECDICT 补全 union.json 缺失的音标(与缺失的释义)
 * 输入:src/ecdict.csv(65MB,列:word,phonetic,definition,translation,pos,...)
 *      union.json
 * 输出:union.json(就地补全)+ 统计
 */
const fs = require('fs');
const D = 'E:/workspace/穷观/_gaokao_work/';
const rows = JSON.parse(fs.readFileSync(D + 'union.json', 'utf8'));
const need = new Map();                       // 需要补的单词 → union 条目
rows.forEach(function (e) {
  if (e.ph && e.def) return;
  const k = String(e.word).toLowerCase().replace(/\s+/g, ' ').trim();
  if (k.indexOf(' ') >= 0) return;            // 短语查词典意义不大
  if (!need.has(k)) need.set(k, []);
  need.get(k).push(e);
});
console.log('待补条目:' + Array.from(need.values()).reduce((a, b) => a + b.length, 0) + '(不同单词 ' + need.size + ')');

const text = fs.readFileSync(D + 'src/ecdict.csv', 'utf8');
let i = 0, n = text.length, field = '', fields = [], inQ = false, line = 0, filled = 0;
const needKeys = new Set(need.keys());
let curWord = '';
function handleRow(f) {
  if (!f.length) return;
  const w = String(f[0] || '').toLowerCase().trim();
  if (!needKeys.has(w)) return;
  const list = need.get(w);
  const ph = String(f[1] || '').trim();
  const trans = String(f[3] || '').trim();
  list.forEach(function (e) {
    if (!e.ph && ph) e.ph = ph;
    if (!e.def && trans) e.def = trans.replace(/\s+/g, ' ').slice(0, 60);
    filled++;
  });
  needKeys.delete(w);
}
let q = false;
for (i = 0; i < n; i++) {
  const c = text[i];
  if (q) {
    if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
    else field += c;
  } else {
    if (c === '"') q = true;
    else if (c === ',') { fields.push(field); field = ''; }
    else if (c === '\n') { fields.push(field); field = ''; handleRow(fields); fields = []; line++; }
    else if (c !== '\r') field += c;
  }
}
if (field.length || fields.length) { fields.push(field); handleRow(fields); }

fs.writeFileSync(D + 'union.json', JSON.stringify(rows, null, 1), 'utf8');
console.log('ECDICT 行数 ' + line + ' · 补全条目次数 ' + filled + ' · 仍未匹配单词 ' + needKeys.size);
console.log('补后:有音标 ' + rows.filter(e => e.ph).length + ' / ' + rows.length + ' · 有释义 ' + rows.filter(e => e.def).length);
console.log('样例: ' + ['campus', 'formal', 'revise', 'freshman'].map(function (w) {
  const e = rows.filter(x => String(x.word).toLowerCase() === w)[0];
  return e ? (w + ' [' + e.ph + '] ' + e.pos + ' ' + String(e.def).slice(0, 18)) : (w + ' N/A');
}).join(' | '));
