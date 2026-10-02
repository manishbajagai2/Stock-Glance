import type { MacroMarkers } from "@/lib/api";
import { clamp } from "./parse";
import type { SectorId } from "./sectorModels";

export type MacroResult = {
  score: number;
  stance: "supportive" | "neutral" | "headwind";
  bullets: string[];
  markers: MacroMarkers;
};

type Sensitivity = {
  rates: number; // +1 benefits from higher rates, -1 hurt
  oil: number;
  usdinr: number; // +1 benefits from INR weakness (higher USDINR)
  riskOn: number;
};

const MATRIX: Record<SectorId, Sensitivity> = {
  banks: { rates: 0.35, oil: -0.1, usdinr: -0.15, riskOn: 0.4 },
  it: { rates: -0.2, oil: -0.05, usdinr: 0.55, riskOn: 0.35 },
  consumer: { rates: -0.35, oil: -0.2, usdinr: -0.25, riskOn: 0.3 },
  energy: { rates: -0.1, oil: 0.45, usdinr: -0.2, riskOn: 0.2 },
  capital_goods: { rates: -0.4, oil: -0.15, usdinr: -0.1, riskOn: 0.45 },
  pharma: { rates: -0.15, oil: -0.05, usdinr: 0.25, riskOn: 0.2 },
  generic: { rates: -0.2, oil: -0.1, usdinr: 0, riskOn: 0.3 },
};

/** Normalize markers into z-ish tilts in [-1,1] vs calm midpoints. */
function tilts(m: MacroMarkers) {
  const rates =
    m.india10y == null ? 0 : clamp((m.india10y - 7) / 1.5, -1, 1);
  const oil = m.brent == null ? 0 : clamp((m.brent - 75) / 25, -1, 1);
  const usdinr = m.usdinr == null ? 0 : clamp((m.usdinr - 84) / 4, -1, 1);
  const riskOn =
    m.niftyChangePct == null ? 0 : clamp(m.niftyChangePct / 1.5, -1, 1);
  return { rates, oil, usdinr, riskOn };
}

export function scoreMacro(
  sectorId: SectorId,
  markers: MacroMarkers | null | undefined
): MacroResult {
  const m: MacroMarkers = markers || {};
  const sens = MATRIX[sectorId] || MATRIX.generic;
  const t = tilts(m);

  // Positive contribution when marker tilt aligns with sector sensitivity
  const contrib =
    sens.rates * -t.rates + // higher rates → negative if sens.rates is how much hurt... wait
    // Define: score boost = -sens.hurt. Better: sens.rates > 0 means likes higher rates
    0;

  // Recalculate properly:
  // impact = sum(sens[k] * tilt[k]) where tilt positive = higher rates/oil/usdinr/riskOn
  const impact =
    sens.rates * t.rates +
    sens.oil * t.oil +
    sens.usdinr * t.usdinr +
    sens.riskOn * t.riskOn;

  void contrib;
  const score = clamp(50 + impact * 35);

  const bullets: string[] = [];
  if (m.india10y != null) {
    bullets.push(
      `India 10Y ~${m.india10y.toFixed(2)}% — ${
        t.rates > 0.25 ? "elevated yields" : t.rates < -0.25 ? "softer yields" : "yields near mid"
      }`
    );
  }
  if (m.usdinr != null) {
    bullets.push(
      `USDINR ~${m.usdinr.toFixed(2)} — ${
        sectorId === "it"
          ? t.usdinr > 0
            ? "INR soft is a typical IT translation tailwind"
            : "stronger INR can pressure IT USD revenue translation"
          : t.usdinr > 0.3
            ? "INR weakness can pressure import-heavy cost lines"
            : "INR relatively steady"
      }`
    );
  }
  if (m.brent != null) {
    bullets.push(
      `Brent ~$${m.brent.toFixed(1)} — ${
        sectorId === "energy"
          ? "directly tied to energy/commodity cycle"
          : t.oil > 0.3
            ? "firmer crude is a mild cost/margin headwind for many non-energy names"
            : "crude not screaming stress"
      }`
    );
  }
  if (m.niftyChangePct != null) {
    bullets.push(
      `Nifty session/proxy ${m.niftyChangePct >= 0 ? "+" : ""}${m.niftyChangePct.toFixed(2)}% — risk ${
        t.riskOn >= 0 ? "on" : "off"
      } tone`
    );
  }
  if (!bullets.length) {
    bullets.push("Macro markers unavailable — stance treated as neutral");
  }

  const stance: MacroResult["stance"] =
    score >= 58 ? "supportive" : score <= 42 ? "headwind" : "neutral";

  // Sector-specific extra bullet
  if (sectorId === "banks" && t.rates > 0.2) {
    bullets.push("Higher yields: watch NIM vs credit growth trade-off for banks/NBFCs");
  }
  if (sectorId === "capital_goods" && t.rates > 0.2) {
    bullets.push("Higher rates can slow project financing — patience on infra multiples");
  }

  return {
    score,
    stance,
    bullets: bullets.slice(0, 4),
    markers: m,
  };
}
