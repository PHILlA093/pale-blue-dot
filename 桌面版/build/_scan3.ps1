Add-Type -AssemblyName System.Drawing
$outDir = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build'
$b = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir '_n_m1.png'))
# row y-bands where bright text exists (x 95..215) and their dominant color type
$prev = -1; $start = -1
$bands = New-Object System.Collections.ArrayList
for ($y = 90; $y -lt 300; $y++) {
  $cnt = 0
  for ($x = 95; $x -lt 215; $x++) {
    $c = $b.GetPixel($x, $y)
    if (($c.R + $c.G + $c.B) -gt 330) { $cnt++ }
  }
  if ($cnt -gt 3) { if ($start -lt 0) { $start = $y } ; $prev = $y }
  else { if ($start -ge 0) { [void]$bands.Add(@($start, $prev)); $start = -1 } }
}
$b.Dispose()
Write-Output ("bands=" + $bands.Count)
for ($i = 0; $i -lt $bands.Count; $i++) {
  $y0 = [int]$bands[$i][0]; $y1 = [int]$bands[$i][1]
  $cy = [int](($y0 + $y1) / 2)
  # sample text color at the center pixel and classify accent vs normal
  $sampleRow = $cy
  $acc = 0
  for ($x = 95; $x -lt 215; $x++) {
    $c2 = $b2.GetPixel($x, $sampleRow)
    if (($c2.R + $c2.G + $c2.B) -gt 330 -and $c2.R -lt 160 -and $c2.B -gt 200) { $acc++ }
  }
  Write-Output ("band " + $i + " y " + $y0 + ".." + $y1 + " center=" + $cy + " accentPx=" + $acc)
}
