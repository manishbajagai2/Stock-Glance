import { cn } from "@/lib/utils";
import type { ProcessStatus } from "@/lib/analysis/analystProcess";

type StepDot = {
  id: string;
  order: number;
  status: ProcessStatus;
  title: string;
};

type ProcessTrackProps = {
  steps: StepDot[];
  scoredCount: number;
  totalSteps: number;
  coveragePct: number;
  className?: string;
};

const STATUS_META: Record<
  ProcessStatus,
  { label: string; bar: string; chip: string }
> = {
  pass: {
    label: "Pass",
    bar: "bg-primary",
    chip: "border-primary/30 bg-primary/10 text-primary",
  },
  warn: {
    label: "Watch",
    bar: "bg-foreground/40",
    chip: "border-border bg-muted text-foreground",
  },
  fail: {
    label: "Fail",
    bar: "bg-destructive",
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  skip: {
    label: "No data",
    bar: "bg-muted-foreground/25",
    chip: "border-border/60 bg-card text-muted-foreground",
  },
};

export function ProcessTrack({
  steps,
  scoredCount,
  totalSteps,
  coveragePct,
  className,
}: ProcessTrackProps) {
  const counts = {
    pass: steps.filter((s) => s.status === "pass").length,
    warn: steps.filter((s) => s.status === "warn").length,
    fail: steps.filter((s) => s.status === "fail").length,
    skip: steps.filter((s) => s.status === "skip").length,
  };
  const ordered: ProcessStatus[] = ["pass", "warn", "fail", "skip"];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/50 p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tracking-tight">Checklist coverage</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {scoredCount} of {totalSteps} steps had enough data to score
          </p>
        </div>
        <p className="tabular text-sm font-semibold">
          {Math.round(coveragePct)}
          <span className="font-normal text-muted-foreground">% covered</span>
        </p>
      </div>

      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Pass ${counts.pass}, watch ${counts.warn}, fail ${counts.fail}, no data ${counts.skip}`}
      >
        {ordered.map((status) => {
          const n = counts[status];
          if (!n) return null;
          return (
            <span
              key={status}
              className={cn("h-full", STATUS_META[status].bar)}
              style={{ width: `${(n / totalSteps) * 100}%` }}
              title={`${STATUS_META[status].label}: ${n}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {ordered.map((status) => (
          <span
            key={status}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              STATUS_META[status].chip
            )}
          >
            <span className="tabular font-semibold">{counts[status]}</span>
            {STATUS_META[status].label}
          </span>
        ))}
      </div>
    </div>
  );
}
