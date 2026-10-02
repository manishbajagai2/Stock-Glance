import { clamp } from "./parse";
import type { FundamentalBreakdown } from "./fundamentals";
import type { TradeLevels } from "./levels";
import type { MacroResult } from "./macro";
import type { SectorModelResult } from "./sectorModels";
import type { TechnicalResult } from "./technicals";

export type FitLabel = "Strong" | "OK" | "Weak" | "Avoid";

export type FitResult = {
  score: number;
  label: FitLabel;
  reasons: string[];
};

export type SuitabilityResult = {
  swing: FitResult;
  longTerm: FitResult;
  comboNote: string | null;
};

function labelFromScore(score: number, avoid: boolean): FitLabel {
  if (avoid) return "Avoid";
  if (score >= 70) return "Strong";
  if (score >= 50) return "OK";
  return "Weak";
}

export function scoreSwingFit(input: {
  technical: TechnicalResult;
  sentimentScore: number;
  levels: TradeLevels;
  price: number | null;
  fundamentalScore: number;
}): FitResult {
  const t = input.technical;
  const reasons: string[] = [];
  let score = 50;
  let avoid = false;

  if (t.regime === "uptrend") {
    score += 14;
    reasons.push("Uptrend structure supports a 2–3 month swing");
  } else if (t.regime === "downtrend") {
    score -= 18;
    reasons.push("Downtrend — swings need a clear reclaim first");
  } else if (t.regime === "range") {
    score += 2;
    reasons.push("Range-bound — fade edges, don’t chase middles");
  }

  if (t.rsi != null) {
    if (t.rsi >= 45 && t.rsi <= 65) {
      score += 8;
      reasons.push(`RSI ${t.rsi.toFixed(0)} in a tradable mid-zone`);
    } else if (t.rsi > 72) {
      score -= 12;
      reasons.push("RSI stretched — poor swing chase zone");
    } else if (t.rsi < 30) {
      score += 4;
      reasons.push("Oversold — bounce swing only if support holds");
    }
  }

  if (t.atr != null && input.price) {
    const atrPct = (t.atr / input.price) * 100;
    if (atrPct >= 1.2 && atrPct <= 4.5) {
      score += 6;
      reasons.push("ATR wide enough to define stops without noise");
    } else if (atrPct < 1) {
      score -= 4;
      reasons.push("Very tight ATR — swings may not pay risk");
    } else if (atrPct > 6) {
      score -= 6;
      reasons.push("ATR very wide — swing sizing must be smaller");
    }
  }

  if (t.volumeNote && /elevated/i.test(t.volumeNote) && t.regime === "uptrend") {
    score += 5;
    reasons.push("Volume confirming the move");
  }

  if (input.sentimentScore >= 60) {
    score += 6;
    reasons.push("Tape/sentiment not fighting the swing");
  } else if (input.sentimentScore <= 40) {
    score -= 8;
    reasons.push("Soft sentiment — tighter swing risk");
  }

  const extended =
    input.levels.entryZone &&
    input.price != null &&
    input.price > input.levels.entryZone.high * 1.03;
  if (extended) {
    score -= 14;
    reasons.push("Price extended above entry zone");
  }

  if (input.fundamentalScore < 35) {
    score -= 8;
    reasons.push("Weak fundamentals — keep swing size tiny");
  }

  if (t.regime === "downtrend" && extended) {
    avoid = true;
    reasons.unshift("Avoid swing: downtrend and extended");
  }

  if (!t.available) {
    score = clamp(score - 6);
    reasons.push("OHLC thin — swing fit is provisional");
  }

  const final = clamp(score);
  return {
    score: Math.round(final),
    label: labelFromScore(final, avoid),
    reasons: reasons.slice(0, 4),
  };
}

export function scoreLongTermFit(input: {
  fundamentals: FundamentalBreakdown;
  sector: SectorModelResult;
  macro: MacroResult;
  technical: TechnicalResult;
}): FitResult {
  const reasons: string[] = [];
  const f = input.fundamentals;
  let score =
    f.quality * 0.3 +
    f.growth * 0.25 +
    f.balanceSheet * 0.2 +
    f.valuation * 0.15 +
    input.sector.sectorFit * 0.1;

  if (input.sector.sectorFit >= 65) {
    reasons.push(`${input.sector.sectorLabel} checklist screens solid`);
  } else if (input.sector.sectorFit < 45) {
    reasons.push(`${input.sector.sectorLabel} checklist has soft spots`);
  }

  if (f.quality >= 65) reasons.push("Return profile supports compounding");
  if (f.growth >= 60) reasons.push("Growth trajectory still constructive");
  if (f.balanceSheet < 40)
    reasons.push("Balance sheet / cash conversion is a long-term drag");
  if (f.valuation >= 60) reasons.push("Valuation not extreme vs peers");
  else if (f.valuation < 40)
    reasons.push("Rich valuation — long-term needs earnings delivery");

  if (input.macro.stance === "supportive") {
    score += 4;
    reasons.push("Macro overlay supportive for the sector");
  } else if (input.macro.stance === "headwind") {
    score -= 6;
    reasons.push("Macro headwind for this sector map");
  }

  if (input.technical.regime === "downtrend") score -= 4;
  if (input.technical.regime === "uptrend") score += 3;

  const avoid = f.redFlags.length > 0;
  if (avoid) reasons.unshift(`Avoid long-term until: ${f.redFlags[0]}`);

  const final = clamp(score);
  return {
    score: Math.round(final),
    label: labelFromScore(final, avoid),
    reasons: reasons.slice(0, 4),
  };
}

export function buildSuitability(input: {
  technical: TechnicalResult;
  sentimentScore: number;
  levels: TradeLevels;
  price: number | null;
  fundamentals: FundamentalBreakdown;
  sector: SectorModelResult;
  macro: MacroResult;
}): SuitabilityResult {
  const swing = scoreSwingFit({
    technical: input.technical,
    sentimentScore: input.sentimentScore,
    levels: input.levels,
    price: input.price,
    fundamentalScore: input.fundamentals.score,
  });
  const longTerm = scoreLongTermFit({
    fundamentals: input.fundamentals,
    sector: input.sector,
    macro: input.macro,
    technical: input.technical,
  });

  let comboNote: string | null = null;
  if (
    swing.label === "Strong" &&
    (longTerm.label === "Weak" || longTerm.label === "Avoid")
  ) {
    comboNote = "Better as a swing than a long-term hold";
  } else if (
    longTerm.label === "Strong" &&
    (swing.label === "Weak" || swing.label === "Avoid")
  ) {
    comboNote =
      "Better as a long-term compounder than a near-term swing";
  } else if (swing.label === "Strong" && longTerm.label === "Strong") {
    comboNote = "Fits both swing timing and long-term ownership quality";
  } else if (swing.label === "Avoid" && longTerm.label === "Avoid") {
    comboNote = "Neither swing nor long-term looks attractive right now";
  }

  return { swing, longTerm, comboNote };
}
