// api/daily-scan.js
// Vercel Serverless Function — se ejecuta diariamente via cron (vercel.json)
// Variables de entorno requeridas en Vercel Dashboard:
//   GROQ_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const TOP_COMPANIES = [
  { name: 'MercadoLibre Ecuador', url: 'https://www.mercadolibre.com.ec/ofertas', sector: 'E-commerce' },
  { name: 'Samsung Ecuador', url: 'https://www.samsung.com/ec/offer/', sector: 'Electrónica' },
  { name: 'Falabella Colombia', url: 'https://www.falabella.com.co/falabella-co/category/cat4076/Ofertas', sector: 'Retail' },
  { name: 'Amazon', url: 'https://www.amazon.com/deals', sector: 'Marketplace' },
  { name: 'Temu', url: 'https://www.temu.com/es-ec/', sector: 'Marketplace' },
  { name: 'Xiaomi Ecuador', url: 'https://www.mi.com/ec/', sector: 'Electrónica' },
  { name: 'Sony Ecuador', url: 'https://www.sony.com/es_ec/', sector: 'Electrónica' },
  { name: 'Apple / iShop Ecuador', url: 'https://www.ishopecuador.com/', sector: 'Electrónica' },
];

async function askGroq(apiKey, prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Eres un agente experto en descuentos de Ecuador y Colombia. Responde SOLO con JSON válido, sin texto adicional.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.3,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function sendTelegram(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
  });
}

export default async function handler(req, res) {
  // Protección: solo aceptar GET (invocaciones del cron) o POST con token secreto
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (req.method === 'POST' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Falta GROQ_API_KEY en variables de entorno' });
  }

  const results = [];
  const date = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Analizar top 5 empresas (para no exceder límite de 10s de Vercel free)
  for (const company of TOP_COMPANIES.slice(0, 5)) {
    try {
      const prompt = `Empresa: ${company.name} (${company.sector})
URL: ${company.url}
Fecha: ${date}

Genera 1 descuento probable MUY específico con producto real para hoy en esta empresa.
Responde con JSON exacto:
{"title":"[nombre exacto del producto y modelo]","discountPercent":25,"originalPrice":199,"discountedPrice":149,"description":"descripción de 80 palabras con specs técnicas","sourceUrl":"URL directa al producto"}`;

      const raw = await askGroq(GROQ_API_KEY, prompt);
      if (!raw) continue;

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const discount = JSON.parse(jsonMatch[0]);
      results.push({
        ...discount,
        companyName: company.name,
        sector: company.sector,
        confidence: 78,
        predictedDiscount: true,
        detectedAt: new Date().toISOString(),
      });

      // Delay entre llamadas Groq
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      console.error(`Error procesando ${company.name}:`, e.message);
    }
  }

  // Enviar a Telegram si está configurado
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && results.length > 0) {
    const medal = ['🥇', '🥈', '🥉', '🔥', '💥'];
    let msg = `🤖 <b>Maestricos — Predicciones Diarias IA</b>\n`;
    msg += `📅 ${date}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `<b>El agente analizó ${results.length} empresas y predice:</b>\n\n`;

    results.forEach((d, i) => {
      msg += `${medal[i] ?? '•'} <b>${d.title}</b>\n`;
      if (d.discountPercent) msg += `   📉 -${d.discountPercent}%`;
      if (d.discountedPrice) msg += ` → $${d.discountedPrice}`;
      msg += `\n   🏢 ${d.companyName}\n`;
      if (d.sourceUrl) msg += `   🔗 <a href="${d.sourceUrl}">Ver →</a>\n`;
      msg += '\n';
    });

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⚠️ <i>Predicciones generadas por IA. Verifica precios en las tiendas.</i>`;

    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, msg);
  }

  return res.status(200).json({
    success: true,
    date,
    discountsGenerated: results.length,
    results,
  });
}
