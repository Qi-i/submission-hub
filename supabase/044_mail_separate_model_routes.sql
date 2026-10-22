-- Translation selection is distinct from mail analysis, and AI stays off by default.
alter table public.mail_preferences
 add column if not exists translation_route_order text[] not null default '{}',
 add column if not exists translation_failover_enabled boolean not null default false;
alter table public.mail_ai_endpoints
 add column if not exists classification_test_passed boolean not null default false;
-- Preserve any previously selected translator, especially MagicZotero.
update public.mail_preferences p
set translation_route_order=case
 when p.ai_endpoint_id is not null then array['endpoint:'||p.ai_endpoint_id::text]
 else array['glm:'||coalesce(p.ai_model,'glm-4.7-flash')] end
where cardinality(p.translation_route_order)=0;
-- Never implicitly pass MagicZotero's translation-only key into the analysis worker.
update public.mail_preferences p set ai_endpoint_id=null,ai_enabled=false
where p.ai_endpoint_id is not null and exists(
 select 1 from public.mail_ai_endpoints e
 where e.user_id=p.user_id and e.id=p.ai_endpoint_id
 and e.model='magic-translate-gpt'
 and e.api_url='https://gpt.magiczotero.top/v1/chat/completions');
