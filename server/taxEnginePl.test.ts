import { describe, expect, it } from "vitest";
import {
  aggregateMonthlyTaxResults,
  calculatePolishTaxResult,
  computeMonthlyTaxSeries,
} from "../client/src/lib/taxEnginePl";

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

    expect(result.zus).toBe(359298);
    expect(result.healthInsurance).toBe(202894);
    expect(result.deductibleHealth).toBe(202894);
    expect(result.taxBase).toBe(3937808);
    expect(result.tax).toBe(748184);
    expect(result.netProfit).toBe(3189624);
  });

  it("skaliert fixe Monatskomponenten (ZUS/Minimum zdrowotna) mit Periodenlaenge", () => {
    const oneMonth = calculatePolishTaxResult({
      revenueCents: 0,
      fixedCostsCents: 0,
      variableCostsCents: 0,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      profile: baseProfile,
      config: baseConfig,
    });

    const threeMonths = calculatePolishTaxResult({
      revenueCents: 0,
      fixedCostsCents: 0,
      variableCostsCents: 0,
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      profile: baseProfile,
      config: baseConfig,
    });

    expect(threeMonths.zus).toBe(oneMonth.zus * 3);
    expect(threeMonths.healthInsurance).toBe(oneMonth.healthInsurance * 3);
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

  it("computeMonthlyTaxSeries: Pro-Monat-Punkte; Summe == aggregateMonthlyTaxResults", () => {
    const getMonthlyAmounts = (monthStart: string) => ({
      revenueCents: monthStart.startsWith("2026-01") ? 2_000_000 : 1_000_000,
      fixedCostsCents: 300_000,
      variableCostsCents: 100_000,
    });
    const input = {
      startDate: "2026-01-01",
      endDate: "2026-02-28",
      getMonthlyAmounts,
      profile: baseProfile,
      config: baseConfig,
    };

    const series = computeMonthlyTaxSeries(input);
    expect(series.length).toBe(2);
    expect(series[0].monthStart).toBe("2026-01-01");
    expect(series[0].monthEnd).toBe("2026-01-31");
    expect(series[1].monthStart).toBe("2026-02-01");
    expect(series[1].monthEnd).toBe("2026-02-28");
    expect(series[0].amounts.revenueCents).toBe(2_000_000);
    expect(series[1].amounts.revenueCents).toBe(1_000_000);

    // Das Aggregat ist exakt die Summe der Pro-Monat-Ergebnisse.
    const agg = aggregateMonthlyTaxResults(input);
    expect(agg.netProfit).toBe(series[0].result.netProfit + series[1].result.netProfit);
    expect(agg.zus).toBe(series[0].result.zus + series[1].result.zus);
    expect(agg.tax).toBe(series[0].result.tax + series[1].result.tax);
  });

  it("aggregateMonthlyTaxResults: NaN-Datum → Fallback calculatePolishTaxResult(0), nicht all-zero", () => {
    const getMonthlyAmounts = () => ({ revenueCents: 0, fixedCostsCents: 0, variableCostsCents: 0 });
    const nanInput = { startDate: "not-a-date", endDate: "also-not", getMonthlyAmounts, profile: baseProfile, config: baseConfig };
    const agg = aggregateMonthlyTaxResults(nanInput);
    const expected = calculatePolishTaxResult({
      revenueCents: 0, fixedCostsCents: 0, variableCostsCents: 0,
      startDate: "not-a-date", endDate: "also-not", profile: baseProfile, config: baseConfig,
    });
    expect(agg).toEqual(expected);
    expect(agg.zus).toBeGreaterThan(0); // ZUS-Minimum greift → NICHT all-zero
    expect(computeMonthlyTaxSeries(nanInput)).toEqual([]);
  });

  it("aggregateMonthlyTaxResults: invertierter Zeitraum (start>end) → all-zero, source legacy", () => {
    const getMonthlyAmounts = () => ({ revenueCents: 1_000_000, fixedCostsCents: 0, variableCostsCents: 0 });
    const invInput = { startDate: "2026-06-01", endDate: "2026-03-31", getMonthlyAmounts, profile: baseProfile, config: baseConfig };
    expect(aggregateMonthlyTaxResults(invInput)).toEqual({
      zus: 0, healthInsurance: 0, taxBase: 0, tax: 0, netProfit: 0, deductibleHealth: 0, source: "legacy",
    });
    expect(computeMonthlyTaxSeries(invInput)).toEqual([]);
  });
});

