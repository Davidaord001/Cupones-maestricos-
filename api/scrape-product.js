/**
 * /api/scrape-product.js
 * ──────────────────────
 * Agente Scraper — entra DENTRO de las páginas de tiendas,
 * busca en sus buscadores y extrae precios reales de productos.
 *
 * GET /api/scrape-product?url=<encoded_url>
 *   → Entra al producto directamente, extrae precio del JSON-LD
 *
 * GET /api/scrape-product?store=falabella&q=sony+xm5
 *   → Busca en la tienda, entra a los resultados, extrae precios
 *
 * Tiendas soportadas: falabella, alkosto, exito, homecenter, jumbo
 */

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-CO,es;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

// URL de búsqueda por tienda
const STORE_SEARCH_URLS = {
  falabella: (q) => `https://www.falabella.com.co/falabella-co/search?Ntt=${encodeURIComponent(q)}`,
  alkosto:   (q) => `https://www.alkosto.com/search?text=${encodeURIComponent(q)}`,
  exito:     (q) => `https://www.exito.com/search?text=${encodeURIComponent(q)}`,
  homecenter:(q) => `https://www.homecenter.com.co/homecenter-co/search?Ntt=${encodeURIComponent(q)}`,
  jumbo:     (q) => `https://www.tiendasjumbo.co/buscar?q=${encodeURIComponent(q)}`,
};

function parsePrice(val) {
  if (val == null) return null;
  const n = parseFloat(String(val).replace(/[.,\s$]/g, (c) => (c === '.' && String(val).indexOf(',') > -1 ? '' : c === ',' ? '.' : '')).replace(/[^0-9.]/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

function parseCopPrice(val) {
  // COP prices: remove dots (thousands sep) → integer
  if (val == null) return null;
  const str = String(val).replace(/\./g, '').replace(/,/g, '').replace(/[^0-9]/g, '');
  const n = parseInt(str, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function extractJsonLDBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1].trim())); } catch { /* skip malformed */ }
  }
  return blocks;
}

function extractNextData(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function productFromJsonLD(blocks) {
  for (const block of blocks) {
    const candidates = Array.isArray(block) ? block : [block];
    for (const item of candidates) {
      if (item['@type'] !== 'Product') continue;
      const offers = item.offers;
      if (!offers) continue;
      const offer = Array.isArray(offers) ? offers[0] : offers;

      // Falabella JSON-LD: price is a string like "1199900"
      const price = parseCopPrice(offer.price ?? offer.lowPrice);
      // highPrice only sometimes present — use it for original
      const origPrice = parseCopPrice(offer.highPrice) || price;

      if (!price) continue;

      const discount = origPrice > price
        ? Math.round((1 - price / origPrice) * 100)
        : 0;

      return {
        title: item.name || null,
        price,
        originalPrice: origPrice,
        discountPercent: discount,
        currency: offer.priceCurrency || 'COP',
        available: !offer.availability || offer.availability.includes('InStock'),
        image: Array.isArray(item.image) ? (item.image[0]?.url || item.image[0]) : item.image,
        sku: item.sku || item.productID || null,
        source: 'jsonld',
      };
    }
  }
  return null;
}

function productFromNextData(nextData, storeName) {
  if (!nextData) return null;
  const pp = nextData?.props?.pageProps;

  // Falabella product page: props.pageProps.product or .productInfo
  const candidates = [
    pp?.product, pp?.productInfo, pp?.item,
    pp?.initialState?.product, pp?.initialState?.catalog?.product,
  ];

  for (const product of candidates) {
    if (!product) continue;
    const price = parseCopPrice(
      product.prices?.offerPrice ?? product.prices?.normalPrice ??
      product.offerPrice ?? product.normalPrice ?? product.price,
    );
    if (!price) continue;
    const origPrice = parseCopPrice(
      product.prices?.originalPrice ?? product.originalPrice ?? product.prices?.normalPrice,
    ) || price;

    return {
      title: product.displayName || product.name || product.title || null,
      price,
      originalPrice: origPrice,
      discountPercent: origPrice > price ? Math.round((1 - price / origPrice) * 100) : 0,
      currency: 'COP',
      available: true,
      image: product.thumbnailUrl || product.imageUrl || null,
      sku: product.productId || product.sku || null,
      source: 'nextdata_product',
    };
  }
  return null;
}

function productFromSearchNextData(nextData, storeName) {
  if (!nextData) return null;
  const pp = nextData?.props?.pageProps;

  // Different stores use different keys in __NEXT_DATA__
  const resultsList =
    pp?.searchResults?.data?.searchResults?.results ||
    pp?.initialState?.search?.products ||
    pp?.products ||
    pp?.data?.products ||
    pp?.searchData?.products ||
    pp?.results;

  if (!resultsList || !Array.isArray(resultsList) || resultsList.length === 0) return null;

  const items = [];
  for (const item of resultsList.slice(0, 8)) {
    const price = parseCopPrice(
      item.prices?.offerPrice ?? item.prices?.normalPrice ??
      item.offerPrice ?? item.normalPrice ?? item.price,
    );
    if (!price || price < 5000) continue;
    const origPrice = parseCopPrice(item.prices?.originalPrice ?? item.originalPrice) || price;

    const relUrl = item.url || item.href || item.productUrl || item.link || '';
    const permalink = relUrl.startsWith('http') ? relUrl
      : relUrl ? `https://www.falabella.com.co${relUrl}`
      : null;

    items.push({
      title: item.displayName || item.name || item.title || null,
      price,
      originalPrice: origPrice,
      discountPercent: origPrice > price ? Math.round((1 - price / origPrice) * 100) : 0,
      currency: 'COP',
      available: true,
      image: item.thumbnailUrl || item.imageUrl || item.image || null,
      permalink,
      source: 'nextdata_search',
    });
  }
  return items.length > 0 ? items : null;
}

function extractPricesRegex(html) {
  // Find "price":"XXXXXXX" patterns — reliable for both product and search pages
  const priceMatches = [...html.matchAll(/"price":"(\d{6,8})"/g)].map(m => parseInt(m[1]));
  const uniquePrices = [...new Set(priceMatches)].filter(p => p > 50000 && p < 100000000);
  if (uniquePrices.length === 0) return null;
  uniquePrices.sort((a, b) => a - b);
  const price = uniquePrices[0];
  const origPrice = uniquePrices.length >= 2 ? uniquePrices[uniquePrices.length - 1] : price;
  return {
    price,
    originalPrice: origPrice,
    discountPercent: origPrice > price ? Math.round((1 - price / origPrice) * 100) : 0,
    currency: 'COP',
    available: true,
    source: 'regex',
    title: null,
    image: null,
  };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

// ── SCRAPER PRINCIPAL: entra a una URL de producto ─────────────────────────
async function scrapeProductUrl(url) {
  const html = await fetchHtml(url);

  // Estrategia 1: JSON-LD schema.org/Product (más confiable — Falabella lo tiene)
  const ldBlocks = extractJsonLDBlocks(html);
  const fromLD = productFromJsonLD(ldBlocks);
  if (fromLD) return fromLD;

  // Estrategia 2: __NEXT_DATA__ (Falabella, Alkosto — apps Next.js)
  const nextData = extractNextData(html);
  const fromNext = productFromNextData(nextData);
  if (fromNext) return fromNext;

  // Estrategia 3: Regex en el HTML (fallback universal)
  const fromRegex = extractPricesRegex(html);
  if (fromRegex) return fromRegex;

  throw new Error('No se encontró precio en la página');
}

// ── BUSCADOR: entra al buscador de la tienda y obtiene resultados ──────────
async function searchInStore(storeName, query) {
  const searchFn = STORE_SEARCH_URLS[storeName.toLowerCase()];
  if (!searchFn) throw new Error(`Tienda no soportada: ${storeName}`);

  const searchUrl = searchFn(query);
  const html = await fetchHtml(searchUrl);

  const results = [];

  // Estrategia 1: __NEXT_DATA__ (Next.js stores — Falabella, Alkosto)
  const nextData = extractNextData(html);
  const fromNext = productFromSearchNextData(nextData, storeName);
  if (fromNext && fromNext.length > 0) {
    results.push(...fromNext);
  }

  // Estrategia 2: JSON-LD ItemList en página de búsqueda
  if (results.length === 0) {
    const ldBlocks = extractJsonLDBlocks(html);
    for (const block of ldBlocks) {
      if (block['@type'] === 'ItemList' && Array.isArray(block.itemListElement)) {
        for (const elem of block.itemListElement.slice(0, 5)) {
          const item = elem.item || elem;
          const price = parseCopPrice(item.offers?.price || item.offers?.lowPrice);
          if (!price) continue;
          results.push({
            title: item.name,
            price,
            originalPrice: parseCopPrice(item.offers?.highPrice) || price,
            discountPercent: 0,
            currency: 'COP',
            permalink: item.url || searchUrl,
            image: item.image,
            available: true,
            source: 'jsonld_search',
          });
        }
        break;
      }
    }
  }

  // Estrategia 3: extraer del regex si todo falla
  if (results.length === 0) {
    const fromRegex = extractPricesRegex(html);
    if (fromRegex) {
      results.push({ ...fromRegex, permalink: searchUrl });
    }
  }

  return { results, searchUrl, store: storeName, query };
}

// ── Handler principal Vercel ───────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, store, q } = req.query;

  try {
    // Modo 1: URL directa de producto → entrar y extraer precio
    if (url) {
      const decoded = decodeURIComponent(url);
      const result = await scrapeProductUrl(decoded);
      return res.json({ success: true, result, url: decoded });
    }

    // Modo 2: Buscar en tienda → entrar al buscador → extraer lista de productos
    if (store && q) {
      const data = await searchInStore(store, q);
      return res.json({ success: true, ...data });
    }

    return res.status(400).json({
      success: false,
      error: 'Parámetros requeridos: url= (producto directo) o store= + q= (búsqueda)',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
