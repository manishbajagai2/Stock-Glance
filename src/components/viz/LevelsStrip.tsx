import { cn } from "@/lib/utils";

export type LevelsPoint = {
  id: string;
  label: string;
  value: number;
  kind: "stop" | "entry" | "spot" | "target" | "other";
};

type LevelsStripProps = {
  points: LevelsPoint[];
  entryLow?: number | null;
  entryHigh?: number | null;
  className?: string;
  caption?: string;
};

function toneClasses(kind: LevelsPoint["kind"]) {
  if (kind === "stop") return "border-destructive bg-destructive";
  if (kind === "spot") return "border-primary bg-background";
  if (kind === "target") return "border-primary bg-primary";
  return "border-foreground bg-foreground";
}

function formatInr(n: number) {
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: n >= 100 ? 1 : 2,
  });
}

export function LevelsStrip({
  points,
  entryLow,
  entryHigh,
  className,
  caption,
}: LevelsStripProps) {
  const values = points.map((p) => p.value).filter((n) => Number.isFinite(n));
  if (entryLow != null) values.push(entryLow);
  if (entryHigh != null) values.push(entryHigh);
  if (values.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">Levels unavailable</p>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const edge = 3;
  const pct = (n: number) => edge + ((n - min) / span) * (100 - edge * 2);

  const entryLeft =
    entryLow != null && entryHigh != null
      ? Math.min(pct(entryLow), pct(entryHigh))
      : null;
  const entryWidth =
    entryLow != null && entryHigh != null
      ? Math.abs(pct(entryHigh) - pct(entryLow))
      : null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {/* Track + markers only — labels live in the grid below so they never collide */}
      <div className="relative h-10 w-full min-w-0">
        <div
          className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border"
          aria-hidden
        />
        {entryLeft != null && entryWidth != null ? (
          <div
            className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-primary/50"
            style={{
              left: `${entryLeft}%`,
              width: `${Math.max(entryWidth, 2)}%`,
            }}
            title="Entry zone"
            aria-hidden
          />
        ) : null}
        {points.map((p) => (
          <span
            key={p.id}
            className={cn(
              "absolute z-10 size-3.5 -translate-x-1/2 rounded-full border-[2.5px] shadow-sm",
              "ring-[3px] ring-card",
              toneClasses(p.kind)
            )}
            style={{ left: `${pct(p.value)}%`, top: "calc(50% - 0.4375rem)" }}
            title={`${p.label}: ₹${formatInr(p.value)}`}
          />
        ))}
      </div>

      <ul
        className={cn(
          "grid min-w-0 gap-2",
          points.length <= 2
            ? "grid-cols-2"
            : "grid-cols-2 sm:grid-cols-4"
        )}
      >
        {points.map((p) => (
          <li
            key={p.id}
            className="flex min-w-0 items-start gap-2 rounded-lg border border-border/70 bg-background/40 px-2.5 py-2"
          >
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full border-2",
                toneClasses(p.kind)
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {p.label}
              </p>
              <p className="tabular truncate text-sm font-semibold text-foreground">
                ₹{formatInr(p.value)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {caption ? (
        <p className="text-xs leading-snug text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}
