import type { CompanyData, FinancialTable } from "@/lib/api";
import type { FundamentalBreakdown } from "./fundamentals";
import type { Horizon } from "./levels";
import { clamp, parseNum } from "./parse";
import type { SectorModelResult } from "./sectorModels";
import type { VerdictAction, VerdictResult } from "./verdict";

export type ForecastResult = {
  trailingPe: number | null;
  trailingEps: number | null;
  growthRate: number | null;
  growthSource: string;
  forwardPe: number | null;
  forwardEps: number | null;
  forwardPrice: number | null;
  peerMedianPe: number | null;
  peSource: string;
  probWeightedPrice: number | null;
  deskForecast: number | null;
  upsidePct: number | null;
  fairBand: { low: number; high: number } | null;
  methodNotes: string[];
  consolidation: {
    bullish: string[];
    bearish: string[];
    net: string;
  };
  confidence: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function median(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

function peerPeMedian(peers: FinancialTable | null | undefined): number | null {
  if (!peers?.headers?.length || !peers.rows?.length) return null;
  const idx = peers.headers.findIndex((h, i) => i > 0 && /p\/?e|pe\b/i.test(h));
  if (idx < 0) return null;
  const values = peers.rows
    .map((r) => parseNum(r.values?.[idx - 1]))
    .filter((n): n is number => n != null && n > 0 && n < 500);
  // First peer row is often the company itself on Screener
  const others = values.slice(1);
  return median(others.length ? others : values);
}

function resolveTrailingEps(
  data: CompanyData,
  price: number | null,
  trailingPe: number | null
): number | null {
  const fromFin = parseNum(data.finology?.essentials?.["EPS (TTM)"]);
  if (fromFin != null && fromFin !== 0) return fromFin;
  const fromScanx = parseNum(data.scanx?.fundamentals?.EPS);
  if (fromScanx != null && fromScanx !== 0) return fromScanx;
  if (price != null && trailingPe != null && trailingPe > 0) {
    return price / trailingPe;
  }
  return null;
}

function resolveGrowth(
  data: CompanyData,
  fundamentals: FundamentalBreakdown,
  sector: SectorModelResult
): { rate: number | null; source: string } {
  const rh = data.finology?.ratiosHorizon;
  const y3 = parseNum(rh?.profitGrowth?.y3);
  if (y3 != null) {
    return {
      rate: clamp(y3 / 100, -0.35, 0.35),
      source: "Finology profit growth 3Y",
    };
  }
  const y1 = parseNum(rh?.profitGrowth?.y1);
  if (y1 != null) {
    return {
      rate: clamp(y1 / 100, -0.35, 0.35),
      source: "Finology profit growth 1Y",
    };
  }
  const salesRaw =
    parseNum(rh?.salesGrowth?.y1) ??
    parseNum(data.finology?.essentials?.["Sales Growth"]) ??
    sector.metrics.salesGrowth;
  if (salesRaw != null) {
    const asFrac = Math.abs(salesRaw) > 1 ? salesRaw / 100 : salesRaw;
    const fromSector = salesRaw === sector.metrics.salesGrowth;
    return {
      rate: clamp(asFrac, -0.35, 0.35),
      source: fromSector
        ? "Sector/Screener sales growth"
        : "Finology sales growth 1Y",
    };
  }
  const mapped = clamp((fundamentals.growth - 50) / 100, -0.35, 0.35);
  return {
    rate: mapped,
    source: `Fundamentals growth score (${Math.round(fundamentals.growth)})`,
  };
}

function actionPhrase(action: VerdictAction): string {
  switch (action) {
    case "buy":
      return "Model leans buy";
    case "accumulate":
      return "Model leans accumulate";
    case "wait":
      return "Model leans wait";
    case "hold":
      return "Model leans hold / watch";
    case "reduce":
      return "Model leans reduce";
    case "avoid":
      return "Model leans avoid";
    default:
      return "Model is mixed";
  }
}

export function buildForecast(input: {
  data: CompanyData;
  horizon: Horizon;
  price: number | null;
  sector: SectorModelResult;
  fundamentals: FundamentalBreakdown;
  verdict: VerdictResult;
  processConfidence: number;
}): ForecastResult {
  const { data, horizon, price, sector, fundamentals, verdict } = input;
  const methodNotes: string[] = [];

  const trailingPe = sector.metrics.pe ?? null;
  const trailingEps = resolveTrailingEps(data, price, trailingPe);

  const peers =
    data.screener?.tables?.peers || data.finology?.peers || null;
  const peerMedianPe = peerPeMedian(peers);

  const { rate: growthRate, source: growthSource } = resolveGrowth(
    data,
    fundamentals,
    sector
  );
  methodNotes.push(`Growth: ${growthSource}`);

  let forwardEps: number | null = null;
  if (trailingEps != null && growthRate != null) {
    const gAdj = horizon === "swing" ? growthRate * 0.25 : growthRate;
    forwardEps = trailingEps * (1 + gAdj);
    methodNotes.push(
      horizon === "swing"
        ? "Forward EPS uses ~1/4 of annual growth (swing horizon)"
        : "Forward EPS = trailing × (1 + annual growth)"
    );
  } else if (trailingEps == null) {
    methodNotes.push("Trailing EPS unavailable — forward EPS/price skipped");
  }

  let forwardPe: number | null = null;
  let peSource = "n/a";
  if (peerMedianPe != null && trailingPe != null) {
    forwardPe = 0.6 * peerMedianPe + 0.4 * trailingPe;
    peSource = "blend peer median + trailing";
  } else if (peerMedianPe != null) {
    forwardPe = peerMedianPe;
    peSource = "peer median PE";
  } else if (growthRate != null && growthRate > 0) {
    forwardPe = clamp(growthRate * 100, 8, 45);
    peSource = "PEG-style (growth%)";
  } else if (trailingPe != null) {
    forwardPe = trailingPe * (0.85 + fundamentals.quality / 500);
    peSource = "trailing PE × quality adjust";
  }
  if (forwardPe != null) methodNotes.push(`Forward PE: ${peSource}`);

  const forwardPrice =
    forwardEps != null && forwardPe != null
      ? round2(forwardEps * forwardPe)
      : null;

  const { bear, base, bull } = verdict.scenarios;
  const totalP = bear.probability + base.probability + bull.probability || 1;
  const probWeightedPrice = round2(
    (bear.price * bear.probability +
      base.price * base.probability +
      bull.price * bull.probability) /
      totalP
  );

  let deskForecast: number | null = null;
  if (horizon === "long") {
    if (forwardPrice != null && Number.isFinite(probWeightedPrice)) {
      deskForecast = round2(0.65 * forwardPrice + 0.35 * probWeightedPrice);
      methodNotes.push(
        "Desk forecast: 65% forward PE-model + 35% scenario blend"
      );
    } else {
      deskForecast = forwardPrice ?? probWeightedPrice;
      methodNotes.push(
        forwardPrice != null
          ? "Desk forecast: forward PE-model only"
          : "Desk forecast: scenario blend only (no EPS path)"
      );
    }
  } else if (forwardPrice != null) {
    deskForecast = round2(0.3 * forwardPrice + 0.7 * base.price);
    methodNotes.push("Desk forecast: 30% forward + 70% base (swing) target");
  } else {
    deskForecast = round2(base.price);
    methodNotes.push("Desk forecast: base scenario target (swing)");
  }

  const upsidePct =
    deskForecast != null && price != null && price > 0
      ? ((deskForecast - price) / price) * 100
      : null;

  let fairBand: { low: number; high: number } | null = null;
  if (deskForecast != null && price != null && price > 0) {
    const stopFloor = verdict.levels.stop ?? deskForecast * 0.92;
    const highCeil = verdict.levels.target2 ?? deskForecast * 1.12;
    let low = Math.min(stopFloor, deskForecast * 0.92);
    let high = Math.max(highCeil, deskForecast * 1.12);
    low = Math.max(low, price * 0.5);
    high = Math.min(high, price * 2.5);
    if (low > high) {
      const tmp = low;
      low = high * 0.9;
      high = tmp;
    }
    fairBand = { low: round2(low), high: round2(high) };
  }

  const coverageBits = [
    trailingEps != null,
    trailingPe != null,
    growthRate != null,
    verdict.levels.target1 != null,
    peerMedianPe != null,
  ];
  const coverage =
    coverageBits.filter(Boolean).length / coverageBits.length;
  const confidence = Math.round(
    clamp(coverage * 55 + input.processConfidence * 0.45)
  );

  const bullish = [
    ...verdict.drivers.slice(0, 2),
    growthRate != null
      ? `Growth path ${growthRate >= 0 ? "+" : ""}${(growthRate * 100).toFixed(1)}% (${growthSource})`
      : "",
    forwardPe != null && trailingPe != null && forwardPe < trailingPe
      ? `Justified forward PE ${forwardPe.toFixed(1)} below trailing ${trailingPe.toFixed(1)}`
      : "",
  ]
    .filter(Boolean)
    .slice(0, 3);

  const bearish = [...verdict.risks.slice(0, 2)];
  if (verdict.levels.extendedAboveEntry) {
    bearish.unshift("Spot extended above preferred entry zone");
  }

  const upStr =
    upsidePct != null
      ? `${upsidePct >= 0 ? "+" : ""}${upsidePct.toFixed(1)}% vs spot`
      : "spot comparison unavailable";
  const net = `${actionPhrase(verdict.action)} — desk forecast ${upStr}${
    verdict.levels.extendedAboveEntry ? "; wait for better entry" : ""
  }.`;

  methodNotes.push(
    "Not street consensus — no analyst target-price feed in sources"
  );

  return {
    trailingPe,
    trailingEps: trailingEps != null ? round2(trailingEps) : null,
    growthRate,
    growthSource,
    forwardPe: forwardPe != null ? round2(forwardPe) : null,
    forwardEps: forwardEps != null ? round2(forwardEps) : null,
    forwardPrice,
    peerMedianPe: peerMedianPe != null ? round2(peerMedianPe) : null,
    peSource,
    probWeightedPrice,
    deskForecast,
    upsidePct: upsidePct != null ? round2(upsidePct) : null,
    fairBand,
    methodNotes,
    consolidation: { bullish, bearish: bearish.slice(0, 3), net },
    confidence,
  };
}
