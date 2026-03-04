import { describe, expect, it } from "vitest";
import { calculatePolishTaxResult } from "../client/src/lib/taxEnginePl";

describe("taxEnginePl", () => {
  const baseProfile = {
    taxCalculationMode: "normal" as const,
    taxForm: "liniowy_19" as const,
    zusRegime: "pelny_zus" as const,
    choroboweEnabled: true,
    fpFsEnabled: true,
    wypadkowaRateBp: 167,
    zdrowotnaRateLiniowyBp: 490,
    pitRateBp: 1900,
  };

  const baseConfig = {
    year: 2026,
    socialMinBaseCents: 565200,
    zdrowotnaMinBaseCents: 565200,
    zdrowotnaMinAmountCents: 27695,
    zdrowotnaDeductionLimitYearlyCents: 129000,
    socialContributionRateBp: 1952,
    choroboweRateBp: 245,
    fpFsRateBp: 245,
  };

  it("berechnet pelny_zus mit Regime + Jahreswerten korrekt", () => {
    const result = calculatePolishTaxResult({
      revenueCents: 2_000_000,
      fixedCostsCents: 300_000,
      variableCostsCents: 100_000,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      profile: baseProfile,
      config: baseConfig,
    });

    expect(result.source).toBe("regime_config");
    expect(result.zus).toBe(147461);
    expect(result.healthInsurance).toBe(71174);
    expect(result.deductibleHealth).toBe(10750);
    expect(result.taxBase).toBe(1441789);
    expect(result.tax).toBe(273940);
    expect(result.netProfit).toBe(1107425);
  });

  it("erzwingt Mindest-zdrowotna und respektiert ulga_na_start", () => {
    const result = calculatePolishTaxResult({
      revenueCents: 200_000,
      fixedCostsCents: 50_000,
      variableCostsCents: 20_000,
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      profile: {
        ...baseProfile,
        zusRegime: "ulga_na_start",
        choroboweEnabled: false,
        fpFsEnabled: false,
      },
      config: {
        ...baseConfig,
        zdrowotnaDeductionLimitYearlyCents: 0,
      },
    });

    expect(result.zus).toBe(0);
    expect(result.healthInsurance).toBe(27695);
    expect(result.deductibleHealth).toBe(0);
    expect(result.taxBase).toBe(130000);
    expect(result.tax).toBe(24700);
    expect(result.netProfit).toBe(77605);
  });

  it("berechnet Jahreslimit fuer zdrowotna anteilig ueber den Zeitraum", () => {
    const result = calculatePolishTaxResult({
      revenueCents: 6_000_000,
      fixedCostsCents: 1_000_000,
      variableCostsCents: 500_000,
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      profile: {
        ...baseProfile,
        choroboweEnabled: false,
        fpFsEnabled: false,
      },
      config: {
        ...baseConfig,
        zdrowotnaDeductionLimitYearlyCents: 1_200_000,
      },
    });

    expect(result.zus).toBe(119766);
    expect(result.healthInsurance).toBe(214631);
    expect(result.deductibleHealth).toBe(214631);
    expect(result.taxBase).toBe(4165603);
    expect(result.tax).toBe(791465);
    expect(result.netProfit).toBe(3374138);
  });

  it("faellt auf Legacy-Berechnung zurueck, wenn Profil/Config fehlen", () => {
    const result = calculatePolishTaxResult({
      revenueCents: 1_000_000,
      fixedCostsCents: 200_000,
      variableCostsCents: 50_000,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      legacySettings: {
        zusType: "fixed",
        zusValue: 120_000,
        healthInsuranceType: "percentage",
        healthInsuranceValue: 900,
        taxType: "fixed",
        taxValue: 50_000,
      },
    });

    expect(result.source).toBe("legacy");
    expect(result.zus).toBe(120000);
    expect(result.healthInsurance).toBe(90000);
    expect(result.deductibleHealth).toBe(0);
    expect(result.taxBase).toBe(630000);
    expect(result.tax).toBe(50000);
    expect(result.netProfit).toBe(490000);
  });

  it("setzt Steuer-/ZUS-Werte auf 0 im ZERO-Modus", () => {
    const result = calculatePolishTaxResult({
      revenueCents: 1_000_000,
      fixedCostsCents: 200_000,
      variableCostsCents: 50_000,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      profile: {
        ...baseProfile,
        taxCalculationMode: "zero",
      },
      config: baseConfig,
    });

    expect(result.source).toBe("regime_config");
    expect(result.zus).toBe(0);
    expect(result.healthInsurance).toBe(0);
    expect(result.deductibleHealth).toBe(0);
    expect(result.taxBase).toBe(750000);
    expect(result.tax).toBe(0);
    expect(result.netProfit).toBe(750000);
  });

  it("clamped Monatslogik: invertierter Zeitraum wird als 1 Monat behandelt", () => {
    const result = calculatePolishTaxResult({
      revenueCents: 1_000_000,
      fixedCostsCents: 200_000,
      variableCostsCents: 100_000,
      startDate: "2026-12-01",
      endDate: "2026-10-31",
      profile: baseProfile,
      config: {
        ...baseConfig,
        zdrowotnaDeductionLimitYearlyCents: 120_000,
      },
    });

    // 120_000 yearly -> 10_000 fuer 1 Monat (Clamp)
    expect(result.deductibleHealth).toBe(10000);
  });
});

