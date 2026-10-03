import { useState, type ReactNode } from "react";
import { BriefcaseBusiness, ChevronDown, LogOut } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  /** Show brand mark + name (search / holdings). Details often uses its own left cluster. */
  brand?: boolean;
  onBrandClick?: () => void;
  onHoldingsClick?: () => void;
  /** Highlight the holdings control when that view is active. */
  holdingsActive?: boolean;
  className?: string;
  leading?: ReactNode;
};

export function AppHeader({
  brand = true,
  onBrandClick,
  onHoldingsClick,
  holdingsActive = false,
  className,
  leading,
}: AppHeaderProps) {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const avatar =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    null;
  const email = user?.email || null;
  const label = email || displayName || "Account";
  const initials = (displayName || email || "A")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {leading}
          {brand ? (
            <button
              type="button"
              onClick={onBrandClick}
              className="flex min-w-0 items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-2.5"
            >
              <LogoMark size={28} className="shrink-0 rounded-md sm:size-[30px]" />
              <span className="truncate text-sm font-semibold tracking-tight sm:text-[0.95rem]">
                Stock Glance
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {!loading && user ? (
            <>
              <Button
                type="button"
                variant={holdingsActive ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "gap-1.5 font-semibold",
                  holdingsActive && "ring-1 ring-primary/25"
                )}
                aria-current={holdingsActive ? "page" : undefined}
                onClick={onHoldingsClick}
              >
                <BriefcaseBusiness data-icon="inline-start" />
                <span className="hidden sm:inline">My Holdings</span>
                <span className="sm:hidden">Holdings</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 pl-1 pr-1.5"
                    aria-label="Account menu"
                  >
                    <Avatar size="sm">
                      {avatar ? (
                        <AvatarImage
                          src={avatar}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <AvatarFallback>{initials || "A"}</AvatarFallback>
                    </Avatar>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        {displayName ? (
                          <span className="text-sm font-medium text-foreground">
                            {displayName}
                          </span>
                        ) : null}
                        <span className="truncate text-xs text-muted-foreground">
                          {label}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={onHoldingsClick}
                      className="gap-2"
                    >
                      <BriefcaseBusiness />
                      Open holdings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      className="gap-2"
                      onClick={() => void signOut()}
                    >
                      <LogOut />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : !loading ? (
            <Button
              type="button"
              size="sm"
              className="font-semibold"
              disabled={signingIn}
              onClick={() => void onSignIn()}
            >
              <span className="sm:hidden">
                {signingIn ? "…" : "Sign in"}
              </span>
              <span className="hidden sm:inline">
                {signingIn ? "Redirecting…" : "Sign in / Sign up"}
              </span>
            </Button>
          ) : null}
          <ThemeSwitcher className="scale-90 sm:scale-100" />
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
