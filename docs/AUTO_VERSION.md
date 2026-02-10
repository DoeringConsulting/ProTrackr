# Automatisches Versions-Management

## Übersicht

Das Versions-Management ist jetzt teilweise automatisiert. Bei jedem Checkpoint wird die Version automatisch erhöht.

## Workflow

### Option 1: Manuell vor Checkpoint (empfohlen für Kontrolle)

```bash
pnpm prepare-checkpoint
```

Dies führt aus:
1. `pnpm version:increment` - erhöht Version (z.B. 1.0.2 → 1.0.3)
2. Aktualisiert alle Versions-Dateien
3. Zeigt Bestätigung an

Dann erstellen Sie den Checkpoint wie gewohnt.

### Option 2: Nur Version erhöhen (ohne Checkpoint)

```bash
pnpm version:increment
```

### Option 3: Vollautomatisch (über Manus AI)

Sagen Sie einfach:
- "Erstelle einen Checkpoint" → Manus führt automatisch `prepare-checkpoint` aus
- "Speichere die Änderungen" → Manus führt automatisch `prepare-checkpoint` aus

## Was wird aktualisiert?

Bei jedem `version:increment` werden folgende Dateien automatisch aktualisiert:

1. **client/src/hooks/useUpdateCheck.ts** - APP_VERSION Konstante
2. **client/index.html** - Version-Kommentar im HTML
3. **client/src/components/VersionFooter.tsx** - APP_VERSION Konstante
4. **CHANGELOG.json** - Neuer Versions-Eintrag
5. **client/public/CHANGELOG.json** - Kopie für Frontend-Zugriff

## Changelog pflegen

Nach `version:increment` sollten Sie `CHANGELOG.json` mit konkreten Änderungen aktualisieren:

```json
{
  "version": "1.0.3",
  "date": "2026-02-10",
  "changes": {
    "features": [
      "Mobile-Zeiterfassung mit Icon-Badges optimiert"
    ],
    "improvements": [
      "Automatisches Update-System implementiert"
    ],
    "bugfixes": [
      "Version-Anzeige in Fußzeile korrigiert"
    ]
  }
}
```

## Versions-Schema

Wir verwenden **Semantic Versioning** (MAJOR.MINOR.PATCH):

- **MAJOR** (1.x.x): Breaking Changes, große Umstrukturierungen
- **MINOR** (x.1.x): Neue Features, keine Breaking Changes
- **PATCH** (x.x.1): Bugfixes, kleine Verbesserungen

Das Script erhöht automatisch die PATCH-Version. Für MAJOR/MINOR-Updates passen Sie die Version manuell in `useUpdateCheck.ts` an.

## Troubleshooting

### Version wird im Browser nicht aktualisiert

**Problem:** Dev-Server zeigt alte Version aufgrund von Vite HMR Cache

**Lösung:**
1. Hard Refresh: `Cmd+Shift+R` (Mac) oder `Ctrl+Shift+F5` (Windows)
2. Oder: Dev-Server neu starten
3. Oder: App veröffentlichen (Production-Build hat keine Cache-Probleme)

### Script schlägt fehl

**Problem:** `pnpm version:increment` gibt Fehler

**Lösung:**
1. Prüfen Sie, ob `scripts/increment-version.mjs` existiert
2. Prüfen Sie Schreibrechte auf die Dateien
3. Führen Sie `pnpm install` aus um Dependencies zu aktualisieren
