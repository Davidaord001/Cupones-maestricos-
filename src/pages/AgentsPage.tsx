import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Bot, CheckCircle, XCircle, Clock, Loader2, Trash2, ActivitySquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CONFIG = {
  idle: { label: 'En espera', color: 'text-gray-400', bg: 'bg-gray-800', dot: 'bg-gray-500', icon: Clock },
  running: { label: 'Ejecutando', color: 'text-blue-400', bg: 'bg-blue-500/10 border border-blue-500/30', dot: 'bg-blue-500 animate-pulse', icon: Loader2 },
  completed: { label: 'Completado', color: 'text-green-400', bg: 'bg-green-500/10 border border-green-500/30', dot: 'bg-green-500', icon: CheckCircle },
  error: { label: 'Error', color: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30', dot: 'bg-red-500', icon: XCircle },
};

export default function AgentsPage() {
  const { agents, logs, clearLogs } = useAppStore();

  const recentLogs = logs.slice(0, 50);
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Agents grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const config = STATUS_CONFIG[agent.status];
          const StatusIcon = config.icon;
          return (
            <div key={agent.id} className={`bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{agent.icon}</div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">{agent.name}</h4>
                    <p className="text-gray-500 text-xs">{agent.role}</p>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${config.bg} ${config.color}`}>
                <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                <StatusIcon size={12} className={agent.status === 'running' ? 'animate-spin' : ''} />
                {config.label}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-white font-bold text-lg">{agent.tasksCompleted}</p>
                  <p className="text-gray-500 text-xs">Tareas</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-white font-bold text-xs leading-tight">
                    {agent.lastRun
                      ? formatDistanceToNow(new Date(agent.lastRun), { locale: es, addSuffix: true })
                      : 'Nunca'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Último run</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Agentes', value: agents.length, color: 'text-white' },
          { label: 'Activos', value: agents.filter((a) => a.status === 'running').length, color: 'text-blue-400' },
          { label: 'Completados', value: agents.filter((a) => a.status === 'completed').length, color: 'text-green-400' },
          { label: 'Tareas Totales', value: totalTasks, color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ActivitySquare size={16} className="text-yellow-500" /> Log de Actividad
            <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{logs.length}</span>
          </h3>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors"
          >
            <Trash2 size={13} /> Limpiar
          </button>
        </div>

        <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
          {recentLogs.length > 0 ? recentLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/30 transition-colors">
              <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                log.type === 'success' ? 'bg-green-500' :
                log.type === 'error' ? 'bg-red-500' :
                log.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-gray-300 text-xs font-medium">{log.agentName}</span>
                  <span className="text-gray-600 text-xs">
                    {formatDistanceToNow(new Date(log.timestamp), { locale: es, addSuffix: true })}
                  </span>
                </div>
                <p className={`text-xs ${
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warning' ? 'text-yellow-400' : 'text-gray-400'
                }`}>{log.message}</p>
              </div>
            </div>
          )) : (
            <div className="px-5 py-12 text-center text-gray-500 text-sm">
              <Bot size={28} className="mx-auto mb-2 text-gray-700" />
              Los registros de actividad aparecerán aquí durante el escaneo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
