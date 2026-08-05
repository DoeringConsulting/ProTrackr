# HANDOVER — ProTrackr NAS-Setup (Sitzungs-Übergabe)

> **Zweck:** Vollständiger, self-contained Wiedereinstiegspunkt für den **NAS-Setup-Chat**.
> **Stand:** 2026-08-05 · **Branch:** `nas-setup` (HEAD `482a07b`, v2.9.0) · in Sync mit origin.
> **Status:** ✅ **v2.9.0 ist auf DEV live** (Deploy 2026-08-05 18:49, Migration **0026** um 18:47
> davor angewendet) — **wartet auf die fachliche Abnahme des Account-Inhabers.**
> **PROD steht unverändert auf v2.7.9** und wurde in dieser Runde **nicht angefasst**;
> die Promotion erfolgt erst nach der DEV-Abnahme und ausdrücklicher Freigabe.
> **Bei Wiedereinstieg zuerst:** §0 lesen, dann Ist-Stand selbst verifizieren (§1.4).

---

## 0. SOFORT-EINSTIEG (TL;DR)

ProTrackr läuft in **zwei isolierten Umgebungen auf dem Unraid-NAS (DCS01)**: **PROD** (`:9443`,
echte Daten, **v2.7.9**) + **DEV** (`:9444`, **v2.9.0**, Prod-Klon + Migration 0026). Der Laptop ist
reine Autoren-Maschine (kein localhost seit A5).

### 0.1 Was JETZT offen ist (Priorität)

| # | Punkt | Status |
|---|---|---|
| **1** | **Fachliche Abnahme v2.9.0 auf DEV** (`:9444`) | **offen — liegt beim Account-Inhaber.** Sieben Schritte in `HANDOVER-MAIN.md` §0.1 (main-Repo). Schwerpunkt: Befund **B3** (Flugstrecke + Hin-/Rückflug) und die **B2-Kopierregel** aus v2.8.0 |
| **2** | **Promotion v2.9.0 → PROD** | **gesperrt bis zur Abnahme.** Danach ausdrückliche Freigabe nötig. ⚠️ **Migration 0026 muss auf PROD VOR dem Container-Start laufen** — siehe §6.3 |
| **3** | App-Befunde aus der v2.7.9-Abnahme | **B1 + B2 sind mit v2.8.0 gefixt, B3 mit v2.9.0** (beide auf DEV). **B4** (Import-Überarbeitung) ist auf main angehalten |
| **4** | Doku-Schuld aus früheren Runden | **offen, zwei Teile:** (a) `NAS_SETUP_HISTORY.md` hat eine Lücke **2026-07-06 → 2026-08-05** — die Rollouts **v2.5.0** (15.07.) und **v2.7.9 auf Dev** (04./05.08.) fehlen dort; (b) der Tag **`nas-rollout/2.5.0` fehlt** (Rollout-Commit `6bd1dd6` existiert). Bewusst **nicht** rekonstruiert — der damalige Vorgang ist hier nicht verifizierbar (Lesson §9.10) |
| **5** | Zwei Werkzeug-Mängel aus dieser Runde | **offen, gehören auf `main`** — Manifest-Umgebungsdaten und Konflikt-Klassifikation in `rollout-to-nas.ps1`, siehe §6.4 |

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
| **Version** | **2.7.9** | **2.9.0** |
| **buildTime (roh)** | **2026-08-04T22:15:21.391Z** | **2026-08-05T16:49:04.505Z** |
| Migration 0021 | vorhanden ✓ (nachgezogen 2026-08-05 12:37) | vorhanden ✓ |
| **Migration 0026** | **NICHT vorhanden** — kommt erst mit der Promotion (§6.3) | **vorhanden ✓** (2026-08-05 18:47) |
| Daten | Wahrheit (219 Belege / 160 Zeiteinträge / 3 Kunden) | Prod-Klon, 219 Belege unverändert |

**Bit-Identitäts-Nachweis der Promotion (2026-08-05 13:23 CEST):** Die rohen `/version.json`-Bodies
von `:9443` und `:9444` sind **byte-identisch** — SHA256
`DCFB0B14898BFD703F4D564C535912C5189B7A0DF5D2717D0C420F782C49FC38` auf beiden Seiten.
**Ungeparst gemessen** (`Invoke-WebRequest .Content`): `Invoke-RestMethod` wandelt `buildTime` in ein
`DateTime` um und ist damit bereits eine Interpretationsebene — genau wovor Lesson §9.10 warnt.

- **TZ verifiziert:** App **und** MySQL, Dev **und** Prod → `Europe/Warsaw` / `CEST`,
  `@@time_zone=SYSTEM`, `NOW()` deckungsgleich; nach dem Prod-Neustart erneut geprüft. Die
  Projekt-TZ ist im Repo **nirgends** gesetzt — Korrektheit hängt allein an dieser
  Container-Einstellung.
- **Rollback-Ziel ist jetzt 2.5.0** über das Image `protrackr-app:rollback-2026-08-05_13-23-12`
  (`9e426a871909`) — siehe §10.

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

## 6. PFLICHT-PUNKTE VOR DER PROMOTION — alle erledigt

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

### 6.3 ⛔ Migration 0026 muss auf PROD VOR dem Container-Start laufen

Gilt für die kommende Promotion v2.9.0 → PROD. **Neue Spalten sind härter als neue ENUM-Werte.**

`0026_expenses_flight_route.sql` fügt `expenses` drei Spalten hinzu (`departureAirport`,
`arrivalAirport` `VARCHAR(3)`, `flightDirection` `ENUM('outbound','return')`) — additiv und nullable,
kein Backfill. **Drizzle erzeugt nie `SELECT *`**: auch `db.select().from(expenses)` listet jede
Schema-Spalte namentlich auf. Die neue App gegen eine DB ohne 0026 lässt deshalb **jeden** Zugriff
auf `expenses` scheitern — Belegliste, Bericht, Kopierlauf **und das Backup**.

**Reihenfolge auf PROD (nicht tauschen):** Backup (läuft noch mit der alten App — richtig so) →
`ALTER` aus der Repo-Datei → Spaltenexistenz **und** Zeilenzahl gegenprüfen → erst dann
`deploy-prod.sh`.

> **Rollback-Asymmetrie, andersherum als bei ENUMs:** Den Container zurückrollen, während die
> Spalten stehen bleiben, ist **unbedenklich** (die alte App kennt sie nicht). Die Spalten
> entfernen, während die neue App läuft, legt die Anwendung **lahm**.

**Auf DEV am 2026-08-05 18:47 so durchgeführt und verifiziert:** 3 Spalten an Position 12–14,
219 Zeilen unverändert, 0 belegte Werte, Backup `db-migration/dev-pre-2.9.0.sql` (5.987.053 B) mit
vorgeschaltetem Guard, dass es den Vorher-Zustand ohne die neuen Spalten enthält.

### 6.4 Zwei Werkzeug-Mängel aus dem v2.9.0-Rollout (gehören auf `main`)

**(a) Die Umgebungsdaten im Manifest sind falsch.** `2.9.0.json` nennt Container, die es nicht gibt,
und mischt PROD-Werte in die generischen Blöcke:

| Manifest | tatsächlich |
|---|---|
| `environments.dev.dbContainer: "mysql-dev"` | `protrackr-mysql-dev` |
| `environments.prod.dbContainer: "mysql-prod"` | `protrackr-mysql` |
| `environments.prod.appContainer: "protrackr-app-prod"` | `protrackr-app` |
| `environments.prod.composeFile: "compose.prod.yml"` | `docker-compose.yml` |
| `database.container` / `app.*` (generisch) | zeigen auf **PROD** (`protrackr-mysql`, Port 3010) |

Wer dem Manifest folgt, sichert bei einem **Dev**-Rollout über `database.container` die **PROD-DB** —
ein Bruch von Leitplanke 5. Zusätzlich steht `source.freezeTag` auf `"v2.8.0"`, obwohl die Release
2.9.0 ist und `v2.9.0` auf genau diesem `source.commit` liegt. Diese Felder stammen aus
`scripts/generate-rollout-manifest.mjs` und sind dort zu korrigieren.
**Bis dahin gilt: Umgebungswerte immer per `docker ps` bestätigen, nie aus dem Manifest übernehmen.**

**(b) `rollout-to-nas.ps1` klassifiziert Manifest-Konflikte als App-Konflikte.** `$VersionFiles`
(Zeile 30–34) kennt nur die sieben Versionsdateien; ein Konflikt in `.claude/rollouts/*.json` fällt
damit in den `nonVersion`-Zweig und bricht mit „App-Konflikte — bitte im Main-Chat klären" ab. Genau
das trat hier auf: main hatte sein `2.7.9.json` nachträglich um die 0021-Warnung ergänzt (`9421547`),
die NAS-Seite hatte ihre Kopie schon bereitgestellt → add/add-Konflikt, einziger Unterschied das
`notes`-Feld. Sinnvoll wäre, `.claude/rollouts/*.json` derselben `--theirs`-Regel zu unterstellen
(main ist für Manifeste die Quelle der Wahrheit). Zweitens scheitert das `git commit --no-edit` des
Skripts im NAS-Worktree ohnehin am `pre-commit`-Hook (kein `node_modules`) — der Konfliktpfad ist
dort also generell nicht lauffähig.

---

## 7. DEV-ABNAHME 2026-08-05 — BEFUNDE (Zulieferung an MAIN)

Der Account-Inhaber hat v2.7.9 auf `:9444` mit Echtdaten visuell/funktional geprüft. **Ergebnis:
vier Befunde + eine neue Aufgabe.** Diese sind **App-Themen und gehören auf `main`** — hier nur
dokumentiert, damit die Promotion-Entscheidung informiert getroffen werden kann.

> **Stand nach der Promotion:** Der Account-Inhaber hat am 2026-08-05 entschieden, **vor** dem
> B2-Fix zu promoten. Alle vier Befunde sind damit **auf PROD gegen Echtdaten wirksam** — B2 als
> einziger davon am neu ausgerollten Feature. **Entscheidungsgrundlage war (im NAS-Chat am Code
> von v2.7.9 verifiziert, nicht aus Dokumenten übernommen):** B2 ist eine **Anforderungsänderung,
> kein stiller Fehler.** Das Überlaufverhalten ist in `shared/copyRangeShift.ts:123-131` bewusst
> konstruiert und begründet, und der Kopier-Dialog **warnt im Klartext**
> (`TimeTracking.tsx:1152`): „Einträge vom Monatsende (29.–31.) können in den übernächsten Monat
> rutschen, wenn der Zielmonat den Wochentag nicht mehr hergibt." Auslöser eng begrenzt: nur
> `scope: "month"`, nur Quelltage 29.–31., nur wenn der Zielmonat das 5. Wochentag-Vorkommen nicht
> hat. **Konkret real:** Fr 31.07.2026 → August hat nur vier Freitage → Ziel wäre **04.09.2026**.
> Die Bereichs-Vorschau des Dialogs (`getScopeRanges`, `month`-Zweig) bildet den Regelfall ab und
> zeigt diesen Sprung **nicht** — der Warntext darüber schon.

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
5. **Rollback-Netze nach der Promotion v2.7.9 (2026-08-05):**
   - **Image-Sofortrollback auf v2.5.0:** `protrackr-app:rollback-2026-08-05_13-23-12`
     (`9e426a871909`) → `docker tag … protrackr-app:latest` + `docker compose up -d --no-build app`.
   - **DB:** `db-migration/prod-pre-promote-2026-08-05_13-23-12.sql` (5.807 KB, vor der Promotion)
     und `db-migration/prod-pre-migrate-0021_2026-08-05_12-37-55.sql` (5.946.365 B, vor der Migration).
   - ⚠️ **Ein Image-Rollback auf v2.5.0 nimmt Migration 0021 NICHT zurück** — das ENUM bleibt bei
     11 Werten. Das ist unschädlich (additiver Wert, den die ältere App nur nicht anbietet) und
     **soll auch so bleiben**: das Zurücknehmen wäre der destruktive Schritt, nicht das Behalten.
   - Alles Ältere über **Git-Tags** (`nas-rollout/2.7.9` → `4752ac0`), jede Version neu baubar.

---

*Ende Handover. Volle Chronik: `NAS_SETUP_HISTORY.md`. Regeln: Memory-Dateien + `CLAUDE.md`.*
