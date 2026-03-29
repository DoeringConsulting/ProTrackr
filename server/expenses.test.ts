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
    role: "admin",
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

    // First create a customer and time entry — mandatenNr is auto-assigned
    const customerResult = await caller.customers.create({
      provider: "Test Provider",
      mandatenNr: "ignored",
      projectName: "Test Project",
      location: "Test Location",
      onsiteRate: 100000,
      remoteRate: 90000,
      kmRate: 60,
      mealRate: 2400,
      costModel: "exclusive",
    });

    expect(customerResult?.id).toBeDefined();

    const timeEntry = await caller.timeEntries.create({
      customerId: customerResult!.id,
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

    // Create customer and time entry first — mandatenNr is auto-assigned
    const customer2Result = await caller.customers.create({
      provider: "Test Provider",
      mandatenNr: "ignored",
      projectName: "Test Project 2",
      location: "Test Location",
      onsiteRate: 100000,
      remoteRate: 90000,
      kmRate: 60,
      mealRate: 2400,
      costModel: "exclusive",
    });

    expect(customer2Result?.id).toBeDefined();

    const timeEntry = await caller.timeEntries.create({
      customerId: customer2Result!.id,
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

  it("should reject flights without any time", async () => {
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
      "Bei Fluegen muss mindestens eine Zeit (Abflug oder Ankunft) angegeben werden"
    );
  });

  it("should allow one-way international flight with only departure time", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.expenses.create({
      category: "flight",
      date: "2026-02-12",
      amount: 35500,
      currency: "EUR",
      flightRouteType: "international",
      departureTime: "08:20",
    });

    expect(result).toBeDefined();
  });
});
