import { cleanLabel, displayValue } from "@/lib/api";
import type { FinancialTable as FinancialTableData } from "@/lib/api";
import { cn } from "@/lib/utils";

type FinancialTableProps = {
  title: string;
  subtitle?: string;
  table: FinancialTableData | null | undefined;
};

export function FinancialTable({ title, subtitle, table }: FinancialTableProps) {
  if (!table?.headers?.length || !table.rows?.length) return null;

  const periodHeaders = table.headers.slice(1).map(cleanLabel);
  const metricHeader = cleanLabel(table.headers[0] || "Metric") || "Metric";
  // Wide multi-period tables need horizontal scroll + a pinned label column.
  // Narrow tables (e.g. Period / Value growth) must not pin — sticky covers the values on mobile.
  const needsScroll = periodHeaders.length > 2;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card/50">
        <table
          className={cn(
            "w-full border-separate border-spacing-0 text-left text-sm",
            needsScroll && "min-w-[36rem]"
          )}
        >
          <thead>
            <tr className="bg-muted/40">
              <th
                className={cn(
                  "border-b border-border px-3 py-2.5 font-semibold",
                  needsScroll && "sticky left-0 z-10 bg-muted"
                )}
              >
                {metricHeader}
              </th>
              {periodHeaders.map((h, i) => (
                <th
                  key={`${h}-${i}`}
                  className="border-b border-border px-3 py-2.5 text-right font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => {
              const label = cleanLabel(row.label);
              const isLast = rowIndex === table.rows.length - 1;
              return (
                <tr key={label}>
                  <th
                    className={cn(
                      "px-3 py-2 font-medium",
                      !isLast && "border-b border-border/70",
                      needsScroll && "sticky left-0 z-10 bg-card"
                    )}
                  >
                    {label}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={`${label}-${periodHeaders[i] || i}`}
                      className={cn(
                        "tabular px-3 py-2 text-right whitespace-nowrap text-foreground/90",
                        !isLast && "border-b border-border/70"
                      )}
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
