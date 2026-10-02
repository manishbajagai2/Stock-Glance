import { useCallback, useEffect, useRef, useState } from "react";
import { CompanyDetails } from "@/components/CompanyDetails";
import { HoldingsPage } from "@/components/HoldingsPage";
import { SearchScreen } from "@/components/SearchScreen";
import {
  fetchCompany,
  type CompanyData,
  type SearchResult,
} from "@/lib/api";
import {
  companyHref,
  isHoldingsPath,
  isSearchPath,
  parseCompanyRoute,
} from "@/lib/routes";

type View = "search" | "details" | "holdings";

function viewFromPath(pathname: string): View {
  if (isHoldingsPath(pathname)) return "holdings";
  if (parseCompanyRoute(pathname)) return "details";
  return "search";
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    viewFromPath(window.location.pathname)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompanyData | null>(null);
  const [loadingName, setLoadingName] = useState("");
  const requestIdRef = useRef(0);
  const activeKeyRef = useRef("");

  const loadCompany = useCallback(async (item: SearchResult) => {
    const route =
      parseCompanyRoute(companyHref(item)) ||
      parseCompanyRoute(
        `/company/${encodeURIComponent(item.symbol || "")}/consolidated`
      );
    if (!route) return;

    const key = route.path;
    activeKeyRef.current = key;
    const reqId = ++requestIdRef.current;

    setView("details");
    setLoading(true);
    setError(null);
    setData(null);
    setLoadingName(item.name || item.symbol || route.symbol);
    document.title = `${item.name || route.symbol} · Stock Glance`;

    try {
      const { status, data: body } = await fetchCompany(
        route.path,
        route.symbol
      );

      if (reqId !== requestIdRef.current || activeKeyRef.current !== key) {
        return;
      }

      if (status >= 400) {
        setError(body.error || "Lookup failed.");
        setLoading(false);
        return;
      }

      setData(body);
      setLoading(false);
      const titleName = body.company || body.symbol || route.symbol;
      document.title = `${titleName} · Stock Glance`;
    } catch {
      if (reqId !== requestIdRef.current || activeKeyRef.current !== key) {
        return;
      }
      setError("Network error while fetching company.");
      setLoading(false);
    }
  }, []);

  const openCompany = useCallback(
    (item: SearchResult) => {
      const href = companyHref(item);
      const next = `${href}?tab=verdict&horizon=long`;
      if (
        window.location.pathname.replace(/\/+$/, "") !== href ||
        !window.location.search.includes("tab=")
      ) {
        window.history.pushState({ view: "details" }, "", next);
      }
      void loadCompany(item);
    },
    [loadCompany]
  );

  const goSearch = useCallback(() => {
    activeKeyRef.current = "";
    requestIdRef.current += 1;
    setView("search");
    setLoading(false);
    setError(null);
    setData(null);
    setLoadingName("");
    document.title = "Stock Glance";
    if (!isSearchPath(window.location.pathname)) {
      window.history.pushState({ view: "search" }, "", "/");
    }
  }, []);

  const goHoldings = useCallback(() => {
    activeKeyRef.current = "";
    requestIdRef.current += 1;
    setView("holdings");
    setLoading(false);
    setError(null);
    setData(null);
    setLoadingName("");
    document.title = "My Holdings · Stock Glance";
    if (!isHoldingsPath(window.location.pathname)) {
      window.history.pushState({ view: "holdings" }, "", "/holdings");
    }
  }, []);

  // Open company or holdings from the current URL (refresh / deep link)
  useEffect(() => {
    if (isHoldingsPath(window.location.pathname)) {
      setView("holdings");
      return;
    }
    const route = parseCompanyRoute(window.location.pathname);
    if (!route) return;
    void loadCompany({
      name: route.symbol,
      symbol: route.symbol,
      path: route.path,
    });
  }, [loadCompany]);

  useEffect(() => {
    const onPopState = () => {
      const next = viewFromPath(window.location.pathname);
      if (next === "details") {
        const route = parseCompanyRoute(window.location.pathname);
        if (route) {
          void loadCompany({
            name: route.symbol,
            symbol: route.symbol,
            path: route.path,
          });
        }
        return;
      }
      activeKeyRef.current = "";
      requestIdRef.current += 1;
      setView(next);
      setLoading(false);
      setError(null);
      setData(null);
      setLoadingName("");
      document.title =
        next === "holdings" ? "My Holdings · Stock Glance" : "Stock Glance";
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadCompany]);

  if (view === "holdings") {
    return (
      <HoldingsPage onHome={goSearch} onOpenCompany={openCompany} />
    );
  }

  if (view === "details") {
    return (
      <CompanyDetails
        loading={loading}
        error={error}
        data={data}
        loadingName={loadingName}
        onBack={goSearch}
        onHoldings={goHoldings}
      />
    );
  }

  return (
    <SearchScreen onPick={openCompany} onHoldings={goHoldings} onHome={goSearch} />
  );
}
