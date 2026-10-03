import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  ActionGlyph,
  FitMeter,
  LevelsStrip,
  ScenarioBars,
  ScoreArcRow,
  ScoreRing,
} from "@/components/viz";
import type { VerdictAction } from "@/lib/analysis/verdict";
import type { DecisionPayload } from "@/lib/api";
import { cn } from "@/lib/utils";

const ACTION_STYLES: Record<VerdictAction, string> = {
  buy: "bg-primary text-primary-foreground",
  accumulate: "bg-primary/85 text-primary-foreground",
  wait: "bg-secondary text-secondary-foreground",
  hold: "bg-muted text-foreground",
  reduce: "bg-destructive/15 text-destructive",
  avoid: "bg-destructive text-destructive-foreground",
};

export function VerdictPanel({ decision }: { decision: DecisionPayload }) {
  const v = decision.verdict;
  const levels = v.levels;
  const w = v.weights;
  const price = decision.price;

  const levelPoints = [
    levels.stop != null
      ? { id: "stop", label: "Stop", value: levels.stop, kind: "stop" as const }
      : null,
    price != null
      ? { id: "spot", label: "Spot", value: price, kind: "spot" as const }
      : null,
    levels.target1 != null
      ? {
          id: "t1",
          label: "T1",
          value: levels.target1,
          kind: "target" as const,
        }
      : null,
    levels.target2 != null
      ? {
          id: "t2",
          label: "T2",
          value: levels.target2,
          kind: "target" as const,
        }
      : null,
  ].filter(Boolean) as {
    id: string;
    label: string;
    value: number;
    kind: "stop" | "spot" | "target";
  }[];

  return (
    <div className="flex flex-col gap-7">
      {/* 1. Action banner — score ring is the hero metric */}
      <div
        className={cn(
          "enter-fade flex items-center gap-3 rounded-2xl px-4 py-4 sm:gap-6 sm:px-6 sm:py-6",
          ACTION_STYLES[v.action]
        )}
      >
        <ActionGlyph action={v.action} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide uppercase opacity-80">
            Verdict · {v.horizonLabel}
            {v.provisional ? " · provisional" : ""}
          </p>
          <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {v.label}
          </p>
          <p className="mt-0.5 text-sm opacity-90">
            Composite {v.composite}
            <span className="opacity-80">/100</span>
            {v.gateTriggered ? ` · gate: ${v.gateTriggered}` : ""}
          </p>
        </div>
        <ScoreRing
          value={v.composite}
          label="Score"
          size={96}
          tone="onColor"
          className="shrink-0 drop-shadow-sm sm:hidden"
        />
        <ScoreRing
          value={v.composite}
          label="Score"
          size={112}
          tone="onColor"
          className="hidden shrink-0 drop-shadow-sm sm:inline-flex"
        />
      </div>

      {/* 2. Confidence ring + F/T/S/M arcs */}
      <div className="enter-fade-delay-1 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex flex-col items-center gap-2">
          <ScoreRing
            value={v.confidence}
            label="Confidence"
            size={120}
            tone={v.confidence < 40 ? "danger" : "primary"}
          />
          <p className="max-w-[14rem] text-center text-xs text-muted-foreground">
            Based on {decision.process.scoredCount}/{decision.process.totalSteps}{" "}
            scored steps · confidence out of 100
          </p>
        </div>
        <ScoreArcRow
          items={[
            {
              key: "F",
              label: "Fundamentals",
              score: v.scores.F,
              weight: w.F,
            },
            {
              key: "T",
              label: "Technicals",
              score: v.scores.T,
              weight: w.T,
            },
            {
              key: "S",
              label: "Sentiment",
              score: v.scores.S,
              weight: w.S,
            },
            { key: "M", label: "Macro", score: v.scores.M, weight: w.M },
          ]}
        />
      </div>

      {/* 3. Fit meters */}
      <div className="enter-fade-delay-2 flex flex-col gap-2 sm:flex-row">
        <FitMeter
          kind="swing"
          label={decision.suitability.swing.label}
          score={decision.suitability.swing.score}
        />
        <FitMeter
          kind="long"
          label={decision.suitability.longTerm.label}
          score={decision.suitability.longTerm.score}
        />
      </div>
      {decision.suitability.comboNote ? (
        <p className="-mt-4 text-sm font-medium text-foreground/90">
          {decision.suitability.comboNote}
        </p>
      ) : null}

      {/* 4. Levels strip */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card/50 px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold tracking-tight">Trade geography</h3>
        <LevelsStrip
          points={levelPoints}
          entryLow={levels.entryZone?.low}
          entryHigh={levels.entryZone?.high}
          caption={
            levels.extendedAboveEntry
              ? "Spot is above the entry band — wait or size down"
              : "Stop · entry band · spot · targets"
          }
        />
      </section>

      {/* 5. Scenarios */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Scenario skew</h3>
        <ScenarioBars
          scenarios={[
            v.scenarios.bear,
            v.scenarios.base,
            v.scenarios.bull,
          ]}
        />
      </section>

      {/* 6. Compact why / risks */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CompactList
          title="Why"
          icon={<ThumbsUp className="size-3.5 text-primary" />}
          items={v.drivers}
          empty="No strong drivers yet."
          tone="good"
        />
        <CompactList
          title="Risks"
          icon={<ThumbsDown className="size-3.5 text-destructive" />}
          items={v.risks}
          empty="No acute risks flagged."
          tone="bad"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        <Check className="mr-1 inline size-3" />
        Invalidation: {v.invalidation}
      </p>
      <p className="text-xs text-muted-foreground">{v.timeStop}</p>
    </div>
  );
}

function CompactList({
  title,
  icon,
  items,
  empty,
  tone,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  empty: string;
  tone: "good" | "bad";
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.length ? (
          items.map((d) => (
            <li
              key={d}
              className={cn(
                "flex gap-2 text-sm leading-snug",
                tone === "good" ? "text-foreground/90" : "text-foreground/90"
              )}
            >
              {tone === "good" ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              )}
              <span>{d}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">{empty}</li>
        )}
      </ul>
    </div>
  );
}
