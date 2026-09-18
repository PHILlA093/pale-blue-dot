param([string]$OutName = '')
$ErrorActionPreference = 'Stop'

# Self check: a non-ASCII byte in this file is decoded as ANSI by Windows PowerShell and
# silently swallows following lines (this once turned /win32icon: into a bare option).
# Fail loudly instead of building something subtly wrong.
foreach ($b in [System.IO.File]::ReadAllBytes($MyInvocation.MyCommand.Path)) {
    if ($b -gt 127) { Write-Output 'BUILD FAILED: _rebuild.ps1 must be ASCII-only'; exit 1 }
}

$root = 'E:\workspace\' + [string]([char]0x7A77 + [char]0x89C2)
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$build = Join-Path $root ([string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\build')
$tmpOut = Join-Path $build '_app_tmp.exe'
$exeName = $OutName
if (-not $exeName) { $exeName = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60) + '.exe' }
$out = Join-Path $root ([string]([char]0x684C + [char]0x9762 + [char]0x7248) + '\' + $exeName)
$a1 = '/out:' + $tmpOut
$a2 = '/r:' + (Join-Path $build 'Microsoft.Web.WebView2.Core.dll')
$a3 = '/r:' + (Join-Path $build 'Microsoft.Web.WebView2.WinForms.dll')
$a4 = '/resource:' + (Join-Path $root 'index.html') + ',web.index.html'
$a5 = '/resource:' + (Join-Path $root 'css\style.css') + ',web.css.style.css'
$a6 = '/resource:' + (Join-Path $root 'vendor\mathjax-tex-svg.js') + ',web.vendor.mathjax-tex-svg.js'
$a7 = '/resource:' + (Join-Path $root 'vendor\three.min.js') + ',web.vendor.three.min.js'
$a8 = '/resource:' + (Join-Path $root 'vendor\OrbitControls.js') + ',web.vendor.OrbitControls.js'
$a9 = '/resource:' + (Join-Path $root 'js\data.js') + ',web.js.data.js'
$a10 = '/resource:' + (Join-Path $root 'js\data_chem.js') + ',web.js.data_chem.js'
$a11 = '/resource:' + (Join-Path $root 'js\app.js') + ',web.js.app.js'
$a12 = '/resource:' + (Join-Path $root 'js\data-physics.js') + ',web.js.data-physics.js'
$a13 = '/resource:' + (Join-Path $root 'js\data_eng.js') + ',web.js.data_eng.js'
$a14 = '/resource:' + (Join-Path $root 'train.html') + ',web.train.html'
$a15 = '/resource:' + (Join-Path $root 'js\train.js') + ',web.js.train.js'
$a16 = '/resource:' + (Join-Path $root 'js\mainbridge.js') + ',web.js.mainbridge.js'
$a17 = '/resource:' + (Join-Path $root 'js\demo.js') + ',web.js.demo.js'
$a18 = '/resource:' + (Join-Path $root 'js\glcanvas.js') + ',web.js.glcanvas.js'
$a19 = '/resource:' + (Join-Path $root 'js\gltemplates.js') + ',web.js.gltemplates.js'
$a20 = '/resource:' + (Join-Path $root 'guanlan.html') + ',web.guanlan.html'
# One logo, two encodings. ../favicon.ico is the master (BMP entries, embedded with
# /win32icon: so Explorer and the shortcut have a real icon); the page copy served at
# /favicon.ico is regenerated into the build folder as a few-KB PNG-entry ico whose
# geometry comes from the same script -- embedding the 370 KB master twice would have
# added ~745 KB to the exe for nothing. The live window/taskbar icon is still drawn by
# Shared.BuildIcon(); all three share one geometry.
# NOTE: this file must stay ASCII-only -- non-ASCII bytes here get decoded as ANSI and
# silently swallow the following lines (that is how /win32icon: lost its filename once).
$ico = Join-Path $root 'favicon.ico'
$webIco = Join-Path $build '_web_icon.ico'
& (Join-Path $build '_makeicon.ps1') -WebOnly -WebOut $webIco
# Do not test $LASTEXITCODE here: it still holds the last *native* exit code (csc from a
# previous run), not the PowerShell child's. A failure in the child propagates anyway.
if (-not (Test-Path $webIco) -or (Get-Item $webIco).Length -lt 512) { Write-Output 'BUILD FAILED: favicon generation'; exit 1 }
$a21 = '/win32icon:' + $ico
$a22 = '/resource:' + $webIco + ',web.favicon.ico'
# biology is the fifth subject: without this resource the desktop build silently keeps
# serving the old four-subject data (index.html loads it, but the embedded copy wins).
$a23 = '/resource:' + (Join-Path $root 'js\data_bio.js') + ',web.js.data_bio.js'
$src = Join-Path $build 'Program.cs'
$args = @('/nologo', '/target:winexe', $a1, '/r:System.dll', '/r:System.Core.dll', '/r:System.Drawing.dll', '/r:System.Windows.Forms.dll', '/r:System.Web.Extensions.dll', $a2, $a3, $a4, $a5, $a6, $a7, $a8, $a9, $a10, $a11, $a12, $a13, $a14, $a15, $a16, $a17, $a18, $a19, $a20, $a21, $a22, $a23, $src)
& $csc @args
if ($LASTEXITCODE -ne 0) { Write-Output ('BUILD FAILED ' + $LASTEXITCODE); exit 1 }
Copy-Item -Path $tmpOut -Destination $out -Force
Write-Output 'BUILD OK'
