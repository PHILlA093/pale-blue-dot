const UNIT_META = [
  { id: "u1", short: "01", label: "Unit 1", title: "Science and Scientists", color: "#e55c44" },
  { id: "u2", short: "02", label: "Unit 2", title: "Bridging Cultures", color: "#25756d" },
  { id: "u3", short: "03", label: "Unit 3", title: "Food and Culture", color: "#d4932f" },
  { id: "u4", short: "04", label: "Unit 4", title: "Journey Across a Vast Land", color: "#3972b7" },
  { id: "u5", short: "05", label: "Unit 5", title: "First Aid", color: "#7a5a9e" }
];

const RAW_VOCABULARY = {
  u1: `
cholera|n. 霍乱|extra
severe|adj. 极为恶劣的；十分严重的；严厉的|core
diarrhoea|n. 腹泻|extra
dehydration|n. 脱水|extra
frustrated|adj. 懊恼的；沮丧的；失意的|extra
once and for all|最终地；彻底地|core
contradictory|adj. 相互矛盾的；对立的；不一致的|core
infection|n. 感染；传染|core
infect|vt. 使感染；传染|extra
germ|n. 微生物；细菌；病菌|extra
subscribe|vi. 认购（股份）；定期订购；定期交纳（会费）|core
subscribe to|同意；赞同|core
proof|n. 证据；证明；检验|core
multiple|adj. 数量多的；多种多样的|core
pump|n. 泵；抽水机；打气筒|extra
water pump|水泵|core
household|n. 一家人；家庭；同住一所（套）房子的人|core
suspect|vt. & vi. 怀疑；疑有；不信任 n. 犯罪嫌疑人；可疑对象|core
blame|vt. 把……归咎于；责怪；指责 n. 责备；指责|core
handle|n. 把手；拉手；柄 vt. 处理；搬动；操纵（车辆、动物、工具等）|core
intervention|n. 介入；出面；干涉|core
link|n. 联系；纽带 vt. 把……连接起来；相关联|core
raw|adj. 未煮的；生的；未经处理的；原始的|core
pure|adj. 干净的；纯的；纯粹的|core
substantial|adj. 大量的；价值巨大的；重大的|core
decrease|n. 减少；降低；减少量 vt. & vi.（使大小、数量等）减少；减小；降低|core
thanks to|幸亏；由于|core
statistic|n.［ pl. -s］ 统计数字；统计资料；统计学|core
transform|vt. 使改观；使改变形态 vi. 改变；转变|core
epidemiology|n. 流行病学|extra
microscope|n. 显微镜|core
thinking|n. 思想；思维；见解|core
protein|n. 蛋白质|core
cell|n. 细胞；小房间；单间牢房|core
virus|n. 病毒|core
finding|n. 发现；调查结果；（法律）判决|core
initial|adj. 最初的；开始的；第一的|core
vaccine|n. 疫苗|extra
framework|n. 框架；结构|core
theoretical framework|理论框架|core
solid|adj. 可靠的；固体的；坚实的 n. 固体|core
cast|vt.（cast, cast）投射； 向……投以（视线、笑容等）；投掷|core
shadow|n. 阴影；影子；背光处|core
rainbow|n. 彩虹|core
pour|vt. 倒出；倾泻；斟（饮料）|core
concrete|n. 混凝土 adj. 混凝土制的；确实的；具体的|core
plasma|n. 血浆|extra
aerospace|n. 航空航天工业|extra
patriotic|adj. 爱国的|extra
mechanical|adj. 机械的；发动机的；机器的|extra
mechanic|n. 机械师；机械修理工|core
break out|（战争、打斗等不愉快的事情）突然开始；爆发|core
aviation|n. 航空制造业；航空；飞行|extra
defend|vt. 保卫；防守；辩解|core
jet|n. 喷气式飞机|extra
assistant|n. 助理；助手|core
in charge of|主管；掌管|core
missile|n. 导弹|core
leadership|n. 领导；领导地位；领导才能|core
trace|vt. 追溯；追踪；查出 n. 痕迹；遗迹；踪迹|extra
outstanding|adj. 优秀的；杰出的；明显的|core
gifted|adj. 有天赋的；有天才的；天资聪慧的|core
come down with|患（病）；染上（小病）|core
abstract|adj. 抽象的；理论上的 n.（文献等的）摘要|core
steady|adj. 稳定的；平稳的；稳步的|extra
concept|n. 概念；观念|core
astronomer|n. 天文学家|core
astronomy|n. 天文学|extra
besides|prep. 除……之外（还） adv. 而且；此外|extra
brilliant|adj. 聪颖的；绝妙的；明亮的|core
furthermore|adv. 此外；再者|extra
above all|最重要的是；尤其是|core
fault|n. 弱点；过错|core
shift|n. 改变；转换；轮班 vi. & vt. 转移；挪动；转向|core
vivid|adj. 生动的；鲜明的；丰富的|core
Queen Victoria|维多利亚女王（英国女王）|proper
Cambridge|剑桥（英国城市）|proper
non-Newtonian fluid|非牛顿流体|proper
the Jet Propulsion Laboratory|喷气推进实验室（美国）|proper
Stephen Hawking|史蒂芬 · 霍金（英国物理学家）|proper
the big bang theory|大爆炸宇宙论|proper
Fred Hoyle|弗雷德 · 霍伊尔（英国天文学家）|proper
`,
  u2: `
complex|adj. 复杂的；难懂的；（语法）复合的|core
recall|vt. & vi. 记起；回想起|core
qualification|n.（通过考试或学习课程取得的）资格；学历|core
qualify|vt. & vi.（使）具备资格；（使）合格|core
ambition|n. 追求的目标；夙愿；野心；抱负|core
ambitious|adj. 有野心的；有雄心的|core
adaptation|n. 适应；改编本|core
comfort|n. 安慰；令人感到安慰的人或事物；舒服；安逸 vt. 安慰；抚慰|core
tutor|n.（英国大学中的）助教；导师；家庭教师|extra
cite|vt. 引用；引述|core
participation|n. 参加；参与|extra
participate|vi. 参加；参与|core
participate in|参加；参与|core
presentation|n. 报告；陈述；出示；拿出|core
speak up|大声点说；明确表态|core
feel at home|舒服自在；不拘束|core
engage|vi. 参加；参与（活动） vt. 吸引（注意力、兴趣）|core
engage in|（使）从事；参与|core
involve|vt. 包含；需要；涉及；影响；（使）参加|core
get involved in|参与；卷入；与……有关联|core
messenger|n. 送信人；信使|extra
edition|报纸、杂志）一份；（广播、电视节目） 一期、一辑；版次|extra
culture shock|文化冲击|core
zone|n.（有别于周围的）地区；地带；区域|core
comfort zone|舒适区；舒适范围|core
overwhelming|adj. 无法抗拒的；巨大的；压倒性的|extra
homesickness|n. 思乡病；乡愁|extra
motivated|adj. 积极的；主动的|extra
motivation|n. 动力；积极性；动机|extra
motivate|vt. 成为……的动机；激发；激励|core
advisor (also adviser)|n.（also -ser） 顾问|extra
reasonable|adj. 有道理的；合情理的|extra
expectation|n. 期望；预期；期待|core
applicant|n. 申请人|core
firm|n. 公司；商行；事务所 adj. 结实的；牢固的；坚定的|core
exposure|n. 接触；体验；暴露；揭露|core
expose|vt. 使接触；使体验；显露；使暴露于（险境）|core
insight|n. 洞察力；眼光|core
departure|n. 离开；启程；出发|core
setting|n. 环境；背景；（小说等的）情节背景|core
grasp|vt. 理解；领会；抓紧|core
dramatic|adj. 巨大的；突然的；急剧的；戏剧（般）的|core
expense|n. 费用；花费；开销|core
cost an arm and a leg|（使）花一大笔钱|core
tremendous|adj. 巨大的；极大的|extra
behave|vt. 表现 vi. & vt. 表现得体；有礼貌|core
surroundings|n.［ pl.］ 环境；周围的事物|extra
surrounding|adj. 周围的；附近的|core
mature|adj. 成熟的|core
depressed|adj. 沮丧的；意志消沉的|extra
depress|vt. 使沮丧；使忧愁|core
boom|vi. & n. 迅速发展；繁荣|extra
strengthen|vi. & vt. 加强；增强；巩固|core
deny|vt. 否认；否定；拒绝|core
optimistic|adj. 乐观的|core
gain|vt. 获得；赢得；取得；增加 n. 好处；增加|core
perspective|n.（思考问题的）角度；观点|extra
competence|n. 能力；胜任；本领|core
competent|adj. 有能力的；称职的|extra
envoy|n. 使者；使节；代表|extra
cooperate|vi. 合作；协作；配合|core
angle|n. 角；角度；立场|core
outlook|n. 前景；可能性；观点|extra
belt|n. 腰带；地带|core
initiative|n. 倡议；新方案|core
sincerely|adv. 真诚地；诚实地|core
budget|n. 预算|core
side with|支持；站在……的一边|core
logical|adj. 合乎逻辑的；合情合理的|core
as far as I know|据我所知|core
as far as I am concerned|就我而言；依我看来|core
in summary|总的来说；总之|core
generally speaking|一般来说|core
outcome|n. 结果；效果|core
Rome|罗马（意大利首都）；（史）罗马城；罗马帝国|proper
Aisha|艾莎|proper
the Belt and Road Initiative|一带一路”倡议|proper
`,
  u3: `
cuisine|n. 菜肴；风味；烹饪|core
prior|adj. 先前的；优先的|core
prior to|在……之前的|core
consist|vi. 组成；构成|core
consist of|由……组成（或构成）|core
pepper|n. 甜椒；灯笼椒；胡椒粉|core
recipe|n. 烹饪法；食谱|core
bold|adj. 大胆自信的；敢于冒险的|extra
chef|n. 厨师；主厨|core
peppercorn|n. 胡椒粒|extra
vinegar|n. 醋|extra
stuff|vt. 填满；把……塞进 n. 东西；物品|core
slice|n.（切下的食物）薄片 vt. 把……切成薄片|core
slice... off|切下|core
onion|n. 洋葱；葱头|core
lamb|n. 羊羔肉；羔羊|core
lamb kebab|烤羊肉串|extra
elegant|adj. 精美的；讲究的；文雅的|core
dim sum|n. 点心（中国食品）|core
exceptional|adj. 特别的；罕见的|core
minimum|n. 最小值；最少量 adj. 最低（限度）的；最小的|core
consume|vt. 吃；喝；饮；消耗|core
temper|n. 脾气；火气|extra
vegetarian|n. 素食者|extra
junk|n. 无用的东西|extra
junk food (also junk)|垃圾食品|core
garlic|n. 蒜|core
bacon|n. 熏猪肉；咸肉|core
ham|n. 火腿|core
sausage|n. 香肠；腊肠|core
cabbage|n. 甘蓝；卷心菜；洋白菜|core
bean curd (also tofu)|n. (=tofu ) 豆腐|core
brand|n. 品牌|extra
olive|n. 油橄榄；橄榄树|extra
fig|n. 无花果|extra
ingredient|n.（尤指烹饪）材料；成分|extra
dessert|n.（饭后）甜点|core
dough|n. 生面团|extra
stable|adj. 稳定的；稳重的|extra
haggis|n.（苏格兰）羊杂碎肚|extra
canteen|n. 食堂；餐厅|core
cafeteria|n. 自助餐厅；自助食堂|core
bun|n. 圆面包；小圆甜饼|extra
chilli (NAmE chili)|n. 辣椒|extra
pork|n. 猪肉|core
red braised pork|红烧肉|core
pearl|n. 珍珠|extra
somewhat|adv. 有点；稍微|core
madam|n. 夫人；女士|core
calorie|n. 卡路里（热量单位）|core
association|n. 协会；关联|core
regardless|adv. 不顾；不加理会|core
regardless of|不管；不顾|core
category|n. 类别；种类|core
vitamin|n. 维生素|extra
fibre (especially US fiber)|n. 纤维；纤维制品|core
quantity|n. 数量；数额|core
dairy|adj. 奶制的；乳品（业）的 n. 乳制品；乳品店；牛奶厂|extra
moderation|n. 适度；合理|extra
ideal|adj. 完美的；理想的；想象的 n. 理想；完美的人（或事物）|core
fundamental|adj. 根本的；基础的；基本的 n. 基本规律；根本法则|core
chew|vi. & vt. 咀嚼；嚼碎 n. 咀嚼|core
consistent|adj. 一致的；连续的|core
modest|adj. 些许的；谦虚的；朴素的|extra
trick|n. 诀窍；计谋；把戏|core
overall|adv. 总体上；大致上 adj. 全面的；综合的|core
Jean Anthelme Brillat-Savarin|让·安泰尔姆·布里亚-萨瓦兰（法国美食家）|proper
Kazak|adj. 哈萨克族的 n. 哈萨克族人|proper
St Andrews|圣安德鲁斯（英国城市）|proper
`,
  u4: `
airline|n. 航空公司|core
bay|n.（海或湖的）湾|core
craft|n. 手艺；工艺；技艺|extra
antique|n. 古物；古董 adj. 古老的；古董的|core
pleasant|adj. 令人愉快的；友好的|core
arise|vi.（arose, arisen） 起身；出现；由……引起|core
massive|adj. 巨大的；非常严重的|core
literally|adv. 字面上；真正地|core
breath|n. 呼吸的空气|core
take sb’s breath away|令人惊叹|core
bound|adj. 准备前往（某地）；一定会|core
scenery|n. 风景；景色|extra
awesome|adj. 令人惊叹的；可怕的；很好的|core
spectacular|adj. 壮观的；壮丽的；惊人的 n. 壮丽的场面；精彩的表演|extra
peak|n. 顶峰；山峰；尖形|core
highlight|n. 最好或最精彩的部分 vt. 突出；强调；使醒目|core
goat|n. 山羊|core
grizzly bear|n. 灰熊|core
drill|vi. & vt. 钻（孔）；打（眼） n. 钻（头）；训练；演习|core
freezing|adj. 极冷的；冰冻的|extra
freezing cold|极冷的；冻僵的|core
freeze|vi. & vt.（froze, frozen）结冰；（使）冻住|core
mall (also shopping mall)|n.（also shopping mall） 购物商场；购物广场|extra
prairie|n. 北美草原|extra
anticipate|vt. 预料；预见；期望|core
bunch|n. 束；串；捆|core
a bunch of|一束；一串；一群；大量|core
thunder|vi. 打雷；轰隆隆地响；轰隆隆地快速移动 n. 雷声；轰隆声|core
frost|n. 霜；严寒天气；霜冻 vt. 使蒙上霜 vi. 结霜|core
curtain|n. 窗帘|core
border|n. 国界；边界（地区）|core
duration|n. 持续时间；期间|core
harbour (especially US harbor)|n.（海）港；港口|extra
enrol (especially US enroll)|vi. & vt.（使）加入；注册；登记|extra
quarry|n. 采石场|extra
idiom|n. 习语；成语|core
contrary|adj. 相反的；相对立的 n. 相反的事实（或事情）|core
contrary to|相反的；相对立的|core
anyhow|adv.（结束交谈或转换话题时）不过；反正|core
alongside|prep. 在……旁边；与……一起 adv. 在旁边|core
proceed|vi. 行进；继续做|core
proceed to sth|进而做（参加）|core
shore|n. 岸；滨|core
astonish|vt. 使十分惊讶；使吃惊|core
misty|adj. 多雾的；模糊的|extra
mist|n. 薄雾；水汽|core
steel|n. 钢；钢铁工业|core
dusk|n. 黄昏；傍晚|extra
advertisement|n.（informal ad）广告；启事|core
accent|n. 口音|core
photographer|n. 摄影师；拍照者|core
owe|vt. 欠（账、债、情等）|core
owe sth to sb|欠（某人情）；把……归功于某人|core
toast|n. 烤面包片；吐司；干杯 vt. 为……干杯 vt. & vi. 烤（尤指面包）|core
cobblestone|adj. 铺有鹅卵石的|extra
coherent|adj. 有条理的；清楚易懂的|extra
Halifax|哈利法克斯（加拿大城市）|proper
Vancouver|温哥华（加拿大城市）|proper
Lake Louise|路易斯湖|proper
Jasper|贾斯珀（加拿大城市）|proper
Toronto|多伦多（加拿大城市）|proper
Edmonton|埃德蒙顿（加拿大城市）|proper
Winnipeg|温尼伯（加拿大城市）|proper
Ontario|安大略省（加拿大）|proper
Butchart Gardens|布查特花园|proper
Lake Huron|休伦湖|proper
Quebec City|魁北克市（加拿大城市）|proper
Montreal|蒙特利尔（加拿大城市）|proper
Niagara Falls|尼亚加拉瀑布|proper
St Lawrence River|圣劳伦斯河|proper
Jean-Philippe|让 - 菲利普|proper
Nova Scotia|新斯科舍省（加拿大）|proper
`,
  u5: `
technique|n. 技能；技术；技艺|core
leaflet|n. 散页印刷品；传单；小册子|extra
organ|n.（人或动植物的）器官|core
toxin|n. 毒素（尤指细菌产生的致病物质）|extra
ray|n. 光线；光束；（热、电等）射线|core
sense of touch|触觉|core
radiation|n. 辐射；放射线|core
acid|n. 酸 adj. 酸的；酸性的|core
millimetre|n. 毫米；千分之一米|core
minor|adj. 较小的；次要的；轻微的|core
layer|n. 层；表层；层次|extra
electric|adj. 电的；用电的；电动的|extra
electric shock|触电；电击|extra
victim|n. 受害者；患者|core
swollen|adj.（身体部位）肿起的；肿胀的|extra
swell|vi.（swelled, swollen） 膨胀；肿胀|extra
blister|n.（皮肤上因摩擦、烫伤等引起的） 水疱；（金属等表面的）气泡、水泡|extra
underneath|prep. & adv. 在……底下；隐藏在下面|extra
nerve|n. 神经|extra
fabric|n. 织物；布料；（社会、机构等的）结构|core
loose|adj. 松的；未系紧的；宽松的|core
urgent|adj. 紧急的；急迫的；急切的|core
ease|vi. & vt.（使）宽慰；减轻；缓解 n. 容易；舒适；自在|core
paramedic|n. 急救医生；护理人员|extra
swallow|vt. & vi. 吞下；咽下|extra
wrap|vt. 包、裹；（用手臂等）围住|core
bathtub|n. 浴缸；浴盆|extra
bath|n. 洗澡；（BrE=bathtub）浴缸；浴盆 vt.（NAmE=bathe）给……洗澡|core
slip|vi. 滑倒；滑落；溜走 n. 滑倒；小错误；纸条|core
mosquito|n.（pl. -oes, -os）蚊子|core
elderly|adj. 年纪较大的；上了年纪的（婉辞|core
carpet|n. 地毯|core
operator|n. 电话接线员；操作员|core
ambulance|n. 救护车|core
delay|vi. & vt. 推迟；延期（做某事） vt. 耽误；耽搁 n. 延误；耽搁（的时间）；推迟|core
needle|n. 针；缝衣针；注射针；指针|core
IV needle|静脉注射针|extra
vital sign|生命体征|extra
ward|n. 病房|core
drown|vi. & vt.（使）淹死；溺死；浸泡；淹没|extra
sprain|vt. 扭伤（关节） n. 扭伤|extra
ankle|n. 踝；踝关节|core
bleeding|n. 流血；失血|extra
bleed|vi.（bled, bled） 流血；失血|core
panic|vi. & vt.（使）惊慌 n. 惊恐；恐慌|core
interrupt|vi. & vt. 打断；打扰 vt. 使暂停；使中断|core
scream|vi. & vt.（因愤怒或恐惧）高声喊；大声叫 n. 尖叫；尖锐刺耳的声音|core
fellow|adj. 同类的；同事的；同伴的；同情况的 n. 男人；家伙；同事；同辈；同类|core
diner|n.（尤指餐馆的）就餐者|extra
choke|vi. & vt.（使）窒息；（使）哽咽|core
steak|n. 牛排；肉排|core
throat|n. 咽喉；喉咙|extra
desperate|adj. 绝望的；孤注一掷的；非常需要的|core
slap|vt.（用手掌）打、拍 n.（用手掌）打、拍；拍击声|extra
help sb to one’s feet|帮助某人站起身来|core
practical|adj. 切实可行的；实际的；实践的|core
obstruction|n. 阻碍；堵塞；阻塞物|extra
fist|n. 拳；拳头|core
grab|vt. 抓住；攫取 n. 抓取；抢夺|core
tightly|adv. 紧紧地；牢固地；紧密地|extra
tight|adj. 牢固的；紧身的；绷紧的；严密的 adv. 紧紧地；牢固地|core
motion|n. 运动；移动|core
face up/down|面朝上（朝下）|core
`
};

const VOCABULARY = Object.entries(RAW_VOCABULARY).flatMap(([unit, raw]) =>
  raw.trim().split("\n").filter(Boolean).map((line, index) => {
    const [word, meaning, type = "core"] = line.split("|");
    return { id: `${unit}-${index + 1}`, unit, word: word.trim(), meaning: meaning.trim(), type: type.trim() };
  })
);

