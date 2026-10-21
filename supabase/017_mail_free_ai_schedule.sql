-- The AI worker runs only when an owner has explicitly enabled free-model analysis.
-- Cron token remains inside Vault; no API keys or email content in the scheduled command.
select cron.schedule(
 'submission_hub_mail_free_ai_10min',
 '5,15,25,35,45,55 * * * *',
 $job$
 select net.http_post(
  url:='https://grrwxtlauqcfnerckijn.supabase.co/functions/v1/mail-ai-analyze',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='sh_mail_cloud_cron_key' limit 1)
  ),
  body:='{}'::jsonb,
  timeout_milliseconds:=30000
 ) as request_id
 where exists (
  select 1 from public.mail_preferences p
  where p.ai_enabled is true and p.ai_key_ready is true and p.ai_daily_limit>0
    and exists (
      select 1 from public.mail_messages m
      where m.user_id=p.user_id and m.ai_state='pending'
        and (p.ai_analyze_existing or m.first_saved_at >= p.updated_at)
    )
 );
 $job$
);
