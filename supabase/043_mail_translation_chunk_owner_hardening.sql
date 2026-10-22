-- Avoid public default table grants; chunks belong to both the signed-in
-- user and an existing message that the same user owns.
revoke all on public.mail_translation_chunks from public, anon;
grant select,insert,update on public.mail_translation_chunks to authenticated;

drop policy if exists mail_translation_chunks_owner_insert on public.mail_translation_chunks;
create policy mail_translation_chunks_owner_insert
 on public.mail_translation_chunks for insert to authenticated
 with check (
  (select auth.uid())=user_id
  and exists (select 1 from public.mail_messages m
   where m.id=message_id and m.user_id=(select auth.uid()))
 );

drop policy if exists mail_translation_chunks_owner_update on public.mail_translation_chunks;
create policy mail_translation_chunks_owner_update
 on public.mail_translation_chunks for update to authenticated
 using ((select auth.uid())=user_id)
 with check (
  (select auth.uid())=user_id
  and exists (select 1 from public.mail_messages m
   where m.id=message_id and m.user_id=(select auth.uid()))
 );
