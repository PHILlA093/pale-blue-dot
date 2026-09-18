# Stage3 difficulty tiering: 基础(core seeds + short+function)/核心/拓展(proper/long/hyphen/caps).
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$work = Join-Path $root '_work'
$enc = New-Object System.Text.UTF8Encoding($false)

$words = [System.IO.File]::ReadAllText((Join-Path $root '高考英语3500词根版_全量.json'), $enc) | ConvertFrom-Json
$seeds = @()
$j = [System.IO.File]::ReadAllText((Join-Path $work '难度_基础种子.json'), $enc) | ConvertFrom-Json
foreach ($s in @($j.seeds)) { $seeds += ([string]$s).ToLowerInvariant() }
$seedSet = @{}; foreach ($s in $seeds) { $seedSet[$s] = $true }
Write-Output ('seeds=' + $seedSet.Count + ' words=' + $words.Count)

$basic = New-Object System.Collections.ArrayList
$core  = New-Object System.Collections.ArrayList
$adv   = New-Object System.Collections.ArrayList
foreach ($w in $words) {
  $word = [string]$w.word; $lo = $word.ToLowerInvariant()
  $isProper = ($word -cmatch '^[A-Z]' -and $word -notmatch '^[A-Z]{2,}$') -or ($word -cmatch '^[A-Z]{2,}$')
  $hasSym = ($word -match '[-/()]') 
  $long  = ($lo.Length -ge 13)
  if ($isProper -or $hasSym -or $long) { [void]$adv.Add($w) }
  elseif ($seedSet.ContainsKey($lo) -or $lo.Length -le 3) { [void]$basic.Add($w) }
  else { [void]$core.Add($w) }
}
Write-Output ('basic=' + $basic.Count + ' core=' + $core.Count + ' advanced=' + $adv.Count + ' sum=' + ($basic.Count + $core.Count + $adv.Count))
$bmap = @{}; foreach ($w in $basic) { $bmap[[int]$w.no] = '基础' }
foreach ($w in $core)  { $bmap[[int]$w.no] = '核心' }
foreach ($w in $adv)   { $bmap[[int]$w.no] = '拓展' }

$tierOut = New-Object System.Collections.ArrayList
foreach ($tier in @(@('基础',$basic),@('核心',$core),@('拓展',$adv))) {
  $name = $tier[0]; $list = $tier[1]
  $items = @($list | ForEach-Object { [pscustomobject]@{ no = [int]$_.no; word = $_.word; pos = $_.pos } } | Sort-Object no)
  [void]$tierOut.Add([pscustomobject]@{ tier = $name; count = $items.Count; words = @($items) })
}
$jsonPath = Join-Path $root '词汇细分类\难度分级.json'
$payload = [ordered]@{ meta = [ordered]@{ title = '词汇难度分级 基础/核心/拓展'; source = 'AI整理初版(种子+长度/构词规则),待人工校对'; note = '基础=常用短词种子;核心=高中主体;拓展=专名/长词(≥13字符)/含符号词/全大写缩写' }; tiers = @($tierOut) }
[System.IO.File]::WriteAllText($jsonPath, ($payload | ConvertTo-Json -Depth 5), $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('词汇难度分级（AI整理初版·待人工校对）')
foreach ($t in $tierOut) {
  [void]$sb.AppendLine(''); [void]$sb.AppendLine(('== {0}（{1}词） ==' -f $t.tier, $t.count))
  foreach ($it in $t.words) { [void]$sb.AppendLine(('{0:D4} {1} [{2}]' -f $it.no, $it.word, $it.pos)) }
}
[System.IO.File]::WriteAllText((Join-Path $root '词汇细分类\难度分级.txt'), $sb.ToString(), $enc)
Write-Output 'difficulty files written'
