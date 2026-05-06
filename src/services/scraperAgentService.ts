/**
 * scraperAgentService.ts
 * ──────────────────────
 * Agente Scraper Virtual — entra a las páginas reales de Falabella,
 * Alkosto, Éxito, Homecenter y Jumbo Colombia. Navega dentro de ellas,
 * busca en sus buscadores internos y extrae precios actualizados.
 *
 * Flujo por producto:
 *  1. Llama a /api/scrape-product?url=<url_producto>
 *  2. El servidor entra a la página (JSON-LD → __NEXT_DATA__ → regex)
 *  3. Extrae precio, precio original, descuento en COP
 *  4. El store actualiza el producto con precio real COP
 *  5. El ShopPage convierte COP → USD con la tasa live del Agente Divisa
 */

import type { Discount } from '../store/types';

// ── Configuración de scraping por producto ──────────────────────────────────
interface ScraperConfig {
  id: string;
  url: string;        // URL directa del producto (preferida) o de búsqueda
  storeName: string;  // Nombre legible de la tienda
  storeKey: string;   // falabella | alkosto | exito | homecenter | jumbo
}

export const COLOMBIA_SCRAPER_CONFIGS: ScraperConfig[] = [
  // ── Falabella (URLs directas de producto — scraping más preciso) ──────
  {
    id: 'r-co-12',
    url: 'https://www.falabella.com.co/falabella-co/product/119322599/Audifonos-inalambricos-noise-cancelling-sony-wh-1000xm5-gris/119322603',
    storeName: 'Falabella Colombia',
    storeKey: 'falabella',
  },
  {
    id: 'r-co-02',
    url: 'https://www.falabella.com.co/falabella-co/product/73304155/Celular-motorola-edge-60-fusion-5G-256GB-8GB-RAM-/73304155',
    storeName: 'Falabella Colombia',
    storeKey: 'falabella',
  },
  // ── Falabella (búsqueda — entra al buscador y extrae primer resultado) ─
  {
    id: 'r-co-03',
    url: 'https://www.falabella.com.co/falabella-co/search?Ntt=iphone+15+128gb',
    storeName: 'Falabella Colombia',
    storeKey: 'falabella',
  },
  {
    id: 'r-co-07',
    url: 'https://www.falabella.com.co/falabella-co/search?Ntt=hisense+55+uled+4k',
    storeName: 'Falabella Colombia',
    storeKey: 'falabella',
  },
  // ── Alkosto ─────────────────────────────────────────────────────────────
  {
    id: 'r-co-01',
    url: 'https://www.alkosto.com/search?text=samsung+galaxy+s24+fe+256gb',
    storeName: 'Alkosto Colombia',
    storeKey: 'alkosto',
  },
  {
    id: 'r-co-04',
    url: 'https://www.alkosto.com/search?text=macbook+air+m2',
    storeName: 'Alkosto Colombia',
    storeKey: 'alkosto',
  },
  {
    id: 'r-co-06',
    url: 'https://www.alkosto.com/search?text=xiaomi+redmi+note+13+pro+plus+256gb',
    storeName: 'Alkosto Colombia',
    storeKey: 'alkosto',
  },
  {
    id: 'r-co-10',
    url: 'https://www.alkosto.com/search?text=asus+vivobook+15+i5+512gb',
    storeName: 'Alkosto Colombia',
    storeKey: 'alkosto',
  },
  // ── Éxito ───────────────────────────────────────────────────────────────
  {
    id: 'r-co-05',
    url: 'https://www.exito.com/search?text=jbl+charge+5',
    storeName: 'Éxito Colombia',
    storeKey: 'exito',
  },
  {
    id: 'r-co-11',
    url: 'https://www.exito.com/search?text=samsung+galaxy+a35+5g+128gb',
    storeName: 'Éxito Colombia',
    storeKey: 'exito',
  },
  // ── Jumbo ───────────────────────────────────────────────────────────────
  {
    id: 'r-co-08',
    url: 'https://www.tiendasjumbo.co/buscar?q=lavadora+lg+16kg+carga+frontal',
    storeName: 'Jumbo Colombia',
    storeKey: 'jumbo',
  },
  // ── Homecenter ──────────────────────────────────────────────────────────
  {
    id: 'r-co-09',
    url: 'https://www.homecenter.com.co/homecenter-co/search?Ntt=nevera+samsung+bespoke+300',
    storeName: 'Homecenter Colombia',
    storeKey: 'homecenter',
  },
];

export interface ScrapeResult {
  id: string;
  price: number;         // COP
  originalPrice: number; // COP
  discountPercent: number;
  currency: 'COP' | 'USD';
  source: string;
  storeName: string;
  url: string;
  title?: string | null;
}

type LogType = 'info' | 'success' | 'warning' | 'error';
type LogFn = (msg: string, type: LogType) => void;

let scraperTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // cada 2 horas

// ── Función principal: scrape de un producto ────────────────────────────────
export async function scrapeOneProduct(cfg: ScraperConfig): Promise<ScrapeResult | null> {
  try {
    const encoded = encodeURIComponent(cfg.url);
    const res = await fetch(`/api/scrape-product?url=${encoded}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.result) return null;

    const r = data.result;
    if (!r.price || r.price <= 0) return null;

    return {
      id: cfg.id,
      price: r.price,
      originalPrice: r.originalPrice || r.price,
      discountPercent: r.discountPercent || 0,
      currency: (r.currency as 'COP' | 'USD') || 'COP',
      source: r.source || 'scraper',
      storeName: cfg.storeName,
      url: cfg.url,
      title: r.title,
    };
  } catch {
    return null;
  }
}

// ── Ciclo completo: actualiza todos los productos Colombia ──────────────────
export async function refreshColombiaProducts(
  updateDiscount: (id: string, patch: Partial<Discount>) => void,
  logFn?: LogFn,
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  logFn?.('Agente Scraper: iniciando búsqueda en tiendas colombianas...', 'info');

  // Procesar en lotes de 3 para no saturar
  const BATCH = 3;
  for (let i = 0; i < COLOMBIA_SCRAPER_CONFIGS.length; i += BATCH) {
    const batch = COLOMBIA_SCRAPER_CONFIGS.slice(i, i + BATCH);

    await Promise.all(batch.map(async (cfg) => {
      logFn?.(
        `Agente Scraper: entrando a ${cfg.storeName} — buscando ${cfg.id}...`,
        'info',
      );

      const result = await scrapeOneProduct(cfg);

      if (result && result.price > 0) {
        updateDiscount(cfg.id, {
          discountedPrice: result.price,
          originalPrice: result.originalPrice,
          discountPercent: result.discountPercent,
          // mantener currency: 'COP' — no tocar
        });
        updated++;

        const priceFormatted = result.price.toLocaleString('es-CO');
        logFn?.(
          `Agente Scraper ✓ ${cfg.storeName}: $${priceFormatted} COP (-${result.discountPercent}%)${result.title ? ` — ${result.title.slice(0, 40)}` : ''}`,
          'success',
        );
      } else {
        failed++;
        logFn?.(
          `Agente Scraper: no se obtuvo precio para ${cfg.id} en ${cfg.storeName} — manteniendo precio actual`,
          'warning',
        );
      }
    }));

    // Pausa entre lotes para evitar rate limiting
    if (i + BATCH < COLOMBIA_SCRAPER_CONFIGS.length) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  logFn?.(
    `Agente Scraper completado — ${updated} precios actualizados, ${failed} sin datos`,
    updated > 0 ? 'success' : 'warning',
  );

  return { updated, failed };
}

// ── Ciclo periódico ─────────────────────────────────────────────────────────
export function startScraperCycle(
  updateDiscount: (id: string, patch: Partial<Discount>) => void,
  logFn?: LogFn,
): void {
  // Ejecutar al inicio (con delay para no saturar al arrancar)
  setTimeout(() => {
    refreshColombiaProducts(updateDiscount, logFn);
  }, 5000);

  if (scraperTimer) clearTimeout(scraperTimer);
  const schedule = () => {
    scraperTimer = setTimeout(() => {
      refreshColombiaProducts(updateDiscount, logFn);
      schedule();
    }, REFRESH_INTERVAL_MS);
  };
  schedule();
}

export function stopScraperCycle(): void {
  if (scraperTimer) {
    clearTimeout(scraperTimer);
    scraperTimer = null;
  }
}
