-- Changing an AI endpoint's destination, model, or declared billing mode
-- must not silently reuse an already-authorized key for the new destination.
create or replace function public.mail_invalidate_changed_ai_endpoint()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.api_url is distinct from old.api_url
    or new.model is distinct from old.model
    or new.declared_free is distinct from old.declared_free
    or new.allow_paid is distinct from old.allow_paid then
   new.key_ready:=false;
   new.last_test_at:=null;
   new.last_test_status:='配置改变：请重新保存 Key 并测试';
 end if;
 return new;
end; $$;
drop trigger if exists mail_endpoint_invalidate_on_change on public.mail_ai_endpoints;
create trigger mail_endpoint_invalidate_on_change
before update on public.mail_ai_endpoints
for each row execute function public.mail_invalidate_changed_ai_endpoint();

create or replace function public.mail_disable_ai_after_endpoint_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.api_url is distinct from old.api_url
   or new.model is distinct from old.model
   or new.declared_free is distinct from old.declared_free
   or new.allow_paid is distinct from old.allow_paid then
   update public.mail_preferences set ai_enabled=false,ai_allow_paid=false
    where ai_endpoint_id=new.id;
 end if;
 return null;
end; $$;
drop trigger if exists mail_endpoint_disable_on_change on public.mail_ai_endpoints;
create trigger mail_endpoint_disable_on_change
after update on public.mail_ai_endpoints
for each row execute function public.mail_disable_ai_after_endpoint_change();

revoke all on function public.mail_invalidate_changed_ai_endpoint() from public,anon,authenticated;
revoke all on function public.mail_disable_ai_after_endpoint_change() from public,anon,authenticated;
