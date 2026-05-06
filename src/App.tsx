import React, { useEffect, useRef } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import DashboardPage from './pages/DashboardPage';
import CompaniesPage from './pages/CompaniesPage';
import DiscountsPage from './pages/DiscountsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import ComparatorPage from './pages/ComparatorPage';
import PriceHistoryPage from './pages/PriceHistoryPage';
import ShopPage from './pages/ShopPage';
import { useAppStore } from './store/useAppStore';
import { runFullScan } from './services/agentService';
import { sendTelegramMessage, buildNewDiscountAlert } from './services/telegramService';
import { fetchExchangeRates } from './services/currencyService';
import { initPipeline, startPipeline } from './services/agentPipelineService';

const PAGES: Record<string, React.ReactNode> = {
  dashboard: <DashboardPage />,
  companies: <CompaniesPage />,
  discounts: <DiscountsPage />,
  comparator: <ComparatorPage />,
  historial: <PriceHistoryPage />,
  shop: <ShopPage />,
  analytics: <AnalyticsPage />,
  agents: <AgentsPage />,
  settings: <SettingsPage />,
};

function App() {
  const { activeTab, settings, isScanning, setIsScanning, companies, addLog, addDiscount, updateCompany, updateAgentStatus, incrementAgentTasks, agents, updateExchangeRates, exchangeRates } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDiscountCount = useRef<number>(0);
  const pipelineInitRef = useRef(false);

  // ─── Pipeline automático — SIEMPRE activo desde el primer render ─────────
  useEffect(() => {
    if (!pipelineInitRef.current) {
      pipelineInitRef.current = true;
      initPipeline(
        () => useAppStore.getState(),
        (msg, type) => useAppStore.getState().addLog({ agentName: 'Pipeline', message: msg, type }),
      );
    }
    // Pipeline siempre activo: verificación, scan y tipo de cambio corren siempre
    startPipeline();
    return () => { /* no detener al desmontar — queremos que siga en segundo plano */ };
  }, []);

  // ─── Tipo de cambio automático cada 8 horas ────────────────────────────
  useEffect(() => {
    const updateRates = async () => {
      try {
        const rates = await fetchExchangeRates();
        updateExchangeRates(rates);
        addLog({ agentName: 'Agente Divisa', message: `💱 Tipo de cambio actualizado: 1 USD = ${rates.USD_COP.toLocaleString('es-CO')} COP`, type: 'success' });
      } catch {
        addLog({ agentName: 'Agente Divisa', message: '⚠ No se pudo actualizar el tipo de cambio, usando tasa de referencia', type: 'warning' });
      }
    };

    // Actualizar si hace más de 8h o no hay dato
    const lastUpdate = exchangeRates?.lastUpdated ? new Date(exchangeRates.lastUpdated).getTime() : 0;
    const hoursOld = (Date.now() - lastUpdate) / 3600000;
    if (hoursOld >= 8) updateRates();

    const rateInterval = setInterval(updateRates, 8 * 60 * 60 * 1000); // cada 8h
    return () => clearInterval(rateInterval);
  }, []);

  // ─── Auto-escaneo ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!settings.autoScanEnabled) return;

    const intervalMs = (settings.scanIntervalMinutes ?? 60) * 60 * 1000;

    const triggerScan = async () => {
      if (isScanning) return;
      setIsScanning(true);
      agents.forEach((a) => updateAgentStatus(a.id, 'running'));
      addLog({ agentName: 'Auto-Agente', message: '🤖 Escaneo automático iniciado', type: 'info' });

      try {
        const discountsBefore = useAppStore.getState().discounts.length;
        await runFullScan(
          useAppStore.getState().companies,
          settings.groqApiKey,
          (agentName, msg, type) => addLog({ agentName, message: msg, type }),
          (d) => {
            addDiscount(d);
            // Enviar Telegram por cada descuento real nuevo
            const s = useAppStore.getState().settings;
            if (!d.predictedDiscount && s.telegramBotToken && s.telegramChatId) {
              sendTelegramMessage(s.telegramBotToken, s.telegramChatId, buildNewDiscountAlert(d));
            }
          },
          (id, data) => updateCompany(id, data)
        );
        const discountsAfter = useAppStore.getState().discounts.length;
        const newCount = discountsAfter - discountsBefore;

        agents.forEach((a) => { updateAgentStatus(a.id, 'completed'); incrementAgentTasks(a.id); });
        addLog({ agentName: 'Auto-Agente', message: `✅ Escaneo automático completado. ${newCount} nuevo(s) descuento(s).`, type: 'success' });

        // Notificación del navegador
        if (newCount > 0 && settings.notificationsEnabled && Notification.permission === 'granted') {
          new Notification('🛍️ Agentes Ecuador — Nuevos descuentos', {
            body: `Se encontraron ${newCount} nuevo(s) descuento(s). ¡Revisa las ofertas!`,
            icon: '/vite.svg',
          });
        }
      } catch (err) {
        agents.forEach((a) => updateAgentStatus(a.id, 'error'));
        addLog({ agentName: 'Auto-Agente', message: `Error: ${(err as Error).message}`, type: 'error' });
      } finally {
        setIsScanning(false);
      }
    };

    // Solicitar permiso de notificaciones
    if (settings.notificationsEnabled && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    intervalRef.current = setInterval(triggerScan, intervalMs);
    addLog({ agentName: 'Auto-Agente', message: `🔄 Auto-escaneo activado cada ${settings.scanIntervalMinutes} min. Descuentos nuevos → Telegram automático`, type: 'info' });

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [settings.autoScanEnabled, settings.scanIntervalMinutes]);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {PAGES[activeTab] ?? <DashboardPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
