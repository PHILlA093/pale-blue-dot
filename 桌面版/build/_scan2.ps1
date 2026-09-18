Add-Type -AssemblyName System.Drawing
$outDir = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build'
$files = @('_sw1.png', '_n_i1.png', '_n_m0.png')
foreach ($f in $files) {
  $b = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir $f))
  $lit = 0; $col = 0; $n = 0
  for ($y = 0; $y -lt 939; $y += 4) {
    for ($x = 0; $x -lt 1456; $x += 4) {
      $c = $b.GetPixel($x, $y)
      $s = $c.R + $c.G + $c.B
      if ($s -gt 90) { $lit++ }
      $mx = [math]::Max($c.R, [math]::Max($c.G, $c.B)); $mn = [math]::Min($c.R, [math]::Min($c.G, $c.B))
      if (($mx - $mn) -gt 30 -and $s -gt 90) { $col++ }
      $n++
    }
  }
  Write-Output ($f + " lit=" + $lit + " colored=" + $col + " samples=" + $n)
  $b.Dispose()
}
