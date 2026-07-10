drop index if exists public.idx_external_api_cache_api_fetched;

drop policy if exists "Deny client access to external API cache" on public.external_api_cache;
create policy "Deny client access to external API cache"
on public.external_api_cache
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Deny client access to external API rate limits" on public.external_api_rate_limits;
create policy "Deny client access to external API rate limits"
on public.external_api_rate_limits
for all
to anon, authenticated
using (false)
with check (false);
