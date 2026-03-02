# SESSION HANDOFF / FORTSETZUNGSSTAND

Zweck: Diese Datei fixiert den Entwicklungsstand, damit nach einem Cursor-Neustart nahtlos weitergearbeitet werden kann.

## Letzte Aktualisierung

- UTC: 2026-03-02 22:28:05Z
- Branch: `ProTrackr_developing_path`
- Commit: `3bf2d00e4867f9bb2c3658692b9050fd5909817b` (`3bf2d00`)
- Remote: `origin/ProTrackr_developing_path`

## Zuletzt abgeschlossene Arbeit

1. Neue Datenstruktur fuer Steuern (Variante B) umgesetzt:
   - Neue Tabellen in `drizzle/schema.ts`:
     - `taxProfiles` (Regime + schaltbare Regeln pro User)
     - `taxConfigPl` (Jahreswerte/Limits)
   - Migration angelegt:
     - `drizzle/0005_tax_profile_and_year_config.sql`
     - Journal erweitert (`drizzle/meta/_journal.json`)
2. Backend/API erweitert:
   - Neue DB-Funktionen in `server/db.ts`:
     - `getTaxProfile`, `upsertTaxProfile`
     - `getTaxConfigByYear`, `upsertTaxConfigByYear`
   - Neue tRPC-Endpunkte in `server/routers.ts`:
     - `taxSettings.getProfile`
     - `taxSettings.upsertProfile`
     - `taxSettings.getConfig`
     - `taxSettings.upsertConfig`
3. Berechnungsengine umgestellt:
   - Neue zentrale Engine: `client/src/lib/taxEnginePl.ts`
   - Nutzt Regime + Jahreswerte (mit Legacy-Fallback)
   - Dashboard und Reports verwenden jetzt dieselbe Engine.
4. Settings-UI (Steuern) auf neue Struktur umgebaut:
   - `client/src/pages/settings/TaxesTab.tsx`
   - Felder fuer Regime, Chorobowe, FP/FS, Wypadkowa
   - Jahreswerte je Jahr (`tax_config_pl[year]`) inkl. Limits/Basen
5. Migration-Stabilisierung nach lokalen Konflikten:
   - `drizzle/0005_tax_profile_and_year_config.sql` auf `CREATE TABLE IF NOT EXISTS` gehaertet.
   - `package.json` Script angepasst:
     - `db:generate` erzeugt Migrationen
     - `db:push` migriert nur noch (`drizzle-kit migrate`)
6. UI-Referenzvalidierung eingebaut:
   - `client/src/lib/uiCalculations.ts` als gemeinsame Berechnungsbasis fuer Reports/Dashboard.
   - Automatisierte Referenztests:
     - `server/uiValidationReportsDashboard.test.ts`
     - `server/taxEnginePl.test.ts`
7. Dashboard-Umsatztrend korrigiert:
   - Letzte 6 Monate werden explizit geladen (statt nur aktueller Monat).
   - Monatszuordnung ist zeitzonen-robust (DateKey statt direkter `Date`-Monatslogik).
   - Februar-/Vormonatsdaten werden korrekt in der Umsatzentwicklung angezeigt.
8. Build/Typecheck:
   - `pnpm check` erfolgreich
   - `pnpm build` erfolgreich
9. Legacy-Route vereinheitlicht:
   - `client/src/pages/TaxSettings.tsx` rendert jetzt den neuen `TaxesTab`
   - Kein divergenter Alt-Dialog mehr auf `/tax-settings`

## Nutzer-Praeferenzen (SEHR WICHTIG)

Der Nutzer ist ausdruecklich **Laie**. Kommunikation muss immer:

1. in **Deutsch** erfolgen.
2. **jeden einzelnen Schritt** klar und einfach erklaeren.
3. bei mehreren Terminals immer sagen:
   - welches Terminal zu verwenden ist
   - was offen bleiben muss
4. nach **jeder Code-Aenderung** aktiv an den lokalen Update-/Start-Block erinnern.

## Pflicht-Erinnerung nach jeder Code-Aenderung

Dem Nutzer immer diesen Block geben (ggf. angepasst):

```powershell
cd "C:\Projects\ProTrackr_developing_path"
git pull origin ProTrackr_developing_path
pnpm install
pnpm build
schtasks /Run /TN "ProTrackr-App"
Test-NetConnection 127.0.0.1 -Port 3000
```

Hinweis:
- `pnpm install` nur noetig, wenn Dependencies geaendert wurden.
- Browser-Zugriff ueber `http://127.0.0.1:3000`.

## Terminal-Konvention fuer den Nutzer

- **Terminal A**: laufende App (z. B. `pnpm start`) oder MySQL-Konsole, wenn manuell gestartet.
- **Terminal B**: alle Admin-/Git-/Pruef-Befehle.

## Wiederaufnahme-Prompt (Copy/Paste)

```text
Bitte setze die Arbeit auf ProTrackr fort. Lies zuerst docs/SESSION_HANDOFF.md und arbeite exakt auf dem dort genannten Branch/Commit weiter. Antworte auf Deutsch. Ich bin Laie: erklaere jeden Schritt einzeln und sage bei mehreren Terminals immer explizit, welches Terminal ich verwenden soll.
```

## Pflege-Regel

Bei jedem abgeschlossenen Entwicklungsblock diese Datei aktualisieren:
- Datum/Zeit
- Commit-Hash
- was abgeschlossen wurde
- was als naechstes kommt

## Naechster sinnvoller Schritt

- Reale 2026/2027 Werte fuer `taxConfigPl` fachlich final eintragen (gegen Gesetzesstand pruefen).
- Optional: dedizierte Tests fuer `taxEnginePl` ergaenzen (Regime-Szenarien + Grenzfaelle).
