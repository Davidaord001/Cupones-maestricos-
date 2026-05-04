import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Plus, Trash2, Globe, RefreshCw, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Company } from '../store/types';

const SECTORS = ['Supermercados', 'Moda', 'Electrónica', 'Farmacia', 'Deportes', 'Restaurantes', 'Tecnología', 'Hogar', 'Educación', 'Salud', 'Automotriz', 'Turismo'];
const PROVINCES = ['Pichincha', 'Guayas', 'Azuay', 'Manabí', 'El Oro', 'Tungurahua', 'Imbabura', 'Loja', 'Los Ríos', 'Esmeraldas'];

function AddCompanyModal({ onClose }: { onClose: () => void }) {
  const { addCompany, addLog } = useAppStore();
  const [form, setForm] = useState({ name: '', website: '', sector: SECTORS[0], province: PROVINCES[0], active: true });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.website) return;
    const url = form.website.startsWith('http') ? form.website : `https://${form.website}`;
    addCompany({ ...form, website: url });
    addLog({ agentName: 'Sistema', message: `Empresa "${form.name}" agregada al monitor`, type: 'success' });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-white font-bold text-lg mb-5">Agregar Empresa Ecuatoriana</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Nombre de la empresa *</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500"
              placeholder="Ej: Supermaxi"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Sitio web *</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500"
              placeholder="Ej: www.supermaxi.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Sector</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
              >
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Provincia</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
              >
                {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2.5 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold rounded-lg py-2.5 text-sm transition-colors">
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const { companies, removeCompany, updateCompany } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('Todos');

  const sectors = ['Todos', ...Array.from(new Set(companies.map((c) => c.sector)))];
  const filtered = companies.filter((c) => {
    const matchText = c.name.toLowerCase().includes(filter.toLowerCase()) || c.province.toLowerCase().includes(filter.toLowerCase());
    const matchSector = sectorFilter === 'Todos' || c.sector === sectorFilter;
    return matchText && matchSector;
  });

  return (
    <div className="p-6 space-y-5">
      {showModal && <AddCompanyModal onClose={() => setShowModal(false)} />}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          placeholder="Buscar empresa o provincia..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          {sectors.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus size={16} /> Agregar Empresa
        </button>
      </div>

      {/* Stats mini */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: companies.length, color: 'text-blue-400' },
          { label: 'Activas', value: companies.filter((c) => c.active).length, color: 'text-green-400' },
          { label: 'Pausadas', value: companies.filter((c) => !c.active).length, color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 text-xs font-medium px-5 py-3">Empresa</th>
              <th className="text-left text-gray-400 text-xs font-medium px-5 py-3">Sector</th>
              <th className="text-left text-gray-400 text-xs font-medium px-5 py-3">Provincia</th>
              <th className="text-left text-gray-400 text-xs font-medium px-5 py-3">Descuentos</th>
              <th className="text-left text-gray-400 text-xs font-medium px-5 py-3">Confianza</th>
              <th className="text-left text-gray-400 text-xs font-medium px-5 py-3">Último Scan</th>
              <th className="text-left text-gray-400 text-xs font-medium px-5 py-3">Estado</th>
              <th className="text-gray-400 text-xs font-medium px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((company) => (
              <tr key={company.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm">
                      {company.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{company.name}</p>
                      <a href={company.website} target="_blank" rel="noreferrer" className="text-gray-500 text-xs flex items-center gap-1 hover:text-yellow-400">
                        <Globe size={10} />{company.website.replace('https://', '').slice(0, 25)}
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{company.sector}</span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-sm">{company.province}</td>
                <td className="px-5 py-3.5 text-white text-sm font-semibold">{company.discountsFound}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5 w-16">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-green-500"
                        style={{ width: `${company.trustScore}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs">{company.trustScore}%</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-500 text-xs">
                  {company.lastScan
                    ? formatDistanceToNow(new Date(company.lastScan), { locale: es, addSuffix: true })
                    : 'Nunca'}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => updateCompany(company.id, { active: !company.active })}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                      company.active
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                        : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {company.active ? <CheckCircle size={11} /> : <XCircle size={11} />}
                    {company.active ? 'Activa' : 'Pausada'}
                  </button>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => removeCompany(company.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-gray-500 text-sm">
                  No se encontraron empresas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
