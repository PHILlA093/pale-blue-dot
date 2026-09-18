/* 检查 eng_parts/grammar.json 的真实结构,以及新 data_eng.js 里缺 book/ch 的点 */
const fs = require('fs');
function loadDb(p) {
    const r = fs.readFileSync(p, 'utf8');
    const e = r.indexOf('=', r.indexOf('window.'));
    let b = r.slice(e + 1).trim();
    if (b.endsWith(';')) b = b.slice(0, -1);
    return JSON.parse(b);
}
const g = JSON.parse(fs.readFileSync('E:\\workspace\\穷观\\_gaokao_work\\eng_parts\\grammar.json', 'utf8'));
console.log('=== grammar.json ===');
console.log('顶层字段: ' + JSON.stringify(Object.keys(g)));
console.log('boards 条数: ' + (g.boards || []).length + '  ' + JSON.stringify((g.boards || []).map(function (b) { return b.id + '/' + b.name + '/' + b.kind; })));
console.log('points 条数: ' + (g.points || []).length);
const p0 = (g.points || [])[0] || {};
console.log('point 字段: ' + JSON.stringify(Object.keys(p0)));
console.log('point 样例: ' + JSON.stringify({ id: p0.id, name: p0.name, board: p0.board, book: p0.book, ch: p0.ch, importance: p0.importance, core: p0.core }));
const ids = {};
(g.points || []).forEach(function (p) { ids[p.id] = (ids[p.id] || 0) + 1; });
console.log('重复 id: ' + Object.keys(ids).filter(function (k) { return ids[k] > 1; }).length);
const pre = {};
(g.points || []).forEach(function (p) { const m = /^([a-z]+-[a-z])-/.exec(p.id) || []; pre[m[1] || '?'] = (pre[m[1] || '?'] || 0) + 1; });
console.log('id 前缀分布: ' + JSON.stringify(pre));
const hub = (g.points || []).filter(function (p) { return /-u-/.test(p.id); }).length;
const gram = (g.points || []).filter(function (p) { return /-g-/.test(p.id); }).length;
console.log('枢纽点(-u-): ' + hub + '  语法点(-g-): ' + gram);

console.log('');
console.log('=== 新 data_eng.js 里的问题点 ===');
const d = loadDb('E:\\workspace\\穷观\\js\\data_eng.js');
const boardIds = new Set(d.boards.map(function (b) { return b.id; }));
const bad = d.points.filter(function (p) { return !boardIds.has(p.board); });
console.log('板块引用错误的点 ' + bad.length + ': ' + JSON.stringify(bad.slice(0, 3).map(function (p) { return { id: p.id, board: p.board }; })));
const nob = d.points.filter(function (p) { return !p.book || !p.ch; });
console.log('缺 book/ch 的点 ' + nob.length + ': ' + JSON.stringify(nob.slice(0, 5).map(function (p) { return { id: p.id, book: p.book, ch: p.ch }; })));
