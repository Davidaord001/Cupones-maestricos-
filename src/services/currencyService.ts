import type { ExchangeRates } from '../store/types';

// Tasa de referencia actualizada al 6 mayo 2026
const FALLBACK_RATE = 4200;

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const apis = [
    fetchFromFawazahmed,    // CDN jsDelivr, sin CORS, gratuito, 100% uptime
    fetchFromExchangerateApi, // ExchangeRate-API free tier
    fetchFromMyFreeAPI,       // MyFreeAPI.com
  ];

  for (const fn of apis) {
    try {
      const rate = await fn();
      if (rate && rate > 1000 && rate < 8000) {
        // Validación: la tasa COP/USD siempre está entre 1000 y 8000
        return { USD_COP: Math.round(rate), lastUpdated: new Date().toISOString() };
      }
    } catch (_) { /* intentar siguiente */ }
  }

  // Fallback: tasa de referencia con fecha del día para que no dispare re-fetch inmediato
  return { USD_COP: FALLBACK_RATE, lastUpdated: new Date().toISOString() };
}

/** fawazahmed0 currency-api — CDN jsDelivr, sin clave, sin CORS, actualizada diariamente */
async function fetchFromFawazahmed(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  // Intentar con la fecha de hoy, luego con @latest como fallback
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${today}/v1/currencies/usd.min.json`,
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = await res.json();
      const rate = data?.usd?.cop;
      if (rate && rate > 0) return rate;
    } catch (_) { /* siguiente URL */ }
  }
  throw new Error('fawazahmed: no COP rate');
}

/** ExchangeRate-API — free tier sin clave, soporta COP */
async function fetchFromExchangerateApi(): Promise<number> {
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error('exchangerate-api error');
  const data = await res.json();
  if (data?.rates?.COP) return data.rates.COP;
  throw new Error('No COP in exchangerate-api');
}

/** MyFreeAPI — backup adicional */
async function fetchFromMyFreeAPI(): Promise<number> {
  const res = await fetch('https://www.floatrates.com/daily/usd.json', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error('floatrates error');
  const data = await res.json();
  if (data?.cop?.rate) return data.cop.rate;
  throw new Error('No COP in floatrates');
}

/** Convierte un precio COP a USD usando la tasa actual */
export function copToUSD(amountCOP: number, rate: number): number {
  return amountCOP / rate;
}

/** Convierte un precio USD a COP usando la tasa actual */
export function usdToCOP(amountUSD: number, rate: number): number {
  return amountUSD * rate;
}

/** Formatea moneda */
export function formatCurrency(amount: number, currency: 'USD' | 'COP'): string {
  if (currency === 'COP') {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  }
  return `$${amount.toFixed(2)}`;
}
