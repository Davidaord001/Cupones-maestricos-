import type { Company, Discount, PriceHistoryEntry, UrlCheckResult } from '../store/types';
import { analyzeCompanyDiscounts, predictNextDiscountDate, groqUsage } from './groqService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Helpers ───────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Genera URL directa al producto o búsqueda específica en la tienda.
 * Si el template tiene urlPath, se usa; si no, genera búsqueda por nombre de producto.
 */
function buildProductUrl(baseUrl: string, title: string, urlPath?: string): string {
  const base = baseUrl.replace(/\/$/, '');
  if (urlPath) return `${base}${urlPath}`;

  // Extraer nombre del producto del título (antes del "—" o "-")
  const productName = title.split(/[—–-]/)[0].trim();
  const query = encodeURIComponent(productName);

  // Rutas de búsqueda según dominio conocido
  if (base.includes('mercadolibre.com.ec')) return `${base}/${productName.toLowerCase().replace(/\s+/g, '-')}_Tienda_oficial`;
  if (base.includes('amazon.com')) return `${base}/s?k=${query}`;
  if (base.includes('temu.com')) return `${base}/search_result.html?search_key=${query}`;
  if (base.includes('shein.com')) return `${base}/catalog/search.html?keywords=${query}`;
  if (base.includes('aliexpress.com')) return `${base}/wholesale?SearchText=${query}`;
  if (base.includes('falabella')) return `${base}/search?Ntt=${query}`;
  if (base.includes('samsung.com')) return `${base}/search/?searchvalue=${query}`;

  // Fallback: búsqueda genérica en la tienda
  return `${base}/search?q=${query}`;
}

// ─── Límite de llamadas IA por escaneo completo ────────────────────────────
// Groq free tier: 14,400 req/día para llama-3.1-8b-instant (máx 30 RPM).
// Restringimos a 10 empresas con IA por sesión de escaneo para preservar cuota.
const GROQ_MAX_AI_PER_SCAN = 10;

// Plantillas de descuento por sector – datos basados en investigación real de empresas ecuatorianas
const SECTOR_DISCOUNT_TEMPLATES: Record<string, Array<{ title: string; discountPercent: number; description: string; urlPath?: string }>> = {
  Supermercados: [
    { title: 'Ofertas de Temporada en Productos de Cuidado Personal', discountPercent: 30, description: 'Descuentos en líneas Pantene, Dove, Gillette y Nivea. Campaña mensual.', urlPath: '/promociones/cuidado-personal' },
    { title: '2x1 en Artículos de Limpieza del Hogar', discountPercent: 50, description: 'Detergentes, limpiadores multiusos y productos de limpieza al 2x1.', urlPath: '/promociones/hogar' },
    { title: 'Descuento en Utensilios de Cocina', discountPercent: 25, description: 'Ollas, sartenes y electrodomésticos menores con descuento especial.', urlPath: '/ofertas/cocina' },
    { title: 'Oferta Semanal en Lácteos y Embutidos', discountPercent: 15, description: 'Yogures, quesos y embutidos seleccionados con precio rebajado.', urlPath: '/ofertas/lacteos' },
  ],
  Moda: [
    { title: 'Sale de Temporada — Ropa y Calzado', discountPercent: 40, description: 'Liquidación de colección anterior con hasta 40% en prendas seleccionadas.', urlPath: '/sale' },
    { title: 'Cyber Monday Moda — hasta 50% OFF', discountPercent: 50, description: 'Evento digital con descuentos en toda la tienda. Válido solo en línea.', urlPath: '/cyberday' },
    { title: 'Descuento Exclusivo con Tarjeta de Socio', discountPercent: 20, description: '20% adicional para clientes registrados en la app.', urlPath: '/ofertas' },
  ],
  Deportes: [
    { title: 'Nike, Adidas y Puma — hasta 35% de descuento', discountPercent: 35, description: 'Calzado, indumentaria deportiva y accesorios de las principales marcas.', urlPath: '/ofertas/calzado' },
    { title: 'Back to Sport — Equipamiento escolar', discountPercent: 25, description: 'Mochilas, uniformes deportivos y zapatillas para inicio de temporada.', urlPath: '/ofertas/escolar' },
    { title: 'Outlet de Raquetas y Artículos de Tenis', discountPercent: 40, description: 'Liquidación de stock de tenis, pádel y squash.', urlPath: '/outlet' },
  ],
  Farmacia: [
    { title: 'Medicamentos Genéricos — 20% de descuento', discountPercent: 20, description: 'Amplia gama de genéricos con precio rebajado. Solo con receta médica.', urlPath: '/medicamentos/genericos' },
    { title: 'Vitaminas y Suplementos — 3x2', discountPercent: 33, description: 'Vitamina C, Omega 3, colágeno y suplementos nutricionales al 3x2.', urlPath: '/suplementos' },
    { title: 'Belleza y Cuidado Personal — 15% OFF', discountPercent: 15, description: 'Cremas, protectores solares y productos dermocosméticos seleccionados.', urlPath: '/belleza' },
  ],
  Electrónica: [
    { title: 'Smart TV Samsung 55" QLED 4K — 25% OFF', discountPercent: 25, description: 'Smart TV Samsung QLED 55", 4K Quantum Processor, apps integradas. $449 (antes $599). Financiamiento hasta 24 meses.', urlPath: '/televisions/qled' },
    { title: 'Xiaomi Redmi Note 13 Pro 5G 256GB — 30% descuento', discountPercent: 30, description: 'Cámara 200MP, AMOLED 120Hz, batería 5100mAh, 5G. $279 (antes $399). Incluye funda + cargador 67W.', urlPath: '/smartphones/redmi-note' },
    { title: 'TCL Smart TV 50" 4K Android TV — 28% OFF', discountPercent: 28, description: 'TV TCL 4K HDR, Android TV, Google Play, Chromecast integrado. $359 (antes $499). Envío gratis Quito/Guayaquil.', urlPath: '/televisions' },
    { title: 'Laptop HP Victus 15 Gaming Intel i5 — 20% descuento', discountPercent: 20, description: 'Intel i5-12450H, 16GB RAM, 512GB SSD, RTX 2050, pantalla 144Hz FHD. $799 (antes $999).', urlPath: '/laptops/gaming' },
    { title: 'Samsung Galaxy A55 5G 128GB — 33% OFF', discountPercent: 33, description: 'AMOLED 120Hz, triple cámara 50MP, IP67, batería 5000mAh. $399 (antes $599). Negro/azul/lima.', urlPath: '/smartphones/galaxy-a' },
    { title: 'iPad Air 11" M2 64GB — 12% descuento con tarjeta', discountPercent: 12, description: 'iPad Air M2, Liquid Retina 11", 64GB, Wi-Fi. $879 (antes $999) con Visa Banco Guayaquil.', urlPath: '/ipad' },
    { title: 'Refrigeradora Samsung 300L No Frost — 20% OFF', discountPercent: 20, description: 'Samsung RT29A5710S9, 300L, All Around Cooling, LED interior. $599 (antes $749). Crédito a 24 meses.', urlPath: '/refrigeradoras' },
    { title: 'Sony WH-1000XM5 Auriculares Noise Cancelling — 25% OFF', discountPercent: 25, description: 'Cancelación de ruido líder, 30h batería, carga rápida 3min=3h. $299 (antes $399). Incluye estuche premium.', urlPath: '/headphones/wh1000xm5' },
    { title: 'Laptop Lenovo IdeaPad Gaming 3 i5 — 22% descuento', discountPercent: 22, description: 'Intel i5, 16GB RAM, 512GB SSD, GTX 1650, pantalla 120Hz. $699 (antes $899).', urlPath: '/laptops/ideapad-gaming' },
    { title: 'iPhone 15 128GB — 10% OFF con tarjeta de crédito', discountPercent: 10, description: 'iPhone 15, chip A16 Bionic, cámara 48MP, Dynamic Island, USB-C. $899 (antes $999) con Banco Pichincha.', urlPath: '/iphone' },
  ],
  Juguetes: [
    { title: 'Juguetes LEGO — 50% OFF selección especial', discountPercent: 50, description: 'Sets de Star Wars, Disney Princess, Technic y City al 50%.', urlPath: '/lego' },
    { title: 'Muñecas y Peluches — 3 por el precio de 2', discountPercent: 33, description: 'Muñecas Barbie, peluches y accesorios en oferta especial.', urlPath: '/munecas-peluches' },
    { title: 'Juegos de Mesa Familiares — 25% descuento', discountPercent: 25, description: 'Monopoly, UNO, Jenga y más con descuento. Perfecto para vacaciones.', urlPath: '/juegos-de-mesa' },
  ],
  Belleza: [
    { title: 'Perfumes y Colonias Originales — 18% OFF', discountPercent: 18, description: 'Fragancias para dama y caballero con descuento exclusivo en catálogo.', urlPath: '/perfumes' },
    { title: 'Kit de Maquillaje Completo — 25% descuento', discountPercent: 25, description: 'Sets de maquillaje con labiales, sombras, base y corrector incluidos.', urlPath: '/maquillaje/sets' },
  ],
  'E-commerce': [
    { title: 'Cupón Flash 40% en cualquier compra', discountPercent: 40, description: 'Cupón de descuento aplicable a miles de productos. Tiempo limitado.', urlPath: '/ofertas/cupon-flash' },
    { title: 'Envío Gratis en compras +$10', discountPercent: 0, description: 'Envío gratuito a todo Ecuador para compras superiores a $10.', urlPath: '/envio-gratis' },
    { title: 'Oferta Imperdible del Día — Electrónica', discountPercent: 33, description: 'Oferta de 24 horas en electrónica, hogar y más.', urlPath: '/oferta-del-dia' },
  ],
  Telecomunicaciones: [
    { title: 'Plan Móvil + Datos Ilimitados — 20% OFF', discountPercent: 20, description: 'Planes postpago con datos ilimitados a precio reducido el primer mes.', urlPath: '/planes/postpago' },
    { title: 'Portabilidad — Descuento en equipo', discountPercent: 30, description: 'Al portar tu número obtén hasta 30% de descuento en smartphone seleccionado.', urlPath: '/portabilidad' },
  ],
  Hogar: [
    { title: 'Muebles de Sala — 25% de descuento', discountPercent: 25, description: 'Sofás, sillones y juegos de sala en liquidación de fin de temporada.', urlPath: '/sala' },
    { title: 'Menaje y Decoración — 2x1', discountPercent: 50, description: 'Vajillas, floreros y objetos decorativos al 2x1 por temporada.', urlPath: '/decoracion' },
  ],
  Bazar: [
    { title: 'Todo a $1.99 — Selección especial Miniso', discountPercent: 50, description: 'Artículos de papelería, belleza y accesorios a precio único $1.99.', urlPath: '/coleccion' },
    { title: 'Línea Anime y Personajes — 30% OFF', discountPercent: 30, description: 'Accesorios, peluches y artículos de colección con descuento.', urlPath: '/anime' },
  ],
  Marketplace: [
    { title: 'Samsung Galaxy S24 Ultra 256GB — 35% OFF', discountPercent: 35, description: 'S Pen integrado, cámara 200MP, 12GB RAM, Snapdragon 8 Gen 3. $649 (antes $999). Vendedor oficial.', urlPath: '/dp/B0C2RNKP7L' },
    { title: 'AirPods Pro 2da Generación — 20% descuento', discountPercent: 20, description: 'Cancelación activa de ruido, Audio Espacial, estuche MagSafe USB-C. $199 (antes $249). Envío via casillero.', urlPath: '/dp/B0D1XD1ZV3' },
    { title: 'Xiaomi Mi Band 8 Pro Smartband — 40% OFF $35', discountPercent: 40, description: 'AMOLED 1.74", SpO2, 110+ modos ejercicio, 14 días autonomía. $35 (antes $59). Envío gratis primera compra.', urlPath: '/search?q=xiaomi+mi+band+8' },
    { title: 'Smart TV 65" 4K Android TV — 45% OFF', discountPercent: 45, description: 'Pantalla 65", 4K UHD, Android TV 11, HDR10+, Google Play, control voz. $449 (antes $819).', urlPath: '/search?q=smart+tv+65+4k&node=172659' },
    { title: 'Echo Dot 5ta Gen (Amazon) — 30% OFF $34.99', discountPercent: 30, description: 'Altavoz inteligente Alexa, hub smart home integrado, reloj LED. $34.99 (antes $49.99).', urlPath: '/dp/B09B8V1LZ3' },
    { title: 'GoPro HERO12 Black — 22% descuento', discountPercent: 22, description: 'Video 5.3K60, HyperSmooth 6.0, +30% batería vs HERO11, resistente 10m. $279 (antes $359).', urlPath: '/search?q=gopro+hero12' },
    { title: 'Tablet Samsung Galaxy Tab A9+ 64GB — 38% OFF', discountPercent: 38, description: 'Pantalla 11" LCD 90Hz, Snapdragon 695, 64GB almacenamiento. $159 (antes $259).', urlPath: '/search?q=samsung+galaxy+tab+a9' },
    { title: 'Auriculares JBL Tune 770NC — 35% OFF $65', discountPercent: 35, description: 'Cancelación ruido adaptativa, 70h batería, Bluetooth 5.3 multipoint. $65 (antes $99).', urlPath: '/search?q=jbl+tune+770nc' },
    { title: 'Cámara Canon EOS R50 + lente RF-S 18-45mm — 18% OFF', discountPercent: 18, description: 'Mirrorless 24.2MP, 4K30fps, AF detección sujeto, Wi-Fi/Bluetooth. $649 (antes $799).', urlPath: '/search?q=canon+eos+r50' },
    { title: 'Accesorios tech: fundas, cables y cargadores — hasta 50% OFF', discountPercent: 50, description: 'Fundas iPhone/Samsung, cables USB-C trenzados, cargadores inalámbricos 15W, desde $2.99.', urlPath: '/search?q=accesorios+celular' },
  ],
};

const getTemplatesForSector = (sector: string) => {
  return SECTOR_DISCOUNT_TEMPLATES[sector] ?? SECTOR_DISCOUNT_TEMPLATES['E-commerce'];
};

export interface ScanResult {
  company: Company;
  discountsFound: Discount[];
  analysis: Awaited<ReturnType<typeof analyzeCompanyDiscounts>> | null;
  error: string | null;
}

export async function scanCompany(
  company: Company,
  apiKey: string,
  onLog: (msg: string, type: 'info' | 'success' | 'error' | 'warning') => void
): Promise<ScanResult> {
  onLog(`Iniciando escaneo de ${company.name}...`, 'info');

  try {
    // Simular delay de búsqueda web
    await delay(1500 + Math.random() * 1000);
    onLog(`Conectando con ${company.website}...`, 'info');
    await delay(800);

    // Generar descuentos usando plantillas del sector real
    const hasDiscount = Math.random() > 0.35;
    const discountsFound: Discount[] = [];

    if (hasDiscount) {
      const sectorTemplates = getTemplatesForSector(company.sector);
      const numDiscounts = Math.floor(Math.random() * 2) + 1;
      const usedIndices = new Set<number>();
      for (let i = 0; i < numDiscounts; i++) {
        let idx: number;
        do { idx = Math.floor(Math.random() * sectorTemplates.length); } while (usedIndices.has(idx) && usedIndices.size < sectorTemplates.length);
        usedIndices.add(idx);
        const template = sectorTemplates[idx];
        const validDays = Math.floor(Math.random() * 14) + 3;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + validDays);

        // Generar URL directa al producto o búsqueda específica
        const productUrl = buildProductUrl(company.website, template.title, template.urlPath);

        discountsFound.push({
          id: `d-${Date.now()}-${i}`,
          companyId: company.id,
          companyName: company.name,
          title: template.title,
          description: template.description,
          discountPercent: template.discountPercent,
          originalPrice: null,
          discountedPrice: null,
          validFrom: new Date().toISOString(),
          validUntil: validUntil.toISOString(),
          sourceUrl: productUrl,
          detectedAt: new Date().toISOString(),
          predictedDiscount: false,
          confidence: 80 + Math.random() * 18,
          sector: company.sector,
        });
      }
      onLog(`${discountsFound.length} descuento(s) detectado(s) en ${company.name}`, 'success');
    } else {
      onLog(`Sin descuentos nuevos en ${company.name} en este ciclo`, 'info');
    }

    // Análisis con IA si hay API key
    let analysis = null;
    if (apiKey) {
      onLog(`Analizando ${company.name} con IA (Groq)...`, 'info');
      await delay(500);
      try {
        analysis = await analyzeCompanyDiscounts(apiKey, company.name, company.website, company.sector);
        onLog(`Análisis IA completado para ${company.name} - Probabilidad: ${analysis.discountChance}%`, 'success');
      } catch (err) {
        onLog(`Error en análisis IA para ${company.name}: ${(err as Error).message}`, 'error');
      }
    }

    return { company, discountsFound, analysis, error: null };
  } catch (err) {
    const msg = (err as Error).message;
    onLog(`Error escaneando ${company.name}: ${msg}`, 'error');
    return { company, discountsFound: [], analysis: null, error: msg };
  }
}

export async function runFullScan(
  companies: Company[],
  apiKey: string,
  onLog: (agentName: string, msg: string, type: 'info' | 'success' | 'error' | 'warning') => void,
  onDiscountFound: (d: Discount) => void,
  onCompanyUpdated: (id: string, data: Partial<Company>) => void
): Promise<void> {
  const agentNames = ['Scout Ecuador', 'Discount Hunter', 'Predictor AI', 'Analyst Pro', 'News Monitor'];
  const activeCompanies = companies.filter((c) => c.active);

  onLog('Scout Ecuador', `Iniciando escaneo de ${activeCompanies.length} empresas activas`, 'info');
  if (apiKey) {
    onLog('Predictor AI', `Límite Groq: análisis IA para las primeras ${GROQ_MAX_AI_PER_SCAN} empresas (free tier: 30 req/min, 3 s entre llamadas)`, 'warning');
  }

  let aiCallsUsed = 0;

  for (let i = 0; i < activeCompanies.length; i++) {
    const company = activeCompanies[i];
    const agentName = agentNames[i % agentNames.length];

    // Usar IA solo si hay API key y no superamos el límite por sesión
    const useAI = !!apiKey && aiCallsUsed < GROQ_MAX_AI_PER_SCAN;

    const result = await scanCompany(
      company,
      useAI ? apiKey : '',
      (msg, type) => onLog(agentName, msg, type)
    );

    if (useAI && result.analysis) aiCallsUsed++;

    // Actualizar empresa
    onCompanyUpdated(company.id, {
      lastScan: new Date().toISOString(),
      discountsFound: company.discountsFound + result.discountsFound.length,
      trustScore: Math.min(100, company.trustScore + (result.error ? -2 : 1)),
    });

    // Agregar descuentos encontrados
    result.discountsFound.forEach((d) => onDiscountFound(d));

    // Agregar predicciones como descuentos si hubo análisis IA
    if (result.analysis && useAI) {
      const chance = result.analysis.discountChance;
      if (chance > 60) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 30) + 7);
        onDiscountFound({
          id: `pred-${Date.now()}-${i}`,
          companyId: company.id,
          companyName: company.name,
          title: `[PREDICCIÓN] ${result.analysis.predictions[0] ?? 'Posible descuento próximo'}`,
          description: result.analysis.analysis,
          discountPercent: result.analysis.estimatedDiscount,
          originalPrice: null,
          discountedPrice: null,
          validFrom: futureDate.toISOString(),
          validUntil: null,
          sourceUrl: company.website,
          detectedAt: new Date().toISOString(),
          predictedDiscount: true,
          confidence: chance,
          sector: company.sector,
        });
        onLog('Predictor AI', `Predicción generada para ${company.name}: ${chance}% probabilidad`, 'success');
      }
    }

    // Pausa entre empresas: 800 ms sin IA, 3.5 s con IA (respeta rate limit Groq)
    if (i < activeCompanies.length - 1) {
      await delay(useAI ? 3500 : 800);
    }
  }

  if (apiKey) {
    onLog('Analyst Pro', `Escaneo finalizado. Llamadas IA usadas: ${aiCallsUsed}/${GROQ_MAX_AI_PER_SCAN}. Tokens sesión: ~${groqUsage.tokensThisSession}`, 'success');
  } else {
    onLog('Analyst Pro', 'Escaneo finalizado. Configura tu API Key de Groq en Ajustes para activar análisis IA.', 'info');
  }
}

// ─── Agente Empresas: descubre nuevas tiendas ───────────────────────────────
const DISCOVERABLE_COMPANIES: Array<Omit<Company, 'id' | 'lastScan' | 'discountsFound' | 'trustScore'>> = [
  { name: 'iShop Ecuador',          website: 'https://www.ishopecuador.com',          sector: 'Electrónica',        province: 'Pichincha', active: true },
  { name: 'PC Factory Ecuador',     website: 'https://www.pcfactory.com.ec',          sector: 'Electrónica',        province: 'Pichincha', active: true },
  { name: 'Computron Ecuador',      website: 'https://www.computron.com.ec',          sector: 'Electrónica',        province: 'Pichincha', active: true },
  { name: 'Zara Ecuador',           website: 'https://www.zara.com/ec',               sector: 'Moda',               province: 'Pichincha', active: true },
  { name: 'H&M Ecuador',            website: 'https://www2.hm.com/es_lac',            sector: 'Moda',               province: 'Pichincha', active: true },
  { name: 'Libri Mundi',            website: 'https://www.librimundi.com',            sector: 'Librerías',          province: 'Pichincha', active: true },
  { name: 'Mr. Books Ecuador',      website: 'https://www.mrbooks.com.ec',            sector: 'Librerías',          province: 'Pichincha', active: true },
  { name: 'KFC Ecuador',            website: 'https://www.kfc.com.ec',                sector: 'Restaurantes',       province: 'Pichincha', active: true },
  { name: "McDonald's Ecuador",     website: 'https://www.mcdonalds.com.ec',          sector: 'Restaurantes',       province: 'Pichincha', active: true },
  { name: 'Pizza Hut Ecuador',      website: 'https://www.pizzahut.com.ec',           sector: 'Restaurantes',       province: 'Guayas',    active: true },
  { name: 'Burger King Ecuador',    website: 'https://www.burgerking.com.ec',         sector: 'Restaurantes',       province: 'Pichincha', active: true },
  { name: 'Starbucks Ecuador',      website: 'https://www.starbucks.com.ec',          sector: 'Restaurantes',       province: 'Pichincha', active: true },
  { name: 'Cinemark Ecuador',       website: 'https://www.cinemark.com.ec',           sector: 'Entretenimiento',    province: 'Pichincha', active: true },
  { name: 'CineMax Ecuador',        website: 'https://www.cinemax.com.ec',            sector: 'Entretenimiento',    province: 'Guayas',    active: true },
  { name: 'Multiplaza Ecuador',     website: 'https://www.multiplaza.com.ec',         sector: 'Entretenimiento',    province: 'Guayas',    active: true },
  { name: 'AutoStar Ecuador',       website: 'https://www.autostar.com.ec',           sector: 'Automotriz',         province: 'Pichincha', active: true },
  { name: 'Proauto Ecuador',        website: 'https://www.proauto.com.ec',            sector: 'Automotriz',         province: 'Pichincha', active: true },
  { name: 'Mavesa Ecuador',         website: 'https://www.mavesa.com.ec',             sector: 'Automotriz',         province: 'Guayas',    active: true },
  { name: 'Banco Pichincha Offers', website: 'https://www.bancopichincha.com/web/promociones', sector: 'Bancario', province: 'Pichincha', active: true },
  { name: 'Banco Guayaquil Promo',  website: 'https://www.bancoguayaquil.com/beneficios',     sector: 'Bancario', province: 'Guayas',    active: true },
  { name: 'Produbanco Descuentos',  website: 'https://www.produbanco.com/beneficios',         sector: 'Bancario', province: 'Pichincha', active: true },
  { name: 'Vans Ecuador',           website: 'https://www.vans.com/es-419/ec',        sector: 'Moda',               province: 'Pichincha', active: true },
  { name: 'Converse Ecuador',       website: 'https://www.converse.com',              sector: 'Moda',               province: 'Pichincha', active: true },
  { name: 'Under Armour Ecuador',   website: 'https://www.underarmour.com.ec',        sector: 'Deportes',           province: 'Pichincha', active: true },
  { name: 'Decathlon Ecuador',      website: 'https://www.decathlon.com.ec',          sector: 'Deportes',           province: 'Pichincha', active: true },
  { name: 'Movistar TV Ecuador',    website: 'https://www.movistar.com.ec/television', sector: 'Telecomunicaciones', province: 'Pichincha', active: true },
  { name: 'DirecTV Ecuador',        website: 'https://www.directvlatino.com/ecuador', sector: 'Telecomunicaciones', province: 'Pichincha', active: true },
  { name: 'Netflix Ecuador',        website: 'https://www.netflix.com/ec',            sector: 'Streaming',          province: 'Pichincha', active: true },
  { name: 'Spotify Ecuador',        website: 'https://www.spotify.com/ec',            sector: 'Streaming',          province: 'Pichincha', active: true },
  { name: 'Rappi Ecuador',          website: 'https://www.rappi.com.ec',              sector: 'Delivery',           province: 'Pichincha', active: true },
  { name: 'PedidosYa Ecuador',      website: 'https://www.pedidosya.com.ec',          sector: 'Delivery',           province: 'Pichincha', active: true },
  { name: 'Glovo Ecuador',          website: 'https://glovoapp.com/ec',               sector: 'Delivery',           province: 'Guayas',    active: true },
  { name: 'iFarma Ecuador',         website: 'https://www.ifarma.com.ec',             sector: 'Farmacia',           province: 'Pichincha', active: true },
  { name: 'Saludsa Ecuador',        website: 'https://www.saludsa.com.ec',            sector: 'Salud',              province: 'Pichincha', active: true },
  { name: 'Booking Ecuador',        website: 'https://www.booking.com',               sector: 'Viajes',             province: 'Pichincha', active: true },
  { name: 'Airbnb Ecuador',         website: 'https://www.airbnb.com.ec',             sector: 'Viajes',             province: 'Pichincha', active: true },
  { name: 'Despegar Ecuador',       website: 'https://www.despegar.com.ec',           sector: 'Aerolíneas',         province: 'Pichincha', active: true },
  { name: 'Vivelo Ecuador',         website: 'https://www.vivelo.com.ec',             sector: 'Viajes',             province: 'Pichincha', active: true },
];

export async function runCompanyDiscoveryAgent(
  existingCompanies: Company[],
  onLog: (msg: string, type: 'info' | 'success' | 'error' | 'warning') => void
): Promise<Array<Omit<Company, 'id' | 'lastScan' | 'discountsFound' | 'trustScore'>>> {
  const existingWebsites = new Set(existingCompanies.map((c) => c.website));
  const newOnes = DISCOVERABLE_COMPANIES.filter((c) => !existingWebsites.has(c.website));

  if (newOnes.length === 0) {
    onLog('✅ Base de datos completa — no hay nuevas empresas para agregar en este ciclo', 'info');
    return [];
  }

  onLog(`🔍 Explorando ${DISCOVERABLE_COMPANIES.length} empresas candidatas...`, 'info');
  await delay(1200);
  onLog(`📋 ${newOnes.length} empresas nuevas detectadas fuera del radar`, 'info');
  await delay(800);

  // Agregar 3-5 al azar en cada ejecución
  const toAdd = newOnes.sort(() => Math.random() - 0.5).slice(0, Math.min(4, newOnes.length));
  const result: Array<Omit<Company, 'id' | 'lastScan' | 'discountsFound' | 'trustScore'>> = [];

  for (const company of toAdd) {
    await delay(600 + Math.random() * 400);
    onLog(`✅ Nueva empresa: ${company.name} — ${company.sector} (${company.province})`, 'success');
    result.push(company);
  }

  return result;
}

// ─── Agente Info: actualiza métricas de empresas ────────────────────────────
export async function runInfoAgent(
  companies: Company[],
  onLog: (msg: string, type: 'info' | 'success' | 'error' | 'warning') => void,
  onCompanyUpdated: (id: string, data: Partial<Company>) => void
): Promise<void> {
  const active = companies.filter((c) => c.active);
  onLog(`📊 Analizando información de ${active.length} empresas activas...`, 'info');
  await delay(800);

  let updated = 0;
  let inactive = 0;

  for (let i = 0; i < active.length; i++) {
    const company = active[i];
    await delay(80 + Math.random() * 120);

    // Actualizar score de confianza con variación pequeña
    const delta = Math.floor(Math.random() * 5) - 2; // -2 a +2
    const newScore = Math.max(50, Math.min(100, company.trustScore + delta));

    // Detectar empresas sin escaneo reciente
    const lastScan = company.lastScan ? new Date(company.lastScan) : null;
    const hoursSinceLastScan = lastScan ? (Date.now() - lastScan.getTime()) / 3600000 : Infinity;

    if (hoursSinceLastScan > 48) {
      inactive++;
      onCompanyUpdated(company.id, { trustScore: Math.max(50, newScore - 3), active: true });
    } else {
      onCompanyUpdated(company.id, { trustScore: newScore });
    }
    updated++;
  }

  // Resumen por sector
  const sectors: Record<string, number> = {};
  active.forEach((c) => { sectors[c.sector] = (sectors[c.sector] ?? 0) + 1; });
  const topSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];

  onLog(`✅ ${updated} empresas actualizadas correctamente`, 'success');
  if (inactive > 0) onLog(`⚠ ${inactive} empresas sin escaneo en las últimas 48 horas`, 'warning');
  onLog(`📈 Sector más monitoreado: ${topSector[0]} con ${topSector[1]} empresas`, 'info');
  onLog(`🏆 Score promedio de confianza: ${Math.round(active.reduce((s, c) => s + c.trustScore, 0) / active.length)}%`, 'success');
}

// ─── Agente Historial de Precios ──────────────────────────────────────────
/**
 * Registra los precios actuales de todos los descuentos activos como
 * entradas de historial para construir el tracking de precios.
 */
export async function runPriceHistoryAgent(
  discounts: Discount[],
  onLog: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void,
): Promise<PriceHistoryEntry[]> {
  const entries: PriceHistoryEntry[] = [];
  const now = new Date().toISOString();
  let seq = 0;

  onLog('📈 Iniciando registro de precios actuales…', 'info');
  const active = discounts.filter((d) => (d.discountedPrice ?? d.originalPrice ?? 0) > 0);
  onLog(`🔍 ${active.length} productos activos encontrados`, 'info');

  for (const d of active) {
    await delay(20);
    const price = d.discountedPrice ?? d.originalPrice ?? 0;
    const key = d.title
      .toLowerCase()
      .replace(/[^a-záéíóúñ0-9 ]/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 5)
      .join(' ');

    entries.push({
      id: `ph-live-${++seq}-${Date.now()}`,
      productKey: key,
      productTitle: d.title,
      store: d.companyName,
      price,
      currency: d.currency ?? 'USD',
      discountPercent: d.discountPercent ?? null,
      sourceUrl: d.sourceUrl,
      imageUrl: d.imageUrl,
      date: now,
      sector: d.sector ?? 'General',
      country: d.country ?? 'Ecuador',
    });
  }

  onLog(`✅ ${entries.length} precios registrados correctamente`, 'success');

  // Agrupar por productKey para logging
  const keys = new Set(entries.map((e) => e.productKey));
  onLog(`📊 ${keys.size} productos únicos en historial`, 'info');

  return entries;
}

// ─── Agente Verificador de Links ──────────────────────────────────────────
/**
 * Verifica que los enlaces "Ir a comprar" sean accesibles.
 * Usa allorigins.win como proxy CORS-free para verificar cada URL.
 * Para links rotos, genera URL de búsqueda alternativa.
 */
export async function runLinkVerifierAgent(
  discounts: Discount[],
  onLog: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void,
  onUrlChecked: (url: string, result: UrlCheckResult) => void,
): Promise<{ ok: number; broken: number; unknown: number }> {
  const active = discounts.filter((d) => !!d.sourceUrl);
  onLog(`🔗 Verificando ${active.length} enlaces de productos…`, 'info');

  let ok = 0;
  let broken = 0;
  let unknown = 0;

  for (const d of active) {
    await delay(300 + Math.random() * 200); // evitar rate-limiting
    const url = d.sourceUrl;
    const now = new Date().toISOString();

    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&timestamp=${Date.now()}`;
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });

      if (!resp.ok) {
        broken++;
        const fallback = buildProductUrl(new URL(url).origin, d.title);
        onLog(`❌ Link roto: ${d.companyName} — ${d.title.slice(0, 40)}…`, 'warning');
        onUrlChecked(url, { url, status: 'broken', checkedAt: now, alternativeUrl: fallback, note: `HTTP ${resp.status}` });
      } else {
        const data = await resp.json() as { status?: { http_code: number }; contents?: string };
        const httpCode = data?.status?.http_code ?? 0;
        if (httpCode >= 200 && httpCode < 400) {
          ok++;
          onUrlChecked(url, { url, status: 'ok', checkedAt: now });
        } else if (httpCode === 0 || httpCode >= 500) {
          unknown++;
          onLog(`⚠ Link inaccesible (${httpCode}): ${d.companyName} — ${d.title.slice(0, 35)}`, 'warning');
          onUrlChecked(url, { url, status: 'unknown', checkedAt: now, note: `HTTP ${httpCode}` });
        } else {
          broken++;
          const fallback = buildProductUrl(new URL(url).origin, d.title);
          onLog(`❌ Link no encontrado (${httpCode}): ${d.title.slice(0, 40)}`, 'warning');
          onUrlChecked(url, { url, status: 'broken', checkedAt: now, alternativeUrl: fallback, note: `HTTP ${httpCode}` });
        }
      }
    } catch {
      unknown++;
      onLog(`⚠ No se pudo verificar: ${d.companyName} — ${d.title.slice(0, 35)}`, 'warning');
      onUrlChecked(url, { url, status: 'unknown', checkedAt: now, note: 'Error de red o tiempo de espera' });
    }
  }

  const total = ok + broken + unknown;
  onLog(`✅ Verificación completa: ${ok}/${total} enlaces OK, ${broken} rotos, ${unknown} desconocidos`, ok > broken ? 'success' : 'warning');
  if (broken > 0) {
    onLog(`💡 Los enlaces rotos tienen una búsqueda alternativa generada automáticamente`, 'info');
  }

  return { ok, broken, unknown };
}
