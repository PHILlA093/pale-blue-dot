Add-Type -AssemblyName System.Drawing
$f = $args[0]
$b = [System.Drawing.Bitmap]::FromFile($f)
# find bright text bands in upper-middle region (intro title area)
$bands = New-Object System.Collections.ArrayList
$start = -1
for ($y = 150; $y -lt 700; $y++) {
  $cnt = 0
  for ($x = 300; $x -lt 1156; $x += 2) {
    $c = $b.GetPixel($x, $y)
    if (($c.R + $c.G + $c.B) -gt 420) { $cnt++ }
  }
  if ($cnt -gt 6) { if ($start -lt 0) { $start = $y }; $last = $y }
  else { if ($start -ge 0) { [void]$bands.Add(@($start, $last)); $start = -1 } }
}
$b.Dispose()
Write-Output ("bands=" + $bands.Count)
for ($i = 0; $i -lt $bands.Count; $i++) {
  Write-Output ("  band " + $i + ": " + $bands[$i][0] + ".." + $bands[$i][1])
}
