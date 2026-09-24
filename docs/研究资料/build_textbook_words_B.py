# -*- coding: utf-8 -*-
"""
Build textbook_words_B.jsonl from 人教版高中英语 课后单词表 sources.

Sources
  S1 https://raw.githubusercontent.com/Gumingyu/rjb-word-review/main/index.html
       -> 2019版 必修第一册 (Welcome Unit + Unit 1-5), field word/pos/zh
  S2 https://raw.githubusercontent.com/Gumingyu/pep-selectiveN-wordlab/main/vocabulary.js
       -> 2019版 选择性必修第一/二/三册, lines "word|pos 释义|type"
  S3 https://raw.githubusercontent.com/cyforkk/pep-english-words/main/public/data/textbooks/pep2019-*.json
       -> 2019版 必修1-3 + 选择性必修1-4 (all seven books)
  S4 https://raw.githubusercontent.com/kajweb/dict/master/book/*_PEPGaoZhong_*.zip
       -> 旧人教版(2007) 必修1-5 + 选修6-11 (youdao wordbook export, NDJSON)

Merge priority per (book, unit, word): S1 > S2 > S3  (textbook-concise gloss wins),
S4 fills the old edition.  Dedup keeps the first row seen for each (book, unit, word).
"""
import json
import os
import re
import zipfile

SRC = r"E:\workspace\穷观\_gaokao_work\textbook_src"
KAJ = os.path.join(SRC, "kajweb")
OUT_JSONL = r"E:\workspace\穷观\_gaokao_work\_textbook_words_B.tmp.jsonl"
OUT_REPORT = r"E:\workspace\穷观\_gaokao_work\_textbook_B_report.tmp.txt"

U_HTML = "https://raw.githubusercontent.com/Gumingyu/rjb-word-review/main/index.html"
U_SEL = ("https://raw.githubusercontent.com/Gumingyu/pep-selective{}-wordlab/"
         "main/vocabulary.js")
U_PEP = ("https://raw.githubusercontent.com/cyforkk/pep-english-words/main/"
         "public/data/textbooks/pep2019-{}.json")
U_KAJ = "https://raw.githubusercontent.com/kajweb/dict/master/book/{}.zip"

# ---------------------------------------------------------------- pos helpers
POS_ALT = (r"n|vt|vi|v|adj|adv|prep|conj|pron|num|int|interj|aux|art|abbr|pl|det|"
           r"modal|link-v|abbr")
LEAD = re.compile(r"^\s*((?:(?:%s)\s*\.\s*(?:[&/,，、]\s*)?)+)" % POS_ALT, re.I)
TOK = re.compile(r"(%s)\s*\." % POS_ALT, re.I)
INNER = re.compile(r"(?:^|[；;，,、\s(/])((?:%s)\s*\.)" % POS_ALT, re.I)
CJK = re.compile(r"[\u4e00-\u9fff]")


def norm_pos(tokens):
    out, seen = [], set()
    for t in tokens:
        t = t.strip().lower().rstrip(".") + "."
        if t not in seen:
            seen.add(t)
            out.append(t)
    return "/".join(out)


def norm_pos_any(s):
    """Tolerant: 'n/vt', 'adj', 'n. & vt.' -> 'n./vt.' / 'adj.' / 'n./vt.'"""
    if not s:
        return ""
    parts = re.split(r"[&/，,、;；\s]+", s.strip())
    return norm_pos([p for p in parts if p.strip()])


def split_pos(text):
    """'n. 交换；交流；vt. 交换' -> ('n./vt.', '交换；交流；交换')"""
    if not text:
        return "", ""
    text = text.strip()
    m = LEAD.match(text)
    pos, rest = "", text
    if m:
        pos = norm_pos(TOK.findall(m.group(1)))
        rest = text[m.end():]
    # pull any remaining pos markers out of the gloss (keep the Chinese clean)
    extra = []

    def _sub(mm):
        extra.append(mm.group(1))
        return "；"

    cleaned = INNER.sub(_sub, rest)
    cleaned = re.sub(r"[；;]{2,}", "；", cleaned).strip(" ；;，,、")
    pos = norm_pos(TOK.findall(pos) + extra)
    return pos, cleaned


def clean_word(w):
    return re.sub(r"\s+", " ", (w or "").replace("\u3000", " ")).strip()


def clean_unit(t):
    """'Unit 1 Teenage Life' / 'Unit 1 · 青春校园' -> 'Unit 1'; Welcome Unit stays."""
    t = re.split(r"\s*[·|]\s*", (t or "").strip())[0].strip()
    m = re.match(r"(Welcome\s*Unit|Starter\s*Unit|Unit\s*(\d+))", t, re.I)
    if m:
        if m.group(2):
            return "Unit %s" % m.group(2)
        return "Welcome Unit" if "welcome" in m.group(1).lower() else "Starter Unit"
    return t


# ------------------------------------------------------- balanced json scanner
def scan_raw(text, marker):
    """Return the raw balanced [...] / {...} literal that follows `marker`."""
    i = text.index(marker) + len(marker)
    while text[i] not in "[{":
        i += 1
    open_ch = text[i]
    close_ch = "]" if open_ch == "[" else "}"
    depth, j, instr, esc = 0, i, False, False
    while j < len(text):
        c = text[j]
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = False
        else:
            if c == '"':
                instr = True
            elif c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return text[i:j + 1]
        j += 1
    raise ValueError("unbalanced literal after " + marker)


def tolerant_json(raw):
    """JS object literal (unquoted keys / trailing commas) -> python object."""
    s = re.sub(r"([{,\[]\s*)([A-Za-z_$][\w$]*)\s*:", r'\1"\2":', raw)
    s = re.sub(r",(\s*[}\]])", r"\1", s)
    return json.loads(s)


def scan_json(text, marker):
    """Return the JSON value (list/dict) that follows `marker` in `text`."""
    i = text.index(marker) + len(marker)
    while text[i] not in "[{":
        i += 1
    open_ch = text[i]
    close_ch = "]" if open_ch == "[" else "}"
    depth, j, instr, esc = 0, i, False, False
    while j < len(text):
        c = text[j]
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = False
        else:
            if c == '"':
                instr = True
            elif c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return json.loads(text[i:j + 1])
        j += 1
    raise ValueError("unbalanced json after " + marker)


# ------------------------------------------------------------------- S1 loader
def load_s1():
    p = os.path.join(SRC, "rjb-word-review_index.html")
    t = open(p, encoding="utf-8").read()
    units = {u["id"]: u for u in scan_json(t, "const UNITS =")}
    pools = scan_json(t, "const POOLS =")
    rows, nunits = [], 0
    for uid, words in pools.items():
        title = clean_unit(units.get(uid, {}).get("title", uid))
        nunits += 1
        for w in words:
            rows.append(("必修1", title, clean_word(w.get("word")),
                         norm_pos_any(w.get("pos")),
                         (w.get("zh") or "").strip()))
    return rows, nunits


# ------------------------------------------------------------------- S2 loader
def load_s2():
    """pep-selective1/2/3-wordlab/vocabulary.js -> 选择性必修1/2/3"""
    rows, nunits = [], 0
    for n, book in ((1, "选择性必修1"), (2, "选择性必修2"), (3, "选择性必修3")):
        p = os.path.join(SRC, "pep-selective%d.vocabulary.js" % n)
        t = open(p, encoding="utf-8").read()
        meta = {m["id"]: m["label"]
                for m in tolerant_json(scan_raw(t, "const UNIT_META ="))}
        raw = scan_raw(t, "const RAW_VOCABULARY =")
        body = {m.group(1): m.group(2) for m in
                re.finditer(r"(\w+)\s*:\s*`([\s\S]*?)`", raw)}
        for uid in sorted(body, key=lambda k: int(re.sub(r"\D", "", k) or 0)):
            title = clean_unit(meta.get(uid, uid.replace("u", "Unit ")))
            lines = [l.strip() for l in body[uid].strip().split("\n") if l.strip()]
            nunits += 1
            for line in lines:
                parts = line.split("|")
                word = clean_word(parts[0])
                meaning = parts[1].strip() if len(parts) > 1 else ""
                pos, dfn = split_pos(meaning)
                rows.append((book, title, word, pos, dfn))
    return rows, nunits


# ------------------------------------------------------------------- S3 loader
PEP_BOOKS = [("compulsory-1", "必修1"), ("compulsory-2", "必修2"),
             ("compulsory-3", "必修3"), ("optional-1", "选择性必修1"),
             ("optional-2", "选择性必修2"), ("optional-3", "选择性必修3"),
             ("optional-4", "选择性必修4")]


def load_s3():
    rows, nunits, nbooks = [], 0, 0
    for slug, book in PEP_BOOKS:
        p = os.path.join(SRC, "pep2019-%s.json" % slug)
        j = json.load(open(p, encoding="utf-8"))
        nbooks += 1
        for u in j["units"]:
            title = clean_unit(u["title"])
            nunits += 1
            for w in u["words"]:
                pos, dfn = split_pos(w.get("zh") or "")
                rows.append((book, title, clean_word(w.get("en")), pos, dfn))
    return rows, nunits, nbooks


# ------------------------------------------------------------------- S4 loader
KAJ_BOOKS = {1: "旧版必修1", 2: "旧版必修2", 3: "旧版必修3", 4: "旧版必修4",
             5: "旧版必修5", 6: "旧版选修6", 7: "旧版选修7", 8: "旧版选修8",
             9: "旧版选修9", 10: "旧版选修10", 11: "旧版选修11"}


def load_s4():
    rows, nbooks = [], 0
    files = sorted(os.listdir(KAJ))
    for fn in files:
        if not fn.endswith(".zip"):
            continue
        idx = int(re.search(r"PEPGaoZhong_(\d+)", fn).group(1))
        book = KAJ_BOOKS[idx]
        nbooks += 1
        zf = zipfile.ZipFile(os.path.join(KAJ, fn))
        name = zf.namelist()[0]
        for line in zf.read(name).decode("utf-8").split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            word = clean_word(rec.get("headWord"))
            if not word:
                continue
            try:
                trans = rec["content"]["word"]["content"]["trans"]
            except Exception:
                trans = []
            poss, defs = [], []
            for t in trans:
                if t.get("pos"):
                    poss.append(t["pos"])
                if t.get("tranCn"):
                    defs.append(t["tranCn"].strip())
            pos = norm_pos_any(" ".join(poss))
            dfn = "；".join(d for d in defs if d)
            dfn = re.sub(r"[；;]{2,}", "；", dfn).strip(" ；;")
            rows.append((book, "", word, pos, dfn))
    return rows, nbooks


# ------------------------------------------------------------------ build/merge
BOOK_ORDER = ["必修1", "必修2", "必修3", "选择性必修1", "选择性必修2",
              "选择性必修3", "选择性必修4"] + \
             ["旧版必修%d" % i for i in range(1, 6)] + \
             ["旧版选修%d" % i for i in range(6, 12)]


def unit_key(book, unit):
    """Natural unit ordering: Welcome Unit,预备单元, Unit 1..n; '' sorts first."""
    if unit == "":
        return (1, 0, "")
    m = re.search(r"(\d+)", unit)
    n = int(m.group(1)) if m else 0
    pre = 0 if re.search(r"(Welcome|预备|Starter)", unit) else 1
    return (0, pre * 1000 + n, unit)


def build():
    s1, u1 = load_s1()
    s2, u2 = load_s2()
    s3, u3, b3 = load_s3()
    s4, b4 = load_s4()

    merged, groups = {}, {}
    covered = set()        # (book, word) already supplied by a higher-priority source
    for src_rows in (s1, s2, s3, s4):          # priority order
        own_seen, added = set(), set()
        for book, unit, word, pos, dfn in src_rows:
            if not word:
                continue
            if (book, word) in covered:        # word already in this book
                continue
            key = (book, unit, word)
            if key in own_seen:                # dedup inside one source
                continue
            own_seen.add(key)
            merged[key] = {"book": book, "unit": unit, "word": word,
                           "pos": pos or "", "def": dfn or ""}
            added.add((book, word))
            groups.setdefault((book, unit), []).append(key)
        covered |= added

    # books in canonical order; units natural-ordered; words in source order
    bk_rank = {b: i for i, b in enumerate(BOOK_ORDER)}
    ordered_books = sorted({b for b, _ in groups},
                           key=lambda b: (bk_rank.get(b, 99), b))
    recs = []
    for b in ordered_books:
        units = sorted([u for (bb, u) in groups if bb == b],
                       key=lambda u: unit_key(b, u))
        for u in units:
            recs.extend(merged[k] for k in groups[(b, u)])

    with open(OUT_JSONL, "w", encoding="utf-8", newline="\n") as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False,
                               separators=(",", ":")) + "\n")

    # per-source stats (on raw rows, before merge)
    def stats(rows, books=None):
        b = len({r[0] for r in rows})
        u = len({(r[0], r[1]) for r in rows})
        return b, u, len(rows)

    lines = []
    for label, url, rows, extra in (
        ("Gumingyu/rjb-word-review(2019 必修第一册)", U_HTML, s1, None),
        ("Gumingyu/pep-selective1-wordlab(2019 选择性必修第一册)",
         U_SEL.format(1), [r for r in s2 if r[0] == "选择性必修1"], None),
        ("Gumingyu/pep-selective2-wordlab(2019 选择性必修第二册)",
         U_SEL.format(2), [r for r in s2 if r[0] == "选择性必修2"], None),
        ("Gumingyu/pep-selective3-wordlab(2019 选择性必修第三册)",
         U_SEL.format(3), [r for r in s2 if r[0] == "选择性必修3"], None),
        ("cyforkk/pep-english-words(2019 必修1-3 + 选择性必修1-4)",
         "https://raw.githubusercontent.com/cyforkk/pep-english-words/main/"
         "public/data/textbooks/pep2019-{compulsory-1..3,optional-1..4}.json",
         s3, None),
        ("kajweb/dict(旧人教版 必修1-5 + 选修6-11)",
         "https://raw.githubusercontent.com/kajweb/dict/master/book/"
         "{ts}_PEPGaoZhong_{1..11}.zip(共11个zip)", s4, None),
    ):
        b, u, c = stats(rows)
        books = sorted({r[0] for r in rows}, key=lambda x: BOOK_ORDER.index(x))
        rng = "%s..%s" % (books[0], books[-1]) if len(books) > 1 else books[0]
        lines.append("%s | 册数=%d(%s) 单元数=%d 词条数=%d" % (url, b, rng, u, c))
    fail = [
        ("https://api.github.com/search/repositories?q=人教版+必修+单词", "0 条可用结果(仅返回本任务已用的 Gumingyu 4 个仓库)"),
        ("https://api.github.com/search/repositories?q=高中英语+必修+单词表", "total_count=0"),
        ("https://api.github.com/search/repositories?q=人教版+必修+词汇", "total_count=0"),
        ("https://api.github.com/search/repositories?q=高中英语+词汇表", "total_count=0"),
        ("https://api.github.com/search/repositories?q=高考+英语+单词", "HTTP 403 速率限制(未认证搜索配额耗尽)"),
        ("https://github.com/keyonsin/astrobox-resource-com-renjiao-gaozhong-english-word-xiaomi", "仅含 .rpk 打包件与图片,无文本词表"),
        ("https://github.com/liuyuming0823/zhiyue-learning", "wordbank.js 未含人教版课后单词表结构,未采用"),
        ("https://hf-mirror.com", "未找到可用的人教版高中课后单词表数据集(parquet 无解析工具)"),
    ]
    for url, why in fail:
        lines.append("SKIPPED %s | %s" % (url, why))

    total = len(recs)
    distinct = len({r["word"] for r in recs})
    distinct_ci = len({r["word"].lower() for r in recs})
    bk = len({r["book"] for r in recs})
    un = len({(r["book"], r["unit"]) for r in recs})
    lines.append("总词条数=%d 册数=%d 单元数=%d 去重后不同单词数=%d(忽略大小写=%d)"
                 % (total, bk, un, distinct, distinct_ci))
    open(OUT_REPORT, "w", encoding="utf-8", newline="\n").write(
        "\n".join(lines) + "\n")

    print("S1 rows=%d units=%d" % (len(s1), u1))
    print("S2 rows=%d units=%d" % (len(s2), u2))
    print("S3 rows=%d units=%d books=%d" % (len(s3), u3, b3))
    print("S4 rows=%d books=%d" % (len(s4), b4))
    print("MERGED rows=%d books=%d units=%d distinct=%d ci=%d"
          % (total, bk, un, distinct, distinct_ci))
    # sample
    for r in recs[:2] + recs[-2:]:
        print("SAMPLE", json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    build()
