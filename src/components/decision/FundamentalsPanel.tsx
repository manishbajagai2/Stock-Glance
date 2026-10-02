import type { DecisionPayload, CompanyData } from "@/lib/api";
import { FinancialTable } from "@/components/FinancialTable";
import { KeyOverview } from "@/components/KeyOverview";
import { cn } from "@/lib/utils";

export function FundamentalsPanel({
  decision,
  data,
}: {
  decision: DecisionPayload;
  data: CompanyData;
}) {
  const f = decision.fundamentals;
  const sector = decision.sector;
  const snap = data.screener?.snapshot || data.snapshot || {};
  const tables = data.screener?.tables || {};
  const fin = data.finology?.essentials || {};
  const peers = tables.peers || data.finology?.peers || null;
  const shareholding =
    tables.shareholding || data.finology?.shareholding || null;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
        {[
          ["Score", Math.round(f.score)],
          ["Quality", Math.round(f.quality)],
          ["Growth", Math.round(f.growth)],
          ["Balance sheet", Math.round(f.balanceSheet)],
          ["Valuation", Math.round(f.valuation)],
        ].map(([label, val]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-border bg-card/60 px-3 py-3"
          >
            <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
            <p className="tabular mt-1 text-xl font-semibold">{val}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-1 text-base font-semibold tracking-tight">
          {sector.sectorLabel} checklist
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Sector-aware gates — pass / warn / fail vs peers and history.
        </p>
        <ul className="flex flex-col gap-2">
          {sector.checklist.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-0.5 rounded-lg border border-border/80 bg-card/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2">
                <StatusPill status={c.status} />
                <span className="text-sm font-medium">{c.label}</span>
              </div>
              <span className="text-sm text-muted-foreground">{c.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      {f.redFlags.length ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-semibold text-destructive">Red flags</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-destructive">
            {f.redFlags.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <KeyOverview
        url={data.screener?.url || data.finology?.url}
        currentPrice={snap.current_price ?? fin.price}
        rangeRaw={
          snap.week_52_high_low ?? snap["52_week_high_low"] ?? fin.week52
        }
        items={[
          { label: "Market cap", value: snap.market_cap ?? fin["Market Cap"] },
          { label: "P/E", value: snap.pe ?? fin["P/E"] },
          { label: "Book value", value: snap.book_value ?? fin["Book Value (TTM)"] },
          { label: "ROE", value: snap.roe ?? fin.ROE },
          { label: "ROCE", value: snap.roce ?? fin.ROCE },
          {
            label: "Dividend yield",
            value: snap.dividend_yield ?? fin["Div. Yield"],
          },
        ]}
      />

      <FinancialTable title="Peer comparison" table={peers} />
      <FinancialTable
        title="Quarterly results"
        subtitle="Figures in ₹ crores"
        table={tables.quarters || data.finology?.quarters}
      />
      <FinancialTable
        title="Profit & loss"
        subtitle="Annual · figures in ₹ crores"
        table={tables.profitLoss || data.finology?.profitLoss}
      />
      {(tables.growth || []).map((g) => (
        <FinancialTable key={g.title} title={g.title} table={g.table} />
      ))}
      <FinancialTable
        title="Balance sheet"
        subtitle="Figures in ₹ crores"
        table={tables.balanceSheet || data.finology?.balanceSheet}
      />
      <FinancialTable
        title="Cash flows"
        subtitle="Figures in ₹ crores"
        table={tables.cashFlows || data.finology?.cashFlows}
      />
      <FinancialTable title="Ratios" table={tables.ratios} />
      <FinancialTable title="Shareholding" table={shareholding} />
    </div>
  );
}

function StatusPill({ status }: { status: "pass" | "warn" | "fail" }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-12 items-center justify-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase",
        status === "pass" && "bg-primary/15 text-primary",
        status === "warn" && "bg-secondary text-secondary-foreground",
        status === "fail" && "bg-destructive/15 text-destructive"
      )}
    >
      {status}
    </span>
  );
}
