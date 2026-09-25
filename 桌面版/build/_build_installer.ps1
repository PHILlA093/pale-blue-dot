# ============================================================================
#  _build_installer.ps1 -- build the QiongGuan Study Windows installer
#
#  Products (under <root>\, where <root> = E:\workspace\<QG>, QG assembled from
#  code points because this file must stay ASCII-only):
#     <root>\<desktop>\dist\<app>_<setup>.exe     the installer (~12.8 MB)
#     <root>\<desktop>\build\<uninstaller>.exe    standalone uninstaller (~40 KB)
#     <root>\<desktop>\build\_inst_ico.ico        small 16/32/48/64 icon
#     <root>\<desktop>\build\_inst_logo.png       64px PNG logo for the wizard
#
#  Payload strategy: every payload file is GZip-compressed at build time and
#  embedded with /resource:qg.payload.<n>.gz, in the exact order of $spec below.
#  Installer.cs rebuilds its Entry[] table programmatically from the same $spec,
#  so build and installer can never drift. 57.9 MB of payload -> ~12.8 MB exe.
#
#  The uninstaller is a separate, tiny binary compiled from the SAME source with
#  /define:UNINSTALLER (the whole wizard is #if'd out and no payload is embedded).
#  It is then gzipped and embedded as qg.uninstaller.gz so the installer can lay
#  it down. Copying the installer itself as the uninstaller would also work, but
#  it would drop a redundant 12.8 MB payload into the user's install folder.
#
#  TRAPS THIS SCRIPT WORKS AROUND (learned from _rebuild.ps1):
#   1. Windows PowerShell 5.1 decodes a .ps1 without BOM as ANSI (cp936 here), so a
#      single non-ASCII byte silently swallows the following lines. Guarded below.
#   2. Old csc cannot take a Chinese path in /out: -> build to ASCII temp, copy after.
#   3. Chinese source needs UTF-8 WITH BOM or csc reads it as ANSI and every Chinese
#      literal becomes mojibake. This script rewrites Installer.cs with a BOM.
#   4. The old wording here claimed $ErrorActionPreference must stay 'Continue'
#      "because a native command returning non-zero would otherwise abort the
#      script". That reason is wrong: under Windows PowerShell 5.1 a native
#      command's non-zero exit code does NOT raise a PowerShell exception, so
#      'Stop' would not have changed how csc failures are reported (that is what
#      $LASTEXITCODE is for -- _rebuild.ps1 uses 'Stop' and still checks it).
#      The variable stays 'Continue' anyway, deliberately: switching it now would
#      make every non-terminating cmdlet error abort mid-build, and the real
#      hazard here is the opposite one -- a FAILED WRITE that nobody notices.
#      So every write below is checked explicitly (Copy-Checked / Write-Gzip /
#      the icon steps / the resource selftest) and calls Fail -> exit 1.
#   4b. Never report success on stale bytes: a locked product file used to make
#      Copy-Item fail silently, the script carried on, hashed the OLD exe and
#      printed "BUILD OK" with a stale SHA256; a locked uninstaller exe used to
#      get re-packed from its copy, shipping the previous uninstaller inside the
#      new installer. Same failure class as the historic "data_bio.js shipped
#      stale" bug.
#   5. PowerShell 5.1 cannot invoke a method on an object inside a double-quoted
#      string, and a bare value list splatted onto a script with two [string] params
#      binds positionally (that once fed "-WebOut" into -Out). Use named params.
#   6. csc names an embedded resource after the FILE name unless /resource: says
#      otherwise, so a "temporary" leading underscore silently ships the resource as
#      _qg.payload.<n>.gz and every GetManifestResourceStream returns null.
# ============================================================================

$ErrorActionPreference = 'Continue'

# --- trap 1: refuse to run if this file is not pure ASCII -------------------
foreach ($b in [System.IO.File]::ReadAllBytes($MyInvocation.MyCommand.Path)) {
    if ($b -gt 127) { Write-Output 'BUILD FAILED: _build_installer.ps1 must be ASCII-only'; exit 1 }
}

# Every failure path goes through here: a build that cannot prove it wrote the
# bytes it intended to write must exit non-zero, never print BUILD OK.
function Fail([string]$msg) {
    Write-Output ('BUILD FAILED: ' + $msg)
    exit 1
}

# Copy + prove the destination is byte-identical to the source. A locked
# destination makes Copy-Item fail (or silently leave the old file, depending on
# how it fails) -- both end up here and abort the build.
function Copy-Checked([string]$from, [string]$to) {
    if (-not (Test-Path -LiteralPath $from)) { Fail ('copy source missing: ' + $from) }
    if (Test-Path -LiteralPath $to) { Remove-Item -LiteralPath $to -Force -ErrorAction SilentlyContinue }
    try { Copy-Item -LiteralPath $from -Destination $to -Force -ErrorAction Stop }
    catch { Fail ('copy failed: ' + $from + ' -> ' + $to + ' : ' + $_.Exception.Message) }
    if (-not (Test-Path -LiteralPath $to)) { Fail ('copy produced no file: ' + $to) }
    $la = (Get-Item -LiteralPath $from).Length
    $lb = (Get-Item -LiteralPath $to).Length
    if ($la -ne $lb) { Fail ('copy size mismatch (' + $la + ' vs ' + $lb + '): ' + $to) }
    $ha = (Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash
    $hb = (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash
    if ($ha -ne $hb) { Fail ('copy SHA256 mismatch: ' + $to) }
    Write-Output ('  copied ' + $lb + ' bytes  ' + $hb.Substring(0,16) + '...  ' + $to)
}

# Gzip ISIZE trailer = uncompressed length mod 2^32; the product itself verifies
# payload lengths with it at install time, so checking it here catches "packed
# the wrong source file" (the old data_bio.js failure mode) at build time.
function Get-GzipIsize([string]$path) {
    try {
        $b = [System.IO.File]::ReadAllBytes($path)
        if ($b.Length -lt 18) { return -1 }
        if ($b[0] -ne 0x1F -or $b[1] -ne 0x8B) { return -1 }
        $n = $b.Length
        return ([long]$b[$n-4] + ([long]$b[$n-3] -shl 8) + ([long]$b[$n-2] -shl 16) + ([long]$b[$n-1] -shl 24))
    } catch { return -1 }
}

$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { Write-Output ('BUILD FAILED: csc not found at ' + $csc); exit 1 }

# --- trap 2/5: assemble Chinese paths from code points ---------------------
$QG      = [string]([char]0x7A77 + [char]0x89C2)                                                   # QiongGuan
$DT      = [string]([char]0x684C + [char]0x9762 + [char]0x7248)                                     # Desktop edition
$XUEXI   = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60)                      # app name
$SETUP   = $XUEXI + '_' + [string]([char]0x5B89 + [char]0x88C5 + [char]0x7A0B + [char]0x5E8F)        # <app>_<setup>
$UNINST  = [string]([char]0x5378 + [char]0x8F7D) + $XUEXI                                          # uninstaller
$MANUAL  = [string]([char]0x4F7F + [char]0x7528 + [char]0x8BF4 + [char]0x660E) + '.txt'            # readme
$DBDIR   = [string]([char]0x6570 + [char]0x636E + [char]0x5E93)                                     # database dir
$FPNAME  = '_' + [string]([char]0x6307 + [char]0x7EB9) + '.txt'                                    # fingerprint

# Root is inferred from this script's own location (build\ -> desktop edition -> repo
# root) so the checkout can live anywhere, with the old absolute path kept only as a
# fallback. Same approach as _rebuild.ps1. The sanity check is index.html: it exists in
# every real checkout root and nowhere else, so a wrong guess cannot silently build.
$root = ''
if ($PSScriptRoot) {
    $guessDesk = Split-Path -Parent $PSScriptRoot
    if ($guessDesk) {
        $guessRoot = Split-Path -Parent $guessDesk
        if ($guessRoot -and (Test-Path (Join-Path $guessRoot 'index.html'))) { $root = $guessRoot }
    }
}
if (-not $root) {
    $root = Join-Path 'E:\workspace' $QG
    Write-Output ('NOTE: root not inferred from script location, falling back to ' + $root)
}
$deskTopDir = Join-Path $root $DT
$build   = Join-Path $deskTopDir 'build'
$dist    = Join-Path $deskTopDir 'dist'
if (-not (Test-Path (Join-Path $build 'Installer.cs'))) {
    Write-Output ('BUILD FAILED: inferred root looks wrong: ' + $root); exit 1
}

$srcCs   = Join-Path $build 'Installer.cs'
$fpPath  = Join-Path $build $FPNAME
$master  = Join-Path $root 'favicon.ico'
$icoOut  = Join-Path $build '_inst_ico.ico'
$logoOut = Join-Path $build '_inst_logo.png'
$masterIco = Join-Path $build '_inst_master.ico'
$uniIco  = Join-Path $build '_inst_uni.ico'
$makeIco = Join-Path $build '_makeicon.ps1'
$uniGz   = Join-Path $build 'qg.uninstaller.gz'

$outInst = Join-Path $dist ($SETUP + '.exe')
$outUni  = Join-Path $build ($UNINST + '.exe')
$tmpInst = Join-Path $build '_inst_tmp.exe'
$tmpUni  = Join-Path $build '_uni_tmp.exe'

# --- payload manifest. Index here == Entry id in Installer.cs == resource id.
#     Deliberately NOT shipped: <db>\qg_subjects.txt (user preference, preserved
#     across upgrades), any *.bak*, <app>.exe.WebView2\ (holds the API key),
#     anything under build\.
$spec = @(
    @{ rel = ($XUEXI + '.exe');                     res = 'qg.payload.0.gz' },
    @{ rel = 'Microsoft.Web.WebView2.Core.dll';     res = 'qg.payload.1.gz' },
    @{ rel = 'Microsoft.Web.WebView2.WinForms.dll'; res = 'qg.payload.2.gz' },
    @{ rel = 'WebView2Loader.dll';                  res = 'qg.payload.3.gz' },
    @{ rel = $MANUAL;                               res = 'qg.payload.4.gz' },
    @{ rel = ($DBDIR + '\qg_corpus.txt');           res = 'qg.payload.5.gz' }
)

# ============================================================================
#  step 0: sanity
# ============================================================================
foreach ($f in @($srcCs, $fpPath, $master, $makeIco)) {
    if (-not (Test-Path $f)) { Write-Output ('BUILD FAILED: missing ' + $f); exit 1 }
}
if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Force -Path $dist | Out-Null }

Write-Output 'payloads:'
$rawTotal = 0
$miss = 0
foreach ($e in $spec) {
    $p = Join-Path $deskTopDir $e.rel
    if (-not (Test-Path $p)) { Write-Output ('  MISSING ' + $p); $miss++ ; continue }
    $len = (Get-Item $p).Length
    $rawTotal += $len
    Write-Output ('  ' + $len.ToString().PadLeft(10) + '  ' + $e.rel)
}
if ($miss -gt 0) { Write-Output 'BUILD FAILED: payload missing'; exit 1 }
Write-Output ('  raw payload total = ' + $rawTotal)

# ============================================================================
#  step 1: icon + logo for the wizard.
#
#  Icon format, learned the hard way (_makeicon.ps1's -WebOnly mode emits
#  PNG-only entries, which is right for a page favicon and WRONG for an exe icon):
#    * Explorer/taskbar do read PNG entries, but System.Drawing.Icon on .NET
#      Framework cannot: new Icon(exe) throws ArgumentException ("the picture must
#      be usable as an Icon") against an all-PNG .ico. The project's master
#      favicon.ico uses 32bpp BMP entries for exactly this reason.
#    * So: BMP entries for 16/24/32/48 (every size Explorer and the shell ask the
#      installer to draw), a PNG entry for 64 (the wizard logo is downscaled from
#      it, so it must be crisp), plus 128/256 PNG for large thumbnails.
#  Rather than hand-roll BMP encoding again, reuse _makeicon.ps1 twice: -WebOnly
#  gives the small PNG set, default mode gives the full BMP master. The master's
#  128/256 BMP entries are then swapped for the small PNG ones, which keeps the
#  exe from growing by ~340 KB for nothing.
# ============================================================================
# Named arguments only: -makeicon.ps1 takes two [string] params, so a bare value
# list would bind "-WebOut" itself to $Out and leave $WebOut empty.
#
# Delete every artifact these steps are supposed to (re)create BEFORE calling the
# sub-script, and check $? right after the call: an `exit 1` inside a sub-script
# does not become an exception here, so without this a failed generator would
# silently leave the previous build's icon in place and the build would "succeed".
foreach ($stale in @($icoOut, $masterIco, $logoOut, $uniIco)) {
    if (Test-Path -LiteralPath $stale) { Remove-Item -LiteralPath $stale -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $stale) { Fail ('could not remove stale artifact ' + $stale) }
}
& $makeIco -WebOnly -WebOut $icoOut
if (-not $?) { Fail '_makeicon.ps1 -WebOnly returned an error' }
if (-not (Test-Path $icoOut) -or (Get-Item $icoOut).Length -lt 512) {
    Fail 'PNG icon generation produced nothing usable'
}
& $makeIco -Out $masterIco
if (-not $?) { Fail '_makeicon.ps1 (master) returned an error' }
if (-not (Test-Path $masterIco) -or (Get-Item $masterIco).Length -lt 4096) {
    Fail 'master icon generation produced nothing usable'
}

function Read-IcoEntries([string]$path) {
    $b = [System.IO.File]::ReadAllBytes($path)
    $n = [int]$b[4] + ([int]$b[5] -shl 8)
    $list = @()
    for ($k = 0; $k -lt $n; $k++) {
        $e = 6 + 16 * $k
        $w = [int]$b[$e]
        if ($w -eq 0) { $w = 256 }
        $len = [int][BitConverter]::ToUInt32($b, $e + 8)
        $off = [int][BitConverter]::ToUInt32($b, $e + 12)
        $data = New-Object byte[] $len
        [Array]::Copy($b, $off, $data, 0, $len)
        $isPng = ($len -gt 8 -and $data[0] -eq 0x89 -and $data[1] -eq 0x50)
        $list += @{ w = $w; data = $data; png = $isPng }
    }
    return , $list
}

$bmpSet = Read-IcoEntries $masterIco     # 16/24/32/48/64/128/256 all BMP
$pngSet = Read-IcoEntries $icoOut        # 16/32/48/64 all PNG

# 128/256 -> PNG copies (much smaller); every smaller size -> BMP entries
$chosen = @()
foreach ($e in $bmpSet) {
    if ($e.w -ge 128) {
        $rep = $pngSet | Where-Object { $_.w -eq $e.w } | Select-Object -First 1
        if ($rep) { $chosen += $rep } else { $chosen += $e }
    } else {
        $chosen += $e
    }
}
# 48 is the largest size the shell commonly draws from the exe; keep BMP (decodable
# by System.Drawing). 64 only feeds the wizard logo, so prefer its PNG copy.
$p64 = $pngSet | Where-Object { $_.w -eq 64 } | Select-Object -First 1
if ($p64) {
    $chosen = @($chosen | Where-Object { $_.w -ne 64 })
    $chosen += $p64
    $chosen = @($chosen | Sort-Object { $_["w"] })   # hashtables: sort by key
}

function Write-IcoFile([string]$path, $entries) {
    if (-not $entries -or $entries.Count -lt 1) { Fail ('icon set is empty for ' + $path) }
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$entries.Count)
    $off = 6 + 16 * $entries.Count
    foreach ($e in $entries) {
        $w = $e.w; if ($w -ge 256) { $w = 0 }
        $bw.Write([byte]$w); $bw.Write([byte]$w)
        $bw.Write([byte]0); $bw.Write([byte]0)
        $bw.Write([uint16]1); $bw.Write([uint16]32)
        $bw.Write([uint32]$e.data.Length)
        $bw.Write([uint32]$off)
        $off += $e.data.Length
    }
    foreach ($e in $entries) { $bw.Write($e.data, 0, $e.data.Length) }
    $bw.Flush()
    $want = $ms.ToArray()
    $bw.Dispose(); $ms.Dispose()
    try { [System.IO.File]::WriteAllBytes($path, $want) }
    catch { Fail ('could not write ' + $path + ' : ' + $_.Exception.Message) }
    if (-not (Test-Path -LiteralPath $path)) { Fail ('icon write produced no file: ' + $path) }
    $got = (Get-Item -LiteralPath $path).Length
    if ($got -ne $want.Length) { Fail ('icon write size mismatch (' + $want.Length + ' vs ' + $got + '): ' + $path) }
}

$bmpSet = Read-IcoEntries $masterIco     # 16/24/32/48/64/128/256 all BMP
$pngSet = Read-IcoEntries $icoOut        # 16/32/48/64 all PNG

# 128/256 -> PNG copies (much smaller); every smaller size -> BMP entries
$chosen = @()
foreach ($e in $bmpSet) {
    if ($e.w -ge 128) {
        $rep = $pngSet | Where-Object { $_.w -eq $e.w } | Select-Object -First 1
        if ($rep) { $chosen += $rep } else { $chosen += $e }
    } else {
        $chosen += $e
    }
}
# 48 is the largest size the shell commonly draws from the exe; keep BMP (decodable
# by System.Drawing). 64 only feeds the wizard logo, so prefer its PNG copy.
$p64 = $pngSet | Where-Object { $_.w -eq 64 } | Select-Object -First 1
if ($p64) {
    $chosen = @($chosen | Where-Object { $_.w -ne 64 })
    $chosen += $p64
    $chosen = @($chosen | Sort-Object { $_["w"] })   # hashtables: sort by key
}
Write-IcoFile $icoOut $chosen
$desc = ($chosen | ForEach-Object { $_.w.ToString() + $(if ($_.png) { 'p' } else { 'b' }) }) -join ' '
Write-Output ('installer icon = ' + (Get-Item $icoOut).Length + ' bytes, entries: ' + $desc)

# The wizard's logo must be a real *PNG* resource (not the .ico).
$best = $chosen | Where-Object { $_.png -and $_.w -eq 64 } | Select-Object -First 1
if (-not $best) { $best = $chosen | Where-Object { $_.png } | Sort-Object -Property w -Descending | Select-Object -First 1 }
if (-not $best) { Fail 'no PNG entry available for the wizard logo' }
try { [System.IO.File]::WriteAllBytes($logoOut, $best.data) }
catch { Fail ('could not write wizard logo ' + $logoOut + ' : ' + $_.Exception.Message) }
if (-not (Test-Path -LiteralPath $logoOut)) { Fail ('wizard logo write produced no file: ' + $logoOut) }
if ((Get-Item -LiteralPath $logoOut).Length -ne $best.data.Length) { Fail ('wizard logo size mismatch: ' + $logoOut) }
Write-Output ('installer logo = ' + $best.data.Length + ' bytes (PNG ' + $best.w + 'px)')

# A trimmed copy for the *uninstaller*: its window is a tiny icon + two buttons, so
# 16/32/48 is all it can ever display. Embedding the full set (357 KB) as the
# uninstaller's Win32 icon made that exe 416,256 bytes -- for pixels it can never draw.
$uniSet = @($chosen | Where-Object { $_.w -eq 16 -or $_.w -eq 32 -or $_.w -eq 48 })
Write-IcoFile $uniIco $uniSet
Write-Output ('uninstaller icon = ' + (Get-Item $uniIco).Length + ' bytes, entries: ' + (($uniSet | ForEach-Object { $_.w }) -join ' '))

# ============================================================================
#  step 2: GZip every payload into the build folder
#
#  The temp file name IS the embedded resource name: csc derives the manifest
#  resource id from the file name when /resource: has no ,name suffix. So the
#  file must be called exactly qg.payload.<n>.gz -- a leading underscore for
#  "temporary" would silently ship the resource as _qg.payload.<n>.gz and every
#  GetManifestResourceStream("qg.payload.0.gz") would then return null at install
#  time. These files live in build\, which is never packaged, so no underscore.
# ============================================================================
function Write-Gzip([string]$from, [string]$to) {
    if (-not (Test-Path -LiteralPath $from)) { Fail ('gzip source missing: ' + $from) }
    $srcLen = (Get-Item -LiteralPath $from).Length
    if ($srcLen -le 0) { Fail ('gzip source is empty: ' + $from) }
    if (Test-Path -LiteralPath $to) { Remove-Item -LiteralPath $to -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $to) { Fail ('could not remove stale ' + $to) }
    $written = 0
    try {
        $in = [System.IO.File]::OpenRead($from)
        $out = [System.IO.File]::Create($to)
        $zs = New-Object System.IO.Compression.GZipStream($out, [System.IO.Compression.CompressionMode]::Compress)
        try {
            $buf = New-Object byte[] 1048576
            while ($true) {
                $n = $in.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $zs.Write($buf, 0, $n)
            }
        } finally {
            $zs.Dispose()
            $out.Dispose()
            $in.Dispose()
        }
    } catch { Fail ('gzip failed: ' + $from + ' -> ' + $to + ' : ' + $_.Exception.Message) }
    # GZip stamps the current time into the header's MTIME field, so building twice from
    # identical input produced different bytes and the installer's SHA256 changed on
    # every run. The gzip spec allows MTIME=0 for "no timestamp"; zeroing it makes the
    # build byte-reproducible, so a rebuild only changes the exe when source changed.
    try {
        $raw = [System.IO.File]::ReadAllBytes($to)
        if ($raw.Length -gt 10 -and $raw[0] -eq 0x1F -and $raw[1] -eq 0x8B) {
            $raw[4] = 0; $raw[5] = 0; $raw[6] = 0; $raw[7] = 0
            [System.IO.File]::WriteAllBytes($to, $raw)
        }
    } catch { Fail ('gzip MTIME rewrite failed: ' + $to + ' : ' + $_.Exception.Message) }
    if (-not (Test-Path -LiteralPath $to)) { Fail ('gzip produced no file: ' + $to) }
    $written = (Get-Item -LiteralPath $to).Length
    if ($written -le 0) { Fail ('gzip produced an empty file: ' + $to) }
    # prove the trailer describes the file we meant to pack (not a stale source)
    $isize = Get-GzipIsize $to
    if ($isize -lt 0) { Fail ('gzip output has no valid header/trailer: ' + $to) }
    if ($isize -ne ($srcLen % 4294967296)) {
        Fail ('gzip ISIZE ' + $isize + ' != source length ' + $srcLen + ' for ' + $to)
    }
    return $written
}

$gzPaths = @()
$gzTotal = 0
foreach ($e in $spec) {
    $p = Join-Path $deskTopDir $e.rel
    $gz = Join-Path $build $e.res
    $gl = Write-Gzip $p $gz
    $gzTotal += $gl
    $gzPaths += $gz
    $pct = [int](100.0 * $gl / (Get-Item $p).Length)
    Write-Output ('  gz ' + $gl.ToString().PadLeft(9) + '  (' + $pct + '%)  ' + $e.rel)
}
if ($gzPaths.Count -ne $spec.Count) {
    Fail ('gz file count ' + $gzPaths.Count + ' != spec count ' + $spec.Count)
}
$gzBad = 0
foreach ($gz in $gzPaths) {
    if (-not (Test-Path -LiteralPath $gz)) { Write-Output ('  MISSING ' + $gz); $gzBad++; continue }
    if ((Get-Item -LiteralPath $gz).Length -le 0) { Write-Output ('  EMPTY ' + $gz); $gzBad++ }
}
if ($gzBad -gt 0) { Fail ($gzBad + ' gzip payload(s) missing or empty') }
Write-Output ('  gz total = ' + $gzTotal + '  (' + $gzPaths.Count + '/' + $spec.Count + ' files verified non-empty)')

# ============================================================================
#  step 3: regenerate the Entry[] table in Installer.cs between the PAYLOADS
#  markers so ids and resources are derived from one source of truth.
# ============================================================================
$txt = [System.IO.File]::ReadAllText($srcCs, [System.Text.Encoding]::UTF8)
$openM  = '//>>>PAYLOADS'
$closeM = '//<<<PAYLOADS'
$i1 = $txt.IndexOf($openM)
$i2 = $txt.IndexOf($closeM)
if ($i1 -lt 0 -or $i2 -lt 0 -or $i2 -lt $i1) {
    Write-Output 'BUILD FAILED: PAYLOADS markers not found in Installer.cs'; exit 1
}
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('//>>>PAYLOADS (generated: keep in sync with _build_installer.ps1 $spec)')
[void]$sb.Append("`r`n")
[void]$sb.Append('            Entry[] e = new Entry[' + $spec.Count + '];')
[void]$sb.Append("`r`n")
for ($i = 0; $i -lt $spec.Count; $i++) {
    $rel = [string]$spec[$i].rel
    # C# escaping depends on which literal form we emit: a verbatim @"..." string
    # keeps its backslashes as-is, a normal "..." string needs them doubled. Getting
    # this wrong silently produces <db>\\qg_corpus.txt -- a directory literally named
    # "<db>\" -- so the two branches must not share one escaping pass.
    if ($rel -match '^[A-Za-z0-9_.]+$') {
        $lit = '"' + $rel + '"'
    } else {
        $lit = '@"' + $rel + '"'
    }
    [void]$sb.Append('            e[' + $i + '] = new Entry(' + $i + ', ' + $lit + ', false);')
    [void]$sb.Append("`r`n")
}
[void]$sb.Append('            return e;')
[void]$sb.Append("`r`n            ")
$new = $txt.Substring(0, $i1) + $sb.ToString() + $txt.Substring($i2)
# trap 3: rewrite WITH BOM so old csc decodes the Chinese literals correctly
[System.IO.File]::WriteAllText($srcCs, $new, (New-Object System.Text.UTF8Encoding($true)))
Write-Output ('Installer.cs Entry[] regenerated (' + $spec.Count + ' payloads, UTF-8 BOM written)')

$chk = [System.IO.File]::ReadAllText($srcCs, [System.Text.Encoding]::UTF8)
if ($chk.IndexOf('new Entry[' + $spec.Count + ']') -lt 0) {
    Write-Output 'BUILD FAILED: Entry[] regeneration did not take'; exit 1
}
$bom = [System.IO.File]::ReadAllBytes($srcCs)
if (-not ($bom.Length -gt 3 -and $bom[0] -eq 0xEF -and $bom[1] -eq 0xBB -and $bom[2] -eq 0xBF)) {
    Write-Output 'BUILD FAILED: Installer.cs lost its UTF-8 BOM'; exit 1
}

# ============================================================================
#  step 4: compile
# ============================================================================
$common = @('/nologo', '/target:winexe', '/platform:anycpu',
            '/optimize+', '/warn:4',
            '/r:System.dll', '/r:System.Core.dll', '/r:System.Drawing.dll',
            '/r:System.Windows.Forms.dll')

# 4a. uninstaller FIRST: same source, /define:UNINSTALLER strips the whole wizard
#     and embeds no payload, so it is tiny. It then gets gzipped and embedded into
#     the installer (step 4c), which is what actually ships to the user.
#
#     /win32icon: uses the TRIMMED _inst_uni.ico (16/32/48, ~15 KB), not the full
#     _inst_ico.ico (~357 KB): the uninstaller window can never draw anything
#     bigger, and embedding the full set as its exe icon alone made that binary
#     416,256 bytes -- of which 357 KB was pixels nobody can see.
$a1 = '/out:' + $tmpUni
$a2 = '/win32icon:' + $uniIco
$a3 = '/resource:' + $fpPath + ',qg.fingerprint.txt'
$a4 = '/resource:' + $logoOut + ',qg.icon.png'
$a5 = '/resource:' + $uniIco + ',qg.icon.ico'
$a6 = '/define:UNINSTALLER'
$uArgs = $common + @($a1, $a2, $a3, $a4, $a5, $a6, $srcCs)
if (Test-Path -LiteralPath $tmpUni) { Remove-Item -LiteralPath $tmpUni -Force -ErrorAction SilentlyContinue }
& $csc @uArgs
if ($LASTEXITCODE -ne 0) { Fail ('csc failed for the uninstaller, exit ' + $LASTEXITCODE) }
if (-not (Test-Path -LiteralPath $tmpUni) -or (Get-Item -LiteralPath $tmpUni).Length -le 0) {
    Fail 'csc reported success but produced no uninstaller'
}
Copy-Checked $tmpUni $outUni
Write-Output ('uninstaller built = ' + (Get-Item -LiteralPath $outUni).Length + ' bytes')

# 4b. compress the uninstaller so the installer can carry it.
#     Pack the COMPILE OUTPUT, never the copy: if $outUni were locked, the copy
#     would be stale and the new installer would silently carry the previous
#     uninstaller.
$uniGzLen = Write-Gzip $tmpUni $uniGz
Write-Output ('uninstaller gz = ' + $uniGzLen + ' bytes')

# 4c. installer: payloads + uninstaller + icon + fingerprint
$b1 = '/out:' + $tmpInst
$b2 = '/win32icon:' + $icoOut
$b3 = '/resource:' + $fpPath + ',qg.fingerprint.txt'
$b4 = '/resource:' + $logoOut + ',qg.icon.png'
$b5 = '/resource:' + $icoOut + ',qg.icon.ico'
$b6 = '/resource:' + $uniGz + ',qg.uninstaller.gz'
$resAll = @()
foreach ($gz in $gzPaths) { $resAll += ('/resource:' + $gz) }
$iArgs = $common + @($b1, $b2, $b3, $b4, $b5, $b6) + $resAll + @($srcCs)
if (Test-Path -LiteralPath $tmpInst) { Remove-Item -LiteralPath $tmpInst -Force -ErrorAction SilentlyContinue }
& $csc @iArgs
if ($LASTEXITCODE -ne 0) { Fail ('csc failed for the installer, exit ' + $LASTEXITCODE) }
if (-not (Test-Path -LiteralPath $tmpInst) -or (Get-Item -LiteralPath $tmpInst).Length -le 0) {
    Fail 'csc reported success but produced no installer'
}

# trap 2: csc could not write to the Chinese dist path, so copy the products now.
# Verified copy: a locked dist exe used to leave the OLD file behind while the
# script carried on and printed a fresh-looking SHA256 of it.
Copy-Checked $tmpInst $outInst

# ============================================================================
#  step 5: verify the shipped exe really carries every resource.
#  /SELFTEST lists every embedded resource with its length; if any payload,
#  the uninstaller, the icon or the fingerprint is missing, this build is not
#  shippable -- the failure would otherwise only show up on a user's machine as
#  "installer is missing embedded resource qg.payload.N.gz".
# ============================================================================
$stPath = Join-Path $build '_selftest.txt'
if (Test-Path -LiteralPath $stPath) { Remove-Item -LiteralPath $stPath -Force -ErrorAction SilentlyContinue }
try {
    $stp = Start-Process -FilePath $outInst -ArgumentList @('/S', ('/SELFTEST=' + $stPath)) -Wait -PassThru -ErrorAction Stop
} catch {
    Fail ('could not run the selftest: ' + $_.Exception.Message)
}
if ($null -eq $stp) { Fail 'selftest produced no process handle' }
if ($stp.ExitCode -ne 0) { Fail ('selftest exit code ' + $stp.ExitCode) }
if (-not (Test-Path -LiteralPath $stPath)) { Fail ('selftest wrote no report at ' + $stPath) }

$resLen = @{}
foreach ($ln in [System.IO.File]::ReadAllLines($stPath, [System.Text.Encoding]::UTF8)) {
    if ($ln.StartsWith('Resource=')) {
        $rest = $ln.Substring(9)
        $sp = $rest.LastIndexOf(' ')
        if ($sp -gt 0) {
            $rname = $rest.Substring(0, $sp)
            $rlen = -1
            if ([int]::TryParse($rest.Substring($sp + 1), [ref]$rlen)) { $resLen[$rname] = $rlen }
        }
    }
}
if ($resLen.Count -le 0) { Fail 'selftest report lists no embedded resources' }
$wantRes = @('qg.uninstaller.gz', 'qg.icon.png', 'qg.icon.ico', 'qg.fingerprint.txt')
foreach ($e in $spec) { $wantRes += $e.res }
$resBad = 0
foreach ($w in $wantRes) {
    if (-not $resLen.ContainsKey($w)) { Write-Output ('  MISSING RESOURCE ' + $w); $resBad++; continue }
    if ($resLen[$w] -le 0) { Write-Output ('  EMPTY RESOURCE ' + $w); $resBad++ }
}
if ($resBad -gt 0) { Fail ($resBad + ' embedded resource(s) missing or empty in ' + $outInst) }
# the embedded uninstaller payload must be exactly what we just compressed
if ($resLen['qg.uninstaller.gz'] -ne (Get-Item -LiteralPath $uniGz).Length) {
    Fail ('embedded qg.uninstaller.gz is ' + $resLen['qg.uninstaller.gz'] + ' bytes, expected ' + (Get-Item -LiteralPath $uniGz).Length)
}
foreach ($e in $spec) {
    $gz = Join-Path $build $e.res
    if ($resLen[$e.res] -ne (Get-Item -LiteralPath $gz).Length) {
        Fail ('embedded ' + $e.res + ' is ' + $resLen[$e.res] + ' bytes, expected ' + (Get-Item -LiteralPath $gz).Length)
    }
}
Write-Output ('selftest: ' + $wantRes.Count + ' expected resources present, non-empty, sizes match the .gz files on disk')
Remove-Item -LiteralPath $stPath -Force -ErrorAction SilentlyContinue

# ============================================================================
#  step 6: report
# ============================================================================
$fi = Get-Item $outInst
$hi = Get-FileHash $outInst -Algorithm SHA256
$fu = Get-Item $outUni
$hu = Get-FileHash $outUni -Algorithm SHA256
Write-Output ''
Write-Output ('INSTALLER   = ' + $fi.FullName)
Write-Output ('INST BYTES  = ' + $fi.Length)
Write-Output ('INST SHA256 = ' + $hi.Hash)
Write-Output ('UNINST      = ' + $fu.FullName)
Write-Output ('UNINST BYTES= ' + $fu.Length)
Write-Output ('UNINST SHA256 = ' + $hu.Hash)
$iconSizes = 'installer ' + (Get-Item $icoOut).Length + ' b / uninstaller ' + (Get-Item $uniIco).Length
$iconSizes += ' b / logo ' + (Get-Item $logoOut).Length + ' b'
Write-Output ('ICONS       = ' + $iconSizes)
Write-Output ('COMPRESS  = raw ' + $rawTotal + ' -> gz ' + $gzTotal + ' (ratio ' + [math]::Round(100.0 * $gzTotal / $rawTotal, 1) + '%)')
Write-Output 'BUILD OK'
