type ZusRegime = "ulga_na_start" | "preferencyjny_zus" | "maly_zus_plus" | "pelny_zus";

export type TaxProfilePl = {
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

function getPeriodMonthCount(startDate: string, endDate: string) {
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

  const socialBase = Math.round(config.socialMinBaseCents * getSocialBaseMultiplier(profile.zusRegime));
  const effectiveSocialRateBp =
    config.socialContributionRateBp +
    profile.wypadkowaRateBp +
    (profile.choroboweEnabled ? config.choroboweRateBp : 0) +
    (profile.fpFsEnabled ? config.fpFsRateBp : 0);

  const zus = Math.round((socialBase * effectiveSocialRateBp) / 10000);

  const incomeBeforeHealth = revenueCents - fixedCostsCents - variableCostsCents - zus;
  const zdrowotnaBase = Math.max(incomeBeforeHealth, config.zdrowotnaMinBaseCents);
  const zdrowotnaRaw = Math.round((zdrowotnaBase * profile.zdrowotnaRateLiniowyBp) / 10000);
  const healthInsurance = Math.max(zdrowotnaRaw, config.zdrowotnaMinAmountCents);

  const periodMonths = getPeriodMonthCount(startDate, endDate);
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
  legacySettings?: LegacyTaxSettings | null;
}): TaxCalculationResult {
  const { revenueCents, fixedCostsCents, variableCostsCents, legacySettings } = input;

  const zusRate =
    legacySettings?.zusType === "percentage" ? legacySettings.zusValue / 10000 : 0.1952;
  const zusFixed = legacySettings?.zusType === "fixed" ? legacySettings.zusValue : 0;
  const healthRate =
    legacySettings?.healthInsuranceType === "percentage"
      ? legacySettings.healthInsuranceValue / 10000
      : 0.09;
  const healthFixed = legacySettings?.healthInsuranceType === "fixed" ? legacySettings.healthInsuranceValue : 0;
  const taxRate =
    legacySettings?.taxType === "percentage" ? legacySettings.taxValue / 10000 : 0.19;
  const taxFixed = legacySettings?.taxType === "fixed" ? legacySettings.taxValue : 0;

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
    legacySettings: input.legacySettings,
  });
}

