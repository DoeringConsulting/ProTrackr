# Automatisches Update-System

## Übersicht

Die App verfügt über ein automatisches Update-System, das neue Versionen erkennt und den Browser-Cache automatisch löscht.

## Komponenten

### 1. Version-Check Hook (`useUpdateCheck.ts`)

**Funktionsweise:**
- Prüft alle 60 Sekunden, ob eine neue Version verfügbar ist
- Vergleicht die Version im HTML-Kommentar mit der lokalen Version
- Löst automatischen Reload aus, wenn neue Version erkannt wird

**Version-Konstante:**
```typescript
const APP_VERSION = '1.0.1'; // In useUpdateCheck.ts
```

### 2. HTML-Version-Marker (`index.html`)

```html
<!-- APP_VERSION: 1.0.1 -->
```

Dieser Kommentar wird vom Update-Check gelesen.

### 3. Cache-Clearing

Bei erkanntem Update:
1. Alle Browser-Caches werden gelöscht (`caches.delete()`)
2. Hard Reload wird ausgeführt (`window.location.reload()`)
3. Update-Banner wird 2 Sekunden lang angezeigt

### 4. Update-Banner (`UpdateBanner.tsx`)

Zeigt dem Nutzer an, dass ein Update geladen wird.

## Deployment-Workflow

### Automatische Versions-Inkrementierung:

1. **Script ausführen:**
   ```bash
   pnpm version:increment
   ```
   Dieses Script:
   - Erhöht automatisch die Patch-Version (z.B. 1.0.1 → 1.0.2)
   - Aktualisiert `useUpdateCheck.ts`
   - Aktualisiert `index.html`
   - Fügt neuen Eintrag in `CHANGELOG.json` hinzu

2. **Changelog bearbeiten:**
   Öffnen Sie `CHANGELOG.json` und ersetzen Sie den generischen Eintrag mit den tatsächlichen Änderungen:
   ```json
   {
     "type": "feature",  // oder "improvement" oder "fix"
     "title": "Ihr Feature-Titel",
     "description": "Detaillierte Beschreibung"
   }
   ```

3. **Checkpoint erstellen und veröffentlichen**

4. **Nutzer-Browser:**
   - Erkennt automatisch neue Version innerhalb von 60 Sekunden
   - Zeigt Update-Banner
   - Löscht Cache und lädt neu
   - Zeigt Changelog-Dialog mit neuen Features

### Manuelles Update:

Nutzer können in **Einstellungen → System** jederzeit manuell auf Updates prüfen.

## Cache-Control Headers

Zusätzliche Meta-Tags in `index.html`:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

Diese verhindern aggressives Browser-Caching.

## Neue Features

### 1. Changelog-Dialog

Nach jedem Update sieht der Nutzer automatisch einen Dialog mit:
- Versions-Nummer
- Veröffentlichungsdatum
- Liste aller Änderungen (Features, Verbesserungen, Bugfixes)
- Farbige Badges zur Kategorisierung

### 2. Manueller Update-Button

In **Einstellungen → System** können Nutzer:
- Aktuelle Version sehen
- Manuell auf Updates prüfen
- Sofort aktualisieren ohne Wartezeit
- Informationen zum Update-System lesen

### 3. Automatische Versions-Inkrementierung

Das Script `pnpm version:increment`:
- Verhindert manuelle Fehler
- Synchronisiert alle Versions-Referenzen
- Erstellt automatisch Changelog-Einträge
- Spart Zeit beim Deployment

## Vorteile

✅ **Automatisch:** Nutzer müssen nicht manuell aktualisieren  
✅ **Zuverlässig:** Cache wird immer gelöscht  
✅ **Transparent:** Nutzer sieht Update-Banner und Changelog  
✅ **Schnell:** Update innerhalb von 60 Sekunden erkannt  
✅ **Informativ:** Changelog zeigt alle Änderungen  
✅ **Flexibel:** Manuelles Update jederzeit möglich  

## Troubleshooting

**Problem:** Update wird nicht erkannt  
**Lösung:** Versionen in `useUpdateCheck.ts` und `index.html` prüfen

**Problem:** Endlos-Reload  
**Lösung:** Versionen müssen identisch sein in beiden Dateien

**Problem:** Cache wird nicht gelöscht  
**Lösung:** Browser unterstützt möglicherweise Cache API nicht (sehr alte Browser)
