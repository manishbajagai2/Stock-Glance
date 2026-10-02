# Stock Glance

Private India-equity decision desk. Search a NSE/BSE name or symbol, pull Screener + ScanX + Finology, then work through Verdict, Forecast, Fundamentals, Technicals, News, and Macro — with long-term vs swing horizon weights. Logged-in users manage a private **My Holdings** list (Google OAuth + Supabase RLS).

## Features

- **Search → company desk** with sticky horizon control (`long` | `swing`)
- **Multi-source fundamentals** (Screener → ScanX → Finology soft-fail)
- **Client-side analysis**: sector models, levels, verdict mix, analyst process, forecast (forward PE/EPS/price + desk blend)
- **Glance viz**: score rings, levels strip, scenario bars, fit meters
- **My Holdings** (`/holdings`): per-user holdings via Supabase Auth (Google); add / list / remove only in v1
- **Desk runs**: settled analysis snapshots in Supabase (`companies`, `desk_runs`)

## Stack

- Vite + React + TypeScript + Tailwind + shadcn
- Node API (`server.mjs`) for search, company scrape, OHLC, news, macro, and desk-run writes
- `@supabase/supabase-js` in the browser (anon key) for Auth + holdings RLS
- Firecrawl for page retrieval where needed

## Setup

```bash
npm install
cp .env.example .env
# Fill VITE_SUPABASE_* and server SUPABASE_* (see below)
npm run dev
```

- Web: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3456](http://localhost:3456)

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` (Vite) | Supabase project URL for the browser client |
| `VITE_SUPABASE_ANON_KEY` | `.env` (Vite) | Anon/publishable key — **never** put the service role here |
| `SUPABASE_URL` | `.env` (server) | Same project URL for desk-run persistence |
| `SUPABASE_ANON_KEY` | `.env` (server) | Server PostgREST for `desk_runs` |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` (optional, server only) | Not required for holdings; keep out of Vite |
| `PORT` | optional | API port (default `3456`) |
| `COOLDOWN_MS` | optional | Delay between company lookups |

Never commit `.env`. Use `.env.example` as the template.

### Supabase Auth (Google OAuth)

The error `Unsupported provider: provider is not enabled` means Google is still off in the project. Enable it here (this cannot be done from the app alone — you need a Google OAuth Client ID/Secret):

1. Open **[Auth → Providers → Google](https://supabase.com/dashboard/project/lsehraixpwfefdweywme/auth/providers)** for project `stock-glance`.
2. Toggle **Google** on and paste **Client ID** + **Client Secret** from [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) (create an OAuth 2.0 Client ID of type “Web application”).
3. In that Google credential, set **Authorized redirect URI** to:  
   `https://lsehraixpwfefdweywme.supabase.co/auth/v1/callback`
4. In Supabase **Authentication → URL configuration**, add:
   - `http://localhost:5173`
   - `http://localhost:5173/**`
   - your production origin (and `/**`) when deployed
5. Save, then use **Sign in / Sign up** in the app again (same button for new and returning users).

### GitHub card on the Supabase overview

**“GITHUB — No repository connected”** is optional. It links the Supabase project to a GitHub repo for deployments/migrations — it is **not** required for Sign in / My Holdings.

To connect (optional): Supabase dashboard → project **stock-glance** → **Project Settings → Integrations → GitHub** (or the GitHub card on the overview) → authorize and select [`manishbajagai2/Stock-Glance`](https://github.com/manishbajagai2/Stock-Glance). Auth will still use **Google**, not GitHub login, unless you separately enable a GitHub auth provider.

### Holdings migration

SQL lives at [`supabase/migrations/20261003043000_holdings_auth.sql`](supabase/migrations/20261003043000_holdings_auth.sql).

It drops the legacy global `positions` table and creates `public.holdings` with:

- `user_id` → `auth.users` (cascade), default `auth.uid()`
- unique `(user_id, symbol)`
- RLS: select / insert / delete for `authenticated` where `user_id = auth.uid()` (no update in v1)

Apply via Supabase SQL editor, CLI (`supabase db push`), or MCP `apply_migration` if you have not already.

## Deploy (frontend + API together)

Best fit for this personal app: **one Node service** that builds Vite into `dist/` and serves both `/api/*` and the SPA. Scrapes can take 30–90s, so serverless (Vercel) is a poor fit.

Recommended hosts:
1. **[Railway](https://railway.app)** (preferred) — Docker, no idle sleep on paid hobby
2. **[Render](https://render.com)** free web service — may spin down when idle (cold starts)

### Env vars on the host

| Variable | Needed at | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | **build** | Baked into the JS bundle |
| `VITE_SUPABASE_ANON_KEY` | **build** | Baked into the JS bundle |
| `SUPABASE_URL` | runtime | Desk-run persistence |
| `SUPABASE_ANON_KEY` | runtime | Desk-run persistence |
| `FIRECRAWL_API_KEY` | runtime | From [firecrawl.dev](https://www.firecrawl.dev) → API Keys |
| `PORT` | runtime | Set automatically by Railway/Render |

### Railway

1. Push this repo to GitHub (already: `manishbajagai2/Stock-Glance`).
2. [railway.app/new](https://railway.app/new) → **Deploy from GitHub** → select `Stock-Glance`.
3. Add the env vars above (Variables tab). Redeploy once so the Vite build sees `VITE_*`.
4. Generate a public domain (Settings → Networking).
5. In Supabase **Authentication → URL configuration**, add:  
   `https://YOUR-RAILWAY-DOMAIN` and `https://YOUR-RAILWAY-DOMAIN/**`  
   (and the same origins in Google OAuth if required).

Local Docker smoke test:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -t stock-glance .
docker run --rm -p 3456:3456 \
  -e SUPABASE_URL -e SUPABASE_ANON_KEY -e FIRECRAWL_API_KEY \
  -e VITE_SUPABASE_URL -e VITE_SUPABASE_ANON_KEY \
  stock-glance
```

### Render (Blueprint)

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → connect `Stock-Glance` (uses [`render.yaml`](render.yaml)).
2. Fill the prompted secrets (`VITE_*`, `SUPABASE_*`, `FIRECRAWL_API_KEY`).
3. After deploy, add the Render URL to Supabase Auth redirect allow-list (same as Railway step 5).

Config files: [`Dockerfile`](Dockerfile), [`railway.toml`](railway.toml), [`render.yaml`](render.yaml).

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
5. **My Position** — read-only, only when the logged-in user holds that symbol  

URL state: `?tab=forecast&horizon=long` · Holdings: `/holdings`

## License

Private research playground.
