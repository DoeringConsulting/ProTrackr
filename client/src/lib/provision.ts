/**
 * Provision (commission paid to a sales intermediary) calculation helper.
 *
 * Pure function — no DB access, no side effects. Takes a customer's provision
 * configuration and a single time-entry context and returns the provision
 * amount in cents (in the customer's onsiteRate currency).
 *
 * Conceptual model:
 *   - "User-Netto"   = what the user actually keeps, per day/hour.
 *   - "Customer-Brutto" = what the customer actually pays, per day/hour.
 *   - provision = (Customer-Brutto − User-Netto) × manDays
 *
 * Three input types map onto the same model:
 *   percentage:  User-Netto and Customer-Brutto differ by a basis-point share.
 *   fixed:       User-Netto and Customer-Brutto differ by a flat amount.
 *   two_rate:    User and customer rates are stored explicitly.
 *
 * Two modes determine which of the two stored numbers is the customer-facing one:
 *   deduction (default): customer.onsiteRate = Customer-Brutto.
 *   surcharge:           customer.onsiteRate = User-Netto, the surcharge sits on top.
 *
 * Phase 2: not yet wired into the accounting report; phases 4+ will consume this.
 */

export type ProvisionConfig = {
  enabled: boolean;
  mode: "deduction" | "surcharge";
  type: "percentage" | "fixed" | "two_rate";
  /** Basis points, 0..10000. 1000 = 10%. Used when type === "percentage". */
  valueBp: number;
  /** Cents per unit. Used when type === "fixed". */
  valueCents: number;
  /** Whether `valueCents` is per hour or per day. Used when type === "fixed". */
  unit: "hour" | "day";
  /** User-net rate in cents/day for onsite entries. Used when type === "two_rate". */
  userRate: number;
  /** User-net rate in cents/day for remote entries. Used when type === "two_rate". */
  userRateRemote: number;
};

export type ProvisionEntryContext = {
  entryType: "onsite" | "remote";
  /** Worked hours expressed in minutes (matches timeEntries.hours storage). */
  hoursMinutes: number;
  /** Calculated man-days as a fractional number (e.g. 1.25 for 1¼ days). */
  manDays: number;
  /** customer.onsiteRate or customer.remoteRate in cents per day, depending on entryType. */
  rate: number;
};

/**
 * Returns the commission payable for the given entry, in cents
 * (in the same currency as customer.onsiteRate).
 *
 * Always returns a non-negative integer; misconfigured two_rate values that
 * would yield a negative delta are clamped to 0 (defensive — the form
 * validation in phase 3 prevents this case from reaching here).
 */
export function calculateProvisionCents(
  cfg: ProvisionConfig,
  entry: ProvisionEntryContext
): number {
  if (!cfg.enabled) return 0;
  if (entry.manDays <= 0 || entry.rate <= 0) return 0;

  switch (cfg.type) {
    case "percentage": {
      // The percentage-based delta per day is rate*bp/10000 — identical for
      // deduction and surcharge in absolute cents, only "what does customer.onsiteRate
      // mean" differs (deduction: includes provision; surcharge: excludes it).
      const provisionPerDay = (entry.rate * cfg.valueBp) / 10000;
      return Math.round(provisionPerDay * entry.manDays);
    }

    case "fixed": {
      if (cfg.unit === "day") {
        return Math.round(cfg.valueCents * entry.manDays);
      }
      // unit === "hour": hoursMinutes is in minutes, convert to hours.
      const hours = entry.hoursMinutes / 60;
      return Math.round(cfg.valueCents * hours);
    }

    case "two_rate": {
      const userRateForType =
        entry.entryType === "onsite" ? cfg.userRate : cfg.userRateRemote;
      // deduction: customer.onsiteRate is Customer-Brutto, userRate is User-Netto
      // surcharge: customer.onsiteRate is User-Netto, userRate is Customer-Brutto
      const delta =
        cfg.mode === "deduction"
          ? entry.rate - userRateForType
          : userRateForType - entry.rate;
      const positiveDelta = Math.max(0, delta);
      return Math.round(positiveDelta * entry.manDays);
    }
  }
}

/**
 * Convenience adapter — turns a raw `customers` row (as returned by drizzle)
 * into the strongly-typed `ProvisionConfig` for `calculateProvisionCents`.
 */
export function provisionConfigFromCustomer(customer: {
  provisionEnabled?: number | boolean | null;
  provisionMode?: "deduction" | "surcharge" | null;
  provisionType?: "percentage" | "fixed" | "two_rate" | null;
  provisionValueBp?: number | null;
  provisionValueCents?: number | null;
  provisionUnit?: "hour" | "day" | null;
  provisionUserRate?: number | null;
  provisionUserRateRemote?: number | null;
}): ProvisionConfig {
  return {
    enabled: Number(customer.provisionEnabled ?? 0) === 1,
    mode: customer.provisionMode ?? "deduction",
    type: customer.provisionType ?? "percentage",
    valueBp: Number(customer.provisionValueBp ?? 0),
    valueCents: Number(customer.provisionValueCents ?? 0),
    unit: customer.provisionUnit ?? "day",
    userRate: Number(customer.provisionUserRate ?? 0),
    userRateRemote: Number(customer.provisionUserRateRemote ?? 0),
  };
}
