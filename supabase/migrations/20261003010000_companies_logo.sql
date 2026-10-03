-- Cache company website + logo URL when discovered during desk loads.
alter table public.companies
  add column if not exists website text,
  add column if not exists logo_url text;
