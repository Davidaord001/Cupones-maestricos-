/**
 * Vercel Serverless Function — MercadoLibre Product Search
 * GET /api/ml-search?q=sony+xm5&site=MCO&limit=5
 *
 * Sites: MEC = Ecuador (USD), MCO = Colombia (COP)
 * This runs on Vercel servers — NOT blocked by ML API unlike local/Python.
 */

const COP_USD_RATE = 3715; // Mayo 2026

/**
 * Fallback prices — se usan cuando la API de ML no responde.
 * IMPORTANTE: las keys DEBEN ser query.toLowerCase() exacto (igual que en mlSearchService.ts)
 */
const FALLBACK_PRICES = {
  // ── Ecuador (USD) ── keys = query exacto en lowercase de mlSearchService.ts ──
  'samsung galaxy a55 5g 256gb':         { price: 389,  originalPrice: 459,  discountPercent: 15, currency: 'USD', title: 'Samsung Galaxy A55 5G 256GB' },
  'apple iphone 15 128gb sellado':       { price: 799,  originalPrice: 869,  discountPercent: 8,  currency: 'USD', title: 'Apple iPhone 15 128GB' },
  'apple macbook air m2 13 256gb':       { price: 989,  originalPrice: 1099, discountPercent: 10, currency: 'USD', title: 'MacBook Air 13" M2 256GB' },
  'samsung smart tv 65 qled 4k':        { price: 699,  originalPrice: 899,  discountPercent: 22, currency: 'USD', title: 'Smart TV Samsung 65" QLED Q60D' },
  'playstation 5 slim digital 1tb':      { price: 489,  originalPrice: 549,  discountPercent: 11, currency: 'USD', title: 'PS5 Slim Digital 1TB' },
  // AirPods Pro 2 — precio real verificado desde MercadoLibre Ecuador (screenshot 6-may-2026)
  'airpods pro 2 generacion usb-c':      { price: 437,  originalPrice: 499,  discountPercent: 12, currency: 'USD', title: 'Apple AirPods Pro (2a Gen) USB-C' },
  'sony wh-1000xm5 auriculares':         { price: 319,  originalPrice: 399,  discountPercent: 20, currency: 'USD', title: 'Sony WH-1000XM5' },
  'samsung galaxy tab a9 plus 128gb wifi':{ price: 269, originalPrice: 299,  discountPercent: 10, currency: 'USD', title: 'Samsung Galaxy Tab A9+ 128GB' },
  'xiaomi redmi note 13 pro 5g 256gb':   { price: 349,  originalPrice: 399,  discountPercent: 13, currency: 'USD', title: 'Xiaomi Redmi Note 13 Pro 5G' },
  'nintendo switch oled':                { price: 349,  originalPrice: 399,  discountPercent: 12, currency: 'USD', title: 'Nintendo Switch OLED' },
  'jbl flip 6 altavoz bluetooth':        { price: 99,   originalPrice: 120,  discountPercent: 18, currency: 'USD', title: 'JBL Flip 6' },
  'asus vivobook 15 oled core i5 512gb': { price: 589,  originalPrice: 654,  discountPercent: 10, currency: 'USD', title: 'ASUS Vivobook 15 OLED i5' },
  'tcl 55 4k google tv':                 { price: 444,  originalPrice: 509,  discountPercent: 13, currency: 'USD', title: 'TCL 55" 4K Google TV' },
  // ── Colombia (USD equivalente, scraper actualiza con COP real) ────────────
  'samsung galaxy s24 fe 256gb 5g':      { price: 952,  originalPrice: 1082, discountPercent: 12, currency: 'USD', title: 'Samsung Galaxy S24 FE 256GB' },
  'motorola edge 60 fusion 5g 256gb':    { price: 214,  originalPrice: 238,  discountPercent: 10, currency: 'USD', title: 'Motorola Edge 60 Fusion 5G' },
  'apple iphone 15 128gb nuevo sellado': { price: 686,  originalPrice: 762,  discountPercent: 10, currency: 'USD', title: 'Apple iPhone 15 128GB' },
  'apple macbook air m2 256gb':          { price: 1071, originalPrice: 1190, discountPercent: 10, currency: 'USD', title: 'MacBook Air 13" M2' },
  'jbl charge 5 bluetooth ip67':         { price: 54,   originalPrice: 83,   discountPercent: 35, currency: 'USD', title: 'JBL Charge 5' },
  'xiaomi redmi note 13 pro plus 256gb': { price: 238,  originalPrice: 333,  discountPercent: 28, currency: 'USD', title: 'Xiaomi Redmi Note 13 Pro+' },
  'hisense 55 uled 4k google tv':        { price: 357,  originalPrice: 548,  discountPercent: 35, currency: 'USD', title: 'Hisense 55" ULED 4K' },
  'lg lavadora 16kg carga frontal':      { price: 266,  originalPrice: 333,  discountPercent: 20, currency: 'USD', title: 'Lavadora LG 16kg' },
  'samsung nevera bespoke 300 litros':   { price: 357,  originalPrice: 476,  discountPercent: 25, currency: 'USD', title: 'Nevera Samsung Bespoke 300L' },
  'asus vivobook 15 core i5 512gb':      { price: 297,  originalPrice: 381,  discountPercent: 22, currency: 'USD', title: 'ASUS Vivobook 15 i5' },
  'samsung galaxy a35 5g 128gb':         { price: 190,  originalPrice: 238,  discountPercent: 20, currency: 'USD', title: 'Samsung Galaxy A35 5G' },
  'sony wh-1000xm5 audifonos noise cancelling': { price: 274, originalPrice: 536, discountPercent: 49, currency: 'USD', title: 'Sony WH-1000XM5' },
};

function normalizePrices(item, site) {
  const isCOP = item.currency_id === 'COP';
  const rate = isCOP ? COP_USD_RATE : 1;

  const currentPrice = Math.round((item.price / rate) * 100) / 100;
  const origCOP = item.original_price;
  const originalPrice = origCOP
    ? Math.round((origCOP / rate) * 100) / 100
    : currentPrice;
  const discountPercent =
    originalPrice > currentPrice
      ? Math.round((1 - currentPrice / originalPrice) * 100)
      : 0;

  return {
    title: item.title,
    price: currentPrice,
    originalPrice,
    discountPercent,
    currency: 'USD',
    copPrice: isCOP ? item.price : null,
    copOriginalPrice: isCOP && item.original_price ? item.original_price : null,
    permalink: item.permalink,
    thumbnail: (item.thumbnail || '').replace('I.jpg', 'O.jpg'),
    seller: item.seller?.nickname || '',
    itemId: item.id,
    site,
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q = '', site = 'MEC', limit = '10' } = req.query;
  const query = q.trim();

  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  // Validate site
  const validSites = ['MEC', 'MCO', 'MLA', 'MLB', 'MLM'];
  const cleanSite = validSites.includes(site.toUpperCase()) ? site.toUpperCase() : 'MEC';
  const numLimit = Math.min(parseInt(limit, 10) || 10, 20);

  try {
    const mlUrl = `https://api.mercadolibre.com/sites/${cleanSite}/search?q=${encodeURIComponent(query)}&limit=${numLimit}`;

    const response = await fetch(mlUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ecuador-agents-bot/1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // ML API blocked — return from fallback
      const fallbackKey = query.toLowerCase();
      const fallback = FALLBACK_PRICES[fallbackKey];
      if (fallback) {
        return res.json({
          results: [{ ...fallback, permalink: '', thumbnail: '', seller: 'tienda', itemId: '', site: cleanSite }],
          source: 'fallback',
          query,
        });
      }
      return res.status(response.status).json({
        error: `ML API returned ${response.status}`,
        source: 'ml_api_error',
        results: [],
      });
    }

    const data = await response.json();
    const results = (data.results || [])
      .filter(item => item.price > 0)
      .map(item => normalizePrices(item, cleanSite));

    return res.json({ results, total: data.paging?.total || 0, source: 'mercadolibre', query, site: cleanSite });

  } catch (err) {
    // Timeout or network error — return fallback
    const fallbackKey = query.toLowerCase();
    const fallback = FALLBACK_PRICES[fallbackKey];
    if (fallback) {
      return res.json({
        results: [{ ...fallback, permalink: '', thumbnail: '', seller: 'tienda', itemId: '', site: cleanSite }],
        source: 'fallback',
        query,
      });
    }
    return res.status(500).json({ error: err.message, results: [], source: 'error' });
  }
}
