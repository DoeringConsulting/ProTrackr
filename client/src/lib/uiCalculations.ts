import {
  calculatePolishTaxResult,
  type LegacyTaxSettings,
  type TaxConfigPl,
  type TaxProfilePl,
} from "./taxEnginePl";

type CustomerLike = {
  id: number;
  costModel?: string | null;
};

type TimeEntryLike = {
  id: number;
  customerId: number;
  calculatedAmount: number;
  date: string | Date;
};

type ExpenseLike = {
  amount: number;
  timeEntryId?: number | null;
};

type FixedCostLike = {
  amount: number;
};

export type AccountingUiData = {
  timeRevenue: number;
  travelRevenueInGross: number;
  grossRevenue: number;
  totalFixedCosts: number;
  variableCosts: number;
  zus: number;
  healthInsurance: number;
  taxBase: number;
  tax: number;
  netProfit: number;
  deductibleHealth: number;
  calculationSource: "regime_config" | "legacy";
};

export function calculateAccountingUiData(input: {
  customers: CustomerLike[];
  timeEntries: TimeEntryLike[];
  expenses: ExpenseLike[];
  fixedCosts: FixedCostLike[];
  startDate: string;
  endDate: string;
  taxProfile?: TaxProfilePl | null;
  taxConfig?: TaxConfigPl | null;
  legacySettings?: LegacyTaxSettings | null;
}): AccountingUiData {
  const timeRevenue = input.timeEntries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);
  const totalExpenses = input.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Only travel costs of "exclusive" customers are billable on top.
  const entriesById = new Map(input.timeEntries.map((entry) => [entry.id, entry]));
  const customersById = new Map(input.customers.map((customer) => [customer.id, customer]));
  const travelRevenueInGross = input.expenses.reduce((sum, expense) => {
    if (!expense.timeEntryId) return sum;
    const relatedEntry = entriesById.get(expense.timeEntryId);
    if (!relatedEntry) return sum;
    const relatedCustomer = customersById.get(relatedEntry.customerId);
    return relatedCustomer?.costModel === "exclusive" ? sum + expense.amount : sum;
  }, 0);

  const grossRevenue = timeRevenue + travelRevenueInGross;
  const totalFixedCosts = input.fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const variableCosts = totalExpenses;

  const taxResult = calculatePolishTaxResult({
    revenueCents: grossRevenue,
    fixedCostsCents: totalFixedCosts,
    variableCostsCents: variableCosts,
    startDate: input.startDate,
    endDate: input.endDate,
    profile: input.taxProfile ?? null,
    config: input.taxConfig ?? null,
    legacySettings: input.legacySettings ?? null,
  });

  return {
    timeRevenue,
    travelRevenueInGross,
    grossRevenue,
    totalFixedCosts,
    variableCosts,
    zus: taxResult.zus,
    healthInsurance: taxResult.healthInsurance,
    taxBase: taxResult.taxBase,
    tax: taxResult.tax,
    netProfit: taxResult.netProfit,
    deductibleHealth: taxResult.deductibleHealth,
    calculationSource: taxResult.source,
  };
}

type DashboardCostItem = {
  name: string;
  value: number;
  color: string;
};

export function calculateDashboardCostBreakdown(input: {
  timeEntries: TimeEntryLike[];
  expenses: ExpenseLike[];
  fixedCosts: FixedCostLike[];
  startDate: string;
  endDate: string;
  taxProfile?: TaxProfilePl | null;
  taxConfig?: TaxConfigPl | null;
  legacySettings?: LegacyTaxSettings | null;
  referenceDate?: Date;
}): { items: DashboardCostItem[]; thisMonthRevenue: number } {
  const totalFixed = input.fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const variableCosts = input.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const refDate = input.referenceDate ?? new Date();
  const refMonth = refDate.getMonth();
  const refYear = refDate.getFullYear();
  const thisMonthRevenue = input.timeEntries
    .filter((entry) => {
      const date = new Date(entry.date);
      return date.getMonth() === refMonth && date.getFullYear() === refYear;
    })
    .reduce((sum, entry) => sum + entry.calculatedAmount, 0);

  const taxResult = calculatePolishTaxResult({
    revenueCents: thisMonthRevenue,
    fixedCostsCents: totalFixed,
    variableCostsCents: variableCosts,
    startDate: input.startDate,
    endDate: input.endDate,
    profile: input.taxProfile ?? null,
    config: input.taxConfig ?? null,
    legacySettings: input.legacySettings ?? null,
  });

  return {
    thisMonthRevenue,
    items: [
      { name: "Fixkosten", value: Math.round(totalFixed / 100), color: "#3b82f6" },
      { name: "Reisekosten", value: Math.round(variableCosts / 100), color: "#0ea5e9" },
      { name: "ZUS", value: Math.round(taxResult.zus / 100), color: "#8b5cf6" },
      { name: "Krankenvers.", value: Math.round(taxResult.healthInsurance / 100), color: "#ec4899" },
      { name: "Steuer", value: Math.round(taxResult.tax / 100), color: "#f59e0b" },
    ],
  };
}

