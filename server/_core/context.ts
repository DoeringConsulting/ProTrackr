import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export type TrpcRole = "user" | "admin" | "mandant_admin" | "webapp_admin";

export type TrpcUser = {
  id: number;
  mandantId: number | null;
  email: string;
  displayName: string | null;
  role: TrpcRole;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: TrpcUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Passport setzt req.user nach erfolgreicher Authentifizierung
  const user = opts.req.user as TrpcUser | undefined;
  return {
    req: opts.req,
    res: opts.res,
    user: user ?? null,
  };
}
