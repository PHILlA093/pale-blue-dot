/* 输入:_gaokao_work\corpus.jsonl(+ 可选 corpus_A/B.jsonl)
 *      词表:argv[2] 指定(默认 英语预热\高考英语3500词根版_全量.json)
 * 输出:_gaokao_work\<prefix>freq.json / <prefix>freq.tsv / <prefix>freq_report.txt
 *      prefix 由 argv[3] 指定(默认空)
 */
const fs = require('fs');
const path = require('path');

const DIR = 'E:/workspace/穷观/_gaokao_work';
const LIST = process.argv[2] || 'E:/workspace/穷观/英语预热/高考英语3500词根版_全量.json';
const PREFIX = process.argv[3] || '';

const corpus = fs.readFileSync(path.join(DIR, 'corpus.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));
// 可选:合并外部补充语料(子代理采集的 corpus_A.jsonl 等)
['corpus_A.jsonl', 'corpus_B.jsonl'].forEach(function (f) {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) return;
  const extra = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
  let n = 0;
  extra.forEach(function (r) {
    const txt = String(r.text || '');
    if ((txt.match(/[A-Za-z][A-Za-z'\-]*/g) || []).length < 15) return;
    corpus.push({ year: String(r.year || ''), category: r.title || r.source || f, file: f, text: txt });
    n++;
  });
  console.log('[merge] ' + f + ' 并入 ' + n + ' 条');
});
const list = JSON.parse(fs.readFileSync(LIST, 'utf8'));

/* ---------- 1. 语料分词统计 ---------- */
const freq = Object.create(null);   // token -> 次数
const yearsOf = Object.create(null); // token -> Set(年份)
let totalTokens = 0;
for (const rec of corpus) {
  const toks = rec.text.toLowerCase().match(/[a-z][a-z'-]*/g) || [];
  for (let t of toks) {
    t = t.replace(/^['-]+|['-]+$/g, '');
    if (!t || t.length < 2) continue;
    if (t.endsWith("'s")) t = t.slice(0, -2);
    freq[t] = (freq[t] || 0) + 1;
    totalTokens++;
    if (rec.year) {
      if (!yearsOf[t]) yearsOf[t] = new Set();
      yearsOf[t].add(rec.year);
    }
  }
}

/* ---------- 2. 词形还原:把语料 token 归到词表条目 ---------- */
const IRREGULAR = {
  // 动词不规则
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'], do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'], make: ['made', 'making'],
  take: ['took', 'taken', 'taking'], see: ['saw', 'seen', 'seeing'],
  come: ['came', 'coming'], get: ['got', 'gotten', 'getting'],
  give: ['gave', 'given', 'giving'], know: ['knew', 'known', 'knowing'],
  think: ['thought'], find: ['found'], tell: ['told'], become: ['became', 'becoming'],
  leave: ['left', 'leaving'], feel: ['felt'], bring: ['brought'],
  begin: ['began', 'begun', 'beginning'], keep: ['kept'], hold: ['held'],
  write: ['wrote', 'written', 'writing'], stand: ['stood'], hear: ['heard'],
  mean: ['meant'], meet: ['met', 'meeting'], run: ['ran', 'running'],
  pay: ['paid'], sit: ['sat', 'sitting'], speak: ['spoke', 'spoken', 'speaking'],
  lead: ['led'], read: ['reading'], grow: ['grew', 'grown'], lose: ['lost', 'losing'],
  fall: ['fell', 'fallen'], send: ['sent'], build: ['built'], understand: ['understood'],
  draw: ['drew', 'drawn'], break: ['broke', 'broken'], spend: ['spent'],
  cut: ['cutting'], rise: ['rose', 'risen', 'rising'], drive: ['drove', 'driven', 'driving'],
  buy: ['bought'], wear: ['wore', 'worn'], choose: ['chose', 'chosen', 'choosing'],
  eat: ['ate', 'eaten'], drink: ['drank', 'drunk'], sing: ['sang', 'sung'],
  swim: ['swam', 'swum', 'swimming'], teach: ['taught'], catch: ['caught'],
  fight: ['fought'], seek: ['sought'], sell: ['sold'], sleep: ['slept'],
  win: ['won', 'winning'], forget: ['forgot', 'forgotten'], hide: ['hid', 'hidden'],
  ride: ['rode', 'ridden', 'riding'], shake: ['shook', 'shaken'], strike: ['struck'],
  throw: ['threw', 'thrown'], wake: ['woke', 'woken', 'waking'], hurt: ['hurting'],
  lay: ['laid', 'laying'], lie: ['lay', 'lain', 'lying'], shine: ['shone'],
  shoot: ['shot'], shut: ['shutting'], steal: ['stole', 'stolen'], stick: ['stuck'],
  sweep: ['swept'], swear: ['swore', 'sworn'], arise: ['arose', 'arisen', 'arising'],
  awake: ['awoke', 'awoken'], bear: ['bore', 'borne'], beat: ['beaten'],
  bite: ['bit', 'bitten'], blow: ['blew', 'blown'], deal: ['dealt'],
  dig: ['dug', 'digging'], feed: ['fed'], fit: ['fitting'], flee: ['fled'],
  fly: ['flew', 'flown'], forbid: ['forbade', 'forbidden'], freeze: ['froze', 'frozen'],
  hang: ['hung'], lend: ['lent'], mistake: ['mistook', 'mistaken'],
  overcome: ['overcame'], prove: ['proved', 'proven'], quit: ['quitting'],
  ring: ['rang', 'rung'], seek2: ['seeking'], sew: ['sewed', 'sewn'],
  sink: ['sank', 'sunk'], slide: ['slid'], spread: ['spreading'],
  spring: ['sprang', 'sprung'], tear: ['tore', 'torn'], wind: ['wound'],
  // 名词不规则复数
  child: ['children'], man: ['men'], woman: ['women'], foot: ['feet'],
  tooth: ['teeth'], mouse: ['mice'], goose: ['geese'], life: ['lives'],
  knife: ['knives'], leaf: ['leaves'], wife: ['wives'], wolf: ['wolves'],
  shelf: ['shelves'], thief: ['thieves'], half: ['halves'], self: ['selves'],
  person: ['people'], ox: ['oxen'], sheep: ['sheep'], fish: ['fish'],
  // 形容词/副词不规则
  good: ['better', 'best'], bad: ['worse', 'worst'], many: ['more', 'most'],
  much: ['more', 'most'], little: ['less', 'least'], far: ['further', 'furthest', 'farther', 'farthest']
};
const IRREG_TO_BASE = Object.create(null);
Object.keys(IRREGULAR).forEach(function (base) {
  IRREGULAR[base].forEach(function (f) { if (!IRREG_TO_BASE[f]) IRREG_TO_BASE[f] = base; });
});

// 规则派生形(用于把 "students" 归到 "student")
function ruleForms(w) {
  const out = new Set([w]);
  const add = x => { if (x && x.length >= 2) out.add(x); };
  add(w + 's'); add(w + 'es'); add(w + 'ed'); add(w + 'd'); add(w + 'ing'); add(w + 'er'); add(w + 'est');
  if (/y$/.test(w)) { const b = w.slice(0, -1); add(b + 'ies'); add(b + 'ied'); add(b + 'ier'); add(b + 'iest'); }
  if (/e$/.test(w)) { const b = w.slice(0, -1); add(b + 'ing'); add(b + 'ed'); }
  if (/^[a-z]*[aeiou][bcdfglmnprstz]$/.test(w)) { const l = w.slice(-1); add(w + l + 'ed'); add(w + l + 'ing'); }
  if (/f$/.test(w)) add(w.slice(0, -1) + 'ves');
  if (/fe$/.test(w)) add(w.slice(0, -2) + 'ves');
  return out;
}

const baseOfToken = Object.create(null);   // token -> 词表条目 word(小写)
const entryForms = Object.create(null);    // 词表条目 word(小写) -> [forms]
const irregularSet = new Set();
Object.keys(IRREGULAR).forEach(function (base) {
  IRREGULAR[base].forEach(function (f) { irregularSet.add(f); });
});

// 词表条目:只对长度 ≥3 的词做规则派生(2 字母词会派生出 had/has 这类
// 与其他词冲突的怪形,必须排除);短语/连字符/带括号条目另行整串匹配
const simpleEntries = list.filter(function (e) {
  const w = String(e.word || '').toLowerCase().trim();
  return w && w.indexOf(' ') < 0 && w.indexOf('-') < 0 && w.indexOf('(') < 0;
});
// 第 1 优先:精确匹配(语料 token 与词表条目完全同名)
simpleEntries.forEach(function (e) {
  const w = String(e.word).toLowerCase().trim();
  baseOfToken[w] = w;
  entryForms[w] = entryForms[w] || [w];
});
// 第 2 优先:规则派生形(ing/ed/s/es/er/est/…),且不得覆盖已定归属、
// 也不得占用不规则形(had/has 等交给 IRREGULAR 处理)
simpleEntries.forEach(function (e) {
  const w = String(e.word).toLowerCase().trim();
  if (w.length < 3) return;
  const forms = Array.from(ruleForms(w));
  entryForms[w] = forms;
  forms.forEach(function (f) {
    if (baseOfToken[f] || irregularSet.has(f)) return;
    baseOfToken[f] = w;
  });
});
// 第 3 优先:不规则形 → 词表条目(仅当词表里确有该基词)
Object.keys(IRREG_TO_BASE).forEach(function (f) {
  const base = IRREG_TO_BASE[f];
  if (entryForms[base] && !baseOfToken[f]) baseOfToken[f] = base;
});

/* ---------- 3. 归并统计 ---------- */
const agg = Object.create(null);   // 词表条目 -> {freq, years:Set, forms:{}}
function ensure(w) {
  if (!agg[w]) agg[w] = { freq: 0, years: new Set(), forms: Object.create(null) };
  return agg[w];
}
Object.keys(freq).forEach(function (tok) {
  const base = baseOfToken[tok];
  if (!base) return;
  const a = ensure(base);
  a.freq += freq[tok];
  a.forms[tok] = (a.forms[tok] || 0) + freq[tok];
  const ys = yearsOf[tok];
  if (ys) ys.forEach(function (y) { a.years.add(y); });
});

// 短语条目:在语料原文里做整串匹配(忽略大小写与多余空格)
const phraseEntries = list.filter(function (e) {
  const w = String(e.word || '').toLowerCase().trim();
  return w.indexOf(' ') >= 0 || w.indexOf('-') >= 0 || w.indexOf('(') >= 0;
});
const corpusText = corpus.map(r => r.text.toLowerCase().replace(/\s+/g, ' ')).join('\n');
phraseEntries.forEach(function (e) {
  const raw = String(e.word).toLowerCase().trim();
  const variants = new Set([raw]);
  variants.add(raw.replace(/\(an\)/g, '').replace(/\(s\)/g, 's').replace(/\(.*?\)/g, '').trim());
  variants.add(raw.replace(/-/g, ' '));
  variants.add(raw.replace(/ /g, '-'));
  let total = 0, hitVariant = '';
  variants.forEach(function (v) {
    v = v.trim();
    if (v.length < 3) return;
    const re = new RegExp('(^|[^a-z])' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'g');
    const m = corpusText.match(re);
    if (m && m.length > total) { total = m.length; hitVariant = v; }
  });
  const key = raw;
  const a = ensure(key);
  a.freq = total;
  a.forms[hitVariant || raw] = total;
});

/* ---------- 4. 输出 ---------- */
const rows = list.map(function (e) {
  const w = String(e.word || '').toLowerCase().trim();
  const key = (entryForms[w] || phraseEntries.indexOf(e) >= 0) ? w : w;
  const a = agg[key] || { freq: 0, years: new Set(), forms: {} };
  const top = Object.keys(a.forms).sort((x, y) => a.forms[y] - a.forms[x]).slice(0, 4)
    .map(f => f + ':' + a.forms[f]).join(' ');
  return {
    no: e.no, word: e.word, ph: e.ph || '', pos: e.pos || '', def: e.def || '',
    freq: a.freq, years: a.years.size, yearList: Array.from(a.years).sort().join('/'), topForms: top
  };
});
rows.sort((a, b) => (b.freq - a.freq) || String(a.word).localeCompare(String(b.word)));
const ranked = rows.map((r, i) => { r.rank = i + 1; return r; });

fs.writeFileSync(path.join(DIR, PREFIX + 'freq.json'), JSON.stringify(ranked, null, 1), 'utf8');
fs.writeFileSync(path.join(DIR, PREFIX + 'freq.tsv'),
  'rank\tno\tword\tph\tpos\tdef\tfreq\tyears\tyearList\ttopForms\n' +
  ranked.map(r => [r.rank, r.no, r.word, r.ph, r.pos, r.def, r.freq, r.years, r.yearList, r.topForms].join('\t')).join('\n'),
  'utf8');

const buckets = [0, 1, 3, 5, 8, 10, 15, 20, 30, 50, 100];
const lines = [];
lines.push('语料:' + corpus.length + ' 条记录,总词形(token)' + totalTokens + ' 个');
lines.push('词表条目:' + rows.length + '(其中短语/连字符条目 ' + phraseEntries.length + ')');
lines.push('');
lines.push('频次分布(累计条目数):');
buckets.forEach(function (b) {
  const n = ranked.filter(r => r.freq >= b).length;
  lines.push('  freq >= ' + String(b).padStart(3) + ' : ' + n + ' 个');
});
const yb = [0, 2, 3, 5, 8, 10, 12];
lines.push('');
lines.push('覆盖年份数分布(2010-2022 共 13 年,max=13):');
yb.forEach(function (b) {
  const n = ranked.filter(r => r.years >= b).length;
  lines.push('  years >= ' + String(b).padStart(2) + ' : ' + n + ' 个');
});
lines.push('');
lines.push('频次为 0 的条目(语料中未出现):' + ranked.filter(r => r.freq === 0).length + ' 个');
lines.push('');
lines.push('Top 40:');
ranked.slice(0, 40).forEach(function (r) { lines.push('  ' + r.rank + '. ' + r.word + ' (' + r.freq + ' 次, ' + r.years + ' 年)'); });
fs.writeFileSync(path.join(DIR, PREFIX + 'freq_report.txt'), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
