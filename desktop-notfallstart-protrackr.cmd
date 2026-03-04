@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-recovery.ps1"
echo.
pause
endlocal
