@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-restart.ps1" -Action Start
if errorlevel 1 (
  echo [ProTrackr] Start fehlgeschlagen, versuche Notfallstart...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-recovery.ps1" -SkipBuild
)
endlocal
