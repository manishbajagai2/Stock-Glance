import type { OhlcBar } from "@/lib/api";
import { cn } from "@/lib/utils";

type PriceCanvasProps = {
  bars: OhlcBar[];
  stop?: number | null;
  target1?: number | null;
  target2?: number | null;
  entryLow?: number | null;
  entryHigh?: number | null;
  sma20?: number | null;
  className?: string;
};

export function PriceCanvas({
  bars,
  stop,
  target1,
  target2,
  entryLow,
  entryHigh,
  sma20,
  className,
}: PriceCanvasProps) {
  const slice = bars.slice(-120);
  if (slice.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">Not enough price history</p>
    );
  }

  const closes = slice.map((b) => b.close);
  const extras = [stop, target1, target2, entryLow, entryHigh, sma20].filter(
    (n): n is number => n != null && Number.isFinite(n)
  );
  const min = Math.min(...closes, ...extras);
  const max = Math.max(...closes, ...extras);
  const w = 640;
  const h = 180;
  const pad = 12;
  const xAt = (i: number) =>
    pad + (i / Math.max(1, closes.length - 1)) * (w - pad * 2);
  const yAt = (price: number) =>
    pad + (1 - (price - min) / Math.max(1e-6, max - min)) * (h - pad * 2);

  const line = closes
    .map((c, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(c)}`)
    .join(" ");
  const area = `${line} L${xAt(closes.length - 1)},${h - pad} L${xAt(0)},${h - pad} Z`;

  const bandY1 =
    entryLow != null && entryHigh != null
      ? Math.min(yAt(entryLow), yAt(entryHigh))
      : null;
  const bandY2 =
    entryLow != null && entryHigh != null
      ? Math.max(yAt(entryLow), yAt(entryHigh))
      : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card/40 p-3",
        className
      )}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full" role="img">
        {bandY1 != null && bandY2 != null ? (
          <rect
            x={pad}
            y={bandY1}
            width={w - pad * 2}
            height={Math.max(2, bandY2 - bandY1)}
            className="fill-primary/10"
          />
        ) : null}
        {stop != null ? (
          <line
            x1={pad}
            x2={w - pad}
            y1={yAt(stop)}
            y2={yAt(stop)}
            className="stroke-destructive/50"
            strokeDasharray="4 4"
          />
        ) : null}
        {target1 != null ? (
          <line
            x1={pad}
            x2={w - pad}
            y1={yAt(target1)}
            y2={yAt(target1)}
            className="stroke-primary/40"
            strokeDasharray="4 4"
          />
        ) : null}
        {target2 != null ? (
          <line
            x1={pad}
            x2={w - pad}
            y1={yAt(target2)}
            y2={yAt(target2)}
            className="stroke-primary/25"
            strokeDasharray="2 6"
          />
        ) : null}
        {sma20 != null ? (
          <line
            x1={pad}
            x2={w - pad}
            y1={yAt(sma20)}
            y2={yAt(sma20)}
            className="stroke-muted-foreground/35"
            strokeWidth={1}
          />
        ) : null}
        <path d={area} className="fill-primary/15" />
        <path
          d={line}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Last ~{slice.length} sessions · band = entry · red dash = stop · green =
        targets
      </p>
    </div>
  );
}
