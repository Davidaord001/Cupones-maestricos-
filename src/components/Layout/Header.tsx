import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Play, RefreshCw, Bell, BellOff, Zap, ZapOff, Send } from 'lucide-react';
import { runFullScan } from '../../services/agentService';
import { sendTelegramMessage, buildDailyDigest, buildNewDiscountAlert } from '../../services/telegramService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard General',
  companies: 'Gestión de Empresas',
  discounts: 'Descuentos Detectados',
  analytics: 'Análisis y Predicciones',
  agents: 'Agentes Virtuales',
  settings: 'Configuración',
};

export default function Header() {
  const {
    activeTab, isScanning, setIsScanning,
    companies, settings, updateSettings, addLog, addDiscount, updateCompany, updateAgentStatus, incrementAgentTasks, agents, discounts,
  } = useAppStore();

  const today = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es });
  const [countdown, setCountdown] = useState('');
  const [nextScanAt, setNextScanAt] = useState<Date | null>(null);

  // Contador regresivo para próximo auto-escaneo
  useEffect(() => {
    if (!settings.autoScanEnabled) { setCountdown(''); return; }
    const next = new Date(Date.now() + settings.scanIntervalMinutes * 60 * 1000);
    setNextScanAt(next);
  }, [settings.autoScanEnabled, settings.scanIntervalMinutes]);

  useEffect(() => {
    if (!nextScanAt) return;
    const tick = setInterval(() => {
      const diff = nextScanAt.getTime() - Date.now();
      if (diff <= 0) { setCountdown('¡Ahora!'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(tick);
  }, [nextScanAt]);

  async function handleScan() {
    if (isScanning || !settings.groqApiKey) return;
    setIsScanning(true);
    agents.forEach((a) => updateAgentStatus(a.id, 'running'));
    const prevCount = discounts.filter((d) => !d.predictedDiscount).length;
    try {
      await runFullScan(
        companies,
        settings.groqApiKey,
        (agentName, msg, type) => addLog({ agentName, message: msg, type }),
        (d) => {
          addDiscount(d);
          // Notificación Telegram inmediata por cada descuento real nuevo
          if (!d.predictedDiscount && hasTelegram) {
            sendTelegramMessage(
              settings.telegramBotToken,
              settings.telegramChatId,
              buildNewDiscountAlert(d)
            );
          }
        },
        (id, data) => updateCompany(id, data)
      );
      agents.forEach((a) => { updateAgentStatus(a.id, 'completed'); incrementAgentTasks(a.id); });
      addLog({ agentName: 'Sistema', message: 'Ciclo de escaneo completado exitosamente', type: 'success' });

      // Al terminar, si hay Telegram, enviar resumen con los mejores descuentos
      if (hasTelegram) {
        const freshDiscounts = useAppStore.getState().discounts;
        const newCount = freshDiscounts.filter((d) => !d.predictedDiscount).length;
        if (newCount > prevCount) {
          const msg = buildDailyDigest(freshDiscounts);
          const r = await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, msg);
          if (r.ok) addLog({ agentName: 'Telegram', message: `📱 Resumen con ${newCount} descuentos enviado a Telegram`, type: 'success' });
        }
      }
    } catch (err) {
      agents.forEach((a) => updateAgentStatus(a.id, 'error'));
      addLog({ agentName: 'Sistema', message: `Error en escaneo: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsScanning(false);
    }
  }

  function toggleAutoScan() {
    if (!settings.groqApiKey) {
      addLog({ agentName: 'Sistema', message: '⚠ Configura tu API Key de Groq para activar el auto-escaneo', type: 'warning' });
      return;
    }
    const next = !settings.autoScanEnabled;
    updateSettings({ autoScanEnabled: next });
    if (next && Notification.permission === 'default') Notification.requestPermission();
  }

  const canScan = !isScanning;
  const newDiscounts = discounts.filter((d) => !d.predictedDiscount).length;
  const hasTelegram = !!(settings.telegramBotToken && settings.telegramChatId);

  async function handleSendDigest() {
    if (!hasTelegram) return;
    const msg = buildDailyDigest(discounts);
    const result = await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, msg);
    if (result.ok) {
      addLog({ agentName: 'Telegram', message: '📱 Resumen enviado a Telegram exitosamente', type: 'success' });
    } else {
      addLog({ agentName: 'Telegram', message: `Error Telegram: ${result.error}`, type: 'error' });
    }
  }

  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div>
        <h2 className="text-white font-semibold">{PAGE_TITLES[activeTab] ?? 'Ecuador Agents'}</h2>
        <p className="text-gray-500 text-xs capitalize">{today}</p>
      </div>

      <div className="flex items-center gap-3">
        {!settings.groqApiKey && (
          <span className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
            ⚠ Configura tu API key de Groq
          </span>
        )}

        {/* Auto-scan toggle */}
        <button
          onClick={toggleAutoScan}
          title={settings.autoScanEnabled ? `Auto-escaneo ON · próximo en ${countdown}` : 'Activar auto-escaneo automático'}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
            settings.autoScanEnabled
              ? 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
          }`}
        >
          {settings.autoScanEnabled ? <Zap size={14} className="text-green-400" /> : <ZapOff size={14} />}
          <span className="hidden xl:inline">
            {settings.autoScanEnabled ? `Auto · ${countdown || `cada ${settings.scanIntervalMinutes}m`}` : 'Auto'}
          </span>
        </button>

        {/* Escaneo manual */}
        <button
          onClick={handleScan}
          disabled={!canScan}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            canScan
              ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isScanning ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Play size={15} />
          )}
          {isScanning ? 'Escaneando...' : 'Iniciar Escaneo'}
        </button>

        {/* Enviar resumen a Telegram */}
        {hasTelegram && (
          <button
            onClick={handleSendDigest}
            title="Enviar resumen de descuentos a Telegram ahora"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 transition-all"
          >
            <Send size={14} />
            <span className="hidden xl:inline">Telegram</span>
          </button>
        )}

        {/* Notificaciones */}
        <button
          onClick={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
          title={settings.notificationsEnabled ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
          className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors relative"
        >
          {settings.notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          {newDiscounts > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
              {newDiscounts > 9 ? '9+' : newDiscounts}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
