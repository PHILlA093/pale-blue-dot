/* 生成 Word 文档数据(高频/普通分区,并集词表 + 教材出处)→ doc_data.json
 * 输入:_gaokao_work\union_freq.json(并集词表 + 高考真题频次,由 count.js 产出)
 *      _gaokao_work\textbook_words_B.jsonl(人教版 18 册课本单词表)
 * 输出:_gaokao_work\doc_data.json
 */
const fs = require('fs');
const D = 'E:/workspace/穷观/_gaokao_work/';
const HIGH_CUT = 15;                 // 高频判定:高考真题语料出现 ≥ 15 次

const rows = JSON.parse(fs.readFileSync(D + 'union_freq.json', 'utf8'));

/* ---- 教材出处:册(单元) ---- */
const NEW_BOOKS = ['必修1', '必修2', '必修3', '选择性必修1', '选择性必修2', '选择性必修3', '选择性必修4'];
const tb = new Map();
fs.readFileSync(D + 'textbook_words_B.jsonl', 'utf8').split('\n').filter(Boolean).forEach(function (l) {
  let r; try { r = JSON.parse(l); } catch (e) { return; }
  if (!r || !r.word) return;
  const k = String(r.word).toLowerCase().replace(/\s+/g, ' ').trim();
  const cur = tb.get(k) || { books: {}, units: {} };
  if (r.book) {
    cur.books[r.book] = 1;
    if (r.unit) cur.units[r.book + ' ' + r.unit] = 1;
  }
  tb.set(k, cur);
});
function tbText(word) {
  const t = tb.get(String(word).toLowerCase().replace(/\s+/g, ' ').trim());
  if (!t) return '高中课本未单列(基础词)';
  const books = Object.keys(t.books);
  const newB = NEW_BOOKS.filter(b => books.indexOf(b) >= 0);
  const oldB = books.filter(b => NEW_BOOKS.indexOf(b) < 0);
  const parts = [];
  newB.slice(0, 2).forEach(function (b) {
    const unit = Object.keys(t.units).filter(u => u.indexOf(b + ' ') === 0)[0];
    parts.push(b + (unit ? ' ' + unit.replace(b + ' ', '') : ''));
  });
  if (oldB.length) parts.push(oldB.slice(0, 1)[0].replace('旧版', '旧版 '));
  if (!newB.length && !oldB.length) return '教材';
  return parts.join(' / ');
}

const total = rows.length;
const single = rows.filter(r => String(r.word).indexOf(' ') < 0 && String(r.word).indexOf('-') < 0).length;
const high = rows.filter(r => r.freq >= HIGH_CUT).sort((a, b) => b.freq - a.freq || String(a.word).localeCompare(String(b.word)));
const normal = rows.filter(r => r.freq < HIGH_CUT).sort((a, b) => String(a.word).toLowerCase().localeCompare(String(b.word).toLowerCase()));
const totalFreq = rows.reduce((a, b) => a + b.freq, 0);
const covHigh = high.reduce((a, b) => a + b.freq, 0) / totalFreq;
const NO_TB_LABEL = '高中课本未单列';
const inTb = rows.filter(r => tbText(r.word).indexOf(NO_TB_LABEL) !== 0).length;
const noTb = total - inTb;
const noFreq = rows.filter(r => r.freq === 0).length;

const corpusRecs = 713, corpusWords = 167513;
const notes = [
  '一、词表范围:共 ' + total + ' 条(单词型 ' + single + ' 条,其余为课本短语/搭配 ' + (total - single) + ' 条)。' +
    '来源 = 人教版高中英语课本单词表(新版必修1-3 + 选择性必修1-4 共 7 册,旧版必修1-5 + 选修6-11 共 11 册,合计 18 册 6653 个词条)' +
    ' ∪ 高考考纲词汇表,合并去重后得到本清单。',
  '二、教材出处列:标注该词出自哪一册、哪个单元(优先显示 2019 新版 7 册;旧版 11 册标注为「旧版 x」)。' +
    '标为「高中课本未单列(基础词)」的 ' + noTb + ' 条,是因为课本每单元课后单词表只列"本单元新词",' +
    '像 the、to、have 这类小学/初中已掌握的基础词不会重复列出——它们仍在高考词汇范围内,故一并保留。',
  '三、高频判定依据(以高考为准):统计 2008–2022 年高考英语真题英文原文 ' + corpusRecs + ' 篇、共 ' +
    corpusWords.toLocaleString('en-US') + ' 词,对每个词做词形还原(复数、时态、比较级、不规则变化)后计数。',
  '四、分区规则:真题出现 ≥ ' + HIGH_CUT + ' 次 → 高频词(共 ' + high.length + ' 条,覆盖语料 ' + (covHigh * 100).toFixed(1) +
    '% 的词次);不足 ' + HIGH_CUT + ' 次 → 普通词(共 ' + normal.length + ' 条,其中 ' + noFreq + ' 条在本次真题语料中未出现,多为课本进阶词与专有名词)。',
  '五、可调阈值:更严取 ≥ 20 次 → ' + rows.filter(r => r.freq >= 20).length + ' 条;更宽取 ≥ 10 次 → ' +
    rows.filter(r => r.freq >= 10).length + ' 条。表中「高考真题频次」列给出实际次数与覆盖年份数,可自行筛选。',
  '六、真题语料取自公开高考英语真题数据集(AGIEval gaokao-english、GAOKAO-Bench、GaokaoBench 2010–2022),' +
    '已做跨来源近重复消除,避免同一篇章重复计数。音标与释义取自多份公开词表与词典数据。',
  '七、排列方式:高频词按真题频次降序(最该优先掌握的在最前);普通词按字母序。'
];

const data = {
  meta: {
    title: '高考英语词汇清单 · 高频词 / 普通词(教材口径)',
    subtitle: '人教版高中英语课本单词表(18 册) ∪ 高考考纲词汇  ·  共 ' + total + ' 条(高频 ' + high.length + ' · 普通 ' + normal.length + ')',
    notes: notes,
    footer: '穷观 · 英语词表   |   高频口径:2008–2022 高考真题语料出现 ≥ ' + HIGH_CUT + ' 次   |   生成时间 ' + new Date().toLocaleString('zh-CN')
  },
  columns: ['序号', '单词', '音标', '词性 · 释义', '高考真题频次', '教材出处'],
  sections: [
    {
      title: '一、高频词(' + high.length + ' 条,按高考真题频次降序)',
      lines: ['说明:这些词在 2008–2022 高考英语真题中出现 ≥ ' + HIGH_CUT + ' 次,合计覆盖语料 ' + (covHigh * 100).toFixed(1) + '% 的词次,是备考优先突破对象。'],
      rows: high.map((r, i) => ({ no: i + 1, word: r.word, ph: r.ph || '', pos: r.pos || '', def: r.def || '', freq: r.freq, years: r.years, tb: tbText(r.word) }))
    },
    {
      title: '二、普通词(' + normal.length + ' 条,按字母序)',
      lines: ['说明:真题出现次数不足 ' + HIGH_CUT + ' 次(其中 ' + noFreq + ' 条在本次语料中未出现),基础词已多在前一节,本节以课本进阶词、专业与场景词为主。'],
      rows: normal.map((r, i) => ({ no: i + 1, word: r.word, ph: r.ph || '', pos: r.pos || '', def: r.def || '', freq: r.freq, years: r.years, tb: tbText(r.word) }))
    }
  ]
};
fs.writeFileSync(D + 'doc_data.json', JSON.stringify(data, null, 1), 'utf8');
console.log('doc_data.json:高频 ' + high.length + ' / 普通 ' + normal.length + ' / 总 ' + total);
console.log('高频前 8: ' + high.slice(0, 8).map(r => r.word + '(' + r.freq + ')').join(', '));
console.log('高频中带课本出处的比例: ' + (high.filter(r => tbText(r.word).indexOf(NO_TB_LABEL) !== 0).length / high.length * 100).toFixed(1) + '%');
console.log('全表带课本出处: ' + inTb + ' / ' + total + ' (' + (inTb / total * 100).toFixed(1) + '%)');
console.log('样例教材列: ' + ['campus', 'abandon', 'exchange', 'the', 'have'].map(w => { const r = rows.filter(x => String(x.word).toLowerCase() === w)[0]; return w + '→' + (r ? tbText(r.word) : 'N/A'); }).join(' | '));
