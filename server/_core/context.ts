import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export type TrpcUser = {
  id: number;
  email: string;
  displayName: string | null;
  role: string;
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
