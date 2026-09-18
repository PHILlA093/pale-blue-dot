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
$outDir = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build'
$exe = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60) + '.exe'
$chem = [string]([char]0x5316 + [char]0x5B66)
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'knet_run.log'

function Snap($h, $tag) {
  $bmp = New-Object System.Drawing.Bitmap(1456, 939)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $dc = $g.GetHdc()
  [W32]::PrintWindow($h, $dc, 2) | Out-Null
  $g.ReleaseHdc($dc); $g.Dispose()
  $p = Join-Path $outDir ("_slow_" + $tag + ".png")
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
function Brightness($img) {
  $b = [System.Drawing.Bitmap]::FromFile($img)
  $tot = 0; $n = 0
  for ($y = 90; $y -lt 939; $y += 6) {
    for ($x = 0; $x -lt 1456; $x += 6) {
      $c = $b.GetPixel($x, $y)
      $tot += ($c.R + $c.G + $c.B) / 3
      $n++
    }
  }
  $b.Dispose()
  return [math]::Round($tot / $n, 1)
}

$pname = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60)
Get-Process -Name $pname -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
$p = Start-Process -FilePath $exe -PassThru
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 25 -and $hwnd -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 400
  $proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if ($proc) { $hwnd = $proc.MainWindowHandle }
}
[W32]::ShowWindow($hwnd, 9) | Out-Null
$HWND_TOPMOST = New-Object System.IntPtr -ArgumentList -1
[W32]::SetWindowPos($hwnd, $HWND_TOPMOST, 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0040) | Out-Null
[W32]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 800
$r0 = New-Object RECT
[W32]::GetWindowRect($hwnd, [ref]$r0) | Out-Null
[W32]::Click(($r0.Left + 720), ($r0.Top + 500))   # dismiss intro
Start-Sleep -Milliseconds 2600
$r = New-Object RECT
[W32]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$ox = $r.Left + 8; $oy = $r.Top + 31

# open menu then click chemistry row (measured geometry: 5th row text around y 237..250 -> click 244)
[W32]::Click(($ox + 98), ($oy + 29))
Start-Sleep -Milliseconds 450
[W32]::Click(($ox + 150), ($oy + 244))
Start-Sleep -Milliseconds 400
Snap $hwnd 'a_400ms'
Start-Sleep -Milliseconds 700     # t=1.1s
Snap $hwnd 'b_1100ms'
Start-Sleep -Milliseconds 600     # t=1.7s (reload at 1.2s; new page dark hold)
Snap $hwnd 'c_1700ms'
Start-Sleep -Milliseconds 900     # t=2.6s
Snap $hwnd 'd_2600ms'
Start-Sleep -Milliseconds 2400    # t=5.0s
Snap $hwnd 'e_5000ms'

Start-Sleep -Milliseconds 300
$tail = ''
if (Test-Path $log) { $tail = [System.IO.File]::ReadAllText($log, [System.Text.Encoding]::UTF8) }
Write-Output ("CHEM_TITLE_SEEN=" + $tail.Contains($chem))
$tags = 'a_400ms,b_1100ms,c_1700ms,d_2600ms,e_5000ms'.Split(',')
foreach ($t in $tags) {
  Write-Output ($t + " brightness=" + (Brightness (Join-Path $outDir ("_slow_" + $t + ".png"))))
}
if (-not $p.HasExited) { $p.Kill() }
Write-Output DONE
