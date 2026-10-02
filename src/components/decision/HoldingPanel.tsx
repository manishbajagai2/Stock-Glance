import type { Holding } from "@/hooks/useHoldings";
import type { DecisionPayload } from "@/lib/api";
import { cn } from "@/lib/utils";

function fmtInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Read-only holding summary on the company desk (when owned). */
export function HoldingPanel({
  holding,
  decision,
  onManage,
}: {
  holding: Holding;
  decision: DecisionPayload;
  onManage: () => void;
}) {
  const spot = decision.price;
  const invested = holding.quantity * holding.avg_price;
  const market =
    spot != null ? spot * holding.quantity : null;
  const pnl = market != null ? market - invested : null;
  const pnlPct =
    spot != null && holding.avg_price > 0
      ? ((spot - holding.avg_price) / holding.avg_price) * 100
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card/60 px-4 py-5 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          My Position · read-only
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight">
          {holding.stock_name}
        </p>
        <p className="text-sm text-muted-foreground">{holding.symbol}</p>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Quantity" value={String(holding.quantity)} />
          <Stat label="Avg price" value={fmtInr(holding.avg_price)} />
          <Stat label="Invested" value={fmtInr(invested)} />
          <Stat
            label="Unrealized P&L"
            value={
              pnl != null && pnlPct != null
                ? `${pnl >= 0 ? "+" : ""}${fmtInr(pnl)}`
                : "—"
            }
            hint={
              pnlPct != null
                ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}% vs avg`
                : spot == null
                  ? "Live price unavailable"
                  : undefined
            }
            tone={pnl == null ? "muted" : pnl >= 0 ? "good" : "bad"}
          />
        </div>

        {holding.buy_date || holding.notes ? (
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            {holding.buy_date ? <p>Buy date · {holding.buy_date}</p> : null}
            {holding.notes ? <p>Notes · {holding.notes}</p> : null}
          </div>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Editing isn’t available here. To change quantity or price, remove and
        re-add under{" "}
        <button
          type="button"
          className="font-semibold text-foreground underline-offset-2 hover:underline"
          onClick={onManage}
        >
          My Holdings
        </button>
        .
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "muted" | "good" | "bad";
}) {
  return (
    <div>
      <p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular tracking-tight",
          tone === "good" && "text-primary",
          tone === "bad" && "text-destructive"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
