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

describe("timeEntries", () => {
  it("should create a time entry", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a customer
    const randomId = Math.floor(Math.random() * 1000000);
    const customerResult = await caller.customers.create({
      provider: "Test Provider",
      mandatenNr: `TEST${randomId}`,
      projectName: "Test Project",
      location: "Test Location",
      onsiteRate: 100000,
      remoteRate: 90000,
      kmRate: 60,
      mealRate: 2400,
      costModel: "exclusive",
    });

    // Get the customer ID from the result
    const customers = await caller.customers.list();
    const customer = customers.find(c => c.mandatenNr === `TEST${randomId}`);
    
    if (!customer) {
      throw new Error("Customer not found");
    }

    // Create time entry
    const timeEntry = await caller.timeEntries.create({
      customerId: customer.id,
      date: "2026-01-15",
      weekday: "Mi/Śr",
      projectName: "Test Project",
      entryType: "onsite",
      hours: 480, // 8 hours in minutes
      rate: 100000,
      calculatedAmount: 100000,
      manDays: 1000, // 1.000 MT
      description: "Test work",
    });

    expect(timeEntry).toBeDefined();
    expect(timeEntry.hours).toBe(480);
    expect(timeEntry.manDays).toBe(1000);
  });

  it("should list time entries", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const entries = await caller.timeEntries.list({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(Array.isArray(entries)).toBe(true);
  });
});
