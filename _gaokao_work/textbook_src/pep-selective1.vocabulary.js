const UNIT_META = [
  { id: "u1", short: "01", label: "Unit 1", title: "People of Achievement", color: "#e55c44" },
  { id: "u2", short: "02", label: "Unit 2", title: "Looking into the Future", color: "#25756d" },
  { id: "u3", short: "03", label: "Unit 3", title: "Fascinating Parks", color: "#d4932f" },
  { id: "u4", short: "04", label: "Unit 4", title: "Body Language", color: "#3972b7" },
  { id: "u5", short: "05", label: "Unit 5", title: "Working the Land", color: "#7a5a9e" }
];

const RAW_VOCABULARY = {
  u1: `
physiology|n. 生理学；生理机能|extra
artemisinin|n. 青蒿素|extra
crucial|adj. 至关重要的；关键性的|core
malaria|n. 疟疾|extra
vital|adj. 必不可少的；极其重要的； 充满生机的|core
committed|adj. 尽心尽力的；坚定的； 坚信的|extra
commit|vt. 承诺；保证 vi. 忠于；全心全意投入（工作、活动等）|core
commit oneself to (sth/doing sth/do sth)|承诺；保证（做某事、遵守协议或安排等）|core
academy|n.（艺术、文学、科学等的） 研究院；学会；专科院校|extra
academic|adj. 学业的；学术的|core
objective|n. 目标；目的 adj. 客观的|core
botanical|adj. 植物学的|core
evaluate|vt. 评价；评估|core
property|n. 性质；特征；财产|core
distinct|adj. 清晰的；清楚的；有区别的|core
extract|n. 提取物；摘录 vt. 提取；提炼；摘录；（用力）拔出|extra
wormwood|n. 蒿；洋艾|extra
boil|vt. & vi.（使）沸腾；煮开；烧开 n. 沸腾；沸点|core
liquid|n. 液体 adj. 液体的；液态的|core
obtain|vt.（尤指经努力）获得；赢得 vi.（规章、习俗等）存在；流行|core
acknowledge|承认（属实、权威等）； （公开）感谢|core
defeat|n. 失败；挫败 vt. 击败；战胜|core
analyse (NAmE also analyze)|vt. 分析|core
apparently|adv. 显而易见；看来； 显然|core
substance|n. 物质；物品；事实根据|core
insist|vi. & vt. 坚持；坚决要求|core
insist on|坚决要求|core
scientific|adj. 科学（上）的； 关于科学的|core
mostly|adv. 主要地；一般地|core
wear and tear|（正常使用造成的）磨损；损耗|core
conclusion|n. 结论；推论|core
penicillin|n. 青霉素；盘尼西林|extra
flee|vi. & vt.（fled, fled） 迅速离开；逃跑|extra
circumstance|n.［ usually pl.］条件； 环境；状况|core
novelist|n. 小说家|core
novel|n.（长篇）小说|core
flow|n. 流；流动；流畅；供应 vi. 流；流动|core
chart|n. 图表 vt. 记录；制订计划|core
flow chart|流程图|core
found|vt. 创建；建立；把……建立在|core
infer|vt. 推断；推定|core
politician|n. 从政者；政治家；政客|core
numerous|adj. 众多的；许多的|extra
theory|n. 理论；学说|core
relativity|n. 相对论；相对性|extra
formula|n. 公式；方程式；配方|extra
genius|n.（pl. geniuses） 天才；天资； 天赋|core
gentle|adj. 温柔的；文静的|core
patent|n. 专利；专利证书；获得专利 adj. 有专利的；受专利保护的|core
passion|n. 酷爱；激情|core
doctorate|n. 博士学位|extra
extraordinary|adj. 不一般的；非凡的；意想不到的|core
gradually|adv. 逐渐地；逐步地|core
photoelectric|adj. 光电的|extra
come to power|（开始）掌权；上台|core
institution|n. 社会公共机构；制度； 习俗|core
institute|n.（教育、专业等）机构； 机构建筑|core
consequence|n. 结果；后果|core
take up a position|担任；任职|core
moustache (especially US mustache)|n. 上唇的胡子；髭|extra
peculiarity|n. 个性；特点； 怪异的性质|extra
encounter|vt. 偶然碰到；遇到 n. 邂逅；遭遇|core
professor|n. 教授|core
mourn|vt. & vi. 哀悼；忧伤|extra
remarkable|adj. 非凡的；显著的|core
device|n. 方法；技巧；装置；仪器|core
sum|vi. 总结；概括 n. 金额；款项；总数；总和|core
sum up|总结；概括|core
draft|n. 草稿；草案 vt. 起草；草拟|core
Nobel Prize|诺贝尔奖|proper
Alexander Fleming|亚历山大·弗莱明|proper
Albert Einstein|阿尔伯特·爱因斯坦|proper
Hitler|希特勒|proper
Florence Nightingale|弗洛伦斯·南丁格尔|proper
SARS|abbr. 严重急性呼吸综合征|proper
Switzerland|瑞士（国家名）|proper
Swiss|adj. 瑞士的 n.（pl. Swiss）瑞士人|proper
Isaac Newton|艾萨克·牛顿|proper
Jewish|adj. 犹太人的；犹太教的|proper
Princeton|普林斯顿（美国城市）|proper
`,
  u2: `
phrase|n. 短语；词组|core
persuade|vt. 劝说；说服|core
switch|vt. 转换；交换 vi. & vt.（使）改变；转变 n. 开关；转换器；改变|core
switch off/on|关 / 开（电灯、机器等）|core
distant|adj. 遥远的；远处的；疏远的； 心不在焉的|core
secure|adj. 安全的；安心的；可靠的；牢固的 vt. 获得；拴牢；保护|core
knob|n. 旋钮；球形把手|extra
appliance|n. 电器；器具|extra
remote|adj. 远程的；偏远的|core
remote control|遥控器；遥控|core
air conditioner|空调机； 空调设备|core
automatic|adj. 自动的|core
integrated|adj. 各部分密切协调的； 综合的|extra
integrate|vi. & vt.（使）合并； 成为一体|core
sensor|n. 传感器；敏感元件|extra
efficient|adj. 效率高的；有功效的|core
mode|n. 模式；方式；风格|core
routine|n. 常规；正常顺序 adj. 常规的；日常的|core
daily routine|日常生活|core
preference|n. 爱好；偏爱|core
instant|n. 瞬间；片刻 adj. 立即的；速食的；速溶的|core
command|n. 指令；命令；控制 vt. 命令；控制|extra
obey|vi. & vt. 服从；遵守|extra
warning|n. 警告；警示；先兆|core
constant|adj. 不断的；重复的；不变的 n. 常数；常量|core
early on|在初期；早先|core
abnormal|adj. 不正常的；反常的|core
critical|adj. 严重的；关键的；批判性的|core
cancer|n. 癌；癌症；毒瘤|core
potentially|adv. 潜在地；可能地|extra
potential|adj. 可能的；潜在的 n. 潜力；可能性|core
leak|vi. & vt. 漏；渗漏；透露 n. 漏洞；裂缝；透露|core
electrical|adj. 电的；用电的|extra
wiring|n. 电线线路；线路系统|extra
wire|n. 电线；金属丝（或线） vt. 接通电源；将……连接到|core
detect|vt. 发现；查明|core
relevant|adj. 有关的；有意义的|core
catch fire|着火|core
fantasy|n. 幻想；想象|core
innovation|n. 创新；创造|core
available|adj. 可获得的；可购得的； （人）有空的|core
in this sense (in ... sense)|从这种（某种）意义上来讲|core
nevertheless|adv. 尽管如此；不过；然而|core
structure|n. 结构；体系 vt. 系统安排；精心组织|core
security|n. 保护措施；安全工作|core
crime|n. 犯罪活动；不法行为|core
combine|vt. & vi. （使）结合；混合|core
nanobot|n. 纳米机器人|extra
artificial|adj. 人工的；人造的；假的|core
artificial intelligence (AI)|人工智能|core
clone|vt. 克隆；以无性繁殖技术复制 n. 克隆动物（或植物）|core
predict|vt. 预测；预言；预料|core
prediction|n. 预测；预言|extra
forecast|vt. & n. 预测；预报|core
occupation|n. 职业；占领|core
oppose|vt. 反对；抵制；阻挠|core
hence|adv. 因此；由此|core
cease|vi. & vt. （使）停止；终止|core
deceased|adj. 已死的；亡故的|extra
absence|n. 不存在；缺乏；缺席|core
rural|adj. 乡村的；农村的|core
advocate|vt. 提倡；支持；拥护 n. 提倡者；支持者；拥护者|core
emphasis|n. 强调；重视；重要性|core
luxury|n. 奢华|core
keep in touch (with ...)|（与……）保持联系； 了解（某课题或领域的情况）|core
career|n. 职业；事业|core
prospect|n. 可能性；前景|core
resist|vi. & vt. 抵制；反抗；抵挡|extra
resistance|n. 抵制；反对；抗拒|core
paragraph|n. 段；段落|core
signpost|n. 路标|extra
essay|n. 文章|core
accurate|adj. 精确的；准确的|core
librarian|n. 图书管理员；图书馆馆长|core
Melbourne|墨尔本（澳大利亚城市）|proper
Christian|n. 基督教徒 adj. 基督教的|proper
the Amish|n. 阿曼门诺派|proper
`,
  u3: `
buffet|vt. 连续猛击；打来打去 n. 自助餐|core
cloth|n. （一块）布；织物；布料|core
edge|n. 边；边缘；边线；刀刃 vt. & vi. （使）徐徐移动；给……加边|core
valley|n. 谷；山谷；溪谷|core
vast|adj. 辽阔的；巨大的；庞大的|core
glacier|n. 冰川|extra
reindeer|n. 驯鹿|extra
territory|n. 领土；版图；领域；地盘|core
ban|vt. 明令禁止；取缔 n. 禁令|core
boundary|n. 边界；界限；分界线|core
cottage|n. 小屋；（尤指）村舍；小别墅|core
visible|adj. 看得见的；可见的|core
on the move|在行进中；在移动中|core
accompany|vt. 陪同；陪伴；伴随； （尤指用钢琴）为……伴奏|core
adopt|vt. 采用；采取；采纳 vt. & vi. 领养|core
sour|adj. 酸的；有酸味的|core
set out|出发；启程；（怀着目标）开始工作|core
bless|vt. 祝福|core
live off|依靠……生活；以吃……为生|core
prohibition|n. 禁止；阻止；禁令|extra
prohibit|vt.（尤指以法令）禁止；阻止|core
journalist|n. 新闻记者；新闻工作者|core
sneeze|vi. 打喷嚏 n. 喷嚏；喷嚏声|core
teapot|n. 茶壶|core
label|vt. 用标签标明；贴标签 n. 标签；标记|core
cream|n. 奶油；乳脂；护肤霜 adj. 奶油色的；淡黄色的|core
leopard|n. 豹|extra
stretch|vi. 延伸；延续 vi. & vt. 伸展；舒展|core
rewarding|adj. 值得做的；有益的|extra
bush|n. 灌木|extra
lung|n. 肺|core
cycle|n. 自行车；摩托车；循环 vi. 骑自行车|core
corridor|n. 狭长地带；走廊；过道；通道|extra
pedal|n.（自行车等的）脚镫子；踏板 vt. & vi. 骑自行车；踩踏板|extra
fountain|n. 喷泉；人工喷泉；喷水池|core
route|n. 路线；路途；途径|core
ahead|adv. 向前；在前面；提前|core
theme|adj. 有特定主题的 n. 主题；主题思想|core
theme park|主题公园；主题乐园|core
roller coaster|过山车|extra
incredible|adj. 极好的；极大的； 难以置信的|core
appeal|vi. 有吸引力；呼吁；恳求；上诉 n. 吸引力；呼吁；上诉；请求|core
appeal to|有吸引力；有感染力；呼吁；上诉；打动|core
pirate|n. 海盗；盗版者 vt. 盗印；窃用|extra
adorable|adj. 可爱的；讨人喜爱的|core
wander|n. 游荡；闲逛；流浪 vt. & vi. 闲逛；漫游 vi. 走失；离散；走神|core
amusement|n. 娱乐（活动）；愉悦|extra
amuse|vt.（提供）消遣；（使）娱乐|core
enormous|adj. 巨大的；极大的|core
swing|vt. & vi.（swung, swung）（使）摆动； 摇摆；转弯；（使）突然转向|core
iron|n. 铁；铁器；铸铁；熨斗 vt. & vi.（用熨斗）熨；烫平|core
fashion|n. 时尚；时兴；流行款式|core
rare|adj. 稀少的；珍贵的；（肉）半熟的|core
steam|n. 蒸汽；水蒸气；蒸汽动力 vi. 蒸发；散发蒸汽；冒水汽|core
superb|adj. 极佳的；卓越的|core
aquarium|n.（pl. aquariums or aquaria） 水族馆；水族玻璃槽；养鱼缸|extra
up to|达到（某数量、程度等）；直到；不多于； （体力或智力上）能胜任|core
polar|adj.（近）极地的；南极（或北极）的 磁极的|core
upside down|颠倒；倒转；翻转|core
splendid|adj. 壮丽的；雄伟的；极佳的； 非常好的|core
display|n. 展览；陈列；展览品 vt. 显示；陈列|core
appetite|n. 食欲；胃口；强烈欲望|core
entertainment|n. 娱乐；招待； 娱乐活动；文娱节目|core
column|n.（书、报纸印刷页上的）栏； 专栏；柱（形物）|core
Sami|萨米人 （居住在斯堪的纳维亚北部的拉普人）|proper
Sarek National Park|萨勒克国家公园|proper
Sweden|瑞典（国家名）|proper
the Arctic Circle|北极圈|proper
Rapa River|拉帕河|proper
Siberian|adj. 西伯利亚（人）的 n. 西伯利亚人|proper
Dollywood|多莉山主题公园|proper
`,
  u4: `
interaction|n. 交流；相互影响|core
vary|vi. （根据情况）变化；改变|core
appropriate|adj. 合适的；恰当的|core
by contrast|相比之下|core
approve|vi. 赞成； 同意 vt. 批准；通过|core
demonstrate|vt. 表现；表达；说明；证明|core
gesture|n. 手势；姿势；姿态|extra
witness|vt. 当场看到；目击；见证 n. 目击者；证人|core
employ|vt. 使用；应用；雇用|core
identical|adj. 相同的|core
interpret|vt. 把……理解（解释）为 vi. & vt. 口译|core
differ|vi. 相异；不同于|core
by comparison|（与……）相比较|core
cheek|n. 面颊；脸颊|core
favour (NAmE favor)|vt. 较喜欢；选择；有利于 n. 帮助；恩惠；赞同|core
bow|vi. 鞠躬；点头 vt. 低（头） ； n. 弓；蝴蝶结|core
waist|n. 腰；腰部|core
make inferences|推理；推断|core
break down|消除；分解；打破|core
barrier|n. 隔阂；障碍|core
fake|adj. 假装的；假的；冒充的|extra
anger|n. 愤怒；怒气 vt. 使生气；激怒|core
reliable|adj. 可靠的；可信赖的|core
incident|n. 发生的事情；严重事件；冲突|core
trial|n. & v. 审讯；审判；试验；试用|core
slight|adj. 轻微的；略微的；细小的|extra
slightly|adv. 略微；稍微|core
twin|adj. 双胞胎之一的；孪生之一的 n. 孪生之一；双胞胎之一|core
nonverbal|adj. 不涉及言语的； 非言语的|extra
assessment|n. 评价；评定|extra
assess|vt. 评估；评价|core
internal|adj. 内部的；里面的|core
straighten up|直起来；整理；收拾整齐|core
slump|vi. 垂头弯腰地走（或坐等）|extra
pose|n. 故作姿态；（为画像、拍照等摆的） 姿势 vi. 摆好姿势 vt. 造成（威胁、问题等）|core
bend|vt. & vi.（bent, bent）（使）弯曲； 倾斜；偏向|core
reveal|vt. 揭示；显示；露出|core
clarify|vt. 使更清晰易懂；阐明；澄清|core
in other words|换句话说；也就是说|core
educator|n. 教师；教育工作者；教育家|core
tick|vt. 给（试卷、问题等）打钩号 vi. （钟表）发出嘀嗒声 n. 钩号|extra
tendency|n. 趋势；倾向|core
lower|vt. 把……放低；降低；减少 adj. 下面的；下方的；较小的|core
imply|vt. 意味着；暗示|core
barely|adv. 几乎不；勉强才能；刚刚|core
chin|n. 下巴|extra
occupy|vt. 占据；占用|core
stare|vi. 盯着看；凝视 n. 凝视|core
ceiling|n. 天花板；上限|core
distract|vt. 分散（注意力）；使分心|extra
perceive|vt. 察觉；看待；理解|core
distinguish|vi. & vt. 区分；辨别|core
anxiety|n. 焦虑；担心；害怕|core
chest|n. 胸部；胸膛|core
embarrassed|adj. 难堪的；尴尬的|core
ashamed|adj. 羞愧；惭愧|core
merely|adv. 只是；仅仅；只不过|core
call on|（短暂地）访问；要求（某人讲话等）； 正式邀请|core
bother|vi. & vt. 费心；麻烦；因……操心 n. 麻烦；不便|core
weep|vi. & vt.（wept, wept）哭泣；流泪|core
at work|有某种影响；在工作|core
conflict|n. 矛盾；冲突 vi. 冲突；抵触|core
inquire (also enquire)|vi. & vt. 询问；打听|core
ultimately|adv. 最终；最后|core
adjust|vt. 调整；调节 vi. & vt. 适应；（使）习惯|core
intervene|vi. 干预；介入|extra
react|vi.（对……）起反应；回应； （对食物等）有不良反应|core
component|n. 组成部分；零件|core
tone|n. 语气；腔调；口吻|core
Brazil|巴西（国家名）|proper
Bulgaria|保加利亚（国家名）|proper
Albania|阿尔巴尼亚（国家名）|proper
`,
  u5: `
hybrid|n. 杂交植（动）物；合成物； 混合动力车|extra
devote|vt. 把……献（给）；把……专用于； 专心于|core
devote... to|把……用于；献身；致力；专心|core
shortage|n. 不足；缺少；短缺|core
tackle|vt. 解决（难题）；应付（局面）；处理|core
crisis|n.（pl. crises）危机； 危急关头|core
boost|vt. 使增长；使兴旺 n. 增长；提高；激励|core
yield|n. 产量；产出 vt. 出产（作物）；产生（收益、效益等） vi. 屈服；让步|extra
convince|vt. 使相信；使确信；说服|core
characteristic|n. 特征；特点；品质 adj. 典型的；独特的|core
attain|vt. （通常经过努力）获得；得到|core
conventional|adj. 传统的；习惯的|core
pollinate|vt. 授粉；传粉|extra
assumption|n. 假定；设定；（责任的） 承担；（权力的）获得|core
intense|adj. 热切的；十分强烈的；激烈的|core
overcome|vt. （overcame, overcome）克服；解决；战胜|core
expand|vt. & vi. 扩大；增加 vt. 扩展；发展（业务）|core
output|n. 产量；输出；输出量 vt.（output, output）输出|core
estimate|vt. 估计；估价； 估算 n. 估计；估算|core
domestic|adj. 本国的；国内的；家用的 家庭的|core
consumption|n. 消耗；消耗量；消费|core
comprise|vt. 包括；包含；由……组成|core
be comprised of|包括；包含； 由……组成（或构成）|core
generate|vt. 产生；引起|core
strain|n. （动、植物的）系；品种；拉伤； 压力|extra
leisure|n. 闲暇；休闲；空闲|core
deep down|在内心深处；本质上；实际上|core
soil|n. 泥土；土壤；国土；领土|core
celebrity|n. 名望；名誉；名人；名流|core
envision|vt. 展望；想象|extra
sorghum|n. 高粱；高粱米|extra
broom|n. 扫把；扫帚；金雀花|extra
grain|n. 谷物；谷粒；颗粒|core
vision|n. 想象； 视力；视野；影像|core
reality|n. 现实；实际情况；事实|core
salty|adj. 含盐的；咸的|core
urban|adj. 城市的；都市的；城镇的|core
bomb|n. 炸弹 vt. 轰炸；对……投炸弹|core
tunnel|n. 地下通道；地道；隧道|extra
extension|n. 扩建部分；扩大；电话分机|core
chemical|adj. 与化学有关的；化学的 n. 化学制品；化学品|core
wheat|n. 小麦；小麦籽|core
flavour (NAmE flavor)|n. 味道； 特点；特色|core
fertiliser (NAmE also fertilizer)|n. 肥料|extra
nutritional|adj. 营养（物）的|core
nutritious|adj. 有营养的；营养丰富的|extra
nutrition|n. 营养；滋养|core
alleviate|vt. 减轻；缓解|extra
poverty|n. 贫穷；贫困|extra
organic|adj. 有机的；不使用化肥的； 有机物的|core
pesticide|n. 杀虫剂；除害药物|extra
widespread|adj. 分布广的；普遍的； 广泛的|core
bacterium|n.（pl. -ria）细菌|extra
in turn|相应地； 转而；依次；轮流|core
digest|vt. & vi. 消化 vt. 领会；领悟 n. 摘要；文摘|core
essential|adj. 完全必要的；极其重要的|core
mineral|n. 矿物；矿物质|core
alternative|n. 可供选择的事物 adj. 可供替代的；非传统的|core
grocery|n. 食品杂货店； 食品杂货|core
instance|n. 例子；实例；事例|core
for instance|例如；比如|core
batch|n. 一批；一组 vt. 分批处理|extra
depth|n. 向下（或向里）的距离；深（度）|core
root|n. 根；根茎； 根部；根源|core
entirely|adv. 全部地；完整地；完全地|core
aspect|n. 方面；层面|core
Vietnam|越南（国家名）|proper
LED|abbr. (light-emitting diode) 发光二极管|proper
DDT|n. 滴滴涕（旧时尤用作农业杀虫剂）|proper
`
};

const VOCABULARY = Object.entries(RAW_VOCABULARY).flatMap(([unit, raw]) =>
  raw.trim().split("\n").filter(Boolean).map((line, index) => {
    const [word, meaning, type = "core"] = line.split("|");
    return { id: `${unit}-${index + 1}`, unit, word: word.trim(), meaning: meaning.trim(), type: type.trim() };
  })
);

