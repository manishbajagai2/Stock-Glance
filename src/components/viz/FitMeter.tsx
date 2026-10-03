import { CandlestickChart, Mountain } from "lucide-react";
import type { FitLabel } from "@/lib/analysis/suitability";
import { horizonSwitchLabel, type Horizon } from "@/lib/analysis/levels";
import { cn } from "@/lib/utils";

type FitMeterProps = {
  kind: Horizon;
  label: FitLabel;
  score: number;
  reasons?: string[];
  active?: boolean;
  onSelect?: () => void;
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

export function FitMeter({
  kind,
  label,
  score,
  reasons = [],
  active = false,
  onSelect,
  className,
}: FitMeterProps) {
  const v = Math.max(0, Math.min(100, score));
  const Icon = kind === "swing" ? CandlestickChart : Mountain;
  const topReasons = reasons.filter(Boolean).slice(0, 2);
  const interactive = typeof onSelect === "function";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? active : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cn(
        "flex min-w-[9.5rem] flex-1 flex-col gap-1.5 rounded-xl border bg-card/60 px-3 py-2.5 transition-colors",
        active
          ? "border-primary/45 ring-1 ring-primary/20"
          : "border-border",
        interactive &&
          "cursor-pointer outline-none hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {horizonSwitchLabel(kind)}
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
      <p className="tabular text-right text-xs font-semibold text-foreground/90">
        {Math.round(v)}
        <span className="font-normal text-muted-foreground">/100</span>
      </p>
      {topReasons.length ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {topReasons.map((reason) => (
            <li
              key={reason}
              className="flex gap-1.5 text-[0.65rem] leading-snug text-muted-foreground"
            >
              <span
                aria-hidden
                className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/45"
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
