$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left, Top, Right, Bottom; }
public class W32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(120);
    mouse_event(0x02, 0, 0, 0, UIntPtr.Zero);
    mouse_event(0x04, 0, 0, 0, UIntPtr.Zero);
  }
}
"@

$exe = 'E:\workspace\qiong\placeholder.exe'   # replaced below
$exe = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60) + '.exe'
$chem = [string]([char]0x5316 + [char]0x5B66)   # "chem" in Chinese, utf8 decoded
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'knet_run.log'
$outDir = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build'

function Snap($h, $tag) {
  $w = 1456; $hh = 939
  $bmp = New-Object System.Drawing.Bitmap($w, $hh)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $dc = $g.GetHdc()
  [W32]::PrintWindow($h, $dc, 2) | Out-Null
  $g.ReleaseHdc($dc); $g.Dispose()
  $p = Join-Path $outDir ("_n_" + $tag + ".png")
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

function MenuRows($img) {
  $b = [System.Drawing.Bitmap]::FromFile($img)
  $bands = New-Object System.Collections.ArrayList
  $cur = -1
  for ($y = 95; $y -lt 300; $y++) {
    $cnt = 0
    for ($x = 100; $x -lt 215; $x++) {
      $c = $b.GetPixel($x, $y)
      if (($c.R + $c.G + $c.B) -gt 330) { $cnt++ }
    }
    if ($cnt -gt 4) { if ($cur -lt 0) { $cur = $y } }
    else { if ($cur -ge 0) { $ye = $y - 1; $band = , @($cur, $ye); [void]$bands.Add($band[0]); $cur = -1 } }
  }
  $b.Dispose()
  return $bands
}

Write-Output ("exe=" + $exe)
Write-Output ("exists=" + (Test-Path $exe))

$mark = 0
if (Test-Path $log) { $mark = (Get-Content $log).Count }
Write-Output ("log baseline=" + $mark)

# 1) launch exe
$p = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 6
Write-Output ("pid=" + $p.Id)

# 2) find main window
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 25 -and $hwnd -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 400
  $proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if ($proc) { $hwnd = $proc.MainWindowHandle }
}
Write-Output ("hwnd=" + $hwnd)
[W32]::ShowWindow($hwnd, 9) | Out-Null                  # SW_RESTORE
$HWND_TOPMOST = New-Object System.IntPtr -ArgumentList -1
[W32]::SetWindowPos($hwnd, $HWND_TOPMOST, 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0040) | Out-Null  # topmost, no move/size
[W32]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 800

# 2.5) dismiss boot intro (any pointerdown) then wait fade + reveal
$r0 = New-Object RECT
[W32]::GetWindowRect($hwnd, [ref]$r0) | Out-Null
[W32]::Click($r0.Left + 720, $r0.Top + 500)
Start-Sleep -Milliseconds 2600
Snap $hwnd 'i1'   # intro-gone proof shot

# 3) baseline math shot
Snap $hwnd 'm0'

# 4) open subject menu by clicking button (approx client 98,29)
$r = New-Object RECT
[W32]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$ox = $r.Left + 8; $oy = $r.Top + 31
Write-Output ("winrect L,T,R,B=" + $r.Left + "," + $r.Top + "," + $r.Right + "," + $r.Bottom)
[W32]::Click($ox + 98, $oy + 29)
Start-Sleep -Milliseconds 450
$m1 = Join-Path $outDir '_n_m1.png'
Snap $hwnd 'm1'
$bands = @(MenuRows $m1)
Write-Output ("menu bands count=" + $bands.Count)
for ($i = 0; $i -lt $bands.Count; $i++) {
  Write-Output ("  band " + $i + ": y " + $bands[$i][0] + ".." + $bands[$i][1])
}
if ($bands.Count -lt 5) { Write-Output 'MENU NOT OPEN, ABORT'; if (-not $p.HasExited) { $p.Kill() }; exit 1 }

# 5) click 5th row = chemistry (y is window coords; oy offset added)
$by0 = [int]$bands[4][0]; $by1 = [int]$bands[4][1]
$cy = [int](($by0 + $by1) / 2)
Write-Output ("click row5 chem at window-y=" + $cy)
[W32]::Click($ox + 150, $oy + $cy)
Start-Sleep -Milliseconds 260
Snap $hwnd 'm2'     # mask fading out phase
Start-Sleep -Seconds 3
Snap $hwnd 'm3'     # after switch

# 6) verify via log TITLE lines (utf8)
Start-Sleep -Milliseconds 400
$tail = ''
if (Test-Path $log) {
  $tail = [System.IO.File]::ReadAllText($log, [System.Text.Encoding]::UTF8)
}
$ok = $tail.Contains($chem)
Write-Output ("CHEM_TITLE_SEEN=" + $ok)
Write-Output '--- last 3 TITLE lines ---'
([regex]::Matches($tail, 'TITLE:[^\r\n]*')) | Select-Object -Last 3 | ForEach-Object { Write-Output $_.Value }
if (-not $p.HasExited) { $p.Kill() }
Write-Output DONE
