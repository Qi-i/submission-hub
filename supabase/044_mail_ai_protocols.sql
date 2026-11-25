-- Shared protocol routing, preserving existing Chat Completions rows and Vault secrets.
alter table public.mail_ai_endpoints
 add column if not exists api_protocol text not null default 'chat' check(api_protocol in ('chat','messages','responses','gemini')),
 add column if not exists auth_scheme text not null default 'bearer' check(auth_scheme in ('bearer','x-api-key','x-goog-api-key')),
 add column if not exists chat_token_field text not null default 'max_tokens' check(chat_token_field in ('max_tokens','max_completion_tokens')),
 add column if not exists config_revision uuid not null default gen_random_uuid();
alter table public.mail_ai_endpoints
 add column if not exists vision_test_status text,
 add column if not exists credential_source_id uuid references public.mail_ai_endpoints(id) on delete set null;
alter table public.mail_preferences
 add column if not exists ai_shared_disabled boolean not null default false,
 add column if not exists ai_task_routes jsonb not null default '{}'::jsonb
 check(jsonb_typeof(ai_task_routes)='object' and octet_length(ai_task_routes::text)<=12000);
alter table public.mail_ai_endpoints drop constraint if exists mail_endpoint_protocol_auth;
alter table public.mail_ai_endpoints add constraint mail_endpoint_protocol_auth check(
 auth_scheme='bearer' or (api_protocol='messages' and auth_scheme='x-api-key')
 or (api_protocol='gemini' and auth_scheme='x-goog-api-key'));
-- Clients may edit configuration but may not forge the verified state or revision.
revoke insert, update, delete on public.mail_ai_endpoints from authenticated;
grant insert(user_id,label,api_url,model,declared_free,allow_paid,api_protocol,auth_scheme,chat_token_field)
 on public.mail_ai_endpoints to authenticated;
grant update(label,api_url,model,declared_free,allow_paid,api_protocol,auth_scheme,chat_token_field,updated_at)
 on public.mail_ai_endpoints to authenticated;

-- Scope includes the exact API base path, protocol and authentication scheme.
-- Gemini's model-specific generateContent path is the only varying suffix.
create or replace function mail_private.ai_credential_scope(p_url text,p_protocol text,p_auth text)
returns text language sql immutable set search_path=''
as $$ select p_protocol||':'||p_auth||':'||
 case when p_protocol='gemini' then regexp_replace(p_url,'/models/[A-Za-z0-9_.-]+:generateContent$','')
 else p_url end $$;
revoke all on function mail_private.ai_credential_scope(text,text,text) from public,anon,authenticated;

create or replace function public.mail_invalidate_changed_ai_endpoint()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if (new.api_url,new.model,new.declared_free,new.allow_paid,new.api_protocol,new.auth_scheme,new.chat_token_field,new.credential_source_id)
    is distinct from
    (old.api_url,old.model,old.declared_free,old.allow_paid,old.api_protocol,old.auth_scheme,old.chat_token_field,old.credential_source_id) then
   new.config_revision:=gen_random_uuid();
   if new.credential_source_id is distinct from old.credential_source_id or
     mail_private.ai_credential_scope(new.api_url,new.api_protocol,new.auth_scheme) is distinct from
     mail_private.ai_credential_scope(old.api_url,old.api_protocol,old.auth_scheme) then
     new.key_ready:=false;
   end if;
   new.last_test_at:=null;
   new.last_test_latency_ms:=null;
   new.vision_test_status:=null;
   new.last_test_status:=case when new.key_ready then '配置改变：请重新测试' else '配置改变：请重新授权并测试' end;
 end if;
 return new;
end; $$;

create or replace function public.mail_disable_ai_after_endpoint_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.config_revision is distinct from old.config_revision then
   -- Invalidate every dependent model on rotation or metadata change. The
   -- credential stays at the root; dependents need individual verification.
   if new.credential_source_id is null then
    update public.mail_ai_endpoints c set
      config_revision=gen_random_uuid(),
      key_ready=new.key_ready and mail_private.ai_credential_scope(c.api_url,c.api_protocol,c.auth_scheme)=mail_private.ai_credential_scope(new.api_url,new.api_protocol,new.auth_scheme),
      last_test_at=null,last_test_status=null,last_test_latency_ms=null,vision_test_status=null
     where c.credential_source_id=new.id and c.user_id=new.user_id;
   end if;
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
 select public.mail_read_endpoint_key(root.id) from public.mail_ai_endpoints e
 join public.mail_ai_endpoints root on root.id=coalesce(e.credential_source_id,e.id)
 where e.id=p_endpoint_id and e.config_revision=p_revision and e.key_ready
 and root.user_id=e.user_id and root.credential_source_id is null and root.key_ready
 and mail_private.ai_credential_scope(e.api_url,e.api_protocol,e.auth_scheme)=mail_private.ai_credential_scope(root.api_url,root.api_protocol,root.auth_scheme)
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
 -- Explicitly supplying a new key to a dependent detaches it from the group.
 update public.mail_ai_endpoints set credential_source_id=null where id=p_endpoint_id and credential_source_id is not null;
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

-- Only the authenticated Edge function calls this RPC, with the verified owner
-- and the exact source revision. No secret is copied to the new model.
create or replace function public.mail_add_shared_ai_model(p_owner uuid,p_source uuid,p_revision uuid,p_label text,p_model text,p_url text,p_token_field text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare root public.mail_ai_endpoints%rowtype; created uuid;
begin
 select * into root from public.mail_ai_endpoints where id=p_source and user_id=p_owner and config_revision=p_revision
  and credential_source_id is null and key_ready for update;
 if not found then return null; end if;
 if mail_private.ai_credential_scope(root.api_url,root.api_protocol,root.auth_scheme) is distinct from
    mail_private.ai_credential_scope(p_url,root.api_protocol,root.auth_scheme) then return null; end if;
 if not exists(select 1 from mail_private.ai_endpoint_credentials where endpoint_id=root.id) then return null; end if;
 if exists(select 1 from public.mail_ai_endpoints where user_id=p_owner and api_url=p_url and model=p_model
   and api_protocol=root.api_protocol and auth_scheme=root.auth_scheme) then return null; end if;
 if (select count(*) from public.mail_ai_endpoints where user_id=p_owner)>=100 then return null; end if;
 insert into public.mail_ai_endpoints(user_id,label,model,api_url,api_protocol,auth_scheme,chat_token_field,credential_source_id,key_ready,declared_free,allow_paid)
 values(p_owner,p_label,p_model,p_url,root.api_protocol,root.auth_scheme,p_token_field,root.id,true,false,false)
 returning id into created;
 return created;
end; $$;
revoke all on function public.mail_add_shared_ai_model(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mail_add_shared_ai_model(uuid,uuid,uuid,text,text,text,text) to service_role;

-- Root deletion cannot silently break dependent models. The RPC serializes
-- deletion with shared-model creation and removes the Vault credential.
create or replace function public.mail_remove_ai_model(p_owner uuid,p_id uuid,p_revision uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare sid uuid;
begin
 perform 1 from public.mail_ai_endpoints where id=p_id and user_id=p_owner and config_revision=p_revision for update;
 if not found then return false; end if;
 if exists(select 1 from public.mail_ai_endpoints where credential_source_id=p_id) then return false; end if;
 update public.mail_preferences set
   ai_shared_disabled=case when ai_endpoint_id=p_id and not ai_failover_enabled then true else ai_shared_disabled end,
   ai_route_order=array_remove(ai_route_order,'endpoint:'||p_id::text),
   ai_enabled=false, ai_allow_paid=case when ai_endpoint_id=p_id then false else ai_allow_paid end
 where user_id=p_owner and (ai_endpoint_id=p_id or ('endpoint:'||p_id::text)=any(ai_route_order)
    or coalesce(ai_task_routes->'mail_analysis'->'routes','[]'::jsonb) ? ('endpoint:'||p_id::text));
 select vault_id into sid from mail_private.ai_endpoint_credentials where endpoint_id=p_id;
 delete from public.mail_ai_endpoints where id=p_id;
 if sid is not null then delete from vault.secrets where id=sid; end if;
 return true;
end; $$;
revoke all on function public.mail_remove_ai_model(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.mail_remove_ai_model(uuid,uuid,uuid) to service_role;
