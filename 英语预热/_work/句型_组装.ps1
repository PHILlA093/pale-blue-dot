# Assemble sentence patterns S001-S100 into deliverable json/txt with validation.
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$work = Join-Path $root '_work'
$enc = New-Object System.Text.UTF8Encoding($false)
$items = @()
foreach ($f in @('句型_part1.json','句型_part2.json')) {
  $j = [System.IO.File]::ReadAllText((Join-Path $work $f), $enc) | ConvertFrom-Json
  foreach ($it in $j.items) { $items += $it }
}
Write-Output ('patterns=' + $items.Count)
$ok = $true
for ($i = 0; $i -lt $items.Count; $i++) { $exp = 'S{0:D3}' -f ($i + 1); if ($items[$i].id -ne $exp) { Write-Output ('id mismatch at ' + $i + ': ' + $items[$i].id); $ok = $false } }
if (-not $ok) { exit 1 }
$payload = [ordered]@{ meta = [ordered]@{ title = '高中核心句型 100 条'; source = 'AI整理初版(通用教学规范),待人工校对'; count = $items.Count }; items = @($items) }
[System.IO.File]::WriteAllText((Join-Path $root '句式句型\核心句型100.json'), ($payload | ConvertTo-Json -Depth 5), $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('高中核心句型 100 条（AI整理初版·待人工校对）')
foreach ($it in $items) {
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine(('【{0}】{1}' -f $it.id, $it.title))
  [void]$sb.AppendLine(('公式: {0}' -f $it.formula))
  [void]$sb.AppendLine(('例  : {0}' -f $it.en))
  [void]$sb.AppendLine(('译  : {0}' -f $it.cn))
  if ($it.note) { [void]$sb.AppendLine(('提示: {0}' -f $it.note)) }
}
[System.IO.File]::WriteAllText((Join-Path $root '句式句型\核心句型100.txt'), $sb.ToString(), $enc)
Write-Output 'sentence files written'
