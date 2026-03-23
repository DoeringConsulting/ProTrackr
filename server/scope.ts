import type { TrpcUser } from "./_core/context";
import { isMandantAdmin, isWebAppAdmin } from "./_core/trpc";

export type ScopeRole = "user" | "mandant_admin" | "webapp_admin";

export type ScopeContext = {
  userId: number;
  mandantId: number | null;
  role: ScopeRole;
};

export function toScopeContext(user: TrpcUser): ScopeContext {
  if (isWebAppAdmin(user)) {
    return {
      userId: user.id,
      mandantId: user.mandantId ?? null,
      role: "webapp_admin",
    };
  }
  if (isMandantAdmin(user)) {
    return {
      userId: user.id,
      mandantId: user.mandantId ?? null,
      role: "mandant_admin",
    };
  }
  return {
    userId: user.id,
    mandantId: user.mandantId ?? null,
    role: "user",
  };
}
