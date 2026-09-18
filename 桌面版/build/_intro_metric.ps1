Add-Type -AssemblyName System.Drawing
$f = $args[0]
$b = [System.Drawing.Bitmap]::FromFile($f)
$s1 = 0; $s2 = 0; $s3 = 0; $y0 = 340; $y1 = 466; $x0 = 300; $x1 = 1156
for ($y = $y0; $y -le $y1; $y++) {
  for ($x = $x0; $x -le $x1; $x++) {
    $c = $b.GetPixel($x, $y)
    $s = $c.R + $c.G + $c.B
    if ($s -gt 420) { $s1++ }
    if ($s -gt 600) { $s2++ }
    if ($s -gt 700) { $s3++ }
  }
}
$b.Dispose()
Write-Output ("soft>" + $s1 + " mid>" + $s2 + " core>" + $s3)
