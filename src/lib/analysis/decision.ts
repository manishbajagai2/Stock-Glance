import type {
  CompanyData,
  DecisionPayload,
  MacroMarkers,
  OhlcBar,
  ScoredNewsItem,
} from "@/lib/api";
import { parsePrice } from "@/lib/api";
import { runAnalystProcess } from "./analystProcess";
import { buildForecast } from "./forecast";
import { scoreFundamentals } from "./fundamentals";
import { computeLevels, type Horizon } from "./levels";
import { scoreMacro } from "./macro";
import { advisePosition, type PositionInput } from "./position";
import { runSectorModel } from "./sectorModels";
import { scoreSentiment } from "./sentiment";
import { buildSuitability } from "./suitability";
import {
  scoreTechnicals,
  scoreTechnicalsHeuristic,
} from "./technicals";
import { mixVerdict } from "./verdict";

export type { Horizon } from "./levels";

export function buildDecision(input: {
  data: CompanyData;
  horizon: Horizon;
  ohlc?: OhlcBar[] | null;
  news?: ScoredNewsItem[] | null;
  macroMarkers?: MacroMarkers | null;
  /** True once macro fetch settled (even if empty). */
  macroLoaded?: boolean;
  /** True once news fetch settled (even if empty). */
  newsLoaded?: boolean;
}): DecisionPayload {
  const { data, horizon } = input;
  const sector = runSectorModel(data);
  const fundamentals = scoreFundamentals(data, sector);

  const price =
    parsePrice(data.screener?.snapshot?.current_price) ??
    parsePrice(data.snapshot?.current_price) ??
    parsePrice(data.finology?.essentials?.price) ??
    parsePrice(data.scanx?.quote?.price);

  const week52 =
    data.screener?.snapshot?.week_52_high_low ??
    data.screener?.snapshot?.["52_week_high_low"] ??
    data.finology?.essentials?.week52 ??
    data.scanx?.quote?.week52;
  const dayRange =
    data.scanx?.quote?.dayRange ?? data.finology?.essentials?.dayRange;

  const technical =
    input.ohlc && input.ohlc.length >= 30
      ? scoreTechnicals(input.ohlc)
      : scoreTechnicalsHeuristic({ price, week52, dayRange });

  const newsFeed =
    input.news == null
      ? data.scanx?.news || []
      : input.news.length > 0
        ? input.news
        : data.scanx?.news || [];

  const sentiment = scoreSentiment({
    news: newsFeed,
    analyst: data.scanx?.analyst,
    sectorId: sector.sectorId,
  });

  const macro = scoreMacro(sector.sectorId, input.macroMarkers);
  const levels = computeLevels({
    price,
    horizon,
    technical,
    fundamentalScore: fundamentals.score,
  });

  // First-pass verdict for synthesis step (confidence overwritten after process)
  let verdict = mixVerdict({
    horizon,
    fundamentals,
    technical,
    sentimentScore: sentiment.score,
    sentimentDrivers: sentiment.drivers,
    sentimentRisks: sentiment.risks,
    redFlags: sentiment.redFlags,
    macro,
    sector,
    price,
    levels,
  });

  const process = runAnalystProcess({
    data,
    horizon,
    sector,
    fundamentals,
    technical,
    sentiment: {
      score: sentiment.score,
      drivers: sentiment.drivers,
      risks: sentiment.risks,
      redFlags: sentiment.redFlags,
      itemsLength: sentiment.items.length,
      hasAnalyst: Boolean(data.scanx?.analyst),
    },
    macro,
    levels,
    verdict,
    price,
    macroLoaded: input.macroLoaded ?? input.macroMarkers != null,
    newsLoaded: input.newsLoaded ?? input.news != null,
  });

  verdict = {
    ...verdict,
    confidence: process.processConfidence,
  };

  const suitability = buildSuitability({
    technical,
    sentimentScore: sentiment.score,
    levels,
    price,
    fundamentals,
    sector,
    macro,
  });

  const forecast = buildForecast({
    data,
    horizon,
    price,
    sector,
    fundamentals,
    verdict,
    processConfidence: process.processConfidence,
  });

  return {
    symbol: data.symbol || "",
    company: data.company || data.symbol || "",
    price,
    horizon,
    sector,
    fundamentals,
    technical,
    sentiment: {
      score: sentiment.score,
      items: sentiment.items,
      drivers: sentiment.drivers,
      risks: sentiment.risks,
      redFlags: sentiment.redFlags,
    },
    macro,
    verdict,
    suitability,
    process,
    forecast,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
  };
}

export function positionAdviceFromDecision(
  decision: DecisionPayload,
  position: PositionInput
) {
  const price = decision.price ?? 0;
  const fails = decision.sector.checklist
    .filter((c) => c.status === "fail")
    .map((c) => c.label);
  return advisePosition({
    position,
    price,
    verdict: decision.verdict,
    checklistFails: fails,
  });
}
