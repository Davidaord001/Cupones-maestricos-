import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LayoutDashboard, Building2, Tag, BarChart3, Bot, Settings, Zap, GitCompare, TrendingUp } from 'lucide-react';

const tabs = [
  { id: 'dashboard',   label: 'Salpicadero',  icon: LayoutDashboard },
  { id: 'companies',   label: 'Empresas',      icon: Building2 },
  { id: 'discounts',   label: 'Descuentos',    icon: Tag },
  { id: 'comparator',  label: 'Comparador',    icon: GitCompare },
  { id: 'historial',   label: 'Historial',     icon: TrendingUp },
  { id: 'analytics',   label: 'Análisis',      icon: BarChart3 },
  { id: 'agents',      label: 'Agentes',       icon: Bot },
  { id: 'settings',    label: 'Configuración', icon: Settings },
];

export default function Sidebar() {
  const { activeTab, setActiveTab, isScanning, agents } = useAppStore();
  const runningAgents = agents.filter((a) => a.status === 'running').length;

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500 to-red-600 flex items-center justify-center text-white font-bold text-lg">
            🇪🇨
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Ecuador Agents</h1>
            <p className="text-gray-400 text-xs">Monitor de Descuentos IA</p>
          </div>
        </div>
      </div>

      {/* Status bar */}
      {isScanning && (
        <div className="mx-4 mt-4 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
          <Zap size={14} className="text-blue-400 animate-pulse" />
          <span className="text-blue-400 text-xs font-medium">
            {runningAgents} agente{runningAgents !== 1 ? 's' : ''} activo{runningAgents !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={18} />
              {label}
              {id === 'agents' && runningAgents > 0 && (
                <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {runningAgents}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs text-center">Powered by Groq AI</p>
      </div>
    </aside>
  );
}
