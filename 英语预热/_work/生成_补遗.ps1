# Build supplementary entries (buyi) from the reference txt list vs base words.
$ErrorActionPreference = 'Stop'
$work = 'E:\workspace\穷观\英语预热\_work'
$rootDir = 'E:\workspace\穷观\英语预热'
$enc = New-Object System.Text.UTF8Encoding($false)

# read base words set (lower)
$baseSet = New-Object 'System.Collections.Generic.HashSet[string]'
for ($s = 1; $s -le 15; $s++) {
  $f = Join-Path $work ('slice_S{0:D2}.jsonl' -f $s)
  foreach ($ln in ([System.IO.File]::ReadAllText($f, $enc) -split "`r?`n")) {
    if ($ln.Trim().Length -gt 0) { $r = $ln | ConvertFrom-Json; [void]$baseSet.Add($r.word.ToLowerInvariant()) }
  }
}

# fetch reference txt
$wc = New-Object System.Net.WebClient; $wc.Encoding = [System.Text.Encoding]::UTF8
$txt = $wc.DownloadString('https://raw.githubusercontent.com/pluto0x0/word3500/master/3500.txt')
$ls = $txt -split "`r?`n"
$n = $ls.Length

# parse entries: head lines (next non-empty line starts with '[')
$heads = New-Object System.Collections.Generic.List[int]
for ($i = 0; $i -lt $n; $i++) {
  $t = $ls[$i].Trim()
  if ($t.Length -gt 0 -and -not $t.StartsWith('[')) {
    $k = $i + 1; while ($k -lt $n -and $ls[$k].Trim().Length -eq 0) { $k++ }
    if ($k -lt $n -and $ls[$k].TrimStart().StartsWith('[')) { $heads.Add($i) }
  }
}

$rename = @{ 'acut' = 'acute'; 'afte' = 'after'; 'Tibeta' = 'Tibetan'; 'spaghettiv' = 'spaghetti'; 'tiresomev' = 'tiresome'; 'taxipayer' = 'taxpayer'; 'roller skatingn' = 'roller skating' }

$inc = New-Object System.Collections.Generic.List[object]
$excl = New-Object System.Collections.Generic.List[string]
$seen = New-Object 'System.Collections.Generic.HashSet[string]'

for ($h = 0; $h -lt $heads.Count; $h++) {
  $idx = $heads[$h]
  $headRaw = $ls[$idx].Trim()
  if ($headRaw -notmatch '^[A-Za-z][A-Za-z .''\-()/=]*$') { $excl.Add('junk|' + $headRaw); continue }
  # canonical single word: part before '(' or '='
  $canon = $headRaw.Split('(')[0].Split('=')[0].Trim()
  $canon = $canon -replace '--+', '-'
  if ($canon -match ' ') { $excl.Add('phrase|' + $canon); continue }          # single words only
  if ($canon -match '^(a|an|the|of|to|in|on)$' -and $headRaw -match ' ') { $excl.Add('phrase2|' + $headRaw); continue }
  if ($rename.ContainsKey($canon)) { $canon = $rename[$canon] }
  $low = $canon.ToLowerInvariant()
  if ($baseSet.Contains($low)) { $excl.Add('dup|' + $canon); continue }
  if ($low.StartsWith('the ') -or $low.StartsWith('a ') -or $low.StartsWith('an ')) { $excl.Add('artphrase|' + $canon); continue }
  if ($seen.Contains($low)) { continue }
  [void]$seen.Add($low)
  # gather ipa + def lines
  $j = $idx + 1; while ($j -lt $n -and $ls[$j].Trim().Length -eq 0) { $j++ }
  $ph = ''
  if ($j -lt $n -and $ls[$j].TrimStart().StartsWith('[')) { $ph = $ls[$j].Trim().TrimStart('[').TrimEnd(']') }
  $j++
  $defParts = New-Object System.Collections.Generic.List[string]
  $k = $j
  $nextHead = if ($h + 1 -lt $heads.Count) { $heads[$h + 1] } else { $n }
  while ($k -lt $nextHead) {
    $t2 = $ls[$k].Trim()
    if ($t2.Length -gt 0 -and -not $t2.StartsWith('[')) { $defParts.Add($t2) }
    $k++
  }
  $def = ($defParts -join ' ').Trim()
  if ($ph) { $ph = $ph -replace ':', 'ː' }
  if ($ph -match '[`|әєη·]' -or $ph -eq '') { $ph = '' }
  $inc.Add([pscustomobject]@{ word = $canon; ph = $ph; headRaw = $headRaw; def = $def })
}
Write-Output ('parsedHeads=' + $heads.Count + ' included=' + $inc.Count + ' excluded=' + $excl.Count)
$inc | Select-Object -First 60 | ForEach-Object { '{0} | /{1}/ | {2}' -f $_.word, $_.ph, ($_.def.Substring(0, [Math]::Min(36, $_.def.Length))) }
