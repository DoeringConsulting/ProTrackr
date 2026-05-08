import { describe, expect, it } from "vitest";
import {
  calculateProvisionCents,
  getCustomerVisibleAmount,
  getCustomerVisibleRate,
  provisionConfigFromCustomer,
  type ProvisionConfig,
  type ProvisionEntryContext,
} from "../client/src/lib/provision";

const baseCfg: ProvisionConfig = {
  enabled: true,
  mode: "deduction",
  type: "percentage",
  valueBp: 0,
  valueCents: 0,
  unit: "day",
  userRate: 0,
  userRateRemote: 0,
};

const baseEntry: ProvisionEntryContext = {
  entryType: "onsite",
  hoursMinutes: 480, // 8h
  manDays: 1.0,
  rate: 100000, // 1.000,00 EUR/Tag in Cents
};

describe("calculateProvisionCents — disabled / edge cases", () => {
  it("returns 0 when provision is disabled", () => {
    expect(
      calculateProvisionCents({ ...baseCfg, enabled: false, type: "percentage", valueBp: 1000 }, baseEntry)
    ).toBe(0);
  });

  it("returns 0 when manDays is zero", () => {
    expect(
      calculateProvisionCents({ ...baseCfg, type: "percentage", valueBp: 1000 }, { ...baseEntry, manDays: 0 })
    ).toBe(0);
  });

  it("returns 0 when rate is zero", () => {
    expect(
      calculateProvisionCents({ ...baseCfg, type: "percentage", valueBp: 1000 }, { ...baseEntry, rate: 0 })
    ).toBe(0);
  });
});

describe("calculateProvisionCents — type=percentage", () => {
  it("deduction-mode: 10% of 1.000€/day × 1 day = 100€", () => {
    const result = calculateProvisionCents(
      { ...baseCfg, mode: "deduction", type: "percentage", valueBp: 1000 },
      baseEntry
    );
    expect(result).toBe(10000); // 100,00 EUR
  });

  it("surcharge-mode: 10% of 1.000€/day × 1 day = 100€ (same magnitude)", () => {
    const result = calculateProvisionCents(
      { ...baseCfg, mode: "surcharge", type: "percentage", valueBp: 1000 },
      baseEntry
    );
    expect(result).toBe(10000);
  });

  it("scales with manDays — 12.5% × 2.5 days × 800€/day", () => {
    const result = calculateProvisionCents(
      { ...baseCfg, type: "percentage", valueBp: 1250 },
      { ...baseEntry, manDays: 2.5, rate: 80000 }
    );
    // 80000 * 1250 / 10000 = 10000 cents/day; * 2.5 = 25000 cents
    expect(result).toBe(25000);
  });
});

describe("calculateProvisionCents — type=fixed", () => {
  it("unit=day: 100€/day × 1 day = 100€", () => {
    const result = calculateProvisionCents(
      { ...baseCfg, type: "fixed", valueCents: 10000, unit: "day" },
      baseEntry
    );
    expect(result).toBe(10000);
  });

  it("unit=day: 50€/day × 3 days = 150€", () => {
    const result = calculateProvisionCents(
      { ...baseCfg, type: "fixed", valueCents: 5000, unit: "day" },
      { ...baseEntry, manDays: 3 }
    );
    expect(result).toBe(15000);
  });

  it("unit=hour: 12,50€/hour × 8h = 100€", () => {
    const result = calculateProvisionCents(
      { ...baseCfg, type: "fixed", valueCents: 1250, unit: "hour" },
      { ...baseEntry, hoursMinutes: 480 }
    );
    expect(result).toBe(10000);
  });

  it("unit=hour: 10€/hour × 6h 30m = 65€", () => {
    const result = calculateProvisionCents(
      { ...baseCfg, type: "fixed", valueCents: 1000, unit: "hour" },
      { ...baseEntry, hoursMinutes: 390 } // 6h 30m
    );
    expect(result).toBe(6500);
  });
});

describe("calculateProvisionCents — type=two_rate", () => {
  it("deduction: customer brutto 1.100, user netto 1.000 → 100/day × 1 = 100", () => {
    const result = calculateProvisionCents(
      {
        ...baseCfg,
        mode: "deduction",
        type: "two_rate",
        userRate: 100000,
        userRateRemote: 100000,
      },
      { ...baseEntry, rate: 110000 }
    );
    expect(result).toBe(10000);
  });

  it("surcharge: user netto 1.000, customer brutto 1.100 → 100/day × 1 = 100", () => {
    const result = calculateProvisionCents(
      {
        ...baseCfg,
        mode: "surcharge",
        type: "two_rate",
        userRate: 110000, // brutto, oben drauf
        userRateRemote: 110000,
      },
      { ...baseEntry, rate: 100000 }
    );
    expect(result).toBe(10000);
  });

  it("uses remote-userRate for remote entries", () => {
    const result = calculateProvisionCents(
      {
        ...baseCfg,
        mode: "deduction",
        type: "two_rate",
        userRate: 99999, // sollte ignoriert werden für remote
        userRateRemote: 80000,
      },
      { ...baseEntry, entryType: "remote", rate: 90000 }
    );
    expect(result).toBe(10000); // (90000 - 80000) * 1
  });

  it("clamps negative delta to 0 (misconfigured input)", () => {
    const result = calculateProvisionCents(
      {
        ...baseCfg,
        mode: "deduction",
        type: "two_rate",
        userRate: 200000, // höher als rate → wäre negativ
        userRateRemote: 200000,
      },
      { ...baseEntry, rate: 100000 }
    );
    expect(result).toBe(0);
  });
});

describe("getCustomerVisibleRate / getCustomerVisibleAmount — customer-facing values", () => {
  it("disabled provision: visible rate equals stored rate", () => {
    const cfg = { ...baseCfg, enabled: false };
    expect(getCustomerVisibleRate(cfg, "onsite", 100000)).toBe(100000);
    expect(getCustomerVisibleAmount(cfg, "onsite", 100000, 2, 200000)).toBe(200000);
  });

  it("deduction-mode: visible rate equals stored rate (customer already sees brutto)", () => {
    const cfg = { ...baseCfg, mode: "deduction" as const, type: "percentage" as const, valueBp: 1000 };
    expect(getCustomerVisibleRate(cfg, "onsite", 110000)).toBe(110000);
    expect(getCustomerVisibleAmount(cfg, "onsite", 110000, 2, 220000)).toBe(220000);
  });

  it("surcharge percentage: visible rate = stored × (1 + bp/10000)", () => {
    const cfg = { ...baseCfg, mode: "surcharge" as const, type: "percentage" as const, valueBp: 1000 };
    // 100.000 → 110.000 (User-Netto + 10% Aufschlag)
    expect(getCustomerVisibleRate(cfg, "onsite", 100000)).toBe(110000);
    // amount: visibleRate * manDays
    expect(getCustomerVisibleAmount(cfg, "onsite", 100000, 1, 100000)).toBe(110000);
  });

  it("surcharge fixed unit=day: visible rate = stored + valueCents", () => {
    const cfg = { ...baseCfg, mode: "surcharge" as const, type: "fixed" as const, valueCents: 10000, unit: "day" as const };
    expect(getCustomerVisibleRate(cfg, "onsite", 100000)).toBe(110000);
  });

  it("surcharge two_rate: visible rate = userRate field (which stores customer-brutto in surcharge mode)", () => {
    const cfg = { ...baseCfg, mode: "surcharge" as const, type: "two_rate" as const, userRate: 110000, userRateRemote: 100000 };
    expect(getCustomerVisibleRate(cfg, "onsite", 100000)).toBe(110000);
    expect(getCustomerVisibleRate(cfg, "remote", 90000)).toBe(100000);
  });
});

describe("provisionConfigFromCustomer — adapter", () => {
  it("maps a raw customer row with all fields set", () => {
    const cfg = provisionConfigFromCustomer({
      provisionEnabled: 1,
      provisionMode: "surcharge",
      provisionType: "fixed",
      provisionValueBp: 0,
      provisionValueCents: 12345,
      provisionUnit: "hour",
      provisionUserRate: 50000,
      provisionUserRateRemote: 60000,
    });
    expect(cfg).toEqual({
      enabled: true,
      mode: "surcharge",
      type: "fixed",
      valueBp: 0,
      valueCents: 12345,
      unit: "hour",
      userRate: 50000,
      userRateRemote: 60000,
    });
  });

  it("maps a customer row with all fields missing (defaults to disabled)", () => {
    const cfg = provisionConfigFromCustomer({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe("deduction");
    expect(cfg.type).toBe("percentage");
    expect(cfg.valueBp).toBe(0);
  });

  it("treats provisionEnabled=0 as disabled", () => {
    const cfg = provisionConfigFromCustomer({ provisionEnabled: 0 });
    expect(cfg.enabled).toBe(false);
  });
});
