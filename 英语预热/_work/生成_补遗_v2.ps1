# Supplementary entries builder v2: raw txt candidates + curated core words + overrides.
$ErrorActionPreference = 'Stop'
$work = 'E:\workspace\穷观\英语预热\_work'
$rootDir = 'E:\workspace\穷观\英语预热'
$enc = New-Object System.Text.UTF8Encoding($false)

$baseSet = New-Object 'System.Collections.Generic.HashSet[string]'
$baseRows = @{}
for ($s = 1; $s -le 15; $s++) {
  $f = Join-Path $work ('slice_S{0:D2}.jsonl' -f $s)
  foreach ($ln in ([System.IO.File]::ReadAllText($f, $enc) -split "`r?`n")) {
    if ($ln.Trim().Length -gt 0) { $r = $ln | ConvertFrom-Json; [void]$baseSet.Add($r.word.ToLowerInvariant()); $baseRows[$r.word.ToLowerInvariant()] = $r }
  }
}

$wc = New-Object System.Net.WebClient; $wc.Encoding = [System.Text.Encoding]::UTF8
$txt = $wc.DownloadString('https://raw.githubusercontent.com/pluto0x0/word3500/master/3500.txt')
$ls = $txt -split "`r?`n"; $n = $ls.Length
$heads = New-Object System.Collections.Generic.List[int]
for ($i = 0; $i -lt $n; $i++) {
  $t = $ls[$i].Trim()
  if ($t.Length -gt 0 -and -not $t.StartsWith('[')) {
    $k = $i + 1; while ($k -lt $n -and $ls[$k].Trim().Length -eq 0) { $k++ }
    if ($k -lt $n -and $ls[$k].TrimStart().StartsWith('[')) { $heads.Add($i) }
  }
}
$rename = @{ 'acut'='acute'; 'cassettle'='cassette'; 'shyv'='shy'; 'commericia'='commercial'; 'ad.'='' }
$dropJunk = @('ad.')
$recs = @{}
function Add-Rec([string]$word,[string]$ph,[string]$pos,[string]$def,[string]$src){ $k=$word.ToLowerInvariant(); if($k -eq ''){return}; if($baseSet.Contains($k)){return}; if($recs.ContainsKey($k)){return}; $recs[$k]=[pscustomobject]@{ word=$word; ph=$ph; pos=$pos; def=$def; src=$src } }
for ($h = 0; $h -lt $heads.Count; $h++) {
  $headRaw = $ls[$heads[$h]].Trim()
  if ($headRaw -notmatch '^[A-Za-z][A-Za-z .''\-()/=]*$') { continue }
  $canon = $headRaw.Split('(')[0].Split('=')[0].Trim() -replace '--+','-'
  if ($canon -match ' ') { continue }
  if ($rename.ContainsKey($canon)) { $canon = $rename[$canon] }
  if ($canon -eq '' -or $dropJunk -contains $canon) { continue }
  $j = $heads[$h] + 1; while ($j -lt $n -and $ls[$j].Trim().Length -eq 0) { $j++ }
  $ph = ''; if ($j -lt $n -and $ls[$j].TrimStart().StartsWith('[')) { $ph = $ls[$j].Trim().TrimStart('[').TrimEnd(']') -replace ':','ː' }
  $k2 = $j + 1; $nextHead = if ($h + 1 -lt $heads.Count) { $heads[$h + 1] } else { $n }
  $dp = New-Object System.Collections.Generic.List[string]
  while ($k2 -lt $nextHead) { $t2 = $ls[$k2].Trim(); if ($t2.Length -gt 0 -and -not $t2.StartsWith('[')) { $dp.Add($t2) }; $k2++ }
  $def = ($dp -join ' ') -replace '\s+',' '
  Add-Rec $canon $ph '' $def 'txt'
}
# manual overrides for noisy txt rows (word|ph|pos|def)
$ov = @{
  'acute'    = @('acute','ˈækjuːt','adj.','十分严重的；（病）急性的')
  'cassette' = @('cassette','kəˈset','n.','磁带')
  'shy'      = @('shy','ʃaɪ','adj.','害羞的')
  'commercial'= @('commercial','kəˈmɜːʃ(ə)l','adj.','商业的，贸易的')
  'exam'     = @('exam','ɪɡˈzæm','n.','考试，测试')
  'fridge'   = @('fridge','frɪdʒ','n.','冰箱')
  'e-mail'   = @('e-mail','ˈiːmeɪl','n.','电子邮件')
  'taxpayer' = @('taxpayer','ˈtækspeɪə(r)','n.','纳税人')
  'tiresome' = @('tiresome','ˈtaɪəsəm','adj.','令人厌倦的')
  'spaghetti'= @('spaghetti','spəˈɡeti','n.','意大利面条')
  'VCD'      = @('VCD','ˌviːsiːˈdiː','n.','影碟光盘')
  'ballpoint'= @('ballpoint','ˈbɔːlpɔɪnt','n.','圆珠笔')
  'pop'      = @('pop','pɒp','n. adj.','流行音乐；流行的（popular 的缩写）')
  'shall'    = @('shall','ʃæl, ʃ(ə)l','modal v.','（表示将来）将要，会；……好吗')
  'phone'    = @('phone','fəʊn','n. v.','电话，电话机；打电话')
  'Olympic'  = @('Olympic','əˈlɪmpɪk','adj.','奥林匹克的')
  'phenomenon'= @('phenomenon','fəˈnɒmɪnən','n.','现象')
  'mathematics'= @('mathematics','ˌmæθəˈmætɪks','n.','数学')
  'disk'     = @('disk','dɪsk','n.','磁盘；唱片（=disc）')
  'criterion'= @('criterion','kraɪˈtɪəriən','n.','标准，准则（复 criteria）')
  'gym'      = @('gym','dʒɪm','n.','体操；体育馆；健身房')
  'dad'      = @('dad','dæd','n.','（口）爸爸')
  'ad'       = @('ad','æd','n.','广告（advertisement 的缩写）')
}
foreach($k in $ov.Keys){ $v=$ov[$k]; Add-Rec $v[0] $v[1] $v[2] $v[3] 'manual' }
# curated core words missing from base (validated earlier)
$core = @(
  @('a (an)','ə; eɪ, æn','art.','一（个，件……）'),
  @('make','meɪk','vt.','制作，制造；使得；做'),
  @('buy','baɪ','vt.','买'),
  @('catch','kætʃ','vt.','接住；抓住；赶上；染上（疾病）'),
  @('choose','tʃuːz','vt.','选择'),
  @('cost','kɒst','v. n.','值（多少钱）；花费 n. 费用；代价'),
  @('dream','driːm','n. v.','梦，梦想；做梦'),
  @('leave','liːv','v.','离开；把……留下；遗忘'),
  @('sell','sel','v.','卖，售'),
  @('send','send','vt.','送，寄；派遣'),
  @('shake','ʃeɪk','v.','摇动，震动；握手'),
  @('spend','spend','v.','花费（钱、时间）；度过'),
  @('steal','stiːl','vt.','偷，窃取'),
  @('swear','sweə(r)','v.','发誓；咒骂'),
  @('sweep','swiːp','v.','扫除，清扫'),
  @('throw','θrəʊ','v.','投，掷，扔'),
  @('arise','əˈraɪz','vi.','出现，发生；起身（arose, arisen）'),
  @('awake','əˈweɪk','v. adj.','唤醒；醒着的（awoke, awoken）'),
  @('wake','weɪk','v.','醒，醒来；唤醒（woke, woken）'),
  @('bite','baɪt','v.','咬；叮（bit, bitten）'),
  @('hide','haɪd','v.','躲藏；隐瞒（hid, hidden）'),
  @('afterward(s)','ˈɑːftəwəd(z)','adv.','后来，以后'),
  @('ambassador','æmˈbæsədə(r)','n.','大使，使节')
)
foreach($c in $core){ Add-Rec $c[0] $c[1] $c[2] $c[3] 'curated' }
Write-Output ('buyi count=' + $recs.Count)
$list = $recs.Values
$jsonPath = Join-Path $rootDir '补遗_词条.json'
$txtPath = Join-Path $rootDir '补遗_词条.txt'
$arr = @(); $no = 3556; $sb = New-Object System.Text.StringBuilder
foreach ($r in ($list | Sort-Object { $_.word.ToLowerInvariant() })) {
  $rec = [ordered]@{ no = $no; word = $r.word; ph = $r.ph; pos = $r.pos; def = $r.def; tags = ([ordered]@{ pre = @(); root = @(); suf = @() }); plain = $true; note = '补遗(' + $r.src + '源)' }
  $arr += $rec
  [void]$sb.AppendLine(('{0:D4} {1} /{2}/ {3} {4}　【补遗】' -f $no,$r.word,$r.ph,$r.pos,$r.def))
  $no++
}
[System.IO.File]::WriteAllText($jsonPath, ($arr | ConvertTo-Json -Depth 4), $enc)
[System.IO.File]::WriteAllText($txtPath, $sb.ToString(), $enc)
Write-Output ('written no=3556..' + ($no-1) + ' total=' + $arr.Count)
