/* ============================================================
 * 数学教材归属的修正(依据:人教版章节结构.md —— 27/30 册来自真实 PDF 目录页实测)
 *
 * 本次修正:
 *   stat-geo 几何概型 → 旧课标。实测人教A版(2019)必修二第十章只有
 *   10.1 随机事件与概率 / 10.2 事件的相互独立性 / 10.3 频率与概率,没有几何概型。
 *
 * 用法: node fix_math_ch.js [--write]
 * ============================================================ */
const fs = require('fs');
const FILE = 'E:\\workspace\\穷观\\js\\data.js';
const WRITE = process.argv.includes('--write');

// id -> [册, 章, 备注]
const FIX = {
    'stat-geo': ['拓展', '旧课标(2019 已删)', '必修二第十章已无几何概型(实测目录)'],
    // 三视图已删、直观图保留:标注更精确的节级位置
    'solid-views': ['必修二', '第8章 立体几何初步(8.2 直观图;三视图已删)']
};

const raw = fs.readFileSync(FILE, 'utf8');
const cut = raw.indexOf('window.MATH_DB');
const head = raw.slice(0, cut);
const jsonText = raw.slice(cut).replace(/^window\.MATH_DB\s*=\s*/, '').replace(/;\s*$/, '');
const db = JSON.parse(jsonText);

let n = 0;
for (const id of Object.keys(FIX)) {
    const p = db.points.find(x => x.id === id);
    if (!p) { console.log('!! 库里没有 ' + id); continue; }
    const [book, ch, why] = FIX[id];
    console.log(p.name + ':  ' + p.book + ' · ' + p.ch + '   →   ' + book + ' · ' + ch + (why ? '   (' + why + ')' : ''));
    p.book = book; p.ch = ch;
    n++;
}

const by = {};
db.points.forEach(x => { by[x.book] = (by[x.book] || 0) + 1; });
console.log('修正 ' + n + ' 条;知识点总数 ' + db.points.length + ';按册分布 ' + JSON.stringify(by));

if (WRITE) {
    const bak = FILE + '.bak_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    fs.copyFileSync(FILE, bak);
    fs.writeFileSync(FILE, head + 'window.MATH_DB = ' + JSON.stringify(db, null, 2) + ';\n', 'utf8');
    console.log('已写回 (备份 ' + require('path').basename(bak) + ')');
} else {
    console.log('(dry-run)');
}
