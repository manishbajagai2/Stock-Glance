import type { CompanyData, FinancialTable } from "@/lib/api";
import { clamp, latestRowValue, parseNum, percentileRank, rowSeries, yoyGrowth } from "./parse";

export type ChecklistStatus = "pass" | "warn" | "fail";

export type ChecklistItem = {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
};

export type SectorId =
  | "banks"
  | "it"
  | "consumer"
  | "energy"
  | "capital_goods"
  | "pharma"
  | "generic";

export type SectorModelResult = {
  sectorId: SectorId;
  sectorLabel: string;
  sectorFit: number;
  checklist: ChecklistItem[];
  peerPercentile: number | null;
  narrativeHooks: string[];
  metrics: Record<string, number | null>;
};

function detectSector(data: CompanyData): { id: SectorId; label: string } {
  const f = data.scanx?.fundamentals || {};
  const finSector = data.finology?.essentials?.sector || "";
  const blob = `${f.Sector || ""} ${f.Industry || ""} ${finSector} ${data.company || ""}`.toLowerCase();

  if (/bank|nbfc|finance|housing finance|financial services/.test(blob))
    return { id: "banks", label: "Banks / NBFC" };
  if (/information technology|software|it -|it services|computers/.test(blob))
    return { id: "it", label: "IT / Software" };
  if (/fmcg|consumer|food|beverage|personal care|retail|apparel/.test(blob))
    return { id: "consumer", label: "Consumer / FMCG" };
  if (/oil|gas|petroleum|refiner|metal|mining|steel|commodity|power|mining/.test(blob))
    return { id: "energy", label: "Energy / Commodity" };
  if (/capital goods|engineering|infrastructure|construction|industrial|conglomerate/.test(blob))
    return { id: "capital_goods", label: "Capital goods / Infra" };
  if (/pharma|healthcare|hospital|biotech|drug/.test(blob))
    return { id: "pharma", label: "Pharma / Healthcare" };
  return { id: "generic", label: f.Sector || f.Industry || finSector || "General" };
}

function snap(data: CompanyData) {
  return data.screener?.snapshot || data.snapshot || {};
}

function peOf(data: CompanyData): number | null {
  return (
    parseNum(snap(data).pe) ??
    parseNum(data.finology?.essentials?.["P/E"]) ??
    parseNum(data.scanx?.quote?.pe) ??
    parseNum(data.scanx?.fundamentals?.["PE Ratio"])
  );
}

function roeOf(data: CompanyData): number | null {
  return (
    parseNum(snap(data).roe) ??
    parseNum(data.finology?.essentials?.ROE) ??
    parseNum(data.scanx?.fundamentals?.["Return on Equity"])
  );
}

function roceOf(data: CompanyData): number | null {
  return (
    parseNum(snap(data).roce) ?? parseNum(data.finology?.essentials?.ROCE)
  );
}

function peerColumn(
  peers: FinancialTable | null | undefined,
  headerMatch: RegExp
): { self: number | null; others: number[] } {
  if (!peers?.headers?.length || !peers.rows?.length)
    return { self: null, others: [] };
  const idx = peers.headers.findIndex((h, i) => i > 0 && headerMatch.test(h));
  if (idx < 0) return { self: null, others: [] };
  const values = peers.rows
    .map((r) => parseNum(r.values[idx - 1]))
    .filter((n): n is number => n != null);
  // First peer row is often the company itself on Screener
  const self = values[0] ?? null;
  const others = values.slice(1);
  return { self, others: others.length ? others : values };
}

function item(
  id: string,
  label: string,
  status: ChecklistStatus,
  detail: string
): ChecklistItem {
  return { id, label, status, detail };
}

function scoreChecklist(list: ChecklistItem[]): number {
  if (!list.length) return 50;
  const pts = list.map((c) =>
    c.status === "pass" ? 100 : c.status === "warn" ? 55 : 15
  );
  return clamp(pts.reduce((a, b) => a + b, 0) / pts.length);
}

export function runSectorModel(data: CompanyData): SectorModelResult {
  const { id, label } = detectSector(data);
  const pe = peOf(data);
  const roe = roeOf(data);
  const roce = roceOf(data);
  const tables = data.screener?.tables || {};
  const peers = tables.peers || data.finology?.peers || null;
  const sales = rowSeries(tables.profitLoss, /^sales$|^revenue/i);
  const salesGrowthScreener = yoyGrowth(sales);
  const salesGrowth =
    parseNum(data.finology?.ratiosHorizon?.salesGrowth?.y1) ??
    parseNum(data.finology?.essentials?.["Sales Growth"]) ??
    salesGrowthScreener;
  const opProfit = latestRowValue(
    tables.quarters || tables.profitLoss,
    /operating profit|opm|ebitda/i
  );
  const netCash = latestRowValue(tables.cashFlows, /net cash|cash from operating/i);
  const debt =
    latestRowValue(tables.balanceSheet, /^borrowings$|^debt/i) ??
    parseNum(data.finology?.essentials?.DEBT);
  const reserves = latestRowValue(tables.balanceSheet, /reserves|equity/i);

  const pePeers = peerColumn(peers, /p\/?e|pe\b/i);
  const peerPct =
    pe != null
      ? percentileRank(
          // lower PE is better → invert percentile for "cheapness"
          pe,
          pePeers.others.length ? pePeers.others : pePeers.self != null ? [pePeers.self] : []
        )
      : null;
  // Cheapness: low PE → high score. If peerPct is % of peers with lower PE, cheapness ≈ 100 - peerPct
  const valuationPeerScore =
    peerPct == null ? null : clamp(100 - peerPct);

  const checklist: ChecklistItem[] = [];
  const hooks: string[] = [];
  const metrics: Record<string, number | null> = {
    pe,
    roe,
    roce,
    salesGrowth,
    debt,
    netCash,
    valuationPeerScore,
  };

  const pushValuation = () => {
    if (pe == null) {
      checklist.push(item("pe", "Valuation (P/E)", "warn", "P/E not available"));
      return;
    }
    if (valuationPeerScore != null) {
      const st =
        valuationPeerScore >= 60 ? "pass" : valuationPeerScore >= 35 ? "warn" : "fail";
      checklist.push(
        item(
          "pe",
          "Peer-relative P/E",
          st,
          `P/E ${pe.toFixed(1)} · cheaper than ~${valuationPeerScore.toFixed(0)}% of peers`
        )
      );
    } else {
      const st = pe < 25 ? "pass" : pe < 45 ? "warn" : "fail";
      checklist.push(item("pe", "Absolute P/E", st, `P/E ${pe.toFixed(1)}`));
    }
  };

  const pushRoe = (minPass = 12, minWarn = 8) => {
    if (roe == null) {
      checklist.push(item("roe", "ROE", "warn", "ROE missing"));
      return;
    }
    const st = roe >= minPass ? "pass" : roe >= minWarn ? "warn" : "fail";
    checklist.push(item("roe", "Return on equity", st, `ROE ${roe.toFixed(1)}%`));
  };

  const pushGrowth = () => {
    if (salesGrowth == null) {
      checklist.push(item("growth", "Sales growth", "warn", "Growth series thin"));
      return;
    }
    const st = salesGrowth >= 10 ? "pass" : salesGrowth >= 0 ? "warn" : "fail";
    checklist.push(
      item("growth", "YoY sales growth", st, `${salesGrowth.toFixed(1)}% YoY`)
    );
    if (salesGrowth >= 12) hooks.push(`Sales growing ~${salesGrowth.toFixed(0)}% YoY`);
    if (salesGrowth < 0) hooks.push("Top-line contraction needs a clear thesis");
  };

  const pushCashDebt = () => {
    if (netCash != null) {
      const st = netCash > 0 ? "pass" : netCash > -500 ? "warn" : "fail";
      checklist.push(
        item(
          "ocf",
          "Operating cash flow",
          st,
          `Latest OCF ${netCash.toFixed(0)} (₹ Cr scale)`
        )
      );
    }
    if (debt != null && reserves != null && reserves > 0) {
      const lev = debt / reserves;
      const st = lev < 0.5 ? "pass" : lev < 1.2 ? "warn" : "fail";
      checklist.push(
        item("lev", "Leverage vs reserves", st, `Debt/reserves ~${lev.toFixed(2)}x`)
      );
      metrics.leverage = lev;
    }
  };

  switch (id) {
    case "banks": {
      pushRoe(12, 8);
      if (roce != null) {
        checklist.push(
          item(
            "roce",
            "ROCE / capital returns",
            roce >= 10 ? "pass" : roce >= 6 ? "warn" : "fail",
            `ROCE ${roce.toFixed(1)}%`
          )
        );
      }
      // Banks: P/B mindset — approximate via book value vs price if present
      const bv = parseNum(snap(data).book_value);
      const price = parseNum(snap(data).current_price) ?? parseNum(data.scanx?.quote?.price);
      if (bv && price) {
        const pb = price / bv;
        metrics.pb = pb;
        checklist.push(
          item(
            "pb",
            "Price / Book",
            pb < 2 ? "pass" : pb < 3.5 ? "warn" : "fail",
            `P/B ~${pb.toFixed(2)}x`
          )
        );
        hooks.push(`Banking book screens at ~${pb.toFixed(1)}x book`);
      } else {
        pushValuation();
      }
      pushGrowth();
      break;
    }
    case "it": {
      pushGrowth();
      pushRoe(15, 10);
      if (roce != null) {
        checklist.push(
          item(
            "roce",
            "ROCE consistency",
            roce >= 18 ? "pass" : roce >= 12 ? "warn" : "fail",
            `ROCE ${roce.toFixed(1)}%`
          )
        );
      }
      pushValuation();
      if (pe != null && salesGrowth != null && salesGrowth > 0) {
        const peg = pe / salesGrowth;
        metrics.peg = peg;
        checklist.push(
          item(
            "peg",
            "PE vs growth",
            peg < 1.5 ? "pass" : peg < 2.5 ? "warn" : "fail",
            `PE/growth ~${peg.toFixed(2)}`
          )
        );
      }
      break;
    }
    case "consumer": {
      pushRoe(15, 10);
      if (roce != null) {
        checklist.push(
          item(
            "roce",
            "Franchise ROCE",
            roce >= 20 ? "pass" : roce >= 12 ? "warn" : "fail",
            `ROCE ${roce.toFixed(1)}%`
          )
        );
      }
      pushGrowth();
      pushValuation();
      pushCashDebt();
      hooks.push("Consumer names need patience on valuation; quality > cheapness");
      break;
    }
    case "energy": {
      pushCashDebt();
      pushGrowth();
      if (pe != null) {
        checklist.push(
          item(
            "pe",
            "Cycle PE (secondary)",
            pe < 15 ? "pass" : pe < 25 ? "warn" : "fail",
            `P/E ${pe.toFixed(1)} — treat carefully mid-cycle`
          )
        );
      }
      hooks.push("Commodity/energy: prefer FCF & balance sheet over headline PE");
      break;
    }
    case "capital_goods": {
      pushCashDebt();
      pushGrowth();
      pushRoe(10, 6);
      pushValuation();
      hooks.push("Watch working-capital and cash conversion in heavy industrials");
      break;
    }
    case "pharma": {
      pushGrowth();
      pushRoe(12, 8);
      pushValuation();
      pushCashDebt();
      if (opProfit != null) {
        checklist.push(
          item(
            "op",
            "Operating profit print",
            opProfit > 0 ? "pass" : "fail",
            `Latest OP ${opProfit}`
          )
        );
      }
      hooks.push("Pharma: regulatory/news risk deserves extra weight in sentiment");
      break;
    }
    default: {
      pushRoe();
      pushGrowth();
      pushValuation();
      pushCashDebt();
      if (roce != null) {
        checklist.push(
          item(
            "roce",
            "ROCE",
            roce >= 15 ? "pass" : roce >= 8 ? "warn" : "fail",
            `ROCE ${roce.toFixed(1)}%`
          )
        );
      }
    }
  }

  if (valuationPeerScore != null && valuationPeerScore >= 65) {
    hooks.push("Screens cheaper than most listed peers on P/E");
  }

  return {
    sectorId: id,
    sectorLabel: label,
    sectorFit: scoreChecklist(checklist),
    checklist,
    peerPercentile: valuationPeerScore,
    narrativeHooks: hooks.slice(0, 4),
    metrics,
  };
}
