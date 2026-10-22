-- Notify the connected browser only when a new archived email is inserted.
-- Postgres Changes applies mail_messages RLS; no mailbox secrets or AI API calls.
do $$
begin
 if not exists (
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='mail_messages'
 ) then
  alter publication supabase_realtime add table public.mail_messages;
 end if;
end $$;
