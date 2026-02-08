# E-Mail-Konfiguration für Passwort-Reset

Die Billing-App verwendet **Nodemailer** für den E-Mail-Versand. Diese Anleitung erklärt, wie Sie die E-Mail-Funktionalität für Passwort-Reset konfigurieren.

## Übersicht

Das E-Mail-System unterstützt:
- ✅ Passwort-Reset-E-Mails mit sicheren Tokens
- ✅ HTML-E-Mail-Templates mit professionellem Design
- ✅ Mehrere SMTP-Provider (Gmail, Outlook, SendGrid, etc.)
- ✅ Automatische Fehlerbehandlung und Logging

## Schnellstart

### 1. Umgebungsvariablen setzen

Erstellen Sie eine `.env`-Datei im Projekt-Root oder setzen Sie die Variablen in Ihrem Hosting-System:

```bash
# SMTP-Server-Konfiguration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ihre-email@gmail.com
SMTP_PASS=ihr-app-passwort
SMTP_FROM=noreply@doering-consulting.com
```

### 2. Provider-spezifische Konfiguration

#### Gmail

**Wichtig:** Verwenden Sie ein **App-Passwort**, nicht Ihr normales Gmail-Passwort!

1. Gehen Sie zu [Google Account Security](https://myaccount.google.com/security)
2. Aktivieren Sie 2-Faktor-Authentifizierung
3. Erstellen Sie ein App-Passwort unter "App-Passwörter"
4. Verwenden Sie dieses 16-stellige Passwort in `SMTP_PASS`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ihre-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # App-Passwort (ohne Leerzeichen)
```

#### Outlook / Office365

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ihre-email@outlook.com
SMTP_PASS=ihr-passwort
```

#### SendGrid

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxx  # Ihr SendGrid API Key
```

#### Andere SMTP-Server

```bash
SMTP_HOST=smtp.ihr-provider.de
SMTP_PORT=587  # oder 465 für SSL
SMTP_SECURE=false  # true für Port 465
SMTP_USER=ihre-email@provider.de
SMTP_PASS=ihr-passwort
```

## Umgebungsvariablen im Detail

| Variable | Beschreibung | Standard | Erforderlich |
|----------|--------------|----------|--------------|
| `SMTP_HOST` | SMTP-Server-Adresse | `smtp.gmail.com` | Ja |
| `SMTP_PORT` | SMTP-Port | `587` | Ja |
| `SMTP_SECURE` | SSL/TLS verwenden (true für Port 465) | `false` | Nein |
| `SMTP_USER` | SMTP-Benutzername (meist E-Mail) | - | Ja |
| `SMTP_PASS` | SMTP-Passwort oder API-Key | - | Ja |
| `SMTP_FROM` | Absender-Adresse | `SMTP_USER` | Nein |

## Funktionsweise

### Passwort-Reset-Flow

1. **Benutzer fordert Reset an:**
   ```typescript
   await trpc.auth.requestPasswordReset.mutate({ 
     email: 'user@example.com' 
   });
   ```

2. **System erstellt Token:**
   - Sicherer 64-Zeichen-Hex-Token wird generiert
   - Token wird in Datenbank gespeichert (1 Stunde gültig)
   - E-Mail mit Reset-Link wird versendet

3. **Benutzer klickt auf Link:**
   - Link enthält Token: `https://app.example.com/reset-password?token=abc123...`
   - Frontend validiert Token:
     ```typescript
     const { valid } = await trpc.auth.verifyResetToken.query({ token });
     ```

4. **Benutzer setzt neues Passwort:**
   ```typescript
   await trpc.auth.resetPassword.mutate({ 
     token, 
     newPassword: 'NewPassword123!' 
   });
   ```

5. **System aktualisiert Passwort:**
   - Passwort wird mit bcrypt gehasht
   - Token wird gelöscht
   - Benutzer kann sich mit neuem Passwort anmelden

## E-Mail-Templates

Die Passwort-Reset-E-Mail enthält:
- ✅ Professionelles HTML-Design
- ✅ Klickbarer Button mit Reset-Link
- ✅ Fallback-Link zum Kopieren
- ✅ Ablaufhinweis (1 Stunde)
- ✅ Sicherheitshinweis bei ungewollter Anfrage

### Beispiel-E-Mail

```
Betreff: Passwort zurücksetzen - Döring Consulting

Hallo,

Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.

[Passwort zurücksetzen] (Button)

Dieser Link ist 1 Stunde lang gültig.

Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.

Mit freundlichen Grüßen
Döring Consulting
```

## Testen der E-Mail-Konfiguration

### Test-E-Mail senden

```typescript
import { sendTestEmail } from './server/email';

// Test-E-Mail an Ihre Adresse senden
const success = await sendTestEmail('ihre-email@example.com');

if (success) {
  console.log('✅ E-Mail erfolgreich versendet');
} else {
  console.log('❌ E-Mail-Versand fehlgeschlagen');
}
```

### Verbindung testen

```typescript
import { testEmailConnection } from './server/email';

const isConnected = await testEmailConnection();

if (isConnected) {
  console.log('✅ SMTP-Verbindung erfolgreich');
} else {
  console.log('❌ SMTP-Verbindung fehlgeschlagen');
}
```

## Fehlerbehandlung

### Häufige Fehler

#### "Authentication failed"
- **Ursache:** Falsches Passwort oder fehlende App-Passwort-Konfiguration
- **Lösung:** Bei Gmail: App-Passwort verwenden, nicht normales Passwort

#### "Connection timeout"
- **Ursache:** Firewall blockiert SMTP-Port oder falscher Host
- **Lösung:** Port 587 oder 465 in Firewall freigeben

#### "Invalid login"
- **Ursache:** Falsche SMTP-Zugangsdaten
- **Lösung:** Benutzername und Passwort überprüfen

#### "E-Mail wird nicht versendet" (keine Fehlermeldung)
- **Ursache:** SMTP-Konfiguration fehlt
- **Lösung:** Alle erforderlichen Umgebungsvariablen setzen

### Logging

Das E-Mail-System loggt alle wichtigen Ereignisse:

```
✅ E-Mail-Transporter initialisiert: smtp.gmail.com:587
✅ E-Mail-Server-Verbindung erfolgreich
✅ E-Mail versendet: Passwort zurücksetzen an user@example.com (Message ID: <abc123@gmail.com>)
⚠️  E-Mail NICHT versendet (keine Konfiguration): Passwort zurücksetzen an user@example.com
❌ E-Mail-Versand fehlgeschlagen: Passwort zurücksetzen an user@example.com
```

## Sicherheit

### Best Practices

1. **App-Passwörter verwenden** (Gmail, Outlook)
   - Niemals Ihr Haupt-Passwort in Code oder Config-Dateien speichern

2. **Umgebungsvariablen schützen**
   - `.env`-Datei niemals in Git committen
   - `.env` in `.gitignore` eintragen

3. **SMTP-Credentials rotieren**
   - Passwörter regelmäßig ändern
   - Bei Verdacht auf Kompromittierung sofort ändern

4. **Rate-Limiting implementieren**
   - Maximal 3 Reset-Anfragen pro Stunde pro E-Mail
   - Verhindert Spam und Missbrauch

5. **E-Mail-Enumeration verhindern**
   - System gibt immer "success" zurück, auch wenn E-Mail nicht existiert
   - Verhindert, dass Angreifer gültige E-Mails herausfinden

### Token-Sicherheit

- **Token-Länge:** 64 Zeichen (256 Bit Entropie)
- **Token-Generierung:** `crypto.randomBytes(32).toString('hex')`
- **Token-Gültigkeit:** 1 Stunde
- **Token-Speicherung:** In Datenbank, nicht in E-Mail
- **Token-Cleanup:** Automatisch nach Reset oder Ablauf

## Produktions-Deployment

### Hosting-Plattformen

Die E-Mail-Konfiguration funktioniert auf allen gängigen Hosting-Plattformen:

- ✅ Manus (Umgebungsvariablen in Settings)
- ✅ Vercel (Environment Variables)
- ✅ Heroku (Config Vars)
- ✅ Railway (Environment Variables)
- ✅ Render (Environment Variables)
- ✅ VPS/Dedicated Server (.env-Datei oder System-Umgebungsvariablen)

### Manus-Deployment

1. Gehen Sie zu **Settings** → **Secrets** im Manus-Dashboard
2. Fügen Sie folgende Secrets hinzu:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM` (optional)
3. Deployen Sie die App
4. Testen Sie den Passwort-Reset-Flow

## Alternativen zu SMTP

Wenn Sie keinen SMTP-Server konfigurieren möchten, können Sie auch E-Mail-APIs verwenden:

### SendGrid API (empfohlen für Produktion)

```typescript
// Ersetzen Sie Nodemailer durch SendGrid SDK
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: email,
  from: 'noreply@doering-consulting.com',
  subject: 'Passwort zurücksetzen',
  html: emailHtml,
});
```

### Weitere Optionen

- **Mailgun:** E-Mail-API mit kostenlosem Tier
- **Amazon SES:** Günstig für hohe Volumina
- **Postmark:** Spezialisiert auf Transaktions-E-Mails
- **Resend:** Moderne E-Mail-API für Entwickler

## Support

Bei Problemen mit der E-Mail-Konfiguration:

1. Überprüfen Sie die Logs in der Konsole
2. Testen Sie die Verbindung mit `testEmailConnection()`
3. Senden Sie eine Test-E-Mail mit `sendTestEmail()`
4. Prüfen Sie die SMTP-Credentials bei Ihrem Provider

**Wichtig:** Die E-Mail-Funktionalität ist optional. Wenn keine SMTP-Konfiguration vorhanden ist, werden keine E-Mails versendet, aber die App funktioniert weiterhin normal.
