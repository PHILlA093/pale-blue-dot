# 机械化清洗基线: word/ph/pos/def 确定性校订 + known_fixes 覆盖。不含词根标记(留给代理/后续)。
$ErrorActionPreference = 'Stop'
$work = 'E:\workspace\穷观\英语预热\_work'
$enc = New-Object System.Text.UTF8Encoding($false)
$o = ([System.IO.File]::ReadAllText((Join-Path $work 'base_words_final.json'), $enc)) | ConvertFrom-Json
if($o.Count -ne 3555){ throw 'base count mismatch' }
$fixes = ([System.IO.File]::ReadAllText((Join-Path $work 'known_fixes.json'), $enc)) | ConvertFrom-Json

$posSet = @('n','v','vt','vi','adj','adv','prep','conj','pron','num','art','int','aux','modal')
function Clean-Pos([string]$p){
  if([string]::IsNullOrWhiteSpace($p)){ return '' }
  $toks = @()
  foreach($t in ($p -split '[^A-Za-z]+' | Where-Object { $_ -ne '' })){
    if($posSet -contains $t){ $toks += $t } else {
      switch -Regex ($t){
        '^n' { $toks += 'n' } '^vt' { $toks += 'vt' } '^vi' { $toks += 'vi' }
        '^v' { $toks += 'v' } '^adj' { $toks += 'adj' } '^adv' { $toks += 'adv' }
        '^prep' { $toks += 'prep' } '^conj' { $toks += 'conj' } '^pron' { $toks += 'pron' }
        '^num' { $toks += 'num' } '^art' { $toks += 'art' } '^int' { $toks += 'int' }
        '^aux' { $toks += 'aux' } '^modal' { $toks += 'modal' } '^ad\.?' { $toks += 'adv' } '^a\.?' { $toks += 'adj' }
        default { }
      }
    }
  }
  $toks = $toks | Select-Object -Unique
  return ($toks | ForEach-Object { $_ + '.' }) -join ' '
}
$bounds = @(@(0,300),@(301,528),@(529,700),@(701,872),@(873,1197),@(1198,1475),@(1476,1750),@(1751,1997),@(1998,2319),@(2320,2624),@(2625,2840),@(2841,3061),@(3062,3277),@(3278,3460),@(3461,3554))
$notes = New-Object System.Text.StringBuilder
$anom = New-Object System.Collections.Generic.List[string]
for($s=0;$s -lt $bounds.Count;$s++){
  $a=$bounds[$s][0]; $b=$bounds[$s][1]; $sb=New-Object System.Text.StringBuilder
  for($i=$a;$i -le $b;$i++){
    $it=$o[$i]; $word=$it.word; $ph=$it.ph; $def=$it.def; $note=''
    # known fixes
    $kf = $fixes.PSObject.Properties | Where-Object { $_.Name -eq $word }
    if($kf){ $f=$kf.Value; if($f.word){ if($word -ne [string]$f.word){ $note += ('word纠错:' + $word + '→' + $f.word + ';') }; $word=[string]$f.word }
      if($f.ph -and $ph -ne [string]$f.ph){ $note += ('ph纠错→' + $f.ph + ';'); $ph=[string]$f.ph } }
    # generic ph
    $ph2 = $ph -replace ':', 'ː'
    if($ph2 -match '[`|әєη·]'){ $ph2 = $ph2 -replace '[`әєη·]',''; $note += 'ph含异常字符待人工;' }
    if($ph2 -ne $ph){ $ph=$ph2 }
    # pos
    $pos = Clean-Pos $it.pos
    # def trim
    $d = $def.Trim()
    $d = $d -replace '^[。；\s]+',''
    $d = $d -replace '^(n\.|v\.|vt\.|vi\.|a\.|ad\.|adj\.|adv\.|prep\.|conj\.|pron\.|num\.|art\.|int\.|aux\.|modal v\.|t\.)\s*',''
    $d = $d -replace '\s*[）)]$',''
    if($i -lt $o.Count-1){ $nx = [string]$o[$i+1].word; if($d -match ('；' + [regex]::Escape($nx) + '$')){ $d = $d.Substring(0,$d.Length - ($Matches[0].Length)) } }
    $d = $d.TrimEnd()
    if($def -ne $d){ $note += 'def清理;' }
    if($ph -match '[`|әєη·]|^\.' -or $ph -eq '' -or $ph -eq '[]'){ [void]$anom.Add(('{0}|{1}|ph=[{2}]' -f ($i+1),$word,$ph)) }
    if($note.Length -gt 0){ [void]$notes.AppendLine(('{0}|{1}|{2}' -f ($i+1),$word,$note.TrimEnd(';'))) }
    $rec = [ordered]@{ no=($i+1); word=$word; ph=$ph; pos=$pos; def=$d; tags=([ordered]@{pre=@();root=@();suf=@()}); plain=$false; note=$note.TrimEnd(';') }
    [void]$sb.AppendLine(($rec | ConvertTo-Json -Compress))
  }
  $fn = Join-Path $work ('slice_S{0:D2}_baseline.jsonl' -f ($s+1))
  [System.IO.File]::WriteAllText($fn, $sb.ToString(), $enc)
}
[System.IO.File]::WriteAllText((Join-Path $work '基线_note清单.txt'), $notes.ToString(), $enc)
[System.IO.File]::WriteAllText((Join-Path $work '基线_ph异常.txt'), ($anom -join "`r`n"), $enc)
Write-Output ('baseline slices written; notes=' + ($notes.ToString() -split "`n").Count + ' phAnomaly=' + $anom.Count)
