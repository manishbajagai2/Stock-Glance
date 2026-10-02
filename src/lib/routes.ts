import type { SearchResult } from "@/lib/api";
import {
  horizonFromQuery,
  type Horizon,
} from "@/lib/analysis/levels";

export type CompanyRoute = {
  symbol: string;
  path: string;
  href: string;
};

export type DeskTab =
  | "verdict"
  | "forecast"
  | "process"
  | "fundamentals"
  | "technicals"
  | "news"
  | "macro"
  | "position";

const TABS: DeskTab[] = [
  "verdict",
  "forecast",
  "process",
  "fundamentals",
  "technicals",
  "news",
  "macro",
  "position",
];

/** Match Screener-style paths: /company/RELIANCE or /company/RELIANCE/consolidated */
export function parseCompanyRoute(pathname: string): CompanyRoute | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const m = clean.match(
    /^\/company\/([^/]+)(?:\/(consolidated|standalone))?$/i
  );
  if (!m) return null;

  const symbol = decodeURIComponent(m[1]).trim().toUpperCase();
  if (!symbol) return null;

  const mode = (m[2] || "consolidated").toLowerCase();
  const path = `/company/${symbol}/${mode}/`;
  const href = `/company/${encodeURIComponent(symbol)}/${mode}`;

  return { symbol, path, href };
}

export function companyHref(item: SearchResult): string {
  const fromPath = parseCompanyRoute(
    String(item.path || "")
      .replace(/\/+$/, "")
      .replace(/^https?:\/\/[^/]+/i, "")
  );
  if (fromPath) return fromPath.href;

  const symbol = String(item.symbol || "")
    .trim()
    .toUpperCase();
  if (!symbol) return "/";
  return `/company/${encodeURIComponent(symbol)}/consolidated`;
}

export function isSearchPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean === "/" || clean === "";
}

export function parseDeskQuery(search = window.location.search): {
  tab: DeskTab;
  horizon: Horizon;
} {
  const q = new URLSearchParams(search);
  const tabRaw = (q.get("tab") || "verdict").toLowerCase();
  const tab = (TABS.includes(tabRaw as DeskTab) ? tabRaw : "verdict") as DeskTab;
  const horizon = horizonFromQuery(q.get("horizon") || "long");
  return { tab, horizon };
}

export function replaceDeskQuery(next: {
  tab?: DeskTab;
  horizon?: Horizon;
}) {
  const url = new URL(window.location.href);
  const cur = parseDeskQuery(url.search);
  const tab = next.tab ?? cur.tab;
  const horizon = next.horizon ?? cur.horizon;
  url.searchParams.set("tab", tab);
  url.searchParams.set("horizon", horizon);
  window.history.replaceState(
    window.history.state,
    "",
    url.pathname + url.search
  );
}
