import {
  FinologyPanel,
  ScanxPanel,
  ScreenerPanel,
} from "@/components/SourcePanel";
import type { CompanyData } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SourcesDrawer({ data }: { data: CompanyData }) {
  const hasFinology = Boolean(data.finology && !data.finology.error);
  const sourceLabel = hasFinology
    ? "Screener · ScanX · Finology"
    : "Screener + ScanX";

  return (
    <details className="group rounded-2xl border border-border bg-card/40 open:bg-card/70">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold tracking-tight marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          Raw sources
          <span className="text-xs font-medium text-muted-foreground group-open:hidden">
            {sourceLabel}
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">
            Hide
          </span>
        </span>
      </summary>
      <div className="border-t border-border px-4 py-4">
        <Tabs defaultValue="screener" className="w-full gap-4">
          <TabsList
            variant="default"
            className="grid h-10 w-full max-w-md grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1"
          >
            <TabsTrigger
              value="screener"
              className="rounded-lg data-active:bg-primary data-active:text-primary-foreground"
            >
              Screener
            </TabsTrigger>
            <TabsTrigger
              value="scanx"
              className="rounded-lg data-active:bg-primary data-active:text-primary-foreground"
            >
              ScanX
            </TabsTrigger>
            <TabsTrigger
              value="finology"
              className="rounded-lg data-active:bg-primary data-active:text-primary-foreground"
            >
              Finology
            </TabsTrigger>
          </TabsList>
          <TabsContent value="screener">
            <ScreenerPanel bundle={data.screener} />
          </TabsContent>
          <TabsContent value="scanx">
            <ScanxPanel bundle={data.scanx} />
          </TabsContent>
          <TabsContent value="finology">
            <FinologyPanel bundle={data.finology} />
          </TabsContent>
        </Tabs>
      </div>
    </details>
  );
}
