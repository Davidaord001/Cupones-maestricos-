import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Tag, Clock, TrendingUp, Sparkles, Trophy, ArrowUpDown, Star, Flame, ShoppingCart, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { format, formatDistanceToNow, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../services/currencyService';

const PAGE_SIZE = 20;

type SortKey = 'discount' | 'savings' | 'recent' | 'confidence' | 'price_asc';

function getBadge(d: { discountPercent: number | null; originalPrice: number | null; confidence: number; predictedDiscount: boolean }) {
  if (d.predictedDiscount) return null;
  if ((d.discountPercent ?? 0) >= 45) return { label: '🔥 Oferta Extrema', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if ((d.discountPercent ?? 0) >= 30) return { label: '⭐ Gran Descuento', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  if (d.originalPrice && d.originalPrice >= 400) return { label: '💎 Alto Valor', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return null;
}

function getSavings(d: { discountPercent: number | null; originalPrice: number | null; discountedPrice: number | null }) {
  if (d.originalPrice && d.discountedPrice) return d.originalPrice - d.discountedPrice;
  if (d.originalPrice && d.discountPercent) return d.originalPrice * (d.discountPercent / 100);
  return 0;
}

export default function DiscountsPage() {
  const { discounts, exchangeRates } = useAppStore();
  const [typeFilter, setTypeFilter] = useState<'all' | 'real' | 'predicted'>('all');
  const [sectorFilter, setSectorFilter] = useState('Todos');
  const [countryFilter, setCountryFilter] = useState('Todos');
  const [productSearch, setProductSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('discount');
  const [page, setPage] = useState(1);

  const sectors = ['Todos', ...Array.from(new Set(discounts.map((d) => d.sector).filter(Boolean))).sort()];

  // Detectar países disponibles
  const countries = useMemo(() => {
    const set = new Set<string>();
    discounts.forEach((d) => {
      const c = (d as any).country ?? (d.companyName.toLowerCase().includes('colombia') ? 'Colombia' : 'Ecuador');
      set.add(c);
    });
    return ['Todos', ...Array.from(set).sort()];
  }, [discounts]);

  const filtered = useMemo(() => {
    const base = discounts.filter((d) => {
      const matchType = typeFilter === 'all' || (typeFilter === 'predicted' ? d.predictedDiscount : !d.predictedDiscount);
      const matchSector = sectorFilter === 'Todos' || d.sector === sectorFilter;
      const country = (d as any).country ?? (d.companyName.toLowerCase().includes('colombia') ? 'Colombia' : 'Ecuador');
      const matchCountry = countryFilter === 'Todos' || country === countryFilter;
      const matchProduct = productSearch === '' ||
        d.title.toLowerCase().includes(productSearch.toLowerCase()) ||
        d.companyName.toLowerCase().includes(productSearch.toLowerCase()) ||
        d.description.toLowerCase().includes(productSearch.toLowerCase());
      return matchType && matchSector && matchCountry && matchProduct;
    });
    return base.sort((a, b) => {
      if (sortKey === 'discount') return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
      if (sortKey === 'savings') return getSavings(b) - getSavings(a);
      if (sortKey === 'confidence') return b.confidence - a.confidence;
      if (sortKey === 'recent') return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      if (sortKey === 'price_asc') return (a.discountedPrice ?? a.originalPrice ?? 9999) - (b.discountedPrice ?? b.originalPrice ?? 9999);
      return 0;
    });
  }, [discounts, typeFilter, sectorFilter, countryFilter, productSearch, sortKey]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Top 3 ofertas reales por descuento
  const top3 = useMemo(() =>
    discounts.filter((d) => !d.predictedDiscount && (d.discountPercent ?? 0) > 0)
      .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
      .slice(0, 3),
    [discounts]
  );

  const activeCount = discounts.filter((d) => !d.predictedDiscount).length;
  const predictedCount = discounts.filter((d) => d.predictedDiscount).length;
  const maxDiscount = discounts.reduce((m, d) => Math.max(m, d.discountPercent ?? 0), 0);
  const totalSavings = discounts.reduce((s, d) => s + getSavings(d), 0);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'discount', label: '% Mayor descuento' },
    { key: 'savings', label: '$ Mayor ahorro' },
    { key: 'price_asc', label: 'Menor precio' },
    { key: 'recent', label: 'Más reciente' },
    { key: 'confidence', label: 'Mayor confianza' },
  ];

  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
  const medalIcons = ['🥇', '🥈', '🥉'];

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Descuentos Activos', value: activeCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Predicciones IA', value: predictedCount, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
          { label: 'Mayor Descuento', value: `${maxDiscount}%`, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Ahorro Total Posible', value: totalSavings > 0 ? `$${totalSavings.toFixed(0)}` : '—', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`border rounded-xl p-4 text-center ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* TOP 3 MEJORES OFERTAS */}
      {top3.length >= 3 && (
        <div className="bg-gray-900 border border-yellow-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-yellow-400" />
            <h3 className="text-white font-bold text-sm">Top 3 Mejores Ofertas Ahora</h3>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            {top3.map((d, i) => (
              <div
                key={d.id}
                className={`rounded-xl overflow-hidden border flex flex-col ${
                  i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                  i === 1 ? 'bg-gray-700/30 border-gray-600/30' :
                  'bg-amber-900/10 border-amber-700/30'
                }`}
              >
                {/* Miniatura del producto */}
                {d.imageUrl && (
                  <div className="bg-white flex items-center justify-center" style={{ height: '120px' }}>
                    <img
                      src={d.imageUrl}
                      alt={d.title}
                      className="object-contain w-full h-full p-2"
                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{medalIcons[i]}</span>
                    <span className={`text-2xl font-black ${medalColors[i]}`}>-{d.discountPercent}%</span>
                  </div>
                  <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{d.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">{d.companyName}</span>
                    {getSavings(d) > 0 && (
                      <span className="text-green-400 text-xs font-bold">Ahorro: ${getSavings(d).toFixed(0)}</span>
                    )}
                  </div>
                  {d.discountedPrice && (
                    <div className="flex items-center gap-2">
                      {d.originalPrice && (
                        <span className="text-gray-500 text-xs line-through">
                          {(d as any).currency === 'COP' ? formatCurrency(d.originalPrice, 'COP') : `$${d.originalPrice}`}
                        </span>
                      )}
                      <span className={`text-sm font-bold ${medalColors[i]}`}>
                        {(d as any).currency === 'COP' ? formatCurrency(d.discountedPrice, 'COP') : `$${d.discountedPrice}`}
                      </span>
                    </div>
                  )}
                  <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-auto text-xs flex items-center gap-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-3 py-1.5 rounded-lg transition-colors justify-center">
                    <ShoppingCart size={11} /> Ir a comprar →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters + Sort */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Tipo */}
        <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
          {([['all', 'Todos'], ['real', 'Activos'], ['predicted', 'Predicciones']] as [string, string][]).map(([val, label]) => (
            <button key={val}
              onClick={() => { setTypeFilter(val as 'all' | 'real' | 'predicted'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${typeFilter === val ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-400 hover:text-white'}`}
            >{label}</button>
          ))}
        </div>

        {/* Sector */}
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          value={sectorFilter}
          onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }}
        >
          {sectors.map((s) => <option key={s}>{s}</option>)}
        </select>

        {/* País */}
        {countries.length > 2 && (
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            value={countryFilter}
            onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
          >
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}

        {/* Búsqueda por producto */}
        <div className="relative min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={productSearch}
            onChange={(e) => { setProductSearch(e.target.value); setPage(1); }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-7 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
          {productSearch && (
            <button onClick={() => setProductSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Ordenar */}
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-gray-400" />
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        <span className="ml-auto text-gray-500 text-sm self-center">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Discount cards */}
      {filtered.length > 0 ? (
        <>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {paginated.map((d) => {
            const badge = getBadge(d);
            const savings = getSavings(d);
            const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${new URL(d.sourceUrl).hostname}`;
            const hasImage = !!d.imageUrl;
            return (
              <div key={d.id}
                className={`bg-gray-900 border rounded-xl overflow-hidden transition-all hover:border-yellow-500/40 hover:shadow-lg hover:shadow-yellow-500/5 ${
                  d.predictedDiscount ? 'border-purple-500/30' : 'border-gray-800'
                }`}
              >
                {/* Imagen del producto */}
                {hasImage && (
                  <div className="relative bg-white flex items-center justify-center overflow-hidden" style={{ height: '200px' }}>
                    <img
                      src={d.imageUrl}
                      alt={d.title}
                      className="object-contain w-full h-full p-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.parentElement!.style.display = 'none';
                      }}
                    />
                    {/* Badge de descuento sobre la imagen */}
                    {d.discountPercent !== null && (
                      <span className={`absolute top-3 right-3 text-white text-lg font-black px-3 py-1 rounded-xl shadow-lg ${
                        d.predictedDiscount ? 'bg-purple-600' :
                        d.discountPercent >= 40 ? 'bg-red-600' :
                        d.discountPercent >= 25 ? 'bg-orange-500' : 'bg-green-600'
                      }`}>
                        -{d.discountPercent}%
                      </span>
                    )}
                    {badge && (
                      <span className={`absolute top-3 left-3 text-xs border px-2 py-1 rounded-lg font-semibold backdrop-blur-sm ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                )}

                <div className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <img src={faviconUrl} alt="" className="w-5 h-5 rounded flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      {d.predictedDiscount
                        ? <Sparkles size={14} className="text-purple-400 flex-shrink-0" />
                        : (d.discountPercent ?? 0) >= 40
                          ? <Flame size={14} className="text-red-400 flex-shrink-0" />
                          : <Tag size={14} className="text-yellow-400 flex-shrink-0" />
                      }
                      <h4 className="text-white font-semibold text-sm leading-tight">{d.title}</h4>
                    </div>
                    {!hasImage && d.discountPercent !== null && (
                      <span className={`flex-shrink-0 text-xl font-black ${
                        d.predictedDiscount ? 'text-purple-400' :
                        d.discountPercent >= 40 ? 'text-red-400' :
                        d.discountPercent >= 25 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        -{d.discountPercent}%
                      </span>
                    )}
                  </div>

                  {/* Precio */}
                  {(d.originalPrice || d.discountedPrice) && (
                    <div className="flex items-center gap-3 bg-gray-800/60 rounded-lg px-3 py-2">
                      {d.originalPrice && (
                        <span className="text-gray-500 text-sm line-through">
                          {(d as any).currency === 'COP'
                            ? formatCurrency(d.originalPrice, 'COP')
                            : `$${d.originalPrice.toFixed(2)}`}
                        </span>
                      )}
                      {d.discountedPrice && (
                        <div className="flex flex-col">
                          <span className="text-green-400 text-xl font-black">
                            {(d as any).currency === 'COP'
                              ? formatCurrency(d.discountedPrice, 'COP')
                              : `$${d.discountedPrice.toFixed(2)}`}
                          </span>
                          {(d as any).currency === 'COP' && exchangeRates?.USD_COP && (
                            <span className="text-gray-500 text-xs">
                              ≈ ${(d.discountedPrice / exchangeRates.USD_COP).toFixed(0)} USD
                            </span>
                          )}
                        </div>
                      )}
                      {savings > 0 && (
                        <span className="ml-auto text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {(d as any).currency === 'COP'
                            ? `Ahorrás ${formatCurrency(savings, 'COP')}`
                            : `Ahorrás $${savings.toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Specs técnicas (si existen) o descripción */}
                  {d.specs && d.specs.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Características</p>
                      <ul className="grid grid-cols-1 gap-0.5">
                        {d.specs.map((spec, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                            <span className="text-yellow-500 mt-0.5 flex-shrink-0">▸</span>
                            <span>{spec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs leading-relaxed">{d.description}</p>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{d.companyName}</span>
                    <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{d.sector}</span>
                    {!hasImage && badge && (
                      <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                    )}
                    {d.predictedDiscount && (
                      <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
                        <Star size={9} className="inline mr-0.5" />Confianza {Math.round(d.confidence)}%
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-3">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatDistanceToNow(new Date(d.detectedAt), { locale: es, addSuffix: true })}
                    </span>
                    {d.validUntil && (
                      <span className={`flex items-center gap-1 ${isAfter(new Date(d.validUntil), new Date()) ? 'text-green-400' : 'text-red-400'}`}>
                        <TrendingUp size={11} />
                        Vence: {format(new Date(d.validUntil), 'dd/MM/yyyy')}
                      </span>
                    )}
                    <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-3 py-1.5 rounded-lg transition-colors text-xs">
                      <ShoppingCart size={12} /> Ir a comprar
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 flex items-center justify-center text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-gray-400 text-sm">Página {page} de {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 flex items-center justify-center text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <Tag size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No hay descuentos en esta categoría.</p>
          <p className="text-gray-600 text-sm mt-1">Cambia el filtro o inicia un escaneo.</p>
        </div>
      )}
    </div>
  );
}

