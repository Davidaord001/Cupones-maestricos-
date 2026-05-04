import Groq from 'groq-sdk';

// ─── Modelos actuales de Groq (free tier) ────────────────────────────────────
// llama-3.1-8b-instant : 30 RPM · 14,400 RPD · 6,000 TPM · 500K TPD  ← usar por defecto
// llama-3.3-70b-versatile: 30 RPM · 1,000 RPD · 12,000 TPM · 100K TPD ← solo análisis profundo
export const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',
  smart: 'llama-3.3-70b-versatile',
} as const;

// ─── Rate limiter interno ─────────────────────────────────────────────────────
// Límite real: 30 req/min. Usamos 20 req/min (1 cada 3 s) para tener margen seguro.
const RATE_LIMIT_INTERVAL_MS = 3000; // 3 segundos entre llamadas (máx 20/min)
let _lastCallTime = 0;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - _lastCallTime;
  if (elapsed < RATE_LIMIT_INTERVAL_MS) {
    await sleep(RATE_LIMIT_INTERVAL_MS - elapsed);
  }
  _lastCallTime = Date.now();
}

// Ejecuta una llamada a la API con rate limiting + retry automático en 429
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await waitForRateLimit();
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const headers = (err as { headers?: Record<string, string> })?.headers;
      if (status === 429) {
        // Leer retry-after si está disponible, si no, backoff exponencial
        const retryAfterSec = headers?.['retry-after'] ? parseInt(headers['retry-after']) : 0;
        const backoffMs = retryAfterSec > 0
          ? retryAfterSec * 1000 + 500
          : Math.pow(2, attempt + 1) * 2000; // 4s, 8s, 16s
        if (attempt < maxRetries - 1) {
          await sleep(backoffMs);
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error('Max reintentos alcanzado');
}

// ─── Estado público de uso de tokens ─────────────────────────────────────────
export const groqUsage = {
  callsThisSession: 0,
  tokensThisSession: 0,
  lastError: '' as string,
};

// ─────────────────────────────────────────────────────────────────────────────

let groqClient: Groq | null = null;

export function initGroq(apiKey: string): Groq {
  groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  return groqClient;
}

export function getGroqClient(): Groq | null {
  return groqClient;
}

export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    const client = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    await callWithRetry(() =>
      client.chat.completions.create({
        model: GROQ_MODELS.fast,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function analyzeCompanyDiscounts(
  apiKey: string,
  companyName: string,
  website: string,
  sector: string
): Promise<{
  predictions: string[];
  discountChance: number;
  estimatedDiscount: number;
  analysis: string;
  upcomingDates: string[];
}> {
  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  const today = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

  const response = await callWithRetry(() =>
    client.chat.completions.create({
      model: GROQ_MODELS.fast, // 8b suficiente para análisis estructurado
      messages: [
        {
          role: 'system',
          content: 'Eres un agente de análisis de descuentos para el mercado Ecuador/Colombia. Responde SOLO JSON válido, sin markdown.',
        },
        {
          role: 'user',
          content: `Empresa: "${companyName}" | Sector: "${sector}" | Web: ${website} | Fecha: ${today}
JSON: {"predictions":["pred1","pred2","pred3"],"discountChance":<0-100>,"estimatedDiscount":<0-70>,"analysis":"<2 oraciones>","upcomingDates":["fecha1","fecha2"]}`,
        },
      ],
      max_tokens: 350,
      temperature: 0.6,
    })
  );

  groqUsage.callsThisSession++;
  groqUsage.tokensThisSession += response.usage?.total_tokens ?? 0;

  const content = response.choices[0].message.content ?? '{}';
  try {
    return JSON.parse(content);
  } catch {
    return {
      predictions: ['Sin predicción disponible'],
      discountChance: 50,
      estimatedDiscount: 15,
      analysis: content.substring(0, 200),
      upcomingDates: [],
    };
  }
}

export async function generateDiscountSummary(
  apiKey: string,
  discounts: Array<{ companyName: string; title: string; discountPercent: number | null; sector: string }>
): Promise<string> {
  if (discounts.length === 0) return 'No hay descuentos activos para analizar.';

  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true });

  // Limitar a los primeros 15 descuentos para no exceder tokens
  const sample = discounts.slice(0, 15);

  const response = await callWithRetry(() =>
    client.chat.completions.create({
      model: GROQ_MODELS.fast,
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente de compras para Ecuador y Colombia. Responde en español, 3-4 oraciones máximo.',
        },
        {
          role: 'user',
          content: `Descuentos activos:\n${sample.map((d) => `- ${d.companyName} (${d.sector}): ${d.title}${d.discountPercent ? ` ${d.discountPercent}% OFF` : ''}`).join('\n')}\n\nResumen ejecutivo de las mejores oportunidades:`,
        },
      ],
      max_tokens: 280,
      temperature: 0.5,
    })
  );

  groqUsage.callsThisSession++;
  groqUsage.tokensThisSession += response.usage?.total_tokens ?? 0;

  return response.choices[0].message.content ?? 'No se pudo generar el resumen.';
}

export async function predictNextDiscountDate(
  apiKey: string,
  companyName: string,
  sector: string,
  pastDiscounts: string[]
): Promise<{ date: string; confidence: number; reason: string }> {
  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  const today = new Date().toLocaleDateString('es-EC');

  const response = await callWithRetry(() =>
    client.chat.completions.create({
      model: GROQ_MODELS.fast,
      messages: [
        {
          role: 'system',
          content: 'Predice fechas de descuentos. Responde SOLO JSON sin markdown.',
        },
        {
          role: 'user',
          content: `Empresa: ${companyName} | Sector: ${sector} | Hoy: ${today}\nHistorial: ${pastDiscounts.slice(0, 3).join(', ') || 'Sin historial'}\nJSON: {"date":"DD/MM/YYYY","confidence":<0-100>,"reason":"<breve>"}`,
        },
      ],
      max_tokens: 120,
    })
  );

  groqUsage.callsThisSession++;
  groqUsage.tokensThisSession += response.usage?.total_tokens ?? 0;

  try {
    return JSON.parse(response.choices[0].message.content ?? '{}');
  } catch {
    return { date: 'Próximo mes', confidence: 40, reason: 'Basado en patrones del sector' };
  }
}

