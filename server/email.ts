import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * E-Mail-Konfiguration für Passwort-Reset und andere Benachrichtigungen
 * 
 * Unterstützt verschiedene E-Mail-Provider:
 * - Gmail (SMTP)
 * - Outlook/Office365 (SMTP)
 * - SendGrid (SMTP)
 * - Beliebige SMTP-Server
 */

// E-Mail-Konfiguration aus Umgebungsvariablen
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true für Port 465, false für andere Ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@doering-consulting.com',
};

// Transporter-Instanz
let transporter: Transporter | null = null;

/**
 * E-Mail-Transporter initialisieren
 */
export function initializeEmailTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  // Prüfen ob E-Mail-Konfiguration vorhanden ist
  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn('⚠️  E-Mail-Konfiguration fehlt. Bitte SMTP_USER und SMTP_PASS in Umgebungsvariablen setzen.');
    console.warn('   E-Mails werden NICHT versendet.');
  }

  transporter = nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: EMAIL_CONFIG.auth,
  });

  console.log(`📧 E-Mail-Transporter initialisiert: ${EMAIL_CONFIG.host}:${EMAIL_CONFIG.port}`);
  
  return transporter;
}

/**
 * E-Mail-Verbindung testen
 */
export async function testEmailConnection(): Promise<boolean> {
  try {
    const transporter = initializeEmailTransporter();
    
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      return false;
    }

    await transporter.verify();
    console.log('✅ E-Mail-Server-Verbindung erfolgreich');
    return true;
  } catch (error) {
    console.error('❌ E-Mail-Server-Verbindung fehlgeschlagen:', error);
    return false;
  }
}

/**
 * E-Mail senden
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<boolean> {
  try {
    const transporter = initializeEmailTransporter();

    // Prüfen ob E-Mail-Konfiguration vorhanden ist
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn(`⚠️  E-Mail NICHT versendet (keine Konfiguration): ${options.subject} an ${options.to}`);
      return false;
    }

    const info = await transporter.sendMail({
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log(`✅ E-Mail versendet: ${options.subject} an ${options.to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error(`❌ E-Mail-Versand fehlgeschlagen: ${options.subject} an ${options.to}`, error);
    return false;
  }
}

/**
 * Passwort-Reset-E-Mail senden
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  baseUrl: string
): Promise<boolean> {
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  const subject = 'Passwort zurücksetzen - Döring Consulting';
  
  const text = `
Hallo,

Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.

Bitte klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen:
${resetLink}

Dieser Link ist 1 Stunde lang gültig.

Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.

Mit freundlichen Grüßen
Döring Consulting
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Passwort zurücksetzen</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
    <h2 style="color: #2563eb; margin-top: 0;">Passwort zurücksetzen</h2>
    
    <p>Hallo,</p>
    
    <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
    
    <p>Bitte klicken Sie auf den folgenden Button, um Ihr Passwort zurückzusetzen:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" 
         style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Passwort zurücksetzen
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666;">
      Oder kopieren Sie diesen Link in Ihren Browser:<br>
      <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
    </p>
    
    <p style="font-size: 14px; color: #666;">
      <strong>Dieser Link ist 1 Stunde lang gültig.</strong>
    </p>
    
    <p style="font-size: 14px; color: #666;">
      Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
    </p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; margin-bottom: 0;">
      Mit freundlichen Grüßen<br>
      <strong>Döring Consulting</strong>
    </p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

/**
 * Test-E-Mail senden (für Entwicklung/Debugging)
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Test-E-Mail - Döring Consulting',
    text: 'Dies ist eine Test-E-Mail. Wenn Sie diese E-Mail erhalten, funktioniert der E-Mail-Versand.',
    html: '<p>Dies ist eine <strong>Test-E-Mail</strong>. Wenn Sie diese E-Mail erhalten, funktioniert der E-Mail-Versand.</p>',
  });
}
