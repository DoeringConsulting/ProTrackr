param(
  [string]$RepoPath = "C:\Projects\ProTrackr_developing_path"
)

$ErrorActionPreference = "Stop"

$FreezeHash = "28f7093e360fd3c6ae2034ca2b7a29ef5e67fa85"
$Branch = "cursor/app-leistung-hostinger-954a"

Write-Host "[Freeze-Restore] Repo: $RepoPath"
Set-Location $RepoPath

git fetch origin $Branch
git checkout $Branch
git reset --hard $FreezeHash
git clean -fd

pnpm install
pnpm build

if (Test-Path ".\desktop-neustart-protrackr.cmd") {
  .\desktop-neustart-protrackr.cmd
}
if (Test-Path ".\desktop-status-protrackr.cmd") {
  .\desktop-status-protrackr.cmd
}

Write-Host "[Freeze-Restore] Erfolgreich auf Version 1.0.81 zurückgesetzt."
