# FK-Migrations-Runbook (P1/P2)

Dieses Runbook beschreibt die sichere Einfuehrung von Foreign Keys in ProTrackr mit Bereinigung, Quarantaene und Rollback.

## Ziel

- Referenzielle Integritaet auf DB-Ebene erzwingen.
- Bestehende Daten vor FK-Rollout bereinigen.
- Downtime minimieren (Indexierung vor FK-ALTERs).
- Rollback klar und reproduzierbar halten.

## Enthaltene Migrationen

1. `drizzle/0017_fk_index_prep.sql`
   - legt benoetigte Hilfsindizes fuer FK-Spalten an.
2. `drizzle/0018_fk_orphan_analysis.sql`
   - read-only Analyse verwaister Datensaetze.
3. `drizzle/0019_fk_orphan_cleanup_and_quarantine.sql`
   - bereinigt Orphans; nicht aufloesbare Faelle werden in `orphan_quarantine` gesichert.
4. `drizzle/0020_fk_constraints.sql`
   - aktiviert FK-Constraints inkl. ON DELETE/ON UPDATE Regeln.

## Vorbedingungen

- Vollstaendiges Backup der Datenbank vorhanden und Wiederherstellung getestet.
- Wartungsfenster fuer FK-ALTERs eingeplant.
- `DATABASE_URL` auf Zielumgebung gesetzt.

## Ablauf (empfohlen)

1. **Backup + Freeze**
   - Backup erstellen.
   - Restore-Test auf Staging.
2. **Phase 1: Index-Prep**
   - `0017_fk_index_prep.sql` ausfuehren.
3. **Phase 2: Orphan-Analyse**
   - `0018_fk_orphan_analysis.sql` ausfuehren und Ergebnisse protokollieren.
4. **Phase 3: Cleanup + Quarantaene**
   - `0019_fk_orphan_cleanup_and_quarantine.sql` ausfuehren.
   - Analyse-Script erneut ausfuehren; kritische Orphans muessen `0` sein.
5. **Phase 4: FK-Rollout**
   - `0020_fk_constraints.sql` ausfuehren.
6. **Code-Sync**
   - `drizzle/schema.ts` enthaelt `.references(...)`.
   - `drizzle/relations.ts` ist gepflegt.

## Validierung nach Rollout

- `SHOW CREATE TABLE` fuer alle betroffenen Tabellen pruefen.
- Negativtests:
  - Loeschversuch eines referenzierten Parent-Datensatzes mit `RESTRICT` muss fehlschlagen.
  - `CASCADE` und `SET NULL` muessen gemaess Design wirken.
- Import/Restore-Test durchfuehren.

## Rollback

### Schema-Rollback (FK entfernen)

1. Alle in `0020_fk_constraints.sql` gesetzten Constraints per `ALTER TABLE ... DROP FOREIGN KEY ...` entfernen.
2. Anwendung neu deployen.

### Daten-Rollback

`0019` aendert Daten. Fuer vollstaendiges Rollback ist das Backup vor Phase 3 erforderlich.

## Quarantaene-Regeln

- Tabelle: `orphan_quarantine`
- Felder:
  - `entityType`, `entityId`, `payloadJson`, `reason`, `createdAt`, `expiresAt`
- Retention:
  - technische Artefakte i.d.R. 90 Tage
  - ownership-relevante Datensaetze i.d.R. 180 Tage

## Sonderfall `exchangeRates.userId`

- Aktuell: `0 = global/NBP`, `>0 = user-spezifisch`.
- Daher **kein** klassischer FK auf `exchangeRates.userId`.
- Mittelfristig geplant:
  - `userId` nullable
  - `sourceScope` enum (`global`, `user`, `system`)
  - Backfill von `userId=0` auf neues Modell
