import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { BarChart3, TrendingUp, Brain, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { generateDiscountSummary } from '../services/groqService';

const COLORS = ['#EAB308', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#F97316'];

export default function AnalyticsPage() {
  const { discounts, companies, settings, addLog } = useAppStore();
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Datos por sector con descuentos
  const sectorStats = companies.reduce<Record<string, { discounts: number; avgPct: number; companies: number }>>((acc, c) => {
    const compDiscounts = discounts.filter((d) => d.companyId === c.id && !d.predictedDiscount);
    if (!acc[c.sector]) acc[c.sector] = { discounts: 0, avgPct: 0, companies: 0 };
    acc[c.sector].discounts += compDiscounts.length;
    acc[c.sector].companies += 1;
    const pcts = compDiscounts.map((d) => d.discountPercent ?? 0).filter((p) => p > 0);
    acc[c.sector].avgPct = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0;
    return acc;
  }, {});

  const sectorChartData = Object.entries(sectorStats).map(([name, v]) => ({
    sector: name.slice(0, 10),
    descuentos: v.discounts,
    porcentaje: v.avgPct,
    empresas: v.companies,
  }));

  // Radar de empresas top
  const topCompanies = [...companies].sort((a, b) => b.discountsFound - a.discountsFound).slice(0, 6);
  const radarData = [
    { metric: 'Descuentos', ...Object.fromEntries(topCompanies.map((c) => [c.name.slice(0, 8), c.discountsFound])) },
    { metric: 'Confianza', ...Object.fromEntries(topCompanies.map((c) => [c.name.slice(0, 8), c.trustScore])) },
  ];

  // Predicciones: scatter chart confianza vs % descuento
  const scatterData = discounts
    .filter((d) => d.predictedDiscount)
    .map((d) => ({
      x: d.confidence,
      y: d.discountPercent ?? 0,
      z: 20,
      name: d.companyName,
    }));

  // Línea temporal de detecciones
  const timelineData: Record<string, number> = {};
  discounts.forEach((d) => {
    const key = new Date(d.detectedAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    timelineData[key] = (timelineData[key] ?? 0) + 1;
  });
  const timelineChart = Object.entries(timelineData).slice(-12).map(([time, count]) => ({ time, count }));

  async function handleGenerateSummary() {
    if (!settings.groqApiKey || loadingSummary) return;
    setLoadingSummary(true);
    addLog({ agentName: 'Analyst Pro', message: 'Generando resumen IA de descuentos...', type: 'info' });
    try {
      const summary = await generateDiscountSummary(
        settings.groqApiKey,
        discounts.filter((d) => !d.predictedDiscount).map((d) => ({
          companyName: d.companyName,
          title: d.title,
          discountPercent: d.discountPercent,
          sector: d.sector,
        }))
      );
      setAiSummary(summary);
      addLog({ agentName: 'Analyst Pro', message: 'Resumen IA generado exitosamente', type: 'success' });
    } catch (err) {
      addLog({ agentName: 'Analyst Pro', message: `Error generando resumen: ${(err as Error).message}`, type: 'error' });
    } finally {
      setLoadingSummary(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* AI Summary */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Brain size={18} className="text-purple-400" /> Análisis IA con Groq
          </h3>
          <button
            onClick={handleGenerateSummary}
            disabled={!settings.groqApiKey || loadingSummary}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              settings.groqApiKey && !loadingSummary
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loadingSummary ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loadingSummary ? 'Analizando...' : 'Generar Análisis'}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-gray-300 text-sm leading-relaxed">{aiSummary}</p>
        ) : (
          <p className="text-gray-500 text-sm">
            {settings.groqApiKey
              ? 'Haz clic en "Generar Análisis" para obtener un resumen inteligente de los descuentos detectados.'
              : 'Configura tu API key de Groq en la sección de Configuración para activar el análisis IA.'}
          </p>
        )}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Sector bar chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-yellow-500" /> Descuentos por Sector
          </h3>
          {sectorChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sectorChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="sector" stroke="#6B7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="descuentos" fill="#EAB308" radius={[4, 4, 0, 0]} name="Descuentos" />
                <Bar dataKey="porcentaje" fill="#3B82F6" radius={[4, 4, 0, 0]} name="% Promedio" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-gray-600 flex-col gap-2">
              <AlertCircle size={24} />
              <p className="text-sm">Sin datos. Ejecuta un escaneo.</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" /> Detecciones en el Tiempo
          </h3>
          {timelineChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timelineChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="time" stroke="#6B7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} name="Detecciones" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-gray-600 flex-col gap-2">
              <AlertCircle size={24} />
              <p className="text-sm">Sin historial aún.</p>
            </div>
          )}
        </div>
      </div>

      {/* Predicciones scatter */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-500" /> Mapa de Predicciones (Confianza vs % Descuento Estimado)
        </h3>
        {scatterData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="x" type="number" name="Confianza %" domain={[0, 100]} stroke="#6B7280" tick={{ fontSize: 11 }} label={{ value: 'Confianza (%)', position: 'insideBottom', offset: -5, fill: '#6B7280', fontSize: 11 }} />
              <YAxis dataKey="y" type="number" name="Desc. %" stroke="#6B7280" tick={{ fontSize: 11 }} label={{ value: '% Descuento', angle: -90, position: 'insideLeft', fill: '#6B7280', fontSize: 11 }} />
              <ZAxis dataKey="z" range={[40, 160]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(value, name) => [value, name === 'x' ? 'Confianza %' : '% Descuento']}
              />
              <Scatter data={scatterData} fill="#8B5CF6" fillOpacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-600 flex-col gap-2">
            <Sparkles size={24} />
            <p className="text-sm">Las predicciones IA aparecerán aquí tras el escaneo.</p>
          </div>
        )}
      </div>

      {/* Company trust scores */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Puntuación de Confianza por Empresa</h3>
        <div className="space-y-3">
          {[...companies].sort((a, b) => b.trustScore - a.trustScore).map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="text-gray-600 text-xs w-5 text-right">{i + 1}</span>
              <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-xs text-gray-400">
                {c.name.charAt(0)}
              </div>
              <span className="text-gray-300 text-sm w-36 truncate">{c.name}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${c.trustScore}%`,
                    background: c.trustScore > 80 ? '#10B981' : c.trustScore > 60 ? '#EAB308' : '#EF4444',
                  }}
                />
              </div>
              <span className="text-gray-400 text-xs w-10 text-right">{c.trustScore}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
