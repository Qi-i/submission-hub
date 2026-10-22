-- Durable mailbox health and independent SMTP credentials (service-only).
alter table public.mail_accounts
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_processed integer not null default 0,
  add column if not exists last_scanned_folders integer not null default 0,
  add column if not exists smtp_has_separate_key boolean not null default false;
create index if not exists mail_accounts_retry_idx on public.mail_accounts(next_attempt_at)
where enabled = true and cloud_state in ('ready','error');

create table if not exists mail_private.smtp_credentials(
 account_id uuid primary key references public.mail_accounts(id) on delete cascade,
 vault_id uuid not null unique,
 updated_at timestamptz not null default now()
);
revoke all on mail_private.smtp_credentials from public,anon,authenticated;
alter table mail_private.smtp_credentials enable row level security;

create or replace function public.mail_save_smtp_secret(p_account_id uuid,p_secret text)
returns void language plpgsql security definer set search_path=''
as $$
declare vid uuid;
begin
  if length(p_secret)<4 or length(p_secret)>4096 then raise exception 'invalid SMTP credential'; end if;
  if not exists(select 1 from public.mail_accounts where id=p_account_id) then raise exception 'unknown account'; end if;
  select vault_id into vid from mail_private.smtp_credentials where account_id=p_account_id;
  if vid is null then
   vid:=vault.create_secret(p_secret,'sh-smtp-'||p_account_id::text,'Submission Hub SMTP credential');
   insert into mail_private.smtp_credentials(account_id,vault_id) values(p_account_id,vid);
  else
   perform vault.update_secret(vid,p_secret);
   update mail_private.smtp_credentials set updated_at=now() where account_id=p_account_id;
  end if;
end; $$;
create or replace function public.mail_read_smtp_secret(p_account_id uuid)
returns text language sql security definer set search_path=''
as $$ select v.decrypted_secret from mail_private.smtp_credentials c
join vault.decrypted_secrets v on v.id=c.vault_id
where c.account_id=p_account_id limit 1 $$;
create or replace function public.mail_remove_smtp_secret(p_account_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare vid uuid;
begin
 select vault_id into vid from mail_private.smtp_credentials where account_id=p_account_id;
 if vid is not null then
   perform vault.delete_secret(vid);
   delete from mail_private.smtp_credentials where account_id=p_account_id;
 end if;
end; $$;
revoke all on function public.mail_save_smtp_secret(uuid,text) from public,anon,authenticated;
revoke all on function public.mail_read_smtp_secret(uuid) from public,anon,authenticated;
revoke all on function public.mail_remove_smtp_secret(uuid) from public,anon,authenticated;
grant execute on function public.mail_save_smtp_secret(uuid,text) to service_role;
grant execute on function public.mail_read_smtp_secret(uuid) to service_role;
grant execute on function public.mail_remove_smtp_secret(uuid) to service_role;
