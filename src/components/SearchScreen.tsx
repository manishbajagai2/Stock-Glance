import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Input } from "@/components/ui/input";
import { searchCompanies, type SearchResult } from "@/lib/api";
import { loadPortfolio, type StoredPosition } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 550;
const MIN_QUERY_LEN = 1;
const MAX_QUERY_LEN = 48;
const DISPLAY_QUERY_LEN = 28;

function clampQuery(raw: string): string {
  return String(raw || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, MAX_QUERY_LEN);
}

function displayQuery(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.length <= DISPLAY_QUERY_LEN) return t;
  return `${t.slice(0, DISPLAY_QUERY_LEN - 1)}…`;
}

function noMatchMessage(query: string): string {
  const shown = displayQuery(query);
  if (!shown) return "No close matches. Try another spelling or ticker.";
  return `No close matches for “${shown}”. Try another spelling, or a ticker like RELIANCE / TCS.`;
}

type SearchScreenProps = {
  onPick: (item: SearchResult) => void;
};

export function SearchScreen({ onPick }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "warn" | "muted" | "ok";
  } | null>(null);
  const [owned, setOwned] = useState<StoredPosition[]>([]);

  const lastQuerySent = useRef("");
  const queryRef = useRef(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingEnter = useRef(false);
  const searchingRef = useRef(false);

  queryRef.current = query;
  searchingRef.current = searching;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setOwned(loadPortfolio());
    const onFocus = () => setOwned(loadPortfolio());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setResults([]);
      setActiveIndex(-1);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    if (trimmed === lastQuerySent.current && !searchingRef.current) {
      return;
    }
    lastQuerySent.current = trimmed;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setHasSearched(false);
    setFeedback(null);

    try {
      const data = await searchCompanies(trimmed, controller.signal);
      if (queryRef.current.trim() !== trimmed) return;
      setResults(data.results || []);
      setActiveIndex(data.results?.length ? 0 : -1);
      setHasSearched(true);
      setSearching(false);
      if (!data.results?.length) {
        setFeedback({ message: noMatchMessage(trimmed), tone: "muted" });
      } else {
        setFeedback({
          message:
            "Press Enter to open the highlighted company, or click one.",
          tone: "ok",
        });
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setSearching(false);
      setHasSearched(true);
      setResults([]);
      setActiveIndex(-1);
      setFeedback({
        message: "Search failed. Please try again in a moment.",
        tone: "warn",
      });
    }
  }

  function pick(item: SearchResult | undefined) {
    if (!item?.path) return;
    setQuery(item.name);
    lastQuerySent.current = item.name;
    setFeedback(null);
    onPick(item);
  }

  function onEnter() {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LEN) {
      setFeedback({
        message:
          "Type a company name, then pick a suggestion (or press Enter).",
        tone: "warn",
      });
      return;
    }

    if (searching || debounceRef.current) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setFeedback({ message: "Searching… one moment.", tone: "muted" });
      pendingEnter.current = true;
      void runSearch(trimmed);
      return;
    }

    if (results.length) {
      pick(results[Math.max(0, activeIndex)]);
      return;
    }

    if (hasSearched) {
      setFeedback({ message: noMatchMessage(trimmed), tone: "warn" });
      return;
    }

    setFeedback({
      message: "Wait for suggestions to appear, then press Enter.",
      tone: "muted",
    });
    pendingEnter.current = true;
    void runSearch(trimmed);
  }

  useEffect(() => {
    if (!pendingEnter.current || searching) return;
    pendingEnter.current = false;
    if (results.length) {
      pick(results[Math.max(0, activeIndex)]);
    } else if (hasSearched) {
      setFeedback({ message: noMatchMessage(query), tone: "warn" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, results, hasSearched]);

  const showDropdown =
    searching ||
    results.length > 0 ||
    (hasSearched && query.trim().length >= MIN_QUERY_LEN);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <LogoMark size={28} className="rounded-md" />
            <span className="text-sm font-semibold tracking-tight">
              Stock Glance
            </span>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl text-center">
        <div className="mb-8 flex flex-col items-center gap-3">
          <LogoMark size={56} className="rounded-xl shadow-sm" />
          <h1 className="text-[clamp(2rem,6vw,2.75rem)] font-semibold tracking-tight">
            Stock Glance
          </h1>
          <p className="text-base text-muted-foreground sm:text-[1.05rem]">
            Search any Indian stock. Get a decision desk — not just a dump.
          </p>
        </div>

        <div className="relative text-left">
          <Input
            ref={inputRef}
            type="search"
            value={query}
            maxLength={MAX_QUERY_LEN}
            autoComplete="off"
            spellCheck={false}
            placeholder="Company or ticker…"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls="search-results"
            className="h-14 rounded-full border-border bg-card px-5 text-base shadow-sm sm:h-16 sm:text-lg"
            onChange={(e) => {
              const clamped = clampQuery(e.target.value);
              setQuery(clamped);
              setFeedback(null);

              if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
              }

              if (clamped.trim().length < MIN_QUERY_LEN) {
                abortRef.current?.abort();
                lastQuerySent.current = "";
                setResults([]);
                setActiveIndex(-1);
                setHasSearched(false);
                setSearching(false);
                return;
              }

              debounceRef.current = setTimeout(() => {
                debounceRef.current = null;
                void runSearch(clamped);
              }, DEBOUNCE_MS);
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = clampQuery(e.clipboardData.getData("text"));
              const el = e.currentTarget;
              const start = el.selectionStart ?? query.length;
              const end = el.selectionEnd ?? query.length;
              const next = clampQuery(
                query.slice(0, start) + pasted + query.slice(end)
              );
              setQuery(next);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                debounceRef.current = null;
                void runSearch(next);
              }, DEBOUNCE_MS);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
                return;
              }
              if (!results.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % results.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex(
                  (i) => (i - 1 + results.length) % results.length
                );
              } else if (e.key === "Escape") {
                setResults([]);
                setHasSearched(false);
              }
            }}
          />

          {showDropdown ? (
            <div
              id="search-results"
              role="listbox"
              className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
            >
              {searching ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Searching…
                </div>
              ) : results.length ? (
                <ul className="max-h-72 overflow-y-auto py-1">
                  {results.map((r, i) => (
                    <li key={`${r.symbol}-${r.path}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === activeIndex}
                        className={cn(
                          "flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-base",
                          i === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                        )}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => pick(r)}
                      >
                        <span className="min-w-0 truncate">{r.name}</span>
                        <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                          {r.symbol}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {noMatchMessage(query)}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div
          className="mt-4 min-h-12 text-sm"
          aria-live="polite"
          role="status"
        >
          {feedback ? (
            <p
              className={cn(
                feedback.tone === "ok" && "text-primary",
                feedback.tone === "muted" && "text-muted-foreground",
                feedback.tone === "warn" && "text-[#8a4b12]"
              )}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>

        {owned.length ? (
          <section className="mt-8 text-left">
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Positions on this device
            </h2>
            <ul className="flex flex-col gap-2">
              {owned.map((p) => (
                <li key={p.symbol}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                    onClick={() =>
                      onPick({
                        name: p.name,
                        symbol: p.symbol,
                        path: p.path || `/company/${p.symbol}/consolidated/`,
                      })
                    }
                  >
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                    <span className="shrink-0 tabular text-sm text-muted-foreground">
                      {p.quantity} @ ₹{p.avgPrice.toLocaleString("en-IN")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
    </div>
  );
}
