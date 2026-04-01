@echo off
setlocal
set "SCRIPT=%~dp0protrackr.ps1"
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" Start -Open
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
)
if errorlevel 1 if /i "%~1"=="Start" (
  echo [!] Fallback: Recovery...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" Recover -Open
)
endlocal
