-- Optional ordered multi-model routing; dormant for all existing users.
alter table public.mail_preferences
  add column if not exists ai_failover_enabled boolean not null default false,
  add column if not exists ai_route_order text[] not null default array['glm:glm-4.7-flash','glm:glm-4.5-flash']::text[],
  add column if not exists ai_slow_mode boolean not null default true,
  add column if not exists ai_max_wait_seconds integer not null default 65
    check (ai_max_wait_seconds between 20 and 90),
  add column if not exists ai_glm_probe_ms integer
    check (ai_glm_probe_ms between 0 and 120000);
alter table public.mail_ai_endpoints
  add column if not exists last_test_latency_ms integer
    check (last_test_latency_ms between 0 and 120000);
-- Each entry is resolved to a currently authorized *owner-scoped* endpoint by the worker.
-- Up to six routes, never copy or expose API keys in preferences.
alter table public.mail_preferences
  add constraint ai_route_limit check (cardinality(ai_route_order) <= 6);
