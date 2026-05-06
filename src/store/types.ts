export type AgentStatus = 'idle' | 'running' | 'error' | 'completed';

export interface Company {
  id: string;
  name: string;
  website: string;
  sector: string;
  province: string;
  lastScan: string | null;
  discountsFound: number;
  trustScore: number;
  active: boolean;
}

export interface Discount {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  discountPercent: number | null;
  originalPrice: number | null;
  discountedPrice: number | null;
  currency?: 'USD' | 'COP';
  originalPriceUSD?: number | null;
  discountedPriceUSD?: number | null;
  validFrom: string;
  validUntil: string | null;
  sourceUrl: string;
  detectedAt: string;
  predictedDiscount: boolean;
  confidence: number;
  sector: string;
  imageUrl?: string;
  specs?: string[];
  country?: 'Ecuador' | 'Colombia' | 'Internacional';
  freeShipping?: boolean;
  shippingNote?: string;
}

export interface ExchangeRates {
  USD_COP: number;
  lastUpdated: string;
}

export interface PriceHistoryEntry {
  id: string;
  productKey: string;       // clave normalizada para agrupar (ej: "samsung tv 55")
  productTitle: string;
  store: string;
  price: number;
  currency: 'USD' | 'COP';
  discountPercent: number | null;
  sourceUrl: string;
  imageUrl?: string;
  date: string;             // ISO string del momento de registro
  sector: string;
  country: string;
}

export interface UrlCheckResult {
  url: string;
  status: 'ok' | 'broken' | 'unknown';
  checkedAt: string;
  note?: string;
  alternativeUrl?: string;  // URL de búsqueda usada cuando status === 'broken'
}

export interface AgentLog {
  id: string;
  agentName: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  lastRun: string | null;
  tasksCompleted: number;
  icon: string;
}

export interface AnalyticsSummary {
  totalCompanies: number;
  activeDiscounts: number;
  predictedDiscounts: number;
  avgDiscountPercent: number;
  sectorsMonitored: number;
  lastUpdate: string;
}

export interface AppSettings {
  groqApiKey: string;
  scanIntervalMinutes: number;
  maxCompaniesPerScan: number;
  notificationsEnabled: boolean;
  provinces: string[];
  autoScanEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
}
