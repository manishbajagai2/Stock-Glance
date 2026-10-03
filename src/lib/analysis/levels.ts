import type { TechnicalResult } from "./technicals";
import { clamp } from "./parse";

/** Internal horizon keys. URL may use `long` (preferred) or legacy `position`. */
export type Horizon = "swing" | "long";

export type TradeLevels = {
  entryZone: { low: number; high: number } | null;
  stop: number | null;
  target1: number | null;
  target2: number | null;
  riskPerShare: number | null;
  notes: string[];
  extendedAboveEntry: boolean;
};

/** Full label for verdict banners and process notes. */
export function horizonLabel(h: Horizon): string {
  return h === "swing" ? "Swing (2–3 months)" : "Long-term";
}

/** Compact label for the desk horizon switcher and FitMeter headers. */
export function horizonSwitchLabel(h: Horizon): string {
  return h === "swing" ? "Swing 2–3 months" : "Long-term";
}

export function horizonFromQuery(raw: string | null | undefined): Horizon {
  const v = String(raw || "").toLowerCase();
  if (v === "swing") return "swing";
  // legacy "position" maps to long-term
  return "long";
}

export function computeLevels(input: {
  price: number | null;
  horizon: Horizon;
  technical: TechnicalResult;
  fundamentalScore: number;
}): TradeLevels {
  const notes: string[] = [];
  const price = input.price ?? input.technical.lastClose;
  if (price == null || !Number.isFinite(price)) {
    return {
      entryZone: null,
      stop: null,
      target1: null,
      target2: null,
      riskPerShare: null,
      notes: ["Price unavailable — cannot compute levels"],
      extendedAboveEntry: false,
    };
  }

  const atr = input.technical.atr ?? price * 0.02;
  const swingLow = input.technical.swingLow;
  const swingHigh = input.technical.swingHigh;
  const sma20 = input.technical.sma20;

  let entryLow: number;
  let entryHigh: number;
  let stop: number;

  if (input.horizon === "swing") {
    if (sma20 != null && input.technical.regime === "uptrend") {
      entryLow = Math.min(sma20 * 0.985, price * 0.98);
      entryHigh = Math.max(sma20 * 1.01, price * 0.995);
      notes.push("Swing entry: pullback toward rising 20DMA / shallow dip");
    } else if (swingLow != null) {
      entryLow = swingLow * 1.01;
      entryHigh = price * 0.99;
      notes.push("Swing entry: prefer reclaim of local range, not chase");
    } else {
      entryLow = price * 0.97;
      entryHigh = price * 1.0;
      notes.push("Swing entry: approximate zone from spot (± heuristic)");
    }
    stop =
      swingLow != null
        ? Math.min(swingLow - 0.5 * atr, price - 1.2 * atr)
        : price - 1.5 * atr;
  } else {
    const support = swingLow ?? price * 0.88;
    entryLow = Math.min(support * 1.02, price * 0.94);
    entryHigh = Math.min(price * 1.02, (support + price) / 2 + atr);
    if (input.fundamentalScore >= 65) {
      notes.push(
        "Long-term entry: accumulate on support while fundamentals stay intact"
      );
    } else {
      notes.push(
        "Long-term entry: keep size modest until checklist improves"
      );
    }
    stop = Math.min(support - atr, price - 2.2 * atr);
  }

  if (entryLow > entryHigh) [entryLow, entryHigh] = [entryHigh, entryLow];
  const risk = Math.max(price - stop, atr * 0.8);

  let target1: number;
  let target2: number;
  if (input.horizon === "swing") {
    target1 = price + risk;
    target2 =
      swingHigh != null && swingHigh > price
        ? Math.max(price + 2 * risk, swingHigh)
        : price + 2 * risk;
  } else {
    // Stretch for multi-month / multi-year ownership
    const stretch1 = Math.max(risk * 2.5, price * 0.12);
    const stretch2 = Math.max(risk * 4, price * 0.22);
    target1 =
      swingHigh != null && swingHigh > price
        ? Math.max(price + stretch1, swingHigh)
        : price + stretch1;
    target2 =
      input.technical.swingHigh != null
        ? Math.max(price + stretch2, (input.technical.swingHigh || price) * 1.08)
        : price + stretch2;
    notes.push("Long-term targets use structure + larger stretch, not swing R only");
  }

  const extendedAboveEntry = price > entryHigh * 1.03;
  if (extendedAboveEntry) {
    notes.push(
      "Spot is above preferred entry zone — wait for pullback or reduce size"
    );
  }

  return {
    entryZone: {
      low: round2(entryLow),
      high: round2(entryHigh),
    },
    stop: round2(stop),
    target1: round2(target1),
    target2: round2(target2),
    riskPerShare: round2(risk),
    notes,
    extendedAboveEntry,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildScenarios(input: {
  price: number | null;
  levels: TradeLevels;
  composite: number;
  horizon: Horizon;
}): {
  bear: Scenario;
  base: Scenario;
  bull: Scenario;
} {
  const price = input.price ?? 0;
  const stop = input.levels.stop ?? price * 0.9;
  const t1 = input.levels.target1 ?? price * 1.08;
  const t2 = input.levels.target2 ?? price * 1.16;
  const pBase = clamp(35 + input.composite * 0.25, 25, 55);
  const pBull = clamp((100 - pBase) * (input.composite / 100) * 0.85, 15, 40);
  const pBear = clamp(100 - pBase - pBull, 15, 45);
  const horizonNote =
    input.horizon === "swing" ? "2–3 month path" : "6–36 month path";

  return {
    bear: {
      label: "Bear",
      price: stop,
      probability: Math.round(pBear),
      note: `Thesis breaks / stop region · ${horizonNote}`,
    },
    base: {
      label: "Base",
      price: t1,
      probability: Math.round(pBase),
      note:
        input.horizon === "swing"
          ? `Base aligns with ~1R / structure target · ${horizonNote}`
          : `Base long-term stretch / structure · ${horizonNote}`,
    },
    bull: {
      label: "Bull",
      price: t2,
      probability: Math.round(pBull),
      note:
        input.horizon === "swing"
          ? `Extension to 2R / next resistance · ${horizonNote}`
          : `Bull multi-year stretch · ${horizonNote}`,
    },
  };
}

export type Scenario = {
  label: string;
  price: number;
  probability: number;
  note: string;
};
