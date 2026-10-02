import { cn } from "@/lib/utils";

type ScoreRingProps = {
  value: number;
  label?: string;
  size?: number;
  className?: string;
  tone?: "primary" | "muted" | "danger" | "onColor";
};

export function ScoreRing({
  value,
  label,
  size = 120,
  className,
  tone = "primary",
}: ScoreRingProps) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = Math.max(10, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  const strokeClass =
    tone === "danger"
      ? "stroke-destructive"
      : tone === "muted"
        ? "stroke-muted-foreground"
        : tone === "onColor"
          ? "stroke-current"
          : "stroke-primary";
  const trackClass =
    tone === "onColor"
      ? "stroke-current opacity-25"
      : "stroke-foreground/15 dark:stroke-foreground/20";
  const valueClass =
    tone === "onColor" ? "text-current" : "text-foreground";
  const labelClass =
    tone === "onColor"
      ? "text-current opacity-90"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        tone === "onColor" && "text-inherit",
        className
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${label} ${Math.round(v)}` : `Score ${Math.round(v)}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="viz-ring -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={trackClass}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={strokeClass}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${Math.max(c - dash, 0)}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={cn(
            "tabular font-semibold tracking-tight",
            valueClass
          )}
          style={{ fontSize: Math.round(size * 0.28) }}
        >
          {Math.round(v)}
        </span>
        {label ? (
          <span
            className={cn(
              "mt-0.5 max-w-[6rem] text-[0.65rem] font-semibold tracking-[0.08em] uppercase",
              labelClass
            )}
          >
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
