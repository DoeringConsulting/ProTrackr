import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("taxSettings", () => {
  it("should upsert and retrieve tax settings", async () => {
    const caller = appRouter.createCaller({
      user: { id: 999, name: "Test User", email: "test@example.com", role: "admin" },
      req: {} as any,
      res: {} as any,
    });

    // Upsert tax settings
    const upserted = await caller.taxSettings.upsert({
      zusType: "percentage",
      zusValue: 1952, // 19.52%
      healthInsuranceType: "percentage",
      healthInsuranceValue: 900, // 9%
      taxType: "percentage",
      taxValue: 1900, // 19%
    });

    expect(upserted).toBeDefined();
    expect(upserted?.zusType).toBe("percentage");
    expect(upserted?.zusValue).toBe(1952);

    // Retrieve tax settings
    const retrieved = await caller.taxSettings.get();
    expect(retrieved).toBeDefined();
    expect(retrieved?.zusType).toBe("percentage");
    expect(retrieved?.zusValue).toBe(1952);
    expect(retrieved?.healthInsuranceType).toBe("percentage");
    expect(retrieved?.healthInsuranceValue).toBe(900);
    expect(retrieved?.taxType).toBe("percentage");
    expect(retrieved?.taxValue).toBe(1900);
  });

  it("should update existing tax settings", async () => {
    const caller = appRouter.createCaller({
      user: { id: 999, name: "Test User", email: "test@example.com", role: "admin" },
      req: {} as any,
      res: {} as any,
    });

    // First upsert
    await caller.taxSettings.upsert({
      zusType: "percentage",
      zusValue: 1952,
      healthInsuranceType: "percentage",
      healthInsuranceValue: 900,
      taxType: "percentage",
      taxValue: 1900,
    });

    // Update with fixed values
    const updated = await caller.taxSettings.upsert({
      zusType: "fixed",
      zusValue: 150000, // 1500 PLN
      healthInsuranceType: "fixed",
      healthInsuranceValue: 80000, // 800 PLN
      taxType: "fixed",
      taxValue: 200000, // 2000 PLN
    });

    expect(updated).toBeDefined();
    expect(updated?.zusType).toBe("fixed");
    expect(updated?.zusValue).toBe(150000);
    expect(updated?.healthInsuranceType).toBe("fixed");
    expect(updated?.healthInsuranceValue).toBe(80000);
    expect(updated?.taxType).toBe("fixed");
    expect(updated?.taxValue).toBe(200000);
  });
});
