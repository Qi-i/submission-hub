alter table public.journal_profiles
  add column if not exists rank_data jsonb not null default '{}'::jsonb,
  add column if not exists rank_updated_at timestamptz;

create table if not exists public.external_api_cache (
  cache_key text primary key,
  api_name text not null,
  response_data jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_external_api_cache_api_fetched
  on public.external_api_cache(api_name, fetched_at desc);

alter table public.external_api_cache enable row level security;
revoke all on public.external_api_cache from anon, authenticated;

create table if not exists public.external_api_rate_limits (
  api_name text primary key,
  last_requested_at timestamptz not null default to_timestamp(0)
);

alter table public.external_api_rate_limits enable row level security;
revoke all on public.external_api_rate_limits from anon, authenticated;

insert into public.external_api_rate_limits(api_name)
values ('easyscholar')
on conflict (api_name) do nothing;

create or replace function public.acquire_external_api_slot(
  p_api_name text,
  p_interval_ms integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acquired boolean := false;
begin
  insert into public.external_api_rate_limits(api_name)
  values (p_api_name)
  on conflict (api_name) do nothing;

  update public.external_api_rate_limits
  set last_requested_at = clock_timestamp()
  where api_name = p_api_name
    and last_requested_at <= clock_timestamp() - make_interval(secs => greatest(p_interval_ms, 500)::double precision / 1000.0)
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

revoke all on function public.acquire_external_api_slot(text, integer) from public, anon, authenticated;
grant execute on function public.acquire_external_api_slot(text, integer) to service_role;