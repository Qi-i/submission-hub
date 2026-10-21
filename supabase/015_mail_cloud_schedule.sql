-- Only invoke paid-metered HTTP edge function when at least one configured mailbox is enabled.
-- Runtime bearer credential comes from encrypted Supabase Vault, not from SQL text.
select cron.schedule(
 'submission_hub_cloud_mail_10min',
 '*/10 * * * *',
 $job$
 select net.http_post(
  url:='https://grrwxtlauqcfnerckijn.supabase.co/functions/v1/mail-cloud-collector',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets
      where name='sh_mail_cloud_cron_key' limit 1)
  ),
  body:='{}'::jsonb,
  timeout_milliseconds:=100000
 ) as request_id
 where exists (
  select 1 from public.mail_accounts
  where enabled is true and cloud_state in ('ready','error')
 );
 $job$
);
