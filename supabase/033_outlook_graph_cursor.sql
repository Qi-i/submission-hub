-- All cursor operations are service-role-only. No browser access to continuation URLs.
create or replace function public.mail_get_outlook_cursors(p_account_id uuid)
returns table(folder_id text,folder_name text,next_link text)
language sql security definer set search_path=''
as $$select c.folder_id,c.folder_name,c.next_link from mail_private.outlook_folder_cursors c
where c.account_id=p_account_id$$;
create or replace function public.mail_save_outlook_cursor(
 p_account_id uuid,p_folder_id text,p_folder_name text,p_next_link text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if length(p_folder_id)>600 or length(p_folder_name)>400 or length(coalesce(p_next_link,''))>4000 then
   raise exception 'Invalid Graph cursor';end if;
 insert into mail_private.outlook_folder_cursors(account_id,folder_id,folder_name,next_link)
 values(p_account_id,p_folder_id,p_folder_name,p_next_link)
 on conflict(account_id,folder_id) do update set folder_name=excluded.folder_name,
  next_link=excluded.next_link,updated_at=now();
end;$$;
revoke all on function public.mail_get_outlook_cursors(uuid) from public,anon,authenticated;
revoke all on function public.mail_save_outlook_cursor(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.mail_get_outlook_cursors(uuid) to service_role;
grant execute on function public.mail_save_outlook_cursor(uuid,text,text,text) to service_role;
