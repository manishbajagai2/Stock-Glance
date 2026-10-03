import type { DecisionPayload, OhlcBar } from "@/lib/api";
import { displayValue } from "@/lib/api";
import { DeskScoreHero } from "@/components/DeskScoreHero";
import { LevelsStrip, PriceCanvas } from "@/components/viz";

export function TechnicalsPanel({
  decision,
  bars,
}: {
  decision: DecisionPayload;
  bars: OhlcBar[];
}) {
  const t = decision.technical;
  const levels = decision.verdict.levels;
  const price = decision.price ?? t.lastClose;

  const levelPoints = [
    levels.stop != null
      ? { id: "stop", label: "Stop", value: levels.stop, kind: "stop" as const }
      : null,
    price != null
      ? { id: "spot", label: "Spot", value: price, kind: "spot" as const }
      : null,
    levels.target1 != null
      ? {
          id: "t1",
          label: "T1",
          value: levels.target1,
          kind: "target" as const,
        }
      : null,
    levels.target2 != null
      ? {
          id: "t2",
          label: "T2",
          value: levels.target2,
          kind: "target" as const,
        }
      : null,
  ].filter(Boolean) as {
    id: string;
    label: string;
    value: number;
    kind: "stop" | "spot" | "target";
  }[];

  return (
    <div className="flex flex-col gap-6">
      {!t.available ? (
        <p className="rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          Full OHLC history is thin — range heuristic in play.
        </p>
      ) : null}

      <DeskScoreHero
        eyebrow="Technicals"
        title={<span className="capitalize">{t.regime}</span>}
        subtitle={`RSI ${t.rsi != null ? t.rsi.toFixed(0) : "—"} · ATR ${
          t.atr != null ? t.atr.toFixed(1) : "—"
        }`}
        score={t.score}
        scoreLabel="Strength"
        scoreHint="Trend & momentum quality — not a buy signal alone"
        scoreDetail="From price regime, moving averages, RSI/ATR context, and structure. Higher means technicals are more supportive for the chosen horizon."
      />

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Regime", t.regime],
          ["RSI(14)", t.rsi != null ? t.rsi.toFixed(0) : "—"],
          ["ATR", t.atr != null ? t.atr.toFixed(1) : "—"],
        ].map(([label, val]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-border bg-card/60 px-3 py-3"
          >
            <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
            <p className="tabular mt-1 text-lg font-semibold capitalize">
              {displayValue(val)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["20 DMA", t.sma20],
          ["50 DMA", t.sma50],
          ["200 DMA", t.sma200],
        ].map(([label, val]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-border/80 px-3 py-2"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="tabular text-sm font-semibold">
              {val != null ? `₹${Number(val).toLocaleString("en-IN")}` : "—"}
            </p>
          </div>
        ))}
      </div>

      {bars.length > 2 ? (
        <PriceCanvas
          bars={bars}
          stop={levels.stop}
          target1={levels.target1}
          target2={levels.target2}
          entryLow={levels.entryZone?.low}
          entryHigh={levels.entryZone?.high}
          sma20={t.sma20}
        />
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Trade geography</h3>
        <LevelsStrip
          points={levelPoints}
          entryLow={levels.entryZone?.low}
          entryHigh={levels.entryZone?.high}
        />
        {t.volumeNote ? (
          <p className="text-xs text-muted-foreground">{t.volumeNote}</p>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Technical drivers" items={t.drivers} />
        <List title="Technical risks" items={t.risks} />
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.length ? (
          items.map((i) => (
            <li key={i} className="text-foreground/90">
              {i}
            </li>
          ))
        ) : (
          <li className="text-muted-foreground">None flagged.</li>
        )}
      </ul>
    </div>
  );
}
