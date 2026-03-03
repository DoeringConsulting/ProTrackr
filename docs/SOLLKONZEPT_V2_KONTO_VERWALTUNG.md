# Soll-Konzept v2: Konto-Verwaltung

**Status:** Freigegebene Umsetzungsgrundlage (nach Freeze 2026-03-03)  
**Basis:** `docs/FREEZE_KONTO_VERWALTUNG_2026-03-03.md`  
**Ziel:** Eindeutige Funktions- und Rechtevorgaben für Implementierung, Tests und Abnahme.

---

## 1) Zielbild

Die Konto-Verwaltung umfasst:

1. Rollen- und Rechteverwaltung für drei Rollen:
   - WebApp-Admin (global, DSGVO-blind)
   - Mandanten-Admin (mandantenbezogen)
   - Benutzer (einfach)
2. Mandantenkonforme Datennutzung über alle Kernbereiche
3. Passwort-Wiederherstellung per E-Mail-Link
4. DSGVO-konforme Trennung von Administrationsrechten und Dateneinsicht

---

## 2) Rollenmatrix (verbindlich)

| Funktion | WebApp-Admin | Mandanten-Admin | Benutzer |
|---|---|---|---|
| Benutzer anlegen/löschen/sperren | Ja (global) | Ja (nur eigener Mandant) | Nein |
| Import/Restore ausführen | Ja (blind, global) | Ja (eigener Mandant) | Nein |
| Mandantendaten einsehen (Kunden/Projekte/Berichte) | **Nein** | Ja (eigener Mandant) | Ja (eigener Mandant) |
| Steuern ändern | Nein | Ja (eigener Mandant) | Nein |
| Wechselkurse aktualisieren | Ja | Ja | Ja |
| Manuelle Wechselkurse anlegen | Ja (nur eigene) | Ja (nur eigene) | Ja (nur eigene) |
| Eigene Einträge ändern/löschen | N/A | Ja | Ja |
| Kundendaten löschen | Nein | Ja (eigener Mandant) | Nein |
| Admin-angelegte Fixkosten ändern/löschen | N/A | Ja (eigener Mandant) | Nein |
| Eigene Fixkosten ändern/löschen | Ja | Ja | Ja |
| Berichte über Mandantendaten erzeugen | Nein (keine Einsicht) | Ja (eigener Mandant) | Ja (eigener Mandant) |

**Hinweis:** WebApp-Admin darf Systemoperationen ausführen, aber keine Mandanten-Fachdaten lesen.

---

## 3) Daten-Scope und Ownership

## 3.1 Scope-Regeln

- Alle Fachdaten sind mandantengebunden.
- Jeder Zugriff erfolgt mit Scope-Prüfung:
  - Rolle
  - Mandantenzugehörigkeit
  - ggf. Eigentümer (ownerUserId)

## 3.2 Ownership-Regeln für Bearbeitung/Löschung

- **Eigene Daten:** Benutzer darf eigene Daten ändern/löschen, sofern nicht durch Admin-Schutz ausgeschlossen.
- **Admin-geschützte Datensätze:** durch einfache Benutzer nicht änder- oder löschbar.
- **Kundendaten:** nur Mandanten-Admin darf löschen.

## 3.3 Wechselkurse

- Manuelle Wechselkurse sind user-spezifisch (Owner-Prinzip).
- System-/NBP-Kurse können von allen aktualisiert werden.

---

## 4) Reporting-Scope

- Berichtsdaten für Mandanten-Admin und Benutzer: gesamter eigener Mandant.
- Kein mandantenübergreifendes Reporting.
- WebApp-Admin erhält keinen Zugriff auf Berichtsinhalte.

---

## 5) Passwort-Wiederherstellung (Reset-Flow)

## 5.1 Funktionsumfang (MVP)

1. „Passwort vergessen?“ auf Login-Seite
2. Eingabe von E-Mail (und mandantenbezogener Identifikation)
3. Versand einer Reset-E-Mail mit einmaligem Link
4. Seite „Neues Passwort vergeben“
5. Token-Validierung und Passwortsetzung
6. Token sofort ungültig nach Nutzung oder Ablauf

## 5.2 Sicherheitsanforderungen

- Token nur gehasht speichern (kein Klartext in DB)
- Kurze Gültigkeit (z. B. 30–60 Minuten)
- Rate-Limiting für Reset-Anfragen
- Neutrale Antworten (keine Offenlegung, ob E-Mail existiert)
- Optional: bestehende Sessions nach Reset invalidieren

---

## 6) DSGVO-Guardrails (verbindlich)

1. **Least Privilege:** nur erforderliche Rechte je Rolle
2. **Blind-Admin-Prinzip:** WebApp-Admin führt aus, sieht keine Mandanten-Fachdaten
3. **Audit Trail:** administrative Operationen (Import/Restore/Nutzerverwaltung) protokollieren
4. **Mandantentrennung:** harte technische Trennung in API- und Datenebene
5. **Datensparsamkeit:** nur notwendige Felder in Admin-Views
6. **Sichere Tokens:** kryptografisch starke, kurzlebige Reset-Token

---

## 7) Umsetzungsstruktur (empfohlen)

### Phase 1: Rollen + Scope + Guardrails
- Rollenprüfung pro Endpoint
- Mandanten-Scope technisch erzwingen
- Blind-Admin-Operationen absichern

### Phase 2: Konto-Verwaltung
- Benutzeranlage durch Admin-Rollen (ohne Einladung)
- Nutzer sperren/löschen
- Rechtekonforme UI-Freigaben

### Phase 3: Passwort-Reset
- Reset-Endpunkte + E-Mail-Versand
- Reset-UI + Token-Validierung
- Sicherheits- und Missbrauchsschutz

---

## 8) Abnahmekriterien (Definition of Done)

1. Rollenmatrix ist in Backend-Authorization vollständig umgesetzt.
2. Kein Zugriff auf fremde Mandantendaten durch API/Frontend möglich.
3. WebApp-Admin kann Import/Restore ausführen, aber keine Fachdaten lesen.
4. Passwort-Reset funktioniert Ende-zu-Ende inkl. Token-Ablauf.
5. Alle kritischen Rechtefälle sind durch Tests abgedeckt.
6. DSGVO-relevante Admin-Aktionen sind auditierbar.

---

## 9) Nicht-Ziele für diesen Umfang

- Einladung per E-Mail als Pflichtprozess (kommt ggf. in späterer Ausbaustufe)
- Erweiterte Rollenmodelle jenseits der drei definierten Rollen
- Mandantenübergreifende Auswertungen

