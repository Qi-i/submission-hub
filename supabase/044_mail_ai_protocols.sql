-- Shared protocol routing, preserving existing Chat Completions rows and Vault secrets.
alter table public.mail_ai_endpoints
 add column if not exists api_protocol text not null default 'chat' check(api_protocol in ('chat','messages','responses','gemini')),
 add column if not exists auth_scheme text not null default 'bearer' check(auth_scheme in ('bearer','x-api-key','x-goog-api-key')),
 add column if not exists chat_token_field text not null default 'max_tokens' check(chat_token_field in ('max_tokens','max_completion_tokens')),
 add column if not exists config_revision uuid not null default gen_random_uuid();
alter table public.mail_ai_endpoints
 add column if not exists vision_test_status text;
alter table public.mail_preferences
 add column if not exists ai_task_routes jsonb not null default '{}'::jsonb
 check(jsonb_typeof(ai_task_routes)='object' and octet_length(ai_task_routes::text)<=12000);
alter table public.mail_ai_endpoints drop constraint if exists mail_endpoint_protocol_auth;
alter table public.mail_ai_endpoints add constraint mail_endpoint_protocol_auth check(
 auth_scheme='bearer' or (api_protocol='messages' and auth_scheme='x-api-key')
 or (api_protocol='gemini' and auth_scheme='x-goog-api-key'));
-- Clients may edit configuration but may not forge the verified state or revision.
revoke insert, update on public.mail_ai_endpoints from authenticated;
grant insert(user_id,label,api_url,model,declared_free,allow_paid,api_protocol,auth_scheme,chat_token_field)
 on public.mail_ai_endpoints to authenticated;
grant update(label,api_url,model,declared_free,allow_paid,api_protocol,auth_scheme,chat_token_field,updated_at)
 on public.mail_ai_endpoints to authenticated;

create or replace function public.mail_invalidate_changed_ai_endpoint()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if (new.api_url,new.model,new.declared_free,new.allow_paid,new.api_protocol,new.auth_scheme,new.chat_token_field)
    is distinct from
    (old.api_url,old.model,old.declared_free,old.allow_paid,old.api_protocol,old.auth_scheme,old.chat_token_field) then
   new.config_revision:=gen_random_uuid();
   new.key_ready:=false;
   new.last_test_at:=null;
   new.last_test_latency_ms:=null;
   new.vision_test_status:=null;
   new.last_test_status:='配置改变：请重新保存 Key 并测试';
 end if;
 return new;
end; $$;

create or replace function public.mail_disable_ai_after_endpoint_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.config_revision is distinct from old.config_revision then
   update public.mail_preferences set ai_enabled=false,ai_allow_paid=false
    where user_id=new.user_id and (ai_endpoint_id=new.id
     or ('endpoint:'||new.id::text)=any(ai_route_order)
     or coalesce(ai_task_routes->'mail_analysis'->'routes','[]'::jsonb) ? ('endpoint:'||new.id::text));
 end if;
 return null;
end; $$;

-- Bind Vault reads to the same immutable configuration generation as the URL.
create or replace function public.mail_read_endpoint_key_for_config(p_endpoint_id uuid,p_revision uuid)
returns text language sql security definer set search_path=''
as $$
 select public.mail_read_endpoint_key(e.id) from public.mail_ai_endpoints e
 where e.id=p_endpoint_id and e.config_revision=p_revision and e.key_ready
 limit 1
$$;
-- Serialize secret changes with config edits; rotate the revision and invalidate
-- prior test results in the same transaction. No plaintext is returned.
create or replace function public.mail_save_endpoint_key_for_config(p_endpoint_id uuid,p_revision uuid,p_secret text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 perform 1 from public.mail_ai_endpoints
  where id=p_endpoint_id and config_revision=p_revision for update;
 if not found then return false; end if;
 perform public.mail_save_endpoint_key(p_endpoint_id,p_secret);
 update public.mail_ai_endpoints set key_ready=true,config_revision=gen_random_uuid(),
  last_test_at=null,last_test_latency_ms=null,last_test_status=null,vision_test_status=null,updated_at=now()
  where id=p_endpoint_id;
 return true;
end; $$;
revoke all on function public.mail_read_endpoint_key_for_config(uuid,uuid) from public,anon,authenticated;
revoke all on function public.mail_save_endpoint_key_for_config(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mail_read_endpoint_key_for_config(uuid,uuid) to service_role;
grant execute on function public.mail_save_endpoint_key_for_config(uuid,uuid,text) to service_role;
