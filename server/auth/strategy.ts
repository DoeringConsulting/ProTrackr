import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { findUserByEmailAndMandant, findUserById } from "../db";
import { findMandantByNr, findMandantByName } from "../db-mandanten";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password", passReqToCallback: true },
    async (req: any, email, password, done) => {
      try {
        const mandantInput = req.body.mandant;
        if (!mandantInput) {
          return done(null, false, { message: "Mandant ist erforderlich" });
        }
        
        // Find mandant by number or name
        let mandant = await findMandantByNr(mandantInput);
        if (!mandant) {
          mandant = await findMandantByName(mandantInput);
        }
        if (!mandant) {
          return done(null, false, { message: "Ungültiger Mandant" });
        }
        
        const user = await findUserByEmailAndMandant(email, mandant.id);
        if (!user) {
          return done(null, false, { message: "Ungültige Anmeldedaten" });
        }
        const accountStatus =
          user.accountStatus === "active" ||
          user.accountStatus === "suspended" ||
          user.accountStatus === "deleted"
            ? user.accountStatus
            : user.passwordHash
              ? "active"
              : "suspended";
        if (accountStatus === "suspended") {
          return done(null, false, { message: "Konto ist gesperrt. Bitte Administrator kontaktieren." });
        }
        if (accountStatus === "deleted") {
          return done(null, false, { message: "Konto ist geloescht. Bitte Administrator kontaktieren." });
        }
        if (!user.passwordHash) {
          return done(null, false, { message: "Ungültige Anmeldedaten" });
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Ungültige Anmeldedaten" });
        }
        return done(null, {
          id: user.id,
          mandantId: user.mandantId,
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
      mandantId: user.mandantId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (err) {
    done(err);
  }
});

export default passport;
