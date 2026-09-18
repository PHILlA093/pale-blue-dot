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
[WT]::Click(($r.Left+720),($r.Top+500))
Start-Sleep -Milliseconds 4300
$ox=$r.Left+8; $oy=$r.Top+31
[WT]::Click(($ox+31),($oy+29))
Start-Sleep -Milliseconds 600
function Shot($tag){
  $bmp=New-Object System.Drawing.Bitmap(1456,939); $g=[System.Drawing.Graphics]::FromImage($bmp); $dc=$g.GetHdc()
  [WT]::PrintWindow($h,$dc,2)|Out-Null; $g.ReleaseHdc($dc); $g.Dispose()
  $f="E:\workspace\穷观\桌面版\build\_fl_$tag.png"; $bmp.Save($f,[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); return $f
}
function Bands($img){
  $b=[System.Drawing.Bitmap]::FromFile($img); $out=New-Object System.Collections.ArrayList; $cur=-1; $last=0
  for($y=80;$y -lt 500;$y++){ $cnt=0; for($x=16;$x -lt 250;$x+=2){ $c=$b.GetPixel($x,$y); if(($c.R+$c.G+$c.B) -gt 320){$cnt++} }; if($cnt -gt 6){ if($cur -lt 0){$cur=$y}; $last=$y } else { if($cur -ge 0){ $ye=$y-1; $pair=,@($cur,$ye); [void]$out.Add($pair[0]); $cur=-1 } } }
  $b.Dispose(); return $out
}
$s1=Shot 'side'
$bands=@(Bands $s1)
Write-Output ("bands="+$bands.Count)
for($i=0;$i -lt $bands.Count;$i++){ Write-Output (" band $i = "+$bands[$i][0]+".."+$bands[$i][1]) }
if($bands.Count -lt 4){ Write-Output 'SIDEBAR CLOSED? retry toggle'; [WT]::Click(($ox+31),($oy+29)); Start-Sleep -Milliseconds 700; $s1=Shot 'side2'; $bands=@(Bands $s1); Write-Output ("bands2="+$bands.Count); for($i=0;$i -lt $bands.Count;$i++){ Write-Output (" b2 $i = "+$bands[$i][0]+".."+$bands[$i][1]) } }
# 最后一个区块头=观澜;点击其中心(窗口坐标:shot y 即窗口 y)
if($bands.Count -ge 1){
  $last=@($bands[$bands.Count-1])
  $cy=[int](($last[0]+$last[1])/2)
  [WT]::Click(($r.Left+140),($r.Top+$cy))
  Start-Sleep -Milliseconds 700
  # 找打开按钮(渐变主按钮:蓝渐变) 区域 x<300,y 200..420
  $s2=Shot 'open'
  $b=[System.Drawing.Bitmap]::FromFile($s2)
  $sx=0;$sy=0;$n=0
  for($y=180;$y -lt 460;$y+=2){ for($x=16;$x -lt 300;$x+=2){ $c=$b.GetPixel($x,$y); if($c.B -gt 150 -and $c.B -gt $c.R+55 -and $c.G -gt 70 -and $c.G -lt 210 -and $c.R -gt 20 -and $c.R -lt 150){ $sx+=$x;$sy+=$y;$n++ } } }
  $b.Dispose()
  Write-Output ("gradient blob n="+$n)
  if($n -gt 12){ $cx=[int]($sx/$n); $c2y=[int]($sy/$n); Write-Output ("click open at win("+$cx+","+$c2y+")"); [WT]::Click(($r.Left+$cx),($r.Top+$c2y)) }
}
Start-Sleep 2
$wins=[WE]::Of([uint32]$p.Id)
foreach($w in $wins){
  $sb=New-Object System.Text.StringBuilder 200; [void][WT]::GetWindowText($w,$sb,200); $cap=$sb.ToString()
  if($cap.IndexOf('观澜') -ge 0){
    $style=[WT]::GetWindowLong($w,-16)
    Write-Output ("GUANLAN_CAP="+$cap)
    Write-Output ("STYLE=0x"+$style.ToString('X8')+" WS_CAPTION="+(($style -band 0x00C00000) -ne 0)+" WS_THICKFRAME="+(($style -band 0x00040000) -ne 0))
  }
}
if(-not $p.HasExited){ $p.Kill() }
Write-Output DONE
