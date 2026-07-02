# NAS-Chat starten — Phase A (Server-Deployment)

Kurzanleitung für den Umzug von „localhost auf dem Laptop" zu **zwei
Umgebungen auf dem Server** (Dev + Produktiv). Bewusst für Laien geschrieben.
Ausführlicher Plan: [`docs/DEPLOYMENT-BLUEPRINT.md`](DEPLOYMENT-BLUEPRINT.md).

## Was DU tust (mehr nicht)

1. **NAS-Setup-Chat öffnen** (dein separater Chat für den Server).
2. **Die Start-Nachricht unten reinkopieren.**
3. **Bei jedem Schritt „ja/weiter" sagen** und die paar Werte liefern, die nur du
   hast. Befehle, Docker, Merge, Backup erledigt Claude dort.

## Start-Nachricht (kopieren & im NAS-Chat einfügen)

```text
Wir starten Phase A des Deployment-Blueprints (docs/DEPLOYMENT-BLUEPRINT.md auf
main). Ziel: zwei Umgebungen auf dem Server statt localhost.

Bereits entschieden (bitte nicht neu aufrollen):
- Produktiv = die heutige NAS-Instanz, Ports/Tailscale UNVERAENDERT (3010/:9443),
  bekommt die echten Daten von meinem Laptop.
- Dev = neu, eigener Port (Vorschlag 3011) + eigener Tailscale-Eintrag.
- Image-Promotion Dev->Prod, Dev-DB = periodischer Klon der Prod-DB.
- Erst manuell ueber den /nas-rollout-Skill, CI/CD spaeter.

Lies zuerst den Blueprint (git pull, dann docs/DEPLOYMENT-BLUEPRINT.md) und das
/nas-rollout-Skill (liegt auf main: git show main:.claude/skills/nas-rollout/SKILL.md).
Arbeite dann Phase A, Schritt A1-A5 ab - stufenweise, mit Bestaetigung vor jedem
riskanten Schritt, Backup zuerst. Erklaere mir jeden Schritt in einfacher
Sprache, ich bin Laie.

Fang mit einer Bestandsaufnahme an: Was laeuft aktuell auf dem NAS (Container,
Ports, Volumes), und wo liegen meine echten Daten? Dann schlag mir A1 vor.
```

## Was der NAS-Chat dich fragen wird (damit du vorbereitet bist)

- **Zugang:** dass Claude dort auf deinen Unraid-Server / Docker zugreifen kann
  (so wie du den NAS sonst verwaltest). Ist das noch nicht eingerichtet, ist das
  der allererste Punkt.
- **Passwörter/Secrets** (DB-Passwort, SMTP-Passwort … in der `.env`): **die
  trägst DU ein** — Claude darf Passwörter nicht selbst eintippen. Claude sagt
  dir genau, wo und welche.
- **Ein paar Bestätigungen:** z.B. „Dev bekommt Port 3011 — ok?" und „Jetzt die
  echten Daten nach Prod migrieren — ok?".

## Dein Sicherheitsnetz

- **Nichts Unumkehrbares ohne Backup + deine Freigabe.** Vor jeder DB-Änderung
  wird gesichert.
- **Deine Produktiv-URL ändert sich nicht** (3010/:9443 bleibt).
- Geht ein Schritt schief → **automatischer Rollback**, und Claude erklärt, was
  war.
- Es passiert **immer nur ein Schritt**, den du vorher verstehst. Unsicher? Sag
  im Chat einfach „erklär mir das nochmal einfacher".

---

*Dieser Umzug ist Server-Infra und gehört in den NAS-Setup-Chat. Der Main-Chat
bleibt für die App-Entwicklung.*
