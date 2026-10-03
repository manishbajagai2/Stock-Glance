import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useHoldings, type Holding } from "@/hooks/useHoldings";
import { searchCompanies, type SearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";

function fmtInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

type HoldingsPageProps = {
  onHome: () => void;
  onOpenCompany: (item: SearchResult) => void;
};

export function HoldingsPage({ onHome, onOpenCompany }: HoldingsPageProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const {
    holdings,
    loading,
    error,
    addHolding,
    removeHolding,
    fetchSoftPrices,
  } = useHoldings();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "My Holdings · Stock Glance";
  }, []);

  useEffect(() => {
    if (!holdings.length) {
      setPrices({});
      return;
    }
    let alive = true;
    void fetchSoftPrices(holdings.map((h) => h.symbol)).then((map) => {
      if (alive) setPrices(map);
    });
    return () => {
      alive = false;
    };
  }, [holdings, fetchSoftPrices]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader onBrandClick={onHome} onHoldingsClick={() => {}} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </main>
        <AppFooter onBrandClick={onHome} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader onBrandClick={onHome} onHoldingsClick={() => {}} />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">My Holdings</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with Google to keep a private list of your Indian stock
            holdings.
          </p>
          <Button type="button" onClick={() => void signInWithGoogle().then((r) => {
            if (r.error) window.alert(r.error);
          })}>
            Sign in / Sign up
          </Button>
        </main>
        <AppFooter onBrandClick={onHome} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        onBrandClick={onHome}
        onHoldingsClick={() => {}}
        holdingsActive
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <h1 className="text-2xl font-semibold tracking-tight">
              My Holdings
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Your private list of Indian equities. Tap any row to open its full
              decision desk — forecast, verdict, and sources for that stock.
            </p>
          </div>
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => {
              setActionError(null);
              setAddOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Holding
          </Button>
        </div>

        {error || actionError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError || error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !holdings.length ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-base font-medium">
              Start your personalised holdings space
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Search a ticker, enter quantity and average buy price. Each holding
              opens into a detailed analysis desk so you can review the thesis
              behind positions you already own.
            </p>
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Add Holding
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {holdings.map((h) => (
              <HoldingRow
                key={h.id}
                holding={h}
                spot={prices[h.symbol.toUpperCase()] ?? null}
                confirming={removingId === h.id}
                onConfirmRemove={() => setRemovingId(h.id)}
                onCancelRemove={() => setRemovingId(null)}
                onRemove={async () => {
                  const res = await removeHolding(h.id);
                  setRemovingId(null);
                  if (!res.ok) setActionError(res.error || "Remove failed");
                }}
                onView={() =>
                  onOpenCompany({
                    name: h.stock_name,
                    symbol: h.symbol,
                    path: `/company/${h.symbol}/consolidated/`,
                  })
                }
              />
            ))}
          </ul>
        )}
      </main>

      <AppFooter onBrandClick={onHome} />

      {addOpen ? (
        <AddHoldingDialog
          existingSymbols={holdings.map((h) => h.symbol)}
          onClose={() => setAddOpen(false)}
          onSubmit={async (input) => {
            const res = await addHolding(input);
            if (!res.ok) {
              setActionError(res.error || "Could not add holding");
              return false;
            }
            setAddOpen(false);
            setActionError(null);
            return true;
          }}
        />
      ) : null}
    </div>
  );
}

function HoldingRow({
  holding,
  spot,
  confirming,
  onConfirmRemove,
  onCancelRemove,
  onRemove,
  onView,
}: {
  holding: Holding;
  spot: number | null;
  confirming: boolean;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
  onView: () => void;
}) {
  const invested = holding.quantity * holding.avg_price;
  const pnl =
    spot != null ? spot * holding.quantity - invested : null;
  const pnlPct =
    spot != null && holding.avg_price > 0
      ? ((spot - holding.avg_price) / holding.avg_price) * 100
      : null;

  return (
    <li className="rounded-2xl border border-border bg-card/50 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight">
            {holding.stock_name}
          </p>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {holding.symbol}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onView}>
            <span className="sm:hidden">Analyze</span>
            <span className="hidden sm:inline">Open analysis</span>
          </Button>
          {!confirming ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={onConfirmRemove}
              aria-label={`Remove ${holding.symbol}`}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="Quantity" value={String(holding.quantity)} />
        <Metric label="Avg price" value={fmtInr(holding.avg_price)} />
        <Metric label="Invested" value={fmtInr(invested)} />
        <Metric
          label="Current"
          value={spot != null ? fmtInr(spot) : "—"}
          hint={
            pnl != null && pnlPct != null
              ? `${pnl >= 0 ? "+" : ""}${fmtInr(pnl)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`
              : undefined
          }
          tone={
            pnl == null ? "muted" : pnl >= 0 ? "good" : "bad"
          }
        />
      </div>

      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm">
          <span className="text-destructive">
            Remove {holding.symbol} from holdings?
          </span>
          <Button type="button" size="sm" variant="destructive" onClick={onRemove}>
            Remove
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancelRemove}>
            Cancel
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function Metric({
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
      <p className="mt-0.5 font-semibold tabular tracking-tight">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-xs tabular",
            tone === "good" && "text-primary",
            tone === "bad" && "text-destructive",
            tone === "muted" && "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function AddHoldingDialog({
  existingSymbols,
  onClose,
  onSubmit,
}: {
  existingSymbols: string[];
  onClose: () => void;
  onSubmit: (input: {
    symbol: string;
    stock_name: string;
    quantity: number;
    avg_price: number;
    buy_date?: string | null;
    notes?: string | null;
  }) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [qty, setQty] = useState("");
  const [avg, setAvg] = useState("");
  const [buyDate, setBuyDate] = useState("");
  const [notes, setNotes] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const existing = useMemo(
    () => new Set(existingSymbols.map((s) => s.toUpperCase())),
    [existingSymbols]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    setPicked(null);
    setLocalError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const data = await searchCompanies(trimmed);
          setResults(data.results || []);
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 400);
  }

  async function submit() {
    setLocalError(null);
    if (!picked?.symbol) {
      setLocalError("Pick a stock from search results.");
      return;
    }
    if (existing.has(picked.symbol.toUpperCase())) {
      setLocalError("You already hold this stock. Remove it first to re-add.");
      return;
    }
    const quantity = Number(qty);
    const avg_price = Number(avg);
    if (!(quantity > 0) || !(avg_price > 0)) {
      setLocalError("Quantity and average buy price must be greater than 0.");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      symbol: picked.symbol,
      stock_name: picked.name || picked.symbol,
      quantity,
      avg_price,
      buy_date: buyDate || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!ok) {
      /* parent sets error; keep dialog open */
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-holding-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl">
        <h2 id="add-holding-title" className="text-lg font-semibold tracking-tight">
          Add Holding
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Search NSE/BSE name or ticker · amounts in ₹
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Stock
            <Input
              value={picked ? `${picked.name} (${picked.symbol})` : query}
              placeholder="Search company or ticker…"
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => {
                if (picked) {
                  setQuery(picked.symbol);
                  setPicked(null);
                }
              }}
            />
          </label>
          {!picked && (searching || results.length > 0) ? (
            <ul className="max-h-40 overflow-y-auto rounded-xl border border-border">
              {searching ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Searching…
                </li>
              ) : (
                results.map((r) => (
                  <li key={`${r.symbol}-${r.path}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setPicked(r);
                        setQuery("");
                        setResults([]);
                        if (existing.has((r.symbol || "").toUpperCase())) {
                          setLocalError(
                            "You already hold this stock. Remove it first to re-add."
                          );
                        } else {
                          setLocalError(null);
                        }
                      }}
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="shrink-0 font-semibold text-muted-foreground">
                        {r.symbol}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Quantity
              <Input
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 10"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Avg buy price (₹)
              <Input
                inputMode="decimal"
                value={avg}
                onChange={(e) => setAvg(e.target.value)}
                placeholder="e.g. 2450"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Buy date (optional)
            <Input
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Notes (optional)
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thesis, lot notes…"
            />
          </label>

          {localError ? (
            <p className="text-sm text-destructive">{localError}</p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={saving}>
              {saving ? "Saving…" : "Save holding"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
