@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0protrackr.ps1" %*
if errorlevel 1 if "%~1"=="Start" (
  echo [!] Fallback: Recovery...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0protrackr.ps1" Recover
)
