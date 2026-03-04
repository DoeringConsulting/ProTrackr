param(
  [ValidateSet("Start", "Stop", "Status", "Restart")]
  [string]$Action = "Status"
)

$ErrorActionPreference = "Stop"

$RepoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $RepoPath "logs"
$OutLog = Join-Path $LogDir "protrackr.out.log"
$ErrLog = Join-Path $LogDir "protrackr.err.log"

function Get-ProTrackrNodeProcesses {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -match "dist[\\/]+index\.js"
  }
}

function Ensure-BuildExists {
  $DistEntry = Join-Path $RepoPath "dist\index.js"
  if (Test-Path $DistEntry) {
    return
  }

  Write-Host "[ProTrackr] dist/index.js fehlt - starte Build..."
  Push-Location $RepoPath
  try {
    & pnpm build
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Start-ProTrackr {
  $running = Get-ProTrackrNodeProcesses
  if ($running) {
    Write-Host "[ProTrackr] Bereits aktiv. PIDs: $($running.ProcessId -join ', ')"
    return
  }

  if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
  }

  Ensure-BuildExists

  # Start node directly to enforce working directory and inherited environment.
  $env:NODE_ENV = "production"
  $nodePath = (Get-Command node -ErrorAction Stop).Source
  Start-Process `
    -FilePath $nodePath `
    -ArgumentList "dist/index.js" `
    -WorkingDirectory $RepoPath `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden | Out-Null

  Start-Sleep -Seconds 2
  $runningNow = Get-ProTrackrNodeProcesses
  if (-not $runningNow) {
    Write-Host "[ProTrackr] Start fehlgeschlagen. Siehe Logs:"
    Write-Host "  $OutLog"
    Write-Host "  $ErrLog"
    exit 1
  }

  Write-Host "[ProTrackr] Gestartet. PIDs: $($runningNow.ProcessId -join ', ')"
}

function Stop-ProTrackr {
  $running = Get-ProTrackrNodeProcesses
  if (-not $running) {
    Write-Host "[ProTrackr] Kein laufender Prozess gefunden."
    return
  }

  foreach ($proc in $running) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }

  Start-Sleep -Seconds 1
  $remaining = Get-ProTrackrNodeProcesses
  if ($remaining) {
    Write-Host "[ProTrackr] Konnte nicht alle Prozesse beenden: $($remaining.ProcessId -join ', ')"
    exit 1
  }

  Write-Host "[ProTrackr] Gestoppt."
}

function Show-ProTrackrStatus {
  $running = Get-ProTrackrNodeProcesses
  if (-not $running) {
    Write-Host "[ProTrackr] Status: INAKTIV"
    exit 1
  }

  Write-Host "[ProTrackr] Status: AKTIV"
  Write-Host "[ProTrackr] PIDs: $($running.ProcessId -join ', ')"

  try {
    $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
      $_.OwningProcess -in $running.ProcessId
    }

    if ($listeners) {
      foreach ($entry in $listeners | Sort-Object LocalPort -Unique) {
        Write-Host "[ProTrackr] Listener: http://localhost:$($entry.LocalPort)/"
      }
    }
  } catch {
    # NetTCP cmdlets are not mandatory for process status.
  }
}

switch ($Action) {
  "Start" { Start-ProTrackr }
  "Stop" { Stop-ProTrackr }
  "Status" { Show-ProTrackrStatus }
  "Restart" {
    Stop-ProTrackr
    Start-Sleep -Seconds 1
    Start-ProTrackr
  }
}
