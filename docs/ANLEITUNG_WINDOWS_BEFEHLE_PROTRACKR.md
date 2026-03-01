# ProTrackr: Wichtige Windows-Befehle (Setup, Betrieb, Entwicklung)

Diese Datei ist die kompakte Befehls-Sammlung fuer den lokalen Betrieb unter Windows.
Alle Befehle sind fuer PowerShell gedacht.

---

## 0) Wichtiger Kontext

- Cloud-Agent-Pfad: `/workspace` (nur Cloud)
- Lokaler Windows-Pfad: `C:\Projects\ProTrackr_developing_path`
- Browser-URL lokal: `http://localhost:3000`

---

## 1) Git / Branch / Worktree

### In lokales Repo wechseln

```powershell
cd "C:\Projects\ProTrackr_developing_path"
```

### Branch-Status pruefen

```powershell
git branch --show-current
git status
```

### Aktuellen Stand vom Remote holen

```powershell
git fetch origin
git pull origin ProTrackr_developing_path
```

### Falls ein separater Worktree benoetigt wird

```powershell
cd "C:\Projects\ProTrackr"
git fetch origin
git worktree add "..\ProTrackr_developing_path" -b ProTrackr_developing_path origin/ProTrackr_developing_path
cd "..\ProTrackr_developing_path"
```

---

## 2) Node / pnpm Setup

### Dependencies installieren

```powershell
pnpm install
```

### Windows-kompatible Scripts (einmalig)

```powershell
pnpm add -D cross-env
npm pkg set scripts.dev="cross-env NODE_ENV=development tsx watch server/_core/index.ts"
npm pkg set scripts.start="cross-env NODE_ENV=production node dist/index.js"
```

### Scripts kontrollieren

```powershell
npm pkg get scripts.dev
npm pkg get scripts.start
```

---

## 3) `.env` erstellen und pflegen

### Datei anlegen/oeffnen

```powershell
notepad .env
```

### Minimale lokale Werte

```env
NODE_ENV=development
PORT=3000

SESSION_SECRET=HIER_EIN_LANGES_SECRET
JWT_SECRET=HIER_EIN_LANGES_SECRET
SCHEDULER_API_KEY=HIER_EIN_LANGES_SECRET
CRON_SECRET=HIER_EIN_LANGES_SECRET

DATABASE_URL=mysql://protrackr_user:DEIN_DB_PASSWORT@127.0.0.1:3306/protrackr

VITE_APP_TITLE=ProTrackr
VITE_APP_LOGO=

# Wichtig fuer lokalen Start mit http://localhost und pnpm start
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax
```

---

## 4) MySQL: Installation, Start, Service

### MySQL-Client-Pfad finden

```powershell
$mysql = Get-ChildItem "C:\Program Files\MySQL" -Filter mysql.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$mysql
& $mysql --version
```

### MySQL-Server manuell starten (ohne Service)

```powershell
$mysqld = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
$cfg    = "C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"
& $mysqld --defaults-file="$cfg" --console
```

Hinweis: Dieses Terminal offen lassen.

### MySQL als Windows-Service einrichten (Admin-PowerShell)

```powershell
$mysqld = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
$cfg    = "C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"

if (-not (Get-Service -Name MySQL84 -ErrorAction SilentlyContinue)) {
  & $mysqld --install MySQL84 --defaults-file="$cfg"
}
Start-Service MySQL84
Set-Service MySQL84 -StartupType Automatic
Get-Service MySQL84 | Select Name,Status,StartType
```

---

## 5) DB initialisieren (protrackr + user)

### Root-Passwort setzen (falls noetig)

```powershell
& $mysql -u root -h 127.0.0.1 -P 3306 -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'ChangeMe123!'; FLUSH PRIVILEGES;"
```

### Datenbank und App-User erstellen

```powershell
& $mysql -u root -p -h 127.0.0.1 -P 3306 -e "CREATE DATABASE IF NOT EXISTS protrackr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'protrackr_user'@'localhost' IDENTIFIED BY 'ProtrackrDb_2026_9xA7Qm'; CREATE USER IF NOT EXISTS 'protrackr_user'@'127.0.0.1' IDENTIFIED BY 'ProtrackrDb_2026_9xA7Qm'; GRANT ALL PRIVILEGES ON protrackr.* TO 'protrackr_user'@'localhost'; GRANT ALL PRIVILEGES ON protrackr.* TO 'protrackr_user'@'127.0.0.1'; FLUSH PRIVILEGES;"
```

### Verbindung testen

```powershell
& $mysql -u protrackr_user -p -h 127.0.0.1 -P 3306 -D protrackr -e "SELECT 'DB OK' AS status;"
```

---

## 6) Drizzle / App starten

### Schema anwenden

```powershell
pnpm db:push
```

### Entwicklung starten

```powershell
pnpm dev
```

### Produktionsmodus lokal

```powershell
pnpm build
pnpm start
```

---

## 7) Login-Bootstrap bei "Ungueltiger Mandant"

### Hash erzeugen

```powershell
$hash = node -e "const bcrypt=require('bcryptjs'); process.stdout.write(bcrypt.hashSync('ChangeMe123!',10));"
$hash
```

### Mandant + Admin-User upsert

```powershell
& $mysql -u protrackr_user -p -h 127.0.0.1 -P 3306 -D protrackr -e "INSERT INTO mandanten (name, mandantNr, createdAt, updatedAt) VALUES ('Doering Consulting','DC001',NOW(),NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), updatedAt=NOW(); SET @mid := (SELECT id FROM mandanten WHERE mandantNr='DC001' LIMIT 1); INSERT INTO users (mandantId,email,passwordHash,role,createdAt,updatedAt) VALUES (@mid,'a.doering@doering-consulting.eu','$hash','admin',NOW(),NOW()) ON DUPLICATE KEY UPDATE mandantId=VALUES(mandantId), passwordHash=VALUES(passwordHash), role=VALUES(role), updatedAt=NOW(); SELECT id,name,mandantNr FROM mandanten WHERE mandantNr='DC001'; SELECT id,email,mandantId,role FROM users WHERE email='a.doering@doering-consulting.eu';"
```

### Login-Daten

- Mandant: `DC001`
- E-Mail: `a.doering@doering-consulting.eu`
- Passwort: `ChangeMe123!`

---

## 8) Port-Checks und Stop/Restart

### Pruefen, ob App lauscht

```powershell
Test-NetConnection 127.0.0.1 -Port 3000
```

### Pruefen, ob MySQL lauscht

```powershell
Test-NetConnection 127.0.0.1 -Port 3306
```

### Prozess auf Port 3000 hart stoppen

```powershell
$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess
Stop-Process -Id $pid3000 -Force
```

---

## 9) Browser-Cache/ServiceWorker reset (bei hartnaeckigen UI-Problemen)

In Browser-DevTools Console:

```javascript
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
location.reload();
```

---

## 10) Autostart im Hintergrund (Task Scheduler)

### Startskript erzeugen

```powershell
$node = (Get-Command node.exe).Source
@"
@echo off
setlocal
cd /d C:\Projects\ProTrackr_developing_path
if not exist logs mkdir logs

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  echo [%date% %time%] Port 3000 already in use, skip start>> logs\app.log
  exit /b 0
)

set NODE_ENV=production
echo [%date% %time%] Starting ProTrackr>> logs\app.log
call "$node" dist\index.js >> logs\app.log 2>&1
echo [%date% %time%] ProTrackr exited with code %errorlevel%>> logs\app.log
endlocal
"@ | Set-Content -Encoding ASCII "C:\Projects\ProTrackr_developing_path\start-protrackr.cmd"
```

### Task anlegen (Admin empfohlen)

```powershell
schtasks /Delete /TN "ProTrackr-App" /F 2>$null
schtasks /Create /TN "ProTrackr-App" /SC ONLOGON /DELAY 0000:20 /TR "cmd /c C:\Projects\ProTrackr_developing_path\start-protrackr.cmd" /RL HIGHEST /F
```

### Task testen

```powershell
schtasks /Run /TN "ProTrackr-App"
Start-Sleep -Seconds 5
Test-NetConnection 127.0.0.1 -Port 3000
```

### Task deaktivieren/aktivieren

```powershell
schtasks /Change /TN "ProTrackr-App" /DISABLE
schtasks /Change /TN "ProTrackr-App" /ENABLE
```

---

## 11) Regelbetrieb: Update-Workflow

Nach Code-Update:

```powershell
cd "C:\Projects\ProTrackr_developing_path"
git pull origin ProTrackr_developing_path
pnpm install
pnpm build
```

Danach App neu starten (manuell oder via Task).

---

## 12) Schnell-Checkliste fuer "App oeffnen klappt nicht"

1. `Get-Service MySQL84 | Select Name,Status`
2. `Test-NetConnection 127.0.0.1 -Port 3306`
3. `Test-NetConnection 127.0.0.1 -Port 3000`
4. Falls 3000 = False: `pnpm start` oder Task erneut ausfuehren
5. Browser hard refresh: `Strg + F5`
