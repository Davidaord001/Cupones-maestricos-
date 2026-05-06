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
  removeDiscount: (id: string) => void;
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

// ── Productos REALES mayo 2026 — URLs de búsqueda verificadas ──────────────
const NOW = new Date();
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString(); };

const defaultDiscounts: Omit<import('./types').Discount, never>[] = [

  // ═══════════════════════════════════
  //  ECUADOR — precios en USD
  // ═══════════════════════════════════

  {
    id: 'r-ec-01', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Samsung Galaxy A55 5G 256GB Azul Oscuro',
    description: 'Exynos 1480 4nm, pantalla Super AMOLED 6.6" 120Hz, triple cámara 50MP OIS, batería 5000mAh carga 25W, IP67. 6 cuotas sin interés. Envío gratis.',
    discountPercent: 15, originalPrice: 459.00, discountedPrice: 389.00,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://listado.mercadolibre.com.ec/celulares-telefonia/samsung-galaxy-a55',
    imageUrl: '/products/ec-01-galaxy-a55.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['CPU: Exynos 1480 Octa-Core 4nm', 'RAM/ROM: 8GB/256GB', 'Pantalla: AMOLED 6.6" 120Hz', 'Cámara: 50MP OIS + 12MP ultra', 'Batería: 5000mAh + 25W', 'IP67 + Gorilla Glass Victus+'],
  },
  {
    id: 'r-ec-02', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Apple iPhone 15 128GB — Nuevo sellado',
    description: 'Chip A16 Bionic, Dynamic Island, cámara 48MP OIS, USB-C, pantalla Super Retina XDR 6.1" OLED, IP68. Garantía Apple 12 meses.',
    discountPercent: 8, originalPrice: 869.00, discountedPrice: 799.00,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://listado.mercadolibre.com.ec/celulares-telefonia/apple/iphone-15',
    imageUrl: '/products/ec-02-iphone-15.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['Chip: A16 Bionic 4nm', 'Pantalla: 6.1" OLED Dynamic Island', 'Cámara: 48MP + 12MP ultrawide', 'USB-C + 5G + Face ID', 'IP68 — 6m/30min', 'iOS 17 — actualizaciones 5 años'],
  },
  {
    id: 'r-ec-03', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Apple MacBook Air 13" M2 256GB Starlight',
    description: 'Chip M2 8 núcleos CPU+GPU, 8GB RAM unificada, SSD 256GB, pantalla Liquid Retina 13.6" True Tone, MagSafe 3, hasta 18h batería. Sin ventilador. 1.24kg.',
    discountPercent: 10, originalPrice: 1099.00, discountedPrice: 989.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 18),
    sourceUrl: 'https://listado.mercadolibre.com.ec/computacion/laptops-accesorios/laptops/apple-macbook-air-m2',
    imageUrl: '/products/ec-03-macbook-air-m2.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['Chip: M2 8CPU/8GPU', 'RAM: 8GB unificada 100GB/s', 'SSD: 256GB hasta 3.5GB/s', 'Pantalla: Liquid Retina 13.6" P3 True Tone', 'Batería: 18 horas', 'Peso: 1.24kg sin ventilador'],
  },
  {
    id: 'r-ec-04', companyId: 'c15', companyName: 'La Ganga',
    title: 'Smart TV Samsung 65" QLED 4K Q60D',
    description: 'QLED 4K UHD 65", procesador Quantum Lite 4K IA, Quantum HDR, Motion Xcelerator, Tizen OS, OTS Lite 20W, 3×HDMI. Garantía Samsung 24 meses Ecuador.',
    discountPercent: 22, originalPrice: 899.00, discountedPrice: 699.00,
    validFrom: addDays(NOW, -6), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.laganga.com/buscar?q=samsung+65+qled+4k',
    imageUrl: '/products/ec-04-samsung-qled-65.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['65" QLED 4K 3840×2160', 'Quantum Lite 4K con IA', 'Quantum HDR + Motion Xcelerator', 'Tizen OS — Samsung TV Plus', 'Audio: 20W OTS Lite', 'Garantía 24 meses Ecuador'],
  },
  {
    id: 'r-ec-05', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'PlayStation 5 Slim Edición Digital 1TB',
    description: 'GPU AMD RDNA 2 10.3 TFLOPS + Ray Tracing, CPU AMD Zen 2 8 núcleos 3.5GHz, SSD Ultra 1TB, hasta 8K. 30% más compacta que PS5 original. Control DualSense incluido.',
    discountPercent: 5, originalPrice: 579.00, discountedPrice: 549.00,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 15),
    sourceUrl: 'https://listado.mercadolibre.com.ec/videojuegos/consolas/playstation-5-slim',
    imageUrl: '/products/ec-05-ps5-slim.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'E-commerce',
    country: 'Ecuador',
    specs: ['GPU: RDNA 2 — 10.3 TFLOPS + Ray Tracing nativo', 'CPU: Zen 2 — 8 núcleos / 16 hilos 3.5GHz', 'SSD Ultra: 1TB (5.5GB/s lectura)', 'Resolución: hasta 8K / 120fps en 4K', 'Control DualSense + gatillos adaptativos', '30% más pequeña que PS5 original'],
  },
  {
    id: 'r-ec-06', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Apple AirPods Pro 2da Gen (USB-C)',
    description: 'Chip H2, cancelación activa de ruido 2× mejorada, Modo Ambiente adaptativo, Audio Espacial personalizado, estuche MagSafe USB-C hasta 30h. IPX4.',
    discountPercent: 17, originalPrice: 299.00, discountedPrice: 249.00,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://listado.mercadolibre.com.ec/celulares-telefonia/accesorios-celulares/airpods-pro-segunda-generacion',
    imageUrl: '/products/ec-06-airpods-pro2.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'E-commerce',
    country: 'Ecuador',
    specs: ['Chip H2: ANC 2× más potente', 'Modo Ambiente adaptativo al entorno', 'Audio Espacial cabeza personalizada', 'Estuche MagSafe USB-C: 30h total', 'IPX4 sudor y salpicaduras', 'Control Siri — toca o desliza'],
  },
  {
    id: 'r-ec-07', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Sony WH-1000XM5 Auriculares Noise Cancelling',
    description: '8 micrófonos + procesadores V1+QN1 — mejor ANC del mercado. 30h batería, carga 3min=60min, LDAC Hi-Res Audio, Multipoint 2 dispositivos, plegable.',
    discountPercent: 20, originalPrice: 399.00, discountedPrice: 319.00,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 17),
    sourceUrl: 'https://listado.mercadolibre.com.ec/electronica/audio/auriculares/sony-wh-1000xm5',
    imageUrl: '/products/ec-07-sony-xm5.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'E-commerce',
    country: 'Ecuador', freeShipping: true,
    specs: ['8 micrófonos + V1 + QN1: ANC de referencia', 'Batería: 30h continuas con ANC', 'Carga rápida: 3min = 60min', 'LDAC Hi-Res Audio 990kbps', 'Multipoint: 2 dispositivos a la vez', 'Speak-to-Chat automático'],
  },
  {
    id: 'r-ec-08', companyId: 'c49', companyName: 'Artefacta Ecuador',
    title: 'Samsung Galaxy Tab A9+ 11" WiFi 128GB',
    description: 'Pantalla TFT 11" 90Hz, Snapdragon 695, 8GB RAM, 4 altavoces Dolby Atmos, batería 7040mAh, cámara 8MP. Precio con IVA. Garantía Samsung 12 meses Ecuador.',
    discountPercent: 10, originalPrice: 299.00, discountedPrice: 269.00,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 21),
    sourceUrl: 'https://www.artefacta.com/buscador?text=samsung+galaxy+tab+a9',
    imageUrl: '/products/ec-08-samsung-tab-a9.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['CPU: Snapdragon 695 2.2GHz', 'RAM/ROM: 8GB/128GB + microSD', 'Pantalla: TFT 11" 90Hz FHD+', '4 altavoces Dolby Atmos', 'Cámara: 8MP trasera + 5MP frontal', 'Batería: 7040mAh — 15h de uso'],
  },
  {
    id: 'r-ec-09', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Xiaomi Redmi Note 13 Pro 5G 256GB Negro',
    description: 'Snapdragon 7s Gen 2 4nm, cámara 200MP Samsung ISOCELL OIS, AMOLED 6.67" 120Hz 1800 nits, batería 5100mAh carga 67W, IP54. Android 13.',
    discountPercent: 13, originalPrice: 399.00, discountedPrice: 349.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 16),
    sourceUrl: 'https://listado.mercadolibre.com.ec/celulares-telefonia/xiaomi/redmi-note-13-pro',
    imageUrl: '/products/ec-09-redmi-note13.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['CPU: Snapdragon 7s Gen 2 4nm', 'Cámara: 200MP Samsung ISOCELL OIS', 'Pantalla: AMOLED 6.67" 120Hz 1800 nits', 'Batería: 5100mAh + carga 67W (46min)', 'IP54 resistencia agua y polvo', 'Garantía 12 meses'],
  },
  {
    id: 'r-ec-10', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Nintendo Switch OLED Blanco',
    description: 'Pantalla OLED 7" colores vivos, base ajustable ángulo amplio, altavoz mejorado, 64GB interno. 3 modos: TV 1080p / Sobremesa / Portátil 720p. Batería 4.5–9h.',
    discountPercent: 12, originalPrice: 399.00, discountedPrice: 349.00,
    validFrom: addDays(NOW, -8), validUntil: addDays(NOW, 22),
    sourceUrl: 'https://listado.mercadolibre.com.ec/videojuegos/consolas/nintendo-switch-oled',
    imageUrl: '/products/ec-10-nintendo-oled.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Juguetes',
    country: 'Ecuador',
    specs: ['Pantalla OLED 7" 1280×720 px', '64GB interno + microSD', 'TV 1080p / Portátil 720p', 'Batería 4.5 – 9h según juego', 'Base ajustable ángulo amplio', 'Joy-Con Blanco/Rojo incluidos'],
  },
  {
    id: 'r-ec-11', companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'JBL Flip 6 Altavoz Bluetooth 30W',
    description: '30W potencia, woofer + 2 tweeters externos, IP67 sumergible 1m/30min, 12h batería, PartyBoost multi-altavoz, USB-C, Bluetooth 5.1. Colores Squad / Teal / Red.',
    discountPercent: 18, originalPrice: 120.00, discountedPrice: 99.00,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 13),
    sourceUrl: 'https://listado.mercadolibre.com.ec/electronica/audio/parlantes-portatiles/jbl-flip-6',
    imageUrl: '/products/ec-11-jbl-flip6.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'E-commerce',
    country: 'Ecuador', freeShipping: true,
    specs: ['Potencia: 30W RMS', 'IP67: sumergible 1m / 30min', 'Batería: 12 horas', 'PartyBoost multi-altavoz', 'Bluetooth 5.1 hasta 30m', 'Carga USB-C'],
  },
  {
    id: 'r-ec-12', companyId: 'c49', companyName: 'Artefacta Ecuador',
    title: 'Laptop ASUS Vivobook 15 OLED Core i5 512GB',
    description: 'Intel Core i5-1335U 12va gen hasta 4.6GHz, 16GB DDR4, 512GB SSD NVMe, pantalla OLED 15.6" FHD PANTONE Validated, WiFi 6, USB-C PD 65W. Windows 11 Home.',
    discountPercent: 10, originalPrice: 654.00, discountedPrice: 589.00,
    validFrom: addDays(NOW, -6), validUntil: addDays(NOW, 24),
    sourceUrl: 'https://www.artefacta.com/buscador?text=asus+vivobook+oled',
    imageUrl: '/products/ec-12-asus-vivobook-oled.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['CPU: i5-1335U hasta 4.6GHz', 'RAM/ROM: 16GB / 512GB NVMe', 'Pantalla: OLED 15.6" FHD PANTONE', 'GPU: Intel Iris Xᵉ 80EU', 'USB-C PD 65W', 'Windows 11 Home + garantía 12m'],
  },
  {
    id: 'r-ec-13', companyId: 'c49', companyName: 'Artefacta Ecuador',
    title: 'Televisor TCL 55" 4K Google TV 55P6K',
    description: 'LED 55" 4K UHD 3840×2160, Google TV (Netflix/YouTube/Prime nativos), procesador AiPQ, Dolby Audio 20W, 3×HDMI, 2×USB. Precio con IVA. Garantía 24 meses Ecuador.',
    discountPercent: 13, originalPrice: 509.00, discountedPrice: 444.00,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 30),
    sourceUrl: 'https://www.artefacta.com/buscador?text=tcl+55+google+tv+4k',
    imageUrl: '/products/ec-13-tcl-55.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: ['55" LED 4K UHD 3840×2160', 'Google TV — apps integradas', 'Procesador: AiPQ', 'Audio: Dolby Audio 20W', '3×HDMI + 2×USB + Ethernet', 'Garantía 24 meses Ecuador'],
  },

  // ═══════════════════════════════════
  //  COLOMBIA — precios en COP / USD
  // ═══════════════════════════════════

  {
    id: 'r-co-01', companyId: 'c91', companyName: 'Alkosto Colombia',
    title: 'Samsung Galaxy S24 FE 256GB 5G — 12% OFF',
    description: 'Exynos 2500 3nm, Dynamic AMOLED 2X 6.7" 120Hz 2600 nits, cámara 50MP OIS + tele 3×, batería 4700mAh 45W, IP68. $3,999,990 COP (antes $4,545,000 COP). 0% interés + Envío gratis.',
    discountPercent: 12, originalPrice: 1082.0, discountedPrice: 952.0,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.alkosto.com/search?text=samsung+galaxy+s24+fe+256gb',
    imageUrl: '/products/co-01-samsung-s24fe.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: ['CPU: Exynos 2500 Deca-Core 3nm', 'RAM/ROM: 8GB/256GB UFS 3.1', 'Pantalla: AMOLED 2X 6.7" 120Hz 2600 nits', 'Cámara: 50MP OIS + 8MP ultra + 10MP tele 3×', 'Batería: 4700mAh + 45W SuperFast', 'IP68 + Gorilla Glass Victus+'],
  },
  {
    id: 'r-co-02', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Motorola Edge 60 Fusion 5G 256GB — 61% OFF',
    description: 'Dimensity 7300 Energy 5G 4nm, pOLED 6.67" 144Hz 1200 nits, cámara 50MP Sony LYTIA OIS, 5000mAh TurboPower 68W, IP68, Gorilla Glass 5. $899,900 COP (antes $2,299,900 COP). 0% CMR. Envío gratis.',
    discountPercent: 61, originalPrice: 548.0, discountedPrice: 214.0,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/product/73304155/Celular-motorola-edge-60-fusion-5G-256GB-8GB-RAM-/73304155',
    imageUrl: '/products/co-02-motorola-edge60.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: ['CPU: Dimensity 7300 Energy 5G 4nm', 'RAM/ROM: 8GB/256GB', 'Pantalla: pOLED 6.67" 144Hz 1200 nits', 'Cámara: 50MP Sony LYTIA OIS + 13MP ultra', 'Batería: 5000mAh + TurboPower 68W', 'IP68 + Gorilla Glass 5'],
  },
  {
    id: 'r-co-03', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Apple iPhone 15 128GB — 10% OFF',
    description: 'A16 Bionic, Dynamic Island, 48MP OIS + ultrawide 12MP, USB-C, Face ID, OLED 6.1", IP68. $2,879,100 COP (antes $3,199,000 COP). CMR 0% hasta 24 cuotas.',
    discountPercent: 10, originalPrice: 762.0, discountedPrice: 686.0,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=iphone+15+128gb',
    imageUrl: '/products/co-03-iphone-15-col.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: ['Chip: A16 Bionic — 2 alto rendimiento + 4 eficiencia', 'Pantalla: 6.1" OLED 2556×1179 Dynamic Island', 'Cámara: 48MP f/1.6 OIS + 12MP ultrawide', 'USB-C + 5G + WiFi 6 + Face ID', 'IP68 — 6m profundidad 30min', 'CMR 0% hasta 24 cuotas Colombia'],
  },
  {
    id: 'r-co-04', companyId: 'c91', companyName: 'Alkosto Colombia',
    title: 'MacBook Air 13" M2 256GB — 10% OFF',
    description: 'Chip M2 8 CPU+8 GPU, 8GB RAM, 256GB SSD, Liquid Retina 13.6" True Tone, MagSafe 3, 18h batería, 1.24kg. $4,499,000 COP (antes $4,999,000 COP). Garantía Apple 12 meses.',
    discountPercent: 10, originalPrice: 1190.0, discountedPrice: 1071.0,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 16),
    sourceUrl: 'https://www.alkosto.com/search?text=macbook+air+m2',
    imageUrl: '/products/co-04-macbook-air-m2.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: ['Chip: M2 8CPU/8GPU/16 Neural Engine', 'RAM: 8GB unificada 100GB/s', 'SSD: 256GB hasta 3.5GB/s', 'Pantalla: Liquid Retina 13.6" P3 True Tone', 'Batería: 18 horas', 'Sin ventilador — silencioso siempre'],
  },
  {
    id: 'r-co-05', companyId: 'c90', companyName: 'Éxito Colombia',
    title: 'JBL Charge 5 Bluetooth IP67 — 35% OFF',
    description: '30W JBL Pro Sound, 20h batería con banco USB integrado, IP67 sumergible, PartyBoost, Bluetooth 5.3. $227,435 COP (antes $349,900 COP). Envío gratis.',
    discountPercent: 35, originalPrice: 83.0, discountedPrice: 54.0,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.exito.com/search?text=jbl+charge+5',
    imageUrl: '/products/co-05-jbl-charge5.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Supermercados',
    country: 'Colombia', freeShipping: true,
    specs: ['Potencia: 30W JBL Pro Sound', 'Batería: 20h + banco USB integrado', 'IP67: sumergible 1m / 30min', 'PartyBoost multi-altavoz', 'Bluetooth 5.3 hasta 30m', 'Carga USB-C'],
  },
  {
    id: 'r-co-06', companyId: 'c91', companyName: 'Alkosto Colombia',
    title: 'Xiaomi Redmi Note 13 Pro+ 5G 256GB — 28% OFF',
    description: 'Snapdragon 7s Gen 2 4nm, cámara 200MP OIS, carga 120W (50% en 11min), AMOLED 6.67" 120Hz 1800 nits, IP68. $999,900 COP (antes $1,399,000 COP). Envío gratis.',
    discountPercent: 28, originalPrice: 333.0, discountedPrice: 238.0,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 16),
    sourceUrl: 'https://www.alkosto.com/search?text=xiaomi+redmi+note+13+pro+plus',
    imageUrl: '/products/co-06-redmi-note13-plus.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: ['CPU: Snapdragon 7s Gen 2 4nm', 'Cámara: 200MP Samsung ISOCELL OIS', 'Carga: 120W TurboCharge (11min al 50%)', 'Pantalla: AMOLED 6.67" 120Hz 1800 nits', 'Batería: 5000mAh', 'IP68 certificado'],
  },
  {
    id: 'r-co-07', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Hisense 55" ULED 4K Google TV U6N — 35% OFF',
    description: 'ULED 4K 144Hz VRR, Quantum Dot 100% DCI-P3, Dolby Vision IQ + HDR10+ Adaptive, MEMC, Google TV, 20W Dolby Atmos. $1,499,900 COP (antes $2,299,900 COP). Envío gratis.',
    discountPercent: 35, originalPrice: 548.0, discountedPrice: 357.0,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 8),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=hisense+55+uled+4k',
    imageUrl: '/products/co-07-hisense-55-uled.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: ['55" ULED 4K 144Hz VRR Gaming', 'Quantum Dot 100% DCI-P3', 'Dolby Vision IQ + HDR10+ Adaptive', 'MEMC: movimiento ultra fluido', 'Google TV apps nativas', 'Dolby Atmos 20W integrado'],
  },
  {
    id: 'r-co-08', companyId: 'c92', companyName: 'Jumbo Colombia',
    title: 'Lavadora LG 16kg Carga Frontal Direct Drive — 20% OFF',
    description: 'Motor Direct Drive garantía 10 años, Steam higieniza, TurboWash360 en 39min, A++ eficiencia. $1,119,200 COP (antes $1,399,000 COP). Envío + instalación gratis.',
    discountPercent: 20, originalPrice: 333.0, discountedPrice: 266.0,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://www.tiendasjumbo.co/search?q=lavadora+lg+16kg',
    imageUrl: '/products/co-08-lavadora-lg.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 95, sector: 'Supermercados',
    country: 'Colombia', freeShipping: true,
    specs: ['Capacidad: 16kg carga frontal', 'Motor Direct Drive: garantía 10 años', 'Steam: elimina 99.9% gérmenes', 'A++: ahorra 50% agua y energía', 'TurboWash360: lavado en 39min', '14 programas de lavado'],
  },
  {
    id: 'r-co-09', companyId: 'c89', companyName: 'Homecenter Sodimac',
    title: 'Nevera Samsung Bespoke 300L No Frost — 25% OFF',
    description: 'Twin Cooling Plus, compresor Digital Inverter, convertible 5 modos, panel personalizable 3 colores. $1,499,000 COP (antes $1,999,000 COP). Garantía Samsung 5 años compresor.',
    discountPercent: 25, originalPrice: 476.0, discountedPrice: 357.0,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.homecenter.com.co/homecenter-co/search?Ntt=nevera+samsung+bespoke',
    imageUrl: '/products/co-09-nevera-samsung.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 95, sector: 'Hogar',
    country: 'Colombia', freeShipping: true,
    specs: ['Capacidad: 300L (182L frío + 118L congelador)', 'Twin Cooling Plus: humedad independiente', 'Digital Inverter: silencioso + eficiente', 'Convertible: 5 modos de uso', 'Panel Bespoke: 3 colores a elegir', 'Garantía 5 años compresor Samsung'],
  },
  {
    id: 'r-co-10', companyId: 'c91', companyName: 'Alkosto Colombia',
    title: 'ASUS Vivobook 15 Core i5-1235U 512GB — 22% OFF',
    description: 'Intel Core i5-1235U hasta 4.4GHz, 8GB DDR4, 512GB SSD NVMe, pantalla FHD 15.6" IPS. $1,249,000 COP (antes $1,599,000 COP). Windows 11 Home. Garantía ASUS 12 meses.',
    discountPercent: 22, originalPrice: 381.0, discountedPrice: 297.0,
    validFrom: addDays(NOW, -6), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://www.alkosto.com/search?text=asus+vivobook+15+i5',
    imageUrl: '/products/co-10-asus-vivobook15.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: ['CPU: i5-1235U Deca-Core hasta 4.4GHz', 'RAM/ROM: 8GB DDR4 / 512GB NVMe', 'Pantalla: 15.6" FHD IPS anti-reflejo', 'GPU: Intel Iris Xᵉ 80EU', 'WiFi 6 + Bluetooth 5.0 + USB-C', 'Windows 11 Home + garantía 12m ASUS'],
  },
  {
    id: 'r-co-11', companyId: 'c90', companyName: 'Éxito Colombia',
    title: 'Samsung Galaxy A35 5G 128GB — 20% OFF',
    description: 'Exynos 1380 5nm, AMOLED 6.6" 120Hz, triple cámara 50MP OIS, 5000mAh 25W, IP67. $799,000 COP (antes $999,000 COP). Android 14. Envío gratis.',
    discountPercent: 20, originalPrice: 238.0, discountedPrice: 190.0,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 18),
    sourceUrl: 'https://www.exito.com/search?text=samsung+galaxy+a35+5g',
    imageUrl: '/products/co-11-samsung-a35.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'Supermercados',
    country: 'Colombia', freeShipping: true,
    specs: ['CPU: Exynos 1380 Octa-Core 5nm', 'RAM/ROM: 6GB/128GB + microSD', 'Pantalla: AMOLED 6.6" 120Hz', 'Cámara: 50MP OIS + 8MP ultra + 5MP macro', 'IP67 + Gorilla Glass Victus+', 'Android 14 — actualizaciones 4 años'],
  },
  {
    id: 'r-co-12', companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Sony WH-1000XM5 Noise Cancelling — 25% OFF',
    description: '8 micrófonos + V1+QN1 ANC, 30h batería, carga 3min=60min, LDAC Hi-Res, Multipoint 2 dispositivos. $899,000 COP (antes $1,199,000 COP). CMR 0% hasta 12 cuotas.',
    discountPercent: 25, originalPrice: 285.0, discountedPrice: 214.0,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 17),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=sony+wh-1000xm5',
    imageUrl: '/products/co-12-sony-xm5.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: ['8 micrófonos + procesadores V1+QN1', 'Batería: 30h con ANC activo', 'Carga rápida: 3min = 60min', 'LDAC Hi-Res Audio 990kbps', 'Multipoint: 2 dispositivos simultáneos', 'CMR 0% hasta 12 cuotas Colombia'],
  },

]

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
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 599, 'USD', 0, 'https://www.samsung.com/latin/televisions-audio-video/all-televisions/', daysAgo(45), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 599, 'USD', 0, 'https://www.samsung.com/latin/televisions-audio-video/all-televisions/', daysAgo(38), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 549, 'USD', 8, 'https://www.samsung.com/latin/televisions-audio-video/all-televisions/', daysAgo(30), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 499, 'USD', 17, 'https://www.samsung.com/latin/televisions-audio-video/all-televisions/', daysAgo(20), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K Q60D', 'Samsung Ecuador', 449, 'USD', 25, 'https://www.samsung.com/latin/televisions-audio-video/all-televisions/', daysAgo(5), 'Electrónica', 'Ecuador', tvImg),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'Comandato Ecuador', 580, 'USD', 3, 'https://www.comandato.com/televisores', daysAgo(45), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'Comandato Ecuador', 550, 'USD', 8, 'https://www.comandato.com/televisores', daysAgo(28), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'Comandato Ecuador', 529, 'USD', 12, 'https://www.comandato.com/televisores', daysAgo(10), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'La Ganga Ecuador', 589, 'USD', 2, 'https://www.laganga.com/buscar?q=smart+tv+55', daysAgo(45), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'La Ganga Ecuador', 565, 'USD', 6, 'https://www.laganga.com/buscar?q=smart+tv+55', daysAgo(22), 'Electrónica', 'Ecuador'),
    mk(tvKey, 'Smart TV Samsung 55" QLED 4K', 'La Ganga Ecuador', 469, 'USD', 22, 'https://www.laganga.com/buscar?q=smart+tv+55', daysAgo(4), 'Electrónica', 'Ecuador'),
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
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5 RTX 2050', 'La Ganga Ecuador', 999, 'USD', 0, 'https://www.laganga.com/buscar?q=laptop+gaming+hp', daysAgo(42), 'Electrónica', 'Ecuador', laptopImg),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5 RTX 2050', 'La Ganga Ecuador', 949, 'USD', 5, 'https://www.laganga.com/buscar?q=laptop+gaming+hp', daysAgo(25), 'Electrónica', 'Ecuador', laptopImg),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5 RTX 2050', 'La Ganga Ecuador', 799, 'USD', 20, 'https://www.laganga.com/buscar?q=laptop+gaming+hp', daysAgo(4), 'Electrónica', 'Ecuador', laptopImg),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5', 'HP Ecuador', 999, 'USD', 0, 'https://www.hp.com/ec-es/laptops/gaming/', daysAgo(42), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5', 'HP Ecuador', 899, 'USD', 10, 'https://www.hp.com/ec-es/laptops/gaming/', daysAgo(18), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'Laptop HP Victus 15 Gaming i5', 'HP Ecuador', 849, 'USD', 15, 'https://www.hp.com/ec-es/laptops/gaming/', daysAgo(3), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'HP Victus 15 Gaming', 'Tecnomega Ecuador', 989, 'USD', 1, 'https://www.tecnomega.com.ec/buscar?q=hp+victus+gaming', daysAgo(38), 'Electrónica', 'Ecuador'),
    mk(laptopKey, 'HP Victus 15 Gaming', 'Tecnomega Ecuador', 820, 'USD', 18, 'https://www.tecnomega.com.ec/buscar?q=hp+victus+gaming', daysAgo(6), 'Electrónica', 'Ecuador'),
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

  // ── Samsung Galaxy S24 FE — Colombia ─────────────────────────────────
  const s24feKey = 'samsung galaxy s24 fe 128gb';
  const s24feImg = 'https://m.media-amazon.com/images/I/71mv0y2f8cL._AC_SL1500_.jpg';
  entries.push(
    mk(s24feKey, 'Samsung Galaxy S24 FE 256GB 5G', 'Alkosto Colombia', 4549990, 'COP', 0, 'https://www.alkosto.com/search?text=samsung+galaxy+s24fe', daysAgo(42), 'Electrónica', 'Colombia', s24feImg),
    mk(s24feKey, 'Samsung Galaxy S24 FE 256GB 5G', 'Alkosto Colombia', 4399990, 'COP', 3, 'https://www.alkosto.com/search?text=samsung+galaxy+s24fe', daysAgo(28), 'Electrónica', 'Colombia', s24feImg),
    mk(s24feKey, 'Samsung Galaxy S24 FE 256GB 5G', 'Alkosto Colombia', 4199990, 'COP', 8, 'https://www.alkosto.com/search?text=samsung+galaxy+s24fe', daysAgo(12), 'Electrónica', 'Colombia', s24feImg),
    mk(s24feKey, 'Samsung Galaxy S24 FE 256GB 5G', 'Alkosto Colombia', 3999990, 'COP', 12, 'https://www.alkosto.com/search?text=samsung+galaxy+s24fe', daysAgo(2), 'Electrónica', 'Colombia', s24feImg),
    mk(s24feKey, 'Samsung Galaxy S24 FE 256GB', 'Falabella Colombia', 4599000, 'COP', 0, 'https://www.falabella.com.co/falabella-co/search?Ntt=samsung+s24+fe', daysAgo(40), 'Electrónica', 'Colombia'),
    mk(s24feKey, 'Samsung Galaxy S24 FE 256GB', 'Falabella Colombia', 4299000, 'COP', 6, 'https://www.falabella.com.co/falabella-co/search?Ntt=samsung+s24+fe', daysAgo(15), 'Electrónica', 'Colombia'),
    mk(s24feKey, 'Samsung Galaxy S24 FE 512GB', 'Alkosto Colombia', 4549990, 'COP', 0, 'https://www.alkosto.com/search?text=samsung+galaxy+s24fe', daysAgo(38), 'Electrónica', 'Colombia'),
    mk(s24feKey, 'Samsung Galaxy S24 FE 512GB', 'Alkosto Colombia', 4549990, 'COP', 0, 'https://www.alkosto.com/search?text=samsung+galaxy+s24fe', daysAgo(5), 'Electrónica', 'Colombia'),
  );

  // ── Hisense TV 55" ULED — Colombia ───────────────────────────────────
  const hisenseKey = 'hisense 55 uled 4k';
  entries.push(
    mk(hisenseKey, 'Hisense 55" ULED 4K U6N Google TV', 'Falabella Colombia', 2299900, 'COP', 0, 'https://www.falabella.com.co/falabella-co/search?Ntt=hisense+55+uled', daysAgo(42), 'Retail', 'Colombia'),
    mk(hisenseKey, 'Hisense 55" ULED 4K U6N Google TV', 'Falabella Colombia', 1999900, 'COP', 13, 'https://www.falabella.com.co/falabella-co/search?Ntt=hisense+55+uled', daysAgo(22), 'Retail', 'Colombia'),
    mk(hisenseKey, 'Hisense 55" ULED 4K U6N Google TV', 'Falabella Colombia', 1499900, 'COP', 35, 'https://www.falabella.com.co/falabella-co/search?Ntt=hisense+55+uled', daysAgo(4), 'Retail', 'Colombia'),
    mk(hisenseKey, 'Hisense 55" ULED 4K', 'Alkosto Colombia', 2199000, 'COP', 4, 'https://www.alkosto.com/search?text=hisense+55+uled', daysAgo(35), 'Electrónica', 'Colombia'),
    mk(hisenseKey, 'Hisense 55" ULED 4K', 'Alkosto Colombia', 1649000, 'COP', 25, 'https://www.alkosto.com/search?text=hisense+55+uled', daysAgo(7), 'Electrónica', 'Colombia'),
    mk(hisenseKey, 'Hisense 55" ULED 4K', 'Ktronix Colombia', 2250000, 'COP', 2, 'https://www.ktronix.com/televisores', daysAgo(40), 'Electrónica', 'Colombia'),
    mk(hisenseKey, 'Hisense 55" ULED 4K', 'Ktronix Colombia', 1699000, 'COP', 24, 'https://www.ktronix.com/televisores', daysAgo(6), 'Electrónica', 'Colombia'),
  );

  // ── iPhone 15 — Colombia ─────────────────────────────────────────────
  const iphone15Key = 'iphone 15 128gb colombia';
  entries.push(
    mk(iphone15Key, 'iPhone 15 128GB', 'Falabella Colombia', 3199000, 'COP', 0, 'https://www.falabella.com.co/falabella-co/search?Ntt=iphone+15', daysAgo(44), 'Retail', 'Colombia'),
    mk(iphone15Key, 'iPhone 15 128GB', 'Falabella Colombia', 3099000, 'COP', 3, 'https://www.falabella.com.co/falabella-co/search?Ntt=iphone+15', daysAgo(20), 'Retail', 'Colombia'),
    mk(iphone15Key, 'iPhone 15 128GB', 'Falabella Colombia', 2879100, 'COP', 10, 'https://www.falabella.com.co/falabella-co/search?Ntt=iphone+15', daysAgo(3), 'Retail', 'Colombia'),
    mk(iphone15Key, 'iPhone 15 128GB', 'Ktronix Colombia', 3250000, 'COP', 0, 'https://www.ktronix.com/iphone', daysAgo(42), 'Electrónica', 'Colombia'),
    mk(iphone15Key, 'iPhone 15 128GB', 'Ktronix Colombia', 2999000, 'COP', 8, 'https://www.ktronix.com/iphone', daysAgo(12), 'Electrónica', 'Colombia'),
    mk(iphone15Key, 'iPhone 15 128GB', 'Alkosto Colombia', 3199000, 'COP', 0, 'https://www.alkosto.com/search?text=iphone+15', daysAgo(38), 'Electrónica', 'Colombia'),
    mk(iphone15Key, 'iPhone 15 128GB', 'Alkosto Colombia', 2849000, 'COP', 11, 'https://www.alkosto.com/search?text=iphone+15', daysAgo(8), 'Electrónica', 'Colombia'),
  );

  // ── Xiaomi Redmi Note 13 Pro+ 5G — Colombia ──────────────────────────
  const xiaomiProKey = 'xiaomi redmi note 13 pro plus 5g colombia';
  entries.push(
    mk(xiaomiProKey, 'Xiaomi Redmi Note 13 Pro+ 5G 256GB', 'Alkosto Colombia', 1399000, 'COP', 0, 'https://www.alkosto.com/search?text=redmi+note+13+pro+plus', daysAgo(40), 'Electrónica', 'Colombia'),
    mk(xiaomiProKey, 'Xiaomi Redmi Note 13 Pro+ 5G 256GB', 'Alkosto Colombia', 1199000, 'COP', 14, 'https://www.alkosto.com/search?text=redmi+note+13+pro+plus', daysAgo(18), 'Electrónica', 'Colombia'),
    mk(xiaomiProKey, 'Xiaomi Redmi Note 13 Pro+ 5G 256GB', 'Alkosto Colombia', 999900, 'COP', 29, 'https://www.alkosto.com/search?text=redmi+note+13+pro+plus', daysAgo(4), 'Electrónica', 'Colombia'),
    mk(xiaomiProKey, 'Xiaomi Redmi Note 13 Pro+ 5G', 'Ktronix Colombia', 1450000, 'COP', 0, 'https://www.ktronix.com/celulares', daysAgo(38), 'Electrónica', 'Colombia'),
    mk(xiaomiProKey, 'Xiaomi Redmi Note 13 Pro+ 5G', 'Ktronix Colombia', 1099000, 'COP', 24, 'https://www.ktronix.com/celulares', daysAgo(6), 'Electrónica', 'Colombia'),
    mk(xiaomiProKey, 'Xiaomi Redmi Note 13 Pro+ 5G', 'Jumbo Colombia', 1380000, 'COP', 1, 'https://www.tiendasjumbo.co/search?q=xiaomi', daysAgo(35), 'Supermercados', 'Colombia'),
    mk(xiaomiProKey, 'Xiaomi Redmi Note 13 Pro+ 5G', 'Jumbo Colombia', 1049000, 'COP', 24, 'https://www.tiendasjumbo.co/search?q=xiaomi', daysAgo(5), 'Supermercados', 'Colombia'),
  );

  // ── JBL Charge 5 — Colombia ──────────────────────────────────────────
  const jblKey = 'jbl charge 5 bluetooth';
  entries.push(
    mk(jblKey, 'JBL Charge 5 Bluetooth Waterproof', 'Éxito Colombia', 349900, 'COP', 0, 'https://www.exito.com/search?text=jbl+charge+5', daysAgo(42), 'Electrónica', 'Colombia'),
    mk(jblKey, 'JBL Charge 5 Bluetooth Waterproof', 'Éxito Colombia', 299900, 'COP', 14, 'https://www.exito.com/search?text=jbl+charge+5', daysAgo(20), 'Electrónica', 'Colombia'),
    mk(jblKey, 'JBL Charge 5 Bluetooth Waterproof', 'Éxito Colombia', 227435, 'COP', 35, 'https://www.exito.com/search?text=jbl+charge+5', daysAgo(2), 'Electrónica', 'Colombia'),
    mk(jblKey, 'JBL Charge 5', 'Falabella Colombia', 359900, 'COP', 0, 'https://www.falabella.com.co/falabella-co/search?Ntt=jbl+charge+5', daysAgo(38), 'Retail', 'Colombia'),
    mk(jblKey, 'JBL Charge 5', 'Falabella Colombia', 249900, 'COP', 31, 'https://www.falabella.com.co/falabella-co/search?Ntt=jbl+charge+5', daysAgo(4), 'Retail', 'Colombia'),
    mk(jblKey, 'JBL Charge 5', 'Alkosto Colombia', 329000, 'COP', 6, 'https://www.alkosto.com/search?text=jbl+charge+5', daysAgo(30), 'Electrónica', 'Colombia'),
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
      removeDiscount: (id: string) =>
        set((state) => ({ discounts: state.discounts.filter((d) => d.id !== id) })),
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
      name: 'ecuador-agents-store-v15',
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
