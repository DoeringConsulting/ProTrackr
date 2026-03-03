type ExchangeRateLike = {
  currencyPair: string;
  rate: number;
};

export const SUPPORTED_CURRENCIES = ["EUR", "PLN", "USD", "GBP", "CHF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

function normalizeCurrencyCode(currency: string | null | undefined): string {
  return (currency || "EUR").toUpperCase();
}

function normalizeRate(rawRate: number): number {
  // Stored rates are typically in ten-thousandths (e.g. 4.2369 => 42369).
  // Some legacy/client paths may already provide decimal rates.
  return rawRate > 100 ? rawRate / 10000 : rawRate;
}

export function buildLatestRateMap(rates: ExchangeRateLike[] | undefined) {
  const map = new Map<string, number>();
  if (!rates) return map;

  for (const rate of rates) {
    const pair = (rate.currencyPair || "").toUpperCase();
    if (!pair || map.has(pair)) continue;
    const normalized = normalizeRate(rate.rate);
    if (!Number.isFinite(normalized) || normalized <= 0) continue;
    map.set(pair, normalized);
  }
  return map;
}

export function convertAmountCents(
  amountCents: number,
  sourceCurrencyInput: string,
  targetCurrencyInput: string,
  rateMap: Map<string, number>
): number | null {
  const sourceCurrency = normalizeCurrencyCode(sourceCurrencyInput);
  const targetCurrency = normalizeCurrencyCode(targetCurrencyInput);

  if (sourceCurrency === targetCurrency) return amountCents;

  const sourceToPln =
    sourceCurrency === "PLN" ? 1 : rateMap.get(`${sourceCurrency}/PLN`);
  const targetToPln =
    targetCurrency === "PLN" ? 1 : rateMap.get(`${targetCurrency}/PLN`);

  if (!sourceToPln || !targetToPln) return null;

  const sourceAmount = amountCents / 100;
  const amountInPln = sourceAmount * sourceToPln;
  const amountInTarget = amountInPln / targetToPln;
  return Math.round(amountInTarget * 100);
}

export function formatMoney(cents: number, currencyInput: string) {
  const currency = normalizeCurrencyCode(currencyInput);
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function aggregateByCurrency(items: Array<{ amount: number; currency: string }>) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const currency = normalizeCurrencyCode(item.currency);
    totals.set(currency, (totals.get(currency) ?? 0) + item.amount);
  }
  return totals;
}

