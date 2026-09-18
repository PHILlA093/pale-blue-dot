const UNIT_META = [
  { id: "u1", short: "01", label: "Unit 1", title: "Art", color: "#e55c44" },
  { id: "u2", short: "02", label: "Unit 2", title: "Healthy Lifestyle", color: "#25756d" },
  { id: "u3", short: "03", label: "Unit 3", title: "Environmental Protection", color: "#d4932f" },
  { id: "u4", short: "04", label: "Unit 4", title: "Adversity and Courage", color: "#3972b7" },
  { id: "u5", short: "05", label: "Unit 5", title: "Poems", color: "#7a5a9e" }
];

const RAW_VOCABULARY = {
  u1: `
precise|adj. 准确的；精确的|extra
precisely|adv. 准确地；精确地；的确如此|core
Christianity|n. 基督教|extra
realistic|adj. 现实的；逼真的|core
realism|n. 逼真；现实主义；务实作风|extra
realist|n. 现实主义画家（或作家等）；现实主义者|extra
primitive|adj. 发展水平低的；原始的；远古的 n. 文艺复兴前的艺术家（或作品）|core
two-dimensional|adj. 二维的|extra
dimension|n. 维；规模；范围|core
in particular|尤其；特别|core
set apart from|使与众不同；使突出；使优于……|core
humanistic|adj. 人文主义的|extra
humanity|n. 人性；人道；（统称）人类|extra
breakthrough|n. 重大进展；突破|extra
influential|adj. 有很大影响力的；有支配力的|core
reputation|n. 名誉；名声|core
noble|n. 贵族成员；出身高贵的人 adj. 崇高的；宏伟的；高贵的|core
rank|n. 地位；级别；行列 vt. & vi. 把……分等级；使排成行|core
purchase|vt. 购买；采购 n. 购买；购买的东西|core
mythology|n. 神话；虚幻的想法|extra
client|n. 委托人；当事人；客户|core
photography|n. 照相术；摄影|extra
Impressionism|n. 印象主义；印象派（绘画风格）|extra
emerge|vi. & vt. 出现；浮现；暴露|core
sunrise|n. 日出|extra
convey|vt. 表达；传递（思想、感情等）；传送|extra
subjective|adj. 主观的|core
outer|adj. 外表的；外边的；外围的|extra
subsequent|adj. 随后的；后来的；之后的|core
Cubism|n. 立体主义；立体派|extra
fond|adj. 喜爱|core
be fond of|喜爱；喜欢|core
fine art (also fine arts)|美术（尤指绘画和雕塑）|core
sculpture|n. 雕像；雕刻品；雕刻术|core
sculptor|n. 雕刻家；雕塑家|extra
visual|adj. 视觉的；视力的|core
water lily|睡莲|extra
pond|n. 池塘；水池|core
arched|adj. 拱形的；弓形的|extra
arch|vt. & vi. 呈弧形横跨；（使）成弓形 n. 拱；拱形结构；拱门|core
investment|n. 投资额；投资；（时间、精力的）投入|core
bride|n. 新娘|core
permanent|adj. 永久的；永恒的；长久的|core
memorial|n. 纪念碑（或像等）；纪念物；纪念品 adj. 纪念的；悼念的|core
humble|adj. 谦逊的；虚心的；卑微的|core
criticise (NAmE criticize)|vi. & vt. 批评；指责；评价|core
criticism|n. 批评；指责；评论|extra
representative|adj. 典型的；有代表性的 n. 代表|core
ink|n. 墨水；墨汁；油墨|extra
animation|n.（电脑、录像）动画制作； 动画片|extra
frame|n. 画面；框架 vt. 给……镶框；陷害|extra
symphony|n. 交响乐；交响曲|core
decline|n. （数量、价格、质量等的）减少；下降；衰落 vi. & vt. 减少；下降；衰落；谢绝|core
exhibition|n. 展览；（技能、感情或行为的）表演|core
bronze|n. 青铜；深红褐色 adj. 青铜色的；深红褐色的|extra
ceramic|n. 陶瓷制品；制陶艺术|extra
vase|n. 花瓶；装饰瓶|core
artistic|adj. 艺术的；艺术家的|extra
entry|n. 加入；进入；参与|core
civil|adj. 国民的；民用的；民事的|core
recognition|n. 承认；认出；赞誉|core
Buddhist|adj. 佛教的 n. 佛教徒|extra
Buddhism|n. 佛教|extra
expansion|n. 扩张；扩展；扩大|core
bring … to life|赋予……生命；使……鲜活起来|core
guarantee|vt. 保证；确保；肯定……必然发生 n. 保证；保修单；担保物|core
contemporary|adj. 当代的；现代的；属同时期的 n. 同代人；同辈人|core
worthy|adj. 值得……的；有价值的|core
be worthy of|值得|core
The Middle Ages|中世纪|proper
Giotto di Bondone|乔托·迪·邦多纳（意大利画家、雕刻家、建筑师）|proper
the Renaissance|文艺复兴（时期）|proper
Masaccio|马萨乔（意大利现实主义画家|proper
Leonardo da Vinci|莱昂纳多·达·芬奇（意大利艺术家、学者、发明家|proper
Michelangelo|米开朗琪罗（意大利雕塑家、画家、建筑师、诗人）|proper
Raphael|拉斐尔（意大利画家）|proper
Rembrandt|伦勃朗（荷兰画家）|proper
Claude Monet|克劳德·莫奈（法国印象派画家）|proper
Renoir|雷诺阿（法国印象派画家）|proper
Picasso|毕加索（西班牙画家、雕塑家）|proper
Giverny|吉维尼（法国小镇）|proper
Tadpoles Searching for Mother|《小蝌蚪找妈妈》|proper
The Cowboy’s Flute|牧笛》|proper
Feeling from Mountain and Water|山水情》|proper
Clearing After Snow on a Mountain Pass|函关雪霁图》（明代画家唐寅画作）|proper
`,
  u2: `
tobacco|n. 烟草；烟叶|core
alcohol|n. 酒；酒精|core
abuse|n. 滥用；虐待；辱骂 vt. 滥用；虐待；辱骂|core
physical|adj. 身体的；客观存在的；物理学的|extra
dominate|vt. & vi. 支配；控制；占有优势|core
repeatedly|adv. 重复地|extra
psychology|n. 心理学；心理；心理影响|core
cue|n. 提示；暗示；信号 vt. 给（某人）暗示（或提示）|extra
in response to|回答；答复|core
reward|n. 回报；奖励；报酬 vt. 奖励；奖赏；给以报酬|core
rely|vi. 依赖；依靠；信赖|core
rely on|依赖；依靠；信赖|core
facilitate|vt. 促进；促使；使便利|core
examine|vt. （仔细）检查；审查；测验|core
negative|adj. 消极的；有害的；否定的|core
escalator|n. 自动扶梯；滚梯|extra
straight away|立即；马上|core
pessimistic|adj. 悲观的；悲观主义的|core
discipline|n. 自制力；纪律；学科 vt. 自我控制；管教；处罚|core
pill|n. 药丸；药片）|core
delete|删去；删除|core
decide on|决定；选定）|core
make up one’s mind|下定决心|core
compose|vt. & vi. 组成；作曲；撰写|core
be composed of|由……组成（或构成）的|core
surgeon|n. 外科医生|core
surgery|n. 外科手术；外科学|core
liberation|n. 解放；摆脱|core
shave|vi., vt. & n. 剃（须发）；刮脸|core
shave off|剃掉；刮去|core
beard|n. 胡须；络腮胡子|core
disturb|vt. 打扰；搅乱；使烦恼|core
cigarette|n. 香烟；卷烟|core
specialist|n. 专科医生；专家|core
consultant|n. 顾问；高级顾问医师|core
drug|n. 毒品；药物|core
skip|vt. 跳过；不参加；悄悄溜走 vi. 蹦蹦跳跳地走；跳绳 n. 蹦跳|core
dizzy|adj. 头晕目眩的|core
flu|n. 流感|core
stimulate|vt. 激发；促进；刺激|core
dentist|n. 牙科医生|core
sugary|adj. 含糖的；甜的|extra
nut|n. 坚果|core
skateboard|n. 滑板 vi. 滑滑板|core
dynamic|adj. 充满活力的；精力充沛的；动态的|core
stressed out|焦虑不安；心力交瘁|core
worn out|筋疲力尽的；疲惫的|core
bowling|n. 保龄球运动|core
comedy|n. 喜剧；喜剧片；滑稽节目|core
monthly|adv. & adj. 每月；每月一次的 n. 月刊|core
enhance|vt. 提高；增强；增进|core
refresh|vt. 使恢复精力；使凉爽；刷新|core
absorb|vt. 吸引全部注意力；吸收|core
Aristotle|亚里士多德（古希腊哲学家）|proper
People’s Liberation Army (PLA)|中国人民解放军|proper
`,
  u3: `
graph|n. 图；图表；曲线图|extra
emission|n. 排放物；散发物；排放|extra
melt|vi. & vt. （使）融化；熔化；软化|extra
starve|vi. & vt. （使）挨饿；饿死|core
seal|n. 海豹|extra
ecology|n. 生态；生态学|core
release|vt. & n. 排放；释放；发布|core
methane|n. 甲烷；沼气|extra
carbon|n. 碳|core
dioxide|n. 二氧化物|extra
carbon dioxide|二氧化碳|core
habitable|adj. 适合居住的|extra
sustain|vt. 维持；遭受；承受住|core
sustainable|adj. 可持续的；合理利用的|extra
fossil|n. 化石|extra
fuel|n. 燃料；刺激性言行|core
fossil fuel|化石燃料（如煤或石油）|core
comprehensive|adj. 全部的；所有的；详尽的|core
worldwide|adv. 遍及全球地 adj. 世界各地的；影响全世界的|extra
trend|n. 趋势；趋向；动向|core
frequently|adv. 频繁地；经常|core
broadcast|vt. & vi. （broadcast, broadcast） 播送；广播； 传播 n. 广播节目；电视节目|core
policy|n. 政策；方针；原则|core
footprint|n. 足迹；（某物所占的）空间量；面积|extra
restrict|vt. 限制；限定；束缚|core
restriction|n. 限制规定；限制法规；约束|extra
seize|vt. 抓住；夺取；控制|core
basin|n. 流域；盆地；盆|core
penguin|n. 企鹅|extra
reform|vi. & vt. 改革；（使）改正；改造 n. 改革；变革；改良|core
undergo|vt. （underwent, undergone） 经历；经受（变化、不快等）|extra
implement|vt. 使生效；贯彻；执行|extra
harmonious|adj. 和谐的|core
moderate|adj. 适度的；中等的；温和的 vi. & vt. 缓和；使适中|extra
submit|vt. & vi. 提交；呈递；屈服|core
annual|adj. 每年的；一年的 n. 年刊；年鉴|core
tropical|adj. 热带的；来自热带的|extra
chaos|n. 混乱；杂乱；紊乱|core
on behalf of|代表（代替）某人|core
nuclear|adj. 原子能的；核能的；原子核的|core
sensitive|adj. 敏感的；善解人意的；灵敏的|core
jungle|n. （热带）丛林；密林|core
smog|n. 烟雾（烟与雾混合的空气污染物）|core
originate|vi. & vt. 起源；发源；创立|extra
volume|n. 量；体积；（成套书籍中的）一卷|core
garbage|n. 垃圾；废物|core
enterprise|n. 公司；企业；事业|core
restore|vt. 恢复；使复原；修复|core
conservation|n.（对环境、文物等）保护；保持|core
dozen|n. （一）打；十二个|core
dozens of|许多；很多|core
regulation|n. 章程；规章制度|extra
disposal|n. 去掉；清除；处理|extra
inspection|n. 检查；查看；视察|core
fine|vt. 对……处以罚款|core
campaign|n. 运动；战役 vi. & vt. 参加运动；领导运动|core
waterway|n. 水道；航道|extra
tolerate|vt. 忍受；包容；容许|core
agenda|n. 议程表；议事日程|core
Norway|挪威（北欧国家）|proper
Svalbard|斯瓦尔巴群岛（挪威）|proper
Hurricane Katrina|飓风卡特里娜|proper
`,
  u4: `
adversity|n. 困境；逆境|extra
wage|n. 工资|core
bitter|adj. 严寒的；激烈而不愉快的；味苦的|core
expedition|n. 探险；远征；探险队|extra
endurance|n. 忍耐力；耐久力|extra
vigour (NAmE vigor)|n. 精力；力量；活力|extra
turn sb down|拒绝（某人）|core
qualified|adj. 符合资格；具备……的知识（或技能、学历等）|extra
enthusiastic|adj. 热情的；热心的|core
aboard|adv. & prep. 上（船、飞机、公共汽车等|core
cupboard|n. 橱柜；壁橱；衣柜|core
assign|vt. 分派；布置；分配|core
steward|n. （轮船、飞机或火车上的）乘务员；服务员|extra
envy|n. & vt. 羡慕；妒忌|core
crush|vt. 毁坏；压坏；压碎 n. 拥挤的人群|extra
sink|vi. （sank or snk, snk） 沉没；下沉；下降 vt. 使下沉；使沉没|core
abandon|vt. 舍弃；抛弃；放弃|core
stove|n. 炉具；厨房灶具|extra
blanket|n. 毯子|core
belongings|n. ［ pl.］ 财物；动产|extra
banjo|n. 班卓琴（乐器）|extra
miserable|adj. 痛苦的；令人难受的|extra
voyage|n. & vi. 航海；航行|extra
navy|n. 海军；海军部队|core
decent|adj. 相当不错的；正派的；得体的|core
cosy (NAmE cozy)|adj. 温馨的；舒适的|extra
selfish|adj. 自私的|extra
good/bad-tempered|adj. 脾气好的 / 坏的|extra
genuine|adj. 真正的；真诚的；可信赖的|core
perseverance|n. 毅力；韧性；不屈不挠的精神|extra
persevere|vi. 坚持；孜孜以求|extra
resolve|vi. & vt. 决定；决心；解决（问题或困难） n. 决心；坚定的信念|core
resolution|n. 决议；解决；坚定|core
crew|n. （轮船、飞机等上面的）全体工作人员； 专业团队；一群人|core
cruel|adj. 残酷的；残忍的；冷酷的|core
thorough|adj. 深入的；彻底的；细致的|core
furniture|n. 家具 的|core
unfortunately|adv. 不幸地； 遗憾地|extra
fortunately|adv. 幸运地|core
bark|vi. & n. （狗）吠叫；吠叫声|core
rugby|n. 橄榄球运动|core
bat|n. 球拍；蝙蝠 vi. & vt. 用球板击球；挥打；拍打|core
damp|adj. 潮湿的；湿气重的|core
recreation|n. 娱乐；消遣；游戏|core
guidance|n. 指导；引导；导航|core
nephew|n. 侄子；外甥|core
advertising|n. 广告活动；广告业|extra
advertise|vt. & vi. 公布；宣传；做广告|core
corporate|adj. 公司的；法人的；社团的|core
rough|adj. 汹涌的；粗糙的；粗略的|extra
navigator|n. 领航员；（飞机、船舶等上的）航行者|extra
loyal|adj. 忠诚的；忠实的|extra
motor|n. 发动机；马达 adj. 有引擎的；机动车的|core
candidate|n. 候选人；应试者|core
make fire|生火|core
give off|放出（热、光、气味或气体）|core
episode|n. （人生的）一段经历；（小说的）片段；插曲|core
commitment|n. 承诺；保证；奉献|core
motive|n. 动机；原因；目的|core
Confucianism|n. 孔子学说；儒家（学说）|core
Ernest Shackleton|欧内斯特·沙克尔顿（英国探险家）|proper
Perce Blackborow|珀西·布莱克博罗（“坚忍”号服务员）|proper
Antarctica|南极洲|proper
the Antarctic|南极地区|proper
the South Pole|南极|proper
South Georgia Island|南乔治亚岛（南极洲）|proper
Frank Wild|弗兰克·怀尔德|proper
Thomas Orde-Lees|托马斯·奥德利斯|proper
Frank Worsley|弗兰克·沃斯利|proper
Tom Crean|汤姆·克林|proper
Hubert Hudson|休伯特·赫德森|proper
Lionel Greenstreet|莱昂内尔·格林斯特里特|proper
`,
  u5: `
drama|n. 戏；剧；戏剧艺术|core
sorrow|n. 悲伤；悲痛；伤心事 vi. 感到悲伤|core
imagery|n. 形象的描述；意象；像|extra
literary|adj. 文学的；爱好文学的；有文学作品特征的|core
rhyme|n. 押韵词；押韵的短诗 vi. & vt. （使）押韵|core
rhythm|n. 节奏；韵律；规律|extra
nursery|adj. 幼儿教育的 n. 托儿所；保育室|extra
nursery rhyme|童谣；儿歌|core
folk|adj. 民间的；民俗的；普通百姓的|core
mockingbird|n. 嘲鸫（美洲鸣禽，能模仿别种鸟的鸣叫）|extra
diamond|n. 钻石；金刚石；菱形|core
brass|n. 黄铜；黄铜制品；铜管乐器|extra
billy goat|公山羊|extra
bull|n. 公牛|extra
recite|vt. 背诵； 吟诵；列举|core
bee|n. 蜜蜂|extra
dewdrop|n. 露珠；水珠|extra
dawn|n. 黎明；开端；萌芽|extra
clover|n. 三叶草|extra
butterfly|n. 蝴蝶|extra
lawn|n. 草坪；草地|extra
amateur|n. 业余爱好者 adj. 业余的；业余爱好的|core
cinquain|n. 五行诗|extra
be made up of|由……组成（构成）|core
mood|n. 情绪；心情；语气|core
tease|vi. & vt. 取笑（某人）；揶揄；逗弄|extra
haiku|n. 俳句|extra
syllable|n. 音节|extra
format|n. 格式；总体安排；（出版物的）版式 vt. 格式化|core
respectively|adv. 分别；各自；依次为|extra
respective|adj. 分别的；各自的|core
blossom|n. 花朵；花簇|extra
delicate|adj. 精美的；精致的；脆弱的|core
await|vt. 等候；期待；将发生在|extra
revolve|vi. 旋转；环绕；转动|extra
utter|vt. 出声；说；讲 adj. 完全的；十足的；彻底的|extra
comprehension|n. 理解力；领悟力；理解练习|core
shelf|n. （pl. shelves）架子；搁板|core
core|n. 核心；精髓；（水果的）核儿|core
cherry|n. 樱桃；樱桃树；樱桃色 adj. 樱桃色的；鲜红色的|extra
cherry blossom|樱花|extra
blank|adj. 空白的；无图画（或韵律、装饰）的；没表情的 n. 空白；空格|core
verse|n. 诗；韵文；诗节|extra
civilian|n. 平民；老百姓|core
prose|n. 散文|extra
sympathetic|adj. 同情的；有同情心的；赞同的|extra
sympathy|n. 同情；赞同|core
version|n. 版本；（从不同角度的）说法|core
innocence|n. 天真；单纯；无罪|extra
innocent|adj. 天真无邪的；无辜的；无恶意的|core
era|n. 时代；年代；纪元|core
correspondence|n. 来往信件；通信联系|extra
correspond|vi. 相一致；符合；相当于；通信|core
sow|vt. & vi. （sowed, sown or sowed） 播种；种|core
seed|n. 种子；起源；萌芽|core
dominant|adj. 首要的；占支配地位的；显著的|extra
sonnet|n. 十四行诗|extra
deadline|n. 最后期限；截止日期|core
contest|n. 比赛；竞赛；竞争 vt. 争取赢得（比赛、选举等）；争辩|core
polish|vt. 修改；润色；抛光 n. 上光剂；抛光；擦亮|core
string|n. 细绳；线；一串 vt. （strung, strung）悬挂；系 adj. 弦乐器的；线织的|core
wherever|conj. 在任何地方；在所有……的情况下 adv. （用于问句）究竟在（到）哪里|extra
barren|adj. 贫瘠的；不结果实的|extra
grief|n. 悲伤；悲痛；伤心事|extra
complicated|adj. 复杂的；难懂的|core
variation|n. 变化；变体；变奏曲|core
racial|adj. 种族的；人种的|core
prejudice|n. 偏见；成见 vt. 使怀有（或形成）偏见|core
Shakespeare|莎士比亚（英国剧作家、诗人）|proper
The Crescent Moon|新月集》|proper
Tagore|泰戈尔（印度诗人、文学家）|proper
Elizabeth Barrett Browning|伊丽莎白·巴雷特·布朗宁（英国诗人）|proper
Robert Browning|罗伯特·布朗宁（英国诗人）|proper
the Victorian era|维多利亚时代|proper
Sonnets from the Portuguese|葡萄牙人的十四行诗集》|proper
Langston Hughes|兰斯顿·休斯|proper
`
};

const VOCABULARY = Object.entries(RAW_VOCABULARY).flatMap(([unit, raw]) =>
  raw.trim().split("\n").filter(Boolean).map((line, index) => {
    const [word, meaning, type = "core"] = line.split("|");
    return { id: `${unit}-${index + 1}`, unit, word: word.trim(), meaning: meaning.trim(), type: type.trim() };
  })
);

