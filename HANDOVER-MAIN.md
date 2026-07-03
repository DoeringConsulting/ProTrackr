# HANDOVER — ProTrackr Main-Entwicklungslinie (Sitzungs-Übergabe)

> Self-contained Übergabe für die **main-Welt** von ProTrackr. Eine neue
> Main-Sitzung kann allein auf Basis dieses Dokuments + der Memory-Dateien
> lückenlos weiterarbeiten. Stand: **2026-07-03, v2.1.15, HEAD `ee6cd2b`**
> (Backlog P1/P2/P4/P5 erledigt; dieses Doku-Update bumpt auf v2.1.16).
> Pendant: `HANDOVER-NAS-SETUP.md` (Branch `nas-setup`, NAS-Welt).

## 0. SOFORT-EINSTIEG (TL;DR)

- **Wo:** Worktree `C:\Projects\ProTrackr_main`, Branch **`main`** (ausschließlich).
- **Stand:** v2.1.15 auf main + origin, Baum sauber. Fehler #1/#2/#3 erledigt,
  NAS-Rollout-Tooling + Deployment-Blueprint stehen, A5 komplett. **Backlog
  P1/P2/P4/P5 erledigt** (2026-07-03, je 3-Agenten-Workflow, siehe §6).
- **Offen (Backlog):** nur noch **P3 — persistenter Session-Store** (Infra +
  neue Dependency, bewusst vertagt). Details §6.1.
- **NAS-seitige Nachzügler** (eigener Chat, nicht hier): P1-Funktionsabnahme in
  NAS-Dev (`:9444`, Belege 580/581, Kunde 278) + P4-`build-arg` T3b.
- **Deploy:** committen + `git push origin main` — **kein localhost mehr**.
  Ausrollen auf den NAS läuft im **NAS-Setup-Chat** via `/nas-rollout`.

## 1. WIEDEREINSTIEGS-PROZEDUR (zuerst in der neuen Sitzung)

1. **Branch/Worktree prüfen:** `cd C:\Projects\ProTrackr_main` → `git branch
   --show-current` muss `main` sein; `git fetch origin` → sync mit `origin/main`
   prüfen (`git rev-list --left-right --count origin/main...HEAD`).
   NIE in `ProTrackr_developing_path` arbeiten (= nas-setup, NAS-Welt).
2. **Memory lesen:** `MEMORY.md` + verlinkte Einträge, v.a.
   [[feedback_deploy_workflow]] (nach A5 geändert!), [[feedback_worktree_separation]],
   [[feedback_3agent_workflow]], [[feedback_prod_only_via_dev_promotion]].
3. **Dieses Handover lesen.**
4. **Nächste Aufgabe:** P3 (Session-Store, §6.1) — vor Beginn Vorgehen/Test-
   Strategie mit dem User klären (Dependency + DB + Laufzeit-Test). Alle Code-
   Änderungen über den 3-Agenten-Workflow + Post-A5-Commit-Ablauf (§3, §6.3).

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

**⚠ Post-A5-Stolperfalle (Commits!):** Weil `MySQL84` jetzt Manual/aus ist,
scheitert der **`pre-commit`-Hook** — NICHT an den Tests (die sind grün), sondern
am **DB-Fixture-Cleanup** in `server/vitest.setup.ts` (`ECONNREFUSED
127.0.0.1:3306`). Lösung: **vor Code-Commits `Start-Service MySQL84`**
(Admin-PowerShell); für reine Doku-/Nicht-DB-Commits
**`SKIP_TEST_CLEANUP=1 git commit …`** (überspringt nur den Cleanup, Tests laufen
normal; Skip-Check in `vitest.setup.ts:22` vor dem DB-Connect). Steht auch in
Memory [[feedback_deploy_workflow]].
**Praxis (2026-07-03, P1/P2/P4/P5):** Alle vier Commits liefen problemlos mit
`SKIP_TEST_CLEANUP=1` — die betroffenen Änderungen legten keine DB-Fixtures an,
die 2 pre-commit-Tests sind DB-frei und grün. MySQL84 musste nicht gestartet
werden (A5-Zustand blieb erhalten).

## 4. AKTUELLER STAND

- **Version:** v2.1.15 · **HEAD:** `ee6cd2b` (= origin/main, synchron).
- **Letzte Arbeit (diese Sitzung, 2026-07-03):** Backlog P1/P2/P4/P5 abgearbeitet,
  jeweils Junior→Senior(APPROVE)→QA(tsc + 11 pre-commit-Tests grün), eigener
  Commit + Push:
  - **P1** `c8b9691` (v2.1.12) — Reisekosten-Attribution (`task_bba37780`): 3
    Render-Pfade auf `getExpenseBillingCustomerId` umgestellt, verwaiste
    Direktzuordnungs-Belege als eigene Zeilen (Bildschirm + PDF). Client-only.
  - **P2** `6c7ebe6` (v2.1.13) — `server/_core/index.ts`: rateLimit-keyGenerator
    IPv6-sicher via `ipKeyGenerator(req.ip ?? "")` (behebt `ERR_ERL_KEY_GEN_IPV6`).
  - **P4** `2924665` (v2.1.14) — `client/src/main.tsx`: `VITE_APP_TITLE`-Konsum
    verdrahtet (`document.title`, zwingender Fallback). NAS-Nachzügler: T3b.
  - **P5** `ee6cd2b` (v2.1.15) — `scripts/generate-version.js`: environment-Default
    `development`→`production` (kosmetisch, kein Konsument des Feldes).
- **Davor (Kontext):** Fehler #2 komplett live auf **v2.1.0** (`v2.1.0-phase3c-done`);
  Tech-Debt aggregateByCustomer entfernt (v2.1.1); NAS-Rollout-Tooling +
  Deployment-Blueprint (v2.1.2–v2.1.8); A5-Hook-Schritt (v2.1.9).
- **Freeze-Tags:** letzter Feature-Freeze `v2.1.0-phase3c-done`; v2.1.1–v2.1.15
  sind Tooling/Docs/Chore + kleine Fixes (kein Schema-Change).

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
- **Offene NAS-Nachzügler aus dieser main-Sitzung** (im NAS-Chat abzuarbeiten):
  1. **P1-Funktionsabnahme** in NAS-Dev `:9444` mit den echten Belegen (Kunde
     `customers.id=278` exclusive, `expenses` 580 flight 20000 EUR + 581 taxi
     25600 PLN, beide `date=2026-07-02`, `customerId=278`, `timeEntryId=NULL`).
     Erwartung: beide erscheinen in Buchhaltungsbericht-Detailzeile „Reisekosten
     (abrechenbar, nur Exclusive)", Kundenbericht-Detailtabelle (eigene Zeilen)
     und PDF-Kostenaufstellung (nicht mehr 0,00). Danach `task_bba37780` schließen.
  2. **P4-T3b:** build-arg für `VITE_APP_TITLE` im Container-Build setzen, damit
     die Var im Prod-Bundle ankommt (sonst greift der Fallback).

## 6. OFFENE PUNKTE / NÄCHSTE SCHRITTE

**Erledigt in dieser Sitzung:** P1, P2, P4, P5 (siehe §4). **Verbleibend: nur P3.**

### 6.1 — P3 / M1: persistenter Session-Store (Infra, ~40 Min + Test) — VERTAGT
**Vom User am 2026-07-03 bewusst vertagt** (Infra + Dependency + Laufzeit-Test
brauchen eine fokussierte Runde). Vor Beginn Vorgehen/Test-Strategie klären.
- **Ist-Zustand:** `server/_core/index.ts` (~Z.66) ruft `session({...})` **ohne
  `store`** → Default `MemoryStore` (in-memory). Folge: jeder Server-Restart/Deploy
  loggt alle Nutzer aus; MemoryStore ist nicht production-tauglich.
- **Fix:** `express-mysql-session` als Store einsetzen (`sessions`-Tabelle, Sessions
  überleben Restart). `pnpm add express-mysql-session` + `-D
  @types/express-mysql-session`. Store aus `DATABASE_URL`; sauberer wäre, den
  **bestehenden mysql2-Pool wiederzuverwenden** statt DATABASE_URL neu zu parsen
  (im Code prüfen, ob ein Pool exportiert ist). `createDatabaseTable:true` legt die
  Tabelle automatisch an (alternativ echte drizzle-Migration).
- **Umfang/Achtung:** neue Dependency (package.json + Lockfile — der NAS-Container-
  Build muss sie ziehen); `sessions`-Tabelle = DB-Effekt; Session-Funktion wird
  DB-abhängig (bei DB-Ausfall keine Sessions — App braucht DB aber ohnehin).
- **Verifikation:** „Login → Restart → noch eingeloggt?" braucht laufende Instanz +
  DB. Lokal nur mit `Start-Service MySQL84` + `npm run dev` (durchbricht A5) — oder
  natürlicher in **NAS-Dev** (Governance-Funktionsabnahme durch User).

### 6.2 A5 (localhost-Shutdown) — Status
- **Komplett abgeschlossen** (main + NAS): Hook-Restart-Block entfernt (v2.1.9),
  MySQL84 gestoppt/Manual, localhost:3001 aus. NAS = einzige Instanz. Siehe
  [[project_a5_localhost_shutdown]].

### 6.3 Rahmen-Regeln für die Umsetzung (verbindlich)
- **3-Agenten-Workflow** (Junior/Senior/QA) für ALLE Code-Änderungen
  ([[feedback_3agent_workflow]]). Bewährt in dieser Sitzung: präzise Junior-Spec →
  unabhängiger Senior-Review (APPROVE) → QA (tsc + vitest) → Commit → Push.
- **Commit-Ablauf:** `SKIP_TEST_CLEANUP=1 git commit …` reicht für Nicht-DB-Fixes;
  post-commit bumpt + baut + amended (Version-Dateien einfolden, dist/ nicht
  versioniert). Nach Push Drift prüfen (`0 0`); sw.js kann driften → ggf.
  `git checkout -- client/public/sw.js`.
- **Nach main-Änderungen NUR committen + pushen**; NAS-Deploy separat im NAS-Chat
  via `/nas-rollout`; **niemals `nas-setup → main`** ohne Freigabe.

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
  nur ab Cutover 2026-07-01. `customerData.customerExpensesDetailed` ist bereits
  via diese Funktion gefiltert → Summen stimmen; nur Pro-Zeile-Zuordnung
  (`timeEntryId === entry.id`) verlor „verwaiste" Belege (P1-Fix, 2026-07-03).
- **`import.meta.env.VITE_*`** ist im Client typkonform (Präzedenz `Map.tsx`).
  Für Titel/Fallback `||` statt `??` (fängt auch leeren String ab).

## 9. ROLLBACK-/SICHERHEITSPUNKTE

- Alles auf **GitHub `DoeringConsulting/ProTrackr`**, `origin/main` = `ee6cd2b`
  (v2.1.15). Freeze-Tags für Meilensteine (`v2.1.0-phase3c-done` etc.).
- Kein Datenverlustrisiko durch die bisherige main-Arbeit — P1/P2/P4/P5 waren
  reine Code-/Config-Fixes ohne Schema-/DB-Eingriff; Tests grün. **P3 wird das
  ändern** (DB-`sessions`-Tabelle + Dependency) → dort vor Umsetzung Backup/Test-
  Strategie festlegen.
- NAS bleibt unberührt, solange kein Rollout im NAS-Chat gefahren wird.
