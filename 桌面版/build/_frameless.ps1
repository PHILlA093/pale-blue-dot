$ErrorActionPreference='SilentlyContinue'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public struct RECT { public int Left, Top, Right, Bottom; }
public class WT {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,UIntPtr e);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a,int x,int y,int cx,int cy,uint fl);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int m);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h,int i);
  public static void Click(int x,int y){ SetCursorPos(x,y); System.Threading.Thread.Sleep(120); mouse_event(0x02,0,0,0,UIntPtr.Zero); mouse_event(0x04,0,0,0,UIntPtr.Zero); }
}
public class WE {
  public delegate bool P(IntPtr h,IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(P p,IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int m);
  public static System.Collections.Generic.List<IntPtr> Of(uint pid){ var l=new System.Collections.Generic.List<IntPtr>(); EnumWindows(delegate(IntPtr h,IntPtr x){ uint wp; GetWindowThreadProcessId(h,out wp); if(wp==pid) l.Add(h); return true;},IntPtr.Zero); return l; }
}
"@
$pn=[string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60)
Get-Process -Name $pn -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1
$exe="E:\workspace\穷观\桌面版\$pn.exe"
$p=Start-Process $exe -PassThru
Start-Sleep 5
$h=[IntPtr]::Zero
for($i=0;$i -lt 20 -and $h -eq [IntPtr]::Zero;$i++){ Start-Sleep -Milliseconds 300; $pr=Get-Process -Id $p.Id -ErrorAction SilentlyContinue; if($pr){$h=$pr.MainWindowHandle} }
[WT]::ShowWindow($h,9)|Out-Null
[WT]::SetWindowPos($h,(New-Object IntPtr -ArgumentList -1),0,0,0,0,0x0001 -bor 0x0002 -bor 0x0040)|Out-Null
[WT]::SetForegroundWindow($h)|Out-Null
Start-Sleep -Milliseconds 600
$r=New-Object RECT; [WT]::GetWindowRect($h,[ref]$r)|Out-Null
[WT]::Click(($r.Left+720),($r.Top+500))   # dismiss intro
Start-Sleep -Milliseconds 4300
$ox=$r.Left+8; $oy=$r.Top+31
[WT]::Click(($ox+31),($oy+29))            # sideToggle
Start-Sleep -Milliseconds 500
# guanlan section head approx client y ~ 200 (4th collapsed section); try 4 candidates
foreach($yy in @(198,232,268)){
  [WT]::Click(($ox+140),($oy+$yy))
  Start-Sleep -Milliseconds 300
  # check second window appears
  $wins=[WE]::Of([uint32]$p.Id)
  $found=$false
  foreach($w in $wins){ $sb=New-Object System.Text.StringBuilder 200; [void][WT]::GetWindowText($w,$sb,200); $cap=$sb.ToString(); if($cap.IndexOf('观澜') -ge 0){ $found=$true } }
  if($found){ Write-Output "HEAD_Y=$yy FOUND=true"; break } else { Write-Output "HEAD_Y=$yy FOUND=false" }
}
Start-Sleep 1
$wins=[WE]::Of([uint32]$p.Id)
foreach($w in $wins){
  $sb=New-Object System.Text.StringBuilder 200; [void][WT]::GetWindowText($w,$sb,200); $cap=$sb.ToString()
  if($cap.IndexOf('观澜') -ge 0){
    $style=[WT]::GetWindowLong($w,-16)
    $captionBit=($style -band 0x00C00000)
    Write-Output ("GUANLAN_CAP="+$cap)
    Write-Output ("STYLE=0x"+$style.ToString('X8')+" WS_CAPTION_PRESENT="+($captionBit -ne 0))
  }
}
if(-not $p.HasExited){ $p.Kill() }
Write-Output DONE
