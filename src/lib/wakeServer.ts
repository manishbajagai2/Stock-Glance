/** Render free-tier cold starts: wake /api early, share one promise, retry gently. */

export type WakeStatus = "idle" | "waking" | "ready" | "error";

type Listener = (status: WakeStatus, detail: WakeDetail) => void;

export type WakeDetail = {
  status: WakeStatus;
  /** True once wake has been slow enough to show UI (>~1.5s). */
  slow: boolean;
  attempts: number;
  lastError?: string;
};

const SLOW_MS = 1500;
const MAX_WAKE_MS = 90_000;
const KEEPALIVE_MS = 4 * 60 * 1000;

let status: WakeStatus = "idle";
let slow = false;
let attempts = 0;
let lastError: string | undefined;
let wakePromise: Promise<boolean> | null = null;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

function emit() {
  const detail: WakeDetail = { status, slow, attempts, lastError };
  for (const fn of listeners) fn(status, detail);
}

function setStatus(next: WakeStatus, err?: string) {
  status = next;
  if (err !== undefined) lastError = err;
  if (next === "ready") {
    slow = false;
    lastError = undefined;
    if (slowTimer) {
      clearTimeout(slowTimer);
      slowTimer = null;
    }
  }
  emit();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getWakeDetail(): WakeDetail {
  return { status, slow, attempts, lastError };
}

export function subscribeWake(listener: Listener): () => void {
  listeners.add(listener);
  listener(status, getWakeDetail());
  return () => listeners.delete(listener);
}

/**
 * Ping /api/health until the Render service is up (or timeout).
 * Concurrent callers share one in-flight promise.
 */
export function ensureServerAwake(options?: {
  force?: boolean;
}): Promise<boolean> {
  if (!options?.force && status === "ready") {
    return Promise.resolve(true);
  }
  if (!options?.force && wakePromise) return wakePromise;

  if (slowTimer) clearTimeout(slowTimer);
  slow = false;
  attempts = 0;
  setStatus("waking");
  slowTimer = setTimeout(() => {
    if (status === "waking") {
      slow = true;
      emit();
    }
  }, SLOW_MS);

  wakePromise = (async () => {
    const started = Date.now();
    let delay = 600;
    while (Date.now() - started < MAX_WAKE_MS) {
      attempts += 1;
      emit();
      try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 12_000);
        const res = await fetch("/api/health", {
          signal: ctrl.signal,
          cache: "no-store",
        });
        window.clearTimeout(t);
        if (res.ok) {
          setStatus("ready");
          return true;
        }
        lastError = `Health ${res.status}`;
      } catch (err) {
        lastError = (err as Error)?.name === "AbortError"
          ? "Still starting…"
          : "Waiting for server…";
      }
      emit();
      await sleep(delay);
      delay = Math.min(Math.round(delay * 1.35), 3500);
    }
    setStatus("error", "Server took too long to wake. Try refreshing.");
    wakePromise = null;
    return false;
  })();

  return wakePromise;
}

/** While the tab is open, nudge the free tier so it is less likely to sleep mid-session. */
export function startWakeKeepalive() {
  if (typeof window === "undefined" || keepaliveTimer) return;

  const tick = () => {
    if (document.visibilityState !== "visible") return;
    void ensureServerAwake();
  };

  keepaliveTimer = window.setInterval(tick, KEEPALIVE_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void ensureServerAwake({ force: status !== "ready" });
    }
  });
}

/**
 * fetch() that waits for wake, then retries once on network failure (cold start race).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const awake = await ensureServerAwake();
  if (!awake && status === "error") {
    throw new Error(lastError || "Server is unavailable");
  }

  try {
    return await fetch(input, init);
  } catch (err) {
    // Likely raced a spin-down or first packet during boot — force re-wake and retry once.
    const again = await ensureServerAwake({ force: true });
    if (!again) throw err;
    return await fetch(input, init);
  }
}
