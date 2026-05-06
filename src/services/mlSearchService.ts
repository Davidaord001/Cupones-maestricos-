/**
 * mlSearchService.ts
 * ──────────────────
 * Agente Scraper — consulta MercadoLibre a través de /api/ml-search (Vercel function)
 * y actualiza los precios de los 25 productos en el store de Zustand en tiempo real.
 *
 * Flujo:
 *  1. En startup de la app → refreshAllProductPrices()
 *  2. Cada 4 horas → refreshAllProductPrices() automáticamente
 *  3. Los precios del store se actualizan con datos REALES de ML
 */

import type { Discount } from '../store/types';

// Mapa: id de producto → query de búsqueda + site ML
const PRODUCT_QUERIES: Record<string, { query: string; site: 'MEC' | 'MCO' }> = {
  'r-ec-01': { query: 'Samsung Galaxy A55 5G 256GB', site: 'MEC' },
  'r-ec-02': { query: 'Apple iPhone 15 128GB sellado', site: 'MEC' },
  'r-ec-03': { query: 'Apple MacBook Air M2 13 256GB', site: 'MEC' },
  'r-ec-04': { query: 'Samsung Smart TV 65 QLED 4K', site: 'MEC' },
  'r-ec-05': { query: 'PlayStation 5 Slim Digital 1TB', site: 'MEC' },
  'r-ec-06': { query: 'AirPods Pro 2 generacion USB-C', site: 'MEC' },
  'r-ec-07': { query: 'Sony WH-1000XM5 auriculares', site: 'MEC' },
  'r-ec-08': { query: 'Samsung Galaxy Tab A9 Plus 128GB WiFi', site: 'MEC' },
  'r-ec-09': { query: 'Xiaomi Redmi Note 13 Pro 5G 256GB', site: 'MEC' },
  'r-ec-10': { query: 'Nintendo Switch OLED', site: 'MEC' },
  'r-ec-11': { query: 'JBL Flip 6 altavoz bluetooth', site: 'MEC' },
  'r-ec-12': { query: 'ASUS Vivobook 15 OLED Core i5 512GB', site: 'MEC' },
  'r-ec-13': { query: 'TCL 55 4K Google TV', site: 'MEC' },
  'r-co-01': { query: 'Samsung Galaxy S24 FE 256GB 5G', site: 'MCO' },
  'r-co-02': { query: 'Motorola Edge 60 Fusion 5G 256GB', site: 'MCO' },
  'r-co-03': { query: 'Apple iPhone 15 128GB nuevo sellado', site: 'MCO' },
  'r-co-04': { query: 'Apple MacBook Air M2 256GB', site: 'MCO' },
  'r-co-05': { query: 'JBL Charge 5 bluetooth IP67', site: 'MCO' },
  'r-co-06': { query: 'Xiaomi Redmi Note 13 Pro Plus 256GB', site: 'MCO' },
  'r-co-07': { query: 'Hisense 55 ULED 4K Google TV', site: 'MCO' },
  'r-co-08': { query: 'LG lavadora 16kg carga frontal', site: 'MCO' },
  'r-co-09': { query: 'Samsung nevera Bespoke 300 litros', site: 'MCO' },
  'r-co-10': { query: 'ASUS Vivobook 15 Core i5 512GB', site: 'MCO' },
  'r-co-11': { query: 'Samsung Galaxy A35 5G 128GB', site: 'MCO' },
  'r-co-12': { query: 'Sony WH-1000XM5 audifonos noise cancelling', site: 'MCO' },
};

// Umbrales de descuento mínimo para mostrar un producto como "oferta"
const MIN_DISCOUNT_TO_SHOW = 5; // %

export interface MLSearchResult {
  title: string;
  price: number;         // USD
  originalPrice: number; // USD
  discountPercent: number;
  currency: 'USD';
  copPrice: number | null;
  copOriginalPrice: number | null;
  permalink: string;
  thumbnail: string;
  seller: string;
  itemId: string;
  site: string;
  source?: string;
}

export interface MLSearchResponse {
  results: MLSearchResult[];
  total?: number;
  source: 'mercadolibre' | 'fallback' | 'error' | string;
  query: string;
  site: string;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

/**
 * Busca un producto en MercadoLibre vía Vercel serverless function.
 * Si ML está bloqueado, la función devuelve datos del fallback (precios verificados).
 */
export async function searchProduct(query: string, site: 'MEC' | 'MCO' = 'MEC', limit = 5): Promise<MLSearchResponse> {
  try {
    const url = `/api/ml-search?q=${encodeURIComponent(query)}&site=${site}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[mlSearch] Error fetching from /api/ml-search:', err);
    return { results: [], source: 'error', query, site };
  }
}

/**
 * Calcula el mejor precio de una lista de resultados ML:
 * - Prefiere resultados con descuento ≥ MIN_DISCOUNT_TO_SHOW
 * - Toma el primero con mayor descuento si hay múltiples
 */
function pickBestResult(results: MLSearchResult[]): MLSearchResult | null {
  if (!results.length) return null;
  const withDiscount = results.filter(r => r.discountPercent >= MIN_DISCOUNT_TO_SHOW);
  if (withDiscount.length > 0) {
    return withDiscount.reduce((best, r) => r.discountPercent > best.discountPercent ? r : best, withDiscount[0]);
  }
  return results[0];
}

/**
 * Actualiza los precios de TODOS los productos en el Zustand store con datos reales de ML.
 * Retorna cuántos productos fueron actualizados.
 */
export async function refreshAllProductPrices(
  getDiscounts: () => Discount[],
  updateDiscount: (id: string, patch: Partial<Discount>) => void,
): Promise<{ updated: number; failed: number; source: string }> {
  let updated = 0;
  let failed = 0;
  let source = 'unknown';

  const productIds = Object.keys(PRODUCT_QUERIES);

  // Parallelizar en lotes de 4 para no saturar
  const BATCH_SIZE = 4;
  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (id) => {
        const { query, site } = PRODUCT_QUERIES[id];
        try {
          const resp = await searchProduct(query, site, 5);
          source = resp.source;
          const best = pickBestResult(resp.results);
          if (!best) { failed++; return; }

          // Solo actualizar si el descuento tiene sentido (evitar datos corruptos)
          if (best.price > 0 && best.originalPrice >= best.price) {
            updateDiscount(id, {
              discountedPrice: best.price,
              originalPrice: best.originalPrice,
              discountPercent: best.discountPercent,
            });
            updated++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }),
    );
    // Pequeña pausa entre lotes para evitar rate limiting
    if (i + BATCH_SIZE < productIds.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.info(`[mlSearch] Precios actualizados: ${updated}/${productIds.length} (source: ${source})`);
  return { updated, failed, source };
}

/**
 * Inicia el ciclo periódico de actualización de precios.
 */
export function startPriceRefreshCycle(
  getDiscounts: () => Discount[],
  updateDiscount: (id: string, patch: Partial<Discount>) => void,
): void {
  // Primera actualización inmediata
  refreshAllProductPrices(getDiscounts, updateDiscount);

  // Actualizaciones periódicas cada 4 horas
  if (refreshTimer) clearTimeout(refreshTimer);
  const schedule = () => {
    refreshTimer = setTimeout(() => {
      refreshAllProductPrices(getDiscounts, updateDiscount);
      schedule();
    }, REFRESH_INTERVAL_MS);
  };
  schedule();
}

export function stopPriceRefreshCycle(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
