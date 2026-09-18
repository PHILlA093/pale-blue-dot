# 高考英语3500词·词根版 —— 子代理作业规范（唯一权威）

> 本文件定义数据来源、字段、校订规则、词根词缀标记规则与切片输出格式。所有子代理必须先完整阅读本文件再动手。**只允许在 `E:\workspace\穷观\英语预热\_work\` 内写文件**（你的切片产物），其他任何路径不得写/改/删。不写聊天大段输出。

## 1. 目录与数据

- 成品目录：`E:\workspace\穷观\英语预热\`
- 底稿：`E:\workspace\穷观\英语预热\_work\base_words_final.json` —— 3555 个元素的有序数组，元素字段：`word`(单词/短语)、`ph`(音标，无斜杠包裹)、`pos`(词性token，如 "v"、"adj n"、空)、`def`(中文释义)。数组已按原词表顺序连续排列，**顺序是词表权威顺序，禁止重排**。
- 用 PowerShell 读取（UTF8）：
  `$o = ([System.IO.File]::ReadAllText('E:\workspace\穷观\英语预热\_work\base_words_final.json')) | ConvertFrom-Json`
  校验 `$o.Count -eq 3555`；不对就停下报告。

## 2. 切片任务表（你的分片由任务提示指定）

| 片 | 数组索引(含) | 条数 | 全局编号起点 |
|----|----|----|----|
| S01 | 0..300 | 301 | 1 |
| S02 | 301..528 | 228 | 302 |
| S03 | 529..700 | 172 | 530 |
| S04 | 701..872 | 172 | 702 |
| S05 | 873..1197 | 325 | 874 |
| S06 | 1198..1475 | 278 | 1199 |
| S07 | 1476..1750 | 275 | 1477 |
| S08 | 1751..1997 | 247 | 1752 |
| S09 | 1998..2319 | 322 | 1999 |
| S10 | 2320..2624 | 305 | 2321 |
| S11 | 2625..2840 | 216 | 2626 |
| S12 | 2841..3061 | 221 | 2842 |
| S13 | 3062..3277 | 216 | 3063 |
| S14 | 3278..3460 | 183 | 3279 |
| S15 | 3461..3554 | 94 | 3462 |

全局编号 = 起点 + (数组索引 − 片首索引)。

## 3. 输出：两个文件（写到 _work\）

1. `slice_S01.jsonl`（片号按你任务里的实际片号）：每词一行 JSON（**单行、UTF-8 无 BOM**），键固定顺序：
   `{"no":1,"word":"abandon","ph":"əˈbændən","pos":"vt.","def":"抛弃，舍弃，放弃","tags":{"pre":[],"root":["band"],"suf":[]},"plain":false,"note":""}`
   - `no`：全局编号（见上）
   - `word`：校订后的词（见 §4）
   - `ph`：校订后音标（不含 / 斜杠）；保持 `(US)` 等原样
   - `pos`：渲染后词性字符串（见 §4），如 `vt.`、`n. adj.`、`prep. adv.`；无法判断用 `—` 并记 note
   - `def`：清理后的释义；无法清理置空并记 note
   - `tags.pre/root/suf`：数组，元素必须是 §6/§7/§8 表中**完整的 family 名**（如 `"cap/cept/ceive/cip"`、`"re-"`、`"-tion/-ion/-sion"` 整串照抄，不得自创变体）
   - `plain`：true=无明显词根词缀、判为基础词（见 §5）
   - `note`：非空时填简短中文说明（如 `word纠错: afte→after`）
   - `plain` 与 `tags` 互斥：有任一 tag 则 plain=false
2. `slice_S01_fixlog.txt`：UTF-8 无 BOM。行格式 `全局编号|word|改动字段|旧→新|原因一句话`；无改动可写一行 `无`。词根标记本身**不进 fixlog**（标记有争议且多）——标记拿不准时按 §5 处理。

## 4. 校订规则（只修可证伪的错，其余逐字保留）

- **word**：改正明显 OCR 拼写错（如 `afte→after`、`acut→acute`；`spaghettiv→spaghetti`、`tiresomev→tiresome`、`taxipayer→taxpayer`、`Tibeta→Tibetan`、`roller skatingn→roller skating`、`the butterfly` 若实为 `butterfly` 词头误粘 the 则改为正确形式）。专名首字母大写（April/August/…/Monday…、China 等按词典大写；若整词表该词条小写且明显是月份/星期/国名 → 大写并 note）。大小写敏感词（如 `English`、`China`）保持词典形式。拿不准 → note 说明，不改。
- **ph**：见 §9「已知坏音标速修表」逐一核对（只要你的片里有该词就必须按表修，没遇到就不用管）；音标里全部 `:` 换成 `ː`；`ә`/`є`/`η` 等异常字符、反引号、`·`、`|`、开头 `.` 一律按标准 IPA 修正；明显“错贴上一词音标”的（如 food=fɔnd、these=ˈθɜːmɔs、tough=ˈtɔt(ə)lɪ、ton=təˈmɔrəʊ、wag=ˈvɔɪɪdʒ、wash=ˈwɔːnɪŋ、lab=ˈnɔlɪdʒ、honey=ˈɔnɪst、sofa=ˈsɔkɪt、should=ʃɔt、available=ˈɔːtəm、yourselves=jɔːˈself、tortoise=ˈtɔpɪk 等）按标准 IPA 修正。空 ph 用标准 IPA 补全。
- **pos**：token 只保留集合 {n, v, vt, vi, adj, adv, prep, conj, pron, num, art, int, aux, modal}；空白 token 丢弃；集合外残渣（t.、vn、vt，n、/n 等）按语义改为正确 token；多 token 保留顺序。渲染规则：每个 token 后加 `.`，空格连接（如 `vt. vi.`、`n. adj.`）。pos 为空 → 按语义填（`shirt` 应为 n. 等）并 note；语义拿不准（如短语词条）可填 `—` 并 note。个别词典惯例：`art.`(冠词)、`num.`(数词)、`modal v.` 写作 `modal v.`（aux 用 `aux.`）。
- **def**：去开头多余词性残留（如开头 `n. `/`a. `/`t. `/`num. ` 与词性重复部分）、开头 `。`/`；`/`* `；若结尾是 `；`+下一条词头(+括号) 的误粘（如 `；afterward(s)`、` many (more, most)`、` rope`），从该 `；` 截断；删末尾不成对 `）`/`)` 与行尾空白。其余内容原样保留（含 `（美）`、`(英)`、`（复 …）` 这类原文标记）。
- 每个改动都在 fixlog 里记一行（def 长时摘录新旧前 25 字）。

## 5. 词根词缀标记规则（核心产出）

判断顺序：
1. 先查 §6 词根表：单词(去前后缀后)的**词干与表中某一 family 的同源形式匹配**（含同形变体，如 accept 干 cept 属 `cap/cept/ceive/cip`），且词义与表义说得通 → 在 `tags.root` 加该 family **整串**（可多个：如 `international` → inter- + nat + -ion… 拆为 pre/inter-、root/nat、suf/-al? 需按真实构成）。
2. 词首匹配 §7 前缀表、词尾匹配 §8 后缀表且语义相符 → 分别加入 pre/suf（可多个）。
3. 参考例词判断；**宁缺毋滥**：匹配牵强、拼写巧合（如 `apple` 不含词缀 `-le`、`father` 不含 `-er` 之类）一律不标。
4. 既有词根又有词缀的都要标（一个词可 pre/root/suf 各 0~n 个）。派生词若只是屈折/规则变形但词表已单列（如 bored、interesting 词条），按真实词缀标（-ed/-ing）或按基础词判定。
5. 实在拆不出任何词根词缀、且为短小基础词（dog、apple、run、the、at、of 等）→ `plain=true`，tags 全空。中等长度但真无常见词根（如 sudden、letter? letter 无词缀→plain）也标 plain。**拆不出但有把握属于某个词根词缀却不在表中 → plain=true + note 填 `疑似词根:xxx（表外）`**，不得自创 family 名。
6. 专有名词/国名地名（China、Africa、April 等）一律 plain=true（不强行拆词根）。

## 6. 规范词根表（family 名照抄，含斜杠）

| family（照抄用） | 核心含义 | 参考例词 |
|---|---|---|
| aer/aero | 空气，航空 | aeroplane, aircraft, airplane, airmail, airport |
| ag/act | 做，行动，驱使 | act, action, active, activity, actor, agent |
| alt | 高 | altitude |
| ambul | 行走 | ambulance |
| anim | 生命，精神 | animal |
| ann/enn | 年 | annual, anniversary |
| arch | 首领，主要的 | architect |
| arm | 手臂，武器 | arm, army, armchair |
| art | 技艺，艺术 | art, artist, article |
| aster/astr/astro | 星 | astronaut, astronomy |
| aud/audi | 听 | audience, audio, auditorium |
| band | 捆绑，扎 | bandage |
| bar | 棒，条，柜台 | bar |
| bas | 底，基础 | base, basic, basin, basement, baseball |
| bat | 打，击 | battle, battleground |
| bio | 生命 | biology |
| cad/cas/cid | 落，降临，发生 | accident, accidental?（按词判断） |
| cap | 头，首领 | captain?（按词判断，无把握不标） |
| cap/cept/ceive/cip | 拿，取，抓 | accept, except, reception, receive |
| card/cord | 心 | record, recorder |
| caus/cus | 原因，理由 | cause, accuse |
| ced/ceed/cess | 走，行，让 | succeed, success, successful |
| cent | 百 | cent?（centimetre, century 按词判断） |
| centr | 中心 | centre/center, central |
| cern/cert | 分开；确定 | certain, uncertain, certainly? |
| circ/cycl | 圆，环，轮 | circle, semicircle, bicycle, cycle |
| cit | 唤起，引用 | recite |
| clud/clus/clos | 关闭，合上 | include, conclude, conclusion |
| cogn | 知道 | recognise/recognize, recognition |
| cre/creas/cresc | 生长，产生 | create?（按词判断） |
| cred | 相信 | credit?（按词判断） |
| cur/curs/cour | 跑，流，行 | occur, current, course |
| dic/dict | 说，言 | dictionary, predict?（按词判断） |
| doc/doct | 教 | doctor, document |
| duc/duct | 引导，引 | produce, product, reduce, education, introduce, introduction, conduct? |
| dur | 持久 | during, durable? |
| dyn | 力量 | dynasty |
| equ | 相等，公平 | equal, equality |
| err | 走，游荡；错误 | error |
| fac/fact/fect/fic | 做，制作 | fact, factory, affect, effect? |
| fail/fail?→fal | 错，骗 | fail, failure, false |
| fer | 带，拿 | offer, ferry, different, difference |
| fid | 相信，忠实 | faith |
| fig | 塑造，形状 | figure |
| fin | 结束，界限 | finish, final, finally? |
| firm | 坚固 | firm, firmly, confirm? |
| fix | 固定 | fix, fixture? |
| flect/flex | 弯曲 | reflect, flexible |
| flor/flour | 花 | flower, flour |
| flu/fluct | 流 | fluent, fluency, flu, influence? |
| form | 形状，形式 | form, formal, format, formation? |
| fort/forc | 强，力 | force, effort? |
| found/fund | 底，基础 | found, founding, foundation? |
| fract/frag | 破，碎 | fragile |
| fus | 流，倾，倒 | refuse, confuse? |
| gen/gener | 生，种族，种类 | general, generation?（按词判断） |
| geo | 地 | geography, geometry? |
| ger/gest | 运送，产生 | suggest?（按词判断） |
| grad/gress | 步，行走 | grade, progress, gradual? |
| gram/graph | 写，画 | grammar, programme/program, telegram, photograph, photographer |
| grat | 高兴，感激 | congratulate?（按词判断） |
| habit | 居住，拥有 | habit |
| hap | 机会，运气 | happy, happiness, happen? |
| her/hes | 粘，附 | hesitate?（按词判断） |
| horr | 怕，惊 | horrible, terror?（terror 归 terr 怕） |
| hospit/host | 客人 | hospital, host? |
| it | 走 | exit, orbit? |
| ject | 投，掷 | object, project, reject? |
| join/junct | 连接 | join, joint? |
| journ | 日 | journal?（按词判断） |
| jud/jur/jus | 法，判断，正义 | judge, just, justice? |
| labor | 劳动 | laboratory?（按词判断） |
| laps | 滑，落 | collapse?（按词判断） |
| lat | 带，拿 | translate, translation, relation, relate? |
| lav | 洗 | lavatory |
| lax/leas | 松 | relax |
| lect/leg/lig | 选，收，读 | collect, select, elect, lecture, college, collection? |
| leg | 法 | legal, legislation? |
| liber | 自由 | liberty, liberate, liberation |
| lic | 允许 | license/licence |
| lingu | 舌，语言 | language?（language 判 plain 亦可，见词判断） |
| liter | 文字 | literature, literary |
| loc | 地方 | local |
| log | 说，言，学 | apology, logic? |
| long/leng | 长 | long, length, along?（along 有 a-前缀，也可按基础处理） |
| luc/lustr | 光，亮 | illustrate?（按词判断） |
| magn | 大 | magnificent?（按词判断） |
| maj/max | 大 | major, majority, maximum? |
| man/manu | 手 | manage, manager, manner, manual? |
| mar | 海 | marine?（按词判断） |
| mat/mater | 母，材料 | material, matter? |
| med | 医治 | medical, medicine |
| medi | 中间 | media, medium, immediate? |
| memor | 记忆 | memory, memorial, memorize |
| ment | 心，想 | mental, mention, comment? |
| merc | 商，贸易 | market, merchant |
| meter/metr | 测量 | metre/meter, centimetre, thermometer? |
| milit | 兵，战 | military?（按词判断） |
| min | 小 | minority, minimum, miniskirt, minister? |
| mir | 惊奇 | admire, miracle? |
| miss/mit | 送，放，投 | miss, mission? admit, dismiss?, permit, promise, missile? |
| mob/mot/mov | 动 | mobile, move, movement, motor, motorbike, motorcycle, motion? |
| mon/monit | 告诫，提醒 | monitor, monument? |
| mons/mount | 山 | mountain |
| mort | 死 | murder?（murder 与 mort 同源？否——murder 不标，见词判断） |
| nat | 生，出生 | nation, national, nationality, native, nature, natural |
| nav | 船 | navy |
| norm | 规范，标准 | normal, abnormal |
| not | 知道，记号 | note, notice, notebook? |
| nounce/nunci | 说，报告 | announce, announcement, pronounce, pronunciation |
| nov | 新 | novel, novelist |
| numer | 数 | number, numerous? |
| nutri | 营养 | nutrition |
| oper | 工作，操作 | operate, operation, operator |
| opt | 选择 | option? optional, adopt?（adopt 含 opt=选择，可标） |
| or/ora | 口，说 | oral |
| ord/ordin | 顺序，命令 | order, ordinary |
| ori | 升起，开始 | origin |
| paci | 和平 | Pacific, pacific? |
| part | 部分，分开 | part, apart, apartment, departure?, party? |
| pass | 通过，走过 | pass, passenger, passport, past? |
| path/pat | 感觉，忍受 | patience, patient, sympathy |
| patr/pater | 父，国 | patriot?（按词判断） |
| pel/puls | 推，逐 | compulsory?（按词判断） |
| pen/pun | 罚 | punish, punishment |
| pend/pens | 悬挂；称；花费 | spend, expense, expensive, independent? |
| pet | 寻求 | appetite |
| phon | 声音 | phone, telephone, phonetics? |
| phot | 光 | photo, photograph, photographer |
| pict | 画 | picture |
| plac/pleas | 使高兴，取悦 | please, pleasant, pleasure, pleased |
| plant | 种，植 | plant, plantation? |
| ple/plet/pli | 满，填 | plenty, complete, supply? |
| plex/plic/ply | 折叠，缠绕，应用 | apply, reply, complex, simple?（simple 判 plain 亦可） |
| plor | 喊，哭 | explore, explorer |
| point/punct | 点，刺 | point, punctuation |
| pol/polis | 城邦，政治 | police, policy? politics, political, politician |
| pon/pos/posit | 放，置 | position, postpone?, oppose?, opposite? |
| popul | 人民 | popular, population |
| port | 运，拿，港口 | port, airport, import, export, report, support?, transport |
| poss/pot | 能力，力量 | possible, possibly, possibility, potential? |
| preci | 价值，价格 | precious, appreciate, appreciation |
| press | 压 | press, pressure, express, expression |
| prim | 第一，最初 | primary, prime? |
| pris | 抓，牢 | prison, prisoner |
| priv | 私人，私有 | private, privilege |
| prob/prov | 试验，证明 | probable, probably, prove, problem? |
| proper/propri | 自己的，恰当的 | proper, properly |
| psych | 心灵，精神 | psychology |
| pur | 纯净 | pure, purify? |
| quest/quir/quis | 寻求，询问 | question, request, require, requirement? |
| quiet/qui | 安静 | quiet, quiet? |
| radi | 光线，射线 | radio, radium |
| rat | 计算，理性 | rate, ratio? |
| rect | 正，直 | correct, rectangle, direction?, direct?（direct 归 rect? direct=di+rect，可标） |
| reg/rect?→reg | 统治，王 | regular, region? |
| rid/ris | 笑 | ridiculous |
| riv | 河 | river |
| ru/rupt | 破，裂 | erupt, interrupt? |
| rud | 粗野 | rude, rudely? |
| sacr/sanct | 神圣 | sacred |
| sal | 盐 | salt, salty, salad? |
| salut/salv | 救，健康 | salute, save?（save 按基础词处理） |
| sat/satis | 足够，满足 | satisfy, satisfaction |
| sci | 知道 | science, scientific, scientist |
| scop | 看，镜 | microscope, telescope |
| sect | 切，割 | section, insect? |
| sed/sess/sid | 坐 | president? session, possess? |
| sen | 老 | senior |
| sens/sent | 感觉，意识 | sense, sensitive, sentence? |
| serv | 服务，奴仆 | serve, service, servant |
| serv | 保存，看守 | preserve, observe?（observe 不标） |
| sign | 记号，标记 | sign, signal, signature, significance, significant |
| simil/sembl | 相似，相同 | similar, resemble |
| sist | 站立 | assist, assistance, assistant, consist?, resist? |
| soci | 同伴，社会 | social, socialism, socialist, society |
| sol | 太阳 | solar |
| solv/solu | 松，解，溶解 | solve, solution? |
| son | 声音 | sonic?（按词判断） |
| spec/spect/spic | 看 | expect, respect, special, specialist, specific? aspect? |
| spir | 呼吸 | spirit, spiritual, inspire? |
| spond/spons | 承诺，回应 | respond, responsibility, sponsor |
| st/sta/stat | 立，站 | stand, station, state, statement? statue, status, stable? |
| struct | 建造 | structure, construct?, instruct? |
| suad/suas | 劝 | persuade?（按词判断） |
| sum | 拿，取 | assume, consume?, consumption? |
| summ | 总，最高 | summary, summit? |
| tact/tang/tag | 触，接触 | contact?（按词判断） |
| tain/ten/tent/tin | 握，持 | contain, obtain, maintain?, continue?（continue 不标） |
| tect | 盖 | protect, protection, detect? |
| tele?→(前缀) | 远 | 见前缀表 |
| tempor | 时间 | temporary |
| tend/tens/tent | 伸，倾向 | attend, attention, extend? tend? |
| term | 边界，结束 | term, terminal, determine?（determine 按词判断） |
| terr | 土地 | territory?（按词判断） |
| terr | 怕，恐 | terrible, terrify, terror |
| test | 证，检验 | test, protest? |
| text | 织 | text, textbook, textile? |
| therm | 热 | thermos, thermometer? |
| tom | 切 | atom?（atom 按基础词处理） |
| tort/tour/turn | 转，扭 | tour, tourism, tourist, turn, tortoise? |
| tox | 毒 | toxic?（按词判断） |
| tract | 拉，拖 | tractor, attract, attraction, attractive |
| tribut | 给予，进贡 | contribute, contribution? |
| trud/trus | 推 | intrude?（按词判断） |
| turb | 搅动，混乱 | disturb?（按词判断） |
| tut/tuit | 看守，教导 | tutor |
| typ | 型，印 | type, typical, typewriter, typist |
| umbr | 阴影 | umbrella |
| un/uni | 一 | unit, unite, union, unique, universal, universe, university |
| urb | 城市 | urban |
| us/ut | 用 | use, useful, useless, user, usual, usually |
| val | 强，价值 | value, valuable, valid, available? |
| vari | 变化 | various, variety, vary? |
| ven/vent | 来 | event, adventure, prevent?, invent? |
| vers/vert | 转 | version, conversation, advertise, advertisement? |
| vi/via | 路 | via, obvious, previous? |
| vict/vinc | 胜，征服 | victory |
| vid/vis | 看 | video, visit, visitor, television, visible? |
| vil | 乡村 | village, villager |
| vit/viv | 生命，活 | vital, vivid |
| voc/vok | 声，呼喊 | voice, vocabulary, vocal? |
| void | 空 | avoid |
| vol | 意愿 | volunteer, voluntary |
| volcan | 火山 | volcano |
| volv/volu | 转，滚 | revolution |
| vot | 誓愿，投票 | vote |
| zo | 动物 | zoo |
| act→ag | （并入 ag/act） | — |

> 备注：表内含 `?` 的例词只是"可能有"——代理必须用词典知识确认该词存在与词义，确认不了就不标或按 plain。family 名一律整串照抄，含斜杠。

## 7. 规范前缀表（tag 值照抄，带尾连字符）

| tag（照抄用） | 含义 | 例 |
|---|---|---|
| a- | 在…上/向；加强 | aboard, aside, aloud, awake, away, alone, along |
| ab- | 离开，相反 | abnormal, abroad, absence, absent, abuse |
| ad- | 向，去，靠近；加强 | adapt, admire, admit, adopt, adult?, address? |
| anti- | 反对，防 | Antarctic?（按词判断） |
| auto- | 自己，自动 | automatic, autonomous, automobile? |
| be- | 使…，在…旁 | become, before, behind, behalf |
| bi- | 二，两 | bicycle, biscuit?, billion? |
| co-/col-/com-/con-/cor- | 共同，一起，加强 | collect, combine?, common, communicate, contain, correct? |
| contra- | 相反，相对 | contrary, contrast? |
| de- | 向下；去除；加强 | decide?, delay?, depart?, destroy?, develop? |
| dis- | 不；分开；取消 | discover, discuss, disease?, dislike, distant?, disorder? |
| en-/em- | 使…；进入 | enable?, encourage, employ, enjoy? |
| ex-/e-/ef- | 出，外，前 | exit, example?, exchange, export, effect?, effort? |
| extra- | 以外，超出 | extra, extraordinary |
| fore- | 前，预先 | forecast, forehead, foresee? |
| il-/im-/in-/ir- | 不；向内，进入 | illegal?, import, impossible, include, invisible?, irregular? |
| inter- | 在…之间，相互 | international, internet?, interrupt? |
| intro- | 向内，入 | introduce, introduction? |
| micro- | 微，小 | microcomputer, microscope, microwave |
| mid- | 中 | midday, middle?, midnight |
| mini- | 小的 | minibus, miniskirt |
| mis- | 错，坏 | mistake, misunderstand? |
| multi- | 多 | multiply? |
| ob-/oc-/op- | 逆，反，向 | object, occur?, oppose?, opposite? |
| out- | 出，向外；超过 | outcome, outdoors?, outer, outgoing, outing?, output, outside?, outstanding, outward |
| over- | 在上，越过；过度 | overcoat, overcome, overhead, overlook?, overweight |
| per- | 贯穿，透过，每 | perform, performance?, percent? |
| post- | 后 | postpone, postcode? |
| pre- | 前，预先 | predict?, prefer?, prepare, present?, prevent?, preview |
| pro- | 向前，在前 | produce, product, progress, project, promote? |
| re- | 回，再，重新；相反 | receive?, recycle, reduce?, refuse?, return, review, rewrite |
| se- | 分开，离开 | separate, select? |
| semi- | 半 | semicircle |
| sub-/suc-/suf-/sup-/sus- | 下，次，副 | subject?, succeed, suffer?, suggest?, support? |
| super-/sur- | 上，超，过 | superb?, supermarket?, surface?, surprise |
| sym-/syn- | 共同，相同 | symbol?, sympathy, symphony?, symptom? |
| tele- | 远 | telegram, telephone, telescope, television |
| trans- | 横过，转变，转移 | transform?, translate, transport |
| tri- | 三 | triangle |
| un- | 不；相反动作 | unable, unfair?, unhappy?, undo?, unusual? |
| under- | 下，低于 | underground, underline, understand, underwear?, undertake? |
| up- | 向上 | upset?, upstairs, upward? |

> 同形前缀不同含义（a- 等）按词义判断；`?` 同上；不要拆连写错误（如 university 不拆 un-）。

## 8. 规范后缀表（tag 值照抄，带前连字符）

| tag（照抄用） | 含义 | 例 |
|---|---|---|
| -able/-ible | 能…的，可…的 | comfortable?, valuable, possible?（ible 类） |
| -age | 行为；总称；场所 | advantage?, package, village |
| -al | …的；人；事物 | national, natural, festival?, hospital? |
| -ance/-ence | 性质，状态，行为 | absence?, difference, importance? |
| -ancy/-ency | 性质，状态 | frequency?, agency?（ency/cy 按词判断） |
| -ant/-ent | …的人；…的 | assistant, student?, patient? |
| -ar | …的；…的人 | familiar, similar? |
| -ary | …的；场所，人 | necessary?, library?, dictionary? |
| -ate | 使…；…的；人 | operate, educate?, fortunate? |
| -ation/-tion/-ion/-sion | 行为，状态，结果 | education, action, decision?, expression?, operation |
| -cy | 性质，状态 | agency?, efficiency? |
| -dom | 领域，状态 | freedom?, kingdom? |
| -ed | …的（过去分词形容词化） | bored?, tired?, worried? |
| -ee | 被…的人 | employee?（按词判断） |
| -en | 使…；…制的 | strengthen?, wooden? |
| -er/-or | …的人/物；更… | worker, teacher, actor, visitor, farmer |
| -ern | …方向的 | eastern?, northern?, western? |
| -ese | …国(人)的；…语 | Chinese, Japanese? |
| -ess | 女性 | actress, hostess? |
| -et | 小 | ticket?, packet?（按词判断） |
| -ful | 充满…的，有…性质的 | beautiful?, careful?, useful, successful? |
| -fy/-ify | 使…化，使成为 | satisfy, terrify?, simplify |
| -hood | 时期，身份 | childhood?（按词判断） |
| -ian | …的人；…的 | musician, physician? |
| -ic/-ical | …的 | physical?, magic?, chemical? |
| -ing | 行为，状态；正在…的 | feeling?, building?, interesting? |
| -ish | 稍…的；…族的 | foolish?, selfish?, English? |
| -ism | 主义，学说 | communism?, socialism |
| -ist | …的人，…主义者 | artist, scientist, socialist? |
| -ity/-ty | 性质，状态 | ability, activity, beauty?, university? |
| -ive | …的；…的人 | active, attractive?, expensive?, native? |
| -ize/-ise | 使…化 | apologize, memorize?, realize, recognise? |
| -less | 无…的，不…的 | careless?, endless?, homeless?, useless |
| -let | 小 | booklet?（按词判断） |
| -like | 像…的 | childlike?（按词判断） |
| -ly | …地；…的 | friendly?, quickly?, lively? |
| -ment | 行为，结果，状态 | achievement, development?, government? |
| -ness | 状态，性质 | business?, happiness?, illness? |
| -ous | 多…的，有…性质的 | dangerous?, famous, nervous? |
| -ship | 身份，关系，状态 | friendship, hardship?, leadership? |
| -some | 易于…的 | handsome?, troublesome? |
| -th | 序数；状态 | fourth?, health?, truth?, warmth? |
| -ure | 行为，结果 | culture?, failure?, pleasure? |
| -ward(s) | 向…方向 | backward(s)?, forward(s)?, upward? |
| -wise | 方向；方式 | otherwise, clockwise? |
| -y | 多…的；…的 | angry?, cloudy?, funny?, lucky?, windy? |

## 9. 已知坏音标速修表（片内遇到即按此修，勿犹豫）

abandon? 无 → 遇 `acut` 词条：word 改 acute，ph 补 ˈækjuːt；`AD` 缺 ph 补 ˌeɪˈdiː；airline ph `єәlain`→ˈeəlaɪn；aeroplane ph `` `erə``→ˈeərəpleɪn；analyze ph `` `ænl``→ˈænəlaɪz；anchor ph `æŋkә`→ˈæŋkə(r)；available ph `ˈɔːtəm`→əˈveɪləbl；barbershop ph `` `bɑrbər``→ˈbɑːbəʃɒp；behaviour ph `bɪ\`heɪvjər`→bɪˈheɪvjə(r)；biochemistry ph `.baiәu'kemistri`→ˌbaɪəʊˈkemɪstrɪ；bookshelf ph `` `bʊk``→ˈbʊkʃelf；boring ph `` `bɔrɪŋ``→ˈbɔːrɪŋ；cd ph `ˌsi:ˈdi:`→ˌsiːˈdiː；dvd ph `ˈdi:ˈvi:ˈdi:`→ˌdiːviːˈdiː；exactly ph `exˈact·ly`→ɪɡˈzæktli；factory ph `fæktәri`→ˈfæktəri；food ph `fɔnd`→fuːd；fourth ph `ˈfɔːˈtiːn`→fɔːθ；furnished ph `ˈfə:niʃt`→ˈfɜːnɪʃt；hardworking ph `ˈha:dˈwə:kiŋ`→ˌhɑːdˈwɜːkɪŋ；headteacher ph `hed'ti:tʃər`→ˌhedˈtiːtʃə(r)；honey ph `ˈɔnɪst`→ˈhʌni；hopeless ph `hәuplis`→ˈhəʊplɪs；lab ph `ˈnɔlɪdʒ`→læb；northeast ph `nɒ:θˈi:st`→ˌnɔːθˈiːst；northwest ph `nɒ:θˈwest`→ˌnɔːθˈwest；offence ph `of·fence || əˈfens`→əˈfens；parallel ph `pærәlel`→ˈpærəlel；patience ph `peiʃәns`→ˈpeɪʃns；playroom ph `pleiru:m`→ˈpleɪruːm；possibly ph `pɒsәbli`→ˈpɒsəbli；punctuation ph `.pʌŋktʃu'eiʃәn`→ˌpʌŋktʃuˈeɪʃn；relevant ph `relivәnt`→ˈreləvənt；schoolbag ph `ˈsku:lbæg`→ˈskuːlbæɡ；shaver ph `ʃeivә`→ˈʃeɪvə(r)；should ph `ʃɔt`→ʃʊd；sofa ph `ˈsɔkɪt`→ˈsəʊfə；these ph `ˈθɜːmɔs`→ðiːz；ton ph `təˈmɔrəʊ`→tʌn；tortoise ph `ˈtɔpɪk`→ˈtɔːtəs；tough ph `ˈtɔt(ə)lɪ`→tʌf；twentieth ph `twentiiθ`→ˈtwentiəθ；used ph `ju:st`→juːzd（形容词"用过的"）；wag ph `ˈvɔɪɪdʒ`→wæɡ；wash ph `ˈwɔːnɪŋ`→wɒʃ；weatherman ph `ˈweath·er·man`→ˈweðəmæn；yourselves ph `jɔːˈself`→jɔːˈselvz。其余未列者按 §4 规则与词典知识判断。

## 10. 收尾自查与报告（贴回聊天，简短）

1. 断言：输出条数 == 分片条数；no 连续无重复；每个 JSONL 行能被 ConvertFrom-Json 解析。
2. 报告格式（全部内容不超过 15 行）：
   `SLICE Sxx done: items=n no=<起点>-<终点> first=<word> last=<word>`
   `FIXLOG count=k`（k 为 fixlog 行数）
   `PLAIN n=… / TAGGED n=… / UNCERTAIN n=…`（UNCERTAIN=note 中含"存疑/疑似"的条数）
   `ERR …`（若出错）
禁止贴出整片词条正文。
