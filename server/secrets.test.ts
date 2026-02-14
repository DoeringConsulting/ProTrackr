import { describe, it, expect } from "vitest";

describe("Secrets Validation", () => {
  it("should have SESSION_SECRET set", () => {
    expect(process.env.SESSION_SECRET).toBeDefined();
    expect(process.env.SESSION_SECRET).not.toBe("");
    expect(process.env.SESSION_SECRET!.length).toBeGreaterThanOrEqual(32);
  });

  it("should have SCHEDULER_API_KEY set", () => {
    expect(process.env.SCHEDULER_API_KEY).toBeDefined();
    expect(process.env.SCHEDULER_API_KEY).not.toBe("");
    expect(process.env.SCHEDULER_API_KEY!.length).toBeGreaterThanOrEqual(32);
  });
});
