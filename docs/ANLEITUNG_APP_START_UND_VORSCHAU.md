# ProTrackr: App starten und Ergebnis ansehen

Diese Anleitung zeigt, wie du den aktuellen Stand der App lokal startest und im Browser anschaust.

## 1) Voraussetzungen

- Node.js 20 LTS
- pnpm
- MySQL 8 (oder kompatibel)
- Zugriff auf dieses Repository

## 2) Richtigen Branch verwenden

```bash
cd /workspace
git switch ProTrackr_developing_path
```

## 3) Abhaengigkeiten installieren

```bash
pnpm install
```

## 4) `.env` im Projekt-Root anlegen

Lege eine Datei `.env` im Root des Repos an:

```env
NODE_ENV=development
PORT=3000

SESSION_SECRET=BITTE_EIN_LANGES_SECRET_MIN_32_ZEICHEN
JWT_SECRET=BITTE_EIN_LANGES_SECRET_MIN_32_ZEICHEN

DATABASE_URL=mysql://USER:PASS@127.0.0.1:3306/protrackr

SCHEDULER_API_KEY=BITTE_EIN_LANGES_SECRET_MIN_32_ZEICHEN
CRON_SECRET=BITTE_EIN_LANGES_SECRET_MIN_32_ZEICHEN

# Optional (nur falls benoetigt)
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
VITE_FRONTEND_FORGE_API_KEY=
VITE_APP_ID=
OAUTH_SERVER_URL=
OWNER_OPEN_ID=
OWNER_NAME=
VITE_OAUTH_PORTAL_URL=
VITE_APP_TITLE=ProTrackr
VITE_APP_LOGO=

# Lokal mit `pnpm start` ueber http://localhost:
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax
```

Wichtig:
- Ohne `SESSION_SECRET` startet der Server nicht.
- Ohne gueltige `DATABASE_URL` funktionieren Login und DB-Funktionen nicht.

## 5) Datenbank vorbereiten

Falls DB/Benutzer noch nicht existieren, beispielhaft:

```sql
CREATE DATABASE protrackr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'protrackr_user'@'localhost' IDENTIFIED BY 'SEHR_STARKES_PASSWORT';
GRANT ALL PRIVILEGES ON protrackr.* TO 'protrackr_user'@'localhost';
FLUSH PRIVILEGES;
```

Danach in `.env`:

```env
DATABASE_URL=mysql://protrackr_user:SEHR_STARKES_PASSWORT@127.0.0.1:3306/protrackr
```

Schema anwenden:

```bash
pnpm db:push
```

## 6) Entwicklungsserver starten

```bash
pnpm dev
```

App aufrufen:
- lokal: `http://localhost:3000`
- in Cursor Cloud: Port `3000` im Ports-Panel oeffnen

## 7) Login

Die App nutzt einen 3-Felder-Login:
- Mandant
- E-Mail
- Passwort

Historisch dokumentierter Zugang (kann je nach DB-Stand abweichen):
- Mandant: `DC001` (oder `Doering Consulting`)
- E-Mail: `a.doering@doering-consulting.eu`
- Passwort: `ChangeMe123!`

Wenn der Login nicht funktioniert, pruefe:
1. Gibt es den Mandanten in Tabelle `mandanten`?
2. Gibt es den Benutzer in Tabelle `users`?
3. Ist ein gueltiger Passwort-Hash in `users.passwordHash` gesetzt?

## 8) Produktionsvorschau lokal testen

```bash
pnpm build
NODE_ENV=production PORT=3000 pnpm start
```

Dann ebenfalls im Browser:
- `http://localhost:3000`

Hinweis fuer lokalen Betrieb mit `pnpm start`:
- Bei `http://localhost` muessen Session-Cookies ohne HTTPS funktionieren.
- Deshalb in `.env` setzen:
  - `SESSION_COOKIE_SECURE=false`
  - `SESSION_COOKIE_SAMESITE=lax`
- Auf echten HTTPS-Deployments sollte `SESSION_COOKIE_SECURE=true` verwendet werden.

## 9) Typische Probleme

### Fehler: `SESSION_SECRET Umgebungsvariable ist nicht gesetzt`
- `SESSION_SECRET` in `.env` eintragen.

### Fehler: `Database not available`
- `DATABASE_URL` pruefen.
- DB erreichbar?
- `pnpm db:push` erfolgreich?

### Login klappt, aber Weiterleitung springt wieder auf Login
- In Production hinter Nginx/Proxy auf HTTPS achten.
- Fuer lokalen Betrieb ohne HTTPS (`http://localhost`) in `.env` setzen:
  - `SESSION_COOKIE_SECURE=false`
  - `SESSION_COOKIE_SAMESITE=lax`

---

## Datei herunterladen

Diese Anleitung liegt im Repo unter:

`docs/ANLEITUNG_APP_START_UND_VORSCHAU.md`

Wenn du auf GitHub im Branch `ProTrackr_developing_path` bist, kannst du die Datei dort direkt herunterladen.
