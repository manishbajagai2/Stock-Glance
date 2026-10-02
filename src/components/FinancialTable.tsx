import { cleanLabel, displayValue } from "@/lib/api";
import type { FinancialTable as FinancialTableData } from "@/lib/api";

type FinancialTableProps = {
  title: string;
  subtitle?: string;
  table: FinancialTableData | null | undefined;
};

export function FinancialTable({ title, subtitle, table }: FinancialTableProps) {
  if (!table?.headers?.length || !table.rows?.length) return null;

  const periodHeaders = table.headers.slice(1).map(cleanLabel);
  const metricHeader = cleanLabel(table.headers[0] || "Metric") || "Metric";

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card/50">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/90 px-3 py-2.5 font-semibold backdrop-blur-sm">
                {metricHeader}
              </th>
              {periodHeaders.map((h, i) => (
                <th
                  key={`${h}-${i}`}
                  className="px-3 py-2.5 text-right font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const label = cleanLabel(row.label);
              return (
                <tr
                  key={label}
                  className="border-b border-border/70 last:border-b-0"
                >
                  <th className="sticky left-0 z-10 bg-card/95 px-3 py-2 font-medium backdrop-blur-sm">
                    {label}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={`${label}-${periodHeaders[i] || i}`}
                      className="tabular px-3 py-2 text-right whitespace-nowrap text-foreground/90"
                    >
                      {displayValue(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
