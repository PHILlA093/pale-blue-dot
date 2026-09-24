/* ============================================================
 * 穷观 · 物理知识点补「人教版教材归属」
 * 依据:_gaokao_work\人教版高中章节结构.md(人教版 2019 课标版,27 章,PDF 目录页实测)
 *
 * 体例要点(实测确认):
 *   · 必修册章号跨册连续:必修一 1-4 章、必修二 5-8 章、必修三 9-13 章;
 *     选择性必修各册重新起算(选必一 1-4,选必二 1-5,选必三 1-5)。
 *   · 印刷目录里节号只写"1. 2."(章内相对),正文引用用 X.Y;本表做到章级,不写节号以免出错。
 *   · 纯解题模型类(连接体/传送带/板块/临界/功能关系)教材无独立章节 → 标"拓展·高考专题"。
 *
 * 用法: node ch_physics.js [--write]
 * ============================================================ */
const fs = require('fs');
const FILE = 'E:\\workspace\\穷观\\js\\data-physics.js';
const WRITE = process.argv.includes('--write');

const B1 = '必修一', B2 = '必修二', B3 = '必修三';
const X1 = '选必一', X2 = '选必二', X3 = '选必三', EXT = '拓展';

const MAP = {
    // 必修一
    'mo-ref': [B1, '第1章 运动的描述'],
    'mo-disp': [B1, '第1章 运动的描述'],
    'mo-form': [B1, '第2章 匀变速直线运动的研究'],
    'mo-graph': [B1, '第2章 匀变速直线运动的研究'],
    'mo-free': [B1, '第2章 匀变速直线运动的研究'],
    'mo-grav': [B1, '第3章 相互作用——力'],
    'mo-fric': [B1, '第3章 相互作用——力'],
    'mo-comp': [B1, '第3章 相互作用——力'],
    'mo-balance': [B1, '第3章 相互作用——力'],
    'nt-inert': [B1, '第4章 运动和力的关系'],
    'nt-2nd': [B1, '第4章 运动和力的关系'],
    'nt-3rd': [B1, '第4章 运动和力的关系'],
    'nt-over': [B1, '第4章 运动和力的关系'],
    'nt-prob': [B1, '第4章 运动和力的关系'],
    // 必修二
    'cv-syn': [B2, '第5章 抛体运动'],
    'cv-flat': [B2, '第5章 抛体运动'],
    'cv-cir': [B2, '第6章 圆周运动'],
    'cv-force': [B2, '第6章 圆周运动'],
    'cv-app': [B2, '第6章 圆周运动'],
    'cv-kep': [B2, '第7章 万有引力与宇宙航行'],
    'cv-gravlaw': [B2, '第7章 万有引力与宇宙航行'],
    'cv-mg': [B2, '第7章 万有引力与宇宙航行'],
    'cv-sat': [B2, '第7章 万有引力与宇宙航行'],
    'cv-cosmic': [B2, '第7章 万有引力与宇宙航行'],
    'cv-multi': [B2, '第7章 万有引力与宇宙航行'],
    'en-power': [B2, '第8章 机械能守恒定律'],
    'en-ke': [B2, '第8章 机械能守恒定律'],
    'en-pe': [B2, '第8章 机械能守恒定律'],
    'en-mech': [B2, '第8章 机械能守恒定律'],
    // 必修三
    'el-charge': [B3, '第9章 静电场及其应用'],
    'el-field': [B3, '第9章 静电场及其应用'],
    'el-potential': [B3, '第10章 静电场中的能量'],
    'el-work': [B3, '第10章 静电场中的能量'],
    'el-cap': [B3, '第10章 静电场中的能量'],
    'el-part': [B3, '第10章 静电场中的能量'],
    'el-ohm': [B3, '第11章 电路及其应用'],
    'el-circuit': [B3, '第11章 电路及其应用'],
    'el-joule': [B3, '第12章 电能 能量守恒定律'],
    'el-closed': [B3, '第12章 电能 能量守恒定律'],
    'el-dynamic': [B3, '第12章 电能 能量守恒定律'],
    'mg-field': [B3, '第13章 电磁感应与电磁波初步'],
    'op-em': [B3, '第13章 电磁感应与电磁波初步'],
    // 选择性必修一
    'en-mom': [X1, '第1章 动量守恒定律'],
    'en-col': [X1, '第1章 动量守恒定律'],
    'en-con': [X1, '第1章 动量守恒定律'],
    'en-combine': [X1, '第1章 动量守恒定律'],
    'en-recoil': [X1, '第1章 动量守恒定律'],
    'wv-shm': [X1, '第2章 机械振动'],
    'wv-pendulum': [X1, '第2章 机械振动'],
    'wv-res': [X1, '第2章 机械振动'],
    'wv-wave': [X1, '第3章 机械波'],
    'wv-graph': [X1, '第3章 机械波'],
    'wv-inter': [X1, '第3章 机械波'],
    'wv-doppler': [X1, '第3章 机械波'],
    'op-ref': [X1, '第4章 光及其应用'],
    'op-full': [X1, '第4章 光及其应用'],
    'op-inter': [X1, '第4章 光及其应用'],
    'op-diff': [X1, '第4章 光及其应用'],
    // 选择性必修二
    'mg-amp': [X2, '第1章 安培力与洛伦兹力'],
    'mg-lorentz': [X2, '第1章 安培力与洛伦兹力'],
    'mg-part': [X2, '第1章 安培力与洛伦兹力'],
    'mg-instrument': [X2, '第1章 安培力与洛伦兹力'],
    'mg-flux': [X2, '第2章 电磁感应'],
    'mg-lenz': [X2, '第2章 电磁感应'],
    'mg-faraday': [X2, '第2章 电磁感应'],
    'mg-emf': [X2, '第2章 电磁感应'],
    'mg-self': [X2, '第2章 电磁感应'],
    'mg-ac': [X2, '第3章 交变电流'],
    'mg-transformer': [X2, '第3章 交变电流'],
    // 选择性必修三
    'th-mole': [X3, '第1章 分子动理论'],
    'th-temp': [X3, '第1章 分子动理论'],
    'th-gas': [X3, '第2章 气体、固体和液体'],
    'th-ideal': [X3, '第2章 气体、固体和液体'],
    'th-state': [X3, '第2章 气体、固体和液体'],
    'th-first': [X3, '第3章 热力学定律'],
    'th-second': [X3, '第3章 热力学定律'],
    'ap-atom': [X3, '第4章 原子结构和波粒二象性'],
    'ap-bohr': [X3, '第4章 原子结构和波粒二象性'],
    'op-photo': [X3, '第4章 原子结构和波粒二象性'],
    'op-wave': [X3, '第4章 原子结构和波粒二象性'],
    'ap-nucleus': [X3, '第5章 原子核'],
    'ap-decay': [X3, '第5章 原子核'],
    'ap-half': [X3, '第5章 原子核'],
    'ap-mass': [X3, '第5章 原子核'],
    'ap-energy': [X3, '第5章 原子核'],
    'ap-app': [X3, '第5章 原子核'],
    'ap-particles': [X3, '第5章 原子核(粒子和宇宙)'],
    // 纯解题模型:教材无独立章节
    'nt-system': [EXT, '高考专题(教材无独立章节)'],
    'nt-belt': [EXT, '高考专题(教材无独立章节)'],
    'nt-board': [EXT, '高考专题(教材无独立章节)'],
    'nt-critical': [EXT, '高考专题(教材无独立章节)'],
    'en-func': [EXT, '高考专题(教材无独立章节)']
};

function loadDb(p) {
    const raw = fs.readFileSync(p, 'utf8');
    const i = raw.indexOf('window.');
    const eq = raw.indexOf('=', i);
    let body = raw.slice(eq + 1).trim();
    if (body.endsWith(';')) body = body.slice(0, -1);
    return { db: JSON.parse(body), head: raw.slice(0, i), isEng: false };
}
const L = loadDb(FILE);
const db = L.db;
const miss = [];
let n = 0;
db.points.forEach(function (p) {
    const v = MAP[p.id];
    if (!v) { miss.push(p.id + '(' + p.name + ')'); return; }
    if (p.book || p.ch) return;
    p.book = v[0]; p.ch = v[1]; n++;
});
const unused = Object.keys(MAP).filter(function (k) { return !db.points.some(function (p) { return p.id === k; }); });
const by = {};
db.points.forEach(function (p) { if (p.book) by[p.book] = (by[p.book] || 0) + 1; });
console.log('物理知识点 ' + db.points.length + '  本次写入 ' + n);
console.log('映射表没覆盖 ' + miss.length + (miss.length ? ': ' + miss.join(', ') : ''));
console.log('映射表多余 ' + unused.length + (unused.length ? ': ' + unused.join(', ') : ''));
console.log('按册分布 ' + JSON.stringify(by));

if (WRITE) {
    if (miss.length) { console.log('!! 有未覆盖的点,先不写'); process.exit(1); }
    const bak = FILE + '.bak_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    fs.copyFileSync(FILE, bak);
    fs.writeFileSync(FILE, L.head + 'window.PHYSICS_DB = ' + JSON.stringify(db, null, 2) + ';\n', 'utf8');
    console.log('已写回 (备份 ' + require('path').basename(bak) + ')');
} else { console.log('(dry-run)'); }
