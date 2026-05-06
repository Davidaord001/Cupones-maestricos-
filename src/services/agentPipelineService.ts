/**
 * agentPipelineService.ts  v3
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║  SISTEMA DE 5 AGENTES DE VERIFICACIÓN                              ║
 * ║  Cada producto pasa 5 controles antes de aparecer en la app.       ║
 * ║  Agente 1 — URL Viva      : HEAD ping a la URL del producto       ║
 * ║  Agente 2 — Dominio Real  : dominio en lista de tiendas de confianza║
 * ║  Agente 3 — Precio Real   : precio > 0, original > descuento       ║
 * ║  Agente 4 — Descuento     : 3-85%, consistente con precios         ║
 * ║  Agente 5 — Datos Completos: título, desc, URL, país presentes     ║
 * ║  → Solo aprueba con ≥4/5. Menos de 4 = RECHAZADO.                 ║
 * ╚════════════════════════════════════════════════════════════════════╝
 *
 * LOOP RAPIDO  (cada 10 min) — verificar imágenes + purgar URLs rotas
 * LOOP MEDIO   (cada 30 min) — escanear empresas → 5 agentes → aprobar/rechazar
 * LOOP DIVISA  (cada  8 h)   — actualizar tipo de cambio COP/USD
 * LOOP PREDICT (cada 12 h)   — predicciones IA + digest Telegram
 */

import { fetchExchangeRates } from './currencyService';
import { sendTelegramMessage, buildDailyDigest } from './telegramService';
import { scanCompany } from './agentService';
import { startPriceRefreshCycle, stopPriceRefreshCycle } from './mlSearchService';
import type { Discount, Company, UrlCheckResult } from '../store/types';

const MS_VERIFY   = 10 * 60 * 1000;
const MS_SCAN     = 30 * 60 * 1000;
const MS_EXCHANGE =  8 * 60 * 60 * 1000;
const MS_PREDICT  = 12 * 60 * 60 * 1000;

const SCAN_BATCH      = 6;
const MAX_DISCOUNTS   = 300;
const MAX_PURGE_CYCLE = 15;

// ── Dominios de tiendas reales verificadas ────────────────────────────────────
const TRUSTED_DOMAINS = new Set([
  // Ecuador
  'mercadolibre.com.ec', 'listado.mercadolibre.com.ec',
  'laganga.com', 'artefacta.com', 'supermaxi.com', 'tia.com.ec',
  'coral.com.ec', 'ktronix.ec', 'etafashion.com', 'marathon.com.ec',
  'fybeca.com', 'medicity.ec', 'nike.com.ec', 'adidas.com.ec',
  // Colombia
  'alkosto.com', 'falabella.com.co', 'exito.com', 'homecenter.com.co',
  'tiendasjumbo.co', 'ktronix.com.co', 'olimpica.com.co',
  'linio.com.co', 'carrefour.com.co', 'paris.com.co',
  'ripley.com.co', 'farmatodo.com.co',
  // Internacional
  'amazon.com', 'amazon.com.mx', 'aliexpress.com', 'temu.com',
  'shein.com', 'ebay.com', 'apple.com', 'samsung.com',
]);

// ── Rangos de precio válido por sector (USD) ──────────────────────────────────
const PRICE_RANGES: Record<string, [number, number]> = {
  'Electrónica':   [10, 8000],
  'Retail':        [5, 6000],
  'Supermercados': [1, 500],
  'Moda':          [5, 2000],
  'Farmacia':      [1, 800],
  'Deportes':      [5, 3000],
  'Hogar':         [20, 5000],
  'Juguetes':      [3, 1000],
  'Belleza':       [3, 600],
  'E-commerce':    [1, 8000],
  'default':       [1, 10000],
};

interface PipelineStatus {
  running: boolean;
  scanCursor: number;
  lastScan: number | null;
  lastVerify: number | null;
  lastExchange: number | null;
  lastPredict: number | null;
  discountsAdded: number;
  discountsPurged: number;
  discountsRejected: number;
  scanCycles: number;
  verificationsPassed: number;
  verificationsRejected: number;
}

const _status: PipelineStatus = {
  running: false,
  scanCursor: 0,
  lastScan: null,
  lastVerify: null,
  lastExchange: null,
  lastPredict: null,
  discountsAdded: 0,
  discountsPurged: 0,
  discountsRejected: 0,
  scanCycles: 0,
  verificationsPassed: 0,
  verificationsRejected: 0,
};

const _timers: ReturnType<typeof setInterval>[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStore = Record<string, any>;
let _getState: (() => AnyStore) | null = null;
type LogType = 'info' | 'success' | 'error' | 'warning';
let _log: ((msg: string, type: LogType) => void) | null = null;

export function initPipeline(getState: () => unknown, logFn: (msg: string, type: LogType) => void): void {
  _getState = getState as () => AnyStore;
  _log = logFn;
}

function store(): AnyStore {
  if (!_getState) throw new Error('Pipeline no inicializado');
  return _getState();
}

function log(msg: string, type: LogType = 'info'): void {
  _log?.(msg, type);
}

function _companyCountry(company: Company): 'Ecuador' | 'Colombia' | 'Internacional' {
  if (company.province?.includes('COL')) return 'Colombia';
  const globalNames = ['Amazon', 'AliExpress', 'Temu', 'Shein', 'eBay'];
  if (globalNames.some((n) => company.name.includes(n))) return 'Internacional';
  return 'Ecuador';
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

// ════════════════════════════════════════════════════════════════════════
//  AGENTE 1 — URL VIVA
//  Verifica que la URL del producto responde (HEAD no-cors)
// ════════════════════════════════════════════════════════════════════════
async function agent1_urlAlive(d: Discount): Promise<{ ok: boolean; reason: string }> {
  try {
    await fetch(d.sourceUrl, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(7000) });
    return { ok: true, reason: 'URL activa' };
  } catch {
    return { ok: false, reason: `URL no responde: ${domainOf(d.sourceUrl)}` };
  }
}

// ════════════════════════════════════════════════════════════════════════
//  AGENTE 2 — DOMINIO REAL
//  Solo acepta dominios de la lista de tiendas verificadas
// ════════════════════════════════════════════════════════════════════════
function agent2_trustedDomain(d: Discount): { ok: boolean; reason: string } {
  const host = domainOf(d.sourceUrl);
  const trusted =
    TRUSTED_DOMAINS.has(host) ||
    [...TRUSTED_DOMAINS].some((td) => host.endsWith(`.${td}`) || host === td);
  return trusted
    ? { ok: true, reason: `Tienda verificada: ${host}` }
    : { ok: false, reason: `Dominio desconocido: ${host || '(vacío)'}` };
}

// ════════════════════════════════════════════════════════════════════════
//  AGENTE 3 — PRECIO REAL
//  Precio > 0, original > descuento, en rango para el sector
// ════════════════════════════════════════════════════════════════════════
function agent3_priceSanity(d: Discount): { ok: boolean; reason: string } {
  const orig = d.originalPrice;
  const disc = d.discountedPrice;
  if (!orig || !disc || orig <= 0 || disc <= 0)
    return { ok: false, reason: 'Precio nulo o negativo' };
  if (disc >= orig)
    return { ok: false, reason: `Precio descuento ≥ original ($${disc} ≥ $${orig})` };
  const [min, max] = PRICE_RANGES[d.sector] ?? PRICE_RANGES['default'];
  if (disc < min || disc > max)
    return { ok: false, reason: `$${disc} fuera de rango [$${min}-$${max}] para ${d.sector}` };
  return { ok: true, reason: `Precio válido: $${disc} (antes $${orig})` };
}

// ════════════════════════════════════════════════════════════════════════
//  AGENTE 4 — DESCUENTO CONSISTENTE
//  Entre 3% y 85%, y matemáticamente coherente con los precios
// ════════════════════════════════════════════════════════════════════════
function agent4_discountConsistent(d: Discount): { ok: boolean; reason: string } {
  const pct = d.discountPercent ?? 0;
  if (pct < 3 || pct > 85)
    return { ok: false, reason: `Descuento ${pct}% fuera de rango realista (3-85%)` };
  if (d.originalPrice && d.discountedPrice && d.originalPrice > 0) {
    const realPct = ((d.originalPrice - d.discountedPrice) / d.originalPrice) * 100;
    if (Math.abs(realPct - pct) > 15)
      return { ok: false, reason: `Descuento ${pct}% no coincide con precios (calculado: ${realPct.toFixed(1)}%)` };
  }
  return { ok: true, reason: `Descuento ${pct}% verificado` };
}

// ════════════════════════════════════════════════════════════════════════
//  AGENTE 5 — DATOS COMPLETOS
//  Título, descripción, URL, empresa y país presentes y válidos
// ════════════════════════════════════════════════════════════════════════
function agent5_dataComplete(d: Discount): { ok: boolean; reason: string } {
  const issues: string[] = [];
  if (!d.title || d.title.trim().length < 8)               issues.push('título corto');
  if (!d.description || d.description.trim().length < 15)  issues.push('descripción corta');
  if (!d.sourceUrl || !d.sourceUrl.startsWith('http'))      issues.push('URL inválida');
  if (!d.companyId)                                         issues.push('sin empresa');
  if (!d.country)                                           issues.push('sin país');
  if (d.validUntil && new Date(d.validUntil).getTime() < Date.now()) issues.push('oferta vencida');
  return issues.length > 0
    ? { ok: false, reason: `Datos incompletos: ${issues.join(', ')}` }
    : { ok: true, reason: 'Todos los campos completos' };
}

// ════════════════════════════════════════════════════════════════════════
//  GAUNTLET — EJECUTA LOS 5 AGENTES EN PARALELO
//  Score ≥ 4 → APROBADO  |  Score < 4 → RECHAZADO
// ════════════════════════════════════════════════════════════════════════
interface VerificationResult {
  score: number;
  approved: boolean;
  results: { agent: string; ok: boolean; reason: string }[];
}

export async function runVerificationGauntlet(d: Discount): Promise<VerificationResult> {
  const [r1, r2, r3, r4, r5] = await Promise.all([
    agent1_urlAlive(d),
    Promise.resolve(agent2_trustedDomain(d)),
    Promise.resolve(agent3_priceSanity(d)),
    Promise.resolve(agent4_discountConsistent(d)),
    Promise.resolve(agent5_dataComplete(d)),
  ]);
  const results = [
    { agent: 'Agente 1 URL',       ...r1 },
    { agent: 'Agente 2 Dominio',   ...r2 },
    { agent: 'Agente 3 Precio',    ...r3 },
    { agent: 'Agente 4 Descuento', ...r4 },
    { agent: 'Agente 5 Datos',     ...r5 },
  ];
  const score = results.filter((r) => r.ok).length;
  return { score, approved: score >= 4, results };
}

function verifyImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) { resolve(false); return; }
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; resolve(false); }, 7000);
    img.onload  = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}

async function runVerifyAndPurge(): Promise<void> {
  const s = store();
  const discounts: Discount[] = s.discounts ?? [];
  const urlChecks: Record<string, UrlCheckResult> = s.urlChecks ?? {};

  const batchImg = discounts.filter((d) => d.imageUrl?.startsWith('http')).slice(0, 20);
  let brokenImgs = 0;
  for (const d of batchImg) {
    const ok = await verifyImage(d.imageUrl!);
    s.updateUrlCheck(d.imageUrl!, {
      url: d.imageUrl!,
      status: ok ? 'ok' : 'broken',
      checkedAt: new Date().toISOString(),
      ...(ok ? {} : { note: 'Imagen no disponible' }),
    });
    if (!ok) brokenImgs++;
  }
  if (batchImg.length > 0) {
    log(
      `Verificador: ${batchImg.length - brokenImgs}/${batchImg.length} imagenes OK${brokenImgs > 0 ? `, ${brokenImgs} con problemas` : ''}`,
      brokenImgs > 0 ? 'warning' : 'success',
    );
  }

  const today = new Date().toDateString();
  const unchecked = discounts
    .filter((d) => {
      const c = urlChecks[d.sourceUrl];
      return !c || new Date(c.checkedAt).toDateString() !== today;
    })
    .slice(0, 15);

  let failedDomains = 0;
  for (const d of unchecked) {
    const { ok } = await agent1_urlAlive(d);
    s.updateUrlCheck(d.sourceUrl, {
      url: d.sourceUrl,
      status: ok ? 'ok' : 'broken',
      checkedAt: new Date().toISOString(),
      ...(ok ? {} : { note: 'URL no responde' }),
    });
    if (!ok) failedDomains++;
  }
  if (failedDomains > 0) {
    log(`${failedDomains} dominio(s) con problemas detectados`, 'warning');
  }

  const freshChecks: Record<string, UrlCheckResult> = store().urlChecks ?? {};
  const failedUrls = Object.entries(freshChecks)
    .filter(([, c]) => {
      const ageMs = Date.now() - new Date(c.checkedAt).getTime();
      return c.status === 'broken' && ageMs < 2 * 60 * 60 * 1000;
    })
    .map(([url]) => url);

  if (failedUrls.length > 0) {
    const currentDiscounts: Discount[] = store().discounts ?? [];
    const candidates = currentDiscounts.filter(
      (d) => failedUrls.includes(d.sourceUrl) && !d.predictedDiscount,
    );
    const safeRemove = Math.min(candidates.length, MAX_PURGE_CYCLE, currentDiscounts.length - 20);
    for (let i = 0; i < safeRemove; i++) {
      store().removeDiscount(candidates[i].id);
      _status.discountsPurged++;
      log(`Producto eliminado (URL caída): "${candidates[i].title.slice(0, 50)}"`, 'warning');
    }
  }

  _status.lastVerify = Date.now();
}

async function runScanBatch(): Promise<void> {
  const s = store();
  const companies: Company[] = (s.companies ?? []).filter((c: Company) => c.active);
  if (companies.length === 0) return;

  const settings = s.settings ?? {};
  const apiKey: string = settings.groqApiKey ?? '';

  // Sin API Groq → solo re-verificar productos existentes, NO agregar nuevos de plantilla
  if (!apiKey) {
    log('Escáner: sin API Groq — re-verificando productos existentes', 'info');
    const existing: Discount[] = (s.discounts ?? []).slice(0, 5);
    let okCount = 0;
    for (const d of existing) {
      const vr = await runVerificationGauntlet(d);
      if (vr.approved) okCount++;
      else log(`Re-verificación: "${d.title.slice(0, 40)}" (${vr.score}/5 agentes)`, 'warning');
    }
    if (existing.length > 0) {
      log(`Re-verificación: ${okCount}/${existing.length} productos activos OK`, 'success');
    }
    _status.lastScan = Date.now();
    return;
  }

  const batch = companies.slice(_status.scanCursor, _status.scanCursor + SCAN_BATCH);
  _status.scanCursor = (_status.scanCursor + SCAN_BATCH) % companies.length;

  const existingTitles = new Set<string>(
    (s.discounts as Discount[]).map((d: Discount) => d.title.toLowerCase()),
  );

  let scanned = 0;
  let approved = 0;
  let rejected = 0;

  for (const company of batch) {
    try {
      const result = await scanCompany(
        company,
        apiKey,
        (msg, type) => log(`[${company.name}] ${msg}`, type),
      );

      for (const d of result.discountsFound) {
        if (existingTitles.has(d.title.toLowerCase())) continue;
        const currentCount = (store().discounts as Discount[]).length;
        if (currentCount >= MAX_DISCOUNTS) {
          log(`Límite ${MAX_DISCOUNTS} productos alcanzado`, 'warning');
          break;
        }

        // ── GAUNTLET 5 AGENTES ───────────────────────────────────────────────────
        log(`Verificando con 5 agentes: "${d.title.slice(0, 45)}"...`, 'info');
        const vr = await runVerificationGauntlet(d);
        const failedReasons = vr.results.filter((r) => !r.ok).map((r) => r.reason);

        if (vr.approved) {
          s.addDiscount({ ...d, country: _companyCountry(company) });
          existingTitles.add(d.title.toLowerCase());
          approved++;
          _status.discountsAdded++;
          _status.verificationsPassed++;
          log(`✓ Aprobado (${vr.score}/5 agentes): "${d.title.slice(0, 45)}"`, 'success');
        } else {
          rejected++;
          _status.discountsRejected++;
          _status.verificationsRejected++;
          log(`✗ Rechazado (${vr.score}/5): ${failedReasons.join(' | ')}`, 'warning');
        }
      }

      s.updateCompany(company.id, {
        lastScan: new Date().toISOString(),
        discountsFound: company.discountsFound + result.discountsFound.length,
      });
      scanned++;
    } catch (err) {
      log(`Error escaneando ${company.name}: ${(err as Error).message}`, 'error');
    }
  }

  _status.lastScan = Date.now();
  _status.scanCycles++;

  log(
    `Escáner: ${scanned} empresas | +${approved} aprobados | ${rejected} rechazados | total: ${(store().discounts as Discount[]).length}`,
    approved > 0 ? 'success' : 'info',
  );
}

async function runFetchExchange(): Promise<void> {
  try {
    const rates = await fetchExchangeRates();
    store().updateExchangeRates(rates);
    _status.lastExchange = Date.now();
    log(`Tipo de cambio: 1 USD = ${rates.USD_COP.toLocaleString('es-CO')} COP`, 'success');
  } catch (err) {
    log(`Tipo de cambio error: ${(err as Error).message}`, 'warning');
  }
}

async function runPredictAndNotify(): Promise<void> {
  const s = store();
  const settings = s.settings ?? {};

  if (settings.groqApiKey) {
    log('Agente IA: generando predicciones 12h...', 'info');
    const highPriority: Company[] = (s.companies ?? [])
      .filter((c: Company) => c.active)
      .sort((a: Company, b: Company) => b.trustScore - a.trustScore)
      .slice(0, 3);

    for (const company of highPriority) {
      try {
        const result = await scanCompany(company, settings.groqApiKey, (msg, type) =>
          log(`[IA] ${msg}`, type),
        );
        for (const d of result.discountsFound) {
          if (d.predictedDiscount) {
            const vr = await runVerificationGauntlet(d);
            if (vr.approved) {
              s.addDiscount({ ...d, country: _companyCountry(company) });
              log(`IA predicción aprobada (${vr.score}/5): "${d.title.slice(0, 40)}"`, 'success');
            }
          }
        }
      } catch { /* silenciar errores IA individuales */ }
    }
    log('Predicciones IA generadas', 'success');
  }

  if (settings.telegramBotToken && settings.telegramChatId) {
    try {
      const msg = buildDailyDigest(s.discounts ?? []);
      const result = await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, msg);
      if (result.ok) log('Telegram: digest enviado', 'success');
      else log(`Telegram: ${result.error ?? 'error'}`, 'warning');
    } catch (err) {
      log(`Telegram: ${(err as Error).message}`, 'error');
    }
  }

  _status.lastPredict = Date.now();
}

export function startPipeline(): void {
  if (_status.running) return;
  if (!_getState) { console.warn('Pipeline: initPipeline() no llamado'); return; }
  _status.running = true;

  log('Pipeline v3 activo — 5 agentes verificación (URL·Dominio·Precio·Descuento·Datos)', 'success');

  runFetchExchange().catch(() => {});
  setTimeout(() => runScanBatch().catch(() => {}), 3000);
  setTimeout(() => runVerifyAndPurge().catch(() => {}), 9000);

  // Agente Scraper — precios reales desde MercadoLibre
  log('Agente Scraper: iniciando actualización de precios reales...', 'info');
  startPriceRefreshCycle(
    () => store().discounts ?? [],
    (id: string, patch: Partial<Discount>) => store().updateDiscount(id, patch),
  );

  _timers.push(setInterval(() => runVerifyAndPurge().catch(() => {}), MS_VERIFY));
  _timers.push(setInterval(() => runScanBatch().catch(() => {}), MS_SCAN));
  _timers.push(setInterval(() => runFetchExchange().catch(() => {}), MS_EXCHANGE));
  _timers.push(setInterval(() => runPredictAndNotify().catch(() => {}), MS_PREDICT));
}

export function stopPipeline(): void {
  _timers.splice(0).forEach(clearInterval);
  stopPriceRefreshCycle();
  _status.running = false;
}

export async function triggerScan(): Promise<void> {
  if (!_getState) return;
  await runScanBatch();
  await runVerifyAndPurge();
}

export function getPipelineStatus() {
  return { ..._status };
}
