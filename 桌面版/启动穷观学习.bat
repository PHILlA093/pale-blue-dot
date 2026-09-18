@echo off
rem ============================================================
rem  QiongGuan Study - launcher with a preflight check (application folder)
rem  Same rules as the launcher in the repository root: ASCII-only, and only
rem  commands that ship with Windows (cmd built-ins + reg.exe + findstr.exe).
rem ============================================================
setlocal enabledelayedexpansion
set "EXE="

if not exist "%~dp0WebView2Loader.dll" (
  echo.
  echo   [ERROR] This folder is missing the WebView2 runtime DLLs.
  echo   Keep all four of these files together:
  echo       ^<name^>.exe
  echo       Microsoft.Web.WebView2.Core.dll
  echo       Microsoft.Web.WebView2.WinForms.dll
  echo       WebView2Loader.dll
  echo.
  pause
  exit /b 1
)

for %%F in ("%~dp0*.exe") do set "EXE=%%~fF"
if not defined EXE (
  echo.
  echo   [ERROR] No .exe found in this folder.
  echo.
  pause
  exit /b 1
)

set "REL="
for /f "tokens=3" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release 2^>nul ^| findstr /i "Release"') do set "REL=%%A"

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
  echo   [WARNING] .NET Framework 4.5+ was not detected. Windows 11 includes it;
  echo   on Windows 10 install .NET Framework 4.8:
  echo       https://dotnet.microsoft.com/download/dotnet-framework/net48
)
if not defined WV (
  set "WARN=1"
  echo.
  echo   [WARNING] The Microsoft Edge WebView2 Runtime was not detected. Windows 11
  echo   includes it; otherwise update Microsoft Edge or install the Evergreen Runtime:
  echo       https://developer.microsoft.com/microsoft-edge/webview2/
)
if defined WARN (
  echo.
  echo   The application will still be started, but it may show an error.
  echo.
  pause
)

start "" "%EXE%"
exit /b 0
