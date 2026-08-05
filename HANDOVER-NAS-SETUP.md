# HANDOVER — ProTrackr NAS-Setup (Sitzungs-Übergabe)

> **Zweck:** Vollständiger, self-contained Wiedereinstiegspunkt für den **NAS-Setup-Chat**.
> **Stand:** 2026-08-05 · **Branch:** `nas-setup` (HEAD `4752ac0`, v2.7.9) · in Sync mit origin.
> **Status:** Rollout **v2.7.9 auf DEV live und abgenommen-mit-Befunden**. **PROD steht auf v2.5.0**
> — Promotion **bewusst offen** (Entscheidung Account-Inhaber, siehe §0.1).
> **Migration 0021 ist auf PROD nachgezogen** (2026-08-05 12:37, §6.1) — Promotions-Blocker gefallen.
> **Bei Wiedereinstieg zuerst:** §0 lesen, dann Ist-Stand selbst verifizieren (§1.4).

---

## 0. SOFORT-EINSTIEG (TL;DR)

ProTrackr läuft in **zwei isolierten Umgebungen auf dem Unraid-NAS (DCS01)**: **PROD** (`:9443`,
echte Daten, **v2.5.0**) + **DEV** (`:9444`, **v2.7.9**, frischer Prod-Klon). Der Laptop ist reine
Autoren-Maschine (kein localhost seit A5).

### 0.1 Was JETZT offen ist (Priorität)

| # | Punkt | Status |
|---|---|---|
| **1** | **Promotion v2.7.9 → PROD** | **offen** — Dev-Abnahme brachte Befunde (§7), Account-Inhaber entscheidet, ob vor oder nach Fix promotet wird |
| **2** | ~~Migration 0021 auf PROD nachziehen~~ | ✅ **ERLEDIGT 2026-08-05 12:37** (§6.1) — Blocker gefallen |
| **3** | App-Befunde aus der Dev-Abnahme | **an MAIN übergeben** (§7) — vier Punkte, davon einer am neu ausgerollten Feature |
| **4** | History-Lücke `NAS_SETUP_HISTORY.md` | **offen** — letzter Eintrag ist 2026-07-06; die Rollouts **v2.5.0** (15.07.) und **v2.7.9 auf Dev** (04./05.08.) sind dort nie eingetragen worden |

---

## 1. WIEDEREINSTIEGS-PROZEDUR

1. **Memory + dieses Handover lesen.** Besonders `feedback_worktree_separation`,
   `feedback_prod_only_via_dev_promotion`, `project_reisekosten_fachregeln`.
2. **Worktree/Branch:** `C:\Projects\ProTrackr_developing_path`, Branch `nas-setup`.
   ```
   git branch --show-current      # MUSS nas-setup sein
   git fetch origin && git status -sb
   ```
3. **⚠️ NICHTS aus Dokumenten als Ist-Stand übernehmen** — Lesson §9.10. Immer selbst messen.
4. **Ist-Stand verifizieren — `/version.json` ROH, nicht der Footer:**
   ```powershell
   Invoke-RestMethod https://dcs01.taile370c2.ts.net:9444/version.json -SkipCertificateCheck  # DEV
   Invoke-RestMethod https://dcs01.taile370c2.ts.net:9443/version.json -SkipCertificateCheck  # PROD
   ```

---

## 2. AKTUELLER LIVE-STAND (verifiziert 2026-08-05)

| | **PROD** | **DEV** |
|---|---|---|
| URL | `https://dcs01.taile370c2.ts.net:9443` | `https://dcs01.taile370c2.ts.net:9444` |
| Host-Port → Container | 3010 → 3000 | 3011 → 3000 |
| Compose | `docker-compose.yml` | `compose.dev.yml` (Projekt `protrackr-dev`) |
| App-/DB-Container | `protrackr-app` / `protrackr-mysql` | `protrackr-app-dev` / `protrackr-mysql-dev` |
| Image | `protrackr-app:latest` | `protrackr-dev-app:latest` |
| **Version** | **2.5.0** | **2.7.9** |
| **buildTime (roh)** | **15.07.2026 19:41:57** | **04.08.2026 22:15:21** ← Promotion-Vergleichswert |
| Migration 0021 | vorhanden ✓ (nachgezogen 2026-08-05 12:37) | vorhanden ✓ (nachgezogen 2026-08-05) |
| Daten | Wahrheit | frischer Prod-Klon (2026-08-05) |

- **TZ verifiziert:** App **und** MySQL, Dev **und** Prod → `Europe/Warsaw` / `CEST`,
  `@@time_zone=SYSTEM`, `NOW()` deckungsgleich. Die Projekt-TZ ist im Repo **nirgends** gesetzt —
  Korrektheit hängt allein an dieser Container-Einstellung.
- **Rollback-Ziel ist 2.5.0** (nicht 2.4.0).

---

## 3. GIT-STAND

- `nas-setup` HEAD **`4752ac0`** = `rollout: main 2.7.9 (c082f6a) -> nas-setup`, gepusht.
- Maßgebliches Manifest **`.claude/rollouts/2.7.9.json`** (Commit `c082f6a`, Freeze-Tag `v2.7.9`).
  **2.7.4.json und älter sind überholt** (rollen die Zeitzonen-Härtung nicht mit aus).
- Merge war konfliktfrei, **keine NAS-only-Datei** berührt, **keine neue `drizzle/*.sql`**.
- Kumulierter Release gegenüber Prod 2.5.0: **2.5.2 + 2.5.5 + 2.6.0 + 2.6.2 + 2.6.4 + 2.7.0 +
  2.7.3 + 2.7.4 + 2.7.9**.

---

## 4. VORPRÜFUNGEN — alle bestanden (2026-08-05, read-only gegen PROD)

**(a) ADR 0002 / Reisekosten-Attribution (`analyze-expense-attribution.mjs`, v2.7.9-Fassung):**
- Monatsverschiebung: **2 Belege** — #596 (Fritzmeier, 150 EUR, Juni→Juli, `exclusive`, **gewollt**)
  und #368 (273 EUR, nicht zugeordnet, kein Kundeneffekt).
- Enddatum-Datenqualität: **9 Belege**, alle Flüge, alle unkritisch (One-Way / Round-Trip im selben
  Monat / 0 EUR). Hotels **48/48 sauber**.
- **Dritter Befund-Typ (kategoriefremdes Enddatum, ADR 0002 offener Punkt 5): 0 Treffer.**
- → **KEIN Backfill nötig.**

**(b) Schema-Ist gegen `drizzle/schema.ts`** (`information_schema`, beide DBs): siehe §6.1.

---

## 5. ROLLOUT-ABLAUF (Referenz)

1. Manifest bit-identisch aus `origin/main` bereitstellen (Blob-Weg, §9.3) + committen.
2. Probe-Merge (`git merge --no-commit --no-ff <commit>` → prüfen → `--abort`), dann
   `pwsh ./scripts/rollout-to-nas.ps1 -ManifestPath … -Execute` + `git push`.
3. **DB-Backup** (Dev) → `./scripts/deploy-dev.sh` → Health-Gate `:9444`.
4. **Dev-Abnahme durch den Account-Inhaber.**
5. Nach Freigabe: ggf. Migrationen auf Prod (§9.9), dann `./scripts/deploy-prod.sh` (`PROMOTE`),
   **roh-buildTime Dev==Prod prüfen**, Tag `nas-rollout/<version>`, `.DONE`.

---

## 6. OFFENE PFLICHT-PUNKTE VOR DER PROMOTION

### 6.1 ✅ Migration 0021 auf PROD nachgezogen (2026-08-05 12:37) — ERLEDIGT

Bestandsproblem, keine Release-Folge. Ausgeführt als die **einzige freigegebene Ausnahme** von der
Promotion-Governance (§8), mit Backup, **vor** der Promotion.

**Vorher/Nachher (`information_schema`, selbst gemessen):**

| | `expenses.category` |
|---|---|
| PROD **vorher** | 10 Werte — `mileage_allowance` fehlte |
| PROD **nachher** | **11 Werte ✓ — identisch mit DEV** |

**Ausgeführter Ablauf:**
1. **Backup** `db-migration/prod-pre-migrate-0021_2026-08-05_12-37-55.sql` (5.946.365 B, 17 Tabellen,
   Endmarker `Dump completed`, 0 `mysqldump:`-Fehlerzeilen) — Kommando formatgleich zu `deploy-prod.sh`.
2. **Guard vor dem ALTER:** Backup musste die **Vorher-ENUM-Definition ohne** `mileage_allowance`
   nachweislich enthalten, sonst Abbruch. Bestanden.
3. **ALTER** aus der Repo-Datei `drizzle/0021_expenses_add_mileage_allowance.sql`
   (`md5 efdbbd18fe97e8843e0fbb6b9ea7fb82`) via `docker exec -i … mysql <`, Exit 0, keine Warnungen.
4. **Verifikation:** `SHOW COLUMNS` = 11 Werte; App healthy; PROD extern weiter auf v2.5.0; App-Log leer.

> **⚠️ RISIKO-DETAIL, das die Ursprungsplanung nicht benannte:** Der neue Wert wird an **Position 6
> eingefügt**, nicht angehängt — `hotel`/`fuel`/`meal`/`food`/`other` verschieben sich im internen
> ENUM-**Index** um eins. MySQL mappt bei einer Mitten-Einfügung über die **Strings**
> (`ALGORITHM=COPY`, Table-Rebuild), nicht über die Indizes. **Nachgewiesen statt angenommen:** die
> Kategorie-Verteilung wurde vorher und nachher erhoben und ist **byte-identisch** —
> `car 13 · train 17 · flight 32 · taxi 91 · transport 6 · hotel 48 · fuel 6 · other 6`, **Gesamt 219**,
> dazu **0** leere/`NULL`-Kategorien. Bei einem index-basierten Mapping wäre die Verteilung verschoben.
> **Diese Vorher/Nachher-Erhebung ist bei jeder künftigen ENUM-Mitten-Einfügung Pflicht.**

**Alle übrigen Migrationen sind auf beiden DBs vollständig** (0013–0016, 0022, 0023, 0024, 0025
gezielt geprüft; Spaltenmengen Prod == Dev == Soll).

> **SYSTEMISCHE LESSON:** 0024 lag auf der DB, 0021 nicht — der Migrationsstand folgt **keiner**
> Reihenfolge und ist mangels Tracking (Migrationen werden von Hand via `mysql2` angewandt) **nicht
> ablesbar**. Die Manifest-Aussage „keine neue Migration" gilt dem **Versionssprung** und sagt nichts
> über die Vollständigkeit des Altbestands. **Vor jedem Rollout Schema-Ist gegen `schema.ts`
> abgleichen** (Query siehe §9.11).

### 6.2 Beobachtung ohne Handlungsbedarf

`taxProfiles.taxModuleEnabled` existiert in **beiden** DBs, steht aber nicht in `schema.ts` —
tote Spalte aus einer früheren Entfernung ohne `DROP COLUMN`. Harmlos, kein Blocker.

---

## 7. DEV-ABNAHME 2026-08-05 — BEFUNDE (Zulieferung an MAIN)

Der Account-Inhaber hat v2.7.9 auf `:9444` mit Echtdaten visuell/funktional geprüft. **Ergebnis:
vier Befunde + eine neue Aufgabe.** Diese sind **App-Themen und gehören auf `main`** — hier nur
dokumentiert, damit die Promotion-Entscheidung informiert getroffen werden kann.

### B1 — Dashboard: Brutto ≠ Netto + Kosten (analysiert, KEIN Rechenfehler)

**Beobachtung (Kumuliert-Ansicht, Okt. 26, Prognose):** Brutto 1.117.727,14 PLN ·
Netto 573.521,11 PLN · Kosten 329.457,33 PLN → **Delta 214.748,70 PLN**.

**Ursachenanalyse (Code-verifiziert, `Dashboard.tsx:433-580`, `monthlyFinancials.ts`):**
- Die **Kostenlinie** enthält ausschließlich **Betriebskosten**: variable Run-Rate (Ø 3 abgeschlossene
  Monate: **alle Reisekosten/Spesen + Provision an Vermittler**) **+ ein Monat Fixkosten**
  (`monthlyForecastCostPln = runRateVariablePln + monthlyFixedCostsPln`, Zeile 538).
- Der **Nettogewinn** stammt aus `computeMonthlyTaxSeries` → `result.netProfit`, also
  **nach Abzug von ZUS, Zdrowotna und PIT** (Kommentar Zeile 567: „… − Run-Rate-Kosten → **Steuer**").
- **Das Delta ist damit die Steuer- und Sozialabgabenlast**, die in **keiner** Chart-Linie sichtbar ist.
  Plausibilitätsprobe: 214.748,70 / (1.117.727,14 − 329.457,33) ≈ **27,2 %** — passt zu
  PIT liniowy 19 % + Zdrowotna 4,9 % + ZUS.
- **Zusatzeffekt:** Exklusive Reisekosten sind **Pass-Through** — sie stehen **gleichzeitig** im
  Bruttoumsatz **und** in den Kosten (fachlich korrekt, netto null auf die Steuerbasis), was die
  Zahlen zusätzlich „nicht aufgehen" lässt.

**→ Kein Bug, sondern eine Darstellungs-/Erwartungslücke.** Entscheidung für Main (K14): entweder
eine **Steuer-/Abgabenlinie** ergänzen, oder Legende/Tooltip klarstellen („Kosten = Betriebskosten
ohne Steuern"). *Hypothese ist code-belegt, aber nicht gegen die konkreten Zahlen nachgerechnet.*

### B2 — Zeiterfassung „Zeitraum kopieren": Monatsgrenze + Wochenend-Prompt

**Anforderung des Account-Inhabers:**
- Beim Kopieren eines Monats in den Folgemonat **nur vom Ersten bis zum Letzten des Zielmonats**
  einfügen — **nie darüber hinaus**.
- Weiterhin **wochentagsdeckungsgleich**.
- **Wochenenden:** Rückfrage (Prompt), ob Wochenend-Einträge übernommen werden sollen.

**Einordnung:** Betrifft das **mit v2.7.0/v2.7.3 neu ausgerollte** Feature → **promotionsrelevant**.

### B3 — Flüge: Hin-/Rückflug-Kennzeichnung existiert NICHT (Code-verifiziert)

**Frage des Account-Inhabers:** Ist die Hin-/Rück-Kennzeichnung in ProTrackr hinterlegt oder kommt
sie mit den importierten Reisekostendaten — und ist sie überschreibbar?

**Befund — die Kennzeichnung gibt es in keiner Form:**
- `expenses.flightRouteType` (`varchar(20)`) sieht danach aus, kodiert aber **`domestic` |
  `international`** = **Inland/Ausland (Geografie)**, **nicht** Hin-/Rückflug. Belegt durch
  `server/routers.ts:220` (`z.enum(["domestic","international"])`), `expenseImportV1.ts:67`,
  `receiptAi.ts:268`. Verwendet wird es **nur** im PDF-Export
  (`reportPdfExports.ts:187`: „Miedzynarodowy"/„Krajowy"). In den Prod-Daten steht durchgehend
  `international`.
- **Überschreibbar ist nur `domestic`/`international`** (UI in `TimeTracking.tsx:969`,
  `setTempFlightRouteType`) — nicht die Richtung.
- Das einzige richtungsbezogene Feld ist **`checkOutDate` = Rückflugdatum**, und das nur bei
  **Hin-/Rückflug auf EINEM Ticket** (ADR 0002). In der Praxis werden Flüge fast immer als
  **getrennte Einzelstrecken** erfasst → `checkOutDate` bleibt NULL.

**→ Neues Feature für Main:** Feld `flightDirection` (`outbound` | `return`), mit **Auto-Vorschlag**
nach der Fachregel (Ziel-Flughafen **KTW/KRK** bzw. Richtung Polen = **Rückflug**; aus Polen heraus,
v. a. Mo/Di = **Hinflug**; bei Umstieg entscheidet der **letzte** Flughafen) und **manueller
Überschreibbarkeit**. Fachregel liegt in Memory `project_reisekosten_fachregeln` und
`docs/SPEC-Reisekosten-Abgrenzung.md` v1.1.0 §3.2. Braucht Migration + UI + Import-/KI-Pfad.

### B4 — Neue Aufgabe: Überarbeitung des Imports

„Smarter, intuitiver, effektiver." Noch nicht spezifiziert — eigenes Vorhaben für Main
(Scope/Ziele mit dem Account-Inhaber klären, K14).

---

## 8. GOVERNANCE (verbindlich)

- **PROD-Änderungen ausschließlich via DEV → Test → Freigabe → Promotion.** Einziger legitimer
  Prod-Weg ist `deploy-prod.sh` (Gate `PROMOTE`, Backup, Rollback-Image, Health-Gate, Auto-Rollback).
  Die einzige freigegebene Ausnahme — **Migration 0021** — ist am 2026-08-05 12:37 **verbraucht**
  (§6.1). **Es besteht derzeit keine offene Ausnahme;** jeder weitere Prod-Eingriff braucht eine
  neue, ausdrückliche und schrittbezogene Freigabe des Account-Inhabers.
- **Read-only-Zugriffe auf Prod** (Analyse-Skript, `information_schema`) sind **kein** Prod-Deploy und
  lösen keinen Guard-Alarm aus (`docker exec` erzeugt kein start/die-Event).
- **Niemals `nas-setup → main` mergen** ohne ausdrückliche Freigabe. `main → nas-setup` ist der
  Rollout-Weg.
- **Keine eigenmächtigen TZ-Änderungen** — HANDOVER-MAIN §6.10: die Wandzeit-Konvention von
  `timeEntries.date` und die Tagesgrenzen in `db.ts` sind **beide +2 h und heben sich auf**;
  ein einseitiger Fix zerstört die Kompensation.

---

## 9. LESSONS LEARNED

1. **Post-A5-Commits:** Der NAS-Worktree hat **kein `node_modules`** → `pre-commit` scheitert mit
   `ERR_MODULE_NOT_FOUND: vitest`. Lösung: `RICHTLINIE_AUSNAHME=1 git commit --no-verify …`,
   gedeckt durch **`docs/adr/ADR-0001-nas-worktree-rollout-no-verify.md`** (gilt nur für
   Rollout-/Metadaten-/Doku-Commits, **nicht** für Logik-Änderungen an Infra-Skripten).
   *(Namenskollision: main hat ein fachlich anderes `docs/adr/0001-reisekosten-…` — beide „0001".)*
2. **`rollout-to-nas.ps1`:** löst nur Versionsdatei-Konflikte (`--theirs`), bricht bei App-Konflikten ab.
3. **Manifest bit-identisch holen** (Git-Bash verhaspelt `git show ref:.claude/…`): Blob-Weg —
   `BLOB=$(git ls-tree origin/main <pfad> | awk '{print $3}'); git cat-file blob "$BLOB" > datei`,
   danach mit `git hash-object` gegen `$BLOB` verifizieren.
4. **Probe-Merge vor `-Execute`:** `git merge --no-commit --no-ff <commit>` → Konflikte + NAS-only-
   Dateien prüfen → `git merge --abort`. Konfliktfreier Merge löst keinen `git commit` im Skript aus
   (und damit nicht den scheiternden pre-commit-Hook).
5. **Compose:** Dev nutzt `env_file: [.env.dev]`; Healthcheck-Passwort `CMD-SHELL` + `$$VAR`.
6. **`docker events`** → `{{.Action}}`, nicht `.Status` (Docker 29.x).
7. **Alpine hat kein tzdata** → `apk add tzdata`; Windows→Linux MySQL braucht `lower_case_table_names=1`.
8. **`mysqldump`-stderr** nie nach stdout mergen (landet sonst als SQL im Dump → `ERROR 1064`);
   Import-Stream durch `grep -v '^mysqldump:'` filtern, `--no-tablespaces` nutzen.
9. **★ Rollout mit Schema-Change:** `deploy-dev.sh`/`deploy-prod.sh` machen **keine** Migration und
   **kein** Schema-Backup. Prozedur je Umgebung (Dev zuerst): Merge+Push → NAS `git reset --hard
   origin/nas-setup` → **DB-Backup manuell** → **Migration via `docker exec -i <db> … mysql < drizzle/NNNN.sql`**
   → **`SHOW COLUMNS` verifizieren** → dann `deploy-*.sh`.
10. **★ Ist-Stand niemals aus Dokumenten übernehmen.** „PROD = v2.4.0" war eine unbestätigte Annahme,
    die über mehrere Sessions als Fakt weitergetragen wurde — tatsächlich lief **2.5.0**. Immer
    `/version.json` **roh** abrufen (`curl`/`Invoke-RestMethod`), **nie** den Footer: `buildTime`
    entsteht als **UTC**, der Footer rendert vor v2.7.9 in der Zeitzone des **Betrachters**
    (19:41 UTC == 21:41 CEST — es gab **keinen** separaten Build). v2.7.9 pinnt die Anzeige auf
    Europe/Warsaw. **Bit-Identität immer über den rohen Wert prüfen.**
11. **★ Schema-Ist prüfen statt annehmen.** Read-only-Query für beide DBs:
    ```sql
    SELECT CONCAT(TABLE_NAME,'.',COLUMN_NAME), COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA='protrackr' AND DATA_TYPE='enum' ORDER BY 1;
    SELECT TABLE_NAME, COUNT(*), GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION)
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='protrackr' GROUP BY TABLE_NAME;
    ```
12. **★ „Failed query" steht NICHT im Container-Log** — tRPC reicht DB-Fehler an den Client durch,
    ohne sie serverseitig zu protokollieren. `docker logs | grep "Failed query"` ist eine Sackgasse.
    Bei kategorie-/feldspezifischen Fehlern **zuerst Spalten- und ENUM-Definition** gegen
    `information_schema` prüfen, erst danach Fremdschlüssel.
13. **Prod→Dev-Klon** (`clone-prod-to-dev.sh`) bringt die **Prod-Struktur** mit — also auch deren
    Migrations-Lücken. Nach einem Klon ggf. fehlende Migrationen auf Dev **erneut** nachziehen
    (genau so geschehen mit 0021 am 2026-08-05).

---

## 10. ROLLBACK

1. **Git-Tags** (`vX.Y.Z`, `nas-rollout/X.Y.Z`) — jede Version 1:1 neu baubar. Immer verfügbar.
2. **Rollback-Image** — `deploy-prod.sh` taggt das alte Prod-Image vor jeder Promotion
   (`protrackr-app:rollback-<TS>`); Rückfall in Sekunden, **Daten bleiben**.
3. **Prod-DB-Backups** `db-migration/prod-pre-promote-*.sql`; Auto-Rollback bei Health-Gate-Fehler.
4. **Dev ist Wegwerf:** `docker compose -f compose.dev.yml down -v` + `clone-prod-to-dev.sh --yes`.
   Aktuelles Dev-Backup: `db-migration/dev-pre-2.7.9.sql` (5,9 MB, 2026-08-05).
5. **Rollback-Ziel dieser Runde ist 2.5.0.**

---

*Ende Handover. Volle Chronik: `NAS_SETUP_HISTORY.md`. Regeln: Memory-Dateien + `CLAUDE.md`.*
