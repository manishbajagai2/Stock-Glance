import type { VerdictResult } from "./verdict";

export type PositionInput = {
  avgPrice: number;
  quantity: number;
  maxRiskPct?: number;
  thesisNote?: string;
};

export type PositionAdvice = {
  marketValue: number;
  cost: number;
  pnl: number;
  pnlPct: number;
  advice: "add" | "hold" | "trim" | "exit";
  adviceLabel: string;
  rationale: string[];
  addQty: number | null;
  trimQty: number | null;
  stopPrice: number | null;
  timeStop: string;
  mustBeTrue: string[];
  distanceToStopPct: number | null;
  distanceToT1Pct: number | null;
  rMultiple: number | null;
};

export function advisePosition(input: {
  position: PositionInput;
  price: number;
  verdict: VerdictResult;
  checklistFails: string[];
}): PositionAdvice {
  const { avgPrice, quantity, maxRiskPct = 1 } = input.position;
  const price = input.price;
  const cost = avgPrice * quantity;
  const marketValue = price * quantity;
  const pnl = marketValue - cost;
  const pnlPct = avgPrice ? ((price - avgPrice) / avgPrice) * 100 : 0;

  const stop = input.verdict.levels.stop;
  const t1 = input.verdict.levels.target1;
  const riskPerShare = input.verdict.levels.riskPerShare;
  const rMultiple =
    riskPerShare && riskPerShare > 0 ? (price - avgPrice) / riskPerShare : null;

  const distanceToStopPct =
    stop != null && price ? ((price - stop) / price) * 100 : null;
  const distanceToT1Pct =
    t1 != null && price ? ((t1 - price) / price) * 100 : null;

  const rationale: string[] = [];
  const mustBeTrue = [...input.checklistFails.map((f) => `Fix: ${f}`)];
  if (!mustBeTrue.length) {
    mustBeTrue.push("Sector checklist stays mostly pass/warn");
    mustBeTrue.push("Price holds above invalidation / stop");
    mustBeTrue.push("No new promoter / regulatory red flags");
  }

  const broken =
    input.verdict.action === "avoid" ||
    (stop != null && price < stop) ||
    input.verdict.gateTriggered;

  const inEntry =
    input.verdict.levels.entryZone != null &&
    price >= input.verdict.levels.entryZone.low &&
    price <= input.verdict.levels.entryZone.high * 1.02;

  const thesisOk =
    input.verdict.composite >= 55 &&
    (input.verdict.action === "buy" ||
      input.verdict.action === "accumulate" ||
      input.verdict.action === "hold" ||
      input.verdict.action === "wait");

  let advice: PositionAdvice["advice"] = "hold";
  let addQty: number | null = null;
  let trimQty: number | null = null;

  if (broken) {
    advice = "exit";
    rationale.push("Invalidation hit or hard gate — prioritize capital protection");
    if (input.verdict.gateTriggered)
      rationale.push(input.verdict.gateTriggered);
  } else if (
    rMultiple != null &&
    rMultiple > 2 &&
    input.verdict.composite < 65
  ) {
    advice = "trim";
    trimQty = Math.max(1, Math.floor(quantity * 0.3));
    rationale.push(
      `Extended >2R from avg while conviction soft (score ${input.verdict.composite}) — trim to core`
    );
  } else if (pnlPct < -5 && thesisOk && inEntry) {
    advice = "add";
    const riskBudget = (cost * (maxRiskPct / 100)) / Math.max(price - (stop || price * 0.9), 1);
    addQty = Math.max(1, Math.floor(Math.min(quantity * 0.5, riskBudget || quantity * 0.25)));
    rationale.push("Underwater but thesis intact and price in entry zone — staged add");
    rationale.push("Suggested add in 2 tranches (½ now / ½ on hold of support)");
  } else if (
    thesisOk &&
    input.verdict.composite >= 75 &&
    inEntry &&
    (rMultiple == null || rMultiple < 1)
  ) {
    advice = "add";
    addQty = Math.max(1, Math.floor(quantity * 0.25));
    rationale.push("High conviction with room to stop — modest increase within risk budget");
  } else if (pnlPct > 25 && input.verdict.action === "reduce") {
    advice = "trim";
    trimQty = Math.max(1, Math.floor(quantity * 0.25));
    rationale.push("Book partial profits as verdict softens after a strong run");
  } else {
    advice = "hold";
    rationale.push("No forced action — ride core with stop and time-stop discipline");
    if (input.position.thesisNote)
      rationale.push(`Your thesis note: ${input.position.thesisNote}`);
  }

  const labels = {
    add: "Increase (staged)",
    hold: "Hold core",
    trim: "Trim / reduce",
    exit: "Exit position",
  } as const;

  return {
    marketValue: round2(marketValue),
    cost: round2(cost),
    pnl: round2(pnl),
    pnlPct: round2(pnlPct),
    advice,
    adviceLabel: labels[advice],
    rationale,
    addQty,
    trimQty,
    stopPrice: stop,
    timeStop: input.verdict.timeStop,
    mustBeTrue: mustBeTrue.slice(0, 4),
    distanceToStopPct: distanceToStopPct != null ? round2(distanceToStopPct) : null,
    distanceToT1Pct: distanceToT1Pct != null ? round2(distanceToT1Pct) : null,
    rMultiple: rMultiple != null ? round2(rMultiple) : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
