import type { CompanyData } from "@/lib/api";
import { getPosition } from "@/lib/portfolio";
import type { FundamentalBreakdown } from "./fundamentals";
import type { Horizon, TradeLevels } from "./levels";
import type { MacroResult } from "./macro";
import { clamp } from "./parse";
import type { SectorModelResult } from "./sectorModels";
import type { TechnicalResult } from "./technicals";
import type { VerdictResult } from "./verdict";

export type ProcessStatus = "pass" | "warn" | "fail" | "skip";

export type ProcessStep = {
  id: string;
  title: string;
  order: number;
  status: ProcessStatus;
  score: number | null;
  summary: string;
  evidence: string[];
  missing?: string;
};

export type AnalystProcessResult = {
  steps: ProcessStep[];
  processScore: number | null;
  coverage: number;
  scoredCount: number;
  skippedCount: number;
  totalSteps: number;
  processConfidence: number;
  trustLine: string;
};

function step(
  partial: Omit<ProcessStep, "evidence"> & { evidence?: string[] }
): ProcessStep {
  return { evidence: [], ...partial };
}

function band(score: number): ProcessStatus {
  if (score >= 70) return "pass";
  if (score >= 45) return "warn";
  return "fail";
}

export function runAnalystProcess(input: {
  data: CompanyData;
  horizon: Horizon;
  sector: SectorModelResult;
  fundamentals: FundamentalBreakdown;
  technical: TechnicalResult;
  sentiment: {
    score: number;
    drivers: string[];
    risks: string[];
    redFlags: string[];
    itemsLength: number;
    hasAnalyst: boolean;
  };
  macro: MacroResult;
  levels: TradeLevels;
  verdict: VerdictResult;
  price: number | null;
  macroLoaded: boolean;
  newsLoaded: boolean;
}): AnalystProcessResult {
  const steps: ProcessStep[] = [];
  const { sector, fundamentals: f, technical: t, macro, levels, verdict } =
    input;

  steps.push(
    step({
      id: "sector",
      title: "Business & sector frame",
      order: 1,
      status: band(sector.sectorFit),
      score: Math.round(sector.sectorFit),
      summary: `Mapped to ${sector.sectorLabel} · sector fit ${Math.round(sector.sectorFit)}`,
      evidence: [
        `Sector pack: ${sector.sectorLabel}`,
        ...sector.checklist
          .slice(0, 2)
          .map((c) => `${c.label}: ${c.status}`),
      ],
    })
  );

  steps.push(
    step({
      id: "quality",
      title: "Quality of earnings / returns",
      order: 2,
      status: band(f.quality),
      score: Math.round(f.quality),
      summary: `Quality score ${Math.round(f.quality)} (ROE/ROCE weighted)`,
      evidence: [
        ...f.drivers
          .filter((d) => /ROE|ROCE|quality|return|FinStar|Interest/i.test(d))
          .slice(0, 3),
        ...(input.data.finology?.strengths || []).slice(0, 1),
      ].slice(0, 4),
    })
  );

  steps.push(
    step({
      id: "growth",
      title: "Growth trajectory",
      order: 3,
      status: band(f.growth),
      score: Math.round(f.growth),
      summary: `Growth score ${Math.round(f.growth)}`,
      evidence: f.drivers
        .filter((d) => /growth|sales|YoY/i.test(d))
        .slice(0, 3),
    })
  );

  steps.push(
    step({
      id: "balance",
      title: "Balance sheet & cash",
      order: 4,
      status: band(f.balanceSheet),
      score: Math.round(f.balanceSheet),
      summary: `Balance-sheet score ${Math.round(f.balanceSheet)}`,
      evidence: f.risks
        .filter((r) => /cash|debt|balance|leverage/i.test(r))
        .slice(0, 2),
    })
  );

  steps.push(
    step({
      id: "valuation",
      title: "Valuation vs peers",
      order: 5,
      status: band(f.valuation),
      score: Math.round(f.valuation),
      summary:
        sector.peerPercentile != null
          ? `Peer-relative valuation score ${Math.round(f.valuation)}`
          : `Absolute valuation score ${Math.round(f.valuation)}`,
      evidence: [
        sector.metrics.pe != null ? `P/E ${sector.metrics.pe.toFixed(1)}` : "",
        sector.peerPercentile != null
          ? `Cheaper than ~${Math.round(sector.peerPercentile)}% of peers`
          : "",
      ].filter(Boolean),
    })
  );

  const insights = input.data.screener?.insights || [];
  const share =
    input.data.screener?.tables?.shareholding ||
    input.data.finology?.shareholding;
  const promoter = input.data.finology?.essentials?.["Promoter Holding"];
  const finStarOwn = input.data.finology?.finStar?.ownership;
  const govFlags = [
    ...f.redFlags.filter((r) => /pledge|promoter|governance/i.test(r)),
    ...input.sentiment.redFlags.filter((r) =>
      /promoter|pledge|fraud/i.test(r)
    ),
  ];
  if (
    !share &&
    !insights.length &&
    !govFlags.length &&
    !promoter &&
    !finStarOwn
  ) {
    steps.push(
      step({
        id: "governance",
        title: "Ownership / governance skim",
        order: 6,
        status: "skip",
        score: null,
        summary: "No shareholding/insight governance signals — skipped",
        missing: "Shareholding pattern / pledge cues unavailable",
      })
    );
  } else if (govFlags.length) {
    steps.push(
      step({
        id: "governance",
        title: "Ownership / governance skim",
        order: 6,
        status: "fail",
        score: 20,
        summary: govFlags[0],
        evidence: govFlags.slice(0, 3),
      })
    );
  } else {
    steps.push(
      step({
        id: "governance",
        title: "Ownership / governance skim",
        order: 6,
        status: "pass",
        score: 72,
        summary: "No acute pledge/governance red flags in available data",
        evidence: [
          share ? "Shareholding table present" : "",
          promoter ? `Promoter holding ${promoter}` : "",
          finStarOwn?.rating
            ? `FinStar ownership: ${finStarOwn.rating} (Finology)`
            : "",
          insights[0] || "",
        ].filter(Boolean),
      })
    );
  }

  if (
    !input.newsLoaded &&
    !input.sentiment.itemsLength &&
    !input.sentiment.hasAnalyst
  ) {
    steps.push(
      step({
        id: "news",
        title: "Street & news tape",
        order: 7,
        status: "skip",
        score: null,
        summary: "News/analyst feed not loaded — skipped",
        missing: "Headlines and analyst skew unavailable",
      })
    );
  } else {
    const st = band(input.sentiment.score);
    steps.push(
      step({
        id: "news",
        title: "Street & news tape",
        order: 7,
        status: input.sentiment.redFlags.length ? "fail" : st,
        score: Math.round(input.sentiment.score),
        summary: `Sentiment ${Math.round(input.sentiment.score)}${
          input.sentiment.redFlags.length ? " · red flags present" : ""
        }`,
        evidence: [
          ...input.sentiment.drivers.slice(0, 2),
          ...input.sentiment.redFlags.slice(0, 1),
        ],
      })
    );
  }

  const macroEmpty =
    !input.macroLoaded &&
    input.macro.markers.usdinr == null &&
    input.macro.markers.brent == null &&
    input.macro.markers.niftyChangePct == null;
  if (macroEmpty) {
    steps.push(
      step({
        id: "macro",
        title: "Macro overlay",
        order: 8,
        status: "skip",
        score: null,
        summary: "Macro markers unavailable — skipped",
        missing: "USDINR / Brent / Nifty / yields not fetched",
      })
    );
  } else {
    steps.push(
      step({
        id: "macro",
        title: "Macro overlay",
        order: 8,
        status: band(macro.score),
        score: Math.round(macro.score),
        summary: `Macro ${macro.stance} · score ${Math.round(macro.score)}`,
        evidence: macro.bullets.slice(0, 3),
      })
    );
  }

  if (!t.available && t.regime === "unknown" && t.rsi == null) {
    steps.push(
      step({
        id: "technicals",
        title: "Technical structure",
        order: 9,
        status: "skip",
        score: null,
        summary: "No usable price history — skipped",
        missing: "OHLC bars unavailable",
      })
    );
  } else {
    steps.push(
      step({
        id: "technicals",
        title: "Technical structure",
        order: 9,
        status: t.available ? band(t.score) : "warn",
        score: Math.round(t.score),
        summary: t.available
          ? `Regime ${t.regime} · tech score ${Math.round(t.score)}`
          : `Heuristic only · tech score ${Math.round(t.score)}`,
        evidence: [...t.drivers.slice(0, 2), ...t.risks.slice(0, 1)],
        missing: t.available ? undefined : "Full OHLC missing — range heuristic",
      })
    );
  }

  if (!levels.entryZone || levels.stop == null) {
    steps.push(
      step({
        id: "levels",
        title: "Trade geography",
        order: 10,
        status: "skip",
        score: null,
        summary: "Levels not computable — skipped",
        missing: "Need price + structure for entry/stop/targets",
      })
    );
  } else {
    const extended =
      input.price != null && input.price > levels.entryZone.high * 1.03;
    const lvlScore = extended ? 42 : 72;
    steps.push(
      step({
        id: "levels",
        title: "Trade geography",
        order: 10,
        status: extended ? "warn" : "pass",
        score: lvlScore,
        summary: extended
          ? "Spot extended above preferred entry zone"
          : `Entry ₹${levels.entryZone.low}–${levels.entryZone.high} · stop ₹${levels.stop}`,
        evidence: levels.notes.slice(0, 3),
      })
    );
  }

  const owned = getPosition(input.data.symbol || "");
  if (!owned) {
    steps.push(
      step({
        id: "position",
        title: "Position context",
        order: 11,
        status: "skip",
        score: null,
        summary: "No saved holding on this device — skipped",
        missing: "Enter avg/qty in My Position to include",
      })
    );
  } else if (input.price == null) {
    steps.push(
      step({
        id: "position",
        title: "Position context",
        order: 11,
        status: "skip",
        score: null,
        summary: "Holding saved but live price missing — skipped",
        missing: "Current price unavailable",
      })
    );
  } else {
    const pnlPct = ((input.price - owned.avgPrice) / owned.avgPrice) * 100;
    const belowStop = levels.stop != null && input.price < levels.stop;
    const posScore = belowStop ? 15 : pnlPct < -10 ? 40 : pnlPct > 20 ? 70 : 60;
    steps.push(
      step({
        id: "position",
        title: "Position context",
        order: 11,
        status: belowStop ? "fail" : band(posScore),
        score: posScore,
        summary: belowStop
          ? "Live price below stop — position under stress"
          : `Holding ${owned.quantity} @ ₹${owned.avgPrice} · P&L ${pnlPct.toFixed(1)}%`,
        evidence: [
          `Avg ₹${owned.avgPrice}`,
          `Qty ${owned.quantity}`,
          levels.stop != null ? `Stop ₹${levels.stop}` : "",
        ].filter(Boolean),
      })
    );
  }

  const scoredSoFar = steps.filter((s) => s.score != null);
  if (!scoredSoFar.length) {
    steps.push(
      step({
        id: "synthesis",
        title: "Decision synthesis",
        order: 12,
        status: "skip",
        score: null,
        summary: "Nothing scored upstream — synthesis skipped",
        missing: "Need at least one prior step with data",
      })
    );
  } else {
    const synScore = verdict.gateTriggered ? 15 : clamp(verdict.composite);
    steps.push(
      step({
        id: "synthesis",
        title: "Decision synthesis",
        order: 12,
        status: verdict.gateTriggered ? "fail" : band(synScore),
        score: Math.round(synScore),
        summary: verdict.gateTriggered
          ? `Hard gate: ${verdict.gateTriggered}`
          : `Action ${verdict.label} · composite ${verdict.composite}`,
        evidence: [
          `Horizon: ${input.horizon === "swing" ? "Swing 2–3 mo" : "Long-term"}`,
          ...verdict.drivers.slice(0, 2),
        ],
      })
    );
  }

  const scored = steps.filter((s) => s.status !== "skip" && s.score != null);
  const skippedCount = steps.filter((s) => s.status === "skip").length;
  const totalSteps = steps.length;
  const processScore =
    scored.length > 0
      ? scored.reduce((a, s) => a + (s.score as number), 0) / scored.length
      : null;
  const coverage = scored.length / totalSteps;
  const processConfidence =
    processScore == null
      ? 0
      : Math.round(clamp(processScore * (0.55 + 0.45 * coverage)));

  const trustLine =
    processScore == null
      ? "Confidence unavailable — no analyst steps had data"
      : `Confidence ${processConfidence} · based on ${scored.length} of ${totalSteps} analyst steps · ${skippedCount} skipped (no data)`;

  return {
    steps,
    processScore: processScore != null ? Math.round(processScore) : null,
    coverage,
    scoredCount: scored.length,
    skippedCount,
    totalSteps,
    processConfidence,
    trustLine,
  };
}
