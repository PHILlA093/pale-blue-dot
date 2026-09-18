# Generate js\data_eng.js : ENG_DB knowledge cloud from the English-prep knowledge base.
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$dst  = 'E:\workspace\穷观\js\data_eng.js'
$enc = New-Object System.Text.UTF8Encoding($false)
function J($p){ [System.IO.File]::ReadAllText($p,$enc) | ConvertFrom-Json }

$words = J (Join-Path $root '高考英语3500词根版_全量.json')
$no2w = @{}; foreach($w in $words){ $no2w[[int]$w.no] = $w }

$families = J (Join-Path $root '词汇细分类\派生词族.json')
$topicsJ  = J (Join-Path $root '词汇细分类\主题词汇.json')
$sentJ    = J (Join-Path $root '句式句型\核心句型100.json')
$gramJ    = J (Join-Path $root '语法知识\语法点40.json')
$phrJ     = J (Join-Path $root '高频词组\高频词组搭配500.json')

# word -> topic ids
$w2t = @{}
foreach ($t in @($topicsJ.topics)) { foreach ($it in @($t.words)) { $k = [int]$it.no; if (-not $w2t.ContainsKey($k)) { $w2t[$k] = New-Object System.Collections.ArrayList }; [void]$w2t[$k].Add([string]$t.id) } }

$points = New-Object System.Collections.ArrayList
# ---- boards ----
$boards = @(
  [ordered]@{ id='roots';    name='词根词缀'; kind='major'; color='#26a69a' },
  [ordered]@{ id='topics';   name='主题场景'; kind='major'; color='#7e57c2' },
  [ordered]@{ id='sentence'; name='核心句型'; kind='major'; color='#ef5350' },
  [ordered]@{ id='grammar';  name='语法知识'; kind='major'; color='#42a5f5' },
  [ordered]@{ id='phrase';   name='高频词组'; kind='minor'; color='#ffa726' },
  [ordered]@{ id='words';    name='词汇总览·词点层'; kind='minor'; color='#90a4ae' }
)
# ---- words overview node (index node for词表) ----
$wdoc = New-Object System.Text.StringBuilder
[void]$wdoc.AppendLine('**词库总览**')
[void]$wdoc.AppendLine('主表 3555 条 + 补遗 85 条, 编号 1-3640 (见词根版/主题/词族/难度各文件)。')
[void]$wdoc.AppendLine('板块: 词根词缀(203族) · 主题场景(20+t99) · 核心句型(100) · 语法知识(40) · 高频词组(500)。')
[void]$wdoc.AppendLine('说明: 本知识云由「英语预热知识库」自动组装, AI整理初版, 待人工校对。')
[void]$points.Add([ordered]@{ id='words-index'; name='英语词库总览(1-3640)'; board='words'; importance=5; core=5; keywords=@('英语','词库','3500','3640','总览','词汇'); content=$wdoc.ToString(); links=@(); note='入口节点: 查看词表结构与各板块入口。' })

# ---- roots ----
$wr = @{}
$ri = 0
foreach ($f in @($families.families | Sort-Object root)) {
  $ri++
  $rid = 'root-{0:D3}' -f $ri
  foreach ($m in @($f.words)) { if ($m.no) { $wr[[int]$m.no] = $rid } }
  $tag = [string]$f.root; $mean = [string]$f.mean
  $mems = @($f.words | Sort-Object { [int]$_.no })
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine(('**词根: {0}｜{1}**' -f $tag, $mean))
  [void]$sb.AppendLine(('词族成员 {0} 词:' -f $mems.Count))
  $cnt = 0
  foreach ($m in $mems) {
    $w = $no2w[[int]$m.no]
    $cnt++
    if ($cnt -le 80) { [void]$sb.AppendLine(('{0:D4} {1} /{2}/ {3} {4}' -f $m.no, $m.word, $w.ph, $w.pos, $w.def)) }
  }
  if ($cnt -gt 80) { [void]$sb.AppendLine('…(其余词见派生词族文件)') }
  $chains = @($f.chains)
  if ($chains.Count -gt 0) {
    [void]$sb.AppendLine('候选派生链:')
    $cc = 0
    foreach ($c in $chains) { $cc++; if ($cc -le 6) { [void]$sb.AppendLine(('  ' + (($c.chain | ForEach-Object { $_.word }) -join ' → '))) } }
  }
  [void]$sb.AppendLine('注: AI整理初版(派生规则+种子对), 待人工校对。')
  # links: topics sharing >=2 members (cap 4)
  $tl = @{}
  foreach ($m in $mems) { $k = [int]$m.no; if ($w2t.ContainsKey($k)) { foreach ($t in $w2t[$k]) { if ($t -ne 't99') { if (-not $tl.ContainsKey($t)) { $tl[$t] = 0 }; $tl[$t]++ } } } }
  $links = New-Object System.Collections.ArrayList
  foreach ($t in @($tl.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 4)) { if ($t.Value -ge 2) { [void]$links.Add('tpc-' + $t.Key) } }
  $kw = New-Object System.Collections.ArrayList
  foreach ($p in ($tag -split '/')) { if ([string]$p -and $p.Length -ge 2) { [void]$kw.Add([string]$p) } }
  if ($mean) { [void]$kw.Add($mean) }
  foreach ($m in @($mems | Select-Object -First 4)) { [void]$kw.Add([string]$m.word) }
  $imp = 1; if ($mems.Count -ge 24) { $imp = 5 } elseif ($mems.Count -ge 12) { $imp = 4 } elseif ($mems.Count -ge 6) { $imp = 3 } elseif ($mems.Count -ge 3) { $imp = 2 }
  $core = 3; if ($mems.Count -ge 20) { $core = 4 }
  [void]$points.Add([ordered]@{ id=$rid; name=('词根 ' + $tag); board='roots'; importance=$imp; core=$core; keywords=@($kw); content=$sb.ToString(); links=@($links); note='词根词缀节点(AI初版, 待校对)。' })
}
Write-Output ('roots=' + $ri)


# ---- word points (root members) ----
$wc = 0
foreach ($no in (@($wr.Keys) | Sort-Object { [int]$_ })) {
  $wc++
  $w = $no2w[[int]$no]
  $rid = $wr[$no]
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('**单词节点(词根成员)**')
  [void]$sb.AppendLine(('{0:D4} {1} /{2}/ {3}' -f [int]$w.no, $w.word, $w.ph, $w.def))
  [void]$sb.AppendLine(('所属词根: ' + (($points | Where-Object { [string]$_.id -eq $rid } | Select-Object -First 1).name)))
  [void]$sb.AppendLine('注: AI整理初版(词根成员词点层), 待人工校对。')
  [void]$points.Add([ordered]@{ id=('w-' + ('{0:D4}' -f [int]$w.no)); name=[string]$w.word; board='words'; importance=1; core=2; keywords=@([string]$w.word, ('no' + $w.no)); content=$sb.ToString(); links=@($rid); note='词根成员词点(AI初版)。' })
}
Write-Output ('wordpoints=' + $wc)

# ---- topics ----
foreach ($t in @($topicsJ.topics)) {
  $tid = 'tpc-' + $t.id
  $wl = @($t.words | Sort-Object { [int]$_.no })
  $sb = New-Object System.Text.StringBuilder
  $extra = ''
  if ($t.id -eq 't99') { $extra = ' (抽象义动词与语法功能词兜底组)' }
  [void]$sb.AppendLine(('**主题: {0}**（{1}词）{2}' -f $t.name, $t.count, $extra))
  [void]$sb.AppendLine('所属词表:')
  $cnt = 0
  foreach ($it in $wl) { $cnt++; if ($cnt -le 160) { [void]$sb.AppendLine(('{0:D4} {1}' -f [int]$it.no, $it.word)) } }
  if ($cnt -gt 160) { [void]$sb.AppendLine('…(余词见主题词汇文件)') }
  [void]$sb.AppendLine('注: AI整理初版(词典规则匹配), 一词可属多组, 待人工校对。')
  $kw = New-Object System.Collections.ArrayList
  [void]$kw.Add([string]$t.name)
  foreach ($it in @($wl | Select-Object -First 12)) { [void]$kw.Add([string]$it.word) }
  $imp = 3; if ($t.count -ge 150) { $imp = 4 }
  $links = New-Object System.Collections.ArrayList
  if ($t.id -ne 't99') { [void]$links.Add('words-index') }
  [void]$points.Add([ordered]@{ id=$tid; name=(('主题·' + $t.name) -replace '·t99','·抽象功能词'); board='topics'; importance=$imp; core=4; keywords=@($kw); content=$sb.ToString(); links=@($links); note='主题场景节点(AI初版, 待校对)。' })
}
# ---- sentence ----
foreach ($it in @($sentJ.items)) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine(('**句型 {0} {1}**' -f $it.id, $it.title))
  [void]$sb.AppendLine(('公式: ' + $it.formula))
  [void]$sb.AppendLine(('例句: ' + $it.en))
  [void]$sb.AppendLine(('译文: ' + $it.cn))
  if ($it.note) { [void]$sb.AppendLine(('提示: ' + $it.note)) }
  $kw = New-Object System.Collections.ArrayList
  foreach ($tk in (@($it.title) + @(($it.formula -split '[^A-Za-z]+') | Where-Object { $_ -and $_.Length -ge 3 }))) { if (-not ($kw -contains $tk)) { [void]$kw.Add($tk) } }
  $links = New-Object System.Collections.ArrayList
  [void]$points.Add([ordered]@{ id=$it.id; name=('句型·' + $it.title); board='sentence'; importance=4; core=3; keywords=@($kw); content=$sb.ToString(); links=@($links); note='核心句型(AI整理初版, 待校对)。' })
}
# ---- grammar ----
foreach ($it in @($gramJ.items)) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine(('**语法点 {0} {1}**' -f $it.id, $it.title))
  foreach ($r in @($it.rules)) { [void]$sb.AppendLine(('· ' + $r)) }
  foreach ($e in @($it.ex)) { [void]$sb.AppendLine(('例: ' + $e)) }
  $kw = New-Object System.Collections.ArrayList
  [void]$kw.Add([string]$it.title)
  foreach ($r in @($it.rules)) { foreach ($tk in @(($r -split '[^一-龥A-Za-z0-9]+') | Where-Object { $_ -and $_.Length -ge 2 } | Select-Object -First 10)) { if (-not ($kw -contains $tk) -and $kw.Count -lt 14) { [void]$kw.Add($tk) } }; if ($kw.Count -ge 14) { break } }
  $links = New-Object System.Collections.ArrayList
  [void]$points.Add([ordered]@{ id=$it.id; name=('语法·' + $it.title); board='grammar'; importance=5; core=4; keywords=@($kw); content=$sb.ToString(); links=@($links); note='语法知识(AI整理初版, 待校对)。' })
}
# ---- phrases ----
foreach ($it in @($phrJ.items)) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine(('**短语 {0}**' -f $it.p))
  [void]$sb.AppendLine(('释义: ' + $it.d))
  if ($it.ex) { [void]$sb.AppendLine(('例句: ' + $it.ex)) }
  $kw = New-Object System.Collections.ArrayList
  [void]$kw.Add([string]$it.p)
  foreach ($tk in @(($it.p -split '[^A-Za-z]+') | Where-Object { $_ -and $_.Length -ge 3 } | Select-Object -First 6)) { if (-not ($kw -contains $tk)) { [void]$kw.Add($tk) } }
  $links = New-Object System.Collections.ArrayList
  [void]$points.Add([ordered]@{ id=$it.id; name=('词组·' + $it.p); board='phrase'; importance=2; core=2; keywords=@($kw); content=$sb.ToString(); links=@($links); note='高频词组(AI整理初版, 待校对)。' })
}
Write-Output ('total points=' + $points.Count)

# ---- grammar<->sentence manual links ----
$gs = @{
  'G004'=@('S012','S013','S014','S015','S085'); 'G006'=@('S022','S023','S024','S025','S026','S027');
  'G010'=@('S007','S008','S009','S010','S011'); 'G011'=@('S007','S008'); 'G012'=@('S009','S051','S052','S053','S054');
  'G013'=@('S011'); 'G014'=@('S075','S036'); 'G015'=@('S010','S009'); 'G016'=@('S033');
  'G018'=@('S048','S064'); 'G019'=@('S048','S064'); 'G020'=@('S012','S013','S014','S015','S045','S046','S092');
  'G021'=@('S036','S037','S038','S039','S040'); 'G022'=@('S042','S043','S083');
  'G024'=@('S079','S080'); 'G025'=@('S080'); 'G026'=@('S081'); 'G027'=@('S075','S076','S077','S078');
  'G028'=@('S073','S074','S069'); 'G029'=@('S067','S068','S070','S071'); 'G030'=@('S062','S063');
  'G031'=@('S061','S087','S088','S089'); 'G032'=@('S085','S086'); 'G033'=@('S058'); 'G034'=@('S055','S056','S057','S059','S060');
  'G035'=@('S006','S090'); 'G036'=@('S075'); 'G038'=@('S016','S017')
}
$idSet = @{}; foreach ($p in $points) { $idSet[[string]$p.id] = $true }
foreach ($k in $gs.Keys) {
  $src = @($points | Where-Object { [string]$_.id -eq $k } | Select-Object -First 1)
  if ($src.Count -gt 0) { $arr = New-Object System.Collections.ArrayList; foreach ($l in @($src[0].links)) { [void]$arr.Add($l) }; foreach ($t in $gs[$k]) { if ($idSet.ContainsKey($t) -and -not ($arr -contains $t)) { [void]$arr.Add($t) } }; $src[0].links = @($arr) }
}
# ---------------- write ----------------
$db = [ordered]@{ version='1.0'; subject='eng'; subjectName='高中英语'; boards=@($boards); points=@($points) }
$json = $db | ConvertTo-Json -Depth 8
$head = @'
/* ============================================================
 * 弹性网络知识库 · 高中英语种子数据 (AI整理初版, 待人工校对)
 * 生成自: 英语预热知识库(词汇细分类/句式句型/语法知识/高频词组)
 * 结构: boards(6) / points(词根203+主题21+句型100+语法40+词组500+入口1)
 * ============================================================ */
'@
[System.IO.File]::WriteAllText($dst, $head + "window.ENG_DB = " + $json + ";" + "`r`n", $enc)
Write-Output ('data_eng.js written: ' + $points.Count + ' nodes, bytes=' + (Get-Item $dst).Length)
