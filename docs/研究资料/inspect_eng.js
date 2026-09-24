/* 查旧英语库:板块构成、词根点数量与样例、重名情况(供英语重构决策) */
const fs = require('fs');
function loadDb(p) {
    const raw = fs.readFileSync(p, 'utf8');
    const i = raw.indexOf('window.');
    const eq = raw.indexOf('=', i);
    let body = raw.slice(eq + 1).trim();
    if (body.endsWith(';')) body = body.slice(0, -1);
    return JSON.parse(body);
}
const eng = loadDb('E:\\workspace\\穷观\\js\\data_eng.js');
console.log('=== 旧英语库 ===');
console.log('总点数 ' + eng.points.length + '  板块 ' + eng.boards.length);
eng.boards.forEach(function (b) {
    const list = eng.points.filter(function (p) { return p.board === b.id; });
    console.log('  [' + b.id + '] ' + b.name + '  (' + b.kind + ')  ' + list.length + ' 点');
    if (list[0]) console.log('      例: ' + list[0].name + ' | ' + String(list[0].content || '').replace(/\n/g, ' ').slice(0, 120));
});
// 重名
const dup = {};
eng.points.forEach(function (p) { dup[p.name] = (dup[p.name] || 0) + 1; });
const d = Object.keys(dup).filter(function (k) { return dup[k] > 1; });
console.log('重名 ' + d.length + ' 组:' + (d.length ? ' ' + d.slice(0, 8).join(' / ') : ''));
// id 前缀分布
const pre = {};
eng.points.forEach(function (p) { const m = /^([a-z]+)-/.exec(p.id); const k = m ? m[1] : '(无前缀)'; pre[k] = (pre[k] || 0) + 1; });
console.log('id 前缀分布: ' + JSON.stringify(pre));
console.log('字段样例: ' + JSON.stringify(Object.keys(eng.points[0])));
