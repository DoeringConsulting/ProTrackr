import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Passport.js configuration for local authentication
 * Uses email and password for login
 */

// Configure local strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const db = await getDb();
        if (!db) {
          return done(new Error("Datenbankverbindung fehlgeschlagen"));
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Ungültige E-Mail oder Passwort" });
        }

        // Check if user has a password (not OAuth user)
        if (!user.passwordHash) {
          return done(null, false, { message: "Bitte verwenden Sie OAuth zum Anmelden" });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Ungültige E-Mail oder Passwort" });
        }

        // Update last signed in
        await db
          .update(users)
          .set({ lastSignedIn: new Date() })
          .where(eq(users.id, user.id));

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const db = await getDb();
    if (!db) {
      return done(new Error("Datenbankverbindung fehlgeschlagen"));
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
