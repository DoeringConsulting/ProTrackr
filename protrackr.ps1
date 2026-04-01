# ProTrackr Service Manager
# Usage: protrackr.ps1 [-Action] <Start|Stop|Status|Restart|Recover|Watchdog>
param(
  [Parameter(Position = 0)]
  [ValidateSet("Start", "Stop", "Status", "Restart", "Recover", "Watchdog")]
  [string]$Action = "Status"
)

$ErrorActionPreference = "Stop"
$RepoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $RepoPath "logs"
$OutLog = Join-Path $LogDir "protrackr.out.log"
$ErrLog = Join-Path $LogDir "protrackr.err.log"

function Get-NodePath {
  $node = Get-Command "node" -ErrorAction SilentlyContinue
  if ($node -and (Test-Path $node.Source)) { return $node.Source }
  $fallbacks = @(
    "C:\Program Files\nodejs\node.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe")
  )
  foreach ($p in $fallbacks) { if (Test-Path $p) { return $p } }
  throw "node.exe nicht gefunden. Bitte Node.js installieren."
}

function Get-ProTrackrProcesses {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -match "dist[\\/]+index\.js"
  }
}

function Write-Status {
  param([string]$Msg, [string]$Level = "Info")
  $prefix = switch ($Level) {
    "OK"    { "[+]" }
    "Warn"  { "[!]" }
    "Error" { "[X]" }
    default { "[*]" }
  }
  Write-Host "$prefix $Msg"
}

function Invoke-Build {
  Write-Status "Build wird erstellt..."
  Push-Location $RepoPath
  try {
    $npm = (Get-Command "npm" -ErrorAction SilentlyContinue).Source
    if (-not $npm) { $npm = Join-Path (Split-Path (Get-NodePath)) "npm.cmd" }
    & $npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build fehlgeschlagen (Exit $LASTEXITCODE)" }
    Write-Status "Build erfolgreich" "OK"
  } finally { Pop-Location }
}

function Start-ProTrackr {
  $running = Get-ProTrackrProcesses
  if ($running) {
    Write-Status "Bereits aktiv (PID: $($running.ProcessId -join ', '))" "Warn"
    return
  }

  $distEntry = Join-Path $RepoPath "dist\index.js"
  if (-not (Test-Path $distEntry)) { Invoke-Build }
  if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

  $env:NODE_ENV = "production"
  Start-Process `
    -FilePath (Get-NodePath) `
    -ArgumentList "dist/index.js" `
    -WorkingDirectory $RepoPath `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden | Out-Null

  Start-Sleep -Seconds 2
  $started = Get-ProTrackrProcesses
  if (-not $started) {
    Write-Status "Start fehlgeschlagen. Logs: $OutLog / $ErrLog" "Error"
    exit 1
  }
  Write-Status "Gestartet (PID: $($started.ProcessId -join ', '))" "OK"
  Show-Listeners $started
}

function Stop-ProTrackr {
  $running = Get-ProTrackrProcesses
  if (-not $running) {
    Write-Status "Kein laufender Prozess" "Warn"
    return
  }
  foreach ($proc in $running) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
  if (Get-ProTrackrProcesses) {
    Write-Status "Prozess konnte nicht beendet werden" "Error"
    exit 1
  }
  Write-Status "Gestoppt" "OK"
}

function Show-Listeners($procs) {
  try {
    $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -in $procs.ProcessId }
    foreach ($l in ($listeners | Sort-Object LocalPort -Unique)) {
      Write-Status "http://localhost:$($l.LocalPort)/" "OK"
    }
  } catch {}
}

function Show-Status {
  $running = Get-ProTrackrProcesses
  if (-not $running) {
    Write-Status "INAKTIV" "Warn"
    exit 1
  }
  Write-Status "AKTIV (PID: $($running.ProcessId -join ', '))" "OK"
  Show-Listeners $running
}

function Invoke-Recover {
  Write-Status "Recovery: stoppe laufende Prozesse..."
  Stop-ProTrackr
  Invoke-Build
  Write-Status "Recovery: starte neu..."
  Start-ProTrackr
}

function Invoke-Watchdog {
  $running = Get-ProTrackrProcesses
  if (-not $running) { Start-ProTrackr }
}

switch ($Action) {
  "Start"    { Start-ProTrackr }
  "Stop"     { Stop-ProTrackr }
  "Status"   { Show-Status }
  "Restart"  { Stop-ProTrackr; Start-Sleep 1; Start-ProTrackr }
  "Recover"  { Invoke-Recover }
  "Watchdog" { Invoke-Watchdog }
}
