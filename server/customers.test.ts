import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("customers", () => {
  it("should create a customer", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const randomId = Math.floor(Math.random() * 1000000);
    const customerData = {
      provider: "Test Provider",
      mandatenNr: `TEST${randomId}`,
      projectName: "Test Project",
      location: "Test Location",
      onsiteRate: 100000, // 1000.00 EUR in cents
      remoteRate: 90000, // 900.00 EUR in cents
      kmRate: 60, // 0.60 EUR in cents
      mealRate: 2400, // 24.00 EUR in cents
      costModel: "exclusive" as const,
    };

    const result = await caller.customers.create(customerData);
    expect(result).toBeDefined();
  });

  it("should list customers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const customers = await caller.customers.list();
    expect(Array.isArray(customers)).toBe(true);
  });
});
