import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-expenses",
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

describe("expenses", () => {
  it("should create an expense", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a customer and time entry
    const randomId = Math.floor(Math.random() * 1000000);
    await caller.customers.create({
      provider: "Test Provider",
      mandatenNr: `EXP${randomId}`,
      projectName: "Test Project",
      location: "Test Location",
      onsiteRate: 100000,
      remoteRate: 90000,
      kmRate: 60,
      mealRate: 2400,
      costModel: "exclusive",
    });

    const customers = await caller.customers.list();
    const customer = customers.find(c => c.mandatenNr === `EXP${randomId}`);
    
    if (!customer) {
      throw new Error("Customer not found");
    }

    const timeEntry = await caller.timeEntries.create({
      customerId: customer.id,
      date: "2026-01-20",
      weekday: "Mo/Pn",
      projectName: "Test Project",
      entryType: "onsite",
      hours: 480,
      rate: 100000,
      calculatedAmount: 100000,
      manDays: 1000,
      description: "Test work",
    });

    // Create expense
    const expense = await caller.expenses.create({
      timeEntryId: timeEntry.id,
      category: "car",
      distance: 100,
      rate: 60,
      amount: 6000, // 100 km * 0.60 EUR = 60 EUR = 6000 cents
      comment: "Trip to customer",
    });

    expect(expense).toBeDefined();
  });

  it("should list expenses by time entry", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create customer and time entry first
    const randomId = Math.floor(Math.random() * 1000000);
    await caller.customers.create({
      provider: "Test Provider",
      mandatenNr: `EXP2${randomId}`,
      projectName: "Test Project 2",
      location: "Test Location",
      onsiteRate: 100000,
      remoteRate: 90000,
      kmRate: 60,
      mealRate: 2400,
      costModel: "exclusive",
    });

    const customers = await caller.customers.list();
    const customer = customers.find(c => c.mandatenNr === `EXP2${randomId}`);
    
    if (!customer) {
      throw new Error("Customer not found");
    }

    const timeEntry = await caller.timeEntries.create({
      customerId: customer.id,
      date: "2026-01-21",
      weekday: "Di/Wt",
      projectName: "Test Project 2",
      entryType: "onsite",
      hours: 480,
      rate: 100000,
      calculatedAmount: 100000,
      manDays: 1000,
    });

    // Create expense
    await caller.expenses.create({
      timeEntryId: timeEntry.id,
      category: "hotel",
      date: "2026-01-21",
      checkInDate: "2026-01-21",
      checkOutDate: "2026-01-22",
      amount: 12000, // 120 EUR
      comment: "Hotel stay",
    });

    // List expenses
    const expenses = await caller.expenses.listByTimeEntry({ timeEntryId: timeEntry.id });

    expect(Array.isArray(expenses)).toBe(true);
    expect(expenses.length).toBeGreaterThan(0);
    expect(expenses[0]?.category).toBe("hotel");
    expect(expenses[0]?.amount).toBe(12000);
  });

  it("should reject international flights without mandatory times", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.expenses.create({
        category: "flight",
        date: "2026-02-11",
        amount: 34500,
        currency: "EUR",
        flightRouteType: "international",
      })
    ).rejects.toThrow(
      "Bei internationalen Fluegen sind Abflugzeit und Ankunftszeit verpflichtend"
    );
  });

  it("should allow one-way international flight with required times", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.expenses.create({
      category: "flight",
      date: "2026-02-12",
      amount: 35500,
      currency: "EUR",
      flightRouteType: "international",
      departureTime: "08:20",
      arrivalTime: "11:05",
    });

    expect(result).toBeDefined();
  });
});
