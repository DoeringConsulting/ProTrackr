param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$RestartScript = Join-Path $RepoPath "protrackr-restart.ps1"

if (-not (Test-Path $RestartScript)) {
  throw "protrackr-restart.ps1 nicht gefunden unter $RestartScript"
}

Write-Host "[ProTrackr] Notfallstart: stoppe laufende Prozesse..."
& $RestartScript -Action Stop

if (-not $SkipBuild) {
  Write-Host "[ProTrackr] Notfallstart: fuehre Build aus..."
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

Write-Host "[ProTrackr] Notfallstart: starte App neu..."
& $RestartScript -Action Start
& $RestartScript -Action Status
