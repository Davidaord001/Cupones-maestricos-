/**
 * ShopPage — Página unificada: Descuentos + Comparador + Historial
 * Con filtros: País → Provincia → Sector → Búsqueda + Flags de país
 */
import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Tag, Clock, TrendingUp, TrendingDown, Sparkles, Trophy, ArrowUpDown,
  Star, Flame, ShoppingCart, ChevronLeft, ChevronRight, Search, X,
  GitCompare, History, ExternalLink, BarChart2, DollarSign,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { format, formatDistanceToNow, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../services/currencyService';
import type { PriceHistoryEntry } from '../store/types';

const PAGE_SIZE = 20;
type SortKey = 'discount' | 'savings' | 'recent' | 'confidence' | 'price_asc';
type TabId = 'descuentos' | 'comparador' | 'historial';

// ── Mapas de países ────────────────────────────────────────────────────────
const COUNTRY_FLAG: Record<string, string> = {
  Ecuador: '🇪🇨',
  Colombia: '🇨🇴',
  Internacional: '🌎',
  Global: '🌐',
};

const COUNTRY_COLOR: Record<string, string> = {
  Ecuador:       'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  Colombia:      'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Internacional: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Global:        'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

function countryBadge(country: string) {
  const flag = COUNTRY_FLAG[country] ?? '🏳';
  const color = COUNTRY_COLOR[country] ?? 'bg-gray-700 text-gray-400 border-gray-600';
  return { flag, color };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getSavings(d: { discountPercent: number | null; originalPrice: number | null; discountedPrice: number | null }) {
  if (d.originalPrice && d.discountedPrice) return d.originalPrice - d.discountedPrice;
  if (d.originalPrice && d.discountPercent) return d.originalPrice * (d.discountPercent / 100);
  return 0;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/—.*$/, '').replace(/[^a-záéíóúñ0-9 ]/gi, '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
}

function normalizeProductKey(title: string): string {
  return title.toLowerCase().replace(/[^a-záéíóúñ0-9 ]/gi, '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
}

function toUSD(price: number, currency: 'USD' | 'COP', rate: number): number {
  return currency === 'COP' ? price / rate : price;
}

const STORE_COLORS = ['#facc15','#60a5fa','#34d399','#f87171','#a78bfa','#fb923c','#38bdf8','#4ade80','#f472b6','#a3e635'];

// ── Componente principal ───────────────────────────────────────────────────
export default function ShopPage() {
  const { discounts, exchangeRates, priceHistory, urlChecks } = useAppStore();

  const [tab, setTab] = useState<TabId>('descuentos');

  // Filtros globales (compartidos entre tabs)
  const [countryFilter, setCountryFilter] = useState('Todos');
  const [sectorFilter, setSectorFilter] = useState('Todos');
  const [search, setSearch] = useState('');

  // Filtros extra Descuentos
  const [typeFilter, setTypeFilter] = useState<'all' | 'real' | 'predicted'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('discount');
  const [page, setPage] = useState(1);

  // Filtro extra Historial
  const [histSelectedKey, setHistSelectedKey] = useState<string | null>(null);

  // ── Opciones de filtros ──────────────────────────────────────────────────
  const countries = useMemo(() => {
    const set = new Set<string>();
    discounts.forEach((d) => set.add((d as any).country ?? 'Ecuador'));
    priceHistory.forEach((e) => set.add(e.country));
    return ['Todos', ...Array.from(set).sort()];
  }, [discounts, priceHistory]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    discounts.forEach((d) => d.sector && set.add(d.sector));
    priceHistory.forEach((e) => e.sector && set.add(e.sector));
    return ['Todos', ...Array.from(set).sort()];
  }, [discounts, priceHistory]);

  // ── URL inteligente ──────────────────────────────────────────────────────
  function getBuyUrl(sourceUrl: string): { url: string; isFallback: boolean } {
    const check = urlChecks[sourceUrl];
    if (check?.status === 'broken' && check?.alternativeUrl) return { url: check.alternativeUrl, isFallback: true };
    return { url: sourceUrl, isFallback: false };
  }

  // ── TAB: DESCUENTOS ──────────────────────────────────────────────────────
  const filteredDiscounts = useMemo(() => {
    return discounts
      .filter((d) => {
        const country = (d as any).country ?? 'Ecuador';
        const matchType = typeFilter === 'all' || (typeFilter === 'predicted' ? d.predictedDiscount : !d.predictedDiscount);
        const matchSector = sectorFilter === 'Todos' || d.sector === sectorFilter;
        const matchCountry = countryFilter === 'Todos' || country === countryFilter;
        const matchSearch = search === '' ||
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.companyName.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase());
        return matchType && matchSector && matchCountry && matchSearch;
      })
      .sort((a, b) => {
        if (sortKey === 'discount') return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
        if (sortKey === 'savings') return getSavings(b) - getSavings(a);
        if (sortKey === 'confidence') return b.confidence - a.confidence;
        if (sortKey === 'recent') return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
        if (sortKey === 'price_asc') return (a.discountedPrice ?? a.originalPrice ?? 9999) - (b.discountedPrice ?? b.originalPrice ?? 9999);
        return 0;
      });
  }, [discounts, typeFilter, sectorFilter, countryFilter, search, sortKey]);

  const totalPages = Math.ceil(filteredDiscounts.length / PAGE_SIZE);
  const paginated = filteredDiscounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const top3 = useMemo(() =>
    discounts.filter((d) => !d.predictedDiscount && (d.discountPercent ?? 0) > 0)
      .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0)).slice(0, 3),
    [discounts]);

  // ── TAB: COMPARADOR ──────────────────────────────────────────────────────
  const comparatorGroups = useMemo(() => {
    const real = discounts.filter((d) => !d.predictedDiscount && d.discountPercent !== null);
    const map = new Map<string, { key: string; displayName: string; sector: string; items: typeof real[0][] }>();
    for (const d of real) {
      const key = normalizeTitle(d.title);
      if (!map.has(key)) map.set(key, { key, displayName: d.title.split('—')[0].trim(), sector: d.sector, items: [] });
      map.get(key)!.items.push(d);
    }
    let result = Array.from(map.values());
    if (result.filter((g) => g.items.length >= 2).length < 6) {
      result = result;
    } else {
      result = result.filter((g) => g.items.length >= 2);
    }
    return result
      .filter((g) => {
        const country = (g.items[0] as any).country ?? 'Ecuador';
        const matchCountry = countryFilter === 'Todos' || country === countryFilter;
        const matchSector = sectorFilter === 'Todos' || g.sector === sectorFilter;
        const matchSearch = search === '' || g.displayName.toLowerCase().includes(search.toLowerCase()) || g.items.some((i) => i.title.toLowerCase().includes(search.toLowerCase()));
        return matchCountry && matchSector && matchSearch;
      })
      .map((g) => {
        const items = g.items.map((d) => {
          const priceUSD = d.discountedPrice !== null
            ? (((d as any).currency === 'COP') ? d.discountedPrice / exchangeRates.USD_COP : d.discountedPrice)
            : null;
          return { ...d, priceUSD, country: (d as any).country ?? 'Ecuador' };
        }).sort((a, b) => (a.priceUSD ?? 9999) - (b.priceUSD ?? 9999));
        const prices = items.map((i) => i.priceUSD).filter((p): p is number => p !== null);
        const minPrice = prices.length > 0 ? Math.min(...prices) : null;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
        return { ...g, items, minPrice, maxPrice, savings: minPrice !== null && maxPrice !== null ? maxPrice - minPrice : 0 };
      })
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 50);
  }, [discounts, countryFilter, sectorFilter, search, exchangeRates]);

  // ── TAB: HISTORIAL ──────────────────────────────────────────────────────
  const histGroups = useMemo(() => {
    const map = new Map<string, PriceHistoryEntry[]>();
    for (const entry of priceHistory) {
      const k = entry.productKey || normalizeProductKey(entry.productTitle);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(entry);
    }
    return Array.from(map.entries())
      .map(([key, entries]) => {
        const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = sorted[sorted.length - 1];
        const stores = [...new Set(entries.map((e) => e.store))];
        const pricesUSD = entries.filter((e) => e.price > 0).map((e) => toUSD(e.price, e.currency, exchangeRates.USD_COP));
        const firstUSD = pricesUSD[0] ?? null;
        const latestUSD = latest.price > 0 ? toUSD(latest.price, latest.currency, exchangeRates.USD_COP) : null;
        const dropPct = firstUSD && latestUSD && firstUSD > 0 ? Math.round(((firstUSD - latestUSD) / firstUSD) * 100) : null;
        return {
          key, displayTitle: entries[0].productTitle,
          imageUrl: entries.find((e) => e.imageUrl)?.imageUrl,
          sector: entries[0].sector, country: entries[0].country,
          stores, entries: sorted,
          latestPriceUSD: latestUSD,
          lowestPriceUSD: pricesUSD.length > 0 ? Math.min(...pricesUSD) : null,
          highestPriceUSD: pricesUSD.length > 0 ? Math.max(...pricesUSD) : null,
          priceDropPct: dropPct,
        };
      })
      .filter((g) => {
        const matchCountry = countryFilter === 'Todos' || g.country === countryFilter;
        const matchSector = sectorFilter === 'Todos' || g.sector === sectorFilter;
        const matchSearch = search === '' ||
          g.displayTitle.toLowerCase().includes(search.toLowerCase()) ||
          g.stores.some((s) => s.toLowerCase().includes(search.toLowerCase()));
        return matchCountry && matchSector && matchSearch;
      })
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [priceHistory, countryFilter, sectorFilter, search, exchangeRates]);

  const histSelected = histSelectedKey ? histGroups.find((g) => g.key === histSelectedKey) : null;

  const histChartData = useMemo(() => {
    if (!histSelected) return [];
    const dayMap = new Map<string, Record<string, number>>();
    for (const entry of histSelected.entries) {
      const day = entry.date.slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, {});
      dayMap.get(day)![entry.store] = Math.round(toUSD(entry.price, entry.currency, exchangeRates.USD_COP));
    }
    return Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, prices]) => ({ date: day.slice(5), ...prices }));
  }, [histSelected, exchangeRates]);

  // ── Stats globales ──────────────────────────────────────────────────────
  const activeCount = discounts.filter((d) => !d.predictedDiscount).length;
  const predictedCount = discounts.filter((d) => d.predictedDiscount).length;
  const maxDiscount = discounts.reduce((m, d) => Math.max(m, d.discountPercent ?? 0), 0);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'discount', label: '% Mayor descuento' },
    { key: 'savings', label: '$ Mayor ahorro' },
    { key: 'price_asc', label: 'Menor precio' },
    { key: 'recent', label: 'Más reciente' },
    { key: 'confidence', label: 'Mayor confianza' },
  ];

  const medalIcons = ['🥇', '🥈', '🥉'];

  function resetFilters() {
    setSearch(''); setCountryFilter('Todos'); setSectorFilter('Todos');
    setTypeFilter('all'); setPage(1); setHistSelectedKey(null);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">

      {/* ── STATS GLOBALES ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Descuentos Activos', value: activeCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Predicciones IA', value: predictedCount, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
          { label: 'Mayor Descuento', value: `${maxDiscount}%`, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Historial Precios', value: priceHistory.length, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`border rounded-xl p-4 text-center ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTROS GLOBALES ───────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar producto, tienda..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setHistSelectedKey(null); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={13} /></button>}
          </div>

          {/* Sector */}
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            value={sectorFilter}
            onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }}
          >
            {sectors.map((s) => <option key={s}>{s}</option>)}
          </select>

          {/* Reset */}
          {(search || sectorFilter !== 'Todos' || countryFilter !== 'Todos') && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 px-2 py-1 rounded border border-gray-700 hover:border-gray-500">
              <X size={11} /> Limpiar
            </button>
          )}
        </div>

        {/* Flags de país — siempre visibles */}
        <div className="flex flex-wrap gap-2">
          {countries.map((c) => {
            const { flag, color } = countryBadge(c);
            const isActive = countryFilter === c;
            return (
              <button
                key={c}
                onClick={() => { setCountryFilter(c); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                  isActive
                    ? (c === 'Todos' ? 'bg-yellow-500 text-gray-900 border-yellow-500' : `${color} ring-2 ring-white/20`)
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                }`}
              >
                <span>{c === 'Todos' ? '🌍' : flag}</span>
                <span>{c}</span>
                {isActive && c !== 'Todos' && (
                  <span className="text-xs opacity-70">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────── */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
        {([
          { id: 'descuentos', label: 'Descuentos', icon: Tag, count: filteredDiscounts.length },
          { id: 'comparador', label: 'Comparador', icon: GitCompare, count: comparatorGroups.length },
          { id: 'historial',  label: 'Historial',  icon: History, count: histGroups.length },
        ] as { id: TabId; label: string; icon: React.FC<any>; count: number }[]).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
              tab === id ? 'bg-yellow-500 text-gray-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-gray-900/30 text-gray-900' : 'bg-gray-800 text-gray-500'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: DESCUENTOS
      ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'descuentos' && (
        <div className="space-y-4">
          {/* Sub-filtros descuentos */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
              {([['all', 'Todos'], ['real', 'Activos'], ['predicted', 'Predicciones']] as [string, string][]).map(([val, label]) => (
                <button key={val}
                  onClick={() => { setTypeFilter(val as 'all' | 'real' | 'predicted'); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${typeFilter === val ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-400 hover:text-white'}`}
                >{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} className="text-gray-400" />
              <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <span className="ml-auto text-gray-500 text-sm">{filteredDiscounts.length} resultado{filteredDiscounts.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Top 3 */}
          {top3.length >= 3 && countryFilter === 'Todos' && search === '' && (
            <div className="bg-gray-900 border border-yellow-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={18} className="text-yellow-400" />
                <h3 className="text-white font-bold text-sm">Top 3 Mejores Ofertas Ahora</h3>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                {top3.map((d, i) => {
                  const country = (d as any).country ?? 'Ecuador';
                  const { flag, color } = countryBadge(country);
                  const { url: buyUrl, isFallback } = getBuyUrl(d.sourceUrl);
                  return (
                    <div key={d.id} className={`rounded-xl overflow-hidden border flex flex-col ${i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : i === 1 ? 'bg-gray-700/30 border-gray-600/30' : 'bg-amber-900/10 border-amber-700/30'}`}>
                      {d.imageUrl && (
                        <div className="bg-white flex items-center justify-center" style={{ height: '120px' }}>
                          <img src={d.imageUrl} alt={d.title} className="object-contain w-full h-full p-2" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display='none'; }} />
                        </div>
                      )}
                      <div className="p-4 flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{medalIcons[i]}</span>
                          <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${color}`}>{flag} {country}</span>
                          <span className="text-2xl font-black text-yellow-400">-{d.discountPercent}%</span>
                        </div>
                        <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{d.title}</p>
                        <p className="text-gray-400 text-xs">{d.companyName}</p>
                        {d.discountedPrice && (
                          <div className="flex items-center gap-2">
                            {d.originalPrice && <span className="text-gray-500 text-xs line-through">{(d as any).currency === 'COP' ? formatCurrency(d.originalPrice, 'COP') : `$${d.originalPrice}`}</span>}
                            <span className="text-green-400 text-sm font-bold">{(d as any).currency === 'COP' ? formatCurrency(d.discountedPrice, 'COP') : `$${d.discountedPrice}`}</span>
                          </div>
                        )}
                        <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="mt-auto text-xs flex items-center gap-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-3 py-1.5 rounded-lg justify-center">
                          <ShoppingCart size={11} />{isFallback ? 'Buscar →' : 'Ir a comprar →'}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grid de descuentos */}
          {filteredDiscounts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {paginated.map((d) => {
                  const savings = getSavings(d);
                  const country = (d as any).country ?? 'Ecuador';
                  const { flag, color: cColor } = countryBadge(country);
                  const { url: buyUrl, isFallback } = getBuyUrl(d.sourceUrl);
                  return (
                    <div key={d.id} className={`bg-gray-900 border rounded-xl overflow-hidden transition-all hover:border-yellow-500/40 ${d.predictedDiscount ? 'border-purple-500/30' : 'border-gray-800'}`}>
                      {d.imageUrl && (
                        <div className="relative bg-white flex items-center justify-center" style={{ height: '180px' }}>
                          <img src={d.imageUrl} alt={d.title} className="object-contain w-full h-full p-3" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display='none'; }} />
                          {d.discountPercent !== null && (
                            <span className={`absolute top-3 right-3 text-white text-lg font-black px-3 py-1 rounded-xl shadow-lg ${d.predictedDiscount ? 'bg-purple-600' : d.discountPercent >= 40 ? 'bg-red-600' : d.discountPercent >= 25 ? 'bg-orange-500' : 'bg-green-600'}`}>
                              -{d.discountPercent}%
                            </span>
                          )}
                          <span className={`absolute top-3 left-3 text-xs border px-2 py-0.5 rounded-full font-bold backdrop-blur-sm ${cColor}`}>{flag} {country}</span>
                        </div>
                      )}
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {d.predictedDiscount ? <Sparkles size={14} className="text-purple-400 flex-shrink-0" /> : (d.discountPercent ?? 0) >= 40 ? <Flame size={14} className="text-red-400 flex-shrink-0" /> : <Tag size={14} className="text-yellow-400 flex-shrink-0" />}
                            <h4 className="text-white font-semibold text-sm leading-tight line-clamp-2">{d.title}</h4>
                          </div>
                          {!d.imageUrl && d.discountPercent !== null && (
                            <span className={`flex-shrink-0 text-xl font-black ${d.predictedDiscount ? 'text-purple-400' : d.discountPercent >= 40 ? 'text-red-400' : d.discountPercent >= 25 ? 'text-yellow-400' : 'text-green-400'}`}>-{d.discountPercent}%</span>
                          )}
                        </div>

                        {(d.originalPrice || d.discountedPrice) && (
                          <div className="flex items-center gap-3 bg-gray-800/60 rounded-lg px-3 py-2">
                            {d.originalPrice && <span className="text-gray-500 text-sm line-through">{(d as any).currency === 'COP' ? formatCurrency(d.originalPrice, 'COP') : `$${d.originalPrice.toFixed(2)}`}</span>}
                            {d.discountedPrice && (
                              <div className="flex flex-col">
                                <span className="text-green-400 text-xl font-black">{(d as any).currency === 'COP' ? formatCurrency(d.discountedPrice, 'COP') : `$${d.discountedPrice.toFixed(2)}`}</span>
                                {(d as any).currency === 'COP' && <span className="text-gray-500 text-xs">≈ ${(d.discountedPrice / exchangeRates.USD_COP).toFixed(0)} USD</span>}
                              </div>
                            )}
                            {savings > 0 && <span className="ml-auto text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-semibold">Ahorrás {(d as any).currency === 'COP' ? formatCurrency(savings, 'COP') : `$${savings.toFixed(0)}`}</span>}
                          </div>
                        )}

                        {d.specs && d.specs.length > 0 ? (
                          <ul className="space-y-0.5">
                            {d.specs.slice(0, 4).map((spec, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                                <span className="text-yellow-500 flex-shrink-0">▸</span><span>{spec}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{d.description}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{d.companyName}</span>
                          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{d.sector}</span>
                          {!d.imageUrl && <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${cColor}`}>{flag} {country}</span>}
                          {d.predictedDiscount && <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full"><Star size={9} className="inline mr-0.5" />{Math.round(d.confidence)}%</span>}
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-3">
                          <span className="flex items-center gap-1"><Clock size={11} />{formatDistanceToNow(new Date(d.detectedAt), { locale: es, addSuffix: true })}</span>
                          {d.validUntil && <span className={`flex items-center gap-1 ${isAfter(new Date(d.validUntil), new Date()) ? 'text-green-400' : 'text-red-400'}`}><TrendingUp size={11} />Vence: {format(new Date(d.validUntil), 'dd/MM/yy')}</span>}
                          <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-3 py-1.5 rounded-lg text-xs">
                            <ShoppingCart size={12} />{isFallback ? 'Buscar' : 'Ir a comprar'}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 flex items-center justify-center text-white"><ChevronLeft size={16} /></button>
                  <span className="text-gray-400 text-sm">Página {page} de {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 flex items-center justify-center text-white"><ChevronRight size={16} /></button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <Tag size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No hay descuentos con estos filtros.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: COMPARADOR
      ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'comparador' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">Mismo producto en diferentes tiendas — encuentra el mejor precio</p>
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2">
              <DollarSign size={13} className="text-blue-400" />
              <span className="text-blue-400 text-xs font-bold">1 USD = {exchangeRates.USD_COP.toLocaleString('es-CO')} COP</span>
            </div>
          </div>

          {comparatorGroups.length > 0 ? (
            <div className="space-y-4">
              {comparatorGroups.map((group) => (
                <div key={group.key} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-yellow-500/20 transition-colors">
                  <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">{group.sector}</span>
                      <h3 className="text-white font-semibold text-sm truncate">{group.displayName}</h3>
                    </div>
                    {group.savings > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full flex-shrink-0 font-bold">
                        <TrendingDown size={11} />Ahorra hasta ${group.savings.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-800/60">
                    {group.items.map((item, idx) => {
                      const isCheapest = item.priceUSD !== null && item.priceUSD === group.minPrice && group.items.length >= 2;
                      const { flag, color: cColor } = countryBadge(item.country);
                      const { url: buyUrl, isFallback } = getBuyUrl(item.sourceUrl);
                      return (
                        <div key={item.id} className={`flex items-center gap-4 px-5 py-4 ${isCheapest ? 'bg-green-500/5' : ''}`}>
                          <span className="text-xl flex-shrink-0 w-7 text-center">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`}</span>
                          {item.imageUrl ? (
                            <div className="w-12 h-12 bg-white rounded-lg flex-shrink-0 overflow-hidden">
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display='none'; }} />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-600"><ShoppingCart size={20} /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{item.companyName}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${cColor}`}>{flag} {item.country}</span>
                              {item.discountPercent !== null && <span className={`text-xs font-bold px-2 py-0.5 rounded ${isCheapest ? 'bg-green-500/20 text-green-400' : 'bg-red-500/10 text-red-400'}`}>-{item.discountPercent}% OFF</span>}
                              {isCheapest && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-bold">✓ Mejor precio</span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-black ${isCheapest ? 'text-green-400' : 'text-white'}`}>
                              {(item as any).currency === 'COP' ? formatCurrency(item.discountedPrice ?? 0, 'COP') : `$${item.discountedPrice?.toFixed(0) ?? '—'}`}
                            </p>
                            {(item as any).currency === 'COP' && item.priceUSD && <p className="text-gray-500 text-xs">≈ ${item.priceUSD.toFixed(0)} USD</p>}
                            {item.originalPrice && item.discountedPrice && item.originalPrice !== item.discountedPrice && (
                              <p className="text-gray-600 text-xs line-through">{(item as any).currency === 'COP' ? formatCurrency(item.originalPrice, 'COP') : `$${item.originalPrice}`}</p>
                            )}
                          </div>
                          <a href={buyUrl} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${isCheapest ? 'bg-green-500 hover:bg-green-400 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                            <ExternalLink size={11} />{isFallback ? 'Buscar' : 'Ver'}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <GitCompare size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">Sin productos para comparar con estos filtros.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: HISTORIAL
      ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'historial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">Evolución de precios — detecta el mejor momento para comprar</p>
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2">
              <BarChart2 size={13} className="text-blue-400" />
              <span className="text-blue-300 text-xs font-bold">{priceHistory.length} registros · {histGroups.length} productos</span>
            </div>
          </div>

          {/* Detalle del producto seleccionado */}
          {histSelected && (
            <div className="bg-gray-900 border border-blue-500/30 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  {histSelected.imageUrl && (
                    <div className="w-12 h-12 bg-white rounded-lg overflow-hidden flex-shrink-0">
                      <img src={histSelected.imageUrl} alt={histSelected.displayTitle} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display='none'; }} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-bold text-sm">{histSelected.displayTitle}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${countryBadge(histSelected.country).color}`}>{countryBadge(histSelected.country).flag} {histSelected.country}</span>
                      <span className="text-gray-500 text-xs">{histSelected.stores.length} tiendas · {histSelected.entries.length} registros</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setHistSelectedKey(null)} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
                {[
                  { label: 'Precio mínimo', value: histSelected.lowestPriceUSD ? `$${histSelected.lowestPriceUSD.toFixed(0)}` : '—', color: 'text-green-400' },
                  { label: 'Precio máximo', value: histSelected.highestPriceUSD ? `$${histSelected.highestPriceUSD.toFixed(0)}` : '—', color: 'text-red-400' },
                  { label: 'Bajó desde inicio', value: histSelected.priceDropPct !== null ? `${histSelected.priceDropPct > 0 ? '-' : '+'}${Math.abs(histSelected.priceDropPct)}%` : '—', color: (histSelected.priceDropPct ?? 0) > 0 ? 'text-green-400' : 'text-yellow-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-4 text-center">
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="p-5">
                <p className="text-gray-400 text-xs mb-3 font-semibold uppercase tracking-wide">Evolución del precio en USD</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={histChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#f9fafb', fontWeight: 'bold' }} formatter={(v: any) => [`$${Number(v).toFixed(0)} USD`]} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                    {histSelected.stores.map((store, idx) => (
                      <Line key={store} type="monotone" dataKey={store} name={store} stroke={STORE_COLORS[idx % STORE_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="px-5 pb-5 space-y-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Precios por tienda ahora</p>
                {histSelected.stores
                  .map((store) => {
                    const storeEntries = histSelected.entries.filter((e) => e.store === store);
                    return { store, latest: storeEntries[storeEntries.length - 1] };
                  })
                  .sort((a, b) => toUSD(a.latest.price, a.latest.currency, exchangeRates.USD_COP) - toUSD(b.latest.price, b.latest.currency, exchangeRates.USD_COP))
                  .map(({ store, latest }, idx) => {
                    const usd = toUSD(latest.price, latest.currency, exchangeRates.USD_COP);
                    const isBest = idx === 0 && histSelected.stores.length > 1;
                    const { url: buyUrl, isFallback } = getBuyUrl(latest.sourceUrl);
                    return (
                      <div key={store} className={`flex items-center justify-between px-4 py-3 rounded-lg ${isBest ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800/60'}`}>
                        <div className="flex items-center gap-3">
                          <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`}</span>
                          <div>
                            <p className={`font-semibold text-sm ${isBest ? 'text-green-300' : 'text-white'}`}>{store}</p>
                            <p className="text-gray-500 text-xs">{formatDistanceToNow(new Date(latest.date), { locale: es, addSuffix: true })}{latest.discountPercent ? ` · -${latest.discountPercent}% OFF` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-black text-lg ${isBest ? 'text-green-400' : 'text-white'}`}>{latest.currency === 'COP' ? formatCurrency(latest.price, 'COP') : `$${latest.price.toFixed(0)}`}</p>
                            {latest.currency === 'COP' && <p className="text-gray-500 text-xs">≈ ${usd.toFixed(0)} USD</p>}
                          </div>
                          <a href={buyUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${isBest ? 'bg-green-500 hover:bg-green-400 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                            <ExternalLink size={11} />{isFallback ? 'Buscar' : 'Ir a comprar'}
                          </a>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Grid de productos del historial */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {histGroups.map((group) => {
              const isSelected = histSelectedKey === group.key;
              const { flag, color: cColor } = countryBadge(group.country);
              const recentEntries = group.entries.filter((e) => Date.now() - new Date(e.date).getTime() < 72 * 3600 * 1000);
              return (
                <div key={group.key} onClick={() => setHistSelectedKey(isSelected ? null : group.key)}
                  className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500/40 ${isSelected ? 'border-blue-500/60 ring-1 ring-blue-500/20' : 'border-gray-800'}`}>
                  <div className="flex items-start gap-3">
                    {group.imageUrl ? (
                      <div className="w-14 h-14 bg-white rounded-lg flex-shrink-0 overflow-hidden">
                        <img src={group.imageUrl} alt={group.displayTitle} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display='none'; }} />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center"><ShoppingCart size={22} className="text-gray-600" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-white font-semibold text-sm leading-tight truncate">{group.displayTitle}</h3>
                        {(group.priceDropPct ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full flex-shrink-0 font-bold"><TrendingDown size={10} />-{group.priceDropPct}%</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${cColor}`}>{flag} {group.country}</span>
                        <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{group.sector}</span>
                        <span className="text-gray-500 text-xs">{group.stores.length} tiendas · {group.entries.length} reg.</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {group.lowestPriceUSD && <span className="text-green-400 text-xs font-bold flex items-center gap-1"><TrendingDown size={10} />${group.lowestPriceUSD.toFixed(0)} mín</span>}
                        {group.highestPriceUSD && group.highestPriceUSD !== group.lowestPriceUSD && <span className="text-red-400 text-xs flex items-center gap-1"><TrendingUp size={10} />${group.highestPriceUSD.toFixed(0)} máx</span>}
                      </div>
                      {recentEntries.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {recentEntries.slice(0, 3).map((e) => (
                            <span key={e.id} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                              {e.store.split(' ')[0]}: {e.currency === 'COP' ? formatCurrency(e.price, 'COP') : `$${e.price}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-gray-600 text-xs">Último registro: {formatDistanceToNow(new Date(group.entries[group.entries.length - 1].date), { locale: es, addSuffix: true })}</span>
                    <span className={`text-xs font-semibold flex items-center gap-1 ${isSelected ? 'text-blue-400' : 'text-gray-500'}`}>{isSelected ? '▲ Cerrar' : '▼ Ver gráfico'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {histGroups.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <History size={36} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Sin historial de precios con estos filtros.</p>
              <p className="text-gray-600 text-sm mt-1">Ejecuta el Agente Historial para registrar precios actuales.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
