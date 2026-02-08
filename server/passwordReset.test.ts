import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
  resetPasswordWithToken,
  clearPasswordResetToken,
  generateResetToken,
} from './passwordReset';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

describe('Password Reset System', () => {
  const testEmail = `test-reset-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  let testUserId: number;

  beforeEach(async () => {
    // Clean up any existing test user first
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    await db.delete(users).where(eq(users.email, testEmail));

    // Create a test user with password
    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    const result = await db.insert(users).values({
      email: testEmail,
      name: 'Test User',
      passwordHash,
      emailVerified: 1,
      loginMethod: 'local',
    });

    testUserId = Number(result[0].insertId);
  });

  afterEach(async () => {
    // Clean up test user after each test
    const db = await getDb();
    if (!db) return;

    await db.delete(users).where(eq(users.email, testEmail));
    
    // Also clean up OAuth test user if it exists
    const oauthEmailPattern = 'oauth-%@example.com';
    await db.delete(users).where(eq(users.loginMethod, 'oauth'));
  });

  describe('generateResetToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = generateResetToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create a reset token for existing user', async () => {
      const token = await createPasswordResetToken(testEmail);
      
      expect(token).toBeTruthy();
      expect(token).toHaveLength(64);

      // Verify token is stored in database
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const userList = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      expect(userList).toHaveLength(1);
      expect(userList[0].resetToken).toBe(token);
      expect(userList[0].resetTokenExpiry).toBeTruthy();
      
      // Token should expire in ~1 hour
      const expiryTime = userList[0].resetTokenExpiry!.getTime();
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      expect(expiryTime).toBeGreaterThan(now);
      expect(expiryTime).toBeLessThan(now + oneHour + 1000); // +1s tolerance
    });

    it('should return null for non-existent user', async () => {
      const token = await createPasswordResetToken('nonexistent@example.com');
      expect(token).toBeNull();
    });

    it('should return null for OAuth user (no password)', async () => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const oauthEmail = `oauth-${Date.now()}@example.com`;
      await db.insert(users).values({
        email: oauthEmail,
        name: 'OAuth User',
        openId: 'oauth-123',
        passwordHash: null, // OAuth user has no password
        emailVerified: 1,
        loginMethod: 'oauth',
      });

      const token = await createPasswordResetToken(oauthEmail);
      expect(token).toBeNull();
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('should verify a valid token', async () => {
      const token = await createPasswordResetToken(testEmail);
      expect(token).toBeTruthy();

      const userId = await verifyPasswordResetToken(token!);
      expect(userId).toBe(testUserId);
    });

    it('should return null for invalid token', async () => {
      const userId = await verifyPasswordResetToken('invalid-token-123');
      expect(userId).toBeNull();
    });

    it('should return null for expired token', async () => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Create token and immediately expire it
      const token = generateResetToken();
      const expiredTime = new Date(Date.now() - 1000); // 1 second ago

      await db
        .update(users)
        .set({
          resetToken: token,
          resetTokenExpiry: expiredTime,
        })
        .where(eq(users.id, testUserId));

      const userId = await verifyPasswordResetToken(token);
      expect(userId).toBeNull();
    });
  });

  describe('resetPasswordWithToken', () => {
    it('should reset password with valid token', async () => {
      const token = await createPasswordResetToken(testEmail);
      expect(token).toBeTruthy();

      const newPassword = 'NewPassword456!';
      const success = await resetPasswordWithToken(token!, newPassword);
      expect(success).toBe(true);

      // Verify password was changed
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1);

      expect(userList).toHaveLength(1);
      const user = userList[0];

      // Old password should not work
      const oldPasswordValid = await bcrypt.compare(testPassword, user.passwordHash!);
      expect(oldPasswordValid).toBe(false);

      // New password should work
      const newPasswordValid = await bcrypt.compare(newPassword, user.passwordHash!);
      expect(newPasswordValid).toBe(true);

      // Token should be cleared
      expect(user.resetToken).toBeNull();
      expect(user.resetTokenExpiry).toBeNull();
    });

    it('should fail with invalid token', async () => {
      const success = await resetPasswordWithToken('invalid-token', 'NewPassword123!');
      expect(success).toBe(false);
    });

    it('should fail with expired token', async () => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const token = generateResetToken();
      const expiredTime = new Date(Date.now() - 1000);

      await db
        .update(users)
        .set({
          resetToken: token,
          resetTokenExpiry: expiredTime,
        })
        .where(eq(users.id, testUserId));

      const success = await resetPasswordWithToken(token, 'NewPassword123!');
      expect(success).toBe(false);
    });
  });

  describe('clearPasswordResetToken', () => {
    it('should clear reset token for user', async () => {
      const token = await createPasswordResetToken(testEmail);
      expect(token).toBeTruthy();

      await clearPasswordResetToken(testEmail);

      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1);

      expect(userList).toHaveLength(1);
      expect(userList[0].resetToken).toBeNull();
      expect(userList[0].resetTokenExpiry).toBeNull();
    });
  });
});
