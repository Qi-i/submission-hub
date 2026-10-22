-- Mail connections are explicitly chosen per account; only encrypted transports are supported.
alter table public.mail_accounts
 add column if not exists imap_security text not null default 'ssl' check (imap_security in ('ssl','starttls')),
 add column if not exists smtp_security text not null default 'ssl' check (smtp_security in ('ssl','starttls')),
 add column if not exists imap_username text,
 add column if not exists smtp_username text;
alter table public.mail_accounts drop constraint if exists mail_accounts_imap_port_safe;
alter table public.mail_accounts add constraint mail_accounts_imap_port_safe check (imap_port in (993,143));
alter table public.mail_accounts drop constraint if exists mail_accounts_smtp_port_safe;
alter table public.mail_accounts add constraint mail_accounts_smtp_port_safe check (smtp_port in (465,587));

create table if not exists public.mail_ai_endpoints (
 id uuid primary key default extensions.gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null check (char_length(label) between 1 and 80),
 api_url text not null check (char_length(api_url) between 18 and 500),
 model text not null check (char_length(model) between 1 and 128),
 declared_free boolean not null default false,
 allow_paid boolean not null default false,
 key_ready boolean not null default false,
 last_test_at timestamptz,
 last_test_status text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists mail_ai_endpoints_owner on public.mail_ai_endpoints(user_id);
alter table public.mail_ai_endpoints enable row level security;
grant select,insert,update,delete on public.mail_ai_endpoints to authenticated;
create policy "ai_endpoint_owner_read" on public.mail_ai_endpoints for select to authenticated using ((select auth.uid())=user_id);
create policy "ai_endpoint_owner_add" on public.mail_ai_endpoints for insert to authenticated with check ((select auth.uid())=user_id);
create policy "ai_endpoint_owner_edit" on public.mail_ai_endpoints for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "ai_endpoint_owner_delete" on public.mail_ai_endpoints for delete to authenticated using ((select auth.uid())=user_id);

alter table public.mail_preferences
 add column if not exists ai_endpoint_id uuid references public.mail_ai_endpoints(id) on delete set null,
 add column if not exists ai_system_prompt text not null default '请概述邮件主题、关键事实与待处理事项，并判断重要性、可能的处理期限及与投稿论文的关联。没有依据的信息不要推测。',
 add column if not exists ai_allow_paid boolean not null default false;
alter table public.mail_preferences add constraint ai_prompt_length check (char_length(ai_system_prompt) between 1 and 6000);

create table if not exists mail_private.ai_endpoint_credentials (
 endpoint_id uuid primary key references public.mail_ai_endpoints(id) on delete cascade,
 vault_id uuid not null,
 updated_at timestamptz not null default now()
);
revoke all on mail_private.ai_endpoint_credentials from public,anon,authenticated;
alter table mail_private.ai_endpoint_credentials enable row level security;
create or replace function public.mail_save_endpoint_key(p_endpoint_id uuid,p_secret text)
returns void language plpgsql security definer set search_path=''
as $$
declare v uuid;
begin
 if char_length(p_secret)<8 or char_length(p_secret)>4096 then raise exception 'Invalid key'; end if;
 if not exists(select 1 from public.mail_ai_endpoints where id=p_endpoint_id) then raise exception 'Unknown endpoint'; end if;
 select vault_id into v from mail_private.ai_endpoint_credentials where endpoint_id=p_endpoint_id;
 if v is null then
   v:=vault.create_secret(p_secret,'sh-mail-model-'||p_endpoint_id::text,'Mail AI provider API Key');
   insert into mail_private.ai_endpoint_credentials(endpoint_id,vault_id) values (p_endpoint_id,v);
 else
   perform vault.update_secret(v,p_secret);
   update mail_private.ai_endpoint_credentials set updated_at=now() where endpoint_id=p_endpoint_id;
 end if;
end;$$;
create or replace function public.mail_read_endpoint_key(p_endpoint_id uuid)
returns text language sql security definer set search_path=''
as $$select d.decrypted_secret from mail_private.ai_endpoint_credentials c
 join vault.decrypted_secrets d on d.id=c.vault_id where c.endpoint_id=p_endpoint_id limit 1$$;
revoke all on function public.mail_save_endpoint_key(uuid,text) from public,anon,authenticated;
revoke all on function public.mail_read_endpoint_key(uuid) from public,anon,authenticated;
grant execute on function public.mail_save_endpoint_key(uuid,text) to service_role;
grant execute on function public.mail_read_endpoint_key(uuid) to service_role;

-- User-controlled and visible instructions, never capable of bypassing hard-coded safety rules.
