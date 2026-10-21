-- Optional endpoint queue is idle when the selected provider lacks a key or consent.
select cron.unschedule('submission_hub_mail_free_ai_10min')
where exists(select 1 from cron.job where jobname='submission_hub_mail_free_ai_10min');
select cron.schedule(
 'submission_hub_mail_free_ai_10min','5,15,25,35,45,55 * * * *',
 $job$
 select net.http_post(
  url:='https://grrwxtlauqcfnerckijn.supabase.co/functions/v1/mail-ai-analyze',
  headers:=jsonb_build_object('Content-Type','application/json',
    'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='sh_mail_cloud_cron_key' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=30000
 ) as request_id
 where exists (
  select 1 from public.mail_preferences p where p.ai_enabled and p.ai_daily_limit>0 and
   (p.ai_analyze_existing or p.ai_started_at is not null) and
   ( (p.ai_endpoint_id is null and p.ai_key_ready and p.ai_model in ('glm-4.7-flash','glm-4.5-flash'))
     or exists(select 1 from public.mail_ai_endpoints e where e.id=p.ai_endpoint_id
       and e.user_id=p.user_id and e.key_ready
       and (e.declared_free or (e.allow_paid and p.ai_allow_paid))) ) and
   exists(select 1 from public.mail_messages m where m.user_id=p.user_id and m.ai_state='pending'
     and (p.ai_analyze_existing or m.first_saved_at >= p.ai_started_at))
 );
 $job$
);