/* ============================================================
 * 穷观 · 英语知识库重构生成器
 *
 * 输入:
 *   _gaokao_work\人教版高中英语_单元词表.json   人教版(2019) 7 册 36 单元的真实词表(2211 词 + 427 短语)
 *   _gaokao_work\eng_parts\grammar.json          单元枢纽点 + 语法讲解点(72 条,另一个代理产出;缺失时自动跳过)
 *   js\data_eng.js                               旧库(只保留三类有独立价值的工具内容:词根词缀/核心句型/语法知识)
 *
 * 输出:
 *   js\data_eng.js   新库:7 个教材册板块 + 3 个工具板块
 *
 * 重要度取值规则(写进文件头,可复核):
 *   词条按"教材词表内的先后顺序"分三档——教材一般按出现顺序排列,靠前=本单元更核心。
 *   这不是拍脑袋:用的是教材自身的排序,不引入任何外部主观判断。
 *   单元枢纽点 importance=4 core=5;语法点 importance=4 core=4。
 *
 * 用法: node build_eng.js [--write]
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = 'E:\\workspace\\穷观';
const OUT = path.join(ROOT, 'js', 'data_eng.js');
const WRITE = process.argv.includes('--write');

function loadDb(p) {
    const raw = fs.readFileSync(p, 'utf8');
    const i = raw.indexOf('window.');
    const eq = raw.indexOf('=', i);
    let body = raw.slice(eq + 1).trim();
    if (body.endsWith(';')) body = body.slice(0, -1);
    return JSON.parse(body);
}

const wl = JSON.parse(fs.readFileSync(path.join(ROOT, '_gaokao_work', '人教版高中英语_单元词表.json'), 'utf8'));
// 工具板块(词根词缀/核心句型/语法知识)必须取自**原始**英语库:
// 本脚本会重写 js\data_eng.js,若再从它读,第二次运行就会把工具板块读没(自噬)。
// 因此固定读最早的那份备份(.bak_*),它保存着重构前的 1978 点原库。
function pickOriginal() {
    const dir = path.join(ROOT, 'js');
    const baks = fs.readdirSync(dir).filter(function (f) { return /^data_eng\.js\.bak_\d+$/.test(f); }).sort();
    if (!baks.length) throw new Error('找不到 data_eng.js 的原始备份,无法取工具板块');
    return path.join(dir, baks[0]);
}
const ORIGINAL = pickOriginal();
console.log('工具板块取自原始备份: ' + path.basename(ORIGINAL));
const old = loadDb(ORIGINAL);
let extra = null;
const gp = path.join(ROOT, '_gaokao_work', 'eng_parts', 'grammar.json');
if (fs.existsSync(gp)) extra = JSON.parse(fs.readFileSync(gp, 'utf8'));
else console.log('(提示: eng_parts\\grammar.json 还不存在,本轮先生成词表与工具板块;它到位后重跑即可补上 72 个点)');

const BOOK_ID = { '必修第一册': 'eng-bx1', '必修第二册': 'eng-bx2', '必修第三册': 'eng-bx3', '选择性必修第一册': 'eng-xx1', '选择性必修第二册': 'eng-xx2', '选择性必修第三册': 'eng-xx3', '选择性必修第四册': 'eng-xx4' };

const boards = [];
const points = [];
wl.books.forEach(function (b) {
    const bid = BOOK_ID[b.name];
    if (!bid) throw new Error('未知册名: ' + b.name);
    boards.push({ id: bid, name: b.name, kind: 'major' });
});

// ---- 单元枢纽点 id 表(供词条/短语挂链) ----
const unitHubId = {};   // 册名 + '|' + unit -> id
let seqW = 0, seqP = 0;
wl.books.forEach(function (b) {
    b.units.forEach(function (u) {
        const short = b.name.replace('选择性必修', '选必').replace('必修', '必修');
        const key = b.name + '|' + u.unit;
        unitHubId[key] = extra ? null : null;   // 枢纽点由 grammar.json 提供,稍后回填
    });
});

// ---- 工具板块:保留旧库三类内容 ----
const KEEP = { roots: { id: 'eng-roots', name: '词根词缀', kind: 'minor' }, sentence: { id: 'eng-sentence', name: '核心句型', kind: 'minor' }, grammar: { id: 'eng-grammar', name: '语法知识', kind: 'minor' } };
const kept = [];
old.points.forEach(function (p) {
    const k = KEEP[p.board];
    if (!k) return;
    const item = {
        id: p.id, name: p.name, board: k.id,
        importance: p.importance, core: p.core,
        keywords: p.keywords || [], content: p.content,
        links: [],                       // 旧链接指向被淘汰的点,统一清空后重建
        book: '工具', ch: k.name
    };
    kept.push(item);
    points.push(item);                   // ← 必须真的并进结果里
});
Object.keys(KEEP).forEach(function (k) { boards.push(KEEP[k]); });

// ---- 教材词表:词条 + 短语 ----
const UNIT_TITLE = {};   // key -> {title, grammar, bid}
wl.books.forEach(function (b) {
    const bid = BOOK_ID[b.name];
    b.units.forEach(function (u) {
        const key = b.name + '|' + u.unit;
        UNIT_TITLE[key] = { title: u.title, grammar: (u.grammar || []).join('、'), bid: bid, name: b.name, unit: u.unit };
        const label = u.unit === 0 ? 'Welcome Unit' : 'Unit ' + u.unit;
        // 单元标题与 label 重复时(必修一 Welcome Unit 的 title 就是 "Welcome Unit")不要再拼一遍
        const titleSuffix = (u.title && u.title !== label) ? ' ' + u.title : '';
        const unitText = label + titleSuffix;
        // 词条
        (u.words || []).forEach(function (w, i) {
            const n = (u.words || []).length;
            const rank = i / Math.max(1, n - 1);            // 0=最靠前
            const imp = rank < 0.34 ? 3 : (rank < 0.67 ? 2 : 1);
            const core = rank < 0.34 ? 4 : (rank < 0.67 ? 3 : 2);
            const lines = ['**词条**', w.en + (w.ph ? '  ' + w.ph : ''),
                '**释义**', (w.pos ? w.pos + ' ' : '') + (w.cn || '')];
            lines.push('**教材位置**', '人教版(2019)' + b.name + ' · ' + label + (u.title ? ' ' + u.title : '') + (UNIT_TITLE[key].grammar ? '(本单元语法:' + UNIT_TITLE[key].grammar + ')' : ''));
            points.push({
                id: 'eng-w-' + String(++seqW).padStart(4, '0'),
                name: w.en, board: bid, importance: imp, core: core,
                keywords: [w.en, label].concat(u.title ? [u.title] : []).concat(w.pos ? [w.pos] : []),
                content: lines.join('\n'), links: [],
                book: b.name, ch: label + (u.title ? ' ' + u.title : ''),
                note: w.proper ? '专有名词' : ''
            });
        });
        // 短语
        (u.phrases || []).forEach(function (ph, i) {
            const n = (u.phrases || []).length;
            const rank = i / Math.max(1, n - 1);
            points.push({
                id: 'eng-p-' + String(++seqP).padStart(4, '0'),
                name: ph.en, board: bid,
                importance: rank < 0.5 ? 3 : 2, core: rank < 0.5 ? 4 : 3,
                keywords: [ph.en, label, '短语'].concat(u.title ? [u.title] : []),
                content: ['**短语**', ph.en, '**释义**', ph.cn || '', '**教材位置**',
                    '人教版(2019)' + b.name + ' · ' + label + (u.title ? ' ' + u.title : '')].join('\n'),
                links: [], book: b.name, ch: label + (u.title ? ' ' + u.title : '')
            });
        });
    });
});

// ---- 单元枢纽点 + 语法点(来自 grammar.json) ----
let extraAdded = 0;
if (extra) {
    (extra.boards || []).forEach(function (b) {
        if (!boards.some(function (x) { return x.id === b.id; })) boards.push(b);
    });
    (extra.points || []).forEach(function (p) {
        points.push({
            id: p.id, name: p.name, board: p.board, importance: p.importance, core: p.core,
            keywords: p.keywords || [], content: p.content, links: p.links || [], book: p.book, ch: p.ch
        });
        extraAdded++;
        const m = /^eng-u-(bx1|bx2|bx3|xx1|xx2|xx3|xx4)-(\d+)$/.exec(p.id);
        if (m) {
            const full = { bx1: '必修第一册', bx2: '必修第二册', bx3: '必修第三册', xx1: '选择性必修第一册', xx2: '选择性必修第二册', xx3: '选择性必修第三册', xx4: '选择性必修第四册' }[m[1]];
            unitHubId[full + '|' + Number(m[2])] = p.id;
        }
    });
}

// ---- 挂链:词条/短语 -> 单元枢纽点;枢纽点 -> 语法点 ----
let linked = 0;
if (extra) {
    points.forEach(function (p) {
        if (!/^eng-[wp]-/.test(p.id)) return;
        // ch 形如 "Unit 1 Teenage Life" 或 "Welcome Unit";册名从 p.book 取
        const m = /^(Welcome Unit|Unit (\d+))/.exec(p.ch || '');
        if (!m) return;
        const unitNo = m[1] === 'Welcome Unit' ? 0 : Number(m[2]);
        const hub = unitHubId[p.book + '|' + unitNo];
        if (hub) { p.links = [hub]; linked++; }
    });
}

// ---- 校验 ----
const ids = new Set();
let dupId = [];
points.forEach(function (p) { if (ids.has(p.id)) dupId.push(p.id); ids.add(p.id); });
const boardIds = new Set(boards.map(function (b) { return b.id; }));
const badBoard = points.filter(function (p) { return !boardIds.has(p.board); }).length;
let dangling = 0;
points.forEach(function (p) { (p.links || []).forEach(function (t) { if (!ids.has(t)) dangling++; }); });
const byBoard = {};
points.forEach(function (p) { byBoard[p.board] = (byBoard[p.board] || 0) + 1; });

console.log('板块 ' + boards.length + ': ' + boards.map(function (b) { return b.name + '(' + (byBoard[b.id] || 0) + ')'; }).join(' '));
console.log('知识点总数 ' + points.length + '(词 ' + seqW + ' + 短语 ' + seqP + ' + 工具 ' + kept.length + ' + 枢纽语法 ' + extraAdded + ')');
console.log('重复 id ' + dupId.length + (dupId.length ? ': ' + dupId.slice(0, 5).join(',') : ''));
console.log('悬空链接 ' + dangling + '  板块引用错误 ' + badBoard + '  已挂链 ' + linked);

if (WRITE) {
    const bak = OUT + '.bak_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    fs.copyFileSync(OUT, bak);
    const head = [
        '/* ============================================================',
        ' * 穷观 · 高中英语知识库(人教版 2019 课标版重构)',
        ' *',
        ' * 结构:',
        ' *   boards:7 个教材册板块(必修一~二~三 / 选择性必修一~四)+ 3 个工具板块(词根词缀 / 核心句型 / 语法知识)',
        ' *   points:',
        ' *     · 词条   —— 逐条来自人教版单元词表(英文 + 音标 + 词性 + 中文释义 + 教材单元归属)',
        ' *     · 短语   —— 逐条来自人教版单元词表',
        ' *     · 单元枢纽点 + 语法点 —— 每单元一个枢纽点与一个语法讲解点,与词条/短语互相关联',
        ' *     · 工具板块 —— 词根词缀 / 核心句型 / 语法知识(由旧库保留,内容独立于教材册次)',
        ' *',
        ' * importance/core 取值规则:',
        ' *   词条按教材词表内的先后顺序分三档(教材一般按出现顺序排列,靠前=本单元更核心),',
        ' *   不引入任何外部主观判断;短语按前后两档;枢纽点 4/5,语法点 4/4。',
        ' *   importance=1~5 → 3D 高度;core=1~5 → 3D 半径。',
        ' *',
        ' * 词表来源:人教版(2019)高中英语 7 册 36 单元教材词表(教材 PDF 抽取,双源交叉核对)。',
        ' * ============================================================ */'
    ].join('\n');
    fs.writeFileSync(OUT, head + '\nwindow.ENG_DB = ' + JSON.stringify({ version: '2.0', subject: 'eng', subjectName: '高中英语', boards: boards, points: points }, null, 2) + ';\n', 'utf8');
    console.log('已写回 ' + OUT + ' (备份 ' + path.basename(bak) + ')');
} else {
    console.log('(dry-run,加 --write 才写回)');
}
