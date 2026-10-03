-- Stock Glance: structured persistence for companies, desk runs (forecast/verdict), and positions

create extension if not exists pgcrypto;

create table public.companies (
  symbol text primary key,
  name text not null,
  path text,
  sector text,
  industry text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.desk_runs (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.companies (symbol) on delete cascade,
  horizon text not null check (horizon in ('long', 'swing')),
  spot_price numeric,
  fetched_at timestamptz,
  sources text[] not null default '{}',

  -- Verdict (queryable)
  action text,
  verdict_label text,
  composite numeric,
  verdict_confidence numeric,
  provisional boolean not null default false,

  -- Forecast (queryable)
  desk_forecast numeric,
  forward_price numeric,
  forward_pe numeric,
  forward_eps numeric,
  trailing_pe numeric,
  trailing_eps numeric,
  growth_rate numeric,
  growth_source text,
  upside_pct numeric,
  fair_low numeric,
  fair_high numeric,
  forecast_confidence numeric,
  pe_source text,
  prob_weighted_price numeric,

  -- Pillar scores
  fund_score numeric,
  tech_score numeric,
  sentiment_score numeric,
  macro_score numeric,
  swing_fit numeric,
  long_fit numeric,
  process_confidence numeric,

  -- Narrative
  consolidation_net text,
  drivers text[] not null default '{}',
  risks text[] not null default '{}',

  -- Full structured payloads for drill-down
  forecast jsonb not null default '{}'::jsonb,
  verdict jsonb not null default '{}'::jsonb,
  decision jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index desk_runs_symbol_created_idx
  on public.desk_runs (symbol, created_at desc);
create index desk_runs_horizon_created_idx
  on public.desk_runs (horizon, created_at desc);
create index desk_runs_action_idx
  on public.desk_runs (action);

create table public.positions (
  symbol text primary key references public.companies (symbol) on delete cascade,
  name text not null,
  path text not null,
  avg_price numeric not null check (avg_price > 0),
  quantity numeric not null check (quantity > 0),
  max_risk_pct numeric default 1,
  thesis_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Latest run per symbol+horizon (security_invoker so RLS applies)
create view public.latest_desk_runs
with (security_invoker = true) as
select distinct on (symbol, horizon) *
from public.desk_runs
order by symbol, horizon, created_at desc;

alter table public.companies enable row level security;
alter table public.desk_runs enable row level security;
alter table public.positions enable row level security;

-- Personal research desk: no auth yet. Open anon policies; tighten when Auth is added.
create policy companies_anon_all on public.companies
  for all to anon, authenticated using (true) with check (true);

create policy desk_runs_anon_all on public.desk_runs
  for all to anon, authenticated using (true) with check (true);

create policy positions_anon_all on public.positions
  for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.companies to anon, authenticated;
grant select, insert, update, delete on public.desk_runs to anon, authenticated;
grant select, insert, update, delete on public.positions to anon, authenticated;
grant select on public.latest_desk_runs to anon, authenticated;
