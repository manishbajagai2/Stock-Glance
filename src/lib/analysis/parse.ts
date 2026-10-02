/** Shared numeric / table helpers for the decision engine. */

export function parseNum(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s || s === "—" || s === "-" || /^n\/?a$/i.test(s)) return null;
  const neg = /^\(.*\)$/.test(s) || s.includes("-");
  const n = Number(s.replace(/[(),₹,%\s,Crcr]/g, "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return neg && n > 0 ? -n : n;
}

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mean(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function percentileRank(value: number, peers: number[]): number | null {
  const xs = peers.filter((n) => Number.isFinite(n));
  if (!xs.length || !Number.isFinite(value)) return null;
  const below = xs.filter((n) => n < value).length;
  return (below / xs.length) * 100;
}

export function latestRowValue(
  table: { rows?: { label: string; values: string[] }[] } | null | undefined,
  labelMatch: RegExp
): number | null {
  if (!table?.rows?.length) return null;
  const row = table.rows.find((r) => labelMatch.test(r.label));
  if (!row?.values?.length) return null;
  for (let i = row.values.length - 1; i >= 0; i--) {
    const n = parseNum(row.values[i]);
    if (n != null) return n;
  }
  return null;
}

export function rowSeries(
  table: { rows?: { label: string; values: string[] }[] } | null | undefined,
  labelMatch: RegExp
): number[] {
  if (!table?.rows?.length) return [];
  const row = table.rows.find((r) => labelMatch.test(r.label));
  if (!row) return [];
  return row.values.map(parseNum).filter((n): n is number => n != null);
}

export function yoyGrowth(series: number[]): number | null {
  if (series.length < 2) return null;
  const a = series[series.length - 2];
  const b = series[series.length - 1];
  if (!a || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

export function parseRangePair(
  raw: string | number | null | undefined
): { low: number; high: number } | null {
  if (raw == null || raw === "") return null;
  const nums = String(raw)
    .replace(/,/g, "")
    .match(/(\d+(?:\.\d+)?)/g)
    ?.map(Number)
    .filter((n) => Number.isFinite(n));
  if (!nums || nums.length < 2) return null;
  return { low: Math.min(nums[0], nums[1]), high: Math.max(nums[0], nums[1]) };
}
