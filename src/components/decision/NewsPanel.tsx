import type { DecisionPayload } from "@/lib/api";
import { DeskScoreHero } from "@/components/DeskScoreHero";
import { cn } from "@/lib/utils";

function sentimentLabel(score: number): string {
  if (score >= 60) return "Constructive";
  if (score >= 45) return "Mixed";
  return "Cautious";
}

export function NewsPanel({ decision }: { decision: DecisionPayload }) {
  const s = decision.sentiment;
  const score = Math.round(s.score);

  return (
    <div className="flex flex-col gap-6">
      <DeskScoreHero
        eyebrow="News & sentiment"
        title={sentimentLabel(score)}
        subtitle="Polarity with time decay · analyst skew blended when available"
        score={score}
        scoreLabel="Sentiment"
        scoreHint="News tone after time decay — not a price target"
        scoreDetail="Headline polarity with older news weighted less, blended with analyst skew when available. Higher is more constructive tone."
      />

      {s.redFlags.length ? (
        <ul className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {s.redFlags.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <BulletList title="Positive / catalysts" items={s.drivers} />
        <BulletList title="Negatives" items={s.risks} />
      </div>

      <ul className="flex flex-col gap-2">
        {s.items.length ? (
          s.items.map((item) => (
            <li
              key={`${item.title}-${item.age || ""}`}
              className="rounded-xl border border-border bg-card/50 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{item.title}</p>
                <PolarityBadge polarity={item.polarity} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {tag}
                  </span>
                ))}
                {item.age ? (
                  <span className="text-xs text-muted-foreground">{item.age}</span>
                ) : null}
              </div>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">No headlines scored yet.</li>
        )}
      </ul>
    </div>
  );
}

function PolarityBadge({ polarity }: { polarity: number }) {
  const label =
    polarity >= 0.25 ? "Pos" : polarity <= -0.25 ? "Neg" : "Neu";
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase",
        polarity >= 0.25 && "bg-primary/15 text-primary",
        polarity <= -0.25 && "bg-destructive/15 text-destructive",
        Math.abs(polarity) < 0.25 && "bg-muted text-muted-foreground"
      )}
    >
      {label} {polarity >= 0 ? "+" : ""}
      {polarity.toFixed(2)}
    </span>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="flex flex-col gap-1 text-sm text-foreground/90">
        {items.length ? (
          items.map((i) => <li key={i}>{i}</li>)
        ) : (
          <li className="text-muted-foreground">None.</li>
        )}
      </ul>
    </div>
  );
}
