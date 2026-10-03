import { AlertTriangle, Check, Minus, X } from "lucide-react";
import type { DecisionPayload } from "@/lib/api";
import type { ProcessStatus } from "@/lib/analysis/analystProcess";
import { ProcessTrack, ScoreRing } from "@/components/viz";
import { cn } from "@/lib/utils";

function bandLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 45) return "Mixed";
  return "Weak";
}

export function ProcessPanel({ decision }: { decision: DecisionPayload }) {
  const p = decision.process;
  const coveragePct = p.coverage * 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing
            value={p.processConfidence}
            label="out of 100"
            size={120}
            tone={p.processConfidence < 40 ? "danger" : "primary"}
          />
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Analyst process
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Confidence is scored 0–100 from the average of scored steps,
              weighted by how much of the checklist had data.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{p.trustLine}</p>
          </div>
        </div>
        <ProcessTrack
          className="sm:max-w-md sm:flex-1"
          coveragePct={coveragePct}
          scoredCount={p.scoredCount}
          totalSteps={p.totalSteps}
          steps={p.steps.map((s) => ({
            id: s.id,
            order: s.order,
            status: s.status,
            title: s.title,
          }))}
        />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold tracking-tight">Step detail</h4>
          <p className="text-xs text-muted-foreground">
            Each score is 0–100 for that checklist item
          </p>
        </div>
        <ol className="flex flex-col gap-2">
          {p.steps.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-border bg-card/50 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <StatusIcon status={s.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      <span className="tabular mr-1.5 text-muted-foreground">
                        {String(s.order).padStart(2, "0")}
                      </span>
                      {s.title}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground/90">
                      {s.summary}
                    </p>
                    {s.missing ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Skip reason: {s.missing}
                      </p>
                    ) : null}
                    {s.evidence.length ? (
                      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {s.evidence.map((e) => (
                          <li key={e} className="flex gap-1.5">
                            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>

                {s.score != null ? (
                  <ScoreBadge score={s.score} status={s.status} />
                ) : (
                  <span className="shrink-0 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                    No score
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ScoreBadge({
  score,
  status,
}: {
  score: number;
  status: ProcessStatus;
}) {
  const v = Math.max(0, Math.min(100, score));
  return (
    <div
      className="w-[5.5rem] shrink-0 text-right"
      title={`Score ${v} out of 100 · ${bandLabel(v)}`}
    >
      <p className="tabular text-sm font-semibold tracking-tight">
        {v}
        <span className="text-xs font-normal text-muted-foreground">/100</span>
      </p>
      <p
        className={cn(
          "text-[0.65rem] font-semibold tracking-wide uppercase",
          status === "pass" && "text-primary",
          status === "warn" && "text-muted-foreground",
          status === "fail" && "text-destructive",
          status === "skip" && "text-muted-foreground"
        )}
      >
        {bandLabel(v)}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            status === "pass" && "bg-primary",
            status === "warn" && "bg-foreground/45",
            status === "fail" && "bg-destructive",
            status === "skip" && "bg-muted-foreground/30"
          )}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ProcessStatus }) {
  const cls = "mt-0.5 size-4 shrink-0";
  if (status === "pass")
    return <Check className={cn(cls, "text-primary")} aria-hidden />;
  if (status === "warn")
    return (
      <AlertTriangle className={cn(cls, "text-foreground/60")} aria-hidden />
    );
  if (status === "fail")
    return <X className={cn(cls, "text-destructive")} aria-hidden />;
  return <Minus className={cn(cls, "text-muted-foreground")} aria-hidden />;
}
