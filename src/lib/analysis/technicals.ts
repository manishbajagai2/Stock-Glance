import type { OhlcBar } from "@/lib/api";
import { clamp, mean, parseRangePair } from "./parse";

export type TechnicalResult = {
  score: number;
  available: boolean;
  regime: "uptrend" | "downtrend" | "range" | "unknown";
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  atr: number | null;
  lastClose: number | null;
  distFrom20: number | null;
  swingHigh: number | null;
  swingLow: number | null;
  volumeNote: string | null;
  drivers: string[];
  risks: string[];
};

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return mean(closes.slice(-period));
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(bars: OhlcBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = bars.length - period; i < bars.length; i++) {
    const b = bars[i];
    const prev = bars[i - 1];
    const tr = Math.max(
      b.high - b.low,
      Math.abs(b.high - prev.close),
      Math.abs(b.low - prev.close)
    );
    trs.push(tr);
  }
  return mean(trs);
}

function swingPoints(closes: number[], lookback = 5): { high: number; low: number } | null {
  if (closes.length < lookback * 2 + 1) return null;
  const window = closes.slice(-30);
  return { high: Math.max(...window), low: Math.min(...window) };
}

/** Heuristic technicals when OHLC is missing — uses 52W / day range only. */
export function scoreTechnicalsHeuristic(input: {
  price: number | null;
  week52?: string | number | null;
  dayRange?: string | number | null;
}): TechnicalResult {
  const range = parseRangePair(input.week52);
  const day = parseRangePair(input.dayRange);
  const price = input.price;
  if (price == null || !range) {
    return {
      score: 50,
      available: false,
      regime: "unknown",
      rsi: null,
      sma20: null,
      sma50: null,
      sma200: null,
      atr: null,
      lastClose: price,
      distFrom20: null,
      swingHigh: range?.high ?? null,
      swingLow: range?.low ?? null,
      volumeNote: null,
      drivers: [],
      risks: ["Full OHLC unavailable — technical score is a range heuristic only"],
    };
  }
  const span = range.high - range.low || 1;
  const loc = clamp(((price - range.low) / span) * 100);
  // Mid-range preferred for entries; extremes flagged
  let score = 55;
  const drivers: string[] = [];
  const risks: string[] = [];
  if (loc < 30) {
    score = 68;
    drivers.push("Trading in the lower third of the 52W range");
  } else if (loc > 85) {
    score = 38;
    risks.push("Near 52W highs — limited technical cushion");
  } else {
    score = 55;
    drivers.push("Price mid-range on 52W — wait for OHLC for precise timing");
  }
  if (day) {
    drivers.push(`Day range ₹${day.low}–₹${day.high}`);
  }
  return {
    score,
    available: false,
    regime: loc > 60 ? "uptrend" : loc < 40 ? "downtrend" : "range",
    rsi: null,
    sma20: null,
    sma50: null,
    sma200: null,
    atr: span / 20,
    lastClose: price,
    distFrom20: null,
    swingHigh: range.high,
    swingLow: range.low,
    volumeNote: null,
    drivers,
    risks,
  };
}

export function scoreTechnicals(bars: OhlcBar[]): TechnicalResult {
  if (!bars?.length || bars.length < 30) {
    return scoreTechnicalsHeuristic({ price: null });
  }
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume || 0);
  const last = closes[closes.length - 1];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const r = rsi(closes);
  const a = atr(bars);
  const swings = swingPoints(closes);
  const drivers: string[] = [];
  const risks: string[] = [];

  let regime: TechnicalResult["regime"] = "range";
  let score = 50;

  if (s50 != null && s200 != null) {
    if (last > s50 && s50 > s200) {
      regime = "uptrend";
      score += 18;
      drivers.push("Price above 50 & 200 DMA (uptrend stack)");
    } else if (last < s50 && s50 < s200) {
      regime = "downtrend";
      score -= 18;
      risks.push("Price below 50 & 200 DMA (downtrend stack)");
    } else {
      regime = "range";
      drivers.push("Mixed moving averages — range / transition");
    }
  }

  if (r != null) {
    if (r >= 45 && r <= 65) {
      score += 8;
      drivers.push(`RSI ${r.toFixed(0)} — constructive mid-zone`);
    } else if (r > 70) {
      score -= 10;
      risks.push(`RSI ${r.toFixed(0)} overbought`);
    } else if (r < 30) {
      score += 5;
      drivers.push(`RSI ${r.toFixed(0)} oversold — bounce candidate if thesis intact`);
    }
  }

  const distFrom20 =
    s20 != null && s20 !== 0 ? ((last - s20) / s20) * 100 : null;
  if (distFrom20 != null) {
    if (distFrom20 > 12) {
      score -= 12;
      risks.push(`Extended ${distFrom20.toFixed(1)}% above 20DMA`);
    } else if (distFrom20 < -8) {
      score -= 5;
      risks.push(`Weak ${distFrom20.toFixed(1)}% below 20DMA`);
    } else if (distFrom20 <= 3 && distFrom20 >= -3 && regime === "uptrend") {
      score += 8;
      drivers.push("Pullback near 20DMA in uptrend — cleaner entry geography");
    }
  }

  let volumeNote: string | null = null;
  if (volumes.some((v) => v > 0)) {
    const recent = mean(volumes.slice(-5)) || 0;
    const base = mean(volumes.slice(-25, -5)) || 0;
    if (base > 0) {
      const ratio = recent / base;
      if (ratio > 1.4) {
        volumeNote = "Recent volume elevated vs prior weeks";
        if (regime === "uptrend") {
          score += 5;
          drivers.push(volumeNote);
        }
      } else if (ratio < 0.7) {
        volumeNote = "Volume light — move less confirmed";
        risks.push(volumeNote);
      }
    }
  }

  return {
    score: clamp(score),
    available: true,
    regime,
    rsi: r,
    sma20: s20,
    sma50: s50,
    sma200: s200,
    atr: a,
    lastClose: last,
    distFrom20,
    swingHigh: swings?.high ?? null,
    swingLow: swings?.low ?? null,
    volumeNote,
    drivers: drivers.slice(0, 4),
    risks: risks.slice(0, 4),
  };
}
