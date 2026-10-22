-- Cache timing per built-in GLM model, independent of platform key.
alter table public.mail_preferences
 add column if not exists ai_glm_probe_times jsonb not null default '{}'::jsonb;
alter table public.mail_preferences
 add constraint mail_glm_probe_times_size check (octet_length(ai_glm_probe_times::text)<=1024);
