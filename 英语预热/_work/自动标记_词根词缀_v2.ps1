# Deterministic root/affix tagging v2
$ErrorActionPreference = 'Stop'
$work = 'E:\workspace\穷观\英语预热\_work'
$rootDir = 'E:\workspace\穷观\英语预热'
$enc = New-Object System.Text.UTF8Encoding($false)

function Get-Fams([string]$txt, [string]$key) {
  $res = New-Object System.Collections.Generic.List[string]
  $in = $false
  foreach ($ln in ($txt -split "`r?`n")) {
    if ($ln -match '^## ') { if ($ln -match $key) { $in = $true } else { $in = $false }; continue }
    if (-not $in) { continue }
    if ($ln -match '^\|' -and $ln -match '\|\s*$') {
      if ($ln -match '\| *-+ *\|') { continue }
      $cells = $ln.Trim('|').Split('|') | ForEach-Object { $_.Trim() }
      if ($cells.Count -lt 1) { continue }
      $fam = $cells[0]
      if ($fam -eq '') { continue }
      if ($fam -notmatch '^[-A-Za-z0-9][A-Za-z0-9 /_\-]*$') { continue }
      $res.Add($fam)
    }
  }
  return $res
}

$spec = [System.IO.File]::ReadAllText((Join-Path $rootDir 'spec.md'), $enc)
$rootFams = @(Get-Fams $spec '规范词根表')
$preFams  = @(Get-Fams $spec '规范前缀表')
$sufFams  = @(Get-Fams $spec '规范后缀表')
Write-Output ('fams root=' + $rootFams.Count + ' pre=' + $preFams.Count + ' suf=' + $sufFams.Count)

$preTok = New-Object System.Collections.Generic.List[object]
foreach ($fam in $preFams) { foreach ($t in $fam.Split('/')) { $tok = $t.TrimEnd('-').Trim(); if ($tok -match '^[a-z]+$') { $preTok.Add([pscustomobject]@{ tok = $tok; len = $tok.Length; fam = $fam }) } } }
$sufTok = New-Object System.Collections.Generic.List[object]
foreach ($fam in $sufFams) { foreach ($t in $fam.Split('/')) { $tok = $t.TrimStart('-').Trim(); if ($tok -match '^[a-z]+$') { $sufTok.Add([pscustomobject]@{ tok = $tok; len = $tok.Length; fam = $fam }) } } }
$rootTok = New-Object System.Collections.Generic.List[object]
foreach ($fam in $rootFams) { foreach ($t in $fam.Split('/')) { $tok = $t.Trim(); if ($tok -match '^[a-z]+$' -and $tok.Length -ge 3) { $rootTok.Add([pscustomobject]@{ tok = $tok; len = $tok.Length; fam = $fam }) } } }

$rows = @()
for ($s = 1; $s -le 15; $s++) {
  $f = Join-Path $work ('slice_S{0:D2}_baseline.jsonl' -f $s)
  foreach ($ln in ([System.IO.File]::ReadAllText($f, $enc) -split "`r?`n")) { if ($ln.Trim().Length -gt 0) { $rows += ($ln | ConvertFrom-Json) } }
}
$rows = $rows | Sort-Object { [int]$_.no }
$heads = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($r in $rows) { [void]$heads.Add($r.word.ToLowerInvariant()) }

function Root-Hit([string]$stem) {
  foreach ($rt in $rootTok) {
    if ($stem.StartsWith($rt.tok)) { return $rt.fam }
    if ($rt.tok.StartsWith($stem) -and $stem.Length -ge 3) { return $rt.fam }
    if ($rt.len -ge 5 -and $stem.Contains($rt.tok)) { return $rt.fam }
  }
  return $null
}
function Stem-Ok([string]$stem) {
  if ($stem.Length -lt 3) { return $false }
  if ($heads.Contains($stem)) { return $true }
  if ($null -ne (Root-Hit $stem)) { return $true }
  return $false
}

$bounds = @(@(0,300),@(301,528),@(529,700),@(701,872),@(873,1197),@(1198,1475),@(1476,1750),@(1751,1997),@(1998,2319),@(2320,2624),@(2625,2840),@(2841,3061),@(3062,3277),@(3278,3460),@(3461,3554))
$statTagged = 0; $statPlain = 0

for ($s = 0; $s -lt $bounds.Count; $s++) {
  $a = $bounds[$s][0]; $b = $bounds[$s][1]
  $sb = New-Object System.Text.StringBuilder
  for ($i = $a; $i -le $b; $i++) {
    $r = $rows[$i]
    $w = $r.word.Trim()
    $wl = $w.ToLowerInvariant()
    $pre = @(); $root = @(); $suf = @()
    if ($wl -match '^[a-z][a-z .''\-]*$' -and $wl.Length -ge 3) {
      $workStr = $wl
      # suffix first (longest token)
      foreach ($st in ($sufTok | Sort-Object { -$_.len })) {
        if ($workStr.Length -gt $st.len -and $workStr.EndsWith($st.tok)) {
          $rem = $workStr.Substring(0, $workStr.Length - $st.len)
          $ok = $false
          if ($heads.Contains($rem)) { $ok = $true }
          elseif ($null -ne (Root-Hit $rem)) { $ok = $true }
          elseif ($heads.Contains($rem + 'e')) { $ok = $true; $rem = $rem + 'e' }
          elseif ($heads.Contains($rem + 'y')) { $ok = $true; $rem = $rem + 'y' }
          if ($ok) { $suf = @($st.fam); $workStr = $rem; break }
        }
      }
      # prefix next (longest token)
      foreach ($pt in ($preTok | Sort-Object { -$_.len })) {
        if ($workStr.Length -gt $pt.len -and $workStr.StartsWith($pt.tok)) {
          $rem = $workStr.Substring($pt.len)
          if ($rem.Length -ge 3 -and ($heads.Contains($rem) -or $null -ne (Root-Hit $rem))) {
            $pre = @($pt.fam); $workStr = $rem; break
          }
        }
      }
      # root from remaining stem
      $hf = Root-Hit $workStr
      if ($null -ne $hf) { $root = @($hf) }
    }
    $plain = ($pre.Count -eq 0 -and $root.Count -eq 0 -and $suf.Count -eq 0)
    if (-not $plain) { $statTagged++ } else { $statPlain++ }
    $rec = [ordered]@{ no = [int]$r.no; word = $r.word; ph = $r.ph; pos = $r.pos; def = $r.def;
      tags = ([ordered]@{ pre = @($pre); root = @($root); suf = @($suf) }); plain = $plain; note = $r.note }
    [void]$sb.AppendLine(($rec | ConvertTo-Json -Compress))
  }
  $fn = Join-Path $work ('slice_S{0:D2}.jsonl' -f ($s + 1))
  [System.IO.File]::WriteAllText($fn, $sb.ToString(), $enc)
}
Write-Output ('v2 done tagged=' + $statTagged + ' plain=' + $statPlain)
