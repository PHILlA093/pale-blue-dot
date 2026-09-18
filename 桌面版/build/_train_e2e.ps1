$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public struct RECT { public int Left, Top, Right, Bottom; }
public class W32T {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
}
public class WinEnum {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  public static System.Collections.Generic.List<IntPtr> OfProcess(uint pid) {
    var list = new System.Collections.Generic.List<IntPtr>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      uint wp; GetWindowThreadProcessId(h, out wp);
      if (wp == pid) list.Add(h);
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@
$pname = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60)
$trainCap = [string]([char]0x8BAD + [char]0x7EC3 + [char]0x52A9 + [char]0x624B)
$exe = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + $pname + '.exe'
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'knet_run.log'
$outDir = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build'

function Caption($h) {
  $sb = New-Object System.Text.StringBuilder 256
  [void][W32T]::GetWindowText($h, $sb, 256)
  return $sb.ToString()
}
function Snap($h, $tag) {
  $r = New-Object RECT
  [W32T]::GetWindowRect($h, [ref]$r) | Out-Null
  $w = $r.Right - $r.Left; $hh = $r.Bottom - $r.Top
  $bmp = New-Object System.Drawing.Bitmap($w, $hh)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $dc = $g.GetHdc()
  [W32T]::PrintWindow($h, $dc, 2) | Out-Null
  $g.ReleaseHdc($dc); $g.Dispose()
  $p = Join-Path $outDir ("_qa3_" + $tag + ".png")
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  return $p
}
function LogSeg() {
  if (-not (Test-Path $log)) { return '' }
  $linesArr = Get-Content $log -Encoding UTF8
  $lastStart = -1
  for ($i = 0; $i -lt $linesArr.Count; $i++) {
    if ($linesArr[$i] -match 'APP:start') { $lastStart = $i }
  }
  if ($lastStart -lt 0) { return ($linesArr -join "`n") }
  return ($linesArr[$lastStart..($linesArr.Count - 1)] -join "`n")
}

Get-Process -Name $pname -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600
$askEnc = [uri]::EscapeDataString([string]([char]0x5BFC + [char]0x6570 + [char]0x4E0E + [char]0x51FD + [char]0x6570 + [char]0x7684 + [char]0x5355 + [char]0x8C03 + [char]0x6027))
$qa = '--qa=key=sk-e2e-fake-0001&ask=' + $askEnc + '&open=1'
Write-Output ("qa arg=" + $qa)
$p = Start-Process -FilePath $exe -ArgumentList $qa -PassThru
Start-Sleep -Seconds 6

$mainH = [IntPtr]::Zero
$trainH = [IntPtr]::Zero
$proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
if ($proc) { $mainH = $proc.MainWindowHandle }
[W32T]::ShowWindow($mainH, 9) | Out-Null
$HWND_TOPMOST = New-Object System.IntPtr -ArgumentList -1
[W32T]::SetWindowPos($mainH, $HWND_TOPMOST, 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0040) | Out-Null
Write-Output ("MAIN=" + (Caption $mainH))

# poll up to 40s for DS line (fake key -> fast 401) and TRAIN window
$foundDs = $false; $foundCorpus = $false; $foundTrain = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 700
  $seg = LogSeg
  if ($seg.Contains('CORPUS:')) { $foundCorpus = $true }
  if ($seg.Contains('DS:')) { $foundDs = $true }
  if (-not $foundTrain) {
    $wins = [WinEnum]::OfProcess([uint32]$p.Id)
    foreach ($h in $wins) {
      if ((Caption $h).IndexOf($trainCap) -ge 0) { $trainH = $h; $foundTrain = $true }
    }
  }
  if ($foundDs) { break }
}
Start-Sleep -Seconds 3
if ($trainH -ne [IntPtr]::Zero) {
  $s = Snap $trainH 'after'
  Write-Output ("train shot=" + $s)
}
Write-Output ("FOUND_TRAIN=" + $foundTrain)
Write-Output ("FOUND_CORPUS=" + $foundCorpus)
Write-Output ("FOUND_DS=" + $foundDs)
$seg = LogSeg
Write-Output ("FOUND_DBADD=" + $seg.Contains('DBADD:'))
Write-Output ("FOUND_DBSTAT_LOG=n/a")
Write-Output '--- tail ---'
Get-Content $log -Tail 26 -Encoding UTF8 | ForEach-Object { Write-Output $_ }
if (-not $p.HasExited) { $p.Kill() }
Write-Output DONE
