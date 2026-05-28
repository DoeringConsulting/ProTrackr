# Projektspezifische Anweisungen — ProTrackr

> **Projekt:** ProTrackr (DÖRING Consulting – Projekt- & Abrechnungsmanagement)
> **Version dieser Datei:** 1.0.0
> **Stand:** 2026-05-12
> **Geltungsbereich:** nur dieses Repo. Globale Regeln aus `~/.claude/CLAUDE.md` gelten zusätzlich und werden hier **nicht** wiederholt.

---

## 1. Projekt-Kurzbeschreibung

Single-User Web-Anwendung (Self-Hosted) zur Zeiterfassung, Reisekosten-Verwaltung, Steuerberechnung (Polish JDG) und Rechnungslegung. Multi-Currency (PLN/EUR/USD/CHF/GBP), Multi-Tenant über `mandanten`-Tabelle.

**Stack:** React + Vite (Client), tRPC + Express (Server, ESM-Bundle via esbuild), MySQL via Drizzle ORM, Husky-Hooks, Vitest. Production-Bundle in `dist/`.

---

## 2. Verzeichnis-Architektur (Git-Worktrees)

```
C:\Projects\ProTrackr\                       ← Git-Repo-Store (.git als Verzeichnis)
                                               Working tree leer oder detached HEAD,
                                               nicht zum Arbeiten verwenden.

C:\Projects\ProTrackr_developing_path\       ← AKTIVES Worktree, Branch main.
                                               Hier laufen Build, Server, alle Edits.
                                               .git ist eine Pointer-Datei.

C:\Projects\ProTrackr\.claude\worktrees\…    ← Temporäre Claude-Session-Worktrees,
                                               auto-cleanup beim Session-Ende.
```

**Regel:** Code-Änderungen ausschließlich in `ProTrackr_developing_path/`. Niemals `C:\Projects\ProTrackr\.git\` anfassen — sonst sind alle Worktrees tot.

Desktop-Shortcut `C:\Users\adoer\Desktop\ProTrackr.lnk` zeigt auf `…ProTrackr_developing_path\protrackr.cmd`. Wenn ein Server-Start die falsche Version liefert, ist meist ein Auto-Start aus dem alten `ProTrackr\`-Pfad die Ursache (gefixt 2026-05-08, kann aber wiederkommen wenn Shortcuts/Tasks neu angelegt werden).

---

## 3. Branch- & Tag-Disziplin

- **Diese Session arbeitet ausschließlich auf `main`.** Beim Sessionstart `git branch --show-current` prüfen, ggf. `git switch main`. NAS-Setup hat einen eigenen Chat, eigenen Branch `nas-setup`, eigenes Memory.
- **Freeze-Tags vor riskanten Eingriffen.** Konvention: `vX.Y.Z-stable` für Major-Releases, `vX.Y.Z-phaseN-done` zwischen Roll-out-Phasen, `vX.Y.Z-stable-cleanup` nach DB-Aufräumen. Tag immer auf `origin` pushen.
- **Force-Push nur als `--force-with-lease` und nur auf `main` bei Hash-Drift durch Auto-Bump-Amend.** Nie auf Tags.

---

## 4. Build- & Deploy-Workflow

1. `git commit` auf `main` → `pre-commit` Hook führt Tests aus (`server/taxEnginePl.test.ts`, `server/uiValidationReportsDashboard.test.ts`).
2. Commit wird erstellt.
3. `post-commit` Hook **gated auf `main`**: liest Commit-Message, leitet Bump-Level ab (siehe §6), bumpt Version, baut `dist/`, `git commit --amend --no-edit --no-verify` foldet die Versionsdateien ein, `protrackr.ps1 Restart` als detached Process.
4. Nach manuellem `git push`: Hash-Drift möglich, falls Hook nochmal amended hat. Auflösen mit `git reset --hard origin/main` (Inhalt war identisch).

**Server-Pfad:** `http://localhost:3001` (NICHT 3000 — Memory von früheren Versionen ist veraltet). Hostet aus `dist/index.js`, gestartet via `protrackr.ps1 Start|Restart|Recover|Stop|Status`.

Falls Restart nicht zieht: `protrackr.ps1 Recover` macht Stop + Build + Start. Browser benötigt häufig Strg+F5 wegen Service-Worker-Cache (`client/public/sw.js` hashed Cache-Bucket auf Commit-Hash).

---

## 5. Datenbank-Konventionen

**Geld immer als `int` cents.** Kein Decimal, kein String. Sonderskalen:
- `customers.standardDayHours` — Hundertstel-Stunden (800 = 8,00 h/Tag)
- `timeEntries.manDays` — Tausendstel (1250 = 1,250 MT)
- `timeEntries.hours` — Minuten total (480 = 8 h)
- `exchangeRates.rate` — Zehntausendstel (42369 = 4,2369)
- `*RateBp` — Basis Points (1952 = 19,52 %)

**Provisions-Felder (seit Migration 0023, Mai 2026):**
- `provisionEnabled` 0/1
- `provisionMode` `deduction` | `surcharge`
- `provisionType` `percentage` | `fixed` | `two_rate`
- `provisionValueBp` — Anteil in Basis Points (1000 = 10 %)
- `provisionValueCents` — Festbetrag in cents
- `provisionUnit` `hour` | `day` (nur bei `fixed`)
- `provisionUserRate` / `provisionUserRateRemote` — cents/Tag (nur bei `two_rate`)

Berechnung in `client/src/lib/provision.ts` (`calculateProvisionCents`, `getCustomerVisibleRate`, `getCustomerVisibleAmount`). **Niemals in customer-facing Reports `customer.provision*` direkt rendern** — Datenleck-Risiko.

**Migrations** in `drizzle/NNNN_descriptive_name.sql`. Konvention: `ADD COLUMN … NOT NULL DEFAULT … AFTER existing_col`. Schema-Sync in `drizzle/schema.ts` parallel pflegen. Anwenden direkt via `mysql2/promise` (nicht `drizzle-kit migrate` interaktiv).

---

## 6. Auto-Version-Bump (Conventional Commits)

`.husky/post-commit` parsed Commit-Subject und Body:

| Pattern | Bump |
|---|---|
| `BREAKING CHANGE` / `BREAKING-CHANGE` im Body **oder** `<type>!:` Subject | MAJOR |
| `feat:` / `feat(scope):` | MINOR |
| alles andere (`fix:`, `chore:`, `refactor:`, `docs:`, …) | PATCH |

Override per `BUMP_LEVEL=major git commit ...`. Skip bei Merge-Commits und bei Commits, die nur Versions-Dateien anfassen. Hook fired nur auf `main`.

Skript: `scripts/increment-version.mjs <major|minor|patch>` — propagiert in `package.json`, `CHANGELOG.json`, `client/public/CHANGELOG.json`, `client/public/version.json`, `client/index.html`, `client/src/hooks/useUpdateCheck.ts`, `client/src/components/VersionFooter.tsx`.

---

## 7. Test-Infrastruktur

- `npx vitest run` für alle Tests, `npx tsc --noEmit` für Type-Check vor Commit.
- Integration-Tests in `server/*.test.ts` schreiben in die echte Dev-DB. **Globaler Cleanup in `server/vitest.setup.ts:afterAll`** löscht alle Fixtures mit Projekt-Namen `'Test Project'`, `'Test Project 2'`, `'Update Test'`, `'Address Test Project'` plus `exchangeRates.source = 'Manual Test'`. Skippable per `SKIP_TEST_CLEANUP=1`.
- Beim Schreiben neuer Tests **diese Fixture-Namen wiederverwenden**, damit die Cleanup-Logik greift.

---

## 8. Backup-System

`server/backup.ts` `createBackup()` / `restoreBackup()` — Endpoint `backup.create` / `backup.restore` (vom Settings-Tab "Datensicherung" angetriggert).

**Coverage:** 15 Tabellen (`customers`, `timeEntries`, `expenses`, `exchangeRates`, `fixedCosts`, `documents`, `expenseAiAnalyses`, `taxSettings`, `taxProfiles`, `taxConfigPl`, `accountSettings`, `invoiceNumbers`, `mandanten`, `users`, `passwordResetTokens`). Backup-Format `1.1.0`; `1.0.0`-Backups bleiben restoreable.

**Beim Hinzufügen neuer Tabellen:** sowohl `createBackup()` als auch `restoreBackup()` erweitern, optional im Zod-Schema (Backward-Compat). Test mit altem 1.0.0-Backup, dass Restore nicht crasht.

---

## 9. Wechselkurs-Logik (NBP)

Quelle in `server/nbp.ts`. Verwendung in Berichten: Pro Berichts-Erstellung **letzter Werktag vor heute** als Stichtag (Polish VAT/PIT-Regel: „ostatni dzień roboczy poprzedzający dzień wystawienia faktury"). Implementiert in `server/routers.ts:exchangeRatesManagement.resolveForReportDate`, anchored auf `yesterday`, mit NBP-eigenem 404-Fallback bis 7 Tage rückwärts (Wochenenden/Feiertage).

**Cache-Fenster:** 12 h. Innerhalb dieser Zeit liefert die Query den DB-Cache, danach erfolgt Re-Fetch. Begründung: NBP veröffentlicht ~12:00 PL-Zeit pro Werktag; 12 h garantieren Re-Fetch nach jeder Veröffentlichung.

**Manual Override:** `accountSettings.useManualExchangeRate=1` → Reports nehmen den letzten manuellen Kurs pro Pair statt NBP. Toggle im Settings-Tab Wechselkurse.

**History-Cap:** 20 Einträge total per scope (`userId`). Älteste werden bei Insert gepruned.

---

## 10. Reports & Customer-Datenschutz

**Buchhaltungsbericht** = User-internal. Zeigt Provision, Steuerlast, Nettogewinn.
**Kundenbericht** = customer-facing. Zeigt **niemals** Provision oder Provisionsdetails.

Trennstrick: `calculateCustomerReport()` in `client/src/pages/Reports.tsx` rührt nur `entry.amountEur` an plus `getCustomerVisibleAmount()` (für Surcharge-Mode). Provision-Aggregat `accountingData.provisionTotal` darf niemals in eines der Customer-Export-Daten-Objekte fließen (`CustomerData` in `pdfExport.ts`, `CustomerReportData` in `excelExport.ts`). Strukturelle Garantie — nicht durch Konventionen ersetzen, wenn umgebaut wird.

**PDF/Excel-Exports:**
- `client/src/lib/pdfExport.ts` — `exportAccountingReportToPDF`, `exportCustomerReportToPDF`
- `client/src/lib/excelExport.ts` — `exportAccountingReportToExcel`, `exportCustomerReportToExcel`
- `client/src/lib/reportPdfExports.ts` — `exportPolishBookkeepingReportToPDF`, `exportCustomerTimesheetToPDF`, `exportCustomerCostStatementToPDF`

Beim Erweitern: i18n-Strings für DE / EN / PL parallel pflegen.

---

## 11. Phasen-Roll-out-Pattern für große Features

Etabliert im Provision-Feature (Mai 2026, 7 Phasen). Pflicht-Pattern für jedes Feature mit Daten-Migration oder breit verzweigter Logik:

1. **Master-Freeze** vor Beginn (`vX.Y.Z-stable`), auf `origin` pushen.
2. Pro Phase: **DoD definieren**, implementieren, `tsc` + `vitest` + Browser-Regression, **Phase-Freeze** (`vX.Y.Z-phaseN-done`), auf `origin` pushen.
3. **Bei Fehler:** `git reset --hard <letzter Phase-Freeze>`, Lessons-Learned dokumentieren, neuer Versuch.
4. **Eskalations-Regel (Variante B):** Bei zweimaligem Scheitern derselben Phase → drei alternative Lösungsansätze dem User vorlegen, der wählt. Kein dritter Versuch ohne neue Konzeption.
5. **Worst-Case-Reset:** `git reset --hard <Master-Freeze>`.

---

## 12. NBP-API als feste externe Abhängigkeit

`https://api.nbp.pl/api/exchangerates/rates/a/<currency>/<YYYY-MM-DD>/?format=json`. 404 bei nicht-Werktag → Fallback auf Vortag, max. 7 Versuche. Andere Forex-Quellen sind **verboten** (globale Regel §5).

---

## 13. Memory-Dateien (außerhalb dieses Repos)

Persistente User-Notizen liegen unter `~/.claude/projects/C--Projects-ProTrackr/memory/`:

- `MEMORY.md` — Index
- `user_login.md` — Mandant/Email/Passwort (nicht hier ablegen!)
- `feedback_3agent_workflow.md` — Junior/Senior/QA-Pattern für Programmieraufgaben
- `feedback_deploy_workflow.md` — push → merge → build → restart
- `feedback_nas_umzug_branch.md` — NAS strikt isoliert
- `feedback_main_only_session.md` — diese Session immer auf main

Bei Sessionstart `MEMORY.md` lesen und konsultieren.

---

*Diese Datei lebt im Repo (`main`) und ist mit dem Code versioniert. Änderungen committen wie normaler Code (auto-bump greift).*
