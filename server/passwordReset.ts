import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Passwort-Reset-Token-System
 * 
 * Funktionen für sichere Passwort-Reset-Flows:
 * 1. Token generieren und speichern
 * 2. Token validieren
 * 3. Passwort mit Token zurücksetzen
 */

/**
 * Sicheren Reset-Token generieren (32 Bytes, hex-codiert)
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Reset-Token für einen Benutzer erstellen und in Datenbank speichern
 * Token ist 1 Stunde gültig
 * 
 * @param email - E-Mail-Adresse des Benutzers
 * @returns Reset-Token oder null wenn Benutzer nicht gefunden
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const db = await getDb();
  if (!db) {
    console.error('[PasswordReset] Database not available');
    return null;
  }

  try {
    // Benutzer suchen
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userList.length === 0) {
      console.warn(`[PasswordReset] User not found: ${email}`);
      return null;
    }

    const user = userList[0];

    // Nur für Passport.js-Benutzer (haben passwordHash)
    if (!user.passwordHash) {
      console.warn(`[PasswordReset] User ${email} uses OAuth, no password reset needed`);
      return null;
    }

    // Token generieren
    const resetToken = generateResetToken();
    
    // Ablaufzeit: 1 Stunde ab jetzt
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Token in Datenbank speichern
    await db
      .update(users)
      .set({
        resetToken,
        resetTokenExpiry,
      })
      .where(eq(users.id, user.id));

    console.log(`[PasswordReset] Token created for user: ${email} (expires: ${resetTokenExpiry.toISOString()})`);
    
    return resetToken;
  } catch (error) {
    console.error('[PasswordReset] Failed to create reset token:', error);
    return null;
  }
}

/**
 * Reset-Token validieren
 * 
 * @param token - Reset-Token
 * @returns User-ID wenn Token gültig, sonst null
 */
export async function verifyPasswordResetToken(token: string): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.error('[PasswordReset] Database not available');
    return null;
  }

  try {
    // Benutzer mit diesem Token suchen
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);

    if (userList.length === 0) {
      console.warn('[PasswordReset] Token not found');
      return null;
    }

    const user = userList[0];

    // Prüfen ob Token abgelaufen ist
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      console.warn(`[PasswordReset] Token expired for user: ${user.email}`);
      return null;
    }

    console.log(`[PasswordReset] Token verified for user: ${user.email}`);
    return user.id;
  } catch (error) {
    console.error('[PasswordReset] Failed to verify reset token:', error);
    return null;
  }
}

/**
 * Passwort mit Reset-Token zurücksetzen
 * 
 * @param token - Reset-Token
 * @param newPassword - Neues Passwort (Klartext)
 * @returns true wenn erfolgreich, sonst false
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.error('[PasswordReset] Database not available');
    return false;
  }

  try {
    // Token validieren
    const userId = await verifyPasswordResetToken(token);
    if (!userId) {
      return false;
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Passwort aktualisieren und Token löschen
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      })
      .where(eq(users.id, userId));

    console.log(`[PasswordReset] Password reset successful for user ID: ${userId}`);
    return true;
  } catch (error) {
    console.error('[PasswordReset] Failed to reset password:', error);
    return false;
  }
}

/**
 * Reset-Token für einen Benutzer löschen (z.B. nach erfolgreichem Reset oder bei Abbruch)
 * 
 * @param email - E-Mail-Adresse des Benutzers
 */
export async function clearPasswordResetToken(email: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[PasswordReset] Database not available');
    return;
  }

  try {
    await db
      .update(users)
      .set({
        resetToken: null,
        resetTokenExpiry: null,
      })
      .where(eq(users.email, email));

    console.log(`[PasswordReset] Token cleared for user: ${email}`);
  } catch (error) {
    console.error('[PasswordReset] Failed to clear reset token:', error);
  }
}
