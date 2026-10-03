import type { ReactNode } from "react";
import { AlertTriangle, ThumbsDown, ThumbsUp } from "lucide-react";
import { DeskScoreHero } from "@/components/DeskScoreHero";
import { LevelsStrip, ScenarioBars } from "@/components/viz";
import type { DecisionPayload } from "@/lib/api";
import { cn } from "@/lib/utils";

function fmtInr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function ForecastPanel({ decision }: { decision: DecisionPayload }) {
  const f = decision.forecast;
  const v = decision.verdict;
  const price = decision.price;
  const upside = f.upsidePct;
  const upsidePositive = upside != null && upside >= 0;

  const levelPoints = [
    price != null
      ? { id: "spot", label: "Spot", value: price, kind: "spot" as const }
      : null,
    f.fairBand
      ? {
          id: "fair-lo",
          label: "Fair low",
          value: f.fairBand.low,
          kind: "entry" as const,
        }
      : null,
    f.deskForecast != null
      ? {
          id: "desk",
          label: "Forecast",
          value: f.deskForecast,
          kind: "target" as const,
        }
      : null,
    f.fairBand
      ? {
          id: "fair-hi",
          label: "Fair high",
          value: f.fairBand.high,
          kind: "other" as const,
        }
      : null,
    v.levels.stop != null
      ? {
          id: "stop",
          label: "Stop",
          value: v.levels.stop,
          kind: "stop" as const,
        }
      : null,
    v.levels.target1 != null
      ? {
          id: "t1",
          label: "T1",
          value: v.levels.target1,
          kind: "target" as const,
        }
      : null,
  ].filter(Boolean) as {
    id: string;
    label: string;
    value: number;
    kind: "stop" | "entry" | "spot" | "target" | "other";
  }[];

  const metrics: { label: string; value: string; hint?: string }[] = [
    { label: "Trailing PE", value: fmtNum(f.trailingPe) },
    {
      label: "Forward PE",
      value: fmtNum(f.forwardPe),
      hint: f.peSource !== "n/a" ? f.peSource : undefined,
    },
    { label: "Trailing EPS", value: fmtNum(f.trailingEps, 2) },
    { label: "Forward EPS", value: fmtNum(f.forwardEps, 2) },
    {
      label: "Growth used",
      value:
        f.growthRate != null
          ? `${f.growthRate >= 0 ? "+" : ""}${(f.growthRate * 100).toFixed(1)}%`
          : "—",
      hint: f.growthSource,
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <DeskScoreHero
        eyebrow={`Desk forecast · ${decision.horizon === "swing" ? "Swing" : "Long-term"}`}
        title={
          <span className="tabular">{fmtInr(f.deskForecast)}</span>
        }
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-semibold tabular",
                upside == null
                  ? "bg-muted text-muted-foreground"
                  : upsidePositive
                    ? "bg-primary/15 text-primary"
                    : "bg-destructive/15 text-destructive"
              )}
            >
              {upside == null
                ? "vs spot —"
                : `${upsidePositive ? "Upside" : "Downside"} ${fmtPct(upside)}`}
            </span>
            {f.forwardPrice != null ? (
              <span className="text-xs text-muted-foreground">
                PE-model {fmtInr(f.forwardPrice)}
              </span>
            ) : null}
          </div>
        }
        score={f.confidence}
        scoreLabel="Confidence"
        scoreHint="How complete the forecast inputs look — not upside %"
        scoreDetail="Built from data coverage (EPS, PE, growth, levels, peer PE) plus process confidence. Higher means the ₹ forecast is better supported — not a probability of gain."
      />

      {/* Metric strip */}
      <section className="enter-fade-delay-1 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              {m.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular tracking-tight">
              {m.value}
            </p>
            {m.hint ? (
              <p className="mt-0.5 truncate text-[0.65rem] text-muted-foreground">
                {m.hint}
              </p>
            ) : null}
          </div>
        ))}
      </section>

      {/* Fair band + levels */}
      <section className="enter-fade-delay-2 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            Fair band · levels
          </h3>
          {f.fairBand ? (
            <p className="text-xs tabular text-muted-foreground">
              {fmtInr(f.fairBand.low)} – {fmtInr(f.fairBand.high)}
            </p>
          ) : null}
        </div>
        {levelPoints.length ? (
          <LevelsStrip
            points={levelPoints}
            caption="Spot · fair band · desk forecast · stop / T1 context"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Levels unavailable until price loads.
          </p>
        )}
      </section>

      {/* Scenario skew */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">Scenario skew</h3>
          <p className="text-xs tabular text-muted-foreground">
            Prob-weighted {fmtInr(f.probWeightedPrice)}
          </p>
        </div>
        <ScenarioBars
          scenarios={[
            v.scenarios.bear,
            v.scenarios.base,
            v.scenarios.bull,
          ]}
        />
      </section>

      {/* Consolidation */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ConsolidationList
          title="Why"
          icon={<ThumbsUp className="size-3.5 text-primary" />}
          items={f.consolidation.bullish}
          empty="No strong forward drivers yet."
          tone="good"
        />
        <ConsolidationList
          title="Risks"
          icon={<ThumbsDown className="size-3.5 text-destructive" />}
          items={f.consolidation.bearish}
          empty="No acute forecast risks flagged."
          tone="bad"
        />
      </div>
      <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
        <span className="font-semibold">Net · </span>
        {f.consolidation.net}
      </p>

      {/* Method */}
      <details className="group rounded-xl border border-border bg-card/40 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-semibold tracking-tight marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-muted-foreground" />
            Method & caveats
            <span className="text-xs font-normal text-muted-foreground group-open:hidden">
              show
            </span>
            <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
              hide
            </span>
          </span>
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 ps-5 text-xs leading-relaxed text-muted-foreground">
          {f.methodNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          {f.peerMedianPe != null ? (
            <li>Peer median PE {fmtNum(f.peerMedianPe)}</li>
          ) : null}
          {f.trailingEps == null ? (
            <li>
              Soft path: trailing EPS missing — forward price omitted; desk
              forecast falls back to scenario blend.
            </li>
          ) : null}
        </ul>
      </details>
    </div>
  );
}

function ConsolidationList({
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
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        tone === "good"
          ? "border-primary/20 bg-primary/5"
          : "border-destructive/20 bg-destructive/5"
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        {icon}
        {title}
      </p>
      {items.length ? (
        <ul className="space-y-1.5 text-sm leading-snug">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
