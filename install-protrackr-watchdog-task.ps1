param(
  [string]$TaskPrefix = "ProTrackr",
  [int]$EveryMinutes = 5
)

$ErrorActionPreference = "Stop"

if ($EveryMinutes -lt 1) {
  throw "EveryMinutes muss >= 1 sein."
}

$RepoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$WatchdogCmd = Join-Path $RepoPath "watchdog-protrackr.cmd"

if (-not (Test-Path $WatchdogCmd)) {
  throw "watchdog-protrackr.cmd wurde nicht gefunden: $WatchdogCmd"
}

$TaskLogon = "$TaskPrefix-Watchdog-Logon"
$TaskInterval = "$TaskPrefix-Watchdog-Interval"

Write-Host "[ProTrackr] Installiere geplante Tasks..."

# Beim Benutzer-Login starten
schtasks /Create /TN $TaskLogon /TR "`"$WatchdogCmd`"" /SC ONLOGON /F | Out-Null

# Alle X Minuten pruefen und ggf. neu starten
schtasks /Create /TN $TaskInterval /TR "`"$WatchdogCmd`"" /SC MINUTE /MO $EveryMinutes /F | Out-Null

Write-Host "[ProTrackr] Tasks angelegt:"
Write-Host "  - $TaskLogon"
Write-Host "  - $TaskInterval"
Write-Host "[ProTrackr] Starte Watchdog einmalig sofort..."

& $WatchdogCmd

Write-Host "[ProTrackr] Fertig. Die App wird nun resilient ueber den Task Scheduler ueberwacht."
