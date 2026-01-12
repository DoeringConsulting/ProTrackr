import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-fixedcosts",
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

describe("fixedCosts", () => {
  it("should create a fixed cost", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.fixedCosts.create({
      category: "Auto",
      amount: 50000, // 500 EUR
      description: "Monatliche Autokosten",
    });

    const costs = await caller.fixedCosts.list();
    const autoCost = costs.find(c => c.category === "Auto");

    expect(autoCost).toBeDefined();
    expect(autoCost?.amount).toBe(50000);
    expect(autoCost?.description).toBe("Monatliche Autokosten");
  });

  it("should list fixed costs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create multiple fixed costs
    await caller.fixedCosts.create({
      category: "Telefon",
      amount: 5000, // 50 EUR
    });

    await caller.fixedCosts.create({
      category: "Software",
      amount: 10000, // 100 EUR
      description: "Adobe Creative Cloud",
    });

    const costs = await caller.fixedCosts.list();

    expect(Array.isArray(costs)).toBe(true);
    expect(costs.length).toBeGreaterThanOrEqual(2);
  });

  it("should update a fixed cost", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a fixed cost
    await caller.fixedCosts.create({
      category: "Buchhaltung",
      amount: 15000, // 150 EUR
    });

    const costs = await caller.fixedCosts.list();
    const buchhaltungCost = costs.find(c => c.category === "Buchhaltung");

    if (!buchhaltungCost) {
      throw new Error("Fixed cost not found");
    }

    // Update the cost
    await caller.fixedCosts.update({
      id: buchhaltungCost.id,
      amount: 20000, // 200 EUR
      description: "Steuerberater monatlich",
    });

    const updatedCosts = await caller.fixedCosts.list();
    const updatedCost = updatedCosts.find(c => c.id === buchhaltungCost.id);

    expect(updatedCost?.amount).toBe(20000);
    expect(updatedCost?.description).toBe("Steuerberater monatlich");
  });

  it("should delete a fixed cost", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a fixed cost
    const randomId = Math.floor(Math.random() * 1000000);
    await caller.fixedCosts.create({
      category: `TestCategory${randomId}`,
      amount: 5000,
    });

    const costsBefore = await caller.fixedCosts.list();
    const testCost = costsBefore.find(c => c.category === `TestCategory${randomId}`);

    if (!testCost) {
      throw new Error("Test fixed cost not found");
    }

    // Delete the cost
    await caller.fixedCosts.delete({ id: testCost.id });

    const costsAfter = await caller.fixedCosts.list();
    const deletedCost = costsAfter.find(c => c.id === testCost.id);

    expect(deletedCost).toBeUndefined();
  });
});
