import { useServerWake } from "@/hooks/useServerWake";
import { cn } from "@/lib/utils";

/** Compact banner while Render free tier is cold-starting. */
export function ServerWakeBanner({ className }: { className?: string }) {
  const { status, slow, attempts, lastError } = useServerWake();

  if (status === "ready" || status === "idle") return null;
  if (status === "waking" && !slow) return null;

  const waking = status === "waking";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-b px-4 py-2 text-center text-xs sm:text-sm",
        waking
          ? "border-primary/25 bg-primary/10 text-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive",
        className
      )}
    >
      {waking ? (
        <p>
          Waking the desk
          <span className="wake-dots" aria-hidden>
            …
          </span>
          <span className="text-muted-foreground">
            {" "}
            (free host sleep · usually 20–50s
            {attempts > 1 ? ` · try ${attempts}` : ""})
          </span>
        </p>
      ) : (
        <p>
          {lastError || "Server unavailable."}{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </p>
      )}
    </div>
  );
}
