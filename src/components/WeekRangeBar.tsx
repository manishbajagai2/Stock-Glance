import { displayValue, parsePrice, parseWeekRange } from "@/lib/api";

type WeekRangeBarProps = {
  rangeRaw: string | number | null | undefined;
  currentPrice: string | number | null | undefined;
};

export function WeekRangeBar({ rangeRaw, currentPrice }: WeekRangeBarProps) {
  const range = parseWeekRange(rangeRaw);
  const price = parsePrice(currentPrice);

  if (!range) {
    return (
      <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">52-week range</h2>
        <p className="tabular text-xl font-semibold">{displayValue(rangeRaw)}</p>
        <p className="text-sm text-muted-foreground">
          Where today’s price sits in the last year
        </p>
      </section>
    );
  }

  const span = range.high - range.low || 1;
  let pct =
    price != null ? ((price - range.low) / span) * 100 : null;
  if (pct != null) pct = Math.min(100, Math.max(0, pct));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold tracking-tight">52-week range</h2>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular">{range.low.toLocaleString("en-IN")}</span>
        <span className="tabular">{range.high.toLocaleString("en-IN")}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-secondary">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/35"
          style={{ width: pct != null ? `${pct}%` : "0%" }}
        />
        {pct != null ? (
          <span
            className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-primary bg-card shadow-sm"
            style={{ left: `calc(${pct}% - 0.4375rem)` }}
            title={price != null ? String(price) : undefined}
          />
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Where today’s price sits in the last year
      </p>
    </section>
  );
}
