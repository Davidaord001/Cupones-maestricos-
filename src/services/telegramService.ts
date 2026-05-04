import type { Discount } from '../store/types';

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!botToken || !chatId) return { ok: false, error: 'Falta bot token o chat ID' };
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description ?? 'Error desconocido' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function buildDailyDigest(discounts: Discount[]): string {
  const real = discounts
    .filter((d) => !d.predictedDiscount && d.discountPercent !== null)
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
    .slice(0, 5);

  const predictions = discounts
    .filter((d) => d.predictedDiscount)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 3);

  const medal = ['🥇', '🥈', '🥉', '🔥', '💥'];
  const date = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

  let msg = `🛍️ <b>Maestricos — Resumen del ${date}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (real.length > 0) {
    msg += `<b>🔥 Mejores descuentos reales:</b>\n\n`;
    real.forEach((d, i) => {
      msg += `${medal[i]} <b>${d.title}</b>\n`;
      if (d.discountPercent) msg += `   📉 <b>-${d.discountPercent}%</b>`;
      if (d.originalPrice && d.discountedPrice) {
        const saved = d.originalPrice - d.discountedPrice;
        msg += ` · Antes $${d.originalPrice} → <b>$${d.discountedPrice}</b> (ahorras $${saved.toFixed(0)})`;
      }
      msg += `\n   🏢 ${d.companyName}\n`;
      msg += `   🔗 <a href="${d.sourceUrl}">Ver oferta →</a>\n\n`;
    });
  }

  if (predictions.length > 0) {
    msg += `<b>🤖 Predicciones IA (próximamente):</b>\n\n`;
    predictions.forEach((d) => {
      msg += `⭐ ${d.title}\n`;
      msg += `   Confianza: ${Math.round(d.confidence)}% · ${d.companyName}\n\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🌐 Ver todos los descuentos en la app Maestricos`;
  return msg;
}

export function buildNewDiscountAlert(discount: Discount): string {
  let msg = `🚨 <b>¡Nuevo descuento detectado!</b>\n\n`;
  msg += `<b>${discount.title}</b>\n`;
  if (discount.discountPercent) msg += `📉 <b>-${discount.discountPercent}% OFF</b>`;
  if (discount.discountedPrice) msg += ` → <b>$${discount.discountedPrice}</b>`;
  if (discount.originalPrice && discount.discountedPrice) {
    msg += ` (antes $${discount.originalPrice})`;
  }
  msg += `\n🏢 ${discount.companyName} · ${discount.sector}\n`;
  msg += `📝 ${discount.description.slice(0, 120)}...\n`;
  msg += `🔗 <a href="${discount.sourceUrl}">Ver oferta →</a>`;
  return msg;
}
