# Hard-Freeze: Version 1.0.81

Stand: 2026-03-17  
Branch: `cursor/app-leistung-hostinger-954a`  
Version: `1.0.81`  
Freeze-Commit (voll): `28f7093e360fd3c6ae2034ca2b7a29ef5e67fa85`

## Zweck

Dieser Freeze fixiert den bekannten stabilen Stand `1.0.81`.  
Falls spätere Änderungen verworfen werden sollen, kann jederzeit auf diesen Commit zurückgesetzt werden.

## Wiederherstellung (Windows PowerShell)

```powershell
cd "C:\Projects\ProTrackr_developing_path"
git fetch origin cursor/app-leistung-hostinger-954a
git checkout cursor/app-leistung-hostinger-954a
git reset --hard 28f7093e360fd3c6ae2034ca2b7a29ef5e67fa85
git clean -fd
pnpm install
pnpm build
.\desktop-neustart-protrackr.cmd
.\desktop-status-protrackr.cmd
```

## Wiederherstellung (Linux/macOS Shell)

```bash
cd /workspace
git fetch origin cursor/app-leistung-hostinger-954a
git checkout cursor/app-leistung-hostinger-954a
git reset --hard 28f7093e360fd3c6ae2034ca2b7a29ef5e67fa85
git clean -fd
pnpm install
pnpm build
```

## Hinweis

`git reset --hard` und `git clean -fd` entfernen lokale, uncommittete Änderungen im Arbeitsverzeichnis.
