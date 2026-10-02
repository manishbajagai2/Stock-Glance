import type { DecisionPayload } from "@/lib/api";
import { cn } from "@/lib/utils";

export function MacroPanel({ decision }: { decision: DecisionPayload }) {
  const m = decision.macro;
  const markers = m.markers;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Macro thesis</h3>
          <p className="text-sm text-muted-foreground">
            Lightweight India desk mapped to {decision.sector.sectorLabel}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-semibold capitalize",
              m.stance === "supportive" && "text-primary",
              m.stance === "headwind" && "text-destructive",
              m.stance === "neutral" && "text-muted-foreground"
            )}
          >
            {m.stance}
          </p>
          <p className="tabular text-2xl font-semibold">{Math.round(m.score)}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Marker label="India 10Y" value={fmt(markers.india10y, "%")} />
        <Marker label="USDINR" value={fmt(markers.usdinr)} />
        <Marker label="Brent" value={fmt(markers.brent, "$")} />
        <Marker
          label="Nifty Δ"
          value={
            markers.niftyChangePct != null
              ? `${markers.niftyChangePct >= 0 ? "+" : ""}${markers.niftyChangePct.toFixed(2)}%`
              : "—"
          }
        />
      </div>

      <ul className="flex flex-col gap-2">
        {m.bullets.map((b) => (
          <li
            key={b}
            className="rounded-xl border border-border bg-card/50 px-3 py-2.5 text-sm"
          >
            {b}
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Markers are public proxies, not a terminal feed. Use them as context, not
        gospel.
      </p>
    </div>
  );
}

function Marker({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-3 py-3">
      <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (suffix === "$") return `$${n.toFixed(1)}`;
  if (suffix === "%") return `${n.toFixed(2)}%`;
  return n.toFixed(2);
}
