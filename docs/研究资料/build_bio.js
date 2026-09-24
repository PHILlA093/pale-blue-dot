/* ============================================================
 * 穷观 · 生物知识库合并生成器
 *
 * 输入:_gaokao_work\bio_parts\{c1,c2,x1,x2,x3}.json
 *   (5 个子代理按册产出,每个 {book, board, points[]})
 * 输出:js\data_bio.js  → window.BIO_DB
 *
 * 板块 = 教材册次(必修1/2 + 选择性必修1/2/3),各配一个区分色;
 * 双向补链:任何 A→B 的链接都自动补上 B→A,保证 3D 连线对称。
 *
 * 用法: node build_bio.js [--write]
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = 'E:\\workspace\\穷观';
const PARTS = path.join(ROOT, '_gaokao_work', 'bio_parts');
const OUT = path.join(ROOT, 'js', 'data_bio.js');
const WRITE = process.argv.includes('--write');

// 册顺序即板块顺序;颜色与其它三科的调色板错开
const BOOKS = [
    { file: 'c1.json', book: '必修1', id: 'bio-cell', name: '分子与细胞', color: '#66bb6a' },
    { file: 'c2.json', book: '必修2', id: 'bio-genetics', name: '遗传与进化', color: '#ab47bc' },
    { file: 'x1.json', book: '选择性必修1', id: 'bio-homeostasis', name: '稳态与调节', color: '#ff7043' },
    { file: 'x2.json', book: '选择性必修2', id: 'bio-eco', name: '生物与环境', color: '#26a69a' },
    { file: 'x3.json', book: '选择性必修3', id: 'bio-tech', name: '生物技术与工程', color: '#5c6bc0' }
];

const boards = [], points = [], missing = [];
BOOKS.forEach(function (b) {
    const p = path.join(PARTS, b.file);
    if (!fs.existsSync(p)) { missing.push(b.file); return; }
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    boards.push({ id: b.id, name: b.name, kind: 'major', color: b.color });
    (j.points || []).forEach(function (pt) {
        points.push({
            id: pt.id, name: pt.name, board: b.id,
            importance: pt.importance, core: pt.core,
            keywords: pt.keywords || [], content: pt.content,
            links: (pt.links || []).slice(),
            book: pt.book || b.book, ch: pt.ch
        });
    });
});

// ---- 双向补链 ----
const byId = {};
points.forEach(function (p) { byId[p.id] = p; });
let linked = 0, dangling = [];
points.forEach(function (p) {
    p.links.forEach(function (t) {
        const tp = byId[t];
        if (!tp) { dangling.push(p.id + '->' + t); return; }
        if (tp.links.indexOf(p.id) < 0) { tp.links.push(p.id); linked++; }
    });
});
// 去掉悬空链接,保持数据干净
if (dangling.length) {
    const bad = {};
    dangling.forEach(function (s) { bad[s] = 1; });
    points.forEach(function (p) {
        p.links = p.links.filter(function (t) { return !!byId[t]; });
    });
}

// ---- 校验 ----
const ids = new Set();
const dupId = [];
points.forEach(function (p) { if (ids.has(p.id)) dupId.push(p.id); ids.add(p.id); });
const boardIds = new Set(boards.map(function (b) { return b.id; }));
const badBoard = points.filter(function (p) { return !boardIds.has(p.board); }).map(function (p) { return p.id; });
const SECTIONS = ['**定义/概念**', '**核心过程/关键内容**', '**方法/思路**', '**常考题型与考法**', '**易错提示**'];
const badSec = [], badVal = [], badLen = [], badBook = [];
points.forEach(function (p) {
    const c = String(p.content || '');
    const miss = SECTIONS.filter(function (s) { return c.indexOf(s) < 0; });
    if (miss.length) badSec.push(p.id + ' 缺 ' + miss.join(','));
    if (!(p.importance >= 1 && p.importance <= 5) || !(p.core >= 1 && p.core <= 5)) badVal.push(p.id);
    const n = c.replace(/\s/g, '').length;
    if (n < 300 || n > 900) badLen.push(p.id + '(' + n + ')');
    if (!p.book || !p.ch) badBook.push(p.id);
});
const byBoard = {};
points.forEach(function (p) { byBoard[p.board] = (byBoard[p.board] || 0) + 1; });

console.log('缺的册文件: ' + (missing.length ? missing.join(', ') : '无'));
console.log('板块 ' + boards.length + ': ' + boards.map(function (b) { return b.name + '(' + (byBoard[b.id] || 0) + ')'; }).join(' '));
console.log('知识点总数 ' + points.length);
console.log('重复 id ' + dupId.length + (dupId.length ? ': ' + dupId.slice(0, 5).join(',') : ''));
console.log('板块引用错误 ' + badBoard.length + (badBoard.length ? ': ' + badBoard.slice(0, 5).join(',') : ''));
console.log('段名缺失 ' + badSec.length + (badSec.length ? ': ' + badSec.slice(0, 3).join(' | ') : ''));
console.log('importance/core 越界 ' + badVal.length + '  字数越界 ' + badLen.length + (badLen.length ? ': ' + badLen.slice(0, 3).join(',') : ''));
console.log('缺 book/ch ' + badBook.length + '  双向补链 ' + linked + '  清理掉的悬空链接 ' + dangling.length);
const imp = {};
points.forEach(function (p) { imp[p.importance] = (imp[p.importance] || 0) + 1; });
console.log('importance 分布 ' + JSON.stringify(imp));

if (WRITE) {
    if (missing.length) { console.log('!! 还有册文件没到,先不写'); process.exit(1); }
    if (dupId.length || badBoard.length || badSec.length || badVal.length || badBook.length) { console.log('!! 有校验错误,先不写'); process.exit(1); }
    const head = [
        '/* ============================================================',
        ' * 穷观 · 高中生物知识库(人教版 2019 课标版)',
        ' *',
        ' * 结构:',
        ' *   boards:5 个板块 = 教材 5 册(必修1 分子与细胞 / 必修2 遗传与进化 /',
        ' *           选择性必修1 稳态与调节 / 选择性必修2 生物与环境 / 选择性必修3 生物技术与工程)',
        ' *   points:按教材「章 → 节」组织,每点含定义/核心过程/方法/题型/易错五段;',
        ' *          实验与探究类内容单独成点(如"观察根尖分生区组织细胞的有丝分裂")。',
        ' *',
        ' * importance=1~5 → 3D 高度;core=1~5 → 3D 半径;links → 知识点连线(双向对称)。',
        ' * 章节依据:人教社 2019 课标版教材 PDF 目录页实测(5 册 25 章 82 节,已交叉验证)。',
        ' * ============================================================ */'
    ].join('\n');
    const bak = OUT + '.bak_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    if (fs.existsSync(OUT)) fs.copyFileSync(OUT, bak);
    fs.writeFileSync(OUT, head + '\nwindow.BIO_DB = ' + JSON.stringify({
        version: '1.0', subject: 'bio', subjectName: '高中生物', boards: boards, points: points
    }, null, 2) + ';\n', 'utf8');
    console.log('已写回 ' + OUT + (fs.existsSync(bak) ? ' (备份 ' + path.basename(bak) + ')' : ''));
} else {
    console.log('(dry-run,加 --write 才写回)');
}
