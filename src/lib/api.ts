import { apiFetch } from "@/lib/wakeServer";

export type SearchResult = {
  name: string;
  symbol: string;
  path: string;
};

export type CompanySnapshot = {
  current_price?: string | number | null;
  market_cap?: string | number | null;
  pe?: string | number | null;
  roe?: string | number | null;
  roce?: string | number | null;
  book_value?: string | number | null;
  dividend_yield?: string | number | null;
  face_value?: string | number | null;
  week_52_high_low?: string | number | null;
  "52_week_high_low"?: string | number | null;
  [key: string]: string | number | null | undefined;
};

export type FinancialTable = {
  headers: string[];
  rows: { label: string; values: string[] }[];
};

export type CompanyTables = {
  peers?: FinancialTable | null;
  quarters?: FinancialTable | null;
  profitLoss?: FinancialTable | null;
  growth?: { title: string; table: FinancialTable }[];
  balanceSheet?: FinancialTable | null;
  cashFlows?: FinancialTable | null;
  ratios?: FinancialTable | null;
  shareholding?: FinancialTable | null;
  shareholdingExtra?: FinancialTable[];
  insightExtras?: FinancialTable[];
  dividends?: FinancialTable | null;
};

export type ScreenerBundle = {
  snapshot?: CompanySnapshot;
  tables?: CompanyTables;
  insights?: string[];
  url?: string | null;
  error?: string | null;
};

export type ScanxQuote = {
  company?: string | null;
  price?: string | null;
  change?: string | null;
  changePct?: string | null;
  marketCap?: string | null;
  pe?: string | null;
  volume?: string | null;
  dayRange?: string | null;
  week52?: string | null;
};

export type ScanxAnalyst = {
  rating?: string | null;
  buy?: string | null;
  hold?: string | null;
  sell?: string | null;
  blurb?: string | null;
};

export type ScanxNewsItem = {
  title: string;
  summary?: string;
  age?: string;
};

export type ScanxBundle = {
  url?: string | null;
  error?: string | null;
  quote?: ScanxQuote;
  fundamentals?: Record<string, string>;
  analyst?: ScanxAnalyst;
  news?: ScanxNewsItem[];
  peers?: FinancialTable | null;
  tables?: CompanyTables;
  about?: string;
};

export type FinStarPillar = {
  rating?: string | null;
  blurb?: string | null;
};

export type FinologyHorizonRatio = {
  y1?: string | null;
  y3?: string | null;
  y5?: string | null;
};

export type FinologyBundle = {
  url?: string | null;
  error?: string | null;
  company?: string | null;
  essentials?: {
    price?: string | null;
    change?: string | null;
    changePct?: string | null;
    dayHigh?: string | null;
    dayLow?: string | null;
    week52High?: string | null;
    week52Low?: string | null;
    dayRange?: string | null;
    week52?: string | null;
    sector?: string | null;
    "Market Cap"?: string | null;
    "Enterprise Value"?: string | null;
    "P/E"?: string | null;
    "P/B"?: string | null;
    ROE?: string | null;
    ROCE?: string | null;
    "EPS (TTM)"?: string | null;
    DEBT?: string | null;
    CASH?: string | null;
    "Promoter Holding"?: string | null;
    "Div. Yield"?: string | null;
    "Sales Growth"?: string | null;
    "Profit Growth"?: string | null;
    [key: string]: string | null | undefined;
  };
  finStar?: {
    ownership?: FinStarPillar;
    valuation?: FinStarPillar;
    efficiency?: FinStarPillar;
    financials?: FinStarPillar;
  } | null;
  strengths?: string[];
  limitations?: string[];
  ratiosHorizon?: {
    salesGrowth?: FinologyHorizonRatio;
    profitGrowth?: FinologyHorizonRatio;
    roe?: FinologyHorizonRatio;
    roce?: FinologyHorizonRatio;
    debtEquity?: string | null;
    interestCover?: string | null;
    cfoPat?: string | null;
    priceToCashFlow?: string | null;
  };
  peers?: FinancialTable | null;
  shareholding?: FinancialTable | null;
  quarters?: FinancialTable | null;
  profitLoss?: FinancialTable | null;
  balanceSheet?: FinancialTable | null;
  cashFlows?: FinancialTable | null;
  dividends?: FinancialTable | null;
  groupCompanies?: { symbol: string; name: string }[];
};

export type CompanyData = {
  company?: string;
  symbol?: string;
  snapshot?: CompanySnapshot;
  screener?: ScreenerBundle;
  scanx?: ScanxBundle;
  finology?: FinologyBundle;
  sources?: string[];
  fetchedAt?: string;
  error?: string;
};

export type OhlcBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ScoredNewsItem = {
  title: string;
  summary?: string;
  age?: string;
  polarity: number;
  tags: string[];
  url?: string;
};

export type MacroMarkers = {
  india10y?: number | null;
  brent?: number | null;
  usdinr?: number | null;
  niftyChangePct?: number | null;
  asOf?: string | null;
};

export type MacroBundle = {
  sector?: string | null;
  markers: MacroMarkers;
  error?: string | null;
};

export type DecisionPayload = {
  symbol: string;
  company: string;
  price: number | null;
  horizon: "swing" | "long";
  sector: import("@/lib/analysis/sectorModels").SectorModelResult;
  fundamentals: import("@/lib/analysis/fundamentals").FundamentalBreakdown;
  technical: import("@/lib/analysis/technicals").TechnicalResult;
  sentiment: {
    score: number;
    items: ScoredNewsItem[];
    drivers: string[];
    risks: string[];
    redFlags: string[];
  };
  macro: import("@/lib/analysis/macro").MacroResult;
  verdict: import("@/lib/analysis/verdict").VerdictResult;
  suitability: import("@/lib/analysis/suitability").SuitabilityResult;
  process: import("@/lib/analysis/analystProcess").AnalystProcessResult;
  forecast: import("@/lib/analysis/forecast").ForecastResult;
  fetchedAt: string;
};

export async function searchCompanies(
  q: string,
  signal?: AbortSignal
): Promise<{ results: SearchResult[]; error?: string }> {
  const res = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`, {
    signal,
  });
  return res.json();
}

export async function fetchCompany(
  path: string,
  symbol: string
): Promise<{ status: number; data: CompanyData }> {
  const params = new URLSearchParams({ path, symbol });
  const res = await apiFetch(`/api/company?${params}`);
  const data = (await res.json()) as CompanyData;
  return { status: res.status, data };
}

export async function fetchOhlc(
  symbol: string
): Promise<{ bars: OhlcBar[]; error?: string }> {
  const res = await apiFetch(
    `/api/ohlc?symbol=${encodeURIComponent(symbol)}`
  );
  return res.json();
}

export async function fetchNews(
  symbol: string,
  name?: string
): Promise<{ items: ScoredNewsItem[]; error?: string }> {
  const params = new URLSearchParams({ symbol });
  if (name) params.set("name", name);
  const res = await apiFetch(`/api/news?${params}`);
  return res.json();
}

export async function fetchMacro(sector?: string): Promise<MacroBundle> {
  const params = new URLSearchParams();
  if (sector) params.set("sector", sector);
  const res = await apiFetch(`/api/macro?${params}`);
  return res.json();
}

export function displayValue(v: string | number | null | undefined): string {
  return v == null || v === "" ? "—" : String(v);
}

export function cleanLabel(label: string): string {
  return String(label || "")
    .replace(/[\u00a0\u202f\u2007]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[+＋]+\s*$/u, "")
    .trim();
}

export function parseWeekRange(
  raw: string | number | null | undefined
): { low: number; high: number } | null {
  if (raw == null || raw === "") return null;
  const text = String(raw);
  const nums = text
    .replace(/,/g, "")
    .match(/(\d+(?:\.\d+)?)/g)
    ?.map(Number)
    .filter((n) => Number.isFinite(n));
  if (!nums || nums.length < 2) return null;
  const [a, b] = nums;
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

export function parsePrice(
  raw: string | number | null | undefined
): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
