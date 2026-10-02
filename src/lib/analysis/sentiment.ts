import type { ScoredNewsItem, ScanxAnalyst, ScanxNewsItem } from "@/lib/api";
import { clamp } from "./parse";

const POS =
  /\b(surge|soar|jump|beat|growth|record|win|wins|order|orders|profit|upgrade|buy|outperform|expansion|deal|approval|boost)\b/i;
const NEG =
  /\b(fall|falls|drop|drops|miss|loss|losses|fraud|probe|raid|downgrade|sell|pledge|pledged|ban|penalty|fine|weak|decline|cut|cuts|warning|default)\b/i;

export function tagHeadline(title: string): string[] {
  const t = title.toLowerCase();
  const tags: string[] = [];
  if (/result|earning|q[1-4]|profit|revenue/.test(t)) tags.push("earnings");
  if (/promoter|pledge|insider/.test(t)) tags.push("promoter");
  if (/sebi|rbi|fda|regulator|ban|penalty|court/.test(t)) tags.push("regulation");
  if (/order|contract|deal|mou/.test(t)) tags.push("order");
  if (/rbi|repo|inflation|crude|rupee|fed|macro|oil/.test(t)) tags.push("macro");
  if (/rumou?r|unconfirmed|sources say/.test(t)) tags.push("rumor");
  return tags;
}

export function scoreHeadline(title: string, summary = ""): ScoredNewsItem {
  const text = `${title} ${summary}`;
  let polarity = 0;
  if (POS.test(text)) polarity += 0.45;
  if (NEG.test(text)) polarity -= 0.55;
  if (/fraud|raid|pledge|default/.test(text.toLowerCase())) polarity -= 0.35;
  polarity = Math.max(-1, Math.min(1, polarity));
  return {
    title,
    summary,
    polarity,
    tags: tagHeadline(text),
  };
}

function ageWeight(age?: string): number {
  if (!age) return 0.7;
  const a = age.toLowerCase();
  if (/hour|min|today|just/.test(a)) return 1;
  if (/1 day|yesterday/.test(a)) return 0.9;
  if (/[2-3] day/.test(a)) return 0.75;
  if (/week/.test(a)) return 0.5;
  if (/month/.test(a)) return 0.25;
  return 0.6;
}

export function scoreSentiment(input: {
  news?: Array<ScanxNewsItem | ScoredNewsItem>;
  analyst?: ScanxAnalyst | null;
  sectorId?: string;
}): {
  score: number;
  items: ScoredNewsItem[];
  drivers: string[];
  risks: string[];
  redFlags: string[];
} {
  const raw = input.news || [];
  const items: ScoredNewsItem[] = raw.map((n) => {
    if ("polarity" in n && typeof n.polarity === "number") {
      return {
        title: n.title,
        summary: n.summary,
        age: "age" in n ? n.age : undefined,
        polarity: n.polarity,
        tags: n.tags || tagHeadline(n.title),
      };
    }
    const scored = scoreHeadline(n.title, n.summary || "");
    return { ...scored, age: n.age };
  });

  let weighted = 0;
  let wsum = 0;
  for (const it of items) {
    const w = ageWeight(it.age);
    weighted += it.polarity * w;
    wsum += w;
  }
  const newsPol = wsum ? weighted / wsum : 0;
  let score = clamp(50 + newsPol * 40);

  const drivers: string[] = [];
  const risks: string[] = [];
  const redFlags: string[] = [];

  const analyst = input.analyst;
  if (analyst) {
    const buy = Number(analyst.buy) || 0;
    const hold = Number(analyst.hold) || 0;
    const sell = Number(analyst.sell) || 0;
    const total = buy + hold + sell;
    if (total > 0) {
      const skew = (buy - sell) / total;
      score = clamp(score * 0.7 + (50 + skew * 40) * 0.3);
      if (skew > 0.25) drivers.push(`Analyst skew constructive (B${buy}/H${hold}/S${sell})`);
      if (skew < -0.15) risks.push(`Analyst skew cautious (B${buy}/H${hold}/S${sell})`);
    }
    if (analyst.rating) drivers.push(`Street rating: ${analyst.rating}`);
  }

  for (const it of items) {
    if (it.tags.includes("promoter") && it.polarity < 0) {
      redFlags.push(`Promoter/pledge risk in news: “${it.title}”`);
    }
    if (it.tags.includes("regulation") && it.polarity < 0) {
      redFlags.push(`Regulatory headline: “${it.title}”`);
    }
    if (it.polarity >= 0.4) drivers.push(it.title);
    if (it.polarity <= -0.4) risks.push(it.title);
  }

  if (input.sectorId === "pharma") {
    const reg = items.filter((i) => i.tags.includes("regulation"));
    if (reg.some((r) => r.polarity < 0)) {
      score = clamp(score - 8);
      risks.push("Pharma regulatory headlines weighted more heavily");
    }
  }

  if (!items.length && !analyst) {
    return {
      score: 50,
      items: [],
      drivers: ["Limited news/analyst feed — sentiment neutral"],
      risks: [],
      redFlags: [],
    };
  }

  return {
    score,
    items,
    drivers: [...new Set(drivers)].slice(0, 4),
    risks: [...new Set(risks)].slice(0, 4),
    redFlags,
  };
}
