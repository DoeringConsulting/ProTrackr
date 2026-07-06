type ZusRegime = "ulga_na_start" | "preferencyjny_zus" | "maly_zus_plus" | "pelny_zus";
type TaxCalculationMode = "normal" | "zero";

export type TaxProfilePl = {
  taxCalculationMode?: TaxCalculationMode;
  taxForm: "liniowy_19";
  zusRegime: ZusRegime;
  choroboweEnabled: boolean;
  fpFsEnabled: boolean;
  wypadkowaRateBp: number;
  zdrowotnaRateLiniowyBp: number;
  pitRateBp: number;
};

export type TaxConfigPl = {
  year: number;
  socialMinBaseCents: number;
  zdrowotnaMinBaseCents: number;
  zdrowotnaMinAmountCents: number;
  zdrowotnaDeductionLimitYearlyCents: number;
  socialContributionRateBp: number;
  choroboweRateBp: number;
  fpFsRateBp: number;
};

export type LegacyTaxSettings = {
  zusType: "percentage" | "fixed";
  zusValue: number;
  healthInsuranceType: "percentage" | "fixed";
  healthInsuranceValue: number;
  taxType: "percentage" | "fixed";
  taxValue: number;
};

export type TaxCalculationResult = {
  zus: number;
  healthInsurance: number;
  taxBase: number;
  tax: number;
  netProfit: number;
  deductibleHealth: number;
  source: "regime_config" | "legacy";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getPeriodMonthCount(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const rawMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  return clamp(rawMonths, 1, 12);
}

function getSocialBaseMultiplier(zusRegime: ZusRegime) {
  switch (zusRegime) {
    case "ulga_na_start":
      return 0;
    case "preferencyjny_zus":
      return 0.3;
    case "maly_zus_plus":
      return 0.6;
    case "pelny_zus":
    default:
      return 1;
  }
}

function calculateWithRegimeAndConfig(input: {
  revenueCents: number;
  fixedCostsCents: number;
  variableCostsCents: number;
  startDate: string;
  endDate: string;
  profile: TaxProfilePl;
  config: TaxConfigPl;
}): TaxCalculationResult {
  const { revenueCents, fixedCostsCents, variableCostsCents, startDate, endDate, profile, config } = input;
  const periodMonths = getPeriodMonthCount(startDate, endDate);

  const socialBaseMonthly = Math.round(config.socialMinBaseCents * getSocialBaseMultiplier(profile.zusRegime));
  const effectiveSocialRateBp =
    config.socialContributionRateBp +
    profile.wypadkowaRateBp +
    (profile.choroboweEnabled ? config.choroboweRateBp : 0) +
    (profile.fpFsEnabled ? config.fpFsRateBp : 0);
  const zusMonthly = Math.round((socialBaseMonthly * effectiveSocialRateBp) / 10000);
  const zus = zusMonthly * periodMonths;

  const incomeBeforeHealth = revenueCents - fixedCostsCents - variableCostsCents - zus;
  const zdrowotnaMinBaseForPeriod = config.zdrowotnaMinBaseCents * periodMonths;
  const zdrowotnaBase = Math.max(incomeBeforeHealth, zdrowotnaMinBaseForPeriod);
  const zdrowotnaRaw = Math.round((zdrowotnaBase * profile.zdrowotnaRateLiniowyBp) / 10000);
  const zdrowotnaMinAmountForPeriod = config.zdrowotnaMinAmountCents * periodMonths;
  const healthInsurance = Math.max(zdrowotnaRaw, zdrowotnaMinAmountForPeriod);

  const deductionCapForPeriod = Math.round(
    (config.zdrowotnaDeductionLimitYearlyCents * periodMonths) / 12
  );
  const deductibleHealth = Math.min(healthInsurance, deductionCapForPeriod);

  const taxBase = Math.max(
    0,
    revenueCents - fixedCostsCents - variableCostsCents - zus - deductibleHealth
  );
  const tax = Math.round((taxBase * profile.pitRateBp) / 10000);
  const netProfit = revenueCents - fixedCostsCents - variableCostsCents - zus - healthInsurance - tax;

  return {
    zus,
    healthInsurance,
    taxBase,
    tax,
    netProfit,
    deductibleHealth,
    source: "regime_config",
  };
}

function calculateWithLegacySettings(input: {
  revenueCents: number;
  fixedCostsCents: number;
  variableCostsCents: number;
  startDate: string;
  endDate: string;
  legacySettings?: LegacyTaxSettings | null;
}): TaxCalculationResult {
  const { revenueCents, fixedCostsCents, variableCostsCents, startDate, endDate, legacySettings } = input;
  const periodMonths = getPeriodMonthCount(startDate, endDate);

  const zusRate =
    legacySettings?.zusType === "percentage" ? legacySettings.zusValue / 10000 : 0.1952;
  const zusFixed = legacySettings?.zusType === "fixed" ? legacySettings.zusValue * periodMonths : 0;
  const healthRate =
    legacySettings?.healthInsuranceType === "percentage"
      ? legacySettings.healthInsuranceValue / 10000
      : 0.09;
  const healthFixed = legacySettings?.healthInsuranceType === "fixed" ? legacySettings.healthInsuranceValue * periodMonths : 0;
  const taxRate =
    legacySettings?.taxType === "percentage" ? legacySettings.taxValue / 10000 : 0.19;
  const taxFixed = legacySettings?.taxType === "fixed" ? legacySettings.taxValue * periodMonths : 0;

  const zus = legacySettings?.zusType === "fixed" ? zusFixed : Math.round(revenueCents * zusRate);
  const healthInsurance =
    legacySettings?.healthInsuranceType === "fixed"
      ? healthFixed
      : Math.round(revenueCents * healthRate);
  const taxBase = Math.max(0, revenueCents - fixedCostsCents - variableCostsCents - zus);
  const tax = legacySettings?.taxType === "fixed" ? taxFixed : Math.round(taxBase * taxRate);
  const netProfit = revenueCents - fixedCostsCents - variableCostsCents - zus - healthInsurance - tax;

  return {
    zus,
    healthInsurance,
    taxBase,
    tax,
    netProfit,
    deductibleHealth: 0,
    source: "legacy",
  };
}

export function calculatePolishTaxResult(input: {
  revenueCents: number;
  fixedCostsCents: number;
  variableCostsCents: number;
  startDate: string;
  endDate: string;
  profile?: TaxProfilePl | null;
  config?: TaxConfigPl | null;
  legacySettings?: LegacyTaxSettings | null;
}): TaxCalculationResult {
  const { profile, config } = input;
  const calculationMode = profile?.taxCalculationMode ?? "normal";

  if (calculationMode === "zero") {
    const taxBase = Math.max(0, input.revenueCents - input.fixedCostsCents - input.variableCostsCents);
    return {
      zus: 0,
      healthInsurance: 0,
      taxBase,
      tax: 0,
      netProfit: input.revenueCents - input.fixedCostsCents - input.variableCostsCents,
      deductibleHealth: 0,
      source: profile && config ? "regime_config" : "legacy",
    };
  }

  if (profile && config) {
    return calculateWithRegimeAndConfig({
      revenueCents: input.revenueCents,
      fixedCostsCents: input.fixedCostsCents,
      variableCostsCents: input.variableCostsCents,
      startDate: input.startDate,
      endDate: input.endDate,
      profile,
      config,
    });
  }

  return calculateWithLegacySettings({
    revenueCents: input.revenueCents,
    fixedCostsCents: input.fixedCostsCents,
    variableCostsCents: input.variableCostsCents,
    startDate: input.startDate,
    endDate: input.endDate,
    legacySettings: input.legacySettings,
  });
}

export type MonthlyAmounts = {
  revenueCents: number;
  fixedCostsCents: number;
  variableCostsCents: number;
};

export type MonthlyTaxPoint = {
  monthStart: string;
  monthEnd: string;
  amounts: MonthlyAmounts;
  result: TaxCalculationResult;
};

type MonthlyTaxInput = {
  startDate: string;
  endDate: string;
  getMonthlyAmounts: (monthStart: string, monthEnd: string) => MonthlyAmounts;
  profile?: TaxProfilePl | null;
  config?: TaxConfigPl | null;
  legacySettings?: LegacyTaxSettings | null;
};

/**
 * Per-month tax breakdown: for each calendar month in [startDate, endDate], pull
 * that month's amounts (via getMonthlyAmounts) and run the Polish tax result, so
 * monthly caps/minimums (ZUS, zdrowotna) apply per month. Month boundaries are
 * built as strings (never toISOString) — Europe/Warsaw safe. Returns [] for
 * invalid or inverted ranges. This is the building block for BOTH the aggregate
 * (Buchhaltungsbericht) and the dashboard per-month net-profit series.
 */
export function computeMonthlyTaxSeries(input: MonthlyTaxInput): MonthlyTaxPoint[] {
  const { startDate, endDate, getMonthlyAmounts, profile, config, legacySettings } = input;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const points: MonthlyTaxPoint[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= endMonth) {
    const y = current.getFullYear();
    const m = current.getMonth();
    const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const amounts = getMonthlyAmounts(monthStart, monthEnd);
    const result = calculatePolishTaxResult({
      revenueCents: amounts.revenueCents,
      fixedCostsCents: amounts.fixedCostsCents,
      variableCostsCents: amounts.variableCostsCents,
      startDate: monthStart,
      endDate: monthEnd,
      profile,
      config,
      legacySettings,
    });

    points.push({ monthStart, monthEnd, amounts, result });
    current.setMonth(current.getMonth() + 1);
  }
  return points;
}

/**
 * Aggregate tax results by calculating per month and summing.
 * This gives correct ZUS/health/tax when period spans multiple months,
 * because monthly caps and minimums are applied per month.
 */
export function aggregateMonthlyTaxResults(input: MonthlyTaxInput): TaxCalculationResult {
  const { startDate, endDate, profile, config, legacySettings } = input;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  // Invalid dates keep the historical fallback (single all-zero result, which for
  // a valid profile/config still yields the monthly ZUS/zdrowotna minimum).
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return calculatePolishTaxResult({
      revenueCents: 0, fixedCostsCents: 0, variableCostsCents: 0,
      startDate, endDate, profile, config, legacySettings,
    });
  }

  // Valid dates → sum the per-month series. An inverted range yields an empty
  // series and therefore an all-zero result, exactly as before.
  let totalZus = 0;
  let totalHealth = 0;
  let totalTax = 0;
  let totalTaxBase = 0;
  let totalDeductibleHealth = 0;
  let totalNetProfit = 0;
  let source: "regime_config" | "legacy" = "legacy";

  for (const { result } of computeMonthlyTaxSeries(input)) {
    totalZus += result.zus;
    totalHealth += result.healthInsurance;
    totalTax += result.tax;
    totalTaxBase += result.taxBase;
    totalDeductibleHealth += result.deductibleHealth;
    totalNetProfit += result.netProfit;
    source = result.source;
  }

  return {
    zus: totalZus,
    healthInsurance: totalHealth,
    taxBase: totalTaxBase,
    tax: totalTax,
    netProfit: totalNetProfit,
    deductibleHealth: totalDeductibleHealth,
    source,
  };
}

