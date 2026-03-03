# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

---

## [1.0.12] - 2026-03-03

### Hinzugefügt

**Polnische Steuerengine (Variante B)** - Neue strukturierte Berechnungsbasis mit `taxProfiles` (Regime/Profile je Nutzer) und `taxConfigPl` (Jahreswerte), inkl. überarbeiteter Steuer-Einstellungen und konsolidierter Berechnungslogik für Reports/Dashboard.

### Geändert

**Dashboard-Zeitraum erweitert** - Diagramme und Kennzahlen unterstützen jetzt konsistent 3/6/12 Monate inklusive korrekter Mehrmonatsdarstellung.

**Fixkosten-Mehrwährung verbessert** - Beträge werden in der hinterlegten Originalwährung angezeigt; optional können alle Werte auf eine einheitliche Zielwährung umgerechnet werden.

### Behoben

**Wechselkurs-Tabelle korrigiert** - Skalierung und Beschriftung der Spalten wurden berichtigt (`1 X = x PLN` und `1 PLN = x X`), inklusive korrekter Wertebasis.

**Berichte-Währungsfehler behoben** - Buchhaltungsbericht und Kundenbericht verwenden jetzt dieselbe Mehrwährungslogik wie Fixkosten in den Einstellungen (Originalwährung + optionale einheitliche Zielwährung).

---

## [1.0.11] - 2026-02-15

### Geändert

**Dokumentationsstruktur ausgebaut** - Technische Historie, Changelog und Architektur-Dokumentation wurden konsistent getrennt und erweitert.

---

## [1.0.10] - 2026-02-14

### Hinzugefügt

**Mandanten-Verwaltung** - Die Anwendung unterstützt jetzt mehrere Mandanten mit getrennten Datenbeständen. Beim Login muss zusätzlich zur E-Mail-Adresse und dem Passwort der Mandant angegeben werden (Mandanten-Nr. oder Name). Dies ermöglicht es, mehrere Unternehmen oder Abteilungen in einer Installation zu verwalten, wobei jeder Mandant seine eigenen Kunden, Zeiteinträge und Dokumente hat.

**Erster Mandant** - Der Mandant "Döring Consulting" (Mandanten-Nr. DC001) wurde als erster Mandant angelegt. Alle bestehenden Daten wurden diesem Mandanten zugeordnet.

### Geändert

**Login-Formular erweitert** - Das Login-Formular enthält jetzt drei Felder statt zwei: Mandant (Mandanten-Nr. oder Name), E-Mail-Adresse und Passwort. Die Eingabe des Mandanten ist erforderlich und wird bei der Authentifizierung validiert.

**Admin-Zugangsdaten aktualisiert** - Die E-Mail-Adresse des Administrator-Accounts wurde von admin@doering-consulting.eu auf a.doering@doering-consulting.eu geändert. Das Passwort wurde neu generiert und sollte nach dem ersten Login geändert werden.

### Behoben

**Login-Problem** - Der Login mit den Administrator-Zugangsdaten funktionierte nicht, da der Passwort-Hash in der Datenbank inkorrekt war. Der Hash wurde neu generiert und das Problem wurde behoben.

### Sicherheit

**Stärkere Datentrennung** - Durch die Mandanten-Verwaltung sind die Daten verschiedener Mandanten strikt getrennt. Benutzer können nur auf Daten ihres eigenen Mandanten zugreifen.

### Login-Daten

- **Mandant:** DC001 oder "Döring Consulting"
- **E-Mail:** a.doering@doering-consulting.eu  
- **Passwort:** ChangeMe123! (bitte nach erstem Login ändern)

### Bekannte Probleme

**Login-Schleife** - Nach erfolgreichem Login wird der Benutzer möglicherweise wieder zur Login-Seite weitergeleitet. Dieses Problem tritt sporadisch auf und wird in einer zukünftigen Version behoben.

---

## [1.0.9] - 2026-02-14

### Hinzugefügt

**E-Mail/Passwort-Authentifizierung** - Die Anwendung verwendet jetzt ein eigenes Login-System mit E-Mail-Adresse und Passwort statt der externen Manus OAuth-Authentifizierung. Dies bietet mehr Kontrolle und Unabhängigkeit.

**Login-Seite** - Eine neue Login-Seite wurde hinzugefügt, auf der Benutzer sich mit ihrer E-Mail-Adresse und ihrem Passwort anmelden können. Die Seite ist unter `/login` erreichbar.

**Logout-Funktion** - Benutzer können sich jetzt über das Benutzermenü in der Seitenleiste abmelden. Nach dem Logout wird die Session beendet und der Benutzer zur Login-Seite weitergeleitet.

**Rollenbasierte Zugriffskontrolle** - Die Anwendung unterstützt jetzt zwei Benutzerrollen: "user" und "admin". Administratoren haben Zugriff auf alle Funktionen, während normale Benutzer eingeschränkte Rechte haben.

**Session-Management** - Benutzer-Sessions werden serverseitig verwaltet und bleiben für 7 Tage gültig. Nach Ablauf der Session muss sich der Benutzer erneut anmelden.

### Geändert

**Geschützte Routen** - Alle geschäftskritischen API-Routen (Kunden, Zeiterfassung, Reisekosten, Dokumente, Einstellungen) erfordern jetzt eine Authentifizierung. Nicht angemeldete Benutzer werden automatisch zur Login-Seite weitergeleitet.

**Dynamische Benutzer-ID** - Alle Datenbankabfragen verwenden jetzt die ID des angemeldeten Benutzers statt einer fest codierten ID. Dies ermöglicht echte Mehrbenutzer-Fähigkeit.

**Scheduler-Absicherung** - Die Scheduler-Endpoints (z.B. für automatische Backups) sind jetzt mit einem API-Key geschützt. Nur Anfragen mit gültigem API-Key werden akzeptiert.

### Sicherheit

**Passwort-Hashing** - Passwörter werden mit bcrypt gehasht (10 Runden) und niemals im Klartext gespeichert.

**Sichere Session-Cookies** - Session-Cookies sind als "httpOnly" und "secure" markiert, um XSS- und Man-in-the-Middle-Angriffe zu verhindern.

**CSRF-Protection** - Die Anwendung verwendet Helmet für zusätzliche Sicherheits-Header.

---

## [1.0.8] - 2026-02-14

### Behoben

**Update-Banner Timeout** - Das Update-Banner erschien nach einem Deployment, aber nach Klick auf "Jetzt aktualisieren" passierte nichts. Dies lag daran, dass auf iOS Safari das `controllerchange`-Event nicht gefeuert wurde. Der Reload erfolgt jetzt direkt nach dem Senden der `SKIP_WAITING`-Nachricht an den Service Worker, ohne auf das Event zu warten.

**Doppel-Reload nach Update** - Nach einem Update wurde die Seite zweimal neu geladen: einmal automatisch und einmal durch den Button-Klick. Dies wurde behoben, indem der automatische Reload deaktiviert wurde. Der Benutzer kontrolliert jetzt den Zeitpunkt des Reloads über den Button.

**Service Worker Aktivierung** - Der Service Worker aktivierte sich zu früh, bevor der Benutzer bereit war. Dies wurde behoben, indem `skipWaiting()` nur noch auf explizite Nachricht vom Client aufgerufen wird, nicht mehr automatisch beim Install-Event.

### Geändert

**Update-Benachrichtigung** - Das Update-System zeigt jetzt nur noch eine Benachrichtigung an, ohne automatisch neu zu laden. Der Benutzer entscheidet selbst, wann er die neue Version laden möchte.

---

## [1.0.7] - 2026-02-14

### Behoben

**Reisekosten Datum-Offset** - Reisekosteneinträge wurden einen Tag zu früh gespeichert. Beispiel: Ein Eintrag für den 14. Februar wurde als 13. Februar gespeichert. Dies lag an der Verwendung von `.toISOString()`, das lokale Zeiten nach UTC konvertiert und dabei einen Tag-Offset verursacht. Das Problem wurde behoben, indem das Datum als lokaler String (YYYY-MM-DD) formatiert wird, ohne UTC-Konvertierung.

---

## [1.0.6] - 2026-02-14

### Hinzugefügt

**Initiale Version** - Erste funktionsfähige Version der Anwendung mit folgenden Features:

- **Dashboard** mit Übersicht über Kunden, Zeiteinträge und Umsätze
- **Kundenverwaltung** zum Anlegen und Bearbeiten von Kunden
- **Zeiterfassung** zum Erfassen von Arbeitszeiten pro Kunde und Projekt
- **Reisekostenverwaltung** zum Erfassen von Reisekosten (Kilometer, Verpflegung, Übernachtung)
- **Berichtswesen** mit Auswertungen und Exporten
- **Einstellungen** für Stundensätze, Währungen und Steuersätze
- **Datenbank-Import/Export** für Backups
- **Offline-Funktionalität** mit Service Worker
- **Responsive Design** für Desktop und Mobile

---

## Upgrade-Hinweise

### Von 1.0.9 auf 1.0.10

Nach dem Update müssen Sie beim Login zusätzlich den Mandanten angeben:

- **Mandant:** DC001 oder "Döring Consulting"
- **E-Mail:** Ihre bisherige E-Mail-Adresse
- **Passwort:** Ihr bisheriges Passwort

Falls Sie die Admin-E-Mail-Adresse admin@doering-consulting.eu verwendet haben, wurde diese auf a.doering@doering-consulting.eu geändert.

### Von 1.0.8 auf 1.0.9

Nach dem Update müssen Sie sich mit E-Mail-Adresse und Passwort anmelden. Die Manus OAuth-Authentifizierung wird nicht mehr verwendet.

**Standard-Admin-Account:**
- **E-Mail:** admin@doering-consulting.eu (in v1.0.10 geändert auf a.doering@doering-consulting.eu)
- **Passwort:** ChangeMe123! (bitte nach erstem Login ändern)

### Von 1.0.7 auf 1.0.8

Keine besonderen Schritte erforderlich. Das Update-System funktioniert jetzt zuverlässiger.

### Von 1.0.6 auf 1.0.7

Keine besonderen Schritte erforderlich. Bestehende Reisekosteneinträge mit falschem Datum müssen manuell korrigiert werden.

---

## Roadmap

### Geplante Features

**Passwort-Änderung** - Benutzer sollen ihr Passwort selbst ändern können, ohne dass ein Administrator eingreifen muss.

**User-Verwaltung** - Administratoren sollen neue Benutzer anlegen und bestehende Benutzer verwalten können (E-Mail, Rolle, Mandant).

**Mandanten-Verwaltung** - Administratoren sollen neue Mandanten anlegen und bestehende Mandanten bearbeiten können (Name, Mandanten-Nr., Logo).

**E-Mail-Benachrichtigungen** - Benutzer sollen E-Mail-Benachrichtigungen für wichtige Ereignisse erhalten (z.B. Password-Reset, neue Dokumente).

**Zwei-Faktor-Authentifizierung** - Benutzer sollen optional eine Zwei-Faktor-Authentifizierung aktivieren können für erhöhte Sicherheit.

**Rechnungserstellung** - Automatische Erstellung von Rechnungen basierend auf erfassten Zeiteinträgen und Reisekosten.

**Projektverwaltung** - Verwaltung von Projekten mit Budget-Tracking und Fortschrittsanzeige.

**Team-Funktionen** - Mehrere Benutzer pro Mandant mit unterschiedlichen Rollen und Berechtigungen.

---

*Für technische Details siehe [DEVELOPMENT_HISTORY.md](./DEVELOPMENT_HISTORY.md)*
