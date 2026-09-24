/* 从 GaokaoBench 高考英语真题 CSV 抽取英文原文语料
 * 输入:E:\workspace\穷观\_gaokao_work\bench\gaokao_bench\Multiple-choice_Questions\*.csv
 * 输出:_gaokao_work\corpus.jsonl(每行 {year,category,file,text})+ corpus_stats.txt
 * 只保留英文正文;剔除中文段落与标点噪音。
 */
const fs = require('fs');
const path = require('path');

const DIR = 'E:/workspace/穷观/_gaokao_work';
const SRC = path.join(DIR, 'bench/gaokao_bench/Multiple-choice_Questions');
const FILES = [
  '2010-2013_English_MCQs.csv',
  '2010-2022_English_Reading_Comp.csv',
  '2012-2022_English_Cloze_Test.csv',
  '2010-2022_English_Fill_in_Blanks.csv'
];

// 简易 CSV 解析(支持引号包裹、字段内换行与逗号)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// 只保留英文:去掉 CJK 与全角标点,压缩空白
function englishOnly(s) {
  let t = String(s || '');
  t = t.replace(/[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF\u2018\u2019\u201C\u201D]/g, ' ');
  t = t.replace(/\r/g, '\n');
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{2,}/g, '\n');
  return t.trim();
}

const out = [];
const stats = [];
for (const f of FILES) {
  const p = path.join(SRC, f);
  const rows = parseCSV(fs.readFileSync(p, 'utf8'));
  const head = rows[0];
  const iYear = head.indexOf('year');
  const iCat = head.indexOf('category');
  const iQ = head.indexOf('question');
  let kept = 0, words = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length <= iQ) continue;
    const txt = englishOnly(row[iQ]);
    const w = (txt.match(/[A-Za-z][A-Za-z'\-]*/g) || []).length;
    if (w < 15) continue;                       // 太短的多为纯中文题干,丢弃
    out.push({ year: String(row[iYear] || '').trim(), category: String(row[iCat] || '').trim(), file: f, text: txt });
    kept++; words += w;
  }
  stats.push(`${f}\t记录 ${kept}\t英文词 ${words}`);
  console.log(`[extract] ${f}: kept=${kept} words=${words}`);
}

fs.writeFileSync(path.join(DIR, 'corpus.jsonl'), out.map(o => JSON.stringify(o)).join('\n'), 'utf8');
const totalWords = out.reduce((a, o) => a + (o.text.match(/[A-Za-z][A-Za-z'\-]*/g) || []).length, 0);
const years = {};
out.forEach(o => { if (o.year) years[o.year] = (years[o.year] || 0) + 1; });
fs.writeFileSync(path.join(DIR, 'corpus_stats.txt'),
  ['来源:GaokaoBench(2010-2022 高考英语真题 CSV)', ...stats,
    `记录总数 ${out.length}`, `英文总词数 ${totalWords}`,
    '年份分布 ' + Object.keys(years).sort().map(y => y + ':' + years[y]).join(' ')
  ].join('\n'), 'utf8');
console.log(`[extract] total records=${out.length} words=${totalWords}`);
