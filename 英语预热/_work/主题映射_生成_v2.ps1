# Stage1 v2 topic mapping: base lexicon + supplement merge; uncovered -> t99 bucket.
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$work = Join-Path $root '_work'
$enc = New-Object System.Text.UTF8Encoding($false)

$words = [System.IO.File]::ReadAllText((Join-Path $root '高考英语3500词根版_全量.json'), $enc) | ConvertFrom-Json
$base = @{}
foreach ($f in @('主题词典_part1.json','主题词典_part2.json')) {
  $j = [System.IO.File]::ReadAllText((Join-Path $work $f), $enc) | ConvertFrom-Json
  foreach ($t in $j.topics) { $base[$t.id] = $t }
}
$aug = [System.IO.File]::ReadAllText((Join-Path $work '主题词典_补充.json'), $enc) | ConvertFrom-Json
foreach ($a in $aug.add) {
  if ($base.ContainsKey($a.id)) {
    $t = $base[$a.id]
    $zh = @(); foreach ($x in $t.zh) { $zh += $x }; foreach ($x in $a.zh) { $zh += $x }
    $en = @(); foreach ($x in $t.en) { $en += $x }; foreach ($x in $a.en) { $en += $x }
    $t.zh = $zh; $t.en = $en
  } else { $base[$a.id] = $a }
}
$lex = @($base.Values)
Write-Output ('topics=' + $lex.Count + ' words=' + $words.Count)

$topicsOut = New-Object System.Collections.ArrayList
$assign = @{}
foreach ($t in $lex) {
  $zh = @($t.zh); $en = @($t.en)
  $hits = New-Object System.Collections.ArrayList
  foreach ($w in $words) {
    $def = [string]$w.def; $wl = ([string]$w.word).ToLowerInvariant()
    $ok = $false
    foreach ($k in $zh) { if ($def.Contains([string]$k)) { $ok = $true; break } }
    if (-not $ok) {
      foreach ($s in $en) {
        $sl = ([string]$s).ToLowerInvariant()
        if ($wl -eq $sl) { $ok = $true; break }
        if ($sl.Length -ge 5 -and ($wl.StartsWith($sl) -or $wl.EndsWith($sl))) { $ok = $true; break }
        if ($sl.Length -ge 4 -and $wl.Contains($sl) -and $wl.Length -ge 8) { $ok = $true; break }
      }
    }
    if ($ok) {
      [void]$hits.Add([pscustomobject]@{ no = [int]$w.no; word = $w.word; pos = $w.pos })
      if (-not $assign.ContainsKey([int]$w.no)) { $assign[[int]$w.no] = New-Object System.Collections.ArrayList }
      [void]$assign[[int]$w.no].Add([string]$t.name)
    }
  }
  [void]$topicsOut.Add([pscustomobject]@{ id = $t.id; name = $t.name; count = $hits.Count; words = @($hits) })
}
$uncovered = @($words | Where-Object { -not $assign.ContainsKey([int]$_.no) })
Write-Output ('uncovered now=' + $uncovered.Count)
# t99 bucket
$t99 = [pscustomobject]@{ id = 't99'; name = '抽象与语法功能词'; count = $uncovered.Count; words = @($uncovered | ForEach-Object { [pscustomobject]@{ no = [int]$_.no; word = $_.word; pos = $_.pos } }) }
[void]$topicsOut.Add($t99)
$total = ($topicsOut | Measure-Object -Property count -Sum).Sum
Write-Output ('total incl t99=' + $total)
$topicsOut | Sort-Object id | ForEach-Object { '{0} {1}: {2}' -f $_.id, $_.name, $_.count }

$jsonPath = Join-Path $root '词汇细分类\主题词汇.json'
$payload = [ordered]@{ meta = [ordered]@{ title = '主题场景词汇分类（含t99兜底）'; source = 'AI整理初版(启发式词典匹配),待人工校对'; base = '全量表 no 1-3640'; date = (Get-Date -Format 'yyyy-MM-dd') }; topics = @($topicsOut | Sort-Object id) }
[System.IO.File]::WriteAllText($jsonPath, ($payload | ConvertTo-Json -Depth 5), $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('主题场景词汇分类（AI整理初版·待人工校对；一词可属多组；词号对应全量表）')
foreach ($t in ($topicsOut | Sort-Object id)) {
  [void]$sb.AppendLine(''); [void]$sb.AppendLine(('== {0} {1}（{2}词） ==' -f $t.id, $t.name, $t.count))
  foreach ($it in ($t.words | Sort-Object { [int]$_.no })) { [void]$sb.AppendLine(('{0:D4} {1}' -f [int]$it.no, $it.word)) }
}
[System.IO.File]::WriteAllText((Join-Path $root '词汇细分类\主题词汇.txt'), $sb.ToString(), $enc)
Write-Output 'topic files written (with t99)'
