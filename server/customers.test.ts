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

  it("should create a customer with billing address", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const randomId = Math.floor(Math.random() * 1000000);
    const customerData = {
      provider: "Test Provider GmbH",
      mandatenNr: `ADDR${randomId}`,
      projectName: "Address Test Project",
      location: "Berlin",
      onsiteRate: 120000, // 1200.00 EUR in cents
      remoteRate: 100000, // 1000.00 EUR in cents
      kmRate: 65, // 0.65 EUR in cents
      mealRate: 2800, // 28.00 EUR in cents
      costModel: "inclusive" as const,
      street: "Teststraße 42",
      postalCode: "10115",
      city: "Berlin",
      country: "Deutschland",
      vatId: "DE123456789",
    };

    const result = await caller.customers.create(customerData);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("should update customer address fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a customer
    const randomId = Math.floor(Math.random() * 1000000);
    const customer = await caller.customers.create({
      provider: "Update Test Provider",
      mandatenNr: `UPD${randomId}`,
      projectName: "Update Test",
      location: "Warsaw",
      onsiteRate: 100000,
      remoteRate: 90000,
      kmRate: 60,
      mealRate: 2400,
      costModel: "exclusive" as const,
    });

    // Update with address fields
    const updateResult = await caller.customers.update({
      id: customer.id,
      street: "Nowa 123",
      postalCode: "00-001",
      city: "Warszawa",
      country: "Polska",
      vatId: "PL9876543210",
    });

    expect(updateResult.success).toBe(true);

    // Verify the update
    const updated = await caller.customers.getById({ id: customer.id });
    expect(updated?.street).toBe("Nowa 123");
    expect(updated?.postalCode).toBe("00-001");
    expect(updated?.city).toBe("Warszawa");
    expect(updated?.country).toBe("Polska");
    expect(updated?.vatId).toBe("PL9876543210");
  });
});
