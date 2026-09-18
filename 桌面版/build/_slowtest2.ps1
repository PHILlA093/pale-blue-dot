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
$exe = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60) + '.exe'
$pname = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60)
$outDir = Split-Path $exe -Parent
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'knet_run.log'
$chemT = [string]([char]0x5316 + [char]0x5B66)
$mathT = [string]([char]0x6570 + [char]0x5B66)

function Snap($h, $tag) {
  $bmp = New-Object System.Drawing.Bitmap(1456, 939)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $dc = $g.GetHdc()
  [W32]::PrintWindow($h, $dc, 2) | Out-Null
  $g.ReleaseHdc($dc); $g.Dispose()
  $p = Join-Path $outDir ("_st_" + $tag + ".png")
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
function Brightness($img) {
  $b = [System.Drawing.Bitmap]::FromFile($img)
  $tot = 0; $n = 0
  for ($y = 100; $y -lt 939; $y += 6) {
    for ($x = 0; $x -lt 1456; $x += 6) {
      $c = $b.GetPixel($x, $y)
      $tot += ($c.R + $c.G + $c.B) / 3
      $n++
    }
  }
  $b.Dispose()
  return [math]::Round($tot / $n, 1)
}
function RowStarts($img) {
  # returns first band start y (top text row) within menu area x95..215, y90..300
  $b = [System.Drawing.Bitmap]::FromFile($img)
  $found = -1
  for ($y = 90; $y -lt 300; $y++) {
    $cnt = 0
    for ($x = 95; $x -lt 215; $x++) {
      $c = $b.GetPixel($x, $y)
      if (($c.R + $c.G + $c.B) -gt 330) { $cnt++ }
    }
    if ($cnt -gt 6) { $found = $y; break }
  }
  $b.Dispose()
  return $found
}
function WaitTitleAfter($logPath, $minLines, $want, $timeoutMs) {
  $deadline = [Environment]::TickCount + $timeoutMs
  while ([Environment]::TickCount -lt $deadline) {
    Start-Sleep -Milliseconds 250
    if (Test-Path $logPath) {
      $all = [System.IO.File]::ReadAllText($logPath, [System.Text.Encoding]::UTF8)
      $lines = $all -split "`n"
      if ($lines.Count -gt $minLines) {
        $new = $lines[$minLines..($lines.Count - 1)] -join "`n"
        if ($new.Contains($want)) { return $true }
      }
    }
  }
  return $false
}

Get-Process -Name $pname -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
$mark = 0
if (Test-Path $log) { $mark = (Get-Content $log).Count }
Write-Output ("log baseline=" + $mark)

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
Start-Sleep -Milliseconds 900
$r0 = New-Object RECT
[W32]::GetWindowRect($hwnd, [ref]$r0) | Out-Null
[W32]::Click(($r0.Left + 720), ($r0.Top + 500))
Start-Sleep -Milliseconds 4300

$r = New-Object RECT
[W32]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$ox = $r.Left + 8; $oy = $r.Top
Write-Output ("winrect L,T=" + $r.Left + "," + $r.Top)

# --- phase A: from current subject to 数学 (menu row index 1) ---
[W32]::Click(($ox + 98), ($r.Top + 31 + 29))
Start-Sleep -Milliseconds 500
$m1 = Join-Path $outDir '_st_menuA.png'
Snap $hwnd 'menuA'
$y0 = RowStarts $m1
Write-Output ("menu first text row y=" + $y0)
if ($y0 -lt 80) { Write-Output 'MENU NOT OPEN'; if (-not $p.HasExited) { $p.Kill() }; exit 1 }
$target = $y0 + 11 + 33   # row index 1 = 数学 (rows: 0 语文,1 数学,...)
Write-Output ("click math row at y=" + $target)
[W32]::Click(($ox + 150), ($r.Top + $target))
Start-Sleep -Milliseconds 400
Snap $hwnd 'p400'
Start-Sleep -Milliseconds 700
Snap $hwnd 'p1100'
Start-Sleep -Milliseconds 600
Snap $hwnd 'p1700'
Start-Sleep -Milliseconds 900
Snap $hwnd 'p2600'
Start-Sleep -Milliseconds 2400
Snap $hwnd 'p5000'
$okA = WaitTitleAfter $log $mark $mathT 15000
Write-Output ("A->MATH_TITLE_AFTER_CLICK=" + $okA)
$tags = 'p400,p1100,p1700,p2600,p5000'.Split(',')
foreach ($t in $tags) {
  Write-Output ($t + " brightness=" + (Brightness (Join-Path $outDir ("_st_" + $t + ".png"))))
}
if (-not $okA) { if (-not $p.HasExited) { $p.Kill() }; Write-Output 'PHASE A FAIL'; exit 1 }
Start-Sleep -Milliseconds 2600   # let new page fully reveal (mask hold 600ms + fade 1200ms + margin)

# --- phase B: back to 化学 (row index 4) ---
$mark2 = (Get-Content $log).Count
[W32]::Click(($ox + 98), ($r.Top + 31 + 29))
Start-Sleep -Milliseconds 500
Snap $hwnd 'menuB'
$y0b = RowStarts (Join-Path $outDir '_st_menuB.png')
Write-Output ("menuB first row y=" + $y0b)
$target2 = $y0b + 11 + 132   # row index 4 = 化学
[W32]::Click(($ox + 150), ($r.Top + $target2))
$okB = WaitTitleAfter $log $mark2 $chemT 15000
Write-Output ("B->CHEM_TITLE_AFTER_CLICK=" + $okB)
if (-not $p.HasExited) { $p.Kill() }
Write-Output DONE
