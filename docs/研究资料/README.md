# docs/研究资料 · 各科知识库的重建资料

本目录是原仓库根目录 `_gaokao_work/` 的**归位结果**:有价值的文档、工具脚本与统计报告收进这里,
第三方原始语料与大体积可再生产物**移出仓库**。整理前的位置与完整文件清单见
[`../_仓库整理报告.md`](../_仓库整理报告.md)。

> 为什么原来的目录名叫 `_gaokao_work`:这一批工作是"按高考范围与人教版教材重建各科知识库"
> 的作业区,不是最终成品。成品是 `js/data*.js`,作业区的资料不该散在仓库根目录。

---

## 一、本目录里有什么

| 类别 | 文件 | 说明 |
|---|---|---|
| 教材/考纲结构研究 | `人教版高中章节结构.md`、`人教版高中章节结构_PDF实测.md`、`人教版高中生物章节结构.md`、`资料源_高中教材与笔记.md`、`覆盖度对照_数学物理.md` | 章节与覆盖度依据 |
| 交付物与清单 | `人教版高中英语_单元词表.md`、`人教版高中英语_单元词表.json`、`知识点现状清单.md` | 人教版(2019)单元词表成品(2211 词 + 427 短语)与现状盘点 |
| 原创性举证 | `原创指纹清单.md`、`埋指纹报告.md` | 埋点清单、字节偏移实测与举证命令 |
| 生成脚本 | `build_eng.js`、`build_bio.js`、`build_doc.js`、`build_corpus.py`、`build_textbook_words_B.py`、`count.js`、`canonical.js`、`union.js`、`gap.js`、`gap2.js`、`extract.js`、`parse_candidates.js`、`patch_canonical.js`、`enrich_ph.js`、`inspect_eng.js`、`inspect_eng2.js`、`ch_chem.js`、`ch_physics.js`、`apply_ch_math.js`、`add_math_points.js`、`fix_math_ch.js`、`fix_newlines.js`、`make_docx.ps1` | 见下节「路径约定」 |
| 统计报告 | `canon_freq_report.txt`、`canonical_report.txt`、`corpus_A_report.txt`、`corpus_stats.txt`、`freq_report.txt`、`union_freq_report.txt`、`textbook_B_report.txt`、`near_dups.txt` | 各步骤的实测输出,小体积、留作口径凭证 |
| 小体积原始成果 | `bio_parts/`(5 个 JSON)、`eng_parts/grammar.json` | 生物/英语内容的**原创**中间成果,下游 `js/data_bio.js`、`js/data_eng.js` 的直接输入 |

## 二、路径约定(重要)

1. **这些脚本里的路径全部是绝对路径**,指向本机源码真身 `E:\workspace\穷观\_gaokao_work\`
   (例如 `const DIR = 'E:/workspace/穷观/_gaokao_work';`),**没有**任何脚本用 `__dirname` /
   `%CD%` 推断自己所在目录。所以:
   - 把脚本从 `_gaokao_work/` 移到本目录,**不影响**它们读取输入、写出结果的位置;
   - 但单独拷走这个仓库、在没有 `E:\workspace\穷观\` 的机器上,这些脚本**跑不起来** ——
     它们本来就依赖那台机器上的作业区。这是原状,不是本次整理造成的。
2. 文档里出现的 `_gaokao_work/xxx` 有两种含义:写成 `E:\workspace\穷观\_gaokao_work\xxx` 的是
   **源码真身**(仍然存在、仍然有效);写成相对路径的是**整理前的仓库内位置**,现在对应本目录。
3. `原创指纹清单.md` / `埋指纹报告.md` 中用于排除目录的正则(如
   `-notmatch '\\(_shots|_promo|_gaokao_work|_backup_eng_cloud|...)\\')` 与
   `robocopy ... /XD _shots _gaokao_work _promo_phone` 属于**历史命令的逐字记录**。
   其中 `_promo`、`_backup_eng_cloud`、`_gaokao_work` 几个目录在本次整理后已不在仓库里,
   这些条目变成"永不命中"的空操作,**不影响命令继续执行**,故按原样保留、不作改写。

## 三、已经移出仓库的东西(没有消失)

以下内容**从仓库移除**,但**原样保留在本机** `E:\workspace\穷观\_gaokao_work\`
(本次整理只动 `E:\qg_push\philia-093` 这个克隆,源码真身一个字节都没改)。
要恢复进仓库,用整理提交的父提交取回(命令见 [`../_仓库整理报告.md`](../_仓库整理报告.md))。

| 原仓库位置 | 体积 | 是什么 / 为什么不必进公开仓库 |
|---|---:|---|
| `_gaokao_work/src/` | 65.12 MB | 第三方词表与词典原始素材:`ecdict.csv`(≈65 MB)、`pluto_3500.txt`、`Lazuli_raw.txt`、`citu_*`、`ckaorceu_words.json`、`wordforest_words_all.json`、`Gumingyu_index.html` 等。**都不是本项目原创**,体积占整仓一半以上,且再分发有版权顾虑 |
| `_gaokao_work/bench/` | 2.52 MB | 第三方基准集 `gaokao_bench/Multiple-choice_Questions/*.csv`(2010–2022 各科选择题)。构建输入,非成果 |
| `_gaokao_work/raw/` | 2.76 MB | 第三方原始题源:`agieval_v1*_gaokao-english.jsonl`、`Gaokao-EN-Eval.xlsx`、`gkb_*.json`、`gaokao_en/gaokao1..75`。构建输入,非成果 |
| `_gaokao_work/textbook_src/` | 2.22 MB | 抓取/转换用的人教版教材源:`kajweb/PEPGaoZhong_*.zip`(11 个)、`pep2019-*.json`、`pep-selective*.vocabulary.js`。构建输入,非成果 |
| `_gaokao_work/*.json,*.jsonl,*.tsv` | 9.28 MB | 上列输入跑出来的**汇总产物**(`union.json`、`union_freq.*`、`canon_freq.*`、`freq.*`、`canonical.json`、`corpus.jsonl`、`corpus_A.jsonl`、`doc_data.json`、`textbook_words_B.jsonl`、`gap2.json`)。可由保留下来的脚本 + 上面那些原始输入**重新生成**,且内容已被成品 `js/data*.js` 覆盖 |
| `_gaokao_work/_test.docx`、`_test_in.json` | <1 KB | 排版测试的临时输入输出 |

顺带发现的两处**重复文件**(SHA256 实测完全相同,均已随上面一并移出):

- `_gaokao_work/raw/agieval_v1_1_gaokao-english.jsonl` ≡ `_gaokao_work/raw/agieval_v1_gaokao-english.jsonl`(660,925 B)
- `_gaokao_work/src/Gumingyu_index.html` ≡ `_gaokao_work/textbook_src/rjb-word-review_index.html`(128,557 B)

## 四、数字口径提醒

`知识点现状清单.md` 与 `资料源_高中教材与笔记.md` 写作时间在**英语库按人教版词表重建之前**,
其中英语一行记的是旧的 **6 板块 / 1978 点**。当前实际值(直接解析 `js/data_eng.js` 得出)是
**10 板块 / 3053 个知识点 / 2756 条关联**;`js/data_eng.js` 自己的头部注释也写着
"人教版 2019 课标版重构"、7 个教材册板块 + 3 个工具板块。读这两份文档时请注意这个时间差,
本目录按"历史记录不改写"的原则未改动它们的正文。
