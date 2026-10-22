create or replace function public.mail_delete_label(p_label_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare l_name text; own uuid;
begin
 own := (select auth.uid());
 if own is null then raise exception 'Unauthorized';end if;
 select name into l_name from public.mail_labels where id=p_label_id and user_id=own for update;
 if l_name is null then raise exception 'Label not found';end if;
 update public.mail_messages set user_labels=array_remove(user_labels,l_name)
 where user_id=own and l_name=any(user_labels);
 delete from public.mail_labels where id=p_label_id and user_id=own;
end;$$;
revoke all on function public.mail_delete_label(uuid) from public,anon;
grant execute on function public.mail_delete_label(uuid) to authenticated;
