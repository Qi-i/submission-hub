-- Cloud-only mailbox acquisition. Secrets are Vault-encrypted and never stored in public.
alter table public.mail_accounts
  add column if not exists imap_host text,
  add column if not exists imap_port integer not null default 993,
  add column if not exists auth_kind text not null default 'password'
    check (auth_kind in ('password','xoauth2')),
  add column if not exists cloud_state text not null default 'not_configured'
    check (cloud_state in ('not_configured','ready','error','oauth_required')),
  add column if not exists last_checked_at timestamptz;

create schema if not exists mail_private;
revoke all on schema mail_private from public, anon, authenticated;
create table if not exists mail_private.credentials (
  account_id uuid primary key references public.mail_accounts(id) on delete cascade,
  vault_id uuid not null,
  updated_at timestamptz not null default now()
);
revoke all on mail_private.credentials from public, anon, authenticated;
alter table mail_private.credentials enable row level security;

-- Service-role-only procedures. Credentials never cross a browser-readable API.
create or replace function public.mail_save_cloud_secret(p_account_id uuid,p_secret text)
returns void language plpgsql security definer set search_path=''
as $$
declare vid uuid;
begin
  if p_secret is null or length(p_secret) < 4 or length(p_secret)>4096 then raise exception 'invalid credential'; end if;
  if not exists(select 1 from public.mail_accounts where id=p_account_id) then raise exception 'unknown account'; end if;
  select vault_id into vid from mail_private.credentials where account_id=p_account_id;
  if vid is null then
    vid:=vault.create_secret(p_secret, 'sh-mail-'||p_account_id::text, 'Submission Hub mail credential');
    insert into mail_private.credentials(account_id,vault_id) values(p_account_id,vid);
  else
    perform vault.update_secret(vid,p_secret);
    update mail_private.credentials set updated_at=now() where account_id=p_account_id;
  end if;
end;
$$;
create or replace function public.mail_read_cloud_secret(p_account_id uuid)
returns text language sql security definer set search_path=''
as $$ select v.decrypted_secret from mail_private.credentials c
  join vault.decrypted_secrets v on v.id=c.vault_id where c.account_id=p_account_id limit 1 $$;
revoke all on function public.mail_save_cloud_secret(uuid,text) from public,anon,authenticated;
revoke all on function public.mail_read_cloud_secret(uuid) from public,anon,authenticated;
grant execute on function public.mail_save_cloud_secret(uuid,text) to service_role;
grant execute on function public.mail_read_cloud_secret(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mail-originals','mail-originals',false,10485760,array['message/rfc822','application/octet-stream'])
on conflict(id) do nothing;
create policy "Owner can read original mail archives"
on storage.objects for select to authenticated
using (bucket_id='mail-originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Writes handled exclusively by authenticated Edge Function service role.

-- Independent cron credential; never insert its value into SQL cron job text.
do $$ begin
 if not exists(select 1 from vault.secrets where name='sh_mail_cloud_cron_key') then
   perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),
     'sh_mail_cloud_cron_key','Submission Hub cloud mail cron auth');
 end if;
end $$;
create or replace function public.mail_check_cron_token(p_token text)
returns boolean language sql security definer set search_path=''
as $$ select coalesce((select v.decrypted_secret=p_token
  from vault.decrypted_secrets v where v.name='sh_mail_cloud_cron_key' limit 1),false) $$;
revoke all on function public.mail_check_cron_token(text) from public,anon,authenticated;
grant execute on function public.mail_check_cron_token(text) to service_role;
