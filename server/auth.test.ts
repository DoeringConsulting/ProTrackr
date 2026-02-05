import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

describe("Authentication System", () => {
  let testUserId: number;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";

  beforeAll(async () => {
    // Clean up any existing test user
    const db = await getDb();
    if (db) {
      await db.delete(users).where(eq(users.email, testEmail));
    }
  });

  afterAll(async () => {
    // Clean up test user
    const db = await getDb();
    if (db && testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should create a user with hashed password", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const passwordHash = await bcrypt.hash(testPassword, 12);

    const [result] = await db
      .insert(users)
      .values({
        email: testEmail,
        passwordHash,
        name: "Test User",
        loginMethod: "local",
        emailVerified: 0,
      })
      .$returningId();

    expect(result.id).toBeDefined();
    testUserId = result.id;

    // Verify user was created
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.email).toBe(testEmail);
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe(testPassword); // Should be hashed
  });

  it("should verify password correctly", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.passwordHash).toBeDefined();

    // Verify correct password
    const isValid = await bcrypt.compare(testPassword, user.passwordHash!);
    expect(isValid).toBe(true);

    // Verify incorrect password
    const isInvalid = await bcrypt.compare("WrongPassword", user.passwordHash!);
    expect(isInvalid).toBe(false);
  });

  it("should enforce unique email constraint", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const passwordHash = await bcrypt.hash("AnotherPassword123!", 12);

    // Try to insert user with same email
    try {
      await db.insert(users).values({
        email: testEmail,
        passwordHash,
        name: "Duplicate User",
        loginMethod: "local",
        emailVerified: 0,
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should throw duplicate key error
      expect(error.message).toContain("Duplicate");
    }
  });

  it("should allow password reset token", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const resetToken = "test-reset-token-" + Date.now();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Set reset token
    await db
      .update(users)
      .set({
        resetToken,
        resetTokenExpiry,
      })
      .where(eq(users.id, testUserId));

    // Verify token was set
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(user.resetToken).toBe(resetToken);
    expect(user.resetTokenExpiry).toBeDefined();

    // Clear reset token
    await db
      .update(users)
      .set({
        resetToken: null,
        resetTokenExpiry: null,
      })
      .where(eq(users.id, testUserId));

    // Verify token was cleared
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(updatedUser.resetToken).toBeNull();
    expect(updatedUser.resetTokenExpiry).toBeNull();
  });

  it("should allow email verification status", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    // Verify email
    await db
      .update(users)
      .set({
        emailVerified: 1,
      })
      .where(eq(users.id, testUserId));

    // Verify status was updated
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(user.emailVerified).toBe(1);
  });

  it("should allow optional openId for Passport.js users", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    // User should exist without openId
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.openId).toBeNull();
  });
});
