# Stock Glance

Private India-equity decision desk. Search a NSE/BSE name or symbol, pull Screener + ScanX + Finology, then work through Verdict, Forecast, Fundamentals, Technicals, News, Macro, and My Position — with long-term vs swing horizon weights.

## Features

- **Search → company desk** with sticky horizon control (`long` | `swing`)
- **Multi-source fundamentals** (Screener → ScanX → Finology soft-fail)
- **Client-side analysis**: sector models, levels, verdict mix, analyst process, forecast (forward PE/EPS/price + desk blend)
- **Glance viz**: score rings, levels strip, scenario bars, fit meters
- **Portfolio** (localStorage + Supabase sync)
- **Persistence**: settled desk runs and positions stored in Supabase (`companies`, `desk_runs`, `positions`)

## Stack

- Vite + React + TypeScript + Tailwind + shadcn
- Node API (`server.mjs`) for search, company scrape, OHLC, news, macro, and Supabase writes
- Firecrawl for page retrieval where needed
- Supabase Postgres for structured history

## Setup

```bash
npm install
cp .env.example .env
# Fill SUPABASE_URL + SUPABASE_ANON_KEY (and Firecrawl auth via CLI if used)
npm run dev
```

- Web: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3456](http://localhost:3456)

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | `.env` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `.env` | Publishable/anon key for PostgREST |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` (optional, server only) | Prefer for server writes once Auth is added |
| `PORT` | optional | API port (default `3456`) |
| `COOLDOWN_MS` | optional | Delay between company lookups |

Never commit `.env`. Use `.env.example` as the template.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | API + Vite together |
| `npm run dev:api` | API only |
| `npm run dev:web` | Vite only |
| `npm run build` | Typecheck + production build |
| `npm start` | API (serves built assets if present) |
| `npm run lint` | oxlint |

## Desk tabs

1. **Verdict** — action, confidence, levels, scenarios  
2. **Forecast** — desk forecast price, forward PE/EPS, fair band, consolidation  
3. **Process** — analyst checklist coverage  
4. **Fundamentals / Technicals / News / Macro** — pillar detail  
5. **My Position** — avg price, size, risk advice  

URL state: `?tab=forecast&horizon=long`

## License

Private research playground.
