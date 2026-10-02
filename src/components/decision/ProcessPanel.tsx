import { AlertTriangle, Check, Minus, X } from "lucide-react";
import type { DecisionPayload } from "@/lib/api";
import type { ProcessStatus } from "@/lib/analysis/analystProcess";
import { ProcessTrack, ScoreRing } from "@/components/viz";
import { cn } from "@/lib/utils";

export function ProcessPanel({ decision }: { decision: DecisionPayload }) {
  const p = decision.process;
  const coveragePct = p.coverage * 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing
            value={p.processConfidence}
            label="Confidence"
            size={120}
            tone={p.processConfidence < 40 ? "danger" : "primary"}
          />
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Analyst process
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {p.trustLine}
            </p>
          </div>
        </div>
        <ProcessTrack
          className="sm:max-w-md sm:flex-1"
          coveragePct={coveragePct}
          steps={p.steps.map((s) => ({
            id: s.id,
            order: s.order,
            status: s.status,
            title: s.title,
          }))}
        />
      </div>

      <ol className="flex flex-col gap-2">
        {p.steps.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-border bg-card/50 px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <StatusIcon status={s.status} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <span className="tabular mr-1.5 text-muted-foreground">
                      {String(s.order).padStart(2, "0")}
                    </span>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/90">{s.summary}</p>
                  {s.missing ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Skip reason: {s.missing}
                    </p>
                  ) : null}
                  {s.evidence.length ? (
                    <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {s.evidence.map((e) => (
                        <li key={e}>· {e}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              {s.score != null ? (
                <span className="tabular shrink-0 text-sm font-semibold">
                  {s.score}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
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
