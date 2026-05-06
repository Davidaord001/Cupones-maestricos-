import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, Discount, Agent, AgentLog, AppSettings, ExchangeRates, PriceHistoryEntry, UrlCheckResult } from './types';
import { format } from 'date-fns';

interface AppState {
  // Settings
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;

  // Companies
  companies: Company[];
  addCompany: (c: Omit<Company, 'id' | 'lastScan' | 'discountsFound' | 'trustScore'>) => void;
  removeCompany: (id: string) => void;
  updateCompany: (id: string, data: Partial<Company>) => void;

  // Discounts
  discounts: Discount[];
  addDiscount: (d: Omit<Discount, 'id' | 'detectedAt'>) => void;
  clearDiscounts: () => void;

  // Agents
  agents: Agent[];
  updateAgentStatus: (id: string, status: Agent['status']) => void;
  incrementAgentTasks: (id: string) => void;

  // Logs
  logs: AgentLog[];
  addLog: (log: Omit<AgentLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;

  // Exchange rates
  exchangeRates: ExchangeRates;
  updateExchangeRates: (r: ExchangeRates) => void;

  // Price history
  priceHistory: PriceHistoryEntry[];
  addPriceHistoryEntries: (entries: PriceHistoryEntry[]) => void;
  clearPriceHistory: () => void;

  // URL check cache
  urlChecks: Record<string, UrlCheckResult>;
  updateUrlCheck: (url: string, result: UrlCheckResult) => void;

  // UI
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const defaultAgents: Agent[] = [
  { id: 'agent-cupones',  name: 'Agente Cupones',  role: 'Escanea las 173 empresas en busca de descuentos y cupones nuevos', status: 'idle', lastRun: null, tasksCompleted: 0, icon: '🏷️' },
  { id: 'agent-empresas', name: 'Agente Empresas', role: 'Descubre nuevas tiendas para agregar al radar de monitoreo',          status: 'idle', lastRun: null, tasksCompleted: 0, icon: '🔍' },
  { id: 'agent-info',     name: 'Agente Info',     role: 'Actualiza información y métricas de confianza de las empresas',     status: 'idle', lastRun: null, tasksCompleted: 0, icon: '📊' },
  { id: 'agent-telegram', name: 'Agente Telegram', role: 'Envía notificaciones y resúmenes de descuentos por Telegram',        status: 'idle', lastRun: null, tasksCompleted: 0, icon: '📱' },
  { id: 'agent-divisa',   name: 'Agente Divisa',   role: 'Monitorea el tipo de cambio COP/USD cada 8 horas y convierte precios en tiempo real', status: 'idle', lastRun: null, tasksCompleted: 0, icon: '💱' },
];

const TODAY = new Date().toISOString();

const defaultCompanies: Company[] = [
  // === SUPERMERCADOS ===
  { id: 'c1',  name: 'Supermaxi', website: 'https://www.supermaxi.com', sector: 'Supermercados', province: 'Pichincha', lastScan: TODAY, discountsFound: 6, trustScore: 97, active: true },
  { id: 'c2',  name: 'TIA S.A.', website: 'https://www.tia.com.ec', sector: 'Supermercados', province: 'Guayas', lastScan: TODAY, discountsFound: 4, trustScore: 91, active: true },
  { id: 'c3',  name: 'Megamaxi', website: 'https://www.megamaxi.com', sector: 'Supermercados', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 93, active: true },
  { id: 'c4',  name: 'Coral Hipermercados', website: 'https://www.coral.com.ec', sector: 'Supermercados', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c5',  name: 'Mi Comisariato', website: 'https://www.micomisariato.com.ec', sector: 'Supermercados', province: 'Guayas', lastScan: TODAY, discountsFound: 3, trustScore: 89, active: true },
  { id: 'c6',  name: 'Santa María', website: 'https://www.santamaria.com.ec', sector: 'Supermercados', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c7',  name: 'Almacenes El Rosado', website: 'https://www.elrosado.com', sector: 'Retail', province: 'Guayas', lastScan: TODAY, discountsFound: 3, trustScore: 88, active: true },
  // === MODA Y ROPA ===
  { id: 'c8',  name: 'De Prati', website: 'https://www.deprati.com.ec', sector: 'Moda', province: 'Guayas', lastScan: TODAY, discountsFound: 5, trustScore: 90, active: true },
  { id: 'c9',  name: 'Etafashion', website: 'https://www.etafashion.com', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 4, trustScore: 87, active: true },
  { id: 'c10', name: 'Studio F Ecuador', website: 'https://www.studio-f.com.ec', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  // === DEPORTES ===
  { id: 'c11', name: 'Marathon Sports', website: 'https://www.marathonsports.com.ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 4, trustScore: 89, active: true },
  { id: 'c12', name: 'Intersport Ecuador', website: 'https://www.intersport.com.ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  // === FARMACIAS ===
  { id: 'c13', name: 'Fybeca', website: 'https://www.fybeca.com', sector: 'Farmacia', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 94, active: true },
  { id: 'c14', name: 'Farmacias Cruz Azul', website: 'https://www.cruzazul.com.ec', sector: 'Farmacia', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 91, active: true },
  { id: 'c15', name: 'Medicity', website: 'https://www.medicity.com.ec', sector: 'Farmacia', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 88, active: true },
  // === ELECTRÓNICA ===
  { id: 'c16', name: 'Comandato', website: 'https://www.comandato.com', sector: 'Electrónica', province: 'Guayas', lastScan: TODAY, discountsFound: 5, trustScore: 86, active: true },
  { id: 'c17', name: 'Almacenes Japón', website: 'https://www.almacenejapon.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 4, trustScore: 84, active: true },
  { id: 'c18', name: 'Tecnomega', website: 'https://www.tecnomega.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 87, active: true },
  { id: 'c19', name: 'Novicompu', website: 'https://www.novicompu.com', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 83, active: true },
  // === HOGAR ===
  { id: 'c20', name: 'Sukasa', website: 'https://www.sukasa.com', sector: 'Hogar', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 85, active: true },
  { id: 'c21', name: 'Casa Tosi', website: 'https://www.casatosi.com', sector: 'Hogar', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 80, active: true },
  { id: 'c22', name: 'Kywi', website: 'https://www.kywi.com.ec', sector: 'Ferretería', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  // === JUGUETES ===
  { id: 'c23', name: 'Juguetón', website: 'https://www.jugueton.com.ec', sector: 'Juguetes', province: 'Pichincha', lastScan: TODAY, discountsFound: 6, trustScore: 92, active: true },
  // === BELLEZA Y COSMÉTICA ===
  { id: 'c24', name: 'Yanbal Ecuador', website: 'https://www.yanbal.com/ec', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 90, active: true },
  { id: 'c25', name: 'Cyzone Ecuador', website: 'https://www.cyzone.com/ec', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 86, active: true },
  { id: 'c26', name: 'Miniso Ecuador', website: 'https://www.miniso.com.ec', sector: 'Bazar', province: 'Pichincha', lastScan: TODAY, discountsFound: 4, trustScore: 88, active: true },
  // === E-COMMERCE ===
  { id: 'c27', name: 'MercadoLibre Ecuador', website: 'https://www.mercadolibre.com.ec', sector: 'E-commerce', province: 'Pichincha', lastScan: TODAY, discountsFound: 8, trustScore: 96, active: true },
  // === TELECOM ===
  { id: 'c28', name: 'Claro Ecuador', website: 'https://www.claro.com.ec', sector: 'Telecomunicaciones', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 88, active: true },
  { id: 'c29', name: 'Movistar Ecuador', website: 'https://www.movistar.com.ec', sector: 'Telecomunicaciones', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  // === CONSTRUCCIÓN ===
  { id: 'c30', name: 'Disensa', website: 'https://www.disensa.com', sector: 'Construcción', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 78, active: true },
  { id: 'c31', name: 'Importadora Tomebamba', website: 'https://www.tomebamba.com', sector: 'Construcción', province: 'Azuay', lastScan: TODAY, discountsFound: 1, trustScore: 79, active: true },
  // === VIAJES ===
  { id: 'c32', name: 'LATAM Ecuador', website: 'https://www.latamairlines.com/ec', sector: 'Aerolíneas', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 93, active: true },

  // === SUPERMERCADOS ADICIONALES ECUADOR ===
  { id: 'c33', name: 'Gran Akí', website: 'https://www.akiecuador.com', sector: 'Supermercados', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  { id: 'c34', name: 'Aki Ecuador', website: 'https://www.akiecuador.com', sector: 'Supermercados', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 80, active: true },
  { id: 'c35', name: 'Supermaxi Express', website: 'https://www.supermaxi.com', sector: 'Supermercados', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 90, active: true },

  // === MODA ADICIONAL ECUADOR ===
  { id: 'c36', name: 'Bosi Ecuador', website: 'https://www.bosi.com.ec', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 80, active: true },
  { id: 'c37', name: 'Ela Ecuador', website: 'https://www.ela.com.ec', sector: 'Moda', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 78, active: true },
  { id: 'c38', name: 'MNG Mango Ecuador', website: 'https://www.mango.com/ec', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 85, active: true },
  { id: 'c39', name: 'Zara Ecuador', website: 'https://www.zara.com/ec', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  { id: 'c40', name: 'C&A Ecuador', website: 'https://www.cya.com.ec', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 80, active: true },
  { id: 'c41', name: 'Koaj Ecuador', website: 'https://www.koaj.com.ec', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 78, active: true },
  { id: 'c42', name: 'Stradivarius Ecuador', website: 'https://www.stradivarius.com/ec', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 80, active: true },

  // === DEPORTES ADICIONAL ECUADOR ===
  { id: 'c43', name: 'Adidas Ecuador', website: 'https://www.adidas.com.ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 88, active: true },
  { id: 'c44', name: 'Nike Ecuador', website: 'https://www.nike.com/ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },

  // === FARMACIAS ADICIONAL ECUADOR ===
  { id: 'c45', name: 'Sana Sana Ecuador', website: 'https://www.sanasana.com.ec', sector: 'Farmacia', province: 'Pichincha', lastScan: TODAY, discountsFound: 4, trustScore: 93, active: true },
  { id: 'c46', name: 'Pharmacys Ecuador', website: 'https://www.pharmacys.com.ec', sector: 'Farmacia', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 87, active: true },

  // === ELECTRÓNICA ADICIONAL ECUADOR ===
  { id: 'c47', name: 'iShop Ecuador', website: 'https://www.ishopecuador.com', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c48', name: 'PC Factory Ecuador', website: 'https://www.pcfactory.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  { id: 'c49', name: 'Artefacta Ecuador', website: 'https://www.artefacta.com', sector: 'Electrónica', province: 'Guayas', lastScan: TODAY, discountsFound: 3, trustScore: 83, active: true },
  { id: 'c50', name: 'Crédito Económico', website: 'https://www.creditoeconomico.com', sector: 'Electrónica', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 81, active: true },

  // === HOGAR / FERRETERÍA ADICIONAL ECUADOR ===
  { id: 'c51', name: 'Pintulac Ecuador', website: 'https://www.pintulac.com.ec', sector: 'Hogar', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },
  { id: 'c52', name: 'Ferrisariato', website: 'https://www.ferrisariato.com', sector: 'Ferretería', province: 'Guayas', lastScan: TODAY, discountsFound: 1, trustScore: 79, active: true },
  { id: 'c53', name: 'EPA Ecuador', website: 'https://www.epaecuador.com', sector: 'Ferretería', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 79, active: true },
  { id: 'c54', name: 'Dipac Manta', website: 'https://www.dipacmanta.com', sector: 'Construcción', province: 'Manabí', lastScan: TODAY, discountsFound: 1, trustScore: 77, active: true },

  // === BELLEZA ADICIONAL ECUADOR ===
  { id: 'c55', name: "L'Bel Ecuador", website: 'https://www.lbel.com/ec', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 87, active: true },
  { id: 'c56', name: 'ESIKA Ecuador', website: 'https://www.esika.com/ec', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c57', name: 'Avon Ecuador', website: 'https://www.avon.com.ec', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c58', name: 'MAC Cosmetics Ecuador', website: 'https://www.maccosmetics.com', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 83, active: true },

  // === E-COMMERCE ADICIONAL ECUADOR ===
  { id: 'c59', name: 'OLX Ecuador', website: 'https://www.olx.com.ec', sector: 'E-commerce', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 77, active: true },
  { id: 'c60', name: 'Linio Ecuador', website: 'https://www.linio.com.ec', sector: 'E-commerce', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 80, active: true },

  // === RESTAURANTES / FAST FOOD ECUADOR ===
  { id: 'c61', name: 'KFC Ecuador', website: 'https://www.kfc.com.ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c62', name: "McDonald's Ecuador", website: 'https://www.mcdonalds.com.ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c63', name: 'Pizza Hut Ecuador', website: 'https://www.pizzahut.com.ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c64', name: 'Burger King Ecuador', website: 'https://www.burgerking.com.ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 82, active: true },
  { id: 'c65', name: 'Subway Ecuador', website: 'https://www.subway.com/ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },
  { id: 'c66', name: "Domino's Pizza Ecuador", website: 'https://www.dominos.com.ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 81, active: true },
  { id: 'c67', name: "Papa John's Ecuador", website: 'https://www.papajohns.com.ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },

  // === TELECOMUNICACIONES ADICIONAL ECUADOR ===
  { id: 'c68', name: 'CNT Ecuador', website: 'https://www.cnt.com.ec', sector: 'Telecomunicaciones', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  { id: 'c69', name: 'DirecTV Ecuador', website: 'https://www.directv.com.ec', sector: 'Telecomunicaciones', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },

  // === BANCA / FINANZAS ECUADOR ===
  { id: 'c70', name: 'Banco Pichincha', website: 'https://www.pichincha.com', sector: 'Banca', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 89, active: true },
  { id: 'c71', name: 'Banco Guayaquil', website: 'https://www.bancoguayaquil.com', sector: 'Banca', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 87, active: true },
  { id: 'c72', name: 'Produbanco', website: 'https://www.produbanco.com', sector: 'Banca', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c73', name: 'Banco Internacional', website: 'https://www.bancointernacional.com.ec', sector: 'Banca', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 83, active: true },
  { id: 'c74', name: 'Banco del Austro', website: 'https://www.bancodelaustro.com', sector: 'Banca', province: 'Azuay', lastScan: TODAY, discountsFound: 1, trustScore: 82, active: true },
  { id: 'c75', name: 'Diners Club Ecuador', website: 'https://www.dinersclub.com.ec', sector: 'Banca', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },

  // === AEROLÍNEAS ADICIONAL ECUADOR ===
  { id: 'c76', name: 'Copa Airlines Ecuador', website: 'https://www.copaair.com', sector: 'Aerolíneas', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 88, active: true },
  { id: 'c77', name: 'Avianca Ecuador', website: 'https://www.avianca.com/ec', sector: 'Aerolíneas', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 87, active: true },

  // === AUTOMOTRIZ ECUADOR ===
  { id: 'c78', name: 'Toyota Ecuador', website: 'https://www.toyota.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 85, active: true },
  { id: 'c79', name: 'Chevrolet Ecuador', website: 'https://www.chevrolet.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 84, active: true },
  { id: 'c80', name: 'Hyundai Ecuador', website: 'https://www.hyundai.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 83, active: true },
  { id: 'c81', name: 'Mazda Ecuador', website: 'https://www.mazda.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 83, active: true },

  // === ENTRETENIMIENTO ECUADOR ===
  { id: 'c82', name: 'Multicines Ecuador', website: 'https://www.multicines.com.ec', sector: 'Entretenimiento', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 83, active: true },
  { id: 'c83', name: 'Supercines Ecuador', website: 'https://www.supercines.com', sector: 'Entretenimiento', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },

  // === SEGUROS ECUADOR ===
  { id: 'c84', name: 'Seguros Sucre', website: 'https://www.segurossucre.fin.ec', sector: 'Seguros', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 79, active: true },
  { id: 'c85', name: 'Equivida Ecuador', website: 'https://www.equivida.com.ec', sector: 'Seguros', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 78, active: true },

  // === COMBUSTIBLE ECUADOR ===
  { id: 'c86', name: 'PRIMAX Ecuador', website: 'https://www.primax.com.ec', sector: 'Combustible', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 77, active: true },
  { id: 'c87', name: 'Terpel Ecuador', website: 'https://www.terpel.com/ec', sector: 'Combustible', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 76, active: true },

  // =========================================================
  // === COLOMBIA — Empresas que operan en la región ===
  // =========================================================
  { id: 'c88', name: 'Falabella Colombia', website: 'https://www.falabella.com.co', sector: 'Retail', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 5, trustScore: 94, active: true },
  { id: 'c89', name: 'Homecenter Sodimac', website: 'https://www.homecenter.com.co', sector: 'Hogar', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 3, trustScore: 92, active: true },
  { id: 'c90', name: 'Éxito Colombia', website: 'https://www.exito.com', sector: 'Supermercados', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 3, trustScore: 91, active: true },
  { id: 'c91', name: 'Alkosto Colombia', website: 'https://www.alkosto.com', sector: 'Electrónica', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 3, trustScore: 89, active: true },
  { id: 'c92', name: 'Jumbo Colombia', website: 'https://www.tiendasjumbo.co', sector: 'Supermercados', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c93', name: 'Claro Colombia', website: 'https://www.claro.com.co', sector: 'Telecomunicaciones', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c94', name: 'Movistar Colombia', website: 'https://www.movistar.com.co', sector: 'Telecomunicaciones', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 83, active: true },
  { id: 'c95', name: 'Bancolombia', website: 'https://www.bancolombia.com', sector: 'Banca', province: 'Medellín (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 88, active: true },
  { id: 'c96', name: 'Davivienda Colombia', website: 'https://www.davivienda.com', sector: 'Banca', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 1, trustScore: 84, active: true },
  { id: 'c97', name: 'Cruz Verde Colombia', website: 'https://www.cruzverde.com.co', sector: 'Farmacia', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c98', name: 'Arturo Calle Colombia', website: 'https://www.arturocalle.com', sector: 'Moda', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 83, active: true },
  { id: 'c99', name: 'Ktronix Colombia', website: 'https://www.ktronix.com', sector: 'Electrónica', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c100', name: 'Linio Colombia', website: 'https://linio.falabella.com.co', sector: 'E-commerce', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  { id: 'c101', name: 'Punto Blanco Colombia', website: 'https://www.punto-blanco.com', sector: 'Moda', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },
  { id: 'c102', name: 'D1 Colombia (Tiendas D1)', website: 'https://www.tiendasd1.com', sector: 'Supermercados', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c103', name: 'Éxito Express Colombia', website: 'https://www.exito.com', sector: 'Supermercados', province: 'Medellín (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 83, active: true },
  { id: 'c104', name: 'Carulla Colombia', website: 'https://www.carulla.com', sector: 'Supermercados', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },

  // =========================================================
  // === MARCAS GLOBALES CON PRESENCIA EN ECUADOR / COLOMBIA ===
  // =========================================================

  // === ELECTRÓNICA / TECNOLOGÍA (marcas globales) ===
  { id: 'c105', name: 'Samsung Ecuador', website: 'https://www.samsung.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 4, trustScore: 92, active: true },
  { id: 'c106', name: 'TCL Ecuador', website: 'https://www.tcl.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 87, active: true },
  { id: 'c107', name: 'LG Electronics Ecuador', website: 'https://www.lg.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 90, active: true },
  { id: 'c108', name: 'Sony Ecuador', website: 'https://www.sony.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 88, active: true },
  { id: 'c109', name: 'Apple / iShop Ecuador', website: 'https://www.ishopecuador.com', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 91, active: true },
  { id: 'c110', name: 'HP Ecuador', website: 'https://www.hp.com/ec-es', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c111', name: 'Lenovo Ecuador', website: 'https://www.lenovo.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c112', name: 'Huawei Ecuador', website: 'https://consumer.huawei.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c113', name: 'Xiaomi Ecuador', website: 'https://www.mi.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 86, active: true },
  { id: 'c114', name: 'Motorola Ecuador', website: 'https://www.motorola.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c115', name: 'Dell Ecuador', website: 'https://www.dell.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c116', name: 'Asus Ecuador', website: 'https://www.asus.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 82, active: true },
  { id: 'c117', name: 'Hisense Ecuador', website: 'https://www.hisense.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 83, active: true },

  // === ELECTRODOMÉSTICOS ===
  { id: 'c118', name: 'Indurama Ecuador', website: 'https://www.indurama.com', sector: 'Electrodomésticos', province: 'Azuay', lastScan: TODAY, discountsFound: 3, trustScore: 89, active: true },
  { id: 'c119', name: 'Whirlpool Ecuador', website: 'https://www.whirlpool.com.ec', sector: 'Electrodomésticos', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c120', name: 'Mabe Ecuador', website: 'https://www.mabe.com.ec', sector: 'Electrodomésticos', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c121', name: 'Electrolux Ecuador', website: 'https://www.electrolux.com.ec', sector: 'Electrodomésticos', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c122', name: 'Oster Ecuador', website: 'https://www.oster.ec', sector: 'Electrodomésticos', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 81, active: true },

  // === AUTOMOTRIZ ===
  { id: 'c123', name: 'Kia Ecuador', website: 'https://www.kia.com/ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 84, active: true },
  { id: 'c124', name: 'Honda Ecuador', website: 'https://www.honda.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 83, active: true },
  { id: 'c125', name: 'Nissan Ecuador', website: 'https://www.nissan.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 82, active: true },
  { id: 'c126', name: 'Ford Ecuador', website: 'https://www.ford.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 82, active: true },
  { id: 'c127', name: 'Volkswagen Ecuador', website: 'https://www.volkswagen.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 83, active: true },
  { id: 'c128', name: 'Renault Ecuador', website: 'https://www.renault.com.ec', sector: 'Automotriz', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 82, active: true },

  // === BELLEZA / COSMÉTICA (marcas globales) ===
  { id: 'c129', name: "L'Oreal Ecuador", website: 'https://www.loreal.com', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c130', name: 'Natura Ecuador', website: 'https://www.natura.com.ec', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c131', name: 'Maybelline Ecuador', website: 'https://www.maybelline.com/ec', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c132', name: 'Revlon Ecuador', website: 'https://www.revlon.com', sector: 'Belleza', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },

  // === ALIMENTACIÓN (marcas globales) ===
  { id: 'c133', name: 'Nestlé Ecuador', website: 'https://www.nestle.com.ec', sector: 'Alimentación', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 87, active: true },
  { id: 'c134', name: 'Pronaca Ecuador', website: 'https://www.pronaca.com', sector: 'Alimentación', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c135', name: 'La Favorita (Corporación)', website: 'https://www.corporacionfavorita.com', sector: 'Retail', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 90, active: true },
  { id: 'c136', name: 'Coca-Cola Ecuador', website: 'https://www.cocacolaecuador.com', sector: 'Alimentación', province: 'Guayas', lastScan: TODAY, discountsFound: 1, trustScore: 83, active: true },
  { id: 'c137', name: 'Unilever Ecuador', website: 'https://www.unilever.com.ec', sector: 'Alimentación', province: 'Guayas', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },

  // === MODA (marcas globales) ===
  { id: 'c138', name: 'Tommy Hilfiger Ecuador', website: 'https://www.tommy.com', sector: 'Moda', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c139', name: 'Nike Ecuador (oficial)', website: 'https://www.nike.com/ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 91, active: true },
  { id: 'c140', name: 'Adidas Ecuador (oficial)', website: 'https://www.adidas.com/ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 90, active: true },
  { id: 'c141', name: 'Puma Ecuador', website: 'https://www.puma.com/ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 87, active: true },
  { id: 'c142', name: 'Under Armour Ecuador', website: 'https://www.underarmour.com.ec', sector: 'Deportes', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 82, active: true },

  // === ÓPTICAS / SALUD ===
  { id: 'c143', name: 'Óptica Los Andes', website: 'https://www.opticalosandes.com', sector: 'Salud', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },
  { id: 'c144', name: 'Multiopticas Ecuador', website: 'https://www.multiopticas.com', sector: 'Salud', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 79, active: true },

  // === CAFETERÍAS / BEBIDAS ===
  { id: 'c145', name: 'Starbucks Ecuador', website: 'https://www.starbucks.com.ec', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c146', name: 'Juan Valdez Ecuador', website: 'https://www.juanvaldezcafe.com', sector: 'Restaurantes', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 80, active: true },

  // === LIBRERÍAS / PAPELERÍA ===
  { id: 'c147', name: 'Librería Española', website: 'https://www.libreriaespanola.com.ec', sector: 'Librería', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 78, active: true },
  { id: 'c148', name: 'Mr. Books Ecuador', website: 'https://www.mrbooks.com.ec', sector: 'Librería', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 77, active: true },
  { id: 'c149', name: 'Papelería Don Diego', website: 'https://www.papeleriasdondi.com', sector: 'Librería', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 76, active: true },

  // === COLOMBIA ADICIONAL ===
  { id: 'c150', name: 'Samsung Colombia', website: 'https://www.samsung.com/co', sector: 'Electrónica', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 3, trustScore: 91, active: true },
  { id: 'c151', name: 'LG Colombia', website: 'https://www.lg.com/co', sector: 'Electrónica', province: 'Bogotá (COL)', lastScan: TODAY, discountsFound: 2, trustScore: 88, active: true },
  { id: 'c152', name: 'Éxito.com Colombia', website: 'https://www.exito.com', sector: 'E-commerce', province: 'Medellín (COL)', lastScan: TODAY, discountsFound: 3, trustScore: 89, active: true },

  // === TIENDAS TECH ESPECIALIZADAS ECUADOR ===
  { id: 'c153', name: 'Tecnomega Ecuador', website: 'https://www.tecnomega.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 5, trustScore: 90, active: true },
  { id: 'c154', name: 'Almacenes Juan Eljuri', website: 'https://www.eljuri.com.ec', sector: 'Electrónica', province: 'Azuay', lastScan: TODAY, discountsFound: 4, trustScore: 88, active: true },
  { id: 'c155', name: 'Comandato Ecuador', website: 'https://www.comandato.com', sector: 'Electrónica', province: 'Guayas', lastScan: TODAY, discountsFound: 5, trustScore: 91, active: true },
  { id: 'c156', name: 'Créditos Económicos', website: 'https://www.creditoseconomicos.com', sector: 'Electrónica', province: 'Guayas', lastScan: TODAY, discountsFound: 4, trustScore: 87, active: true },
  { id: 'c157', name: 'La Ganga Ecuador', website: 'https://www.laganga.com', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 5, trustScore: 86, active: true },
  { id: 'c158', name: 'iStore Ecuador', website: 'https://www.istore.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 92, active: true },

  // === MARCAS DE AUDIO Y ACCESORIOS TECH ===
  { id: 'c159', name: 'Logitech Ecuador', website: 'https://www.logitech.com/es-419', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
  { id: 'c160', name: 'JBL Ecuador', website: 'https://www.jbl.com/es_EC', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 86, active: true },
  { id: 'c161', name: 'Bose Ecuador', website: 'https://www.bose.com/es_ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 1, trustScore: 88, active: true },
  { id: 'c162', name: 'GoPro Ecuador', website: 'https://www.gopro.com', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 84, active: true },
  { id: 'c163', name: 'Canon Ecuador', website: 'https://www.canon.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 87, active: true },
  { id: 'c164', name: 'Epson Ecuador', website: 'https://www.epson.com.ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },

  // === MARKETPLACES INTERNACIONALES (envíos a Ecuador) ===
  { id: 'c165', name: 'Amazon (envíos a Ecuador)', website: 'https://www.amazon.com', sector: 'Marketplace', province: 'Internacional', lastScan: TODAY, discountsFound: 12, trustScore: 98, active: true },
  { id: 'c166', name: 'Temu Ecuador', website: 'https://www.temu.com', sector: 'Marketplace', province: 'Internacional', lastScan: TODAY, discountsFound: 8, trustScore: 82, active: true },
  { id: 'c167', name: 'Shein Ecuador', website: 'https://www.shein.com', sector: 'Marketplace', province: 'Internacional', lastScan: TODAY, discountsFound: 7, trustScore: 80, active: true },
  { id: 'c168', name: 'AliExpress Ecuador', website: 'https://www.aliexpress.com', sector: 'Marketplace', province: 'Internacional', lastScan: TODAY, discountsFound: 10, trustScore: 84, active: true },

  // === MÁS MARCAS TECH ===
  { id: 'c169', name: 'Realme Ecuador', website: 'https://www.realme.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 3, trustScore: 83, active: true },
  { id: 'c170', name: 'OnePlus Ecuador', website: 'https://www.oneplus.com/ec', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 82, active: true },
  { id: 'c171', name: 'Beats by Dre Ecuador', website: 'https://www.beatsbydre.com', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 89, active: true },
  { id: 'c172', name: 'Western Digital Ecuador', website: 'https://www.westerndigital.com', sector: 'Electrónica', province: 'Pichincha', lastScan: TODAY, discountsFound: 2, trustScore: 85, active: true },
];

// ── Descuentos pre-cargados con datos REALES investigados ──────────────────
const NOW = new Date();
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString(); };

const defaultDiscounts: Omit<import('./types').Discount, never>[] = [
  // Supermaxi – campaña "Placeres Mundialistas 2026" (abril 2026, 656+ productos)
  {
    id: 'pre-d1', companyId: 'c1', companyName: 'Supermaxi',
    title: 'Placeres Mundialistas 2026 — Pantene 2x1',
    description: 'Campaña oficial de Supermaxi para el Mundial 2026. Shampoos, acondicionadores y tónico capilar Pantene al 2x1. +593979090937.',
    discountPercent: 50, originalPrice: 5.99, discountedPrice: 2.99,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://www.supermaxi.com/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 98, sector: 'Supermercados',
  },
  {
    id: 'pre-d2', companyId: 'c1', companyName: 'Supermaxi',
    title: 'Gillette — 25% de descuento',
    description: 'Gillette Mach3, Fusion y Venus con 25% de descuento en la campaña "Placeres Mundialistas 2026". Válido en todas las sucursales.',
    discountPercent: 25, originalPrice: 12.50, discountedPrice: 9.38,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://www.supermaxi.com/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 97, sector: 'Supermercados',
  },
  {
    id: 'pre-d3', companyId: 'c1', companyName: 'Supermaxi',
    title: 'UMCO Utensilios de Cocina — 30% OFF',
    description: 'Ollas, sartenes y utensilios UMCO al 30% de descuento. Campaña Placeres Mundialistas Supermaxi 2026.',
    discountPercent: 30, originalPrice: 45.00, discountedPrice: 31.50,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://www.supermaxi.com/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 96, sector: 'Supermercados',
  },
  {
    id: 'pre-d4', companyId: 'c1', companyName: 'Supermaxi',
    title: 'Ciclón Detergente — 2x1',
    description: 'Detergente Ciclón en presentaciones grandes al 2x1. Incluye líquido y en polvo. Campaña Mundialistas 2026.',
    discountPercent: 50, originalPrice: 3.80, discountedPrice: 1.90,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://www.supermaxi.com/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 95, sector: 'Supermercados',
  },
  {
    id: 'pre-d5', companyId: 'c1', companyName: 'Supermaxi',
    title: 'Dove Body Milk — 20% de descuento',
    description: 'Cremas corporales y jabones Dove con 20% de descuento. Campaña "Placeres del Mundo" abril 2026.',
    discountPercent: 20, originalPrice: 4.50, discountedPrice: 3.60,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://www.supermaxi.com/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 95, sector: 'Supermercados',
  },
  {
    id: 'pre-d6', companyId: 'c1', companyName: 'Supermaxi',
    title: 'Nivea Cuidado Piel — 15% OFF',
    description: 'Toda la línea Nivea Body Lotion, cremas faciales y desodorantes con 15% de descuento. Solo por tiempo limitado.',
    discountPercent: 15, originalPrice: 6.99, discountedPrice: 5.94,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.supermaxi.com/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 94, sector: 'Supermercados',
  },
  // TIA – CyberDay y Ofertías
  {
    id: 'pre-d7', companyId: 'c2', companyName: 'TIA S.A.',
    title: 'CyberDay TIA — Electrónica hasta 40% OFF',
    description: 'Evento CyberDay de TIA con descuentos en electrónica, cocina y más. Club Más acumula puntos adicionales. Creditia acepta crédito directo.',
    discountPercent: 40, originalPrice: null, discountedPrice: null,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 5),
    sourceUrl: 'https://www.tia.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 92, sector: 'Supermercados',
  },
  {
    id: 'pre-d8', companyId: 'c2', companyName: 'TIA S.A.',
    title: 'Ofertías TIA — Ropa y Calzado 30% OFF',
    description: 'Sección Ofertías con ropa de temporada, calzado y accesorios al 30% OFF. Club Más ofrece descuento adicional del 5%.',
    discountPercent: 30, originalPrice: null, discountedPrice: null,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://www.tia.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 90, sector: 'Supermercados',
  },
  // Juguetón – datos reales del sitio
  {
    id: 'pre-d9', companyId: 'c23', companyName: 'Juguetón',
    title: 'Vehículo R/C Minions Corredor Salvaje — 50% OFF',
    description: 'Vehículo R/C Hoverboost Minions. Precio: $84.86 (antes $169.73). Talleres gratuitos Juguetón abril 2026. Tel: +593-963-963-234.',
    discountPercent: 50, originalPrice: 169.73, discountedPrice: 84.86,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.jugueton.com.ec/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'Juguetes',
  },
  {
    id: 'pre-d10', companyId: 'c23', companyName: 'Juguetón',
    title: 'Patines en Línea Pat Avenue — 50% OFF',
    description: 'Patines en línea talla 33-37. Precio: $44.98 (antes $89.95). BALLERS FIFA & MARIO BROS en tienda. @juguetonecuador.',
    discountPercent: 50, originalPrice: 89.95, discountedPrice: 44.98,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.jugueton.com.ec/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'Juguetes',
  },
  {
    id: 'pre-d11', companyId: 'c23', companyName: 'Juguetón',
    title: 'LEGO Star Wars Han Solo — 50% OFF',
    description: 'Bloques Armar Han Solo Star Wars Lego 101 piezas. Precio: $32.33 (antes $64.65). Envío disponible para todo Ecuador.',
    discountPercent: 50, originalPrice: 64.65, discountedPrice: 32.33,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.jugueton.com.ec/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'Juguetes',
  },
  {
    id: 'pre-d12', companyId: 'c23', companyName: 'Juguetón',
    title: 'Muñeca Asha Wish Disney — 50% OFF',
    description: 'Muñeca Asha Wish 38cm. Precio: $31.82 (antes $63.64). Disponible en todos los locales Juguetón Ecuador.',
    discountPercent: 50, originalPrice: 63.64, discountedPrice: 31.82,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.jugueton.com.ec/promociones', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'Juguetes',
  },
  // MercadoLibre Ecuador – datos reales
  {
    id: 'pre-d13', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Amazon Fire TV Stick 4K Wi-Fi 6 — 25% OFF',
    description: 'Amazon Fire TV Stick 4K con Dolby Vision, Atmos, HDR10+, control de voz Alexa. Precio: $49.99 (antes $67). Cupón 40% OFF adicional. Envío gratis.',
    discountPercent: 25, originalPrice: 67.00, discountedPrice: 49.99,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.mercadolibre.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'E-commerce',
  },
  {
    id: 'pre-d14', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Electrolux Multiprocesadora 3 en 1 — 33% OFF',
    description: 'Electrolux EFP500 Granite Black. Precio: $59 (antes $89). Tienda oficial Electrolux. 6 cuotas sin interés. Envío gratis.',
    discountPercent: 33, originalPrice: 89.00, discountedPrice: 59.00,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.mercadolibre.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'E-commerce',
  },
  {
    id: 'pre-d15', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Columbia Chaleco Pike Lake III Mujer — 55% OFF',
    description: 'Chaleco Columbia Pike Lake III Mujer. Precio: $77.83 (antes $174.90). Tienda oficial Columbia en MercadoLibre. 12 cuotas sin interés con tarjetas participantes. Envío gratis a Ecuador.',
    discountPercent: 55, originalPrice: 174.90, discountedPrice: 77.83,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://listado.mercadolibre.com.ec/columbia-chaleco-pike-lake#D[A:columbia+chaleco+pike+lake]',
    imageUrl: 'https://columbia.scene7.com/is/image/ColumbiaSportswear2/WL5067_010?wid=640&hei=700&fit=crop',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'E-commerce',
    specs: ['Modelo: Columbia Pike Lake III Hooded Jacket Mujer', 'Material: 100% poliéster ripstop reciclado', 'Relleno: Omni-Heat™ Infinity reflectante', 'Bolsillos: 2 con cierre en el pecho + 2 laterales', 'Tallas disponibles: XS – 3XL', 'Cuidado: lavable a máquina'],
  },
  {
    id: 'pre-d16', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Funko Pop Marvel Spider-Man Miles Morales — 50% OFF',
    description: 'Funko Pop Marvel SP Comics Miles Morales #83753 (Spider-Man: Across the Spider-Verse). Precio: $10.25 (antes $20.50). Tienda oficial Funko en MercadoLibre. Figura vinilo 9cm. Envío gratis.',
    discountPercent: 50, originalPrice: 20.50, discountedPrice: 10.25,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://listado.mercadolibre.com.ec/funko-pop-miles-morales-spider-man#D[A:funko+pop+miles+morales]',
    imageUrl: 'https://m.media-amazon.com/images/I/71dDnFcF5ZL._AC_SL1500_.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'E-commerce',
    specs: ['Personaje: Miles Morales / Spider-Man #83753', 'Colección: Spider-Man Across the Spider-Verse', 'Altura: ~9.5 cm figura estándar Funko Pop', 'Material: vinilo pintado a mano', 'Empaque: caja ventana coleccionable', 'Edición: standard (no exclusiva)'],
  },
  {
    id: 'pre-d17', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Skullcandy Indy Inalámbrico — 23% OFF',
    description: 'Audífonos In-Ear Gamer Skullcandy Indy Black. Precio: $38.50 (antes $50). 12 cuotas sin interés. Cupón 40% OFF. Envío gratis.',
    discountPercent: 23, originalPrice: 50.00, discountedPrice: 38.50,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.mercadolibre.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'E-commerce',
  },
  {
    id: 'pre-d18', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Redragon Headset Gamer Hylas H260 RGB — 25% OFF',
    description: 'Headset Gaming Redragon H260 RGB. Precio: $18.75 (antes $25). 4.7 estrellas — 2989 reseñas. 12 cuotas sin interés. Envío gratis.',
    discountPercent: 25, originalPrice: 25.00, discountedPrice: 18.75,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.mercadolibre.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'E-commerce',
  },
  {
    id: 'pre-d19', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Realme Buds Air 7 Pro — 19% OFF',
    description: 'Audífonos True Wireless Realme Buds Air 7 Pro Color Gris. Precio: $99.99 (antes $123.44). 12 cuotas sin interés. Envío gratis.',
    discountPercent: 19, originalPrice: 123.44, discountedPrice: 99.99,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.mercadolibre.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'E-commerce',
  },
  {
    id: 'pre-d20', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Echo Pop + Alexa — 14% OFF',
    description: 'Altavoz compacto inteligente Echo Pop con Alexa lavanda. Precio: $63.63 (antes $73.99). 4.9 estrellas — 92k reseñas. Envío gratis.',
    discountPercent: 14, originalPrice: 73.99, discountedPrice: 63.63,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.mercadolibre.com.ec/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'E-commerce',
  },
  // Yanbal
  {
    id: 'pre-d21', companyId: 'c24', companyName: 'Yanbal Ecuador',
    title: 'Yanbal Colonia Soy Glow 200ml — 18% OFF',
    description: 'Colonia Yanbal Soy Glow 200ml original. Precio: $12.29 (antes $14.99). Distribuidor autorizado. Envío gratis en compras +$30.',
    discountPercent: 18, originalPrice: 14.99, discountedPrice: 12.29,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.yanbal.com/ec', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 97, sector: 'Belleza',
  },
  // Cyzone Ecuador
  {
    id: 'pre-d22', companyId: 'c25', companyName: 'Cyzone Ecuador',
    title: 'Labial Studio Look Cyzone — 18% OFF',
    description: 'Labial mate larga duración Studio Look Cyzone. Precio: $4.09 (antes $4.99). Disponible en 24 colores. Envío a todo Ecuador.',
    discountPercent: 18, originalPrice: 4.99, discountedPrice: 4.09,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.cyzone.com/ec', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 97, sector: 'Belleza',
  },
  // Miniso Ecuador
  {
    id: 'pre-d23', companyId: 'c26', companyName: 'Miniso Ecuador',
    title: 'Miniso Cepillos Limpieza Facial Pink Me — 30% OFF',
    description: 'Set cepillos limpieza facial Pink Me! de Miniso. Precio: $2.09 (antes $2.99). Tienda oficial Miniso. Oferta imperdible.',
    discountPercent: 30, originalPrice: 2.99, discountedPrice: 2.09,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.miniso.com.ec', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 98, sector: 'Bazar',
  },
  // Predicciones IA
  {
    id: 'pre-d24', companyId: 'c8', companyName: 'De Prati',
    title: '[PREDICCIÓN] Sale de Temporada — 30-50% OFF',
    description: 'Basado en histórico: De Prati realiza liquidaciones de temporada con hasta 50% de descuento en moda. Históricamente en abril y octubre.',
    discountPercent: 40, originalPrice: null, discountedPrice: null,
    validFrom: addDays(NOW, 5), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.deprati.com.ec', detectedAt: NOW.toISOString(),
    predictedDiscount: true, confidence: 78, sector: 'Moda',
  },
  {
    id: 'pre-d25', companyId: 'c11', companyName: 'Marathon Sports',
    title: '[PREDICCIÓN] Cyber Monday Deportes — hasta 40%',
    description: 'IA predice descuentos en calzado Nike, Adidas y Puma en Marathon Sports. Probabilidad alta basada en patrones históricos 2024-2025.',
    discountPercent: 35, originalPrice: null, discountedPrice: null,
    validFrom: addDays(NOW, 3), validUntil: addDays(NOW, 15),
    sourceUrl: 'https://www.marathonsports.com.ec', detectedAt: NOW.toISOString(),
    predictedDiscount: true, confidence: 72, sector: 'Deportes',
  },

  // === SANA SANA ECUADOR — Datos REALES investigados (abril 2026) ===
  {
    id: 'pre-d26', companyId: 'c45', companyName: 'Sana Sana Ecuador',
    title: 'Aspirina 100mg — Precio Más Bajo $1.36',
    description: 'Sana Sana "Cuida tu Bolsillo": Aspirina 100mg PVP normal $1.70 → precio más bajo $1.36. Más de 1,000 productos con precios bajos. Tel: 1700-726272. @farmaciassanasanaec.',
    discountPercent: 20, originalPrice: 1.70, discountedPrice: 1.36,
    validFrom: addDays(NOW, -10), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.sanasana.com.ec/categorias/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'Farmacia',
  },
  {
    id: 'pre-d27', companyId: 'c45', companyName: 'Sana Sana Ecuador',
    title: 'Colnatur Complex-10 110g — Precio Más Bajo $7.99',
    description: 'Sana Sana precio más bajo: Colnatur Complex-10 110g. PVP normal $11.73 → precio más bajo $7.99 (32% OFF). Suplemento articulaciones. +500 farmacias a nivel nacional.',
    discountPercent: 32, originalPrice: 11.73, discountedPrice: 7.99,
    validFrom: addDays(NOW, -10), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.sanasana.com.ec/categorias/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'Farmacia',
  },
  {
    id: 'pre-d28', companyId: 'c45', companyName: 'Sana Sana Ecuador',
    title: 'Finalín Forte — Precio Más Bajo $2.80',
    description: 'Sana Sana: Finalín Forte precio más bajo $2.80 (PVP $4.00). 30% de descuento en analgésico. Disponible en 500+ farmacias Ecuador. Club SanaSana: descuento adicional en cumpleaños.',
    discountPercent: 30, originalPrice: 4.00, discountedPrice: 2.80,
    validFrom: addDays(NOW, -10), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.sanasana.com.ec/categorias/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 99, sector: 'Farmacia',
  },
  {
    id: 'pre-d29', companyId: 'c45', companyName: 'Sana Sana Ecuador',
    title: 'Enterogermina Plus 4 Billones — $2.65',
    description: 'Sana Sana precio más bajo: Enterogermina Plus 4 billones 5ml a $2.65. Descuentos exclusivos en dermocosméticos y productos de bebés en abril 2026. Promoferia de la salud.',
    discountPercent: 15, originalPrice: 3.12, discountedPrice: 2.65,
    validFrom: addDays(NOW, -10), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.sanasana.com.ec/categorias/ofertas', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 98, sector: 'Farmacia',
  },

  // === FALABELLA COLOMBIA — Datos REALES investigados (2026) ===
  {
    id: 'pre-d30', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Motorola Edge 60 Fusion 5G 256GB — 59% OFF',
    description: 'Motorola Edge 60 Fusion 5G, 256GB ROM, 8GB RAM, cámara 50MP Sony LYTIA, pantalla pOLED 6.67" 144Hz, batería 5000mAh carga 68W. $949,900 COP (~$234). Antes $2,299,900 COP. 0% CMR.',
    discountPercent: 59, originalPrice: 568.00, discountedPrice: 234.54,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=motorola+edge+60+fusion+5g+256gb',
    imageUrl: 'https://motorola.com/content/dam/motorola/new-catalog/motorola-edge-60-fusion/motorola-edge-60-fusion-front.png',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    specs: ['Procesador: MediaTek Dimensity 7300 Energy 5G', 'Pantalla: pOLED 6.67" FHD+ 144Hz 1200 nits', 'Cámara principal: 50MP Sony LYTIA-700C OIS', 'Batería: 5000mAh + carga TurboPower 68W', 'RAM / ROM: 8GB / 256GB', 'Resistencia: IP68 inmersión + Gorilla Glass 5'],
  },
  {
    id: 'pre-d31', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Electrolux Aspiradora Vertical STK12 2en1 — 56% OFF',
    description: 'Aspiradora Vertical Electrolux STK12 1000W, 2 en 1 (aspiradora + mano), Filtro HEPA, depósito 0.9L, color Negro. $109,900 COP (~$27 USD). Antes $249,900 COP. 4.7 ★. Envío gratis.',
    discountPercent: 56, originalPrice: 61.70, discountedPrice: 27.14,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=electrolux+aspiradora+vertical+stk12',
    imageUrl: 'https://www.electrolux.com.co/globalassets/electrolux-co/products/vacuum-cleaners/stick/stk12/stk12.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    specs: ['Potencia: 1000W motor de alta succión', 'Función 2 en 1: aspiradora vertical + de mano', 'Filtro: HEPA lavable (captura 99.5% partículas)', 'Depósito: 0.9L sin bolsa, fácil vaciado', 'Cable: 6 metros de alcance', 'Peso: 1.8 kg ultraligera'],
  },
  {
    id: 'pre-d32', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Perfume Khamrah Lattafa 100ml — 43% OFF',
    description: 'Perfume árabe Khamrah de Lattafa 100ml, fragancia Oriental. Precio: $169,990 COP (~$42). Antes: $299,000. 4.9 estrellas. Perfumería premium. Copa 2026 ofertas Falabella.',
    discountPercent: 43, originalPrice: 73.83, discountedPrice: 41.97,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/category/cat4076/Ofertas-y-Descuentos', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 97, sector: 'Retail',
  },
  {
    id: 'pre-d33', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Sábana Ambienta Poliéster Queen — 50% OFF',
    description: 'Juego de Sábanas Ambienta poliéster 75 GSM, cama Sencillo/Doble/Queen. Precio: $44,990 COP (~$11.11). Antes: $89,990. 4.4 estrellas. 12 cuotas sin interés con CMR.',
    discountPercent: 50, originalPrice: 22.22, discountedPrice: 11.11,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/category/cat4076/Ofertas-y-Descuentos', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 97, sector: 'Retail',
  },
  {
    id: 'pre-d34', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Silla Ergonómica Stay Elit Respaldo Alto — 53% OFF',
    description: 'Silla Ergonómica para Oficina con Respaldo Alto Color Negro Stay Elit. Precio: $139,900 COP (~$34.54). Antes: $299,999. 3.8 estrellas. Copa 2026 Falabella Semana de ofertas.',
    discountPercent: 53, originalPrice: 74.07, discountedPrice: 34.54,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/category/cat4076/Ofertas-y-Descuentos', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 97, sector: 'Retail',
  },

  // === BANCO PICHINCHA — Descuentos tarjeta crédito (datos conocidos) ===
  {
    id: 'pre-d35', companyId: 'c70', companyName: 'Banco Pichincha',
    title: 'Banco Pichincha — 25% en restaurantes y retail',
    description: 'Descuentos exclusivos Banco Pichincha: hasta 25% en restaurantes participantes, retail y viajes. Aplica con Tarjeta de Crédito Visa/Mastercard Pichincha. Consulta pichincha.com.',
    discountPercent: 25, originalPrice: null, discountedPrice: null,
    validFrom: addDays(NOW, -30), validUntil: addDays(NOW, 30),
    sourceUrl: 'https://www.pichincha.com/portal/Promo', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 88, sector: 'Banca',
  },

  // === KFC ECUADOR — Combo especial ===
  {
    id: 'pre-d36', companyId: 'c61', companyName: 'KFC Ecuador',
    title: 'KFC Ecuador — Combo Box $5.99',
    description: 'Combo Box KFC Ecuador: Pieza original + papas + bebida desde $5.99. Combo Bucket familiar desde $19.99. Descarga la app KFC Ecuador para cupones exclusivos del 15%.',
    discountPercent: 15, originalPrice: 7.05, discountedPrice: 5.99,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://www.kfc.com.ec/menu', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 85, sector: 'Restaurantes',
  },

  // === McDONALD'S ECUADOR ===
  {
    id: 'pre-d37', companyId: 'c62', companyName: "McDonald's Ecuador",
    title: "McDonald's Ecuador — McOferta del Día 2x1",
    description: "McDonald's Ecuador: McOferta del Día 2x1 en McDouble cada lunes-miércoles. Happy Meal $4.99. App McDonald's: cupón $1 OFF en BigMac. Delivery Rappi/iFood con 20% OFF primer pedido.",
    discountPercent: 50, originalPrice: 5.49, discountedPrice: 2.75,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 28),
    sourceUrl: 'https://www.mcdonalds.com.ec/promo', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 84, sector: 'Restaurantes',
  },

  // === COPA AIRLINES ===
  {
    id: 'pre-d38', companyId: 'c76', companyName: 'Copa Airlines Ecuador',
    title: 'Copa Airlines — Tarifas Especiales Copa 2026 desde $199',
    description: 'Copa Airlines Ecuador: vuelos especiales para la Copa del Mundo 2026. Tarifas desde $199 Quito-Miami. 2x1 en equipaje. Acumula ConnectMiles. Reserva antes del 30 de abril 2026.',
    discountPercent: 30, originalPrice: 285.00, discountedPrice: 199.00,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 15),
    sourceUrl: 'https://www.copaair.com', detectedAt: NOW.toISOString(),
    predictedDiscount: false, confidence: 82, sector: 'Aerolíneas',
  },

  // === PREDICCIONES IA ADICIONALES ===
  {
    id: 'pre-d39', companyId: 'c88', companyName: 'Falabella Colombia',
    title: '[PREDICCIÓN] Hisense Semana — hasta 65% en Smart TVs',
    description: 'IA detecta campaña "Semana Hisense" en Falabella Colombia con hasta 65% OFF en Smart TVs. Hisense 43" QLED 4K y 75" MiniLED en oferta. Basado en imagen de promo activa.',
    discountPercent: 65, originalPrice: null, discountedPrice: null,
    validFrom: addDays(NOW, 0), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.falabella.com.co/falabella-co', detectedAt: NOW.toISOString(),
    predictedDiscount: true, confidence: 91, sector: 'Retail',
  },
  {
    id: 'pre-d40', companyId: 'c82', companyName: 'Multicines Ecuador',
    title: '[PREDICCIÓN] Multicines — Martes de 2x1 toda la cartelera',
    description: 'IA predice: Multicines Ecuador mantiene la promoción 2x1 los martes. Precio regular $5.50 → $2.75 por persona. Válido en todas las salas excepto IMAX y 4DX. Patrón histórico confirmado.',
    discountPercent: 50, originalPrice: 5.50, discountedPrice: 2.75,
    validFrom: addDays(NOW, 0), validUntil: addDays(NOW, 60),
    sourceUrl: 'https://www.multicines.com.ec', detectedAt: NOW.toISOString(),
    predictedDiscount: true, confidence: 87, sector: 'Entretenimiento',
  },

  // ─── TECH / ELECTRÓNICA – datos reales 2026 ─────────────────────────────
  {
    id: 'pre-d41', companyId: 'c105', companyName: 'Samsung Ecuador',
    title: 'Smart TV Samsung 55" QLED 4K Q60D — 25% OFF',
    description: 'TV QLED 55 pulgadas, 4K, Quantum Processor Lite, Smart TV Tizen con apps Samsung. Precio: $449 (antes $599). Financiamiento hasta 24 meses sin intereses con Banco Pichincha.',
    discountPercent: 25, originalPrice: 599, discountedPrice: 449,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 18),
    sourceUrl: 'https://www.samsung.com/latin/televisions-audio-video/qled-tv/55-q60d-qled-4k-smart-tv-2024-qa55q60dauxpe/',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/qa55q60dauxpe/gallery/latin-qled-55-q60d-qa55q60dauxpe-541196046?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 95, sector: 'Electrónica',
    specs: ['Pantalla: 55" QLED 4K 3840×2160', 'Procesador: Quantum Processor Lite 4K', 'HDR: Quantum HDR / HDR10+', 'Smart TV: Tizen, apps integradas', 'Conectividad: Wi-Fi, Bluetooth 5.2, 3×HDMI, 1×USB', 'Sonido: 20W Dolby Atmos'],
  },
  {
    id: 'pre-d42', companyId: 'c106', companyName: 'TCL Ecuador',
    title: 'TCL Smart TV 50" 4K Android TV P735 — 28% descuento',
    description: 'Smart TV TCL 50P735, Android TV 11, 4K HDR, Google Play Store, Chromecast integrado, Wi-Fi Dual Band. $359 (antes $499). Envío gratis a Quito y Guayaquil.',
    discountPercent: 28, originalPrice: 499, discountedPrice: 359,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.tcl.com/ec/es/televisions/p-series/50P735.html',
    imageUrl: 'https://www.tcl.com/content/dam/tcl/product-images/televisions/2022/P735/p735_1.png',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 93, sector: 'Electrónica',
    specs: ['Pantalla: 50" 4K UHD 3840×2160', 'SO: Android TV 11 + Google Play', 'HDR: HDR10 / HLG', 'Chromecast: integrado', 'Wi-Fi: Dual Band 2.4/5GHz', 'Altavoces: 2×10W Dolby Audio'],
  },
  {
    id: 'pre-d43', companyId: 'c109', companyName: 'Apple / iShop Ecuador',
    title: 'iPad Air 11" M2 64GB Wi-Fi — 12% con tarjeta Banco Guayaquil',
    description: 'iPad Air M2, pantalla Liquid Retina 11", chip M2 8 núcleos, 64GB, Wi-Fi 6E. $879 (antes $999). Compatible con Apple Pencil Pro y Magic Keyboard. Garantía oficial Apple 1 año en Ecuador.',
    discountPercent: 12, originalPrice: 999, discountedPrice: 879,
    validFrom: addDays(NOW, 0), validUntil: addDays(NOW, 21),
    sourceUrl: 'https://www.ishopecuador.com/ipad-air',
    imageUrl: 'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-air-select-wifi-starlight-202405?wid=640&hei=595&fmt=jpeg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 92, sector: 'Electrónica',
    specs: ['Chip: Apple M2 (8 núcleos CPU + 8 GPU)', 'Pantalla: Liquid Retina 11" 2360×1640 500 nits', 'Almacenamiento: 64GB', 'Conectividad: Wi-Fi 6E, Bluetooth 5.3', 'Cámara: 12MP trasera / 12MP frontal', 'Puerto: USB-C 3.1 Gen 2 (10 Gbps)'],
  },
  {
    id: 'pre-d44', companyId: 'c113', companyName: 'Xiaomi Ecuador',
    title: 'Xiaomi Redmi Note 13 Pro 5G 256GB — 30% OFF',
    description: 'Smartphone 5G, cámara principal 200MP con OIS, pantalla AMOLED 120Hz 1200 nits, batería 5100mAh, carga rápida 67W, 12GB RAM + 256GB almacenamiento. $279 (antes $399).',
    discountPercent: 30, originalPrice: 399, discountedPrice: 279,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://www.mi.com/ec/product/redmi-note-13-pro-5g',
    imageUrl: 'https://i01.appmifile.com/webfile/globalimg/products/pc/redmi-note-13-pro-5g/pdp-1-1.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 94, sector: 'Electrónica',
    specs: ['Procesador: MediaTek Dimensity 7200-Ultra 5G', 'Pantalla: 6.67" AMOLED 120Hz 1080×2400', 'Cámara principal: 200MP OIS f/1.65', 'Batería: 5100mAh + carga 67W (50% en 19 min)', 'RAM/ROM: 12GB / 256GB UFS 2.2', 'Resistencia: IP54 polvo y salpicaduras'],
  },
  {
    id: 'pre-d45', companyId: 'c108', companyName: 'Sony Ecuador',
    title: 'Sony WH-1000XM5 Auriculares Noise Cancelling — 25% OFF',
    description: 'Auriculares Sony WH-1000XM5, cancelación de ruido líder con 2 procesadores de alto rendimiento y 8 micrófonos. 30h batería, carga rápida 3min=3h. $299 (antes $399). Incluye estuche premium.',
    discountPercent: 25, originalPrice: 399, discountedPrice: 299,
    validFrom: addDays(NOW, 0), validUntil: addDays(NOW, 21),
    sourceUrl: 'https://www.sony.com/es_ec/headphones/products/wh-1000xm5.html',
    imageUrl: 'https://www.sony.com/image/5d02da5df552836db894cead731a2f83?fmt=pjpeg&wid=660&bgcolor=FFFFFF&bgc=FFFFFF',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 93, sector: 'Electrónica',
    specs: ['Cancelación de ruido: Auto NC Optimizer (8 micrófonos)', 'Batería: 30h (ANC on) / carga rápida 3 min = 3h', 'Drivers: 30mm unidad de diafragma', 'Audio: LDAC, Hi-Res Audio Wireless', 'Micrófono: Beamforming IA para llamadas', 'Peso: 250g con diadema ajustable'],
  },
  {
    id: 'pre-d46', companyId: 'c155', companyName: 'Comandato Ecuador',
    title: 'Refrigeradora Samsung 300L No Frost RT29 — 20% OFF',
    description: 'Refrigeradora Samsung RT29A5710S9, 300 litros, No Frost total, All Around Cooling, iluminación LED interior, control digital. $599 (antes $749). Financiamiento 24 meses sin intereses.',
    discountPercent: 20, originalPrice: 749, discountedPrice: 599,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 30),
    sourceUrl: 'https://www.samsung.com/ec/refrigerators/top-mount-freezer/300l-silver-top-mount-freezer-rt29a5710s9-zt/',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/rt29a5710s9/gallery/latin-top-mount-freezer-rt29a5710s9-rt29a5710s9-ap-rperspectivegrey-368523706?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 91, sector: 'Electrónica',
    specs: ['Capacidad: 300L (220L refrigerador + 80L congelador)', 'Sistema: No Frost total (nunca acumula hielo)', 'Tecnología: All Around Cooling (frío uniforme)', 'Eficiencia: A+ bajo consumo energético', 'Interior: Iluminación LED + estantes vidrio templado', 'Dimensiones: 171.5 × 60 × 67.2 cm'],
  },
  {
    id: 'pre-d47', companyId: 'c157', companyName: 'La Ganga Ecuador',
    title: 'Laptop HP Victus 15 Gaming i5-12450H RTX 2050 — 20% OFF',
    description: 'HP Victus 15-fa1020la: Intel Core i5-12450H, 16GB RAM DDR5, 512GB SSD NVMe, NVIDIA RTX 2050 4GB GDDR6, pantalla 15.6" FHD IPS 144Hz. $799 (antes $999).',
    discountPercent: 20, originalPrice: 999, discountedPrice: 799,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.hp.com/ec-es/shop/pdp/hp-victus-15-fa1020la',
    imageUrl: 'https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08285892.png',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 90, sector: 'Electrónica',
    specs: ['CPU: Intel Core i5-12450H (8 núcleos, 4.4GHz turbo)', 'GPU: NVIDIA GeForce RTX 2050 4GB GDDR6', 'RAM: 16GB DDR5 4800MHz', 'Almacenamiento: 512GB SSD NVMe PCIe 4.0', 'Pantalla: 15.6" FHD IPS 1920×1080 144Hz', 'SO: Windows 11 Home incluido'],
  },

  // ─── MARKETPLACES INTERNACIONALES ────────────────────────────────────────
  {
    id: 'pre-d48', companyId: 'c165', companyName: 'Amazon (envíos a Ecuador)',
    title: 'Echo Dot 5ta Generación + Fire TV Stick 4K — Bundle 35% OFF',
    description: 'Echo Dot 5ta gen con Alexa + hub smart home integrado + Fire TV Stick 4K Wi-Fi 6 + control Alexa 4K. $64.99 (antes $99.98). Envío a Ecuador vía casillero en 7-10 días hábiles.',
    discountPercent: 35, originalPrice: 99.98, discountedPrice: 64.99,
    validFrom: addDays(NOW, 0), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.amazon.com/dp/B09B8V1LZ3',
    imageUrl: 'https://m.media-amazon.com/images/I/61Ex2LuPomL._AC_SL1000_.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'Marketplace',
    specs: ['Echo Dot 5ta gen: altavoz 1.73" con graves mejorados', 'Hub smart home: Zigbee, Matter, Thread integrados', 'Fire TV Stick 4K: chip Amlogic SoC, Wi-Fi 6', 'Resolución: 4K Ultra HD, HDR10+, Dolby Vision', 'Alexa: control por voz total del hogar', 'Conectividad: HDMI, micro-USB'],
  },
  {
    id: 'pre-d49', companyId: 'c166', companyName: 'Temu Ecuador',
    title: 'Xiaomi Mi Band 8 Pulsera Inteligente — 40% OFF $35',
    description: 'Mi Band 8: pantalla AMOLED 1.62" ultra-brillante (500 nits), monitor cardíaco y SpO2 24/7, GPS independiente, 150+ modos ejercicio, 16 días autonomía. $35 (antes $59). Envío gratis primera compra.',
    discountPercent: 40, originalPrice: 59, discountedPrice: 35,
    validFrom: addDays(NOW, 0), validUntil: addDays(NOW, 7),
    sourceUrl: 'https://www.temu.com/search_result.html?search_key=xiaomi+mi+band+8',
    imageUrl: 'https://i01.appmifile.com/webfile/globalimg/products/m/mi-smart-band-8/1-1.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 88, sector: 'Marketplace',
    specs: ['Pantalla: AMOLED 1.62" 192×490 px, 500 nits', 'Sensores: cardíaco + SpO2 + acelerómetro + giroscopio', 'GPS: independiente (sin necesitar celular)', 'Batería: 16 días autonomía / 190mAh', 'Modos ejercicio: 150+ (nado, ciclismo, yoga…)', 'Resistencia: 5ATM (hasta 50m bajo el agua)'],
  },
  {
    id: 'pre-d50', companyId: 'c167', companyName: 'Shein Ecuador',
    title: 'Accesorios Tech: fundas + auriculares + cables — hasta 50% OFF',
    description: 'Fundas premium para iPhone 15/Samsung Galaxy S24/Xiaomi 13, auriculares TWS cancelación de ruido, cables USB-C trenzados 240W, cargadores inalámbricos 15W. Desde $2.99. Código SHEIN15: 15% extra en primera compra.',
    discountPercent: 50, originalPrice: null, discountedPrice: null,
    validFrom: addDays(NOW, 0), validUntil: addDays(NOW, 15),
    sourceUrl: 'https://www.shein.com/catalog/search.html?keywords=phone+case+accessories',
    imageUrl: 'https://img.ltwebstatic.com/images3_spmp/2023/12/21/6c/17030060148e0bbf2fe4c7b064b40a5a7ab6a2f5ce.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 90, sector: 'Marketplace',
    specs: ['Fundas: compatibles iPhone 15/14/13, Galaxy S24/S23, Xiaomi 13', 'Auriculares TWS: cancelación activa ruido, Bluetooth 5.3', 'Cables USB-C: trenzados nylon 240W, 1m/2m', 'Cargadores inalámbricos: 15W Qi2, LED indicador', 'Desde: $2.99 con envío gratis a Ecuador', 'Código descuento: SHEIN15 (15% primera compra)'],
  },
  {
    id: 'pre-d51', companyId: 'c168', companyName: 'AliExpress Ecuador',
    title: 'Samsung Galaxy Watch 6 44mm — 38% OFF desde $129',
    description: 'Galaxy Watch 6 44mm con sensor BioActive (ECG, SpO2, presión arterial), seguimiento ciclo de sueño avanzado, 40h batería, GPS, 40+ modos deporte. $129 (antes $209). Vendedor oficial Samsung.',
    discountPercent: 38, originalPrice: 209, discountedPrice: 129,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.aliexpress.com/wholesale?SearchText=samsung+galaxy+watch+6+official',
    imageUrl: 'https://image-us.samsung.com/SamsungUS/home/mobile/galaxy-watch/all-galaxy-watches/07282023/SM-R940NZKAXAA_001_Front_Graphite.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 89, sector: 'Marketplace',
    specs: ['Sensor BioActive: ECG continuo + SpO2 + presión arterial', 'Pantalla: Super AMOLED 1.47" 432×432 px Always On', 'Batería: 40h (modo ahorro) / carga 30 min = 100%', 'Procesador: Exynos W930 Dual Core 1.4GHz', 'GPS: integrado + GLONASS + Beidou', 'Resistencia: 5ATM + IP68 + MIL-STD-810H'],
  },
];

// ── Historial de precios inicial (seed de 45 días) ───────────────────────
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function seedPriceHistory(): PriceHistoryEntry[] {
  const entries: PriceHistoryEntry[] = [];
  let seq = 0;
  const mk = (
    productKey: string, productTitle: string, store: string,
    price: number, currency: 'USD' | 'COP', discountPercent: number | null,
    sourceUrl: string, date: string, sector: string, country: string, imageUrl?: string
  ): PriceHistoryEntry => ({
    id: `ph-${++seq}`,
    productKey, productTitle, store, price, currency,
    discountPercent, sourceUrl, date, sector, country, imageUrl,
  });

  // ── Smart TV 55" Samsung ──────────────────────────────────────────────
  const tvKey = 'smart tv 55 samsung qled';
  const tvImg = 'https://images.samsung.com/is/image/samsung/p6pim/latin/qa55q60dauxpe/gallery/latin-qled-55-q60d-qa55q60dauxpe-541196046?$650_519_PNG$';
  entries.push(
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 599, 'USD', 0, 'https://www.samsung.com/ec/televisions/', daysAgo(45), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 599, 'USD', 0, 'https://www.samsung.com/ec/televisions/', daysAgo(38), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 549, 'USD', 8, 'https://www.samsung.com/ec/televisions/', daysAgo(30), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 499, 'USD', 17, 'https://www.samsung.com/ec/televisions/', daysAgo(20), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 449, 'USD', 25, 'https://www.samsung.com/ec/televisions/', daysAgo(5), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'Comandato Ecuador', 580, 'USD', 3, 'https://www.comandato.com/televisores', daysAgo(45), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'Comandato Ecuador', 550, 'USD', 8, 'https://www.comandato.com/televisores', daysAgo(28), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'Comandato Ecuador', 529, 'USD', 12, 'https://www.comandato.com/televisores', daysAgo(10), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'La Ganga Ecuador', 589, 'USD', 2, 'https://www.laganga.com/televisores', daysAgo(45), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'La Ganga Ecuador', 565, 'USD', 6, 'https://www.laganga.com/televisores', daysAgo(22), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'La Ganga Ecuador', 469, 'USD', 22, 'https://www.laganga.com/televisores', daysAgo(4), 'Electrónica', 'Ecuador'),
  );

  // ── Smart TV TCL 50" ──────────────────────────────────────────────────
  const tclKey = 'smart tv 50 tcl 4k android';
  const tclImg = 'https://www.tcl.com/content/dam/tcl/product-images/televisions/2022/P735/p735_1.png';
  entries.push(
    mk(tclKey, 'TCL Smart TV 50" 4K Android TV P735', 'TCL Ecuador', 499, 'USD', 0, 'https://www.tcl.com/ec/es/televisions/', daysAgo(45), 'Electrónica', 'Ecuador', tclImg),
    mk(tclKey, 'TCL Smart TV 50" 4K Android TV P735', 'TCL Ecuador', 499, 'USD', 0, 'https://www.tcl.com/ec/es/televisions/', daysAgo(35), 'Electrónica', 'Ecuador', tclImg),
    mk(tclKey, 'TCL Smart TV 50" 4K Android TV P735', 'TCL Ecuador', 449, 'USD', 10, 'https://www.tcl.com/ec/es/televisions/', daysAgo(20), 'Electrónica', 'Ecuador', tclImg),
    mk(tclKey, 'TCL Smart TV 50" 4K Android TV P735', 'TCL Ecuador', 359, 'USD', 28, 'https://www.tcl.com/ec/es/televisions/', daysAgo(2), 'Electrónica', 'Ecuador', tclImg),
    mk(tclKey, 'TCL Smart TV 50" 4K', 'Tecnomega Ecuador', 490, 'USD', 2, 'https://www.tecnomega.com.ec/televisores', daysAgo(40), 'Electrónica', 'Ecuador'),
    mk(tclKey, 'TCL Smart TV 50" 4K', 'Tecnomega Ecuador', 460, 'USD', 8, 'https://www.tecnomega.com.ec/televisores', daysAgo(18), 'Electrónica', 'Ecuador'),
    mk(tclKey, 'TCL Smart TV 50" 4K', 'Tecnomega Ecuador', 379, 'USD', 24, 'https://www.tecnomega.com.ec/televisores', daysAgo(3), 'Electrónica', 'Ecuador'),
    mk(tclKey, 'TCL Smart TV 50" 4K', 'MercadoLibre Ecuador', 480, 'USD', 4, 'https://www.mercadolibre.com.ec/televisores', daysAgo(38), 'Electrónica', 'Ecuador'),
    mk(tclKey, 'TCL Smart TV 50" 4K', 'MercadoLibre Ecuador', 399, 'USD', 20, 'https://www.mercadolibre.com.ec/televisores', daysAgo(8), 'Electrónica', 'Ecuador'),
  );

  // ── Xiaomi Redmi Note 13 Pro 5G ───────────────────────────────────────
  const xiaomiKey = 'xiaomi redmi note 13 pro 5g';
  const xiaomiImg = 'https://i01.appmifile.com/webfile/globalimg/products/pc/redmi-note-13-pro-5g/pdp-1-1.jpg';
  entries.push(
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G 256GB', 'Xiaomi Ecuador', 399, 'USD', 0, 'https://www.mi.com/ec/product/redmi-note-13-pro-5g', daysAgo(44), 'Electrónica', 'Ecuador', xiaomiImg),
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G 256GB', 'Xiaomi Ecuador', 399, 'USD', 0, 'https://www.mi.com/ec/product/redmi-note-13-pro-5g', daysAgo(30), 'Electrónica', 'Ecuador', xiaomiImg),
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G 256GB', 'Xiaomi Ecuador', 349, 'USD', 13, 'https://www.mi.com/ec/product/redmi-note-13-pro-5g', daysAgo(15), 'Electrónica', 'Ecuador', xiaomiImg),
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G 256GB', 'Xiaomi Ecuador', 279, 'USD', 30, 'https://www.mi.com/ec/product/redmi-note-13-pro-5g', daysAgo(3), 'Electrónica', 'Ecuador', xiaomiImg),
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G', 'MercadoLibre Ecuador', 380, 'USD', 5, 'https://listado.mercadolibre.com.ec/xiaomi-redmi-note-13-pro', daysAgo(40), 'Electrónica', 'Ecuador'),
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G', 'MercadoLibre Ecuador', 299, 'USD', 25, 'https://listado.mercadolibre.com.ec/xiaomi-redmi-note-13-pro', daysAgo(7), 'Electrónica', 'Ecuador'),
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G', 'Tecnomega Ecuador', 389, 'USD', 3, 'https://www.tecnomega.com.ec/smartphones', daysAgo(35), 'Electrónica', 'Ecuador'),
    mk(xiaomiKey, 'Xiaomi Redmi Note 13 Pro 5G', 'Tecnomega Ecuador', 310, 'USD', 22, 'https://www.tecnomega.com.ec/smartphones', daysAgo(5), 'Electrónica', 'Ecuador'),
  );

  // ── Laptop HP Victus 15 Gaming ────────────────────────────────────────
  const laptopKey = 'laptop hp victus 15 gaming';
  const laptopImg = 'https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08285892.png';
  entries.push(
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5 RTX 2050', 'La Ganga Ecuador', 999, 'USD', 0, 'https://www.laganga.com/laptops', daysAgo(42), 'Electrónica', 'Ecuador', laptopImg),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5 RTX 2050', 'La Ganga Ecuador', 949, 'USD', 5, 'https://www.laganga.com/laptops', daysAgo(25), 'Electrónica', 'Ecuador', laptopImg),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5 RTX 2050', 'La Ganga Ecuador', 799, 'USD', 20, 'https://www.laganga.com/laptops', daysAgo(4), 'Electrónica', 'Ecuador', laptopImg),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5', 'HP Ecuador', 999, 'USD', 0, 'https://www.hp.com/ec-es/laptops/', daysAgo(42), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5', 'HP Ecuador', 899, 'USD', 10, 'https://www.hp.com/ec-es/laptops/', daysAgo(18), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5', 'HP Ecuador', 849, 'USD', 15, 'https://www.hp.com/ec-es/laptops/', daysAgo(3), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'HP Victus 15 Gaming', 'Tecnomega Ecuador', 989, 'USD', 1, 'https://www.tecnomega.com.ec/laptops', daysAgo(38), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'HP Victus 15 Gaming', 'Tecnomega Ecuador', 820, 'USD', 18, 'https://www.tecnomega.com.ec/laptops', daysAgo(6), 'Electrónica', 'Ecuador'),
  );

  // ── Motorola Edge 60 Fusion Colombia ─────────────────────────────────
  const motoKey = 'motorola edge 60 fusion 5g';
  const motoImg = 'https://motorola.com/content/dam/motorola/new-catalog/motorola-edge-60-fusion/motorola-edge-60-fusion-front.png';
  entries.push(
    mk(motoKey, 'Motorola Edge 60 Fusion 5G 256GB', 'Falabella Colombia', 2299900, 'COP', 0, 'https://www.falabella.com.co/falabella-co/search?Ntt=motorola+edge+60', daysAgo(40), 'Retail', 'Colombia', motoImg),
    mk(motoKey, 'Motorola Edge 60 Fusion 5G 256GB', 'Falabella Colombia', 1999900, 'COP', 13, 'https://www.falabella.com.co/falabella-co/search?Ntt=motorola+edge+60', daysAgo(22), 'Retail', 'Colombia', motoImg),
    mk(motoKey, 'Motorola Edge 60 Fusion 5G 256GB', 'Falabella Colombia', 1499900, 'COP', 35, 'https://www.falabella.com.co/falabella-co/search?Ntt=motorola+edge+60', daysAgo(10), 'Retail', 'Colombia', motoImg),
    mk(motoKey, 'Motorola Edge 60 Fusion 5G 256GB', 'Falabella Colombia', 949900, 'COP', 59, 'https://www.falabella.com.co/falabella-co/search?Ntt=motorola+edge+60', daysAgo(3), 'Retail', 'Colombia', motoImg),
    mk(motoKey, 'Motorola Edge 60 Fusion 5G', 'Alkosto Colombia', 2199000, 'COP', 4, 'https://www.alkosto.com/search?text=motorola+edge+60+fusion', daysAgo(38), 'Electrónica', 'Colombia'),
    mk(motoKey, 'Motorola Edge 60 Fusion 5G', 'Alkosto Colombia', 1299000, 'COP', 41, 'https://www.alkosto.com/search?text=motorola+edge+60+fusion', daysAgo(8), 'Electrónica', 'Colombia'),
  );

  // ── Sony WH-1000XM5 Auriculares ───────────────────────────────────────
  const sonyKey = 'sony wh-1000xm5 auriculares';
  const sonyImg = 'https://www.sony.com/image/5d02da5df552836db894cead731a2f83?fmt=pjpeg&wid=660&bgcolor=FFFFFF&bgc=FFFFFF';
  entries.push(
    mk(sonyKey, 'Sony WH-1000XM5 Auriculares Noise Cancelling', 'Sony Ecuador', 399, 'USD', 0, 'https://www.sony.com/es_ec/headphones/', daysAgo(45), 'Electrónica', 'Ecuador', sonyImg),
    mk(sonyKey, 'Sony WH-1000XM5 Auriculares Noise Cancelling', 'Sony Ecuador', 349, 'USD', 13, 'https://www.sony.com/es_ec/headphones/', daysAgo(25), 'Electrónica', 'Ecuador', sonyImg),
    mk(sonyKey, 'Sony WH-1000XM5 Auriculares Noise Cancelling', 'Sony Ecuador', 299, 'USD', 25, 'https://www.sony.com/es_ec/headphones/', daysAgo(0), 'Electrónica', 'Ecuador', sonyImg),
    mk(sonyKey, 'Sony WH-1000XM5', 'MercadoLibre Ecuador', 390, 'USD', 2, 'https://listado.mercadolibre.com.ec/sony-wh-1000xm5', daysAgo(35), 'Electrónica', 'Ecuador'),
    mk(sonyKey, 'Sony WH-1000XM5', 'MercadoLibre Ecuador', 320, 'USD', 20, 'https://listado.mercadolibre.com.ec/sony-wh-1000xm5', daysAgo(5), 'Electrónica', 'Ecuador'),
    mk(sonyKey, 'Sony WH-1000XM5', 'Amazon Ecuador', 349, 'USD', 13, 'https://www.amazon.com/s?k=sony+wh-1000xm5', daysAgo(40), 'Electrónica', 'Internacional'),
    mk(sonyKey, 'Sony WH-1000XM5', 'Amazon Ecuador', 279, 'USD', 30, 'https://www.amazon.com/s?k=sony+wh-1000xm5', daysAgo(2), 'Electrónica', 'Internacional'),
  );

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: {
        groqApiKey: '',
        scanIntervalMinutes: 60,
        maxCompaniesPerScan: 5,
        notificationsEnabled: true,
        provinces: ['Pichincha', 'Guayas', 'Azuay', 'Manabí'],
        autoScanEnabled: false,
        telegramBotToken: '8688586581:AAHQDWMwyzfPnMLY8--PZzzlQbUGayjZpZE',
        telegramChatId: '1999119022',
      },
      updateSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),

      companies: defaultCompanies,
      addCompany: (c) =>
        set((state) => ({
          companies: [
            ...state.companies,
            { ...c, id: `c-${Date.now()}`, lastScan: null, discountsFound: 0, trustScore: 80 },
          ],
        })),
      removeCompany: (id) =>
        set((state) => ({ companies: state.companies.filter((c) => c.id !== id) })),
      updateCompany: (id, data) =>
        set((state) => ({
          companies: state.companies.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),

      discounts: defaultDiscounts as import('./types').Discount[],
      addDiscount: (d) =>
        set((state) => ({
          discounts: [
            { ...d, id: `d-${Date.now()}-${Math.random()}`, detectedAt: new Date().toISOString() },
            ...state.discounts,
          ],
        })),
      clearDiscounts: () => set({ discounts: [] }),

      agents: defaultAgents,
      updateAgentStatus: (id, status) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === id ? { ...a, status, lastRun: status === 'running' ? new Date().toISOString() : a.lastRun } : a
          ),
        })),
      incrementAgentTasks: (id) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === id ? { ...a, tasksCompleted: a.tasksCompleted + 1 } : a
          ),
        })),

      logs: [],
      addLog: (log) =>
        set((state) => ({
          logs: [
            { ...log, id: `log-${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString() },
            ...state.logs.slice(0, 199),
          ],
        })),
      clearLogs: () => set({ logs: [] }),

      exchangeRates: { USD_COP: 3716, lastUpdated: new Date(0).toISOString() },
      updateExchangeRates: (r) => set({ exchangeRates: r }),

      priceHistory: seedPriceHistory(),
      addPriceHistoryEntries: (entries) =>
        set((state) => ({
          priceHistory: [...entries, ...state.priceHistory].slice(0, 2000),
        })),
      clearPriceHistory: () => set({ priceHistory: [] }),

      urlChecks: {},
      updateUrlCheck: (url, result) =>
        set((state) => ({ urlChecks: { ...state.urlChecks, [url]: result } })),

      isScanning: false,
      setIsScanning: (v) => set({ isScanning: v }),
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'ecuador-agents-store-v8',
      partialize: (state) => ({
        settings: state.settings,
        exchangeRates: state.exchangeRates,
        companies: state.companies,
        discounts: state.discounts,
        priceHistory: state.priceHistory,
        urlChecks: state.urlChecks,
      }),
    }
  )
);
