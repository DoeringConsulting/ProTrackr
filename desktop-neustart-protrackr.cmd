@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-restart.ps1" -Action Restart
if errorlevel 1 (
  echo [ProTrackr] Neustart fehlgeschlagen, versuche Notfallstart...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-recovery.ps1"
)
echo.
pause
endlocal
