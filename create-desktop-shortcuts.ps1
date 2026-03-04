param(
  [string]$RepoPath = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$ErrorActionPreference = "Stop"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shell = New-Object -ComObject WScript.Shell

$ShortcutDefinitions = @(
  @{ Name = "ProTrackr starten"; Target = "desktop-start-protrackr.cmd"; Icon = "$env:SystemRoot\System32\imageres.dll,174" },
  @{ Name = "ProTrackr Notfallstart"; Target = "desktop-notfallstart-protrackr.cmd"; Icon = "$env:SystemRoot\System32\imageres.dll,78" },
  @{ Name = "ProTrackr Status"; Target = "desktop-status-protrackr.cmd"; Icon = "$env:SystemRoot\System32\imageres.dll,22" },
  @{ Name = "ProTrackr stoppen"; Target = "desktop-stop-protrackr.cmd"; Icon = "$env:SystemRoot\System32\imageres.dll,131" },
  @{ Name = "ProTrackr Neustart"; Target = "desktop-neustart-protrackr.cmd"; Icon = "$env:SystemRoot\System32\imageres.dll,238" }
)

foreach ($Definition in $ShortcutDefinitions) {
  $TargetPath = Join-Path $RepoPath $Definition.Target
  if (-not (Test-Path $TargetPath)) {
    Write-Warning "Uebersprungen, Ziel fehlt: $TargetPath"
    continue
  }

  $ShortcutPath = Join-Path $DesktopPath ($Definition.Name + ".lnk")
  $Shortcut = $Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $TargetPath
  $Shortcut.WorkingDirectory = $RepoPath
  $Shortcut.IconLocation = $Definition.Icon
  $Shortcut.Save()
  Write-Host "[OK] $ShortcutPath"
}

Write-Host ""
Write-Host "Desktop-Verknuepfungen aktualisiert."
