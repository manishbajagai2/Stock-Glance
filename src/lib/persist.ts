import type { CompanyData, DecisionPayload } from "@/lib/api";

export type DeskRunSaveResult = {
  ok: boolean;
  run?: { id: string };
  error?: string;
  skipped?: boolean;
};

function slimDecision(decision: DecisionPayload) {
  return {
    symbol: decision.symbol,
    company: decision.company,
    price: decision.price,
    horizon: decision.horizon,
    fetchedAt: decision.fetchedAt,
    sector: {
      sectorId: decision.sector.sectorId,
      sectorLabel: decision.sector.sectorLabel,
      sectorFit: decision.sector.sectorFit,
      metrics: decision.sector.metrics,
      peerPercentile: decision.sector.peerPercentile,
    },
    fundamentals: {
      score: decision.fundamentals.score,
      growth: decision.fundamentals.growth,
      quality: decision.fundamentals.quality,
      valuation: decision.fundamentals.valuation,
      balanceSheet: decision.fundamentals.balanceSheet,
    },
    technical: {
      score: decision.technical.score,
      regime: decision.technical.regime,
      rsi: decision.technical.rsi,
      available: decision.technical.available,
    },
    sentiment: {
      score: decision.sentiment.score,
      drivers: decision.sentiment.drivers,
      risks: decision.sentiment.risks,
      redFlags: decision.sentiment.redFlags,
    },
    macro: {
      score: decision.macro.score,
      stance: decision.macro.stance,
    },
    suitability: decision.suitability,
    process: {
      processConfidence: decision.process.processConfidence,
      processScore: decision.process.processScore,
      scoredCount: decision.process.scoredCount,
      totalSteps: decision.process.totalSteps,
      coverage: decision.process.coverage,
    },
    forecast: decision.forecast,
    verdict: {
      action: decision.verdict.action,
      label: decision.verdict.label,
      composite: decision.verdict.composite,
      confidence: decision.verdict.confidence,
      drivers: decision.verdict.drivers,
      risks: decision.verdict.risks,
      levels: decision.verdict.levels,
      scenarios: decision.verdict.scenarios,
      provisional: decision.verdict.provisional,
    },
  };
}

export function buildDeskRunPayload(
  decision: DecisionPayload,
  data: CompanyData,
  companyPath: string
) {
  const f = decision.forecast;
  const v = decision.verdict;
  const symbol = decision.symbol.toUpperCase();
  return {
    company: {
      symbol,
      name: decision.company || symbol,
      path: companyPath,
      sector: decision.sector.sectorLabel || decision.sector.sectorId || null,
      industry: data.scanx?.fundamentals?.Industry || null,
    },
    run: {
      symbol,
      horizon: decision.horizon,
      spot_price: decision.price,
      fetched_at: decision.fetchedAt || data.fetchedAt || null,
      sources: data.sources || [],
      action: v.action,
      verdict_label: v.label,
      composite: v.composite,
      verdict_confidence: v.confidence,
      provisional: Boolean(v.provisional),
      desk_forecast: f.deskForecast,
      forward_price: f.forwardPrice,
      forward_pe: f.forwardPe,
      forward_eps: f.forwardEps,
      trailing_pe: f.trailingPe,
      trailing_eps: f.trailingEps,
      growth_rate: f.growthRate,
      growth_source: f.growthSource,
      upside_pct: f.upsidePct,
      fair_low: f.fairBand?.low ?? null,
      fair_high: f.fairBand?.high ?? null,
      forecast_confidence: f.confidence,
      pe_source: f.peSource,
      prob_weighted_price: f.probWeightedPrice,
      fund_score: decision.fundamentals.score,
      tech_score: decision.technical.score,
      sentiment_score: decision.sentiment.score,
      macro_score: decision.macro.score,
      swing_fit: decision.suitability.swing.score,
      long_fit: decision.suitability.longTerm.score,
      process_confidence: decision.process.processConfidence,
      consolidation_net: f.consolidation.net,
      drivers: f.consolidation.bullish,
      risks: f.consolidation.bearish,
      forecast: f,
      verdict: {
        action: v.action,
        label: v.label,
        composite: v.composite,
        confidence: v.confidence,
        drivers: v.drivers,
        risks: v.risks,
        levels: v.levels,
        scenarios: v.scenarios,
        weights: v.weights,
        invalidation: v.invalidation,
        timeStop: v.timeStop,
        provisional: v.provisional,
      },
      decision: slimDecision(decision),
    },
  };
}

export async function saveDeskRun(
  decision: DecisionPayload,
  data: CompanyData,
  companyPath: string
): Promise<DeskRunSaveResult> {
  try {
    const payload = buildDeskRunPayload(decision, data, companyPath);
    const res = await fetch("/api/desk-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: body.error || res.statusText };
    }
    return { ok: true, run: body.run };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}

export async function fetchPersistStatus(): Promise<{
  configured: boolean;
  url: string | null;
}> {
  try {
    const res = await fetch("/api/persist/status");
    return res.json();
  } catch {
    return { configured: false, url: null };
  }
}
