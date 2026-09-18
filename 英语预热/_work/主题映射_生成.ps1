# Stage1 topic mapping: match 3640 vocab entries against 20-topic lexicon (zh def keywords + en stems).
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$work = Join-Path $root '_work'
$enc = New-Object System.Text.UTF8Encoding($false)

$words = [System.IO.File]::ReadAllText((Join-Path $root '高考英语3500词根版_全量.json'), $enc) | ConvertFrom-Json
$lex = @()
foreach ($f in @('主题词典_part1.json','主题词典_part2.json')) {
  $j = [System.IO.File]::ReadAllText((Join-Path $work $f), $enc) | ConvertFrom-Json
  foreach ($t in $j.topics) { $lex += $t }
}
Write-Output ('topics=' + $lex.Count + ' words=' + $words.Count)

# prebuild en sets per topic (lower, >=4 for affix matching; exact always)
$topicsOut = New-Object System.Collections.ArrayList
$assign = @{}   # wordNo -> list of topic names
foreach ($t in $lex) {
  $zh = @($t.zh); $en = @($t.en)
  $hits = New-Object System.Collections.ArrayList
  foreach ($w in $words) {
    $def = [string]$w.def; $wl = ([string]$w.word).ToLowerInvariant()
    $ok = $false
    foreach ($k in $zh) { if ($def.Contains([string]$k)) { $ok = $true; break } }
    if (-not $ok) {
      foreach ($s in $en) {
        $s = [string]$s
        $sl = $s.ToLowerInvariant()
        if ($wl -eq $sl) { $ok = $true; break }
        if ($sl.Length -ge 5 -and ($wl.StartsWith($sl) -or $wl.EndsWith($sl))) { $ok = $true; break }
        if ($sl.Length -ge 4 -and $wl.Contains($sl) -and $wl.Length -ge 8) { $ok = $true; break }
      }
    }
    if ($ok) {
      [void]$hits.Add([pscustomobject]@{ no = [int]$w.no; word = $w.word; pos = $w.pos; def = $def })
      if (-not $assign.ContainsKey([int]$w.no)) { $assign[[int]$w.no] = New-Object System.Collections.ArrayList }
      [void]$assign[[int]$w.no].Add([string]$t.name)
    }
  }
  [void]$topicsOut.Add([pscustomobject]@{ id = $t.id; name = $t.name; count = $hits.Count; words = @($hits) })
}
$uncovered = @($words | Where-Object { -not $assign.ContainsKey([int]$_.no) })
Write-Output ('uncovered=' + $uncovered.Count + ' of ' + $words.Count)
$total = ($topicsOut | Measure-Object -Property count -Sum).Sum
Write-Output ('total assignments=' + $total)
$topicsOut | ForEach-Object { '{0} {1}: {2}词' -f $_.id, $_.name, $_.count } | Select-Object -First 30

# write json
$jsonPath = Join-Path $root '词汇细分类\主题词汇.json'
$payload = [ordered]@{ meta = [ordered]@{ title = '主题场景词汇分类'; source = 'AI整理初版(启发式词典匹配),待人工校对'; base = '高考英语3500词根版_全量(no 1-3640)'; date = (Get-Date -Format 'yyyy-MM-dd') }; topics = @($topicsOut) }
[System.IO.File]::WriteAllText($jsonPath, ($payload | ConvertTo-Json -Depth 5), $enc)
# readable txt
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('主题场景词汇分类（AI整理初版·待人工校对；一词可属多组；词号对应全量表 no）')
foreach ($t in $topicsOut) {
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine(('== {0} {1}（{2}词） ==' -f $t.id, $t.name, $t.count))
  foreach ($it in ($t.words | Sort-Object no)) { [void]$sb.AppendLine(('{0:D4} {1}' -f $it.no, $it.word)) }
}
[System.IO.File]::WriteAllText((Join-Path $root '词汇细分类\主题词汇.txt'), $sb.ToString(), $enc)
# uncovered list
$uPath = Join-Path $root '词汇细分类\_未归类清单.txt'
$usb = New-Object System.Text.StringBuilder
[void]$usb.AppendLine('未归入任何主题的词条（启发式词典未命中；供人工校对补充分类） count=' + $uncovered.Count)
foreach ($w in $uncovered) { [void]$usb.AppendLine(('{0:D4} {1} /{2}/ {3}' -f [int]$w.no, $w.word, $w.ph, $w.def)) }
[System.IO.File]::WriteAllText($uPath, $usb.ToString(), $enc)
Write-Output 'topic files written'
