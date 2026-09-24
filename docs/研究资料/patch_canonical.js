/* 往 canonical.json 补入真正缺失的高频词(much/most/us + 高频美式拼写)
 * 这些词在所有流行"3500 词表"里都缺,但高考真题语料里频次很高。
 */
const fs = require('fs');
const DIR = 'E:/workspace/穷观/_gaokao_work';
const rows = JSON.parse(fs.readFileSync(DIR + '/canonical.json', 'utf8'));
const have = new Set(rows.map(r => String(r.word).toLowerCase().trim()));

const ADD = [
  { word: 'much', ph: 'mʌtʃ', pos: 'adj. adv. pron.', def: '许多的；大量的；非常', note: '功能词补录' },
  { word: 'most', ph: 'məʊst', pos: 'adj. adv. pron.', def: '最多的；大部分的；最', note: '功能词补录' },
  { word: 'us', ph: 'ʌs; əs', pos: 'pron.', def: '我们（宾格）', note: '功能词补录' },
  { word: 'program', ph: 'ˈprəʊɡræm', pos: 'n. v.', def: '节目；计划；程序；编程（英式 programme）', note: '美式拼写补录' },
  { word: 'theater', ph: 'ˈθɪətə(r)', pos: 'n.', def: '剧院；戏院；戏剧（英式 theatre）', note: '美式拼写补录' },
  { word: 'color', ph: 'ˈkʌlə(r)', pos: 'n. v.', def: '颜色；给……着色（英式 colour）', note: '美式拼写补录' },
  { word: 'realize', ph: 'ˈriːəlaɪz', pos: 'v.', def: '认识到；了解；实现（英式 realise）', note: '美式拼写补录' },
  { word: 'favorite', ph: 'ˈfeɪvərɪt', pos: 'adj. n.', def: '最喜爱的；最喜爱的人（物）（英式 favourite）', note: '美式拼写补录' },
  { word: 'honor', ph: 'ˈɒnə(r)', pos: 'n. v.', def: '荣誉；敬意；尊敬（英式 honour）', note: '美式拼写补录' },
  { word: 'neighborhood', ph: 'ˈneɪbəhʊd', pos: 'n.', def: '邻近地区；街区（英式 neighbourhood）', note: '美式拼写补录' },
  { word: 'online', ph: 'ˌɒnˈlaɪn', pos: 'adj. adv.', def: '在线的；联网的；在线地', note: '真题高频补录' },
  { word: 'fashion', ph: 'ˈfæʃn', pos: 'n.', def: '时尚；流行；方式', note: '真题高频补录' }
];

let added = 0;
ADD.forEach(function (a) {
  if (have.has(a.word.toLowerCase())) return;
  rows.push({ word: a.word, ph: a.ph, pos: a.pos, def: a.def, srcs: ['补录'], books: [], units: [], note: a.note });
  added++;
});
rows.sort((a, b) => String(a.word).toLowerCase().localeCompare(String(b.word).toLowerCase()));
fs.writeFileSync(DIR + '/canonical.json', JSON.stringify(rows, null, 1), 'utf8');
console.log('补录 ' + added + ' 条,现共 ' + rows.length + ' 条');
