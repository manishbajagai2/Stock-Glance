import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { PriceHero } from "@/components/PriceHero";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ForecastPanel } from "@/components/decision/ForecastPanel";
import { FundamentalsPanel } from "@/components/decision/FundamentalsPanel";
import { MacroPanel } from "@/components/decision/MacroPanel";
import { NewsPanel } from "@/components/decision/NewsPanel";
import { PositionPanel } from "@/components/decision/PositionPanel";
import { ProcessPanel } from "@/components/decision/ProcessPanel";
import { SourcesDrawer } from "@/components/decision/SourcesDrawer";
import { TechnicalsPanel } from "@/components/decision/TechnicalsPanel";
import { VerdictPanel } from "@/components/decision/VerdictPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { buildDecision, type Horizon } from "@/lib/analysis/decision";
import {
  fetchMacro,
  fetchNews,
  fetchOhlc,
  type CompanyData,
  type DecisionPayload,
  type OhlcBar,
  type ScoredNewsItem,
} from "@/lib/api";
import { getPosition, hydratePortfolioFromRemote } from "@/lib/portfolio";
import { saveDeskRun } from "@/lib/persist";
import {
  parseDeskQuery,
  replaceDeskQuery,
  type DeskTab,
} from "@/lib/routes";
import { cn } from "@/lib/utils";

const DESK_TABS = [
  ["verdict", "Verdict"],
  ["forecast", "Forecast"],
  ["process", "Process"],
  ["fundamentals", "Fundamentals"],
  ["technicals", "Technicals"],
  ["news", "News"],
  ["macro", "Macro"],
  ["position", "My Position"],
] as const;

type CompanyDetailsProps = {
  loading: boolean;
  error: string | null;
  data: CompanyData | null;
  loadingName: string;
  onBack: () => void;
};

function DetailsSkeleton({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div>
        <p className="mb-3 text-sm text-muted-foreground">
          Building decision desk for <strong>{name}</strong>…
        </p>
        <Skeleton className="mb-2 h-7 w-2/3 max-w-sm" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function CompanyDetails({
  loading,
  error,
  data,
  loadingName,
  onBack,
}: CompanyDetailsProps) {
  const initial = parseDeskQuery();
  const [tab, setTab] = useState<DeskTab>(initial.tab);
  const [horizon, setHorizon] = useState<Horizon>(initial.horizon);
  const [bars, setBars] = useState<OhlcBar[]>([]);
  const [news, setNews] = useState<ScoredNewsItem[] | null>(null);
  const [macroMarkers, setMacroMarkers] = useState<
    DecisionPayload["macro"]["markers"] | null
  >(null);
  const [enriching, setEnriching] = useState(false);
  const lastSavedKeyRef = useRef("");

  const headerPrice =
    data?.screener?.snapshot?.current_price ??
    data?.finology?.essentials?.price ??
    data?.snapshot?.current_price ??
    data?.scanx?.quote?.price;

  const companyPath = data?.symbol
    ? `/company/${data.symbol}/consolidated/`
    : window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;

  const inPortfolio = Boolean(data?.symbol && getPosition(data.symbol));

  useEffect(() => {
    if (!data?.symbol) return;
    const q = parseDeskQuery();
    setTab(q.tab);
    setHorizon(q.horizon);
  }, [data?.symbol]);

  useEffect(() => {
    if (!data?.symbol) return;
    let cancelled = false;
    setEnriching(true);
    setBars([]);
    setNews(null);
    setMacroMarkers(null);
    (async () => {
      const [ohlcRes, newsRes, macroRes] = await Promise.allSettled([
        fetchOhlc(data.symbol || ""),
        fetchNews(data.symbol || "", data.company),
        fetchMacro(data.scanx?.fundamentals?.Sector),
      ]);
      if (cancelled) return;
      if (ohlcRes.status === "fulfilled") setBars(ohlcRes.value.bars || []);
      else setBars([]);
      if (newsRes.status === "fulfilled") setNews(newsRes.value.items || []);
      else setNews([]);
      if (macroRes.status === "fulfilled")
        setMacroMarkers(macroRes.value.markers || {});
      else setMacroMarkers({});
      setEnriching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.symbol, data?.company, data?.scanx?.fundamentals?.Sector]);

  const decision = useMemo(() => {
    if (!data) return null;
    return buildDecision({
      data,
      horizon,
      ohlc: bars,
      news,
      macroMarkers,
      newsLoaded: news != null,
      macroLoaded: macroMarkers != null,
    });
  }, [data, horizon, bars, news, macroMarkers]);

  // Hydrate portfolio from Supabase once per session
  useEffect(() => {
    void hydratePortfolioFromRemote();
  }, []);

  // Persist settled desk runs (forecast + verdict) to Supabase
  useEffect(() => {
    if (!data || !decision || enriching) return;
    if (decision.verdict.provisional) return;
    const key = [
      decision.symbol,
      decision.horizon,
      decision.price,
      decision.forecast.deskForecast,
      decision.forecast.forwardPe,
      decision.verdict.action,
      decision.verdict.composite,
    ].join("|");
    if (key === lastSavedKeyRef.current) return;
    const timer = window.setTimeout(() => {
      void saveDeskRun(decision, data, companyPath).then((res) => {
        if (res.ok) lastSavedKeyRef.current = key;
        else if (res.error) console.warn("[persist] desk run:", res.error);
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [data, decision, enriching, companyPath]);

  function onTabChange(next: string) {
    const t = next as DeskTab;
    setTab(t);
    replaceDeskQuery({ tab: t, horizon });
  }

  function onHorizonChange(next: Horizon) {
    setHorizon(next);
    replaceDeskQuery({ tab, horizon: next });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 shrink-0 gap-1.5"
              onClick={onBack}
            >
              <ArrowLeft data-icon="inline-start" className="size-4" />
              Back
            </Button>
            <LogoMark size={24} className="hidden rounded-md sm:block" />
            {data?.symbol ? (
              <span className="truncate text-sm font-semibold tracking-tight tabular">
                {data.symbol}
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {enriching ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Loading OHLC · news · macro…
                </span>
              ) : null}
              {!loading && !error && data ? (
                <div
                  role="group"
                  aria-label="Analysis horizon"
                  className="hidden grid-cols-2 gap-0.5 rounded-xl border border-border bg-card p-0.5 sm:grid"
                >
                  {(
                    [
                      ["long", "Long"],
                      ["swing", "Swing"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onHorizonChange(value)}
                      className={cn(
                        "min-h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors",
                        horizon === value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <ThemeSwitcher />
            </div>
          </div>

          {!loading && !error && data ? (
            <nav
              aria-label="Desk sections"
              className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 pe-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {DESK_TABS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onTabChange(value)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-tight transition-colors sm:text-sm",
                    tab === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
        {loading ? <DetailsSkeleton name={loadingName} /> : null}

        {!loading && error ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
            <p className="text-lg text-destructive">{error}</p>
            <Button type="button" size="lg" className="min-h-11" onClick={onBack}>
              Back to search
            </Button>
          </div>
        ) : null}

        {!loading && !error && data && decision ? (
          <>
            <div className="flex items-center justify-between gap-3 sm:hidden">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Horizon
              </p>
              <div className="grid grid-cols-2 gap-0.5 rounded-xl border border-border bg-card p-0.5">
                {(
                  [
                    ["long", "Long-term"],
                    ["swing", "Swing"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onHorizonChange(value)}
                    className={cn(
                      "min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors",
                      horizon === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <PriceHero
              company={data.company || data.symbol || "Company"}
              symbol={data.symbol || ""}
              price={headerPrice}
              fetchedAt={data.fetchedAt}
              suitability={decision.suitability}
              inPortfolio={inPortfolio}
              provisional={enriching || decision.verdict.provisional}
            />

            <Tabs value={tab} onValueChange={onTabChange} className="w-full gap-5">
              <TabsContent value="verdict" className="outline-none">
                <VerdictPanel decision={decision} />
              </TabsContent>
              <TabsContent value="forecast" className="outline-none">
                <ForecastPanel decision={decision} />
              </TabsContent>
              <TabsContent value="process" className="outline-none">
                <ProcessPanel decision={decision} />
              </TabsContent>
              <TabsContent value="fundamentals" className="outline-none">
                <FundamentalsPanel decision={decision} data={data} />
              </TabsContent>
              <TabsContent value="technicals" className="outline-none">
                <TechnicalsPanel decision={decision} bars={bars} />
              </TabsContent>
              <TabsContent value="news" className="outline-none">
                <NewsPanel decision={decision} />
              </TabsContent>
              <TabsContent value="macro" className="outline-none">
                <MacroPanel decision={decision} />
              </TabsContent>
              <TabsContent value="position" className="outline-none">
                <PositionPanel decision={decision} path={companyPath} />
              </TabsContent>
            </Tabs>

            <SourcesDrawer data={data} />
          </>
        ) : null}
      </main>
    </div>
  );
}
