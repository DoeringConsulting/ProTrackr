import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

function isWebAppAdminRole(role?: string | null): boolean {
  return role === "webapp_admin";
}

function isMandantAdminRole(role?: string | null): boolean {
  // Legacy compatibility: existing "admin" is treated as mandant admin.
  return role === "mandant_admin" || role === "admin";
}

function isAnyAdminRole(role?: string | null): boolean {
  return isWebAppAdminRole(role) || isMandantAdminRole(role);
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireRole = (check: (role?: string | null) => boolean) =>
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !check(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });

export const mandantAdminProcedure = t.procedure.use(requireRole(isMandantAdminRole));
export const webAppAdminProcedure = t.procedure.use(requireRole(isWebAppAdminRole));
export const adminProcedure = t.procedure.use(requireRole(isAnyAdminRole));
export const adminOrMandantAdminProcedure = adminProcedure;

export function isWebAppAdmin(user: { role?: string | null } | null | undefined): boolean {
  return isWebAppAdminRole(user?.role);
}

export function isMandantAdmin(user: { role?: string | null } | null | undefined): boolean {
  return isMandantAdminRole(user?.role);
}

export function isAnyAdmin(user: { role?: string | null } | null | undefined): boolean {
  return isAnyAdminRole(user?.role);
}
