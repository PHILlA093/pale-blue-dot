# 高考英语3500词·词根版 —— 合并生成脚本 v2（可重复执行）
# 输入: _work\slice_S01..S15.jsonl + spec.md(词根含义表) ；输出主表 json/txt、索引、校订清单。
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$work = Join-Path $root '_work'
$enc = New-Object System.Text.UTF8Encoding($false)
function Read-Utf8([string]$p){ [System.IO.File]::ReadAllText($p, $enc) }
function Write-Utf8([string]$p,[string]$c){ [System.IO.File]::WriteAllText($p,$c,$enc) }

# ---------- 1. 读 15 片 JSONL ----------
$all = @()
$missing = @()
for($s=1;$s -le 15;$s++){
  $f = Join-Path $work ('slice_S{0:D2}.jsonl' -f $s)
  if(-not (Test-Path $f)){ $missing += $f; continue }
  foreach($ln in ((Read-Utf8 $f) -split "`r?`n")){ if($ln.Trim().Length -gt 0){ $all += ($ln | ConvertFrom-Json) } }
}
if($missing.Count -gt 0){ Write-Output ('MISSING SLICES: ' + ($missing -join '; ')); exit 1 }
$all = @($all | Sort-Object { [int]$_.no })
if($all.Count -ne 3555){ Write-Output ('SLICE COUNT != 3555: ' + $all.Count); exit 1 }
$dup = @($all | Group-Object no | Where-Object Count -gt 1)
if($dup){ Write-Output ('DUP no: ' + (($dup | ForEach-Object name) -join ',')); exit 1 }
for($n=1;$n -le $all.Count;$n++){ if(-not ($all.no -contains $n)){ Write-Output ('GAP no: ' + $n); exit 1 } }
Write-Output ('merged=' + $all.Count)

# ---------- 2. spec.md family->含义 ----------
$spec = Read-Utf8 (Join-Path $root 'spec.md')
$rootMean = @{}; $preMean = @{}; $sufMean = @{}
$sec = ''
foreach($ln in ($spec -split "`r?`n")){
  if($ln -match '^##\s*\d+\.\s*规范(词根表|前缀表|后缀表)'){ $sec = $Matches[1]; continue }
  if($ln -match '^## '){ if($sec -ne ''){ $sec = '' }; continue }
  if($sec -ne '' -and $ln -match '^\|.*\|\s*$' -and $ln -notmatch '\| *-+ *\|' -and $ln -notmatch '备注'){
    $cells = ($ln.Trim('|') -split '\|' | ForEach-Object { $_.Trim() })
    if($cells.Count -ge 2 -and $cells[0] -ne '' -and $cells[0] -notmatch '照抄用'){
      switch($sec){ '词根表' { $rootMean[$cells[0]] = $cells[1] } '前缀表' { $preMean[$cells[0]] = $cells[1] } '后缀表' { $sufMean[$cells[0]] = $cells[1] } }
    }
  }
}
Write-Output ('rootMean=' + $rootMean.Count + ' preMean=' + $preMean.Count + ' sufMean=' + $sufMean.Count)

# ---------- 3. 主 JSON（规范嵌套 tags schema） ----------
$arr = @()
foreach($r in $all){
  $arr += [ordered]@{ no=[int]$r.no; word=$r.word; ph=$r.ph; pos=$r.pos; def=$r.def;
    tags=[ordered]@{ pre=@($r.tags.pre); root=@($r.tags.root); suf=@($r.tags.suf) };
    plain=[bool]$r.plain; note=$r.note }
}
Write-Utf8 (Join-Path $root '高考英语3500词根版.json') ($arr | ConvertTo-Json -Depth 6)
Write-Output ('json written: ' + $arr.Count + ' records')

# ---------- 4. 主 TXT ----------
$sb = New-Object System.Text.StringBuilder
foreach($r in $arr){
  $tags=@()
  if($r.tags.pre.Count){ $tags += ('前缀:' + ($r.tags.pre -join ',')) }
  if($r.tags.root.Count){ $tags += ('词根:' + ($r.tags.root -join ',')) }
  if($r.tags.suf.Count){ $tags += ('后缀:' + ($r.tags.suf -join ',')) }
  $mark=''
  if($r.plain){ $mark='　【基础词】' }
  elseif($tags.Count){ $mark = ('　【' + ($tags -join '；') + '】') }
  [void]$sb.AppendLine(('{0:D4} {1} /{2}/ {3} {4}{5}' -f [int]$r.no,$r.word,$r.ph,$r.pos,$r.def,$mark))
}
Write-Utf8 (Join-Path $root '高考英语3500词根版.txt') $sb.ToString()
Write-Output 'txt written'

# ---------- 5. 检索索引 ----------
$idx = @{}
foreach($r in $arr){
  foreach($t in $r.tags.root){ $k="root|$t"; if(-not $idx.ContainsKey($k)){ $idx[$k]=[ordered]@{type='词根';tag=$t;mean='';words=@()} }; if(-not $idx[$k].mean){ $idx[$k].mean = $rootMean[$t] }; $idx[$k].words += $r.word }
  foreach($t in $r.tags.pre){ $k="pre|$t"; if(-not $idx.ContainsKey($k)){ $idx[$k]=[ordered]@{type='前缀';tag=$t;mean='';words=@()} }; if(-not $idx[$k].mean){ $idx[$k].mean = $preMean[$t] }; $idx[$k].words += $r.word }
  foreach($t in $r.tags.suf){ $k="suf|$t"; if(-not $idx.ContainsKey($k)){ $idx[$k]=[ordered]@{type='后缀';tag=$t;mean='';words=@()} }; if(-not $idx[$k].mean){ $idx[$k].mean = $sufMean[$t] }; $idx[$k].words += $r.word }
}
Write-Utf8 (Join-Path $root '词根检索索引.json') ((@($idx.GetEnumerator() | Sort-Object Key | ForEach-Object { $_.Value })) | ConvertTo-Json -Depth 4)
$sb2 = New-Object System.Text.StringBuilder
[void]$sb2.AppendLine('== 词根索引（tag｜含义｜词数｜词） ==')
foreach($k in (@($idx.GetEnumerator() | Where-Object { $_.Key -like 'root|*' } | Sort-Object Key))){ $v=$idx[$k.Key]; [void]$sb2.AppendLine(('{0}｜{1}｜{2}词｜{3}' -f $v.tag,$v.mean,$v.words.Count,($v.words -join ' '))) }
[void]$sb2.AppendLine(''); [void]$sb2.AppendLine('== 前缀索引 ==')
foreach($k in (@($idx.GetEnumerator() | Where-Object { $_.Key -like 'pre|*' } | Sort-Object Key))){ $v=$idx[$k.Key]; [void]$sb2.AppendLine(('{0}｜{1}｜{2}词｜{3}' -f $v.tag,$v.mean,$v.words.Count,($v.words -join ' '))) }
[void]$sb2.AppendLine(''); [void]$sb2.AppendLine('== 后缀索引 ==')
foreach($k in (@($idx.GetEnumerator() | Where-Object { $_.Key -like 'suf|*' } | Sort-Object Key))){ $v=$idx[$k.Key]; [void]$sb2.AppendLine(('{0}｜{1}｜{2}词｜{3}' -f $v.tag,$v.mean,$v.words.Count,($v.words -join ' '))) }
Write-Utf8 (Join-Path $root '词根检索索引.txt') $sb2.ToString()
Write-Output 'indexes written'

# ---------- 6. 校订与存疑清单 ----------
$sb3 = New-Object System.Text.StringBuilder
[void]$sb3.AppendLine('校订与存疑清单（自动汇总）')
[void]$sb3.AppendLine('说明：主表 3555 词条来自 A 底稿并做机械校订（词形/音标/词性/释义清理，见 _work 各基线脚本与覆盖表）；')
[void]$sb3.AppendLine('词根/前缀/后缀标记为规则启发式 v1（规范表见 spec.md），标记有争议时宁可标基础词；')
[void]$sb3.AppendLine('专名/月份/星期已按词典大写；补遗词条（3556 起）另见 补遗_词条.txt。')
[void]$sb3.AppendLine('')
[void]$sb3.AppendLine('--- 词条内 note（纠错/补全/存疑） ---')
foreach($r in $arr){ if($r.note){ [void]$sb3.AppendLine(('{0:D4} {1}: {2}' -f [int]$r.no,$r.word,$r.note)) } }
Write-Utf8 (Join-Path $root '校订与存疑清单.txt') $sb3.ToString()
Write-Output 'cleanup list written'
Write-Output 'ALL DONE'
