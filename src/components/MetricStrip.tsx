import { displayValue } from "@/lib/api";
import { cn } from "@/lib/utils";

export type MetricItem = {
  label: string;
  value: string | number | null | undefined;
};

type MetricStripProps = {
  items: MetricItem[];
  columns?: 2 | 3;
  className?: string;
};

export function MetricStrip({ items, columns = 3, className }: MetricStripProps) {
  return (
    <dl
      className={cn(
        "grid gap-x-0 gap-y-5",
        columns === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2",
        className
      )}
    >
      {items.map((item, index) => {
        const isFirstInRow =
          columns === 3 ? index % 3 === 0 : index % 2 === 0;
        return (
          <div
            key={`${item.label}-${index}`}
            className={cn(
              "flex flex-col gap-1 border-b border-border pb-3 sm:border-b-0 sm:pb-0",
              !isFirstInRow && "sm:border-l sm:border-border sm:pl-5",
              isFirstInRow && "sm:pl-0"
            )}
          >
            <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {item.label}
            </dt>
            <dd className="tabular text-xl font-semibold tracking-tight sm:text-2xl">
              {displayValue(item.value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
