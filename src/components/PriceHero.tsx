import { RefreshCw } from "lucide-react";
import { HorizonSwitch } from "@/components/HorizonSwitch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FitMeter } from "@/components/viz";
import type { Horizon } from "@/lib/analysis/levels";
import { displayValue, type DecisionPayload } from "@/lib/api";
import { cn } from "@/lib/utils";

export type PersistStatus = "idle" | "saving" | "saved" | "failed";

type PriceHeroProps = {
  company: string;
  symbol: string;
  logoUrl?: string | null;
  price: string | number | null | undefined;
  fetchedAt?: string;
  horizon: Horizon;
  onHorizonChange: (next: Horizon) => void;
  suitability?: DecisionPayload["suitability"] | null;
  inPortfolio?: boolean;
  provisional?: boolean;
  persistStatus?: PersistStatus;
  refreshing?: boolean;
  onRefresh?: () => void;
};

function companyMonogram(symbol: string, company: string): string {
  const fromSymbol = symbol.replace(/[^A-Za-z]/g, "").slice(0, 2);
  if (fromSymbol) return fromSymbol.toUpperCase();
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function persistHint(status: PersistStatus, provisional: boolean): string {
  if (provisional) return "Analysis settling";
  if (status === "saving") return "Saving…";
  if (status === "saved") return "Saved";
  if (status === "failed") return "Not saved";
  return "Live quote";
}

export function PriceHero({
  company,
  symbol,
  logoUrl,
  price,
  fetchedAt,
  horizon,
  onHorizonChange,
  suitability,
  inPortfolio,
  provisional,
  persistStatus = "idle",
  refreshing = false,
  onRefresh,
}: PriceHeroProps) {
  const when = fetchedAt
    ? new Date(fetchedAt).toLocaleString()
    : "just now";
  const monogram = companyMonogram(symbol, company);
  const statusText = persistHint(persistStatus, Boolean(provisional));

  return (
    <header className="enter-fade flex flex-col gap-4 border-b border-border pb-4">
      <div className="flex items-start justify-between gap-4 sm:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar
            size="lg"
            className="size-11 rounded-xl after:rounded-xl sm:size-12"
          >
            {logoUrl ? (
              <AvatarImage
                src={logoUrl}
                alt=""
                className="rounded-xl object-contain p-1"
              />
            ) : null}
            <AvatarFallback className="rounded-xl text-sm font-semibold">
              {monogram || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex flex-col gap-1.5">
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
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <p className="text-right text-[0.7rem] leading-snug text-muted-foreground sm:text-xs">
              Live · {when}
              {" · "}
              <span
                className={cn(
                  persistStatus === "failed" && "text-destructive",
                  persistStatus === "saved" && "text-foreground/80"
                )}
              >
                {statusText}
              </span>
            </p>
            {onRefresh ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-7 shrink-0"
                      disabled={refreshing}
                      onClick={onRefresh}
                      aria-label={refreshing ? "Refreshing" : "Refresh quote"}
                    >
                      <RefreshCw
                        className={cn("size-3.5", refreshing && "animate-spin")}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {refreshing ? "Refreshing…" : "Refresh"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          <p className="tabular text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {displayValue(price)}
          </p>
        </div>
      </div>

      <HorizonSwitch value={horizon} onChange={onHorizonChange} />

      {suitability ? (
        <div className="flex flex-col gap-2 sm:max-w-xl sm:flex-row">
          <FitMeter
            kind="long"
            label={suitability.longTerm.label}
            score={suitability.longTerm.score}
            reasons={suitability.longTerm.reasons}
            active={horizon === "long"}
            onSelect={() => onHorizonChange("long")}
          />
          <FitMeter
            kind="swing"
            label={suitability.swing.label}
            score={suitability.swing.score}
            reasons={suitability.swing.reasons}
            active={horizon === "swing"}
            onSelect={() => onHorizonChange("swing")}
          />
        </div>
      ) : null}
    </header>
  );
}
