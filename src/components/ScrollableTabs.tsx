import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ScrollableTabsProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** Horizontally scrollable tab row with fade + chevron cues when more tabs exist. */
export function ScrollableTabs({
  children,
  className,
  "aria-label": ariaLabel = "Sections",
}: ScrollableTabsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    update();
    const onScroll = () => update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update, children]);

  function scrollByDir(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.55), behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      {canLeft ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-background to-transparent"
          />
          <button
            type="button"
            aria-label="Scroll tabs left"
            onClick={() => scrollByDir(-1)}
            className="absolute top-1/2 left-1 z-[2] flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm backdrop-blur-sm"
          >
            <ChevronLeft className="size-4" />
          </button>
        </>
      ) : null}

      {canRight ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-background to-transparent"
          />
          <button
            type="button"
            aria-label="Scroll tabs right"
            onClick={() => scrollByDir(1)}
            className="absolute top-1/2 right-1 z-[2] flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm backdrop-blur-sm"
          >
            <ChevronRight className="size-4" />
          </button>
        </>
      ) : null}

      <nav
        ref={scrollerRef}
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto px-4 py-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </nav>
    </div>
  );
}
