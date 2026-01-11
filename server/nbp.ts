import axios from "axios";

/**
 * Fetches EUR/PLN exchange rate from Narodowy Bank Polski (NBP) API
 * @param date - Date for which to fetch the rate (format: YYYY-MM-DD)
 * @returns Exchange rate as a number (e.g., 4.2369)
 */
export async function fetchNBPExchangeRate(date: Date): Promise<number> {
  try {
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const url = `https://api.nbp.pl/api/exchangerates/rates/a/eur/${dateStr}/?format=json`;
    
    const response = await axios.get(url);
    const rate = response.data.rates[0].mid;
    
    return rate;
  } catch (error: any) {
    // If rate not available for the exact date (weekend/holiday), try previous day
    if (error.response?.status === 404) {
      const previousDay = new Date(date);
      previousDay.setDate(previousDay.getDate() - 1);
      
      // Prevent infinite recursion - max 7 days back
      const daysDiff = Math.floor((Date.now() - previousDay.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 7) {
        throw new Error("No exchange rate available for the past 7 days");
      }
      
      return fetchNBPExchangeRate(previousDay);
    }
    
    throw error;
  }
}

/**
 * Converts EUR cents to PLN cents using the given rate
 * @param eurCents - Amount in EUR cents
 * @param rate - Exchange rate (e.g., 4.2369)
 * @returns Amount in PLN cents
 */
export function convertEURtoPLN(eurCents: number, rate: number): number {
  return Math.round((eurCents * rate) / 100) * 100;
}

/**
 * Converts PLN cents to EUR cents using the given rate
 * @param plnCents - Amount in PLN cents
 * @param rate - Exchange rate (e.g., 4.2369)
 * @returns Amount in EUR cents
 */
export function convertPLNtoEUR(plnCents: number, rate: number): number {
  return Math.round((plnCents / rate) * 100);
}
