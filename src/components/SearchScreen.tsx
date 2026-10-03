import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { LandingHighlights } from "@/components/LandingHighlights";
import { LogoMark } from "@/components/LogoMark";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { searchCompanies, type SearchResult } from "@/lib/api";
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
  onHoldings: () => void;
  onHome: () => void;
};

export function SearchScreen({ onPick, onHoldings, onHome }: SearchScreenProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "warn" | "muted" | "ok";
  } | null>(null);

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
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (queryRef.current.trim() !== trimmed) return;
      setSearching(false);
      setHasSearched(true);
      setResults([]);
      setFeedback({
        message: "Search is unavailable right now. Try again shortly.",
        tone: "warn",
      });
    }
  }

  function pick(item: SearchResult) {
    onPick(item);
  }

  function onEnter() {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) return;
    if (results.length && activeIndex >= 0 && results[activeIndex]) {
      pick(results[activeIndex]!);
      return;
    }
    if (searchingRef.current) {
      pendingEnter.current = true;
      return;
    }
    void runSearch(trimmed);
    pendingEnter.current = true;
  }

  useEffect(() => {
    if (!pendingEnter.current || searching) return;
    pendingEnter.current = false;
    if (results.length) {
      pick(results[Math.max(0, activeIndex)]!);
    } else if (hasSearched) {
      setFeedback({ message: noMatchMessage(query), tone: "muted" });
    }
  }, [searching, results, hasSearched]);

  const showDropdown =
    searching ||
    results.length > 0 ||
    (hasSearched && query.trim().length >= MIN_QUERY_LEN);

  async function handleSignIn() {
    setSigningIn(true);
    await signInWithGoogle();
    setSigningIn(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader onBrandClick={onHome} onHoldingsClick={onHoldings} />

      <main className="relative z-[1] flex flex-1 flex-col overflow-x-hidden">
        <div aria-hidden className="landing-orb landing-orb-a" />
        <div aria-hidden className="landing-orb landing-orb-b" />
        <div aria-hidden className="landing-grid" />

        <div
          className={cn(
            "relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-16",
            // Idle: center the hero. Searching: pin to top so results push the footer down.
            showDropdown ? "justify-start pb-10" : "justify-center"
          )}
        >
          <div
            className={cn(
              "enter-fade flex flex-col items-center text-center transition-[margin] duration-200",
              showDropdown ? "mb-4 sm:mb-6" : "mb-8 sm:mb-10"
            )}
          >
            <LogoMark
              size={56}
              className={cn(
                "rounded-2xl shadow-[0_12px_40px_-18px_color-mix(in_oklab,var(--primary)_55%,transparent)] ring-1 ring-border/60",
                showDropdown ? "mb-5 hidden sm:block" : "mb-4 sm:mb-5"
              )}
            />
            <h1
              className={cn(
                "font-display font-semibold tracking-tight transition-all duration-200",
                showDropdown
                  ? "text-xl sm:text-[clamp(2.1rem,7vw,3.35rem)]"
                  : "text-[clamp(2.1rem,7vw,3.35rem)]"
              )}
            >
              Stock Glance
            </h1>
            <p
              className={cn(
                "enter-fade-delay-1 max-w-md text-muted-foreground transition-all duration-200",
                showDropdown
                  ? "mt-1 hidden text-sm sm:mt-3 sm:block sm:text-[1.05rem]"
                  : "mt-2 text-sm sm:mt-3 sm:text-[1.05rem]"
              )}
            >
              India equities. A decision desk — not a dump.
            </p>
          </div>

          <div className="enter-fade-delay-1">
            <div className="relative">
              <label htmlFor="landing-search" className="sr-only">
                Company or ticker
              </label>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-4 z-[1] size-5 -translate-y-1/2 text-muted-foreground sm:left-5"
              />
              <Input
                id="landing-search"
                ref={inputRef}
                type="search"
                name="q"
                value={query}
                maxLength={MAX_QUERY_LEN}
                autoComplete="off"
                spellCheck={false}
                placeholder="Search company or ticker…"
                aria-autocomplete="list"
                aria-expanded={showDropdown}
                aria-controls="search-results"
                className={cn(
                  "h-14 rounded-2xl border-border/90 bg-card/90 pr-5 pl-11 text-base shadow-[0_10px_40px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm",
                  "sm:h-16 sm:rounded-[1.25rem] sm:pl-12 sm:text-lg",
                  "transition-[box-shadow,border-color] duration-300 focus-visible:border-primary/50 focus-visible:shadow-[0_16px_48px_-28px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
                )}
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
            </div>

            {/* In-flow panel (not absolute) so results expand main and keep the footer below */}
            {showDropdown ? (
              <div
                id="search-results"
                role="listbox"
                className="mt-2.5 max-h-[min(22rem,calc(100dvh-11rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl ring-1 ring-foreground/10"
              >
                {searching ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    Searching…
                  </div>
                ) : results.length ? (
                  <ul className="max-h-[min(22rem,calc(100dvh-11rem))] overflow-y-auto overscroll-contain py-1">
                    {results.map((r, i) => (
                      <li key={`${r.symbol}-${r.path}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={i === activeIndex}
                          className={cn(
                            "flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors sm:text-base",
                            i === activeIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted"
                          )}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => pick(r)}
                        >
                          <span className="min-w-0 truncate">{r.name}</span>
                          <span className="shrink-0 text-xs font-semibold text-muted-foreground sm:text-sm">
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
            className="mt-3 min-h-6 text-center text-sm"
            aria-live="polite"
            role="status"
          >
            {feedback ? (
              <p
                className={cn(
                  feedback.tone === "ok" && "text-primary",
                  feedback.tone === "muted" && "text-muted-foreground",
                  feedback.tone === "warn" &&
                    "text-[#8a4b12] dark:text-[#e0a46a]"
                )}
              >
                {feedback.message}
              </p>
            ) : !showDropdown ? (
              <p className="text-xs text-muted-foreground/80">
                Try RELIANCE, TCS, or a company name
              </p>
            ) : null}
          </div>

          {/* Keep highlights out of the way while results are open */}
          <div
            className={cn(
              "transition-[opacity,transform,margin] duration-200",
              showDropdown
                ? "pointer-events-none mt-4 max-h-0 translate-y-1 overflow-hidden opacity-0"
                : "mt-8 opacity-100 sm:mt-10"
            )}
            aria-hidden={showDropdown}
          >
            {!authLoading ? (
              <LandingHighlights
                className="enter-fade-delay-2"
                signedIn={Boolean(user)}
                signingIn={signingIn}
                onHoldings={onHoldings}
                onSignIn={() => void handleSignIn()}
              />
            ) : (
              <div className="h-28" aria-hidden />
            )}
          </div>
        </div>
      </main>

      <AppFooter onBrandClick={onHome} />
    </div>
  );
}
