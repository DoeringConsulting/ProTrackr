# Dev-Loop — der Alltags-Workflow (Phase A3)

> Ersetzt „localhost als Test-Ziel". Neuer Code wird **auf `main` entwickelt**,
> **auf DEV (`:9444`) getestet**, und erst nach Freigabe per Promotion nach
> PROD gehoben (A4). Git-Modell 1: `nas-setup` bleibt Deploy-Branch, Infra
> getrennt von `main`.

## Überblick

```
  Laptop (Autoren-Maschine)                 NAS (DCS01)
  ─────────────────────────                ───────────────────────────────
  1. Code auf main editieren
  2. npx tsc --noEmit                       (schnelles lokales Feedback)
     npx vitest run
  3. git push origin main
        │
        ▼  (Claude, kontrolliert)
  4. main -> nas-setup mergen               ┌── DEV  protrackr-app-dev :9444 ──┐
     + git push origin nas-setup            │   ./scripts/deploy-dev.sh        │
        └──────────────────────────────────►│   pull + rebuild + Health-Gate   │
                                            └──────────────────────────────────┘
  6. In DEV testen (:9444)
  7. Freigabe nach Success Criteria  ─────►  A4: Promotion DEV -> PROD (:9443)
```

## Die Schritte im Detail

### 1–3 · Entwickeln (Laptop)
- Code auf **`main`** ändern (im main-Klon/Worktree, **nicht** in `nas-setup`).
- `npx tsc --noEmit` und `npx vitest run` müssen grün sein.
- `git push origin main`.

### 4 · main → nas-setup übernehmen (Claude-gesteuert)
Der Merge bleibt bewusst **manuell/Claude-gesteuert**, weil Merges Konflikte
haben können (dann Stopp + Klärung, statt blindes Skript). Ablauf wie beim
v2.1.8-Sync:
```bash
git checkout nas-setup
git merge --no-commit --no-ff origin/main   # Trockenlauf, Konflikte sichten
#   Versionsdatei-Konflikte: main-Version nehmen. Echte Code-Konflikte: STOPP.
git commit -m "merge: sync nas-setup with main (<version>)"
git push origin nas-setup
```
Leitplanke: **niemals `nas-setup → main`** ohne explizite Freigabe.

### 5 · Auf DEV deployen (NAS)
```bash
cd /mnt/user/appdata/protrackr
./scripts/deploy-dev.sh
```
Holt `origin/nas-setup`, baut **nur** `app-dev` neu (`--no-deps`, mysql-dev
unangetastet), Health-Gate gegen `:9444/version.json`. **Prod bleibt unberührt**
(Skript nutzt ausschließlich `compose.dev.yml`).

Dev-DB bei Bedarf frisch aus Prod klonen:
```bash
./scripts/clone-prod-to-dev.sh --yes
```

### 6 · In DEV testen
`https://dcs01.taile370c2.ts.net:9444` — Funktionsabnahme der Änderung.

### 7 · Freigabe → Promotion (A4)
Erst wenn die **Success Criteria** erfüllt sind (siehe
`NAS_SETUP_HISTORY.md`, Governance-Regel), wird der **in Dev geprüfte Stand**
per Promotion nach PROD gehoben. **Direkte Prod-Änderungen sind gesperrt.**

## Merksätze
- **PROD nie direkt** — alles über DEV, dann Promotion nach Freigabe.
- **Immer `-f compose.dev.yml`** für Dev-Befehle (sonst greift die Prod-Datei).
- **Frisches Terminal** für Dev-Arbeit, falls vorher `.env`-Variablen gesourct
  wurden (verschmutzte Shell → nutze env_file, kein `source`).
