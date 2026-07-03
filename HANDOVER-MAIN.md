# HANDOVER — ProTrackr Main-Entwicklungslinie (Sitzungs-Übergabe)

> Self-contained Übergabe für die **main-Welt** von ProTrackr. Eine neue
> Main-Sitzung kann allein auf Basis dieses Dokuments + der Memory-Dateien
> lückenlos weiterarbeiten. Stand: **2026-07-03, v2.1.9, HEAD `730fb94`**.
> Pendant: `HANDOVER-NAS-SETUP.md` (Branch `nas-setup`, NAS-Welt).

## 0. SOFORT-EINSTIEG (TL;DR)

- **Wo:** Worktree `C:\Projects\ProTrackr_main`, Branch **`main`** (ausschließlich).
- **Stand:** v2.1.9 auf main + origin, Baum sauber. Fehler #1/#2/#3 erledigt,
  NAS-Rollout-Tooling + Deployment-Blueprint stehen, A5-Hook-Schritt erledigt.
- **Offen (App-Bug):** `task_bba37780` — Reisekosten-Attribution wird in 2 Render-
  Pfaden nicht angewandt (`Reports.tsx:1091` + PDF-Kostenaufstellung). **Bei
  Wiederaufnahme User fragen, wie vorgegangen wird.** Details §6 + Memory
  `project_open_fix_expense_attribution_main`.
- **Deploy (nach A5!):** committen + `git push origin main` — **kein localhost
  mehr**. Ausrollen auf den NAS läuft im **NAS-Setup-Chat** via `/nas-rollout`.

## 1. WIEDEREINSTIEGS-PROZEDUR (zuerst in der neuen Sitzung)

1. **Branch/Worktree prüfen:** `cd C:\Projects\ProTrackr_main` → `git branch
   --show-current` muss `main` sein; `git fetch origin` → sync mit `origin/main`
   prüfen (`git rev-list --left-right --count origin/main...HEAD`).
   NIE in `ProTrackr_developing_path` arbeiten (= nas-setup, NAS-Welt).
2. **Memory lesen:** `MEMORY.md` + verlinkte Einträge, v.a.
   [[feedback_deploy_workflow]] (nach A5 geändert!), [[feedback_worktree_separation]],
   [[project_open_fix_expense_attribution_main]], [[feedback_prod_only_via_dev_promotion]].
3. **Dieses Handover lesen.**
4. **Für den offenen Bug:** erst den User fragen, wie vorgegangen wird (war beim
   Pausieren offen), dann fixen → `npx tsc --noEmit` + `npx vitest run` grün →
   committen + pushen.

## 2. PROJEKT-KONTEXT (Stack)

ProTrackr = Projekt-/Abrechnungs-/Reisekosten-Management (DÖRING Consulting,
Mandant `dc001`).

- **Frontend:** React + Vite + TypeScript (`client/`). UI-Komponenten unter
  `@/components/ui` (Radix), Charts `recharts`, Routing `wouter`.
- **Backend:** tRPC + Express, per esbuild zu `dist/index.js` gebündelt (ESM)
  (`server/`). Server-Entry `server/_core/index.ts`.
- **DB:** MySQL via Drizzle ORM (`drizzle/schema.ts`, Migrationen `drizzle/*.sql`,
  aktuell bis `0024_expenses_customer_id.sql`). **Geld = int Cents**, Wechselkurse
  = Zehntausendstel. **Zeitzone Europe/Warsaw (UTC+2)** — Ursache diverser
  `toISOString()`-off-by-one-Bugs (Monatsgrenzen daher als String bauen, nicht
  via toISOString).
- **Tooling:** pnpm; husky-Hooks. **pre-commit** = `tsc` + `vitest` (braucht
  erreichbare MySQL via `DATABASE_URL` in `.env`). **post-commit** = Auto-Version-
  Bump (conventional commits: `feat!`/BREAKING→major, `feat`→minor, sonst→patch)
  + Production-Build (`vite build` + esbuild) + `git --amend`. **Kein Server-
  Restart mehr** (A5, siehe §3/§6).
- **DB-Zugriff:** über `node -e "require('dotenv/config'); const mysql=require('mysql2/promise')…"`.
  DATABASE_URL in Shell-Variablen lesen ist sandbox-geblockt; destruktive DB-
  DELETEs können vom Classifier geblockt werden (nur mit ausdrücklicher User-
  Freigabe + Sicherheits-Recheck, ggf. `dangerouslyDisableSandbox`).

## 3. BRANCH-/WORKTREE-DISZIPLIN + DEPLOY-WORKFLOW

**Worktrees** (`git worktree list`):
- `C:\Projects\ProTrackr_main` → **`main`** — DIESE (App/Main-)Welt.
- `C:\Projects\ProTrackr_developing_path` → **`nas-setup`** — NAS-Welt (eigener
  Chat). Hier NIE anfassen.
- `C:\Projects\ProTrackr` → git store (detached HEAD).

Getrennte Ordner beenden die frühere Branch-Kollision (der auto-version-Hook
einer Session schob den geteilten Ordner sonst auf `main`). Siehe
[[feedback_worktree_separation]].

**Deploy-Workflow (NACH A5, 2026-07-03):** localhost:3001 ist komplett
abgeschaltet, der NAS ist die **einzige laufende Instanz** (Prod
`https://dcs01.taile370c2.ts.net:9443` / Dev `:9444`).
1. Auf `main` committen (Hook bumpt + baut `dist/`, **kein Restart**).
2. `git push origin main` — fertig für die main-Seite.
3. **Deploy auf NAS** getrennt im **NAS-Chat** via `/nas-rollout`.
**Lokal testen:** `npx tsc --noEmit` + `npx vitest run` (schnell, braucht DB);
laufende App ad hoc `npm run dev` oder gegen NAS-Dev `:9444`. Notebook-`MySQL84`
wird gestoppt (StartType Manual) — DB für lokale Tests ggf. erst starten.

## 4. AKTUELLER STAND

- **Version:** v2.1.9 · **HEAD:** `730fb94` (= origin/main, synchron).
- **Letzte Arbeit (diese Sitzung):** A5-Teilschritt — Server-Restart-Block aus
  `.husky/post-commit` entfernt (Bump/Build/Amend unverändert). Commit `730fb94`
  „chore: retire localhost:3001 auto-restart …". Validiert: Hook-Output ohne
  „Server-Restart".
- **Davor (Kontext):** Fehler #2 (Sobrietas exclusive) komplett live auf **v2.1.0**
  (Tag `v2.1.0-phase3c-done`) — geteilte Attribution `client/src/lib/expenseAttribution.ts`
  (Option B), UI-Kundenauswahl im Beleg-Dialog. Tech-Debt aggregateByCustomer
  entfernt (v2.1.1). NAS-Rollout-Tooling + Deployment-Blueprint (v2.1.2–v2.1.8):
  `docs/DEPLOYMENT-BLUEPRINT.md`, `docs/NAS-CHAT-START.md`,
  `.claude/skills/nas-rollout/SKILL.md`, `.claude/rollouts/`,
  `scripts/generate-rollout-manifest.mjs`, `scripts/rollout-to-nas.ps1`.
- **Freeze-Tags:** letzter Feature-Freeze `v2.1.0-phase3c-done`; v2.1.1–v2.1.9
  sind Tooling/Docs/Chore (kein App-Logik-/Schema-Change).

## 5. VERHÄLTNIS ZUR NAS-WELT

- **`main` = Entwicklungslinie** (App-Code, Tooling, Docs). **`nas-setup` =
  Deploy/Infra** (Docker, `docker-compose.yml`, `Dockerfile`, migrate-Skripte —
  NAS-only-Dateien, nicht auf main).
- **Sync-Modell:** `main → nas-setup` **kontrolliert** über das `/nas-rollout`-
  Tooling (Manifest pinnt einen Commit; Ziel `dev`/`prod`). Das Tooling liegt auf
  `main`; der NAS-Chat liest es via `git show origin/main:…`.
- **NIEMALS `nas-setup → main`** ohne ausdrückliche Freigabe (siehe
  [[feedback_nas_umzug_branch]]).
- **Zielarchitektur:** zwei Server-Umgebungen (Prod :9443 / Dev :9444) auf Unraid
  **7.3.1**, Image-Promotion Dev→Prod. Vollplan `docs/DEPLOYMENT-BLUEPRINT.md`.
  Governance: PROD nur via Dev→Promotion ([[feedback_prod_only_via_dev_promotion]]).

## 6. OFFENE PUNKTE

### 6.1 App-Bug `task_bba37780` — Reisekosten-Attribution (OFFEN, priorisiert)
Ausführlich in Memory `project_open_fix_expense_attribution_main`.
- **Symptom:** Beleg mit `expenses.customerId` gesetzt, aber `timeEntryId = NULL`
  („Option B"-Direktzuordnung, gültig ab Cutover 2026-07-01) wird inkonsistent
  behandelt: Kundenbericht-Summary korrekt ✅; Buchhaltungsbericht-Zeile
  „Reisekosten (abrechenbar, nur Exclusive)" **leer**, Betrag rutscht unter
  „Variable Kosten (Reisen)" ❌; PDF-Kostenaufstellung **0,00** ❌. Endsumme
  rechnerisch korrekt (via `travelRevenueInGross`) — reiner Anzeige-/
  Kategorisierungs-Bug.
- **Root Cause:** zwei Render-Pfade nutzen noch die alte
  `if (!expense.timeEntryId) return false`-Logik statt der zentralen
  `getExpenseBillingCustomerId(expense, maps)` aus
  `client/src/lib/expenseAttribution.ts`:
  1. `client/src/pages/Reports.tsx:1091` (Filter „abrechenbar, nur Exclusive")
  2. Datenpfad, der `exportCustomerCostStatementToPDF` in
     `client/src/lib/reportPdfExports.ts` speist (Reisekosten kommen vorberechnet
     aus Reports.tsx).
  Gegencheck: `getExpenseBillingCustomerId` wird in Reports.tsx bereits korrekt
  bei ~Z.386/450/519/613 genutzt — Z.1091 + PDF sind die Ausreißer.
  **(Zeilennummern gegen aktuellen Code verifizieren — v2.1.9.)**
- **Testdaten (NUR in Prod/NAS-DB, NICHT auf Laptop):** Kunde `customers.id=278`
  (exclusive), `expenses.id` 580 (flight 20000 EUR) + 581 (taxi 25600 PLN), beide
  `date=2026-07-02`, `customerId=278`, `timeEntryId=NULL`. Für lokalen Test eigene
  Fixtures anlegen (Namenskonvention Sentinel `VTEST-…`/`VTEST_…`, damit der
  vitest-Teardown sie fängt).
- **Vorgehen:** Fix auf `main` (dieser Worktree). **Zuerst User fragen** (war beim
  Pausieren offen), dann Attribution über die zentrale Funktion vereinheitlichen,
  `tsc`+`vitest` grün, gezielter Test für customerId-ohne-timeEntryId, committen +
  pushen (Deploy auf NAS via NAS-Chat).

### 6.2 A5 (localhost-Shutdown) — Status
- **Main-Teil ERLEDIGT** (diese Sitzung): Hook-Restart-Block entfernt (v2.1.9).
- **Offen im NAS-Chat:** MySQL84 stop + StartType Manual, Verifikation (Test-
  Commit → Port 3001 frei), Doku. Plan: `HANDOVER-NAS-SETUP.md` §6. Siehe
  [[project_a5_localhost_shutdown]].

## 7. GOVERNANCE-REGELN (verbindlich)

- **Main-only in diesem Chat** ([[feedback_main_only_session]]); NAS hat eigenen
  Chat. Bei Sessionstart Branch prüfen.
- **Kein `nas-setup → main`** ohne Freigabe.
- **Keine direkten PROD-Änderungen** — alles über DEV→Test→Freigabe→Promotion
  ([[feedback_prod_only_via_dev_promotion]]).
- **Sprache:** Antworten Deutsch, Code/Identifier Englisch (globale CLAUDE.md).

## 8. LESSONS LEARNED / FALLSTRICKE

- **Git Bash (Windows) verhaspelt `git show ref:.claude/…`-Pfade** (MSYS
  `:`→`;`, `/`→`\`). → PowerShell nutzen oder `MSYS_NO_PATHCONV=1` voranstellen.
- **Auto-Version-Hook** bumpt bei JEDEM Nicht-Version-Datei-Commit auf main +
  baut `dist/`. `client/public/sw.js` driftet (Build-Artefakt) → nach Push
  `git checkout -- client/public/sw.js`.
- **TZ Europe/Warsaw:** Monatsgrenzen als String (`${y}-${mm}-01`), nie
  `new Date(...).toISOString()` (kippt auf Vortag).
- **Attribution = eine Wahrheitsquelle:** `getExpenseBillingCustomerId` in
  `client/src/lib/expenseAttribution.ts`. Option B: explizite `customerId` gewinnt
  datumsunabhängig; ohne customerId gilt Alt-Logik (timeEntryId), Datums-Fallback
  nur ab Cutover 2026-07-01.

## 9. ROLLBACK-/SICHERHEITSPUNKTE

- Alles auf **GitHub `DoeringConsulting/ProTrackr`**, `origin/main` = `730fb94`
  (v2.1.9). Freeze-Tags für Meilensteine (`v2.1.0-phase3c-done` etc.).
- Kein Datenverlustrisiko durch main-Arbeit — App-Code, kein DB-Zugriff nötig für
  den offenen Bug (reiner Render-Fix); Tests mit eigenen Fixtures.
- NAS bleibt unberührt, solange kein Rollout im NAS-Chat gefahren wird.
