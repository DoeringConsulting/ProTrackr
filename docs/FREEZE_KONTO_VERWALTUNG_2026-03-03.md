# Freeze: Konto-Verwaltung (Stand 2026-03-03)

**Status:** AKTIV (verbindlich)  
**Gültig ab:** 2026-03-03  
**Zweck:** Verbindlicher Entscheidungsstand als Basis für Implementierung und Abnahme.

---

## 1) Geltungsbereich dieses Freeze

Dieser Freeze gilt für:

- Rollen- und Rechtemodell (WebApp-Admin, Mandanten-Admin, Benutzer)
- Datenzugriffsgrenzen (Mandant, Benutzer, globale Operationen)
- Import/Restore-Regeln
- Fixkosten- und Wechselkurs-Regeln
- Passwort-Wiederherstellung

Nicht Bestandteil dieses Freeze:

- UI-Design-Feinspezifikation
- technische Detail-Entscheidungen zur Implementierung (nur Zielverhalten ist fixiert)

---

## 2) Verbindliche Entscheidungen (final)

### 2.1 Benutzeranlage

- **Zunächst ohne Einladungs-E-Mail**.
- Benutzer werden direkt durch Admin-Rollen angelegt.

### 2.2 Rollenmodell

#### WebApp-Admin (global)
- Darf Nutzer anlegen/löschen/sperren.
- Darf Import/Restore ausführen.
- Darf **keine** Mandanten-Fachdaten einsehen (DSGVO).
- Import/Restore als **blinde Admin-Operation**: ausführen ja, Dateninhalt nein.

#### Mandanten-Admin (mandantenbezogen)
- Vollrechte innerhalb des eigenen Mandanten.
- Darf Benutzer im eigenen Mandanten anlegen/löschen.
- Darf Import/Restore/Steuern im eigenen Mandanten verwalten.

#### Benutzer (einfach)
- Darf eigene Einträge ändern/löschen.
- Darf Kundendaten nicht löschen.
- Darf admin-angelegte Fixkosten nicht ändern/löschen.
- Darf eigene Fixkosten ändern/löschen.

### 2.3 Reporting

- Mandanten-Admin und Benutzer dürfen Berichte über **alle dem Mandanten zugeordneten** Daten erstellen.

### 2.4 Wechselkurse

- Wechselkurs-Aktualisierung für alle Rollen erlaubt.
- Manuell angelegte Wechselkurse gelten nur für den anlegenden Benutzer.

### 2.5 Passwort-Wiederherstellung (Pflicht)

- Passwort-Reset muss implementiert werden.
- Flow: E-Mail + Wiederherstellungslink + Vergabe eines neuen Passworts.

---

## 3) Änderungsregeln für diesen Freeze

- Änderungen am Freeze sind nur als dokumentierte Entscheidung mit Datum zulässig.
- Jede Abweichung in Implementierung oder Tests ohne vorherige Freeze-Anpassung ist als Defekt zu behandeln.

---

## 4) Nächster Schritt

Auf Basis dieses Freeze wird das Dokument  
**`docs/SOLLKONZEPT_V2_KONTO_VERWALTUNG.md`** als Umsetzungsgrundlage geführt.

