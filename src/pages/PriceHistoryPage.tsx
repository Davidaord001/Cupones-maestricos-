import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { History, Search, TrendingDown, TrendingUp, ExternalLink, ShoppingCart, BarChart2, X } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../services/currencyService';
import type { PriceHistoryEntry } from '../store/types';

// Paleta de colores para las tiendas
const STORE_COLORS = [
  '#facc15', '#60a5fa', '#34d399', '#f87171', '#a78bfa',
  '#fb923c', '#38bdf8', '#4ade80', '#f472b6', '#a3e635',
];

function normalizeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ');
}

interface ProductGroup {
  key: string;
  displayTitle: string;
  imageUrl?: string;
  sector: string;
  stores: string[];
  entries: PriceHistoryEntry[];
  latestPriceUSD: number | null;
  lowestPriceUSD: number | null;
  highestPriceUSD: number | null;
  bestStore: string | null;
  priceDropPct: number | null;
}

function toUSD(price: number, currency: 'USD' | 'COP', rate: number): number {
  return currency === 'COP' ? price / rate : price;
}

export default function PriceHistoryPage() {
  const { priceHistory, exchangeRates, urlChecks } = useAppStore();

  // Devuelve la mejor URL: usa alternativa verificada si el link directo está roto
  function getBuyUrl(sourceUrl: string): { url: string; isFallback: boolean } {
    const check = urlChecks[sourceUrl];
    if (check?.status === 'broken' && check?.alternativeUrl) {
      return { url: check.alternativeUrl, isFallback: true };
    }
    return { url: sourceUrl, isFallback: false };
  }
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('Todos');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sectors = ['Todos', ...Array.from(new Set(priceHistory.map((e) => e.sector))).sort()];

  // Agrupar por productKey
  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, PriceHistoryEntry[]>();
    for (const entry of priceHistory) {
      const k = entry.productKey || normalizeKey(entry.productTitle);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(entry);
    }

    const result: ProductGroup[] = [];
    for (const [key, entries] of map.entries()) {
      const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const latest = sorted[sorted.length - 1];
      const stores = [...new Set(entries.map((e) => e.store))];
      const pricesUSD = entries
        .filter((e) => e.price > 0)
        .map((e) => toUSD(e.price, e.currency, exchangeRates.USD_COP));
      const latestUSD = latest.price > 0 ? toUSD(latest.price, latest.currency, exchangeRates.USD_COP) : null;
      const minUSD = pricesUSD.length > 0 ? Math.min(...pricesUSD) : null;
      const maxUSD = pricesUSD.length > 0 ? Math.max(...pricesUSD) : null;

      // Mejor tienda = la que tiene el precio más bajo HOY (últimas 48h)
      const recentEntries = entries.filter(
        (e) => Date.now() - new Date(e.date).getTime() < 48 * 3600 * 1000 && e.price > 0
      );
      const bestEntry = recentEntries.length > 0
        ? recentEntries.reduce((a, b) =>
            toUSD(a.price, a.currency, exchangeRates.USD_COP) <
            toUSD(b.price, b.currency, exchangeRates.USD_COP) ? a : b)
        : null;

      // Variación de precio (primer precio vs más reciente)
      const firstUSD = pricesUSD.length > 0 ? pricesUSD[0] : null;
      const dropPct = firstUSD && latestUSD && firstUSD > 0
        ? Math.round(((firstUSD - latestUSD) / firstUSD) * 100)
        : null;

      result.push({
        key,
        displayTitle: entries[0].productTitle,
        imageUrl: entries.find((e) => e.imageUrl)?.imageUrl,
        sector: entries[0].sector,
        stores,
        entries: sorted,
        latestPriceUSD: latestUSD,
        lowestPriceUSD: minUSD,
        highestPriceUSD: maxUSD,
        bestStore: bestEntry?.store ?? null,
        priceDropPct: dropPct,
      });
    }

    return result
      .filter((g) => {
        const matchSearch = search === '' ||
          g.displayTitle.toLowerCase().includes(search.toLowerCase()) ||
          g.stores.some((s) => s.toLowerCase().includes(search.toLowerCase()));
        const matchSector = sectorFilter === 'Todos' || g.sector === sectorFilter;
        return matchSearch && matchSector;
      })
      .sort((a, b) => (b.entries.length) - (a.entries.length));
  }, [priceHistory, search, sectorFilter, exchangeRates]);

  const selected = selectedKey ? groups.find((g) => g.key === selectedKey) : null;

  // Construir datos del gráfico para el producto seleccionado
  const chartData = useMemo(() => {
    if (!selected) return [];
    const storeList = selected.stores;
    // Agrupar por fecha (día) y tienda
    const dayMap = new Map<string, Record<string, number>>();
    for (const entry of selected.entries) {
      const day = entry.date.slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, {});
      const usd = toUSD(entry.price, entry.currency, exchangeRates.USD_COP);
      dayMap.get(day)![entry.store] = Math.round(usd * 100) / 100;
    }
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, prices]) => ({
        date: day.slice(5), // MM-DD
        fullDate: day,
        ...prices,
        _stores: storeList,
      }));
  }, [selected, exchangeRates]);

  function formatPrice(price: number, currency: 'USD' | 'COP'): string {
    if (currency === 'COP') return formatCurrency(price, 'COP');
    return `$${price.toFixed(0)}`;
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <History size={22} className="text-blue-400" />
            Historial de Precios
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Evolución de precios en múltiples tiendas — detecta el mejor momento para comprar
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2">
          <BarChart2 size={14} className="text-blue-400" />
          <span className="text-blue-300 text-sm font-bold">{priceHistory.length} registros</span>
          <span className="text-gray-500 text-xs">de {groups.length} productos</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar producto o tienda..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedKey(null); }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          {sectors.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-gray-500 text-sm ml-auto">{groups.length} producto{groups.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Vista detalle (gráfico) */}
      {selected && (
        <div className="bg-gray-900 border border-blue-500/30 rounded-xl overflow-hidden">
          {/* Header detalle */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {selected.imageUrl && (
                <div className="w-12 h-12 bg-white rounded-lg overflow-hidden flex-shrink-0">
                  <img src={selected.imageUrl} alt={selected.displayTitle} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                </div>
              )}
              <div>
                <h3 className="text-white font-bold text-sm">{selected.displayTitle}</h3>
                <p className="text-gray-500 text-xs">{selected.stores.length} tiendas · {selected.entries.length} registros de precio</p>
              </div>
            </div>
            <button onClick={() => setSelectedKey(null)} className="text-gray-500 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          {/* Stats rápidas */}
          <div className="grid grid-cols-3 gap-0 divide-x divide-gray-800 border-b border-gray-800">
            {[
              { label: 'Precio más bajo (histórico)', value: selected.lowestPriceUSD ? `$${selected.lowestPriceUSD.toFixed(0)}` : '—', color: 'text-green-400' },
              { label: 'Precio más alto (histórico)', value: selected.highestPriceUSD ? `$${selected.highestPriceUSD.toFixed(0)}` : '—', color: 'text-red-400' },
              { label: 'Bajó desde el inicio', value: selected.priceDropPct !== null ? `${selected.priceDropPct > 0 ? '-' : '+'}${Math.abs(selected.priceDropPct)}%` : '—', color: selected.priceDropPct !== null && selected.priceDropPct > 0 ? 'text-green-400' : 'text-yellow-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center">
                <p className={`text-xl font-black ${color}`}>{value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <div className="p-5">
            <p className="text-gray-400 text-xs mb-3 font-semibold uppercase tracking-wide">Evolución del precio en USD</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#f9fafb', fontWeight: 'bold' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => {
                    const num = typeof value === 'number' ? value : Number(value);
                    return `$${isNaN(num) ? '—' : num.toFixed(0)} USD`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                {selected.stores.map((store, idx) => (
                  <Line
                    key={store}
                    type="monotone"
                    dataKey={store}
                    name={store}
                    stroke={STORE_COLORS[idx % STORE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: STORE_COLORS[idx % STORE_COLORS.length], r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Mejores precios actuales por tienda */}
          <div className="px-5 pb-5">
            <p className="text-gray-400 text-xs mb-3 font-semibold uppercase tracking-wide">Precios actuales por tienda</p>
            <div className="space-y-2">
              {selected.stores
                .map((store) => {
                  const storeEntries = selected.entries.filter((e) => e.store === store);
                  const latest = storeEntries[storeEntries.length - 1];
                  return { store, latest };
                })
                .sort((a, b) => toUSD(a.latest.price, a.latest.currency, exchangeRates.USD_COP) - toUSD(b.latest.price, b.latest.currency, exchangeRates.USD_COP))
                .map(({ store, latest }, idx) => {
                  const usd = toUSD(latest.price, latest.currency, exchangeRates.USD_COP);
                  const isBest = idx === 0 && selected.stores.length > 1;
                  const { url: buyUrl, isFallback } = getBuyUrl(latest.sourceUrl);
                  return (
                    <div key={store} className={`flex items-center justify-between px-4 py-3 rounded-lg ${isBest ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800/60'}`}>
                      <div className="flex items-center gap-3">
                        <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}</span>
                        <div>
                          <p className={`font-semibold text-sm ${isBest ? 'text-green-300' : 'text-white'}`}>{store}</p>
                          <p className="text-gray-500 text-xs">
                            {formatDistanceToNow(new Date(latest.date), { locale: es, addSuffix: true })}
                            {latest.discountPercent ? ` · -${latest.discountPercent}% OFF` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-black text-lg ${isBest ? 'text-green-400' : 'text-white'}`}>
                            {latest.currency === 'COP' ? formatCurrency(latest.price, 'COP') : `$${latest.price.toFixed(0)}`}
                          </p>
                          {latest.currency === 'COP' && (
                            <p className="text-gray-500 text-xs">≈ ${usd.toFixed(0)} USD</p>
                          )}
                        </div>
                        <a href={buyUrl} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isBest ? 'bg-green-500 hover:bg-green-400 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                          <ExternalLink size={11} />
                          {isFallback ? 'Buscar' : 'Ir a comprar'}
                        </a>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Lista de productos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isSelected = selectedKey === group.key;
          const latestEntries = group.entries
            .filter((e) => Date.now() - new Date(e.date).getTime() < 72 * 3600 * 1000)
            .slice(0, 3);

          return (
            <div
              key={group.key}
              onClick={() => setSelectedKey(isSelected ? null : group.key)}
              className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 ${
                isSelected ? 'border-blue-500/60 ring-1 ring-blue-500/20' : 'border-gray-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Imagen */}
                {group.imageUrl ? (
                  <div className="w-14 h-14 bg-white rounded-lg flex-shrink-0 overflow-hidden">
                    <img src={group.imageUrl} alt={group.displayTitle} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center">
                    <ShoppingCart size={22} className="text-gray-600" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-semibold text-sm leading-tight truncate">{group.displayTitle}</h3>
                    {group.priceDropPct !== null && group.priceDropPct > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full flex-shrink-0 font-bold">
                        <TrendingDown size={10} />
                        -{group.priceDropPct}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{group.sector}</span>
                    <span className="text-gray-500 text-xs">{group.stores.length} tiendas · {group.entries.length} registros</span>
                  </div>

                  {/* Rango de precios */}
                  <div className="flex items-center gap-3 mt-2">
                    {group.lowestPriceUSD && (
                      <div className="flex items-center gap-1">
                        <TrendingDown size={11} className="text-green-400" />
                        <span className="text-green-400 text-xs font-bold">${group.lowestPriceUSD.toFixed(0)} mín</span>
                      </div>
                    )}
                    {group.highestPriceUSD && group.highestPriceUSD !== group.lowestPriceUSD && (
                      <div className="flex items-center gap-1">
                        <TrendingUp size={11} className="text-red-400" />
                        <span className="text-red-400 text-xs">${group.highestPriceUSD.toFixed(0)} máx</span>
                      </div>
                    )}
                    {group.bestStore && (
                      <span className="text-blue-400 text-xs ml-auto">Mejor: {group.bestStore.split(' ')[0]}</span>
                    )}
                  </div>

                  {/* Mini-historial (últimas entradas) */}
                  {latestEntries.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {latestEntries.map((e) => (
                        <span key={e.id} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                          {e.store.split(' ')[0]}: {e.currency === 'COP' ? formatCurrency(e.price, 'COP') : `$${e.price}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CTA */}
              <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-gray-600 text-xs">
                  Último registro: {formatDistanceToNow(new Date(group.entries[group.entries.length - 1].date), { locale: es, addSuffix: true })}
                </span>
                <span className={`text-xs font-semibold flex items-center gap-1 ${isSelected ? 'text-blue-400' : 'text-gray-500'}`}>
                  {isSelected ? '▲ Ver menos' : '▼ Ver gráfico de precios'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <History size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Sin historial de precios aún</p>
          <p className="text-gray-600 text-sm mt-1">Ejecuta el Agente Historial para registrar los precios actuales.</p>
        </div>
      )}
    </div>
  );
}
