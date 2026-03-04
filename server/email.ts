import nodemailer from "nodemailer";

type MailTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type EmailDeliveryResult = {
  success: boolean;
  code: string;
  message: string;
  technicalReason?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getMailConfig(): MailTransportConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return { host, port, secure, user, pass, from };
}

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const config = getMailConfig();
  if (!config) return null;

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}

function mapEmailError(error: unknown): EmailDeliveryResult {
  const rawCode =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "SMTP_SEND_FAILED")
      : "SMTP_SEND_FAILED";
  const code = rawCode.toUpperCase();
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unbekannter SMTP-Fehler";

  const technicalReason = `${code}: ${rawMessage}`;

  switch (code) {
    case "EAUTH":
      return {
        success: false,
        code,
        message: "SMTP-Anmeldung fehlgeschlagen. Benutzername/Passwort pruefen.",
        technicalReason,
      };
    case "ECONNECTION":
    case "ESOCKET":
    case "ETIMEDOUT":
      return {
        success: false,
        code,
        message: "Verbindung zum SMTP-Server fehlgeschlagen.",
        technicalReason,
      };
    case "ETLS":
      return {
        success: false,
        code,
        message: "SMTP-TLS/SSL-Konfiguration ist ungueltig.",
        technicalReason,
      };
    default:
      return {
        success: false,
        code,
        message: "E-Mail-Versand fehlgeschlagen.",
        technicalReason,
      };
  }
}

function smtpNotConfiguredResult(): EmailDeliveryResult {
  return {
    success: false,
    code: "SMTP_NOT_CONFIGURED",
    message: "SMTP ist nicht vollstaendig konfiguriert.",
    technicalReason:
      "Erforderlich: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM",
  };
}

export async function testEmailConnectionDetailed(): Promise<EmailDeliveryResult> {
  const transporter = getTransporter();
  if (!transporter) return smtpNotConfiguredResult();

  try {
    await transporter.verify();
    return {
      success: true,
      code: "OK",
      message: "SMTP-Verbindung erfolgreich.",
    };
  } catch (error) {
    console.warn("[Email] SMTP verify failed:", error);
    return mapEmailError(error);
  }
}

export async function testEmailConnection(): Promise<boolean> {
  const result = await testEmailConnectionDetailed();
  return result.success;
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  resetLink: string;
  recipientName?: string | null;
  expiresMinutes?: number;
}): Promise<EmailDeliveryResult> {
  const transporter = getTransporter();
  const config = getMailConfig();

  if (!transporter || !config) {
    console.warn("[Email] SMTP not configured, password reset email not sent");
    return smtpNotConfiguredResult();
  }

  const recipient = params.recipientName?.trim() || "Nutzer";
  const expiresMinutes = params.expiresMinutes ?? 60;

  const subject = "Passwort zuruecksetzen - Doering Consulting";
  const text = [
    `Hallo ${recipient},`,
    "",
    "Sie haben eine Anfrage zum Zuruecksetzen Ihres Passworts gestellt.",
    `Bitte verwenden Sie innerhalb von ${expiresMinutes} Minuten folgenden Link:`,
    params.resetLink,
    "",
    "Falls Sie diese Anfrage nicht gestellt haben, koennen Sie diese E-Mail ignorieren.",
    "",
    "Mit freundlichen Gruessen",
    "Doering Consulting",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin-bottom: 12px;">Passwort zuruecksetzen</h2>
      <p>Hallo ${recipient},</p>
      <p>Sie haben eine Anfrage zum Zuruecksetzen Ihres Passworts gestellt.</p>
      <p>Der folgende Link ist <strong>${expiresMinutes} Minuten</strong> gueltig:</p>
      <p>
        <a href="${params.resetLink}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">
          Passwort zuruecksetzen
        </a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">
        Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br />
        ${params.resetLink}
      </p>
      <p style="font-size: 12px; color: #6b7280;">
        Falls Sie diese Anfrage nicht gestellt haben, koennen Sie diese E-Mail ignorieren.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: config.from,
      to: params.toEmail,
      subject,
      text,
      html,
    });
    return {
      success: true,
      code: "OK",
      message: "Passwort-Reset-E-Mail versendet.",
    };
  } catch (error) {
    console.warn("[Email] Failed to send password reset email:", error);
    return mapEmailError(error);
  }
}

