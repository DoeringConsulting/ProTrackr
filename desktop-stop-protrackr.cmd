@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-restart.ps1" -Action Stop
echo.
pause
endlocal
