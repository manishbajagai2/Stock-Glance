import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type Holding = {
  id: string;
  user_id: string;
  symbol: string;
  stock_name: string;
  quantity: number;
  avg_price: number;
  buy_date: string | null;
  notes: string | null;
  created_at: string;
};

export type AddHoldingInput = {
  symbol: string;
  stock_name: string;
  quantity: number;
  avg_price: number;
  buy_date?: string | null;
  notes?: string | null;
};

export function useHoldings() {
  const { user, loading: authLoading } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setHoldings([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await getSupabase()
      .from("holdings")
      .select("*")
      .order("created_at", { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setHoldings([]);
    } else {
      setHoldings(
        (data || []).map((row) => ({
          ...row,
          quantity: Number(row.quantity),
          avg_price: Number(row.avg_price),
        })) as Holding[]
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const addHolding = useCallback(
    async (input: AddHoldingInput): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: "Sign in to add a holding." };
      const symbol = input.symbol.trim().toUpperCase();
      const { error: insErr } = await getSupabase().from("holdings").insert({
        symbol,
        stock_name: input.stock_name.trim() || symbol,
        quantity: input.quantity,
        avg_price: input.avg_price,
        buy_date: input.buy_date || null,
        notes: input.notes?.trim() || null,
        user_id: user.id,
      });
      if (insErr) {
        if (
          insErr.code === "23505" ||
          /duplicate|unique/i.test(insErr.message)
        ) {
          return {
            ok: false,
            error: "You already hold this stock. Remove it first to re-add.",
          };
        }
        return { ok: false, error: insErr.message };
      }
      await refresh();
      return { ok: true };
    },
    [user, refresh]
  );

  const removeHolding = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: "Sign in to remove a holding." };
      const { error: delErr } = await getSupabase()
        .from("holdings")
        .delete()
        .eq("id", id);
      if (delErr) return { ok: false, error: delErr.message };
      await refresh();
      return { ok: true };
    },
    [user, refresh]
  );

  const getBySymbol = useCallback(
    (symbol: string): Holding | null => {
      const key = symbol.trim().toUpperCase();
      return holdings.find((h) => h.symbol.toUpperCase() === key) || null;
    },
    [holdings]
  );

  /** Soft spot prices from latest desk runs (no scrape). */
  const fetchSoftPrices = useCallback(
    async (symbols: string[]): Promise<Record<string, number>> => {
      if (!symbols.length || !isSupabaseConfigured()) return {};
      const uniq = [...new Set(symbols.map((s) => s.toUpperCase()))];
      const { data, error: qErr } = await getSupabase()
        .from("latest_desk_runs")
        .select("symbol, spot_price")
        .in("symbol", uniq);
      if (qErr || !data) return {};
      const map: Record<string, number> = {};
      for (const row of data) {
        const n = Number(row.spot_price);
        if (row.symbol && Number.isFinite(n) && n > 0) {
          map[String(row.symbol).toUpperCase()] = n;
        }
      }
      return map;
    },
    []
  );

  return {
    holdings,
    loading: authLoading || loading,
    error,
    refresh,
    addHolding,
    removeHolding,
    getBySymbol,
    fetchSoftPrices,
  };
}
