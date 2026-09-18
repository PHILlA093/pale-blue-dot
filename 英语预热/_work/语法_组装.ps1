# Assemble grammar points G001-G040.
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$work = Join-Path $root '_work'
$enc = New-Object System.Text.UTF8Encoding($false)
$items = @()
foreach ($f in @('语法_part1.json','语法_part2.json')) {
  $j = [System.IO.File]::ReadAllText((Join-Path $work $f), $enc) | ConvertFrom-Json
  foreach ($it in $j.items) { $items += $it }
}
$ok = $true
for ($i = 0; $i -lt $items.Count; $i++) { $exp = 'G{0:D3}' -f ($i + 1); if ($items[$i].id -ne $exp) { Write-Output ('mismatch ' + $i); $ok = $false } }
if (-not $ok) { exit 1 }
$payload = [ordered]@{ meta = [ordered]@{ title = '高中语法知识 40 点'; source = 'AI整理初版(通用教学规范),待人工校对'; count = $items.Count }; items = @($items) }
[System.IO.File]::WriteAllText((Join-Path $root '语法知识\语法点40.json'), ($payload | ConvertTo-Json -Depth 5), $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('高中语法知识 40 点（AI整理初版·待人工校对）')
foreach ($it in $items) {
  [void]$sb.AppendLine(''); [void]$sb.AppendLine(('【{0}】{1}' -f $it.id, $it.title))
  foreach ($r in @($it.rules)) { [void]$sb.AppendLine(('· ' + $r)) }
  foreach ($e in @($it.ex)) { [void]$sb.AppendLine(('例: ' + $e)) }
  if ($it.note) { [void]$sb.AppendLine(('注: ' + $it.note)) }
}
[System.IO.File]::WriteAllText((Join-Path $root '语法知识\语法点40.txt'), $sb.ToString(), $enc)
Write-Output ('grammar files written: ' + $items.Count)
