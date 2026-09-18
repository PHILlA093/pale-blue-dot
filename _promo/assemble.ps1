param(
    [string]$Frames = 'E:\qg_promo\frames',
    [string]$Music  = 'E:\qg_promo\music.wav',
    [string]$Work   = 'E:\qg_promo\out',
    [string]$Name   = '',
    [int]$Crf = 17,
    [switch]$SkipVideo,
    [switch]$NoCopy
)
$ErrorActionPreference = 'Stop'

# Windows PowerShell decodes non-ASCII bytes in a .ps1 as ANSI and silently swallows the
# following lines -- fail loudly instead.
foreach ($b in [System.IO.File]::ReadAllBytes($MyInvocation.MyCommand.Path)) {
    if ($b -gt 127) { Write-Output 'FAILED: assemble.ps1 must be ASCII-only'; exit 1 }
}

$ff = Join-Path $env:TEMP 'qg_video_tools\node_modules\ffmpeg-static\ffmpeg.exe'
if (-not (Test-Path $ff)) { Write-Output ('FAILED: ffmpeg not found: ' + $ff); exit 1 }
$fp = Join-Path $env:TEMP 'qg_video_tools\node_modules\ffprobe-static\bin\win32\x64\ffprobe.exe'
New-Item -ItemType Directory -Force -Path $Work | Out-Null

$seq = Join-Path $Frames 'f%05d.png'
$first = Join-Path $Frames 'f00000.png'
if (-not (Test-Path $first)) { Write-Output ('FAILED: no frames in ' + $Frames); exit 1 }
$count = (Get-ChildItem $Frames -Filter 'f*.png').Count
Write-Output ('frames found: ' + $count)

$video = Join-Path $Work 'video.mp4'
$final = Join-Path $Work 'final.mp4'

Write-Output '--- [1/3] PNG sequence -> H.264 60fps ---'
if ($SkipVideo -and (Test-Path $video)) {
    # Reuse the encoded video when only the soundtrack changed: the frames did not
    # move, so re-encoding 2700 frames would be wasted work.
    Write-Output ('reusing existing ' + $video)
} else {
    & $ff -hide_banner -loglevel warning -y -framerate 60 -i $seq -c:v libx264 -preset slow -crf $Crf -pix_fmt yuv420p -r 60 -movflags +faststart $video
    if ($LASTEXITCODE -ne 0) { Write-Output 'FAILED: video encode'; exit 1 }
}

Write-Output '--- [2/3] mux audio ---'
if (Test-Path $Music) {
    Write-Output ('music: ' + $Music)
    # -loglevel error: ffmpeg warnings like "Guessed Channel Layout" go to stderr and
    # Windows PowerShell 5.1 turns them into a NativeCommandError that pollutes the exit code
    & $ff -hide_banner -loglevel error -y -i $video -i $Music -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart $final
} else {
    Write-Output 'music: (none, writing a silent track)'
    & $ff -hide_banner -loglevel error -y -i $video -f lavfi -i 'anullsrc=channel_layout=stereo:sample_rate=48000' -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart $final
}
if ($LASTEXITCODE -ne 0) { Write-Output 'FAILED: mux'; exit 1 }

if (Test-Path $fp) {
    Write-Output '--- verify ---'
    & $fp -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames -show_entries format=duration,size -of default=noprint_wrappers=1 $final
}

if (-not $NoCopy) {
    Write-Output '--- [3/3] deliver to desktop ---'
    $desk = [Environment]::GetFolderPath('Desktop')
    if (-not $Name) {
        # default file name (ASCII-only source: build the Chinese name from char codes)
        $Name = [string]([char]0x7A77 + [char]0x89C2 + [char]0x5B66 + [char]0x4E60) + '_' +
                [string]([char]0x5BA3 + [char]0x4F20 + [char]0x7247) + '_90' +
                [string]([char]0x79D2) + '_1080p60.mp4'
    }
    $dest = Join-Path $desk $Name
    Copy-Item -LiteralPath $final -Destination $dest -Force
    $mb = [math]::Round((Get-Item $dest).Length / 1MB, 1)
    Write-Output ('DELIVERED ' + $dest + '  (' + $mb + ' MB)')
}
Write-Output 'ASSEMBLE OK'
