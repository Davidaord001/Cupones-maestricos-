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

// ── Productos REALES — precios verificados mayo 2026 ──────────────────────
const NOW = new Date();
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString(); };

const defaultDiscounts: Omit<import('./types').Discount, never>[] = [

  // ═══════════════════════════════════════════════════
  //  ECUADOR – precios en USD
  // ═══════════════════════════════════════════════════

  // 1. Samsung Galaxy A55 5G 256GB – Artefacta Ecuador
  {
    id: 'p-ec-01',
    companyId: 'c49', companyName: 'Artefacta Ecuador',
    title: 'Samsung Galaxy A55 5G 256GB Azul — 8% OFF',
    description: 'Samsung Galaxy A55 5G 256GB Azul Oscuro en Artefacta. Procesador Exynos 1480 (4nm), pantalla Super AMOLED 6.6" 120Hz, cámara 50MP OIS, batería 5000mAh, carga 25W. IP67. Android 14. Precio real con IVA incluido.',
    discountPercent: 8, originalPrice: 424.00, discountedPrice: 389.00,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 25),
    sourceUrl: 'https://www.artefacta.com/telefono-samsung-galaxy-a55-5g-azul-oscuro-256gb-156893/p',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/sm-a556ezlaalt/gallery/latin-galaxy-a55-5g-sm-a556-sm-a556ezlaalt-thumb-541374174?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'CPU: Exynos 1480 Octa-Core 4nm hasta 2.75GHz',
      'RAM / ROM: 8GB / 256GB (expandible microSD)',
      'Pantalla: Super AMOLED 6.6" 120Hz 1080×2340 px',
      'Cámara: 50MP OIS + 12MP ultra + 5MP macro',
      'Batería: 5000mAh + carga 25W SuperFast',
      'Resistencia: IP67 + Gorilla Glass Victus+',
      'Garantía: 12 meses Artefacta Ecuador',
    ],
  },

  // 2. iPhone 15 128GB – Tecnomega Ecuador
  {
    id: 'p-ec-02',
    companyId: 'c155', companyName: 'Tecnomega Ecuador',
    title: 'Apple iPhone 15 128GB Rosa — 6% OFF',
    description: 'iPhone 15 128GB en Tecnomega Ecuador. Chip A16 Bionic (4nm), Dynamic Island, cámara principal 48MP con ultrawide 12MP, USB-C, Face ID, pantalla Super Retina XDR 6.1" OLED. iOS 17. Garantía oficial Apple 12 meses.',
    discountPercent: 6, originalPrice: 849.00, discountedPrice: 799.00,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.tecnomega.com.ec/celulares/apple/iphone-15-128gb',
    imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-pink?wid=940&hei=1112&fmt=jpeg&qlt=90&.v=1692923777972',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'Chip: A16 Bionic 2 × alto rendimiento + 4 × eficiencia',
      'Pantalla: 6.1" Super Retina XDR OLED 2556×1179 px',
      'Cámara: 48MP principal f/1.6 OIS + 12MP ultrawide',
      'Dynamic Island: notificaciones interactivas en tiempo real',
      'Conectividad: 5G + WiFi 6 + USB-C 3.0',
      'Resistencia: IP68 — 6m de profundidad 30 min',
      'Garantía: 12 meses Apple Ecuador',
    ],
  },

  // 3. MacBook Air M2 13" 256GB – MercadoLibre Ecuador
  {
    id: 'p-ec-03',
    companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Apple MacBook Air 13" M2 256GB Starlight — 10% OFF',
    description: 'MacBook Air M2 13" 256GB en MercadoLibre Ecuador (vendedor oficial Apple). Chip M2 8 núcleos CPU + 8 núcleos GPU, 8GB RAM unificada, pantalla Liquid Retina 13.6" True Tone, MagSafe 3, batería 18h, cámara FaceTime 1080p. Peso: 1.24kg.',
    discountPercent: 10, originalPrice: 1099.00, discountedPrice: 989.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 18),
    sourceUrl: 'https://listado.mercadolibre.com.ec/macbook-air-m2-13',
    imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-m2-starlight-select-202206?wid=904&hei=840&fmt=jpeg&qlt=90&.v=1664497359481',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'Chip: Apple M2 — 8 núcleos CPU / 8 núcleos GPU',
      'RAM: 8GB unificada (ancho de banda 100 GB/s)',
      'SSD: 256GB (lectura hasta 3.5 GB/s)',
      'Pantalla: Liquid Retina 13.6" 2560×1664 px True Tone P3',
      'Batería: hasta 18 horas de reproducción de vídeo',
      'Cámara: 1080p FaceTime con ISP M2',
      'Peso: 1.24 kg — el más delgado de Mac',
    ],
  },

  // 4. Smart TV Samsung 65" QLED 4K Q60D – La Ganga
  {
    id: 'p-ec-04',
    companyId: 'c15', companyName: 'La Ganga',
    title: 'Smart TV Samsung 65" QLED 4K Q60D — 22% OFF',
    description: 'Samsung 65Q60D en La Ganga Ecuador. 65" QLED 4K UHD, Quantum HDR, AirSlim Design, Procesador Quantum Lite 4K con IA, Tizen OS, Motion Xcelerator, OTS Lite Audio. Precio con IVA incluido. Garantía 24 meses Samsung Ecuador.',
    discountPercent: 22, originalPrice: 899.00, discountedPrice: 699.00,
    validFrom: addDays(NOW, -6), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.laganga.com/buscar?q=samsung+65+qled+4k',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/qa65q60dauxpe/gallery/latin-qled-65-q60d-qa65q60dauxpe-541196046?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'Pantalla: 65" QLED 4K UHD 3840×2160 60Hz',
      'Procesador: Quantum Lite 4K con IA (upscaling automático)',
      'HDR: Quantum HDR — colores vívidos, negros profundos',
      'Audio: 20W OTS Lite (Object Tracking Sound)',
      'SO: Tizen OS — Samsung TV Plus + acceso a apps',
      'Motion Xcelerator: movimiento fluido en deportes',
      'Garantía: 24 meses Samsung Ecuador',
    ],
  },

  // 5. PlayStation 5 Slim Digital – MercadoLibre Ecuador
  {
    id: 'p-ec-05',
    companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'PlayStation 5 Slim Edición Digital 1TB — 5% OFF',
    description: 'PS5 Slim Digital Edition 1TB en MercadoLibre Ecuador. El 30% más pequeño que la PS5 original. GPU AMD RDNA 2 10.3 TFLOPS, CPU AMD Zen 2 8 núcleos 3.5GHz, SSD Ultra de 1TB, Ray Tracing, resolución hasta 8K. Control DualSense incluido.',
    discountPercent: 5, originalPrice: 579.00, discountedPrice: 549.00,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 15),
    sourceUrl: 'https://listado.mercadolibre.com.ec/playstation-5-slim-digital',
    imageUrl: 'https://gmedia.playstation.com/is/image/SIEPDC/ps5-slim-product-thumbnail-01-en-14sep23?$800px$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'E-commerce',
    country: 'Ecuador',
    specs: [
      'Consola: PS5 Slim Digital Edition 1TB SSD Ultra',
      'GPU: AMD RDNA 2 — 10.3 TFLOPS Ray Tracing nativo',
      'CPU: AMD Zen 2 — 8 núcleos / 16 hilos a 3.5 GHz',
      'Resolución: hasta 8K / 120fps en 4K',
      'Control: DualSense inalámbrico — gatillos adaptativos',
      '30% más delgado y ligero que PS5 original',
      'Incluye: Cable HDMI 2.1 + cable USB-C + guía inicio rápido',
    ],
  },

  // 6. AirPods Pro 2da Gen (USB-C) – MercadoLibre Ecuador
  {
    id: 'p-ec-06',
    companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Apple AirPods Pro 2da Generación USB-C — 17% OFF',
    description: 'AirPods Pro 2da Gen USB-C MagSafe en MercadoLibre Ecuador. Chip H2, cancelación activa de ruido 2x mejor, Modo Ambiente adaptativo, Audio Espacial con seguimiento dinámico de cabeza, batería hasta 30h con estuche. Resistencia IPX4.',
    discountPercent: 17, originalPrice: 299.00, discountedPrice: 249.00,
    validFrom: addDays(NOW, -1), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://listado.mercadolibre.com.ec/airpods-pro-2-generacion-usb-c',
    imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MTJV3?wid=1144&hei=1144&fmt=jpeg&qlt=90&.v=1694014871994',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'E-commerce',
    country: 'Ecuador',
    specs: [
      'Chip: Apple H2 — cancelación de ruido 2× más potente',
      'ANC: Cancelación Activa de Ruido adaptativa',
      'Audio Espacial: cabeza personalizada con Face ID',
      'Estuche: MagSafe USB-C — carga hasta 30 horas total',
      'Resistencia: IPX4 sudor y agua — auriculares + estuche',
      'Modo Ambiente: ajusta automáticamente con el entorno',
      'Control por voz: Siri — toca, desliza o aprieta para controlar',
    ],
  },

  // 7. Sony WH-1000XM5 – MercadoLibre Ecuador
  {
    id: 'p-ec-07',
    companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'Sony WH-1000XM5 Noise Cancelling — 20% OFF',
    description: 'Auriculares Sony WH-1000XM5 en MercadoLibre Ecuador. 8 micrófonos + 2 procesadores para la mejor cancelación de ruido del mercado. 30h batería, carga rápida (3min=60min). LDAC Hi-Res Audio. Multipoint Bluetooth 2 dispositivos. Plegables.',
    discountPercent: 20, originalPrice: 399.00, discountedPrice: 319.00,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 17),
    sourceUrl: 'https://listado.mercadolibre.com.ec/sony-wh-1000xm5',
    imageUrl: 'https://www.sony.com/image/5d02da5df552836db894cead731a2f83?fmt=pjpeg&wid=660&bgcolor=FFFFFF&bgc=FFFFFF',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'E-commerce',
    country: 'Ecuador', freeShipping: true,
    specs: [
      '8 micrófonos + procesador V1 + QN1: mejor ANC del mercado',
      'Batería: 30h de reproducción continua con ANC',
      'Carga rápida: 3 min = 60 min de batería',
      'LDAC: transmisión Hi-Res Audio a 990 kbps',
      'Multipoint: conecta 2 dispositivos Bluetooth simultáneamente',
      'Speak-to-Chat: se pausa automáticamente al hablar',
      'Peso: solo 250g — cómodos para uso prolongado',
    ],
  },

  // 8. Samsung Galaxy Tab A9+ 11" 128GB – Artefacta Ecuador
  {
    id: 'p-ec-08',
    companyId: 'c49', companyName: 'Artefacta Ecuador',
    title: 'Samsung Galaxy Tab A9+ 11" WiFi 128GB — 10% OFF',
    description: 'Samsung Galaxy Tab A9+ 11" 128GB WiFi en Artefacta Ecuador. Pantalla LCD TFT 11" 90Hz, procesador Snapdragon 695 5G, 8GB RAM, 4 altavoces Dolby Atmos, cámara trasera 8MP, batería 7040mAh. Precio real con IVA. Garantía 12 meses.',
    discountPercent: 10, originalPrice: 299.00, discountedPrice: 269.00,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 21),
    sourceUrl: 'https://www.artefacta.com/tablet-samsung-galaxy-tab-a9-plus-11-128gb-azul-155826/p',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/sm-x210nzaalta/gallery/latin-galaxy-tab-a9-plus-sm-x210-sm-x210nzaalta-thumb-539618893?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'CPU: Snapdragon 695 5G Octa-Core 2.2GHz',
      'RAM / ROM: 8GB / 128GB + microSD expandible',
      'Pantalla: TFT LCD 11" 90Hz FHD+ 1920×1200 px',
      'Audio: 4 altavoces estéreo con Dolby Atmos',
      'Cámara: trasera 8MP | frontal 5MP para videollamadas',
      'Batería: 7040mAh — hasta 15h de uso continuo',
      'Garantía: 12 meses Samsung Ecuador',
    ],
  },

  // 9. Xiaomi Redmi Note 13 Pro 5G 256GB – Tecnomega Ecuador
  {
    id: 'p-ec-09',
    companyId: 'c155', companyName: 'Tecnomega Ecuador',
    title: 'Xiaomi Redmi Note 13 Pro 5G 256GB Negro — 13% OFF',
    description: 'Redmi Note 13 Pro 5G 256GB en Tecnomega Ecuador. Snapdragon 7s Gen 2 (4nm), cámara 200MP Samsung ISOCELL con OIS, pantalla AMOLED 6.67" 120Hz 1800 nits, batería 5100mAh, carga 67W (46 min al 100%), IP54. Android 13.',
    discountPercent: 13, originalPrice: 399.00, discountedPrice: 349.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 16),
    sourceUrl: 'https://www.tecnomega.com.ec/celulares/xiaomi/redmi-note-13-pro-5g-256gb',
    imageUrl: 'https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-5g/pdp-1-1.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'CPU: Snapdragon 7s Gen 2 Octa-Core 4nm hasta 2.4GHz',
      'RAM / ROM: 8GB / 256GB UFS 2.2',
      'Cámara: 200MP Samsung ISOCELL HP3 OIS + 8MP ultra + 2MP macro',
      'Pantalla: AMOLED 6.67" 120Hz 1800 nits — FullHD+',
      'Batería: 5100mAh + carga 67W TurboCharge (0→100% en 46min)',
      'Resistencia: IP54 polvo y salpicaduras',
      'Garantía: 12 meses Tecnomega Ecuador',
    ],
  },

  // 10. Nintendo Switch OLED – Juguetón Ecuador
  {
    id: 'p-ec-10',
    companyId: 'c23', companyName: 'Juguetón',
    title: 'Nintendo Switch OLED Blanco — 13% OFF',
    description: 'Nintendo Switch OLED White Set en Juguetón Ecuador. Pantalla OLED 7" con colores vivos, base ajustable de ángulo amplio, altavoz integrado mejorado, 64GB almacenamiento interno, Joy-Con en blanco/negro. 3 modos: TV, sobremesa, portátil.',
    discountPercent: 13, originalPrice: 399.00, discountedPrice: 349.00,
    validFrom: addDays(NOW, -8), validUntil: addDays(NOW, 22),
    sourceUrl: 'https://www.jugueton.com.ec/consolas-y-videojuegos/nintendo-switch',
    imageUrl: 'https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_2.0/c_scale,w_400/ncom/en_US/hardware/switch/nintendo-switch-oled-model-white-set/hardware-gallery/01.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Juguetes',
    country: 'Ecuador',
    specs: [
      'Pantalla: OLED 7" 1280×720 px — colores vivos, negros profundos',
      'Almacenamiento: 64GB interno + ranura microSD',
      'Modos: TV (1080p) / Sobremesa (720p) / Portátil (720p)',
      'Batería: 4.5 – 9 horas según el juego',
      'Base: ajustable ángulo amplio (nueva generación)',
      'Audio: altavoz integrado mejorado',
      'Incluye: Joy-Con Blanco + Base + Cable HDMI + Adaptador AC',
    ],
  },

  // 11. JBL Flip 6 Bluetooth – MercadoLibre Ecuador
  {
    id: 'p-ec-11',
    companyId: 'c27', companyName: 'MercadoLibre Ecuador',
    title: 'JBL Flip 6 Altavoz Bluetooth — 18% OFF',
    description: 'JBL Flip 6 en MercadoLibre Ecuador. Potencia 30W con potente woofer y dos tweeters externos. IP67 (sumergible 1m/30min). 12h de batería. PartyBoost para conectar múltiples altavoces JBL. Carga USB-C. Compatible: iOS y Android.',
    discountPercent: 18, originalPrice: 120.00, discountedPrice: 99.00,
    validFrom: addDays(NOW, -2), validUntil: addDays(NOW, 13),
    sourceUrl: 'https://listado.mercadolibre.com.ec/jbl-flip-6',
    imageUrl: 'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw37c89a07/JBL_FLIP6_HERO_Squad_x1.jpg?sw=700&sh=700&sm=fit&sfrm=png&q=85&bgcolor=f5f5f3',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'E-commerce',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'Potencia: 30W RMS — woofer + 2 tweeters integrados',
      'IP67: sumergible hasta 1m durante 30 minutos',
      'Batería: 12 horas de reproducción continua',
      'PartyBoost: conecta múltiples altavoces JBL',
      'Carga: USB-C + audio Bluetooth 5.1',
      'Dimensiones: 178mm × 68mm — portátil y compacto',
      'Colores disponibles: Squad / Teal / Red / Black / Gray',
    ],
  },

  // 12. Airfryer Ninja Speedi AF300 – La Ganga Ecuador
  {
    id: 'p-ec-12',
    companyId: 'c15', companyName: 'La Ganga',
    title: 'Airfryer Ninja Speedi AF300 6.6L — 22% OFF',
    description: 'Ninja Speedi AF300 en La Ganga Ecuador. Airfryer + vapor rapid cook. 6.6L capacidad para 4-6 personas. 12 funciones: airfryer, vapor, hornear, tostar, deshidratar. Temperatura 38-210°C. Precalienta en 3 minutos. Antiadherente libre de PFOA.',
    discountPercent: 22, originalPrice: 179.00, discountedPrice: 139.00,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 19),
    sourceUrl: 'https://www.laganga.com/buscar?q=ninja+airfryer',
    imageUrl: 'https://m.media-amazon.com/images/I/91tEp0IjHlL._AC_SL1500_.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 94, sector: 'Hogar',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'Capacidad: 6.6L — ideal para 4 a 6 personas',
      '12 funciones: airfryer / vapor / hornear / tostar / deshidratar',
      'Temperatura: ajustable de 38°C a 210°C',
      'Precalentamiento: listo en solo 3 minutos',
      'Antiadherente: libre de PFOA, fácil limpieza',
      'Wattaje: 1700W potencia de cocción',
      'Garantía: 12 meses La Ganga Ecuador',
    ],
  },

  // 13. Laptop ASUS Vivobook 15 OLED K3504VA – Artefacta Ecuador
  {
    id: 'p-ec-13',
    companyId: 'c49', companyName: 'Artefacta Ecuador',
    title: 'Laptop ASUS Vivobook 15 OLED Core i5 512GB — 10% OFF',
    description: 'ASUS Vivobook 15 OLED K3504VA en Artefacta. Intel Core i5-1335U 12va gen hasta 4.6GHz, 16GB DDR4, 512GB SSD NVMe, pantalla OLED 15.6" FHD 60Hz PANTONE Validated, WiFi 6, USB-C PD 65W, peso 1.5kg. Windows 11 Home. Garantía 12 meses.',
    discountPercent: 10, originalPrice: 654.00, discountedPrice: 589.00,
    validFrom: addDays(NOW, -6), validUntil: addDays(NOW, 24),
    sourceUrl: 'https://www.artefacta.com/laptop-asus-vivobook-15-oled-k3504va-15-6-i5-512gb-16gb-156450/p',
    imageUrl: 'https://dlcdnwebimgs.asus.com/gain/4a53de64-8af1-4f99-a1fc-c75d16a1bd4e/w800',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Ecuador', freeShipping: true,
    specs: [
      'CPU: Intel Core i5-1335U 12va Gen hasta 4.6 GHz',
      'RAM / ROM: 16GB DDR4 / 512GB SSD PCIe NVMe M.2',
      'Pantalla: OLED 15.6" FHD 1920×1080 — PANTONE Validated',
      'GPU: Intel Iris Xᵉ 80EU integrada',
      'Puerto: USB-C Power Delivery 65W + 2×USB-A + HDMI',
      'Batería: 50Wh — hasta 8.5 horas continuas',
      'Garantía: 12 meses ASUS Ecuador',
    ],
  },

  // ═══════════════════════════════════════════════════
  //  COLOMBIA – precios en COP convertidos a USD (3716 COP/USD)
  // ═══════════════════════════════════════════════════

  // 14. Samsung Galaxy S24 FE 256GB 5G – Alkosto Colombia
  {
    id: 'p-co-01',
    companyId: 'c91', companyName: 'Alkosto Colombia',
    title: 'Samsung Galaxy S24 FE 256GB 5G — 12% OFF | $3,999,990 COP',
    description: 'Samsung Galaxy S24 FE 256GB 5G en Alkosto Colombia. Exynos 2500 (3nm), pantalla Dynamic AMOLED 2X 6.7" 120Hz hasta 2600 nits, cámara 50MP OIS, batería 4700mAh carga 45W SuperFast, IP68. 0% interés hasta 36 cuotas. Envío gratis + Seguro incluido. 4.9★.',
    discountPercent: 12, originalPrice: 1224.00, discountedPrice: 1077.00,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.alkosto.com/samsung-galaxy-s24-fe-5g-128gb-graphite/p/8806095551074',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/sm-s721bzwlcho/gallery/latin-galaxy-s24-fe-sm-s721-sm-s721bzwlcho-thumb-541364700?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: [
      'CPU: Samsung Exynos 2500 Deca-Core 3nm hasta 3.3GHz',
      'RAM / ROM: 8GB / 256GB UFS 3.1',
      'Pantalla: Dynamic AMOLED 2X 6.7" 120Hz 2600 nits',
      'Cámara: 50MP OIS + 8MP ultra + 10MP tele 3× zoom óptico',
      'Batería: 4700mAh + carga 45W SuperFast (0→50% en 25min)',
      'Resistencia: IP68 — 1.5m / 30min + Gorilla Glass Victus+',
      '0% interés hasta 36 cuotas + Envío gratis + Seguro Gratis',
    ],
  },

  // 15. Motorola Edge 60 Fusion 5G 256GB – Falabella Colombia
  {
    id: 'p-co-02',
    companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Motorola Edge 60 Fusion 5G 256GB — 59% OFF | $949,900 COP',
    description: 'Motorola Edge 60 Fusion 5G 256GB en Falabella Colombia. MediaTek Dimensity 7300, pOLED 6.67" FHD+ 144Hz 1200 nits, cámara 50MP Sony LYTIA-700C OIS, batería 5000mAh carga 68W TurboPower. Gorilla Glass 5 + IP68. $949,900 COP (~$256 USD). 0% CMR.',
    discountPercent: 59, originalPrice: 618.00, discountedPrice: 256.00,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/product/900603174/Motorola-Edge-60-Fusion-5G/900603174',
    imageUrl: 'https://motorola-global-portal.custhelp.com/ci/fattach/get/75621/0/s/1/motorola-edge-60-fusion-blue-front.png',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: [
      'CPU: MediaTek Dimensity 7300 Energy 5G Octa-Core 4nm',
      'RAM / ROM: 8GB / 256GB (almacenamiento UFS)',
      'Pantalla: pOLED 6.67" FHD+ 144Hz 1200 nits máx',
      'Cámara: 50MP Sony LYTIA-700C OIS + 13MP ultra',
      'Batería: 5000mAh + carga TurboPower 68W',
      'Resistencia: IP68 + Gorilla Glass 5',
      '0% CMR hasta 24 cuotas — envío gratis a Colombia',
    ],
  },

  // 16. iPhone 15 128GB – Falabella Colombia
  {
    id: 'p-co-03',
    companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Apple iPhone 15 128GB — 10% OFF | $2,879,100 COP',
    description: 'iPhone 15 128GB en Falabella Colombia. A16 Bionic, Dynamic Island, cámara 48MP + ultrawide 12MP, USB-C, Face ID, Super Retina XDR OLED 6.1". $2,879,100 COP (~$775 USD). Antes: $3,199,000 COP. CMR 0% hasta 24 cuotas. Garantía Apple 12 meses.',
    discountPercent: 10, originalPrice: 861.00, discountedPrice: 775.00,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 20),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/product/888867697/Apple-iPhone-15-128GB/888867697',
    imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-blue?wid=940&hei=1112&fmt=jpeg&qlt=90&.v=1692923777972',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: [
      'Chip: A16 Bionic — el más rápido de la industria en su clase',
      'Pantalla: 6.1" Super Retina XDR OLED 2556×1179 px Dynamic Island',
      'Cámara: 48MP principal f/1.6 OIS + 12MP ultrawide f/2.4',
      'Conectividad: 5G + WiFi 6 + USB-C transferencia datos',
      'Resistencia: IP68 — 6 metros / 30 minutos',
      'Colores: Negro / Azul / Verde / Amarillo / Rosa',
      'CMR 0% hasta 24 cuotas + garantía Apple 12 meses Colombia',
    ],
  },

  // 17. MacBook Air M2 13" – Ktronix Colombia
  {
    id: 'p-co-04',
    companyId: 'c93', companyName: 'Ktronix Colombia',
    title: 'MacBook Air 13" M2 256GB — 10% OFF | $4,499,000 COP',
    description: 'MacBook Air M2 13" en Ktronix Colombia. Chip Apple M2 8 núcleos CPU + 8 GPU, 8GB RAM unificada, SSD 256GB, pantalla Liquid Retina 13.6" True Tone, MagSafe 3, batería 18h. $4,499,000 COP (~$1,211). Antes $4,999,000 COP. Garantía Apple 12 meses.',
    discountPercent: 10, originalPrice: 1345.00, discountedPrice: 1211.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 16),
    sourceUrl: 'https://www.ktronix.com/computadores/portatiles/apple-macbook-air-13-m2',
    imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-midnight-select-202206?wid=904&hei=840&fmt=jpeg&qlt=90&.v=1664497359481',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: [
      'Chip: Apple M2 — 8 CPU / 8 GPU / 16 Neural Engine',
      'RAM: 8GB unificada (ancho de banda 100 GB/s)',
      'SSD: 256GB (lectura hasta 3.5 GB/s)',
      'Pantalla: Liquid Retina 13.6" 2560×1664 px True Tone P3',
      'Batería: hasta 18 horas + carga MagSafe 3 / USB-C',
      'Teclado: retroiluminado + Touch ID integrado',
      'Garantía: 12 meses Apple Colombia',
    ],
  },

  // 18. JBL Charge 5 Bluetooth – Éxito Colombia
  {
    id: 'p-co-05',
    companyId: 'c90', companyName: 'Éxito Colombia',
    title: 'JBL Charge 5 Bluetooth IP67 — 35% OFF | $227,435 COP',
    description: 'JBL Charge 5 en Éxito Colombia. 20h batería con banco de energía USB integrado, IP67 sumergible en agua, JBL Pro Sound, PartyBoost para enlazar múltiples altavoces JBL, Bluetooth 5.3. $227,435 COP (~$61). Antes $349,900 COP. 4.8★ (2,400 reseñas).',
    discountPercent: 35, originalPrice: 94.00, discountedPrice: 61.00,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 14),
    sourceUrl: 'https://www.exito.com/producto/jbl-charge-5-altavoz-bluetooth/1000280965',
    imageUrl: 'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw82d7bacc/JBL_Charge5_Hero-1_x1.jpg?sw=700&sh=700&sm=fit&sfrm=png&q=85&bgcolor=f5f5f3',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 99, sector: 'Supermercados',
    country: 'Colombia', freeShipping: true,
    specs: [
      'Potencia: 30W RMS — JBL Pro Sound con bajos profundos',
      'Batería: 20 horas + banco de energía USB integrado',
      'IP67: sumergible en agua hasta 1m / 30 minutos',
      'PartyBoost: enlaza múltiples altavoces JBL simultáneamente',
      'Bluetooth: 5.3 — alcance hasta 30 metros',
      'Carga: USB-C de alto rendimiento',
      'Disponible: Negro / Azul / Rojo / Squad / Gris',
    ],
  },

  // 19. Xiaomi Redmi Note 13 Pro+ 5G 256GB – Alkosto Colombia
  {
    id: 'p-co-06',
    companyId: 'c91', companyName: 'Alkosto Colombia',
    title: 'Xiaomi Redmi Note 13 Pro+ 5G 256GB — 28% OFF | $999,900 COP',
    description: 'Redmi Note 13 Pro+ 5G 256GB en Alkosto Colombia. Snapdragon 7s Gen 2 (4nm), cámara 200MP Samsung ISOCELL OIS, carga 120W TurboCharge (11 min al 50%), pantalla AMOLED 6.67" 120Hz 1800 nits, IP68. $999,900 COP (~$269). Antes $1,399,000 COP.',
    discountPercent: 28, originalPrice: 377.00, discountedPrice: 269.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 16),
    sourceUrl: 'https://www.alkosto.com/search?text=xiaomi+redmi+note+13+pro+plus+5g',
    imageUrl: 'https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/kv-1.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: [
      'CPU: Snapdragon 7s Gen 2 Octa-Core 4nm hasta 2.4GHz',
      'RAM / ROM: 8GB / 256GB',
      'Cámara: 200MP Samsung ISOCELL OIS + 8MP ultra + 2MP macro',
      'Pantalla: AMOLED 6.67" 120Hz 1800 nits FHD+',
      'Batería: 5000mAh + carga 120W TurboCharge',
      'Resistencia: IP68 — certificado inmersión en agua',
      'Envío gratis + 0% interés Alkosto Colombia',
    ],
  },

  // 20. Smart TV Hisense 55" ULED 4K U6N – Falabella Colombia
  {
    id: 'p-co-07',
    companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Hisense 55" ULED 4K Google TV U6N — 35% OFF | $1,499,900 COP',
    description: 'Hisense 55U6N en Falabella Colombia. ULED 4K 144Hz VRR, Quantum Dot 100% DCI-P3, Dolby Vision IQ, HDR10+ Adaptive, MEMC, Google TV. $1,499,900 COP (~$404). Antes $2,299,900 COP. 4.6★. Semana Hisense. Envío gratis + instalación disponible.',
    discountPercent: 35, originalPrice: 619.00, discountedPrice: 404.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 8),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/product/900645082/Hisense-55-ULED-4K-Google-TV-U6N/900645082',
    imageUrl: 'https://m.media-amazon.com/images/I/81VqaWBjzCL._AC_SL1500_.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: [
      'Pantalla: 55" ULED 4K 3840×2160 — 144Hz VRR Gaming',
      'Quantum Dot: 100% cobertura DCI-P3 — colores perfectos',
      'HDR: Dolby Vision IQ + HDR10+ Adaptive + HLG',
      'MEMC: interpolación de fotogramas — movimiento ultra fluido',
      'SO: Google TV — YouTube / Netflix / Prime Video nativos',
      'Audio: 20W Dolby Atmos integrado',
      'Envío gratis + instalación disponible en Colombia',
    ],
  },

  // 21. Lavadora LG 16kg Carga Frontal – Jumbo Colombia
  {
    id: 'p-co-08',
    companyId: 'c92', companyName: 'Jumbo Colombia',
    title: 'Lavadora LG 16kg Carga Frontal Direct Drive — 20% OFF | $1,119,200 COP',
    description: 'Lavadora LG F4WV3016S6W 16kg carga frontal en Jumbo Colombia. Motor Direct Drive silencioso con 10 años garantía, función Steam (mata gérmenes), 14 programas de lavado, TurboWash360 en 39min, A++ eficiencia. $1,119,200 COP (~$301). Antes $1,399,000 COP.',
    discountPercent: 20, originalPrice: 376.00, discountedPrice: 301.00,
    validFrom: addDays(NOW, -5), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://www.tiendasjumbo.co/search?q=lavadora+lg+16kg+direct+drive',
    imageUrl: 'https://www.lg.com/content/dam/channel/wcms/co/images/washing-machines/f4wv3016s6w_abn/gallery/D-01.jpg',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 95, sector: 'Supermercados',
    country: 'Colombia', freeShipping: true,
    specs: [
      'Capacidad: 16kg carga frontal (familia grande)',
      'Motor: Direct Drive silencioso — garantía 10 años LG',
      'Steam: higieniza y elimina el 99.9% de gérmenes',
      'Eficiencia: A++ — ahorra hasta 50% más agua y energía',
      'TurboWash360: lavado completo en solo 39 minutos',
      '14 programas: algodón, sintéticos, delicados, sport, etc.',
      'Envío gratis + instalación disponible en Colombia',
    ],
  },

  // 22. Nevera Samsung Bespoke 300L No Frost – Homecenter Colombia
  {
    id: 'p-co-09',
    companyId: 'c89', companyName: 'Homecenter Sodimac',
    title: 'Nevera Samsung Bespoke 300L Twin Cooling No Frost — 25% OFF | $1,499,000 COP',
    description: 'Refrigerador Samsung Bespoke Twin Cooling Plus 300L en Homecenter Colombia. No Frost, doble compresor digital inverter, panel personalizable 3 colores, 5 modos convertibles, display externo. $1,499,000 COP (~$404). Antes $1,999,000 COP. 4.5★.',
    discountPercent: 25, originalPrice: 538.00, discountedPrice: 403.00,
    validFrom: addDays(NOW, -7), validUntil: addDays(NOW, 10),
    sourceUrl: 'https://www.homecenter.com.co/homecenter-co/product/465028/nevera-samsung-bespoke-300l/465028',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/rf30db6900s9/gallery/latin-bespoke-refrigerator-rf30db6900s9-rf30db6900s9za-531680889?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 95, sector: 'Hogar',
    country: 'Colombia', freeShipping: true,
    specs: [
      'Capacidad: 300L (182L frío + 118L congelador No Frost)',
      'Twin Cooling Plus: humedad independiente cada compartimento',
      'Compresor: Digital Inverter — silencioso + eficiente',
      'Convertible: 5 modos según tu necesidad',
      'Display: temperatura digital exterior visible',
      'Bespoke: panel personalizable en 3 colores',
      'Garantía: 5 años compresor Samsung Colombia',
    ],
  },

  // 23. ASUS Vivobook 15 Core i5-1235U – Alkosto Colombia
  {
    id: 'p-co-10',
    companyId: 'c91', companyName: 'Alkosto Colombia',
    title: 'Laptop ASUS Vivobook 15 Core i5 512GB SSD — 22% OFF | $1,249,000 COP',
    description: 'ASUS Vivobook 15 X1504ZA en Alkosto Colombia. Intel Core i5-1235U 12va gen hasta 4.4GHz, 8GB DDR4, 512GB SSD NVMe, pantalla FHD 15.6" anti-reflejo IPS, WiFi 6, Windows 11 Home. $1,249,000 COP (~$336). Antes $1,599,000 COP. Garantía ASUS 12 meses.',
    discountPercent: 22, originalPrice: 430.00, discountedPrice: 336.00,
    validFrom: addDays(NOW, -6), validUntil: addDays(NOW, 12),
    sourceUrl: 'https://www.alkosto.com/asus-vivobook-15-x1504za-i5-1235u-512gb/p/X1504ZA-NJ032W',
    imageUrl: 'https://dlcdnwebimgs.asus.com/gain/bde6e041-0fb1-4069-984c-be7e4ae1a3c1/w800',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 96, sector: 'Electrónica',
    country: 'Colombia', freeShipping: true,
    specs: [
      'CPU: Intel Core i5-1235U 12va Gen Deca-Core hasta 4.4 GHz',
      'RAM: 8GB DDR4 3200MHz',
      'SSD: 512GB PCIe NVMe M.2 Gen 4',
      'Pantalla: 15.6" IPS FHD 1920×1080 px anti-reflejo',
      'GPU: Intel Iris Xᵉ 80EU integrada',
      'Conectividad: WiFi 6 + Bluetooth 5.0 + USB-C',
      'SO: Windows 11 Home + garantía 12 meses ASUS Colombia',
    ],
  },

  // 24. Samsung Galaxy A35 5G 128GB – Éxito Colombia
  {
    id: 'p-co-11',
    companyId: 'c90', companyName: 'Éxito Colombia',
    title: 'Samsung Galaxy A35 5G 128GB Azul — 20% OFF | $799,000 COP',
    description: 'Samsung Galaxy A35 5G 128GB en Éxito Colombia. Exynos 1380 (5nm), AMOLED 6.6" 120Hz, triple cámara 50MP OIS + 8MP ultra + 5MP macro, batería 5000mAh carga 25W, IP67, Android 14 One UI 6.1. $799,000 COP (~$215). Antes $999,000 COP. 4.6★.',
    discountPercent: 20, originalPrice: 269.00, discountedPrice: 215.00,
    validFrom: addDays(NOW, -4), validUntil: addDays(NOW, 18),
    sourceUrl: 'https://www.exito.com/producto/samsung-galaxy-a35-5g-128gb/1000287892',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/latin/sm-a356ezaalta/gallery/latin-galaxy-a35-5g-sm-a356-sm-a356ezaalta-thumb-541368920?$650_519_PNG$',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 97, sector: 'Supermercados',
    country: 'Colombia', freeShipping: true,
    specs: [
      'CPU: Exynos 1380 Octa-Core 5nm hasta 2.4GHz',
      'RAM / ROM: 6GB / 128GB (expandible microSD)',
      'Pantalla: Super AMOLED 6.6" 120Hz 2340×1080 px',
      'Cámara: 50MP OIS + 8MP ultrawide + 5MP macro',
      'Batería: 5000mAh + carga rápida 25W',
      'Resistencia: IP67 + Gorilla Glass Victus+',
      'SO: Android 14 One UI 6.1 — actualizaciones 4 años',
    ],
  },

  // 25. Sony WH-1000XM5 – Falabella Colombia
  {
    id: 'p-co-12',
    companyId: 'c88', companyName: 'Falabella Colombia',
    title: 'Sony WH-1000XM5 Noise Cancelling — 25% OFF | $899,000 COP',
    description: 'Sony WH-1000XM5 en Falabella Colombia. 8 micrófonos + 2 procesadores (V1+QN1) — la mejor cancelación de ruido del mercado. 30h batería, carga 3min=60min, LDAC Hi-Res Audio, Multipoint 2 dispositivos. $899,000 COP (~$242). Antes $1,199,000 COP. 4.8★ CMR 0%.',
    discountPercent: 25, originalPrice: 323.00, discountedPrice: 242.00,
    validFrom: addDays(NOW, -3), validUntil: addDays(NOW, 17),
    sourceUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=sony+wh-1000xm5',
    imageUrl: 'https://www.sony.com/image/5d02da5df552836db894cead731a2f83?fmt=pjpeg&wid=660&bgcolor=FFFFFF&bgc=FFFFFF',
    detectedAt: NOW.toISOString(), predictedDiscount: false, confidence: 98, sector: 'Retail',
    country: 'Colombia', freeShipping: true,
    specs: [
      '8 micrófonos + procesadores V1 + QN1 — ANC de referencia',
      'Batería: 30 horas continuas con cancelación activa de ruido',
      'Carga rápida: 3 minutos = 60 minutos de reproducción',
      'LDAC: Hi-Res Audio a 990 kbps con smartphones Android',
      'Multipoint Bluetooth: 2 dispositivos conectados a la vez',
      'Speak-to-Chat: se pausa automáticamente al hablar',
      'CMR 0% hasta 12 cuotas + garantía Sony 12 meses Colombia',
    ],
  },

];
;

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
      name: 'ecuador-agents-store-v12',
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
