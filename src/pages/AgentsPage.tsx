import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Play, Loader2, Trash2, ActivitySquare, RefreshCw } from 'lucide-react';
import { runFullScan, runCompanyDiscoveryAgent, runInfoAgent } from '../services/agentService';
import { sendTelegramMessage, buildDailyDigest } from '../services/telegramService';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const AGENTS_CONFIG = [
  {
    id: 'agent-cupones',
    name: 'Agente Cupones',
    icon: '🏷️',
    borderColor: 'border-yellow-500/40',
    bgColor: 'bg-yellow-500/5',
    btnColor: 'bg-yellow-500 hover:bg-yellow-400 text-gray-900',
    statusColor: 'text-yellow-400 bg-yellow-500/20',
    description: 'Escanea todas las empresas activas en busca de descuentos y cupones nuevos. Genera predicciones con IA cuando hay API Key configurada.',
    capabilities: [
      '🏢 Escanea las 173 empresas activas',
      '🤖 Predicciones IA con Groq',
      '🔗 URLs directas a cada producto',
      '📱 Alertas automáticas a Telegram',
    ],
  },
  {
    id: 'agent-empresas',
    name: 'Agente Empresas',
    icon: '🔍',
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/5',
    btnColor: 'bg-blue-500 hover:bg-blue-400 text-white',
    statusColor: 'text-blue-400 bg-blue-500/20',
    description: 'Descubre nuevas tiendas y empresas para agregar al radar de monitoreo. Cubre restaurantes, bancos, streaming, delivery y más.',
    capabilities: [
      '🌐 38 nuevas empresas candidatas',
      '📂 Clasifica por sector automáticamente',
      '🚫 Evita duplicados en la base',
      '➕ Agrega 4 nuevas por ejecución',
    ],
  },
  {
    id: 'agent-info',
    name: 'Agente Info',
    icon: '📊',
    borderColor: 'border-purple-500/40',
    bgColor: 'bg-purple-500/5',
    btnColor: 'bg-purple-500 hover:bg-purple-400 text-white',
    statusColor: 'text-purple-400 bg-purple-500/20',
    description: 'Actualiza la información y puntuación de confianza de todas las empresas. Detecta inactivas y genera estadísticas por sector.',
    capabilities: [
      '⭐ Actualiza scores de confianza',
      '⚠ Detecta empresas inactivas',
      '📈 Estadísticas por sector',
      '🏆 Score promedio del sistema',
    ],
  },
  {
    id: 'agent-telegram',
    name: 'Agente Telegram',
    icon: '📱',
    borderColor: 'border-green-500/40',
    bgColor: 'bg-green-500/5',
    btnColor: 'bg-green-500 hover:bg-green-400 text-white',
    statusColor: 'text-green-400 bg-green-500/20',
    description: 'Envía resúmenes y alertas de los mejores descuentos directamente a tu Telegram. Requiere token y chat ID configurados.',
    capabilities: [
      '🥇 Top 5 mejores descuentos',
      '🔗 Links directos a productos',
      '🎯 Top 3 predicciones IA',
      '⚡ Envío instantáneo a @CuponMaestricos_bot',
    ],
  },
];

export default function AgentsPage() {
  const {
    agents, logs, clearLogs, addLog, discounts, companies, settings,
    updateAgentStatus, incrementAgentTasks, addDiscount, updateCompany, addCompany, isScanning, setIsScanning,
  } = useAppStore();

  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const recentLogs = logs.slice(0, 80);
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);

  async function handleRunAgent(agentId: string) {
    if (runningAgent || isScanning) return;
    setRunningAgent(agentId);
    updateAgentStatus(agentId, 'running');

    try {
      if (agentId === 'agent-cupones') {
        setIsScanning(true);
        await runFullScan(
          companies,
          settings.groqApiKey,
          (agentName, msg, type) => addLog({ agentName, message: msg, type }),
          (d) => addDiscount(d),
          (id, data) => updateCompany(id, data)
        );
        setIsScanning(false);
        const total = useAppStore.getState().discounts.filter((d) => !d.predictedDiscount).length;
        addLog({ agentName: 'Agente Cupones', message: `✅ Escaneo completo — ${total} descuentos activos en total`, type: 'success' });
      } else if (agentId === 'agent-empresas') {
        const toAdd = await runCompanyDiscoveryAgent(
          companies,
          (msg, type) => addLog({ agentName: 'Agente Empresas', message: msg, type })
        );
        for (const c of toAdd) addCompany(c);
        addLog({
          agentName: 'Agente Empresas',
          message: toAdd.length > 0
            ? `✅ ${toAdd.length} empresa(s) nueva(s) agregada(s) al sistema`
            : '✅ Sin empresas nuevas para agregar en este ciclo',
          type: toAdd.length > 0 ? 'success' : 'info',
        });
      } else if (agentId === 'agent-info') {
        await runInfoAgent(
          companies,
          (msg, type) => addLog({ agentName: 'Agente Info', message: msg, type }),
          (id, data) => updateCompany(id, data)
        );
      } else if (agentId === 'agent-telegram') {
        const hasTelegram = !!(settings.telegramBotToken && settings.telegramChatId);
        if (!hasTelegram) {
          addLog({ agentName: 'Agente Telegram', message: '⚠ Configura el Bot Token y Chat ID en Configuración → Notificaciones por Telegram', type: 'warning' });
        } else {
          addLog({ agentName: 'Agente Telegram', message: '📤 Preparando resumen de descuentos...', type: 'info' });
          const msg = buildDailyDigest(discounts);
          const result = await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, msg);
          if (result.ok) {
            addLog({
              agentName: 'Agente Telegram',
              message: `✅ Resumen enviado con ${discounts.filter((d) => !d.predictedDiscount).length} descuentos activos`,
              type: 'success',
            });
          } else {
            addLog({ agentName: 'Agente Telegram', message: `❌ Error Telegram: ${result.error}`, type: 'error' });
          }
        }
      }

      updateAgentStatus(agentId, 'completed');
      incrementAgentTasks(agentId);
    } catch (err) {
      updateAgentStatus(agentId, 'error');
      addLog({ agentName: agentId, message: `❌ Error: ${(err as Error).message}`, type: 'error' });
      if (agentId === 'agent-cupones') setIsScanning(false);
    } finally {
      setRunningAgent(null);
    }
  }

  async function handleRunAll() {
    for (const cfg of AGENTS_CONFIG) {
      if (runningAgent || isScanning) break;
      await handleRunAgent(cfg.id);
    }
  }

  const isBusy = !!runningAgent || isScanning;

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Agentes Virtuales</h2>
          <p className="text-gray-400 text-sm mt-0.5">4 agentes especializados — ejecuta individualmente o todos a la vez</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-400">
              {agents.filter((a) => a.status === 'running').length} activos
            </span>
            <span className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-400">
              {totalTasks} tareas
            </span>
          </div>
          <button
            onClick={handleRunAll}
            disabled={isBusy}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isBusy ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
            }`}
          >
            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Ejecutar todos
          </button>
        </div>
      </div>

      {/* 4 Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {AGENTS_CONFIG.map((cfg) => {
          const agent = agents.find((a) => a.id === cfg.id);
          const isRunning = runningAgent === cfg.id;
          const status = agent?.status ?? 'idle';

          return (
            <div key={cfg.id} className={`border ${cfg.borderColor} ${cfg.bgColor} rounded-xl p-5 space-y-4`}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-4xl flex-shrink-0">{cfg.icon}</span>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-base">{cfg.name}</h3>
                    <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{cfg.description}</p>
                  </div>
                </div>
                {/* Status pill */}
                <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 font-medium ${
                  status === 'running'   ? 'text-blue-400   bg-blue-500/20'   :
                  status === 'completed' ? 'text-green-400  bg-green-500/20'  :
                  status === 'error'     ? 'text-red-400    bg-red-500/20'    :
                  'text-gray-400 bg-gray-800'
                }`}>
                  {status === 'running'   ? '⚡ Ejecutando'  :
                   status === 'completed' ? '✓ Completado'  :
                   status === 'error'     ? '✗ Error'       : '⏸ En espera'}
                </span>
              </div>

              {/* Capabilities */}
              <ul className="grid grid-cols-2 gap-1.5">
                {cfg.capabilities.map((cap) => (
                  <li key={cap} className="text-gray-400 text-xs flex items-start gap-1">
                    <span className="flex-shrink-0">{cap.split(' ')[0]}</span>
                    <span>{cap.split(' ').slice(1).join(' ')}</span>
                  </li>
                ))}
              </ul>

              {/* Footer: stats + run button */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-800/70">
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>🎯 {agent?.tasksCompleted ?? 0} {(agent?.tasksCompleted ?? 0) === 1 ? 'tarea' : 'tareas'}</span>
                  <span>
                    🕐 {agent?.lastRun
                      ? formatDistanceToNow(new Date(agent.lastRun), { locale: es, addSuffix: true })
                      : 'Nunca ejecutado'}
                  </span>
                </div>
                <button
                  onClick={() => handleRunAgent(cfg.id)}
                  disabled={isBusy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isBusy ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : cfg.btnColor
                  }`}
                >
                  {isRunning
                    ? <><Loader2 size={14} className="animate-spin" /> Ejecutando...</>
                    : <><Play size={14} /> Ejecutar</>
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Empresas Activas',  value: companies.filter((c) => c.active).length,         color: 'text-blue-400'   },
          { label: 'Descuentos Activos', value: discounts.filter((d) => !d.predictedDiscount).length, color: 'text-yellow-400' },
          { label: 'Predicciones IA',    value: discounts.filter((d) => d.predictedDiscount).length,  color: 'text-purple-400' },
          { label: 'Tareas Ejecutadas',  value: totalTasks,                                           color: 'text-green-400'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Activity log */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ActivitySquare size={16} className="text-yellow-500" />
            Log de Actividad
            <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{logs.length}</span>
          </h3>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors"
          >
            <Trash2 size={13} /> Limpiar
          </button>
        </div>
        <div className="divide-y divide-gray-800/50 max-h-[480px] overflow-y-auto">
          {recentLogs.length > 0 ? recentLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/30 transition-colors">
              <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                log.type === 'success' ? 'bg-green-500'  :
                log.type === 'error'   ? 'bg-red-500'    :
                log.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-gray-300 text-xs font-medium">{log.agentName}</span>
                  <span className="text-gray-600 text-xs">
                    {formatDistanceToNow(new Date(log.timestamp), { locale: es, addSuffix: true })}
                  </span>
                </div>
                <p className={`text-xs break-words ${
                  log.type === 'success' ? 'text-green-400'  :
                  log.type === 'error'   ? 'text-red-400'    :
                  log.type === 'warning' ? 'text-yellow-400' : 'text-gray-400'
                }`}>{log.message}</p>
              </div>
            </div>
          )) : (
            <div className="px-5 py-16 text-center text-gray-500 text-sm">
              <span className="text-5xl block mb-3">🤖</span>
              Los registros de actividad aparecerán aquí cuando ejecutes un agente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
