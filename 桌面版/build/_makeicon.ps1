# _makeicon.ps1 -- generate the QiongGuan logo, ASCII-only on purpose (see guard below).
#
# One geometry, two encodings -- both come from Shared.BuildIcon() in Program.cs, whose
# 32x32 reference canvas is:
#   navy disc  #121B30  at (1,1)   d=30
#   cyan disc  #4FC3F7  at (6,6)   d=20
#   white dot           at (12,12) d=8
#
#   favicon.ico    master logo. Every size is a 32bpp BMP entry: PNG-compressed entries
#                  are smaller but .NET Framework's System.Drawing.Icon cannot decode
#                  them, and this file goes into /win32icon: (Explorer + shortcut icons),
#                  so it must parse everywhere. ~370 KB.
#   _web_icon.ico  derived, PNG entries only, embedded as the page resource web.favicon.ico.
#                  Only Chromium ever reads it, so PNG is safe and costs a few KB
#                  instead of a second 370 KB copy inside the exe.
param(
    [string]$Out = '',
    [string]$WebOut = '',
    [switch]$WebOnly
)

$ErrorActionPreference = 'Stop'

# Fail loudly instead of silently: a non-ASCII byte here is decoded as ANSI by Windows
# PowerShell and swallows the following lines (that trap once emptied /win32icon:'s value).
foreach ($b in [System.IO.File]::ReadAllBytes($MyInvocation.MyCommand.Path)) {
    if ($b -gt 127) { Write-Output 'ICON FAILED: _makeicon.ps1 must be ASCII-only'; exit 1 }
}

Add-Type -AssemblyName System.Drawing

$root = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2)
$build = Join-Path $root (([string]([char]0x684C + [char]0x9762 + [char]0x7248)) + '\build')
if (-not $Out) { $Out = Join-Path $root 'favicon.ico' }
if (-not $WebOut) { $WebOut = Join-Path $build '_web_icon.ico' }

function New-LogoBitmap([int]$S) {
    $bmp = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $k = [float]($S / 32.0)
    $navy = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 27, 48))
    $cyan = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 79, 195, 247))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillEllipse($navy, [float](1 * $k), [float](1 * $k), [float](30 * $k), [float](30 * $k))
    $g.FillEllipse($cyan, [float](6 * $k), [float](6 * $k), [float](20 * $k), [float](20 * $k))
    $g.FillEllipse($white, [float](12 * $k), [float](12 * $k), [float](8 * $k), [float](8 * $k))
    $navy.Dispose(); $cyan.Dispose(); $white.Dispose(); $g.Dispose()
    return $bmp
}

function Get-PixelBytes($bmp, [int]$S) {
    $rect = New-Object System.Drawing.Rectangle(0, 0, $S, $S)
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                          [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $buf = New-Object byte[] ($data.Stride * $S)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
    $stride = $data.Stride
    $bmp.UnlockBits($data)
    return , @{ bytes = $buf; stride = $stride }
}

function New-BmpEntry($bmp, [int]$S, $px) {
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $bw.Write([uint32]40)
    $bw.Write([int32]$S)
    $bw.Write([int32]($S * 2))
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]0)
    $bw.Write([uint32]($S * $S * 4))
    $bw.Write([int32]0)
    $bw.Write([int32]0)
    $bw.Write([uint32]0)
    $bw.Write([uint32]0)
    for ($y = $S - 1; $y -ge 0; $y--) {
        $bw.Write($px.bytes, ($y * $px.stride), ($S * 4))
    }
    $andRow = [int]([math]::Floor(($S + 31) / 32) * 4)
    $zeros = New-Object byte[] ($andRow * $S)
    $bw.Write($zeros, 0, $zeros.Length)
    $bw.Flush()
    $out = $ms.ToArray()
    $bw.Dispose(); $ms.Dispose()
    return $out
}

function New-PngEntry($bmp) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $out = $ms.ToArray()
    $ms.Dispose()
    return $out
}

function New-IcoFile([string]$Path, [int[]]$Sizes, [bool]$AsPng) {
    $entries = New-Object System.Collections.ArrayList
    foreach ($S in $Sizes) {
        $bmp = New-LogoBitmap $S
        if ($AsPng) {
            $bytes = New-PngEntry $bmp
        } else {
            $px = Get-PixelBytes $bmp $S
            $bytes = New-BmpEntry $bmp $S $px
        }
        [void]$entries.Add(@{ size = $S; bytes = $bytes })
        $bmp.Dispose()
        Write-Output ('  ' + $S + 'x' + $S + ' ' + $bytes.Length + ' bytes')
    }
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $bw.Write([uint16]0)                  # reserved
    $bw.Write([uint16]1)                  # type: icon
    $bw.Write([uint16]$entries.Count)
    $offset = 6 + 16 * $entries.Count
    foreach ($e in $entries) {
        $w = $e.size
        if ($w -ge 256) { $w = 0 }        # 0 means 256 in ICONDIRENTRY
        $bw.Write([byte]$w)
        $bw.Write([byte]$w)
        $bw.Write([byte]0)                # palette colours
        $bw.Write([byte]0)                # reserved
        $bw.Write([uint16]1)              # planes
        $bw.Write([uint16]32)             # bits per pixel
        $bw.Write([uint32]$e.bytes.Length)
        $bw.Write([uint32]$offset)
        $offset += $e.bytes.Length
    }
    foreach ($e in $entries) { $bw.Write($e.bytes, 0, $e.bytes.Length) }
    $bw.Flush()
    [System.IO.File]::WriteAllBytes($Path, $ms.ToArray())
    $bw.Dispose(); $ms.Dispose()
    Write-Output ('ICON ' + $Path + ' ' + (Get-Item $Path).Length + ' bytes')
}

Write-Output 'web copy (PNG entries, page favicon):'
New-IcoFile $WebOut @(16, 32, 48, 64) $true

if (-not $WebOnly) {
    Write-Output 'master (BMP entries, exe Win32 icon):'
    New-IcoFile $Out @(16, 24, 32, 48, 64, 128, 256) $false
}

Write-Output 'ICON OK'
