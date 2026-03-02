import { describe, expect, it } from "vitest";
import {
  calculateAccountingUiData,
  calculateDashboardCostBreakdown,
  calculateMonthlyRevenueSeries,
} from "../client/src/lib/uiCalculations";

describe("UI-Validierung: Reports und Dashboard", () => {
  const customers = [
    { id: 1, costModel: "exclusive" },
    { id: 2, costModel: "inclusive" },
  ];

  const timeEntriesForJanuary = [
    { id: 101, customerId: 1, calculatedAmount: 100_000, date: "2026-01-05" },
    { id: 102, customerId: 2, calculatedAmount: 50_000, date: "2026-01-10" },
  ];

  const expensesForJanuary = [
    { timeEntryId: 101, amount: 10_000 }, // exclusive -> billable
    { timeEntryId: 102, amount: 20_000 }, // inclusive -> not billable in gross
  ];

  const fixedCosts = [{ amount: 40_000 }];

  const taxProfile = {
    taxForm: "liniowy_19" as const,
    zusRegime: "pelny_zus" as const,
    choroboweEnabled: true,
    fpFsEnabled: true,
    wypadkowaRateBp: 167,
    zdrowotnaRateLiniowyBp: 490,
    pitRateBp: 1900,
  };

  const taxConfig = {
    year: 2026,
    socialMinBaseCents: 565_200,
    zdrowotnaMinBaseCents: 565_200,
    zdrowotnaMinAmountCents: 27_695,
    zdrowotnaDeductionLimitYearlyCents: 129_000,
    socialContributionRateBp: 1952,
    choroboweRateBp: 245,
    fpFsRateBp: 245,
  };

  it("Reports: zeigt Sollwerte 1:1 fuer Brutto, ZUS, Zdrowotna, Steuerbasis, Steuer, Netto", () => {
    const accounting = calculateAccountingUiData({
      customers,
      timeEntries: timeEntriesForJanuary,
      expenses: expensesForJanuary,
      fixedCosts,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      taxProfile,
      taxConfig,
      legacySettings: null,
    });

    // Baseline/UI-Sollwerte
    expect(accounting.timeRevenue).toBe(150_000);
    expect(accounting.travelRevenueInGross).toBe(10_000); // only exclusive travel
    expect(accounting.grossRevenue).toBe(160_000);
    expect(accounting.totalFixedCosts).toBe(40_000);
    expect(accounting.variableCosts).toBe(30_000);

    expect(accounting.zus).toBe(147_461);
    expect(accounting.healthInsurance).toBe(27_695);
    expect(accounting.deductibleHealth).toBe(10_750);
    expect(accounting.taxBase).toBe(0);
    expect(accounting.tax).toBe(0);
    expect(accounting.netProfit).toBe(-85_156);
    expect(accounting.calculationSource).toBe("regime_config");
  });

  it("Dashboard: Kostenverteilung zeigt exakt die erwarteten Werte", () => {
    const timeEntriesForChart = [
      ...timeEntriesForJanuary,
      { id: 103, customerId: 1, calculatedAmount: 20_000, date: "2026-02-02" },
    ];

    const breakdown = calculateDashboardCostBreakdown({
      timeEntries: timeEntriesForChart,
      expenses: expensesForJanuary,
      fixedCosts,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      taxProfile,
      taxConfig,
      legacySettings: null,
      referenceDate: new Date("2026-01-15T00:00:00Z"),
    });

    // January only
    expect(breakdown.thisMonthRevenue).toBe(150_000);
    expect(breakdown.items).toEqual([
      { name: "Fixkosten", value: 400, color: "#3b82f6" },
      { name: "Reisekosten", value: 300, color: "#0ea5e9" },
      { name: "ZUS", value: 1475, color: "#8b5cf6" },
      { name: "Krankenvers.", value: 277, color: "#ec4899" },
      { name: "Steuer", value: 0, color: "#f59e0b" },
    ]);
  });

  it("Dashboard: Umsatzentwicklung zeigt Vormonate (inkl. Februar) korrekt an", () => {
    const series = calculateMonthlyRevenueSeries({
      referenceDate: new Date("2026-03-15T12:00:00Z"),
      monthsBack: 6,
      timeEntries: [
        { id: 201, customerId: 1, calculatedAmount: 90_000, date: "2026-02-11" },
        { id: 202, customerId: 1, calculatedAmount: 30_000, date: "2026-02-28T23:30:00.000Z" },
        { id: 203, customerId: 1, calculatedAmount: 120_000, date: "2026-03-02" },
      ],
    });

    const february = series.find((point) => point.yearMonth === "2026-02");
    const march = series.find((point) => point.yearMonth === "2026-03");

    expect(february?.umsatz).toBe(1200); // 120000 cents => 1200 EUR
    expect(march?.umsatz).toBe(1200); // 120000 cents => 1200 EUR
  });

  it("Reports: faellt ohne Profil/Config sauber auf Legacy-Werte zurueck", () => {
    const accounting = calculateAccountingUiData({
      customers,
      timeEntries: timeEntriesForJanuary,
      expenses: expensesForJanuary,
      fixedCosts,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      taxProfile: null,
      taxConfig: null,
      legacySettings: {
        zusType: "fixed",
        zusValue: 50_000,
        healthInsuranceType: "fixed",
        healthInsuranceValue: 20_000,
        taxType: "percentage",
        taxValue: 1900,
      },
    });

    expect(accounting.calculationSource).toBe("legacy");
    expect(accounting.taxBase).toBe(40_000);
    expect(accounting.tax).toBe(7_600);
    expect(accounting.netProfit).toBe(12_400);
  });
});

