import React, { useEffect, useRef } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import DashboardPage from './pages/DashboardPage';
import CompaniesPage from './pages/CompaniesPage';
import DiscountsPage from './pages/DiscountsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import { useAppStore } from './store/useAppStore';
import { runFullScan } from './services/agentService';

const PAGES: Record<string, React.ReactNode> = {
  dashboard: <DashboardPage />,
  companies: <CompaniesPage />,
  discounts: <DiscountsPage />,
  analytics: <AnalyticsPage />,
  agents: <AgentsPage />,
  settings: <SettingsPage />,
};

function App() {
  const { activeTab, settings, isScanning, setIsScanning, companies, addLog, addDiscount, updateCompany, updateAgentStatus, incrementAgentTasks, agents } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDiscountCount = useRef<number>(0);

  // ─── Auto-escaneo ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!settings.autoScanEnabled || !settings.groqApiKey) return;

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
          (d) => addDiscount(d),
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
    addLog({ agentName: 'Auto-Agente', message: `🔄 Auto-escaneo activado cada ${settings.scanIntervalMinutes} min`, type: 'info' });

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [settings.autoScanEnabled, settings.groqApiKey, settings.scanIntervalMinutes]);

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
