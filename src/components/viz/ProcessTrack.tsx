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
  coveragePct: number;
  className?: string;
};

const DOT: Record<ProcessStatus, string> = {
  pass: "bg-primary",
  warn: "bg-foreground/45",
  fail: "bg-destructive",
  skip: "bg-muted-foreground/25",
};

export function ProcessTrack({
  steps,
  coveragePct,
  className,
}: ProcessTrackProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Analyst steps</span>
        <span className="tabular font-medium text-foreground">
          {Math.round(coveragePct)}% covered
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <span
            key={s.id}
            title={`${s.order}. ${s.title} · ${s.status}`}
            className={cn(
              "viz-step-dot size-2.5 rounded-full sm:size-3",
              DOT[s.status]
            )}
            style={{ animationDelay: `${i * 30}ms` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[0.65rem] text-muted-foreground">
        <Legend color="bg-primary" label="Pass" />
        <Legend color="bg-foreground/45" label="Warn" />
        <Legend color="bg-destructive" label="Fail" />
        <Legend color="bg-muted-foreground/25" label="Skip" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}
