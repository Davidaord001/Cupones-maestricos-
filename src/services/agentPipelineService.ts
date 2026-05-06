/**
 * agentPipelineService.ts  v2
 *
 * Sistema de agentes virtuales siempre activo:
 *
 * LOOP RAPIDO  (cada 10 min) - verificar imagenes + purgar rotos
 * LOOP MEDIO   (cada 30 min) - escanear empresas - agregar ofertas
 * LOOP LENTO   (cada 12 h)   - predicciones IA (si hay API key)
 * LOOP DIVISA  (cada 8 h)    - actualizar tipo de cambio COP/USD
 */

import { fetchExchangeRates } from './currencyService';
import { sendTelegramMessage, buildDailyDigest } from './telegramService';
import { scanCompany } from './agentService';
import type { Discount, Company, UrlCheckResult } from '../store/types';

const MS_VERIFY   = 10 * 60 * 1000;
const MS_SCAN     = 30 * 60 * 1000;
const MS_EXCHANGE = 8  * 60 * 60 * 1000;
const MS_PREDICT  = 12 * 60 * 60 * 1000;

const SCAN_BATCH      = 8;
const MAX_DISCOUNTS   = 300;
const MAX_PURGE_CYCLE = 15;

interface PipelineStatus {
  running: boolean;
  scanCursor: number;
  lastScan: number | null;
  lastVerify: number | null;
  lastExchange: number | null;
  lastPredict: number | null;
  discountsAdded: number;
  discountsPurged: number;
  scanCycles: number;
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
  scanCycles: 0,
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

function companyCountry(company: Company): 'Ecuador' | 'Colombia' | 'Internacional' {
  if (company.province.includes('COL')) return 'Colombia';
  const globalNames = ['Amazon', 'AliExpress', 'Temu', 'Shein', 'eBay'];
  if (globalNames.some((n) => company.name.includes(n))) return 'Internacional';
  return 'Ecuador';
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

async function pingDomain(url: string): Promise<boolean> {
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(6000) });
    return true;
  } catch {
    return false;
  }
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
    const ok = await pingDomain(d.sourceUrl);
    s.updateUrlCheck(d.sourceUrl, {
      url: d.sourceUrl,
      status: ok ? 'ok' : 'broken',
      checkedAt: new Date().toISOString(),
      ...(ok ? {} : { note: 'Dominio no responde' }),
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
      log(`Eliminado (dominio caido): "${candidates[i].title.slice(0, 48)}..."`, 'warning');
    }
  }

  _status.lastVerify = Date.now();
}

async function runScanBatch(): Promise<void> {
  const s = store();
  const companies: Company[] = (s.companies ?? []).filter((c: Company) => c.active);
  if (companies.length === 0) return;

  const batch = companies.slice(_status.scanCursor, _status.scanCursor + SCAN_BATCH);
  _status.scanCursor = (_status.scanCursor + SCAN_BATCH) % companies.length;

  const existingTitles = new Set<string>(
    (s.discounts as Discount[]).map((d: Discount) => d.title.toLowerCase()),
  );

  let addedCount = 0;
  let companiesScanned = 0;

  for (const company of batch) {
    try {
      const country = companyCountry(company);
      const result = await scanCompany(company, '', (msg, type) =>
        log(`[${company.name}] ${msg}`, type),
      );

      for (const d of result.discountsFound) {
        if (existingTitles.has(d.title.toLowerCase())) continue;
        const currentCount = (store().discounts as Discount[]).length;
        if (currentCount >= MAX_DISCOUNTS) {
          log(`Limite ${MAX_DISCOUNTS} descuentos alcanzado`, 'warning');
          break;
        }
        s.addDiscount({ ...d, country });
        existingTitles.add(d.title.toLowerCase());
        addedCount++;
        _status.discountsAdded++;
      }

      s.updateCompany(company.id, {
        lastScan: new Date().toISOString(),
        discountsFound: company.discountsFound + result.discountsFound.length,
      });
      companiesScanned++;
    } catch (err) {
      log(`Error escaneando ${company.name}: ${(err as Error).message}`, 'error');
    }
  }

  _status.lastScan = Date.now();
  _status.scanCycles++;

  log(
    `Agentes: ${companiesScanned} empresas, +${addedCount} ofertas nuevas (total: ${(store().discounts as Discount[]).length})`,
    addedCount > 0 ? 'success' : 'info',
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
            s.addDiscount({ ...d, country: companyCountry(company) });
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

  log('Pipeline activo - verificacion 10min / scan 30min / IA 12h / divisa 8h', 'success');

  runFetchExchange().catch(() => {});
  setTimeout(() => runScanBatch().catch(() => {}), 3000);
  setTimeout(() => runVerifyAndPurge().catch(() => {}), 9000);

  _timers.push(setInterval(() => runVerifyAndPurge().catch(() => {}), MS_VERIFY));
  _timers.push(setInterval(() => runScanBatch().catch(() => {}), MS_SCAN));
  _timers.push(setInterval(() => runFetchExchange().catch(() => {}), MS_EXCHANGE));
  _timers.push(setInterval(() => runPredictAndNotify().catch(() => {}), MS_PREDICT));
}

export function stopPipeline(): void {
  _timers.splice(0).forEach(clearInterval);
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
