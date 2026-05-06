import type { ExchangeRates } from '../store/types';

// APIs gratuitas y sin CORS para tipo de cambio COP/USD
const FALLBACK_RATE = 4200; // tasa aproximada COP por USD si falla la API

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  // Intentar con exchangerate-api.com (free tier, no key needed para algunos pares)
  const apis = [
    () => fetchFromFrankfurter(),
    () => fetchFromExchangeRateHost(),
  ];

  for (const fn of apis) {
    try {
      const rate = await fn();
      if (rate && rate > 0) {
        return { USD_COP: rate, lastUpdated: new Date().toISOString() };
      }
    } catch (_) { /* intentar siguiente */ }
  }

  return { USD_COP: FALLBACK_RATE, lastUpdated: new Date().toISOString() };
}

async function fetchFromFrankfurter(): Promise<number> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=COP', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('Frankfurter API error');
  const data = await res.json();
  if (data?.rates?.COP) return data.rates.COP;
  throw new Error('No COP rate in response');
}

async function fetchFromExchangeRateHost(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('ExchangeRate API error');
  const data = await res.json();
  if (data?.rates?.COP) return data.rates.COP;
  throw new Error('No COP rate');
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
