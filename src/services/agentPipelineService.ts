/**
 * agentPipelineService.ts
 *
 * Sistema automático de agentes virtuales con cola de tareas prioritaria + retry con backoff exponencial.
 *
 * Tareas disponibles:
 *  - fetch_exchange  : Actualiza tipo de cambio COP/USD desde APIs públicas
 *  - verify_images   : Verifica que las URLs de imágenes de productos cargan
 *  - verify_urls     : Verifica que los enlaces de productos responden
 *  - send_telegram   : Envía digest de descuentos por Telegram
 *  - scan_cycle      : Programa las tareas de un ciclo completo de escaneo
 *
 * Uso:
 *   initPipeline(getState, logFn)   — llamar una vez al iniciar la app
 *   startPipeline(intervalMinutes)  — inicia el auto-ciclo
 *   stopPipeline()                  — detiene todo
 *   addTask(type, priority?)        — añade tarea manual
 *   getPipelineStatus()             — estado actual
 */

import { fetchExchangeRates } from './currencyService';
import { sendTelegramMessage, buildDailyDigest } from './telegramService';
import type { Discount } from '../store/types';

// ── Tipos ────────────────────────────────────────────────────────────────

export type TaskType =
  | 'fetch_exchange'
  | 'verify_images'
  | 'verify_urls'
  | 'send_telegram'
  | 'scan_cycle';

export interface PipelineTask {
  id: string;
  type: TaskType;
  priority: number;       // 1 = más urgente → 10 = baja prioridad
  retries: number;
  maxRetries: number;
  createdAt: number;
  data?: Record<string, unknown>;
}

type LogType = 'info' | 'success' | 'error' | 'warning';
type LogFn = (msg: string, type: LogType) => void;

// ── Estado interno ────────────────────────────────────────────────────────

interface PipelineState {
  queue: PipelineTask[];
  processing: boolean;
  lastCycleAt: number | null;
  scheduledTimer: ReturnType<typeof setInterval> | null;
  processTimer: ReturnType<typeof setTimeout> | null;
}

const _state: PipelineState = {
  queue: [],
  processing: false,
  lastCycleAt: null,
  scheduledTimer: null,
  processTimer: null,
};

// ── Referencias al store (inyectadas vía initPipeline) ───────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getState: (() => any) | null = null;
let _log: LogFn | null = null;

/** Inicializa el pipeline con acceso al store y función de log. Debe llamarse una sola vez. */
export function initPipeline(getState: () => unknown, log: LogFn): void {
  _getState = getState as () => ReturnType<typeof getState>;
  _log = log;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function makeTask(
  type: TaskType,
  priority = 5,
  maxRetries = 3,
  data?: Record<string, unknown>,
): PipelineTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    priority,
    retries: 0,
    maxRetries,
    createdAt: Date.now(),
    data,
  };
}

function enqueue(task: PipelineTask): void {
  // Evitar duplicados del mismo tipo de baja variación (excepto verify)
  const isDuplicate =
    task.type !== 'verify_images' &&
    task.type !== 'verify_urls' &&
    _state.queue.some((t) => t.type === task.type);
  if (isDuplicate) return;

  _state.queue.push(task);
  _state.queue.sort((a, b) => a.priority - b.priority);
}

function scheduleProcess(): void {
  if (_state.processTimer) return;
  _state.processTimer = setTimeout(() => {
    _state.processTimer = null;
    processNext();
  }, 250);
}

// ── Verificación de imagen (usa Image constructor — no CORS) ─────────────

function verifyImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(false);
      return;
    }
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = '';
      resolve(false);
    }, 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

// ── Verificación de URL (no-cors, confirma que el servidor responde) ─────

async function checkUrlAlive(url: string): Promise<boolean> {
  try {
    // mode: 'no-cors' — no podemos ver el status pero sí detectar timeouts/DNS fail
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: AbortSignal.timeout(6000),
    });
    return true;
  } catch {
    return false;
  }
}

// ── Ejecución de cada tipo de tarea ──────────────────────────────────────

async function executeTask(task: PipelineTask): Promise<void> {
  if (!_getState || !_log) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = _getState() as any;

  switch (task.type) {
    // ── Tipo de cambio COP/USD ───────────────────────────────────────────
    case 'fetch_exchange': {
      _log('💱 Agente Divisa: actualizando tipo de cambio COP/USD…', 'info');
      const rates = await fetchExchangeRates();
      store.updateExchangeRates(rates);
      _log(
        `💱 Agente Divisa: 1 USD = ${rates.USD_COP.toLocaleString('es-CO')} COP ✅`,
        'success',
      );
      break;
    }

    // ── Verificar imágenes ───────────────────────────────────────────────
    case 'verify_images': {
      const discounts: Discount[] = store.discounts ?? [];
      const withImages = discounts.filter((d) => d.imageUrl && d.imageUrl.startsWith('http'));
      const batch = withImages.slice(0, 25); // máx 25 por ciclo para no saturar
      _log(`🖼️ Agente Verificador: comprobando ${batch.length} imágenes…`, 'info');
      let broken = 0;
      for (const d of batch) {
        const ok = await verifyImageUrl(d.imageUrl!);
        store.updateUrlCheck(d.imageUrl!, {
          url: d.imageUrl!,
          status: ok ? 'ok' : 'broken',
          checkedAt: new Date().toISOString(),
          ...(ok ? {} : { note: 'Imagen no cargó (timeout o bloqueada)' }),
        });
        if (!ok) broken++;
      }
      _log(
        `🖼️ Agente Verificador: ${batch.length - broken} imágenes OK${broken > 0 ? `, ${broken} con errores` : ''} ✅`,
        broken > 0 ? 'warning' : 'success',
      );
      break;
    }

    // ── Verificar URLs de productos ──────────────────────────────────────
    case 'verify_urls': {
      const discounts: Discount[] = store.discounts ?? [];
      const batch = discounts.slice(0, 20); // máx 20 por ciclo
      _log(`🔗 Agente Verificador: revisando ${batch.length} enlaces de productos…`, 'info');
      let broken = 0;
      for (const d of batch) {
        const ok = await checkUrlAlive(d.sourceUrl);
        store.updateUrlCheck(d.sourceUrl, {
          url: d.sourceUrl,
          status: ok ? 'ok' : 'broken',
          checkedAt: new Date().toISOString(),
        });
        if (!ok) broken++;
      }
      _log(
        `🔗 Agente Verificador: ${batch.length - broken} URLs OK${broken > 0 ? `, ${broken} con errores` : ''} ✅`,
        broken > 0 ? 'warning' : 'success',
      );
      break;
    }

    // ── Enviar digest por Telegram ───────────────────────────────────────
    case 'send_telegram': {
      const { settings, discounts } = store;
      if (!settings?.telegramBotToken || !settings?.telegramChatId) {
        _log('📱 Agente Telegram: sin credenciales, omitiendo envío', 'warning');
        break;
      }
      _log('📱 Agente Telegram: preparando digest de descuentos…', 'info');
      const msg = buildDailyDigest(discounts ?? []);
      const result = await sendTelegramMessage(
        settings.telegramBotToken,
        settings.telegramChatId,
        msg,
      );
      if (result.ok) {
        _log('📱 Agente Telegram: digest enviado correctamente ✅', 'success');
      } else {
        throw new Error(result.error ?? 'Error desconocido al enviar Telegram');
      }
      break;
    }

    // ── Ciclo de escaneo ─────────────────────────────────────────────────
    case 'scan_cycle': {
      _log('🔄 Agente Pipeline: programando ciclo completo de verificación…', 'info');
      // En modo sin IA real (solo browser), encola tareas de verificación
      enqueue(makeTask('fetch_exchange', 1, 3));
      enqueue(makeTask('verify_images', 3, 2));
      enqueue(makeTask('verify_urls', 5, 2));
      enqueue(makeTask('send_telegram', 7, 2));
      scheduleProcess();
      _log('🔄 Agente Pipeline: ciclo encolado — fetch_exchange → verify_images → verify_urls → send_telegram', 'success');
      break;
    }
  }
}

// ── Procesador de cola ────────────────────────────────────────────────────

async function processNext(): Promise<void> {
  if (_state.processing || _state.queue.length === 0) return;

  const task = _state.queue.shift()!;
  _state.processing = true;

  try {
    await executeTask(task);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (task.retries < task.maxRetries) {
      // Backoff exponencial: 2s, 4s, 8s, …
      const delay = Math.pow(2, task.retries + 1) * 1000;
      _log?.(
        `⚠️ Reintentando "${task.type}" en ${delay / 1000}s (intento ${task.retries + 1}/${task.maxRetries})`,
        'warning',
      );
      setTimeout(() => {
        enqueue({ ...task, retries: task.retries + 1 });
        scheduleProcess();
      }, delay);
    } else {
      _log?.(
        `❌ Tarea "${task.type}" falló tras ${task.maxRetries} intentos: ${errMsg}`,
        'error',
      );
    }
  } finally {
    _state.processing = false;
    if (_state.queue.length > 0) {
      scheduleProcess();
    }
  }
}

// ── API pública ───────────────────────────────────────────────────────────

/**
 * Inicia el pipeline automático.
 * @param intervalMinutes  Intervalo entre ciclos (mínimo 15 minutos).
 */
export function startPipeline(intervalMinutes: number): void {
  stopPipeline();

  const mins = Math.max(intervalMinutes, 15);

  // Tareas iniciales inmediatas
  enqueue(makeTask('fetch_exchange', 1, 3));
  enqueue(makeTask('verify_images', 4, 2));
  scheduleProcess();

  // Ciclos programados
  _state.scheduledTimer = setInterval(() => {
    _log?.('🤖 Pipeline: iniciando ciclo automático programado', 'info');
    enqueue(makeTask('scan_cycle', 2, 3));
    scheduleProcess();
  }, mins * 60 * 1000);

  _state.lastCycleAt = Date.now();
  _log?.(`🤖 Pipeline activo — ciclo cada ${mins} min. Tareas iniciales encoladas.`, 'success');
}

/** Detiene el pipeline y limpia todos los timers. */
export function stopPipeline(): void {
  if (_state.scheduledTimer) {
    clearInterval(_state.scheduledTimer);
    _state.scheduledTimer = null;
  }
  if (_state.processTimer) {
    clearTimeout(_state.processTimer);
    _state.processTimer = null;
  }
  _state.queue = [];
  _state.processing = false;
}

/** Añade una tarea manualmente a la cola (ignora duplicados del mismo tipo). */
export function addTask(type: TaskType, priority = 5): void {
  enqueue(makeTask(type, priority, 3));
  scheduleProcess();
}

/** Estado actual del pipeline para diagnóstico. */
export function getPipelineStatus(): {
  queueLength: number;
  processing: boolean;
  lastCycleAt: number | null;
  queueTypes: string[];
} {
  return {
    queueLength: _state.queue.length,
    processing: _state.processing,
    lastCycleAt: _state.lastCycleAt,
    queueTypes: _state.queue.map((t) => t.type),
  };
}
