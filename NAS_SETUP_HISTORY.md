# NAS-Setup — Entwicklungs-Historie

> **Dieses Dokument existiert ausschließlich im Branch `nas-setup` und dokumentiert chronologisch jeden Schritt des ProTrackr-Umzugs vom Notebook auf den AOOSTAR WTR MAX 8845 NAS.**

---

## Projekt-Eckdaten

| Schlüssel | Wert |
|---|---|
| **Projekttitel** | ProTrackr — NAS-Umzug |
| **Branch (lokal & GitHub)** | `nas-setup` |
| **Freeze-Punkt** | Tag `v1.3.2` (Commit `d2f2458`) |
| **Repo-Pfad lokal** | `C:\Projects\ProTrackr_developing_path` |
| **GitHub-Branch** | https://github.com/DoeringConsulting/ProTrackr/tree/nas-setup |
| **Ziel-Hardware** | AOOSTAR WTR MAX 8845 (Ryzen 7 8845HS) |
| **Ziel-OS** | Unraid 7.2.5 |
| **Ziel-URL** | `https://dcs01.taile370c2.ts.net:9443` |
| **Workflow** | Option B — Befehle copy-paste in Unraid Web-Terminal |
| **Trennungsregel** | Kein Merge/Rebase mit main ohne explizite User-Freigabe nach Risikoaufklärung |

---

## Doku-Format

Jeder Schritt wird wie folgt erfasst:

```
### YYYY-MM-DD — Phase X.Y: <Kurzbeschreibung>

**Was:**       Konkrete Aktion / Befehl / Datei-Änderung
**Warum:**     Begründung / Kontext
**Ergebnis:**  Output / Status / Folge-Aktionen
```

Bei Befehlen, die der User im Web-Terminal ausführt, wird der **gesamte Output** (oder relevante Auszug) hier dokumentiert. Bei Datei-Änderungen werden Pfade und Commit-SHA referenziert.

---

# Phase 0 — Vorbereitung & Klärung

## 2026-05-04 — Phase 0.1: Initialer Plan & Branch-Anlage

**Was:**
- Branch `nas-setup` lokal aus Tag `v1.3.2` (Commit `d2f2458`) erstellt:
  ```
  git checkout -b nas-setup v1.3.2
  ```
- Branch auf GitHub gepusht und Tracking gesetzt:
  ```
  git push -u origin nas-setup
  ```

**Warum:**
- User hatte parallel auf `main` weiterentwickelt; explizite Trennungs-Anforderung, damit beide Stränge sich nicht in die Quere kommen.
- v1.3.2 wurde als stabiler Freeze-Punkt für die NAS-Migration gewählt.

**Ergebnis:**
- Branch `nas-setup` aktiv im lokalen Klon `ProTrackr_developing_path`.
- Upstream `origin/nas-setup` angelegt.
- Verifiziert: `git describe --exact-match HEAD` → `v1.3.2`.
- Hauptrepo `C:\Projects\ProTrackr` bewusst NICHT angefasst (befand sich in detached HEAD aus paralleler Session).

---

## 2026-05-04 — Phase 0.2: Hardware- und OS-Klärung

**Was:** Klärung der Ziel-Plattform mit dem User.

**Warum:** AOOSTAR WTR MAX ist ein x86-Mini-PC-NAS — der konkrete OS-Layer entscheidet über den Deployment-Weg.

**Ergebnis:**
| Eigenschaft | Wert |
|---|---|
| Hardware | AOOSTAR WTR MAX 8845 (Ryzen 7 8845HS, x86_64) |
| OS | Unraid 7.2.5 |
| Container-Engine | Docker (Unraid-nativ) |
| Tailscale-Installation | Unraid Community-Plugin (siehe Plugins-Tab im UI) |

---

## 2026-05-04 — Phase 0.3: Tailscale-Identifikation

**Was:** Tailscale-Hostname & Tailnet-Domain ermittelt.

**Warum:** Nötig für die HTTPS-Konfiguration via Tailscale Serve.

**Ergebnis:**
- Hostname: **DCS01**
- Volle Tailnet-Domain: **`dcs01.taile370c2.ts.net`**
- Tailscale-IP: `100.108.232.64`
- TLS-Cert: bereits aktiv und gültig (Let's-Encrypt via Tailscale, "Verbindung ist sicher" verifiziert beim Aufruf der URL)

**Naming-Hinweis:** Mandant `dc001` (App-intern) ≠ NAS-Hostname `DCS01` — Verwechslung im weiteren Verlauf vermeiden.

---

## 2026-05-04 — Phase 0.4: HTTPS-Strategie

**Was:** Drei Optionen verglichen (Tailscale Serve auf eigenem Port / Sub-Pfad / Unraid-Port-Wechsel).

**Warum:** Port 443 ist von Unraid-WebGUI belegt, ProTrackr braucht eigenen TLS-Endpunkt.

**Entscheidung:** **Option A — Tailscale Serve auf eigenem TLS-Port.**

**Begründung:**
- Niedrigstes Risiko (kein Code-Change, kein Unraid-Konfig-Change)
- Reversibel (`tailscale serve reset`)
- Konsistent mit Notebook-Setup (auch dort Port-suffix-URL)
- TLS-Cert wird von Tailscale automatisch wiederverwendet

---

## 2026-05-04 — Phase 0.5: Port-Auswahl

**Was:** Freien externen TLS-Port auf dem NAS suchen.

**Warum:** Mehrere Dienste laufen bereits.

**Bekannte Port-Belegung auf DCS01:**
| Port | Dienst |
|---|---|
| 443 | Unraid WebGUI |
| 3001 | Obsidian |
| 8080 | Open WebUI / Ollama 3.2 |
| 8443 | Nextcloud |

**Test-Methode:** Browser-Aufruf `https://dcs01.taile370c2.ts.net:9443` → erwartete Antwort: `ERR_CONNECTION_REFUSED` (= Port frei).

**Ergebnis:** Port **9443** verifiziert frei (`ERR_CONNECTION_REFUSED` per Screenshot bestätigt).

**Final-URL:** `https://dcs01.taile370c2.ts.net:9443`

---

## 2026-05-04 — Phase 0.6: Datenbank-Migration-Strategie

**Was:** Festgelegt, dass die bestehende MySQL-DB vom Notebook (Mandant `dc001`, alle User/Projekte/Zeitbuchungen/Reisekosten) auf den NAS migriert wird.

**Warum:** User will keinen Neuanfang mit leerer DB; bestehende Buchungen müssen erhalten bleiben.

**Methode:** `mysqldump` auf Notebook → Transport zum NAS → Import in MySQL-Container auf Unraid.

**Skripte werden in Phase 1 erstellt:**
- `scripts/migrate-db.ps1` — PowerShell, Dump auf Notebook
- `scripts/migrate-db.sh` — Bash, Import auf NAS

---

## 2026-05-04 — Phase 0.7: SMTP-Klärung

**Was:** SMTP-Konfiguration des Notebook-Setups geprüft, Ziel-SMTP-Server ermittelt.

**Warum:** ProTrackr versendet Passwort-Reset-Mails via Nodemailer. Auf dem Notebook ist SMTP aktuell nicht konfiguriert (Code prüft env vars und überspringt schweigend).

**Code-Befund:** [server/email.ts:42-50](server/email.ts:42) — `nodemailer.createTransport()` ohne explizite `authMethod`, nodemailer wählt automatisch.

**Ergebnis — SMTP-Ziel-Konfig auf NAS:**
| Variable | Wert |
|---|---|
| `SMTP_HOST` | `doeringconsulting.hoste.pl` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` (Port 465 = implizites TLS) |
| `SMTP_USER` | `office@doering-consulting.eu` |
| `SMTP_PASS` | (wird in Phase 4 separat gesetzt, nie im Repo) |
| `SMTP_FROM` | `office@doering-consulting.eu` |
| Auth-Methode (vom User angegeben) | MD5 Challenge-Response (CRAM-MD5) |

**Plan-Annahme:** Nodemailer wird CRAM-MD5 automatisch wählen, falls der hoste.pl-Server es als einzige Methode anbietet. Falls nicht: in Phase 4 nachsteuern mit explizitem `authMethod: 'CRAM-MD5'`.

**Sicherheits-Strategie für SMTP-Passwort:** Variante D — direkt in Unraid Container Variables (Masked). Niemals in Chat, Repo oder unverschlüsselten Files.

---

## 2026-05-04 — Phase 0.8: Workflow-Festlegung

**Was:** Zusammenarbeitsmodell für die Implementierungsphase festgelegt.

**Entscheidung:** **Option B — Web-Terminal Mikro-Loop**.

**Workflow:**
1. Claude (im Chat) gibt einen Befehl als Code-Block aus, mit Erklärung & erwartetem Output.
2. User kopiert den Code-Block ins Unraid Web-Terminal (Konsolen-Icon rechts oben in der WebGUI).
3. User führt den Befehl aus, kopiert den Output zurück in den Chat.
4. Claude validiert den Output, dokumentiert in dieser Datei, gibt nächsten Schritt.

**Sicherheits-Garantien:**
- Vor destruktiven Befehlen (`rm`, `docker rm`, DB-DROP, etc.) explizite Bestätigung
- Verifizierungs-Befehle vor und nach kritischen Aktionen
- Erste Aktionen aller Phasen sind read-only

**Doku-Pflicht (User-Anforderung):** Jeder Schritt — Entscheidung, Befehl, Output — wird in dieser Datei `NAS_SETUP_HISTORY.md` chronologisch festgehalten.

---

## 2026-05-04 — Phase 0.9: Finale Vorab-Konfiguration

| Komponente | Wert |
|---|---|
| Branch | `nas-setup` |
| Freeze-Tag | `v1.3.2` |
| NAS-Hostname | DCS01 |
| Tailnet-Domain | `dcs01.taile370c2.ts.net` |
| OS | Unraid 7.2.5 |
| External Port | **9443** |
| Internal Container Port | 3000 |
| **Final-URL** | **`https://dcs01.taile370c2.ts.net:9443`** |
| HTTPS-Strategie | Tailscale Serve (Plugin) |
| Datenbank | MySQL Container, Daten-Migration vom Notebook |
| SMTP | hoste.pl:465 SSL, `office@doering-consulting.eu`, CRAM-MD5 |
| SMTP-Passwort-Handling | Unraid Container Variables (Masked) |
| Workflow | Option B (Web-Terminal Mikro-Loop) |
| Doku | Diese Datei (chronologisches Log jedes Schritts) |

---

# Phase 1 — Implementations-Dateien (folgt)

> Geplante Dateien im Branch `nas-setup`:
> - `Dockerfile`
> - `.dockerignore`
> - `docker-compose.yml`
> - `.env.production.example`
> - `docs/UNRAID_DEPLOYMENT.md`
> - `scripts/migrate-db.ps1`
> - `scripts/migrate-db.sh`

---

# Phase 2 — Datenbank-Dump auf dem Notebook (folgt)

# Phase 3 — NAS-Vorbereitung & Container-Build (folgt)

# Phase 4 — Erstes Anlaufen, SMTP-Test, Datenmigration (folgt)

# Phase 5 — Tailscale Serve aktivieren & End-to-End-Test (folgt)

# Phase 6 — Notebook-Server abschalten / Switchover (folgt)
