#!/usr/bin/env pwsh
# =============================================================================
# scripts/rollout-to-nas.ps1
# =============================================================================
# NAS-agnostischer Git-Helfer für den nas-rollout-Skill: merged den im Manifest
# gepinnten main-Commit sicher in nas-setup. Löst NUR Versionsdatei-Konflikte
# automatisch auf (zu main / --theirs) und BRICHT bei App-Konflikten AB.
#
#   Trockenlauf: pwsh ./scripts/rollout-to-nas.ps1 -ManifestPath .claude/rollouts/2.1.1.json
#   Ausführen:   pwsh ./scripts/rollout-to-nas.ps1 -ManifestPath .claude/rollouts/2.1.1.json -Execute
#
# Docker-Build, DB-Backup/Migrate, Health-Gate und Rollback macht der Skill
# (.claude/skills/nas-rollout), NICHT dieses Skript. Nur im NAS-Setup-Chat nutzen.
# =============================================================================
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ManifestPath,
  [switch]$Execute
)
$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  $out = & git @GitArgs 2>&1
  return [pscustomobject]@{ Code = $LASTEXITCODE; Out = ($out -join "`n").Trim() }
}
function Fail([string]$msg) { Write-Error $msg; exit 1 }

# Versionsdateien, die der Auto-Version-Hook bewegt → kollidieren bei jedem Merge.
$VersionFiles = @(
  "package.json", "CHANGELOG.json", "client/public/CHANGELOG.json",
  "client/public/version.json", "client/src/hooks/useUpdateCheck.ts",
  "client/src/components/VersionFooter.tsx", "client/index.html"
)

if (-not (Test-Path $ManifestPath)) { Fail "Manifest nicht gefunden: $ManifestPath" }
$m = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$commit  = $m.source.commit
$target  = $m.target.branch
$version = $m.version
if (-not $commit -or -not $target) { Fail "Manifest unvollständig (source.commit / target.branch)." }

Write-Host "== NAS-Rollout Git-Merge ==" -ForegroundColor Cyan
Write-Host "  Version : $version"
Write-Host "  Quelle  : $($m.source.shortCommit) ($commit)"
Write-Host "  Ziel    : $target`n"

# ---- Preflight ----
Invoke-Git fetch origin | Out-Null
if ((Invoke-Git cat-file -e "$commit^{commit}").Code -ne 0) { Fail "Quell-Commit $commit lokal nicht vorhanden (git fetch nötig?)." }

$branch = (Invoke-Git rev-parse --abbrev-ref HEAD).Out
if ($branch -ne $target) { Fail "Aktueller Branch ist '$branch', erwartet '$target'. Bitte erst: git checkout $target" }

$dirty = (Invoke-Git status --porcelain).Out
if ($dirty) { Fail "Working Tree nicht sauber:`n$dirty" }

$preMerge = (Invoke-Git rev-parse HEAD).Out
Write-Host "  Pre-Merge-SHA (Rollback-Punkt): $preMerge" -ForegroundColor Yellow

# ---- Vorschau ----
Write-Host "`n-- Neue Commits ($target..$($m.source.shortCommit)) --"
Write-Host (Invoke-Git log --oneline "$target..$commit").Out
Write-Host "`n-- Geänderte Dateien --"
Write-Host (Invoke-Git diff --stat "$target...$commit").Out

if (-not $Execute) {
  Write-Host "`nTROCKENLAUF — nichts verändert. Mit -Execute ausführen." -ForegroundColor Green
  exit 0
}

# ---- Merge ----
Write-Host "`n== Merge wird ausgeführt ==" -ForegroundColor Cyan
$merge = Invoke-Git merge --no-ff $commit -m "rollout: main $version ($($m.source.shortCommit)) -> $target"
if ($merge.Code -eq 0) {
  Write-Host "Merge sauber (keine Konflikte)." -ForegroundColor Green
} else {
  $conflicts = ((Invoke-Git diff --name-only --diff-filter=U).Out -split "`n") | Where-Object { $_ }
  $nonVersion = $conflicts | Where-Object { $VersionFiles -notcontains $_ }
  if ($nonVersion.Count -gt 0) {
    Invoke-Git merge --abort | Out-Null
    Fail ("App-Konflikte (NICHT auto-lösbar) — Merge abgebrochen. Bitte im Main-Chat klären:`n" + ($nonVersion -join "`n"))
  }
  foreach ($f in $conflicts) {
    Invoke-Git checkout --theirs -- $f | Out-Null
    Invoke-Git add -- $f | Out-Null
    Write-Host "  Versionskonflikt zu main aufgelöst: $f"
  }
  if ((Invoke-Git commit --no-edit).Code -ne 0) { Invoke-Git merge --abort | Out-Null; Fail "Merge-Commit fehlgeschlagen." }
  Write-Host "Merge nach Auflösung der Versionskonflikte abgeschlossen." -ForegroundColor Green
}

$postMerge = (Invoke-Git rev-parse HEAD).Out
Write-Host "`nPRE_MERGE_SHA=$preMerge"
Write-Host "POST_MERGE_SHA=$postMerge"
Write-Host "`nGit-Teil fertig. NICHT gepusht — der Skill fährt mit Backup/Migrate/Deploy fort und pusht erst nach bestandenem Health-Gate." -ForegroundColor Green
