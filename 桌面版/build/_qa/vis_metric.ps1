Add-Type -AssemblyName System.Drawing
$base = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2) + '\' + [string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build'
foreach ($f in @('_vishot_A_on.png', '_vishot_B_off.png')) {
  $b = [System.Drawing.Bitmap]::FromFile((Join-Path $base $f))
  $colored = 0; $greyish = 0; $hues = @{}
  for ($y = 100; $y -lt 900; $y += 3) {
    for ($x = 20; $x -lt 1440; $x += 3) {
      $c = $b.GetPixel($x, $y)
      $mx = [math]::Max($c.R, [math]::Max($c.G, $c.B)); $mn = [math]::Min($c.R, [math]::Min($c.G, $c.B))
      $sat = $mx - $mn
      if ($sat -gt 45 -and $mx -gt 70) {
        $colored++
        if ($mx -eq $c.R) { $h = (($c.G - $c.B) % 256) } elseif ($mx -eq $c.G) { $h = ((($c.B - $c.R) / 1) % 256) + 85 } else { $h = ((($c.R - $c.G) / 1) % 256) + 170 }
        if ($h -lt 0) { $h += 256 }
        $bucket = [math]::Floor($h / 32)
        $hues["$bucket"] = $hues["$bucket"] + 1
      }
    }
  }
  $b.Dispose()
  $hs = ($hues.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "$($_.Key):$($_.Value)" }) -join ' '
  Write-Output ($f + ' coloredPx=' + $colored + ' hues=' + $hs)
}
