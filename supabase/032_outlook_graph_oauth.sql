-- Microsoft delegated Graph OAuth2 device authorization. No browser-readable token storage.
alter table public.mail_accounts
 add column if not exists oauth_client_id uuid,
 add column if not exists oauth_identity text,
 add column if not exists oauth_scopes text;
alter table public.mail_accounts drop constraint if exists mail_accounts_auth_kind_check;
alter table public.mail_accounts add constraint mail_accounts_auth_kind_check
 check(auth_kind in('password','xoauth2','oauth2'));

create table if not exists mail_private.outlook_pending(
 account_id uuid primary key references public.mail_accounts(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 device_vault_id uuid not null,
 expires_at timestamptz not null,
 interval_seconds integer not null default 7,
 last_polled_at timestamptz,
 created_at timestamptz not null default now()
);
revoke all on mail_private.outlook_pending from public,anon,authenticated;
alter table mail_private.outlook_pending enable row level security;

create table if not exists mail_private.outlook_folder_cursors(
 account_id uuid not null references public.mail_accounts(id) on delete cascade,
 folder_id text not null,
 folder_name text not null,
 next_link text,
 updated_at timestamptz not null default now(),
 primary key(account_id,folder_id)
);
revoke all on mail_private.outlook_folder_cursors from public,anon,authenticated;
alter table mail_private.outlook_folder_cursors enable row level security;

create or replace function public.mail_clear_cloud_secret(p_account_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare vid uuid;
begin
 select vault_id into vid from mail_private.credentials where account_id=p_account_id;
 if vid is not null then
   perform vault.delete_secret(vid);
   delete from mail_private.credentials where account_id=p_account_id;
 end if;
end;$$;
revoke all on function public.mail_clear_cloud_secret(uuid) from public,anon,authenticated;
grant execute on function public.mail_clear_cloud_secret(uuid) to service_role;

create or replace function public.mail_save_outlook_pending(
 p_account_id uuid,p_owner_id uuid,p_device_code text,p_seconds integer,p_interval integer)
returns void language plpgsql security definer set search_path=''
as $$
declare vid uuid;
begin
 if length(p_device_code)>3000 or length(p_device_code)<8 or p_seconds<60 or p_seconds>1800 then
  raise exception 'Invalid device authorization'; end if;
 if not exists(select 1 from public.mail_accounts
  where id=p_account_id and user_id=p_owner_id and provider='outlook') then
  raise exception 'Account not found'; end if;
 select device_vault_id into vid from mail_private.outlook_pending where account_id=p_account_id;
 if vid is null then
  vid:=vault.create_secret(p_device_code,'sh-outlook-pending-'||p_account_id::text,'Temporary Microsoft OAuth device authorization');
 else
  perform vault.update_secret(vid,p_device_code);
 end if;
 insert into mail_private.outlook_pending(account_id,owner_id,device_vault_id,expires_at,interval_seconds,last_polled_at)
 values(p_account_id,p_owner_id,vid,now()+make_interval(secs=>p_seconds),greatest(5,least(p_interval,30)),null)
 on conflict(account_id) do update set device_vault_id=excluded.device_vault_id,
  owner_id=excluded.owner_id,expires_at=excluded.expires_at,
  interval_seconds=excluded.interval_seconds,last_polled_at=null,created_at=now();
end;$$;
create or replace function public.mail_load_outlook_pending(p_account_id uuid)
returns table(device_code text,expires_at timestamptz,interval_seconds integer,last_polled_at timestamptz)
language sql security definer set search_path=''
as $$ select v.decrypted_secret,c.expires_at,c.interval_seconds,c.last_polled_at
 from mail_private.outlook_pending c
 join vault.decrypted_secrets v on v.id=c.device_vault_id
 where c.account_id=p_account_id limit 1 $$;
create or replace function public.mail_poll_outlook_pending(p_account_id uuid)
returns void language sql security definer set search_path=''
as $$ update mail_private.outlook_pending set last_polled_at=now() where account_id=p_account_id $$;
create or replace function public.mail_clear_outlook_pending(p_account_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare vid uuid;
begin
 select device_vault_id into vid from mail_private.outlook_pending where account_id=p_account_id;
 if vid is not null then
  perform vault.delete_secret(vid);
  delete from mail_private.outlook_pending where account_id=p_account_id;
 end if;
end;$$;
revoke all on function public.mail_save_outlook_pending(uuid,uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.mail_load_outlook_pending(uuid) from public,anon,authenticated;
revoke all on function public.mail_poll_outlook_pending(uuid) from public,anon,authenticated;
revoke all on function public.mail_clear_outlook_pending(uuid) from public,anon,authenticated;
grant execute on function public.mail_save_outlook_pending(uuid,uuid,text,integer,integer) to service_role;
grant execute on function public.mail_load_outlook_pending(uuid) to service_role;
grant execute on function public.mail_poll_outlook_pending(uuid) to service_role;
grant execute on function public.mail_clear_outlook_pending(uuid) to service_role;
