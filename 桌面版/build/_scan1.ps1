Add-Type -AssemblyName System.Drawing
$outDir = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build'
foreach ($f in @('_n_m0.png', '_n_i1.png')) {
  $b = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir $f))
  Write-Output ("== " + $f + " topbar-left bright (x55..230) ==")
  $prev = -1; $start = -1; $out = ''
  for ($y = 20; $y -lt 130; $y++) {
    $cnt = 0
    for ($x = 55; $x -lt 230; $x += 2) {
      $c = $b.GetPixel($x, $y)
      if (($c.R + $c.G + $c.B) -gt 480) { $cnt++ }
    }
    if ($cnt -gt 1) {
      if ($start -lt 0) { $start = $y }
      $prev = $y
    } else {
      if ($start -ge 0) { $out += (" " + $start + ".." + $prev); $start = -1 }
    }
  }
  if ($start -ge 0) { $out += (" " + $start + ".." + $prev) }
  Write-Output ("  bands:" + $out)
  $b.Dispose()
}
