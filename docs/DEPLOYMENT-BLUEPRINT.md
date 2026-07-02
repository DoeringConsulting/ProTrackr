# ProTrackr Deployment-Blueprint — Dev + Prod auf dem Server

> Zielbild und Umsetzungsplan für den Umzug von „Laptop-localhost" auf **zwei
> Server-Umgebungen** (Produktiv + Dev) mit **Image-Promotion** Dev → Prod.
> Stand 2026-07-02. Umsetzung = NAS-Setup-Chat (Server-Infra); dieses Dokument
> lebt auf `main` als geteilter Bauplan.

## 1. Zielbild

Kein localhost mehr. Der Laptop bleibt **Autoren-Maschine** (Code + Git +
schnelles `tsc`/`vitest`); die *laufende* App gibt es nur noch zweimal auf dem
Unraid-Server:

```
   Laptop (nur Code/Git)              Unraid-Server
   ─────────────────────             ───────────────────────────────────────────
   Editor / Claude Code              ┌── protrackr-DEV  (Branch main) ───────────┐
   git push  ────────────────────►   │   App :DEV_PORT → 3000 · mysql-dev · Klon │
                                      └───────────────────────────────────────────┘
                                                  │  Image-Promotion (wenn sicher)
                                                  ▼
                                      ┌── protrackr-PROD (Branch production) ─────┐
                                      │   App :3010 → 3000 · mysql-prod · ECHT     │
                                      │   Tailscale :9443  (UNVERÄNDERT)          │
                                      └───────────────────────────────────────────┘
```

| | **Produktiv** | **Dev / Staging** |
|--|--|--|
| Rolle | stabil, echte Daten | Entwicklung/Test |
| Basis | **heutige NAS-Instanz (unverändert)** | neu aufzubauen |
| Host-Port → Container | **3010 → 3000** (bleibt) | z.B. **3011 → 3000** (neu) |
| Tailscale | **:9443 (bleibt)** | neuer Eintrag, z.B. :9444 / eigener Host |
| Compose-Stack | `protrackr-prod` | `protrackr-dev` |
| App-Container | `protrackr-app-prod` | `protrackr-app-dev` |
| DB-Container / Volume | `mysql-prod` / `mysql_data_prod` | `mysql-dev` / `mysql_data_dev` |
| Env-Datei | `.env.prod` | `.env.dev` |
| Git-Ref | `production` (nur promotet) | `main` (Entwicklungslinie) |
| Daten | Wahrheit | **periodischer Klon** der Prod-DB |

**Entscheidungen (fix):** Image-Promotion · CI später via GitHub Actions +
self-hosted Runner · Dev-DB = periodischer Prod-Klon · Prod = bestehende
NAS-Instanz mit unveränderten Ports/Tailscale.

**Ziel-Plattform:** Unraid **7.3.1** (Docker/Compose-Host). Die genaue Compose-
Mechanik (nativ vs. Plugin) im NAS-Chat gegen die laufende Unraid-Version bestätigen.

## 2. Ports & Tailscale — was sich (nicht) ändert

- Container-intern lauscht die App **immer auf 3000** — kein App-Umbau, für
  beide Umgebungen gleich.
- **Produktiv** behält Host-Port **3010** und Tailscale **:9443** → **null
  Änderung** am kritischen Pfad, gewohnte Zugriffs-URL bleibt.
- **Dev** bekommt einen **neuen** Host-Port + eigenen Tailscale-Eintrag. Nur hier
  wird Docker/Unraid/Tailscale einmalig neu konfiguriert.

## 3. Git-Modell

- `main` = Entwicklungslinie. Jeder reife Stand wird auf **Dev** deployt (ersetzt
  localhost als Test-Ziel).
- `production` = stabil. Wird **nur** durch Promotion eines auf Dev verifizierten
  Stands aktualisiert und auf **Prod** deployt.
- Docker-Infra (`Dockerfile`, `compose.*.yml`, `.env`-Templates) wandert nach
  `main` und wird per Umgebungs-Overlay parametrisiert. Der heutige `nas-setup`-
  Branch geht darin auf (seine Infra-Dateien werden zu `compose.prod.yml` etc.).

## 4. Phase A — Fundament (manuell, jetzt) — NAS-Setup-Chat

Ziel: sofort von localhost weg, sauberer Dev/Prod-Split, **ohne neue Technik**.
Rollout zunächst manuell über den bestehenden `/nas-rollout`-Skill.

- **A1 — Prod scharfstellen:** heutige NAS-Instanz = Produktiv.
  1. Laptop-DB dumpen: `pwsh scripts/migrate-db.ps1` → `db-migration/*.sql.gz`.
  2. Dump in `mysql-prod` einspielen (echte Daten = neue Wahrheit auf dem Server).
  3. Prod-App auf aktuellen stabilen Stand bringen (via `/nas-rollout` mit dem
     Manifest der Ziel-Version). Ports/Tailscale bleiben.
- **A2 — Dev-Stack aufbauen:** `compose.dev.yml` + `.env.dev`, neuer Port +
  Tailscale-Eintrag; `mysql-dev` als **Klon** von `mysql-prod`.
- **A3 — Dev-Loop:** Laptop editiert + `tsc`/`vitest` (schnelles Feedback) →
  `git push main` → Dev deployen (`/nas-rollout`, Ziel = dev).
- **A4 — Promotion:** verifizierter Dev-Stand → Prod via `/nas-rollout`
  (Ziel = prod) mit den 4 Leitplanken (einseitig · Versionskonflikt-Auto ·
  Backup-vor-Migrate · Health-Gate + Rollback).
- **A5 — localhost abschalten.**

> Tooling-Anpassung für A: der `/nas-rollout`-Skill + das Manifest bekommen ein
> Feld **`environment: dev | prod`** (Ziel-Stack, -Port, -Compose-Datei),
> damit derselbe Ablauf beide Umgebungen bedient. Kleine, main-seitige Ergänzung.

## 5. Phase B — Automatik (CI/CD, später) — Level 3

### 5.1 Bausteine
- `compose.dev.yml` / `compose.prod.yml` + `.env.dev` / `.env.prod`.
- Container-Registry: **GHCR** (GitHub Container Registry, privat) für Images.
- **Self-hosted Runner** als Unraid-Container (führt Deploys auf dem NAS aus).
- **GitHub Environment „production"** mit dir als *Required Reviewer* = Freigabe-Tor.
- `scripts/healthcheck.sh`, `scripts/backup-db.sh`, `scripts/rollback.sh`
  (die 4 Leitplanken in Pipeline-Form) + Dev-Klon-Job (Prod → Dev, periodisch).

### 5.2 Pipeline-Skizze
```yaml
# .github/workflows/deploy.yml   (SKIZZE — Phase B)
on:
  push: { branches: [main] }        # Dev-Deploy automatisch
  workflow_dispatch: {}             # Prod-Promotion manuell/gated

jobs:
  build-test:                       # GitHub-Runner (Fabrik)
    runs-on: ubuntu-latest
    services:
      mysql: { image: mysql:8.0, env: { MYSQL_ROOT_PASSWORD: test, MYSQL_DATABASE: protrackr }, ports: ["3306:3306"] }
    steps:
      - uses: actions/checkout@v4
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm exec tsc --noEmit
      - env: { DATABASE_URL: "mysql://root:test@127.0.0.1:3306/protrackr" }
        run: pnpm exec vitest run
      - run: |
          echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker build -t ghcr.io/<owner>/protrackr:${{ github.sha }} .
          docker push ghcr.io/<owner>/protrackr:${{ github.sha }}

  deploy-dev:                       # self-hosted Runner (Unraid)
    needs: build-test
    runs-on: [self-hosted, unraid]
    steps:
      - run: IMAGE=ghcr.io/<owner>/protrackr:${{ github.sha }} docker compose -f compose.dev.yml up -d
      - run: ./scripts/healthcheck.sh http://localhost:3011 ${{ github.sha }}

  promote-prod:                     # nur nach Freigabe (Environment-Gate)
    needs: deploy-dev
    environment: production         # ← Required Reviewer = du
    runs-on: [self-hosted, unraid]
    steps:
      - run: ./scripts/backup-db.sh mysql-prod                 # Backup VOR Migrate
      - run: IMAGE=ghcr.io/<owner>/protrackr:${{ github.sha }} docker compose -f compose.prod.yml up -d
      - run: docker exec protrackr-app-prod npx drizzle-kit migrate
      - run: ./scripts/healthcheck.sh http://localhost:3010 ${{ github.sha }} || ./scripts/rollback.sh prod
```

Kern der Image-Promotion: **genau dasselbe Image** (`:${{ github.sha }}`), das
`deploy-dev` getestet hat, wird in `promote-prod` deployt — kein Rebuild,
bit-identisch verifiziert. Nur `.env.prod` + Migrationen unterscheiden sich.

### 5.3 Ohne GitHub (Alternative)
Gitea + Act-Runner lokal, oder Watchtower (pullt neue Images automatisch) +
Promotion-Skript. Mehr Ersteinrichtung/Wartung — für später, falls GitHub-
Unabhängigkeit gewünscht.

## 6. Datenbank-Strategie

- **Prod-DB = Wahrheit** (echte Daten, vom Laptop migriert). **Dev-DB =
  periodischer Klon** der Prod-DB → Migrationen/Tests gegen realitätsnahe Daten.
- Migrationen: **erst auf Dev** (Klon) verifizieren, **dann bei Promotion auf
  Prod** — immer mit Backup davor (dein Fehler-#3-Backup deckt das ab).
- **Strikte Trennung:** eigene Container, Volumes, Creds. Dev schreibt **nie**
  gegen die Prod-DB. Klon-Richtung ist immer nur Prod → Dev.

## 7. NAS-individuelle Einstellungen (gelten pro Umgebung)

- `.env.prod` / `.env.dev` getrennt (gitignored). `DATABASE_URL` zeigt je auf den
  eigenen mysql-Container. Secrets, `SESSION_COOKIE_SECURE=true`, SMTP je Env.
- **`VITE_*` sind build-time** — `.dockerignore` schließt `.env*` aus dem
  Build-Context aus; benötigte `VITE_*` als Docker **build-args** übergeben
  (relevant, sobald Dev/Prod sich in Client-sichtbaren Werten unterscheiden).

## 8. Offene Detail-Entscheidungen (bei der Umsetzung im NAS-Chat)

- Konkreter Dev-Host-Port + Tailscale-Eintrag (Vorschlag 3011 / :9444).
- GHCR-Repo-Name + Token (Phase B).
- Klon-Frequenz Prod → Dev (z.B. nächtlich oder on-demand).
- Genaue Migrations-Mechanik (App-Startup vs. `drizzle-kit migrate`-Step).
