import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyTheme,
  readThemeMode,
  setThemeMode,
  subscribeSystemTheme,
  type ThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());

  useEffect(() => {
    applyTheme(mode);
    if (mode !== "system") return;
    return subscribeSystemTheme(() => applyTheme("system"));
  }, [mode]);

  function onSelect(next: ThemeMode) {
    setMode(next);
    setThemeMode(next);
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-border bg-card p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={mode === value}
          onClick={() => onSelect(value)}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
