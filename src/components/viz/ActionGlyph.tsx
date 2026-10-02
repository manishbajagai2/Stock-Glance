import {
  CircleArrowDown,
  CircleArrowUp,
  Clock3,
  Layers,
  Pause,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { VerdictAction } from "@/lib/analysis/verdict";
import { cn } from "@/lib/utils";

const MAP: Record<VerdictAction, LucideIcon> = {
  buy: CircleArrowUp,
  accumulate: Layers,
  wait: Clock3,
  hold: Pause,
  reduce: CircleArrowDown,
  avoid: ShieldAlert,
};

type ActionGlyphProps = {
  action: VerdictAction;
  className?: string;
};

export function ActionGlyph({ action, className }: ActionGlyphProps) {
  const Icon = MAP[action];
  return <Icon className={cn("size-7 shrink-0 sm:size-8", className)} aria-hidden />;
}
