@echo off
rem ============================================================
rem  QiongGuan Mobile - one-click launcher (PURE ASCII ONLY!)
rem  Do NOT put Chinese characters in this file: cmd.exe parses
rem  .bat in the OEM codepage and mangled bytes break the script.
rem ============================================================
setlocal enabledelayedexpansion
title QiongGuan Mobile Server
cd /d "%~dp0"

set "PORT=8080"
if not "%~1"=="" set "PORT=%~1"

echo.
echo  ============================================================
echo    QiongGuan Mobile  /  local server launcher
echo  ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js was not found in PATH.
  echo          Install Node.js 18 or newer, then run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set "NODEVER=%%v"
echo  Node.js: %NODEVER%
echo  Folder : %CD%
echo  Port   : %PORT%
echo.

rem ---------- find the LAN IPv4 address with ipconfig ----------
set "LANIP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r /c:"IPv4"') do (
  if not defined LANIP (
    set "TMPIP=%%a"
    set "TMPIP=!TMPIP: =!"
    if not "!TMPIP!"=="" set "LANIP=!TMPIP!"
  )
)

echo  ============================================================
echo    STEP 1 - ON YOUR PHONE (same Wi-Fi as this PC)
echo  ============================================================
echo.
if defined LANIP (
  echo      Open this address in the phone browser:
  echo.
  echo          http://!LANIP!:%PORT%/
  echo.
  echo      ^(Phone and PC must be connected to the SAME Wi-Fi.^)
) else (
  echo      [WARN] No LAN IPv4 address was detected by ipconfig.
  echo             Connect this PC to Wi-Fi / a network cable first,
  echo             then run:  ipconfig     and look for "IPv4".
)
echo.
echo  ============================================================
echo    STEP 2 - ON THIS PC
echo  ============================================================
echo      A browser window will open at http://127.0.0.1:%PORT%/
echo      for local self-testing.
echo.
echo  ============================================================
echo    NOTES
echo  ============================================================
echo      * DeepSeek API Key is typed in the web page and kept in the
echo        phone's localStorage only. This server never stores it.
echo      * If Windows Firewall asks, ALLOW access on PRIVATE networks,
echo        otherwise the phone cannot reach this PC.
echo      * Press Ctrl+C in this window to stop the server.
echo  ============================================================
echo.

start "" http://127.0.0.1:%PORT%/

rem The third argument "lan" tells server.js to listen on all adapters, which is what
rem a phone on the same Wi-Fi needs. Without it the server only listens on 127.0.0.1.
node server.js %PORT% lan

echo.
echo  Server stopped.
pause
