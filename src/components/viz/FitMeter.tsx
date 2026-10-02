import { CandlestickChart, Mountain } from "lucide-react";
import type { FitLabel } from "@/lib/analysis/suitability";
import { cn } from "@/lib/utils";

type FitMeterProps = {
  kind: "swing" | "long";
  label: FitLabel;
  score: number;
  className?: string;
};

const LABEL_TONE: Record<FitLabel, string> = {
  Strong: "text-primary",
  OK: "text-foreground",
  Weak: "text-muted-foreground",
  Avoid: "text-destructive",
};

const BAR_TONE: Record<FitLabel, string> = {
  Strong: "bg-primary",
  OK: "bg-foreground/70",
  Weak: "bg-muted-foreground/50",
  Avoid: "bg-destructive",
};

export function FitMeter({ kind, label, score, className }: FitMeterProps) {
  const v = Math.max(0, Math.min(100, score));
  const Icon = kind === "swing" ? CandlestickChart : Mountain;

  return (
    <div
      className={cn(
        "flex min-w-[9.5rem] flex-1 flex-col gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {kind === "swing" ? "Swing 2–3 mo" : "Long-term"}
        </span>
        <span className={cn("text-xs font-semibold", LABEL_TONE[label])}>
          {label}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("viz-meter-fill h-full rounded-full", BAR_TONE[label])}
          style={{ width: `${v}%` }}
        />
      </div>
      <p className="tabular text-right text-xs font-semibold text-foreground/80">
        {Math.round(v)}
      </p>
    </div>
  );
}
