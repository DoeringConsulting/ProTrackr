@echo off
setlocal
set "ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-restart.ps1" -Action Status >nul 2>nul
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-restart.ps1" -Action Start
  if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%protrackr-recovery.ps1" -SkipBuild >nul 2>nul
  )
)

endlocal
