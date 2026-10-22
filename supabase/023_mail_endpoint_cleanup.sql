-- Remove model Vault secrets when users delete an endpoint.
create or replace function public.mail_destroy_endpoint_secret(p_endpoint_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;
begin
 select vault_id into sid from mail_private.ai_endpoint_credentials where endpoint_id=p_endpoint_id;
 if sid is not null then
   perform vault.delete_secret(sid);
   delete from mail_private.ai_endpoint_credentials where endpoint_id=p_endpoint_id;
 end if;
end;$$;
revoke all on function public.mail_destroy_endpoint_secret(uuid) from public,anon,authenticated;
grant execute on function public.mail_destroy_endpoint_secret(uuid) to service_role;