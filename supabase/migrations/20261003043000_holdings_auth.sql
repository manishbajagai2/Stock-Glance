-- Replace global positions with per-user holdings (Supabase Auth + RLS)

drop table if exists public.positions cascade;

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symbol text not null,
  stock_name text not null,
  quantity numeric not null check (quantity > 0),
  avg_price numeric not null check (avg_price > 0),
  buy_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index holdings_user_id_idx on public.holdings (user_id);

alter table public.holdings enable row level security;

create policy holdings_select_own on public.holdings
  for select to authenticated
  using (user_id = auth.uid());

create policy holdings_insert_own on public.holdings
  for insert to authenticated
  with check (user_id = auth.uid());

create policy holdings_delete_own on public.holdings
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.holdings to authenticated;
revoke all on public.holdings from anon;
