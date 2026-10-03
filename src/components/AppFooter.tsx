import { LogoMark } from "@/components/LogoMark";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AppFooterProps = {
  className?: string;
  onBrandClick?: () => void;
};

export function AppFooter({ className, onBrandClick }: AppFooterProps) {
  return (
    <footer
      className={cn(
        "relative z-0 mt-auto border-t border-border/70 bg-background/90 backdrop-blur-sm",
        className
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <button
            type="button"
            onClick={onBrandClick}
            className="flex w-fit items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogoMark size={26} className="rounded-md" />
            <span className="text-sm font-semibold tracking-tight">
              Stock Glance
            </span>
          </button>

          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
          >
            <a
              href="/privacy.html"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="/terms.html"
              className="transition-colors hover:text-foreground"
            >
              Terms
            </a>
            <a
              href="mailto:manish@altcase.com"
              className="transition-colors hover:text-foreground"
            >
              Contact
            </a>
          </nav>
        </div>

        <Separator className="opacity-60" />

        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Personal India-equity research desk. Not investment advice.</p>
          <p>© {new Date().getFullYear()} Stock Glance</p>
        </div>
      </div>
    </footer>
  );
}
