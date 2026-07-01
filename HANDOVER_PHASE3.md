# ProTrackr — Handover & Rettungsanker (Stand: ~02.07.2026)

> Zweck: Übergabe-Dokument für die nächste Session (Phase 3 = Report-Änderung) **und**
> Rettungsanker (Rollback-Anleitung). Liegt im Repo-Root, ist auf GitHub gesichert.
> Claude-seitige Kopie: `~/.claude/projects/C--Projects-ProTrackr/memory/project_open_bugfixes_2026-05-15.md`
> (lädt in der nächsten Session automatisch).

---

## 1. Aktueller Stand (sicher & deployed)

- **Branch:** `main`, synchron mit `origin/main`.
- **Version:** v2.0.7 (Server läuft, localhost:3001).
- **Nur auf `main` arbeiten** (Regel dieses Chats). NAS hat eigenen Chat/Branch `nas-setup`.

### Freeze-Tags (Rollback-Anker, alle auf GitHub)
| Tag | Bedeutung |
|---|---|
| `v2.0.4-stable` | Master-Freeze VOR allen Fixes dieser Session |
| `v2.0.6-phase1-done` | nach Fehler #1 (Reisekosten-Monatsgrenze) |
| `v2.0.7-phase2-done` | nach Fehler #3 (Backup 15 Tabellen) — **aktueller Stand** |

### RETTUNGSANKER — Rollback-Befehle
```bash
cd "C:/Projects/ProTrackr_developing_path"
git switch main                      # falls versehentlich anderer Branch
git reset --hard v2.0.7-phase2-done  # zurück auf aktuellen guten Stand
# oder komplett vor die Session:
git reset --hard v2.0.4-stable
git push origin main --force-with-lease   # nur wenn origin auch zurück soll
```
Danach Server neu bauen/starten: `powershell -File protrackr.ps1 Recover`.

---

## 2. In dieser Session ERLEDIGT

| Thema | Version | Verifiziert |
|---|---|---|
| Branch zurück auf `main` + Master-Freeze | — | ✅ |
| Tab-Titel-Encoding (index.html: literal `ö` → echtes `ö`) | v2.0.5 | ✅ Browser-Tab zeigt „Döring Consulting" |
| Favicon (dein PNG → `client/public/favicon.png`, Link in index.html) | v2.0.5 | ✅ HTTP 200 |
| **Fehler #1** — Reisekosten 30.06. landete im Juli-Zeitraum | v2.0.6 | ✅ Juni enthält 30.06., Juli nicht (DB-Simulation) |
| **Fehler #3** — Backup nur 6/15 Tabellen | v2.0.7 | ✅ 15 Tabellen, tsc+63 Tests. OFFEN: Live-Restore-Test mit echter NAS-Datei |

---

## 3. OFFEN — Phase 3 (Fehler #2, Sobrietas exclusive) — für nächste Session

**Problem:** `expenses` hat keine `customerId`-Spalte; Zuordnung nur über `timeEntryId`,
das bei allen 217 Belegen NULL ist. Berichte (`Reports.tsx`) ordnen Reisekosten nur über
`timeEntryId` zu → Sobrietas' exclusive-Reisekosten werden nie als abrechenbar geführt.
Die Reisekosten-Analyse-Seite (`Expenses.tsx`, Z.121–142) macht es korrekt datumsbasiert —
die Berichte nicht.

**Entscheidung D (LOCKED):** KEIN Backfill. Alle Belege **vor 01.07.2026 bleiben unberührt**
(historische Berichte byte-identisch). Neue Mechanik gilt **nur für Belege ab 01.07.2026**.

### Phase-3-Unterphasen (je eigener Freeze)
- **3a Schema:** neue Spalte `expenses.customerId` (nullable int, FK→customers, onDelete
  set null). Migration `drizzle/00XX_expenses_customerId.sql` (nächste freie Nummer prüfen:
  `ls drizzle/*.sql`). **KEIN Backfill** — alle Bestandsbelege bleiben NULL.
- **3b Backend:** `expenses.create`/`update` (server/routers.ts ~Z.100/125) akzeptieren
  `customerId`; `expenses.list` liefert ihn mit.
- **3c UI:** „Kunde/Projekt"-Auswahl im Reisekosten-Erfassen/Bearbeiten-Formular
  (Formular-Datei suchen: `grep -rln "expenses.create" client/src`).
- **3d Report-Logik** (`client/src/pages/Reports.tsx`) — RISIKOREICHSTE Stelle:
  - `travelRevenueInGrossPln` (Buchhaltung, ~Z.360) und `billableExpenses`/customerExpenses
    (Kundenbericht, ~Z.545–578) so ändern, dass für Belege **mit `date >= 2026-07-01`** die
    Zuordnung über `expense.customerId` (Fallback: datumsbasiert wie Expenses.tsx) läuft.
  - Belege **mit `date < 2026-07-01`** behalten die ALTE Logik (timeEntryId-basiert) →
    historische Berichte bleiben unverändert. Datum-Cutover als harte Grenze.
- **3e Verifikation:** Ein Juli-Beleg mit gesetztem customerId für Sobrietas erscheint als
  abrechenbar (exclusive) in Buchhaltungs- UND Kundenbericht. Regression: April-Corpuls
  (22.440,96 €) und alle Vor-Juli-Berichte byte-identisch.

### Referenz-Implementierung (korrekte datumsbasierte Zuordnung)
`client/src/pages/Expenses.tsx` Z.111–142: `dateKeyOf` + `customerIdsByDate` (aus
timeEntries) + Fallback `customerIdsByDate.get(startDateKey)?.has(customerId)`.

### Wichtige Fakten
- Kunde Sobrietas = id **278**, projectName „Fritzmeier Gruppe", costModel **exclusive**.
- expenses.date-Konvention: lokale Warschau-Mitternacht als UTC (z.B. 30.06 = `...T22:00Z`).
- „1 Kunde pro Tag" ist die Default-Annahme (Rückfrage A). Mehrdeutige Tage: Beleg bleibt
  ohne Zuordnung (manuell via neuer UI).

---

## 4. Weitere offene Punkte (nicht Phase 3)

- **Live-Restore-Test Backup:** Sobald NAS wieder online — echte NAS-Backup-`.json`
  importieren und prüfen, dass alle Tabellen/Zeilen ankommen (Fehler werden jetzt gemeldet).
- **Frage A (sind `main` und NAS-Code identisch?):** NAS war down. User bat, am Folgetag
  nachzufragen und dann zu prüfen (`git diff --stat main nas-setup` zeigte bisher nur
  NAS-Infra-Dateien, kein App-Code-Unterschied).

---

## 5. So startest du die nächste Session

Sag Claude: **„Weiter mit Phase 3 (Fehler #2, Sobrietas exclusive) laut HANDOVER_PHASE3.md"**.
Claude prüft Branch (`main`), liest die Memory + diese Datei, setzt Pre-Freeze
`v2.0.7-phase2-done` als Anker und arbeitet 3a→3e mit Zwischen-Freezes ab.
