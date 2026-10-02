import type { FundamentalBreakdown } from "./fundamentals";
import type { Horizon, TradeLevels, Scenario } from "./levels";
import { buildScenarios, horizonLabel } from "./levels";
import type { MacroResult } from "./macro";
import { clamp } from "./parse";
import type { SectorModelResult } from "./sectorModels";
import type { TechnicalResult } from "./technicals";

export type VerdictAction =
  | "avoid"
  | "reduce"
  | "hold"
  | "wait"
  | "accumulate"
  | "buy";

export type VerdictResult = {
  action: VerdictAction;
  label: string;
  composite: number;
  /** Model agreement across F/T/S/M (secondary). */
  agreement: number;
  /** Primary trust number — set from analyst process coverage confidence. */
  confidence: number;
  provisional: boolean;
  horizon: Horizon;
  horizonLabel: string;
  scores: { F: number; T: number; S: number; M: number };
  weights: { F: number; T: number; S: number; M: number };
  drivers: string[];
  risks: string[];
  invalidation: string;
  timeStop: string;
  levels: TradeLevels;
  scenarios: { bear: Scenario; base: Scenario; bull: Scenario };
  gateTriggered: string | null;
};

export const WEIGHTS: Record<
  Horizon,
  { F: number; T: number; S: number; M: number }
> = {
  long: { F: 0.5, T: 0.15, S: 0.15, M: 0.2 },
  swing: { F: 0.25, T: 0.45, S: 0.2, M: 0.1 },
};

export function mixVerdict(input: {
  horizon: Horizon;
  fundamentals: FundamentalBreakdown;
  technical: TechnicalResult;
  sentimentScore: number;
  sentimentDrivers: string[];
  sentimentRisks: string[];
  redFlags: string[];
  macro: MacroResult;
  sector: SectorModelResult;
  price: number | null;
  levels: TradeLevels;
  processConfidence?: number;
}): VerdictResult {
  const w = WEIGHTS[input.horizon];
  const F = input.fundamentals.score;
  const T = input.technical.score;
  const S = input.sentimentScore;
  const M = input.macro.score;
  const composite = clamp(F * w.F + T * w.T + S * w.S + M * w.M);

  const scores = [F, T, S, M];
  const avg = scores.reduce((a, b) => a + b, 0) / 4;
  const variance = scores.reduce((a, b) => a + (b - avg) ** 2, 0) / 4;
  let agreement = clamp(100 - Math.sqrt(variance) * 2.2);
  const provisional = !input.technical.available;
  if (provisional) agreement = clamp(agreement - 12);

  const confidence =
    input.processConfidence != null
      ? clamp(input.processConfidence)
      : clamp(agreement * 0.7 + (input.technical.available ? 10 : 0) + 15);

  const drivers = [
    ...input.fundamentals.drivers,
    ...input.technical.drivers,
    ...input.sentimentDrivers,
    ...input.sector.narrativeHooks,
    input.macro.stance !== "neutral"
      ? `Macro ${input.macro.stance} for ${input.sector.sectorLabel}`
      : "",
  ]
    .filter(Boolean)
    .slice(0, 3);

  const risks = [
    ...input.fundamentals.risks,
    ...input.technical.risks,
    ...input.sentimentRisks,
    ...input.macro.bullets.filter((b) =>
      /headwind|pressure|elevated/.test(b)
    ),
  ]
    .filter(Boolean)
    .slice(0, 3);

  if (input.levels.extendedAboveEntry) {
    risks.unshift("Spot extended above preferred entry zone — do not chase");
  }

  let gateTriggered: string | null = null;
  const flags = [...input.fundamentals.redFlags, ...input.redFlags];
  if (flags.length) gateTriggered = flags[0];

  const extended = input.levels.extendedAboveEntry;

  let action: VerdictAction = "hold";
  if (gateTriggered) {
    action = "avoid";
  } else if (composite < 40) {
    action = "reduce";
  } else if (composite < 50) {
    action = "hold";
  } else if (composite < 60 || extended) {
    action = extended ? "wait" : "hold";
  } else if (composite < 75) {
    action = "accumulate";
  } else {
    action = extended ? "wait" : "buy";
  }

  if (confidence < 45 && action === "buy") action = "accumulate";
  if (confidence < 35 && (action === "accumulate" || action === "buy"))
    action = "wait";
  if (provisional && action === "buy") action = "accumulate";

  const labels: Record<VerdictAction, string> = {
    avoid: "Avoid",
    reduce: "Reduce / Exit bias",
    hold: "Hold / Watch",
    wait: "Wait for better entry",
    accumulate: "Accumulate on dips",
    buy: "Buy / Add",
  };

  const invPrice = input.levels.stop;
  const invalidation =
    invPrice != null
      ? `Price sustained below ₹${invPrice.toLocaleString("en-IN")} or fundamental red flags reappear`
      : "Break of thesis supports / re-emergence of red flags";

  const days = input.horizon === "swing" ? 75 : 180;
  const until = new Date();
  until.setDate(until.getDate() + days);
  const timeStop = `Re-evaluate by ${until.toLocaleDateString("en-IN")} if thesis not working`;

  const scenarios = buildScenarios({
    price: input.price,
    levels: input.levels,
    composite,
    horizon: input.horizon,
  });

  return {
    action,
    label: labels[action],
    composite: Math.round(composite),
    agreement: Math.round(agreement),
    confidence: Math.round(confidence),
    provisional,
    horizon: input.horizon,
    horizonLabel: horizonLabel(input.horizon),
    scores: {
      F: Math.round(F),
      T: Math.round(T),
      S: Math.round(S),
      M: Math.round(M),
    },
    weights: w,
    drivers: drivers.slice(0, 3),
    risks: [...new Set(risks)].slice(0, 4),
    invalidation,
    timeStop,
    levels: input.levels,
    scenarios,
    gateTriggered,
  };
}
