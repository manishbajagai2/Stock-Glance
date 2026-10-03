import { CandlestickChart, Mountain } from "lucide-react";
import type { FitLabel } from "@/lib/analysis/suitability";
import type { Horizon } from "@/lib/analysis/levels";
import { horizonSwitchLabel } from "@/lib/analysis/levels";
import { cn } from "@/lib/utils";

type HorizonFit = {
  label: FitLabel;
  score: number;
  reasons?: string[];
};

type HorizonSwitchProps = {
  value: Horizon;
  onChange: (next: Horizon) => void;
  longFit?: HorizonFit | null;
  swingFit?: HorizonFit | null;
  className?: string;
};

const OPTIONS: {
  value: Horizon;
  hint: string;
  Icon: typeof Mountain;
}[] = [
  {
    value: "long",
    hint: "Ownership quality · 6–36 months",
    Icon: Mountain,
  },
  {
    value: "swing",
    hint: "Timing & levels · 2–3 months",
    Icon: CandlestickChart,
  },
];

const LABEL_TONE_ACTIVE: Record<FitLabel, string> = {
  Strong: "text-primary-foreground",
  OK: "text-primary-foreground",
  Weak: "text-primary-foreground/85",
  Avoid: "text-primary-foreground",
};

const LABEL_TONE: Record<FitLabel, string> = {
  Strong: "text-primary",
  OK: "text-foreground",
  Weak: "text-muted-foreground",
  Avoid: "text-destructive",
};

export function HorizonSwitch({
  value,
  onChange,
  longFit,
  swingFit,
  className,
}: HorizonSwitchProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-muted/35 p-3 sm:p-3.5",
        className
      )}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Decision horizon
        </p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Sets verdict, forecast & levels
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Analysis horizon"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {OPTIONS.map(({ value: option, hint, Icon }) => {
          const active = value === option;
          const fit = option === "long" ? longFit : swingFit;

          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option)}
              className={cn(
                "flex min-h-14 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-background text-foreground hover:border-foreground/25 hover:bg-card"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  active ? "opacity-95" : "text-muted-foreground"
                )}
                aria-hidden
              />
              <span className="min-w-0 flex flex-1 flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tracking-tight">
                    {horizonSwitchLabel(option)}
                  </span>
                  {fit ? (
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        active
                          ? LABEL_TONE_ACTIVE[fit.label]
                          : LABEL_TONE[fit.label]
                      )}
                    >
                      {fit.label}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-[0.7rem] leading-snug",
                    active
                      ? "text-primary-foreground/85"
                      : "text-muted-foreground"
                  )}
                >
                  {hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[0.7rem] text-muted-foreground sm:hidden">
        Sets verdict, forecast & levels
      </p>
    </div>
  );
}
