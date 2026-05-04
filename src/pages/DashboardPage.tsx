import React from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Building2, Tag, TrendingUp, Bot, Activity, ArrowUpRight, Clock, Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#EAB308', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6'];

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { companies, discounts, agents, logs } = useAppStore();

  const activeDiscounts = discounts.filter((d) => !d.predictedDiscount);
  const predictions = discounts.filter((d) => d.predictedDiscount);
  const avgDiscount = activeDiscounts.length
    ? Math.round(activeDiscounts.reduce((sum, d) => sum + (d.discountPercent ?? 0), 0) / activeDiscounts.length)
    : 0;

  // Datos para gráfico de actividad (últimas 7 horas simuladas)
  const activityData = Array.from({ length: 7 }, (_, i) => ({
    hora: `${(new Date().getHours() - 6 + i + 24) % 24}:00`,
    descuentos: Math.floor(Math.random() * 8),
    predicciones: Math.floor(Math.random() * 4),
  }));

  // Datos por sector
  const sectorData = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.sector] = (acc[c.sector] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(sectorData).map(([name, value]) => ({ name, value }));

  // Descuentos por empresa (top 5)
  const topCompanies = [...companies]
    .sort((a, b) => b.discountsFound - a.discountsFound)
    .slice(0, 5)
    .map((c) => ({ empresa: c.name.slice(0, 12), descuentos: c.discountsFound, confianza: c.trustScore }));

  const recentLogs = logs.slice(0, 6);

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Empresas Monitoreadas" value={companies.filter((c) => c.active).length} sub={`${companies.length} en total`} color="bg-blue-600" />
        <StatCard icon={Tag} label="Descuentos Activos" value={activeDiscounts.length} sub={`~${avgDiscount}% promedio`} color="bg-yellow-600" />
        <StatCard icon={TrendingUp} label="Predicciones IA" value={predictions.length} sub="próximos 30 días" color="bg-purple-600" />
        <StatCard icon={Bot} label="Agentes Activos" value={agents.filter((a) => a.status === 'running').length} sub={`${agents.length} disponibles`} color="bg-green-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Activity */}
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity size={16} className="text-yellow-500" /> Actividad en Tiempo Real
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="cDesc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cPred" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="hora" stroke="#6B7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
              <Area type="monotone" dataKey="descuentos" stroke="#EAB308" fill="url(#cDesc)" strokeWidth={2} name="Descuentos" />
              <Area type="monotone" dataKey="predicciones" stroke="#8B5CF6" fill="url(#cPred)" strokeWidth={2} name="Predicciones" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sectors Pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Sectores Monitoreados</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-400">{d.name}</span>
                    <span className="ml-auto text-gray-500">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm text-center mt-8">Sin datos</p>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top companies */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ArrowUpRight size={16} className="text-green-500" /> Top Empresas por Descuentos
          </h3>
          {topCompanies.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topCompanies} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis type="number" stroke="#6B7280" tick={{ fontSize: 11 }} />
                <YAxis dataKey="empresa" type="category" stroke="#6B7280" tick={{ fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="descuentos" fill="#EAB308" radius={[0, 4, 4, 0]} name="Descuentos" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center mt-10">Inicia un escaneo para ver datos</p>
          )}
        </div>

        {/* Recent logs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Zap size={16} className="text-blue-500" /> Actividad Reciente
          </h3>
          <div className="space-y-2">
            {recentLogs.length > 0 ? recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  log.type === 'success' ? 'bg-green-500' :
                  log.type === 'error' ? 'bg-red-500' :
                  log.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="text-gray-400 font-medium">{log.agentName}: </span>
                  <span className="text-gray-500">{log.message}</span>
                </div>
                <span className="text-gray-600 flex-shrink-0 flex items-center gap-1">
                  <Clock size={10} />
                  {formatDistanceToNow(new Date(log.timestamp), { locale: es, addSuffix: true })}
                </span>
              </div>
            )) : (
              <p className="text-gray-500 text-sm text-center mt-6">Sin actividad aún. Inicia un escaneo.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
