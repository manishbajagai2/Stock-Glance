type InsightsListProps = {
  insights: string[];
};

export function InsightsList({ insights }: InsightsListProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold tracking-tight">In plain words</h2>
      {insights.length === 0 ? (
        <p className="text-muted-foreground">
          No extra notes came back for this company.
        </p>
      ) : (
        <ol className="flex max-w-2xl flex-col gap-3">
          {insights.slice(0, 5).map((text, i) => (
            <li
              key={`${i}-${text.slice(0, 24)}`}
              className="border-l-2 border-primary/40 pl-4 text-base leading-relaxed"
            >
              {text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
