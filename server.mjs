import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3456;
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS || 0);

/** Load .env into process.env without overriding existing vars. */
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}
loadEnvFile();

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

async function supabaseRest(pathname, { method = "GET", body, prefer, query = "" } = {}) {
  if (!supabaseConfigured()) {
    const err = new Error("Supabase is not configured (set SUPABASE_URL + key in .env)");
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer || "return=representation",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(
      typeof data === "object" && data
        ? data.message || data.error || JSON.stringify(data)
        : String(data || res.statusText)
    );
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

async function upsertCompany(company) {
  const symbol = String(company.symbol || "").trim().toUpperCase();
  if (!symbol) throw Object.assign(new Error("symbol required"), { status: 400 });
  let prev = null;
  try {
    const existing = await supabaseRest("companies", {
      query: `?symbol=eq.${encodeURIComponent(symbol)}&select=*&limit=1`,
    });
    prev = Array.isArray(existing) ? existing[0] : null;
  } catch {
    prev = null;
  }
  const row = {
    symbol,
    name: company.name || prev?.name || symbol,
    path: company.path || prev?.path || null,
    sector: company.sector || prev?.sector || null,
    industry: company.industry || prev?.industry || null,
    website: company.website || prev?.website || null,
    logo_url:
      unwrapLogoUrl(company.logo_url || company.logoUrl) ||
      prev?.logo_url ||
      null,
    last_seen_at: new Date().toISOString(),
  };
  const rows = await supabaseRest("companies", {
    method: "POST",
    body: row,
    prefer: "resolution=merge-duplicates,return=representation",
    query: "?on_conflict=symbol",
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function insertDeskRun(payload) {
  const company = payload.company || {};
  const run = payload.run || payload;
  const symbol = String(run.symbol || company.symbol || "")
    .trim()
    .toUpperCase();
  if (!symbol) throw Object.assign(new Error("symbol required"), { status: 400 });
  if (!["long", "swing"].includes(run.horizon)) {
    throw Object.assign(new Error("horizon must be long|swing"), { status: 400 });
  }
  await upsertCompany({
    symbol,
    name: company.name || run.company_name || symbol,
    path: company.path || null,
    sector: company.sector || null,
    industry: company.industry || null,
    website: company.website || null,
    logo_url: company.logo_url || company.logoUrl || null,
  });
  const row = {
    symbol,
    horizon: run.horizon,
    spot_price: run.spot_price ?? null,
    fetched_at: run.fetched_at || null,
    sources: run.sources || [],
    action: run.action || null,
    verdict_label: run.verdict_label || null,
    composite: run.composite ?? null,
    verdict_confidence: run.verdict_confidence ?? null,
    provisional: Boolean(run.provisional),
    desk_forecast: run.desk_forecast ?? null,
    forward_price: run.forward_price ?? null,
    forward_pe: run.forward_pe ?? null,
    forward_eps: run.forward_eps ?? null,
    trailing_pe: run.trailing_pe ?? null,
    trailing_eps: run.trailing_eps ?? null,
    growth_rate: run.growth_rate ?? null,
    growth_source: run.growth_source || null,
    upside_pct: run.upside_pct ?? null,
    fair_low: run.fair_low ?? null,
    fair_high: run.fair_high ?? null,
    forecast_confidence: run.forecast_confidence ?? null,
    pe_source: run.pe_source || null,
    prob_weighted_price: run.prob_weighted_price ?? null,
    fund_score: run.fund_score ?? null,
    tech_score: run.tech_score ?? null,
    sentiment_score: run.sentiment_score ?? null,
    macro_score: run.macro_score ?? null,
    swing_fit: run.swing_fit ?? null,
    long_fit: run.long_fit ?? null,
    process_confidence: run.process_confidence ?? null,
    consolidation_net: run.consolidation_net || null,
    drivers: run.drivers || [],
    risks: run.risks || [],
    forecast: run.forecast || {},
    verdict: run.verdict || {},
    decision: run.decision || {},
  };
  const rows = await supabaseRest("desk_runs", {
    method: "POST",
    body: row,
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

let nextAllowedAt = 0;

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function cooldownRemaining() {
  return Math.max(0, nextAllowedAt - Date.now());
}

function editDistance(a, b) {
  const s = String(a);
  const t = String(b);
  const m = s.length;
  const n = t.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function maxTyposAllowed(queryLen) {
  if (queryLen <= 3) return 1;
  if (queryLen <= 6) return 2;
  return 3;
}

/** Exact substring OR close typo (e.g. bsse → BSE). */
function fuzzyScore(query, { name = "", symbol = "", keywords = "" } = {}) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const sym = String(symbol).toLowerCase();
  const nm = String(name).toLowerCase();
  const kw = String(keywords).toLowerCase();
  const allowed = maxTyposAllowed(q.length);

  if (sym === q) return 100;
  if (sym.startsWith(q)) return 90;
  if (nm.startsWith(q)) return 85;
  if (sym.includes(q) || nm.includes(q) || kw.includes(q)) return 70;
  if (q.includes(sym) && sym.length >= 2) return 65;

  const distSym = editDistance(q, sym);
  if (distSym <= allowed) return 60 - distSym;

  // compare against each word in the company name
  for (const word of nm.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (word.length < 2) continue;
    if (word.startsWith(q) || q.startsWith(word)) return 55;
    const d = editDistance(q, word);
    if (d <= allowed) return 50 - d;
    // prefix typo: bsse vs bse inside longer names less relevant
    if (word.length >= 3) {
      const prefix = word.slice(0, Math.max(q.length, 3));
      const dp = editDistance(q, prefix);
      if (dp <= allowed) return 45 - dp;
    }
  }

  return 0;
}

/** Live autocomplete: Screener first, ScanX fuzzy backup for typos. */
async function searchScreener(q) {
  const endpoint = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(q)}&v=3&js=true`;
  const res = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "StockGlancePersonal/1.0",
    },
  });
  if (!res.ok) throw new Error(`Screener search failed (${res.status})`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Screener search returned unexpected data");

  return {
    source: "screener",
    results: rows.slice(0, 8).map((row) => {
      const parts = String(row.url || "").split("/").filter(Boolean);
      const code = parts[1] || String(row.id || "");
      return {
        id: row.id,
        name: row.name,
        symbol: code,
        path: row.url,
        score: fuzzyScore(q, { name: row.name, symbol: code }),
      };
    }),
  };
}

async function searchScanx(q) {
  const res = await fetch("https://scanx-search.dhan.co/Search/api/Search/Scrip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://scanx.trade",
      Accept: "application/json",
      "User-Agent": "StockGlancePersonal/1.0",
    },
    body: JSON.stringify({
      UserId: "Dhanweb",
      UserType: "C",
      Source: "X",
      Data: JSON.stringify({
        inst: "EQUITY",
        searchterm: q,
        exch: "",
        optionflag: false,
      }),
      broker_code: "DHN1804",
    }),
  });
  if (!res.ok) throw new Error(`ScanX search failed (${res.status})`);
  const payload = await res.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  const bestBySymbol = new Map();
  for (const row of rows) {
    const symbol = String(row.Sym_t || row.Ticker_t || "").trim();
    if (!symbol) continue;
    if (row.Inst_s && String(row.Inst_s).toUpperCase() !== "EQUITY") continue;

    const name = String(row.disp_sym_s || row.CompName_t || "");
    const keywords = String(row.keywords_t || "");
    const score = fuzzyScore(q, { name, symbol, keywords });
    if (score <= 0) continue;

    const exchBoost = String(row.d_exch || "").toUpperCase() === "NSE" ? 0.5 : 0;
    const ranked = score + exchBoost;
    const prev = bestBySymbol.get(symbol);
    if (!prev || ranked > prev.score) {
      bestBySymbol.set(symbol, {
        id: row.id || symbol,
        name: name || symbol,
        symbol,
        path: `/company/${encodeURIComponent(symbol)}/consolidated/`,
        score: ranked,
      });
    }
  }

  const results = [...bestBySymbol.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return { source: "scanx", results };
}

function mergeResults(primary, secondary) {
  const map = new Map();
  for (const row of [...primary, ...secondary]) {
    const key = String(row.symbol || "").toUpperCase();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || (row.score || 0) > (prev.score || 0)) map.set(key, row);
  }
  return [...map.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);
}

async function liveSearch(query) {
  const q = query.trim();
  if (q.length < 1) return { source: null, results: [] };

  let screener = { source: "screener", results: [] };
  let scanx = { source: "scanx", results: [] };

  try {
    screener = await searchScreener(q);
  } catch (err) {
    console.warn("Screener search failed:", err.message);
  }

  // Always ask ScanX too when Screener is empty/weak — catches typos like bsse → BSE
  const needFuzzy = screener.results.length < 3;
  if (needFuzzy) {
    try {
      scanx = await searchScanx(q);
    } catch (err) {
      console.warn("ScanX search failed:", err.message);
    }
  }

  if (!screener.results.length && !scanx.results.length) {
    throw new Error("No search provider returned matches");
  }

  if (!screener.results.length) return scanx;
  if (!scanx.results.length) return screener;

  return {
    source: "screener+scanx",
    results: mergeResults(screener.results, scanx.results),
  };
}

function parseJsonLoose(raw) {
  const text = String(raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new SyntaxError("Could not parse company JSON from Firecrawl output");
}

function cleanCell(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[\u00a0\u202f\u2007]/g, " ")
    .replace(/\s+/g, " ")
    // Screener marks expandable rows with a trailing + — not interactive here
    .replace(/\s*[+＋]+\s*$/u, "")
    .trim();
}

function parseMdTableBlock(lines) {
  const rows = lines.map((line) =>
    line.split("|").slice(1, -1).map(cleanCell)
  );
  if (rows.length < 2) return null;
  const headers = rows[0];
  const body = rows
    .slice(1)
    .filter((r) => !r.every((c) => /^[-:]+$/.test(c)));
  if (!body.length) return null;
  return {
    headers,
    rows: body
      .map((r) => ({ label: r[0] || "", values: r.slice(1) }))
      .filter(
        (r) =>
          r.label &&
          !/^raw pdf$/i.test(r.label) &&
          !r.values.some((v) => /https?:\/\//i.test(v) || /\]\([^)]+\)/.test(v))
      ),
  };
}

function extractAllTables(section) {
  const lines = String(section || "").split("\n");
  const buf = [];
  let collecting = false;
  const tables = [];
  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      collecting = true;
      buf.push(line);
    } else if (collecting) {
      const t = parseMdTableBlock(buf);
      if (t) tables.push(t);
      buf.length = 0;
      collecting = false;
    }
  }
  if (buf.length) {
    const t = parseMdTableBlock(buf);
    if (t) tables.push(t);
  }
  return tables;
}

function extractFirstTable(section) {
  return extractAllTables(section)[0] || null;
}

function trimTable(table, maxCols = 0) {
  if (!table) return null;
  // maxCols <= 0 keeps every period column (full Screener history)
  if (!maxCols || maxCols <= 0) {
    return {
      headers: [...(table.headers || [])],
      rows: (table.rows || []).map((r) => ({
        label: r.label,
        values: [...(r.values || [])],
      })),
    };
  }
  const headers = table.headers || [];
  const start = Math.max(1, headers.length - maxCols);
  return {
    headers: [headers[0] || "", ...headers.slice(start)],
    rows: (table.rows || []).map((r) => ({
      label: r.label,
      values: (r.values || []).slice(start - 1),
    })),
  };
}

function extractSections(md) {
  const parts = String(md || "").split(/\n(?=## )/);
  const map = {};
  for (const p of parts) {
    const m = p.match(/^##\s+(.+)/);
    if (!m) continue;
    map[m[1].trim()] = p;
  }
  return map;
}

function parseScreenerSnapshot(text) {
  const snap = {};
  const pairs = [
    [/Market Cap[\s\S]*?₹\s*([\d,]+)/i, "market_cap", (v) => `₹ ${v} Cr`],
    [/Current Price[\s\S]*?₹\s*([\d,.]+)/i, "current_price", (v) => `₹ ${v}`],
    [
      /High\s*\/\s*Low[\s\S]*?₹\s*([0-9,.\s/]+)/i,
      "week_52_high_low",
      (v) => `₹ ${v.replace(/\s+/g, " ").trim()}`,
    ],
    [/Stock P\/E[\s\S]*?\n\s*([\d.]+)/i, "pe", (v) => v],
    [/Book Value[\s\S]*?₹\s*([\d,.]+)/i, "book_value", (v) => `₹ ${v}`],
    [/Dividend Yield[\s\S]*?\n\s*([\d.]+)/i, "dividend_yield", (v) => `${v}%`],
    [/ROCE[\s\S]*?\n\s*([\d.]+)/i, "roce", (v) => `${v}%`],
    [/ROE[\s\S]*?\n\s*([\d.]+)/i, "roe", (v) => `${v}%`],
    [/Face Value[\s\S]*?₹\s*([\d.]+)/i, "face_value", (v) => `₹ ${v}`],
  ];
  for (const [re, key, fmt] of pairs) {
    const m = text.match(re);
    if (m) snap[key] = fmt(m[1]);
  }
  return snap;
}

function parseCompanyName(md) {
  const lines = String(md || "").split("\n");
  for (const line of lines) {
    const m = line.match(/^#\s+(?:!\[[^\]]*\]\([^)]*\)\s*)?(.+)$/);
    if (m) {
      const name = cleanCell(m[1]);
      if (name && !/notebook/i.test(name)) return name;
    }
  }
  return null;
}

function parseInsights(md) {
  const insights = [];
  for (const line of String(md || "").split("\n")) {
    const m = line.match(/^-\s+(Company .+|Stock .+|Compounded .+)/i);
    if (m) insights.push(cleanCell(m[1]));
  }
  return [...new Set(insights)].slice(0, 6);
}

const LOGO_SKIP_HOSTS = new Set([
  "screener.in",
  "www.screener.in",
  "scanx.trade",
  "www.scanx.trade",
  "ticker.finology.in",
  "www.finology.in",
  "finology.in",
  "www.nseindia.com",
  "nseindia.com",
  "www.bseindia.com",
  "bseindia.com",
  "finance.yahoo.com",
  "www.google.com",
  "google.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "linkedin.com",
  "youtube.com",
  "wikipedia.org",
  "en.wikipedia.org",
]);

function normalizeWebsite(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    if (!/^https?:$/i.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (!host || LOGO_SKIP_HOSTS.has(host)) return null;
    if (host.endsWith(".screener.in")) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

function logoUrlFromWebsite(website) {
  const normalized = normalizeWebsite(website);
  if (!normalized) return null;
  try {
    const host = new URL(normalized).hostname.replace(/^www\./, "");
    // Clearbit tends to look better than tiny favicons when a domain exists.
    return `https://logo.clearbit.com/${encodeURIComponent(host)}`;
  } catch {
    return null;
  }
}

/** Screener CDN company marks: ![](https://cdn-media.screener.in/company-logos/...) */
function extractScreenerLogo(md) {
  const text = String(md || "").slice(0, 8000);
  const m = text.match(
    /https:\/\/cdn-media\.screener\.in\/company-logos\/[^\s)"']+/i
  );
  if (!m) return null;
  // Keep the scraped CDN path (thumbnails are the reliable Screener asset).
  return m[0];
}

function extractCompanyWebsite(md) {
  const text = String(md || "");
  const labeled = text.match(
    /(?:^|\n)\s*Website\s*[:\-]?\s*(?:\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)<]+)|([a-z0-9][-a-z0-9.]*\.[a-z]{2,}(?:\/[^\s)<]*)?))/i
  );
  if (labeled) {
    const candidate = labeled[2] || labeled[3] || labeled[1] || labeled[4];
    const normalized = normalizeWebsite(candidate);
    if (normalized) return normalized;
  }

  const linkRe = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const label = String(m[1] || "").toLowerCase().trim();
    const href = m[2];
    const labelLooksLikeDomain =
      /^[a-z0-9][-a-z0-9.]*\.[a-z]{2,}$/i.test(label) ||
      label.startsWith("www.");
    if (
      label.includes("website") ||
      label.includes("official") ||
      label === "site" ||
      label.includes("www") ||
      labelLooksLikeDomain
    ) {
      const normalized = normalizeWebsite(href);
      if (normalized) return normalized;
    }
  }

  // Fallback: first external http(s) link in the top of the page that isn't a known data host.
  const head = text.slice(0, 12000);
  const bareRe = /https?:\/\/[^\s)<"']+/gi;
  while ((m = bareRe.exec(head)) !== null) {
    const normalized = normalizeWebsite(m[0]);
    if (normalized) return normalized;
  }
  return null;
}

async function loadCachedCompany(symbol) {
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym || !supabaseConfigured()) return null;
  try {
    const existing = await supabaseRest("companies", {
      query: `?symbol=eq.${encodeURIComponent(sym)}&select=*&limit=1`,
    });
    return Array.isArray(existing) ? existing[0] : null;
  } catch {
    return null;
  }
}

const LOGO_PROXY_HOSTS = new Set([
  "cdn-media.screener.in",
  "logo.clearbit.com",
  "www.google.com",
  "icons.duckduckgo.com",
]);

function isAllowedLogoUrl(raw) {
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return LOGO_PROXY_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Same-origin logo URL so the browser is not blocked by CDN hotlink rules. */
function proxiedLogoUrl(logoUrl) {
  if (!logoUrl || !isAllowedLogoUrl(logoUrl)) return logoUrl || null;
  return `/api/logo?src=${encodeURIComponent(logoUrl)}`;
}

function unwrapLogoUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("/api/logo")) {
    try {
      const u = new URL(s, "http://local");
      const src = u.searchParams.get("src");
      return isAllowedLogoUrl(src) ? src : null;
    } catch {
      return null;
    }
  }
  return isAllowedLogoUrl(s) ? s : s.startsWith("http") ? s : null;
}

const logoProxyCache = new Map();

async function fetchLogoBytes(src) {
  const hit = logoProxyCache.get(src);
  if (hit && Date.now() - hit.at < 1000 * 60 * 60 * 24) return hit;
  const res = await fetch(src, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; StockGlance/1.0; +https://stock-glance.onrender.com)",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://www.screener.in/",
    },
  });
  if (!res.ok) throw new Error(`logo fetch HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/webp";
  const entry = { buf, contentType, at: Date.now() };
  if (logoProxyCache.size > 200) {
    const first = logoProxyCache.keys().next().value;
    if (first) logoProxyCache.delete(first);
  }
  logoProxyCache.set(src, entry);
  return entry;
}

function parseScreenerMarkdown(md) {
  const sections = extractSections(md);
  const company = parseCompanyName(md);
  const snapshot = parseScreenerSnapshot(md.slice(0, 8000));
  const website = extractCompanyWebsite(md);
  const logoUrl = extractScreenerLogo(md);

  const plTables = extractAllTables(sections["Profit & Loss"] || "");
  const shareTables = extractAllTables(sections["Shareholding Pattern"] || "");
  const insightTables = extractAllTables(sections["Insights"] || "");

  const growth = plTables.slice(1).map((t) => ({
    title: t.headers?.[0] || "Growth",
    table: {
      headers: ["Period", "Value"],
      rows: (t.rows || []).map((r) => ({
        label: r.label,
        values: [r.values?.[0] || ""],
      })),
    },
  }));

  const tables = {
    peers: extractFirstTable(sections["Peer comparison"] || ""),
    quarters: extractFirstTable(sections["Quarterly Results"] || ""),
    profitLoss: plTables[0] || null,
    growth,
    balanceSheet: extractFirstTable(sections["Balance Sheet"] || ""),
    cashFlows: extractFirstTable(sections["Cash Flows"] || ""),
    ratios: extractFirstTable(sections["Ratios"] || ""),
    shareholding: shareTables[0] || null,
    shareholdingExtra: shareTables.slice(1),
    insightExtras: insightTables,
  };

  return {
    company,
    website,
    logoUrl,
    snapshot,
    insights: parseInsights(md),
    tables,
    source: "screener",
  };
}

function missingSnapshotKeys(snapshot) {
  const keys = [
    "current_price",
    "market_cap",
    "pe",
    "roe",
    "book_value",
    "dividend_yield",
    "week_52_high_low",
  ];
  return keys.filter((k) => snapshot?.[k] == null || snapshot[k] === "");
}

async function yahooChart(symbol, range = "2y", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 StockGlance/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  return res.json();
}

async function fetchOhlcBars(symbol) {
  const tickers = [`${symbol}.NS`, `${symbol}.BO`];
  let lastErr;
  for (const t of tickers) {
    try {
      const json = await yahooChart(t, "2y", "1d");
      const result = json?.chart?.result?.[0];
      if (!result?.timestamp?.length) throw new Error("empty chart");
      const q = result.indicators?.quote?.[0] || {};
      const bars = [];
      for (let i = 0; i < result.timestamp.length; i++) {
        const open = q.open?.[i];
        const high = q.high?.[i];
        const low = q.low?.[i];
        const close = q.close?.[i];
        if ([open, high, low, close].some((v) => v == null || !Number.isFinite(v)))
          continue;
        bars.push({
          date: new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10),
          open,
          high,
          low,
          close,
          volume: Number(q.volume?.[i] || 0),
        });
      }
      if (bars.length >= 30) return bars;
      throw new Error("insufficient bars");
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("OHLC unavailable");
}

function scoreNewsTitle(title, summary = "") {
  const text = `${title} ${summary}`;
  const POS =
    /\b(surge|soar|jump|beat|growth|record|win|order|profit|upgrade|buy|deal|approval|boost)\b/i;
  const NEG =
    /\b(fall|drop|miss|loss|fraud|probe|raid|downgrade|sell|pledge|ban|penalty|fine|weak|decline|cut|default)\b/i;
  let polarity = 0;
  if (POS.test(text)) polarity += 0.45;
  if (NEG.test(text)) polarity -= 0.55;
  if (/fraud|raid|pledge|default/i.test(text)) polarity -= 0.35;
  polarity = Math.max(-1, Math.min(1, polarity));
  const t = text.toLowerCase();
  const tags = [];
  if (/result|earning|q[1-4]|profit|revenue/.test(t)) tags.push("earnings");
  if (/promoter|pledge|insider/.test(t)) tags.push("promoter");
  if (/sebi|rbi|fda|regulator|ban|penalty|court/.test(t)) tags.push("regulation");
  if (/order|contract|deal|mou/.test(t)) tags.push("order");
  if (/rbi|repo|inflation|crude|rupee|fed|macro|oil/.test(t)) tags.push("macro");
  if (/rumou?r|unconfirmed/.test(t)) tags.push("rumor");
  return { title, summary, polarity, tags };
}

async function fetchScoredNews(symbol, name) {
  const q = encodeURIComponent(`${name || symbol} stock`);
  const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(rssUrl, {
    headers: { "User-Agent": "Mozilla/5.0 StockGlance/1.0", Accept: "application/rss+xml" },
  });
  if (!res.ok) throw new Error(`news HTTP ${res.status}`);
  const xml = await res.text();
  const items = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const block of blocks.slice(0, 12)) {
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
      block.match(/<title>(.*?)<\/title>/i))?.[1];
    const link = (block.match(/<link>(.*?)<\/link>/i) || [])[1];
    const pub = (block.match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1];
    if (!title) continue;
    const clean = title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
    const scored = scoreNewsTitle(clean);
    let age;
    if (pub) {
      const d = new Date(pub);
      if (!Number.isNaN(d.getTime())) {
        const hrs = (Date.now() - d.getTime()) / 3600000;
        age =
          hrs < 24
            ? `${Math.max(1, Math.round(hrs))} hours ago`
            : `${Math.round(hrs / 24)} days ago`;
      }
    }
    items.push({ ...scored, age, url: link || undefined });
  }
  return items;
}

async function yahooQuotePrice(symbol) {
  const json = await yahooChart(symbol, "5d", "1d");
  const meta = json?.chart?.result?.[0]?.meta;
  const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  const last = closes.filter((x) => x != null).at(-1);
  const prev = closes.filter((x) => x != null).at(-2);
  return {
    price: meta?.regularMarketPrice ?? last ?? null,
    prev: prev ?? meta?.chartPreviousClose ?? null,
  };
}

async function fetchMacroMarkers() {
  const markers = { asOf: new Date().toISOString() };
  try {
    const usdinr = await yahooQuotePrice("INR=X");
    markers.usdinr = usdinr.price;
  } catch {
    /* optional */
  }
  try {
    const brent = await yahooQuotePrice("BZ=F");
    markers.brent = brent.price;
  } catch {
    /* optional */
  }
  try {
    const nifty = await yahooQuotePrice("^NSEI");
    markers.niftyChangePct =
      nifty.price != null && nifty.prev
        ? ((nifty.price - nifty.prev) / nifty.prev) * 100
        : null;
  } catch {
    /* optional */
  }
  // India 10Y rough proxy — try common Yahoo bond symbols, else leave null
  for (const sym of ["IN10Y.BOND", "10YIN=RR"]) {
    try {
      const g = await yahooQuotePrice(sym);
      if (g.price != null) {
        markers.india10y = g.price;
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (markers.india10y == null) markers.india10y = 7.0; // calm midpoint fallback
  return markers;
}


function slugifyCompany(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function firecrawlScrape(url, { jsonQuery } = {}) {
  const outFile = path.join(
    __dirname,
    `.tmp-scrape-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  );
  const localBin = path.join(__dirname, "node_modules", ".bin", "firecrawl");
  const bin = fs.existsSync(localBin) ? localBin : "firecrawl";
  const args = ["scrape", url, "--only-main-content", "-o", outFile];
  if (jsonQuery) {
    args.push("-Q", jsonQuery);
  }
  try {
    await execFileAsync(bin, args, {
      timeout: 90_000,
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });
    const raw = fs.readFileSync(outFile, "utf8");
    return parseJsonLoose(raw);
  } finally {
    try {
      fs.unlinkSync(outFile);
    } catch {
      /* ignore */
    }
  }
}

function stripMdChrome(text) {
  return String(text || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/#\d+\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLabelValues(block, labels) {
  const out = {};
  // Keep line breaks for label/value pairing; strip images only.
  const text = String(block || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\r/g, "");
  for (const label of labels) {
    const re = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+\\s*([^\\n]+)`,
      "i"
    );
    const m = text.match(re);
    if (m) out[label] = stripMdChrome(m[1]);
  }
  return out;
}

function cleanTable(table) {
  if (!table) return null;
  return {
    headers: (table.headers || []).map(stripMdChrome),
    rows: (table.rows || [])
      .map((r) => ({
        label: stripMdChrome(r.label),
        values: (r.values || []).map(stripMdChrome),
      }))
      .filter((r) => r.label),
  };
}

function findSection(sections, prefix) {
  const key = Object.keys(sections).find((k) =>
    k.toLowerCase().startsWith(String(prefix).toLowerCase())
  );
  return key ? sections[key] : "";
}

function parseScanxNews(section) {
  const news = [];
  const lines = String(section || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = stripMdChrome(lines[i]);
    if (!line || /^(view all|company news|neutral|view more)$/i.test(line)) {
      continue;
    }
    if (line.length < 24) continue;
    const age = line.match(
      /(\d+\s+(?:day|days|hour|hours|week|weeks)\s+ago)$/i
    );
    const title = age ? line.slice(0, -age[1].length).trim() : line;
    if (title.length < 20) continue;
    let summary = "";
    const next = stripMdChrome(lines[i + 1] || "");
    if (next && next.length > 40 && !/ago$/i.test(next)) {
      summary = next;
      i += 1;
    }
    news.push({ title, summary, age: age ? age[1] : "" });
    if (news.length >= 6) break;
  }
  return news;
}

function parseScanxAnalyst(block) {
  const text = stripMdChrome(block);
  const rating = (text.match(/\b(BUY|HOLD|SELL)\b/) || [])[1] || null;
  const buy = (text.match(/Buy\+?\s*([\d.]+)\s*%/i) || [])[1] || null;
  const hold = (text.match(/Hold\+?\s*([\d.]+)\s*%/i) || [])[1] || null;
  const sell = (text.match(/Sell\+?\s*([\d.]+)\s*%/i) || [])[1] || null;
  const blurb =
    (text.match(/Analysts have suggested[^.]+[.]/i) || [])[0] || null;
  return { rating, buy, hold, sell, blurb };
}

function extractFinologySections(md) {
  const parts = String(md || "").split(/\n(?=#{1,6}\s)/);
  const map = {};
  for (const p of parts) {
    const m = p.match(/^#{1,6}\s+(.+)/);
    if (!m) continue;
    const title = stripMdChrome(m[1]).replace(/\s+/g, " ").trim();
    if (title) map[title] = p;
  }
  return map;
}

function findFinologySection(sections, needle) {
  const n = String(needle).toLowerCase();
  const keys = Object.keys(sections);
  const exact = keys.find((k) => k.toLowerCase() === n);
  if (exact) return sections[exact];
  const starts = keys.find((k) => k.toLowerCase().startsWith(n));
  if (starts) return sections[starts];
  const includes = keys.find((k) => k.toLowerCase().includes(n));
  return includes ? sections[includes] : "";
}

function parseBulletList(section) {
  const items = [];
  for (const line of String(section || "").split("\n")) {
    const m = line.match(/^\s*[-*]\s+(.+)/);
    if (!m) continue;
    const t = stripMdChrome(m[1]);
    if (t && t.length > 8) items.push(t);
  }
  return [...new Set(items)].slice(0, 8);
}

function parseFinStar(section) {
  const text = String(section || "");
  const pillars = ["Ownership", "Valuation", "Efficiency", "Financials"];
  const out = {};
  for (const pillar of pillars) {
    // Handles "###### Ownership Stable", "###### ValuationFair", etc.
    const re = new RegExp(
      `(?:#{2,6}\\s*)?${pillar}\\s*([A-Za-z]+)\\s*(?:\\n+|\\s{2,})([\\s\\S]*?)(?=(?:#{2,6}\\s*)?(?:Ownership|Valuation|Efficiency|Financials)\\s*[A-Za-z]|#{1,6}\\s|$)`,
      "i"
    );
    const m = text.match(re);
    if (m) {
      const rating = stripMdChrome(m[1]);
      if (/^(stable|fair|poor|average|good|excellent|weak|strong)$/i.test(rating)) {
        out[pillar.toLowerCase()] = {
          rating,
          blurb: stripMdChrome(m[2]).slice(0, 220),
        };
        continue;
      }
    }
    const flat = text.match(
      new RegExp(
        `${pillar}\\s*(Stable|Fair|Poor|Average|Good|Excellent|Weak|Strong)`,
        "i"
      )
    );
    if (flat) {
      out[pillar.toLowerCase()] = {
        rating: flat[1],
        blurb: "",
      };
    }
  }
  return Object.keys(out).length ? out : null;
}

function parseHorizonRatios(section) {
  const text = String(section || "");
  const out = {};
  const blocks = [
    ["salesGrowth", /Sales Growth([\s\S]*?)(?=Profit Growth|ROE|####|$)/i],
    ["profitGrowth", /Profit Growth([\s\S]*?)(?=ROE|ROCE|Debt|####|$)/i],
    ["roe", /ROE%?\s*([\s\S]*?)(?=ROCE|Debt|Price to|####|$)/i],
    ["roce", /ROCE\s*%?\s*([\s\S]*?)(?=Debt|Price to|Interest|####|$)/i],
  ];
  for (const [key, re] of blocks) {
    const m = text.match(re);
    if (!m) continue;
    const chunk = m[1];
    // Finology often writes "1 Year-2.26%" without a space before the value
    const y1 = (chunk.match(/1\s*Year\s*([-\d.]+)\s*%?/i) || [])[1];
    const y3 = (chunk.match(/3\s*Year\s*([-\d.]+)\s*%?/i) || [])[1];
    const y5 = (chunk.match(/5\s*Year\s*([-\d.]+)\s*%?/i) || [])[1];
    out[key] = {
      y1: y1 != null ? `${y1}%` : null,
      y3: y3 != null ? `${y3}%` : null,
      y5: y5 != null ? `${y5}%` : null,
    };
  }
  const de = (text.match(/Debt\/Equity\s*\n+\s*([\d.]+)/i) || [])[1];
  const ic = (text.match(/Interest Cover(?:age)? Ratio\s*\n+\s*([\d.]+)/i) ||
    [])[1];
  const cfo = (text.match(/CFO\/PAT[^\n]*\n+\s*([\d.]+)/i) || [])[1];
  const pcf = (text.match(/Price to Cash Flow\s*\n+\s*([\d.]+)/i) || [])[1];
  if (de) out.debtEquity = de;
  if (ic) out.interestCover = ic;
  if (cfo) out.cfoPat = cfo;
  if (pcf) out.priceToCashFlow = pcf;
  return out;
}

function parseFinologyEssentials(md) {
  const head = String(md || "").slice(0, 12000);
  const essentialsBlock =
    (head.match(/Company Essentials([\s\S]*?)(?=Your Added|Brands|Index Presence|####|$)/i) ||
      [])[1] || head;
  const labels = [
    "Market Cap",
    "Enterprise Value",
    "No. of Shares",
    "P/E",
    "P/B",
    "Face Value",
    "Div. Yield",
    "Book Value (TTM)",
    "CASH",
    "DEBT",
    "Promoter Holding",
    "EPS (TTM)",
    "Sales Growth",
    "ROE",
    "ROCE",
    "Profit Growth",
  ];
  const essentials = parseLabelValues(essentialsBlock, labels);

  const priceSummary =
    (head.match(/Price Summary([\s\S]*?)(?=FinStar|Company Essentials|####|$)/i) ||
      [])[1] || "";
  const dayHigh = (priceSummary.match(/Today's High\s*\n+\s*₹\s*([\d,.]+)/i) ||
    [])[1];
  const dayLow = (priceSummary.match(/Today's Low\s*\n+\s*₹\s*([\d,.]+)/i) ||
    [])[1];
  const w52h = (priceSummary.match(/52 Week High\s*\n+\s*₹\s*([\d,.]+)/i) ||
    [])[1];
  const w52l = (priceSummary.match(/52 Week Low\s*\n+\s*₹\s*([\d,.]+)/i) ||
    [])[1];

  const priceMatch = head.match(
    /\n\s*([\d,]+\.\d{2})\s*\n+\s*[\\-]?\s*(-?[\d,.]+)\s*\((-?[\d.]+)%\)/
  );
  const sector =
    (head.match(/SECTOR:\s*\[?([^\n\]]+)/i) || [])[1]?.trim() || null;

  return {
    price: priceMatch ? priceMatch[1] : null,
    change: priceMatch ? priceMatch[2] : null,
    changePct: priceMatch ? `${priceMatch[3]}%` : null,
    dayHigh: dayHigh || null,
    dayLow: dayLow || null,
    week52High: w52h || null,
    week52Low: w52l || null,
    dayRange:
      dayHigh && dayLow ? `₹ ${dayHigh} - ₹ ${dayLow}` : null,
    week52:
      w52h && w52l ? `₹ ${w52h} / ₹ ${w52l}` : null,
    sector,
    ...essentials,
  };
}

function parseFinologyGroup(md) {
  const m = String(md || "").match(
    /Group Companies([\s\S]*?)(?=#### Ratios|#### Shareholding|####\s|$)/i
  );
  if (!m) return [];
  const out = [];
  const re =
    /\*\*([A-Z0-9.-]+)\*\*\s*\n+#{0,6}\s*\[?([^\n\]]+)/g;
  let hit;
  while ((hit = re.exec(m[1])) && out.length < 12) {
    out.push({
      symbol: stripMdChrome(hit[1]),
      name: stripMdChrome(hit[2]).slice(0, 80),
    });
  }
  return out;
}

function parseFinologyMarkdown(md) {
  const sections = extractFinologySections(md);
  const essentials = parseFinologyEssentials(md);
  // #### FinStar is followed by ###### pillars — section split is too fine-grained
  const finStarFromMd =
    (String(md).match(
      /FinStar([\s\S]{0,2500}?)(?=Company Essentials|Your Added|Brands)/i
    ) || [])[0] || "";
  const finStarSection = findFinologySection(sections, "FinStar");
  const finStar = parseFinStar(
    finStarFromMd.length > 40 ? finStarFromMd : finStarSection
  );
  const strengths = parseBulletList(
    findFinologySection(sections, "Strengths")
  );
  const limitations = parseBulletList(
    findFinologySection(sections, "Limitations")
  );
  // Prefer contiguous Ratios→Shareholding window (subheads split into many ####)
  const ratiosWindow =
    (String(md).match(
      /####\s*Ratios([\s\S]*?)(?=####\s*Shareholding|####\s*Strengths|$)/i
    ) || [])[0] ||
    findFinologySection(sections, "Ratios") ||
    findFinologySection(sections, "Sales Growth") ||
    "";
  const ratiosHorizon = parseHorizonRatios(ratiosWindow);

  const company =
    (String(md).match(/^#\s+(.+?)\s+share price/im) || [])[1]?.trim() ||
    parseCompanyName(md);

  return {
    company,
    essentials,
    finStar,
    strengths,
    limitations,
    ratiosHorizon,
    peers: cleanTable(
      extractFirstTable(findFinologySection(sections, "Peer Comparison"))
    ),
    shareholding: cleanTable(
      extractFirstTable(findFinologySection(sections, "Shareholding Pattern")) ||
        extractFirstTable(findFinologySection(sections, "Promoter Pledging"))
    ),
    quarters: cleanTable(
      extractFirstTable(findFinologySection(sections, "Quarterly Result"))
    ),
    profitLoss: cleanTable(
      extractFirstTable(findFinologySection(sections, "Profit & Loss"))
    ),
    balanceSheet: cleanTable(
      extractFirstTable(findFinologySection(sections, "Balance Sheet"))
    ),
    cashFlows: cleanTable(
      extractFirstTable(findFinologySection(sections, "Cash Flows"))
    ),
    dividends: cleanTable(
      extractFirstTable(findFinologySection(sections, "Corporate Actions")) ||
        extractFirstTable(findFinologySection(sections, "Dividend"))
    ),
    groupCompanies: parseFinologyGroup(md),
  };
}

async function fetchFinologyBundle(symbol) {
  const sym = String(symbol || "")
    .trim()
    .toUpperCase();
  if (!sym) {
    return { error: "No symbol for Finology" };
  }
  const url = `https://ticker.finology.in/company/${encodeURIComponent(sym)}`;
  try {
    const scraped = await firecrawlScrape(url);
    const markdown = scraped.markdown || scraped.data?.markdown || "";
    if (!markdown) {
      return { error: "Finology scrape returned no content", url };
    }
    const parsed = parseFinologyMarkdown(markdown);
    const hasEssentials = Object.keys(parsed.essentials || {}).length > 2;
    if (!hasEssentials && !parsed.finStar && !parsed.strengths?.length) {
      return { error: "Could not parse Finology company data", url };
    }
    return { url, ...parsed };
  } catch (err) {
    console.warn("Finology fetch failed:", err.message);
    return {
      error: String(err?.message || err),
      url,
    };
  }
}

async function fetchScanxBundle(symbol, company) {
  const slug = slugifyCompany(company || symbol);
  if (!slug) {
    return { error: "No ScanX slug available" };
  }
  const url = `https://scanx.trade/company/${slug}`;
  try {
    const scraped = await firecrawlScrape(url);
    const markdown = scraped.markdown || scraped.data?.markdown || "";
    if (!markdown) {
      return { error: "ScanX scrape returned no content", url };
    }

    const sections = extractSections(markdown);
    const head = markdown.slice(0, 1600);
    const quoteMatch = head.match(
      /^#\s+(.+)\n+(\d[\d,]*(?:\.\d+)?)\n+\s*(-?\d[\d,]*(?:\.\d+)?)\n+\((-?\d[\d.]*)%\)/m
    );
    const top = parseLabelValues(head, [
      "Market Cap",
      "PE Ratio",
      "Volume",
      "Day High - Low",
      "52W High-Low",
    ]);
    const kfStart = markdown.indexOf("Key Fundamentals");
    const newsStart = markdown.indexOf("## Company News");
    const kfBlock =
      kfStart >= 0
        ? markdown.slice(
            kfStart,
            newsStart > kfStart ? newsStart : kfStart + 2500
          )
        : "";
    const fundamentals = parseLabelValues(kfBlock, [
      "Market Cap",
      "EPS",
      "PE Ratio",
      "PB Ratio",
      "Book Value",
      "EBITDA",
      "Dividend Yield",
      "Industry",
      "Sector",
      "Return on Equity",
      "Debt to Equity",
    ]);
    const aboutKey = Object.keys(sections).find((k) =>
      k.toLowerCase().startsWith("about ")
    );
    const about = aboutKey
      ? stripMdChrome(
          sections[aboutKey]
            .replace(/^##\s+.+\n/, "")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !/^!\[/.test(l) && !/^https?:/.test(l))
            .slice(0, 6)
            .join(" ")
        ).slice(0, 900)
      : "";

    return {
      url,
      quote: {
        company: quoteMatch ? cleanCell(quoteMatch[1]) : company,
        price: quoteMatch ? quoteMatch[2] : null,
        change: quoteMatch ? quoteMatch[3] : null,
        changePct: quoteMatch ? `${quoteMatch[4]}%` : null,
        marketCap: top["Market Cap"] || null,
        pe: top["PE Ratio"] || null,
        volume: top.Volume || null,
        dayRange: top["Day High - Low"] || null,
        week52: top["52W High-Low"] || null,
      },
      fundamentals,
      analyst: parseScanxAnalyst(kfBlock),
      news: parseScanxNews(findSection(sections, "Company News")),
      peers: cleanTable(
        extractFirstTable(findSection(sections, "Peer Comparison"))
      ),
      tables: {
        quarters: cleanTable(
          trimTable(
            extractFirstTable(
              findSection(sections, "Quarterly Financial Results")
            )
          )
        ),
        balanceSheet: cleanTable(
          trimTable(extractFirstTable(findSection(sections, "Balance Sheet")))
        ),
        cashFlows: cleanTable(
          trimTable(extractFirstTable(findSection(sections, "Cash Flow")))
        ),
        shareholding: cleanTable(
          trimTable(
            extractFirstTable(findSection(sections, "Share Holding")),
            6
          )
        ),
        dividends: cleanTable(
          trimTable(
            extractFirstTable(findSection(sections, "Dividend History")),
            6
          )
        ),
      },
      about,
    };
  } catch (err) {
    console.warn("ScanX fetch failed:", err.message);
    return {
      error: String(err?.message || err),
      url,
    };
  }
}

async function fetchCompany(pathOrSymbol, symbolHint = "") {
  const cleaned = String(pathOrSymbol || "").trim();
  const pagePath = cleaned.startsWith("/company/")
    ? cleaned
    : `/company/${encodeURIComponent(cleaned)}/consolidated/`;
  const screenerUrl = `https://www.screener.in${
    pagePath.endsWith("/") ? pagePath : pagePath + "/"
  }`;

  const symbol =
    symbolHint ||
    (pagePath.match(/\/company\/([^/]+)/i) || [])[1]?.toUpperCase() ||
    "";

  // Screener first path (required). ScanX in parallel once we know company name from Screener,
  // but we don't know name yet — so run Screener, then ScanX with company from Screener.
  // For speed: start Screener, then ScanX with symbol slug heuristic in parallel after quick name parse.
  const scraped = await firecrawlScrape(screenerUrl);
  const markdown = scraped.markdown || scraped.data?.markdown || "";
  if (!markdown) {
    throw new Error("Screener scrape returned no markdown");
  }

  const screener = parseScreenerMarkdown(markdown);
  const company = screener.company || symbol;
  const sym = (symbol || cleaned).toUpperCase();

  const [scanx, finology, cached] = await Promise.all([
    fetchScanxBundle(sym, company),
    fetchFinologyBundle(sym),
    loadCachedCompany(sym),
  ]);

  const hasTables = Object.values(screener.tables || {}).some(Boolean);
  if (
    !screener.company &&
    !hasTables &&
    missingSnapshotKeys(screener.snapshot).length > 4
  ) {
    throw new Error("Could not parse Screener company data");
  }

  const website =
    screener.website ||
    normalizeWebsite(cached?.website) ||
    null;
  const logoUrl =
    screener.logoUrl ||
    (cached?.logo_url ? String(cached.logo_url) : null) ||
    logoUrlFromWebsite(website) ||
    null;

  const sources = ["screener", "scanx"];
  if (!finology?.error) sources.push("finology");

  // Persist website/logo when newly discovered (best-effort; desk-run upsert also writes).
  // Store the upstream CDN URL, not the same-origin proxy path.
  if (website || logoUrl) {
    void upsertCompany({
      symbol: sym,
      name: company,
      path: pagePath,
      website,
      logo_url: logoUrl,
    }).catch((err) => {
      console.warn("company logo upsert failed:", err?.message || err);
    });
  }

  return {
    company,
    symbol: sym,
    website,
    logoUrl: proxiedLogoUrl(logoUrl),
    screener: {
      snapshot: screener.snapshot,
      tables: screener.tables,
      insights: screener.insights,
      url: screenerUrl,
    },
    scanx,
    finology,
    snapshot: screener.snapshot,
    sources,
  };
}

function serveStatic(req, res) {
  let filePath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const distDir = path.join(__dirname, "dist");
  const preferDist = fs.existsSync(distDir);
  const root = preferDist ? distDir : __dirname;
  const abs = path.join(root, filePath);
  if (!abs.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    // SPA fallback so /company/RELIANCE refresh keeps the details screen
    const spaIndex = preferDist
      ? path.join(distDir, "index.html")
      : path.join(__dirname, "index.html");
    if (fs.existsSync(spaIndex)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(spaIndex).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(abs);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(abs).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      cooldownMs: COOLDOWN_MS,
      remainingMs: cooldownRemaining(),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/logo") {
    const src = url.searchParams.get("src") || "";
    if (!isAllowedLogoUrl(src)) {
      return sendJson(res, 400, { error: "Unsupported logo source." });
    }
    try {
      const { buf, contentType } = await fetchLogoBytes(src);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Content-Length": buf.length,
      });
      res.end(buf);
    } catch (err) {
      console.warn("logo proxy failed:", err?.message || err);
      res.writeHead(404);
      res.end();
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/search") {
    const q = url.searchParams.get("q") || "";
    if (q.trim().length < 1) {
      return sendJson(res, 200, { results: [], source: null });
    }
    if (q.length > 64) {
      return sendJson(res, 400, {
        results: [],
        error: "Search query is too long.",
      });
    }
    try {
      const { results, source } = await liveSearch(q);
      return sendJson(res, 200, { results, source });
    } catch (err) {
      console.error(err);
      return sendJson(res, 502, {
        results: [],
        error: "Search is unavailable right now.",
        detail: String(err?.message || err),
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/cooldown") {
    return sendJson(res, 200, {
      remainingMs: cooldownRemaining(),
      cooldownMs: COOLDOWN_MS,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/company") {
    const pathParam = url.searchParams.get("path") || "";
    const symbol = (url.searchParams.get("symbol") || "").trim();

    if (!pathParam && !symbol) {
      return sendJson(res, 400, {
        error: "Pick a company from the search suggestions first.",
      });
    }

    if (COOLDOWN_MS > 0) {
      const remaining = cooldownRemaining();
      if (remaining > 0) {
        return sendJson(res, 429, {
          error: "Please wait before looking up another company.",
          remainingMs: remaining,
          cooldownMs: COOLDOWN_MS,
        });
      }
    }

    try {
      const data = await fetchCompany(pathParam || symbol, symbol);
      if (COOLDOWN_MS > 0) {
        nextAllowedAt = Date.now() + COOLDOWN_MS;
      }
      return sendJson(res, 200, {
        ...data,
        symbol: data.symbol || symbol,
        fetchedAt: new Date().toISOString(),
        nextAllowedAt: COOLDOWN_MS > 0 ? nextAllowedAt : 0,
        cooldownMs: COOLDOWN_MS,
      });
    } catch (err) {
      console.error(err);
      return sendJson(res, 502, {
        error:
          "Could not fetch company data. Is Firecrawl installed and logged in? Try: firecrawl --version --auth-status",
        detail: String(err?.message || err),
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/ohlc") {
    const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
    if (!symbol) return sendJson(res, 400, { bars: [], error: "symbol required" });
    try {
      const bars = await fetchOhlcBars(symbol);
      return sendJson(res, 200, { bars, symbol });
    } catch (err) {
      console.error(err);
      return sendJson(res, 502, {
        bars: [],
        error: "Could not load price history",
        detail: String(err?.message || err),
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/news") {
    const symbol = (url.searchParams.get("symbol") || "").trim();
    const name = (url.searchParams.get("name") || "").trim();
    if (!symbol && !name) {
      return sendJson(res, 400, { items: [], error: "symbol or name required" });
    }
    try {
      const items = await fetchScoredNews(symbol, name);
      return sendJson(res, 200, { items });
    } catch (err) {
      console.error(err);
      return sendJson(res, 502, {
        items: [],
        error: "Could not load news",
        detail: String(err?.message || err),
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/macro") {
    const sector = (url.searchParams.get("sector") || "").trim();
    try {
      const markers = await fetchMacroMarkers();
      return sendJson(res, 200, { sector: sector || null, markers, error: null });
    } catch (err) {
      console.error(err);
      return sendJson(res, 200, {
        sector: sector || null,
        markers: {},
        error: String(err?.message || err),
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/persist/status") {
    return sendJson(res, 200, {
      configured: supabaseConfigured(),
      url: SUPABASE_URL || null,
    });
  }

  if (url.pathname === "/api/desk-runs") {
    if (req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        if (!body) return sendJson(res, 400, { error: "JSON body required" });
        const row = await insertDeskRun(body);
        return sendJson(res, 201, { ok: true, run: row });
      } catch (err) {
        console.error("[desk-runs]", err);
        return sendJson(res, err.status || 500, {
          error: String(err.message || err),
          details: err.details || null,
        });
      }
    }
    if (req.method === "GET") {
      try {
        const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
        const latest = url.searchParams.get("latest") === "1";
        const table = latest ? "latest_desk_runs" : "desk_runs";
        let query = "?select=*&order=created_at.desc&limit=50";
        if (symbol) query = `?symbol=eq.${encodeURIComponent(symbol)}&select=*&order=created_at.desc&limit=20`;
        const rows = await supabaseRest(table, { query });
        return sendJson(res, 200, { runs: rows || [] });
      } catch (err) {
        console.error("[desk-runs]", err);
        return sendJson(res, err.status || 500, {
          error: String(err.message || err),
        });
      }
    }
  }

  if (req.method === "GET") {
    return serveStatic(req, res);
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Stock Glance → http://0.0.0.0:${PORT}`);
  if (COOLDOWN_MS > 0) {
    console.log(`Cooldown between company lookups: ${COOLDOWN_MS / 1000}s`);
  } else {
    console.log("Cooldown disabled (set COOLDOWN_MS to enable)");
  }
  console.log(
    supabaseConfigured()
      ? `Supabase persistence → ${SUPABASE_URL}`
      : "Supabase persistence off (add SUPABASE_URL + key to .env)"
  );
});
