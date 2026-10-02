import type { CompanyData } from "@/lib/api";
import { clamp, latestRowValue, parseNum, rowSeries, yoyGrowth } from "./parse";
import type { SectorModelResult } from "./sectorModels";

export type FundamentalBreakdown = {
  score: number;
  quality: number;
  growth: number;
  balanceSheet: number;
  valuation: number;
  redFlags: string[];
  drivers: string[];
  risks: string[];
};

export function scoreFundamentals(
  data: CompanyData,
  sector: SectorModelResult
): FundamentalBreakdown {
  const snap = data.screener?.snapshot || data.snapshot || {};
  const tables = data.screener?.tables || {};
  const fin = data.finology?.essentials || {};
  const horizon = data.finology?.ratiosHorizon;
  const pe =
    sector.metrics.pe ?? parseNum(snap.pe) ?? parseNum(fin["P/E"]);
  const roe =
    sector.metrics.roe ?? parseNum(snap.roe) ?? parseNum(fin.ROE);
  const roce =
    sector.metrics.roce ?? parseNum(snap.roce) ?? parseNum(fin.ROCE);
  const sales = rowSeries(tables.profitLoss, /^sales$|^revenue/i);
  const salesGrowthScreener = yoyGrowth(sales);
  const salesGrowthFin = parseNum(horizon?.salesGrowth?.y1 ?? fin["Sales Growth"]);
  const salesGrowth = salesGrowthFin ?? salesGrowthScreener;
  const salesGrowth3y = parseNum(horizon?.salesGrowth?.y3);
  const pat = rowSeries(tables.profitLoss, /net profit|profit after tax|^pat$/i);
  const patGrowthScreener = yoyGrowth(pat);
  const patGrowthFin = parseNum(horizon?.profitGrowth?.y1 ?? fin["Profit Growth"]);
  const patGrowth = patGrowthFin ?? patGrowthScreener;
  const patGrowth3y = parseNum(horizon?.profitGrowth?.y3);
  const ocf = latestRowValue(tables.cashFlows, /cash from operating|operating activity/i);
  const debt =
    latestRowValue(tables.balanceSheet, /^borrowings$/i) ??
    parseNum(fin.DEBT);
  const reserves = latestRowValue(tables.balanceSheet, /reserves/i);
  const debtEquity = parseNum(horizon?.debtEquity);
  const interestCover = parseNum(horizon?.interestCover);
  const cfoPat = parseNum(horizon?.cfoPat);

  // Quality
  let quality = 50;
  if (roe != null) quality = clamp(40 + roe * 2.2);
  if (roce != null) quality = clamp((quality + clamp(35 + roce * 2)) / 2);
  if (sector.sectorFit) quality = clamp(quality * 0.65 + sector.sectorFit * 0.35);
  if (interestCover != null) {
    quality = clamp(
      (quality + (interestCover >= 4 ? 80 : interestCover >= 2 ? 55 : 30)) / 2
    );
  }

  // Growth — Finology 1Y/3Y preferred when present
  let growth = 50;
  if (salesGrowth != null) growth = clamp(50 + salesGrowth * 1.5);
  if (patGrowth != null) growth = clamp((growth + clamp(50 + patGrowth * 1.2)) / 2);
  if (salesGrowth3y != null || patGrowth3y != null) {
    const mid =
      ((salesGrowth3y != null ? clamp(50 + salesGrowth3y * 1.4) : growth) +
        (patGrowth3y != null ? clamp(50 + patGrowth3y * 1.1) : growth)) /
      2;
    growth = clamp((growth + mid) / 2);
  }

  // Balance sheet
  let balanceSheet = 55;
  if (ocf != null) balanceSheet = ocf > 0 ? 75 : ocf > -200 ? 45 : 25;
  if (cfoPat != null) {
    balanceSheet = clamp(
      (balanceSheet + (cfoPat >= 1 ? 80 : cfoPat >= 0.5 ? 55 : 30)) / 2
    );
  }
  if (debtEquity != null) {
    const levScore =
      debtEquity < 0.4 ? 85 : debtEquity < 1 ? 60 : debtEquity < 2 ? 35 : 15;
    balanceSheet = clamp((balanceSheet + levScore) / 2);
  } else if (debt != null && reserves != null && reserves > 0) {
    const lev = debt / reserves;
    const levScore = lev < 0.4 ? 85 : lev < 1 ? 60 : lev < 2 ? 35 : 15;
    balanceSheet = clamp((balanceSheet + levScore) / 2);
  }

  // Valuation
  let valuation = 50;
  if (sector.peerPercentile != null) valuation = clamp(sector.peerPercentile);
  else if (pe != null) valuation = pe < 18 ? 80 : pe < 30 ? 55 : pe < 50 ? 35 : 18;

  const redFlags: string[] = [];
  const drivers: string[] = [...sector.narrativeHooks];
  const risks: string[] = [];

  if (ocf != null && ocf < 0 && debt != null && reserves != null && debt > reserves) {
    redFlags.push("Cash burn alongside elevated debt vs reserves");
  }
  if (salesGrowth != null && salesGrowth < -8 && patGrowth != null && patGrowth < -15) {
    redFlags.push("Simultaneous sales and profit contraction");
  }
  // Promoter pledge heuristic from shareholding extras / insights
  const insights = (data.screener?.insights || []).join(" ").toLowerCase();
  if (/pledge|pledged/.test(insights)) {
    redFlags.push("Pledging mentioned in Screener insights — verify promoter pledge");
  }
  for (const lim of data.finology?.limitations || []) {
    if (/pledge|debt|poor|high pe|overvalued/i.test(lim)) {
      risks.push(lim.slice(0, 120));
    }
  }
  for (const s of data.finology?.strengths || []) {
    drivers.push(s.slice(0, 120));
  }
  const finStar = data.finology?.finStar;
  if (finStar) {
    for (const [k, v] of Object.entries(finStar)) {
      if (v?.rating) {
        drivers.push(`FinStar ${k}: ${v.rating} (Finology)`);
      }
    }
  }

  if (roe != null && roe >= 15) drivers.push(`ROE ${roe.toFixed(1)}% supports quality`);
  if (salesGrowth != null && salesGrowth >= 10)
    drivers.push(`Sales growth ${salesGrowth.toFixed(1)}% YoY`);
  if (valuation >= 65) drivers.push("Valuation screens reasonable vs peers/history");

  if (pe != null && pe > 45) risks.push(`Rich P/E (${pe.toFixed(1)}) leaves little room for error`);
  if (salesGrowth != null && salesGrowth < 0) risks.push("Top-line declining");
  if (balanceSheet < 40) risks.push("Balance sheet / cash conversion looks soft");
  for (const c of sector.checklist.filter((x) => x.status === "fail")) {
    risks.push(c.detail);
  }

  const score = clamp(
    quality * 0.3 + growth * 0.25 + balanceSheet * 0.2 + valuation * 0.25
  );

  return {
    score,
    quality,
    growth,
    balanceSheet,
    valuation,
    redFlags,
    drivers: [...new Set(drivers)].slice(0, 6),
    risks: [...new Set(risks)].slice(0, 5),
  };
}
