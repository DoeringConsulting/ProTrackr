# Konzept: Konto-Verwaltung für Döring Consulting

**Status:** Konzept-Phase (Umsetzung noch nicht freigegeben)  
**Erstellt:** 09.02.2026  
**Autor:** Manus AI

---

## Übersicht

Die Konto-Verwaltung ermöglicht es Nutzern, Firmenstammdaten zu hinterlegen, ein Firmenlogo hochzuladen und optional weitere Benutzer mit unterschiedlichen Rechten anzulegen. Das Konzept fokussiert sich auf eine **praktikable, schlanke Umsetzung ohne unnötigen Firlefanz**.

---

## 1. Firmenstammdaten

### 1.1 Firmenlogo

**Zweck:** Das Firmenlogo erscheint auf allen generierten PDF-Rechnungen und Berichten.

**Umsetzung:**
- Upload-Bereich mit Drag & Drop-Funktion
- Unterstützte Formate: PNG, JPG, SVG (max. 2 MB)
- Automatische Größenanpassung auf 200x80px (Seitenverhältnis beibehalten)
- Vorschau des hochgeladenen Logos
- Speicherung in S3 (bereits implementiert via `storagePut`)
- Logo-URL und Logo-Key in `accountSettings`-Tabelle

**Datenbank:** Bereits vorhanden (`companyLogoUrl`, `companyLogoKey`)

**Backend-API:** Bereits implementiert (`accountSettings.upsert`)

---

### 1.2 Firmendaten

**Zweck:** Firmendaten werden auf Rechnungen und Berichten angezeigt.

**Felder:**
- Firmenname (z.B. "Döring Consulting")
- Straße und Hausnummer
- Postleitzahl und Ort
- Land
- USt-ID / VAT-ID
- Steuernummer (z.B. polnische NIP)
- Bankname
- IBAN
- SWIFT/BIC

**Datenbank:** Bereits vorhanden (alle Felder in `accountSettings`-Tabelle)

**Backend-API:** Bereits implementiert (`accountSettings.upsert`)

**UI-Umsetzung:**
- Formular mit allen Feldern
- Speichern-Button am Ende
- Vorschau der Rechnungskopfzeile mit Logo und Firmendaten

---

## 2. Mehrbenutzer-Verwaltung

### 2.1 Benutzer-Rollen

**Zwei Rollen:**

| Rolle | Beschreibung | Rechte |
|-------|--------------|--------|
| **Admin** | Vollzugriff auf alle Funktionen | Lesen, Schreiben, Löschen, Benutzer verwalten |
| **Benutzer** | Eingeschränkter Zugriff | Lesen, Schreiben (eigene Daten), kein Löschen, keine Benutzerverwaltung |

**Hinweis:** Keine weiteren Rollen (z.B. "Buchhalter", "Manager") in der ersten Version. Einfach halten.

---

### 2.2 Rechteverwaltung

**Rechte pro Feature:**

| Feature | Admin | Benutzer |
|---------|-------|----------|
| **Zeiterfassung** | Lesen, Schreiben, Löschen (alle) | Lesen, Schreiben (nur eigene) |
| **Reisekosten** | Lesen, Schreiben, Löschen (alle) | Lesen, Schreiben (nur eigene) |
| **Kunden** | Lesen, Schreiben, Löschen | Nur Lesen |
| **Berichte** | Lesen, Exportieren (alle) | Lesen, Exportieren (nur eigene Daten) |
| **Fixkosten** | Lesen, Schreiben, Löschen | Nur Lesen |
| **Steuereinstellungen** | Lesen, Schreiben | Nur Lesen |
| **Wechselkurse** | Lesen, Schreiben | Nur Lesen |
| **Datensicherung** | Backup erstellen, Importieren | Nur Backup erstellen |
| **Benutzerverwaltung** | Benutzer anlegen, bearbeiten, löschen | Kein Zugriff |

**Implementierung:**
- Backend: Prüfung der Benutzerrolle in tRPC-Procedures
- Frontend: Bedingte Anzeige von Buttons/Formularen basierend auf Rolle
- Keine komplexe ACL-Bibliothek nötig – einfache if/else-Checks

---

### 2.3 Benutzer anlegen

**Prozess:**

1. **Admin öffnet Benutzerverwaltung** (neuer Tab in Einstellungen)
2. **Formular ausfüllen:**
   - E-Mail-Adresse (Pflicht)
   - Name (Pflicht)
   - Rolle: Admin oder Benutzer (Dropdown)
3. **Einladungs-E-Mail senden:**
   - Automatische E-Mail mit Einladungslink
   - Link enthält Token (gültig 7 Tage)
   - Benutzer setzt Passwort beim ersten Login
4. **Benutzer aktivieren:**
   - Benutzer klickt auf Link
   - Passwort setzen (min. 8 Zeichen)
   - Login mit E-Mail + Passwort

**Datenbank-Erweiterung:**

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  invitation_token VARCHAR(255),
  invitation_expires TIMESTAMP,
  is_active INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Backend-API:**
- `users.create` (nur Admin)
- `users.list` (nur Admin)
- `users.update` (nur Admin)
- `users.delete` (nur Admin)
- `users.acceptInvitation` (öffentlich, mit Token)

**E-Mail-Versand:** Bereits implementiert (Nodemailer mit hoste.pl SMTP)

---

### 2.4 Benutzer-Übersicht

**UI-Elemente:**
- Tabelle mit allen Benutzern
- Spalten: Name, E-Mail, Rolle, Status (Aktiv/Eingeladen), Erstellt am
- Aktionen: Bearbeiten, Löschen, Einladung erneut senden
- Filter: Alle, Aktiv, Eingeladen
- Suche nach Name oder E-Mail

**Bearbeiten:**
- Name ändern
- Rolle ändern (Admin ↔ Benutzer)
- Benutzer deaktivieren (statt löschen)

**Löschen:**
- Bestätigungs-Dialog
- Warnung: "Alle Zeiterfassungen und Reisekosten dieses Benutzers bleiben erhalten"
- Soft-Delete: `is_active = 0` statt echtem Löschen

---

## 3. Authentifizierung

**Hinweis:** Authentifizierung wurde für die Entwicklungsphase komplett deaktiviert. Vor finalem Release muss sie neu implementiert werden.

**Empfohlene Lösung:**
- **Passport.js** (bereits vorbereitet, aber entfernt)
- E-Mail + Passwort (Local Strategy)
- Session-basiert (express-session)
- Passwort-Hashing mit bcrypt

**Alternative:**
- **Auth.js** (ehemals NextAuth.js) – moderne, sichere Lösung
- Unterstützt E-Mail/Passwort + OAuth (Google, Microsoft)
- Einfache Integration mit tRPC

**Entscheidung:** Passport.js beibehalten (bereits konfiguriert, nur reaktivieren)

---

## 4. UI-Mockup: Konto-Verwaltung

### 4.1 Tab-Struktur

**Einstellungen → Konto**

**Untertabs:**
1. **Firmendaten** (Logo, Name, Adresse, Bankverbindung)
2. **Benutzerverwaltung** (nur für Admins sichtbar)

---

### 4.2 Firmendaten-Tab

```
┌─────────────────────────────────────────────────────────┐
│ Firmendaten                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Firmenlogo                                              │
│ ┌─────────────────────────────────────────────────┐   │
│ │ [Drag & Drop oder Klicken zum Hochladen]        │   │
│ │                                                 │   │
│ │ Unterstützte Formate: PNG, JPG, SVG (max. 2MB) │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Vorschau:                                               │
│ ┌─────────────────────────────────────────────────┐   │
│ │  [LOGO]                                         │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Firmenname *                                            │
│ [Döring Consulting                                ]   │
│                                                         │
│ Straße und Hausnummer                                   │
│ [Musterstraße 123                                 ]   │
│                                                         │
│ PLZ / Ort                                               │
│ [12345] [Warschau                                 ]   │
│                                                         │
│ Land                                                    │
│ [Polen                                            ]   │
│                                                         │
│ USt-ID / VAT-ID                                         │
│ [PL1234567890                                     ]   │
│                                                         │
│ Steuernummer (NIP)                                      │
│ [1234567890                                       ]   │
│                                                         │
│ Bankverbindung                                          │
│ Bankname: [PKO Bank Polski                       ]   │
│ IBAN:     [PL12 3456 7890 1234 5678 9012 3456    ]   │
│ SWIFT:    [PKOPPLPW                              ]   │
│                                                         │
│                             [Speichern]                 │
└─────────────────────────────────────────────────────────┘
```

---

### 4.3 Benutzerverwaltung-Tab (nur Admin)

```
┌─────────────────────────────────────────────────────────┐
│ Benutzerverwaltung                      [+ Benutzer]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Suche: Name oder E-Mail...           ] [Alle ▼]       │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Name         E-Mail           Rolle   Status    │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ Alex Döring  a.doering@...    Admin   Aktiv  ✏️│   │
│ │ Max Müller   m.mueller@...    Benutzer Aktiv  ✏️│   │
│ │ Anna Schmidt a.schmidt@...    Benutzer Eingeladen🔄│   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Legende:                                                │
│ ✏️ = Bearbeiten  🗑️ = Löschen  🔄 = Einladung erneut senden │
└─────────────────────────────────────────────────────────┘
```

**Dialog: Benutzer anlegen**

```
┌─────────────────────────────────────────────────────────┐
│ Neuen Benutzer einladen                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ E-Mail-Adresse *                                        │
│ [max.mustermann@example.com                       ]   │
│                                                         │
│ Name *                                                  │
│ [Max Mustermann                                   ]   │
│                                                         │
│ Rolle *                                                 │
│ [Benutzer ▼]                                            │
│   - Admin (Vollzugriff)                                 │
│   - Benutzer (Eingeschränkt)                            │
│                                                         │
│ ℹ️ Der Benutzer erhält eine Einladungs-E-Mail mit      │
│   einem Link zum Setzen des Passworts.                  │
│                                                         │
│                     [Abbrechen] [Einladen]              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Umsetzungsplan

### Phase 1: Firmendaten (2-3 Stunden)
1. UI für Firmendaten-Formular erstellen
2. Logo-Upload mit S3-Integration
3. Speichern/Laden der Firmendaten
4. Vorschau der Rechnungskopfzeile

### Phase 2: Benutzerverwaltung (4-5 Stunden)
1. `users`-Tabelle in Datenbank erstellen
2. Backend-API für Benutzerverwaltung
3. UI für Benutzer-Übersicht (Tabelle)
4. Dialog für Benutzer anlegen
5. Einladungs-E-Mail-Template

### Phase 3: Authentifizierung (3-4 Stunden)
1. Passport.js reaktivieren
2. Login/Registrierung-Seiten wiederherstellen
3. Session-Management
4. Passwort-Reset-Flow (bereits implementiert)

### Phase 4: Rechteverwaltung (2-3 Stunden)
1. Rolle-Prüfung in tRPC-Procedures
2. Frontend: Bedingte Anzeige basierend auf Rolle
3. Testen aller Rechte-Szenarien

**Gesamt: 11-15 Stunden**

---

## 6. Offene Fragen

1. **Sollen Benutzer ihre eigenen Zeiterfassungen sehen können?**  
   → Ja (bereits geplant: "Lesen, Schreiben (nur eigene)")

2. **Sollen Benutzer Berichte für alle Kunden sehen können?**  
   → Nein (nur eigene Daten)

3. **Sollen deaktivierte Benutzer ihre Daten noch sehen können?**  
   → Nein (Login nicht möglich)

4. **Soll es eine "Benutzer wechseln"-Funktion für Admins geben?**  
   → Optional (nice-to-have, nicht prioritär)

---

## 7. Zusammenfassung

Das Konzept für die Konto-Verwaltung ist **schlank, praktikabel und ohne Firlefanz**. Es fokussiert sich auf die essentiellen Features:

- **Firmenstammdaten:** Logo, Name, Adresse, Bankverbindung
- **Mehrbenutzer:** Admin und Benutzer mit klaren Rechten
- **Rechteverwaltung:** Einfache Rolle-basierte Zugriffskontrolle
- **Einladungs-System:** E-Mail-Einladungen mit Token

Die Datenbank und Backend-API sind bereits vorbereitet. Die Umsetzung kann nach Freigabe in **11-15 Stunden** erfolgen.

---

**Nächste Schritte:**
1. Konzept mit Nutzer besprechen
2. Freigabe für Umsetzung einholen
3. Phase 1 (Firmendaten) implementieren
4. Feedback einholen und Phase 2-4 umsetzen
