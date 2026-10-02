import { useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  /** Show brand mark + name (search / holdings). Details often uses its own left cluster. */
  brand?: boolean;
  onBrandClick?: () => void;
  onHoldingsClick?: () => void;
  className?: string;
  leading?: ReactNode;
};

export function AppHeader({
  brand = true,
  onBrandClick,
  onHoldingsClick,
  className,
  leading,
}: AppHeaderProps) {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const avatar =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined);
  const label =
    user?.email ||
    (user?.user_metadata?.full_name as string | undefined) ||
    "Account";

  async function onSignIn() {
    setAuthError(null);
    setSigningIn(true);
    const res = await signInWithGoogle();
    setSigningIn(false);
    if (res.error) setAuthError(res.error);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          {brand ? (
            <button
              type="button"
              onClick={onBrandClick}
              className="flex min-w-0 items-center gap-2 rounded-lg text-left"
            >
              <LogoMark size={28} className="shrink-0 rounded-md" />
              <span className="truncate text-sm font-semibold tracking-tight">
                Stock Glance
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!loading && user ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden text-xs font-semibold sm:inline-flex"
                onClick={onHoldingsClick}
              >
                My Holdings
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="inline-flex text-xs font-semibold sm:hidden"
                onClick={onHoldingsClick}
              >
                Holdings
              </Button>
              <div
                className="flex max-w-[9rem] items-center gap-1.5 truncate rounded-lg border border-border bg-card/60 px-2 py-1 text-xs sm:max-w-[14rem]"
                title={label}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="size-5 shrink-0 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[0.65rem] font-bold text-primary">
                    {label.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden truncate sm:inline">{label}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => void signOut()}
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : !loading ? (
            <Button
              type="button"
              size="sm"
              className="text-xs font-semibold"
              disabled={signingIn}
              onClick={() => void onSignIn()}
            >
              {signingIn ? "Redirecting…" : "Sign in / Sign up"}
            </Button>
          ) : null}
          <ThemeSwitcher />
        </div>
      </div>
      {authError ? (
        <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 sm:px-6">
          <p className="mx-auto max-w-5xl text-xs leading-relaxed text-destructive sm:text-sm">
            {authError}{" "}
            <a
              className="font-semibold underline underline-offset-2"
              href="https://supabase.com/dashboard/project/lsehraixpwfefdweywme/auth/providers"
              target="_blank"
              rel="noreferrer"
            >
              Open Auth providers
            </a>
          </p>
        </div>
      ) : null}
    </header>
  );
}
