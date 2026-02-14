import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { findUserByEmail, findUserById } from "../db";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);
        if (!user || !user.passwordHash) {
          return done(null, false, { message: "Ungültige E-Mail oder Passwort" });
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Ungültige E-Mail oder Passwort" });
        }
        return done(null, {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        });
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await findUserById(id);
    if (!user) return done(null, false);
    done(null, {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (err) {
    done(err);
  }
});

export default passport;
