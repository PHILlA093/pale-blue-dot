/* ============================================================
 * 给穷观知识点补「人教版教材归属」(数学)
 * 用法: node apply_ch_math.js            # 先 dry-run 只报告
 *       node apply_ch_math.js --write     # 真正写回 js/data.js
 *
 * 依据:人教A版(2019 课标)章节结构。由于教材 PDF 目录正在另行实测核对,
 * 这里统一做到**章级**归属(不写节号),避免节号写错;PDF 目录回来后再做节级细化。
 *
 * 归属规则(要点):
 *   · 解三角形(正弦/余弦定理)在 2019 版属于【必修二 第6章 平面向量及其应用】,不在三角函数那章
 *   · 空间角/空间向量在【选必一 第1章 空间向量与立体几何】,必修二第8章只讲平行垂直的判定
 *   · 统计抽样/样本估计在 必修二第9章;回归分析与独立性检验在 选必三第8章
 *   · 条件概率在 选必三第7章;古典概型/互斥对立/频率估计在 必修二第10章
 *   · 2019 版已删考点(定积分/极限/线性规划/极坐标参数方程/三视图)标注为"旧课标",不假装有章节
 *   · 高考专题类(恒成立/定点定值/截面/球切接/存在性/直线系/含参单调性)标注"高考专题",
 *     它们教材里没有独立章节,但在复习中是真重点,不硬塞进某一章
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] && !process.argv[2].startsWith('--')
    ? process.argv[2]
    : 'E:\\workspace\\穷观\\js\\data.js';
const WRITE = process.argv.includes('--write');

// 册次简称
const B1 = '必修一', B2 = '必修二', X1 = '选必一', X2 = '选必二', X3 = '选必三';
const EXT = '拓展';

// id -> [册, 章]
const MAP = {
    // ---- 必修一 ----
    'set-def': [B1, '第1章 集合与常用逻辑用语'],
    'set-rel': [B1, '第1章 集合与常用逻辑用语'],
    'set-op': [B1, '第1章 集合与常用逻辑用语'],
    'set-cond': [B1, '第1章 集合与常用逻辑用语'],
    'set-logic': [B1, '第1章 集合与常用逻辑用语'],
    'set-venn': [B1, '第1章 集合与常用逻辑用语'],
    'ineq-quad': [B1, '第2章 一元二次函数、方程和不等式'],
    'ineq-basic': [B1, '第2章 一元二次函数、方程和不等式'],
    'ineq-prop': [B1, '第2章 一元二次函数、方程和不等式'],
    'ineq-proof': [B1, '第2章 一元二次函数、方程和不等式'],
    'ineq-frac': [B1, '第2章 一元二次函数、方程和不等式'],
    'ineq-abs': [B1, '第2章 一元二次函数、方程和不等式'],
    'ineq-const': [EXT, '高考专题(教材无独立章节)'],
    'ineq-lp': [EXT, '旧课标(2019 已删)'],
    'fn-quad': [B1, '第2章 一元二次函数、方程和不等式'],
    'set-func': [B1, '第3章 函数的概念与性质'],
    'set-func-prop': [B1, '第3章 函数的概念与性质'],
    'calc-graph-transform': [B1, '第3章 函数的概念与性质'],
    'fn-basic': [B1, '第4章 指数函数与对数函数'],
    'calc-exp-log-op': [B1, '第4章 指数函数与对数函数'],
    'fn-eq': [B1, '第4章 指数函数与对数函数'],
    'calc-limit': [EXT, '旧课标(2019 已删)'],
    'ts-angle': [B1, '第5章 三角函数'],
    'ts-def': [B1, '第5章 三角函数'],
    'ts-ident': [B1, '第5章 三角函数'],
    'ts-induce': [B1, '第5章 三角函数'],
    'ts-graph': [B1, '第5章 三角函数'],
    'ts-double': [B1, '第5章 三角函数'],
    'ts-sumdiff': [B1, '第5章 三角函数'],
    'ts-asy': [B1, '第5章 三角函数'],
    'ts-trig-model': [B1, '第5章 三角函数'],

    // ---- 必修二 ----
    'vec-def': [B2, '第6章 平面向量及其应用'],
    'vec-add': [B2, '第6章 平面向量及其应用'],
    'vec-scale': [B2, '第6章 平面向量及其应用'],
    'vec-basis': [B2, '第6章 平面向量及其应用'],
    'vec-dot': [B2, '第6章 平面向量及其应用'],
    'vec-dot-coord': [B2, '第6章 平面向量及其应用'],
    'vec-geo': [B2, '第6章 平面向量及其应用'],
    'vec-center': [B2, '第6章 平面向量及其应用'],
    'ts-triangle': [B2, '第6章 平面向量及其应用'],
    'ts-tricase': [B2, '第6章 平面向量及其应用'],
    'ts-measure': [B2, '第6章 平面向量及其应用'],
    'cpx-def': [B2, '第7章 复数'],
    'cpx-op': [B2, '第7章 复数'],
    'cpx-conj': [B2, '第7章 复数'],
    'cpx-geo': [B2, '第7章 复数'],
    'cpx-eq': [B2, '第7章 复数'],
    'solid-structure': [B2, '第8章 立体几何初步'],
    'solid-views': [B2, '第8章 立体几何初步'],
    'solid-axiom': [B2, '第8章 立体几何初步'],
    'solid-pos': [B2, '第8章 立体几何初步'],
    'solid-line-parallel': [B2, '第8章 立体几何初步'],
    'solid-line-perp': [B2, '第8章 立体几何初步'],
    'solid-plane-parallel': [B2, '第8章 立体几何初步'],
    'solid-plane-perp': [B2, '第8章 立体几何初步'],
    'solid-volume': [B2, '第8章 立体几何初步'],
    'solid-cross-section': [EXT, '高考专题(教材无独立章节)'],
    'solid-sphere': [EXT, '高考专题(教材无独立章节)'],
    'solid-explore': [EXT, '高考专题(教材无独立章节)'],
    'stat-sample': [B2, '第9章 统计'],
    'stat-estimate': [B2, '第9章 统计'],
    'stat-num': [B2, '第9章 统计'],
    'stat-classic': [B2, '第10章 概率'],
    'stat-event': [B2, '第10章 概率'],
    'stat-freq': [B2, '第10章 概率'],
    'stat-geo': [B2, '第10章 概率'],

    // ---- 选择性必修第一册 ----
    'vec-space': [X1, '第1章 空间向量与立体几何'],
    'solid-vector': [X1, '第1章 空间向量与立体几何'],
    'solid-angle': [X1, '第1章 空间向量与立体几何'],
    'ana-slope': [X1, '第2章 直线和圆的方程'],
    'ana-line-eq': [X1, '第2章 直线和圆的方程'],
    'ana-two-lines': [X1, '第2章 直线和圆的方程'],
    'ana-dist': [X1, '第2章 直线和圆的方程'],
    'ana-circle': [X1, '第2章 直线和圆的方程'],
    'ana-line-circle': [X1, '第2章 直线和圆的方程'],
    'ana-circle-circle': [X1, '第2章 直线和圆的方程'],
    'ana-family': [EXT, '高考专题(教材无独立章节)'],
    'ana-param': [EXT, '旧课标(2019 已删)'],
    'ana-ellipse': [X1, '第3章 圆锥曲线的方程'],
    'ana-hyperbola': [X1, '第3章 圆锥曲线的方程'],
    'ana-parabola': [X1, '第3章 圆锥曲线的方程'],
    'ana-focus-chord': [X1, '第3章 圆锥曲线的方程'],
    'ana-conic': [X1, '第3章 圆锥曲线的方程'],
    'ana-conic-app': [EXT, '高考专题(教材无独立章节)'],

    // ---- 选择性必修第二册 ----
    'seq-concept': [X2, '第4章 数列'],
    'seq-arithmetic': [X2, '第4章 数列'],
    'seq-geometric': [X2, '第4章 数列'],
    'seq-sum': [X2, '第4章 数列'],
    'seq-recur': [X2, '第4章 数列'],
    'calc-derivative': [X2, '第5章 一元函数的导数及其应用'],
    'calc-deriv-geo': [X2, '第5章 一元函数的导数及其应用'],
    'calc-deriv-formula': [X2, '第5章 一元函数的导数及其应用'],
    'calc-deriv-rules': [X2, '第5章 一元函数的导数及其应用'],
    'calc-monotonic': [X2, '第5章 一元函数的导数及其应用'],
    'calc-extreme': [X2, '第5章 一元函数的导数及其应用'],
    'calc-param-mono': [X2, '第5章 一元函数的导数及其应用'],
    'calc-app': [X2, '第5章 一元函数的导数及其应用'],
    'calc-integral': [EXT, '旧课标(2019 已删)'],
    'calc-integral-app': [EXT, '旧课标(2019 已删)'],
    'calc-curve-trap': [EXT, '旧课标(2019 已删)'],

    // ---- 选择性必修第三册 ----
    'cnt-principle': [X3, '第6章 计数原理'],
    'cnt-perm': [X3, '第6章 计数原理'],
    'cnt-comb': [X3, '第6章 计数原理'],
    'cnt-app': [X3, '第6章 计数原理'],
    'cnt-binom': [X3, '第6章 计数原理'],
    'cnt-binom-prop': [X3, '第6章 计数原理'],
    'cnt-term': [X3, '第6章 计数原理'],
    'stat-var': [X3, '第7章 随机变量及其分布'],
    'stat-expect': [X3, '第7章 随机变量及其分布'],
    'stat-binom': [X3, '第7章 随机变量及其分布'],
    'stat-hyper': [X3, '第7章 随机变量及其分布'],
    'stat-normal': [X3, '第7章 随机变量及其分布'],
    'stat-cond': [X3, '第7章 随机变量及其分布'],
    'stat-correlation': [X3, '第8章 成对数据的统计分析'],
    'stat-indep-test': [X3, '第8章 成对数据的统计分析']
};

const raw = fs.readFileSync(FILE, 'utf8');
const m = raw.match(/window\.MATH_DB\s*=\s*([\s\S]*?);\s*$/);
if (!m) { console.error('!! 没匹配到 window.MATH_DB 赋值体'); process.exit(1); }
const db = JSON.parse(m[1]);

const miss = [], hit = [];
db.points.forEach(p => {
    const v = MAP[p.id];
    if (!v) { miss.push(p.id + ' (' + p.name + ')'); return; }
    if (p.book || p.ch) return;                 // 已有归属的不覆盖
    p.book = v[0];
    p.ch = v[1];
    hit.push(p.id);
});

console.log('知识点总数 ' + db.points.length);
console.log('本次写入归属 ' + hit.length + ' 条');
console.log('映射表里没有的 id ' + miss.length + ' 条' + (miss.length ? ':' : ''));
miss.forEach(x => console.log('   - ' + x));
const unused = Object.keys(MAP).filter(k => !db.points.some(p => p.id === k));
console.log('映射表里多余(库里没有这个 id) ' + unused.length + ' 条' + (unused.length ? ':' : ''));
unused.forEach(x => console.log('   - ' + x));

// 分布统计
const byBook = {};
db.points.forEach(p => { if (p.book) byBook[p.book] = (byBook[p.book] || 0) + 1; });
console.log('按册分布: ' + JSON.stringify(byBook));

if (WRITE) {
    const bak = FILE + '.bak_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    fs.copyFileSync(FILE, bak);
    const head = raw.slice(0, raw.indexOf('window.MATH_DB'));
    fs.writeFileSync(FILE, head + 'window.MATH_DB = ' + JSON.stringify(db, null, 2) + ';\n', 'utf8');
    console.log('已写回 ' + FILE + '  (备份: ' + path.basename(bak) + ')');
} else {
    console.log('(dry-run:加 --write 才会写回)');
}
