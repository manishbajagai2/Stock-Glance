import { FinancialTable } from "@/components/FinancialTable";
import { InsightsList } from "@/components/InsightsList";
import { KeyOverview } from "@/components/KeyOverview";
import {
  cleanLabel,
  type FinologyBundle,
  type ScanxBundle,
  type ScreenerBundle,
} from "@/lib/api";

export function ScreenerPanel({
  bundle,
}: {
  bundle: ScreenerBundle | null | undefined;
}) {
  if (!bundle) {
    return (
      <p className="py-8 text-sm text-muted-foreground">No Screener data.</p>
    );
  }
  if (bundle.error) {
    return (
      <p className="py-8 text-sm text-destructive">
        Could not load Screener: {bundle.error}
      </p>
    );
  }

  const snapshot = bundle.snapshot || {};
  const tables = bundle.tables || {};
  const rangeRaw =
    snapshot.week_52_high_low ?? snapshot["52_week_high_low"];

  return (
    <div className="flex flex-col gap-8 pt-2">
      <KeyOverview
        url={bundle.url}
        currentPrice={snapshot.current_price}
        rangeRaw={rangeRaw}
        items={[
          { label: "Market cap", value: snapshot.market_cap },
          { label: "P/E", value: snapshot.pe },
          { label: "Book value", value: snapshot.book_value },
          { label: "ROE", value: snapshot.roe },
          { label: "ROCE", value: snapshot.roce },
          { label: "Dividend yield", value: snapshot.dividend_yield },
        ]}
      />

      <div className="flex flex-col gap-10">
        <FinancialTable
          title="Peer comparison"
          table={tables.peers}
        />
        <FinancialTable
          title="Quarterly results"
          subtitle="Figures in ₹ crores"
          table={tables.quarters}
        />
        <FinancialTable
          title="Profit & loss"
          subtitle="Annual · figures in ₹ crores"
          table={tables.profitLoss}
        />
        {(tables.growth || []).map((g) => (
          <FinancialTable
            key={g.title}
            title={g.title}
            table={g.table}
          />
        ))}
        <FinancialTable
          title="Balance sheet"
          subtitle="Figures in ₹ crores"
          table={tables.balanceSheet}
        />
        <FinancialTable
          title="Cash flows"
          subtitle="Figures in ₹ crores"
          table={tables.cashFlows}
        />
        <FinancialTable title="Ratios" table={tables.ratios} />
        <FinancialTable title="Shareholding" table={tables.shareholding} />
        {(tables.shareholdingExtra || []).map((t, i) => (
          <FinancialTable
            key={`share-extra-${i}`}
            title={cleanLabel(t.headers?.[0] || `Shareholding detail ${i + 1}`)}
            table={t}
          />
        ))}
        {(tables.insightExtras || []).map((t, i) => (
          <FinancialTable
            key={`insight-extra-${i}`}
            title={cleanLabel(t.headers?.[0] || `Insight ${i + 1}`)}
            table={t}
          />
        ))}
      </div>

      <InsightsList insights={bundle.insights || []} />
    </div>
  );
}

export function ScanxPanel({ bundle }: { bundle: ScanxBundle | null | undefined }) {
  if (!bundle) {
    return <p className="py-8 text-sm text-muted-foreground">No ScanX data.</p>;
  }
  if (bundle.error && !bundle.quote?.price && !bundle.fundamentals) {
    return (
      <p className="py-8 text-sm text-destructive">
        Could not load ScanX: {bundle.error}
      </p>
    );
  }

  const quote = bundle.quote || {};
  const f = bundle.fundamentals || {};
  const analyst = bundle.analyst;

  return (
    <div className="flex flex-col gap-8 pt-2">
      <KeyOverview
        url={bundle.url}
        currentPrice={quote.price}
        rangeRaw={quote.week52}
        items={[
          {
            label: "Market cap",
            value: f["Market Cap"] || quote.marketCap,
          },
          { label: "P/E", value: f["PE Ratio"] || quote.pe },
          { label: "P/B", value: f["PB Ratio"] },
          { label: "EPS", value: f.EPS },
          { label: "ROE", value: f["Return on Equity"] },
          { label: "Book value", value: f["Book Value"] },
          { label: "Dividend yield", value: f["Dividend Yield"] },
          { label: "Debt / equity", value: f["Debt to Equity"] },
          { label: "EBITDA", value: f.EBITDA },
        ]}
      />

      {(quote.change || quote.volume || quote.dayRange) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            Quote extras
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Change", quote.change],
              ["Change %", quote.changePct],
              ["Volume", quote.volume],
              ["Day range", quote.dayRange],
            ].map(([label, value]) =>
              value ? (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="tabular text-base font-semibold">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        </section>
      )}

      {analyst?.rating ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            Analyst rating
          </h2>
          <div className="rounded-xl border border-border px-4 py-4">
            <p className="text-2xl font-semibold tracking-tight text-primary">
              {analyst.rating}
            </p>
            {analyst.blurb ? (
              <p className="mt-1 text-sm text-muted-foreground">{analyst.blurb}</p>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <p className="text-muted-foreground">Buy</p>
                <p className="tabular font-semibold">
                  {analyst.buy ? `${analyst.buy}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Hold</p>
                <p className="tabular font-semibold">
                  {analyst.hold ? `${analyst.hold}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Sell</p>
                <p className="tabular font-semibold">
                  {analyst.sell ? `${analyst.sell}%` : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <FinancialTable title="Peer comparison" table={bundle.peers} />

      <div className="flex flex-col gap-10">
        <FinancialTable
          title="Quarterly financial results"
          table={bundle.tables?.quarters}
        />
        <FinancialTable
          title="Balance sheet"
          table={bundle.tables?.balanceSheet}
        />
        <FinancialTable title="Cash flow" table={bundle.tables?.cashFlows} />
        <FinancialTable
          title="Share holding"
          table={bundle.tables?.shareholding}
        />
        <FinancialTable
          title="Dividend history"
          table={bundle.tables?.dividends}
        />
      </div>

      {bundle.news?.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            Company news
          </h2>
          <ul className="flex flex-col gap-3">
            {bundle.news.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-border px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">
                    {item.title}
                  </p>
                  {item.age ? (
                    <span className="text-xs text-muted-foreground">
                      {item.age}
                    </span>
                  ) : null}
                </div>
                {item.summary ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {bundle.about ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">About</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {bundle.about}
          </p>
        </section>
      ) : null}
    </div>
  );
}

export function FinologyPanel({
  bundle,
}: {
  bundle: FinologyBundle | null | undefined;
}) {
  if (!bundle) {
    return (
      <p className="py-8 text-sm text-muted-foreground">No Finology data.</p>
    );
  }
  if (bundle.error && !bundle.essentials?.price && !bundle.finStar) {
    return (
      <p className="py-8 text-sm text-destructive">
        Could not load Finology: {bundle.error}
      </p>
    );
  }

  const e = bundle.essentials || {};
  const finStar = bundle.finStar;
  const horizon = bundle.ratiosHorizon;

  return (
    <div className="flex flex-col gap-8 pt-2">
      <KeyOverview
        url={bundle.url}
        currentPrice={e.price}
        rangeRaw={e.week52}
        items={[
          { label: "Market cap", value: e["Market Cap"] },
          { label: "P/E", value: e["P/E"] },
          { label: "P/B", value: e["P/B"] },
          { label: "ROE", value: e.ROE },
          { label: "ROCE", value: e.ROCE },
          { label: "EPS", value: e["EPS (TTM)"] },
          { label: "Debt", value: e.DEBT },
          { label: "Cash", value: e.CASH },
          { label: "Promoter", value: e["Promoter Holding"] },
          { label: "Div. yield", value: e["Div. Yield"] },
        ]}
      />

      {finStar ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            FinStar (Finology)
          </h2>
          <p className="text-xs text-muted-foreground">
            Analytical rating from Finology — not investment advice.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["ownership", "Ownership"],
                ["valuation", "Valuation"],
                ["efficiency", "Efficiency"],
                ["financials", "Financials"],
              ] as const
            ).map(([key, label]) => {
              const pillar = finStar[key];
              if (!pillar?.rating) return null;
              return (
                <div
                  key={key}
                  className="rounded-xl border border-border px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-sm font-semibold text-primary">
                      {pillar.rating}
                    </p>
                  </div>
                  {pillar.blurb ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {pillar.blurb}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {(bundle.strengths?.length || bundle.limitations?.length) ? (
        <section className="grid gap-6 sm:grid-cols-2">
          {bundle.strengths?.length ? (
            <div>
              <h2 className="mb-2 text-base font-semibold tracking-tight">
                Strengths
              </h2>
              <InsightsList insights={bundle.strengths} />
            </div>
          ) : null}
          {bundle.limitations?.length ? (
            <div>
              <h2 className="mb-2 text-base font-semibold tracking-tight">
                Limitations
              </h2>
              <InsightsList insights={bundle.limitations} />
            </div>
          ) : null}
        </section>
      ) : null}

      {horizon ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            Multi-year ratios
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Sales 1Y", horizon.salesGrowth?.y1],
              ["Sales 3Y", horizon.salesGrowth?.y3],
              ["Sales 5Y", horizon.salesGrowth?.y5],
              ["Profit 1Y", horizon.profitGrowth?.y1],
              ["ROE 1Y", horizon.roe?.y1],
              ["ROE 3Y", horizon.roe?.y3],
              ["ROCE 1Y", horizon.roce?.y1],
              ["D/E", horizon.debtEquity],
              ["Interest cover", horizon.interestCover],
              ["CFO/PAT", horizon.cfoPat],
            ].map(([label, value]) =>
              value ? (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="tabular text-base font-semibold">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        </section>
      ) : null}

      <div className="flex flex-col gap-10">
        <FinancialTable title="Peer comparison" table={bundle.peers} />
        <FinancialTable title="Shareholding / pledging" table={bundle.shareholding} />
        <FinancialTable
          title="Quarterly results"
          subtitle="Figures in ₹ crores"
          table={bundle.quarters}
        />
        <FinancialTable
          title="Profit & loss"
          subtitle="Annual · figures in ₹ crores"
          table={bundle.profitLoss}
        />
        <FinancialTable title="Balance sheet" table={bundle.balanceSheet} />
        <FinancialTable title="Cash flows" table={bundle.cashFlows} />
        <FinancialTable title="Dividends" table={bundle.dividends} />
      </div>

      {bundle.groupCompanies?.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            Group companies
          </h2>
          <ul className="flex flex-wrap gap-2">
            {bundle.groupCompanies.map((g) => (
              <li
                key={g.symbol}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <span className="font-semibold tabular">{g.symbol}</span>
                <span className="ml-2 text-muted-foreground">{g.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
