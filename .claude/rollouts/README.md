# NAS-Rollout — Übergabe main → NAS

Automatisierte, geprüfte Übergabe einer auf `main` freigegebenen Release an den
NAS. Entkoppelt die beiden Chats über ein **deterministisches Manifest**:

```
  MAIN-CHAT (Produzent)                       NAS-SETUP-CHAT (Ausführer)
  ───────────────────────                     ──────────────────────────
  node scripts/generate-rollout-manifest.mjs  Skill  /nas-rollout
        │  schreibt                                  │  liest Manifest
        ▼                                            ▼
  .claude/rollouts/<version>.json  ──────────►  merge → backup → migrate →
  (pinnt source.commit, Migrationen,            build → health-gate →
   Health-Ziel, breaking, notes)                rollback-on-fail → <version>.DONE
```

## Bestandteile
- **`scripts/generate-rollout-manifest.mjs`** — auf `main` ausführen, wenn eine
  Release gefreezt ist. Schreibt `.claude/rollouts/<version>.json`.
  `node scripts/generate-rollout-manifest.mjs --notes "…"`
- **`.claude/rollouts/<version>.json`** — die Übergabe. Pinnt einen exakten
  `source.commit` (Health-Check-Version bleibt stabil, auch wenn main weiterläuft).
- **`.claude/skills/nas-rollout/SKILL.md`** — der Playbook-Skill. **Nur im
  NAS-Setup-Chat** aufrufen. Führt den Rollout stufenweise mit 4 Leitplanken aus.
- **`scripts/rollout-to-nas.ps1`** — NAS-agnostischer Git-Helfer (sicherer Merge
  main→nas-setup, Versionskonflikte automatisch zu main). Docker/DB macht der Skill.

## Die 4 Leitplanken
1. Merge nur `main → nas-setup`, nie zurück.
2. Versionsdatei-Konflikte automatisch zu main (`--theirs`); App-Konflikte → Abbruch.
3. DB-Backup VOR jeder Migration.
4. Health-Gate nach Deploy, sonst Auto-Rollback (Merge + Image + DB).

## Ablauf kurz
1. **Main-Chat:** Release freezen → Manifest erzeugen → committen/pushen.
2. **NAS-Setup-Chat:** `/nas-rollout` → Manifest bestätigen → Stufen 1–7 fahren.
3. Erfolg: Tag `nas-rollout/<version>` + `<version>.DONE`.

## Bootstrapping (nur beim allerersten Mal)
Der Skill + die Skripte liegen auf `main`, noch nicht auf `nas-setup`. Damit der
NAS-Chat sie nutzen kann, gibt es zwei Wege:
- **Einfach:** Der NAS-Chat arbeitet in einem Repo-Clone und liest den Skill von
  `main` (`git show main:.claude/skills/nas-rollout/SKILL.md`) bzw. checkt kurz
  `main` aus, um Skill/Skript zu haben, und wechselt für die Ausführung auf
  `nas-setup`. Der erste Rollout bringt die Tooling-Dateien dann selbst mit.
- **Alternativ:** Den nas-rollout-Skill auf User-Ebene (`~/.claude/skills/`)
  ablegen — dann ist er branch-unabhängig in jedem Chat verfügbar.
Nach dem ersten erfolgreichen Rollout ist die Tooling-Kette auf beiden Branches.

`*.DONE`-Dateien und lokale DB-Dumps sind Laufzeit-Artefakte (nicht als
Quellcode gedacht).
