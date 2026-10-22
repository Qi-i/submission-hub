-- Include Microsoft Graph folders in the same owner-scoped archive dashboard
-- as IMAP. Both private cursor tables remain inaccessible from the client.
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
  select count(*) as folders,count(*) filter(where is_pending) as pending
  from (
   select s.backfill_before>0 as is_pending
   from mail_private.scan_state s
   where s.account_id=a.id and a.provider<>'outlook'
   union all
   select o.next_link is not null as is_pending
   from mail_private.outlook_folder_cursors o
   where o.account_id=a.id and a.provider='outlook'
  ) states
 ) c on true
 where a.user_id = (select auth.uid());
$$;

revoke all on function public.mail_account_progress() from public, anon;
grant execute on function public.mail_account_progress() to authenticated;
