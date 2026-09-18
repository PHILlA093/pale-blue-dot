# Apply polish overrides (proper caps, pos fill/fix, def fixes) onto slice jsonl files.
$ErrorActionPreference = 'Stop'
$work = 'E:\workspace\穷观\英语预热\_work'
$enc = New-Object System.Text.UTF8Encoding($false)
$ov = ([System.IO.File]::ReadAllText((Join-Path $work '覆盖_专名与语义.json'), $enc)) | ConvertFrom-Json
$cap = $ov.capital; $capM = $ov.capitalIfMonth; $capW = $ov.capitalIfWeek
$pf = $ov.posfill; $px = $ov.posfix; $df = $ov.deffix; $dr = $ov.defrepl
$cntCap = 0; $cntPos = 0; $cntDef = 0
for ($s = 1; $s -le 15; $s++) {
  $f = Join-Path $work ('slice_S{0:D2}.jsonl' -f $s)
  $lines = [System.IO.File]::ReadAllLines($f, $enc)
  $out = New-Object System.Text.StringBuilder
  foreach ($ln in $lines) {
    if ($ln.Trim().Length -eq 0) { continue }
    $r = $ln | ConvertFrom-Json
    $wl = $r.word.ToLowerInvariant()
    $note = if ($r.note) { [string]$r.note } else { '' }
    $changed = $false
    if ($cap.PSObject.Properties.Name -contains $wl) { if ($r.word -cne [string]$cap.$wl) { $r.word = [string]$cap.$wl; $changed = $true }; }
    elseif ($capM.PSObject.Properties.Name -contains $wl -and $r.def -match '月') { if ($r.word -cne [string]$capM.$wl) { $r.word = [string]$capM.$wl; $changed = $true } }
    elseif ($capW.PSObject.Properties.Name -contains $wl -and $r.def -match '星期') { if ($r.word -cne [string]$capW.$wl) { $r.word = [string]$capW.$wl; $changed = $true } }
    if ($changed) { $note = $note.TrimEnd(';') + ';专名大写'; $cntCap++ }
    if ([string]::IsNullOrWhiteSpace([string]$r.pos)) {
      if ($pf.PSObject.Properties.Name -contains $wl) { $r.pos = [string]$pf.$wl; $note = $note.TrimEnd(';') + ';词性补全'; $cntPos++ }
    } elseif ($px.PSObject.Properties.Name -contains $wl) {
      $r.pos = [string]$px.$wl; $note = $note.TrimEnd(';') + ';词性纠错'; $cntPos++
    }
    if ($df.PSObject.Properties.Name -contains $wl) { $r.def = [string]$df.$wl; $note = $note.TrimEnd(';') + ';释义纠错'; $cntDef++ }
    if ($dr.PSObject.Properties.Name -contains $wl) {
      $pair = $dr.$wl; if ($pair.Count -ge 2 -and $r.def.Contains([string]$pair[0])) { $r.def = $r.def.Replace([string]$pair[0], [string]$pair[1]); $note = $note.TrimEnd(';') + ';释义修订'; $cntDef++ }
    }
    $r.note = $note.TrimEnd(';')
    $rec = [ordered]@{ no = [int]$r.no; word = $r.word; ph = $r.ph; pos = $r.pos; def = $r.def;
      tags = ([ordered]@{ pre = @($r.tags.pre); root = @($r.tags.root); suf = @($r.tags.suf) }); plain = [bool]$r.plain; note = $r.note }
    [void]$out.AppendLine(($rec | ConvertTo-Json -Compress))
  }
  [System.IO.File]::WriteAllText($f, $out.ToString(), $enc)
}
Write-Output ('polish done cap=' + $cntCap + ' pos=' + $cntPos + ' def=' + $cntDef)
