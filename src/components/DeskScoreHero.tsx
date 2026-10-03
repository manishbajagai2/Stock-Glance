import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { ScoreRing } from "@/components/viz";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DeskScoreHeroProps = {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  score: number;
  /** Short ring caption (e.g. Confidence). */
  scoreLabel?: string;
  /** One-line meaning under the ring. */
  scoreHint: string;
  /** Longer “how it’s built” for the help tooltip. */
  scoreDetail?: string;
  tone?: "primary" | "danger" | "onColor";
  className?: string;
};

/**
 * Shared desk hero: text + score ring.
 * Mobile stacks ring under copy; desktop keeps them side by side (Verdict pattern).
 */
export function DeskScoreHero({
  eyebrow,
  title,
  subtitle,
  leading,
  score,
  scoreLabel = "Score",
  scoreHint,
  scoreDetail,
  tone = "primary",
  className,
}: DeskScoreHeroProps) {
  const ringTone =
    tone === "onColor"
      ? "onColor"
      : tone === "danger" || score < 40
        ? "danger"
        : "primary";
  const detail = scoreDetail || scoreHint;

  return (
    <div
      className={cn(
        "enter-fade flex flex-col items-stretch gap-4 rounded-2xl border border-border bg-card/60 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-6",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase opacity-90">
            {eyebrow}
          </p>
          <div className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1.5 text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 sm:shrink-0 sm:items-end">
        <ScoreRing
          value={score}
          label={scoreLabel}
          size={112}
          tone={ringTone}
          className="drop-shadow-sm"
        />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex max-w-[11rem] items-start gap-1 text-left text-[0.7rem] leading-snug text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-right"
              >
                <CircleHelp
                  className="mt-0.5 size-3 shrink-0 opacity-70"
                  aria-hidden
                />
                <span>{scoreHint}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[16rem]">
              {detail}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
