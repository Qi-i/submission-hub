-- Cursor isolation and cloud archive references.
create table if not exists mail_private.scan_state(
 account_id uuid not null references public.mail_accounts(id) on delete cascade,
 folder_key text not null,
 recent_uid bigint not null default 0,
 backfill_before bigint,
 scanned_at timestamptz,
 primary key(account_id,folder_key)
);
revoke all on mail_private.scan_state from public,anon,authenticated;
alter table mail_private.scan_state enable row level security;
alter table public.mail_messages add column if not exists cloud_archive_path text;
create or replace function public.mail_get_scan_state(p_account_id uuid)
returns table(folder_key text,recent_uid bigint,backfill_before bigint)
language sql security definer set search_path=''
as $$ select s.folder_key,s.recent_uid,s.backfill_before from mail_private.scan_state s where s.account_id=p_account_id $$;
create or replace function public.mail_save_scan_state(p_account_id uuid,p_folder_key text,p_recent bigint,p_before bigint)
returns void language sql security definer set search_path=''
as $$ insert into mail_private.scan_state(account_id,folder_key,recent_uid,backfill_before,scanned_at)
values(p_account_id,p_folder_key,p_recent,p_before,now())
on conflict(account_id,folder_key) do update set recent_uid=greatest(mail_private.scan_state.recent_uid,excluded.recent_uid),
backfill_before=excluded.backfill_before,scanned_at=now() $$;
revoke all on function public.mail_get_scan_state(uuid) from public,anon,authenticated;
revoke all on function public.mail_save_scan_state(uuid,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.mail_get_scan_state(uuid) to service_role;
grant execute on function public.mail_save_scan_state(uuid,text,bigint,bigint) to service_role;
