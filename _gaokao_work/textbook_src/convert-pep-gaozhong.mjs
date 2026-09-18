/**
 * 将 kajweb/dict 的 PEPGaoZhong_*.json（NDJSON）转为项目 Textbook JSON。
 * 用法：node scripts/convert-pep-gaozhong.mjs
 * 依赖：tmp/kajweb/dict/book 下已有 zip，或 tmp/kajweb/extracted 下已有 json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const bookDir = path.join(root, 'tmp/kajweb/dict/book')
const extractDir = path.join(root, 'tmp/kajweb/extracted')
const outDir = path.join(root, 'public/data/textbooks')

/** @type {{ id: string; file: string; title: string; unitCount: number }[]} */
const BOOKS = [
  { id: 'pep-senior-compulsory-1', file: '1521164674793_PEPGaoZhong_1.zip', title: '人教版高中英语 · 必修1', unitCount: 5 },
  { id: 'pep-senior-compulsory-2', file: '1521164678610_PEPGaoZhong_2.zip', title: '人教版高中英语 · 必修2', unitCount: 5 },
  { id: 'pep-senior-compulsory-3', file: '1521164676690_PEPGaoZhong_3.zip', title: '人教版高中英语 · 必修3', unitCount: 5 },
  { id: 'pep-senior-compulsory-4', file: '1521164657462_PEPGaoZhong_4.zip', title: '人教版高中英语 · 必修4', unitCount: 5 },
  { id: 'pep-senior-compulsory-5', file: '1521164657147_PEPGaoZhong_5.zip', title: '人教版高中英语 · 必修5', unitCount: 5 },
  { id: 'pep-senior-elective-6', file: '1521164629184_PEPGaoZhong_6.zip', title: '人教版高中英语 · 选修6', unitCount: 5 },
  { id: 'pep-senior-elective-7', file: '1521164648940_PEPGaoZhong_7.zip', title: '人教版高中英语 · 选修7', unitCount: 5 },
  { id: 'pep-senior-elective-8', file: '1521164666266_PEPGaoZhong_8.zip', title: '人教版高中英语 · 选修8', unitCount: 5 },
  { id: 'pep-senior-elective-9', file: '1521164670293_PEPGaoZhong_9.zip', title: '人教版高中英语 · 选修9', unitCount: 5 },
  { id: 'pep-senior-elective-10', file: '1521164634796_PEPGaoZhong_10.zip', title: '人教版高中英语 · 选修10', unitCount: 5 },
  { id: 'pep-senior-elective-11', file: '1521164639915_PEPGaoZhong_11.zip', title: '人教版高中英语 · 选修11', unitCount: 5 },
]

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

function unzip(zipPath, dest) {
  ensureDir(dest)
  // Windows PowerShell Expand-Archive; also try tar on newer Windows
  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}'"`,
      { stdio: 'pipe' },
    )
  } catch {
    execSync(`tar -xf "${zipPath}" -C "${dest}"`, { stdio: 'pipe' })
  }
}

function pickZh(trans) {
  if (!Array.isArray(trans) || trans.length === 0) return ''
  const parts = []
  for (const t of trans) {
    const cn = (t.tranCn || '').trim()
    if (!cn) continue
    const pos = (t.pos || '').trim()
    parts.push(pos ? `${pos}. ${cn}` : cn)
  }
  return parts.join('；') || (trans[0].tranCn || '').trim()
}

function pickPhonetic(content) {
  const us = (content.usphone || '').trim()
  const uk = (content.ukphone || '').trim()
  if (us) return `/${us.split(';')[0].trim()}/`
  if (uk) return `/${uk.split(';')[0].trim()}/`
  if (content.phone) return `/${String(content.phone).trim()}/`
  return undefined
}

function parseNdjson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const words = []
  for (const line of lines) {
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    const en = (o.headWord || o.content?.word?.wordHead || '').trim()
    if (!en) continue
    const c = o.content?.word?.content || {}
    const zh = pickZh(c.trans)
    if (!zh) continue
    const phonetic = pickPhonetic(c)
    words.push({
      en,
      zh,
      ...(phonetic ? { phonetic } : {}),
      _rank: o.wordRank ?? words.length + 1,
    })
  }
  words.sort((a, b) => a._rank - b._rank)
  return words.map(({ _rank, ...w }) => w)
}

function splitUnits(words, unitCount, bookId) {
  const n = words.length
  if (n === 0) return []
  const units = []
  const base = Math.floor(n / unitCount)
  let rem = n % unitCount
  let offset = 0
  for (let i = 0; i < unitCount; i++) {
    const size = base + (rem > 0 ? 1 : 0)
    if (rem > 0) rem -= 1
    const slice = words.slice(offset, offset + size)
    offset += size
    if (slice.length === 0) continue
    units.push({
      id: `u${i + 1}`,
      title: `Unit ${i + 1}`,
      words: slice,
    })
  }
  // 若 unitCount 过大导致尾部空，合并到最后一单元
  return units
}

function findJsonInDir(dir) {
  const files = fs.readdirSync(dir)
  const j = files.find((f) => f.endsWith('.json'))
  return j ? path.join(dir, j) : null
}

function convertOne(meta) {
  const zipPath = path.join(bookDir, meta.file)
  if (!fs.existsSync(zipPath)) {
    console.warn('skip missing zip', meta.file)
    return null
  }
  const dest = path.join(extractDir, meta.id)
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true })
  unzip(zipPath, dest)
  const jsonPath = findJsonInDir(dest)
  if (!jsonPath) {
    console.warn('no json in', dest)
    return null
  }
  const words = parseNdjson(jsonPath)
  const units = splitUnits(words, meta.unitCount, meta.id)
  const textbook = {
    id: meta.id,
    title: meta.title,
    source: 'kajweb/dict PEPGaoZhong (youdao wordbook export)',
    units,
  }
  const outPath = path.join(outDir, `${meta.id}.json`)
  fs.writeFileSync(outPath, JSON.stringify(textbook, null, 2), 'utf8')
  const count = units.reduce((s, u) => s + u.words.length, 0)
  console.log(`OK ${meta.id}: ${count} words, ${units.length} units → ${outPath}`)
  return { id: meta.id, title: meta.title, words: count, units: units.length }
}

function main() {
  ensureDir(outDir)
  ensureDir(extractDir)
  if (!fs.existsSync(bookDir)) {
    console.error('缺少词库目录:', bookDir)
    console.error('请先: git clone --depth 1 https://github.com/kajweb/dict.git tmp/kajweb/dict')
    process.exit(1)
  }
  const index = []
  for (const b of BOOKS) {
    const r = convertOne(b)
    if (r) index.push(r)
  }
  const indexPath = path.join(outDir, 'index.json')
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        description: '人教版高中英语词库索引（由 kajweb/dict 转换）',
        generatedAt: new Date().toISOString(),
        books: index,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log('index →', indexPath, 'books:', index.length)
}

main()
