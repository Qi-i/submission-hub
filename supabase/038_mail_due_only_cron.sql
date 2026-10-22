-- Avoid invoking the collector when every mailbox is paused or in backoff.
-- Historical mail ingestion continues in bounded batches; AI model calls remain off.
select cron.schedule(
 'submission_hub_cloud_mail_10min','*/10 * * * *',
 $job$
 select net.http_post(
  url:='https://grrwxtlauqcfnerckijn.supabase.co/functions/v1/mail-cloud-collector',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets
     where name='sh_mail_cloud_cron_key' limit 1)),
  body:='{}'::jsonb, timeout_milliseconds:=100000
 ) as request_id
 where exists (
  select 1 from public.mail_accounts
  where enabled is true and cloud_state in ('ready','error')
    and (next_attempt_at is null or next_attempt_at <= now())
 );
 $job$
);
