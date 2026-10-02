import { MetricStrip, type MetricItem } from "@/components/MetricStrip";
import { WeekRangeBar } from "@/components/WeekRangeBar";

function SourceLink({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-medium text-primary hover:underline"
    >
      Open source
    </a>
  );
}

type KeyOverviewProps = {
  url?: string | null;
  items: MetricItem[];
  rangeRaw?: string | number | null;
  currentPrice?: string | number | null;
};

/** Shared top layout for Screener + ScanX tabs. */
export function KeyOverview({
  url,
  items,
  rangeRaw,
  currentPrice,
}: KeyOverviewProps) {
  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Key ratios</h2>
          <SourceLink url={url} />
        </div>
        <MetricStrip columns={3} items={items} />
      </section>

      <WeekRangeBar rangeRaw={rangeRaw} currentPrice={currentPrice} />
    </>
  );
}
