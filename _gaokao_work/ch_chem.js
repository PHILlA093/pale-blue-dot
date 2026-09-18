/* ============================================================
 * 穷观 · 化学知识点补「人教版教材归属」
 * 依据:_gaokao_work\人教版高中章节结构.md(人教版 2019 课标版,19 章,PDF 目录页实测)
 *
 * 体例要点(实测确认):
 *   · 化学必修册章号也跨册连续:必修一 1-4 章、必修二 5-8 章;选择性必修各册重新起算。
 *   · 化学印刷目录里"节"一律用中文序数(第一节/第二节),不用 1.1 小数 —— 本表做到章级,不写节号。
 *   · 「整理与提升」(章末栏目)不是节。
 *   · 纯高考专题(实验/用语/NA 判断/同分异构/有机推断/工艺流程)教材无独立章节 → 标"拓展·高考专题"。
 *
 * 用法: node ch_chem.js [--write]
 * ============================================================ */
const fs = require('fs');
const FILE = 'E:\\workspace\\穷观\\js\\data_chem.js';
const WRITE = process.argv.includes('--write');
const B1 = '必修一', B2 = '必修二', X1 = '选必1', X2 = '选必2', X3 = '选必3', EXT = '拓展';

const MAP = {
    // 必修一(第1-4章)
    'fnd-classification': [B1, '第1章 物质及其变化'],
    'fnd-oxide': [B1, '第1章 物质及其变化'],
    'fnd-acid-base-salt': [B1, '第1章 物质及其变化'],
    'fnd-composition': [B1, '第1章 物质及其变化'],
    'fnd-reaction-type': [B1, '第1章 物质及其变化'],
    'fnd-electrolyte': [B1, '第1章 物质及其变化'],
    'fnd-ion-equation': [B1, '第1章 物质及其变化'],
    'fnd-ion-coexist': [B1, '第1章 物质及其变化'],
    'fnd-redox': [B1, '第1章 物质及其变化'],
    'fnd-redox-rule': [B1, '第1章 物质及其变化'],
    'fnd-sodium': [B1, '第2章 海水中的重要元素——钠和氯'],
    'fnd-chlorine': [B1, '第2章 海水中的重要元素——钠和氯'],
    'fnd-mole': [B1, '第2章 海水中的重要元素——钠和氯'],
    'fnd-gas-volume': [B1, '第2章 海水中的重要元素——钠和氯'],
    'fnd-concentration': [B1, '第2章 海水中的重要元素——钠和氯'],
    'na-model': [B1, '第2章 海水中的重要元素——钠和氯'],
    'na-count': [B1, '第2章 海水中的重要元素——钠和氯'],
    'fnd-iron': [B1, '第3章 铁 金属材料'],
    'fnd-aluminum': [B1, '第3章 铁 金属材料'],
    'fnd-periodic-table': [B1, '第4章 物质结构 元素周期律'],
    'fnd-periodic-law': [B1, '第4章 物质结构 元素周期律'],
    'fnd-element-infer': [B1, '第4章 物质结构 元素周期律'],
    // 必修二(第5-8章)
    'fnd-sulfur': [B2, '第5章 化工生产中的重要非金属元素'],
    'fnd-nitrogen': [B2, '第5章 化工生产中的重要非金属元素'],
    'fnd-silicon': [B2, '第5章 化工生产中的重要非金属元素'],
    'prc-rate': [B2, '第6章 化学反应与能量'],
    'org-alkane': [B2, '第7章 有机化合物'],
    'life-material': [B2, '第8章 化学与可持续发展'],
    'life-health': [B2, '第8章 化学与可持续发展'],
    'life-energy': [B2, '第8章 化学与可持续发展'],
    // 选择性必修1 化学反应原理(第1-4章)
    'prc-deltaH': [X1, '第1章 化学反应的热效应'],
    'prc-thermoeq': [X1, '第1章 化学反应的热效应'],
    'prc-combustion': [X1, '第1章 化学反应的热效应'],
    'prc-hess': [X1, '第1章 化学反应的热效应'],
    'prc-rate-factor': [X1, '第2章 化学反应速率与化学平衡'],
    'prc-equilibrium': [X1, '第2章 化学反应速率与化学平衡'],
    'prc-k': [X1, '第2章 化学反应速率与化学平衡'],
    'prc-lechatelier': [X1, '第2章 化学反应速率与化学平衡'],
    'prc-ionization': [X1, '第3章 水溶液中的离子反应与平衡'],
    'prc-water': [X1, '第3章 水溶液中的离子反应与平衡'],
    'prc-hydrolysis': [X1, '第3章 水溶液中的离子反应与平衡'],
    'prc-hydrolysis-app': [X1, '第3章 水溶液中的离子反应与平衡'],
    'prc-ksp': [X1, '第3章 水溶液中的离子反应与平衡'],
    'prc-precipitation': [X1, '第3章 水溶液中的离子反应与平衡'],
    // 选择性必修2 物质结构与性质(第1-3章)
    'str-shell': [X2, '第1章 原子结构与性质'],
    'str-electron': [X2, '第1章 原子结构与性质'],
    'str-pauli': [X2, '第1章 原子结构与性质'],
    'str-ionic': [X2, '第2章 分子结构与性质'],
    'str-covalent': [X2, '第2章 分子结构与性质'],
    'str-metal': [X2, '第2章 分子结构与性质'],
    'str-vsepr': [X2, '第2章 分子结构与性质'],
    'str-polar': [X2, '第2章 分子结构与性质'],
    'str-hydrogen': [X2, '第2章 分子结构与性质'],
    'str-coord': [X2, '第2章 分子结构与性质'],
    'str-super': [X2, '第2章 分子结构与性质'],
    'str-crystal': [X2, '第3章 晶体结构与性质'],
    'str-type': [X2, '第3章 晶体结构与性质'],
    'str-cell': [X2, '第3章 晶体结构与性质'],
    // 选择性必修3 有机化学基础(第1-5章)
    'org-classify': [X3, '第1章 有机化合物的结构特点与研究方法'],
    'org-naming': [X3, '第1章 有机化合物的结构特点与研究方法'],
    'org-determine': [X3, '第1章 有机化合物的结构特点与研究方法'],
    'org-alkene': [X3, '第2章 烃'],
    'org-benzene': [X3, '第2章 烃'],
    'org-haloalkane': [X3, '第3章 烃的衍生物'],
    'org-alcohol': [X3, '第3章 烃的衍生物'],
    'org-phenol': [X3, '第3章 烃的衍生物'],
    'org-aldehyde': [X3, '第3章 烃的衍生物'],
    'org-acid': [X3, '第3章 烃的衍生物'],
    'org-ester': [X3, '第3章 烃的衍生物'],
    'org-sugar': [X3, '第4章 生物大分子'],
    'org-protein': [X3, '第4章 生物大分子'],
    'org-fat': [X3, '第4章 生物大分子'],
    'org-polymer': [X3, '第5章 合成高分子'],
    // 纯高考专题:教材无独立章节
    'org-geometry': [EXT, '高考专题(教材无独立章节)'],
    'org-isomer': [EXT, '高考专题(教材无独立章节)'],
    'org-synthesis': [EXT, '高考专题(教材无独立章节)'],
    'fnd-process': [EXT, '高考专题(教材无独立章节)'],
    'na-method': [EXT, '高考专题(教材无独立章节)'],
    'str-infer': [EXT, '高考专题(教材无独立章节)'],
    'lab-basic': [EXT, '高考专题(教材无独立章节)'],
    'lab-separate': [EXT, '高考专题(教材无独立章节)'],
    'lab-prepare': [EXT, '高考专题(教材无独立章节)'],
    'lab-test': [EXT, '高考专题(教材无独立章节)'],
    'lan-symbol': [EXT, '高考专题(教材无独立章节)'],
    'lan-struct': [EXT, '高考专题(教材无独立章节)'],
    'lan-equation': [EXT, '高考专题(教材无独立章节)']
};

function loadDb(p) {
    const raw = fs.readFileSync(p, 'utf8');
    const i = raw.indexOf('window.');
    const eq = raw.indexOf('=', i);
    let body = raw.slice(eq + 1).trim();
    if (body.endsWith(';')) body = body.slice(0, -1);
    return { db: JSON.parse(body), head: raw.slice(0, i) };
}
const L = loadDb(FILE), db = L.db;
const miss = []; let n = 0;
db.points.forEach(function (p) {
    const v = MAP[p.id];
    if (!v) { miss.push(p.id + '(' + p.name + ')'); return; }
    if (p.book || p.ch) return;
    p.book = v[0]; p.ch = v[1]; n++;
});
const unused = Object.keys(MAP).filter(function (k) { return !db.points.some(function (p) { return p.id === k; }); });
const by = {}; db.points.forEach(function (p) { if (p.book) by[p.book] = (by[p.book] || 0) + 1; });
console.log('化学知识点 ' + db.points.length + '  本次写入 ' + n);
console.log('映射表没覆盖 ' + miss.length + (miss.length ? ': ' + miss.join(', ') : ''));
console.log('映射表多余 ' + unused.length + (unused.length ? ': ' + unused.join(', ') : ''));
console.log('按册分布 ' + JSON.stringify(by));
if (WRITE) {
    if (miss.length) { console.log('!! 有未覆盖的点,先不写'); process.exit(1); }
    const bak = FILE + '.bak_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    fs.copyFileSync(FILE, bak);
    fs.writeFileSync(FILE, L.head + 'window.CHEM_DB = ' + JSON.stringify(db, null, 2) + ';\n', 'utf8');
    console.log('已写回 (备份 ' + require('path').basename(bak) + ')');
} else { console.log('(dry-run)'); }
