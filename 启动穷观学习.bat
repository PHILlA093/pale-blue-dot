@echo off
rem ============================================================
rem  QiongGuan Study - launcher with a preflight check (repo root)
rem
rem  ASCII-only on purpose. A .bat holding non-ASCII text breaks as soon as
rem  the console code page differs (cmd then splits lines in the middle);
rem  and a .bat must not rely on anything that is not part of Windows itself,
rem  so only cmd built-ins plus reg.exe / findstr.exe are used here.
rem
rem  It looks for the application folder by its WebView2 runtime DLL instead of
rem  hard-coding a path, then checks the two runtimes the app needs. A failed
rem  check prints guidance but still tries to launch -- never refuse to start.
rem ============================================================
setlocal enabledelayedexpansion
set "EXE="

rem ---------- 1) locate the application folder ----------
for /d %%D in ("%~dp0*") do (
  if exist "%%D\WebView2Loader.dll" (
    for %%F in ("%%D\*.exe") do set "EXE=%%~fF"
  )
)

if not defined EXE (
  echo.
  echo   [ERROR] Application not found.
  echo.
  echo   This launcher must sit next to the application folder, and that
  echo   folder must contain all four of these files:
  echo       ^<name^>.exe
  echo       Microsoft.Web.WebView2.Core.dll
  echo       Microsoft.Web.WebView2.WinForms.dll
  echo       WebView2Loader.dll
  echo.
  pause
  exit /b 1
)

rem ---------- 2) .NET Framework 4.5 or newer (needed by the .exe) ----------
set "REL="
for /f "tokens=3" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release 2^>nul ^| findstr /i "Release"') do set "REL=%%A"

rem ---------- 3) WebView2 runtime (needed to draw the UI) ----------
set "WV="
for %%K in (
  "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  "HKCU\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
) do (
  for /f "tokens=3" %%V in ('reg query %%K /v pv 2^>nul ^| findstr /i "pv"') do set "WV=%%V"
)

set "WARN="
if not defined REL (
  set "WARN=1"
  echo.
  echo   [WARNING] .NET Framework 4.5+ was not detected.
  echo   Windows 11 already includes it. On Windows 10, install .NET Framework 4.8:
  echo       https://dotnet.microsoft.com/download/dotnet-framework/net48
)
if not defined WV (
  set "WARN=1"
  echo.
  echo   [WARNING] The Microsoft Edge WebView2 Runtime was not detected.
  echo   Windows 11 already includes it. If it is missing, update Microsoft Edge
  echo   or install the Evergreen Runtime:
  echo       https://developer.microsoft.com/microsoft-edge/webview2/
)
if defined WARN (
  echo.
  echo   The application will still be started, but it may show an error.
  echo   Details: see the README file, section "Quick start".
  echo.
  pause
)

start "" "%EXE%"
exit /b 0
