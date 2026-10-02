import { cn } from "@/lib/utils";

type Scenario = {
  label: string;
  price: number;
  probability: number;
  note?: string;
};

type ScenarioBarsProps = {
  scenarios: Scenario[];
  className?: string;
};

export function ScenarioBars({ scenarios, className }: ScenarioBarsProps) {
  const maxP = Math.max(...scenarios.map((s) => s.probability), 1);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {scenarios.map((s) => {
        const width = (s.probability / maxP) * 100;
        const tone =
          s.label === "Bear"
            ? "bg-destructive/70"
            : s.label === "Bull"
              ? "bg-primary"
              : "bg-foreground/55";
        return (
          <div key={s.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                {s.label}{" "}
                <span className="tabular text-muted-foreground">
                  {s.probability}%
                </span>
              </span>
              <span className="tabular font-semibold">
                ₹{s.price.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("viz-meter-fill h-full rounded-full", tone)}
                style={{ width: `${width}%` }}
              />
            </div>
            {s.note ? (
              <p className="text-[0.7rem] text-muted-foreground">{s.note}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
