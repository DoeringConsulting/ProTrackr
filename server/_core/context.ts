import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

// ⚠️ AUTHENTICATION COMPLETELY DISABLED FOR DEVELOPMENT
// Re-implement before final release!

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: null; // Always null during development
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: null,
  };
}
