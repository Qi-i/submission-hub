-- Align the conditional trigger with explicit user opt-in; old mail is never implicitly analyzed.
select cron.unschedule('submission_hub_mail_free_ai_10min')
where exists(select 1 from cron.job where jobname='submission_hub_mail_free_ai_10min');

select cron.schedule(
 'submission_hub_mail_free_ai_10min','5,15,25,35,45,55 * * * *',
 $job$
 select net.http_post(
  url:='https://grrwxtlauqcfnerckijn.supabase.co/functions/v1/mail-ai-analyze',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='sh_mail_cloud_cron_key' limit 1)
  ),
  body:='{}'::jsonb,timeout_milliseconds:=30000
 ) as request_id
 where exists (
   select 1 from public.mail_preferences p
   where p.ai_enabled and p.ai_key_ready and p.ai_daily_limit>0
     and (p.ai_analyze_existing or p.ai_started_at is not null)
     and exists(select 1 from public.mail_messages m
       where m.user_id=p.user_id and m.ai_state='pending'
         and (p.ai_analyze_existing or m.first_saved_at>=p.ai_started_at))
 );
 $job$
);
