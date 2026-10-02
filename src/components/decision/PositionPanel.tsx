import { useEffect, useMemo, useState } from "react";
import type { DecisionPayload } from "@/lib/api";
import {
  positionAdviceFromDecision,
} from "@/lib/analysis/decision";
import type { PositionAdvice } from "@/lib/analysis/position";
import {
  getPosition,
  removePosition,
  upsertPosition,
} from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PositionPanel({
  decision,
  path,
}: {
  decision: DecisionPayload;
  path: string;
}) {
  const existing = useMemo(
    () => getPosition(decision.symbol),
    [decision.symbol]
  );
  const [avgPrice, setAvgPrice] = useState(
    existing?.avgPrice != null ? String(existing.avgPrice) : ""
  );
  const [quantity, setQuantity] = useState(
    existing?.quantity != null ? String(existing.quantity) : ""
  );
  const [maxRiskPct, setMaxRiskPct] = useState(
    existing?.maxRiskPct != null ? String(existing.maxRiskPct) : "1"
  );
  const [thesisNote, setThesisNote] = useState(existing?.thesisNote || "");
  const [advice, setAdvice] = useState<PositionAdvice | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const pos = getPosition(decision.symbol);
    if (!pos) return;
    setAvgPrice(String(pos.avgPrice));
    setQuantity(String(pos.quantity));
    setMaxRiskPct(String(pos.maxRiskPct ?? 1));
    setThesisNote(pos.thesisNote || "");
  }, [decision.symbol]);

  function runAdvice(persist: boolean) {
    const avg = Number(avgPrice);
    const qty = Number(quantity);
    if (!Number.isFinite(avg) || avg <= 0 || !Number.isFinite(qty) || qty <= 0) {
      setAdvice(null);
      return;
    }
    if (decision.price == null) return;

    const position = {
      avgPrice: avg,
      quantity: qty,
      maxRiskPct: Number(maxRiskPct) || 1,
      thesisNote: thesisNote.trim() || undefined,
    };
    const result = positionAdviceFromDecision(decision, position);
    setAdvice(result);

    if (persist) {
      upsertPosition({
        symbol: decision.symbol,
        path,
        name: decision.company,
        ...position,
        updatedAt: new Date().toISOString(),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight">My position</h3>
        <p className="text-sm text-muted-foreground">
          Enter average & quantity — get add / hold / trim / exit with stops.
          Saved locally on this device only.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Average price (₹)"
          value={avgPrice}
          onChange={setAvgPrice}
          placeholder="e.g. 2450"
        />
        <Field
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          placeholder="e.g. 20"
        />
        <Field
          label="Max risk % of cost"
          value={maxRiskPct}
          onChange={setMaxRiskPct}
          placeholder="1"
        />
        <Field
          label="Thesis note (optional)"
          value={thesisNote}
          onChange={setThesisNote}
          placeholder="Why you own it"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          className="min-h-11"
          onClick={() => runAdvice(true)}
        >
          Advise & save
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-11"
          onClick={() => runAdvice(false)}
        >
          Advise only
        </Button>
        {existing ? (
          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              removePosition(decision.symbol);
              setAdvice(null);
              setAvgPrice("");
              setQuantity("");
            }}
          >
            Remove saved
          </Button>
        ) : null}
        {saved ? (
          <span className="self-center text-sm text-primary">Saved locally</span>
        ) : null}
      </div>

      {advice ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Advice
              </p>
              <p
                className={cn(
                  "text-2xl font-semibold tracking-tight",
                  advice.advice === "add" && "text-primary",
                  advice.advice === "exit" && "text-destructive",
                  advice.advice === "trim" && "text-destructive"
                )}
              >
                {advice.adviceLabel}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="tabular">
                P&amp;L ₹{advice.pnl.toLocaleString("en-IN")} ({advice.pnlPct}%)
              </p>
              <p className="text-muted-foreground">
                Value ₹{advice.marketValue.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-1.5 text-sm">
            {advice.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>

          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <Ticket
              label="Add qty"
              value={advice.addQty != null ? String(advice.addQty) : "—"}
            />
            <Ticket
              label="Trim qty"
              value={advice.trimQty != null ? String(advice.trimQty) : "—"}
            />
            <Ticket
              label="Stop"
              value={
                advice.stopPrice != null
                  ? `₹${advice.stopPrice.toLocaleString("en-IN")}`
                  : "—"
              }
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold">What must be true to add more</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {advice.mustBeTrue.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            {advice.timeStop}
            {advice.rMultiple != null ? ` · R-multiple from avg ≈ ${advice.rMultiple}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11"
      />
    </label>
  );
}

function Ticket({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular font-semibold">{value}</p>
    </div>
  );
}
