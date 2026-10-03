import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Gauge,
  LibraryBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type HighlightId = "desk" | "holdings" | "sources";

type LandingHighlightsProps = {
  signedIn: boolean;
  signingIn?: boolean;
  onHoldings: () => void;
  onSignIn: () => void;
  className?: string;
};

const HIGHLIGHTS: {
  id: HighlightId;
  label: string;
  icon: typeof Gauge;
  tip: string;
  detail: string;
}[] = [
  {
    id: "desk",
    label: "Decision desk",
    icon: Gauge,
    tip: "Verdict + pillars in one place",
    detail:
      "Open any stock for a composite verdict, forecast, and pillar scores — not a raw data dump.",
  },
  {
    id: "holdings",
    label: "Holdings",
    icon: BriefcaseBusiness,
    tip: "Your private list of positions",
    detail:
      "Save stocks you own privately, then open each one for a full desk analysis.",
  },
  {
    id: "sources",
    label: "Sources",
    icon: LibraryBig,
    tip: "News, fundamentals, and more",
    detail:
      "Desk views pull news, fundamentals, technicals, and macro context behind every call.",
  },
];

export function LandingHighlights({
  signedIn,
  signingIn = false,
  onHoldings,
  onSignIn,
  className,
}: LandingHighlightsProps) {
  const [active, setActive] = useState<HighlightId | null>(null);
  const current = HIGHLIGHTS.find((h) => h.id === active) ?? null;
  const showHoldingsAction = active === "holdings";

  return (
    <section
      className={cn("flex flex-col gap-3 text-left", className)}
      aria-label="What you can do"
      onMouseLeave={() => setActive(null)}
    >
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm",
                    "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive
                      ? "border-primary/40 bg-primary/12 text-foreground shadow-sm"
                      : "border-border/80 bg-card/70 text-muted-foreground hover:border-primary/30 hover:bg-accent/50 hover:text-foreground"
                  )}
                  onMouseEnter={() => setActive(item.id)}
                  onFocus={() => setActive(item.id)}
                  onClick={() => {
                    setActive(item.id);
                    if (item.id === "holdings") {
                      if (signedIn) onHoldings();
                      else onSignIn();
                    }
                  }}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {item.tip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/55 px-4 py-3.5 sm:px-5">
        <p
          className="min-h-[2.75rem] text-sm leading-relaxed text-muted-foreground"
          aria-live="polite"
        >
          {current ? (
            current.detail
          ) : (
            <>
              <span className="text-foreground/85">Hover a capability</span>
              {" for details — or start typing a company above."}
            </>
          )}
        </p>

        {showHoldingsAction ? (
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 font-semibold"
              disabled={signingIn}
              onClick={() => {
                if (signedIn) onHoldings();
                else onSignIn();
              }}
            >
              {signedIn
                ? "Open holdings"
                : signingIn
                  ? "Redirecting…"
                  : "Sign in for holdings"}
              {!signingIn ? <ArrowRight data-icon="inline-end" /> : null}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
