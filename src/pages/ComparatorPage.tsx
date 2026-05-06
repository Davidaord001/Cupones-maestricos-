import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GitCompare, TrendingDown, ExternalLink, Search, ShoppingCart, RefreshCw, DollarSign } from 'lucide-react';
import { formatCurrency } from '../services/currencyService';

// Agrupa descuentos por título "normalizado" para comparar el mismo producto en diferentes tiendas
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/—.*$/, '') // quitar lo que va después de "—"
    .replace(/[^a-záéíóúñ0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
}

interface PriceGroup {
  key: string;
  displayName: string;
  sector: string;
  items: {
    id: string;
    companyName: string;
    companyUrl: string;
    title: string;
    originalPrice: number | null;
    discountedPrice: number | null;
    discountPercent: number | null;
    currency: 'USD' | 'COP';
    priceUSD: number | null;
    sourceUrl: string;
    imageUrl?: string;
    country: string;
    confidence: number;
  }[];
}

export default function ComparatorPage() {
  const { discounts, exchangeRates } = useAppStore();
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('Todos');

  const sectors = ['Todos', ...Array.from(new Set(discounts.map((d) => d.sector).filter(Boolean))).sort()];

  // Agrupar productos por nombre similar y que aparezcan en ≥2 tiendas
  const groups = useMemo<PriceGroup[]>(() => {
    const real = discounts.filter((d) => !d.predictedDiscount && d.discountPercent !== null);

    // Construir mapa de grupos
    const map = new Map<string, PriceGroup>();

    for (const d of real) {
      const key = normalizeTitle(d.title);
      if (!map.has(key)) {
        map.set(key, {
          key,
          displayName: d.title.split('—')[0].trim(),
          sector: d.sector,
          items: [],
        });
      }
      const priceUSD = d.discountedPrice !== null
        ? (d.currency === 'COP' ? d.discountedPrice / exchangeRates.USD_COP : d.discountedPrice)
        : null;

      map.get(key)!.items.push({
        id: d.id,
        companyName: d.companyName,
        companyUrl: d.sourceUrl,
        title: d.title,
        originalPrice: d.originalPrice,
        discountedPrice: d.discountedPrice,
        discountPercent: d.discountPercent,
        currency: (d as any).currency ?? 'USD',
        priceUSD,
        sourceUrl: d.sourceUrl,
        imageUrl: d.imageUrl,
        country: (d as any).country ?? 'Ecuador',
        confidence: d.confidence,
      });
    }

    // Filtrar solo grupos con ≥2 tiendas distintas O misma tienda con variante diferente
    let result = Array.from(map.values()).filter((g) => g.items.length >= 2);

    // Buscar también grupos con keywords similares (ampliar matches)
    if (result.length < 6) {
      // Agregar grupos de 1 ítem para mostrar historial de precio individual
      result = [...result, ...Array.from(map.values()).filter((g) => g.items.length === 1)];
    }

    // Aplicar filtros
    result = result.filter((g) => {
      const matchSearch = search === '' || g.displayName.toLowerCase().includes(search.toLowerCase()) || g.items.some((i) => i.title.toLowerCase().includes(search.toLowerCase()));
      const matchSector = sectorFilter === 'Todos' || g.sector === sectorFilter;
      return matchSearch && matchSector;
    });

    // Ordenar por mayor diferencia de precio entre tiendas (más interesante primero)
    return result
      .sort((a, b) => {
        const rangeA = a.items.length >= 2
          ? (Math.max(...a.items.map((i) => i.priceUSD ?? 0)) - Math.min(...a.items.map((i) => i.priceUSD ?? Infinity))) : 0;
        const rangeB = b.items.length >= 2
          ? (Math.max(...b.items.map((i) => i.priceUSD ?? 0)) - Math.min(...b.items.map((i) => i.priceUSD ?? Infinity))) : 0;
        return rangeB - rangeA;
      })
      .slice(0, 50);
  }, [discounts, search, sectorFilter, exchangeRates]);

  const rateAge = exchangeRates.lastUpdated
    ? Math.round((Date.now() - new Date(exchangeRates.lastUpdated).getTime()) / 3600000)
    : null;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <GitCompare size={22} className="text-yellow-400" />
            Comparador de Precios
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Mismo producto, diferentes tiendas — encuentra el mejor precio real
          </p>
        </div>
        {/* Exchange rate badge */}
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2">
          <DollarSign size={14} className="text-blue-400" />
          <div>
            <p className="text-blue-400 text-xs font-bold">
              1 USD = {exchangeRates.USD_COP.toLocaleString('es-CO')} COP
            </p>
            <p className="text-gray-500 text-xs">
              {rateAge !== null ? (rateAge === 0 ? 'Actualizado hace menos de 1h' : `Hace ${rateAge}h`) : 'Tasa de referencia'}
            </p>
          </div>
          <RefreshCw size={12} className="text-gray-500" />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
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

      {/* Grupos de comparación */}
      {groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map((group) => {
            const prices = group.items.map((i) => i.priceUSD).filter((p): p is number => p !== null);
            const minPrice = prices.length > 0 ? Math.min(...prices) : null;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
            const savings = minPrice !== null && maxPrice !== null ? maxPrice - minPrice : 0;
            const hasMultiple = group.items.length >= 2;

            return (
              <div key={group.key} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-yellow-500/20 transition-colors">
                {/* Group header */}
                <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">{group.sector}</span>
                    <h3 className="text-white font-semibold text-sm truncate">{group.displayName}</h3>
                  </div>
                  {hasMultiple && savings > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full flex-shrink-0 font-bold">
                      <TrendingDown size={11} />
                      Ahorra hasta ${savings.toFixed(0)} eligiendo bien
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-800/60">
                  {group.items
                    .sort((a, b) => (a.priceUSD ?? 9999) - (b.priceUSD ?? 9999))
                    .map((item, idx) => {
                      const isCheapest = item.priceUSD !== null && item.priceUSD === minPrice && hasMultiple;
                      const isMostExpensive = item.priceUSD !== null && item.priceUSD === maxPrice && hasMultiple && savings > 0;
                      return (
                        <div key={item.id} className={`flex items-center gap-4 px-5 py-4 ${isCheapest ? 'bg-green-500/5' : ''}`}>
                          {/* Rank */}
                          {hasMultiple && (
                            <span className={`text-xl flex-shrink-0 w-7 text-center ${
                              idx === 0 ? '' : ''
                            }`}>
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                            </span>
                          )}

                          {/* Product image */}
                          {item.imageUrl ? (
                            <div className="w-12 h-12 bg-white rounded-lg flex-shrink-0 overflow-hidden">
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-contain p-1"
                                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-600">
                              <ShoppingCart size={20} />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{item.companyName}</p>
                            <p className="text-gray-400 text-xs truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
                                {item.country ?? 'Ecuador'}
                              </span>
                              {item.discountPercent !== null && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  isCheapest ? 'bg-green-500/20 text-green-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  -{item.discountPercent}% OFF
                                </span>
                              )}
                              {isCheapest && hasMultiple && (
                                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-bold">✓ Mejor precio</span>
                              )}
                              {isMostExpensive && (
                                <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded">Más caro</span>
                              )}
                            </div>
                          </div>

                          {/* Precio */}
                          <div className="text-right flex-shrink-0">
                            {item.discountedPrice !== null && (
                              <>
                                {item.originalPrice && (
                                  <p className="text-gray-500 text-xs line-through">
                                    {item.currency === 'COP'
                                      ? formatCurrency(item.originalPrice, 'COP')
                                      : `$${item.originalPrice.toFixed(0)}`}
                                  </p>
                                )}
                                <p className={`font-black text-lg ${isCheapest && hasMultiple ? 'text-green-400' : 'text-white'}`}>
                                  {item.currency === 'COP'
                                    ? formatCurrency(item.discountedPrice, 'COP')
                                    : `$${item.discountedPrice.toFixed(2)}`}
                                </p>
                                {item.currency === 'COP' && item.priceUSD !== null && (
                                  <p className="text-gray-500 text-xs">≈ ${item.priceUSD.toFixed(0)} USD</p>
                                )}
                              </>
                            )}
                            {item.discountedPrice === null && item.discountPercent !== null && (
                              <p className="text-yellow-400 font-bold text-sm">-{item.discountPercent}%</p>
                            )}
                          </div>

                          {/* CTA */}
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${
                              isCheapest && hasMultiple
                                ? 'bg-green-500 hover:bg-green-400 text-white'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                            }`}
                          >
                            <ExternalLink size={11} />
                            Ver
                          </a>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <GitCompare size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No hay productos para comparar</p>
          <p className="text-gray-600 text-sm mt-1">Inicia un escaneo para detectar descuentos en múltiples tiendas.</p>
        </div>
      )}
    </div>
  );
}
