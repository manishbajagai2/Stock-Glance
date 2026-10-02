import { cn } from "@/lib/utils";

type ArcItem = {
  key: string;
  label: string;
  score: number;
  weight: number;
};

type ScoreArcRowProps = {
  items: ArcItem[];
  className?: string;
};

function MiniArc({ score, size = 64 }: { score: number; size?: number }) {
  const v = Math.max(0, Math.min(100, score));
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // show as 270° arc
  const arcLen = c * 0.75;
  const dash = (v / 100) * arcLen;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="viz-ring -rotate-[135deg]"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-muted"
        strokeWidth={stroke}
        strokeDasharray={`${arcLen} ${c}`}
        strokeLinecap="round"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-primary"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ScoreArcRow({ items, className }: ScoreArcRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="flex flex-col items-center gap-1 rounded-xl border border-border/80 bg-card/50 px-2 py-3"
        >
          <div className="relative">
            <MiniArc score={item.score} />
            <span className="tabular absolute inset-0 flex items-center justify-center text-sm font-semibold">
              {Math.round(item.score)}
            </span>
          </div>
          <p className="text-[0.7rem] font-semibold tracking-wide uppercase">
            {item.key}
          </p>
          <p className="text-[0.65rem] text-muted-foreground">
            {item.label} · {(item.weight * 100).toFixed(0)}%
          </p>
        </div>
      ))}
    </div>
  );
}
