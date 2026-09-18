$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W32T {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT2 r);
}
public struct RECT2 { public int Left, Top, Right, Bottom; }
"@
$pname = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60)
Get-Process -Name $pname -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400
$exe = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + $pname + '.exe'
$p = Start-Process -FilePath $exe -PassThru
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 25 -and $hwnd -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 400
  $proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if ($proc) { $hwnd = $proc.MainWindowHandle }
}
Start-Sleep -Milliseconds 2500
$sb = New-Object System.Text.StringBuilder 256
[void][W32T]::GetWindowText($hwnd, $sb, 256)
Write-Output ("WINDOW_CAPTION=" + $sb.ToString())
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'knet_run.log'
$lines = Get-Content $log -Encoding UTF8
for ($i = [math]::Max(0, $lines.Count - 4); $i -lt $lines.Count; $i++) { Write-Output ("LOG: " + $lines[$i]) }
if (-not $p.HasExited) { $p.Kill() }
