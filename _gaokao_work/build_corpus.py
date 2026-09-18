# -*- coding: utf-8 -*-
"""Build corpus_A.jsonl: English-only Gaokao exam text harvested from 3 sources."""
import json, os, re, glob, collections

WORK = r'E:\workspace\穷观\_gaokao_work'
RAW = os.path.join(WORK, 'raw')
OUT = os.path.join(WORK, 'corpus_A.jsonl')

CJK = r'\u4e00-\u9fff\u3400-\u4dbf'
CJK_RE = re.compile('[' + CJK + ']')
CJK_RUN = re.compile('[' + CJK + ']+')
# Chinese/CJK punctuation+fullwidth forms
CJKPUNCT_RUN = re.compile(r'[\u3000-\u303f\uff00-\uffef]+')
# parenthesised gloss containing CJK, e.g. "property(财产)" or "compost (把……制成堆粪)"
GLOSS_RE = re.compile(r'[（(][^（()）]*[' + CJK + r'][^（()）]*[)）]')
LETTER = re.compile(r'[A-Za-z]')
WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")

# Fullwidth / CJK punctuation -> ASCII equivalents.
# These are NOT Chinese prose: they are typographic noise from Chinese-set exam papers
# (e.g. fullwidth comma between two English words). Mapped rather than deleted so that
# words are never accidentally glued together.
PUNCT_MAP = {
    '\uff0c': ', ', '\u3001': ', ', '\uff0e': '. ', '\u3002': '. ',
    '\uff1f': '?', '\uff01': '!', '\uff1b': ';', '\uff1a': ':',
    '\uff08': '(', '\uff09': ')', '\uff3b': '[', '\uff3d': ']',
    '\uff02': '"', '\uff07': "'", '\uff0d': '-', '\ufe63': '-', '\u2015': '-',
    '\uff04': '$', '\uffe1': '\u00a3', '\uff05': '%', '\uff0b': '+',
    '\uff0f': '/', '\uff3c': '\\', '\uff06': '&', '\uff20': '@',
    '\uff5e': '~', '\u301c': '~', '\uff3f': '_', '\u2026': '...',
    '\u3000': ' ', '\u200b': '', '\u00ad': '',
}
PUNCT_TABLE = str.maketrans(PUNCT_MAP)

SOURCE_URLS = {
    'agieval': 'https://raw.githubusercontent.com/ruixiangcui/AGIEval/main/data/v1/gaokao-english.jsonl',
    'gkb': 'https://github.com/OpenLMLab/GAOKAO-Bench (Data/Objective_Questions + Data/Subjective_Questions)',
    'gaokao_en': 'https://github.com/ZhangChengX/Gaokao-EN',
}


def clean_text(s):
    """Keep English body only: drop Chinese-dominant lines, strip inline CJK glosses."""
    if not s:
        return ''
    s = s.replace('\u00a0', ' ').replace('\u3000', ' ')
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    s = s.translate(PUNCT_TABLE)                # 0. fullwidth punctuation -> ASCII
    out = []
    for ln in s.split('\n'):
        ln = GLOSS_RE.sub(' ', ln)              # 1. remove parenthesised CJK glosses
        cjk_n = len(CJK_RE.findall(ln))
        letter_n = len(LETTER.findall(ln))
        if cjk_n:
            if cjk_n >= letter_n:               # 2a. Chinese-dominant line -> drop whole line
                continue
            ln = CJK_RUN.sub(' ', ln)           # 2b. residual inline CJK -> strip
            ln = CJKPUNCT_RUN.sub(' ', ln)
        ln = re.sub(r'[ \t]+', ' ', ln).strip()
        if ln:
            out.append(ln)
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def find_year(*cands):
    for c in cands:
        if not c:
            continue
        m = re.search(r'(19|20)\d{2}', str(c))
        if m:
            return m.group(0)
    return ''


def wc(text):
    return len(WORD.findall(text))


def as_text(v):
    """AGIEval fields are sometimes str, sometimes list of str."""
    if v is None:
        return ''
    if isinstance(v, (list, tuple)):
        return '\n'.join(as_text(x) for x in v)
    return str(v)


records = []


def add(source_key, year, title, text, extra=None):
    text = clean_text(text)
    if len(WORD.findall(text)) < 15:            # discard stubs / fully-Chinese items
        return False
    records.append({
        'source': SOURCE_URLS[source_key],
        'year': year or '',
        'title': title,
        'text': text,
    })
    return True


# ---------------------------------------------------------------- source 1: AGIEval
# Several MCQ records share one passage -> group by passage so word counts are not inflated.
def load_agieval():
    fn = os.path.join(RAW, 'agieval_v1_gaokao-english.jsonl')
    groups = collections.OrderedDict()
    with open(fn, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            paper = as_text((r.get('other') or {}).get('source', ''))
            passage = as_text(r.get('passage')).strip()
            key = (paper, passage)
            g = groups.setdefault(key, [])
            g.append(r)
    n = 0
    for i, ((paper, passage), items) in enumerate(groups.items(), 1):
        year = find_year(paper)
        chunks = [passage]
        for r in items:
            q = as_text(r.get('question')).strip()
            o = as_text(r.get('options')).strip()
            if q:
                chunks.append(q)
            if o:
                chunks.append(o)
        title = '%s [passage %d, %d items]' % (paper or 'AGIEval', i, len(items))
        if add('agieval', year, title, '\n'.join(chunks)):
            n += 1
    return n, len(groups)


# ------------------------------------------------- source 2: GAOKAO-Bench (2010-2022)
def load_gkb():
    n = 0
    for fn in sorted(glob.glob(os.path.join(RAW, 'gkb_*.json'))):
        tag = os.path.basename(fn)[4:-5]
        d = json.load(open(fn, encoding='utf-8'))
        for rec in d.get('example', []):
            year = str(rec.get('year') or '')
            cat = as_text(rec.get('category')).strip()
            title = '%s English %s' % (year or '?', tag)
            if cat:
                title += ' (%s)' % cat
            if add('gkb', year, title, as_text(rec.get('question'))):
                n += 1
    return n


# ------------------------------------------------- source 3: ZhangChengX/Gaokao-EN
def load_gaokao_en():
    n = 0
    files = sorted(
        glob.glob(os.path.join(RAW, 'gaokao_en', 'gaokao*')),
        key=lambda p: int(re.search(r'(\d+)$', p).group(1)),
    )
    for p in files:
        num = int(re.search(r'(\d+)$', p).group(1))
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception:
            continue
        # values are sentences keyed by ordinal -> reassemble in numeric order
        try:
            parts = [str(d[k]) for k in sorted(d.keys(), key=lambda x: int(x))]
        except Exception:
            parts = [str(v) for v in d.values()]
        text = '\n'.join(parts)
        if add('gaokao_en', '', 'Gaokao-EN article %d' % num, text):
            n += 1
    return n


a_n, a_groups = load_agieval()
g_n = load_gkb()
e_n = load_gaokao_en()

# ------------------------------------------------- global exact-duplicate removal
seen = set()
final = []
dups = 0
for r in records:
    key = re.sub(r'\s+', ' ', r['text']).strip().lower()
    if key in seen:
        dups += 1
        continue
    seen.add(key)
    final.append(r)


# ------------------------------------------------- cross-source near-duplicate removal
# The three sources overlap: e.g. the same 2016 Anhui reading passage is present in both
# GAOKAO-Bench and AGIEval (Jaccard 0.998), and ~22 Gaokao-EN articles reappear in the
# other two. Left in place they would double-count words in a frequency table, so keep
# only one copy of each distinct passage, preferring the copy with the best metadata.
PRIORITY = {'gkb': 0, 'agieval': 1, 'gaokao_en': 2}
SRC_KEY = {v: k for k, v in SOURCE_URLS.items()}
LOWER = re.compile(r"[a-z][a-z'\-]*")


def shingles(text, n=8):
    ws = LOWER.findall(text.lower())
    if len(ws) < n:
        return set()
    return {tuple(ws[i:i + n]) for i in range(len(ws) - n + 1)}


ranked = sorted(final, key=lambda r: PRIORITY[SRC_KEY[r['source']]])
kept, kept_sh = [], []
near_dups = []
for r in ranked:
    sh = shingles(r['text'])
    dup_of = None
    if sh:
        for k, ksh in zip(kept, kept_sh):
            if not ksh:
                continue
            inter = len(sh & ksh)
            if inter and inter / min(len(sh), len(ksh)) >= 0.60:
                dup_of = k
                break
    if dup_of is not None:
        near_dups.append((r['source'], r['title'], dup_of['source'], dup_of['title']))
        continue
    kept.append(r)
    kept_sh.append(sh)

final = sorted(kept, key=lambda r: (r['year'] or '9999', r['source'], r['title']))

with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    for r in final:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

# ------------------------------------------------- diagnostics
bysrc = collections.Counter(r['source'] for r in final)
byyear = collections.Counter(r['year'] for r in final)
total_words = sum(wc(r['text']) for r in final)
cjk_left = sum(1 for r in final if CJK_RE.search(r['text']))
bom = open(OUT, 'rb').read(3) == b'\xef\xbb\xbf'

print('AGIEval: %d groups from 306 raw lines -> kept %d' % (a_groups, a_n))
print('GAOKAO-Bench kept: %d' % g_n)
print('Gaokao-EN kept: %d' % e_n)
print('global exact dups removed: %d' % dups)
print('cross-source near-dups removed: %d' % len(near_dups))
nd = collections.Counter((SRC_KEY[a], SRC_KEY[b]) for a, t, b, t2 in near_dups)
for (a, b), c in sorted(nd.items()):
    print('    dropped %-10s (kept %-10s): %d' % (a, b, c))
with open(os.path.join(WORK, 'near_dups.txt'), 'w', encoding='utf-8') as f:
    for a, t, b, t2 in near_dups:
        f.write('DROP [%s] %s\n  == [%s] %s\n' % (SRC_KEY[a], t, SRC_KEY[b], t2))
print('FINAL records: %d' % len(final))
print('records still containing CJK in text: %d' % cjk_left)
print('TOTAL English words (rough): %d' % total_words)
print('BOM present: %s' % bom)
print('year coverage: %s' % ', '.join('%s=%d' % (k or 'EMPTY', v) for k, v in sorted(byyear.items())))
for s, c in bysrc.items():
    ws = sum(wc(r['text']) for r in final if r['source'] == s)
    print('  src %-90s records=%-4d words=%d' % (s[:90], c, ws))

# ------------------------------------------------- report
def years_of(s):
    ys = sorted({r['year'] for r in final if r['source'] == s and r['year']})
    return '%s-%s' % (ys[0], ys[-1]) if ys else 'blank'


lines = []
lines.append('GAOKAO ENGLISH CORPUS A -- collection report')
lines.append('output: %s  |  UTF-8 no BOM, 1 JSON object/line, keys=source,year,title,text' % OUT)
lines.append('TOTAL: %d records | %d English words | year span %s | %d records with blank year'
             % (len(final), total_words, years_of(SOURCE_URLS['agieval']), byyear.get('', 0)))
for s in (SOURCE_URLS['gkb'], SOURCE_URLS['agieval'], SOURCE_URLS['gaokao_en']):
    lines.append('src %s -> %d records, years %s, %d words'
                 % (s, bysrc[s], years_of(s), sum(wc(r['text']) for r in final if r['source'] == s)))
lines.append('dedup: AGIEval 306 raw MCQ rows grouped to 80 unique passages; %d exact + %d near-duplicate '
             'records dropped across sources (AGIEval<->GAOKAO-Bench overlap was ~98%% identical text)'
             % (dups, len(near_dups)))
lines.append('cleaning: Chinese-dominant lines dropped, inline CJK glosses like "property(财产)" stripped, '
             'fullwidth punctuation mapped to ASCII; 0 records retain CJK in text')
lines.append('caveats: title keeps the original Chinese paper name (metadata only, never in text); residual '
             'source noise from AGIEval (irregular spacing/typos) and space-encoded gap-fill blanks remain; '
             '3123 "_" blank markers preserved as-is')
lines.append('failures: AGIEval v1_1 file is byte-identical to v1 (unused); GAOKAO-Bench has no /data path '
             '(real path is /Data); HuggingFace/parquet sources skipped - no pandas/pyarrow installed')
rpt = os.path.join(WORK, 'corpus_A_report.txt')
with open(rpt, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
print('report -> %s (%d lines)' % (rpt, len(lines)))
