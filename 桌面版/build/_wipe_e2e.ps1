$ErrorActionPreference = 'Stop'
$pname = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60)
$exe = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + $pname + '.exe'
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'knet_run.log'

Get-Process -Name $pname -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600
# 先注入一把"假钥匙"占位,验证 wipe 能把它清掉:
# (真实用户 Key 若存在 localStorage 同样会被 removeItem)
$p = Start-Process -FilePath $exe -ArgumentList '--qa=key=sk-e2e-fake-0001' -PassThru
Start-Sleep -Seconds 6
if (-not $p.HasExited) { $p.Kill() }
Start-Sleep -Milliseconds 800
# 现在执行一键清除流程
$p2 = Start-Process -FilePath $exe -ArgumentList '--qa=wipe=1&open=1' -PassThru
Start-Sleep -Seconds 12
$seg = ''
if (Test-Path $log) {
  $linesArr = Get-Content $log -Encoding UTF8
  $lastStart = -1
  for ($i = 0; $i -lt $linesArr.Count; $i++) { if ($linesArr[$i] -match 'APP:start') { $lastStart = $i } }
  if ($lastStart -ge 0) { $seg = ($linesArr[$lastStart..($linesArr.Count - 1)] -join "`n") }
}
Write-Output ("WIPE_SEEN=" + $seg.Contains('WIPE:'))
Write-Output ("TITLE_WIPED_SEEN=" + $seg.Contains('wiped'))
$sk = Select-String -Path $log -Pattern 'sk-[A-Za-z0-9_\-]{6,}' -AllMatches -ErrorAction SilentlyContinue
Write-Output ("LOG_SK_LINES=" + (($sk | Measure-Object).Count))
Write-Output '--- tail ---'
Get-Content $log -Tail 14 -Encoding UTF8 | ForEach-Object { Write-Output $_ }
if (-not $p2.HasExited) { $p2.Kill() }
Write-Output DONE
