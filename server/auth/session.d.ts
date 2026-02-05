import "express-session";

declare module "express-session" {
  interface SessionData {
    passport?: {
      user?: number;
    };
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string | null;
      name: string | null;
      role: "user" | "admin";
      emailVerified: number;
    }
  }
}
