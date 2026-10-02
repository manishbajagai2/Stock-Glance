import { Badge } from "@/components/ui/badge";
import { FitMeter } from "@/components/viz";
import { displayValue, type DecisionPayload } from "@/lib/api";

type PriceHeroProps = {
  company: string;
  symbol: string;
  price: string | number | null | undefined;
  fetchedAt?: string;
  suitability?: DecisionPayload["suitability"] | null;
  inPortfolio?: boolean;
  provisional?: boolean;
};

export function PriceHero({
  company,
  symbol,
  price,
  fetchedAt,
  suitability,
  inPortfolio,
  provisional,
}: PriceHeroProps) {
  const when = fetchedAt
    ? new Date(fetchedAt).toLocaleString()
    : "just now";

  return (
    <header className="enter-fade flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
          {company}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {symbol ? (
            <Badge variant="secondary" className="font-medium">
              {symbol}
            </Badge>
          ) : null}
          {inPortfolio ? (
            <Badge variant="outline" className="font-medium text-primary">
              In holdings
            </Badge>
          ) : null}
          {provisional ? (
            <Badge
              variant="outline"
              className="font-medium text-muted-foreground"
            >
              Provisional
            </Badge>
          ) : null}
          <p className="text-xs text-muted-foreground sm:text-sm">
            Fetched {when} · not stored
          </p>
        </div>
        {suitability ? (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:max-w-lg">
            <FitMeter
              kind="swing"
              label={suitability.swing.label}
              score={suitability.swing.score}
            />
            <FitMeter
              kind="long"
              label={suitability.longTerm.label}
              score={suitability.longTerm.score}
            />
          </div>
        ) : null}
        {suitability?.comboNote ? (
          <p className="text-sm text-muted-foreground">{suitability.comboNote}</p>
        ) : null}
      </div>
      <p className="tabular text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
        {displayValue(price)}
      </p>
    </header>
  );
}
