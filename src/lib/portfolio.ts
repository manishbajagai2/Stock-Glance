import {
  deletePositionRemote,
  fetchRemotePositions,
  syncPositionRemote,
} from "@/lib/persist";

export type StoredPosition = {
  symbol: string;
  path: string;
  name: string;
  avgPrice: number;
  quantity: number;
  maxRiskPct?: number;
  thesisNote?: string;
  updatedAt: string;
};

const KEY = "stock-glance.portfolio.v1";

export function loadPortfolio(): StoredPosition[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPosition[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePortfolio(items: StoredPosition[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function upsertPosition(pos: StoredPosition) {
  const all = loadPortfolio().filter(
    (p) => p.symbol.toUpperCase() !== pos.symbol.toUpperCase()
  );
  all.unshift({ ...pos, symbol: pos.symbol.toUpperCase() });
  savePortfolio(all);
  void syncPositionRemote(pos).catch(() => {});
  return all;
}

export function removePosition(symbol: string) {
  const all = loadPortfolio().filter(
    (p) => p.symbol.toUpperCase() !== symbol.toUpperCase()
  );
  savePortfolio(all);
  void deletePositionRemote(symbol).catch(() => {});
  return all;
}

export function getPosition(symbol: string): StoredPosition | null {
  return (
    loadPortfolio().find(
      (p) => p.symbol.toUpperCase() === symbol.toUpperCase()
    ) || null
  );
}

/** Pull remote positions into localStorage (remote wins on symbol conflict). */
export async function hydratePortfolioFromRemote(): Promise<StoredPosition[]> {
  const remote = await fetchRemotePositions();
  if (!remote.length) return loadPortfolio();
  const local = loadPortfolio();
  const bySym = new Map<string, StoredPosition>();
  for (const p of local) bySym.set(p.symbol.toUpperCase(), p);
  for (const p of remote) {
    const key = p.symbol.toUpperCase();
    const prev = bySym.get(key);
    if (!prev || Date.parse(p.updatedAt) >= Date.parse(prev.updatedAt || 0)) {
      bySym.set(key, p);
    }
  }
  const merged = [...bySym.values()].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
  savePortfolio(merged);
  return merged;
}
