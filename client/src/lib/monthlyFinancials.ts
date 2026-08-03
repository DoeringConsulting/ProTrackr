// =============================================================================
// client/src/lib/monthlyFinancials.ts
// =============================================================================
// EINE Wahrheitsquelle für die monatlichen Finanz-Beträge, geteilt vom
// Buchhaltungsbericht (Reports.tsx) und dem Dashboard-Umsatzchart. Verhindert die
// Divergenz-Bug-Klasse (zwei getrennte getMonthlyAmounts-Implementierungen, die
// auseinanderlaufen). Einschluss-Regeln identisch zum Buchhaltungsbericht:
//
//   revenue   = Zeitumsatz  +  exklusive Reisekosten (costModel="exclusive")
//   variable  = ALLE Reisekosten/Spesen  +  Provision an Vermittler
//   fixed     = ein Monat Fixkosten
//
// Exklusive Reisekosten zählen in der Steuer-Rechnung sowohl als Umsatz ALS AUCH
// als variable Kosten (Pass-Through → netto null auf die Steuerbasis). Nicht-
// exklusive Reisekosten sind reine Kosten.
//
// Reine Funktionen, parametrisiert über einen Währungs-Konverter, weil Reports
// (Report-Stichtagskurse) und Dashboard (aktuelle Kurse) verschiedene Kursquellen
// nutzen — die EINSCHLUSS-Logik ist geteilt, die Kursbasis bleibt Sache des
// Aufrufers. Kein Datenleck-Thema (Dashboard ist user-internal; Provision/Netto
// dürfen dort).

import {
  getExpenseBillingCustomerId,
  toDateKey,
  type ExpenseAttributionMaps,
} from "./expenseAttribution";
import { calculateProvisionCents, provisionConfigFromCustomer } from "./provision";
import type { MonthlyAmounts } from "./taxEnginePl";

export type MonthlyTimeEntry = {
  date: unknown;
  calculatedAmount: number;
  sourceCurrency: string;
  customerId: number;
  entryType?: string | null;
  hours?: number | null;
  manDays?: number | null;
  rate?: number | null;
};

export type MonthlyExpense = {
  date?: unknown;
  checkInDate?: unknown;
  checkOutDate?: unknown;
  amount: number;
  sourceCurrency: string;
  customerId?: number | string | null;
  timeEntryId?: number | null;
};

/** Nur die Felder, die provisionConfigFromCustomer + die Attribution brauchen. */
export type MonthlyCustomer = {
  costModel?: string | null;
  onsiteRateCurrency?: string | null;
  provisionEnabled?: number | boolean | null;
  provisionMode?: "deduction" | "surcharge" | null;
  provisionType?: "percentage" | "fixed" | "two_rate" | null;
  provisionValueBp?: number | null;
  provisionValueCents?: number | null;
  provisionUnit?: "hour" | "day" | null;
  provisionUserRate?: number | null;
  provisionUserRateRemote?: number | null;
};

/** Konvertiert einen Betrag (cents) aus `sourceCurrency` in die Ziel-Basis (cents). */
export type CentsConverter = (amountCents: number, sourceCurrency: string) => number;

/**
 * Datums-Key-Vergleich (YYYY-MM-DD, Grenzen inklusive). Bewusst String-Vergleich auf
 * lokalen Keys (`toDateKey`), nie über `toISOString` — letzteres liefert UTC und kippt
 * im Fenster 00:00–02:00 Warschau auf den Vortag.
 */
function isInPeriod(value: unknown, periodStart: string, periodEnd: string): boolean {
  const key = toDateKey(value);
  return key !== null && key >= periodStart && key <= periodEnd;
}

/**
 * Leistungsende eines Belegs als lokaler YYYY-MM-DD-Key: `checkOutDate ?? date`.
 *
 * Bewusst über `toDateKey` verkettet statt `??` auf den Rohwerten: leere Strings und
 * unparsebare Werte in `checkOutDate` müssen ebenfalls auf `date` durchfallen — `??`
 * würde nur bei null/undefined greifen und den Beleg sonst still aus allen Zeiträumen
 * werfen.
 */
function expenseServiceEndKey(expense: {
  date?: unknown;
  checkOutDate?: unknown;
}): string | null {
  return toDateKey(expense?.checkOutDate) ?? toDateKey(expense?.date);
}

/**
 * Kanonische Zeitraum-Zuordnung eines (Reisekosten-)Belegs: maßgeblich ist das
 * **Leistungsende** (`checkOutDate ?? date`) — siehe `docs/adr/0002`.
 *
 * WARUM Leistungsende: Ein Beleg wird NIE gesplittet, sondern zählt komplett in dem
 * Monat, in dem die Leistung endet. Bei Hotels ist `date` der Check-in
 * (`TimeTracking.tsx` setzt `payloadBase.date = hotelCheckIn`), bei Hin-/Rückflug auf
 * einem Ticket das Hinflugdatum; beide enden bei einem Aufenthalt über den
 * Monatswechsel erst im Folgemonat — abgerechnet (und verbraucht) wird die Leistung
 * dort. `date` ist damit nur noch der Fallback für Belege OHNE Enddatum (Taxi, Zug,
 * Kraftstoff, Kilometerpauschale …), bei denen Leistung und Beleg auf denselben Tag
 * fallen. Ein Beleg zählt weiterhin in GENAU einem Zeitraum (keine Doppelzählung).
 *
 * EINE Implementierung für alle Verbraucher (K4): Steuerbasis/Dashboard (unten) und der
 * Berichts-Datenfluss in Reports.tsx. Die Regel gilt einheitlich für Kundenabrechnung,
 * Report-Anzeige, Dashboard UND Steuerbasis — eine Zahl überall. Grenzen inklusive,
 * Vergleich auf YYYY-MM-DD-Keys (Europe/Warsaw-sicher, nie toISOString).
 *
 * Nicht zu verwechseln mit dem Kurs-Stichtag (`reportStichtag` in Reports.tsx): der nutzt
 * dasselbe Enddatum, beantwortet aber die andere Frage („welcher Tageskurs"), nicht die
 * Zeitraum-Zuordnung.
 */
export function isExpenseInPeriod(
  expense: { date?: unknown; checkOutDate?: unknown },
  periodStart: string,
  periodEnd: string
): boolean {
  const endKey = expenseServiceEndKey(expense);
  return endKey !== null && endKey >= periodStart && endKey <= periodEnd;
}

/**
 * Ist der abrechnungsrelevante Kunde des Belegs ein exclusive-Kunde? Dann werden die
 * Reisekosten dem Kunden weiterberechnet und zählen als Umsatz (nicht nur Kosten).
 * Attribution = `getExpenseBillingCustomerId` (dieselbe wie Buchhaltungsbericht).
 */
export function isBillableExclusiveTravel(
  expense: MonthlyExpense,
  customersById: ReadonlyMap<number, MonthlyCustomer>,
  attributionMaps: ExpenseAttributionMaps
): boolean {
  const billingCustomerId = getExpenseBillingCustomerId(expense, attributionMaps);
  if (billingCustomerId == null) return false;
  return customersById.get(billingCustomerId)?.costModel === "exclusive";
}

/** Provision (in der `toBasis`-Währung) für einen Time-Entry, sonst 0. */
function provisionForEntry(
  entry: MonthlyTimeEntry,
  customersById: ReadonlyMap<number, MonthlyCustomer>,
  toBasis: CentsConverter
): number {
  const customer = customersById.get(entry.customerId);
  if (!customer) return 0;
  const cfg = provisionConfigFromCustomer(customer);
  if (!cfg.enabled) return 0;
  const provisionCents = calculateProvisionCents(cfg, {
    entryType: (entry.entryType ?? "onsite") as "onsite" | "remote",
    hoursMinutes: Number(entry.hours ?? 0),
    manDays: Number(entry.manDays ?? 0) / 1000, // DB speichert Tausendstel
    rate: Number(entry.rate ?? 0),
  });
  if (provisionCents <= 0) return 0;
  const provCurrency = String(customer.onsiteRateCurrency || "EUR").toUpperCase();
  return toBasis(provisionCents, provCurrency);
}

export interface MonthlyAmountsContext {
  timeEntries: ReadonlyArray<MonthlyTimeEntry>;
  expenses: ReadonlyArray<MonthlyExpense>;
  customersById: ReadonlyMap<number, MonthlyCustomer>;
  attributionMaps: ExpenseAttributionMaps;
  /** Ein Monat Fixkosten, bereits in der Steuer-Basis (PLN cents). */
  monthlyFixedCostsCents: number;
  /** In die Steuer-Basis (PLN) konvertieren. Fehlender Kurs → 0 (Caller zählt Misses). */
  toPln: CentsConverter;
}

/**
 * Monats-Beträge in der Steuer-Basis (PLN cents) — identisch zum Buchhaltungsbericht.
 * Speist sowohl `aggregateMonthlyTaxResults` (Aggregat) als auch
 * `computeMonthlyTaxSeries` (Pro-Monat-Netto fürs Dashboard).
 */
export function computeMonthlyAmounts(
  monthStart: string,
  monthEnd: string,
  ctx: MonthlyAmountsContext
): MonthlyAmounts {
  let revenueCents = 0;
  let variableCostsCents = 0;

  for (const entry of ctx.timeEntries) {
    if (!isInPeriod(entry.date, monthStart, monthEnd)) continue;
    revenueCents += ctx.toPln(entry.calculatedAmount, entry.sourceCurrency);
    variableCostsCents += provisionForEntry(entry, ctx.customersById, ctx.toPln);
  }

  for (const expense of ctx.expenses) {
    if (!isExpenseInPeriod(expense, monthStart, monthEnd)) continue;
    const amountPln = ctx.toPln(expense.amount, expense.sourceCurrency);
    // Jede Reisekostenposition ist eine Betriebsausgabe (mindert die Steuerbasis) …
    variableCostsCents += amountPln;
    // … und wird bei exclusive-Kunden zusätzlich als Umsatz weiterberechnet
    // (Pass-Through: netto null auf die Steuerbasis).
    if (isBillableExclusiveTravel(expense, ctx.customersById, ctx.attributionMaps)) {
      revenueCents += amountPln;
    }
  }

  return {
    revenueCents,
    fixedCostsCents: ctx.monthlyFixedCostsCents,
    variableCostsCents,
  };
}

export interface DisplayRevenueContext {
  timeEntries: ReadonlyArray<MonthlyTimeEntry>;
  expenses: ReadonlyArray<MonthlyExpense>;
  customersById: ReadonlyMap<number, MonthlyCustomer>;
  attributionMaps: ExpenseAttributionMaps;
  /** In die Anzeige-/Zielwährung konvertieren. Fehlender Kurs → 0 (Caller zählt Misses). */
  toTarget: CentsConverter;
}

/**
 * Monats-Umsatz in Anzeige-Währung, aufgeteilt für die Chart-Linien:
 *   time   = reiner Zeitumsatz
 *   travel = exklusive Reisekosten (weiterberechnet)
 *   gross  = time + travel  (= Bruttoumsatz)
 */
export function computeMonthlyDisplayRevenue(
  monthStart: string,
  monthEnd: string,
  ctx: DisplayRevenueContext
): { timeCents: number; travelCents: number; grossCents: number } {
  let timeCents = 0;
  let travelCents = 0;

  for (const entry of ctx.timeEntries) {
    if (!isInPeriod(entry.date, monthStart, monthEnd)) continue;
    timeCents += ctx.toTarget(entry.calculatedAmount, entry.sourceCurrency);
  }
  for (const expense of ctx.expenses) {
    if (!isExpenseInPeriod(expense, monthStart, monthEnd)) continue;
    if (isBillableExclusiveTravel(expense, ctx.customersById, ctx.attributionMaps)) {
      travelCents += ctx.toTarget(expense.amount, expense.sourceCurrency);
    }
  }
  return { timeCents, travelCents, grossCents: timeCents + travelCents };
}
