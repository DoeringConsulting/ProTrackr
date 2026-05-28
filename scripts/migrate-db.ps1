# =============================================================================
# scripts/migrate-db.ps1
# =============================================================================
# Zweck:
#   Erzeugt einen konsistenten MySQL-Dump der ProTrackr-Datenbank auf dem
#   Notebook und legt ihn unter ./db-migration/protrackr-dump-YYYY-MM-DD.sql.gz
#   ab. Dient als Ausgangs-Datei fuer den Daten-Umzug auf den NAS.
#
# Voraussetzungen:
#   - PowerShell 7+ (pwsh)
#   - mysqldump.exe im PATH (typischerweise C:\Program Files\MySQL\... oder
#     ueber MariaDB Tools)
#   - .env im Projekt-Root mit DATABASE_URL gesetzt
#   - Notebook-MySQL-Server laeuft (oder zumindest erreichbar)
#
# Verwendung:
#   pwsh ./scripts/migrate-db.ps1
#   pwsh ./scripts/migrate-db.ps1 -SkipGzip
#   pwsh ./scripts/migrate-db.ps1 -OutDir D:\backups
#
# Sicherheit:
#   - Passwort wird aus DATABASE_URL gelesen und NICHT im Skript hartkodiert
#   - Dump-Datei sollte nach Uebertragung auf NAS sicher geloescht werden
# =============================================================================

[CmdletBinding()]
param(
  [string]$OutDir   = "./db-migration",
  [switch]$SkipGzip,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ProjectRoot ".env"
$Today = Get-Date -Format "yyyy-MM-dd"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ProTrackr DB-Dump Skript" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# 1. Voraussetzungen pruefen
# -----------------------------------------------------------------------------
Write-Host "[1/6] Voraussetzungen pruefen..." -ForegroundColor Yellow

if (-not (Test-Path $EnvPath)) {
  throw ".env nicht gefunden unter: $EnvPath"
}

$mysqldumpCmd = Get-Command mysqldump -ErrorAction SilentlyContinue
if (-not $mysqldumpCmd) {
  throw "mysqldump nicht im PATH gefunden. Installiere MySQL- oder MariaDB-Client und stelle sicher, dass mysqldump.exe erreichbar ist."
}
Write-Host "  mysqldump gefunden: $($mysqldumpCmd.Source)" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. DATABASE_URL aus .env parsen
# -----------------------------------------------------------------------------
Write-Host "[2/6] DATABASE_URL aus .env lesen..." -ForegroundColor Yellow

$envContent = Get-Content $EnvPath -Raw
$match = [regex]::Match($envContent, '(?m)^DATABASE_URL\s*=\s*(.+)$')
if (-not $match.Success) {
  throw "DATABASE_URL nicht in .env gefunden."
}
$dbUrl = $match.Groups[1].Value.Trim('"').Trim("'").Trim()

# DATABASE_URL Format: mysql://user:pass@host:port/dbname
$urlMatch = [regex]::Match($dbUrl, '^mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)$')
if (-not $urlMatch.Success) {
  throw "DATABASE_URL hat unerwartetes Format. Erwartet: mysql://user:pass@host:port/dbname"
}

$dbUser = $urlMatch.Groups[1].Value
$dbPass = $urlMatch.Groups[2].Value
$dbHost = $urlMatch.Groups[3].Value
$dbPort = $urlMatch.Groups[4].Value
$dbName = $urlMatch.Groups[5].Value

Write-Host "  Host:     $dbHost`:$dbPort"
Write-Host "  User:     $dbUser"
Write-Host "  Datenbank: $dbName"
Write-Host "  Passwort: (aus .env geladen, $($dbPass.Length) Zeichen)"

# -----------------------------------------------------------------------------
# 3. Output-Verzeichnis vorbereiten
# -----------------------------------------------------------------------------
Write-Host "[3/6] Output-Verzeichnis vorbereiten..." -ForegroundColor Yellow

if (-not [System.IO.Path]::IsPathRooted($OutDir)) {
  $OutDir = Join-Path $ProjectRoot $OutDir
}
if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
  Write-Host "  Verzeichnis angelegt: $OutDir" -ForegroundColor Green
} else {
  Write-Host "  Verzeichnis existiert: $OutDir" -ForegroundColor Green
}

$dumpFile = Join-Path $OutDir "protrackr-dump-$Timestamp.sql"
$gzFile   = "$dumpFile.gz"

# -----------------------------------------------------------------------------
# 4. Vorab-Check der Datenbank
# -----------------------------------------------------------------------------
Write-Host "[4/6] Vorab-Check der Datenbank..." -ForegroundColor Yellow

if ($DryRun) {
  Write-Host "  (Dry-Run: ueberspringe DB-Verbindung)" -ForegroundColor DarkGray
} else {
  $mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
  if ($mysqlCmd) {
    $tableCount = & mysql --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPass --database=$dbName --execute="SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema='$dbName';" --skip-column-names 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  Anzahl Tabellen in '$dbName': $tableCount" -ForegroundColor Green
    } else {
      Write-Warning "  Konnte Tabellen-Anzahl nicht ermitteln (mysql exit $LASTEXITCODE). Dump wird trotzdem versucht."
    }
  } else {
    Write-Host "  (mysql CLI nicht gefunden, ueberspringe Vorab-Check)" -ForegroundColor DarkGray
  }
}

# -----------------------------------------------------------------------------
# 5. mysqldump ausfuehren
# -----------------------------------------------------------------------------
Write-Host "[5/6] mysqldump ausfuehren..." -ForegroundColor Yellow
Write-Host "  Ziel: $dumpFile"

if ($DryRun) {
  Write-Host "  (Dry-Run: ueberspringe Dump)" -ForegroundColor DarkGray
} else {
  $dumpArgs = @(
    "--host=$dbHost",
    "--port=$dbPort",
    "--user=$dbUser",
    "--password=$dbPass",
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    "--events",
    "--default-character-set=utf8mb4",
    "--set-gtid-purged=OFF",
    "--column-statistics=0",
    $dbName
  )

  # mysqldump schreibt nach stdout, wir leiten in die Datei
  & mysqldump @dumpArgs 2>&1 | Out-File -FilePath $dumpFile -Encoding utf8
  if ($LASTEXITCODE -ne 0) {
    throw "mysqldump fehlgeschlagen mit Exit-Code $LASTEXITCODE"
  }

  $dumpSize = (Get-Item $dumpFile).Length
  Write-Host "  Dump erstellt: $dumpFile ($([math]::Round($dumpSize/1MB, 2)) MB)" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 6. Komprimieren (gzip)
# -----------------------------------------------------------------------------
Write-Host "[6/6] Komprimieren..." -ForegroundColor Yellow

if ($SkipGzip) {
  Write-Host "  (SkipGzip gesetzt, lasse Dump unkomprimiert)" -ForegroundColor DarkGray
  $finalFile = $dumpFile
} elseif ($DryRun) {
  Write-Host "  (Dry-Run: ueberspringe Komprimierung)" -ForegroundColor DarkGray
  $finalFile = $gzFile
} else {
  # PowerShell hat kein natives gzip; nutze .NET GZipStream
  $inputStream  = [System.IO.File]::OpenRead($dumpFile)
  $outputStream = [System.IO.File]::Create($gzFile)
  $gzipStream   = New-Object System.IO.Compression.GZipStream($outputStream, [System.IO.Compression.CompressionLevel]::Optimal)
  try {
    $inputStream.CopyTo($gzipStream)
  } finally {
    $gzipStream.Dispose()
    $outputStream.Dispose()
    $inputStream.Dispose()
  }

  $gzSize = (Get-Item $gzFile).Length
  Write-Host "  Komprimiert: $gzFile ($([math]::Round($gzSize/1MB, 2)) MB)" -ForegroundColor Green

  # Unkomprimierten Dump loeschen
  Remove-Item $dumpFile
  Write-Host "  Unkomprimierten Dump geloescht" -ForegroundColor DarkGray
  $finalFile = $gzFile
}

# -----------------------------------------------------------------------------
# Zusammenfassung
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FERTIG" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Datei: $finalFile" -ForegroundColor White
Write-Host ""
Write-Host "  Naechste Schritte:" -ForegroundColor Yellow
Write-Host "  1. Datei auf NAS uebertragen, z.B.:"
Write-Host "     scp `"$finalFile`" dcs01:/mnt/user/appdata/protrackr/db-migration/"
Write-Host "  2. Auf NAS importieren:"
Write-Host "     cd /mnt/user/appdata/protrackr"
Write-Host "     ./scripts/migrate-db.sh db-migration/$([System.IO.Path]::GetFileName($finalFile))"
Write-Host ""
Write-Host "  WICHTIG:" -ForegroundColor Yellow
Write-Host "  Diese Datei enthaelt alle Produktivdaten. Nach erfolgreichem"
Write-Host "  Import auf dem NAS: sicher loeschen!"
Write-Host ""
