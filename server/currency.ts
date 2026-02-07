/**
 * Currency Conversion Helpers
 * Provides functions for converting amounts between currencies using exchange rates
 */

import { getExchangeRateByDate, getExchangeRates } from "./db";

export interface ConversionResult {
  convertedAmount: number;  // in cents
  rate: number;  // actual rate used (in ten-thousandths)
  effectiveDate: Date;  // date of the rate used
  currencyPair: string;  // e.g., "EUR/PLN"
}

/**
 * Convert amount from one currency to another
 * @param amount Amount in cents
 * @param fromCurrency Source currency code (e.g., "EUR")
 * @param toCurrency Target currency code (e.g., "PLN")
 * @param date Date for which to use the exchange rate
 * @returns Conversion result with converted amount and rate details
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date: Date = new Date()
): Promise<ConversionResult> {
  // Same currency? No conversion needed
  if (fromCurrency === toCurrency) {
    return {
      convertedAmount: amount,
      rate: 10000,  // 1.0000 in ten-thousandths
      effectiveDate: date,
      currencyPair: `${fromCurrency}/${toCurrency}`
    };
  }
  
  // Get exchange rate for the date
  const currencyPair = `${fromCurrency}/${toCurrency}`;
  let rateData = await getExchangeRateByDate(currencyPair, date);
  
  // Fallback: Try to find nearest rate (up to 7 days back)
  if (!rateData) {
    rateData = await getNearestExchangeRate(currencyPair, date, 7);
  }
  
  // No rate found? Throw error
  if (!rateData) {
    throw new Error(`No exchange rate found for ${currencyPair} near ${date.toISOString().split('T')[0]}`);
  }
  
  // Perform conversion
  // amount (cents) * rate (ten-thousandths) / 10000 = convertedAmount (cents)
  const convertedAmount = Math.round((amount * rateData.rate) / 10000);
  
  return {
    convertedAmount,
    rate: rateData.rate,
    effectiveDate: rateData.date,
    currencyPair
  };
}

/**
 * Find nearest exchange rate for a currency pair
 * @param currencyPair Currency pair (e.g., "EUR/PLN")
 * @param targetDate Target date
 * @param maxDaysBack Maximum days to search backwards
 * @returns Exchange rate data or null if not found
 */
async function getNearestExchangeRate(
  currencyPair: string,
  targetDate: Date,
  maxDaysBack: number = 7
) {
  // Search backwards day by day
  for (let i = 1; i <= maxDaysBack; i++) {
    const checkDate = new Date(targetDate);
    checkDate.setDate(checkDate.getDate() - i);
    
    const rate = await getExchangeRateByDate(currencyPair, checkDate);
    if (rate) {
      return rate;
    }
  }
  
  return null;
}

/**
 * Convert multiple amounts to target currency
 * @param amounts Array of {amount, currency} objects
 * @param targetCurrency Target currency code
 * @param date Date for which to use exchange rates
 * @returns Total amount in target currency (in cents)
 */
export async function convertMultipleAmounts(
  amounts: Array<{ amount: number; currency: string }>,
  targetCurrency: string,
  date: Date = new Date()
): Promise<number> {
  let total = 0;
  
  for (const { amount, currency } of amounts) {
    const result = await convertAmount(amount, currency, targetCurrency, date);
    total += result.convertedAmount;
  }
  
  return total;
}

/**
 * Get all available exchange rates for a date
 * @param date Date for which to get rates
 * @returns Map of currency pair to rate (in ten-thousandths)
 */
export async function getExchangeRatesForDate(date: Date): Promise<Map<string, number>> {
  const rates = await getExchangeRates({ startDate: date, endDate: date });
  const rateMap = new Map<string, number>();
  
  for (const rate of rates) {
    rateMap.set(rate.currencyPair, rate.rate);
  }
  
  return rateMap;
}

/**
 * Format amount with currency symbol
 * @param amount Amount in cents
 * @param currency Currency code
 * @returns Formatted string (e.g., "€ 42.37" or "42,37 zł")
 */
export function formatCurrency(amount: number, currency: string): string {
  const value = (amount / 100).toFixed(2);
  
  switch (currency) {
    case 'EUR':
      return `€ ${value}`;
    case 'USD':
      return `$ ${value}`;
    case 'GBP':
      return `£ ${value}`;
    case 'CHF':
      return `CHF ${value}`;
    case 'PLN':
      return `${value.replace('.', ',')} zł`;
    default:
      return `${value} ${currency}`;
  }
}
