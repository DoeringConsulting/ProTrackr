# ADR-0001 — `--no-verify` für Rollout-/Metadaten-Commits im NAS-Worktree ohne `node_modules`

- **Status:** Akzeptiert
- **Datum:** 2026-07-15
- **Kontext:** NAS-Setup-Chat (Branch `nas-setup`, Worktree `C:\Projects\ProTrackr_developing_path`)
- **Freigabe:** Alexander Döring, schrittbezogen (Auswahl „--no-verify" im Rollout v2.5.0);
  formal gefordert durch K7-Enforcement-Hook (`RICHTLINIE_AUSNAHME=1` + ADR).

## Kontext

Der NAS-Worktree `developing_path` hat **kein `node_modules`** (0 Einträge). Es wurde
höchstwahrscheinlich beim Rollback-/Cleanup nach v2.4.0 (Handover §6.1, „~1,4 GB frei")
mit entfernt — dieser Worktree **baut/testet die App nicht**, er dient ausschließlich der
Git-/Infrastruktur-Arbeit (Rollout-Manifeste, Merges `main → nas-setup`, NAS-Docs).

Der `.husky/pre-commit`-Hook führt `npx vitest run …` aus. Ohne `node_modules` bricht das
mit `ERR_MODULE_NOT_FOUND: Cannot find package 'vitest'` ab — **nicht** der bekannte
DB-Fixture-Cleanup-Fehler (Handover Lesson 1, dort läuft vitest und nur der Cleanup scheitert),
sondern ein Totalausfall des Test-Runners. Damit scheitern die für einen Rollout nötigen
Commits (Manifest-Bereitstellung + Merge-Commit von `rollout-to-nas.ps1`).

Der K7-Richtlinien-Hook blockiert `--no-verify` standardmäßig und verweist auf die bewusste
Ausnahme via `RICHTLINIE_AUSNAHME=1` + ADR.

## Entscheidung

Für **reine Rollout-/Metadaten-/Doku-/Merge-Commits in diesem NAS-Worktree** (kein neuer
App-Code) ist `--no-verify` — via `RICHTLINIE_AUSNAHME=1` — **zulässig**.

Begründung:
1. **Kein neuer App-Code entsteht in `nas-setup`.** Der ausgerollte Code kommt via Merge von
   `main`, wo `tsc` + `vitest` zum Freeze-Zeitpunkt grün waren (Manifest-Feld `verified`,
   `freezeTagPresent: true`). Die Qualitäts-Gates greifen dort, wo der Code entsteht.
2. **Der Worktree baut/testet die App nicht** — der lokale `vitest`-Lauf ist hier
   gegenstandslos (Metadaten/JSON/Merge).
3. **`node_modules` wieder zu installieren (~1,4 GB)** widerspräche dem bewussten §6.1-Cleanup
   und brächte für Metadaten-Commits keinen Mehrwert.

## Konsequenzen

- **Positiv:** NAS-Rollouts laufen ohne `node_modules`-Ballast; der freigeräumte Platz bleibt.
- **Negativ / Grenze:** Keine lokale Test-Absicherung in `nas-setup` (akzeptiert — der
  main-Freeze trägt sie). **Die Ausnahme gilt NICHT für echte Logik-Änderungen an
  Infra-Skripten** (`scripts/*.sh`, `*.ps1`, `Dockerfile`, `compose*.yml`) — dort ist entweder
  `pnpm install` + regulärer Lauf oder eine erneute schrittbezogene Freigabe nötig.
- **Alternative erwogen:** `pnpm install --frozen-lockfile` vor jedem Rollout — verworfen
  (Platz/Zeit, kein Mehrwert für Metadaten-Commits).
