-- Data-driven academic mail workspace: saved views, triage preferences and strict free-only AI state.
create table if not exists public.mail_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 workspace jsonb not null default '{"compact":false,"show_statistics":true,"views":[{"id":"all","title":"全部邮件","kind":"all"},{"id":"important","title":"重要邮件","kind":"important"},{"id":"submission","title":"投稿往来","kind":"submission_update"},{"id":"spam","title":"垃圾邮件备份","kind":"spam"}]}'::jsonb,
 ai_enabled boolean not null default false,
 ai_model text not null default 'glm-4.7-flash' check(ai_model in ('glm-4.7-flash','glm-4.5-flash')),
 ai_daily_limit integer not null default 20 check(ai_daily_limit between 0 and 50),
 ai_analyze_existing boolean not null default false,
 ai_key_ready boolean not null default false,
 last_ai_error text,
 updated_at timestamptz not null default now(),
 constraint mail_workspace_size check (octet_length(workspace::text) <= 16000)
);
alter table public.mail_preferences enable row level security;
grant select,insert,update on public.mail_preferences to authenticated;
create policy "mail_prefs_select" on public.mail_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy "mail_prefs_insert" on public.mail_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy "mail_prefs_update" on public.mail_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

alter table public.mail_messages add column if not exists ai_summary text;
alter table public.mail_messages add column if not exists ai_tags text[] not null default '{}';
alter table public.mail_messages add column if not exists ai_action text;
alter table public.mail_messages add column if not exists ai_priority smallint check (ai_priority between 0 and 3);
alter table public.mail_messages add column if not exists ai_analyzed_at timestamptz;
alter table public.mail_messages add column if not exists ai_model text;
alter table public.mail_messages add column if not exists ai_state text not null default 'pending'
check(ai_state in ('pending','done','skipped','error'));
alter table public.mail_messages add column if not exists ai_error text;
create index if not exists mail_ai_queue_idx on public.mail_messages(user_id,ai_state,first_saved_at);

-- private Vault holds API keys. Only service_role can invoke helpers.
create table if not exists mail_private.ai_credentials(
 user_id uuid primary key references auth.users(id) on delete cascade,
 vault_id uuid not null,
 updated_at timestamptz not null default now()
);
alter table mail_private.ai_credentials enable row level security;
revoke all on mail_private.ai_credentials from public,anon,authenticated;
create or replace function public.mail_save_ai_key(p_user_id uuid,p_secret text)
returns void language plpgsql security definer set search_path=''
as $$
declare v uuid;
begin
 if length(p_secret)<12 or length(p_secret)>2048 then raise exception 'Invalid API key length'; end if;
 select vault_id into v from mail_private.ai_credentials where user_id=p_user_id;
 if v is null then
  v:=vault.create_secret(p_secret,'sh-mail-ai-'||p_user_id::text,'Z.AI mail analysis key');
  insert into mail_private.ai_credentials(user_id,vault_id) values(p_user_id,v);
 else
  perform vault.update_secret(v,p_secret);
  update mail_private.ai_credentials set updated_at=now() where user_id=p_user_id;
 end if;
end; $$;
create or replace function public.mail_read_ai_key(p_user_id uuid)
returns text language sql security definer set search_path=''
as $$ select d.decrypted_secret from mail_private.ai_credentials c
join vault.decrypted_secrets d on d.id=c.vault_id where c.user_id=p_user_id limit 1 $$;
revoke all on function public.mail_save_ai_key(uuid,text) from public,anon,authenticated;
revoke all on function public.mail_read_ai_key(uuid) from public,anon,authenticated;
grant execute on function public.mail_save_ai_key(uuid,text) to service_role;
grant execute on function public.mail_read_ai_key(uuid) to service_role;

create table if not exists mail_private.ai_usage(
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_date date not null default (now() at time zone 'utc')::date,
 requests integer not null default 0,
 primary key(user_id,usage_date)
);
alter table mail_private.ai_usage enable row level security;
revoke all on mail_private.ai_usage from public,anon,authenticated;
create or replace function public.mail_claim_ai_slot(p_user_id uuid,p_max integer)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v integer;
begin
 if p_max<1 then return false; end if;
 insert into mail_private.ai_usage(user_id,usage_date,requests)
 values(p_user_id,(now() at time zone 'utc')::date,0) on conflict do nothing;
 update mail_private.ai_usage set requests=requests+1
 where user_id=p_user_id and usage_date=(now() at time zone 'utc')::date and requests<p_max
 returning requests into v;
 return v is not null;
end; $$;
revoke all on function public.mail_claim_ai_slot(uuid,integer) from public,anon,authenticated;
grant execute on function public.mail_claim_ai_slot(uuid,integer) to service_role;
