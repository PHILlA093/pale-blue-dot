# Assemble phrase bank to exactly 500 entries (dedupe, proportional caps, P001..).
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$work = Join-Path $root '_work'
$enc = New-Object System.Text.UTF8Encoding($false)

$secs = @()
foreach ($f in @('词组_partA.json','词组_partB.json','词组_partC.json')) {
  $j = [System.IO.File]::ReadAllText((Join-Path $work $f), $enc) | ConvertFrom-Json
  $list = New-Object System.Collections.ArrayList
  $seen = @{}
  foreach ($it in $j.items) {
    $key = ([string]$it.p).ToLowerInvariant()
    if (-not $seen.ContainsKey($key)) { [void]$list.Add($it); $seen[$key] = $true }
  }
  $secs += , @($list)
}
Write-Output ('counts A/B/C: ' + (($secs[0]).Count) + '/' + (($secs[1]).Count) + '/' + (($secs[2]).Count))
$total = ($secs | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
Write-Output ('total unique=' + $total)
# proportional caps to hit exactly 500
$target = 500
$caps = @(); $alloc = 0
foreach ($s in $secs) { $c = [math]::Floor($target * $s.Count / $total); if ($c -lt 1) { $c = 1 }; $caps += $c; $alloc += $c }
$i = 0
while ($alloc -lt $target) { $caps[$i]++; $alloc++; $i = ($i + 1) % $secs.Count }
$items = @()
for ($s = 0; $s -lt $secs.Count; $s++) {
  $take = [math]::Min($caps[$s], $secs[$s].Count)
  for ($k = 0; $k -lt $take; $k++) { $items += $secs[$s][$k] }
}
Write-Output ('selected=' + $items.Count)
$payload = [ordered]@{ meta = [ordered]@{ title = '高中高频词组短语搭配 500 条'; source = 'AI整理初版(通用教学高频),待人工校对'; count = $items.Count; sections = @('动词短语','介词/副词/连词短语及搭配','其他高频短语习语') }; items = @($items) }
[System.IO.File]::WriteAllText((Join-Path $root '高频词组\高频词组搭配500.json'), ($payload | ConvertTo-Json -Depth 5), $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('高中高频词组短语搭配 500 条（AI整理初版·待人工校对）')
$n = 0
foreach ($it in $items) {
  $n++
  $line = ('P{0:D3} {1}　{2}' -f $n, $it.p, $it.d)
  if ($it.ex) { $line += ('　例: ' + $it.ex) }
  [void]$sb.AppendLine($line)
}
[System.IO.File]::WriteAllText((Join-Path $root '高频词组\高频词组搭配500.txt'), $sb.ToString(), $enc)
Write-Output 'phrase files written'
