-- Mail index storage tiers and durable synchronization statistics.
alter table public.mail_messages
 add column if not exists storage_tier text not null default 'full'
 check (storage_tier in ('full','text','index'));
alter table public.mail_accounts
 add column if not exists last_added_at timestamptz,
 add column if not exists last_added_count integer not null default 0;

-- Return only statistics for the signed-in user's own mailboxes.
-- Cursor table remains private; no archive content or credentials are returned.
create or replace function public.mail_account_progress()
returns table (
 account_id uuid,
 archived_count bigint,
 full_count bigint,
 text_count bigint,
 index_count bigint,
 scanned_folders bigint,
 backfill_pending bigint,
 history_complete boolean,
 last_added_at timestamptz,
 last_added_count integer
)
language sql stable security definer set search_path = ''
as $$
 select a.id,coalesce(m.total,0),coalesce(m.full_n,0),
        coalesce(m.text_n,0),coalesce(m.index_n,0),
        coalesce(c.folders,0),coalesce(c.pending,0),
        (a.last_scanned_folders > 0
         and coalesce(c.folders,0) >= a.last_scanned_folders
         and coalesce(c.pending,0)=0),
        a.last_added_at,a.last_added_count
 from public.mail_accounts a
 left join lateral (
  select count(*) as total,
    count(*) filter(where storage_tier='full') as full_n,
    count(*) filter(where storage_tier='text') as text_n,
    count(*) filter(where storage_tier='index') as index_n
  from public.mail_messages m where m.account_id=a.id and m.user_id=a.user_id
 ) m on true
 left join lateral (
  select count(*) as folders,
    count(*) filter(where s.backfill_before>0) as pending
  from mail_private.scan_state s where s.account_id=a.id
 ) c on true
 where a.user_id = (select auth.uid());
$$;
revoke all on function public.mail_account_progress() from public, anon;
grant execute on function public.mail_account_progress() to authenticated;
