/* 修正 add_math_points.js 里正文的转义:
 *   1) 3 字符的 \\n(字面反斜杠+n) → 2 字符的 \n(JS 转义,真正的换行)
 *      但绝不能碰 \\neq / \\notin 这类 LaTeX(它们是 4 字符,后面跟字母)
 *   2) '**核心公式', 漏了结尾的 **
 *   3) ana-symmetry 的 links 里自引用
 * 只改这一个脚本文件,不碰 data.js。
 */
const fs = require('fs');
const F = 'E:\\workspace\\穷观\\_gaokao_work\\add_math_points.js';
let s = fs.readFileSync(F, 'utf8');
const before = s;

// 1) \\n 且后面不是字母 → \n
let n1 = 0;
s = s.replace(/\\\\n(?![A-Za-z])/g, function () { n1++; return '\\n'; });

// 2) 漏掉的 **
let n2 = 0;
s = s.replace(/'(\*\*核心公式)',/g, function (m, g) { n2++; return "'" + g + "**',"; });

// 3) 自引用链接
let n3 = 0;
s = s.replace(/links: \['ana-line-eq', 'ana-two-lines', 'ana-dist', 'ana-symmetry'\]/,
    function () { n3++; return "links: ['ana-line-eq', 'ana-two-lines', 'ana-dist', 'ana-circle']"; });

console.log('换行修正 ' + n1 + ' 处;补 ** ' + n2 + ' 处;修自引用 ' + n3 + ' 处');
if (s !== before) { fs.writeFileSync(F, s, 'utf8'); console.log('已写回脚本'); } else { console.log('没有改动'); }

// 复查:还有没有残留的 3 字符 \\n
const left = (s.match(/\\\\n(?![A-Za-z])/g) || []).length;
console.log('复查残留 \\n ' + left + ' 处(应为 0)');
