$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left, Top, Right, Bottom; }
public class W32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
}
"@
$exe = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60) + '.exe'
$outFile = $args[0]
$p = Start-Process -FilePath $exe -PassThru
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 25 -and $hwnd -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 400
  $proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if ($proc) { $hwnd = $proc.MainWindowHandle }
}
if ($hwnd -eq [IntPtr]::Zero) { Write-Output 'NO HWND'; exit 1 }
# intro title animation: delay 1.1s + 2s anim, so wait until fully visible
Start-Sleep -Seconds 4
$r = New-Object RECT
[W32]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$dc = $g.GetHdc()
[W32]::PrintWindow($hwnd, $dc, 2) | Out-Null
$g.ReleaseHdc($dc); $g.Dispose()
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
if (-not $p.HasExited) { $p.Kill() }
Write-Output ("SAVED " + $outFile + " size=" + $w + "x" + $h)
